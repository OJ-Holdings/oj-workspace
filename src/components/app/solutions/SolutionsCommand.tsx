'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { ArrowRight, Flame, Mail, PhoneIncoming } from 'lucide-react';
import { loadGhl } from '@/app/workspace/ghl-actions';
import { loadSolutionsConsultations } from '@/app/workspace/solutions-consultation-actions';
import { centralHour, dayCount, isRestDay, streakFor, todayKey, weekTotal } from '@/lib/dm-quests';
import { emailStats, engineStatus } from '@/lib/email-engine';
import { funnel, nextActions } from '@/lib/growth-summary';
import { summariseCalls } from '@/lib/ghl';
import { effectiveOutreachStatus } from '@/lib/outreach';
import { Gate, Pill, Ring } from './parts';
import type { GrowthStore } from './useGrowth';

type Inbound = { requested: number | null; confirmed: number | null; calls: { state: 'paused' | 'ok' | 'failed' | 'preview'; recent?: number; inbound?: number } };

/** The OJ Solutions front page: what to do now, and how the engine and the quest are going. */
export function SolutionsCommand({ g, base }: { g: GrowthStore; base: string }) {
  return <Gate g={g}>{data => <Command g={g} base={base} data={data} />}</Gate>;
}

function Command({ g, base, data }: { g: GrowthStore; base: string; data: NonNullable<GrowthStore['data']> }) {
  const [inbound, setInbound] = useState<Inbound>({ requested: null, confirmed: null, calls: { state: g.mode === 'preview' ? 'preview' : 'paused' } });
  useEffect(() => {
    if (g.mode !== 'live') return;
    let live = true;
    loadSolutionsConsultations(g.org).then(r => {
      if (live && r.ok) setInbound(i => ({ ...i, requested: r.entries.filter(e => e.status === 'requested').length, confirmed: r.entries.filter(e => e.status === 'confirmed').length }));
    }).catch(() => undefined);
    loadGhl(g.org).then(r => {
      if (!live) return;
      if (r.ok) { const s = summariseCalls(r.data.calls, new Date()); setInbound(i => ({ ...i, calls: { state: 'ok', recent: s.recent, inbound: s.inbound } })); }
      else setInbound(i => ({ ...i, calls: { state: r.reason === 'not-connected' ? 'paused' : 'failed' } }));
    }).catch(() => live && setInbound(i => ({ ...i, calls: { state: 'failed' } })));
    return () => { live = false; };
  }, [g.org, g.mode]);

  const now = g.now, today = todayKey(now), hour = centralHour(now);
  const f = funnel(data.prospects);
  const dm = data.dm;
  const players = dm ? data.members.filter(m => m.partner || m.userId === data.me.userId)
    .sort((a, b) => (a.userId === data.me.userId ? -1 : b.userId === data.me.userId ? 1 : a.name.localeCompare(b.name)))
    .map(m => ({ ...m, done: dayCount(dm.log, m.userId, today), week: weekTotal(dm.log, m.userId, today), streak: streakFor(dm.log, m.userId, dm.goal, today) })) : [];
  const mine = players.find(p => p.userId === data.me.userId);
  const email = data.email;
  const status = email ? engineStatus({ settings: email.settings, state: email.state, now }) : null;
  const stats = email ? emailStats(email.events, data.prospects, now, email.settings) : null;
  const weekReplies = email ? new Set(email.events.filter(e => e.kind === 'reply' && Date.parse(e.event_at) >= now.getTime() - 7 * 86_400_000).map(e => e.prospect_id)).size : null;
  const warm = data.prospects.filter(p => ['Replied', 'Demo Booked'].includes(effectiveOutreachStatus(p)));
  const actions = nextActions({
    goal: dm?.goal ?? 10, done: dm ? (mine?.done ?? 0) : 0, hour, replies: f.byStatus.Replied, consultationsRequested: inbound.requested ?? 0, sundayOff: isRestDay(today) || !dm,
    email: status ? { installed: true, running: status.running, label: status.label } : { installed: false, running: false, label: 'Not installed' },
  });
  const steps = [['Prospects', f.total], ['Contacted', f.contacted], ['Replied', f.replied], ['Demo booked', f.demos]] as const;
  const top = Math.max(f.total, 1);

  return <div className="gx-page">
    <header className="page-head gx-head"><div><h1>Growth command</h1><p>Outreach and client acquisition for OJ Solutions, built around email, DMs and warm follow-up. No cold calling.</p></div>
      <span className="quiet">{now.toLocaleDateString('en-US', { timeZone: 'America/Chicago', weekday: 'long', month: 'long', day: 'numeric' })}</span></header>

    <section className="gx-todo" aria-labelledby="gx-todo-title">
      <h2 id="gx-todo-title">Do this next</h2>
      {actions.length ? <ul>{actions.map(a => <li key={a.id} className={`is-${a.tone}`}><Link href={`${base}/b/solutions/${a.tab}`}><span>{a.text}</span><ArrowRight size={16} aria-hidden="true" /></Link></li>)}</ul>
        : <p className="gx-clear"><Flame size={16} aria-hidden="true" /> Nothing is waiting. The engine is working and today's quest is clear.</p>}
    </section>

    <div className="gx-grid">
      <section className="panel gx-span-7" aria-labelledby="gx-mission-title">
        <header className="panel-head"><h2 id="gx-mission-title">Today's quest</h2><Link className="panel-link" href={`${base}/b/solutions/dms`}>Open Daily {dm?.goal ?? 10}</Link></header>
        {dm ? <div className="gx-rings">{players.map(p => <div key={p.userId}>
          <Ring size={104} stroke={9} value={p.done} max={dm.goal} tone={p.done >= dm.goal ? 'good' : 'accent'} label={`${p.name}: ${p.done} of ${dm.goal} DMs today`} />
          <b>{p.name}</b><small className="quiet"><Flame size={12} aria-hidden="true" /> {p.streak.days} day streak · {p.week} this week</small></div>)}</div>
          : <p className="quiet">The Daily 10 needs its database update before DMs can be counted. Open it for the one step left.</p>}
      </section>

      <section className="panel gx-span-5" aria-labelledby="gx-email-title">
        <header className="panel-head"><h2 id="gx-email-title">Email engine</h2><Link className="panel-link" href={`${base}/b/solutions/email`}>Open</Link></header>
        {status && stats ? <>
          <Pill tone={status.tone}>{status.label}</Pill>
          <p className="gx-big"><NumberFlow value={stats.sentToday} /><small> sent today</small></p>
          <p className="quiet">{status.detail}</p>
          <dl className="gx-mini"><div><dt>Emailed</dt><dd>{stats.sentTotal}</dd></div><div><dt>Replied</dt><dd>{stats.replied}</dd></div><div><dt>Bounced</dt><dd>{stats.bounced}</dd></div></dl>
        </> : <><Pill tone="off">Not installed</Pill><p className="quiet">The email engine tables are not installed yet. Open it for the one step left.</p></>}
      </section>

      <section className="panel gx-span-7" aria-labelledby="gx-funnel-title">
        <header className="panel-head"><h2 id="gx-funnel-title">Pipeline</h2><Link className="panel-link" href={`${base}/b/solutions/outreach`}>All prospects</Link></header>
        {f.total ? <>
          <ol className="gx-funnel">{steps.map(([label, n]) => <li key={label}><span>{label}</span><i><b style={{ width: `${Math.max((n / top) * 100, n ? 2 : 0)}%` }} /></i><strong><NumberFlow value={n} /></strong></li>)}</ol>
          <p className="quiet">{f.replyRate === null ? 'Reply rate appears after the first contact.' : `${Math.round(f.replyRate * 100)}% of those contacted have replied`}{f.demoRate !== null && `, and ${Math.round(f.demoRate * 100)}% of repliers booked a demo`}. {f.byStatus['Not Sent']} not contacted yet.</p>
        </> : <div className="empty"><p><b>No prospects imported yet.</b> Add businesses to the Outreach sheet and the nightly import brings them here.</p></div>}
      </section>

      <section className="panel gx-span-5" aria-labelledby="gx-warm-title">
        <header className="panel-head"><h2 id="gx-warm-title">Warm leads</h2><Link className="panel-link" href={`${base}/b/solutions/warm`}>Open</Link></header>
        {warm.length ? <ul className="gx-warm-list">{warm.slice(0, 5).map(p => <li key={p.id}><b>{p.business_name}</b><span className="service-chip">{effectiveOutreachStatus(p)}</span></li>)}</ul>
          : <p className="quiet">Nobody has replied yet. Replies show up here the moment the engine sees them.</p>}
      </section>

      <section className="panel gx-span-7" aria-labelledby="gx-week-title">
        <header className="panel-head"><h2 id="gx-week-title">This week</h2></header>
        <dl className="gx-week">
          {dm && players.map(p => <div key={p.userId}><dt>{p.name}'s DMs</dt><dd><NumberFlow value={p.week} /></dd></div>)}
          {stats && <div><dt>Emails sent</dt><dd><NumberFlow value={stats.sentWeek} /></dd></div>}
          {weekReplies !== null && <div><dt>Email replies</dt><dd><NumberFlow value={weekReplies} /></dd></div>}
          <div><dt>Demos booked, total</dt><dd><NumberFlow value={f.demos} /></dd></div>
        </dl>
        <p className="quiet">Counts come from logged DMs, the email engine and outreach statuses. Nothing is estimated.</p>
      </section>

      <section className="panel gx-span-5" aria-labelledby="gx-inbound-title">
        <header className="panel-head"><h2 id="gx-inbound-title">Inbound</h2><Link className="panel-link" href={`${base}/b/solutions/consultations`}>Website requests</Link></header>
        {g.mode === 'preview' ? <p className="quiet">Inbound requests and calls show in the live workspace only.</p> : <ul className="gx-inbound">
          <li><Mail size={15} aria-hidden="true" /><span>Website consultation requests</span><b>{inbound.requested === null ? '-' : `${inbound.requested} waiting`}</b></li>
          <li><PhoneIncoming size={15} aria-hidden="true" /><span>AI line calls, 30 days</span><b>{inbound.calls.state === 'ok' ? inbound.calls.recent : inbound.calls.state === 'failed' ? 'Could not read' : 'Paused'}</b></li>
        </ul>}
        {g.mode === 'live' && inbound.calls.state === 'paused' && <p className="quiet">GoHighLevel is not connected, on purpose, until the first client signs. Calls will count here once it is.</p>}
      </section>
    </div>
  </div>;
}
