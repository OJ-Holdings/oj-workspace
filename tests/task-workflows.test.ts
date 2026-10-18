import { test } from 'node:test';
import assert from 'node:assert/strict';
import { selectTasks, suggestedWork, suggestionDraft, suggestionTask, taskMatchesFocus, undoTaskMove, workDay } from '../src/lib/task-workflows';
import { emptyDashboard, type Lead } from '../src/lib/dashboard';
import { updateCard, type Card } from '../src/lib/board';

const task: Card = { id: 't1', organization_id: 'test', title: 'Review quote', description: '', business: 'exterior', stage: 'Ready', priority: 'normal', assignee: '', due_date: '2026-10-03', revision: 0, checklist: [{ id: 'c1', text: 'Check address', done: true }] };
const lead: Lead = { id: 'l1', venture: 'solutions', name: 'Example customer', contact: '', stage: 'Proposal', value: null, source: '', notes: '', created_at: '2026-09-20T18:00:00Z' };

test('task triage uses Chicago day at UTC midnight and DST boundaries', () => {
  assert.equal(workDay(new Date('2026-10-04T02:00:00Z')), '2026-10-03');
  assert.equal(workDay(new Date('2026-11-01T07:30:00Z')), '2026-11-01');
  assert.equal(taskMatchesFocus(task, 'today', '2026-10-03'), true);
  assert.equal(taskMatchesFocus(task, 'overdue', '2026-10-03'), false);
  assert.equal(taskMatchesFocus({ ...task, stage: 'Done' }, 'overdue', '2026-10-04'), false);
  assert.equal(taskMatchesFocus({ ...task, due_date: '' }, 'overdue', '2026-10-04'), false);
});

test('business, text, owner and attention filters combine without changing source records', () => {
  const cards = [task, { ...task, id: 't2', assignee: 'Jacob', business: 'solutions' as const }, { ...task, id: 't3', stage: 'Done' as const }];
  assert.deepEqual(selectTasks(cards, 'solutions', ' quote ', 'Jacob', 'overdue', '2026-10-04').map(c => c.id), ['t2']);
  assert.deepEqual(selectTasks(cards, 'all', '', '', 'unassigned', '2026-10-04').map(c => c.id), ['t1']);
  assert.equal(cards[0].stage, 'Ready');
});

test('rules ignore won/lost leads, keep zero distinct from unknown, explain creation-age limits', () => {
  const dashboard = { ...emptyDashboard, leads: [lead, { ...lead, id: 'won', stage: 'Won' as const }, { ...lead, id: 'lost', stage: 'Lost' as const }, { ...lead, id: 'zero', value: 0, contact: 'Customer phone', created_at: '2026-10-04T12:00:00Z' }] };
  const suggestions = suggestedWork([], dashboard, '2026-10-04');
  assert.equal(suggestions.length, 2);
  assert.deepEqual(suggestions.map(s => s.rule), ['missing', 'older']);
  assert.match(suggestions[0].reason, /contact details and estimated value/);
  assert.match(suggestions[1].reason, /Last contact is not tracked/);
  assert.equal(suggestedWork([], { ...emptyDashboard, leads: [{ ...lead, contact: 'phone', value: 10, created_at: 'invalid' }] }, '2026-10-04').length, 0);
});

test('seven-day boundary is calendar based and future leads do not appear as older', () => {
  const dashboard = { ...emptyDashboard, leads: [{ ...lead, contact: 'phone', value: 1, created_at: '2026-09-27T23:00:00-05:00' }] };
  assert.equal(suggestedWork([], dashboard, '2026-10-03').length, 0);
  assert.equal(suggestedWork([], dashboard, '2026-10-04').length, 1);
  assert.equal(suggestedWork([], dashboard, '2026-09-20').length, 0);
});

test('task rules point at existing task rather than multiplying task records', () => {
  const suggestions = suggestedWork([task], null, '2026-10-04');
  assert.deepEqual(suggestions.map(s => s.rule), ['overdue', 'unassigned']);
  assert.ok(suggestions.every(s => s.existingTask?.id === task.id));
  assert.equal(suggestedWork([{ ...task, stage: 'Done' }], null, '2026-10-04').length, 0);
});

test('suggestion source IDs deduplicate exact lines, including completed earlier tasks', () => {
  const suggestions = suggestedWork([], { ...emptyDashboard, leads: [lead] }, '2026-10-04');
  const draft = suggestionDraft(suggestions[0], '/workspace');
  assert.match(draft.description!, /\/workspace\/crm\?lead=l1/);
  const created = { ...task, ...draft, id: 'created', stage: 'Done' as const };
  assert.equal(suggestionTask([created], 'missing:l1')?.id, 'created');
  assert.equal(suggestionTask([created], 'missing:l'), undefined);
  assert.equal(suggestionTask([{ ...created, description: 'Text containing [oj-work:missing:l1] is not a source line.' }], 'missing:l1'), undefined);
  assert.equal(suggestedWork([created], { ...emptyDashboard, leads: [lead] }, '2026-10-04')[0].existingTask?.id, 'created');
});

test('undo stage movement preserves task details and rejects intervening revisions', () => {
  const moved = updateCard([task], { ...task, stage: 'Review' })[0];
  const undone = updateCard([moved], undoTaskMove(moved, 1, 'Ready'))[0];
  assert.equal(undone.stage, 'Ready');
  assert.equal(undone.revision, 2);
  assert.deepEqual(undone.checklist, task.checklist);
  assert.throws(() => undoTaskMove({ ...moved, revision: 2, title: 'Changed by teammate' }, 1, 'Ready'), /changed after the move/);
});
