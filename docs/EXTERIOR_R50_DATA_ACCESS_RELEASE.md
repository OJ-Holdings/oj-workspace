# Exterior R50 — Shared Data & Transaction Foundation

**Merged:** October 25, 2026 · [feature PR #148](https://github.com/OJ-Holdings/oj-workspace/pull/148) · `main` feature merge `923bee2ca98e263b9dffc310ad3687606f93c678` · tested feature head `3ddbeebc27db3c9f608e57bb24e2bb3eeff82537`.

**Exact head evidence:** [GitHub Actions #40189504342](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40189504342) succeeded for (1) TypeScript, all tests, production Next.js build and dependency audit, (2) isolated synthetic database recovery, (3) real synthetic PostgreSQL 17 RLS actor + private quote transaction tests.

## Code shipped

- `src/lib/exterior-p3-data.ts`: Pure domain read contract joining legacy exact booking/lead to explicit company source links, canonical customer, property, exact visit/opportunity, current quote version and a booked work order. Owner/member-specific authorization is **outside** this pure function. Tenant link is required before returning any originally global legacy contact/address. Source changes between initial read and recheck, duplicate original booking work orders, changed quote revisions, mismatched tenant/visit/customer and private cost fields fail closed. No fake approvals, paid invoices, or dispatch.
- `src/lib/exterior-p3-db-read.ts`: actual session-scoped Supabase query adapter, with `requireMember(org,true)`, narrow explicit selects and org filters. Public publishable client + current RLS only; **never** a service-role key. Unexpected/missing staging tables are unavailable, never fake empty success.
- `src/app/workspace/exterior-p3-actions.ts`: a callable read-only Next server action for future Jobs & Estimating screens.
- `supabase/staging/exterior-p3-private-command.sql`: private security-INVOCER SQL quote-version write gateway, **not exposed to Data API**; no role grants to `anon`, `authenticated` or PUBLIC. Current actor and company membership required; locks quote, checks expected revision and existing work order, validates idempotent command replay content, inserts through strict immutable scope/total trigger. The release also hardens the trigger itself against retroactively changing quotes after a work order was created.
- `tests/exterior-p3-data.test.ts`: 14 negative/exact-source/tenant/race tests. `scripts/tests/exterior-p3-schema-integration.sh`: real SQL verification of issuer-role write denial, same-command retry, fake actor impersonation, stale revision, active member append, safe issued scope and forbidden direct user write.

## What this deliberately does not implement

- No production Supabase migration. The real P3 tables are still staged; the read action is **not connected to user-facing components**, and would return unavailable until a later approved migration.
- No actual commercial estimating persistence/synchronization yet; preserving individual browser origins, local JSON and device-specific records is Codex's parallel infrastructure work. Do not delete or overwrite them.
- No customer-verified approval signatures or provider receipt trust. The private SQL gateway alone **cannot** establish that a privileged server connection authenticated a founder or verified the original legacy lead/booking revision. Future reviewed server adapter must prove these before invoking a private write transaction. No customer SMS, crew dispatch, invoice, bank/cash, private field log or approval record was written.
- P2 real founder-owned encrypted source backup, independent off-host mirrored copy, isolated restore, Storage object bytes, actual role verification and rollback remain required before migrating P3 into the live project. Keep historic PR #42 blocked.

## Next build

**R51/P3.2:** Trusted transactional server adapter and quote revision CRUD wired into **existing** Residential Estimating and Commercial Project screens (not a competing app). Build source/membership/current booking checks and persistent legacy import with full preservation; add integration scenarios for two founders editing a quote concurrently and retrying after a dropped connection. Ensure product screens distinguish locally saved, shared saved, conflict, offline and unauthorized. Use the actual DB only after P2 allows migrations.

**Original 12-wave engineering score: 42/100 unchanged** because no founder-usable permanent shared quotes or work orders yet.
