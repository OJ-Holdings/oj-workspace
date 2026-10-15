'use client';

import { useEffect, useRef, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { Crown, Flame, Pencil, Trophy, X } from 'lucide-react';
import type { Card } from '@/lib/board';
import {
  checkinState, editProblem, hoursMinutes, leaderboardView, twoDecimals, weekLabel, workBusinessColor, workBusinessLabel, workBusinesses,
  type LeaderboardView, type PersonView, type WeekResult, type WorkBusiness, type WorkSession,
} from '@/lib/work';
import type { WorkStore } from './useWork';

const swatch = (b: WorkBusiness) => ({ '--tag': workBusinessColor(b) }) as React.CSSProperties;
const points = (n: number) => `${twoDecimals(n)} ${n === 1 ? 'point' : 'points'}`;

/** This week's race on Home: points side by side, the hours and task split, the gap, and who has been winning. */
export function Leaderboard({ work, cards }: { work: WorkStore; cards: Card[] }) {
  const [detail, setDetail] = useState(false);
  if (work.missing) return (
    <section className="panel leaderboard" aria-labelledby="lb-h">
      <header className="panel-head"><h2 id="lb-h">This week's leaderboard</h2></header>
      <div className="empty"><p><b>One step left to switch this on.</b> The work timer and this leaderboard need one database update (supabase/pending/RUN-ME-work-leaderboard.sql), approved by a founder. Nothing else changes while it waits.</p></div>
    </section>
  );
  if (!work.available) return null;
  if (!work.data || work.now === null) return <section className="panel leaderboard is-loading" aria-label="This week's leaderboard" aria-busy="true" />;
  const view = leaderboardView(work.data, work.now);
  const nobody = view.people.every(p => p.points === 0);

  return (
    <section className="panel leaderboard" aria-labelledby="lb-h">
      <header className="panel-head">
        <div>
          <h2 id="lb-h">This week's leaderboard</h2>
          <p className="panel-note">{view.week ? `${view.week.label}, Monday to Sunday, Central time.` : ''} Points are hours worked plus 3 for each finished task.</p>
        </div>
        <button className="panel-link" onClick={() => setDetail(true)}>Sessions and history</button>
      </header>
      <div className="lb-people">
        {view.people.map(p => <Person key={p.id} p={p} tied={view.tied} nobody={nobody} />)}
      </div>
      <LastWeek result={view.lastWeek} />
      {detail && <Detail view={view} work={work} cards={cards} onClose={() => setDetail(false)} />}
    </section>
  );
}

function Person({ p, tied, nobody }: { p: PersonView; tied: boolean; nobody: boolean }) {
  const taskPoints = p.tasks * 3;
  const gap = p.isLeader ? (p.gap > 0 ? `Leading by ${twoDecimals(p.gap)}` : 'Leading')
    : nobody ? 'No points yet this week' : tied && p.gap === 0 ? 'Level at the top' : `${twoDecimals(p.gap)} behind`;
  const total = p.byBusiness.reduce((sum, b) => sum + b.seconds, 0);
  return (
    <article className={p.isLeader ? 'lb-person is-leader' : 'lb-person'} aria-label={`${p.name}${p.isMe ? ' (you)' : ''}: ${points(p.points)}${p.isLeader ? ', leading' : ''}`}>
      <header className="lb-who">
        <span className="avatar avatar-lg" aria-hidden="true">{p.name.charAt(0).toUpperCase()}</span>
        <div>
          <h3>{p.name}{p.isMe && <small> (you)</small>}</h3>
          {p.running
            ? <span className="lb-live" style={{ '--dot': workBusinessColor(p.running.business) } as React.CSSProperties}><i aria-hidden="true" />Timing {workBusinessLabel(p.running.business)}</span>
            : <span className="lb-idle">No timer running</span>}
        </div>
        {p.isLeader && <span className="lb-crown" title="Leading this week"><Crown size={22} aria-hidden="true" /></span>}
      </header>
      <p className="lb-points">
        <span className="lb-figure"><NumberFlow value={p.points} format={{ minimumFractionDigits: 2, maximumFractionDigits: 2 }} aria-hidden="true" /></span>
        <span>points</span>
      </p>
      <p className="lb-gap">{gap}</p>
      <div className="lb-split" aria-hidden="true">
        {p.points > 0 ? <><b className="lb-split-hours" style={{ flexGrow: p.hours }} /><b className="lb-split-tasks" style={{ flexGrow: taskPoints }} /></> : <b className="lb-split-none" />}
      </div>
      <dl className="lb-parts">
        <div><dt><i className="lb-key-hours" aria-hidden="true" />Hours</dt><dd>{twoDecimals(p.hours)}</dd></div>
        <div><dt><i className="lb-key-tasks" aria-hidden="true" />Tasks</dt><dd>{p.tasks} <small>= {taskPoints} pts</small></dd></div>
      </dl>
      {p.byBusiness.length > 0 ? (
        <ul className="lb-biz" aria-label={`${p.name}'s hours by business this week`}>
          {p.byBusiness.map(b => (
            <li key={b.business} style={swatch(b.business)}>
              <span>{workBusinessLabel(b.business)}</span>
              <i aria-hidden="true"><b style={{ width: `${Math.max(4, (b.seconds / total) * 100)}%` }} /></i>
              <span className="lb-biz-time">{hoursMinutes(b.seconds)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="lb-biz-none">No time logged this week.</p>}
      <footer className="lb-record">
        <span><Trophy size={14} aria-hidden="true" />{p.weeksWon} {p.weeksWon === 1 ? 'week' : 'weeks'} won</span>
        <span className={p.streak > 0 ? 'is-hot' : ''}><Flame size={14} aria-hidden="true" />{p.streak > 0 ? `${p.streak}-week streak` : 'No streak'}</span>
      </footer>
    </article>
  );
}

function LastWeek({ result }: { result: WeekResult | null }) {
  if (!result) return <p className="lb-last">Last week's winner shows here once a full week has been recorded.</p>;
  const scores = result.scores.map(s => `${s.name} ${twoDecimals(s.points)}`).join(', ');
  return (
    <p className="lb-last">
      <span>Last week ({result.label}):</span>{' '}
      {result.outcome === 'won' && result.winner ? <><Crown size={15} aria-hidden="true" className="lb-last-crown" /><b>{result.winner.name} won</b>. {scores}.</>
        : result.outcome === 'tie' ? <><b>A tie</b>. {scores}.</> : <>No time or tasks were recorded.</>}
    </p>
  );
}

const toLocalInput = (iso: string) => {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};
const when = (iso: string) => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const clockTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** Every session behind this week's and last week's points, the tasks that counted, and the record of past weeks. */
function Detail({ view, work, cards, onClose }: { view: LeaderboardView; work: WorkStore; cards: Card[]; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [which, setWhich] = useState<'this' | 'last'>('this');
  const [editing, setEditing] = useState<string | null>(null);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => before?.focus();
  }, []);
  const data = work.data!;
  const now = work.now!;
  const weekRows = (start: string | undefined) => data.weeks.filter(w => w.week_start === start);
  const start = which === 'this' ? view.week?.start : view.lastWeek?.weekStart;
  const rows = weekRows(start);
  const from = rows[0] ? Date.parse(rows[0].starts_at) : 0, to = rows[0] ? Date.parse(rows[0].ends_at) : 0;
  const inWeek = (s: WorkSession) => Date.parse(s.started_at) < to && (s.ended_at ? Date.parse(s.ended_at) : now) > from;
  const title = (id: string) => cards.find(c => c.id === id)?.title;

  return (
    <dialog ref={dialog} className="card-dialog lb-dialog" aria-labelledby="lb-detail-h" onClose={onClose} onClick={e => { if (e.target === dialog.current) dialog.current?.close(); }}>
      <div className="dialog-header">
        <h2 id="lb-detail-h">Sessions and history</h2>
        <button className="icon-button" aria-label="Close" onClick={() => dialog.current?.close()}><X size={20} /></button>
      </div>
      <div className="seg" role="group" aria-label="Week">
        <button aria-pressed={which === 'this'} className={which === 'this' ? 'is-on' : ''} onClick={() => { setWhich('this'); setEditing(null); }}>This week{view.week ? `, ${view.week.label}` : ''}</button>
        {view.lastWeek && <button aria-pressed={which === 'last'} className={which === 'last' ? 'is-on' : ''} onClick={() => { setWhich('last'); setEditing(null); }}>Last week, {view.lastWeek.label}</button>}
      </div>

      {data.partners.map(partner => {
        const row = rows.find(r => r.user_id === partner.id);
        const live = which === 'this' ? view.people.find(p => p.id === partner.id) : undefined;
        const sessions = data.sessions.filter(s => s.user_id === partner.id && inWeek(s)).sort((a, b) => b.started_at.localeCompare(a.started_at));
        const counted = row?.task_ids ?? [];
        return (
          <section key={partner.id} className="lb-detail-person">
            <h3>{partner.name}{partner.id === data.me && <small> (you)</small>}<span>{points(live?.points ?? row?.points ?? 0)}{row?.won && <Crown size={15} aria-label="Won this week" className="lb-last-crown" />}</span></h3>
            {sessions.length === 0 && <p className="quiet">No timed sessions this week.</p>}
            <ul className="lb-sessions">
              {sessions.map(s => {
                const expired = !s.ended_at && checkinState(s, now).phase === 'expired';
                const end = s.ended_at ?? (expired ? s.last_checkin_at : null);
                const seconds = ((end ? Date.parse(end) : now) - Date.parse(s.started_at)) / 1000;
                const mineToEdit = s.user_id === data.me && !!s.ended_at && work.canWrite;
                return (
                  <li key={s.id}>
                    <div className="lb-session">
                      <span className="tag" style={swatch(s.business)}>{workBusinessLabel(s.business)}</span>
                      <span className="lb-session-when">{when(s.started_at)} to {end ? clockTime(end) : 'now'}</span>
                      <b>{hoursMinutes(seconds)}</b>
                      {!s.ended_at && !expired && <span className="badge badge-live">Running</span>}
                      {expired && <span className="badge">Check-in missed</span>}
                      {s.ended_reason === 'idle' && <span className="badge" title="Nobody answered “Still working?”, so it ended at the last check-in.">Auto-ended</span>}
                      {s.ended_reason === 'edited' && <span className="badge badge-edited">Edited</span>}
                      {mineToEdit && editing !== s.id && <button className="icon-button" aria-label={`Edit the session from ${when(s.started_at)}`} onClick={() => setEditing(s.id)}><Pencil size={15} /></button>}
                    </div>
                    {s.ended_reason === 'edited' && s.note && <p className="lb-session-note">Edit note: {s.note}</p>}
                    {editing === s.id && <EditSession session={s} work={work} onDone={() => setEditing(null)} />}
                  </li>
                );
              })}
            </ul>
            {counted.length > 0 && (
              <p className="lb-tasks"><b>{counted.length} {counted.length === 1 ? 'task' : 'tasks'} counted</b>{counted.some(title) ? ': ' + counted.map(id => title(id) ?? 'a task').join(', ') : ''}.</p>
            )}
          </section>
        );
      })}

      <h3 className="lb-history-h">Past weeks</h3>
      {view.history.length === 0 ? <p className="quiet">No finished weeks yet.</p> : (
        <div className="tablewrap"><table className="table">
          <thead><tr><th>Week</th>{data.partners.map(p => <th key={p.id} className="num">{p.name}</th>)}</tr></thead>
          <tbody>{view.history.slice(0, 12).map(w => (
            <tr key={w.weekStart}><td>{weekLabel(w.weekStart)}</td>{w.scores.map(s => <td key={s.id} className="num">{s.won && <Crown size={13} aria-label="Won" className="lb-last-crown" />} {twoDecimals(s.points)}</td>)}</tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="quiet lb-rules">
        Points are hours worked, counted to the minute, plus 3 for each task you move to Done. A task counts if it was created at least 12 hours before it was finished, or created by the other partner. Weeks run Monday to Sunday, Central time; a tie or an empty week has no winner. Timers ask &ldquo;Still working?&rdquo; every hour and end at the last check-in if nobody answers within 10 minutes. You can edit your own finished sessions with a note; edited sessions are marked.
      </p>
    </dialog>
  );
}

function EditSession({ session, work, onDone }: { session: WorkSession; work: WorkStore; onDone: () => void }) {
  const [business, setBusiness] = useState<WorkBusiness>(session.business);
  const [start, setStart] = useState(toLocalInput(session.started_at));
  const [end, setEnd] = useState(toLocalInput(session.ended_at!));
  const [note, setNote] = useState('');
  const [problem, setProblem] = useState('');
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const edit = { id: session.id, business, started_at: new Date(start).toISOString(), ended_at: new Date(end).toISOString(), note };
    const p = Number.isNaN(Date.parse(start)) || Number.isNaN(Date.parse(end)) ? 'Choose a valid start and end.' : editProblem(edit, work.now ?? Date.now());
    if (p) { setProblem(p); return; }
    setProblem('');
    work.edit(edit, r => { if (r.ok) onDone(); else setProblem(r.notice); });
  };
  return (
    <form className="lb-edit" onSubmit={save}>
      <div className="form-grid">
        <label>Started<input type="datetime-local" required value={start} onChange={e => setStart(e.target.value)} /></label>
        <label>Ended<input type="datetime-local" required value={end} onChange={e => setEnd(e.target.value)} /></label>
      </div>
      <label>Worked on<select value={business} onChange={e => setBusiness(e.target.value as WorkBusiness)}>{workBusinesses.map(b => <option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
      <label>Why are you changing it?<textarea required rows={2} maxLength={500} value={note} onChange={e => setNote(e.target.value)} placeholder="For example: forgot to stop the timer before lunch." /></label>
      {problem && <p className="error-text" role="alert">{problem}</p>}
      <div className="lb-edit-actions">
        <button type="button" className="secondary" onClick={onDone}>Cancel</button>
        <button type="submit" className="primary" disabled={work.pending || !note.trim()}>Save as edited</button>
      </div>
    </form>
  );
}
