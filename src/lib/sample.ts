import type { BoardData, Card } from './board';
import { dayKey, type Dashboard } from './dashboard';
import type { VentureId } from './ventures';

// Everything in this file is fictional and is shown only at /preview, where the
// screen is labelled "Sample workspace". Live screens never read it.
const today = () => new Date().toISOString().slice(0, 10);
const base: Omit<Card, 'id' | 'title' | 'business' | 'stage' | 'description'> = { organization_id: 'preview', priority: 'normal', assignee: '', due_date: '', revision: 0, checklist: [] };
export const sampleData: BoardData = {
  cards: [
    { ...base, id: 'sample-1', title: 'Prepare a recurring window-care offer', description: 'Sample project: outline the service, visit frequency, and information needed for a quote.', business: 'exterior', stage: 'Ready', priority: 'high', assignee: 'Oscar', due_date: today(), checklist: [{ id: '1', text: 'Define the visit checklist', done: true }, { id: '2', text: 'Draft the offer', done: false }] },
    { ...base, id: 'sample-2', title: 'Finish the field closeout checklist', description: 'Capture crew time, payment status, materials, and the next recommended service.', business: 'exterior', stage: 'In progress', assignee: 'Jacob', checklist: [{ id: '1', text: 'Choose the required fields', done: true }, { id: '2', text: 'Try the form on a phone', done: false }] },
    { ...base, id: 'sample-3', title: 'Review the next outreach draft', description: 'Sample task only. This preview cannot send messages to customers.', business: 'exterior', stage: 'Review', assignee: 'Oscar', due_date: today() },
    { ...base, id: 'sample-4', title: 'Package the AI receptionist offer', description: 'Sample project: define GoHighLevel setup, customer onboarding, call handling, and ongoing support.', business: 'solutions', stage: 'Ready', assignee: 'Oscar', priority: 'high' },
    { ...base, id: 'sample-5', title: 'Build the receptionist launch checklist', description: 'Sample project: test booking, missed calls, escalation, business hours, and customer acceptance before launch.', business: 'solutions', stage: 'Backlog', assignee: 'Jacob' },
    { ...base, id: 'sample-6', title: 'Agree on our weekly planning routine', description: 'Sample completed task: one shared board, clear owners, and a weekly review.', business: 'solutions', stage: 'Done', assignee: 'Oscar' },
    { ...base, id: 'sample-7', title: 'Check stock levels for the new arrivals', description: 'Sample task: confirm supplier stock before the next product goes live.', business: 'essentials', stage: 'In progress', assignee: 'Jacob', due_date: today() },
    { ...base, id: 'sample-8', title: 'Reshoot product photos for the recovery range', description: 'Sample task: consistent background and lighting across the range.', business: 'essentials', stage: 'Backlog', assignee: 'Oscar' },
  ], comments: [],
};

/**
 * Fictional records for the sample workspace, dated relative to `now` so the
 * charts always end on the current month. Built in the browser, never stored.
 */
