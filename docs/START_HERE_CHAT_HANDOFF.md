# START HERE — OJ Workspace V2 Engineering Handoff

**Snapshot:** 2026-10-22 (America/Chicago). This is a **handoff snapshot, not a live status feed**. **Always re-check GitHub `main`, open PRs, current CI checks, production release receipt, and Supabase migration history before acting.** Do not infer that any pending item was merged after this snapshot.

## Copy/paste into a new ChatGPT session

> Continue **OJ Workspace V2** in **`OJ-Holdings/oj-workspace`**. First read this handoff, then independently check GitHub `main`, open PRs, exact-head CI and the Windows/Tailscale live release. Do **not** repeat already merged work: **Release 06** Commercial Bid War Room (#49, `e6274f43`), **Release 07** Founder Weekly Review (#50, `4f749b21`), and **Release 08** Systems Health & Releases (#51, `88dc16f9`) have merged to `main` after green PR-head CI. **Windows host deployment is NOT independently verified**; `/workspace/tools/systems` can compare the SHA of whichever app origin it is opened on, but it cannot establish scheduled task state, authentication, backups or separate hosts. The four-venture Supabase schema in draft PR #42 remains **unapplied/unmerged** pending a recoverable backup and isolated restore drill. Preserve all existing Auth identities and customer records; never bypass the CI/schema-guarded Windows updater, invent financial performance or trigger external messages, publishing, purchases, payments, or unsupervised migrations. Build genuinely useful OJ Holdings tools with isolated, reviewed PRs and green checks for Oscar and Jacob.

## 1. Repositories, stack and infrastructure

- **Canonical GitHub repository:** https://github.com/OJ-Holdings/oj-workspace
- **Canonical branch:** `main`.
- **At this snapshot, latest merged feature:** Release 08 (Systems Health & Releases, PR #51), commit `88dc16f983cdbdb4614d60772b0fe33543ad337e`. GitHub merge is verified; current Windows-host release is unverified.
- **Application:** Next.js 16 / React 19 / TypeScript; Supabase SSR, PostgreSQL with RLS; provider read views for GoHighLevel, Shopify and other authorized integrations.
- **Host:** user's Windows 11 machine running the OJ app on localhost port **3011**. Candidate smoke port **3012**. Tailscale Funnel advertised at `https://desktop-lbi2ein.tail3f006f.ts.net:10000`. Host and private Tailscale reachability require verification **on the user's PC**; GitHub CI green alone does not prove the public site is serving the commit.
- **Windows folders:** `C:\STRATHOS\apps\oj-workspace` (working source), `C:\STRATHOS\apps\oj-workspace-deploy-test` (updater checkout), `C:\STRATHOS\apps\oj-workspace-releases` (release worktrees/logs). Paths are as previously documented; verify before using. Keep other STRATHOS applications untouched.
- **Automated deployment:** Scheduled task **`OJ Workspace - GitHub Auto Deploy`**, nominal five-minute frequency, runs in the signed-in Windows user session. `scripts/auto-deploy-local.ps1` enforces GitHub green CI on the exact SHA, runs build/test checks, probes a candidate, swaps the running release, and supports rollback. It refuses schema/config changes including `supabase/`; do **not** weaken this protection.
- **Production health verification:** `scripts/verify-production-windows.ps1` can check `main` SHA against `http://127.0.0.1:3011/api/deploy-health`, and `-TriggerUpdater` invokes the existing guarded updater and polls for release health. Run on the host.
- **Supabase project ID:** `vgckpcktsfuithqggknd` (project display name historically "OJ EXTERIOR CARE LEADS"), Supabase **Free**, PostgreSQL **17**. Do not post passwords, customer PII or backup archives in GitHub or chat.
- **Login:** Oscar and Jacob already sign in through their existing authorized founder accounts. Jacob's password/access issue was resolved. **Never recreate, reset, or replace an Auth user to repair the dashboard without explicit authorization.**

## 2. Release history (verified GitHub merges at this snapshot)

| Release / PR | Merged SHA prefix | What exists |
|---|---|---|
| #26 | `1165ce82` | Executive Command and early commercial estimating UI |
| #27–33 | through `3bc25ade` | Guarded Windows/Tailscale GitHub auto-deployer and reliability fixes |
| #35 — V2 Release 01 | `9e32f58c` | Corporate Tools Hub, HQ Launchpad, hypothetical Business Scenario Lab |
| #43 — Release 02A | `9b71d67b` | Oscar Jacob read-only fictional studio preview; database persistence explicitly OFF |
| #44–45 — Operations | `1b9dc44b`, `e8e7bf5f` | Free-tier backup scripts, deployment verification, quieter superseded-PR CI runs |
| #46 — Release 03 | `0dcc9571` | Corporate Intelligence Desk, source-linked risks/tasks and top-three HQ briefing |
| #47 — Release 04 | `91b66ed7` | Validated, private, cross-device *file* transfer for commercial estimate drafts |
| #48 — Release 05 | `7449250d` | **Fleet Command + Rig Lab**: local asset register, maintenance log, readiness checklist, estimated payload calculator and private file interchange |
| #49 — Release 06 | `e6274f43` | **Commercial Bid War Room**: margin strategies, cost stress tests, site exposure and internal review export |
| #50 — Release 07 | `4f749b21` | **Founder Weekly Review**: same-weekday comparisons, accountable open tasks, CRM record creation, recorded finance caveats, ranked source-linked decisions and internal brief |
| #51 — Release 08 | `88dc16f9` | **Systems Health & Releases**: read-only same-origin release SHA versus public GitHub main, explicit unknown states, bounded polling, CI and Windows verification links |

These describe **merged, CI-tested code**. Actual host deployment is a **separate receipt**. User has reported that previous releases were working and auto-deploying, but a fresh host SHA cannot be inferred for later commits.

### Latest releases — merged, tested on PR heads; host still unverified

- **Release 06 (#49):** https://github.com/OJ-Holdings/oj-workspace/pull/49. Commit `e6274f43b6160082ab9ce8e1daa3ad706c0e8343`, PR-head CI run `39858289172` SUCCESS. Internal Commercial Bid War Room; no real proposal sent or customer approval.
- **Release 07 (#50):** https://github.com/OJ-Holdings/oj-workspace/pull/50. Commit `4f749b2199fc657522277f93bffe01bb32cc1aec`, PR-head CI run `39860483867` SUCCESS. Built `src/lib/founder-weekly-review.ts`, `src/components/app/FounderWeeklyReview.tsx`, CSS and tests. Accessible via `/workspace/tools/weekly-review` and HQ Launchpad; uses only loaded authorized data. Current task states are **not** interpreted as weekly completed tasks; finance entries are **not** verified cash/profit.
- **Release 08 (#51):** https://github.com/OJ-Holdings/oj-workspace/pull/51. Commit `88dc16f983cdbdb4614d60772b0fe33543ad337e`, PR-head CI run `39861436819` SUCCESS. Built `src/lib/release-health.ts`, `src/components/app/SystemsHealthDesk.tsx`, CSS and tests. Accessible via `/workspace/tools/systems`. The app reports the SHA of **the specific opened origin**; it does not reveal another host's process state. GitHub API failures and unmanaged builds display unknown/unverified status rather than a green check. Preview never probes live infrastructure.
- All three are **code-only**, without Supabase schema changes or irreversible external actions. Confirm actual `main` CI and user-hosted release separately. `scripts/verify-production-windows.ps1` on the Windows host checks exact `main` SHA against localhost port 3011; optional `-TriggerUpdater` invokes the already configured guarded updater. Do not claim production published until that check passes.

## 3. The overarching V2 vision

Build a premium, dense, mobile-accessible **corporate operating system for OJ Holdings**, not merely a CRM. Four operating areas:

1. **OJ Exterior Care** — residential and commercial exterior cleaning, leads/quotes/jobs/dispatch/crew/asset readiness/invoices/recorded payments and recurring customer service.
2. **OJ Solutions** — prospecting, demos, CRM, proposals, automation implementation, onboarding, service delivery/support, contract and recurring revenue evidence.
3. **OJ Essentials** — Shopify catalog/order/fulfillment/returns, true fees + COGS + advertising costs, evidenced contribution margins.
4. **Oscar Jacob** — collaborative video/media production (ideas → scripts/shot lists → filming → edits/review → manual publishing receipt → analytics/sponsorships).

Founders Oscar and Jacob need useful parity in day-to-day operations, with secure, tested role limitations on sensitive credentials, bank details, personnel, outside communications and irreversible actions. Optimize for operational decisions with traceable evidence. Differentiate **entered revenue from paid collections**, planned work from completed work, drafts from sent outreach, fictional preview from real production records, and hypotheticals from actual financials.

### Major roadmap capabilities (not all built)

- **Executive HQ 2.0:** decision inbox, approvals, role-specific priorities, cross-business objectives, founder meeting/review, activity/audit timeline, search and actionable agenda.
- **Fleet Command 2.0:** central synchronized fleet/assets and parts, recurring maintenance, fault logs, actual usage/costs, procurement links, rig visualization and verified payload specifications. *Release 05 currently uses browser-local data.*
- **Dispatch Command:** scheduled jobs, crews, service territory/maps, readiness, job site field workflow, check-in/out and quality closeout.
- **Commercial Bid War Room:** baseline estimator, file transfer and Release 06 scenarios/scope review are shipped in GitHub code. Later: versioned shared bid storage, inspections/photos, founder approvals, templates, proposal contracts, linked jobs and payments.
- **Corporate Treasury:** real payment state, invoices/expenses, bank reconciliation as authorized, cashflow and procurement, capital-allocation simulator, verified unit economics, accounting exports.
- **Solutions Command:** prospect-to-demo-to-client pipeline, GHL links, onboarding, client support, service health, renewal and earned recurring-revenue reporting.
- **Essentials Commerce:** sourced Shopify orders, landed COGS, fulfillment exceptions, actual ad spend, returns, supplier performance and product testing.
- **Oscar Jacob Studio:** persistent production data, file/version review, publishing receipt, analytics evidence, sponsorship/client work and video costs.
- **People & Organization:** founders, role-based access, employee dispatch/time/commissions/training, documented decisions.
- **Procurement & Asset Vault:** request → review → approved vendor → purchase evidence → asset; subscriptions/warranties/parts.
- **Marketing & Growth:** LSA/outreach/conversions/campaign evidence, experiments and referrals.
- **Strategy/Intelligence Lab:** audited source-linked alerts and hypothetical/actual distinction, scenario comparisons, capacity and expansion decisions.
- **Automation/AI Workbench:** explicit user-started, bounded, reversible/dry-run internal workflows with permission checks, receipts, stop/pause/resume and cost limits. **No autonomous business execution by default; never contact customers or spend without authorization.**
- **Systems Control and Mobile Field HQ:** Release 08 offers release-ID comparison only; full host/provider/backup monitoring, mobile field capture and offline-draft workflows still require implementation.

Rough progress estimates discussed with the user (25–30% of an expanding roadmap) are **subjective, not verified release-completion percentages**.

## 4. Persistent database gate — critical unresolved blocker

**PR #42 is a draft:** https://github.com/OJ-Holdings/oj-workspace/pull/42

It contains the **proposed, NOT production-applied** fourth-business registry and Oscar Jacob content schema at `supabase/pending/V2-four-business-content-foundation.sql`, with isolated PGlite role/tenant isolation tests and a supervised release runbook. It includes mixed schema/application changes and **must not be merged into the unattended Windows auto-deployer**. Its code-only companion was deployed as a **read-only preview** in #43 with `contentPersistenceEnabled=false`.

**Backup context:**
- Supabase Free has no platform-managed daily database backups. A read-only production audit measured database size around **16 MB**, which is **not** a backup.
- `scripts/backup-supabase-windows.ps1`, `scripts/install-supabase-backup-task.ps1`, and `docs/BACKUP_FREE_TIER_WINDOWS.md` exist on `main`. They offer a **founder-run** PostgreSQL 17 `pg_dump` using a session pooler, DPAPI-bound credential, private local filesystem permissions, manifest/hash and `pg_restore --list`. An optional scheduled task can be installed under the same signed-in Windows user.
- **The archive itself is not encrypted**: use an encrypted local/off-device volume. Custom pg_dump archives do **not** include Supabase Storage object bytes or all global Postgres roles.
- **Not yet verified:** user has actually configured, run and checksum-verified a database backup, copied it to protected off-device storage, and successfully rehearsed a restore in a separate compatible environment. `pg_restore --list` is not proof of recoverability.
- Before shared-DB content, fleet or bid migrations: confirm correct backup/export scope (including Storage objects if used), exercise an isolated restore, reconcile actual applied migrations, snapshot record counts, independently review RLS and `SECURITY DEFINER` grants, and only then apply reviewed **manual** schema changes.
- After a supervised migration, merge a separate **code-only** flag/onboarding change that enables persistent fourth-business functionality. Run current CI, host health check, both-founder write/read tests and negative viewer/outsider permission tests.
- Do not run migration SQL based solely on CI success, data smallness, or user enthusiasm. **No destructive or direct `auth.users` mutations.**

## 5. Previously audited production baseline (historical; re-check before relying)

Supabase read-only SQL in this program previously established approximately:
- `public.leads`: **177** Exterior lead records; 71 completed. Of completed: 54 contained recorded `job_revenue`, 11 direct `job_cost`. This does **not** prove 54 paid jobs.
- `public.bookings`: **37**, all marked confirmed at audit; bookings are not collections.
- `public.oj_cards`: **28** shared tasks (2 unassigned).
- `public.oj_outreach_prospects`: **80** prospects; `oj_outreach_activity`: **0** at audit; null overrides do not establish an unsent outreach attempt.
- `public.oj_finance_entries`: **0**; `oj_documents`: **2**; `oj_work_sessions`: **12** at audit.
- Two founders had `owner` memberships in `public.oj_memberships`.
- Three-business CHECK constraints existed across cards, documents, events, finance, messages, metrics, leads and work timers.
- Security lint surfaced security-definer/RLS warnings requiring body/grant review; warnings alone do not establish a vulnerability.

These are **dated baseline counts** and must never be presented as fresh current accounting or production totals.

## 6. Collaboration, release and security invariants

1. **Inspect first.** Fetch source files, current `main`, open PRs, tests and CI runs before editing. Do not duplicate pre-existing modules or overwrite another agent's active branch.
2. Use an isolated feature branch and a reviewable PR for functionality. Check exact ref/commit before writes. Keep `supabase/`, environment and production config separate from code-only auto-release changes.
3. Require `npm ci`, typecheck, automated tests and production build; add regression coverage for tenant isolation, role permissions, financial math and no accidental external effects.
4. A passed PR check is not a passed `main` check, and neither proves the Windows host deployed. Verify squash tree equality where relevant; then `main` CI, then `/api/deploy-health` from the PC, then founder/browser behavior.
5. Never leak customer details, user tokens, connection strings, database backups or imported personal business data into GitHub issues, docs or logs.
6. UI should disclose missing data, capped provider coverage, hypothetical results, manual publication links, and local-only storage. No invented "active" or "paid" values.
7. Shopify and GHL existing source integrations have coverage/pagination limitations; don't treat a partial fetch as global truth.
8. Existing employee/owner role boundaries, internal review/approval, live intake, and outward messaging must continue working.
9. Do not fabricate a recovery/backup success, deploy receipt, user acceptance test, or production feature that has not been observed.

## 7. Useful code and documentation map

- `src/components/app/App.tsx`, `Shell.tsx`, `HomeView.tsx`, `VentureView.tsx` — app routing, shell and business UI.
- `src/lib/ventures.ts`, `board.ts`, `dashboard.ts`, `metrics.ts` — business registry/types/tasks/source-ledger.
- `src/components/app/CorporateTools.tsx`, `src/lib/corporate-tools.ts` — discoverable tools and executive HQ launcher.
- `src/components/app/CorporateIntelligence.tsx`, `src/lib/corporate-intelligence.ts` — deterministic HQ briefing, source-linked risks.
- `src/components/app/ScenarioLab.tsx` — hypothetical business economics.
- `src/components/app/FleetCommand.tsx`, `src/lib/fleet-command.ts`, `src/styles/fleet-command.css`, `tests/fleet-command.test.ts` — **live merged code**, local-only fleet and rig planning.
- `src/components/app/CommercialDesk.tsx`, `src/lib/commercial-estimate.ts`, `src/lib/commercial-transfer.ts` — existing estimator and portable file workflow.
- **Merged PR #49:** `src/lib/commercial-war-room.ts`, `src/styles/commercial-war-room.css`, `tests/commercial-war-room.test.ts` and CommercialDesk integration.
- **Merged PR #50:** `src/lib/founder-weekly-review.ts`, `src/components/app/FounderWeeklyReview.tsx`, `src/styles/founder-weekly-review.css`, `tests/founder-weekly-review.test.ts`.
- **Merged PR #51:** `src/lib/release-health.ts`, `src/components/app/SystemsHealthDesk.tsx`, `src/styles/system-health.css`, `tests/release-health.test.ts`; no new server endpoints.
- `src/components/app/ContentStudio.tsx`, `src/lib/content-studio.ts`, `src/app/workspace/content-actions.ts` — Oscar Jacob UI and gated write actions.
- `scripts/auto-deploy-local.ps1`, `scripts/verify-production-windows.ps1`, `docs/DEPLOYMENT.md` — real Windows release sequence (some older docs may mention Netlify; verify actual host).
- `docs/BACKUP_FREE_TIER_WINDOWS.md`, `docs/V2_CONTENT_SUPERVISED_RELEASE.md` (latter in PR #42) — backup/restore gate, supervised schema release.
- `docs/OJ_WORKSPACE_V2_MASTER_PLAN.md` and `docs/OJ_V2_CORPORATE_COMMAND_CENTER.md` on branch `planning/v2-four-business-operating-system` / **open PR #34** — high-level capability blueprint.
- `docs/WORKSPACE_UPGRADE_ROADMAP.md` — older 2026-10-19 improvement plan; some findings and counts can be stale.
- Existing issues #36–41 partition production security, fourth-business persistence, Oscar Jacob production, HQ, linked operations, automation/hardening.
- Other historical open work includes PR #17 (calendar): check before touching calendar implementations.

## 8. Suggested next engineering sequence

1. **Verify live deployment of Releases 06–08**, not merely GitHub merges. From Windows OJ Workspace repo run `scripts/verify-production-windows.ps1`; invoke the existing guarded updater with `-TriggerUpdater` only as intended. Confirm actual returned `main` SHA, rollback state, founder sign-ins and mobile smoke. The newly added `/workspace/tools/systems` is useful after deployment but is not a substitute for Windows-local verification.
2. **Resolve P0 Supabase Free backup/restore evidence** without weakening protection: manual private pg_dump/checksum, verify archive, independent restore rehearsal, limited role/RLS and record-count checks. No production SQL or Auth changes until this gate is satisfied.
3. **Ship more founder-visible, code-only operating value** while migrations remain blocked: clearer daily action/inbox triage, booking/dispatch and commercial bid review, mobile workflow UX, and evidence/coverage gaps. Avoid duplicating Intelligence, Weekly Review, Fleet or Systems status.
4. **After supervised additive migration**, enable secure four-business Oscar Jacob persistence and shared, versioned commercial bids/fleet records; prove two-founder concurrent editing and negative viewer/outsider access.
5. Expand fleet-to-dispatch maintenance allocation, Solutions prospect-to-client delivery, Essentials landed margins, treasury reconciliation, documented approvals, and bounded opt-in automation in small independently reviewable releases.


**Core user direction:** continue implementing *ambitiously*—create genuinely useful new corporate tools, not just cosmetic overhauls. Communicate major shipped milestones, next backlog, blockers and honest deploy status succinctly. User prefers tangible code and green deployments to endless planning.

---

**Handoff integrity check:** this document is a GitHub-persisted context aid only. It neither applies pending SQL, modifies customer data, nor verifies current Windows site availability. Verify every dated claim when resuming work.
