# ATLAS V3 — Shared Commercial & Fleet Persistence Gate

> **DESIGN CONTRACT ONLY — NO SQL/MIGRATION IS AUTHORIZED OR EXECUTED BY THIS FILE.**
> Baseline: code releases 08–10, reviewed 2026-10-22. Local projects, candidate equipment assignments and their source-booking associations are currently saved in the user's browser, not in Supabase. Shared tasks are separately stored using the preexisting task system. See [backups](./BACKUP_FREE_TIER_WINDOWS.md), [connected architecture](./ATLAS_04_CONNECTED_DATA_AND_WORKFLOWS.md), and the [founder test plan](./ATLAS_V3_FOUNDER_ACCEPTANCE_08_10.md).

## 1. Actual, observed repository architecture

- Workspace tenant model in `supabase/schemas/workspace.sql`: `public.oj_organizations`, `public.oj_memberships` with owner/member/viewer roles, `public.oj_cards` with organization key, revision, task stage, assignee and checklist, and an `oj_private.member_role(org)` helper. This schema file is a desired-state source artifact; reconcile it with **actual live introspection** before proposing SQL.
- Exterior Care legacy `public.bookings` has `id,lead_id,date,time_block,status` but no tenant ID. The existing desired-state `supabase/schemas/exterior-read.sql` uses an organization-owned `oj_private.legacy_owner` and authenticated, owner/member-only `oj_private.exterior_reader()` authorization. **Do not invent a foreign key on (organization_id, booking_id) against a legacy table that lacks organization_id.** Verify actual production RLS and ownership first.
- Current R08 local project portfolio: `src/lib/atlas-commercial-portfolio.ts`, versioned project IDs, full estimates, tentative equipment IDs and an optional exact booking UUID in **org-keyed localStorage**. The legacy active single-estimate workbook remains separate.
- Current Fleet Command: `src/lib/fleet-command.ts`, device-local asset registry, maintenance, rig payload assumptions and pre-departure checks; no VINs, plate numbers, private contact IDs or credentials are requested.
- Current R09–10 seam: an explicit user-review task draft may include `Local portfolio project ID:` and `Booking record ID:` when a currently loaded valid active booking is independently matched. Fleet timeline may display those task snapshots and booked-source dates; it does NOT create a canonical server project/resource assignment.
- PR #42 is a **draft mixed SQL/application PR** about a different venture-registry migration. It must remain unmerged until the existing protected backup+isolated restore gate clears. Do **not** slip commercial/fleet SQL into it or the Windows code-only auto-deployer.

## 2. Proposed additive server identity contract (NOT implemented)

Proposed source-of-truth hierarchy, subject to a future independent database review:

| Future entity | Stable identity / relationships | Rules |
| --- | --- | --- |
| `oj_commercial_projects` | Organization UUID + new canonical project UUID; organization-scoped owner/venture; explicit state, revision and timestamps | No user-input local ID as PK; no name/address join; optimistic CAS on revision |
| `oj_commercial_estimate_versions` | Organization UUID + project UUID + immutable version and estimate JSON | Validated exact scoped fields/limits; append versions, retain approval evidence separately; assumptions are not prices sent to customers |
| `oj_project_booking_links` | Organization UUID + project UUID + existing Exterior booking UUID + source verification receipt | Source must exist under the legacy owning organization, checked through a SECURITY INVOKER/guarded function; no guessed tenant composite FK into legacy table |
| `oj_fleet_assets` | Organization UUID + new asset UUID, status, service thresholds, created/updated by, revision | Differentiate operator-entered status from verified inspections; no personal serial/VIN/plate data without separate justified privacy design |
| `oj_project_asset_candidates` | Organization UUID + project UUID + asset UUID, status = `planned`, plan author and revision | Candidate resource ≠ reserved equipment. Actual reservations require a separate approved scheduling workflow |
| `oj_project_task_links` | Organization UUID + project UUID + `oj_cards` card UUID | Composite organization checks and foreign keys for workspace tasks; do not auto-join historic free-text local IDs |
| `oj_project_audit` | Immutable organization-scoped operation/actor/time/revision/receipt | Review and restore traceability; actor must come from authenticated server context |

Separate future concepts (not silently implied by above): `quote_approvals`, `crew_assignments`, `dispatch_reservations`, `equipment_inspections`, `invoices`, `collections`, reconciliation, actual job profitability.

**Status semantics:** `scoping` → `founder_review_requested` must not imply a signed client proposal, accepted quote or payment. Archive does not delete the audit trail. A booking might later cancel, move or be marked completed; resolve current state from the real booking source every time, not a stale project title.

## 3. Required authorization and tenant isolation

