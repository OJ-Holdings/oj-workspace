'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { ArrowRight, CalendarClock, CircleAlert, ListChecks, Wallet } from 'lucide-react';
import type { Board } from './useBoard';
import type { DashboardStore } from './useDashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { money } from '@/lib/metrics';
import { ventures } from '@/lib/ventures';
import { buildAtlasSnapshot } from '@/lib/atlas-command';
import { OperatorLaunchpad } from './OperatorLaunchpad';
import { TruckFundCard } from './TruckFundCard';

type Props = {
  base: string; board: Board; store: DashboardStore; jobs: JobItem[]; today: string;
  mode: 'preview' | 'live'; readOnly: boolean; displayName: string; limited: boolean;
};

const formatDay = (day: string) => new Date(day + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const sevLabel = { urgent: 'Overdue', attention: 'Attention', review: 'Check', informational: 'Upcoming' } as const;

/**
 * The Today screen: what is happening, what is next, what needs you, and the month's recorded money. It replaces the long
 * executive-command page. Every figure comes from the same loaded snapshot the old page used; nothing here is new data.
 */
export function TodayBoard({ base, board, store, jobs, today, mode, readOnly, displayName, limited }: Props) {
  const snapshot = useMemo(
    () => (today ? buildAtlasSnapshot({ cards: board.data.cards, dashboard: store.data, jobs, today, limited }) : null),
    [board.data.cards, store.data, jobs, today, limited],
  );
  const totals = snapshot?.intelligence.totals;
  const todays = snapshot?.schedule.filter(e => e.date === today) ?? [];
  const upcoming = snapshot?.schedule.filter(e => e.date > today) ?? [];
  const signals = snapshot?.intelligence.signals.slice(0, 5) ?? [];
  const finance = snapshot?.finance;

  return (
    <section className="today-board" aria-label="Today">
      <header className="today-head">
        <div>
          <p className="today-date">{today ? formatDay(today) : 'Loading date'}</p>
          <h1>{mode === 'preview' ? 'Today' : displayName ? `Today, ${displayName}` : 'Today'}</h1>
        </div>
      </header>

      <OperatorLaunchpad base={base as '/workspace' | '/preview'} mode={mode} readOnly={readOnly} compact onNewTask={() => board.openCard(undefined, { business: 'exterior' })} />

      <div className="today-stats">
        <Link href={base + '/b/exterior/bookings'} className="today-stat">
          <span><CalendarClock size={15} aria-hidden="true" /> Jobs today</span>
          <strong>{snapshot ? todays.filter(e => e.business === 'exterior').length : '-'}</strong>
          <small>{totals ? `${totals.upcomingExterior} in the next 7 days` : 'Loading'}</small>
        </Link>
        <Link href={base + '/tasks'} className="today-stat">
          <span><ListChecks size={15} aria-hidden="true" /> Open tasks</span>
          <strong>{totals?.openTasks ?? '-'}</strong>
          <small>{totals ? `${totals.overdueTasks} overdue, ${totals.dueToday} due today` : 'Loading'}</small>
        </Link>
        <Link href={base + '/finance'} className="today-stat">
          <span><Wallet size={15} aria-hidden="true" /> Money in this month</span>
          <strong>{finance?.available ? money(finance.recordedRevenue) : '-'}</strong>
          <small>{finance?.available ? 'Recorded entries' : 'No finance entries loaded'}</small>
        </Link>
        <Link href={base + '/finance'} className="today-stat">
          <span><Wallet size={15} aria-hidden="true" /> Money out this month</span>
          <strong>{finance?.available ? money(finance.recordedCosts) : '-'}</strong>
          <small>{finance?.available ? 'Recorded entries' : 'No finance entries loaded'}</small>
        </Link>
      </div>

      <div className="today-columns">
        <section className="today-card" aria-labelledby="today-next">
          <header><h2 id="today-next">Next up</h2><Link href={base + '/calendar'}>Schedule <ArrowRight size={14} aria-hidden="true" /></Link></header>
          {todays.length + upcoming.length === 0
            ? <p className="today-empty">Nothing scheduled in the next 7 days. <Link href={base + '/b/exterior/bookings?new=1'}>Book a job</Link></p>
            : <ol className="today-list">
              {[...todays, ...upcoming].slice(0, 7).map(event => (
                <li key={event.key}>
                  <time dateTime={event.date}>{event.date === today ? 'Today' : formatDay(event.date)}</time>
                  <Link href={base + event.href}><strong>{event.title}</strong><small>{event.business ? ventures[event.business].short : 'Company'} - {event.detail}</small></Link>
                </li>
              ))}
            </ol>}
        </section>

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
      </div>

      <TruckFundCard store={store} today={today} readOnly={readOnly} />
    </section>
  );
}
