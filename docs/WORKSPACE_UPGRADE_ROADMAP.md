# OJ Workspace upgrade roadmap

Implementation roadmap for Oscar and Jacob. Audited 2026-10-19 UTC against main at a82477b. Product defaults inferred at Oscar's instruction.
Scope: product and implementation planning only. No operational records, permissions, messages, or runtime code changed during this pass.

## What the next version should accomplish

Make OJ the place where a piece of work can move from first contact through delivery and recorded payment without reconstructing its history across several lists. The interface should make the next useful action obvious for Oscar, Jacob, and Edy, while each receives the information their role permits.

Three product tests guide the plan:

1. Oscar or Jacob opens Today and immediately sees the work, decisions, customer follow-ups, and money requiring attention.
2. A prospect becomes a client, or an Exterior booking becomes a completed paid job, with the same linked history throughout.
3. Edy opens his phone, understands his assigned job, submits a useful closeout, and can explain every pending, approved, and paid earning.

Recommendations below are design proposals, not claims about actual business performance. The working decisions below set scope and order without requiring a discovery questionnaire.

## Working decisions

| Decision | Selected default | Basis |
|---|---|---|
| Biggest friction | Fragmented records, repeated navigation/data entry, and work that lacks a clear next step | Repeated requests for easy in-job assignment, daily outreach execution, integrated information and useful automation |
| Business priority | Solutions growth first, Exterior delivery/employee operations immediately after; maintain Essentials | Recent prospect-sheet work, client-service ambitions, and Edy's new job/commission workflow |
| Visual direction | Premium, distinctive OJ identity with practical information density | Preserve business branding, reduce repetitive banners/cards, make real work and actions prominent |
| Automation | Automate ingestion, queues, reminders, linked internal work, prepared files and evidence-backed summaries | Reduce input and produce useful work with existing records |
| Outreach | Drafts and manual activity logging first; reviewed in-app sending next; bounded automatic follow-ups later | Existing workflow sends externally; contact data, delivery verification and stop conditions need to exist before message automation |
| Jacob | Operational parity for OJ work: sales, scheduling, assignments, closeout review, commission approval and manual payout recording | OJ is operated together; avoid making Oscar the bottleneck for routine business work |
| Owner controls | Account administration, integration credentials, access grants, destructive administration and raw Mercury visibility remain owner-controlled initially | Extend daily operations without assuming a need to widen sensitive access |
| Devices | Founder desktop planning with phone access; phone-first field workflow for Edy | Existing PC workspace, phone requests and field-job use case |
| Software scope | Improve existing OJ surfaces and workflows; add separate portals only for genuinely separate audiences | Customer, employee and founder access differ; internal capabilities belong with the records they support |

Operational parity describes a capability-based role to implement and test, not a legal ownership change or an immediate permission change. Mercury remains owner-only for the initial roadmap; broader banking visibility is not a dependency for the other improvements.

The default source-of-truth split is: the spreadsheet supplies prospect research; OJ owns outreach activities, assignments, next actions, jobs/projects and review decisions; GoHighLevel supplies its connected customer/call records. Link these through stable IDs and explicit handoffs rather than overwriting one system with another.

## Evidence and limits

Browser inspection covered the production site's public preview: Home, Tasks, Exterior overview and Bookings, Solutions overview and Outreach, Finance, and Calendar. I inspected the actual navigation, filters, visible actions, and screen layouts at the available desktop viewport. Sample records were not treated as business evidence. No records were saved.

Source inspection covered the shared shell, business navigation, dashboard loading and search, outreach, GoHighLevel screens, employee documentation and assignment controls, finance and Mercury mapping, files, calendar, existing plans, and recent agent-log entries.

The owner session opened at /login. Authenticated founder and employee usage, real mobile devices, actual Mercury responses, and current real-record volumes still need verification. Existing screenshots and old plans are historical context; current source and current UI take precedence.

## Existing capabilities to extend

