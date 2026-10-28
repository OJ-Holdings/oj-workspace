'use client';

import type { ReactNode } from 'react';
import { OutreachView } from '../OutreachView';
import { DailyTen } from './DailyTen';
import { EmailEngine } from './EmailEngine';
import { QuestBar } from './QuestBar';
import { SolutionsCommand } from './SolutionsCommand';
import { useGrowth } from './useGrowth';
import { WarmLeads } from './WarmLeads';

export const growthTabs = ['overview', 'dms', 'email', 'warm', 'outreach'] as const;

/** The OJ Solutions growth screens, sharing one loader and one quest bar. Other tabs render as children below the bar. */
export function SolutionsSuite({ base, tab, org, mode, readOnly, displayName, children }: {
  base: string; tab: string; org: string; mode: 'preview' | 'live'; readOnly: boolean; displayName: string; children?: ReactNode;
}) {
  const g = useGrowth(org, mode, readOnly);
  return <>
    <QuestBar g={g} base={base} />
    {tab === 'overview' && <SolutionsCommand g={g} base={base} />}
    {tab === 'dms' && <DailyTen g={g} />}
    {tab === 'email' && <EmailEngine g={g} base={base} />}
    {tab === 'warm' && <WarmLeads g={g} />}
    {tab === 'outreach' && <OutreachView organizationId={org} mode={mode} readOnly={readOnly} displayName={displayName} />}
    {children}
  </>;
}
