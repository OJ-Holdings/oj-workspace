import 'server-only';
import type { requireMember } from '@/lib/supabase';
import type { Dashboard, FinanceEntry } from '@/lib/dashboard';
import { openStatuses } from '@/lib/exterior';
import { readShopify, shopifyConfigured } from '@/lib/shopify-server';
import { ghlConfigured, readGhl } from '@/lib/ghl-server';

type Client = Awaited<ReturnType<typeof requireMember>>['client'];

// Money and open leads that already exist in the connected systems, shaped like
// the workspace's own records so Home, each business overview, Finance and
// Analytics count them. Each entry is marked `auto` and cannot be edited here.
// Only money actually recorded counts: a paid Exterior Care job, a Shopify order.
// A quote or a GoHighLevel deal value is never income.

const businessDay = (iso: string) => new Date(iso).toLocaleDateString('en-CA', { timeZone: 'America/Chicago' });
/** A slow or failing outside system must not hold up the workspace: after four seconds its figures are left out and the problem is logged. */
const withinFourSeconds = <T,>(what: string, work: Promise<T>): Promise<T | null> =>
  Promise.race([work, new Promise<null>(resolve => setTimeout(() => resolve(null), 4000))]).catch(error => { console.error(`${what} figures left out:`, error instanceof Error ? error.message : error); return null; });

export async function addExternalFigures(client: Client, dashboard: Dashboard): Promise<Dashboard> {
  const [jobs, shop, ghl] = await Promise.all([
    // Row-level security returns nothing here for viewers and other workspaces.
    client.from('leads').select('id,status,service_requested,job_revenue,job_cost,completed_at,updated_at,created_at').limit(5000),
    shopifyConfigured() ? withinFourSeconds('Shopify', readShopify()) : null,
    ghlConfigured() ? withinFourSeconds('GoHighLevel', readGhl()) : null,
  ]);
  const finance: FinanceEntry[] = [];
  const leads = jobs.error ? [] : jobs.data ?? [];
  if (jobs.error) console.error('Exterior Care figures left out:', jobs.error.message);
  for (const l of leads) {
    if (l.status !== 'completed') continue;
    const day = businessDay(l.completed_at || l.updated_at || l.created_at), note = l.service_requested || '';
    if (Number(l.job_revenue) > 0) finance.push({ id: `job-${l.id}`, venture: 'exterior', kind: 'revenue', amount: Number(l.job_revenue), occurred_on: day, category: 'Job', note, auto: 'Exterior Care job' });
    if (Number(l.job_cost) > 0) finance.push({ id: `jobcost-${l.id}`, venture: 'exterior', kind: 'cost', amount: Number(l.job_cost), occurred_on: day, category: 'Job cost', note, auto: 'Exterior Care job' });
  }
  for (const o of shop?.orders ?? []) {
    if (o.cancelled || o.test || o.total <= 0) continue;
    finance.push({ id: `shopify-${o.id}`, venture: 'essentials', kind: 'revenue', amount: o.total, occurred_on: businessDay(o.createdAt), category: 'Shopify order', note: o.name, auto: 'Shopify' });
  }
  return {
    ...dashboard,
    finance: [...dashboard.finance, ...finance].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)),
    openElsewhere: { exterior: leads.filter(l => openStatuses.includes(l.status ?? '')).length, solutions: ghl ? ghl.opportunities.filter(o => o.status === 'open').length : 0 },
  };
}
