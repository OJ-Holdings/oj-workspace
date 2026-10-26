# Content Studio activation and recovery evidence

## October 26, 2026 owner-authorized activation

The owner explicitly requested activation and live release. The following
supersedes the earlier staging-only checkpoint below.

- A fresh encrypted source backup and its separate USB-disk mirror passed after
  correcting the backup utility's unnecessary audit-privilege request. The strict
  owner/SYSTEM/Administrators DACL remains enforced and independently read back.
- Applied `20261026144619 oj_content_studio_shared_records` and
  `20261026144621 oj_content_brand_compatibility`. Reviewed SQL is retained under
  `supabase/applied/2026-10-26-content-*.sql`; it is not pending DDL.
- Installed production role checks passed: owner create, independent member
  read/update, stale-write refusal, viewer read/write restriction, revoked-member
  and outsider denial, anonymous denial and automatic actor-bound history.
  All synthetic organization/project/membership rows were rolled back. These are
  database actor checks, not independent authenticated phone/browser sessions.
- The live feature flag is enabled in this release. Old authenticated
  `/workspace/tools/content-preview` bookmarks redirect to `/workspace/b/content`.
  The intentionally fictional `/preview` demo remains separate and safe.
- Local validation: 748 application tests, TypeScript/production Webpack build,
  and Windows synthetic private-folder DACL verification PASS. Exact-head CI and
  served-SHA proof remain release steps; see PR #169 for the final runtime status.

Offline/off-site custody and two-founder device acceptance remain unverified.
They are not claimed complete by this activation. The owner requested a controlled
live release with these previously reported acceptance limits still outstanding.

Rollback: use the retained prior application release, leaving additive tables and
stored content intact. Do not drop content tables or narrow brand checks once any
content records exist. No public publishing, outbound messages or spending was enabled.

## Historical development checkpoint (superseded by activation above)

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
- A separate staged compatibility script extends the eight catalog-confirmed
  brand checks for tasks, files, notes, leads, calendar, finance, metrics and the
  existing work timer. It changes no rows or policies and refuses unexpected
  constraint definitions. Synthetic content task, note and timer writes pass.

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
3. Review and promote `supabase/staging/oj-content-brand-compatibility.sql` in the
   same controlled release. It resolves the eight existing brand discriminators;
   these extensions have NOT been applied to production. Do not enable the global
   `contentPersistenceEnabled` flag before both staged schema pieces are verified.
4. Exercise the installed server actions with real owner/member/viewer/revoked
   sessions, dropped responses, mismatched readback and concurrent edits. The
   database tests do not claim authenticated browser end-to-end acceptance.
5. Flip the release flag only after that schema/permissions release, exact-head
   CI, staging and founder-device acceptance; retain rollback. No public platform
   posting, external spending or outgoing messages are part of activation.

Priority remains usable Exterior customer/property/estimate/job workflows through
the existing U2/U2B/U2C branches. This content development is a separate release,
so staged SQL cannot block shipping unrelated daily-use corrections.
