# Commercial Project 360 shared persistence

Status: feature branch implementation for review. Production Supabase schema and Windows release are unchanged. The migration is additive but **not authorized or safe to apply yet**; the R40 real-source recovery, Storage-object recovery and actor-role access gates remain blocked.

## What changes

- Commercial projects, buildings, estimate versions, private cost assumptions, command idempotency receipts and history become organization-scoped database records.
- Owner/member access is derived from `auth.uid()` and `oj_private.member_role()`. Viewer, anonymous and non-member calls fail. Direct Data API table grants are revoked. Private cost assumptions stay in `oj_private`; only the owner/member internal-estimate RPC returns those values needed to reopen and edit a saved internal estimate. No client quote, invoice, customer acceptance, job, dispatch or payment is created.
- Server actions call the existing session-bound Supabase client after `requireMember(organizationId, true)`. No service-role client or direct internal handler is used.
- Save validates a fixed payload shape, recomputes estimate totals in SQL, checks expected revision under a row lock, and accepts a command UUID for idempotent retries. A reused command ID with a changed payload fails; a stale expected revision returns a conflict; each accepted version is append-only and gets building snapshots, private cost assumptions and an audit history row.
- Reads are keyset paginated. NEXUS and the task-preparation handoff now read shared project records rather than assuming the current browser's local project key is available.
- Commercial Desk retains a clearly labeled device-local recovery copy. Importing one saved recovery project to shared storage is explicit and never overwrites an existing ID. Existing file-based portfolio merge/replace only affects the local recovery copy and asks before destructive local replacement.
- “Export local business data” produces a checksum-bearing current-origin localStorage archive without mutating source keys. It is unencrypted; the browser warns before downloading it.

## Migration contents

`supabase/migrations/20261025000000_oj_commercial_estimating_shared_records.sql` creates:

- `public.oj_commercial_projects`
- `public.oj_commercial_estimates`
- `public.oj_commercial_estimate_versions`
- `public.oj_commercial_buildings`
- `public.oj_commercial_history`
- `oj_private.oj_commercial_cost_assumptions`
- `oj_private.oj_commercial_commands`

RPCs: `oj_commercial_project_save`, `oj_commercial_projects_list`, and `oj_commercial_project_get`. Project/bookings and project/equipment references are kept as explicit source IDs; the migration does not fabricate foreign-key ownership across legacy schemas. Existing browser records are never copied automatically.

## Validation performed

`tests/commercial-estimating-persistence.test.ts` runs the actual migration in PGlite against the current workspace/membership schema and tests owner/member access, viewer/anonymous/other-organization denial, direct table and private-schema denial, version history, idempotent replay, command-ID payload mismatch, stale compare-and-swap conflicts, malformed/out-of-range cost input and keyset list/get RPCs. Archive and NEXUS changes have focused regression tests.

PGlite is a PostgreSQL-compatible WASM test, not a substitute for the required isolated PostgreSQL 17 RLS/restore acceptance. No production RLS test, real two-device acceptance, source restore or browser-origin export has been performed. Those items are explicit before-merge/deployment requirements.

## Operational release guard

The active local deployer lives as untracked owner-controlled Windows infrastructure outside this PR. It currently blocks every changed `supabase/` path (including staging-only SQL) and environment/connection changes. Keep this fail-closed guard intact for the current branch: the feature contains an executable migration, and the recovery gate is blocked. The PR is for code/schema review only; production remains unchanged.
