import type { Card } from './board';
import { ventureIds, type VentureId } from './ventures';
import type { WorkspaceMetrics } from './metrics';

// The records behind every page except the task board. Shapes match
// supabase/schemas/dashboard.sql; dates are ISO strings.
export const leadStages = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won', 'Lost'] as const;
export type LeadStage = typeof leadStages[number];
export const documentTags = ['legal', 'insurance', 'tax', 'contract', 'brand', 'other'] as const;
export type DocumentTag = typeof documentTags[number];

export type Message = { id: string; venture: VentureId | null; author: string; body: string; created_at: string };
export type Lead = { id: string; venture: VentureId; name: string; contact: string; stage: LeadStage; value: number | null; source: string; notes: string; created_at: string };
/** `auto` names the connected system an entry came from (a paid Exterior Care job, a Shopify order); those are not stored in the workspace and cannot be removed here. */
export type FinanceEntry = { id: string; venture: VentureId; kind: 'revenue' | 'cost'; amount: number; occurred_on: string; category: string; note: string; auto?: string; dateBasis?: 'completion' | 'updated-estimate' | 'created-estimate' | 'order-created' };
export type ReportingSource = { id: 'exterior' | 'shopify' | 'ghl' | 'mercury'; label: string; state: 'available' | 'partial' | 'unavailable' | 'not-connected'; detail: string };
export type ReportingCoverage = { sources: ReportingSource[]; exterior: { jobs: number; revenueJobs: number; costJobs: number; matchedJobs: number; estimatedDateJobs: number } };
export type MercuryAccount = { id: string; name: string; currentBalance: number | null; availableBalance: number | null; currency: string; status: string };
export type MercuryTransaction = { id: string; accountName: string; amount: number; currency: string; status: string; description: string; postedAt: string | null; createdAt: string; kind: string };
/** Private, read-only bank snapshot. Deliberately separate from finance entries: deposits and transfers are not necessarily revenue. */
export type MercurySnapshot = { state: 'available' | 'partial' | 'unavailable' | 'not-connected'; detail: string; accounts: MercuryAccount[]; transactions: MercuryTransaction[]; checkedAt: string };
export type MetricEntry = { id: string; venture: VentureId; label: string; value: number; unit: string; measured_on: string; note: string };
export type EventItem = { id: string; venture: VentureId | null; title: string; starts_at: string; ends_at: string | null; all_day: boolean; location: string; notes: string; /** Set when an outside calendar owns the event: shown, but not editable here. */ source?: string | null };
export type DocumentItem = { id: string; venture: VentureId | null; name: string; tag: DocumentTag; storage_path: string; size_bytes: number; mime: string; uploaded_by: string; created_at: string };
export type Dashboard = { messages: Message[]; leads: Lead[]; finance: FinanceEntry[]; metricEntries: MetricEntry[]; events: EventItem[]; documents: DocumentItem[]; reporting?: ReportingCoverage; /** Present only in the owner-authenticated snapshot. */ mercury?: MercurySnapshot; /** Open leads held in a connected system rather than in the workspace's own pipeline. */ openElsewhere?: Partial<Record<VentureId, number>> };
export const emptyDashboard: Dashboard = { messages: [], leads: [], finance: [], metricEntries: [], events: [], documents: [] };

export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const monthKey = (d: Date) => dayKey(d).slice(0, 7);

/** The last twelve calendar months ending with `now`, oldest first. */
export function lastMonths(now: Date, count = 12) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
    return { key: monthKey(d), label: d.toLocaleDateString('en-US', { month: 'short' }) };
  });
}

/** Revenue (or costs) per month for one business, aligned to lastMonths(). */
export function monthlyTotals(finance: FinanceEntry[], venture: VentureId, kind: 'revenue' | 'cost', now: Date) {
  return lastMonths(now).map(m => finance.filter(f => f.venture === venture && f.kind === kind && f.occurred_on.startsWith(m.key)).reduce((sum, f) => sum + f.amount, 0));
}

/**
 * Turns the workspace's own records into the figures the Home screen shows.
 * Nothing is estimated: a business with no logged revenue and no leads reports
 * `null`, and the screen says what to log or connect.
 */
/** A booked Exterior Care job, reduced to what the schedule needs. */
export type ScheduleJob = { id: string; date: string; startMinutes: number; timeLabel: string; name: string; service: string | null };

