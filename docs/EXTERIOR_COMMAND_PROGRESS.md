# Exterior Command — implementation ledger and measured scope

> **2026-10-23.** Product plan: `ATLAS_Exterior_Command_Master_Plan_2026-10-23.md` (user-reviewed external master planning artifact). This score is a founder-facing **engineering estimate**, not a timer or an assertion of real-device acceptance. Recheck merged commit, CI and exact live Windows SHA before marking anything deployed.

## Definition of 100%

A redesign is complete when the 12 master-plan waves are implemented, production-safe, validated on real founder devices, and accepted as part of one connected Exterior operating system. Shipping a beautiful screen does not equal a complete customer/dispatch/accounting application. Existing standalone tools and legacy records are preserved but do **not** automatically count as redesigned/connected workflow acceptance.

| Plan wave | Weight | R27 estimate earned | Not yet done |
|---|---:|---:|---|
| W1 Experience foundation | 8% | **5%** | Founder-specific saved density/layout, final mobile field QA, cross-route visual parity |
| W2 Real Command | 10% | **3%** | Verified real founder acceptance, full shift readiness, integrated decision receipts, true collection data |
| W3 Customer 360 | 14% | **3%** | R27 exact-lead dossier and booking/history links shipped; canonical identity/property, dedup approval, source receipts and contact lifecycle still need shared persistence |
| W4 Quote & booking | 12% | 0% | Approval versioning, conflict-safe quote → job handoff |
| W5 Field operations | 12% | 0% | Offline field sheet, jobs, labor, media, materials and issue capture |
| W6 Commercial Project 360 | 10% | 0% | Unified shared property, estimate, approval and job project |
| W7 Equipment integration | 8% | 0% | Durable rig/asset linkage to job readiness |
| W8 Financial closure | 9% | 0% | Source-verified invoices, costs, AR and bank reconciliation after database gates |
| W9 Deep intelligence | 7% | 0% | Verified attribution, geo, recurring-service, unit economics |
| W10 Local Data Hub and Capture | 5% | 0% | Encrypted archive, sync, durable chat input approvals |
| W11 Automation assist | 3% | 0% | Owner-approved bounded workflows, pause/stop, receipts |
| W12 Adoption / independent review | 2% | 0% | Two-founder test record, accessibility audits, independent Astra review |
| **TOTAL** | **100%** | **11% (conditional on R27 merge CI)** | |

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

### Release gates and the next update rule

R26 earned **8%** when its PR and main CI completed successfully; separate Windows serving SHA and founder-device acceptance are still missing. Count R27's incremental **3 percentage points** only after its exact-head CI (typecheck, tests and production build) passes and its PR is merged. If R27 fails, keep the verified total at **8%**.

For **every future Exterior Command development response** report: (a) estimated overall completion %, (b) specific earned plan waves, (c) merged PR / CI state, (d) next blocker and immediate implementation slice. Do not increase completion for documentation-only or redundant tooling.

### Next prioritized implementation

1. Complete R27 acceptance: run source-bound end-to-end on founder iPhones and verify live serving SHA; conduct keyboard/screenreader and mobile longitudinal inspections.
2. Build the canonical customer/property identity review layer and evidence-backed estimate/booking transitions (W3 and W4), with explicit manual choice when multiple lead IDs might represent the same person/site.
3. Reuse loaded Exterior data across customer and booking routes instead of a fresh complete source download for each navigation; preserve RLS and freshness/partial-source states.
4. Safely enable durable schema only after a real private backup + isolated restore + RLS role tests. Add source-linked invoices and payment collection only with receipts.
