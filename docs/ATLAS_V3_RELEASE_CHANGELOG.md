# ATLAS V3 — Engineering Release Notes & Status Ledger

> Snapshot: **2026-10-23, America/Chicago**. Recheck GitHub main, active PRs, CI and the exact Windows-host release before asserting present tense status.
> Product direction: [ATLAS V3 Master Blueprint](./ATLAS_V3_MASTER_INDEX.md) · [30-wave plan](./ATLAS_06_EXECUTION_ROADMAP.md).
> ATLAS V3 planning documents contain extensive **proposed** features, not claims of already shipped products.

## Exterior Release 50 — authenticated read graph and private quote-save command (October 25, 2026)

**Feature:** [PR #148](https://github.com/OJ-Holdings/oj-workspace/pull/148), exact feature head `3ddbeebc27db3c9f608e57bb24e2bb3eeff82537` [CI #40189504342](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40189504342) **SUCCESS all three jobs**, merged `923bee2ca98e263b9dffc310ad3687606f93c678`. Feature merges P3.0 business contract with P3.1 staging relational schema by introducing a callable authenticated **read-only** P3 booking graph and a separate **staging-only non-exposed** transactional quote-save function.

### Implementation
- `src/lib/exterior-p3-data.ts`: exact original booking+lead, org-scoped explicit legacy link, customer/property, exact-visit opportunity, quote/latest immutable version, planned work order; refuse unlinked original source and mismatched tenant/visit/duplicate order/cost-field injection. Re-read booking/lead/quote to reject ordinary concurrent changes. No inferred customer approval, dispatched crew, paid invoice or source fallback.
- `src/lib/exterior-p3-db-read.ts` + `src/app/workspace/exterior-p3-actions.ts`: owner/member authenticated cookie-session read with database RLS and exact IDs. No service-role key, no browser authorization logic, and no pretending missing staging tables are empty records. The read action is **not wired into the commercial/residential user workbench yet**.
- `supabase/staging/exterior-p3-private-command.sql`: SECURITY INVOKER PostgreSQL 17 transaction in `oj_private` with **no EXECUTE privilege for anon/authenticated/PUBLIC**. Requires current owner/member actor, binds actor to the session, locks the quote row, checks expected revision, inserts one immutable public quote version or replays the same command idempotently. Rejects altered replay, concurrent stale changes and quote append after any work order has been issued. Existing staging trigger now also refuses privileged post-work-order append.
- `tests/exterior-p3-data.test.ts`: 14 read/source/tenant/concurrency regression tests. The existing synthetic PostgreSQL 17 staging test runner now executes positive and negative real SQL transaction cases, including active member, viewer, actor impersonation, no Data API privilege, replay and immutable issued scope.

### Operational boundaries and next implementation
No production SQL/migrations, customer messages, actual accepting signature, trusted provider authentication, live quote inserts, finance/AR or equipment/dispatch changed. The private SQL function **cannot authenticate its own originating database session or the original lead source**; future P3.2 must build a controlled tenant-safe trusted server adapter that validates member/session, original booking status and lead source, quote hash and connection privilege before invoking private functions, with a separate external customer acceptance verifier.

P2 still gates any production migration: actual founder-held encrypted database + independent off-host mirror, isolated real restore, Storage file bytes, authenticated role tests and rollback. Keep legacy PR #42 blocked. **Master engineering 42/100 (+0)** until a durable synchronized workflow reaches both founders. Once P2 is satisfied, P3.2 should connect existing Estimate and Jobs tools to the new data graph; commercial browser-local portfolios and fleet/field data migration should follow without destructive reset.

[Detailed R50 release record](./EXTERIOR_R50_DATA_ACCESS_RELEASE.md).

## Exterior Release 47 — Source-Aware Next-Action Drafts

**Release 47 / P1.4**: [PR #138](https://github.com/OJ-Holdings/oj-workspace/pull/138) merged as `854dffc3ea7d3b0f5cc99abd6ecf8513694e92fd`. Exact tested feature head `0e6c69f09ac132db0d09961e41bcf70d672148f5` passed [CI #40149279797](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40149279797) (TypeScript, complete tests, Next production build and synthetic PG17 restore). Exact original Booking → Job Continuity now produces up to four deterministic INTERNAL next-action drafts from current source-reviewed booking, customer, visit-quote and crew evidence. Explicit **Prepare task** fills only the editable assignment form; actual publishing still requires selecting a current member, confirmation and authenticated original-booking server checks. Existing identical active tasks are labeled instead of duplicated. Stale, denied, unrelated and partial-task sources suppress suggestions. Not artificial intelligence inference of invoices/dispatch/field completion.

**Security Release 48.1 CI guard proposal:** a new explicit `npm audit --audit-level=critical` step after `npm ci` blocks future known critical advisories during GitHub CI. It does not replace code review, real signed-in RLS negatives, secure hosting, patch monitoring or a production disaster-recovery drill. **No schema, customer records, real paid cash, contact messages or production recovery were touched.** Roadmap **42/100 remains unchanged**, as the two-founder task/comment roundtrip, current Netlify/Funnel served SHA, private encrypted production archive + independent mirror, isolated real restore, Storage object bytes, actor RLS/rollback and PR #42 migration gate are still unverified.

## Security Release 48 — Patch Critical Next.js Advisories

**Release 48 security remediation**: [PR #139](https://github.com/OJ-Holdings/oj-workspace/pull/139) merged as `9a5c5c21909eb9516761f8d96154f559f14763fe`. Upgraded Next.js **16.3.8 → 16.4.1** with `npm install` regenerated lockfile and `sharp` **0.35.5**, addressing the [official October 14, 2026 critical RCE and DoS notices](https://nextjs.org/blog/nextjs-security-update-october-14-2026). Exact feature-head [CI #40149496633](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40149496633) passed TypeScript, full tests, production build and synthetic PG17 restore; `npm ci` reported **0 known vulnerabilities at that point in time**. Temporary networked lockfile-generation workflow was removed from final PR (only package.json and package-lock.json changed). This is dependency remediation, not a universal security certification.

**Security Release 48.1 CI guard proposal:** a new explicit `npm audit --audit-level=critical` step after `npm ci` blocks future known critical advisories during GitHub CI. It does not replace code review, real signed-in RLS negatives, secure hosting, patch monitoring or a production disaster-recovery drill. **No schema, customer records, real paid cash, contact messages or production recovery were touched.** Roadmap **42/100 remains unchanged**, as the two-founder task/comment roundtrip, current Netlify/Funnel served SHA, private encrypted production archive + independent mirror, isolated real restore, Storage object bytes, actor RLS/rollback and PR #42 migration gate are still unverified.

## Reliability Security Release 48.1 — CI Fails on Critical Dependency Advisories

**Security Release 48.1 CI guard proposal:** a new explicit `npm audit --audit-level=critical` step after `npm ci` blocks future known critical advisories during GitHub CI. It does not replace code review, real signed-in RLS negatives, secure hosting, patch monitoring or a production disaster-recovery drill. **No schema, customer records, real paid cash, contact messages or production recovery were touched.** Roadmap **42/100 remains unchanged**, as the two-founder task/comment roundtrip, current Netlify/Funnel served SHA, private encrypted production archive + independent mirror, isolated real restore, Storage object bytes, actor RLS/rollback and PR #42 migration gate are still unverified.



**R46 / P1.3** [feature PR #136](https://github.com/OJ-Holdings/oj-workspace/pull/136) merged as `27eab63df26f36568fc9b5d8846e38e3fde8eb78`, tested PR head `fad67a1059e7ad1723637e642f99d304988a0c26` on [CI #40147395179](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40147395179), both app checks (TypeScript, automated tests and Next build) and synthetic isolated PostgreSQL 17 recovery SUCCESS. The existing Bookings → Job Continuity and private Field → Company Tasks can now load older member-RLS `oj_cards` source rows (100 at a time) for the **exact original booking**, using a 1,000-row safety cap and reject-on-count/source/offset/duplicate checks. Each task has voluntary member-authenticated, per-task `oj_comments` history (50 at a time, 1,000 cap) with author names resolved under current membership and protected exact job+lead record checks. Both screens progressively reveal ten task records at a time. Source totals are not guessed when unavailable, and note paging can be unavailable at incomplete source boundaries. These are retrieval improvements, **not an atomic snapshot**, durable work orders, field evidence, crew dispatch or finance.

**Scope and acceptance:** No new SQL, production DDL, customer messages, payment, staff assignment, field file upload or production customer-data writes. Your earlier iPhone screenshot reported R44 SHA on one phone; it is **not evidence** of R46 served Netlify/Funnel release, Jacob's independently authenticated task/comment roundtrip, private real production backup/isolated restore, signed actor RLS or Storage byte recovery. PR #42 remains blocked. Keep full 12-wave engineering at **42/100 (+0)**: read-path refinement earns no separate wave milestone or device acceptance point.

## Exterior Release 45 — Honest Internal Job Task State and Source Coverage

**R45 / Integration P1.2** [PR #134](https://github.com/OJ-Holdings/oj-workspace/pull/134) merged at `d0a4c22e8cbd449a961497dfcc2d3441b2992fc3`; tested head `3251309e4c7292419b7df6e4edf4eead8f580a1c` passed [feature CI #40144860067](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40144860067): TypeScript, all 655 tests, production build and separate synthetic PG17 restore. Post-merge main CI requires independent confirmation. Shared exact-job task creation, status and comments now have the same server-enforced `confirmed` / `pending_approval` booking-state gate (pending means INTERNAL review, not dispatch confirmation); the field copy refuses stale actions too. Company member and comment-author identity pages must be source-complete, and task/comment partial source windows are visibly marked; no more misleading zero-task messages on incomplete pages. No DDL, customer messages, bank writes, private field sync or production data changes.

**Founder observation:** A screenshot provided in chat on October 24 showed one founder iPhone's same-origin checker reporting `0d1bbdf6fa8bf9c0c71326b43ce5afcddcb903a9`, matching GitHub `main` at that earlier R44 checkpoint. The screenshot did not show the browser hostname or a sanitized copy, and it does not demonstrate current R45 hosting, Jacob's separate account, cross-device persisted task/comments, real backup restore, Storage bytes or RLS actor matrix.

**Roadmap: 42/100 (+0)** under the same 12-wave accounting. Production release parity after the merge and two independent authenticated phones remain unverified. Safe schema-free hardening does not satisfy independent encrypted production database recovery, real member-role RLS negatives or file-byte restoration. Do not merge PR #42.

## Exterior Release 44 — Verify the Actual Served App (Integration P2)

**Feature:** [PR #132](https://github.com/OJ-Holdings/oj-workspace/pull/132) merged `main` at `492b68687c5f6ade237118bac5d823480c4f1a97`. Exact head `e00022d5f57e6bbc229ace607fff38a7dd74fa2f` passed [CI 40141928898](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40141928898) with PowerShell trust-refusal tests, TypeScript, full tests, production Next build and synthetic PG17 restore. Post-merge [main CI 40142096003](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40142096003) completed SUCCESS in both jobs.

**Problem corrected:** The repository documents both independent Netlify cloud hosting and the older Windows/Tailscale Funnel. The original release endpoint only supported Windows-injected commit identity, so the current published app could report "unmanaged". R44 now accepts only a valid, unambiguous 40-character Windows, Netlify or Vercel commit identity, never a raw invalid environment value.

**Practical founder check:** An optional, mobile-friendly version checker is embedded in the existing exact original booking Job Continuity; each founder explicitly requests only a same-origin read-only release SHA, may copy a sanitized local manual observation, and sees UNKNOWN when unverified. A new Windows helper independently checks GitHub main against explicitly allowlisted OJ external origins: Netlify cloud requires public identity while Funnel requires both loopback and HTTPS parity. Offline PowerShell tests refuse suspicious hosts, stale/invalid/missing releases and invented actor/recovery acceptance; CI runs them. [P2 founder runbook](./EXTERIOR_R44_RELEASE_EVIDENCE.md).

**No new DDL, no customer/booking writes, no release or backup approval.** Both real founder phones, actual hosted SHA, real encrypted production backup, isolated restore, role/RLS negatives and Storage file bytes remain unverified. Old schema PR #42 stays blocked. **Exterior 12-wave engineering: 42% unchanged (+0)** because these tools have not established real-world P2 acceptance. The founder-directed [Integration P1-P7](./EXTERIOR_INTEGRATION_ADOPTION_PROGRAM.md) stays ahead of normal features, with a second full critique after P7.

## Exterior Release 43 — Two-Founder Job Action Loop (Integration P1.1)

**Implementation:** [PR #130](https://github.com/OJ-Holdings/oj-workspace/pull/130), merged `main` `628e465f9c16fda82d08aa6d25c7959d18465c76`. Exact head `5fb3deba38bb5297dd663c3fa659088da6df54f6` passed [CI #40135901958](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40135901958); post-merge [main #40136080889](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40136080889) completed SUCCESS. Both application TypeScript/all automated tests/Next build and independent **synthetic** PostgreSQL restore jobs green.
- **Why:** R42 Job Continuity could inspect exact original booking and protected team tasks but had to send a founder to another tool to create/update/comment on that team's work. Real daily operator path now stays in one job: open booking → assign a specific internal follow-up to an active unique member with optional deadline and priority → other founder updates In progress/Review/Done and posts short attributed progress updates → original founder refreshes same job.
- **Actual integration:** All task mutations use existing member-session protected `oj_cards` + `oj_comments` and their own original booking+lead checks; status edits retain optimistic revisions, original task receipt and confirmation on task Done; source/cancellation/role failures are errors rather than success. R38 Operations Inbox Open Job now links to the R42 exact-source Bookings workflow rather than the old private field packet route.
- **Safety fix:** Previously a note could be posted to an outdated job task even when its original appointment had since moved or been denied/cancelled, because the server confirmed identity but not source-time parity. R43 now denies the comment itself, just as it already denied stale stage changes. Client additionally shows stale/unknown/partial source state and fails closed.
- **What it does not do:** No new database tables, customer message, actual crew/rig dispatch, signed customer quote, shared field labor/stop-work record, final approved work order, payroll, invoice or reconciled bank receipt. Local private Field Command remains device-bound. Unit tests cover exact snapshot, old task identity, pending, denied/cancelled/unknown original status, repeat assignee/action and operator-note validation.
- **Original 12-wave engineering: 42%** (41→42, +1 W2 Real Command to 9/10). **No independent two-founder phone or served Windows SHA verification**; P1 operational acceptance and P2 owner-private real encrypted backup/isolated restore/Storage/RLS actor proof remain open. Active [integration program](./EXTERIOR_INTEGRATION_ADOPTION_PROGRAM.md) continues to P7 and a new critique before regular feature expansion resumes.

## Exterior Release 42 — One Job, One Truth (Integration P1)

**Implementation:** [PR #128](https://github.com/OJ-Holdings/oj-workspace/pull/128), merged `main` SHA `098dd3fa1b32928a6449e180da17cb990321d02c`. Exact head `8c573b648f1d52bbd798c6c5390d2f25dd0c6d3b` passed [CI 40130639857](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40130639857); post-feature-merge `main` [CI 40130932237](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40130932237) also passed the full application and real **synthetic-only** PostgreSQL recovery jobs.
- **Major direction change:** A founder-requested [Integration & Adoption Program P1–P7](./EXTERIOR_INTEGRATION_ADOPTION_PROGRAM.md) now precedes ordinary Exterior development. Optimize the entire customer→quote→booking→field→invoice→cash chain, genuine two-founder source persistence and usability; stop multiplying standalone tabs. Mandatory new second full critique at P7, then resume original roadmap. Keep the existing weighted 12-wave engineering ledger.
- **Job continuity:** From original Bookings cards or table tap Open job workflow to open one contextual source-evidence desk. Original lead/address/scope/contact, provably qualified original quoted visit amount, source-status/time, available real employee assignment, and authenticated actual shared booking tasks are shown. A specific job URL can be copied for an authorized founder on a separate phone. Each step links to the actual Customer, Estimate, Field or Finance route with unmistakable source/local/absent labels.
- **Accuracy:** Original customer/booking mismatch, partial lead/booking coverage, repeated lead visits, pending/cancelled/denied appointments, current booking/task drift and team-task read failure never produce phantom approved quotes, shared field costs, completed dispatch, paid invoices or fabricated zero tasks. Read-only/preview do not inspect real company tasks; no new database table, privileged API, customer message, financial mutation or file transfer. Unit tests exercise the source model.
- **Progress 41/100** (+1 W1 Experience for in-place job workflow). The Windows hosted release and both founder devices have NOT been accepted. Manual steps: [P1 founder device worksheet](./EXTERIOR_INTEGRATION_P1_FOUNDER_ACCEPTANCE.md). Actual real production recovery/Storage bytes/actor RLS is still an independent P2 gate, and schema PR #42 remains blocked.

## Exterior Release 41 — DISPATCH TASKS THAT BECOME SHARED TEAM WORK

**Implementation:** [PR #126](https://github.com/OJ-Holdings/oj-workspace/pull/126), merged `main` SHA `693483d091af50a4d3efaffb94dd0c0f2331873a`. Exact feature head `6137113489e91d7d1758c119eaf5822b5566a91e` full [CI #40121742079](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40121742079) SUCCESS, feature post-merge [main CI #40121915030](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40121915030) SUCCESS. Synthetic PostgreSQL 17 recovery and app test/build both green.
- **Operational friction removed:** Exterior Command and Booking Manager dispatch exception cards have inline **Assign Action**. Pick a flagged exact original booking, choose the issue requiring action, preview/edit a no-PII specific instruction, choose active unique owner/member assignee, due date and priority and publish to existing live RLS-protected team cards. Already open job tasks can be reviewed; exact duplicate note cautioned. The assigned task arrives in founder Operations Inbox and existing company task board without private browser JSON import/export.
- **Correctness:** The server does not trust client labels; re-verifies org role, original source lead and booking, date/time/status and selected assignee on publish. Cancelled/denied/unknown/stale original source cannot save. A repeated task ID with changed instructions/deadline/assignee/priority cannot silently report previous task as new success. R38 inbox re-fetches after actual save, not from speculative local state. No outgoing SMS, automatic approval, crew/vehicle reservation, signed scope, payment or booking closeout is inferred.
- **Tests:** New dispatch assignment test coverage and shared-task retry regression, plus normal all-code CI. No production DDL/migrations.
- **Exterior weighted engineering score: 40%** (previous 39%; +1 W2). Windows served SHA, two-phone live founder acceptance, original record-sharing schema and actual encrypted production restore remain independently unverified.

## Exterior Release 40 — Founder private backup readiness (real recovery not yet executed)

**Feature:** [PR #124](https://github.com/OJ-Holdings/oj-workspace/pull/124), merged SHA `13c2774082c334756fbbbf01fd79e5fd3e36c7c1`. Exact-head CI [#40092698720](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40092698720) and merged-main CI [#40092863472](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40092863472) both successful, including the synthetic PostgreSQL 17 recovery job.
- Built a Windows-only private founder preflight checking configured production backup, encrypted primary and mirrored volumes, matching archive/hash and R39 readable archive. Operator can initiate backup or guarded scratch restore only through existing scripts on the trusted host; the outputs omit private files and account data.
- Live Supabase was checked read-only: existing source tables and RLS are present, new quote/work-order/field schema absent, and uploaded Storage objects require a separate encrypted object recovery.
- No real Windows machine connection, local encrypted archive, actual isolated OJ production restore, source parity, actor RLS matrix, Storage object bytes, or two-founder acceptance is verified. GitHub synthetic restore success is not an approval for production migration.
- **Engineering progress remains 39%**; Release 40 prepares a controlled founder action but has not crossed the actual production recovery gate. Runbook: [R40 private recovery](./EXTERIOR_R40_PRIVATE_RECOVERY_GATE.md).

## ATLAS V3 / Exterior Command Release 39 — GUARDED DATABASE RECOVERY DRILL

**Feature:** [PR #122](https://github.com/OJ-Holdings/oj-workspace/pull/122) merged `main` `674f929a633636a54edc192e678863d326580158`. Exact feature head `f81018cdbd7765f6456f09ba04c0413ed9927a07` passed [CI #40090540975](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40090540975), including **two independent jobs**: npm ci, PowerShell parser, 10 negative restore-target policy tests, TypeScript, all application tests, Next build, and a real synthetic PG17 restore integration test. Feature post-merge [main CI #40090651371](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40090651371) completed SUCCESS, both jobs.
- **Actual function:** Windows operator can inspect the real locally stored backup archive against a private SHA256 manifest, then deliberately restore into an **empty, specially named, loopback-only Postgres 17 scratch database** after an exact user-entered confirmation. Uses transactional pg_restore `--exit-on-error` and no `--clean`; refuses production host, generic DB, default port, nonempty target, missing/mismatched archive, repeat/ambiguous receipt. Verifies OJ business/Auth table row counts and RLS policy definitions on target and saves a private mechanical restore receipt. `VerifyTarget` freshly re-queries and rejects drift.
- **Safety:** Every receipt explicitly marks actual source parity, verified role-based RLS, uploaded object recovery, shutdown of outbound messaging, full app recovery and production migration approval `false`. The script has no source database connection or service-role secrets. Operator runbook `docs/EXTERIOR_R39_RESTORE_DRILL.md` addresses required Supabase roles/extensions and encrypted storage; don't upload restored customer data or credentials to GitHub/chat.
- **What CI REALLY proved:** The tool successfully handled a completely synthetic PostgreSQL 17 archive and isolated restored destination; it did **not** back up or restore the user's real production project or validate real sign-ins, file objects, SMS shutdown or founder phones. R40 must perform independent private operator tests; no quote/work-order/field migration granted by this release.
- **Full Exterior plan: 39%** (+1 W10 recovery/data hub tool maturity, W10 now 1/5). No additional points earned in W4/W5/W8; new shared customer-facing tables remain absent.

## ATLAS V3 / Exterior Command Release 38 — THE FOUNDER OPERATIONS INBOX

**PR:** [#120](https://github.com/OJ-Holdings/oj-workspace/pull/120); merged `main` `fe280b377141379d22d890373125df5f4562dc7d`. Exact feature head `d0c2257a488ca86a6774c48d547e05497a707a4b` passed [CI 40057792411](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40057792411) (dependencies, typecheck, full regression suite, Next production build). Merged-main CI [40057951479](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40057951479) completed SUCCESS. Windows hosted SHA and founder device acceptance still unknown.
- **Operations Inbox:** bold instrument-quality Exterior Command surface, integrating the full organization's R37 live booked-job tasks instead of requiring a founder to hunt through individual local handoff screens. Real active, Mine, overdue, owner-review and stale-source counts; six action-oriented filters; ordering by operational risk; direct booked job, customer and shared company board links; guarded live task-status actions with a warning that task completion does NOT close the original job, invoice or bank receipt.
- **Member privacy and robustness:** session-checked owner/member on every live loader and shared update, existing `oj_cards` RLS and exact lead/booking source reads, 180-record bounded query and explicit partial history warning, no fake or cached live fallback, owner name ambiguity warnings, original booking identity/status/date/time rechecked during task progress edits, disabled status changes for stale records. Real live database had zero R37-structured job follow-ups at audit time; empty state is a designed first-use path, not an error or simulated metrics. Auto refresh on focus or 90-second while visible plus manual refresh.
- **New regressions:** 11 focused model cases for scope, source drift, source disappearance/cancellation, member identity ambiguity, partial history, sorting, false payment semantics and immutable projection. No DDL/migration, services, SMS, customer acceptance, payroll, or cash changes.
- **Exterior program 38% complete as a weighted engineering estimate**, +2 (+1 W1 intuitive mobile system, +1 W2 real founder action coordination). Not a claim of two-founder signed acceptance, full quote/field synchronization, final invoicing or verified Windows runtime deployment.

## ATLAS V3 / Exterior Command Release 37 — AUTHENTICATED SHARED JOB FOLLOW-UPS

**Feature:** [PR #118](https://github.com/OJ-Holdings/oj-workspace/pull/118), merged `main` commit `ef09092d1e019413ea3314a65b42079eb46d77cf`. **Exact-head CI:** [40055459400](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40055459400) SUCCESS — dependencies, TypeScript, full suite, Next production build. Main post-merge run [40055569744](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40055569744) completed SUCCESS. Actual Windows version and Oscar/Jacob iPhone QA remain separately unverified.
- **Shared action, not shared private report:** Each booking-bound Crew ↔ Owner Desk now includes a dark, responsive company Follow-Up Desk. Prepare an explicit task from the owner’s private reply, choose a current unique active OJ member, set priority/target date, and publish to already-existing organization RLS-protected `oj_cards`. The origin reply UUID is a collision/retry guard, not a verified personal signature. No private field financial evidence is transferred.
- **Cross-device team operations:** Both authorized founders can see and refresh tasks on the booked job’s Field Command and in the shared company task board. Member-authenticated status progression Ready → In progress → Review → Done is optimistic-concurrency guarded; context-specific discussion notes use `oj_comments`. This does not change booking status, employment pay, customer approval, invoice or bank payment.
- **Enforced security:** Each server action independently verifies organization owner/member access, source booking + lead identities, source date/slot/status on publish, typed receipt on updates, current unique assignee, source eligibility, note bounds, expected revision and actual returned database row. Production `oj_cards`/`oj_comments` policy metadata verified read-only; no service-role browser client, no new schema, no privileged RPC, no outbound SMS or cross-company fallbacks.
- **Caveat:** The source reference is human-editable board text rather than an immutable DB FK; users must validate actual job circumstances. The real R31 field worksheet, labor/material costs, photos, customer-accepted quote versions and final work/payment receipts are NOT synchronized. Founder device and independently recoverable encrypted database backup remain unproven.
- **Engineering completion: 36%**, up +2 (W2 5→6, W5 9→10). Existing schema reused; no further financial closure was credited.

## ATLAS V3 / Exterior Command Release 36 — SOURCE-QUALIFIED DISPATCH

**PR:** [#116](https://github.com/OJ-Holdings/oj-workspace/pull/116); **merged main SHA** `fa03afc8bc73c04269e916cdfdc77fb9a8cf6037`. Feature-head [CI 40053530134](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40053530134) SUCCESS: install, TypeScript, complete tests, production build. Main post-merge CI [40053650435](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40053650435) SUCCESS. Windows host served SHA and two-founder device acceptance remain unverified.
- **New:** integrated Today / 7-day / 14-day Dispatch Preflight on ATLAS HQ and Bookings. Users can focus on exceptions or all jobs, see source status, selected customer/site/scope/time, pending approvals, and overlapping time windows labeled as possible capacity conflicts, not a claim parallel crews are impossible. Each record links to existing exact-source booking, estimator, field sheet, or customer dossier; no automatic outbound action.
- **Fix:** no more quoted-value multiplication across repeat source lead visits. Month/day Calendar, Booking KPI, Command confirmed-work KPI and next-job timeline use fully coverage-qualified original lead prices only for exactly one source-confirmed active visit with a positive quote. All missing, repeat, incomplete or pending pricing remains **withheld** and never stands in for acceptance, invoicing or paid money.
- **Verification:** 14 new behavioral tests plus expanded Command financial regression cases for overlapping windows, multi-visit and past-repeat ambiguity, partial/unknown source coverage, date boundaries, invalid field source, and immutable source data. Full CI passed.
- **Supabase review:** read-only current production catalog and security advisor checks completed; no new shared Exterior quote/work-order tables or recoverable encrypted backup/isolated restore were verified. Details, explicit recovery gate and advisor remediation references are in [R36 database audit](./EXTERIOR_R36_DATABASE_GATE_AUDIT.md).
- **Total Exterior 12-wave engineering completion: 34%**, up **3** from R35 (W2 3→5, W9 1→2). Still no verified source-accepted quotes, invoice/collection reconciliation, final job completion, encrypted backup/isolated restore, authenticated field sync or actual Windows-hosted SHA.

## ATLAS V3 / Exterior Command Release 35 — PRIVATE CREW ↔ OWNER HANDOFF

**PR:** [#114](https://github.com/OJ-Holdings/oj-workspace/pull/114). **Merged `main` SHA:** `d6ce80cd019fb98486a65d8061b89ee7f129d750`. Exact-head CI [40050826999](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40050826999) SUCCESS: dependencies, typecheck, **582/582 tests**, production build. Main post-merge CI `40050990815` and served Windows SHA separately verify.
- **Crew field export:** one-tap private JSON packet, exact booking/org/source lead, immutable request ID, origin field-cost/safety/work notes snapshot and self-entered operator label. Generated packet is saved in a validated browser-local mailbox. The user must manually transfer it through a trusted private channel.
- **Owner import and review:** exact scope-checking with in-app deep inspection of entered crew hours, material quantities/rates, travel and direct costs, timestamps, site notes and incidents. Source-linked R34 review flags incomplete booking coverage, duplicate active visit, source drift, missing labor/material/travel/other, safety/equipment checks and stop-work/attention observations. No invented invoice or confirmed cash.
- **Return decision:** owner can assign `follow-up-needed` to crew or owner with actionable instructions and optional due date, or `reviewed-internally` only if local source, cost and safety evidence clears. The return file references precisely the original request version; importing it does not rewrite the field log. Changed field/source records warn that older feedback is stale.
- **Security:** tightly bounded/sanitized import data, cross-company and cross-job denial, strict purpose/version, chronological receipt, no forged paid/accepted/completed fields, no silent mailbox overwrite, invalid source clear-status denial. Reviewer identity is user-entered, unauthenticated; file transfer has NO encryption, signature, automatic dispatch, shared sync or customer-facing effects. Treat any exported packet as private sensitive information.
- **Engineering completion:** **31% whole Exterior program** (+2 W5 points; W5 now 9/12). Remaining major gates are an independently restored recoverable Supabase backup, staging RLS/role checks, real cross-device collaboration and accepted end-to-end job/invoice/payment evidence. Mobile founder acceptance and Windows runtime SHA are unverified.

## ATLAS V3 / Exterior Command Release 34 — FIELD CLOSEOUT OWNER HANDOFF

**PR:** [#112](https://github.com/OJ-Holdings/oj-workspace/pull/112). **Merged main SHA:** `83b246a48626b520e235d80c15b9e621af6cf4b9`. **PR-head CI:** [40049280505](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40049280505) SUCCESS (installation, typecheck, full tests, production build). Main CI [40049454435](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40049454435) requires independent observation; actual production host SHA is not verified.
- Booking-specific mobile **Crew Closeout Handoff** extends the existing source-linked field app, not a new redundant dashboard. Shows local cost/hours, a reason-coded owner handoff status, and actionable in-page correction links for unfinished operator evidence and incident/safety observations.
- Source invariants: exact original booking+lead, full booking coverage and a single active visit required before internal reviewability; reject source drift, unknown/unchecked costs, invalid field logs and cancelled jobs. Green means **locally reviewable**, never completed/approved/paid.
- A click copies a private owner-only packet with source booking/customer identities, original lead quote labeled unaccepted, operator-entered direct costs, evidence blockers and explicit payment/invoice/signoff disclaimers. No customer send, booking write, database change, invoice, settlement or background automation.
- New behavioral tests cover missing vs zero costs, critical stop-work, site/checklist states, multiple visits and source partiality, cross-record substitution, stale source, and no false accepted/settled semantics.
- **Full 12-wave Exterior Command engineering progress: 29%** (W5 increases from 5/12 to 7/12; other waves unchanged). Windows served SHA, actual founder device QA, and independently recoverable protected Supabase backup/restore remain separate gates.

## ATLAS V3 / Exterior Command Release 33 — SOURCE-BOUND JOB ECONOMICS

**PR:** [#109](https://github.com/OJ-Holdings/oj-workspace/pull/109). **Merged SHA:** `7fb0bb624ac52e9b00994e298b2a36a403e3ceb8`. **Exact PR-head CI:** `40043642452` SUCCESS.

- Connects lead/booking authorized source records and both R29 internal estimate and R31 field-cost operator drafts into a new dedicated exact-job economics section.
- Source-labeled lead quote, current local planned direct cost, operator-reviewed direct field cost and crew hours; scenario quote-minus-field-cost arithmetic and planned-cost-minus-field-cost variance when rigorous source and cost completeness criteria hold.
- The comparison is withheld for truncated/unknown booking coverage, more than one active booking attached to the source lead, wrong/stale booking, missing direct-cost review, absent positive source quote, or invalid source ID. Planned comparison additionally requires the estimate's original source timestamp/amount to match the current lead.
- Historic lead-level recorded job revenue/cost are NOT attributed to any single booking or called cash settlement; no invoice, customer approval, labor payroll or audited financial records inferred. Source confidence and safety blockers remain prominent.
- Responsive scenario instruments and evidence gaps with link back to original estimator, manual browser-local refresh, and user-initiated INTERNAL clipboard report. Pure tests exercise provenance/null money/repeat bookings/partial source data/staleness/known zero and no false paid-profit inference.
- **Full Exterior plan: estimated 27% completed engineering** (W1 5, W2 3, W3 5, W4 6, W5 5, W7 2, W9 1). Production backup/isolated restore and RLS proof, Windows served SHA, actual founder device acceptance, immutable shared job costs and bank reconciliation remain unverified/not delivered.

## ATLAS V3 / Exterior Command Release 32 — BOOKING-BOUND FLEET READINESS

**PR:** [#107](https://github.com/OJ-Holdings/oj-workspace/pull/107). **Merged SHA:** `03cfbdbac8e13c4540bd8e6df1138144b827cd2b`. **Final exact-head CI:** `40041648800` SUCCESS.

- Field Command now integrates existing device-local Fleet Command asset and maintenance facts, avoiding a duplicate rig inventory. Select equipment for a specific real booking, with original lead/org/booking ID preserved and separately scoped browser-local assignment.
- Automatic reason-coded warnings for service due/overdue, out-of-service equipment, missing/unknown assets, previous-day departure checks, manually calculated vehicle payload overage, stale booking source and potential same-day asset reuse among other **visible same-browser** booking plans.
- Optional same-day manual operator review with explicit source-change rebase and protection against stamping an empty/missing asset plan or an asset with recorded stop-work condition. No assertion of actual physical inspection, verified crew availability or company-wide reservation.
- Mobile industrial panel with tagged candidate assets, issue severity, capacity and checklist counts, keyboard accessible controls and reduced motion. Tests verify company/job isolation, source drift, forged fields, payload math, maintenance states, same-day overlap limitations and fail-closed missing records.
- Production Supabase database and quote/job/asset schema untouched. No multiuser reservations, synchronized operating logs or confirmed job-completion/collection events. Existing backup instructions require independent private restore proof.
- **Full Exterior Command program: 24% weighted engineering completion**, W7 equipment slice earns 2 points. Windows-hosted served commit and real founder mobile UAT remain separate and unverified.

## ATLAS V3 / Exterior Command Release 31 — MOBILE FIELD COMMAND

**PR:** [#105](https://github.com/OJ-Holdings/oj-workspace/pull/105). **Merged SHA:** 9b93a7f3743e05fca3b851124dd34129a75b40ea. **Exact feature-head CI:** 40034470435 SUCCESS.

- Field Operations gains a new job-specific mobile operation application with source-bound /b/exterior/field?booking=<exact ID>. HQ, Customer 360 booking history, and dispatch cards/tables link to the right saved booking.
- Operator-entered job stage, arrival/departure device timestamps, crew hours & loaded rates, material quantity/unit cost, mileage/rate, other direct costs, chemicals/PPE/runoff/water readiness, pump/hoses/WFP equipment checks, issue register and closeout notes. No source booking status is changed by local work-sheet completion.
- Finite/range/canonical-date validation and economic review keep unknown distinct from reviewed 0. Known cost subset and four-category complete direct-cost total shown separately; no lead-level revenue is allocated to an individual booking, no fake profit, invoice or paid status.
- All drafts remain in the current browser; versioned private field package transfer includes exact company/booking/lead binding, size/safety/row limits, field whitelist, file overwrite confirmation and fail-closed cross-organization imports. No automatic server sync or job completion action.
- Responsive graphite and copper/sea-glass panels, focus and reduced-motion paths, mobile field controls, stop-work/safety warnings and exact booking source-drift indicators. Tests cover null direct costs, legitimate zero, hazard exceptions, forged finalized fields, import isolation and typed crew/material records.
- **Full Exterior program: 22% estimated engineering completion** (W1 5, W2 3, W3 5, W4 6, W5 3; remaining waves unearned). Windows-served build SHA and actual founder-device acceptance unverified. Shared field event persistence still requires isolated restore/role/RLS proof before migration.

## ATLAS V3 / Exterior Command Release 30 — PORTABLE QUOTE HANDOFF AND APPROVAL-SAFETY PREFLIGHT

**PR:** [#103](https://github.com/OJ-Holdings/oj-workspace/pull/103). **Merged SHA:** `19cf2613fb6f9921ef353fd4919042d2b715928f`. **Exact PR-head CI:** `40032631314` SUCCESS.

- New validated `oj-exterior-internal-quote` file-transfer format for complete line-item estimate plus local history, scoped to exact original company and lead and restricted to at most eight revisions, 120 KB input, verified numeric bounds and timestamp semantics. Import preserves unknown costs rather than forcing zero.
- Founder Estimating Workbench now exports and imports private internal packages, explicitly warns before replacing a local draft, and shows source-match, shared quote price, existing-booking, missing-cost and customer-acceptance **unverified** states.
- Security/accuracy tests cover wrong organization/lead, forged accepted or paid statuses, corrupt versions, invalid costs, duplicate revisions, unexpected/untrusted fields and stale source references. No file import alone causes a customer message, lead update, schedule change, approval or payment.
- Read-only Supabase audit confirmed that durable structured quote-version records are not currently present, and file document metadata cannot safely substitute as a quote ledger. Added [quote-version schema and deployment gate](./EXTERIOR_QUOTE_VERSION_STORAGE_GATE.md) for isolated restore, RLS/role proof, source version receipts and atomic idempotent booking.
- **Full Exterior plan: 19%** engineering estimate (W1 5 + W2 3 + W3 5 + W4 6), up from R29 17%. No automatic cross-device sync or production DB migration. Windows served SHA and real founder mobile/desktop acceptance unverified.

## ATLAS V3 / Exterior Command Release 29 — LINE-ITEM ESTIMATE ENGINE

**PR:** [#101](https://github.com/OJ-Holdings/oj-workspace/pull/101). **Merged SHA:** `ef2ed0c440bbea75e807e82115405161ec3c5f2a`. **Exact-head PR CI:** `40030364222` SUCCESS.

- Introduced integrated `/b/exterior/estimate?lead=<exact ID>` for genuine Exterior customer quoting analysis: per-service quantity/unit/price, optional cost per unit, descriptions/exclusions, discount, travel expense, direct-cost contingency, and real-time revenue-minus-cost contribution/margin only when all source costs are recorded.
- Source-verified, client-readable review workflow preserves current lead ID and existing phone/address/status; no customer data re-entry. Local draft autosaves in the current browser, plus 8 recoverable local revisions with restore, reset and internal brief copy. This is **not** shared/authorized corporate backup or customer-approved proposal.
- Added `recordExteriorEstimatedPrice`, which performs member-gated, versioned original-source checks (old price + updated timestamp and eligible lead status), marks manual price edit and logs an **internal** quote amount change. It does not change any other lead business fields, reach customers, accept/sign proposal, create billing, book work or collect money.
- One-click handoff into the existing guarded booking dialog but booking remains a separate manual confirmation; no atomic proposal-to-work order yet.
- Responsive graphite/amber service-engineering design, animated KPI entry, source provenance and keyboard/reduced-motion controls. New pure tests cover pricing, incomplete costs, discounts, corruption-safe revision history and stale-source guards.
- **Full Exterior Command plan: estimated 17%** (W1=5%, W2=3%, W3=5%, W4=4%, remaining waves=0). Production Windows serving SHA, real founder iPhone acceptance, authenticated durable quote versioning and isolated database backup/restore remain unverified.

## ATLAS V3 / Exterior Command Release 28 — WEBSITE INTAKE COMMAND

**PR:** [#99](https://github.com/OJ-Holdings/oj-workspace/pull/99). **Merged SHA:** `d0baf7bdb5b5387f5ba6c49b7b8409956979c486`. **Exact-head PR CI:** `40026458399` SUCCESS.

- New responsive two-pane Website Intake Command replaces the quote_requests raw table: original request inbox, source identification, search, request details and contact, recurring-service interest, candidate identity review, and annotated lead creation handoff.
- Reuses existing authenticated `LeadDialog` instead of copying customer data into another database. No automatic quote price, approval, payment or processed status; source ID and website data copied as **human-readable notes** only, with original record preserved and truncation warning.
- Same phone or adequately detailed same address produces **possible match**, not identity verification. Explicit separate-lead acknowledgement required if candidates exist; direct exact-ID source links remain unchanged.
- New `/b/exterior/intake` and legacy `/b/exterior/quotes` routes, Customer 360 website-request exact-source drillthrough, and entry points from HQ and customer workbench. Missing linked ID cannot silently substitute another request.
- Bespoke high-density industrial visual styling, responsive mobile reflow, keyboard focus and reduced-motion support. Tests cover source semantics, matching, nulls, 4000-char note limit and no fake processed state.
- Scope limit: No canonical request→lead foreign keys or idempotent processing, no automatic LSA data, no production migrations, no outbound comms. Source request limit 1,000; do not assert full customer history.
- **Full Exterior Command plan:** engineering estimate **14%** (W1 5%, W2 3%, W3 5%, W4 1%, rest 0%). Deployment exact Windows SHA and real founder device tests unverified.

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
