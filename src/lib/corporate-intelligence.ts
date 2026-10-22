import type { Card } from './board';
import type { Dashboard, ReportingSource } from './dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import type { VentureId } from './ventures';

export type IntelligenceCategory = 'Execution' | 'Pipeline' | 'Schedule' | 'Data integrity';
export type IntelligenceSeverity = 'urgent' | 'attention' | 'review' | 'informational';
export type IntelligenceSignal = {
  id: string;
  recordId?: string;
  category: IntelligenceCategory;
  severity: IntelligenceSeverity;
  business: VentureId | null;
  title: string;
  explanation: string;
  destination: string;
  source: string;
  date?: string;
  /** This is triage order only, not financial or probabilistic scoring. */
  order: number;
};
export type IntelligenceSnapshot = {
  signals: IntelligenceSignal[];
  totals: {
    openTasks: number;
    overdueTasks: number;
    dueToday: number;
    reviewTasks: number;
    unassignedTasks: number;
    upcomingExterior: number;
    pipelineNeedsReview: number;
    incompleteSources: number | null;
  };
  coverage: {
    boardRecords: number;
    sharedLeads: number | null;
    exteriorBookings: number;
    providers: 'reported' | 'not-supplied';
    completedExteriorJobs: number | null;
    exteriorCostsRecorded: number | null;
    exteriorRevenueRecorded: number | null;
  };
};
export type IntelligenceInput = {
  cards: Card[];
  dashboard: Dashboard | null;
  jobs: JobItem[];
  today: string;
};

export const intelligenceCategories: readonly IntelligenceCategory[] = ['Execution','Pipeline','Schedule','Data integrity'];
export const intelligenceSeverities: readonly IntelligenceSeverity[] = ['urgent','attention','review','informational'];

const dayOffset = (day: string, delta: number) => {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return '';
  return new Date(Date.UTC(year, month - 1, date + delta)).toISOString().slice(0, 10);
};
const dayAge = (recordDay: string, today: string): number => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(recordDay)) return -1;
  const a = Date.parse(recordDay + 'T00:00:00Z');
  const b = Date.parse(today + 'T00:00:00Z');
  return Number.isFinite(a) && Number.isFinite(b) ? Math.floor((b-a)/86400000) : -1;
};
const severityWeight: Record<IntelligenceSeverity, number> =
  { urgent: 0, attention: 1, review: 2, informational: 3 };

function providerSignals(source: ReportingSource): IntelligenceSignal | null {
  if (source.state === 'available') return null;
  return {
    id: 'source:'+source.id,
    category: 'Data integrity',
    severity: source.state === 'unavailable' ? 'attention' : 'review',
    business: source.id === 'exterior' ? 'exterior' : source.id === 'shopify' ? 'essentials' : source.id === 'ghl' ? 'solutions' : null,
    title: source.label + ' reporting: ' + source.state.replace('-', ' '),
    explanation: source.detail || 'Reporting is not confirmed available. Investigate the integration before relying on this source.',
    destination: '/settings',
    source: 'Workspace reporting status',
    order: 60,
  };
}

/**
 * Deterministic triage from the authorized workspace snapshot.
 * No predictions, model-generated facts, unobserved payments, or outbound effects.
 * Missing data is unknown; it is never treated as zero or "all clear".
 */
