import assert from 'node:assert/strict';
import test from 'node:test';
import { commandIntents } from '../src/lib/command-intents';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const job = (id: string, name: string, date: string, over: Partial<JobItem> = {}): JobItem => ({ id, lead_id: 'lead-' + id, date, time_block: '', status: 'confirmed', name, service: null, address: '1 Main St', quote: null, ...over });
const jobs = [job('1', 'Fay Akindes', '2026-10-26'), job('2', 'Patrick', '2026-10-26'), job('3', 'Patrick', '2026-10-15'), job('4', 'Bill', '2026-10-15', { status: 'cancelled' })];
const run = (q: string) => commandIntents(q, jobs, '2026-10-27', '/workspace');

test('complete and invoice open the right job and start the right invoice', () => {
  assert.deepEqual(run('complete fay').map(i => i.href), ['/workspace/b/exterior/bookings?booking=1']);
  assert.deepEqual(run('invoice fay').map(i => i.href), ['/workspace/invoices?lead=lead-1']);
});

test('log a cost reads the amount and the kind, in any order and with a dollar sign', () => {
  assert.equal(run('log $84 chemicals on patrick')[0].href, '/workspace/b/exterior/bookings?booking=2&cost=84&kind=materials');
  assert.equal(run('log patrick fuel 40.5')[0].href, '/workspace/b/exterior/bookings?booking=2&cost=40.5&kind=fuel');
  assert.equal(run('log 20 patrick')[0].href.endsWith('&cost=20&kind=other'), true);
});

test('with several matches the job closest to today comes first, and cancelled jobs are never offered', () => {
  assert.deepEqual(run('complete patrick').map(i => i.id), ['complete-2', 'complete-3']);
  assert.deepEqual(run('complete bill'), []);
});

test('no verb, no name, or a cost with no amount gives nothing; directions need an address', () => {
  assert.deepEqual(run('fay'), []);
  assert.deepEqual(run('complete'), []);
  assert.deepEqual(run('log chemicals patrick'), []);
  assert.equal(commandIntents('directions fay', [job('1', 'Fay', '2026-10-26', { address: null })], '2026-10-27', '/workspace').length, 0);
  assert.equal(run('directions fay')[0].external, true);
});
