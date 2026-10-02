import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesCard, updateCard, validateCard } from '../src/lib/board';
import { sampleData } from '../src/lib/sample';
test('Moving a card preserves its checklist, assignee and organization', () => {
  const original = structuredClone(sampleData.cards);
  const moved = updateCard(original, { ...original[0], stage: 'Review' });
  assert.equal(moved[0].stage, 'Review');
  assert.equal(moved[0].revision, 1);
  assert.deepEqual(moved[0].checklist, original[0].checklist);
  assert.equal(moved[0].assignee, original[0].assignee);
  assert.equal(original[0].stage, 'Ready');
});
test('Stale revisions and changing the workspace are rejected', () => {
  const card = sampleData.cards[0];
  const next = updateCard([card], { ...card, title: 'New title' });
  assert.throws(() => updateCard(next, card), /changed/);
  assert.throws(() => updateCard([card], { ...card, organization_id: 'other' }), /changed/);
});
test('Business, owner and search filters combine', () => {
  const results = sampleData.cards.filter(c => matchesCard(c, 'exterior', 'window', 'Oscar'));
  assert.equal(results.length, 1);
  assert.equal(sampleData.cards.filter(c => matchesCard(c, 'solutions', 'window', '')).length, 0);
});
test('Invalid dates, oversized inputs and malformed checklists fail', () => {
  const c = sampleData.cards[0];
  assert.throws(() => validateCard({ ...c, due_date: '2026-02-30' }));
  assert.throws(() => validateCard({ ...c, title: ' '.repeat(5) }));
  assert.throws(() => validateCard({ ...c, title: 'x'.repeat(181) }));
  assert.throws(() => validateCard({ ...c, checklist: [{ id: 'a', text: 'task', done: 'yes' }] }));
});
