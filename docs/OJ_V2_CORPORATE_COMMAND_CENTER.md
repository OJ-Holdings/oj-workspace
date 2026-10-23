# OJ Workspace V2 — Corporate Command Center and Capability Atlas
Status: DESIGN BLUEPRINT / NOT IMPLEMENTED
Parent plan: docs/OJ_WORKSPACE_V2_MASTER_PLAN.md
Baseline: 2026-10-22, main 3bc25adef32a
Owners/operators: Oscar and Jacob; OJ Holdings LLC operating environment
Business lines: OJ Exterior Care, OJ Solutions, OJ Essentials, Oscar Jacob (content).

## 0. Expanded mandate: a corporate operating system, not a redesigned task board

The dashboard is the nerve center for everything Oscar and Jacob do to operate and grow OJ Holdings. Design for questions never anticipated by the existing app, but do not cram 50 modules into one landing screen.

The intended product has:
- **A single executive entry point**: one searchable, actionable, live HQ where each founder sees what's important, what needs a decision, what is due, which cash movements are verified, which commitments carry risk, and where the next growth opportunity is.
- **A universal tool launcher**: all authorized tools available in <= 2 navigational actions by command search, contextual actions, or a clearly organized Tools directory; optional pinned favorites. Tools can be native, connected, or safe external shortcuts; their status and boundaries are visible.
- **Four differentiated business operating rooms**, not four static mini dashboards.
- **Shared corporate services**: strategy, finance, CRM, sales, marketing, people, assets, legal/insurance obligations, documentation, projects, analytics, procurement, partnerships, IT, communication, and automation.
- **Extensibility**: a capability registry and domain services for adding new apps, business lines, entities, integration adapters and dashboards without editing giant if/switch blocks or breaking RLS.
- **Correctness and control**: show source freshness, unknowns, incomplete coverage, error states, money definitions, human approvals, secure sharing, and reversible changes.
- **A disciplined low-cost philosophy**: reuse existing Next.js, TypeScript, Supabase and the deployer first. Enable premium APIs only when business value and budget justify them.

'Corporation' describes the desired headquarters experience. The current company is named OJ Holdings LLC; do not assert that its legal classification is a corporation. Also do not assume the four lines are separate subsidiaries. Model brands, trade names, legal entities, bank owners, founders' rights, subsidiaries, partners, and tax jurisdictions separately; set them from verified company records.

## 1. HQ layout and information architecture

### 1.1 Home: Executive Command / Mission Control
Above the fold, the user should see:
1. Identity and context: company, founder, business date in America/Chicago, data freshness, quick workspace switch, global search/command palette, notifications, connection/offline warnings, link to the current production release status.
2. **Today's mission**: top 3-5 ranked actions with why, source reference, urgency, accountable person, time estimate if entered, one-click 'Open work', Snooze/Delegate/Complete, and ability to pin a priority. Source-backed rules first; AI suggestions are explicitly suggestions.
3. **The four-company strip**: each line's open work, nearest deadline, today's bookings/shoots/demos/orders, verifiable money metric, data-health indicator, and one quick action, with click-through to the corresponding source.
4. **Decisions awaiting approval**: unreviewed quote, invoice, contractor payout record, employee closeout, proposed outreach, published-content approval, vendor purchase, contract, cost reclassification, due obligations. No execution until approved.
5. **Financial pulse**: currently known operating cash from authorized connected accounts (not assumed), gross collected amounts, open invoices, near-term known commitments, estimated cash runway only when inputs sufficiently complete, allocations/budgets, this month's known direct-cost coverage, fees/refunds, exceptions. Display unknown/not connected rather than 0.
6. **Next 7 days**: calendar, jobs, shoots, demos, assignments, renewals, payouts due, insurance/compliance dates and content schedule; fast view toggles.
7. **Alerts and exceptions**: overdue, missing job cost, duplicate suspected lead, failed connector, unsigned proposal, out-of-stock, negative-margin product, overdue client, uninsured equipment, missed posting deadline.
8. **Company targets**: actuals vs company/venture goals and leading indicators (e.g., booked jobs, outreach attempts, demo rate, published videos, retention), with source and denominator visible.

The Home view is not a place to expose all underlying records. The default is 4-8 meaningful panels, with **customizable role-specific tiles** below or in secondary tabs. The content of every card must have a next action or a reason for being there.

