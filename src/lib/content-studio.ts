export const contentStages = [
  'Idea', 'Research', 'Script', 'Pre-production', 'Filming',
  'Editing', 'Review', 'Scheduled', 'Published', 'Archived',
] as const;
export type ContentStage = typeof contentStages[number];
export const contentKinds = ['Video', 'Short', 'Series', 'Campaign', 'Other'] as const;
export type ContentKind = typeof contentKinds[number];
export const contentPlatforms = ['YouTube', 'TikTok', 'Instagram', 'Other'] as const;
export type ContentPlatform = typeof contentPlatforms[number];

export type ContentProject = {
  id: string;
  organization_id: string;
  title: string;
  kind: ContentKind;
  stage: ContentStage;
  platforms: ContentPlatform[];
  summary: string;
  script: string;
  production_notes: string;
  assigned_to: string | null;
  shoot_at: string | null;
  target_publish_on: string | null;
  published_url: string;
  published_at: string | null;
  revision: number;
  created_at: string;
  updated_at: string;
};
export type ContentMember = { user_id: string; display_name: string };
export type ContentActivity = {
  id: string;
  project_id: string;
  actor_id: string | null;
  action: 'created' | 'updated' | 'stage_changed';
  previous_stage: ContentStage | null;
  new_stage: ContentStage;
  changed_at: string;
};
export type ContentSnapshot = {
  projects: ContentProject[];
  members: ContentMember[];
  activity: ContentActivity[];
  limited?: boolean;
};

/** A parsed, bounded, server-validated content editor payload. */
export type ContentDraft = Pick<ContentProject,
  'title' | 'kind' | 'stage' | 'platforms' | 'summary' | 'script' |
  'production_notes' | 'assigned_to' | 'shoot_at' | 'target_publish_on' |
  'published_url' | 'published_at' | 'revision'> & { id: string | null };

const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;
const goodDate = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s) &&
  !Number.isNaN(Date.parse(s)) && new Date(s).toISOString().slice(0, 10) === s;
const optionalInstant = (value: unknown, label: string): string | null => {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !Number.isFinite(Date.parse(value))) throw new Error('Choose a valid ' + label + '.');
  return new Date(value).toISOString();
};
const bounded = (value: unknown, max: number, label: string, required = false) => {
  if (typeof value !== 'string' || value.length > max || (required && !value.trim())) {
    throw new Error(label + ' must be at most ' + max + ' characters.');
  }
  return value.trim();
};

export function validateContentDraft(raw: unknown): ContentDraft {
  if (!raw || typeof raw !== 'object') throw new Error('A content project is required.');
  const input = raw as Record<string, unknown>;
  const id = input.id === null || input.id === '' ? null : input.id;
  if (id !== null && (typeof id !== 'string' || !uuid.test(id))) throw new Error('Invalid content project.');
  if (typeof input.kind !== 'string' || !(contentKinds as readonly string[]).includes(input.kind)) throw new Error('Choose a content format.');
  if (typeof input.stage !== 'string' || !(contentStages as readonly string[]).includes(input.stage)) throw new Error('Choose a production stage.');
  if (!Array.isArray(input.platforms) || input.platforms.length > 8 ||
    input.platforms.some(p => typeof p !== 'string' || !(contentPlatforms as readonly string[]).includes(p)) ||
    new Set(input.platforms).size !== input.platforms.length) throw new Error('Choose valid platforms.');
  if (input.assigned_to !== null && (typeof input.assigned_to !== 'string' || !uuid.test(input.assigned_to))) {
    throw new Error('Choose an authorized teammate.');
  }
  if (input.target_publish_on !== null &&
      (typeof input.target_publish_on !== 'string' || !goodDate(input.target_publish_on))) {
    throw new Error('Choose a valid planned release date.');
  }
  const published_url = bounded(input.published_url, 1000, 'Publication URL');
  if (published_url) {
    try {
      const u = new URL(published_url);
      if (u.protocol !== 'https:' || !u.hostname || /\s/.test(published_url)) throw new Error('Invalid protocol');
    } catch { throw new Error('Use a valid HTTPS publication URL.'); }
  }
  const published_at = optionalInstant(input.published_at, 'publication date');
  if (input.stage === 'Published' && (!published_url || !published_at)) {
    throw new Error('Record the published link and date before marking a video published.');
  }
  if (!Number.isInteger(input.revision) || (input.revision as number) < 0) throw new Error('Invalid project revision.');
  return {
    id: id as string | null,
    title: bounded(input.title, 180, 'Project title', true),
    kind: input.kind as ContentKind,
    stage: input.stage as ContentStage,
    platforms: input.platforms as ContentPlatform[],
    summary: bounded(input.summary, 3000, 'Brief'),
    script: bounded(input.script, 16000, 'Script'),
    production_notes: bounded(input.production_notes, 5000, 'Production notes'),
    assigned_to: input.assigned_to as string | null,
    shoot_at: optionalInstant(input.shoot_at, 'shoot time'),
    target_publish_on: input.target_publish_on as string | null,
    published_url,
    published_at,
    revision: input.revision as number,
  };
}

export const freshContentDraft = (): ContentDraft => ({
  id: null, title: '', kind: 'Video', stage: 'Idea', platforms: ['YouTube'],
  summary: '', script: '', production_notes: '', assigned_to: null, shoot_at: null,
  target_publish_on: null, published_url: '', published_at: null, revision: 0,
});

export const isContentLate = (item: Pick<ContentProject, 'target_publish_on' | 'stage'>, today: string) =>
  Boolean(item.target_publish_on && item.target_publish_on < today &&
    item.stage !== 'Published' && item.stage !== 'Archived');

/** Compare only normalized editable content, not IDs, revisions or timestamps. */
export function contentDraftMatches(draft: ContentDraft, project: ContentProject): boolean {
  const editable = (value: ContentDraft) => {
    const { id: _id, revision: _revision, ...fields } = validateContentDraft(value);
    return fields;
  };
  return JSON.stringify(editable(draft)) === JSON.stringify(editable(project));
}
