'use client';

import { useMemo, useState, type CSSProperties } from 'react';
import NumberFlow from '@number-flow/react';
import { CalendarPlus, ChevronLeft, ChevronRight, Pencil } from 'lucide-react';
import type { ExtBooking, ExteriorData } from '@/lib/exterior';
import { blockLabel, blockStartLabel, isRealPhone, parseBlock } from '@/lib/exterior-ops';
import {qualifiedDispatchQuotes} from '@/lib/exterior-dispatch-preflight';
import { dayKey } from '@/lib/dashboard';
import { dollars } from '@/lib/metrics';
import { BookFlow, JobDialog, type Act } from './ExteriorManage';

const usd = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } as const;
const phone = (p: string | null) => !p || !isRealPhone(p) ? null : p.replace(/^\+1(\d{3})(\d{3})(\d{4})$/, '($1) $2-$3');
const longDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
const startOf = (b: ExtBooking) => parseBlock(b.time_block)?.start ?? 0;

/** Exterior Care's jobs on a month calendar. Click a job to edit it, click a day to see it or book on it. */
export function JobsCalendar({ data, act, busy, readOnly, org, now }: { data: ExteriorData; act: Act; busy: boolean; readOnly: boolean; org: string; now: Date }) {
  const [offset, setOffset] = useState(0);
  const today = dayKey(now);
  const [picked, setPicked] = useState(today);
  const [editing, setEditing] = useState<ExtBooking | null>(null);
  const [flow, setFlow] = useState<string | null>(null);

  const lead = useMemo(() => new Map(data.leads.map(l => [l.id, l])), [data.leads]);
  const byDay = useMemo(() => {
    const map = new Map<string, ExtBooking[]>();
    for (const b of data.bookings) if (b.status !== 'denied' && b.status !== 'cancelled') map.set(b.date, [...(map.get(b.date) ?? []), b]);
    for (const list of map.values()) list.sort((a, b) => startOf(a) - startOf(b));
    return map;
  }, [data.bookings]);

  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const gridStart = new Date(first.getFullYear(), first.getMonth(), 1 - first.getDay());
  const days = Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
  const monthKey = dayKey(first).slice(0, 7);
  const monthJobs = [...byDay].filter(([k]) => k.startsWith(monthKey)).flatMap(([, list]) => list);
  // R36: only sum original lead prices when fully loaded sources prove ONE active visit
  // for that lead, and all selected confirmed visits have a positive recorded price.
  const quoted = (list: ExtBooking[]) => qualifiedDispatchQuotes(data,list);
  const monthValue = quoted(monthJobs);
  const dayJobs = byDay.get(picked) ?? [];
  const dayValue = quoted(dayJobs);
  const dot = { '--dot': 'var(--c-exterior)' } as CSSProperties;

  return <>
    <div className="toolbar">
      <div className="monthnav">
        <button className="icon-button" aria-label="Previous month" onClick={() => setOffset(offset - 1)}><ChevronLeft size={18} /></button>
        <h2>{first.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</h2>
        <button className="icon-button" aria-label="Next month" onClick={() => setOffset(offset + 1)}><ChevronRight size={18} /></button>
        {offset !== 0 && <button className="secondary small" onClick={() => { setOffset(0); setPicked(today); }}>Today</button>}
      </div>
      {!readOnly && <button className="primary" disabled={busy} onClick={() => setFlow(picked >= today ? picked : '')}><CalendarPlus size={16} aria-hidden="true" />Book a job</button>}
    </div>
    <div className="kpis">
      <div><span>Jobs this month</span><strong><NumberFlow value={monthJobs.length} /></strong></div>
      <div><span>Confirmed quote exposure</span><strong>{monthValue.total===null?'Withheld':<NumberFlow value={monthValue.total} format={usd}/>}</strong><small className="quiet">{monthValue.eligible} of {monthValue.confirmed} confirmed visits source-qualified; never paid revenue</small></div>
    </div>
    <div className="calendar-layout">
      <div className="month panel" role="grid" aria-label="Exterior Care jobs by day">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => <div key={d} className="month-head" role="columnheader">{d}</div>)}
        {days.map(d => {
          const k = dayKey(d), jobs = byDay.get(k) ?? [], value = quoted(jobs);
          return (
            <div key={k} role="gridcell" className={`month-day${d.getMonth() !== first.getMonth() ? ' is-other' : ''}${k === today ? ' is-today' : ''}${k === picked ? ' is-picked' : ''}`}>
              <div className="month-top">
                <button className="month-num" aria-label={`${d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}, ${jobs.length} ${jobs.length === 1 ? 'job' : 'jobs'}${value.total !== null ? `, ${dollars(value.total)} source-qualified confirmed quotes` : value.confirmed ? ', confirmed quote total withheld' : ''}`} aria-pressed={k === picked} onClick={() => setPicked(k)}>{d.getDate()}</button>
                {value.total !== null && <span className="month-value" aria-hidden="true" title="Uniquely attributable source-confirmed lead quotes; not accepted or paid">{dollars(value.total)}</span>}
              </div>
              {jobs.slice(0, 3).map(b => { const l = lead.get(b.lead_id ?? ''); return (
                <button key={b.id} className="month-item" style={dot} disabled={readOnly || !l} onClick={() => setEditing(b)} title={`${blockLabel(b.time_block)}: ${l?.name ?? 'Customer'}${l?.service_requested ? `, ${l.service_requested}` : ''}`}>{blockStartLabel(b.time_block)} {l?.name ?? 'Customer'}</button>
              ); })}
              {jobs.length > 3 && <button className="month-more" onClick={() => setPicked(k)}>+{jobs.length - 3} more</button>}
            </div>
          );
        })}
      </div>
      <aside className="calendar-side">
        <section className="panel">
          <header className="panel-head"><h2>{picked === today ? 'Today' : longDay(picked)}</h2></header>
          {dayJobs.length > 0 && <p className="day-total"><strong>{dayValue.total===null?'Quoted total withheld':<NumberFlow value={dayValue.total} format={usd}/>}</strong> source-qualified quote exposure across {dayValue.confirmed} confirmed visit{dayValue.confirmed===1?'':'s'}<small className="quiet">{dayValue.eligible} uniquely attributable; pending approvals, repeats, missing quotes and incomplete source windows do not become revenue.</small></p>}
          {dayJobs.length ? <ol className="job-day">{dayJobs.map(b => { const l = lead.get(b.lead_id ?? ''); return (
            <li key={b.id} style={dot}>
              <time>{blockLabel(b.time_block)}</time>
              <div>
                <b>{l?.name || 'Lead no longer on record'}</b>
                <span>{[l?.service_requested, l?.quote_amount != null ? `Original lead quote ${dollars(l.quote_amount)} (not accepted/visit-attributed)` : null].filter(Boolean).join(' / ') || 'No service entered'}</span>
                {l?.address && <span>{l.address}</span>}
                {phone(l?.phone ?? null) && <span>{phone(l?.phone ?? null)}</span>}
                {b.status === 'pending_approval' && <small className="quiet">Waiting for approval</small>}
              </div>
              {!readOnly && l && <button className="secondary small" onClick={() => setEditing(b)}><Pencil size={13} aria-hidden="true" />Edit</button>}
            </li>
          ); })}</ol> : <div className="empty"><p><b>Nothing booked.</b> {readOnly ? '' : 'Press "Book a job" to add one.'}</p></div>}
          {!readOnly && picked >= today && <button className="secondary" disabled={busy} onClick={() => setFlow(picked)}><CalendarPlus size={15} aria-hidden="true" />Book on {new Date(`${picked}T12:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</button>}
        </section>
      </aside>
    </div>
    <BookFlow startDate={flow} close={() => setFlow(null)} data={data} act={act} busy={busy} org={org} now={now} />
    <JobDialog booking={editing} lead={editing ? lead.get(editing.lead_id ?? '') : undefined} close={() => setEditing(null)} act={act} busy={busy} org={org} bookings={data.bookings} now={now} />
  </>;
}
