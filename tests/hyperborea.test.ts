import assert from 'node:assert/strict';
import test from 'node:test';
import { achievementsFor, altitudeFor, campFor, camps, expedition, expeditionClock, ghostFor, oxygenFor, SUMMIT_ALTITUDE, trailingRevenue, weatherFor } from '../src/lib/hyperborea';
import { codex } from '../src/lib/hyperborea-codex';
import type { FinanceEntry, MercurySnapshot } from '../src/lib/dashboard';

let n = 0;
const rev = (amount: number, occurred_on: string, venture: FinanceEntry['venture'] = 'exterior'): FinanceEntry => ({ id: String(n++), venture, kind: 'revenue', amount, occurred_on, category: '', note: '' });
const cost = (amount: number, occurred_on: string): FinanceEntry => ({ id: String(n++), venture: 'exterior', kind: 'cost', amount, occurred_on, category: '', note: '' });
const bank = (balances: (number | null)[], state: MercurySnapshot['state'] = 'available'): MercurySnapshot => ({ state, detail: '', checkedAt: '2026-10-27T00:00:00Z', transactions: [], accounts: balances.map((b, i) => ({ id: String(i), name: 'Ops', currentBalance: b, availableBalance: b, currency: 'USD', status: 'active' })) });

test('altitude hits every camp exactly and is monotonic on a log scale', () => {
  for (const c of camps.slice(1)) assert.equal(altitudeFor(c.revenue), c.altitude);
  assert.equal(altitudeFor(0), 0); assert.equal(altitudeFor(-5), 0); assert.equal(altitudeFor(NaN), 0);
  assert.equal(altitudeFor(5e9), SUMMIT_ALTITUDE);
  let last = -1;
  for (let r = 500; r < 2e8; r *= 1.37) { const a = altitudeFor(r); assert.ok(a >= last); last = a; }
  // Log scale: $500K sits halfway (in log terms) between Camp I and Camp II.
  assert.equal(altitudeFor(500_000), 3250);
});

test('trailing revenue counts only the last 365 days of recorded revenue', () => {
  const f = [rev(1000, '2026-10-27'), rev(2000, '2025-10-28'), rev(4000, '2025-10-27'), rev(8000, '2026-10-28'), cost(500, '2026-10-01')];
  assert.equal(trailingRevenue(f, '2026-10-27'), 3000);
});

test('camps: current and next', () => {
  assert.equal(campFor(0).current.id, 'base'); assert.equal(campFor(0).next?.id, 'camp1');
  assert.equal(campFor(4100).current.id, 'camp2');
  assert.equal(campFor(SUMMIT_ALTITUDE).current.id, 'summit'); assert.equal(campFor(SUMMIT_ALTITUDE).next, null);
});

test('weather follows 90-day momentum and is unknown with no records', () => {
  assert.equal(weatherFor([], '2026-10-27').weather, 'unknown');
  assert.equal(weatherFor([rev(100, '2026-10-01')], '2026-10-27').weather, 'clear');
  assert.equal(weatherFor([rev(130, '2026-10-01'), rev(100, '2026-06-15')], '2026-10-27').weather, 'clear');
  assert.equal(weatherFor([rev(105, '2026-10-01'), rev(100, '2026-06-15')], '2026-10-27').weather, 'wind');
  assert.equal(weatherFor([rev(50, '2026-10-01'), rev(100, '2026-06-15')], '2026-10-27').weather, 'storm');
});

test('the clock runs twenty years from the founding day', () => {
  const start = expeditionClock('2026-10-27');
  assert.equal(start.day, 1); assert.equal(start.totalDays, 7305); assert.equal(start.progress, 0);
  const end = expeditionClock('2046-10-27');
  assert.equal(end.daysLeft, 0); assert.equal(end.progress, 1);
  assert.equal(expeditionClock('2020-01-01').day, 1);
});

test('the ghost compounds from the founding revenue to the summit', () => {
  const f = [rev(100_000, '2026-06-01')];
  const g0 = ghostFor(f, '2026-10-27', 100_000, true);
  assert.equal(Math.round(g0.revenue), 100_000);
  assert.ok(Math.abs(g0.requiredGrowth - 0.4125) < 0.002);
  const gEnd = ghostFor(f, '2046-10-27', 0, true);
  assert.ok(Math.abs(gEnd.revenue - 100_000_000) < 1);
  assert.equal(gEnd.ahead, false);
  assert.equal(ghostFor([], '2027-10-27', 0, false).ahead, null);
  assert.equal(ghostFor([], '2026-10-27', 0, false).start, 10_000);
});

test('oxygen never invents a runway', () => {
  assert.equal(oxygenFor(undefined, [], '2026-10-27').state, 'not-connected');
  assert.equal(oxygenFor(bank([1000], 'not-connected'), [], '2026-10-27').state, 'not-connected');
  assert.equal(oxygenFor(bank([null]), [], '2026-10-27').state, 'unavailable');
  const noCosts = oxygenFor(bank([9000, 3000]), [], '2026-10-27');
  assert.ok(noCosts.state === 'known' && noCosts.cash === 12000 && noCosts.months === null);
  const known = oxygenFor(bank([12000]), [cost(3000, '2026-10-01'), cost(3000, '2026-09-01'), cost(3000, '2026-08-15'), cost(9999, '2026-01-01')], '2026-10-27');
  assert.ok(known.state === 'known' && known.burn === 3000 && known.months === 4 && Math.abs((known.level ?? 0) - 4 / 12) < 1e-9);
});

test('revenue badges are computed; the rest wait for the founders', () => {
  const f = [rev(6000, '2026-09-03'), rev(5000, '2026-09-20'), rev(100, '2026-10-01', 'solutions')];
  const a = achievementsFor(f, '2026-10-27', ['exterior', 'solutions', 'essentials']);
  const by = (id: string) => a.find(x => x.id === id)!;
  assert.equal(by('first-blood').earned, true); assert.equal(by('first-blood').on, '2026-09');
  assert.equal(by('iron-month').earned, false);
  assert.equal(by('hydra').earned, false);
  assert.equal(achievementsFor([...f, rev(1, '2026-10-02', 'essentials')], '2026-10-27', ['exterior', 'solutions', 'essentials']).find(x => x.id === 'hydra')!.earned, true);
  assert.equal(by('legion').earned, null);
});

test('expedition: no records means base camp, honestly', () => {
  const e = expedition({ finance: [], today: '2026-10-27', companies: 3, coreVentures: ['exterior'] });
  assert.equal(e.hasRecords, false); assert.equal(e.altitude, 0); assert.equal(e.camp.current.id, 'base');
  assert.equal(e.toNext, 250_000); assert.equal(e.summitReached, false); assert.equal(e.oxygen.state, 'not-connected');
});

test('the codex has every camp and keeps the summit sealed', () => {
  for (const c of camps) assert.ok(codex.some(ch => ch.unlock === c.id), c.id);
  assert.equal(codex.find(c => c.unlock === 'summit')?.sealed, true);
});
