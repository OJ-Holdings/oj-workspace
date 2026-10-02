'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { App } from '@/components/app/App';
import type { Connections } from '@/components/app/Pages';
import type { WorkspaceSnapshot } from '@/lib/board';
import { ojConnection } from '@/lib/oj-connection';
export function LiveWorkspace({ organizationId, initial, connections }: { organizationId: string; initial: WorkspaceSnapshot; connections: Connections }) {
  const [snapshot, setSnapshot] = useState(initial);
  const [status, setStatus] = useState('Connecting shared updates…');
  const [available, setAvailable] = useState(true);
  const [ended, setEnded] = useState(false);
  const hasDashboard = snapshot.dashboard !== null;
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
    const auth = client.auth.onAuthStateChange(event => {
      if (event === 'SIGNED_OUT' && !disposed) { setEnded(true); window.location.replace('/login'); }
    });
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 15000);
    const onFocus = () => { void refresh(); };
    const onOffline = () => { setAvailable(false); setStatus('You are offline. Editing paused; reconnecting…'); };
    window.addEventListener('offline', onOffline); window.addEventListener('online', onFocus);
    window.addEventListener('focus', onFocus); document.addEventListener('visibilitychange', onFocus); void refresh();
    return () => { disposed = true; controller.abort(); window.clearInterval(timer); window.removeEventListener('offline', onOffline); window.removeEventListener('online', onFocus); window.removeEventListener('focus', onFocus); document.removeEventListener('visibilitychange', onFocus); auth.data.subscription.unsubscribe(); void client.removeChannel(channel); if (extra) void client.removeChannel(extra); };
  }, [organizationId, hasDashboard]);
  if (ended) return <main className="entry"><div className="entry-card"><h1>Workspace access ended.</h1><p>Returning to sign in…</p></div></main>;
  return <App base="/workspace" dashboard={snapshot.dashboard} connections={connections} mode="live" organizationId={organizationId} initial={snapshot.data} members={snapshot.members} readOnly={!available || snapshot.role === 'viewer'} owner={snapshot.role === 'owner'} displayName={snapshot.displayName} connectionStatus={status} limited={snapshot.limited} />;
}
