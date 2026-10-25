'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { createBrowserClient } from '@supabase/ssr';
import { UsersRound, ArrowUpRight } from 'lucide-react';
import type { Card } from '@/lib/board';
import { ojConnection } from '@/lib/oj-connection';
import { memberBoardAssignments, memberPresence, presenceAge, PRESENCE_HEARTBEAT_MS, type PresenceSnapshot, type PresenceStatus, type CurrentWork } from '@/lib/presence';
import '@/styles/presence.css';

type Props = { mode: 'preview' | 'live'; organizationId: string; members: string[]; cards: Card[]; onOpenCard: (card: Card) => void };
type Phase = 'connecting' | 'connected' | 'unavailable' | 'reconnecting';

export function PresencePanel({ mode, organizationId, members, cards, onOpenCard }: Props) {
  const [snapshot, setSnapshot] = useState<PresenceSnapshot | null>(null);
  const [phase, setPhase] = useState<Phase>('connecting');
  const [detail, setDetail] = useState('');
  const [availability, setAvailability] = useState<PresenceStatus>('online');
  const preference = useRef<PresenceStatus>('online');
  const [now, setNow] = useState(0);
  const refreshRef = useRef<() => Promise<void>>(async () => {});
  const pulseRef = useRef<() => Promise<void>>(async () => {});
  const [editing, setEditing] = useState(false);
  const [note, setNote] = useState('');
  const [cardId, setCardId] = useState('');
  const [revision, setRevision] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false);
  const [localWork, setLocalWork] = useState<CurrentWork | null>(null);
  const endpoint = `/api/workspace/${organizationId}/presence`;

  useEffect(() => {
    if (mode === 'preview') {
      try {
        const saved = sessionStorage.getItem('oj-preview-current-work:v1');
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed?.user_id === 'local-demo' && typeof parsed.note === 'string' && parsed.note.length <= 160 && (parsed.card_id === null || typeof parsed.card_id === 'string') && Number.isInteger(parsed.revision)) setLocalWork(parsed);
        }
      } catch { /* A local demo may run without browser storage. */ }
      return;
    }
    let disposed = false, refreshing = false, pulsing = false, ready = false, shareFailed = false, offset = 0;
    const sessionId = crypto.randomUUID();
    const controller = new AbortController();
    const client = createBrowserClient(ojConnection.url, ojConnection.publishableKey);
    async function refresh() {
      if (disposed || refreshing) return;
      refreshing = true;
      try {
        const response = await fetch(endpoint, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        const data = await response.json();
        if (disposed) return;
        if (!response.ok) {
          ready = false; setPhase(response.status === 503 ? 'unavailable' : 'reconnecting');
          setDetail(data.error || 'Team availability could not be checked.');
          setSnapshot(null);
          return;
        }
        ready = true; setSnapshot(data); setPhase(shareFailed ? 'reconnecting' : 'connected');
        setDetail(shareFailed ? 'Your availability could not be shared. Reconnecting…' : '');
        offset = Date.parse(data.now) - Date.now(); setNow(Date.now() + offset);
      } catch {
        if (!disposed) { ready = false; setPhase('reconnecting'); setDetail('Availability is unknown while reconnecting.'); }
      } finally { refreshing = false; }
    }
    async function pulse() {
      if (disposed || pulsing || !ready) return;
      pulsing = true;
      try {
        const state = preference.current === 'offline' ? 'offline' : preference.current === 'away' || document.visibilityState !== 'visible' ? 'away' : 'online';
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'heartbeat', sessionId, state }), signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10_000)]) });
        if (!response.ok) throw new Error();
        shareFailed = false;
      } catch { if (!disposed) { shareFailed = true; setPhase('reconnecting'); setDetail('Your availability could not be shared. Reconnecting…'); } }
      finally { pulsing = false; }
    }
    refreshRef.current = refresh;
    pulseRef.current = async () => { await pulse(); await refresh(); };
    const onVisibility = () => { void pulseRef.current(); };
    const onOnline = () => { void refresh().then(() => pulseRef.current()); };
    const onOffline = () => { ready = false; setPhase('reconnecting'); setDetail('You are offline. Everyone’s availability is unknown here.'); };
    const onPageHide = () => {
      if (ready) void fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'heartbeat', sessionId, state: 'offline' }), keepalive: true }).catch(() => {});
    };
    let channel = client.channel(`oj-team:${organizationId}`);
    for (const table of ['oj_presence_sessions', 'oj_current_work']) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `organization_id=eq.${organizationId}` }, () => { void refresh(); });
    }
    channel.subscribe();
    const heartbeat = window.setInterval(() => { if (ready) void pulseRef.current(); else void refresh().then(() => pulseRef.current()); }, PRESENCE_HEARTBEAT_MS);
    const clock = window.setInterval(() => { setNow(Date.now() + offset); if (document.visibilityState === 'visible') void refresh(); }, 15_000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline); window.addEventListener('pagehide', onPageHide);
    void refresh().then(() => pulseRef.current());
    return () => {
      onPageHide(); disposed = true; ready = false; controller.abort();
      window.clearInterval(heartbeat); window.clearInterval(clock);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline); window.removeEventListener('pagehide', onPageHide);
      refreshRef.current = async () => {}; pulseRef.current = async () => {};
      void client.removeChannel(channel);
    };
  }, [mode, organizationId, endpoint]);

  const own = mode === 'preview' ? localWork : snapshot?.work.find(work => work.user_id === snapshot.userId);
  const canEdit = mode === 'preview' || phase === 'connected';
  function edit() {
    setNote(own?.note ?? ''); setCardId(own?.card_id ?? ''); setRevision(own?.revision ?? null);
    setConflict(false); setNotice(''); setEditing(true);
  }
  async function save() {
    setSaving(true); setNotice('');
    try {
      if (mode === 'preview') {
        const next = { user_id: 'local-demo', note: note.trim(), card_id: cardId || null, revision: (revision ?? -1) + 1, updated_at: new Date().toISOString() };
        sessionStorage.setItem('oj-preview-current-work:v1', JSON.stringify(next)); setLocalWork(next);
        setNotice('Saved in this tab only. No teammate was notified.'); setEditing(false); return;
      }
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'work', note, cardId: cardId || null, revision }), signal: AbortSignal.timeout(10_000) });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) { setConflict(true); await refreshRef.current(); }
        throw new Error(data.error || 'Your work status did not save.');
      }
      await refreshRef.current(); setEditing(false); setNotice('Work status shared with your team.');
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Your status did not save. Try again.'); }
    finally { setSaving(false); }
  }
  const roster = mode === 'preview' ? members.map((name, index) => ({ user_id: index ? `demo-${index}` : 'local-demo', display_name: name })) : snapshot?.members ?? members.map(name => ({ user_id: name, display_name: name }));

  return <section className="presence-panel" aria-label="Team availability">
    <details>
      <summary><span className="presence-heading"><UsersRound size={17} aria-hidden="true" />Team at work</span><span className="presence-summary">{mode === 'preview' ? 'Local demo' : phase === 'connected' ? `${roster.filter(m => memberPresence(snapshot?.sessions ?? [], m.user_id, now).state === 'online').length} online` : phase === 'connecting' ? 'Connecting…' : phase === 'unavailable' ? 'Not connected' : 'Reconnecting…'}</span></summary>
      <div className="presence-body">
        <p className="presence-explainer">{mode === 'preview' ? 'Availability below is a local demonstration. No other person is connected.' : 'Share what you choose to work on. Hidden tabs show away; lost connections expire within 90 seconds. You stay online while any tab is available.'}</p>
        {mode === 'live' && detail && <p role="status" className="presence-notice">{detail} <button type="button" onClick={() => void refreshRef.current()}>Check again</button></p>}
        {mode === 'live' && phase === 'unavailable' && <p className="presence-notice">Live availability is not active. Existing shared task assignments below still work; they are not proof anyone is online. <Link href="/workspace/tasks">Open team tasks</Link></p>
        <ul className="presence-roster">{roster.map(member => {
          const availability = memberPresence(snapshot?.sessions ?? [], member.user_id, now);
          const work = mode === 'preview' ? member.user_id === 'local-demo' ? localWork : null : snapshot?.work.find(w => w.user_id === member.user_id);
          const task = cards.find(c => c.id === work?.card_id);
          const boardAssignments=memberBoardAssignments(cards,roster,member.user_id);
          const state = mode === 'preview' || phase !== 'connected' ? 'unknown' : availability.state;
          return <li key={member.user_id}>
            <span className="avatar presence-avatar" data-state={state}>{member.display_name.charAt(0).toUpperCase()}</span>
            <div className="presence-person"><div><strong>{member.display_name}</strong><span className="presence-state" data-state={state}>{state === 'unknown' ? mode === 'preview' ? 'Sample member' : 'Unknown' : state === 'online' ? 'Online' : state === 'away' ? 'Away' : 'Offline'}</span></div>
              {work?.note && <p>{work.note}</p>}
              {task && <button type="button" className="presence-task" onClick={() => onOpenCard(task)}>{task.title}<ArrowUpRight size={13} aria-hidden="true" /></button>}
              {!task && boardAssignments.map(assigned=><button key={assigned.id} type="button" className="presence-task" onClick={()=>onOpenCard(assigned)}>Assigned task: {assigned.title}<ArrowUpRight size={13} aria-hidden="true"/></button>)}
              {mode === 'live' && state !== 'unknown' && <small>{state === 'offline' ? presenceAge(availability.lastSeen, now) : state === 'online' ? 'Workspace connected' : 'Away from this workspace'}{work && ' · Status set explicitly'}</small>}
              {!work?.note && !task && boardAssignments.length===0 && <small>No assigned work in the loaded task board</small>
            </div>
          </li>;
        })}</ul>
        <div className="presence-controls">
          {mode === 'live' && <label>This tab’s availability<select value={availability} disabled={!canEdit} onChange={e => { const next = e.target.value as PresenceStatus; preference.current = next; setAvailability(next); void pulseRef.current(); }}><option value="online">Available</option><option value="away">Away</option><option value="offline">Offline status</option></select></label>}
          {!editing && <button type="button" className="secondary" disabled={!canEdit} onClick={edit}>{own?.note || own?.card_id ? 'Edit my work status' : 'Set my current work'}</button>}
        </div>
        {editing && <form className="presence-form" onSubmit={e => { e.preventDefault(); void save(); }}>
          <fieldset disabled={saving || !canEdit}>
            <label>Currently working on<input value={note} maxLength={160} onChange={e => setNote(e.target.value)} placeholder="e.g. Preparing tomorrow’s quotes" /></label>
            <label>Link a task (optional)<select value={cardId} onChange={e => setCardId(e.target.value)}><option value="">No linked task</option>{cards.map(card => <option key={card.id} value={card.id}>{card.title}{card.stage === 'Done' ? ' (Done)' : ''}</option>)}</select></label>
            <p className="quiet">Leave both blank to clear your work status. Browsing and typing are not shared.</p>
            <div className="presence-actions"><button className="primary" disabled={conflict}>{saving ? 'Saving…' : mode === 'preview' ? 'Save local example' : 'Share status'}</button><button type="button" className="secondary" onClick={() => setEditing(false)}>Cancel</button>{conflict && <button type="button" className="secondary" onClick={edit}>Load latest status</button>}</div>
          </fieldset>
        </form>}
        {notice && <p className="presence-notice" role="status">{notice}</p>}
      </div>
    </details>
  </section>;
}