### 1.2 HQ secondary spaces
- **Operate**: Today's Queue, Inbox, Tasks, Projects, Calendar/Dispatch, Contacts/CRM, Files/Knowledge.
- **Grow**: Leads & Sales, Marketing Campaigns, Partnerships, Market Intelligence, Pricing Studio, Experiments, Content.
- **Control**: Finance & Accounting Review, Budgets, Obligations, Contracts, Assets/Fleet, People/Commissions, Risk & Security.
- **Understand**: Analytics, Forecasts/Scenarios, KPI Catalog, Data Quality, Integrations, Audit Activity.
- **Build**: Tools, Automation Studio, Templates, Internal AI Workbench, Ideas/R&D, Settings/Admin.
- **Business Rooms**: Exterior Care / Solutions / Essentials / Oscar Jacob, retaining universal cross-links.
Group these as searchable destinations with only the most-used in the fixed sidebar. Do not create separate menu entries for every micro-tool.

### 1.3 Universal tool surface
- Global command palette (Ctrl/Cmd+K and phone equivalent) searches permissions-aware commands, destinations, customers, tasks, jobs, deals, videos, documents, dates and registered tools.
- Typed natural language can *propose* commands; user sees the exact resolved action/target before mutations.
- Quick create: Lead, Estimate, Job, Task, Project, Expense, Video Idea, Shoot, Contact, Meeting, Note, Follow-up, Issue, SOP, Vendor, Campaign.
- Contextual record action menu: link to task, schedule follow-up, attach file, create quote, assign team member, produce reviewed draft, add expense, make approval.
- Tool directory card metadata: owner, description, domain, cost tier, integration, permission, status, last run and help.
- Owner-configurable pinned favorites and user-specific layout (with versioning and reset).
- Every native or integrated tool must have an authoritative read/write boundary and visible success/failure receipt.
- Tool registration must not permit arbitrary external code execution, embedded secrets in client metadata, or bypass of RLS.

## 2. Corporate services — capability atlas
Legend: CORE = initial operational platform; HIGH = next useful scope; LATER = optional if demand/evidence arises. Feature priority is distinct from business criticality; a security prerequisite is always P0.

### A. Corporate planning, governance and founder coordination
CORE:
- Goals, strategic initiatives, annual/quarterly objectives and key results, accountable owner and due date.
- Founder Decision Log: options considered, assumptions, attached evidence, votes/approvals when needed, final decision, superseding decision, outcome review.
- Weekly executive review agenda: wins, missed commitments, pipeline, cash, operations risks, owner actions. Meeting notes generate attributable tasks only after review.
- Company calendar and commitment register; who owns which business obligations.
- Single project portfolio: all launches, jobs, commercial bids, agency engagements, campaigns, productions, infrastructure.
HIGH:
- Business model canvas per line, growth hypotheses, project ROI tracker, milestone-based strategic roadmap.
- Operating agreements and legal-entity facts stored as verified protected documents/metadata, **not** inferred legal allocations.
- A company policy/SOP library with versioning, effective date, acknowledgements and training.
LATER:
- Entity/subsidiary ownership mapping, board/advisor portal, investor/bank due diligence data room, franchise/license operating packages.

### B. Finance, treasury, pricing, tax readiness and unit economics
CORE:
- Financial Command: classify **quoted, contracted, invoiced, receivable, collected, transferred, refunded, expensed, paid out** separately.
- Review queue for unreconciled bank transactions and unidentified inflows/outflows; no automatic ledger posting or bank action.
- Revenue/cost capture per business, job/project/product/video attribution; cost-known and evidence-source badges.
- Cash planning with user-entered commitments, accounts and budgets; missing banks or untracked cash flagged.
- Owner-controlled bank data; no secrets in browser. Accounting exports and supporting attachment links.
- Cost/profit visibility with denominator coverage; profitability suppressed or called incomplete for missing material costs.
HIGH:
- Quotes, payment schedules, deposit vs outstanding balance, invoice tracking, vendor bills, receipt capture, expense submission/review, tax-category tagging (accountant-reviewable).
- Pricing and margin simulators for Exterior job crews/equipment, Solutions setup vs MRR, Essentials COGS+ad ROAS and Content sponsor rates/video budgets.
- Business-level budgets, variance alerts, recurring commitments (subscriptions, domains, fuel, insurance), allocation and reimbursement ledger.
- Owner partner distributions, vehicle cost reimbursement, employee commissions/earnings *records* with formula/version/approval; no silent payouts.
- Profit/cash forecast as scenarios using explicit assumption ranges; no false precision or "guaranteed" daily growth.
LATER:
- Professional accounting integration, reconciled accrual reports, tax document checklist and deadlines, loan tracker, capital expenditures, financing scenario comparison, asset depreciation schedules (tax professional review).
Guardrail: no fabricated tax return, bank balance, legal distribution rule, payroll remittance, accounting compliance or cryptocurrency/trading orders.

