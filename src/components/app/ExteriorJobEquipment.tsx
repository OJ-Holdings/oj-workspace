'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import {loadSharedDraft,saveSharedDraft} from '@/app/workspace/shared-draft-actions';
import Link from 'next/link';
import {AlertTriangle,CheckCircle2,ClipboardCheck,RefreshCw,ShieldAlert,Truck,Wrench} from 'lucide-react';
import type {ExtBooking,ExteriorData} from '@/lib/exterior';
import {decodeFleet,type FleetWorkbook} from '@/lib/fleet-command';
import {chicagoDateOf} from '@/lib/atlas-field-bridge';
import {
 encodeEquipmentPlan,equipmentPlanKey,evaluateEquipmentPlan,makeEquipmentPlan,parseEquipmentPlan,
 type FieldEquipmentPlan,
} from '@/lib/exterior-field-equipment';

type Props={org:string;booking:ExtBooking;data:ExteriorData;readOnly:boolean;mode:'live'|'preview';base:string};
export function ExteriorJobEquipment({org,booking,data,readOnly,mode,base}:Props){
 const canEdit=!readOnly&&mode==='live';
 const [plan,setPlan]=useState<FieldEquipmentPlan|null>(null);
 const [fleet,setFleet]=useState<FleetWorkbook|null>(null);
 const [loadError,setLoadError]=useState('');
 const [notice,setNotice]=useState('');
 const [sameDay,setSameDay]=useState<{booking:ExtBooking;plan:FieldEquipmentPlan}[]>([]);
 const [loaded,setLoaded]=useState(false);
 const [hadLocal,setHadLocal]=useState(false);
 const [sharedStatus,setSharedStatus]=useState<'loading'|'ready'|'local-only'|'saving'|'conflict'|'offline'>('loading');
 const [remote,setRemote]=useState<FieldEquipmentPlan|null>(null);
 const [sharedRevision,setSharedRevision]=useState<number|null>(null);
 const [sharedRefresh,setSharedRefresh]=useState(0);
 const planRef=useRef<FieldEquipmentPlan|null>(null);
 const pendingSync=useRef<{plan:FieldEquipmentPlan;expected:number;commandId:string}|null>(null);
 const today=chicagoDateOf(new Date().toISOString())??'';
 const fleetRoute=base+'/tools/fleet';

 const reload=()=>{
  setLoaded(false);setHadLocal(false);setSharedStatus('loading');setRemote(null);setSharedRevision(null);
  pendingSync.current=null;setLoadError('');setNotice('');
  if(!canEdit){
   setPlan(makeEquipmentPlan(org,booking));setFleet(null);setSameDay([]);setLoaded(true);return;
  }
  let unsafe='';
  let workbook:FleetWorkbook|null=null;
  let assignment:FieldEquipmentPlan|null=null;
  try{
   const raw=window.localStorage.getItem('oj-fleet-command-v1:'+org);
   if(raw)workbook=decodeFleet(raw,org);
  }catch{unsafe='Fleet Command storage is corrupted or inaccessible; this job is not equipment-cleared.';}
  try{
   const raw=window.localStorage.getItem(equipmentPlanKey(org,booking.id));
   setHadLocal(Boolean(raw));
   assignment=raw?parseEquipmentPlan(raw,org,booking):makeEquipmentPlan(org,booking);
  }catch{
   unsafe+=(unsafe?' ':'')+'Existing job equipment assignment could not be verified. It was NOT overwritten.';
  }
  const competing:{booking:ExtBooking;plan:FieldEquipmentPlan}[]=[];
  for(const b of data.bookings){
   if(b.id===booking.id||b.date!==booking.date||!b.lead_id||
      b.status==='cancelled'||b.status==='denied')continue;
   try{
    const raw=window.localStorage.getItem(equipmentPlanKey(org,b.id));
    if(raw)competing.push({booking:b,plan:parseEquipmentPlan(raw,org,b)});
   }catch{ /* a damaged unknown plan is never represented as a confirmed conflict or clearance */ }
  }
  setPlan(assignment??makeEquipmentPlan(org,booking));setFleet(workbook);
  setSameDay(competing);setLoadError(unsafe);setLoaded(true);
 };
 useEffect(()=>{reload();},[org,booking.id,booking.lead_id,booking.date,booking.status,canEdit,data.bookings]); // eslint-disable-line react-hooks/exhaustive-deps
 planRef.current=plan;
 useEffect(()=>{
  if(!canEdit||!loaded||loadError)return;
  let cancelled=false;
  setSharedStatus('loading');
  void loadSharedDraft(org,'exterior_equipment',booking.id).then(doc=>{
   if(cancelled)return;
   setSharedRevision(doc?.revision??0);setRemote(doc?.payload??null);
   if(!doc){setSharedStatus('local-only');return;}
   const local=planRef.current;
   const blank=!hadLocal&&local&&JSON.stringify(local)===JSON.stringify(makeEquipmentPlan(org,booking));
   if(blank||(local&&JSON.stringify(local)===JSON.stringify(doc.payload))){
    setPlan(doc.payload);setSharedStatus('ready');
   }else{
    setSharedStatus('conflict');
    setNotice('Company equipment plan differs from this device. Neither plan was overwritten.');
   }
  }).catch(e=>{
   if(cancelled)return;setSharedStatus('offline');
   setNotice(e instanceof Error?e.message:'Shared equipment storage unavailable; local plan preserved.');
  });
  return ()=>{cancelled=true;};
 },[org,booking.id,booking.lead_id,booking.date,booking.status,canEdit,loaded,loadError,hadLocal,sharedRefresh]); // eslint-disable-line react-hooks/exhaustive-deps
 const report=useMemo(()=>{
  if(!plan)return null;
  try{return evaluateEquipmentPlan(plan,booking,fleet,sameDay,today);}
  catch{return null;}
 },[plan,booking,fleet,sameDay,today]);
 const save=(next:FieldEquipmentPlan,msg:string)=>{
  if(!canEdit||loadError)return;
  try{
   const text=encodeEquipmentPlan(next,org,booking);
   window.localStorage.setItem(equipmentPlanKey(org,booking.id),text);
   setPlan(parseEquipmentPlan(text,org,booking));
   if(sharedStatus==='ready')setSharedStatus('local-only');setNotice(msg);
  }catch{setLoadError('This browser could not save the equipment assignment. No verified save receipt exists.');}
 };
 const toggle=(assetId:string)=>{
  if(!plan)return;
  const has=plan.selectedAssetIds.includes(assetId);
  if(!has&&plan.selectedAssetIds.length>=30){setNotice('Maximum 30 candidate assets per job.');return;}
  save({...plan,selectedAssetIds:has?plan.selectedAssetIds.filter(id=>id!==assetId):[...plan.selectedAssetIds,assetId],
   reviewedAt:null},'Equipment selection saved on this browser only. A new operator review is required.');
 };
 const review=()=>{
  if(!plan||!report||!fleet||!report.sourceMatches)return;
  if(plan.selectedAssetIds.length===0||report.missingIds.length){setNotice('Choose a recorded asset and resolve any missing equipment IDs before logging a manual review.');return;}
  if(report.findings.some(f=>f.type==='stop')){
   setNotice('Cannot mark locally reviewed: source is inactive, equipment is out of service/overdue, or payload exceeds the entered limit.');return;
  }
  if(!window.confirm('Record that you manually reviewed this equipment plan today? This does NOT confirm physical inspection, asset reservation, crew availability or safe operation.'))return;
  save({...plan,reviewedAt:new Date().toISOString()},'Local equipment review time recorded. Site-specific safety checks are still required.');
 };
 const rebase=()=>{
  if(!plan||!canEdit||!window.confirm('Booking source changed. Keep the equipment ID list but reset the source date/status and operator review to current dispatch details?'))return;
  save({...makeEquipmentPlan(org,booking),selectedAssetIds:[...plan.selectedAssetIds]},
    'Booking source details updated locally. Equipment review must be repeated.');
 };
 if(!loaded)return <section className="ecfield-panel ecfield-equip" aria-busy="true"><p>Checking this browser's Fleet Command register…</p></section>;
 const critical=report?.findings.filter(f=>f.type==='stop')??[];
 const attention=report?.findings.filter(f=>f.type==='attention')??[];
 return <section className="ecfield-panel ecfield-equip" aria-label="Job equipment plan">
  <header className="ecfield-heading"><div><span className="ecfield-overline">09 / JOB EQUIPMENT PLAN</span>
    <h2>Assign the rig. Verify readiness.</h2>
    <p>Equipment from this browser's existing Fleet Command register. This is a local plan, not a company-wide reservation or safety clearance.</p></div><Truck size={22}/></header>
  <div className="ecfield-equip-head">
   <div><small>Selected equipment</small><strong>{plan?.selectedAssetIds.length??0}</strong></div>
   <div><small>Attention / equipment conflicts</small><strong>{critical.length+attention.length}</strong></div>
   <div><small>Manually reviewed today</small><strong>{report?.reviewedToday?'Yes · local':'No / unknown'}</strong></div>
  </div>
  {loadError&&<p className="ecfield-equip-warning" role="alert"><ShieldAlert size={17}/>{loadError}</p>}
  {!fleet&&<p className="ecfield-equip-warning"><AlertTriangle size={17}/>No trustworthy Fleet Command workbook is loaded on this device. Assets, maintenance and load capacity are unknown—not ready.</p>}
  <div className="ecfield-equip-actions">
   <Link href={fleetRoute}><Wrench size={15}/> Fleet Command <span aria-hidden="true">↗</span></Link>
   {canEdit&&<button type="button" onClick={reload}><RefreshCw size={15}/> Refresh local fleet</button>}
   {canEdit&&plan&&!report?.sourceMatches&&<button type="button" onClick={rebase}>Rebase booking source</button>}
  </div>
  {fleet&&<div className="ecfield-equip-assets">
   {fleet.assets.map(asset=>{
    const assigned=plan?.selectedAssetIds.includes(asset.id)??false;
    const health=report?.assigned.find(x=>x.asset.id===asset.id)?.health;
    const disabled=!canEdit||!!loadError;
    return <label key={asset.id} className={assigned?'assigned':''}>
      <input type="checkbox" checked={assigned} disabled={disabled} onChange={()=>toggle(asset.id)}/>
      <span><strong>{asset.name}</strong><small>{asset.model||asset.kind} · locally marked {asset.status}{assigned&&health?' · '+health:''}</small></span>
    </label>;
   })}
   {!fleet.assets.length&&<p className="ecfield-empty">This browser's Fleet Command has no asset records. Add the truck, washer, pole system or other actual equipment before selecting it for work.</p>}
  </div>}
  {report&&<div className="ecfield-equip-findings" aria-label="Equipment readiness limitations">
    {report.findings.map((finding,i)=><p key={i} data-level={finding.type}>
      {finding.type==='stop'?<ShieldAlert size={16}/>:finding.type==='attention'?<AlertTriangle size={16}/>:<ClipboardCheck size={16}/>}
      {finding.message}</p>)}
    <div><small>Fleet pre-departure checklist:</small><strong>{report.fleetChecklistChecked}/{report.fleetChecklistTotal} locally checked today</strong></div>
    <div><small>Entered rig payload margin:</small><strong>{report.capacityRemainingLb===null?'Unknown':report.capacityRemainingLb.toFixed(1)+' lb'}</strong></div>
    {report.sameDayConflicts.map(conflict=><p key={conflict.assetId} data-level="attention">
      <AlertTriangle size={16}/>{conflict.name} also appears on {conflict.bookingIds.length} other locally saved assignment(s) for this date. Check actual time and availability.</p>)}
  </div>}
  {report?.reviewedToday&&<p className="ecfield-equip-reviewed"><CheckCircle2 size={17}/> An operator review was recorded today. Verify the equipment physically before each use; this is not a clearance.</p>}
  {canEdit&&<button className="ecfield-equip-review" type="button"
   disabled={!report||!fleet||!report.sourceMatches||!plan?.selectedAssetIds.length||!!report.missingIds.length||!!loadError||report.findings.some(f=>f.type==='stop')}
   onClick={review}><CheckCircle2 size={16}/> Record manual equipment review</button>}
  <p className="ecfield-disclaimer">Other-booking conflicts are detected only among booking plans saved on this same browser and in the currently loaded source window. Unknown elsewhere does not mean available. Changes here do not reserve equipment, update the Fleet workbook or the corporate job ledger.</p>
  {notice&&<p className="ecfield-toast" role="status">{notice}</p>}
 </section>;
}
