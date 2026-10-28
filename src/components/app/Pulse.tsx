'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Bell } from 'lucide-react';
import { loadPulse, type PulseLoad } from '@/app/workspace/pulse-actions';
import { ago, dayLabel, scoreboard } from '@/lib/pulse';

type State = { data: PulseLoad | null; fresh: number; notice: string; refresh: () => void; dismiss: () => void };
const Context = createContext<State>({ data: null, fresh: 0, notice: '', refresh: () => {}, dismiss: () => {} });
export function PulseProvider({ org, base, enabled, children }: { org: string; base: string; enabled: boolean; children: ReactNode }) {
  const [data, setData] = useState<PulseLoad | null>(null);
  const [fresh, setFresh] = useState(0);
  const [notice, setNotice] = useState('');
  const seen = useRef<Set<string> | null>(null);
  const active = useRef(true);
  const pending = useRef(false);
  const refresh = useCallback(async () => {
    if (!enabled || pending.current) return;
    pending.current = true;
    try {
      const result = await loadPulse(org, base);
      if (!active.current) return;
      if (result.ok) {
        const ids = new Set(result.events.map(e => e.id));
        if (seen.current) {
          const added = result.events.filter(e => !seen.current!.has(e.id));
          if (added.length) { setFresh(n => n + added.length); setNotice(`${added.length} new Pulse update${added.length === 1 ? '' : 's'}`); }
        }
        seen.current = ids;
      }
      setData(result);
    } catch { if (active.current) setData({ ok: false }); }
    finally { pending.current = false; }
  }, [org, base, enabled]);
  useEffect(() => {
    active.current = true; seen.current = null; setData(null); setFresh(0); setNotice('');
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 60_000);
    const visible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', visible);
    return () => { active.current = false; window.clearInterval(timer); document.removeEventListener('visibilitychange', visible); };
  }, [refresh]);
  const dismiss = () => { setFresh(0); setNotice(''); };
  return <Context.Provider value={{ data, fresh, notice, refresh, dismiss }}>{children}{notice && <div className="pulse-toast" role="status">{notice} <button onClick={dismiss} aria-label="Dismiss update">×</button></div>}</Context.Provider>;
}

export function PulseBell({ base }: { base: string }) {
  const { data, fresh, dismiss } = useContext(Context);
  return <Link className="pulse-bell" href={`${base}/pulse`} onClick={dismiss} aria-label={data?.ok ? `Pulse, ${fresh} new updates since opening` : 'Open Pulse'}><Bell size={18} aria-hidden="true" />{fresh > 0 && <b>{fresh > 99 ? '99+' : fresh}</b>}</Link>;
}

export function PulseCard({ base }: { base: string }) {
  const { data } = useContext(Context);
  if (!data?.ok) return null;
  const latest = data.events[0];
  return <Link className="pulse-card" href={`${base}/pulse`}><span>Company Pulse</span><strong>{latest ? `${latest.who} ${latest.text}` : 'No recent activity in the available sources'}</strong><small>{latest ? ago(latest.at, data.now) : 'Open Pulse'} · View activity</small></Link>;
}

export function PulsePage() {
  const { data, refresh, dismiss } = useContext(Context);
  useEffect(() => { dismiss(); }, []); // Opening the page acknowledges this session's indicator.
  if (!data) return <div className="page"><h1>Pulse</h1><p>Loading activity…</p></div>;
  if (!data.ok) return <div className="page"><h1>Pulse unavailable</h1><p>Sign in as a workspace owner or check your connection.</p><button onClick={refresh}>Try again</button></div>;
  const board = scoreboard(data.events, data.people, data.now);
  let previous = '';
  return <div className="page pulse-page"><header className="page-head"><h1>Pulse</h1><p>Real activity from the last 30 days. Refreshes while this page is open.</p></header>
    {data.incomplete && <p className="pulse-warning" role="status">Some sources are unavailable, limited, or not yet connected. Activity and scores may be incomplete.</p>}
    <div className="pulse-scoreboard">{board.map(p => <div key={p.name}><span>{p.name}</span><strong>{p.today} <small>today</small></strong><p>Level {p.lvl.level} · {p.week} this week · {p.streak} day streak</p><small>Points from the activity shown, not lifetime totals</small></div>)}</div>
    <section aria-label="Activity feed"><h2>Recent activity</h2>{!data.events.length && <p>No activity in the available sources.</p>}{data.events.map(e => {
      const day = dayLabel(e.at, data.now); const heading = day !== previous; previous = day;
      return <div key={e.id}>{heading && <h3>{day}</h3>}<article className="pulse-entry"><span className="pulse-avatar">{e.who.charAt(0).toUpperCase()}</span><div><p><b>{e.who}</b> {e.text}</p><small>{ago(e.at, data.now)}{e.xp > 0 ? ` · +${e.xp} points` : ''}</small></div>{e.href && <Link href={e.href}>Open</Link>}</article></div>;
    })}</section></div>;
}
