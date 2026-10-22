'use client';

import Link from 'next/link';
import { ArrowUpRight, GitBranch, ShieldCheck } from 'lucide-react';
import type { Card } from '@/lib/board';
import type { Dashboard, Lead } from '@/lib/dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { explicitCrmLeadIds } from '@/lib/operating-network';
import { exactBookingReferences } from '@/lib/operating-handoffs';
import { linkedSourcesForTask, linkedTasksForLead } from '@/lib/atlas-relations';

export function AtlasLeadRelations({lead,cards,base}:{lead:Pick<Lead,'id'|'venture'>;cards:Card[];base:string}){
  const matches=linkedTasksForLead(lead,cards);
  return <section className="atlas-relations-panel" aria-label="Verified related tasks">
    <header><GitBranch size={17}/><span><strong>Connected workspace activity</strong><small>Exact source ID · same business</small></span><b>{matches.length}</b></header>
    {matches.length?<ul>{matches.map(task=><li key={task.id}>
      <Link href={base+task.href}><span><b>{task.title}</b><small>{task.stage} · {task.assignee||'Unassigned'}{task.due?' · Due '+task.due:''}</small></span><ArrowUpRight size={16}/></Link>
    </li>)}</ul>:<p>No tasks in the loaded workspace board explicitly reference this CRM record ID. Work done elsewhere is not represented here.</p>}
    <div className="atlas-relations-trust"><ShieldCheck size={13}/> Never matched by a customer's name, phone or address.</div>
  </section>;
}

export function AtlasTaskRelations({card,dashboard,jobs,base,onNavigate}:{
  card:Card;dashboard:Dashboard|null;jobs:JobItem[];base:string;onNavigate:()=>boolean;
}){
  const crmRefs=explicitCrmLeadIds(card.description);
  const bookingRefs=exactBookingReferences(card.description);
  if(!crmRefs.length&&!bookingRefs.length)return null;
  const sources=linkedSourcesForTask(card,dashboard,jobs);
  return <section className="atlas-relations-panel" aria-label="Verified task source records">
    <header><GitBranch size={17}/><span><strong>Source relationships</strong><small>Linked only when the exact source was loaded</small></span><b>{sources.length}</b></header>
    {sources.length?<ul>{sources.map(source=><li key={source.kind+':'+source.id}>
      <Link href={base+source.href} onClick={e=>{if(!onNavigate())e.preventDefault()}}>
        <span><b>{source.title}</b><small>{source.detail}</small></span><ArrowUpRight size={16}/></Link>
    </li>)}</ul>:<p>Source identifiers were supplied, but no matching authorized source record was loaded. Do not assume a relationship is verified.</p>}
    <div className="atlas-relations-trust"><ShieldCheck size={13}/> Task text alone is not proof of a customer match, booking completion, invoice or payment.</div>
  </section>;
}
