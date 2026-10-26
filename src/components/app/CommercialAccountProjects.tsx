'use client';

import Link from 'next/link';
import {useEffect,useState} from 'react';
import {ArrowUpRight,RefreshCw} from 'lucide-react';
import {listCommercialAccountProjects} from '@/app/workspace/commercial-project-link-actions';
import type {CommercialLinkedProject} from '@/lib/commercial-project-links';
import type {CommercialProperty} from '@/lib/commercial-accounts';

export function CommercialAccountProjects({org,accountId,base,properties}:{
 org:string;accountId:string;base:string;properties:CommercialProperty[];
}){
 const [projects,setProjects]=useState<CommercialLinkedProject[]>([]);
 const [state,setState]=useState<'loading'|'ready'|'offline'>('loading');
 const [error,setError]=useState('');
 const [more,setMore]=useState(false);
 const [refresh,setRefresh]=useState(0);
 const recurringInterest=properties.filter(p=>p.frequency==='monthly'||p.frequency==='quarterly'||p.frequency==='annual').length;
 const propertyById=new Map(properties.map(p=>[p.id,p]));
 useEffect(()=>{
  let active=true;
  setState('loading');setProjects([]);setError('');
  void listCommercialAccountProjects(org,accountId).then(page=>{
   if(!active)return;setProjects(page.projects);setMore(page.hasMore);setState('ready');
  }).catch(e=>{
   if(!active)return;setState('offline');setError(e instanceof Error?e.message:'Project links unavailable.');
  });
  return ()=>{active=false;};
 },[org,accountId,refresh]);
 return <section className="com-account-linked-projects" aria-label="Saved projects explicitly linked to this company">
  <header><div><strong>Linked commercial projects</strong>
   <p>Only exact projects intentionally attached to this company. Estimates are not signed contracts or invoices.</p></div>
   <button type="button" className="secondary" disabled={state==='loading'} onClick={()=>setRefresh(v=>v+1)}>
    <RefreshCw size={14}/> Refresh</button>
  </header>
  {state==='loading'&&<p role="status">Checking saved project associations…</p>}
  {state==='offline'&&<p role="alert">{error}</p>}
  {state==='ready'&&<div className="com-account-service-overview" role="status">
   <span><strong>{properties.length}</strong> Saved properties</span>
   <span><strong>{recurringInterest}</strong> Recurring-service interests</span>
   <span><strong>{projects.length}</strong> Loaded linked projects</span>
  </div>}
  {recurringInterest>0&&<p>Requested or proposed frequencies are planning notes only. They do not establish a signed agreement, future booking, or collectible revenue.</p>}
  {state==='ready'&&projects.length===0&&<p>No projects explicitly linked. Existing estimates are preserved in Commercial Projects.</p>}
  {projects.map(p=><Link key={p.projectId}
   href={base+'/b/exterior/projects?project='+encodeURIComponent(p.projectId)}>
   <span><strong>{p.title}</strong><small>{p.phase.replaceAll('-',' ')} · {propertyById.get(p.propertyId)?.name??'Property record unavailable'} · not a signed contract</small></span>
   <ArrowUpRight size={15}/>
  </Link>)}
  {more&&<p role="status">Only the first 100 associations are displayed. Additional links have not been loaded.</p>}
 </section>;
}
