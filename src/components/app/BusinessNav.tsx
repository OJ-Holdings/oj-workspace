'use client';

import Link from 'next/link';
import { ventures, type VentureId } from '@/lib/ventures';

export type BusinessSection = readonly [string, string];
const groups = [
  { label: 'Work', sections: ['overview', 'studio', 'board', 'bookings', 'calendar', 'commercial', 'projects'] },
  { label: 'Customers', sections: ['leads', 'clients', 'outreach', 'calls', 'quotes', 'door-knocking', 'orders'] },
  { label: 'Results', sections: ['jobs', 'money', 'metrics', 'products', 'inventory'] },
  { label: 'Workspace', sections: ['documents', 'activity', 'upgrades', 'settings'] },
];

/** OJ Solutions is organised around the plan: today's work, outreach, then customers. */
const solutionsGroups = [
  { label: 'Today', sections: ['overview', 'dms'] },
  { label: 'Outreach', sections: ['email', 'outreach', 'warm'] },
  { label: 'Customers', sections: ['consultations', 'clients', 'calls', 'leads'] },
  { label: 'Results', sections: ['money', 'metrics'] },
  { label: 'Workspace', sections: ['board', 'documents'] },
];

export function BusinessNav({ base, venture, active, tabs }: { base: string; venture: VentureId; active: string; tabs: readonly BusinessSection[] }) {
  const set = venture === 'solutions' ? solutionsGroups : groups;
  const activeGroup = set.find(g => g.sections.includes(active))?.label ?? set[0].label;
  const available = set.filter(g => tabs.some(([id]) => g.sections.includes(id)));
  const visible = available.find(g => g.label === activeGroup) ?? available[0];
  const href = (id: string) => `${base}/b/${venture}${id === 'overview' ? '' : `/${id}`}`;
  return <div className="business-navigation">
    <div className="business-groups" role="group" aria-label={`${ventures[venture].name} navigation groups`}>
      {available.map(g => { const first = tabs.find(([id]) => g.sections.includes(id))![0]; return <Link key={g.label} aria-current={visible.label === g.label ? 'true' : undefined} href={href(first)}>{g.label}</Link>; })}
    </div>
    <nav className="business-sections" aria-label={`${ventures[venture].name} sections`}>
      {tabs.filter(([id]) => visible.sections.includes(id)).map(([id, label]) => <Link key={id} aria-current={active === id ? 'page' : undefined} href={href(id)}>{label}</Link>)}
    </nav>
  </div>;
}
