'use server';

import { requireMember } from '@/lib/supabase';
import { contentPersistenceEnabled } from '@/lib/ventures';
import {
  validateContentDraft, contentDraftMatches,
  type ContentProject, type ContentDraft, type ContentSnapshot,
  type ContentActivity, type ContentMember,
} from '@/lib/content-studio';

const projectFields = 'id,organization_id,title,kind,stage,platforms,summary,script,production_notes,assigned_to,shoot_at,target_publish_on,published_url,published_at,revision,created_at,updated_at';
const activityFields = 'id,project_id,actor_id,action,previous_stage,new_stage,changed_at';

export async function loadContentStudio(org: string): Promise<ContentSnapshot> {
  if (!contentPersistenceEnabled) throw new Error('Oscar Jacob storage is not enabled until the supervised database migration is verified.');
  const { client } = await requireMember(org);
  const [projects, members, activity] = await Promise.all([
    client.from('oj_content_projects').select(projectFields)
      .eq('organization_id', org).order('updated_at', { ascending: false }).order('id').limit(251),
    client.from('oj_memberships').select('user_id,display_name,role')
      .eq('organization_id', org).in('role', ['owner','member']).order('display_name'),
    client.from('oj_content_activity').select(activityFields)
      .eq('organization_id', org).order('changed_at', { ascending: false }).order('id').limit(501),
  ]);

  if (projects.error || members.error || activity.error) {
    throw new Error('Content Studio could not load. Check the supervised V2 schema release and your connection.');
  }
  return {
    projects: (projects.data ?? []).slice(0,250) as unknown as ContentProject[],
    members: (members.data ?? []) as ContentMember[],
    activity: (activity.data ?? []).slice(0,500) as unknown as ContentActivity[],
    limited: (projects.data?.length ?? 0)>250 || (activity.data?.length ?? 0)>500,
  };
}

export async function saveContentStudioProject(org: string, raw: ContentDraft, creationId?: string): Promise<ContentProject> {
  if (!contentPersistenceEnabled) throw new Error('Oscar Jacob storage is not enabled until the supervised database migration is verified.');
  const { client, user } = await requireMember(org, true);
  const fields = validateContentDraft(raw);
  const { id, revision, ...details } = fields;

  if (details.assigned_to !== null) {
    const { data: assigned, error } = await client.from('oj_memberships')
      .select('user_id').eq('organization_id', org)
      .eq('user_id', details.assigned_to).in('role', ['owner','member']).maybeSingle();
    if (error || !assigned) throw new Error('Choose an active member of this company.');
  }

  if (id === null) {
    // A stable client ID survives a lost create response. Never silently create
    // another production just because its first response did not arrive.
    if (!creationId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(creationId)) {
      throw new Error('A stable production save identifier is required. Reopen the editor before saving.');
    }
    const { data, error } = await client.from('oj_content_projects')
      .insert({ ...details, id: creationId, organization_id: org, created_by: user.id, revision: 0 })
      .select(projectFields).single();
    if (error && error.code !== '23505') throw new Error('Could not create the production record. Keep the editor open and retry.');
    const { data: confirmed, error: readError } = await client.from('oj_content_projects').select(projectFields)
      .eq('organization_id', org).eq('id', creationId).maybeSingle();
    if (readError || !confirmed || !contentDraftMatches(fields, confirmed as unknown as ContentProject)) {
      throw new Error('The saved production does not match this draft. Keep your edits and refresh the project list before reconciling.');
    }
    if (!data && !error) throw new Error('The production save did not return a verifiable receipt.');
    return confirmed as unknown as ContentProject;
  }

  // Revision is checked both by the WHERE clause (0 affected = stale)
  // and the database's guard trigger; no last-write-wins overwrites.
  const { data, error } = await client.from('oj_content_projects')
    .update({ ...details, revision }).eq('organization_id', org).eq('id', id)
    .eq('revision', revision).select(projectFields).maybeSingle();
  if (error) throw new Error('Could not update the production record.');
  const { data: confirmed, error: readError } = await client.from('oj_content_projects').select(projectFields)
    .eq('organization_id', org).eq('id', id).maybeSingle();
  if (readError || !confirmed) throw new Error('The production could not be read back. Keep the editor open and retry.');
  const saved = confirmed as unknown as ContentProject;
  // An exact retry after a dropped response sees precisely the next revision.
  if (saved.revision !== revision + 1 || !contentDraftMatches(fields, saved)) {
    throw new Error('This production changed since you opened it. Keep your edits and reload before reconciling.');
  }
  if (data && (data as unknown as ContentProject).revision !== saved.revision) {
    throw new Error('Another teammate updated this production after the save. Reload before continuing.');
  }
  return saved;
}
