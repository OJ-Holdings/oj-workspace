import 'server-only';
import type { supabaseServer } from '@/lib/supabase';
import { isWorkBusiness, type WeekScore, type WorkData, type WorkSession } from '@/lib/work';

type Client = Awaited<ReturnType<typeof supabaseServer>>;

/**
 * The leaderboard's figures and the sessions behind them, read as the signed-in
 * partner. Returns null when they cannot be read: most likely the leaderboard's
 * database update has not been applied yet. Never substitutes sample figures.
 */
export async function loadWork(client: Client, org: string, me: string): Promise<WorkData | null> {
  // Sessions that ended in the last 15 days cover this week and last week in full.
  const since = new Date(Date.now() - 15 * 86_400_000).toISOString().slice(0, 19) + 'Z';
  const [scores, sessions, partners] = await Promise.all([
    client.rpc('oj_work_scores', { org }),
    client.from('oj_work_sessions').select('id,user_id,business,started_at,ended_at,last_checkin_at,ended_reason,note')
      .eq('organization_id', org).or(`ended_at.is.null,ended_at.gte.${since}`).order('started_at', { ascending: false }).limit(500),
    client.from('oj_memberships').select('user_id,display_name').eq('organization_id', org).in('role', ['owner', 'member']).order('created_at'),
  ]);
  if (scores.error || sessions.error || partners.error) return null;
  const weeks = ((scores.data || []) as Record<string, unknown>[]).map(r => ({
    week_start: String(r.week_start), starts_at: String(r.starts_at), ends_at: String(r.ends_at), user_id: String(r.user_id),
    worked_seconds: Number(r.worked_seconds), hours: Number(r.hours), tasks: Number(r.tasks),
    task_ids: Array.isArray(r.task_ids) ? r.task_ids.map(String) : [], points: Number(r.points),
    by_business: Object.fromEntries(Object.entries((r.by_business ?? {}) as Record<string, unknown>).filter(([k]) => isWorkBusiness(k)).map(([k, v]) => [k, Number(v)])),
    won: r.won === true,
  })) as WeekScore[];
  return {
    asOf: new Date().toISOString(), me,
    partners: (partners.data || []).map(p => ({ id: p.user_id, name: p.display_name })),
    weeks,
    sessions: (sessions.data || []).filter(s => isWorkBusiness(s.business)) as WorkSession[],
  };
}
