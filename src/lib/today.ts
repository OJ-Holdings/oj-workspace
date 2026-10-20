import type { Card } from './board';

/** Due work first, then review and high-priority work. No inferred deadlines. */
export function todayTasks(cards: Card[], today: string, assignee = '') {
  const rank = (c: Card) => c.due_date && c.due_date < today ? 0 : c.due_date === today ? 1 : c.stage === 'Review' ? 2 : 3;
  return cards.filter(c => c.stage !== 'Done' && (!assignee || c.assignee === assignee)
    && ((today && c.due_date && c.due_date <= today) || c.stage === 'Review' || c.priority === 'high'))
    .sort((a, b) => rank(a) - rank(b) || (a.due_date || '9999').localeCompare(b.due_date || '9999') || a.title.localeCompare(b.title));
}
