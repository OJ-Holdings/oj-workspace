'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { PresencePanel } from './PresencePanel';
import { SuggestedWork } from './SuggestedWork';
import type { BoardData } from '@/lib/board';
import { contentPersistenceEnabled, isVenture, ventureList, ventures, type VentureId } from '@/lib/ventures';
import { deriveMetrics, type Dashboard } from '@/lib/dashboard';
import { Shell, type NavKey } from './Shell';
import { HomeView } from './HomeView';
import { CorporateToolsView } from './CorporateTools';
import { CorporateIntelligenceDesk } from './CorporateIntelligence';
import { ScenarioLab } from './ScenarioLab';
import { ContentStudio } from './ContentStudio';
import { BoardView } from './BoardView';
import { VentureView } from './VentureView';
import { CardDialog } from './CardDialog';
import { useBoard } from './useBoard';
import { useDashboard } from './useDashboard';
import { useJobs } from './useJobs';
import { useWork } from './useWork';
import { WorkTimer } from './WorkTimer';
import type { WorkData } from '@/lib/work';
import { AnalyticsView, CalendarView, CrmView, FilesView, FinanceView, MessagesView, SettingsView, type Connections } from './Pages';

export type AppProps = {
  /** '/workspace' for the live app, '/preview' for the sample workspace. */
  base: string; initial: BoardData; mode: 'preview' | 'live'; organizationId: string; members: string[];
  /** Live: the workspace's records, or null if those tables are not set up. Preview: leave out; sample records are built in the browser. */
  dashboard?: Dashboard | null; connections?: Connections;
  /** Live: the work leaderboard's figures, or null. Preview: leave out; fictional figures are built in the browser. */
  work?: WorkData | null;
  /** An owner or member: has a work timer and sees the leaderboard. Viewers do not. */
  partner?: boolean;
  readOnly?: boolean; owner?: boolean; displayName?: string; connectionStatus?: string; limited?: boolean;
};

// One line under each page title saying what the page is for.
const planned: Partial<Record<NavKey, { title: string; body: string }>> = {
  calendar: { title: 'Calendar', body: 'Events and task due dates for all four businesses, with a private link for your iPhone.' },
  crm: { title: 'Leads and CRM', body: 'Workspace leads across all four businesses.' },
  finance: { title: 'Finance', body: 'Money in, money out and profit, for each business and combined.' },
  files: { title: 'Files', body: 'Every document across the businesses, private to workspace members.' },
  messages: { title: 'Messages', body: 'Notes between the two of you, with a thread for each business.' },
  analytics: { title: 'Analytics', body: 'Four businesses, with source-aware comparisons.' },
  team: { title: 'Team', body: 'Members, roles and invitations. In your live workspace this opens the team page.' },
  settings: { title: 'Settings', body: 'Your account and what is connected.' },
};

const noConnections: Connections = { shopify: false, ghl: false };

