'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, ClipboardList, ShieldAlert, Truck, Users } from 'lucide-react';
import type { Card } from '@/lib/board';
import type { JobItem } from '@/app/workspace/exterior-actions';
import type { FleetWorkbook } from '@/lib/fleet-command';
import { decodeCommercialPortfolio, type CommercialPortfolio } from '@/lib/atlas-commercial-portfolio';
import {
  buildFleetDispatchProjection, dispatchRowsInHorizon,
  type LoadedBookingState, type ProjectDispatchRow,
} from '@/lib/atlas-fleet-dispatch-plan';

type Props={
  org:string;base:string;mode:'live'|'preview';readOnly:boolean;
  fleet:FleetWorkbook;day:string;bookings:JobItem[];bookingsState:LoadedBookingState;
  cards:Card[];
};
const printedDate=(value:string)=>new Intl.DateTimeFormat('en-US',{
  month:'short',day:'numeric',year:'numeric',timeZone:'UTC',
}).format(new Date(value+'T12:00:00Z'));
const statusText=(value:ProjectDispatchRow['bookingState'])=>({
  unlinked:'No booking linked',
  'source-pending':'Source bookings still loading',
  'source-failed':'Source bookings unavailable',
  'not-loaded':'Booking ID not among loaded source records',
  inactive:'Booking is inactive or its date is invalid',
  loaded:'Booking found in loaded source records',
}[value]);

/** Resource timeline is a non-mutating overlay on valid device-local projects,
 * scoped real booking rows and already-authorized shared task records.
 */
