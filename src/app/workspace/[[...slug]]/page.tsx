import Link from 'next/link';
import { redirect } from 'next/navigation';
import { LiveWorkspace } from '@/components/LiveWorkspace';
import { isConfigured, supabaseServer } from '@/lib/supabase';
import { loadWorkspace } from '@/lib/workspace-data';
export const dynamic = 'force-dynamic';
export default async function WorkspacePage() {
  if (!isConfigured()) redirect('/login');
  const client = await supabaseServer();
  const { data: { user } } = await client.auth.getUser();
  if (!user) redirect('/login');
  const { data: membership, error } = await client.from('oj_memberships').select('organization_id').eq('user_id', user.id).order('created_at').limit(1).maybeSingle();
  if (error) return <main className="entry"><div className="entry-card"><h1>Workspace unavailable</h1><p>Your workspace connection needs attention. No sample business data has been substituted.</p><Link href="/login">Return to sign in</Link></div></main>;
  if (!membership) return <main className="entry"><div className="entry-card"><h1>Your account is ready.</h1><p>An OJ administrator needs to grant your workspace membership before business records are available.</p><Link href="/login">Return to sign in</Link></div></main>;
  // Only whether each key is present reaches the browser, never the key itself.
  const connections = { shopify: Boolean(process.env.SHOPIFY_CLIENT_ID && process.env.SHOPIFY_CLIENT_SECRET && process.env.SHOPIFY_STORE_DOMAIN), ghl: Boolean(process.env.GHL_ACCESS_TOKEN && process.env.GHL_LOCATION_ID) };
  return <LiveWorkspace organizationId={membership.organization_id} initial={await loadWorkspace(membership.organization_id)} connections={connections} />;
}