### C. Sales, prospecting, acquisition and client success
CORE:
- Universal CRM entities with contact/company/property relationships and full activity provenance.
- Acquisition channel tagging, lead source cost, status pipeline, assignment, next action, response/quote/demo history.
- Shared proposals/estimates and versioned deal terms, templates, activities, close/loss reasons.
- Today's assigned prospect execution queue, follow-up reminders and conversions grounded in actual activity timestamps.
HIGH:
- Campaign builder for reviewed outreach lists, email/DM templates, approved sending receipts, channel suppression/opt-out handling.
- Client onboarding, deliverables, service tickets, recurring/renewal account plans and customer satisfaction.
- Referral/partner network, referral attribution, relationship map, territory/opportunity geographic map.
- Customer self-service portals only when service workflow requires them.
LATER:
- Territory scoring, competitive research, reputation/SEO monitoring, authorized social listening, automatic lead enrichment with source and usage rights, A/B experiments.

### D. Operations, dispatch, quality and field service
CORE:
- Lead/property/service -> proposal -> confirmed booking -> crew assignment -> job run -> photo/checklist closeout -> QA -> invoice -> paid status.
- Day/week dispatch; crew availability and tools; site instructions, service standards and history.
- Commercial Desk promoted from local browser drafts to shared versioned bid workspace, with water access, logistics, access permissions and lift/rental/equipment assumptions explicitly documented.
- Incident/near-miss reporting and safety/PPE checklists.
HIGH:
- Route plan and practical stop order, estimated drive time based on licensed routing data when connected (never invent ETA).
- Equipment asset ledger: pressure washer, pumps, reels, hoses, filters, DI resin, poles, ladders, vehicles, tools, serials, owners, photos, purchase, usage, maintenance, faults and replacement intervals.
- Equipment maintenance and consumables replenishment workflows: actual usage and vendor quotes.
- Vehicle odometer/fuel/reimbursement, job travel and scheduling; documented loadout and rig-builder diagrams.
- Vendor rentals and subcontractors, certificates/insurance expiry tracking, permits and commercial access approvals.
LATER:
- Local offline dispatch mode with sync-conflict resolution, GPS evidence only with informed consent, weather-sensitive schedule rules, job profitability benchmarking, territory heat maps, route clustering.

### E. Oscar Jacob media studio: creator + commercial content
CORE:
- Cross-platform Idea Inbox; series/season/video records, script/shotlist, owners, editorial priority, next action.
- Preproduction schedule, filming logistics, linked locations/permissions/budget, footage asset references.
- Video edit versions, review comments, approval and manually verified publication links.
- Publishing calendar across the founders and channels.
HIGH:
- Creative Brief Generator, thumbnail/title variant tracker, multi-platform repurposing checklists and approved copy.
- Channel and video analytics with source timestamps, audience growth and retention where official APIs support them.
- Sponsor/brand CRM, media kit, rate card scenarios, deliverables, invoice and sponsorship revenue.
- Music licensing and usage rights records, release forms, talent permissions, claim/dispute tracking.
- Content performance library and format experiments with benchmark caveats.
LATER:
- Authorized publishing connectors, caption/transcript editor, clip suggestions, structured ingest from video storage, brand collaboration/client content workroom.
Guardrail: never auto-publish to a public audience or claim views/revenue without verified platform source and explicit authorization.

### F. OJ Solutions: services and agent delivery
CORE:
- Lead/demo/opportunity -> signed client -> onboarding -> technical setup -> QA -> service status -> support -> renewal.
- Client projects, tasks, proof of delivery, service specifications, domain/token configuration inventory **without storing secret values in documents**.
- GHL contacts/opportunities/calls linked by stable provider IDs and verified timestamps.
HIGH:
- Subscription revenue schedule, customer success score, incidents, uptime/SLA tracker and change approvals.
- Template catalog, quote/scope builder, contract/support playbooks, troubleshooting runbooks and client access portal.
- Workflow automation audit, API usage/cost tracking and demo/test environment.
LATER:
- Usage-based billing, AI service QA/coaching, voice-call performance review with consent, white-label partner portal.
Guardrail: no unauthorized outbound client messages, impersonation, secret sharing or automatic service modification.

