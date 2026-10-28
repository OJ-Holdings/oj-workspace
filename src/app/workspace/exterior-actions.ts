'use server';

import { requireMember } from '@/lib/supabase';
import type { Done, ExteriorData, ExteriorResult, ExtExtras, ExtLead, ExtSession } from '@/lib/exterior';
import { upgradeGroups } from '@/lib/upgrades';
import { isSheetUrl, isValidBlock, leadSources, leadStatuses, normalizePhone, planLeadUpdate, settingKeys, slotTaken, type LeadPatch } from '@/lib/exterior-ops';
import { parseCsv, parseDoorRows, planDedupe, planSheetSync, sheetCsvUrl, type SyncLead } from '@/lib/exterior-sync';

type Client = Awaited<ReturnType<typeof requireMember>>['client'];
const num = (v: unknown) => v === null || v === undefined ? null : Number(v);

/** The goal, the upgrades list, website quote requests and the shared settings. Null when the database does not have that access yet. */
async function loadExtras(client: Client): Promise<ExtExtras> {
  const settings = await client.rpc('oj_exterior_settings');
  if (settings.error || !settings.data) return null;
  const quotes = await client.from('quote_requests').select('id,name,phone,email,address,service_needed,description,property_type,business_name,recurring_interest,created_at').order('created_at', { ascending: false }).limit(1000);
  if (quotes.error) return null;
  const values = settings.data as Record<string, string>;
  let upgrades: Record<string, true> = {};
  try { upgrades = JSON.parse(values.upgrades_completed ?? '{}'); } catch { /* an unreadable list shows as nothing ticked */ }
  const goal = Number(values.monthlyRevenueGoal);
  return { goal: Number.isFinite(goal) && goal > 0 ? goal : null, upgrades, quotes: quotes.data ?? [], settings: values };
}

/**
 * The existing Exterior Care records, for owners and members, through the
 * caller's own session: the database decides what comes back (viewers and
 * other workspaces get nothing).
 */
export async function loadExterior(org: string): Promise<ExteriorResult> {
  let client: Client;
  try { ({ client } = await requireMember(org, true)); } catch { return { ok: false, reason: 'no-access' }; }
  const [leads, bookings, sessions, activity, extras] = await Promise.all([
    client.from('leads').select('id,name,phone,address,service_requested,quote_amount,status,source,notes,job_revenue,job_cost,created_at,updated_at,completed_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(5000),
    client.from('bookings').select('id,lead_id,date,time_block,status', { count: 'exact' }).order('date', { ascending: false }).limit(5000),
    client.from('doorknocking_sessions').select('id,session_date,knocked_by,area,start_time,end_time,doors_knocked,answers,interested,quotes_given,jobs_scheduled,job_total,notes,created_at', { count: 'exact' }).order('session_date', { ascending: false }).order('created_at', { ascending: false }).limit(5000),
    client.from('activity_log').select('id,operator,action,description,lead_name,created_at').order('created_at', { ascending: false }).limit(300),
    loadExtras(client),
  ]);
  const failed = [leads, bookings, sessions, activity].find(r => r.error);
  if (failed) { console.error('Exterior Care read failed:', failed.error?.message); return { ok: false, reason: 'failed' }; }
  const data: ExteriorData = {
    leads: (leads.data ?? []).map(l => ({ ...l, quote_amount: num(l.quote_amount), job_revenue: num(l.job_revenue), job_cost: num(l.job_cost) }) as ExtLead),
    bookings: bookings.data ?? [],
    sessions: (sessions.data ?? []).map(s => ({ ...s, job_total: num(s.job_total) }) as ExtSession),
    activity: activity.data ?? [], extras,
    coverage: { leads: { loaded: leads.data?.length ?? 0, total: leads.count }, bookings: { loaded: bookings.data?.length ?? 0, total: bookings.count }, sessions: { loaded: sessions.data?.length ?? 0, total: sessions.count } },
  };
  return { ok: true, data };
}

/* ------------------------------ Changes ------------------------------ */

// Every change checks membership, validates its input, and then relies on the
// database policies as the second line of defence. A change the database
// refuses (for example before the editing update has been applied) comes back
// as a plain message rather than an error page.
const refused = 'The save could not be confirmed. Check the current record before retrying. If it keeps failing, ask a workspace owner to check the save error.';
const hourlyPending = 'The database rejected this booking time. Refresh and choose a valid time. If it still fails, ask a workspace owner to check the scheduling configuration.';
async function guarded<T extends object>(org: string, work: (client: Client, who: string) => Promise<Done<T>>): Promise<Done<T>> {
  let client: Client, who: string;
  try { const m = await requireMember(org, true); client = m.client; who = m.member.display_name.split(' ')[0] || 'Workspace'; }
  catch { return { ok: false, message: 'Only workspace owners and members can change Exterior Care records.' }; }
  try { return await work(client, who); }
  catch (error) { console.error('Exterior Care change failed:', error instanceof Error ? error.message : error); if (error instanceof Error && /bookings_time_block/.test(error.message)) return { ok: false, message: hourlyPending }; return { ok: false, message: error instanceof Error && error.message.startsWith('!') ? error.message.slice(1) : refused }; }
}
/** A message meant for the person, not a database failure. */
const say = (message: string): never => { throw new Error(`!${message}`); };
const uuid = (id: unknown) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id) ? id : say('That record no longer exists.');
const text = (v: unknown, max: number, label: string, required = false) => {
  if (v === null || v === undefined) return required ? say(`${label} is required.`) : null;
  if (typeof v !== 'string' || v.length > max) return say(`${label} must be up to ${max} characters.`);
  const t = v.trim();
  return t ? t : required ? say(`${label} is required.`) : null;
};
const money = (v: unknown, label: string) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 && n < 1e7 ? Math.round(n * 100) / 100 : say(`${label} must be a positive amount.`);
};
const day = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? v : say('Choose a valid date.');
const block = (v: unknown) => isValidBlock(v) ? v : say('Choose a start time between 8 AM and 8 PM, finishing by 10 PM, for 15 minutes to 8 hours.');

