'use client';

import Image from 'next/image';
import Link from 'next/link';
import NumberFlow from '@number-flow/react';
import { motion } from 'motion/react';
import { ventures, type VentureId } from '@/lib/ventures';
import type { WorkspaceMetrics } from '@/lib/metrics';
import { BoardView } from './BoardView';
import { CrmView, FilesView, FinanceView, MetricsTab } from './Pages';
import { ShopifyView } from './ShopifyView';
import { ExteriorView } from './ExteriorView';
import { GhlView } from './GhlView';
import type { DashboardStore } from './useDashboard';
import type { Board } from './useBoard';

const coreTabs = [['overview', 'Overview'], ['board', 'Board'], ['leads', 'Leads'], ['money', 'Money'], ['metrics', 'Metrics'], ['documents', 'Documents']] as const;
const extraTabs: Record<VentureId, readonly (readonly [string, string])[]> = {
  exterior: [['jobs', 'Jobs and income'], ['outreach', 'Outreach leads'],['conversations', 'Conversations'], ['bookings', 'Bookings'], ['door-knocking', 'Door knocking'], ['quotes', 'Quote requests'], ['upgrades', 'Upgrades']],
  solutions: [['clients', 'Clients'], ['calls', 'Calls']],
  essentials: [['orders', 'Orders'], ['products', 'Products'], ['inventory', 'Inventory']],
};
const isExtra = (venture: VentureId, tab: string) => extraTabs[venture].some(([id]) => id === tab);

type Props = { base: string; venture: VentureId; tab: string; board: Board; store: DashboardStore; metrics: WorkspaceMetrics | null; members: string[]; readOnly: boolean; displayName: string; organizationId: string; mode: 'preview' | 'live' };

export function VentureView({ base, venture, tab, board, store, metrics, members, readOnly, displayName, organizationId, mode }: Props) {
  const v = ventures[venture];
  const m = metrics?.ventures[venture] ?? null;
  const tabs = [...coreTabs, ...extraTabs[venture]];
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
          <ul className="chips">{v.chips.map(chip => <li key={chip}>{chip}</li>)}</ul>
        </div>
      </header>

      <nav className="tabs" aria-label={`${v.name} sections`}>
        {tabs.map(([id, label]) => (
          <Link key={id} href={`${base}/b/${venture}${id === 'overview' ? '' : `/${id}`}`} aria-current={active === id ? 'page' : undefined} className={active === id ? 'is-current' : undefined}>
            {label}
            {active === id && <motion.i layoutId={`tab-${venture}`} className="tab-line" transition={{ type: 'spring', stiffness: 500, damping: 40 }} />}
          </Link>
        ))}
      </nav>

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
      {active === 'leads' && <CrmView store={store} readOnly={readOnly} venture={venture} />}
      {active === 'money' && <FinanceView store={store} readOnly={readOnly} venture={venture} />}
      {active === 'metrics' && <MetricsTab store={store} readOnly={readOnly} venture={venture} />}
      {active === 'documents' && <FilesView store={store} readOnly={readOnly} venture={venture} />}
      {isExtra(venture, active) && venture === 'essentials' && <ShopifyView tab={active} org={organizationId} mode={mode} />}
      {isExtra(venture, active) && venture === 'exterior' && <ExteriorView tab={active} org={organizationId} mode={mode} readOnly={readOnly} />}
      {isExtra(venture, active) && venture === 'solutions' && <GhlView tab={active} org={organizationId} mode={mode} />}
    </div>
  );
}
