import assert from 'node:assert/strict';
import test from 'node:test';
import { reviewJournal,trialBalance,type LedgerAccount,type JournalDraft } from '../src/lib/atlas-accounting-core';
const accounts:LedgerAccount[]=[
 {id:'cash',entityId:'oj',code:'1010',name:'Cash',class:'asset',currency:'USD',active:true},
 {id:'sales',entityId:'oj',code:'4000',name:'Sales',class:'income',currency:'USD',active:true},
 {id:'fuel',entityId:'oj',code:'6100',name:'Fuel',class:'expense',currency:'USD',active:true},
 {id:'payable',entityId:'oj',code:'2000',name:'Accounts Payable',class:'liability',currency:'USD',active:true},
 {id:'private',entityId:'strathion',code:'1000',name:'Separate entity',class:'asset',currency:'USD',active:true},
 {id:'closed',entityId:'oj',code:'4900',name:'Closed',class:'income',currency:'USD',active:false},
];
const journal=(lines:JournalDraft['lines'], extra:Partial<JournalDraft>={}):JournalDraft=>({
 id:'j1',entityId:'oj',date:'2026-10-23',sourceId:'test-proof-1',memo:'Fixture',currency:'USD',approvedBy:'founder-test',
 lines,...extra,
});
test('valid double-entry sales journal yields balanced trial balance',()=>{
 const j=journal([{accountId:'cash',debitCents:10000,creditCents:0},{accountId:'sales',debitCents:0,creditCents:10000}]);
 assert.equal(reviewJournal(j,accounts).valid,true);
 const tb=trialBalance(accounts,[j]);
 assert.equal(tb.balanced,true);
 assert.equal(tb.totalDebitsCents,10000);
 assert.equal(tb.totalCreditsCents,10000);
 assert.deepEqual(tb.rows.map(x=>[x.code,x.debitCents,x.creditCents]),[['1010',10000,0],['4000',0,10000]]);
});
test('two balanced postings can net an account without phantom profit',()=>{
 const sale=journal([{accountId:'cash',debitCents:10000,creditCents:0},{accountId:'sales',debitCents:0,creditCents:10000}]);
 const expense=journal([{accountId:'fuel',debitCents:700,creditCents:0},{accountId:'cash',debitCents:0,creditCents:700}],{id:'j2',sourceId:'test-proof-2'});
 const tb=trialBalance(accounts,[sale,expense]);
 assert.equal(tb.totalDebitsCents,10000);
 assert.equal(tb.totalCreditsCents,10000);
 assert.deepEqual(tb.rows.find(a=>a.accountId==='cash')?.debitCents,9300);
});
test('rejects unapproved, unbalanced, zero, unsafe or double-sided journal',()=>{
 const good=[{accountId:'cash',debitCents:100,creditCents:0},{accountId:'sales',debitCents:0,creditCents:100}];
 assert.ok(reviewJournal(journal(good,{approvedBy:null}),accounts).reasons.some(x=>/approver/i.test(x)));
 assert.equal(reviewJournal(journal([good[0],{...good[1],creditCents:90}]),accounts).valid,false);
 assert.equal(reviewJournal(journal([{accountId:'cash',debitCents:0,creditCents:0},{accountId:'sales',debitCents:0,creditCents:0}]),accounts).valid,false);
 assert.equal(reviewJournal(journal([{accountId:'cash',debitCents:100,creditCents:5},good[1]]),accounts).valid,false);
 assert.equal(reviewJournal(journal([{accountId:'cash',debitCents:100.75,creditCents:0},good[1]]),accounts).valid,false);
 assert.equal(reviewJournal(journal([{accountId:'cash',debitCents:Number.MAX_SAFE_INTEGER+1,creditCents:0},good[1]]),accounts).valid,false);
 assert.throws(()=>trialBalance(accounts,[journal([{accountId:'cash',debitCents:7,creditCents:0}])]));
});
test('rejects cross-entity accounts and inactive accounts even if balanced',()=>{
 const other=journal([{accountId:'private',debitCents:100,creditCents:0},{accountId:'sales',debitCents:0,creditCents:100}]);
 assert.ok(reviewJournal(other,accounts).reasons.some(r=>r.includes('another legal entity')));
 const retired=journal([{accountId:'cash',debitCents:100,creditCents:0},{accountId:'closed',debitCents:0,creditCents:100}]);
 assert.ok(reviewJournal(retired,accounts).reasons.some(r=>r.includes('inactive')));
});
test('rejects locked period or impossible calendar date',()=>{
 const good=[{accountId:'cash',debitCents:100,creditCents:0},{accountId:'sales',debitCents:0,creditCents:100}];
 assert.ok(reviewJournal(journal(good),accounts,'2026-10-23').reasons.some(r=>r.includes('locked')));
 assert.ok(reviewJournal(journal(good,{date:'2026-02-30'}),accounts).reasons.some(r=>r.includes('calendar date')));
 assert.equal(reviewJournal(journal(good,{date:'2026-02-28'}),accounts,'2026-01-31').valid,true);
});
