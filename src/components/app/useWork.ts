'use client';

import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { checkInWork, closeIdleWork, editWorkSession, startWork, stopWork, type WorkResult } from '@/app/workspace/work-actions';
import { checkinState, editProblem, runningSession, type CheckinPhase, type SessionEdit, type WorkBusiness, type WorkData, type WorkSession } from '@/lib/work';
import { recount, sampleWork } from '@/lib/sample-work';

const PREVIEW_KEY = 'oj-workspace-preview-work-v1';
const RETRY_MS = 60_000;
const DUE_TITLE = 'Still working? - OJ Workspace';

/**
 * The work timer and the leaderboard's figures. Live: the figures arrive with
 * every workspace load and from every timer action, and the database decides
 * every time and every point. Preview: fictional figures, changed in this
 * browser only; nothing here reaches the database.
 *
 * `partner` is false for viewers, who have no timer and no leaderboard.
 */
export function useWork(initial: WorkData | null | undefined, mode: 'preview' | 'live', org: string, partner: boolean, readOnly: boolean) {
  const [data, setData] = useState<WorkData | null>(mode === 'live' ? initial ?? null : null);
  // The server's clock minus this browser's, so a timer reads the same on every device. null until known.
  const [offset, setOffset] = useState<number | null>(null);
  // null until the page is running in the browser, so nothing time-based is rendered on the server.
  const [now, setNow] = useState<number | null>(null);
  const [notice, setNotice] = useState('');
  // A notice that a timer ended (or an error) stays until dismissed; anything else fades.
  const [noticeSticky, setNoticeSticky] = useState(false);
  const [pending, startTransition] = useTransition();
  const nextClose = useRef(new Map<string, number>());
  const clearNotice = useCallback(() => { setNotice(''); setNoticeSticky(false); }, []);
  const titleBefore = useRef<string | null>(null);

  // A newer workspace load replaces the figures; an older one never overwrites an action's fresher result.
  useEffect(() => {
    if (mode !== 'live') return;
    // A load that could not read the figures keeps the last ones read rather than blanking the card.
    setData(d => !initial ? d : !d || initial.asOf >= d.asOf ? initial : d);
  }, [initial, mode]);

  // The sample workspace is dated from this browser's clock, and kept in this browser.
  useEffect(() => {
    if (mode !== 'preview') return;
    const fresh = sampleWork(new Date());
    let start = fresh;
    try {
      const stored = JSON.parse(localStorage.getItem(PREVIEW_KEY) || 'null') as WorkData | null;
      if (stored && stored.me === fresh.me && Array.isArray(stored.weeks) && Array.isArray(stored.sessions)
        && stored.weeks.at(-1)?.week_start === fresh.weeks.at(-1)?.week_start) start = recount(stored, Date.now());
    } catch { /* fall back to fresh sample figures */ }
    setData(start);
  }, [mode]);
  useEffect(() => {
    if (mode === 'preview' && data) { try { localStorage.setItem(PREVIEW_KEY, JSON.stringify(data)); } catch { /* the preview just won't survive a reload */ } }
  }, [data, mode]);

  // Each load gives one sample of (server clock - browser clock - time the response took). The time taken
  // only ever makes a sample smaller, so keep the largest; a sample far smaller means this device's clock
  // was changed.
  useEffect(() => {
    if (!data) return;
    if (mode !== 'live') { setOffset(0); return; }
    const sample = Date.parse(data.asOf) - Date.now();
    setOffset(o => o === null || sample > o || o - sample > 30_000 ? sample : o);
  }, [data, mode]);

  // Tick every second while any timer runs, otherwise every half minute. A small step back (a better
  // clock estimate arriving) holds the time still for a moment rather than running it backwards.
  const anyRunning = !!data?.sessions.some(s => !s.ended_at);
  useEffect(() => {
    const tick = () => setNow(prev => {
      const next = Date.now() + (offset ?? 0);
      return prev !== null && next < prev && prev - next < 10_000 ? prev : next;
    });
    tick();
    const id = window.setInterval(tick, anyRunning ? 1000 : 30_000);
    document.addEventListener('visibilitychange', tick);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', tick); };
  }, [anyRunning, offset]);

  const mine = data ? runningSession(data, data.me) : undefined;
  const state = mine && now !== null ? checkinState(mine, now) : null;
  const phase: CheckinPhase = state?.phase ?? 'ok';
  const canWrite = partner && !readOnly && !!data;
  // Answering "Still working?" and stopping still go through while the workspace is reconnecting: the
  // action reaches the server on its own and returns fresh figures, and fails with a message if offline.
  const canAnswer = partner && !!data;

  const apply = (r: WorkResult, quiet: boolean) => {
    const fresh = r.work;
    if (fresh) setData(d => !d || fresh.asOf >= d.asOf ? fresh : d);
    // A quiet action (the automatic close) leaves the current notice alone unless it has something to say.
    if (quiet && r.ok && !r.notice) return r;
    setNotice(r.notice); setNoticeSticky(!r.ok || !!r.sticky);
    return r;
  };
  type Preview = (d: WorkData, t: number) => { data: WorkData; ok: boolean; notice: string; sticky?: boolean };
  const run = (live: () => Promise<WorkResult>, preview: Preview, opts: { done?: (r: WorkResult) => void; answer?: boolean; quiet?: boolean } = {}) => {
    if (!(opts.answer ? canAnswer : canWrite)) {
      const r = { ok: false, notice: 'The workspace is reconnecting. Try again in a moment.', work: null };
      if (!opts.quiet) { setNotice(r.notice); setNoticeSticky(false); }
      opts.done?.(r);
      return;
    }
    startTransition(async () => {
      try {
        let r: WorkResult;
        if (mode === 'preview') {
          const out = preview(data!, Date.now());
          r = { ok: out.ok, notice: out.notice, sticky: out.sticky, work: out.ok ? recount(out.data, Date.now()) : null };
        } else r = await live();
        apply(r, !!opts.quiet); opts.done?.(r);
      } catch {
        const r = { ok: false, notice: 'Something went wrong. Check your connection and try again.', work: null };
        setNotice(r.notice); setNoticeSticky(true); opts.done?.(r);
      }
    });
  };
  const replace = (d: WorkData, id: string, patch: Partial<WorkSession>) => ({ ...d, sessions: d.sessions.map(s => s.id === id ? { ...s, ...patch } : s) });
  const endIdle = (d: WorkData, t: number) => ({
    ...d, sessions: d.sessions.map(s => !s.ended_at && checkinState(s, t).phase === 'expired' ? { ...s, ended_at: s.last_checkin_at, ended_reason: 'idle' as const } : s),
  });

  // When a timer's check-in has run out (on load, or while the page is open) the database ends it
  // at its last check-in. Asked once per timer, then again a minute later if that did not work.
  useEffect(() => {
    if (!data || now === null || !canWrite) return;
    const stale = data.sessions.filter(s => !s.ended_at && checkinState(s, now).phase === 'expired' && (nextClose.current.get(s.id) ?? 0) <= now);
    if (!stale.length) return;
    stale.forEach(s => nextClose.current.set(s.id, now + RETRY_MS));
    const ownStale = stale.find(s => s.user_id === data.me);
    // Say your timer ended only if the reply shows it did (another device may have checked in meanwhile).
    const ended = (d: WorkData | null) => {
      const own = ownStale && d?.sessions.find(s => s.id === ownStale.id);
      return own?.ended_reason === 'idle' && own.ended_at
        ? `Your timer ended at ${new Date(own.ended_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}, your last check-in, because "Still working?" went unanswered.` : '';
    };
    run(async () => {
      const r = await closeIdleWork(org);
      const said = r.ok ? ended(r.work) : '';
      return said ? { ...r, notice: said, sticky: true } : r;
    }, (d, t) => { const next = endIdle(d, t); const said = ended(next); return { data: next, ok: true, notice: said, sticky: !!said }; }, { quiet: true });
  }, [now, data, canWrite]);

  // While "Still working?" waits for an answer, the browser tab says so too. Set again on every tick,
  // because Next.js can write the page title after this runs.
  useEffect(() => {
    if (phase === 'due') {
      if (titleBefore.current === null) titleBefore.current = document.title;
      if (document.title !== DUE_TITLE) document.title = DUE_TITLE;
    } else if (titleBefore.current !== null) {
      document.title = titleBefore.current;
      titleBefore.current = null;
    }
  }, [phase, now]);
  useEffect(() => () => { if (titleBefore.current !== null) document.title = titleBefore.current; }, []);

  return {
    mode, data, now, notice, noticeSticky, pending, phase, mine, checkin: state,
    /** The timer and leaderboard can be shown. */
    available: partner && !!data,
    /** A partner on the live workspace, but the leaderboard's database update is not applied yet. */
    missing: mode === 'live' && partner && !data,
    canWrite, canAnswer,
    clearNotice,
    start: (business: WorkBusiness) => run(() => startWork(org, business), (d, t) => {
      if (runningSession(d, d.me)) return { data: d, ok: false, notice: 'Your timer is already running.' };
      const at = new Date(t).toISOString();
      return { ok: true, notice: 'Timer started.', data: { ...d, sessions: [{ id: crypto.randomUUID(), user_id: d.me, business, started_at: at, last_checkin_at: at, ended_at: null, ended_reason: null, note: '' }, ...d.sessions] } };
    }),
    checkIn: () => { if (mine) run(() => checkInWork(org, mine.id), (d, t) => checkinState(mine, t).phase === 'expired'
      ? { data: endIdle(d, t), ok: true, notice: 'The check-in was missed, so your timer ended at your last check-in.', sticky: true }
      : { data: replace(d, mine.id, { last_checkin_at: new Date(t).toISOString() }), ok: true, notice: 'Checked in. The timer keeps running.' }, { answer: true }); },
    stop: (how: 'manual' | 'idle') => { if (mine) run(() => stopWork(org, mine.id, how), (d, t) => {
      const missed = checkinState(mine, t).phase === 'expired';
      if (how === 'idle' && checkinState(mine, t).phase === 'ok') return { data: d, ok: false, notice: 'A check-in is not due yet.' };
      const idle = { data: replace(d, mine.id, { ended_at: mine.last_checkin_at, ended_reason: 'idle' }), ok: true };
      return missed ? { ...idle, notice: 'The check-in was missed, so the timer ended at your last check-in.', sticky: true }
        : how === 'idle' ? { ...idle, notice: 'Timer ended at your last check-in.' }
        : { data: replace(d, mine.id, { ended_at: new Date(t).toISOString(), ended_reason: 'manual' }), ok: true, notice: 'Timer stopped.' };
    }, { answer: true }); },
    edit: (edit: SessionEdit, done: (r: WorkResult) => void) => run(() => editWorkSession(org, edit), (d, t) => {
      const problem = editProblem(edit, t);
      const target = d.sessions.find(s => s.id === edit.id && s.user_id === d.me && s.ended_at);
      const start = Date.parse(edit.started_at), end = Date.parse(edit.ended_at);
      const overlaps = d.sessions.some(s => s.user_id === d.me && s.id !== edit.id && Date.parse(s.started_at) < end && (s.ended_at ? Date.parse(s.ended_at) : Infinity) > start);
      if (problem || !target || overlaps) return { data: d, ok: false, notice: problem ?? (!target ? 'Only your own finished sessions can be edited.' : 'This overlaps another of your sessions') };
      return { ok: true, notice: 'Session saved and marked as edited.', data: replace(d, edit.id, { business: edit.business, started_at: new Date(start).toISOString(), ended_at: new Date(end).toISOString(), last_checkin_at: new Date(end).toISOString(), note: edit.note.trim(), ended_reason: 'edited' }) };
    }, { done }),
  };
}

export type WorkStore = ReturnType<typeof useWork>;
