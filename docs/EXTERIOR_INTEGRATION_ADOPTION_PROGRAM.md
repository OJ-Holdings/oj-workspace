# Exterior Care — Integration & Adoption Priority Program

**Active prerequisite to normal Exterior roadmap, added 2026-10-24 following full product critique.** This is a priority overlay on the existing 12-wave/100-point Exterior master plan, not a replacement or second percentage. The standard plan resumes after these passes, and a **second full critique is required at the end**.

Entry checkpoint: Release 41 merged at 40/100 engineering points; true Windows-served commit and two-founder phone acceptance not verified. Private backup/isolated real restore, authenticated role/RLS negatives and Storage object-byte recovery not proven. Never merge schema PR #42 or apply production DDL without those gates.

## What we're fixing

The system has a genuine protected customer/booking/task core, but its most elaborate Estimating, Field, Fleet and Commercial modules store much of their data in **one browser**. A lead quote can be recorded without an immutable accepted proposal; a scheduled visit isn't a dispatched work order; a finished task isn't a completed job; historic job revenue isn't bank-verified cash. Multiple Command/NEXUS/Operations screens also overlap, causing needless navigation and unclear authority. These are the blockers—not insufficient KPI decoration.

## Operator rule

Each pass must move an operator through an original customer or booked job and preserve the **exact source identity and evidence**. Oscar should be able to trace scope, decision, cost, invoice and cash. Jacob should be able to open assigned work and log real field evidence in a simple phone workflow. A new screen without connected action or source provenance is not a pass.

## Active ordered implementation passes

| Pass | Outcome to deliver | Evidence required | Precondition | Original 12-wave allocation |
| --- | --- | --- | --- | --- |
| **P1 / One Job, One Truth — START NOW** | An in-place Job Continuity view on the *existing* Bookings workbench connects original booking, customer, source-qualified quote, existing crew assignment (if actually present), live booking-linked company task board and links to original estimate/field. Plainly distinguish team-shared vs device-local vs absent data. Deep-link the same job for both founders. | Exact-ID and stale-source regression tests, no fake task fallback or quote on repeat visits, empty/preview/read-only/partial states, intact booking actions. Human phone acceptance independently pending. | No new tables. | W1/W2/W3/W4 (credit only for genuinely merged value) |
| **P2 / Reality and recovery gate** | Verify exact deployed Windows SHA and real Oscar↔Jacob authenticated task assignment/status/comments on two phones. Have founder privately obtain encrypted actual production archive plus physically independent encrypted mirror, restore into isolated compatible DB, reconcile source counts/constraints and Storage bytes, test owner/member/viewer/revoked/outsider/anon RLS negatives and rollback. | Independent, redacted signed two-founder device record; source/restore/actor proofs. Synthetic CI and RLS-enabled catalog flags are NOT real proof. | Owner's private Windows/media and real authorized actors. | W10/W12 |
| **P3 / Permanent customer, quote and work order spine** | After P2, staged canonical Customer/Property→Opportunity→immutable Quote Versions→source appointment→Work Order, audit receipts, accepted-version verification, concurrency/RLS and safe opt-in import of local drafts. Keep legacy source IDs. | Superseded quote cannot be accepted; repeat visits distinct; owner and member read/write only allowed org; outsider cannot view costs; no unapproved draft or phantom booking; two-founder cross-device parity. | **Blocked by actual P2 recovery & staged negative checks.** | W3/W4/W10 |
| **P4 / Real dispatch, crew, fleet and field closure** | Job-centric phone-first actual crew/rig reservations, durable field time/material/photo/safety/issue evidence, owner closeout and mobile offline failure/retry, without duplicating original customer/site. | Real devices; no cross-booking leakage; source scope change/revision blocks stale approvals; unknown cost remains null; field done != paid. | P3, controlled private file storage. | W5/W7/W12 |
| **P5 / Invoice, costs and collected-cash truth** | Convert approved completed work into source-backed invoice/AR, settlements, bank matches, refunds, actual job costs and reliable contribution metrics; track estimate vs invoice vs collection separately. | Lost/duplicate provider callback cannot make phantom cash; settled matches verified deposit, partial/unknown feed withheld, invoice source version immutable. | P3/P4 + authorized providers. | W8/W9 |
| **P6 / Converge commercial, fleet and intelligence** | Run a real multi-site/recurring commercial account through the same quote/work order/visit/closeout/collection spine. Shared Fleet and candidate asset selection become actual verified reservations. Source-attributed LSA spend and job margin become useful executive intelligence; opt-in governed automation only. | One actual commercial end-to-end case, independent founder acceptance, no false fleet telemetry or acquisition ROI. | P3–P5. | W6/W7/W9/W11 |
| **P7 / Simplification, adoption and second critique** | Collapse redundant top-level Command/NEXUS/Connected Operations entries only AFTER navigation parity; keep links/bookmarks. Make Today, Customers, Estimates, Schedule, Jobs, Money, Fleet and Commercial contextual views of one source graph. Two-founder 7-day trial, accessibility/performance and data completeness review. **Repeat full critique** against P1 baseline, log remaining defects and ranked backlog. Then **resume regular Exterior feature development**. | Jacob reaches job in ≤2 navigation actions; Oscar traces a real visit through collection; complete source/performance/permission/host/phone audit, comparison of before/after and no hidden local data islands. | Complete enough P1–P6 for real evaluation. | W1/W2/W12 |

