'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { BarChart3, Bell, Building2, CalendarDays, CheckSquare, FileText, Home, LogOut, Menu, MessageSquare, Plus, Search, Settings, Users, UsersRound, Wallet, X } from 'lucide-react';
import { ventureList, type VentureId } from '@/lib/ventures';
import type { Activity, Card } from '@/lib/board';
import { signOut } from '@/app/workspace/actions';

export type NavKey = 'home' | 'businesses' | 'tasks' | 'calendar' | 'crm' | 'finance' | 'files' | 'messages' | 'analytics' | 'team' | 'settings';

const nav: { key: NavKey; label: string; path: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', path: '', icon: Home },
  { key: 'businesses', label: 'Businesses', path: '/businesses', icon: Building2 },
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
  onOpenCard: (card: Card) => void; onNewCard: () => void; children: ReactNode;
};

const actionWord = { card_created: 'created', card_updated: 'updated', comment_added: 'commented on' } as const;

export function Shell({ base, current, venture, mode, members, displayName, owner, readOnly, openTasks, cards, activity, status, onOpenCard, onNewCard, children }: Props) {
  const router = useRouter();
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);
  const [query, setQuery] = useState('');
  const [bell, setBell] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const role = mode === 'preview' ? 'Sample workspace' : owner ? 'Workspace owner' : readOnly ? 'View access' : 'Member';

  // Ctrl/Cmd+K opens search from anywhere; Escape closes whatever is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch(true); }
      if (e.key === 'Escape') { setSearch(false); setBell(false); setDrawer(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  useEffect(() => { if (search) searchInput.current?.focus(); else setQuery(''); }, [search]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { pages: nav.slice(0, 5), cards: [] as Card[] };
    return {
      pages: [...nav, ...ventureList.map(v => ({ key: 'businesses' as NavKey, label: v.name, path: `/b/${v.id}`, icon: Building2 }))].filter(n => n.label.toLowerCase().includes(q)),
      cards: cards.filter(c => `${c.title} ${c.description} ${c.assignee}`.toLowerCase().includes(q)).slice(0, 8),
    };
  }, [query, cards]);

  const go = (path: string) => { setSearch(false); setDrawer(false); router.push(base + path); };

  return (
    <div className="shell" data-venture={venture ?? undefined}>
      <a className="skip-link" href="#main">Skip to content</a>
      {drawer && <button className="rail-scrim" aria-label="Close menu" onClick={() => setDrawer(false)} />}

      <aside className={drawer ? 'rail is-open' : 'rail'} aria-label="Main navigation">
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

      <div className="stage">
        <header className="topbar">
          <button className="icon-button topbar-menu" aria-label="Open menu" aria-expanded={drawer} onClick={() => setDrawer(true)}><Menu size={20} /></button>
          <button className="search-trigger" onClick={() => setSearch(true)}>
            <Search size={16} aria-hidden="true" /><span>Search anything</span><kbd>Ctrl K</kbd>
          </button>
          <div className="topbar-right">
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
        <main id="main">{children}</main>
      </div>

      {search && (
        <div className="palette-scrim" onClick={() => setSearch(false)}>
          <div className="palette" role="dialog" aria-modal="true" aria-label="Search" onClick={e => e.stopPropagation()}>
            <div className="palette-input">
              <Search size={18} aria-hidden="true" />
              <input ref={searchInput} value={query} onChange={e => setQuery(e.target.value)} placeholder="Search tasks and pages" aria-label="Search tasks and pages" />
              <button className="icon-button" aria-label="Close search" onClick={() => setSearch(false)}><X size={18} /></button>
            </div>
            <div className="palette-results">
              {results.pages.length > 0 && <p>Pages</p>}
              {results.pages.map(p => <button key={p.path + p.label} onClick={() => go(p.path)}><p.icon size={16} aria-hidden="true" />{p.label}</button>)}
              {results.cards.length > 0 && <p>Tasks</p>}
              {results.cards.map(c => <button key={c.id} onClick={() => { setSearch(false); onOpenCard(c); }}><CheckSquare size={16} aria-hidden="true" />{c.title}<small>{c.stage}</small></button>)}
              {query && results.pages.length + results.cards.length === 0 && <p className="quiet">Nothing matches "{query}". Leads, files and messages become searchable as those sections are connected.</p>}
            </div>
          </div>
        </div>
      )}
      {!readOnly && current !== 'tasks' && <button className="fab" onClick={onNewCard} aria-label="New task"><Plus size={22} /></button>}
    </div>
  );
}
