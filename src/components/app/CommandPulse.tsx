'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Gauge, Siren } from 'lucide-react';
import { loadExterior } from '@/app/workspace/exterior-actions';
import { sampleExterior } from '@/lib/exterior-sample';
import type { ExteriorData } from '@/lib/exterior';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { commandPulse } from '@/lib/command-pulse';
import { dollars } from '@/lib/metrics';

/** Two cards for the Command screen: what needs a person right now (each with a one-tap way there), and this month's pace with the open pipeline. */
export function CommandPulse({ org, mode, jobs, today, base }: { org: string; mode: 'preview' | 'live'; jobs: JobItem[]; today: string; base: string }) {
  const [data, setData] = useState<ExteriorData | null>(null);
  const [at, setAt] = useState(0);
  useEffect(() => {
    let live = true;
    if (mode === 'preview') { const t = new Date(); setData(sampleExterior(t)); setAt(t.getTime()); return; }
    loadExterior(org).then(r => { if (live && r.ok) { setData(r.data); setAt(Date.now()); } }, () => undefined);
    return () => { live = false; };
  }, [org, mode]);

  if (!data || !today) return null;
  const p = commandPulse(data, jobs, today, at);
  const stage = (label: string, s: { count: number; quoted: number }) => <li key={label}><span>{label}</span><b>{s.count}</b><small>{s.quoted ? dollars(s.quoted) : ''}</small></li>;
  return <>
    <section className="today-card" aria-labelledby="today-act">
      <header><h2 id="today-act"><Siren size={16} aria-hidden="true" /> Act now</h2></header>
      {p.exceptions.length === 0 ? <p className="today-empty">Nothing is waiting on you.</p> : <ol className="today-list today-act">
        {p.exceptions.map(e => <li key={e.id}><Link href={base + e.href}><strong>{e.text}</strong><small>Open <ArrowRight size={12} aria-hidden="true" /></small></Link></li>)}
      </ol>}
    </section>
    <section className="today-card" aria-labelledby="today-pace">
      <header><h2 id="today-pace"><Gauge size={16} aria-hidden="true" /> This month</h2><Link href={base + '/finance'}>Money <ArrowRight size={14} aria-hidden="true" /></Link></header>
      <div className="pulse-ticker">
        <div><span>Revenue</span><strong>{dollars(p.ticker.revenue)}</strong></div>
        <div><span>Jobs done</span><strong>{p.ticker.jobsDone}</strong></div>
        <div><span>Average job</span><strong>{p.ticker.avgJob === null ? '-' : dollars(Math.round(p.ticker.avgJob))}</strong></div>
        <div><span>Close rate</span><strong>{p.ticker.closeRate === null ? '-' : `${Math.round(p.ticker.closeRate * 100)}%`}</strong></div>
      </div>
      <ul className="pulse-pipeline" aria-label="Open pipeline">
        {stage('New', p.pipeline.new)}{stage('Contacted', p.pipeline.contacted)}{stage('Following up', p.pipeline.following_up)}{stage('Booked', p.pipeline.booked)}
      </ul>
    </section>
  </>;
}
