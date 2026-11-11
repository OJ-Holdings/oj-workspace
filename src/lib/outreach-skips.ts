import type { DmChannel } from './dm-quests';
export const skipReasons = [
  "Gap isn't real", 'Page or profile dead', 'Wrong person or name',
  'Already contacted or a customer', 'Message is bad', 'Not a fit', 'Other',
] as const;
export type SkipReason = typeof skipReasons[number];
export type SkipRecord = {
 id: string; organization_id: string; prospect_id: string; actor_id: string;
 business_name: string; source_row: number; channel: DmChannel; reason: SkipReason;
 note: string; skipped_at: string;
};
