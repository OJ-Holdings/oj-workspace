// The LSA dry run: what the lead engine WOULD do to the real leads, rehearsed on a
// local in-memory copy. It reads Google (read only) and a snapshot file of the leads
// table, and never connects to Supabase: every network request except Google sign-in
// and the Google Ads read-only search is refused, and the service key is unset.
// Nothing is written anywhere except the in-memory copy, which is gone when it ends,
// and the report file named with --out (refused inside the repo: it names customers).
//   npm run lsa -- dry-run [--from <snapshot.json>] [--rehearse] [--overrides <file>]
//                          [--summary] [--out <file>] [--baseline <old report>] [--focus <lsa ids>]
// --summary prints only the summary (focus decisions, Needs Reply, kept active, Dead
// decisions changed since the baseline report, totals); --out saves the full report.
// The snapshot is the result of `select json_agg(l) from public.leads l;` saved as JSON.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { extractLeadFields, serviceFor } from '../src/lib/lead-extract';
import { chicagoDay, explainMatch, isBlank, nameParts, needsReply, planSheetArchive, probeFor, sameFirstName, sameStreet, stageOf, streetParts, suggestionsFor, type ArchivePlan, type EngineLead, type MatchReport, type Probe } from '../src/lib/lead-pipeline';
import { accessToken, applySheetArchive, asEngineLead, fetchHistory, googleConfig, LsaApi, readLeads, runBackfill, type Db } from '../src/lib/lsa-sync';
import { defaultOverrides, readOverrides } from './lsa-overrides';

export const defaultSnapshot = join(homedir(), '.secrets', 'oj-workspace', 'leads-snapshot.json');
/** The report Jacob reviewed on 2026-11-11: the default baseline for "Dead decisions that changed". */
export const defaultBaseline = join(homedir(), '.secrets', 'oj-workspace', 'lsa-dry-run-2026-11-11.txt');
/** The value after a flag (`--from x`), or null. */
export const flagValue = (argv: string[], flag: string) => { const at = argv.indexOf(flag); return at >= 0 && argv[at + 1] && !argv[at + 1].startsWith('--') ? argv[at + 1] : null; };
export const valueFlags = ['--from', '--overrides', '--out', '--baseline', '--focus'];
/** A path inside the repo folder (where a file could be committed). "..x.txt" is inside; "../x.txt" and another drive are not. */
export const insideRepo = (file: string, root = process.cwd()) => { const rel = relative(root, resolve(file)); return !isAbsolute(rel) && rel !== '..' && !rel.startsWith(`..${sep}`); };
const OPS_BUDGET = 600;
export const ORG = '00000000-0000-4000-8000-0000000000aa';
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any>;

/* ------------------------------ Guards ------------------------------ */

/** Refuses every request except Google sign-in and Google Ads searches (both read only). */
export function guardNetwork() {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const allowed = url.protocol === 'https:' && method === 'POST'
      && ((url.hostname === 'oauth2.googleapis.com' && url.pathname === '/token') || (url.hostname === 'googleads.googleapis.com' && /\/googleAds:search$/.test(url.pathname)));
    if (!allowed) throw new Error(`Dry run refused a ${method} request to ${url.host}: only Google sign-in and Google Ads read-only search are allowed.`);
    return real(input, init);
  }) as typeof fetch;
  delete process.env.OJ_SUPABASE_SERVICE_ROLE_KEY;
}

/** The leads snapshot: a JSON array, `[{"json_agg": [...]}]`, `{"json_agg": [...]}` or any of those as a quoted string. */
export function readSnapshot(file: string): Row[] {
  let value: unknown = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, ''));
  for (let i = 0; i < 5; i++) {
    const only = Array.isArray(value) && value.length === 1 ? value[0] : null;
    if (typeof value === 'string') value = JSON.parse(value);
    else if (only && typeof only === 'object' && !Array.isArray(only) && 'json_agg' in only) value = (only as Row).json_agg;
    else if (value && typeof value === 'object' && !Array.isArray(value) && 'json_agg' in value) value = (value as Row).json_agg;
    else break;
  }
  if (!Array.isArray(value) || !value.every(r => r && typeof r === 'object' && typeof (r as Row).id === 'string')) throw new Error(`${file} is not a list of leads (expected the result of select json_agg(l) from public.leads l).`);
  const engine = ['lsa_lead_id', 'lsa', 'stage', 'thread', 'archived_at', 'auto_fields'].filter(c => value.some(r => c in (r as Row)));
  if (engine.length) throw new Error(`The snapshot already has lead engine columns (${engine.join(', ')}), so the live database looks updated already. This dry run is for before the update: stop and check.`);
  return value as Row[];
}

