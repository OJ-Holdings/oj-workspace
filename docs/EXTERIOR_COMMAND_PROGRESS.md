# Exterior Command — implementation ledger and measured scope

> **2026-10-23.** Product plan: `ATLAS_Exterior_Command_Master_Plan_2026-10-23.md` (user-reviewed external master planning artifact). This score is a founder-facing **engineering estimate**, not a timer or an assertion of real-device acceptance. Recheck merged commit, CI and exact live Windows SHA before marking anything deployed.

## Definition of 100%

A redesign is complete when the 12 master-plan waves are implemented, production-safe, validated on real founder devices, and accepted as part of one connected Exterior operating system. Shipping a beautiful screen does not equal a complete customer/dispatch/accounting application. Existing standalone tools and legacy records are preserved but do **not** automatically count as redesigned/connected workflow acceptance.

| Plan wave | Weight | R32 estimate earned | Not yet done |
|---|---:|---:|---|
| W1 Experience foundation | 8% | **5%** | Founder-specific saved density/layout, final mobile field QA, cross-route visual parity |
| W2 Real Command | 10% | **3%** | Verified real founder acceptance, full shift readiness, integrated decision receipts, true collection data |
| W3 Customer 360 | 14% | **5%** | R27 exact-lead dossier + R28 website intake candidate review and prefilled drafts; canonical contact/property, approved durable source links and full customer journey not yet complete |
| W4 Quote & booking | 12% | **6%** | R28 intake + R29 line-item estimating + R30 validated private export/import and source/approval/booking preflight; actual durable shared revisions, evidence-backed acceptance and atomic scheduled work orders not yet built |
| W5 Field operations | 12% | **3%** | R31 booking-bound, mobile-oriented local work sheet for crew time, material usage, mileage/cost, equipment/site checks and issues; durable shared job events, media uploads, offline sync/replay, payroll/time approval and verified closeout remain |
| W6 Commercial Project 360 | 10% | 0% | Unified shared property, estimate, approval and job project |
| W7 Equipment integration | 8% | **2%** | R32 device-local exact-booking fleet asset selection, maintenance/payload/same-day warnings and operator review. Shared reservations, persistent crew/vehicle dispatch, verified equipment safety and real asset telemetry remain |
| W8 Financial closure | 9% | 0% | Source-verified invoices, costs, AR and bank reconciliation after database gates |
| W9 Deep intelligence | 7% | 0% | Verified attribution, geo, recurring-service, unit economics |
| W10 Local Data Hub and Capture | 5% | 0% | Encrypted archive, sync, durable chat input approvals |
| W11 Automation assist | 3% | 0% | Owner-approved bounded workflows, pause/stop, receipts |
| W12 Adoption / independent review | 2% | 0% | Two-founder test record, accessibility audits, independent Astra review |
| **TOTAL** | **100%** | **24% (conditional on R32 exact-head CI + merge)** | |

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

### R31 Mobile Field Command (+3 W5 points, conditional on CI and merge)

- Real `/b/exterior/field?booking=<exact ID>` work sheet reachable from the HQ, Field Operations navigation, booking card/table and Customer 360; exact booking and lead identity are required and never substituted from a matching name, phone or address.
- Operator-entered, booking-bound stage/prep, optional arrival and departure device timestamps, crew labor hours and loaded-rate estimates, materials/consumable quantities/costs, mileage/rate, miscellaneous direct costs, site and wastewater/PPE/chemical review, pump/hoses/water-fed equipment checks, operational incidents (including stop-work) and site notes.
- Typed `src/lib/exterior-field-log.ts` validates quantity/rate bounds, source date/status, exact booking and customer IDs, unique row identifiers, date ordering, text limits, safety enums and exception severity. Null and unchecked are never counted as zero or reviewed. Complete direct costs appear only after **all four categories** are explicitly reviewed; the recorded cost subset is separately labeled; no booking-specific profit or paid revenue is inferred.
- A private local browser draft auto-saves only after validation, with manual `oj-exterior-field-draft` portable JSON export/import scoped to exact company, booking and original lead. Import requires explicit destructive-overwrite confirmation. No shared corporate job record, real crew time approval, online sync, invoice, customer signoff, location verification, camera uploads or background transmission was implemented.
- Mobile-optimized industrial Field Command CSS, clear status for safety gaps and stop-work incidents, keyboard focus, motion reduction, source-drift warnings and live vs preview safety. Tests cover unknown money, math, exact booking/source scope, forged finalized status, cross-org file rejection, corrupt payloads, unsafe issue labels and extra-field stripping.
- Production database remains unchanged; the R30 quote-version backup/restore/RLS gating document still governs any future schema. Real iPhone acceptance and Windows-served SHA remain separate verification tasks.