| Area | Already present | Main extension needed |
|---|---|---|
| Shared work | Five-stage task board, assignments, checklists, comments, dates, search, guarded drafts, revisions, work timer and leaderboard | Link work to customers, jobs, and projects; stronger list and personal views |
| Navigation | Shared rail, business identities, grouped business sections, global search | Faster direct access and complete search coverage; avoid duplicate destinations |
| Exterior Care | Leads, booking and rescheduling, job calendar, payments/cost fields, door knocking, quote requests | One job workspace linking assignment, field work, closeout, money, and customer history |
| Employee portal | Separate employee identities, assigned jobs, checklist/notes/photos, job-specific commissions, approval and manual payout ledger | Easier daily dispatch and review; phone-first closeout and earnings explanations |
| Solutions | Nightly sheet ingestion, prospect filters/statuses/drafts, GoHighLevel clients and calls | Daily execution queue, dated follow-ups, conversion to delivery projects, support |
| Finance | Hand-entered ledger, Exterior/Shopify reporting, source coverage, owner-only Mercury panel | Better payment/cost structure, bank matching and review, consistent period controls |
| Collaboration | Per-business messages, task activity, explicit working status | Persistent actionable inbox, contextual discussion, mobile notifications |
| Documents | Private uploads, tags, downloads and search | Attach documents to real work, preview/versioning, reusable templates |
| Calendar | Month view, upcoming list, job/task events, private phone subscription | Day/week agendas, worker capacity, opening overflowing days, unified schedule actions |
| Essentials | Shopify orders, products and inventory views | Priority-dependent exception workflows rather than another generic dashboard |

## Correctness and usability findings to address first

1. Solutions Outreach also renders GhlView because it matches the generic Solutions extra-tab condition. In preview this appends an unrelated GoHighLevel placeholder; in live it reaches the Calls fallback. Fix the section routing before adding more Solutions screens. Evidence: src/components/app/VentureView.tsx, the separate Outreach render and following GhlView condition.
2. Calendar displays only three items per day and renders the remaining count as a span. '+ more' cannot open a day agenda. Evidence: src/components/app/Pages.tsx, month-grid rendering.
3. Outreach's daily completion summary selects records by date_added, then checks their present status. Contacting an older prospect today is not represented as outreach performed today. Record channel activities with actual timestamps; distinguish cohort completion from daily activity. Evidence: src/components/app/OutreachView.tsx, queuedToday and doneToday.
4. Outreach preview dates use UTC while its day filter uses Central time. The inspected preview showed prospects dated the next day and a zero today cohort. Align business-day helpers and cover midnight boundaries.
5. 'Search anything' covers loaded tasks, generic workspace leads, documents, messages and events. It does not search Exterior customer/job records, imported outreach prospects, employee work, or GoHighLevel contacts. Expand authorized search deliberately and name its coverage accurately. Evidence: src/lib/workspace-search.ts.
6. The bell is a short task-activity feed. Its dot depends on activity existence, not unread state. It does not represent customer replies, Edy closeouts, commission reviews, import failures, or bank-review items. Evidence: src/components/app/Shell.tsx.
7. Business group selection can hide the currently active tab while leaving its content on screen. The Work/Customers counts describe numbers of sections, not outstanding work. Make selection and current location unambiguous. Evidence: src/components/app/BusinessNav.tsx and browser interaction.
8. Finance's blank month control means all entries, while the headline figures use the current month. Date scope should be explicit and consistent for figures, charts, and lists. Keep an intentional all-time option.
9. Global quick creation always creates a task, including in Finance and Files. Primary creation should follow the current job: log a payment, add a prospect, book a job, or upload a document.
10. Outreach loads a capped list once on entry, with local-only filters. Introduce disclosed result counts, pagination, saved URL views, and cross-user refresh before volume and daily collaboration grow.

These are planning findings. No runtime fixes were applied during this audit.

## Interface direction

Selected direction: a polished OJ workbench preserving navy, Exterior orange/green, Solutions copper, and Essentials cream. Keep existing local fonts unless a visual prototype demonstrates a reason to change them.

- Replace repeated oversized business banners with compact identity headers, a visible page title, and the main action for that screen.
- Put work lists, timelines and schedules above secondary charts. Use summary cards when comparing quantities helps a decision; avoid repeating the same card grid everywhere.
- Keep business colors as context and status colors as meaning. Orange business branding must not make every item appear urgent.
- Give tables consistent column alignment, readable dates, sticky headers where useful, row actions and expandable details. Use tabular numerals for money and quantities.
- Use a right-side detail panel on wide screens and a full-screen detail page on phones. Preserve URL, Back behavior, filters, scroll position and unsaved drafts.
- Keep useful motion tied to actions: opening a job, confirming a save, moving work, or showing a changed amount. Respect reduced motion and avoid persistent decorative activity.
- Reduce permanent chrome: keep team availability and timer reachable without reserving a separate full-width strip on every screen.
- Offer saved views and a few pinned destinations rather than a dashboard-builder settings system.
- Test outdoor readability and large touch controls in Edy's portal. A daylight-friendly field view may be more useful than forcing the owner's dark theme onto job sites.

