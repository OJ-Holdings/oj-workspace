'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight, ArrowUpRight, AlertCircle, CalendarDays, CheckCircle2,
  CircleAlert, ClipboardList, DatabaseZap, FileSearch, Filter, Radar, Search,
  ShieldCheck, Users,
} from 'lucide-react';
import type { Card } from '@/lib/board';
import type { Dashboard } from '@/lib/dashboard';
import type { JobItem } from '@/app/workspace/exterior-actions';
import {
  buildIntelligence, intelligenceCategories,
  type IntelligenceCategory, type IntelligenceSeverity,
} from '@/lib/corporate-intelligence';
import { ventureList, ventures, type VentureId } from '@/lib/ventures';
import { workDay } from '@/lib/task-workflows';

const severityNames: Record<IntelligenceSeverity,string> = {
  urgent: 'Overdue', attention: 'Needs attention', review: 'Check record', informational: 'Upcoming',
};
const categoryIcons = {
  Execution: ClipboardList,
  Pipeline: Users,
  Schedule: CalendarDays,
  'Data integrity': DatabaseZap,
} as const;

type Props = {
  base: string;
  cards: Card[];
  dashboard: Dashboard | null;
  jobs: JobItem[];
  mode: 'preview' | 'live';
};

export function CorporateIntelligenceDesk({ base, cards, dashboard, jobs, mode }: Props) {
  const [today, setToday] = useState('');
  const [category, setCategory] = useState<IntelligenceCategory | 'all'>('all');
  const [business, setBusiness] = useState<VentureId | 'all'>('all');
  const [query, setQuery] = useState('');
  const [includeUpcoming, setIncludeUpcoming] = useState(true);

  useEffect(() => {
    const refresh = () => setToday(workDay(new Date()));
    refresh();
    const timer = setInterval(refresh, 60_000);
    return () => clearInterval(timer);
  }, []);

  const report = useMemo(() =>
    today ? buildIntelligence({cards,dashboard,jobs,today}) : null,
    [cards,dashboard,jobs,today]);
  const entries = useMemo(() => {
    if (!report) return [];
    const needle=query.trim().toLocaleLowerCase('en-US');
    return report.signals.filter(item =>
      (category === 'all' || item.category === category) &&
      (business === 'all' || item.business === business) &&
      (includeUpcoming || item.severity !== 'informational') &&
      (!needle || [item.title,item.explanation,item.source,item.category]
        .some(value => value.toLocaleLowerCase('en-US').includes(needle))));
  }, [report,category,business,query,includeUpcoming]);

  const totals = report?.totals;
  return <main className="intelligence page">
    <header className="intelligence-hero">
      <p className="tools-eyebrow"><Radar size={15} aria-hidden="true"/> OJ HOLDINGS / CORPORATE INTELLIGENCE</p>
      <div className="intelligence-hero-row">
        <div>
          <h1>Know what needs <em>your attention.</em></h1>
          <p>An evidence-linked view of unfinished work, dated commitments, stage follow-ups and incomplete reporting. Built only from records your workspace session already has permission to read.</p>
        </div>
        <div className="intelligence-hero-mark" aria-hidden="true"><Radar size={43}/><span>CONTROL DESK</span></div>
      </div>
      <div className="intelligence-evidence"><ShieldCheck size={16} aria-hidden="true"/>
        {mode === 'preview'
          ? 'Fictional sample workspace data — not a status report on your real company.'
          : 'Read-only intelligence, not an AI prediction or a live bank reconciliation. No messages, approvals or changes are sent.'}
      </div>
    </header>

    <div className="intelligence-kpis" aria-label="Operational record summary">
      <div><span><AlertCircle size={16}/> Overdue tasks</span><strong>{totals ? totals.overdueTasks : '—'}</strong><small>Due before today; still unfinished</small></div>
      <div><span><ClipboardList size={16}/> Review queue</span><strong>{totals ? totals.reviewTasks : '—'}</strong><small>Work marked Review, not approved</small></div>
      <div><span><Users size={16}/> Unassigned tasks</span><strong>{totals ? totals.unassignedTasks : '—'}</strong><small>Unfinished work needing an owner</small></div>
      <div><span><CalendarDays size={16}/> Next 7 days</span><strong>{totals ? totals.upcomingExterior : '—'}</strong><small>Loaded Exterior bookings only</small></div>
    </div>

    <div className="intelligence-layout">
      <section className="intelligence-feed" aria-labelledby="intelligence-feed-title">
        <header className="intelligence-section-head">
          <div><p className="tools-eyebrow">ACTIONABLE EXCEPTIONS</p><h2 id="intelligence-feed-title">Operations briefing</h2>
            <p>Sorted by a transparent, fixed urgency rule: overdue commitments, same-day needs, reviews, and data checks.</p>
          </div>
          <span className="intelligence-date">{today || 'Loading business date'} · Central</span>
        </header>

        <div className="intelligence-filterbar">
          <label className="intelligence-search"><Search size={18} aria-hidden="true"/><span className="sr-only">Search the briefing</span>
            <input placeholder="Search work, people or sources…" value={query} onChange={event=>setQuery(event.target.value)}/></label>
          <label>Category
            <select value={category} onChange={event=>setCategory(event.target.value as IntelligenceCategory|'all')}>
              <option value="all">All categories</option>
              {intelligenceCategories.map(c=><option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label>Business
            <select value={business} onChange={event=>setBusiness(event.target.value as VentureId|'all')}>
              <option value="all">All businesses</option>
              {ventureList.map(v=><option key={v.id} value={v.id}>{v.short}</option>)}
            </select>
          </label>
        </div>
        <label className="intelligence-toggle"><input type="checkbox" checked={includeUpcoming} onChange={event=>setIncludeUpcoming(event.target.checked)}/>
          Include upcoming schedule entries</label>
        <p className="intelligence-count" role="status">{report ? entries.length+' matching signals from '+report.signals.length+' total' : 'Loading authorized records…'}</p>

        {entries.length ?
          <ol className="intelligence-signals">
            {entries.map((signal,index)=>{
              const Icon=categoryIcons[signal.category];
              return <li key={signal.id} className={'intelligence-signal intelligence-signal--'+signal.severity}>
                <div className="intelligence-signal-icon"><Icon size={17} aria-hidden="true"/></div>
                <div className="intelligence-signal-body">
                  <div className="intelligence-signal-meta"><span>{signal.category}</span><span className={'intelligence-pill intelligence-pill--'+signal.severity}>{severityNames[signal.severity]}</span></div>
                  <h3>{signal.title}</h3>
                  <p>{signal.explanation}</p>
                  <div className="intelligence-signal-bottom">
                    <small>{signal.source} {signal.business ? ' · '+ventures[signal.business].short : ' · Corporate'}</small>
                    <Link href={base+signal.destination} aria-label={'Open source record for '+signal.title}>Open record <ArrowUpRight size={14} aria-hidden="true"/></Link>
                  </div>
                </div>
              </li>;
            })}
          </ol> : <div className="intelligence-empty">
            <CheckCircle2 size={26} aria-hidden="true"/>
            <strong>{report ? 'No records match these filters.' : 'Preparing the briefing.'}</strong>
            <p>{report ? 'This is not proof that the entire corporation has no issues. Change filters, and inspect the source coverage to see what is missing.' : 'Only loaded, authorized records are considered.'}</p>
          </div>}
        <div className="intelligence-endnote"><CircleAlert size={16} aria-hidden="true"/>
          A lead flagged for follow-up might have been contacted elsewhere. Recorded booking dates do not confirm a crew has accepted an assignment. Review source records before acting.
        </div>
      </section>

      <aside className="intelligence-aside">
        <section className="intelligence-panel">
          <div className="intelligence-panel-icon"><FileSearch size={19}/></div>
          <p className="tools-eyebrow">SOURCE COVERAGE</p><h2>What this briefing knows</h2>
          <dl>
            <div><dt>Shared task cards loaded</dt><dd>{report?.coverage.boardRecords ?? '—'}</dd></div>
            <div><dt>Shared CRM leads loaded</dt><dd>{report?.coverage.sharedLeads ?? 'Unknown'}</dd></div>
            <div><dt>Exterior booking rows loaded</dt><dd>{report?.coverage.exteriorBookings ?? '—'}</dd></div>
            <div><dt>Provider status</dt><dd>{report?.coverage.providers === 'reported' ? 'Reported' : 'Not supplied'}</dd></div>
            <div><dt>Completed Exterior jobs</dt><dd>{report?.coverage.completedExteriorJobs ?? 'Unknown'}</dd></div>
            <div><dt>Jobs with direct costs entered</dt><dd>{report?.coverage.exteriorCostsRecorded ?? 'Unknown'}</dd></div>
          </dl>
          <p>Loaded counts may reflect limits or failed integrations. Missing details cannot be interpreted as healthy operations or zero expenses.</p>
          <Link href={base+'/analytics'}>Inspect full analytics <ArrowRight size={15} aria-hidden="true"/></Link>
        </section>
        <section className="intelligence-panel">
          <p className="tools-eyebrow">EXECUTE</p><h2>Jump into the work.</h2>
          <div className="intelligence-actions">
            <Link href={base+'/tasks'}><ClipboardList size={17}/> Task board <ArrowUpRight size={15}/></Link>
            <Link href={base+'/b/exterior/bookings'}><CalendarDays size={17}/> Exterior bookings <ArrowUpRight size={15}/></Link>
            <Link href={base+'/crm'}><Users size={17}/> CRM follow-up <ArrowUpRight size={15}/></Link>
            <Link href={base+'/tools'}><Filter size={17}/> All corporate tools <ArrowUpRight size={15}/></Link>
          </div>
        </section>
      </aside>
    </div>
    <p className="intelligence-footnote">This desk creates no new records, scores no customer automatically, and does not infer the state of integrations that failed to load. It is a triage aid, not a substitute for source-led financial or operational review.</p>
  </main>;
}
