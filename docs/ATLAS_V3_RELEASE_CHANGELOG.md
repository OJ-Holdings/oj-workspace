# ATLAS V3 — Engineering Release Notes & Status Ledger

> Snapshot: **2026-10-22, America/Chicago**. Recheck GitHub main, active PRs, CI and the exact Windows-host release before asserting present tense status.
> Product direction: [ATLAS V3 Master Blueprint](./ATLAS_V3_MASTER_INDEX.md) · [30-wave plan](./ATLAS_06_EXECUTION_ROADMAP.md).
> ATLAS V3 planning documents contain extensive **proposed** features, not claims of already shipped products.

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

## What is STILL NOT built

- Full replacement redesign of every vertical business screen; most deeper tabs retain V2 styling and flows.
- Universal persistently linked customer/property/project/job/asset/invoice identity across every provider; current source links are narrow, exact, authorized read-only projections.
- Shared server-side Fleet/Commercial project and resource persistence across Oscar/Jacob, globally consistent concurrent edits or resilient offline field operations. Local R08 project revisions protect some same-browser stale writes but are **not** a distributed transaction or shared synchronization.
- Complete financial ledger/payment/bank reconciliation or permission-gated invoice closeout; **no ATLAS cash or net profit confidence claims**.
- Fourth-venture Oscar Jacob live persistence, real publishing/analytics, agency AI telemetry, Shopify landed-cost/advertising reconciliation.
- Production Windows/Tailscale host confirmation: only GitHub merges and PR CI are proven here.
- P0 Supabase backup/restoration and additive migration: draft PR #42 remains blocked/unmerged pending independently verified private backup, isolated restore, RLS/auth audit and supervised release.

## Next integrated milestone (proposed; not yet shipped)

**Next protected milestone / Canonical multi-device project persistence:** First finish a real private production backup and independently isolated restore drill, actual live schema/RLS introspection, supervised migration approval and tenant/booking-source security tests. Only then implement opt-in canonical server-side project/estimate/asset/task relationships, import mapping and dual-device permission-safe edits behind OFF-by-default feature flags. See [Shared Persistence Gate](./ATLAS_V3_SHARED_PERSISTENCE_GATE.md). Continue refining source-aware field and customer workflows without creating false shared-data claims in the meantime.

## Exact host verification on Oscar's Windows machine

```powershell
cd C:\STRATHOS\apps\oj-workspace
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-production-windows.ps1
```

Expected comparison is current `main` SHA to same-origin localhost `http://127.0.0.1:3011/api/deploy-health` release SHA. Code-only guarded updater may normally auto-deploy green main commits, but **do not assume** it did so. Optional `-TriggerUpdater` invokes the existing guarded updater if explicitly needed and authorized. Keep existing account identities and live records intact.

**Bottom line:** Releases 01–12 are merged into GitHub main with passing exact-head CI, including a versioned browser-local commercial portfolio, tentative Fleet resource planning, actual paid crew-hour scenario warnings, reviewed Field Mission Packs, exact booking/task handoffs and per-asset Fleet maintenance task drafts. Most of the 413 proposed capabilities remain unbuilt. This ledger has **not** independently verified the Windows-host SHA, actual mobile usability, both founders' role flows or the Supabase backup/restore gate.