### G. OJ Essentials: commerce and physical products
CORE:
- Shopify source-native orders/catalog/inventory and fulfillment exceptions, missing connector coverage.
- Product SKU cost catalog, fee/refund/ad-spend capture and evidence-backed contribution margins.
- Product/supplier files and commercial operations tasks.
HIGH:
- Product decision lab, landed costs/shipping/returns by SKU, stockout forecasting, ad campaign performance.
- Inventory alerting, shipping delays and failed deliveries, product page experiment planner, customer support queue.
LATER:
- Wholesale/B2B relationships, supplier scorecard, multi-channel selling and return automation with write permissions subject to approval.

### H. People, schedules, hiring and internal communication
CORE:
- Member/employee permissions, founder owner parity for routine ops, employee assignment view, checked earnings and commissions.
- Shift and availability planner, onboarding checklists and training documents, written responsibilities.
- Linked, searchable contextual comments and alerts.
HIGH:
- Candidate pipeline, interviews, reference and authorization checklists, certifications, safety training and expiry.
- Time tracking, productivity and capacity reports with explicit metric definitions; 1:1 review and feedback notes with restricted access.
- HR-sensitive documents isolated from normal shared files.
LATER:
- Payroll-provider integration and tax withholding data only with proper compliance; no DIY assumption that a pay ledger is payroll.

### I. Legal, risk, information security, quality and compliance
CORE:
- Role-permission matrix; verified company legal details and obligations registry; contract/document expiry reminders.
- Insurances/certificates, incident register, customer dispute/chargeback tracker.
- Real data backups, restore drill receipts, source-sync health, access/audit logs and privilege review.
HIGH:
- Standard templates for contracts, service terms, change orders, scopes, waivers and release forms (always legal review).
- Privacy/data retention policies, customer deletion/export request processing, breach response checklist, vendor risk register.
- Security center: API token presence/freshness but never values, failed logins, service status, live deploy version and rollback controls with explicit permissions.
LATER:
- Formal governance/certifications or compliance workflow only if contract/client requirements justify.

### J. Marketing, brand, market intelligence and growth
CORE:
- Campaign planner: goals, channel, budget, asset requirements, launch checklist, responsible people, measured outcomes.
- Website/domain/property registry for each brand, business profile and listing/link tracker.
HIGH:
- Marketing analytics and attribution with stated limitations; local ads/Google Business Profile, ranking/reviews manually or via authorized connector; content across brands.
- Competitor/market brief linked to sources, conversion funnel and pricing experiments.
- Partner/sponsor referral pipeline, promotional asset library, brand guide and approval workflows.
LATER:
- Programmatic SEO, outreach enrichment, social scheduling and multi-platform publishing when source rights and official API access are confirmed.

### K. Asset, procurement, IT, research and knowledge
CORE:
- Asset/inventory registry for vehicles, equipment, computer hardware and business-owned subscriptions with ownership and location.
- Procurement request -> research -> price/vendor comparison -> owner approval -> receipt -> asset/expense record.
- Docs/SOP/wiki, smart search, troubleshooting incidents, internal request queue.
HIGH:
- Vendor directory, warranty history, equipment purchasing calculator and bid comparisons, domain/renewal monitoring.
- Founder R&D lab: new business opportunities, prototypes, technical specs, experiments, budgets, success metrics and stop decisions.
- IT command: production endpoints, CI status, deploy receipts, Tailscale and connector health, incident log, no direct exposure of STRATHOS private internals.
LATER:
- Internal app builder/tool registry, licensed integrations to third-party products, cross-venture reusable modules and incubator support for future brands.

### L. Corporate analytics, planning and decision science
CORE:
- Universal metrics catalog: source, definition, date basis, refresh, confidence/coverage and permissions.
- Cross-company P&L-like operational summaries explicitly distinguished from audited books.
- Exception-first reporting and drill-down into source records.
HIGH:
- Pipeline funnels, cohort conversion, acquisition CAC where spend attribution exists, retention, contribution margin, team capacity and lead-to-cash timing.
- Scenario engine: what happens if 10/20/30 weekly Exterior jobs, staffing change, close-rate variance, content frequency change or Essentials ad spending are varied—labeled simulated assumptions, not forecasts.
- Expected revenue weighted by agreed stage probabilities, annotated with uncertainty rather than counted as cash.
LATER:
- Data warehouse when source volumes warrant it, predictive models only with evaluated historical accuracy and robust confidence bounds.

