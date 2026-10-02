import Link from 'next/link';
import { AccountForm } from '@/components/AccountForm';
import { isConfigured, supabaseServer } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export default async function Setup() {
  const configured = isConfigured();
  let email = '';
  if (configured) { const client = await supabaseServer(); const { data: { user } } = await client.auth.getUser(); email = user?.email || ''; }
  return <main className="entry"><div className="entry-card"><Link href="/" className="brand-mark">OJ</Link><h1>Your shared workspace starts here.</h1><p>Create your account with the assigned owner email. No verification email is required. The project administrator must approve your account before you can finish owner setup.</p>{email ? <><p className="quiet">Signed in as {email}.</p><AccountForm kind="claim-owner" configured={configured} /></> : <AccountForm kind="owner" configured={configured} />}<Link className="text-link" href="/login?next=/setup">Already have an account? Sign in</Link></div></main>;
}
