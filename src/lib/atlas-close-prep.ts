import type { Dashboard, FinanceEntry } from './dashboard';
import type { VentureId } from './ventures';
import { treasurySnapshot } from './atlas-treasury';

/** Bookkeeping preparation ONLY. This does not close an accounting period. */
export type ClosePrepIssue = {
  id: string;
  title: string;
  detail: string;
  kind: 'fix-record' | 'source-review' | 'missing-infrastructure';
  entryId?: string;
};
export type ClosePrep = {
  month: string;
  ventures: readonly VentureId[];
  recordedIn: number | null;
  recordedOut: number | null;
  sourceStates: {name: string; state: string; note: string}[];
  actionable: ClosePrepIssue[];
  blockers: ClosePrepIssue[];
  canClose: false;
  sourceNote: string;
};
const validMoney = (n: number) => Number.isFinite(n) && n >= 0;
const scopedRows = (rows: readonly FinanceEntry[],month:string,ventures:readonly VentureId[]) =>
  rows.filter(r=>ventures.includes(r.venture)&&r.occurred_on.startsWith(month));
export function buildClosePrep(
  dashboard: Pick<Dashboard,'finance'|'reporting'|'mercury'>,
  month: string,
  ventures: readonly VentureId[],
  owner: boolean,
): ClosePrep {
  const totals = treasurySnapshot(dashboard,month,ventures,owner);
  const rows = scopedRows(dashboard.finance,month,ventures);
  const actionable:ClosePrepIssue[]=[];
  for (const r of rows) {
    if (!validMoney(r.amount)){
      actionable.push({id:`amount-${r.id}`,kind:'fix-record',entryId:r.id,title:'Review an invalid amount',detail:'A source amount is not a valid nonnegative figure; no totals can be trusted until corrected.'});
      continue;
    }
    if (!r.category.trim() || r.category.trim().toLowerCase()==='uncategorized')
      actionable.push({id:`category-${r.id}`,kind:'fix-record',entryId:r.id,title:'Classify an unassigned category',detail:`Entry dated ${r.occurred_on} has no meaningful category. The suggested treatment is not a tax deduction or posted chart-of-accounts mapping.`});
    if (r.dateBasis && r.dateBasis!=='completion')
      actionable.push({id:`date-${r.id}`,kind:'source-review',entryId:r.id,title:'Verify an estimated source date',detail:`Entry dated ${r.occurred_on} uses ${r.dateBasis.replaceAll('-',' ')}; bank settlement and work completion dates may differ.`});
  }
  if (totals.inflow===null)
    actionable.push({id:'missing-revenue',kind:'source-review',title:'Verify receipts for this period',detail:'No incoming money was recorded in this selected period. This is not evidence of zero collections.'});
  if (totals.outflow===null)
    actionable.push({id:'missing-costs',kind:'source-review',title:'Verify expenses for this period',detail:'No outgoing money was recorded in this selected period. This is not evidence of zero costs.'});
  if (dashboard.reporting) {
    for(const source of dashboard.reporting.sources){
      if(source.state!=='available'){
        actionable.push({id:`source-${source.id}`,kind:'source-review',title:`Check ${source.label} coverage`,detail:`${source.state}: ${source.detail}`});
      }
    }
  }else{
    actionable.push({id:'missing-source-status',kind:'source-review',title:'Source coverage not loaded',detail:'Cannot confirm which upstream services were included in this review.'});
  }
  const blockers:ClosePrepIssue[]=[
    {id:'journal',kind:'missing-infrastructure',title:'Approved double-entry journal unavailable',detail:'Existing workspace money entries have not been classified, approved or posted into immutable balanced accounting records.'},
    {id:'bank',kind:'missing-infrastructure',title:'Statement-level bank reconciliation unavailable',detail:owner ?
      'A Mercury recent-activity snapshot is not a complete bank statement. Statement balances, missing pages, approved matches and reconciliation receipts are not stored.' :
      'Bank information is owner-restricted. Statement-level reconciliation must be completed in an authorized accounting workflow.'},
    {id:'documents',kind:'missing-infrastructure',title:'Receipts and tax documentation not linked',detail:'Finance rows do not yet provide receipt-level attachment identities, tax-basis adjustments or business-use verification.'},
    {id:'obligations',kind:'missing-infrastructure',title:'Invoices, bills and founder equity not closed',detail:'Receivables, payables, distributions, contributions and asset treatment cannot be established from the current operational entries.'},
  ];
  return {
    month,ventures:[...ventures],recordedIn:totals.inflow,recordedOut:totals.outflow,
    sourceStates:(dashboard.reporting?.sources ?? []).map(s=>({name:s.label,state:s.state,note:s.detail})),
    actionable,blockers,canClose:false,
    sourceNote:'Preparation packet from authorized operational records only. No verified bank reconciliation, posted ledger, accountant approval, tax return or final financial statements.',
  };
}
const printableMoney = (n:number|null) => n === null ? 'Unknown' : `USD ${n.toFixed(2)} (recorded, unverified)`;
/** Review-only plain text: deterministic, explicitly non-final, no bank/account IDs. */
export function closePrepBrief(prep:ClosePrep, generatedAt:string):string {
  const lines=[
    'ATLAS ACCOUNTING - MONTH-END PREPARATION (NOT A FINAL CLOSE)',
    `Period: ${prep.month}`,
    `Reporting segments: ${prep.ventures.join(', ') || 'none'}`,
    `Prepared at: ${generatedAt}`,
    `Recorded money in: ${printableMoney(prep.recordedIn)}`,
    `Recorded money out: ${printableMoney(prep.recordedOut)}`,
    '',
    'PRIORITY REVIEW',
    ...(prep.actionable.length?prep.actionable.map(x=>`- ${x.title}: ${x.detail}`):['- No record-specific exceptions detected in loaded scope; this does not mean books are complete.']),
    '',
    'MANDATORY CLOSE BLOCKERS',
    ...prep.blockers.map(x=>`- ${x.title}: ${x.detail}`),
    '',
    'SOURCE COVERAGE',
    ...(prep.sourceStates.length?prep.sourceStates.map(x=>`- ${x.name}: ${x.state}. ${x.note}`):['- Not reported']),
    '',
    prep.sourceNote,
    'Nothing in this packet certifies tax deductibility, company profitability or CPA approval.',
  ];
  return lines.join('\n')+'\n';
}
