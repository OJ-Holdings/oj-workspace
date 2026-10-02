import type { BoardData, Card } from './board';
const base: Omit<Card, 'id' | 'title' | 'business' | 'stage' | 'description'> = { organization_id: 'preview', priority: 'normal', assignee: '', due_date: '', revision: 0, checklist: [] };
export const sampleData: BoardData = {
  cards: [
    { ...base, id: 'sample-1', title: 'Prepare a recurring window-care offer', description: 'Sample project: outline the service, visit frequency, and information needed for a quote.', business: 'exterior', stage: 'Ready', priority: 'high', assignee: 'Oscar', checklist: [{ id: '1', text: 'Define the visit checklist', done: true }, { id: '2', text: 'Draft the offer', done: false }] },
    { ...base, id: 'sample-2', title: 'Finish the field closeout checklist', description: 'Capture crew time, payment status, materials, and the next recommended service.', business: 'exterior', stage: 'In progress', assignee: 'Jacob', checklist: [{ id: '1', text: 'Choose the required fields', done: true }, { id: '2', text: 'Try the form on a phone', done: false }] },
    { ...base, id: 'sample-3', title: 'Review the next outreach draft', description: 'Sample task only. This preview cannot send messages to customers.', business: 'exterior', stage: 'Review', assignee: 'Oscar' },
    { ...base, id: 'sample-4', title: 'Package the AI receptionist offer', description: 'Sample project: define GoHighLevel setup, customer onboarding, call handling, and ongoing support.', business: 'solutions', stage: 'Ready', assignee: 'Oscar', priority: 'high' },
    { ...base, id: 'sample-5', title: 'Build the receptionist launch checklist', description: 'Sample project: test booking, missed calls, escalation, business hours, and customer acceptance before launch.', business: 'solutions', stage: 'Backlog', assignee: 'Jacob' },
    { ...base, id: 'sample-6', title: 'Agree on our weekly planning routine', description: 'Sample completed task: one shared board, clear owners, and a weekly review.', business: 'solutions', stage: 'Done', assignee: 'Oscar' },
  ], comments: [],
};
