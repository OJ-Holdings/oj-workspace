'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity, AlertTriangle, ArrowLeft, ArrowUpRight, BadgeCheck, ClipboardCheck,
  Download, Droplets, FileUp, Gauge, HardHat, PackagePlus, Plus, RotateCcw,
  Save, Settings2, ShieldAlert, ShieldCheck, Trash2, Truck, Wrench, X,
} from 'lucide-react';
import { AtlasFieldBridge } from './AtlasFieldBridge';
import { AtlasFleetProjectAssignments } from './AtlasFleetProjectAssignments';
import { AtlasFleetAssetTasks } from './AtlasFleetAssetTasks';
import type { Card } from '@/lib/board';
import type { JobItem } from '@/app/workspace/exterior-actions';
import type { LoadedBookingState } from '@/lib/atlas-fleet-dispatch-plan';
import { chicagoDateOf } from '@/lib/atlas-field-bridge';
import {
  assetHealth, calculateRigLoad, decodeFleet, emptyFleet, encodeFleet,
  fleetKinds, fleetStatuses, readingUnits, readinessItems, validateFleet,
  type FleetAsset, type FleetKind, type FleetMaintenance, type FleetStatus,
  type FleetWorkbook, type ReadingUnit,
} from '@/lib/fleet-command';

type Props = { base: string; organizationId: string; mode: 'live' | 'preview'; readOnly: boolean; bookings:JobItem[]; bookingsState:LoadedBookingState; cards:Card[] };
type Tab = 'overview'|'assets'|'maintenance'|'readiness'|'rig';
const tabNames: Record<Tab, string> = {
  overview: 'Command', assets: 'Asset Registry', maintenance: 'Maintenance',
  readiness: 'Readiness', rig: 'Rig Lab',
};
const kindNames: Record<FleetKind,string> = {
  vehicle:'Vehicle', 'pressure-washer':'Pressure washer', 'water-system':'Water system',
  'rig-component':'Rig component',tool:'Tool',other:'Other asset',
};
const statusNames: Record<FleetStatus,string> = {
  unverified:'Not inspected', ready:'Operational', 'needs-service':'Needs service', 'out-of-service':'Out of service',
};
const usd=(v:number)=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(v);
const numberOrNull=(raw:string):number|null=>raw.trim()?Number(raw):null;
const newId=()=>crypto.randomUUID().replace(/-/g,'');
const todayLocal=()=>{
  const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date());
  const get=(key:string)=>parts.find(p=>p.type===key)?.value??'';
  return get('year')+'-'+get('month')+'-'+get('day');
};
const emptyAsset=():FleetAsset=>({
  id:newId(),name:'',kind:'vehicle',model:'',status:'unverified',unit:'miles',
  reading:null,nextServiceReading:null,nextServiceDate:null,notes:'',createdAt:new Date().toISOString(),
});

const demoAsset: FleetAsset[]=[
  {id:'demo-explorer',name:'Example: Field vehicle',kind:'vehicle',model:'2017 utility vehicle',
    status:'ready',unit:'miles',reading:null,nextServiceReading:null,nextServiceDate:null,
    notes:'Fictional preview record. Add your real readings after opening the live Fleet Command.',createdAt:'2026-10-01T12:00:00.000Z'},
  {id:'demo-washer',name:'Example: Pressure washer',kind:'pressure-washer',model:'GX390-class washer',
    status:'needs-service',unit:'hours',reading:null,nextServiceReading:null,nextServiceDate:null,
    notes:'Fictional preview record. Maintenance status is not an actual equipment diagnosis.',createdAt:'2026-10-01T12:00:00.000Z'},
];
const demoWorkbook=(org:string):FleetWorkbook=>({...emptyFleet(org),assets:demoAsset});

