# ATLAS 02 — Complete UI Redesign / Screen-by-Screen Experience

> Design specification, **not implemented UI**. Replaces standalone “look at everything” pages with contextual entity intelligence. See [master](./ATLAS_V3_MASTER_INDEX.md).

## 0. Design ambition

The first impression should be: **“This company has its own enterprise-grade command center.”** ATLAS is a premium custom instrument, not a boilerplate SaaS admin template, military shooter HUD, or decorative dark-mode mockup.

**Design vocabulary:** Imperial Graphite × Precision Instrumentation × Contemporary Aerospace × Studio Craft.
- **Canvas:** deep blue-black / graphite; unobtrusive fine grid at large widths; restrained border hierarchy. Light mode is fully designed, not reversed/inverted afterthought.
- **Accent system:** holding-company mineral green / steel; Exterior Care vivid warm orange with restrained vegetation green; Solutions copper and electric blue; Essentials champagne/cream with dark ink; Oscar Jacob indigo/violet cinematic black.
- **Typography:** modern display grotesk for section names, clear humanist sans for body text, tabular numerals and monospace for timestamps/revisions/amounts. Long lists optimized for legibility.
- **Elevation:** 3 planes—foundation, panels, active focused surface; avoid dozens of nested card boundaries.
- **Motion:** purposeful 120–240 ms easing, physically understandable panel transitions; true live status only with verified polling; reduced-motion equivalent.
- **Visual data:** mini sparklines, capacity stacks, timeline bands, stage funnels, evidence ticks, no chart without known metric source and denominator.
- **Access:** high-contrast information, 44px touch targets when practical, meaningful screen-reader summaries, tab/focus logic, accessible error states, WCAG AA targets.
- **Brand:** unique ATLAS visual language, not copying another product's pixel layout, proprietary illustrations, logos or trade dress.

## 1. Global layout system

### Desktop 1440–2560
- Left **compact adaptive rail**: 72px collapsed / 232px expanded, company insignia and 7–9 pinned domains, business switcher. At most 8 prominent links.
- Top **command bar**: route breadcrumbs, connected entity search, contextual 'Create', current founder/session, source freshness, unseen decision count and quick switch.
- Main **12-column content canvas** with 24px / 32px gutters and one explicit reading hierarchy.
- Optional **context dock** at right 280–380px: evidence, associated customer/project, notes, suggestions and recent changes; collapses to slide-over.
- Large-display **ATLAS WALL** mode for an office monitor: live verified queue, schedule, fleet readiness and targets—not exposed PII on a public screen.
- Universal page skeleton: eyebrow / title / trustworthy subtitle; 1 strong hero panel; primary work surface; subordinate analytics; source states + next actions.

### Laptop 1024–1440
- Rail collapses; context dock becomes modal/drawer; charts adapt without horizontally scrolling the entire app; tables use priority columns and row expansion.

### iPhone 360–430
- Bottom nav: Today, Jobs, Create, Inbox, More.
- One-handed task completion, offline-draft indicator, capture camera/location only with consent and clear device permission.
- Desktop tables become dense swipeable structured cards; sticky primary action; photos/measurements/scope entry has large fields.
- Fleet departure checklist, survey and dispatch are genuine phone-first workflows, not shrunk desktop.
- No irreversible swipe action without confirmation/undo policy.
- Stable network failure states, optimistic drafts with conflict signaling, saved-at timestamp and upload progress.

### Tablet / field laptop
- Split-screen estimate/camera/asset capture and map; keyboard accelerators where available.

## 2. Shared component inventory

Core: ATLAS Shell, Command Header, Search/Quick Switch, business-chip, status taxonomy, entity faceplate, timeline, source receipt, relation drawer, decision packet, permission curtain, KPI with coverage, responsive data grid, query/filter builder, dependency timeline, activity diff, asset card, annotated map layer, inspection checklist, document preview, price tuner, upload queue, pending sync badge, stop/pause control, audit receipt.

Every shared component has documented states: **loading / populated / no recorded data / not connected / partial / access denied / stale / conflicting / error / offline draft / action in review**. A zero represents verified measured zero only.

Use tokens for colors, density, radius, focus-ring, type scale, motion and breakpoints. Build a Storybook-like test gallery in future implementation, but do not use elaborate design tooling merely to avoid writing tests.

## 3. Every existing tab — before → ATLAS design

