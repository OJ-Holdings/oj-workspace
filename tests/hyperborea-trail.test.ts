import assert from 'node:assert/strict';
import test from 'node:test';
import {boundedZoom,trailSteps,trailWindow} from '../src/lib/hyperborea-trail';
import {altitudeFor} from '../src/lib/hyperborea';
const steps=trailSteps();
test('dense steps span the complete ascent without duplicate IDs or unearned claims',()=>{
  assert.equal(steps.length,1770);assert.equal(steps[0].altitude,5);assert.equal(steps.at(-1)?.altitude,8849);
  assert.equal(new Set(steps.map(s=>s.id)).size,steps.length);
  for(let i=1;i<steps.length;i++){
    assert.ok(steps[i].altitude>steps[i-1].altitude);assert.ok(steps[i].revenue>steps[i-1].revenue);
    assert.equal(altitudeFor(steps[i].revenue),steps[i].altitude);
  }
  assert.equal(steps.filter(s=>s.altitude>1670&&s.altitude<1955).length,56);
});
test('trail browser reaches every five-meter step independently of camera angle',()=>{
  for(const step of steps)assert.ok(trailWindow(steps,step.altitude).some(s=>s.id===step.id));
  assert.equal(trailWindow(steps,-1000)[0].altitude,5);
  assert.equal(trailWindow(steps,99999).at(-1)?.altitude,8849);
  assert.equal(trailWindow(steps,NaN,-3).length,1);
  assert.ok(trailWindow(steps,4000,Infinity).length<=101);
});
test('close zoom is bounded and never accepts nonfinite or negative factors',()=>{
  assert.equal(boundedZoom(1,0.7),0.7);assert.equal(boundedZoom(1,0.001),0.1);
  assert.equal(boundedZoom(1,100),2.5);assert.equal(boundedZoom(1,NaN),1);assert.equal(boundedZoom(1,-1),1);
});
