'use client';

import Link from 'next/link';
import { Flame } from 'lucide-react';
import { centralHour, dayCount, questLine, streakFor, todayKey } from '@/lib/dm-quests';
import type { GrowthStore } from './useGrowth';

/** Pinned to every OJ Solutions screen so the day's quest is never out of sight. */
export function QuestBar({ g, base }: { g: GrowthStore; base: string }) {
  const data = g.data;
  if (!data?.dm) return null;
  const today = todayKey(g.now), hour = centralHour(g.now), goal = data.dm.goal;
  const players = data.members.filter(m => m.partner || m.userId === data.me.userId)
    .sort((a, b) => (a.userId === data.me.userId ? -1 : b.userId === data.me.userId ? 1 : a.name.localeCompare(b.name)))
    .map(m => ({ ...m, done: dayCount(data.dm!.log, m.userId, today), streak: streakFor(data.dm!.log, m.userId, goal, today) }));
  const mine = players.find(p => p.userId === data.me.userId);
  const tone = questLine(mine?.done ?? 0, goal, hour).tone;
  return <Link href={`${base}/b/solutions/dms`} className={`gx-bar is-${tone}`} aria-label={`Daily ${goal}: ${players.map(p => `${p.name} ${p.done} of ${goal}`).join(', ')}. Open the quest.`}>
    <b className="gx-bar-title"><Flame size={15} aria-hidden="true" />Daily {goal}</b>
    {players.map(p => <span key={p.userId} className={`gx-bar-player${p.done >= goal ? ' is-clear' : ''}`}>
      <span>{p.name}{p.userId === data.me.userId ? ' (you)' : ''}</span>
      <span className="gx-bar-track" aria-hidden="true"><i style={{ width: `${Math.min(p.done / goal, 1) * 100}%` }} /></span>
      <b>{p.done}/{goal}</b>
    </span>)}
    <span className="gx-bar-go">{tone === 'done' ? 'Quest clear' : tone === 'closed' ? 'Day over' : 'Open quest'}</span>
  </Link>;
}
