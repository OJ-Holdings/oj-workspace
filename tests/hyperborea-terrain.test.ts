import assert from 'node:assert/strict';
import test from 'node:test';
import { makeNoise, makeRoute, makeTerrain, routeAt, routeTop, worldYFor } from '../src/lib/hyperborea-terrain';

const terrain = makeTerrain();
const route = makeRoute(terrain);

test('noise is seeded, bounded and repeatable', () => {
  const a = makeNoise(1), b = makeNoise(1), c = makeNoise(2);
  for (let i = 0; i < 200; i++) { const x = i * 0.37, y = i * 0.11; assert.equal(a(x, y), b(x, y)); assert.ok(Math.abs(a(x, y)) <= 1.2); }
  assert.notEqual(a(3.3, 4.4), c(3.3, 4.4));
});

test('the route starts on the plain, only climbs, and ends on the peak', () => {
  assert.ok(route[0].climb < 1);
  for (let i = 1; i < route.length; i++) assert.ok(route[i].climb >= route[i - 1].climb);
  assert.ok(Math.abs(routeTop(route) - terrain.height(0, 0)) < 1e-9);
  let max = 0; for (let x = -60; x <= 60; x += 2) for (let z = -60; z <= 60; z += 2) max = Math.max(max, terrain.height(x, z));
  assert.ok(max - routeTop(route) < 5, 'nothing near the summit towers over it');
});

test('altitudes map onto the route in order', () => {
  let last = -1;
  for (const m of [0, 2500, 4000, 5500, 6500, 8000, 8849]) {
    const p = routeAt(route, worldYFor(route, m, 8849));
    assert.ok(p.index >= last); last = p.index;
  }
  assert.equal(worldYFor(route, -50, 8849), route[0].climb);
  assert.equal(worldYFor(route, 99999, 8849), routeTop(route));
});
