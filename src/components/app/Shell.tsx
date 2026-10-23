'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BarChart3, Bell, Building2, CalendarDays, CheckSquare, FileText, Home, LogOut, Menu, MessageSquare, Plus, Search, Settings, Users, UsersRound, Wallet, Wrench, Truck, Network, X } from 'lucide-react';
import { discoverableVentures, contentPersistenceEnabled, type VentureId } from '@/lib/ventures';
import { visibleBusinessRoute } from '@/lib/operator-shortcuts';
import type { Activity, Card } from '@/lib/board';
import { signOut } from '@/app/workspace/actions';
import type { Dashboard } from '@/lib/dashboard';
import { searchWorkspace } from '@/lib/workspace-search';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { searchActiveTools } from '@/lib/corporate-tools';

export type NavKey = 'home' | 'exterior-bookings' | 'exterior-leads' | 'businesses' | 'tasks' | 'calendar' | 'crm' | 'finance' | 'files' | 'messages' | 'analytics' | 'team' | 'settings' | 'tools' | 'fleet' | 'operations' | 'nexus';

type NavGroup='DAILY'|'BUSINESSES'|'MANAGEMENT'|'MORE';
const nav: { key: NavKey; label: string; path: string; icon: typeof Home; group: NavGroup }[] = [
  { key:'home', label:'Today', path:'', icon:Home, group:'DAILY' },
  { key:'exterior-bookings', label:'Jobs & Bookings', path:'/b/exterior/bookings', icon:CalendarDays, group:'DAILY' },
  { key:'exterior-leads', label:'Customers & Leads', path:'/b/exterior/leads', icon:UsersRound, group:'DAILY' },
  { key:'tasks', label:'My Tasks & Team Work', path:'/tasks', icon:CheckSquare, group:'DAILY' },
  { key:'finance', label:'Money & Expenses', path:'/finance', icon:Wallet, group:'DAILY' },
  { key:'businesses', label:'Our Businesses', path:'/businesses', icon:Building2, group:'BUSINESSES' },
  { key:'fleet', label:'Fleet & Equipment', path:'/tools/fleet', icon:Truck, group:'BUSINESSES' },
  { key:'calendar', label:'Company Calendar', path:'/calendar', icon:CalendarDays, group:'BUSINESSES' },
  { key:'crm', label:'Company CRM', path:'/crm', icon:UsersRound, group:'BUSINESSES' },
  { key:'operations', label:'NEXUS / Company View', path:'/tools/operations', icon:Network, group:'MANAGEMENT' },
  { key:'nexus', label:'Project 360', path:'/b/exterior/projects', icon:Network, group:'MANAGEMENT' },
  { key:'analytics', label:'Reports & Analytics', path:'/analytics', icon:BarChart3, group:'MANAGEMENT' },
  { key:'files', label:'Files & Documents', path:'/files', icon:FileText, group:'MORE' },
  { key:'messages', label:'Messages', path:'/messages', icon:MessageSquare, group:'MORE' },
  { key:'team', label:'Team', path:'/team', icon:Users, group:'MORE' },
  { key:'tools', label:'More Tools', path:'/tools', icon:Wrench, group:'MORE' },
  { key:'settings', label:'Settings', path:'/settings', icon:Settings, group:'MORE' },
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
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [bell, setBell] = useState(false);
  const [expandedGroups,setExpandedGroups]=useState<Record<'MANAGEMENT'|'MORE',boolean>>({MANAGEMENT:false,MORE:false});
  const searchInput = useRef<HTMLInputElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(true);
  const currentName=current==='nexus'?'Project 360':current==='exterior-bookings'?'Jobs & Bookings':current==='exterior-leads'?'Customers & Leads':venture?discoverableVentures.find(v=>v.id===venture)?.short??'Business Division':
    nav.find(item=>item.key===current)?.label??'Corporate Workspace';
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
    if (!q) return { pages: nav.slice(0, 5) };
    return {
      pages: [...nav, ...discoverableVentures.map(v => ({ key: 'businesses' as NavKey, label: v.name+(v.id==='content'&&!contentPersistenceEnabled?' · Preview':''), path: v.id==='content'&&!contentPersistenceEnabled?'/tools/content-preview':`/b/${v.id}`, icon: Building2 }))].filter(n => n.label.toLowerCase().includes(q)),
    };
  }, [query]);

  const go = (path: string) => { restoreFocus.current = false; setSearch(false); setDrawer(false); router.push(base + path); };

  return (
    <div className="shell atlas-shell" data-venture={venture ?? undefined}>
      <a className="skip-link" href="#main">Skip to content</a>
      {drawer && <button className="rail-scrim" aria-label="Close menu" onClick={() => setDrawer(false)} />}

      <aside className={drawer ? 'rail is-open' : 'rail'} aria-label="Main navigation" inert={search}>
        <Link className="rail-brand" href={base || '/'} onClick={() => setDrawer(false)}>
          <span className="rail-logo" aria-hidden="true">OJ</span>
          <span className="atlas-brand-text"><strong>ATLAS</strong><small>OJ HOLDINGS</small></span>
        </Link>
        <nav>
          {nav.map((item,i) => {
            const expandable=item.group==='MANAGEMENT'||item.group==='MORE';
            const groupOpen=!expandable||expandedGroups[item.group as 'MANAGEMENT'|'MORE']||nav.some(n=>n.group===item.group&&n.key===current);
            return <div key={item.key}>
              {(i===0||nav[i-1].group!==item.group)&&(expandable
                ? <button type="button" className="atlas-rail-heading atlas-nav-group-toggle"
                  aria-expanded={groupOpen}
                  onClick={()=>setExpandedGroups(prev=>({...prev,[item.group]:!prev[item.group as 'MANAGEMENT'|'MORE']}))}>
                    {item.group==='MANAGEMENT'?'MANAGEMENT / ANALYTICS':'MORE / SETTINGS'}
                    <span aria-hidden="true">{groupOpen?'−':'+'}</span>
                  </button>
                : <p className="atlas-rail-heading">{item.group==='DAILY'?'DO THE WORK':item.group==='BUSINESSES'?'YOUR BUSINESSES':item.group}</p>)}
              {groupOpen&&<Link className={current === item.key ? 'rail-link is-current' : 'rail-link'} aria-current={current === item.key ? 'page' : undefined} href={base + item.path} onClick={() => setDrawer(false)}>
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
          <div className="atlas-crumb"><small>OJ HOLDINGS / ATLAS</small><strong>{currentName}</strong></div>
          <button ref={trigger} className="search-trigger" aria-haspopup="dialog" aria-expanded={search} onClick={openSearch}>
            <Search size={16} aria-hidden="true" /><span>Search anything</span><kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-right">
            {timer}
            <div className="bell-wrap">
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
            </div>
            <div className="who">
              <span className="avatar avatar-lg">{(displayName || members[0] || 'O').charAt(0).toUpperCase()}</span>
              <span><b>{mode === 'preview' ? 'Oscar and Jacob' : displayName}</b><small>{role}</small></span>
            </div>
            {mode === 'live' && <form action={signOut}><button className="icon-button" aria-label="Sign out"><LogOut size={18} /></button></form>}
          </div>
        </header>
        {mode === 'preview' && <p className="banner">Sample workspace. Every figure and task here is made up, and changes stay in this browser. <Link href="/login">Sign in to your workspace</Link></p>}
        {mode === 'live' && status && <p className="banner banner-quiet" role="status">{status}</p>}
        {presence}
        <main id="main">{children}</main>
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
              <input ref={searchInput} value={query} onChange={e => setQuery(e.target.value)} placeholder="Tasks, leads, files, messages, events…" aria-label="Search workspace" />
              <button className="icon-button" aria-label="Close search" onClick={() => setSearch(false)}><X size={18} /></button>
            </div>
            <div className="palette-results">
              {results.pages.length > 0 && <p>Pages</p>}
              {results.pages.map(p => <button key={p.path + p.label} onClick={() => go(p.path)}><p.icon size={16} aria-hidden="true" />{p.label}</button>)}
              {toolMatches.length > 0 && <p>Corporate tools</p>}
              {toolMatches.map(tool => <button key={tool.id} onClick={() => go(tool.href === '/' ? '' : tool.href!)}><Wrench size={16} aria-hidden="true" />{tool.title}</button>)}
              {records.length > 0 && <p>Workspace records</p>}
              {records.map(record => <button key={`${record.kind}-${record.id}`} className="search-record" onClick={() => go(record.path)}><span className="search-kind">{record.kind}</span><span><b>{record.title}</b><small>{record.detail}</small></span></button>)}
              {query.trim() && results.pages.length + toolMatches.length + records.length === 0 && <p className="quiet" role="status">No loaded records match “{query}”. Try a name, task, or document. Connected business records also have search inside their business section.</p>}
            </div>
          </div>
        </div>
      )}
      {!readOnly && current === 'home' && <button className="fab" inert={search} onClick={onNewCard} aria-label="New task"><Plus size={22} /></button>}
    </div>
  );
}
