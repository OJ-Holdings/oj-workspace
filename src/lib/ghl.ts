import { dayKey } from './dashboard';

// What the workspace reads from the OJ Solutions GoHighLevel sub-account.
// Fetched on the server (ghl-server.ts); summarised here.

export type GhlContact = { id: string; name: string; company: string; type: string; tags: string[]; added: string };
export type GhlOpportunity = { id: string; name: string; value: number | null; status: string; stage: string; contact: string; updated: string };
export type GhlCall = { id: string; contact: string; direction: string; status: string; seconds: number | null; at: string };
export type GhlAppointment = { id: string; title: string; startsAt: string; endsAt: string; status: string; contactId: string; calendarId: string };
export type GhlData = { appointments: GhlAppointment[]; appointmentsConfigured: boolean; appointmentsError: boolean; contacts: GhlContact[]; contactsTotal: number; stages: string[]; opportunities: GhlOpportunity[]; opportunitiesTotal: number; calls: GhlCall[]; conversationsRead: number; conversationsTotal: number; fetchedAt: string };
export type GhlResult = { ok: true; data: GhlData } | { ok: false; reason: 'not-connected' | 'no-access' | 'failed' };

/** Open deals per pipeline stage, in the pipeline's own order, plus what has been won. A deal with no value adds nothing: it is not counted as zero dollars of certainty, just absent from the sum. */
export function summarisePipeline(data: Pick<GhlData, 'stages' | 'opportunities'>) {
  const open = data.opportunities.filter(o => o.status === 'open'), won = data.opportunities.filter(o => o.status === 'won');
  const value = (list: GhlOpportunity[]) => list.reduce((s, o) => s + (o.value ?? 0), 0);
  const names = [...data.stages, ...new Set(open.map(o => o.stage).filter(s => !data.stages.includes(s)))];
  return {
    openCount: open.length, openValue: value(open), wonCount: won.length, wonValue: value(won),
    stages: names.map(stage => { const list = open.filter(o => o.stage === stage); return { stage, count: list.length, value: value(list) }; }),
  };
}

/** Calls in the `days` ending today. Average length uses only calls that report a length. */
export function summariseCalls(calls: GhlCall[], now: Date, days = 30) {
  const from = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)));
  const recent = calls.filter(c => dayKey(new Date(c.at)) >= from);
  const timed = recent.filter(c => c.seconds !== null && c.seconds > 0);
  return {
    total: calls.length, recent: recent.length, inbound: recent.filter(c => c.direction === 'inbound').length,
    averageSeconds: timed.length ? Math.round(timed.reduce((s, c) => s + (c.seconds as number), 0) / timed.length) : null,
  };
}

export const callLength = (seconds: number | null) => seconds === null ? '-' : `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
