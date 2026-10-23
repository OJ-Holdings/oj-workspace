'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {
  ArrowLeft,ArrowRight,ArrowUpRight,CalendarDays,ClipboardCheck,ContactRound,
  DollarSign,FileSearch,History,MapPin,Pencil,Phone,Plus,ShieldCheck,
  UserRoundSearch,UsersRound,Wallet,
} from 'lucide-react';
import {buildCustomerDossier} from '@/lib/exterior-customer-360';
import {jobDateBasis,sourceLabel,statusLabel,type Done,type ExteriorData,type ExtLead} from '@/lib/exterior';
import {LeadDialog,BookDialog,MoneyDialog} from './ExteriorManage';

type Act=<T extends object>(work:()=>Promise<Done<T>>,success:(result:T)=>string)=>Promise<boolean>;
type Props={
 data:ExteriorData;act:Act;busy:boolean;readOnly:boolean;org:string;now:Date;base:string;
};
const usd=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:2}).format(n);
const day=(key:string)=>new Date(key+'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'});
const safePhone=(p:string|null):string|null=>{
 if(!p)return null;
 const d=p.replace(/\D/g,'');
 return /^\d{10}$/.test(d)?d:/^1\d{10}$/.test(d)?d.slice(1):null;
};
const editInput=(l:ExtLead)=>({
 id:l.id,name:l.name??'',phone:l.phone??'',address:l.address??'',service_requested:l.service_requested??'',
 quote_amount:l.quote_amount??'',notes:l.notes??'',source:l.source??'',
});
export function ExteriorCustomer360({data,act,busy,readOnly,org,now,base}:Props){
 const params=useSearchParams();
 const id=params.get('lead')??'';
 const [editing,setEditing]=useState(false);
 const [booking,setBooking]=useState(false);
 const [paying,setPaying]=useState(false);
 const [showAll,setShowAll]=useState(false);
 const dossier=useMemo(()=>buildCustomerDossier(data,id),[data,id]);
 const root=`${base}/b/exterior`;
 if(!dossier)return <section className="ecc-blank">
   <div className="ecc-blank-art"><UserRoundSearch size={34} aria-hidden="true"/></div>
   <span className="ecc-eyebrow">CUSTOMER COMMAND / SOURCE-BOUND RECORDS</span>
   <h1>{id?'Customer record unavailable':'Open a customer dossier'}</h1>
   <p>{id?'That exact source ID does not exist in your currently accessible Exterior Care records. No similar customer was substituted.':'Select a customer from the verified Exterior Care workbench. Each dossier links their actual bookings and operational history without duplicating or merging identities.'}</p>
   <Link href={root+'/leads'} className="ecc-primary">Browse customer records <ArrowRight size={17}/></Link>
 </section>;
 const {lead,bookings,events,money,candidates,coverage}=dossier;
 const phone=safePhone(lead.phone);
 const completed=lead.status==='completed';
 const go=`${root}/leads?lead=${encodeURIComponent(lead.id)}`;
 return <div className="ecc" aria-label="Exterior customer 360">
   <nav className="ecc-breadcrumb" aria-label="Customer record breadcrumb">
     <Link href={root+'/leads'}><ArrowLeft size={15}/> Customer Command</Link>
     <span>/</span><span>Source dossier</span>
     <strong>{lead.name??'Unnamed customer'}</strong>
   </nav>
   <section className="ecc-head">
     <div className="ecc-head-main">
       <span className="ecc-eyebrow">ATLAS / EXTERIOR CARE / CUSTOMER 360</span>
       <div className="ecc-customer-title"><div aria-hidden="true" className="ecc-avatar">{(lead.name??'?').trim().slice(0,1).toUpperCase()||'?'}</div>
         <div><h1>{lead.name??'Unnamed customer'}</h1><p>{sourceLabel(lead.source)} source · {statusLabel(lead.status)} · Original Exterior record</p></div>
       </div>
       <p className="ecc-head-desc">A single operational view of this exact source record, its jobs and dates. Same-name, same-phone or same-address records are never merged automatically.</p>
       <div className="ecc-actions">
         {!readOnly&&<button type="button" className="ecc-primary" onClick={()=>setBooking(true)}><CalendarDays size={16}/> Book service</button>}
         {!readOnly&&<button type="button" className="ecc-secondary" onClick={()=>setEditing(true)}><Pencil size={15}/> Update customer</button>}
         {!readOnly&&completed&&<button type="button" className="ecc-secondary" onClick={()=>setPaying(true)}><DollarSign size={15}/> Review job figures</button>}
         {phone&&<a className="ecc-secondary" href={`tel:${phone}`}><Phone size={15}/> Call customer</a>}
       </div>
     </div>
     <div className="ecc-source-card">
       <span><ShieldCheck size={16}/> EXACT SOURCE ID</span>
       <code title="Unchanged lead ID">{dossier.sourceId}</code>
       <p>This is the original Exterior lead record, not a newly created person or a verified consolidated identity.</p>
       <Link href={go}>Inspect the lead in the workbench <ArrowUpRight size={14}/></Link>
     </div>
   </section>
   <section className="ecc-metrics" aria-label="Customer recorded money and bookings">
     {[
       {label:'Entered quote',value:usd(money.quote),note:'Proposed work, not an accepted contract',icon:FileSearch},
       {label:'Linked bookings',value:String(bookings.length),note:'Exact lead ID, all statuses and dates',icon:CalendarDays},
       {label:'Recorded job revenue',value:usd(money.recordedJobRevenue),note:'Legacy field, not verified bank collection',icon:Wallet},
       {label:'Known contribution',value:usd(money.knownContribution),note:money.knownContribution===null?'Requires revenue and job cost':'Revenue minus recorded cost; not company profit',icon:ClipboardCheck},
     ].map(item=><div key={item.label} className="ecc-metric">
       <div><span>{item.label}</span><item.icon size={17}/></div>
       <strong>{item.value}</strong><small>{item.note}</small>
     </div>)}
   </section>
   <div className="ecc-content">
     <div className="ecc-primary-col">
       <section className="ecc-panel">
         <header className="ecc-panel-heading"><div><span className="ecc-eyebrow">01 / PROPERTY & SCOPE</span><h2>Customer context</h2></div>
           <Link href={go}>Open source <ArrowUpRight size={15}/></Link></header>
         <div className="ecc-property-grid">
           <div><MapPin size={16}/><span>Recorded service address</span><strong>{lead.address??'Address not entered'}</strong></div>
           <div><ContactRound size={16}/><span>Recorded contact</span><strong>{lead.phone??'Phone unavailable'}</strong></div>
           <div><FileSearch size={16}/><span>Service requested</span><strong>{lead.service_requested??'Service not entered'}</strong></div>
           <div><History size={16}/><span>Source status</span><strong>{statusLabel(lead.status)}</strong></div>
         </div>
         <div className="ecc-notes"><span>Operating notes from original record</span><p>{lead.notes?.trim()||'No customer or site notes recorded.'}</p></div>
       </section>
       <section className="ecc-panel">
         <header className="ecc-panel-heading"><div><span className="ecc-eyebrow">02 / EXECUTION HISTORY</span><h2>Bookings & work</h2></div>
           <Link href={root+'/bookings'}>Open dispatch <ArrowUpRight size={15}/></Link></header>
         {bookings.length?<div className="ecc-booking-list">{bookings.map(b=><article key={b.id} className="ecc-booking">
           <div className="ecc-booking-date"><CalendarDays size={17}/><strong>{day(b.date)}</strong><small>{b.time_block??'Time not entered'}</small></div>
           <div><span className="ecc-booking-tag">{statusLabel(b.status)}</span><p>Linked to this exact source lead. Scheduled status and date do not prove service completion or payment.</p></div>
           <Link href={root+'/bookings'} aria-label={`Open the booking workbench for ${day(b.date)}`}><ArrowUpRight size={16}/></Link>
         </article>)}</div>:<div className="ecc-empty"><CalendarDays size={22}/><strong>No booking linked to this source ID.</strong><p>The customer could still have work recorded under a separate lead; no other identity is assumed.</p></div>}
         {completed&&<div className="ecc-completion"><ShieldCheck size={17}/>
           <p>Lead is marked completed. {lead.completed_at?'A completion timestamp exists in the source.':'Its completion date is estimated from a later source field.'} Recorded job amounts belong to this lead, not to each booking separately.</p>
         </div>}
       </section>
       <section className="ecc-panel">
         <header className="ecc-panel-heading"><div><span className="ecc-eyebrow">03 / RECORD HISTORY</span><h2>Source timeline</h2></div></header>
         <ol className="ecc-history">{events.map(e=><li key={e.id}>
           <div className="ecc-event-dot" aria-hidden="true"/>
           <div><span>{day(e.day)}</span><strong>{e.title}</strong><p>{e.detail}</p>
             {e.basis==='estimated-date'&&<small>Estimated date · confirm before accounting use</small>}</div>
         </li>)}</ol>
         <p className="ecc-timeline-limit">This is a reconstruction from available timestamps, not a complete event audit. Message delivery, exact status-change dates and settled payments are not tracked in these legacy fields.</p>
       </section>
     </div>
     <aside className="ecc-secondary-col">
       <section className="ecc-panel">
         <header className="ecc-panel-heading"><div><span className="ecc-eyebrow">04 / IDENTITY REVIEW</span><h2>Related record candidates</h2></div></header>
         <p className="ecc-qualification">Possible matches are based on a recorded phone or address, **not** a verified customer identity. Nothing is joined or merged.</p>
         {candidates.length?<div className="ecc-candidates">{candidates.slice(0,showAll?candidates.length:5).map(c=><div className="ecc-candidate" key={c.id}>
           <span>{c.kind==='lead'?'Separate lead':'Website inquiry — unlinked'}</span>
           <strong>{c.label}</strong><small>{c.reason}. Review before relating records.</small>
           <Link href={c.kind==='lead'?`${root}/customer?lead=${encodeURIComponent(c.lead!.id)}`:`${root}/quotes`}>Inspect separately <ArrowUpRight size={14}/></Link>
         </div>)}
         {candidates.length>5&&<button type="button" className="ecc-more" onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer':`Show ${candidates.length-5} more`}</button>}
         </div>:<p className="ecc-empty-copy">No exact phone or address candidates in the accessible source window. This does not establish unique identity.</p>}
       </section>
       <section className="ecc-panel ecc-evidence">
         <header className="ecc-panel-heading"><div><span className="ecc-eyebrow">05 / EVIDENCE GAPS</span><h2>What isn't verified</h2></div></header>
         <ul>
           {coverage.notes.map(note=><li key={note}>{note}</li>)}
           <li>There is no reviewed quote version, property ID, invoice settlement, or bank reconciliation in this dossier.</li>
           {completed&&jobDateBasis(lead)!=='completion'&&<li>Job completion timestamp is estimated from legacy update/create fields.</li>}
         </ul>
       </section>
       <section className="ecc-panel ecc-actions-panel">
         <span className="ecc-eyebrow">RECOMMENDED WORKFLOW</span><h2>Keep the record moving</h2>
         <p>Update the existing lead once; use that record for subsequent booking and finance review. Do not open a second customer record just to schedule work.</p>
         {!readOnly&&<button type="button" onClick={()=>setBooking(true)}><Plus size={16}/> New service booking <ArrowRight size={15}/></button>}
         <Link href={root+'/leads'}><UsersRound size={15}/> Customer workbench <ArrowUpRight size={15}/></Link>
       </section>
     </aside>
   </div>
   <LeadDialog lead={editing?editInput(lead):null} close={()=>setEditing(false)} act={act} busy={busy} org={org} bookings={data.bookings} now={now}/>
   <BookDialog lead={booking?lead:null} close={()=>setBooking(false)} act={act} busy={busy} org={org} bookings={data.bookings} now={now}/>
   <MoneyDialog lead={paying?lead:null} close={()=>setPaying(false)} act={act} busy={busy} org={org}/>
 </div>;
}
