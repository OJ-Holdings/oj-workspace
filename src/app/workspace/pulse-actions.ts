'use server';

import { requireMember } from '@/lib/supabase';
import { ENGINE, XP, dollars, mergeBursts, money, plainLog, workXp, type PulseEvent, type PulseKind } from '@/lib/pulse';
import { TRUCK_LABEL } from '@/lib/truck-fund';
import { LSA_LEADS, LSA_SPEND } from '@/lib/lsa-stats';
import { DEAL_PREFIX, DROPPED, RIG_PREFIX } from '@/lib/rig-plan';

export type PulseLoad = { ok: true; events: PulseEvent[]; people: string[]; now: string; incomplete: boolean } | { ok: false };

const WINDOW_DAYS = 30;
const LIMIT = 400;
type Row = Record<string, unknown>;
const s = (v: unknown) => (typeof v === 'string' ? v : v === null || v === undefined ? '' : String(v));
const n = (v: unknown) => (typeof v === 'number' ? v : Number(v));
const q = (t: string) => `"${t.length > 60 ? `${t.slice(0, 57)}...` : t}"`;
const VENTURES = new Set(['exterior', 'solutions', 'essentials']);
const ven = (v: unknown) => (VENTURES.has(s(v)) ? (s(v) as PulseEvent['venture']) : null);
const BUSINESS: Record<string, string> = { general: 'general work', exterior: 'Exterior Care', solutions: 'OJ Solutions', essentials: 'OJ Essentials' };

/**
 * Everything done in the last 30 days, read through the caller's own session (row-level security decides what comes back), as plain sentences.
 * A source that is not set up yet, or fails, is skipped rather than failing the whole feed.
 */