Suggested shared navigation: Today; Businesses; Work; Calendar; Money; Inbox. Put Files, Reports, People and Settings in consistent secondary navigation, with pinned access where needed. Prototype this against current tasks before removing or moving any existing destination.

Within each business, lead with its actual operation:

- Exterior Care: Schedule, Jobs, Customers, Money, Team.
- Solutions: Outreach, Pipeline, Client projects, Support, Money.
- Essentials: Orders, Stock, Products, Money, if it remains an active priority.

Global views aggregate authorized records. Business views are filters into those same objects, not separately maintained copies.

## Today: a useful start to each working day

The first screen should answer what needs doing, what needs a decision, and what changed.

- My work and Team work: owned tasks, assigned follow-ups, today's jobs, demos and project milestones.
- Needs a decision: Edy closeouts, commission approval, unassigned bookings, conflicting times, customer replies needing an owner, and suggested bank matches.
- A day agenda combining real jobs, demos, events and due work, with visible duration and owner.
- Continue where you stopped: recently opened jobs, customers and projects; avoid losing context on every visit.
- New since your last visit: replies, completed work, changes by the other founder, and meaningful integration problems.
- A small business pulse using verified figures and drill-down links. A number without a useful next action belongs lower on the page.

Keep the leaderboard accessible. Decide whether it belongs on Home based on actual use; do not make task points the main measure of business progress.

## Record design: connect the work underneath the UI

Define stable links between customer/company, contact, property, opportunity, quote, job or project, task, event, file, payment, cost, assignment and earning. Keep existing source IDs and imported history.

Each detail screen should share a familiar structure: summary and next action; work/schedule; notes and files; financial facts allowed for the role; chronological activity.

Specific rules:

- A returning customer can have several properties, quotes and jobs. Do not merge away paid/completed historic jobs when creating the customer record.
- A task may reference a prospect, job or project. It should open the underlying work directly.
- Channel actions such as sending email are activities. Sales stages such as Qualified or Won describe the opportunity. Keep these separate.
- Job completion, customer payment, employee approval and employee payout are distinct states.
- Mark imported, manually entered, matched and inferred facts differently. Estimates retain their basis and cannot silently become confirmed records.
- Changes record who acted, when, what changed, and why where a reason is required. Sensitive data must not spill into general activity feeds.

Use additive migrations, source-ID mapping, dry-run counts and staged reconciliation. Do not rewrite the live legacy model in one destructive migration.

## Solutions: from daily prospects to delivered client work

### Outreach execution

- Default to My queue, Team queue, Follow-ups due, Replies, Demos and Unassigned.
- Compact list with business, service fit, owner, last contact, next action and due time. Expand research and drafts only when needed.
- Focus mode for one prospect at a time: evidence, contact methods, editable draft, copy action, recorded outcome and next step.
- Record email, DM, call and response activities with actual timestamps and actors. Manual 'sent' records must be visibly distinguished from verified provider delivery.
- Add follow-up date, conversation notes, outcome reason, contact preference and duplicate warning.
- Support assignment/reassignment and explicit ownership so Oscar and Jacob avoid simultaneous conflicting contact.
- Preserve sheet-source fields and app edits separately. Show last successful import, what changed, failed rows, and a safe retry. Retain records missing from a later sheet.
- Count activity today using actual activity events; keep added-today cohorts as a separate measure.
- Persist filters, sorting and the selected prospect in the URL. Introduce pagination and useful bulk actions.

The first release prepares and records outreach. Reviewed in-app sending follows after a business channel is connected. Automatic follow-ups come later with delivery evidence, response/opt-out stop conditions and explicit campaign rules; they are not necessary to make the first outreach release useful.

### Sales handoff and client delivery

