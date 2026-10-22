import type { Dashboard } from './dashboard';
import type { Card } from './board';
import type { JobItem } from '@/app/workspace/exterior-actions';
import type { VentureId } from './ventures';

export type SearchRecord = { id: string; kind: 'Task' | 'Lead' | 'Booking' | 'Document' | 'Message' | 'Event'; title: string; detail: string; path: string; venture: VentureId | null };
/** Search only records already authorized and loaded for this workspace. */
export function searchWorkspace(query: string, cards: Card[], dashboard?: Dashboard | null, jobs: JobItem[] = []): SearchRecord[] {
  const q = query.trim().toLocaleLowerCase('en-US');
  if (!q) return [];
  const contains = (...values: (string | null | undefined)[]) => values.join(' ').toLocaleLowerCase('en-US').includes(q);
  return [
    ...cards.filter(c => contains(c.title, c.description, c.assignee)).map(c => ({ id: c.id, kind: 'Task' as const, title: c.title, detail: `${c.stage}${c.assignee ? ` / ${c.assignee}` : ''}`, path: `/tasks?task=${encodeURIComponent(c.id)}`, venture: c.business })),
    ...jobs.filter(j => j.status !== 'cancelled' && j.status !== 'denied' &&
      contains(j.name, j.service, j.address, j.date, j.status))
      .map(j => ({ id: j.id, kind: 'Booking' as const, title: j.name,
        detail: j.date+' / '+(j.service || 'Service not recorded'),
        path: '/b/exterior/calendar', venture: 'exterior' as const })),
    ...(dashboard?.leads ?? []).filter(l => contains(l.name, l.contact, l.notes, l.source)).map(l => ({ id: l.id, kind: 'Lead' as const, title: l.name, detail: `${l.stage} / ${l.contact || 'Contact not recorded'}`, path: `/crm?lead=${encodeURIComponent(l.id)}`, venture: l.venture })),
    ...(dashboard?.documents ?? []).filter(d => contains(d.name, d.tag)).map(d => ({ id: d.id, kind: 'Document' as const, title: d.name, detail: d.tag, path: `/files?document=${encodeURIComponent(d.id)}`, venture: d.venture })),
    ...(dashboard?.messages ?? []).filter(m => contains(m.body, m.author)).map(m => ({ id: m.id, kind: 'Message' as const, title: m.body.slice(0, 100), detail: m.author, path: `/messages?message=${encodeURIComponent(m.id)}`, venture: m.venture })),
    ...(dashboard?.events ?? []).filter(e => contains(e.title, e.location, e.notes)).map(e => ({ id: e.id, kind: 'Event' as const, title: e.title, detail: e.location || e.starts_at.slice(0, 10), path: `/calendar?event=${encodeURIComponent(e.id)}`, venture: e.venture })),
  ].slice(0, 30);
}