export async function loadPulse(org: string, base: string): Promise<PulseLoad> {
  let ctx;
  try { ctx = await requireMember(org, true); } catch { return { ok: false }; }
  // This feed combines financial and legacy Exterior sources with broader
  // visibility than ordinary members have in the individual screens.
  if (ctx.member.role !== 'owner' || base !== '/workspace') return { ok: false };
  const { client } = ctx;
  const nowIso = new Date().toISOString();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000).toISOString();
  const sinceDay = since.slice(0, 10);
  // Legacy activity_log and leads have no organization key; leave them out
  // until their tenant mapping can be verified, and disclose the gap.
  let incomplete = true;
  const read = async (work: PromiseLike<{ data: unknown; error: unknown }>): Promise<Row[]> => {
    try { const r = await work; if (r.error || !Array.isArray(r.data)) { incomplete = true; return []; } if (r.data.length >= LIMIT) incomplete = true; return r.data as Row[]; } catch { incomplete = true; return []; }
  };

  const [members, cards, activity, log, sessions, invoices, payments, journal, expenses, photos, proposals, customers, metrics, docs, events, dms, prospects, emails, finance, leads, sharedLeads, consultations] = await Promise.all([
    read(client.from('oj_memberships').select('user_id,display_name').eq('organization_id', org)),
    read(client.from('oj_cards').select('id,title,business,created_by,created_at,completed_by,completed_at').eq('organization_id', org).or(`created_at.gte.${since},completed_at.gte.${since}`).order('created_at', { ascending: false }).limit(LIMIT)),
    read(client.from('oj_activity').select('id,card_id,actor_id,action,created_at').eq('organization_id', org).in('action', ['comment_added', 'card_updated']).gte('created_at', since).order('created_at', { ascending: false }).limit(LIMIT)),
    Promise.resolve([] as Row[]),
    read(client.from('oj_work_sessions').select('id,user_id,business,started_at,ended_at').eq('organization_id', org).gte('started_at', since).limit(LIMIT)),
    read(client.from('oj_invoices').select('id,number,customer_name,total_cents,status,division,created_by,created_at').eq('organization_id', org).gte('created_at', since).order('created_at', { ascending: false }).limit(LIMIT)),
    read(client.from('oj_payments').select('id,invoice_id,amount_cents,method,created_by,created_at').eq('organization_id', org).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_journal_entries').select('id,memo,source_type,created_by,created_at').eq('organization_id', org).in('source_type', ['bank', 'manual', 'expense', 'opening']).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_job_expenses').select('id,lead_id,kind,amount,created_by,created_at').eq('organization_id', org).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_job_photos').select('id,lead_id,kind,created_by,created_at').eq('organization_id', org).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_proposals').select('id,number,customer_name,total_cents,status,division,decided_on,created_by,created_at').eq('organization_id', org).or(`created_at.gte.${since},decided_on.gte.${sinceDay}`).order('created_at', { ascending: false }).limit(LIMIT)),
    read(client.from('oj_customers').select('id,name,created_by,created_at').eq('organization_id', org).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_metric_entries').select('id,venture,label,value,unit,created_by,created_at').eq('organization_id', org).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_documents').select('id,venture,name,uploaded_by,created_at').eq('organization_id', org).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_events').select('id,venture,title,source,created_by,created_at').eq('organization_id', org).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_outreach_dm_log').select('id,actor_id,channel,undone_at,created_at').eq('organization_id', org).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_outreach_activity').select('id,actor_id,new_status,created_at').eq('organization_id', org).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_email_events').select('id,kind,event_at,created_at').eq('organization_id', org).in('kind', ['sent', 'reply', 'bounce', 'stop']).gte('created_at', since).limit(LIMIT)),
    read(client.from('oj_finance_entries').select('id,venture,kind,amount,category,created_by,created_at').eq('organization_id', org).gte('created_at', since).limit(LIMIT)),
    Promise.resolve([] as Row[]),
    read(client.from('oj_leads').select('id,venture,name,source,created_by,created_at').eq('organization_id', org).gte('created_at', since).order('created_at', { ascending: false }).limit(LIMIT)),
    read(client.from('oj_solutions_consultations').select('id,name,status,created_at').eq('organization_id', org).gte('created_at', since).order('created_at', { ascending: false }).limit(LIMIT)),
  ]);

  const names = new Map(members.map(m => [s(m.user_id), s(m.display_name)]));
  const people = [...new Set(members.map(m => s(m.display_name)).filter(Boolean))];
  const who = (id: unknown) => names.get(s(id)) || 'Someone';
  const byFirst = (op: unknown) => people.find(p => p.split(' ')[0].toLowerCase() === s(op).toLowerCase()) ?? (s(op) || 'Someone');
  const leadName = new Map(leads.map(l => [s(l.id), s(l.name) || 'a customer']));
  const cardById = new Map(cards.map(c => [s(c.id), c]));
  const invoiceNo = new Map(invoices.map(i => [s(i.id), s(i.number)]));
  const out: PulseEvent[] = [];
  const add = (e: Omit<PulseEvent, 'xp'> & { xp?: number }) => { if (e.at >= since) out.push({ ...e, xp: e.xp ?? XP[e.kind] }); };
  const task = (id: unknown) => `${base}/tasks?task=${encodeURIComponent(s(id))}`;
  const lead = (id: unknown) => `${base}/b/exterior/customer?lead=${encodeURIComponent(s(id))}`;

  for (const c of cards) {
    if (s(c.created_at) >= since) add({ id: `card-new-${s(c.id)}`, at: s(c.created_at), who: who(c.created_by), kind: 'task-new', text: `added a task: ${q(s(c.title))}`, venture: ven(c.business), href: task(c.id) });
    if (c.completed_at && s(c.completed_at) >= since) add({ id: `card-done-${s(c.id)}`, at: s(c.completed_at), who: who(c.completed_by), kind: 'task-done', text: `finished ${q(s(c.title))}`, venture: ven(c.business), href: task(c.id) });
  }
  for (const a of activity) {
    const card = cardById.get(s(a.card_id));
    const title = card ? q(s(card.title)) : 'a task';
    if (s(a.action) === 'comment_added') add({ id: `act-${s(a.id)}`, at: s(a.created_at), who: who(a.actor_id), kind: 'comment', text: `commented on ${title}`, venture: card ? ven(card.business) : null, href: task(a.card_id) });
    else add({ id: `act-${s(a.id)}`, at: s(a.created_at), who: who(a.actor_id), kind: 'task-edit', text: `updated ${title}`, venture: card ? ven(card.business) : null, href: task(a.card_id), group: `task-${s(a.card_id)}`, many: `updated ${title} ({n} changes)` });
  }
  for (const l of log) {
    const p = plainLog(s(l.action), s(l.description), l.lead_name ? s(l.lead_name) : null);
    const name = s(l.lead_name) || 'a customer';
    add({ id: `log-${s(l.id)}`, at: s(l.created_at), who: byFirst(l.operator), kind: p.kind, text: p.text, venture: 'exterior', href: l.lead_id ? lead(l.lead_id) : undefined,
      ...(p.kind === 'lead-edit' && l.lead_id ? { group: `lead-${s(l.lead_id)}`, many: `updated ${name} ({n} changes)` } : {}) });
  }
  for (const w of sessions) {
    const place = BUSINESS[s(w.business)] ?? 'work';
    if (!w.ended_at) { add({ id: `work-${s(w.id)}`, at: s(w.started_at), who: who(w.user_id), kind: 'work', text: `is on the clock for ${place} right now`, venture: ven(w.business) }); continue; }
    const mins = Math.max(0, Math.round((Date.parse(s(w.ended_at)) - Date.parse(s(w.started_at))) / 60_000));
    if (mins < 1) continue;
    const dur = mins >= 60 ? `${Math.floor(mins / 60)}h${mins % 60 ? ` ${mins % 60}m` : ''}` : `${mins}m`;
    add({ id: `work-${s(w.id)}`, at: s(w.ended_at), who: who(w.user_id), kind: 'work', text: `worked ${dur} on ${place}`, venture: ven(w.business), xp: workXp(mins) });
  }
  for (const i of invoices) {
    if (s(i.created_at) < since || s(i.status) === 'void') continue;
    add({ id: `inv-${s(i.id)}`, at: s(i.created_at), who: who(i.created_by), kind: 'invoice', text: `created invoice ${s(i.number)} for ${s(i.customer_name)}, ${money(n(i.total_cents))}`, venture: ven(i.division), href: `${base}/invoices` });
  }
  for (const p of payments) add({ id: `pay-${s(p.id)}`, at: s(p.created_at), who: who(p.created_by), kind: 'payment', text: `recorded a payment of ${money(n(p.amount_cents))} on invoice ${invoiceNo.get(s(p.invoice_id)) ?? ''}`.trim(), venture: null, href: `${base}/invoices` });
  for (const j of journal) {
    if (s(j.source_type) === 'bank') add({ id: `jr-${s(j.id)}`, at: s(j.created_at), who: who(j.created_by), kind: 'bank', text: `put a bank transaction in the books: ${s(j.memo) || 'no description'}`, venture: null, href: `${base}/books`, group: 'bank', many: 'put {n} bank transactions in the books' });
    else add({ id: `jr-${s(j.id)}`, at: s(j.created_at), who: who(j.created_by), kind: 'bank', text: `posted a journal entry: ${s(j.memo) || 'no memo'}`, venture: null });
  }
  for (const e of expenses) add({ id: `exp-${s(e.id)}`, at: s(e.created_at), who: who(e.created_by), kind: 'expense', text: `logged ${dollars(n(e.amount))} of ${s(e.kind).toLowerCase() || 'costs'} on ${leadName.get(s(e.lead_id)) ?? 'a job'}`, venture: 'exterior', href: lead(e.lead_id) });
  for (const p of photos) {
    const job = leadName.get(s(p.lead_id)) ?? 'a job';
    add({ id: `ph-${s(p.id)}`, at: s(p.created_at), who: who(p.created_by), kind: 'photo', text: `added a ${s(p.kind) || 'job'} photo to ${job}`, venture: 'exterior', href: lead(p.lead_id), group: `photo-${s(p.lead_id)}`, many: `added {n} photos to ${job}` });
  }
  for (const p of proposals) {
    if (s(p.created_at) >= since) add({ id: `prop-${s(p.id)}`, at: s(p.created_at), who: who(p.created_by), kind: 'proposal', text: `drafted proposal ${s(p.number)} for ${s(p.customer_name)}, ${money(n(p.total_cents))}`, venture: ven(p.division), href: `${base}/proposals` });
    const decided = s(p.decided_on);
    if (decided && decided >= sinceDay && (s(p.status) === 'accepted' || s(p.status) === 'declined')) {
      const won = s(p.status) === 'accepted';
      add({ id: `prop-dec-${s(p.id)}`, at: `${decided}T17:00:00Z`, who: 'Workspace', kind: won ? 'proposal-won' : 'proposal-lost', text: won ? `recorded proposal ${s(p.number)} as accepted` : `recorded proposal ${s(p.number)} as declined`, venture: ven(p.division), href: `${base}/proposals` });
    }
  }
  for (const c of customers) add({ id: `cust-${s(c.id)}`, at: s(c.created_at), who: c.created_by ? who(c.created_by) : 'Setup', kind: 'customer', text: `added ${s(c.name)} to the customer directory`, venture: null, href: `${base}/customers`, group: 'customer', many: 'added {n} customers to the directory' });
  for (const l of sharedLeads) add({ id: `shared-lead-${s(l.id)}`, at: s(l.created_at), who: who(l.created_by), kind: 'lead', text: `added ${s(l.name) || 'a lead'}${s(l.source) ? ` (source: ${s(l.source)})` : ''}`, venture: ven(l.venture) });
  for (const c of consultations) add({ id: `consultation-${s(c.id)}`, at: s(c.created_at), who: 'Website', kind: 'lead', text: `received a consultation request from ${s(c.name) || 'a customer'} (current status: ${s(c.status) || 'unknown'})`, venture: 'solutions', href: `${base}/b/solutions/consultations` });
  for (const m of metrics) {
    const label = s(m.label), value = n(m.value);
    let text = `logged ${label}: ${value.toLocaleString('en-US')}${s(m.unit) && s(m.unit) !== 'USD' ? ` ${s(m.unit)}` : ''}`;
    let href: string | undefined;
    if (label === TRUCK_LABEL) { text = `updated the truck fund to ${dollars(value)}`; href = `${base}/rig`; }
    else if (label === LSA_SPEND) text = `logged ${dollars(value)} of Local Services Ads spend`;
    else if (label === LSA_LEADS) text = `logged ${value} Local Services Ads leads`;
    else if (label.startsWith(RIG_PREFIX)) { const item = label.slice(RIG_PREFIX.length); text = s(m.unit) === DROPPED ? `took ${item} off the rig plan` : value > 0 ? `priced ${item} at ${dollars(value)} (${s(m.unit)})` : `added ${item} to the rig plan`; href = `${base}/rig`; }
    else if (label.startsWith(DEAL_PREFIX)) { const t = label.slice(DEAL_PREFIX.length); text = s(m.unit) === DROPPED ? `crossed ${t} off the truck list` : `added a truck to weigh: ${t}, ${dollars(value)}`; href = `${base}/rig`; }
    else if (/^Washer /.test(label)) { text = `logged the ${label.toLowerCase()}: ${s(m.unit) === 'days' ? `${value} days` : dollars(value)}`; href = `${base}/rig`; }
    else if (s(m.unit) === 'USD') text = `logged ${label}: ${dollars(value)}`;
    add({ id: `met-${s(m.id)}`, at: s(m.created_at), who: who(m.created_by), kind: 'number', text, venture: ven(m.venture), href });
  }
  for (const d of docs) add({ id: `doc-${s(d.id)}`, at: s(d.created_at), who: who(d.uploaded_by), kind: 'doc', text: `uploaded ${q(s(d.name))}`, venture: ven(d.venture), href: `${base}/files` });
  for (const e of events) if (!s(e.source) || s(e.source) === 'workspace') add({ id: `ev-${s(e.id)}`, at: s(e.created_at), who: who(e.created_by), kind: 'event', text: `put ${q(s(e.title))} on the calendar`, venture: ven(e.venture), href: `${base}/calendar` });
  for (const d of dms) if (!d.undone_at) add({ id: `dm-${s(d.id)}`, at: s(d.created_at), who: who(d.actor_id), kind: 'dm', text: `sent a DM${s(d.channel) ? ` on ${s(d.channel)}` : ''}`, venture: 'solutions', group: 'dm', many: 'sent {n} DMs' });
  for (const p of prospects) add({ id: `pro-${s(p.id)}`, at: s(p.created_at), who: who(p.actor_id), kind: 'lead-edit', text: `moved a prospect to ${s(p.new_status)}`, venture: 'solutions', group: 'prospect', many: 'moved {n} prospects along' });
  for (const e of emails) {
    const kind = s(e.kind), at = s(e.event_at) || s(e.created_at);
    if (kind === 'sent') add({ id: `em-${s(e.id)}`, at, who: ENGINE, kind: 'email', text: 'sent an outreach email', venture: 'solutions', href: `${base}/b/solutions/email`, group: 'email', many: 'sent {n} outreach emails' });
    else if (kind === 'reply') add({ id: `em-${s(e.id)}`, at, who: ENGINE, kind: 'reply', text: 'got a reply from a prospect. Go read it', venture: 'solutions', href: `${base}/b/solutions/email` });
    else add({ id: `em-${s(e.id)}`, at, who: ENGINE, kind: 'system', text: kind === 'bounce' ? 'had an email bounce' : 'got an unsubscribe', venture: 'solutions', group: `em-${kind}`, many: kind === 'bounce' ? 'had {n} emails bounce' : 'got {n} unsubscribes' });
  }
  for (const f of finance) add({ id: `fin-${s(f.id)}`, at: s(f.created_at), who: who(f.created_by), kind: 'number' as PulseKind, text: `logged ${s(f.kind) === 'revenue' ? 'income' : 'a cost'} of ${dollars(n(f.amount))}${s(f.category) ? ` (${s(f.category)})` : ''}`, venture: ven(f.venture), href: `${base}/finance` });

  if (out.length > LIMIT) incomplete = true;
  return { ok: true, events: mergeBursts(out).slice(0, LIMIT), people, now: nowIso, incomplete };
}
