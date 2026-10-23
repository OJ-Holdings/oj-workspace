import {
  reviewJournal, trialBalance,
  type LedgerAccount, type JournalDraft, type TrialBalance,
} from './atlas-accounting-core';

/**
 * This is a pure, all-or-nothing preflight for FUTURE authorized durable posting.
 * No storage, membership authorization, tax/account inference, or money movement.
 */
export type PostingPreflightIssue = {
  code: 'account-id-conflict' | 'account-code-conflict' | 'journal-id-conflict'
    | 'source-id-conflict' | 'journal-invalid' | 'lock-invalid' | 'trial-balance-invalid';
  id: string;
  detail: string;
};
export type PostingPreflight = {
  valid: boolean;
  issues: PostingPreflightIssue[];
  byEntity: Record<string,TrialBalance> | null;
  validatedJournalCount: number;
  note: string;
};
const legalDay=(v:string):boolean=>{
  if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
  const date=new Date(v+'T12:00:00.000Z');
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===v;
};
export function preflightPostingBatch(
  accounts: readonly LedgerAccount[],
  journals: readonly JournalDraft[],
  lockedThrough: Readonly<Record<string,string|null>> = {},
): PostingPreflight {
  const issues:PostingPreflightIssue[]=[];
  const ids=new Set<string>(),codes=new Set<string>();
  for(const account of accounts){
    if(ids.has(account.id))issues.push({code:'account-id-conflict',id:account.id,detail:'Account identifier is duplicated; account mapping would be ambiguous.'});
    ids.add(account.id);
    const name=`${account.entityId}\u0000${account.code}`;
    if(codes.has(name))issues.push({code:'account-code-conflict',id:account.id,detail:'An account code is duplicated within one legal entity.'});
    codes.add(name);
  }
  for(const [entityId,day] of Object.entries(lockedThrough)){
    if(day!==null&&!legalDay(day))issues.push({code:'lock-invalid',id:entityId,detail:'Period lock must be a real YYYY-MM-DD date.'});
  }
  const journalIds=new Set<string>(),sourceIds=new Set<string>();
  for(const journal of journals){
    if(journalIds.has(journal.id))issues.push({code:'journal-id-conflict',id:journal.id,detail:'Posting identity repeated in this batch.'});
    journalIds.add(journal.id);
    const key=`${journal.entityId}\u0000${journal.sourceId}`;
    if(sourceIds.has(key))issues.push({code:'source-id-conflict',id:journal.id,detail:'Source identity repeated within its legal entity. An idempotent posting key is required.'});
    sourceIds.add(key);
    const lock=lockedThrough[journal.entityId]??null;
    const inspection=reviewJournal(journal,accounts,lock);
    for(const reason of inspection.reasons)issues.push({code:'journal-invalid',id:journal.id,detail:reason});
  }
  // Empty source is not proof of an approved ledger; no trial balance or posting.
  if(!journals.length)issues.push({code:'journal-invalid',id:'batch',detail:'No approved journal drafts were supplied.'});
  let byEntity:Record<string,TrialBalance>|null=null;
  if(!issues.length){
    const result:Record<string,TrialBalance>={};
    for(const entityId of [...new Set(journals.map(j=>j.entityId))].sort()){
      try{
        const relevantAccounts=accounts.filter(a=>a.entityId===entityId);
        const relevantJournals=journals.filter(j=>j.entityId===entityId);
        const tb=trialBalance(relevantAccounts,relevantJournals);
        if(!tb.balanced)issues.push({code:'trial-balance-invalid',id:entityId,detail:'Prepared trial balance did not balance.'});
        else result[entityId]=tb;
      }catch(err){
        issues.push({code:'trial-balance-invalid',id:entityId,detail:err instanceof Error?err.message:'Unable to compute this trial balance.'});
      }
    }
    if(!issues.length)byEntity=result;
  }
  return {
    valid:issues.length===0,issues,byEntity,validatedJournalCount:journals.length,
    note:'In-memory preflight only. Approver identity is present but NOT authenticated/authorized here. No source receipts or opening balances are independently verified and NOTHING is posted or period-closed.',
  };
}
export type ReversalDraft = JournalDraft & { reversesJournalId: string };
/**
 * Creates a new candidate reversal, never mutates or erases the original.
 * Persisted reversals will require a DB-enforced original reference and approval.
 */
export function prepareReversalDraft(
  original: JournalDraft,
  next: {id:string;sourceId:string;date:string;approvedBy:string|null},
): ReversalDraft {
  if(!next.id.trim()||!next.sourceId.trim()||next.id===original.id||next.sourceId===original.sourceId)
    throw new Error('A reversal needs distinct non-empty journal and source identities.');
  if(!legalDay(next.date))throw new Error('Reversal requires a valid calendar date.');
  if(!next.approvedBy?.trim())throw new Error('Reversal preparation requires an explicit approver.');
  if(!original.lines.length)throw new Error('Original journal contains no lines.');
  return {
    id:next.id,sourceId:next.sourceId,date:next.date,approvedBy:next.approvedBy,
    entityId:original.entityId,currency:original.currency,
    memo:`Reversal candidate of ${original.id}: ${original.memo}`,
    lines:original.lines.map(row=>({...row,debitCents:row.creditCents,creditCents:row.debitCents})),
    reversesJournalId:original.id,
  };
}
