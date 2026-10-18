import Link from 'next/link';
import { redirect } from 'next/navigation';
import { TeamPanel } from '@/components/TeamPanel';
import { isConfigured, requireMember, supabaseServer } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export default async function Team() {
  if (!isConfigured()) redirect('/login');
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership } = await client.from('oj_memberships').select('organization_id').eq('user_id', user.id).order('created_at').limit(1).maybeSingle();
  if (!membership) redirect('/workspace');
  const { member } = await requireMember(membership.organization_id);
  if (member.role !== 'owner') redirect('/workspace');
  const [members, invitations] = await Promise.all([
    client.from('oj_memberships').select('user_id,display_name,role').eq('organization_id', membership.organization_id).order('display_name'),
    client.rpc('oj_list_invitations', { org: membership.organization_id }),
  ]);
  if (members.error || invitations.error) throw new Error('Could not load workspace access. Check the collaboration schema is installed.');
  return <main className="settings-page"><Link className="text-link" href="/workspace">← Back to workspace</Link><p className="eyebrow">Your OJ team</p><h1>People &amp; access<span className="heading-dot">.</span></h1><p>Give each person the access their work needs.</p><p><Link className="secondary" href="/workspace/employees">Manage employees &amp; assigned jobs →</Link></p><TeamPanel org={membership.organization_id} members={members.data || []} invitations={invitations.data || []} /></main>;
}
