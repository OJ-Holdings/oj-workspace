import Link from 'next/link';
import { isConfigured, supabaseServer } from '@/lib/supabase';
import { StrathosLinkForm } from '@/components/StrathosLinkForm';

export const dynamic = 'force-dynamic';

// Owner-only page that mints the private link Oscar's STRATHOS dashboard reads. Not linked from the app.
export default async function StrathosLinkPage() {
  let org: string | null = null;
  let signedIn = false;
  if (isConfigured()) {
    const client = await supabaseServer();
    const { data: { user } } = await client.auth.getUser();
    signedIn = Boolean(user);
    if (user) {
      const { data } = await client.from('oj_memberships').select('organization_id').eq('user_id', user.id).eq('role', 'owner').limit(1).maybeSingle();
      org = data?.organization_id ?? null;
    }
  }
  return (
    <main className="entry"><div className="entry-card">
      <Link href="/" className="brand-mark">OJ</Link>
      <h1>STRATHOS link</h1>
      <p>A private, read-only summary of the workspace for the owner&apos;s own dashboard: money logged, open leads and tasks, and who is online with the status they wrote. It never includes messages, documents, customer details or notes.</p>
      {!signedIn ? <Link className="text-link" href="/login?next=/strathos-link">Sign in to continue</Link>
        : !org ? <p>Only a workspace owner can create this link.</p>
        : <StrathosLinkForm org={org} />}
    </div></main>
  );
}
