'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import NumberFlow from '@number-flow/react';
import { ArrowUpRight, FileArchive, FileSpreadsheet, FileText, Plus, Send } from 'lucide-react';
import { ventureList, ventures, type VentureId } from '@/lib/ventures';
import { money, type WorkspaceMetrics } from '@/lib/metrics';

import { GhostChart, LineChart, Sparkline } from './Charts';
import type { Board } from './useBoard';
import type { DashboardStore } from './useDashboard';
import type { WorkStore } from './useWork';
import { Leaderboard } from './Leaderboard';
import { ExecutiveCommand } from './ExecutiveCommand';
import { CorporateLaunchpad } from './CorporateTools';
import { ConnectedOperationsPulse } from './ConnectedOperations';
import { CorporateIntelligencePulse } from './CorporateIntelligence';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { workDay } from '@/lib/task-workflows';

const color = (v: VentureId | 'shared') => `var(--c-${v})`;
const fileIcon = { pdf: FileText, doc: FileText, sheet: FileSpreadsheet, zip: FileArchive };

/** The Home screen before any figures exist: every panel then says what to log or connect. */
const nothingYet: WorkspaceMetrics = { months: [], ventures: { exterior: null, solutions: null, essentials: null, content: null }, pipeline: null, schedule: null, files: null, notes: null };

type Props = { base: string; board: Board; store: DashboardStore; work: WorkStore; metrics: WorkspaceMetrics | null; jobs: JobItem[]; mode: 'preview' | 'live'; displayName: string; members: string[]; readOnly: boolean; limited?: boolean };

