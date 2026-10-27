import { jobDate, type ExtLead } from './exterior';
import { isRealPhone } from './exterior-ops';

const digits = (v: string | null) => (v ?? '').replace(/\D/g, '').slice(-10);

/**
 * Past customers worth contacting again: completed customers, one row each (the newest completed job wins; customers are the same
 * person by real phone number, else by exact name), whose latest job is at least `months` months old. Oldest service first.
 */
export function rebookCandidates(leads: ExtLead[], now: Date, months: number): ExtLead[] {
  const best = new Map<string, ExtLead>();
  for (const l of leads) {
    if (l.status !== 'completed') continue;
    const key = isRealPhone(l.phone) ? digits(l.phone) : (l.name ?? l.id).trim().toLowerCase();
    const cur = best.get(key);
    if (!cur || jobDate(l) > jobDate(cur)) best.set(key, l);
  }
  const cutoff = new Date(now); cutoff.setMonth(cutoff.getMonth() - months);
  return [...best.values()].filter(l => new Date(jobDate(l)) <= cutoff).sort((a, b) => jobDate(a).localeCompare(jobDate(b)));
}