### 3.1 COMMAND / HOME → "ATLAS HQ"
**Above fold:** giant **TODAY'S MISSION** with 3 priority directives, four-venture pulse strip, founder handoff, next appointment, account source freshness. Premium angular linework and status illumination, but no theatrical fake telemetry.
**Middle:** **Decision Queue** + **Today + 7 days** (dispatch, demo, shoot, order) + **Finance Truth** (collected/owed/recorded/cost-unknown) + **What's changed** attributable digest.
**Lower:** Goals/initiatives, systems alerts, scenario comparison and custom widgets. Quick-click reveals related record dock. Modes Today / Ops / Growth / Treasury / Strategy live inside Command, not in main rail.
**Redesign acceptance:** can answer next action, owner, why, last change and business impact without leaving HQ.

### 3.2 BUSINESSES INDEX → "VENTURE SELECTOR"
Four differentiated panoramic branded doors, each with real operating status, top risk, work due, last customer action and privileged CTA. Oscar Jacob reads clearly “Preview / persistence blocked” until schema ready. Business tiles show *unknown* provider states explicitly. Supports inter-business switcher anywhere without losing customer record history.

### 3.3 TASKS / BOARD → "WORK INTELLIGENCE"
One source-aware task/project system: List / Kanban / Timeline / My Work / Approvals / Workload. Relation chips for customer, property, bid, order, campaign, equipment and evidence. The task detail is a gorgeous focused editor with description, due, assignee, subtasks, dependencies, source link, discussion, revision diff, actual activity and permissible actions. Drag-and-drop is undoable with conflict protection.
Special: **Mission Queue** ranks overdue, blocked, awaiting founder decision and near-term dependencies. No phantom “AI complete” button.

### 3.4 CALENDAR → "CHRONOS / UNIFIED SCHEDULE"
Month, week, day, agenda, multi-resource Gantt, Exterior crew/vehicle lane, Solutions demo lane, creative shoot lane, supplier/delivery lane. Colored by genuine business/record type, separate due-date reminder vs booked appointment. Map/drive previews use grounded addresses. Reschedule proposals reveal conflicts and notify only after founder approval. Phone calendar subscription links are scoped and revocable.
**Dependency:** booking IDs, timezones, availability/resource capacity and existing PR #17 need review, not overlapping implementation.

### 3.5 CRM / PIPELINE → "RELATIONSHIP COMMAND"
Single contact/account/property profile with activity timeline, companies/people, matched identifiers, opportunities, quotes, communications, assigned founder, project, bookings, invoices and post-service lifecycle. Multiple vertical pipelines without confusing Shopify customers with GHL prospects or Exterior customers. Contact duplicate review with merge receipts (no automatic merge).
Views: Pipeline / Accounts / Contacts / Geographic opportunities / Reviews / Repeat clients / Overdue follow-ups. Contextual action drawer creates approved call/task/estimate/note.

### 3.6 FINANCE → "TREASURY / MONEY CONTROL"
Four business summary columns + consolidated evidence, not an invented “profit” number. True states: quote / contract / invoice / payment intent / settled deposit / refund / fee / paid expense / direct cost / payroll obligation. A large Sankey or flow only if actual source basis is established.
Views: Cash & reconciliation; AR/AP; job/product/project contribution; budget allocation; pricing; subscription vault; reimbursement/distributions; accountant export; tax prep. Transaction trace click-through and evidence attachment.
A stunning **capital allocation table** compares a truck rig versus LSA spend versus staffing using bounded what-if assumptions, confidence, liquidity requirements and payback ranges.

### 3.7 FILES → "COMPANY VAULT"
Projects/documents categorized with version history, OCR where legally useful, signed evidence, contracts, COIs, service SOPs, receipts, estimates, media and warranties. Fast filters by associated entity rather than folder-only navigation. Annotate PDF/photo, review, retention rules, malware scanning, secure direct downloads with access receipt. Sensitive tax/bank documents require extra ACLs.
**No copying customer secrets into open GitHub repos.**

### 3.8 MESSAGES → "FOUNDER COMMS"
Not a full WhatsApp clone. Contextual internal conversation threads tied to tasks/quotes/jobs/projects, targeted @mentions, file attachments, bookmarks, action extraction proposals, unread/delivery state only if known. Company announcement and decisions live in same permission-aware interaction dock; preserve existing messages/history.
No spurious “live unread” notifications if polling is stale.

