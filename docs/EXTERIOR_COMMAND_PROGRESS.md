# Exterior Command — implementation ledger and measured scope

> **2026-10-23.** Product plan: `ATLAS_Exterior_Command_Master_Plan_2026-10-23.md` (user-reviewed external master planning artifact). This score is a founder-facing **engineering estimate**, not a timer or an assertion of real-device acceptance. Recheck merged commit, CI and exact live Windows SHA before marking anything deployed.

## Definition of 100%

A redesign is complete when the 12 master-plan waves are implemented, production-safe, validated on real founder devices, and accepted as part of one connected Exterior operating system. Shipping a beautiful screen does not equal a complete customer/dispatch/accounting application. Existing standalone tools and legacy records are preserved but do **not** automatically count as redesigned/connected workflow acceptance.

| Plan wave | Weight | R30 estimate earned | Not yet done |
|---|---:|---:|---|
| W1 Experience foundation | 8% | **5%** | Founder-specific saved density/layout, final mobile field QA, cross-route visual parity |
| W2 Real Command | 10% | **3%** | Verified real founder acceptance, full shift readiness, integrated decision receipts, true collection data |
| W3 Customer 360 | 14% | **5%** | R27 exact-lead dossier + R28 website intake candidate review and prefilled drafts; canonical contact/property, approved durable source links and full customer journey not yet complete |
| W4 Quote & booking | 12% | **6%** | R28 intake + R29 line-item estimating + R30 validated private export/import and source/approval/booking preflight; actual durable shared revisions, evidence-backed acceptance and atomic scheduled work orders not yet built |
| W5 Field operations | 12% | 0% | Offline field sheet, jobs, labor, media, materials and issue capture |
| W6 Commercial Project 360 | 10% | 0% | Unified shared property, estimate, approval and job project |
| W7 Equipment integration | 8% | 0% | Durable rig/asset linkage to job readiness |
| W8 Financial closure | 9% | 0% | Source-verified invoices, costs, AR and bank reconciliation after database gates |
| W9 Deep intelligence | 7% | 0% | Verified attribution, geo, recurring-service, unit economics |
| W10 Local Data Hub and Capture | 5% | 0% | Encrypted archive, sync, durable chat input approvals |
| W11 Automation assist | 3% | 0% | Owner-approved bounded workflows, pause/stop, receipts |
| W12 Adoption / independent review | 2% | 0% | Two-founder test record, accessibility audits, independent Astra review |
| **TOTAL** | **100%** | **19% (conditional on R30 exact-head CI + merge)** | |

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

### R29 Estimate Workbench (+3 points within W4, conditional on merge)

- Native `/b/exterior/estimate?lead=<exact ID>` launched from HQ, Customer 360, customer cards/table and the five-domain navigation. No selection fallback substitutes another customer.
- Full in-browser line-item scope builder with units (flat, each, square foot, linear foot, pane and hour), quantity, price/unit, optional direct cost/unit, site notes, discount, travel expense and direct-cost contingency; exact 2-decimal money math with explicit unknown cost coverage, contribution and gross margin qualifiers.
- Auto-saved browser draft (localStorage), up to 8 manually snapshotted local revisions per organization/source lead, restore, reset and copy internal estimate brief. Drafts and cost breakdown are **not shared with Jacob on a different device**, protected cross-session persistence/authenticated sync is NOT claimed, no external proposal sent or customer accepted.
- Three manual founder review checks followed by a narrow **member-only server action** which rechecks original lead's source timestamp and old quoted amount before changing ONLY `quote_amount` (and technical update/lock metadata). A stale source, booked/completed/closed status, zero proposed price or unauthorized member fails safely. No booking/payment semantics inferred.
- Existing guarded `BookDialog` is reachable from the estimate for the selected exact lead, but booking is still a separately confirmed action. There is no durable estimate version → work order relationship or atomic quote-and-book transaction yet.
- Controls preserve read-only preview isolation, max 24 item validation, local revision recovery limits, keyboard focus, responsive industrial styling and reduced-motion support; automated tests cover cost provenance, source drift, storage corruption, discounts and unit economics.
- Cross-device shared estimate versioning, customer e-sign/approval, tax/invoice treatment, route assignment and independent recovery of local drafts **remain blocked or future scope**.

### R30 Portable Quote Handoff (+2 W4 points, conditional on CI and merge)

- Read-only inspected production database and confirmed the legacy `leads` and `bookings` records exist but there is no durable quote-version table. `oj_documents` is a storage metadata table, not a quote-ledger shortcut.
- Shipped a portable **internal** estimate package (`oj-exterior-internal-quote` v1) for the full line-item estimate plus up to 8 saved revisions. It is intentionally manually exchangeable only, not synced between devices.
- New Estimating Workbench download/import actions with filename, file-size limits, strict exact organization + lead match, price/cost/discount validation, safe field whitelist, corruption resistance and deliberate confirmation before overwriting an existing local draft.
- Quoting readiness panel checks original record freshness, price compatibility, linked booking count, incomplete cost evidence and **always unverified customer acceptance**. It never marks a file customer-approved, a quote sent, a job booked or any payment received.
- Reuses the existing source-bound local drafts, member-authorized price recording and guarded booking dialogs. Imported versions can never automatically mutate shared leads or create bookings.
- Produced a release-gated durable version/approval/work-order schema design: `docs/EXTERIOR_QUOTE_VERSION_STORAGE_GATE.md`; nothing applied to production. Future migration still requires recoverable backup, isolated restore, staging RLS and founder-device evidence.
- Strict unit tests prove round-trip fidelity, no false payment/approval, cross-company/cross-customer denial, malformed JSON and extra-field isolation, stale source and booking preflight.
- **No shared quote revisions yet; no cross-device sync, provider contact, electronic signatures, approved work orders, invoices, bank settlement, or database migrations.**

### Release gates and the next update rule

Verified R26 (8%), R27 (+3%), R28 (+3%) and R29 (+3%) earn **17%** engineering progress. R30's manually portable quote interchange adds **2 W4 percentage points** only if exact PR-head CI passes (typecheck, full tests, production build) and its PR merges. This targets **19%**; if CI/merge fails keep 17%. Do not describe internal file transfer as durable synchronized quote data. Live Windows served SHA and authenticated two-founder mobile acceptance remain separate mandatory checks.

For **every future Exterior Command development response** report: (a) estimated overall completion %, (b) specific earned plan waves, (c) merged PR / CI state, (d) next blocker and immediate implementation slice. Do not increase completion for documentation-only or redundant tooling.

### Next prioritized implementation

1. Verify private production backup **and isolated restore**, then validate staging schema/RLS and migration approval before creating actual org-scoped quote, version, event and work-order tables.
2. Build durable approval evidence (sent provider message ID, signed/specific accepted version, customer response timestamps) and atomic, idempotent `accepted-version → work-order → booking` server transaction.
3. Migrate only authenticated, deliberate founder-reviewed local estimate versions into shared database documents; mark unresolved source drift and duplicate candidates, never auto-merge.
4. Field operations capture: arrival, departure, actual crew hours, supplies, equipment, site photos, mileage, customer review and payment status with receipts rather than estimates.
5. Real Windows commit SHA and Oscar/Jacob iPhone UAT, including import/export privacy, stale source handling and lost-network behavior.
