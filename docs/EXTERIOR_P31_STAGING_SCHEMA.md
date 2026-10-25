# Exterior P3.1 — Executable relational staging foundation

**Scope:** Safe additive design and synthetic PostgreSQL 17 tests, NOT a production migration. The original Exterior leads, bookings, customer messages and commercial operations are unchanged.

This is the database counterpart of the P3.0 immutable quote/work-order domain engine. It is backend work for the permanent Customer → Property → Quote → Work Order system, not a new dashboard.

## Implementation delivered

- **supabase/staging/exterior-p3-foundation.sql:** Ten tenant-scoped relational tables, including canonical customers, properties, immutable legacy source links, opportunities, quotes, quote versions, unverified acceptance claims, private independently verified acceptance receipts, work orders and order events.
- **Legacy identity stays exact.** Source lead and booking IDs are opaque text. Canonical customer/property/quote IDs are UUIDs. Mapping is explicit and unique, never inferred from names, phone numbers or similar street addresses. Multiple source leads may refer to one customer/property without merging historical jobs.
- **Quote accounting:** Versions have public-only scope lines, SHA-256 identity hashes, integer-cent prices, uniquely indexed command IDs and serial, row-locked revision validation. Previous versions, source links and claims cannot be changed or deleted; subsequent versions supersede earlier customer-approval candidates.
- **Private receipt boundary:** A private table has no Data API grants and uses RLS. A future trusted server must verify provider identity, signature and independent customer action before inserting there. One issuer/event ID cannot replay, and receipt identity cannot be rewritten. A validated work order consumes its matched private receipt exactly once, in the same SQL transaction.
- **Customer quote privacy:** SQL allowlists service, unit, quantity, unit price, item ID and optional public notes; it refuses arbitrary internal costs and inconsistent quote totals. A quote version or historical lead price is NOT an invoice or proof of payment.
- **Permissions:** Every table has RLS; only current company owners and members can read its public records. Viewers, revoked accounts, other companies and anonymous users cannot. Direct authenticated INSERT/UPDATE/DELETE are denied for everyone, including owners, until a separately audited transactional server adapter exists.

## CI verification

The new isolated GitHub job runs scripts/tests/exterior-p3-schema-integration.sh in a disposable PostgreSQL 17 container. It loads the repository's actual workspace membership helper, a fake Auth UID implementation, and fictional two-company/two-visit data. Tests execute as the ordinary authenticated/anon database roles—not solely as database superuser—and cover tenant isolation, member revocation without a new token, lack of direct write grants, private receipt denial, cross-org foreign keys, immutable quotes, compare-and-swap versioning, duplicate provider receipt IDs, private-cost leakage, exact cent totals, stale/superseded versions, and atomic one-time acceptance consumption.

**These are real database behavior tests over synthetic records**, not real production backup recovery, provider signature verification, or a deployed shared client workbench.

## P2 gate and next steps

This SQL is under supabase/staging, not an automatically applied migration. Only after the P2 founder-owned encrypted source backup, independently protected mirror, compatible isolated restore, original Source/Storage byte reconciliation, actor RLS negative tests and rollback may it become a reviewed migration through Supabase CLI. Do not merge old schema PR #42.

The next real product milestone is P3.2: authorized transactional API operations and integration into the existing Estimates and Jobs app. That adapter must recheck source booking identity, customer/property mapping, quote revision, verified external receipt, idempotent command ID, original visit uniqueness and current member permission inside a database transaction. No caller-supplied acceptance-shaped object is trusted.

The existing master engineering score remains **42/100** until there is a real durable shared workflow, even though this stage makes the new backend materially closer to implementation.
