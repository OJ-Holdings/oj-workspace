'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, CircleAlert, ListChecks, MapPin, Wallet } from 'lucide-react';
import type { Board } from './useBoard';
import type { DashboardStore } from './useDashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { money } from '@/lib/metrics';
import { ventures } from '@/lib/ventures';
import { buildAtlasSnapshot } from '@/lib/atlas-command';
import { blockLabel } from '@/lib/exterior-ops';
import { todayJobs } from '@/lib/today-jobs';
import { OperatorLaunchpad } from './OperatorLaunchpad';
import { TruckFundCard } from './TruckFundCard';
import { CommandPulse } from './CommandPulse';
import { WeatherAhead } from './WeatherAhead';

type Props = {
  base: string; board: Board; store: DashboardStore; jobs: JobItem[]; today: string;
  mode: 'preview' | 'live'; readOnly: boolean; displayName: string; limited: boolean; org: string;
};

const formatDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const shortDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const sevLabel = { urgent: 'Overdue', attention: 'Attention', review: 'Check', informational: 'Upcoming' } as const;

function Stop({ job, base, dim }: { job: JobItem; base: string; dim?: boolean }) {
  return (
    <li className={dim ? 'stop is-dim' : 'stop'}>
      <time className="stop-time">{blockLabel(job.time_block)}</time>
      <span className="stop-node" aria-hidden="true" />
      <div className="stop-body">
        <div className="stop-head">
          <Link href={`${base}/b/exterior/customer?lead=${encodeURIComponent(job.lead_id)}`}><strong>{job.name}</strong></Link>
          {job.quote !== null && <span className="stop-quote">{money(job.quote)}</span>}
        </div>
        <p>{job.service || 'Service not entered'}{job.status === 'pending_approval' ? ' - pending approval' : ''}</p>
        <div className="stop-actions">
          {job.address && <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(job.address)}`} target="_blank" rel="noopener noreferrer"><MapPin size={13} aria-hidden="true" /> {job.address}</a>}
          <Link href={`${base}/b/exterior/bookings?booking=${encodeURIComponent(job.id)}`}>Open job <ArrowRight size={13} aria-hidden="true" /></Link>
        </div>
      </div>
    </li>
  );
}

/**
 * The Command screen: today's jobs as a timeline, what needs you, the month's recorded money and the truck fund.
 * Every figure comes from the records already loaded for the workspace; nothing here is new data.
 */
export function TodayBoard({ base, board, store, jobs, today, mode, readOnly, displayName, limited, org }: Props) {
  const snapshot = useMemo(
    () => (today ? buildAtlasSnapshot({ cards: board.data.cards, dashboard: store.data, jobs, today, limited }) : null),
    [board.data.cards, store.data, jobs, today, limited],
  );
  const grouped = useMemo(() => (today ? todayJobs(jobs, today) : { today: [], tomorrow: [], later: [] }), [jobs, today]);
  const totals = snapshot?.intelligence.totals;
  const signals = snapshot?.intelligence.signals.slice(0, 5) ?? [];
  const finance = snapshot?.finance;
  // Founders' own work-timer entries ('Oscar at work') are not calendar events worth listing here.
  const events = (snapshot?.schedule ?? []).filter(e => e.key.startsWith('event:') && !/ at work$/i.test(e.title)).slice(0, 4);
  const quiet = grouped.today.length + grouped.tomorrow.length + grouped.later.length === 0;

  return (
    <section className="today-board" aria-label="Command">
      <header className="today-head">
        <div>
          <p className="today-date">{today ? formatDay(today) : 'Loading date'}</p>
          <h1>{mode === 'preview' || !displayName ? 'Command' : `Good day, ${displayName}`}</h1>
        </div>
        <div className="today-pulse" aria-label="Today at a glance">
          <span><b>{grouped.today.length}</b> job{grouped.today.length === 1 ? '' : 's'} today</span>
          <span><b>{grouped.tomorrow.length}</b> tomorrow</span>
          {totals && <span><b>{totals.overdueTasks}</b> overdue task{totals.overdueTasks === 1 ? '' : 's'}</span>}
        </div>
      </header>

      <div className="today-grid">
        <div className="today-main">
          <OperatorLaunchpad base={base as '/workspace' | '/preview'} mode={mode} readOnly={readOnly} compact onNewTask={() => board.openCard(undefined, { business: 'exterior' })} />

          <section className="today-card today-timeline" aria-labelledby="today-jobs-h">
            <header><h2 id="today-jobs-h"><CalendarClock size={18} aria-hidden="true" /> Jobs</h2><Link href={base + '/b/exterior/bookings'}>All jobs <ArrowRight size={14} aria-hidden="true" /></Link></header>
            {quiet ? (
              <p className="today-empty">No jobs in the next 7 days. <Link href={base + '/b/exterior/bookings?new=1'}>Book one</Link></p>
            ) : <>
              <h3 className="stop-group">Today{grouped.today.length === 0 ? ' - nothing booked' : ''}</h3>
              {grouped.today.length > 0 && <ol className="stops">{grouped.today.map(j => <Stop key={j.id} job={j} base={base} />)}</ol>}
              {grouped.tomorrow.length > 0 && <>
                <h3 className="stop-group">Tomorrow</h3>
                <ol className="stops">{grouped.tomorrow.map(j => <Stop key={j.id} job={j} base={base} dim />)}</ol>
              </>}
              {grouped.later.length > 0 && <>
                <h3 className="stop-group">Later this week</h3>
                <ol className="stops">{grouped.later.map(j => (
                  <li key={j.id} className="stop is-dim stop-compact"><time className="stop-time">{shortDay(j.date)}</time><span className="stop-node" aria-hidden="true" />
                    <div className="stop-body"><div className="stop-head"><Link href={`${base}/b/exterior/bookings?booking=${encodeURIComponent(j.id)}`}><strong>{j.name}</strong></Link><span className="stop-quote">{blockLabel(j.time_block)}</span></div></div></li>
                ))}</ol>
              </>}
            </>}
            {events.length > 0 && <>
              <h3 className="stop-group">Other calendar events</h3>
              <ul className="today-list">{events.map(e => <li key={e.key}><time dateTime={e.date}>{shortDay(e.date)}</time><Link href={base + e.href}><strong>{e.title}</strong><small>{e.business ? ventures[e.business].short : 'Company'} - {e.detail}</small></Link></li>)}</ul>
            </>}
          </section>
        </div>

        <aside className="today-side">
          <div className="today-stats">
            <Link href={base + '/tasks'} className="today-stat">
              <span><ListChecks size={15} aria-hidden="true" /> Open tasks</span>
              <strong>{totals?.openTasks ?? '-'}</strong>
              <small>{totals ? `${totals.overdueTasks} overdue, ${totals.dueToday} due today` : 'Loading'}</small>
            </Link>
            <Link href={base + '/finance'} className="today-stat">
              <span><Wallet size={15} aria-hidden="true" /> In this month</span>
              <strong>{finance?.available ? money(finance.recordedRevenue) : '-'}</strong>
              <small>{finance?.available ? 'Recorded' : 'Nothing recorded'}</small>
            </Link>
            {store.data?.mercury?.state === 'available' && <Link href={base + '/finance'} className="today-stat">
              <span><Wallet size={15} aria-hidden="true" /> In the bank</span>
              <strong>{money(store.data.mercury.accounts.reduce((t, acc) => t + (acc.currentBalance ?? 0), 0))}</strong>
              <small>{store.data.mercury.accounts.length} Mercury accounts</small>
            </Link>}
            <Link href={base + '/finance'} className="today-stat">
              <span><Wallet size={15} aria-hidden="true" /> Out this month</span>
              <strong>{finance?.available ? money(finance.recordedCosts) : '-'}</strong>
              <small>{finance?.available ? 'Recorded' : 'Nothing recorded'}</small>
            </Link>
          </div>

          <CommandPulse org={org} mode={mode} jobs={jobs} today={today} base={base} metrics={store.data?.metricEntries ?? []} />
          <WeatherAhead jobs={jobs} base={base} />

          <section className="today-card" aria-labelledby="today-needs">
            <header><h2 id="today-needs">Needs you</h2><Link href={base + '/tasks'}>Tasks <ArrowRight size={14} aria-hidden="true" /></Link></header>
            {signals.length === 0
              ? <p className="today-empty">Nothing flagged right now.</p>
              : <ol className="today-list">
                {signals.map(signal => (
                  <li key={signal.id}>
                    <span className={'today-sev today-sev-' + signal.severity}><CircleAlert size={13} aria-hidden="true" />{sevLabel[signal.severity]}</span>
                    <Link href={base + signal.destination}><strong>{signal.title}</strong><small>{signal.business ? ventures[signal.business].short : 'Company'}</small></Link>
                  </li>
                ))}
              </ol>}
          </section>

          <TruckFundCard store={store} today={today} readOnly={readOnly} />
        </aside>
      </div>
    </section>
  );
}
