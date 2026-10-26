'use server';

import { createHash, randomBytes } from 'node:crypto';
import { requireMember } from '@/lib/supabase';
import { documentTags, leadStages, type DocumentItem, type EventItem, type FinanceEntry, type Lead, type Message, type MetricEntry } from '@/lib/dashboard';
import { isVenture, type VentureId } from '@/lib/ventures';
import { removeWorkspaceDocument } from '@/lib/workspace-document-removal';

// Server actions for everything except the task board. Each one checks
// membership through requireMember (write access), validates its input, and
// then relies on row-level security as the second line of defence.

const text = (value: unknown, max: number, label: string, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) throw new Error(`${label} must be ${required ? '1' : '0'} to ${max} characters.`);
  return value.trim();
};
const venture = (value: unknown, optional = false): VentureId | null => {
  if (optional && (value === null || value === '' || value === undefined)) return null;
  if (typeof value !== 'string' || !isVenture(value)) throw new Error('Choose a business.');
  return value;
};
const day = (value: unknown) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) throw new Error('Choose a valid date.');
  return value;
};
const amount = (value: unknown, label: string, allowZero = false) => {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n < 0 || (!allowZero && n === 0) || n >= 100000000) throw new Error(`${label} must be a positive number.`);
  return Math.round(n * 100) / 100;
};
const fail = (what: string): never => { throw new Error(`Could not ${what}. Check your access and try again.`); };

export async function addMessage(org: string, input: { venture: string | null; body: string }): Promise<Message> {
  const { client, user, member } = await requireMember(org, true);
  const { data, error } = await client.from('oj_messages').insert({ organization_id: org, venture: venture(input.venture, true), body: text(input.body, 4000, 'A message', true), author_id: user.id }).select().single();
  if (error || !data) fail('send the message');
  return { id: data.id, venture: data.venture, body: data.body, created_at: data.created_at, author: member.display_name };
}

export async function saveLead(org: string, input: Omit<Lead, 'created_at'> & { isNew: boolean }): Promise<Lead> {
  const { client, user } = await requireMember(org, true);
  if (!leadStages.includes(input.stage)) throw new Error('Choose a stage.');
  const fields = {
    venture: venture(input.venture), name: text(input.name, 160, 'A name', true), contact: text(input.contact, 200, 'Contact'), stage: input.stage,
    value: input.value === null || (input.value as unknown) === '' ? null : amount(input.value, 'Value', true), source: text(input.source, 120, 'Source'), notes: text(input.notes, 4000, 'Notes'),
  };
  const query = input.isNew
    ? client.from('oj_leads').insert({ ...fields, id: input.id, organization_id: org, created_by: user.id })
    : client.from('oj_leads').update(fields).eq('id', input.id).eq('organization_id', org);
  const { data, error } = await query.select().single();
  if (error || !data) fail('save the lead');
  return { ...data, value: data.value === null ? null : Number(data.value) } as Lead;
}

export async function addFinance(org: string, input: Omit<FinanceEntry, 'id'>): Promise<FinanceEntry> {
  const { client, user } = await requireMember(org, true);
  if (input.kind !== 'revenue' && input.kind !== 'cost') throw new Error('Choose money in or money out.');
  const { data, error } = await client.from('oj_finance_entries').insert({
    organization_id: org, created_by: user.id, venture: venture(input.venture), kind: input.kind, amount: amount(input.amount, 'Amount'),
    occurred_on: day(input.occurred_on), category: text(input.category, 80, 'Category'), note: text(input.note, 500, 'Note'),
  }).select().single();
  if (error || !data) fail('save the entry');
  return { ...data, amount: Number(data.amount) } as FinanceEntry;
}

export async function addMetric(org: string, input: Omit<MetricEntry, 'id'>): Promise<MetricEntry> {
  const { client, user } = await requireMember(org, true);
  const value = Number(input.value);
  if (!Number.isFinite(value) || Math.abs(value) >= 1e12) throw new Error('Enter a number.');
  const { data, error } = await client.from('oj_metric_entries').insert({
    organization_id: org, created_by: user.id, venture: venture(input.venture), label: text(input.label, 80, 'A label', true), value,
    unit: text(input.unit, 20, 'Unit'), measured_on: day(input.measured_on), note: text(input.note, 500, 'Note'),
  }).select().single();
  if (error || !data) fail('save the number');
  return { ...data, value: Number(data.value) } as MetricEntry;
}

