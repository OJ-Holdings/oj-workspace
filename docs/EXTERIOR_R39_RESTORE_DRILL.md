# Exterior Command R39 — Protected database recovery drill

**State:** Operator-run recovery tooling implemented in code; **NOT a completed production restore**. No live data, database schema, customer messaging, employee portal, payments, deployments or production keys were modified by the R39 pull request.

## What Release 39 adds

The previously available `scripts/backup-supabase-windows.ps1` creates a PostgreSQL 17 custom-format logical archive, a SHA-256 manifest, and can verify archive readability. Readability is **not restoration**.

`scripts/backup-supabase-windows.ps1` now streams `pg_dump` directly through age encryption into `.dump.age` files. It verifies age authentication and PostgreSQL archive readability without writing plaintext archive bytes to disk. `scripts/restore-supabase-isolated.ps1` decrypts to `pg_restore` through a pipe; it does not create a plaintext temporary archive. The utility still supports legacy synthetic `.dump` fixtures only for the existing mechanical regression suite.

The restore helper introduces three separately gated actions:

| Action | What it proves | What it cannot prove |
|---|---|---|
| `Inspect` | Local archive path, pinned production project reference, size and SHA-256 match its private manifest; age authentication and PostgreSQL 17 `pg_restore --list` can read it | Restore, completeness, Storage object bytes, member RLS, app availability |
| `Restore` | Operator confirmed a specially named, **empty, loopback-only disposable** Postgres target and the archive was restored in one transaction without PostgreSQL errors; required OJ business/auth tables and RLS policy definitions exist and can be queried by the administrator | Production source row equivalence, actual signed-in user authorization, global roles/grants, storage objects, SMS suppression, application recovery |
| `VerifyTarget` | Fresh query matches the **private mechanical receipt** from the earlier restore | Independent production recovery or permission/role tests |

Strict default behavior: **fail closed**. Remote targets, pooler hosts, port 5432, ordinary database names such as `postgres`, missing confirmation phrases, existing target tables, reused receipts, absent/mismatched archives, bad checksums, invalid PostgreSQL client versions, failed restore exit codes and missing RLS policy definitions all block the relevant action. The program has **no --clean, DROP, CREATE DATABASE or production connection code**, and does not import source credentials from the backup configuration.

All logs and receipts stay in private non-repository directories. A successful receipt intentionally records `complete_application_recovery_verified: false`, `source_vs_restore_reconciled: false`, `authenticated_rls_actor_tests_passed: false`, `storage_objects_restored: false` and `production_migration_approved: false`. A mechanical restore is never a release authorization.

## R40 companion operator preflight

Before using the R39 tool directly with actual private data, follow the [R40 founder recovery gate](./EXTERIOR_R40_PRIVATE_RECOVERY_GATE.md). Its Windows-only helper verifies age-encrypted archive integrity, exact latest archive SHA-256 + manifest, matching mirror on a separate physical disk, and PostgreSQL 17 TOC. It delegates guarded backup and local restore to these existing scripts, but will **not** mark actual source parity, actor RLS, Storage file bytes, truly off-device storage or migration authorization as verified. Do not share private receipts or files with chat/GitHub.

## Operator-controlled rehearsal on the trusted Windows computer

First ensure a verified private encrypted primary/off-device backup exists. Do not send credentials, archive files, manifest, exact database host, Auth users or backups into chats, GitHub, email, tickets or SaaS upload tools.

~~~powershell
cd C:\STRATHOS\apps\oj-workspace-deploy-test
.\scripts\backup-supabase-windows.ps1 -Action Verify
.\scripts\restore-supabase-isolated.ps1 -Action Inspect
~~~

An administrator must then prepare an **isolated, freshly created, empty PostgreSQL 17 database** using an appropriate locally controlled Supabase-compatible environment. Install the required Supabase-managed global roles and PostgreSQL extensions *in that isolated environment*, before attempting a full Supabase dump restore. Do **not** point at the live Supabase project or the existing `OJ Employee Portal Test` project. A generic new Postgres container does not automatically contain Supabase-managed roles/extensions; if a restore fails, repair prerequisites, destroy the disposable environment **manually**, provision a new database and repeat. Never bypass restore errors.

The target connection is available on **127.0.0.1 only**, at a dedicated non-default port, and the database is freshly named `oj_drill_...` (8–24 lowercase letters/numbers after the prefix). It must contain zero preexisting user tables/views. Even a preconfigured local Supabase development stack may contain tables; do not override this emptiness test or restore onto populated objects. An operator may need a separate empty DB with the platform's required roles/extensions pre-provisioned at cluster level.

