# ATLAS 01 — Product Doctrine, HQ and Executive Operating Model

> Concept spec only · OJ Workspace V3 · 2026-10-22 · Refer to [master](./ATLAS_V3_MASTER_INDEX.md).

## 1. Positioning

**ATLAS = the interface through which OJ Holdings actually operates.**
Four vertical businesses, two founders, one identity/work/financial reality. It combines the confidence of a professional ERP, immediacy of a field-service dispatch center, visual density of a financial terminal, ease of a modern CRM, and atmosphere of an advanced operations room, without simply copying any vendor's brand or interface.

**Experience pillars**:
- **Omniscient where data exists, humble where it doesn't.** The system tells the truth about freshness, gaps, source, confidence and next action.
- **Beautiful at work, not just as a concept render.** Dense, responsive, fast and usable with 177+ historical leads and tens of thousands of future records.
- **Two-person precision.** One founder can triage sales while the other runs a Milwaukee site survey; shared context, change receipts and handoff should be immediate.
- **Zoom from holding company to one screw on the truck.** Company goals -> venture -> opportunity -> job -> crew -> equipment -> part -> maintenance entry -> procurement request.
- **Default control, not runaway autonomy.** AI may find, explain, draft and simulate; no unattended action until a founder enables and scopes it.

## 2. Personas, authority, devices

| Persona | Principal moment | Default surface | Hard boundary |
| --- | --- | --- | --- |
| Oscar / founder | Strategic command, quoting, financial review, vehicle/equipment, growth | Dense desktop HQ; personal phone command | Cannot silently cause another founder's credentials or private financial access to change |
| Jacob / founder | Client follow-ups, Milwaukee commercial surveys, dispatch, Solutions, field delivery | HQ, Mobile Ops, bid workbench | Founder parity on authorized operational records; clear revision/conflict behavior |
| Exterior crew | Assigned job details, route, gear, photos, work/time | Mobile Field Ops | No company-wide personal data or finance beyond explicit permissions |
| Solutions operator | Prospects, demos, service incidents, deliverables | Pipeline and client room | No bulk outreach without approval; client data scoped |
| Content collaborator | Scripts, shot list, uploads, review | Media Studio | Assets/rights/source authorization; no autonomous posting |
| Accountant/advisor | Ledger review, reconciliations, exports | Finance / restricted review | No implicit approvals, payment capability or cross-org exposure |
| Viewer/client | Scoped project or proof/estimate | Client portal | No leakage of other clients, pricing, staff or internal notes |

Role-by-resource capability matrix, founder agreement boundaries, person-level private information and approval policies must be explicitly configured and tested. “Owner” is not a blanket reason to bypass RLS or audit.

## 3. Permanent navigation: keep it clean

**Rail / bottom-nav structure (not 35 top-level tabs):**

1. **Command** — ATLAS HQ / My Mission / Decision Queue.
2. **Businesses** — Exterior Care, Solutions, Essentials, Oscar Jacob; each gets its own immersive operating room.
3. **Pipeline** — canonical People & Organizations, Opportunities, Projects, customer history, sales and relationships.
4. **Operations** — board/project work, Dispatch, Schedule, Field, tasks and assignments. This is the practical work area, **not** the old redundant “Connected Operations” lookup tab.
5. **Finance** — cash states, obligations, income, margin, invoicing, vendors, distributions, budget and procurement.
6. **Intelligence** — actual analytics, forecasts/scenarios, market intelligence, data-quality/verification.
7. **Library** — files, manuals, contracts, templates, SOPs, training, brand/media assets.
8. **Tools** — secondary capability registry, authorized integrations, experimental labs and custom workflows.
9. **Control** — people/permissions, automation registry, connectors, audit, release status, backups, settings.

Fixed rail shows a selected 5–8 destinations; deeper areas are sub-navigation, pinned quick actions, contextual chips and command palette. The permanent rail must not grow a separate entry for every new module. Role-specific mobile bottom-nav: **Today / Jobs / Create / Inbox / More**; founders can customize.

**Record navigation rule:** no dedicated “all the links in one tab.” Wherever a customer, property, task, equipment item or invoice appears, click opens a consistent **entity cockpit** with related records, status, source provenance, timeline and next action. The relationship graph lives in the platform layer, invisible until needed.

