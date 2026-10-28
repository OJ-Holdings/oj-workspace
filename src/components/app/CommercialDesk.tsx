'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertTriangle, ArrowRight, ArrowUpRight, BarChart3, Building2, Check, ChevronRight, ClipboardCheck, ClipboardCopy, Download, FileInput, HardHat, Network, Plus, RotateCcw, Save, ShieldAlert, Trash2 } from 'lucide-react';
import type { ExteriorData } from '@/lib/exterior';
import { brief, calculateEstimate, newEstimate, newSite, type EstimateInput, type Site } from '@/lib/commercial-estimate';
import { commercialTransferMaxChars, exportCommercialEstimate, importCommercialEstimate } from '@/lib/commercial-transfer';
import { buildBidWarRoom, warRoomBrief } from '@/lib/commercial-war-room';
import { parseLocalCommercialDraft } from '@/lib/atlas-field-bridge';
import { AtlasFieldBridge } from './AtlasFieldBridge';
import { AtlasCommercialPortfolio, type CommercialSaveHandle } from './AtlasCommercialPortfolio';
import { CommercialAccounts } from './CommercialAccounts';
import { exportLocalBusinessArchive, localBusinessArchiveMaxBytes, restoreMissingLocalBusinessArchive, validateLocalBusinessArchive } from '@/lib/local-business-archive';

const dollars=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
const checklist=[
  'Scope, pane counts and conditions verified at every building',
  'Access strategy assessed by qualified personnel',
  'Operator training, rental, permits and insurance confirmed',
  'Crew-hours and all direct costs reviewed',
  'Exclusions, schedule, site permission and client terms documented',
];
type Tab = 'accounts'|'scope'|'costs'|'warroom'|'records';
type PropertyEstimateSuggestion={accountId:string;propertyId:string;accountName:string;propertyName:string};
const field=(label:string,value:number,onChange:(n:number)=>void,max=1000000,step=1)=>
  <label className="com-field"><span>{label}</span><input type="number" inputMode="decimal" min={0} max={max} step={step}
    value={Number.isFinite(value)?value:0} onChange={e=>onChange(e.target.value===''?0:Number(e.target.value))}/></label>;