- Turn a reply into an owned follow-up and a demo into a linked calendar event.
- On an explicitly recorded win, create one linked client/project, with a reviewable import from the prospect. Deduplicate retries.
- Project templates for an AI receptionist, website, and automation: discovery, scope, assets, configuration, testing, customer acceptance, launch and support.
- Show next milestone, accountable person, blocked input, promised date and evidence of completion.
- Receptionist acceptance checklist: agreed business hours, call routing, missed calls, escalation, booking behavior and client signoff.
- Store demo links, test results, proposals, scope revisions and deliverables with the project; protect credentials in integration storage.
- Separate setup payments, recurring fees and provider/usage costs. Show renewal dates, support work and unpaid amounts.
- Add a lightweight support queue linked to the client and delivery history.

GoHighLevel owns its connected customer/call facts; OJ owns project delivery, accountable next steps and review decisions. Preserve stable external links and source IDs, and introduce write-back only for an explicitly implemented handoff.

## Exterior Care: dispatch, field work and repeat customers

- Make the job detail screen the main workspace for service, property, schedule, scope, quote, crew assignment, checklist, photos, closeout and payment.
- Assign Edy and enter that job's commission in the job screen with one save; retain the current explicit-rate requirement and audit trail.
- Show unassigned jobs, waiting acknowledgments, schedule changes and submitted closeouts as useful queues.
- Add day and week dispatch views with worker availability, job duration, travel buffers and conflicts scoped to the assigned worker.
- Let overflow calendar days open an agenda; preserve the existing month view and private phone calendar subscription.
- Provide address/map links first. Route optimization and weather advice can follow if real usage justifies a provider and its cost.
- Use service-specific scope and checklist templates. Quotes can grow into line items, options and revision history when needed.
- Preserve separate scheduled, in-progress, completed, reviewed and paid facts. Support partial collection/deposits/refunds through payment records when this model is introduced.
- Closeout review puts notes, before/after photos, missed items, work time and recorded costs in one place. Request a correction without deleting the first submission.
- Customer/property history supports Book again, recurring maintenance, referral source, preferred contact and a proposed next service.
- Prepare printable/downloadable job briefs and completion reports from the existing records.

Quoting, invoices and customer-facing acceptance are candidate follow-on capabilities. Validate whether OJ should generate these or link to the tools already used.

## Edy's portal and employee operations

- My day: the next job, schedule changes, directions, job instructions and an obvious acknowledgment action.
- An upcoming list, job details, service checklist, before/after photo groups and completion notes designed for a phone.
- Draft protection and retry for a weak connection; clearly distinguish saved locally, uploading and submitted. Final submission must recheck session and assignment.
- Owner review with a correction request and a visible history of submissions.
- My earnings: estimated, awaiting approval, approved/unpaid and paid, with a job-linked explanation and owner-recorded adjustments.
- Keep the current immutable approved earning and reasoned adjustment model; improve its presentation rather than recalculate historic approved amounts.
- Track useful evidence: jobs assigned/completed, punctual acknowledgments where recorded, actual work time where logged, corrections and paid commissions. Avoid presenting missing data as poor performance.
- Provide a job-specific question channel. Never expose other workers, customer contact details, company totals or bank transactions through notifications/search.

Plan capability-based operating access so Jacob can assign jobs, review closeouts, approve commissions and record manual payouts. Preserve author/reason history and protect these operations with database tests. Employee financial transfers remain manual; the portal records them.

## Money: understand cash, performance and what needs attention

- Clear top-level scopes for Cash, Recorded performance, Money owed, Commissions and Review.
- Mercury account/date/search filters, more activity than the first displayed rows, transaction details, source status and a clear checked time.
- Bank-match suggestions based on amount, date and reference, with explicit owner review. Support one deposit for several jobs and avoid double-counting imported ledger entries.
- Keep transfers, owner contributions/draws, customer payments, refunds, operating costs and employee commissions distinct.
- Record collected date, payment method and supporting receipt when available. Preserve unknown historic dates.
- Attach costs and receipts to jobs/projects; separate labor, supplies, fuel, processing and provider charges where meaningful.
- Show missing cost coverage beside margin, and distinguish worker-hours from elapsed job duration.
- Introduce recurring software bills, upcoming commitments and a month-close review checklist.
- Use consistent date ranges and matched-period comparisons. Every chart total should open the exact supporting records.
- Export reviewed records for the accountant/bookkeeper. Tax calculations and bank-payment execution are separate, unapproved scope.

Mercury is currently owner-only. Sharing its data with Jacob or introducing additional organizations requires explicit permission design and organization-bound connection configuration.

## Collaboration, notifications and useful automation

