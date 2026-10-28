import type { FinanceEntry } from './dashboard';
import type { VentureId } from './ventures';

export type DivisionFigures = { monthIn: number; monthOut: number; yearIn: number; yearOut: number; margin: number | null; share: number | null };

/**
 * One row of figures per business for the portfolio view (master plan 11b): this month and this year's money in and out, the margin on the
 * year, and each business's share of all money in. Margin is null until both revenue and costs have been entered, so a business with no
 * costs on record never looks like a 100% margin. Share is null when nothing has come in yet.
 */
export function portfolio(entries: FinanceEntry[], today: string): Record<VentureId, DivisionFigures> {
  const month = today.slice(0, 7), year = today.slice(0, 4);
  const blank = (): DivisionFigures => ({ monthIn: 0, monthOut: 0, yearIn: 0, yearOut: 0, margin: null, share: null });
  const out = { exterior: blank(), solutions: blank(), essentials: blank(), content: blank() } as Record<VentureId, DivisionFigures>;
  for (const e of entries) {
    const row = out[e.venture];
    if (!row || !Number.isFinite(e.amount) || !e.occurred_on.startsWith(year)) continue;
    const inMonth = e.occurred_on.startsWith(month);
    if (e.kind === 'revenue') { row.yearIn += e.amount; if (inMonth) row.monthIn += e.amount; } else { row.yearOut += e.amount; if (inMonth) row.monthOut += e.amount; }
  }
  const total = Object.values(out).reduce((t, r) => t + r.yearIn, 0);
  for (const r of Object.values(out)) {
    r.margin = r.yearIn > 0 && r.yearOut > 0 ? (r.yearIn - r.yearOut) / r.yearIn : null;
    r.share = total > 0 ? r.yearIn / total : null;
  }
  return out;
}
