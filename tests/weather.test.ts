import assert from 'node:assert/strict';
import test from 'node:test';
import { jobsAtRisk, parseForecast, weatherLabel } from '../src/lib/weather';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const forecast = (over: Record<string, unknown[]> = {}) => ({ daily: {
  time: ['2026-10-27', '2026-10-28', '2026-10-29'],
  weather_code: [0, 61, 3], precipitation_probability_max: [5, 80, 10], precipitation_sum: [0, 0.3, 0],
  wind_speed_10m_max: [8, 12, 24], temperature_2m_max: [60, 55, 41], temperature_2m_min: [45, 40, 30], ...over } });
const job = (id: string, date: string, status: string | null = 'confirmed'): JobItem => ({ id, lead_id: 'l', date, time_block: '9-11', status, name: 'Fay', service: null, address: null, quote: null });

test('rain, wind and freezing are flagged from the thresholds', () => {
  const days = parseForecast(forecast());
  assert.deepEqual(days.map(d => d.flags), [[], ['rain'], ['wind', 'freeze']]);
  assert.equal(days[1].label, 'Rain');
});

test('malformed or partial forecasts give no days instead of guesses', () => {
  assert.deepEqual(parseForecast(null), []);
  assert.deepEqual(parseForecast({ daily: { time: ['2026-10-27'] } }), []);
  assert.deepEqual(parseForecast(forecast({ wind_speed_10m_max: [1, 2] })), []);
  assert.deepEqual(parseForecast(forecast({ wind_speed_10m_max: [1, null, 3] })).map(d => d.date), ['2026-10-27', '2026-10-29']);
});

test('jobs on flagged days are listed with their reasons; cancelled jobs and clear days are not', () => {
  const days = parseForecast(forecast());
  const risk = jobsAtRisk(days, [job('a', '2026-10-27'), job('b', '2026-10-28'), job('c', '2026-10-29'), job('d', '2026-10-28', 'cancelled')]);
  assert.deepEqual(risk.map(r => [r.job.id, r.reasons]), [['b', ['Rain likely (80%)']], ['c', ['Windy (24 mph)', 'Freezing (30°F)']]]);
});

test('weather codes read in plain words', () => {
  assert.deepEqual([0, 3, 55, 63, 75, 81, 96].map(weatherLabel), ['Clear', 'Cloudy', 'Drizzle', 'Rain', 'Snow', 'Showers', 'Thunderstorms']);
});
