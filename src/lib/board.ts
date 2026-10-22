import { isVenture, type VentureId } from './ventures';

export const stages = ['Backlog', 'Ready', 'In progress', 'Review', 'Done'] as const;
export type Stage = typeof stages[number];
export type Business = VentureId;
export type Card = {
  id: string; organization_id: string; title: string; description: string;
  business: Business; stage: Stage; priority: 'normal' | 'high'; assignee: string;
  due_date: string; revision: number; checklist: { id: string; text: string; done: boolean }[];
};
export type Comment = { id: string; card_id: string; body: string; author: string; created_at: string };
export type Activity = { id: string; card_id: string; actor: string; action: 'card_created' | 'card_updated' | 'comment_added'; created_at: string };
export type BoardData = { cards: Card[]; comments: Comment[]; activity?: Activity[] };
export type WorkspaceSnapshot = {
  data: BoardData; members: string[]; role: 'owner' | 'member' | 'viewer'; displayName: string; limited: boolean;
  /** Messages, leads, money, metrics, events and documents. `null` when those tables are not set up yet or could not be read. */
  dashboard: import('./dashboard').Dashboard | null;
  /** The work leaderboard. `null` for viewers, and when its database update is not applied yet or it could not be read. */
  work: import('./work').WorkData | null;
};
export function validateCard(input: unknown): Card {
  if (!input || typeof input !== 'object') throw new Error('Invalid card');
  const c = input as Card;
  if (typeof c.id !== 'string' || typeof c.organization_id !== 'string' || typeof c.title !== 'string' || !c.title.trim() || c.title.length > 180) throw new Error('Give the card a title of 1 to 180 characters.');
  if (!stages.includes(c.stage) || !isVenture(c.business) || !['normal', 'high'].includes(c.priority)) throw new Error('Invalid card selection.');
  if (typeof c.description !== 'string' || c.description.length > 8000 || typeof c.assignee !== 'string' || c.assignee.length > 120) throw new Error('Card text is too long.');
  if (typeof c.due_date !== 'string' || (c.due_date !== '' && (!/^\d{4}-\d{2}-\d{2}$/.test(c.due_date) || Number.isNaN(Date.parse(c.due_date)) || new Date(c.due_date).toISOString().slice(0,10) !== c.due_date))) throw new Error('Choose a valid due date.');
  if (!Number.isInteger(c.revision) || c.revision < 0) throw new Error('Invalid revision.');
  if (!Array.isArray(c.checklist) || c.checklist.length > 40 || c.checklist.some(i => !i || typeof i.id !== 'string' || typeof i.text !== 'string' || !i.text.trim() || i.text.length > 300 || typeof i.done !== 'boolean')) throw new Error('Invalid checklist.');
  return c;
}
export function updateCard(cards: Card[], incoming: Card): Card[] {
  validateCard(incoming);
  const old = cards.find(c => c.id === incoming.id);
  if (old && (old.organization_id !== incoming.organization_id || old.revision !== incoming.revision)) throw new Error('This card changed. Reload it before saving.');
  const next = { ...incoming, title: incoming.title.trim(), revision: incoming.revision + 1 };
  return old ? cards.map(c => c.id === next.id ? next : c) : [...cards, next];
}
export function matchesCard(card: Card, business: string, query: string, assignee: string) {
  return (business === 'all' || card.business === business) && (!assignee || card.assignee === assignee) && `${card.title} ${card.description} ${card.assignee}`.toLowerCase().includes(query.toLowerCase());
}