## 4. Executive HQ — five operating modes in one screen

The top-level Command screen supports **modes**, not unrelated applications:

### A. TODAY / MISSION CONTROL (default)
- Location-neutral company clock in America/Chicago and user context; company/source/release freshness with warnings.
- Hero strip: **Next mission**, **What changed since last visit**, **Decision requiring attention**.
- One actionable 7-day mission stack: overdue client commitment, unapproved bid, scheduled job readiness, demo follow-up, missing collected-payment evidence, customer review opportunity, due maintenance.
- Four business vitality panels with one trusted metric, one alert, one action; no vague score without explanation.
- Mini founder collaboration lane: Oscar's owned work, Jacob's owned work, assigned-to-me, awaiting-owner, handoffs, blocked work, review queue. Activity-based presence only and clearly labeled.
- **Decision inbox**: bid review, job closeout, invoice approval, expense reimbursement, client message draft, purchase request, posting schedule—each with provenance, financial exposure and a required human decision.
- 7-day calendar/route/project strip; pin today's important commercial quote or site survey.
- Known financial pulse (separate recorded revenue, receivables, collected funds, known costs and unverified amounts).
- Search and universal quick-create that preserve the active account/venture/project context.

### B. OPERATIONS / WAR ROOM
- Multi-business timeboard: field jobs, support, e-commerce fulfillment, content shoots, deadlines and crew coverage.
- Exception queues grouped by impact; backlogs, aging, incomplete prerequisites, at-risk dates.
- Resource capacity: hours, qualified crew, vehicles, rigs, supplier lead time, project milestone dependencies.
- Escalation lanes with owners and evidence; **no imaginary “real-time live crew position.”**
- Dispatch preview map, click-to-context; missing geocodes must remain unresolved rather than map to a guessed address.

### C. MONEY / CORPORATE TREASURY
- Structured money states, forecast and actual separation.
- Cash accounts only if authorized bank connection and appropriate permission.
- Today/7/30 day receivables and payable commitments; payment follow-up approvals.
- Margin coverage, profitability by unit, subscriptions and recurring operating expense tracker, estimated-versus-actual comparisons.
- Founder reimbursement and distribution proposals (not an automated transfer feature).
- Scenario slider for reinvestment in truck rig, LSA budget, staffing or software.

### D. GROWTH / REVENUE ENGINE
- Cross-business funnel metrics with denominator + source + stage semantics.
- Exterior LSA inquiries, leads quoted, wins, repeat service; Solutions genuine outbound attempts/response/demo/client; Essentials paid/refunded orders, CAC/ROAS if attributable; Content recorded views/engagement/sponsor pipeline.
- Hypotheses and launch experiments with owner, budget, stop condition, evidence.
- Regional opportunity board, commercial property pursuit, agency demonstration pipeline.
- “Find next 10 quality opportunities” is a **research task**, not permission to scrape or spam.

### E. STRATEGY / COMMAND TABLE
- Rolling goals/OKRs, initiatives, ownership, milestones, forecast ranges and dependency maps.
- Roadmap health, capital-allocation options, hiring/vehicle purchases and enterprise risk matrix.
- Evidence-backed “what changed,” board-style weekly review and decision history.
- Long-term vision is compelling but subordinate to actual today work.

Switching modes changes the framing of **the same sources**, not which database stores data.

## 5. The everyday two-founder rhythm

**Morning: 3-minute founder command.**
1. Open TODAY; see company date, source freshness, what changed.
2. Confirm today's due service/demos/orders/shoots, outstanding customer commitments.
3. Reassign at most a few priority tasks with attributable receipts.
4. Review near-term money/crew/equipment risks and leave explicit notes.

**During day: zero context rebuilding.**
- Customer calls: search contact; see complete related opportunity/job history, outstanding invoice and next action.
- On site: open job on phone; view scoped instructions, rig readiness, property notes, photo/evidence checklist; start approved time log.
- Commercial walk: capture building scope, access, floor count, lifts and estimates as inspection evidence; offline draft only where confidence/state is explicit.
- Solutions: prospect/demos/client service quality and draft outbound in context.
- Ecommerce: refund/fulfillment/source order context, no phantom profit.
- Media: approve current edit version, don't expose rough cut to public.

