'use server';

import { requireMember } from '@/lib/supabase';
import { DEFAULT_DM_GOAL, dmChannels, partnerOf, type DmChannel, type DmLogEntry, type Partner } from '@/lib/dm-quests';
import { defaultEngineSettings, type EmailEvent, type EngineSettings, type EngineState } from '@/lib/email-engine';
import type { OutreachProspect } from '@/lib/outreach';

/** Everything the OJ Solutions growth screens need, loaded with the signed-in member's own session. */
export type GrowthData = {
  me: { userId: string; name: string; partner: Partner | null; role: string };
  members: { userId: string; name: string; partner: Partner | null }[];
  prospects: OutreachProspect[];
  prospectTotal: number;
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
    const people = (members.data ?? []).map((m: { user_id: string; display_name: string; role: string }) => ({ userId: m.user_id, name: m.display_name, partner: partnerOf(m.display_name), role: m.role }));
    const dmInstalled = !dmLog.error && !goal.error;
    const emailInstalled = !settings.error && !state.error && !events.error;
    if ((!dmInstalled && !missing(dmLog.error ?? goal.error)) || (!emailInstalled && !missing(settings.error ?? state.error ?? events.error))) return { ok: false, reason: 'failed' };
    return {
      ok: true,
      data: {
        me: { userId: user.id, name: member.display_name, partner: partnerOf(member.display_name), role: member.role },
        members: people.filter(p => p.role === 'owner' || p.role === 'member').map(({ userId, name, partner }) => ({ userId, name, partner })),
        prospects: (prospects.data ?? []) as OutreachProspect[], prospectTotal: prospects.count ?? 0,
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
  if (typeof input.enabled !== 'boolean' || !Number.isInteger(input.dailyCapMax) || input.dailyCapMax < 1 || input.dailyCapMax > 40) throw new Error('Choose on or off and a daily limit from 1 to 40.');
  const niche = input.niche.trim().slice(0, 80);
  const { error } = await client.rpc('oj_set_email_engine', { p_organization_id: org, p_enabled: input.enabled, p_daily_cap_max: input.dailyCapMax, p_niche_filter: niche || null });
  if (error) throw new Error(missing(error) ? 'The email engine is not installed yet. A founder needs to apply the email engine database update.' : 'Could not save the engine settings.');
}
