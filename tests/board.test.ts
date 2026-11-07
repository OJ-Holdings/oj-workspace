import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesCard, updateCard, validateCard, taskBusinessLabel, taskBusinessColor } from '../src/lib/board';
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

test('General is a supported task business that appears on every board', () => {
  const original = sampleData.cards[0];
  const general = validateCard({ ...original, id: 'general-1', business: 'general' });
  assert.equal(general.business, 'general');
  assert.equal(taskBusinessLabel('general'), 'General');
  assert.equal(taskBusinessLabel('general', true), 'General (all businesses)');
  assert.equal(taskBusinessColor('general'), 'var(--c-general)');
  for (const filter of ['all', 'general', 'exterior', 'solutions', 'essentials', 'content']) {
    assert.equal(matchesCard(general, filter, '', ''), true, `General tasks must appear for ${filter}`);
  }
  assert.equal(matchesCard(original, 'general', '', ''), false, 'A General-only filter must not include other businesses');
  assert.throws(() => validateCard({ ...original, business: 'random' }), /Invalid card selection/);
});

test('Task business can change from one brand to General and back, preserving revision control', () => {
  const original = sampleData.cards[0];
  const asGeneral = updateCard([original], { ...original, business: 'general' })[0];
  assert.equal(asGeneral.business, 'general');
  assert.equal(asGeneral.revision, original.revision + 1);
  const back = updateCard([asGeneral], { ...asGeneral, business: 'solutions' })[0];
  assert.equal(back.business, 'solutions');
  assert.equal(back.revision, original.revision + 2);
});
