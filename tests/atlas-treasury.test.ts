import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinanceEntry, Dashboard, MercurySnapshot } from '../src/lib/dashboard';
import { treasurySnapshot,previousMonth } from '../src/lib/atlas-treasury';
const money = (id:string,kind:'revenue'|'cost', amount:number, occurred_on:string, category:string, extra:Partial<FinanceEntry>={}):FinanceEntry=>({
  id,kind,amount,occurred_on,category,note:'',venture:'exterior',...extra,
});
const coverage: NonNullable<Dashboard['reporting']>={
  sources:[{id:'exterior',label:'Exterior Care',state:'available',detail:'All source records loaded'},
    {id:'shopify',label:'Shopify',state:'not-connected',detail:'No Shopify connection'}],
  exterior:{jobs:12,revenueJobs:11,costJobs:9,matchedJobs:9,estimatedDateJobs:2},
};
const bank:MercurySnapshot={state:'available',detail:'Checked',accounts:[{id:'1',name:'Checking',currentBalance:2100,availableBalance:2000,currency:'USD',status:'active'}],transactions:[],checkedAt:'2026-10-23T12:00:00Z'};
const finance=[
  money('a','revenue',400,'2026-10-01','Jobs'),
  money('b','revenue',600,'2026-10-13','Jobs',{auto:'Exterior Care job',dateBasis:'updated-estimate'}),
  money('c','cost',100,'2026-10-11','Fuel'),
  money('d','cost',20,'2026-10-11','Chemicals'),
  money('e','cost',0,'2026-10-12','Fuel'),
  money('f','revenue',200,'2026-09-01','Jobs'),
  money('g','cost',60,'2026-09-01','Fuel'),
  money('h','revenue',500,'2026-10-08','Consulting',{venture:'solutions'}),
];
test('treasury summarizes actual scoped period, category shares and prior month',()=>{
  const t=treasurySnapshot({finance,reporting:coverage,mercury:bank},'2026-10',['exterior'],true);
  assert.equal(t.inflow,1000);
  assert.equal(t.outflow,120);
  assert.equal(t.difference,880);
  assert.equal(t.priorInflow,200);
  assert.equal(t.priorOutflow,60);
  assert.deepEqual(t.expenseGroups.map(c=>[c.label,c.amount]),[['Fuel',100],['Chemicals',20]]);
  assert.equal(t.expenseGroups[0].share,100/120);
  assert.equal(t.ventures[0].id,'exterior');
  assert.equal(t.eligibleStatement,false);
  assert.equal(t.bank.amount,2100);
  assert.match(t.bank.detail,/not total company cash/);
  assert.deepEqual(t.attention.filter(a=>['job-costs','job-payments','estimated-dates'].includes(a.id)).map(a=>a.id),['job-costs','job-payments','estimated-dates']);
});
test('zero expense is known, missing expense is not a zero or profit figure',()=>{
  const a=treasurySnapshot({finance:[money('x','revenue',0,'2026-10-02','Sale')]},'2026-10',['exterior'],false);
  assert.equal(a.inflow,0);
  assert.equal(a.outflow,null);
  assert.equal(a.difference,null);
  assert.equal(a.bank.state,'restricted');
  assert.equal(a.bank.amount,null);
  assert.ok(a.attention.some(x=>x.id==='no-costs'));
  const b=treasurySnapshot({finance:[money('y','cost',0,'2026-10-02','Fuel')]},'2026-10',['exterior'],false);
  assert.equal(b.outflow,0);assert.equal(b.inflow,null);
});
test('multiple ventures remain separated, and USD bank never exposed to viewer',()=>{
  const a=treasurySnapshot({finance,reporting:coverage,mercury:bank},'2026-10',['exterior','solutions'],false);
  assert.equal(a.inflow,1500);
  assert.equal(a.ventures[1].inflow,500);
  assert.equal(a.ventures[1].difference,null);
  assert.equal(a.bank.amount,null);
  const mixed:MercurySnapshot={...bank,accounts:[...bank.accounts,{id:'eur',name:'Foreign',currentBalance:10,availableBalance:10,currency:'EUR',status:'active'}]};
  assert.equal(treasurySnapshot({finance,mercury:mixed},'2026-10',['exterior'],true).bank.amount,null);
});
test('failed source and partial bank withholding never become false green',()=>{
  const t=treasurySnapshot({finance,reporting:{...coverage,sources:[{id:'exterior',label:'Exterior',state:'unavailable',detail:'Timed out'}]},mercury:{...bank,state:'partial'}},'2026-10',['exterior'],true);
  assert.equal(t.bank.amount,null);
  assert.ok(t.attention.some(a=>a.title.includes('unavailable')));
  assert.ok(t.attention.some(a=>a.id==='bank-evidence'));
});
test('periods correctly cross years and invalid dates refused',()=>{
  assert.equal(previousMonth('2026-01'),'2025-12');
  assert.equal(previousMonth('2026-10'),'2026-09');
  assert.throws(()=>previousMonth('October 2026'));
});
