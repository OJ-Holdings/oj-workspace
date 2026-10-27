'use client';

import { useEffect, useState } from 'react';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { todayJobs } from '@/lib/today-jobs';
import { workDay } from '@/lib/task-workflows';

type Props = { jobs: JobItem[]; openTasks: number; status: string; mode: 'preview' | 'live' };

const clock = () => new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date());

/** The live strip along the bottom: Chicago time, jobs today and tomorrow, open tasks and the connection state. Read-only. */
export function StatusBar({ jobs, openTasks, status, mode }: Props) {
  const [now, setNow] = useState('');
  const [day, setDay] = useState('');
  useEffect(() => {
    const tick = () => { setNow(clock()); setDay(workDay(new Date())); };
    tick(); const t = window.setInterval(tick, 30_000); return () => window.clearInterval(t);
  }, []);
  const grouped = day ? todayJobs(jobs, day) : null;
  return (
    <footer className="os-status" role="status" aria-label="Status">
      <span className="os-status-item"><i className={status ? 'os-dot is-warn' : 'os-dot'} aria-hidden="true" />{mode === 'preview' ? 'Sample data' : status || 'Live'}</span>
      {grouped && mode === 'live' && <span className="os-status-item"><b>{grouped.today.length}</b> job{grouped.today.length === 1 ? '' : 's'} today</span>}
      {grouped && mode === 'live' && <span className="os-status-item"><b>{grouped.tomorrow.length}</b> tomorrow</span>}
      <span className="os-status-item"><b>{openTasks}</b> open task{openTasks === 1 ? '' : 's'}</span>
      <span className="os-status-spacer" />
      <span className="os-status-item">{now} Chicago</span>
      <span className="os-status-item os-status-brand">OJ OS</span>
    </footer>
  );
}
