# U2 commercial release — real private Storage recovery and activation gate

Status: **BLOCKED — independent byte recovery not yet performed**. This file is a runbook, not a backup receipt or authorization to apply SQL.

## Read-only source observation — 2026-10-25
- Supabase project ref: `vgckpcktsfuithqggknd`.
- Source `storage.objects`: **2 objects / 38,670,441 metadata-stated bytes**, both in PRIVATE bucket `oj-documents`.
- Bucket `oj-employee-jobs` is PRIVATE and had **0 recorded objects** at this observation.
- The existing encrypted R40 PostgreSQL archive protects Storage **metadata**, NOT file contents. The 2 object byte streams must be recovered separately.
- No object paths, customer filenames, user IDs, tokens, passwords, private payloads or raw receipts belong in the repo, GitHub Actions or a chat transcript.

## Operator-executed recovery (owner Windows host, private credentials)
1. Confirm the existing encrypted R40 primary and off-device mirror; run the guarded `scripts/exterior-r40-recovery-preflight.ps1 -Action Status -EmitSanitizedJson`. Compare exact verified project ref and encrypted archive receipts. Do **not** rotate the existing age identity.
2. Obtain a least-privileged, authorized authenticated read session (or a one-time approved admin session) for the private objects. Keep credentials only in the private Windows credential store; never embed a service_role key in JS, .env committed to git, PowerShell history, or customer-visible frontend. The connected Supabase SQL tool can verify metadata, but it does not retrieve or validate raw Storage object bytes.
3. Enumerate exact object identity, `bucket_id`, and metadata size privately using the trusted service's Storage API. Reconcile this inventory with a READ-ONLY repeat of the source catalog. Any changes between inventory and download invalidate the snapshot; refresh and retry or stop.
4. Download **the two raw object byte streams** over authenticated TLS into a private encrypted quarantine or stream directly into independently encrypted age archives. Never leave an unencrypted private object in the project tree or public download folder. Capture SHA-256 of the **plaintext byte stream** during encryption, encrypted archive SHA-256, byte lengths and the original private path in an encrypted/private manifest. Do not rely on metadata size alone. Ensure 100% of both streams reached EOF; failures create no success receipt.
5. Replicate encrypted outputs + encrypted manifest to independently protected offline/off-host media. Compare encrypted archive SHA-256 at the destination; recording two Windows drive letters is NOT proof of off-device separation.
6. In a **fresh offline disposable recovery target**, decrypt both encrypted object archives to a private quarantine (or stream through an in-memory hash verifier), independently compare plaintext SHA-256 + byte counts to the source-generated private manifest, and verify that each object can be read back. Do not upload recovered customer files to the live production bucket during a drill.
7. Independently rerun PostgreSQL 17 guarded Restore and VerifyTarget on a new EMPTY LOCAL isolated target. Reconcile names/counts, constraints, RLS, policies, Auth metadata and **both Storage object identities and hashes**. Perform signed-in owner/member/outsider/viewer/revoked negative matrix; preserve original receipts and operator proof privately.
8. Only after an operator confirms all gates and an explicitly reviewed additive DDL release, apply normalized U2 account migration from PR #162 and U2B links from #164 in dependency order. Perform current-source snapshot and rollback preparation immediately before every migration. Avoid overwriting the existing commercial project and legacy booking tables.
9. Follow with U2C #165 UI; exact-commit CI, Windows staging health 3012, production health 3011, the actual founder origin served SHA and real two-device owner→member→owner save/read-back. Confirm no backwards-compatible routes broke. Never represent customer interest as signed recurring contract or estimate as cash.

## Current known release chain
- **U1 #161:** merged to main; exact Windows/public served SHA still needs independent evidence.
- **U2 #162:** normalized accounts/contacts/properties; new SQL NOT installed.
- **U2B #164:** exact project→account→property links; SQL staged, NOT installed.
- **U2C #165:** start estimate from saved property, explicit link step; tests/production build passed, NOT installed.

## Minimal sanitized operator evidence to report
```
project_match=true
source_object_count=2
source_metadata_bytes=38670441
downloaded_objects=2
independent_encrypted_mirror_verified=true|false
offline_restored_objects=2
plaintext_hash_and_size_match=true|false
isolated_db_restore_and_source_parity=true|false
roles_positive_and_negative_verified=true|false
windows_staging_sha=... (public commit only)
windows_production_sha=... (public commit only)
founder_two_device_acceptance=true|false
```

**Refusal rules:** Missing credential, inaccessible Storage payload, missing plaintext SHA proof, permission mismatch, unverified external media, changing objects, stale database source, outdated release SHA or failed tests all mean STOP, NOT LIVE. Never weaken permissions, bypass checks, fabricate a receipt, or apply migrations solely because the user wants automatic deployment.

Scores pending evidence: last formal overall Exterior 42/100, provisional engineering 49/100; founder audit implementation ~50%, strict acceptance 0/16.
