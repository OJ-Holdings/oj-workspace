import test from 'node:test';
import assert from 'node:assert/strict';
import { preflightPostingBatch, prepareReversalDraft } from '../src/lib/atlas-posting-preflight';
import type { LedgerAccount, JournalDraft } from '../src/lib/atlas-accounting-core';
const accounts:LedgerAccount[]=[
  {id:'a-cash',entityId:'oj',code:'1000',name:'Cash',class:'asset',currency:'USD',active:true},
  {id:'a-sales',entityId:'oj',code:'4000',name:'Service Revenue',class:'income',currency:'USD',active:true},
  {id:'b-cash',entityId:'other',code:'1000',name:'Cash',class:'asset',currency:'USD',active:true},
  {id:'b-sales',entityId:'other',code:'4000',name:'Sales',class:'income',currency:'USD',active:true},
];
const journal=(id:string,entityId:string='oj',sourceId:string=id):JournalDraft=>({
  id,entityId,sourceId,date:'2026-10-23',memo:'Sale',currency:'USD',approvedBy:'test-approver',
  lines:[{accountId:entityId==='oj'?'a-cash':'b-cash',debitCents:15000,creditCents:0},
    {accountId:entityId==='oj'?'a-sales':'b-sales',debitCents:0,creditCents:15000}],
});
test('valid two-entity journal batch computes distinct balanced trial balances only',()=>{
  const r=preflightPostingBatch(accounts,[journal('1'),journal('2','other')]);
  assert.equal(r.valid,true);
  assert.deepEqual(Object.keys(r.byEntity??{}).sort(),['oj','other']);
  assert.equal(r.byEntity?.oj.totalDebitsCents,15000);
  assert.equal(r.byEntity?.other.totalCreditsCents,15000);
  assert.match(r.note,/NOT authenticated\/authorized/);
});
test('rejects repeated journal identity and same-entity duplicate source id before calculating anything',()=>{
  const duplicate=preflightPostingBatch(accounts,[journal('1','oj','same'),journal('2','oj','same'),journal('1','other','other')]);
  assert.equal(duplicate.valid,false);
  assert.equal(duplicate.byEntity,null);
  assert.ok(duplicate.issues.some(x=>x.code==='source-id-conflict'));
  assert.ok(duplicate.issues.some(x=>x.code==='journal-id-conflict'));
  assert.equal(preflightPostingBatch(accounts,[journal('1','oj','same'),journal('2','other','same')]).valid,true,
    'same provider source identifier in DISTINCT legal entities may be legitimate');
});
test('rejects account identity or code collisions within entity but permits same chart code across entities',()=>{
  assert.equal(preflightPostingBatch(accounts,[journal('1')]).valid,true);
  const id=preflightPostingBatch([...accounts,{...accounts[0],code:'5555'}],[journal('1')]);
  assert.ok(id.issues.some(x=>x.code==='account-id-conflict'));
  const codes=preflightPostingBatch([...accounts,{...accounts[0],id:'new-account'}],[journal('1')]);
  assert.ok(codes.issues.some(x=>x.code==='account-code-conflict'));
});
test('invalid journals cannot partially create a trial balance; locks actually apply to dates',()=>{
  const wrong=journal('x');
  wrong.lines=[{accountId:'a-cash',debitCents:150,creditCents:0},{accountId:'a-sales',debitCents:0,creditCents:149}];
  const r=preflightPostingBatch(accounts,[journal('1'),wrong]);
  assert.equal(r.valid,false);assert.equal(r.byEntity,null);
  assert.ok(r.issues.some(x=>x.code==='journal-invalid'&&x.id==='x'));
  assert.ok(preflightPostingBatch(accounts,[journal('1')],{oj:'2026-10-23'}).issues.some(x=>/locked/.test(x.detail)));
  assert.ok(preflightPostingBatch(accounts,[journal('1')],{oj:'2026-02-30'}).issues.some(x=>x.code==='lock-invalid'));
  assert.equal(preflightPostingBatch(accounts,[]).valid,false);
});
test('cross-entity account on a journal is rejected rather than implicitly balanced',()=>{
  const j=journal('cross');
  j.lines=[{accountId:'b-cash',debitCents:15000,creditCents:0},{accountId:'a-sales',debitCents:0,creditCents:15000}];
  const result=preflightPostingBatch(accounts,[j]);
  assert.equal(result.byEntity,null);
  assert.ok(result.issues.some(x=>/another legal entity/.test(x.detail)));
});
test('reversal creates a distinct journal preserving original and cancels out in trial balance',()=>{
  const original=journal('original');
  const frozen=JSON.stringify(original);
  const rev=prepareReversalDraft(original,{id:'reversal',sourceId:'reversal-source',date:'2026-10-24',approvedBy:'test-author'});
  assert.equal(rev.reversesJournalId,'original');
  assert.equal(rev.lines[0].creditCents,15000);
  assert.equal(rev.lines[1].debitCents,15000);
  assert.equal(JSON.stringify(original),frozen);
  const result=preflightPostingBatch(accounts,[original,rev]);
  assert.equal(result.valid,true);
  assert.deepEqual(result.byEntity?.oj.rows,[]);
  assert.equal(result.byEntity?.oj.totalDebitsCents,0);
});
test('reversal cannot reuse original identity, backdate incorrectly, or lack a named approver',()=>{
  const original=journal('original');
  assert.throws(()=>prepareReversalDraft(original,{id:'original',sourceId:'new-source',date:'2026-10-24',approvedBy:'person'}));
  assert.throws(()=>prepareReversalDraft(original,{id:'new',sourceId:'original',date:'2026-10-24',approvedBy:'person'}));
  assert.throws(()=>prepareReversalDraft(original,{id:'new',sourceId:'new-source',date:'2026-02-30',approvedBy:'person'}));
  assert.throws(()=>prepareReversalDraft(original,{id:'new',sourceId:'new-source',date:'2026-10-24',approvedBy:null}));
});


test('arbitrary entity labels cannot rewrite batch result object prototypes',()=>{
 const weird:LedgerAccount[]=[
  {id:'weird-cash',entityId:'__proto__',code:'1000',name:'Cash',class:'asset',currency:'USD',active:true},
  {id:'weird-sales',entityId:'__proto__',code:'4000',name:'Sales',class:'income',currency:'USD',active:true},
 ];
 const x:JournalDraft={...journal('proto'),entityId:'__proto__',lines:[
   {accountId:'weird-cash',debitCents:1,creditCents:0},
   {accountId:'weird-sales',debitCents:0,creditCents:1},
 ]};
 const r=preflightPostingBatch(weird,[x]);
 assert.equal(r.valid,true);
 assert.equal(r.byEntity?.['__proto__'].balanced,true);
 assert.equal(Object.getPrototypeOf(r.byEntity),null);
});

test('inherited property names cannot act as unseen period locks',()=>{
 const weird:LedgerAccount[]=[
  {id:'cash',entityId:'__proto__',code:'1000',name:'Cash',class:'asset',currency:'USD',active:true},
  {id:'sales',entityId:'__proto__',code:'4000',name:'Sales',class:'income',currency:'USD',active:true},
 ];
 const source:JournalDraft={...journal('new'),entityId:'__proto__',lines:[
   {accountId:'cash',debitCents:200,creditCents:0},
   {accountId:'sales',debitCents:0,creditCents:200},
 ]};
 const defaults={oj:'2026-10-22'};
 const result=preflightPostingBatch(weird,[source],defaults);
 assert.equal(result.valid,true);
});
