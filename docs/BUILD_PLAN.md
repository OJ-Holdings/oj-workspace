# OJ shared workspace build plan

## Product and ownership

Oscar solely owns Strathion Group LLC. OJ is a separate shared business with Jacob. This workspace covers OJ Exterior Care and OJ Solutions; it grants no access to Oscar's private STRATHOS system. Technology ownership and licensing are business decisions, not inferred from sharing a workspace.

## Architecture

Public access is now enabled through an OJ-only HTTPS Funnel on port 10000; visitors need no Tailscale installation. Private STRATHOS ports remain tailnet-only. This desktop deployment requires the PC to stay on; independent cloud hosting is still a reliability upgrade. Legacy customer tables are now backend-only, with public quote submission preserved and quote reads restricted to the two pre-existing accounts. Signup requires no email confirmation at the user's request; owner bootstrap is bound to an administrator-approved Auth user ID, and member access requires private invitation possession plus a matching account email.

Independent Next.js application at apps/oj-workspace, separate deployment and configuration from dashboard. The user selected the existing Exterior Care Supabase project for the new additive OJ workspace tables; inspect and stage changes before applying them. Supabase Auth verifies each account; an explicit organization-membership table authorizes data. All shared records carry organization_id. Ordinary requests use publishable keys plus verified user sessions, never privileged service-role keys. Shared navigation can link from STRATHOS later; no private API proxy.

Initial schema: organizations, memberships, cards, comments and immutable activity events. The initial shared board is a view of cards; configurable boards are a later extension. Composite foreign keys prevent cross-organization references. Card revisions reject stale writes. Owners/members can collaborate; viewers read. Membership provisioning is an administrative operation, not a self-service role editor. Accounts and memberships remain distinct.

Future business schema: customers, properties, opportunities, quote versions/line items, jobs, work sessions, payments, itemized costs, retention opportunities. Preserve legacy IDs and source provenance. A completed job is separate from paid status. Unknown costs remain null. Historic dates inferred from updates carry an explicit uncertainty flag.

## Visual direction

Navy ink #18283D, blue #315DCE, pale slate #F3F5F9, white #FFFFFF, muted steel #607086, amber #A66B20. Practical operations interface with a dark left navigation, spacious pale work surface, restrained cards, clear business labels and prominent shared board. System sans for fast local rendering, tabular numerals for quantities. Left aligned. One memorable element: the work board itself. No decorative command-center effects on the business screens. Respect keyboard, mobile, contrast and reduced motion.

## Delivery stages and completion evidence

1. Foundation (built locally): reviewed skills, architecture, responsive board preview, session-bound auth plumbing, schema plus executable isolation tests. Preview fixtures are visibly fictional and persist only in the local browser. Live routes fail closed without configuration.
2. Shared launch (interfaces built, live activation pending): email-bound invitations, verified acceptance, password recovery, owner membership administration, live subscriptions with authenticated 15-second refresh fallback, connection status, draft conflict notice and recent activity. Configure staging against the user-selected Exterior Care project; inspect/apply additive schema, bootstrap Oscar and invite Jacob. Verify two actual accounts, viewer restrictions, membership removal and email flows. Attachments and notifications are later work. Deploy independently with backup/restore and rollback rehearsal.
3. Exterior Care migration: inventory actual live schema, dry-run importer, legacy-ID mapping, preserve conversations and financial provenance, reconcile counts and totals. Keep current system available. Move SMS/webhooks/calendar under one owner; provider IDs deduplicate webhook retries. Verify send status and opt-out handling before cutover.
4. Operating intelligence: phone closeout, real direct cost categories, worker-hours and travel time; dashboards show data completeness alongside contribution margin. OJ Solutions delivers GoHighLevel AI services, including AI receptionists like Exterior Care's existing system. Its projects need discovery, setup, test calls, customer acceptance, launch and ongoing support; track setup revenue separately from recurring revenue and provider/usage costs. Keep GHL credentials in scoped integration storage, never board cards.
5. Revenue agents: rank opportunities and prepare messages; log proposal, approval, execution, provider delivery, response, quote, job and payment. Track cost and failure. Experiments compare against a predeclared baseline/holdout and account for sample-size limits; attribution alone is not incrementality.
6. Strathion commercialization: identify a repeatable customer problem, validate willingness to pay, separate customer tenants, establish packaging, onboarding, billing, support and unit economics. Do not extrapolate OJ's results to other companies without evidence.

## Skills and use

Installed: supabase, supabase-postgres-best-practices, frontend-design, web-design-guidelines, mcp-builder, revops, analytics, ab-testing, pricing, product-marketing, attribution, reactivate. Existing: Next.js/React, browser verification, security review and deployment skills. Apply the relevant skills at their delivery stage rather than forcing pricing or customer outreach into foundation work. Review linked dependencies before adoption. Maintain four project-specific skills: workspace engineering, operating intelligence, revenue experiments, Strathion product development.

## Security and operational release gates

No production release until authenticated and anonymous database tests pass; cross-tenant reads/writes/references, role escalation, stale writes, revoked membership and HTML injection have been exercised. All personal routes are absent from this deployment. Attachment ACLs, server action origin protection, provider webhook signatures, durable job retries, audit history, dependency audit, monitoring, backups and restore must be verified for features actually shipped. No claim of exhaustive security based on automated tests.

## Current limits

Shared-launch implementation verification: 35 automated checks passed, including 15 invitation/membership database cases and two auth-input cases. Production build/TypeScript passed. Browser checks covered recovery/invitation screens while unconfigured, preview activity generation and opening a card from history. Tailscale serves the updated built app on port 10000. No real Auth email, user signup, shared-device synchronization or live schema change has been verified yet.

Local verification: production build and TypeScript passed; 17 automated checks passed, including database policy tests against the actual schema in isolated PGlite with test authentication. Browser checks covered card creation, moving stages, checklists, comments, reload persistence, desktop/phone layouts and the unconfigured workspace redirect to disabled sign-in. Dependency audit reported zero known vulnerabilities. All four custom skills passed the skill validator. These checks do not replace real Supabase session tests or a production security review.

Supabase is connected. The inactive OJ EXTERIOR CARE LEADS project was restored to ACTIVE_HEALTHY, and the additive workspace/collaboration/owner-enrollment schema was applied (migration 20260930221605). The public client connection uses the project's publishable key; no existing secret environment files or privileged keys were accessed. Actual public REST checks verified anonymous card access is denied and owner enrollment recognizes only the assigned email. All five new public tables have RLS; workspace records are published to Realtime. The live app now requires actual sign-in rather than showing disabled account forms.

Remaining: administrative Auth callback URL/email-template configuration, verified owner account creation/claim, Jacob invitation and actual two-account collaboration tests. Supabase admin pages required sign-in in both available browsers; the connector exposes no Auth-configuration operation. No real passwords, signups or confirmation emails were generated by the agent. Local checks now total 41 passed, including one-time owner enrollment.

Pre-existing launch issue: legacy leads/conversations/bookings/settings allow all operations under public policies; doorknocking_sessions has RLS disabled and anonymous grants. Preserve these until a compatible backend/policy migration is designed, but do not describe the entire project as secure while they remain. Advisor warnings for the new narrow enrollment/invitation RPCs are intentional SECURITY DEFINER entry points with explicit identity checks, fixed search paths and restricted grants; private tables deliberately have no member policies.
