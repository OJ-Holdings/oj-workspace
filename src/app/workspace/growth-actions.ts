'use server';

import { requireMember } from '@/lib/supabase';
import { DEFAULT_DM_GOAL, dmChannels, partnerOf, type DmChannel, type DmLogEntry, type Partner } from '@/lib/dm-quests';
import { defaultEngineSettings, type EmailEvent, type EngineSettings, type EngineState } from '@/lib/email-engine';
import type { OutreachProspect } from '@/lib/outreach';
import type { SkipRecord } from '@/lib/outreach-skips';
import { skipReasons } from '@/lib/outreach-skips';

/** Everything the OJ Solutions growth screens need, loaded with the signed-in member's own session. */
export type GrowthData = {
  me: { userId: string; name: string; partner: Partner | null; role: string };
  members: { userId: string; name: string; partner: Partner | null }[];
  prospects: OutreachProspect[];
  prospectTotal: number;
  skips?: SkipRecord[] | null;
  /** null when the Daily 10 tables have not been installed yet. */
  dm: { goal: number; log: DmLogEntry[] } | null;
  /** null when the email engine tables have not been installed yet. */
  email: { settings: EngineSettings; state: EngineState | null; events: EmailEvent[] } | null;
  lastSync: { status: string; finished_at: string } | null;
  fetchedAt: string;
};
export type GrowthResult = { ok: true; data: GrowthData } | { ok: false; reason: 'no-prospects' | 'failed' };

const missing = (error: { code?: string; message?: string } | null) =>
  !!error && (error.code === 'PGRST205' || error.code === '42P01' || error.code === 'PGRST202' || /does not exist|schema cache/i.test(error.message ?? ''));

export async function loadGrowth(org: string): Promise<GrowthResult> {
  try {
    const { client, user, member } = await requireMember(org);
    const since = new Date(Date.now() - 62 * 86_400_000);
    const [prospects, members, goal, dmLog, settings, state, events, sync] = await Promise.all([
      client.from('oj_outreach_prospects').select('*', { count: 'exact' }).eq('organization_id', org).order('date_added', { ascending: false, nullsFirst: false }).order('business_name').limit(1000),
      client.from('oj_memberships').select('user_id,display_name,role').eq('organization_id', org),
      client.from('oj_growth_settings').select('dm_daily_goal').eq('organization_id', org).maybeSingle(),
      client.from('oj_outreach_dm_log').select('id,actor_id,prospect_id,channel,work_day,undone_at,created_at').eq('organization_id', org)
        .gte('work_day', since.toISOString().slice(0, 10)).order('created_at', { ascending: false }).limit(5000),
      client.from('oj_email_engine_settings').select('enabled,daily_cap_max,niche_filter').eq('organization_id', org).maybeSingle(),
      client.from('oj_email_engine_state').select('last_heartbeat_at,state,detail,warmup_started_on,sender_domain').eq('organization_id', org).maybeSingle(),
      client.from('oj_email_events').select('prospect_id,kind,event_at,detail').eq('organization_id', org).gte('event_at', since.toISOString()).order('event_at', { ascending: false }).limit(5000),
      client.from('oj_outreach_sync_runs').select('status,finished_at').eq('organization_id', org).order('started_at', { ascending: false }).limit(1).maybeSingle(),
    ]);
    if (prospects.error) return { ok: false, reason: missing(prospects.error) ? 'no-prospects' : 'failed' };
    const skipsResult = await client.from('oj_outreach_skips').select('id,organization_id,prospect_id,actor_id,business_name,source_row,channel,reason,note,skipped_at').eq('organization_id', org).order('skipped_at', { ascending: false }).limit(1000);
    const people = (members.data ?? []).map((m: { user_id: string; display_name: string; role: string }) => ({ userId: m.user_id, name: m.display_name, partner: partnerOf(m.display_name), role: m.role }));
    const dmInstalled = !dmLog.error && !goal.error;
    const emailInstalled = !settings.error && !state.error && !events.error;
    if ((!dmInstalled && !missing(dmLog.error ?? goal.error)) || (!emailInstalled && !missing(settings.error ?? state.error ?? events.error))) return { ok: false, reason: 'failed' };
    return {
      ok: true,
      data: {
        me: { userId: user.id, name: member.display_name, partner: partnerOf(member.display_name), role: member.role },
        members: people.filter(p => p.role === 'owner' || p.role === 'member').map(({ userId, name, partner }) => ({ userId, name, partner })),
        prospects: (prospects.data ?? []) as OutreachProspect[], prospectTotal: prospects.count ?? 0, skips: skipsResult.error ? null : (skipsResult.data ?? []) as SkipRecord[],
        dm: dmInstalled ? { goal: (goal.data as { dm_daily_goal?: number } | null)?.dm_daily_goal ?? DEFAULT_DM_GOAL, log: (dmLog.data ?? []) as DmLogEntry[] } : null,
        email: emailInstalled ? { settings: (settings.data as EngineSettings | null) ?? { ...defaultEngineSettings }, state: (state.data as EngineState | null) ?? null, events: (events.data ?? []) as EmailEvent[] } : null,
        lastSync: (sync.data as { status: string; finished_at: string } | null) ?? null,
        fetchedAt: new Date().toISOString(),
      },
    };
  } catch {
    return { ok: false, reason: 'failed' };
  }
}