### M. Internal AI workbench and safe automations
CORE:
- Natural language search over **authorized** records and linked SOPs, citations/backlinks to exact origin.
- Briefing generator: morning priorities, daily close, weekly executive summary, source diagnostics, unassigned/deadline work.
- Draft helpers for quotes, follow-ups, proposals, scripts, video descriptions, SOPs and meeting notes; drafts never silently send.
- Rules engine for reminders, record quality checks and repeat-safe import jobs with run receipts.
HIGH:
- Model-provider router: local model for low-risk classification/drafts, paid model only when justified; per-feature token/cost budgets and opt-out; user selects how AI can access data.
- Human approvals, simulation previews, cost caps, retries, deduplication, audit trail, pause/resume and dry-run.
- AI analyst compares performance vs tracked goals, explains methods, flags missing evidence and says when it does not know.
LATER:
- Semi-autonomous internal project executors restricted by role/tool allowlist, scoped time/cost budget and active stop control. Autonomous external transactions or messages only under new explicit opt-in and verified receipts.
- STRATHOS integration, if ever wanted, is optional and disconnected by default. It is NOT allowed to share private STRATHOS data or grant commander privileges by default.

## 3. Cross-cutting essential features that remove friction
- **Company Inbox** combines business alerts, mentions, assigned decisions, task comments, missed activities, customer concerns, supplier issues, team requests and integration errors; filter by owner/venture/urgency.
- **Unified Activity Timeline** for every record: factual events, notes, edits, files, decisions, external receipts with actor, timestamp, source and audit links.
- **Global relationship graph** links a person to company, property, job, project, conversation, video, sponsorship, task and invoice. Ambiguous matches require human confirmation.
- **Context-preserving navigation**: return to filters, drafts and scroll position; deep links; keyboard and phone workflows; accessible empty/error/loading states.
- **Capture Anywhere**: phone quick note, photo, file and idea with review-before-submission and offline draft where supported.
- **Notification preferences**: useful in-app alerts by default; email/push only after explicit delivery configuration; quiet hours and deduplication.
- **Personal vs shared**: private idea scratchpads, company work records, HR-sensitive records, owner-only banking views and separate authentication domains where required.
- **Exports and interoperability**: CSV/JSON/PDF where appropriate, import status and error reports, source IDs preserved, ownership of business data retained.
- **No invented metrics** and no default fake progress bars; unsupported info shows "Not connected", "Not recorded", "Needs review", or "Insufficient data".
- **Documentation and help**: searchable feature help, tool owner and changelog, first-use guided workflows, clear terminology and errors.

## 4. Priority matrix and development order

### P0 — TRUST / safety / platform prerequisites
- Backups and actual restore test, access matrix, organization scoping, RLS/RPC security review, migration drift reconciliation, current deployment and health status, cross-user smoke test, founder recovery.
- Identify the real owner of every source record and every existing integration. No new dual-writing before this is clear.
- Apply database schema for fourth venture through reviewed supervised migration; coordinate frontend compatibility.

### P1 — THE FIRST USEFUL HEADQUARTERS
- New HQ shell with organization context, global tool launcher, personalized Today, approvals, Four-Business Strip, Inbox, 7-day agenda, urgent exceptions and favorite tools.
- Unified project/task and entity detail with stable cross-links, permissions and audit trails.
- Oscar Jacob idea-to-published work pipeline, because it is the missing fourth business.
- Correct Exterior's payment/cost coverage and persist commercial estimates for both founders.
- Turn 80 Solutions prospect imports into a next-action queue with dated statuses.
- Make every panel clickable and actionable rather than decorative.

### P2 — HIGH-LEVERAGE OPERATING SYSTEM
- Invoice/receivables tracking, job/crew/cost workflows, media assets, staff schedules, vendor/asset management, recurring commitments, marketing planner, content analytics, client delivery and documented integrations.
- Source quality and historical data reconciliation, workflow automations, safely connected provider read views.

