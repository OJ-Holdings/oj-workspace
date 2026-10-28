'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadExterior } from '@/app/workspace/exterior-actions';
import { sampleExterior } from '@/lib/exterior-sample';
import type { ExteriorData } from '@/lib/exterior';
import { dataQuality } from '@/lib/data-quality';
import { dayKey } from '@/lib/dashboard';

/** Data quality center (master plan section 9): what is missing or doubtful in the customer and job records, and where to fix each. Reads the records already loaded; changes nothing. */
export function DataQualityView({ org, mode, base }: { org: string; mode: 'preview' | 'live'; base: string }) {
  const [data, setData] = useState<ExteriorData | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    if (mode === 'preview') { const t = new Date(); setData(sampleExterior(t)); setNow(t); return; }
    loadExterior(org).then(r => { if (!live) return; if (r.ok) { setData(r.data); setNow(new Date()); } else setFailed(true); }, () => { if (live) setFailed(true); });
    return () => { live = false; };
  }, [org, mode]);

  if (failed) return <div className="planned" role="alert"><h2>The records did not load</h2><p>Try again in a moment.</p></div>;
  if (!data || !now) return <div className="loading" aria-busy="true" />;
  const q = dataQuality(data, dayKey(now));
  return <>
    <div className="kpis">
      <div><span>Records in order</span><strong>{q.tidy === null ? '-' : `${q.tidy}%`}</strong></div>
      <div><span>Things to fix</span><strong>{q.checks.length}</strong></div>
      <div><span>Customers</span><strong>{data.leads.length}</strong></div>
    </div>
    <section className="panel">
      <header className="panel-head"><h2>To fix</h2></header>
      {q.checks.length === 0 ? <div className="empty"><p><b>Everything checked is in order.</b></p></div> : <ul className="quality-list">
        {q.checks.map(c => <li key={c.id}>
          <div>
            <b>{c.title}</b>
            <span>{c.count} of {c.of}{c.sample.length ? `, for example ${c.sample.join(', ')}` : ''}</span>
          </div>
          <Link className="primary small" href={base + c.href}>{c.action}</Link>
        </li>)}
      </ul>}
    </section>
  </>;
}