async function log(client: Client, who: string, action: string, description: string, lead?: { id: string; name: string | null } | null, metadata: object = {}) {
  const { error } = await client.from('activity_log').insert({ operator: who, action, description, lead_id: lead?.id ?? null, lead_name: lead?.name ?? null, metadata });
  if (error) console.error('Activity not recorded:', error.message);
}
async function changed(query: PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error('No row changed (refused by policy or already gone).');
}

export type LeadInput = { id?: string; name: string; phone: string; address: string; service_requested: string; quote_amount: string | number | null; notes: string; source: string };

/** Adds a lead, or saves edits to one. Edited fields are protected from the next sheet sync. */
export async function saveLead(org: string, input: LeadInput): Promise<Done<{ id: string }>> {
  return guarded(org, async (client, who) => {
    const rawPhone = text(input.phone, 40, 'Phone', true)!;
    const fields = {
      // A lead imported without a usable number keeps its placeholder until someone enters a real one.
      name: text(input.name, 255, 'Name', true)!, phone: normalizePhone(rawPhone) ?? (input.id && /^(NP_|NO_PHONE)/.test(rawPhone) ? rawPhone : say('Enter a 10-digit phone number.')),
      address: text(input.address, 500, 'Address'), service_requested: text(input.service_requested, 255, 'Service'),
      quote_amount: money(input.quote_amount, 'Quote'), notes: text(input.notes, 4000, 'Notes'), source: text(input.source, 100, 'Source') ?? 'manual',
    };
    const now = new Date().toISOString();
    if (!input.id) {
      const { data, error } = await client.from('leads').insert({ ...fields, status: 'new', manually_updated_fields: [], created_at: now, updated_at: now }).select('id').single();
      if (error || !data) throw new Error(error?.message ?? 'Insert returned nothing.');
      await log(client, who, 'lead_created', `Added new lead: ${fields.name}${fields.service_requested ? ` - ${fields.service_requested}` : ''}`, { id: data.id, name: fields.name });
      return { ok: true, id: data.id };
    }
    const id = uuid(input.id);
    const { data: current } = await client.from('leads').select('status,quote_amount,job_revenue,completed_at,manually_updated_fields,name').eq('id', id).maybeSingle();
    if (!current) say('That lead no longer exists.');
    await changed(client.from('leads').update(planLeadUpdate(current!, fields, now)).eq('id', id).select('id'));
    await log(client, who, 'lead_updated', `Updated ${fields.name}: ${Object.keys(fields).join(', ')}`, { id, name: fields.name }, { fields: Object.keys(fields) });
    return { ok: true, id };
  });
}

