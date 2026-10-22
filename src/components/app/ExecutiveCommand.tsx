'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, BriefcaseBusiness, CalendarDays, CheckCircle2, CircleAlert, FileText, Plus, ShieldCheck, Wallet, Users, Radar, Clock3, ChartNoAxesCombined } from 'lucide-react';
import type { JobItem } from '@/app/workspace/exterior-actions';
import type { Board } from './useBoard';
import type { DashboardStore } from './useDashboard';
import type { WorkspaceMetrics } from '@/lib/metrics';
import { money } from '@/lib/metrics';
import { ventures } from '@/lib/ventures';

type Props = {
  base: string; board: Board; store: DashboardStore; metrics: WorkspaceMetrics;
  jobs: JobItem[]; mode: 'live' | 'preview'; today: string;
  displayName: string; readOnly: boolean;
};
const dateLabel = (date: string) => date ?
  new Date(date + 'T12:00:00').toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'}) : 'Checking business date';
const shortDate = (date: string) => date ?
  new Date(date + 'T12:00:00').toLocaleDateString('en-US',{month:'short',day:'numeric'}) : 'Undated';
const future = (today: string, days: number) => {
  if (!today) return '';
  const date=new Date(today+'T12:00:00');
  date.setDate(date.getDate()+days);
  return [date.getFullYear(),String(date.getMonth()+1).padStart(2,'0'),String(date.getDate()).padStart(2,'0')].join('-');
};

