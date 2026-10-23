'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowRight, ArrowUpRight, Boxes, Building2,
  CalendarDays, CheckCircle2, CircleHelp, ClipboardList, Clock3, Database,
  FileCheck2, GitBranch, Layers3, LockKeyhole, Network, RefreshCw,
  Search, ShieldAlert, ShieldCheck, Truck, Users,
} from 'lucide-react';
import type { Activity as TaskActivity, Card } from '@/lib/board';
import type { JobItem } from '@/app/workspace/exterior-actions';
import type { LoadedBookingState } from '@/lib/atlas-fleet-dispatch-plan';
import {
  decodeCommercialPortfolio, type CommercialPortfolio,
} from '@/lib/atlas-commercial-portfolio';
import { parseLocalFleetDraft } from '@/lib/atlas-field-bridge';
import type { FleetWorkbook } from '@/lib/fleet-command';
import {
  buildNexusGraph, type NexusEvidence, type NexusFlag, type NexusProject,
} from '@/lib/atlas-nexus';

type Props = {
  base: string; organizationId: string; mode: 'live' | 'preview'; readOnly: boolean;
  bookings: JobItem[]; bookingsState: LoadedBookingState;
  cards: Card[]; activity: TaskActivity[];
};
type LocalSource<T> = { state: 'loading' | 'missing' | 'valid' | 'invalid'; value: T | null; error: string };
const loading = <T,>(): LocalSource<T> => ({state:'loading',value:null,error:''});
const currentDay = () => {
  const parts = new Intl.DateTimeFormat('en-US', {
    year:'numeric',month:'2-digit',day:'2-digit',timeZone:'America/Chicago',
  }).formatToParts(new Date());
  const part=(kind:string)=>parts.find(p=>p.type===kind)?.value??'';
  return part('year')+'-'+part('month')+'-'+part('day');
};
const truncated=(value:string,count=9)=>value.length>count?value.slice(0,count)+'…':value;
const dayLabel=(iso:string)=>{
  const date=new Date(iso);
  if(!Number.isFinite(date.getTime()))return 'Unknown';
  return new Intl.DateTimeFormat('en-US',{
    month:'short',day:'numeric',year:'numeric',timeZone:'America/Chicago',
  }).format(date);
};
const sourceLabels:Record<NexusEvidence,string>={
  'loaded-source':'Exact loaded source',
  'local-entered':'Local record / candidate',
  'textual-receipt':'Task text receipt',
  'unverified':'Unverified',
};
const actionLabels:Record<TaskActivity['action'],string>={
  card_created:'Created a task',
  card_updated:'Updated a task',
  comment_added:'Commented on a task',
};
const severityLabels:Record<NexusFlag['severity'],string>={
  attention:'Attention',review:'Review',unknown:'Unknown',
};
const nodeIcons={booking:CalendarDays,asset:Truck,task:ClipboardList} as const;

