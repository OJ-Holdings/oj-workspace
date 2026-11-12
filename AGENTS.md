# OJ workspace (OJ OS)

## What we are building now: OJ OS V2

Read these before any feature work, in this order:
1. [docs/OJ_OS_V2_PLAN.md](docs/OJ_OS_V2_PLAN.md) - the plan the founders approved on 2026-11-12: decisions D1-D19, the 9-room map, design language, data spine, room specs, books, Solutions, store, XP, hosting, REA method, skills, and the 16-week roadmap to the March 1, 2027 season.
2. [docs/OJ_OS_V2_AUDIT.md](docs/OJ_OS_V2_AUDIT.md) - what every current page does and what is wrong with it.
3. The top entries of AGENT_LOG.md - what Claude and Codex changed recently.

The ATLAS / Exterior Command evidence-gate program and its percentage estimates are retired. Do not add explanation paragraphs, "evidence" disclaimers or "withheld" numbers to screens: show the number with a small badge, and turn missing data into a button that fixes it (plan sections 0 and 3.5).

## How work ships

- Small pull requests from a branch off the latest `main`, CI green, then merge. The guarded Windows auto-deployer deploys `main`; it blocks ranges that touch `supabase/`, `.env.example` or `oj-connection.ts`, so staged SQL goes in `docs/db-change-proposals/` until a founder applies it.
- Database changes are additive, staged, tested with PGlite permission tests, and applied only by a founder.
- Production safeguards stay: backups before migrations or backfills, membership-based access, no service-role key in anything a user can trigger, respect `PAUSE` and the rollback lock.
- Keep "merged", "deployed" and "verified live" distinct when reporting.

## Standing rules

- This is a separate application from Oscar's private STRATHOS dashboard. Never import its SQLite, memory, tokens, environment files or personal APIs.
- Use session-bound Supabase clients and database-enforced organization membership. Sample data belongs only in /preview, which cannot call production mutations. Do not silently fall back to samples on live data failures.
- No SMS to customers (decision D4). Customer messages go by email and the customer portal.
- Quotes are not payments, and missing costs are not zero: show them as missing with a fix button.
- Run typecheck, tests and build for meaningful changes, and look at the change in a browser at desktop and phone width.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
