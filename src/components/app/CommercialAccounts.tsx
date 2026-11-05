'use client';

import {useEffect,useRef,useState,type CSSProperties} from 'react';
import {ArrowLeft,Building2,CalendarPlus,Download,ExternalLink,Mail,MapPin,PencilLine,Phone,Plus,RefreshCw,Save,UserRound,X} from 'lucide-react';
import {loadCommercialAccounts,saveCommercialAccount} from '@/app/workspace/commercial-account-actions';
import {CommercialAccountProjects} from './CommercialAccountProjects';
import {CommercialBooking,type CommercialPrefill} from './CommercialBooking';
import type {Act} from './ExteriorManage';
import type {ExtBooking} from '@/lib/exterior';
import {
 accountRhythm,accountTowns,commercialAccountMaxContacts,commercialAccountMaxProperties,initialsOf,monogramHue,
 prepareCommercialPropertyEstimate,siteDomain,townOf,validateCommercialAccountDraft,
 type CommercialAccount,type CommercialAccountDraft,type CommercialProperty,
} from '@/lib/commercial-accounts';

const empty=():CommercialAccountDraft=>({
 name:'',industry:'',website:'',notes:'',contacts:[],properties:[],
});
const recurring=(p:CommercialProperty)=>p.frequency==='monthly'||p.frequency==='quarterly'||p.frequency==='annual';
const frequencyText:Record<CommercialProperty['frequency'],string>={unknown:'No rhythm agreed','one-time':'One-time work',monthly:'Monthly',quarterly:'Quarterly',annual:'Once a year'};
const since=(iso:string)=>new Date(iso).toLocaleDateString('en-US',{month:'short',year:'numeric'});
const mapLink=(address:string)=>'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(address);
const hue=(name:string)=>({'--hue':monogramHue(name)}) as CSSProperties;
function Plate({name,size}:{name:string;size?:'lg'}){
 return <span className={'cw-plate'+(size?' cw-plate-lg':'')} style={hue(name)} aria-hidden="true"><span>{initialsOf(name)}</span></span>;
}

