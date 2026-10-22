import assert from 'node:assert/strict';
import test from 'node:test';
import { brief, calculateEstimate, newEstimate, newSite } from '../src/lib/commercial-estimate';

test('margin is margin of price, not markup on direct cost', () => {
  const input=newEstimate();
  input.sites=[{...newSite(),crewHours:10,liftDays:0}];
  input.laborRate=40; input.contingency=0; input.margin=20;
  const result=calculateEstimate(input);
  assert.equal(result.labor,400);
  assert.equal(result.suggestedPrice,500);
  assert.equal(result.contribution,100);
});
test('aggregates building quantities and rental costs',()=>{
  const input=newEstimate();
  input.sites=[{...newSite('a'),panes:120,levels:3,crewHours:12,liftDays:2},
    {...newSite('b'),panes:80,levels:2,crewHours:6,liftDays:1}];
  const result=calculateEstimate(input);
  assert.equal(result.panes,200);
  assert.equal(result.floors,5);
  assert.equal(result.crewHours,18);
  assert.equal(result.equipment,1050);
});
test('missing cost inputs stay within bounded non-negative arithmetic',()=>{
  const input=newEstimate(); input.margin=100; input.materials=Infinity;
  input.sites=[{...newSite(),crewHours:-99}];
  const result=calculateEstimate(input);
  assert.ok(Number.isFinite(result.suggestedPrice));
  assert.equal(result.labor,0);
  assert.equal(result.materials,0);
  assert.equal(result.margin,90);
});
test('deposit is a proposed fraction, not collected money',()=>{
  const input=newEstimate();input.sites=[{...newSite(),crewHours:0}];input.margin=0;
  input.materials=1000;input.contingency=0;input.deposit=25;
  assert.equal(calculateEstimate(input).depositAmount,250);
});
test('exported brief is explicitly internal',()=>{
  const b=brief('Apartment campus',newEstimate());
  assert.match(b,/INTERNAL ESTIMATE ONLY/);
  assert.match(b,/NOT A SENT QUOTE/);
  assert.match(b,/not business net profit/);
});