The local scratch-target password belongs in the operator's private `PGPASSFILE` or temporary `PGPASSWORD` environment variable. **Use a fresh unrelated disposable password**, not the live production password. Nothing is passed in CLI flags or checked into source control.

~~~powershell
# EXAMPLE ONLY: database and local PostgreSQL instance must ALREADY be prepared.
# Use an actual unique, empty disposable database name and your chosen local port.
$database = "oj_drill_a1b2c3d4"
.\scripts\restore-supabase-isolated.ps1 `
  -Action Restore `
  -TargetHost "127.0.0.1" `
  -TargetPort 15432 `
  -TargetDatabase $database `
  -TargetUser "postgres" `
  -TargetConfirmation "RESTORE ONLY INTO $database"

# Reread the restored local source and check it still matches its saved private receipt.
.\scripts\restore-supabase-isolated.ps1 `
  -Action VerifyTarget `
  -TargetHost "127.0.0.1" `
  -TargetPort 15432 `
  -TargetDatabase $database `
  -TargetUser "postgres" `
  -TargetConfirmation "RESTORE ONLY INTO $database"
~~~

The transcript above is guidance only; it has **not** been executed against a real production archive as part of Release 39. Archive and receipt paths default to the existing private Windows backup area; pass absolute `-ArchivePath` and `-EvidenceDirectory` to override privately, not inside the source checkout. Inspect/Restore don't execute external customer notifications by themselves, but the isolated environment **must** have any custom triggers, email/SMS/queue/webhook endpoints disabled and credentials removed before loading production data. Treat all local restored personal records as confidential.

## What must be checked before a real schema cutover

A mechanical restore PASS is necessary but **not sufficient**. Separately collect private signed-off evidence of:

1. **Encrypted copies:** archive SHA-256 and private manifest match primary encrypted at-rest storage and a separately verified encrypted off-device copy; operator can actually decrypt/open both.
2. **Isolation/restore:** disposable target identity, no old customer data, complete exit-code-zero restore, original object schemas/constraints/functions and specific archival exclusions understood. A placeholder or a synthetic-data fixture does not count.
3. **Source reconciliation:** compare **same-time** source and restored exact lead, booking, organization, membership, card, comment, Auth, storage metadata and quote/contact row counts. Where allowed, verify legacy IDs, selected hashes, business totals and date provenance **without exposing PII**. Do not use approximate old counts as equality evidence.
4. **Auth/RLS actor matrix:** use actual per-role credentials in isolated staging—owner, member, viewer, removed member, outsider, anonymous. Test allowed reads/writes, denied writes, cross-org foreign-key attempts and stale revisions, plus authenticated metadata separation. An admin `psql` count is **not** an RLS test.
5. **Storage:** PostgreSQL dumps contain Storage **metadata**, not uploaded object bytes; enumerate/copy the required objects via supported Supabase Storage APIs to encrypted private storage and prove test retrieval with correct policy behavior. Guard against reconnecting to live object storage.
6. **Operational cutover:** confirm outbound SMS/email/webhooks stay OFF in recovery, versioned controlled migrations, rollback plan, a real original customer record/quote lineage and Oscar+Jacob's two separate device acceptance. Verify the exact Windows-served commit independently.

Only after **all** of these are satisfied, and a founder explicitly authorizes the release, may a scoped migration PR for `quote_versions`, `quote_events`, `work_orders` and `field_events` be staged for production. Never infer authorization from PR green, a receipt JSON, the presence of another testing project, or a successful administrative connection.

## Automated checks in CI

`scripts/tests/restore-supabase-isolated.Tests.ps1` runs deliberately OFFLINE; it tries ten unsafe/invalid destination scenarios and requires every one to be rejected **before database or archive access**. GitHub CI also parses the scripts with PowerShell and runs existing npm typecheck/test/build. This does **not** establish a successful restore from a real archive; founder-controlled rehearsal remains mandatory.

## Official references

- [Supabase Backup and Restore](https://supabase.com/docs/guides/platform/backups)
- [Supabase: Restore platform project to a self-hosted instance](https://supabase.com/docs/guides/self-hosting/restore-from-platform)
- [Supabase: Restore downloaded backup locally](https://supabase.com/docs/guides/local-development/restoring-downloaded-backup)
- [Supabase PostgreSQL Row-Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)

**Release 39 scope:** Recovery infrastructure and tested safety guards only, with no production restore performed or claimed. All existing customer/quote/field applications continue operating under their previous boundaries.
