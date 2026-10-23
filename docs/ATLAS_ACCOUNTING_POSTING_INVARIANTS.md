# ATLAS Accounting — durable ledger posting preflight (Release 25)

## What exists now

The code-only `src/lib/atlas-posting-preflight.ts` composes the existing `atlas-accounting-core.ts` journal validator into an **all-or-nothing in-memory review**. It checks legal entity boundaries; unique account IDs and within-entity account codes; distinct journal identity and idempotent `entity+sourceId`; valid amounts and equal debits/credits; locked periods; named human approver; and resulting account-level balanced trial balances. Zero accepted journals is not a complete book. Result keys use a null-prototype map so untrusted entity labels cannot affect prototypes.

Reversals are prepared as **new, explicitly identified drafts**, swapping debits/credits while retaining the original unchanged; no auto-deletion or overwritten journal history.

## What this does NOT do

No accounting statements are final. No authorized approver role is checked from this pure function, only nonblank presence; a real DB action must separately validate the authenticated, organization-scoped actor, enforce approval workflow and restrict who may post. There is no persistent journal, source receipt, account ownership record, FX engine, period ledger, settled bank balance, tax deduction determination, intercompany-elimination layer, e-filing, or proof source transactions are complete.

`entityId` is an accounting legal-entity scope, **not** automatically one of the four ATLAS operating brands. No source/transaction gets auto-mapped to a cash account simply because it carries a negative or positive amount. Opening balances require independent records.

## Gate for persistent books

1. Verify private production backup and independently rehearse isolated restore; verify migration history and actual schema/RLS. Protected migration PR #42 is NOT to be merged alongside this code-only release.
2. Identify the actual filing and legal entity structure and reviewed chart of accounts.
3. Draft additive accounting tables and immutable posting journal with organization-qualified composite keys and double-entry enforcement at transaction commit time (not UI only), database-tracked status/approval/actor/time and source idempotency.
4. Test outsider, revoked, owner, member and viewer permissions against isolated DB. A balance reversal must explicitly link to original posted entry and require appropriate approval and an unlocked period, with an immutable audit chain.
5. Reconcile complete bank statement periods and opening/closing balances, with approved source-level match receipts, before allowing month closure. Unreviewed or inconsistent periods must fail closed.
6. Only after approved persistence and complete evidence can actual P&L, balance sheet, cash flow, owner equity and tax-prep schedules be flagged ready for professional/owner review.

**Release test gates:** exact PR-head npm ci + typecheck + full test suite + build, main CI, then independently inspect Windows 3011 serving SHA and real founder access. Synthetic tested journals are not live approved books.
