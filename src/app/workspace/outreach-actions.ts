'use server';

import { requireMember } from '@/lib/supabase';
import type { OutreachActivity, OutreachProspect, OutreachStatus } from '@/lib/outreach';
import { outreachStatuses } from '@/lib/outreach';
import { leadQualitySummary } from '@/lib/outreach-quality';
import { sparkDeltas, type SparkCount } from '@/lib/spark-feed';
import { selectSendable } from '@/lib/email-engine';
import { dmTargets } from '@/lib/dm-quests';
import type { SkipRecord } from '@/lib/outreach-skips';

import type { EmailEvent } from '@/lib/email-engine';

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


/** Last 7 days of outreach quality, from verified Supabase events rather than sheet guesses. */
export async function loadLeadQuality(org: string) {
  const { client } = await requireMember(org);
  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [skips, dm, emails] = await Promise.all([
    client.from('oj_outreach_skips').select('id,organization_id,prospect_id,actor_id,business_name,source_row,channel,reason,note,skipped_at')
      .eq('organization_id', org).gte('skipped_at', since).order('skipped_at', { ascending: false }).limit(1000),
    client.from('oj_outreach_dm_log').select('id', { count: 'exact', head: true }).eq('organization_id', org).gte('created_at', since).is('undone_at', null),
    client.from('oj_email_events').select('id', { count: 'exact', head: true }).eq('organization_id', org).in('kind', ['sent','followup_sent']).gte('event_at', since),
  ]);
  if (skips.error || dm.error || emails.error) {
    console.error('Lead quality query failed', { skip: skips.error?.code, dm: dm.error?.code, emails: emails.error?.code });
    throw new Error('Lead quality needs the reviewed DM skips SQL and email log access.');
  }
  return leadQualitySummary((skips.data ?? []) as SkipRecord[], (dm.count ?? 0) + (emails.count ?? 0));
}

/** Snapshot-only Spark metrics, scoped to the authorized workspace member. */
export async function loadSparkFeed(org: string) {
  const { client } = await requireMember(org);
  const now = new Date();
  const yesterday = new Date(now.getTime() - 3 * 86_400_000).toISOString().slice(0,10);
  const [snapshots, prospects, skips, events, settings] = await Promise.all([
    client.from('oj_outreach_spark_snapshots').select('sender,channel,row_count,snapshot_day').eq('organization_id',org).gte('snapshot_day',yesterday).limit(30),
    client.from('oj_outreach_prospects').select('*').eq('organization_id',org).limit(1000),
    client.from('oj_outreach_skips').select('prospect_id').eq('organization_id',org).limit(1000),
    client.from('oj_email_events').select('prospect_id,kind,event_at').eq('organization_id',org).gte('event_at',new Date(now.getTime()-60*86_400_000).toISOString()).limit(5000),
    client.from('oj_email_engine_settings').select('niche_filter').eq('organization_id',org).maybeSingle(),
  ]);
  if ([snapshots, prospects, skips, events, settings].some(v=>v.error)) {
    console.error('Spark feed lookup failed', [snapshots,prospects,skips,events,settings].filter(v=>v.error).map(v=>v.error?.code));
    throw new Error('Spark feed needs the reviewed Spark and DM skips SQL migrations.');
  }
  const list = (prospects.data ?? []) as OutreachProspect[];
  const skipIds = new Set((skips.data ?? []).map((s:{prospect_id:string})=>s.prospect_id));
  const dm = Object.fromEntries(['Jacob','Oscar'].map(name => [name, dmTargets(list.filter(p => p.sent_by === name && !skipIds.has(p.id)), name as 'Jacob'|'Oscar').length]));
  const emailReady = selectSendable(list, (events.data ?? []) as EmailEvent[], { niche: settings.data?.niche_filter || null }).ready.length;
  return { deltas: sparkDeltas((snapshots.data ?? []) as SparkCount[], now), dm, emailReady,
    oscarNightBatch: { target: 20, hourCentral: 22, days: 'Monday to Saturday' } };
}
