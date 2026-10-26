'use client';

import { useState } from 'react';
import NumberFlow from '@number-flow/react';
import { Mail, Pause, Play, ShieldCheck } from 'lucide-react';
import { setEmailEngine } from '@/app/workspace/growth-actions';
import { ago, emailStats, engineStatus, warmupCap, type EmailEvent, type EngineSettings } from '@/lib/email-engine';
import { todayKey } from '@/lib/dm-quests';
import { Gate, InstallNote, Pill, Stat } from './parts';
import type { GrowthStore } from './useGrowth';

const kindLabel: Record<EmailEvent['kind'], string> = { reserved: 'Queued', sent: 'Sent', failed: 'Failed', reply: 'Replied', bounce: 'Bounced', stop: 'Asked to stop' };
const ramp = [[0, 5], [3, 10], [7, 15], [14, 20], [21, 25]] as const;

/** The automated email outreach: honest status, today's limits, results, and setup steps until it is running. */
export function EmailEngine({ g }: { g: GrowthStore }) {
  return <Gate g={g}>{data => data.email ? <Engine g={g} data={data} email={data.email} /> :
    <InstallNote title="Email engine" file="supabase/schemas/solutions-email-engine.sql" what="The email engine needs three small tables to record sends, replies and its check-ins." />}</Gate>;
}

