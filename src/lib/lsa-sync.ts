// Local Services Ads sync: reads leads and their conversations from the Google
// Ads API (read only) and lands them through the lead pipeline. Used by the
// server's 10-minute poller, the Sync now button and the scripts in scripts/lsa.ts.
// No developer token is sent: since September 9, 2026 API access comes from the
// Cloud project (oj-automations, Explorer access). It signs in as a service
// account added directly to Google Ads as a Read only user: no human login, no
// refresh token, nothing that expires. The key file lives outside the repo, at
// the absolute path in GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH, and is never logged.

import { createSign } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { posix, win32 } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ojConnection } from './oj-connection';
import { autoDeadUpdates, chicagoDay, chicagoHour, chicagoStamp, ENGINE_COLUMNS, fromChicago, PIPELINE, planIngest, type ArchivePlan, type EngineLead, type IngestPlan, type LeadReview, type LinkOverride, type LsaLead, type ReviewStatus, type ThreadEvent } from './lead-pipeline';

export const LSA = {
  apiVersion: 'v26',
  scope: 'https://www.googleapis.com/auth/adwords',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  /** Explorer access allows 2,880 operations a day. The engine stops itself well below that. */
  dailyOpsLimit: 2880, dailyOpsBudget: 1200,
  pollMinutes: 10, pollFromHour: 7, pollUntilHour: 22,
  firstSyncDays: 30, idsPerQuery: 100, backfillMonths: 48, backfillEmptyMonths: 3,
  waitingForBackfill: 'Waiting for the one-time backfill. On the Windows host, run: npm run lsa -- backfill. Until it finishes, the sync adds nothing (Google is not read).',
} as const;

export type ErrorKind = 'setup' | 'token' | 'quota' | 'access' | 'api';
export class LsaError extends Error { constructor(readonly kind: ErrorKind, message: string) { super(message); } }
const asLsaError = (e: unknown) => e instanceof LsaError ? e : new LsaError('api', e instanceof Error ? e.message : String(e));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = SupabaseClient<any, any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;
const DAY = 86_400_000;
const nonNull = <T,>(v: T | null): v is T => v !== null;
const chunks = <T,>(list: T[], size: number) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, (i + 1) * size));

/* ------------------------------ Google sign-in ------------------------------ */

export type GoogleConfig = { clientEmail: string; privateKey: string; keyId: string | null; customerId: string; loginCustomerId: string | null };
const digits = (v: string | undefined) => (v ?? '').replace(/\D/g, '');
/** 9723939798 as Google Ads shows it: 972-393-9798. */
export const dashed = (id: string | null) => id && id.length === 10 ? `${id.slice(0, 3)}-${id.slice(3, 6)}-${id.slice(6)}` : id ?? '';

/**
 * The service account key (the JSON Google Cloud downloads) at the absolute path in
 * GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH. Absolute because the Windows host deploys
 * into fresh release folders and copies only .env.local into them.
 */
export function serviceAccount(env: NodeJS.ProcessEnv = process.env) {
  const file = env.GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH?.trim().replace(/^"(.*)"$/, '$1');
  if (!file) throw new LsaError('setup', 'GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH is not set on this server. Set it to the full path of the service account key file, outside the repo.');
  if (!win32.isAbsolute(file) && !posix.isAbsolute(file)) throw new LsaError('setup', `GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH must be a full path such as C:/Users/you/.secrets/oj-workspace/lsa-service-account.json, not "${file}".`);
  if (!existsSync(file)) throw new LsaError('setup', `No service account key file at GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH (${file}).`);
  let key: { type?: string; client_email?: string; private_key?: string; private_key_id?: string };
  try { key = JSON.parse(readFileSync(file, 'utf8')); } catch { throw new LsaError('setup', `The file at GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH (${file}) is not valid JSON.`); }
  if (key.type !== 'service_account' || !key.client_email || !key.private_key) throw new LsaError('setup', `The file at GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH (${file}) is not a service account key. Download a JSON key from Cloud Console > IAM & Admin > Service Accounts > Keys.`);
  return { clientEmail: key.client_email, privateKey: key.private_key, keyId: key.private_key_id ?? null };
}

export function googleConfig(env: NodeJS.ProcessEnv = process.env): GoogleConfig {
  const account = serviceAccount(env);
  const customerId = digits(env.GOOGLE_ADS_LSA_CUSTOMER_ID);
  if (customerId.length !== 10) throw new LsaError('setup', 'GOOGLE_ADS_LSA_CUSTOMER_ID must be the 10-digit Local Services Ads account id.');
  const login = digits(env.GOOGLE_ADS_LOGIN_CUSTOMER_ID);
  return { ...account, customerId, loginCustomerId: login.length === 10 ? login : null };
}

