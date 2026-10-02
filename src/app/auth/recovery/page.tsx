import Link from 'next/link';
export const dynamic = 'force-dynamic';
export default function Recovery() {
  return <main className="entry"><div className="entry-card"><Link href="/" className="brand-mark">OJ</Link><h1>Get back to your workspace.</h1><p>Email recovery is not enabled. Contact the project administrator for help restoring access. If you are still signed in, you can change your password.</p><Link className="text-link" href="/auth/password">Change password while signed in</Link><Link className="text-link" href="/login">Return to sign in</Link></div></main>;
}
