import assert from 'node:assert/strict';
import test from 'node:test';
import { altitudeHistory, badgeProgress, breakdown, campSchedule, daysToReach, ghostDueDate, milestones, objectives, totals, waypointTargets } from '../src/lib/hyperborea-journal';
import { altitudeFor, SUMMIT_DEADLINE } from '../src/lib/hyperborea';
import type { FinanceEntry } from '../src/lib/dashboard';

let n = 0;
const rev = (amount: number, occurred_on: string, venture: FinanceEntry['venture'] = 'exterior', category = 'Jobs'): FinanceEntry => ({ id: String(n++), venture, kind: 'revenue', amount, occurred_on, category, note: '' });
const cost = (amount: number, occurred_on: string, venture: FinanceEntry['venture'] = 'exterior'): FinanceEntry => ({ id: String(n++), venture, kind: 'cost', amount, occurred_on, category: 'Fuel', note: '' });
const names = { exterior: 'Exterior Care', solutions: 'Solutions', essentials: 'Essentials' };

const book = [
  rev(400, '2026-05-10'), rev(3000, '2026-06-12'), rev(7000, '2026-07-20'), rev(12000, '2026-08-05'),
  rev(500, '2026-08-20', 'solutions', 'Retainers'), rev(9000, '2026-09-14'), rev(6000, '2026-10-03'), rev(90, '2026-10-05', 'essentials', 'Orders'),
  cost(2000, '2026-08-01'), cost(1500, '2026-09-01'),
];
const today = '2026-10-27';

test('history: one point per month since the first revenue, altitude from trailing revenue', () => {
  const h = altitudeHistory(book, today);
  assert.deepEqual(h.map(p => p.month), ['2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10']);
  assert.equal(h[5].through, today);
  assert.equal(h[5].revenue, 37990);
  assert.equal(h[5].altitude, altitudeFor(37990));
  assert.equal(h[3].monthRevenue, 12500);
  assert.deepEqual(altitudeHistory([], today), []);
});

test('milestones: firsts, lifetime totals, month sizes and best months, in date order', () => {
  const m = milestones(book, today, names);
  const titles = m.map(x => x.title);
  assert.equal(titles[0], 'First recorded revenue');
  assert.ok(titles.includes('Solutions earns') && titles.includes('Essentials earns'));
  assert.ok(titles.includes('$10,000 earned, all time'));
  assert.ok(titles.includes('First $10,000 month'));
  assert.ok(!titles.some(t => t.includes('Camp')), 'no camp reached on $38K');
  for (let i = 1; i < m.length; i++) assert.ok(m[i - 1].on <= m[i].on);
});

test('totals never call missing costs zero', () => {
  const t = totals(book, today);
  assert.equal(t.lifetimeRevenue, 37990); assert.equal(t.lifetimeCosts, 3500);
  assert.equal(t.bestMonth?.month, '2026-08'); assert.equal(t.firstOn, '2026-05-10');
  assert.equal(totals([rev(5, '2026-10-01')], today).lifetimeCosts, null);
});

test('breakdown: shares, unknown margins, trend and run rate', () => {
  const b = breakdown(book, today, ['exterior', 'solutions', 'essentials'], names);
  assert.equal(b.ventures[0].venture, 'exterior');
  assert.ok(Math.abs(b.ventures.reduce((s, v) => s + v.share, 0) - 1) < 1e-9);
  assert.equal(b.ventures.find(v => v.venture === 'solutions')!.margin, null);
  assert.equal(b.ventures[0].margin, (37400 - 3500) / 37400);
  assert.equal(b.categories[0].name, 'Jobs');
  assert.ok(Math.abs(b.runRate - (12000 + 500 + 9000 + 6000 + 90) * 365 / 90) < 1e-6);
  assert.deepEqual(breakdown(book, today, ['exterior', 'content'], names).silent, ['content']);
});

test('days to reach: zero when already there, never with nothing recent, and ageing out counts', () => {
  assert.equal(daysToReach(book, today, 1000), 0);
  assert.equal(daysToReach([rev(5000, '2025-12-01')], today, 10_000), null);
  const d = daysToReach(book, today, 250_000);
  assert.ok(d !== null && d > 365, 'a ~$111K run rate cannot reach $250K inside a year');
});

test('ghost due dates run from the founding day to the deadline', () => {
  assert.equal(ghostDueDate(10_000, 5_000), '2026-10-27');
  assert.equal(ghostDueDate(10_000, 100_000_000), SUMMIT_DEADLINE);
  const s = campSchedule(10_000);
  for (let i = 1; i < s.length; i++) assert.ok(s[i - 1].dueOn < s[i].dueOn);
});

test('waypoints end at the next camp and objectives carry ETAs', () => {
  const w = waypointTargets(38_000, 250_000);
  assert.equal(w[w.length - 1], 250_000); assert.ok(w.length >= 2 && w.length <= 3);
  for (let i = 1; i < w.length; i++) assert.ok(w[i] > w[i - 1]);
  assert.deepEqual(waypointTargets(38_000, null), []);
  const o = objectives(book, today, 10_000);
  assert.equal(o[o.length - 1].isCamp, true);
  assert.ok(o.every(x => x.gap > 0 && x.dueOn >= '2026-10-27'));
});

test('badge progress is capped at done', () => {
  const p = badgeProgress(book, today);
  assert.equal(p.find(x => x.id === 'first-blood')!.progress, 1);
  assert.equal(p.find(x => x.id === 'iron-month')!.progress, 12500 / 50000);
});
