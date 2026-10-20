'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, CheckSquare } from 'lucide-react';
import { todayTasks } from '@/lib/today';
import { ventures } from '@/lib/ventures';
import type { WorkspaceMetrics } from '@/lib/metrics';
import type { Board } from './useBoard';

export function TodayWork({ base, board, metrics, today, displayName, members, readOnly }: { base: string; board: Board; metrics: WorkspaceMetrics; today: string; displayName: string; members: string[]; readOnly: boolean }) {
  const [mine, setMine] = useState(false);
  const person = members.find(m => m === displayName);
  const tasks = todayTasks(board.data.cards, today, mine && person ? person : '');
  const open = board.data.cards.filter(c => c.stage !== 'Done');
  const review = open.filter(c => c.stage === 'Review').length;
  const unassigned = open.filter(c => !c.assignee.trim()).length;
  return <section className="today-work" aria-label="Today's work">
    <div className="today-work-main">
      <header className="today-heading"><div><CheckSquare size={18} aria-hidden="true" /><h2>Work to move today</h2></div><div className="seg" role="group" aria-label="Today's task owner"><button aria-pressed={!mine} onClick={() => setMine(false)}>Team</button>{person && <button aria-pressed={mine} onClick={() => setMine(true)}>Mine</button>}</div></header>
      {tasks.length ? <ul className="today-task-list">{tasks.slice(0, 6).map(c => <li key={c.id}>
        <input type="checkbox" disabled={readOnly || board.pending} checked={false} aria-label={`Mark ${c.title} done`} onChange={() => board.move(c, 'Done')} />
        <button onClick={() => board.openCard(c)}><b>{c.title}</b><span><i style={{ background: `var(--c-${c.business})` }} />{ventures[c.business].short} / {c.assignee || 'Unassigned'}{c.due_date && ` / ${c.due_date < today ? 'Overdue ' : 'Due '}${c.due_date}`}</span></button><small>{c.stage}</small>
      </li>)}</ul> : <div className="today-empty"><b>{today ? 'No urgent tasks in this view.' : 'Preparing today’s work…'}</b><p>Due dates, high priority and review work appear here.</p></div>}
      <footer><Link href={`${base}/tasks${mine && person ? `?assignee=${encodeURIComponent(person)}` : ''}`}>View {mine ? 'my' : 'all'} tasks{tasks.length > 6 ? ` (${tasks.length} need attention)` : ''}<ArrowUpRight size={14} /></Link><Link href={`${base}/tasks?focus=review`}>{review} awaiting review</Link><Link href={`${base}/tasks?focus=unassigned`}>{unassigned} unassigned</Link></footer>
    </div>
    <div className="today-schedule"><header className="today-heading"><div><CalendarDays size={18} aria-hidden="true" /><h2>On the schedule</h2></div><Link href={`${base}/calendar`}>Calendar</Link></header><p className="quiet">Today in Central time</p>
      {metrics.schedule?.length ? <ol>{metrics.schedule.slice(0, 5).map(item => <li key={item.id}><time>{item.time}</time><Link href={`${base}${item.time === 'Due' ? `/tasks?task=${encodeURIComponent(item.id)}` : item.id.startsWith('job-') ? '/b/exterior/calendar' : `/calendar?event=${encodeURIComponent(item.id)}`}`}><b>{item.title}</b><span>{item.detail}</span></Link></li>)}</ol> : <div className="today-empty"><b>No scheduled items today.</b><p>Events, job bookings and tasks due today appear here.</p></div>}
      {(metrics.schedule?.length ?? 0) > 5 && <Link href={`${base}/calendar`}>View the full day</Link>}
      <nav aria-label="Daily workflows" className="today-workflows"><Link href={`${base}/b/solutions/outreach?view=pending`}>Work the outreach queue<ArrowUpRight size={15} /></Link><Link href={`${base}/b/exterior/bookings`}>Manage job bookings<ArrowUpRight size={15} /></Link></nav>
    </div>
  </section>;
}
