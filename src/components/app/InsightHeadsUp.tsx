'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadExterior } from '@/app/workspace/exterior-actions';
import { sampleExterior } from '@/lib/exterior-sample';
import type { ExteriorData } from '@/lib/exterior';
import { forecast } from '@/lib/forecast';
import { anomalies } from '@/lib/anomalies';
import { businessDay } from '@/lib/reporting';
import { dollars } from '@/lib/metrics';

/** Insight's top: what the next 30 days are likely to bring, and the things in the records worth a second look (master plan 6.7 forecast, 6.15 anomaly radar). */
export function InsightHeadsUp({ org, mode, base }: { org: string; mode: 'preview' | 'live'; base: string }) {
  const [data, setData] = useState<ExteriorData | null>(null);
  const [today, setToday] = useState('');
  useEffect(() => {
    let live = true;
    const set = (d: ExteriorData) => { setData(d); setToday(businessDay(new Date().toISOString()) ?? ''); };
    if (mode === 'preview') { set(sampleExterior(new Date())); return; }
    loadExterior(org).then(r => { if (live && r.ok) set(r.data); }, () => undefined);
    return () => { live = false; };
  }, [org, mode]);
  if (!data || !today) return null;
  const f = forecast(data, today);
  const flags = anomalies(data);
  return <>
    <section className="panel" aria-label="Next 30 days">
      <header className="panel-head"><h2>Next 30 days</h2></header>
      <div className="kpis">
        <div><span>Booked</span><strong>{dollars(f.booked.quoted)}</strong><small className="quiet">{f.booked.jobs} confirmed job{f.booked.jobs === 1 ? '' : 's'}{f.booked.unquoted ? `, ${f.booked.unquoted} with no price` : ''}</small></div>
        <div><span>Open quotes</span><strong>{dollars(f.pipeline.quoted)}</strong><small className="quiet">{f.pipeline.winRate === null ? 'Not enough decided leads to weight yet' : `${dollars(f.pipeline.expected ?? 0)} at your ${Math.round(f.pipeline.winRate * 100)}% win rate`}</small></div>
        <div><span>Likely in</span><strong>{f.expected === null ? '-' : dollars(f.expected)}</strong><small className="quiet">Booked plus weighted quotes</small></div>
        <div><span>Last 30 days</span><strong>{dollars(f.lastPeriodRevenue)}</strong><small className="quiet">Recorded on finished jobs</small></div>
      </div>
    </section>
    <section className="panel" aria-label="Worth a second look">
      <header className="panel-head"><h2>Worth a second look</h2><span className="quiet">{flags.length}</span></header>
      {flags.length === 0 ? <div className="empty"><p><b>Nothing looks off.</b></p></div> : <ul className="quality-list">
        {flags.slice(0, 10).map(a => <li key={a.id}><div><b>{a.kind === 'loss' ? 'Lost money' : a.kind === 'paid-vs-quote' ? 'Paid versus quote' : 'Low quote'}</b><span>{a.text}</span></div>
          <Link className="secondary small" href={`${base}/b/exterior/customer?lead=${encodeURIComponent(a.lead.id)}`}>Open</Link></li>)}
      </ul>}
    </section>
  </>;
}
