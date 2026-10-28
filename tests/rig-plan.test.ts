import assert from 'node:assert/strict';
import test from 'node:test';
import type { MetricEntry } from '../src/lib/dashboard';
import { DEAL_PREFIX, DROPPED, RIG_PREFIX, WASHER_REPAIR, WASHER_REPLACE, WASHER_RENTAL_DAY, WASHER_RENTAL_DAYS, dealList, encodeDeal, missingItems, rigGap, rigLines, rigTotals, safeUrl, washerFigures, washerVerdict } from '../src/lib/rig-plan';

let n = 0;
const m = (label: string, value: number, unit: string, on: string, note = ''): MetricEntry => ({ id: String(++n), venture: 'exterior', label, value, unit, measured_on: on, note });

test('the newest entry for a line is the current one, and dropped lines disappear', () => {
  const lines = rigLines([
    m(`${RIG_PREFIX}Truck or van`, 12000, 'researching', '2026-10-20'), m(`${RIG_PREFIX}Truck or van`, 11500, 'quoted', '2026-10-25'),
    m(`${RIG_PREFIX}Lettering or wrap`, 900, 'bought', '2026-10-22'), m(`${RIG_PREFIX}Ladder racks`, 400, 'quoted', '2026-10-22'), m(`${RIG_PREFIX}Ladder racks`, 0, DROPPED, '2026-10-23'),
    { ...m(`${RIG_PREFIX}Ignored`, 5, 'quoted', '2026-10-22'), venture: 'solutions' },
  ]);
  assert.deepEqual(lines.map(l => [l.item, l.price, l.status]), [['Truck or van', 11500, 'quoted'], ['Lettering or wrap', 900, 'bought']]);
});

test('two changes on the same day: the one at the front of the newest-first list is current', () => {
  const lines = rigLines([m(`${RIG_PREFIX}Truck or van`, 11500, 'quoted', '2026-10-25'), m(`${RIG_PREFIX}Truck or van`, 12000, 'researching', '2026-10-25')]);
  assert.deepEqual(lines.map(l => [l.price, l.status]), [[11500, 'quoted']]);
});

test('totals split by status, count unpriced lines, and the gap never invents a fund balance', () => {
  const lines = rigLines([m(`${RIG_PREFIX}A`, 10000, 'quoted', '2026-10-20'), m(`${RIG_PREFIX}B`, 2000, 'bought', '2026-10-20'), m(`${RIG_PREFIX}C`, 0, 'researching', '2026-10-20')]);
  assert.deepEqual(rigTotals(lines), { total: 12000, bought: 2000, quoted: 10000, researching: 0, unpriced: 1 });
  assert.deepEqual(rigGap(20000, 12000, 1995), { overGoal: -8000, shortOfBudget: 10005, fundedPercent: 16.625 });
  assert.deepEqual(rigGap(20000, 12000, null), { overGoal: -8000, shortOfBudget: null, fundedPercent: null });
  assert.equal(missingItems(lines).includes('Truck or van'), true);
  assert.equal(missingItems(rigLines([m(`${RIG_PREFIX}truck or van`, 1, 'quoted', '2026-10-20')])).includes('Truck or van'), false, 'matching ignores case');
});

test('truck deals keep their details, rank by inspection then rating then price, and a note that is not ours is tolerated', () => {
  const note = (o: Partial<Parameters<typeof encodeDeal>[0]>) => encodeDeal({ miles: 90000, year: 2016, url: 'https://example.com/x', notes: 'clean', inspection: 'unknown', rating: 3, ...o });
  const deals = dealList([
    m(`${DEAL_PREFIX}F-250 Racine`, 14000, 'deal', '2026-10-20', note({ rating: 4 })),
    m(`${DEAL_PREFIX}Sprinter`, 11000, 'deal', '2026-10-20', note({ rating: 5, inspection: 'failed' })),
    m(`${DEAL_PREFIX}Ranger`, 9000, 'deal', '2026-10-20', 'not json'),
    m(`${DEAL_PREFIX}Gone`, 1, DROPPED, '2026-10-20'),
  ]);
  assert.deepEqual(deals.map(d => d.name), ['F-250 Racine', 'Ranger', 'Sprinter']);
  assert.deepEqual([deals[0].miles, deals[0].year, deals[0].rating, deals[1].rating, deals[1].inspection], [90000, 2016, 4, null, 'unknown']);
  assert.equal(encodeDeal({ miles: null, year: null, url: '', notes: 'x'.repeat(900), inspection: 'unknown', rating: null }).length <= 500, true);
  assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
  assert.equal(safeUrl('javascript:alert(1)'), null);
  assert.equal(safeUrl('http://example.com'), null);
});

test('washer: rental spent and break-even only appear when their inputs exist, and repair versus replace is a plain comparison', () => {
  assert.deepEqual(washerVerdict(washerFigures([])), { rentalSpent: null, breakEvenDays: null, cheaper: null, savedByReplacing: null });
  const w = washerFigures([m(WASHER_REPAIR, 650, 'USD', '2026-10-25'), m(WASHER_RENTAL_DAY, 85, 'USD', '2026-10-25'), m(WASHER_RENTAL_DAYS, 12, 'days', '2026-10-25'), m(WASHER_REPLACE, 1400, 'USD', '2026-10-25')]);
  assert.deepEqual(washerVerdict(w), { rentalSpent: 1020, breakEvenDays: 8, cheaper: 'repair', savedByReplacing: -750 });
});