export function ExecutiveCommand({base,board,store,metrics,jobs,mode,today,displayName,readOnly}:Props) {
  const [queue,setQueue]=useState<'focus'|'team'|'dispatch'>('focus');
  const open=board.data.cards.filter(c=>c.stage!=='Done');
  const due=open.filter(c=>Boolean(today && c.due_date && c.due_date<=today));
  const review=open.filter(c=>c.stage==='Review');
  const unassigned=open.filter(c=>!c.assignee.trim());
  const focus=useMemo(()=>open.filter(c=>Boolean((today && c.due_date && c.due_date<=today)||c.priority==='high'||c.stage==='Review'))
    .sort((a,b)=>{
      const weight=(c:typeof a)=>c.due_date && today && c.due_date<today ? 0 : c.due_date===today ? 1 : c.stage==='Review' ? 2 : 3;
      return weight(a)-weight(b)||(a.due_date||'9999').localeCompare(b.due_date||'9999');
    }).slice(0,8),[board.data.cards,today]);
  const team=useMemo(()=>open.filter(c=>c.stage==='Review'||!c.assignee.trim()).slice(0,8),[board.data.cards]);
  const upcoming=useMemo(()=>jobs.filter(j=>Boolean(today && j.date>=today && j.date<=future(today,14) && j.status!=='cancelled' && j.status!=='denied'))
    .sort((a,b)=>a.date.localeCompare(b.date)).slice(0,8),[jobs,today]);
  const recorded=Object.values(metrics.ventures).reduce((sum,item)=>sum+(item?.revenueMtd??0),0);
  const hasFigures=Object.values(metrics.ventures).some(Boolean);
  const coverage=store.data?.reporting?.exterior;
  const providers=store.data?.reporting?.sources??[];
  const partial=providers.filter(s=>s.state!=='available');
  const who=mode==='preview'?'Sample workspace':displayName||'Operator';

  return <section className="exec" aria-label="OJ executive operating command">
    <header className="exec-hero">
      <div className="exec-hero-copy">
        <p className="exec-kicker"><span className="exec-beacon"/> OJ HOLDINGS <span className="exec-rule"/> EXECUTIVE OPERATIONS</p>
        <p className="exec-date">{dateLabel(today)} <span>· Central time</span></p>
        <h1>Run the business.<br/><em>Own the outcome.</em></h1>
        <p className="exec-lead">A command view for the work, customers, decisions and recorded performance of your four businesses. Every action leads back to an actual workspace record.</p>
        <nav className="exec-quick" aria-label="Executive quick actions">
          <Link className="primary" href={base+'/tools/intelligence'}>Corporate briefing <Radar size={16}/></Link>
          <Link className="secondary" href={base+'/tasks'}>Work queue <ArrowRight size={16}/></Link>
          <Link className="secondary" href={base+'/b/solutions/outreach'}>Solutions outreach <ArrowUpRight size={16}/></Link>
          <Link className="secondary" href={base+'/b/exterior/commercial'}>Commercial desk <BriefcaseBusiness size={16}/></Link>
        </nav>
      </div>
      <div className="exec-monogram" aria-hidden="true"><div>OJ</div><span>HOLDINGS</span><small>OPERATE · DELIVER · GROW</small></div>
    </header>

    <div className="exec-presence"><span><Radar size={14}/> {mode==='preview'?'FICTIONAL PREVIEW':'WORKSPACE RECORDS'}</span><span className="exec-operator">{who}</span><span><ShieldCheck size={14}/> Membership permissions unchanged</span></div>
    <div className="exec-kpis">
      <Link href={base+'/tasks'} className="exec-kpi"><span><CheckCircle2 size={16}/> OPEN TASKS</span><strong>{open.length}</strong><small>{due.length} due or overdue <ArrowUpRight size={14}/></small></Link>
      <Link href={base+'/tasks?focus=review'} className="exec-kpi"><span><CircleAlert size={16}/> TEAM DECISIONS</span><strong>{review.length+unassigned.filter(c=>c.stage!=='Review').length}</strong><small>{review.length} review · {unassigned.length} unassigned <ArrowUpRight size={14}/></small></Link>
      <Link href={base+'/b/exterior/bookings'} className="exec-kpi"><span><CalendarDays size={16}/> UPCOMING EXTERIOR</span><strong>{upcoming.length}</strong><small>Bookings loaded · next 14 days <ArrowUpRight size={14}/></small></Link>
      <Link href={base+'/finance'} className="exec-kpi exec-kpi-feature"><span><Wallet size={16}/> RECORDED THIS MONTH</span><strong>{hasFigures?money(recorded):'—'}</strong><small>Reporting records, not verified cash <ArrowUpRight size={14}/></small></Link>
    </div>

    <div className="exec-grid">
      <section className="exec-panel exec-work" aria-labelledby="exec-work-title">
        <div className="exec-head"><div><p className="exec-kicker">OPERATIONS DESK</p><h2 id="exec-work-title">What moves next</h2></div>
          {!readOnly && <button type="button" className="secondary" onClick={()=>board.openCard(undefined,{title:''})}><Plus size={15}/> New task</button>}
        </div>
        <div className="exec-tabs" role="group" aria-label="Operations queue">
          <button aria-pressed={queue==='focus'} onClick={()=>setQueue('focus')}><Clock3 size={15}/> Priorities</button>
          <button aria-pressed={queue==='team'} onClick={()=>setQueue('team')}><Users size={15}/> Team decisions</button>
          <button aria-pressed={queue==='dispatch'} onClick={()=>setQueue('dispatch')}><CalendarDays size={15}/> Dispatch</button>
        </div>
        {queue!=='dispatch' ? (queue==='focus'?focus:team).length > 0 ?
          <ol className="exec-items">{(queue==='focus'?focus:team).map((task,index)=><li key={task.id}>
            <span className="exec-index">{String(index+1).padStart(2,'0')}</span>
            <button onClick={()=>board.openCard(task)}><b>{task.title}</b><small><i style={{background:'var(--c-'+task.business+')'}}/>{ventures[task.business].short} · {task.assignee||'Unassigned'} · {task.stage}</small></button>
            <time>{task.due_date?shortDate(task.due_date):task.stage==='Review'?'Review':'Open'}</time><ArrowUpRight size={16}/>
          </li>)}</ol> : <div className="exec-empty">No matching tasks in the loaded workspace board.</div> :
          upcoming.length>0?<ol className="exec-items">{upcoming.map((job,index)=><li key={job.id}>
            <span className="exec-index">{String(index+1).padStart(2,'0')}</span>
            <Link href={base+'/b/exterior/calendar'}><b>{job.name}</b><small>Exterior Care · {job.service||'Service unrecorded'} · {job.time_block||'Time unrecorded'}</small></Link>
            <time>{shortDate(job.date)}</time><ArrowUpRight size={16}/>
          </li>)}</ol>:<div className="exec-empty">No upcoming bookings in the loaded schedule.</div>}
        <footer className="exec-panel-foot"><Link href={base+(queue==='dispatch'?'/b/exterior/calendar':'/tasks')}>Open complete {queue==='dispatch'?'schedule':'work board'} <ArrowRight size={15}/></Link></footer>
      </section>

      <aside className="exec-side">
        <section className="exec-panel exec-links">
          <p className="exec-kicker">DIRECT ROUTES</p><h2>Make the next move.</h2>
          {[
            {href:'/b/solutions/outreach',name:'Process Solutions prospects',icon:<ArrowUpRight size={17}/>},
            {href:'/b/exterior/bookings',name:'Manage Exterior bookings',icon:<CalendarDays size={17}/>},
            {href:'/b/exterior/commercial',name:'Scope commercial properties',icon:<BriefcaseBusiness size={17}/>},
            {href:'/files',name:'Shared documents and contracts',icon:<FileText size={17}/>},
          ].map(item=><Link key={item.href} href={base+item.href}><span>{item.icon}{item.name}</span><ArrowUpRight size={16}/></Link>)}
        </section>
        <section className="exec-panel exec-trust">
          <div className="exec-head"><div><p className="exec-kicker">DATA INTEGRITY</p><h2>Evidence & coverage</h2></div><ChartNoAxesCombined size={19}/></div>
          {coverage && coverage.jobs>0?<div className="exec-coverage"><p>Exterior completed-job records</p>
            {[
              ['Revenue entered',coverage.revenueJobs],
              ['Direct costs entered',coverage.costJobs],
              ['Both entered',coverage.matchedJobs],
            ].map(([label,value])=><div key={String(label)}><span>{label}<b>{value}/{coverage.jobs}</b></span>
              <progress value={Number(value)} max={coverage.jobs} aria-label={String(label)+': '+value+' of '+coverage.jobs}/>
            </div>)}
            <small>Missing costs are unknown, not zero. Entered revenue may not have been collected.</small>
          </div>:<p className="exec-footnote">Completed-job financial coverage is not available in this view.</p>}
          {providers.length>0?<ul className="exec-providers">{providers.map(source=><li key={source.id}>
            <span className={'exec-status exec-status-'+source.state}/>
            <div><b>{source.label}</b><small>{source.detail}</small></div><em>{source.state}</em>
          </li>)}</ul>:<p className="exec-footnote">Provider status has not been supplied. The absence of a status is not proof that a connection is healthy.</p>}
          {partial.length>0 && <p className="exec-warning">{partial.length} data source(s) are partial, unavailable or not connected.</p>}
          <Link href={base+'/analytics'} className="exec-review-link">Inspect source records <ArrowRight size={15}/></Link>
        </section>
      </aside>
    </div>
    <p className="exec-disclaimer">Executive figures use only loaded, authorized workspace data. No inferred sales, invented financial values, or outside sends.</p>
  </section>;
}
