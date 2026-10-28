import assert from 'node:assert/strict';
import test from 'node:test';
import { forecast } from '../src/lib/forecast';
import { anomalies } from '../src/lib/anomalies';
import type { ExteriorData, ExtBooking, ExtLead } from '../src/lib/exterior';

const TODAY = '2026-10-28';
const lead = (id: string, over: Partial<ExtLead> = {}): ExtLead => ({ id, name: id, phone: null, address: null, service_requested: 'House Washing', quote_amount: 300, status: 'new', source: null, notes: null, job_revenue: null, job_cost: null, created_at: '2026-10-01T12:00:00Z', updated_at: null, completed_at: null, ...over });
const booking = (id: string, lead_id: string, date: string, status = 'confirmed'): ExtBooking => ({ id, lead_id, date, time_block: '9-11', status });
const data = (leads: ExtLead[], bookings: ExtBooking[] = []): ExteriorData => ({ leads, bookings, sessions: [], activity: [], extras: null });

test('forecast: confirmed bookings in the window at their quote, the pipeline weighted by the win rate, last period for comparison', () => {
  const f = forecast(data([
    lead('a', { status: 'booked', quote_amount: 500 }), lead('b', { status: 'booked', quote_amount: null }), lead('c', { status: 'booked', quote_amount: 900 }),
    lead('open', { status: 'contacted', quote_amount: 1000 }),
    lead('won', { status: 'completed', job_revenue: 250, completed_at: '2026-10-15T15:00:00Z' }), lead('old', { status: 'completed', job_revenue: 999, completed_at: '2026-08-01T15:00:00Z' }),
    lead('lost1', { status: 'closed' }), lead('lost2', { status: 'closed' }),
  ], [booking('1', 'a', '2026-11-02'), booking('2', 'b', '2026-11-05'), booking('3', 'c', '2026-12-30'), booking('4', 'a', '2026-11-03', 'pending_approval')]), TODAY);
  assert.deepEqual(f.booked, { jobs: 2, quoted: 500, unquoted: 1 });
  // won/booked = 4 (3 booked + 1 completed... plus old completed = 5), closed = 2
  assert.equal(f.pipeline.winRate, 5 / 7);
  assert.equal(f.pipeline.expected, Math.round(1000 * (5 / 7)));
  assert.equal(f.expected, 500 + Math.round(1000 * (5 / 7)));
  assert.equal(f.lastPeriodRevenue, 250);
});

test('with too few decided leads the pipeline is left unweighted and no total is claimed', () => {
  const f = forecast(data([lead('open', { status: 'contacted', quote_amount: 800 }), lead('w1', { status: 'completed' }), lead('w2', { status: 'completed' }), lead('l1', { status: 'closed' })]), TODAY);
  assert.equal(f.pipeline.winRate, null);
  assert.equal(f.pipeline.expected, null);
  assert.equal(f.expected, null);
  assert.equal(f.pipeline.quoted, 800);
});

test('anomalies: a loss, a paid-versus-quote mismatch and an underpriced quote are flagged, loss first', () => {
  const leads = [
    ...[300, 320, 280, 310, 300].map((q, i) => lead(`p${i}`, { quote_amount: q, status: 'completed', job_revenue: q, job_cost: 20 })),
    lead('cheap', { status: 'booked', quote_amount: 120, name: 'Cheap Co' }),
    lead('loss', { status: 'completed', job_revenue: 100, job_cost: 160, quote_amount: 100, name: 'Loss Co' }),
    lead('typo', { status: 'completed', job_revenue: 30, quote_amount: 300, job_cost: 5, name: 'Typo Co' }),
  ];
  const a = anomalies(data(leads));
  assert.deepEqual(a.map(x => x.kind), ['loss', 'paid-vs-quote', 'underpriced']);
  assert.match(a[0].text, /^Loss Co: costs of \$160 were more than the \$100 it brought in\.$/);
  assert.match(a[2].text, /Cheap Co: \$120 for House Washing, where the usual quote is about \$300\./);
});

test('too few quotes means no "usual price", and clean records raise nothing', () => {
  assert.deepEqual(anomalies(data([lead('a', { quote_amount: 100, status: 'booked' }), lead('b', { quote_amount: 900 }), lead('c', { quote_amount: 900 })])), []);
  assert.deepEqual(anomalies(data([lead('ok', { status: 'completed', job_revenue: 300, job_cost: 40 })])), []);
});
