'use client';

import {useEffect,useState} from 'react';
import {FileText,Link2,Receipt,ScrollText,X} from 'lucide-react';
import {linkCompanyRecord,loadCompanyRecords} from '@/app/workspace/commercial-record-actions';
import {companyLedger,suggestRecords,type CompanyRecord} from '@/lib/commercial-accounts';

const usd=(c:number)=>'$'+(c/100).toLocaleString('en-US',{minimumFractionDigits:c%100?2:0,maximumFractionDigits:2});
const day=(iso:string)=>iso?new Date(iso+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}):'No date';
const icons={proposal:ScrollText,invoice:Receipt,document:FileText};
const label=(r:CompanyRecord)=>r.kind==='document'?(r.status&&r.status!=='other'?r.status[0].toUpperCase()+r.status.slice(1):'File')
 :r.status?r.status[0].toUpperCase()+r.status.slice(1):'';
const key=(r:CompanyRecord)=>r.kind+':'+r.id;

/** One company's proposals, invoices and files, with what they have been invoiced and paid. Real linked rows only. */
export function CompanyRecords({org,accountId,company,canEdit}:{org:string;accountId:string;company:string;canEdit:boolean}){
 const [records,setRecords]=useState<CompanyRecord[]>([]);
 const [installed,setInstalled]=useState(true);
 const [state,setState]=useState<'loading'|'ready'|'error'>('loading');
 const [message,setMessage]=useState('');
 const [candidates,setCandidates]=useState<CompanyRecord[]|null>(null);
 const [choice,setChoice]=useState('');
 const [busy,setBusy]=useState(false);
 const [tick,setTick]=useState(0);
 useEffect(()=>{
  let active=true;setState('loading');
  void loadCompanyRecords(org,accountId).then(r=>{
   if(!active)return;setInstalled(r.installed);setRecords(r.records);setState('ready');
  }).catch(e=>{if(active){setState('error');setMessage(e instanceof Error?e.message:'Records unavailable.');}});
  return ()=>{active=false;};
 },[org,accountId,tick]);
 async function startLink(){
  setBusy(true);setMessage('');
  try{
   const r=await loadCompanyRecords(org,null);
   const sorted=suggestRecords(company,r.records);
   setCandidates(sorted);setChoice(sorted[0]?key(sorted[0]):'');
  }catch(e){setMessage(e instanceof Error?e.message:'Could not list records.');}
  finally{setBusy(false);}
 }
 async function setLink(r:CompanyRecord|undefined,target:string|null){
  if(!r)return;
  if(!target&&!window.confirm('Unlink '+r.title+' from '+company+'? The record itself is not changed.'))return;
  setBusy(true);setMessage('');
  try{
   await linkCompanyRecord(org,r.kind,r.id,target);
   setCandidates(null);setTick(t=>t+1);
   setMessage(target?r.title+' linked to '+company+'.':r.title+' unlinked.');
  }catch(e){setMessage(e instanceof Error?e.message:'The link did not save.');}
  finally{setBusy(false);}
 }
 const ledger=companyLedger(records);
 return <section className="cw-records" aria-label="Proposals, invoices and files">
  <header className="cw-records-head">
   <h4><Receipt size={16}/> Work and money</h4>
   {installed&&canEdit&&!candidates&&<button type="button" className="secondary" disabled={busy||state!=='ready'} onClick={()=>void startLink()}><Link2 size={14}/> Link a record</button>}
  </header>
  {!installed&&<p className="cw-empty">Linking proposals, invoices and files to a company turns on once the company links database update has been run.</p>}
  {installed&&candidates&&<div className="cw-link-picker">
   {candidates.length?<>
    <label>Record to link
     <select value={choice} onChange={e=>setChoice(e.target.value)} disabled={busy}>
      {candidates.map(c=><option key={key(c)} value={key(c)}>
       {[c.title,c.customer,day(c.date),c.totalCents!==null?usd(c.totalCents):''].filter(Boolean).join(', ')}
      </option>)}
     </select>
    </label>
    <button type="button" className="primary" disabled={busy||!choice} onClick={()=>void setLink(candidates.find(c=>key(c)===choice),accountId)}><Link2 size={14}/> Link to {company}</button>
   </>:<p className="cw-empty">Every proposal, invoice and file is already linked to a company.</p>}
   <button type="button" className="secondary" disabled={busy} onClick={()=>setCandidates(null)}>Cancel</button>
  </div>}
  {message&&<p className="com-account-notice" role="status">{message}</p>}
  {installed&&state==='ready'&&records.length>0&&<dl className="cw-tally cw-ledger">
   <div><dt>Invoiced</dt><dd>{usd(ledger.invoiced)}</dd></div>
   <div><dt>Paid</dt><dd>{usd(ledger.paid)}</dd></div>
   <div><dt>Still owed</dt><dd>{usd(ledger.open)}</dd></div>
   <div><dt>Proposals won</dt><dd>{ledger.won} of {ledger.proposals}</dd></div>
  </dl>}
  {installed&&state==='ready'&&!records.length&&!candidates&&<p className="cw-empty">Nothing linked yet. Link their proposals, invoices and files to see what they have been billed and paid.</p>}
  {state==='loading'&&installed&&<p className="cw-loading" role="status">Loading records</p>}
  {records.length>0&&<ol className="cw-timeline">
   {records.map(r=>{const Icon=icons[r.kind];return <li key={key(r)} className={'cw-entry is-'+r.kind}>
    <span className="cw-entry-mark" aria-hidden="true"><Icon size={15}/></span>
    <span className="cw-entry-main"><strong>{r.title}</strong><small>{day(r.date)}{r.customer&&r.customer!==company?', billed to '+r.customer:''}</small></span>
    <span className={'cw-entry-status is-'+r.status}>{label(r)}</span>
    <span className="cw-entry-amount">{r.totalCents!==null?usd(r.totalCents):''}{r.kind==='invoice'&&r.paidCents!==null&&r.status==='open'&&r.paidCents>0?<small>{usd(r.paidCents)} paid</small>:null}</span>
    {canEdit&&<button type="button" className="cw-remove" disabled={busy} aria-label={'Unlink '+r.title} onClick={()=>void setLink(r,null)}><X size={13}/></button>}
   </li>;})}
  </ol>}
 </section>;
}
