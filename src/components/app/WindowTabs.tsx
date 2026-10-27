'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { X } from 'lucide-react';

type Tab = { path: string; title: string };
const KEY = 'oj-os-windows-v1';
const MAX = 8;

/**
 * Open "windows": every screen you visit becomes a tab (kept for this browser session) so Jobs, a customer, an invoice and Money can all
 * stay one click away, like apps on a desktop. Closing the current one returns to its neighbour. Nothing here touches data.
 */
export function WindowTabs({ base, title }: { base: string; title: string }) {
  const pathname = usePathname() ?? base;
  const router = useRouter();
  const [tabs, setTabs] = useState<Tab[]>([]);
  const ready = useRef(false);

  useEffect(() => {
    try { const saved = JSON.parse(window.sessionStorage.getItem(KEY) || '[]'); if (Array.isArray(saved)) setTabs(saved.filter((t: Tab) => typeof t?.path === 'string' && typeof t?.title === 'string' && t.path.startsWith(base)).slice(-MAX)); } catch { /* none saved */ }
    ready.current = true;
  }, [base]);

  useEffect(() => {
    if (!ready.current) return;
    setTabs(prev => {
      const exists = prev.some(t => t.path === pathname);
      const next = exists ? prev.map(t => (t.path === pathname ? { ...t, title } : t)) : [...prev, { path: pathname, title }].slice(-MAX);
      try { window.sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, [pathname, title]);

  const close = (path: string) => {
    const index = tabs.findIndex(t => t.path === path);
    const next = tabs.filter(t => t.path !== path);
    setTabs(next);
    try { window.sessionStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
    if (path === pathname) router.push((next[Math.max(0, index - 1)]?.path) ?? base);
  };

  if (tabs.length < 2) return null;
  return (
    <nav className="os-tabs" aria-label="Open windows">
      <ul>
        {tabs.map(tab => (
          <li key={tab.path} className={tab.path === pathname ? 'is-current' : undefined}>
            <Link href={tab.path} aria-current={tab.path === pathname ? 'page' : undefined}>{tab.title}</Link>
            <button type="button" aria-label={`Close ${tab.title}`} onClick={() => close(tab.path)}><X size={13} aria-hidden="true" /></button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
