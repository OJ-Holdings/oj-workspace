# Shared Workspace saves: activation handoff

LIVE: PR #159 merged as `8b684d1cf867a539d6fc61e58f4ccc21bc148886` and deployed on October 25, 2026 at 23:06:58 UTC. The Windows release receipt and an independent HTTP `/api/deploy-health` request both report this SHA. The previous release `5650b8911b56b4c3302c5959dc94c4ffa6dceb07` remains available for rollback. The latest main's U0 fixes and Solutions consultation inbox are preserved.

## Save paths

| Workspace editor | Shared save behavior |
|---|---|
| Commercial Desk and Project 360 | Main **Save shared project** delegates to the existing versioned project command, with revision conflicts, idempotent retries and exact-project read-back. Browser recovery save remains separate. |
| Residential estimates | Saving an internal revision uses the member-authorized shared document command when connected. Local autosave remains recovery; disconnected/conflicted states are explicitly local-only. |
| Fleet register and maintenance | **Save to company** synchronizes the validated workbook with revision checks. Existing local/shared divergence requires explicit reconciliation. |
| Booking field reports | Explicit company save validates the original booking/customer/date/status and preserves local edits on failure. |
| Booking equipment plans | Explicit company save validates organization and original booking identity; it never creates a reservation or safety clearance. |
| Internal crew handoff mailbox | Explicit company save stores a protected booking-bound mailbox. It does not deliver messages or authenticate a typed reviewer name. |

All module saves now re-read through the current-member action and compare the stored revision and JSON payload before claiming success. Lost-response retries retain their original command IDs. Local browser records are retained; distinct shared copies are not silently overwritten. Preview data never becomes live data through these controls.

## Database changes awaiting approval

1. `supabase/migrations/20261025000000_oj_commercial_estimating_shared_records.sql`: organization-scoped projects, buildings, immutable estimate versions, history, protected cost assumptions and idempotent commands; existing session-authorized commercial RPCs.
2. `supabase/migrations/20261026000000_oj_workspace_module_documents.sql`: protected internal draft documents and append-only versions/commands for the five validated module kinds. Current membership, legacy source ownership, source identity, expected revision and replay payload are checked by the database. Tables remain private; member actions use the typed RPC contract.

These migrations add tables/functions and do not rewrite customer rows or import browser data automatically. Content Studio remains a gated preview; its absent production schema is not introduced by this change.

## Verification

- TypeScript and Next production build PASS.
- Full unit/permission suite after integrating current main: 730 PASS, zero failed/skipped; includes commercial and module persistence, private tables, source/tenant checks, versions, conflicts, replay, missing membership and browser recovery. All four PR CI jobs and all main CI jobs PASS ([main run](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40242913452)).
- `scripts/tests/oj-workspace-save-integration.ps1`: PASS on a NEW PostgreSQL 17 container using the pinned Supabase image, network disabled, no published ports, no production credentials or data mounts. Applies both actual proposed migrations to generated fixture tables. Confirms owner save and independent member read-back, stale two-founder conflict, idempotent lost-response replay, altered replay refusal, protected history, viewer/outsider/anonymous/direct-table denial and immediate revoked-membership denial. Only the disposable synthetic container/volumes are removed.
- Owner-supplied R40 evidence confirms real database restore, 23-table/current record-count parity, policies/RLS and member/outsider/anonymous read tests. This does not establish production write or browser/device acceptance for the proposed save schema.

## Production activation evidence

The owner explicitly approved production migrations/deployment and accepted proceeding before independent backup verification of the two existing private files. Only the two reviewed additive migrations were applied: database migration versions `20261025230132` and `20261025230134`. Counts in all 23 original public tables, Auth users and Storage objects matched before/after. RLS is enabled and authenticated direct reads of private module tables are denied.

- A clearly titled **SYSTEM SAVE VERIFICATION - synthetic archived** project was persisted through the commercial RPC under an authorized database owner role and read back in a separate transaction under another actual member role. It is archived and has no customer, booking, asset or commercial commitment attached.
- The typed empty fleet payload was saved and exactly read back under the member role in a production rollback-only verification transaction. The outsider was denied. The rollback left zero module documents and did not replace any founder's fleet records.
- Anonymous HTTP requests to both new RPC families return HTTP 401 / PostgreSQL 42501; the functions are present in the public API schema and refuse unauthenticated access.
- The production deployer built a separate release, reran dependency install/typecheck/full tests/build, health-checked staging, then switched port 3011. Independent HTTP checks: health SHA matches, preview returns 200 and signed-out Workspace redirects (307). Tailscale routing and STRATHOS services were not changed.
- Five old untracked infrastructure files blocking source fast-forward were moved to a private infrastructure backup with SHA-256 verification; no secrets or browser data were moved. The current tracked auto-deployer retains its normal SQL/environment gate. This one authorized rollout used a local copy of that deployer pinned to the exact approved SHA, preserving CI, clean-tree, staging, lock, port ownership and rollback checks.

## Remaining owner workflow and limits

Refresh Workspace. Use **Save shared project**, **Save internal revision**, or the module's **Save to company** control. Local autosave alone remains a browser recovery copy. Existing browser records require an explicit company save/reconciliation; no data was silently imported or discarded. Other authorized devices read shared versions after reload. Conflicting copies are retained for explicit review.

The real database role/RPC and HTTP access checks above are not authenticated browser-cookie or two-physical-device acceptance; that user interaction remains to be demonstrated. Content Studio stays its existing gated preview. Independent encrypted backup/restoration of both private Storage file bytes and off-PC recovery remain outstanding; the files themselves and the old encrypted database archives were preserved.
