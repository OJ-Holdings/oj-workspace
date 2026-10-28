'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Hammer, Landmark, FileSignature, ShieldCheck, BarChart3, Bell, Building2, CalendarDays, CheckSquare, FileText, Home, LogOut, Menu, MessageSquare, Plus, Search, Settings, Users, UsersRound, Wallet, Wrench, Truck, MountainSnow, Activity as ActivityIcon, PanelLeftClose, PanelLeftOpen, UserRoundPlus, CalendarPlus, ReceiptText, ClipboardList, X, TrendingUp } from 'lucide-react';
import { discoverableVentures, contentPersistenceEnabled, type VentureId } from '@/lib/ventures';
import { visibleBusinessRoute } from '@/lib/operator-shortcuts';
import type { Activity, Card } from '@/lib/board';
import { signOut } from '@/app/workspace/actions';
import type { Dashboard } from '@/lib/dashboard';
import { searchWorkspace } from '@/lib/workspace-search';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { searchActiveTools } from '@/lib/corporate-tools';
import { EntitySwitcher } from './EntitySwitcher';
import { WindowTabs } from './WindowTabs';
import { StatusBar } from './StatusBar';
import { operatorActionHref } from '@/lib/operator-shortcuts';
import { commandIntents } from '@/lib/command-intents';
import { PulseBell } from './Pulse';

export type NavKey = 'home' | 'exterior-bookings' | 'exterior-leads' | 'businesses' | 'tasks' | 'calendar' | 'crm' | 'finance' | 'files' | 'messages' | 'analytics' | 'team' | 'settings' | 'tools' | 'fleet' | 'nexus' | 'invoices' | 'summit' | 'growth' | 'quality' | 'proposals' | 'customers' | 'books' | 'rig' | 'pulse';

type NavGroup='DAILY'|'BUSINESSES'|'MORE';
// Phase 0 (OJ OS): the rail is deliberately short. Retired destinations (company CRM, NEXUS, Project 360, the tools hub) stay reachable by URL
// for now but are no longer promoted; their keys remain in NavKey so existing pages keep working until they are deleted.
const nav: { key: NavKey; label: string; path: string; icon: typeof Home; group: NavGroup }[] = [
  { key:'home', label:'Today', path:'', icon:Home, group:'DAILY' },
  { key:'exterior-bookings', label:'Jobs', path:'/b/exterior/bookings', icon:Wrench, group:'DAILY' },
  { key:'exterior-leads', label:'Customers', path:'/b/exterior/leads', icon:UsersRound, group:'DAILY' },
  { key:'calendar', label:'Schedule', path:'/calendar', icon:CalendarDays, group:'DAILY' },
  { key:'tasks', label:'Crew', path:'/tasks', icon:CheckSquare, group:'DAILY' },
  { key:'growth', label:'Growth', path:'/growth', icon:TrendingUp, group:'DAILY' },
  { key:'finance', label:'Money', path:'/finance', icon:Wallet, group:'DAILY' },
  { key:'invoices', label:'Invoices', path:'/invoices', icon:ReceiptText, group:'DAILY' },
  { key:'analytics', label:'Insight', path:'/analytics', icon:BarChart3, group:'DAILY' },
  { key:'businesses', label:'Businesses', path:'/businesses', icon:Building2, group:'BUSINESSES' },
  // Founders only: hidden from every non-owner in the live workspace (see founderNav below).
  { key:'summit', label:'Hyperborea', path:'/summit', icon:MountainSnow, group:'BUSINESSES' },
  { key:'fleet', label:'Fleet & Equipment', path:'/tools/fleet', icon:Truck, group:'MORE' },
  { key:'customers', label:'Customer directory', path:'/customers', icon:UsersRound, group:'MORE' },
  { key:'proposals', label:'Proposals', path:'/proposals', icon:FileSignature, group:'MORE' },
  { key:'books', label:'Bank to books', path:'/books', icon:Landmark, group:'MORE' },
  { key:'rig', label:'Truck plan', path:'/rig', icon:Hammer, group:'MORE' },
  { key:'quality', label:'Data quality', path:'/quality', icon:ShieldCheck, group:'MORE' },
  { key:'files', label:'Files', path:'/files', icon:FileText, group:'MORE' },
  { key:'messages', label:'Messages', path:'/messages', icon:MessageSquare, group:'MORE' },
  { key:'team', label:'Team', path:'/team', icon:Users, group:'MORE' },
  { key:'settings', label:'Settings', path:'/settings', icon:Settings, group:'MORE' },
  { key:'tools', label:'System status', path:'/tools/systems', icon:ActivityIcon, group:'MORE' },
];

