'use client';

import {useMemo,useState} from 'react';
import Link from 'next/link';
import {useSearchParams} from 'next/navigation';
import {
  ArrowRight,ArrowUpRight,CalendarDays,CheckCheck,ClipboardList,
  FileSearch,Inbox,Mail,Phone,RefreshCcw,ShieldAlert,ShieldCheck,
  Sparkles,UserRoundSearch,UsersRound,
} from 'lucide-react';
import {reviewExteriorWebsiteIntake} from '@/lib/exterior-intake-review';
import {sourceLabel,statusLabel,type ExteriorData} from '@/lib/exterior';
import {LeadDialog,type Act} from './ExteriorManage';

type Props={data:ExteriorData;act:Act;busy:boolean;readOnly:boolean;org:string;now:Date;base:string};
const day=(s:string)=>new Date(s).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'America/Chicago'});
const readable=(s:string|null)=>s?.trim()||'Not supplied';
const phone=(value:string|null)=>value&&/^\+?[0-9(). \-]{10,25}$/.test(value)?value:null;

export function ExteriorIntakeDesk({data,act,busy,readOnly,org,now,base}:Props){
  const entries=useMemo(()=>reviewExteriorWebsiteIntake(data),[data]);
  const params=useSearchParams();
  const requestId=params.get('request');
  const [active,setActive]=useState<string|null>(null);
  const [search,setSearch]=useState('');
  const [allowSeparate,setAllowSeparate]=useState(false);
  const [draftOpen,setDraftOpen]=useState(false);
  const [limit,setLimit]=useState(40);
  const filtered=entries.filter(row=>{
    const q=search.trim().toLowerCase();
    return !q||[row.request.name,row.request.phone,row.request.email,row.request.address,row.request.service_needed,row.request.business_name,row.request.id]
      .some(x=>(x??'').toLowerCase().includes(q));
  });
  const selected=entries.find(x=>x.request.id===active)
    ??entries.find(x=>x.request.id===requestId)
    ??filtered[0]??null;
  const url=`${base}/b/exterior`;
  const canCreate=Boolean(selected&&!readOnly&&(!selected.matches.length||allowSeparate));
  const select=(id:string)=>{setActive(id);setAllowSeparate(false);setDraftOpen(false);};
  const recent=entries.filter(x=>Number.isFinite(Date.parse(x.request.created_at))&&Date.parse(x.request.created_at)>=now.getTime()-30*86400000).length;
  if(!data.extras)return <main className="ecin ecin-unavailable" role="status">
    <ShieldAlert size={25}/><h1>Website intake is not available</h1>
    <p>The source didn't provide website quote requests. We don't invent an inbox or assume there were no requests.</p>
    <Link href={url+'/leads'}>Open customer records <ArrowRight size={15}/></Link>
  </main>;
  return <main className="ecin" aria-label="Website intake command">
    <header className="ecin-hero">
      <div className="ecin-hero-copy">
        <span className="ecin-eyebrow"><span className="ecin-dot"/> EXTERIOR COMMAND / CUSTOMERS / INTAKE</span>
        <h1>Website intake.<br/><em>Into real work.</em></h1>
        <p>Review what the customer sent, inspect potentially related records, and build a new lead draft without typing their original request again.</p>
        <div className="ecin-hero-actions">
          <Link href={url+'/leads'}><UsersRound size={15}/> Customer workbench</Link>
          <Link href={url+'/bookings'}><CalendarDays size={15}/> Booking command <ArrowUpRight size={14}/></Link>
        </div>
      </div>
      <div className="ecin-hero-insight">
        <span>RECORDED SOURCE INBOX</span><strong>{entries.length}</strong><small>Latest accessible website requests, maximum 1,000 loaded. Not necessarily all pending or all historical requests.</small>
        <span>RECENT SOURCE RECEIPTS</span><strong>{recent}</strong><small>Created within the last 30 days, not verified unresolved requests.</small>
      </div>
    </header>
    <div className="ecin-trust"><ShieldCheck size={17}/><p>Website submissions are <strong>inquiries, not approved estimates.</strong> Matching phones or addresses are review candidates, not a verified shared identity. Creating a lead reuses the existing secured form; it does not mark or link the original request as processed.</p></div>
    <div className="ecin-workspace">
      <section className="ecin-inbox" aria-label="Website request records">
        <div className="ecin-panel-head"><div><span className="ecin-eyebrow">01 / RECEIVED</span><h2>Original requests</h2></div><Inbox size={20}/></div>
        <label className="ecin-search">Find an inquiry
          <input type="search" value={search} onChange={e=>{setSearch(e.target.value);setLimit(40);setActive(null);setAllowSeparate(false);}} placeholder="Name, number, location, service…" autoComplete="off"/>
        </label>
        {requestId&&!entries.some(r=>r.request.id===requestId)&&<p className="ecin-warning" role="status">The linked request ID is not in the accessible source window. No similar request was substituted.</p>}
        <div className="ecin-inbox-list">
          {filtered.slice(0,limit).map(row=><button type="button" key={row.request.id} aria-pressed={selected?.request.id===row.request.id} onClick={()=>select(row.request.id)}>
            <span className="ecin-entry-top"><strong>{row.request.name||row.request.business_name||'Unidentified inquiry'}</strong><small>{day(row.request.created_at)}</small></span>
            <span className="ecin-entry-service">{row.request.service_needed||'Service not supplied'}</span>
            <span className="ecin-entry-bottom"><span>{row.request.address||'Location unavailable'}</span><span>{row.matches.length?`${row.matches.length} possible related`:'No matching lead found'}</span></span>
          </button>)}
          {!filtered.length&&<p className="ecin-no-rows">No accessible requests match this search. Website source history may be limited to its latest 1,000 records.</p>}
          {filtered.length>limit&&<button className="ecin-more" onClick={()=>setLimit(n=>n+40)}>Show {Math.min(40,filtered.length-limit)} more requests</button>}
        </div>
        <p className="ecin-loaded-note">Request list is read from the original website submissions. This source doesn't expose a reviewed/closed disposition or total pagination count.</p>
      </section>
      {selected?<section className="ecin-detail" aria-label="Selected original website request">
        <div className="ecin-panel-head"><div><span className="ecin-eyebrow">02 / SOURCE DOSSIER</span><h2>{selected.request.name||selected.request.business_name||'Website inquiry'}</h2>
          <p>Received {day(selected.request.created_at)} · Original source ID</p></div><ClipboardList size={22}/></div>
        <code className="ecin-source-id">{selected.request.id}</code>
        <div className="ecin-detail-grid">
          <div><small>Service</small><strong>{readable(selected.request.service_needed)}</strong></div>
          <div><small>Property type</small><strong>{readable(selected.request.property_type)}</strong></div>
          <div><small>Address</small><strong>{readable(selected.request.address)}</strong></div>
          <div><small>Business / customer</small><strong>{readable(selected.request.business_name)}</strong></div>
          <div><small>Recurring interest</small><strong>{selected.request.recurring_interest===null?'Not answered':selected.request.recurring_interest?'Interested':'Not requested'}</strong></div>
          <div><small>Customer contact</small><strong>{readable(selected.request.phone)}</strong><span>{readable(selected.request.email)}</span></div>
        </div>
        <div className="ecin-original"><span>Original request details</span><p>{readable(selected.request.description)}</p></div>
        <div className="ecin-contact">
          {phone(selected.request.phone)&&<a href={`tel:${phone(selected.request.phone)}`}><Phone size={15}/> Call</a>}
          {selected.request.email&&<a href={`mailto:${selected.request.email}`}><Mail size={15}/> Email</a>}
          <Link href={url+'/leads'}><UserRoundSearch size={15}/> Browse customers</Link>
        </div>
        <div className="ecin-identity">
          <div className="ecin-panel-head"><div><span className="ecin-eyebrow">03 / IDENTITY SAFETY</span><h2>Potential existing records</h2></div><FileSearch size={18}/></div>
          {selected.matches.length?<>
            <p>Review these records before creating another lead. Same phone/address does not prove the same customer, property owner, or job.</p>
            <div className="ecin-matches">{selected.matches.map(m=><article key={m.id}>
              <div><strong>{m.lead.name??'Unnamed customer'}</strong><small>{m.on==='phone-and-address'?'Phone and address match':m.on==='phone'?'Phone matches':'Address matches'} · {statusLabel(m.lead.status)} · {sourceLabel(m.lead.source)}</small></div>
              <Link href={`${url}/customer?lead=${encodeURIComponent(m.id)}`}>Review record <ArrowUpRight size={14}/></Link>
            </article>)}</div>
          </>:<p>No phone or address match in the loaded lead records. This is not proof that the person or property is new.</p>}
        </div>
        <div className="ecin-review-actions">
          <div><span className="ecin-eyebrow">04 / PREPARE CUSTOMER WORK</span><h2>Open a lead draft</h2>
            <p>Pre-fills original name, phone, address, requested service, and source-context notes. No quote value, customer approval, or payment is inferred.</p></div>
          {selected.matches.length>0&&<label className="ecin-distinct"><input type="checkbox" checked={allowSeparate} onChange={e=>setAllowSeparate(e.target.checked)}/>
            I reviewed the potential existing records. This request requires a distinct lead record.</label>}
          {selected.notesTruncated&&<p className="ecin-warning">The original description exceeds the lead-notes limit. The complete text remains in this website source; review it before quoting.</p>}
          {!readOnly?<button type="button" className="ecin-create" disabled={!canCreate||busy} onClick={()=>setDraftOpen(true)}>
            <Sparkles size={17}/> Review pre-filled lead <ArrowRight size={16}/></button>:
            <p className="ecin-warning">Read-only access: customer creation requires an authorized editor.</p>}
          <p className="ecin-legal">After saving, the original inquiry remains here. Until a reviewed source-ID relation exists, ATLAS cannot guarantee deduplication or show a verified processed state.</p>
        </div>
      </section>:<section className="ecin-detail ecin-empty"><RefreshCcw size={26}/><h2>No website requests are accessible.</h2><p>Try the customer workbench, or verify the website intake source configuration.</p></section>}
    </div>
    <LeadDialog lead={draftOpen&&selected?selected.draft:null} close={()=>setDraftOpen(false)}
      act={act} busy={busy} org={org} bookings={data.bookings} now={now}/>
  </main>;
}
