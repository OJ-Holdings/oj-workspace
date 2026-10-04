'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import type { BoardData } from '@/lib/board';
import { isVenture, ventureList, type VentureId } from '@/lib/ventures';
import { deriveMetrics, type Dashboard } from '@/lib/dashboard';
import { Shell, type NavKey } from './Shell';
import { HomeView } from './HomeView';
import { BoardView } from './BoardView';
import { VentureView } from './VentureView';
import { CardDialog } from './CardDialog';
import { useBoard } from './useBoard';
import { useDashboard } from './useDashboard';
import { useJobs } from './useJobs';
import { AnalyticsView, CalendarView, CrmView, FilesView, FinanceView, MessagesView, SettingsView, type Connections } from './Pages';

export type AppProps = {
  /** '/workspace' for the live app, '/preview' for the sample workspace. */
  base: string; initial: BoardData; mode: 'preview' | 'live'; organizationId: string; members: string[];
  /** Live: the workspace's records, or null if those tables are not set up. Preview: leave out; sample records are built in the browser. */
  dashboard?: Dashboard | null; connections?: Connections;
  readOnly?: boolean; owner?: boolean; displayName?: string; connectionStatus?: string; limited?: boolean;
};

// One line under each page title saying what the page is for.
const planned: Partial<Record<NavKey, { title: string; body: string }>> = {
  calendar: { title: 'Calendar', body: 'Events and task due dates for all three businesses, with a private link for your iPhone.' },
  crm: { title: 'Leads and CRM', body: 'One pipeline across all three businesses.' },
  finance: { title: 'Finance', body: 'Money in, money out and profit, for each business and combined.' },
  files: { title: 'Files', body: 'Every document across the businesses, private to workspace members.' },
  messages: { title: 'Messages', body: 'Notes between the two of you, with a thread for each business.' },
  analytics: { title: 'Analytics', body: 'The three businesses side by side.' },
  team: { title: 'Team', body: 'Members, roles and invitations. In your live workspace this opens the team page.' },
  settings: { title: 'Settings', body: 'Your account and what is connected.' },
};

const noConnections: Connections = { shopify: false, ghl: false };

export function App({ base, initial, mode, organizationId, members, dashboard, connections = noConnections, readOnly = false, owner = false, displayName = '', connectionStatus = '', limited = false }: AppProps) {
  const pathname = usePathname() ?? base;
  const parts = pathname.slice(base.length).split('/').filter(Boolean);
  const board = useBoard(initial, mode, organizationId, readOnly);
  const store = useDashboard(dashboard, mode, organizationId, displayName);
  const { jobs, schedule: jobSchedule } = useJobs(organizationId, mode, pathname);
  const metrics = store.data && store.now ? deriveMetrics(store.data, board.data.cards, store.now, jobSchedule) : null;
  const role = mode === 'preview' ? 'Sample workspace' : owner ? 'Workspace owner' : readOnly ? 'View access' : 'Member';

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
        <VentureView base={base} venture={venture} tab={parts[2] ?? 'overview'} board={board} store={store} metrics={metrics} members={members} readOnly={readOnly} displayName={displayName} organizationId={organizationId} mode={mode} />
      ) : current === 'home' ? (
        <HomeView base={base} board={board} store={store} metrics={metrics} mode={mode} displayName={displayName} members={members} readOnly={readOnly} />
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
      ) : current === 'team' ? (
        <div className="page">
          <header className="page-head"><h1>{info?.title}</h1></header>
          <div className="planned">
            <p>{info?.body}</p>
            <p className="quiet">This page is being built. It stays empty until it is connected to real data.</p>
            {mode === 'live' && owner && <Link className="primary" href="/workspace/team">Open team and invitations</Link>}
          </div>
        </div>
      ) : (
        <div className="page">
          <header className="page-head"><h1>{info?.title}</h1><p>{info?.body}</p></header>
          {current === 'calendar' && <CalendarView store={store} readOnly={readOnly} cards={board.data.cards} jobs={jobs} base={base} />}
          {current === 'crm' && <CrmView store={store} readOnly={readOnly} />}
          {current === 'finance' && <FinanceView store={store} readOnly={readOnly} />}
          {current === 'files' && <FilesView store={store} readOnly={readOnly} />}
          {current === 'messages' && <MessagesView store={store} readOnly={readOnly} />}
          {current === 'analytics' && <AnalyticsView store={store} readOnly={readOnly} cards={board.data.cards} />}
          {current === 'settings' && <SettingsView store={store} displayName={displayName} role={role} connections={connections} mode={mode} />}
        </div>
      )}
      <CardDialog board={board} members={members} readOnly={readOnly} mode={mode} />
    </Shell>
  );
}
