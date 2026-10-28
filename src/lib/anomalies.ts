import type { ExteriorData, ExtLead } from './exterior';

export type Anomaly = { id: string; kind: 'loss' | 'paid-vs-quote' | 'underpriced'; text: string; lead: ExtLead };

const usd = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const median = (values: number[]) => { const s = [...values].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/** A service needs this many priced quotes before "the usual price" means anything. */
export const MIN_QUOTES = 5;
const LOW = 0.6, PAID_LOW = 0.5, PAID_HIGH = 1.5;

/**
 * Things in the records that look off, for a person to check (master plan 6.15, the anomaly radar). Three rules, each from the data alone:
 * a finished job whose costs were more than it brought in; a finished job paid far above or below its quote (usually a typo); and an open or
 * booked quote well under the usual price for that service. A flag is a question, not a verdict, and says so in plain words.
 */
export function anomalies(data: ExteriorData): Anomaly[] {
  const out: Anomaly[] = [];
  const bucket = (l: ExtLead) => (l.service_requested ?? '').trim().toLowerCase();
  const prices = new Map<string, number[]>();
  for (const l of data.leads) if (bucket(l) && l.quote_amount !== null && l.quote_amount > 0) prices.set(bucket(l), [...(prices.get(bucket(l)) ?? []), l.quote_amount]);

  for (const l of data.leads) {
    const name = l.name || 'A customer';
    if (l.status === 'completed' && l.job_revenue !== null && l.job_cost !== null && l.job_cost > l.job_revenue) {
      out.push({ id: `loss-${l.id}`, kind: 'loss', lead: l, text: `${name}: costs of ${usd(l.job_cost)} were more than the ${usd(l.job_revenue)} it brought in.` });
    }
    if (l.status === 'completed' && l.job_revenue !== null && l.quote_amount !== null && l.quote_amount > 0 && (l.job_revenue < l.quote_amount * PAID_LOW || l.job_revenue > l.quote_amount * PAID_HIGH)) {
      out.push({ id: `paid-${l.id}`, kind: 'paid-vs-quote', lead: l, text: `${name}: ${usd(l.job_revenue)} recorded on a ${usd(l.quote_amount)} quote. Check the figure.` });
    }
    const usual = prices.get(bucket(l));
    if (['new', 'contacted', 'following_up', 'booked'].includes(l.status ?? '') && usual && usual.length >= MIN_QUOTES && l.quote_amount !== null && l.quote_amount > 0) {
      const m = median(usual);
      if (l.quote_amount < m * LOW) out.push({ id: `low-${l.id}`, kind: 'underpriced', lead: l, text: `${name}: ${usd(l.quote_amount)} for ${(l.service_requested ?? '').trim()}, where the usual quote is about ${usd(m)}.` });
    }
  }
  const rank = { loss: 0, 'paid-vs-quote': 1, underpriced: 2 } as const;
  return out.sort((a, b) => rank[a.kind] - rank[b.kind]);
}
