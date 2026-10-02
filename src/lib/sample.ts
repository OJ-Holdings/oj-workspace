import type { BoardData, Card } from './board';
import type { WorkspaceMetrics } from './metrics';

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

const months = ['Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];
export const sampleMetrics: WorkspaceMetrics = {
  months,
  ventures: {
    exterior: { revenueMtd: 8420, change: 14, activeLeads: 62, third: 28, series: [900, 600, 400, 700, 2100, 4800, 7200, 9100, 9800, 9300, 8900, 8420] },
    solutions: { revenueMtd: 9760, change: 9, activeLeads: 41, third: 12, series: [1200, 1800, 2400, 3100, 3900, 4600, 5800, 6900, 7600, 8400, 9100, 9760] },
    essentials: { revenueMtd: 6200, change: 18, activeLeads: 24, third: 6, series: [2100, 5200, 2600, 2400, 2900, 3300, 3800, 4100, 4700, 5200, 5600, 6200] },
  },
  pipeline: [{ stage: 'New', count: 48 }, { stage: 'Contacted', count: 32 }, { stage: 'Qualified', count: 18 }, { stage: 'Proposal', count: 12 }, { stage: 'Won', count: 28 }],
  schedule: [
    { id: 's1', time: '09:00', title: 'Client call', detail: 'Quote for a two-storey house wash', venture: 'exterior' },
    { id: 's2', time: '11:00', title: 'Receptionist test calls', detail: 'Run the launch checklist with the client', venture: 'solutions' },
    { id: 's3', time: '14:00', title: 'Supplier call', detail: 'Confirm stock for the next arrival', venture: 'essentials' },
    { id: 's4', time: '16:00', title: 'Weekly sync', detail: 'Progress and next steps', venture: 'shared' },
  ],
  files: [
    { id: 'f1', name: 'Exterior Care - Price guide.pdf', kind: 'pdf', updated: '2 hours ago', venture: 'exterior' },
    { id: 'f2', name: 'Solutions - Client proposal.docx', kind: 'doc', updated: '5 hours ago', venture: 'solutions' },
    { id: 'f3', name: 'Essentials - Product list.xlsx', kind: 'sheet', updated: 'Yesterday', venture: 'essentials' },
    { id: 'f4', name: 'Brand assets - OJ.zip', kind: 'zip', updated: '2 days ago', venture: 'shared' },
  ],
  notes: [
    { id: 'n1', author: 'Jacob', body: 'New lead came in from the website for Exterior Care. Looks promising.', when: '10:24' },
    { id: 'n2', author: 'Oscar', body: 'Updated the Solutions proposal. Take a look when you get a chance.', when: '09:17' },
  ],
};
