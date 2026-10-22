'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Check, ChevronRight, ClipboardCopy, Download, FileInput, HardHat, Plus, RotateCcw, Save, ShieldAlert, Trash2 } from 'lucide-react';
import type { ExteriorData } from '@/lib/exterior';
import { brief, calculateEstimate, newEstimate, newSite, type EstimateInput, type Site } from '@/lib/commercial-estimate';
import { commercialTransferMaxChars, exportCommercialEstimate, importCommercialEstimate } from '@/lib/commercial-transfer';

const dollars=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});
const checklist=[
  'Scope, pane counts and conditions verified at every building',
  'Access strategy assessed by qualified personnel',
  'Operator training, rental, permits and insurance confirmed',
  'Crew-hours and all direct costs reviewed',
  'Exclusions, schedule, site permission and client terms documented',
];
type Tab = 'scope'|'costs'|'records';
const field=(label:string,value:number,onChange:(n:number)=>void,max=1000000,step=1)=>
  <label className="com-field"><span>{label}</span><input type="number" inputMode="decimal" min={0} max={max} step={step}
    value={Number.isFinite(value)?value:0} onChange={e=>onChange(e.target.value===''?0:Number(e.target.value))}/></label>;

export function CommercialDesk({data,org,mode}:{data:ExteriorData;org:string;mode:'live'|'preview'}) {
  const preview=mode==='preview';
  const [tab,setTab]=useState<Tab>('scope');
  const [name,setName]=useState('New commercial opportunity');
  const [input,setInput]=useState<EstimateInput>(newEstimate);
  const [review,setReview]=useState<boolean[]>(checklist.map(()=>false));
  const [notice,setNotice]=useState('');
  const transferInput=useRef<HTMLInputElement>(null);
  const [ready,setReady]=useState(false);
  const estimate=useMemo(()=>calculateEstimate(input),[input]);
  const text=useMemo(()=>brief(name,input),[name,input]);
  const key='oj-commercial-estimate-v2:'+org;

  useEffect(()=>{
    if(preview){setReady(true);return;}
    try {
      const stored=window.localStorage.getItem(key);
      if(stored) {
        const d=JSON.parse(stored) as {name?:unknown;input?:EstimateInput;review?:boolean[]};
        if(typeof d.name==='string')setName(d.name.slice(0,140));
        if(d.input && Array.isArray(d.input.sites) && d.input.sites.length>0 && d.input.sites.length<=12) {
          const defaults=newEstimate();
          setInput({...defaults,...d.input,sites:d.input.sites.map((site,i)=>({...newSite('restored-'+i),...site,id:'restored-'+i}))});
        }
        if(Array.isArray(d.review))setReview(checklist.map((_,i)=>d.review?.[i]===true));
      }
    } catch {setNotice('Local draft was unreadable; a new draft is shown.');}
    setReady(true);
  },[key,preview]);

  const patch=(changes:Partial<EstimateInput>)=>setInput(v=>({...v,...changes}));
  const patchSite=(id:string,changes:Partial<Site>)=>setInput(v=>({...v,sites:v.sites.map(s=>s.id===id?{...s,...changes}:s)}));
  const add=()=>setInput(v=>v.sites.length>=12?v:{...v,sites:[...v.sites,{...newSite('site-'+String(Date.now())),name:'Building '+String(v.sites.length+1)}]});
  const remove=(id:string)=>setInput(v=>v.sites.length===1?v:{...v,sites:v.sites.filter(s=>s.id!==id)});
  const save=()=>{
    if(preview){setNotice('Preview mode cannot save a real draft.');return;}
    try{window.localStorage.setItem(key,JSON.stringify({name,input,review}));setNotice('Draft saved on this browser only. Nothing was written to the shared OJ database.');}
    catch{setNotice('Browser storage is unavailable; download your draft instead.');}
  };
  const reset=()=>{
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
    if(preview){setNotice('Sample preview cannot import a real company estimate.');return;}
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
        <h2>Complex properties.<br/><em>Controlled execution.</em></h2>
        <p>Develop multi-building scope, model true direct costs, and prepare an internal proposal brief. Nothing here is treated as booked, paid, or contractually approved.</p>
        <div className="com-actions">
          <button className="primary" onClick={save}><Save size={16}/> Save local draft</button>
          <button className="secondary" onClick={()=>void copy()}><ClipboardCopy size={16}/> Copy brief</button>
          <button className="secondary" onClick={download}><Download size={16}/> Export text</button>
          <button className="secondary" onClick={exportEditable}><Download size={16}/> Export editable</button>
          <button className="secondary" disabled={preview} onClick={()=>transferInput.current?.click()}><FileInput size={16}/> Import editable</button>
          <input ref={transferInput} type="file" accept=".json,application/json" hidden aria-label="Import editable commercial estimate file" onChange={e=>{
            const file=e.currentTarget.files?.[0];e.currentTarget.value='';void importEditable(file);
          }}/>
        </div>
      </div>
      <div className="com-seal" aria-hidden="true"><strong>OJ</strong><span>FIELD / OPERATIONS</span></div>
    </header>
    <div className="com-warning"><ShieldAlert size={18}/><p><b>Internal planning only.</b> This page does not create customer records, send messages, apply rates, book jobs, or execute payments. {preview?'Preview uses fictional examples.':'Local drafts are private to this browser profile, not synchronized with Jacob. Export an editable estimate file to transfer the full scope and costs securely between devices.'} Verify high-access work, equipment and insurance before issuing a client proposal.</p></div>
    <div className="com-snapshot">
      <div><span>BUILDINGS</span><strong>{estimate.sites}</strong><small>{estimate.floors} floors · {estimate.panes} panes (estimated)</small></div>
      <div><span>CREW-HOURS</span><strong>{estimate.crewHours}</strong><small>Total paid crew-hours, not elapsed hours</small></div>
      <div><span>EQUIPMENT DAYS</span><strong>{estimate.liftDays}</strong><small>Summed rental days across buildings</small></div>
      <div className="com-feature"><span>SCENARIO PRICE</span><strong>{dollars(estimate.suggestedPrice)}</strong><small>Internal calculation, not a client quote</small></div>
    </div>
    <div className="com-body">
      <div className="com-left">
        <div className="com-tabs" role="group" aria-label="Commercial desk sections">
          <button aria-pressed={tab==='scope'} onClick={()=>setTab('scope')}>01 / Property scope</button>
          <button aria-pressed={tab==='costs'} onClick={()=>setTab('costs')}>02 / Cost engineering</button>
          <button aria-pressed={tab==='records'} onClick={()=>setTab('records')}>03 / Existing leads</button>
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
  </section>;
}
