/**
 * Pages that were removed in the OJ OS clean-up. Old bookmarks and links land somewhere useful instead of a confusing screen:
 * the empty workspace CRM goes to Exterior customers, and the retired tools pages go to Today. Fleet, System status and the content
 * preview are still real destinations under /tools.
 */
const KEEP_UNDER_TOOLS = new Set(['fleet', 'systems', 'content-preview']);

export function retiredRoute(slug: string[]): string | null {
  if (slug[0] === 'crm' && slug.length === 1) return '/b/exterior/leads';
  if (slug[0] === 'tools' && !KEEP_UNDER_TOOLS.has(slug[1] ?? '')) return '';
  return null;
}
