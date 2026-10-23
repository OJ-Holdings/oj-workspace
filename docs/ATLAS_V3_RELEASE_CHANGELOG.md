# ATLAS V3 — Engineering Release Notes & Status Ledger

> Snapshot: **2026-10-23, America/Chicago**. Recheck GitHub main, active PRs, CI and the exact Windows-host release before asserting present tense status.
> Product direction: [ATLAS V3 Master Blueprint](./ATLAS_V3_MASTER_INDEX.md) · [30-wave plan](./ATLAS_06_EXECUTION_ROADMAP.md).
> ATLAS V3 planning documents contain extensive **proposed** features, not claims of already shipped products.

## ATLAS V3 / Exterior Command Release 27 — VERIFIED-SOURCE CUSTOMER 360

**PR:** [#97](https://github.com/OJ-Holdings/oj-workspace/pull/97). **Merged SHA:** `04edc152f498c2cf81498cbd83dcaaa0fb7af760`. **Exact PR-head CI:** `40022388450` SUCCESS.

- New Customer 360 dossier from a legacy lead's unchanged source ID. Real service address/contact, requested work, notes, quote, booking timeline, job-financial evidence and source-coverage limits appear in a single responsive, animated, provenance-aware interface.
- Booking relationships use exact `lead_id` values. Other leads and website requests sharing normalized phone or address are marked as **unverified identity candidates**; names alone never imply identity. Booking picker no longer hides separate source records sharing contact information.
- Customer dossier actions call the same authenticated customer edit, booking and recorded financial forms as existing Exterior operations. No new parallel source tables, CRM mutation endpoints or payment collection operations were created.
- Historical source job revenue and costs remain **lead-level fields**; repeat bookings never multiply them, and neither is bank-confirmed settlement or finalized accounting. Dates derived from updates are flagged as estimates.
- Customer cards, booking cards/tables and HQ mission timeline deep-link to the exact dossier; old routes remain available.
- CSS adds card surfaces, timeline, founder work actions, accessible focus and phone responsiveness with reduced motion; tests exercise source linkage, duplicate candidate isolation, null costs, incomplete history and date uncertainty.
- **Full 12-wave Exterior Command program:** estimated **11% complete** (5 points W1 experience, 3 W2 HQ, 3 W3 Customer 360). Detailed progress and remaining acceptance scope: [Exterior progress ledger](./EXTERIOR_COMMAND_PROGRESS.md).
- **Still unverified:** exact Windows production served SHA, mobile founder acceptance, real bank/communication source capture and protected schema backup/restore/recovery gate.

## ATLAS V3 / Exterior Command Release 26 — NATIVE FIELD-SERVICES HQ

**PR:** [#95](https://github.com/OJ-Holdings/oj-workspace/pull/95). **Merged SHA:** `efddc6d57fc4b8e0ffe025f8a3b6100fc252def4`. **Exact PR-head CI:** `40020624041` SUCCESS.

- Exterior Care's old generic venture overview is replaced with a custom, responsive division HQ. The new five-domain navigation is Command / Customers / Operations / Commercial / Intelligence, with a compatibility directory preserving functional legacy pages.
- Four real source-evidenced finance/operations instruments: completed-job recorded revenue; future confirmed booking quote value; prebook open quote exposure; recorded revenue-minus-direct-cost subset. NO bank-confirmed collection, invoice or company-profit claims.
- Upcoming job timeline, exact linked customer records, task/lead data-integrity decision queue, six-month completed-job revenue chart (unknown treated as unknown), all-time acquisition-source tags, source completeness and access-failure states.
- Design release: technical graphite, sea-glass/amber, compact founder action controls, KPI entrance motion, interactive bar graphics, responsive iPhone layouts, focus and reduced-motion support.
- Synthetic fixtures are limited to preview; live access requires existing authorized Exterior source. No database migrations, payments, customer sends, financial postings or external actions.
- **Full 12-wave Exterior Command plan estimated 8% complete** upon PR merge; tracked with accountable weighted milestones in [Exterior progress ledger](./EXTERIOR_COMMAND_PROGRESS.md).
- Windows host SHA and founder mobile/desktop acceptance unverified; merged-main CI check separately from PR-head.

## ATLAS V3 / Release 01 — COMMAND REBORN

**GitHub PR:** [#57](https://github.com/OJ-Holdings/oj-workspace/pull/57).
**Merged SHA:** `133f309fb6b7fdf2441f21076d16221772745581`.
**Reviewed PR-head CI:** `39872873154` — SUCCESS (PowerShell parser, npm ci, TypeScript, tests, production Next.js build).
**Deployment:** GitHub merge verified. Windows port 3011/Tailscale serving SHA **not independently verified**.

### Main-screen changes
- **Premium ATLAS Shell**: redesigned brand treatment and darker executive command visual system, grouped sidebar sections, breadcrumb, retained Ctrl/Cmd+K quick search and task/venture context, responsive mobile five-action bottom navigation.
- **ATLAS Executive HQ** replaces fragmented previous executive/intelligence/connected-operations promotional blocks and duplicate venture hero tiles.
- HQ now offers **five actual frontend operating modes**: TODAY, OPERATIONS, GROWTH, MONEY and STRATEGY. Modes filter/reframe the existing authorized workspace sources; they do not create isolated shadow databases.
- HQ includes an intentional company hero, four operating venture summary tiles (Oscar Jacob correctly marked preview-only), action/mission stack, loaded 7-day Exterior booking and company calendar panel, accountable board assignees, explicit recorded money-entry state and source health.
- A **contextual decision/evidence inspector** beside HQ reveals selected source/venture/issue, original record link, and verified exact-ID relations; authorized users can open the existing normal task draft handoffs. No invisible data mutation.
- Trust guardrails explicitly state that recorded finance tags are not verified cash, completed tasks are not payments, staff assignee text is not live presence, a preview is fictional, and incomplete sources are unknown.

### Navigation consolidation
- The old standalone **Connected Operations** link is removed from primary rail, Tools Hub registry promotion, homepage pulse and business overview banners. Its already-implemented `/workspace/tools/operations` route remains accessible as a backwards-compatible destination while the underlying typed relationship layer is reused in HQ.
- This does **not** delete customers, tasks, source links or a legacy endpoint. Any future full route redirect/deprecation must be reviewed separately.
- Existing Venture, Analytics, Fleet, Commercial and business screens remain in place and retain their current authorized data operations.

### Code map
- `src/components/app/AtlasHQ.tsx`
- `src/lib/atlas-command.ts`
- `src/styles/atlas-v3.css`
- `tests/atlas-command.test.ts`
- Wiring: `HomeView.tsx`, `Shell.tsx`, `VentureView.tsx`, `CorporateTools.tsx`, `corporate-tools.ts`, `globals.css`.

## ATLAS V3 / Release 02 — ENTITY CONTEXT IN THE REAL WORK

**GitHub PR:** [#58](https://github.com/OJ-Holdings/oj-workspace/pull/58).
**Merged SHA:** `88c43eb6ff798d6d8c446b1e07a71b941741f96c`.
**Reviewed PR-head CI:** `39873486495` — SUCCESS (PowerShell parser, npm ci, TypeScript, tests, production build).
**Deployment:** GitHub merge verified. Exact Windows-host release **not independently verified**.

### Company work integration
- Workspace CRM lead details now show a polished **Related workspace tasks** panel with the actual linked task status, assignee, due date and deep link.
- Shared task editor now shows **Source relationships** panels for exact loaded CRM lead IDs and/or active Exterior booking IDs.
- Source references in task handoff description (including `Workspace CRM source: /workspace/crm?lead=ID` and `Booking record ID: ID`) are recognized by the existing exact-ID selector. Same venture is required for CRM relations; booking relations require Exterior source and an active loaded booking.
- Missing/unloaded records and fuzzy names are not represented as confirmed matches; no artificial customer merge or cross-business data inference.
- Parent task editor's existing unsaved-draft close safeguard controls relation navigation.
- No new customer writes, schema, provider outreach, banking, contract, publishing or payment action.

### Code map
- `src/lib/atlas-relations.ts`
- `src/components/app/AtlasRelations.tsx`
- `tests/atlas-relations.test.ts`
- Wiring: `App.tsx`, `VentureView.tsx`, `Pages.tsx`, `CardDialog.tsx`, `atlas-v3.css`.


## ATLAS V3 / Release 03 — MISSION & CRM WORKBENCH

**PR:** [#60](https://github.com/OJ-Holdings/oj-workspace/pull/60). **Merged SHA:** `8b5f74aa1d1a033bd65898ebb128eaa537584beb`. **Reviewed PR-head CI:** `39874726844` — SUCCESS.

- The actual shared Task Board and workspace CRM screens gained ATLAS visual hierarchy, action navigation and read-only pipeline/mission context.
- CRM counts derive from the exact workspace `New`, `Proposal` and `Won` stage enums, not inferred payments or signed deals.
- The task-board Executive HQ link initially used a hard-coded live path in preview. **Corrected in Release 06** to respect /preview.
- Existing normal source forms, updates, drag/drop and deep-link authorizations remain in use.

## ATLAS V3 / Release 04 — FLEET DISPATCH COCKPIT

**PR:** [#61](https://github.com/OJ-Holdings/oj-workspace/pull/61). **Merged SHA:** `b1ca315f898d723244e7cc8fbcbf5461560e18b1`. **Reviewed CI:** `39876277202` — SUCCESS.

- Introduced an integrated, responsive dispatch and readiness action ribbon inside the existing Fleet Command; direct access to Maintenance, Pre-departure and Rig Lab.
- Indicators originate in manually entered, browser-local equipment records, not telemetry or live GPS/crew tracking.
- **Release 06 hardened this**: previous-day checklist completions no longer count as today's status, and replacing previous checks requires explicit confirmation.

## ATLAS V3 / Release 05 — COMMERCIAL BID COMMAND

**PR:** [#62](https://github.com/OJ-Holdings/oj-workspace/pull/62). **Merged SHA:** `29e4cb6b513be1e4d27fb17eb98d866fd447c870`. **Reviewed CI:** `39880281415` — SUCCESS.

- Combined Property Scope, Cost Engineering and Bid War Room into one in-context command bridge with entered building, labor, rental-day and checklist summaries.
- Retains the existing scenario/pricing engine and does not create customer proposals, approved bids, jobs, invoices or receipts.
- The editable estimate remains a private local draft. Release 06 added strict load/save validation and corrected organization/role isolation.

## ATLAS V3 / Release 06 — SOURCE-CONNECTED FIELD BRIDGE + AUDIT FIXES

**PR:** [#63](https://github.com/OJ-Holdings/oj-workspace/pull/63). **Merged SHA:** `59318f655bfcab51fde1a966c44cce33ab06808d`. **Exact-head CI:** `39882424202` — SUCCESS.

- New `src/lib/atlas-field-bridge.ts` and `src/components/app/AtlasFieldBridge.tsx` are a real **read-only, same-browser cross-module projection** between Commercial and Fleet.
- Both existing organization-keyed browser draft formats are validated through their canonical transfer/workbook parsers. Unavailable, corrupt and foreign-organization sources are not fabricated or automatically overwritten.
- Site access still under review, zero rental days for entered lift-access work, service-due or unverified assets, stale pre-departure checks, missing payload limits and entered excess load surface explicit findings. A user may copy an **internal** brief but no external action is taken.
- Fleet checklist date comparisons use America/Chicago local calendar days; original check history is only replaced after explicit user action/confirmation when previous-day checks exist.
- Fixed Commercial Desk stale source context on organization/role switch and blocked read-only/preview local draft inspection. Fixed Task Board preview HQ navigation.
- Tests: invalid local files, cross-organization isolation, empty equipment evidence, task/price source semantics and midnight Chicago rollover.
- **No shared Fleet/Commercial persistence, telematics, provider calls, Supabase schema changes or automatic dispatch.**

## ATLAS V3 / Release 07 — FOUNDER TASK HANDOFFS

**PR:** [#64](https://github.com/OJ-Holdings/oj-workspace/pull/64). **Merged SHA:** `10bfcda1ea4eb946ab59655d3f9eed04115d845e`. **Exact-head CI:** `39883530696` — SUCCESS.

- Commercial users can explicitly validate and **save the local estimate**, then open the *existing shared task editor* with a sanitized snapshot of site counts, paid hours, lift assumptions and pre-proposal exceptions.
- Fleet users can explicitly prepare a shared task *draft* from validated local equipment condition, dated readiness and payload assumptions.
- Drafts are only **persisted** after the authorized editor clicks Save. Existing task membership/role checks and unsaved-change guard remain authoritative. No automatic assignment, customer message, rental, contract, quote, invoice or payment.
- Source descriptions explicitly say original local workbooks are **not synchronized**, and do not copy private building addresses or site notes into a task.
- Added `src/lib/atlas-task-handoff.ts` and source-scoped tests for shared-board draft validation, bounded field text and no invented approval.
- Jacob may see a saved shared task *snapshot*, not the original estimate/fleet file from Oscar's device.

## Independent audit and acceptance

The above PR head checks are verifiable GitHub CI events, not independent proof of the current Windows/Tailscale production SHA or complete manual iPhone/desktop QA. Follow [Founder Acceptance & Production Truth Audit](./ATLAS_V3_FOUNDER_ACCEPTANCE_03_07.md) to validate end-to-end multi-role interactions with Oscar and Jacob. The migration/backup gate for draft PR #42 remains intact.


## ATLAS V3 / Release 08 — COMMERCIAL PORTFOLIO & CANDIDATE RESOURCES

**PR:** [#66](https://github.com/OJ-Holdings/oj-workspace/pull/66). **Merged SHA:** `ff8a56a7969cc4fd519b44d59228777f31beb718`. **Exact-head CI:** `39885587630` — SUCCESS.

- Added a **device-local multi-project register** inside the existing Exterior Commercial Desk, not a separate top-level app. Each of up to 24 records has its own name, complete validated estimate, review checklist, `scoping/founder-review/archived` phase, exact optional source-booking ID, candidate Fleet asset IDs, timestamps and optimistic revision.
- Existing singleton local estimate, estimator, Bid War Room, JSON interchange and task handoff are preserved. Selecting a portfolio entry explicitly loads the estimator; edits to the current estimate are not magically saved to a different device.
- Project portfolio is versioned, organization-keyed and capped at 1 MB. Malformed, oversized, foreign-organization, duplicate and stale-revision writes fail closed. User-invoked import/export are private unencrypted JSON and must be handled securely.
- Explicit booking association is only inferred by an exact currently loaded `ExtBooking.id`, never customer-name/address similarity. Booking cancellation, missing source and partial source coverage remain visible.
- Candidate equipment selections come from a validated same-device Fleet workbook; equipment due/service/unverified states and tentative same-day multi-project contention generate warnings. **These are plans, not actual equipment reservations, dispatch orders, rental confirmations or site inspections.**
- Added Fleet Command's read-only commercial allocation radar and tests for tenant scoping, malformed files, conditional access, no fabricated profitability, asset status and source-ID conflicts.

## ATLAS V3 / Release 09 — PROJECT ↔ BOOKING ↔ TASK TRACEABILITY

**PR:** [#67](https://github.com/OJ-Holdings/oj-workspace/pull/67). **Merged SHA:** `33e5958fa1f54158e37e66471f1691b750d54422`. **Exact-head CI:** `39886433047` — SUCCESS.

- Commercial portfolio exposes **Save & prepare project task**. User explicitly persists the selected *local project* version and opens the preexisting shared task **draft**. Only the later, ordinary Save action creates a shared task.
- Task description includes sanitized local project ID, version, estimated work summary and internal warnings. It gets a machine-readable `Booking record ID:` only when the exact source ID is currently loaded, active and calendar-valid. Otherwise the booking remains unverified; source client addresses and quote amounts are not automatically copied into shared tasks.
- Inside a local project, a reverse-link panel finds currently loaded shared tasks carrying the exact project-ID line. This is an explicit textual snapshot relation, NOT a canonical server foreign key or another founder's ability to open the original local project.
- `useJobs` was hardened with an explicit source loading/scope state so task handoffs cannot confirm a booking using stale previous-route or previous-company data.
- Tests cover archived-project guard, cancelled/unloaded/invalid booking IDs, exact reverse source text, normal task validation and exclusion of source customer details.

## ATLAS V3 / Release 10 — FLEET SOURCE-BACKED RESOURCE TIMELINE

**PR:** [#68](https://github.com/OJ-Holdings/oj-workspace/pull/68). **Merged SHA:** `697e7660880785f0e8fc40d87073ecf94ea46dd2`. **Exact-head CI:** `39887258616` — SUCCESS.

- The real Fleet Command now contains a **7/30/90-day commercial planning timeline** from the current user's already-loaded, permission-scoped Exterior booking records + device-local project portfolio + Fleet asset workbook + loaded shared task snapshots.
- Only projects whose exact source-booking IDs resolve to currently loaded, valid and non-cancelled booking records get dated cards. Loading/failure/partial-coverage/cancelled/unlinked cases remain visibly unknown or unscheduled.
- Cards show project count, *paid* crew-hours rather than elapsed job time, tentative lift rental days, locally entered asset health and exact shared task links. Potential same-day reuse of a candidate asset is a **review flag**, not a verified time overlap or reservation.
- Pure projection tests cover source failure, client details/quote non-disclosure, valid horizons, cancellation, stale/fuzzy task refs, multi-project overlap and absence of imaginary project approval.
- No live vehicle telemetry, availability tracking, crew dispatch, actual reservations, database migrations or customer-facing actions.

## Release 08–10 manual acceptance & persistence safety

[Founder Acceptance 08–10](./ATLAS_V3_FOUNDER_ACCEPTANCE_08_10.md) details device, role, quote, booking, Fleet and task exercises still requiring human observation. [Shared Persistence Gate](./ATLAS_V3_SHARED_PERSISTENCE_GATE.md) specifies a **proposed, not applied** canonical project/asset schema and opt-in local import process after real protected backup and independent isolated restore.


## ATLAS V3 / Release 11 — FIELD MISSION PLANNER & PAID CREW-HOUR CAPACITY

**PR:** [#70](https://github.com/OJ-Holdings/oj-workspace/pull/70). **Merged SHA:** `d3ed846467922e9c5043a227f886c519b017c952`. **Exact-head CI:** `39890001290` — SUCCESS.

- Added a real Field Mission Planner **inside** selected, versioned commercial projects. Crew size, productive hours/person/day, planned field days and a private staging note persist as a backward-compatible optional part of the existing device-local project format.
- The model compares **paid person-hours** from the actual building estimates to `crew × productive hours/person/day × days`, computes the estimated minimum number of field days (rounded up), and flags shortfalls or missing inputs without inventing team members or actual availability.
- Site access still marked for review, lift-access buildings with zero modeled rental days and qualified high-access work surface explicit internal warnings. An estimate's days are NOT actual lift reservations or cleared safety assessments.
- Integrated R11 staffing gaps into Fleet Command's R10 7/30/90-day project planning cards and aggregate warning counts. This is an overlay on local assumptions, not shared crew dispatch data.
- Added internal Field Mission Pack copy/download: current-editor snapshot of project scope, **conditional exact loaded booking ID**, paid labor model, candidate equipment and task references, and open workforce/access exceptions. It excludes separate private address/location/note fields; **names themselves can still contain sensitive content**, so users must review output before distribution.
- Extended the existing **explicit user-reviewed shared task draft** to include paid crew-hour gaps without copying private staging notes. Task saves still follow the existing role/permissions and never auto-create contacts, proposals, orders, field reservations or payments.
- Tests cover model arithmetic, unknown coverage, invalid inputs, zero-labor semantics, pre-R11 portfolio compatibility, private-field exclusion, booking verification and cross-module workforce projection.

## ATLAS V3 / Release 12 — ASSET-SPECIFIC FLEET MAINTENANCE TASKS

**PR:** [#71](https://github.com/OJ-Holdings/oj-workspace/pull/71). **Merged SHA:** `dbbfeb7d9b3deb0e8b974917aa99436a8522dab2`. **Exact-head CI:** `39890565690` — SUCCESS.

- Every eligible asset card inside the actual Fleet Command Asset Registry can **Prepare service task** for that exact locally saved equipment ID. The usual shared task editor opens in DRAFT; a user must explicitly Save it.
- Task description contains an exact, bounded `Local fleet asset ID:` receipt, manually entered status/meter/service thresholds, local service-ledger count and most recent logged service date. It deliberately omits private equipment notes, repair descriptions and expense amounts.
- A non-empty source task must come from the **validated, organization-scoped local Fleet workbook**. Invalid/missing IDs, untrusted local data, preview and read-only roles cannot create a private-source handoff through the new route.
- Asset cards show already-authorized **shared task snapshots** matched by an exact single-line textual Fleet asset ID, not fuzzy equipment names or fabricated canonical server foreign keys. A successful shared task does not synchronize the underlying private Fleet workbook to another device.
- Updated task URL cleanup and unsaved-change protection for the new source action. Tests cover task schema acceptance, conditions and suggested priority based on entered local data, spoofed/multiline IDs and privacy-sensitive exclusions.
- **No work was performed:** no part was purchased, repair was scheduled/executed, equipment certified, invoice raised, money collected or dispatch cleared.

## Founder acceptance and actual deployment remain separate

[Founder Acceptance 11–12](./ATLAS_V3_FOUNDER_ACCEPTANCE_11_12.md) extends the earlier manual Windows/iPhone/editor/viewer/Jacob acceptance plan. GitHub CI is **not** evidence that the guarded Windows host has pulled these commits or that the full founder flows work with actual customer, Fleet and booking records.


## ATLAS V3 / Release 13 — NEXUS SOURCE-LINKED PROJECT 360

**PR:** [#74](https://github.com/OJ-Holdings/oj-workspace/pull/74). **Merged SHA:** `e034b19f64eb6b2bdce40cd2817f40c09ed4841d`. **Exact-head CI:** `39906488281` — SUCCESS.

- Embedded a substantial NEXUS Project 360 cockpit into the **actual Exterior business division** (`/b/exterior/projects`). Source inputs: validated, organization-keyed local commercial projects/estimates and Fleet workbook plus independently loaded, already-authorized Exterior bookings/leads, existing workspace tasks and recorded task activity.
- Added typed nodes/edges with explicit evidence: **verified source record**, **device-local planning assertion**, **exact textual task receipt**, or **unverified**. Customer source identity is joined through the exact `booking.lead_id`, NEVER similar property/customer names, phone numbers or financial amounts.
- Included a searchable local project register, per-project internal estimate economics, buildings and pane scope, crew-day capacity, source booking and customer evidence, candidate equipment status, loaded shared tasks, recorded task events and a site/crew/equipment verification queue.
- Source coverage is allowed to be incomplete. A missing or cancelled source booking, unknown Fleet asset, absent linked task or incomplete staffing scenario is **not** a confirmed cancellation of all work, verified resource availability, approved quote or collected payment.
- NEXUS is a **read-only projection**; it does not write new canonical projects, perform supplier/customer actions, submit quotes, synchronize local project files or certify dispatch/safety. Preview and read-only roles do not inspect device-local workbooks.
- Hardened task text receipt matching against multiline forged local project IDs; extensive graph/tenant/source evidence regression tests added.

## ATLAS V3 / Release 13.1 — ONE CANONICAL CORPORATE ENTRY + SOURCE INTEGRITY

**PR:** [#75](https://github.com/OJ-Holdings/oj-workspace/pull/75). **Merged SHA:** `397243c283e092a16bff5c49696234b849816f96`. **Exact-head CI:** `39907267432` — SUCCESS.

- Exposed the **same**, already-working Exterior NEXUS screen as a first-class COMMAND navigation item and searchable capability; did not build a second competing corporate project graph.
- Added explicit links from Fleet's 7/30/90-day project cards and the commercial project portfolio to the relevant last-saved local Project 360.
- Strengthened pure graph authorization boundaries: a Fleet workbook with a different `organizationId` is rejected, including when the portfolio is empty. Added two focused regression tests.
- Fixed nested main landmark semantics within the existing app shell.
- A separately developed PR #73 passed CI but was deliberately **closed without merging** when the canonical R13 PR #74 landed concurrently. Do not merge or cherry-pick that duplicate component/graph without auditing conflicts.

## NEXUS Founder QA & Protected Database Gate

[Founder Acceptance 13](./ATLAS_V3_FOUNDER_ACCEPTANCE_13.md) details the unperformed manual Windows/iPhone, Oscar/Jacob, exact booking/customer and cross-organization tests. Read-only Supabase metadata inspection found the existing workspace and Exterior legacy source tables with RLS enabled, but **not** canonical shared Commercial/Fleet tables. Current security advisories include privileged-function execution checks requiring private review before any schema/grant changes. The real private backup and independently isolated restore drill remain unverified, and migration PR #42 remains draft. Consult [Shared Persistence Gate](./ATLAS_V3_SHARED_PERSISTENCE_GATE.md).

## What is STILL NOT built

- Full replacement redesign of every vertical business screen; most deeper tabs retain V2 styling and flows.
- Universal persistently linked customer/property/project/job/asset/invoice identity across every provider; current source links are narrow, exact, authorized read-only projections.
- Shared server-side Fleet/Commercial project and resource persistence across Oscar/Jacob, globally consistent concurrent edits or resilient offline field operations. Local R08 project revisions protect some same-browser stale writes but are **not** a distributed transaction or shared synchronization.
- Complete financial ledger/payment/bank reconciliation or permission-gated invoice closeout; **no ATLAS cash or net profit confidence claims**.
- Fourth-venture Oscar Jacob live persistence, real publishing/analytics, agency AI telemetry, Shopify landed-cost/advertising reconciliation.
- Production Windows/Tailscale host confirmation: only GitHub merges and PR CI are proven here.
- P0 Supabase backup/restoration and additive migration: draft PR #42 remains blocked/unmerged pending independently verified private backup, isolated restore, RLS/auth audit and supervised release.

## ATLAS V3 / Releases 14–19 — corporate integration through daily operator UX

These are completed GitHub merges, not independently verified Windows-host deployments.

| Release | Merged PR / SHA | Operational change |
| --- | --- | --- |
| **R14** | [#78](https://github.com/OJ-Holdings/oj-workspace/pull/78) · `0a3d527` | Unified source-backed NEXUS Corporate Command without duplicating Project 360 |
| **R15** | [#79](https://github.com/OJ-Holdings/oj-workspace/pull/79) · `063eefa` | Reviewable, non-destructive device-local commercial project import/merge |
| **R16** | [#80](https://github.com/OJ-Holdings/oj-workspace/pull/80) · `840defd` | One-tap lead, booking, finance expense and task creation; functional mobile navigation |
| **R17** | [#81](https://github.com/OJ-Holdings/oj-workspace/pull/81) · `01d8204` | Action-first Exterior Care CRM records and exact-status customer queues |
| **R18** | [#82](https://github.com/OJ-Holdings/oj-workspace/pull/82) · `14f7903` | Action-first, responsive job booking workbench with explicit approval/date queues, customer/call/directions, crew/edit/reschedule/cancel |
| **R19** | [#83](https://github.com/OJ-Holdings/oj-workspace/pull/83) · `8f0ca67` | Action-first Money ledger with expense/income launch actions, source/manual queues, searchable mobile cards, compact table, retained reporting |

**R18 CI:** exact head `39938060774` SUCCESS — PowerShell parse, npm ci, typecheck, tests, production build.
**R19 CI:** exact head `39938744120` SUCCESS — same checks.

**Operator truth constraints:** R18 pending approval is not a confirmed job; past bookings are not proof of completed work; a quoted booking value is not a collected payment. R19 direct/manual and imported/source-recorded entries are distinguished; missing cost coverage remains unknown, and recorded difference is not a verified profit figure. Existing authorized mutation handlers were preserved. Neither release executes external outreach, purchases, bank operations, a database migration, or automatic dispatch.

**Production:** Both merges were verified in GitHub; exact Windows port 3011/Tailscale host SHA, authenticated founder/iPhone walkthroughs, and production backup/restore evidence remain unverified. The supervised draft database PR #42 remains blocked. See [live engineering handoff](./START_HERE_CHAT_HANDOFF.md).

## ATLAS V3 Release 20 — TREASURY COMMAND / ACCOUNTING KERNEL

**PR:** [#85](https://github.com/OJ-Holdings/oj-workspace/pull/85). **Merged SHA:** `98a52b586`. **PR exact-head CI:** `39985983629` SUCCESS. **Merged-main CI:** `39986203721` SUCCESS.

- Finance now leads with recorded inflow/outflow/difference, previous-period context, cost breakdown, operating-brand summaries and exception work grounded in permitted finance and job coverage data rather than numbers of entries.
- Mercury current USD linked balances appear only to authorized owners with complete available account data; not total company cash, not verified profit or bank reconciliation.
- Existing finance actions, scoped ledger and records are retained; no DB migration or customer/financial side effects.
- Pure guarded double-entry journal validator and in-memory trial balance exist for future canonical accounting only; **nothing has been posted**.

## ATLAS V3 Release 21 — ACCOUNTANT REVIEW DATA EXPORT

**PR:** [#86](https://github.com/OJ-Holdings/oj-workspace/pull/86). **Merged SHA:** `8cbdc7d1d`. **PR exact-head CI:** `39986712315` SUCCESS.

- Actual Finance transaction workbench can export visible, filtered, authorized records to a spreadsheet-formula-safe CSV containing source, dated amount, category, note and the explicit distinction of estimated/unknown source date basis.
- Every row is labeled **not verified by bank reconciliation** and **not posted to a general ledger**. This is a review file, not a P&L, tax return, or exported CPA signoff.
- Explicit review confirmation protects potentially sensitive financial notes; read-only actors may export only records they were permitted to load. No data mutation or schema change.

**Deployment:** GitHub merges verified; actual Windows/Tailscale serving SHA, founder device acceptance and production backup/restore still unverified. Detailed next-stage gates: [ATLAS Accounting](./ATLAS_ACCOUNTING_ENGINEERING.md).

## ATLAS V3 Release 22 — MERCURY BANK INSPECTION

**PR:** [#88](https://github.com/OJ-Holdings/oj-workspace/pull/88). **Merged SHA:** `f2cffd5f9`. **Exact PR-head CI:** `39989291018` SUCCESS. **Post-merge main CI:** `39989499380` SUCCESS.

- Owner-only, readable Mercury recent bank feed in Finance with actual account-name/amount/date/status evidence and direct links to existing operating-ledger candidate rows.
- Candidates are exact USD amount magnitudes within four Chicago-local calendar days (dates checked through DST); no debit/credit semantics, automatic confirmation, account/legal-entity assumption or general-ledger posting is inferred.
- Ambiguity, incomplete source timestamps, non-USD records, partial bank feed and missing candidate matches are openly labeled. Last 50 bank transactions do not equal statement-level reconciliation.
- No bank mutations, Supabase schema changes, payment actions or customer outreach.

## ATLAS V3 Release 23 — MONTH-END ACCOUNTING PREPARATION

**PR:** [#89](https://github.com/OJ-Holdings/oj-workspace/pull/89). **Merged SHA:** `e7741575a`. **Exact PR-head CI:** `39990285027` SUCCESS.

- Finance displays actionable month and venture scoped review items for unclassified operational entries, estimated imported source dates and business-relevant integration gaps. It distinguishes explicit known zeros from unrecorded costs.
- A standalone period-close preparation brief is downloadable, with source and caveat evidence but without owner's private account details; nothing is marked finalized or bank-reconciled.
- Full approved double-entry journal persistence, complete bank statements and reconciliation, receipt-linked accounting evidence, AR/AP and owner equity remain unsatisfied gates. No background financial posting, migration, tax filing or live protected record writes.

**Real deployment status:** GitHub merges + named CI verified; exact Windows port 3011/Tailscale serving SHA and both founders' authenticated desktop/iPhone acceptance remain unverified. See [ATLAS Accounting Engineering](./ATLAS_ACCOUNTING_ENGINEERING.md).

## ATLAS V3 Release 24 — OWNER-ONLY LOCAL BANK STATEMENT INSPECTION

**PR:** [#91](https://github.com/OJ-Holdings/oj-workspace/pull/91). **Merge SHA:** `97f266be08e552086df58a6181fc852c3d7a3021`. **Exact PR-head CI:** `40003491512` SUCCESS.

- Finance now accepts an owner-selected local USD CSV (`Date,Description,Amount` or paired debit/credit columns). It validates quotes, multiline fields, valid ISO/US four-digit-year dates, precise cents, row length and max 1 MiB/2,000 rows. Incorrect rows remain disclosed, not quietly dropped.
- Operators can enter opening/closing balance figures and check whether the **supplied CSV** movements add up. If there are rejected rows or no movements, comparison is withheld. A zero variance is expressly **not** a bank-certified reconciliation.
- Imported rows can be checked against actual currently loaded organization-scoped operating ledger entries for candidate amounts and nearby source dates; multiple possibilities remain ambiguous and no match is stored.
- Bank statement raw text and parsed rows exist in browser state only; none is uploaded, stored, emailed, posted to an accounting ledger, interpreted as tax deductible or used to change payment/bookkeeping records.
- Read-only Supabase project metadata was inspected; confirmed ACTIVE_HEALTHY and existing migration inventory, **not** recoverable offsite backups, an isolated restore, SQL application or RLS signoff. Protected draft #42 remains untouched.

**Release acceptance still required:** post-merge CI and exact serving SHA on Windows 3011 plus authenticated founder/device QA. See [ATLAS Accounting Engineering](./ATLAS_ACCOUNTING_ENGINEERING.md).

## ATLAS V3 Release 25 — POSTING INTEGRITY / REVERSAL PREFLIGHT

**PR:** [#93](https://github.com/OJ-Holdings/oj-workspace/pull/93). **Merged:** `b2bb3780870dc2fa34312ac7ed27fd567b57d368`. **Exact PR-head CI:** `40004558635` SUCCESS.

- Pure in-memory accounting preflight now rejects duplicate journal identity, duplicate legal-entity-scoped source reference (idempotent source), ambiguous account IDs and codes, mixed-entity line references, closed-period edits and malformed debits/credits.
- Only a wholly valid batch yields a separate in-memory trial balance for each legal entity. Result maps and lock lookups prevent JavaScript prototype-key collisions on untrusted entity identifiers.
- Correction is modeled as a new reversal **candidate** with distinct source identity, explicit approver string and inverted debits/credits. Original entries are preserved.
- No persistent accounting schema, identity/approval authority verification, actual posted transactions, bank reconciliation, filing, customer changes or accounting close. Exact engineering gates are in [Posting Invariants](./ATLAS_ACCOUNTING_POSTING_INVARIANTS.md).

**Post-merge/main and host:** Independent main CI and actual Windows 3011 serving SHA must be verified separately. Database restore gate remains blocked; draft #42 stays unmerged.

## Next integrated milestone (proposed; not yet shipped)

**Next protected milestone / Canonical multi-device project persistence:** First finish a real private production backup and independently isolated restore drill, actual live schema/RLS introspection, supervised migration approval and tenant/booking-source security tests. Only then implement opt-in canonical server-side project/estimate/asset/task relationships, import mapping and dual-device permission-safe edits behind OFF-by-default feature flags. See [Shared Persistence Gate](./ATLAS_V3_SHARED_PERSISTENCE_GATE.md). Continue refining source-aware field and customer workflows without creating false shared-data claims in the meantime.

## Exact host verification on Oscar's Windows machine

```powershell
cd C:\STRATHOS\apps\oj-workspace
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-production-windows.ps1
```

Expected comparison is current `main` SHA to same-origin localhost `http://127.0.0.1:3011/api/deploy-health` release SHA. Code-only guarded updater may normally auto-deploy green main commits, but **do not assume** it did so. Optional `-TriggerUpdater` invokes the existing guarded updater if explicitly needed and authorized. Keep existing account identities and live records intact.

**Bottom line:** Releases 01–25 (including integration 13.1) are merged into GitHub main; R18–R25 exact-head CI receipts are detailed above. Earlier releases retain their individual CI receipts above. The architecture: source-linked NEXUS Project 360 builds on the versioned device-local commercial portfolio, tentative Fleet planning, crew-hour models, exact source booking/customer identity, shared task receipts and real task activity. Most of the 413 proposed capabilities remain unbuilt. This ledger has **not** independently verified the Windows-host SHA, actual mobile usability, both founders' role flows or the Supabase backup/restore gate.
