'use client';

import { useEffect, useState, useTransition } from 'react';
import { createBrowserClient } from '@supabase/ssr';
import { ojConnection } from '@/lib/oj-connection';
import type { Dashboard, DocumentItem, EventItem, FinanceEntry, Lead, Message, MetricEntry } from '@/lib/dashboard';
import { sampleDashboard } from '@/lib/sample';
import { addDocument, addFinance, addMessage, addMetric, createCalendarLink, documentUrl, removeRecord, saveEvent, saveLead } from '@/app/workspace/dashboard-actions';

type Kind = 'lead' | 'finance' | 'metric' | 'event' | 'document';
const listOf: Record<Kind, keyof Dashboard> = { lead: 'leads', finance: 'finance', metric: 'metricEntries', event: 'events', document: 'documents' };

/**
 * Messages, leads, money, metrics, events and documents, plus every way of
 * changing them. Preview mode keeps changes in this browser; live mode calls the
 * server actions and then applies the saved row.
 *
 * `data` is null while loading (preview, before the browser clock is known) or
 * when the live database does not have these tables yet (`missing` is true).
 */
export function useDashboard(initial: Dashboard | null | undefined, mode: 'preview' | 'live', org: string, author: string) {
  const [data, setData] = useState<Dashboard | null>(mode === 'live' ? initial ?? null : null);
  const [now, setNow] = useState<Date | null>(null);
  const [notice, setNotice] = useState('');
  const [pending, startTransition] = useTransition();
  useEffect(() => {
    const refreshClock = () => setNow(new Date());
    const timer = window.setInterval(refreshClock, 60_000);
    window.addEventListener('focus', refreshClock);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refreshClock); };
  }, []);

  // The sample workspace is dated from the visitor's clock, so it is built after load.
  useEffect(() => {
    const d = new Date(); setNow(d);
    if (mode !== 'preview') return;
    let sample = sampleDashboard(d);
    try {
      const saved = JSON.parse(localStorage.getItem('oj-preview-dashboard-v1') || 'null');
      if (saved && ['leads', 'finance', 'metricEntries', 'events', 'documents', 'messages'].every(key => Array.isArray(saved[key]))) sample = saved;
    } catch { /* Start with fictional records if local storage is unavailable. */ }
    setData(sample);
  }, [mode]);
  useEffect(() => {
    if (mode === 'preview' && data) {
      try { localStorage.setItem('oj-preview-dashboard-v1', JSON.stringify(data)); }
      catch { setNotice('Preview changes cannot be stored in this browser and may be lost on refresh.'); }
    }
  }, [mode, data]);
  useEffect(() => { if (mode === 'live') setData(initial ?? null); }, [initial, mode]);

  const patch = (fn: (d: Dashboard) => Dashboard) => setData(d => d ? fn(d) : d);
  const run = (label: string, work: () => Promise<void>) => startTransition(async () => {
    try { await work(); setNotice(label); }
    catch (e) { setNotice(e instanceof Error ? e.message : 'Something went wrong. Try again.'); }
  });
  const upsert = <T extends { id: string }>(list: T[], row: T, front = true) => list.some(r => r.id === row.id) ? list.map(r => r.id === row.id ? row : r) : front ? [row, ...list] : [...list, row];

  return {
    data, now, notice, pending, missing: mode === 'live' && data === null,
    sendMessage: (venture: Message['venture'], body: string, done: () => void) => run('Message sent.', async () => {
      const row = mode === 'preview' ? { id: crypto.randomUUID(), venture, body: body.trim(), author: 'You (preview)', created_at: new Date().toISOString() } : await addMessage(org, { venture, body });
      patch(d => ({ ...d, messages: [row, ...d.messages] })); done();
    }),
    saveLead: (lead: Omit<Lead, 'created_at'>, isNew: boolean, done?: () => void) => run('Lead saved.', async () => {
      const row = mode === 'preview' ? { ...lead, created_at: data?.leads.find(l => l.id === lead.id)?.created_at ?? new Date().toISOString() } : await saveLead(org, { ...lead, isNew });
      patch(d => ({ ...d, leads: upsert(d.leads, row) })); done?.();
    }),
    addFinance: (entry: Omit<FinanceEntry, 'id'>, done: () => void) => run('Entry saved.', async () => {
      const row = mode === 'preview' ? { ...entry, id: crypto.randomUUID() } : await addFinance(org, entry);
      patch(d => ({ ...d, finance: [row, ...d.finance].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)) })); done();
    }),
    addMetric: (entry: Omit<MetricEntry, 'id'>, done: () => void) => run('Number logged.', async () => {
      const row = mode === 'preview' ? { ...entry, id: crypto.randomUUID() } : await addMetric(org, entry);
      patch(d => ({ ...d, metricEntries: [row, ...d.metricEntries] })); done();
    }),
    saveEvent: (event: EventItem, isNew: boolean, done: () => void) => run('Event saved.', async () => {
      const row = mode === 'preview' ? event : await saveEvent(org, { ...event, isNew });
      patch(d => ({ ...d, events: upsert(d.events, row, false).sort((a, b) => a.starts_at.localeCompare(b.starts_at)) })); done();
    }),
    upload: (file: File, meta: { venture: DocumentItem['venture']; name: string; tag: DocumentItem['tag'] }, done: () => void) => run('Document uploaded.', async () => {
      if (file.size > 26214400) throw new Error('Files can be up to 25 MB.');
      let row: DocumentItem;
      if (mode === 'preview') {
        row = { id: crypto.randomUUID(), venture: meta.venture, name: meta.name || file.name, tag: meta.tag, storage_path: 'preview/local', size_bytes: file.size, mime: file.type, uploaded_by: author || 'You (preview)', created_at: new Date().toISOString() };
      } else {
        // The file goes straight from this browser to private storage under the workspace's own folder;
        // storage rules reject anyone who is not a member. The row is then recorded by the server.
        const safe = file.name.replace(/[^\w.\- ]+/g, '_').slice(-120);
        const path = `${org}/${crypto.randomUUID()}/${safe}`;
        const client = createBrowserClient(ojConnection.url, ojConnection.publishableKey);
        const { error } = await client.storage.from('oj-documents').upload(path, file, { contentType: file.type || undefined, upsert: false });
        if (error) throw new Error('The upload did not go through. Check your connection and try again.');
        row = await addDocument(org, { venture: meta.venture, name: meta.name || file.name, tag: meta.tag, storage_path: path, size_bytes: file.size, mime: file.type });
      }
      patch(d => ({ ...d, documents: [row, ...d.documents] })); done();
    }),
    open: (doc: DocumentItem) => run('', async () => {
      if (mode === 'preview') throw new Error('Sample documents have no file behind them.');
      window.open(await documentUrl(org, doc.id), '_blank', 'noopener');
    }),
    remove: (kind: Kind, id: string) => run('Removed.', async () => {
      if (mode === 'live') await removeRecord(org, kind, id);
      patch(d => ({ ...d, [listOf[kind]]: (d[listOf[kind]] as { id: string }[]).filter(r => r.id !== id) }));
    }),
    calendarLink: async () => {
      if (mode === 'preview') throw new Error('The calendar link is created in your live workspace.');
      return createCalendarLink(org);
    },
  };
}

export type DashboardStore = ReturnType<typeof useDashboard>;
