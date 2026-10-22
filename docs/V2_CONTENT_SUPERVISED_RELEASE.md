# OJ Workspace V2 — Oscar Jacob supervised release runbook

**Release status:** Prepared in PR #42. **NOT deployed. Do not merge PR #42 while it includes schema changes and the current Windows updater refuses `supabase/` changes.**

This cutover introduces `content` as a fourth operating brand and adds a production-record workspace for Oscar Jacob. It changes the shape of the shared database; it does **not** delete leads, bookings, users, payments, files, or existing business history.

## 1. Authority and responsibilities

- **Required reviewer:** OJ Holdings founder with production administration authority.
- **App deployment owner:** Windows server operator, responsible for port 3011 and the established Tailscale Funnel 10000. Other STRATHOS services remain untouched.
- **Database owner:** administrator of the established Supabase project `vgckpcktsfuithqggknd`.
- **Release gate:** verified backup and restore process, inspected migration history, passing SQL-isolation tests, both-founder authorization test, app build and rollback plan.

Do not use a generic production SQL paste unless the exact migration is reviewed and a restore path has been proved. Supabase database backups/point-in-time recovery depend on the project plan and settings; **backup existence and restoreability have not been verified by this PR**.

## 2. Read-only preflight

1. Verify expected running production release using `Invoke-RestMethod http://127.0.0.1:3011/api/deploy-health` and Windows release receipts, without touching Tailscale.
2. Verify Oscar and Jacob can sign in to their existing accounts and are still owners; do not reset user IDs.
3. Verify developer branch CI: `npm ci`, `npm run typecheck`, `npm test`, `npm run build`; specifically inspect isolated PGlite tests `tests/v2-content-schema.test.ts` and `tests/content-studio-logic.test.ts`.
4. Record a current read-only snapshot of **counts only** (not private names/addresses): `public.oj_cards`, `oj_messages`, `oj_leads`, `oj_finance_entries`, `oj_metric_entries`, `oj_events`, `oj_documents`, plus `public.leads`, `public.bookings` and membership counts.
5. Verify actual database constraints and migration history, particularly `oj_cards_business_check`, each `oj_*_venture_check`, and the optional `oj_work_sessions_business_check`. Do not rely on filename labels in `supabase/pending/` as proof of unapplied status.
6. Confirm a full, recent recoverable backup is stored, and a restore has been rehearsed in an isolated environment with its owner. If not, **stop the deployment here**.
7. Review proposed privileges: `oj_ventures` read-only for authenticated members, `oj_content_projects` read/write for owner/member, viewer read-only, anonymous denied; audit events readable but not client-writable.

## 3. Database migration — supervised only

- Source: `supabase/pending/V2-four-business-content-foundation.sql` in PR #42, reviewed at a pinned commit SHA.
- The SQL creates a tenant-scoped `oj_ventures` registry and initial rows for the three existing brands plus Oscar Jacob; replaces seven hard-coded venture CHECKs with tenant-matching foreign keys; expands work-session category validation; creates `oj_content_projects` and append-only `oj_content_activity` with role-aware RLS; checks optimistic revisions and manual publication receipts.
- Apply as **one reviewed, recorded migration**, not as arbitrary repeated SQL. Capture timestamp, SQL checksum, database migration identifier and approver. No live migration has been applied by ChatGPT in this release.
- Existing data row counts and identifiers must match preflight values after the migration (account for any permitted concurrent writes).
- Negative access tests must show that anonymous users and outsiders cannot access the registry or content records, viewers cannot mutate records, and members cannot impersonate other users or change organizational ownership.
- Test a company record and content project in **isolated staging**, not by planting fake videos in the production company.

**Important:** the existing Windows automatic deployer correctly refuses commits that modify SQL/schema. This full PR is therefore *not* a release candidate for the five-minute unattended updater. Use a separate reviewed **code-only** release after schema approval, or a supervised migration-aware release process whose authorization has been explicitly tested. Do not disable or bypass the schema guard simply to force the PR through.

## 4. Application release

The application is designed so the old three-business version remains usable after adding the forward-compatible registry and new tables. Only when the migration is verified:

1. Release a **code-only reviewed branch** containing the tested `content` runtime and generated type changes, against the exact DB schema it expects. Preserve the already working Windows updater safety checks and 3011/3012 staging process.
2. Verify `/workspace/b/content` as each of Oscar and Jacob. Create a genuine internal production record only with founder approval; confirm both can see it, edit it and view the audit events.
3. Verify the fourth business appears in HQ, sidebar, business index, shared tasks, finance filters, documents and calendar where authorized.
4. Verify old Exterior, Solutions and Essentials records, assigned tasks, commercial desk, employee portal, Shopify/GHL read views and quote intake still work.
5. Test on phone and desktop, including unsaved drafts, network errors, form validation, fake URLs, concurrent edits and long scripts.
6. Record deploy-health release SHA and supervised user-acceptance receipt. Keep the prior build for rollback.

## 5. Rollback and stop conditions

**Stop** if any historical row count unexpectedly changes, any previously authorized feature loses access, an outsider reads private data, published media are falsely claimed, or CI/health checks fail.

Rollback the **app version** first via existing known-good release and verify existing routes. A schema with new tables and FKs is not automatically undone by reverting JavaScript. Avoid destructive `DROP TABLE`, `DROP COLUMN` or rollback SQL while production writes may have occurred. A reverse database migration requires its own data-integrity review and explicit authorization.

## 6. Signed-off acceptance checklist

- [ ] Verified, recoverable production backup and isolated restore evidence
- [ ] Current live server SHA and updater receipts confirmed
- [ ] All applied migrations reconciled, no blind reapplication
- [ ] PGlite regression suite + TypeScript + production build green
- [ ] Both founders' existing Auth identities and memberships intact
- [ ] Schema migration independently reviewed and manually applied
- [ ] Anon, outsider, viewer, member and owner access tested
- [ ] Seven existing business-record tables preserve all IDs and counts
- [ ] Content project create/update, revision conflict and activity audit verified
- [ ] No live unapproved outreach, payments, media publishing or STRATHOS access
- [ ] Deployment, health, and rollback receipts archived

**No release has completed until all applicable items are checked using actual evidence.**
