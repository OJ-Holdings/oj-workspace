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

## What is STILL NOT built

- Full replacement redesign of every vertical business screen; most deeper tabs retain V2 styling and flows.
- Universal persistently linked customer/property/project/job/asset/invoice identity across every provider; current source links are narrow, exact, authorized read-only projections.
- Shared Fleet/Commercial local-only draft sync across Oscar/Jacob, versioned concurrent edits or resilient offline field operations.
- Complete financial ledger/payment/bank reconciliation or permission-gated invoice closeout; **no ATLAS cash or net profit confidence claims**.
- Fourth-venture Oscar Jacob live persistence, real publishing/analytics, agency AI telemetry, Shopify landed-cost/advertising reconciliation.
- Production Windows/Tailscale host confirmation: only GitHub merges and PR CI are proven here.
- P0 Supabase backup/restoration and additive migration: draft PR #42 remains blocked/unmerged pending independently verified private backup, isolated restore, RLS/auth audit and supervised release.

## Next integrated release (proposed; not yet shipped)

**Release 08 / Source Identity and Founder Adoption:** Verify the Release 03–07 flows on actual authenticated Windows and iPhone sessions; strengthen task-linked project lifecycle and audit visibility without inventing external provider state. Design permission-safe canonical property/estimate/asset relationships for future sync, but do not write shared schema until a verified backup, isolated restore, RLS/security audit and supervised authorization have cleared the PR #42 gate.

## Exact host verification on Oscar's Windows machine

```powershell
cd C:\STRATHOS\apps\oj-workspace
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-production-windows.ps1
```

Expected comparison is current `main` SHA to same-origin localhost `http://127.0.0.1:3011/api/deploy-health` release SHA. Code-only guarded updater may normally auto-deploy green main commits, but **do not assume** it did so. Optional `-TriggerUpdater` invokes the existing guarded updater if explicitly needed and authorized. Keep existing account identities and live records intact.

**Bottom line:** Releases 01–07 are merged into GitHub main with passing exact-head CI, including connected same-device Commercial/Fleet review and explicit shared task handoffs. Most of the 413 proposed capabilities remain to be built. The current Windows-host release SHA and founder acceptance are still unverified in this ledger.
