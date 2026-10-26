# Workspace use-readiness check - October 25, 2026

This is a focused source/runtime audit, not acceptance of every feature or a full
security review. Existing production customer records were not modified.

## What is independently established

- Main has 345 commits, including the ATLAS and Exterior operating workflows.
- Local 3011 and the founder HTTPS Funnel served main `4c010b8` during inspection.
- Live catalog: 28 public tables with RLS enabled, 42 public functions, 54 policies.
  Counts and RLS flags alone do not prove that each policy is correct.
- Existing commercial/shared-module save migrations and booking-time fix are live.
- Both private Storage files have encrypted archives, separate physical disk
  copies and independent plaintext hash/count readback. Off-PC custody is unverified.
- Owner's fresh guarded recovery output reports 28-table/source row/Auth parity,
  equivalent CHECK definitions, policy/RLS parity and member/outsider/anon checks PASS.
  Owner/viewer/revoked-device acceptance is not established by that output.

## Correctness gaps repaired in this pass

1. File removal ignored Storage errors and proceeded to delete its company record.
   Now a failed/denied object deletion retains the reference, failed lookups stop,
   the path must match the authenticated organization, and metadata deletion also
   checks the exact path against concurrent replacement. A later database failure
   is reported as reconciliation needed; cross-service deletion is not atomic.
2. Commercial save readback checked ID/revision but not editable content. Now
   normalized scope, pricing inputs, review, phase, booking, equipment and crew
   plan must match before success. A real synthetic database save/member readback
   exercises the same comparison. Missing/wrong/newer/changed results fail safely.
3. A malformed commercial pagination receipt could claim more projects without
   a usable next cursor. It now reports an error instead of stranding records.

## Direction for the parallel ChatGPT audit

Prioritize one complete operator journey: real customer -> property -> estimate ->
reviewed booking -> crew task -> field report -> closeout -> evidenced money.
Inspect current implementation and live schema before rebuilding older milestones.

- Finish the existing U2/U2B/U2C branches in dependency order; do not build a second
  accounts or property system. Verify exact-head CI, recovery gates and rollback.
- Prove owner -> member save/readback on two actual devices, plus stale edit,
  dropped response, offline retry, viewer denial and revoked membership. Unit
  tests and catalog counts are not a substitute for this operator acceptance.
- Preserve local drafts per founder/origin. Explicitly adopt reviewed originals;
  do not silently replace them or present a browser recovery save as shared save.
- Content Studio is a genuine gated preview: its expected production tables are
  absent and the brand gate is false. Develop its existing model independently;
  never flip the gate before its database and permissions are verified. Do not
  merge the broad historical PR #42 to activate one feature.
- Accounting/bank views remain evidence-review tools. Do not turn imported amounts,
  quoted estimates or manual statuses into customer acceptance or settled revenue.
- Provider configuration flags prove configuration, not authenticated provider
  access. Verify actual authorized reads before removing connection warnings.
- Keep U1/U2/operator audit work distinct from production: exact served SHA and a
  successful authenticated workflow are required to call a release live.

## Scope limits

No signed-in two-device UI acceptance was performed. No bids, messages, payments,
production DDL or file deletion occurred. The new deletion tests use fake operations
and commercial database tests use synthetic isolated records.

Historical formal engineering 42%; provisional engineering 49%; founder audit
implementation ~50%; strict founder-accepted 0/16. No score inflation from code alone.
