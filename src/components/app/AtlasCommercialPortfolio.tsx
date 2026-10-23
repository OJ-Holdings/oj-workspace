'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Archive, ArrowUpRight, Building2, Download, FileInput, Plus, Save, ShieldAlert, Trash2, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Card } from '@/lib/board';
import { exactLocalProjectIds } from '@/lib/atlas-task-handoff';
import { emptyFieldCrewPlan, type FieldCrewPlan } from '@/lib/atlas-field-mission';
import { mergeNonConflictingPortfolio, previewPortfolioMerge, type PortfolioMergePlan } from '@/lib/atlas-portfolio-merge';
import { AtlasFieldMissionPanel } from './AtlasFieldMissionPanel';
import type { ExtBooking } from '@/lib/exterior';
import type { EstimateInput } from '@/lib/commercial-estimate';
import { newEstimate } from '@/lib/commercial-estimate';
import type { FleetWorkbook } from '@/lib/fleet-command';
import { parseLocalFleetDraft } from '@/lib/atlas-field-bridge';
import {
  decodeCommercialPortfolio, deletePortfolioProject, emptyCommercialPortfolio,
  encodeCommercialPortfolio, projectEquipmentEvidence, projectPhases,
  resolveSourceBooking, resourcePlanFindings, savePortfolioProject,
  type CommercialPortfolio, type CommercialProject, type ProjectDraft, type ProjectPhase,
} from '@/lib/atlas-commercial-portfolio';

type Props={
  org:string;base:string;mode:'preview'|'live';readOnly:boolean;
  name:string;input:EstimateInput;review:boolean[];
  bookings:ExtBooking[];cards:Card[];
  onLoad:(project:Pick<CommercialProject,'name'|'input'|'review'>)=>void;
};
const dateChicago=()=>{
  const pieces=new Intl.DateTimeFormat('en-US',{
    timeZone:'America/Chicago',year:'numeric',month:'2-digit',day:'2-digit',
  }).formatToParts(new Date());
  const part=(id:string)=>pieces.find(item=>item.type===id)?.value??'';
  return part('year')+'-'+part('month')+'-'+part('day');
};
const short=(id:string)=>id.length>11?id.slice(0,9)+'…':id;

/**
 * Local portfolio manager, not Supabase persistence or resource dispatch.
 * Explicit booking IDs are only linked after selecting currently loaded records;
 * an editor cannot join a project to a customer by name/address similarity.
 */
