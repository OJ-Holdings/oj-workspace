'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { loadExterior, setLeadStatus } from '@/app/workspace/exterior-actions';
import { sampleExterior } from '@/lib/exterior-sample';
import { sourceLabel, summariseJobs, type Done, type ExteriorData, type ExtLead } from '@/lib/exterior';
import { coldQuotes, pipeline, waitingLeads } from '@/lib/growth-queues';
import { isRealPhone } from '@/lib/exterior-ops';
import { dollars } from '@/lib/metrics';
import { dayKey } from '@/lib/dashboard';
import type { DashboardStore } from './useDashboard';
import { LsaCard } from './LsaCard';
import { RebookList } from './RebookList';
import { MessageDrafts } from './MessageDrafts';
import { messageDrafts, type Draft } from '@/lib/message-drafts';

const ago = (minutes: number) => minutes < 60 ? `${minutes} min` : minutes < 1440 ? `${Math.round(minutes / 60)} h` : `${Math.floor(minutes / 1440)} d`;

/** Growth: answer new leads fast, chase quotes going cold, see which sources pay, and line up the repeat customers. */
export function GrowthView({ org, mode, store, readOnly, base, displayName = '' }: { org: string; mode: 'preview' | 'live'; store: DashboardStore; readOnly: boolean; base: string; displayName?: string }) {
  const [data, setData] = useState<ExteriorData | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  const refresh = useCallback(async () => {
    if (mode === 'preview') { const t = new Date(); setData(sampleExterior(t)); setNow(t); return; }
    try { const r = await loadExterior(org); if (r.ok) { setData(r.data); setNow(new Date()); setFailed(false); } else setFailed(true); } catch { setFailed(true); }
  }, [org, mode]);
  useEffect(() => { void refresh(); }, [refresh]);

  const act = async (work: () => Promise<Done>, done: string) => {
    if (mode === 'preview') { setNotice('Sample workspace: nothing was saved.'); return; }
    setBusy(true); setNotice('');
    try { const r = await work(); setNotice(r.ok ? done : r.message); if (r.ok) await refresh(); } catch { setNotice('That did not go through. Try again.'); } finally { setBusy(false); }
  };

  if (failed) return <div className="planned" role="alert"><h2>Growth did not load</h2><button className="primary" onClick={() => { setFailed(false); void refresh(); }}>Try again</button></div>;
  if (!data || !now) return <div className="loading" aria-busy="true" />;

  const exterior = `${base}/b/exterior`;
  const waiting = waitingLeads(data.leads, now.getTime());
  const cold = coldQuotes(data.leads, now.getTime());
  const pipe = pipeline(data.leads);
  const drafts = messageDrafts(data, dayKey(now), now.getTime(), displayName.trim().split(/\s+/)[0] ?? '');
  // Marking a new-lead or quote message done also moves the lead along, so it leaves the queue everywhere.
  const doneDraft = (d: Draft) => { if (d.kind === 'new-lead') void act(() => setLeadStatus(org, d.lead.id, 'contacted'), `${d.lead.name ?? 'Lead'} marked contacted.`); else if (d.kind === 'quote') void act(() => setLeadStatus(org, d.lead.id, 'following_up'), `${d.lead.name ?? 'Lead'} marked followed up.`); };
  const sources = summariseJobs(data.leads, iso => iso.slice(0, 7)).bySource.slice(0, 8);
  const contact = (l: ExtLead) => <>
    {l.phone && isRealPhone(l.phone) && <a className="secondary small" href={`tel:${l.phone}`}>Call</a>}
    <Link className="secondary small" href={`${exterior}/customer?lead=${encodeURIComponent(l.id)}`}>Open</Link>
  </>;

  return <>
    <p className="notice" role="status" aria-live="polite">{notice}</p>
    <div className="kpis">
      <div><span>Waiting for a reply</span><strong>{waiting.length}</strong><small className={waiting.some(w => w.late) ? 'neg' : 'quiet'}>{waiting.filter(w => w.late).length} late</small></div>
      <div><span>Quotes out</span><strong>{dollars(pipe.contacted.quoted + pipe.following_up.quoted)}</strong><small className="quiet">{cold.length} going cold</small></div>
      <div><span>Booked</span><strong>{pipe.booked.count}</strong><small className="quiet">{dollars(pipe.booked.quoted)} quoted</small></div>
    </div>

    <section className="panel">
      <header className="panel-head"><h2>Answer these now</h2><span className="quiet">{waiting.length} new</span></header>
      {waiting.length ? <ul className="growth-list">{waiting.slice(0, 12).map(({ lead: l, minutes, late }) => <li key={l.id}>
        <div><b>{l.name || 'New lead'}</b><span>{[l.service_requested, l.quote_amount ? dollars(l.quote_amount) : '', sourceLabel(l.source)].filter(Boolean).join(', ')}</span></div>
        <span className={`growth-age${late ? ' is-late' : ''}`}>{ago(minutes)}</span>
        <div className="growth-actions">{contact(l)}{!readOnly && <button type="button" className="primary small" disabled={busy} onClick={() => void act(() => setLeadStatus(org, l.id, 'contacted'), `${l.name ?? 'Lead'} marked contacted.`)}>Mark contacted</button>}</div>
      </li>)}</ul> : <div className="empty"><p><b>Everyone has had a reply.</b></p></div>}
    </section>

    <section className="panel">
      <header className="panel-head"><h2>Quotes going cold</h2><span className="quiet">no contact in 3+ days</span></header>
      {cold.length ? <ul className="growth-list">{cold.slice(0, 12).map(({ lead: l, days, step, big }) => <li key={l.id}>
        <div><b>{l.name || 'Customer'}{big && <em className="growth-big">Big quote</em>}</b><span>{[l.service_requested, dollars(l.quote_amount ?? 0), step].filter(Boolean).join(', ')}</span></div>
        <span className={`growth-age${days >= 7 ? ' is-late' : ''}`}>{days} d</span>
        <div className="growth-actions">{contact(l)}{!readOnly && <button type="button" className="secondary small" disabled={busy} onClick={() => void act(() => setLeadStatus(org, l.id, 'following_up'), `${l.name ?? 'Lead'} marked followed up.`)}>Followed up</button>}</div>
      </li>)}</ul> : <div className="empty"><p><b>No quote has gone quiet.</b></p></div>}
    </section>

    <MessageDrafts drafts={drafts} readOnly={readOnly || mode === 'preview'} onDone={doneDraft} />

    <LsaCard store={store} leads={data.leads} today={dayKey(now)} readOnly={readOnly || mode === 'preview'} parent={exterior} />

    <section className="panel">
      <header className="panel-head"><h2>Where leads come from</h2><Link className="secondary small" href={`${exterior}/leads`}>Tag sources</Link></header>
      <div className="tablewrap"><table className="table">
        <thead><tr><th>Source</th><th className="num">Leads</th><th className="num">Won</th><th className="num">Win rate</th><th className="num">Revenue</th></tr></thead>
        <tbody>{sources.map(s => <tr key={s.source}><td>{s.source}</td><td className="num">{s.leads}</td><td className="num">{s.won}</td><td className="num">{Math.round(s.rate * 100)}%</td><td className="num">{s.revenue === null ? '-' : dollars(s.revenue)}</td></tr>)}</tbody>
      </table></div>
    </section>

    <RebookList leads={data.leads} now={now} />
  </>;
}
