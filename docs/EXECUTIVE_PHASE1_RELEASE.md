# OJ Workspace 2.0 — Executive Command & Commercial Desk (Release 1)

Status: feature branch awaiting CI validation. No automatic production deployment or accounting migration.
Baseline: OJ-Holdings/oj-workspace main, 717aae1 (2026-10-20).

## Purpose
Upgrade the founders' daily operating interface using existing authorized records and add an internal commercial scoping/estimating workspace without inventing operational or financial facts.

## Delivered scope

- **Executive Command** replaces the Today hero with a premium responsive operating view: four linked metrics, prioritized open tasks, review/unassigned queues, member-authorized Exterior bookings, direct operational routes, and source-coverage diagnostics.
- **Commercial Desk** lives under Exterior Care / Commercial Desk. Supports up to 12 buildings; floors, panes, crew-hours, lift days, site notes, access assumptions, direct cost inputs, contingency, contribution margin, deposit scenarios, local draft, copy and text export.
- **Existing workflow integration** reuses task dialogs, booking pages, authorized Exterior leads, dashboard finance summaries, and role boundaries. No second CRM or SMS sender.
- **Design** inherits established OJ design tokens and business colors. Responsive layout, keyboard focus and reduced-motion support.
- **Five estimate tests** verify contribution-margin math, multi-building aggregation, bounded calculations, deposit math and the internal-estimate disclaimer.

## Excluded and unverified

No live Supabase migrations, new service-role clients, customer record writes, SMS or email delivery, quote sending, booking, invoices, payment processing, bank transfers or payroll payouts. Project inputs are NOT shared with Jacob; clicking Save stores a draft only in the current browser's local storage. Avoid sensitive customer details on shared computers.

A suggested price is an internal estimate, not a quote, won opportunity, receivable, payment or proven profit. "Recorded this month" uses available reporting records and is not necessarily verified collections.

## Read-only production data finding — 2026-10-22

- 177 Exterior leads, including 71 completed records.
- Revenue figure entered on 54/71 completed records.
- Direct costs entered on 11/71 completed records.
- 80 imported Solutions prospects, without outreach_status overrides at inspection.
- 28 shared task cards.
- Existing production tables include outreach, work sessions and calendar sources, despite the older files labeled pending.

These are point-in-time checks, not hard-coded application figures. With incomplete cost coverage, company-wide profitability must not be implied.

## Protection and release gates

1. Preserve session-bound Supabase, organization membership and RLS; retain partner, owner and employee separations.
2. Preview data belongs only to /preview. Never silently substitute sample records for missing live integrations.
3. No changes to outbound SMS sender. Do not alter existing calendar PR #17 in this release.
4. Run npm ci, npm run typecheck, npm test and npm run build in CI.
5. Review /preview and /preview/b/exterior/commercial at desktop and phone widths with focus, keyboard and reduced-motion behavior.
6. Confirm signed-in founder navigation and member restrictions; confirm viewers cannot access Exterior customer details.
7. Check KPI totals against Finance, Tasks and Exterior bookings. Verify pricing controls never write customer data.
8. Netlify builds main: require review and successful CI before merging. Roll back deploy if a critical regression appears.

## Subsequent releases

- Proper shared commercial project records with additive migrations, RLS, approvals and audited opportunity/quote/booking/payment stages.
- Customer/property links that preserve historical jobs and source IDs.
- Dated, source-evidenced Solutions contact activities, follow-ups, pipeline ownership and client projects.
- Payment and cost data completeness, collection dates, receipts, commissions and reviewed bank matching.
- Phone-first dispatch and closeout workflow with employee permission tests.
- Further UI regression and production safety checks.

## Business boundaries

OJ Workspace is jointly operated by the founders; it is separate from STRATHOS and Strathion Group. External outreach, purchases or autonomous commercial activities require explicit authorization, evidence and stop controls. Mercury stays owner-only under the current design.