/** Sets the lead source on several customers at once (for example tagging this season's Local Services Ads leads). Only the source field changes. */
export async function setLeadSources(org: string, ids: string[], source: string): Promise<Done<{ count: number }>> {
  return guarded(org, async (client, who) => {
    if (!Array.isArray(ids) || ids.length === 0 || ids.length > 200) say('Choose between 1 and 200 customers.');
    if (!leadSources.some(([value]) => value === source)) say('Choose a lead source from the list.');
    const now = new Date().toISOString();
    let count = 0;
    for (const raw of ids) {
      const id = uuid(raw);
      const { data: current } = await client.from('leads').select('status,quote_amount,job_revenue,completed_at,manually_updated_fields,name').eq('id', id).maybeSingle();
      if (!current) continue;
      await changed(client.from('leads').update(planLeadUpdate(current, { source }, now)).eq('id', id).select('id'));
      count++;
    }
    await log(client, who, 'lead_updated', `Set lead source to ${source} on ${count} customer${count === 1 ? '' : 's'}`, null, { fields: ['source'], source, count });
    return { ok: true, count };
  });
}

/**
 * Explicitly records ONLY the internal estimate's reviewed price on the original
 * legacy lead. Draft lines, costs and versions stay local until a governed shared
 * quote schema exists. This is NOT quote acceptance, an email, an invoice or payment.
 *
 * Timestamp + existing amount compare-and-swap prevents a stale draft silently
 * overwriting changes another founder just made.
 */
export async function recordExteriorEstimatedPrice(
  org: string,
  leadId: string,
  expected: { updatedAt: string | null; amount: number | null },
  proposedPrice: number,
  reviewed: boolean,
): Promise<Done<{ id: string; amount: number }>> {
  return guarded(org, async (client, who) => {
    const id=uuid(leadId);
    if(reviewed!==true)say('Confirm the source, scope and quote pricing before recording the amount.');
    if(!expected||typeof expected!=='object'||expected.updatedAt!==null&&
        (typeof expected.updatedAt!=='string'||!Number.isFinite(Date.parse(expected.updatedAt))))say('Refresh the customer source before recording an estimate.');
    const prior=money(expected.amount,'Expected existing price');
    if(prior!==expected.amount)say('The saved quote baseline is invalid. Refresh the customer record.');
    const price=money(proposedPrice,'Proposed estimate');
    if(price===null||price===0)throw new Error('!Add a positive estimate price before recording.');
    const {data:current,error:readError}=await client.from('leads')
      .select('id,name,status,quote_amount,updated_at,manually_updated_fields,job_revenue,completed_at')
      .eq('id',id).maybeSingle();
    if(readError||!current)throw new Error('!Customer record is unavailable. Reload it before recording.');
    if(!['new','contacted','following_up'].includes(current.status??''))say('This customer is already booked, completed or closed. Review the existing booking or create a new opportunity; do not replace a historic quote.');
    if(current.updated_at!==expected.updatedAt||num(current.quote_amount)!==prior)
      say('The customer record changed since this estimate was opened. Review the new source values before recording a price.');
    const now=new Date().toISOString();
    let query=client.from('leads')
      .update(planLeadUpdate(current,{quote_amount:price},now))
      .eq('id',id).eq('status',current.status);
    query=expected.updatedAt===null?query.is('updated_at',null):query.eq('updated_at',expected.updatedAt);
    query=prior===null?query.is('quote_amount',null):query.eq('quote_amount',prior);
    const {data,error}=await query.select('id').maybeSingle();
    if(error)throw Error(error.message);
    if(!data)say('Someone changed this customer while you were reviewing the estimate. Reload and rebase your local draft before recording.');
    await log(client,who,'quote_price_recorded',
      'Recorded an internally reviewed estimate amount on an Exterior lead. Not a client acceptance or payment.',
      {id,name:current.name},{previous:prior,newAmount:price,internalReview:true});
    return {ok:true,id,amount:price};
  });
}

/** Moves a lead along the pipeline. Marking it completed with no payment entered uses the quote. */
export async function setLeadStatus(org: string, id: string, status: string): Promise<Done> {
  return guarded(org, async (client, who) => {
    if (!(leadStatuses as readonly string[]).includes(status)) say('Choose a status.');
    const { data: current } = await client.from('leads').select('status,quote_amount,job_revenue,completed_at,manually_updated_fields,name').eq('id', uuid(id)).maybeSingle();
    if (!current) say('That lead no longer exists.');
    await changed(client.from('leads').update(planLeadUpdate(current!, { status: status as LeadPatch['status'] }, new Date().toISOString())).eq('id', id).select('id'));
    await log(client, who, 'status_changed', `Marked ${current!.name} as ${status}`, { id, name: current!.name }, { status });
    return { ok: true };
  });
}

