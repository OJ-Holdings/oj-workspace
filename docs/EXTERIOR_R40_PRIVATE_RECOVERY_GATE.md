# Exterior R40 — Founder-owned production recovery gate

**State:** Read-only production catalog verified October 24, 2026, 11:58 UTC. Private Windows recovery tool implemented. **Actual founder production backup and isolated restore have NOT been performed or verified.** No customer records were extracted to GitHub, changed or migrated.

## Why this requires the trusted Windows host

Connected Supabase tools support production metadata checks but do not expose a complete private encrypted database archive or the user's local disk. GitHub CI restores only synthetic test data. Neither can substitute for founder-held backup media, isolated Windows restore or signed-in user-role checks.

**Do not paste or upload database passwords, archive files, DPAPI credentials, storage object bytes, user IDs, customer files or private receipts into chat or GitHub.** The sanitized JSON below is designed not to contain any of those details.

## Live source findings

- Production is reachable, PostgreSQL 17.6, existing leads, bookings, memberships, tasks and comments have row-level security enabled. This catalog check alone does NOT prove access is correctly restricted for revoked or outsider accounts.
- The new shared Exterior quote/work-order/field-event tables remain absent, as required; no production DDL was executed.
- **Supabase Storage contains separate uploaded object bytes.** A database pg_dump includes Storage metadata but NOT those object bytes. An encrypted separate object download with recovery checks is required.
- Supabase warns raw pg_dump may include managed internal schemas/roles that will not restore into generic PostgreSQL. Use a compatible isolated Supabase environment or the officially documented CLI roles/schema/data backup and recovery sequence rather than bypassing errors.

References: [Supabase platform backups](https://supabase.com/docs/guides/platform/backups), [self-hosted recovery](https://supabase.com/docs/guides/self-hosting/restore-from-platform), [R39 isolated restore](./EXTERIOR_R39_RESTORE_DRILL.md).

## Start with one read-only preflight on the trusted computer

Run in PowerShell as the SAME Windows account owning the private backup DPAPI credential:

~~~powershell
cd C:\STRATHOS\apps\oj-workspace-deploy-test
git pull origin main
.\scripts\exterior-r40-recovery-preflight.ps1 -Action Status -EmitSanitizedJson
~~~

Status does NOT connect to the source database or create a backup. It requires exact source project configuration, a correct SHA-256 age-encrypted archive+manifest, byte-identical mirror, distinct physical disks, and successful age authentication plus PostgreSQL 17 archive readability. It prints no local path, password, customer record or archive hash. Distinct attached disks are not proof of off-device storage.

If configuration is missing, use the existing interactive setup privately. The archive is encrypted with age before it reaches disk, so BitLocker is not required. The configured E: mirror must be a different physical disk from the C: primary. It becomes off-device protection only after you disconnect and store it separately. Setup asks for the database host, username and hidden password, prints a recovery identity once, and then stores a DPAPI-protected copy under your Windows user. Save that recovery identity in a separate secure vault before confirming `SAVED`.

~~~powershell
.\scripts\backup-supabase-windows.ps1 -Action Configure -OffsiteDirectory "E:\OJ-Holdings-Encrypted-Backups\Supabase"
~~~

When configuration is complete, create a new private encrypted archive and verified mirrored copy:

~~~powershell
.\scripts\exterior-r40-recovery-preflight.ps1 -Action Backup -EmitSanitizedJson
~~~

The report deliberately keeps physical_off_device_separation_operator_verified FALSE: two drive letters do not independently prove physical separation. Verify this yourself.

## Isolated real restore

An operator must first create a SEPARATE, empty, compatible disposable PostgreSQL 17 database bound to localhost at a non-default port (e.g. 15432). It must have required Supabase-managed roles/extensions yet contain no user tables. NEVER use the production database, an existing employee portal project or an already populated local Supabase development stack. Keep email, SMS, webhook integrations and production secrets disconnected. Use a new scratch password in a private PGPASSFILE or PGPASSWORD environment variable, NOT the production password.

~~~powershell
# Example database name only, the database must already exist and be empty.
$db = "oj_drill_20261024abc"
.\scripts\exterior-r40-recovery-preflight.ps1 -Action Restore -TargetDatabase $db -TargetPort 15432 -TargetConfirmation "RESTORE ONLY INTO $db" -EmitSanitizedJson
.\scripts\exterior-r40-recovery-preflight.ps1 -Action VerifyTarget -TargetDatabase $db -TargetPort 15432 -TargetConfirmation "RESTORE ONLY INTO $db" -EmitSanitizedJson
~~~

If the raw archive cannot restore successfully, STOP. Diagnose in private, prepare an appropriate Supabase-compatible target or switch to the documented Supabase CLI roles/schema/data recovery process, and try a NEW empty disposable database. Do not weaken fail-closed checks.

**Even a successful mechanical restore does not authorize live migrations.** Source-to-target consistency, authenticated owner/member/viewer/revoked/outsider/anonymous RLS actor tests, Storage object bytes, notification isolation, and rollback must each be proven independently.

## Current gates

| Condition | Status |
|---|---|
| Production metadata accessible and RLS enabled on original source | Verified |
| R39 two-container synthetic PG17 restore pipeline | Verified |
| R40 age-encrypted archive, separate-disk mirror and recovery preflight code | Implemented, owner Windows acceptance pending |
| Real private archived source + separate encrypted off-device copy | Not verified |
| Actual restored production archive + source parity | Not verified |
| Authenticated RLS negative tests and Data API grants | Not verified |
| Separately restored Supabase Storage object bytes | Not verified |
| Real served Windows SHA and two-founder phone acceptance | Not verified |
| New shared quote, field and work-order migration | Blocked |

Do not merge the old mixed migration PR #42 into production or execute any DDL before the outstanding recovery and authorization gates are truly passed.
# Fresh encrypted backup, isolated restore and full parity run

From an elevated PowerShell opened in the repository, with Docker Desktop running, run:

```powershell
.\scripts\restore-supabase-docker-drill.ps1 -UseR40 -RefreshBackup
```

This creates a new encrypted, mirrored backup with the existing DPAPI-backed utility, then restores it into a newly generated, empty Supabase PostgreSQL 17 container bound only to Windows loopback. The runner compares the private archive TOC's public table names against read-only live catalogs, checks constraints, RLS and policies, compares public/Auth record counts, and exercises authorized-member, unrelated-user and anonymous reads under their database roles. It removes only the disposable test container, network and plaintext volume after these checks finish. It does not run migrations or alter production rows. The run requires the same Windows user that configured DPAPI and an elevated PowerShell for local backup-evidence ACLs.

Only sanitized status lines should be shared. The Storage API object bytes are not included in database archives and still require a separately authorized Storage API credential and independent byte-level archive verification.

### CHECK expression reconstruction

PostgreSQL can rewrite equivalent CHECK expressions when a dump is restored, including distributing array casts and flattening nested AND expressions. Exact text fingerprints remain reported independently. For a text mismatch, recovery accepts a CHECK only when its kind, validation and inheritance flags, and table column types/collations match, and both catalog definitions reparse into identical definitions on the target server. Reparsing uses empty temporary table clones inside rolled-back target-only transactions; it never replaces a restored constraint or reads customer rows. Non-CHECK differences, parse failures and changed predicates still fail. `OJ_SCHEMA_RECOVERY_PARITY` reports this complete comparison; raw signature output says `DIFFERENT_TEXT` for equivalent reconstruction. Synthetic PostgreSQL 17 tests verify both observed rewrites and reject changed allowed values and time limits.
