'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Megaphone } from 'lucide-react';
import type { DashboardStore } from './useDashboard';
import type { ExtLead } from '@/lib/exterior';
import { LSA_LEADS, LSA_SPEND, lsaMonth } from '@/lib/lsa-stats';
import { dollars } from '@/lib/metrics';

type Props = { store: DashboardStore; leads: ExtLead[]; today: string; readOnly: boolean; parent: string };

const monthName = (m: string) => new Date(m + '-15T12:00:00').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/**
 * Google Local Services Ads, the main lead source: what it cost this month, what a lead and a job cost, and what the tagged jobs earned.
 * Spend and lead counts are typed in from the LSA page (weekly is enough); revenue comes from completed jobs tagged as LSA, so tagging leads matters.
 */
export function LsaCard({ store, leads, today, readOnly, parent }: Props) {
  const [spend, setSpend] = useState('');
  const [count, setCount] = useState('');
  const month = today.slice(0, 7);
  const s = lsaMonth(store.data?.metricEntries ?? [], leads, month);
  const spendValue = Number(spend), countValue = Number(count);
  const spendOk = spend.trim() !== '' && Number.isFinite(spendValue) && spendValue >= 0;
  const countOk = count.trim() !== '' && Number.isFinite(countValue) && countValue >= 0;

  const save = () => {
    if (spendOk) store.addMetric({ venture: 'exterior', label: LSA_SPEND, value: spendValue, unit: 'USD', measured_on: today, note: '' }, () => setSpend(''));
    if (countOk) store.addMetric({ venture: 'exterior', label: LSA_LEADS, value: countValue, unit: 'leads', measured_on: today, note: '' }, () => setCount(''));
  };

  return (
    <section className="panel lsa-card" aria-labelledby="lsa-h">
      <header className="panel-head"><h2 id="lsa-h"><Megaphone size={18} aria-hidden="true" /> Google Local Services Ads, {monthName(month)}</h2></header>
      {s.entries === 0 ? <p className="quiet">Nothing logged this month. Add the spend and the lead count from your LSA page to see cost per lead and return.</p> : (
        <div className="kpis compact">
          <div><span>Spend</span><strong>{dollars(s.spend)}</strong></div>
          <div><span>Leads</span><strong>{s.leads}</strong><small className="quiet">{s.costPerLead === null ? 'Log both spend and leads' : `${dollars(Math.round(s.costPerLead))} each`}</small></div>
          <div><span>Completed jobs tagged LSA</span><strong>{s.jobs}</strong><small className="quiet">{s.costPerJob === null ? '-' : `${dollars(Math.round(s.costPerJob))} of spend per job`}</small></div>
          <div><span>Revenue on those jobs</span><strong>{s.revenueJobs ? dollars(s.revenue) : '-'}</strong><small className="quiet">{s.returnOnSpend === null ? 'Needs spend and job revenue' : `${s.returnOnSpend.toFixed(1)}x the spend`}</small></div>
        </div>
      )}
      {!readOnly && (
        <form className="truck-form" onSubmit={e => { e.preventDefault(); save(); }}>
          <label>Spend to add ($)<input inputMode="decimal" type="number" min="0" step="0.01" value={spend} onChange={e => setSpend(e.target.value)} placeholder="This week" /></label>
          <label>Leads to add<input inputMode="numeric" type="number" min="0" step="1" value={count} onChange={e => setCount(e.target.value)} placeholder="This week" /></label>
          <button className="secondary small" disabled={store.pending || (!spendOk && !countOk)}>Add</button>
        </form>
      )}
      <p className="quiet">Jobs only count here once their lead source is set to Local Services Ads. <Link href={`${parent}/leads`}>Tag lead sources</Link></p>
    </section>
  );
}