type Data = NonNullable<GrowthStore['data']>;
function Engine({ g, data, email }: { g: GrowthStore; data: Data; email: NonNullable<Data['email']> }) {
  const { settings, state, events } = email;
  const status = engineStatus({ settings, state, now: g.now });
  const stats = emailStats(events, data.prospects, g.now, settings);
  const today = todayKey(g.now);
  const cap = warmupCap(state?.warmup_started_on ?? null, today, settings.daily_cap_max);
  const day = state?.warmup_started_on ? Math.max(Math.round((Date.parse(today) - Date.parse(state.warmup_started_on)) / 86_400_000), 0) : 0;
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [capDraft, setCapDraft] = useState(String(settings.daily_cap_max));
  const names = new Map(data.prospects.map(p => [p.id, p.business_name]));
  const maxBar = Math.max(...stats.series.map(s => s.count), 1);
  const recent = events.filter(e => e.kind !== 'reserved').slice(0, 20);
  const blocked = !g.readOnly && g.mode === 'live';

  async function save(next: Partial<{ enabled: boolean; dailyCapMax: number; niche: string }>) {
    if (g.mode === 'preview') { setNotice('Settings cannot be changed in the preview.'); return; }
    setSaving(true); setNotice('');
    try {
      await setEmailEngine(g.org, { enabled: next.enabled ?? settings.enabled, dailyCapMax: next.dailyCapMax ?? settings.daily_cap_max, niche: next.niche ?? settings.niche_filter ?? '' });
      g.reload(); setNotice('Saved. The sender picks this up on its next check, within 10 minutes.');
    } catch (e) { setNotice(e instanceof Error ? e.message : 'Could not save.'); }
    finally { setSaving(false); }
  }
  const niche: EngineSettings['niche_filter'] = settings.niche_filter;

  return <div className="gx-page">
    <header className="page-head gx-head"><div><h1>Email engine</h1><p>Automated cold email from your own Gmail. No approval step: it follows the rules below and stops itself if something looks wrong.</p></div></header>

    <section className={`gx-engine is-${status.tone}`} aria-labelledby="gx-engine-title">
      <div className="gx-engine-main">
        <Pill tone={status.tone}>{status.label}</Pill>
        <h2 id="gx-engine-title">{status.running ? `${stats.sentToday} of ${cap} sent today` : status.label}</h2>
        <p>{status.detail}</p>
        <small className="quiet">{state ? `Last check-in ${ago((g.now.getTime() - Date.parse(state.last_heartbeat_at)) / 60_000)}${state.sender_domain ? ` · sending from ${state.sender_domain}` : ''}` : 'No check-in yet'}</small>
      </div>
      <div className="gx-engine-controls">
        <button className={settings.enabled ? 'secondary' : 'primary'} disabled={saving || !blocked} onClick={() => save({ enabled: !settings.enabled })}>
          {settings.enabled ? <><Pause size={15} aria-hidden="true" />Pause sending</> : <><Play size={15} aria-hidden="true" />Resume sending</>}</button>
        <label>Daily ceiling<select value={capDraft} disabled={saving || !blocked} onChange={e => { setCapDraft(e.target.value); void save({ dailyCapMax: Number(e.target.value) }); }}>
          {[10, 15, 20, 25, 30, 40].map(n => <option key={n} value={n}>{n} a day</option>)}</select></label>
        <label>Who to email<select value={niche ?? ''} disabled={saving || !blocked} onChange={e => void save({ niche: e.target.value })}>
          <option value="">Everyone with a good draft</option><option value="exterior">Exterior cleaning first and only</option></select></label>
      </div>
    </section>
    <p role="status" className="gx-notice">{notice}</p>

    <div className="gx-stats">
      <Stat label="Sent today" value={stats.sentToday} note={`limit ${cap}`} />
      <Stat label="Emailed, all time" value={stats.sentTotal} note={`${stats.sentWeek} this week`} />
      <Stat label="Replied" value={stats.replied} note={stats.replyRate === null ? 'No sends yet' : <><NumberFlow value={stats.replyRate} format={{ style: 'percent', maximumFractionDigits: 0 }} /> of those emailed</>} />
      <Stat label="Demos booked" value={stats.demos} note="From emailed prospects" />
      <Stat label="Bounced" value={stats.bounced} note={stats.bounceRate === null ? '' : `${Math.round(stats.bounceRate * 100)}% of sends`} />
      <Stat label="Asked to stop" value={stats.stopped} note="Never emailed again" />
    </div>

    <div className="gx-columns">
      <section className="panel" aria-labelledby="gx-bars-title">
        <header className="panel-head"><h2 id="gx-bars-title">Last 14 days</h2><span className="quiet">Emails sent per day</span></header>
        <div className="gx-bars" role="img" aria-label={`Emails sent per day over the last 14 days: ${stats.series.map(s => `${s.day} ${s.count}`).join(', ')}`}>
          {stats.series.map(s => <div key={s.day} title={`${s.day}: ${s.count}`}><i style={{ height: `${(s.count / maxBar) * 100}%` }} className={s.day === today ? 'is-today' : ''} /><small>{s.day.slice(8)}</small></div>)}
        </div>
        <h3 className="gx-sub">Recent activity</h3>
        {recent.length ? <div className="tablewrap"><table className="table"><thead><tr><th>When</th><th>Business</th><th>What happened</th></tr></thead>
          <tbody>{recent.map((e, i) => <tr key={`${e.prospect_id}-${e.kind}-${i}`}><td>{new Date(e.event_at).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td><td>{names.get(e.prospect_id) ?? 'Unknown business'}</td><td><span className={`gx-event is-${e.kind}`}>{kindLabel[e.kind]}</span></td></tr>)}</tbody></table></div>
          : <div className="empty"><p><b>No emails yet.</b> {status.running ? 'The first batch goes out in the next send window.' : 'Finish setup and the first batch goes out on its own.'}</p></div>}
      </section>

      <aside className="gx-side">
        <section className="panel" aria-labelledby="gx-warm-title">
          <header className="panel-head"><h2 id="gx-warm-title">Warm-up</h2><span className="quiet">{state?.warmup_started_on ? `Day ${day + 1}` : 'Starts with the first send'}</span></header>
          <p className="quiet">A new sender earns trust slowly. The daily limit climbs on its own, up to your ceiling.</p>
          <ol className="gx-ramp">{ramp.map(([from, n], i) => { const next = ramp[i + 1]?.[0] ?? Infinity; const on = state?.warmup_started_on ? day >= from && day < next : i === 0; return <li key={from} className={on ? 'is-on' : ''}><b>{n}</b><span>{from === 0 ? 'Days 1-3' : from === 21 ? 'Day 22+' : `Days ${from + 1}-${next}`}</span></li>; })}</ol>
        </section>
        <section className="panel" aria-labelledby="gx-queue-title">
          <header className="panel-head"><h2 id="gx-queue-title">Ready to send</h2></header>
          <p className="gx-big"><NumberFlow value={stats.ready} /></p>
          <ul className="gx-skips">
            <li><span>No usable email address</span><b>{stats.skips.notEmailable}</b></li>
            <li><span>Draft failed the quality check</span><b>{stats.skips.badDraft}</b></li>
            <li><span>Already emailed, answered or removed</span><b>{stats.skips.alreadyHandled}</b></li>
            {niche && <li><span>Outside the niche you picked</span><b>{stats.skips.offNiche}</b></li>}
          </ul>
          {stats.stuck > 0 && <p className="outreach-error" role="status">{stats.stuck} {stats.stuck === 1 ? 'email was' : 'emails were'} claimed but never confirmed. Check Gmail Sent. They will not be sent twice.</p>}
        </section>
        <section className="panel" aria-labelledby="gx-rules-title">
          <header className="panel-head"><h2 id="gx-rules-title"><ShieldCheck size={16} aria-hidden="true" /> What it does by itself</h2></header>
          <ul className="gx-rules">
            <li>Sends Monday to Saturday, 9:00 AM to 4:30 PM Central, a few at a time with gaps.</li>
            <li>Skips any draft with placeholders, spam phrases, shouting or broken links.</li>
            <li>Adds your name, company, mailing address and a one-word opt-out to every email.</li>
            <li>Anyone who replies "stop" is marked Not Interested and never emailed again.</li>
            <li>Stops itself if bounces climb past 8%, to protect your sender reputation.</li>
            <li>Never emails someone this Gmail account has already written to.</li>
          </ul>
        </section>
      </aside>
    </div>

    {!status.running && <Setup g={g} hasState={!!state} />}
  </div>;
}

function Setup({ g, hasState }: { g: GrowthStore; hasState: boolean }) {
  return <section className="panel gx-setup" aria-labelledby="gx-setup-title">
    <header className="panel-head"><h2 id="gx-setup-title"><Mail size={16} aria-hidden="true" /> {hasState ? 'Get it running again' : 'Switch it on: three steps'}</h2></header>
    <ol>
      <li><b>Server settings (Netlify).</b> Add <code>OJ_EMAIL_POSTAL_ADDRESS</code> (the mailing address printed on every email, required by law). Optional: <code>OJ_EMAIL_COMPANY</code>. The existing sync token and organization id are reused.</li>
      <li><b>Paste the sender into Apps Script.</b> Open the Outreach spreadsheet, Extensions, Apps Script, add <code>scripts/google-apps-script/outreach-email-engine.gs</code>, and set the script properties <code>SENDER_NAME</code> and <code>NAG_EMAILS</code>.</li>
      <li><b>Run two functions once.</b> <code>previewNextEmails</code> shows the next emails without sending anything. Then <code>installEngineTriggers</code> turns it on. This page changes to Running by itself after the first check-in.</li>
    </ol>
    <p className="quiet">The full walkthrough, including the separate sending domain we recommend, is in <code>docs/SOLUTIONS_GROWTH_ENGINE.md</code>. {g.mode === 'preview' ? '' : 'Until the first check-in this page says Not started, never Running.'}</p>
  </section>;
}
