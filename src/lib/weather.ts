import type { JobItem } from '@/app/workspace/exterior-actions';

export type Flag = 'rain' | 'wind' | 'freeze';
export type WeatherDay = { date: string; label: string; rainChance: number; rainIn: number; windMph: number; hi: number; lo: number; flags: Flag[] };
export type AtRisk = { job: JobItem; reasons: string[] };

/** WMO weather codes, in plain words. */
export function weatherLabel(code: number): string {
  if (code === 0) return 'Clear';
  if (code <= 2) return 'Mostly clear';
  if (code === 3) return 'Cloudy';
  if (code === 45 || code === 48) return 'Fog';
  if (code >= 51 && code <= 57) return 'Drizzle';
  if (code >= 61 && code <= 67) return 'Rain';
  if (code >= 71 && code <= 77) return 'Snow';
  if (code >= 80 && code <= 82) return 'Showers';
  if (code === 85 || code === 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Mixed';
}

const RAIN_CHANCE = 60, RAIN_INCHES = 0.1, WIND_MPH = 20, FREEZE_F = 32;

/** A missing reading is NaN, never 0: null must not look like a calm, dry day. */
const num = (v: unknown) => (v === null || v === undefined || v === '' ? NaN : Number(v));

/** Turns an Open-Meteo daily forecast into days with work-risk flags. Anything malformed gives no days rather than guesses. */
export function parseForecast(json: unknown): WeatherDay[] {
  const d = (json as { daily?: Record<string, unknown> } | null)?.daily;
  if (!d || !Array.isArray(d.time)) return [];
  const col = (k: string) => (Array.isArray(d[k]) && (d[k] as unknown[]).length === (d.time as unknown[]).length ? (d[k] as unknown[]) : null);
  const code = col('weather_code'), chance = col('precipitation_probability_max'), inches = col('precipitation_sum'), wind = col('wind_speed_10m_max'), hi = col('temperature_2m_max'), lo = col('temperature_2m_min');
  if (!code || !chance || !inches || !wind || !hi || !lo) return [];
  return (d.time as unknown[]).map((t, i) => {
    const day = { date: String(t), label: weatherLabel(num(code[i])), rainChance: num(chance[i]), rainIn: num(inches[i]), windMph: num(wind[i]), hi: num(hi[i]), lo: num(lo[i]), flags: [] as Flag[] };
    if (day.rainChance >= RAIN_CHANCE || day.rainIn >= RAIN_INCHES) day.flags.push('rain');
    if (day.windMph >= WIND_MPH) day.flags.push('wind');
    if (day.lo <= FREEZE_F) day.flags.push('freeze');
    return day;
  }).filter(day => /^\d{4}-\d{2}-\d{2}$/.test(day.date) && [day.rainChance, day.rainIn, day.windMph, day.hi, day.lo].every(Number.isFinite));
}

const reason = (f: Flag, day: WeatherDay) => f === 'rain' ? `Rain likely (${Math.round(day.rainChance)}%)` : f === 'wind' ? `Windy (${Math.round(day.windMph)} mph)` : `Freezing (${Math.round(day.lo)}°F)`;

/** Booked jobs on a day the forecast flags, earliest first. Cancelled and denied jobs are never listed. */
export function jobsAtRisk(days: WeatherDay[], jobs: JobItem[]): AtRisk[] {
  const flagged = new Map(days.filter(d => d.flags.length).map(d => [d.date, d]));
  return jobs.filter(j => j.status !== 'cancelled' && j.status !== 'denied' && flagged.has(j.date))
    .sort((a, b) => a.date.localeCompare(b.date) || a.time_block.localeCompare(b.time_block))
    .map(job => ({ job, reasons: flagged.get(job.date)!.flags.map(f => reason(f, flagged.get(job.date)!)) }));
}
