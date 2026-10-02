import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AccountForm } from '@/components/AccountForm';
import { invitationTokenPattern } from '@/lib/auth-input';
import { isConfigured, supabaseServer } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export default async function Join({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!invitationTokenPattern.test(token)) notFound();
  const configured = isConfigured();
  let email = '';
  if (configured) {
    const client = await supabaseServer();
    const { data: { user } } = await client.auth.getUser();
    email = user?.email || '';
  }
  return <main className="entry"><div className="entry-card"><Link href="/" className="brand-mark">OJ</Link><h1>Build together.</h1><p>Accept your OJ workspace invitation using the verified email it was issued for.</p>{email ? <><p className="quiet">Signed in as {email}. Acceptance adds OJ membership only; it does not change existing permissions.</p><AccountForm kind="accept" configured={configured} token={token} /></> : <><h2>Create your account</h2><AccountForm kind="register" configured={configured} token={token} /><p className="quiet">Already have an account? Sign in, then reopen this invitation.</p><Link className="secondary" href={`/login?next=${encodeURIComponent(`/join/${token}`)}`}>Sign in to accept</Link></>}<p className="quiet">Invitations expire after seven days. Ask your workspace owner for a new link if needed.</p></div></main>;
}
