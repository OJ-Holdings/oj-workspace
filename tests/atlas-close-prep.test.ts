import assert from 'node:assert/strict';
import test from 'node:test';
import type { Dashboard, FinanceEntry } from '../src/lib/dashboard';
import { buildClosePrep, closePrepBrief } from '../src/lib/atlas-close-prep';
const f=(id:string,kind:'revenue'|'cost',amount:number,category:string,extra:Partial<FinanceEntry>={}):FinanceEntry=>({
 id,venture:'exterior',kind,amount,category,occurred_on:'2026-10-12',note:'',...extra,
});
const reporting:NonNullable<Dashboard['reporting']>={
 sources:[{id:'exterior',label:'Exterior',state:'available',detail:'Source available'},
 {id:'mercury',label:'Mercury',state:'partial',detail:'Some bank history unavailable'}],
 exterior:{jobs:10,costJobs:8,revenueJobs:9,matchedJobs:7,estimatedDateJobs:2},
};
test('zero recorded expense is known, but no approved close is ever inferred',()=>{
 const result=buildClosePrep({finance:[f('a','revenue',250,'Service'),f('b','cost',0,'Supplies')],reporting},'2026-10',['exterior'],true);
 assert.equal(result.recordedIn,250);
 assert.equal(result.recordedOut,0);
 assert.equal(result.canClose,false);
 assert.ok(result.blockers.some(b=>b.id==='bank'));
 assert.equal(result.actionable.some(a=>a.id==='missing-costs'),false);
});
test('missing categories and inferred dates produce linked actionable issues',()=>{
 const result=buildClosePrep({finance:[
 f('a','revenue',250,'',{dateBasis:'updated-estimate'}),
 f('b','cost',12,'uncategorized'),
 f('c','cost',18,'Gas',{venture:'solutions'}),
 ]},'2026-10',['exterior'],false);
 assert.deepEqual(result.actionable.filter(a=>a.entryId).map(a=>a.id),['category-a','date-a','category-b']);
 assert.equal(result.recordedOut,12);
 assert.ok(result.blockers.find(a=>a.id==='bank')!.detail.includes('owner-restricted'));
 assert.equal(result.sourceStates.length,0);
});
test('no money entries does not get converted to zero or certified loss',()=>{
 const result=buildClosePrep({finance:[]},'2026-10',['exterior'],false);
 assert.equal(result.recordedIn,null);
 assert.equal(result.recordedOut,null);
 assert.ok(result.actionable.some(a=>a.id==='missing-revenue'));
 assert.ok(result.actionable.some(a=>a.id==='missing-costs'));
 assert.equal(result.canClose,false);
});
test('scoping excludes other ventures and dates',()=>{
 const result=buildClosePrep({finance:[
 f('other','cost',999,'Travel',{venture:'solutions'}),
 f('prior','cost',500,'Fuel',{occurred_on:'2026-09-30'}),
 f('current','cost',27,'Fuel'),
 f('r','revenue',80,'Service')
 ]},'2026-10',['exterior'],true);
 assert.equal(result.recordedOut,27);
 assert.equal(result.recordedIn,80);
 assert.equal(result.ventures.length,1);
});
test('prepared text includes caveats and actionable source issues but no bank account PII',()=>{
 const prepared=buildClosePrep({finance:[f('a','revenue',100,'')],reporting,
 mercury:{state:'available',detail:'Private balance',accounts:[{id:'private-account-number',name:'Sensitive bank',currentBalance:500,availableBalance:400,currency:'USD',status:'active'}],transactions:[],checkedAt:'2026-10-01T10:00:00Z'}},
 '2026-10',['exterior'],true);
 const text=closePrepBrief(prepared,'2026-10-23T18:00:00Z');
 assert.ok(text.includes('NOT A FINAL CLOSE'));
 assert.ok(text.includes('USD 100.00'));
 assert.ok(text.includes('Unknown'));
 assert.ok(text.includes('Mercury: partial'));
 assert.ok(text.includes('bank statement'));
 assert.ok(!text.includes('private-account-number'));
 assert.ok(!text.includes('Sensitive bank'));
 assert.ok(!text.includes('USD 500'));
});
