import assert from 'node:assert/strict';
import test from 'node:test';
import { commandPulse } from '../src/lib/command-pulse';
import type { ExteriorData, ExtLead } from '../src/lib/exterior';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const NOW = Date.parse('2026-10-27T18:00:00Z');
const lead = (id: string, over: Partial<ExtLead> = {}): ExtLead => ({ id, name: id, phone: null, address: null, service_requested: null, quote_amount: null, status: 'new', source: null, notes: null, job_revenue: null, job_cost: null, created_at: '2026-10-27T17:55:00Z', updated_at: null, completed_at: null, ...over });
const data = (leads: ExtLead[]): ExteriorData => ({ leads, bookings: [], sessions: [], activity: [], extras: null });
const job = (date: string, quote: number | null): JobItem => ({ id: date + quote, lead_id: 'l', date, time_block: '', status: 'confirmed', name: 'A', service: null, address: null, quote });

test('ticker: month revenue, jobs done, average and close rate', () => {
  const p = commandPulse(data([
    lead('a', { status: 'completed', job_revenue: 300, completed_at: '2026-10-05T15:00:00Z' }),
    lead('b', { status: 'completed', job_revenue: 100, completed_at: '2026-10-06T15:00:00Z' }),
    lead('c', { status: 'completed', job_revenue: 999, completed_at: '2026-09-06T15:00:00Z' }),
    lead('d', { status: 'closed' }), lead('e', { status: 'closed' }),
  ]), [], '2026-10-27', NOW);
  assert.equal(p.ticker.revenue, 400);
  assert.equal(p.ticker.jobsDone, 2);
  assert.equal(p.ticker.avgJob, 200);
  assert.equal(p.ticker.closeRate, 3 / 5);
});

test('no decided leads means no close rate, and nothing to flag means no exceptions', () => {
  const p = commandPulse(data([lead('a')]), [], '2026-10-27', NOW);
  assert.equal(p.ticker.closeRate, null);
  assert.equal(p.ticker.avgJob, null);
  assert.deepEqual(p.exceptions, []);
});

test('exceptions appear only when counted', () => {
  const p = commandPulse(data([
    lead('late', { created_at: '2026-10-27T10:00:00Z' }),
    lead('cold', { status: 'contacted', quote_amount: 400, updated_at: '2026-10-20T10:00:00Z' }),
    lead('fin', { status: 'completed', completed_at: '2026-10-01T10:00:00Z' }),
  ]), [job('2026-10-28', null), job('2026-10-28', 200), job('2026-11-20', null)], '2026-10-27', NOW);
  assert.deepEqual(p.exceptions.map(e => e.id), ['late-leads', 'cold', 'no-quote', 'figures']);
  assert.match(p.exceptions[2].text, /^1 job /);
});

test('overdue invoices become an exception and the open amount is carried; without invoices it is null', () => {
  const p = commandPulse(data([]), [], '2026-10-27', NOW, { openCents: 250000, overdueCents: 120000, overdueCount: 2 });
  assert.deepEqual(p.exceptions.map(e => e.id), ['overdue-invoices']);
  assert.match(p.exceptions[0].text, /^2 invoices overdue, \$1,200 owed$/);
  assert.equal(p.owedCents, 250000);
  assert.equal(commandPulse(data([]), [], '2026-10-27', NOW).owedCents, null);
  assert.deepEqual(commandPulse(data([]), [], '2026-10-27', NOW, { openCents: 0, overdueCents: 0, overdueCount: 0 }).exceptions, []);
});