type Props = {
  base: string; current: NavKey; venture: VentureId | null; mode: 'preview' | 'live';
  members: string[]; displayName: string; owner: boolean; readOnly: boolean;
  openTasks: number; cards: Card[]; activity: Activity[]; status: string;
  /** The work timer, shown in the top bar on every page. */
  timer?: ReactNode;
  onOpenCard: (card: Card) => void; onNewCard: () => void; children: ReactNode;
  dashboard?: Dashboard | null; presence?: ReactNode;
  toolConnections: { shopify: boolean; ghl: boolean };
  jobs?: JobItem[];
};

const actionWord = { card_created: 'created', card_updated: 'updated', comment_added: 'commented on' } as const;

export function Shell({ base, current, venture, mode, members, displayName, owner, readOnly, openTasks, cards, activity, status, timer, onOpenCard, onNewCard, children, dashboard, presence, toolConnections, jobs = [] }: Props) {
  const router = useRouter();
  // Hyperborea is the founders' private expedition map: only owners (and the sample workspace) see it.
  const founderNav = useMemo(() => nav.filter(n => n.key !== 'summit' || mode === 'preview' || owner), [mode, owner]);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [bell, setBell] = useState(false);
  const [expandedGroups,setExpandedGroups]=useState<Record<'MORE',boolean|null>>({MORE:null});
  // Desktop rail can fold to an icon dock; the choice is remembered on this device.
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => { try { setCollapsed(window.localStorage.getItem('oj-rail-collapsed') === '1'); } catch { /* storage unavailable */ } }, []);
  const toggleRail = () => setCollapsed(v => { const next = !v; try { window.localStorage.setItem('oj-rail-collapsed', next ? '1' : '0'); } catch { /* storage unavailable */ } return next; });
  const searchInput = useRef<HTMLInputElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(true);
  const currentName=current==='pulse'?'Pulse':current==='nexus'?'Project 360':current==='exterior-bookings'?'Jobs & Bookings':current==='exterior-leads'?'Customers & Leads':venture?discoverableVentures.find(v=>v.id===venture)?.short??'Business Division':
    founderNav.find(item=>item.key===current)?.label??'Corporate Workspace';
  const role = mode === 'preview' ? 'Sample workspace' : owner ? 'Workspace owner' : readOnly ? 'View access' : 'Member';

  const openSearch = useCallback(() => {
    // Do not stack this modal over a task editor and its unsaved draft.
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (active?.closest('dialog[open], [aria-modal="true"]') && !palette.current?.contains(active)) return;
    if (!palette.current) previousFocus.current = active;
    restoreFocus.current = true;
    setDrawer(false); setBell(false); setSearch(true);
    searchInput.current?.focus();
  }, []);
  // Ctrl/Cmd+K opens search; browser Back dismisses it before the next route renders.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); openSearch(); }
      if (e.key === 'Escape') { setSearch(false); setBell(false); setDrawer(false); }
    };
    const onBack = () => { restoreFocus.current = false; setSearch(false); setBell(false); setDrawer(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('popstate', onBack);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('popstate', onBack); };
  }, [openSearch]);
  useEffect(() => { if (search) searchInput.current?.focus(); else setQuery(''); }, [search]);
  useEffect(() => {
    if (!search) return;
    const old = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const trap = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const items = palette.current?.querySelectorAll<HTMLElement>('input,button:not(:disabled),a[href]');
      if (!items?.length) return;
      if (!palette.current?.contains(document.activeElement)) { e.preventDefault(); items[0].focus(); }
      else if (e.shiftKey && document.activeElement === items[0]) { e.preventDefault(); items[items.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === items[items.length - 1]) { e.preventDefault(); items[0].focus(); }
    };
    document.addEventListener('keydown', trap);
    return () => {
      document.body.style.overflow = old; document.removeEventListener('keydown', trap);
      if (restoreFocus.current) (previousFocus.current?.isConnected ? previousFocus.current : trigger.current)?.focus();
    };
  }, [search]);
  const records = useMemo(() => searchWorkspace(query, cards, dashboard, jobs), [query, cards, dashboard, jobs]);
  const toolMatches = useMemo(() => searchActiveTools(query, { owner, connections: toolConnections }), [query, owner, toolConnections]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { pages: founderNav.slice(0, 5) };
    return {
      pages: [...founderNav, ...discoverableVentures.map(v => ({ key: 'businesses' as NavKey, label: v.name+(v.id==='content'&&!contentPersistenceEnabled?' · Preview':''), path: v.id==='content'&&!contentPersistenceEnabled?'/tools/content-preview':`/b/${v.id}`, icon: Building2 }))].filter(n => n.label.toLowerCase().includes(q)),
    };
  }, [query, founderNav]);

  const canAct = mode === 'live' && !readOnly;
  const quickActions = useMemo(() => {
    if (!canAct) return [];
    const root = base as '/workspace' | '/preview';
    const all = [
      { label: 'New lead', icon: UserRoundPlus, words: 'lead customer add capture', run: () => router.push(operatorActionHref(root, 'new-lead')) },
      { label: 'Book a job', icon: CalendarPlus, words: 'job booking schedule appointment', run: () => router.push(operatorActionHref(root, 'book-job')) },
      { label: 'Record expense', icon: ReceiptText, words: 'expense cost money receipt spend', run: () => router.push(operatorActionHref(root, 'record-expense', venture ?? undefined)) },
      { label: 'New task', icon: ClipboardList, words: 'task todo assign', run: () => onNewCard() },
    ];
    const q = query.trim().toLowerCase();
    return q ? all.filter(a => (a.label + ' ' + a.words).toLowerCase().includes(q)) : all;
  }, [canAct, base, venture, query, router, onNewCard]);

  // "complete fay", "invoice debbie", "log $84 chemicals on patrick": one-tap lines that open the right screen, never save by themselves.
  const intents = useMemo(() => canAct ? commandIntents(query, jobs, new Date().toLocaleDateString('en-CA', { timeZone: 'America/Chicago' }), base) : [], [canAct, query, jobs, base]);

  const go = (path: string) => { restoreFocus.current = false; setSearch(false); setDrawer(false); router.push(base + path); };

  return (
    <div className={collapsed ? 'shell atlas-shell is-rail-collapsed' : 'shell atlas-shell'} data-venture={venture ?? undefined}>
      <a className="skip-link" href="#main">Skip to content</a>
      {drawer && <button className="rail-scrim" aria-label="Close menu" onClick={() => setDrawer(false)} />}

      <aside className={drawer ? 'rail is-open' : 'rail'} aria-label="Main navigation" inert={search}>
        <div className="rail-head">
        <Link className="rail-brand" href={base || '/'} onClick={() => setDrawer(false)}>
          <span className="rail-logo" aria-hidden="true">OJ</span>
          <span className="atlas-brand-text"><strong>OJ OS</strong><small>OJ HOLDINGS</small></span>
        </Link>
        <button type="button" className="rail-collapse" onClick={toggleRail} aria-pressed={collapsed} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar to icons'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? <PanelLeftOpen size={17} aria-hidden="true" /> : <PanelLeftClose size={17} aria-hidden="true" />}
        </button>
        </div>
        <nav>
          {founderNav.map((item,i) => {
            const expandable=item.group==='MORE';
            const groupOpen=!expandable||(expandedGroups[item.group as 'MORE']??founderNav.some(n=>n.group===item.group&&n.key===current));
            return <div key={item.key}>
              {(i===0||founderNav[i-1].group!==item.group)&&(expandable
                ? <button type="button" className="atlas-rail-heading atlas-nav-group-toggle"
                  aria-expanded={groupOpen}
                  onClick={()=>setExpandedGroups(prev=>({...prev,[item.group]:!groupOpen}))}>
                    MORE
                    <span aria-hidden="true">{groupOpen?'−':'+'}</span>
                  </button>
                : <p className="atlas-rail-heading">{item.group==='DAILY'?'DO THE WORK':'YOUR BUSINESSES'}</p>)}
              {groupOpen&&<Link title={item.label} className={current === item.key ? 'rail-link is-current' : 'rail-link'} aria-current={current === item.key ? 'page' : undefined} href={base + item.path} onClick={() => setDrawer(false)}>
                <item.icon size={18} aria-hidden="true" /><span>{item.label}</span>
                {item.key === 'tasks' && openTasks > 0 && <b className="rail-count">{openTasks}</b>}
              </Link>}
              {item.key === 'businesses' && (
                <div className="rail-ventures">
                  {discoverableVentures.map(v => (
                    <Link key={v.id} className={venture === v.id ? 'rail-venture is-current' : 'rail-venture'} aria-current={venture === v.id ? 'page' : undefined}
                      href={visibleBusinessRoute(base as '/workspace'|'/preview',v.id,contentPersistenceEnabled)} onClick={() => setDrawer(false)}>
                      <Image src={v.mark} alt="" width={22} height={22} /><span>{v.short}{v.id==='content'&&!contentPersistenceEnabled?' · Preview':''}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>;
          })}
        </nav>

        <div className="rail-team">
          <p>Shared workspace</p>
          <div className="rail-members">
            {members.slice(0, 4).map(m => <span key={m} className="avatar" title={m}>{m.charAt(0).toUpperCase()}</span>)}
            <span className="rail-names">{members.slice(0, 2).join(' and ') || 'Just you so far'}</span>
          </div>
          {mode === 'live' && owner && <Link className="secondary rail-invite" href="/workspace/team"><Plus size={15} aria-hidden="true" />Invite</Link>}
          {mode === 'preview' && <Link className="secondary rail-invite" href="/login">Sign in</Link>}
        </div>
        <p className="rail-motto">Different skills. Same vision. Bigger together.</p>
      </aside>

      <div className="stage" inert={search}>
        <header className="topbar">
          <button className="icon-button topbar-menu" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={20} /></button>
          <EntitySwitcher base={base as '/workspace' | '/preview'} venture={venture} />
          <div className="atlas-crumb"><small>OJ HOLDINGS / OJ OS</small><strong>{currentName}</strong></div>
          <button ref={trigger} className="search-trigger" aria-haspopup="dialog" aria-expanded={search} onClick={openSearch}>
            <Search size={16} aria-hidden="true" /><span>Search anything</span><kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-right">
            {timer}
            {mode === 'live' && owner ? <PulseBell base={base} /> : <div className="bell-wrap">
              <button className="icon-button" aria-label={`Recent activity, ${activity.length} updates`} aria-expanded={bell} onClick={() => setBell(v => !v)}>
                <Bell size={18} />{activity.length > 0 && <i className="bell-dot" aria-hidden="true" />}
              </button>
              {bell && (
                <div className="popover" role="dialog" aria-label="Recent activity">
                  <h2>Recent activity</h2>
                  {activity.length === 0 && <p className="quiet">Nothing yet. Changes to tasks show up here.</p>}
                  {activity.slice(0, 8).map(event => {
                    const card = cards.find(c => c.id === event.card_id);
                    return (
                      <button key={event.id} className="popover-row" disabled={!card} onClick={() => { if (card) { setBell(false); onOpenCard(card); } }}>
                        <span className="avatar">{event.actor.charAt(0).toUpperCase()}</span>
                        <span><b>{event.actor}</b> {actionWord[event.action]} {card ? card.title : 'a task'}<time dateTime={event.created_at}>{new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(event.created_at))}</time></span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>}
            <div className="who">
              <span className="avatar avatar-lg">{(displayName || members[0] || 'O').charAt(0).toUpperCase()}</span>
              <span><b>{mode === 'preview' ? 'Oscar and Jacob' : displayName}</b><small>{role}</small></span>
            </div>
            {mode === 'live' && <form action={signOut}><button className="icon-button" aria-label="Sign out"><LogOut size={18} /></button></form>}
          </div>
        </header>
        <WindowTabs base={base} title={venture && current === 'businesses' ? (discoverableVentures.find(v => v.id === venture)?.short ?? currentName) : currentName} />
        {mode === 'preview' && <p className="banner">Sample workspace. Every figure and task here is made up, and changes stay in this browser. <Link href="/login">Sign in to your workspace</Link></p>}
        {mode === 'live' && status && <p className="banner banner-quiet" role="status">{status}</p>}
        {presence}
        <main id="main">{children}</main>
        <StatusBar jobs={jobs} openTasks={openTasks} status={status} mode={mode} />
      </div>

      <nav className="atlas-mobile-nav" aria-label="Mobile navigation" inert={search}>
        <Link href={base} className={current==='home'?'is-current':''} aria-current={current==='home'?'page':undefined}><Home size={19}/>Today</Link>
        <Link href={base+'/b/exterior/bookings'} className={current==='exterior-bookings'?'is-current':''} aria-current={current==='exterior-bookings'?'page':undefined}><CalendarDays size={19}/>Jobs</Link>
        <Link href={base+'/tasks'} className={current==='tasks'?'is-current':''} aria-current={current==='tasks'?'page':undefined}><CheckSquare size={19}/>Tasks</Link>
        <Link href={base+'/finance'} className={current==='finance'?'is-current':''} aria-current={current==='finance'?'page':undefined}><Wallet size={19}/>Money</Link>
        <button type="button" onClick={()=>{setDrawer(true);setBell(false)}} aria-label="Open all sections"><Menu size={19}/>More</button>
      </nav>
      {search && (
        <div className="palette-scrim" onClick={() => setSearch(false)}>
          <div ref={palette} className="palette" role="dialog" aria-modal="true" aria-label="Search" onClick={e => e.stopPropagation()}>
            <div className="palette-input">
              <Search size={18} aria-hidden="true" />
              <input ref={searchInput} value={query} onChange={e => setQuery(e.target.value)} placeholder="Go to a page, add something, or search records..." aria-label="Search workspace" />
              <button className="icon-button" aria-label="Close search" onClick={() => setSearch(false)}><X size={18} /></button>
            </div>
            <div className="palette-results">
              {intents.length > 0 && <p>Do it</p>}
              {intents.map(i => <button key={i.id} onClick={() => { restoreFocus.current = false; setSearch(false); if (i.external) window.open(i.href, '_blank', 'noopener,noreferrer'); else router.push(i.href); }}><Wrench size={16} aria-hidden="true" />{i.label}</button>)}
              {quickActions.length > 0 && <p>Quick actions</p>}
              {quickActions.map(a => <button key={a.label} onClick={() => { setSearch(false); a.run(); }}><a.icon size={16} aria-hidden="true" />{a.label}</button>)}
              {results.pages.length > 0 && <p>Pages</p>}
              {results.pages.map(p => <button key={p.path + p.label} onClick={() => go(p.path)}><p.icon size={16} aria-hidden="true" />{p.label}</button>)}
              {toolMatches.length > 0 && <p>Corporate tools</p>}
              {toolMatches.map(tool => <button key={tool.id} onClick={() => go(tool.href === '/' ? '' : tool.href!)}><Wrench size={16} aria-hidden="true" />{tool.title}</button>)}
              {records.length > 0 && <p>Workspace records</p>}
              {records.map(record => <button key={`${record.kind}-${record.id}`} className="search-record" onClick={() => go(record.path)}><span className="search-kind">{record.kind}</span><span><b>{record.title}</b><small>{record.detail}</small></span></button>)}
              {query.trim() && quickActions.length + results.pages.length + toolMatches.length + records.length === 0 && <p className="quiet" role="status">No loaded records match “{query}”. Try a name, task, or document. Connected business records also have search inside their business section.</p>}
            </div>
          </div>
        </div>
      )}
      {!readOnly && current === 'home' && <button className="fab" inert={search} onClick={onNewCard} aria-label="New task"><Plus size={22} /></button>}
    </div>
  );
}
