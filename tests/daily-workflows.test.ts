import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contactsMarkedToday, outreachNextStep, selectProspects, type OutreachActivity, type OutreachProspect } from '../src/lib/outreach';
import { todayTasks } from '../src/lib/today';
import type { Card } from '../src/lib/board';
import { deriveMetrics, emptyDashboard } from '../src/lib/dashboard';

const prospect = (id: string, changes: Partial<OutreachProspect> = {}): OutreachProspect => ({
  id, organization_id: 'org', source_key: id, source_row: 2, business_name: 'Example Dental', industry: 'Dental', city_state: 'Kenosha',
  website_url: null, phone_number: null, decision_maker: null, best_fit_service: 'AI Receptionist', secondary_fit: null, leak: null, evidence: null,
  email: null, instagram: null, facebook: null, email_subject: null, email_body: null, dm: null, date_added: '2020-01-01', sent_by: 'Oscar',
  source_status: 'Not Sent', source_notes: null, outreach_status: null, outreach_notes: '', status_updated_at: null, created_at: '', updated_at: '', last_seen_at: '', ...changes,
});
const activity = (id: string, at: string, status: OutreachActivity['new_status'] = 'Emailed'): OutreachActivity => ({ id: `${id}-${at}`, prospect_id: id, actor_id: 'actor', previous_status: 'Not Sent', new_status: status, created_at: at });

test('daily contact count uses Central activity dates, not prospect import dates or resolution', () => {
  const rows = [activity('old-prospect', '2026-10-19T04:59:59Z'), activity('tomorrow', '2026-10-19T05:00:00Z'),
    activity('reply', '2026-10-18T20:00:00Z', 'Replied'), activity('dead', '2026-10-18T20:00:00Z', 'Dead'), activity('bad', 'invalid')];
  assert.equal(contactsMarkedToday(rows, new Date('2026-10-19T04:59:59Z')), 1);
  assert.equal(contactsMarkedToday(rows, new Date('2026-10-19T05:00:00Z')), 1);
  assert.equal(contactsMarkedToday([], new Date('2026-10-18T20:00:00Z')), 0);
});

test('contact markings count a prospect once across channels and use DST-aware days', () => {
  assert.equal(contactsMarkedToday([activity('a', '2026-11-01T05:30:00Z'), activity('a', '2026-11-01T07:30:00Z', 'DMed'), activity('b', '2026-11-02T05:59:59Z'), activity('c', '2026-11-02T06:00:00Z')], new Date('2026-11-01T18:00:00Z')), 2);
});

test('Today schedule agrees with Central task dates around UTC midnight', () => {
  const event = (id: string, at: string) => ({ id, title: id, venture: null, starts_at: at, ends_at: null, all_day: false, location: '', notes: '' });
  const metrics = deriveMetrics({ ...emptyDashboard, events: [event('tonight', '2026-10-19T04:30:00Z'), event('tomorrow', '2026-10-19T05:30:00Z')] }, [card('due', { due_date: '2026-10-18' })], new Date('2026-10-19T04:45:00Z'));
  assert.deepEqual(metrics.schedule?.map(s => [s.title, s.time]), [['tonight', '23:30'], ['due', 'Due']]);
});

test('prospect queues combine research search, person, status and workspace overrides', () => {
  const rows = [prospect('a'), prospect('b', { sent_by: 'Jacob', outreach_status: 'Replied' }), prospect('c', { source_status: 'Demo Booked' })];
  assert.deepEqual(selectProspects(rows, ' receptionist ', 'Oscar', '', 'pending').map(p => p.id), ['a']);
  assert.deepEqual(selectProspects(rows, '', '', '', 'replies').map(p => p.id), ['b']);
  assert.deepEqual(selectProspects(rows, '', '', '', 'demos').map(p => p.id), ['c']);
  assert.deepEqual(selectProspects(rows, 'nonexistent', '', '', 'all'), []);
  assert.equal(selectProspects(rows, '', '', 'Not Sent', 'all').length, 1);
  assert.equal(outreachNextStep('Dead'), 'Resolved');
  assert.equal(outreachNextStep('Demo Booked'), 'Prepare the demo');
});

const card = (id: string, patch: Partial<Card> = {}): Card => ({ id, title: id, business: 'solutions', stage: 'Ready', priority: 'normal', due_date: '', assignee: 'Oscar', ...patch } as Card);
test('Today prioritizes overdue then due then review without treating future deadlines as due', () => {
  const rows = [card('high', { priority: 'high', due_date: '2026-11-01' }), card('review', { stage: 'Review' }), card('due', { due_date: '2026-10-18' }), card('late', { due_date: '2026-10-17' }), card('done', { stage: 'Done', due_date: '2026-10-17' }), card('future', { due_date: '2026-10-19' })];
  assert.deepEqual(todayTasks(rows, '2026-10-18').map(c => c.id), ['late', 'due', 'review', 'high']);
  assert.equal(todayTasks(rows, '2026-10-18', 'Jacob').length, 0);
  assert.deepEqual(todayTasks(rows, '').map(c => c.id).sort(), ['high', 'review']);
});
