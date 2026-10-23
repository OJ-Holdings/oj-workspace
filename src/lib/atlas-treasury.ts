import type { Dashboard, FinanceEntry, ReportingCoverage, MercurySnapshot } from './dashboard';
import type { VentureId } from './ventures';

/** Finance entries are operational records, NOT a double-entry general ledger or settled bank cash. */
export type TreasuryTotal = { amount: number | null; basis: string };
export type TreasuryGroup = { label: string; amount: number; share: number };
export type TreasuryVenture = { id: VentureId; inflow: number | null; outflow: number | null; difference: number | null };
export type TreasuryAttention = { id: string; title: string; detail: string; severity: 'review' | 'blocked' };
export type TreasurySnapshot = {
  period: string;
  inflow: number | null;
  outflow: number | null;
  difference: number | null;
  priorInflow: number | null;
  priorOutflow: number | null;
  expenseGroups: TreasuryGroup[];
  revenueGroups: TreasuryGroup[];
  ventures: TreasuryVenture[];
  bank: { state: MercurySnapshot['state'] | 'restricted'; amount: number | null; currency: 'USD'; accounts: number; checkedAt: string | null; detail: string };
  attention: TreasuryAttention[];
  eligibleStatement: false;
  coverageNote: string;
};
const valid = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0;
const total = (rows: readonly FinanceEntry[], kind: 'revenue' | 'cost'): number | null => {
  const found = rows.filter(r => r.kind === kind && valid(r.amount));
  return found.length ? Math.round(found.reduce((s,r) => s + Math.round(r.amount * 100),0))/100 : null;
};
function categories(rows: readonly FinanceEntry[], kind: 'revenue' | 'cost'): TreasuryGroup[] {
  const groups = new Map<string,number>();
  for (const r of rows) {
    if (r.kind !== kind || !valid(r.amount)) continue;
    const key = r.category.trim() || 'Uncategorized';
    groups.set(key, (groups.get(key) ?? 0) + Math.round(r.amount * 100));
  }
  const grand = [...groups.values()].reduce((a,b)=>a+b,0);
  return [...groups].map(([label,cents])=>({label,amount:cents/100,share:grand ? cents/grand : 0}))
    .sort((a,b)=>b.amount-a.amount || a.label.localeCompare(b.label));
}
export function previousMonth(month: string): string {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Invalid month');
  const [year, number] = month.split('-').map(Number);
  return number === 1 ? `${year-1}-12` : `${year}-${String(number-1).padStart(2,'0')}`;
}
function bankSnapshot(bank: MercurySnapshot | undefined, owner: boolean): TreasurySnapshot['bank'] {
  if (!owner) return {state:'restricted',amount:null,currency:'USD',accounts:0,checkedAt:null,detail:'Bank data is restricted to its authorized owner.'};
  if (!bank) return {state:'not-connected',amount:null,currency:'USD',accounts:0,checkedAt:null,detail:'No authorized Mercury snapshot is loaded.'};
  const amounts = bank.accounts.map(a=>a.currentBalance);
  const allUSD = bank.accounts.every(a=>a.currency==='USD');
  const validBalances = amounts.every(a=>typeof a==='number'&&Number.isFinite(a));
  const canSum = bank.state==='available' && bank.accounts.length > 0 && allUSD && validBalances;
  return {
    state:bank.state,amount:canSum ? Math.round(amounts.reduce<number>((sum,n)=>sum+(n as number),0)*100)/100:null,
    currency:'USD',accounts:bank.accounts.length,checkedAt:bank.checkedAt || null,
    detail:canSum ? 'Linked Mercury USD current balances only; not total company cash. Balances are not ledger income.' :
      !allUSD ? 'Mixed currencies cannot be summed as USD.' :
      bank.state!=='available' ? 'Bank connection is not fully available; cash total withheld.' :
      'Missing account balances; cash total withheld.',
  };
}
/**
 * Read-only evidence from permitted sources. Never manufactures AR/AP, bank
 * settlement, profitability, taxes, accounting classification, or a general ledger.
 */
export function treasurySnapshot(
  dashboard: Pick<Dashboard,'finance'|'reporting'|'mercury'>,
  period: string,
  ventures: readonly VentureId[],
  owner: boolean,
): TreasurySnapshot {
  const before = previousMonth(period);
  const scoped = dashboard.finance.filter(r => ventures.includes(r.venture) && valid(r.amount));
  const month = scoped.filter(r=>r.occurred_on.startsWith(period));
  const last = scoped.filter(r=>r.occurred_on.startsWith(before));
  const inflow = total(month,'revenue');
  const outflow = total(month,'cost');
  const difference = inflow === null || outflow === null ? null : Math.round((inflow-outflow)*100)/100;
  const byVenture = ventures.map(id=>{
    const rows = month.filter(r=>r.venture===id);
    const incoming = total(rows,'revenue'), outgoing = total(rows,'cost');
    return {id,inflow:incoming,outflow:outgoing,difference:incoming===null || outgoing===null ? null : Math.round((incoming-outgoing)*100)/100};
  });
  const issues: TreasuryAttention[] = [];
  const reporting: ReportingCoverage | undefined = dashboard.reporting;
  if (!reporting) issues.push({id:'coverage',title:'Financial source coverage unavailable',detail:'Connected source completeness cannot be verified for this view.',severity:'blocked'});
  for (const source of reporting?.sources ?? []) {
    if (source.state !== 'available') issues.push({id:`source-${source.id}`,title:`${source.label}: ${source.state}`,detail:source.detail,severity:'review'});
  }
  if (ventures.includes('exterior') && reporting?.exterior?.jobs) {
    const exterior = reporting.exterior;
    if (exterior.costJobs < exterior.jobs)
      issues.push({id:'job-costs',title:'Exterior job costs need review',detail:`${exterior.jobs-exterior.costJobs} completed source jobs have no recorded job cost (all loaded history).`,severity:'review'});
    if (exterior.revenueJobs < exterior.jobs)
      issues.push({id:'job-payments',title:'Exterior job payments need review',detail:`${exterior.jobs-exterior.revenueJobs} completed source jobs have no recorded payment amount (all loaded history).`,severity:'review'});
  }
  if (month.some(r=>r.dateBasis && r.dateBasis!=='completion'))
    issues.push({id:'estimated-dates',title:'Some dates are estimated',detail:'Imported records may use job updates or order creation, not payment settlement dates.',severity:'review'});
  if (outflow === null) issues.push({id:'no-costs',title:'No costs recorded for this period',detail:'This does not mean operating costs are zero; a net figure is withheld.',severity:'review'});
  if (inflow === null) issues.push({id:'no-inflows',title:'No inflows recorded for this period',detail:'This does not establish that no money was collected.',severity:'review'});
  const bank = bankSnapshot(dashboard.mercury,owner);
  if (owner && bank.amount===null)
    issues.push({id:'bank-evidence',title:'Bank cash not independently verified',detail:bank.detail,severity:'review'});
  return {
    period,inflow,outflow,difference,
    priorInflow:total(last,'revenue'),priorOutflow:total(last,'cost'),
    expenseGroups:categories(month,'cost'),revenueGroups:categories(month,'revenue'),
    ventures:byVenture,bank,attention:issues,eligibleStatement:false,
    coverageNote:'Operating-entry snapshot only. Not reconciled P&L, tax result, accounts receivable, accounts payable, or consolidated cash.',
  };
}