/* ------------------------------ The in-memory copy ------------------------------ */

const name = (s: string) => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw new Error(`Rehearsal: unexpected name "${s}"`); return `"${s}"`; };
/** Column types read from the snapshot's values (the live types are not in a json_agg). */
function columnTypes(rows: Row[]) {
  const seen = new Map<string, Set<string>>();
  for (const r of rows) for (const [k, v] of Object.entries(r)) {
    const t = seen.get(k) ?? new Set<string>(); seen.set(k, t);
    if (v === null) continue;
    t.add(typeof v === 'object' ? 'jsonb' : typeof v === 'number' ? 'numeric' : typeof v === 'boolean' ? 'boolean'
      : /(_at|_on)$/.test(k) && !Number.isNaN(Date.parse(String(v))) ? 'timestamptz' : 'text');
  }
  return [...seen].map(([k, t]) => [k, t.size === 1 ? [...t][0] : 'text'] as const);
}

/** The live setup: roles and auth, workspace.sql, the leads table as it is now, then the staged SQL on top. */
export async function rehearsalCopy(rows: Row[]) {
  const pg = new PGlite();
  const file = (p: string) => readFileSync(resolve(p), 'utf8');
  await pg.exec(`set timezone = 'UTC'; create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`);
  await pg.exec(file('supabase/schemas/workspace.sql'));
  const cols = columnTypes(rows).map(([k, t]) => k === 'id' ? 'id uuid primary key default gen_random_uuid()' : `${name(k)} ${t}`);
  await pg.exec(`create table public.leads (${cols.join(', ')});
    create table public.activity_log (id uuid primary key default gen_random_uuid(), operator text, action text, description text, lead_id uuid, lead_name text, metadata jsonb, created_at timestamptz not null default now());
    insert into public.oj_organizations(id, name) values ('${ORG}', 'Rehearsal');`);
  await pg.query('insert into public.leads select * from json_populate_recordset(null::public.leads, $1::json)', [JSON.stringify(rows)]);
  await pg.exec(file('docs/db-change-proposals/RUN-ME-2026-11-02-lsa-lead-engine.sql'));
  return pg;
}
export const allRows = async (pg: PGlite, table: string) => (await pg.query<{ rows: Row[] }>(`select coalesce(json_agg(t order by t.created_at, t.id), '[]'::json) as rows from public.${name(table)} t`)).rows[0].rows;

