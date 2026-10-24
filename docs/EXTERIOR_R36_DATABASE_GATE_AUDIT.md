# Exterior Command R36 — production shared-data gate audit (read-only)

> Snapshot: October 23, 2026 America/Chicago / October 24 UTC. Production Supabase project `OJ EXTERIOR CARE LEADS` (`vgckpcktsfuithqggknd`). This file is a **point-in-time audit**, NOT a backup receipt, access proof, restored system, migration authorization, or guarantee of platform security. Repeat live checks before use.

## What was directly verified

- Connected project listing: `ACTIVE_HEALTHY`, PostgreSQL 17.
- Read-only `list_tables(public)` on project: original `leads` (**177** rows), `bookings` (**15** rows), `oj_memberships` (**2** rows), plus the previously deployed board, employee and other business tables. Row estimates change, are not record-level reconciliations, and do not prove who can access data.
- Read-only catalog SQL: `leads`, `bookings`, `oj_memberships` tables all present; nine catalog RLS policies across those three source tables. New shared Exterior quote/work-order tables in the planned set (`oj_exterior_quotes`, `oj_exterior_quote_versions`, `oj_exterior_quote_events`, `oj_exterior_work_orders`, `oj_exterior_field_events`) are **absent** (0 matching names). No DDL was performed.
- Security advisor has warnings about **5 public SECURITY DEFINER functions executable by the anonymous role**. Four of the names involve token-based invites/calendar flows and may be deliberately exposed; their risk cannot be judged by execution grants alone. Review each function's permission checks, error behavior, rate limiting and exact intended exposure before changing EXECUTE. Advisor reference: https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable
- Advisor informational `rls_enabled_no_policy` findings include `public.settings` and private `oj_private.*` tables. This is not itself proof of a data leak; inspect actual grants, exposed schemas and authorized RPC wrappers. Reference: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy
- Production `main` is the only returned Supabase branch; it does **not** establish an isolated, restored production backup.
- **No evidence** was obtained of an encrypted logical backup archive, separate tested restore, object-byte backup or founder-device synchronization. Supabase plan and connection do not prove these occurred.

## Official backup requirements

Supabase says scheduled managed backups are provided on Pro/Team/Enterprise, and free-tier users should create regular logical exports (CLI `db dump` or PostgreSQL `pg_dump`) and off-site copies: https://supabase.com/docs/guides/platform/backups

This repository already contains `scripts/backup-supabase-windows.ps1` and `docs/BACKUP_FREE_TIER_WINDOWS.md`, including DPAPI credential storage, SHA-256 manifest, custom pg_dump archive and format inspection. **A readable archive / checksum is not an independent restore.** The archive is not encrypted by that script: both primary and off-device copies require encrypted private disks/storage. Storage API object bytes are not in pg_dump. No secrets or customer record exports may be committed to GitHub.

## Exact unresolved evidence checklist

1. Founder/operator verifies PostgreSQL 17 CLI tools and Supabase session-pooler configuration on the existing trusted Windows host. Never send the database password/URI into chats, PRs or logs.
2. On that host: `scripts/backup-supabase-windows.ps1 -Action Backup`, then `-Action Verify`. Retain archive manifest, SHA-256 and timestamp **privately**; establish an encrypted off-device copy and verify it independently.
3. Restore in a **disposable, physically separate PostgreSQL 17 / Supabase-compatible environment**, not the live project or the currently used employee portal test project. Reconcile schema, row counts, original IDs, grants, policies, key RPCs, auth and separate Storage object bytes. Keep all SMS/calendar webhook senders OFF.
4. Prove actual database isolation using authenticated owner, member, viewer, revoked-user and outsider/anonymous **negative tests**, cross-org reference denials, stale revision conflicts and explicit Data API GRANT/RLS. Do not equate the admin SQL connection with ordinary user access.
5. Stage exact reviewed additive migrations for `quote_versions`, event receipts, work orders, field events and asset reservations with immutable provenance, composite organization foreign keys, version conflict protections and rollback. Preserve original lead, booking, source-SMS and invoice semantics.
6. Only after the isolated restore and staging permission tests pass, deliberately authorize supervised production migration and code flag cutover. Test Oscar/Jacob on two independent devices against the same authorized server records before calling anything synchronized.

## R36 engineering decision

**No production database schema write was allowed or executed.** Instead [feature PR #116](https://github.com/OJ-Holdings/oj-workspace/pull/116) delivered read-only Source-Qualified Dispatch Preflight and corrected repeated lead-level quote attribution in real operational views. Those changes rely only on existing authorized source reads and introduce no customer mutation.

Next release should prioritize a real recoverable private backup/isolated restore and staging RLS proof when the founder-controlled infrastructure is available. Avoid endlessly adding duplicate local-only apps merely because schema operations are currently blocked.

## Independent completion criteria (never inferred from source code)

Record privately: backup SHA-256, UTC creation time, encrypted storage destinations, restore target identity, restore command exit status, schema and business row reconciliation, allowed/denied RLS test receipts, disabled-customer-messaging verification, recovery drill reviewer, and rollback/provisioning outcomes. GitHub can hold a **sanitized pass/fail attestation with no credentials, PII or archive bytes**, never the underlying backup.
