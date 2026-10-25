# Exterior P3 — Canonical quote/work-order domain contract (staging foundation)

**Release:** P3.0 backend contract; October 24, 2026. **No production migration, direct SQL, new API, or customer mutation.** P2 production recovery and authenticated actor-access evidence still gate activation. This package is intentionally **backend-first** and does not add more NEXUS/Command UI.

## Why this exists

The R27–R49 operator features can trace a legacy lead through a booking, internal estimate and company task, but the lead's \`quote_amount\` is **not** an immutable customer-facing proposal or a verified approval. There is no permanent shared property/opportunity identity or authenticated booking-bound work order yet.

P3 begins with the actual business invariants instead of styling another screen. The module \`src/lib/exterior-p3-workflow.ts\` is a deterministic, server-oriented domain contract and dry-run engine with pure transitions. It is not yet connected to Supabase or production state.

## Domain identity and lifecycle

A P3 opportunity is keyed by **organization + canonical customer + property + original legacy lead + opportunity + quote**. \`targetBookingId\` binds an opportunity to one exact visit when known. The original lead is a source reference, not a deduplication algorithm. Never combine customers because they share a phone, street address, name, or repeated appointment.

1. \`newP3QuoteLedger\`: validate the complete identity; start revision zero, no quote versions, no accepted customer, no work order.
2. \`appendP3QuoteVersion\`: require expected ledger revision and unique UUID command/version identity; validate original lead's latest revision and original price, internal estimate quantities, discounts and finite calculations; snapshot only customer-visible scope and exact integer-cent prices. Version numbers increase monotonically. Old snapshots are frozen and retain their original SHA-256 content hash.
3. \`appendP3AcceptanceClaim\`: append **unverified** evidence references to a specific immutable version and optionally a specific booking. Operator recollection, message IDs and document references cannot become "accepted" simply by adding a label.
4. \`preflightP3WorkOrder\`: check identity mapping, complete original source windows, exact confirmed source booking/date/time, nonambiguous visit, latest quote source revision, structurally matching externally attested acceptance, complete existing-order count and no already-bound order. Return a **read-only candidate**, explicitly \`transaction-not-executed\`, never a real booking/dispatch/settled receipt.

The module has no network access, Supabase client, storage, service role, SMS, email or money side effects. A future production adapter must implement the actual immutable relational writes, rights, concurrency and external evidence verification.

## Immutable/public vs internal boundaries

The version snapshot includes normalized customer-visible quote lines, quantity/unit, unit prices in integer cents, source revision/price, discount and public subtotal/total. It **does not** contain \`costPerUnit\`, private travel costs, actual job costs, profit, customer private notes or job revenue. Private cost details later require a separately permissioned cost ledger. The content hash includes organization, customer/property/legacy source opportunity, visit identity, all version metadata, customer scope and price.

Unknown costs remain unknown. Neither historic revenue nor an existing legacy \`quote_amount\` proves a paid invoice.

## Trusted acceptance boundary — mandatory before any DB transaction

**Crucial:** \`P3Attestation\` is only an **input interface**, not a security credential. A browser or caller can fabricate a JavaScript object with matching fields. The pure preflight checks structural linkage but **cannot validate** a webhook signature, signed document, provider account, replay protection, sender identity or receipt custody.

Therefore, before wiring this contract to a live endpoint:
- Only a server-side provider adapter may construct an attestation, and only **after** checking signatures and the provider's authoritative receipt/tenant identity using trusted secrets outside source code.
- Bind its verified receipt to exact organization, customer, property, quote, immutable current version hash, price, and exact booking. Deny previous-version acceptance after edits. A recorded \`P3AcceptanceClaim\` is never sufficient.
- Enforce the attestation issuer, provider event ID uniqueness and consumed/nonce replay status transactionally in the database. Require an actual verified customer action; operator manually marking "approved" is a claim, not independent proof.
- Never expose \`preflightP3WorkOrder(..., acceptance=...)\` as a client-authorized approval/write endpoint. The API must derive identity, membership, provider evidence and quote from protected server/database records.

Until this adapter exists, all \`eligible=true\` test outputs are **synthetic eligibility simulations** and remain \`transaction-not-executed\`.

## Required database adapter and row-locked transaction (future P3.1)

All identity and state checks must be repeated under authenticated server request context within a SQL transaction, not against mutable browser state. Suggested staged relational model:

| Relation | Required uniqueness/invariant |
|---|---|
| \`oj_exterior_customers\` and \`oj_exterior_properties\` | Tenant-bound canonical IDs; explicit legacy lead/customer/property mapping, no heuristic merge |
| \`oj_exterior_opportunities\` | Tenant + canonical customer/property + original lead + visit identity; revision CAS |
| \`oj_exterior_quotes\` | Tenant + opportunity; latest-version pointer, no phantom sent/accepted status |
| \`oj_exterior_quote_versions\` | Unique (tenant, quote, sequence); immutable public scope/content hash and segregated protected costs |
| \`oj_exterior_quote_events\` | Immutable append-only event/receipt, unique command and provider evidence IDs |
| \`oj_exterior_work_orders\` | Unique tenant+original booking, FK to exact accepted latest immutable version and customer/property/tenant IDs |
| \`oj_exterior_order_events\` | Protected transition receipts, separate from assignment and actual financial settlement |

The future transaction must:
1. Acquire a lock on tenant opportunity and latest quote pointer. Verify expected revision/version hash and current version.
2. Resolve the original booking and legacy customer/property mapping **from the source**, confirm it and verify its date/time and visit identity; reject partial source lists and outdated source stamps.
3. Verify the independent acceptance artifact in a trusted server-side adapter (never trust client-supplied "verified" flags); atomically consume its provider event/replay ID.
4. Enforce unique booking→work-order binding and idempotency key in the same transaction; an interrupted retry must resolve to the original receipt, not create a second order.
5. Insert immutable work order scope/approval/source snapshots and append an operator-auditable receipt in the same transaction. No automatically sent customer text, crew shift, invoice or deposit.
6. Expose least-privilege RLS + explicit Data API grants; check actual owner/member/viewer/revoked/outsider/anonymous negative actor matrix and separate price/cost visibility.

The existing schema gate [PR #42](https://github.com/OJ-Holdings/oj-workspace/pull/42) is a separate older broad migration and is NOT a shortcut or an automatic authorization for this architecture.

## Regression evidence

\`tests/exterior-p3-workflow.test.ts\` tests:
- Public/versioned quote lines and cents, copy isolation and private cost/lead note exclusion.
- Stale original source, mismatched lead, non-finite/invalid pricing, bad ids, source revision conflicts, command replay/idempotency and wrong reused keys.
- Monotonic version sequence, immutable old version, unverified claimed signature/provider references.
- Superseded version, wrong tenant/customer/property/booking/price/content hash or malformed attestation receipt.
- Missing/duplicate originals, source list truncation, canceled/pending/invalid-time booking, same-lead repeat visits, unknown work-order coverage, duplicate existing orders and source price drift.
- All successful previews return \`transaction-not-executed\`, never mutation or cash.

CI (TypeScript + tests + Next production build + synthetic isolated PostgreSQL 17 restore) proves this contract executes safely; it does **not** prove real production migration or customer acceptance. Continue the P2 actual private recovery and founder adoption work alongside this staged P3 engine.

## Roadmap and owner experience

This P3.0 package is the first reusable backend foundation for W3/W4. It does not make permanent shared quotes visible to Jacob yet; the next milestone after P2 is **P3.1: transaction-backed tenant-safe database tables and server APIs**, followed by **P3.2: wire the existing Estimate and Booking apps**, preserving direct links and familiar workflows. P4 then wires real crew and fleet reservations and shared field evidence to the same work order; P5 adds invoice/collected-funds truth.

The original 12-wave engineering estimate remains **42/100** until a merged and usable persisted workflow merits points. Nothing is created in production by importing or running this contract.
