# Exterior Command — implementation ledger and measured scope

> **2026-10-23.** Product plan: `ATLAS_Exterior_Command_Master_Plan_2026-10-23.md` (user-reviewed external master planning artifact). This score is a founder-facing **engineering estimate**, not a timer or an assertion of real-device acceptance. Recheck merged commit, CI and exact live Windows SHA before marking anything deployed.

## Definition of 100%

A redesign is complete when the 12 master-plan waves are implemented, production-safe, validated on real founder devices, and accepted as part of one connected Exterior operating system. Shipping a beautiful screen does not equal a complete customer/dispatch/accounting application. Existing standalone tools and legacy records are preserved but do **not** automatically count as redesigned/connected workflow acceptance.

| Plan wave | Weight | R26 estimate earned | Not yet done |
|---|---:|---:|---|
| W1 Experience foundation | 8% | **5%** | Founder-specific saved density/layout, final mobile field QA, cross-route visual parity |
| W2 Real Command | 10% | **3%** | Verified real founder acceptance, full shift readiness, integrated decision receipts, true collection data |
| W3 Customer 360 | 14% | 0% | Canonical contact/property/source crosswalk and customer journey |
| W4 Quote & booking | 12% | 0% | Approval versioning, conflict-safe quote → job handoff |
| W5 Field operations | 12% | 0% | Offline field sheet, jobs, labor, media, materials and issue capture |
| W6 Commercial Project 360 | 10% | 0% | Unified shared property, estimate, approval and job project |
| W7 Equipment integration | 8% | 0% | Durable rig/asset linkage to job readiness |
| W8 Financial closure | 9% | 0% | Source-verified invoices, costs, AR and bank reconciliation after database gates |
| W9 Deep intelligence | 7% | 0% | Verified attribution, geo, recurring-service, unit economics |
| W10 Local Data Hub and Capture | 5% | 0% | Encrypted archive, sync, durable chat input approvals |
| W11 Automation assist | 3% | 0% | Owner-approved bounded workflows, pause/stop, receipts |
| W12 Adoption / independent review | 2% | 0% | Two-founder test record, accessibility audits, independent Astra review |
| **TOTAL** | **100%** | **8% (conditional on R26 merge CI)** | |

### R26 actual scope

- New source-driven Exterior Command homepage (not generic venture KPI + generic task board).
- Native five-destination Exterior navigation with legacy tool directory; existing URLs still open working workflows.
- Four source-labeled KPI instruments: recorded completed-job revenue, upcoming confirmed quoted work, open prebook pipeline quotes, matched-cost subset contribution.
- Upcoming booked job timeline, task/lead decision queue, six-month real job revenue chart with unknown buckets, historic acquisition-source counts.
- Data completeness, bank/payment caveats and preview-vs-live fail-closed behavior.
- New dark industrial Exterior styling, reveal/bar motion, focus states, reduced-motion paths, responsive mobile composition.
- Unit tests for money-state separation, source coverage, historical null values, non-Exterior task scope, valid business dates.
- No migration, storage writes, communication sends, LSA spend claim, crew/asset assignment claim or bank reconciliation.

### Release gates and the next update rule

Only count the projected **8%** once the R26 pull request head passes typecheck, unit tests and production build and is merged. R26 does not count actual deployment until the Windows port 3011 serving SHA is independently confirmed; mobile usability remains founder acceptance. If CI fails, the status remains below 8% until corrected.

For **every future Exterior Command development response** report: (a) estimated overall completion %, (b) specific earned plan waves, (c) merged PR / CI state, (d) next blocker and immediate implementation slice. Do not increase completion for documentation-only or redundant tooling.

### Next prioritized implementation

1. Finish W1: mobile founder UAT, keyboard/screenreader/evidence states, saved founder view preferences, fold contextual deep tools under natural work context.
2. Finish W2: verify a consistent operation-first founder surface across customer/bookings/company metrics without parallel data fetching; lazy-load subordinate panels; actionable next-commitment queue with acknowledged receipts and source context.
3. Then W3: canonical customer/property view, contact/LSA/source mapping and explicit duplicate candidate review. Database schema stays blocked until backup + independent restore + RLS permission verification.
