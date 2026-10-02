'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { BoardData } from '@/lib/board';
import { isVenture, ventureList, type VentureId } from '@/lib/ventures';
import type { WorkspaceMetrics } from '@/lib/metrics';
import { Shell, type NavKey } from './Shell';
import { HomeView } from './HomeView';
import { BoardView } from './BoardView';
import { VentureView } from './VentureView';
import { CardDialog } from './CardDialog';
import { useBoard } from './useBoard';

export type AppProps = {
  /** '/workspace' for the live app, '/preview' for the sample workspace. */
  base: string; initial: BoardData; mode: 'preview' | 'live'; organizationId: string; members: string[]; metrics: WorkspaceMetrics;
  readOnly?: boolean; owner?: boolean; displayName?: string; connectionStatus?: string; limited?: boolean;
};

// Pages that exist in the rail but are built in a later stage. Each says what it will hold.
const planned: Partial<Record<NavKey, { title: string; body: string }>> = {
  calendar: { title: 'Calendar', body: 'One shared calendar for events, Exterior Care bookings and task due dates, colour-coded by business, with a private link that puts it in your iPhone calendar.' },
  crm: { title: 'Leads and CRM', body: 'One pipeline across all three businesses: Exterior Care leads, Solutions prospects, and Essentials supplier and wholesale contacts.' },
  finance: { title: 'Finance', body: 'Revenue, costs and profit for each business and combined, month by month.' },
  files: { title: 'Files', body: 'Every document across the businesses in one searchable place.' },
  messages: { title: 'Messages', body: 'Notes and messages between the two of you, with a thread for each business.' },
  analytics: { title: 'Analytics', body: 'Charts comparing the three businesses side by side.' },
  team: { title: 'Team', body: 'Members, roles and invitations. In your live workspace this opens the team page.' },
  settings: { title: 'Settings', body: 'Your profile, notifications, and the connections to Shopify, GoHighLevel and the Exterior Care system.' },
};

export function App({ base, initial, mode, organizationId, members, metrics, readOnly = false, owner = false, displayName = '', connectionStatus = '', limited = false }: AppProps) {
  const pathname = usePathname() ?? base;
  const parts = pathname.slice(base.length).split('/').filter(Boolean);
  const board = useBoard(initial, mode, organizationId, readOnly);

  let current: NavKey = 'home';
  let venture: VentureId | null = null;
  if (parts[0] === 'b' && parts[1] && isVenture(parts[1])) { current = 'businesses'; venture = parts[1]; }
  else if (parts[0] && ['businesses', 'tasks', 'calendar', 'crm', 'finance', 'files', 'messages', 'analytics', 'team', 'settings'].includes(parts[0])) current = parts[0] as NavKey;

  const open = board.data.cards.filter(c => c.stage !== 'Done');
  const status = [connectionStatus && connectionStatus !== 'Live updates connected' ? connectionStatus : '', limited ? 'Showing the first 1,000 tasks and most recent 1,000 comments.' : ''].filter(Boolean).join(' ');
  const info = planned[current];

  return (
    <Shell base={base} current={current} venture={venture} mode={mode} members={members} displayName={displayName} owner={owner} readOnly={readOnly}
      openTasks={open.length} cards={board.data.cards} activity={board.data.activity ?? []} status={status}
      onOpenCard={card => board.openCard(card)} onNewCard={() => board.openCard(undefined, venture ? { business: venture } : {})}>
      {venture ? (
        <VentureView base={base} venture={venture} tab={parts[2] ?? 'overview'} board={board} metrics={metrics} members={members} readOnly={readOnly} displayName={displayName} />
      ) : current === 'home' ? (
        <HomeView base={base} board={board} metrics={metrics} mode={mode} displayName={displayName} members={members} readOnly={readOnly} />
      ) : current === 'tasks' ? (
        <div className="page">
          <header className="page-head"><h1>Tasks</h1><p>Everything the two of you are moving forward, across all three businesses.</p></header>
          <BoardView board={board} members={members} readOnly={readOnly} displayName={displayName} />
        </div>
      ) : current === 'businesses' ? (
        <div className="page">
          <header className="page-head"><h1>Businesses</h1><p>Three businesses, each with its own dashboard.</p></header>
          <div className="business-index">
            {ventureList.map(v => (
              <Link key={v.id} href={`${base}/b/${v.id}`} className="business-tile" data-venture={v.id}>
                <span className="venture-logo"><Image src={v.mark} alt="" width={96} height={96} /></span>
                <h2>{v.name}</h2><p>{v.tagline}</p>
                <span className="business-tile-foot">{open.filter(c => c.business === v.id).length} open tasks</span>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <div className="page">
          <header className="page-head"><h1>{info?.title}</h1></header>
          <div className="planned">
            <p>{info?.body}</p>
            <p className="quiet">This page is being built. It stays empty until it is connected to real data.</p>
            {current === 'team' && mode === 'live' && owner && <Link className="primary" href="/workspace/team">Open team and invitations</Link>}
          </div>
        </div>
      )}
      <CardDialog board={board} members={members} readOnly={readOnly} mode={mode} />
    </Shell>
  );
}
