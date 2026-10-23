'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Activity, AlertTriangle, ArrowUpRight, Building2, CalendarDays, CheckCircle2,
  ClipboardCheck, Database, FileText, GitBranch, Layers3, Network,
  RefreshCcw, Search, ShieldAlert, ShieldCheck, Truck, Users,
} from 'lucide-react';
import type { Card, Activity as BoardActivity } from '@/lib/board';
import type { ExteriorData } from '@/lib/exterior';
import type { FleetWorkbook } from '@/lib/fleet-command';
import { decodeCommercialPortfolio, type CommercialPortfolio } from '@/lib/atlas-commercial-portfolio';
import { parseLocalFleetDraft } from '@/lib/atlas-field-bridge';
import { chicagoDateOf } from '@/lib/atlas-field-bridge';
import { buildNexusOverview, type NexusEvidence, type NexusProject } from '@/lib/atlas-nexus';

type Props={
  org:string;base:string;mode:'live'|'preview';readOnly:boolean;
  exterior:ExteriorData;cards:Card[];activity:BoardActivity[];
};
type SourceState='loading'|'missing'|'loaded'|'invalid';
type Lens='command'|'relations'|'activity';
const usd=(number:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(number);
const shortId=(s:string)=>s.length>16?s.slice(0,12)+'…':s;
const evidenceName:Record<NexusEvidence,string>={
  'verified-source-record':'SOURCE RECORD',
  'device-local-plan':'DEVICE LOCAL',
  'text-reference':'TASK TEXT',
  'unverified':'UNVERIFIED',
};
const evidenceClass=(e:NexusEvidence)=>e==='verified-source-record'?'verified':e==='unverified'?'unknown':e==='device-local-plan'?'local':'text';
const prettyDate=(iso:string)=>Number.isFinite(Date.parse(iso))
  ?new Date(iso).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})
  :'Unavailable';
const sourceKindIcon:Record<string,typeof Network>={
  project:Layers3,building:Building2,booking:CalendarDays,customer:Users,
  equipment:Truck,task:ClipboardCheck,estimate:FileText,
};

