'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {
  ArrowLeft,ArrowRight,ArrowUpRight,CalendarDays,ClipboardCheck,ContactRound,
  DollarSign,FileSearch,History,MapPin,Pencil,Phone,
  UserRoundSearch,Wallet,
} from 'lucide-react';
import {buildCustomerDossier} from '@/lib/exterior-customer-360';
import {sourceLabel,statusLabel,type Done,type ExteriorData,type ExtLead} from '@/lib/exterior';
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
      <h1>{id?'Customer not found':'Pick a customer'}</h1>
   <p>{id?'That customer is not in the loaded records.':'Select a customer from the verified Exterior Care workbench. Each dossier links their actual bookings and operational history without duplicating or merging identities.'}</p>
   <Link href={root+'/leads'} className="ecc-primary">See all customers <ArrowRight size={17}/></Link>
 </section>;
 const {lead,bookings,events,money,candidates,coverage}=dossier;
 const phone=safePhone(lead.phone);

 const go=`${root}/leads?lead=${encodeURIComponent(lead.id)}`;
 return <div className="ecc" aria-label="Exterior customer 360">
   <nav className="ecc-breadcrumb" aria-label="Customer record breadcrumb">
     <Link href={root+'/leads'}><ArrowLeft size={15}/> Customers</Link>
          <strong>{lead.name??'Unnamed customer'}</strong>
   </nav>
   <section className="ecc-head">
     <div className="ecc-head-main">
              <div className="ecc-customer-title"><div aria-hidden="true" className="ecc-avatar">{(lead.name??'?').trim().slice(0,1).toUpperCase()||'?'}</div>
         <div><h1>{lead.name??'Unnamed customer'}</h1><p>{statusLabel(lead.status)}, from {sourceLabel(lead.source)}</p></div>
       </div>
              <div className="ecc-actions">
         {!readOnly&&<button type="button" className="ecc-primary" onClick={()=>setBooking(true)}><CalendarDays size={16}/> Book service</button>}
         <Link className="ecc-secondary" href={`${root}/estimate?lead=${encodeURIComponent(lead.id)}`}><FileSearch size={15}/> Build estimate</Link>
         {!readOnly&&<button type="button" className="ecc-secondary" onClick={()=>setEditing(true)}><Pencil size={15}/> Update customer</button>}
         {!readOnly&&<button type="button" className="ecc-secondary" onClick={()=>setPaying(true)}><DollarSign size={15}/> Add job figures</button>}
         {phone&&<a className="ecc-secondary" href={`tel:${phone}`}><Phone size={15}/> Call customer</a>}
       </div>
     </div>
   </section>
   <section className="ecc-metrics" aria-label="Customer recorded money and bookings">
     {[
       {label:'Quote',value:usd(money.quote),note:'Amount quoted',icon:FileSearch},
       {label:'Bookings',value:String(bookings.length),note:'All dates',icon:CalendarDays},
       {label:'Paid',value:usd(money.recordedJobRevenue),note:'Revenue recorded for this job',icon:Wallet},
       {label:'Profit',value:usd(money.knownContribution),note:money.knownContribution===null?'Needs revenue and cost':'Revenue minus job cost',icon:ClipboardCheck},
     ].map(item=><div key={item.label} className="ecc-metric">
       <div><span>{item.label}</span><item.icon size={17}/></div>
       <strong>{item.value}</strong><small>{item.note}</small>
     </div>)}
   </section>
   <div className="ecc-content">
     <div className="ecc-primary-col">
       <section className="ecc-panel">
         <header className="ecc-panel-heading"><div><h2>Details</h2></div>
           <Link href={go}>Open in Customers <ArrowUpRight size={15}/></Link></header>
         <div className="ecc-property-grid">
           <div><MapPin size={16}/><span>Address</span><strong>{lead.address??'Address not entered'}</strong></div>
           <div><ContactRound size={16}/><span>Phone</span><strong>{lead.phone??'Phone unavailable'}</strong></div>
           <div><FileSearch size={16}/><span>Service requested</span><strong>{lead.service_requested??'Service not entered'}</strong></div>
           <div><History size={16}/><span>Status</span><strong>{statusLabel(lead.status)}</strong></div>
         </div>
         <div className="ecc-notes"><span>Notes</span><p>{lead.notes?.trim()||'No customer or site notes recorded.'}</p></div>
       </section>
       <section className="ecc-panel">
         <header className="ecc-panel-heading"><div><h2>Jobs</h2></div>
           <Link href={root+'/bookings'}>All jobs <ArrowUpRight size={15}/></Link></header>
         {bookings.length?<div className="ecc-booking-list">{bookings.map(b=><article key={b.id} className="ecc-booking">
           <div className="ecc-booking-date"><CalendarDays size={17}/><strong>{day(b.date)}</strong><small>{b.time_block??'Time not entered'}</small></div>
           <div><span className="ecc-booking-tag">{statusLabel(b.status)}</span><p></p></div>
           <Link href={`${root}/field?booking=${encodeURIComponent(b.id)}`} aria-label={`Open job on ${day(b.date)}`}><ArrowUpRight size={16}/></Link>
         </article>)}</div>:<div className="ecc-empty"><CalendarDays size={22}/><strong>No jobs booked yet.</strong><p>Use Book service above.</p></div>}
       </section>
       <section className="ecc-panel">
         <header className="ecc-panel-heading"><div><h2>History</h2></div></header>
         <ol className="ecc-history">{events.map(e=><li key={e.id}>
           <div className="ecc-event-dot" aria-hidden="true"/>
           <div><span>{day(e.day)}</span><strong>{e.title}</strong><p>{e.detail}</p>
             {e.basis==='estimated-date'&&<small>Estimated date · confirm before accounting use</small>}</div>
         </li>)}</ol>
       </section>
     </div>
     <aside className="ecc-secondary-col">
       <section className="ecc-panel">
         <header className="ecc-panel-heading"><div><h2>Possible duplicates</h2></div></header>
         <p className="ecc-qualification">Same phone or address on another record. Nothing is merged.</p>
         {candidates.length?<div className="ecc-candidates">{candidates.slice(0,showAll?candidates.length:5).map(c=><div className="ecc-candidate" key={c.id}>
           <span>{c.kind==='lead'?'Separate lead':'Website inquiry — unlinked'}</span>
           <strong>{c.label}</strong><small>{c.reason}. Review before relating records.</small>
           <Link href={c.kind==='lead'?`${root}/customer?lead=${encodeURIComponent(c.lead!.id)}`:`${root}/intake?request=${encodeURIComponent(c.quote!.id)}`}>Open <ArrowUpRight size={14}/></Link>
         </div>)}
         {candidates.length>5&&<button type="button" className="ecc-more" onClick={()=>setShowAll(v=>!v)}>{showAll?'Show fewer':`Show ${candidates.length-5} more`}</button>}
         </div>:<p className="ecc-empty-copy">No other record shares this phone or address.</p>}
       </section>
     </aside>
   </div>
   <LeadDialog lead={editing?editInput(lead):null} close={()=>setEditing(false)} act={act} busy={busy} org={org} bookings={data.bookings} now={now}/>
   <BookDialog lead={booking?lead:null} close={()=>setBooking(false)} act={act} busy={busy} org={org} bookings={data.bookings} now={now}/>
   <MoneyDialog lead={paying?lead:null} close={()=>setPaying(false)} act={act} busy={busy} org={org}/>
 </div>;
}
