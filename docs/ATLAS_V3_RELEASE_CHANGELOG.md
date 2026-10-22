# ATLAS V3 — Engineering Release Notes & Status Ledger

> Snapshot: **2026-10-22, America/Chicago**. Recheck GitHub main, active PRs, CI and the exact Windows-host release before asserting present tense status.
> Product direction: [ATLAS V3 Master Blueprint](./ATLAS_V3_MASTER_INDEX.md) · [30-wave plan](./ATLAS_06_EXECUTION_ROADMAP.md).
> ATLAS V3 planning documents contain extensive **proposed** features, not claims of already shipped products.

## ATLAS V3 / Release 01 — COMMAND REBORN

**GitHub PR:** [#57](https://github.com/OJ-Holdings/oj-workspace/pull/57).
**Merged SHA:** \`133f309fb6b7fdf2441f21076d16221772745581\`.
**Reviewed PR-head CI:** \`39872873154\` — SUCCESS (PowerShell parser, npm ci, TypeScript, tests, production Next.js build).
**Deployment:** GitHub merge verified. Windows port 3011/Tailscale serving SHA **not independently verified**.

### Main-screen changes
- **Premium ATLAS Shell**: redesigned brand treatment and darker executive command visual system, grouped sidebar sections, breadcrumb, retained Ctrl/Cmd+K quick search and task/venture context, responsive mobile five-action bottom navigation.
- **ATLAS Executive HQ** replaces fragmented previous executive/intelligence/connected-operations promotional blocks and duplicate venture hero tiles.
- HQ now offers **five actual frontend operating modes**: TODAY, OPERATIONS, GROWTH, MONEY and STRATEGY. Modes filter/reframe the existing authorized workspace sources; they do not create isolated shadow databases.
- HQ includes an intentional company hero, four operating venture summary tiles (Oscar Jacob correctly marked preview-only), action/mission stack, loaded 7-day Exterior booking and company calendar panel, accountable board assignees, explicit recorded money-entry state and source health.
- A **contextual decision/evidence inspector** beside HQ reveals selected source/venture/issue, original record link, and verified exact-ID relations; authorized users can open the existing normal task draft handoffs. No invisible data mutation.
- Trust guardrails explicitly state that recorded finance tags are not verified cash, completed tasks are not payments, staff assignee text is not live presence, a preview is fictional, and incomplete sources are unknown.

### Navigation consolidation
- The old standalone **Connected Operations** link is removed from primary rail, Tools Hub registry promotion, homepage pulse and business overview banners. Its already-implemented \`/workspace/tools/operations\` route remains accessible as a backwards-compatible destination while the underlying typed relationship layer is reused in HQ.
- This does **not** delete customers, tasks, source links or a legacy endpoint. Any future full route redirect/deprecation must be reviewed separately.
- Existing Venture, Analytics, Fleet, Commercial and business screens remain in place and retain their current authorized data operations.

### Code map
- \`src/components/app/AtlasHQ.tsx\`
- \`src/lib/atlas-command.ts\`
- \`src/styles/atlas-v3.css\`
- \`tests/atlas-command.test.ts\`
- Wiring: \`HomeView.tsx\`, \`Shell.tsx\`, \`VentureView.tsx\`, \`CorporateTools.tsx\`, \`corporate-tools.ts\`, \`globals.css\`.

## ATLAS V3 / Release 02 — ENTITY CONTEXT IN THE REAL WORK

**GitHub PR:** [#58](https://github.com/OJ-Holdings/oj-workspace/pull/58).
**Merged SHA:** \`88c43eb6ff798d6d8c446b1e07a71b941741f96c\`.
**Reviewed PR-head CI:** \`39873486495\` — SUCCESS (PowerShell parser, npm ci, TypeScript, tests, production build).
**Deployment:** GitHub merge verified. Exact Windows-host release **not independently verified**.

### Company work integration
- Workspace CRM lead details now show a polished **Related workspace tasks** panel with the actual linked task status, assignee, due date and deep link.
- Shared task editor now shows **Source relationships** panels for exact loaded CRM lead IDs and/or active Exterior booking IDs.
- Source references in task handoff description (including \`Workspace CRM source: /workspace/crm?lead=ID\` and \`Booking record ID: ID\`) are recognized by the existing exact-ID selector. Same venture is required for CRM relations; booking relations require Exterior source and an active loaded booking.
- Missing/unloaded records and fuzzy names are not represented as confirmed matches; no artificial customer merge or cross-business data inference.
- Parent task editor's existing unsaved-draft close safeguard controls relation navigation.
- No new customer writes, schema, provider outreach, banking, contract, publishing or payment action.

### Code map
- \`src/lib/atlas-relations.ts\`
- \`src/components/app/AtlasRelations.tsx\`
- \`tests/atlas-relations.test.ts\`
- Wiring: \`App.tsx\`, \`VentureView.tsx\`, \`Pages.tsx\`, \`CardDialog.tsx\`, \`atlas-v3.css\`.

## What is STILL NOT built

- Full replacement redesign of every vertical business screen; most deeper tabs retain V2 styling and flows.
- Universal persistently linked customer/property/project/job/asset/invoice identity across every provider; current source links are narrow, exact, authorized read-only projections.
- Shared Fleet/Commercial local-only draft sync across Oscar/Jacob, versioned concurrent edits or resilient offline field operations.
- Complete financial ledger/payment/bank reconciliation or permission-gated invoice closeout; **no ATLAS cash or net profit confidence claims**.
- Fourth-venture Oscar Jacob live persistence, real publishing/analytics, agency AI telemetry, Shopify landed-cost/advertising reconciliation.
- Production Windows/Tailscale host confirmation: only GitHub merges and PR CI are proven here.
- P0 Supabase backup/restoration and additive migration: draft PR #42 remains blocked/unmerged pending independently verified private backup, isolated restore, RLS/auth audit and supervised release.

## Next recommended integrated release

**ATLAS V3 Release 03 / Identity & Workstream Cockpit (code-only slice)**:
1. Shared compact entity-context contract for CRM, task, Exterior booking, files and scheduled events, with source confidence and consistent permission boundaries.
2. Visually redesign the actual **CRM and task board** source screens (not another top-level tab): context panel, pipeline stage and ownership, related records and next-action workflows.
3. Improve mobile founder flow for commercial site survey and job/rig readiness. Keep Fleet and Commercial data local-only labeled until safe persistence.
4. Preserve every existing deep link and confirm both founders can perform a real source-link/task handoff on Windows and iPhone.
5. Separately finish G0 private Supabase backup/restore/security prerequisites before any shared persistent domain schema. Do **not** weaken the updater's schema guard.

## Exact host verification on Oscar's Windows machine

\`\`\`powershell
cd C:\STRATHOS\apps\oj-workspace
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-production-windows.ps1
\`\`\`

Expected comparison is current \`main\` SHA to same-origin localhost \`http://127.0.0.1:3011/api/deploy-health\` release SHA. Code-only guarded updater may normally auto-deploy green main commits, but **do not assume** it did so. Optional \`-TriggerUpdater\` invokes the existing guarded updater if explicitly needed and authorized. Keep existing account identities and live records intact.

**Bottom line:** the ATLAS V3 Shell + HQ + first authentic bidirectional CRM/task relationship integration now exist in merged, CI-tested code. The rest of the 413-feature atlas remains a prioritized, deliberately ambitious design and delivery program.
