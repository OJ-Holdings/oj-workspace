'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { Check, Copy, ExternalLink, Flame, Pencil, SkipForward, Trophy, Undo2 } from 'lucide-react';
import { setDmGoal } from '@/app/workspace/growth-actions';
import {
  centralHour, dayCount, dmChannels, dmTargets, GOAL_BONUS_XP, lastSevenDays, levelFor, questLine, streakFor, teamStreak, todayKey, weekTotal, XP_PER_DM, xpFor,
  type DmChannel,
} from '@/lib/dm-quests';
import { Gate, InstallNote, Ring } from './parts';
import type { GrowthStore } from './useGrowth';

const fallbackDm = 'Hey! I run a pressure washing company here in Kenosha and kept missing calls while I was on jobs, so I built an AI receptionist that answers, takes the details and texts me. Want to hear it? I can send you a number to call.';
const channelLabel: Record<DmChannel, string> = { instagram: 'Instagram', facebook: 'Facebook', linkedin: 'LinkedIn', other: 'Somewhere else' };

/** The Daily 10: each partner's DM quest, the next target to message, and the score. */
export function DailyTen({ g }: { g: GrowthStore }) {
  return <Gate g={g}>{data => data.dm ? <Quest g={g} data={data} dm={data.dm} /> :
    <InstallNote title="Daily 10" file="supabase/schemas/solutions-dm-quests.sql" what="The Daily 10 needs the DM log table so every DM you send is counted for both of you." />}</Gate>;
}

