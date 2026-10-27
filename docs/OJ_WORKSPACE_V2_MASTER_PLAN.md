# OJ Workspace V2 — Four-Business Operating System
**Status:** Audited plan, NOT implemented. **Baseline:** main \`3bc25adef32a\` (2026-10-22). **Owners:** OJ Holdings founders. **Scope:** OJ Exterior Care, OJ Solutions, OJ Essentials, Oscar Jacob (content).

## Mission and invariants
Make OJ Workspace the trusted daily operating system: show next actions, move a prospect through delivery and verified payment, share real evidence across founders, and support field staff without leaking confidential information. Preserve prior records, existing login identities and Supabase memberships, the STRATHOS separation, current integrations, and live port 3011/Tailscale while improving the application.

Never claim sample or synthetic records are real; preview data stays confined to /preview. Never equate a completed job with collected cash, a proposal with a sale, Shopify gross receipts with margin, or imported lead counts with active pipeline. Every monetary metric must have a named source, date basis, denominator and coverage. No external messages, purchases, financial transfers, account deletions, public publishing or autonomous business actions without explicit authorization and audit receipts. Keep current production live through incremental releases.

## Verified baseline — October 22, 2026
- Production Supabase project: "OJ EXTERIOR CARE LEADS"; 22 public tables, 11 recorded migrations. Both founder Auth identities exist and are confirmed with owner memberships. Jacob reports his login is now restored; don't recreate or delete it.
- Exact counts (read-only SQL): 177 Exterior leads; 37 bookings (36 distinct lead IDs); 28 shared cards, 2 unassigned; 80 Solutions outreach prospects with NULL workspace status overrides, 0 outreach activity rows; 0 general finance entries, 2 document records, 0 messages, 12 work sessions. All 37 bookings show confirmed status at the time of inspection.
- Exterior leads: 71 completed, of which 54 have job_revenue, 11 job_cost and 54 completed_at; 83 closed, 9 following_up, 6 booked, 4 new, 4 contacted. 47 leads lack addresses; 63 lack quote amounts. No assumptions about why.
- Repo is Next.js 16, React 19, Supabase SSR, TypeScript, Shopify read integration, GoHighLevel read integration, local PowerShell updater. Current venture IDs are \`exterior\`, \`solutions\`, \`essentials\`.
- The application \`src/lib/ventures.ts\`, \`src/lib/board.ts\`, \`src/lib/metrics.ts\`, UI routing and multiple database CHECK constraints allow only three ventures. Adding content requires reviewed schema + application release coordinated safely.
- Supabase migration history already lists work_calendar_sync, employee portal, outreach pipeline and work leaderboard, even where repository files are called pending. Reconcile actual applied state and never replay migrations indiscriminately.
- Current live automated deployments: green GitHub main commit, detached worktree, \`npm ci\`, typecheck, tests, build, localhost staging on 3012, live 3011 health check and rollback attempt. Auto deploy refuses changes under \`supabase/\`, \`.env.example\`, \`src/lib/oj-connection.ts\`. Schema/config changes are manual release gates, not ordinary auto-deploys.
- Current docs conflict: \`docs/DEPLOYMENT.md\` claims Netlify main is authoritative, but October 22 working production is Windows/Tailscale on 3011/Funnel 10000. Resolve hosting truth and update docs.
- Security advisors: 5 anon-callable and 34 authenticated-callable SECURITY DEFINER RPC findings; 14 tables with RLS enabled and no policy (many under private schema), 24 unindexed foreign keys. Findings need function/grant review, not blanket grant revocations or assumed breaches.

## Definition of done
1. Each founder can authenticate, recover passwords independently, and access authorized company records on PC and phone. Member, viewer, employee and owner actions tested for forbidden access with real RLS or isolated fixture sessions.
2. Four business sections can create/read/update scoped records with durable saves, time metadata, histories and cross-links. No Oscar Jacob save operations fail due to three-venture assumptions.
3. A real customer or prospect moves along a single navigable activity timeline into quote/opportunity, booked job or signed project, fulfilled service, invoice/collection, and follow-up, without duplicating canonical source records.
4. An Exterior technician can view assigned jobs, confirm steps, upload required closeout evidence, and see approved earnings. Founders review and approve, no automatic cash transfers.
5. Financial views distinguish booked, invoiced, collected, refunded, disbursed, cost-known and cost-unknown. Company-wide profit is withheld when relevant coverage is insufficient.
6. No live destructive schema migration, existing account deletion, external message, publishing, bank action, or STRATHOS action occurs silently.
7. Desktop and mobile E2E smoke tests pass; app remains healthy after supervised/automatic safe release and supports tested rollback.

## Architecture

### A. Organization and venture registry
Keep \`oj_organizations\` as holding-level scope. Add a \`oj_ventures\` registry with immutable IDs/slugs, display names, operating/archival state and logo/theme attributes. Use \`content\` for the Oscar Jacob application slug and \`Oscar Jacob\` as the display name. The registry may be code-backed initially but plan the schema for forward-compatible venture references rather than new hard-coded three-item CHECK clauses. New records retain org scope; old records keep their original venture strings through additive migration. Define authorized owner, operator, viewer and employee capabilities explicitly; membership never comes from user_metadata.

### B. Stable identity and traceable source links
Introduce organization-scoped contacts, companies, properties, opportunities, projects/jobs, activity entries, linked files, assignments and optional external_source identifiers. Maintain old \`leads.id\`, \`bookings.id\`, Shopify order IDs and GHL IDs as canonical references, not silently replaced UUIDs. Add link tables and an idempotent sync ledger; don't rewrite or dedupe existing records until reviewed. Resolve duplicate suggestions in the UI before merge. Every cross-system reference has origin, provider ID, external creation time, last sync, sync status and evidence link.

### C. Auth, privacy and audit
Jacob's account already exists and login has been restored. Build self-service recovery only after confirming production email/SMTP and callback redirect setup, with generic responses to avoid account enumeration; authenticated password change stays available. Scope every mutation on the server AND in RLS; map capability policies for founder/employee. Audit SECURITY DEFINER RPC implementations and explicit EXECUTE grants (including calendar and invitation endpoints) with fixture tests. Restrict file buckets by org, venture and assignments as appropriate. Use immutable audit entries for approvals, financial edits, source links, critical access changes and publication actions. Avoid service_role in browser, forbid untrusted remote URLs and secrets in logs.

### D. UI foundation and design system
Implement a restrained executive desktop app and genuinely phone-first field/content workflows. Reuse existing brand resources and tokens: holding-company navy; Exterior orange/green; Solutions copper; Essentials cream/ink; Oscar Jacob distinct creator-studio identity (proposed violet/graphite pending brand design). Design tokens, reusable tables/filters/forms/modals/drawers, accessibility, reduced motion and empty/error/loading states. Navigation: Command, Inbox, Businesses (4), CRM, Tasks/Projects, Calendar, Finance, Files, Team, Analytics, Settings. Entity detail pages include linked work, files, activity and next action. Make keyboard search complete and privacy-aware.

## Four vertical workflows

### 1. OJ Exterior Care — lead to paid repeat customer
Intake (Google, web, referrals, historical imports) -> qualification/property/service -> estimate (residential or multi-building commercial) -> written quote and approval -> booking/crew/route/equipment/water requirements -> employee assignment and checklists -> site arrival/photos/closeout -> owner review -> invoice -> confirmed payment and direct cost capture -> review request and recurring-service reminder. Separate quote amount, agreed price, invoiced amount, cash collected, materials/labor costs and margin. Commercial Desk currently stores local drafts: V2 requires shared projects, versioned assumptions, quote status and team permissions. Preserve existing Exterior SMS sender; no duplicate sender or accidental automated outreach.

### 2. OJ Solutions — prospect to recurring client
Prospect research/import -> validated lead with provenance and consent/contact rules -> assigned next action -> personalized draft -> human-reviewed outreach and actual send/response receipt -> booked demo -> proposal -> won/lost -> onboarding -> connected GHL/contact mapping -> AI-agent/service project with deliverables and owners -> QA/handoff -> subscription and renewal status -> support and expansion. GHL remains authoritative for connected GHL customer/call/opportunity records. Never mark a draft as sent or a source row as successfully contacted. Implement pagination/cursor ingestion, sync coverage and retry/idempotency (existing GHL read caps 100 contacts/100 opportunities/50 conversations). No unattended external sending until deliberate opt-in, guardrails and verification.

### 3. OJ Essentials — paid order to profitable fulfillment
Product/SKU/cost catalog -> acquisition/campaign attribution -> Shopify checkout and order state -> fraud/test/cancel/refund flags -> fulfillment/supplier/shipping -> support/return -> accounting allocation -> gross margin and advertising-adjusted contribution -> replenishment or stop decisions. Shopify is read-only now and currently caps most lists at five pages x 50 and 60 days of orders. Separate paid orders from refunds, shipping costs, COGS, ad spend, platform fees and taxes. No invented historic orders or profit. Later write scopes need separate review.

### 4. Oscar Jacob — full creator production pipeline
Idea inbox (format, platform, premise, owners, concept links, date) -> research/brief -> script/shot list -> production budget/location/talent/permissions -> shoot schedule and asset checklist -> footage ingest (original external storage refs, checksums where feasible) -> review/edit versions -> title/thumbnail/caption variants -> approval and scheduled publication -> verified publication URL/platform ID -> performance imports or manual readings -> sponsor/affiliate revenue and expenses -> postmortem/reuse.
- Views: Content Command, Ideas, Production Board, Calendar, Video/Series detail, Asset Library, Publishing Queue, Analytics, Sponsors/Deals, Financials, Templates.
- Content entities: \`content_projects\`, \`content_episodes\`, \`content_shoots\`, \`content_assets\`, \`content_edit_versions\`, \`content_publications\`, \`content_metrics_snapshots\`, \`content_sponsorships\`. Or normalized equivalents with strict FK/organization scopes; no giant freeform JSON as only persistence.
- For each video: platform(s), deadlines, Oscar/Jacob responsibilities, state, checklist, attached files, creative decisions, estimated/actual costs, released links and view/follower/revenue evidence.
- Publish remains a manual-confirmation step until specific platforms' official APIs, account connections, scopes and explicit consent are evaluated. A planned publish is never shown as published. Platform metrics have measurement timestamps, time windows and source status.
- Example daily loop: capture five ideas -> prioritize two -> storyboard -> schedule shoot -> upload footage -> assign edit -> review versions -> schedule approved post -> analyze actual reach, retention and conversions -> spin winning formats into new episodes.

## Shared modules
- **Executive Command:** user-specific next actions, review queue, dispatch, meetings, expected collections vs settled amounts, source health, coverage badges, overdue work, 4-venture comparison, and linked drill-down.
- **Unified CRM:** multiple contacts and properties per customer, status history, tags, pipeline ownership, duplicate-suggestion queue, task linkage and channel-specific communication receipts.
- **Tasks/Projects:** boards + list + calendar + timeline, assignee as stable member ID (not display-name text), approval gates, due/overdue, recurring work, saved views and activity history. Protect optimistic edits with revisions.
- **Calendar/Dispatch:** single organization schedule, member availability, connected source origin, job schedules, content shoots, production and editorial deadlines, day/week/month, mobile agenda, reschedule audits.
- **Finance:** ledger with immutable source references, invoiced/paid/collected dates, cost categories, tax/accounting review, refunds, reconciliation status, company/venture allocations, reporting coverage and cash vs accrual definitions. Keep Mercury owner-controlled/read-only unless explicitly expanded.
- **Team:** founding owners, member permissions, technician portal, invites, password recovery, activity, approval and payouts recording (not transferring).
- **Files/Knowledge:** org-scoped permissions, linked records, version/expiry, upload controls, audit events, templates, safe download links and content footage external-storage refs (not huge videos directly in default database).
- **Notifications/Activity:** persisted inbox, task/review/assignment/due-date alerts, unread/seen state, user preferences, no noisy fake notifications, optional external delivery after permission checks.
- **Automation:** safe internal summaries, deterministic suggestions, reminders, drafts, validation and repeat-safe imports; manual approval for external action. Visible status, event receipts, pause/resume and duplication protection.

## Implementation waves — dependency order (not a fixed calendar)
**Wave 0 — Secure baseline and recovery**
- Verify current local production/deploy receipt, two-founder login, mobile reachability, admin controls and backup/restore path.
- Read-only schema/migration/RLS/function/grants audit; inventory integration credentials by presence only.
- Turn docs/DEPLOYMENT.md into current-hosting truth; document Netlify status separately. Add smoke tests around founder membership and no-PII preview. Baseline metrics contract tests.

**Wave 1 — Core platform foundation**
- Formalize entity IDs, venture registry and capability matrix. Add actual Oscar Jacob record support with additive tested schema updates and backfills only when explicitly reviewed.
- Extract domain services/server actions from giant client views; centralize input validation, audit, coverage reporting and error handling. Establish reusable UI kit, typography and app shell, mobile navigation.
- Deliver core Command and reliable four-business navigation before module redesign.

**Wave 2 — Shared records and workflow primitives**
- Unify contacts and activity linking without destroying legacy sources; build record detail and cross-entity links.
- Projects, tasks, assignments, approval and reminders; organization-wide search; file attachments and schedules.
- Define idempotent ingestion/sync health for external sources.

**Wave 3 — Content business first production vertical**
- Ship Oscar Jacob production board, video records, roles, editorial calendar, asset references and manual publication receipts.
- Add analytics/sponsor finance once authoritative data sources are validated. E2E: create real idea -> schedule -> assign -> upload refs -> review -> record published link -> measured performance.

**Wave 4 — Exterior operations & Commercial Desk**
- Map historic lead/bookings, commercial quote sharing, job closeout and employee approval, cost completeness and real payment timestamps. Preserve the legacy SMS process and test existing employees.
- E2E: quote -> schedule -> assignment -> closeout -> invoice/payment entry -> service follow-up.

**Wave 5 — Solutions pipeline and delivery**
- Give 80 imported prospects an explicit effective default, dated action history, owner assignment, outcomes and conversion into projects. Verify GHL pagination and source mappings. E2E: import -> draft -> human-reported send -> response -> demo -> active client project.

**Wave 6 — Essentials & financial operations**
- Supplier/COGS/ads/refunds, Shopify pagination/backfill policy, exception work queue, reconciled portfolio reporting and allocations. No false profitability.

**Wave 7 — Production hardening**
- Cross-role access tests, performance/index improvements, backup recovery drill, mobile device QA, observability, retention, accessibility and deployment rollback exercise. Choose a reliable independent hosting plan only when pricing/uptime/security are proven.

## Engineering execution protocol for each wave
1. Write a narrowly scoped RFC/acceptance criteria referencing real records and existing routes.
2. Inspect current production read-only; freeze the schema contract and source-of-truth ownership.
3. Implement branch + reviewed PR with no secrets, synthetic fixtures and tests for roles/data accuracy.
4. For schema changes: produce forward/back migration scripts, RLS/grant review, dependency sequence, verified backup, and supervised manual cutover. Never depend on an automatic GitHub deployment to apply SQL (deployer blocks it).
5. CI: npm ci, typecheck, unit/integration tests, build, migration contract/fixture test; add Playwright browser smoke for desktop/mobile and two-user authorization, then expand.
6. Verify candidate in isolated preview/staging; test connected-source failures, rate limits, pagination, duplicate import, offline, no-data and privacy paths.
7. Release with a named reviewer, production health check, small canary when possible, verified record counts and rollback plan; write release receipt and operator guide.
8. Update executive dashboard only with metrics whose source, date and completeness are known.

## Non-negotiable V2 acceptance scenarios
- Oscar and Jacob concurrently edit distinct assignments; both observe saved changes with no lost updates.
- Oscar Jacob content task and document save and reload without unsupported-venture errors.
- 71 completed Exterior leads do not accidentally become 71 cash payments; dashboard reports only 54/71 revenue fields, 11/71 costs until corrected by evidence.
- 80 imported Solutions prospects are not misrepresented as 80 contacted leads; drafts never count as sends.
- Paid Shopify orders exclude tests and cancellations; refunds and costs are not inferred.
- Employee URL cannot read unrelated employee/customer/owner banking information; all server actions enforce same permission matrix as UI.
- Anonymous and viewer sessions cannot read protected records via direct REST, RPC or route requests.
- Site survives failed build/release and exhibits verified original live release or an explicit operator alert; auto deploy does not run schema/config migrations.

## Initial action queue
P0: audited source-of-truth map, current hosting docs, backup/restore verification, founder two-device smoke, security definer review, 4th-venture migration design and role matrix.
P1: fourth-venture database support + frontend types/UI; Oscar Jacob idea/production board with real persistence and proof of E2E.
P1: unify task identity/linking and source-aware customer/project timeline.
P1: Exterior estimate -> shared commercial project and job-payment correctness.
P1: Solutions dated outreach activity and execution queue.
P2: integrations paginated/observable, finance reconciliation, content analytics, documents/versioning, notifications.
P3: scalable hosting, comprehensive mobile/PWA features and advanced approved automations.

## Operating owners and release controls
Both founders should own day-to-day operating records and review work. Sensitive admin/key management and banking visibility use explicit capabilities, not accidental founder exceptions. Destructive operations, ledger posting, live media publishing and outbound campaigns require deliberate confirmation. No unsupervised schema changes, customers sent messages or purchases. Feature PRs must not be merged blindly merely because the 5-minute deployment task exists.

## Current known gaps in this audit
The authenticated UI on real phones has not been regression-tested in this inspection. Shopify/GHL/Mercury API credentials and live responses were not accessed. Private employee schema row counts and security-function bodies remain to audit. No migrations, RLS permissions, accounts, customer records, live publish actions or production code have been changed for V2 by this planning document.
