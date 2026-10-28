'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { PresencePanel } from './PresencePanel';
import { SuggestedWork } from './SuggestedWork';
import type { BoardData } from '@/lib/board';
import { contentPersistenceEnabled, isVenture, ventureList, ventures, type VentureId } from '@/lib/ventures';
import { deriveMetrics, type Dashboard } from '@/lib/dashboard';
import { Shell, type NavKey } from './Shell';
import { HomeView } from './HomeView';
import { SystemsHealthDesk } from './SystemsHealthDesk';
import { followUpFromCrmLead, followUpFromExteriorBooking } from '@/lib/operating-handoffs';
import { chicagoDateOf, parseLocalCommercialDraft, parseLocalFleetDraft } from '@/lib/atlas-field-bridge';
import { commercialPortfolioTask, commercialReviewTask, fleetReviewTask } from '@/lib/atlas-task-handoff';
import { fleetServiceTask } from '@/lib/atlas-fleet-service-handoff';
import { loadCommercialProject } from '@/app/workspace/commercial-actions';
import { FleetCommand } from './FleetCommand';
import { ContentStudio } from './ContentStudio';
import { BoardView } from './BoardView';
import { VentureView } from './VentureView';
import { CardDialog } from './CardDialog';
import { useBoard } from './useBoard';
import { useDashboard } from './useDashboard';
import { useJobs } from './useJobs';
import { useWork } from './useWork';
import { WorkTimer } from './WorkTimer';
import { ChatBubble } from './ChatBubble';
import { InvoicesView } from './InvoicesView';
import { HyperboreaView } from './HyperboreaView';
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
  finance: { title: 'Money', body: 'What came in, what went out, and what is left.' },
  invoices: { title: 'Invoices', body: 'Bill customers and record what they pay.' },
  files: { title: 'Files', body: 'Every document across the businesses, private to workspace members.' },
  messages: { title: 'Messages', body: 'Notes between the two of you, with a thread for each business.' },
  analytics: { title: 'Reports', body: 'Revenue, costs and leads across the businesses.' },
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
        url.searchParams.delete('sourceLead'); url.searchParams.delete('sourceBooking'); url.searchParams.delete('sourceCommercial'); url.searchParams.delete('sourceFleet'); url.searchParams.delete('sourceProject'); url.searchParams.delete('sourceFleetAsset');
        window.history.pushState(null, '', url.pathname + url.search);
      }
    },
    closeCard: (extraDraft = false) => {
      if (!rawBoard.closeCard(extraDraft)) return false;
      const url = new URL(window.location.href);
      url.searchParams.delete('task'); url.searchParams.delete('sourceLead'); url.searchParams.delete('sourceBooking'); url.searchParams.delete('sourceCommercial'); url.searchParams.delete('sourceFleet'); url.searchParams.delete('sourceProject'); url.searchParams.delete('sourceFleetAsset');
      window.history.replaceState(null, '', url.pathname + url.search);
      return true;
    },
  };
  const store = useDashboard(dashboard, mode, organizationId, displayName);
  const { jobs, schedule: jobSchedule, loadingState: jobsState } = useJobs(organizationId, mode, pathname);
  const query = useSearchParams();
  const opened = useRef('');
  const [handoffError,setHandoffError]=useState('');
  const taskId = query.get('task');
  const sourceLead = query.get('sourceLead');
  const sourceBooking = query.get('sourceBooking');
  const sourceCommercial = query.get('sourceCommercial') === '1';
  const sourceFleet = query.get('sourceFleet') === '1';
  const sourceProject = query.get('sourceProject');
  const sourceFleetAsset = query.get('sourceFleetAsset');
  useEffect(() => {
    if (!board.ready) return;
    const key = taskId ? `task:${taskId}` : sourceLead ? `lead:${sourceLead}` : sourceBooking ? `booking:${sourceBooking}` : sourceProject ? `project:${sourceProject}` : sourceFleetAsset ? `fleetasset:${sourceFleetAsset}` : sourceCommercial ? 'commercial:1' : sourceFleet ? 'fleet:1' : '';
    if (opened.current === key) return;
    if (rawBoard.editing && !rawBoard.closeCard()) {
      const url = new URL(window.location.href);
      url.searchParams.delete('task'); url.searchParams.delete('sourceLead'); url.searchParams.delete('sourceBooking'); url.searchParams.delete('sourceCommercial'); url.searchParams.delete('sourceFleet'); url.searchParams.delete('sourceProject'); url.searchParams.delete('sourceFleetAsset');
      const [kind, ...value] = opened.current.split(':');
      if (value.length) url.searchParams.set(kind === 'task' ? 'task' : kind === 'booking' ? 'sourceBooking' : kind === 'commercial' ? 'sourceCommercial' : kind === 'fleet' ? 'sourceFleet' : kind === 'project' ? 'sourceProject' : kind === 'fleetasset' ? 'sourceFleetAsset' : 'sourceLead', value.join(':'));
      window.history.replaceState(null, '', url.pathname + url.search);
      return;
    }
    if (!key) { opened.current = ''; setHandoffError(''); return; }
    if (taskId) {
      const card = board.data.cards.find(c => c.id === taskId);
      if (card) { opened.current = key; rawBoard.openCard(card); }
    } else if (sourceLead && !readOnly) {
      const lead = store.data?.leads.find(l => l.id === sourceLead);
      if (lead) {
        opened.current = key;
        rawBoard.openCard(undefined, followUpFromCrmLead(lead,base));
      }
    } else if (sourceBooking && !readOnly && mode === 'live') {
      if(jobsState==='loading')return;
      const booking = jobs.find(j => j.id === sourceBooking);
      if (booking) {
        try {
          const draft = followUpFromExteriorBooking(booking,base);
          opened.current = key;
          rawBoard.openCard(undefined,draft);
        } catch { /* Rejected booking cannot create a task draft. */ }
      }
    } else if (sourceProject && !readOnly && mode === 'live') {
      if(jobsState==='loading')return;
      if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceProject)){
        opened.current=key;setHandoffError('Invalid shared project identifier.');return;
      }
      opened.current=key;
      setHandoffError('Loading the authorized shared project…');
      void loadCommercialProject(organizationId,sourceProject).then(project=>{
        if(opened.current!==key)return;
        if(!project)throw new Error('Shared project not found or no longer accessible.');
        const day=chicagoDateOf(new Date().toISOString())??'';
        const rawFleet=window.localStorage.getItem('oj-fleet-command-v1:'+organizationId);
        let fleet:ReturnType<typeof parseLocalFleetDraft>|null=null;
        if(rawFleet){try{fleet=parseLocalFleetDraft(rawFleet,organizationId);}catch{/* Optional fleet evidence is unknown, not invented. */}}
        const sourceBooking=project.bookingId
          ? jobs.find(j=>j.id.toLowerCase()===project.bookingId&&j.status!=='cancelled'&&j.status!=='denied')??null
          : null;
        const draft=commercialPortfolioTask(project,fleet,day,sourceBooking);
        if(opened.current!==key)return;
        setHandoffError('');rawBoard.openCard(undefined,draft);
      }).catch(error=>{
        if(opened.current!==key)return;
        setHandoffError(error instanceof Error?error.message:'Shared project could not be validated for task preparation.');
      });
    } else if (sourceFleetAsset && !readOnly && mode === 'live') {
      // Explicit click from a specific device-local fleet asset; no shared
      // work-order save happens until the standard task editor is approved.
      try{
        const raw=window.localStorage.getItem('oj-fleet-command-v1:'+organizationId);
        if(!raw)throw new Error('No validated Fleet Command workbook is available on this device.');
        const fleet=parseLocalFleetDraft(raw,organizationId);
        const day=chicagoDateOf(new Date().toISOString())??'';
        const draft=fleetServiceTask(fleet,sourceFleetAsset,day);
        opened.current=key;setHandoffError('');rawBoard.openCard(undefined,draft);
      }catch(error){
        opened.current=key;
        setHandoffError(error instanceof Error?error.message:'Cannot prepare a service task from this private equipment record.');
      }
    } else if ((sourceCommercial || sourceFleet) && !readOnly && mode === 'live') {
      // This navigation is an explicit user request to PREPARE a task. Reading
      // org-keyed browser drafts cannot save a task, send outreach or approve a bid.
      try {
        const day=chicagoDateOf(new Date().toISOString()) ?? '';
        const rawCommercial=sourceCommercial ? window.localStorage.getItem('oj-commercial-estimate-v2:'+organizationId) : null;
        const rawFleet=window.localStorage.getItem('oj-fleet-command-v1:'+organizationId);
        if(sourceCommercial && !rawCommercial)throw new Error('Save your commercial estimate on this device before preparing a shared task.');
        if(sourceFleet && !rawFleet)throw new Error('Save a Fleet Command workbook on this device before preparing a shared task.');
        let fleet: ReturnType<typeof parseLocalFleetDraft> | null = null;
        if(rawFleet){
          try{fleet=parseLocalFleetDraft(rawFleet,organizationId);}
          catch(error){if(sourceFleet)throw error;} // Optional fleet evidence never blocks commercial task preparation.
        }
        const draft=sourceCommercial
          ? commercialReviewTask(parseLocalCommercialDraft(rawCommercial!,organizationId),fleet,day)
          : fleetReviewTask(fleet!,day);
        opened.current=key;
        setHandoffError('');
        rawBoard.openCard(undefined,draft);
      } catch(error) {
        opened.current=key;
        setHandoffError(error instanceof Error ? error.message : 'The private source workbook could not be read.');
      }
    }
  }, [taskId, sourceLead, sourceBooking, sourceProject, sourceFleetAsset, sourceCommercial, sourceFleet, organizationId, board.ready, board.data.cards, store.data, jobs, jobsState, mode, readOnly, base]);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !rawBoard.editing) {
      const url = new URL(window.location.href);
      url.searchParams.delete('task'); url.searchParams.delete('sourceLead'); url.searchParams.delete('sourceBooking'); url.searchParams.delete('sourceCommercial'); url.searchParams.delete('sourceFleet'); url.searchParams.delete('sourceProject'); url.searchParams.delete('sourceFleetAsset');
      window.history.replaceState(null, '', url.pathname + url.search);
      opened.current = '';
    }
    wasEditing.current = Boolean(rawBoard.editing);
  }, [rawBoard.editing]);
  useEffect(() => {
    const record = query.get('document') || query.get('message');
    if (record && store.data) document.getElementById(`record-${record}`)?.scrollIntoView({ block: 'center' });
  }, [query, store.data]);
  const work = useWork(workData, mode, organizationId, partner, readOnly);
  const metrics = store.data && store.now ? deriveMetrics(store.data, board.data.cards, store.now, jobSchedule) : null;
  const role = mode === 'preview' ? 'Sample workspace' : owner ? 'Workspace owner' : readOnly ? 'View access' : 'Member';

  let current: NavKey = 'home';
  let venture: VentureId | null = null;
  if (parts[0] === 'b' && parts[1] && isVenture(parts[1])) {
    current = parts[1] === 'exterior' && parts[2] === 'projects' ? 'nexus'
      : parts[1] === 'exterior' && parts[2] === 'bookings' ? 'exterior-bookings'
      : parts[1] === 'exterior' && parts[2] === 'leads' ? 'exterior-leads'
      : parts[2] === 'money' ? 'finance' : 'businesses';
    venture = parts[1];
  }
  else if (parts[0] === 'tools' && parts[1] === 'fleet') current = 'fleet';
  else if (parts[0] && ['businesses', 'tasks', 'calendar', 'crm', 'finance', 'invoices', 'files', 'messages', 'analytics', 'team', 'settings', 'tools', 'summit'].includes(parts[0])) current = parts[0] as NavKey;

  const open = board.data.cards.filter(c => c.stage !== 'Done');
  const status = [connectionStatus && connectionStatus !== 'Live updates connected' ? connectionStatus : '', limited ? 'Showing the first 1,000 tasks and most recent 1,000 comments.' : ''].filter(Boolean).join(' ');
  const info = planned[current];

  return (
    <Shell base={base} current={current} venture={venture} mode={mode} members={members} displayName={displayName} owner={owner} readOnly={readOnly}
      openTasks={open.length} cards={board.data.cards} dashboard={store.data} activity={board.data.activity ?? []} status={status} toolConnections={connections} jobs={jobs}
      timer={<WorkTimer work={work} />}
      presence={<PresencePanel mode={mode} organizationId={organizationId} members={members} cards={board.data.cards} onOpenCard={board.openCard} />}
      onOpenCard={card => board.openCard(card)} onNewCard={() => board.openCard(undefined, venture ? { business: venture } : {})}>
      {venture ? (
        <VentureView base={base} venture={venture} tab={parts[2] ?? 'overview'} board={board} store={store} metrics={metrics} members={members} readOnly={readOnly} displayName={displayName} organizationId={organizationId} mode={mode} />
      ) : current === 'home' ? (
        <HomeView base={base} board={board} store={store} work={work} metrics={metrics} jobs={jobs} mode={mode} displayName={displayName} members={members} readOnly={readOnly} limited={limited} />
      ) : current === 'summit' ? (
        mode === 'live' && !owner
          ? <div className="page"><header className="page-head"><h1>Founders only</h1><p>This page is reserved for the workspace owners.</p></header></div>
          : <HyperboreaView data={store.data} now={store.now} companies={0 /* Ownership evidence is not connected; business tabs are not companies. */} coreVentures={ventureList.map(v => v.id)} businesses={ventureList.map(v => ({ id: v.id, name: v.short }))} base={base} mode={mode} />
      ) : current === 'fleet' ? (
        <FleetCommand key={organizationId+mode+String(readOnly)} base={base} organizationId={organizationId} mode={mode} readOnly={readOnly} bookings={jobs} bookingsState={jobsState} cards={board.data.cards} />
      ) : current === 'tools' ? (
        parts[1] === 'systems' ? <SystemsHealthDesk mode={mode} /> : parts[1] === 'content-preview' && !contentPersistenceEnabled ? <ContentStudio base={base} organizationId={organizationId} mode="preview" readOnly /> : <HomeView base={base} board={board} store={store} work={work} metrics={metrics} jobs={jobs} mode={mode} displayName={displayName} members={members} readOnly={readOnly} limited={limited} />
      ) : current === 'tasks' ? (
        <div className="page">
          <header className="page-head"><h1>Tasks</h1><p>Everything the two of you are moving forward, across your active businesses.</p></header>
          {handoffError && <p className="notice" role="alert">{handoffError}</p>}
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
          {current === 'crm' && <CrmView store={store} readOnly={readOnly} cards={board.data.cards} />}
          {current === 'finance' && <FinanceView store={store} readOnly={readOnly} owner={owner} jobs={owner && mode === 'live' && jobsState === 'ready' ? jobs : undefined} />}
          {current === 'invoices' && <InvoicesView org={organizationId} mode={mode} readOnly={readOnly} owner={owner} base={base} />}
          {current === 'files' && <FilesView store={store} readOnly={readOnly} />}
          {current === 'messages' && <MessagesView store={store} readOnly={readOnly} />}
          {current === 'analytics' && <AnalyticsView store={store} readOnly={readOnly} cards={board.data.cards} />}
          {current === 'settings' && <SettingsView store={store} displayName={displayName} role={role} connections={connections} mode={mode} workMissing={work.missing} />}
        </div>
      )}
      <ChatBubble store={store} organizationId={organizationId} displayName={displayName} readOnly={readOnly} mode={mode} />
      <CardDialog board={board} members={members} readOnly={readOnly} mode={mode} dashboard={store.data} jobs={jobs} base={base} />
    </Shell>
  );
}
