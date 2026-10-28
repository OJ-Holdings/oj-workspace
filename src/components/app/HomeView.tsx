'use client';

import { useEffect, useState } from 'react';
import type { WorkspaceMetrics } from '@/lib/metrics';
import type { Board } from './useBoard';
import type { DashboardStore } from './useDashboard';
import type { WorkStore } from './useWork';
import { Leaderboard } from './Leaderboard';
import { TodayBoard } from './TodayBoard';
import { PulseCard } from './Pulse';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { workDay } from '@/lib/task-workflows';

type Props = { base: string; board: Board; store: DashboardStore; work: WorkStore; metrics: WorkspaceMetrics | null; jobs: JobItem[]; mode: 'preview' | 'live'; displayName: string; members: string[]; readOnly: boolean; limited?: boolean; org: string };

/** Today: the compact board, then the weekly leaderboard. (The long executive page and its report grid were retired in OJ OS Phase 0.) */
export function HomeView({ base, board, store, work, jobs, mode, displayName, readOnly, limited = false, org }: Props) {
  // The business date depends on the visitor's clock, so it is set after load to keep server and browser output identical.
  const [todayKey, setTodayKey] = useState('');
  useEffect(() => {
    const refresh = () => { setTodayKey(workDay(new Date())); };
    refresh(); const timer = window.setInterval(refresh, 60_000); return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="home">
      <TodayBoard base={base} board={board} store={store} jobs={jobs} today={todayKey} mode={mode} readOnly={readOnly} displayName={displayName} limited={limited} org={org} />
      <PulseCard base={base} />
      <Leaderboard work={work} cards={board.data.cards} />
    </div>
  );
}
