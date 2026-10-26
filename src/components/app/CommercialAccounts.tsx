'use client';

import {useEffect,useRef,useState} from 'react';
import {Building2,Download,MapPin,Plus,RefreshCw,Save,UserRound} from 'lucide-react';
import {loadCommercialAccounts,saveCommercialAccount} from '@/app/workspace/commercial-account-actions';
import {CommercialAccountProjects} from './CommercialAccountProjects';
import {
 commercialAccountMaxContacts,commercialAccountMaxProperties,
 validateCommercialAccountDraft,type CommercialAccount,type CommercialAccountDraft,
} from '@/lib/commercial-accounts';

const empty=():CommercialAccountDraft=>({
 name:'',industry:'',website:'',notes:'',contacts:[],properties:[],
});
type Attempt={id:string;revision:number;commandId:string;draft:CommercialAccountDraft};
type Props={org:string;base:string;mode:'live'|'preview';readOnly:boolean;
 onStartEstimate:(accountId:string,accountName:string,propertyId:string,propertyName:string)=>void;
};
export function CommercialAccounts({org,base,mode,readOnly,onStartEstimate}:Props){
 const canEdit=mode==='live'&&!readOnly;
 const [accounts,setAccounts]=useState<CommercialAccount[]>([]);
 const [more,setMore]=useState(false);
 const [selected,setSelected]=useState<{id:string;revision:number}|null>(null);
 const [draft,setDraft]=useState<CommercialAccountDraft>(empty);
 const [dirty,setDirty]=useState(false);
 const [state,setState]=useState<'loading'|'ready'|'saving'|'offline'|'conflict'>('loading');
 const [message,setMessage]=useState('');
 const pending=useRef<Attempt|null>(null);
 const loading=useRef(false);
 const open=(x:CommercialAccount)=>{
  setSelected({id:x.id,revision:x.revision});
  setDraft({name:x.name,industry:x.industry,website:x.website,notes:x.notes,
   contacts:structuredClone(x.contacts),properties:structuredClone(x.properties)});
  pending.current=null;setDirty(false);setMessage('');setState('ready');
 };
 useEffect(()=>{
  if(!canEdit){setState('offline');setMessage('Company profiles require an authorized editor.');return;}
  let active=true;
  void loadCommercialAccounts(org).then(page=>{
   if(!active)return;
   setAccounts(page.accounts);setMore(page.hasMore);setState('ready');
   if(page.accounts.length){
    const x=page.accounts[0];
    setSelected({id:x.id,revision:x.revision});
    setDraft({name:x.name,industry:x.industry,website:x.website,notes:x.notes,
     contacts:structuredClone(x.contacts),properties:structuredClone(x.properties)});
   }else{
    setSelected({id:crypto.randomUUID(),revision:0});setDraft(empty());
   }
   setDirty(false);pending.current=null;
  }).catch(e=>{
   if(!active)return;setState('offline');
   setMessage(e instanceof Error?e.message:'Company profile storage unavailable.');
  });
  return ()=>{active=false;};
 },[org,canEdit]);
 const edit=(next:(v:CommercialAccountDraft)=>CommercialAccountDraft)=>{
  if(!canEdit||state==='saving'||state==='conflict'||pending.current)return;
  setDraft(old=>next(old));setDirty(true);setMessage('');
 };
 const select=(x:CommercialAccount)=>{
  if(dirty&&!window.confirm('Discard unsaved changes to this company? No shared data will be overwritten.'))return;
  open(x);
 };
 const create=()=>{
  if(dirty&&!window.confirm('Discard the current unsaved company edits?'))return;
  setSelected({id:crypto.randomUUID(),revision:0});
  setDraft(empty());pending.current=null;setDirty(false);setMessage('');setState('ready');
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
  const recorded=accounts.find(a=>a.id===selected.id);
  const site=recorded?.properties.find(p=>p.id===propertyId);
  if(!recorded||!site){setMessage('Save the company and property before preparing an estimate.');return;}
  if(!window.confirm('Start a new internal estimate for '+site.name+'? The current estimate editor will reset. This will NOT book a visit, create a contract, or link records automatically.'))return;
  onStartEstimate(recorded.id,recorded.name,site.id,site.name);
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
    open(persisted);
    setMessage('Saved to company. Authorized founders can open these contacts and properties.');
   }else{
    pending.current=null;setState('ready');
    setSelected({id:attempt.id,revision:reply.revision});
    setMessage('Prior revision saved, but newer edits still require Save to company.');
   }
  }catch(e){
   setState('offline');
   setMessage((e instanceof Error?e.message:'Company save could not be confirmed.')+
    ' Retry the original save command before editing or creating another account.');
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
  if(dirty&&!window.confirm('Export your unsaved changes before refreshing. Continue?'))return;
  setState('loading');
  void loadCommercialAccounts(org).then(page=>{
   setAccounts(page.accounts);setMore(page.hasMore);
   const preferred=page.accounts.find(a=>a.id===selected?.id)??page.accounts[0];
   if(preferred)open(preferred);else create();
   setState('ready');
  }).catch(e=>{setState('offline');setMessage(e instanceof Error?e.message:'Account list unavailable.');});
 }
 return <section className="com-account-app" aria-label="Commercial Accounts">
  <header className="com-account-head">
   <div><p className="exec-kicker">COMMERCIAL RELATIONSHIPS</p>
    <h3>Companies &amp; properties</h3>
    <p>One client, multiple service properties and real contacts. No records are matched by a guessed address or company name.</p>
   </div>
   <div className="com-account-controls">
    <button type="button" className="secondary" onClick={refresh} disabled={!canEdit||state==='saving'||!!pending.current}><RefreshCw size={15}/> Refresh</button>
    <button type="button" className="secondary" onClick={create} disabled={!canEdit||state==='saving'||!!pending.current}><Plus size={15}/> New company</button>
   </div>
  </header>
  {more&&<p role="status" className="com-account-notice">Showing the 50 most recently updated accounts. Older profiles are preserved; paging will be added before larger rollouts.</p>}
  {state==='loading'&&<p role="status">Loading authorized company accounts…</p>}
  {message&&<p className="com-account-notice" role="status">{message}</p>}
  {mode==='preview'&&<p className="com-account-notice">Live company records are not included in fictional preview mode.</p>}
  {selected&&<div className="com-account-layout">
   <aside className="com-account-list" aria-label="Commercial company directory">
    {accounts.map(a=><button type="button" key={a.id} aria-pressed={selected.id===a.id}
      onClick={()=>select(a)} disabled={state==='saving'||!!pending.current}>
      <span className="com-account-monogram" aria-hidden="true">{a.name.slice(0,2).toUpperCase()}</span>
      <span><strong>{a.name}</strong><small>{a.properties.length} properties · {a.contacts.length} contacts</small></span>
    </button>)}
    {!accounts.length&&<p>No company profiles have been saved yet.</p>}
   </aside>
   <div className="com-account-editor">
    <div className="com-account-editor-head">
     <span className="com-account-monogram" aria-hidden="true">{draft.name.trim().slice(0,2).toUpperCase()||'OJ'}</span>
     <div><strong>{draft.name||'New company'}</strong><small>{selected.revision===0?'Unsaved company':`Company revision ${selected.revision}`}{dirty?' · Unsaved edits':''}</small></div>
     <button type="button" className="primary" disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current} onClick={save}><Save size={15}/> Save company</button>
    </div>
    {!!pending.current&&<button className="secondary" type="button" disabled={state==='saving'} onClick={()=>{if(pending.current)void perform(pending.current);}}>Retry original save</button>}
    {(dirty||state==='conflict')&&<button type="button" className="secondary" onClick={download}><Download size={15}/> Export unsaved copy</button>}
    <div className="com-account-fields">
     <label>Company name<input maxLength={160} value={draft.name} disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current}
      onChange={e=>edit(d=>({...d,name:e.target.value}))} placeholder="Company or property management group"/></label>
     <label>Industry<input maxLength={80} value={draft.industry} disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current}
      onChange={e=>edit(d=>({...d,industry:e.target.value}))} placeholder="Industrial, multifamily, commercial…"/></label>
     <label>Website<input maxLength={240} value={draft.website} disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current}
      onChange={e=>edit(d=>({...d,website:e.target.value}))} placeholder="Optional company website"/></label>
     <label>Relationship notes<textarea rows={2} maxLength={2000} value={draft.notes} disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current}
      onChange={e=>edit(d=>({...d,notes:e.target.value}))} placeholder="Billing contacts, preferences, next step…"/></label>
    </div>
    <div className="com-account-subhead"><h4><UserRound size={17}/> Contacts</h4>
     <button type="button" className="secondary" disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current||draft.contacts.length>=commercialAccountMaxContacts} onClick={addContact}><Plus size={15}/> Add contact</button>
    </div>
    {draft.contacts.map((c,index)=><fieldset key={c.id} className="com-account-entry"><legend>Contact {index+1}</legend>
     <div className="com-account-fields">
      {([['fullName','Name',120],['role','Role',80],['email','Email',180],['phone','Phone',60]] as const).map(([field,label,max])=>
       <label key={field}>{label}<input maxLength={max} value={c[field]} disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current}
        onChange={e=>edit(d=>({...d,contacts:d.contacts.map(v=>v.id===c.id?{...v,[field]:e.target.value}:v)}))}/></label>)}
     </div>
    </fieldset>)}
    <div className="com-account-subhead"><h4><MapPin size={17}/> Service properties</h4>
     <button type="button" className="secondary" disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current||draft.properties.length>=commercialAccountMaxProperties} onClick={addProperty}><Plus size={15}/> Add property</button>
    </div>
    {draft.properties.map((p,index)=><fieldset key={p.id} className="com-account-entry"><legend>Property {index+1}</legend>
     <div className="com-account-fields">
      <label>Location name<input maxLength={120} value={p.name} disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current}
       onChange={e=>edit(d=>({...d,properties:d.properties.map(v=>v.id===p.id?{...v,name:e.target.value}:v)}))}/></label>
      <label>Address<input maxLength={300} value={p.address} disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current}
       onChange={e=>edit(d=>({...d,properties:d.properties.map(v=>v.id===p.id?{...v,address:e.target.value}:v)}))}/></label>
      <label>Service frequency<select value={p.frequency} disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current}
       onChange={e=>edit(d=>({...d,properties:d.properties.map(v=>v.id===p.id?{...v,frequency:e.target.value as typeof v.frequency}:v)}))}>
       <option value="unknown">Not agreed</option><option value="one-time">One-time</option><option value="monthly">Monthly</option>
       <option value="quarterly">Quarterly</option><option value="annual">Annual</option>
      </select></label>
      <label>Site notes<textarea rows={2} maxLength={2000} value={p.serviceNotes} disabled={!canEdit||state==='saving'||state==='conflict'||!!pending.current}
       onChange={e=>edit(d=>({...d,properties:d.properties.map(v=>v.id===p.id?{...v,serviceNotes:e.target.value}:v)}))}/></label>
     </div>
     <div className="com-account-property-action">
      <span>{p.frequency==='unknown'?'No service frequency has been agreed.':p.frequency==='one-time'?'One-time service interest — not a scheduled job.':p.frequency+' service interest — not an active recurring agreement.'}</span>
      {selected.revision>0&&<button type="button" className="secondary"
       disabled={!canEdit||dirty||state!=='ready'||!!pending.current
        ||!accounts.find(a=>a.id===selected.id)?.properties.some(saved=>saved.id===p.id)}
       onClick={()=>startPropertyEstimate(p.id)}>
       <Building2 size={14}/> Start estimate for this saved property
      </button>}
     </div>
    </fieldset>)}
    {selected.revision>0&&<CommercialAccountProjects org={org} accountId={selected.id} base={base}
      properties={accounts.find(a=>a.id===selected.id)?.properties??[]}/>}
    <p className="com-account-foot"><Building2 size={14}/> Company initials are used until protected logo uploads are enabled. Contacts and properties do not send messages, schedule work or issue invoices.</p>
   </div>
  </div>}
 </section>;
}
