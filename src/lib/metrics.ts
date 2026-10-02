import type { VentureId } from './ventures';

// Figures a business reports once its data source is connected. `null` means
// "not connected yet": screens show what to connect, never a made-up number.
export type VentureMetrics = {
  revenueMtd: number;
  /** Percentage change against the previous period. */
  change: number;
  activeLeads: number;
  third: number;
  /** Revenue per month, oldest first, one entry per label in WorkspaceMetrics.months. */
  series: number[];
};

export type PipelineStage = { stage: 'New' | 'Contacted' | 'Qualified' | 'Proposal' | 'Won'; count: number };
export type ScheduleItem = { id: string; time: string; title: string; detail: string; venture: VentureId | 'shared' };
export type RecentFile = { id: string; name: string; kind: 'pdf' | 'doc' | 'sheet' | 'zip'; updated: string; venture: VentureId | 'shared' };
export type Note = { id: string; author: string; body: string; when: string };

export type WorkspaceMetrics = {
  months: string[];
  ventures: Record<VentureId, VentureMetrics | null>;
  pipeline: PipelineStage[] | null;
  schedule: ScheduleItem[] | null;
  files: RecentFile[] | null;
  notes: Note[] | null;
};

/** The live workspace before any data source is connected. */
export const unconnected: WorkspaceMetrics = {
  months: [], ventures: { exterior: null, solutions: null, essentials: null },
  pipeline: null, schedule: null, files: null, notes: null,
};

export const money = (value: number) =>
  value >= 10000 ? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K` : `$${Math.round(value).toLocaleString('en-US')}`;
