'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowUpRight, CalendarDays, FileText, GitBranchPlus, Network,
  Search, ShieldCheck, Users, Wallet, Workflow,
} from 'lucide-react';
import type { Card } from '@/lib/board';
import type { Dashboard } from '@/lib/dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import {
  buildOperatingNetwork, operatingKinds,
  type OperatingKind, type OperatingRecord,
} from '@/lib/operating-network';
import { isVenture, ventureList, ventures, type VentureId } from '@/lib/ventures';
import { workDay } from '@/lib/task-workflows';
import { NexusCorporateExtension } from './NexusCorporateExtension';
import type { Activity } from '@/lib/board';

type Props={base:string;org:string;cards:Card[];activity:Activity[];dashboard:Dashboard|null;jobs:JobItem[];
  jobsState:'loading'|'ready'|'failed';mode:'live'|'preview';limited:boolean;readOnly:boolean};
const labels:Record<OperatingKind,string>={
  task:'Task',lead:'CRM lead',booking:'Exterior booking',event:'Calendar',
  document:'Document',finance:'Finance record',message:'Team message',
};
const kinds=new Set<string>(operatingKinds);
const tasksFirst=(r:OperatingRecord)=>r.priority<=5&&r.kind==='task';
const fragment=(base:string,path:string)=>base+path;

