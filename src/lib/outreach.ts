import { workDay } from './task-workflows';

export const outreachStatuses = ['Not Sent', 'Emailed', 'DMed', 'Emailed + DMed', 'Replied', 'Demo Booked', 'Not Interested', 'Dead'] as const;
export type OutreachStatus = typeof outreachStatuses[number];
export type OutreachSourceRow = {
  source_key: string; source_row: number; business_name: string; industry: string | null; city_state: string | null;
  website_url: string | null; phone_number: string | null; decision_maker: string | null; best_fit_service: string | null;
  secondary_fit: string | null; leak: string | null; evidence: string | null; email: string | null; instagram: string | null;
  facebook: string | null; email_subject: string | null; email_body: string | null; dm: string | null; date_added: string | null;
  sent_by: 'Oscar' | 'Jacob' | null; source_status: OutreachStatus; source_notes: string | null;
};
export type OutreachProspect = OutreachSourceRow & {
  id: string; organization_id: string; outreach_status: OutreachStatus | null; outreach_notes: string;
  status_updated_at: string | null; created_at: string; updated_at: string; last_seen_at: string;
};
export type OutreachActivity = { id: string; prospect_id: string; actor_id: string; previous_status: OutreachStatus; new_status: OutreachStatus; created_at: string };

export const effectiveOutreachStatus = (p: Pick<OutreachProspect, 'outreach_status' | 'source_status'>): OutreachStatus => p.outreach_status ?? p.source_status;
export const isOutreachComplete = (status: OutreachStatus) => status !== 'Not Sent';

/** Our first niche: exterior cleaning, the trade the founders also run (OJ Exterior Care). */
const exteriorNiche = /(pressure|power)[\s-]*wash|soft[\s-]*wash|house[\s-]*wash|window[\s-]*clean|exterior[\s-]*clean|gutter|driveway|\bdeck\b|paver/i;
export const isExteriorNiche = (p: Pick<OutreachSourceRow, 'industry' | 'best_fit_service' | 'business_name' | 'secondary_fit'>) =>
  [p.industry, p.best_fit_service, p.secondary_fit, p.business_name].some(v => v != null && exteriorNiche.test(v));

export type OutreachQueue = 'all' | 'pending' | 'replies' | 'demos' | 'exterior';
export function selectProspects(prospects: OutreachProspect[], query: string, owner: string, status: string, queue: OutreachQueue) {
  const q = query.trim().toLowerCase();
  return prospects.filter(p => {
    const current = effectiveOutreachStatus(p);
    return (!q || [p.business_name, p.industry, p.city_state, p.best_fit_service, p.secondary_fit, p.decision_maker, p.email, p.sent_by].some(v => v?.toLowerCase().includes(q)))
      && (!owner || p.sent_by === owner) && (!status || current === status)
      && (queue === 'all' || (queue === 'pending' && current === 'Not Sent') || (queue === 'replies' && current === 'Replied') || (queue === 'demos' && current === 'Demo Booked') || (queue === 'exterior' && isExteriorNiche(p)));
  });
}

/** Manual contact markings are not proof of message delivery or distinct attempts. */
export function contactsMarkedToday(activity: OutreachActivity[], now: Date) {
  const today = workDay(now);
  return new Set(activity.filter(a => ['Emailed', 'DMed', 'Emailed + DMed'].includes(a.new_status)
    && Number.isFinite(Date.parse(a.created_at)) && workDay(new Date(a.created_at)) === today).map(a => a.prospect_id)).size;
}

export function outreachNextStep(status: OutreachStatus) {
  if (status === 'Not Sent') return 'Review draft and contact';
  if (status === 'Replied') return 'Respond and agree next step';
  if (status === 'Demo Booked') return 'Prepare the demo';
  if (status === 'Dead' || status === 'Not Interested') return 'Resolved';
  return 'Check for a response';
}

export function safeOutreachUrl(value: string | null) {
  if (!value?.trim()) return null;
  try {
    const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