const uuid = /^[0-9a-f-]{36}$/i;
export async function logDm(org: string, prospectId: string | null, channel: DmChannel) {
  const { client } = await requireMember(org, true);
  if (!(dmChannels as readonly string[]).includes(channel) || (prospectId !== null && !uuid.test(prospectId))) throw new Error('Choose a valid prospect and channel.');
  const { data, error } = await client.rpc('oj_log_dm', { p_organization_id: org, p_prospect_id: prospectId, p_channel: channel });
  if (error) throw new Error(missing(error) ? 'Daily 10 is not installed yet. A founder needs to apply the DM quest database update.' : 'Could not record the DM. Check your connection and try again.');
  return data as { ok: boolean; duplicate: boolean; id: string; today: number };
}
export async function undoDm(org: string, logId: string) {
  const { client } = await requireMember(org, true);
  if (!uuid.test(logId)) throw new Error('Choose a valid entry.');
  const { error } = await client.rpc('oj_undo_dm', { p_organization_id: org, p_log_id: logId });
  if (error) throw new Error('That one can no longer be undone. Undo works for 15 minutes.');
}
export async function setDmGoal(org: string, goal: number) {
  const { client } = await requireMember(org, true);
  if (!Number.isInteger(goal) || goal < 1 || goal > 50) throw new Error('The goal must be a whole number from 1 to 50.');
  const { error } = await client.rpc('oj_set_dm_goal', { p_organization_id: org, p_goal: goal });
  if (error) throw new Error('Could not change the goal.');
}
export async function setEmailEngine(org: string, input: { enabled: boolean; dailyCapMax: number; niche: string }) {
  const { client } = await requireMember(org, true);
  if (typeof input.enabled !== 'boolean' || !Number.isInteger(input.dailyCapMax) || input.dailyCapMax < 10 || input.dailyCapMax > 50) throw new Error('Choose on or off and a daily limit from 10 to 50.');
  const niche = input.niche.trim().slice(0, 80);
  const { data, error } = await client.rpc('oj_set_email_engine', { p_organization_id: org, p_enabled: input.enabled, p_daily_cap_max: input.dailyCapMax, p_niche_filter: niche || null });
  if (error) {
    console.error('oj_set_email_engine rejected settings', { code: error.code, message: error.message, details: error.details });
    throw new Error(missing(error) ? 'Email settings are not installed. Ask a founder to apply the reviewed SQL.' : 'Could not save the ceiling. The database may still have the old 40 or 1,500 limit. Ask a founder to apply the email ceiling SQL.');
  }
  return data as { enabled: boolean; daily_cap_max: number; niche_filter: string | null };
}

export async function skipDmProspect(org: string, prospectId: string, channel: DmChannel, reason: string, note: string) {
  const { client } = await requireMember(org, true);
  if (!uuid.test(prospectId) || !(dmChannels as readonly string[]).includes(channel) || !skipReasons.includes(reason as typeof skipReasons[number]) || note.length > 160)
    throw new Error('Choose a valid skip reason and a note under 160 characters.');
  if (reason === 'Other' && !note.trim()) throw new Error('Add a short note when you pick Other.');
  const { error } = await client.rpc('oj_skip_dm_prospect', { p_org: org, p_prospect: prospectId, p_channel: channel, p_reason: reason, p_note: note });
  if (error) {
    console.error('oj_skip_dm_prospect failed', { code: error.code, message: error.message });
    throw new Error(missing(error) ? 'Durable skips need the reviewed DM skips SQL installed by Oscar.' : 'Could not record the skip. Nothing was removed.');
  }
}

/** No Gmail search is performed. This RPC flags stale reservations for human review. */
export type EmailReservationReview = { prospect_id: string; recipient: string; business_name: string; reserved_at: string };
export async function listEmailReservationReviews(org: string): Promise<EmailReservationReview[]> {
  const { client } = await requireMember(org, true);
  const { data, error } = await client.rpc('oj_list_email_reservation_reviews', { p_org: org });
  if (error) {
    console.error('oj_list_email_reservation_reviews failed', { code: error.code, message: error.message });
    throw new Error(missing(error) ? 'Manual email reviews need the reviewed reservation SQL installed by Oscar.' : 'Could not load unconfirmed emails. No reservations were released.');
  }
  return (data ?? []) as EmailReservationReview[];
}

/** Only a verified founder can mark sent or explicitly release an uncertain email. */
export async function decideEmailReservation(org: string, prospectId: string, decision: 'sent' | 'release') {
  if (!uuid.test(prospectId) || !['sent', 'release'].includes(decision)) throw new Error('Invalid reservation decision.');
  const { client } = await requireMember(org, true);
  const { error } = await client.rpc('oj_decide_email_reservation', { p_org: org, p_prospect: prospectId, p_decision: decision });
  if (error) {
    console.error('oj_decide_email_reservation failed', { code: error.code, message: error.message });
    throw new Error(missing(error) ? 'Manual reservation review is not installed in Supabase.' : 'Could not update this reservation. Check Gmail and retry or ask Oscar to review the database error.');
  }
}
