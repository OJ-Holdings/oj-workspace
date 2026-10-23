# Exterior Command R30 — Shared Quote Version Storage Gate

**Status:** Design and handoff contract only. The production database was **not migrated** in R30. No founder/device can currently claim that an imported internal quote is synced, accepted, sent, or booked. R30 provides a manually transferable, validated internal package.

## Read-only findings — October 23, 2026

- The production source includes original `public.leads` (status, quote_amount, financial history) and `public.bookings` keyed by `lead_id`.
- `public.oj_documents` is a storage metadata registry (name, tag, storage_path, uploaded_by, etc.), **not a structured quote-version ledger**; do not overload it with private unit costs or alleged signatures.
- `public.oj_memberships` carries organization/member roles, and application server actions use `requireMember(org,true)`.
- No `public.oj_exterior_quote_versions` / `oj_exterior_quotes` tables were present during read-only inspection. This result alone does not establish backup/restore availability or production write readiness.
- Supabase announced that new tables may require **explicit REST/Data API GRANTs** and will no longer auto-expose by default (enforced October 30, 2026): https://supabase.com/changelog/45329-breaking-change-tables-not-exposed-to-data-and-graphql-api-automatically
- RLS design guidance: https://supabase.com/docs/guides/database/postgres/row-level-security

## Target version model

1. **`oj_exterior_quotes`:** immutable `organization_id`, canonical `customer_id` + `property_id` (or temporary explicit `legacy_lead_id` source mapping), quote ID, live version pointer, quoting workflow `draft / internal_review / ready_to_send / sent / customer_responded / cancelled`, source attribution, created_by/at, revision counter. Never infer customer acceptance from internal review.
2. **`oj_exterior_quote_versions`:** immutable version ID, quote ID + organization composite key, monotonically increasing version number, source lead version/price, scope line JSON or normalized quote lines, scoped internal cost fields, calculated price and coverage, exclusions, validity/date and approver actor/at, created_at. Never update prior versions.
3. **`oj_exterior_quote_events`:** append-only `prepared / internally_approved / sent / customer_accepted / customer_declined / expired / superseded / booking_created` with actor, verified evidence source, provider message ID, receipt timestamp and explicit missing-evidence state. A click saying “accepted” without evidence may be a manual assertion but cannot be described as independently verified.
4. **`oj_exterior_work_orders`:** source quote_version_id, exact customer/property/legacy source lead ID, scope snapshot and exclusions, approval evidence reference and job status. Booking_id joins original `bookings` only after a valid booked slot and guard succeeds.
5. All references must preserve exact legacy IDs and two-founder ownership; no automatic phone/address identity merging. Returning-client jobs use distinct opportunities without duplicating historical job revenue.

## Concurrency / transactional invariants

- Quote version creation increments the parent version only under a row lock; sequential versions must be unique under `(organization_id,quote_id,version_number)`.
- Customer acceptance is bound to an **immutable version**. Editing after acceptance creates a new version and invalidates prior booking approval until re-reviewed.
- Booking is an atomic transaction with source/customer/quote/version/slot checks, an idempotency key, and an immutable work-order reference. A failure must not leave a phantom booked lead or an accepted-but-unscheduled job.
- Historical `lead.quote_amount` is compatibility metadata, not authoritative approved quote history. No bank settlement, invoice or revenue is derived from a quote.
- Field-log closeout, invoice dispatch, payment received and bank reconciled each have independent evidence and state machines.

## Isolation and RLS release gate

Before any migration:
1. Private, recoverable full backup of production **and proof of isolated restore**, including real rows and constraints, with documented recovery and rollback.
2. Staging test against current migration history; no direct production schema improvisation.
3. Validate member roles: owner/member CRUD only where intended; viewer read only; removed member denied even with stale session; outsiders/anon denied; cross-organization foreign keys rejected.
4. Use RLS on every exposed table. `USING` **and** `WITH CHECK` for UPDATE; SELECT policies accompany UPDATE; no public privileged `SECURITY DEFINER` bypass. Explicit grants as required by current Data API settings.
5. Prevent pricing/cost leaks to inappropriate roles with separate views/policies and scoped DTOs; default-deny unknown records.
6. Prove exact-endpoint tests for duplicate retries, simultaneous founder edits, superseded version acceptance, quote/slot race, missing cost fields, replay attacks, and lost connectivity.
7. Test live two-founder desktop/iPhone flows with redacted/consented customer data, audit receipts, alerts and rollback. Verify served Windows SHA before calling it released.

## R30 bridge behavior and boundaries

- `oj-exterior-internal-quote` file format/version 1, <=120k characters, full internal `LocalEstimateBook` snapshot plus up to eight saved revisions.
- Exact organization+lead matching and strict numeric/type validation; unknown cost stays null, source timestamps checked, extra untrusted properties stripped.
- Imported drafts replace the existing browser-local estimate **only after deliberate confirmation**. The remote counterpart must physically exchange the file over a private trusted channel.
- The file format deliberately has **no accepted/sent/paid status**. A wrong-company, wrong-customer, unknown format, oversized, corrupt or invalid numeric file fails closed. Imported drafts cannot auto-update shared lead quote or booking.
- The workbench's source price recording and scheduling use separate existing authenticated actions. No customer was messaged and no production data migrated while building this release.

**Next:** Implement the versioned schema behind the above explicit backup/restore and RLS gate, then build proof-bound proposal/acceptance and atomic booking APIs. Treat this document as a requirements and test checklist, not authorization to run migrations.