export function AtlasNexusProjects({org,base,mode,readOnly,exterior,cards,activity}:Props){
  const enabled=mode==='live'&&!readOnly;
  const key='oj-commercial-project-portfolio-v1:'+org;
  const fleetKey='oj-fleet-command-v1:'+org;
  const params=useSearchParams();
  const fromUrl=params.get('project');
  const [portfolio,setPortfolio]=useState<CommercialPortfolio|null>(null);
  const [fleet,setFleet]=useState<FleetWorkbook|null>(null);
  const [state,setState]=useState<SourceState>('loading');
  const [fleetState,setFleetState]=useState<SourceState>('loading');
  const [error,setError]=useState('');
  const [search,setSearch]=useState('');
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [lens,setLens]=useState<Lens>('command');
  const [onlyAttention,setOnlyAttention]=useState(false);
  const [localToday,setLocalToday]=useState('');

  useEffect(()=>{
    setPortfolio(null);setFleet(null);setSelectedId(null);setState('loading');setFleetState('loading');setError('');
    if(!enabled){setState('missing');setFleetState('missing');return;}
    const reload=()=>{
      setLocalToday(chicagoDateOf(new Date().toISOString())??'');
      try{
        const raw=window.localStorage.getItem(key);
        if(raw){setPortfolio(decodeCommercialPortfolio(raw,org));setState('loaded');setError('');}
        else{setPortfolio(null);setState('missing');}
      }catch(e){
        setPortfolio(null);setState('invalid');
        setError(e instanceof Error?e.message:'Local project records could not be validated.');
      }
      try{
        const raw=window.localStorage.getItem(fleetKey);
        if(raw){setFleet(parseLocalFleetDraft(raw,org));setFleetState('loaded');}
        else{setFleet(null);setFleetState('missing');}
      }catch{
        setFleet(null);setFleetState('invalid');
      }
    };
    reload();
    const onStorage=(event:StorageEvent)=>{
      if(event.key===key||event.key===fleetKey||event.key===null)reload();
    };
    const timer=window.setInterval(()=>setLocalToday(chicagoDateOf(new Date().toISOString())??''),60000);
    window.addEventListener('focus',reload);
    window.addEventListener('storage',onStorage);
    return ()=>{
      window.removeEventListener('focus',reload);
      window.removeEventListener('storage',onStorage);
      window.clearInterval(timer);
    };
  },[enabled,org,key,fleetKey]);

  const snapshot=useMemo(()=>portfolio&&enabled&&state==='loaded'
    ?buildNexusOverview({
      org,portfolio,fleet,
      bookings:exterior.bookings,leads:exterior.leads,
      cards,activity,today:localToday,
      coverage:exterior.coverage?{
        bookings:exterior.coverage.bookings,
        leads:exterior.coverage.leads,
      }:undefined,
    }):null,
    [org,portfolio,enabled,state,fleet,exterior.bookings,exterior.leads,
      exterior.coverage,cards,activity,localToday]);
  const projects=snapshot?.projects??[];
  const filtered=projects.filter(p=>{
    if(onlyAttention&&!p.findings.some(f=>f.priority==='attention'))return false;
    const q=search.trim().toLowerCase();
    return !q||p.name.toLowerCase().includes(q)||p.id.toLowerCase().includes(q)||
      (p.customer.name??'').toLowerCase().includes(q);
  });
  const selected=projects.find(p=>p.id===(selectedId??(fromUrl&&projects.some(x=>x.id===fromUrl)?fromUrl:null)))
    ??filtered[0]??null;
  const taskPath=(id:string)=>base+'/tasks?task='+encodeURIComponent(id);
  const projectPath=(project:NexusProject)=>base+'/b/exterior/commercial?project='+encodeURIComponent(project.id);
  const preparePath=(project:NexusProject)=>base+'/tasks?sourceProject='+encodeURIComponent(project.id);
  const sourceSummary=snapshot?.sourceCoverage;
  const totalBookings=sourceSummary?.bookings.total;
  const totalLeads=sourceSummary?.leads.total;
  const partialSource=(totalBookings!==null&&totalBookings!==undefined&&totalBookings>(sourceSummary?.bookings.loaded??0))||
    (totalLeads!==null&&totalLeads!==undefined&&totalLeads>(sourceSummary?.leads.loaded??0));

  return <main className="atlas-nexus" aria-label="NEXUS Project 360">
    <header className="atlas-nexus-hero">
      <div className="atlas-nexus-brand">
        <span className="atlas-nexus-icon"><Network size={24}/></span>
        <div><p>ATLAS / NEXUS 13.0 · EXTERIOR CARE</p>
          <h2>Project 360 Command</h2>
          <span>One project. Its source-linked customer, booking, work, equipment and exceptions.</span>
        </div>
      </div>
      <div className="atlas-nexus-hero-actions">
        <Link href={base+'/b/exterior/commercial'}><Building2 size={15}/> Commercial Editor <ArrowUpRight size={13}/></Link>
        <Link href={base+'/tools/fleet'}><Truck size={15}/> Fleet Command <ArrowUpRight size={13}/></Link>
      </div>
    </header>

    <div className="atlas-nexus-truth">
      <ShieldCheck size={17}/>
      <p><strong>Source-aware workspace.</strong> Bookings, customers, shared tasks and task activity are drawn from already-authorized loaded source records. Projects, building scope and fleet plans are still saved on <strong>this device only</strong>; a task-text link is not a server foreign key. No dispatch or booking is performed here.</p>
    </div>
    {!enabled
      ?<section className="atlas-nexus-empty"><ShieldAlert size={24}/><h3>Private project context unavailable</h3>
        <p>Preview and read-only roles never inspect a founder's private browser-local commercial or fleet records. Shared work remains available through its own authorized modules.</p></section>
      : state==='loading'
      ?<section className="atlas-nexus-empty" aria-busy="true">Validating local project context…</section>
      : state==='invalid'
      ?<section className="atlas-nexus-empty" role="alert"><AlertTriangle size={24}/><h3>Local portfolio rejected</h3>
        <p>{error} The stored record has not been changed. Recover or export it from the original device before overwriting anything.</p></section>
      : state==='missing'
      ?<section className="atlas-nexus-empty"><Layers3 size={24}/><h3>No commercial portfolio on this device</h3>
        <p>NEXUS cannot invent projects from bookings, leads or task names. Create or import a validated commercial project using the original Commercial Desk first.</p>
        <Link href={base+'/b/exterior/commercial'}>Open commercial project register <ArrowUpRight size={15}/></Link></section>
      :snapshot&&<>
        <div className="atlas-nexus-metrics">
          <article><span>LOCAL PROJECTS</span><strong>{snapshot.active}</strong><small>Active device-local plans</small></article>
          <article><span>SOURCE MATCHES</span><strong>{snapshot.sourceMatchedBookings}</strong><small>Exact loaded booking IDs</small></article>
          <article><span>ATTENTION QUEUE</span><strong>{snapshot.attentionProjects}</strong><small>Projects with modeled flags</small></article>
          <article><span>CREW SHORTFALLS</span><strong>{snapshot.crewShortfalls}</strong><small>Scenario deficits, not staffing</small></article>
          <article><span>SHARED TASKS</span><strong>{snapshot.linkedSharedTasks}</strong><small>Exact task-text references</small></article>
        </div>
        <div className="atlas-nexus-source-health">
          <span><Database size={14}/> Exterior loaded: {sourceSummary?.bookings.loaded??0} booking(s), {sourceSummary?.leads.loaded??0} lead(s)</span>
          <span><Truck size={14}/> Fleet: {fleetState==='loaded'?'local workbook validated':fleetState==='invalid'?'local workbook rejected':'no local workbook'}</span>
          <span><Activity size={14}/> Task history: authorized loaded activity only</span>
          {partialSource&&<span className="atlas-nexus-source-warning"><AlertTriangle size={14}/> Partial source coverage; unmatched links are unknown</span>}
        </div>
        <div className="atlas-nexus-grid">
          <aside className="atlas-nexus-index">
            <div className="atlas-nexus-index-head">
              <h3>Mission portfolio <span>{filtered.length}/{projects.length}</span></h3>
              <label><Search size={15}/><input aria-label="Find a NEXUS project" placeholder="Project, ID, verified customer…" value={search} onChange={e=>setSearch(e.target.value)}/></label>
              <button type="button" onClick={()=>setOnlyAttention(v=>!v)} aria-pressed={onlyAttention}><AlertTriangle size={14}/> Attention only</button>
            </div>
            <div className="atlas-nexus-project-list">
              {filtered.length===0&&<p>No matching local projects. Clearing filters does not modify your data.</p>}
              {filtered.map(p=><button type="button" key={p.id}
                aria-pressed={selected?.id===p.id}
                onClick={()=>{setSelectedId(p.id);setLens('command');window.history.replaceState(null,'',base+'/b/exterior/projects?project='+encodeURIComponent(p.id));}}>
                <span className="atlas-nexus-project-bullet" data-alert={p.findings.some(f=>f.priority==='attention')}/>
                <span className="atlas-nexus-project-main"><strong>{p.name}</strong><small>{p.buildings} building(s) · {p.phase==='archived'?'Archived':p.phase==='founder-review'?'Founder review':'Scoping'} · v{p.revision}</small>
                  <span>{p.booking.state==='matched'?'Exact booking source loaded':p.booking.state==='inactive'?'Booking inactive':'Scheduling unverified'}</span>
                </span>
                <span className="atlas-nexus-project-flags">{p.findings.filter(f=>f.priority==='attention').length||'—'}</span>
              </button>)}
            </div>
          </aside>
          <section className="atlas-nexus-main">
            {!selected
              ?<div className="atlas-nexus-empty"><p>Select an existing project. NEXUS only renders validated, currently loaded data.</p></div>
              :<>
                <header className="atlas-nexus-project-head">
                  <div><p>PROJECT / {shortId(selected.id)} · LOCAL REVISION {selected.revision}</p>
                    <h3>{selected.name}</h3>
                    <span>Saved locally {prettyDate(selected.updatedAt)} · {selected.phase.replaceAll('-',' ')}</span>
                  </div>
                  <div className="atlas-nexus-head-actions">
                    <Link href={projectPath(selected)}>Open exact project <ArrowUpRight size={14}/></Link>
                    {selected.phase!=='archived'&&<Link href={preparePath(selected)}><ClipboardCheck size={14}/> Prepare shared task</Link>}
                  </div>
                </header>
                <nav className="atlas-nexus-lenses" aria-label="Project command views">
                  {([['command','Command'],['relations','Relationship graph'],['activity','Activity & evidence']] as const).map(([id,title])=>
                    <button key={id} aria-current={lens===id?'page':undefined} onClick={()=>setLens(id)} type="button">{title}</button>)}
                </nav>
                {lens==='command'&&<div className="atlas-nexus-command">
                  <div className="atlas-nexus-financials">
                    <div><small>INTERNAL COST SCENARIO</small><strong>{usd(selected.estimatedCost)}</strong><span>Entered direct costs plus contingency</span></div>
                    <div><small>INTERNAL SUGGESTED PRICE</small><strong>{usd(selected.scenarioPrice)}</strong><span>Not a sent quote or receivable</span></div>
                    <div><small>MODELED CONTRIBUTION</small><strong>{usd(selected.modeledContribution)}</strong><span>Not realized profit, cash or net margin</span></div>
                  </div>
                  <div className="atlas-nexus-details">
                    <article>
                      <header><CalendarDays size={17}/><h4>Booking & customer</h4><span data-grade={selected.booking.state==='matched'?'verified':'unknown'}>{selected.booking.state==='matched'?'SOURCE MATCH':'UNVERIFIED'}</span></header>
                      <p><strong>{selected.booking.state==='matched'?selected.booking.date:'Not confirmed'}</strong>
                        {selected.booking.time?' · '+selected.booking.time:''}</p>
                      <small>{selected.booking.state==='matched'?'Exact source booking record loaded. Status: '+(selected.booking.status??'not recorded'):
                        selected.booking.state==='inactive'?'Linked source record is cancelled or denied.':
                        selected.booking.state==='unlinked'?'No booking ID linked.':'Source booking missing from loaded records or invalid.'}</small>
                      <p><strong>{selected.customer.state==='source-linked'?(selected.customer.name??'Unnamed customer'):'Customer not linked'}</strong></p>
                      <small>{selected.customer.state==='source-linked'?'Exact booking.lead_id resolved from authorized Exterior leads.':'No verified booking-to-lead identity; no fuzzy matching.'}</small>
                      <div className="atlas-nexus-module-links">
                        {selected.customer.id&&<Link href={base+'/b/exterior/leads?lead='+encodeURIComponent(selected.customer.id)}>Source customer <ArrowUpRight size={13}/></Link>}
                        <Link href={base+'/b/exterior/calendar'}>Exterior calendar <ArrowUpRight size={13}/></Link>
                      </div>
                    </article>
                    <article>
                      <header><Building2 size={17}/><h4>Scope & resources</h4><span data-grade="local">LOCAL MODEL</span></header>
                      <div className="atlas-nexus-small-metrics"><span>{selected.buildings}<small>Buildings</small></span><span>{selected.panes}<small>Panes</small></span><span>{selected.crewHours}<small>Paid crew-hours</small></span><span>{selected.liftDays}<small>Planned lift-days</small></span></div>
                      <p><strong>{selected.assets.length} candidate equipment items</strong></p>
                      <small>{selected.assets.some(a=>a.state!=='recorded-ready')?'Equipment record contains missing, unverified or service flags.':'Recorded equipment is only a local plan; no reservation or inspection.'}</small>
                      <p><strong>{selected.crewState==='shortfall'?'Labor capacity SHORTFALL':selected.crewState==='assumptions-fit'?'Modeled hours fit on paper':'Crew availability unknown'}</strong></p>
                      <small>Modeled paid-hour gap: {selected.crewGap===null?'unknown':selected.crewGap+' hours'}. Actual staffing remains unverified.</small>
                    </article>
                  </div>
                  <section className="atlas-nexus-exception-queue">
                    <header><ShieldAlert size={17}/><h4>Decision & verification queue</h4><span>{selected.findings.length} findings · not approvals</span></header>
                    {selected.findings.map(f=><div key={f.id} data-priority={f.priority}>
                      <span>{f.priority.toUpperCase()}</span><div><strong>{f.title}</strong><p>{f.detail}</p></div>
                    </div>)}
                    {selected.findings.length===0&&<p>No automated exceptions detected; that does not certify the site, quote, equipment or crew.</p>}
                  </section>
                </div>}
                {lens==='relations'&&<div className="atlas-nexus-relations">
                  <div className="atlas-nexus-graph-anchor"><Network size={21}/><div><strong>{selected.name}</strong><small>Device-local project ID {shortId(selected.id)}</small></div></div>
                  <div className="atlas-nexus-graph-list">
                    {selected.edges.map((e,index)=>{
                      const node=selected.nodes.find(n=>n.id===e.to);
                      if(!node)return null;
                      const Icon=sourceKindIcon[node.kind]??Network;
                      return <div key={e.to+'-'+index} className="atlas-nexus-edge">
                        <div className="atlas-nexus-node-icon"><Icon size={18}/></div>
                        <div><strong>{node.title}</strong><small>{node.secondary}</small><p>{e.label}</p></div>
                        <span data-grade={evidenceClass(e.evidence)}>{evidenceName[e.evidence]}</span>
                      </div>;
                    })}
                  </div>
                  <p className="atlas-nexus-legend"><CheckCircle2 size={14}/> SOURCE RECORD = entity loaded from the authorized service. DEVICE LOCAL = manually saved estimate, building or asset plan. TASK TEXT = an ID mentioned in a shared task body, not a server-side project relationship. UNVERIFIED = no matching usable source record.</p>
                </div>}
                {lens==='activity'&&<div className="atlas-nexus-activity">
                  <div className="atlas-nexus-activity-stats"><Activity size={17}/><div><strong>{selected.activity.length} loaded task activity events</strong><small>Only existing shared task actions are audited here. Changes to this device's commercial and fleet workbooks are NOT server-audited.</small></div></div>
                  {selected.activity.length===0&&<p>No task-scoped activity events in the loaded authorized window. This is not an absence-of-action guarantee.</p>}
                  {selected.activity.map(a=><article key={a.id}>
                    <span className="atlas-nexus-activity-dot"/><div><strong>{a.action.replaceAll('_',' ')}</strong><small>{a.title}</small><time>{prettyDate(a.at)}</time></div>
                    <Link href={taskPath(a.cardId)}>Open task <ArrowUpRight size={13}/></Link>
                  </article>)}
                  <section className="atlas-nexus-related-tasks">
                    <h4>Referenced shared tasks</h4>
                    {selected.tasks.length===0&&<p>No exact local project ID text references loaded. Save a reviewed task from Commercial Estimating to create an explicit shared snapshot.</p>}
                    {selected.tasks.map(t=><Link key={t.id} href={taskPath(t.id)}>
                      <ClipboardCheck size={15}/><span>{t.title}<small>{t.stage} · {t.assignee||'Unassigned'} · due {t.dueDate||'unentered'}</small></span><ArrowUpRight size={13}/>
                    </Link>)}
                  </section>
                </div>}
                <footer className="atlas-nexus-footer">
                  <span><GitBranch size={13}/> Project and fleet state are browser-local. Graph edges record evidence types—not universal server identities.</span>
                  <Link href={projectPath(selected)}>Review source project <ArrowUpRight size={13}/></Link>
                </footer>
              </>}
          </section>
        </div>
      </>}
  </main>;
}
