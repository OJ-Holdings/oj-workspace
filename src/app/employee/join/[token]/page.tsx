import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AccountForm } from '@/components/AccountForm';
import { invitationTokenPattern } from '@/lib/auth-input';
import { isConfigured, supabaseServer } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export default async function EmployeeJoin({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!invitationTokenPattern.test(token)) notFound();
  const configured = isConfigured();
  let email = '';
  if (configured) {
    const client = await supabaseServer();
    const { data: { user } } = await client.auth.getUser();
    email = user?.email ?? '';
  }
  const next = `/employee/join/${token}`;
  return <main className="entry"><div className="entry-card"><Link href="/" className="brand-mark">OJ</Link><p className="eyebrow">Employee access</p><h1>Join your crew.</h1><p>This invitation opens your employee portal for assigned jobs and your own earnings. It does not add access to the company workspace.</p>{email ? <><p className="quiet">Signed in as {email}. Use the verified email this invitation was sent to.</p><AccountForm kind="accept-employee" configured={configured} token={token} /></> : <><AccountForm kind="register-employee" configured={configured} token={token} /><p className="quiet">Already have an OJ account? Sign in with the invited email to accept this invitation.</p><Link className="secondary" href={`/login?next=${encodeURIComponent(next)}`}>Sign in to accept</Link></>}<p className="quiet">Ask the OJ owner for a new link if this invitation has expired or was revoked.</p></div></main>;
}