type Result = { data: unknown; error: { code?: string; message: string } | null };
const tables = new Set(['leads', 'oj_lsa_sync', 'oj_lsa_review', 'activity_log']);
/** Just enough of the Supabase client for the sync code: from().select/insert/update/upsert, eq, limit, maybeSingle. JSON in and out, like the real API. */
class Query implements PromiseLike<Result> {
  private kind: 'select' | 'insert' | 'update' | 'upsert' = 'select';
  private columns = '*'; private body: Row = {}; private filters: [string, unknown][] = [];
  private returning = false; private single = false; private max: number | null = null; private conflict: string | null = null;
  constructor(private pg: PGlite, private table: string) { if (!tables.has(table)) throw new Error(`Rehearsal: the table ${table} is not part of the rehearsal.`); }
  select(columns = '*') { if (this.kind === 'select') this.columns = columns; else this.returning = true; return this; }
  insert(row: Row) { this.kind = 'insert'; this.body = row; return this; }
  update(patch: Row) { this.kind = 'update'; this.body = patch; return this; }
  upsert(row: Row, opts?: { onConflict?: string }) { this.kind = 'upsert'; this.body = row; this.conflict = opts?.onConflict ?? null; return this; }
  eq(column: string, value: unknown) { this.filters.push([column, value]); return this; }
  order() { return this; }
  limit(n: number) { this.max = n; return this; }
  maybeSingle() { this.single = true; return this; }
  then<A = Result, B = never>(ok?: ((r: Result) => A | PromiseLike<A>) | null, fail?: ((e: unknown) => B | PromiseLike<B>) | null) { return this.run().then(ok, fail); }
  private async run(): Promise<Result> {
    try {
      const t = `public.${name(this.table)}`, params: unknown[] = [];
      const where = (alias: string) => this.filters.length ? ` where ${this.filters.map(([c, v]) => v === null ? `${alias}${name(c)} is null` : `${alias}${name(c)}::text = $${params.push(String(v))}`).join(' and ')}` : '';
      let sql: string;
      if (this.kind === 'select') {
        const cols = this.columns === '*' ? '*' : this.columns.split(',').map(c => name(c.trim())).join(', ');
        sql = `select coalesce(json_agg(x), '[]'::json) as rows from (select ${cols} from ${t}${where('')}${this.max ? ` limit ${Math.floor(this.max)}` : ''}) x`;
      } else {
        const keys = Object.keys(this.body).map(name);
        if (!keys.length) throw new Error('Rehearsal: nothing to write.');
        const filter = this.kind === 'update' ? where('tgt.') : '';
        const src = `json_populate_record(null::${t}, $${params.push(JSON.stringify(this.body))}::json)`;
        if (this.kind === 'update') sql = `with r as (update ${t} as tgt set ${keys.map(k => `${k} = src.${k}`).join(', ')} from ${src} as src${filter} returning tgt.*) select coalesce(json_agg(r), '[]'::json) as rows from r`;
        else {
          const conflict = this.kind === 'upsert' && this.conflict ? ` on conflict (${this.conflict.split(',').map(c => name(c.trim())).join(', ')}) do update set ${keys.map(k => `${k} = excluded.${k}`).join(', ')}` : '';
          sql = `with r as (insert into ${t} (${keys.join(', ')}) select ${keys.join(', ')} from ${src}${conflict} returning *) select coalesce(json_agg(r), '[]'::json) as rows from r`;
        }
      }
      const rows = (await this.pg.query<{ rows: Row[] }>(sql, params)).rows[0]?.rows ?? [];
      if (this.kind !== 'select' && !this.returning) return { data: null, error: null };
      return { data: this.single ? rows[0] ?? null : rows, error: null };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      return { data: null, error: { code: err.code, message: err.message ?? String(e) } };
    }
  }
}
export const supabaseLike = (pg: PGlite) => ({ from: (table: string) => new Query(pg, table) }) as unknown as Db;

/* ------------------------------ Report helpers ------------------------------ */

