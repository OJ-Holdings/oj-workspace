/**
 * R16 Operator Experience: one discoverable route for every routine action.
 * Route builders only navigate to existing reviewed editors; never mutate
 * bookings, leads, ledger entries or tasks on their own.
 */
export const operatorActionIds=['new-lead','book-job','record-expense','new-task'] as const;
export type OperatorActionId=typeof operatorActionIds[number];

export const operatorActionLabels:Record<OperatorActionId,string>={
  'new-lead':'New lead',
  'book-job':'Book job',
  'record-expense':'Record expense',
  'new-task':'New task',
};
export function operatorActionHref(base:'/workspace'|'/preview',id:Exclude<OperatorActionId,'new-task'>,venture?:string):string{
  if(id==='new-lead')return base+'/b/exterior/leads?new=1';
  if(id==='book-job')return base+'/b/exterior/bookings?new=1';
  if(id==='record-expense'){
    // A company-wide expense defaults to Exterior Care, while a venture money
    // screen is pre-scoped by the existing FinanceView and retains its role gate.
    return venture && venture!=='content'
      ?base+'/b/'+venture+'/money?new=cost'
      :base+'/finance?new=cost';
  }
  throw new Error('Unknown operator action.');
}
export function isOperatorLaunch(value:string|null):boolean{return value==='1';}
export function isFinanceLaunch(value:string|null):value is 'cost'|'revenue'{
  return value==='cost'||value==='revenue';
}
/** Discoverability is not writable authorization: content is deliberately
 * listed but its persistence gate stays disabled in ventures.ts. */
export function visibleBusinessRoute(base:'/workspace'|'/preview',id:string,contentEnabled:boolean):string{
  if(id==='content'&&!contentEnabled)return base+'/tools/content-preview';
  if(!['exterior','solutions','essentials','content'].includes(id))throw new Error('Unknown division.');
  return base+'/b/'+id;
}