export function AtlasNexusDesk({
  base,organizationId,mode,readOnly,bookings,bookingsState,cards,activity,
}:Props){
  const canInspect = mode==='live' && !readOnly;
  const query=useSearchParams();
  const requested=query.get('project');
  const portfolioKey='oj-commercial-project-portfolio-v1:'+organizationId;
  const fleetKey='oj-fleet-command-v1:'+organizationId;
  const [portfolio,setPortfolio]=useState<LocalSource<CommercialPortfolio>>(loading);
  const [fleet,setFleet]=useState<LocalSource<FleetWorkbook>>(loading);
  const [day,setDay]=useState('');
  const [filter,setFilter]=useState('');
  const [scope,setScope]=useState<'all'|'attention'|'active'>('all');

  useEffect(()=>{
    setPortfolio(loading());
    setFleet(loading());
    setDay(currentDay());
    if(!canInspect){
      setPortfolio({state:'missing',value:null,error:''});
      setFleet({state:'missing',value:null,error:''});
      return;
    }
    const refresh=()=>{
      setDay(currentDay());
      try {
        const raw=window.localStorage.getItem(portfolioKey);
        setPortfolio(raw
          ? {state:'valid',value:decodeCommercialPortfolio(raw,organizationId),error:''}
          : {state:'missing',value:null,error:''});
      } catch(e) {
        setPortfolio({state:'invalid',value:null,
          error:e instanceof Error?e.message:'Local project portfolio cannot be validated.'});
      }
      try{
        const raw=window.localStorage.getItem(fleetKey);
        setFleet(raw
          ? {state:'valid',value:parseLocalFleetDraft(raw,organizationId),error:''}
          : {state:'missing',value:null,error:''});
      }catch(e){
        setFleet({state:'invalid',value:null,
          error:e instanceof Error?e.message:'Local Fleet workbook cannot be validated.'});
      }
    };
    refresh();
    const storage=(e:StorageEvent)=>{
      if(e.key===portfolioKey||e.key===fleetKey||e.key===null)refresh();
    };
    window.addEventListener('storage',storage);
    window.addEventListener('focus',refresh);
    const interval=window.setInterval(()=>setDay(currentDay()),60_000);
    return ()=>{
      window.removeEventListener('storage',storage);
      window.removeEventListener('focus',refresh);
      window.clearInterval(interval);
    };
  },[portfolioKey,fleetKey,organizationId,canInspect]);

  const graph=useMemo(()=>canInspect&&portfolio.state==='valid'&&portfolio.value
    ?buildNexusGraph({
      org:organizationId,portfolio:portfolio.value,fleet:fleet.value,
      bookings,bookingsState,cards,activity,day,
    })
    :null,[canInspect,portfolio,fleet,organizationId,bookings,bookingsState,cards,activity,day]);

  const project=graph?.projects.find(p=>p.id===requested) ??
    (!requested?graph?.projects[0]:undefined);
  const matches=useMemo(()=>graph?.projects.filter(p=>
    (!filter.trim()||[p.name,p.id,p.phase].some(x=>x.toLowerCase().includes(filter.trim().toLowerCase()))) &&
    (scope==='all'||(scope==='active'?p.phase!=='archived':p.findings.some(x=>x.severity==='attention')))
  )??[],[graph,filter,scope]);
  const openCount=project?.tasks.filter(t=>t.stage!=='Done').length??0;

  return <main className="nexus-desk page">
    <header className="nexus-hero">
      <div className="nexus-hero-overline"><Network size={16}/> ATLAS / RELEASE 13 / NEXUS</div>
      <div className="nexus-hero-main">
        <div>
          <h1>One project. <em>Every connection.</em></h1>
          <p>Project 360 combines the commercial plans saved in this browser with
            separately authorized Exterior bookings, Fleet evidence, shared tasks
            and recorded task activity. Each link says what actually supports it.</p>
        </div>
        <div className="nexus-hero-actions">
          <Link href={base+'/b/exterior/commercial'}><Building2 size={15}/> Commercial workbench <ArrowUpRight size={14}/></Link>
          <Link href={base+'/tools/fleet'}><Truck size={15}/> Fleet Command <ArrowUpRight size={14}/></Link>
        </div>
      </div>
      <div className="nexus-trust-line"><ShieldCheck size={15}/>
        <span><b>Evidence-backed, read-only coordination.</b> No hidden synchronization, automatic approvals, real-time telemetry, asset reservations or new database tables.</span>
      </div>
    </header>

    {!canInspect&&<div className="nexus-gated" role="status">
      <LockKeyhole size={24}/>
      <h2>NEXUS private project records are unavailable in this session.</h2>
      <p>Preview and viewer roles do not read an editor’s local commercial or Fleet workbooks.
        Authorized shared tasks remain available through the existing Task Board.</p>
      <Link href={base+'/tasks'}>Open permitted shared tasks <ArrowUpRight size={14}/></Link>
    </div>}

    {canInspect&&<div className="nexus-content">
      <section className="nexus-sourcebar" aria-label="Source coverage and limits">
        <div><Layers3 size={17}/><span>Commercial projects</span><strong data-state={portfolio.state}>{portfolio.state==='valid'?'Validated on this device':portfolio.state==='missing'?'No local portfolio':portfolio.state==='invalid'?'Invalid source':'Checking'}</strong></div>
        <div><Truck size={17}/><span>Fleet workbook</span><strong data-state={fleet.state}>{fleet.state==='valid'?'Validated locally':fleet.state==='invalid'?'Rejected':fleet.state==='missing'?'Not on this device':'Checking'}</strong></div>
        <div><CalendarDays size={17}/><span>Exterior bookings</span><strong data-state={bookingsState}>{bookingsState==='ready'?'Loaded source snapshot':bookingsState==='loading'?'Loading':'Read failed'}</strong></div>
        <div><Database size={17}/><span>Tasks and activity</span><strong>Loaded workspace snapshot</strong></div>
      </section>

      {portfolio.state==='invalid'&&<div className="nexus-source-error" role="alert">
        <ShieldAlert size={19}/><div><strong>Local commercial portfolio rejected</strong>
          <p>{portfolio.error}. Nothing was overwritten. Recover or export the original in a trusted environment; NEXUS will not infer relationships from unvalidated input.</p></div>
      </div>}
      {fleet.state==='invalid'&&<div className="nexus-source-error" role="alert">
        <ShieldAlert size={19}/><div><strong>Local Fleet evidence rejected</strong>
          <p>{fleet.error}. Equipment readiness will remain unknown; no source data was modified.</p></div>
      </div>}
      {portfolio.state==='missing'&&<div className="nexus-empty">
        <Boxes size={27}/><h2>Connect your first commercial project.</h2>
        <p>There is no saved versioned commercial project portfolio in this browser. Open Commercial Estimating and save a project to make its relationships visible here.</p>
        <Link href={base+'/b/exterior/commercial'}>Open Commercial Estimating <ArrowUpRight size={15}/></Link>
      </div>}
      {portfolio.state==='loading'&&<div className="nexus-empty"><RefreshCw size={22}/><p>Checking locally saved, organization-scoped project evidence…</p></div>}

      {graph&&<>
        <section className="nexus-kpis" aria-label="NEXUS source-backed totals">
          <div><span>Local projects</span><strong>{graph.totals.projects}</strong><small>Entered in this browser</small></div>
          <div><span>Exact loaded bookings</span><strong>{graph.totals.exactLoadedBookingLinks}</strong><small>Current source match only</small></div>
          <div><span>Task receipt links</span><strong>{graph.totals.taskReceiptLinks}</strong><small>Textual ID references</small></div>
          <div><span>Attention findings</span><strong>{graph.totals.attentionFlags}</strong><small>Planning flags, not incidents</small></div>
          <div><span>Unverified findings</span><strong>{graph.totals.unknownSourceFlags}</strong><small>Never treated as zero</small></div>
        </section>
        {graph.taskOrphans>0&&<div className="nexus-orphan-note">
          <CircleHelp size={16}/>{graph.taskOrphans} loaded Exterior task(s) refer to project IDs not found in this browser’s portfolio.
          They might originate on the other founder’s device; NEXUS does not invent a matching project.
        </div>}
        {graph.projects.length===0?<div className="nexus-empty">
          <Network size={28}/><h2>Your NEXUS register is empty.</h2>
          <p>The portfolio format is valid, but it contains no saved commercial projects.</p>
          <Link href={base+'/b/exterior/commercial'}>Create a project <ArrowRight size={15}/></Link>
        </div>:<div className="nexus-workspace">
          <aside className="nexus-project-rail" aria-label="Saved project portfolio">
            <div className="nexus-rail-head">
              <span>LOCAL PROJECT REGISTER</span><strong>{graph.projects.length} projects</strong>
            </div>
            <label className="nexus-rail-search"><Search size={16}/>
              <input aria-label="Find NEXUS project" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Find project or ID…"/>
            </label>
            <div className="nexus-rail-filters" role="group" aria-label="Filter project register">
              {(['all','attention','active'] as const).map(entry=>
                <button key={entry} type="button" aria-pressed={scope===entry} onClick={()=>setScope(entry)}>
                  {entry==='all'?'All':entry==='attention'?'Attention':'Active'}
                </button>)}
            </div>
            <div className="nexus-project-list">
              {matches.length===0&&<p>No projects match these filters.</p>}
              {matches.map(entry=>{
                const alertCount=entry.findings.filter(f=>f.severity==='attention').length;
                return <Link key={entry.id} aria-current={project?.id===entry.id?'page':undefined}
                  href={base+'/tools/nexus?project='+encodeURIComponent(entry.id)}>
                  <span className="nexus-project-item-title">{entry.name}</span>
                  <span className="nexus-project-item-meta">{entry.scope.buildings} building{entry.scope.buildings===1?'':'s'} · {entry.phase.replace('-',' ')}</span>
                  <span className="nexus-project-item-foot"><small>r{entry.revision} · local</small>
                    {alertCount>0&&<b>{alertCount} attention</b>}
                    {alertCount===0&&<b className="nexus-muted-count">No flagged attention</b>}
                  </span>
                </Link>;
              })}
            </div>
          </aside>

          {!project?<section className="nexus-empty nexus-selection-missing">
            <CircleHelp size={26}/><h2>Project unavailable on this device.</h2>
            <p>The requested project ID does not belong to the currently validated portfolio. A task receipt or a link on another device cannot create or synchronize it.</p>
            <Link href={base+'/tools/nexus'}>View loaded projects <ArrowRight size={15}/></Link>
          </section>:<section className="nexus-project-360" aria-label="Selected project connections">
            <div className="nexus-project-heading">
              <div><div className="nexus-kicker">NEXUS / PROJECT 360 / LOCAL REVISION {project.revision}</div>
                <h2>{project.name}</h2>
                <p>Saved {dayLabel(project.updatedAt)} · {project.phase==='founder-review'?'Founder review requested—not approved':project.phase==='archived'?'Archived locally':'Local scoping in progress'} · Device-specific ID {truncated(project.id,14)}</p>
              </div>
              <Link href={base+'/b/exterior/commercial?project='+encodeURIComponent(project.id)}>Open project editor <ArrowUpRight size={15}/></Link>
            </div>
            <div className="nexus-project-measures">
              <div><small>Scoped buildings</small><strong>{project.scope.buildings}</strong></div>
              <div><small>Entered panes</small><strong>{project.scope.panes}</strong></div>
              <div><small>Paid crew-hours</small><strong>{project.scope.paidCrewHours}</strong></div>
              <div><small>Planned lift days</small><strong>{project.scope.liftDays}</strong></div>
            </div>

            <section className="nexus-graph-panel" aria-label="Project relationship evidence">
              <header><div><GitBranch size={16}/><strong>Connected record map</strong></div>
                <span>Exact sources and local assertions distinguished</span></header>
              <div className="nexus-node-center">
                <Network size={20}/><div><strong>PROJECT 360</strong><small>Local source ID {truncated(project.id,17)}</small></div>
              </div>
              <div className="nexus-relations">
                {project.relations.map(relation=>{
                  const Icon=nodeIcons[relation.kind];
                  const destination=relation.target==='bookings'?base+'/b/exterior/bookings':
                    relation.target==='fleet'?base+'/tools/fleet':base+'/tasks?task='+encodeURIComponent(relation.sourceId??'');
                  return <article key={relation.id} data-evidence={relation.evidence}>
                    <div className="nexus-relation-icon"><Icon size={17}/></div>
                    <div className="nexus-relation-content">
                      <strong>{relation.title}</strong><span className="nexus-evidence-tag">{sourceLabels[relation.evidence]}</span>
                      <p>{relation.detail}</p>
                    </div>
                    <Link href={destination} aria-label={'Open '+relation.kind+' workspace'}><ArrowUpRight size={16}/></Link>
                  </article>;
                })}
              </div>
            </section>

            <div className="nexus-detail-grid">
              <section className="nexus-detail-card">
                <header><CalendarDays size={17}/><h3>Booking evidence</h3></header>
                <strong>{project.booking.status==='loaded-active'?'Exact source booking loaded':'Booking not verified'}</strong>
                <p>{project.booking.status==='loaded-active'
                  ? 'Recorded date '+project.booking.date+(project.booking.timeBlock?' · '+project.booking.timeBlock:'')+
                      '. Current customer scope and crew assignments still require review.'
                  : project.booking.status==='inactive'
                    ? 'The associated booking is inactive or date-invalid. Do not dispatch from the local project.'
                    : 'The booking is unlinked, not loaded, or source access failed. No schedule can be inferred.'}</p>
                <Link href={base+'/b/exterior/bookings'}>Inspect source bookings <ArrowUpRight size={13}/></Link>
              </section>
              <section className="nexus-detail-card">
                <header><Users size={17}/><h3>Workforce scenario</h3></header>
                <strong>{project.crew.state==='shortfall'
                  ? Math.abs(project.crew.capacityGapHours??0)+' paid-hour shortfall'
                  : project.crew.state==='assumptions-fit'?'Entered capacity covers estimate':'Capacity unknown'}</strong>
                <p>{project.crew.crewSize??'Unknown'} planned workers · {project.crew.plannedFieldDays??'Unknown'} days · {project.crew.plannedPaidCrewHourCapacity??'Unknown'} entered paid person-hours. Actual staffing is not confirmed.</p>
                <Link href={base+'/b/exterior/commercial?project='+encodeURIComponent(project.id)}>Review labor model <ArrowUpRight size={13}/></Link>
              </section>
              <section className="nexus-detail-card">
                <header><Truck size={17}/><h3>Fleet candidates</h3></header>
                <strong>{project.assets.length} locally proposed assets</strong>
                <p>{project.assets.filter(a=>a.state==='recorded-ready').length} manually reported ready; {project.assets.filter(a=>a.state!=='recorded-ready').length} still need condition or source review. None are reserved.</p>
                <Link href={base+'/tools/fleet'}>Inspect Fleet Command <ArrowUpRight size={13}/></Link>
              </section>
              <section className="nexus-detail-card">
                <header><ClipboardList size={17}/><h3>Shared task snapshots</h3></header>
                <strong>{project.tasks.length} exact text references</strong>
                <p>{openCount} currently loaded tasks are not Done. Task IDs are server records; local project linkage is still a textual receipt.</p>
                <Link href={base+'/tasks'}>Review Mission Board <ArrowUpRight size={13}/></Link>
              </section>
            </div>

            <section className="nexus-findings">
              <header><div><AlertTriangle size={17}/><h3>Decision & verification queue</h3></div><span>{project.findings.length} sourced observations</span></header>
              {project.findings.length===0&&<p>No modeled exceptions detected in currently loaded records. This is not a certified safe, dispatched or approved job.</p>}
              {project.findings.map(flag=><article key={flag.id} data-severity={flag.severity}>
                <span>{severityLabels[flag.severity]}</span>
                <div><strong>{flag.title}</strong><p>{flag.detail}</p></div>
              </article>)}
            </section>

            <section className="nexus-activity">
              <header><div><Activity size={17}/><h3>Recorded task activity</h3></div>
                <span>Existing shared task events, not simulated project history</span></header>
              {project.activity.length===0&&<div className="nexus-activity-empty"><Clock3 size={18}/><p>No activity events are loaded for linked shared tasks. This does not mean the project or equipment was never changed.</p></div>}
              {project.activity.slice(0,12).map(event=><article key={event.id}>
                <span className="nexus-activity-symbol"><CheckCircle2 size={14}/></span>
                <div><strong>{event.actor||'Recorded actor'} — {actionLabels[event.action]}</strong>
                  <p>{event.taskTitle} · {dayLabel(event.timestamp)}</p></div>
                <Link href={base+'/tasks?task='+encodeURIComponent(event.taskId)} aria-label="Open activity task"><ArrowUpRight size={14}/></Link>
              </article>)}
            </section>
            <div className="nexus-project-footer"><FileCheck2 size={17}/>
              <p>NEXUS links do not constitute a canonical cross-device project database, a signed proposal, a verified customer instruction, or a dispatch approval. Local revisions and task activity are different source histories.</p>
            </div>
          </section>}
        </div>}
      </>}
    </div>}
  </main>;
}
