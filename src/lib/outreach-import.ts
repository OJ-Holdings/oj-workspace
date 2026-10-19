import { createHash } from 'node:crypto';
import { outreachStatuses, type OutreachSourceRow, type OutreachStatus } from './outreach';

const headerAliases: Record<keyof Omit<OutreachSourceRow, 'source_key' | 'source_row'>, string[]> = {
  business_name: ['business name'], industry: ['industry', 'trade'], city_state: ['city and state', 'city/state', 'city, state'],
  website_url: ['website url', 'website', 'url'], phone_number: ['phone number', 'phone', 'phone #'],
  decision_maker: ['decision maker', 'contact'], best_fit_service: ['best fit service'], secondary_fit: ['secondary fit'],
  leak: ['the leak', 'leak'], evidence: ['evidence'], email: ['send to', 'email'], instagram: ['instagram'], facebook: ['facebook'],
  email_subject: ['email subject', 'subject'], email_body: ['email body', 'message'], dm: ['dm', 'direct message'], date_added: ['date added'],
  sent_by: ['sent by', 'assigned to', 'sender'], source_status: ['outreach status', 'status'], source_notes: ['notes', 'note'],
};

const cell = (row: string[], index: number | undefined) => index === undefined || index < 0 ? '' : (row[index] ?? '').trim();
const clean = (value: string, max: number) => value.trim().slice(0, max) || null;
const normalizeWebsite = (value: string) => value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].replace(/\.$/, '');

export function outreachKey(input: { businessName: string; websiteUrl?: string | null; cityState?: string | null; phoneNumber?: string | null }) {
  const website = normalizeWebsite(input.websiteUrl ?? '');
  const identity = website || [input.businessName, input.cityState ?? '', (input.phoneNumber ?? '').replace(/\D/g, '')].map(v => v.trim().toLowerCase()).join('|');
  return createHash('sha256').update(identity).digest('hex');
}

function parseDate(raw: string) {
  const s = raw.trim();
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const us = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const parts = iso ? [Number(iso[1]), Number(iso[2]), Number(iso[3])] : us ? [Number(us[3]), Number(us[1]), Number(us[2])] : null;
  if (!parts) return null;
  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` : null;
}

export function parseOutreachRows(rows: string[][]) {
  if (!rows.length) throw new Error('The Outreach tab is empty; its header row is required.');
  const headers = rows[0].map(h => h.toLowerCase().trim().replace(/\s+/g, ' '));
  const columns = Object.fromEntries(Object.entries(headerAliases).map(([field, names]) => [field, headers.findIndex(h => names.includes(h))])) as Record<keyof typeof headerAliases, number>;
  // Date Added is optional in the live outreach workbook; preserve it as null when absent.
  const required = ['business_name', 'best_fit_service', 'sent_by', 'source_status'] as const;
  const missing = required.filter(field => columns[field] < 0);
  if (missing.length) throw new Error(`Missing required Outreach columns: ${missing.join(', ')}.`);
  const parsed: OutreachSourceRow[] = [];
  const seen = new Set<string>();
  const skipped: number[] = [];
  const duplicateRows: number[] = [];
  const statusSet = new Set<string>(outreachStatuses);
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const businessName = cell(row, columns.business_name);
    if (!businessName) { if (row.some(v => v.trim())) skipped.push(i + 1); continue; }
    const statusRaw = cell(row, columns.source_status);
    const sourceStatus = (statusRaw || 'Not Sent') as OutreachStatus;
    if (!statusSet.has(sourceStatus)) throw new Error(`Row ${i + 1} has an unknown Outreach Status: "${statusRaw}".`);
    const sentRaw = cell(row, columns.sent_by);
    const websiteUrl = clean(cell(row, columns.website_url), 1000);
    const cityState = clean(cell(row, columns.city_state), 240);
    const phoneNumber = clean(cell(row, columns.phone_number), 80);
    const key = outreachKey({ businessName, websiteUrl, cityState, phoneNumber });
    if (seen.has(key)) { duplicateRows.push(i + 1); continue; }
    seen.add(key);
    parsed.push({
      source_key: key, source_row: i + 1, business_name: businessName.slice(0, 200),
      industry: clean(cell(row, columns.industry), 160), city_state: cityState, website_url: websiteUrl,
      phone_number: phoneNumber, decision_maker: clean(cell(row, columns.decision_maker), 200),
      best_fit_service: clean(cell(row, columns.best_fit_service), 120), secondary_fit: clean(cell(row, columns.secondary_fit), 120),
      leak: clean(cell(row, columns.leak), 2000), evidence: clean(cell(row, columns.evidence), 3000),
      email: clean(cell(row, columns.email), 320), instagram: clean(cell(row, columns.instagram), 1000), facebook: clean(cell(row, columns.facebook), 1000),
      email_subject: clean(cell(row, columns.email_subject), 500), email_body: clean(cell(row, columns.email_body), 5000), dm: clean(cell(row, columns.dm), 3000),
      date_added: parseDate(cell(row, columns.date_added)), sent_by: sentRaw === 'Oscar' || sentRaw === 'Jacob' ? sentRaw : null,
      source_status: sourceStatus, source_notes: clean(cell(row, columns.source_notes), 3000),
    });
  }
  return { prospects: parsed, skippedRows: skipped, duplicateRows };
}
