import type { FinanceEntry } from './dashboard';

/**
 * Accountant-review CSV, not a balance sheet, tax return, verified bank
 * statement or general ledger. Exports only rows already scoped to the user.
 */
const safeCell = (raw: string | number): string => {
  let text = String(raw).replace(/\u0000/g,'');
  // Stop CSV formula execution in common spreadsheet tools, even after whitespace.
  if (/^[\s\uFEFF]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g,'""')}"`;
};
const row = (parts: readonly (string|number)[]) => parts.map(safeCell).join(',');
const headings=[
  'Record ID','Venture reporting segment','Recorded date','Money direction',
  'Amount USD','Entered category','Entered note','Row provenance',
  'Imported source name','Date basis','Bank reconciliation','Posting status',
] as const;
const validAmount = (amount: number) => typeof amount === 'number' && Number.isFinite(amount) && amount >= 0 && Math.round(amount*100) <= Number.MAX_SAFE_INTEGER;
const validDate = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date);
export function accountingReviewCsv(entries: readonly FinanceEntry[]): string {
  // Caller must scope rows using their existing organization and view permissions.
  const lines = [row(headings)];
  for (const entry of entries) {
    if (!validAmount(entry.amount) || !validDate(entry.occurred_on))
      throw new Error('Cannot export an entry with an invalid amount or recorded date.');
    lines.push(row([
      entry.id,entry.venture,entry.occurred_on,entry.kind==='revenue'?'recorded-in':'recorded-out',
      (Math.round(entry.amount*100)/100).toFixed(2),entry.category,entry.note,
      entry.auto?'source-derived':'manual-entry',entry.auto||'',
      entry.dateBasis||'not-verified','not-verified','not-posted-to-general-ledger',
    ]));
  }
  return '\uFEFF'+lines.join('\r\n')+'\r\n';
}
export function accountingReviewFilename(month: string | null): string {
  if (month !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid period.');
  return `atlas-accounting-review-${month ?? 'loaded-history'}.csv`;
}