**Evening: handoff and shutdown.**
- Change digest of what Oscar and Jacob each did.
- Close out completed service tasks, but don't imply invoice was paid.
- Generate tomorrow's agenda from existing commitments and sources.
- Review AI suggestions rather than allowing silent customer contact.

**Weekly: board-level review.**
- Last-week vs equivalent-weekday and completed-week comparisons with clean denominators.
- Decisions made, promises missed, lead response rates, margin evidence, staffing/rig spend and next initiatives.
- Produces a signed internal meeting receipt if both founders approve; action items require explicit assignment.

## 6. Universal entity cockpit standard

Every entity detail view uses **header + truth strip + multi-domain tabs + right-hand contextual dock**.

Header: name, ID, business, lifecycle stage, owner, last human change, last source sync, permission label and pinned action.

Truth strip: what is verified; what is entered; what is estimated; what is missing. Financial summaries cannot fill gaps with zeros.

Subviews: **Overview / Timeline / Tasks / People / Files / Money / Calendar / Operations / Relations / Audit**. Hide irrelevant tabs by entity kind; keep URL deep links stable.

Contextual dock: next action, blocker, linked objects, recent comments, calls/messages if authorized, incident/approval status, quick draft templates and scroll-to-evidence.

An operator should never need to open an arbitrary "Connected Operations" directory to discover the task attached to a customer.

## 7. Four venture operating rooms

- **Exterior Care: FIELD COMMAND**: geographic dispatch, 7-day job manifest, commercial bid exposure, production metrics, fleet readiness, crew, checklists, water/chemicals, equipment service and actual job costs.
- **Solutions: CLIENT NETWORK**: prospect sequences, funnel, demo scheduling, client account map, receptionist/agent uptime, call quality, onboarding, support, renewals and provable MRR receipts.
- **Essentials: COMMERCE CONTROL**: products/SKUs, storefront, order queue, refunds/returns, landed cost/fees, ad spend, inventory, product tests and contribution profit confidence.
- **Oscar Jacob: STUDIO CONTROL**: creative pipeline, cinematic shot boards, asset review, publishing calendar, equipment/rights, branded partnerships and actual audience-source analytics.

Each room has **Overview, Pipeline, Production, Finance, Assets, Intelligence, Documents** as appropriate; deep per-vertical tabs are purposeful, not simply identical copies.

## 8. Signature interactions

- **Command-K** (and mobile search) searches tasks, customers, properties, jobs, contracts, calls, creatives, equipment, dates and explicit commands with permission-aware result ranks and no PII in public suggestions.
- **Quick Switch** company / venture / person / active project, preserving search context.
- **Split-view cross-references**: click a job and view the customer, bid, asset and invoice side-by-side without losing current place.
- **Time travel / Revision lens**: before/after changes, person/time/source; immutable receipt where required.
- **Workspace Spaces**: custom saved filters/boards/rooms for Founder HQ, Milwaukee survey day, weekend dispatch or Solutions deal sprint; permission scoped.
- **Ambient mission signals**: slow pulse for actual due/high-priority, clear badge for stale source. Never create fake live telemetry.
- **Work from one object**: every alert/action points to the authoritative record.
- **Command Deck widgets** are layout configurable by founders with preset restores, keyboard navigation, zoom and TV display mode.

## 9. What not to build

Do not build ornamental military-themed “weapons,” fake AI statuses, empty KPI theater, speculative revenue claims, duplicate customer databases, an entire second messaging service, 3D maps with invented route metrics, unlimited-autonomy sales spam, an expensive microservice zoo, or one more top-level menu for every clever feature. Creative UI must pay rent in faster real operations.

## 10. Acceptance

- Both founders complete morning coordination, a commercial quote review, a booking handoff, a maintenance flag and evening summary without copying an identifier manually.
- Returning to HQ preserves layout and shows only changes actually observed.
- All financial and third-party provider summaries expose source, date basis, completeness and permission.
- Any meaningful action has draft/confirm/result/failure/audit state. Viewer/employee restrictions are verified, not inferred.
- OJ Workspace still works on small iPhones, slow connections, keyboard-only desktop and after temporary provider failure.
