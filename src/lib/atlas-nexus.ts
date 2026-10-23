import type { Activity, Card } from './board';
import type { JobItem } from '@/app/workspace/exterior-actions';
import type { CommercialPortfolio, CommercialProject } from './atlas-commercial-portfolio';
import { projectEquipmentEvidence } from './atlas-commercial-portfolio';
import { calculateEstimate } from './commercial-estimate';
import { emptyFieldCrewPlan, fieldCrewCapacity, type CrewCapacity } from './atlas-field-mission';
import { validDay, type FleetWorkbook } from './fleet-command';
import { exactLocalProjectIds } from './atlas-task-handoff';
import type { LoadedBookingState } from './atlas-fleet-dispatch-plan';

/** NEXUS v1: a PURE READ-ONLY projection across already-accessible sources.
 * Project and Fleet IDs belong to this browser, not a shared canonical database.
 * Booking IDs come from currently loaded, authorized Exterior source results.
 * Task association is an exact textual receipt, not a relational foreign key.
 * This module NEVER writes state or converts a plan into a booking/approval.
 */
export type NexusEvidence = 'loaded-source' | 'local-entered' | 'textual-receipt' | 'unverified';
export type NexusRelation = {
  id: string; kind: 'booking' | 'asset' | 'task'; sourceId: string | null;
  title: string; evidence: NexusEvidence;
  detail: string; target: 'bookings' | 'fleet' | 'tasks';
};
export type NexusFlag = {
  id: string; severity: 'attention' | 'review' | 'unknown';
  title: string; detail: string;
};
export type NexusTask = {
  id: string; title: string; stage: Card['stage']; priority: Card['priority'];
  dueDate: string; assignee: string;
};
export type NexusActivity = {
  id: string; actor: string; action: Activity['action'];
  taskId: string; taskTitle: string; timestamp: string;
};
export type NexusBooking = {
  status: 'unlinked' | 'loading' | 'source-failed' | 'not-in-loaded-source' | 'inactive' | 'loaded-active';
  id: string | null; date: string | null; timeBlock: string | null;
  recordedStatus: string | null;
};
export type NexusProject = {
  id: string; name: string; phase: CommercialProject['phase'];
  revision: number; updatedAt: string;
  scope: { buildings: number; panes: number; paidCrewHours: number; liftDays: number };
  crew: CrewCapacity;
  booking: NexusBooking;
  assets: { id: string; name: string; state: string }[];
  tasks: NexusTask[]; relations: NexusRelation[];
  activity: NexusActivity[];
  findings: NexusFlag[];
};
export type NexusGraph = {
  projects: NexusProject[];
  sources: {
    commercial: 'device-local-validated';
    fleet: 'device-local-validated' | 'missing-or-unverified';
    bookings: LoadedBookingState;
    tasks: 'loaded-workspace-snapshot';
    activity: 'loaded-workspace-snapshot' | 'no-source-events-loaded';
  };
  totals: {
    projects: number; scopedBuildings: number;
    exactLoadedBookingLinks: number; localAssetCandidates: number;
    taskReceiptLinks: number; sourceActivityEvents: number;
    attentionFlags: number; unknownSourceFlags: number;
  };
  taskOrphans: number;
};

const activityActions = ['card_created', 'card_updated', 'comment_added'] as const;
const activeBooking = (job: JobItem): boolean =>
  job.status !== 'cancelled' && job.status !== 'denied' && validDay(job.date);
const containsReceipt = (card: Card, projectId: string): boolean =>
  exactLocalProjectIds(card.description).includes(projectId);

const priority = (flag: NexusFlag): number =>
  flag.severity === 'attention' ? 0 : flag.severity === 'unknown' ? 1 : 2;

function projectedBooking(
  project: CommercialProject, jobs: readonly JobItem[], state: LoadedBookingState,
): NexusBooking {
  const id = project.bookingId;
  if (!id) return { status: 'unlinked', id: null, date: null, timeBlock: null, recordedStatus: null };
  if (state === 'loading') return { status: 'loading', id, date: null, timeBlock: null, recordedStatus: null };
  if (state === 'failed') return { status: 'source-failed', id, date: null, timeBlock: null, recordedStatus: null };
  const found = jobs.find(job => job.id.toLowerCase() === id.toLowerCase());
  if (!found) return { status: 'not-in-loaded-source', id, date: null, timeBlock: null, recordedStatus: null };
  if (!activeBooking(found)) return {
    status: 'inactive', id, date: null, timeBlock: null, recordedStatus: found.status,
  };
  return {
    status: 'loaded-active', id, date: found.date,
    timeBlock: found.time_block || null, recordedStatus: found.status,
  };
}

