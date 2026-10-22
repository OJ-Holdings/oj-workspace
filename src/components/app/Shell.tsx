'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BarChart3, Bell, Building2, CalendarDays, CheckSquare, FileText, Home, LogOut, Menu, MessageSquare, Plus, Search, Settings, Users, UsersRound, Wallet, Wrench, X } from 'lucide-react';
import { ventureList, type VentureId } from '@/lib/ventures';
import type { Activity, Card } from '@/lib/board';
import { signOut } from '@/app/workspace/actions';
import type { Dashboard } from '@/lib/dashboard';
import { searchWorkspace } from '@/lib/workspace-search';
import { searchActiveTools } from '@/lib/corporate-tools';

export type NavKey = 'home' | 'businesses' | 'tasks' | 'calendar' | 'crm' | 'finance' | 'files' | 'messages' | 'analytics' | 'team' | 'settings' | 'tools';

const nav: { key: NavKey; label: string; path: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Command', path: '', icon: Home },
  { key: 'businesses', label: 'Businesses', path: '/businesses', icon: Building2 },
  { key: 'tools', label: 'All Tools', path: '/tools', icon: Wrench },
  { key: 'tasks', label: 'Tasks', path: '/tasks', icon: CheckSquare },
  { key: 'calendar', label: 'Calendar', path: '/calendar', icon: CalendarDays },
  { key: 'crm', label: 'Leads & CRM', path: '/crm', icon: UsersRound },
  { key: 'finance', label: 'Finance', path: '/finance', icon: Wallet },
  { key: 'files', label: 'Files', path: '/files', icon: FileText },
  { key: 'messages', label: 'Messages', path: '/messages', icon: MessageSquare },
  { key: 'analytics', label: 'Analytics', path: '/analytics', icon: BarChart3 },
  { key: 'team', label: 'Team', path: '/team', icon: Users },
  { key: 'settings', label: 'Settings', path: '/settings', icon: Settings },
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
};

const actionWord = { card_created: 'created', card_updated: 'updated', comment_added: 'commented on' } as const;

export function Shell({ base, current, venture, mode, members, displayName, owner, readOnly, openTasks, cards, activity, status, timer, onOpenCard, onNewCard, children, dashboard, presence, toolConnections }: Props) {
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [bell, setBell] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const palette = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const restoreFocus = useRef(true);
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
  const records = useMemo(() => searchWorkspace(query, cards, dashboard), [query, cards, dashboard]);
  const toolMatches = useMemo(() => searchActiveTools(query, { owner, connections: toolConnections }), [query, owner, toolConnections]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { pages: nav.slice(0, 5) };
    return {
      pages: [...nav, ...ventureList.map(v => ({ key: 'businesses' as NavKey, label: v.name, path: `/b/${v.id}`, icon: Building2 }))].filter(n => n.label.toLowerCase().includes(q)),
    };
  }, [query]);

  const go = (path: string) => { restoreFocus.current = false; setSearch(false); setDrawer(false); router.push(base + path); };

  return (
    <div className="shell" data-venture={venture ?? undefined}>
      <a className="skip-link" href="#main">Skip to content</a>
      {drawer && <button className="rail-scrim" aria-label="Close menu" onClick={() => setDrawer(false)} />}

      <aside className={drawer ? 'rail is-open' : 'rail'} aria-label="Main navigation" inert={search}>
        <Link className="rail-brand" href={base || '/'} onClick={() => setDrawer(false)}>
          <span className="rail-logo" aria-hidden="true">OJ</span>
          <span>Workspace</span>
        </Link>
        <nav>
          {nav.map(item => (
            <div key={item.key}>
              <Link className={current === item.key ? 'rail-link is-current' : 'rail-link'} aria-current={current === item.key ? 'page' : undefined} href={base + item.path} onClick={() => setDrawer(false)}>
                <item.icon size={18} aria-hidden="true" /><span>{item.label}</span>
                {item.key === 'tasks' && openTasks > 0 && <b className="rail-count">{openTasks}</b>}
              </Link>
              {item.key === 'businesses' && (
                <div className="rail-ventures">
                  {ventureList.map(v => (
                    <Link key={v.id} className={venture === v.id ? 'rail-venture is-current' : 'rail-venture'} aria-current={venture === v.id ? 'page' : undefined} href={`${base}/b/${v.id}`} onClick={() => setDrawer(false)}>
                      <Image src={v.mark} alt="" width={22} height={22} /><span>{v.short}</span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
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
