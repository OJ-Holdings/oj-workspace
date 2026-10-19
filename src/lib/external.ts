import 'server-only';
import type { requireMember } from '@/lib/supabase';
import type { Dashboard, ReportingSource } from '@/lib/dashboard';
import { openStatuses } from '@/lib/exterior';
import { exteriorFinance, shopifyFinance } from '@/lib/reporting';
import { readShopify, shopifyConfigured } from '@/lib/shopify-server';
import { ghlConfigured, readGhl } from '@/lib/ghl-server';
import { mercuryConfigured, readMercury } from '@/lib/mercury-server';

type Client = Awaited<ReturnType<typeof requireMember>>['client'];

// Money and open leads that already exist in the connected systems, shaped like
// the workspace's own records so Home, each business overview, Finance and
// Analytics count them. Each entry is marked `auto` and cannot be edited here.
// Only money actually recorded counts: a paid Exterior Care job, a Shopify order.
// A quote or a GoHighLevel deal value is never income.

/** A slow or failing outside system must not hold up the workspace: after four seconds its figures are left out and the problem is logged. */
async function withinFourSeconds<T>(what: string, work: Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([work, new Promise<null>(resolve => { timer = setTimeout(() => resolve(null), 4000); })]);
  } catch (error) {
    console.error(`${what} figures left out:`, error instanceof Error ? error.message : error);
    return null;
  } finally { if (timer) clearTimeout(timer); }
}

export async function addExternalFigures(client: Client, dashboard: Dashboard, owner = false): Promise<Dashboard> {
  const hasShop = shopifyConfigured(), hasGhl = ghlConfigured(), hasMercury = owner && mercuryConfigured();
  const [jobs, shop, ghl, mercury] = await Promise.all([
    // Row-level security returns nothing here for viewers and other workspaces.
    client.from('leads').select('id,status,service_requested,job_revenue,job_cost,completed_at,updated_at,created_at', { count: 'exact' }).order('created_at', { ascending: false }).limit(5000),
    hasShop ? withinFourSeconds('Shopify', readShopify()) : null,
    hasGhl ? withinFourSeconds('GoHighLevel', readGhl()) : null,
    owner ? readMercury() : null,
  ]);
  const leads = jobs.error ? [] : (jobs.data ?? []).map(l => ({ ...l, job_revenue: l.job_revenue === null ? null : Number(l.job_revenue), job_cost: l.job_cost === null ? null : Number(l.job_cost) }));
  if (jobs.error) console.error('Exterior Care figures left out:', jobs.error.message);
  const exterior = exteriorFinance(leads);
  const shopRows = shop ? shopifyFinance(shop.orders, shop.currency) : [];
  const sources: ReportingSource[] = [
    { id: 'exterior', label: 'Exterior Care', state: jobs.error ? 'unavailable' : (jobs.count ?? leads.length) > leads.length ? 'partial' : 'available', detail: jobs.error ? 'Job records could not be read. Their figures are omitted, not zero.' : `${leads.length} accessible lead records${(jobs.count ?? leads.length) > leads.length ? ` of ${jobs.count}` : ''}. Job dates group recorded payments; collection dates are not available.` },
    { id: 'shopify', label: 'Shopify', state: !hasShop ? 'not-connected' : !shop ? 'unavailable' : 'partial', detail: !hasShop ? 'Not connected. No store figures included.' : !shop ? 'The store did not respond in time. Store figures are omitted, not zero.' : shop.currency !== 'USD' ? `Orders use ${shop.currency}; excluded from the USD report without an exchange rate.` : `${shopRows.length} fully paid orders included from ${shop.orders.length} fetched orders. ${shop.ordersTruncated ? 'Limited to the latest 250 orders. ' : ''}The connection covers recent orders only. Pending, partial-payment and refunded statuses are excluded; dates are order dates, not bank deposits.` },
    { id: 'ghl', label: 'GoHighLevel', state: !hasGhl ? 'not-connected' : !ghl ? 'unavailable' : ghl.opportunitiesTotal > ghl.opportunities.length ? 'partial' : 'available', detail: !hasGhl ? 'Not connected. No outside deal counts included.' : !ghl ? 'The system did not respond in time. Deal counts are omitted, not zero.' : `${ghl.opportunities.length} of ${ghl.opportunitiesTotal} deals read. Deal values are never counted as paid revenue.` },
    ...(owner ? [{ id: 'mercury' as const, label: 'Mercury', state: !hasMercury ? 'not-connected' as const : mercury?.state ?? 'unavailable' as const, detail: !hasMercury ? 'Not connected. Add a read-only Mercury API token as OJ_MERCURY_API_TOKEN in the server environment.' : mercury?.detail ?? 'Mercury data is omitted, not zero.' }] : []),
  ];
  return {
    ...dashboard,
    finance: [...dashboard.finance, ...exterior.finance, ...shopRows].sort((a, b) => b.occurred_on.localeCompare(a.occurred_on)),
    reporting: { sources, exterior: exterior.coverage },
    ...(owner ? { mercury: mercury ?? { state: 'not-connected' as const, detail: 'Add a read-only Mercury API token as OJ_MERCURY_API_TOKEN in the server environment.', accounts: [], transactions: [], checkedAt: new Date().toISOString() } } : {}),
    openElsewhere: { ...(!jobs.error ? { exterior: leads.filter(l => openStatuses.includes(l.status ?? '')).length } : {}), ...(ghl ? { solutions: ghl.opportunities.filter(o => o.status === 'open').length } : {}) },
  };
}
