'use server';

import { requireMember } from '@/lib/supabase';
import {
  validateContentDraft,
  type ContentProject, type ContentDraft, type ContentSnapshot,
  type ContentActivity, type ContentMember,
} from '@/lib/content-studio';

const projectFields = 'id,organization_id,title,kind,stage,platforms,summary,script,production_notes,assigned_to,shoot_at,target_publish_on,published_url,published_at,revision,created_at,updated_at';
const activityFields = 'id,project_id,actor_id,action,previous_stage,new_stage,changed_at';

export async function loadContentStudio(org: string): Promise<ContentSnapshot> {
  const { client } = await requireMember(org);
  const [projects, members, activity] = await Promise.all([
    client.from('oj_content_projects').select(projectFields)
      .eq('organization_id', org).order('updated_at', { ascending: false }).limit(250),
    client.from('oj_memberships').select('user_id,display_name,role')
      .eq('organization_id', org).in('role', ['owner','member']).order('display_name'),
    client.from('oj_content_activity').select(activityFields)
      .eq('organization_id', org).order('changed_at', { ascending: false }).limit(500),
  ]);

  if (projects.error || members.error || activity.error) {
    throw new Error('Content Studio could not load. Check the supervised V2 schema release and your connection.');
  }
  return {
    projects: (projects.data ?? []) as unknown as ContentProject[],
    members: (members.data ?? []) as ContentMember[],
    activity: (activity.data ?? []) as unknown as ContentActivity[],
  };
}

export async function saveContentStudioProject(org: string, raw: ContentDraft): Promise<ContentProject> {
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
    const { data, error } = await client.from('oj_content_projects')
      .insert({ ...details, organization_id: org, created_by: user.id, revision: 0 })
      .select(projectFields).single();
    if (error || !data) throw new Error('Could not create the production record. Check V2 schema and your access.');
    return data as unknown as ContentProject;
  }

  // Revision is checked both by the WHERE clause (0 affected = stale)
  // and the database's guard trigger; no last-write-wins overwrites.
  const { data, error } = await client.from('oj_content_projects')
    .update({ ...details, revision }).eq('organization_id', org).eq('id', id)
    .eq('revision', revision).select(projectFields).maybeSingle();
  if (error) throw new Error('Could not update the production record.');
  if (!data) throw new Error('This production changed since you opened it. Reload before saving your edits.');
  return data as unknown as ContentProject;
}
