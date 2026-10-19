import { timingSafeEqual } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { parseOutreachRows } from '../../src/lib/outreach-import';

const MAX_BODY_BYTES = 512_000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_OJ_SUPABASE_URL || 'https://vgckpcktsfuithqggknd.supabase.co';

type Event = { httpMethod?: string; headers?: Record<string, string | undefined>; body?: string | null };
type Result = { statusCode: number; headers: Record<string, string>; body: string };

const response = (statusCode: number, body: Record<string, unknown>): Result => ({
  statusCode,
  headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  body: JSON.stringify(body),
});

export function hasValidSyncToken(header: string | undefined, expected: string | undefined) {
  if (!header?.startsWith('Bearer ') || !expected) return false;
  const presented = Buffer.from(header.slice(7));
  const configured = Buffer.from(expected);
  return presented.length === configured.length && timingSafeEqual(presented, configured);
}

function setting(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}

/** Receives a private spreadsheet-bound Apps Script push. The Supabase service key stays on Netlify. */
export async function handler(event: Event): Promise<Result> {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed.' });
  if (!hasValidSyncToken(event.headers?.authorization ?? event.headers?.Authorization, process.env.OJ_OUTREACH_SYNC_TOKEN)) {
    return response(401, { error: 'Unauthorized.' });
  }
  if (!event.body || Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) {
    return response(413, { error: 'Request body is empty or exceeds the 500 KB limit.' });
  }

  let rows: unknown;
  try { rows = (JSON.parse(event.body) as { rows?: unknown }).rows; }
  catch { return response(400, { error: 'Request body must be valid JSON.' }); }
  if (!Array.isArray(rows) || rows.length > 1000 || !rows.every(row => Array.isArray(row) && row.length <= 20 && row.every(cell => typeof cell === 'string'))) {
    return response(400, { error: 'Expected up to 1,000 rows of at most 20 text cells.' });
  }

  let db: ReturnType<typeof createClient<any>>;
  let runId: string | undefined;
  try {
    db = createClient<any>(SUPABASE_URL, setting('OJ_SUPABASE_SERVICE_ROLE_KEY'), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const organizationId = setting('OJ_OUTREACH_ORGANIZATION_ID');
    const startedAt = new Date().toISOString();
    const { data: run, error: runError } = await db.from('oj_outreach_sync_runs').insert({
      organization_id: organizationId, status: 'failed', started_at: startedAt, finished_at: startedAt,
      error_summary: 'Sync did not complete.',
    }).select('id').single();
    if (runError || !run) throw new Error('Could not start the outreach sync run.');
    runId = run.id;

    const result = parseOutreachRows(rows as string[][]);
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
    return response(200, { imported: records.length, skipped: result.skippedRows.length, duplicates: result.duplicateRows.length });
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 500) : 'Unexpected sync failure.';
    if (runId) {
      const db = createClient<any>(SUPABASE_URL, setting('OJ_SUPABASE_SERVICE_ROLE_KEY'), {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      await db.from('oj_outreach_sync_runs').update({ status: 'failed', error_summary: message, finished_at: new Date().toISOString() }).eq('id', runId);
    }
    console.error('Daily outreach sync failed:', message);
    return response(500, { error: 'Outreach import failed. Check the sync history for details.' });
  }
}
