# Exterior Command — CONTINUE HERE (canonical active handoff)

> **Snapshot:** October 23, 2026, America/Chicago, after merged Release 36. This file is a *checkpoint*, not a live feed. A new agent MUST inspect GitHub `main`, open PRs, exact-head CI, production/host release evidence, and the current progress ledger before asserting current status or changing code.
>
> **Repo:** [OJ-Holdings/oj-workspace](https://github.com/OJ-Holdings/oj-workspace) · **Branch:** `main` · **Workstream:** Exterior Command · **Last verified feature merge:** `fa03afc8bc73c04269e916cdfdc77fb9a8cf6037` (R36 [PR #116](https://github.com/OJ-Holdings/oj-workspace/pull/116)). Exact R36 feature head `a2363f04f85aabfd4e900b837e28cb0f526169b2` passed [CI 40053530134](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40053530134): npm ci, typecheck, all tests, production build. Main post-merge CI run `40053650435` started; verify final status separately. Prior R35 feature and handoff PRs #114/#115 merged with main CI success. Active production Supabase schema/restore gate checked **read-only** in `docs/EXTERIOR_R36_DATABASE_GATE_AUDIT.md`. Actual Windows-served SHA and two-founder device QA remain unverified.

## 1. Mission, people, and operating preferences

Build a *real*, highly interconnected and ambitious command center for the two founders operating OJ Exterior Care, with an easy, fast mobile workflow for Jacob and powerful deeper tools for Oscar. Features should reduce the actual work of acquiring a lead, quoting, scheduling, completing, and getting paid for an exterior cleaning job—not be decorative screens or fake analytics. The user's standing instruction is **continue implementing substantial, useful slices**, with a transparent **percent of the entire 12-wave plan on EVERY release/update**. Do not wait for a separate approval for routine safe engineering. Preserve live customer and booking data. The user's private STRATHOS system and Strathion business are separate and never to be imported into this shared OJ app.

**User wants continuity even when starting a new ChatGPT conversation.** Before and after meaningful implementation work, read/update this file and the release ledger; a GitHub merge + green CI does not establish production deployment.

## 2. Ground truth to read, in this order

1. This file, including the latest verified SHA and incomplete gates.
2. [`AGENTS.md`](../AGENTS.md) and [`docs/BUILD_PLAN.md`](./BUILD_PLAN.md) — architecture, ownership, auth/RLS, preview isolation, deployments, test rules.
3. [`docs/EXTERIOR_COMMAND_PROGRESS.md`](./EXTERIOR_COMMAND_PROGRESS.md) — full **12-wave weighted scope** and milestone accounting; update only after verified product work and merge. Read the [R36 database gate audit](./EXTERIOR_R36_DATABASE_GATE_AUDIT.md) before any shared-data migration.
4. [`docs/START_HERE_CHAT_HANDOFF.md`](./START_HERE_CHAT_HANDOFF.md) — historical detailed implementation handoffs; read the latest release entries first, not necessarily the whole file.
5. [`AGENT_LOG.md`](../AGENT_LOG.md) and [`docs/ATLAS_V3_RELEASE_CHANGELOG.md`](./ATLAS_V3_RELEASE_CHANGELOG.md) — recent agent changes and user-facing release notes.
6. [`docs/EXTERIOR_QUOTE_VERSION_STORAGE_GATE.md`](./EXTERIOR_QUOTE_VERSION_STORAGE_GATE.md), [`docs/BACKUP_FREE_TIER_WINDOWS.md`](./BACKUP_FREE_TIER_WINDOWS.md), and the Windows backup scripts — migration prerequisites. A script existing is **not** proof that a real private backup/isolated restore was performed.

**Live re-check commands / repository API:** fetch `branches/main`, `commits?per_page=5`, `pulls?state=open`, and `actions/runs?branch=main&per_page=5`. Verify a feature PR's *exact head* SHA has completed all four checks (dependency install, TypeScript, full test suite, production build) before merging; then inspect **post-merge main CI**. Inspect deployment receipts separately; no assumptions based on “GitHub green.”

At this snapshot open PRs #17, #34 and #42 existed. They are separate older workstreams, **not** automatic permission to merge or overwrite them. Re-check actual open PRs every session.

## 3. Confirmed full-plan engineering score: 34 / 100

| Wave | Max | Earned at R36 |
|---|---:|---:|
| W1 Experience foundation | 8 | 5 |
| W2 Real Command | 10 | 5 |
| W3 Customer 360 | 14 | 5 |
| W4 Quote & booking | 12 | 6 |
| W5 Field operations | 12 | 9 |
| W6 Commercial Project 360 | 10 | 0 |
| W7 Equipment integration | 8 | 2 |
| W8 Financial closure | 9 | 0 |
| W9 Deep intelligence | 7 | 2 |
| W10 Local Data Hub and Capture | 5 | 0 |
| W11 Governed automation | 3 | 0 |
| W12 Adoption / independent review | 2 | 0 |
| **TOTAL** | **100** | **34** |

This is **weighted engineering delivery**, not 34% user acceptance or a deployed-facility measurement. A new release increases it only if a genuinely delivered, tested, merged vertical slice earns a defensible share of remaining wave scope. Do not increase it for documentation-only PRs, test fixes, proposed UI, unverified production changes, or speculative architecture.

## 4. What actually ships in the current repository

- **R26, R27, R28:** Live source-aware Exterior HQ; authenticated Customer 360 by exact legacy lead ID; website intake review and *candidate* matching. No automatic cross-customer merge or unapproved lead conversion.
- **R29 ([PR #101](https://github.com/OJ-Holdings/oj-workspace/pull/101)):** Line-item estimating for exact customer lead; unit qty/price, cost unknown tracking, discount/travel/contingency, local revisions; reviewed quote amount can be written to original lead with auth and compare-and-swap. Internal drafts != approved proposals.
- **R30 ([PR #103](https://github.com/OJ-Holdings/oj-workspace/pull/103)):** Validated private quote draft import/export between founders on the exact company+lead; not a synchronized quote ledger or acceptance evidence.
- **R31 ([PR #105](https://github.com/OJ-Holdings/oj-workspace/pull/105)):** Mobile booking-specific Field Command, labor/crew hours, materials, mileage, safety/equipment checklist, stop-work incidents, private local draft import/export; no verified crew payroll, source closeout or invoices.
- **R32 ([PR #107](https://github.com/OJ-Holdings/oj-workspace/pull/107)):** Existing local Fleet Command assets join each job's equipment plan, service/payload/checklist/visible same-day conflict cautions. Not a multiuser reservation or certified site inspection.
- **R36 ([PR #116](https://github.com/OJ-Holdings/oj-workspace/pull/116)):** Live source-aware Dispatch Preflight in both Command HQ and Bookings; 0/7/14-day operator queue with pending/unconfirmed, address/contact/scope/time gaps, overlapping time windows (capacity caution only) and exact job/customer/estimate/field links. Source lead `quote_amount` is no longer multiplied over repeat visits in Command's booked quote KPI, schedule timeline, Bookings Manager, or Jobs Calendar. Total qualified quoted exposure withheld when quote not positive, multiple active visits under one source lead, or incomplete lead/booking source coverage; pending/denied/cancelled excluded from confirmed quotes. No payment, actual crew assignment or site readiness inferred. Added behavioral tests. **+2 W2, +1 W9 = 34%**. No database writes; R36 production security/backup audit in `docs/EXTERIOR_R36_DATABASE_GATE_AUDIT.md`.
- **R35 ([PR #114](https://github.com/OJ-Holdings/oj-workspace/pull/114)):** Booking-specific private Crew ↔ Owner Handoff Desk. Operator exports complete typed R31 field snapshot to explicitly transferred JSON; owner imports and inspects original labor/material/site/issue facts and source-bound R34 blockers, assigns an actionable follow-up to crew/owner with optional target date, or records non-final **internal** review only when source and safety gates clear; exports a matching JSON owner reply that crew can import on the original request revision. Mailbox stored in scoped browser-local storage, bounded/validated with deliberate overwrites, and source/stale-reply warnings. Actor labels are self-entered and **not authenticated**. No automatic exchange, shared server state, customer signoff, invoice, payment or source mutation. +2 W5; **31%**.
- **R34 ([PR #112](https://github.com/OJ-Holdings/oj-workspace/pull/112)):** One-handed internal closeout readiness in the exact source booking's Field Command. Operator sees source-count/booking-drift/duplicate-visit, arrival/departure, crew/material/travel/other cost coverage, water/PPE/runoff/chemicals/pump/hoses/WFP check states, and unresolved attention or stop-work issues with direct correction links. Private clipboard owner report includes only operator-entered estimates and explicit approval/settlement disclaimers. Nine behavioral tests passed in exact-head CI. No corporate job state, accepted price, invoice, signature, photo or bank write; localStorage only. Earned **+2 W5 points**, 27→29%.
- **R33 ([PR #109](https://github.com/OJ-Holdings/oj-workspace/pull/109)):** Read-only booking economics: actual original lead quote vs local estimate vs operator-entered cost; withholding comparison for incomplete booking coverage, multi-booking ambiguity, stale dates/status, unreviewed costs. Scenario != realized profit, approval, invoice, payroll or cash.

Relevant product files: `src/components/app/ExteriorCommand.tsx`, `ExteriorCustomer360.tsx`, `ExteriorIntakeDesk.tsx`, `ExteriorEstimateWorkbench.tsx`, `ExteriorFieldCommand.tsx`, `ExteriorJobEquipment.tsx`, `ExteriorJobEconomics.tsx`; pure projections/validation in `src/lib/exterior-*.ts`; source read/actions in `src/app/workspace/exterior-actions.ts`. Current UI routes: `/workspace/b/exterior`, `/workspace/b/exterior/customer?lead=<id>`, `/workspace/b/exterior/intake`, `/workspace/b/exterior/estimate?lead=<id>`, `/workspace/b/exterior/bookings`, `/workspace/b/exterior/field?booking=<id>`; `/preview/...` is fictional and read-only.

**Critical distinction:** most estimate details, field logs, equipment plans and fleet data are still **localStorage on the current device**. Oscar and Jacob do not yet share these revisions via verified server persistence. An export/import is manual. Legacy lead quote and booking records are real but a lead's historical `job_revenue`/`job_cost` cannot safely be assigned to each booking. Never treat null/missing financial information as $0.

## 5. Non-negotiable blockers and honesty rules

- **No new live Supabase quote/field/asset tables until** private recoverable production backup **and independent isolated restore evidence**, staging migration test, role/organization RLS and composite FK proofs, plus documented rollback. See quote version gate. At this snapshot that evidence was **not verified**, even though backup scripts exist.
- Session-bound Supabase client + `requireMember(org,true)` + database policies for real source access. No service-role keys in user-facing operations, no cross-tenant reads/writes, no personal/private STRATHOS access. Preview cannot mutate production.
- Preserve legacy SMS scheduler ownership; do not create duplicate text senders or automated customer messages, acceptance, bank collections, payroll or accounting reports from local drafts.
- A GitHub merge and green CI is **not proof of live deployment**: the exact commit being served by the OJ Windows host/Tailscale/Funnel and authentic iPhone use by both founders remain unverified. Do not say “deployed” without host-served SHA and runtime evidence.
- Invoice/payment settled, customer quote accepted, job completed, equipment physically inspected, and labor approved are each **distinct facts** requiring their own source/evidence.

## 6. Recommended next work (not already done)

**R37 (next release):** Prioritize the **real two-founder shared persistence blocker**. Verify actual encrypted production Supabase backup, independent isolated restore and member/viewer/outsider/RLS negative tests with founder-controlled credentials and zero new migrations until proof exists. R36 already delivered source-guarded dispatch readiness and corrected inflated booked quote totals. If backup/isolated restore remains blocked, investigate verified two-founder usage, mobile acceptance, and safe source-only workflow gaps without duplicating data or claiming synchronization. Review both founders' real mobile journey before assigning UI-completeness points.

**Primary infrastructure dependency:** Verify independently restorable encrypted Supabase backup and cross-org auth/RLS tests. Once verified, implement actual shared `quote_versions`, `quote_events`, `work_orders`, `field_events` and source-aware asset reservations with immutable snapshots, version conflict protection, idempotent writes and audit receipts. Do not mark synchronized state complete until Oscar and Jacob can see matching authorized records on separate devices.

**Subsequent:** Evidence-backed quote approval → atomic booked work order → crew/supplies/equipment/time and photo receipts → real invoice/collection reconciliation → customer/project lifetime view. Keep personal/private systems separate.

## 7. EVERY engineering pass must end with a GitHub handoff

1. **Before edits:** fetch actual main SHA, read this handoff + `AGENTS.md` + `docs/BUILD_PLAN.md`, inspect open PRs and related source. State the current verified full-program %.
2. **Implement:** bounded real user workflow, test unknowns/role isolation/source integrity. No demo-only/fake business state. PR with changed files, invariants, test and migration/deployment limitations.
3. **Verify:** exact PR HEAD full CI (install, typecheck, tests, build); squash merge only on success; confirm post-merge main CI and record its outcome accurately. If checks pending, say so rather than claiming passed.
4. **Update in GitHub (not just chat):** this canonical handoff (change *snapshot*, main commit, latest PR + CI IDs, earned % and next blockers), `docs/EXTERIOR_COMMAND_PROGRESS.md`, the newest-at-top release block in `docs/START_HERE_CHAT_HANDOFF.md`, `docs/ATLAS_V3_RELEASE_CHANGELOG.md`, and a newest-at-top entry in `AGENT_LOG.md`. One release may use a second docs-only PR; wait for CI to merge. Never claim that docs alone add progress.
5. **Tell user:** what genuinely works, PR links/SHAs, exact completed CI gates, whole-plan % and delta, preview/live differences, cross-device limitations, what remains unverified, and concrete next release.

**Never leave a completed release known only to an old conversation.** The most recent successful GitHub commit and this handoff are the next agent's primary continuity source.

## 8. Copy/paste prompt for a fresh chat

> Continue engineering the OJ Exterior Care **Exterior Command / ATLAS** system in GitHub repository **OJ-Holdings/oj-workspace** using the connected GitHub tools. Do not assume any prior chat context. **FIRST read** `docs/EXTERIOR_CONTINUE_HERE.md`, `AGENTS.md`, `docs/BUILD_PLAN.md`, `docs/EXTERIOR_COMMAND_PROGRESS.md` and the newest entries in `docs/START_HERE_CHAT_HANDOFF.md` and `AGENT_LOG.md`. Verify current `main` SHA, open PRs, CI and host deployment separately. The last documented release is **R36 at 34% of the full 12-wave plan**, but prefer live GitHub facts if newer. Continue implementing the **next useful, production-safe vertical slice** for Oscar and Jacob; mobile simplicity and real quote → booking → field work → job economics matter more than placeholder dashboards. **No production database schema changes** until private backup, isolated restore, RLS and rollback are verified. Run exact PR-head tests and production build, merge only after success, verify post-merge CI, and **update the canonical handoff, progress ledger, release changelog and AGENT_LOG in GitHub**. Report the total-plan percentage, increment, PR links, verified status and outstanding blockers in your response. Do the engineering rather than merely plan it.

---
Last human-requested maintenance of the handoff: October 23, 2026 (America/Chicago).