## Pass exit template (mandatory every release)

- Real **actor → action → original source → authorized mutation → verified persisted evidence → other founder** chain, or explicitly state which edge is still missing.
- What is *shared source*, *authenticated company task*, *browser-local operator draft*, *read-only model* and *not implemented* must be labeled; no phantom customer response, signed quote, crew dispatch, invoice, profit or bank deposit.
- Exact GitHub PR/head SHA, full TypeScript/test/build and post-merge main CI; Windows-served SHA and two independent founder devices remain separate proof gates.
- Negative tests for missing lead, wrong booking/org, changed date/status, repeat-client price, partial source, role restrictions and concurrent edits.
- Preserve existing UI/records/routes; preview fictional and read-only, live failure is an honest failure. No service-role, unapproved production DDL, messages or money actions.
- **The 12-wave engineering score remains the only score**; planning and unrun host checklists earn 0. Record pass name and blocked/unblocked gates alongside the original weighted total.

## Explicit end-of-program re-critique

At P7, inspect **current GitHub, real production data, served Windows build and two separate real founder devices**; compare from this baseline:
1. How each module connects from inquiry to settled receipt without copying data.
2. Which screens remain redundant or abandoned; whether Jacob needs instructions.
3. Which records are authoritative versus device-local, including Fleet, commercial and field.
4. Source-backed financials, customer identity and actual advertising returns.
5. Backups, restore results, signed-in permissions, failures and rollback.
6. Performance, phone accessibility and real seven-day work adoption.
7. Critique of the critiques: what earlier assumptions were wrong, what remains absent and the ranked next regular-development packages.

Publish a **new** `docs/EXTERIOR_INTEGRATION_FINAL_CRITIQUE.md` only once this second independent audit really occurs. Do not fake the document now.

## Initial real evidence

Read-only live source inventory October 24 at 2:05 p.m. Central: **177 leads; 37 bookings; 2 company memberships; 28 general shared cards; 0 R37 structured booking follow-up cards; 2 Storage objects**. Source counts are a dated, approximate adoption baseline—not a snapshot parity proof. Critical meaning: follow-up workflow code and CI are validated but actual two-founder adoption isn't.

**P1 is active.** Release 42 begins by unifying an exact original booking in the existing Bookings workbench, with source and team task freshness and explicit unimplemented stages. No production migration or new top-level module.
