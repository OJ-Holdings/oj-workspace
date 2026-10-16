'use server';

import { requireMember } from '@/lib/supabase';
import { loadWork } from '@/lib/work-data';
import { editProblem, isWorkBusiness, type SessionEdit, type WorkData } from '@/lib/work';

// The work timer. Every action checks the caller is a partner (owner or
// member) through requireMember, then writes as that person: row-level
// security lets each partner change only their own sessions, and the
// database sets every time the scoring depends on (see
// supabase/schemas/work-leaderboard.sql). Each action returns the fresh
// figures, so the screen does not wait for the next workspace load.

/** `sticky`: the notice reports a timer ending at its last check-in, so it stays until dismissed. */
export type WorkResult = { ok: boolean; notice: string; sticky?: boolean; work: WorkData | null };

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
// Refusals the database words for people; anything else becomes a generic message.
const plainRefusals = [
  'This timer already ended at its last check-in', 'Say why this session was edited', 'A session cannot end in the future',
  'A session must end after it starts', 'A session can be at most 24 hours long', 'This overlaps another of your sessions',
  'A finished session cannot be restarted',
];
const refusal = (message: string | undefined, fallback: string) => plainRefusals.find(r => message?.includes(r)) ?? fallback;

async function asPartner(org: string) {
  if (typeof org !== 'string' || !uuid.test(org)) throw new Error('Invalid workspace.');
  return requireMember(org, true);
}
type Partner = Awaited<ReturnType<typeof asPartner>>;
const reply = async ({ client, user }: Partner, org: string, ok: boolean, notice: string, sticky = false): Promise<WorkResult> =>
  ({ ok, notice, sticky, work: await loadWork(client, org, user.id) });

export async function startWork(org: string, business: string): Promise<WorkResult> {
  const partner = await asPartner(org);
  if (!isWorkBusiness(business)) return reply(partner, org, false, 'Choose what you are working on.');
  // A timer of yours left running past its check-in ends first, at that check-in.
  await partner.client.rpc('oj_close_idle_work', { org });
  const { error } = await partner.client.from('oj_work_sessions').insert({ organization_id: org, user_id: partner.user.id, business });
  if (error?.code === '23505') return reply(partner, org, false, 'Your timer is already running, maybe on another device.');
  if (error) return reply(partner, org, false, 'Could not start the timer. Check your connection and try again.');
  return reply(partner, org, true, 'Timer started.');
}

export async function checkInWork(org: string, sessionId: string): Promise<WorkResult> {
  const partner = await asPartner(org);
  if (typeof sessionId !== 'string' || !uuid.test(sessionId)) return reply(partner, org, false, 'That timer is no longer running.');
  // The database sets the check-in to its own clock; the value sent here is ignored.
  const { data, error } = await partner.client.from('oj_work_sessions').update({ last_checkin_at: new Date().toISOString() })
    .eq('id', sessionId).eq('organization_id', org).eq('user_id', partner.user.id).is('ended_at', null).select('id');
  if (error && refusal(error.message, '') === plainRefusals[0]) {
    await partner.client.rpc('oj_close_idle_work', { org });
    return reply(partner, org, false, 'The check-in was missed, so your timer ended at your last check-in.', true);
  }
  if (error) return reply(partner, org, false, 'Could not check in. Check your connection and try again.');
  if (!data?.length) return reply(partner, org, false, 'That timer had already stopped.');
  return reply(partner, org, true, 'Checked in. The timer keeps running.');
}

export async function stopWork(org: string, sessionId: string, how: 'manual' | 'idle'): Promise<WorkResult> {
  const partner = await asPartner(org);
  if (typeof sessionId !== 'string' || !uuid.test(sessionId) || (how !== 'manual' && how !== 'idle')) return reply(partner, org, false, 'That timer is no longer running.');
  // 'manual' ends now; 'idle' ends at the last check-in. The database picks the time, and ends a timer
  // whose check-in was missed at that check-in whatever is asked here.
  const { data, error } = await partner.client.from('oj_work_sessions').update({ ended_reason: how, ended_at: new Date().toISOString() })
    .eq('id', sessionId).eq('organization_id', org).eq('user_id', partner.user.id).is('ended_at', null).select('ended_reason');
  if (error) return reply(partner, org, false, 'Could not stop the timer. Check your connection and try again.');
  if (!data?.length) return reply(partner, org, false, 'That timer had already stopped.');
  if (how === 'manual' && data[0].ended_reason === 'idle') return reply(partner, org, true, 'The check-in was missed, so the timer ended at your last check-in.', true);
  return reply(partner, org, true, how === 'idle' ? 'Timer ended at your last check-in.' : 'Timer stopped.');
}

export async function editWorkSession(org: string, edit: SessionEdit): Promise<WorkResult> {
  const partner = await asPartner(org);
  const problem = !edit || typeof edit.id !== 'string' || !uuid.test(edit.id) ? 'That session is no longer available.' : editProblem(edit, Date.now());
  if (problem) return reply(partner, org, false, problem);
  const { data, error } = await partner.client.from('oj_work_sessions')
    .update({ business: edit.business, started_at: new Date(edit.started_at).toISOString(), ended_at: new Date(edit.ended_at).toISOString(), note: edit.note.trim() })
    .eq('id', edit.id).eq('organization_id', org).eq('user_id', partner.user.id).not('ended_at', 'is', null).select('id');
  if (error) return reply(partner, org, false, refusal(error.message, 'Could not save the session. Check your connection and try again.'));
  if (!data?.length) return reply(partner, org, false, 'Only your own finished sessions can be edited.');
  return reply(partner, org, true, 'Session saved and marked as edited.');
}

/** Ends every timer in the workspace whose check-in was missed, at its last check-in. Run on load and when a check-in runs out. */
export async function closeIdleWork(org: string): Promise<WorkResult> {
  const partner = await asPartner(org);
  const { data, error } = await partner.client.rpc('oj_close_idle_work', { org });
  if (error) return reply(partner, org, false, 'Could not end a timer whose check-in was missed. It is not counted past its last check-in.');
  return reply(partner, org, true, Number(data) > 0 ? 'A timer whose check-in was missed was ended at its last check-in.' : '');
}
