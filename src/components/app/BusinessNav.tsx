'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ventures, type VentureId } from '@/lib/ventures';

export type BusinessSection = readonly [string, string];
const groups = [
  { label: 'Work', sections: ['overview', 'board', 'bookings', 'calendar'] },
  { label: 'Customers', sections: ['leads', 'clients', 'outreach', 'calls', 'quotes', 'door-knocking', 'orders'] },
  { label: 'Results', sections: ['jobs', 'money', 'metrics', 'products', 'inventory'] },
  { label: 'Workspace', sections: ['documents', 'activity', 'upgrades', 'settings'] },
];

export function BusinessNav({ base, venture, active, tabs }: { base: string; venture: VentureId; active: string; tabs: readonly BusinessSection[] }) {
  const activeGroup = groups.find(g => g.sections.includes(active))?.label ?? 'Work';
  const [selected, setSelected] = useState({ active, group: activeGroup });
  const group = selected.active === active ? selected.group : activeGroup;
  const available = groups.filter(g => tabs.some(([id]) => g.sections.includes(id)));
  const visible = available.find(g => g.label === group) ?? available[0];
  return <div className="business-navigation">
    <div className="business-groups" role="group" aria-label={`${ventures[venture].name} navigation groups`}>
      {available.map(g => <button key={g.label} aria-pressed={visible.label === g.label} onClick={() => setSelected({ active, group: g.label })}>{g.label}<small>{tabs.filter(([id]) => g.sections.includes(id)).length}</small></button>)}
    </div>
    <nav className="business-sections" aria-label={`${ventures[venture].name} sections`}>
      {tabs.filter(([id]) => visible.sections.includes(id)).map(([id, label]) => <Link key={id} aria-current={active === id ? 'page' : undefined} href={`${base}/b/${venture}${id === 'overview' ? '' : `/${id}`}`}>{label}</Link>)}
    </nav>
  </div>;
}
