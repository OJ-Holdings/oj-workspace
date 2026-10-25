# OJ Workspace save verification — October 25, 2026

Historical pre-activation audit. Shared operational saves were subsequently enabled and deployed through PR #159; see [current live acceptance and limitations](./OJ_SHARED_SAVE_ACTIVATION.md). The results below describe the preceding inspection, not the current live deployment.

Overall result: PARTIAL. Database recovery passes for the checked public/Auth scope. This does not establish that every Workspace screen saves to shared storage.

## Evidence and scope

- Owner supplied the completed guarded R40 operator output for the encrypted archive produced at `2026-10-25T22:33:05.2870061Z`: Restore, VerifyTarget, 23 public table names, all public table record counts, Auth user counts, policies, RLS flags, CHECK reconstruction and the member/outsider/anonymous read tests PASS. Two CHECK texts differ but reparse identically in the target; they are reported as DIFFERENT_TEXT. Source production was not modified and migrations remain unauthorized.
- Independent read-only production catalog check in this run confirms 23 public tables, each with RLS enabled; no commercial project-save RPC; no commercial project tables or Content Studio tables; two Storage metadata objects. No customer rows or object bytes were retrieved.
- The configured Windows release state points to `5650b8911b56b4c3302c5959dc94c4ffa6dceb07`. Its actual Commercial Desk and Project 360 source still saves to localStorage. This is source/release-state inspection, not HTTP served-version or two-founder acceptance.
- Full repository tests: **711 PASS, 0 FAIL, 0 skipped**. These use synthetic fixtures/PGlite and cover save/reopen, concurrent revision conflicts, idempotent retries, roles, revoked membership, archive checksums and storage quota failures. They do not constitute live customer-record save tests.

## What saves where

| Feature | Verified storage path | Result |
|---|---|---|
| Leads, bookings, shared tasks/comments, work sessions, events, finance entries and messages | Existing Supabase tables and server actions | Shared persistence paths and tables exist. Synthetic permission/save tests pass. No new live write/read-back or second-device save was performed. |
| Commercial Desk estimate draft | Current browser origin/profile localStorage | Browser-only; absent from PostgreSQL backups. |
| Deployed Commercial Project 360 portfolio | Current browser origin/profile localStorage | Browser-only. Shared versioned implementation is on the feature branch, but its production tables and RPC are absent. |
| Fleet assets/service workbook, residential estimate books, field logs, booking equipment plans, crew handoffs | Organization-scoped browser localStorage | Local save/reload and transfer tests pass; these are not shared with another browser/device and are absent from database archives. |
| Content Studio | Production feature gate plus currently missing `oj_content_projects` / `oj_content_activity` | Not enabled. Save actions reject until separately reviewed migration/activation. |
| Attachments | Supabase Storage | Two metadata records exist. Independent file-byte backup/restore remains unverified. |
| Unsaved forms, filters and transient component edits | Component memory unless an explicit save path exists | Not durable; closing/reloading can discard edits. Preview data is intentionally local and fictional. |

## Remaining conditions before claiming all-data persistence

1. Export existing organization-scoped browser records from each authorized origin/profile and founder device. The branch's local archive exporter preserves source values and supports missing-key-only recovery; no real browser export was performed here.
2. Independently archive and restore both Storage objects, then verify hashes. Attached disk mirrors alone do not establish off-PC recovery.
3. Obtain the existing required production-migration approval before installing the reviewed shared commercial persistence schema. Passing R40 is not that approval.
4. Deploy the reviewed save implementation using the existing guarded release process. Retain local recovery copies and explicitly import reviewed projects; do not silently replace browser drafts.
5. Perform authenticated save → reload → independent device read-back with designated test records, including conflict, network interruption and revoked access. Production customer-record mutation remains outside this verification run.

No deployment, production migration, customer-record mutation, browser-data deletion or permission change was performed during this save audit.