let cachedToken: { for: string; token: string; until: number } | null = null;
/** Signs a one-hour request with the service account key and swaps it for an access token (OAuth JWT bearer, no impersonation). */
export async function accessToken(cfg: Pick<GoogleConfig, 'clientEmail' | 'privateKey' | 'keyId'>) {
  const id = `${cfg.clientEmail}/${cfg.keyId ?? ''}`;
  if (cachedToken?.for === id && cachedToken.until > Date.now()) return cachedToken.token;
  const now = Math.floor(Date.now() / 1000);
  const part = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const unsigned = `${part({ alg: 'RS256', typ: 'JWT', ...(cfg.keyId ? { kid: cfg.keyId } : {}) })}.${part({ iss: cfg.clientEmail, scope: LSA.scope, aud: LSA.tokenUrl, iat: now, exp: now + 3600 })}`;
  let signature: string;
  try { signature = createSign('RSA-SHA256').update(unsigned).sign(cfg.privateKey, 'base64url'); }
  catch { throw new LsaError('setup', 'The service account key could not sign in: its private key is unreadable. Download a fresh JSON key.'); }
  let res: Response;
  try {
    res = await fetch(LSA.tokenUrl, {
      method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, signal: AbortSignal.timeout(20_000),
      body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${signature}` }),
    });
  } catch (e) { throw new LsaError('api', `Could not reach Google sign-in: ${e instanceof Error ? e.message : String(e)}`); }
  const body = await res.json().catch(() => ({})) as { access_token?: string; expires_in?: number; error?: string; error_description?: string };
  if (res.ok && body.access_token) {
    cachedToken = { for: id, token: body.access_token, until: Date.now() + Math.max(60, (body.expires_in ?? 3600) - 300) * 1000 };
    return body.access_token;
  }
  const code = body.error ?? `HTTP ${res.status}`;
  const refused = code === 'invalid_grant' || code === 'invalid_client' || code === 'unauthorized_client';
  throw new LsaError(refused ? 'token' : 'api', `Google refused the service account sign-in for ${cfg.clientEmail}: ${code}${body.error_description ? ` (${body.error_description})` : ''}.${refused ? ' The key may have been deleted or disabled in Cloud Console, or this computer\'s clock is wrong. Create a new key if needed and update the file at GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH.' : ''}`);
}

/* ------------------------------ Google Ads API ------------------------------ */

function describeFailure(status: number, body: Row, cfg: GoogleConfig): { kind: ErrorKind; message: string } {
  const err = body?.error ?? {};
  const errors: Row[] = (err.details ?? []).flatMap((d: Row) => d?.errors ?? []);
  const codes = errors.map(e => Object.entries(e.errorCode ?? {}).map(([k, v]) => `${k}.${v}`).join(',')).filter(Boolean);
  const detail = errors.map(e => e.message).filter(Boolean).join(' ') || err.message || '';
  const all = `${err.status ?? ''} ${codes.join(' ')} ${detail}`;
  if (/NOT_ADS_USER/.test(all)) return {
    kind: 'access',
    message: `The service account ${cfg.clientEmail} has not been added in Google Ads yet (NOT_ADS_USER). In Google Ads${cfg.loginCustomerId ? ` manager account ${dashed(cfg.loginCustomerId)}` : ''}, go to Admin > Access and security > Users, click +, enter that email, choose Read only, and click Add account. Then run the sync again.`,
  };
  const kind: ErrorKind = status === 401 || /UNAUTHENTICATED|authenticationError/i.test(all) ? 'token'
    : status === 429 || /RESOURCE_EXHAUSTED|quotaError/i.test(all) ? 'quota'
    : status === 403 || /PERMISSION_DENIED|authorizationError|CLOUD_PROJECT_NOT_APPROVED|ACTION_NOT_PERMITTED|DEVELOPER_TOKEN/i.test(all) ? 'access'
    : 'api';
  return { kind, message: [`Google Ads API ${status}${err.status ? ` ${err.status}` : ''}`, codes.join('; '), detail].filter(Boolean).join(': ').slice(0, 1500) };
}

/** GAQL search, every page, counting operations against the daily budget. */
export class LsaApi {
  ops = 0;
  private login: string | null;
  constructor(readonly cfg: GoogleConfig, private token: string, private allowed: (ops: number) => boolean = () => true) { this.login = cfg.loginCustomerId; }
  async search(query: string): Promise<Row[]> {
    const rows: Row[] = [];
    let pageToken: string | undefined;
    do {
      if (!this.allowed(this.ops + 1)) throw new LsaError('quota', `Paused to stay under Google's daily limit: ${LSA.dailyOpsBudget} of the ${LSA.dailyOpsLimit} allowed operations are used today. Syncing resumes tomorrow.`);
      const page = await this.post(query, pageToken);
      rows.push(...(page.results ?? []));
      pageToken = page.nextPageToken || undefined;
    } while (pageToken);
    return rows;
  }
  private async post(query: string, pageToken?: string, retried = false): Promise<{ results?: Row[]; nextPageToken?: string }> {
    const headers: Record<string, string> = { authorization: `Bearer ${this.token}`, 'content-type': 'application/json' };
    if (this.login) headers['login-customer-id'] = this.login;
    let res: Response;
    try {
      res = await fetch(`https://googleads.googleapis.com/${LSA.apiVersion}/customers/${this.cfg.customerId}/googleAds:search`, {
        method: 'POST', headers, body: JSON.stringify(pageToken ? { query, pageToken } : { query }), signal: AbortSignal.timeout(60_000),
      });
    } catch (e) { throw new LsaError('api', `Could not reach the Google Ads API: ${e instanceof Error ? e.message : String(e)}`); }
    this.ops++;
    const body = await res.json().catch(() => ({})) as Row;
    if (res.ok) return body;
    const failure = describeFailure(res.status, body, this.cfg);
    // The login customer id is optional: if Google refuses it, try once without it.
    if (this.login && !retried && /login.customer|USER_PERMISSION_DENIED|INVALID_LOGIN_CUSTOMER_ID|CUSTOMER_NOT_FOUND/i.test(failure.message)) { this.login = null; return this.post(query, pageToken, true); }
    throw new LsaError(failure.kind, failure.message);
  }
}

// Every field local_services_lead exposes in v26. It has no location field; the
// address comes from the customer's messages instead.
const leadFields = ['id', 'category_id', 'service_id', 'contact_details', 'lead_type', 'lead_status', 'creation_date_time', 'locale', 'lead_charged',
  'credit_details.credit_state', 'credit_details.credit_state_last_update_date_time', 'note.description', 'lead_feedback_submitted'].map(f => `local_services_lead.${f}`).join(', ');
const eventFields = ['id', 'lead', 'conversation_channel', 'participant_type', 'event_date_time', 'message_details.text', 'message_details.attachment_urls',
  'phone_call_details.call_duration_millis', 'phone_call_details.call_recording_url'].map(f => `local_services_lead_conversation.${f}`).join(', ');
// Date-times are in the account's time zone, America/Chicago.
export const leadQuery = (where: string) => `SELECT ${leadFields} FROM local_services_lead WHERE ${where} ORDER BY local_services_lead.creation_date_time`;
export const eventQuery = (where: string) => `SELECT ${eventFields} FROM local_services_lead_conversation WHERE ${where} ORDER BY local_services_lead_conversation.event_date_time`;

export function toLead(row: Row): LsaLead | null {
  const l = row.localServicesLead;
  const createdAt = fromChicago(l?.creationDateTime);
  if (!l?.id || !/^\d+$/.test(String(l.id)) || !createdAt) return null;
  const c = l.contactDetails ?? {};
  const text = (v: unknown) => typeof v === 'string' && v.trim() ? v.trim() : null;
  return {
    id: String(l.id), type: l.leadType ?? null, category: l.categoryId ?? null, service: l.serviceId ?? null, status: l.leadStatus ?? null,
    charged: typeof l.leadCharged === 'boolean' ? l.leadCharged : null, credit: l.creditDetails?.creditState ?? null,
    creditAt: fromChicago(l.creditDetails?.creditStateLastUpdateDateTime), locale: l.locale ?? null, createdAt,
    name: text(c.consumerName), phone: text(c.phoneNumber), email: text(c.email)?.toLowerCase() ?? null,
    note: text(l.note?.description), feedback: typeof l.leadFeedbackSubmitted === 'boolean' ? l.leadFeedbackSubmitted : null,
  };
}
export function toEvent(row: Row): ThreadEvent | null {
  const e = row.localServicesLeadConversation;
  const at = fromChicago(e?.eventDateTime), lsa = /localServicesLeads\/(\d+)/.exec(String(e?.lead ?? ''))?.[1];
  if (!e?.id || !at || !lsa) return null;
  const event: ThreadEvent = { id: String(e.id), lsa, at, who: e.participantType === 'CONSUMER' ? 'customer' : e.participantType === 'ADVERTISER' ? 'us' : 'other', channel: e.conversationChannel ?? 'UNKNOWN' };
  if (e.messageDetails?.text) event.text = String(e.messageDetails.text).slice(0, 5000);
  if (e.messageDetails?.attachmentUrls?.length) event.attachments = (e.messageDetails.attachmentUrls as string[]).slice(0, 20);
  if (e.phoneCallDetails?.callDurationMillis) event.seconds = Math.round(Number(e.phoneCallDetails.callDurationMillis) / 1000);
  if (e.phoneCallDetails?.callRecordingUrl) event.recording = e.phoneCallDetails.callRecordingUrl;
  return event;
}
export async function leadsById(api: LsaApi, ids: string[]) {
  const out: LsaLead[] = [];
  for (const chunk of chunks(ids.filter(id => /^\d+$/.test(id)), LSA.idsPerQuery)) out.push(...(await api.search(leadQuery(`local_services_lead.id IN (${chunk.join(', ')})`))).map(toLead).filter(nonNull));
  return out;
}
export async function eventsForLeads(api: LsaApi, ids: string[]) {
  const out: ThreadEvent[] = [];
  for (const chunk of chunks(ids.filter(id => /^\d+$/.test(id)), LSA.idsPerQuery)) {
    const names = chunk.map(id => `'customers/${api.cfg.customerId}/localServicesLeads/${id}'`).join(', ');
    out.push(...(await api.search(eventQuery(`local_services_lead_conversation.lead IN (${names})`))).map(toEvent).filter(nonNull));
  }
  return out;
}

/* ------------------------------ Workspace records ------------------------------ */

export type Backfill = { month?: string; empty?: number; done?: boolean; created?: number; linked?: number; held?: number };
export type SyncState = { lead_checkpoint: string | null; event_checkpoint: string | null; backfill: Backfill; ops_day: string | null; ops_used: number; last_run_at: string | null; last_ok_at: string | null; error_kind: ErrorKind | null; last_error: string | null; last_result: Row | null };
const blankState: SyncState = { lead_checkpoint: null, event_checkpoint: null, backfill: {}, ops_day: null, ops_used: 0, last_run_at: null, last_ok_at: null, error_kind: null, last_error: null, last_result: null };
const notReady = (message: string) => new LsaError('setup', `The lead engine database update (RUN-ME-2026-11-02-lsa-lead-engine.sql) has not been run: ${message}`);

export async function readState(db: Db, org: string): Promise<SyncState> {
  const { data, error } = await db.from('oj_lsa_sync').select('*').eq('organization_id', org).maybeSingle();
  if (error) throw notReady(error.message);
  return { ...blankState, ...(data ?? {}), backfill: data?.backfill ?? {} };
}
export async function saveState(db: Db, org: string, patch: Partial<SyncState>) {
  const { error } = await db.from('oj_lsa_sync').upsert({ organization_id: org, ...patch, updated_at: new Date().toISOString() }, { onConflict: 'organization_id' });
  if (error) console.error('LSA sync state not saved:', error.message);
}
export const asEngineLead = (row: Row): EngineLead => ({
  ...row, quote_amount: row.quote_amount === null || row.quote_amount === undefined ? null : Number(row.quote_amount), attempts: Number(row.attempts ?? 0),
  contact_log: Array.isArray(row.contact_log) ? row.contact_log : [], thread: Array.isArray(row.thread) ? row.thread : [],
  auto_fields: Array.isArray(row.auto_fields) ? row.auto_fields : [], dispute: Boolean(row.dispute),
} as EngineLead);
export async function readLeads(db: Db, columns = ENGINE_COLUMNS): Promise<(EngineLead & Row)[]> {
  const { data, error } = await db.from('leads').select(columns).limit(10000);
  if (error) throw notReady(error.message);
  return ((data ?? []) as unknown as Row[]).map(asEngineLead);
}
/** Writes a plan one lead at a time, so one refusal never stops the rest. Returns what failed. */
export async function writePlan(db: Db, plan: Pick<IngestPlan, 'inserts' | 'updates'>) {
  const failed: string[] = [];
  for (const row of plan.inserts) {
    const { error } = await db.from('leads').insert(row);
    // Another sync got there first: the unique LSA id kept it to one lead.
    if (error && error.code !== '23505') failed.push(`LSA lead ${row.lsa_lead_id}: ${error.message}`);
  }
  for (const { id, patch } of plan.updates) {
    const { error } = await db.from('leads').update(patch).eq('id', id);
    if (error) failed.push(`lead ${id}: ${error.message}`);
  }
  return failed;
}
/* ------------------------------ Possible duplicates (oj_lsa_review) ------------------------------ */

export type ReviewRow = LeadReview & { id: string; decided_by: string | null; decided_at: string | null; created_at: string };
const reviewColumns = 'id,lsa_lead_id,lead,thread,candidates,reason,status,merge_into,decided_by,decided_at,created_at';

/** Every review of the workspace (done ones too; the pipeline skips those). */
export async function readReviews(db: Db, org: string): Promise<ReviewRow[]> {
  const { data, error } = await db.from('oj_lsa_review').select(reviewColumns).eq('organization_id', org).limit(5000);
  if (error) throw notReady(error.message);
  return ((data ?? []) as Row[]).map(r => ({ ...r, thread: Array.isArray(r.thread) ? r.thread : [], candidates: Array.isArray(r.candidates) ? r.candidates : [] }) as ReviewRow);
}
/**
 * Saves the reviews a plan holds. A stored one is updated only while its status is
 * still the one read, so a Merge or Keep separate tapped meanwhile is never undone.
 * A new one is inserted; if the LSA lead already has a row that is done (its lead was
 * removed since), that row is reopened. Returns what failed.
 */
export async function writeReviews(db: Db, org: string, rows: IngestPlan['reviews']) {
  const failed: string[] = [];
  const now = new Date().toISOString();
  for (const r of rows) {
    const body = { lead: r.lead, thread: r.thread.slice(-1000), candidates: r.candidates, reason: r.reason?.slice(0, 500) ?? null, updated_at: now };
    if (r.id) {
      const { data, error } = await db.from('oj_lsa_review').update({ ...body, status: r.status, merge_into: r.merge_into }).eq('id', r.id).eq('status', r.was ?? 'pending').select('id');
      // Decided meanwhile: report it, so the sync does not move past these messages; the next run reads them again.
      if (error || !(data as unknown[] | null)?.length) failed.push(`review of LSA lead ${r.lsa_lead_id}: ${error?.message ?? 'decided meanwhile, read again next sync'}`);
      continue;
    }
    const { error } = await db.from('oj_lsa_review').insert({ organization_id: org, lsa_lead_id: r.lsa_lead_id, status: 'pending', merge_into: null, ...body });
    if (error?.code === '23505') {
      const reopen = await db.from('oj_lsa_review').update({ ...body, status: 'pending', merge_into: null, decided_by: null, decided_at: null }).eq('organization_id', org).eq('lsa_lead_id', r.lsa_lead_id).eq('status', 'done').select('id');
      if (reopen.error || !(reopen.data as unknown[] | null)?.length) failed.push(`review of LSA lead ${r.lsa_lead_id}: ${reopen.error?.message ?? 'already held by another run'}`);
    } else if (error) failed.push(`review of LSA lead ${r.lsa_lead_id}: ${error.message}`);
  }
  return failed;
}
/** Marks decided reviews done once their plan is written (only if nobody changed them meanwhile). */
export async function resolveReviews(db: Db, org: string, resolved: { lsa_lead_id: string; was: ReviewStatus }[]) {
  const failed: string[] = [];
  for (const r of resolved) {
    const { error } = await db.from('oj_lsa_review').update({ status: 'done', updated_at: new Date().toISOString() }).eq('organization_id', org).eq('lsa_lead_id', r.lsa_lead_id).eq('status', r.was);
    if (error) failed.push(`review of LSA lead ${r.lsa_lead_id}: ${error.message}`);
  }
  return failed;
}
/** Writes a plan's leads and reviews; decided reviews are marked done only when every lead was saved. */
export async function applyIngest(db: Db, org: string, plan: IngestPlan) {
  const failed = await writePlan(db, plan);
  failed.push(...await writeReviews(db, org, plan.reviews));
  if (!failed.length) failed.push(...await resolveReviews(db, org, plan.resolved));
  return failed;
}

async function note(db: Db, description: string, metadata: Row) {
  const { error } = await db.from('activity_log').insert({ operator: 'LSA sync', action: 'lsa_synced', description, metadata });
  if (error) console.error('Activity not recorded:', error.message);
}
const latest = (current: string | null, values: string[]) => [current, ...values].filter((v): v is string => Boolean(v)).sort((a, b) => Date.parse(a) - Date.parse(b)).at(-1) ?? null;

/* ------------------------------ Live sync ------------------------------ */

export type SyncResult = { ok: true; created: number; linked: number; held: number; events: number; dead: number; ops: number; warning: string | null } | { ok: false; kind: ErrorKind; message: string };
let running: Promise<SyncResult> | null = null;

/** One sync. Overlapping calls share the run already in progress. */
export function syncLsa(db: Db, org: string, trigger: 'poll' | 'manual'): Promise<SyncResult> {
  running ??= runSync(db, org, trigger).finally(() => { running = null; });
  return running;
}

async function runSync(db: Db, org: string, trigger: 'poll' | 'manual'): Promise<SyncResult> {
  const now = new Date(), nowIso = now.toISOString(), today = chicagoDay(now);
  let state: SyncState, existing: EngineLead[], reviews: ReviewRow[];
  try { state = await readState(db, org); existing = await readLeads(db); reviews = await readReviews(db, org); }
  catch (e) { const err = asLsaError(e); return { ok: false, kind: err.kind, message: err.message }; }
  // Nothing comes in before the one-time backfill has finished: only the backfill applies the
  // links chosen by hand (lsa-overrides.json), so a lead the poller added first would miss them.
  if (!state.backfill.done) {
    await saveState(db, org, { last_run_at: nowIso, error_kind: 'setup', last_error: LSA.waitingForBackfill });
    return { ok: false, kind: 'setup', message: LSA.waitingForBackfill };
  }
  const used = state.ops_day === today ? state.ops_used : 0;
  let api: LsaApi | null = null, failure: LsaError | null = null, warning: string | null = null;
  let plan: IngestPlan | null = null, leads: LsaLead[] = [], events: ThreadEvent[] = [], failed: string[] = [];

  try {
    const cfg = googleConfig();
    api = new LsaApi(cfg, await accessToken(cfg), n => used + n <= LSA.dailyOpsBudget);
    const since = state.lead_checkpoint ?? new Date(+now - LSA.firstSyncDays * DAY).toISOString();
    leads = (await api.search(leadQuery(`local_services_lead.creation_date_time >= '${chicagoStamp(since)}'`))).map(toLead).filter(nonNull);
    try {
      events = (await api.search(eventQuery(`local_services_lead_conversation.event_date_time >= '${chicagoStamp(state.event_checkpoint ?? since)}'`))).map(toEvent).filter(nonNull);
      // A new message on a lead older than the workspace has: bring in that lead and its whole thread.
      const known = new Set([...existing.flatMap(l => [l.lsa_lead_id, ...(l.lsa?.ids ?? [])]), ...leads.map(l => l.id), ...reviews.filter(r => r.status !== 'done').map(r => r.lsa_lead_id)]);
      const missing = [...new Set(events.map(e => e.lsa))].filter(id => !known.has(id));
      if (missing.length) { leads.push(...await leadsById(api, missing)); events.push(...await eventsForLeads(api, missing)); }
    } catch (e) {
      // Conversations blocked (for example by Explorer access): keep the leads, report the rest.
      const err = asLsaError(e);
      if (err.kind !== 'access') throw err;
      warning = `Conversations could not be read: ${err.message}`;
    }
    plan = planIngest(existing, leads, events, nowIso, { reviews });
    failed = await applyIngest(db, org, plan);
    if (failed.length) failure = new LsaError('api', `${failed.length} lead${failed.length === 1 ? '' : 's'} could not be saved: ${failed.slice(0, 3).join('; ')}`);
  } catch (e) { failure = asLsaError(e); }

  // The follow-up counter keeps working on the leads already here, even when Google cannot be reached.
  let dead = 0;
  try {
    const deadUpdates = autoDeadUpdates(await readLeads(db), now);
    dead = deadUpdates.length - (await writePlan(db, { inserts: [], updates: deadUpdates })).length;
  } catch (e) { failure ??= asLsaError(e); }

  const result = { trigger, created: plan?.created ?? 0, linked: plan?.linked ?? 0, held: plan?.reviews.filter(r => !r.id).length ?? 0, events: plan?.events ?? 0, dead, ops: api?.ops ?? 0 };
  await saveState(db, org, {
    ops_day: today, ops_used: used + (api?.ops ?? 0), last_run_at: nowIso, last_result: result,
    ...(failure ? { error_kind: failure.kind, last_error: failure.message }
      : {
        last_ok_at: nowIso, error_kind: warning ? 'access' : null, last_error: warning,
        lead_checkpoint: latest(state.lead_checkpoint, leads.map(l => l.createdAt)),
        event_checkpoint: warning ? state.event_checkpoint : latest(state.event_checkpoint, events.map(e => e.at)),
      }),
  });
  if (result.created || result.linked || result.held || result.events || dead) await note(db, `LSA sync: ${result.created} new, ${result.linked} linked, ${result.held} held as possible duplicates, ${result.events} messages, ${dead} marked Dead`, result);
  return failure ? { ok: false, kind: failure.kind, message: failure.message } : { ok: true, ...result, warning };
}

/* ------------------------------ One-time backfill ------------------------------ */

const shiftMonth = (month: string, by: number) => { const d = new Date(`${month}-15T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() + by); return d.toISOString().slice(0, 7); };
export type MonthBatch = { leads: LsaLead[]; events: ThreadEvent[] };
/** One calendar month (Chicago) of LSA leads and their conversations. */
export type MonthSource = (month: string) => Promise<MonthBatch>;

/** Reads a month from the Google Ads API (read only). */
export const googleMonths = (api: LsaApi): MonthSource => async month => {
  const where = `local_services_lead.creation_date_time >= '${month}-01 00:00:00' AND local_services_lead.creation_date_time < '${shiftMonth(month, 1)}-01 00:00:00'`;
  const leads = (await api.search(leadQuery(where))).map(toLead).filter(nonNull);
  return { leads, events: leads.length ? await eventsForLeads(api, leads.map(l => l.id)) : [] };
};

/** Everything Google still has, in the backfill's order: this month first, back until three months in a row are empty. Read only. */
export async function fetchHistory(api: LsaApi, now = new Date(), say: (line: string) => void = () => {}) {
  const out = new Map<string, MonthBatch>(), source = googleMonths(api);
  let month = chicagoDay(now).slice(0, 7), empty = 0;
  for (let i = 0; i < LSA.backfillMonths && empty < LSA.backfillEmptyMonths; i++) {
    const batch = await source(month);
    out.set(month, batch);
    empty = batch.leads.length ? 0 : empty + 1;
    say(`${month}: ${batch.leads.length} leads, ${batch.events.length} conversation events (${api.ops} API operations so far).`);
    month = shiftMonth(month, -1);
  }
  return out;
}

/**
 * Imports every lead and conversation from a month source, newest month first, until
 * three months in a row are empty. Saves its place after every month, so after a
 * limit or an error it carries on from there when run again. Then the automatic
 * Dead rule runs over every lead. `onPlan` sees each month's plan (the dry run reports it).
 * `overrides` (from lsa-overrides.json) force the links a person chose; only here, never in the live sync.
 */
export async function runBackfill(db: Db, org: string, source: MonthSource, say: (line: string) => void, opts: { now?: Date; ops?: () => number; onPlan?: (month: string, plan: IngestPlan) => void; overrides?: LinkOverride[] } = {}) {
  const state = await readState(db, org);
  const progress: Backfill = { ...state.backfill };
  if (progress.done) { say(`The backfill already finished (${progress.created ?? 0} added, ${progress.linked ?? 0} linked). Nothing to do.`); return; }
  const now = opts.now ?? new Date(), today = chicagoDay(now);
  const used = state.ops_day === today ? state.ops_used : 0;
  const ops = () => used + (opts.ops?.() ?? 0);
  let month = progress.month ?? today.slice(0, 7);
  if (progress.month) say(`Resuming at ${month}.`);
  try {
    for (let i = 0; i < LSA.backfillMonths && !progress.done; i++) {
      const { leads, events } = await source(month);
      if (leads.length) {
        const plan = planIngest(await readLeads(db), leads, events, now.toISOString(), { backfill: true, reviews: await readReviews(db, org), overrides: opts.overrides });
        opts.onPlan?.(month, plan);
        const failed = await applyIngest(db, org, plan);
        if (failed.length) throw new LsaError('api', `${failed.length} lead${failed.length === 1 ? '' : 's'} could not be saved: ${failed.slice(0, 3).join('; ')}`);
        const held = plan.reviews.filter(r => !r.id).length;
        progress.created = (progress.created ?? 0) + plan.created;
        progress.linked = (progress.linked ?? 0) + plan.linked;
        progress.held = (progress.held ?? 0) + held;
        progress.empty = 0;
        say(`${month}: ${leads.length} leads, ${events.length} conversation events (${plan.created} added, ${plan.linked} linked to existing leads, ${held} held as possible duplicates).`);
      } else {
        progress.empty = (progress.empty ?? 0) + 1;
        progress.done = progress.empty >= LSA.backfillEmptyMonths;
        say(`${month}: no leads.`);
      }
      month = shiftMonth(month, -1);
      progress.month = month;
      await saveState(db, org, { backfill: progress, ops_day: today, ops_used: ops() });
    }
    progress.done = true;
  } catch (e) {
    await saveState(db, org, { backfill: progress, ops_day: today, ops_used: ops() });
    throw e;
  }
  const deadUpdates = autoDeadUpdates(await readLeads(db), now);
  await writePlan(db, { inserts: [], updates: deadUpdates });
  await saveState(db, org, { backfill: progress, ops_day: today, ops_used: ops() });
  await note(db, `LSA backfill finished: ${progress.created ?? 0} added, ${progress.linked ?? 0} linked, ${progress.held ?? 0} held as possible duplicates`, progress);
  say(`Done: ${progress.created ?? 0} leads added, ${progress.linked ?? 0} linked to existing leads, ${progress.held ?? 0} held as possible duplicates, ${deadUpdates.length} more marked Dead by the follow-up rules. ${opts.ops?.() ?? 0} API operations used.`);
}

/** The real backfill: Google, within today's operation budget, with the links chosen by hand (scripts/lsa-overrides.ts reads them). */
export async function backfillLsa(db: Db, org: string, say: (line: string) => void, overrides: LinkOverride[] = []) {
  const state = await readState(db, org);
  const used = state.ops_day === chicagoDay(new Date()) ? state.ops_used : 0;
  const cfg = googleConfig();
  const api = new LsaApi(cfg, await accessToken(cfg), n => used + n <= LSA.dailyOpsBudget);
  await runBackfill(db, org, googleMonths(api), say, { ops: () => api.ops, overrides });
}

/* ------------------------------ The one-time sheet archive ------------------------------ */

/**
 * Writes a sheet-archive plan. Each merge first archives the duplicate (which frees
 * its LSA id), then fills the sheet lead; if that fails the duplicate is put back.
 * Nothing is deleted and no booking is re-pointed. Returns counts and what failed.
 */
export async function applySheetArchive(db: Db, plan: ArchivePlan, now: Date) {
  const failed: string[] = [];
  let merged = 0;
  for (const m of plan.merges) {
    const free = await db.from('leads').update(m.dupPatch).eq('id', m.dup.id);
    if (free.error) { failed.push(`${m.sheet.name ?? m.sheet.id}: ${free.error.message}`); continue; }
    const move = await db.from('leads').update(m.patch).eq('id', m.sheet.id);
    if (move.error) {
      const back = await db.from('leads').update(m.restore).eq('id', m.dup.id);
      failed.push(`${m.sheet.name ?? m.sheet.id}: ${move.error.message}${back.error ? ` (and the duplicate ${m.dup.id} could not be put back: ${back.error.message}; restore it from the backup)` : ''}`);
      continue;
    }
    merged++;
  }
  const notArchived = await writePlan(db, { inserts: [], updates: plan.archive.map(a => ({ id: a.lead.id, patch: a.patch })) });
  failed.push(...notArchived);
  const archived = plan.archive.length - notArchived.length;
  const { error } = await db.from('activity_log').insert({ operator: 'LSA archive', action: 'sheet_leads_archived', description: `Sheet leads archived until ${PIPELINE.reviveOn}: ${archived} archived, ${plan.keep.length} kept active, ${merged} merged with LSA`, metadata: { archived, kept: plan.keep.length, merged, at: now.toISOString() } });
  if (error) console.error('Activity not recorded:', error.message);
  return { merged, archived, failed };
}

/* ------------------------------ The poller ------------------------------ */

export const serviceClient = (key: string): Db => createClient(ojConnection.url, key, { auth: { persistSession: false, autoRefreshToken: false } });
export const lsaOrganization = () => process.env.OJ_EXTERIOR_ORGANIZATION_ID || process.env.OJ_OUTREACH_ORGANIZATION_ID || null;

/**
 * Every 10 minutes from 7am to 10pm Chicago time, inside the workspace server.
 * Runs only where LSA_POLL=on (the Windows host), so two hosts never poll at once.
 * It has no user session, so it uses the server-only service key; nothing a
 * signed-in person can trigger uses that key (Sync now uses their own session).
 */
export function startLsaPoller() {
  const g = globalThis as typeof globalThis & { ojLsaPoller?: boolean };
  if (g.ojLsaPoller) return;
  g.ojLsaPoller = true;
  const org = lsaOrganization(), key = process.env.OJ_SUPABASE_SERVICE_ROLE_KEY;
  if (!org || !key) { console.error('LSA poller is off: set OJ_EXTERIOR_ORGANIZATION_ID and OJ_SUPABASE_SERVICE_ROLE_KEY in .env.local.'); return; }
  const db = serviceClient(key);
  let last = 0;
  const tick = () => {
    const now = new Date(), hour = chicagoHour(now);
    if (hour < LSA.pollFromHour || hour >= LSA.pollUntilHour || +now - last < LSA.pollMinutes * 60_000 - 30_000) return;
    last = +now;
    syncLsa(db, org, 'poll').then(r => { if (!r.ok) console.error(`LSA sync (${r.kind}): ${r.message}`); }, e => console.error('LSA sync stopped:', e instanceof Error ? e.message : e));
  };
  const first = setTimeout(tick, 20_000), every = setInterval(tick, 60_000);
  for (const t of [first, every]) (t as { unref?: () => void }).unref?.();
  console.log(`LSA poller on: every ${LSA.pollMinutes} minutes, ${LSA.pollFromHour}am to ${LSA.pollUntilHour - 12}pm Chicago time.`);
}
