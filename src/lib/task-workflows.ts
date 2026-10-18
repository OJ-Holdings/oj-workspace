import { matchesCard, type Card } from './board';
import type { Dashboard } from './dashboard';

export const workRules = [
  { id: 'overdue', label: 'Overdue tasks' },
  { id: 'unassigned', label: 'Work without an owner' },
  { id: 'review', label: 'Tasks awaiting review' },
  { id: 'missing', label: 'Missing lead details' },
  { id: 'older', label: 'Older open leads' },
] as const;
export type WorkRule = typeof workRules[number]['id'];
export type TaskFocus = 'all' | 'overdue' | 'today' | 'unassigned' | 'review';
export type WorkSuggestion = {
  id: string; rule: WorkRule; title: string; reason: string; business: Card['business'];
  sourceType: 'task' | 'lead'; sourceId: string; sourceTitle: string; existingTask?: Card;
};

export function workDay(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function taskMatchesFocus(card: Card, focus: TaskFocus, today: string) {
  if (focus === 'all') return true;
  if (card.stage === 'Done') return false;
  if (focus === 'unassigned') return !card.assignee.trim();
  if (focus === 'review') return card.stage === 'Review';
  return Boolean(card.due_date && today && (focus === 'today' ? card.due_date === today : card.due_date < today));
}

export function selectTasks(cards: Card[], business: string, query: string, assignee: string, focus: TaskFocus, today: string) {
  return cards.filter(c => matchesCard(c, business, query.trim(), assignee) && taskMatchesFocus(c, focus, today));
}

export const suggestionMarker = (id: string) => `[oj-work:${id}]`;
export function suggestionTask(cards: Card[], id: string) {
  return cards.find(c => c.description.split(/\r?\n/).some(line => line.trim() === suggestionMarker(id)));
}

/** These rules describe observable records, never presumed contact history or AI output. */
export function suggestedWork(cards: Card[], dashboard: Dashboard | null, today: string): WorkSuggestion[] {
  const items: WorkSuggestion[] = [];
  for (const card of cards) {
    if (card.stage === 'Done') continue;
    const common = { business: card.business, sourceType: 'task' as const, sourceId: card.id, sourceTitle: card.title, existingTask: card };
    if (taskMatchesFocus(card, 'overdue', today)) items.push({ ...common, id: `overdue:${card.id}`, rule: 'overdue', title: `Resolve the due date: ${card.title}`, reason: `Due ${card.due_date}; still ${card.stage.toLowerCase()}. Complete it or agree on a new date.` });
    if (!card.assignee.trim()) items.push({ ...common, id: `unassigned:${card.id}`, rule: 'unassigned', title: `Choose an owner: ${card.title}`, reason: 'This open task has no assigned teammate.' });
    if (card.stage === 'Review') items.push({ ...common, id: `review:${card.id}`, rule: 'review', title: `Review: ${card.title}`, reason: 'The task is in Review. Check its description and checklist before marking it done.' });
  }
  for (const lead of dashboard?.leads ?? []) {
    if (lead.stage === 'Won' || lead.stage === 'Lost') continue;
    const common = { business: lead.venture, sourceType: 'lead' as const, sourceId: lead.id, sourceTitle: lead.name };
    const missing = [!lead.contact.trim() && 'contact details', lead.value === null && 'estimated value'].filter(Boolean).join(' and ');
    if (missing) {
      const id = `missing:${lead.id}`;
      items.push({ ...common, id, rule: 'missing', title: `Complete details for ${lead.name}`, reason: `Missing ${missing}. Confirm the facts with the team; an unknown estimate is not zero.`, existingTask: suggestionTask(cards, id) });
    }
    const created = new Date(lead.created_at);
    if (Number.isFinite(created.getTime()) && today) {
      const days = Math.floor((Date.parse(`${today}T12:00:00Z`) - Date.parse(`${workDay(created)}T12:00:00Z`)) / 86_400_000);
      if (days >= 7) {
        const id = `older:${lead.id}`;
        items.push({ ...common, id, rule: 'older', title: `Review next steps for ${lead.name}`, reason: `Added ${days} days ago and still ${lead.stage.toLowerCase()}. Last contact is not tracked here, so check recent conversations before following up.`, existingTask: suggestionTask(cards, id) });
      }
    }
  }
  return items;
}

export function suggestionDraft(item: WorkSuggestion, base: string): Partial<Card> {
  const sourceUrl = item.sourceType === 'lead' ? `${base}/crm?lead=${encodeURIComponent(item.sourceId)}` : `${base}/tasks?task=${encodeURIComponent(item.sourceId)}`;
  return { business: item.business, title: item.title.slice(0, 180), stage: 'Ready', description: `${item.reason}\n\nSource: ${item.sourceTitle}\n${sourceUrl}\n\n${suggestionMarker(item.id)}`, checklist: [] };
}

/** Undo only changes the stage and is refused after any intervening revision. */
export function undoTaskMove(current: Card, expectedRevision: number, beforeStage: Card['stage']): Card {
  if (current.revision !== expectedRevision) throw new Error('This task changed after the move. Open it to review the latest version.');
  return { ...current, stage: beforeStage };
}
