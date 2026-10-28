'use client';

import { useState } from 'react';
import { Truck } from 'lucide-react';
import type { DashboardStore } from './useDashboard';
import { money } from '@/lib/metrics';
import { TRUCK_LABEL, truckFund } from '@/lib/truck-fund';

type Props = { store: DashboardStore; today: string; readOnly: boolean };

const day = (iso: string) => new Date(iso + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/**
 * Progress to the work-truck goal. The balance is whatever a founder last logged (from the Mercury truck-fund account), so it is
 * never invented; with nothing logged the card asks for the balance instead of showing a number.
 */
export function TruckFundCard({ store, today, readOnly }: Props) {
  const [value, setValue] = useState('');
  const fund = truckFund(store.data?.metricEntries ?? [], today || new Date().toISOString().slice(0, 10));
  const amount = Number(value);
  const valid = value.trim() !== '' && Number.isFinite(amount) && amount >= 0 && amount < 100_000_000;

  return (
    <section id="truck-fund" className="today-card truck-card" aria-labelledby="truck-h">
      <header><h2 id="truck-h"><Truck size={18} aria-hidden="true" /> Work truck fund</h2></header>
      {fund.known ? <>
        <p className="truck-figure"><strong>{money(fund.balance!)}</strong> <span>of {money(fund.goal)} by {day(fund.deadline)}</span></p>
        <progress className="upgrade-bar" value={fund.percent ?? 0} max={100} aria-label="Progress to the truck fund goal" />
        <p className="today-empty">
          {fund.remaining === 0
            ? 'Goal reached.'
            : `${money(fund.remaining!)} to go. About ${money(Math.ceil(fund.perWeekNeeded!))} a week (${money(Math.ceil(fund.perMonthNeeded!))} a month) to be ready in time.`}
          {fund.projectedDate && fund.remaining !== 0 ? ` At your logged pace you finish around ${day(fund.projectedDate)}${fund.onTrack ? ', on time.' : ', after the deadline.'}` : ''}
          {' '}Balance as of {day(fund.asOf!)}.
        </p>
      </> : <p className="today-empty">No balance logged yet. Enter what the truck fund account holds today and this card tracks the rest.</p>}
      {!readOnly && (
        <form className="truck-form" onSubmit={e => {
          e.preventDefault();
          if (!valid) return;
          store.addMetric({ venture: 'exterior', label: TRUCK_LABEL, value: amount, unit: 'USD', measured_on: today || new Date().toISOString().slice(0, 10), note: '' }, () => setValue(''));
        }}>
          <label>Today's balance<input type="number" inputMode="decimal" min="0" step="0.01" value={value} onChange={e => setValue(e.target.value)} placeholder="From Mercury" /></label>
          <button className="secondary small" disabled={store.pending || !valid}>Update</button>
        </form>
      )}
    </section>
  );
}
