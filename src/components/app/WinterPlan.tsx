'use client';

import Link from 'next/link';
import { Snowflake } from 'lucide-react';
import type { ExteriorData } from '@/lib/exterior';
import { REBOOK_SHARE, seasonFor, winterPlan } from '@/lib/season';
import { truckFund } from '@/lib/truck-fund';
import type { MetricEntry } from '@/lib/dashboard';
import { dollars } from '@/lib/metrics';

/**
 * Off-season Command (master plan 11b): from November to March the work shifts from running jobs to lining up spring. Three rows, all from the
 * records: past customers to rebook, the truck fund against its date, and the quotes still open. Shown only in the off-season.
 */
export function WinterPlan({ data, today, nowMs, metrics, base }: { data: ExteriorData; today: string; nowMs: number; metrics: MetricEntry[]; base: string }) {
  if (seasonFor(today) !== 'off-season') return null;
  const fund = truckFund(metrics, today);
  const w = winterPlan(data, nowMs, fund);
  return (
    <section className="today-card winter" aria-labelledby="today-winter">
      <header><h2 id="today-winter"><Snowflake size={16} aria-hidden="true" /> Winter plan</h2></header>
      <ul className="winter-rows">
        <li>
          <b>Spring rebooking</b>
          <span>{w.rebook.customers === 0 ? 'No finished jobs to rebook from yet.' : <>{w.rebook.customers} past customer{w.rebook.customers === 1 ? '' : 's'} to call{w.rebook.ifQuarterRebook !== null ? `. If ${Math.round(REBOOK_SHARE * 100)}% rebook at your ${dollars(Math.round(w.rebook.avgJob ?? 0))} average job, that is ${dollars(w.rebook.ifQuarterRebook)}.` : '.'}</>}</span>
          <Link href={`${base}/growth`}>Open the list</Link>
        </li>
        <li>
          <b>Truck fund</b>
          <span>{w.truck.known && w.truck.balance !== null ? `${dollars(w.truck.balance)} of ${dollars(w.truck.goal)}${w.truck.perWeekNeeded ? `. ${dollars(Math.round(w.truck.perWeekNeeded))} a week reaches it by the date.` : '.'}` : 'No balance logged yet.'}</span>
          <a href="#truck-fund">{w.truck.known ? 'Update' : 'Log it'}</a>
        </li>
        <li>
          <b>Open quotes</b>
          <span>{w.openQuotes.count === 0 ? 'None waiting.' : `${w.openQuotes.count} worth ${dollars(w.openQuotes.value)} still need an answer.`}</span>
          <Link href={`${base}/growth`}>Follow up</Link>
        </li>
      </ul>
    </section>
  );
}
