# Exterior Release 44 — P2 live deployment evidence: Windows, Funnel & Netlify

**Purpose:** Get a reliable, privacy-preserving answer to "which OJ Workspace release did the actual founder's phone open?" before testing the job action loop. This is P2 **instrumentation**, not completed P2 user acceptance or production disaster recovery.

## Why this exists

The repository documents **two materially different delivery paths**:

1. **Netlify cloud**: [OJ Workspace](https://ojworkspace.netlify.app), introduced in the October 3 deployment notes. This is not the Windows process and does not require it to be online. If Netlify supplies a valid build `COMMIT_REF`, the existing `/api/deploy-health` now reports that commit.
2. **Windows + Tailscale Funnel**: Existing documented external origin `https://desktop-lbi2ein.tail3f006f.ts.net:10000`, backed by the Windows loopback service `127.0.0.1:3011`. The host deployer sets `OJ_WORKSPACE_RELEASE_SHA`. The public Funnel and loopback must BOTH agree with GitHub main.

These are *documented candidate origins*, not claims that either is responding or currently used. Netlify cloud availability, Tailscale forwarding and latest served SHA have **not** been verified here. An invalid, missing, conflicting or arbitrary environment release value returns `unmanaged` instead of leaking secrets or reporting a false SHA.

## Check the exact version on two real phones

Using each founder's **existing separately authorized company account**, open **Jobs & Bookings → Open job workflow**, then expand **Device and deployment check** and choose **Check my server version**.

- The app fetches **only the current origin's read-only `/api/deploy-health` endpoint**, not production data and not any external host; it makes no changes to the job.
- It displays the server-*reported* full SHA if the response is valid; otherwise it explicitly shows "unmanaged", "invalid" or "unavailable".
- Both founders can independently compare the full response, origin and GitHub main and use **Copy sanitized check**. The copy contains no customer name/ID, task, cookies, Auth ID, URL or private work evidence.
- Same SHA on both devices is **necessary but not sufficient** for accepting job data, tasks, comments, membership/RLS or deployment safety. Each must then follow [P1 acceptance script](./EXTERIOR_INTEGRATION_P1_FOUNDER_ACCEPTANCE.md): actual job → assigned company task → second device sees assignment → progress/comment → original device sees update.

Do not treat a copied local note as signed actor evidence. No acceptance flag is stored automatically.

## Optional founder Windows read-only public-route verification

Only if the trusted Windows deployment computer is available, run from the OJ repository in PowerShell:

~~~powershell
# Documented Tailscale Funnel, verifies local Windows app AND public Funnel:
.\scripts\exterior-p2-release-evidence.ps1 -PublicOrigin 'https://desktop-lbi2ein.tail3f006f.ts.net:10000' -EmitSanitizedJson

# Documented independent Netlify site, verifies public app against GitHub.
# Local Windows may be offline and is NOT required to match:
.\scripts\exterior-p2-release-evidence.ps1 -PublicOrigin 'https://ojworkspace.netlify.app' -EmitSanitizedJson
~~~

This read-only script obtains actual `main` from GitHub and probes the existing release endpoint on loopback and the **explicitly allowlisted OJ origin** only. It accepts no arbitrary URL, username, password, headers, URL path, query, fragment or local file paths. A redirect, missing release SHA, unresponsive site, stale origin or conflicting commit refuses positive proof. Output contains only expected Git SHA, release status words and **FALSE** for all other gates. It doesn't read the OJ database, local archive, phone, member email or logs.

The helper differentiates `public_origin_kind=cloud` (Netlify, independent from Windows loopback) and `public_origin_kind=funnel` (Tailscale, public route must match local 3011). `release_route_parity_only` refers only to double-hop release SHA and **never** means both founders successfully worked a job.

## Code/test coverage

- `src/lib/release-health.ts` validates full release SHAs from Windows `OJ_WORKSPACE_RELEASE_SHA`, Netlify `COMMIT_REF` or Vercel `VERCEL_GIT_COMMIT_SHA` and rejects conflicting valid identities. Existing `/api/deploy-health` stays read-only, noncached, without customer data.
- `src/lib/exterior-device-release-evidence.ts` and `src/components/app/ExteriorDeviceReleaseProof.tsx` add a founder-initiated same-origin check and sanitized copy on the **existing job**, not another dashboard.
- `scripts/lib/exterior-p2-release-evidence.ps1` provides pure, tested origin allowlist and source/commit comparisons. `scripts/exterior-p2-release-evidence.ps1` is the founder Windows-only observer. `scripts/tests/exterior-p2-release-evidence.Tests.ps1` proves rejection of unsafe origins, spoofed/invalid commits, unavailable servers, false actor/recovery approval and private response fields; wired into CI. TypeScript tests validate response shape and sanitized notes.
- No new database schema, privileged key, automation, authentication flow, public network exposure, customer message, payment or Storage read/write.

## Acceptance remains blocked until independently proven

- Exact served release on the actual URL each founder uses — NOT VERIFIED.
- Both founder accounts access the same consented source booking — NOT VERIFIED.
- Task create → separate account update/comment → first founder refresh — NOT VERIFIED.
- Actual encrypted production backup and separately encrypted physical mirror — NOT VERIFIED.
- Real isolated restore and complete source/data consistency — NOT VERIFIED.
- Signed-in owner/member/viewer/revoked/outsider/anonymous RLS negative matrix — NOT VERIFIED.
- Supabase Storage **actual file bytes**, not only database metadata, backed up and restored — NOT VERIFIED.
- Rollback and notification isolation — NOT VERIFIED.
- Shared quote/work-order/field-event schema migration PR #42 — BLOCKED.

Keep [P1–P7 Integration & Adoption](./EXTERIOR_INTEGRATION_ADOPTION_PROGRAM.md) first. After real P2 completion, proceed to P3 customer/property/quote/work-order spine in staging with reviewed source identity, conflict and RLS proof. At P7 conduct the promised fresh critique, then return to normal development.
