# Exterior Command — implementation ledger and measured scope

> **2026-10-23.** Product plan: `ATLAS_Exterior_Command_Master_Plan_2026-10-23.md` (user-reviewed external master planning artifact). This score is a founder-facing **engineering estimate**, not a timer or an assertion of real-device acceptance. Recheck merged commit, CI and exact live Windows SHA before marking anything deployed.

## Definition of 100%

A redesign is complete when the 12 master-plan waves are implemented, production-safe, validated on real founder devices, and accepted as part of one connected Exterior operating system. Shipping a beautiful screen does not equal a complete customer/dispatch/accounting application. Existing standalone tools and legacy records are preserved but do **not** automatically count as redesigned/connected workflow acceptance.

| Plan wave | Weight | R28 estimate earned | Not yet done |
|---|---:|---:|---|
| W1 Experience foundation | 8% | **5%** | Founder-specific saved density/layout, final mobile field QA, cross-route visual parity |
| W2 Real Command | 10% | **3%** | Verified real founder acceptance, full shift readiness, integrated decision receipts, true collection data |
| W3 Customer 360 | 14% | **5%** | R27 exact-lead dossier + R28 website intake candidate review and prefilled drafts; canonical contact/property, approved durable source links and full customer journey not yet complete |
| W4 Quote & booking | 12% | **1%** | R28 website request-to-lead draft workflow; quote versioning, approvals, duplicate-safe intake disposition and conflict-safe estimate → booked-job handoff not yet built |
| W5 Field operations | 12% | 0% | Offline field sheet, jobs, labor, media, materials and issue capture |
| W6 Commercial Project 360 | 10% | 0% | Unified shared property, estimate, approval and job project |
| W7 Equipment integration | 8% | 0% | Durable rig/asset linkage to job readiness |
| W8 Financial closure | 9% | 0% | Source-verified invoices, costs, AR and bank reconciliation after database gates |
| W9 Deep intelligence | 7% | 0% | Verified attribution, geo, recurring-service, unit economics |
| W10 Local Data Hub and Capture | 5% | 0% | Encrypted archive, sync, durable chat input approvals |
| W11 Automation assist | 3% | 0% | Owner-approved bounded workflows, pause/stop, receipts |
| W12 Adoption / independent review | 2% | 0% | Two-founder test record, accessibility audits, independent Astra review |
| **TOTAL** | **100%** | **14% (conditional on R28 exact-head CI + merge)** | |

### R26 actual scope

- New source-driven Exterior Command homepage (not generic venture KPI + generic task board).
- Native five-destination Exterior navigation with legacy tool directory; existing URLs still open working workflows.
- Four source-labeled KPI instruments: recorded completed-job revenue, upcoming confirmed quoted work, open prebook pipeline quotes, matched-cost subset contribution.
- Upcoming booked job timeline, task/lead decision queue, six-month real job revenue chart with unknown buckets, historic acquisition-source counts.
- Data completeness, bank/payment caveats and preview-vs-live fail-closed behavior.
- New dark industrial Exterior styling, reveal/bar motion, focus states, reduced-motion paths, responsive mobile composition.
- Unit tests for money-state separation, source coverage, historical null values, non-Exterior task scope, valid business dates.
- No migration, storage writes, communication sends, LSA spend claim, crew/asset assignment claim or bank reconciliation.

### R27 exact-source Customer 360 (3 percentage points within W3, upon successful CI and merge)

- Customer 360 dossier opens directly from Command booking links, existing customer cards and booking workbench, always keyed by an unchanged Exterior lead ID.
- Displays existing customer contact, source, site/address, scope, notes, status, historical lead-level quote, job revenue and known contribution with clear non-settlement qualifications.
- Shows only bookings carrying this exact `lead_id`, including their existing confirmed/pending/cancelled statuses; missing data remains unknown. Historic job completion timestamps identify source vs estimated date.
- Reuses actual existing session-bound secured customer editing, new service booking and completed-job money-entry dialogs; no duplicate CRUD endpoint or copied customer database.
- Possible lead and website request overlaps are explicitly *candidates* from exact normalized phone/address; no automatic merge or unapproved outbound activity. Booking picker no longer silently hides distinct lead IDs with the same phone.
- Adds a responsive premium property/operations timeline, source provenance, financial instruments, identity review and evidence gaps, with reduced-motion support and source-truth tests.
- Still no canonical property IDs, invoice/payment settlement, communication receipts, file uploads, automatic capture, sync/offline writes or legal accounting system. Full W3 is not done.

### R28 Website Intake Command (+2 points W3 and +1 point W4, conditional on merge)

- Replaces the website request raw table (both legacy /quotes and new /intake aliases) with a searchable, operational two-panel intake command.
- Original quote_requests source data includes incoming name, phone, email, property, service, description, recurring interest and received date, without pretending the submission contains an approved quote, booking or payment.
- Pure source review detects **unverified** US-phone/long-address matches to loaded Exterior leads. Existing exact-ID Customer 360 dossiers are one click away. Creation of an additional lead when matches exist requires explicit "distinct lead" review acknowledgement.
- "Review pre-filled lead" opens the existing authorized LeadDialog with copied website facts, source='website', quote_amount=null and readable original request ID/context in notes (not a real foreign key). Operator must submit the existing guarded saveLead form; read-only users cannot write.
- New HQ and customer workbench launchers; deep link `/b/exterior/intake?request=<id>` opens **only** the original exact source request or an explicit unavailable state.
- Responsive industrial design and reduced-motion/focus behavior; tests prove no automatic identity matching, payment guesses, or manufactured processed status.
- Important: quote_requests has no disposition/processed status in the loaded source, no durable request-to-lead FK and may be capped at latest 1,000. This release makes review/use faster but **does not** claim completed real-time LSA intake, idempotent conversions, or a complete booking/estimate ledger.

### Release gates and the next update rule

R26 (8%) and R27 (+3%) earned a total **11%** after exact PR-head and merged-main CI. R28 contributes only **3 additional points** (W3 2, W4 1) after exact-head CI succeeds and PR merges. GitHub CI/merge verifies repository code only; Windows-served SHA and founder iPhone acceptance are separate required checks. Preserve 11% if R28 does not pass.

For **every future Exterior Command development response** report: (a) estimated overall completion %, (b) specific earned plan waves, (c) merged PR / CI state, (d) next blocker and immediate implementation slice. Do not increase completion for documentation-only or redundant tooling.

### Next prioritized implementation

1. Complete request-to-lead durable source mapping with idempotency, user-approved merges and verified backup+restore / RLS before any production migration.
2. Build structured quote revisions, itemized scope, customer acceptance evidence, and the explicit quote → work order → booking lifecycle (W4).
3. Refactor repeated `loadExterior` full-source reads into one authenticated shared cache with bounded invalidation and source coverage.
4. Add field time/expenses/material capture and offline write queue with encrypted local recovery after source-of-truth and permission design.
5. Founder mobile/browser UAT; no claim of Windows port 3011 running merged SHA until deployment receipt.
