import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinanceEntry, MercurySnapshot, MercuryTransaction } from '../src/lib/dashboard';
import { bankReviewCandidates, bankReviewSnapshot, candidateBankDay } from '../src/lib/atlas-bank-review';

const entry=(id:string,amount:number,day:string,kind:FinanceEntry['kind']='revenue',extra:Partial<FinanceEntry>={}):FinanceEntry=>({
  id,amount,occurred_on:day,kind,venture:'exterior',category:'Field service',note:'',...extra,
});
const txn=(id:string,amount:number,postedAt:string|null='2026-10-23T19:00:00Z',extra:Partial<MercuryTransaction>={}):MercuryTransaction=>({
  id,amount,postedAt,createdAt:'2026-10-23T12:00:00Z',
  accountName:'Mercury checking',description:'Bank counterparty',currency:'USD',kind:'unknown-kind',status:'unknown-status',...extra,
});
const snapshot=(rows:MercuryTransaction[],state:MercurySnapshot['state']='available'):MercurySnapshot=>({
  state,checkedAt:'2026-10-23T19:00:00Z',detail:'Read-only bank source',accounts:[],transactions:rows,
});
test('candidate comparison is only exact amount magnitude within bounded date window; no inferred direction',()=>{
  const rows=[
    entry('same',225,'2026-10-23'),
    entry('wrong-price',225.01,'2026-10-23'),
    entry('old',225,'2026-10-18'),
    entry('near',225,'2026-10-27','cost'),
    entry('far',225,'2026-10-28'),
    entry('zero',0,'2026-10-23'),
  ];
  const out=bankReviewCandidates(txn('bank',-225),rows);
  assert.deepEqual(out.map(r=>r.id),['same','near']);
  assert.equal(out[0].kind,'revenue');
  assert.equal(out[1].kind,'cost');
  assert.equal(out[0].dayDistance,0);
  assert.equal(out[1].dayDistance,4);
  assert.equal(rows.length,6);
});
test('identical candidate amounts are ambiguous and never marked as reconciled',()=>{
  const found=bankReviewSnapshot(snapshot([txn('bank',120)]),[entry('one',120,'2026-10-23'),entry('two',120,'2026-10-23')]);
  assert.equal(found.rows[0].candidates.length,2);
  assert.deepEqual(found.rows[0].candidates.map(r=>r.id),['one','two']);
  assert.ok(found.scopeNote.includes('never verified matches'));
  assert.equal(Object.prototype.hasOwnProperty.call(found.rows[0],'reconciled'),false);
});
test('bank posting date uses America/Chicago and DST-safe date-only difference',()=>{
  const row=txn('late',100,'2026-11-01T03:45:00Z');
  assert.deepEqual(candidateBankDay(row),{day:'2026-10-31',source:'postedAt'});
  assert.deepEqual(bankReviewCandidates(row,[entry('oct',100,'2026-10-31')]).map(r=>r.id),['oct']);
  const march=txn('spring',100,'2026-03-08T05:20:00Z');
  assert.deepEqual(candidateBankDay(march),{day:'2026-03-07',source:'postedAt'});
  assert.equal(bankReviewCandidates(march,[entry('two-days',100,'2026-03-09')])[0].dayDistance,2);
});
test('fallback to creation timestamp is disclosed, not treated as settled',()=>{
  const bank=txn('no-post',55,null);
  const snap=bankReviewSnapshot(snapshot([bank]),[entry('e',55,'2026-10-23')]);
  assert.equal(snap.rows[0].daySource,'createdAt');
  assert.match(snap.rows[0].limitation??'',/not confirmed posting date/);
  assert.equal(snap.rows[0].candidates.length,1);
});
test('non-USD, zero, invalid dates, invalid amount, and oversized windows reject comparisons',()=>{
  assert.deepEqual(bankReviewCandidates(txn('euro',-10,undefined,{currency:'EUR'}),[entry('a',10,'2026-10-23')]),[]);
  assert.deepEqual(bankReviewCandidates(txn('zero',0),[entry('a',0,'2026-10-23')]),[]);
  assert.deepEqual(bankReviewCandidates(txn('unknown',NaN),[entry('a',10,'2026-10-23')]),[]);
  assert.deepEqual(bankReviewCandidates(txn('date',10,null,{createdAt:'invalid'}),[entry('a',10,'2026-10-23')]),[]);
  assert.deepEqual(bankReviewCandidates(txn('bad',10),[entry('a',10,'2026-02-30')]),[]);
  assert.throws(()=>bankReviewCandidates(txn('invalid-window',10),[],31));
  assert.throws(()=>bankReviewSnapshot(snapshot([]),[],'October'));
});
test('partial/unavailable/not connected bank source never makes fabricated unmatched rows',()=>{
  for (const state of ['partial','not-connected','unavailable'] as const){
    const res=bankReviewSnapshot(snapshot([txn('bank',200)],state),[entry('a',200,'2026-10-23')]);
    assert.equal(res.rows.length,0);
    assert.equal(res.state,state);
  }
  assert.deepEqual(bankReviewSnapshot(null,[]).rows,[]);
});
test('optional month filters bank rows only; period outside recent provider page remains unknown',()=>{
 const b=snapshot([txn('oct',10,'2026-10-23T19:00:00Z'),txn('sep',10,'2026-09-23T19:00:00Z')]);
 assert.deepEqual(bankReviewSnapshot(b,[], '2026-10').rows.map(r=>r.id),['oct']);
 assert.equal(bankReviewSnapshot(b,[]).rows.length,2);
});
test('candidate metadata retains date basis and source venture without inventing reconciled state',()=>{
 const matches=bankReviewCandidates(txn('b',50),[entry('r',50,'2026-10-23','cost',{dateBasis:'created-estimate',venture:'solutions',category:'Cloud hosting'})]);
 assert.deepEqual(matches.map(m=>[m.venture,m.dateBasis,m.category]),[['solutions','created-estimate','Cloud hosting']]);
});
