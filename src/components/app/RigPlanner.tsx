'use client';

import { useMemo, useState } from 'react';
import type { DashboardStore } from './useDashboard';
import { money } from '@/lib/metrics';
import { truckBalanceFromBank, truckFund, withBankBalance } from '@/lib/truck-fund';
import {
  DEAL_PREFIX, DROPPED, RIG_PREFIX, RIG_STATUSES, WASHER_RENTAL_DAY, WASHER_RENTAL_DAYS, WASHER_REPAIR, WASHER_REPLACE, dealList, encodeDeal, missingItems, rigGap, rigItems,
  rigLines, rigTotals, safeUrl, washerFigures, washerVerdict, type Inspection, type RigStatus,
} from '@/lib/rig-plan';

const NAME_MAX = 70;
const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
const num = (s: string) => (s.trim() !== '' && Number.isFinite(Number(s)) && Number(s) >= 0 && Number(s) < 100_000_000 ? Number(s) : null);

/**
 * The truck and rig plan: what the $20,000 has to cover line by line, the trucks being weighed against each other, and whether the washer is worth
 * repairing. Everything is typed in by a founder and kept as logged numbers both of you see; the fund balance comes from the bank when connected.
 */
export function RigPlanner({ store, readOnly }: { store: DashboardStore; readOnly: boolean }) {
  const entries = useMemo(() => store.data?.metricEntries ?? [], [store.data?.metricEntries]);
  const lines = useMemo(() => rigLines(entries), [entries]);
  const deals = useMemo(() => dealList(entries), [entries]);
  const washer = useMemo(() => washerFigures(entries), [entries]);
  const verdict = washerVerdict(washer);
  const totals = rigTotals(lines);
  const fund = truckFund(withBankBalance(entries, truckBalanceFromBank(store.data?.mercury)), today());
  const gap = rigGap(fund.goal, totals.total, fund.balance);

  const log = (label: string, value: number, unit: string, note = '', done: () => void = () => {}) =>
    store.addMetric({ venture: 'exterior', label, value, unit, measured_on: today(), note }, done);

  const [item, setItem] = useState(''); const [price, setPrice] = useState(''); const [status, setStatus] = useState<RigStatus>('researching'); const [vendor, setVendor] = useState('');
  const [d, setD] = useState({ name: '', price: '', miles: '', year: '', url: '', notes: '', inspection: 'unknown' as Inspection, rating: '' });
  const [w, setW] = useState({ repair: '', perDay: '', days: '', replace: '' });
  const itemOk = item.trim().length > 0 && item.trim().length <= NAME_MAX && num(price) !== null;
  const dealOk = d.name.trim().length > 0 && d.name.trim().length <= NAME_MAX && num(d.price) !== null && (d.url.trim() === '' || safeUrl(d.url.trim()) !== null);
  const money0 = (n: number) => money(Math.round(n));

  return <>
    <section className="panel" aria-labelledby="rig-h">
      <header className="panel-head"><h2 id="rig-h">Truck and rig budget</h2></header>
      <div className="kpis compact">
        <div><span>Rig budget so far</span><strong>{money0(totals.total)}</strong><small className={gap.overGoal > 0 ? 'neg' : 'quiet'}>{gap.overGoal > 0 ? `${money0(gap.overGoal)} over the ${money0(fund.goal)} goal` : `${money0(-gap.overGoal)} under the ${money0(fund.goal)} goal`}</small></div>
        <div><span>Truck fund</span><strong>{fund.balance === null ? '-' : money0(fund.balance)}</strong><small className="quiet">{gap.shortOfBudget === null ? 'No balance yet' : gap.shortOfBudget === 0 ? 'Covers the budget' : `${money0(gap.shortOfBudget)} short of the budget`}</small></div>
        <div><span>Bought</span><strong>{money0(totals.bought)}</strong><small className="quiet">{money0(totals.quoted)} quoted, {money0(totals.researching)} researching</small></div>
        <div><span>Needed a month</span><strong>{fund.perMonthNeeded === null ? '-' : money0(Math.ceil(fund.perMonthNeeded))}</strong><small className="quiet">to reach the goal by April 1</small></div>
      </div>
      {totals.unpriced > 0 && <p className="quiet">{totals.unpriced} line{totals.unpriced === 1 ? ' has' : 's have'} no price yet, so the budget is higher than it shows.</p>}
      <div className="tablewrap"><table className="table">
        <caption className="sr-only">Rig budget lines</caption>
        <thead><tr><th scope="col">Item</th><th scope="col">Price</th><th scope="col">Status</th><th scope="col">Vendor or link</th>{!readOnly && <th scope="col"><span className="sr-only">Remove</span></th>}</tr></thead>
        <tbody>{lines.map(l => <tr key={l.item}>
          <th scope="row">{l.item}</th><td>{l.price === 0 ? 'Not priced' : money0(l.price)}</td>
          <td>{readOnly ? l.status : <select aria-label={`Status of ${l.item}`} value={l.status} disabled={store.pending} onChange={e => log(`${RIG_PREFIX}${l.item}`, l.price, e.target.value, l.note)}>{RIG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select>}</td>
          <td>{l.note || '-'}</td>
          {!readOnly && <td><button type="button" className="secondary small" disabled={store.pending} onClick={() => log(`${RIG_PREFIX}${l.item}`, 0, DROPPED)}>Remove</button></td>}
        </tr>)}</tbody>
      </table>{lines.length === 0 && <p className="quiet">No lines yet. Add the first one below, starting with the truck.</p>}</div>
      {!readOnly && <>
        <form className="truck-form" onSubmit={e => { e.preventDefault(); if (itemOk) log(`${RIG_PREFIX}${item.trim()}`, num(price)!, status, vendor.trim().slice(0, 200), () => { setItem(''); setPrice(''); setVendor(''); }); }}>
          <label>Item<input list="rig-items" maxLength={NAME_MAX} value={item} onChange={e => setItem(e.target.value)} /></label>
          <datalist id="rig-items">{rigItems.map(i => <option key={i} value={i} />)}</datalist>
          <label>Price ($)<input type="number" inputMode="decimal" min="0" step="0.01" value={price} onChange={e => setPrice(e.target.value)} placeholder="0 if unknown" /></label>
          <label>Status<select value={status} onChange={e => setStatus(e.target.value as RigStatus)}>{RIG_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}</select></label>
          <label>Vendor or link<input maxLength={200} value={vendor} onChange={e => setVendor(e.target.value)} /></label>
          <button className="secondary small" disabled={store.pending || !itemOk}>Save line</button>
        </form>
        {missingItems(lines).length > 0 && <p className="quiet">Not on the list yet: {missingItems(lines).map(i => <button key={i} type="button" className="secondary small" onClick={() => setItem(i)}>{i}</button>)}</p>}
      </>}
    </section>

    <section className="panel" aria-labelledby="deal-h">
      <header className="panel-head"><h2 id="deal-h">Trucks being weighed</h2></header>
      <div className="tablewrap"><table className="table">
        <caption className="sr-only">Candidate trucks</caption>
        <thead><tr><th scope="col">Truck</th><th scope="col">Price</th><th scope="col">Miles</th><th scope="col">Year</th><th scope="col">Inspection</th><th scope="col">Rating</th><th scope="col">Notes</th>{!readOnly && <th scope="col"><span className="sr-only">Remove</span></th>}</tr></thead>
        <tbody>{deals.map(x => <tr key={x.name}>
          <th scope="row">{safeUrl(x.url) ? <a href={safeUrl(x.url)!} target="_blank" rel="noopener noreferrer">{x.name}</a> : x.name}</th>
          <td>{money0(x.price)}</td><td>{x.miles === null ? '-' : x.miles.toLocaleString('en-US')}</td><td>{x.year ?? '-'}</td><td>{x.inspection}</td><td>{x.rating === null ? '-' : `${x.rating} / 5`}</td><td>{x.notes || '-'}</td>
          {!readOnly && <td><button type="button" className="secondary small" disabled={store.pending} onClick={() => log(`${DEAL_PREFIX}${x.name}`, 0, DROPPED)}>Remove</button></td>}
        </tr>)}</tbody>
      </table>{deals.length === 0 && <p className="quiet">No trucks listed. Add each one you are considering so the comparison is on the page, not in memory.</p>}</div>
      {!readOnly && (
        <form className="form-grid" onSubmit={e => {
          e.preventDefault(); if (!dealOk) return;
          const miles = num(d.miles), year = num(d.year), rating = num(d.rating);
          log(`${DEAL_PREFIX}${d.name.trim()}`, num(d.price)!, 'deal', encodeDeal({ miles, year, url: d.url.trim(), notes: d.notes.trim(), inspection: d.inspection, rating: rating !== null && rating >= 1 && rating <= 5 ? Math.round(rating) : null }),
            () => setD({ name: '', price: '', miles: '', year: '', url: '', notes: '', inspection: 'unknown', rating: '' }));
        }}>
          <label>Truck<input maxLength={NAME_MAX} value={d.name} onChange={e => setD({ ...d, name: e.target.value })} placeholder="2016 F-250, Racine" /></label>
          <label>Price ($)<input type="number" inputMode="decimal" min="0" value={d.price} onChange={e => setD({ ...d, price: e.target.value })} /></label>
          <label>Miles<input type="number" inputMode="numeric" min="0" value={d.miles} onChange={e => setD({ ...d, miles: e.target.value })} /></label>
          <label>Year<input type="number" inputMode="numeric" min="1980" max="2030" value={d.year} onChange={e => setD({ ...d, year: e.target.value })} /></label>
          <label>Listing link (https)<input maxLength={200} value={d.url} onChange={e => setD({ ...d, url: e.target.value })} /></label>
          <label>Inspection<select value={d.inspection} onChange={e => setD({ ...d, inspection: e.target.value as Inspection })}><option value="unknown">Not inspected</option><option value="passed">Passed</option><option value="failed">Failed</option></select></label>
          <label>Rating (1 to 5)<input type="number" min="1" max="5" step="1" value={d.rating} onChange={e => setD({ ...d, rating: e.target.value })} /></label>
          <label>Notes<input maxLength={160} value={d.notes} onChange={e => setD({ ...d, notes: e.target.value })} placeholder="Bed length, towing, rust, service records" /></label>
          <button className="secondary small" disabled={store.pending || !dealOk}>Save truck</button>
        </form>
      )}
    </section>

    <section className="panel" aria-labelledby="washer-h">
      <header className="panel-head"><h2 id="washer-h">Washer: repair, rent or replace</h2></header>
      <div className="kpis compact">
        <div><span>Repair quote</span><strong>{washer.repair === null ? '-' : money0(washer.repair)}</strong></div>
        <div><span>Rental so far</span><strong>{verdict.rentalSpent === null ? '-' : money0(verdict.rentalSpent)}</strong><small className="quiet">{washer.days === null ? 'Log the days' : `${washer.days} day${washer.days === 1 ? '' : 's'}${washer.perDay === null ? '' : ` at ${money0(washer.perDay)}`}`}</small></div>
        <div><span>Repair equals</span><strong>{verdict.breakEvenDays === null ? '-' : `${verdict.breakEvenDays} rental days`}</strong></div>
        <div><span>Replace price</span><strong>{washer.replace === null ? '-' : money0(washer.replace)}</strong><small className="quiet">{verdict.cheaper === 'repair' ? `Repair is ${money0(-verdict.savedByReplacing!)} cheaper` : verdict.cheaper === 'replace' ? `Replacing is ${money0(verdict.savedByReplacing!)} cheaper` : verdict.cheaper === 'same' ? 'Same cost' : 'Enter both to compare'}</small></div>
      </div>
      {!readOnly && (
        <form className="truck-form" onSubmit={e => {
          e.preventDefault();
          const rows: Array<[string, string, string]> = [[WASHER_REPAIR, w.repair, 'USD'], [WASHER_RENTAL_DAY, w.perDay, 'USD'], [WASHER_RENTAL_DAYS, w.days, 'days'], [WASHER_REPLACE, w.replace, 'USD']];
          const set = rows.filter(([, v]) => num(v) !== null);
          if (!set.length) return;
          // One entry per submit keeps each log call independent; the form clears once the last is sent.
          set.forEach(([label, v, unit], i) => log(label, num(v)!, unit, '', i === set.length - 1 ? () => setW({ repair: '', perDay: '', days: '', replace: '' }) : undefined));
        }}>
          <label>Repair quote ($)<input type="number" inputMode="decimal" min="0" step="0.01" value={w.repair} onChange={e => setW({ ...w, repair: e.target.value })} /></label>
          <label>Rental per day ($)<input type="number" inputMode="decimal" min="0" step="0.01" value={w.perDay} onChange={e => setW({ ...w, perDay: e.target.value })} /></label>
          <label>Days rented so far<input type="number" inputMode="numeric" min="0" step="1" value={w.days} onChange={e => setW({ ...w, days: e.target.value })} /></label>
          <label>Replacement price ($)<input type="number" inputMode="decimal" min="0" step="0.01" value={w.replace} onChange={e => setW({ ...w, replace: e.target.value })} /></label>
          <button className="secondary small" disabled={store.pending || [w.repair, w.perDay, w.days, w.replace].every(v => num(v) === null)}>Save</button>
        </form>
      )}
    </section>
  </>;
}
