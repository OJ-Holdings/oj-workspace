import Link from 'next/link';
import { LoginForm } from '@/components/LoginForm';
import { isConfigured } from '@/lib/supabase';
import { safeAuthNext } from '@/lib/auth-input';
export const dynamic = 'force-dynamic';
export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string; notice?: string }> }) {
  const params = await searchParams;
  const notice = params.notice === 'password-updated' ? 'Password updated. Sign in with your new password.' : params.notice === 'link-expired' ? 'That account link could not be verified. Request a fresh link and open it in the browser where you started.' : params.notice === 'access-ended' ? 'Your workspace access ended. Contact your OJ workspace owner.' : '';
  return <main className="entry"><div className="entry-card"><Link href="/" className="brand-mark">OJ</Link><h1>Welcome to your<br />shared workspace.</h1><p>Use your individual OJ account. Workspace access is assigned to your account.</p>{notice && <p role="status" className="quiet">{notice}</p>}<LoginForm configured={isConfigured()} next={safeAuthNext(params.next || null)} /><Link className="text-link" href="/auth/recovery">Forgot your password?</Link><p className="quiet">Need an account? Your workspace administrator can invite you.</p><Link className="secondary" href="/preview">Explore the preview</Link></div></main>;
}
