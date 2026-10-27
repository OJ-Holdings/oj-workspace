# OJ workspace

## Current Exterior founder priority — integration passes first

Read [docs/EXTERIOR_INTEGRATION_ADOPTION_PROGRAM.md](docs/EXTERIOR_INTEGRATION_ADOPTION_PROGRAM.md) with the canonical handoff. The founder directed P1–P7 to go **before normal standalone Exterior feature expansion**, preserving the 12-wave weighted completion model and performing a **second full critique after the pass train**. P1 source-bound Job Continuity is inside current Bookings, not another unrelated tab. P2 genuine founder-host backup/restore/RLS and two-device proof remains a gate before any new production schema or real cross-device field/quote claims. Never merge PR #42 by default.

## Founder release preference — main and production by default (October 25, 2026)

The owner explicitly wants **completed, tested changes merged to GitHub `main` and deployed to the actual live OJ Workspace**, rather than accumulating indefinitely in feature branches. For every implementation pass, inspect current `main` and release status, land non-destructive, production-ready code after exact-head CI and review, and obtain exact **served SHA** from the Windows/Funnel and/or Netlify origin actually in use. Keep development, merged-main, and verified-production status distinct. Do not call a PR, screenshot of CI, local preview or a merged SHA "live" without production health and actual authenticated workflow evidence.

Production safeguards are **not waived** by the automatic-release preference: new `supabase/` schema, migrations, secrets, credential changes, source record backfills, Storage access, payments, or outbound messages require applicable real-backup/Storage-object-byte recovery, operator authorization, actor membership and rollback gates. Never blindly merge unfinished dependent/stacked PRs if doing so would break the running app or block the existing guarded auto-deployer. The Windows auto-deploy task only runs with the authorized host available, and must not be bypassed. If you cannot verify the host or CI, provide the exact blocking state and owner-safe `-Status`, `-Apply`, and origin release-evidence commands; do not invent a deployment. Respect `PAUSE`, a competing host supervisor, and the rollback lock.

An hourly ChatGPT release watch was created for confirmed `main` CI failures and verifiable served-SHA divergence; this is **monitoring/alerting only**, not an unconditional code merger or SQL deployment robot. Preserve the founder's request for **two clearly distinguished development estimates** in each Exterior implementation response: provisional **overall 49%** (formal historical weighted 42%) and provisional **audit ~50%** (strict founder-accepted 0/16), until further independently verified milestones justify a recalculation.

## Cross-chat Exterior Command continuity (mandatory)

For OJ Exterior Care / ATLAS / Exterior Command work, FIRST read [`docs/EXTERIOR_CONTINUE_HERE.md`](docs/EXTERIOR_CONTINUE_HERE.md) for the canonical checkpoint, then `docs/EXTERIOR_COMMAND_PROGRESS.md`, recent `docs/START_HERE_CHAT_HANDOFF.md`, `AGENT_LOG.md`, and this repository's `docs/BUILD_PLAN.md`. The canonical handoff carries a ready-to-copy new-chat prompt.

After every substantive Exterior release, update those GitHub handoffs and the V3 release changelog with exact PR/head/merged SHA, CI evidence, newly implemented behavior, the **percentage of the full 12-wave plan**, limitations, and precise next steps. The handoff should never exist only in a conversation. Recheck live GitHub and runtime; docs are a dated snapshot, not proof that production is serving the merged SHA. Treat migrations, actual money/approval, and cross-device persistence as independent proof gates.


Read docs/BUILD_PLAN.md before changing scope. This is a separate application and deployment from Oscar's private STRATHOS dashboard. Never import its SQLite, memory, tokens, environment files, or personal APIs.

Use session-bound Supabase clients and database-enforced organization membership. No service-role client in user-facing operations. Sample data belongs only in /preview, which cannot call production mutations. Do not silently fall back to samples on live data failures.

Preserve the existing OJ outreach system during migration. Only one deployment may own each outbound SMS scheduler. Record unknown historic facts as unknown; quotes are not payments, and missing costs are not zero.

Run typecheck, build, behavioral board tests and database permission tests for meaningful changes. A local preview is not proof of production access control. Live migrations, membership provisioning, file storage and SMS cutover need verification on the configured OJ project.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
