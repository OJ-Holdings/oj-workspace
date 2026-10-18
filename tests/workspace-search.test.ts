import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchWorkspace } from '../src/lib/workspace-search';
import { emptyDashboard, type Dashboard } from '../src/lib/dashboard';
import type { Card } from '../src/lib/board';

const card: Card = { id: 'task-1', organization_id: 'authorized-org', title: 'Oak Street quote', description: 'Pressure wash driveway', business: 'exterior', stage: 'Ready', priority: 'normal', assignee: 'Jacob', due_date: '', revision: 0, checklist: [] };
const dashboard: Dashboard = {
  ...emptyDashboard,
  leads: [{ id: 'lead-1', venture: 'solutions', name: 'Oak Street Dental', contact: 'hello@dental.test', stage: 'Proposal', value: null, source: 'Referral', notes: 'Receptionist pilot', created_at: '2026-10-01T12:00:00Z' }],
  documents: [{ id: 'doc-1', venture: 'essentials', name: 'Oak Street agreement.pdf', tag: 'contract', storage_path: 'private/object/hidden-storage-path', size_bytes: 100, mime: 'application/pdf', uploaded_by: 'Oscar', created_at: '2026-10-01T12:00:00Z' }],
  messages: [{ id: 'message-1', venture: null, author: 'Oscar', body: 'Oak Street update: ready for review', created_at: '2026-10-01T12:00:00Z' }],
  events: [{ id: 'event-1', venture: 'exterior', title: 'Oak Street visit', starts_at: '2026-10-05T12:00:00Z', ends_at: null, all_day: false, location: 'Lake Geneva', notes: 'Bring samples', }],
};

test('global search matches all five authorized record sources and preserves business context', () => {
  const records = searchWorkspace('  OAK STREET ', [card], dashboard);
  assert.deepEqual(records.map(r => [r.kind, r.venture, r.path]), [
    ['Task', 'exterior', '/tasks?task=task-1'],
    ['Lead', 'solutions', '/crm?lead=lead-1'],
    ['Document', 'essentials', '/files?document=doc-1'],
    ['Message', null, '/messages?message=message-1'],
    ['Event', 'exterior', '/calendar?event=event-1'],
  ]);
  assert.equal(records[0].detail, 'Ready / Jacob');
});

test('empty or unavailable data never produces sample or stale records', () => {
  assert.deepEqual(searchWorkspace('', [card], dashboard), []);
  assert.deepEqual(searchWorkspace(' \n ', [card], dashboard), []);
  assert.deepEqual(searchWorkspace('Oak', [], null), []);
  assert.deepEqual(searchWorkspace('Oak', [], undefined), []);
  assert.deepEqual(searchWorkspace('Oak', [card], null).map(r => r.kind), ['Task']);
  assert.deepEqual(searchWorkspace('Oak', [], emptyDashboard), []);
});

test('context fields are searchable without exposing storage paths or unrequested metrics', () => {
  for (const [query, expected] of [['Jacob', 'Task'], ['driveway', 'Task'], ['Referral', 'Lead'], ['hello@dental.test', 'Lead'], ['Receptionist', 'Lead'], ['contract', 'Document'], ['Oscar', 'Message'], ['Lake Geneva', 'Event'], ['samples', 'Event']]) {
    assert.deepEqual(searchWorkspace(query, [card], dashboard).map(r => r.kind), [expected]);
  }
  assert.deepEqual(searchWorkspace('hidden-storage-path', [], dashboard), []);
  assert.deepEqual(searchWorkspace('never supplied customer', [], dashboard), []);
});

test('record IDs remain query values instead of becoming routes or additional parameters', () => {
  const unsafeId = 'x&task=other#/../?';
  const result = searchWorkspace('Oak', [{ ...card, id: unsafeId }], null)[0];
  assert.equal(new URL(result.path, 'https://workspace.test').pathname, '/tasks');
  const params = new URL(result.path, 'https://workspace.test').searchParams;
  assert.equal(params.get('task'), unsafeId);
  assert.equal(params.size, 1);
});

test('search leaves input unchanged, bounds results, and keeps duplicate IDs from different sources', () => {
  const original = JSON.stringify({ card, dashboard });
  const combined = { ...dashboard, messages: [{ ...dashboard.messages[0], id: card.id, body: 'Oak '.repeat(40) }] };
  const records = searchWorkspace('Oak', [card], combined);
  assert.equal(records.filter(r => r.id === card.id).length, 2);
  assert.equal(records.find(r => r.kind === 'Message')!.title.length, 100);
  assert.equal(searchWorkspace('Oak', Array.from({ length: 40 }, (_, i) => ({ ...card, id: `task-${i}` })), dashboard).length, 30);
  assert.equal(JSON.stringify({ card, dashboard }), original);
});
