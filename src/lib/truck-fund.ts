import type { MetricEntry } from './dashboard';

/** The work-truck goal Oscar set on 2026-10-27: $20,000 all-in, ready before the 2027 season. Edit here if the plan changes. */
export const TRUCK_GOAL = 20000;
export const TRUCK_DEADLINE = '2027-04-01';
/** The balance is kept as hand-logged metric entries, so both founders see the same number and the history is kept. */
export const TRUCK_LABEL = 'Truck fund balance';

const dayNumber = (iso: string) => { const [y, m, d] = iso.slice(0, 10).split('-').map(Number); return Math.floor(Date.UTC(y, m - 1, d) / 86_400_000); };
const isoOf = (n: number) => new Date(n * 86_400_000).toISOString().slice(0, 10);

export type TruckFund = {
  known: boolean;
  goal: number; deadline: string;
  balance: number | null; asOf: string | null;
  remaining: number | null; percent: number | null;
  daysLeft: number; perWeekNeeded: number | null; perMonthNeeded: number | null;
  /** Average growth per week between the first and last logged balance; null with fewer than two dated entries. */
  weeklyRate: number | null; projectedDate: string | null; onTrack: boolean | null;
};

/** Everything the truck-fund card shows, from the logged balances only. Nothing is assumed when no balance has been entered. */
export function truckFund(entries: MetricEntry[], today: string, goal = TRUCK_GOAL, deadline = TRUCK_DEADLINE): TruckFund {
  const rows = entries
    .filter(e => e.venture === 'exterior' && e.label === TRUCK_LABEL && Number.isFinite(e.value) && /^\d{4}-\d{2}-\d{2}/.test(e.measured_on))
    .sort((a, b) => a.measured_on.localeCompare(b.measured_on));
  const daysLeft = Math.max(0, dayNumber(deadline) - dayNumber(today));
  if (rows.length === 0) {
    return { known: false, goal, deadline, balance: null, asOf: null, remaining: null, percent: null, daysLeft, perWeekNeeded: null, perMonthNeeded: null, weeklyRate: null, projectedDate: null, onTrack: null };
  }
  const first = rows[0], last = rows[rows.length - 1];
  const balance = last.value;
  const remaining = Math.max(0, goal - balance);
  const weeksLeft = daysLeft / 7;
  const perWeekNeeded = remaining === 0 ? 0 : weeksLeft > 0 ? remaining / weeksLeft : remaining;
  const spanDays = dayNumber(last.measured_on) - dayNumber(first.measured_on);
  const weeklyRate = spanDays > 0 ? ((last.value - first.value) / spanDays) * 7 : null;
  let projectedDate: string | null = null;
  if (remaining === 0) projectedDate = last.measured_on.slice(0, 10);
  else if (weeklyRate !== null && weeklyRate > 0) projectedDate = isoOf(dayNumber(last.measured_on) + Math.ceil((remaining / weeklyRate) * 7));
  return {
    known: true, goal, deadline, balance, asOf: last.measured_on.slice(0, 10), remaining, percent: Math.min(100, Math.max(0, (balance / goal) * 100)),
    daysLeft, perWeekNeeded, perMonthNeeded: (perWeekNeeded * 52) / 12, weeklyRate, projectedDate,
    onTrack: projectedDate === null ? (remaining === 0 ? true : null) : projectedDate <= deadline,
  };
}
