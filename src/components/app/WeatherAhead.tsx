'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CloudRain } from 'lucide-react';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { loadWeather } from '@/app/workspace/weather-actions';
import { jobsAtRisk, type WeatherDay } from '@/lib/weather';

const weekday = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short' });
const shortDay = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

/** The week's forecast for the work area, with the booked jobs that fall on a rainy, windy or freezing day (master plan 6.3, weather-aware scheduling). */
export function WeatherAhead({ jobs, base }: { jobs: JobItem[]; base: string }) {
  const [days, setDays] = useState<WeatherDay[] | null>(null);
  useEffect(() => { let live = true; loadWeather().then(d => { if (live) setDays(d); }, () => { if (live) setDays([]); }); return () => { live = false; }; }, []);
  if (days === null) return null;
  if (days.length === 0) return <section className="today-card" aria-labelledby="today-wx"><header><h2 id="today-wx"><CloudRain size={16} aria-hidden="true" /> Weather ahead</h2></header><p className="today-empty">The forecast could not be loaded.</p></section>;
  const risk = jobsAtRisk(days, jobs);
  return (
    <section className="today-card" aria-labelledby="today-wx">
      <header><h2 id="today-wx"><CloudRain size={16} aria-hidden="true" /> Weather ahead</h2></header>
      <ol className="wx-days">
        {days.map(d => <li key={d.date} className={d.flags.length ? 'is-flagged' : undefined}>
          <b>{weekday(d.date)}</b>
          <span>{Math.round(d.hi)}° / {Math.round(d.lo)}°</span>
          <small>{d.label}</small>
          {d.flags.length > 0 && <em>{d.flags.map(f => f === 'rain' ? 'Rain' : f === 'wind' ? 'Wind' : 'Freeze').join(', ')}</em>}
        </li>)}
      </ol>
      {risk.length > 0 && <>
        <h3 className="stop-group">Jobs that may need to move</h3>
        <ul className="today-list today-act">
          {risk.map(r => <li key={r.job.id}><Link href={`${base}/b/exterior/bookings?booking=${encodeURIComponent(r.job.id)}`}><strong>{r.job.name}, {shortDay(r.job.date)}</strong><small>{r.reasons.join(', ')}</small></Link></li>)}
        </ul>
      </>}
    </section>
  );
}
