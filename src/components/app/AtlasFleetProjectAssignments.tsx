'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Boxes, ShieldAlert } from 'lucide-react';
import type { FleetWorkbook } from '@/lib/fleet-command';
import { decodeCommercialPortfolio, projectEquipmentEvidence, type CommercialPortfolio } from '@/lib/atlas-commercial-portfolio';

type Props={
  org:string;base:string;mode:'live'|'preview';readOnly:boolean;
  fleet:FleetWorkbook;day:string;
};

/** A read-only projection of local commercial resource candidates. NO asset
 * lock or booking/dispatch assertion; source bookings aren't loaded here.
 */
export function AtlasFleetProjectAssignments({org,base,mode,readOnly,fleet,day}:Props){
  const enabled=mode==='live'&&!readOnly;
  const key='oj-commercial-project-portfolio-v1:'+org;
  const [portfolio,setPortfolio]=useState<CommercialPortfolio|null>(null);
  const [state,setState]=useState<'loading'|'missing'|'valid'|'invalid'>('loading');
  const [error,setError]=useState('');
  useEffect(()=>{
    setPortfolio(null);setState('loading');setError('');
    if(!enabled){setState('missing');return;}
    const refresh=()=>{
      try{
        const raw=window.localStorage.getItem(key);
        if(!raw){setPortfolio(null);setState('missing');return;}
        setPortfolio(decodeCommercialPortfolio(raw,org));setState('valid');setError('');
      }catch(e){
        setPortfolio(null);setState('invalid');
        setError(e instanceof Error?e.message:'Commercial portfolio could not be validated.');
      }
    };
    refresh();
    const onStorage=(event:StorageEvent)=>{if(event.key===key||event.key===null)refresh();};
    window.addEventListener('storage',onStorage);window.addEventListener('focus',refresh);
    return ()=>{window.removeEventListener('storage',onStorage);window.removeEventListener('focus',refresh);};
  },[key,org,enabled]);

  const active=portfolio?.projects.filter(p=>p.phase!=='archived')??[];
  const withEquipment=active.filter(p=>p.plannedAssetIds.length>0);
  const uniqueIds=new Set(active.flatMap(p=>p.plannedAssetIds));
  const repeated=[...uniqueIds].filter(id=>active.filter(p=>p.plannedAssetIds.includes(id)).length>1);
  return <section className="atlas-fleet-project-link" aria-label="Commercial candidate asset allocations">
    <header><div><small>ATLAS / FIELD RESOURCE PLANNING</small><h3>Commercial allocation radar</h3><p>Candidate equipment assignments from this browser’s private commercial project portfolio. No reservations, dispatch orders or confirmed schedules.</p></div>
      <Link href={base+'/b/exterior/commercial'}>Open commercial projects <ArrowUpRight size={15}/></Link>
    </header>
    {!enabled&&<p>Private project allocations are hidden in read-only and preview sessions.</p>}
    {enabled&&state==='loading'&&<p>Checking local commercial project portfolio…</p>}
    {enabled&&state==='missing'&&<p>No local commercial portfolio on this device. Open Commercial Estimating to save project-level candidate equipment assignments.</p>}
    {enabled&&state==='invalid'&&<p className="atlas-project-alert" role="alert"><ShieldAlert size={15}/> The local commercial portfolio was rejected: {error}. Existing browser data was not overwritten.</p>}
    {enabled&&state==='valid'&&<>
      <div className="atlas-fleet-project-kpis">
        <div><b>{active.length}</b><span>Active local plans</span></div>
        <div><b>{withEquipment.length}</b><span>Plans listing equipment</span></div>
        <div><b>{repeated.length}</b><span>Asset IDs reused across plans</span></div>
      </div>
      {repeated.length>0&&<p className="atlas-project-alert"><Boxes size={15}/> {repeated.length} candidate asset ID(s) are listed in multiple active projects. Without verified booking dates and times in this view, this is NOT a confirmed schedule conflict.</p>}
      <div className="atlas-fleet-project-list">
        {active.length===0&&<p>No active commercial project entries on this device. Archived or unsaved drafts are not scheduled work.</p>}
        {active.map(p=><article key={p.id}>
          <div><strong>{p.name}</strong><small>{p.input.sites.length} buildings · {p.phase==='founder-review'?'Founder review requested':'Scoping'} · {p.bookingId?'Booking ID recorded locally; not verified on Fleet screen':'No linked booking'}</small></div>
          <ul>{p.plannedAssetIds.length?projectEquipmentEvidence(p,fleet,day).map(asset=>
            <li key={asset.id}>{asset.name} <span>— {asset.state==='recorded-ready'?'recorded ready (not inspected for this job)':asset.state.replaceAll('-',' ')}</span></li>
          ):<li>No candidate equipment selected</li>}</ul>
        </article>)}
      </div>
    </>}
  </section>;
}
