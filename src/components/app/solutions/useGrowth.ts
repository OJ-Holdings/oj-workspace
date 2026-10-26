'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { loadGrowth, logDm, undoDm, type GrowthData } from '@/app/workspace/growth-actions';
import type { DmChannel, DmLogEntry } from '@/lib/dm-quests';
import { todayKey } from '@/lib/dm-quests';
import { previewGrowth } from '@/lib/growth-preview';
import { effectiveOutreachStatus } from '@/lib/outreach';

export type GrowthStore = {
  mode: 'preview' | 'live'; readOnly: boolean; org: string; now: Date;
  status: 'loading' | 'ready' | 'error' | 'no-prospects'; data: GrowthData | null;
  reload: () => void;
  /** Records a DM. Returns an error message, or '' on success. */
  log: (prospectId: string | null, channel: DmChannel) => Promise<string>;
  undo: (entryId: string) => Promise<string>;
};

const POLL_MS = 60_000;
/** One shared loader for every OJ Solutions growth screen: refreshes each minute and when the tab regains focus. */
export function useGrowth(org: string, mode: 'preview' | 'live', readOnly: boolean): GrowthStore {
  const [now, setNow] = useState(() => new Date());
  const [state, setState] = useState<{ status: GrowthStore['status']; data: GrowthData | null }>(() => mode === 'preview' ? { status: 'ready', data: previewGrowth(new Date()) } : { status: 'loading', data: null });
  const [revision, setRevision] = useState(0);
  const busy = useRef(0);

  useEffect(() => {
    const tick = () => { setNow(new Date()); if (document.visibilityState === 'visible') setRevision(r => r + 1); };
    const clock = window.setInterval(() => setNow(new Date()), 30_000);
    const poll = window.setInterval(tick, POLL_MS);
    window.addEventListener('focus', tick);
    return () => { window.clearInterval(clock); window.clearInterval(poll); window.removeEventListener('focus', tick); };
  }, []);

  useEffect(() => {
    if (mode !== 'live' || busy.current > 0) return;
    let active = true;
    loadGrowth(org).then(result => {
      if (!active || busy.current > 0) return;
      if (result.ok) setState({ status: 'ready', data: result.data });
      else setState(s => ({ status: result.reason === 'no-prospects' ? 'no-prospects' : s.data ? 'ready' : 'error', data: s.data }));
    }).catch(() => { if (active) setState(s => ({ status: s.data ? 'ready' : 'error', data: s.data })); });
    return () => { active = false; };
  }, [org, mode, revision]);

  const reload = useCallback(() => setRevision(r => r + 1), []);
  const patch = (fn: (d: GrowthData) => GrowthData) => setState(s => s.data ? { ...s, data: fn(s.data) } : s);

  async function log(prospectId: string | null, channel: DmChannel) {
    const d = state.data;
    if (!d?.dm || readOnly) return 'Your access is view-only.';
    if (mode === 'preview') return 'This is a fictional preview. Nothing is recorded here.';
    const tmp = `pending-${Date.now()}`;
    const at = new Date();
    const entry: DmLogEntry = { id: tmp, actor_id: d.me.userId, prospect_id: prospectId, channel, work_day: todayKey(at), undone_at: null, created_at: at.toISOString() };
    busy.current++;
    patch(x => ({
      ...x, dm: x.dm && { ...x.dm, log: [entry, ...x.dm.log] },
      prospects: x.prospects.map(p => p.id === prospectId ? { ...p, outreach_status: effectiveOutreachStatus(p) === 'Not Sent' ? 'DMed' : effectiveOutreachStatus(p) === 'Emailed' ? 'Emailed + DMed' : p.outreach_status } : p),
    }));
    try {
      const result = await logDm(org, prospectId, channel);
      // A repeat tap on the same prospect is a duplicate: drop the placeholder, keep the real entry.
      patch(x => ({ ...x, dm: x.dm && { ...x.dm, log: result.duplicate ? x.dm.log.filter(e => e.id !== tmp) : x.dm.log.map(e => e.id === tmp ? { ...e, id: result.id } : e) } }));
      return '';
    } catch (e) {
      patch(x => ({ ...x, dm: x.dm && { ...x.dm, log: x.dm.log.filter(item => item.id !== tmp) } }));
      return e instanceof Error ? e.message : 'Could not record the DM.';
    } finally { busy.current--; reload(); }
  }
  async function undo(entryId: string) {
    if (mode === 'preview' || readOnly) return 'Nothing to undo here.';
    busy.current++;
    try { await undoDm(org, entryId); patch(x => ({ ...x, dm: x.dm && { ...x.dm, log: x.dm.log.map(e => e.id === entryId ? { ...e, undone_at: new Date().toISOString() } : e) } })); return ''; }
    catch (e) { return e instanceof Error ? e.message : 'Could not undo.'; }
    finally { busy.current--; reload(); }
  }

  return { mode, readOnly, org, now, status: state.status, data: state.data, reload, log, undo };
}
