'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Check, ChevronDown, Building2 } from 'lucide-react';
import { discoverableVentures, contentPersistenceEnabled, ventures, type VentureId } from '@/lib/ventures';
import { visibleBusinessRoute } from '@/lib/operator-shortcuts';

type Props = { base: '/workspace' | '/preview'; venture: VentureId | null };

/**
 * Which company you are looking at: all of OJ Holdings, or one division. Choosing a division opens that business room (which also
 * re-themes the screen to its logo colours); choosing Holdings returns to Today. Keyboard: Enter/Space opens, arrows move, Esc closes.
 */
export function EntitySwitcher({ base, venture }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const items: Array<{ id: VentureId | null; label: string; mark?: string }> = [
    { id: null, label: 'OJ Holdings' },
    ...discoverableVentures.map(v => ({ id: v.id, label: v.short, mark: v.mark })),
  ];
  const current = items.find(i => i.id === venture) ?? items[0];

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown); document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const choose = (id: VentureId | null) => {
    setOpen(false);
    router.push(id === null ? base : visibleBusinessRoute(base, id, contentPersistenceEnabled));
  };
  const move = (e: React.KeyboardEvent<HTMLUListElement>) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const buttons = [...(wrap.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    buttons[(at + (e.key === 'ArrowDown' ? 1 : -1) + buttons.length) % buttons.length]?.focus();
  };

  return (
    <div className="entity-switch" ref={wrap}>
      <button type="button" className="entity-switch-btn" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(v => !v)}>
        {current.mark ? <Image src={current.mark} alt="" width={22} height={22} /> : <Building2 size={18} aria-hidden="true" />}
        <span>{current.label}</span>
        <ChevronDown size={15} aria-hidden="true" />
      </button>
      {open && (
        <ul className="entity-switch-menu" role="menu" aria-label="Switch company" onKeyDown={move}>
          {items.map(item => (
            <li key={item.id ?? 'holdings'} role="none">
              <button type="button" role="menuitem" autoFocus={item.id === current.id} onClick={() => choose(item.id)}>
                {item.mark ? <Image src={item.mark} alt="" width={22} height={22} /> : <Building2 size={18} aria-hidden="true" />}
                <span>{item.label}{item.id === 'content' && !contentPersistenceEnabled ? ' (preview)' : ''}</span>
                {item.id === current.id && <Check size={15} aria-hidden="true" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** Used by tests and by anything that needs the display name for an entity. */
export const entityLabel = (id: VentureId | null) => (id ? ventures[id].short : 'OJ Holdings');
