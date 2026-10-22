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
  { id: 'command', title: 'Executive Command', description: 'Priorities, work requiring review, and source-aware operating metrics.', category: 'Operate', keywords: 'headquarters home today dashboard executive', href: '/' },
  { id: 'intelligence', title: 'Corporate Intelligence Desk', description: 'See an evidence-linked, ranked briefing for tasks, follow-ups, scheduled work and reporting gaps.', category: 'Operate', keywords: 'business intelligence exceptions risk founder command daily pulse opportunities', href: '/tools/intelligence' },
  { id: 'intelligence-desk', title: 'Corporate Intelligence Desk', description: 'Review ranked deadlines, active leads, upcoming bookings and data gaps using your authorized records.', category: 'Operate', keywords: 'briefing corporate priorities action triage alerts risk evidence intelligence', href: '/tools/intelligence' },
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
  { id: 'publishing', title: 'Publishing Calendar', description: 'Planned coordinated releases, approvals, and verified publication links.', category: 'Create', keywords: 'youtube tiktok shorts reels upload posting' },
  { id: 'creative-assets', title: 'Creative Asset Library', description: 'Planned footage, scripts, edit versions, and rights tracking.', category: 'Create', keywords: 'video thumbnail content footage music licensing' },
  { id: 'sponsors', title: 'Sponsorship & Brand Deals', description: 'Planned sponsor pipeline, deliverables, and revenue evidence.', category: 'Create', keywords: 'media kit brand partnership creator monetization' },
  { id: 'company-inbox', title: 'Unified Company Inbox', description: 'Planned approvals, exceptions, assignments, and unread decisions.', category: 'Operate', keywords: 'notifications alerts review decision' },
  { id: 'project-portfolio', title: 'Corporate Project Portfolio', description: 'Planned linked company initiatives, launches, and projects.', category: 'Operate', keywords: 'milestones dependencies roadmap programs' },
  { id: 'procurement', title: 'Procurement & Purchasing', description: 'Planned supplier comparison, requests, approval, and receipt workflows.', category: 'Finance', keywords: 'vendors buy order equipment budget quote' },
  { id: 'cash-planning', title: 'Cash Planning & Runway', description: 'Planned evidence-backed cash commitments, budgets, and scenarios.', category: 'Finance', keywords: 'treasury forecast receivables payable liquidity' },
  { id: 'scenario-lab', title: 'Business Scenario Lab', description: 'Model hypothetical unit economics for all four businesses, without touching live financial records.', category: 'Finance', keywords: 'calculator projections what if margin strategy', href: '/tools/scenarios' },
  { id: 'campaigns', title: 'Marketing Campaign Lab', description: 'Planned campaign budgets, goals, creative, and measured outcomes.', category: 'Grow', keywords: 'ads google lsa social referral conversion' },
  { id: 'research', title: 'Opportunity & Research Lab', description: 'Planned market research, experiments, and new venture validation.', category: 'Grow', keywords: 'innovation competitor opportunity market' },
  { id: 'fleet', title: 'Vehicles & Equipment Registry', description: 'Planned asset ownership, maintenance, faults, and loadout tracking.', category: 'Operate', keywords: 'truck rig washer pumps tools maintenance' },
  { id: 'employee-operations', title: 'Employee Operations', description: 'Planned integrated shifts, skills, training, and earnings review.', category: 'People', keywords: 'crew workforce payroll commissions technician' },
  { id: 'decisions', title: 'Founder Decision Log', description: 'Planned auditable options, approvals, and strategic commitments.', category: 'People', keywords: 'strategy policy meeting governance oscar jacob' },
  { id: 'contracts', title: 'Contracts & Obligations', description: 'Planned expirations, service terms, insurance, and obligation tracking.', category: 'Control', keywords: 'legal document risk compliance renewals' },
  { id: 'automation', title: 'Automation Studio', description: 'Planned reviewable internal workflows with receipts, limits, and pause controls.', category: 'Control', keywords: 'ai agents workflow rule notification' },
  { id: 'systems', title: 'System Health & Releases', description: 'Planned authorized view of deployment, integration, and incident health.', category: 'Control', keywords: 'github tailscale monitoring server backups security' },
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
