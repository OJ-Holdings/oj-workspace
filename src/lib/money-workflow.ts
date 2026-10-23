import type { FinanceEntry } from './dashboard';

/** Source-recorded and manually entered money must remain distinguishable. */
export const moneyWorkFocuses = ['all', 'in', 'out', 'manual', 'source'] as const;
export type MoneyWorkFocus = typeof moneyWorkFocuses[number];
export const moneyWorkLabels: Record<MoneyWorkFocus, string> = {
  all: 'All entries', in: 'Money in', out: 'Money out',
  manual: 'Entered manually', source: 'From connected records',
};
export const moneyWorkDetails: Record<MoneyWorkFocus, string> = {
  all: 'All loaded transactions in the selected business/date scope.',
  in: 'Recorded income, not necessarily bank-reconciled deposits.',
  out: 'Costs entered or supplied by a connected source; missing costs remain unknown.',
  manual: 'Entries added directly in ATLAS. Review before adding a duplicate of sourced work.',
  source: 'Entries derived from job/order records; source date is not always a verified settlement date.',
};
export function matchesMoneyWorkFocus(entry: FinanceEntry, focus: MoneyWorkFocus): boolean {
  if (focus === 'all') return true;
  if (focus === 'in') return entry.kind === 'revenue';
  if (focus === 'out') return entry.kind === 'cost';
  if (focus === 'manual') return !entry.auto;
  if (focus === 'source') return !!entry.auto;
  return false;
}
export function moneyWorkCounts(entries: readonly FinanceEntry[]): Record<MoneyWorkFocus, number> {
  return Object.fromEntries(moneyWorkFocuses.map(focus =>
    [focus, entries.filter(entry => matchesMoneyWorkFocus(entry, focus)).length]
  )) as Record<MoneyWorkFocus, number>;
}
export function sortMoneyWorkEntries<T extends FinanceEntry>(entries: readonly T[]): T[] {
  // Never sort by a guessed bank settlement date.
  return [...entries].sort((a,b)=>b.occurred_on.localeCompare(a.occurred_on)||a.id.localeCompare(b.id));
}
