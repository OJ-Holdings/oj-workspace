import { slotTaken } from './exterior-ops';

export type Frequency = 'once' | 'monthly' | 'quarterly' | 'semiannual';
export const frequencyLabel: Record<Frequency, string> = { once: 'One time', monthly: 'Every month', quarterly: 'Every 3 months', semiannual: 'Every 6 months' };
const STEP: Record<Frequency, number> = { once: 0, monthly: 1, quarterly: 3, semiannual: 6 };

export const MAX_VISITS = 12;
export const MAX_DAYS_PER_VISIT = 5;

export type VisitDay = { visit: number; date: string };

const parse = (key: string) => new Date(`${key}T12:00:00Z`);
const iso = (d: Date) => d.toISOString().slice(0, 10);
const isSunday = (d: Date) => d.getUTCDay() === 0;
const nextWorkDay = (d: Date) => { const x = new Date(d); if (isSunday(x)) x.setUTCDate(x.getUTCDate() + 1); return x; };

/** Adds whole months and keeps the day of the month where there is one, else the last day (Jan 31 plus a month is Feb 28). */
export function addMonths(key: string, months: number): string {
  const d = parse(key), day = d.getUTCDate();
  const out = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, 1, 12));
  const last = new Date(Date.UTC(out.getUTCFullYear(), out.getUTCMonth() + 1, 0, 12)).getUTCDate();
  out.setUTCDate(Math.min(day, last));
  return iso(out);
}

/**
 * Every booking day for a commercial client. Each visit starts on its date (a visit that would start on a Sunday starts on the Monday) and, for a big
 * building, runs for `daysPerVisit` consecutive working days (Sundays skipped). A one-time job is a single visit whatever `visits` says.
 * Each visit becomes its own job record, so revenue and costs are tracked per visit.
 */
export function planVisits(firstDate: string, frequency: Frequency, visits: number, daysPerVisit: number): VisitDay[] {
  const count = frequency === 'once' ? 1 : Math.min(MAX_VISITS, Math.max(1, Math.floor(visits)));
  const span = Math.min(MAX_DAYS_PER_VISIT, Math.max(1, Math.floor(daysPerVisit)));
  const out: VisitDay[] = [];
  for (let v = 0; v < count; v += 1) {
    let day = nextWorkDay(parse(addMonths(firstDate, v * STEP[frequency])));
    for (let i = 0; i < span; i += 1) {
      out.push({ visit: v + 1, date: iso(day) });
      day = nextWorkDay(new Date(day.getTime() + 86_400_000));
    }
  }
  return out;
}

export type Clash = { date: string; reason: 'past' | 'taken' };

/** Days in the plan that cannot be booked: already past, or the time block overlaps a job already on the calendar that day. Nothing is booked unless this is empty. */
export function planClashes(plan: VisitDay[], block: string, bookings: { id: string; date: string; time_block: string | null; status: string | null }[], today: string): Clash[] {
  return plan.flatMap((d): Clash[] => d.date < today ? [{ date: d.date, reason: 'past' }] : slotTaken(bookings, d.date, block) ? [{ date: d.date, reason: 'taken' }] : []);
}
