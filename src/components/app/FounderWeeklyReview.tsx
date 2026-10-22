'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowUpRight, CalendarDays, ClipboardCopy, FileCheck2, Radar,
  ShieldCheck, Users, Wallet, AlertTriangle,
} from 'lucide-react';
import type { Card } from '@/lib/board';
import type { Dashboard } from '@/lib/dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { buildWeeklyReview, weeklyReviewBrief } from '@/lib/founder-weekly-review';
import { ventures } from '@/lib/ventures';
import { workDay } from '@/lib/task-workflows';

type Props={
  base:string;cards:Card[];dashboard:Dashboard|null;jobs:JobItem[];
  mode:'live'|'preview';limited:boolean;
};
const money=(n:number)=>n.toLocaleString('en-US',{style:'currency',currency:'USD'});

export function FounderWeeklyReview({base,cards,dashboard,jobs,mode,limited}:Props){
  const [today,setToday]=useState('');
  const [copyState,setCopyState]=useState('');
  useEffect(()=>{
    const refresh=()=>setToday(workDay(new Date()));
    refresh();
    const timer=setInterval(refresh,60_000);
    return ()=>clearInterval(timer);
  },[]);
  const report=useMemo(()=>today?buildWeeklyReview({cards,dashboard,jobs,today,limited}):null,
    [cards,dashboard,jobs,today,limited]);
  const copy=async()=>{
    if(!report)return;
    try{
      await navigator.clipboard.writeText(weeklyReviewBrief(report));
      setCopyState('Internal review copied. Keep it private; it may identify customers.');
    }catch{
      setCopyState('Clipboard unavailable. Use the source links to review records.');
    }
  };
  return <main className="weekly-review page">
    <header className="weekly-hero">
      <p className="tools-eyebrow"><FileCheck2 size={16} aria-hidden="true"/> OJ HOLDINGS / FOUNDER COMMAND</p>
      <h1>Founder Weekly Review</h1>
      <p className="weekly-intro">One founder-to-founder agenda: current commitments, newly created CRM records, recorded finance entries, upcoming work, and the next source-linked decisions. All figures come from the workspace snapshot already authorized for your account.</p>
      <div className="weekly-period">
        <span><CalendarDays size={16} aria-hidden="true"/>{report?report.period.start+' → '+report.period.through+' · Chicago':'Loading business date…'}</span>
        <button type="button" onClick={()=>void copy()} disabled={!report}><ClipboardCopy size={16}/> Copy internal brief</button>
      </div>
      <div className="weekly-evidence"><ShieldCheck size={16}/>
        {mode==='preview'
          ? 'DEMO ONLY — all preview records are fictional.'
          : 'Read-only founder briefing. No messages, payment actions, approvals, or edits are triggered.'}
      </div>
      {copyState&&<p className="weekly-copy-state" role="status">{copyState}</p>}
    </header>
    {report ? <>
      {report.snapshotLimited&&<div className="weekly-warning"><AlertTriangle size={17}/> This loaded snapshot is truncated. Totals may undercount real company records.</div>}
      <section className="weekly-kpis" aria-label="Current founder action metrics">
        <article><span><FileCheck2 size={16}/> Unfinished tasks</span><strong>{report.tasks.open}</strong><small>Current board snapshot, not new work this week</small></article>
        <article><span><AlertTriangle size={16}/> Overdue</span><strong>{report.tasks.overdue}</strong><small>Past-due unfinished assignments</small></article>
        <article><span><Users size={16}/> New shared CRM leads</span><strong>{report.leads.thisPeriod??'Unknown'}</strong><small>{report.leads.comparison===null?'Prior window unknown':'Versus '+report.leads.comparison+' in comparable prior weekdays'}</small></article>
        <article><span><CalendarDays size={16}/> Upcoming Exterior bookings</span><strong>{report.schedule.nextSevenDaysExterior}</strong><small>Loaded non-cancelled records, next seven dates</small></article>
      </section>

      <div className="weekly-grid">
        <section className="weekly-panel">
          <h2><Radar size={19}/> Priority decisions</h2>
          <p>Ranked using the same deterministic rules as the Corporate Intelligence Desk. A flag is a request to verify a record, not an automated decision.</p>
          {report.priorities.length?<ol className="weekly-priorities">
            {report.priorities.map(item=><li key={item.id}>
              <div><span className={'weekly-severity '+item.severity}>{item.severity}</span><strong>{item.title}</strong></div>
              <small>{item.explanation}</small>
              <Link href={base+item.destination}>Open source · {item.source} <ArrowUpRight size={14}/></Link>
            </li>)}
          </ol>:<div className="weekly-empty">No priority signals in the loaded records. Check the source coverage below before concluding everything is clear.</div>}
          <Link href={base+'/tools/intelligence'} className="weekly-more">Open Corporate Intelligence <ArrowUpRight size={15}/></Link>
        </section>

        <div className="weekly-side">
          <section className="weekly-panel">
            <h2><Users size={19}/> Assignment accountability</h2>
            <p>{report.tasks.reviewing} tasks currently marked Review; {report.tasks.unassigned} unfinished tasks without an owner. These are stage counts, not approvals.</p>
            {report.tasks.owners.length?<div className="weekly-owners">
              {report.tasks.owners.slice(0,10).map(owner=><div key={owner.owner}>
                <span>{owner.owner}</span><strong>{owner.open} open</strong><small>{owner.reviewing} in Review</small>
              </div>)}
            </div>:<p className="weekly-empty">No open tasks in the loaded board.</p>}
            <Link href={base+'/tasks'} className="weekly-more">Open shared board <ArrowUpRight size={15}/></Link>
          </section>
          <section className="weekly-panel">
            <h2><Wallet size={19}/> Recorded finance pulse</h2>
            {report.finance?<>
              <p>Workspace finance entries for the reporting dates, grouped by their existing labels. This is <b>not</b> collected cash, bank reconciliation, or company profit.</p>
              <div className="weekly-money"><div><span>Revenue-tagged</span><strong>{money(report.finance.thisPeriod.recordedRevenue)}</strong><small>{report.finance.thisPeriod.revenueEntries} loaded entries</small></div>
              <div><span>Cost-tagged</span><strong>{money(report.finance.thisPeriod.recordedCost)}</strong><small>{report.finance.thisPeriod.costEntries} loaded entries</small></div></div>
              <p className="weekly-note">Previous comparable weekdays: {money(report.finance.comparison.recordedRevenue)} revenue-tagged and {money(report.finance.comparison.recordedCost)} cost-tagged. Entry completeness and payment verification are not established.</p>
            </>:<p className="weekly-empty">Finance source not supplied. Monetary totals are unknown, not zero.</p>}
            <Link href={base+'/finance'} className="weekly-more">Inspect finance sources <ArrowUpRight size={15}/></Link>
          </section>
          <section className="weekly-panel">
            <h2><CalendarDays size={19}/> Sales & next seven days</h2>
            <p>Workspace CRM records created since Monday: <b>{report.leads.thisPeriod??'Unknown'}</b>. This counts record creation, never outreach sent, proposals won, or cash collected.</p>
            {report.leads.byBusiness.length>0&&<div className="weekly-lead-split">{report.leads.byBusiness.map(item=><span key={item.business}>{ventures[item.business].short}: {item.count}</span>)}</div>}
            <p>Loaded company events in the next seven dates: <b>{report.schedule.nextSevenDaysEvents??'Unknown'}</b>. Exterior bookings are counted separately and may overlap the calendar.</p>
            <Link href={base+'/calendar'} className="weekly-more">Open company calendar <ArrowUpRight size={15}/></Link>
          </section>
        </div>
      </div>
      <section className="weekly-panel weekly-coverage">
        <h2><ShieldCheck size={19}/> Evidence, gaps & reporting limits</h2>
        <p>Reporting period: {report.period.start} through {report.period.through}. The comparison is {report.period.compareStart} through {report.period.compareThrough} — the same weekdays of the prior week, not a full prior week versus a partial one.</p>
        <ul>{report.coverage.map((line,i)=><li key={i}>{line}</li>)}</ul>
        <p className="weekly-note">No automatic status transitions, reporting snapshots, customer contact or outbound publishing occurs from this view.</p>
      </section>
    </> : <div className="weekly-panel">Preparing the business-day review from authorized workspace records…</div>}
  </main>;
}
