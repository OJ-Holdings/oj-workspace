# Exterior Command — implementation ledger and measured scope

> **2026-10-23.** Product plan: `ATLAS_Exterior_Command_Master_Plan_2026-10-23.md` (user-reviewed external master planning artifact). This score is a founder-facing **engineering estimate**, not a timer or an assertion of real-device acceptance. Recheck merged commit, CI and exact live Windows SHA before marking anything deployed.

## Definition of 100%

A redesign is complete when the 12 master-plan waves are implemented, production-safe, validated on real founder devices, and accepted as part of one connected Exterior operating system. Shipping a beautiful screen does not equal a complete customer/dispatch/accounting application. Existing standalone tools and legacy records are preserved but do **not** automatically count as redesigned/connected workflow acceptance.

| Plan wave | Weight | R36 estimate earned | Not yet done |
|---|---:|---:|---|
| W1 Experience foundation | 8% | **5%** | Founder-specific saved density/layout, final mobile field QA, cross-route visual parity |
| W2 Real Command | 10% | **5%** | R36 source-linked Dispatch Preflight with actionable 0/7/14-day job exceptions now live in code. Still missing verified daily two-founder acceptance, actual crew/vehicle capacity and customer contact receipts, persistent decisions, and verified collection data |
| W3 Customer 360 | 14% | **5%** | R27 exact-lead dossier + R28 website intake candidate review and prefilled drafts; canonical contact/property, approved durable source links and full customer journey not yet complete |
| W4 Quote & booking | 12% | **6%** | R28 intake + R29 line-item estimating + R30 validated private export/import and source/approval/booking preflight; actual durable shared revisions, evidence-backed acceptance and atomic scheduled work orders not yet built |
| W5 Field operations | 12% | **9%** | R31 field worksheet + R33 job economics + R34 closeout action queue + R35 private manual Crew ↔ Owner packet/return feedback. Actual durable shared field events, photo evidence, authenticated cross-device owner approval and source-verified completion remain |
| W6 Commercial Project 360 | 10% | 0% | Unified shared property, estimate, approval and job project |
| W7 Equipment integration | 8% | **2%** | R32 device-local exact-booking fleet asset selection, maintenance/payload/same-day warnings and operator review. Shared reservations, persistent crew/vehicle dispatch, verified equipment safety and real asset telemetry remain |
| W8 Financial closure | 9% | 0% | Source-verified invoices, costs, AR and bank reconciliation after database gates |
| W9 Deep intelligence | 7% | **2%** | R33 guarded cost comparison + R36 corrected quote attribution across HQ, bookings and calendar: repeat visit, partial source, pending bookings no longer inflate value. Still no verified advertising spend, visit-level financial history, client profitability, geospatial intelligence, forecasting or settled cash |
| W10 Local Data Hub and Capture | 5% | 0% | Encrypted archive, sync, durable chat input approvals |
| W11 Automation assist | 3% | 0% | Owner-approved bounded workflows, pause/stop, receipts |
| W12 Adoption / independent review | 2% | 0% | Two-founder test record, accessibility audits, independent Astra review |
| **TOTAL** | **100%** | **34% (R36 merged and exact feature-head CI passed; Windows/device checks separate)** | |

### R36 source-qualified Dispatch Preflight + quote integrity (+2 W2, +1 W9; 2026-10-23)