### 3.9 ANALYTICS → "INTELLIGENCE & PROOF"
Business KPI atlas with definitions and metric owners. Funnel, cohorts, capacity, conversion, rebooking, ad efficiency, client retention, refund/CAC, production output. Every chart defaults to **source / as-of / sample size / coverage / caveats** and links to underlying records. Comparisons distinguish identical weekday windows from full periods.
Views: HQ scorecard; Exterior production; Solutions growth; Essentials economics; Content performance; Source quality; Experiments; Forecast Lab; Custom report builder. No fabricated live telemetry or predictions.

### 3.10 TEAM → "PEOPLE, RESPONSIBILITY & CAPACITY"
Founders, roles, access matrix, assignments, capability/skill profile, employee onboarding/checklists, work sessions, crew schedule, attendance approval, training and payout *records*. Permissions are visible before inviting. Founder collaboration signals show recorded activity, not guessed real-world whereabouts. Temporary contractor access and revocation are first-class.

### 3.11 SETTINGS → "CONTROL & TRUST"
Company identity, account, two-factor enrollment/recovery, authorized integrations, audit, founder preferences, subscriptions, data retention, payment/account access scopes, backup receipts, app version, change log, import/export. **System Health** becomes part of Control, not an empty new corporate tab. Danger Zone with two-step confirmation, isolated admin controls and rollback evidence.

### 3.12 TOOLS HUB → "LAB / CAPABILITY DRAWER"
A purposeful hidden depth. Searchable authorized subtools categorized by Operate/Grow/Finance/Create/Control, with status: live, preview, connected external, requires permission, planned, unavailable. Favorites, purpose, evidence, owner, docs and change history. Replace oversized “on the roadmap” card grids with curated actionable collections.
REA/OSS research workspace lives in a private engineering section, never runs unknown binaries unattended.

### 3.13 FLEET COMMAND → "FLEET OPERATIONS CENTER"
**Showpiece redesign.** Full-page vehicle/rig inventory, cinematic Explorer/truck silhouette, interactive clickable equipment topology, tank/capacity panels, payload boundaries, service intervals, faults, location only when explicitly recorded/authorized, field readiness and inspection history.
- Left: fleet asset tree / active service tickets / upcoming maintenance.
- Center: asset canvas (schematic/2.5D/optional 3D) with actual component ID anchors, tank volumes and line routing; never present guessed dimensions as engineering truth.
- Right: dispatch availability, rig manifest, fault severity, real work order / procurement links.
- Bottom: maintenance history, parts replacement, supplier lead time, projected utilization and fuel/ownership-cost scenarios.
- Special **Rig Builder Lab** with pump GPM, hose/injector compatibility, reel mount, water and SH weights, axle/load calculations and warning states. Use actual vehicle sticker/GVWR/payload/axle info and tank manufacturer ratings; do not certify road legality from an estimate.
- **Departure Checklist** ties asset readiness to a scheduled job; overdue maintenance creates a task draft after owner confirmation. Mobile pretrip has photo capture and inspection receipt.
- Existing browser-local fleet data requires privacy-preserving export/merge migration before production sync.

### 3.14 COMMERCIAL DESK → "BID WAR ROOM / PROPERTY ATLAS"
**Second showpiece redesign.** Portfolio of actual prospective commercial properties; site survey split into building list + map/grounded imagery + access and hazard notes + calculation panel. Cost model with labor, mobilization, lifts, materials, travel, glass type, access/height and overhead assumptions.
- Multiple bid strategies (target, competitive, protected), per-building economics, stress mode and scenario comparison.
- Evidence-based inspection checklist, confidence and unknowns that block ready-to-send proposals.
- Quote version diff, founder review packet, approved customer-facing proposal templates, renewal/service cadence, conversion evidence, planned crew/fleet needs.
- Drafts vs sent vs accepted vs booked vs invoiced vs paid must be different states.
- QR/site checklist and phone camera field audit; do not auto-send or sign.
- Preserve existing local estimator and file transfer. Shared multi-user bids require backed-up schema.

### 3.15 OJ EXTERIOR CARE BUSINESS ROOM → "FIELD COMMAND"
Overview: service zones, incoming lead response, commercial opportunities, seven-day dispatch, equipment readiness, next review request. Tabs: Pipeline; Residential Estimator; Bid War Room; Bookings/Dispatch; Field; Crew; Fleet & Supplies; Jobs & QA; AR/Costs; Service Plans; Marketing/LSA; Intelligence.
Daily hero: actual jobs, crew and equipment confirmed, water/chemical requirements, weather-risk link when authorized and fresh, travel schedule without invented ETAs.
At customer open: lifetime sales and past services only where record-linked; no unmatched duplicates. Lead-to-payment timeline is the centerpiece.

