'use server';

import { requireMember } from '@/lib/supabase';
import type { OutreachActivity, OutreachProspect, OutreachStatus } from '@/lib/outreach';
import { outreachStatuses } from '@/lib/outreach';

export async function loadOutreach(org: string) {
  const { client } = await requireMember(org);
  const [prospects, runs, activity] = await Promise.all([
    client.from('oj_outreach_prospects').select('*', { count: 'exact' }).eq('organization_id', org).order('date_added', { ascending: false, nullsFirst: false }).order('business_name').limit(1000),
    client.from('oj_outreach_sync_runs').select('status,rows_written,error_summary,finished_at').eq('organization_id', org).order('started_at', { ascending: false }).limit(1).maybeSingle(),
    client.from('oj_outreach_activity').select('id,prospect_id,actor_id,previous_status,new_status,created_at', { count: 'exact' }).eq('organization_id', org).gte('created_at', new Date(Date.now() - 36 * 3600_000).toISOString()).order('created_at', { ascending: false }).limit(1000),
  ]);
  if (prospects.error || runs.error) throw new Error('Outreach is not connected yet. Apply the reviewed outreach migration and configure the private sheet sync.');
  return { prospects: (prospects.data ?? []) as OutreachProspect[], total: prospects.count ?? 0, lastSync: runs.data ?? null,
    activity: activity.error ? null : (activity.data ?? []) as OutreachActivity[], activityLimited: (activity.count ?? 0) > 1000 };
}

export async function loadOutreachHistory(org: string, prospectId: string) {
  const { client } = await requireMember(org);
  if (!/^[a-f0-9-]{36}$/i.test(prospectId)) throw new Error('Choose a valid prospect.');
  const { data, error, count } = await client.from('oj_outreach_activity').select('id,prospect_id,actor_id,previous_status,new_status,created_at', { count: 'exact' })
    .eq('organization_id', org).eq('prospect_id', prospectId).order('created_at', { ascending: false }).limit(30);
  if (error) throw new Error('Status history could not be loaded. Try again.');
  return { entries: (data ?? []) as OutreachActivity[], total: count ?? 0 };
}

export async function updateOutreachStatus(org: string, prospectId: string, status: OutreachStatus) {
  const { client } = await requireMember(org, true);
  if (!(outreachStatuses as readonly string[]).includes(status) || !/^[a-f0-9-]{36}$/i.test(prospectId)) throw new Error('Choose a valid outreach status.');
  const { error } = await client.rpc('oj_set_outreach_status', { p_organization_id: org, p_prospect_id: prospectId, p_status: status });
  if (error) throw new Error('Could not save the outreach status. Check your access and try again.');
}

