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
  const scope = org+'|'+mode+'|'+path;
  const [loadedFor,setLoadedFor] = useState('');
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loadingState, setLoadingState] = useState<'loading'|'ready'|'failed'>(mode==='live'?'loading':'ready');
  useEffect(() => {
    if (mode !== 'live') {setJobs([]);setLoadingState('ready');setLoadedFor(scope);return;}
    let live = true;
    setLoadingState('loading');
    setJobs([]);
    loadJobs(org).then(
      list => { if (live) {setJobs(list);setLoadingState('ready');setLoadedFor(scope);} },
      () => { if (live) {setJobs([]);setLoadingState('failed');setLoadedFor(scope);} },
    );
    return () => { live = false; };
  }, [org, mode, path, scope]);
  const authorizedJobs=loadedFor===scope?jobs:[];
  const currentState=loadedFor===scope?loadingState:'loading';
  const schedule = useMemo<ScheduleJob[]>(() => authorizedJobs.map(j => ({
    id: j.id, date: j.date, startMinutes: parseBlock(j.time_block)?.start ?? 0, timeLabel: blockLabel(j.time_block), name: j.name, service: j.service,
  })), [authorizedJobs]);
  return { jobs:authorizedJobs, schedule, loadingState:currentState };
}
