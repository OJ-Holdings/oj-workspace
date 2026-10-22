'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity, ArrowUpRight, CheckCircle2, Clock3, GitCompareArrows,
  RefreshCw, ServerCog, ShieldAlert, ShieldCheck,
} from 'lucide-react';
import { assessRelease, releaseLinks, type ReleaseAssessment } from '@/lib/release-health';

type Inspection={
  checkedAt:string;
  assessment:ReleaseAssessment;
  hostReached:boolean;
  githubReached:boolean;
};
const githubApi='https://api.github.com/repos/OJ-Holdings/oj-workspace/commits/main';
async function readJson(url:string,signal:AbortSignal):Promise<unknown> {
  const response=await fetch(url,{signal,cache:'no-store',headers:{Accept:'application/json'}});
  if(!response.ok)throw new Error('Source not available');
  return response.json() as Promise<unknown>;
}
const dateTime=(iso:string)=>new Date(iso).toLocaleString('en-US',{
  timeZone:'America/Chicago',dateStyle:'medium',timeStyle:'short',
});

export function SystemsHealthDesk({mode}:{mode:'live'|'preview'}){
  const [inspection,setInspection]=useState<Inspection|null>(null);
  const [busy,setBusy]=useState(false);
  const current=useRef<AbortController|null>(null);
  const inspect=useCallback(async()=>{
    if(mode!=='live')return;
    current.current?.abort();
    const controller=new AbortController();current.current=controller;
    setBusy(true);
    const timeout=setTimeout(()=>controller.abort(),8_000);
    const [host,github]=await Promise.allSettled([
      readJson('/api/deploy-health',controller.signal),
      readJson(githubApi,controller.signal),
    ]);
    clearTimeout(timeout);
    if(current.current!==controller)return;
    const h=host.status==='fulfilled'?host.value:null;
    const g=github.status==='fulfilled'?github.value:null;
    setInspection({
      checkedAt:new Date().toISOString(),
      assessment:assessRelease(h,g),
      hostReached:host.status==='fulfilled',
      githubReached:github.status==='fulfilled',
    });
    setBusy(false);
  },[mode]);
  useEffect(()=>{
    if(mode!=='live')return;
    void inspect();
    const interval=setInterval(()=>void inspect(),300_000);
    return ()=>{clearInterval(interval);current.current?.abort();current.current=null;};
  },[inspect,mode]);

  const report=inspection?.assessment;
  const matching=report?.state==='matched';
  return <main className="systems-health page">
    <header className="systems-hero">
      <p className="tools-eyebrow"><ServerCog size={16} aria-hidden="true"/> OJ HOLDINGS / SYSTEM OPERATIONS</p>
      <h1>Systems Health & Releases</h1>
      <p>See which source revision the application says it is running, compare that SHA with GitHub main, and open the release investigation tools. No hosting credentials, deployment triggers or company customer data are accessed here.</p>
      <div className="systems-hero-controls">
        <button onClick={()=>void inspect()} disabled={busy||mode!=='live'} type="button">
          <RefreshCw size={16} className={busy?'systems-spinning':''}/> {busy?'Checking sources…':'Check now'}
        </button>
        <span><Clock3 size={16}/>{inspection?'Last checked '+dateTime(inspection.checkedAt)+' Central':mode==='preview'?'No live checks in preview':'Not checked yet'}</span>
      </div>
    </header>
    {mode==='preview'?<section className="systems-panel">
      <h2>Preview does not inspect production</h2>
      <p>This fictional workspace mode never requests live release or GitHub data. Sign in to your authorized workspace for a real release comparison.</p>
    </section>:<>
      <section className={'systems-status systems-status--'+(report?.state||'pending')} aria-live="polite">
        {matching?<CheckCircle2 size={24}/>:<ShieldAlert size={24}/>}
        <div><span>DEPLOYMENT IDENTITY</span>
          <h2>{report?.label||(busy?'Checking application and source control…':'Awaiting a health check')}</h2>
          <p>{report?.detail||'This read-only check is limited to release identifiers; there is no claim about database, integrations, or CI.'}</p>
        </div>
      </section>
      <div className="systems-grid">
        <section className="systems-panel">
          <h2><Activity size={19}/> This application</h2>
          <p>Same-origin endpoint <code>/api/deploy-health</code>. It reports only sanitized release metadata.</p>
          <div className="systems-field"><span>Probe</span><b>{inspection?(inspection.hostReached?'Response received':'Unavailable'):'Not checked'}</b></div>
          <div className="systems-field"><span>Running SHA</span><code>{report?.runningSha??'Unknown / unmanaged'}</code></div>
          <small>This shows the app origin you opened. It does not inspect Windows processes, scheduled tasks, or a separate Netlify deployment.</small>
        </section>
        <section className="systems-panel">
          <h2><GitCompareArrows size={19}/> GitHub source</h2>
          <p>Public <b>OJ-Holdings/oj-workspace</b> main-branch commit. API availability is independent of application uptime.</p>
          <div className="systems-field"><span>GitHub API</span><b>{inspection?(inspection.githubReached?'Response received':'Unavailable / rate-limited'):'Not checked'}</b></div>
          <div className="systems-field"><span>Main SHA</span><code>{report?.mainSha??'Unknown'}</code></div>
          <a className="systems-link" href={releaseLinks.latest} target="_blank" rel="noreferrer">Inspect main commits <ArrowUpRight size={15}/></a>
        </section>
      </div>
      <section className="systems-panel">
        <h2><ShieldCheck size={19}/> Operational release gates</h2>
        <div className="systems-gates">
          <div><b>1. GitHub CI</b><span>Check GitHub Actions separately. A matching SHA does not establish successful tests.</span><a href={releaseLinks.actions} target="_blank" rel="noreferrer">Open CI results <ArrowUpRight size={14}/></a></div>
          <div><b>2. Windows deployment</b><span>A merged commit may be queued, blocked, or awaiting its scheduled updater. The Windows port 3011 verifier is authoritative for that host.</span><a href={releaseLinks.help} target="_blank" rel="noreferrer">Open verifier script <ArrowUpRight size={14}/></a></div>
          <div><b>3. Database protection</b><span>Production schema changes remain blocked until an actual recoverable Supabase backup and isolated restore drill are verified. This page does not verify backups.</span></div>
          <div><b>4. Founder smoke tests</b><span>Sign-in, real records, calendar, commercial estimator, Fleet Command and cross-device access require authenticated checks. No action here modifies them.</span></div>
        </div>
      </section>
    </>}
    <footer className="systems-foot"><ShieldCheck size={16}/> Read-only, best-effort external comparison. Checking the SHA does not deploy a release, approve a migration, or repair a failed host.</footer>
  </main>;
}