export function CommercialDesk({data,org,mode,readOnly,cards,act,busy,today}:{data:ExteriorData;org:string;mode:'live'|'preview';readOnly:boolean;cards:import('@/lib/board').Card[];act?:import('./ExteriorManage').Act;busy?:boolean;today?:string}) {
  const router=useRouter();
  const preview=mode==='preview';
  const [tab,setTab]=useState<Tab>('accounts');
  const [name,setName]=useState('New commercial opportunity');
  const [input,setInput]=useState<EstimateInput>(newEstimate);
  const [review,setReview]=useState<boolean[]>(checklist.map(()=>false));
  const [notice,setNotice]=useState('');
  const [propertySuggestion,setPropertySuggestion]=useState<PropertyEstimateSuggestion|null>(null);
  const transferInput=useRef<HTMLInputElement>(null);
  const archiveInput=useRef<HTMLInputElement>(null);
  const sharedSaveHandle=useRef<CommercialSaveHandle>(null);
  const [ready,setReady]=useState(false);
  const estimate=useMemo(()=>calculateEstimate(input),[input]);
  const text=useMemo(()=>brief(name,input),[name,input]);
  const warRoom=useMemo(()=>buildBidWarRoom(name,input,review),[name,input,review]);
  const warRoomText=useMemo(()=>warRoomBrief(name,input,review),[name,input,review]);
  const key='oj-commercial-estimate-v2:'+org;

  useEffect(()=>{
    // Reset whenever the organization or preview context changes. Never
    // carry a previous company's private local draft into another workspace.
    setReady(false);
    setName('New commercial opportunity');
    setInput(newEstimate());
    setReview(checklist.map(()=>false));
    setNotice('');
    setPropertySuggestion(null);
    if(preview||readOnly){setReady(true);return;}
    try {
      const stored=window.localStorage.getItem(key);
      if(stored){
        const validated=parseLocalCommercialDraft(stored,org);
        setName(validated.name);
        setInput(validated.input);
        setReview(validated.review);
      }
    } catch {
      setNotice('Saved commercial draft could not be validated. Its original browser record was not overwritten. Export or recover the old draft before saving a replacement.');
    }
    setReady(true);
  },[key,org,preview,readOnly]);

  function beginSavedPropertyEstimate(accountId:string,accountName:string,propertyId:string,propertyName:string){
    if(preview||readOnly||!ready)return;
    // The founder explicitly chose this saved account/property. This changes
    // only the local, unsaved estimate; it never creates a contract or link.
    setPropertySuggestion({accountId,propertyId,accountName,propertyName});
    setName((accountName+' · '+propertyName).slice(0,160));
    setInput(newEstimate());
    setReview(checklist.map(()=>false));
    setNotice('New internal estimate for '+propertyName+'. Save the shared project first, then separately confirm its exact company/property link.');
    // Prevent stale ?project= deep links from reopening an unrelated estimate
    // when the portfolio mounts on the newly selected operator view.
    const url=new URL(window.location.href);
    if(url.searchParams.has('project')){
      url.searchParams.delete('project');
      router.replace(url.pathname+url.search+url.hash,{scroll:false});
    }
    setTab('scope');
  }
  const patch=(changes:Partial<EstimateInput>)=>setInput(v=>({...v,...changes}));
  const patchSite=(id:string,changes:Partial<Site>)=>setInput(v=>({...v,sites:v.sites.map(s=>s.id===id?{...s,...changes}:s)}));
  const add=()=>setInput(v=>v.sites.length>=12?v:{...v,sites:[...v.sites,{...newSite('site-'+String(Date.now())),name:'Building '+String(v.sites.length+1)}]});
  const remove=(id:string)=>setInput(v=>v.sites.length===1?v:{...v,sites:v.sites.filter(s=>s.id!==id)});
  const save=()=>{
    if(preview||readOnly){setNotice('This mode cannot save a private draft.');return;}
    try{exportCommercialEstimate(org,name,input,review);window.localStorage.setItem(key,JSON.stringify({name,input,review}));setNotice('Browser recovery copy saved on this device. Use the shared project register below for cross-device records.');}
    catch{setNotice('Browser storage is unavailable; download your draft instead.');}
  };
  const prepareSharedTask=()=>{
    if(preview||readOnly)return;
    try{
      // Explicit Save + Prepare action. The shared task is not created until
      // the founder reviews and saves the normal task editor.
      exportCommercialEstimate(org,name,input,review);
      window.localStorage.setItem(key,JSON.stringify({name,input,review}));
      router.push('/workspace/tasks?sourceCommercial=1');
    }catch(error){
      setNotice(error instanceof Error?error.message:'Could not validate the local estimate for task preparation.');
    }
  };
  const exportLocalBusinessData=async()=>{
    if(preview||readOnly)return;
    if(!window.confirm('Export organization-scoped business data stored by this OJ origin? The unencrypted JSON may contain private estimates, property details, field notes and internal costs. It will leave the browser as a downloaded file. Existing records will not be changed.'))return;
    try{
      const archive=await exportLocalBusinessArchive(window.localStorage,org,window.location.origin);
      const url=URL.createObjectURL(new Blob([JSON.stringify(archive,null,2)],{type:'application/json;charset=utf-8'}));
      const link=document.createElement('a');link.href=url;link.download='oj-local-business-data-'+new Date().toISOString().slice(0,10)+'.json';link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice(`Exported ${archive.records.length} organization-scoped local record(s); SHA-256 ${archive.archiveSha256}. Originals were left unchanged. Repeat from each authorized origin, browser profile and founder device.`);
    }catch(error){setNotice(error instanceof Error?error.message:'Local business data export failed; originals were left unchanged.');}
  };
  const restoreLocalBusinessData=async(file:File|undefined)=>{
    if(!file)return;
    if(preview||readOnly){setNotice('This mode cannot restore private company data.');return;}
    try{
      if(file.size>localBusinessArchiveMaxBytes){setNotice('Recovery archive exceeds the 20 MiB limit. The selected file and browser data were not changed.');return;}
      const archive=await validateLocalBusinessArchive(await file.text(),org);
      const missing=archive.records.filter(record=>window.localStorage.getItem(record.key)===null).length;
      const existing=archive.records.length-missing;
      const sourceDate=new Date(archive.exportedAt).toLocaleString();
      if(!window.confirm(`Restore ${missing} missing local record(s) from ${archive.sourceOrigin}, exported ${sourceDate}? ${existing} key(s) already exist and will be kept exactly as they are. This only restores this organization’s browser-local data; it does not write shared records. The archive is unencrypted and may contain private property details and costs.`)){
        setNotice('Restore cancelled; the archive and browser data are unchanged.');return;
      }
      const result=await restoreMissingLocalBusinessArchive(window.localStorage,archive,org);
      setNotice(`Restored ${result.restoredKeys.length} missing local record(s); kept ${result.skippedExistingKeys.length} existing record(s) unchanged. Reloading this workspace…`);
      if(result.restoredKeys.length>0)window.setTimeout(()=>window.location.reload(),500);
    }catch(error){setNotice(error instanceof Error?error.message:'Local business recovery failed; existing browser records were preserved.');}
  };
  const reset=()=>{
    if(readOnly||preview)return;
    if(!window.confirm('Reset this local draft? No customer or financial records will change.'))return;
    setInput(newEstimate());setName('New commercial opportunity');setReview(checklist.map(()=>false));
    try{window.localStorage.removeItem(key);}catch{}
    setNotice('Draft reset. No workspace records were affected.');
  };
  const copy=async()=>{
    try{await navigator.clipboard.writeText(text);setNotice('Internal scoping brief copied. No customer was contacted.');}
    catch{setNotice('Clipboard blocked. Download the internal brief instead.');}
  };
  const download=()=>{
    const u=URL.createObjectURL(new Blob([text],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=u;a.download='oj-commercial-internal-estimate.txt';a.click();
    setTimeout(()=>URL.revokeObjectURL(u),1000);
    setNotice('Internal scoping document exported. Not an invoice or quote.');
  };
  const downloadWarRoom=()=>{
    const url=URL.createObjectURL(new Blob([warRoomText],{type:'text/plain;charset=utf-8'}));
    const a=document.createElement('a');a.href=url;a.download='oj-internal-commercial-bid-review.txt';a.click();
    window.setTimeout(()=>URL.revokeObjectURL(url),1000);
    setNotice('Internal bid review exported. It is NOT a client proposal, bid approval or invoice.');
  };
  const copyWarRoom=async()=>{
    try{await navigator.clipboard.writeText(warRoomText);setNotice('Internal review pack copied. No client was contacted or contract approved.');}
    catch{setNotice('Clipboard access unavailable. Use Download review pack instead.');}
  };
  const exportEditable=()=>{
    try {
      const file=exportCommercialEstimate(org,name,input,review);
      const url=URL.createObjectURL(new Blob([file],{type:'application/json;charset=utf-8'}));
      const link=document.createElement('a');
      const project=(name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,48)||'commercial-estimate');
      link.href=url;
      link.download='oj-internal-'+project+'.json';
      link.click();
      window.setTimeout(()=>URL.revokeObjectURL(url),1000);
      setNotice('Editable estimate exported. The JSON can include private property details and costs; share it only through a secure channel. No quote was sent.');
    } catch(error) {
      setNotice(error instanceof Error?error.message:'Could not export the estimate.');
    }
  };
  const importEditable=async(file:File|undefined)=>{
    if(!file)return;
    if(preview||readOnly){setNotice('This mode cannot import a private company estimate.');return;}
    if(file.size>commercialTransferMaxChars){setNotice('Estimate file exceeds the 256 KB import limit.');return;}
    try {
      const imported=importCommercialEstimate(await file.text(),org);
      if(!window.confirm('Replace the current draft with "'+imported.name+'"? Unsaved changes in this browser will be lost. No shared company records will change.')) {
        setNotice('Import cancelled; your previous draft is unchanged.');return;
      }
      setName(imported.name);setInput(imported.input);setReview(imported.review);setTab('scope');
      try {
        window.localStorage.setItem(key,JSON.stringify({name:imported.name,input:imported.input,review:imported.review}));
        setNotice('Editable estimate imported and saved in this browser. It is not automatically synchronized with Jacob or the shared database.');
      } catch {
        setNotice('Editable estimate imported into this page, but browser storage is unavailable. Export a copy before leaving.');
      }
    } catch(error) {
      setNotice(error instanceof Error?error.message:'The selected file could not be imported.');
    }
  };
  const maybeCommercial=useMemo(()=>data.leads.filter(lead=>
    /commercial|office|property|retail|apartment|building|storefront|condo|multi.unit|warehouse|campus/i.test(lead.service_requested||'')
  ).slice(0,12),[data.leads]);
  const base=preview?'/preview':'/workspace';
  const reviewed=review.filter(Boolean).length;
  return <section className="com" aria-label="OJ Exterior Care commercial operations">
    <header className="com-hero">
      <div>
        <p className="exec-kicker"><Building2 size={16}/> OJ EXTERIOR CARE / COMMERCIAL OPERATIONS</p>
        <h2>Commercial clients.<br/><em>Every property.</em></h2>
        <p>{tab==='accounts'?'Pick a company, then book a visit.':'Manage buildings, estimate labor and access costs, and save projects for the whole team.'}</p>
        {tab!=='accounts'&&<div className="com-actions" role="group" aria-label="Commercial project actions">
          <button className="primary" disabled={preview||readOnly||!ready} onClick={()=>void sharedSaveHandle.current?.save()}><Save size={16}/> Save estimate</button>
          <button className="secondary" type="button" onClick={()=>setTab('accounts')}><Building2 size={16}/> Companies &amp; properties</button>
          <button className="secondary" type="button" onClick={()=>setTab('costs')}><BarChart3 size={16}/> Estimate</button>
          <Link className="secondary" href={base+'/b/exterior/bookings'}><HardHat size={16}/> Jobs</Link>
        </div>}
        {tab!=='accounts'&&<details className="com-recovery">
          <summary>Files, recovery &amp; team handoff</summary>
          <div className="com-actions" role="group" aria-label="Optional local file and recovery tools">
            <button className="secondary" disabled={preview||readOnly||!ready} onClick={save}><Save size={16}/> Save this browser copy</button>
            <button className="secondary" type="button" disabled={preview||readOnly||!ready} onClick={()=>void exportLocalBusinessData()}><Download size={16}/> Back up local business data</button>
            <button className="secondary" type="button" disabled={preview||readOnly} onClick={()=>archiveInput.current?.click()}><FileInput size={16}/> Recover missing local files</button>
            <input ref={archiveInput} type="file" accept=".json,application/json" hidden aria-label="Restore missing OJ local business data from an archive" onChange={e=>{
              const file=e.currentTarget.files?.[0];e.currentTarget.value='';void restoreLocalBusinessData(file);
            }}/>
            <button className="secondary" onClick={()=>void copy()}><ClipboardCopy size={16}/> Copy brief</button>
            <button className="secondary" onClick={download}><Download size={16}/> Download brief</button>
            <button className="secondary" type="button" disabled={preview||readOnly} onClick={prepareSharedTask}><ClipboardCheck size={16}/> Prepare task from local draft</button>
            <button className="secondary" onClick={exportEditable}><Download size={16}/> Download editable draft</button>
            <button className="secondary" disabled={preview||readOnly} onClick={()=>transferInput.current?.click()}><FileInput size={16}/> Import editable draft</button>
            <input ref={transferInput} type="file" accept=".json,application/json" hidden aria-label="Import editable commercial estimate file" onChange={e=>{
              const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importEditable(file);
            }}/>
          </div>
          <p>Local backups stay on this device. Imports do not sync automatically; use Save to company after reviewing them.</p>
        </details>}
      </div>
      <div className="com-seal" aria-hidden="true"><strong>OJ</strong><span>FIELD / OPERATIONS</span></div>
    </header>
    <nav className="com-workflow-nav" aria-label="Commercial main views">
      <button type="button" aria-pressed={tab==='accounts'} onClick={()=>setTab('accounts')}>Companies &amp; properties</button>
      <button type="button" aria-pressed={tab!=='accounts'} onClick={()=>setTab('scope')}>Estimates &amp; project work</button>
    </nav>
    {tab==='accounts'&&<CommercialAccounts org={org} base={base} mode={mode} readOnly={readOnly} booking={act&&today&&!preview&&!readOnly?{act,busy:!!busy,bookings:data.bookings,today}:undefined}
      onStartEstimate={beginSavedPropertyEstimate}/>}
    {tab!=='accounts'&&<>
    <div className="com-warning" role="note"><ShieldAlert size={18}/><p>{preview?'Fictional preview · no company changes.':'Saved company projects sync to authorized members. Local recovery copies do not.'} Estimates are internal until separately reviewed and approved; saving does not send a proposal or book a job.</p></div>
    {ready && <div className="atlas-nexus-editor-entry"><Link href={base+'/b/exterior/projects'}><Network size={16}/> Open NEXUS · Project 360 <ArrowUpRight size={14}/></Link></div>}
    {ready && <AtlasCommercialPortfolio org={org} base={base} mode={mode} readOnly={readOnly} saveHandle={sharedSaveHandle}
      name={name} input={input} review={review} bookings={data.bookings} cards={cards}
      propertySuggestion={propertySuggestion}
      onLoad={project=>{setPropertySuggestion(null);setName(project.name);setInput(project.input);setReview(project.review);setTab('scope');}} />}
    <div className="com-snapshot">
      <div><span>BUILDINGS</span><strong>{estimate.sites}</strong><small>{estimate.floors} floors · {estimate.panes} panes (estimated)</small></div>
      <div><span>CREW-HOURS</span><strong>{estimate.crewHours}</strong><small>Total paid crew-hours, not elapsed hours</small></div>
      <div><span>EQUIPMENT DAYS</span><strong>{estimate.liftDays}</strong><small>Summed rental days across buildings</small></div>
      <div className="com-feature"><span>SCENARIO PRICE</span><strong>{dollars(estimate.suggestedPrice)}</strong><small>Internal calculation, not a client quote</small></div>
    </div>
    <section className="atlas-commercial-command" aria-label="Commercial bid command shortcuts">
      <div><p>ATLAS / BID OPERATIONS</p><h3>Estimate → Review → Controlled handoff</h3><span>Scenario math is not an approved price. Founder review and verified site access are required before a customer-facing proposal.</span></div>
      <div className="atlas-commercial-command-actions">
        <button type="button" onClick={()=>setTab('scope')} aria-pressed={tab==='scope'}><Building2 size={15}/> Survey scope</button>
        <button type="button" onClick={()=>setTab('costs')} aria-pressed={tab==='costs'}><BarChart3 size={15}/> Cost model</button>
        <button type="button" onClick={()=>setTab('warroom')} aria-pressed={tab==='warroom'}><ClipboardCheck size={15}/> Bid review <b>{reviewed}/{checklist.length}</b></button>
      </div>
    </section>
    <div className="atlas-commercial-facts" aria-label="Estimate assumptions">
      <span><strong>{input.sites.length}</strong> scoped buildings</span>
      <span><strong>{estimate.crewHours}</strong> entered paid crew-hours</span>
      <span><strong>{estimate.liftDays}</strong> summed rental days</span>
      <span><strong>{reviewed}/{checklist.length}</strong> internal review items checked</span>
      <b>{preview?'FICTIONAL PREVIEW':'SAVE TO COMPANY TO SYNC'}</b>
    </div>
    {ready && <AtlasFieldBridge base={base} organizationId={org} mode={mode} view="commercial" commercial={{name,input,review}} disabled={readOnly} />}
    <div className="com-body">
      <div className="com-left">
        <div className="com-tabs" role="group" aria-label="Commercial desk sections">
          <button aria-pressed={tab==='scope'} onClick={()=>setTab('scope')}>01 / Property scope</button>
          <button aria-pressed={tab==='costs'} onClick={()=>setTab('costs')}>02 / Cost engineering</button>
          <button aria-pressed={tab==='warroom'} onClick={()=>setTab('warroom')}>03 / Bid War Room</button>
          <button aria-pressed={tab==='records'} onClick={()=>setTab('records')}>04 / Existing leads</button>
        </div>
        {tab==='scope'&&<section className="com-panel">
          <div className="com-heading"><div><p className="exec-kicker">FIELD INTELLIGENCE</p><h3>Building-by-building scope</h3><p>Enter separate access, labor and site assumptions for each building. Pane counts are descriptive; labor is priced by entered crew-hours.</p></div><span>{input.sites.length} / 12</span></div>
          <label className="com-field"><span>Project reference</span><input maxLength={140} value={name} onChange={e=>setName(e.target.value)} placeholder="Property manager / complex"/></label>
          {input.sites.map((s,i)=><article className="com-site" key={s.id}>
            <header><div><small>PROPERTY {String(i+1).padStart(2,'0')}</small><h4>{s.name||'Unnamed building'}</h4></div>{input.sites.length>1&&<button aria-label={'Remove '+(s.name||'building')} className="com-remove" onClick={()=>remove(s.id)}><Trash2 size={17}/></button>}</header>
            <div className="com-fields">
              <label className="com-field"><span>Building label</span><input value={s.name} maxLength={70} onChange={e=>patchSite(s.id,{name:e.target.value})}/></label>
              <label className="com-field"><span>Address or location (optional)</span><input value={s.location} maxLength={180} onChange={e=>patchSite(s.id,{location:e.target.value})}/></label>
              {field('Number of floors',s.levels,n=>patchSite(s.id,{levels:n}),100)}
              {field('Estimated panes',s.panes,n=>patchSite(s.id,{panes:n}),100000)}
              {field('Combined paid crew-hours',s.crewHours,n=>patchSite(s.id,{crewHours:n}),10000,0.5)}
              {field('Lift / access equipment rental days',s.liftDays,n=>patchSite(s.id,{liftDays:n}),365,0.5)}
              <label className="com-field"><span>Access approach</span><select value={s.access} onChange={e=>patchSite(s.id,{access:e.target.value as Site['access']})}><option value="review">Requires on-site assessment</option><option value="ground">Ground access</option><option value="water-fed">Water-fed pole</option><option value="lift">Lift / aerial equipment</option></select></label>
              <label className="com-field com-wide"><span>Scope, hazards, exclusions and observations</span><textarea rows={3} maxLength={2000} value={s.notes} onChange={e=>patchSite(s.id,{notes:e.target.value})}/></label>
            </div>
          </article>)}
          <button className="secondary" onClick={add} disabled={input.sites.length>=12}><Plus size={16}/> Add building</button>
        </section>}
        {tab==='costs'&&<section className="com-panel">
          <div className="com-heading"><div><p className="exec-kicker">COST ENGINEERING</p><h3>Estimate the economics</h3><p>These are hypothetical planning inputs. Add quotes from suppliers and verified labor rates before turning any scenario into an offer.</p></div></div>
          <div className="com-fields">
            {field('Loaded cost per paid crew-hour ($)',input.laborRate,n=>patch({laborRate:n}),10000,0.5)}
            {field('Equipment rental per lift-day ($)',input.liftDaily,n=>patch({liftDaily:n}),100000,1)}
            {field('Materials / chemicals / consumables ($)',input.materials,n=>patch({materials:n}))}
            {field('Travel / mobilization ($)',input.mobilization,n=>patch({mobilization:n}))}
            {field('Other direct costs ($)',input.other,n=>patch({other:n}))}
            {field('Contingency on direct costs (%)',input.contingency,n=>patch({contingency:n}),100,1)}
            {field('Target contribution margin (%)',input.margin,n=>patch({margin:n}),90,1)}
            {field('Proposed deposit (%)',input.deposit,n=>patch({deposit:n}),100,1)}
          </div>
          <div className="com-explainer"><b>Margin is not markup.</b> A 30% target contribution margin means estimated cost is 70% of the suggested price. This is not business net profit: overhead, taxes, financing and unknown costs may remain.</div>
        </section>}
        {tab==='warroom'&&<section className="com-panel com-war-room">
          <div className="com-heading"><div><p className="exec-kicker"><BarChart3 size={15}/> COMMERCIAL BID WAR ROOM</p><h3>Price strategy & operational exposure</h3><p>Compare internal margin targets, model cost pressure, and flag property-survey gaps before either founder reviews an offer. None of these scenarios is an approved customer price.</p></div></div>
          <div className="com-war-status" data-state={warRoom.status}>
            {warRoom.status==='scope-incomplete'?<AlertTriangle size={19}/>:<ClipboardCheck size={19}/>}
            <div><strong>{warRoom.status==='scope-incomplete'?'Inspection and review gaps remain':'Ready for independent founder review'}</strong>
            <p>{warRoom.findings.length} unresolved review item{warRoom.findings.length===1?'':'s'}. All technical assumptions, access and terms still require actual verification and explicit approval.</p></div>
          </div>
          <div className="com-war-subhead"><h4>Three pricing strategies</h4><span>Same estimated direct cost · Different target contribution margins</span></div>
          <div className="com-war-cases">{warRoom.pricing.map(item=><article key={item.key} data-case={item.key}>
            <span>{item.label}</span><strong>{dollars(item.price)}</strong>
            <dl><div><dt>Target margin</dt><dd>{item.targetMargin}%</dd></div>
            <div><dt>Estimated contribution</dt><dd>{dollars(item.estimatedContribution)}</dd></div></dl>
            <p>{item.description}</p>
            <button type="button" onClick={()=>{patch({margin:item.targetMargin});setNotice('Target margin changed for this local draft only; no proposal was sent.');}}
              disabled={input.margin===item.targetMargin}>Use {item.targetMargin}% target <ArrowUpRight size={14}/></button>
          </article>)}</div>
          <section className="com-war-stress">
            <div className="com-war-subhead"><h4><AlertTriangle size={17}/> What if costs run higher?</h4><span>Fixed sensitivity test; not a prediction</span></div>
            <p className="com-war-assumptions">Assume +25% paid crew-hours, one extra rental day for each lift-access building, +15% materials, and +20% travel/mobilization. Same contingency percentage.</p>
            <div className="com-war-stress-numbers">
              <div><span>Base cost with contingency</span><strong>{dollars(warRoom.baseline.totalCost)}</strong></div>
              <div><span>Stressed cost with contingency</span><strong>{dollars(warRoom.stress.stressedCost)}</strong></div>
              <div><span>Contribution at current proposed price</span><strong className={warRoom.stress.contributionAtCurrentPrice<0?'com-war-negative':undefined}>{dollars(warRoom.stress.contributionAtCurrentPrice)}</strong></div>
              <div><span>Margin at current proposed price</span><strong>{warRoom.stress.marginAtCurrentPrice===null?'Undefined':warRoom.stress.marginAtCurrentPrice+'%'}</strong></div>
              <div className="com-war-key"><span>Price required to preserve entered target margin</span><strong>{dollars(warRoom.stress.priceToHoldTargetMargin)}</strong></div>
            </div>
          </section>
          <div className="com-war-subhead"><h4>Building-level cost exposure</h4><span>Labor + lift rental only; shared costs not allocated</span></div>
          <div className="com-war-table"><table><thead><tr><th>Building</th><th>Paid hours</th><th>Labor</th><th>Lift rental</th><th>Subtotal</th></tr></thead><tbody>
            {warRoom.siteExposure.map(site=><tr key={site.id}><td>{site.name}</td><td>{site.crewHours}</td><td>{dollars(site.labor)}</td><td>{dollars(site.equipment)}</td><td><b>{dollars(site.directSubtotal)}</b></td></tr>)}
          </tbody></table></div>
          <div className="com-war-subhead"><h4>Pre-proposal exceptions</h4><span>Site evidence and founder sign-off required</span></div>
          {warRoom.findings.length?<div className="com-war-findings">{warRoom.findings.map(item=><div key={item.id} data-severity={item.severity}>
            <span>{item.severity==='critical'?'Scope gap':'Review'}</span><div><strong>{item.subject}: {item.issue}</strong><p>{item.nextAction}</p></div>
          </div>)}</div>:<p className="com-explainer">No missing scope fields detected by this limited checklist. This is NOT permission to work, evidence of insurance, or an approved bid.</p>}
          <div className="com-war-actions"><button className="secondary" onClick={()=>void copyWarRoom()}><ClipboardCopy size={16}/> Copy internal review pack</button>
          <button className="secondary" onClick={downloadWarRoom}><Download size={16}/> Download review pack</button></div>
        </section>}
        {tab==='records'&&<section className="com-panel">
          <div className="com-heading"><div><p className="exec-kicker">SOURCE MATERIAL</p><h3>Potential commercial leads</h3><p>Matching is based only on the service-description text of records available to your role. No existing customer is automatically linked to this draft.</p></div></div>
          {maybeCommercial.length?<div className="com-records">{maybeCommercial.map(lead=><Link href={base+'/b/exterior/leads?lead='+encodeURIComponent(lead.id)} key={lead.id}><div><b>{lead.name||'Unnamed customer'}</b><small>{lead.service_requested||'Service unknown'} · {lead.status||'Status unknown'}</small></div><span>{lead.quote_amount===null?'No quote':dollars(lead.quote_amount)}</span><ChevronRight size={16}/></Link>)}</div>:<p className="com-explainer">No matches in the loaded lead descriptions. That does not mean OJ has no commercial leads.</p>}
          {data.coverage?.leads.total!==null && data.coverage?.leads.total!==undefined && data.coverage.leads.loaded<data.coverage.leads.total&&<p className="com-explainer">Partial record coverage: {data.coverage.leads.loaded} of {data.coverage.leads.total} leads loaded.</p>}
          <Link className="secondary" href={base+'/b/exterior/leads'}>Open Exterior CRM <ArrowRight size={16}/></Link>
        </section>}
        <section className="com-panel com-checks">
          <div className="com-heading"><div><p className="exec-kicker">PRE-PROPOSAL CONTROL</p><h3>Release readiness</h3><p>A checklist for review. Checking a box does not authorize work or certify a site as safe.</p></div><span>{reviewed} / {checklist.length}</span></div>
          {checklist.map((label,i)=><label key={label}><input type="checkbox" checked={review[i]} onChange={e=>setReview(a=>a.map((v,j)=>i===j?e.target.checked:v))}/><span>{review[i]?<Check size={15}/>:null}</span><b>{label}</b></label>)}
        </section>
      </div>
      <aside className="com-right">
        <section className="com-panel com-ledger"><p className="exec-kicker">SCENARIO / USD</p><h3>Internal suggested price</h3><strong className="com-price">{dollars(estimate.suggestedPrice)}</strong><small>Calculated from entered direct costs, contingency and target contribution margin. NOT an external quote.</small>
          <div className="com-ledger-lines">
            {[
              ['Labor',estimate.labor],['Equipment',estimate.equipment],['Materials',estimate.materials],
              ['Travel / mobilization',estimate.mobilization],['Other direct',estimate.other],
              ['Contingency',estimate.contingencyCost],
            ].map(([label,v])=><div key={String(label)}><span>{label}</span><b>{dollars(Number(v))}</b></div>)}
            <div className="com-ledger-total"><span>Cost incl. contingency</span><b>{dollars(estimate.totalCost)}</b></div>
            <div className="com-ledger-total"><span>Estimated contribution</span><b>{dollars(estimate.contribution)}</b></div>
            <div><span>Suggested deposit</span><b>{dollars(estimate.depositAmount)}</b></div>
          </div><div className="com-margin-meter"><span style={{width:String(Math.max(0,100-estimate.margin))+'%'}}/></div><small>Target contribution margin: {estimate.margin}% · before unentered overhead or taxes.</small>
        </section>
        <section className="com-panel com-utilities"><p className="exec-kicker">OPERATOR ACTIONS</p><button className="secondary" onClick={()=>void copy()}><ClipboardCopy size={16}/> Copy scoping brief</button><button className="secondary" onClick={download}><Download size={16}/> Download text brief</button><button className="secondary" onClick={reset}><RotateCcw size={16}/> Reset local draft</button><p role="status">{ready?notice:'Checking this browser for a saved draft…'}</p></section>
        <section className="com-panel com-safety"><HardHat size={24}/><h3>Site access & safety</h3><p>Multi-floor exterior glass work can require fall protection, lift operator training, restricted site access and specialized insurance. Qualified people must assess the actual site before scheduling or pricing committed work.</p></section>
      </aside>
    </div>
    </>}
  </section>;
}