type Data = NonNullable<GrowthStore['data']>;
function Quest({ g, data, dm }: { g: GrowthStore; data: Data; dm: NonNullable<Data['dm']> }) {
  const today = todayKey(g.now), hour = centralHour(g.now);
  const goal = dm.goal, me = data.me;
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [manual, setManual] = useState<DmChannel>('instagram');
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalDraft, setGoalDraft] = useState(String(goal));
  const wasDone = useRef<boolean | null>(null);

  const players = useMemo(() => {
    const list = data.members.filter(m => m.partner || m.userId === me.userId);
    return list.sort((a, b) => (a.userId === me.userId ? -1 : b.userId === me.userId ? 1 : a.name.localeCompare(b.name)));
  }, [data.members, me.userId]);
  const cards = players.map(p => {
    const done = dayCount(dm.log, p.userId, today), xp = xpFor(dm.log, p.userId, goal);
    return { ...p, done, streak: streakFor(dm.log, p.userId, goal, today), xp, level: levelFor(xp), week: weekTotal(dm.log, p.userId, today), strip: lastSevenDays(dm.log, p.userId, goal, today) };
  });
  const mine = cards.find(c => c.userId === me.userId);
  const done = mine?.done ?? 0;
  const line = questLine(done, goal, hour);
  const duo = teamStreak(dm.log, players.map(p => p.userId), goal, today);

  const myToday = new Set(dm.log.filter(e => !e.undone_at && e.actor_id === me.userId && e.work_day === today && e.prospect_id).map(e => e.prospect_id!));
  const queue = dmTargets(data.prospects, me.partner, myToday).filter(t => !skipped.has(t.prospect.id));
  const target = queue[0];
  const lastMine = dm.log.filter(e => !e.undone_at && e.actor_id === me.userId && !e.id.startsWith('pending-'))
    .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const undoable = lastMine && g.now.getTime() - Date.parse(lastMine.created_at) < 15 * 60_000 ? lastMine : null;
  const names = new Map(data.prospects.map(p => [p.id, p.business_name]));

  useEffect(() => {
    if (wasDone.current === false && done >= goal) { setCelebrate(true); const t = window.setTimeout(() => setCelebrate(false), 4200); return () => window.clearTimeout(t); }
    wasDone.current = done >= goal;
  }, [done, goal]);
  useEffect(() => { wasDone.current = done >= goal; }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(prospectId: string | null, channel: DmChannel) {
    if (busy) return;
    setBusy(true); setNotice('');
    const error = await g.log(prospectId, channel);
    setBusy(false);
    setNotice(error || `+${XP_PER_DM} XP. ${done + 1 >= goal ? 'Quest clear.' : `${Math.max(goal - done - 1, 0)} to go.`}`);
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setCopied(true); window.setTimeout(() => setCopied(false), 1800); }
    catch { setNotice('Copy is blocked here. Select the message and copy it by hand.'); }
  }
  async function saveGoal() {
    const n = Number(goalDraft);
    if (g.mode === 'preview') { setNotice('Goals cannot be changed in the preview.'); return; }
    try { await setDmGoal(g.org, n); setEditingGoal(false); g.reload(); setNotice(`Daily goal is now ${n} for both of you.`); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Could not change the goal.'); }
  }

  return <div className="gx-page">
    <header className="page-head gx-head">
      <div><h1>Daily {goal}</h1><p>{goal} DMs each, every day. Every one is logged, scored and visible to both of you.</p></div>
      <div className="gx-head-meta">
        {duo > 0 && <span className="gx-chip is-hot"><Trophy size={14} aria-hidden="true" />Duo streak {duo} {duo === 1 ? 'day' : 'days'}</span>}
        {!g.readOnly && (editingGoal
          ? <form className="gx-goal" onSubmit={e => { e.preventDefault(); void saveGoal(); }}><label>Daily goal<input type="number" min={1} max={50} value={goalDraft} onChange={e => setGoalDraft(e.target.value)} /></label><button className="primary" type="submit">Save</button><button className="secondary" type="button" onClick={() => setEditingGoal(false)}>Cancel</button></form>
          : <button className="secondary" onClick={() => { setGoalDraft(String(goal)); setEditingGoal(true); }}><Pencil size={14} aria-hidden="true" />Goal: {goal}</button>)}
      </div>
    </header>

    <div className="gx-players">
      {cards.map(c => {
        const you = c.userId === me.userId;
        const cleared = c.done >= goal;
        return <article key={c.userId} className={`gx-player${you ? ' is-you' : ''}${cleared ? ' is-clear' : ''}`} aria-label={`${c.name}${you ? ', you' : ''}`}>
          <div className="gx-player-top">
            <Ring value={c.done} max={goal} tone={cleared ? 'good' : 'accent'} label={`${c.name}: ${c.done} of ${goal} DMs today`} />
            <div className="gx-player-info">
              <h2>{c.name}{you && <small> (you)</small>}</h2>
              <span className="gx-level">Level {c.level.level} · {c.level.title}</span>
              <div className="gx-xp" role="img" aria-label={`${c.level.into} of ${c.level.span} XP to the next level`}><i style={{ width: `${c.level.pct}%` }} /></div>
              <small className="quiet"><NumberFlow value={c.xp} /> XP · {c.week} DMs this week</small>
            </div>
          </div>
          <div className="gx-streak">
            <span className={c.streak.days > 0 ? 'is-hot' : ''}><Flame size={16} aria-hidden="true" />{c.streak.days} day streak{c.streak.atRisk ? ' · at risk today' : ''}</span>
            <span className="gx-strip" role="img" aria-label="Last seven days">{c.strip.map(d => <i key={d.day} className={d.rest ? 'is-rest' : d.goalMet ? 'is-met' : d.count > 0 ? 'is-part' : ''} title={`${d.day}: ${d.count}`} style={{ height: `${Math.max(Math.min(d.count / goal, 1), 0.12) * 100}%` }} />)}</span>
          </div>
        </article>;
      })}
    </div>

    <section className={`gx-mission is-${line.tone}`} aria-live="polite">
      {celebrate && <div className="gx-burst" aria-hidden="true">{Array.from({ length: 14 }, (_, i) => <span key={i} style={{ '--i': i } as React.CSSProperties} />)}</div>}
      <div><h2>{celebrate ? `Quest clear! +${GOAL_BONUS_XP} XP` : line.headline}</h2><p>{line.sub}</p></div>
      {undoable && !g.readOnly && <button className="secondary" disabled={busy} onClick={async () => { setBusy(true); const e = await g.undo(undoable.id); setBusy(false); setNotice(e || `Undid the last DM${undoable.prospect_id && names.get(undoable.prospect_id) ? ` (${names.get(undoable.prospect_id)})` : ''}.`); }}><Undo2 size={14} aria-hidden="true" />Undo last</button>}
    </section>
    <p role="status" className="gx-notice">{notice}</p>

    <div className="gx-columns">
      <section className="panel gx-target" aria-labelledby="gx-target-title">
        <header className="panel-head"><h2 id="gx-target-title">Your next DM</h2>{queue.length > 0 && <span className="quiet">{queue.length} ready</span>}</header>
        {target ? <>
          <div className="gx-target-who">
            <div><h3>{target.prospect.business_name}</h3>
              <p className="quiet">{[target.prospect.decision_maker, target.prospect.industry, target.prospect.city_state].filter(Boolean).join(' · ') || 'Details not recorded'}</p></div>
            <div className="gx-target-tags">{target.exterior && <span className="gx-chip">Exterior cleaning</span>}{target.mine && <span className="gx-chip">Your list</span>}</div>
          </div>
          {target.prospect.leak && <p className="gx-leak"><b>Why them:</b> {target.prospect.leak}</p>}
          <label className="gx-draft"><span>Message {target.prospect.dm ? '(from the research sheet)' : '(starter)'}</span>
            <textarea readOnly rows={5} value={target.prospect.dm || fallbackDm} onFocus={e => e.currentTarget.select()} /></label>
          <div className="gx-actions">
            <button className="secondary" onClick={() => copy(target.prospect.dm || fallbackDm)}>{copied ? <Check size={15} aria-hidden="true" /> : <Copy size={15} aria-hidden="true" />}{copied ? 'Copied' : 'Copy message'}</button>
            <a className="secondary" href={target.url} target="_blank" rel="noreferrer noopener"><ExternalLink size={15} aria-hidden="true" />Open {channelLabel[target.channel]}</a>
            <button className="secondary" onClick={() => setSkipped(new Set(skipped).add(target.prospect.id))}><SkipForward size={15} aria-hidden="true" />Skip</button>
            <button className="primary gx-send" disabled={busy || g.readOnly || g.mode === 'preview'} onClick={() => send(target.prospect.id, target.channel)}><Check size={16} aria-hidden="true" />I sent it · +{XP_PER_DM} XP</button>
          </div>
          <p className="quiet gx-hint">Paste it, send it in {channelLabel[target.channel]}, then tap <b>I sent it</b>. Tapping marks this business as DMed so nobody messages them twice.</p>
        </> : <div className="empty"><p><b>No one left to message.</b> {data.prospects.length ? 'Everyone with a social profile has been contacted or skipped. Add more prospects with an Instagram or Facebook handle to the Outreach sheet.' : 'No prospects have been imported yet.'}</p>
          {skipped.size > 0 && <button className="secondary" onClick={() => setSkipped(new Set())}>Bring back {skipped.size} skipped</button>}</div>}
        <form className="gx-manual" onSubmit={e => { e.preventDefault(); void send(null, manual); }}>
          <label>A DM that is not on the list<select value={manual} onChange={e => setManual(e.target.value as DmChannel)}>{dmChannels.map(c => <option key={c} value={c}>{channelLabel[c]}</option>)}</select></label>
          <button className="secondary" type="submit" disabled={busy || g.readOnly || g.mode === 'preview'}>+1 DM</button>
        </form>
      </section>

      <aside className="panel gx-upnext" aria-labelledby="gx-next-title">
        <header className="panel-head"><h2 id="gx-next-title">Up next</h2></header>
        {queue.length > 1 ? <ol>{queue.slice(1, 7).map(t => <li key={t.prospect.id}>
          <span><b>{t.prospect.business_name}</b><small>{[t.prospect.industry, t.channel === 'instagram' ? 'Instagram' : 'Facebook'].filter(Boolean).join(' · ')}</small></span>
          {t.exterior && <span className="gx-chip">Exterior</span>}</li>)}</ol> : <p className="quiet">Nothing else queued.</p>}
        <h3 className="gx-rules-title">How points work</h3>
        <ul className="gx-rules"><li>{XP_PER_DM} XP for every logged DM</li><li>+{GOAL_BONUS_XP} XP the day you hit {goal}</li><li>Streak counts days you hit {goal}. Sundays are free.</li><li>Duo streak: both of you hit {goal}</li></ul>
        <p className="quiet">Reminders are emailed at 10 AM, 2 PM, 6 PM and 8 PM Central while you are under the goal. They come from the same Google script as the email engine.</p>
      </aside>
    </div>
  </div>;
}
