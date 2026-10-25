'use client';

import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { loadGhl } from '@/app/workspace/ghl-actions';
import { callLength, summariseCalls, summarisePipeline, type GhlResult } from '@/lib/ghl';
import { dollars } from '@/lib/metrics';

const usd = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } as const;
const day = (iso: string) => iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '-';
const words = (s: string) => s ? s.charAt(0).toUpperCase() + s.slice(1).toLowerCase().replace(/[_-]/g, ' ') : '-';

/** The Clients and Calls tabs of OJ Solutions, read live from GoHighLevel. */
export function GhlView({ tab, org, mode }: { tab: string; org: string; mode: 'preview' | 'live' }) {
  const [result, setResult] = useState<GhlResult | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (mode !== 'live') return;
    let live = true;
    setResult(null);
    loadGhl(org).then(r => { if (live) { setResult(r); setNow(new Date()); } }, () => { if (live) setResult({ ok: false, reason: 'failed' }); });
    return () => { live = false; };
  }, [org, mode, attempt]);

  if (mode === 'preview') return <div className="planned"><h2>Shown in your live workspace</h2><p>Clients and calls come straight from GoHighLevel, so there is no sample version of this tab.</p></div>;
  if (!result || !now) return <div className="loading" aria-busy="true" />;
  if (!result.ok) return result.reason === 'not-connected'
    ? <div className="planned"><h2>GoHighLevel is not connected</h2><p>Add the private integration token and the location ID to the host settings. The steps are in docs/CONNECTIONS.md.</p></div>
    : result.reason === 'no-access'
      ? <div className="planned"><h2>Members only</h2><p>This tab lists people by name, so view-only access does not include it. Ask a founder for member access.</p></div>
      : <div className="planned" role="alert"><h2>GoHighLevel did not answer</h2><p>Nothing is shown rather than out-of-date figures. Check that the OJ Workspace integration still exists in the sub-account.</p><button className="primary" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>;

  const { data } = result;
  const fetched = <p className="quiet">Read from GoHighLevel at {new Date(data.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. Refreshes every five minutes.</p>;

  if (tab === 'clients') {
    const p = summarisePipeline(data);
    const clients = data.contacts.filter(c => c.type === 'customer').length;
    return <>
      <div className="kpis">
        <div><span>Clients</span><strong><NumberFlow value={clients} /></strong><small className="quiet">Contacts marked as customers</small></div>
        <div><span>Prospects</span><strong><NumberFlow value={data.contacts.length - clients} /></strong></div>
        <div><span>Open deals</span><strong><NumberFlow value={p.openValue} format={usd} /></strong><small className="quiet">{p.openCount} in the pipeline</small></div>
        <div><span>Won</span><strong><NumberFlow value={p.wonValue} format={usd} /></strong><small className="quiet">{p.wonCount} deals. Deal value, not money received</small></div>
      </div>
      <section className="panel">
        <header className="panel-head"><h2>Upcoming 15-minute consultations</h2></header>
        {data.appointmentsConfigured
          ? data.appointments.length
            ? <div className="tablewrap"><table className="table">
                <thead><tr><th>Date & time (Central)</th><th>Consultation</th><th>Contact</th><th>Status</th></tr></thead>
                <tbody>{data.appointments.map(a => {
                  const c = data.contacts.find(c => c.id === a.contactId);
                  return <tr key={a.id}>
                    <td>{new Date(a.startsAt).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                    <td>{a.title}</td><td>{c?.name ?? (a.contactId ? 'Contact not in first 100' : 'Unlinked')}</td>
                    <td>{words(a.status)}</td>
                  </tr>;
                })}</tbody>
              </table></div>
            : <div className="empty"><p>No upcoming consultations in this calendar for the next 31 days.</p></div>
          : <div className="empty"><p>Consultation calendar not connected. Set <code>GHL_BOOKING_CALENDAR_ID</code> on the OJ Workspace server to show scheduled appointments here.</p></div>}
        {fetched}
      </section>
      <section className="panel">
        <header className="panel-head"><h2>Pipeline</h2></header>
        {data.opportunities.length ? <div className="tablewrap"><table className="table">
          <thead><tr><th>Stage</th><th className="num">Open deals</th><th className="num">Value</th></tr></thead>
          <tbody>{p.stages.map(s => <tr key={s.stage}><td>{s.stage}</td><td className="num">{s.count}</td><td className="num">{s.count ? dollars(s.value) : '-'}</td></tr>)}</tbody></table></div>
          : <div className="empty"><p><b>No deals in GoHighLevel yet.</b> Add an opportunity there and it appears here.</p></div>}
      </section>
      {data.opportunities.length > 0 && <section className="panel">
        <header className="panel-head"><h2>Deals</h2></header>
        <div className="tablewrap"><table className="table">
          <thead><tr><th>Deal</th><th>Client</th><th>Stage</th><th>Status</th><th className="num">Value</th><th>Updated</th></tr></thead>
          <tbody>{data.opportunities.map(o => <tr key={o.id}><td>{o.name}</td><td>{o.contact || '-'}</td><td>{o.stage}</td><td><span className="tag">{words(o.status)}</span></td><td className="num">{o.value === null ? '-' : dollars(o.value)}</td><td>{day(o.updated)}</td></tr>)}</tbody></table></div>
        {data.opportunitiesTotal > data.opportunities.length && <p className="quiet">Showing {data.opportunities.length} of {data.opportunitiesTotal} deals; totals above cover these only.</p>}
      </section>}
      <section className="panel">
        <header className="panel-head"><h2>Contacts</h2></header>
        {data.contacts.length ? <div className="tablewrap"><table className="table">
          <thead><tr><th>Name</th><th>Company</th><th>Type</th><th>Tags</th><th>Added</th></tr></thead>
          <tbody>{data.contacts.map(c => <tr key={c.id}><td>{c.name}</td><td>{c.company || '-'}</td><td>{c.type === 'customer' ? 'Client' : 'Prospect'}</td><td>{c.tags.join(', ') || '-'}</td><td>{day(c.added)}</td></tr>)}</tbody></table></div>
          : <div className="empty"><p><b>No contacts in GoHighLevel yet.</b></p></div>}
        {data.contactsTotal > data.contacts.length && <p className="quiet">Showing {data.contacts.length} of {data.contactsTotal} contacts; counts above cover these only.</p>}
        {fetched}
      </section>
    </>;
  }

  const s = summariseCalls(data.calls, now);
  return <>
    <div className="kpis">
      <div><span>Calls, last 30 days</span><strong><NumberFlow value={s.recent} /></strong></div>
      <div><span>Incoming</span><strong><NumberFlow value={s.inbound} /></strong></div>
      <div><span>Average length</span><strong>{callLength(s.averageSeconds)}</strong></div>
    </div>
    <section className="panel">
      <header className="panel-head"><h2>Recent calls</h2></header>
      {data.calls.length ? <div className="tablewrap"><table className="table">
        <thead><tr><th>When</th><th>Caller</th><th>Direction</th><th>Result</th><th className="num">Length</th></tr></thead>
        <tbody>{data.calls.slice(0, 100).map(c => <tr key={c.id}><td>{new Date(c.at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td><td>{c.contact}</td><td>{words(c.direction)}</td><td>{words(c.status)}</td><td className="num">{callLength(c.seconds)}</td></tr>)}</tbody></table></div>
        : <div className="empty"><p><b>No calls recorded in GoHighLevel yet.</b> When a receptionist handles a call in this sub-account, it appears here.</p></div>}
      {data.conversationsTotal > data.conversationsRead && <p className="quiet">Calls are read from the {data.conversationsRead} most recently active conversations of {data.conversationsTotal}.</p>}
      {fetched}
    </section>
  </>;
}