function projectGraph(
  project: CommercialProject, all: readonly CommercialProject[],
  fleet: FleetWorkbook | null, jobs: readonly JobItem[],
  state: LoadedBookingState, cards: readonly Card[], activity: readonly Activity[],
  org: string, day: string,
): NexusProject {
  const booking = projectedBooking(project, jobs, state);
  const totals = calculateEstimate(project.input);
  const crew = fieldCrewCapacity(project.input, project.fieldCrewPlan ?? emptyFieldCrewPlan());
  const assets = projectEquipmentEvidence(project, fleet, day);
  const linked = cards.filter(card => card.organization_id === org &&
    card.business === 'exterior' && containsReceipt(card, project.id));
  const tasks: NexusTask[] = linked.map(card => ({
    id: card.id, title: card.title, stage: card.stage, priority: card.priority,
    dueDate: card.due_date, assignee: card.assignee,
  }));
  const taskIds = new Set(tasks.map(t => t.id));
  const taskTitle = new Map(tasks.map(t => [t.id, t.title]));
  const taskActivity: NexusActivity[] = activity
    .filter(a => taskIds.has(a.card_id) && activityActions.includes(a.action))
    .map(a => ({
      id: a.id, actor: a.actor, action: a.action, taskId: a.card_id,
      taskTitle: taskTitle.get(a.card_id) ?? 'Task record', timestamp: a.created_at,
    })).sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 25);

  const relations: NexusRelation[] = [{
    id: 'booking', kind: 'booking', sourceId: booking.id,
    title: booking.status === 'loaded-active' ? 'Exact loaded Exterior booking' : 'Booking source unresolved',
    evidence: booking.status === 'loaded-active' ? 'loaded-source' :
      booking.status === 'unlinked' ? 'unverified' : 'local-entered',
    detail: booking.status === 'loaded-active'
      ? 'Exact ID from the currently loaded Exterior booking source; status may change.'
      : 'Unverified or absent link; not evidence of scheduled work.',
    target: 'bookings',
  }];
  for (const asset of assets) relations.push({
    id: 'asset:' + asset.id, kind: 'asset', sourceId: asset.id, title: asset.name,
    evidence: fleet && asset.state !== 'missing' ? 'local-entered' : 'unverified',
    detail: fleet && asset.state !== 'missing'
      ? 'Local equipment record; candidate only, never reserved or dispatched.'
      : 'Entered asset ID cannot be resolved on this device.',
    target: 'fleet',
  });
  for (const task of tasks) relations.push({
    id: 'task:' + task.id, kind: 'task', sourceId: task.id, title: task.title,
    evidence: 'textual-receipt',
    detail: 'Shared task is loaded; its body contains an exact local project-ID text receipt, not a canonical database link.',
    target: 'tasks',
  });

  const findings: NexusFlag[] = [];
  const add = (id: string, severity: NexusFlag['severity'], title: string, detail: string) => {
    findings.push({ id, severity, title, detail });
  };
  if (booking.status === 'inactive') add('booking-inactive', 'attention',
    'Booking cannot support a dispatch plan',
    'The linked Exterior source booking is cancelled, denied, or missing a valid date.');
  else if (booking.status === 'source-failed' || booking.status === 'loading' || booking.status === 'not-in-loaded-source')
    add('booking-unverified', 'unknown', 'Booking source not verified',
      'Loaded coverage is insufficient to establish a booking date, status or actual job.');
  else if (booking.status === 'unlinked')
    add('booking-unlinked', 'unknown', 'No exact booking relationship',
      'This local project has no source booking ID; it is not scheduled work.');
  if (crew.state === 'shortfall') add('crew-shortfall', 'attention',
    'Modeled paid crew-hour shortfall',
    'Entered workforce capacity is ' + Math.abs(crew.capacityGapHours ?? 0) +
      ' paid hours below the project estimate; no actual staffing is confirmed.');
  else if (crew.state === 'not-modeled' || crew.state === 'no-labor-entered')
    add('crew-unknown', 'unknown', 'Workforce coverage is unverified',
      'Crew, productivity or paid-labor inputs are incomplete; zero is not assumed.');
  const access = project.input.sites.filter(site => site.access === 'review').length;
  if (access) add('access-review', 'attention', 'Access assessment pending',
    access + ' site(s) still have an unresolved access method.');
  const lift = project.input.sites.filter(site => site.access === 'lift' && site.liftDays === 0).length;
  if (lift) add('lift-assumptions', 'attention', 'Lift days omitted',
    lift + ' lift-access site(s) have no planned rental days. No provider reservation has been made.');
  if (!fleet && project.plannedAssetIds.length)
    add('fleet-unavailable', 'unknown', 'Fleet workbook unavailable',
      'Candidate asset IDs cannot be reconciled on this device.');
  if (!project.plannedAssetIds.length)
    add('no-assets', 'unknown', 'No equipment plan recorded',
      'The local project contains no candidate equipment. No availability is implied.');
  for (const asset of assets) {
    if (asset.state === 'out-of-service' || asset.state === 'needs-service' || asset.state === 'due')
      add('asset:' + asset.id, 'attention', 'Asset requires service review',
        asset.name + ' is recorded ' + asset.state + ' on this device.');
    else if (asset.state === 'missing' || asset.state === 'unverified')
      add('asset:' + asset.id, 'unknown', 'Asset condition not established',
        asset.name + ' has no currently validated service-ready evidence.');
    else if (asset.state === 'due-soon')
      add('asset:' + asset.id, 'review', 'Asset approaching service',
        asset.name + ' is close to a manually entered threshold.');
  }
  if (booking.status === 'loaded-active' && booking.date) {
    const competing = all.filter(other => other.id !== project.id && other.phase !== 'archived' &&
      other.bookingId && other.bookingId !== booking.id);
    const overlap = new Set<string>();
    for (const other of competing) {
      const otherBooking = projectedBooking(other, jobs, state);
      if (otherBooking.status !== 'loaded-active' || otherBooking.date !== booking.date) continue;
      for (const assetId of project.plannedAssetIds) {
        if (other.plannedAssetIds.includes(assetId)) overlap.add(assetId);
      }
    }
    if (overlap.size) add('same-day-assets', 'review', 'Possible candidate-equipment contention',
      overlap.size + ' asset ID(s) also appear on another project with a different booking on the same date. Actual time overlap has not been established.');
  }
  if (project.phase === 'founder-review') add('founder-review', 'review', 'Internal founder review requested',
    'A local review stage is not a signed quote or founder approval.');
  if (project.review.some(x => !x)) add('preproposal', 'review', 'Commercial internal review incomplete',
    project.review.filter(Boolean).length + ' of ' + project.review.length +
      ' checklist items were marked; this is not contract approval.');
  if (validDay(day)) {
    const overdue = tasks.filter(t => t.dueDate && validDay(t.dueDate) &&
      t.dueDate < day && t.stage !== 'Done').length;
    if (overdue) add('tasks-overdue', 'attention', 'Linked task deadlines passed',
      overdue + ' loaded shared task(s) have a due date earlier than the current planning day.');
  }
  findings.sort((a, b) => priority(a) - priority(b) || a.title.localeCompare(b.title));

  return {
    id: project.id, name: project.name, phase: project.phase, revision: project.revision,
    updatedAt: project.updatedAt,
    scope: { buildings: totals.sites, panes: totals.panes,
      paidCrewHours: totals.crewHours, liftDays: totals.liftDays },
    crew, booking, assets, tasks, relations, activity: taskActivity, findings,
  };
}