### P3 — COMPANY SCALE & MULTIPLIER TOOLS
- Scenario modeling, strategic objectives, R&D/innovation tracker, vendor/procurement optimization, repeatable SOP automation, customer/client portals, platform analytics, optional approved AI tools.
- More integrations only when actual demand/data provenance/API compliance is established.

### P4 — CONDITIONAL / after demand proves value
- High-cost predictive AI, elaborate multi-entity consolidation, deep accounting integration, autonomous externally-acting agents, advanced dispatch routing, cloud migration beyond necessary reliability, full platform app-builder.
- Gate every speculative build by benefit, implementation cost, ongoing hosting/API costs, privacy, accuracy and maintenance burden.

## 5. Design for speed without feature bloat

Use a progressive-disclosure pattern:
- At most one primary action and 3-5 useful secondary actions per screen.
- Dashboard shows exceptions and priorities, not every record row.
- Tools catalog and command search make the long tail available without sidebar sprawl.
- Role-specific views: founder, dispatcher, salesperson, editor/creator, field technician, restricted viewer.
- Save views so Oscar and Jacob can pin individual dashboards (e.g., Oscar: executive + creative + cash; Jacob: dispatch + prospects + shoot queue); do not presume roles purely by name.
- Show global source/connection health and last refresh; never leave a misleading stale number visually indistinguishable from live.
- Aim for phone actions in 2-3 taps, desktop keyboard paths, measured against actual task completion, not vanity designs.
- Favor actionable tables, timelines, calendars and relevant detail views over generic metric card floods.

## 6. Concrete example daily executive journey

**7:30 AM / Oscar opens HQ:** Sees two due customer responses, a commercial bid awaiting approval, today's scheduled Exterior job, tomorrow's content shoot and two Solutions demos. Financial pulse shows *verified* collected funds if available and clearly labeled unknown cost coverage. One click opens each record with context.

**Jacob opens HQ:** His pinned operations view shows crew dispatch, a quote to finish, prospect assignments and two videos requiring him to film or edit. He records work and attaches files; Oscar sees auditable updates.

**During a field job:** Technician sees service instructions and authorized customer/property details, completes checklist and photos, flags incident or missing part; owner reviews closeout and records actual charges/costs and collection separately.

**During content production:** Oscar captures idea, Jacob assigns script, shoot receives equipment/locations checklist, video moves to review, publishing requires approval, released URL and actual analytics arrive with timestamps.

**Weekly founders' review:** HQ generates a source-linked brief (revenue coverage, cash information, expenses, pipeline, operational blockers, content production, goals, open decisions). Founders approve actions, assign owners and preserve decisions.

All example work items are hypothetical. Do not insert them as production facts.

## 7. Unified domain model proposal

Relational entities (names conceptual pending migration design):
- organizations, legal_entities, brands/ventures, business_memberships/capabilities
- parties (people/companies), addresses/properties, party_relationships
- opportunities/leads, accounts, projects/jobs, service_orders, content_projects
- tasks, checklists, assignments, capacity/schedules, approvals
- activities, messages, notification_events, comments
- quotes, contracts, invoices, payments, ledger_entries, cost_items, budgets, reimbursements
- products/orders/suppliers/fulfillment/returns
- assets, maintenance_logs, warranties, certificates, obligations, incident_reports
- content_items, episodes, shoots, creative_assets, edit_versions, publications, performance_snapshots, sponsorships
- documents/document_versions, SOPs, templates, knowledge_articles
- objectives/key_results, experiments, decisions, metric_definitions, metric_observations
- integration_connections, source_links, import_runs, automation_definitions, automation_runs, audit_events.

Not every table should be built at once. Normalize stable records; source-specific details in domain tables; prefer thin additive adapters around historical tables. Use organization ID and appropriate venture/record scope on all related rows. External IDs and idempotency keys prevent duplicates. Use event logs for history but don't attempt wholesale event-sourcing migration without proven need.

## 8. Integrations and digital infrastructure registry

