import { createSign } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseOutreachRows } from '../../src/lib/outreach-import';

const spreadsheetId = '1p98z0dW-KERPxTTDQo_mBLUlXSGdFB_pNsWGyJieYpU';
const sheetRange = "'Outreach'!A1:T1000";

function setting(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing Netlify environment variable: ${name}`);
  return value;
}

async function googleAccessToken(email: string, rawKey: string) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({
    iss: email,
    scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign('RSA-SHA256').update(unsigned).sign(rawKey.replace(/\\n/g, '\n'), 'base64url');
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`Google authentication failed (${response.status}).`);
  const body = await response.json() as { access_token?: string };
  if (!body.access_token) throw new Error('Google did not return an access token.');
  return body.access_token;
}

async function readSheet() {
  const email = setting('GOOGLE_SHEETS_CLIENT_EMAIL');
  const key = setting('GOOGLE_SHEETS_PRIVATE_KEY');
  const token = await googleAccessToken(email, key);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetRange)}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`;
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Google Sheets read failed (${response.status}).`);
  const body = await response.json() as { values?: string[][] };
  if (!Array.isArray(body.values)) throw new Error('Google Sheets returned no values array.');
  return body.values.map(row => row.map(value => String(value ?? '')));
}

/** Runs only as a Netlify scheduled function; it has no public HTTP trigger. */
export default async function dailyOutreachSync() {
  const startedAt = new Date().toISOString();
  let db: ReturnType<typeof createClient<any>> | undefined;
  let runId: string | undefined;
  try {
    db = createClient<any>(setting('NEXT_PUBLIC_OJ_SUPABASE_URL'), setting('OJ_SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const organizationId = setting('OJ_OUTREACH_ORGANIZATION_ID');
    const { data: run, error: runError } = await db.from('oj_outreach_sync_runs').insert({
      organization_id: organizationId, status: 'failed', started_at: startedAt, finished_at: startedAt,
      error_summary: 'Sync did not complete.',
    }).select('id').single();
    if (runError || !run) throw new Error('Could not start the outreach sync run.');
    runId = run.id;

    const rows = await readSheet();
    const result = parseOutreachRows(rows);
    const now = new Date().toISOString();
    const records = result.prospects.map(prospect => ({ ...prospect, organization_id: organizationId, last_seen_at: now, updated_at: now }));
    if (records.length) {
      const { error } = await db.from('oj_outreach_prospects').upsert(records, { onConflict: 'organization_id,source_key', ignoreDuplicates: false });
      if (error) throw new Error('Could not save the imported outreach rows.');
    }
    const rowsSeen = result.prospects.length + result.skippedRows.length + result.duplicateRows.length;
    const { error: finishError } = await db.from('oj_outreach_sync_runs').update({
      status: result.skippedRows.length || result.duplicateRows.length ? 'partial' : 'success',
      rows_seen: rowsSeen, rows_written: records.length, rows_skipped: result.skippedRows.length,
      duplicate_rows: result.duplicateRows.length, error_summary: '', finished_at: new Date().toISOString(),
    }).eq('id', runId);
    if (finishError) throw new Error('Imported rows, but could not close the sync run.');
    return { imported: records.length, skipped: result.skippedRows.length, duplicates: result.duplicateRows.length };
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unexpected sync failure.';
    if (db && runId) await db.from('oj_outreach_sync_runs').update({ status: 'failed', error_summary: message, finished_at: new Date().toISOString() }).eq('id', runId);
    console.error('Daily outreach sync failed:', message);
    throw error;
  }
}

export const config = { schedule: '30 4 * * *' };