export function FleetCommand({base,organizationId,mode,readOnly,bookings,bookingsState,cards}:Props) {
  const preview=mode==='preview';
  const canEdit=!preview && !readOnly;
  const storageKey='oj-fleet-command-v1:'+organizationId;
  const [workbook,setWorkbook]=useState<FleetWorkbook>(()=>emptyFleet(organizationId));
  const [ready,setReady]=useState(false);
  const [tab,setTab]=useState<Tab>('overview');
  const [assetEditor,setAssetEditor]=useState<FleetAsset|null>(null);
  const [serviceAsset,setServiceAsset]=useState<string>('');
  const [serviceSummary,setServiceSummary]=useState('');
  const [serviceCost,setServiceCost]=useState('');
  const [serviceReading,setServiceReading]=useState('');
  const [serviceDate,setServiceDate]=useState('');
  const [notice,setNotice]=useState('');
  const [error,setError]=useState('');
  const [query,setQuery]=useState('');
  const [statusFilter,setStatusFilter]=useState<'all'|FleetStatus>('all');
  const [day,setDay]=useState('');
  useEffect(()=>{const timer=window.setInterval(()=>setDay(todayLocal()),60_000);return ()=>window.clearInterval(timer);},[]);
  const fileRef=useRef<HTMLInputElement>(null);

  useEffect(()=>{
    setDay(todayLocal());
    setAssetEditor(null);
    setNotice('');
    setError('');
    if(preview){
      setWorkbook(demoWorkbook(organizationId));setReady(true);return;
    }
    if(readOnly){
      setWorkbook(emptyFleet(organizationId));setReady(true);return;
    }
    try{
      const saved=window.localStorage.getItem(storageKey);
      setWorkbook(saved?decodeFleet(saved,organizationId):emptyFleet(organizationId));
    }catch(e){
      setWorkbook(emptyFleet(organizationId));
      setError('Saved Fleet Command data could not be read. The browser draft was not overwritten; export or inspect it before adding records.');
    }
    setReady(true);
  },[organizationId,mode,storageKey,preview,readOnly]);

  function persist(next:FleetWorkbook,message:string) {
    if(!canEdit || !ready)return;
    try{
      const clean=validateFleet(next,organizationId);
      const encoded=encodeFleet(clean,organizationId);
      window.localStorage.setItem(storageKey,encoded);
      setWorkbook(clean);setError('');setNotice(message);
    }catch(e){setError(e instanceof Error?e.message:'Unable to save the Fleet Command draft.');}
  }
  const statuses=useMemo(()=>workbook.assets.map(asset=>({...asset,health:assetHealth(asset,day)})),[workbook.assets,day]);
  const attention=statuses.filter(a=>a.health==='due'||a.health==='needs-service'||a.health==='out-of-service').length;
  const soon=statuses.filter(a=>a.health==='due-soon').length;
  const dueNow=statuses.filter(a=>a.health==='due'||a.health==='needs-service'||a.health==='out-of-service');
  const filtered=statuses.filter(a=>(statusFilter==='all'||a.status===statusFilter) &&
    [a.name,a.model,kindNames[a.kind],a.notes].some(v=>v.toLowerCase().includes(query.toLowerCase())));
  const load=useMemo(()=>calculateRigLoad(workbook.rig),[workbook.rig]);
  const completed=workbook.readiness.checked.length;
  // Never carry a previous day’s inspection into today’s departure indicators.
  const checklistFresh=!!day && chicagoDateOf(workbook.readiness.updatedAt)===day;
  const todayChecked=checklistFresh?completed:0;

  function saveAsset(){
    if(!assetEditor||!canEdit)return;
    const normalized={...assetEditor,name:assetEditor.name.trim(),model:assetEditor.model.trim()};
    const index=workbook.assets.findIndex(a=>a.id===normalized.id);
    const assets=index>=0?workbook.assets.map(a=>a.id===normalized.id?normalized:a):[...workbook.assets,normalized];
    const next={...workbook,assets};
    try{validateFleet(next,organizationId);}catch(e){setError(e instanceof Error?e.message:'Invalid asset.');return;}
    persist(next,index<0?'Asset added to this browser draft.':'Asset updated in this browser draft.');
    setAssetEditor(null);
  }
  function deleteAsset(id:string){
    if(!canEdit||!window.confirm('Remove this asset AND its local maintenance history? This action is not reversible unless you exported a backup.'))return;
    persist({...workbook,assets:workbook.assets.filter(a=>a.id!==id),
      maintenance:workbook.maintenance.filter(m=>m.assetId!==id)},'Asset and its local service history removed.');
    setAssetEditor(null);
  }
  function addService(){
    if(!canEdit)return;
    const entry:FleetMaintenance={
      id:newId(),assetId:serviceAsset,date:serviceDate,summary:serviceSummary.trim(),
      cost:numberOrNull(serviceCost),reading:numberOrNull(serviceReading),
    };
    try{validateFleet({...workbook,maintenance:[...workbook.maintenance,entry]},organizationId);}
    catch(e){setError(e instanceof Error?e.message:'Invalid maintenance entry.');return;}
    persist({...workbook,maintenance:[...workbook.maintenance,entry]},'Maintenance entry saved in this browser.');
    setServiceSummary('');setServiceCost('');setServiceReading('');
  }
  function removeService(id:string){
    if(!canEdit||!window.confirm('Delete this local maintenance record?'))return;
    persist({...workbook,maintenance:workbook.maintenance.filter(m=>m.id!==id)},'Maintenance entry removed.');
  }
  function toggleReadiness(id:(typeof readinessItems)[number]['id']){
    if(!canEdit || !day)return;
    if(!checklistFresh && completed>0 &&
      !window.confirm('These checks were recorded on another day. Start a new checklist for today? Prior checked items will be replaced. Export your workbook first if you need to retain them.'))return;
    const previous=checklistFresh?workbook.readiness.checked:[];
    const checked=previous.includes(id)?previous.filter(x=>x!==id):[...previous,id];
    persist({...workbook,readiness:{checked,updatedAt:new Date().toISOString()}},'Today’s local departure checks updated; repeat for each job departure.');
  }
  function resetReadiness(){
    if(!canEdit||!window.confirm('Reset all pre-departure checks for your next job?'))return;
    persist({...workbook,readiness:{checked:[],updatedAt:null}},'Readiness checklist reset for the next departure.');
  }
  function updateRig(key:keyof FleetWorkbook['rig'],raw:string){
    if(!canEdit)return;
    const value=numberOrNull(raw);
    persist({...workbook,rig:{...workbook.rig,[key]:key==='vehiclePayloadLb'?value:value??0}},
      'Rig planning assumptions updated locally.');
  }
  function exportFile(){
    if(!canEdit){setError('Your current role cannot export local Fleet Command drafts.');return;}
    try{
      const text=encodeFleet(workbook,organizationId);
      const url=URL.createObjectURL(new Blob([text],{type:'application/json;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='oj-fleet-command-private-'+day+'.json';a.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice('Private fleet file exported. Transfer securely; this does not synchronize with the shared company database.');
    }catch(e){setError(e instanceof Error?e.message:'Fleet export failed.');}
  }
  async function importFile(file:File|undefined){
    if(!file||!canEdit)return;
    if(file.size>256*1024){setError('Fleet file is larger than the 256 KB limit.');return;}
    try{
      const imported=decodeFleet(await file.text(),organizationId);
      if(!window.confirm('Replace ALL local Fleet Command records on this device with the imported file? Export your current workbook first to preserve it.'))return;
      persist(imported,'Private fleet workbook imported. This device now holds the imported data; Jacob will not see changes unless you exchange the file.');
    }catch(e){setError(e instanceof Error?e.message:'Could not import this file.');}
  }
  if(!ready)return <div className="fleet page" role="status">Loading local Fleet Command workspace…</div>;

  return <div className="fleet page">
    <header className="fleet-hero">
      <div className="fleet-hero-top"><Link href={base+'/tools'}><ArrowLeft size={15}/>Corporate tools</Link><span className="fleet-eyebrow"><Activity size={14}/> FIELD OPERATIONS / EQUIPMENT COMMAND</span></div>
      <div className="fleet-hero-main">
        <div>
          <p className="tools-eyebrow">OJ EXTERIOR CARE / OPERATIONS DIVISION</p>
          <h1>Fleet <em>Command</em></h1>
          <p>Track equipment, plan rig loads, record repairs and prepare for the next dispatch—all from one operational console.</p>
        </div>
        <Truck className="fleet-hero-truck" size={94} strokeWidth={1} aria-hidden="true"/>
      </div>
      <div className="fleet-local-note"><ShieldCheck size={17} aria-hidden="true"/><span>
        {preview?'Fictional preview. This is not your actual vehicle or equipment history.':
          'LOCAL DRAFT ONLY — records remain in this browser on this device. Not synchronized with Jacob or Supabase. Avoid confidential IDs and export an encrypted private copy to share or preserve data.'}
        {readOnly&&!preview?' Your workspace role is read-only.':''}
      </span></div>
    </header>
    <section className="atlas-fleet-dispatch" aria-label="Dispatch operations summary">
      <div><p>ATLAS / FIELD OPERATIONS</p><h2>Dispatch readiness console</h2><span>Equipment decisions are based on manually entered local records. This is not a live telematics feed.</span></div>
      <div className="atlas-fleet-dispatch-actions">
        <button type="button" onClick={()=>setTab('readiness')}><ClipboardCheck size={16}/> Pre-departure</button>
        <button type="button" onClick={()=>setTab('maintenance')}><Wrench size={16}/> Service ledger</button>
        <button type="button" onClick={()=>setTab('rig')}><Truck size={16}/> Rig Lab</button>
        {canEdit&&<Link className="atlas-fleet-task-link" href={base+'/tasks?sourceFleet=1'}><ClipboardCheck size={16}/> Prepare shared task <ArrowUpRight size={14}/></Link>}
      </div>
    </section>
    <section className="atlas-fleet-alertline" aria-label="Equipment attention summary">
      <span><b>{dueNow.length}</b> recorded assets need attention</span>
      <span><b>{soon}</b> nearing entered service thresholds</span>
      <span><b>{readinessItems.length-todayChecked}</b> checklist items unchecked today</span>
      <strong>{preview?'DEMO RECORDS':readOnly?'READ-ONLY VIEW':'DEVICE-LOCAL DRAFT'}</strong>
    </section>
    <AtlasFieldBridge base={base} organizationId={organizationId} mode={mode} view="fleet" fleet={workbook} disabled={readOnly} />
    <AtlasFleetProjectAssignments org={organizationId} base={base} mode={mode} readOnly={readOnly} fleet={workbook} day={day} bookings={bookings} bookingsState={bookingsState} cards={cards} />
    <section className="fleet-kpis" aria-label="Fleet status overview">
      <div><span><Truck size={17}/> Logged assets</span><strong>{workbook.assets.length}</strong><small>Local inventory entries</small></div>
      <div><span><AlertTriangle size={17}/> Attention now</span><strong>{attention}</strong><small>Manually flagged or service due</small></div>
      <div><span><Gauge size={17}/> Service approaching</span><strong>{soon}</strong><small>Based on entered thresholds</small></div>
      <div><span><ClipboardCheck size={17}/> Readiness</span><strong>{todayChecked}/{readinessItems.length}</strong><small>Recorded today; reset for each job</small></div>
    </section>
    <nav className="fleet-tabs" aria-label="Fleet Command sections">
      {(Object.keys(tabNames) as Tab[]).map(t=>
        <button type="button" key={t} aria-current={tab===t?'page':undefined} onClick={()=>{setTab(t);setError('');setNotice('');}}>
          {tabNames[t]}</button>)}
    </nav>
    {error&&<p className="fleet-alert fleet-error" role="alert"><ShieldAlert size={17}/>{error}<button onClick={()=>setError('')} aria-label="Dismiss error"><X size={14}/></button></p>}
    {notice&&<p className="fleet-alert fleet-notice" role="status"><BadgeCheck size={17}/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss notice"><X size={14}/></button></p>}

    {tab==='overview'&&<div className="fleet-columns">
      <section className="fleet-panel">
        <div className="fleet-panel-heading"><div><p className="fleet-section-kicker">MISSION READINESS</p><h2>Equipment attention queue</h2></div><button type="button" onClick={()=>setTab('assets')}>Asset registry <ArrowUpRight size={15}/></button></div>
        {dueNow.length?dueNow.map(a=><div className="fleet-attention" key={a.id}>
          <span className="fleet-asset-symbol"><Wrench size={18}/></span>
          <div><strong>{a.name}</strong><p>{a.health==='due'?'Entered service threshold reached':statusNames[a.status]}</p></div>
          <button type="button" onClick={()=>{setTab('assets');setAssetEditor({...a});}}>Inspect <ArrowUpRight size={14}/></button>
        </div>):<div className="fleet-empty"><ShieldCheck size={28}/><strong>No flagged equipment in this local workbook</strong><p>This does not verify real mechanical condition. Add equipment and maintenance thresholds to generate alerts.</p></div>}
      </section>
      <section className="fleet-panel fleet-side-panel">
        <div className="fleet-panel-heading"><div><p className="fleet-section-kicker">PRE-DEPARTURE</p><h2>Rig readiness</h2></div><ClipboardCheck size={22}/></div>
        <div className="fleet-progress-track"><span style={{width:(todayChecked/readinessItems.length*100)+'%'}}/></div>
        <p><strong>{todayChecked} / {readinessItems.length}</strong> safety and job-prep items recorded today</p>
        <p className="fleet-muted">Checklist status is a local self-check, not an official inspection or safety certification. Reset it before every new job.</p>
        <button className="fleet-primary" type="button" onClick={()=>setTab('readiness')}>Open readiness checklist <ArrowUpRight size={16}/></button>
      </section>
      <section className="fleet-panel">
        <div className="fleet-panel-heading"><div><p className="fleet-section-kicker">RIG ENGINEERING</p><h2>Payload planning</h2></div><Droplets size={20}/></div>
        <div className="fleet-metric-row"><span>Water + entered cargo</span><strong>{load.totalLb.toLocaleString('en-US')} lb</strong></div>
        <div className="fleet-metric-row"><span>Payload remaining</span><strong>{load.remainingLb===null?'Unknown':load.remainingLb.toLocaleString('en-US')+' lb'}</strong></div>
        {load.exceedsEnteredPayload&&<p className="fleet-inline-danger">The entered plan exceeds the payload value you supplied.</p>}
        <button className="fleet-outline" type="button" onClick={()=>setTab('rig')}>Open Rig Lab <ArrowUpRight size={16}/></button>
      </section>
      <section className="fleet-panel">
        <div className="fleet-panel-heading"><div><p className="fleet-section-kicker">PRIVATE WORKBOOK</p><h2>Transfer and backup</h2></div><Download size={20}/></div>
        <p className="fleet-muted">To share this working inventory with Jacob, export it and transfer the file through a private trusted channel. Importing replaces all records on the other device.</p>
        <div className="fleet-button-row"><button className="fleet-outline" onClick={exportFile} type="button" disabled={!canEdit}><Download size={15}/>Export private JSON</button>
        <button className="fleet-outline" type="button" disabled={!canEdit} onClick={()=>fileRef.current?.click()}><FileUp size={15}/>Import private JSON</button></div>
      </section>
    </div>}

    {tab==='assets'&&<section className="fleet-panel">
      <div className="fleet-panel-heading"><div><p className="fleet-section-kicker">ASSET REGISTER</p><h2>Vehicles & operational equipment</h2></div>
        <button className="fleet-primary" type="button" disabled={!canEdit} onClick={()=>setAssetEditor(emptyAsset())}><Plus size={16}/> Add asset</button></div>
      <div className="fleet-filterrow"><label>Search equipment<input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Name, equipment type or model…"/></label>
        <label>Recorded status<select value={statusFilter} onChange={e=>setStatusFilter(e.target.value as typeof statusFilter)}>
          <option value="all">All statuses</option>{fleetStatuses.map(s=><option key={s} value={s}>{statusNames[s]}</option>)}</select></label></div>
      {filtered.length?<div className="fleet-asset-grid">{filtered.map(asset=><article className="fleet-asset-card" key={asset.id}>
        <div className="fleet-asset-header"><span className="fleet-asset-symbol">{asset.kind==='vehicle'?<Truck size={19}/>:asset.kind==='pressure-washer'?<Gauge size={19}/>:<Wrench size={19}/>}</span>
          <span className={'fleet-pill fleet-pill-'+asset.health}>{asset.health.replace(/-/g,' ')}</span></div>
        <p className="fleet-section-kicker">{kindNames[asset.kind]}</p><h3>{asset.name}</h3><p>{asset.model||'Model not entered'}</p>
        <dl><div><dt>Current meter</dt><dd>{asset.reading===null?'Unknown':asset.reading.toLocaleString()+' '+asset.unit}</dd></div>
          <div><dt>Next service date</dt><dd>{asset.nextServiceDate||'Not recorded'}</dd></div>
          <div><dt>Next meter threshold</dt><dd>{asset.nextServiceReading===null?'Not recorded':asset.nextServiceReading.toLocaleString()+' '+asset.unit}</dd></div></dl>
        <button type="button" className="fleet-card-edit" onClick={()=>setAssetEditor({...asset})}>{canEdit?'Manage asset':'View details'}<ArrowUpRight size={16}/></button>
        <AtlasFleetAssetTasks id={asset.id} org={organizationId} base={base} cards={cards} canEdit={canEdit} />
      </article>)}</div>:<div className="fleet-empty"><PackagePlus size={28}/><strong>No equipment matches this view</strong><p>Add your vehicle, pressure washer, water-fed pole setup, and individual rig components to build a real local inventory.</p></div>}
    </section>}

    {tab==='maintenance'&&<section className="fleet-panel">
      <div className="fleet-panel-heading"><div><p className="fleet-section-kicker">SERVICE LEDGER</p><h2>Repair & maintenance history</h2></div><Wrench size={22}/></div>
      <p className="fleet-muted">Manually entered costs are reference notes, not reconciled business expenses. Repairs do not automatically reset service thresholds.</p>
      {canEdit&&<div className="fleet-service-form">
        <label>Equipment<select value={serviceAsset} onChange={e=>setServiceAsset(e.target.value)}><option value="">Select asset…</option>{workbook.assets.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
        <label>Service date<input type="date" value={serviceDate} onChange={e=>setServiceDate(e.target.value)}/></label>
        <label className="fleet-grow">What was done?<input maxLength={350} value={serviceSummary} onChange={e=>setServiceSummary(e.target.value)} placeholder="e.g. Replaced injector O-ring and checked hose"/></label>
        <label>Cost, if known ($)<input type="number" min="0" max="1000000" step="0.01" value={serviceCost} onChange={e=>setServiceCost(e.target.value)} placeholder="Optional"/></label>
        <label>Meter reading, if known<input type="number" min="0" max="10000000" value={serviceReading} onChange={e=>setServiceReading(e.target.value)} placeholder="Optional"/></label>
        <button type="button" className="fleet-primary" onClick={addService} disabled={!serviceAsset||!serviceSummary.trim()||!serviceDate}><Plus size={16}/>Log service</button>
      </div>}
      <div className="fleet-ledger">
        {workbook.maintenance.length?workbook.maintenance.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(event=>
          <div className="fleet-ledger-item" key={event.id}>
            <span className="fleet-ledger-icon"><Wrench size={17}/></span><div><strong>{event.summary}</strong><p>{workbook.assets.find(a=>a.id===event.assetId)?.name||'Unknown equipment'} · {event.date}{event.reading!==null?' · meter '+event.reading.toLocaleString():''}</p></div>
            <span>{event.cost===null?'Cost unrecorded':usd(event.cost)}</span>
            {canEdit&&<button type="button" onClick={()=>removeService(event.id)} aria-label={'Delete service entry '+event.summary}><Trash2 size={15}/></button>}
          </div>):<div className="fleet-empty"><Wrench size={28}/><strong>No maintenance logged</strong><p>After service, record what was repaired and any costs you actually know.</p></div>}
      </div>
    </section>}

    {tab==='readiness'&&<section className="fleet-panel">
      <div className="fleet-panel-heading"><div><p className="fleet-section-kicker">FIELD SAFETY</p><h2>Pre-departure inspection</h2></div><HardHat size={23}/></div>
      <p className="fleet-muted">This is a general preparation prompt, not a substitute for equipment manuals, training, site-specific risk assessment or required inspections. Complete a new checklist before each departure.</p>
      <div className="fleet-progress-track"><span style={{width:(todayChecked/readinessItems.length*100)+'%'}}/></div>
      <p className="fleet-muted">{todayChecked} of {readinessItems.length} checked today. Last saved: {workbook.readiness.updatedAt?new Date(workbook.readiness.updatedAt).toLocaleString():'Never'}</p>
      {!checklistFresh&&completed>0&&<p className="fleet-inline-danger" role="status">Previous-day checks are retained for reference but do not count for today. Starting a new checklist requires your confirmation.</p>}
      <div className="fleet-checklist">{readinessItems.map(item=><label key={item.id}><input type="checkbox" disabled={!canEdit} checked={checklistFresh&&workbook.readiness.checked.includes(item.id)} onChange={()=>toggleReadiness(item.id)}/><span>{item.label}</span></label>)}</div>
      <button className="fleet-outline" type="button" disabled={!canEdit} onClick={resetReadiness}><RotateCcw size={15}/>Reset for the next job</button>
    </section>}

    {tab==='rig'&&<section className="fleet-panel">
      <div className="fleet-panel-heading"><div><p className="fleet-section-kicker">ENGINEERING / CONCEPT LAB</p><h2>Rig Payload Simulator</h2></div><Gauge size={23}/></div>
      <p className="fleet-muted">Model the *approximate* load using your own numbers. No factory payload specification has been verified here. Use the vehicle door-jamb payload label and manufacturer ratings; also check axle, towing, securing, braking, liquid movement and legal requirements.</p>
      <div className="fleet-rig-layout"><div className="fleet-rig-inputs">
        {([
          ['vehiclePayloadLb','Vehicle payload limit (lb)','Leave blank if unverified'],
          ['emptyRigLb','Dry rig + mounted equipment (lb)','Without water or people'],
          ['waterGallons','Water in tank (US gallons)','8.34 lb/gallon approximation'],
          ['otherCargoLb','Chemicals + loose cargo (lb)','Include hoses, tools and supplies'],
          ['peopleLb','Driver and passengers (lb)','Combined people and belongings'],
        ] as const).map(([key,label,help])=><label key={key}><span>{label}</span><small>{help}</small>
            <input type="number" min="0" max="100000" step="1" disabled={!canEdit}
              value={workbook.rig[key]??''} placeholder={key==='vehiclePayloadLb'?'Unknown':''}
              onChange={e=>updateRig(key,e.target.value)}/></label>)}
      </div><div className="fleet-rig-output">
        <p className="fleet-section-kicker">ESTIMATED WEIGHTS</p>
        <div><span>Onboard water</span><strong>{load.waterLb.toLocaleString('en-US')} lb</strong></div>
        <div><span>Estimated total load</span><strong>{load.totalLb.toLocaleString('en-US')} lb</strong></div>
        <div><span>Entered vehicle payload</span><strong>{workbook.rig.vehiclePayloadLb===null?'Not entered':workbook.rig.vehiclePayloadLb.toLocaleString('en-US')+' lb'}</strong></div>
        <hr/><p className="fleet-section-kicker">REMAINING PAYLOAD</p>
        <strong className={load.exceedsEnteredPayload?'fleet-overload':'fleet-big-number'}>{load.remainingLb===null?'Unknown':load.remainingLb.toLocaleString('en-US')+' lb'}</strong>
        <p className="fleet-muted">{load.remainingLb===null?'Enter the verified payload rating to compare loads.':'These numbers are estimates, not a mechanical approval or a safe-to-drive certification.'}</p>
        {load.exceedsEnteredPayload&&<p className="fleet-inline-danger"><AlertTriangle size={16}/> The modeled load exceeds the payload you entered. Do not operate an overloaded vehicle.</p>}
      </div></div>
    </section>}

    {assetEditor&&<div className="fleet-modal-backdrop" role="presentation">
      <section className="fleet-modal" role="dialog" aria-modal="true" aria-labelledby="fleet-modal-title">
        <div className="fleet-panel-heading"><div><p className="fleet-section-kicker">FLEET REGISTRY</p><h2 id="fleet-modal-title">{workbook.assets.some(a=>a.id===assetEditor.id)?'Manage equipment':'Register equipment'}</h2></div>
          <button type="button" className="fleet-close" onClick={()=>setAssetEditor(null)} aria-label="Close equipment editor"><X size={20}/></button></div>
        <div className="fleet-form-grid">
          <label className="fleet-grow">Equipment name<input required maxLength={120} value={assetEditor.name} disabled={!canEdit} onChange={e=>setAssetEditor({...assetEditor,name:e.target.value})} placeholder="e.g. Simpson ALH4240"/></label>
          <label>Equipment category<select disabled={!canEdit} value={assetEditor.kind} onChange={e=>setAssetEditor({...assetEditor,kind:e.target.value as FleetKind})}>{fleetKinds.map(k=><option key={k} value={k}>{kindNames[k]}</option>)}</select></label>
          <label>Model / specifications<input maxLength={150} disabled={!canEdit} value={assetEditor.model} onChange={e=>setAssetEditor({...assetEditor,model:e.target.value})} placeholder="e.g. GX390 / CAT Triplex"/></label>
          <label>Recorded status<select disabled={!canEdit} value={assetEditor.status} onChange={e=>setAssetEditor({...assetEditor,status:e.target.value as FleetStatus})}>{fleetStatuses.map(k=><option key={k} value={k}>{statusNames[k]}</option>)}</select></label>
          <label>Meter type<select disabled={!canEdit} value={assetEditor.unit} onChange={e=>setAssetEditor({...assetEditor,unit:e.target.value as ReadingUnit,reading:null,nextServiceReading:null})}>{readingUnits.map(k=><option key={k} value={k}>{k==='none'?'Not metered':k}</option>)}</select></label>
          <label>Current meter<input disabled={!canEdit||assetEditor.unit==='none'} type="number" min="0" max="10000000" step="0.1" value={assetEditor.reading??''} onChange={e=>setAssetEditor({...assetEditor,reading:numberOrNull(e.target.value)})} placeholder="Not known"/></label>
          <label>Next service meter<input disabled={!canEdit||assetEditor.unit==='none'} type="number" min="0" max="10000000" value={assetEditor.nextServiceReading??''} onChange={e=>setAssetEditor({...assetEditor,nextServiceReading:numberOrNull(e.target.value)})} placeholder="Not set"/></label>
          <label>Next service date<input disabled={!canEdit} type="date" value={assetEditor.nextServiceDate??''} onChange={e=>setAssetEditor({...assetEditor,nextServiceDate:e.target.value||null})}/></label>
          <label className="fleet-grow">Condition / repair notes<textarea disabled={!canEdit} rows={3} maxLength={2000} value={assetEditor.notes} onChange={e=>setAssetEditor({...assetEditor,notes:e.target.value})} placeholder="What needs inspection? What failed? Next steps…"/></label>
        </div>
        <footer className="fleet-modal-actions">
          {canEdit&&workbook.assets.some(a=>a.id===assetEditor.id)&&<button className="fleet-danger-button" type="button" onClick={()=>deleteAsset(assetEditor.id)}><Trash2 size={15}/>Delete asset</button>}
          <button className="fleet-outline" type="button" onClick={()=>setAssetEditor(null)}>Close</button>
          {canEdit&&<button className="fleet-primary" type="button" disabled={!assetEditor.name.trim()} onClick={saveAsset}><Save size={15}/>Save local asset</button>}
        </footer>
      </section>
    </div>}
    <input type="file" ref={fileRef} accept=".json,application/json" hidden aria-label="Import private fleet workbook JSON" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importFile(file);}}/>
    <footer className="fleet-page-foot"><Settings2 size={15}/> Fleet Command beta: private browser-local workspace, no live telematics, shared data synchronization, official inspection, or verified vehicle payload ratings. 
      <Link href={base+'/tools'}>All corporate tools <ArrowUpRight size={14}/></Link></footer>
  </div>;
}
