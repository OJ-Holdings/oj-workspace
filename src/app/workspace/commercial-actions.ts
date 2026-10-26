'use server';

import { requireMember } from '@/lib/supabase';
import {
  validateCommercialProjectDraft, validateCommercialProjectPage, validateCommercialSaveReceipt,
  verifyCommercialSaveReadback,
  type CommercialProjectCursor,
} from '@/lib/commercial-persistence';
import type { ProjectDraft } from '@/lib/atlas-commercial-portfolio';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const storageUnavailable = (code?: string) => ['42P01','42883','PGRST202','PGRST204','PGRST205'].includes(code ?? '');

function storageMessage(code?: string): string {
  return storageUnavailable(code)
    ? 'Shared commercial storage is not installed yet. Your existing browser recovery records were left untouched.'
    : 'Could not reach shared commercial storage. Existing browser recovery records were left untouched.';
}

export async function loadCommercialProjects(
  organizationId: string,
  cursor: CommercialProjectCursor = null,
): Promise<ReturnType<typeof validateCommercialProjectPage>> {
  if (!uuidPattern.test(organizationId)) throw new Error('Invalid workspace organization.');
  const { client } = await requireMember(organizationId, true);
  const { data, error } = await client.rpc('oj_commercial_projects_list', {
    p_organization_id: organizationId,
    p_limit: 50,
    p_before_updated_at: cursor?.updatedAt ?? null,
    p_before_id: cursor?.id ?? null,
  });
  if (error) throw new Error(storageMessage(error.code));
  return validateCommercialProjectPage(data, organizationId);
}

export async function loadCommercialProject(organizationId: string, projectId: string) {
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(projectId)) throw new Error('Invalid workspace project reference.');
  const { client } = await requireMember(organizationId, true);
  const { data, error } = await client.rpc('oj_commercial_project_get', {
    p_organization_id: organizationId,
    p_project_id: projectId,
  });
  if (error) throw new Error(storageMessage(error.code));
  if (data == null) return null;
  return validateCommercialProjectPage({ projects: [data], hasMore: false }, organizationId).projects[0] ?? null;
}

export async function saveCommercialProject(
  organizationId: string,
  projectId: string,
  expectedRevision: number | null,
  commandId: string,
  rawDraft: ProjectDraft,
): Promise<{ status: 'saved'; project: import('@/lib/atlas-commercial-portfolio').CommercialProject; replayed: boolean }
  | { status: 'conflict'; currentRevision?: number }> {
  if (!uuidPattern.test(organizationId) || !uuidPattern.test(projectId) || !uuidPattern.test(commandId)) {
    throw new Error('Workspace, project and save-command IDs must be valid UUIDs.');
  }
  if (expectedRevision !== null && (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)) {
    throw new Error('The open project revision is invalid. Reload before saving.');
  }
  const draft = validateCommercialProjectDraft(organizationId, rawDraft);
  const { client } = await requireMember(organizationId, true);
  const { data, error } = await client.rpc('oj_commercial_project_save', {
    p_organization_id: organizationId,
    p_project_id: projectId,
    p_expected_revision: expectedRevision,
    p_command_id: commandId,
    p_payload: draft,
  });
  if (error) throw new Error(storageMessage(error.code));
  const receipt = validateCommercialSaveReceipt(data, projectId);
  if (!receipt.ok) return { status: 'conflict', currentRevision: receipt.currentRevision };

  // Re-read the exact ID through the member-only RPC. Paging through the
  // first 50 projects is not a reliable confirmation under simultaneous writes.
  const project = verifyCommercialSaveReadback(organizationId, projectId, receipt.revision, draft,
    await loadCommercialProject(organizationId, projectId));
  return { status: 'saved', project, replayed: receipt.replayed };
}