export function AtlasFleetProjectAssignments({org,base,mode,readOnly,fleet,day,bookings,bookingsState,cards}:Props){
  const enabled=mode==='live'&&!readOnly;
  const key='oj-commercial-project-portfolio-v1:'+org;
  const [portfolio,setPortfolio]=useState<CommercialPortfolio|null>(null);
  const [state,setState]=useState<'loading'|'missing'|'valid'|'invalid'>('loading');
  const [error,setError]=useState('');
  const [horizon,setHorizon]=useState<7|30|90>(30);
  useEffect(()=>{
    setPortfolio(null);setState('loading');setError('');
    if(!enabled){setState('missing');return;}
    const refresh=()=>{
      try{
        const raw=window.localStorage.getItem(key);
        if(!raw){setPortfolio(null);setState('missing');return;}
        setPortfolio(decodeCommercialPortfolio(raw,org));setState('valid');setError('');
      }catch(e){
        setPortfolio(null);setState('invalid');
        setError(e instanceof Error?e.message:'Commercial portfolio could not be validated.');
      }
    };
    refresh();
    const onStorage=(event:StorageEvent)=>{if(event.key===key||event.key===null)refresh();};
    window.addEventListener('storage',onStorage);
    window.addEventListener('focus',refresh);
    return ()=>{window.removeEventListener('storage',onStorage);window.removeEventListener('focus',refresh);};
  },[key,org,enabled]);

  const projection=useMemo(()=>portfolio&&enabled
    ?buildFleetDispatchProjection(portfolio,fleet,bookings,bookingsState,cards,org,day)
    :null,[portfolio,enabled,fleet,bookings,bookingsState,cards,org,day]);
  const visible=useMemo(()=>dispatchRowsInHorizon(projection?.rows??[],day,horizon),[projection,day,horizon]);
  const days=useMemo(()=>{
    const groups=new Map<string,ProjectDispatchRow[]>();
    for(const row of visible.scheduled){
      if(!row.bookingDate)continue;
      groups.set(row.bookingDate,[...(groups.get(row.bookingDate)??[]),row]);
    }
    return [...groups];
  },[visible.scheduled]);

  const renderRow=(row:ProjectDispatchRow)=>(
    <article className="atlas-dispatch-job-card" key={row.projectId}>
      <div className="atlas-dispatch-job-head">
        <div><strong>{row.name}</strong><small>{row.buildingCount} scoped building(s) · {row.crewHours} entered PAID crew-hours · {row.liftDays} planned rental days</small></div>
        <span data-state={row.bookingState}>{row.bookingState==='loaded'?'SOURCE LINKED':'NOT VERIFIED'}</span>
      </div>
      <p className="atlas-project-hint">{statusText(row.bookingState)}{row.bookingTime?' · '+row.bookingTime:''}{row.bookingStatus?' · recorded status '+row.bookingStatus:''}. This is not a dispatch authorization.</p>
      <div className="atlas-dispatch-job-crew" data-state={row.crewModel.state}>
        <Users size={14}/>
        <span>{row.crewModel.state==='not-modeled'?'Crew capacity not modeled':
          row.crewModel.state==='no-labor-entered'?'Paid labor hours not entered':
          row.crewModel.crewSize+' crew × '+row.crewModel.productiveHoursPerPersonDay+
            ' productive hr/person/day × '+row.crewModel.plannedFieldDays+' days'}
          {' · '}<b>{row.crewModel.state==='shortfall'?'MODELED SHORTFALL: '+Math.abs(row.crewModel.capacityGapHours??0)+' paid hours':
            row.crewModel.state==='assumptions-fit'?'Entered capacity fits, staff unverified':'Verification required'}</b>
        </span>
      </div>
      <div className="atlas-dispatch-job-assets"><Truck size={14}/><b>{row.plannedAssets.length} candidate asset(s)</b>
        {row.assetWarnings.length>0&&<span>{row.assetWarnings.length} status/availability warnings</span>}
      </div>
      {row.plannedAssets.length>0&&<ul>{row.plannedAssets.map(asset=><li key={asset.id}>{asset.name} <small>— {asset.state==='recorded-ready'?'Recorded ready, not site-verified':asset.state.replaceAll('-',' ')}</small></li>)}</ul>}
      {row.sameDayOverlapIds.length>0&&<p className="atlas-project-alert"><ShieldAlert size={15}/>{row.sameDayOverlapIds.length} candidate asset(s) also appear in another project with a different loaded booking on the same day. Actual time overlap is unverified.</p>}
      <Link className="nexus-fleet-project-link" href={base+"/b/exterior/projects?project="+encodeURIComponent(row.projectId)}>Open in NEXUS / Project 360 <ArrowUpRight size={13}/></Link>
      <div className="atlas-dispatch-job-tasks"><ClipboardList size={14}/><span>{row.linkedTasks.length} explicitly linked shared task(s)</span>
        {row.linkedTasks.slice(0,3).map(task=><Link href={base+'/tasks?task='+encodeURIComponent(task.id)} key={task.id}>{task.title} · {task.stage} <ArrowUpRight size={12}/></Link>)}
      </div>
    </article>
  );
  return <section className="atlas-fleet-project-link atlas-fleet-dispatch-timeline" aria-label="Commercial resource planning timeline">
    <header><div><small>ATLAS / FIELD RESOURCE PLANNING</small><h3>Commercial dispatch planning radar</h3><p>Source-linked booking dates, local equipment candidates and shared task snapshots. No reservations, GPS, crew availability or authorized dispatch decisions are recorded by this view.</p></div>
      <Link href={base+'/b/exterior/commercial'}>Open commercial projects <ArrowUpRight size={15}/></Link>
    </header>
    {!enabled&&<p>Private local commercial resource plans are not inspected in preview or read-only sessions.</p>}
    {enabled&&state==='loading'&&<p>Checking this device’s private commercial portfolio…</p>}
    {enabled&&state==='missing'&&<p>No private commercial project portfolio exists on this device. Save projects and candidate equipment in Commercial Estimating.</p>}
    {enabled&&state==='invalid'&&<p className="atlas-project-alert" role="alert"><ShieldAlert size={15}/> Invalid local commercial portfolio: {error}. No data was overwritten.</p>}
    {enabled&&projection&&<>
      <div className="atlas-fleet-project-kpis">
        <div><b>{projection.rows.length}</b><span>Active local commercial plans</span></div>
        <div><b>{projection.sourcedRows}</b><span>Plans with bookings found in loaded source</span></div>
        <div><b>{projection.unscheduledRows}</b><span>Unlinked or unverified dates</span></div>
        <div><b>{projection.collisionRows}</b><span>Same-day candidate asset contention flags</span></div>
        <div><b>{projection.linkedTaskCount}</b><span>Loaded, explicitly linked shared tasks</span></div>
        <div><b>{projection.crewShortfallRows}</b><span>Paid crew-hour scenario shortfalls</span></div>
      </div>
      <p className="atlas-project-hint atlas-fleet-source-status">
        {bookingsState==='loading'?'Exterior booking source still loading; no booking is currently confirmed by this projection.':
          bookingsState==='failed'?'Exterior booking source failed to load; booking dates remain unknown.':
          'Exterior booking source returned '+projection.loadedBookings+' rows for this account. Coverage may be partial; missing matches remain unknown.'}
      </p>
      <div className="atlas-fleet-horizon"><span><CalendarDays size={15}/> Date horizon (Chicago calendar)</span>
        {([7,30,90] as const).map(value=><button key={value} type="button" aria-pressed={horizon===value} onClick={()=>setHorizon(value)}>{value} days</button>)}
      </div>
      <div className="atlas-fleet-dated-plans">
        {days.length===0&&<p>No validated loaded booking dates within the selected horizon. That is not evidence of an empty company schedule.</p>}
        {days.map(([date,rows])=><section key={date} className="atlas-fleet-day-group">
          <header><h4>{printedDate(date)}</h4><span>{rows.length} local planned project(s), each with an exact loaded booking ID</span></header>
          <div className="atlas-fleet-day-cards">{rows.map(renderRow)}</div>
        </section>)}
      </div>
      {visible.outside.length>0&&<p className="atlas-project-hint">Additional {visible.outside.length} project(s) have a loaded booking date outside this {horizon}-day window. Change the horizon to inspect the relevant dates.</p>}
      <div className="atlas-fleet-unverified">
        <h4>Unscheduled / source unverified <span>{visible.unverified.length}</span></h4>
        <p>Projects without a currently resolved booking date must not be treated as booked capacity.</p>
        <div className="atlas-fleet-day-cards">{visible.unverified.map(renderRow)}</div>
      </div>
    </>}
  </section>;
}