export function AtlasCommercialPortfolio({org,base,mode,readOnly,name,input,review,bookings,cards,onLoad}:Props){
  const router=useRouter();
  const params=useSearchParams();
  const targetProject=params.get('project');
  const openedTarget=useRef('');
  const canEdit=mode==='live'&&!readOnly;
  const key='oj-commercial-project-portfolio-v1:'+org;
  const fleetKey='oj-fleet-command-v1:'+org;
  const fileInput=useRef<HTMLInputElement>(null);
  const [portfolio,setPortfolio]=useState<CommercialPortfolio>(()=>emptyCommercialPortfolio(org));
  const [fleet,setFleet]=useState<FleetWorkbook|null>(null);
  const [fleetError,setFleetError]=useState('');
  const [ready,setReady]=useState(false);
  const [selectedId,setSelectedId]=useState<string|null>(null);
  const [expectedRevision,setExpectedRevision]=useState<number|null>(null);
  const [phase,setPhase]=useState<ProjectPhase>('scoping');
  const [bookingId,setBookingId]=useState<string|null>(null);
  const [plannedAssetIds,setPlannedAssetIds]=useState<string[]>([]);
  const [fieldCrewPlan,setFieldCrewPlan]=useState<FieldCrewPlan>(emptyFieldCrewPlan);
  const [addAsset,setAddAsset]=useState('');
  const [notice,setNotice]=useState('');
  const [day,setDay]=useState('');
  const [showPortfolio,setShowPortfolio]=useState(true);
  const [pendingImport,setPendingImport]=useState<{incoming:CommercialPortfolio;preview:PortfolioMergePlan;baseline:number;filename:string}|null>(null);

  const reload=useCallback(()=>{
    if(!canEdit)return;
    try{
      const raw=window.localStorage.getItem(key);
      setPortfolio(raw?decodeCommercialPortfolio(raw,org):emptyCommercialPortfolio(org));
      setReady(true);
    }catch(error){
      setReady(false);
      setNotice((error instanceof Error?error.message:'Project portfolio could not be read.')+
        ' Original local data was NOT overwritten. Export or recover it before saving.');
    }
  },[canEdit,key,org]);
  const reloadFleet=useCallback(()=>{
    if(!canEdit)return;
    try{
      const raw=window.localStorage.getItem(fleetKey);
      setFleet(raw?parseLocalFleetDraft(raw,org):null);
      setFleetError('');
    }catch(error){
      setFleet(null);
      setFleetError('Fleet workbook rejected: '+(error instanceof Error?error.message:'invalid data')+'. No source records were modified.');
    }
  },[canEdit,fleetKey,org]);
  useEffect(()=>{
    setReady(false);setSelectedId(null);setExpectedRevision(null);setPortfolio(emptyCommercialPortfolio(org));
    setPhase('scoping');setBookingId(null);setPlannedAssetIds([]);setFieldCrewPlan(emptyFieldCrewPlan());
    setFleet(null);setNotice('');setPendingImport(null);setDay(dateChicago());
    if(!canEdit){setReady(true);return;}
    reload();reloadFleet();
    const onStorage=(event:StorageEvent)=>{
      if(event.key===key||event.key===null)reload();
      if(event.key===fleetKey||event.key===null)reloadFleet();
    };
    const onFocus=()=>{reload();reloadFleet();setDay(dateChicago());};
    const timer=window.setInterval(()=>setDay(dateChicago()),60000);
    window.addEventListener('storage',onStorage);
    window.addEventListener('focus',onFocus);
    return ()=>{
      window.removeEventListener('storage',onStorage);window.removeEventListener('focus',onFocus);
      window.clearInterval(timer);
    };
  },[org,canEdit,reload,reloadFleet,key,fleetKey]);

  const current=portfolio.projects.find(p=>p.id===selectedId);
  const draft:ProjectDraft={name,input,review,phase,bookingId,plannedAssetIds,fieldCrewPlan};
  const simulated:CommercialProject={
    id:selectedId??'unsaved',revision:expectedRevision??0,
    createdAt:current?.createdAt??'2026-01-01T00:00:00.000Z',
    updatedAt:current?.updatedAt??'2026-01-01T00:00:00.000Z',
    ...draft,
  };
  const evidence=useMemo(()=>projectEquipmentEvidence(simulated,fleet,day),[simulated.id,plannedAssetIds,fleet,day]);
  const findings=useMemo(()=>resourcePlanFindings(simulated,portfolio.projects,fleet,bookings,day),
    [selectedId,plannedAssetIds,portfolio.projects,fleet,bookings,bookingId,day]);
  const booking=resolveSourceBooking(bookingId,bookings);
  const selectedBooking=bookingId?bookings.find(b=>b.id.toLowerCase()===bookingId.toLowerCase()):undefined;
  const choices=useMemo(()=>{
    const eligible=bookings.filter(b=>b.status!=='cancelled'&&b.status!=='denied');
    return eligible.slice().sort((a,b)=>b.date.localeCompare(a.date)).slice(0,150);
  },[bookings]);
  const knownIds=new Set((fleet?.assets??[]).map(asset=>asset.id));
  const linkedTasks=selectedId?cards.filter(card=>card.organization_id===org&&card.business==='exterior'&&exactLocalProjectIds(card.description).includes(selectedId)).slice(0,20):[];

  function loadProject(project:CommercialProject){
    if(!window.confirm('Load "'+project.name+'"? This replaces unsaved scope and pricing edits in the current editor. It does not modify the shared OJ database.'))return;
    setSelectedId(project.id);setExpectedRevision(project.revision);setPhase(project.phase);
    setBookingId(project.bookingId);setPlannedAssetIds([...project.plannedAssetIds]);
    setFieldCrewPlan({...project.fieldCrewPlan??emptyFieldCrewPlan()});
    onLoad({name:project.name,input:structuredClone(project.input),review:[...project.review]});
    setNotice('Project loaded into the local estimator. Changes are NOT automatically saved or shared.');
  }
  // The NEXUS deep link resolves an exact local project ID only on the
  // SAME validated browser. Explicitly warn before replacing editor state.
  useEffect(()=>{
    if(!ready||!canEdit||!targetProject)return;
    const marker=org+':'+targetProject;
    if(openedTarget.current===marker)return;
    openedTarget.current=marker;
    const target=portfolio.projects.find(p=>p.id===targetProject);
    if(target)loadProject(target);
    else setNotice('The requested project ID is not in this device-local portfolio. Nothing was loaded or changed.');
  },[ready,canEdit,targetProject,org,portfolio.projects]);

  function newProject(){
    if(!window.confirm('Begin a new project? Unsaved changes to the currently open estimate will be discarded. Previously saved portfolio entries remain.'))return;
    setSelectedId(null);setExpectedRevision(null);setPhase('scoping');
    setBookingId(null);setPlannedAssetIds([]);setFieldCrewPlan(emptyFieldCrewPlan());
    onLoad({name:'New commercial opportunity',input:newEstimate(),review:[false,false,false,false,false]});
    setNotice('New unsaved project started. Save it into the local portfolio to preserve it.');
  }
  function storagePortfolio():CommercialPortfolio{
    const raw=window.localStorage.getItem(key);
    return raw?decodeCommercialPortfolio(raw,org):emptyCommercialPortfolio(org);
  }
  function persist(next:CommercialPortfolio,expectedPortfolioRevision:number,message:string){
    const fresh=storagePortfolio();
    if(fresh.revision!==expectedPortfolioRevision){
      throw new Error('Portfolio changed in another tab. Reload the page or reopen the updated project before saving.');
    }
    window.localStorage.setItem(key,encodeCommercialPortfolio(next,org));
    setPortfolio(next);setNotice(message);
  }
  function saveCurrent():string|null{
    if(!canEdit||!ready)return null;
    try{
      const currentState=storagePortfolio();
      if(currentState.revision!==portfolio.revision)throw new Error('Portfolio changed in another tab. Reload before saving.');
      const id=selectedId??crypto.randomUUID().replace(/-/g,'');
      const next=savePortfolioProject(currentState,org,id,draft,expectedRevision,new Date().toISOString());
      persist(next,currentState.revision,'Private project saved in this browser. Booking/equipment selections are plans, NOT dispatch assignments.');
      const saved=next.projects.find(p=>p.id===id)!;
      setSelectedId(id);setExpectedRevision(saved.revision);
      return id;
    }catch(error){setNotice(error instanceof Error?error.message:'Project could not be saved.');return null;}
  }
  function prepareProjectTask(){
    if(phase==='archived'){setNotice('Restore the project to scoping or review before preparing a shared task.');return;}
    const id=saveCurrent();
    if(id)router.push(base+'/tasks?sourceProject='+encodeURIComponent(id));
  }
  function deleteCurrent(){
    if(!canEdit||!selectedId||expectedRevision===null)return;
    const target=portfolio.projects.find(p=>p.id===selectedId);
    if(!target||!window.confirm('Delete the LOCAL portfolio entry "'+target.name+'"? This cannot be undone without an exported backup. Shared tasks and bookings are NOT deleted.'))return;
    try{
      const currentState=storagePortfolio();
      if(currentState.revision!==portfolio.revision)throw new Error('Portfolio changed; reload before deleting.');
      const next=deletePortfolioProject(currentState,org,selectedId,expectedRevision);
      persist(next,currentState.revision,'Only the selected local project was deleted. The open estimator is unchanged.');
      setSelectedId(null);setExpectedRevision(null);setBookingId(null);
      setPlannedAssetIds([]);setPhase('scoping');setFieldCrewPlan(emptyFieldCrewPlan());
    }catch(error){setNotice(error instanceof Error?error.message:'Delete failed.');}
  }
  function exportPortfolio(){
    if(!canEdit||!ready)return;
    try{
      const json=encodeCommercialPortfolio(portfolio,org);
      const url=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='oj-private-commercial-portfolio.json';a.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice('Private portfolio exported in unencrypted JSON. Store and transfer through a secure channel.');
    }catch(error){setNotice(error instanceof Error?error.message:'Export failed.');}
  }
  /** File selection ONLY previews; no local or remote records are written. */
  async function importPortfolio(file:File|undefined){
    if(!canEdit||!ready||!file)return;
    setPendingImport(null);
    try{
      if(file.size>1024*1024)throw new Error('Portfolio file exceeds 1 MB.');
      const imported=decodeCommercialPortfolio(await file.text(),org);
      const currentState=storagePortfolio();
      if(currentState.revision!==portfolio.revision)
        throw new Error('Portfolio changed in another tab. Reload before importing.');
      const preview=previewPortfolioMerge(currentState,imported,org);
      setPendingImport({incoming:imported,preview,baseline:currentState.revision,filename:file.name.slice(0,160)});
      setNotice('Import file validated. Review the preview below before choosing a manual action. No source records were changed.');
    }catch(error){
      setNotice(error instanceof Error?error.message:'Import rejected. Existing portfolio was not modified.');
    }
  }
  function applyPendingImport(strategy:'merge'|'replace'){
    if(!canEdit||!ready||!pendingImport)return;
    try{
      const currentState=storagePortfolio();
      if(currentState.revision!==portfolio.revision||currentState.revision!==pendingImport.baseline)
        throw new Error('Portfolio changed since this preview was created. Cancel and reselect the file; no changes were made.');
      // Recompute against the freshest validated storage, never trust a stale
      // UI summary or use the other browser's revision as a global clock.
      const preview=previewPortfolioMerge(currentState,pendingImport.incoming,org);
      if(strategy==='merge'){
        if(!preview.capacityAvailable)throw new Error('Import would exceed the 24-project browser limit. Nothing was imported.');
        if(!preview.additions.length){
          setNotice('No new project IDs in this file. '+preview.conflicts.length+' conflicting record(s) remain untouched.');
          setPendingImport(null);return;
        }
        if(!window.confirm('MERGE only '+preview.additions.length+' new exact project IDs into this browser? '+
            preview.conflicts.length+' conflicting same-ID records will be SKIPPED and left unchanged. '+
            'Existing projects, Fleet and source bookings are never overwritten. Continue?'))return;
        const result=mergeNonConflictingPortfolio(currentState,pendingImport.incoming,org);
        if(!result.changed)throw new Error('No new records to import. Nothing was changed.');
        persist(result.next,currentState.revision,'Merged '+result.plan.additions.length+' new browser-local project(s). '+
          result.plan.conflicts.length+' conflicting same-ID record(s) were SKIPPED. No founder devices were synchronized.');
      }else{
        if(!window.confirm('REPLACE ALL '+currentState.projects.length+' browser-local project(s) with '+
            pendingImport.incoming.projects.length+' from the selected file? Local-only projects NOT in the file will be LOST. '+
            'Export a backup first. Shared bookings and tasks stay untouched. Continue?'))return;
        const importedNext={...pendingImport.incoming,revision:currentState.revision+1};
        persist(importedNext,currentState.revision,'Private portfolio REPLACED from explicit file. It remains only on this device.');
        setSelectedId(null);setExpectedRevision(null);setPhase('scoping');setBookingId(null);
        setPlannedAssetIds([]);setFieldCrewPlan(emptyFieldCrewPlan());
      }
      setPendingImport(null);
    }catch(error){
      setNotice(error instanceof Error?error.message:'Import was refused. No records were changed.');
    }
  }
  if(!canEdit)return <section className="atlas-project-portfolio"><header><div><small>ATLAS / PROJECT PORTFOLIO</small><h3>Commercial project register</h3></div></header><p>Private device-local project management is unavailable in preview or read-only mode. Nothing was read from local browser project storage.</p></section>;
  return <section className="atlas-project-portfolio" aria-label="Private commercial project portfolio">
    <header className="atlas-project-portfolio-head">
      <div><small>ATLAS / PROJECT PORTFOLIO</small><h3>Commercial project register</h3><p>Versioned projects and equipment plans saved only in this browser. No contract, booking, actual asset reservation or cross-device sync.</p></div>
      <button type="button" className="secondary" onClick={()=>setShowPortfolio(v=>!v)}>{showPortfolio?'Collapse portfolio':'Expand portfolio'} ({portfolio.projects.length})</button>
    </header>
    {showPortfolio&&<>
      <div className="atlas-project-toolbar">
        <button type="button" className="secondary" onClick={newProject}><Plus size={15}/> New project</button>
        <button type="button" className="primary" disabled={!ready} onClick={saveCurrent}><Save size={15}/> {selectedId?'Save selected project':'Save as new project'}</button>
        <button type="button" className="secondary" disabled={!ready||phase==='archived'} onClick={prepareProjectTask}>Save & prepare project task <ArrowUpRight size={15}/></button>
        <Link className="secondary nexus-editor-link" href={base+"/b/exterior/projects"+(selectedId?"?project="+encodeURIComponent(selectedId):"")}>NEXUS / Last saved snapshot <ArrowUpRight size={14}/></Link>
        <button type="button" className="secondary" disabled={!ready} onClick={exportPortfolio}><Download size={15}/> Export portfolio</button>
        <button type="button" className="secondary" disabled={!ready} onClick={()=>fileInput.current?.click()}><FileInput size={15}/> Import portfolio</button>
        <input type="file" ref={fileInput} hidden accept="application/json,.json" aria-label="Import private commercial project portfolio" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importPortfolio(file);}}/>
      </div>
      {pendingImport&&<section className="atlas-portfolio-import-preview" aria-label="Imported portfolio dry-run preview">
        <header><div><small>ATLAS / FOUNDER FILE HANDOFF · DRY RUN</small><h4>Review import before writing</h4>
          <p>{pendingImport.filename} · Validated for this organization · Nothing imported yet</p></div>
          <button type="button" className="secondary" onClick={()=>{setPendingImport(null);setNotice('Pending file import cancelled. Original records untouched.');}}>Cancel preview</button>
        </header>
        <div className="atlas-portfolio-import-counts">
          <span><strong>{pendingImport.preview.additions.length}</strong> New exact IDs</span>
          <span><strong>{pendingImport.preview.identicalIds.length}</strong> Already identical</span>
          <span><strong>{pendingImport.preview.conflicts.length}</strong> Same-ID conflicts</span>
          <span><strong>{pendingImport.preview.projectedCount}/{pendingImport.preview.limit}</strong> Project capacity after merge</span>
        </div>
        <p className="atlas-portfolio-import-disclaimer">Two devices may edit the same project independently. Timestamps and revision numbers cannot decide whose edits win. A merge adds ONLY new project IDs; identical IDs remain untouched and different same-ID records are skipped, never overwritten. A missing local ID could represent a previously deleted project; review imported records before relying on them. File exports can contain private customer/site details and are not encrypted.</p>
        {pendingImport.preview.additions.length>0&&<div className="atlas-portfolio-import-details"><strong>New projects eligible for safe merge</strong>
          {pendingImport.preview.additions.map(p=><p key={p.id}>{p.name} · ID {short(p.id)} · local version {p.revision}</p>)}</div>}
        {pendingImport.preview.conflicts.length>0&&<div className="atlas-portfolio-import-details" role="status"><strong>Conflicts: NOT automatically merged</strong>
          {pendingImport.preview.conflicts.map(c=><p key={c.id}>ID {short(c.id)} · This device: “{c.existingName}” (v{c.existingRevision}) · File: “{c.incomingName}” (v{c.incomingRevision})</p>)}
          <p>Use separate exports and manually reconcile these projects. Do not assume that higher revision or newer timestamps indicate the correct copy.</p>
        </div>}
        {!pendingImport.preview.capacityAvailable&&<p className="atlas-project-alert" role="alert">Merge exceeds the 24-project limit. No automatic partial import will occur; export/resolve excess projects or consciously replace the entire portfolio.</p>}
        <div className="atlas-portfolio-import-actions">
          <button type="button" className="primary" disabled={!ready||!pendingImport.preview.capacityAvailable||pendingImport.preview.additions.length===0}
            onClick={()=>applyPendingImport('merge')}><Plus size={15}/> Merge {pendingImport.preview.additions.length} new projects only</button>
          <button type="button" className="secondary" onClick={()=>applyPendingImport('replace')}><ShieldAlert size={15}/> Replace all (destructive)</button>
          <button type="button" className="secondary" onClick={exportPortfolio}><Download size={15}/> Back up current portfolio</button>
        </div>
      </section>}
      {!ready&&<p className="atlas-project-alert" role="alert">Project storage not verified. No portfolio writes are allowed. {notice}</p>}
      <div className="atlas-project-list" aria-label="Saved local commercial projects">
        {portfolio.projects.length===0&&<p>No saved projects on this device. The existing single local estimate is untouched; use “Save as new project” to retain it in this portfolio.</p>}
        {portfolio.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(p=>
          <button key={p.id} type="button" onClick={()=>loadProject(p)} aria-pressed={selectedId===p.id}>
            <Building2 size={17}/><span><strong>{p.name}</strong><small>{p.input.sites.length} building(s) · {p.phase==='founder-review'?'Queued for internal review':p.phase==='archived'?'Archived local plan':'Scoping'} · Version {p.revision}</small></span>
            <ArrowUpRight size={14}/>
          </button>)}
      </div>
      <div className="atlas-project-editor">
        <div className="atlas-project-editor-head"><div><small>LOCAL PLANNING DETAILS</small><h4>{selectedId?'Selected project: '+(current?.name??'not found'):'Unsaved estimate / new project'}</h4></div>{selectedId&&<button type="button" className="secondary" onClick={deleteCurrent}><Trash2 size={15}/> Delete local project</button>}</div>
        <div className="atlas-project-controls">
          <label>Local workflow stage<select value={phase} onChange={e=>setPhase(e.target.value as ProjectPhase)}>{projectPhases.map(x=><option key={x} value={x}>{x==='scoping'?'Scoping':x==='founder-review'?'Founder review requested (not approved)':'Archived locally'}</option>)}</select></label>
          <label>Explicit Exterior booking reference
            <select value={bookingId??''} onChange={e=>setBookingId(e.target.value||null)}>
              <option value="">No booking linked</option>
              {bookingId&&!choices.some(b=>b.id.toLowerCase()===bookingId.toLowerCase())&&<option value={bookingId}>Current ID not among selection (unverified)</option>}
              {choices.map(b=><option key={b.id} value={b.id}>{b.date} · {b.time_block||'time unknown'} · ID {short(b.id)}</option>)}
            </select>
          </label>
        </div>
        <p className="atlas-project-hint">{booking.label}. {selectedBooking?.date?'Recorded date '+selectedBooking.date+'. ':''}A booking reference does not confirm crew, scope, customer authorization or completed work.</p>
        {booking.state==='loaded-active'&&booking.booking&&<Link className="atlas-project-booking-link" href={base+'/b/exterior/calendar'}>Open Exterior bookings <ArrowUpRight size={13}/></Link>}
        <div className="atlas-project-asset-picker"><div><Truck size={16}/><strong>Candidate equipment allocation</strong><span>Not a reservation or dispatch order</span></div>
          <label>Add Fleet Command asset
            <select value={addAsset} onChange={e=>setAddAsset(e.target.value)}>
              <option value="">Choose entered equipment</option>
              {(fleet?.assets??[]).filter(a=>!plannedAssetIds.includes(a.id)).map(a=><option key={a.id} value={a.id}>{a.name} ({a.status})</option>)}
            </select>
          </label>
          <button type="button" className="secondary" disabled={!addAsset||plannedAssetIds.length>=40} onClick={()=>{if(addAsset&&!plannedAssetIds.includes(addAsset))setPlannedAssetIds(v=>[...v,addAsset]);setAddAsset('');}}>Add to plan</button>
        </div>
        {fleetError&&<p className="atlas-project-alert" role="alert"><ShieldAlert size={15}/>{fleetError}</p>}
        <div className="atlas-project-assigned">
          {evidence.map(item=><div key={item.id}><span><strong>{item.name}</strong><small>{item.state==='recorded-ready'?'Manually marked ready; verify on site':item.state.replaceAll('-',' ')} · {knownIds.has(item.id)?'Local asset ID '+short(item.id):'Missing local asset '+short(item.id)}</small></span><button type="button" onClick={()=>setPlannedAssetIds(v=>v.filter(id=>id!==item.id))}>Remove</button></div>)}
          {plannedAssetIds.length===0&&<p>There are no candidate assets on this unsaved plan. Add one from the validated Fleet workbook when available.</p>}
        </div>
        <AtlasFieldMissionPanel org={org} base={base} project={simulated} isSaved={selectedId!==null}
          day={day} plan={fieldCrewPlan} onChange={setFieldCrewPlan}
          fleet={fleet} bookings={bookings} cards={cards} />
        <div className="atlas-project-findings"><strong>Planning exceptions · {findings.length}</strong>
          {findings.map(issue=><p key={issue.id} data-severity={issue.severity}><span>{issue.severity}</span>{issue.text}</p>)}
        </div>
        {selectedId&&<div className="atlas-project-related-tasks" aria-label="Shared tasks explicitly referencing the selected local project">
          <strong>Linked shared task snapshots · {linkedTasks.length}</strong>
          <p>Exact project IDs in currently loaded Exterior task text, not synchronized portfolio records or an authoritative database foreign key.</p>
          {linkedTasks.map(task=><Link key={task.id} href={base+'/tasks?task='+encodeURIComponent(task.id)}>
            <span>{task.title}</span><small>{task.stage} · {task.assignee||'Unassigned'}</small><ArrowUpRight size={14}/>
          </Link>)}
          {linkedTasks.length===0&&<p>No explicit project ID matches in loaded tasks. This does not prove that other records do not exist.</p>}
        </div>}
        <p className="atlas-project-hint">Changes to booking references, stage and candidate assets are local until you click “Save selected project”. The main scope and pricing editor is also stored in this selected portfolio entry only when you save it. Other founder devices cannot see these assignments.</p>
      </div>
    </>}
    {ready&&notice&&<p className="atlas-project-notice" role="status">{notice}</p>}
  </section>;
}
