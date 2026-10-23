import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinanceEntry } from '../src/lib/dashboard';
import { accountingReviewCsv,accountingReviewFilename } from '../src/lib/atlas-accounting-export';

const record = (id:string,changes:Partial<FinanceEntry>={}):FinanceEntry=>({
 id,venture:'exterior',kind:'revenue',amount:0,occurred_on:'2026-10-23',
 category:'Fuel',note:'',...changes,
});
test('accountant review export distinguishes manual and sourced entries, zero from unknown',()=>{
 const result=accountingReviewCsv([
  record('manual',{amount:0,kind:'cost'}),
  record('job',{amount:200.15,auto:'Exterior Care job',dateBasis:'updated-estimate'}),
 ]);
 assert.ok(result.startsWith('\uFEFF'));
 assert.match(result,/manual-entry/);
 assert.match(result,/source-derived/);
 assert.match(result,/updated-estimate/);
 assert.match(result,/not-verified/);
 assert.match(result,/not-posted-to-general-ledger/);
 assert.match(result,/"0.00"/);
 assert.match(result,/"200.15"/);
 assert.equal(result.split('\r\n').filter(Boolean).length,3);
});
test('exports are quoted, escape double quotes, preserve line breaks, and neutralize formula injection',()=>{
 const csv=accountingReviewCsv([record('=HYPERLINK()',{
  category:'  =SUM(1,2)',note:'@fetch\n"quoted"\n+unsafe',auto:'-other',
 })]);
 assert.ok(csv.includes('"\'=HYPERLINK()"'));
 assert.ok(csv.includes('"\'  =SUM(1,2)"'));
 assert.ok(csv.includes('"\'@fetch\n""quoted""\n+unsafe"'));
 assert.ok(csv.includes('"\'-other"'));
});
test('invalid data refused rather than silently creating fake bookkeeping',()=>{
 assert.throws(()=>accountingReviewCsv([record('x',{amount:NaN})]));
 assert.throws(()=>accountingReviewCsv([record('x',{amount:-5})]));
 assert.throws(()=>accountingReviewCsv([record('x',{occurred_on:'unknown'})]));
 assert.equal(accountingReviewFilename(null),'atlas-accounting-review-loaded-history.csv');
 assert.equal(accountingReviewFilename('2026-10'),'atlas-accounting-review-2026-10.csv');
 assert.throws(()=>accountingReviewFilename('../../oops'));
});
test('empty filtered view exports only header; caller controls permission and business scope',()=>{
 const csv=accountingReviewCsv([]);
 assert.equal(csv.split('\r\n').filter(Boolean).length,1);
 assert.equal(csv.includes('made-up'),false);
});
