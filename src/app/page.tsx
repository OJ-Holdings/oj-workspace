import Link from 'next/link';
export default function Home() {
  return <main className="entry"><div className="entry-card"><div className="brand-mark">OJ</div><p className="eyebrow">Your shared workspace</p><h1>Two businesses.<br />One place to move forward.</h1><p>Plan the work, keep the customer history, and see what needs attention across Exterior Care and OJ Solutions.</p><div className="entry-actions"><Link className="primary" href="/login">Sign in to OJ</Link><Link className="secondary" href="/preview">Explore the preview</Link></div><p className="quiet">The preview uses sample records. Your business data requires an authorized account.</p></div></main>;
}
