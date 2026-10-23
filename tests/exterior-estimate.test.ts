import assert from 'node:assert/strict';
import test from 'node:test';
import type {ExtLead} from '../src/lib/exterior';
import {
 addLocalRevision,computeExteriorEstimate,estimateBrief,isExteriorEstimate,newEstimateLine,
 newExteriorEstimate,parseLocalEstimateBook,rebaseEstimateOnLead,sourceStillMatches,
 type ExteriorEstimate,
} from '../src/lib/exterior-estimate';

const lead=(extra:Partial<ExtLead>={}):ExtLead=>({
 id:'11111111-1111-4111-8111-111111111111',name:'Example Customer',phone:'+12625550123',
 address:'100 Example Ave, Racine WI 53402',service_requested:'House Washing',
 quote_amount:325,status:'new',source:'website',notes:null,job_revenue:null,job_cost:null,
 created_at:'2026-10-22T17:00:00Z',updated_at:'2026-10-23T15:00:00Z',completed_at:null,...extra,
});
const scenario=():ExteriorEstimate=>{
 const e=newExteriorEstimate(lead());
 return {...e,lines:[
  {...newEstimateLine('house'),service:'House wash',quantity:1,unit:'flat',pricePerUnit:325,costPerUnit:45,notes:'Confirm water access'},
  {...newEstimateLine('windows'),service:'Exterior windows',quantity:24,unit:'pane',pricePerUnit:6.25,costPerUnit:1.5,notes:''},
 ],discount:25,travelCost:20,contingencyPct:10};
};
test('new estimate links exact original lead without asserting cost, acceptance or paid status',()=>{
 const e=newExteriorEstimate(lead());
 assert.equal(e.schema,1);
 assert.equal(e.sourceQuote,325);
 assert.equal(e.leadId,lead().id);
 assert.equal(e.lines.length,1);
 assert.equal(e.lines[0].pricePerUnit,325);
 assert.equal(e.lines[0].costPerUnit,null);
 assert.equal(e.travelCost,null);
 assert.equal(computeExteriorEstimate(e).cost,null);
});
test('unit calculations use price minus discount and recorded known cost plus contingency',()=>{
 const totals=computeExteriorEstimate(scenario());
 assert.equal(totals.subtotal,475);
 assert.equal(totals.price,450);
 assert.equal(totals.cost,109.1);
 assert.equal(totals.contribution,340.9);
 assert.equal(totals.marginPct,75.76);
 assert.equal(totals.costedLines,2);
 assert.equal(totals.travelKnown,true);
 assert.match(estimateBrief(scenario(),lead()),/INTERNAL ESTIMATE REVIEW/);
 assert.match(estimateBrief(scenario(),lead()),/NOT A CLIENT PROPOSAL/);
 assert.match(estimateBrief(scenario(),lead()),/Source record ID/);
});
test('unknown line cost or unknown travel withholds ALL estimated margin, never assumes zero',()=>{
 const base=scenario();
 const noTravel={...base,travelCost:null};
 const noCost={...base,lines:[base.lines[0],{...base.lines[1],costPerUnit:null}]};
 for(const e of [noTravel,noCost]){
  const t=computeExteriorEstimate(e);
  assert.equal(t.cost,null);
  assert.equal(t.contribution,null);
  assert.equal(t.marginPct,null);
 }
 const zeroPrice={...base,discount:475};
 assert.equal(computeExteriorEstimate(zeroPrice).marginPct,null);
});
test('cannot reduce below zero via discount or pass infinite/negative/malformed line prices',()=>{
 const base=scenario();
 assert.throws(()=>computeExteriorEstimate({...base,discount:999}),/Discount/);
 for(const invalid of [-1,NaN,Infinity]){
  const e={...base,lines:[{...base.lines[0],pricePerUnit:invalid}]};
  assert.equal(isExteriorEstimate(e),false);
  assert.throws(()=>computeExteriorEstimate(e));
 }
 const extra={...base,lines:Array.from({length:25},(_,i)=>({...newEstimateLine('line-'+i),quantity:1,pricePerUnit:1}))};
 assert.equal(isExteriorEstimate(extra),false);
});
test('revisions validate, freeze values, retain eight and stay scoped to original lead ID',()=>{
 let book={schema:1 as const,current:scenario(),revisions:[]};
 for(let i=0;i<11;i++){
  book=addLocalRevision(book,'2026-10-23T12:00:00Z','r-'+i);
  book.current={...book.current,discount:i};
 }
 assert.equal(book.revisions.length,8);
 assert.equal(book.revisions[0].id,'r-10');
 assert.equal(book.revisions[0].estimate.discount,9);
 assert.equal(book.revisions[7].id,'r-3');
 const saved=JSON.stringify(book);
 assert.deepEqual(parseLocalEstimateBook(saved,lead().id),book);
 assert.throws(()=>parseLocalEstimateBook(saved,'another-id'));
});
test('corrupt, oversized, malformed and cross-customer browser documents are rejected',()=>{
 const e=scenario();
 const b={schema:1,current:e,revisions:[]};
 assert.throws(()=>parseLocalEstimateBook(JSON.stringify({...b,current:{...e,leadId:'other'}}),lead().id));
 assert.throws(()=>parseLocalEstimateBook('X'.repeat(120001),lead().id));
 assert.throws(()=>parseLocalEstimateBook('{broken json',lead().id));
 assert.throws(()=>parseLocalEstimateBook(JSON.stringify({...b,revisions:[{id:'r',savedAt:'broken',estimate:e}]}),lead().id));
 assert.throws(()=>parseLocalEstimateBook(JSON.stringify({...b,current:{...e,lines:[{...e.lines[0],service:''}]}}),lead().id));
});
test('shared price recording must first rebase to unchanged exact customer source snapshot',()=>{
 const l=lead(),e=scenario();
 assert.equal(sourceStillMatches(e,l),true);
 assert.equal(sourceStillMatches(e,{...l,updated_at:'2026-10-23T16:01:00Z'}),false);
 assert.equal(sourceStillMatches(e,{...l,quote_amount:400}),false);
 assert.equal(sourceStillMatches(e,{...l,id:'other'}),false);
 const changed={...l,updated_at:'2026-10-23T17:00:00Z',quote_amount:400};
 const rebased=rebaseEstimateOnLead(e,changed);
 assert.equal(sourceStillMatches(rebased,changed),true);
 assert.equal(rebased.lines[0].pricePerUnit,325);
 assert.equal(rebased.lines[1].pricePerUnit,6.25);
 assert.throws(()=>rebaseEstimateOnLead(e,{...changed,id:'unrelated'}));
});
test('zero is allowed as a known cost, but never inferred for missing cost or travel',()=>{
 const e=scenario();
 const t=computeExteriorEstimate({...e,lines:e.lines.map(l=>({...l,costPerUnit:0})),travelCost:0});
 assert.equal(t.cost,0);
 assert.equal(t.contribution,450);
 assert.equal(t.marginPct,100);
 assert.equal(computeExteriorEstimate({...e,travelCost:null}).cost,null);
});
