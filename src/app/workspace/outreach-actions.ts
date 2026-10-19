'use server';

import { requireMember } from '@/lib/supabase';
import type { OutreachProspect, OutreachStatus } from '@/lib/outreach';
import { outreachStatuses } from '@/lib/outreach';

export async function loadOutreach(org: string): Promise<{ prospects: OutreachProspect[]; lastSync: { status: string; rows_written: number; error_summary: string; finished_at: string } | null }> {
  const { client } = await requireMember(org);
  const [prospects, runs] = await Promise.all([
    client.from('oj_outreach_prospects').select('*').eq('organization_id', org).order('date_added', { ascending: false, nullsFirst: false }).order('business_name').limit(1000),
    client.from('oj_outreach_sync_runs').select('status,rows_written,error_summary,finished_at').eq('organization_id', org).order('started_at', { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (prospects.error || runs.error) throw new Error('Outreach is not connected yet. Apply the reviewed outreach migration and configure the private sheet sync.');
  return { prospects: (prospects.data ?? []) as OutreachProspect[], lastSync: runs.data ?? null };
}

export async function updateOutreachStatus(org: string, prospectId: string, status: OutreachStatus) {
  const { client } = await requireMember(org, true);
  if (!(outreachStatuses as readonly string[]).includes(status) || !/^[a-f0-9-]{36}$/i.test(prospectId)) throw new Error('Choose a valid outreach status.');
  const { error } = await client.rpc('oj_set_outreach_status', { p_organization_id: org, p_prospect_id: prospectId, p_status: status });
  if (error) throw new Error('Could not save the outreach status. Check your access and try again.');
}

