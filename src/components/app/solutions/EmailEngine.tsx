'use client';

import Link from 'next/link';
import { useState } from 'react';
import NumberFlow from '@number-flow/react';
import { Mail, Pause, Play, ShieldCheck } from 'lucide-react';
import { setEmailEngine } from '@/app/workspace/growth-actions';
import { updateOutreachStatus } from '@/app/workspace/outreach-actions';
import { ago, emailStats, engineStatus, nextUp, replyInbox, replyToneLabel, sentMail, warmupCap, type EmailEvent, type EngineSettings } from '@/lib/email-engine';
import { todayKey } from '@/lib/dm-quests';
import { Gate, InstallNote, Pill, Stat } from './parts';
import type { GrowthStore } from './useGrowth';

const kindLabel: Record<EmailEvent['kind'], string> = { reserved: 'Queued', sent: 'Sent', failed: 'Failed', reply: 'Replied', bounce: 'Bounced', stop: 'Asked to stop' };
const ramp = [[0, 5], [3, 10], [7, 15], [14, 20], [21, 25]] as const;

/** The automated email outreach: honest status, today's limits, results, and setup steps until it is running. */
export function EmailEngine({ g, base }: { g: GrowthStore; base: string }) {
  return <Gate g={g}>{data => data.email ? <Engine g={g} base={base} data={data} email={data.email} /> :
    <InstallNote title="Email engine" file="supabase/schemas/solutions-email-engine.sql" what="The email engine needs three small tables to record sends, replies and its check-ins." />}</Gate>;
}

type Data = NonNullable<GrowthStore['data']>;
function Engine({ g, base, data, email }: { g: GrowthStore; base: string; data: Data; email: NonNullable<Data['email']> }) {
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
  const inbox = replyInbox(events, data.prospects, 12);
  const sentList = sentMail(events, data.prospects, 15);
  const upcoming = nextUp(data.prospects, events, settings, 5);
  const [skipping, setSkipping] = useState<string | null>(null);
  const when = (iso: string) => new Date(iso).toLocaleString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  /** A veto, not an approval: the engine already follows its rules. Skipping marks the prospect Dead so it is never emailed. */
  async function skip(id: string, name: string) {
    if (!blocked || skipping) return;
    setSkipping(id); setNotice('');
    try { await updateOutreachStatus(g.org, id, 'Dead'); setNotice(`${name} skipped. It will not be emailed.`); g.reload(); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not skip.'); }
    finally { setSkipping(null); }
  }

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


    <section className="panel gx-inbox" aria-labelledby="gx-inbox-title">
      <header className="panel-head"><h2 id="gx-inbox-title">Replies</h2><span className="quiet">{inbox.length ? `${inbox.length} most recent` : 'None yet'}</span></header>
      {inbox.length ? <ul className="gx-replies">{inbox.map((r, i) => <li key={`${r.prospect_id}-${r.at}-${i}`} className={`is-${r.tone}`}>
        <div><h3>{r.business}</h3><span className={`gx-tone is-${r.tone}`}>{replyToneLabel[r.tone]}</span><small className="quiet">{when(r.at)}</small></div>
        <p>{r.text || 'The reply text was not kept for this one. Open Gmail to read it.'}</p>
        <Link className="secondary" href={`${base}/b/solutions/warm`}>{r.status === 'Replied' || r.status === 'Demo Booked' ? 'Open in Warm leads' : r.status}</Link>
      </li>)}</ul>
        : <div className="empty"><p><b>No replies yet.</b> When someone answers, the first lines of their reply show up here with a guess at what they meant. Anyone who sounds interested goes to Warm leads for a call.</p></div>}
    </section>

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

        <h3 className="gx-sub">What went out</h3>
        {sentList.length ? <ul className="gx-sentmail">{sentList.map((m, i) => <li key={`${m.prospect_id}-${i}`}><details>
          <summary><b>{m.business}</b><span>{m.subject ?? 'Subject not recorded'}</span><small className="quiet">{when(m.at)}</small></summary>
          <p className="quiet">To {m.to ?? 'unknown'}. The footer with your name, address and opt-out is added when it is sent.</p>
          <pre>{m.body ?? 'The draft is no longer on this prospect.'}</pre>
        </details></li>)}</ul> : <p className="quiet">Nothing sent yet. Each email shows here exactly as drafted.</p>}
      </section>

      <aside className="gx-side">
        <section className="panel" aria-labelledby="gx-warm-title">
          <header className="panel-head"><h2 id="gx-warm-title">Warm-up</h2><span className="quiet">{state?.warmup_started_on ? `Day ${day + 1}` : 'Starts with the first send'}</span></header>
          <p className="quiet">A new sender earns trust slowly. The daily limit climbs on its own, up to your ceiling.</p>
          <ol className="gx-ramp">{ramp.map(([from, n], i) => { const next = ramp[i + 1]?.[0] ?? Infinity; const on = state?.warmup_started_on ? day >= from && day < next : i === 0; return <li key={from} className={on ? 'is-on' : ''}><b>{n}</b><span>{from === 0 ? 'Days 1-3' : from === 21 ? 'Day 22+' : `Days ${from + 1}-${next}`}</span></li>; })}</ol>
        </section>
        <section className="panel" aria-labelledby="gx-next-title">
          <header className="panel-head"><h2 id="gx-next-title">Next up</h2><span className="quiet">You can veto, nothing needs approval</span></header>
          {upcoming.length ? <ul className="gx-nextup">{upcoming.map(p => <li key={p.id}>
            <details><summary><b>{p.business_name}</b><span>{p.email_subject}</span></summary><pre>{p.email_body}</pre></details>
            <button className="secondary" disabled={!blocked || skipping === p.id} onClick={() => void skip(p.id, p.business_name)} title="Marks this prospect Dead so it is never emailed">Skip</button>
          </li>)}</ul> : <p className="quiet">Nobody is lined up. Add prospects with an email address.</p>}
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
      <li><b>Server settings.</b> On the host (the <code>.env.local</code> file, or Netlify settings) add <code>OJ_EMAIL_POSTAL_ADDRESS</code> (the mailing address printed on every email, required by law), <code>OJ_EMAIL_COMPANY</code>, <code>OJ_WORKSPACE_URL</code>, <code>OJ_OUTREACH_SYNC_TOKEN</code>, <code>OJ_OUTREACH_ORGANIZATION_ID</code> and <code>OJ_SUPABASE_SERVICE_ROLE_KEY</code>, then restart the app. Keys stay on the host. Never paste them anywhere else.</li>
      <li><b>Put the sender in Apps Script.</b> Create a standalone project at script.google.com while signed in as the mailbox that will send (for example a mailbox on your own domain). Paste <code>scripts/google-apps-script/outreach-email-engine.gs</code> and set the script properties <code>OUTREACH_SYNC_TOKEN</code>, <code>SENDER_NAME</code>, <code>NAG_EMAILS</code> and <code>ENGINE_URL</code> (your public address ending in <code>/api/outreach-email-engine</code>). Set the project time zone to America/Chicago.</li>
      <li><b>Run two functions once.</b> <code>previewNextEmails</code> shows the next emails without sending anything. Then <code>installEngineTriggers</code> turns it on. This page changes to Running by itself after the first check-in.</li>
    </ol>
    <p className="quiet">Send from a mailbox on your own domain with SPF, DKIM and DMARC set up. The full walkthrough is in <code>docs/SOLUTIONS_GROWTH_ENGINE.md</code>. {g.mode === 'preview' ? '' : 'Until the first check-in this page says Not started, never Running.'}</p>
  </section>;
}
