import type { FinanceEntry, MercurySnapshot, MercuryTransaction } from './dashboard';

/**
 * Candidate discovery ONLY; it never assigns, books, posts or reconciles.
 * Mercury's raw sign/kind/status semantics are not sufficient to determine
 * whether an entry represents revenue, expense, transfer, reversal or payout.
 */
export type BankCandidate = {
  id: string;
  venture: FinanceEntry['venture'];
  kind: FinanceEntry['kind'];
  amount: number;
  recordedDate: string;
  category: string;
  dateBasis: FinanceEntry['dateBasis'] | null;
  dayDistance: number;
};
export type BankReviewRow = {
  id: string;
  description: string;
  accountName: string;
  signedAmount: number;
  currency: string;
  status: string;
  kind: string;
  bankDay: string | null;
  daySource: 'postedAt' | 'createdAt' | 'unavailable';
  candidates: BankCandidate[];
  limitation: string | null;
};
export type BankReviewResult = {
  state: MercurySnapshot['state'] | 'not-provided';
  checkedAt: string | null;
  detail: string;
  rows: BankReviewRow[];
  /** The API only supplies the most recent limited page of transactions. */
  scopeNote: string;
};

const isExactDay = (day: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const parsed = new Date(`${day}T12:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === day;
};
const roundCents = (amount: number): number | null =>
  Number.isFinite(amount) && Number.isSafeInteger(Math.round(amount*100))
    ? Math.round(amount*100) : null;
const dateUTC = (day: string): number => new Date(`${day}T12:00:00.000Z`).getTime();
function chicagoDay(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return null;
  const fields = new Intl.DateTimeFormat('en-US', {timeZone:'America/Chicago', year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);
  const part = (type: string) => fields.find(f=>f.type===type)?.value;
  const day = `${part('year')}-${part('month')}-${part('day')}`;
  return isExactDay(day) ? day : null;
}
export function candidateBankDay(row: Pick<MercuryTransaction,'postedAt'|'createdAt'>): {day: string | null; source: BankReviewRow['daySource']} {
  const posted = chicagoDay(row.postedAt);
  if (posted) return {day:posted,source:'postedAt'};
  const created = chicagoDay(row.createdAt);
  if (created) return {day:created,source:'createdAt'};
  return {day:null,source:'unavailable'};
}
export function bankReviewCandidates(
  bankRow: MercuryTransaction,
  entries: readonly FinanceEntry[],
  maxDays = 4,
): BankCandidate[] {
  if (!Number.isSafeInteger(maxDays) || maxDays < 0 || maxDays > 30) throw new Error('Invalid comparison window.');
  if (bankRow.currency !== 'USD') return [];
  const signedCents = roundCents(bankRow.amount);
  if (signedCents === null || signedCents === 0) return [];
  const bankDate = candidateBankDay(bankRow).day;
  if (!bankDate) return [];
  const goal = Math.abs(signedCents);
  return entries.flatMap((entry): BankCandidate[] => {
    // Workspace finance entries are USD operational amounts, not a chart-of-accounts journal.
    const amount = roundCents(entry.amount);
    if (amount === null || amount <= 0 || amount !== goal || !isExactDay(entry.occurred_on)) return [];
    const dayDistance = Math.abs(Math.round((dateUTC(bankDate)-dateUTC(entry.occurred_on))/86_400_000));
    if (dayDistance > maxDays) return [];
    return [{
      id:entry.id,venture:entry.venture,kind:entry.kind,amount:entry.amount,recordedDate:entry.occurred_on,
      category:entry.category.trim() || 'Uncategorized',dateBasis:entry.dateBasis ?? null,dayDistance,
    }];
  }).sort((a,b)=>a.dayDistance-b.dayDistance || a.recordedDate.localeCompare(b.recordedDate) || a.id.localeCompare(b.id));
}
export function bankReviewSnapshot(
  bank: MercurySnapshot | null | undefined,
  entries: readonly FinanceEntry[],
  month: string | null = null,
): BankReviewResult {
  if (month !== null && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid requested month.');
  const scopeNote = 'Review-only comparison of the latest bank transactions returned by Mercury (currently capped at 50), not a complete bank statement or a reconciliation. Equal amounts and nearby dates are suggestions, never verified matches.';
  if (!bank) return {state:'not-provided',checkedAt:null,detail:'No authorized bank source available.',rows:[],scopeNote};
  if (bank.state !== 'available') return {state:bank.state,checkedAt:bank.checkedAt,detail:bank.detail,rows:[],scopeNote};
  const rows = bank.transactions
    .filter(t=>{
      const {day}=candidateBankDay(t);
      return !month || (day !== null && day.startsWith(month));
    })
    .map((t): BankReviewRow=>{
      const {day,source}=candidateBankDay(t);
      const cents=roundCents(t.amount);
      const limitation = t.currency !== 'USD' ? 'Currency is not USD; no amount comparison made.' :
        cents===null || cents===0 ? 'No valid nonzero amount for comparison.' :
        source==='unavailable' ? 'No valid transaction date for comparison.' :
        source==='createdAt' ? 'Only bank creation date available; not confirmed posting date.' : null;
      return {
        id:t.id, description:t.description,accountName:t.accountName,signedAmount:t.amount,
        currency:t.currency,status:t.status,kind:t.kind,bankDay:day,daySource:source,
        candidates:bankReviewCandidates(t,entries),
        limitation,
      };
    });
  return {state:bank.state,checkedAt:bank.checkedAt,detail:bank.detail,rows,scopeNote};
}