export function buildNexusGraph(args: {
  org: string; portfolio: CommercialPortfolio;
  fleet: FleetWorkbook | null;
  bookings: readonly JobItem[]; bookingsState: LoadedBookingState;
  cards: readonly Card[]; activity: readonly Activity[]; day: string;
}): NexusGraph {
  const { org, portfolio, fleet, bookings, bookingsState, day } = args;
  if (portfolio.organizationId !== org || (fleet && fleet.organizationId !== org))
    throw new Error('Cross-organization project graph cannot be constructed.');
  const cards = args.cards.filter(card => card.organization_id === org);
  const allowedIds = new Set(cards.map(c => c.id));
  const activity = args.activity.filter(a => allowedIds.has(a.card_id));
  const authorizedJobs = bookingsState === 'ready' ? bookings : [];
  const projects = portfolio.projects.map(project => projectGraph(
    project, portfolio.projects, fleet, authorizedJobs, bookingsState, cards,
    activity, org, day,
  )).sort((a, b) =>
    Number(a.phase === 'archived') - Number(b.phase === 'archived') ||
    b.findings.filter(f => f.severity === 'attention').length -
      a.findings.filter(f => f.severity === 'attention').length ||
    b.updatedAt.localeCompare(a.updatedAt));
  const linkedTaskIds = new Set(projects.flatMap(p => p.tasks.map(t => t.id)));
  return {
    projects,
    sources: {
      commercial: 'device-local-validated',
      fleet: fleet ? 'device-local-validated' : 'missing-or-unverified',
      bookings: bookingsState,
      tasks: 'loaded-workspace-snapshot',
      activity: activity.length ? 'loaded-workspace-snapshot' : 'no-source-events-loaded',
    },
    totals: {
      projects: projects.length,
      scopedBuildings: projects.reduce((n, p) => n + p.scope.buildings, 0),
      exactLoadedBookingLinks: projects.filter(p => p.booking.status === 'loaded-active').length,
      localAssetCandidates: projects.reduce((n, p) => n + p.assets.length, 0),
      taskReceiptLinks: projects.reduce((n, p) => n + p.tasks.length, 0),
      sourceActivityEvents: projects.reduce((n, p) => n + p.activity.length, 0),
      attentionFlags: projects.reduce((n, p) => n + p.findings.filter(f => f.severity === 'attention').length, 0),
      unknownSourceFlags: projects.reduce((n, p) => n + p.findings.filter(f => f.severity === 'unknown').length, 0),
    },
    taskOrphans: cards.filter(c => c.business === 'exterior' &&
      exactLocalProjectIds(c.description).length > 0 && !linkedTaskIds.has(c.id)).length,
  };
}
