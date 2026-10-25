import { parseLocalEstimateBook, type LocalEstimateBook } from './exterior-estimate';
import { validateFleet, type FleetWorkbook } from './fleet-command';

/**
 * One explicit source of authority per business record. This interim document
 * layer is reserved for typed INTERNAL operator drafts; accepted customer
 * quotes, verified jobs, dispatch and finance have separate business ledgers.
 *
 * Never save arbitrary localStorage keys, preview fixtures or STRATHOS state.
 */
export type SharedDraftKind = 'exterior_estimate' | 'fleet';

export type SharedDraftPayload<K extends SharedDraftKind> =
  K extends 'exterior_estimate' ? LocalEstimateBook : FleetWorkbook;

export type SharedDraftRecord<T> = Readonly<{
  revision: number;
  payload: T;
  updatedAt: string;
}>;

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertSharedReference(organizationId: string, kind: SharedDraftKind, sourceId: string) {
  if (!uuidPattern.test(organizationId)) throw new Error('Invalid company identifier.');
  if (kind === 'fleet') {
    if (sourceId !== 'main') throw new Error('Fleet records belong to the company registry.');
  } else if (kind === 'exterior_estimate') {
    if (!uuidPattern.test(sourceId)) throw new Error('Estimate requires an original lead ID.');
  } else {
    throw new Error('This shared-data module has not passed domain validation.');
  }
}

export function validateSharedPayload<K extends SharedDraftKind>(
  organizationId: string, kind: K, sourceId: string, raw: unknown,
): SharedDraftPayload<K> {
  assertSharedReference(organizationId, kind, sourceId);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Shared business document is invalid.');
  }
  const encoded = JSON.stringify(raw);
  if (new TextEncoder().encode(encoded).length > 262144) {
    throw new Error('Shared business document exceeds the protected size limit.');
  }
  if (kind === 'exterior_estimate') {
    return parseLocalEstimateBook(encoded, sourceId) as SharedDraftPayload<K>;
  }
  return validateFleet(raw, organizationId) as SharedDraftPayload<K>;
}

export function parseSharedDocument<K extends SharedDraftKind>(
  organizationId: string, kind: K, sourceId: string, raw: unknown,
): SharedDraftRecord<SharedDraftPayload<K>> | null {
  if (raw === null) return null;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid shared record.');
  const record = raw as Record<string, unknown>;
  if (!Number.isSafeInteger(record.revision) || (record.revision as number) < 1 ||
      typeof record.updatedAt !== 'string' || !Number.isFinite(Date.parse(record.updatedAt))) {
    throw new Error('Invalid shared record revision or timestamp.');
  }
  return {
    revision: record.revision as number,
    updatedAt: record.updatedAt,
    payload: validateSharedPayload(organizationId, kind, sourceId, record.payload),
  };
}

export function parseSharedSaveReceipt(raw: unknown):
  | { ok: true; replayed: boolean; revision: number }
  | { ok: false; conflict: true; currentRevision: number } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Invalid shared save response.');
  const result = raw as Record<string, unknown>;
  if (result.ok === false && result.conflict === true &&
      Number.isSafeInteger(result.currentRevision) && (result.currentRevision as number) >= 0) {
    return { ok: false, conflict: true, currentRevision: result.currentRevision as number };
  }
  if (result.ok === true && typeof result.replayed === 'boolean' &&
      Number.isSafeInteger(result.revision) && (result.revision as number) >= 1) {
    return { ok: true, replayed: result.replayed, revision: result.revision as number };
  }
  throw new Error('Invalid shared save response.');
}
