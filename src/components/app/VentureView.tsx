'use client';

import Image from 'next/image';
import Link from 'next/link';
import NumberFlow from '@number-flow/react';
import { BusinessNav } from './BusinessNav';
import { ventures, type VentureId } from '@/lib/ventures';
import type { WorkspaceMetrics } from '@/lib/metrics';
import { BoardView } from './BoardView';
import { CrmView, FilesView, FinanceView, MetricsTab } from './Pages';
import { ShopifyView } from './ShopifyView';
import { ExteriorView } from './ExteriorView';
import { GhlView } from './GhlView';
import { OutreachView } from './OutreachView';
import type { DashboardStore } from './useDashboard';
import type { Board } from './useBoard';

const coreTabs = [['overview', 'Overview'], ['board', 'Board'], ['leads', 'Leads'], ['money', 'Money'], ['metrics', 'Metrics'], ['documents', 'Documents']] as const;
const extraTabs: Record<VentureId, readonly (readonly [string, string])[]> = {
  exterior: [['leads', 'Leads'], ['bookings', 'Bookings'], ['calendar', 'Calendar'], ['commercial', 'Commercial Desk'], ['jobs', 'Jobs and income'], ['door-knocking', 'Door knocking'], ['quotes', 'Quote requests'], ['activity', 'Activity'], ['upgrades', 'Upgrades'], ['settings', 'Settings']],
  solutions: [['clients', 'Clients'], ['outreach', 'Outreach'], ['calls', 'Calls']],
  essentials: [['orders', 'Orders'], ['products', 'Products'], ['inventory', 'Inventory']],
};
const isExtra = (venture: VentureId, tab: string) => extraTabs[venture].some(([id]) => id === tab);
/** Exterior Care runs on its own lead system, so its tabs replace the workspace's general Leads tab. */
const tabsFor = (venture: VentureId): readonly (readonly [string, string])[] => venture === 'exterior'
  ? [coreTabs[0], coreTabs[1], ...extraTabs.exterior.slice(0, 5), coreTabs[3], ...extraTabs.exterior.slice(5), coreTabs[4], coreTabs[5]]
  : [...coreTabs, ...extraTabs[venture]];

type Props = { base: string; venture: VentureId; tab: string; board: Board; store: DashboardStore; metrics: WorkspaceMetrics | null; members: string[]; readOnly: boolean; displayName: string; organizationId: string; mode: 'preview' | 'live' };

export function VentureView({ base, venture, tab, board, store, metrics, members, readOnly, displayName, organizationId, mode }: Props) {
  const v = ventures[venture];
  const m = metrics?.ventures[venture] ?? null;
  const tabs: readonly (readonly [string, string])[] = tabsFor(venture);
  const active = tabs.some(([id]) => id === tab) ? tab : 'overview';
  const cards = board.data.cards.filter(c => c.business === venture);
  const open = cards.filter(c => c.stage !== 'Done');

  return (
    <div className="venture">
      <header className="venture-head">
        <span className="venture-logo"><Image src={v.mark} alt={`${v.name} logo`} width={112} height={112} priority /></span>
        <div>
          <h1>{v.name}</h1>
          <p className="venture-tagline">{v.tagline}</p>
        </div>
      </header>

      <BusinessNav base={base} venture={venture} active={active} tabs={tabs} />

      {active === 'overview' && (
        <div className="venture-overview">
          <div className="kpis">
            {m ? <>
              <div><span>Revenue this month</span><strong><NumberFlow value={m.revenueMtd} format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0 }} /></strong>{m.change !== null && <small className={m.change >= 0 ? 'delta up' : 'delta down'}>{m.change >= 0 ? '+' : ''}{m.change}% on last month</small>}</div>
              <div><span>Active leads</span><strong><NumberFlow value={m.activeLeads} /></strong></div>
            </> : (
              <div className="kpi-off"><b>No figures yet.</b><span>Log money on the Money tab or add a lead, and they appear here. {v.source.charAt(0).toUpperCase() + v.source.slice(1)} will add its own once connected.</span></div>
            )}
            <div><span>Open tasks</span><strong><NumberFlow value={open.length} /></strong></div>
          </div>
          <h2 className="section-title">Work in progress</h2>
          <BoardView board={board} members={members} readOnly={readOnly} displayName={displayName} lockVenture={venture} />
        </div>
      )}
      {active === 'board' && <BoardView board={board} members={members} readOnly={readOnly} displayName={displayName} lockVenture={venture} />}
      {active === 'leads' && venture !== 'exterior' && <CrmView store={store} readOnly={readOnly} venture={venture} />}
      {active === 'money' && <FinanceView store={store} readOnly={readOnly} venture={venture} />}
      {active === 'metrics' && <MetricsTab store={store} readOnly={readOnly} venture={venture} />}
      {active === 'documents' && <FilesView store={store} readOnly={readOnly} venture={venture} />}
      {active === 'outreach' && venture === 'solutions' && <OutreachView organizationId={organizationId} mode={mode} readOnly={readOnly} displayName={displayName} />}
      {isExtra(venture, active) && venture === 'essentials' && <ShopifyView tab={active} org={organizationId} mode={mode} />}
      {isExtra(venture, active) && venture === 'exterior' && <ExteriorView tab={active} org={organizationId} mode={mode} readOnly={readOnly} />}
      {(active === 'clients' || active === 'calls') && venture === 'solutions' && <GhlView tab={active} org={organizationId} mode={mode} />}
    </div>
  );
}
