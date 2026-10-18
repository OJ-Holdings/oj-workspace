import type { ExteriorData, ExtLead } from './exterior';
import { businessDay } from './reporting';

/** Fictional preview-only records. Never sent to a mutation or merged into live records. */
export function sampleExterior(now: Date): ExteriorData {
  const date = (ago: number) => businessDay(new Date(now.getTime() - ago * 86400000).toISOString())!;
  const iso = (ago: number) => `${date(ago)}T17:00:00Z`;
  const lead = (id: string, name: string, patch: Partial<ExtLead>): ExtLead => ({ id, name, phone: null, address: 'Fictional preview address', service_requested: 'House Washing', quote_amount: 400, status: 'completed', source: 'Referral', notes: 'Fictional preview record', job_revenue: null, job_cost: null, created_at: iso(45), updated_at: iso(1), completed_at: iso(1), ...patch });
  const leads = [
    lead('sample-ext-1', 'Sample: Maple residence', { job_revenue: 400, job_cost: 65 }),
    lead('sample-ext-2', 'Sample: Lakeview home', { job_revenue: 600, quote_amount: 600, source: 'dtd', completed_at: iso(2) }),
    lead('sample-ext-3', 'Sample: Cedar driveway', { service_requested: 'Driveway Cleaning', quote_amount: 250, job_cost: 30, source: 'Facebook', completed_at: iso(3) }),
    lead('sample-ext-4', 'Sample: Harbour storefront', { service_requested: 'Window Cleaning', quote_amount: 180, job_revenue: 180, job_cost: 0, completed_at: iso(32) }),
    lead('sample-ext-5', 'Sample: Birch property', { job_revenue: 320, quote_amount: 320, completed_at: null, updated_at: iso(35), source: 'dtd' }),
    lead('sample-ext-6', 'Sample: Northfield enquiry', { status: 'following_up', completed_at: null, updated_at: iso(9), quote_amount: 450 }),
    lead('sample-ext-7', 'Sample: Garden terrace', { status: 'booked', completed_at: null, service_requested: 'Deck Cleaning', quote_amount: 300 }),
  ];
  return {
    leads,
    bookings: [{ id: 'sample-booking', lead_id: 'sample-ext-7', date: date(-1), time_block: '10-12', status: 'confirmed' }],
    sessions: [{ id: 'sample-door', session_date: date(2), knocked_by: 'Sample crew', area: 'Sample north district', doors_knocked: 40, answers: 12, interested: 6, quotes_given: 3, jobs_scheduled: 1, job_total: 600, notes: 'Fictional preview session' }],
    activity: [{ id: 'sample-activity', operator: 'Sample crew', action: 'status_changed', description: 'Completed the Maple residence sample job', lead_name: 'Sample: Maple residence', created_at: iso(1) }],
    extras: { goal: 3000, upgrades: {}, quotes: [], settings: {} },
    coverage: { leads: { loaded: leads.length, total: leads.length }, bookings: { loaded: 1, total: 1 }, sessions: { loaded: 1, total: 1 } },
  };
}
