'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return <main className="entry"><div className="entry-card"><h1>We couldn’t load your workspace.</h1><p>Check your connection and try again. Your saved work has not been replaced.</p><button className="primary" onClick={reset}>Try again</button></div></main>;
}