type Attempt={id:string;revision:number;commandId:string;draft:CommercialAccountDraft};
type Props={org:string;base:string;mode:'live'|'preview';readOnly:boolean;
 booking?:{act:Act;busy:boolean;bookings:ExtBooking[];today:string};
 onStartEstimate?:(accountId:string,accountName:string,propertyId:string,propertyName:string)=>void;
};
/** The client wall: every company that hires us, then one company's page (sites, people, notes), with the editing form behind Edit details. */
export function CommercialAccounts({org,base,mode,readOnly,booking,onStartEstimate}:Props){
 const [bookFor,setBookFor]=useState<CommercialPrefill|null>(null);
 const canEdit=mode==='live'&&!readOnly;
 const [accounts,setAccounts]=useState<CommercialAccount[]>([]);
 const [more,setMore]=useState(false);
 const [selected,setSelected]=useState<{id:string;revision:number}|null>(null);
 const [draft,setDraft]=useState<CommercialAccountDraft>(empty);
 const [dirty,setDirty]=useState(false);
 const [state,setState]=useState<'loading'|'ready'|'saving'|'offline'|'conflict'>('loading');
 const [message,setMessage]=useState('');
 const [screen,setScreen]=useState<'wall'|'company'>('wall');
 const [editing,setEditing]=useState(false);
 const pending=useRef<Attempt|null>(null);
 const loading=useRef(false);
 const open=(x:CommercialAccount)=>{
  setSelected({id:x.id,revision:x.revision});
  setDraft({name:x.name,industry:x.industry,website:x.website,notes:x.notes,
   contacts:structuredClone(x.contacts),properties:structuredClone(x.properties)});
  pending.current=null;setDirty(false);setMessage('');setState('ready');
 };
 useEffect(()=>{
  if(!canEdit){setState('offline');setMessage('Company profiles open for signed-in founders in the live workspace.');return;}
  let active=true;
  void loadCommercialAccounts(org).then(page=>{
   if(!active)return;
   setAccounts(page.accounts);setMore(page.hasMore);setState('ready');
   setDirty(false);pending.current=null;
  }).catch(e=>{
   if(!active)return;setState('offline');
   setMessage(e instanceof Error?e.message:'Company profile storage unavailable.');
  });
  return ()=>{active=false;};
 },[org,canEdit]);
 const locked=!canEdit||state==='saving'||state==='conflict'||!!pending.current;
 const edit=(next:(v:CommercialAccountDraft)=>CommercialAccountDraft)=>{
  if(locked)return;
  setDraft(old=>next(old));setDirty(true);setMessage('');
 };
 const leave=(question:string)=>!dirty||window.confirm(question);
 const select=(x:CommercialAccount)=>{
  open(x);setEditing(false);setScreen('company');
 };
 const create=()=>{
  if(!leave('Discard the current unsaved company edits?'))return;
  setSelected({id:crypto.randomUUID(),revision:0});
  setDraft(empty());pending.current=null;setDirty(false);setMessage('');setState('ready');
  setEditing(true);setScreen('company');
 };
 const recorded=selected?accounts.find(a=>a.id===selected.id):undefined;
 const backToWall=()=>{
  if(pending.current||!leave('Discard unsaved changes to this company? No shared data will be overwritten.'))return;
  if(recorded)open(recorded);else{setDirty(false);setMessage('');}
  setEditing(false);setScreen('wall');
 };
 const cancelEdit=()=>{
  if(pending.current||!leave('Discard your unsaved changes?'))return;
  if(recorded){open(recorded);setEditing(false);}else backToWall();
 };
 const addContact=()=>edit(d=>({...d,contacts:[...d.contacts,{
  id:crypto.randomUUID(),fullName:'',role:'',email:'',phone:'',
 }]}));
 const addProperty=()=>edit(d=>({...d,properties:[...d.properties,{
  id:crypto.randomUUID(),name:'',address:'',serviceNotes:'',frequency:'unknown',
 }]}));
 function startPropertyEstimate(propertyId:string){
  if(!canEdit||!selected||selected.revision===0||dirty||pending.current||state!=='ready')return;
  // Use the last confirmed shared account, not editable or unsaved form text.
  const site=recorded?.properties.find(p=>p.id===propertyId);
  if(!recorded||!site){setMessage('Save the company and property before preparing an estimate.');return;}
  if(!window.confirm('Start a new internal estimate for '+site.name+'? The current estimate editor will reset. This will NOT book a visit, create a contract, or link records automatically.'))return;
  const prepared=prepareCommercialPropertyEstimate(recorded,site.id);
  onStartEstimate?.(prepared.accountId,prepared.accountName,prepared.propertyId,prepared.propertyName);
 }
 async function perform(attempt:Attempt){
  if(loading.current)return;
  loading.current=true;setState('saving');
  try{
   const reply=await saveCommercialAccount(org,attempt.id,attempt.revision,
    attempt.commandId,attempt.draft);
   if(reply.status==='conflict'){
    pending.current=null;setState('conflict');
    setMessage('Another founder changed this account. Your local edits are still on this screen. Export them before reloading.');
    return;
   }
   const fresh=await loadCommercialAccounts(org);
   setAccounts(fresh.accounts);setMore(fresh.hasMore);
   const persisted=fresh.accounts.find(a=>a.id===attempt.id);
   if(!persisted)throw Error('Saved account could not be reloaded.');
   if(JSON.stringify(draft)===JSON.stringify(attempt.draft)){
    open(persisted);setEditing(false);
    setMessage('Saved. Both founders see these contacts and properties.');
   }else{
    pending.current=null;setState('ready');
    setSelected({id:attempt.id,revision:reply.revision});
    setMessage('Prior revision saved, but newer edits still need Save company.');
   }
  }catch(e){
   setState('offline');
   setMessage((e instanceof Error?e.message:'Company save could not be confirmed.')+
    ' Retry the original save before editing or creating another account.');
  }finally{loading.current=false;}
 }
 function save(){
  if(!canEdit||!selected||state==='saving'||state==='conflict'||pending.current)return;
  try{
   const clean=validateCommercialAccountDraft(draft);
   const a={id:selected.id,revision:selected.revision,commandId:crypto.randomUUID(),draft:clean};
   pending.current=a;void perform(a);
  }catch(e){setMessage(e instanceof Error?e.message:'Invalid company profile.');}
 }
 function download(){
  if(!selected)return;
  const data=JSON.stringify({format:'oj-commercial-account-private-recovery-v1',
   organizationId:org,accountId:selected.id,revision:selected.revision,profile:draft},null,2);
  const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;
  link.download='oj-commercial-account-private-'+selected.id.slice(0,8)+'.json';link.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),1000);
  setMessage('Private local recovery downloaded. It may contain customer contact information; store it securely.');
 }
 function refresh(){
  if(!canEdit||state==='saving'||pending.current)return;
  if(!leave('Export your unsaved changes before refreshing. Continue?'))return;
  setState('loading');
  void loadCommercialAccounts(org).then(page=>{
   setAccounts(page.accounts);setMore(page.hasMore);
   const preferred=page.accounts.find(a=>a.id===selected?.id);
   if(preferred)open(preferred);else{setScreen('wall');setEditing(false);}
   setState('ready');
  }).catch(e=>{setState('offline');setMessage(e instanceof Error?e.message:'Account list unavailable.');});
 }
 const bookAt=(p?:CommercialProperty)=>setBookFor({company:draft.name,contact:draft.contacts[0]?.fullName,phone:draft.contacts[0]?.phone,email:draft.contacts[0]?.email,address:(p??draft.properties[0])?.address});
 const canBook=!!booking&&!!selected&&selected.revision>0&&!dirty&&canEdit;

 const sites=accounts.reduce((t,a)=>t+a.properties.length,0);
 const onPlan=accounts.reduce((t,a)=>t+a.properties.filter(recurring).length,0);
 const people=accounts.reduce((t,a)=>t+a.contacts.length,0);

 const wall=<>
  <header className="cw-head">
   <div>
    <h3>The companies we work for</h3>
    <p>{accounts.length?'Open a company for its sites, people and notes, or to book the next visit.':'Add the businesses that hire us. Each one keeps its own sites and people.'}</p>
   </div>
   <div className="cw-controls">
    <button type="button" className="secondary" onClick={refresh} disabled={!canEdit||state==='saving'||!!pending.current} aria-label="Refresh companies"><RefreshCw size={15}/></button>
    <button type="button" className="primary" onClick={create} disabled={!canEdit||state==='saving'||!!pending.current}><Plus size={15}/> New company</button>
   </div>
  </header>
  {accounts.length>0&&<dl className="cw-tally">
   <div><dt>Companies</dt><dd>{accounts.length}</dd></div>
   <div><dt>Service sites</dt><dd>{sites}</dd></div>
   <div><dt>Sites on a recurring rhythm</dt><dd>{onPlan}</dd></div>
   <div><dt>People we know there</dt><dd>{people}</dd></div>
  </dl>}
  <div className="cw-grid">
   {accounts.map(a=>{
    const towns=accountTowns(a),domain=siteDomain(a.website);
    return <button type="button" key={a.id} className="cw-tile" style={hue(a.name)} onClick={()=>select(a)} disabled={state==='saving'||!!pending.current}>
     <span className="cw-tile-top">
      <Plate name={a.name}/>
      <span className="cw-tile-name"><strong>{a.name}</strong>{a.industry&&<small>{a.industry}</small>}</span>
     </span>
     {towns.length>0&&<span className="cw-tile-place"><MapPin size={13}/>{towns.slice(0,2).join(' and ')}{towns.length>2?' and more':''}</span>}
     <dl className="cw-tile-facts">
      <div><dt>Sites</dt><dd>{a.properties.length}</dd></div>
      <div><dt>People</dt><dd>{a.contacts.length}</dd></div>
      <div><dt>Rhythm</dt><dd>{accountRhythm(a)}</dd></div>
     </dl>
     <span className="cw-tile-foot"><span>On file since {since(a.createdAt)}</span>{domain&&<span>{domain}</span>}</span>
    </button>;
   })}
   {canEdit&&state!=='loading'&&<button type="button" className="cw-tile cw-tile-new" onClick={create} disabled={state==='saving'||!!pending.current}>
    <Plus size={22}/><strong>Add a company</strong><small>Name, sites and the people you deal with</small>
   </button>}
  </div>
 </>;

 const fieldsDisabled=locked;
 const form=<div className="com-account-editor">
  {!!pending.current&&<button className="secondary" type="button" disabled={state==='saving'} onClick={()=>{if(pending.current)void perform(pending.current);}}>Retry original save</button>}
  {(dirty||state==='conflict')&&<button type="button" className="secondary cw-export" onClick={download}><Download size={15}/> Export unsaved copy</button>}
  <div className="com-account-fields">
   <label>Company name<input maxLength={160} value={draft.name} disabled={fieldsDisabled}
    onChange={e=>edit(d=>({...d,name:e.target.value}))} placeholder="Company or property management group"/></label>
   <label>Industry<input maxLength={80} value={draft.industry} disabled={fieldsDisabled}
    onChange={e=>edit(d=>({...d,industry:e.target.value}))} placeholder="Industrial, multifamily, commercial"/></label>
   <label>Website<input maxLength={240} value={draft.website} disabled={fieldsDisabled}
    onChange={e=>edit(d=>({...d,website:e.target.value}))} placeholder="americanroller.com"/></label>
   <label>Relationship notes<textarea rows={2} maxLength={2000} value={draft.notes} disabled={fieldsDisabled}
    onChange={e=>edit(d=>({...d,notes:e.target.value}))} placeholder="Billing, preferences, next step"/></label>
  </div>
  <div className="com-account-subhead"><h4><UserRound size={17}/> People</h4>
   <button type="button" className="secondary" disabled={fieldsDisabled||draft.contacts.length>=commercialAccountMaxContacts} onClick={addContact}><Plus size={15}/> Add person</button>
  </div>
  {draft.contacts.map((c,index)=><fieldset key={c.id} className="com-account-entry"><legend>Person {index+1}</legend>
   <div className="com-account-fields">
    {([['fullName','Name',120,'text'],['role','Role',80,'text'],['email','Email',180,'email'],['phone','Phone',60,'tel']] as const).map(([field,label,max,type])=>
     <label key={field}>{label}<input type={type} maxLength={max} value={c[field]} disabled={fieldsDisabled}
      onChange={e=>edit(d=>({...d,contacts:d.contacts.map(v=>v.id===c.id?{...v,[field]:e.target.value}:v)}))}/></label>)}
   </div>
   <button type="button" className="cw-remove" disabled={fieldsDisabled} onClick={()=>edit(d=>({...d,contacts:d.contacts.filter(v=>v.id!==c.id)}))}><X size={13}/> Remove person</button>
  </fieldset>)}
  <div className="com-account-subhead"><h4><MapPin size={17}/> Sites</h4>
   <button type="button" className="secondary" disabled={fieldsDisabled||draft.properties.length>=commercialAccountMaxProperties} onClick={addProperty}><Plus size={15}/> Add site</button>
  </div>
  {draft.properties.map((p,index)=><fieldset key={p.id} className="com-account-entry"><legend>Site {index+1}</legend>
   <div className="com-account-fields">
    <label>Location name<input maxLength={120} value={p.name} disabled={fieldsDisabled}
     onChange={e=>edit(d=>({...d,properties:d.properties.map(v=>v.id===p.id?{...v,name:e.target.value}:v)}))}/></label>
    <label>Address<input maxLength={300} value={p.address} disabled={fieldsDisabled} autoComplete="street-address"
     onChange={e=>edit(d=>({...d,properties:d.properties.map(v=>v.id===p.id?{...v,address:e.target.value}:v)}))}/></label>
    <label>Service rhythm<select value={p.frequency} disabled={fieldsDisabled}
     onChange={e=>edit(d=>({...d,properties:d.properties.map(v=>v.id===p.id?{...v,frequency:e.target.value as typeof v.frequency}:v)}))}>
     <option value="unknown">Not agreed</option><option value="one-time">One-time</option><option value="monthly">Monthly</option>
     <option value="quarterly">Quarterly</option><option value="annual">Once a year</option>
    </select></label>
    <label>Crew notes for this site<textarea rows={2} maxLength={2000} value={p.serviceNotes} disabled={fieldsDisabled}
     onChange={e=>edit(d=>({...d,properties:d.properties.map(v=>v.id===p.id?{...v,serviceNotes:e.target.value}:v)}))}/></label>
   </div>
   <button type="button" className="cw-remove" disabled={fieldsDisabled} onClick={()=>edit(d=>({...d,properties:d.properties.filter(v=>v.id!==p.id)}))}><X size={13}/> Remove site</button>
  </fieldset>)}
 </div>;

 const savedSite=(id:string)=>!!recorded?.properties.some(s=>s.id===id);
 const readout=<div className="cw-body">
  <section className="cw-sites" aria-label="Sites">
   <h4><MapPin size={16}/> Sites</h4>
   {!draft.properties.length&&<p className="cw-empty">No sites yet. Use Edit details to add where you work for them.</p>}
   {draft.properties.map(p=><article key={p.id} className="cw-site">
    <header>
     <strong>{p.name}</strong>
     <span className={'cw-rhythm'+(recurring(p)?' is-recurring':'')}>{frequencyText[p.frequency]}</span>
    </header>
    {p.address?<a className="cw-address" href={mapLink(p.address)} target="_blank" rel="noreferrer"><MapPin size={13}/>{p.address}<ExternalLink size={12}/></a>
     :<p className="cw-empty">No address saved.</p>}
    {p.serviceNotes&&<p className="cw-crew-note"><b>Crew note</b>{p.serviceNotes}</p>}
    <div className="cw-site-actions">
     {canBook&&<button type="button" className="secondary" onClick={()=>bookAt(p)}><CalendarPlus size={14}/> Book here</button>}
     {onStartEstimate&&savedSite(p.id)&&<button type="button" className="secondary" disabled={!canEdit||dirty||state!=='ready'||!!pending.current}
      onClick={()=>startPropertyEstimate(p.id)}><Building2 size={14}/> Start estimate</button>}
    </div>
   </article>)}
  </section>
  <aside className="cw-side">
   <section aria-label="People">
    <h4><UserRound size={16}/> People</h4>
    {!draft.contacts.length&&<p className="cw-empty">Nobody saved yet.</p>}
    {draft.contacts.map(c=><article key={c.id} className="cw-person">
     <span className="cw-person-mark" aria-hidden="true">{initialsOf(c.fullName)}</span>
     <div>
      <strong>{c.fullName}</strong>
      <small>{c.role||'Role not saved'}</small>
      <span className="cw-person-links">
       {c.phone?<a href={'tel:'+c.phone.replace(/[^\d+]/g,'')}><Phone size={13}/>{c.phone}</a>:<em>No phone saved</em>}
       {c.email?<a href={'mailto:'+c.email}><Mail size={13}/>{c.email}</a>:<em>No email saved</em>}
      </span>
     </div>
    </article>)}
   </section>
   {draft.notes&&<section aria-label="Relationship notes" className="cw-notes">
    <h4>Notes</h4>
    <p>{draft.notes}</p>
   </section>}
  </aside>
 </div>;

 const domain=siteDomain(draft.website),towns=accountTowns(draft);
 const company=selected&&<>
  <button type="button" className="cw-back" onClick={backToWall} disabled={!!pending.current}><ArrowLeft size={15}/> All companies</button>
  <header className="cw-hero" style={hue(draft.name||'OJ')} key={selected.id}>
   <Plate name={draft.name||'OJ'} size="lg"/>
   <div className="cw-hero-text">
    <h3>{draft.name||'New company'}</h3>
    <p>{[draft.industry,towns.join(' and ')].filter(Boolean).join(', ')||(selected.revision===0?'Fill in the details below and save.':'')}</p>
    <span className="cw-hero-meta">
     {recorded&&<span>On file since {since(recorded.createdAt)}</span>}
     {domain&&<a href={'https://'+domain} target="_blank" rel="noreferrer">{domain}<ExternalLink size={12}/></a>}
     {dirty&&<span className="cw-unsaved">Unsaved edits</span>}
    </span>
   </div>
   <div className="cw-hero-actions">
    {editing?<>
     {selected.revision>0&&<button type="button" className="secondary" onClick={cancelEdit} disabled={!!pending.current||state==='saving'}>Cancel</button>}
     <button type="button" className="primary" disabled={locked} onClick={save}><Save size={15}/> {state==='saving'?'Saving':'Save company'}</button>
    </>:<>
     {canEdit&&<button type="button" className="secondary" onClick={()=>setEditing(true)} disabled={locked}><PencilLine size={15}/> Edit details</button>}
     {canBook&&<button type="button" className="primary" onClick={()=>bookAt()}><CalendarPlus size={15}/> Book visit</button>}
    </>}
   </div>
  </header>
  {!editing&&<dl className="cw-tally cw-tally-company">
   <div><dt>Sites</dt><dd>{draft.properties.length}</dd></div>
   <div><dt>On a recurring rhythm</dt><dd>{draft.properties.filter(recurring).length}</dd></div>
   <div><dt>People</dt><dd>{draft.contacts.length}</dd></div>
   <div><dt>Rhythm</dt><dd className="cw-small">{accountRhythm(draft)}</dd></div>
  </dl>}
  {editing?form:readout}
  {!editing&&selected.revision>0&&<CommercialAccountProjects org={org} accountId={selected.id} base={base} properties={recorded?.properties??[]}/>}
 </>;

 return <section className="com-account-app cw" aria-label="Commercial clients">
  {more&&<p role="status" className="com-account-notice">Showing the 50 most recently updated companies. Older profiles are kept.</p>}
  {state==='loading'&&<p role="status" className="cw-loading">Loading companies</p>}
  {message&&<p className="com-account-notice" role="status">{message}</p>}
  {screen==='company'&&company?company:wall}
  {booking&&<CommercialBooking open={bookFor!==null} close={()=>setBookFor(null)} act={booking.act} busy={booking.busy} org={org} bookings={booking.bookings} today={booking.today} prefill={bookFor}/>}
 </section>;
}
