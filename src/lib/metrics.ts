import type { VentureId } from './ventures';

// Figures the Home screen shows. They are always derived from real records
// (see deriveMetrics in dashboard.ts). `null` means there is nothing to report
// yet: screens then say what to log or connect, never a made-up number.
export type VentureMetrics = {
  revenueMtd: number;
  /** Percentage change against last month; null when last month had no revenue to compare with. */
  change: number | null;
  activeLeads: number;
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

export const money = (value: number) =>
  value >= 10000 ? `$${(value / 1000).toFixed(value % 1000 === 0 ? 0 : 1)}K` : `$${Math.round(value).toLocaleString('en-US')}`;
export const dollars = (value: number) => value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value % 1 === 0 ? 0 : 2 });
