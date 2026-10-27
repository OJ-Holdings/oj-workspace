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

/**
 * One spreadsheet-safe cell. Customer names and addresses can come from the public website form, so a value like =HYPERLINK(...) must
 * never run as a formula when the list is pasted into Excel or Sheets, and tabs or line breaks must not shift columns.
 */
export const tsvCell = (raw: string | number | null | undefined): string => {
  let text = String(raw ?? '').replace(/[\u0000\t\r\n]+/g, ' ').trim();
  const plainPhone = /^\+?\d[\d\s().-]*$/.test(text); // a phone number or a plain amount cannot run as a formula
  if (!plainPhone && /^[\s﻿]*[=+\-@]/.test(text)) text = `'${text}`;
  return text;
};

export function rebookTsv(rows: ExtLead[]): string {
  const header = ['Name', 'Phone', 'Address', 'Last service', 'Last job date', 'Last job revenue'];
  const body = rows.map(l => [l.name, isRealPhone(l.phone) ? l.phone : '', l.address, l.service_requested, jobDate(l).slice(0, 10), l.job_revenue].map(tsvCell).join('\t'));
  return [header.join('\t'), ...body].join('\n');
}
