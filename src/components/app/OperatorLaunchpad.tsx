'use client';

import Link from 'next/link';
import { CalendarPlus, ClipboardList, ReceiptText, UserRoundPlus, ArrowUpRight } from 'lucide-react';
import { operatorActionHref } from '@/lib/operator-shortcuts';

type Props={
  base:'/workspace'|'/preview';
  mode:'live'|'preview';readOnly:boolean;
  onNewTask:()=>void;
  venture?:'exterior'|'solutions'|'essentials';
  compact?:boolean;
};
const paths=[
  {id:'new-lead' as const,title:'Add a lead',detail:'Customer & quote',icon:UserRoundPlus},
  {id:'book-job' as const,title:'Book a job',detail:'Customer & calendar',icon:CalendarPlus},
  {id:'record-expense' as const,title:'Record expense',detail:'Business money out',icon:ReceiptText},
];

/** The routine operator commands always open REAL existing editors. Preview,
 * visitor and read-only modes display visible but inactive examples. */
export function OperatorLaunchpad({base,mode,readOnly,onNewTask,venture,compact=false}:Props){
  const canEdit=mode==='live'&&!readOnly;
  return <section className={'atlas-operator-launchpad'+(compact?' is-compact':'')} aria-label="Daily operator shortcuts">
    {!compact&&<div className="atlas-operator-intro">
      <div><p>OPERATE / DAILY ACTIONS</p><h2>Get the job moving.</h2>
        <span>Real work first. These shortcuts open the same authorized editors used in Leads, Bookings, Finance and Tasks.</span>
      </div>
      <Link href={base+'/b/exterior/calendar'}>View job calendar <ArrowUpRight size={15}/></Link>
    </div>}
    <div className="atlas-operator-actions">
      {paths.map(action=>{
        const Icon=action.icon;
        return canEdit
          ? <Link key={action.id} href={operatorActionHref(base,action.id,venture)} className="atlas-operator-action">
            <span className="atlas-operator-action-icon"><Icon size={19}/></span>
            <span><strong>{action.title}</strong>{!compact&&<small>{action.detail}</small>}</span>
            <ArrowUpRight size={15} className="atlas-operator-arrow"/>
          </Link>
          : <div key={action.id} className="atlas-operator-action is-disabled" aria-disabled="true">
            <span className="atlas-operator-action-icon"><Icon size={19}/></span>
            <span><strong>{action.title}</strong>{!compact&&<small>{mode==='preview'?'Sample workspace only':'View access only'}</small>}</span>
          </div>;
      })}
      <button type="button" className="atlas-operator-action" disabled={!canEdit} onClick={onNewTask}>
        <span className="atlas-operator-action-icon"><ClipboardList size={19}/></span>
        <span><strong>New task</strong>{!compact&&<small>Assign or plan work</small>}</span>
        <ArrowUpRight size={15} className="atlas-operator-arrow"/>
      </button>
    </div>
  </section>;
}