const clip = (v: unknown, n = 90) => { const s = typeof v === 'string' ? v : JSON.stringify(v); const t = (s ?? 'null').replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const shown = (v: unknown) => v === null || v === undefined ? 'empty' : Array.isArray(v) ? `[${v.length} item${v.length === 1 ? '' : 's'}]` : typeof v === 'object' ? clip(v, 60) : `"${clip(v)}"`;
const short = (id: string) => id.slice(0, 8);
const idsOf = (l: Row) => [...new Set([l.lsa_lead_id, ...(l.lsa?.ids ?? [])].filter(Boolean))] as string[];
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const decision = (m: MatchReport | undefined) => !m ? 'NOT PLANNED (Google returned it but no month batch held it)'
  : m.kind === 'link' ? `LINK to ${m.targets.map(t => `${t.name ?? 'no name'} (${short(t.id)})`).join(', ')} -- ${m.why}`
  : m.kind === 'override' ? `LINK (override) to ${m.targets.map(t => `${t.name ?? 'no name'} (${short(t.id)})`).join(', ')} -- ${m.why}`
  : m.kind === 'review' ? `POSSIBLE DUPLICATE of ${m.targets.map(t => `${t.name ?? 'no name'} (${short(t.id)})`).join(', ')} -- ${m.why}. Held for Merge / Keep separate: nothing added or linked.`
  : m.kind === 'new' ? `CREATE NEW -- ${m.why}` : `${m.kind.toUpperCase()} -- ${m.why}`;

function describeArchive(plan: ArchivePlan, say: (line: string) => void) {
  say(`Sheet leads: ${plan.total} (${plan.alreadyArchived} already archived, ${plan.alreadyLinked} linked to LSA by the backfill)`);
  say(`To archive until the revive date: ${plan.archive.length} (${plan.dead} closed/ghosted become Dead). Kept active: ${plan.keep.length}.`);
  for (const k of plan.keep) say(`  kept active: ${k.lead.name ?? 'Unknown'} (${short(k.lead.id)}), status ${k.lead.status ?? 'none'}: ${k.why}`);
  say(`Duplicates the sync added, merged into a sheet lead (the duplicate is archived, not deleted): ${plan.merges.length}`);
  for (const m of plan.merges) {
    say(`  ${m.dup.name ?? 'Unknown'} (LSA #${m.dup.lsa_lead_id}) -> ${m.sheet.name ?? 'Unknown'} (${short(m.sheet.id)}): ${m.why}`);
    for (const c of m.conflicts) say(`    differs, kept the sheet value: ${c.field} ${shown(c.kept)} (LSA had ${shown(c.lsa)})`);
  }
  say(`Possible duplicates NOT merged (listed only): ${plan.possible.length}`);
  for (const p of plan.possible) say(`  ${p.lead.name ?? 'Unknown'} (LSA #${p.lead.lsa_lead_id}) might be ${p.candidates.map(c => `${c.name ?? 'no name'} (${short(c.id)})`).join(' or ')}: ${p.why}`);
}

/** Each LSA lead's Dead decision in an earlier report: id -> the Dead reason, or null when it was not Dead. Sheet leads kept active, by short id. */
export function readBaseline(text: string) {
  const lsa = new Map<string, { name: string; dead: string | null; after: string }>();
  let current: string | null = null;
  for (const line of text.split(/\r?\n/)) {
    const head = /^\[\d+\] LSA #(\d+) /.exec(line);
    if (head) { current = head[1]; continue; }
    const after = /^\s+After: (?:existing|new) lead "([^"]*)" \(([0-9a-f]{8})\), stage (\w+)(.*)$/.exec(line);
    if (after && current) { lsa.set(current, { name: after[1], dead: after[3] === 'dead' ? /Dead: ([^;]*?)(?:, NEEDS REPLY)?(?:;|$)/.exec(after[4])?.[1] ?? 'Dead' : null, after: line.trim() }); current = null; }
  }
  const kept = new Set([...text.matchAll(/^\s+kept active: .*\(([0-9a-f]{8})\), status /gm)].map(m => m[1]));
  return { lsa, kept };
}

/* ------------------------------ The dry run ------------------------------ */

