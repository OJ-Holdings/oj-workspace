import { jobDate, type ExteriorData } from './exterior';
import { businessDay } from './reporting';

export type Forecast = {
  /** Quoted value of confirmed jobs in the window. Quotes, not money in yet. */
  booked: { jobs: number; quoted: number; unquoted: number };
  /** Open quotes weighted by how often quotes have turned into work; null until there are decided leads to learn it from. */
  pipeline: { quoted: number; winRate: number | null; expected: number | null };
  /** booked plus the weighted pipeline: what the next window is likely to bring in. Null when the pipeline cannot be weighted yet. */
  expected: number | null;
  /** Recorded revenue on jobs finished in the same number of days just gone, to compare against. */
  lastPeriodRevenue: number;
  days: number;
};

/** Leads that must be decided (won or closed) before the win rate is trusted. */
export const MIN_DECIDED = 5;
const addDays = (key: string, n: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/**
 * A plain forecast for the next `days` days (master plan 6.7 and 7.7), built only from what is on record: confirmed bookings at their quoted
 * price, plus the open pipeline weighted by the win rate (won over won plus closed, the same rate Command shows). No seasonality or recurring
 * plans yet. A job with no quote is counted but never valued at zero, and the pipeline is left unweighted rather than guessed until at least MIN_DECIDED leads have been decided.
 */
export function forecast(data: ExteriorData, today: string, days = 30): Forecast {
  const end = addDays(today, days), start = addDays(today, -days);
  const byId = new Map(data.leads.map(l => [l.id, l]));
  let jobs = 0, quoted = 0, unquoted = 0;
  for (const b of data.bookings) {
    if (b.status !== 'confirmed' || b.date < today || b.date >= end) continue;
    jobs += 1;
    const q = byId.get(b.lead_id ?? '')?.quote_amount;
    if (q === null || q === undefined) unquoted += 1; else quoted += q;
  }
  const open = data.leads.filter(l => (l.status === 'contacted' || l.status === 'following_up') && l.quote_amount !== null && l.quote_amount > 0);
  const pipeQuoted = open.reduce((t, l) => t + (l.quote_amount ?? 0), 0);
  const won = data.leads.filter(l => l.status === 'completed' || l.status === 'booked').length, lost = data.leads.filter(l => l.status === 'closed').length;
  // A win rate from a handful of leads is noise: weight the pipeline only once enough have been decided.
  const winRate = won + lost >= MIN_DECIDED ? won / (won + lost) : null;
  const expectedPipe = winRate === null ? null : Math.round(pipeQuoted * winRate);
  const last = data.leads.filter(l => l.status === 'completed' && l.job_revenue !== null).filter(l => { const d = businessDay(jobDate(l)); return !!d && d >= start && d < today; }).reduce((t, l) => t + (l.job_revenue ?? 0), 0);
  return { booked: { jobs, quoted, unquoted }, pipeline: { quoted: pipeQuoted, winRate, expected: expectedPipe }, expected: expectedPipe === null ? null : quoted + expectedPipe, lastPeriodRevenue: last, days };
}
