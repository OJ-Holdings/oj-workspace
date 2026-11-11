import { addDays, centralHour } from './dm-quests';
import { workDay } from './task-workflows';

export type SparkCount = { sender: 'Jacob' | 'Oscar'; channel: 'email' | 'dm'; row_count: number; snapshot_day: string };
export const sparkPairs = [
  { sender: 'Jacob', channel: 'email' }, { sender: 'Jacob', channel: 'dm' },
  { sender: 'Oscar', channel: 'email' }, { sender: 'Oscar', channel: 'dm' },
] as const;

/** Header-based sheet count, never assume date-added or edit the research source. */
export function sheetSparkCounts(rows: string[][], day: string): SparkCount[] {
  const headers = (rows[0] ?? []).map(v => v.trim().toLowerCase());
  const s = headers.indexOf('sender'), c = headers.indexOf('channel'), b = headers.indexOf('business name');
  if (s < 0 || c < 0 || b < 0) throw new Error('The Spark feed needs Sender, Channel, Business Name headers.');
  const counts = sparkPairs.map(x => ({ ...x, row_count: 0, snapshot_day: day }));
  for (const row of rows.slice(1)) {
    if (!(row[b] ?? '').trim()) continue;
    const who = (row[s] ?? '').trim().toLowerCase();
    const channel = (row[c] ?? '').trim().toLowerCase();
    const group = /email/.test(channel) ? 'email' : /dm|instagram|facebook|linkedin|social/.test(channel) ? 'dm' : '';
    const item = counts.find(x => x.sender.toLowerCase() === who && x.channel === group);
    if (item) item.row_count++;
  }
  return counts;
}
export function sparkDeltas(rows: SparkCount[], now: Date) {
  const today = workDay(now), yesterday = addDays(today, -1);
  const weekday = new Date(today + 'T12:00:00Z').getUTCDay();
  const late = weekday >= 1 && weekday <= 5 && centralHour(now) >= 10;
  return sparkPairs.map(pair => {
    const current = rows.find(r => r.sender === pair.sender && r.channel === pair.channel && r.snapshot_day === today);
    const previous = rows.find(r => r.sender === pair.sender && r.channel === pair.channel && r.snapshot_day === yesterday);
    const added = current && previous ? Math.max(0, current.row_count - previous.row_count) : null;
    return { ...pair, rows: current?.row_count ?? null, newToday: added, lateAndEmpty: late && added === 0, target: 10 };
  });
}
