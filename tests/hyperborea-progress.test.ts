import assert from 'node:assert/strict';
import test from 'node:test';
import type { FinanceEntry } from '../src/lib/dashboard';
import { altitudeFor, camps } from '../src/lib/hyperborea';
import { daysToReach } from '../src/lib/hyperborea-journal';
import { climbRequirement, periodProgress, periodStart, revenueForAltitude, trailAchievements } from '../src/lib/hyperborea-progress';
let n=0;
const rev=(amount:number,occurred_on:string):FinanceEntry=>({id:String(++n),amount,occurred_on,venture:'exterior',kind:'revenue',category:'Jobs',note:''});

test('rolling forecast never accumulates projected revenue beyond one year',()=>{
  assert.equal(daysToReach([rev(3195,'2026-10-01')],'2026-10-27',40_000),null);
  const days=daysToReach([rev(9000,'2026-10-01')],'2026-10-27',20_000);
  assert.ok(days!==null&&days<=365);
  // A large older amount may briefly permit a target above the eventual run rate.
  assert.ok(daysToReach([rev(100000,'2026-05-01'),rev(9000,'2026-10-01')],'2026-10-27',110_000)!<=365);
});
test('period movement reconciles entering and expired revenue, not just new receipts',()=>{
  const p=periodProgress([rev(10000,'2025-10-27'),rev(1000,'2026-10-27')],'2026-10-27','24h');
  assert.equal(p.entered.length,1);assert.equal(p.expired.length,1);
  assert.equal(p.revenueDelta,-9000);assert.equal(p.delta,altitudeFor(1000)-altitudeFor(10000));
  assert.equal(p.percent,-100);
});
test('all history and zero baselines never fabricate infinite percentages',()=>{
  const p=periodProgress([rev(2000,'2026-01-10'),rev(100000,'2027-01-01')],'2026-10-27','All');
  assert.equal(p.from,'2026-01-09');assert.equal(p.percent,null);assert.equal(p.end,altitudeFor(2000));
  assert.equal(periodStart([], '2026-10-27','YTD'),'2025-12-31');
  assert.equal(periodProgress([],'2026-10-27','All').delta,0);
});
test('period chart preserves exact endpoints and bounded samples',()=>{
  const p=periodProgress([rev(1000,'2000-01-01'),rev(2000,'2026-10-27')],'2026-10-27','All');
  assert.ok(p.points.length<=182);assert.equal(p.points.at(-1)?.on,'2026-10-27');
  assert.equal(p.points.at(-1)?.altitude,p.end);
});
test('altitude inverse matches every anchor and a requested next climb',()=>{
  for(const c of camps.slice(1))assert.ok(Math.abs(revenueForAltitude(c.altitude)-c.revenue)<0.001);
  for(const a of [1,100,1330,2450,3000,5000,6200,8200])assert.equal(altitudeFor(revenueForAltitude(a)),a);
  assert.throws(()=>revenueForAltitude(NaN));
  const r=climbRequirement([rev(18870,'2026-10-01')],'2026-10-27',100);
  assert.equal(r.target,1430);assert.equal(altitudeFor(r.revenue),1430);assert.ok(r.gap>4600&&r.gap<4700);
});
test('climb accounts for income about to expire and clamps the summit',()=>{
  const f=[rev(5000,'2025-11-01'),rev(1000,'2026-10-01')];
  assert.equal(climbRequirement(f,'2026-10-27',100).expires30,5000);
  const r=climbRequirement([rev(100000000,'2026-10-01')],'2026-10-27',500);
  assert.equal(r.target,8849);assert.equal(r.gap,0);
});
test('achievements use crossing dates; future rows and unverified business claims cannot earn badges',()=>{
  const a=trailAchievements([rev(2000,'2026-10-01'),rev(4000,'2026-10-03'),rev(100000,'2027-01-01')],'2026-10-27',{exterior:'Exterior Care',solutions:'Solutions'});
  assert.ok(a.length>40);assert.equal(a.find(b=>b.id==='month-5000')?.on,'2026-10-03');
  assert.equal(a.find(b=>b.id==='total-10000')?.earned,false);
  assert.equal(a.find(b=>b.id==='venture-solutions')?.earned,false);
  for(const b of a.filter(b=>b.category!=='Revenue'))assert.equal(b.earned,null);
  assert.equal(new Set(a.map(b=>b.id)).size,a.length);
});
