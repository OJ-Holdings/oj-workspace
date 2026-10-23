# ATLAS Accounting / Treasury Command — engineering and rollout

**Release:** ATLAS V3 Release 20 (code-only). **Scope:** Existing OJ workspace. **Production accounting status:** NOT a posted general ledger, tax service, settlement/reconciliation service, or CPA replacement.

## Why this release exists

Founders must see actionable financial reality, not counts of finance rows. R20 promotes loaded operational totals, cost drivers, venture contributions and source gaps over generic "money entries" counters. It also introduces a strictly isolated, side-effect-free double-entry journal validator for the future accounting platform.

### What R20 actually ships

- Treasury cockpit from the user's already-authorized finance entries: dated income/cost, prior-month context, category expense mix, venture-specific recorded differences, real data-quality warnings and existing job report deep links.
- Authorized owner-only Mercury **linked account balance** when account balances are present, available, all USD and source state is fully available. This is only *known linked Mercury current balance*, never consolidated corporation cash, reconciled cash or profit.
- Existing authorized expense/income form, source/manual ledger filter, historical trend, owner-only bank detail, deep links, permission boundaries and transaction history remain. A quote, Shopify order and job amount are NOT automatically proof of bank settlement.
- Pure, review-only `atlas-accounting-core.ts`: explicit legal entity, chart accounts, approved journal drafts, balanced integer-cents debits/credits, calendar/period lock guards, currency and entity isolation, inactive-account rejection and deterministic in-memory trial balance. **No legacy financial row is silently balanced or posted.**
- No Supabase schema, private integration token, bank write, scheduled tax activity, AI background financial action or retroactive customer data conversion.

### Financial provenance contract

| Source | What it can establish | What it cannot establish |
| --- | --- | --- |
| Legacy Exterior completed job | Manually recorded payment/cost amounts tied to a job; possible inferred job date | Invoice issued, settlement timestamp, final margin or proof all expenses have been allocated |
| Shopify paid order rows | Reported order/payment status and recorded order timestamp subject to connector coverage | Actual net bank payout, landing cost and fully allocated ad fees |
| Workspace manual money entry | User-entered amount, category, selected business and date | External settlement, accounting classification, receipt, matching payment, tax deduction |
| Mercury owner read snapshot | Specific linked account current/available balances and reported transaction states | All company accounts, matched revenue, merchant processor payout net, business P&L |
| Finance reporting source status | Provider availability and bounded completeness where returned | Universal book reconciliation and complete tax filings |

**Never calculate an assured profit figure from the presence of just one cost row**; both sources and allocation coverage must be complete enough for the stated profit scope. Distinguish `null` (unknown) from recorded $0. A proposed accounting statement cannot be marked final until opening balances, account ownership and every period transaction are reconciled.

## Double-entry migration: protected, not automatic

1. **G0 data gate:** verify actual Windows release, run a private recoverable Postgres backup and restore on isolated infrastructure, review live schema, RLS, storage access and identity rules. Draft PR #42 remains separate and unmerged.
2. **Entity classification:** confirm actual legal LLC(s), federal tax classification and documented founder agreements. `VentureId` is a reporting cost center, **not** inherently a separate legal entity. Intercompany entries are explicit, never automatically netted.
3. **Ledger contracts:** additive, individually reviewed `accounting_entities`, `accounts`, `periods`, `journal_entries`, `journal_lines`, `source_mappings`, `approvals`, `audit` with organization-qualified references, strict currency and role/grant invariants.
4. **Posting invariants:** immutable balanced entries in integer cents (two or more lines), idempotent external references, deterministic reversals instead of deletion, approval authority and locked period guards. Owner, member, viewer and outsider negative permissions tests before deployment.
5. **Source migration pilot:** compare a tiny approved synthetic/isolated fixture from prior Finance against actual bank statements, payment receipts and supplier costs; never infer asset vs expense, owner draw vs payroll or tax treatment from free-text labels. Operators review any proposed mapping.
6. **AR/AP + reconciliation:** invoice issuance/due dates, paid/refund/bad debt states and bank/processor settlement evidence. Separate sales from transfers and owner capital. Reconcile every statement against account balances, with exception work queues.
7. **Close, statements, audit:** monthly trial balance, P&L, balance sheet, statement of cash flows (only when underlying posting is complete), corrections, approval and locked period snapshot with source receipts.
8. **Tax-prep desk:** linked receipts, mileage/business-use evidence, asset depreciation basis and accountant workpapers. Confirm partnership/elected tax treatment and Wisconsin obligations with a qualified advisor. E-file only through verified supported authorized processes; no claim that the AI can independently practice as a CPA.

## High-ROI connected workflows

- Exterior: inquiry → booked work → actual field costs → invoice → partial/full settlement → margin evidence → rebooking
- Solutions: client subscription contract → invoice → MRR obligation → successful collection → attributable agent/cloud costs
- Essentials: order → refund/fees/fulfillment → merchant payout reconciliation → landed product contribution
- Founders: cash contributions, reimbursements, allocations, owner distributions and capital accounts independently supported by legal/tax classification
- Corporate: vendor subscriptions, insurance, fleet parts, ad spend and capital expenditure choice linked to account/cost center and asset receipt

## Acceptance criteria / limitations

R20 passes TypeScript, behavioral tests and production build on the exact PR head; then independent post-merge main CI. On an authorized real source, verify selected month, venture and owner bank visibility, unknown cost handling, sourced status and mobile UX. A GitHub merge does not establish deployment on the Windows port 3011/Tailscale host. If source loading fails, render an unavailable state, never fictional financial values.

**Product standard for all modules:** a headline metric should support a decision, evidence-backed risk or useful action. Record counts belong within operational filters if helpful, not as flagship business KPIs.

## R22–R23: Bank review and month-end preparation (code-only implementation)

- **Release 22 / Bank Review:** `atlas-bank-review.ts` and `AtlasBankReview.tsx` compare the most recently returned Mercury bank rows with already-visible operational entries using USD magnitude and date proximity as **candidate suggestions only**. It handles Chicago-local date/DST, non-USD, missing dates, duplicate candidates, source timestamps and inaccessible bank feeds explicitly. Entry candidate links are owner-only. Neither signed amounts nor statuses are promoted to classified journal entries or settled cash.
- **Release 23 / Close Preparation:** `atlas-close-prep.ts` and `AtlasMonthEndPrep.tsx` provide a period-scoped workpaper checklist: uncategorized rows, estimated source dates, missing recorded income/cost evidence, disconnected/partial upstream sources, plus unfulfilled infrastructure obligations (approved journal, full bank statement reconciliation, receipt evidence, AR/AP/owner equity). A TXT brief can be downloaded by the operator after explicit confirmation. No close state is stored or asserted.
- **Hard limitation:** The source feed currently returns no more than **50 most-recent bank transactions**, not a complete period statement. The existing Finance table is not a GAAP chart of accounts. A possible bank candidate is not evidence of the same legal entity, account, debit/credit intent, processor net payout or cleared funds.
- **Protected next stages:** Supervised live backup+restore and RLS gate, proper accounting entity identification, multi-account bank statement imports with paging and completeness, immutable balanced journal postings, multi-founder approval and reversal audit, exact source mapping, true reconciled statements, tax-prep attachments and reviewed period locks. Do not cut corners on journal integrity or database backup. Existing draft database migration #42 remains blocked.
