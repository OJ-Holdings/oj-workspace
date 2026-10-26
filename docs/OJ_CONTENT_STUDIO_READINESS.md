# Content Studio development and activation boundary

October 25, 2026. This pass develops the existing Oscar Jacob preview rather than
adding a competing content system. It does not apply SQL or enable live content.

## Implemented

- Separate staged tables matching the existing Content Studio project/activity
  model, with organization RLS, current membership checks, server-controlled
  revisions, immutable identity and automatic actor-bound history.
- Members/owners can edit; same-company viewers can read; outsiders, anonymous
  users and revoked members cannot access records. There is no direct activity
  write/delete grant and no automatic public publishing or customer communication.
- Assignees must currently belong to the company as owner/member. Publication
  requires a recorded HTTPS link and date; this is not independent proof that a
  platform published anything.
- Stable create IDs survive a dropped response without creating a second project.
  Exact normalized content readback is required before success. Update retries
  reconcile only an exact next-revision match; other edits remain conflicts.
- Synchronous double-submit fencing, editor replacement/close confirmations,
  browser unload warnings for changed drafts and preservation of the open editor
  on failed saves. This does not promise recovery after a browser crash or guard
  every client-side navigation.
- Preview no longer claims its fictional editor saves company records. Large
  production/history windows disclose truncation rather than imply full coverage.

## Verification

The synthetic database fixture exercises owner create -> independent member read,
revision conflict, activity provenance, viewer read/write denial, outsider/anonymous
denial, immediate revocation, invalid assignee, immutable identity, unsupported
platforms and publication without evidence. A dedicated CI harness repeats core
role tests on a disposable PostgreSQL 17 container with network disabled and no
published ports. No production credentials or customer records are used.

The production feature flag remains false. Staged SQL is intentionally outside
auto-applied migrations. Nothing in this branch silently enables Content Studio.

## Before activation

1. Finish independent off-PC recovery custody and the full founder actor/device
   acceptance gate. Preserve current encrypted archives and rollback releases.
2. Review `supabase/staging/oj-content-studio.sql`, real current catalog and
   existing grants; generate a dedicated approved migration. Do not merge or
   apply the entire historical PR #42 merely to activate Content Studio.
3. Review the fourth-brand discriminators on shared task/dashboard tables.
   Existing tables accept Exterior/Solutions/Essentials only. This staged content
   backend does NOT alter them. They need a narrowly reviewed compatible release
   before enabling the global `contentPersistenceEnabled` flag, otherwise generic
   content tasks/files/finance actions can fail database checks.
4. Exercise the installed server actions with real owner/member/viewer/revoked
   sessions, dropped responses, mismatched readback and concurrent edits. The
   database tests do not claim authenticated browser end-to-end acceptance.
5. Flip the release flag only after that schema/permissions release, exact-head
   CI, staging and founder-device acceptance; retain rollback. No public platform
   posting, external spending or outgoing messages are part of activation.

Priority remains usable Exterior customer/property/estimate/job workflows through
the existing U2/U2B/U2C branches. This content development is a separate release,
so staged SQL cannot block shipping unrelated daily-use corrections.