Priority providers/source categories:
- Supabase: shared operational truth, membership and private object access.
- Exterior Care legacy lead system and existing SMS sender: verified source mapping, no parallel SMS.
- GoHighLevel: connected sales/calls/clients, read-only until approved scope changes.
- Shopify: products/orders/inventory, source-native status/fees, paging and scope constraints.
- Banking via available read-only connection: owner-controlled balances/transactions, never equivalent to invoiced revenue.
- Calendar: native tasks/events, feed sources, planned Google/Apple/Outlook sync with explicit duplicate handling.
- Google Business Profile / LSA and website: leads and advertising/source performance only through available authorized integrations.
- YouTube, TikTok, Instagram/Facebook, shared content storage: publication URLs, creator metrics and assets, subject to official API capability, rate limits and account permissions.
- Email, files, bookkeeping/payments, task automation: connect only when return on effort is clear.
- Local Windows app, Tailscale Funnel, GitHub CI and release health: surfaced as diagnostics, not arbitrary remote control.

Each connector contract must define: owner, scopes, source of truth, sync cadence, cache lifetime, last success, partial pagination coverage, error state, rate limit, cost, revoke workflow, retry/idempotency, and privacy requirements.

## 9. Trust, boundaries and real-world constraints

- Security advisors currently identified externally callable SECURITY DEFINER RPCs; investigate function logic, signature and grants, preserve intentional token flows, test anonymous and staff abuse cases.
- Protect API keys; never store passwords/credentials as ordinary notes. No private STRATHOS memory, agents or local files exposed through OJ Workspace by default.
- Mobile offline data handling requires explicit conflict/privacy design; don't promise always-on offline behavior.
- Banking, tax, employment, contracts, insurance and video/music rights have real compliance requirements; create checklists and evidence management, not unverified legal/accounting advice or automatic filing.
- The Windows/Tailscale host depends on PC availability and signed-in scheduled updater; plan recoverability/cloud migration when operational reliability justifies.
- Pre-release data/migrations backups with restore test; safe canary if available; logging with PII minimization.
- Prefer no subscriptions or expensive data APIs until the workflows are actually used. Central usage budgets and alerts for AI/API costs.
- Pause an automation without stopping the live app; every automation has a visible owner, scope, last run and source evidence.

## 10. Program backlog — first 20 specifically testable outcomes

1. Both founders see correctly scoped records and can change passwords/recover access without account deletion.
2. Main source/hosting/migration state is recorded and reproducible.
3. Four venture tabs load on desktop and phone without breaking historical views.
4. An Oscar Jacob task can be created, assigned, edited by Jacob and persisted.
5. An Oscar Jacob video/series can move from idea to approved published URL with an auditable activity history.
6. A global command search finds a real customer, task, file and video, respecting permissions.
7. Today's queue surfaces actionable tasks and routes to actual records with zero synthetic items.
8. A unified company calendar includes shootings, Exterior bookings, demos, approvals and due dates.
9. A source freshness warning shows a stale/disconnected integration instead of 0 or false 'live'.
10. Executive finance marks revenue and cost coverage as incomplete where applicable.
11. Exterior jobs show quote, booking, assignment, closeout and payment as distinct phases.
12. Commercial estimate drafts are visible to both founders with revision handling.
13. Employee access fails securely on other employees' restricted records.
14. Solutions prospect outreach activity is timestamped separately from original research date.
15. A draft message does not count as sent unless verified externally or user-confirmed with evidence.
16. Shopify order totals distinguish paid, test, canceled and refunded states.
17. Every tool directory item says whether it's native, connected, planned or unavailable.
18. Automation dry-run/approval/receipts behave predictably and don't duplicate side effects.
19. A failed release leaves the previous production app serving or surfaces an explicit operational alert.
20. A weekly review brief links all material figures to their actual source and explains missing coverage.

## 11. Product acceptance principles for all future tools
- A tool is accepted only if it solves a documented or defensible founder/team problem, has data ownership defined, passes permissions and audit tests, is accessible via universal launcher, and has a known source/maintenance cost.
- 'Accessible' does **not** mean all tools have active integrations or destructive control at all times; disabled, unconnected, not-yet-built and read-only states must be honest.
- Any use of AI or generated insights should state whether it is a computed result, retrieved source, human estimate, or model suggestion.
- All actual external effects (sending, purchasing, publishing, transfers, deployments, account admin) require a specific reviewed workflow and least-privileged authority.
- Preserve a compact, fast homepage that answers: **What matters? Who owns it? What happens next? What is the evidence?**

## 12. Roadmap governance
Treat this as a **capability atlas, not a promise to build every idea**. The product should accommodate every realistic OJ Holdings function, while shipping the most leveraged workflows first. Add modules modularly, based on evidence and use, and continuously update this atlas as the business grows.