export function sampleDashboard(now: Date): Dashboard {
  const month = (back: number, day: number) => dayKey(new Date(now.getFullYear(), now.getMonth() - back, day));
  const revenue: Record<VentureId, number[]> = {
    exterior: [900, 600, 400, 700, 2100, 4800, 7200, 9100, 9800, 9300, 8900, 8420],
    solutions: [1200, 1800, 2400, 3100, 3900, 4600, 5800, 6900, 7600, 8400, 9100, 9760],
    essentials: [2100, 5200, 2600, 2400, 2900, 3300, 3800, 4100, 4700, 5200, 5600, 6200],
  };
  const costs: Record<VentureId, number> = { exterior: 2140, solutions: 1830, essentials: 3620 };
  const finance = (Object.keys(revenue) as VentureId[]).flatMap(venture => [
    ...revenue[venture].map((amount, i) => ({ id: `r-${venture}-${i}`, venture, kind: 'revenue' as const, amount, occurred_on: month(11 - i, 1), category: 'Sales', note: 'Sample' })),
    { id: `c-${venture}`, venture, kind: 'cost' as const, amount: costs[venture], occurred_on: month(0, 1), category: venture === 'essentials' ? 'Stock' : venture === 'solutions' ? 'Software' : 'Fuel and supplies', note: 'Sample' },
  ]);
  const at = (hour: number, dayOffset = 0) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + dayOffset, hour, 0).toISOString();
  const lead = (id: string, venture: VentureId, name: string, stage: Dashboard['leads'][number]['stage'], value: number | null, source: string) =>
    ({ id, venture, name, contact: '', stage, value, source, notes: '', created_at: at(9, -3) });
  return {
    finance,
    leads: [
      lead('l1', 'exterior', 'Two-storey house wash', 'New', 349, 'Website'), lead('l2', 'exterior', 'Driveway and patio', 'Contacted', 249, 'Door knocking'),
      lead('l3', 'exterior', 'Storefront sidewalk', 'Proposal', 399, 'Referral'), lead('l4', 'exterior', 'Roof soft wash', 'Won', 620, 'Website'),
      lead('l5', 'solutions', 'Dental office receptionist', 'Qualified', 1500, 'Cold call'), lead('l6', 'solutions', 'HVAC after-hours line', 'New', null, 'Referral'),
      lead('l7', 'solutions', 'Salon booking assistant', 'Won', 1200, 'Referral'), lead('l8', 'essentials', 'Local gym wholesale order', 'Contacted', 800, 'Email'),
      lead('l9', 'essentials', 'New recovery-range supplier', 'Qualified', null, 'Trade show'),
    ],
    metricEntries: [
      { id: 'm1', venture: 'solutions', label: 'Calls handled', value: 412, unit: 'calls', measured_on: month(0, 1), note: 'Sample' },
      { id: 'm2', venture: 'exterior', label: 'Doors knocked', value: 180, unit: 'doors', measured_on: month(0, 1), note: 'Sample' },
      { id: 'm3', venture: 'essentials', label: 'Store conversion rate', value: 2.4, unit: '%', measured_on: month(0, 1), note: 'Sample' },
    ],
    events: [
      { id: 'e1', venture: 'exterior', title: 'Client call', starts_at: at(9), ends_at: at(10), all_day: false, location: '', notes: 'Quote for a two-storey house wash' },
      { id: 'e2', venture: 'solutions', title: 'Receptionist test calls', starts_at: at(11), ends_at: at(12), all_day: false, location: '', notes: 'Run the launch checklist with the client' },
      { id: 'e3', venture: 'essentials', title: 'Supplier call', starts_at: at(14), ends_at: at(15), all_day: false, location: '', notes: 'Confirm stock for the next arrival' },
      { id: 'e4', venture: null, title: 'Weekly sync', starts_at: at(16), ends_at: at(17), all_day: false, location: '', notes: 'Progress and next steps' },
      { id: 'e5', venture: 'exterior', title: 'House wash, north side', starts_at: at(9, 2), ends_at: at(12, 2), all_day: false, location: 'Kenosha', notes: '' },
      { id: 'e6', venture: 'essentials', title: 'New arrival goes live', starts_at: at(0, 5), ends_at: null, all_day: true, location: '', notes: '' },
    ],
    documents: [
      { id: 'd1', venture: 'exterior', name: 'Exterior Care - Price guide.pdf', tag: 'other', storage_path: 'preview/d1', size_bytes: 482000, mime: 'application/pdf', uploaded_by: 'Oscar', created_at: at(8) },
      { id: 'd2', venture: 'solutions', name: 'Solutions - Client proposal.docx', tag: 'contract', storage_path: 'preview/d2', size_bytes: 96000, mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', uploaded_by: 'Jacob', created_at: at(7) },
      { id: 'd3', venture: 'essentials', name: 'Essentials - Product list.xlsx', tag: 'other', storage_path: 'preview/d3', size_bytes: 51000, mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', uploaded_by: 'Jacob', created_at: at(15, -1) },
      { id: 'd4', venture: null, name: 'Operating agreement.pdf', tag: 'legal', storage_path: 'preview/d4', size_bytes: 1240000, mime: 'application/pdf', uploaded_by: 'Oscar', created_at: at(12, -2) },
    ],
    messages: [
      { id: 'n1', venture: 'exterior', author: 'Jacob', body: 'New lead came in from the website for Exterior Care. Looks promising.', created_at: at(10) },
      { id: 'n2', venture: 'solutions', author: 'Oscar', body: 'Updated the Solutions proposal. Take a look when you get a chance.', created_at: at(9) },
      { id: 'n3', venture: 'essentials', author: 'Jacob', body: 'Supplier confirmed stock for next month.', created_at: at(17, -1) },
    ],
  };
}
