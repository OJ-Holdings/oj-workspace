'use client';

import { useCallback, useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { Check, Lock } from 'lucide-react';
import { loadExterior, saveUpgrades, syncDoorSheet } from '@/app/workspace/exterior-actions';
import { tier, toggleUpgrade, upgradeCount, upgradeGroups, upgradeStatus, type Completed } from '@/lib/upgrades';
import { doorDetails, jobDate, summariseJobs, summariseSessions, type Done, type ExteriorResult } from '@/lib/exterior';
import { ActivityList, BookingsManager, Conversations, ExteriorSettings, LeadsManager } from './ExteriorManage';
import { RefreshCw } from 'lucide-react';
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
    if (mode !== 'live') return;
    let live = true;
    setResult(null);
    loadExterior(org).then(r => { if (live) { setResult(r); setNow(new Date()); if (r.ok && r.data.extras) setTicked(r.data.extras.upgrades); } }, () => { if (live) setResult({ ok: false, reason: 'failed' }); });
    return () => { live = false; };
  }, [org, mode, attempt]);

  /** Reloads the records without blanking the screen. */
  const refresh = useCallback(() => loadExterior(org).then(r => { if (r.ok) { setResult(r); setNow(new Date()); } }), [org]);
  /** Runs one change, says what happened, and reloads on success. */
  const act = useCallback(async <T extends object>(work: () => Promise<Done<T>>, success: (r: T) => string) => {
    setBusy(true); setNotice('');
    try {
      const r = await work();
      if (!r.ok) { setNotice(r.message); return false; }
      setNotice(success(r as T)); await refresh(); return true;
    } catch { setNotice('That did not go through. Check your connection and try again.'); return false; }
    finally { setBusy(false); }
  }, [refresh]);

  function toggle(id: string, name: string) {
    const { next, removed } = toggleUpgrade(ticked, id);
    if (removed.length > 1 && !window.confirm(`Unticking "${name}" also unticks ${removed.length - 1} upgrade${removed.length === 2 ? '' : 's'} that depend on it. Continue?`)) return;
    const before = ticked;
    setTicked(next); setNotice('');
    saveUpgrades(org, next).then(() => setNotice('Saved.'), () => { setTicked(before); setNotice('That change did not save. Check your connection and try again.'); });
  }

  if (mode === 'preview') return <div className="planned"><h2>Shown in your live workspace</h2><p>These are real customer records from the Exterior Care system, so there is no sample version of this tab.</p></div>;
  if (!result || !now) return <div className="loading" aria-busy="true" />;
  if (!result.ok) return result.reason === 'no-access'
    ? <div className="planned"><h2>Members only</h2><p>These records hold customers&apos; names, phone numbers and addresses, so view-only access does not include them. Ask a founder for member access.</p></div>
    : <div className="planned" role="alert"><h2>The Exterior Care records did not load</h2><p>Nothing is shown rather than a partial list.</p><button className="primary" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>;

  const { data } = result;
  const source = <p className="quiet">The same records the original Exterior Care app uses. A change in either app shows in both.</p>;
  const common = { data, act, busy, readOnly, org, now };
  const status = <p className="notice" role="status" aria-live="polite">{notice}</p>;
  const editingMissing = !readOnly && !data.extras?.settings?.hasOwnProperty('businessName') && !data.extras?.settings?.hasOwnProperty('d2dSheetUrl');

  const pending = editingMissing && <p className="banner-inline" role="note">Viewing works now. Adding, editing, booking and syncing switch on after a founder runs one database update: supabase/pending/RUN-ME-exterior-care-editing.sql.</p>;

  if (tab === 'leads') return <>{pending}{status}<LeadsManager {...common} /></>;
  if (tab === 'bookings') return <>{pending}{status}<BookingsManager {...common} /></>;
  if (tab === 'conversations') return <>{status}<Conversations {...common} /></>;
  if (tab === 'activity') return <ActivityList data={data} />;
  if (tab === 'settings') return <>{status}<ExteriorSettings {...common} /></>;

  if (tab === 'jobs') {
    const j = summariseJobs(data.leads, iso => dayKey(new Date(iso)).slice(0, 7));
    const month = (key: string) => new Date(`${key}-15T12:00:00`).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const done = data.leads.filter(l => l.status === 'completed').sort((a, b) => jobDate(b).localeCompare(jobDate(a)));
    const goal = data.extras?.goal ?? null;
    const thisMonth = j.byMonth.find(m => m.label === dayKey(now).slice(0, 7))?.revenue ?? 0;
    return <>
      {goal !== null && (
        <section className="panel">
          <header className="panel-head"><h2>This month against the goal</h2><span className="quiet">{dollars(thisMonth)} of {dollars(goal)}</span></header>
          <progress className="upgrade-bar" value={Math.min(thisMonth, goal)} max={goal} aria-label={`${dollars(thisMonth)} paid of a ${dollars(goal)} monthly goal`} />
          <p className="quiet">{thisMonth >= goal ? 'Goal reached.' : `${dollars(goal - thisMonth)} to go. Counts jobs marked completed and paid this month.`} Change the goal in the Settings tab.</p>
        </section>
      )}
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
      <div className="pair">
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
                  <button type="button" className={`upgrade is-${s}`} aria-pressed={s === 'done'} disabled={readOnly || s === 'locked'} onClick={() => toggle(n.id, n.name)}>
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
      {!readOnly && <div className="formactions top"><button className="secondary" disabled={busy} onClick={() => act(() => syncDoorSheet(org), r => `Door-knocking sheet synced: ${r.sessions} sessions.`)}><RefreshCw size={15} aria-hidden="true" />Sync door-knocking sheet</button></div>}
      <div className="kpis">
        <div><span>Doors this week</span><strong><NumberFlow value={d.week.doors} /></strong><small className="quiet">{d.week.sessions} sessions since Monday</small></div>
        <div><span>Per door this week</span><strong>{d.week.perDoor === null ? '-' : dollars(Math.round(d.week.perDoor * 100) / 100)}</strong><small className="quiet">{dollars(d.week.jobTotal)} booked</small></div>
      </div>
      <div className="kpis">
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

  return null;
}
