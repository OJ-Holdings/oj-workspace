import { contentPersistenceEnabled } from './ventures';

/**
 * OJ Holdings V2 capability registry.
 *
 * "live" means an existing in-app destination, NOT that a provider connection,
 * workflow, or business outcome has been independently verified.
 * Planned capabilities never have a navigable href.
 */
export const toolCategories = ['Operate', 'Grow', 'Finance', 'Create', 'People', 'Control'] as const;
export type ToolCategory = typeof toolCategories[number];
export type ToolIntegration = 'shopify' | 'ghl';
export type ToolStatus = 'available' | 'connection-required' | 'preview' | 'planned';

export type CorporateTool = {
  id: string;
  title: string;
  description: string;
  category: ToolCategory;
  keywords: string;
  href?: `/${string}`;
  integration?: ToolIntegration;
  ownerOnly?: boolean;
  previewOnly?: boolean;
};

export type ToolContext = {
  owner: boolean;
  connections: Record<ToolIntegration, boolean>;
};

export const corporateTools: readonly CorporateTool[] = [
  { id: 'nexus', title: 'NEXUS / Project 360', description: 'Open the working, evidence-labeled Exterior project graph connecting local scenarios with authorized source bookings, customers, Fleet candidates and shared task records. Not cross-device project persistence.', category: 'Operate', keywords: 'nexus project 360 command relationship graph customers operations source identity', href: '/b/exterior/projects' },
  { id: 'tasks', title: 'Shared Task Board', description: 'Create, assign, review, and complete company work.', category: 'Operate', keywords: 'tasks kanban board projects work assignments', href: '/tasks' },
  { id: 'calendar', title: 'Company Calendar', description: 'View available schedules, events, and task deadlines.', category: 'Operate', keywords: 'appointments schedule dispatch meetings', href: '/calendar' },
  { id: 'exterior-bookings', title: 'Exterior Bookings', description: 'Inspect and manage exterior service bookings.', category: 'Operate', keywords: 'wash crew schedule job dispatch', href: '/b/exterior/bookings' },
  { id: 'exterior-jobs', title: 'Exterior Jobs & Income', description: 'Review recorded jobs and financial field coverage.', category: 'Operate', keywords: 'pressure washing completed service revenue cost', href: '/b/exterior/jobs' },
  { id: 'commercial-desk', title: 'Commercial Estimating Desk', description: 'Build internal multi-building estimates; drafts currently stay in this browser.', category: 'Operate', keywords: 'pricing quote bid window water lift building', href: '/b/exterior/commercial' },
  { id: 'company-crm', title: 'Shared CRM', description: 'Organize workspace leads and follow-up information.', category: 'Grow', keywords: 'contacts customers sales opportunities pipeline', href: '/crm' },
  { id: 'exterior-leads', title: 'Exterior Lead Pipeline', description: 'Manage Exterior Care records from its existing lead system.', category: 'Grow', keywords: 'pressure washing prospects source local service ads', href: '/b/exterior/leads' },
  { id: 'solutions-outreach', title: 'Solutions Outreach', description: 'Research prospects and prepare or record next actions.', category: 'Grow', keywords: 'agency ai lead dm email prospecting', href: '/b/solutions/outreach' },
  { id: 'solutions-clients', title: 'Solutions Clients', description: 'Review connected GoHighLevel contact and client records.', category: 'Grow', keywords: 'ghl customer contacts account', href: '/b/solutions/clients', integration: 'ghl' },
  { id: 'solutions-calls', title: 'Solutions Calls', description: 'Inspect available GoHighLevel call information.', category: 'Grow', keywords: 'ghl voice conversations receptionist', href: '/b/solutions/calls', integration: 'ghl' },
  { id: 'finance', title: 'Finance Desk', description: 'Inspect recorded revenue and costs with source limitations.', category: 'Finance', keywords: 'money expense income accounting ledger', href: '/finance' },
  { id: 'analytics', title: 'Business Analytics', description: 'Compare operational records and inspect reporting coverage.', category: 'Finance', keywords: 'reports charts kpis dashboard', href: '/analytics' },
  { id: 'essentials-orders', title: 'Essentials Orders', description: 'Read available Shopify order records, including their statuses.', category: 'Finance', keywords: 'shop ecommerce shopify sales fulfillment', href: '/b/essentials/orders', integration: 'shopify' },
  { id: 'essentials-inventory', title: 'Essentials Inventory', description: 'Inspect Shopify inventory data when connected.', category: 'Operate', keywords: 'sku product stock ecommerce', href: '/b/essentials/inventory', integration: 'shopify' },
  { id: 'files', title: 'Company Documents', description: 'Access files permitted by existing workspace membership.', category: 'Control', keywords: 'contracts upload pdf insurance folders', href: '/files' },
  { id: 'messages', title: 'Team Messages', description: 'Read and send internal workspace messages.', category: 'People', keywords: 'communication notes founders', href: '/messages' },
  { id: 'team', title: 'Team Workspace', description: 'Review members and existing team administration links.', category: 'People', keywords: 'jacob oscar staff employees invites permissions', href: '/team' },
  { id: 'settings', title: 'Workspace Settings', description: 'Review account settings and configured connections.', category: 'Control', keywords: 'profile configuration integration connection', href: '/settings' },

  { id: 'content-studio', title: contentPersistenceEnabled ? 'Oscar Jacob Production Studio' : 'Oscar Jacob Studio Preview', description: contentPersistenceEnabled ? 'Manage private production projects, scripts, ownership, schedules and user-recorded releases.' : 'Explore the read-only Oscar Jacob studio with fictional sample records. Persistent company data is not enabled.', category: 'Create', keywords: 'content media oscar jacob creator video filming editing', href: contentPersistenceEnabled ? '/b/content' : '/tools/content-preview', previewOnly: !contentPersistenceEnabled },
  { id: 'fleet', title: 'Fleet Command & Rig Lab', description: 'Local equipment registry, service log, departure readiness, payload planning and private file transfer. Not synced between founders.', category: 'Operate', keywords: 'truck rig washer pumps tools maintenance vehicle trailer fleet loadout', href: '/tools/fleet' },
  { id: 'systems', title: 'System Health & Releases', description: 'Read-only current-app release SHA comparison with GitHub main and links to CI and Windows deployment verification. No host control or backup certification.', category: 'Control', keywords: 'github ci deploy windows tailscale monitoring server backups security', href: '/tools/systems' },
];

/** Avoid showing privileged tool destinations to non-owners. */
export function visibleTools(context: ToolContext): CorporateTool[] {
  return corporateTools.filter(tool => !tool.ownerOnly || context.owner);
}

export function toolStatus(tool: CorporateTool, context: ToolContext): ToolStatus {
  if (!tool.href) return 'planned';
  if (tool.previewOnly) return 'preview';
  if (tool.integration && !context.connections[tool.integration]) return 'connection-required';
  return 'available';
}

/** Command search only returns accessible destinations; planned tools are never actions. */
export function searchActiveTools(query: string, context: ToolContext, max = 8): CorporateTool[] {
  const q = query.trim().toLocaleLowerCase('en-US');
  if (!q) return [];
  return visibleTools(context).filter(tool =>
    tool.href && toolStatus(tool, context) === 'available' &&
    [tool.title, tool.description, tool.category, tool.keywords].some(value => value.toLocaleLowerCase('en-US').includes(q)),
  ).slice(0, max);
}
