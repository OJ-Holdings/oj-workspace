# OJ Workspace: Supabase Free backup and recovery gate

**Project:** vgckpcktsfuithqggknd (PostgreSQL 17, Supabase Free). At the October 22 audit the database reported approximately **16 MB**. Size is not proof of a backup.

Supabase Free does not include platform-managed automatic backups, but the project can be exported using PostgreSQL's pg_dump or the Supabase CLI. Official references:
- https://supabase.com/docs/guides/platform/backups
- https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

**No data is backed up just by merging this documentation or scripts.** An authorized founder must run the backup on a computer with database connectivity.

## R40: Simplified private recovery status and guarded backup

The [R40 operator runbook](./EXTERIOR_R40_PRIVATE_RECOVERY_GATE.md) includes a Windows-only preflight that checks DPAPI configuration without revealing it, age-encrypted archive integrity, matching mirror SHA-256, separate physical-disk placement, and R39 archive readability. Start with this **read-only** command from the trusted checkout:

~~~powershell
.\scripts\exterior-r40-recovery-preflight.ps1 -Action Status -EmitSanitizedJson
~~~

Once a separate physical-disk destination is configured, the same tool supports **-Action Backup** and **-Action Restore** using the existing private scripts. It cannot access the private archive from ChatGPT and never upgrades a restore receipt into proof of real RLS, Storage bytes or migration approval. No real production backup/restore is established by GitHub CI. Two disks attached to one computer are still not an off-device backup.

## Prepare on your Windows host

