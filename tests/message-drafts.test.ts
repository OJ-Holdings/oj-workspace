import assert from 'node:assert/strict';
import test from 'node:test';
import { groupDrafts, messageDrafts } from '../src/lib/message-drafts';
import type { ExteriorData, ExtBooking, ExtLead } from '../src/lib/exterior';

const NOW = Date.parse('2026-10-27T18:00:00Z');
const TODAY = '2026-10-27';
const lead = (id: string, over: Partial<ExtLead> = {}): ExtLead => ({ id, name: id, phone: '+14145550100', address: null, service_requested: 'House Washing', quote_amount: 300, status: 'new', source: null, notes: null, job_revenue: null, job_cost: null, created_at: '2026-10-27T17:50:00Z', updated_at: null, completed_at: null, ...over });
const booking = (id: string, lead_id: string, date: string, status = 'confirmed'): ExtBooking => ({ id, lead_id, date, time_block: '9-11', status });
const data = (leads: ExtLead[], bookings: ExtBooking[] = []): ExteriorData => ({ leads, bookings, sessions: [], activity: [], extras: null });
const make = (d: ExteriorData, from = 'Oscar') => messageDrafts(d, TODAY, NOW, from);

test('a new lead gets a reply that names the service, signed by the sender', () => {
  const d = make(data([lead('fay akindes')]));
  assert.equal(d.length, 1);
  assert.equal(d[0].kind, 'new-lead');
  assert.match(d[0].body, /^Hi Fay, thanks for reaching out to OJ Exterior Care about house washing\. Oscar, OJ Exterior Care here\./);
});

test('quote follow-ups change wording at day 3, 7 and 14 and include the quoted amount', () => {
  const q = (days: number) => make(data([lead('bill', { status: 'contacted', updated_at: new Date(NOW - days * 86_400_000).toISOString() })]))[0];
  assert.match(q(3).body, /Just checking in on the house washing quote \(\$300\)/);
  assert.match(q(8).body, /following up on the house washing quote/);
  assert.match(q(15).body, /last check-in/);
  assert.notEqual(q(3).id, q(8).id);
});

test('tomorrow\'s confirmed jobs get a reminder with the day and time; other days and unconfirmed jobs do not', () => {
  const d = make(data([lead('tom', { status: 'booked' })], [booking('1', 'tom', '2026-10-28'), booking('2', 'tom', '2026-10-29'), booking('3', 'tom', '2026-10-28', 'pending_approval')]));
  const r = d.filter(x => x.kind === 'reminder');
  assert.equal(r.length, 1);
  assert.match(r[0].body, /Wednesday, Oct 28, 9 to 11 AM for house washing/);
});

test('thank-yous go to jobs finished one to three days ago, never today or older; a rebook note goes to a customer not served in 11+ months', () => {
  const d = make(data([
    lead('a', { status: 'completed', completed_at: '2026-10-25T15:00:00Z' }),
    lead('b', { status: 'completed', completed_at: '2026-10-27T15:00:00Z', phone: '+14145550111' }),
    lead('c', { status: 'completed', completed_at: '2026-10-10T15:00:00Z', phone: '+14145550122' }),
    lead('d', { status: 'completed', completed_at: '2025-08-01T15:00:00Z', phone: '+14145550133' }),
  ]));
  assert.deepEqual(d.filter(x => x.kind === 'thanks').map(x => x.lead.id), ['a']);
  assert.deepEqual(d.filter(x => x.kind === 'rebook').map(x => x.lead.id), ['d']);
  assert.match(d.find(x => x.kind === 'rebook')!.body, /about a year since we did your house washing/);
});

test('missing facts are left out, not invented; with no sender name it signs as the company', () => {
  const d = make(data([lead('x', { service_requested: null, quote_amount: 300, status: 'contacted', updated_at: new Date(NOW - 4 * 86_400_000).toISOString() })]), '')[0];
  assert.match(d.body, /Just checking in on the quote \(\$300\)\./);
  assert.match(d.body, /it is OJ Exterior Care\./);
  assert.doesNotMatch(d.body, /undefined|null|the  /);
});

test('groups come out in working order and empty groups are dropped', () => {
  const d = make(data([lead('n1'), lead('t', { status: 'booked' })], [booking('1', 't', '2026-10-28')]));
  assert.deepEqual(groupDrafts(d).map(g => g.kind), ['reminder', 'new-lead']);
});

test('greetings use a first name, a title and last name, or no name; punctuation is dropped', () => {
  const hi = (name: string | null) => make(data([lead('z', { name })]))[0].body.split(',')[0];
  assert.equal(hi('Dr Jim James'), 'Hi Dr James');
  assert.equal(hi('Sample: Garden terrace'), 'Hi Sample');
  assert.equal(hi('fay'), 'Hi Fay');
  assert.equal(hi(null), 'Hi there');
  assert.equal(hi('Mrs.'), 'Hi Mrs');
});
