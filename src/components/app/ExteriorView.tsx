'use client';

import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { loadExterior } from '@/app/workspace/exterior-actions';
import { jobDate, sourceLabel, statusLabel, summariseJobs, summariseLeads, summariseSessions, threads, type ExteriorResult } from '@/lib/exterior';
import { dayKey } from '@/lib/dashboard';
import { dollars } from '@/lib/metrics';

const usd = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } as const;
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const cash = (v: number | null) => v === null ? '-' : dollars(v);
const percent = (v: number | null) => v === null ? '-' : `${Math.round(v * 100)}%`;

/** The Outreach leads, Conversations, Bookings and Door knocking tabs: the existing Exterior Care records, read only. */
export function ExteriorView({ tab, org, mode }: { tab: string; org: string; mode: 'preview' | 'live' }) {
  const [result, setResult] = useState<ExteriorResult | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [status, setStatus] = useState('');
  const [shown, setShown] = useState(50);
  useEffect(() => {
    if (mode !== 'live') return;
    let live = true;
    setResult(null);
    loadExterior(org).then(r => { if (live) { setResult(r); setNow(new Date()); } }, () => { if (live) setResult({ ok: false, reason: 'failed' }); });
    return () => { live = false; };
  }, [org, mode, attempt]);

  if (mode === 'preview') return <div className="planned"><h2>Shown in your live workspace</h2><p>These are real customer records from the Exterior Care system, so there is no sample version of this tab.</p></div>;
  if (!result || !now) return <div className="loading" aria-busy="true" />;
  if (!result.ok) return result.reason === 'no-access'
    ? <div className="planned"><h2>Members only</h2><p>These records hold customers&apos; names, phone numbers and addresses, so view-only access does not include them. Ask a founder for member access.</p></div>
    : <div className="planned" role="alert"><h2>The Exterior Care records did not load</h2><p>Nothing is shown rather than a partial list.</p><button className="primary" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>;

  const { data } = result;
  const source = <p className="quiet">From the Exterior Care leads system. To change a record, use that system; this page only reads.</p>;

  if (tab === 'outreach') {
    const s = summariseLeads(data.leads);
    const rows = data.leads.filter(l => !status || (l.status ?? 'unknown') === status);
    return <>
      <div className="kpis">
        <div><span>Leads on record</span><strong><NumberFlow value={s.total} /></strong></div>
        <div><span>Still open</span><strong><NumberFlow value={s.open} /></strong><small className="quiet">New, contacted, following up or booked</small></div>
        <div><span>Jobs completed</span><strong><NumberFlow value={s.completed} /></strong></div>
        <div><span>Job revenue recorded</span><strong>{s.revenue === null ? '-' : <NumberFlow value={s.revenue} format={usd} />}</strong><small className="quiet">Entered on {s.revenueJobs} of {s.completed} completed jobs</small></div>
      </div>
      <section className="panel">
        <header className="panel-head"><h2>Leads</h2>
          <label className="quiet">Status <select value={status} onChange={e => { setStatus(e.target.value); setShown(50); }}><option value="">All ({s.total})</option>{s.byStatus.map(([id, n]) => <option key={id} value={id}>{statusLabel(id)} ({n})</option>)}</select></label>
        </header>
        {rows.length ? <div className="tablewrap"><table className="table">
          <thead><tr><th>Name</th><th>Phone</th><th>Address</th><th>Service</th><th>Status</th><th>Source</th><th className="num">Quote</th><th className="num">Paid</th><th>Added</th></tr></thead>
          <tbody>{rows.slice(0, shown).map(l => (
            <tr key={l.id}><td>{l.name || '-'}</td><td>{l.phone ? <a href={`tel:${l.phone}`}>{l.phone}</a> : '-'}</td><td>{l.address || '-'}</td><td>{l.service_requested || '-'}</td>
              <td><span className="tag">{statusLabel(l.status)}</span></td><td>{sourceLabel(l.source)}</td><td className="num">{cash(l.quote_amount)}</td><td className="num">{cash(l.job_revenue)}</td><td>{day(l.created_at)}</td></tr>
          ))}</tbody></table>{rows.length > shown && <button className="secondary showmore" onClick={() => setShown(shown + 50)}>Show {Math.min(50, rows.length - shown)} more of {rows.length}</button>}</div>
          : <div className="empty"><p><b>No leads with that status.</b></p></div>}
        {source}
      </section>
    </>;
  }

  if (tab === 'jobs') {
    const j = summariseJobs(data.leads, iso => dayKey(new Date(iso)).slice(0, 7));
    const month = (key: string) => new Date(`${key}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const done = data.leads.filter(l => l.status === 'completed').sort((a, b) => jobDate(b).localeCompare(jobDate(a)));
    return <>
      <div className="kpis">
        <div><span>Paid for completed jobs</span><strong><NumberFlow value={j.revenue} format={usd} /></strong><small className="quiet">{j.jobs} jobs, all time</small></div>
        <div><span>Job costs entered</span><strong><NumberFlow value={j.cost} format={usd} /></strong><small className="quiet">On {j.costJobs} of {j.jobs} jobs</small></div>
        <div><span>Profit on those figures</span><strong><NumberFlow value={j.profit} format={usd} /></strong><small className="quiet">Jobs with no cost entered count as no cost</small></div>
        <div><span>Average job</span><strong>{j.average === null ? '-' : dollars(Math.round(j.average))}</strong></div>
      </div>
      <section className="panel">
        <header className="panel-head"><h2>By month</h2></header>
        {j.byMonth.length ? <div className="tablewrap"><table className="table">
          <thead><tr><th>Month</th><th className="num">Jobs</th><th className="num">Paid</th><th className="num">Costs</th><th className="num">Profit</th></tr></thead>
          <tbody>{j.byMonth.map(m => <tr key={m.label}><td>{month(m.label)}</td><td className="num">{m.jobs}</td><td className="num">{dollars(m.revenue)}</td><td className="num">{dollars(m.cost)}</td><td className="num">{dollars(m.profit)}</td></tr>)}</tbody></table></div>
          : <div className="empty"><p><b>No completed jobs on record.</b></p></div>}
      </section>
      <div className="split">
        <section className="panel">
          <header className="panel-head"><h2>By service</h2></header>
          <div className="tablewrap"><table className="table">
            <thead><tr><th>Service</th><th className="num">Jobs</th><th className="num">Paid</th></tr></thead>
            <tbody>{j.byService.map(s => <tr key={s.label}><td>{s.label}</td><td className="num">{s.jobs}</td><td className="num">{dollars(s.revenue)}</td></tr>)}</tbody></table></div>
        </section>
        <section className="panel">
          <header className="panel-head"><h2>Where leads come from</h2></header>
          <div className="tablewrap"><table className="table">
            <thead><tr><th>Source</th><th className="num">Leads</th><th className="num">Booked or done</th><th className="num">Paid</th></tr></thead>
            <tbody>{j.bySource.map(s => <tr key={s.source}><td>{s.source}</td><td className="num">{s.leads}</td><td className="num">{s.won} ({percent(s.rate)})</td><td className="num">{dollars(s.revenue)}</td></tr>)}</tbody></table></div>
        </section>
      </div>
      <section className="panel">
        <header className="panel-head"><h2>Completed jobs</h2></header>
        <div className="tablewrap"><table className="table">
          <thead><tr><th>Done</th><th>Customer</th><th>Service</th><th className="num">Quote</th><th className="num">Paid</th><th className="num">Cost</th></tr></thead>
          <tbody>{done.slice(0, shown).map(l => <tr key={l.id}><td>{day(jobDate(l))}</td><td>{l.name || '-'}</td><td>{l.service_requested || '-'}</td><td className="num">{cash(l.quote_amount)}</td><td className="num">{cash(l.job_revenue)}</td><td className="num">{cash(l.job_cost)}</td></tr>)}</tbody></table>
          {done.length > shown && <button className="secondary showmore" onClick={() => setShown(shown + 50)}>Show {Math.min(50, done.length - shown)} more of {done.length}</button>}</div>
        {source}
      </section>
    </>;
  }

  if (tab === 'bookings') {
    const today = dayKey(now), month = today.slice(0, 7);
    const lead = new Map(data.leads.map(l => [l.id, l]));
    const upcoming = data.bookings.filter(b => b.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past = data.bookings.filter(b => b.date < today);
    return <>
      <div className="kpis">
        <div><span>Upcoming jobs</span><strong><NumberFlow value={upcoming.length} /></strong></div>
        <div><span>Booked this month</span><strong><NumberFlow value={data.bookings.filter(b => b.date.startsWith(month)).length} /></strong></div>
        <div><span>Bookings on record</span><strong><NumberFlow value={data.bookings.length} /></strong></div>
      </div>
      {[['Upcoming', upcoming, 'Nothing booked from today on.'] as const, ['Past', past, 'No past bookings.'] as const].map(([title, list, none]) => (
        <section className="panel" key={title}>
          <header className="panel-head"><h2>{title}</h2></header>
          {list.length ? <div className="tablewrap"><table className="table">
            <thead><tr><th>Date</th><th>Time</th><th>Customer</th><th>Service</th><th>Address</th><th>Status</th></tr></thead>
            <tbody>{list.map(b => { const l = b.lead_id ? lead.get(b.lead_id) : undefined; return (
              <tr key={b.id}><td>{day(b.date)}</td><td>{b.time_block || '-'}</td><td>{l?.name || 'Lead no longer on record'}</td><td>{l?.service_requested || '-'}</td><td>{l?.address || '-'}</td><td>{statusLabel(b.status)}</td></tr>
            ); })}</tbody></table></div>
            : <div className="empty"><p><b>{none}</b></p></div>}
        </section>
      ))}
      {source}
    </>;
  }

  if (tab === 'door-knocking') {
    const s = summariseSessions(data.sessions);
    return <>
      <div className="kpis">
        <div><span>Doors knocked</span><strong><NumberFlow value={s.doors} /></strong><small className="quiet">Across {s.sessions} sessions</small></div>
        <div><span>Answer rate</span><strong>{percent(s.answerRate)}</strong><small className="quiet">{s.answers} answers</small></div>
        <div><span>Jobs scheduled</span><strong><NumberFlow value={s.jobs} /></strong><small className="quiet">{s.quotes} quotes given</small></div>
        <div><span>Job value from knocking</span><strong><NumberFlow value={s.jobTotal} format={usd} /></strong><small className="quiet">{s.perDoor === null ? '' : `${dollars(Math.round(s.perDoor * 100) / 100)} a door`}</small></div>
      </div>
      <section className="panel">
        <header className="panel-head"><h2>Sessions</h2></header>
        {data.sessions.length ? <div className="tablewrap"><table className="table">
          <thead><tr><th>Date</th><th>Who</th><th>Area</th><th className="num">Doors</th><th className="num">Answers</th><th className="num">Interested</th><th className="num">Quotes</th><th className="num">Jobs</th><th className="num">Job value</th></tr></thead>
          <tbody>{data.sessions.map(x => (
            <tr key={x.id}><td>{day(x.session_date)}</td><td>{x.knocked_by || '-'}</td><td>{x.area || '-'}</td><td className="num">{x.doors_knocked ?? '-'}</td><td className="num">{x.answers ?? '-'}</td><td className="num">{x.interested ?? '-'}</td><td className="num">{x.quotes_given ?? '-'}</td><td className="num">{x.jobs_scheduled ?? '-'}</td><td className="num">{cash(x.job_total)}</td></tr>
          ))}</tbody></table></div>
          : <div className="empty"><p><b>No door-knocking sessions recorded.</b></p></div>}
        {source}
      </section>
    </>;
  }

  const list = threads(data.messages, data.leads);
  return (
    <section className="panel">
      <header className="panel-head"><h2>Text conversations</h2></header>
      {list.length ? list.map(t => (
        <details key={t.leadId} className="thread">
          <summary><b>{t.name}</b><span className="quiet">{t.messages.length} texts, last {day(t.last)}</span></summary>
          <ol>{t.messages.map(m => <li key={m.id} className={m.direction === 'outbound' ? 'out' : 'in'}><span className="quiet">{m.direction === 'outbound' ? 'OJ' : t.name}, {new Date(m.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</span><p>{m.body}</p></li>)}</ol>
        </details>
      )) : <div className="empty"><p><b>No texts on record yet.</b> The Exterior Care system has not saved any conversations. When it does, each lead&apos;s thread appears here.</p></div>}
      {data.messagesTruncated && <p className="quiet">Showing the latest 2,000 texts.</p>}
      <p className="quiet">Texts are sent by the Exterior Care system, not from this page.</p>
    </section>
  );
}
