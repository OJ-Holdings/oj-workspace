# Shared Workspace saves: activation handoff

Implementation branch: `codex/workspace-durable-saves`, stacked on the completed R40 recovery branch. Integrates the existing `feature/workspace-unified-supabase-documents` implementation without replacing the recovery runner. This is implemented and tested code, not a production activation receipt.

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
- Full unit/permission suite: 727 PASS, zero failed/skipped; includes commercial and module persistence, private tables, source/tenant checks, versions, conflicts, replay, missing membership and browser recovery.
- `scripts/tests/oj-workspace-save-integration.ps1`: PASS on a NEW PostgreSQL 17 container using the pinned Supabase image, network disabled, no published ports, no production credentials or data mounts. Applies both actual proposed migrations to generated fixture tables. Confirms owner save and independent member read-back, stale two-founder conflict, idempotent lost-response replay, altered replay refusal, protected history, viewer/outsider/anonymous/direct-table denial and immediate revoked-membership denial. Only the disposable synthetic container/volumes are removed.
- Owner-supplied R40 evidence confirms real database restore, 23-table/current record-count parity, policies/RLS and member/outsider/anonymous read tests. This does not establish production write or browser/device acceptance for the proposed save schema.

## Activation gate still open

Production has not been migrated or deployed by this change. Both existing Storage objects are private; independent encrypted byte backup/restore and off-PC recovery are still outstanding. The owner's earlier instruction requires completion of that recovery gate and explicit production-migration approval before activation. A generic request to make saves work has not been treated as permission to bypass this gate.

After recovery and approval: apply only the two reviewed additive migrations, use the existing guarded deployment/release process, preserve browser recovery exports from each actual origin/profile/device, then perform designated owner/member save/reload/second-device acceptance without touching existing customer records. Review and explicitly synchronize pre-existing local drafts using the new controls. Production rollout requires its own recorded results and rollback evidence.
