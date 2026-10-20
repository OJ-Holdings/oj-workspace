'use client';
import type { OutreachProspect } from '@/lib/outreach';
import { OutreachQueueView } from './OutreachQueueView';

const demoDate = new Date().toISOString().slice(0, 10);
const previewProspects: OutreachProspect[] = [
  { id: 'preview-o1', organization_id: 'preview', source_key: 'preview-one', source_row: 2, business_name: 'Sample Dental Studio', industry: 'Dental', city_state: 'Kenosha, WI', website_url: 'https://example.invalid', phone_number: '(262) 555-0100', decision_maker: 'Office manager', best_fit_service: 'AI Receptionist', secondary_fit: 'Website', leak: 'Sample only: after-hours calls appear to go unanswered.', evidence: 'Fictional preview record. Not a real business.', email: 'hello@example.invalid', instagram: null, facebook: null, email_subject: 'A sample subject', email_body: 'This is a fictional preview outreach draft.', dm: 'This is a fictional preview direct message.', date_added: demoDate, sent_by: 'Oscar', source_status: 'Not Sent', source_notes: null, outreach_status: null, outreach_notes: '', status_updated_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString() },
  { id: 'preview-o2', organization_id: 'preview', source_key: 'preview-two', source_row: 3, business_name: 'Sample Auto Care', industry: 'Automotive', city_state: 'Racine, WI', website_url: null, phone_number: null, decision_maker: null, best_fit_service: 'Website', secondary_fit: null, leak: 'Sample only: no online booking link shown.', evidence: 'Fictional preview record. Not a real business.', email: null, instagram: null, facebook: null, email_subject: null, email_body: null, dm: null, date_added: demoDate, sent_by: 'Jacob', source_status: 'Emailed', source_notes: null, outreach_status: null, outreach_notes: '', status_updated_at: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), last_seen_at: new Date().toISOString() },
];

export function OutreachView(props: { organizationId: string; mode: 'preview' | 'live'; readOnly: boolean; displayName: string }) {
  return <OutreachQueueView {...props} examples={previewProspects} />;
}
