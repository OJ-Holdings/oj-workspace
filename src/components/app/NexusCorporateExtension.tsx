'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Activity, ArrowUpRight, Building2, CircleAlert, Database, GitBranch, Network, ShieldAlert, Truck } from 'lucide-react';
import type { Card, Activity as BoardActivity } from '@/lib/board';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { decodeCommercialPortfolio, type CommercialPortfolio } from '@/lib/atlas-commercial-portfolio';
import { parseLocalFleetDraft } from '@/lib/atlas-field-bridge';
import type { FleetWorkbook } from '@/lib/fleet-command';
import { buildCorporateNexusOverlay } from '@/lib/atlas-nexus-corporate';

type Props={
  base:string;org:string;mode:'live'|'preview';readOnly:boolean;
  cards:Card[];activity:BoardActivity[];jobs:JobItem[];
  jobsState:'loading'|'ready'|'failed';today:string;
};
type Source='loading'|'missing'|'loaded'|'invalid';
const formatTimestamp=(iso:string)=>new Date(iso).toLocaleString('en-US',{
  month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZone:'America/Chicago',
});
export function NexusCorporateExtension({base,org,mode,readOnly,cards,activity,jobs,jobsState,today}:Props){
  const canInspectLocal=mode==='live'&&!readOnly;
  const key='oj-commercial-project-portfolio-v1:'+org;
  const fleetKey='oj-fleet-command-v1:'+org;
  const [portfolio,setPortfolio]=useState<CommercialPortfolio|null>(null);
  const [fleet,setFleet]=useState<FleetWorkbook|null>(null);
  const [localState,setLocalState]=useState<Source>('loading');
  const [fleetState,setFleetState]=useState<Source>('loading');
  const [localError,setLocalError]=useState('');
  const [showAll,setShowAll]=useState(false);

  useEffect(()=>{
    setPortfolio(null);setFleet(null);setLocalState('loading');setFleetState('loading');
    setLocalError('');setShowAll(false);
    if(!canInspectLocal){setLocalState('missing');setFleetState('missing');return;}
    const refresh=()=>{
      try{
        const raw=window.localStorage.getItem(key);
        if(raw){setPortfolio(decodeCommercialPortfolio(raw,org));setLocalState('loaded');setLocalError('');}
        else{setPortfolio(null);setLocalState('missing');}
      }catch(e){
        setPortfolio(null);setLocalState('invalid');
        setLocalError(e instanceof Error?e.message:'Local projects could not be validated.');
      }
      try{
        const raw=window.localStorage.getItem(fleetKey);
        if(raw){setFleet(parseLocalFleetDraft(raw,org));setFleetState('loaded');}
        else{setFleet(null);setFleetState('missing');}
      }catch{setFleet(null);setFleetState('invalid');}
    };
    refresh();
    const onStorage=(event:StorageEvent)=>{
      if(event.key===key||event.key===fleetKey||event.key===null)refresh();
    };
    window.addEventListener('storage',onStorage);window.addEventListener('focus',refresh);
    return ()=>{window.removeEventListener('storage',onStorage);window.removeEventListener('focus',refresh);};
  },[key,fleetKey,org,canInspectLocal]);

  const overlay=useMemo(()=>portfolio&&canInspectLocal&&localState==='loaded'&&today
    ?buildCorporateNexusOverlay({
      org,portfolio,fleet,jobs,jobState:jobsState,cards,activity,today,
    }):null,[org,portfolio,canInspectLocal,localState,fleet,jobs,jobsState,cards,activity,today]);

  // The shared-task ledger is useful to viewers too: its source data comes
  // exclusively from their already-authorized organization task snapshot.
  const authorizedTasks=new Map(cards.filter(c=>c.organization_id===org).map(c=>[c.id,c]));
  const sharedEvents=activity.filter(a=>authorizedTasks.has(a.card_id)&&Number.isFinite(Date.parse(a.created_at)))
    .sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,8);

  return <section className="nexus-corporate" aria-label="NEXUS corporation command extensions">
    <header className="nexus-corporate-head">
      <div><p><Network size={15}/> NEXUS / CONNECTED CORPORATION</p>
        <h2>Projects, field resources, decisions. One review surface.</h2>
        <span>Shared workspace workstreams plus clearly identified private on-device commercial planning. No new database, dispatch or booking operations.</span>
      </div>
      <Link href={base+'/b/exterior/projects'}>Project 360 <ArrowUpRight size={15}/></Link>
    </header>
    <div className="nexus-corporate-body">
      <section className="nexus-corporate-projects">
        <div className="nexus-corporate-section-head">
          <h3><Building2 size={16}/> Local commercial missions</h3>
          <span>{overlay?overlay.activeLocalProjects+' active local':'Source unverified'}</span>
        </div>
        {!canInspectLocal&&<p className="nexus-corporate-placeholder">Preview or read-only mode never loads a founder's private local projects. The task activity feed uses only this session's available task records; preview uses fictional demonstration data.</p>}
        {canInspectLocal&&localState==='loading'&&<p className="nexus-corporate-placeholder">Validating this device’s private commercial portfolio…</p>}
        {canInspectLocal&&localState==='missing'&&<p className="nexus-corporate-placeholder">No commercial portfolio saved on this device. This does not mean the company has no commercial work. <Link href={base+'/b/exterior/commercial'}>Create or import an estimate <ArrowUpRight size={13}/></Link></p>}
        {canInspectLocal&&localState==='invalid'&&<p role="alert" className="nexus-corporate-warning"><ShieldAlert size={15}/> {localError} The original local data was not overwritten.</p>}
        {overlay&&<>
          <div className="nexus-corporate-project-stats">
            <div><b>{overlay.projectsNeedingReview}</b><small>Active plans with modeled exceptions</small></div>
            <div><b>{overlay.sourceMatchedProjects}</b><small>Exact loaded booking IDs</small></div>
            <div><b>{overlay.crewShortfalls}</b><small>Modeled paid-labor shortfalls</small></div>
          </div>
          <p className="nexus-corporate-coverage"><Database size={13}/>{overlay.sourceNote}
            {' · '}Fleet workbook: {fleetState==='loaded'?'validated local source':fleetState==='invalid'?'rejected': 'unavailable'}.
          </p>
          <div className="nexus-corporate-project-list">
            {overlay.projects.length===0&&<p className="nexus-corporate-placeholder">No project entries recorded on this device. No company-wide conclusion can be drawn.</p>}
            {overlay.projects.slice(0,showAll?24:5).map(p=><Link key={p.id} href={base+'/b/exterior/projects?project='+encodeURIComponent(p.id)}>
              <span className="nexus-corporate-indicator" data-attention={p.attention.length>0}/>
              <span className="nexus-corporate-project-text"><strong>{p.name}</strong>
                <small>{p.phase==='archived'?'Archived':p.phase==='founder-review'?'Founder review requested':'Scoping'} · v{p.revision} · {p.bookingState==='loaded'?'loaded booking ID':p.bookingState==='inactive'?'inactive source booking':'booking not confirmed'}</small>
                <small>{p.linkedTaskIds.length} exact shared task text reference(s) · {p.candidateAssets} candidate asset(s), not reserved</small>
              </span>
              <span className="nexus-corporate-project-alert">{p.attention.length>0?<><CircleAlert size={13}/>{p.attention.length}</>:'—'}</span>
              <ArrowUpRight size={15}/>
            </Link>)}
          </div>
          {overlay.projects.length>5&&<button className="nexus-corporate-expand" type="button" onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer local projects':'Show all '+overlay.projects.length+' projects'}</button>}
          <div className="nexus-corporate-actions">
            <Link href={base+'/b/exterior/projects'}><GitBranch size={15}/> Inspect Project 360</Link>
            <Link href={base+'/tools/fleet'}><Truck size={15}/> Fleet resource planning</Link>
          </div>
        </>}
      </section>
      <section className="nexus-corporate-changes">
        <div className="nexus-corporate-section-head"><h3><Activity size={16}/> Shared task activity</h3>
          <span>{sharedEvents.length} recent loaded events</span>
        </div>
        <p className="nexus-corporate-ledger-note">{mode==='preview'?'Fictional sample task activity. ':'From authorized organization task activity only. '}No audit trail is claimed for device-local projects, Fleet workbooks, customer payments or external systems.</p>
        <div className="nexus-corporate-events">
          {sharedEvents.length===0&&<p className="nexus-corporate-placeholder">No shared task changes in the loaded activity window. This does not prove there were no changes elsewhere.</p>}
          {sharedEvents.map(e=>{
            const card=authorizedTasks.get(e.card_id)!;
            return <Link key={e.id} href={base+'/tasks?task='+encodeURIComponent(e.card_id)}>
              <span className="nexus-corporate-event-dot"/>
              <span><strong>{e.action.replaceAll('_',' ')}</strong><small>{card.title} · {card.business}</small></span>
              <time>{formatTimestamp(e.created_at)}</time>
              <ArrowUpRight size={14}/>
            </Link>;
          })}
        </div>
        <Link href={base+'/tasks'} className="nexus-corporate-task-link">Open shared mission board <ArrowUpRight size={14}/></Link>
      </section>
    </div>
    <footer className="nexus-corporate-footer"><ShieldAlert size={14}/> Source booking visibility, real employee availability, customer contract acceptance and canonical Fleet/Commercial database sync remain unverified until independently implemented and tested.</footer>
  </section>;
}