export function ConnectedOperations({base,org,cards,activity,dashboard,jobs,jobsState,mode,limited,readOnly}:Props){
  const params=useSearchParams();
  const businessParam=params.get('business');
  const [today,setToday]=useState('');
  const [business,setBusiness]=useState<VentureId|'all'>('all');
  const [kind,setKind]=useState<OperatingKind|'all'>('all');
  const [query,setQuery]=useState('');
  const [focusOnly,setFocusOnly]=useState(false);
  const [limit,setLimit]=useState(60);

  useEffect(()=>{
    const refresh=()=>setToday(workDay(new Date()));
    refresh();const timer=setInterval(refresh,60_000);
    return()=>clearInterval(timer);
  },[]);
  useEffect(()=>setBusiness(businessParam&&isVenture(businessParam)?businessParam:'all'),
    [businessParam]);
  const index=useMemo(()=>today?buildOperatingNetwork({cards,dashboard,jobs,today,limited}):null,
    [cards,dashboard,jobs,today,limited]);
  const relations=useMemo(()=>{
    const map=new Map<string,NonNullable<typeof index>['relations']>();
    for(const relation of index?.relations??[]){
      map.set(relation.fromKey,[...(map.get(relation.fromKey)??[]),relation]);
    }
    return map;
  },[index]);
  const filtered=useMemo(()=>{
    if(!index)return [];
    const needle=query.trim().toLocaleLowerCase('en-US');
    return index.records.filter(record=>
      (business==='all'||record.business===business)&&
      (kind==='all'||record.kind===kind)&&
      (!focusOnly||tasksFirst(record)||(record.kind==='booking'&&record.priority<=5))&&
      (!needle||[record.title,record.detail,record.source,record.kind,record.status]
        .some(field=>field.toLocaleLowerCase('en-US').includes(needle))));
  },[index,business,kind,focusOnly,query]);
  useEffect(()=>setLimit(60),[business,kind,focusOnly,query]);

  return <main className="operations page">
    <header className="operations-hero">
      <p className="tools-eyebrow"><Network size={15} aria-hidden="true"/> OJ HOLDINGS / NEXUS CORPORATE COMMAND</p>
      <h1>One company. <em>One operating network.</em></h1>
      <p>Jump from priorities to CRM, bookings, schedules, finance records and documents without switching mental context. Every item opens its existing system of record; this page is a read-only coordination layer, not a second database.</p>
      <div className="operations-hero-meta">
        <span><ShieldCheck size={15}/>{mode==='preview'?'Fictional demonstration — not company data':'Only authorized, loaded workspace records'}</span>
        <span><CalendarDays size={15}/>{today?today+' · Chicago business day':'Checking business day…'}</span>
      </div>
    </header>
    {index?<><NexusCorporateExtension base={base} org={org} mode={mode} readOnly={readOnly} cards={cards} activity={activity} jobs={jobs} jobsState={jobsState} today={today} />
    <section className="operations-stats" aria-label="Connected operating summary">
      <Link href={base+'/tasks'}><span>Overdue work</span><strong>{index.counts.overdue}</strong><small>Unfinished tasks <ArrowUpRight size={13}/></small></Link>
      <Link href={base+'/tasks'}><span>Needs review / owner</span><strong>{index.counts.review} / {index.counts.unassigned}</strong><small>Review stage / unassigned <ArrowUpRight size={13}/></small></Link>
      <Link href={base+'/b/exterior/calendar'}><span>Next seven dates</span><strong>{index.counts.upcomingBookings}</strong><small>Loaded Exterior bookings <ArrowUpRight size={13}/></small></Link>
      <Link href={base+'/calendar'}><span>Upcoming task deadlines</span><strong>{index.counts.dueNextSeven}</strong><small>From the shared board <ArrowUpRight size={13}/></small></Link>
    </section>
    <section className="operations-businesses" aria-label="Business connections">
      {index.coverage.filter(row=>row.business!==null).map(row=>{
        const v=ventures[row.business!];
        return <button type="button" key={v.id} className={business===v.id?'selected':''} onClick={()=>setBusiness(business===v.id?'all':v.id)}>
          <b>{v.short}</b>
          <span>{row.tasks} tasks · {index.dashboardAvailable?row.leads+' CRM leads':'CRM unknown'} · {row.bookings} loaded bookings</span>
          <small>Explore records <ArrowUpRight size={13}/></small>
        </button>;
      })}
    </section>
    <div className="operations-layout">
      <section className="operations-panel operations-feed">
        <header className="operations-panel-title">
          <div><p className="tools-eyebrow">UNIFIED RECORD DIRECTORY</p><h2><Workflow size={20}/> Operating workstreams</h2></div>
          <span>{filtered.length} matching · {index.shown} indexed</span>
        </header>
        <div className="operations-filters">
          <label className="operations-search"><Search size={17}/><span className="sr-only">Search connected records</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find jobs, people, projects, documents…"/></label>
          <label><span>Business</span><select value={business} onChange={e=>setBusiness(e.target.value as VentureId|'all')}>
            <option value="all">All businesses</option>
            {ventureList.map(v=><option key={v.id} value={v.id}>{v.short}</option>)}
          </select></label>
          <label><span>Record type</span><select value={kind} onChange={e=>setKind(kinds.has(e.target.value)?e.target.value as OperatingKind:'all')}>
            <option value="all">All record types</option>
            {operatingKinds.map(k=><option key={k} value={k}>{labels[k]}</option>)}
          </select></label>
        </div>
        <label className="operations-only"><input type="checkbox" checked={focusOnly} onChange={e=>setFocusOnly(e.target.checked)}/> Priorities and near-term bookings only</label>
        {filtered.length?<ol className="operations-records">
          {filtered.slice(0,limit).map(record=><li key={record.key}>
            <div className="operations-record-meta"><span>{labels[record.kind]}</span><span>{record.business?ventures[record.business].short:'Company-wide'}</span>{record.day&&<time dateTime={record.day}>{record.day}</time>}</div>
            <Link href={fragment(base,record.href)} className="operations-record-title">{record.title}<ArrowUpRight size={16}/></Link>
            <p>{record.detail}</p>
            <small>{record.source} · {record.status}</small>
            {!readOnly&&record.kind==='lead'&&<Link className="operations-handoff" href={base+'?sourceLead='+encodeURIComponent(record.key.slice(5))}>Create linked CRM follow-up task draft <ArrowUpRight size={13}/></Link>}
            {!readOnly&&record.kind==='booking'&&mode==='live'&&<Link className="operations-handoff" href={base+'?sourceBooking='+encodeURIComponent(record.key.slice(8))}>Prepare this booking as a linked task draft <ArrowUpRight size={13}/></Link>}
            {(relations.get(record.key)??[]).length>0&&<div className="operations-relations"><GitBranchPlus size={14}/>
              {(relations.get(record.key)??[]).map(r=><Link key={r.key} href={fragment(base,r.href)} title={r.provenance}>{r.label}<ArrowUpRight size={12}/></Link>)}
            </div>}
          </li>)}
        </ol>:<div className="operations-empty">No loaded records match these filters. This does not establish that the business has no work; inspect reporting coverage.</div>}
        {filtered.length>limit&&<button className="operations-more" type="button" onClick={()=>setLimit(v=>v+60)}>Show next {Math.min(60,filtered.length-limit)} records</button>}
      </section>
      <aside className="operations-aside">
        <section className="operations-panel">
          <h2><GitBranchPlus size={19}/> Exact-ID source and text references</h2>
          <p>Source records are matched by exact ID. Task descriptions may contain explicit ID text, which is NOT a canonical database foreign key; names, phones and emails never establish identity.</p>
          <strong>{index.relations.length} exact-ID links or text references in loaded records</strong>
          <div className="operations-mini-stat"><span>Task → CRM lead</span><b>{index.relations.filter(r=>r.toKey?.startsWith('lead:')).length}</b></div>
          <div className="operations-mini-stat"><span>Task → Exterior booking</span><b>{index.relations.filter(r=>r.toKey?.startsWith('booking:')).length}</b></div>
          <div className="operations-mini-stat"><span>Exterior booking → source lead</span><b>{index.relations.filter(r=>r.toKey===null).length}</b></div>
          <p>Use a record's “Create linked task draft” action to carry an exact source ID into the normal task editor. The draft is not saved until you submit it. Referenced source records are loaded when available; task text does not establish server-level project identity. Names never establish a match.</p>
          <Link href={base+'/tasks'} className="operations-aside-link">Open shared task board <ArrowUpRight size={15}/></Link>
        </section>
        <section className="operations-panel">
          <h2><FileText size={19}/> Source coverage</h2>
          <p>Snapshot has {index.loaded} indexed records{index.capped?' (display capped at 2,500)':''}. Missing systems must never be reported as healthy zeros.</p>
          <ul>{index.warnings.map((warning,i)=><li key={i}>{warning}</li>)}</ul>
          <Link href={base+'/analytics'} className="operations-aside-link">Inspect source reporting <ArrowUpRight size={15}/></Link>
          <Link href={base+'/tools/weekly-review'} className="operations-aside-link">Founder Weekly Review <ArrowUpRight size={15}/></Link>
        </section>
        <section className="operations-panel">
          <h2><Wallet size={19}/> Cross-department shortcuts</h2>
          <div className="operations-shortcuts">
            <Link href={base+'/crm'}><Users size={15}/> Shared CRM <ArrowUpRight size={14}/></Link>
            <Link href={base+'/b/exterior/commercial'}>Commercial Bid War Room <ArrowUpRight size={14}/></Link>
            <Link href={base+'/b/exterior/projects'}><Network size={15}/> NEXUS Project 360 <ArrowUpRight size={14}/></Link>
            <Link href={base+'/finance'}>Recorded finance <ArrowUpRight size={14}/></Link>
            <Link href={base+'/files'}>Company documents <ArrowUpRight size={14}/></Link>
          </div>
        </section>
      </aside>
    </div></>:<section className="operations-panel">Preparing the authorized cross-business record index…</section>}
  </main>;
}

export function ConnectedOperationsPulse({base,cards,dashboard,jobs,today,limited=false,preview=false}:{
  base:string;cards:Card[];dashboard:Dashboard|null;jobs:JobItem[];today:string;limited?:boolean;preview?:boolean;
}){
  const snapshot=useMemo(()=>today?buildOperatingNetwork({cards,dashboard,jobs,today,limited}):null,
    [cards,dashboard,jobs,today,limited]);
  return <section className="operations-pulse" aria-label="Connected company workstreams">
    <div><p className="tools-eyebrow"><Network size={14}/> CORPORATE OPERATIONS</p><h2>Everything connects here.</h2>
      <p>{preview?'Sample-only records.': 'Authorized sources, one navigable workstream. No duplicates or inferred payments.'}</p></div>
    <div className="operations-pulse-data">
      <span><strong>{snapshot?.counts.review??'—'}</strong> in review</span>
      <span><strong>{snapshot?.counts.unassigned??'—'}</strong> need owners</span>
      <span><strong>{snapshot?.counts.upcomingBookings??'—'}</strong> upcoming Exterior bookings</span>
    </div>
    <Link href={base+'/tools/operations'}>Open NEXUS corporate operations <ArrowUpRight size={16}/></Link>
  </section>;
}
