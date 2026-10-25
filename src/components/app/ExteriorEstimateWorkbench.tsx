'use client';

import {useEffect,useMemo,useRef,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {
  AlertTriangle,ArrowLeft,ArrowRight,ArrowUpRight,BookOpen,CalendarPlus,Check,
  ClipboardCheck,ClipboardCopy,FileCheck2,FileClock,FilePlus2,HardHat,
  Plus,RefreshCcw,Save,ShieldCheck,SlidersHorizontal,Trash2,Wallet,Download,FileUp,
} from 'lucide-react';
import {recordExteriorEstimatedPrice} from '@/app/workspace/exterior-actions';
import {
  addLocalRevision,computeExteriorEstimate,estimateBrief,isExteriorEstimate,newEstimateLine,
  newExteriorEstimate,parseLocalEstimateBook,rebaseEstimateOnLead,sourceStillMatches,
  type ExteriorEstimate,type EstimateLine,type EstimateUnit,type LocalEstimateBook,
} from '@/lib/exterior-estimate';
import {sourceLabel,statusLabel,type ExteriorData} from '@/lib/exterior';
import {exportQuoteHandoff,importQuoteHandoff,quoteHandoffMaxChars,quoteHandoffPreflight} from '@/lib/exterior-quote-handoff';
import {BookDialog,type Act} from './ExteriorManage';
import {
 captureResidentialArchive,verifyResidentialArchive,planResidentialRestore,
 restoreMissingResidentialDrafts,residentialArchiveMaxChars,
} from '@/lib/exterior-residential-archive';

type Props={data:ExteriorData;act:Act;busy:boolean;readOnly:boolean;org:string;now:Date;base:string;mode:'live'|'preview'};
const usd=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(n);
const units:readonly {value:EstimateUnit;label:string}[]=[
 {value:'flat',label:'Flat fee'},{value:'each',label:'Each'},{value:'sqft',label:'Square foot'},
 {value:'linear_ft',label:'Linear foot'},{value:'pane',label:'Pane'},{value:'hour',label:'Hour'},
];
const safeNum=(value:string)=>value.trim()===''?0:Number(value);
const storageKey=(org:string,id:string)=>`oj-exterior-estimate-v1:${org}:${id}`;
function makeBook(estimate:ExteriorEstimate):LocalEstimateBook{return {schema:1,current:estimate,revisions:[]};}
function moneyEditor(n:number|null,change:(n:number|null)=>void,allowUnknown=false,disabled=false){
 return <input type="number" inputMode="decimal" min="0" max="1000000" step=".01" aria-label={allowUnknown?'Known unit cost, blank when unknown':'Dollar amount'} value={n??''}
  placeholder={allowUnknown?'Unknown':'0'} disabled={disabled} onChange={e=>change(allowUnknown&&e.target.value===''?null:safeNum(e.target.value))}/>;
}
export function ExteriorEstimateWorkbench({data,act,busy,readOnly,org,now,base,mode}:Props){
 const params=useSearchParams(), id=params.get('lead')??'';
 const lead=useMemo(()=>data.leads.find(l=>l.id===id)??null,[data.leads,id]);
 const root=`${base}/b/exterior`;
 const [book,setBook]=useState<LocalEstimateBook|null>(null);
 const [loaded,setLoaded]=useState(false);
 const [storageFailure,setStorageFailure]=useState('');
 const [notice,setNotice]=useState('');
 const [checks,setChecks]=useState([false,false,false]);
 const [booking,setBooking]=useState(false);
 const uploadRef=useRef<HTMLInputElement|null>(null);
 const archiveInputRef=useRef<HTMLInputElement|null>(null);
 const archiveBusyRef=useRef(false);
 const [archiveBusy,setArchiveBusy]=useState(false);
 const [filter,setFilter]=useState('');
 const [recentOnly,setRecentOnly]=useState(true);
 const readonly=readOnly||mode!=='live';
 const canModify=!readonly&&Boolean(lead);
 useEffect(()=>{
   setBook(null);setLoaded(false);setStorageFailure('');setNotice('');setChecks([false,false,false]);setBooking(false);
   if(!lead){setLoaded(true);return;}
   if(readonly){setBook(makeBook(newExteriorEstimate(lead)));setLoaded(true);return;}
   const key=storageKey(org,lead.id);
   try{
     const raw=window.localStorage.getItem(key);
     const saved=raw?parseLocalEstimateBook(raw,lead.id):makeBook(newExteriorEstimate(lead));
     setBook(saved);
   }catch{
     // Do not overwrite an invalid or unreadable original local draft.
     setStorageFailure('The browser draft cannot be read or validated. It has not been overwritten. Copy or recover it before resetting.');
     setBook(makeBook(newExteriorEstimate(lead)));
   }
   setLoaded(true);
 },[org,lead?.id,mode,readOnly]); // eslint-disable-line react-hooks/exhaustive-deps
 useEffect(()=>{
   if(!loaded||!book||!canModify||storageFailure)return;
   const h=window.setTimeout(()=>{
     // Temporary invalid input (e.g. a cleared quantity field) is an editing state,
     // not a storage failure. Don't overwrite the last good draft or lock the editor.
     if(!isExteriorEstimate(book.current,book.current.leadId))return;
     try{computeExteriorEstimate(book.current);}catch{return;}
     try{window.localStorage.setItem(storageKey(org,book.current.leadId),JSON.stringify(book));}
     catch{setStorageFailure('Browser autosave failed. The draft may only exist in this tab; copy an internal brief before navigating away.');}
   },450);
   return ()=>window.clearTimeout(h);
 },[book,loaded,canModify,org,storageFailure]);
 const calculated=useMemo(()=>{
   if(!book)return null;
   try{return {ok:true as const,totals:computeExteriorEstimate(book.current)};}
   catch(error){return {ok:false as const,message:error instanceof Error?error.message:'Invalid quote figures'};}
 },[book]);
 const sourceFresh=Boolean(book&&lead&&sourceStillMatches(book.current,lead));
 const handoff=useMemo(()=>book&&lead&&calculated?.ok?quoteHandoffPreflight(book.current,lead,data.bookings):null,[book,lead,calculated,data.bookings]);
 const allowedStatus=Boolean(lead&&['new','contacted','following_up'].includes(lead.status??''));
 const patch=(change:(v:ExteriorEstimate)=>ExteriorEstimate)=>{
   if(!canModify||storageFailure)return;
   setBook(prev=>prev?{...prev,current:change(prev.current)}:prev);
   setChecks([false,false,false]);setNotice('');
 };
 const patchLine=(lineId:string,fields:Partial<EstimateLine>)=>patch(v=>({...v,lines:v.lines.map(line=>line.id===lineId?{...line,...fields}:line)}));
 const addLine=()=>patch(v=>v.lines.length>=24?v:{...v,lines:[...v.lines,newEstimateLine('line-'+Date.now()+'-'+Math.floor(Math.random()*100000))]});
 const dropLine=(lineId:string)=>patch(v=>v.lines.length===1?v:{...v,lines:v.lines.filter(line=>line.id!==lineId)});
 const rebase=()=>{
   if(!canModify||!book||!lead)return;
   if(!window.confirm('Rebase this local internal draft on the CURRENT customer source? Existing line items stay; earlier legacy quote changes will NOT be copied into your lines. Continue only after reviewing them.'))return;
   setBook({...book,current:rebaseEstimateOnLead(book.current,lead)});
   setChecks([false,false,false]);
   setNotice('Source baseline updated locally. Review the amount and scope before recording it.');
 };
 const saveRevision=()=>{
   if(!canModify||!book||storageFailure)return;
   if(!isExteriorEstimate(book.current,book.current.leadId)){setNotice('Complete valid quantities and service lines before saving a revision. Your earlier local draft remains intact.');return;}
   try{computeExteriorEstimate(book.current);}catch(error){setNotice(error instanceof Error?error.message:'Review the quote values.');return;}
   const revised=addLocalRevision(book,new Date().toISOString(),'revision-'+Date.now());
   try{
     window.localStorage.setItem(storageKey(org,book.current.leadId),JSON.stringify(revised));
     setBook(revised);setNotice('Local revision saved on this browser only. Oscar and Jacob will not see it on their other devices.');
   }catch{setStorageFailure('This browser could not save the validated revision. Existing storage has not been removed.');}
 };
 const reset=()=>{
   if(!lead||readonly)return;
   if(!window.confirm('Discard this browser-local estimate and its local revisions? The original customer record and shared quoted amount will NOT change.'))return;
   try{window.localStorage.removeItem(storageKey(org,lead.id));setStorageFailure('');
     setBook(makeBook(newExteriorEstimate(lead)));setNotice('Local workbench reset. Shared customer records were not changed.');
   }catch{setNotice('Browser storage could not be cleared. Export or recover it before editing again.');}
 };
 const copy=async()=>{
   if(!book||!lead||!calculated?.ok)return;
   try{await navigator.clipboard.writeText(estimateBrief(book.current,lead));setNotice('Internal estimate review copied. No message or proposal was sent.');}
   catch{setNotice('Clipboard permission denied; no customer was contacted.');}
 };
 const exportPortable=()=>{
   if(!book||!lead||!calculated?.ok)return;
   try{
     const json=exportQuoteHandoff(org,book);
     const u=URL.createObjectURL(new Blob([json],{type:'application/json;charset=utf-8'}));
     const a=document.createElement('a');a.href=u;
     a.download='oj-internal-estimate-'+lead.id.slice(0,8)+'.json';
     a.click();window.setTimeout(()=>URL.revokeObjectURL(u),1000);
     setNotice('Internal estimate package exported. Transfer privately; it contains cost assumptions and is NOT a customer proposal or shared database version.');
   }catch(error){setNotice(error instanceof Error?error.message:'Could not export the quote package.');}
 };
 const importPortable=async(file:File|undefined)=>{
   if(!file||!canModify||storageFailure||!lead)return;
   if(file.size>quoteHandoffMaxChars*4){setNotice('Internal quote file exceeds the 120 KB character limit.');return;}
   try{
     const transfer=importQuoteHandoff(await file.text(),org,lead.id);
     const proposed=computeExteriorEstimate(transfer.book.current);
     const differentSource=!sourceStillMatches(transfer.book.current,lead);
     if(!window.confirm(
       'Replace your CURRENT browser-local estimate and revision history with this imported internal package? '+
       'The existing local draft will be lost; no shared lead value or booking will change. '+
       (differentSource?'WARNING: the imported source baseline is stale and must be reviewed before price recording.':'')+
       ' Proposed internal amount: '+usd(proposed.price)+'.'
     ))return;
     try{
       window.localStorage.setItem(storageKey(org,lead.id),JSON.stringify(transfer.book));
     }catch{setNotice('Browser storage rejected the imported package. Current local draft was not replaced.');return;}
     setBook(transfer.book);setChecks([false,false,false]);
     setNotice('Imported '+transfer.book.revisions.length+' local revisions for this exact customer. '+
       (differentSource?'Source stamp differs; review and rebase before recording.':'Original source stamp matches.')+
       ' No customer approval or booking was imported.');
   }catch(error){setNotice(error instanceof Error?error.message:'Quote file could not be verified. Existing local draft was not replaced.');}
 };
 const publish=async()=>{
   if(!lead||!book||!calculated?.ok||!canModify||!sourceFresh||!checks.every(Boolean)||!allowedStatus)return;
   const success=await act(
     ()=>recordExteriorEstimatedPrice(org,lead.id,
        {updatedAt:book.current.sourceUpdatedAt,amount:book.current.sourceQuote},
        calculated.totals.price,true),
     ()=>'Reviewed price recorded on the shared lead. It is not a sent or accepted quote. Customer source will refresh.',
   );
   if(success){setNotice('Shared lead amount updated. This browser-local version is retained; rebase it on the refreshed customer record before another price update.');setChecks([false,false,false]);}
 };
 /** Device-local backup only. Never uploads sensitive unit costs to a server. */
 const flushOpenEstimateForArchive=()=>{
   // A draft can be actively edited while the autosave debounce is pending.
   // Capture that current validated state or refuse to claim a complete export.
   if(!lead||!book||storageFailure)return;
   if(!isExteriorEstimate(book.current,lead.id)){
     throw Error('Finish the current invalid estimate fields before exporting or importing; no original records were changed.');
   }
   computeExteriorEstimate(book.current);
   const json=JSON.stringify(book);
   parseLocalEstimateBook(json,lead.id);
   window.localStorage.setItem(storageKey(org,lead.id),json);
 };
 const exportAllResidential=async()=>{
   if(readonly||archiveBusyRef.current)return;
   archiveBusyRef.current=true;setArchiveBusy(true);
   try{
     flushOpenEstimateForArchive();
     const archive=await captureResidentialArchive(org,window.localStorage,new Date().toISOString());
     const raw=JSON.stringify(archive);
     const blob=new Blob([raw],{type:'application/json;charset=utf-8'});
     const uri=URL.createObjectURL(blob);
     const a=document.createElement('a');
     a.href=uri;
     a.download='OJ-PRIVATE-residential-drafts-'+org.slice(0,8)+'-'+archive.capturedAt.slice(0,10)+'.json';
     a.click();window.setTimeout(()=>URL.revokeObjectURL(uri),1500);
     const unreadable=archive.entries.filter(e=>e.status==='unreadable').length;
     setNotice('Prepared a private, checksummed archive of '+archive.entries.length+
       ' residential browser drafts'+(unreadable?' including '+unreadable+' unreadable originals for manual recovery':'')+
       '. This unencrypted file contains internal prices, costs and notes. Store it securely. It is NOT a cloud sync or customer proposal.');
   }catch(error){
     setNotice(error instanceof Error?error.message:'Browser data export failed. No original drafts were removed.');
   }finally{archiveBusyRef.current=false;setArchiveBusy(false);}
 };
 const importMissingResidential=async(file:File|undefined)=>{
   if(!file||readonly||archiveBusyRef.current)return;
   archiveBusyRef.current=true;setArchiveBusy(true);
   try{
     if(file.size>residentialArchiveMaxChars*2)
       throw Error('Residential archive is too large for this single-file recovery flow.');
     // This makes an actively open new draft an EXISTING key. Import never
     // overwrites it if a second device happened to export the same lead.
     flushOpenEstimateForArchive();
     const archive=await verifyResidentialArchive(await file.text(),org);
     const plan=planResidentialRestore(archive,window.localStorage);
     if(plan.missing.length===0){
       setNotice('Archive verified. No missing validated drafts: '+plan.identical.length+
         ' already identical, '+plan.conflicts.length+' differing local versions preserved, '+
         plan.unreadable.length+' unreadable originals retained in the archive file. No writes performed.');
       return;
     }
     const accepted=window.confirm(
       'Verified PRIVATE archive for this exact OJ company: restore '+plan.missing.length+
       ' MISSING validated draft(s) into THIS browser only? '+
       plan.conflicts.length+' existing differing records will NOT be overwritten, and '+
       plan.unreadable.length+' unreadable originals will stay in the file for manual recovery. '+
       'No shared quotes, customers or invoices will change. Continue?'
     );
     if(!accepted){setNotice('Archive was verified but not restored. Existing browser records are unchanged.');return;}
     const restored=restoreMissingResidentialDrafts(archive,window.localStorage);
     setNotice('Private recovery: '+restored.imported+' missing draft(s) restored in this browser; '+
       restored.skippedExisting+' existing draft(s) preserved; '+
       restored.skippedUnreadable+' unreadable original(s) kept in the file.'+
       (restored.failed?' Browser storage stopped at '+restored.failedLeadId+
       '; earlier restored records remain, and none were overwritten.':'')+
       ' This operation does not sync to the shared database.');
   }catch(error){
     setNotice(error instanceof Error?error.message:'Archive verification failed. Existing drafts remain intact.');
   }finally{archiveBusyRef.current=false;setArchiveBusy(false);}
 };
 const archiveControls=(
   <div className="ecest-toolbar" aria-label="Recover all residential drafts from this browser">
     {!readonly&&<button type="button" disabled={archiveBusy}
       onClick={exportAllResidential}><Download size={15}/> Export all residential drafts</button>}
     {!readonly&&<button type="button" disabled={archiveBusy}
       onClick={()=>archiveInputRef.current?.click()}><FileUp size={15}/> Restore missing from archive</button>}
     <input ref={archiveInputRef} type="file" hidden accept=".json,application/json"
       aria-label="Select a private checksummed residential archive"
       onChange={async e=>{
         const file=e.currentTarget.files?.[0];e.currentTarget.value='';
         await importMissingResidential(file);
       }}/>
   </div>
 );
 const candidates=data.leads.filter(l=>(l.name??'').toLowerCase().includes(filter.toLowerCase())||
   (l.address??'').toLowerCase().includes(filter.toLowerCase())||
   (l.service_requested??'').toLowerCase().includes(filter.toLowerCase()));
 if(!lead)return <main className="ecest">
   <section className="ecest-banner"><span className="ecest-eyebrow">ATLAS / EXTERIOR / ESTIMATING</span>
     <h1>{id?'Selected customer unavailable':'Estimate a real job.'}</h1>
     <p>{id?'That exact lead is not in the authorized source. No similarly named customer was substituted.':'Choose an existing Exterior Care customer record to start a line-item internal estimate. Nothing is sent to customers or entered as revenue.'}</p>
     {archiveControls}
     <Link href={root+'/leads'}><ArrowLeft size={15}/> Customer workbench</Link>
   </section>
   <section className="ecest-pick"><div className="ecest-section-title"><div><span className="ecest-eyebrow">SOURCE SELECTION</span><h2>Choose a customer record</h2></div><FilePlus2 size={22}/></div>
     <input aria-label="Find a customer to estimate" type="search" value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Find name, service, or address"/>
     <label><input type="checkbox" checked={recentOnly} onChange={e=>setRecentOnly(e.target.checked)}/> Open opportunities only</label>
     <div>{candidates.filter(l=>!recentOnly||['new','contacted','following_up'].includes(l.status??'')).slice(0,80).map(l=>
       <Link key={l.id} href={`${root}/estimate?lead=${encodeURIComponent(l.id)}`}><strong>{l.name??'Unnamed customer'}</strong><span>{l.service_requested??'Unspecified service'} · {statusLabel(l.status)} · {usd(l.quote_amount)}</span><ArrowRight size={14}/></Link>)}</div>
     <small>Only original lead IDs are selectable. A returning completed job should be booked as a new opportunity, not repriced historically.</small>
     {notice&&<p className="ecest-feedback" role="status">{notice}</p>}
   </section>
 </main>;
 if(!loaded||!book)return <main className="ecest" aria-busy="true"><p>Loading the local estimate workbench…</p></main>;
 const totals=calculated?.ok?calculated.totals:null;
 return <main className="ecest">
   <nav className="ecest-crumb"><Link href={root+'/customer?lead='+encodeURIComponent(lead.id)}><ArrowLeft size={15}/> Customer 360</Link><span>/</span><strong>Estimating</strong></nav>
   <header className="ecest-banner ecest-banner-grid">
     <div><span className="ecest-eyebrow">EXTERIOR COMMAND / QUOTE ENGINEERING</span>
       <h1>Estimate the scope.<br/><em>Own the margin.</em></h1>
       <p><strong>{lead.name??'Unnamed customer'}</strong> · {lead.service_requested??'Unspecified service'} · {sourceLabel(lead.source)}</p>
       <p>{lead.address??'Service location not entered'}</p>
       <div className="ecest-toolbar">
         <button type="button" onClick={saveRevision} disabled={!canModify||!!storageFailure||!totals}><Save size={15}/> Save local revision</button>
         <button type="button" onClick={copy} disabled={!totals}><ClipboardCopy size={15}/> Copy internal brief</button>
         <button type="button" onClick={exportPortable} disabled={!totals}><Download size={15}/> Export quote package</button>
         {!readonly&&<button type="button" disabled={archiveBusy} onClick={exportAllResidential}>
           <Download size={15}/> Backup every residential draft</button>}
         {!readonly&&<button type="button" disabled={archiveBusy}
           onClick={()=>archiveInputRef.current?.click()}><FileUp size={15}/> Restore missing drafts</button>}
         <input ref={archiveInputRef} type="file" hidden accept=".json,application/json"
           aria-label="Import company-scoped residential draft archive"
           onChange={async e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';await importMissingResidential(file);}}/>
         {canModify&&<button type="button" onClick={()=>uploadRef.current?.click()} disabled={!!storageFailure}><FileUp size={15}/> Import private package</button>}
         <input ref={uploadRef} type="file" accept=".json,application/json" aria-label="Import validated internal quote file"
           hidden onChange={async e=>{const file=e.currentTarget.files?.[0];e.currentTarget.value='';await importPortable(file);}}/>
         {!readonly&&<button type="button" onClick={reset}><RefreshCcw size={15}/> Reset local</button>}
       </div>
     </div>
     <div className="ecest-hero-stamp"><ShieldCheck size={24}/><strong>INTERNAL ESTIMATE</strong>
       <p>No proposal sent. No customer approval, invoice, receivable or payment.</p>
       <small>Local browser history · Shared customer quote amount is a separate, deliberate action</small></div>
   </header>
   <div className="ecest-evidence" role="status"><FileClock size={18}/><p>Local drafts are browser-only and not automatically shared between Oscar and Jacob. Do not use shared computers for sensitive draft retention. Historical lead quote: <strong>{usd(lead.quote_amount)}</strong>. {sourceFresh?'Source baseline matches this estimate.':'The lead changed since this draft was opened; review and rebase before recording any price.'}</p>
     {!sourceFresh&&canModify&&<button type="button" onClick={rebase}>Review & rebase</button>}</div>
   {storageFailure&&<p className="ecest-blocked" role="alert">{storageFailure} <button type="button" onClick={reset}>Reset after recovery</button></p>}
   {!allowedStatus&&<p className="ecest-blocked" role="status">This lead is {statusLabel(lead.status)}. Its historic price cannot be overwritten from the estimator. You can inspect the estimate locally and view existing bookings; use a new opportunity for repeat work.</p>}
   <section className="ecest-insights" aria-label="Estimated pricing and cost coverage">
     {[{label:'Proposed price',value:usd(totals?.price??null),note:'Internal scenario · not accepted',icon:Wallet},
       {label:'Known direct costs',value:usd(totals?.cost??null),note:totals?.cost===null?'Some costs or travel unknown':'Estimated including contingency',icon:HardHat},
       {label:'Estimated contribution',value:usd(totals?.contribution??null),note:'Direct contribution, not net profit',icon:SlidersHorizontal},
       {label:'Gross contribution margin',value:totals?.marginPct===null||totals?.marginPct===undefined?'Unknown':totals.marginPct+'%',note:'Only when all costs entered',icon:ClipboardCheck}
      ].map((item,i)=><div className="ecest-instrument" key={item.label} style={{animationDelay:`${i*65}ms`}}>
        <div><span>{item.label}</span><item.icon size={17}/></div><strong>{item.value}</strong><small>{item.note}</small></div>)}
   </section>
   <div className="ecest-workspace">
     <div className="ecest-main-col">
       <section className="ecest-panel">
         <header className="ecest-section-title"><div><span className="ecest-eyebrow">01 / SCOPE MODEL</span><h2>Service line items</h2>
           <p>Quantities, unit prices and estimated unit costs for this specific job.</p></div>
           {!readonly&&<button type="button" className="ecest-ghost" onClick={addLine} disabled={book.current.lines.length>=24||!!storageFailure}><Plus size={15}/> Add service</button>}
         </header>
         <div className="ecest-lines">{book.current.lines.map((line,i)=><article key={line.id} className="ecest-line">
           <div className="ecest-line-head"><span>LINE {String(i+1).padStart(2,'0')}</span><strong>{usd(line.quantity*line.pricePerUnit)}</strong>
             {!readonly&&<button type="button" disabled={book.current.lines.length<=1||!!storageFailure} onClick={()=>dropLine(line.id)} aria-label={`Remove service line ${i+1}`}><Trash2 size={14}/></button>}</div>
           <div className="ecest-line-grid">
             <label className="ecest-name">Service / scope<input required maxLength={120} value={line.service} disabled={readonly||!!storageFailure} onChange={e=>patchLine(line.id,{service:e.target.value})}/></label>
             <label>Quantity<input type="number" min=".01" max="100000" step=".01" inputMode="decimal" value={line.quantity} disabled={readonly||!!storageFailure} onChange={e=>patchLine(line.id,{quantity:safeNum(e.target.value)})}/></label>
             <label>Unit<select value={line.unit} disabled={readonly||!!storageFailure} onChange={e=>patchLine(line.id,{unit:e.target.value as EstimateUnit})}>
               {units.map(u=><option key={u.value} value={u.value}>{u.label}</option>)}</select></label>
             <label>Price / unit{moneyEditor(line.pricePerUnit,n=>patchLine(line.id,{pricePerUnit:n??0}),false,readonly||!!storageFailure)}</label>
             <label>Est. cost / unit{moneyEditor(line.costPerUnit,n=>patchLine(line.id,{costPerUnit:n}),true,readonly||!!storageFailure)}</label>
             <label className="ecest-notes">Site assumptions / exclusions<textarea rows={2} maxLength={800} value={line.notes} disabled={readonly||!!storageFailure} onChange={e=>patchLine(line.id,{notes:e.target.value})} placeholder="Access, surface conditions, equipment, measurements…"/></label>
           </div>
         </article>)}</div>
       </section>
       <section className="ecest-panel">
         <header className="ecest-section-title"><div><span className="ecest-eyebrow">02 / PRICE ADJUSTMENTS</span><h2>Unit economics</h2><p>Unknown costs stay unknown; entering a zero requires a real zero-cost estimate.</p></div></header>
         <div className="ecest-adjusts">
           <label>Customer discount (flat $){moneyEditor(book.current.discount,n=>patch(v=>({...v,discount:n??0})),false,readonly||!!storageFailure)}</label>
           <label>Travel/mobilization cost (blank = unknown){moneyEditor(book.current.travelCost,n=>patch(v=>({...v,travelCost:n})),true,readonly||!!storageFailure)}</label>
           <label>Direct-cost contingency (%)
             <input type="number" min="0" max="100" step=".5" value={book.current.contingencyPct} disabled={readonly||!!storageFailure} onChange={e=>patch(v=>({...v,contingencyPct:safeNum(e.target.value)}))}/></label>
         </div>
         <div className="ecest-cost-coverage"><FileCheck2 size={17}/><p>Cost completeness: <strong>{totals?.costedLines??0} of {book.current.lines.length} lines</strong> have unit costs; travel {totals?.travelKnown?'entered':'unknown'}. Totals and margin are withheld until all direct costs are represented.</p></div>
         {!calculated?.ok&&<p className="ecest-blocked" role="alert">{calculated?.message??'Could not compute the estimate.'}</p>}
       </section>
     </div>
     <aside className="ecest-side-col">
       <section className="ecest-panel ecest-review">
         <header className="ecest-section-title"><div><span className="ecest-eyebrow">03 / FOUNDER REVIEW</span><h2>Price recording</h2></div><ShieldCheck size={19}/></header>
         <p>Recording a price changes the existing customer lead's quote amount only. It is not an accepted proposal or job booking. All draft details remain on this browser.</p>
         <div className="ecest-review-steps">
           {['I verified the service scope and quantities','I reviewed pricing and whether direct costs are complete','I verified this is the correct customer and current source record'].map((x,i)=><label key={x}>
             <input type="checkbox" checked={checks[i]} disabled={readonly||!!storageFailure} onChange={e=>setChecks(v=>v.map((b,j)=>i===j?e.target.checked:b))}/>{x}</label>)}
         </div>
         <button className="ecest-record" type="button" disabled={!canModify||!allowedStatus||!sourceFresh||!totals||totals.price<=0||!checks.every(Boolean)||busy||!!storageFailure} onClick={publish}><Check size={16}/> Record reviewed amount <ArrowRight size={15}/></button>
         <small>Source timestamp + existing quote value are checked again by the server. Another founder's edit cannot silently be overwritten.</small>
       </section>
       <section className="ecest-panel ecest-portable">
         <header className="ecest-section-title"><div><span className="ecest-eyebrow">04 / FOUNDER HANDOFF</span><h2>Quote readiness</h2></div><FileCheck2 size={19}/></header>
         <p>Export a validated private file for Jacob or Oscar to import into the <strong>same original customer record</strong>. This transfers internal calculations manually, not a synchronized or accepted quote.</p>
         <div className="ecest-handoff-flags">
           <div><span>Original source unchanged</span><strong>{handoff?.sourceMatch?'Verified':'Needs review'}</strong></div>
           <div><span>Internal price equals lead quote</span><strong>{handoff?.sourcePriceMatch?'Yes':'Not established'}</strong></div>
           <div><span>Existing linked appointments</span><strong>{handoff?.linkedBookingCount??0}</strong></div>
           <div><span>Customer acceptance evidence</span><strong>Unverified</strong></div>
         </div>
         {handoff&&<ul className="ecest-handoff-warnings">{handoff.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
         <small>Importing and exporting do not update shared pricing or send anything to the customer. Review the actual conversation and scope before manual booking.</small>
       </section>
       <section className="ecest-panel ecest-revisions">
         <header className="ecest-section-title"><div><span className="ecest-eyebrow">05 / LOCAL REVISIONS</span><h2>Pricing history</h2></div><BookOpen size={18}/></header>
         <p>Up to eight saved revisions retained on this device. Restoring affects your internal draft, never the shared customer source.</p>
         {book.revisions.length?<div>{book.revisions.map((revision,i)=><article key={revision.id}>
           <div><strong>Local v{book.revisions.length-i}</strong><small>{new Date(revision.savedAt).toLocaleString('en-US')}</small></div>
           <button type="button" disabled={readonly||!!storageFailure} onClick={()=>{if(window.confirm('Restore this local revision? Current unsaved draft fields will be replaced.')){setBook(b=>b?{...b,current:JSON.parse(JSON.stringify(revision.estimate)) as ExteriorEstimate}:b);setChecks([false,false,false]);setNotice('Local version restored; nothing changed on the shared lead.');}}}>Restore <RefreshCcw size={14}/></button>
         </article>)}</div>:<div className="ecest-no-history"><FileClock size={19}/> No local revision saved yet.</div>}
       </section>
       <section className="ecest-panel ecest-handoff">
         <span className="ecest-eyebrow">06 / DISPATCH HANDOFF</span><h2>Ready to schedule?</h2>
         <p>Use the current guarded booking workflow after confirming scope and price with the customer. Scheduling a job is not proof that a quote was accepted.</p>
         {!readonly&&<button type="button" disabled={busy||lead.status==='booked'} onClick={()=>setBooking(true)}><CalendarPlus size={17}/> {lead.status==='booked'?'Already booked':'Open booking workbench'} <ArrowRight size={14}/></button>}
         <Link href={root+'/customer?lead='+encodeURIComponent(lead.id)}>Return to Customer 360 <ArrowUpRight size={15}/></Link>
         <small>Neither this estimate nor its local revisions are automatically attached to the booking. A durable quote/work-order link requires the future shared schema.</small>
       </section>
     </aside>
   </div>
   {notice&&<p className="ecest-feedback" role="status">{notice}</p>}
   <BookDialog lead={booking?lead:null} close={()=>setBooking(false)} act={act} busy={busy} org={org} bookings={data.bookings} now={now}/>
 </main>;
}
