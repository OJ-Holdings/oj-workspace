/**
 * ATLAS Accounting v0: deterministic, side-effect-free journal validation.
 * DO NOT map legacy "money in/out" rows into posted accounts automatically.
 * No persistence, tax conclusions, bank settlement, payments, or migration.
 */
export type AccountingClass = 'asset' | 'liability' | 'equity' | 'income' | 'expense';
export type LedgerAccount = {
  id: string; entityId: string; code: string; name: string; class: AccountingClass;
  currency: 'USD'; active: boolean;
};
export type JournalLine = { accountId: string; debitCents: number; creditCents: number; costCenter?: string };
export type JournalDraft = {
  id: string; entityId: string; date: string; sourceId: string;
  memo: string; currency: 'USD'; lines: readonly JournalLine[];
  /** Founder-approved actor ID, NOT inferred from provider source. */
  approvedBy: string | null;
};
export type JournalReview = { valid: boolean; reasons: string[]; debitsCents: number; creditsCents: number };
export type TrialBalanceRow = { accountId: string; code: string; name: string; class: AccountingClass; debitCents: number; creditCents: number };
export type TrialBalance = { rows: TrialBalanceRow[]; balanced: boolean; totalDebitsCents: number; totalCreditsCents: number };
const cents = (n: number) => Number.isSafeInteger(n) && n >= 0;
/** Strict ISO date (including invalid calendar days) and deterministic year range. */
function validDay(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const time = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(time.getTime()) && time.toISOString().slice(0, 10) === date;
}
export function reviewJournal(
  journal: JournalDraft,
  accounts: readonly LedgerAccount[],
  lockedThrough: string | null = null,
): JournalReview {
  const reasons: string[] = [];
  if (!journal.id.trim() || !journal.entityId.trim() || !journal.sourceId.trim()) reasons.push('Journal, entity and source identities are required.');
  if (!validDay(journal.date)) reasons.push('An actual ISO calendar date is required.');
  if (lockedThrough && validDay(journal.date) && journal.date <= lockedThrough) reasons.push('Accounting period is locked.');
  if (journal.currency !== 'USD') reasons.push('Only USD journals are supported.');
  if (journal.approvedBy === null || !journal.approvedBy.trim()) reasons.push('Explicit approver required before posting.');
  if (journal.lines.length < 2) reasons.push('At least two separate account lines are required.');
  const mapping = new Map(accounts.map(a => [a.id,a]));
  let debit = 0, credit = 0;
  for (const [i,line] of journal.lines.entries()) {
    const prefix = `Line ${i+1}: `;
    const account = mapping.get(line.accountId);
    if (!account) reasons.push(prefix + 'Account does not exist.');
    else {
      if (!account.active) reasons.push(prefix + 'Account is inactive.');
      if (account.entityId !== journal.entityId) reasons.push(prefix + 'Account belongs to another legal entity.');
      if (account.currency !== journal.currency) reasons.push(prefix + 'Currency mismatch.');
    }
    if (!cents(line.debitCents) || !cents(line.creditCents)) {
      reasons.push(prefix + 'Amounts must be nonnegative integer cents.');
      continue;
    }
    if ((line.debitCents > 0) === (line.creditCents > 0))
      reasons.push(prefix + 'Use a debit OR a credit, not both or neither.');
    debit += line.debitCents;
    credit += line.creditCents;
    if (!Number.isSafeInteger(debit) || !Number.isSafeInteger(credit))
      reasons.push('Aggregate amount exceeds safe integer range.');
  }
  if (debit===0 || debit!==credit) reasons.push('Total debits must equal nonzero total credits.');
  return {valid:reasons.length===0,reasons,debitsCents:debit,creditsCents:credit};
}
/**
 * An in-memory trial balance of reviewed posted journals. The caller must supply
 * actual authoritative postings, never guessed balancing counterparts for old rows.
 */
export function trialBalance(accounts: readonly LedgerAccount[], journals: readonly JournalDraft[]): TrialBalance {
  const numbers = new Map<string,number>(accounts.map(a=>[a.id,0]));
  for (const journal of journals) {
    const review = reviewJournal(journal,accounts);
    if (!review.valid) throw new Error(`Invalid journal ${journal.id}: ${review.reasons.join(' | ')}`);
    for (const line of journal.lines) numbers.set(line.accountId,(numbers.get(line.accountId) ?? 0)+line.debitCents-line.creditCents);
  }
  const rows = accounts.filter(a=>numbers.get(a.id)!==0).map(a=>{
    const amount=numbers.get(a.id) ?? 0;
    return {accountId:a.id,code:a.code,name:a.name,class:a.class,
      debitCents:Math.max(0,amount),creditCents:Math.max(0,-amount)};
  }).sort((a,b)=>a.code.localeCompare(b.code)||a.accountId.localeCompare(b.accountId));
  const debits=rows.reduce((sum,r)=>sum+r.debitCents,0);
  const credits=rows.reduce((sum,r)=>sum+r.creditCents,0);
  if (!Number.isSafeInteger(debits) || !Number.isSafeInteger(credits)) throw new Error('Unsafe trial balance total.');
  return {rows,balanced:debits===credits,totalDebitsCents:debits,totalCreditsCents:credits};
}
