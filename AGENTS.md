# OJ workspace

## Cross-chat Exterior Command continuity (mandatory)

For OJ Exterior Care / ATLAS / Exterior Command work, FIRST read [`docs/EXTERIOR_CONTINUE_HERE.md`](docs/EXTERIOR_CONTINUE_HERE.md) for the canonical checkpoint, then `docs/EXTERIOR_COMMAND_PROGRESS.md`, recent `docs/START_HERE_CHAT_HANDOFF.md`, `AGENT_LOG.md`, and this repository's `docs/BUILD_PLAN.md`. The canonical handoff carries a ready-to-copy new-chat prompt.

After every substantive Exterior release, update those GitHub handoffs and the V3 release changelog with exact PR/head/merged SHA, CI evidence, newly implemented behavior, the **percentage of the full 12-wave plan**, limitations, and precise next steps. The handoff should never exist only in a conversation. Recheck live GitHub and runtime; docs are a dated snapshot, not proof that production is serving the merged SHA. Treat migrations, actual money/approval, and cross-device persistence as independent proof gates.


Read docs/BUILD_PLAN.md before changing scope. This is a separate application and deployment from Oscar's private STRATHOS dashboard. Never import its SQLite, memory, tokens, environment files, or personal APIs.

Use session-bound Supabase clients and database-enforced organization membership. No service-role client in user-facing operations. Sample data belongs only in /preview, which cannot call production mutations. Do not silently fall back to samples on live data failures.

Preserve the existing OJ outreach system during migration. Only one deployment may own each outbound SMS scheduler. Record unknown historic facts as unknown; quotes are not payments, and missing costs are not zero.

Run typecheck, build, behavioral board tests and database permission tests for meaningful changes. A local preview is not proof of production access control. Live migrations, membership provisioning, file storage and SMS cutover need verification on the configured OJ project.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
