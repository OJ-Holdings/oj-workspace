'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  ArrowUpRight, BriefcaseBusiness, CheckCircle2, CircleDashed, Clapperboard,
  Command, Compass, LockKeyhole, Search, ShieldCheck, Users, Wallet, Wrench,
} from 'lucide-react';
import {
  toolCategories, toolStatus, visibleTools,
  type CorporateTool, type ToolCategory, type ToolContext, type ToolStatus,
} from '@/lib/corporate-tools';

const categoryIcon = {
  Operate: BriefcaseBusiness,
  Grow: Compass,
  Finance: Wallet,
  Create: Clapperboard,
  People: Users,
  Control: ShieldCheck,
} as const;

const statusCopy: Record<ToolStatus, string> = {
  available: 'Available',
  'connection-required': 'Needs connection',
  preview: 'Preview only',
  planned: 'On the roadmap',
};

type Props = {
  base: string;
  owner: boolean;
  connections: ToolContext['connections'];
  mode: 'live' | 'preview';
};

export function CorporateToolsView({ base, owner, connections, mode }: Props) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<ToolCategory | 'All'>('All');
  const [status, setStatus] = useState<ToolStatus | 'all'>('all');
  const context = { owner, connections };
  const tools = visibleTools(context);
  const totals = {
    available: tools.filter(tool => toolStatus(tool, context) === 'available').length,
    connected: tools.filter(tool => toolStatus(tool, context) === 'connection-required').length,
    preview: tools.filter(tool => toolStatus(tool, context) === 'preview').length,
    planned: tools.filter(tool => toolStatus(tool, context) === 'planned').length,
  };
  const filtered = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase('en-US');
    return tools.filter(tool =>
      (category === 'All' || tool.category === category) &&
      (status === 'all' || toolStatus(tool, context) === status) &&
      (!needle || [tool.title, tool.description, tool.category, tool.keywords]
        .some(value => value.toLocaleLowerCase('en-US').includes(needle))),
    ).sort((a, b) => {
      const order: Record<ToolStatus, number> = { available: 0, 'connection-required': 1, preview: 2, planned: 3 };
      return order[toolStatus(a, context)] - order[toolStatus(b, context)] || a.title.localeCompare(b.title);
    });
  }, [tools, context, category, status, query]);

  return <div className="corporate-tools page">
    <header className="tools-hero">
      <p className="tools-eyebrow"><Command size={14} aria-hidden="true" /> OJ HOLDINGS / CORPORATE CAPABILITIES</p>
      <h1>Everything you need to <em>operate.</em></h1>
      <p>Find working tools, review what requires a connection, and see the systems being developed for the four-business headquarters. Planned tools cannot modify company records.</p>
      <div className="tools-statline" aria-label="Tool availability">
        <span><CheckCircle2 size={16} aria-hidden="true" /> <b>{totals.available}</b> available</span>
        <span><LockKeyhole size={16} aria-hidden="true" /> <b>{totals.connected}</b> need connection</span>
        <span><Clapperboard size={16} aria-hidden="true" /> <b>{totals.preview}</b> preview</span>
        <span><CircleDashed size={16} aria-hidden="true" /> <b>{totals.planned}</b> on the roadmap</span>
      </div>
      {mode === 'preview' && <p className="tools-demo-notice">Preview mode uses fictional workspace records. Provider connection indicators describe configured integrations, not demonstrated live account access.</p>}
    </header>

    <div className="tools-controls">
      <label className="tools-search"><Search size={18} aria-hidden="true" /><span className="sr-only">Find a tool</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search work, finance, content, equipment, automations…" /></label>
      <label className="tools-status-filter">Availability
        <select value={status} onChange={e => setStatus(e.target.value as ToolStatus | 'all')}>
          <option value="all">All statuses</option>
          <option value="available">Available now</option>
          <option value="connection-required">Needs connection</option>
          <option value="preview">Preview only</option>
          <option value="planned">Roadmap</option>
        </select>
      </label>
    </div>
    <div className="tools-categories" role="group" aria-label="Filter tool categories">
      {(['All', ...toolCategories] as const).map(item =>
        <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>,
      )}
    </div>
    <p className="tools-count" role="status">{filtered.length} matching {filtered.length === 1 ? 'tool' : 'tools'} · Only existing tools open workspace actions.</p>
    {filtered.length > 0 ? <div className="tools-grid">
      {filtered.map(tool => <ToolCard key={tool.id} tool={tool} context={context} base={base} />)}
    </div> : <div className="tools-empty">No tools match those filters. Try another category or search term.</div>}

    <aside className="tools-footer">
      <Wrench size={19} aria-hidden="true" />
      <div>
        <b>Built to grow with OJ Holdings</b>
        <p>Tools appear here as they pass implementation, access-control, and reliability checks. A roadmap item is never presented as an active integration or working automation.</p>
      </div>
      <Link href={base}>Return to Command <ArrowUpRight size={15} aria-hidden="true" /></Link>
    </aside>
  </div>;
}

function ToolCard({ tool, context, base }: { tool: CorporateTool; context: ToolContext; base: string }) {
  const state = toolStatus(tool, context);
  const Icon = categoryIcon[tool.category];
  const body = <>
    <div className="tools-card-top">
      <span className="tools-card-icon"><Icon size={19} aria-hidden="true" /></span>
      <span className={`tools-card-status tools-card-status--${state}`}>{statusCopy[state]}</span>
    </div>
    <h2>{tool.title}</h2>
    <p>{tool.description}</p>
    <div className="tools-card-bottom"><small>{tool.category}</small>
      {state !== 'planned' && <span>{state === 'preview' ? 'Open read-only preview' : state === 'available' ? 'Open tool' : 'Review connections'} <ArrowUpRight size={15} aria-hidden="true" /></span>}
      {state === 'planned' && <span>Not available yet</span>}
    </div>
  </>;
  if (state === 'planned') return <article className="tools-card tools-card--planned">{body}</article>;
  const href = state === 'connection-required'
    ? `${base}/settings`
    : tool.href === '/' ? base : `${base}${tool.href}`;
  return <Link href={href} className="tools-card tools-card--link">{body}</Link>;
}

const launchIds = ['intelligence', 'fleet', 'calendar', 'commercial-desk', 'solutions-outreach', 'scenario-lab'];
export function CorporateLaunchpad({ base }: { base: string }) {
  const pinned = launchIds.map(id => corporateLaunchTool(id));
  return <section className="corporate-launchpad" aria-label="Corporate tool launchpad">
    <div className="corporate-launchpad-head"><div><p className="tools-eyebrow">COMPANY OPERATIONS</p><h2>HQ Launchpad</h2><p>Open the tools that move real work forward.</p></div><Link href={`${base}/tools`}>All corporate tools <ArrowUpRight size={16} aria-hidden="true" /></Link></div>
    <div className="corporate-launchpad-list">
      {pinned.map(tool => <Link key={tool.id} href={tool.href === '/' ? base : `${base}${tool.href}`}><span>{tool.title}</span><ArrowUpRight size={14} aria-hidden="true" /></Link>)}
    </div>
  </section>;
}

function corporateLaunchTool(id: string): CorporateTool {
  const tool = visibleTools({ owner: false, connections: { shopify: false, ghl: false } }).find(item => item.id === id);
  if (!tool?.href || tool.integration) throw new Error(`Invalid launch tool: ${id}`);
  return tool;
}
