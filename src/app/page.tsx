import Link from 'next/link';
export default function Home() {
  return <main className="entry"><div className="entry-card"><div className="brand-mark">OJ</div><p className="eyebrow">Your shared workspace</p><h1>Three businesses.<br />One place to run them.</h1><p>Tasks, leads, money, files and the calendar for OJ Exterior Care, OJ Solutions and OJ Essentials.</p><div className="entry-actions"><Link className="primary" href="/login">Sign in to OJ</Link><Link className="secondary" href="/preview">Explore the preview</Link></div><p className="quiet">The preview uses made-up records. Your business data needs an authorized account.</p></div></main>;
}
