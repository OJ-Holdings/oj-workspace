import { parseBlock } from './exterior-ops';
import { addDays } from './invoices';
import type { JobItem } from '@/app/workspace/exterior-actions';

export type TodayJobs = { today: JobItem[]; tomorrow: JobItem[]; later: JobItem[] };

const startOf = (j: JobItem) => parseBlock(j.time_block)?.start ?? 24 * 60;

/** Booked jobs grouped for the Today screen: today, tomorrow, and the rest of the next 7 days. Earliest first. Cancelled or denied jobs never appear. */
export function todayJobs(jobs: JobItem[], today: string): TodayJobs {
  const tomorrow = addDays(today, 1), horizon = addDays(today, 7);
  const live = jobs.filter(j => j.status !== 'cancelled' && j.status !== 'denied');
  const order = (a: JobItem, b: JobItem) => a.date.localeCompare(b.date) || startOf(a) - startOf(b) || a.id.localeCompare(b.id);
  return {
    today: live.filter(j => j.date === today).sort(order),
    tomorrow: live.filter(j => j.date === tomorrow).sort(order),
    later: live.filter(j => j.date > tomorrow && j.date <= horizon).sort(order),
  };
}