1. All new rows carry a required `organization_id` and a generated canonical UUID. Parent-child relationships should use composite organization+ID foreign keys (where both tables are tenant-scoped). Never trust a caller-supplied organization or user ID without rechecking the JWT and `oj_memberships`.
2. Default-deny RLS on every table. Only authenticated owners/members of the correct organization may read private project/client/equipment plans; editors may mutate only authorized records. `viewer` and anonymous users must not gain access through broad `USING(true)`, default grants, exposed SECURITY DEFINER RPCs or views.
3. Server actions must check membership and edit rights **on the server**. Browser read-only hiding and obfuscated localStorage keys are not an access-control substitute. Concurrency should use server-side revisions/transactions and expected-revision compare-and-swap.
4. The legacy booking bridge requires an exact source booking UUID plus verified ownership of the OJ Exterior legacy dataset. A booking's client name, phone, address or date alone is insufficient proof of identity. If status/read fails, relationship state is `unknown`; no invented confirmed date.
5. Audit mutation actor IDs must come from `auth.uid()`/verified membership, not task text or user-editable display names. PII should be minimized in task snapshot payloads and never shown to an unauthorized venture/role.
6. Implement tenant, role and cross-org tests for SELECT, INSERT, UPDATE, DELETE, stale revisions, forged booking IDs, unauthorized project/asset relation changes, and cross-org document task links. Public/anon must fail.

## 4. Local project import and migration reconciliation

1. Import is **opt-in per founder, per device** after private database gate passes. The R08 JSON may include confidential property addresses, rates and business plans; never auto-upload it merely because a user signs in.
2. Validate both portfolio and Fleet files with their existing exact formats, size limits and organization scoping. Show an import preview of project count, related booking source checks, candidate asset references, conflicts and revision timing before proposing server writes.
3. Generate **new** canonical project/asset UUIDs and a private import mapping of `(organization, import batch, device-local ID) → canonical server ID`. The local ID is not globally unique across devices and can never prove that Oscar and Jacob's similarly named projects are the same record.
4. Verify booking IDs through the trusted authorized database source, and quarantine unresolved/cancelled/foreign records for founder review. Never join by property name, phone number or address.
5. Deduplicate only after a human reviews potentially conflicting projects and equipment; a deterministic content checksum can suggest candidates but is not permission to merge.
6. Link historical shared task snapshots only through an explicit, user-confirmed mapping of the local project ID and validated new canonical project ID. Mere task text is insufficient to establish new authoritative relational identity.
7. Provide a dry-run report, exact per-entity row counts, before/after revision receipts and rollback procedures. Existing singleton local draft and private portfolio exports remain available during reconciliation; do not delete local data automatically after successful import.

## 5. Release gates — no shortcuts

**G0 / Backup and restore evidence:** Run a real authenticated PostgreSQL 17 logical backup to encrypted private storage (NOT the repository); verify checksum and archive inventory. Rehearse a restore to an independently isolated compatible environment; reconcile memberships, historical business rows, Auth metadata, Storage object bytes where present, extensions, grants, RLS, legacy booking data and actual app behavior. A `pg_restore --list` and green GitHub CI are not sufficient. Record immutable private evidence without publishing customer data.

**G1 / Live schema review:** Read-only compare the actual Supabase schema/RLS/policies/function grants/migration history against repository desired-state SQL. Account for the pre-existing draft PR #42, still blocked. No historical row deletions, auth-user recreation or blanket grants.

**G2 / Independent SQL proposal:** In a distinct protected, manually reviewed SQL-bearing PR, stage additive tables/foreign keys/tenant policies/functions and PGlite tests. Do not place new SQL where the normal code-only Windows updater can execute it. No production SQL write without explicit approval and a current recoverable restore receipt.

**G3 / Code behind OFF-by-default feature flags:** Server-side CRUD and role checks for canonical projects, versioned estimates, assets and candidate allocations; write receipts, optimistic revisions, and read-through compatibility. Disable all external automation and automatic import. Keep the existing local workbook usable with clear precedence/coverage metadata.

**G4 / Controlled founder pilot:** Manually deploy to a test environment, import a synthetic fixture, test owner/member/viewer/anonymous/cross-tenant boundaries and concurrency. Only then run a founder-approved, limited real import with Oscar and Jacob inspecting each project's source and assignments.

**G5 / Live cutover verification:** Independently verify host release SHA and actual database migration receipt; test both devices, booking status transitions, shared task linkage, permission denial and backup recovery. Do not call local-only fields "synced" until both founder accounts see and can safely edit the exact same canonical record.

## 6. What is available **now**

R08–10 deliver useful work **without** crossing this database gate: versioned local commercial portfolios, exact booking selection from loaded Exterior records, candidate equipment allocation and service checks, explicit shared task snapshot handoffs, and a Fleet date planning radar with 7/30/90-day views. These are deliberately not a substitute for shared database identity, actual crew capacity, reservations, customer contracts or settled accounting.

**Do not silently turn "manual internal planning" into "production dispatch" by renaming a UI badge, calculating a margin, or checking a checklist.**