Build a persistent inbox with unread state, owner, linked record, action, snooze and resolution. Start with job assignments/reschedules, replies/follow-ups, closeout reviews, commission decisions and integration failures.

Deliver mobile notifications only for subscribed event types, with quiet hours, digest options and deduplication. Keep sensitive job/pay/bank details off lock-screen previews by default. Verify browser/device support before promising a phone experience.

Add discussions and mentions to the actual job, project or task; retain general business notes for broader communication. Record-level files and a 'what changed since you visited' view should reuse the same permissions.

Automation should arrive in layers:

1. Reliable rules: due follow-ups, missing closeouts, overdue decisions, upcoming renewals, data-import failures and explicit next-action queues.
2. Prepared work: daily queue ordering with reasons, draft follow-ups/proposals, job briefs, project launch checklists, completion packets and weekly summaries linked to evidence.
3. Authorized internal execution: create linked tasks, produce files, populate templates and update agreed internal workflow fields under scoped rules and an audit log.
4. External execution only after its scope is agreed: reviewed in-app sending first, then bounded follow-up rules with stop conditions, delivery evidence, deduplication and failure handling.

AI can draft or explain. Payment/commission arithmetic, permissions, workflow transitions and duplicate prevention stay deterministic. An assistant's summary must distinguish a drafted message from an actually sent message and a suggestion from a completed action.

## Reports that support decisions

- Daily execution: new prospects, actual contacts, responses, follow-ups due and completed, demos and next steps, by owner and channel.
- Sales cohorts: conversion from source and service fit to response/demo/win, with the observation window and denominators visible.
- Exterior operations: booked, completed, collected, overdue payment, direct costs, worker-hours and margin with coverage.
- Solutions delivery: promised versus completed milestones, blocked projects, setup/recurring collections and provider costs.
- Team work: work time with its limits, work delivered, review backlog and outcomes. Keep the existing leaderboard optional and separate from business profitability.
- A weekly review that opens its source records, calls out missing inputs, and proposes a few accountable next actions. Avoid opaque confidence scores or invented forecasts.

Collect additional facts at the point they become useful: follow-up due after a contact attempt, work/cost notes at closeout, receipt at payment review. Avoid adding a pile of daily check-in forms.

## Essentials, client portal and other later options

Keep Essentials working while Solutions and Exterior receive the main upgrades. Its later improvements should prioritize actionable Shopify exceptions: unfulfilled orders, aging stock, stockouts, returns, supplier lead times and actual product margin where costs exist. Avoid duplicating Shopify administration without a demonstrated workflow advantage.

A client portal could later expose only that customer's approved quotes, scheduled work, requested inputs, deliverables and invoices. It needs its own access model and disclosure tests; it is not a workspace member role. Build it after the internal customer/job/project records work well.

Other optional extensions to evaluate against real demand: recurring service agreements, review/referral requests, proposal/PDF templates, business email integration, approved call-recording intake, inventory for field supplies, and customer self-booking with capacity rules.

## Engineering upgrades behind the experience

- Load page-specific records and authorized server search rather than repeatedly retrieving all dashboard and provider data for every screen.
- Separate shared-task updates from slow provider refreshes. A bank or store outage should have a clear local status rather than making the whole workspace feel unavailable.
- Define provider last-success, last-attempt, coverage, truncation and actionable error states. Never replace a live failure with sample data.
- Use stable source IDs, incremental sync where supported, retry/backoff and idempotent jobs. Keep one owner for each scheduler.
- Introduce an organization-scoped event/outbox model for reliable internal notifications; deduplicate retries and maintain a reviewable failed-job queue.
- Enforce field and record permissions on the server/database, including search, exports, files and notification payloads. UI hiding alone is insufficient.
- Add reliable test fixtures for founder, member/viewer and employee flows. Verify actual isolated test accounts before changing access in production.
- Consolidate recurring UI patterns: detail panels, forms, validation, field errors, filters, tables, empty/loading/failure states, undo and uploads.
- Profile actual loading and interaction behavior before setting performance targets. Add focused visibility into provider failures and sync outcomes without logging secrets or customer payloads.
- Keep a current capability matrix showing built, deployed, connected and verified. Reconcile obsolete statements in the older build plans during implementation.

## Proposed release sequence