### 3.16 OJ SOLUTIONS BUSINESS ROOM → "CLIENT NETWORK"
Overview: prospect research, real outreach sent/replied counts, meetings and demos, active client onboarding, at-risk integrations, support quality, earned recurring revenue state. Tabs: Prospecting; Sequences/Drafts; Demos; Proposals; Projects/Onboarding; Agent Operations; Call Quality; Support; Retainers/Renewals; Revenue; Growth Experiments.
**Agency Control Tower:** per-client status, integrations, AI receptionist tests, business-hours/handoff QA, failure signals, escalation workflows and changes with approvals. GHL remains source authority where applicable; no fictional call analytics.
**Live demo studio:** controlled synthetic demonstration assets, easy personalized demo evidence and consent-based contact.

### 3.17 OJ ESSENTIALS BUSINESS ROOM → "COMMERCE CONTROL"
Overview: genuine order states, fulfillment exceptions, gross vs net receipts, cost coverage, contribution margin, stock risk and ad experiments.
Tabs: Catalog/SKUs; Inventory; Supplier Lab; Orders; Shipping; Returns/Disputes; Pricing; Ads/Creative; Attribution; Profit; Product Research; Customer Service.
**Product Flight Deck** shows SKU picture, supplier, landed-cost components, Shopify fees, refunds, shipping, ad allocation, return rate and evidenced margin; missing cost components shown as unknown. Variant test and reorder alerts require owner approval.
Do not misstate an order total as deposited cash.

### 3.18 OSCAR JACOB BUSINESS ROOM → "STUDIO CONTROL"
Full cinematic media-production app within ATLAS, not a black-and-violet copy of Exterior.
Views: Idea Vault / Script Editor / Storyboard & Shot List / Shoot Schedule / Talent & Locations / Media Library / Edit Versions / Review/Approval / Publishing Calendar / Channel Analytics / Sponsorships / Studio Costs / Production Gear.
Hero timeline: idea → approved production → filming → edit → review → manually published receipt.
**Review Theatre:** versioned video reference, timestamped comments, compare cuts, rights/music licensing flag, thumbnail A/B planning, status badge and explicit publishing authority. No fake YouTube views.
Until the safe migration, it remains fictional preview/read-only—no real persistence claims.

## 4. Redesigned shared workflows rather than extra tabs

- **Customer mini-drawer** appears wherever a name appears and links to real project, schedule, documents and finance.
- **Deal ribbon** appears in CRM, Bid War Room, task dialog and Finance with same canonical opportunity stage.
- **Asset ribbon** appears in Fleet, Dispatch, field checklist, procurement and job profitability.
- **Decision packet** appears in Founder HQ, Quotes, Finance, Content publishing and Automation approvals.
- **Evidence/unknown component** appears in any chart, value or recommendation, with source click-through.
- **Change digest** appears in HQ and company messages without requiring users to visit an integration dashboard.

## 5. Hero design concepts with acceptance rules

| Concept | Visual wow factor | Must be operationally real |
| --- | --- | --- |
| Fleet 2.5D cutaway rig | Layered truck/rig view, animated water path | Actual linked pump/reel/asset and entered specs; warnings carry uncertainty |
| Corporate strategy “war table” | High-density scenario and dependency board | Founder-entered assumptions, linked real tasks/financial evidence |
| Property Atlas | Building outlines/grounded property detail board | Authorized address/map data, human scope measurements and confidence |
| Operations time ribbon | Stunning unified schedule across businesses | Actual appointments/jobs/shoots/orders, no invented positions or drive times |
| Source relationship radial drawer | Related customer/quote/job/fleet/invoice connected nodes | Exact verified IDs/joins and access control; no fuzzy claims |
| Founder duet handoff | Two-person ownership and shared context | Based on actual assignments/revisions, not surveillance |
| Executive change playback | Cinematic but precise record revision timeline | Source audit events, visibility, retention and rollback permissions |

## 6. Visual implementation acceptance

- First meaningful content target p75 on representative midrange phone and desktop is set by measurement during implementation, not promised as a number now.
- Animations pause when app is hidden and respect OS reduced motion; no constant expensive WebGL rendering on mobile.
- All charts show units and report coverage; operational maps identify any stale or estimated position.
- Empty-state calls to action have real working destinations; no dead buttons or “coming soon” masquerading as live.
- The transition is **design-system first** and **incremental by shell + workflow**, not a dangerous one-shot rewrite of login/Auth/workspace.
- Cross-device consistency, screen-reader operations, keyboard shortcuts and role-based visibility are release gates.
