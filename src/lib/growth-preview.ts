import type { GrowthData } from '@/app/workspace/growth-actions';
import type { OutreachProspect } from './outreach';
import type { DmLogEntry } from './dm-quests';
import { addDays, todayKey } from './dm-quests';
import type { EmailEvent } from './email-engine';

/** Fictional records for the /preview route only. Nothing here is a real business, person or result. */
export function previewGrowth(now: Date): GrowthData {
  const today = todayKey(now), stamp = now.toISOString();
  const prospect = (n: number, over: Partial<OutreachProspect>): OutreachProspect => ({
    id: `preview-p${n}`, organization_id: 'preview', source_key: `preview-${n}`, source_row: n + 1, business_name: `Sample Wash Co ${n}`, industry: 'Pressure washing',
    city_state: 'Example, WI', website_url: null, phone_number: null, decision_maker: 'Sample Owner', best_fit_service: 'AI Receptionist', secondary_fit: null,
    leak: 'Fictional preview: calls appear to go to voicemail during jobs.', evidence: 'Fictional preview record.', email: `owner${n}@example.invalid`, instagram: `samplewash${n}`, facebook: null,
    email_subject: 'A fictional preview subject', email_body: 'This is a fictional preview email draft. It is long enough to pass checks but is never sent from the preview.', dm: 'Fictional preview DM: hey, I run a pressure washing company and built an AI that answers calls.',
    date_added: today, sent_by: n % 2 ? 'Oscar' : 'Jacob', source_status: 'Not Sent', source_notes: null, outreach_status: null, outreach_notes: '', status_updated_at: null,
    created_at: stamp, updated_at: stamp, last_seen_at: stamp, ...over,
  });
  const prospects = [prospect(1, {}), prospect(2, {}), prospect(3, { outreach_status: 'Replied' }), prospect(4, { outreach_status: 'Emailed' }), prospect(5, { outreach_status: 'Demo Booked' })];
  const dm = (actor: string, day: string, i: number): DmLogEntry => ({ id: `preview-d-${actor}-${day}-${i}`, actor_id: actor, prospect_id: null, channel: 'instagram', work_day: day, undone_at: null, created_at: stamp });
  const log: DmLogEntry[] = [];
  for (let d = 1; d <= 4; d++) for (let i = 0; i < 10; i++) { log.push(dm('preview-oscar', addDays(today, -d), i)); if (d !== 2) log.push(dm('preview-jacob', addDays(today, -d), i)); }
  for (let i = 0; i < 4; i++) log.push(dm('preview-oscar', today, i));
  for (let i = 0; i < 7; i++) log.push(dm('preview-jacob', today, i));
  const sent = (n: number, minutesAgo: number): EmailEvent => ({ prospect_id: `preview-p${n}`, kind: 'sent', event_at: new Date(now.getTime() - minutesAgo * 60_000).toISOString() });
  return {
    me: { userId: 'preview-oscar', name: 'Oscar', partner: 'Oscar', role: 'member' },
    members: [{ userId: 'preview-oscar', name: 'Oscar', partner: 'Oscar' }, { userId: 'preview-jacob', name: 'Jacob', partner: 'Jacob' }],
    prospects, prospectTotal: prospects.length, dm: { goal: 10, log },
    email: {
      settings: { enabled: true, daily_cap_max: 25, niche_filter: null },
      state: { last_heartbeat_at: stamp, state: 'sending', detail: 'Fictional preview.', warmup_started_on: addDays(today, -5), sender_domain: 'example.invalid' },
      events: [sent(4, 50), sent(3, 140), { prospect_id: 'preview-p3', kind: 'reply', event_at: new Date(now.getTime() - 20 * 60_000).toISOString() }],
    },
    lastSync: { status: 'success', finished_at: stamp }, fetchedAt: stamp,
  };
}
