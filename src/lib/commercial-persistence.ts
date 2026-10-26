import {
  emptyCommercialPortfolio, savePortfolioProject, validateCommercialPortfolio,
  type CommercialPortfolio, type CommercialProject, type ProjectDraft,
} from './atlas-commercial-portfolio';

/** A pending new-project ID survives a lost HTTP response. A retry with an
 * unchanged draft MUST use the same command and project identifier, otherwise
 * an interrupted first save silently creates another shared project. */
export type CommercialSaveAttempt = Readonly<{
  projectId: string;
  commandId: string;
  fingerprint: string;
}>;

export function planCommercialSaveAttempt(
  previous: CommercialSaveAttempt | null,
  selectedProjectId: string | null,
  expectedRevision: number | null,
  draft: ProjectDraft,
  nextUuid: () => string,
): CommercialSaveAttempt {
  const projectId = selectedProjectId ?? previous?.projectId ?? nextUuid();
  const fingerprint = JSON.stringify({ projectId, expectedRevision, draft });
  if (previous?.fingerprint === fingerprint && previous.projectId === projectId) return previous;
  return { projectId, commandId: nextUuid(), fingerprint };
}

export type CommercialProjectCursor = { updatedAt: string; id: string } | null;
export type CommercialProjectPage = {
  projects: CommercialProject[];
  nextCursor: CommercialProjectCursor;
  hasMore: boolean;
};

/** UUIDv8 namespace mapping makes imports of legacy non-UUID local IDs stable.
 * Retrying a copied recovery record therefore targets the same shared ID rather
 * than creating a second commercial project after an interrupted response.
 */
export async function recoveryProjectId(organizationId: string, sourceId: string): Promise<string> {
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sourceId)) return sourceId.toLowerCase();
  if (!/^[0-9a-f-]{36}$/i.test(organizationId) || !/^[A-Za-z0-9_-]{1,80}$/.test(sourceId)) {
    throw new Error('Cannot derive a stable shared ID from this recovery record.');
  }
  const bytes = await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(`oj-commercial-recovery-v1\0${organizationId}\0${sourceId}`));
  const hex = [...new Uint8Array(bytes)].slice(0,16).map(value=>value.toString(16).padStart(2,'0')).join('');
  const versioned = hex.slice(0,12)+'8'+hex.slice(13);
  const variant = ((parseInt(versioned[16],16)&0x3)|0x8).toString(16);
  const uuid = versioned.slice(0,16)+variant+versioned.slice(17);
  return uuid.slice(0,8)+'-'+uuid.slice(8,12)+'-'+uuid.slice(12,16)+'-'+uuid.slice(16,20)+'-'+uuid.slice(20);
}

const uuid = (value: unknown, label: string): string => {
  if (typeof value !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
  return value.toLowerCase();
};

/** Database/server boundary validation also enforces the same canonical parser
 * used by the original portable estimate format. Caller-provided totals are
 * never accepted; PostgreSQL recomputes the saved scenario totals.
 */
export function validateCommercialProjectDraft(org: string, raw: ProjectDraft): ProjectDraft {
  const candidate = savePortfolioProject(
    emptyCommercialPortfolio(org), org,
    '00000000-0000-4000-8000-000000000001', raw, null,
    '2026-01-01T00:00:00.000Z',
  ).projects[0];
  return {
    name: candidate.name,
    input: structuredClone(candidate.input),
    review: [...candidate.review],
    phase: candidate.phase,
    bookingId: candidate.bookingId,
    plannedAssetIds: [...candidate.plannedAssetIds],
    fieldCrewPlan: structuredClone(candidate.fieldCrewPlan),
  };
}

export function validateCommercialProjectPage(raw: unknown, org: string): CommercialProjectPage {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Shared commercial records returned an invalid page.');
  const value = raw as Record<string, unknown>;
  if (!Array.isArray(value.projects) || typeof value.hasMore !== 'boolean') throw new Error('Shared commercial records returned an invalid page.');
  const nextCursor = value.nextUpdatedAt == null && value.nextId == null
    ? null
    : { updatedAt: String(value.nextUpdatedAt), id: uuid(value.nextId, 'page cursor') };
  if (nextCursor && !Number.isFinite(Date.parse(nextCursor.updatedAt))) throw new Error('Shared commercial records returned an invalid cursor.');
  if (value.hasMore && !nextCursor) throw new Error('More shared projects exist, but their next page could not be verified. Reload before continuing.');
  const portfolio = validateCommercialPortfolio({
    format: 'oj-commercial-portfolio-local-v1', version: 1, organizationId: org,
    revision: 0, projects: value.projects,
  } as CommercialPortfolio, org);
  return { projects: portfolio.projects, nextCursor, hasMore: value.hasMore };
}

/** A matching revision does not prove that every submitted field was retained.
 * Compare normalized editable content; server-generated timestamps are excluded.
 */
export function verifyCommercialSaveReadback(
  organizationId: string, projectId: string, savedRevision: number,
  submitted: ProjectDraft, stored: CommercialProject | null,
): CommercialProject {
  if (!stored) throw new Error('The save receipt exists, but the shared project could not be reloaded. Retry the original save command.');
  if (uuid(stored.id, 'stored project ID') !== uuid(projectId, 'expected project ID')) {
    throw new Error('Shared save read-back returned a different project. Your edits have not been confirmed saved.');
  }
  if (stored.revision !== savedRevision) {
    throw new Error('Another founder saved a newer revision. Reload the shared project before continuing.');
  }
  const expected = validateCommercialProjectDraft(organizationId, submitted);
  const actual = validateCommercialProjectDraft(organizationId, stored);
  if (JSON.stringify(expected) !== JSON.stringify(actual)) {
    throw new Error('Shared save read-back did not match the submitted estimate. Keep your editor open and retry the original save command.');
  }
  return stored;
}

export function validateCommercialSaveReceipt(raw: unknown, expectedProjectId: string):
  | { ok: true; replayed: boolean; projectId: string; revision: number }
  | { ok: false; conflict: true; currentRevision?: number; reason?: string } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Shared commercial save returned an invalid receipt.');
  const value = raw as Record<string, unknown>;
  if (value.ok === false && value.conflict === true) {
    const currentRevision = value.currentRevision;
    return { ok: false, conflict: true, currentRevision: typeof currentRevision === 'number' ? currentRevision : undefined,
      reason: typeof value.reason === 'string' ? value.reason : undefined };
  }
  if (value.ok !== true || typeof value.replayed !== 'boolean' || typeof value.revision !== 'number'
      || !Number.isSafeInteger(value.revision) || value.revision < 1
      || uuid(value.projectId, 'project ID') !== uuid(expectedProjectId, 'expected project ID')) {
    throw new Error('Shared commercial save returned an invalid receipt.');
  }
  return { ok: true, replayed: value.replayed, projectId: expectedProjectId, revision: value.revision };
}
