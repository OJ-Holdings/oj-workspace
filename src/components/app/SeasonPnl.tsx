'use client';

import { useState } from 'react';
import type { FinanceEntry } from '@/lib/dashboard';
import type { VentureId } from '@/lib/ventures';
import { dollars } from '@/lib/metrics';
import { seasonPnl } from '@/lib/season-pnl';

const monthName = (m: string) => new Date(`${m}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short' });

/** The whole season at a glance: money in, money out and what is left, month by month. Reads only recorded entries. */
export function SeasonPnl({ entries, venture, thisYear }: { entries: FinanceEntry[]; venture: VentureId | null; thisYear: string }) {
  const [year, setYear] = useState(thisYear);
  const p = seasonPnl(entries, year, venture);
  const top = Math.max(1, ...p.months.map(m => Math.max(m.revenue, m.cost)));
  const years = p.years.includes(year) ? p.years : [year, ...p.years];
  return (
    <section className="panel seasonpnl" aria-label="Season profit and loss">
      <header className="panel-head">
        <h2>Season profit and loss</h2>
        <label className="quiet">Year <select value={year} onChange={e => setYear(e.target.value)}>{years.map(y => <option key={y}>{y}</option>)}</select></label>
      </header>
      {p.months.length === 0 ? <div className="empty"><p><b>Nothing recorded in {year}.</b> Completed jobs with revenue and any expenses you enter show up here.</p></div> : <>
        <div className="kpis compact">
          <div><span>Money in</span><strong>{dollars(p.revenue)}</strong></div>
          <div><span>Money out</span><strong>{dollars(p.cost)}</strong></div>
          <div><span>Left over</span><strong className={p.net < 0 ? 'neg' : ''}>{dollars(p.net)}</strong></div>
        </div>
        <ul className="seasonpnl-rows">
          {p.months.map(m => <li key={m.month}>
            <b>{monthName(m.month)}</b>
            <span className="seasonpnl-bars" aria-hidden="true"><i className="in" style={{ width: `${(m.revenue / top) * 100}%` }} /><i className="out" style={{ width: `${(m.cost / top) * 100}%` }} /></span>
            <span className="seasonpnl-fig">{dollars(m.revenue)} in, {dollars(m.cost)} out</span>
            <strong className={m.net < 0 ? 'neg' : ''}>{dollars(m.net)}</strong>
          </li>)}
        </ul>
        {p.costByCategory.length > 0 && <p className="quiet">Biggest costs: {p.costByCategory.slice(0, 4).map(c => `${c.category} ${dollars(c.amount)}`).join(', ')}.</p>}
        <p className="quiet">Costs are only what has been entered, so months with unentered job costs look better than they are.</p>
      </>}
    </section>
  );
}