/** Records what a customer paid and what the job cost. */
export async function saveFinancials(org: string, id: string, input: { job_revenue: string | number | null; job_cost: string | number | null; notes: string }): Promise<Done> {
  return guarded(org, async (client, who) => {
    const { data: current } = await client.from('leads').select('status,quote_amount,job_revenue,completed_at,manually_updated_fields,name').eq('id', uuid(id)).maybeSingle();
    if (!current) say('That lead no longer exists.');
    const patch: LeadPatch = { job_revenue: money(input.job_revenue, 'Revenue'), job_cost: money(input.job_cost, 'Expenses'), notes: text(input.notes, 4000, 'Notes') };
    await changed(client.from('leads').update(planLeadUpdate(current!, patch, new Date().toISOString())).eq('id', id).select('id'));
    await log(client, who, 'lead_updated', `Updated ${current!.name}: job_revenue, job_cost, notes`, { id, name: current!.name }, { fields: ['job_revenue', 'job_cost', 'notes'] });
    return { ok: true };
  });
}

async function book(client: Client, who: string, leadId: string, date: string, timeBlock: string) {
  const when = day(date), slot = block(timeBlock);
  const [{ data: lead }, { data: taken }] = await Promise.all([
    client.from('leads').select('id,name,phone,address,service_requested,source,quote_amount,status').eq('id', uuid(leadId)).maybeSingle(),
    client.from('bookings').select('id,date,time_block,status').eq('date', when),
  ]);
  if (!lead) say('That client no longer exists.');
  if (slotTaken(taken ?? [], when, slot)) say('That time block is already booked. Choose another.');
  const now = new Date().toISOString();
  // A lead holds one job's money, so a returning client's new job gets its own record; their past job and its payment stay as they were.
  let target = lead!.id, repeat = false;
  if (lead!.status === 'completed' || lead!.status === 'closed') {
    const { data: job, error } = await client.from('leads').insert({
      name: lead!.name, phone: lead!.phone, address: lead!.address, service_requested: lead!.service_requested, source: lead!.source, quote_amount: lead!.quote_amount,
      status: 'booked', notes: 'Returning client', manually_updated_fields: [], created_at: now, updated_at: now,
    }).select('id').single();
    if (error || !job) throw new Error(error?.message ?? 'Repeat job not created.');
    target = job.id; repeat = true;
  }
  const { error } = await client.from('bookings').insert({ lead_id: target, date: when, time_block: slot, status: 'confirmed', created_at: now });
  if (error) throw new Error(error.message);
  if (!repeat) await changed(client.from('leads').update({ status: 'booked', updated_at: now }).eq('id', target).select('id'));
  await log(client, who, 'booking_manual', `${repeat ? 'Booked a repeat job for' : 'Booked'} ${lead!.name} - ${when} ${slot}`, { id: target, name: lead!.name }, { date: when, timeBlock: slot, repeat });
  return repeat;
}

/** Books a job as confirmed and moves the client to Booked. A client whose last job is done or closed gets a new job record. */
export async function bookJob(org: string, leadId: string, date: string, timeBlock: string): Promise<Done<{ repeat: boolean }>> {
  return guarded(org, async (client, who) => ({ ok: true, repeat: await book(client, who, leadId, date, timeBlock) }));
}

/** Adds a new client and books their job in one step. */
export async function bookNewClient(org: string, input: LeadInput, date: string, timeBlock: string): Promise<Done> {
  const checked = await guarded(org, async () => { day(date); block(timeBlock); return { ok: true }; });
  if (!checked.ok) return checked;
  const created = await saveLead(org, { ...input, id: undefined });
  if (!created.ok) return created;
  return guarded(org, async (client, who) => { await book(client, who, created.id, date, timeBlock); return { ok: true }; });
}

/** Moves a booking to another day or time block. */
export async function moveBooking(org: string, id: string, date: string, timeBlock: string): Promise<Done> {
  return guarded(org, async (client, who) => {
    const when = day(date), slot = block(timeBlock);
    const { data: taken } = await client.from('bookings').select('id,date,time_block,status').eq('date', when);
    if (slotTaken(taken ?? [], when, slot, uuid(id))) say('That time block is already booked. Choose another.');
    const { data, error } = await client.from('bookings').update({ date: when, time_block: slot, updated_at: new Date().toISOString() }).eq('id', id).select('lead_id').maybeSingle();
    if (error || !data) throw new Error(error?.message ?? 'No booking changed.');
    const { data: lead } = await client.from('leads').select('id,name').eq('id', data.lead_id).maybeSingle();
    await log(client, who, 'booking_updated', `Updated booking for ${lead?.name ?? 'lead'} -> ${when} ${slot}`, lead, { date: when, timeBlock: slot });
    return { ok: true };
  });
}

/**
 * Edits a booked job: the customer's details (the same fields and rules as editing a lead) and, if it
 * changed, the day and time. Everything is checked first so a clash does not leave half a change.
 */
