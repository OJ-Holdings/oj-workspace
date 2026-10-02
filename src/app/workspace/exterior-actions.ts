'use server';

import { requireMember } from '@/lib/supabase';
import type { ExteriorData, ExteriorResult, ExtExtras, ExtLead, ExtSession } from '@/lib/exterior';
import { upgradeGroups } from '@/lib/upgrades';

type Client = Awaited<ReturnType<typeof requireMember>>['client'];
const num = (v: unknown) => v === null || v === undefined ? null : Number(v);
const messageLimit = 2000;

/** The goal, the upgrades list and website quote requests. Null when the database does not have that access yet. */
async function loadExtras(client: Client): Promise<ExtExtras> {
  const settings = await client.rpc('oj_exterior_settings');
  if (settings.error || !settings.data) return null;
  const quotes = await client.from('quote_requests').select('id,name,phone,email,address,service_needed,description,property_type,business_name,recurring_interest,created_at').order('created_at', { ascending: false }).limit(1000);
  if (quotes.error) return null;
  let upgrades: Record<string, true> = {};
  try { upgrades = JSON.parse(settings.data.upgrades_completed ?? '{}'); } catch { /* an unreadable list shows as nothing ticked */ }
  const goal = Number(settings.data.monthlyRevenueGoal);
  return { goal: Number.isFinite(goal) && goal > 0 ? goal : null, upgrades, quotes: quotes.data ?? [] };
}

/**
 * The existing Exterior Care records, for owners and members. Read only, through
 * the caller's own session: the database decides what comes back (viewers and
 * other workspaces get nothing), and this never writes to those tables.
 */
export async function loadExterior(org: string): Promise<ExteriorResult> {
  let client: Client;
  try { ({ client } = await requireMember(org, true)); } catch { return { ok: false, reason: 'no-access' }; }
  const [leads, bookings, sessions, messages, extras] = await Promise.all([
    client.from('leads').select('id,name,phone,address,service_requested,quote_amount,status,source,job_revenue,job_cost,created_at,updated_at,completed_at').order('created_at', { ascending: false }).limit(5000),
    client.from('bookings').select('id,lead_id,date,time_block,status').order('date', { ascending: false }).limit(5000),
    client.from('doorknocking_sessions').select('id,session_date,knocked_by,area,doors_knocked,answers,interested,quotes_given,jobs_scheduled,job_total').order('session_date', { ascending: false }).limit(5000),
    client.from('conversations').select('id,lead_id,direction,body,created_at').order('created_at', { ascending: false }).limit(messageLimit),
    loadExtras(client),
  ]);
  const failed = [leads, bookings, sessions, messages].find(r => r.error);
  if (failed) { console.error('Exterior Care read failed:', failed.error?.message); return { ok: false, reason: 'failed' }; }
  const data: ExteriorData = {
    leads: (leads.data ?? []).map(l => ({ ...l, quote_amount: num(l.quote_amount), job_revenue: num(l.job_revenue), job_cost: num(l.job_cost) }) as ExtLead),
    bookings: bookings.data ?? [],
    sessions: (sessions.data ?? []).map(s => ({ ...s, job_total: num(s.job_total) }) as ExtSession),
    messages: messages.data ?? [], messagesTruncated: (messages.data ?? []).length === messageLimit,
    extras,
  };
  return { ok: true, data };
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