1. If PostgreSQL 17 command-line tools or age encryption are missing, run `scripts/install-postgresql-client-windows.ps1` and `scripts/install-age-windows.ps1` from the trusted checkout. Each downloads a pinned Windows x64 release, verifies its SHA-256, and places the tools under `%LOCALAPPDATA%\OJWorkspace\tools`; the PostgreSQL helper does not register or start a database service.
2. In the [Supabase dashboard](https://supabase.com/dashboard/project/vgckpcktsfuithqggknd), choose **Connect -> Session pooler**, port **5432**. Copy the exact hostname and username (typically postgres.vgckpcktsfuithqggknd). Do not share the URI/password in chat, GitHub, email or logs.
3. On the same Windows user that runs OJ deployments, execute:

~~~powershell
cd C:\STRATHOS\oj-workspace-commercial-persist
.\scripts\backup-supabase-windows.ps1 -Action Configure -OffsiteDirectory 'E:\OJEncryptedBackups\supabase'
~~~

Enter the hostname, session pooler username and database password in the prompts. The password and age recovery identity are stored as **Windows DPAPI-encrypted ciphertext**, decryptable only by the same Windows user. The setup prints the age recovery identity once; save it in a password manager or a separate encrypted offline vault and confirm by typing `SAVED`. Do not lose it: DPAPI data alone cannot recover archives on another account or computer. Settings and credentials go under `%APPDATA%\OJWorkspace\supabase-backup`; backups are written under `%LOCALAPPDATA%\OJWorkspace\PrivateBackups\supabase` by default, **outside the repository**. The example mirror path is on E: and must resolve to a different physical disk from the primary C: backup.

4. Take and verify a backup:

~~~powershell
.\scripts\backup-supabase-windows.ps1 -Action Backup
.\scripts\backup-supabase-windows.ps1 -Action Verify
~~~

The tool streams the custom-format `pg_dump` output directly into age encryption, writes a `.dump.age` archive and SHA-256 manifest, then decrypts through a pipe into `pg_restore --list` to authenticate and inspect it. It never writes an unencrypted dump file. It refuses to write into known OJ Workspace source/release paths, and removes an incomplete encrypted archive.

The archive is encrypted independently of BitLocker, so Windows Home and unencrypted removable drives can store ciphertext. The recovery key is separate from the PC and must remain available. The E: mirror is only another copy while the disk is attached; physically remove it and store it separately to create off-device protection. Keep a second recovery-key copy separate from both backup disks. Do not put archives or secrets into GitHub, AI chat attachments, or public cloud buckets.

~~~powershell
.\scripts\backup-supabase-windows.ps1 -Action Configure -OffsiteDirectory "E:\OJ-Holdings-Encrypted-Backups\Supabase"
.\scripts\backup-supabase-windows.ps1 -Action Backup
~~~

Use an E: directory on the second physical disk. Verify both archive and copy checksums. This copy is encrypted at file level; do not describe it as off-device until the drive is disconnected and stored separately.

## Optional Windows daily backup task

Only after a successful manual backup:

~~~powershell
.\scripts\install-supabase-backup-task.ps1 -At "03:00"
Get-ScheduledTaskInfo -TaskName "OJ Workspace - Supabase Backup"
~~~

This installs a daily **3:00 AM local Windows time** opt-in job. It runs under the configured Windows user, requires that user to be signed in and the computer awake, and does not silently deploy or modify your database. Inspect new archives and task LastTaskResult. Change the time if your PC is off overnight.

## What the backup covers—and doesn't

Custom-format pg_dump captures the accessible database's non-system schemas and content, including public business data, Auth tables and Storage **metadata** as database privileges permit. It does **not** save Storage API **object bytes** or global PostgreSQL roles. The archive alone is **not** a verified full-project restoration plan. Check whether any Storage buckets contain customer/document assets and back up the object bytes separately through the supported Storage API.

A successful pg_restore --list and SHA256 comparison indicate a readable archive, **not** that you could recover a fully functioning Supabase project after a major error.

## Release 39: mechanical restore drill tooling now exists

In addition to `-Action Verify` (checks file SHA-256 + custom-format archive readability), the new `scripts/restore-supabase-isolated.ps1` supports an **isolated disposable-target restore** and creates a deliberately incomplete *private* evidence receipt. Read the [R39 recovery drill runbook](./EXTERIOR_R39_RESTORE_DRILL.md) before executing it.

**This feature does not mean the real Supabase production database has been backed up or successfully restored.** A true Supabase restore may require locally provisioned roles/extensions and a separately verified storage-object recovery. The helper refuses remote hosts, ordinary database names, port 5432, unconfirmed destinations and nonempty targets; it does not overwrite existing tables. Synthetic two-container PostgreSQL 17 CI checks exercise the mechanical code using completely fictional data. Actual source reconciliation and authenticated member/RLS tests remain independent operator-run gates.

## Required restore drill before Oscar Jacob schema migration

A founder/database administrator must restore the archive into a **separate, disposable, Supabase-compatible PostgreSQL 17 environment**, never the live database. Prepare matching Supabase-managed schemas, roles and extensions. Reconcile table counts, historic record IDs, database RLS policies, functions, permission grants, authentication records, and application source compatibility. Keep all customer notification services disabled in the test environment. Test any separately downloaded Storage objects. Record the archive hash, restore timestamp and verifications privately.

If the custom archive does not restore cleanly into that environment, use Supabase's officially documented CLI roles/schema/data export and import sequence and rerun the restore drill. Do not mistake a partial file export for a recoverable backup.

## Release sequence

The live Release 02A provides a **read-only** Oscar Jacob preview and has no new production database schema.

1. Confirm recent, independently verified production backup and successful isolated restore.
2. Confirm founder account access and exact production release SHA.
3. Review migration in [PR #42](https://github.com/OJ-Holdings/oj-workspace/pull/42) at a pinned commit, compare existing constraints and records, inspect RLS/functions.
4. Under supervision, apply **only the reviewed SQL** as a recorded migration; confirm original business records and access remain correct.
5. Deploy a separate **code-only** PR to switch the Oscar Jacob persistence flag on; CI must be green and post-deploy health verified.
6. Verify content creates/edits by both founders, outsider denial, plus unchanged Exterior/Solutions/Essentials operations.

Never merge the mixed SQL+app PR #42 into main expecting the Windows updater to execute it. The updater intentionally blocks schema file changes.

## Verify whether GitHub main is actually live on Windows

~~~powershell
cd C:\STRATHOS\apps\oj-workspace-deploy-test
.\scripts\verify-production-windows.ps1
# Or request a standard scheduled deployment attempt (same safety checks):
.\scripts\verify-production-windows.ps1 -TriggerUpdater
~~~

With -TriggerUpdater, the verifier checks periodically for up to five minutes while the existing guarded updater builds. Expect PASS: this Windows host is serving exactly GitHub main on port 3011. This is a local-host check; separately verify Tailscale Funnel and a real signed-in founder session.

## CI notification changes

CI now cancels **superseded pull-request runs for the same PR** while never cancelling main-branch production checks. This reduces stale failure notifications from rapid feature commits; current PR failures remain visible and block normal deployment.

Keep all backup files and restore evidence in encrypted private storage. No destructive database SQL is authorized solely by successful CI or a readable backup archive.