export function HomeView({ base, board, store, work, metrics: derived, jobs, mode, displayName, members, readOnly, limited = false }: Props) {
  const metrics = derived ?? nothingYet;
  // While the sample workspace is still working out today's date, hold the panels back so nothing flashes as empty.
  const loading = !derived && !store.missing && mode === 'preview';
  const [note, setNote] = useState('');
  // The greeting depends on the visitor's clock, so it is set after load to keep server and browser output identical.
  const [todayKey, setTodayKey] = useState('');
  useEffect(() => {
    const refresh = () => { setTodayKey(workDay(new Date())); };
    refresh(); const timer = window.setInterval(refresh, 60_000); return () => window.clearInterval(timer);
  }, []);

  const cards = board.data.cards;
  const open = cards.filter(c => c.stage !== 'Done');
  const connected = ventureList.filter(v => metrics.ventures[v.id]);
  const total = connected.reduce((sum, v) => sum + (metrics.ventures[v.id]?.revenueMtd ?? 0), 0);
  // Today's tasks: anything due today or earlier and not done, then high priority work.

  const pipelineMax = Math.max(1, ...(metrics.pipeline ?? []).map(p => p.count));

  return (
    <div className={loading ? 'home is-loading' : 'home'}>
      <ExecutiveCommand base={base} board={board} store={store} metrics={metrics} jobs={jobs} mode={mode} today={todayKey} displayName={displayName} readOnly={readOnly} />
      <CorporateIntelligencePulse base={base} cards={board.data.cards} dashboard={store.data} jobs={jobs} today={todayKey} preview={mode === 'preview'} />
      <ConnectedOperationsPulse base={base} cards={board.data.cards} dashboard={store.data} jobs={jobs} today={todayKey} limited={limited} preview={mode==='preview'} />
      <CorporateLaunchpad base={base} />


      <section className="venture-cards" aria-label="Businesses">
        {ventureList.map(v => {
          const m = metrics.ventures[v.id];
          const tasks = open.filter(c => c.business === v.id).length;
          return (
            <article key={v.id} className="venture-card" data-venture={v.id}>
              <header>
                <span className="venture-mark"><Image src={v.mark} alt="" width={52} height={52} /></span>
                <div><h2>{v.name}</h2><p>{v.description}</p></div>
                <Link className="icon-button" href={`${base}/b/${v.id}`} aria-label={`Open ${v.name}`}><ArrowUpRight size={18} /></Link>
              </header>
              {m ? (
                <dl className="venture-stats">
                  <div><dd><NumberFlow value={m.revenueMtd} format={{ style: 'currency', currency: 'USD', maximumFractionDigits: 0, notation: m.revenueMtd >= 10000 ? 'compact' : 'standard' }} /></dd><dt>Recorded revenue this month</dt></div>
                  <div><dd><NumberFlow value={m.activeLeads} /></dd><dt>Active leads</dt></div>
                  <div><dd><NumberFlow value={tasks} /></dd><dt>Open tasks</dt></div>
                </dl>
              ) : (
                <div className="venture-unconnected">
                  <p><b>{tasks}</b> open {tasks === 1 ? 'task' : 'tasks'}</p>
                  <p className="quiet">Log money or leads for this business, or connect {v.source}, and its figures appear here.</p>
                </div>
              )}
              <footer>
                <Link className="primary" href={`${base}/b/${v.id}`}>Open dashboard</Link>
                {!readOnly && <button className="secondary" onClick={() => board.openCard(undefined, { business: v.id, title: '' })}><Plus size={15} aria-hidden="true" />New task</button>}
              </footer>
            </article>
          );
        })}
      </section>

      {store.data?.reporting?.sources.some(source => source.state === 'partial' || source.state === 'unavailable') && <p className="banner-inline">Some connected figures are incomplete or unavailable. Totals include only the records loaded. <Link href={`${base}/analytics`}>Review source coverage</Link> before comparing results.</p>}

      <div className="home-grid">
        <section className="panel panel-wide" aria-labelledby="rev-h">
          <header className="panel-head">
            <h2 id="rev-h">Recorded revenue overview</h2>
            {connected.length > 0 && <p className="panel-figure"><span>This month</span><b>{money(total)}</b></p>}
          </header>
          {connected.length > 0 ? (
            <LineChart labels={metrics.months} series={connected.map(v => ({ id: v.id, label: v.short, color: color(v.id), values: metrics.ventures[v.id]!.series }))} />
          ) : (
            <div className="empty"><GhostChart /><p><b>No revenue logged yet.</b> Log received payments in Finance. Recorded Exterior Care payments and fully paid USD Shopify order totals can also appear here. GoHighLevel deal values are not payments.</p></div>
          )}
          <p className="quiet">Based on entered dates, job dates and order dates, not verified collection dates. <Link href={`${base}/analytics`}>Inspect the records</Link>.</p>
        </section>

        <section className="panel" aria-labelledby="perf-h">
          <header className="panel-head"><h2 id="perf-h">Business performance</h2><span className="panel-note">This month</span></header>
          <ul className="perf">
            {ventureList.map(v => {
              const m = metrics.ventures[v.id];
              return (
                <li key={v.id}>
                  <span className="venture-mark venture-mark-sm" data-venture={v.id}><Image src={v.mark} alt="" width={30} height={30} /></span>
                  <span className="perf-name">{v.short}</span>
                  {m ? <>
                    <b>{money(m.revenueMtd)}</b>
                    {m.change === null ? <span className="delta" /> : <span className={m.change >= 0 ? 'delta up' : 'delta down'} title="This month so far compared with the full previous month; not a matched-period growth rate">{m.change >= 0 ? '+' : ''}{m.change}%</span>}
                    <Sparkline values={m.series} color={color(v.id)} />
                  </> : <span className="quiet perf-off">No recorded figures</span>}
                </li>
              );
            })}
          </ul>
          <p className="quiet">Change compares this month so far with the full previous month.</p>
        </section>

        <section className="panel" aria-labelledby="pipe-h">
          <header className="panel-head"><h2 id="pipe-h">Workspace leads pipeline</h2><Link className="panel-link" href={`${base}/crm`}>View all</Link></header>
          {metrics.pipeline ? (
            <ul className="pipeline">
              {metrics.pipeline.map(p => (
                <li key={p.stage}><span>{p.stage}</span><i><b style={{ width: `${(p.count / pipelineMax) * 100}%` }} data-stage={p.stage} /></i><strong>{p.count}</strong></li>
              ))}
            </ul>
          ) : <div className="empty"><p><b>No workspace leads yet.</b> Add one on Leads and CRM. Exterior Care and GoHighLevel keep their own pipelines in their business screens.</p></div>}
        </section>

        <section className="panel" aria-labelledby="files-h">
          <header className="panel-head"><h2 id="files-h">Recent files</h2><Link className="panel-link" href={`${base}/files`}>View all</Link></header>
          {metrics.files ? (
            <ul className="files">
              {metrics.files.map(file => {
                const Icon = fileIcon[file.kind];
                return <li key={file.id}><span className="file-icon" style={{ color: color(file.venture) }}><Icon size={17} aria-hidden="true" /></span><div><b>{file.name}</b><span>Updated {file.updated}</span></div></li>;
              })}
            </ul>
          ) : <div className="empty"><p><b>No documents yet.</b> Upload contracts, insurance and tax paperwork on the Files page.</p></div>}
        </section>

        <section className="panel" aria-labelledby="notes-h">
          <header className="panel-head"><h2 id="notes-h">Messages and notes</h2><Link className="panel-link" href={`${base}/messages`}>View all</Link></header>
          {metrics.notes ? (
            <ul className="notes">
              {metrics.notes.map(n => <li key={n.id}><span className="avatar">{n.author.charAt(0)}</span><div><b>{n.author}<time>{n.when}</time></b><p>{n.body}</p></div></li>)}
            </ul>
          ) : <div className="empty"><p><b>{store.missing ? 'Messages need one database update first.' : 'No messages yet.'}</b> {store.missing ? 'See Settings for what is left to switch on.' : 'Write the first note below.'}</p></div>}
          {!readOnly && !store.missing && (
            <form className="note-box" onSubmit={e => { e.preventDefault(); if (note.trim()) store.sendMessage(null, note, () => setNote('')); }}>
              <input placeholder="Write a note" aria-label="Write a note" maxLength={4000} value={note} onChange={e => setNote(e.target.value)} />
              <button className="icon-button" aria-label="Send note" disabled={store.pending || !note.trim()}><Send size={16} /></button>
            </form>
          )}
        </section>
      </div>
      <Leaderboard work={work} cards={cards} />
    </div>
  );
}