export async function saveEvent(org: string, input: EventItem & { isNew: boolean }): Promise<EventItem> {
  const { client, user } = await requireMember(org, true);
  const starts = new Date(input.starts_at), ends = input.ends_at ? new Date(input.ends_at) : null;
  if (Number.isNaN(starts.getTime()) || (ends && (Number.isNaN(ends.getTime()) || ends < starts))) throw new Error('Choose a valid start and end time.');
  const fields = {
    venture: venture(input.venture, true), title: text(input.title, 160, 'A title', true), starts_at: starts.toISOString(), ends_at: ends ? ends.toISOString() : null,
    all_day: Boolean(input.all_day), location: text(input.location, 200, 'Location'), notes: text(input.notes, 2000, 'Notes'),
  };
  const query = input.isNew
    ? client.from('oj_events').insert({ ...fields, id: input.id, organization_id: org, created_by: user.id })
    : client.from('oj_events').update(fields).eq('id', input.id).eq('organization_id', org);
  const { data, error } = await query.select().single();
  if (error || !data) fail('save the event');
  return data as EventItem;
}

export async function addDocument(org: string, input: { venture: string | null; name: string; tag: string; storage_path: string; size_bytes: number; mime: string }): Promise<DocumentItem> {
  const { client, user, member } = await requireMember(org, true);
  if (!(documentTags as readonly string[]).includes(input.tag)) throw new Error('Choose a document type.');
  if (typeof input.storage_path !== 'string' || !input.storage_path.startsWith(`${org}/`) || input.storage_path.includes('..')) throw new Error('Invalid file location.');
  if (!Number.isInteger(input.size_bytes) || input.size_bytes < 1 || input.size_bytes > 26214400) throw new Error('Files can be up to 25 MB.');
  const { data, error } = await client.from('oj_documents').insert({
    organization_id: org, uploaded_by: user.id, venture: venture(input.venture, true), name: text(input.name, 200, 'A name', true), tag: input.tag,
    storage_path: input.storage_path, size_bytes: input.size_bytes, mime: text(input.mime, 120, 'File type'),
  }).select().single();
  if (error || !data) fail('save the document');
  return { ...data, uploaded_by: member.display_name } as DocumentItem;
}

/** A link to one document that works for 60 seconds, for members of the workspace only. */
export async function documentUrl(org: string, id: string): Promise<string> {
  const { client } = await requireMember(org);
  const { data: row } = await client.from('oj_documents').select('storage_path').eq('id', id).eq('organization_id', org).maybeSingle();
  if (!row) throw new Error('That document is no longer available.');
  const { data, error } = await client.storage.from('oj-documents').createSignedUrl(row.storage_path, 60);
  if (error || !data) throw new Error('Could not open the document.');
  return data.signedUrl;
}

const removable = { lead: 'oj_leads', finance: 'oj_finance_entries', metric: 'oj_metric_entries', event: 'oj_events', document: 'oj_documents' } as const;
export async function removeRecord(org: string, kind: keyof typeof removable, id: string): Promise<void> {
  const { client } = await requireMember(org, true);
  if (!Object.hasOwn(removable, kind) || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error('Nothing to remove.');
  if (kind === 'document') {
    await removeWorkspaceDocument(org, id, {
      lookup: async () => {
        const { data, error } = await client.from('oj_documents').select('storage_path')
          .eq('id', id).eq('organization_id', org).maybeSingle();
        if (error) throw new Error('Document lookup failed.');
        return data ? { storagePath: data.storage_path } : null;
      },
      removeObject: async path => {
        const { data, error } = await client.storage.from('oj-documents').remove([path]);
        if (error) throw new Error('Storage removal failed.');
        // Storage can return an empty success response for missing/inaccessible
        // objects. Only an exact object receipt confirms this removal.
        return data?.some(object => object.name === path) ?? false;
      },
      removeMetadata: async path => {
        // Preserve a concurrently replaced file reference rather than deleting it.
        const { data, error } = await client.from('oj_documents').delete()
          .eq('id', id).eq('organization_id', org).eq('storage_path', path).select('id');
        if (error || data?.length !== 1) throw new Error('Document changed or removal was denied.');
      },
    });
    return;
  }
  const { error } = await client.from(removable[kind]).delete().eq('id', id).eq('organization_id', org);
  if (error) fail('remove it');
}

/**
 * Creates (or replaces) the caller's private calendar link. The random token is
 * returned once and only its SHA-256 is stored, so the link cannot be recovered
 * from the database; creating a new one cancels the old one.
 */
export async function createCalendarLink(org: string): Promise<string> {
  const { client } = await requireMember(org);
  const token = randomBytes(32).toString('hex');
  const { error } = await client.rpc('oj_set_calendar_feed', { org, digest: createHash('sha256').update(token).digest('hex') });
  if (error) throw new Error('Could not create the calendar link.');
  return `/api/calendar/${token}`;
}
