'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { App } from '@/components/app/App';
import type { Connections } from '@/components/app/Pages';
import type { WorkspaceSnapshot } from '@/lib/board';
import { ojConnection } from '@/lib/oj-connection';
export function LiveWorkspace({ organizationId, initial, connections, servedRelease }: { organizationId: string; initial: WorkspaceSnapshot; connections: Connections; servedRelease: string }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [status, setStatus] = useState('Connecting shared updates…');
  const [available, setAvailable] = useState(true);
  const [ended, setEnded] = useState(false);
  const [outdated, setOutdated] = useState(false);
  // The page carries the SHA of the build that rendered its Server Action IDs.
  // On a host switch, old tabs must reload before making another mutation.
  useEffect(() => {
    if (!/^[a-f0-9]{40}$/i.test(servedRelease)) return;
    let disposed = false;
    const check = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const response = await fetch('/api/deploy-health', { cache: 'no-store', signal: AbortSignal.timeout(5000) });
        if (!response.ok || disposed) return;
        const health = await response.json() as { release?: string };
        if (!disposed && typeof health.release === 'string' && /^[a-f0-9]{40}$/i.test(health.release) && health.release !== servedRelease) setOutdated(true);
      } catch { /* A failed health probe cannot establish a deployment mismatch. */ }
    };
    void check();
    const timer = window.setInterval(() => { void check(); }, 30_000);
    const onFocus = () => { void check(); };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); };
  }, [servedRelease]);
  const hasDashboard = snapshot.dashboard !== null;
  const hasWork = snapshot.work !== null;
  useEffect(() => {
    let disposed = false, busy = false, queued = false, pushConnected = false;
    const controller = new AbortController();
    const client = createBrowserClient(ojConnection.url, ojConnection.publishableKey);
    async function refresh() {
      if (disposed) return;
      if (busy) { queued = true; return; }
      busy = true;
      try {
        const response = await fetch(`/api/workspace/${organizationId}`, { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]) });
        if (disposed) return;
        if (response.status === 401 || response.status === 403) {
          setEnded(true); disposed = true; window.location.replace('/login?notice=access-ended'); return;
        }
        if (!response.ok) throw new Error();
        const next = await response.json() as WorkspaceSnapshot;
        if (disposed) return;
        setSnapshot(next); setAvailable(true);
        setStatus(pushConnected ? 'Live updates connected' : 'Shared updates checked every 15 seconds');
      } catch { if (!disposed) { setAvailable(false); setStatus('Connection interrupted. Editing paused; reconnecting…'); } }
      finally { busy = false; if (queued && !disposed) { queued = false; void refresh(); } }
    }
    // Events are hints only: reload through verified membership rather than trusting event payloads.
    let channel = client.channel(`oj-workspace:${organizationId}`);
    for (const table of ['oj_cards', 'oj_comments', 'oj_activity', 'oj_memberships']) {
      channel = channel.on('postgres_changes', { event: '*', schema: 'public', table, filter: `organization_id=eq.${organizationId}` }, () => { void refresh(); });
    }
    channel.subscribe(state => { pushConnected = state === 'SUBSCRIBED'; if (!disposed) void refresh(); });
    // The dashboard tables get their own channel, and only once they exist: subscribing to a
    // table that is not there yet would fail the whole channel and silence task updates too.
    let extra: ReturnType<typeof client.channel> | null = null;
    if (hasDashboard) {
      extra = client.channel(`oj-dashboard:${organizationId}`);
      for (const table of ['oj_messages', 'oj_leads', 'oj_finance_entries', 'oj_metric_entries', 'oj_events', 'oj_documents']) {
        extra = extra.on('postgres_changes', { event: '*', schema: 'public', table, filter: `organization_id=eq.${organizationId}` }, () => { void refresh(); });
      }
      extra.subscribe();
    }
    // Work sessions likewise: only once the leaderboard's table exists, and only for partners (viewers get no figures).
    const work = hasWork ? client.channel(`oj-work:${organizationId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'oj_work_sessions', filter: `organization_id=eq.${organizationId}` }, () => { void refresh(); })
      .subscribe() : null;
    const auth = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' && !disposed) { setEnded(true); window.location.replace('/login'); }
    });
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    const onFocus = () => { void refresh(); };
    const onOffline = () => { setAvailable(false); setStatus('You are offline. Editing paused; reconnecting…'); };
    window.addEventListener('offline', onOffline); window.addEventListener('online', onFocus);
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus); void refresh();
    return () => { disposed = true; controller.abort(); window.clearInterval(timer); window.removeEventListener('offline', onOffline); window.removeEventListener('online', onFocus); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); auth.data.subscription.unsubscribe(); void client.removeChannel(channel); if (extra) void client.removeChannel(extra); if (work) void client.removeChannel(work); };
  }, [organizationId, hasDashboard, hasWork]);
  if (ended) return <main className="entry"><div className="entry-card"><h1>Workspace access ended.</h1><p>Returning to sign in…</p></div></main>;
  return <>
    {outdated && <div role="alert" style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 10000, maxWidth: 560, width: 'calc(100% - 32px)', border: '1px solid #c9a37d', borderRadius: 12, background: '#222126', color: '#fff', padding: '12px 16px', boxShadow: '0 8px 32px #0009' }}>
      <strong>OJ Workspace has been updated.</strong> Copy any unsaved text, then reload before recording more DMs or editing tasks.
      <button type="button" className="primary" onClick={() => window.location.reload()} style={{ marginLeft: 12 }}>Reload workspace</button>
    </div>}
    <App base="/workspace" dashboard={snapshot.dashboard} work={snapshot.work} partner={snapshot.role !== 'viewer'} connections={connections} mode="live" organizationId={organizationId} initial={snapshot.data} members={snapshot.members} readOnly={!available || outdated || snapshot.role === 'viewer'} owner={snapshot.role === 'owner'} displayName={snapshot.displayName} connectionStatus={outdated ? 'Workspace update detected. Reload required.' : status} limited={snapshot.limited} />
  </>;
}
