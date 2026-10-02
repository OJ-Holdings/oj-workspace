'use server';

import { requireMember } from '@/lib/supabase';
import type { Done, ExteriorData, ExteriorResult, ExtExtras, ExtLead, ExtSession } from '@/lib/exterior';
import { upgradeGroups } from '@/lib/upgrades';
import { isSheetUrl, leadStatuses, normalizePhone, planLeadUpdate, settingKeys, slotTaken, timeBlocks, type LeadPatch } from '@/lib/exterior-ops';
import { parseCsv, parseDoorRows, planDedupe, planSheetSync, sheetCsvUrl, type SyncLead } from '@/lib/exterior-sync';
import { exteriorApi, textingConfigured } from '@/lib/exterior-server';

type Client = Awaited<ReturnType<typeof requireMember>>['client'];
const num = (v: unknown) => v === null || v === undefined ? null : Number(v);
const messageLimit = 2000;

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
  const [leads, bookings, sessions, messages, activity, extras] = await Promise.all([
    client.from('leads').select('id,name,phone,address,service_requested,quote_amount,status,source,notes,job_revenue,job_cost,created_at,updated_at,completed_at').order('created_at', { ascending: false }).limit(5000),
    client.from('bookings').select('id,lead_id,date,time_block,status').order('date', { ascending: false }).limit(5000),
    client.from('doorknocking_sessions').select('id,session_date,knocked_by,area,doors_knocked,answers,interested,quotes_given,jobs_scheduled,job_total').order('session_date', { ascending: false }).limit(5000),
    client.from('conversations').select('id,lead_id,direction,body,created_at').order('created_at', { ascending: false }).limit(messageLimit),
    client.from('activity_log').select('id,operator,action,description,lead_name,created_at').order('created_at', { ascending: false }).limit(300),
    loadExtras(client),
  ]);
  const failed = [leads, bookings, sessions, messages, activity].find(r => r.error);
  if (failed) { console.error('Exterior Care read failed:', failed.error?.message); return { ok: false, reason: 'failed' }; }
  const data: ExteriorData = {
    leads: (leads.data ?? []).map(l => ({ ...l, quote_amount: num(l.quote_amount), job_revenue: num(l.job_revenue), job_cost: num(l.job_cost) }) as ExtLead),
    bookings: bookings.data ?? [],
    sessions: (sessions.data ?? []).map(s => ({ ...s, job_total: num(s.job_total) }) as ExtSession),
    messages: messages.data ?? [], messagesTruncated: (messages.data ?? []).length === messageLimit,
    activity: activity.data ?? [], extras, texting: textingConfigured(),
  };
  return { ok: true, data };
}

/* ------------------------------ Changes ------------------------------ */

