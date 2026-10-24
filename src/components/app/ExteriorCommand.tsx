'use client';

import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import NumberFlow from '@number-flow/react';
import {
  Activity,ArrowRight,ArrowUpRight,BarChart3,BriefcaseBusiness,CalendarDays,
  CheckSquare2,ChevronRight,ClipboardCheck,Compass,Database,HardHat,
  Layers3,Plus,RefreshCw,ShieldCheck,Target,Truck,Wallet,UsersRound,
} from 'lucide-react';
import {loadExterior} from '@/app/workspace/exterior-actions';
import {sampleExterior} from '@/lib/exterior-sample';
import {businessDay} from '@/lib/reporting';
import {buildExteriorCommand,type ExteriorCommandSnapshot} from '@/lib/exterior-command';
import {ExteriorDispatchPreflight} from './ExteriorDispatchPreflight';
import type {Card} from '@/lib/board';
import type {ExteriorResult} from '@/lib/exterior';

type Props={base:string;org:string;mode:'live'|'preview';readOnly:boolean;cards:Card[];onNewTask:()=>void};
const money=(n:number|null)=>n===null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const day=(key:string)=>new Date(key+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
const month=(key:string)=>new Date(key+'-15T12:00:00').toLocaleDateString('en-US',{month:'short'});
export function ExteriorCommand({base,org,mode,readOnly,cards,onNewTask}:Props){
  const [result,setResult]=useState<ExteriorResult|null>(null);
  const [loadedAt,setLoadedAt]=useState<Date|null>(null);
  const [refresh,setRefresh]=useState(0);
  const [season,setSeason]=useState<'field'|'build'>('field');
  const [focus,setFocus]=useState<'dispatch'|'growth'>('dispatch');
  useEffect(()=>{
    let active=true;
    if(mode==='preview'){
      const now=new Date();
      setResult({ok:true,data:sampleExterior(now)});setLoadedAt(now);
      return ()=>{active=false;};
    }
    setResult(null);
    loadExterior(org).then(value=>{
      if(active){setResult(value);setLoadedAt(new Date());}
    },()=>{if(active){setResult({ok:false,reason:'failed'});setLoadedAt(new Date());}});
    return ()=>{active=false;};
  },[mode,org,refresh]);
  const today=loadedAt?businessDay(loadedAt.toISOString()):null;
  const snapshot=useMemo<ExteriorCommandSnapshot|null>(
    ()=>result?.ok&&today?buildExteriorCommand(result.data,cards,today):null,
    [result,cards,today],
  );
  const parent=`${base}/b/exterior`;
  if(!result||!loadedAt)return <main className="excmd excmd-loading" aria-busy="true">
    <div className="excmd-skeleton excmd-skeleton-hero"/><div className="excmd-skeleton excmd-skeleton-metrics"/>
    <p role="status">Loading authorized Exterior Care records…</p>
  </main>;
  if(!result.ok)return <main className="excmd excmd-unavailable" role="alert">
    <ShieldCheck size={26}/><h1>{result.reason==='no-access'?'Exterior Care access restricted':'Exterior Care source unavailable'}</h1>
    <p>{result.reason==='no-access'?'You need authorized membership to view private customer and operational records.':'The operational source could not be loaded. No demonstration metrics were substituted.'}</p>
    {result.reason==='failed'&&<button type="button" className="secondary" onClick={()=>setRefresh(n=>n+1)}>Retry source <RefreshCw size={15}/></button>}
  </main>;
  const s=snapshot;
  if(!s)return <main className="excmd excmd-unavailable"><p>Source date unavailable; no operational totals were inferred.</p></main>;
  const maxMonth=Math.max(1,...s.months.map(m=>m.revenue??0));
  const maxSource=Math.max(1,...s.sales.bySource.map(m=>m.count));
  const stats=[
    {key:'recorded',label:'Recorded job revenue',value:money(s.production.recordedJobRevenue),caption:`${s.production.withRevenue} of ${s.production.completed} completed records · not verified cash`,icon:Wallet,href:`${parent}/jobs`,tag:'HISTORICAL'},
    {key:'booked',label:'Qualified confirmed quotes',value:money(s.dispatch.quotedUpcomingValue),caption:`${s.dispatch.priced} source-qualified of ${s.dispatch.confirmedUpcoming} confirmed visits · not accepted or collected`,icon:CalendarDays,href:`${parent}/bookings`,tag:'SOURCE / CONFIRMED'},
    {key:'pipeline',label:'Open quote exposure',value:money(s.sales.quotedOpenValue),caption:`${s.sales.openPriced} priced · ${s.sales.openUnpriced} unpriced active sales records`,icon:Target,href:`${parent}/leads`,tag:'POTENTIAL'},
    {key:'contribution',label:'Known job contribution',value:money(s.production.matchedContribution),caption:`${s.production.fullyCosted} completed jobs with revenue + cost · not total profit`,icon:BarChart3,href:`${parent}/jobs`,tag:'MATCHED SUBSET'},
  ];
  return <main className="excmd" id="exterior-command">
    <section className="excmd-hero" aria-label="Exterior division command">
      <div className="excmd-hero-text">
        <div className="excmd-eyebrow"><span className="excmd-lamp"/>ATLAS / EXTERIOR CARE <span className="excmd-separator">/</span> DIVISION COMMAND</div>
        <h1>Control the day.<br/><em>Build the company.</em></h1>
        <p>Operations, sales and financial intelligence from the Exterior Care source. Decisions first; the full records are always one action away.</p>
        <div className="excmd-hero-actions">
          {!readOnly&&<Link className="excmd-primary" href={parent+'/bookings?new=1'}><Plus size={16}/> Book a job</Link>}
          {!readOnly&&<Link className="excmd-outline" href={parent+'/leads?new=1'}><UsersRound size={15}/> Capture a lead</Link>}
          <Link className="excmd-text-link" href={parent+'/estimate'}>Estimate workbench <ArrowUpRight size={15}/></Link>
          <Link className="excmd-text-link" href={parent+'/field'}>Mobile Field Command <ArrowUpRight size={15}/></Link>
          <Link className="excmd-text-link" href={parent+'/intake'}>Website intake <ArrowUpRight size={15}/></Link>
          <Link className="excmd-text-link" href={parent+'/commercial'}>Bid War Room <ArrowUpRight size={15}/></Link>
        </div>
      </div>
      <div className="excmd-hero-side">
        <div className="excmd-hero-asof"><Database size={14}/>
          <span>{mode==='preview'?'SAMPLE / NO WRITES':'AUTHORIZED EXTERIOR SOURCE'}<small>Loaded {loadedAt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'})}</small></span>
          <button type="button" onClick={()=>setRefresh(n=>n+1)} aria-label="Refresh Exterior source" title="Refresh records"><RefreshCw size={16}/></button>
        </div>
        <div className="excmd-season-title"><span>OPERATING FOCUS</span><strong>{season==='field'?'Field production':'Off-season buildout'}</strong></div>
        <div className="excmd-season-switch" role="group" aria-label="Operational planning mode">
          <button type="button" aria-pressed={season==='field'} onClick={()=>setSeason('field')}>Field season</button>
          <button type="button" aria-pressed={season==='build'} onClick={()=>setSeason('build')}>Build season</button>
        </div>
        <p>{season==='field'?'Focus on the customer queue, confirmed jobs, field readiness and closeout.':'Focus on commercial pursuits, recurring work, fleet service and preparation for the next production season.'}</p>
      </div>
      <div className="excmd-hero-marker" aria-hidden="true">EC<span>01</span></div>
    </section>

    {s.source.partial&&<div className="excmd-source-warning" role="status">
      <Database size={17}/><p>Partial history loaded. Financial and pipeline instruments describe accessible source records, not the full company.</p>
      <Link href={parent+'/activity'}>Inspect source history <ArrowRight size={13}/></Link>
    </div>}
    {mode==='preview'&&<p className="excmd-preview-warning" role="status">Preview workspace: these are fictional records. No production customer, booking or cash figures appear here.</p>}

    <section className="excmd-instruments" aria-label="Operational and financial instruments">
      {stats.map((item,i)=><Link key={item.key} className="excmd-instrument" href={item.href} style={{animationDelay:`${i*55}ms`}}>
        <div className="excmd-instrument-head"><span>{item.label}</span><item.icon size={18}/></div>
        <strong>{item.value}</strong>
        <small>{item.caption}</small>
        <div className="excmd-instrument-bottom"><span>{item.tag}</span><ArrowUpRight size={15}/></div>
      </Link>)}
    </section>

    <ExteriorDispatchPreflight data={result.data} now={loadedAt} base={base} mode={mode} compact/>
    <section className="excmd-workspace" aria-label="Operations and founder decisions">
      <div className="excmd-mission-board">
        <header className="excmd-section-header">
          <div><span className="excmd-eyebrow">01 / OPERATING FLOOR</span><h2>Mission timeline</h2>
            <p>{s.dispatch.confirmedUpcoming} confirmed upcoming bookings · assigned crew and equipment details live in Operations.</p></div>
          <Link href={parent+'/bookings'}>Open dispatch <ArrowUpRight size={15}/></Link>
        </header>
        <div className="excmd-quick-focus" role="group" aria-label="Mission panel focus">
          <button type="button" aria-pressed={focus==='dispatch'} onClick={()=>setFocus('dispatch')}><CalendarDays size={14}/> Schedule</button>
          <button type="button" aria-pressed={focus==='growth'} onClick={()=>setFocus('growth')}><Target size={14}/> Acquisition</button>
        </div>
        {focus==='dispatch' ? s.dispatch.next.length ? <ol className="excmd-booking-timeline">
          {s.dispatch.next.map((job,i)=><li key={job.id}>
            <div className="excmd-time"><strong>{day(job.date)}</strong><small>{job.time}</small></div>
            <div className="excmd-timeline-node"><i/><span/></div>
            <div className="excmd-job-details">
              <div><strong>{job.customer}</strong><span>{job.service}</span></div>
              <small>{job.address??'Service address not in loaded record'} · {job.quote===null?'Quote unavailable':`${money(job.quote)} quoted`}</small>
              <Link href={job.leadId ? `${parent}/customer?lead=${encodeURIComponent(job.leadId)}` : `${parent}/bookings`}>
                {job.leadId?'Open customer':'Inspect booking'} <ArrowRight size={13}/>
              </Link>
            </div>
            <span className="excmd-booking-index">{String(i+1).padStart(2,'0')}</span>
          </li>)}
        </ol>:<div className="excmd-empty"><CalendarDays size={22}/><strong>No confirmed future booking in the loaded window.</strong><span>Use the booking workbench to inspect all scheduled and pending work.</span></div>
        : <div className="excmd-growth-focus">
          <div><strong><NumberFlow value={s.sales.newRequests}/></strong><span>new source records</span><Link href={parent+'/leads'}>Triage leads <ArrowRight size={14}/></Link></div>
          <div><strong><NumberFlow value={s.sales.followingUp}/></strong><span>follow-ups in progress</span><Link href={parent+'/leads'}>Inspect follow-ups <ArrowRight size={14}/></Link></div>
          <p>Lead statuses represent recorded workflow progress. No message-response timestamp or advertising spend has been inferred.</p>
        </div>}
        <footer className="excmd-board-footer"><span><ClipboardCheck size={15}/> {s.tasks.open} open shared tasks · {s.tasks.overdue} overdue</span>
          <Link href={base+'/tasks'}>Open mission board <ChevronRight size={14}/></Link></footer>
      </div>

      <aside className="excmd-decision-panel">
        <header className="excmd-section-header">
          <div><span className="excmd-eyebrow">02 / FOUNDER ATTENTION</span><h2>Decisions & exceptions</h2><p>Issues generated from actual loaded status and completeness.</p></div>
        </header>
        {s.decisions.length?<ol className="excmd-decision-list">{s.decisions.map((item,i)=><li key={item.id}>
          <span className="excmd-decision-index">{String(i+1).padStart(2,'0')}</span>
          <div><strong>{item.title}</strong><small>{item.detail}</small><Link href={base+item.href}>Investigate <ArrowUpRight size={13}/></Link></div>
        </li>)}</ol>:<div className="excmd-empty"><ShieldCheck size={23}/><strong>No specific exception detected.</strong><span>Only loaded source checks were evaluated; this is not an all-clear.</span></div>}
        {!readOnly&&<button type="button" className="excmd-task-button" onClick={onNewTask}><Plus size={15}/> Assign company work</button>}
      </aside>
    </section>

    <section className="excmd-intelligence" aria-label="Service economics and growth history">
      <div className="excmd-revenue-panel">
        <header className="excmd-section-header"><div><span className="excmd-eyebrow">03 / PERFORMANCE RECORD</span><h2>Production & recorded revenue</h2><p>Historical completed-job revenue fields; dates may be inferred. Not verified deposits.</p></div><Link href={parent+'/jobs'}>Explore jobs <ArrowUpRight size={15}/></Link></header>
        <div className="excmd-chart" role="img" aria-label="Last six months, recorded completed-job revenue by month; missing months shown as unknown">
          {s.months.map((item,i)=><div key={item.key} className="excmd-chart-column" title={`${item.key}: ${item.revenue===null?'No revenue figure recorded':money(item.revenue)} · ${item.recordedJobs} revenue-coded jobs / ${item.completedJobs} completed`}>
            <div className="excmd-chart-track">{item.revenue!==null&&<div className="excmd-chart-bar" style={{height:`${Math.max(3,(item.revenue/maxMonth)*100)}%`,animationDelay:`${i*80}ms`}}/>}
              {item.revenue===null&&<span className="excmd-chart-unknown">?</span>}</div>
            <strong>{month(item.key)}</strong><span>{item.revenue===null?'Unknown':money(item.revenue)}</span>
          </div>)}
        </div>
        <div className="excmd-economics-notice"><HardHat size={17}/><p>Cost evidence exists on <strong>{s.production.withCosts}/{s.production.completed}</strong> completed records; combined margin is withheld. <strong>{s.production.fullyCosted}</strong> jobs currently support a recorded revenue-minus-cost calculation. {s.production.estimatedCompletionDates} completion dates use a fallback date.</p></div>
      </div>
      <div className="excmd-acquisition-panel">
        <header className="excmd-section-header"><div><span className="excmd-eyebrow">04 / ACQUISITION MAP</span><h2>Where inquiries originated</h2><p>All-time recorded source tags, not acquisition ROI.</p></div><Link href={parent+'/door-knocking'}>Historical detail <ArrowUpRight size={15}/></Link></header>
        <div className="excmd-source-bars">
          {s.sales.bySource.length?s.sales.bySource.map(source=><div key={source.name} className="excmd-source-line">
            <span>{source.name}</span><div className="excmd-source-track"><i style={{width:`${(source.count/maxSource)*100}%`}}/></div>
            <strong>{source.count}</strong></div>):<p>No tagged acquisition sources exist in the loaded records.</p>}
        </div>
        <div className="excmd-source-foot"><Target size={16}/><span>Next: connect actual LSA spend, inquiry receipts and booked-to-paid conversion before showing advertising ROI.</span></div>
      </div>
    </section>
    <section className="excmd-deep-links" aria-label="Complete operating applications">
      <header className="excmd-section-header"><div><span className="excmd-eyebrow">05 / SPECIALIST APPLICATIONS</span><h2>Go deeper without losing context.</h2></div></header>
      <div className="excmd-app-grid">
        {[
          {title:'Customer Command',body:'Records, inquiries, status, history and booking handoff.',href:parent+'/leads',icon:UsersRound},
          {title:'Field Operations',body:'Dispatch plus on-site crew hours, material usage, rig readiness and local job evidence.',href:parent+'/field',icon:Truck},
          {title:'Commercial War Room',body:'Multi-building scope, pricing and project portfolio.',href:parent+'/commercial',icon:BriefcaseBusiness},
          {title:'Fleet Engineering',body:'Assets, service, readiness and rig planning.',href:base+'/tools/fleet',icon:Layers3},
          {title:'Finance & Accounting',body:'Source-labeled money, exceptions and accounting preparation.',href:base+'/finance',icon:Wallet},
          {title:'Growth Intelligence',body:'Service performance, acquisition and historical data.',href:parent+'/jobs',icon:Compass},
        ].map(app=><Link key={app.title} href={app.href} className="excmd-app-link"><app.icon size={21}/><strong>{app.title}</strong><span>{app.body}</span><ArrowUpRight size={15}/></Link>)}
      </div>
    </section>
    <footer className="excmd-source-footer"><Activity size={14}/>
      <span>Source scope: {s.source.leadCoverage}; {s.source.bookingCoverage}. {s.source.notes.join(' ')||'No provider incompleteness was reported for loaded lists.'} Missing evidence is not a zero. All actions open existing authorized workflows.</span>
    </footer>
  </main>;
}
