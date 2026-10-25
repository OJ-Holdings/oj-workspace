# Exterior Care — founder's 12-page field usability audit

**Recorded:** 2026-10-25. **Priority:** founder's observed operation on a real mobile/desktop UI, not a speculative design exercise. **Evidence source:** the founder-supplied 12-page PDF titled "exterior care audit.pdf"; the screenshots are intentionally NOT checked into the public repository. Page numbers below refer to that source. User observations are credible bug reports, **not yet independently reproduced or diagnosed**. Do not mark a fix complete because a component exists or CI is green.

**Product direction:** OJ Workspace must feel like a first-party command center for running Exterior Care, not a generic SaaS analytics portal or an engineering diagnostics dashboard. Founders should book jobs, see price and payment status, manage a customer, identify and assign an employee, and progress a commercial relationship with minimal reading. Decorative KPIs are welcome **only when they show genuine, comprehensible business data**.

## Acceptance register — one issue per founder screenshot observation

| ID | PDF page | Founder observation | Required outcome / reproducible acceptance criterion | Triage |
|---|---:|---|---|---|
| FA-01 | 1 | Desktop-width tabs extend too far to see on a phone. | At supported phone viewport widths, every primary destination is discoverable without horizontal page scrolling or disappearing tabs; navigation remains reachable with one hand; check both founder phones. | P0 |
| FA-02 | 2 | Growth/Pipeline does not show current leads. | Compare all displayed lead counts and stages against the authorized original lead rows for the exact company and same filters/date window; no unexplained zero or missing stage. Show loading/coverage/error honestly. | P0 |
| FA-03 | 2 | Recent accomplishment/job entries omit money for the job. | From the job card/row, show the exact original visit's recorded price or recorded job income where known, distinguish quote from completed-job revenue and amount received; provide route to edit missing fields. | P0 |
| FA-04 | 3 | "Some sources need review" connection diagnostics are on the operator surface. | Put detailed source diagnostics and setup under Settings > Connections. Surface only a short contextual error on an action that truly requires an unavailable source; never hide a real failure or fake a healthy source. | P1 |
| FA-05 | 3 | Team at Work does not work. | Reproduce on each founder account; show only actual assigned and check-in/work-session state. Provide an actionable task/crew entry point and accurate empty/error states. Do not invent "working now" telemetry. | P0 |
| FA-06 | 4 | "See what could disrupt the next job" is low-value as a large dashboard block. | Move verified job-specific exceptions next to the affected job; minimize or eliminate dashboard card until it causes a concrete decision. Preserve meaningful safety/conflict detection. | P1 |
| FA-07 | 4 | "Assign the next step" is a largely unhelpful, text-heavy secondary panel. | Embed one actionable assignment in the relevant job/customer flow; remove duplicate page-length explanatory text or redundant standalone panel. | P1 |
| FA-08 | 5 | Booking/upcoming summary duplicates other sections. | Keep one authoritative upcoming schedule and a small accurate summary; remove repeated same-metric tiles and always identify which visit set is counted. | P1 |
| FA-09 | 5 | "Field production" / "Field session" / "Build session" purpose is unclear. | Make a clear phone-first "Open job" > "Start work" > "Log work" > "Finish" flow attached to a specific original booking. If not backed by shared data, flag as not operational rather than adding another abstract session hub. | P1 |
| FA-10 | 6 | "Qualified confirmed quotes" label has no useful meaning to founders. | Replace with plain-language, source-backed quote stages (draft, sent, awaiting response, accepted only with verified evidence); don't display unknown or fake counts under a confident label. | P1 |
| FA-11 | 7 | Big "booking-linked assignments" card is confusing and redundant. | Embed work assignments under the actual scheduled job and show employee, action, due time and current state; no vague zero-count dashboard card. | P1 |
| FA-12 | 8 | UI reports missing job income while most jobs appear to have it. | Audit each warning's query, status scope and revenue field against actual original visits. Separate historical lead quote, recorded completed-job income, invoice and collected cash. Every missing-money warning must identify the exact job/field and be reproducible; fix false positives without reclassifying quotes as cash. | P0 |
| FA-13 | 9 | Too much hand-holding / instructional prose. | Use task-first headings and concise labels. Move explanations to optional info/tooltips or relevant error/approval step. Ordinary use should not require reading development notes. | P1 |
| FA-14 | 10 | Commercial Desk is filled with "internal planning only" disclaimers and import/export controls; not field ready. | Primary actions should be Save automatically, Estimate, Properties, Schedule/Jobs where supported. Place recovery/export under Settings or unobtrusive overflow; keep legally/financially necessary warnings contextual. Never claim unsupported send/accept/pay operations exist. | P0/P1 |
| FA-15 | 11 | Need commercial companies with logos and all their different properties. | Persistent organization-scoped commercial **account**: company name/logo, contacts, billing/service preferences, multiple properties/buildings and responsible relationships. Each property has site notes, scope and visits. Protect logo uploads and private contact details. | P1 product |
| FA-16 | 11–12 | Whole commercial project in one tab is overwhelming and feels "SaaS-y". | Replace long single-column desk with a compact account overview and separate client, property, estimate/version, job/recurring service and money views; phone-first, not another duplicate dashboard shell. | P1 product |

