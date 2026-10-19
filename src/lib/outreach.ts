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

export function safeOutreachUrl(value: string | null) {
  if (!value?.trim()) return null;
  try {
    const candidate = /^https?:\/\//i.test(value.trim()) ? value.trim() : `https://${value.trim()}`;
    const url = new URL(candidate);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
  } catch { return null; }
}

