'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {
  AlertTriangle,ArrowLeft,ArrowRight,ArrowUpRight,CalendarDays,Check,
  ClipboardList,Clock3,Download,Droplets,FileUp,HardHat,MapPin,Plus,
  ShieldAlert,ShieldCheck,Timer,Trash2,Truck,UsersRound,Wrench,
} from 'lucide-react';
import type {ExteriorData,ExtBooking} from '@/lib/exterior';
import {statusLabel} from '@/lib/exterior';
import {ExteriorJobEquipment} from './ExteriorJobEquipment';
import {
  fieldCheckLabels,fieldSourceMatches,isFieldLog,newFieldLog,parseFieldPackage,
  reviewFieldLog,serializeFieldPackage,fieldLogMaxChars,
  type CheckState,type ExteriorFieldLog,type FieldChecklist,type FieldIssue,
  type FieldLabor,type FieldMaterial,type FieldStage,
} from '@/lib/exterior-field-log';

type Props={data:ExteriorData;org:string;readOnly:boolean;mode:'preview'|'live';base:string;now:Date};
const usd=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const day=(s:string)=>new Date(s+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const stamp=(s:string|null)=>s?new Date(s).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):'Not entered';
const key=(org:string,bid:string)=>'oj-exterior-field-v1:'+org+':'+bid;
const statuses:{value:CheckState;label:string}[]=[
 {value:'not-checked',label:'Not checked'},{value:'ready',label:'Ready / reviewed'},
 {value:'issue',label:'Issue found'},{value:'not-required',label:'Not needed'}];
const stages:{value:FieldStage;label:string}[]=[
 {value:'preparation',label:'Pre-job'},{value:'on-site',label:'On site'},{value:'wrap-up',label:'Post-job review'}];
const amount=(text:string)=>text===''?null:Number(text);
const newId=()=>typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function'?crypto.randomUUID():'entry-'+Date.now()+'-'+Math.random().toString(36).slice(2);

