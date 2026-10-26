'use client';

import { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type Ref } from 'react';
import { Archive, ArrowUpRight, Building2, Download, FileInput, Plus, Save, ShieldAlert, Trash2, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type { Card } from '@/lib/board';
import { exactLocalProjectIds } from '@/lib/atlas-task-handoff';
import { emptyFieldCrewPlan, type FieldCrewPlan } from '@/lib/atlas-field-mission';
import { mergeNonConflictingPortfolio, previewPortfolioMerge, type PortfolioMergePlan } from '@/lib/atlas-portfolio-merge';
import { AtlasFieldMissionPanel } from './AtlasFieldMissionPanel';
import { CommercialProjectAccountLink } from './CommercialProjectAccountLink';
import type { ExtBooking } from '@/lib/exterior';
import type { EstimateInput } from '@/lib/commercial-estimate';
import { newEstimate } from '@/lib/commercial-estimate';
import type { FleetWorkbook } from '@/lib/fleet-command';
import { parseLocalFleetDraft } from '@/lib/atlas-field-bridge';
import { loadCommercialProject, loadCommercialProjects, saveCommercialProject } from '@/app/workspace/commercial-actions';
import { planCommercialSaveAttempt, type CommercialProjectCursor, type CommercialSaveAttempt } from '@/lib/commercial-persistence';
import { recoveryProjectId } from '@/lib/commercial-persistence';
import {
  decodeCommercialPortfolio, emptyCommercialPortfolio,
  encodeCommercialPortfolio, projectEquipmentEvidence, projectPhases,
  resolveSourceBooking, resourcePlanFindings, portfolioMaxBytes,
  type CommercialPortfolio, type CommercialProject, type ProjectDraft, type ProjectPhase,
} from '@/lib/atlas-commercial-portfolio';

export type CommercialSaveHandle={save:()=>Promise<string|null>};
type Props={
  org:string;base:string;mode:'preview'|'live';readOnly:boolean;
  name:string;input:EstimateInput;review:boolean[];
  bookings:ExtBooking[];cards:Card[];
  onLoad:(project:Pick<CommercialProject,'name'|'input'|'review'>)=>void;
  saveHandle?:Ref<CommercialSaveHandle>;
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
export function AtlasCommercialPortfolio({org,base,mode,readOnly,name,input,review,bookings,cards,onLoad,saveHandle}:Props){
  const router=useRouter();
  const params=useSearchParams();
  const targetProject=params.get('project');
  const openedTarget=useRef('');
  const canEdit=mode==='live'&&!readOnly;
  const key='oj-commercial-project-portfolio-v1:'+org;
  const fleetKey='oj-fleet-command-v1:'+org;
  const fileInput=useRef<HTMLInputElement>(null);
  const [portfolio,setPortfolio]=useState<CommercialPortfolio>(()=>emptyCommercialPortfolio(org));
  const [recoveryPortfolio,setRecoveryPortfolio]=useState<CommercialPortfolio>(()=>emptyCommercialPortfolio(org));
  const [fleet,setFleet]=useState<FleetWorkbook|null>(null);
  const [fleetError,setFleetError]=useState('');
  const [ready,setReady]=useState(false);
  const [storageState,setStorageState]=useState<'loading'|'saved'|'saving'|'offline'|'conflict'|'error'|'setup-required'>('loading');
  const [storageDetail,setStorageDetail]=useState('');
  const [pageCursor,setPageCursor]=useState<CommercialProjectCursor>(null);
  const [hasMore,setHasMore]=useState(false);
  const [loadingMore,setLoadingMore]=useState(false);
  const saveCommandRef=useRef<CommercialSaveAttempt|null>(null);
  const saveInFlightRef=useRef(false);
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

  const reload=useCallback(async()=>{
    if(!canEdit)return;
    let local=emptyCommercialPortfolio(org);
    try{
      const raw=window.localStorage.getItem(key);
      local=raw?decodeCommercialPortfolio(raw,org):emptyCommercialPortfolio(org);
      setRecoveryPortfolio(local);
    }catch(error){
      setStorageDetail((error instanceof Error?error.message:'Browser recovery portfolio could not be read.')+
        ' Original local data was NOT overwritten.');
    }
    try{
      const page=await loadCommercialProjects(org);
      setPortfolio({format:'oj-commercial-portfolio-local-v1',version:1,organizationId:org,revision:0,projects:page.projects});
      setPageCursor(page.nextCursor);setHasMore(page.hasMore);
      setStorageState('saved');setStorageDetail('Shared organization records loaded. Browser recovery copies remain unchanged.');
    }catch(error){
      setPortfolio(emptyCommercialPortfolio(org));setPageCursor(null);setHasMore(false);
      const message=error instanceof Error?error.message:'Shared commercial records could not be loaded.';
      setStorageState(message.includes('not installed')?'setup-required':'offline');
      setStorageDetail(message);
    }finally{
      setReady(true);
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
    saveCommandRef.current=null;
    setReady(false);setSelectedId(null);setExpectedRevision(null);setPortfolio(emptyCommercialPortfolio(org));
    setRecoveryPortfolio(emptyCommercialPortfolio(org));setStorageState('loading');setStorageDetail('');setPageCursor(null);setHasMore(false);
    setPhase('scoping');setBookingId(null);setPlannedAssetIds([]);setFieldCrewPlan(emptyFieldCrewPlan());
    setFleet(null);setNotice('');setPendingImport(null);setDay(dateChicago());
    if(!canEdit){setReady(true);return;}
    void reload();reloadFleet();
    const onStorage=(event:StorageEvent)=>{
      if(event.key===key||event.key===null)reload();
      if(event.key===fleetKey||event.key===null)reloadFleet();
    };
    const onFocus=()=>{void reload();reloadFleet();setDay(dateChicago());};
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

  function loadProject(project:CommercialProject,source:'shared'|'recovery'='shared'){
    if(saveInFlightRef.current)return;
    if(!window.confirm('Load "'+project.name+'"? This replaces unsaved scope and pricing edits in the current editor.'))return;
    saveCommandRef.current=null;
    if(source==='shared'){
      setSelectedId(project.id);setExpectedRevision(project.revision);
    }else{
      setSelectedId(null);setExpectedRevision(null);
    }
    setPhase(project.phase);
    setBookingId(project.bookingId);setPlannedAssetIds([...project.plannedAssetIds]);
    setFieldCrewPlan({...project.fieldCrewPlan??emptyFieldCrewPlan()});
    onLoad({name:project.name,input:structuredClone(project.input),review:[...project.review]});
    setNotice(source==='shared'?'Shared project loaded. New edits require an explicit shared save.':'Browser recovery copy loaded without changing its original. Save it as a new shared project after reviewing it.');
  }
  // NEXUS links may point beyond the first paginated page. Resolve the exact
  // shared record through the authenticated server action; never assume a
  // current-device local portfolio contains the project's latest revision.
  useEffect(()=>{
    if(!ready||!canEdit||!targetProject)return;
    const marker=org+':'+targetProject;
    if(openedTarget.current===marker)return;
    openedTarget.current=marker;
    const target=portfolio.projects.find(p=>p.id===targetProject);
    if(target)loadProject(target);
    else if(recoveryPortfolio.projects.some(p=>p.id===targetProject))setNotice('This project link points to a browser recovery record. Import that record into shared storage first; nothing was changed.');
    else void loadCommercialProject(org,targetProject).then(shared=>{
      if(openedTarget.current!==marker)return;
      if(!shared){setNotice('The requested shared project was not found or is no longer accessible. Nothing was loaded or changed.');return;}
      setPortfolio(current=>({...current,projects:[shared,...current.projects.filter(item=>item.id!==shared.id)]}));
      loadProject(shared);
    }).catch(error=>{
      if(openedTarget.current!==marker)return;
      setNotice(error instanceof Error?error.message:'The shared project could not be loaded.');
    });
  },[ready,canEdit,targetProject,org,portfolio.projects,recoveryPortfolio.projects]);

  function newProject(){
    if(saveInFlightRef.current)return;
    if(!window.confirm('Begin a new project? Unsaved changes to the currently open estimate will be discarded. Previously saved portfolio entries remain.'))return;
    saveCommandRef.current=null;
    setSelectedId(null);setExpectedRevision(null);setPhase('scoping');
    setBookingId(null);setPlannedAssetIds([]);setFieldCrewPlan(emptyFieldCrewPlan());
    onLoad({name:'New commercial opportunity',input:newEstimate(),review:[false,false,false,false,false]});
    setNotice('New unsaved estimate started. Save it to the shared project register to preserve it across devices.');
  }
  function storagePortfolio():CommercialPortfolio{
    const raw=window.localStorage.getItem(key);
    return raw?decodeCommercialPortfolio(raw,org):emptyCommercialPortfolio(org);
  }
  function persistRecovery(next:CommercialPortfolio,expectedPortfolioRevision:number,message:string){
    const fresh=storagePortfolio();
    if(fresh.revision!==expectedPortfolioRevision){
      throw new Error('Portfolio changed in another tab. Reload the page or reopen the updated project before saving.');
    }
    window.localStorage.setItem(key,encodeCommercialPortfolio(next,org));
    setRecoveryPortfolio(next);setNotice(message);
  }
  async function saveCurrent():Promise<string|null>{
    // Lock synchronously: rapid double clicks must never create two projects.
    if(!canEdit||!ready||saveInFlightRef.current)return null;
    saveInFlightRef.current=true;
    try{
      // Retain the same project+command UUIDs across a dropped response.
      const attempt=planCommercialSaveAttempt(
        saveCommandRef.current,selectedId,expectedRevision,draft,()=>crypto.randomUUID(),
      );
      saveCommandRef.current=attempt;
      const id=attempt.projectId;
      setStorageState('saving');setStorageDetail('Saving a versioned internal estimate to shared OJ storage.');
      const result=await saveCommercialProject(org,id,expectedRevision,attempt.commandId,draft);
      if(result.status==='conflict'){
        setStorageState('conflict');setStorageDetail('This project changed on another device. Your edits remain in the current page and the browser recovery copy is untouched. Reload the shared version before retrying.');
        setNotice('Shared project conflict. Your unsaved editor values were kept.');
        return null;
      }
      setPortfolio(current=>({ ...current, projects:[result.project,...current.projects.filter(item=>item.id!==id)] }));
      setSelectedId(id);setExpectedRevision(result.project.revision);
      setStorageState('saved');setStorageDetail(`Shared version ${result.project.revision} saved${result.replayed?' (retry receipt confirmed)':''}.`);
      setNotice('Shared project saved. This is still an internal estimate, not a sent or accepted quote.');
      saveCommandRef.current=null;
      return id;
    }catch(error){
      const message=error instanceof Error?error.message:'Project could not be saved.';
      setStorageState(message.includes('not installed')?'setup-required':'offline');setStorageDetail(message);setNotice(message);
      return null;
    }finally{
      saveInFlightRef.current=false;
    }
  }
  useImperativeHandle(saveHandle,()=>({save:saveCurrent}));
  async function prepareProjectTask(){
    if(phase==='archived'){setNotice('Restore the project to scoping or review before preparing a shared task.');return;}
    const id=await saveCurrent();
    if(id)router.push(base+'/tasks?sourceProject='+encodeURIComponent(id));
  }
  async function archiveCurrent(){
    if(saveInFlightRef.current||!canEdit||!selectedId||expectedRevision===null)return;
    const target=portfolio.projects.find(p=>p.id===selectedId);
    if(!target||target.phase==='archived'||!window.confirm('Archive "'+target.name+'"? This preserves the project, every estimate version, private costs and history. No source booking or task is changed.'))return;
    const id=await saveCommercialProject(org,selectedId,expectedRevision,crypto.randomUUID(),{...draft,phase:'archived'}).then(result=>{
      if(result.status==='conflict'){setStorageState('conflict');setStorageDetail('Project changed on another device. Reload before archiving.');return null;}
      setPortfolio(current=>({...current,projects:current.projects.map(item=>item.id===selectedId?result.project:item)}));
      setExpectedRevision(result.project.revision);setPhase('archived');setStorageState('saved');setStorageDetail('Project archived. Versions, costs and history are retained.');return selectedId;
    }).catch(error=>{const message=error instanceof Error?error.message:'Archive failed.';setStorageState(message.includes('not installed')?'setup-required':'error');setStorageDetail(message);return null;});
    if(id)setNotice('Project archived. Its saved history and private costs remain in shared storage.');
  }
  async function loadMoreProjects(){
    if(!canEdit||!hasMore||!pageCursor||loadingMore)return;
    setLoadingMore(true);
    try{
      const page=await loadCommercialProjects(org,pageCursor);
      setPortfolio(current=>({...current,projects:[...current.projects,...page.projects.filter(item=>!current.projects.some(existing=>existing.id===item.id))]}));
      setPageCursor(page.nextCursor);setHasMore(page.hasMore);setStorageState('saved');
    }catch(error){
      const message=error instanceof Error?error.message:'Could not load more shared projects.';
      setStorageState(message.includes('not installed')?'setup-required':'offline');setStorageDetail(message);
    }finally{setLoadingMore(false);}
  }
  async function importRecoveryProject(project:CommercialProject){
    if(!canEdit||!ready||saveInFlightRef.current)return;
    if(portfolio.projects.some(item=>item.id===project.id)){
      setNotice('This exact project ID is already shared. The browser recovery record remains unchanged; compare revisions before reconciling.');return;
    }
    const recoveredDraft:ProjectDraft={name:project.name,input:structuredClone(project.input),review:[...project.review],
      phase:project.phase,bookingId:project.bookingId,plannedAssetIds:[...project.plannedAssetIds],fieldCrewPlan:structuredClone(project.fieldCrewPlan??emptyFieldCrewPlan())};
    setStorageState('saving');setStorageDetail('Importing one exact browser recovery project as a new shared record.');
    try{
      const sharedId=await recoveryProjectId(org,project.id);
      const result=await saveCommercialProject(org,sharedId,null,crypto.randomUUID(),recoveredDraft);
      if(result.status==='conflict'){
        setStorageState('conflict');setStorageDetail('A shared record already uses this project ID. No record was overwritten.');
        setNotice('Import conflict: shared project exists. Keep both copies and reconcile manually.');return;
      }
      setPortfolio(current=>({...current,projects:[result.project,...current.projects]}));
      saveCommandRef.current=null;
      setSelectedId(sharedId);setExpectedRevision(result.project.revision);
      setStorageState('saved');setStorageDetail('One browser recovery project was copied to shared storage. Original local data remains intact.');
      setNotice(sharedId===project.id?'Recovery copy imported as a shared project. Its original browser record remains unchanged.':'Recovery copy imported using a stable organization-scoped shared ID. The original browser ID and record remain unchanged.');
    }catch(error){
      const message=error instanceof Error?error.message:'Recovery import failed.';
      setStorageState(message.includes('not installed')?'setup-required':'offline');setStorageDetail(message);setNotice(message);
    }
  }
  function exportPortfolio(){
    if(!canEdit||!ready)return;
    try{
      const json=encodeCommercialPortfolio(recoveryPortfolio,org);
      const url=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
      const a=document.createElement('a');a.href=url;a.download='oj-private-commercial-portfolio.json';a.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice('Browser recovery portfolio exported in unencrypted JSON. The original browser record remains unchanged; transfer securely.');
    }catch(error){setNotice(error instanceof Error?error.message:'Export failed.');}
  }
  /** File selection ONLY previews; no local or remote records are written. */
  async function importPortfolio(file:File|undefined){
    if(!canEdit||!ready||!file)return;
    setPendingImport(null);
    try{
      if(file.size>portfolioMaxBytes)throw new Error('Browser recovery file exceeds the 5 MB limit.');
      const imported=decodeCommercialPortfolio(await file.text(),org);
      const currentState=storagePortfolio();
      if(currentState.revision!==recoveryPortfolio.revision)
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
      if(currentState.revision!==recoveryPortfolio.revision||currentState.revision!==pendingImport.baseline)
        throw new Error('Portfolio changed since this preview was created. Cancel and reselect the file; no changes were made.');
      // Recompute against the freshest validated storage, never trust a stale
      // UI summary or use the other browser's revision as a global clock.
      const preview=previewPortfolioMerge(currentState,pendingImport.incoming,org);
      if(strategy==='merge'){
        if(!preview.capacityAvailable)throw new Error('Import would exceed the browser recovery limit. Nothing was imported.');
        if(!preview.additions.length){
          setNotice('No new project IDs in this file. '+preview.conflicts.length+' conflicting record(s) remain untouched.');
          setPendingImport(null);return;
        }
        if(!window.confirm('MERGE only '+preview.additions.length+' new exact project IDs into this browser? '+
            preview.conflicts.length+' conflicting same-ID records will be SKIPPED and left unchanged. '+
            'Existing projects, Fleet and source bookings are never overwritten. Continue?'))return;
        const result=mergeNonConflictingPortfolio(currentState,pendingImport.incoming,org);
        if(!result.changed)throw new Error('No new records to import. Nothing was changed.');
        persistRecovery(result.next,currentState.revision,'Merged '+result.plan.additions.length+' new project(s) into the browser recovery copy. '+
          result.plan.conflicts.length+' same-ID conflict(s) were skipped. Shared projects were not changed.');
      }else{
        if(!window.confirm('REPLACE ALL '+currentState.projects.length+' browser-local project(s) with '+
            pendingImport.incoming.projects.length+' from the selected file? Local-only projects NOT in the file will be LOST. '+
            'Export a backup first. Shared bookings and tasks stay untouched. Continue?'))return;
        const importedNext={...pendingImport.incoming,revision:currentState.revision+1};
        persistRecovery(importedNext,currentState.revision,'Browser recovery copy replaced from the explicitly selected file. Shared projects and the source file are unchanged.');
        setSelectedId(null);setExpectedRevision(null);setPhase('scoping');setBookingId(null);
        setPlannedAssetIds([]);setFieldCrewPlan(emptyFieldCrewPlan());
        // Do not leave an old removed project's unsaved scope in the estimator
        // under a misleading 'new project' label after destructive replacement.
        onLoad({name:'New commercial opportunity',input:newEstimate(),review:[false,false,false,false,false]});
      }
      setPendingImport(null);
    }catch(error){
      setNotice(error instanceof Error?error.message:'Import was refused. No records were changed.');
    }
  }
  if(!canEdit)return <section className="atlas-project-portfolio"><header><div><small>ATLAS / PROJECT PORTFOLIO</small><h3>Commercial project register</h3></div></header><p>Shared internal estimate storage is unavailable in preview or read-only mode. Nothing was read from local browser project storage.</p></section>;
  return <section className="atlas-project-portfolio" aria-label="Shared commercial project portfolio">
    <header className="atlas-project-portfolio-head">
      <div><small>ATLAS / PROJECT PORTFOLIO</small><h3>Shared commercial project register</h3><p>Organization-scoped project records and immutable estimate versions shared with current OJ members. Internal planning only; no quote, contract, dispatch or payment is created.</p></div>
      <button type="button" className="secondary" onClick={()=>setShowPortfolio(v=>!v)}>{showPortfolio?'Collapse portfolio':'Expand portfolio'} ({portfolio.projects.length})</button>
    </header>
    {showPortfolio&&<>
      <div className="atlas-project-storage-state" role="status" data-state={storageState}>
        <strong>{storageState==='loading'?'Loading shared records':storageState==='saving'?'Saving shared version':storageState==='saved'?'Shared storage connected':storageState==='conflict'?'Conflict — changes preserved':storageState==='offline'?'Shared storage unavailable':storageState==='setup-required'?'Database setup required':'Storage error'}</strong>
        <span>{storageDetail||'The source schema is not yet installed in production. Existing browser drafts remain available below.'}</span>
        <button type="button" className="secondary" disabled={storageState==='loading'||storageState==='saving'} onClick={()=>void reload()}>Refresh shared records</button>
      </div>
      <div className="atlas-project-toolbar">
        <button type="button" className="secondary" disabled={storageState==='saving'} onClick={newProject}><Plus size={15}/> New project</button>
        <button type="button" className="primary" disabled={!ready||storageState==='setup-required'||storageState==='saving'} onClick={()=>void saveCurrent()}><Save size={15}/> {selectedId?'Save shared project version':'Save as shared project'}</button>
        <button type="button" className="secondary" disabled={!ready||storageState==='saving'||storageState==='setup-required'||phase==='archived'} onClick={prepareProjectTask}>Save & prepare project task <ArrowUpRight size={15}/></button>
        <Link className="secondary nexus-editor-link" href={base+"/b/exterior/projects"+(selectedId?"?project="+encodeURIComponent(selectedId):"")}>NEXUS / Shared project 360 <ArrowUpRight size={14}/></Link>
        <button type="button" className="secondary" disabled={!ready} onClick={exportPortfolio}><Download size={15}/> Export browser recovery</button>
        <button type="button" className="secondary" disabled={!ready} onClick={()=>fileInput.current?.click()}><FileInput size={15}/> Import recovery file</button>
        <input type="file" ref={fileInput} hidden accept="application/json,.json" aria-label="Import a commercial project recovery file into this browser" onChange={e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importPortfolio(file);}}/>
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
        {!pendingImport.preview.capacityAvailable&&<p className="atlas-project-alert" role="alert">Merge exceeds the 250-project recovery limit. No automatic partial import will occur; export/resolve excess projects or consciously replace the entire portfolio.</p>}
        <div className="atlas-portfolio-import-actions">
          <button type="button" className="primary" disabled={!ready||!pendingImport.preview.capacityAvailable||pendingImport.preview.additions.length===0}
            onClick={()=>applyPendingImport('merge')}><Plus size={15}/> Merge {pendingImport.preview.additions.length} new projects only</button>
          <button type="button" className="secondary" onClick={()=>applyPendingImport('replace')}><ShieldAlert size={15}/> Replace all (destructive)</button>
          <button type="button" className="secondary" onClick={exportPortfolio}><Download size={15}/> Back up current portfolio</button>
        </div>
      </section>}
      {!ready&&<p className="atlas-project-alert" role="alert">Shared project storage has not been verified. No shared writes are available. {notice}</p>}
      <div className="atlas-project-list" aria-label="Shared commercial projects">
        {portfolio.projects.length===0&&<p>No shared commercial projects are loaded. The current estimate and every old browser recovery record remain untouched.</p>}
        {portfolio.projects.slice().sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)).map(p=>
          <button key={p.id} type="button" disabled={storageState==='saving'} onClick={()=>loadProject(p)} aria-pressed={selectedId===p.id}>
            <Building2 size={17}/><span><strong>{p.name}</strong><small>{p.input.sites.length} building(s) · {p.phase==='founder-review'?'Queued for internal review':p.phase==='archived'?'Archived':'Scoping'} · Shared version {p.revision}</small></span>
            <ArrowUpRight size={14}/>
          </button>)}
        {hasMore&&<button type="button" className="secondary atlas-project-load-more" disabled={loadingMore} onClick={()=>void loadMoreProjects()}>{loadingMore?'Loading…':'Load next shared projects'}</button>}
      </div>
      {recoveryPortfolio.projects.length>0&&<section className="atlas-project-recovery" aria-label="Browser-only commercial recovery records">
        <header><div><small>THIS DEVICE / RECOVERY ONLY</small><h4>{recoveryPortfolio.projects.length} saved browser project(s)</h4><p>These originals have not been changed or copied automatically. Export a checksum archive before moving records into shared storage.</p></div><button type="button" className="secondary" onClick={exportPortfolio}><Download size={14}/> Export recovery copy</button></header>
        {recoveryPortfolio.projects.map(project=><div className="atlas-project-recovery-row" key={project.id}>
          <button type="button" className="secondary" disabled={storageState==='saving'} onClick={()=>loadProject(project,'recovery')}><Building2 size={15}/>{project.name} · local v{project.revision}</button>
          <button type="button" className="secondary" disabled={!ready||storageState==='setup-required'||storageState==='saving'||portfolio.projects.some(item=>item.id===project.id)} onClick={()=>void importRecoveryProject(project)}><Plus size={14}/>Copy this record to shared</button>
        </div>)}
      </section>}
      <div className="atlas-project-editor">
        <div className="atlas-project-editor-head"><div><small>{selectedId?'SHARED PROJECT / PRIVATE COSTS':'UNSAVED SCENARIO'}</small><h4>{selectedId?'Selected project: '+(current?.name??'not found'):'Unsaved estimate / new project'}</h4></div>{selectedId&&current?.phase!=='archived'&&<button type="button" className="secondary" onClick={()=>void archiveCurrent()}><Archive size={15}/> Archive project</button>}</div>
        <div className="atlas-project-controls">
          <label>Internal workflow stage<select value={phase} disabled={current?.phase==='archived'} onChange={e=>setPhase(e.target.value as ProjectPhase)}>{projectPhases.map(x=><option key={x} value={x}>{x==='scoping'?'Scoping':x==='founder-review'?'Founder review requested (not approved)':'Archived'}</option>)}</select></label>
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
        <CommercialProjectAccountLink key={selectedId??'unsaved'} org={org} projectId={selectedId}
          projectSaved={Boolean(current&&selectedId&&expectedRevision!==null)} />
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
          <p>Exact project IDs in currently loaded Exterior task text. This reference does not assert scheduled or fulfilled work.</p>
          {linkedTasks.map(task=><Link key={task.id} href={base+'/tasks?task='+encodeURIComponent(task.id)}>
            <span>{task.title}</span><small>{task.stage} · {task.assignee||'Unassigned'}</small><ArrowUpRight size={14}/>
          </Link>)}
          {linkedTasks.length===0&&<p>No explicit project ID matches in loaded tasks. This does not prove that other records do not exist.</p>}
        </div>}
        <p className="atlas-project-hint">Edits remain in the page until you save a new shared version. Every successful save records an immutable estimate version, separate building scope, private costs and an audit event. A booking reference or equipment plan never means a job is booked or dispatched.</p>
      </div>
    </>}
    {ready&&notice&&<p className="atlas-project-notice" role="status">{notice}</p>}
  </section>;
}
