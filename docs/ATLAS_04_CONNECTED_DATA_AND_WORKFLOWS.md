# ATLAS 04 — Connected Data Architecture, Events & End-to-End Workflows

> **Architecture proposal; no migration is authorized by this document.** Production Supabase Free is a P0 risk until verified logical backups and independently tested restore. Draft PR #42 remains isolated. See [master](./ATLAS_V3_MASTER_INDEX.md).

## 1. Solve the real problem: one business object, multiple departments

An operating system is not a series of unrelated tabs. Every object has a canonical identity, controlled lifecycles and defined relationships; its data appears inside all authorized consumer screens.

ATLAS's common object model:

\`\`\`text
ORGANIZATION / legal entity (verified facts)
  |-- VENTURE / brand / operating segment
  |-- USER / MEMBERSHIP / capability / role
  |-- CONTACT ---- works_for ---> ACCOUNT / COMPANY
  |                 |
  |             PROPERTY / service site
  |                 |
  |             OPPORTUNITY / DEAL
  |                 |
  |          ESTIMATE version ----> APPROVAL / proposal
  |                 |                     |
  |                 +------> PROJECT / JOB / ENGAGEMENT
  |                                   |-- TASK / CHECKLIST / OWNER
  |                                   |-- SCHEDULE / DISPATCH / CREW
  |                                   |-- ASSET assignment / FLEET readiness
  |                                   |-- FILE / photos / evidence
  |                                   |-- TIME / COST / PROCUREMENT
  |                                   |-- INVOICE / receivable / payment evidence
  |                                   +-- ACTIVITY / change receipts
  |-- PRODUCT SKU ----> ORDER ----> FULFILLMENT / RETURN / PAYMENT
  |-- MEDIA PROJECT --> ASSET / REVIEW --> PUBLICATION RECEIPT / SPONSOR
  |-- CLIENT SERVICE --> CONFIG / DEPLOY / QA --> SLA / RENEWAL
  +-- SOURCE MAPPING / EVENT OUTBOX / AUDIT / METRIC DEFINITIONS
\`\`\`

**Important:** the same person can relate to Exterior and Solutions, but record authorization still depends on organization membership, venture visibility, client/project grants, and field-level sensitivity. Sharing an identity does not authorize sharing every financial/client detail.

## 2. Canonical entity contracts

| Entity | Critical identity and fields | Owned by | Cross-domain consumers |
| --- | --- | --- | --- |
| Organization/LegalEntity | verified registered identity, effective dates, ownership boundary | Control/Governance | finance, contracts, security |
| Venture | stable ID, brand, operating state, organization parent | Organization | all rooms and reporting |
| Person/Company | organization-scoped UUID, names, contact methods, consent, customer types | CRM | sales, jobs, billing, sponsor, client support |
| Property/Site | stable address ID, geo precision, building/access conditions and owners | CRM/Field | estimates, fleet/dispatch, photos, invoices |
| Opportunity | customer+venture, source/stage, owner, creation/last activity, outcome | CRM/Sales | HQ, estimates, forecasts, schedule |
| Estimate/Revision | opportunity/site, scope, assumptions, confidence, draft/sent/accepted state | Estimating | sales, billing, dispatch, files, review |
| Project/WorkOrder | canonical parent, venture, lifecycle, schedule, deliverables and SLA | Operations | HQ, tasks, fleet, finance |
| Task/Assignment | work order/opportunity links, owner, stage, due, revision | Operations | founder review, mobile, calendar |
| Booking/CalendarEvent | source ID, interval/timezone, resources, confirmed status | Scheduling | staff, field, HQ |
| Asset/Vehicle/Part | immutable ID, serial, specs, owner/custody, service and safety states | Fleet/Procurement | jobs, cost, dispatch |
| Invoice/Line/Payment | issued, due, provider external IDs, settlement/refund states | Treasury | project, CRM, analytics |
| LedgerEntry | basis, event, account, cost center, receipt, reconciliation status | Treasury | finance, projects, metrics |
| Supplier/ProductSKU | stable supplier refs, costs with effective dates, verified SKU mapping | Commerce/Procurement | orders, maintenance, inventory |
| Order/Fulfillment | platform order ID, payment and fulfillment transitions, line quantities | Commerce | finance, warehouse, customer |
| MediaAsset/Production | owner, rights, checksum/version, approval, publication URL | Studio | contracts, reporting, calendar |
| IntegrationMapping | provider + external_type + external_id + org scope -> local ID | Integration service | all external imports |
| Activity/AuditReceipt | subject, actor, before/after, recorded_at, source, authorization | Platform | HQ, debug, compliance |
| ApprovalPacket | intended action/target/diff, approver, expiry, decision, receipt | Governance | invoices, purchases, messages, publish, automation |

### Source identity invariants
- Internal IDs are opaque UUIDs or rigorously validated legacy keys, scoped by organization; never join entities by *display names*, phone numbers or fuzzy similarity alone.
- External source key is \`(organization, provider, source_type, external_id)\` with unique constraint, last seen, checksum, sync watermark, provider cursor and raw payload hash (sensitive raw payload retained only when lawful and needed).
- A record can be **local-authoritative**, **provider-authoritative**, **derived** or **proposal-only**. “Source of truth” is selected per field and action, not guessed once per integration.
- Relationship proposals by fuzzy match are reviewable separate candidate rows; only a human-confirmed entity link becomes canonical.
- Every row with financial semantics carries currency, type of amount, event date/time, verification state and coverage denominator.
- Old Exterior IDs remain recognizable and tied to historic records. No silent rekey or drop.
- Entity deletion follows tombstone/retention policy and audit, not cascading surprise loss.

## 3. Model states and transitions explicitly

### Exterior service lifecycle
\`\`\`text
INQUIRY -> QUALIFIED -> SURVEYED -> ESTIMATE_DRAFT -> IN_REVIEW
 -> PROPOSAL_SENT -> CUSTOMER_ACCEPTED -> SCHEDULED
 -> READY -> DISPATCHED -> IN_PROGRESS -> QA_PENDING -> FULFILLED
 -> INVOICED -> (PARTIALLY_PAID | SETTLED | OVERDUE | DISPUTED)
 -> RETENTION / REBOOK / WARRANTY
\`\`\`

Record transitions must be supported by correct evidence:
- \`CUSTOMER_ACCEPTED\` needs signature/confirmation or tracked customer acceptance evidence, **not** an internal founder review.
- \`READY\` requires crew/vehicle/asset/resource checks; it is not a payment state.
- \`FULFILLED\` means closeout accepted, **not** paid.
- \`SETTLED\` requires payment-provider/bank or acknowledged externally verified collection receipt; a recorded manual amount remains **unverified manual** until corroborated.
- Refunds, disputes, cancellations, partial completions, change orders and redo visits are independent exceptions—not silently rewritten totals.

### Solutions lifecycle
\`\`\`text
IMPORTED -> RESEARCHED -> CONTACTABLE -> DRAFT_READY -> SEND_APPROVED
 -> SENT_RECEIPT -> RESPONSE -> DEMO -> PROPOSAL -> CONTRACTED
 -> ONBOARDING -> QA_VERIFIED -> IN_SERVICE -> RENEWAL
 -> PAUSED / INCIDENT / CHURNED
\`\`\`
A GHL imported prospect is never implicitly sent. Signed setup pricing, contract MRR and actual cash collection are distinct.

### Essentials lifecycle
\`\`\`text
SAMPLE -> TESTED -> ACTIVE_SKU -> INVENTORY_AVAILABLE
 -> ORDER_CREATED -> PAYMENT_AUTHORIZED/CAPTURED
 -> FULFILLMENT_PENDING -> SHIPPED -> DELIVERED
 -> RETURN_REQUESTED / REFUNDED / DISPUTED
 -> SETTLEMENT_RECONCILED
\`\`\`
Profit only when fee/COGS/shipping/ad/returns coverage is sufficient for a clearly scoped period or order.

### Oscar Jacob lifecycle
\`\`\`text
IDEA -> APPROVED_PROJECT -> SCRIPT -> PREPRODUCTION -> SHOOT
 -> EDIT_V1..N -> REVIEW -> READY_TO_PUBLISH
 -> PUBLISHED_WITH_URL_RECEIPT -> PERFORMANCE_OBSERVED
\`\`\`
A draft URL is not a published video; editing “approved” is not actual platform upload.

## 4. Shared command contract

Every cross-module action is a typed, authorized, recorded transaction:

\`\`\`text
request(action, actor, organization, venture, targetId, expectedRevision, payload)
  -> permission + policy
  -> data/source preconditions
  -> simulation/diff
  -> required approvals? (human prompt or durable packet)
  -> commit in local authoritative transaction
  -> immutable audit/activity record
  -> optional idempotent outbox for provider action
  -> asynchronous attempt + result receipt
  -> source reconciliation and UI update
\`\`\`

**UI labels must distinguish** Draft / Scheduled / Requested / Approved / Sent / Acknowledged / Failed / Retried / Reconciled. Buttons never show “Done” when only a message was queued.

Example: "Create a preparation task from a booking" requires an authorized active booking, preserves source IDs and company, allows the founder to review, and commits via existing task server actions; the presence of a link does not prove booking was paid. This partially exists in Integration Pass 02, but is not a substitute for a persistent FK.

## 5. Platform layers

\`\`\`text
Presentation: ATLAS Shell / Entity Cockpit / Business Rooms / Field App
Domain services: CRM, Operations, Estimates, Dispatch, Fleet, Treasury,
                 Commerce, Solutions Client Ops, Media, Control
Shared kernel: Organization/Auth/Permissions, Contact/Account Identity,
               Relations, Events/Audit, Money Types, Approvals,
               Documents, Notifications, Search, Source Quality
Adapters: Existing Exterior source, Supabase, GHL, Shopify,
          consented Calendar, Stripe/processor if configured, analytics,
          approved finance sources, webhooks/CSV imports
Execution: Transaction + outbox, durable jobs, retry/dead-letter,
           rate limits, release guard and observability
Infrastructure: Next.js/TypeScript, PostgreSQL/Supabase RLS, protected storage,
                approved deployment host, encrypted backup/restores
\`\`\`

Keep a **modular monolith** until actual throughput/reliability demands separated services. Premature microservices would multiply deployment and security problems for a two-founder team. Domain modules can have dedicated APIs/interfaces while sharing one permission and transaction kernel.

## 6. Privacy and access-control architecture

- **RLS and server checks:** every read/write filtered by actual authenticated organization/role, permitted venture, project assignment and record sensitivity. Service-role credentials never in browser.
- **Sensitive categories:** personal contact details, employee/contractor info, contracts, tax documents, payout/bank information, client call audio, imported marketing data, media rights. Use field-level redaction when needed.
- **Client portal:** explicit grants to one customer/project; never share generic org buckets/URLs.
- **Founder permissions:** both founders can collaborate where authorized, but financial account access, external communications, payroll, HR and production changes require explicit privileges. Legal ownership agreement, not software assumptions, decides authority.
- **Audit:** append-only sensitive action receipt with actor, time, intent, target, source and result; correlation to provider ID and reconciliation event; make emergency account lock/revoke auditable.
- **AI:** separate model tool scopes, bounded retrieval, no prompt-injection privilege elevation, human approval, minimal data transfer and provider retention notice.
- **Files:** private object storage, pre-signed scoped URLs, checksum, virus scanning and retention policy.

## 7. Provider integration rules

| Source | What can be authoritative | Known risk | Required contract |
| --- | --- | --- | --- |
| Existing Exterior DB | Historic leads/bookings/job records | Incomplete cost/revenue fields, legacy statuses | Non-destructive mapping; preserve original IDs |
| GoHighLevel | Contacts, conversations, opportunities, call data where authorized | Pagination, stale data, imported≠contacted | Webhook + cursor sync with source confidence |
| Shopify | Orders, products, inventory/fulfillment events | Order gross ≠ payout, fees/COGS/ad absent | Idempotent orders, refunds, payouts, cost ledger |
| Calendar | Meetings and source events | Duplicate reminders, timezone DST | Event UID/source hash, durable changes and revocation |
| Bank/payment connector | Specific authorized account transactions/settlement | Banking permissions, delayed payouts | Explicit consent, read-only first, reconcile with statements |
| Google/Meta ads | Paid campaign spend and impressions when authorized | Tracking limitations and data access | Spend/attribution definitions, no silent ROAS |
| Media platforms | Published content metrics and URLs where authorized | Retention/API costs, quotas, public vs private | Actual URL/ID, collection timestamp, view/retention coverage |

No actor may declare a provider "connected" solely because an API key exists; probe the necessary scope and a bounded read. Source coverage reports cursor, records seen, total if supplied, partial/errors and last successful sync.

## 8. Local-first to shared-data migration

V2 contains valuable browser-local Fleet and Commercial drafts. Migration must preserve both founders' independent histories:

1. Inventory local schema versions and record sizes; export private backup from each device with checksum and sensitive-data warning.
2. Propose stable server-side entity names and aliases; migration dry-run with duplicate report.
3. Prove real Supabase backup/restore and isolated RLS tests, run additive schema migration with explicit rollback plan, *then* enable server-backed persistence.
4. Device-by-device import with user review: distinguish new, identical, edited, conflicting and invalid items. No silent last-write-wins.
5. Dual-read/limited transition with sync confidence and rollback flag until both founders confirm, then deprecate local-only primary writes.
6. Retain original exports until restoration and new shared records are reconciled; never upload private archives to GitHub.

## 9. Financial correctness and quality gates

Every displayed monetary aggregation defines:
- value_basis: **quoted / contracted / invoiced / authorized / captured / settled / paid / refunded / recorded-only / estimated / unknown**
- currency, org + venture + cost center, source and period basis
- count and denominator, fees/direct costs coverage, pending/duplicate/partial statuses
- last sync, evidence/receipt, audit and source deep link.

**Never infer profit by subtraction when material costs are unknown.** Show observed subcomponent and "profit unknown/partial" with coverage. Example: 20 orders, 14 have known landed costs -> contribution cannot be universal for all 20.

## 10. Event and workflow integrity

- Prefer append-only domain events for material state transitions, plus projections for fast views.
- All outbound provider mutations use an outbox with idempotency key, actor and approval receipt, explicit retry/backoff, and a dead-letter queue.
- Webhook signatures validated at ingestion; external IDs and event versions deduplicate replays; timestamps don't imply global ordering.
- Concurrency: expected revision + database transaction; conflict resolution UI preserves both founder drafts.
- Eventual-consistency badges for copied provider data: \`pending sync\`, \`observed at\`, \`reconciled\`, \`failed\`.
- Network and provider failure: core internal task work remains operable where authorized; outbound states don't magically advance.

## 11. Index/search architecture

Permission-aware universal search facets by type, venture, person, customer, job, property, asset, date, status and source. Search returns only authorized records, with lifecycle/context. Store "current context" in URL or stable state; never leak restricted record names by autocomplete, log or screenshot mode.

**Deprecated standalone graph page:** Existing Connected Operations index is a useful transitional proof but should become the underlying relation/source projection. Remove its permanent rail and homepage promo **only after** contextual drawers, CRM profile, Fleet/Dispatch links, Command search and founder task handoffs offer equivalent or better paths. Redirect old URLs and test all deep links.

## 12. Explicit safety gates for implementation

### Gate G0 — observe and preserve
- Record exact production SHA, current table/migration state and role coverage. No migration.
- Backup using secure private pg_dump utility; restore to isolated environment with row counts, basic reads and permission tests.
- Document current auth, role, asset and billing sources; verify offsite storage and recovery key access.

### Gate G1 — additive schema
- One reviewed migration PR, SQL lint, staged RLS tests and rollback/runbook.
- Never run through unattended Windows code-only deploy; apply with supervised separate authorization and actual backup/restore receipt.
- Prove old three-venture records and both founder identities still work; shadow reads before write cutover.

### Gate G2 — interconnected release
- Migrate one full chain (contact → opportunity → estimate → work order → booked job → dispatch readiness → invoice state) with dual-founder E2E.
- All stages and unknowns represented; source history intact.
- Test unauthorized employee/client/outsider access, replay, stale edits and provider outage.

### Gate G3 — financial and outward action
- Reconcile account/source coverage before financial assertions; get policy review for payroll/distribution/tax semantics.
- Per-action approvals and audit, duplicate-safe outbox, pause/stop/incident rehearsal.
- No mass email/SMS, bank transfers, customer-facing publishing or paid advertising until deliberately approved and monitored.

## 13. Platform architecture success criteria

- One canonical ID links the relevant customer to approved estimate, work order, assigned rig/crew, checked photos, actual service and invoice without duplicated re-entry.
- Every derived metric has source, coverage, value basis and time range.
- Replaying webhook or import does not duplicate a paid order, lead, task or message.
- Two concurrent founders cannot silently overwrite each other's work.
- A read-only employee cannot inspect founder HR/bank data by direct URL or API.
- Full production restore rehearsed, not merely a local backup file existing.
- The app continues showing honest data during a source outage and can explain what is unknown.