export function ExteriorFieldCommand({data,org,readOnly,mode,base,now}:Props){
 const params=useSearchParams();
 const bid=params.get('booking')??'';
 const booking=useMemo(()=>data.bookings.find(b=>b.id===bid)??null,[data.bookings,bid]);
 const lead=useMemo(()=>data.leads.find(l=>l.id===booking?.lead_id)??null,[data.leads,booking?.lead_id]);
 const root=base+'/b/exterior';
 const readonly=readOnly||mode==='preview';
 const [log,setLog]=useState<ExteriorFieldLog|null>(null);
 const [loaded,setLoaded]=useState(false);
 const [storageError,setStorageError]=useState('');
 const [notice,setNotice]=useState('');
 const [query,setQuery]=useState('');
 const [issueText,setIssueText]=useState('');
 const [issueKind,setIssueKind]=useState<FieldIssue['category']>('equipment');
 const [issueSeverity,setIssueSeverity]=useState<FieldIssue['severity']>('attention');
 const upload=useRef<HTMLInputElement|null>(null);

 useEffect(()=>{
  setLog(null);setLoaded(false);setStorageError('');setNotice('');
  if(!booking||!lead){setLoaded(true);return;}
  if(readonly){setLog(newFieldLog(booking));setLoaded(true);return;}
  try{
   const raw=window.localStorage.getItem(key(org,booking.id));
   if(raw){
    const val:unknown=JSON.parse(raw);
    if(!isFieldLog(val,booking.id,lead.id))throw Error('invalid existing draft');
    const preserved=JSON.stringify(val);
    const checked=parseFieldPackage(serializeFieldPackage(org,val as ExteriorFieldLog),org,booking.id,lead.id);
    if(preserved.length>fieldLogMaxChars)throw Error('draft too long');
    setLog(checked);
   }else setLog(newFieldLog(booking));
  }catch{
   setStorageError('This browser has an unreadable or invalid earlier field draft. It has NOT been overwritten. Export or recover it before resetting.');
   setLog(newFieldLog(booking));
  }
  setLoaded(true);
 },[org,booking?.id,lead?.id,readonly]); // eslint-disable-line react-hooks/exhaustive-deps
 const reviewed=useMemo(()=>{
  if(!log)return null;
  try{return {ok:true as const,result:reviewFieldLog(log)};}
  catch(e){return {ok:false as const,message:e instanceof Error?e.message:'Review incomplete field entries.'};}
 },[log]);
 const drift=Boolean(log&&booking&&!fieldSourceMatches(log,booking));
 useEffect(()=>{
  if(!loaded||!log||readonly||storageError||!reviewed?.ok)return;
  const timeout=window.setTimeout(()=>{
   try{window.localStorage.setItem(key(org,log.bookingId),JSON.stringify(log));}
   catch{setStorageError('Autosave was blocked by browser storage. Copy/export your current field information before leaving.');}
  },500);
  return ()=>window.clearTimeout(timeout);
 },[log,loaded,readonly,storageError,org,reviewed]);
 const canEdit=Boolean(!readonly&&booking&&lead&&!storageError);
 const patch=(fn:(v:ExteriorFieldLog)=>ExteriorFieldLog)=>{
  if(!canEdit)return;
  setLog(old=>old?fn(old):old);setNotice('');
 };
 const modifyCrew=(id:string,part:Partial<FieldLabor>)=>patch(v=>({...v,labor:v.labor.map(r=>r.id===id?{...r,...part}:r),review:{...v.review,labor:false}}));
 const modifyMaterial=(id:string,part:Partial<FieldMaterial>)=>patch(v=>({...v,materials:v.materials.map(r=>r.id===id?{...r,...part}:r),review:{...v.review,materials:false}}));
 const addCrew=()=>patch(v=>v.labor.length>=20?v:{...v,labor:[...v.labor,{id:newId(),role:'Crew member',hours:null,hourlyCost:null,notes:''}],review:{...v.review,labor:false}});
 const addMaterial=()=>patch(v=>v.materials.length>=30?v:{...v,materials:[...v.materials,{id:newId(),name:'Material / consumable',quantity:null,unitCost:null,notes:''}],review:{...v.review,materials:false}});
 const addIssue=()=>{
  if(!issueText.trim()){setNotice('Describe the issue before adding it to this local field record.');return;}
  patch(v=>v.issues.length>=25?v:{...v,issues:[...v.issues,
   {id:newId(),category:issueKind,severity:issueSeverity,description:issueText.trim().slice(0,800),resolved:false}]});
  setIssueText('');
 };
 const reset=()=>{
  if(!booking||!lead||readonly)return;
  if(!window.confirm('Delete this local field draft and any entered crew/cost/safety notes on THIS browser? The original booking and customer will not change.'))return;
  try{
   window.localStorage.removeItem(key(org,booking.id));setStorageError('');
   setLog(newFieldLog(booking));setNotice('Local field draft reset; the shared booking was unchanged.');
  }catch{setNotice('Browser did not allow reset; original local draft remains untouched.');}
 };
 const exportField=()=>{
  if(!log||!reviewed?.ok)return;
  try{
   const json=serializeFieldPackage(org,log);
   const objUrl=URL.createObjectURL(new Blob([json],{type:'application/json'}));
   const a=document.createElement('a');a.href=objUrl;a.download='oj-field-internal-'+log.bookingId.slice(0,8)+'.json';a.click();
   window.setTimeout(()=>URL.revokeObjectURL(objUrl),1000);
   setNotice('Private internal field package exported. It contains work details; do not send it to customers as a final report.');
  }catch(e){setNotice(e instanceof Error?e.message:'Could not export field data.');}
 };
 const importField=async(file?:File)=>{
  if(!file||!booking||!lead||readonly||storageError)return;
  if(file.size>fieldLogMaxChars*4){setNotice('File exceeds the supported internal record limit.');return;}
  try{
   const restored=parseFieldPackage(await file.text(),org,booking.id,lead.id);
   const changed=!fieldSourceMatches(restored,booking);
   if(!window.confirm(
    'Replace all your current local field information for this exact job with the imported package? '+
    'The existing local draft will be lost, but the shared booking and customer will NOT change. '+
    (changed?'WARNING: the imported original booking date/status no longer match the source.':'Original booking source matches.') ))return;
   try{window.localStorage.setItem(key(org,booking.id),JSON.stringify(restored));}
   catch{setNotice('Browser could not store the imported field record; your original local draft is intact.');return;}
   setLog(restored);setNotice('Private draft imported for the matching job. '+(changed?'Re-check the changed booking before relying on its dates.':'Source identity verified.')+' No job was completed or invoiced.');
  }catch(e){setNotice(e instanceof Error?e.message:'Import rejected; current field draft unchanged.');}
 };
 const bookings=data.bookings.filter(b=>b.lead_id&&data.leads.some(l=>l.id===b.lead_id))
  .filter(b=>{
   if(!query)return true;const l=data.leads.find(x=>x.id===b.lead_id);
   return [l?.name,l?.address,l?.service_requested,b.date].some(s=>(s??'').toLowerCase().includes(query.toLowerCase()));
  })
  .sort((a,b)=>b.date.localeCompare(a.date)||a.id.localeCompare(b.id));
 if(!booking||!lead)return <main className="ecfield">
  <section className="ecfield-hero"><span className="ecfield-overline">ATLAS / EXTERIOR CARE / FIELD COMMAND</span>
   <h1>{bid?'Exact booked job unavailable':'Run the job. Capture the truth.'}</h1>
   <p>{bid?'That exact booking or linked customer was not available from the authorized source. No other record was substituted.':'Pick a booked job to prepare the site, log crew time and expenses, record faults and build a portable internal closeout draft.'}</p>
   <Link href={root+'/bookings'}><CalendarDays size={16}/> Open full dispatch</Link>
  </section>
  <section className="ecfield-panel ecfield-selector">
   <h2>Choose the exact booked job</h2><input type="search" aria-label="Search booked field jobs" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Customer, service, address or job date"/>
   <div>{bookings.slice(0,80).map(b=>{
    const l=data.leads.find(x=>x.id===b.lead_id);
    return <Link key={b.id} href={root+'/field?booking='+encodeURIComponent(b.id)}>
     <span><strong>{l?.name??'Customer unavailable'}</strong><small>{day(b.date)} · {l?.service_requested??'Service not entered'} · {statusLabel(b.status)}</small></span>
     <ArrowRight size={16}/>
    </Link>;
   })}</div><small>Current selection includes up to 80 records in the loaded source window; use dispatch to find other jobs.</small>
  </section>
 </main>;
 if(!loaded||!log)return <div className="ecfield" aria-busy="true">Loading booking-bound local field data…</div>;
 const result=reviewed?.ok?reviewed.result:null;
 const fullIssues=result?.issuesOpen??0;
 return <main className="ecfield">
  <nav className="ecfield-breadcrumb"><Link href={root+'/bookings'}><ArrowLeft size={15}/> Field Operations</Link><span>/</span><strong>Booking work sheet</strong></nav>
  <header className="ecfield-hero ecfield-hero-split">
   <div><span className="ecfield-overline"><span className="ecfield-pulse"/> FIELD COMMAND / LOCAL WORK SHEET</span>
    <h1>Own the work.<br/><em>Record the evidence.</em></h1>
    <p><strong>{lead.name??'Unnamed customer'}</strong> · {lead.service_requested??'Service not entered'}</p>
    <p><MapPin size={13}/>{lead.address??'Service address unavailable'} · {day(booking.date)} · {statusLabel(booking.status)}</p>
    <div className="ecfield-hero-actions">
     <button type="button" disabled={!reviewed?.ok} onClick={exportField}><Download size={15}/> Export private field report</button>
     {!readonly&&<button type="button" disabled={!!storageError} onClick={()=>upload.current?.click()}><FileUp size={15}/> Import from crew</button>}
     <input hidden ref={upload} type="file" accept=".json,application/json" aria-label="Import internal field package" onChange={e=>{const f=e.currentTarget.files?.[0];e.currentTarget.value='';void importField(f);}}/>
     {!readonly&&<button type="button" onClick={reset}><Trash2 size={15}/> Reset local</button>}
    </div>
   </div>
   <div className="ecfield-source">
    <ShieldCheck size={22}/><strong>BOOKING-BOUND / NOT FINALIZED</strong>
    <code>{booking.id}</code>
    <small>Customer source {lead.id}</small>
    <p>Saved only in this browser. Not synced to corporate records, crew payroll, job status, invoices or a bank.</p>
   </div>
  </header>
  {mode==='preview'&&<p className="ecfield-notice">Preview uses fictional data and allows no persistent edits.</p>}
  {drift&&<p className="ecfield-warning" role="alert"><AlertTriangle size={16}/> Original booking date or status changed after this draft was created. Revalidate the local work sheet against dispatch before using it.</p>}
  {storageError&&<p className="ecfield-warning" role="alert"><ShieldAlert size={16}/>{storageError}</p>}
  {!reviewed?.ok&&<p className="ecfield-warning" role="alert">{reviewed?.message??'Some field values are invalid.'} Valid edits must be completed before autosave/export.</p>}
  <section className="ecfield-metrics" aria-label="Logged field work and cost evidence">
   {[{title:'Crew hours entered',value:result?result.hours+' h':'Unknown',note:'Operator-entered, not verified payroll',icon:Timer},
     {title:'Known cost components',value:result?usd(result.recordedSubset):'Unknown',note:'Recorded subset; not necessarily all costs',icon:HardHat},
     {title:'Full estimated direct cost',value:result?usd(result.totalDirectCost):'Unknown',note:result?.complete?'Four categories reviewed':'Incomplete until every cost category is reviewed',icon:Truck},
     {title:'Open operational issues',value:result?String(fullIssues):'Unknown',note:result?.criticalIssues?'Stop-work observation needs review':'Does not certify site readiness',icon:ShieldAlert}
   ].map((item,i)=><article className="ecfield-metric" key={item.title} style={{animationDelay:(i*55)+'ms'}}>
    <div><span>{item.title}</span><item.icon size={18}/></div><strong>{item.value}</strong><small>{item.note}</small>
   </article>)}
  </section>
  <div className="ecfield-columns">
   <div className="ecfield-maincol">
    <section className="ecfield-panel">
     <header className="ecfield-heading"><div><span className="ecfield-overline">01 / FIELD STATUS</span><h2>Job progression</h2>
      <p>This is a local operator note, not a change to the booking's confirmed/completed state.</p></div><Clock3 size={20}/></header>
     <div className="ecfield-stage" role="group" aria-label="Local field stage">
      {stages.map(x=><button type="button" key={x.value} disabled={!canEdit} aria-pressed={log.stage===x.value}
        onClick={()=>patch(v=>({...v,stage:x.value}))}>{x.label}</button>)}
     </div>
     <div className="ecfield-stamps">
      <div><span>Arrival entered</span><strong>{stamp(log.arrivalAt)}</strong>
       {canEdit&&<button type="button" onClick={()=>patch(v=>({...v,arrivalAt:new Date().toISOString()}))}>Record arrival now</button>}
      </div>
      <div><span>Departure entered</span><strong>{stamp(log.departureAt)}</strong>
       {canEdit&&<button type="button" onClick={()=>patch(v=>({...v,departureAt:new Date().toISOString()}))}>Record departure now</button>}
      </div>
     </div>
     <p className="ecfield-disclaimer">Timestamps are entered from this device when the button is tapped—not independently verified arrival, GPS location, or customer signoff.</p>
    </section>
    <section className="ecfield-panel">
     <header className="ecfield-heading"><div><span className="ecfield-overline">02 / RESOURCE ACCOUNTING</span><h2>Crew labor</h2>
      <p>Enter actual time worked and your estimated loaded labor rate; no payroll is posted.</p></div>
      {canEdit&&<button className="ecfield-add" type="button" onClick={addCrew} disabled={log.labor.length>=20}><Plus size={14}/> Add crew time</button>}</header>
     <div className="ecfield-entries">{log.labor.map(row=><div className="ecfield-entry" key={row.id}>
      <div className="ecfield-entry-grid">
       <label>Role / crew member<input maxLength={90} value={row.role} disabled={!canEdit} onChange={e=>modifyCrew(row.id,{role:e.target.value})}/></label>
       <label>Hours<input type="number" min="0" max="200" step=".25" inputMode="decimal" value={row.hours??''} disabled={!canEdit} placeholder="Unknown" onChange={e=>modifyCrew(row.id,{hours:amount(e.target.value)})}/></label>
       <label>Estimated cost / hour<input type="number" min="0" max="10000" step=".01" inputMode="decimal" value={row.hourlyCost??''} disabled={!canEdit} placeholder="Unknown" onChange={e=>modifyCrew(row.id,{hourlyCost:amount(e.target.value)})}/></label>
       <label className="ecfield-wide">Tasks / role notes<input maxLength={500} value={row.notes} disabled={!canEdit} onChange={e=>modifyCrew(row.id,{notes:e.target.value})}/></label>
      </div>
      {canEdit&&<button type="button" className="ecfield-remove" onClick={()=>patch(v=>({...v,labor:v.labor.filter(l=>l.id!==row.id),review:{...v.review,labor:false}}))}>Remove row <Trash2 size={13}/></button>}
     </div>)}
     {!log.labor.length&&<p className="ecfield-empty">No crew hours entered. This does not mean zero labor.</p>}</div>
     <label className="ecfield-reviewed"><input type="checkbox" checked={log.review.labor} disabled={!canEdit} onChange={e=>patch(v=>({...v,review:{...v.review,labor:e.target.checked}}))}/> Labor entries reviewed, including any genuine zero activity</label>
    </section>
    <section className="ecfield-panel">
     <header className="ecfield-heading"><div><span className="ecfield-overline">03 / CONSUMABLES</span><h2>Materials used</h2><p>Capture real quantities and estimated actual costs—not the quote's planned amounts.</p></div>
      {canEdit&&<button className="ecfield-add" type="button" onClick={addMaterial} disabled={log.materials.length>=30}><Plus size={14}/> Add material</button>}</header>
     <div className="ecfield-entries">{log.materials.map(row=><div className="ecfield-entry" key={row.id}>
      <div className="ecfield-entry-grid">
       <label>Material / consumable<input maxLength={100} value={row.name} disabled={!canEdit} onChange={e=>modifyMaterial(row.id,{name:e.target.value})}/></label>
       <label>Quantity used<input type="number" min="0" max="100000" step=".01" inputMode="decimal" value={row.quantity??''} disabled={!canEdit} placeholder="Unknown" onChange={e=>modifyMaterial(row.id,{quantity:amount(e.target.value)})}/></label>
       <label>Cost / unit<input type="number" min="0" max="1000000" step=".01" inputMode="decimal" value={row.unitCost??''} disabled={!canEdit} placeholder="Unknown" onChange={e=>modifyMaterial(row.id,{unitCost:amount(e.target.value)})}/></label>
       <label className="ecfield-wide">Source / usage notes<input maxLength={500} value={row.notes} disabled={!canEdit} onChange={e=>modifyMaterial(row.id,{notes:e.target.value})}/></label>
      </div>
      {canEdit&&<button type="button" className="ecfield-remove" onClick={()=>patch(v=>({...v,materials:v.materials.filter(m=>m.id!==row.id),review:{...v.review,materials:false}}))}>Remove row <Trash2 size={13}/></button>}
     </div>)}
     {!log.materials.length&&<p className="ecfield-empty">No materials entered; empty does not prove none were consumed.</p>}</div>
     <label className="ecfield-reviewed"><input type="checkbox" checked={log.review.materials} disabled={!canEdit} onChange={e=>patch(v=>({...v,review:{...v.review,materials:e.target.checked}}))}/> Materials reviewed (zero only when genuinely none)</label>
    </section>
    <section className="ecfield-panel">
     <header className="ecfield-heading"><div><span className="ecfield-overline">04 / MOBILIZATION</span><h2>Mileage & other costs</h2></div><Truck size={20}/></header>
     <div className="ecfield-trip">
      <label>Vehicle miles<input type="number" min="0" max="10000" step=".1" value={log.travelMiles??''} disabled={!canEdit} placeholder="Unknown" onChange={e=>patch(v=>({...v,travelMiles:amount(e.target.value),review:{...v.review,travel:false}}))}/></label>
      <label>Actual estimated cost/mile<input type="number" min="0" max="100" step=".01" value={log.vehicleCostPerMile??''} disabled={!canEdit} placeholder="Unknown" onChange={e=>patch(v=>({...v,vehicleCostPerMile:amount(e.target.value),review:{...v.review,travel:false}}))}/></label>
      <label>Other direct costs<input type="number" min="0" max="10000000" step=".01" value={log.otherDirectCost??''} disabled={!canEdit} placeholder="Unknown" onChange={e=>patch(v=>({...v,otherDirectCost:amount(e.target.value),review:{...v.review,other:false}}))}/></label>
     </div>
     <label className="ecfield-reviewed"><input type="checkbox" checked={log.review.travel} disabled={!canEdit} onChange={e=>patch(v=>({...v,review:{...v.review,travel:e.target.checked}}))}/> Travel mileage and per-mile cost reviewed</label>
     <label className="ecfield-reviewed"><input type="checkbox" checked={log.review.other} disabled={!canEdit} onChange={e=>patch(v=>({...v,review:{...v.review,other:e.target.checked}}))}/> Additional direct costs reviewed (enter 0 if genuinely none)</label>
    </section>
   </div>
   <aside className="ecfield-sidecol">
    <section className="ecfield-panel">
     <header className="ecfield-heading"><div><span className="ecfield-overline">05 / SITE SAFETY</span><h2>Conditions & equipment</h2><p>Manual checklist only. Never a substitute for site inspection, SDS/PPE, equipment instructions or runoff rules.</p></div><ShieldCheck size={20}/></header>
     <div className="ecfield-checklist">{(Object.keys(fieldCheckLabels) as (keyof FieldChecklist)[]).map(k=><label key={k}>
      <span>{fieldCheckLabels[k]}</span>
      <select aria-label={fieldCheckLabels[k]} value={log.checks[k]} disabled={!canEdit}
       onChange={e=>patch(v=>({...v,checks:{...v.checks,[k]:e.target.value as CheckState}}))}>
       {statuses.map(v=><option key={v.value} value={v.value}>{v.label}</option>)}</select>
     </label>)}</div>
     {result?.criticalIssues? <p className="ecfield-stop"><AlertTriangle size={17}/> An unresolved stop-work issue is recorded. Investigate and resolve before proceeding.</p>:null}
    </section>
    <section className="ecfield-panel">
     <header className="ecfield-heading"><div><span className="ecfield-overline">06 / EXCEPTIONS</span><h2>Issues & disruptions</h2></div><Wrench size={20}/></header>
     <div className="ecfield-issues">{log.issues.map(issue=><article key={issue.id} className={issue.severity==='stop-work'&&!issue.resolved?'ecfield-issue critical':'ecfield-issue'}>
      <div><strong>{issue.severity.replace('-',' ')} · {issue.category}</strong><small>{issue.resolved?'Marked resolved locally':'Needs review'}</small></div>
      <p>{issue.description}</p>
      {canEdit&&<div><button type="button" onClick={()=>patch(v=>({...v,issues:v.issues.map(i=>i.id===issue.id?{...i,resolved:!i.resolved}:i)}))}>{issue.resolved?'Reopen':'Mark resolved locally'}</button>
       <button type="button" onClick={()=>patch(v=>({...v,issues:v.issues.filter(i=>i.id!==issue.id)}))}>Remove</button></div>}
     </article>)}
      {!log.issues.length&&<p className="ecfield-empty">No issues entered. This is not a verified all-clear.</p>}
     </div>
     {canEdit&&<div className="ecfield-issue-add">
       <div><select aria-label="Issue category" value={issueKind} onChange={e=>setIssueKind(e.target.value as FieldIssue['category'])}>
        {['equipment','site','weather','customer','other'].map(x=><option key={x}>{x}</option>)}</select>
        <select aria-label="Issue severity" value={issueSeverity} onChange={e=>setIssueSeverity(e.target.value as FieldIssue['severity'])}>
         <option value="note">Note</option><option value="attention">Attention</option><option value="stop-work">Stop-work condition</option></select></div>
       <textarea rows={3} maxLength={800} value={issueText} onChange={e=>setIssueText(e.target.value)} placeholder="Record a factual issue or observed fault…"/>
       <button type="button" disabled={log.issues.length>=25} onClick={addIssue}><Plus size={15}/> Add observation</button>
      </div>}
    </section>
    <section className="ecfield-panel">
     <header className="ecfield-heading"><div><span className="ecfield-overline">07 / SITE EVIDENCE</span><h2>Closeout notes</h2></div><ClipboardList size={20}/></header>
     <textarea className="ecfield-notes" rows={5} value={log.siteNotes} disabled={!canEdit}
      onChange={e=>patch(v=>({...v,siteNotes:e.target.value}))} maxLength={4000}
      placeholder="Site access, observed work, limitations, customer conversations, photos to upload later…"/>
     <p className="ecfield-disclaimer">No photographs or signatures are uploaded in this release. Sensitive customer content stays on this device and in explicitly exported private files only.</p>
    </section>
    <ExteriorJobEquipment org={org} booking={booking} data={data} readOnly={readOnly} mode={mode} base={base}/>
        <section className="ecfield-panel ecfield-closeout">
     <span className="ecfield-overline">08 / COMPLETENESS REVIEW</span><h2>What's still unknown?</h2>
     {result?<ul>{result.flags.map(f=><li key={f}>{f}</li>)}</ul>:<p>The local entries need correction before any calculated review is displayed.</p>}
     <div className="ecfield-costs"><span>Labor estimate</span><strong>{usd(result?.knownLaborCost??null)}</strong>
      <span>Materials estimate</span><strong>{usd(result?.knownMaterialsCost??null)}</strong>
      <span>Mileage estimate</span><strong>{usd(result?.knownTravelCost??null)}</strong>
      <span>Other direct cost</span><strong>{usd(result?.knownOtherCost??null)}</strong>
      <span>Total estimated direct cost</span><strong>{usd(result?.totalDirectCost??null)}</strong>
     </div>
     <Link href={root+'/customer?lead='+encodeURIComponent(lead.id)}>Customer 360 <ArrowUpRight size={14}/></Link>
     <Link href={root+'/bookings'}>Source booking workbench <ArrowUpRight size={14}/></Link>
     <p>No “Complete job,” “Submit invoice,” “Mark paid” or corporate profitability update occurs from this local draft.</p>
    </section>
   </aside>
  </div>
  {notice&&<p className="ecfield-toast" role="status">{notice}</p>}
 </main>;
}
