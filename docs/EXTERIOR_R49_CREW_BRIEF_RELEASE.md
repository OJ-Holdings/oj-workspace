# Exterior Release 49 — Source-qualified internal crew brief

**Scope:** Integration P1.5 / Job Continuity; October 24, 2026 (America/Chicago). This document is an engineering handoff, not evidence of the currently served host or founder acceptance.

## Shipped code

- Feature [PR #140](https://github.com/OJ-Holdings/oj-workspace/pull/140) merged into `main` at `02fa2bbac8e66955c3d084164bb343ac9d6f68ef`.
- Tested feature head: `cb96e1386e6b2d7ad20c2e24397b7514c6f3d91a`. [Exact-head CI #40149799864](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40149799864) passed TypeScript, automated tests, production Next build and synthetic isolated PostgreSQL 17 recovery.
- [Post-merge main CI #40149952362](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40149952362) independently passed both application and synthetic recovery jobs.
- Separate security [R48 PR #139](https://github.com/OJ-Holdings/oj-workspace/pull/139) updated Next.js to 16.4.1 before R49 merged; the final main checks include that patched dependency baseline.

## Operator behavior

Within **Jobs & Bookings → Open job workflow**, the existing exact original booking view now displays a compact **One job. One crew brief.** section. It composes:

- Original source customer name, service site, usable recorded phone and requested scope.
- Source booking status and day/time; the original source crew name only if actually available.
- An attributable original lead quote only if existing source-coverage safeguards establish unique visit attribution, explicitly **not accepted, invoiced or paid**.
- Current member-scoped company follow-up tasks matched to that same booking source snapshot, with a prioritized bounded twelve-item internal summary. Partial company task coverage is labeled, not silently treated as empty.
- Specific missing customer/site/phone/scope/booking/time/crew/quote/history requirements, plus an independent site-safety verification reminder.

The **Copy internal crew brief** action occurs only after an authorized live company operator's original job and authenticated task snapshot match. Preview, read-only, missing-source, mismatched-source and failed task loads do not offer this clipboard action. The copied brief contains customer contact/address data and is explicitly labeled **INTERNAL ONLY**. Clipboard copy is a user-initiated device action, not a message sent to a customer or employee.

## Boundaries and negative cases

- Read-only projection over existing original `bookings`/`leads` data and existing current member-RLS `oj_cards` follow-up records.
- No production DDL, migration, customer source change, task insertion, SMS, email, crew/vehicle reservation, field evidence sync, invoice, cash, or paid-state update.
- Refuses missing/duplicate original customer identities, wrong original booking, changed time/status/date or unauthorized board state; source values are reduced to single-line bounded text so a customer name cannot inject extra trusted headings.
- Tests include confirmed/pending, bad crew, unknown/partial source, stale/wrong booking, unlinked task receipts, repeat sourced original quote handling and deterministic nonmutating projection.
- Displayed safety checklist items are reminders, never operator-validated safety clearance. A confirmed booking is not proven dispatch readiness.

## Current blockers and score

**Original 12-wave Exterior engineering score remains 42/100 (+0)** pending real adoption and larger business-spine integration. P1 code exists, but neither of the following has been independently verified by this release: the actual current served Netlify/Funnel SHA on both founders' phones; Oscar → Jacob → Oscar assignment/status/comment persistence; real private encrypted production backup and physically independent mirror; isolated production-source restore; signed-in RLS negative actor matrix; Storage object byte recovery; rollback. Synthetic PostgreSQL CI does not substitute for real source restore.

The P3 permanent Customer → Property → immutable quote → booking → work-order schema remains blocked. [PR #42](https://github.com/OJ-Holdings/oj-workspace/pull/42) must not merge until P2 is satisfied.

## Navigation

Source of truth: [canonical Exterior continuation](./EXTERIOR_CONTINUE_HERE.md) and [Integration & Adoption Program](./EXTERIOR_INTEGRATION_ADOPTION_PROGRAM.md). This R49 detail file was authored separately to avoid clashing with concurrent security handoff documentation. Future canonical ledger updates must preserve both sets of evidence.
