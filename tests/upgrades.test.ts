import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tier, toggleUpgrade, upgradeCount, upgradeGroups, upgradeStatus } from '../src/lib/upgrades';

test('the upgrade list is whole: unique ids and every dependency exists', () => {
  const ids = upgradeGroups.flatMap(g => g.nodes.map(n => n.id));
  assert.equal(ids.length, 113);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(upgradeCount, ids.length);
  for (const n of upgradeGroups.flatMap(g => g.nodes)) for (const d of n.deps) assert.ok(ids.includes(d), `${n.id} depends on ${d}`);
});

test('an upgrade is ready only when everything it depends on is done', () => {
  const s = upgradeStatus({ eq_safety: true });
  assert.equal(s.eq_safety, 'done');
  assert.equal(s.eq_yamaha, 'ready');
  assert.equal(s.eq_hose100, 'locked');
  assert.equal(s.svc_win, 'locked', 'needs both pressure washing and the squeegee kit');
});

test('unticking removes everything that depended on it and nothing else', () => {
  const start = { eq_safety: true, eq_yamaha: true, eq_hose100: true, eq_ghose: true, brand_name: true } as const;
  const { next, removed } = toggleUpgrade(start, 'eq_yamaha');
  assert.deepEqual(Object.keys(next).sort(), ['brand_name', 'eq_ghose', 'eq_safety']);
  assert.deepEqual(removed.sort(), ['eq_hose100', 'eq_yamaha']);
  assert.deepEqual(toggleUpgrade(next, 'eq_yamaha').next.eq_yamaha, true);
  assert.equal(tier(0), 'Rookie');
  assert.equal(tier(43), 'Rising');
});