export async function saveJob(org: string, bookingId: string, input: LeadInput, date: string, timeBlock: string): Promise<Done<{ moved: boolean }>> {
  return guarded(org, async (client, who) => {
    const when = day(date), slot = block(timeBlock), id = uuid(bookingId);
    const { data: current } = await client.from('bookings').select('id,lead_id,date,time_block').eq('id', id).maybeSingle();
    if (!current) say('That booking no longer exists.');
    const moved = current!.date !== when || current!.time_block !== slot;
    if (moved) {
      const { data: taken } = await client.from('bookings').select('id,date,time_block,status').eq('date', when);
      if (slotTaken(taken ?? [], when, slot, id)) say('That time is already booked. Choose another.');
    }
    const saved = await saveLead(org, { ...input, id: current!.lead_id as string });
    if (!saved.ok) return saved;
    if (moved) {
      const { error } = await client.from('bookings').update({ date: when, time_block: slot, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) {
        if (/bookings_time_block/.test(error.message)) say(`Details saved. ${hourlyPending}`);
        throw new Error(error.message);
      }
      await log(client, who, 'booking_updated', `Updated booking for ${input.name.trim()} -> ${when} ${slot}`, { id: current!.lead_id as string, name: input.name.trim() }, { date: when, timeBlock: slot });
    }
    return { ok: true, moved };
  });
}

export type JobItem = { id: string; lead_id: string; date: string; time_block: string; status: string | null; name: string; service: string | null; address: string | null; quote: number | null };

/**
 * Booked jobs for the calendars: from 45 days back, with the customer's name, service, address and quote.
 * Members and owners only, through their own session (viewers get nothing, like the rest of Exterior Care).
 */
export async function loadJobs(org: string): Promise<JobItem[]> {
  let client: Client;
  try { ({ client } = await requireMember(org, true)); } catch { return []; }
  const from = new Date(Date.now() - 45 * 86_400_000).toISOString().slice(0, 10);
  const { data: bookings, error } = await client.from('bookings').select('id,lead_id,date,time_block,status').gte('date', from).order('date').limit(1500);
  if (error || !bookings?.length) return [];
  const ids = [...new Set(bookings.map(b => b.lead_id).filter(Boolean))] as string[];
  const { data: leads } = await client.from('leads').select('id,name,service_requested,address,quote_amount').in('id', ids);
  const byId = new Map((leads ?? []).map(l => [l.id as string, l]));
  return bookings.filter(b => b.status !== 'denied' && b.status !== 'cancelled').map(b => {
    const l = byId.get(b.lead_id as string);
    return { id: b.id, lead_id: b.lead_id, date: b.date, time_block: b.time_block ?? '', status: b.status, name: l?.name || 'Customer', service: l?.service_requested ?? null, address: l?.address ?? null, quote: l?.quote_amount === null || l?.quote_amount === undefined ? null : Number(l.quote_amount) };
  });
}

/** Cancels a booking and puts the lead back to following up, as the original app does. */
export async function removeBooking(org: string, id: string): Promise<Done> {
  return guarded(org, async (client, who) => {
    const { data: booking } = await client.from('bookings').select('lead_id,date,time_block').eq('id', uuid(id)).maybeSingle();
    if (!booking) say('That booking no longer exists.');
    await changed(client.from('bookings').delete().eq('id', id).select('id'));
    const { data: lead } = await client.from('leads').update({ status: 'following_up', updated_at: new Date().toISOString() }).eq('id', booking!.lead_id).select('id,name').maybeSingle();
    await log(client, who, 'booking_deleted', `Deleted booking for ${lead?.name ?? 'lead'} - ${booking!.date} ${booking!.time_block}`, lead);
    return { ok: true };
  });
}

/** Saves business details, sheet links and the monthly goal. */
export async function saveSettings(org: string, changes: Record<string, string>): Promise<Done> {
  return guarded(org, async client => {
    for (const [key, value] of Object.entries(changes ?? {})) {
      if (!(settingKeys as readonly string[]).includes(key) || typeof value !== 'string' || value.length > 2000) say('Unknown setting.');
      if ((key === 'googleSheetUrl' || key === 'd2dSheetUrl') && value && !isSheetUrl(value)) say('Paste a Google Sheets link (https://docs.google.com/spreadsheets/d/...).');
      if (key === 'monthlyRevenueGoal' && value && !(Number(value) >= 0)) say('The goal must be an amount.');
    }
    const all = { ...changes };
    if (changes.googleSheetUrl !== undefined) all.google_sheet_url = changes.googleSheetUrl; // the original app reads both names
    const { error } = await client.rpc('oj_set_exterior_settings', { changes: all });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
}

async function readSheet(url: string) {
  if (!isSheetUrl(url)) say('Save a Google Sheets link in Settings first.');
  const response = await fetch(sheetCsvUrl(url), { cache: 'no-store', redirect: 'follow', signal: AbortSignal.timeout(20000) });
  if (!response.ok) say(`Google did not share the sheet (${response.status}). It must be shared as "Anyone with the link can view".`);
  const body = await response.text();
  if (body.length > 5_000_000) say('That sheet is too large to sync.');
  if (/^\s*<!doctype html|^\s*<html/i.test(body)) say('Google returned a sign-in page instead of the sheet. Share it as "Anyone with the link can view".');
  return parseCsv(body);
}
async function sheetSetting(client: Client, ...keys: string[]) {
  const { data } = await client.rpc('oj_exterior_settings');
  const values = (data ?? {}) as Record<string, string>;
  return keys.map(k => values[k]).find(Boolean) ?? '';
}
const syncColumns = 'id,name,phone,address,source,service_requested,quote_amount,status,notes,manually_updated_fields,job_revenue';

/**
 * Brings the leads sheet in as a baseline: adds people not here yet and fills in
 * what the sheet knows, without ever undoing an edit made in the workspace or
 * moving a status backwards. Without `apply` it only reports what would change.
 */
export async function importLeadSheet(org: string, apply: boolean): Promise<Done<{ added: number; updated: number; unchanged: number; failed: number }>> {
  return guarded(org, async (client, who) => {
    const rows = await readSheet(await sheetSetting(client, 'googleSheetUrl', 'google_sheet_url'));
    const { data: existing, error } = await client.from('leads').select(syncColumns).limit(10000);
    if (error) throw new Error(error.message);
    const plan = planSheetSync(rows, (existing ?? []) as SyncLead[], Date.now().toString().slice(-7));
    if (!apply) return { ok: true, added: plan.inserts.length, updated: plan.updates.length, unchanged: plan.unchanged, failed: 0 };
    const now = new Date().toISOString();
    let failed = 0;
    if (plan.inserts.length) {
      const { error: bulk } = await client.from('leads').insert(plan.inserts.map(l => ({ ...l, manually_updated_fields: [], created_at: now, updated_at: now })));
      if (bulk) for (const l of plan.inserts) { const { error: one } = await client.from('leads').insert({ ...l, manually_updated_fields: [], created_at: now, updated_at: now }); if (one) failed++; }
    }
    for (let i = 0; i < plan.updates.length; i += 10) {
      const results = await Promise.all(plan.updates.slice(i, i + 10).map(u => client.from('leads').update({ ...u.changes, updated_at: now }).eq('id', u.id).select('id')));
      failed += results.filter(r => r.error || !r.data?.length).length;
    }
    if (failed && failed === plan.inserts.length + plan.updates.length) throw new Error('Every write was refused.');
    await log(client, who, 'sheet_synced', `Leads sheet imported: ${plan.inserts.length} new, ${plan.updates.length} updated, ${plan.unchanged + plan.blank} skipped`, null, { inserted: plan.inserts.length, updated: plan.updates.length, skipped: plan.unchanged + plan.blank });
    return { ok: true, added: plan.inserts.length, updated: plan.updates.length, unchanged: plan.unchanged, failed };
  });
}

/**
 * Replaces every door-knocking session here with the sheet's, as the baseline.
 * New rows go in before old ones come out, so a failure loses nothing. Without
 * `apply` it only counts both sides.
 */
export async function importDoorSheet(org: string, apply: boolean): Promise<Done<{ sessions: number; doors: number; current: number }>> {
  return guarded(org, async (client, who) => {
    const sessions = parseDoorRows(await readSheet(await sheetSetting(client, 'd2dSheetUrl')), new Date());
    if (!sessions.length) say('No sessions found in that sheet. Check it is the door-knocking sheet.');
    const { data: old, error: readError } = await client.from('doorknocking_sessions').select('id').limit(10000);
    if (readError) throw new Error(readError.message);
    const doors = sessions.reduce((n, s) => n + s.doors_knocked, 0);
    if (!apply) return { ok: true, sessions: sessions.length, doors, current: old?.length ?? 0 };
    const { error } = await client.from('doorknocking_sessions').insert(sessions);
    if (error) throw new Error(error.message);
    const ids = (old ?? []).map(o => o.id);
    for (let i = 0; i < ids.length; i += 200) await client.from('doorknocking_sessions').delete().in('id', ids.slice(i, i + 200));
    await log(client, who, 'doorknocking_synced', `Door-knocking sheet imported: ${sessions.length} sessions replaced ${ids.length}`);
    return { ok: true, sessions: sessions.length, doors, current: ids.length };
  });
}

export type SessionInput = { id?: string; session_date: string; knocked_by: string; area: string; start_time: string; end_time: string; doors_knocked: string | number; answers: string | number; interested: string | number; quotes_given: string | number; jobs_scheduled: string | number; job_total: string | number; notes: string };
const count = (v: unknown, label: string) => { const n = Number(v === '' || v === null || v === undefined ? 0 : v); return Number.isInteger(n) && n >= 0 && n < 100000 ? n : say(`${label} must be a whole number.`); };

/** Logs a door-knocking session, or saves changes to one. Each step of the funnel cannot exceed the one before it. */
export async function saveSession(org: string, input: SessionInput): Promise<Done> {
  return guarded(org, async (client, who) => {
    const s = {
      session_date: day(input.session_date), knocked_by: text(input.knocked_by, 120, 'Who knocked') ?? 'Both', area: text(input.area, 200, 'Area'),
      start_time: text(input.start_time, 20, 'Start'), end_time: text(input.end_time, 20, 'End'),
      doors_knocked: count(input.doors_knocked, 'Doors'), answers: count(input.answers, 'Answers'), interested: count(input.interested, 'Interested'),
      quotes_given: count(input.quotes_given, 'Quotes'), jobs_scheduled: count(input.jobs_scheduled, 'Jobs'), job_total: money(input.job_total, 'Job total') ?? 0, notes: text(input.notes, 2000, 'Notes'),
    };
    if (s.answers > s.doors_knocked || s.interested > s.answers || s.quotes_given > s.interested || s.jobs_scheduled > s.quotes_given) say('Each number has to be no more than the one before it: doors, answers, interested, quotes, jobs.');
    if (input.id) await changed(client.from('doorknocking_sessions').update(s).eq('id', uuid(input.id)).select('id'));
    else { const { error } = await client.from('doorknocking_sessions').insert(s); if (error) throw new Error(error.message); }
    await log(client, who, input.id ? 'doorknocking_updated' : 'doorknocking_logged', `${input.id ? 'Updated' : 'Logged'} door knocking: ${s.area || 'no area'}, ${s.session_date}, ${s.doors_knocked} doors`);
    return { ok: true };
  });
}

export async function removeSession(org: string, id: string): Promise<Done> {
  return guarded(org, async (client, who) => {
    const { data } = await client.from('doorknocking_sessions').select('session_date,area').eq('id', uuid(id)).maybeSingle();
    await changed(client.from('doorknocking_sessions').delete().eq('id', id).select('id'));
    await log(client, who, 'doorknocking_removed', `Removed door-knocking session: ${data?.area || 'no area'}, ${data?.session_date ?? ''}`);
    return { ok: true };
  });
}

/** Finds duplicate leads; with `apply`, merges them. Texts and bookings move to the lead that is kept. */
export async function dedupeLeads(org: string, apply: boolean): Promise<Done<{ groups: number; removed: number }>> {
  return guarded(org, async (client, who) => {
    const { data, error } = await client.from('leads').select(syncColumns).limit(10000);
    if (error) throw new Error(error.message);
    const merges = planDedupe((data ?? []) as SyncLead[]);
    const removed = merges.reduce((n, m) => n + m.remove.length, 0);
    if (!apply || !merges.length) return { ok: true, groups: merges.length, removed };
    for (const m of merges) {
      for (const table of ['conversations', 'bookings'] as const) {
        const { error: move } = await client.from(table).update({ lead_id: m.keep }).in('lead_id', m.remove);
        if (move) throw new Error(move.message);
      }
      const patch: Record<string, string> = {};
      if (m.notes) patch.notes = m.notes;
      if (m.phone) patch.phone = m.phone;
      if (Object.keys(patch).length) await changed(client.from('leads').update(patch).eq('id', m.keep).select('id'));
      await changed(client.from('leads').delete().in('id', m.remove).select('id'));
    }
    await log(client, who, 'dedup_run', `Deduplication complete: ${removed} duplicate lead${removed === 1 ? '' : 's'} removed`);
    return { ok: true, groups: merges.length, removed };
  });
}

const known = new Set(upgradeGroups.flatMap(g => g.nodes.map(n => n.id)));
/** Saves which upgrades are ticked. The database function repeats the membership and shape checks. */
export async function saveUpgrades(org: string, completed: Record<string, true>): Promise<void> {
  const { client } = await requireMember(org, true);
  const ids = Object.keys(completed ?? {});
  if (ids.some(id => !known.has(id) || completed[id] !== true)) throw new Error('Unknown upgrade.');
  const { error } = await client.rpc('oj_set_exterior_upgrades', { completed });
  if (error) throw new Error('Could not save upgrades.');
}

/* ------------------------------ Itemised job expenses ------------------------------ */
// Needs docs/db-change-proposals/RUN-ME-2026-10-28-job-expenses.sql. Until an owner has run it, loading reports setUp: false and nothing changes.

const expenseKinds = ['materials', 'fuel', 'labor', 'equipment', 'other'] as const;
export type JobExpense = { id: string; kind: string; amount: number; note: string; spent_on: string };
export type JobExpensesLoad = { ok: true; setUp: boolean; expenses: JobExpense[] } | { ok: false; message: string };

const missingTable = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || /does not exist|schema cache|could not find the table/i.test(e.message ?? ''));

export async function loadJobExpenses(org: string, leadId: string): Promise<JobExpensesLoad> {
  let client: Client;
  try { ({ client } = await requireMember(org, true)); } catch { return { ok: false, message: 'Only workspace members can see job costs.' }; }
  if (typeof leadId !== 'string' || !/^[0-9a-f-]{36}$/i.test(leadId)) return { ok: false, message: 'That job no longer exists.' };
  const { data, error } = await client.from('oj_job_expenses').select('id,kind,amount,note,spent_on').eq('organization_id', org).eq('lead_id', leadId).order('spent_on', { ascending: false }).order('created_at', { ascending: false });
  if (error) return missingTable(error) ? { ok: true, setUp: false, expenses: [] } : { ok: false, message: 'Job costs did not load.' };
  return { ok: true, setUp: true, expenses: (data ?? []).map(r => ({ id: r.id as string, kind: r.kind as string, amount: Number(r.amount), note: (r.note as string) ?? '', spent_on: r.spent_on as string })) };
}

/** Writes the job's cost total (what the Money page and reports read) from its itemised expenses. Leaves the old single figure alone when none are left. */
async function syncJobCost(client: Client, org: string, leadId: string) {
  const { data, error } = await client.from('oj_job_expenses').select('amount').eq('organization_id', org).eq('lead_id', leadId);
  if (error) throw new Error(error.message);
  if (!data?.length) return;
  const total = Math.round(data.reduce((t, r) => t + Number(r.amount), 0) * 100) / 100;
  const { data: current } = await client.from('leads').select('status,quote_amount,job_revenue,completed_at,manually_updated_fields,name').eq('id', leadId).maybeSingle();
  if (!current) return;
  await changed(client.from('leads').update(planLeadUpdate(current, { job_cost: total }, new Date().toISOString())).eq('id', leadId).select('id'));
}

export async function addJobExpense(org: string, leadId: string, input: { kind: string; amount: string | number; note: string; spent_on: string }): Promise<Done> {
  return guarded(org, async (client, who) => {
    const id = uuid(leadId);
    if (!(expenseKinds as readonly string[]).includes(input.kind)) say('Choose what the money was for.');
    const amount = money(input.amount, 'Amount');
    if (amount === null || amount <= 0) say('Enter an amount above zero.');
    const note = text(input.note, 300, 'Note') ?? '';
    const spent_on = day(input.spent_on);
    const { data: lead } = await client.from('leads').select('id,name').eq('id', id).maybeSingle();
    if (!lead) say('That job no longer exists.');
    const { error } = await client.from('oj_job_expenses').insert({ organization_id: org, lead_id: id, kind: input.kind, amount, note, spent_on });
    if (error) throw new Error(missingTable(error) ? '!Itemised costs are not switched on yet. A founder needs to run the job-expenses SQL.' : error.message);
    await syncJobCost(client, org, id);
    await log(client, who, 'lead_updated', `Added a ${input.kind} cost of $${amount} to ${lead!.name}`, lead, { fields: ['job_cost'] });
    return { ok: true };
  });
}

export async function removeJobExpense(org: string, expenseId: string): Promise<Done> {
  return guarded(org, async (client, who) => {
    const id = uuid(expenseId);
    const { data: row } = await client.from('oj_job_expenses').select('lead_id').eq('organization_id', org).eq('id', id).maybeSingle();
    if (!row) say('That cost no longer exists.');
    await changed(client.from('oj_job_expenses').delete().eq('id', id).select('id'));
    await syncJobCost(client, org, row!.lead_id as string);
    await log(client, who, 'lead_updated', 'Removed a job cost', { id: row!.lead_id as string, name: null }, { fields: ['job_cost'] });
    return { ok: true };
  });
}
