'use server';

import { requireMember } from '@/lib/supabase';
import { isDeepStrictEqual } from 'node:util';
import {
  assertSharedReference, parseSharedDocument, parseSharedSaveReceipt,
  validateSharedPayload, type SharedDraftKind, type SharedDraftPayload,
  type SharedDraftRecord,
} from '@/lib/oj-shared-documents';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const unavailableCodes = new Set(['42P01','42883','PGRST202','PGRST204','PGRST205']);

async function verifyFieldSource(
  client: Awaited<ReturnType<typeof requireMember>>['client'],
  bookingId: string,
  payload: { leadId: string; sourceDate?: string; sourceStatus?: string | null },
  strict: boolean,
): Promise<void> {
  const { data: booking, error } = await client.from('bookings')
    .select('id,lead_id,date,status').eq('id', bookingId).maybeSingle();
  if (error || !booking || booking.lead_id !== payload.leadId) {
    throw new Error('Original booking or linked customer is no longer available to this company.');
  }
  if (strict && payload.sourceDate !== undefined &&
      (booking.date !== payload.sourceDate || booking.status !== payload.sourceStatus)) {
    throw new Error('Original booking date or status changed. Refresh and revalidate this field report before syncing.');
  }
}

function sharedError(code?: string): string {
  if (unavailableCodes.has(code ?? '')) {
    return 'Shared workspace draft storage is not installed in Supabase. The original browser records are unchanged.';
  }
  if (code === '42501' || code === 'PGRST301') {
    return 'The current account cannot access this company record.';
  }
  return 'Shared workspace storage could not be verified. Keep the local recovery copy and retry after connectivity returns.';
}

export async function loadSharedDraft<K extends SharedDraftKind>(
  organizationId: string, kind: K, sourceId: string,
): Promise<SharedDraftRecord<SharedDraftPayload<K>> | null> {
  assertSharedReference(organizationId, kind, sourceId);
  const { client } = await requireMember(organizationId, true);
  const { data, error } = await client.rpc('oj_module_document_get', {
    p_organization_id: organizationId,
    p_kind: kind,
    p_source_id: sourceId,
  });
  if (error) throw new Error(sharedError(error.code));
  const document = parseSharedDocument(organizationId, kind, sourceId, data);
  if ((kind === 'exterior_field' || kind === 'exterior_equipment' || kind === 'exterior_handoff') && document) {
    const field = document.payload as { leadId: string; sourceDate: string; sourceStatus: string | null };
    await verifyFieldSource(client, sourceId, field, false);
  }
  return document;
}

/** A server-validated save is not customer acceptance, work-order issuance,
 * dispatch, invoice creation, cash collection or an external communication. */
export async function saveSharedDraft<K extends SharedDraftKind>(
  organizationId: string, kind: K, sourceId: string,
  expectedRevision: number, commandId: string, raw: SharedDraftPayload<K>,
): Promise<
  { status: 'saved'; revision: number; replayed: boolean } |
  { status: 'conflict'; currentRevision: number }
> {
  assertSharedReference(organizationId, kind, sourceId);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || !uuidPattern.test(commandId)) {
    throw new Error('Shared draft revision and command identifiers must be valid.');
  }
  const payload = validateSharedPayload(organizationId, kind, sourceId, raw);
  const { client } = await requireMember(organizationId, true);
  if (kind === 'exterior_field' || kind === 'exterior_equipment' || kind === 'exterior_handoff') {
    const field = payload as { leadId: string; sourceDate: string; sourceStatus: string | null };
    await verifyFieldSource(client, sourceId, field, true);
  }
  const { data, error } = await client.rpc('oj_module_document_save', {
    p_organization_id: organizationId,
    p_kind: kind,
    p_source_id: sourceId,
    p_expected_revision: expectedRevision,
    p_command_id: commandId,
    p_payload: payload,
  });
  if (error) throw new Error(sharedError(error.code));
  const result = parseSharedSaveReceipt(data);
  if (!result.ok) return { status: 'conflict', currentRevision: result.currentRevision };
  // A command receipt is not proof that a subsequent device can read the data.
  // Re-read under the same member contract before claiming a shared save.
  const stored = await loadSharedDraft(organizationId, kind, sourceId);
  if (!stored) throw new Error('The save receipt exists, but the shared record could not be read back. Retry the original save command.');
  if (stored.revision !== result.revision) return { status: 'conflict', currentRevision: stored.revision };
  if (!isDeepStrictEqual(JSON.parse(JSON.stringify(stored.payload)), JSON.parse(JSON.stringify(payload)))) {
    throw new Error('Shared save read-back did not match the submitted record. Keep the local recovery copy and retry the original command.');
  }
  return { status: 'saved', revision: result.revision, replayed: result.replayed };
}
