import type { JobItem } from '@/app/workspace/exterior-actions';

export type AheadWeek = { label: string; jobs: number; quoted: number };
export type BookedAhead = { weeks: AheadWeek[]; jobs: number; quoted: number; unquoted: number };

const addDays = (key: string, n: number) => { const d = new Date(`${key}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Upcoming booked jobs in four weekly buckets from today, with what they were quoted at. Quotes are not money in; jobs with no quote are counted, never valued at zero. */
export function bookedAhead(jobs: JobItem[], today: string): BookedAhead {
  const labels = ['This week', 'Next week', 'In 2 weeks', 'In 3 weeks'];
  const weeks = labels.map(label => ({ label, jobs: 0, quoted: 0 }));
  let unquoted = 0;
  for (const j of jobs) {
    if (j.status === 'cancelled' || j.status === 'denied' || j.date < today || j.date >= addDays(today, 28)) continue;
    const w = weeks[Math.floor((Date.parse(`${j.date}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / (7 * 86_400_000))];
    w.jobs += 1;
    if (j.quote === null) unquoted += 1; else w.quoted += j.quote;
  }
  return { weeks, jobs: weeks.reduce((t, w) => t + w.jobs, 0), quoted: weeks.reduce((t, w) => t + w.quoted, 0), unquoted };
}
