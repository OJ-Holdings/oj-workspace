import assert from 'node:assert/strict';
import test from 'node:test';
import { draftTotals, effectiveStatus, followUp, summariseProposals, type DraftLine, type Proposal } from '../src/lib/proposals';

const line = (description: string, price: string, over: Partial<DraftLine> = {}): DraftLine => ({ description, detail: '', quantity: '1', price, optional: false, ...over });
const prop = (over: Partial<Proposal> = {}): Proposal => ({ id: 'p', number: 'OJ-2026-0001', division: 'exterior', lead_id: null, customer_name: 'ND Cleaning', customer_email: null, site_address: '', status: 'sent', valid_until: '2026-11-30', payment_terms: '', terms: '', exclusions: '', notes: '', subtotal_cents: 3940000, discount_cents: 0, total_cents: 3940000, sent_on: '2026-10-20', decided_on: null, decision_note: '', created_at: '2026-10-20T00:00:00Z', lines: [], ...over });

test('totals leave optional lines out and take the discount off the subtotal', () => {
  const t = draftTotals([line('Facility A', '950'), line('Facility B', '1,950'), line('Semiannual maintenance', '2350', { optional: true })], '150');
  assert.deepEqual([t.subtotalCents, t.optionalCents, t.discountCents, t.totalCents, t.problem], [290000, 235000, 15000, 275000, null]);
});

test('quantities multiply, blank rows are ignored, and each problem is named', () => {
  assert.equal(draftTotals([line('Panes', '11.50', { quantity: '108' }), line('', '')], '').subtotalCents, 124200);
  assert.match(draftTotals([line('', '100')], '').problem ?? '', /description/);
  assert.match(draftTotals([line('A', 'abc')], '').problem ?? '', /price and a quantity/);
  assert.match(draftTotals([line('Opt', '100', { optional: true })], '').problem ?? '', /not optional/);
  assert.match(draftTotals([line('A', '100')], '100').problem ?? '', /less than the subtotal/);
  assert.match(draftTotals([line('A', '100')], 'x').problem ?? '', /discount/);
});

test('a sent proposal past its date reads as expired; others keep their status', () => {
  assert.equal(effectiveStatus(prop({ valid_until: '2026-10-01' }), '2026-10-27'), 'expired');
  assert.equal(effectiveStatus(prop(), '2026-10-27'), 'sent');
  assert.equal(effectiveStatus(prop({ status: 'accepted', valid_until: '2026-10-01' }), '2026-10-27'), 'accepted');
});

test('follow-up steps run at day 3, 7 and 14 from the sent date, and only while it waits for a reply', () => {
  assert.equal(followUp(prop({ sent_on: '2026-10-26' }), '2026-10-27'), null);
  assert.deepEqual(followUp(prop({ sent_on: '2026-10-24' }), '2026-10-27'), { days: 3, step: 'Day 3: first nudge' });
  assert.equal(followUp(prop({ sent_on: '2026-10-20' }), '2026-10-27')?.step, 'Day 7: second nudge');
  assert.equal(followUp(prop({ sent_on: '2026-10-10' }), '2026-10-27')?.step, 'Day 14: last check-in');
  assert.equal(followUp(prop({ status: 'accepted' }), '2026-10-27'), null);
});

test('the pipeline counts what is out, won, drafted and due a nudge', () => {
  const s = summariseProposals([prop(), prop({ id: 'b', status: 'accepted', total_cents: 275000 }), prop({ id: 'c', status: 'draft' }), prop({ id: 'd', valid_until: '2026-10-01' })], '2026-10-27');
  assert.deepEqual([s.outCount, s.outCents, s.wonCount, s.wonCents, s.draftCount, s.needNudge], [1, 3940000, 1, 275000, 1, 1]);
});