export async function dryRun(argv: string[]) {
  guardNetwork();
  const file = flagValue(argv, '--from') ?? defaultSnapshot, rehearse = argv.includes('--rehearse'), summaryOnly = argv.includes('--summary');
  const out = flagValue(argv, '--out'), baselineFile = flagValue(argv, '--baseline') ?? defaultBaseline;
  if (argv.includes('--out') && !out) throw new Error('--out needs a file path (outside the repo).');
  if (out && insideRepo(out)) throw new Error('--out must be outside the repo: the report names customers and must never be committed.');
  const overrides = readOverrides(flagValue(argv, '--overrides') ?? defaultOverrides);
  const focus = [...new Set([...overrides.map(o => o.lsa_lead_id), ...(flagValue(argv, '--focus') ?? '').split(',').map(s => s.trim()).filter(s => /^\d+$/.test(s))])];
  const now = new Date(), full: string[] = [], summary: string[] = [];
  const say = (line = '') => full.push(line), sum = (line = '') => summary.push(line);
  const snapshot = readSnapshot(file);
  say(`LSA DRY RUN ${now.toISOString()} (Chicago ${chicagoDay(now)}). Read only: Google is read, Supabase is never contacted, nothing is saved.`);
  say(`Snapshot: ${snapshot.length} leads from ${file}`);
  say(`Overrides: ${overrides.length ? overrides.map(o => `LSA #${o.lsa_lead_id} -> ${short(o.lead_id)}`).join(', ') : 'none'}`);

  const cfg = googleConfig();
  const api = new LsaApi(cfg, await accessToken(cfg), n => n <= OPS_BUDGET);
  say(`Reading every LSA lead Google still has (read only, at most ${OPS_BUDGET} API operations):`);
  const history = await fetchHistory(api, now, line => say(`  ${line}`));
  const lsaLeads = [...history.values()].flatMap(b => b.leads).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
  const lsaEvents = [...history.values()].flatMap(b => b.events);
  say(`Google: ${lsaLeads.length} LSA leads and ${lsaEvents.length} conversation events over ${history.size} months, ${api.ops} API operations.`);

  const pg = await rehearsalCopy(snapshot);
  const db = supabaseLike(pg);
  const before = new Map((await allRows(pg, 'leads')).map(r => [r.id as string, r]));
  say('');
  say('REHEARSAL on the in-memory copy (the real backfill, automatic Dead rule and sheet archive code):');
  const matches = new Map<string, MatchReport>();
  await runBackfill(db, ORG, async month => history.get(month) ?? { leads: [], events: [] }, line => say(`  ${line}`), { now, overrides, onPlan: (_m, plan) => { for (const m of plan.matches) matches.set(m.lsaId, m); } });
  const archive = planSheetArchive(await readLeads(db, '*'), now);
  const applied = await applySheetArchive(db, archive, now);
  if (applied.failed.length) say(`  Sheet archive failures: ${applied.failed.join('; ')}`);
  const after = await allRows(pg, 'leads');
  const reviews = await allRows(pg, 'oj_lsa_review');
  const holder = new Map<string, Row>();
  for (const r of after) for (const id of idsOf(r)) holder.set(id, r);

  say('');
  say(`EVERY LSA LEAD (${lsaLeads.length}), oldest first:`);
  lsaLeads.forEach((lead, i) => {
    const thread = lsaEvents.filter(e => e.lsa === lead.id).sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    const customer = thread.filter(e => e.who === 'customer' && e.text).map(e => e.text!);
    const found = extractLeadFields({ messages: customer });
    const svc = serviceFor({ serviceId: lead.service, category: lead.category, type: lead.type, messages: customer });
    const m = matches.get(lead.id), row = holder.get(lead.id), review = reviews.find(r => r.lsa_lead_id === lead.id);
    say('');
    say(`[${i + 1}] LSA #${lead.id} | ${chicagoDay(lead.createdAt)} | ${(lead.type ?? 'unknown').toLowerCase().replace(/_/g, ' ')} | ${thread.length} conversation event${thread.length === 1 ? '' : 's'} (${customer.length} customer message${customer.length === 1 ? '' : 's'})`);
    say(`    Name: ${lead.name ? `"${lead.name}" (Google's name)` : found.fields.name ? `"${found.fields.name}" from the line: "${found.from.name}"` : 'none (Google gave none and no customer line names one)'}`);
    for (const f of found.flagged) say(`    Held back, not saved: "${f.value}" (${f.why}) in the line: "${f.line}"`);
    say(`    Address: ${found.fields.address ? `"${found.fields.address}" from the line: "${found.from.address}"` : 'none in the customer\'s messages'}`);
    if (found.fields.phone) say(`    Phone in a message: ${found.fields.phone} from the line: "${found.from.phone}"`);
    say(`    Service: ${svc.service} (from ${svc.from.replace('_', ' ')}${lead.service ? `: ${lead.service}` : ''})`);
    say(`    Decision: ${decision(m)}`);
    const merged = archive.merges.find(x => x.dup.lsa_lead_id === lead.id);
    if (merged) say(`    Sheet archive: merged into ${merged.sheet.name ?? 'Unknown'} (${short(merged.sheet.id)}): ${merged.why}${merged.conflicts.length ? `; kept the sheet's ${merged.conflicts.map(c => c.field).join(', ')}` : ''}`);
    if (review) say(`    Review row: status ${review.status}, ${review.candidates.length} candidate${review.candidates.length === 1 ? '' : 's'}, ${review.thread.length} events kept with it`);
    if (row) {
      const lead_ = asEngineLead(row);
      const was = before.get(row.id);
      const filled = was ? Object.keys(was).filter(k => k !== 'updated_at' && !same(was[k], row[k]) && isBlank(k, was[k]) && !['lsa_lead_id', 'lsa', 'stage', 'stage_at', 'thread', 'contact_log', 'attempts', 'cycle_at', 'last_customer_at', 'last_ours_at', 'auto_fields', 'proxy_phone', 'archived_at', 'revive_on', 'original_status', 'dead_reason', 'dispute', 'quoted_at', 'scheduled_on', 'email'].includes(k)) : [];
      say(`    After: ${was ? 'existing' : 'new'} lead "${row.name ?? 'Unknown'}" (${short(row.id)}), stage ${row.stage ?? 'none'}${row.archived_at ? `, archived${row.revive_on ? ` until ${row.revive_on}` : ''}` : ''}${row.dead_reason ? `, ${row.stage === 'dead' ? 'Dead' : 'Why'}: ${row.dead_reason}` : ''}${needsReply(lead_, now) ? ', NEEDS REPLY' : ''}${filled.length ? `; fills empty ${filled.join(', ')}` : ''}${was && !same(was.email, row.email) && row.email ? '; adds email' : ''}`);
      const tips = suggestionsFor(lead_, now);
      for (const s of tips) say(`    Suggests: ${s.kind === 'quoted' ? `Mark quoted $${s.amount}? (our line: "${s.line}")` : `Mark scheduled for ${s.day}? (customer said: "${s.line}")`}`);
      if (!tips.length) say('    Suggests: nothing');
    }
  });

  say('');
  say('SHEET ARCHIVE (rehearsed after the backfill):');
  describeArchive(archive, line => say(`  ${line}`));

  // Before and after, lead by lead. Columns the snapshot had are the existing data: a change is
  // either filling something empty (or a placeholder like NP_..., na, Unknown) or an OVERWRITE.
  const original = new Set(Object.keys(snapshot[0] ?? {}));
  const afterById = new Map(after.map(r => [r.id as string, r]));
  const inserted = after.filter(r => !before.has(r.id)), deleted = [...before.keys()].filter(id => !afterById.has(id));
  const fills: string[] = [], overwrites: string[] = [], changes: string[] = [];
  let updated = 0;
  for (const [id, was] of before) {
    const now_ = afterById.get(id);
    if (!now_) continue;
    const changed = Object.keys(now_).filter(k => k !== 'updated_at' && !same(was[k], now_[k]));
    if (changed.length) updated++;
    for (const k of changed) {
      const line = `${was.name ?? 'Unknown'} (${short(id)}) ${k}: ${shown(was[k])} -> ${shown(now_[k])}`;
      if (rehearse) changes.push(line);
      if (!original.has(k)) continue;
      (isBlank(k, was[k]) ? fills : overwrites).push(line);
    }
  }
  /* ---------------- The summary: what Jacob asked to see ---------------- */
  const afterLeads = after.map(asEngineLead), snapshotLeads = snapshot.map(asEngineLead);
  const label = (l: { name: string | null; id: string }) => `${l.name ?? 'Unknown'} (${short(l.id)})`;

  sum(`LSA DRY RUN SUMMARY ${now.toISOString()} (Chicago ${chicagoDay(now)}): ${lsaLeads.length} LSA leads, ${snapshot.length} snapshot leads. Read only; nothing saved.`);
  sum('');
  sum(`DECISIONS FOR THE LEADS ASKED ABOUT (${focus.length}):`);
  for (const id of focus) {
    const lead = lsaLeads.find(l => l.id === id);
    if (!lead) { sum(`  LSA #${id}: Google has no such lead.`); continue; }
    const probe: Probe = probeFor(lead, lsaEvents), row = holder.get(id);
    sum(`  LSA #${id} | ${chicagoDay(lead.createdAt)} | ${probe.name ?? 'no name'} | address${(probe.addresses ?? []).length === 1 ? '' : 'es'}: ${(probe.addresses ?? []).join(' / ') || 'none'}${probe.email ? ` | email ${probe.email}` : ''}`);
    sum(`    Decision: ${decision(matches.get(id))}`);
    if (row) sum(`    After: lead ${label(row as EngineLead)}, stage ${row.stage ?? 'none'}${row.archived_at ? `, archived until ${row.revive_on ?? 'no date'}` : ''}${needsReply(asEngineLead(row), now) ? ', NEEDS REPLY' : ''}`);
    // Every snapshot lead with the same first name, a street in common, or any evidence: why it is or is not this customer.
    const pn = nameParts(probe.name), streets = (probe.addresses ?? []).map(streetParts).filter(Boolean);
    const near = snapshotLeads.map(l => ({ l, e: explainMatch(probe, l) })).filter(({ l, e }) => e.strong.length || e.weak.length
      || (pn && nameParts(l.name) && sameFirstName(pn.first, nameParts(l.name)!.first)) || (streetParts(l.address) && streets.some(s => sameStreet(s!, streetParts(l.address)!))));
    if (!near.length) sum('    No snapshot lead shares its first name, street, phone or email.');
    for (const { l, e } of near) sum(`    vs ${label(l)}, ${l.address ?? 'no address'}, status ${l.status ?? 'none'}: ${[...e.strong.map(s => `strong: ${s}`), ...e.weak.map(s => `weak: ${s}`), ...e.conflict.map(s => `conflict: ${s}`)].join('; ') || 'same first name only, nothing else in common'}`);
  }

  const lastCustomer = (l: EngineLead) => l.thread.filter(e => e.who === 'customer').sort((a, b) => Date.parse(a.at) - Date.parse(b.at)).at(-1);
  const waiting = afterLeads.filter(l => needsReply(l, now)).sort((a, b) => Date.parse(a.last_customer_at!) - Date.parse(b.last_customer_at!));
  sum('');
  sum(`NEEDS REPLY (${waiting.length}): the customer's last message or missed call is within 14 days and unanswered`);
  for (const l of waiting) sum(`  ${label(l)} | ${stageOf(l)} | customer ${lastCustomer(l)?.channel === 'PHONE_CALL' ? 'called' : 'wrote'} ${chicagoDay(l.last_customer_at!)}${l.lsa_lead_id ? ` | LSA #${l.lsa_lead_id}` : ''}`);

  const keepWhy = new Map(archive.keep.map(k => [k.lead.id, k.why]));
  const active = afterLeads.filter(l => !l.archived_at).sort((a, b) => Number(a.lsa?.origin === 'sync') - Number(b.lsa?.origin === 'sync') || (a.name ?? '').localeCompare(b.name ?? ''));
  sum('');
  sum(`KEPT ACTIVE (${active.length} of ${afterLeads.length} leads; every other lead is archived, nothing deleted):`);
  for (const l of active) {
    const last = [l.last_customer_at, l.last_ours_at, l.created_at].filter(Boolean).sort().at(-1)!;
    sum(`  ${label(l)} | ${keepWhy.get(l.id) ? `sheet lead: ${keepWhy.get(l.id)}` : `LSA lead, ${stageOf(l)}${needsReply(l, now) ? ', needs reply' : ''}, last activity ${chicagoDay(last)}`}`);
  }

  sum('');
  if (!existsSync(baselineFile)) sum(`DEAD DECISIONS THAT CHANGED: no baseline report at ${baselineFile}, nothing to compare.`);
  else {
    const base = readBaseline(readFileSync(baselineFile, 'utf8')), changed: string[] = [], reported = new Set<string>();
    const nowSays = (row: Row | undefined) => !row ? 'held as a possible duplicate (no lead yet)' : `stage ${row.stage ?? 'none'}${row.archived_at ? `, archived until ${row.revive_on ?? 'no date'}` : ''}${row.stage !== 'dead' && row.dead_reason ? ` (${row.dead_reason})` : ''}`;
    for (const lead of lsaLeads) {
      const was = base.lsa.get(lead.id), row = holder.get(lead.id), dead = row?.stage === 'dead' ? (row.dead_reason as string | null) ?? 'Dead' : null;
      const who = `LSA #${lead.id} ${row ? label(row as EngineLead) : `"${was?.name ?? lead.name ?? 'Unknown'}"`}`;
      const line = !was ? (dead ? `${who}: not in the baseline -> now Dead: ${dead}` : null)
        : Boolean(was.dead) !== Boolean(dead) ? `${who}: ${was.dead ? `was Dead (${was.dead})` : 'was not Dead'} -> ${dead ? `now Dead (${dead})` : `now not Dead: ${nowSays(row)}`}`
        : was.dead && dead && was.dead !== dead ? `${who}: still Dead, reason was "${was.dead}", now "${dead}"` : null;
      if (line) { changed.push(line); if (row) reported.add(row.id as string); }
    }
    // Sheet leads: Ghosted (closed) ones become Dead when archived. The baseline listed only those kept active. Each lead once.
    const closed = (s: string | null) => ['closed', 'ghosted'].includes((s ?? '').toLowerCase());
    for (const a of archive.archive) if (a.patch.stage === 'dead' && base.kept.has(short(a.lead.id)) && !reported.has(a.lead.id)) changed.push(`${label(a.lead)}, sheet lead, status ${a.lead.status}: was kept active -> now archived as Dead (closed in the sheet)`);
    for (const k of archive.keep) if (closed(k.lead.status) && !base.kept.has(short(k.lead.id)) && !reported.has(k.lead.id)) changed.push(`${label(k.lead)}, sheet lead, status ${k.lead.status}: was archived as Dead -> now kept active (${k.why})`);
    sum(`DEAD DECISIONS THAT CHANGED vs ${baselineFile} (${changed.length}):`);
    for (const c of changed) sum(`  ${c}`);
    if (!changed.length) sum('  none');
  }

  const both = (line = '') => { say(line); sum(line); };
  const kinds = [...matches.values()].reduce((n, m) => ({ ...n, [m.kind]: (n[m.kind] ?? 0) + 1 }), {} as Record<string, number>);
  both('');
  both('BEFORE AND AFTER (the in-memory copy, updated_at ignored):');
  both(`  Decisions: ${Object.entries(kinds).map(([k, n]) => `${n} ${k}`).join(', ')}.`);
  both(`  Leads before: ${before.size}. After: ${after.length}. Active after: ${active.length}. Needs Reply: ${waiting.length}.`);
  both(`  Inserted: ${inserted.length} (new LSA leads). Updated: ${updated} existing leads. Deleted: ${deleted.length}.`);
  both(`  Possible duplicates held for review: ${reviews.filter(r => r.status === 'pending').length} (stored in oj_lsa_review; no lead added or linked for them).`);
  both(`  Existing values filled where they were empty or a placeholder: ${fills.length}`);
  for (const f of fills) say(`    ${f}`);
  both(`  Existing values OVERWRITTEN: ${overwrites.length}`);
  for (const o of overwrites) both(`    ${o}`);
  if (rehearse) { say(`  Every field change (${changes.length}):`); for (const c of changes) say(`    ${c}`); }
  const pass = !deleted.length && !overwrites.length;
  both(`  RESULT: ${pass ? 'PASS' : 'FAIL'} -- ${deleted.length} deletes, ${overwrites.length} overwrites.`);
  both('');
  both('Nothing was written to Supabase, the Google Sheet or Google. The in-memory copy is discarded now.');
  await pg.close();
  const report = [...full, '', '================ SUMMARY ================', ...summary].join('\n');
  if (out) writeFileSync(resolve(out), `${report}\n`);
  console.log(summaryOnly ? summary.join('\n') : report);
  if (out) console.log(`\nFull report saved to ${resolve(out)}`);
  if (!pass) process.exitCode = 1;
}

export { describeArchive };
