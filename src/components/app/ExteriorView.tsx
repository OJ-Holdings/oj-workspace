'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import NumberFlow from '@number-flow/react';
import { Check, Lock } from 'lucide-react';
import { loadExterior, saveUpgrades } from '@/app/workspace/exterior-actions';
import { tier, toggleUpgrade, upgradeCount, upgradeGroups, upgradeStatus, type Completed } from '@/lib/upgrades';
import { doorDetails, jobDate, jobDateBasis, sourceLabel, summariseJobs, summariseSessions, type Done, type ExteriorData, type ExteriorResult } from '@/lib/exterior';
import { businessDay, emptyJobFilters, filterCompletedJobs, serviceName, type JobFilters } from '@/lib/reporting';
import { sampleExterior } from '@/lib/exterior-sample';
import { ActivityList, BookingsManager, ExteriorSettings, LeadsManager, SessionsManager } from './ExteriorManage';
import { JobsCalendar } from './ExteriorCalendar';
import { dayKey } from '@/lib/dashboard';
import { dollars } from '@/lib/metrics';

const usd = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } as const;
const day = (iso: string) => new Date(iso.length === 10 ? `${iso}T12:00:00` : iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const cash = (v: number | null) => v === null ? '-' : dollars(v);
const percent = (v: number | null) => v === null ? '-' : `${Math.round(v * 100)}%`;

/** Every Exterior Care tab beyond the shared ones: the records the original Exterior Care app works on. */
export function ExteriorView({ tab, org, mode, readOnly }: { tab: string; org: string; mode: 'preview' | 'live'; readOnly: boolean }) {
  const [result, setResult] = useState<ExteriorResult | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(50);
  const [ticked, setTicked] = useState<Completed>({});
  const [notice, setNotice] = useState('');
  useEffect(() => {
    if (mode === 'preview') { const time = new Date(); setResult({ ok: true, data: sampleExterior(time) }); setNow(time); return; }
    let live = true;
    setResult(null);
    loadExterior(org).then(r => { if (live) { setResult(r); setNow(new Date()); if (r.ok && r.data.extras) setTicked(r.data.extras.upgrades); } }, () => { if (live) setResult({ ok: false, reason: 'failed' }); });
    return () => { live = false; };
  }, [org, mode, attempt]);

  /** Reloads the records without blanking the screen. */
  const refresh = useCallback(() => loadExterior(org).then(r => { if (r.ok) { setResult(r); setNow(new Date()); } }), [org]);
  /** Runs one change, says what happened, and reloads on success. */
  const act = useCallback(async <T extends object>(work: () => Promise<Done<T>>, success: (r: T) => string) => {
    if (mode === 'preview') { setNotice('These Exterior Care records are read-only samples. Nothing was saved.'); return false; }
    setBusy(true); setNotice('');
    try {
      const r = await work();
      if (!r.ok) { setNotice(r.message); return false; }
      setNotice(success(r as T)); await refresh(); return true;
    } catch { setNotice('That did not go through. Check your connection and try again.'); return false; }
    finally { setBusy(false); }
  }, [refresh, mode]);

  function toggle(id: string, name: string) {
    if (mode === 'preview') return;
    const { next, removed } = toggleUpgrade(ticked, id);
    if (removed.length > 1 && !window.confirm(`Unticking "${name}" also unticks ${removed.length - 1} upgrade${removed.length === 2 ? '' : 's'} that depend on it. Continue?`)) return;
    const before = ticked;
    setTicked(next); setNotice('');
    saveUpgrades(org, next).then(() => setNotice('Saved.'), () => { setTicked(before); setNotice('That change did not save. Check your connection and try again.'); });
  }

  if (!result || !now) return <div className="loading" aria-busy="true" />;
  if (!result.ok) return result.reason === 'no-access'
    ? <div className="planned"><h2>Members only</h2><p>These records hold customers&apos; names, phone numbers and addresses, so view-only access does not include them. Ask a founder for member access.</p></div>
    : <div className="planned" role="alert"><h2>The Exterior Care records did not load</h2><p>Nothing is shown rather than a partial list.</p><button className="primary" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>;

  const { data } = result;
  const common = { data, act, busy, readOnly: readOnly || mode === 'preview', org, now };
  const status = <p className="notice" role="status" aria-live="polite">{notice}</p>;

  if (tab === 'leads') return <>{status}<LeadsManager {...common} /></>;
  if (tab === 'bookings') return <>{status}<BookingsManager {...common} /></>;
  if (tab === 'calendar') return <>{status}<JobsCalendar {...common} /></>;
  if (tab === 'activity') return <ActivityList data={data} />;
  if (tab === 'settings') return <>{status}<ExteriorSettings {...common} /></>;

  if (tab === 'jobs') return <ExteriorJobReport data={data} now={now} mode={mode} />;

  if ((tab === 'upgrades' || tab === 'quotes') && !data.extras) return (
    <div className="planned"><h2>One step left to switch this on</h2><p>This tab is built, but the database does not share these records with the workspace yet. A founder needs to run one more database update.</p></div>
  );

  if (tab === 'upgrades') {
    const state = upgradeStatus(ticked);
    const done = Object.values(state).filter(s => s === 'done').length;
    return <>
      <div className="kpis">
        <div><span>Upgrades unlocked</span><strong><NumberFlow value={done} /> <small className="quiet">of {upgradeCount}</small></strong></div>
        <div><span>Ready to do next</span><strong><NumberFlow value={Object.values(state).filter(s => s === 'ready').length} /></strong></div>
        <div><span>Level</span><strong>{tier(done)}</strong><small className="quiet">{Math.round((done / upgradeCount) * 100)}% of the way</small></div>
      </div>
      <p className="notice" role="status" aria-live="polite">{notice}</p>
      {upgradeGroups.map(g => {
        const count = g.nodes.filter(n => state[n.id] === 'done').length;
        return (
          <section className="panel" key={g.id}>
            <header className="panel-head"><h2>{g.name}</h2><span className="quiet">{count} of {g.nodes.length}</span></header>
            <progress className="upgrade-bar" value={count} max={g.nodes.length} aria-label={`${g.name}: ${count} of ${g.nodes.length} done`} />
            <ul className="upgrades">{g.nodes.map(n => {
              const s = state[n.id];
              return (
                <li key={n.id}>
                  <button type="button" className={`upgrade is-${s}`} aria-pressed={s === 'done'} disabled={readOnly || mode === 'preview' || s === 'locked'} onClick={() => toggle(n.id, n.name)}>
                    <i aria-hidden="true">{s === 'done' ? <Check size={14} /> : s === 'locked' ? <Lock size={12} /> : null}</i>
                    <b>{n.name}</b><span>{n.desc}</span>
                    <small>{s === 'locked' ? 'Locked' : s === 'done' ? 'Done' : 'Ready'}{n.cost ? `, ${n.cost}` : ''}</small>
                  </button>
                </li>
              );
            })}</ul>
          </section>
        );
      })}
      <p className="quiet">The same list the Exterior Care app shows. Ticking one here ticks it there. A locked upgrade opens once the ones it depends on are done.</p>
    </>;
  }

  if (tab === 'quotes') {
    const quotes = data.extras!.quotes;
    const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).toISOString();
    return <>
      <div className="kpis">
        <div><span>Website quote requests</span><strong><NumberFlow value={quotes.length} /></strong></div>
        <div><span>Last 30 days</span><strong><NumberFlow value={quotes.filter(q => q.created_at >= from).length} /></strong></div>
        <div><span>Want regular service</span><strong><NumberFlow value={quotes.filter(q => q.recurring_interest).length} /></strong></div>
      </div>
      <section className="panel">
        <header className="panel-head"><h2>Requests</h2></header>
        {quotes.length ? <div className="tablewrap"><table className="table">
          <thead><tr><th>Received</th><th>Name</th><th>Phone</th><th>Email</th><th>Address</th><th>Service</th><th>Details</th></tr></thead>
          <tbody>{quotes.slice(0, shown).map(q => (
            <tr key={q.id}><td>{day(q.created_at)}</td><td>{q.name || '-'}{q.business_name ? ` (${q.business_name})` : ''}</td><td>{q.phone ? <a href={`tel:${q.phone}`}>{q.phone}</a> : '-'}</td><td>{q.email ? <a href={`mailto:${q.email}`}>{q.email}</a> : '-'}</td>
              <td>{q.address || '-'}</td><td>{[q.service_needed, q.property_type].filter(Boolean).join(', ') || '-'}</td><td>{q.description || '-'}</td></tr>
          ))}</tbody></table>{quotes.length > shown && <button className="secondary showmore" onClick={() => setShown(shown + 50)}>Show {Math.min(50, quotes.length - shown)} more of {quotes.length}</button>}</div>
          : <div className="empty"><p><b>No quote requests yet.</b> Requests sent from the website form appear here.</p></div>}
        <p className="quiet">Sent through the quote form on the Exterior Care website.</p>
      </section>
    </>;
  }

  if (tab === 'door-knocking') {
    const s = summariseSessions(data.sessions);
    const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    const d = doorDetails(data.sessions, dayKey(monday));
    const funnel = [['Doors knocked', s.doors, null], ['Answered', s.answers, s.doors], ['Interested', s.interested, s.answers], ['Quotes given', s.quotes, s.interested], ['Jobs scheduled', s.jobs, s.quotes]] as const;
    return <>
      {status}
      <div className="kpis many">
        <div><span>Doors this week</span><strong><NumberFlow value={d.week.doors} /></strong><small className="quiet">{d.week.sessions} sessions since Monday</small></div>
        <div><span>Per door this week</span><strong>{d.week.perDoor === null ? '-' : dollars(Math.round(d.week.perDoor * 100) / 100)}</strong><small className="quiet">{dollars(d.week.jobTotal)} booked</small></div>
        <div><span>Doors knocked</span><strong><NumberFlow value={s.doors} /></strong><small className="quiet">Across {s.sessions} sessions</small></div>
        <div><span>Answer rate</span><strong>{percent(s.answerRate)}</strong><small className="quiet">{s.answers} answers</small></div>
        <div><span>Jobs scheduled</span><strong><NumberFlow value={s.jobs} /></strong><small className="quiet">{s.quotes} quotes given</small></div>
        <div><span>Job value from knocking</span><strong><NumberFlow value={s.jobTotal} format={usd} /></strong><small className="quiet">{s.perDoor === null ? '' : `${dollars(Math.round(s.perDoor * 100) / 100)} a door`}</small></div>
      </div>
      <div className="pair">
        <section className="panel">
          <header className="panel-head"><h2>From door to job, all time</h2></header>
          <ol className="funnel">{funnel.map(([label, value, of]) => <li key={label}><span>{label}</span><b>{value.toLocaleString('en-US')}</b><small className="quiet">{of ? percent(of ? value / of : null) : ''}</small><i style={{ width: `${s.doors ? Math.max(2, (value / s.doors) * 100) : 0}%` }} /></li>)}</ol>
        </section>
        <section className="panel">
          <header className="panel-head"><h2>Best areas, by money per door</h2></header>
          {d.byArea.length ? <ol className="areas">{d.byArea.slice(0, 10).map(a => <li key={a.area}><div><b>{a.area}</b><small className="quiet">{a.doors} doors, {a.sessions} session{a.sessions === 1 ? '' : 's'}{a.closeRate === null ? '' : `, ${percent(a.closeRate)} of quotes booked`}</small></div><strong>{a.perDoor === null ? '-' : dollars(Math.round(a.perDoor * 100) / 100)}</strong></li>)}</ol> : <div className="empty"><p><b>No areas recorded.</b></p></div>}
          {d.best && <p className="quiet">Best session: {d.best.area || 'unknown area'} on {day(d.best.session_date)}, {dollars(Math.round(d.best.perDoor * 100) / 100)} a door ({d.best.doors_knocked} doors, {cash(d.best.job_total)} booked).</p>}
        </section>
      </div>
      <SessionsManager {...common} />
    </>;
  }

  return null;
}