export function deriveMetrics(dashboard: Dashboard, cards: Card[], now: Date, jobs: ScheduleJob[] = []): WorkspaceMetrics {
  const months = lastMonths(now);
  const today = dayKey(now);
  const ventures = Object.fromEntries(ventureIds.map(id => {
    const revenue = dashboard.finance.some(f => f.venture === id && f.kind === 'revenue');
    const leads = dashboard.leads.filter(l => l.venture === id);
    const elsewhere = dashboard.openElsewhere?.[id] ?? 0;
    if (!revenue && leads.length === 0 && elsewhere === 0) return [id, null];
    const series = monthlyTotals(dashboard.finance, id, 'revenue', now);
    const current = series[series.length - 1], previous = series[series.length - 2];
    return [id, {
      revenueMtd: current,
      change: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null,
      activeLeads: leads.filter(l => l.stage !== 'Won' && l.stage !== 'Lost').length + elsewhere,
      series,
    }];
  })) as WorkspaceMetrics['ventures'];

  const stages = ['New', 'Contacted', 'Qualified', 'Proposal', 'Won'] as const;
  const todaysEvents = dashboard.events.filter(e => dayKey(new Date(e.starts_at)) === today).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  const dueToday = cards.filter(c => c.due_date === today && c.stage !== 'Done');
  const todaysJobs = jobs.filter(j => j.date === today);
  const eventRows = todaysEvents.map(e => ({ id: e.id, time: e.all_day ? 'All day' : new Date(e.starts_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false }), title: e.title, detail: e.location || e.notes || 'Event', venture: e.venture ?? 'shared' as const }));
  const jobRows = todaysJobs.map(j => ({ id: `job-${j.id}`, time: `${String(Math.floor(j.startMinutes / 60)).padStart(2, '0')}:${String(j.startMinutes % 60).padStart(2, '0')}`, title: j.name, detail: `${j.service || 'Job'} / ${j.timeLabel}`, venture: 'exterior' as const }));
  // All-day items first, then everything with a time in order.
  const dayRows = [...eventRows, ...jobRows].sort((a, b) => (a.time === 'All day' ? -1 : 0) - (b.time === 'All day' ? -1 : 0) || a.time.localeCompare(b.time));
  return {
    months: months.map(m => m.label),
    ventures,
    pipeline: dashboard.leads.length ? stages.map(stage => ({ stage, count: dashboard.leads.filter(l => l.stage === stage).length })) : null,
    schedule: dayRows.length || dueToday.length ? [
      ...dayRows,
      ...dueToday.map(c => ({ id: c.id, time: 'Due', title: c.title, detail: `Task / ${c.stage}`, venture: c.business })),
    ] : null,
    files: dashboard.documents.length ? dashboard.documents.slice(0, 4).map(d => ({ id: d.id, name: d.name, kind: fileKind(d.mime, d.name), updated: relativeDay(d.created_at, now), venture: d.venture ?? 'shared' as const })) : null,
    notes: dashboard.messages.length ? dashboard.messages.slice(0, 3).map(m => ({ id: m.id, author: m.author, body: m.body, when: relativeDay(m.created_at, now) })) : null,
  };
}

export function fileKind(mime: string, name: string): 'pdf' | 'doc' | 'sheet' | 'zip' {
  const n = name.toLowerCase();
  if (mime.includes('pdf') || n.endsWith('.pdf')) return 'pdf';
  if (mime.includes('sheet') || mime.includes('excel') || /\.(xlsx?|csv)$/.test(n)) return 'sheet';
  if (mime.includes('zip') || /\.(zip|rar|7z)$/.test(n)) return 'zip';
  return 'doc';
}

export function relativeDay(iso: string, now: Date) {
  const then = new Date(iso);
  const days = Math.round((new Date(dayKey(now)).getTime() - new Date(dayKey(then)).getTime()) / 86400000);
  if (days <= 0) return then.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  return then.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function fileSize(bytes: number) {
  return bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

/** An iCalendar file for calendar apps. Lines are CRLF-terminated and text is escaped per RFC 5545. */
export function toICS(rows: { id: string; title: string; starts_at: string; ends_at: string | null; all_day: boolean; location: string; notes: string; venture: string | null }[], now: Date) {
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1');
  const stamp = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const dateOnly = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//OJ Workspace//Shared calendar//EN', 'CALSCALE:GREGORIAN', 'X-WR-CALNAME:OJ Workspace', 'REFRESH-INTERVAL;VALUE=DURATION:PT1H'];
  for (const r of rows) {
    const start = new Date(r.starts_at);
    lines.push('BEGIN:VEVENT', `UID:${r.id}@oj-workspace`, `DTSTAMP:${stamp(now)}`);
    if (r.all_day) {
      const next = new Date(start.getTime() + 86400000);
      lines.push(`DTSTART;VALUE=DATE:${dateOnly(start)}`, `DTEND;VALUE=DATE:${dateOnly(next)}`);
    } else {
      lines.push(`DTSTART:${stamp(start)}`, `DTEND:${stamp(r.ends_at ? new Date(r.ends_at) : new Date(start.getTime() + 3600000))}`);
    }
    lines.push(`SUMMARY:${esc(r.title)}`);
    if (r.location) lines.push(`LOCATION:${esc(r.location)}`);
    if (r.notes) lines.push(`DESCRIPTION:${esc(r.notes)}`);
    if (r.venture) lines.push(`CATEGORIES:${esc(r.venture)}`);
    lines.push('END:VEVENT');
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
