'use client';

import { memo, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { X } from 'lucide-react';
import type { Dashboard } from '@/lib/dashboard';
import { camps, EXPEDITION_START, SUMMIT_ALTITUDE, type Expedition } from '@/lib/hyperborea';
import { altitudeHistory, breakdown, campSchedule, milestones, objectives, totals } from '@/lib/hyperborea-journal';
import { climbRequirement, periodProgress, periods, trailAchievements, type Period } from '@/lib/hyperborea-progress';

type Props = { ex: Expedition; data: Dashboard; businesses: {id:string;name:string}[]; base:string;
  selection:string|null; onSelect:(id:string|null)=>void; onLook:(altitude:number)=>void };
const money = (n:number) => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(n);
const metres = (n:number) => `${Math.round(n).toLocaleString('en-US')} m`;
const date = (d:string) => new Date(d+'T12:00:00Z').toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric',timeZone:'UTC'});
const signed = (n:number) => `${n > 0 ? '+' : ''}${n.toLocaleString('en-US',{maximumFractionDigits:1})}`;

/** One quiet summary; all deep inspection stays in a native focus-trapped dialog. */
export const ExpeditionDesk = memo(function ExpeditionDesk({ex,data,businesses,base,selection,onSelect,onLook}:Props) {
  const [period,setPeriod] = useState<Period>('30D');
  const [gain,setGain] = useState(100);
  const [filter,setFilter] = useState('All');
  const dialog = useRef<HTMLDialogElement>(null);
  const {finance} = data;
  const names = useMemo(()=>Object.fromEntries(businesses.map(b=>[b.id,b.name])),[businesses]);
  const progress = useMemo(()=>periodProgress(finance,ex.today,period),[finance,ex.today,period]);
  const history = useMemo(()=>altitudeHistory(finance,ex.today),[finance,ex.today]);
  const log = useMemo(()=>milestones(finance,ex.today,names),[finance,ex.today,names]);
  const badges = useMemo(()=>trailAchievements(finance,ex.today,names),[finance,ex.today,names]);
  const t = useMemo(()=>totals(finance,ex.today),[finance,ex.today]);
  const why = useMemo(()=>breakdown(finance,ex.today,businesses.map(b=>b.id),names),[finance,ex.today,businesses,names]);
  const next = useMemo(()=>objectives(finance,ex.today,ex.ghost.start),[finance,ex.today,ex.ghost.start]);
  const required = useMemo(()=>climbRequirement(finance,ex.today,gain),[finance,ex.today,gain]);
  useEffect(()=>{ if(selection && !dialog.current?.open) dialog.current?.showModal(); else if(!selection) dialog.current?.close(); },[selection]);
  const page = selection?.split(':')[0] ?? 'history';
  const selectedDate = selection?.startsWith('history:') ? selection.slice(8) : null;
  const selectedCamp = selection?.startsWith('camp:') ? camps.find(c=>c.id===selection.slice(5)) : null;
  const selectedObjective = selection?.startsWith('goal:') ? next.find(o=>o.revenue===Number(selection.slice(5))) : null;
  const titles:Record<string,string> = {history:'The expedition journal',climb:'Earn the next meters',camp:'The route to 2046',goal:'The next ridgeline',achievements:'The achievement cabinet',records:'Behind the altitude'};
  const W=800,H=160,pad=14, lo=Math.min(...progress.points.map(p=>p.altitude)), hi=Math.max(lo+60,...progress.points.map(p=>p.altitude));
  const xy=(alt:number,i:number)=>`${pad+i/Math.max(progress.points.length-1,1)*(W-2*pad)},${H-pad-(alt-lo)/(hi-lo)*(H-pad*2)}`;
  const line=progress.points.map((p,i)=>`${i?'L':'M'}${xy(p.altitude,i)}`).join(' ');
  const coverage = data.reporting?.sources.filter(s=>s.state!=='available') ?? [];
  return <>
    <section className="hb-desk" aria-label="Ascent dashboard">
      <header><div><h2>The ascent</h2><p>{metres(ex.altitude)} today <span>of {metres(SUMMIT_ALTITUDE)}</span></p></div>
        <button className="hb3-btn" onClick={()=>onSelect('records')}>Why this altitude?</button></header>
      <div className="hb-periods" aria-label="Progress timeframe">{periods.map(p=><button key={p} aria-pressed={p===period} onClick={()=>setPeriod(p)}>{p}</button>)}</div>
      <div className="hb-change" aria-live="polite" data-direction={progress.delta<0?'down':'up'}><strong>{signed(progress.delta)} m</strong><span>{progress.percent===null?'No starting altitude':`${signed(progress.percent)}%`} <small>over {period==='All'?'recorded history':period==='YTD'?'this year':period}</small></span><button onClick={()=>onSelect('history')}>Inspect movement</button></div>
      <svg className="hb-mini-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Reconstructed altitude from ${date(progress.from)} to ${date(progress.through)}; ${signed(progress.delta)} meters`}><path d={line} fill="none" stroke="currentColor" strokeWidth="2"/><circle cx={W-pad} cy={H-pad-(ex.altitude-lo)/(hi-lo)*(H-pad*2)} r="4" fill="currentColor"/></svg>
      <div className="hb-chart-dates"><span>{date(progress.from)}</span><span>{date(progress.through)}</span></div>
      <footer><button onClick={()=>onSelect('history')}>Journal <span>{log.length} milestones</span></button><button onClick={()=>onSelect('climb')}>Next climb <span>+100 m</span></button><button onClick={()=>onSelect(`camp:${ex.camp.next?.id??'summit'}`)}>Route <span>{ex.camp.next?.name.replace('Camp I: ','')??'Summit'}</span></button><button onClick={()=>onSelect('achievements')}>Achievements <span>{badges.filter(b=>b.earned).length} / {badges.length}</span></button></footer>
    </section>

    <dialog ref={dialog} className="hb-inspector" aria-labelledby="hb-inspector-title" onClose={()=>onSelect(null)} onClick={e=>{if(e.target===dialog.current)dialog.current?.close();}}>
      <header><div><small>Hyperborea</small><h2 id="hb-inspector-title">{titles[page]??titles.history}</h2></div><button className="icon-button" aria-label="Close expedition details" onClick={()=>dialog.current?.close()}><X size={20}/></button></header>
      <nav aria-label="Expedition details">{[['history','Journal'],['climb','Next meters'],['camp','Route'],['achievements','Achievements'],['records','Evidence']].map(([id,title])=><button key={id} aria-pressed={page===id||(page==='goal'&&id==='climb')} onClick={()=>onSelect(id)}>{title}</button>)}</nav>
      <div className="hb-inspector-body" key={selection}>
        {page==='history'&&<>
          <p className="hb-detail-lead">Your business history began {t.firstOn?date(t.firstOn):'when the first income is recorded'}. The twenty-year expedition began {date(EXPEDITION_START)}.</p>
          <div className="hb-detail-pair"><div><b>{money(t.lifetimeRevenue)}</b><span>lifetime recorded income</span></div><div><b>{t.bestMonth?money(t.bestMonth.amount):'None'}</b><span>best calendar month</span></div></div>
          {selectedDate&&<section className="hb-detail-highlight"><h3>{date(selectedDate)}</h3><p>{metres(history.find(h=>h.through===selectedDate)?.altitude??ex.altitude)} at this recorded waypoint.</p>{log.filter(m=>m.on.slice(0,7)===selectedDate.slice(0,7)).map(m=><p key={m.on+m.title}>{m.title}: {m.detail}</p>)}</section>}
          <h3>{period} movement explained</h3><p>{signed(progress.delta)} m, from {metres(progress.start)} to {metres(progress.end)}. Twelve-month recorded income changed by {money(progress.revenueDelta)}.</p>
          <details><summary>Inspect income entering and leaving the window</summary><h4>Entered: {money(progress.entered.reduce((s,f)=>s+f.amount,0))}</h4><ul className="hb-evidence-list">{progress.entered.map(f=><li key={f.id}><time>{date(f.occurred_on.slice(0,10))}</time><span>{names[f.venture]??f.venture}</span><b>{money(f.amount)}</b></li>)}</ul><h4>Aged out: {money(progress.expired.reduce((s,f)=>s+f.amount,0))}</h4><ul className="hb-evidence-list">{progress.expired.map(f=><li key={f.id}><time>{date(f.occurred_on.slice(0,10))}</time><span>{names[f.venture]??f.venture}</span><b>{money(f.amount)}</b></li>)}</ul></details>
          <h3>Footprints along the climb</h3><div className="hb-footprints">{history.map(h=><button key={h.through} aria-pressed={selectedDate===h.through} onClick={()=>{onLook(h.altitude);onSelect('history:'+h.through);}}><time>{date(h.through)}</time><b>{metres(h.altitude)}</b><span>{money(h.revenue)} trailing revenue</span></button>)}</div>
          <details open={Boolean(selectedDate)}><summary>All {log.length} recorded milestones</summary><ol className="hb-detail-log">{log.slice().reverse().map((m,i)=><li key={i}><time>{date(m.on)}</time><h4>{m.title}</h4><p>{m.detail}</p></li>)}</ol></details>
          <p className="hb-method">Reconstructed from current dated records, not saved historical snapshots. Corrections can change the past. Daily records: 24h compares Chicago calendar dates; there are no intraday ticks. Percent is altitude change divided by starting altitude, and is unavailable from zero.</p>
        </>}
        {(page==='climb'||page==='goal')&&<>
          {selectedObjective&&<section className="hb-detail-highlight"><h3>{selectedObjective.name}</h3><p>{metres(selectedObjective.altitude)} requires {money(selectedObjective.revenue)} in a rolling twelve-month window. Gap: {money(selectedObjective.gap)}.</p></section>}
          <p className="hb-detail-lead">Choose the next stretch. Each meter costs more as you climb; these requirements use the existing revenue scale.</p>
          <div className="hb-gain-choices" aria-label="Meters to climb">{[10,50,100,250,500].map(n=><button key={n} aria-pressed={gain===n} onClick={()=>setGain(n)}>+{n} m</button>)}</div>
          <div className="hb-detail-pair"><div><b>{metres(required.target)}</b><span>target altitude</span></div><div><b>{money(required.gap)}</b><span>additional trailing revenue</span></div></div>
          <p>Reach {money(required.revenue)} over twelve months; holding it means roughly {money(required.monthly)} a month. {money(required.expires30)} currently inside the window expires over the next 30 days and needs replacing.</p>
          <p className="hb-method">This is a requirement, not a sales forecast. No new revenue, customers or profit is assumed. Existing income can expire while you work toward the target.</p>
          <h3>The next ridgelines</h3><ul className="hb-ridge-list">{next.map(o=><li key={o.revenue}><button onClick={()=>{onLook(o.altitude);onSelect('goal:'+o.revenue);}}><b>{o.name}</b><span>{metres(o.altitude)}</span></button><p>{money(o.gap)} more; {money(o.monthly)}/month to sustain. {o.etaOn?`Constant recent pace reaches it around ${date(o.etaOn)}.`:'Not reachable at the current constant pace.'}</p></li>)}</ul>
        </>}
        {page==='camp'&&<>
          <p className="hb-detail-lead">Revenue sets altitude. Operational gates describe what must support the business at each camp; they do not award fictional revenue meters.</p>
          {(selectedCamp?[selectedCamp]:camps).map(c=><section className="hb-route-detail" key={c.id}><button onClick={()=>onLook(c.altitude)}><h3>{c.name}</h3><span>{metres(c.altitude)}</span></button><p>{c.era}</p><p>{c.revenue?`${money(c.revenue)} trailing annual revenue; ${money(Math.max(0,c.revenue-ex.revenue))} remaining.`:'The starting ground.'}</p><ul>{c.gates.map(g=><li key={g}>{g}<small>Evidence required</small></li>)}</ul><p className="hb-method">{ex.altitude>=c.altitude?'Revenue altitude reached.':'Revenue altitude not yet reached.'} Operational gate completion is not recorded here.</p></section>)}
          {selectedCamp&&<button className="hb3-btn" onClick={()=>onSelect('camp')}>Explore every camp</button>}
          <details><summary>The twenty-year pace line</summary><p>This is the required compounding path, not a predicted arrival date. It needs {(ex.ghost.requiredGrowth*100).toFixed(1)}% annual growth.</p><ul className="hb-timetable">{campSchedule(ex.ghost.start).map(c=><li key={c.id}><span>{c.name}</span><b>{date(c.dueOn)}</b></li>)}</ul></details>
        </>}
        {page==='achievements'&&<>
          <p className="hb-detail-lead">{badges.filter(b=>b.earned).length} earned from recorded evidence. Financial thresholds, customer relationships and company-building all have their own requirements.</p>
          <div className="hb-gain-choices" aria-label="Achievement category">{['All','Revenue','Customers','Operations','Company'].map(c=><button key={c} aria-pressed={filter===c} onClick={()=>setFilter(c)}>{c}</button>)}</div>
          <ul className="hb-achievement-list">{badges.filter(b=>filter==='All'||b.category===filter).map(b=><li key={b.id} data-earned={b.earned===true}><details><summary><span>{b.title}</span><small>{b.earned?`Earned${b.on?' · '+date(b.on):''}`:b.earned===null?'Evidence needed':'Not yet'}</small></summary><p>{b.requirement}</p>{b.value!==null&&<><progress max={b.target} value={Math.max(0,Math.min(b.value,b.target))} aria-label={b.title}/><p>{b.value.toLocaleString('en-US')} / {b.target.toLocaleString('en-US')}</p></>}<p className="hb-method">{b.evidence}</p>{b.value===null&&<Link href={`${base}/${b.category==='Customers'?'b/exterior/leads':b.category==='Operations'?'tasks':'finance'}`}>Inspect supporting records</Link>}</details></li>)}</ul>
        </>}
        {page==='records'&&<>
          <p className="hb-detail-lead">{money(ex.revenue)} recorded over the last 365 days places OJ at {metres(ex.altitude)}. Altitude follows a logarithmic revenue scale between the published camps.</p>
          <ul className="hb-evidence-list">{why.ventures.map(v=><li key={v.venture}><span>{v.name}</span><b>{money(v.revenue)}</b><small>{(v.share*100).toFixed(1)}%</small></li>)}</ul>
          <p>Recent 90-day income annualizes to {money(why.runRate)}, equivalent to {metres(why.runRateAltitude)}. This is a constant-pace scenario, not a forecast.</p>
          <h3>Financial completeness</h3><p>{t.lifetimeCosts===null?'No costs are recorded.':`${money(t.lifetimeCosts)} of lifetime costs are recorded.`} This does not establish complete expenses or verified profit. Recorded income is not independent evidence of bank settlement.</p>
          <p>{businesses.length} configured business segments. Legal ownership and the number of genuinely operating companies remain unverified.</p>
          <p>{ex.oxygen.detail}</p>
          <details><summary>Source coverage and calculation limits</summary><p>{coverage.length?coverage.map(s=>`${s.label}: ${s.state}`).join('; '):'No unavailable provider is reported in the loaded snapshot.'}</p><p>The dashboard loads at most 2,000 manual finance entries; connected-source history can have separate limits. Totals and reconstructed history describe loaded records, not an audited complete ledger. Missing history is not proof of zero activity.</p></details>
          <Link href={`${base}/finance`}>Inspect the Money records</Link>
        </>}
      </div>
    </dialog>
  </>;
});
