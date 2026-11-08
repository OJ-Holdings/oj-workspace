import type { DmChannel } from './dm-quests';
export type SkipRecord = {
 id: string; organization_id: string; prospect_id: string; actor_id: string;
 business_name: string; source_row: number; channel: DmChannel;
 reason: string; note: string; skipped_at: string;
};

export function leadQualitySummary(skips: SkipRecord[], sends: number) {
  const byReason: Record<string, number> = {};
  for (const skip of skips) byReason[skip.reason] = (byReason[skip.reason] ?? 0) + 1;
  const total = skips.length + Math.max(sends, 0);
  return {
    skipped: skips.length, sends: Math.max(sends, 0), rate: total ? skips.length / total : null,
    byReason, recent: [...skips].sort((a, b) => b.skipped_at.localeCompare(a.skipped_at)).slice(0, 5),
  };
}
