'use server';

import { requireMember } from '@/lib/supabase';
import type { ExteriorData, ExteriorResult, ExtLead, ExtSession } from '@/lib/exterior';

const num = (v: unknown) => v === null || v === undefined ? null : Number(v);
const messageLimit = 2000;

/**
 * The existing Exterior Care records, for owners and members. Read only, through
 * the caller's own session: the database decides what comes back (viewers and
 * other workspaces get nothing), and this file never writes to those tables.
 */
export async function loadExterior(org: string): Promise<ExteriorResult> {
  let client: Awaited<ReturnType<typeof requireMember>>['client'];
  try { ({ client } = await requireMember(org, true)); } catch { return { ok: false, reason: 'no-access' }; }
  const [leads, bookings, sessions, messages] = await Promise.all([
    client.from('leads').select('id,name,phone,address,service_requested,quote_amount,status,source,job_revenue,job_cost,created_at,updated_at,completed_at').order('created_at', { ascending: false }).limit(5000),
    client.from('bookings').select('id,lead_id,date,time_block,status').order('date', { ascending: false }).limit(5000),
    client.from('doorknocking_sessions').select('id,session_date,knocked_by,area,doors_knocked,answers,interested,quotes_given,jobs_scheduled,job_total').order('session_date', { ascending: false }).limit(5000),
    client.from('conversations').select('id,lead_id,direction,body,created_at').order('created_at', { ascending: false }).limit(messageLimit),
  ]);
  const failed = [leads, bookings, sessions, messages].find(r => r.error);
  if (failed) { console.error('Exterior Care read failed:', failed.error?.message); return { ok: false, reason: 'failed' }; }
  const data: ExteriorData = {
    leads: (leads.data ?? []).map(l => ({ ...l, quote_amount: num(l.quote_amount), job_revenue: num(l.job_revenue), job_cost: num(l.job_cost) }) as ExtLead),
    bookings: bookings.data ?? [],
    sessions: (sessions.data ?? []).map(s => ({ ...s, job_total: num(s.job_total) }) as ExtSession),
    messages: messages.data ?? [], messagesTruncated: (messages.data ?? []).length === messageLimit,
  };
  return { ok: true, data };
}