/** A single filtered population drives totals and every drilldown, including the accessible record table. */
export function ExteriorJobReport({ data, now, mode }: { data: ExteriorData; now: Date; mode: 'preview' | 'live' }) {
  const pathname = usePathname(), query = useSearchParams(), router = useRouter();
  const filterDate = (key: string) => /^\d{4}-\d{2}-\d{2}$/.test(query.get(key) || '') ? query.get(key)! : '';
  const filters: JobFilters = { from: filterDate('from'), to: filterDate('to'), service: query.get('service') || '', source: query.get('source') || '' };
  const [inspection, setInspection] = useState<'all' | 'missing-payment' | 'missing-cost' | 'matched'>('all');
  const [shown, setShown] = useState(50);
  const records = useRef<HTMLHeadingElement>(null);
  const completed = data.leads.filter(lead => lead.status === 'completed');
  const done = filterCompletedJobs(data.leads, filters, sourceLabel).sort((a, b) => jobDate(b).localeCompare(jobDate(a)));
  const figures = summariseJobs(done, iso => businessDay(iso)?.slice(0, 7) || 'Unknown date');
  const monthLabel = (key: string) => /^\d{4}-\d{2}$/.test(key) ? new Date(`${key}-15T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : key;
  const base = mode === 'preview' ? '/preview' : '/workspace';
  const services = [...new Set(completed.map(serviceName))].sort();
  const sources = [...new Set(completed.map(lead => sourceLabel(lead.source)))].sort();
  const rows = done.filter(lead => inspection === 'missing-payment' ? lead.job_revenue === null : inspection === 'missing-cost' ? lead.job_cost === null : inspection === 'matched' ? lead.job_revenue !== null && lead.job_cost !== null : true);
  const invalidRange = Boolean(filters.from && filters.to && filters.from > filters.to);
  const coverage = data.coverage?.leads;
  const currentMonth = businessDay(now.toISOString())!.slice(0, 7);
  const monthFigures = summariseJobs(completed.filter(lead => businessDay(jobDate(lead))?.startsWith(currentMonth)), iso => businessDay(iso)?.slice(0, 7) || 'Unknown date');
  const goal = data.extras?.goal;
  const focusRecords = () => records.current?.focus();
  function update(patch: Partial<JobFilters>) {
    const next = new URLSearchParams(query.toString());
    for (const [key, value] of Object.entries(patch)) value ? next.set(key, value) : next.delete(key);
    router.replace(`${pathname}${next.size ? `?${next}` : ''}`, { scroll: false });
    setInspection('all'); setShown(50);
  }
  function inspect(value: typeof inspection) { setInspection(value); setShown(50); focusRecords(); }
  function drillMonth(month: string) {
    if (!/^\d{4}-\d{2}$/.test(month)) return;
    const end = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
    update({ from: `${month}-01`, to: `${month}-${end}` }); focusRecords();
  }
  return <>
    {mode === 'preview' && <p className="banner-inline">Fictional Exterior Care sample records. Explore filters and source rows here; no live records or payments are changed.</p>}
    <section className="panel" aria-label="Job report filters">
      <header className="panel-head"><h2>Completed work, clearly accounted for</h2><span className="quiet">{completed.length} completed records</span></header>
      <div className="fields">
        <label>From<input type="date" value={filters.from} max={filters.to || undefined} onChange={event => update({ from: event.target.value })} /></label>
        <label>Through<input type="date" value={filters.to} min={filters.from || undefined} onChange={event => update({ to: event.target.value })} /></label>
        <label>Service<select value={filters.service} onChange={event => update({ service: event.target.value })}><option value="">All services</option>{services.map(service => <option key={service}>{service}</option>)}</select></label>
        <label>Lead source<select value={filters.source} onChange={event => update({ source: event.target.value })}><option value="">All sources</option>{sources.map(source => <option key={source}>{source}</option>)}</select></label>
      </div>
      <div className="formactions"><button className="secondary small" onClick={() => update({ from: `${currentMonth}-01`, to: businessDay(now.toISOString())! })}>This month</button><button className="secondary small" onClick={() => update(emptyJobFilters)}>Clear filters</button></div>
      {invalidRange && <p role="alert" className="notice">Choose an end date on or after the start date.</p>}
      <p className="quiet">Dates use America/Chicago and the recorded completion date. {figures.estimatedDateJobs > 0 ? `${figures.estimatedDateJobs} jobs use an estimated date from the last update or creation because completion was not dated. ` : ''}Payment collection dates are not recorded separately.</p>
      {coverage && coverage.total !== null && coverage.total > coverage.loaded && <p className="banner-inline" role="status">Partial history: {coverage.loaded} of {coverage.total} accessible lead records loaded. These totals cover the loaded records only.</p>}
    </section>

    <div className="kpis">
      <div><span>Recorded payments</span><strong>{cash(figures.revenue)}</strong><small className="quiet">Entered on {figures.revenueJobs} of {figures.jobs} completed jobs</small></div>
      <div><span>Recorded job costs</span><strong>{cash(figures.cost)}</strong><small className="quiet">Entered on {figures.costJobs} of {figures.jobs} completed jobs</small></div>
      <div><span>Known-job contribution</span><strong>{cash(figures.contribution)}</strong><small className="quiet">Payments less entered costs on {figures.matchedJobs} jobs with both figures</small></div>
      <div><span>Average recorded payment</span><strong>{cash(figures.average)}</strong><small className="quiet">Only jobs with a payment figure entered</small></div>
    </div>
    <section className="panel">
      <header className="panel-head"><h2>What still needs recording</h2><span className="quiet">{figures.matchedJobs} / {figures.jobs} jobs have both figures</span></header>
      <div className="filter-chips">
        <button aria-pressed={inspection === 'all'} onClick={() => inspect('all')}>All jobs <span>{figures.jobs}</span></button>
        <button aria-pressed={inspection === 'missing-payment'} onClick={() => inspect('missing-payment')}>Payment not recorded <span>{figures.missingRevenue}</span></button>
        <button aria-pressed={inspection === 'missing-cost'} onClick={() => inspect('missing-cost')}>Cost not recorded <span>{figures.missingCosts}</span></button>
        <button aria-pressed={inspection === 'matched'} onClick={() => inspect('matched')}>Both entered <span>{figures.matchedJobs}</span></button>
      </div>
      <p className="quiet">A completed job may still be unpaid. Blank costs remain unknown; an explicit $0 is known. Contribution covers only the paired records and is not total business profit. Owner labor, overhead and other unentered costs may be missing.</p>
    </section>

    {goal !== null && goal !== undefined && goal > 0 && <section className="panel">
      <header className="panel-head"><h2>{monthLabel(currentMonth)} job revenue goal</h2><span className="quiet">{cash(monthFigures.revenue)} of {dollars(goal)}</span></header>
      <progress className="upgrade-bar" value={Math.min(monthFigures.revenue ?? 0, goal)} max={goal} aria-label="Monthly recorded job payments against goal" />
      <p className="quiet">All services and sources; independent of the filters above. Based on recorded payments for work dated this month, not collection dates. {monthFigures.missingRevenue} completed jobs have no payment entered.</p>
    </section>}

    <section className="panel">
      <header className="panel-head"><h2>Completion months</h2><span className="quiet">Choose a month to inspect its jobs</span></header>
      {figures.byMonth.length ? <div className="tablewrap"><table className="table">
        <caption className="sr-only">Recorded payments and costs grouped by completion month for the current filters</caption>
        <thead><tr><th scope="col">Month</th><th scope="col" className="num">Jobs</th><th scope="col" className="num">Payments entered</th><th scope="col" className="num">Costs entered</th><th scope="col" className="num">Paired contribution</th><th scope="col">Coverage</th></tr></thead>
        <tbody>{figures.byMonth.map(month => <tr key={month.label}><th scope="row"><button className="secondary small" onClick={() => drillMonth(month.label)} disabled={month.label === 'Unknown date'}>{monthLabel(month.label)}</button></th><td className="num">{month.jobs}</td><td className="num">{cash(month.revenue)}</td><td className="num">{cash(month.cost)}</td><td className="num">{cash(month.contribution)}</td><td>{month.matchedJobs}/{month.jobs} paired{month.estimatedDateJobs ? `; ${month.estimatedDateJobs} estimated dates` : ''}</td></tr>)}</tbody>
      </table></div> : <div className="empty"><p><b>No completed jobs match these filters.</b> Clear the filters or complete a job from Leads.</p></div>}
    </section>

    <div className="pair">
      <section className="panel"><header className="panel-head"><h2>Service mix</h2><span className="quiet">Filter by service</span></header><div className="tablewrap"><table className="table">
        <caption className="sr-only">Completed jobs by service for the current filters</caption>
        <thead><tr><th scope="col">Service</th><th scope="col" className="num">Jobs</th><th scope="col" className="num">Payments entered</th></tr></thead>
        <tbody>{figures.byService.map(service => <tr key={service.label}><th scope="row"><button className="secondary small" onClick={() => { update({ service: service.label }); focusRecords(); }}>{service.label}</button></th><td className="num">{service.jobs}</td><td className="num">{cash(service.revenue)}<small className="quiet block">{service.revenueJobs}/{service.jobs} recorded</small></td></tr>)}</tbody>
      </table></div></section>
      <section className="panel"><header className="panel-head"><h2>Sources of completed work</h2><span className="quiet">Filter by source</span></header><div className="tablewrap"><table className="table">
        <caption className="sr-only">Lead sources of completed jobs for the current filters; this is not a lead conversion rate</caption>
        <thead><tr><th scope="col">Source</th><th scope="col" className="num">Completed jobs</th><th scope="col" className="num">Payments entered</th></tr></thead>
        <tbody>{figures.bySource.map(source => <tr key={source.source}><th scope="row"><button className="secondary small" onClick={() => { update({ source: source.source }); focusRecords(); }}>{source.source}</button></th><td className="num">{source.leads}</td><td className="num">{cash(source.revenue)}</td></tr>)}</tbody>
      </table></div></section>
    </div>

    <section className="panel">
      <header className="panel-head"><h2 ref={records} tabIndex={-1}>Jobs behind the figures</h2><span className="quiet" role="status">{rows.length} jobs{inspection !== 'all' ? ` / ${inspection === 'missing-payment' ? 'payment not recorded' : inspection === 'missing-cost' ? 'cost not recorded' : 'both figures entered'}` : ''}</span></header>
      {rows.length ? <div className="tablewrap"><table className="table">
        <caption className="sr-only">Source job records for the selected report and completeness filter</caption>
        <thead><tr><th scope="col">Work date</th><th scope="col">Customer</th><th scope="col">Service / source</th><th scope="col" className="num">Quote</th><th scope="col" className="num">Payment entered</th><th scope="col" className="num">Cost entered</th></tr></thead>
        <tbody>{rows.slice(0, shown).map(lead => <tr key={lead.id}><td>{businessDay(jobDate(lead)) || 'Unknown'}{jobDateBasis(lead) !== 'completion' && <small className="quiet block">Estimated from {lead.updated_at ? 'last update' : 'creation'}</small>}</td><th scope="row"><Link className="secondary small" href={`${base}/b/exterior/leads?lead=${encodeURIComponent(lead.id)}`}>{lead.name || 'Unnamed customer'}</Link></th><td>{serviceName(lead)}<small className="quiet block">{sourceLabel(lead.source)}</small></td><td className="num">{cash(lead.quote_amount)}</td><td className="num">{lead.job_revenue === null ? 'Not recorded' : cash(lead.job_revenue)}</td><td className="num">{lead.job_cost === null ? 'Not recorded' : cash(lead.job_cost)}</td></tr>)}</tbody>
      </table>{rows.length > shown && <button className="secondary showmore" onClick={() => setShown(value => value + 50)}>Show {Math.min(50, rows.length - shown)} more jobs</button>}</div> : <div className="empty"><p><b>No jobs in this selection.</b> Choose another completeness filter to return to the source records.</p></div>}
    </section>
  </>;
}
