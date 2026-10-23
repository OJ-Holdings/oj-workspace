'use client';

import Link from 'next/link';
import { ArrowUpRight, ClipboardCheck, Wrench } from 'lucide-react';
import type { Card } from '@/lib/board';
import { exactLocalFleetAssetIds } from '@/lib/atlas-fleet-service-handoff';

type Props={
  id:string;org:string;base:string;cards:Card[];canEdit:boolean;
};
/**
 * Reverse link is an exact-ID TEXTUAL hint from already-authorized task rows;
 * it does not establish a canonical Fleet asset foreign key or prove service.
 */
export function AtlasFleetAssetTasks({id,org,base,cards,canEdit}:Props){
  const related=cards.filter(card=>card.organization_id===org&&card.business==='exterior'&&
    exactLocalFleetAssetIds(card.description).includes(id)).slice(0,8);
  return <section className="atlas-asset-task-links" aria-label="Shared task snapshots for this local asset">
    <header><ClipboardCheck size={14}/><strong>{related.length} explicitly related task{related.length===1?'':'s'} loaded</strong></header>
    {related.length===0&&<p>No exact-ID task references currently loaded. This does not prove there are no outstanding repairs.</p>}
    {related.map(task=><Link key={task.id} href={base+'/tasks?task='+encodeURIComponent(task.id)}>
      <span>{task.title}</span><small>{task.stage} · {task.assignee||'Unassigned'}</small><ArrowUpRight size={13}/>
    </Link>)}
    {canEdit&&<Link className="atlas-asset-task-new" href={base+'/tasks?sourceFleetAsset='+encodeURIComponent(id)}>
      <Wrench size={15}/> Prepare service task <ArrowUpRight size={13}/>
    </Link>}
    <small className="atlas-asset-task-disclaimer">Source remains browser-local. Saving a shared task does not dispatch a repair, purchase a part or certify equipment.</small>
  </section>;
}
