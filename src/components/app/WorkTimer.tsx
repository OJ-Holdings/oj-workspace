'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Play, Square, X } from 'lucide-react';
import { clock, workBusinessColor, workBusinessLabel, workBusinesses } from '@/lib/work';
import type { WorkStore } from './useWork';

const time = (ms: number) => new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });

/** Start and stop control in the top bar, on every page. The running timer lives in the database, so it survives reloads and follows you between devices. */
export function WorkTimer({ work }: { work: WorkStore }) {
  const [picking, setPicking] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const { mine, now, notice, noticeSticky } = work;

  // The business menu closes on a click elsewhere or Escape.
  useEffect(() => {
    if (!picking) return;
    const away = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setPicking(false); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setPicking(false); };
    document.addEventListener('mousedown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', away); document.removeEventListener('keydown', esc); };
  }, [picking]);
  useEffect(() => {
    if (!notice || noticeSticky) return;
    const id = window.setTimeout(work.clearNotice, 8000);
    return () => window.clearTimeout(id);
  }, [notice, noticeSticky, work.clearNotice]);

  if (!work.available) return null;
  const locked = !work.canWrite || work.pending;
  const due = work.phase === 'due' && !!mine;

  return (
    <div className="timer" ref={wrap}>
      {mine ? (
        // The start time is shown only once the page runs in the browser, in the viewer's own time zone.
        <div className="timer-running" style={{ '--dot': workBusinessColor(mine.business) } as React.CSSProperties} title={now === null ? undefined : `${workBusinessLabel(mine.business)} timer, started ${time(Date.parse(mine.started_at))}`}>
          <i aria-hidden="true" />
          <span className="timer-biz">{workBusinessLabel(mine.business)}</span>
          <time aria-label="Time on this timer">{now === null ? '0:00:00' : clock((now - Date.parse(mine.started_at)) / 1000)}</time>
          {/* While a check-in is due, it can be answered here too, even if the prompt was closed. */}
          {due && <button className="timer-checkin" aria-label="Yes, still working" disabled={!work.canAnswer || work.pending} onClick={work.checkIn}><Check size={14} aria-hidden="true" /><span>Check in</span></button>}
          <button className="timer-stop" aria-label={`Stop the ${workBusinessLabel(mine.business)} timer`} disabled={!work.canAnswer || work.pending} onClick={() => work.stop('manual')}><Square size={13} aria-hidden="true" /></button>
        </div>
      ) : (
        <button className="timer-start" aria-expanded={picking} aria-haspopup="true" disabled={locked} onClick={() => setPicking(v => !v)}>
          <Play size={14} aria-hidden="true" /><span>Start timer</span>
        </button>
      )}
      {picking && !mine && (
        <div className="popover timer-menu" role="dialog" aria-label="Start a timer">
          <h2>What are you working on?</h2>
          {workBusinesses.map(b => (
            <button key={b.id} className="popover-row" disabled={locked} onClick={() => { setPicking(false); work.start(b.id); }}>
              <i className="timer-swatch" style={{ background: workBusinessColor(b.id) }} aria-hidden="true" />{b.label}
            </button>
          ))}
        </div>
      )}
      {/* Always mounted, so screen readers announce each notice as it arrives. */}
      <p className="sr-only" role="status" aria-live="polite">{notice}</p>
      {notice && (
        <div className="timer-notice">
          <p>{notice}</p>
          <button className="icon-button" aria-label="Dismiss" onClick={work.clearNotice}><X size={15} /></button>
        </div>
      )}
      <StillWorking work={work} />
    </div>
  );
}

/**
 * Asked an hour after the last check-in. Unanswered for 10 more minutes, the timer ends at that check-in.
 * The browser lets a second Escape (or Android back) close it; then the "Check in" button in the top bar
 * still answers it, and the prompt comes back when you return to the tab.
 */
function StillWorking({ work }: { work: WorkStore }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [dismissed, setDismissed] = useState(false);
  const due = work.phase === 'due' && !!work.mine && !!work.checkin;
  const open = due && !dismissed;
  useEffect(() => { if (!due) setDismissed(false); }, [due]);
  useEffect(() => {
    if (open && !dialog.current?.open) dialog.current?.showModal();
    if (!open && dialog.current?.open) dialog.current.close();
  }, [open]);
  useEffect(() => {
    if (!due || !dismissed) return;
    const back = () => { if (document.visibilityState === 'visible') setDismissed(false); };
    window.addEventListener('focus', back); document.addEventListener('visibilitychange', back);
    return () => { window.removeEventListener('focus', back); document.removeEventListener('visibilitychange', back); };
  }, [due, dismissed]);
  const c = work.checkin;
  const left = c && work.now !== null ? Math.max(0, Math.ceil((c.endsAt - work.now) / 60_000)) : 0;
  const locked = !work.canAnswer || work.pending;
  return (
    <dialog ref={dialog} className="card-dialog still-working" role="alertdialog" aria-labelledby="still-h" aria-describedby="still-p"
      onCancel={e => e.preventDefault()} onClose={() => { if (due) setDismissed(true); }}>
      {due && c && work.mine && <>
        <h2 id="still-h">Still working?</h2>
        <p id="still-p">Your {workBusinessLabel(work.mine.business)} timer has run an hour since your last check-in at {time(c.lastCheckin)}. If nobody answers by {time(c.endsAt)}{left > 0 ? ` (${left} min)` : ''}, it ends at {time(c.lastCheckin)}.</p>
        <div className="still-actions">
          <button className="primary" autoFocus disabled={locked} onClick={work.checkIn}>Yes, still working</button>
          <button className="secondary" disabled={locked} onClick={() => work.stop('idle')}>No, end it at {time(c.lastCheckin)}</button>
        </div>
        {/* The top-bar notice sits behind this dialog, so a failed answer is shown here as well. */}
        {work.notice && work.noticeSticky && !work.pending && <p className="error-text still-notice">{work.notice}</p>}
      </>}
    </dialog>
  );
}
