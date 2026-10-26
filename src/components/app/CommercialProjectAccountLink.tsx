'use client';

import {useEffect,useRef,useState} from 'react';
import {Building2,Link2,RefreshCw} from 'lucide-react';
import {loadCommercialAccounts} from '@/app/workspace/commercial-account-actions';
import {loadCommercialProjectLink,saveCommercialProjectLink} from '@/app/workspace/commercial-project-link-actions';
import type {CommercialAccount} from '@/lib/commercial-accounts';
import type {CommercialProjectLink} from '@/lib/commercial-project-links';

type Attempt={id:string;expected:number;command:string;accountId:string|null;propertyId:string|null};
type Props={org:string;projectId:string|null;projectSaved:boolean};

export function CommercialProjectAccountLink({org,projectId,projectSaved}:Props){
 const [accounts,setAccounts]=useState<CommercialAccount[]>([]);
 const [current,setCurrent]=useState<CommercialProjectLink|null>(null);
 const [accountId,setAccountId]=useState('');
 const [propertyId,setPropertyId]=useState('');
 const [state,setState]=useState<'loading'|'ready'|'saving'|'conflict'|'offline'>('loading');
 const [message,setMessage]=useState('');
 const [refreshKey,setRefreshKey]=useState(0);
 const pending=useRef<Attempt|null>(null);
 const lock=useRef(false);
 const activeAccount=accounts.find(x=>x.id===accountId);
 const changed=(current?.accountId??'')!==accountId||(current?.propertyId??'')!==propertyId;
 useEffect(()=>{
  pending.current=null;lock.current=false;setAccounts([]);setCurrent(null);setAccountId('');setPropertyId('');
  setMessage('');setState('loading');
  if(!projectSaved||!projectId){setState('ready');return;}
  let active=true;
  void Promise.all([loadCommercialAccounts(org),loadCommercialProjectLink(org,projectId)]).then(([page,link])=>{
   if(!active)return;
   setAccounts(page.accounts);
   setCurrent(link);setAccountId(link?.accountId??'');setPropertyId(link?.propertyId??'');
   setState('ready');
   if(page.hasMore)setMessage('Only the 50 newest companies are shown. Older company links are protected until the full company directory is loaded.');
  }).catch(e=>{
   if(!active)return;
   setState('offline');setMessage(e instanceof Error?e.message:'Company linking unavailable.');
  });
  return ()=>{active=false;};
 },[org,projectId,projectSaved,refreshKey]);
 async function perform(attempt:Attempt){
  if(lock.current)return;
  lock.current=true;setState('saving');
  try{
   const result=await saveCommercialProjectLink(org,attempt.id,attempt.expected,
     attempt.command,attempt.accountId,attempt.propertyId);
   if(result.status==='conflict'){
    pending.current=null;setState('conflict');
    setMessage('Another founder changed this link. Your selected company/property remain visible; compare before refreshing.');
    return;
   }
   const stored=await loadCommercialProjectLink(org,attempt.id);
   pending.current=null;setCurrent(stored);
   if(stored?.accountId===(accountId||null)&&stored?.propertyId===(propertyId||null)){
    setState('ready');setMessage('Explicit company/property association saved for this existing shared project.');
   }else{
    setState('conflict');setMessage('A saved link differs from current selection. Review both copies before continuing.');
   }
  }catch(e){
   setState('offline');
   setMessage((e instanceof Error?e.message:'Link save unconfirmed.')+' Retry the ORIGINAL command before changing the link.');
  }finally{lock.current=false;}
 }
 function saveLink(){
  if(!projectId||!projectSaved||pending.current||state!=='ready'||!changed)return;
  if((!accountId)!==(!propertyId)){setMessage('Choose a saved company and one of its exact properties.');return;}
  if(accountId&&(!activeAccount||!activeAccount.properties.some(p=>p.id===propertyId))){
   setMessage('That property is not in this loaded company. Nothing saved.');return;
  }
  if(!accountId&&!window.confirm('Unlink this project from its company and property? Original project and estimate revisions will remain unchanged.'))return;
  const attempt={id:projectId,expected:current?.revision??0,command:crypto.randomUUID(),
   accountId:accountId||null,propertyId:propertyId||null};
  pending.current=attempt;void perform(attempt);
 }
 function reload(){
  if(pending.current||state==='saving')return;
  if(changed&&!window.confirm('Discard the unsaved company/property selection and reload the saved link?'))return;
  setRefreshKey(v=>v+1);
 }
 return <section className="atlas-project-company-link" aria-label="Explicit linked commercial account">
  <header><div><small>ACCOUNT RELATIONSHIP · U2B</small><h4><Link2 size={17}/> Link company and property</h4>
   <p>Attach an existing saved commercial project to exactly one saved company property. This does not change the estimate, book a visit, or approve a contract.</p></div>
   <button type="button" className="secondary" onClick={reload} disabled={!projectSaved||!!pending.current||state==='saving'}>
    <RefreshCw size={14}/> Refresh link</button>
  </header>
  {!projectSaved||!projectId?
   <p>Save this commercial project in Supabase first. Unsaved local scenarios cannot claim a company relationship.</p>:
   <div className="atlas-project-company-controls">
    <label>Company
     <select value={accountId} onChange={e=>{setAccountId(e.target.value);setPropertyId('');setMessage('');}}
      disabled={state==='loading'||state==='saving'||state==='conflict'||!!pending.current}>
      <option value="">No linked company</option>
      {accountId&&!accounts.some(a=>a.id===accountId)&&<option value={accountId}>Previously linked company (not in loaded page)</option>}
      {accounts.map(a=><option key={a.id} value={a.id}>{a.name}</option>)}
     </select>
    </label>
    <label>Exact service property
     <select value={propertyId} onChange={e=>{setPropertyId(e.target.value);setMessage('');}}
      disabled={!accountId||!activeAccount||state==='loading'||state==='saving'||state==='conflict'||!!pending.current}>
      <option value="">Select a property</option>
      {propertyId&&activeAccount&&!activeAccount.properties.some(p=>p.id===propertyId)&&<option value={propertyId}>Previously linked property (not loaded)</option>}
      {activeAccount?.properties.map(p=><option key={p.id} value={p.id}>{p.name}{p.address?' · '+p.address:''}</option>)}
     </select>
    </label>
    <button type="button" className="primary" onClick={saveLink}
     disabled={!changed||state!=='ready'||!!pending.current||!!accountId!==!!propertyId||
      (!!accountId&&(!activeAccount||!activeAccount.properties.some(p=>p.id===propertyId)))}>
      <Building2 size={15}/> Save company link
    </button>
    {pending.current&&<button type="button" className="secondary" disabled={state==='saving'}
     onClick={()=>{if(pending.current)void perform(pending.current);}}>Retry original link save</button>}
   </div>}
  {projectSaved&&<p role="status" className="atlas-project-hint">{state==='loading'?'Checking company records…':
   current?.accountId&&current.propertyId?`Shared association revision ${current.revision} · exact property ID stored`:
   current?`Shared association revision ${current.revision} · currently unlinked`:
   'No shared company/property association recorded'}.
   {changed?' Unsaved selection on this device.':''}</p>}
  {message&&<p role="status" className="atlas-project-hint">{message}</p>}
 </section>;
}