// Every change checks membership, validates its input, and then relies on the
// database policies as the second line of defence. A change the database
// refuses (for example before the editing update has been applied) comes back
// as a plain message rather than an error page.
const refused = 'That did not save. If this keeps happening, the database update that allows editing (supabase/pending/RUN-ME-exterior-care-editing.sql) may not have been run yet.';
async function guarded<T extends object>(org: string, work: (client: Client, who: string) => Promise<Done<T>>): Promise<Done<T>> {
  let client: Client, who: string;
  try { const m = await requireMember(org, true); client = m.client; who = m.member.display_name.split(' ')[0] || 'Workspace'; }
  catch { return { ok: false, message: 'Only workspace owners and members can change Exterior Care records.' }; }
  try { return await work(client, who); }
  catch (error) { console.error('Exterior Care change failed:', error instanceof Error ? error.message : error); return { ok: false, message: error instanceof Error && error.message.startsWith('!') ? error.message.slice(1) : refused }; }
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
const block = (v: unknown) => timeBlocks.some(([id]) => id === v) ? v as string : say('Choose a time block.');

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

/** Books a job directly as confirmed, as the original app's manual booking does. No text is sent. */
export async function bookJob(org: string, leadId: string, date: string, timeBlock: string): Promise<Done> {
  return guarded(org, async (client, who) => {
    const when = day(date), slot = block(timeBlock);
    const [{ data: lead }, { data: taken }] = await Promise.all([
      client.from('leads').select('id,name').eq('id', uuid(leadId)).maybeSingle(),
      client.from('bookings').select('id,date,time_block,status').eq('date', when),
    ]);
    if (!lead) say('That lead no longer exists.');
    if (slotTaken(taken ?? [], when, slot)) say('That time block is already booked. Choose another.');
    const { error } = await client.from('bookings').insert({ lead_id: leadId, date: when, time_block: slot, status: 'confirmed', created_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await changed(client.from('leads').update({ status: 'booked', updated_at: new Date().toISOString() }).eq('id', leadId).select('id'));
    await log(client, who, 'booking_manual', `Manually booked ${lead!.name} - ${when} ${slot}`, lead, { date: when, timeBlock: slot });
    return { ok: true };
  });
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

/** Saves business, sheet, texting and notification settings. */
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
const syncColumns = 'id,name,phone,address,source,service_requested,quote_amount,status,notes,manually_updated_fields';

/** Pulls the leads sheet and adds or updates leads. Hand edits always win. */
export async function syncLeadSheet(org: string): Promise<Done<{ added: number; updated: number; unchanged: number; failed: number }>> {
  return guarded(org, async (client, who) => {
    const rows = await readSheet(await sheetSetting(client, 'googleSheetUrl', 'google_sheet_url'));
    const { data: existing, error } = await client.from('leads').select(syncColumns).limit(10000);
    if (error) throw new Error(error.message);
    const plan = planSheetSync(rows, (existing ?? []) as SyncLead[], Date.now().toString().slice(-7));
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
    await log(client, who, 'sheet_synced', `Sheet synced: ${plan.inserts.length} new, ${plan.updates.length} updated, ${plan.unchanged + plan.blank} skipped`, null, { inserted: plan.inserts.length, updated: plan.updates.length, skipped: plan.unchanged + plan.blank });
    return { ok: true, added: plan.inserts.length, updated: plan.updates.length, unchanged: plan.unchanged, failed };
  });
}

/** Replaces the door-knocking sessions with the sheet's. New rows go in before old ones come out, so a failure loses nothing. */
export async function syncDoorSheet(org: string): Promise<Done<{ sessions: number }>> {
  return guarded(org, async (client, who) => {
    const sessions = parseDoorRows(await readSheet(await sheetSetting(client, 'd2dSheetUrl')), new Date());
    if (!sessions.length) say('No sessions found in that sheet. Check it is the door-knocking sheet.');
    const { data: old, error: readError } = await client.from('doorknocking_sessions').select('id').limit(10000);
    if (readError) throw new Error(readError.message);
    const { error } = await client.from('doorknocking_sessions').insert(sessions);
    if (error) throw new Error(error.message);
    const ids = (old ?? []).map(o => o.id);
    for (let i = 0; i < ids.length; i += 200) await client.from('doorknocking_sessions').delete().in('id', ids.slice(i, i + 200));
    await log(client, who, 'doorknocking_synced', `Door-knocking sheet synced: ${sessions.length} sessions`);
    return { ok: true, sessions: sessions.length };
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

/* ------------------------------ Texting (through the Exterior Care server) ------------------------------ */

// The operator name is sent as Oscar or Jacob because the original server only records those two.
const operatorFor = (who: string) => (['Oscar', 'Jacob'].includes(who) ? who : 'Unknown');

/** Sends one text to a lead, typed by a person. */
export async function sendText(org: string, leadId: string, body: string): Promise<Done> {
  return guarded(org, async (client, who) => {
    const message = text(body, 1600, 'A message', true)!;
    const { data: lead } = await client.from('leads').select('id,name,phone').eq('id', uuid(leadId)).maybeSingle();
    if (!lead) say('That lead no longer exists.');
    const to = normalizePhone(lead!.phone) ?? say('This lead has no usable phone number.');
    await exteriorApi('/sms/send', operatorFor(who), { method: 'POST', body: { to, body: message } });
    await log(client, who, 'text_sent', `Texted ${lead!.name}`, lead);
    return { ok: true };
  });
}

/** Sends the opening outreach text to up to 25 leads that have not been booked, completed or closed. */
export async function sendOutreach(org: string, leadIds: string[]): Promise<Done<{ sent: number; skipped: number; failed: number }>> {
  return guarded(org, async (client, who) => {
    if (!Array.isArray(leadIds) || !leadIds.length) say('Choose at least one lead.');
    if (leadIds.length > 25) say('Send to 25 leads or fewer at a time.');
    // One lead at a time: the original server's bulk route is shadowed by its single-lead route and never runs.
    const { data: leads } = await client.from('leads').select('id,status,phone').in('id', leadIds.map(uuid));
    let sent = 0, skipped = leadIds.length - (leads?.length ?? 0), failed = 0, lastError = '';
    for (const lead of leads ?? []) {
      if (['booked', 'completed', 'closed'].includes(lead.status ?? '') || !normalizePhone(lead.phone)) { skipped++; continue; }
      try { await exteriorApi(`/sms/outreach/${lead.id}`, operatorFor(who), { method: 'POST' }); sent++; }
      catch (error) { failed++; lastError = error instanceof Error ? error.message : ''; if (!sent && failed === 1 && lastError.includes('not answering')) throw error; }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (!sent && failed) throw new Error(lastError || '!No texts were sent.');
    return { ok: true, sent, skipped, failed };
  });
}

/** Three suggested replies, written by the Exterior Care server's AI. */
export async function suggestReplies(org: string, leadId: string): Promise<Done<{ suggestions: string[] }>> {
  return guarded(org, async (_client, who) => {
    const result = await exteriorApi<{ suggestions?: string[] }>(`/sms/ai-suggest/${uuid(leadId)}`, operatorFor(who));
    return { ok: true, suggestions: (result.suggestions ?? []).filter(s => typeof s === 'string').slice(0, 3) };
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
