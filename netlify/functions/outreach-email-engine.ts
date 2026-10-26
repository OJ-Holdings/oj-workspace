import { createClient } from '@supabase/supabase-js';
import { hasValidSyncToken } from './daily-outreach-sync';
import { planRun, questRun, reportRun, type EngineEnv, type EngineStore, type NewEvent, type QuestData } from '../../src/lib/email-engine-api';
import { defaultEngineSettings, type EmailEvent, type EngineProspect, type EngineSettings, type EngineState } from '../../src/lib/email-engine';
import type { DmLogEntry } from '../../src/lib/dm-quests';

/**
 * The one door for the Google Apps Script email sender and its reminders.
 * Bearer-token only (the same secret as the spreadsheet import). The Supabase service key
 * stays on this server; no signed-in user can reach it, and it sends nothing itself.
 */
const MAX_BODY_BYTES = 200_000;
const SUPABASE_URL = process.env.NEXT_PUBLIC_OJ_SUPABASE_URL || 'https://vgckpcktsfuithqggknd.supabase.co';
const prospectFields = 'id,business_name,industry,best_fit_service,secondary_fit,email,email_subject,email_body,sent_by,date_added,source_status,outreach_status';

type Event = { httpMethod?: string; headers?: Record<string, string | undefined>; body?: string | null };
type Result = { statusCode: number; headers: Record<string, string>; body: string };
const response = (statusCode: number, body: Record<string, unknown>): Result => ({
  statusCode, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }, body: JSON.stringify(body),
});
function setting(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing server configuration: ${name}`);
  return value;
}
class NotInstalled extends Error {}

function supabaseStore(org: string): EngineStore {
  const db = createClient<any>(SUPABASE_URL, setting('OJ_SUPABASE_SERVICE_ROLE_KEY'), { auth: { autoRefreshToken: false, persistSession: false } });
  const check = (error: { code?: string; message?: string } | null) => {
    if (!error) return;
    if (error.code === 'PGRST205' || error.code === '42P01' || /does not exist|schema cache/i.test(error.message ?? '')) {
      throw new NotInstalled('The email engine tables are not installed yet. Apply supabase/schemas/solutions-email-engine.sql.');
    }
    throw new Error('Database request failed.');
  };
  return {
    async settings() {
      const { data, error } = await db.from('oj_email_engine_settings').select('enabled,daily_cap_max,niche_filter').eq('organization_id', org).maybeSingle();
      check(error);
      return (data as EngineSettings | null) ?? { ...defaultEngineSettings };
    },
    async state() {
      const { data, error } = await db.from('oj_email_engine_state').select('last_heartbeat_at,state,detail,warmup_started_on,sender_domain').eq('organization_id', org).maybeSingle();
      check(error);
      return (data as EngineState | null) ?? null;
    },
    async prospects() {
      const { data, error } = await db.from('oj_outreach_prospects').select(prospectFields).eq('organization_id', org).limit(1000);
      check(error);
      return (data ?? []) as EngineProspect[];
    },
    async events(since) {
      const { data, error } = await db.from('oj_email_events').select('prospect_id,kind,event_at,detail').eq('organization_id', org)
        .gte('event_at', since.toISOString()).order('event_at', { ascending: false }).limit(5000);
      check(error);
      return (data ?? []) as EmailEvent[];
    },
    async record(events: NewEvent[]) {
      if (!events.length) return [];
      const { data, error } = await db.from('oj_email_events')
        .upsert(events.map(e => ({ ...e, organization_id: org })), { onConflict: 'organization_id,dedupe_key', ignoreDuplicates: true })
        .select('prospect_id,kind,dedupe_key');
      check(error);
      const inserted = new Set((data ?? []).map((r: { dedupe_key: string }) => r.dedupe_key));
      return events.filter(e => inserted.has(e.dedupe_key));
    },
    async setStatus(prospectId, status, at) {
      const { error } = await db.from('oj_outreach_prospects').update({ outreach_status: status, status_updated_at: at.toISOString(), updated_at: at.toISOString() })
        .eq('organization_id', org).eq('id', prospectId);
      check(error);
    },
    async saveState({ now, state, detail, warmupStartedOn, senderDomain }) {
      const existing = await this.state();
      const row = {
        organization_id: org, last_heartbeat_at: now.toISOString(), updated_at: now.toISOString(),
        state: state ?? existing?.state ?? 'idle', detail: (detail ?? existing?.detail ?? '').slice(0, 300),
        warmup_started_on: warmupStartedOn ?? existing?.warmup_started_on ?? null, sender_domain: senderDomain ?? existing?.sender_domain ?? null,
      };
      const { error } = await db.from('oj_email_engine_state').upsert(row, { onConflict: 'organization_id' });
      check(error);
    },
    async questData(since): Promise<QuestData> {
      const [goal, members, log] = await Promise.all([
        db.from('oj_growth_settings').select('dm_daily_goal').eq('organization_id', org).maybeSingle(),
        db.from('oj_memberships').select('user_id,display_name,role').eq('organization_id', org).in('role', ['owner', 'member']),
        db.from('oj_outreach_dm_log').select('id,actor_id,prospect_id,channel,work_day,undone_at,created_at').eq('organization_id', org).gte('work_day', since).limit(5000),
      ]);
      check(goal.error); check(members.error); check(log.error);
      return {
        goal: (goal.data as { dm_daily_goal?: number } | null)?.dm_daily_goal ?? 10,
        members: (members.data ?? []).map((m: { user_id: string; display_name: string }) => ({ userId: m.user_id, displayName: m.display_name })),
        log: (log.data ?? []) as DmLogEntry[],
      };
    },
  };
}

export async function handler(event: Event, injected?: { store: EngineStore; env: EngineEnv; now?: Date }): Promise<Result> {
  if (event.httpMethod !== 'POST') return response(405, { error: 'Method not allowed.' });
  if (!hasValidSyncToken(event.headers?.authorization ?? event.headers?.Authorization, process.env.OJ_OUTREACH_SYNC_TOKEN)) return response(401, { error: 'Unauthorized.' });
  if (!event.body || Buffer.byteLength(event.body, 'utf8') > MAX_BODY_BYTES) return response(413, { error: 'Request body is empty or too large.' });
  let body: Record<string, unknown>;
  try {
    const parsed = JSON.parse(event.body);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('shape');
    body = parsed as Record<string, unknown>;
  } catch { return response(400, { error: 'Request body must be a JSON object.' }); }
  if (body.action !== 'plan' && body.action !== 'report' && body.action !== 'quests') return response(400, { error: 'Unknown action.' });

  try {
    const env = injected?.env ?? { postalAddress: process.env.OJ_EMAIL_POSTAL_ADDRESS?.trim() || null, company: process.env.OJ_EMAIL_COMPANY?.trim() || 'OJ Solutions', workspaceUrl: process.env.OJ_WORKSPACE_URL?.trim() || 'https://ojworkspace.netlify.app' };
    const store = injected?.store ?? supabaseStore(setting('OJ_OUTREACH_ORGANIZATION_ID'));
    const now = injected?.now ?? new Date();
    if (body.action === 'plan') return response(200, await planRun(store, env, { now, senderName: body.senderName, senderFilter: body.senderFilter, senderDomain: body.senderDomain, dryRun: body.dryRun === true }));
    if (body.action === 'report') return response(200, await reportRun(store, { now, results: body.results, senderDomain: body.senderDomain }));
    return response(200, await questRun(store, env, { now }));
  } catch (error) {
    if (error instanceof NotInstalled) return response(503, { error: error.message });
    console.error('Email engine request failed:', error instanceof Error ? error.message.slice(0, 200) : 'unknown');
    return response(500, { error: 'The engine request failed. Check the Netlify function log.' });
  }
}
