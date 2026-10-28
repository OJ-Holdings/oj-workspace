import type { FinanceEntry } from './dashboard';
import type { VentureId } from './ventures';

export type PnlMonth = { month: string; revenue: number; cost: number; net: number };
export type SeasonPnl = { year: string; months: PnlMonth[]; revenue: number; cost: number; net: number; costByCategory: { category: string; amount: number }[]; years: string[] };

/** Revenue, costs and what is left, month by month for one calendar year, from the recorded finance entries. Costs are only what has been entered. */
export function seasonPnl(entries: FinanceEntry[], year: string, venture: VentureId | null = null): SeasonPnl {
  const rows = entries.filter(e => (!venture || e.venture === venture) && Number.isFinite(e.amount) && /^\d{4}-\d{2}/.test(e.occurred_on));
  const years = [...new Set(rows.map(e => e.occurred_on.slice(0, 4)))].sort().reverse();
  const byMonth = new Map<string, PnlMonth>(), cats = new Map<string, number>();
  for (const e of rows.filter(r => r.occurred_on.startsWith(year))) {
    const month = e.occurred_on.slice(0, 7);
    const m = byMonth.get(month) ?? { month, revenue: 0, cost: 0, net: 0 };
    if (e.kind === 'revenue') m.revenue += e.amount; else { m.cost += e.amount; cats.set(e.category || 'Other', (cats.get(e.category || 'Other') ?? 0) + e.amount); }
    m.net = m.revenue - m.cost;
    byMonth.set(month, m);
  }
  const months = [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
  const revenue = months.reduce((s, m) => s + m.revenue, 0), cost = months.reduce((s, m) => s + m.cost, 0);
  return { year, months, revenue, cost, net: revenue - cost, years, costByCategory: [...cats].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount) };
}
