'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Activity, ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarClock, ChartNoAxesCombined,
  CheckCheck, ChevronRight, CircleAlert, Command, Compass, Database, FileText,
  GitBranch, LayoutDashboard, LockKeyhole, Network, Plus, Radar, ShieldCheck,
  Sparkles, Target, Truck, Users, Wallet, X,
} from 'lucide-react';
import type { Board } from './useBoard';
import type { DashboardStore } from './useDashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import type { WorkspaceMetrics } from '@/lib/metrics';
import { money } from '@/lib/metrics';
import { ventures, type VentureId } from '@/lib/ventures';
import { atlasModes, atlasSignalsForMode, buildAtlasSnapshot, type AtlasMode } from '@/lib/atlas-command';
import { buildOperatingNetwork } from '@/lib/operating-network';
import type { IntelligenceSignal } from '@/lib/corporate-intelligence';

type Props={
  base:string;board:Board;store:DashboardStore;jobs:JobItem[];
  metrics:WorkspaceMetrics;today:string;mode:'preview'|'live';readOnly:boolean;
  displayName:string;limited:boolean;
};
const modeText:Record<AtlasMode,{title:string;eyebrow:string;description:string}>={
  today:{title:'Today / Mission Control',eyebrow:'EXECUTIVE PRIORITIES',description:'The items your current records say need a decision, owner, or next move.'},
  operations:{title:'Operations / Execution',eyebrow:'DELIVERY & READINESS',description:'Open execution work and upcoming service commitments from loaded sources.'},
  growth:{title:'Growth / Pipeline',eyebrow:'REVENUE DEVELOPMENT',description:'Lead and proposal-stage evidence—not presumed contact or closed sales.'},
  money:{title:'Money / Treasury',eyebrow:'FINANCIAL EVIDENCE',description:'Recorded entries only. Cash collection and company profit are not verified here.'},
  strategy:{title:'Strategy / Command Table',eyebrow:'FOUNDER DIRECTION',description:'The most important current commitments, plus explicit planning workbenches.'},
};
const navLabels:Record<AtlasMode,string>={today:'Today',operations:'Operations',growth:'Growth',money:'Money',strategy:'Strategy'};
const modeIcons={today:LayoutDashboard,operations:Truck,growth:Compass,money:Wallet,strategy:Target};
const chip=(id:VentureId|null)=>id?ventures[id].short:'Company-wide';
const formatDay=(day:string)=>new Date(day+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'});
const sevLabel={urgent:'Overdue',attention:'Attention',review:'Check record',informational:'Upcoming'} as const;

export function AtlasHQ({base,board,store,jobs,metrics,today,mode,readOnly,displayName,limited}:Props){
  const [active,setActive]=useState<AtlasMode>('today');
  const [selected,setSelected]=useState<string|null>(null);
  const snapshot=useMemo(()=>today?buildAtlasSnapshot({
    cards:board.data.cards,dashboard:store.data,jobs,today,limited}):null,
    [board.data.cards,store.data,jobs,today,limited]);
  const network=useMemo(()=>today?buildOperatingNetwork({
    cards:board.data.cards,dashboard:store.data,jobs,today,limited}):null,
    [board.data.cards,store.data,jobs,today,limited]);
  const signals=snapshot?atlasSignalsForMode(snapshot,active):[];
  const selectedSignal=snapshot?.intelligence.signals.find(s=>s.id===selected)??null;
  const attached=selectedSignal&&network?network.relations.filter(r=>r.toKey===selectedSignal.id||r.fromKey===selectedSignal.id):[];
  const runTask=(signal:IntelligenceSignal)=>{
    if(signal.category==='Execution'&&signal.recordId){
      const c=board.data.cards.find(card=>card.id===signal.recordId);
      if(c){board.openCard(c);return;}
    }
    setSelected(signal.id);
  };
  const moneyEntries=snapshot?.finance;
  const ownerLabel=mode==='preview'?'Fictional workspace':displayName||'Founder workspace';
  const issues=snapshot?.intelligence.totals;
  return <section className="atlas-hq" aria-label="ATLAS executive command">
    <header className="atlas-hq-hero">
      <div className="atlas-hq-hero-copy">
        <p className="atlas-overline"><span className="atlas-orbit-dot"/> OJ HOLDINGS <span className="atlas-overline-sep"/> ATLAS / EXECUTIVE COMMAND</p>
        <p className="atlas-hq-date">{today?formatDay(today):'Loading business date'} <span>· America/Chicago</span></p>
        <h1>The company.<br/><em>Under your command.</em></h1>
        <p className="atlas-hq-lead">One headquarters for your people, jobs, equipment, clients and commitments. Real records first. Every decision has a source.</p>
        <div className="atlas-hq-hero-actions">
          <Link className="atlas-action-primary" href={base+'/tasks'}>Open mission board <ArrowUpRight size={17}/></Link>
          <Link className="atlas-action-secondary" href={base+'/b/exterior/commercial'}>Commercial War Room <BriefcaseBusiness size={16}/></Link>
          <Link className="atlas-action-secondary" href={base+'/tools/fleet'}>Fleet Command <Truck size={16}/></Link>
        </div>
      </div>
      <div className="atlas-hq-orbit" aria-hidden="true">
        <div className="atlas-hq-orbit-ring atlas-hq-orbit-ring-1"/>
        <div className="atlas-hq-orbit-ring atlas-hq-orbit-ring-2"/>
        <div className="atlas-hq-orbit-ring atlas-hq-orbit-ring-3"/>
        <div className="atlas-hq-orbit-core"><span>ATLAS</span><strong>OJ</strong><small>CORPORATE SYSTEM</small></div>
        <span className="atlas-hq-orbit-marker atlas-hq-orbit-marker-a"/>
        <span className="atlas-hq-orbit-marker atlas-hq-orbit-marker-b"/>
      </div>
      <div className="atlas-hq-hero-footer">
        <span><ShieldCheck size={14}/>{mode==='preview'?'SAMPLE DATA / FICTIONAL':'AUTHORIZED WORKSPACE RECORDS'}</span>
        <span><Database size={14}/>{snapshot?.sourceState==='unknown'?'SOURCE COVERAGE NOT REPORTED':snapshot?.sourceState==='partial'?'SOME SOURCE DATA INCOMPLETE':'PROVIDER STATES REPORTED'}</span>
        <span>{ownerLabel}</span>
      </div>
    </header>

    <div className="atlas-modebar" aria-label="Executive command modes">
      <div className="atlas-modes" role="group" aria-label="HQ operating mode">
        {atlasModes.map(m=>{const Icon=modeIcons[m];return <button key={m} type="button" onClick={()=>{setActive(m);setSelected(null)}} aria-pressed={active===m}><Icon size={16}/>{navLabels[m]}</button>})}
      </div>
      <Link href={base+'/tools/weekly-review'} className="atlas-review-link">Founder weekly review <ArrowUpRight size={15}/></Link>
    </div>

    <div className="atlas-pulse" aria-label="Current loaded workspace counts">
      <Link href={base+'/tasks'} className="atlas-pulse-card">
        <span><Activity size={15}/> OPEN WORK</span><strong>{issues?.openTasks??'—'}</strong>
        <small>{issues?issues.overdueTasks+' overdue · '+issues.dueToday+' due today':'Waiting for task snapshot'}</small>
      </Link>
      <Link href={base+'/tasks?focus=review'} className="atlas-pulse-card">
        <span><CircleAlert size={15}/> AWAITING REVIEW</span><strong>{issues?.reviewTasks??'—'}</strong>
        <small>{issues?issues.unassignedTasks+' unassigned open tasks':'Board unknown'} · not approvals</small>
      </Link>
      <Link href={base+'/b/exterior/calendar'} className="atlas-pulse-card">
        <span><CalendarClock size={15}/> NEXT 7 DAYS</span><strong>{issues?.upcomingExterior??'—'}</strong>
        <small>Loaded Exterior bookings</small>
      </Link>
      <Link href={base+'/finance'} className="atlas-pulse-card atlas-pulse-money">
        <span><Wallet size={15}/> REVENUE-TAGGED ENTRIES</span><strong>{moneyEntries?.available?money(moneyEntries.recordedRevenue):'Unknown'}</strong>
        <small>{today?today.slice(0,7):'This month'} · recorded, NOT collected cash</small>
      </Link>
    </div>

    <section className="atlas-section">
      <div className="atlas-section-heading"><div><p className="atlas-overline">COMPANY DIVISIONS / 04</p><h2>Four ventures. One command.</h2></div><Link href={base+'/businesses'}>Open business directory <ArrowRight size={15}/></Link></div>
      <div className="atlas-ventures">
        {(snapshot?.ventures??(['exterior','solutions','essentials','content'] as const).map(id=>({id,active:id!=='content',openTasks:0,leads:null,upcomingBookings:null,primarySignal:null}))).map(v=>{
          const meta=ventures[v.id];
          return <div key={v.id} className={'atlas-venture atlas-venture-'+v.id}>
            <div className="atlas-venture-head"><span className="atlas-venture-mark"><Image src={meta.mark} width={40} height={40} alt=""/></span><span className="atlas-venture-meta"><strong>{meta.name}</strong><small>{v.active?'Operating room':'Production studio · preview only'}</small></span></div>
            <div className="atlas-venture-values"><div><strong>{v.openTasks}</strong><span>open tasks</span></div><div><strong>{v.leads===null?'—':v.leads}</strong><span>{v.leads===null?'CRM unknown':'shared CRM leads'}</span></div></div>
            <p>{v.primarySignal?v.primarySignal.title:v.active?'No flagged source item in this snapshot. Not an all-clear.':'Persistence not enabled; no live studio data.'}</p>
            {v.active?<Link href={base+'/b/'+v.id}>Enter operating room <ArrowUpRight size={14}/></Link>:<Link href={base+'/tools/content-preview'}>View fictional preview <ArrowUpRight size={14}/></Link>}
          </div>;
        })}
      </div>
    </section>

    <div className="atlas-deck">
      <section className="atlas-deck-main">
        <header className="atlas-deck-heading">
          <div><p className="atlas-overline">{modeText[active].eyebrow}</p><h2>{modeText[active].title}</h2><p>{modeText[active].description}</p></div>
          {!readOnly&&<button type="button" onClick={()=>board.openCard(undefined,{title:''})} className="atlas-mini-action"><Plus size={15}/> New task</button>}
        </header>
        {active==='money'? <div className="atlas-money-workspace">
          <div className="atlas-money-entries"><span>Revenue-tagged records, not cash</span><strong>{moneyEntries?.available?money(moneyEntries.recordedRevenue):'Unavailable'}</strong><small>{moneyEntries?.available?moneyEntries.revenueEntries+' entries loaded':'Finance records not supplied'}</small></div>
          <div className="atlas-money-entries"><span>Cost-tagged records, not verified paid expenses</span><strong>{moneyEntries?.available?money(moneyEntries.recordedCosts):'Unavailable'}</strong><small>{moneyEntries?.available?moneyEntries.costEntries+' entries loaded':'Finance records not supplied'}</small></div>
          <div className="atlas-money-warning"><ShieldCheck size={19}/><div><b>No inferred net profit.</b><p>Values may include estimates and imported records. Cash, settlement and completeness require separate evidence.</p></div></div>
          <Link href={base+'/finance'} className="atlas-deck-link">Inspect company finance records <ArrowRight size={15}/></Link>
        </div>:active==='growth'? <div className="atlas-growth-workspace">
          {(['New','Contacted','Qualified','Proposal','Won','Lost'] as const).map(stage=><div key={stage}><span>{stage}</span><strong>{store.data?store.data.leads.filter(l=>l.stage===stage).length:'—'}</strong></div>)}
          <p>Loaded workspace CRM stages only. Imported GHL prospects and LSA records may be separate; stage counts do not prove outreach, wins, collections or source completeness.</p>
          <Link href={base+'/crm'} className="atlas-deck-link">Inspect lead pipeline <ArrowRight size={15}/></Link>
        </div>:active==='strategy'? <div className="atlas-strategy-workspace">
          <Link href={base+'/tools/scenarios'}><ChartNoAxesCombined size={23}/><strong>Capital Scenario Lab</strong><small>Model possibilities; no balances or budgets are changed.</small><ArrowUpRight size={15}/></Link>
          <Link href={base+'/tools/weekly-review'}><Target size={23}/><strong>Founder Weekly Review</strong><small>Priorities, ownership and same-weekday comparisons.</small><ArrowUpRight size={15}/></Link>
          <Link href={base+'/tools/intelligence'}><Radar size={23}/><strong>Corporate Intelligence</strong><small>Investigate ranked exceptions and incomplete sources.</small><ArrowUpRight size={15}/></Link>
        </div>:null}
        {active==='operations'&&<div className="atlas-owner-strip">{snapshot?.founders.length?snapshot.founders.map(f=><div key={f.name}><span>{f.name}</span><strong>{f.open} open</strong><small>{f.inReview} review · {f.overdue} overdue</small></div>):<p>No recorded task owners. This is not a live staffing report.</p>}</div>}
        <div className="atlas-mission-head"><span>{active==='today'?'PRIORITY SIGNALS':'SOURCE-BASED SIGNALS'}</span><span>{signals.length} items in loaded evidence</span></div>
        {signals.length>0?<ol className="atlas-missions">{signals.slice(0,7).map((signal,i)=><li key={signal.id} className={selected===signal.id?'atlas-mission-selected':''}>
          <span className="atlas-mission-num">{String(i+1).padStart(2,'0')}</span>
          <button type="button" onClick={()=>runTask(signal)} aria-label={'Inspect '+signal.title}><span className={'atlas-severity atlas-severity-'+signal.severity}>{sevLabel[signal.severity]}</span><strong>{signal.title}</strong><small>{chip(signal.business)} · {signal.source}</small></button>
          <button type="button" className="atlas-inspect" title="Inspect source evidence" onClick={()=>setSelected(signal.id)} aria-label={'Open evidence for '+signal.title}><ChevronRight size={18}/></button>
        </li>)}</ol>:<div className="atlas-empty">No matching decision signals were flagged in the records loaded for this mode. Source coverage may be incomplete; this is not an all-clear.</div>}
        <div className="atlas-deck-footer"><Link href={base+'/tools/intelligence'}>Inspect complete source-linked briefing <ArrowRight size={16}/></Link><span>Read-only analysis · human decisions</span></div>
      </section>

      <aside className="atlas-deck-side">
        {selectedSignal?<section className="atlas-side-card atlas-context" aria-label="Selected record context">
          <header><span className="atlas-overline"><Network size={13}/> RECORD CONTEXT</span><button onClick={()=>setSelected(null)} aria-label="Close source details"><X size={17}/></button></header>
          <span className={'atlas-severity atlas-severity-'+selectedSignal.severity}>{sevLabel[selectedSignal.severity]}</span>
          <h3>{selectedSignal.title}</h3><p>{selectedSignal.explanation}</p>
          <dl><div><dt>Business</dt><dd>{chip(selectedSignal.business)}</dd></div><div><dt>Evidence</dt><dd>{selectedSignal.source}</dd></div>{selectedSignal.date&&<div><dt>Recorded date</dt><dd>{selectedSignal.date}</dd></div>}</dl>
          {attached.length>0&&<div className="atlas-relations"><b><GitBranch size={14}/> Exact identifier links</b>{attached.map(link=><Link key={link.key} href={base+link.href} title={link.provenance}>{link.label}<ArrowUpRight size={13}/></Link>)}</div>}
          <Link href={base+selectedSignal.destination} className="atlas-context-cta">Open authoritative record <ArrowUpRight size={15}/></Link>
          {!readOnly&&selectedSignal.id.startsWith('lead:')&&<Link href={base+'?sourceLead='+encodeURIComponent(selectedSignal.recordId||'')} className="atlas-context-secondary">Prepare linked follow-up task <Plus size={14}/></Link>}
          {!readOnly&&mode==='live'&&selectedSignal.id.startsWith('booking:')&&<Link href={base+'?sourceBooking='+encodeURIComponent(selectedSignal.recordId||'')} className="atlas-context-secondary">Prepare linked booking task <Plus size={14}/></Link>}
          <small>Relationship links rely on identifiers, not matching names. Opening this panel changes no records.</small>
        </section>:<section className="atlas-side-card atlas-agenda">
          <header><p className="atlas-overline"><CalendarClock size={13}/> OPERATIONS / NEXT SEVEN DAYS</p><Link href={base+'/calendar'} aria-label="Open full calendar"><ArrowUpRight size={16}/></Link></header>
          <h3>The next commitments.</h3>
          {snapshot?.schedule.length?<ol>{snapshot.schedule.slice(0,6).map(event=><li key={event.key}>
            <time dateTime={event.date}>{formatDay(event.date)}</time>
            <Link href={base+event.href}><strong>{event.title}</strong><small>{chip(event.business)} · {event.detail}</small></Link>
          </li>)}</ol>:<p>No scheduled items loaded for these dates. Exterior bookings and provider calendars may be incomplete or unavailable.</p>}
          <Link className="atlas-deck-link" href={base+'/calendar'}>Go to corporate calendar <ArrowRight size={15}/></Link>
        </section>}
        <section className="atlas-side-card atlas-source-card">
          <header><p className="atlas-overline"><Database size={13}/> SOURCE INTEGRITY</p><Link href={base+'/analytics'} aria-label="Inspect reporting coverage"><ArrowUpRight size={16}/></Link></header>
          <h3>{snapshot?.sourceState==='unknown'?'Coverage not reported':snapshot?.sourceState==='partial'?'Some sources need review':'Provider status supplied'}</h3>
          {store.data?.reporting?.sources?.length?<ul>{store.data.reporting.sources.map(s=><li key={s.id}><span className={'atlas-source-dot atlas-source-'+s.state}/><span><b>{s.label}</b><small>{s.state.replace('-',' ')} · {s.detail}</small></span></li>)}</ul>:<p>Provider status details were not supplied with the loaded snapshot. Unknown must not appear as connected.</p>}
          {limited&&<p className="atlas-limited"><CircleAlert size={14}/> Task snapshot is capped; counts may be understated.</p>}
          <Link href={base+'/tools/systems'} className="atlas-deck-link">Open release & systems status <ArrowRight size={14}/></Link>
        </section>
        <section className="atlas-side-card atlas-shortcuts">
          <p className="atlas-overline"><Command size={14}/> COMMAND SHORTCUTS</p>
          <Link href={base+'/crm'}><Users size={15}/> Clients & CRM <ArrowUpRight size={14}/></Link>
          <Link href={base+'/b/exterior/commercial'}><BriefcaseBusiness size={15}/> Commercial bids <ArrowUpRight size={14}/></Link>
          <Link href={base+'/tools/fleet'}><Truck size={15}/> Fleet & Rig Lab <ArrowUpRight size={14}/></Link>
          <Link href={base+'/files'}><FileText size={15}/> Company Vault <ArrowUpRight size={14}/></Link>
          <Link href={base+'/tools'}><Sparkles size={15}/> Capability Library <ArrowUpRight size={14}/></Link>
        </section>
      </aside>
    </div>
    <footer className="atlas-hq-foot"><LockKeyhole size={14}/> ATLAS displays authorized loaded records. No automatic sends, payments, approvals, publishing or newly inferred data relationships.</footer>
  </section>;
}
