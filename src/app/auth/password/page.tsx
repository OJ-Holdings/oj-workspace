import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AccountForm } from '@/components/AccountForm';
import { isConfigured, supabaseServer } from '@/lib/supabase';
export const dynamic = 'force-dynamic';
export default async function Password() {
  if (!isConfigured()) redirect('/auth/recovery');
  const client = await supabaseServer();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) redirect('/auth/recovery');
  return <main className="entry"><div className="entry-card"><Link href="/" className="brand-mark">OJ</Link><h1>Choose a new password.</h1><p>After saving, sign in with your new password.</p><AccountForm kind="password" configured /><Link className="text-link" href="/login">Return to sign in</Link></div></main>;
}
