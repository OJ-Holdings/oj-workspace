'use client';

import { useEffect, useMemo, useState } from 'react';
import { loadJobs, type JobItem } from '@/app/workspace/exterior-actions';
import { blockLabel, parseBlock } from '@/lib/exterior-ops';
import type { ScheduleJob } from '@/lib/dashboard';

/**
 * Exterior Care's booked jobs for the shared calendar and the Home schedule. Members and owners only: for
 * anyone else (and in the sample workspace) the list is empty. Loaded again on every page change, so a job
 * booked on the Exterior Care tab is already there when you open the Calendar.
 */
export function useJobs(org: string, mode: 'preview' | 'live', path: string) {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  useEffect(() => {
    if (mode !== 'live') return;
    let live = true;
    loadJobs(org).then(list => { if (live) setJobs(list); }, () => { /* the calendar just shows no jobs */ });
    return () => { live = false; };
  }, [org, mode, path]);
  const schedule = useMemo<ScheduleJob[]>(() => jobs.map(j => ({
    id: j.id, date: j.date, startMinutes: parseBlock(j.time_block)?.start ?? 0, timeLabel: blockLabel(j.time_block), name: j.name, service: j.service,
  })), [jobs]);
  return { jobs, schedule };
}