export function buildIntelligence(input: IntelligenceInput): IntelligenceSnapshot {
  const { cards, dashboard, jobs, today } = input;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || Number.isNaN(Date.parse(today + 'T00:00:00Z')) ||
      new Date(today + 'T00:00:00Z').toISOString().slice(0,10) !== today) {
    throw new Error('A valid corporate reporting date is required.');
  }
  const signals: IntelligenceSignal[] = [];
  const open = cards.filter(card => card.stage !== 'Done');
  const overdue = open.filter(card => card.due_date && card.due_date < today);
  const dueToday = open.filter(card => card.due_date === today);
  const review = open.filter(card => card.stage === 'Review');
  const unassigned = open.filter(card => !card.assignee.trim());

  for (const task of open) {
    let severity: IntelligenceSeverity;
    let title: string;
    let explanation: string;
    let order: number;
    if (task.due_date && task.due_date < today) {
      severity = 'urgent'; title = 'Overdue: ' + task.title;
      explanation = 'The task is due before today and remains in ' + task.stage + '. Owner: ' + (task.assignee || 'unassigned') + '.';
      order = 10;
    } else if (task.due_date === today) {
      severity = 'attention'; title = 'Due today: ' + task.title;
      explanation = 'A recorded deadline is today. Owner: ' + (task.assignee || 'unassigned') + '.';
      order = 20;
    } else if (task.stage === 'Review') {
      severity = 'attention'; title = 'Awaiting review: ' + task.title;
      explanation = 'The task is in Review; this does not imply an approval has been granted.';
      order = 30;
    } else if (!task.assignee.trim()) {
      severity = 'review'; title = 'Needs an owner: ' + task.title;
      explanation = 'This unfinished task has no recorded assignee.';
      order = 40;
    } else if (task.priority === 'high') {
      severity = 'review'; title = 'High-priority task: ' + task.title;
      explanation = 'Marked high priority on the task board, but no earlier deadline or review condition applies.';
      order = 45;
    } else {
      continue;
    }
    signals.push({
      id: 'task:'+task.id, recordId: task.id, business: task.business,
      category: 'Execution', severity, title, explanation,
      destination: '/tasks?task='+encodeURIComponent(task.id),
      source: 'Shared task board', date: task.due_date || undefined, order,
    });
  }

  let pipelineNeedsReview = 0;
  for (const lead of dashboard?.leads ?? []) {
    const age = dayAge(lead.created_at.slice(0,10),today);
    const watchNew = lead.stage === 'New' && age >= 7;
    const watchProposal = lead.stage === 'Proposal' && age >= 14;
    if (!watchNew && !watchProposal) continue;
    pipelineNeedsReview++;
    signals.push({
      id: 'lead:'+lead.id, recordId: lead.id,
      category: 'Pipeline', severity: 'review', business: lead.venture,
      title: watchNew ? 'Still marked New: ' + lead.name : 'Proposal stage review: ' + lead.name,
      explanation: watchNew
        ? 'This lead was created '+age+' days ago and remains marked New. Other channels may have been used; verify the stage before follow-up.'
        : 'This proposal-stage lead was originally created '+age+' days ago. Creation age does not establish how recently it was contacted.',
      destination: '/crm?lead='+encodeURIComponent(lead.id),
      source: 'Workspace CRM stage and creation date', order: watchNew?55:57,
    });
  }

  // Exactly seven calendar dates: today through day six, not eight inclusive dates.
  const inSeven = dayOffset(today,6);
  const upcoming = jobs.filter(job =>
    job.date >= today && job.date <= inSeven &&
    job.status !== 'denied' && job.status !== 'cancelled');
  for (const job of upcoming) {
    signals.push({
      id: 'booking:'+job.id, recordId: job.id,
      category: 'Schedule', severity: job.date === today ? 'attention' : 'informational',
      business: 'exterior',
      title: (job.date === today ? 'Today: ' : 'Upcoming: ') + job.name,
      explanation: (job.service || 'Service not recorded') + ' · ' + (job.time_block || 'Time block not recorded') + '. Booking status: ' + (job.status || 'not supplied') + '.',
      destination: '/b/exterior/calendar',
      source: 'Loaded Exterior Care bookings', date: job.date,
      order: job.date === today ? 25 : 80,
    });
  }

  const coverage = dashboard?.reporting?.exterior;
  const providers = dashboard?.reporting?.sources;
  if (coverage && coverage.jobs > 0) {
    if (coverage.costJobs < coverage.jobs) {
      signals.push({
        id:'exterior:cost-coverage', category:'Data integrity', severity:'attention', business:'exterior',
        title: (coverage.jobs-coverage.costJobs) + ' completed-job records missing costs',
        explanation: coverage.costJobs+' of '+coverage.jobs+' completed-job records have direct costs entered. Missing costs must not be counted as zero.',
        destination:'/b/exterior/jobs', source:'Exterior completed-job reporting coverage', order:35,
      });
    }
    if (coverage.revenueJobs < coverage.jobs) {
      signals.push({
        id:'exterior:revenue-coverage', category:'Data integrity', severity:'review', business:'exterior',
        title:(coverage.jobs-coverage.revenueJobs)+' completed-job records missing revenue entries',
        explanation:coverage.revenueJobs+' of '+coverage.jobs+' completed-job records have revenue amounts entered; this does not verify actual cash collection.',
        destination:'/b/exterior/jobs',source:'Exterior completed-job reporting coverage',order:50,
      });
    }
  }
  for (const source of providers ?? []) {
    const signal = providerSignals(source);
    if (signal) signals.push(signal);
  }

  signals.sort((a,b) =>
    severityWeight[a.severity]-severityWeight[b.severity] ||
    a.order-b.order ||
    (a.date ?? '9999').localeCompare(b.date ?? '9999') ||
    a.id.localeCompare(b.id));

  return {
    signals,
    totals: {
      openTasks: open.length,
      overdueTasks: overdue.length,
      dueToday: dueToday.length,
      reviewTasks: review.length,
      unassignedTasks: unassigned.length,
      upcomingExterior: upcoming.length,
      pipelineNeedsReview,
      incompleteSources: providers ? providers.filter(p => p.state !== 'available').length : null,
    },
    coverage: {
      boardRecords: cards.length,
      sharedLeads: dashboard ? dashboard.leads.length : null,
      exteriorBookings: jobs.length,
      providers: providers ? 'reported' : 'not-supplied',
      completedExteriorJobs: coverage?.jobs ?? null,
      exteriorCostsRecorded: coverage?.costJobs ?? null,
      exteriorRevenueRecorded: coverage?.revenueJobs ?? null,
    },
  };
}