### R32 Fleet ↔ Field booking coordination (+2 W7 points, conditional on CI + merge)

- Uses the **existing** browser-local Fleet Command asset registry, statuses, maintenance dates/meters, daily checklist and rig payload assumptions. Does not invent equipment records or create another fleet inventory.
- Adds job-specific asset selection within each exact, authorized `/b/exterior/field?booking=<id>` work sheet. Saves a small per-organization/per-booking local assignment document with original `lead_id`, source date and status; preserves Field Command's R31 crew/material/site record and the fleet workbook separately.
- Selection and current original source are joined **only by exact IDs**. Evaluates overdue/out-of-service/needs-service equipment, missing assets, old shift reviews, incomplete local pre-departure checklist and load exceeding entered vehicle payload. No inspection/certification is inferred; status `ready` means locally recorded only.
- Same-day planned-asset overlaps are highlighted only among source bookings + assignments visible in this browser; without shared staff/equipment reservations the warning cannot prove physical overlap or team-wide availability.
- Explicit operator review is stamped locally for the current Chicago business day, resets after asset changes, blocks recording if locally captured stop conditions exist; a change of original booking date/status forces founder review/rebase. No automatic dispatch confirmation, job-closeout, fleet writes, equipment inspection or payments.
- Cross-tenant local assignment validation, strict whitelisting, corrupt-storage fail-closed, source-date/status drift warnings, responsive mobile visual cards. Pure regression tests cover original booking identity, overdue service, payload, warnings, false-availability avoidance, same-day overlaps and forged states.
- **This is a device-local operational bridge**, not shared persistent field-fleet integration. Production DB unchanged; protected backup+independent isolated restore and RLS gate still blocks adding new durable quote/job/event tables.

### Release gates and the next update rule

R26–R31 earned **22%** after passing exact-head CI and merged feature releases. R32's safe same-device Fleet ↔ Field equipment-planning bridge adds **2 W7 points** only after CI passes (TypeScript, full tests, production build) and the feature PR merges, reaching **24%**. If R32 is unmerged/failed, preserve 22%. GitHub merging is not proof that the Windows host serves that SHA; two-founder desktop/iPhone QA and independent backup/restore remain separate release gates.

For **every future Exterior Command development response** report: (a) estimated overall completion %, (b) specific earned plan waves, (c) merged PR / CI state, (d) next blocker and immediate implementation slice. Do not increase completion for documentation-only or redundant tooling.

### Next prioritized implementation

1. **Database safety first:** founder-run, encrypted private backup and separate restored copy with reconciliation; test real cross-org RLS, viewer/user removal, version races, replay and rollback before migrating any shared business schema. Existing Windows scripts provide a path, not proof of completion.
2. Add real organization-scoped, immutable shared quote versions, booking-related field events and audited asset reservations with explicit single-resource conflicts, member permissions, and provenance timestamps.
3. Advance W5: mobile field write queue/recovery, real photo ingestion and permission design, crew-time review, invoice/closeout evidence and actual-cost reconciliations rather than browser-only figures.
4. Advance W7: durable rig readiness and maintenance schedules that distinguish physically inspected vs manually entered condition; no dangerous assumption from a previous-day checklist.
5. Verify Windows served SHA and conduct Oscar/Jacob authenticated iPhone/desktop adoption including corrupted storage and missing assets/booking reassignment.
