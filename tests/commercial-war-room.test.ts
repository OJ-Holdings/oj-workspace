import assert from 'node:assert/strict';
import test from 'node:test';
import { newEstimate, type EstimateInput } from '../src/lib/commercial-estimate';
import { buildBidWarRoom, warRoomBrief, warRoomChecks } from '../src/lib/commercial-war-room';

function example(): EstimateInput {
  return {
    ...newEstimate(),
    sites: [
      { id:'b1',name:'Office north',location:'Waukegan, IL',levels:4,panes:150,crewHours:20,liftDays:1,access:'lift',notes:'Power and qualified lift access to confirm.' },
      { id:'b2',name:'Office south',location:'Milwaukee, WI',levels:2,panes:75,crewHours:10,liftDays:0,access:'water-fed',notes:'Ground-level water source needs confirmation.' },
    ],
    laborRate:40,liftDaily:500,materials:200,mobilization:100,other:100,
    contingency:10,margin:30,deposit:25,
  };
}
const checks=()=>warRoomChecks.map(()=>true);

test('pricing cases use target contribution margin, never cost markup',()=>{
  const result=buildBidWarRoom('Two-office portfolio',example(),checks());
  assert.equal(result.baseline.totalCost,2310);
  assert.equal(result.baseline.suggestedPrice,3300);
  assert.deepEqual(result.pricing.map(p=>p.targetMargin),[23,30,37]);
  assert.deepEqual(result.pricing.map(p=>p.price),[3000,3300,3666.67]);
  assert.deepEqual(result.pricing.map(p=>p.estimatedContribution),[690,990,1356.67]);
  assert.equal(result.pricing.every(p=>p.estimatedDirectCost===2310),true);
});

test('stress scenario correctly increases labor, lift, supplies and travel independently',()=>{
  const result=buildBidWarRoom('Two-office portfolio',example(),checks());
  assert.equal(result.stress.stressedCost,3245);
  assert.equal(result.stress.costIncrease,935);
  assert.equal(result.stress.contributionAtCurrentPrice,55);
  assert.equal(result.stress.marginAtCurrentPrice,1.67);
  assert.equal(result.stress.priceToHoldTargetMargin,4635.71);
  assert.equal(result.stress.requiresHigherPrice,true);
});

test('multi-building site exposure excludes unallocated shared costs',()=>{
  const result=buildBidWarRoom('Two-office portfolio',example(),checks());
  assert.deepEqual(result.siteExposure.map(s=>[s.name,s.labor,s.equipment,s.directSubtotal]),[
    ['Office north',800,500,1300],
    ['Office south',400,0,400],
  ]);
  assert.equal(result.siteExposure.reduce((sum,s)=>sum+s.directSubtotal,0),1700);
  assert.equal(result.baseline.totalCost>1700,true,'shared costs and contingency intentionally excluded from per-site line');
});

test('incomplete survey flags prevent any claim of ready-to-send approval',()=>{
  const result=buildBidWarRoom('New commercial opportunity',newEstimate(),[false,false,false,false,false]);
  assert.equal(result.status,'scope-incomplete');
  assert.equal(result.reviewedCount,0);
  assert.equal(result.reviewCount,5);
  assert.equal(result.findings.some(f=>f.id==='project-reference'),true);
  assert.equal(result.findings.some(f=>f.id.startsWith('panes:')),true);
  assert.equal(result.findings.some(f=>f.id.startsWith('access:')),true);
  assert.equal(result.findings.filter(f=>f.id.startsWith('review:')).length,5);
});

test('complete entered data only advances to founder review, never approval',()=>{
  const result=buildBidWarRoom('Two-office portfolio',example(),checks());
  assert.equal(result.findings.length,0);
  assert.equal(result.status,'awaiting-founder-review');
});

test('lift access without rental days is a critical estimate gap',()=>{
  const input=example();
  input.sites[0].liftDays=0;
  const result=buildBidWarRoom('Portfolio',input,checks());
  assert.equal(result.findings.some(f=>f.id==='lift:b1'&&f.severity==='critical'),true);
});

test('margin cases are clamped at 0% and 90%',()=>{
  const input=example();
  input.margin=2;
  assert.deepEqual(buildBidWarRoom('Portfolio',input,checks()).pricing.map(p=>p.targetMargin),[0,2,9]);
  input.margin=88;
  assert.deepEqual(buildBidWarRoom('Portfolio',input,checks()).pricing.map(p=>p.targetMargin),[81,88,90]);
});

test('stress on a zero-price draft never divides by zero or reports an achieved profit',()=>{
  const input=newEstimate();
  input.sites=[{...input.sites[0],crewHours:0}];
  input.laborRate=0;
  const result=buildBidWarRoom('Zero-case',input,checks());
  assert.equal(result.baseline.suggestedPrice,0);
  assert.equal(result.stress.marginAtCurrentPrice,null);
  assert.equal(Number.isFinite(result.stress.priceToHoldTargetMargin),true);
  assert.equal(result.status,'scope-incomplete');
});

test('internal pack disclaims external approval, estimates and scope gaps',()=>{
  const doc=warRoomBrief('Waukegan Offices',example(),[true,false,true,false,true]);
  assert.match(doc,/INTERNAL REVIEW ONLY/);
  assert.match(doc,/NOT A CUSTOMER QUOTE/);
  assert.match(doc,/COST-STRESS TEST/);
  assert.match(doc,/No approval, signature or customer delivery has occurred/);
  assert.match(doc,/Access strategy assessed/);
});