## U0 first code pass — PR #154 (not yet founder accepted)

[PR #154](https://github.com/OJ-Holdings/oj-workspace/pull/154) implements the founder's first evidence-backed corrections. Code head `d070c2948852a095987fff2756285df3c3953b3b` passed [exact-head CI #40225293015](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40225293015): tests/typecheck/build/dependency audit, synthetic PG17 private recovery, and PG17 RLS actor tests. No production schema, browser records or customer records were changed.

| Issue | Code finding and correction | Current acceptance |
|---|---|---|
| FA-01 | Original mobile Exterior five-tab strip used horizontal overflow; changed to all-visible responsive grid. | **Code implemented; founder phone/viewport not yet verified** |
| FA-02 | Corporate Growth counted distinct `oj_leads` CRM but hid original Exterior `leads` already available as `openElsewhere.exterior`. Now show separate original Exterior open-source count with partial/unknown coverage, and clear CRM separation. | **Code implemented; actual lead IDs/counts not yet reconciled** |
| FA-03 | Completed customer records showed only quote. Cards and table now also show recorded `job_revenue`, with explicit `$0` correctly treated as recorded. | **Code implemented; actual visits and returned-client paths not yet checked** |
| FA-05 | Live Team at Work presence needs separate unactivated `presence.sql` tables. Show real existing shared task-board assignments for uniquely named members instead, never an invented online/check-in state. | **Partial: assignments implemented; live presence and two-founder testing outstanding** |
| FA-12 | Historical `job_revenue` was inaccurately called "payment"; missing-value chip used null-only logic, while KPI validation required finite nonnegative amounts. Now share the field validator and label revenue/unknown truthfully. | **Code implemented; production source-versus-finance warning still needs real-record verification** |

These fixes require an actual served Windows SHA check and both founder-device acceptance before FA statuses can be closed. No weighted master score increment from CI alone: **42/100 unchanged**. Commercial data PR #150 and local recovery UI PR #151 remain independent and unmerged; PR #150 still requires owner-approved production recovery/migration.

### Interpretation discipline

- **User-reported symptom**: all FA-01 through FA-16. **Root cause / confirmed resolution:** not independently established by the PDF. Reproduce against the current actually served Windows SHA and signed-in roles before coding a purported fix.
- No existing chart value is automatically proof of cash collected. Do not relabel recorded lead/job figures as settled receipts or suppress legitimate accounting gaps.
- Removing redundant panels does not authorize removal of RLS, source-drift detection, audit receipts or confirmation checks. Keep the safeguards; **remove the clutter**.
- The original file depicts particular screens at a particular point in time. A green unit-test/Next build does not prove those screens have changed on the host or founder devices.

## Reprioritized delivery — usability correction before more standalone features

**U0: Truth and operator blockers (next immediate sprint).** Reproduce FA-02, FA-03 and FA-12 against an authorized, scoped source snapshot and write deterministic discrepancy cases, then repair queries and job-level money affordances. In parallel fix FA-01 mobile overflow and determine what prevents FA-05 real Team at Work operation. Verify actual Windows served SHA before judging deployed fixes. No new speculative intelligence cards.

**U1: Reduce navigation and prose.** Address FA-04 and FA-06–FA-14 by consolidating exceptions into Jobs, assigning team work inside a real booking, moving recovery/connection diagnostics to Settings, shortening copy and dropping redundant KPIs. Preserve visible status when source data is missing or a risky action requires confirmation.

**U2: Genuine Commercial Accounts product.** Address FA-15 and FA-16 using company -> contacts -> properties -> separate estimates / site scopes -> accepted visits -> field service -> invoice / collection relationships, staged by actual permissions and available schema. Commercial Project 360 PR #150 is a **persistence substrate**, not a completed account/property product. Do not create competing customer tables or claim sent/accepted proposals without trusted evidence.

**U3: Team/field adoption.** Connect exact scheduled visits, actual assigned people, check-ins/work sessions, equipment, evidence, owner closeout, and mobile behavior. Jacob's first-screen workflow should prioritize today's assigned job, not deep analytics.

**U4: Useful intelligence only.** After verified lead/job/revenue coverage and shared field/work data exist, show actions, true per-visit margin and cash reconciliation. Defer speculative NEXUS/Command panels. Perform the mandated second founder critique before resuming broad feature creation.

This is a **priority overlay** within the existing Integration & Adoption P1–P7 and original 12-wave 100-point master plan, not a new percentage score or permission to skip critical recovery/security.

## Data definitions required for U0 acceptance

| Display | Source and meaning | Must not infer |
|---|---|---|
| Lead pipeline | Current authorized lead rows, status and explicit time range, with visible coverage | Missing lead = zero pipeline without source reconciliation |
| Estimate / quote | Proposed price on a lead or a specific immutable quote version | Customer sent/accepted, invoiced or paid |
| Job price / recorded job income | Price attached to the exact scheduled/completed visit with source/provenance | Bank-confirmed collection |
| Invoice/AR | Separate issued invoice and amount still due (only once implemented) | Historic quote = invoice |
| Collected cash | Reconciled payment or explicit verified settlement evidence | Recorded job revenue = bank deposit |
| "Missing income" exception | Identified exact eligible visit and missing required source value | Blank quote on a different visit proves this job unpaid |

An acceptance test must compare the same records, company, statuses, date window and amount semantics across Jobs, Home, Growth, Money and Command.

## Current GitHub delivery state — 2026-10-25 checkpoint

- **main**: 69f9ff5eb95210d632b2a3f97e4f81be0157e4a1; latest checked main CI 40190080605 succeeded. **Weighted 12-wave engineering score: 42/100**, no added points.
- **Commercial persistence PR #150**: open, head 6f54f9ce068fac5b55c6397eaf6a2633a2f6c6ad; exact-head CI 40219067828 succeeded. Implements proposed tenant-scoped project rows, immutable estimate versions, private costs, safe saves and Project 360/NEXUS consumption. **NOT merged or deployed**; executable production migration needs actual private recovery, Storage bytes, actor checks and explicit owner approval. Additional owner-side Windows work may be underway; recheck its branch before touching.
- **Residential recovery PR #151**: open, head ef54c46165cae22a7fde0745bb8cc6a4df9b541b; exact-head CI 40215126590 succeeded. This adds a checksummed browser-local residential vault but **does not solve shared persistence**. Given FA-14 and the founder's explicit rejection of import/export-first UI, do not treat its prominent primary-screen controls as an accepted product design; keep under review for recovery-only relocation or deferral. Do not merge as a presumed usability fix.
- **P3 shared quote/work-order core**: R50 is merged but still a read-only, source-identity-guarded backend with privately staged write SQL; production P3 tables aren't activated, and Residential Estimating/Jobs aren't yet linked to live permanent quote versions.
- **Actual operational gates still outstanding based on Codex's branch inventory**: founder-private encrypted real Supabase database backup; independent protected off-host copy; separate Supabase Storage object byte backup; actual isolated source restore/parity; founder actor RLS negative checks; two-device acceptance; validated Windows served SHA. PostgreSQL tooling/synthetic mechanics in Codex's branch do not satisfy real-source recovery. No production database or browser draft writes were performed by this planning pass.
- **Other open PRs**: #42 historical broad V2 migration (hold), #34 corporate HQ V2 plan, #17 iPhone calendar link. Their existence is not proof of activated functionality.

## Required exit evidence for EACH audit issue

1. **Reproduction:** original founder screenshot/page, exact affected UI route, signed-in role, viewport/device, actually served SHA, company and source date/coverage. Do not put confidential customer details in Git.
2. **Underlying cause:** a concrete data query/field mapping, interaction, missing permission, breakpoint, or redundant component—not a design guess.
3. **Change:** focused code PR and realistic unit/integration tests for the affected behavior, preserving earlier security and data history.
4. **Real acceptance:** founder can perform the intended job on mobile, consistent cross-device results with Jacob where shared state is required, no horizontal hidden nav and no misleading monetary claims.
5. **Status:** NEW / REPRODUCED / IMPLEMENTED IN PR / MERGED-CI / DEPLOYED-TESTED / FOUNDER-ACCEPTED. **No FA item is automatically "fixed" at this checkpoint.**

## Coordination rules

- Codex: machine-only evidence, host state, deployer, actual browser-origin drafts, encrypted backups and true isolated restore. No public secrets, no automated live migration.
- Repository implementers: accurate KPI source reconciliation, mobile interaction repairs, Commercial Account design and data contracts, practical field/crew flows and CI.
- Keep PR #150's SQL migration separate and gated; no permission implied to merge #42 or apply production DDL.
- The canonical starting points remain EXTERIOR_CONTINUE_HERE.md, EXTERIOR_COMMAND_PROGRESS.md and EXTERIOR_INTEGRATION_ADOPTION_PROGRAM.md. This audit is their founder-facing acceptance contract.