export function App({ base, initial, mode, organizationId, members, dashboard, connections = noConnections, work: workData, partner = true, readOnly = false, owner = false, displayName = '', connectionStatus = '', limited = false }: AppProps) {
  const pathname = usePathname() ?? base;
  const parts = pathname.slice(base.length).split('/').filter(Boolean);
  const rawBoard = useBoard(initial, mode, organizationId, readOnly);
  const board = {
    ...rawBoard,
    openCard: (...args: Parameters<typeof rawBoard.openCard>) => {
      if (rawBoard.editing && !rawBoard.closeCard()) return;
      rawBoard.openCard(...args);
      if (args[0]) {
        const url = new URL(window.location.href);
        url.searchParams.set('task', args[0].id);
        url.searchParams.delete('sourceLead');
        window.history.pushState(null, '', url.pathname + url.search);
      }
    },
    closeCard: (extraDraft = false) => {
      if (!rawBoard.closeCard(extraDraft)) return false;
      const url = new URL(window.location.href);
      url.searchParams.delete('task'); url.searchParams.delete('sourceLead');
      window.history.replaceState(null, '', url.pathname + url.search);
      return true;
    },
  };
  const store = useDashboard(dashboard, mode, organizationId, displayName);
  const query = useSearchParams();
  const opened = useRef('');
  const taskId = query.get('task');
  const sourceLead = query.get('sourceLead');
  useEffect(() => {
    if (!board.ready) return;
    const key = taskId ? `task:${taskId}` : sourceLead ? `lead:${sourceLead}` : '';
    if (opened.current === key) return;
    if (rawBoard.editing && !rawBoard.closeCard()) {
      const url = new URL(window.location.href);
      url.searchParams.delete('task'); url.searchParams.delete('sourceLead');
      const [kind, ...value] = opened.current.split(':');
      if (value.length) url.searchParams.set(kind === 'task' ? 'task' : 'sourceLead', value.join(':'));
      window.history.replaceState(null, '', url.pathname + url.search);
      return;
    }
    if (!key) { opened.current = ''; return; }
    if (taskId) {
      const card = board.data.cards.find(c => c.id === taskId);
      if (card) { opened.current = key; rawBoard.openCard(card); }
    } else if (sourceLead && !readOnly) {
      const lead = store.data?.leads.find(l => l.id === sourceLead);
      if (lead) {
        opened.current = key;
        rawBoard.openCard(undefined, { title: `Follow up with ${lead.name}`, business: lead.venture, description: `Follow up on ${lead.name}'s enquiry.\nSource: ${lead.name}\n${base}/crm?lead=${encodeURIComponent(lead.id)}` });
      }
    }
  }, [taskId, sourceLead, board.ready, board.data.cards, store.data, readOnly, base]);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !rawBoard.editing) {
      const url = new URL(window.location.href);
      url.searchParams.delete('task'); url.searchParams.delete('sourceLead');
      window.history.replaceState(null, '', url.pathname + url.search);
      opened.current = '';
    }
    wasEditing.current = Boolean(rawBoard.editing);
  }, [rawBoard.editing]);
  useEffect(() => {
    const record = query.get('document') || query.get('message');
    if (record && store.data) document.getElementById(`record-${record}`)?.scrollIntoView({ block: 'center' });
  }, [query, store.data]);
  const { jobs, schedule: jobSchedule } = useJobs(organizationId, mode, pathname);
  const work = useWork(workData, mode, organizationId, partner, readOnly);
  const metrics = store.data && store.now ? deriveMetrics(store.data, board.data.cards, store.now, jobSchedule) : null;
  const role = mode === 'preview' ? 'Sample workspace' : owner ? 'Workspace owner' : readOnly ? 'View access' : 'Member';

  let current: NavKey = 'home';
  let venture: VentureId | null = null;
  if (parts[0] === 'b' && parts[1] && isVenture(parts[1])) { current = 'businesses'; venture = parts[1]; }
  else if (parts[0] && ['businesses', 'tasks', 'calendar', 'crm', 'finance', 'files', 'messages', 'analytics', 'team', 'settings', 'tools'].includes(parts[0])) current = parts[0] as NavKey;

  const open = board.data.cards.filter(c => c.stage !== 'Done');
  const status = [connectionStatus && connectionStatus !== 'Live updates connected' ? connectionStatus : '', limited ? 'Showing the first 1,000 tasks and most recent 1,000 comments.' : ''].filter(Boolean).join(' ');
  const info = planned[current];

  return (
    <Shell base={base} current={current} venture={venture} mode={mode} members={members} displayName={displayName} owner={owner} readOnly={readOnly}
      openTasks={open.length} cards={board.data.cards} dashboard={store.data} activity={board.data.activity ?? []} status={status} toolConnections={connections}
      timer={<WorkTimer work={work} />}
      presence={<PresencePanel mode={mode} organizationId={organizationId} members={members} cards={board.data.cards} onOpenCard={board.openCard} />}
      onOpenCard={card => board.openCard(card)} onNewCard={() => board.openCard(undefined, venture ? { business: venture } : {})}>
      {venture ? (
        <VentureView base={base} venture={venture} tab={parts[2] ?? 'overview'} board={board} store={store} metrics={metrics} members={members} readOnly={readOnly} displayName={displayName} organizationId={organizationId} mode={mode} />
      ) : current === 'home' ? (
        <HomeView base={base} board={board} store={store} work={work} metrics={metrics} jobs={jobs} mode={mode} displayName={displayName} members={members} readOnly={readOnly} />
      ) : current === 'tools' ? (
        parts[1] === 'scenarios' ? <ScenarioLab base={base} /> : parts[1] === 'intelligence' ? <CorporateIntelligenceDesk base={base} cards={board.data.cards} dashboard={store.data} jobs={jobs} mode={mode} /> : parts[1] === 'content-preview' && !contentPersistenceEnabled ? <ContentStudio base={base} organizationId={organizationId} mode="preview" readOnly /> : <CorporateToolsView base={base} owner={owner} connections={connections} mode={mode} />
      ) : current === 'tasks' ? (
        <div className="page">
          <header className="page-head"><h1>Tasks</h1><p>Everything the two of you are moving forward, across your active businesses.</p></header>
          <BoardView board={board} members={members} readOnly={readOnly} displayName={displayName} />
          <SuggestedWork board={board} dashboard={store.data} base={base} organizationId={organizationId} mode={mode} readOnly={readOnly} />
        </div>
      ) : current === 'businesses' ? (
        <div className="page">
          <header className="page-head"><h1>Businesses</h1><p>Manage the active businesses and explore the Oscar Jacob production studio preview.</p></header>
          <div className="business-index">
            {ventureList.map(v => (
              <Link key={v.id} href={`${base}/b/${v.id}`} className="business-tile" data-venture={v.id}>
                <span className="venture-logo"><Image src={v.mark} alt="" width={96} height={96} /></span>
                <h2>{v.name}</h2><p>{v.tagline}</p>
                <span className="business-tile-foot">{open.filter(c => c.business === v.id).length} open tasks</span>
              </Link>
            ))}
            {!contentPersistenceEnabled && <Link href={`${base}/tools/content-preview`} className="business-tile" data-venture="content">
              <span className="venture-logo"><Image src={ventures.content.mark} alt="" width={96} height={96} /></span>
              <h2>Oscar Jacob</h2><p>Production Studio · read-only sample</p>
              <span className="business-tile-foot">Preview only — no company records are stored</span>
            </Link>}
          </div>
        </div>
      ) : current === 'team' ? (
        <div className="page">
          <header className="page-head"><h1>{info?.title}</h1></header>
          <div className="planned">
            <p>{info?.body}</p>
            <p className="quiet">{members.join(' · ')}. Availability and current work appear in the team strip above. Preview statuses are demonstrations only.</p>
            {mode === 'live' && owner && <Link className="primary" href="/workspace/team">Open team and invitations</Link>}
          </div>
        </div>
      ) : (
        <div className="page">
          <header className="page-head"><h1>{info?.title}</h1><p>{info?.body}</p></header>
          {current === 'calendar' && <CalendarView store={store} readOnly={readOnly} cards={board.data.cards} jobs={jobs} base={base} />}
          {current === 'crm' && <CrmView store={store} readOnly={readOnly} />}
          {current === 'finance' && <FinanceView store={store} readOnly={readOnly} owner={owner} />}
          {current === 'files' && <FilesView store={store} readOnly={readOnly} />}
          {current === 'messages' && <MessagesView store={store} readOnly={readOnly} />}
          {current === 'analytics' && <AnalyticsView store={store} readOnly={readOnly} cards={board.data.cards} />}
          {current === 'settings' && <SettingsView store={store} displayName={displayName} role={role} connections={connections} mode={mode} workMissing={work.missing} />}
        </div>
      )}
      <CardDialog board={board} members={members} readOnly={readOnly} mode={mode} />
    </Shell>
  );
}