- [PR #116](https://github.com/OJ-Holdings/oj-workspace/pull/116) merged `main` at `fa03afc8bc73c04269e916cdfdc77fb9a8cf6037`. Exact feature head `a2363f04f85aabfd4e900b837e28cb0f526169b2` passed full [CI run 40053530134](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40053530134): dependency install, TypeScript, all automated tests, Next.js production build. Merged-main CI run `40053650435` needs separate confirmed outcome; Windows served SHA and both founders' phone acceptance unverified.
- Source-backed Dispatch Preflight in **Exterior Command HQ and the real Bookings Manager** uses the existing authorized original lead + booking records, not new tables or invented metrics. Today, 7-day and 14-day work queues reveal pending/unconfirmed appointments, missing source customer/address/phone/scope/slot, ambiguous visit quote and overlapping crew/rig windows with capacity-review caution rather than declaring impossible scheduling. Each card opens actual Booking, Customer 360, Estimate and Field Command flows. Preview remains fictional; no customer action without human click.
- **Financial correctness repair:** `qualifiedDispatchQuotes` requires confirmed booking, exact loaded source IDs, complete reported lead AND booking counts, positive original quote and exactly one active booking for that source lead across recorded history. Original lead quoted amount is no longer multiplied per repeated booking. If even one selected confirmed booking fails those criteria, total source-qualified quoted value is **withheld**, never treated as $0, accepted proposal, invoiced balance or paid revenue. Updated `ExteriorCommand` KPI/timeline, `BookingsManager`, `ExteriorCalendar` monthly/day qualified subtotals, with accurate source-qualification labels.
- Pure projection `src/lib/exterior-dispatch-preflight.ts`, `ExteriorDispatchPreflight.tsx`, responsive styling, 14 focused tests + existing HQ regressions for partial coverage, repeat bookings, source mismatch, missing phone/address/time/scope, overlapping windows, DST, zero/unknown costs and no source mutation.
- **Read-only Supabase inspection:** active PostgreSQL 17 source and base tables; no planned Exterior shared quote/work-order tables; no private backup/isolated restore evidence obtained. Security advisor identified anonymous-invocable privileged functions requiring contextual audit, not blind revocation. See [R36 database gate audit](./EXTERIOR_R36_DATABASE_GATE_AUDIT.md) with exact storage, RLS and migration release requirements.
- Full 12-wave engineering scope **31 → 34%**: W2 **3→5** and W9 **1→2**; other waves unchanged. No schema migrations, source writes, SMS, payment, payroll or new synchronization. Documentation itself earns zero points.

### R35 crew ↔ owner handoff desk (+2 points W5, 2026-10-23)

- [PR #114](https://github.com/OJ-Holdings/oj-workspace/pull/114) merged `main` at `d6ce80cd019fb98486a65d8061b89ee7f129d750`. Exact feature head `92e98f6a44fb2d4ae6ee7f60a011b88eb0b5faee` passed [CI 40050826999](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40050826999): npm ci, TypeScript, **582/582 automated tests**, Next.js production build. Merged-main CI `40050990815` requires final independent outcome. Actual Windows-served SHA and founder device acceptance have NOT been confirmed.
- New `ExteriorCrewHandoff` full-width, phone-first Field Command surface contains three distinct working applications: operator-saved versioned crew packet export; owner import with full job labor/materials/costs/site notes/issues and source-guarded review; and matching owner reply import on the origin device. No copying IDs across screens. Private requests and replies are **manual JSON file exchange** through a user-chosen trusted channel, NOT cloud sync or automatic transmission.
- Strict exact organization, lead, booking, request ID and source revision guards; response must refer to the original request version, chrono-valid reply; invalid cross-company packets, forged approved/paid/finalized fields, corrupt mailboxes, unreviewed costs and unsafe or stale clear-review states are rejected. Local edited field notes or later booking changes invalidate assumptions rather than silently showing verified completion. Browser-local mailbox uses validation and explicit overwrite/reset.
- Owner decides either `follow-up-needed` with `crew` or `owner` responsible, actionable instructions and optional target date; or `reviewed-internally` only if the original field source, unique visit coverage, costs and safety checks permit. Reviewer names are **self-entered, unauthenticated labels**; there is no cryptographic signature, company-wide task assignment or provider receipt. Even internal reviewed ≠ completed, accepted, invoiced, payroll-approved or paid.
- New dedicated `src/lib/exterior-crew-handoff.ts`, `src/components/app/ExteriorCrewHandoff.tsx`, responsive stylesheet, `tests/exterior-crew-handoff.test.ts` with 14+ source/replay/role/safety cases. No Supabase migration, new storage table, booking mutations, outbound SMS, invoice, external financial transaction or personal/private STRATHOS use.
- Weighted engineering scope **29 → 31%** (W5 7→9 points). Database backup with isolated restore, RLS, real shared data and two-founder device QA remain the critical production gates.

### R34 closeout review / owner field handoff (+2 points W5, 2026-10-23)

- [PR #112](https://github.com/OJ-Holdings/oj-workspace/pull/112) merged main at `83b246a48626b520e235d80c15b9e621af6cf4b9`. Exact feature head `9853d994f7341f78d95ef328a74ee44e045549f5` passed full CI run [40049280505](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40049280505): npm ci, TypeScript, all automated tests and Next production build. Post-merge main CI run `40049454435` and actual Windows-served SHA require separate confirmation.
- New booking-bound **Crew Closeout Handoff** inside existing Field Command: summarizes entered direct costs/hours; flags missing crew/material/travel/other review, time stamps, stage, safety/equipment checklists, unresolved attention or stop-work issues, source booking drift, incomplete booking coverage, and multiple active visits under a lead. Direct correction links jump to each real form section or the original booking workbench.
- Operator-initiated private clipboard packet for Oscar/Jacob distinctly labels quoted price, reviewed direct cost, source booking identities and all remaining issues. Even a green internal review is NOT certification of actual job completion, customer approval, final invoice, payroll or bank settlement.
- Nine dedicated regression tests cover reviewed zeros vs missing dollars, critical safety failures, unresolved issues, duplicate bookings, truncated source, stale/absent booking, invalid/wrong-source field logs and nonpayment semantics. Mobile button target, keyboard/focus, responsive layouts, and reduced-motion inheritance included.
- **No** Supabase migration, shared quote-version schema, customer send, bookings/job status write, actual invoice, field media upload or financial settlement; notes and field work remain **browser-local**. Multi-device Oscar/Jacob acceptance and isolated production backup/restore are still outstanding.
- Weighted whole-program engineering progress moves **27% → 29%** (W5 5→7 of 12 points). Documentation updates do not earn further points.

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

### R33 Job Economics Review (+2 W5 points, +1 W9 point conditional on merge)

- Integrates exact authorized booking, original linked lead, R29 same-browser estimate draft, and R31 same-browser field work sheet into a **source-provenance-labeled, read-only** job economics review inside mobile Field Command.
- Displays original *lead-level* quoted amount, local planned line-item direct costs, operator-entered labor/material/travel/other direct-cost estimate and reviewed hours with explicit coverage and source-staleness states. Never calls a quote a customer acceptance, collection, profit or posted revenue.
- Only calculates a clearly labeled **hypothetical quoted-price headroom scenario** when the authorized source snapshot contains the exact booking, exactly one active booking for that lead, current booking field data, positive source quote amount, and reviewed direct cost across all four categories. Otherwise withholds numeric margin scenarios and lists explicit reasons. It still does not assert the source quote was approved or booking-specific.
- Local planned cost less field direct-cost estimate is shown only when original lead stamp, booking stamp, complete numeric fields and source booking uniqueness are satisfied. Incomplete or unknown cost remains unknown rather than zero. Historical lead-level `job_revenue`/`job_cost` is **not allocated to bookings** or entered into these calculations.
- Responsive comparison instruments, cost bars, scenario ratio, missing-evidence explanations, links back to the exact lead estimator, manual local refresh, and an explicitly INTERNAL-only clipboard report. No new customer data collection, shared write endpoint, payments, provider sends, migration or source changes.
- Regression tests cover repeat bookings, cancelled duplicates, stale source, missing quote, null/known-zero direct cost, historical revenue non-attribution and source identity mismatch.
- **Still local to the browser**: not a durable ledger, posted invoice, bank receipt, labor approval, job completion, tax/net-profit calculation, or independent founder acceptance.

### Release gates and the next update rule

R26–R32 have merged/verified source-code releases totaling 24%; R33 passed exact-head CI and merged as 7fb0bb624ac52e9b00994e298b2a36a403e3ceb8 (PR #109), adding 2 W5 points and 1 W9 point for a weighted engineering completion of **27%**. Qualified quote-price scenarios are not financial closure or bank settlement. Actual Windows served SHA, two-founder device acceptance, and a private independently restored Supabase backup are separate checks.

For **every future Exterior Command development response** report: (a) estimated overall completion %, (b) specific earned plan waves, (c) merged PR / CI state, (d) next blocker and immediate implementation slice. Do not increase completion for documentation-only or redundant tooling.

### Next prioritized implementation

1. **Restore proof / permissions:** complete the existing Windows private production dump procedure and independently tested isolated restore with RLS membership cases; do not apply production schema from a GitHub merge alone.
2. **Shared quote/job/asset schemas:** member-scoped append-only quote versions, acceptance events, booking-specific costs and asset reservations with source/role checks, transactional idempotency and rollback evidence.
3. **Job Economics 2.0:** approved quote-to-work-order-to-booking link, genuine booking-specific cost receipts, independently verified invoiced/collected money and separate actual financial posting before any true profitability or AR scoreboard.
4. **Field reliability:** authorized phone offline outbox, field photo/receipt attachment security and retention, labor review/crew attribution, reusable rig checklists and handling changed bookings safely.
5. **Real acceptance:** Windows port served SHA and both Oscar/Jacob authenticated desktop/iPhone tests, including stale estimate, multiple bookings on one lead, incomplete cost and manual bank/collection separation.