| Release | Outcome | Main scope | Dependency / review gate |
|---|---|---|---|
| 0 - Baseline and correctness | Trust what the existing app shows | Authenticated read-only walkthrough, confirmed routing/calendar/count fixes, timezone and source-coverage review | Capture current workflows and isolated test cases; no redesign yet |
| 1 - Daily work and UI foundation | Fewer clicks to real work | Today, clearer navigation, contextual create, common record detail, list/mobile patterns, saved views, inbox foundation | Prototype against actual founder tasks; preserve all current routes/data |
| 2 - Solutions revenue workflow | Work prospects through handoff | Outreach activities and follow-ups, ownership, prospect detail, demo handoff, client/project templates | Implement the source-of-truth split; keep initial outreach in draft/manual-log mode |
| 3 - Exterior and Edy | Dispatch and close work in one flow | Job workspace, worker schedule, employee closeout/review, commission presentation, customer/property links | Test founder/employee isolation, photos, reschedules and historic earnings |
| 4 - Financial review | Explain cash and job/project money | Mercury browsing/matching, payment/cost detail, commission review, consistent reports and exports | Validate real bank responses and matched-record totals; approve any shared access |
| 5 - Automation and intelligence | Produce useful work reliably | Cross-workflow notifications, prepared files, internal rule execution, weekly review and provider recovery | Event reliability, evidence and audit; external actions limited to agreed scope |
| 6 - Expansion chosen by usage | Extend proven workflows | Essentials exceptions, client portal, recurring services, deeper integrations | Build only the parts supported by active business demand |

The default order is Solutions first, then Exterior and Edy. High-value job usability fixes can ship sooner without waiting for the full Solutions release. Notifications and useful small automations should accompany each workflow rather than wait for a final 'AI module.' Implementation should use small reviewable slices and the smallest helpful schema additions.

## Acceptance and rollout

- Walk through the same representative journeys before and after: process today's prospect; book and assign Edy with a specific commission; review a closeout; record collection; find the customer history; locate the supporting bank transaction; launch a Solutions project.
- Measure interactions and friction against the baseline, not an arbitrary claim of improved efficiency. A job assignment should be possible inside the job without visiting settings.
- Validate desktop and narrow phones, touch and keyboard, focus/Back behavior, draft preservation, long names, empty lists, slow connection, upload interruption and expired sessions.
- Test calendar overflow, Central business dates around midnight/clock changes, source limits, actual activity dates, partial payments, rounding and immutable approved earnings.
- Exercise permission boundaries through direct requests, not only visible UI: other employees, viewers, removed members, another organization, anonymous access, file URLs, search and exports.
- Run the existing behavioral/database suite, typecheck and production build for runtime changes. Use separate staging identities for role-sensitive changes.
- Release one connected workflow at a time, with migration backup/rollback, feature availability controls where useful, monitored imports and a documented recovery path.
- Do not claim owner/employee/mobile/provider verification from the public preview. Mark each remaining live check explicitly.

## First implementation release

The first release should improve existing daily use before introducing new business modules:

1. Correct the duplicate Outreach/Calls rendering and business-date inconsistencies. Keep added-today cohorts separate from actual outreach performed today.
2. Make calendar overflow open a complete day agenda, with direct links to its jobs, tasks and events.
3. Clarify business navigation so the active page is always identifiable and section counts cannot be mistaken for work counts.
4. Give Home a compact Today view: owned work, today's schedule, items needing a decision, and useful links back into the source records. Put secondary performance panels and the leaderboard below work.
5. Make primary actions contextual. Start with prospect work and booking/job actions; keep existing routes usable.
6. Build one outreach detail experience with preserved filters and next/previous navigation, then introduce dated contact activities and follow-ups as the next additive slice.

Acceptance examples:

- Oscar records contacting an older prospect today; today's activity increases, while its original import date remains intact.
- Jacob opens the daily prospect queue and sees ownership and the next action without expanding every research card.
- A day with more than three calendar items opens a complete agenda through the overflow control.
- A founder opens a booked job and reaches its assignment/commission action without a Settings detour.
- Phone and keyboard users can complete these paths, return to their prior list position, and recover unsaved input.

Unknown facts should be resolved through focused source/live-use inspection during the relevant release: current quote/invoice/payment tools, service-specific delivery steps, real field constraints, device notification support and source completeness. These unknowns do not block the initial correctness and UI work. Preserve current authentication, scope and data protection while testing the actual founder and employee journeys.
