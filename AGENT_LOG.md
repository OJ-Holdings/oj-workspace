# AGENT LOG

Shared changelog for everyone (and every AI agent) working on the OJ Workspace:
Oscar and Jacob, Claude Code, Codex. Nobody can see anyone else's session, so
this file is how work gets handed over.

**Rules**
- Before starting non-trivial work, `git pull` and read the top few entries.
- After a meaningful change, add an entry at the TOP of the log below, in the
  format shown. Newest first. Never edit or delete someone else's entry.
- Say what you verified and what you did not. "Not tested" is a fine thing to write.
- Never paste a key, token, password or customer's personal details here.
- Plain ASCII.

**Entry format**

    ## YYYY-MM-DD HH:MM UTC -- Who (short title)
    **Summary:** what changed and why.
    **Files:** the main files touched.
    **Verified:** what was actually run or looked at, and the result.
    **Notes:** anything the next person needs to know, including what is unfinished.

---

## 2026-10-02 21:00 UTC -- Claude Code, for Oscar (Stage 2: the new look, Home, board and business pages)
**Summary:** Full visual redesign. Dark navy frame with an eleven-item side rail, a top bar with search (Ctrl K) and a recent-activity bell, and a Home screen built from Oscar's inspiration image: hero, three business cards, revenue overview, business performance, leads pipeline, today's tasks, schedule, recent files, messages and notes. Each business has its own page at /workspace/b/<business> that switches the whole content area to that business's logo colours (Exterior Care black with orange and green, Solutions charcoal and copper, Essentials cream and near-black with a serif) and opens on its logo, with tabs. OJ Essentials is now a third business on task cards. The board was rebuilt (same save, comment, stale-revision and drag logic) with person filters and animated card moves.
**Real numbers only:** the live workspace passes `unconnected` metrics, so revenue, leads, schedule, files and messages panels say what to connect. The filled-in version is at /preview, which is labelled a sample workspace and never touches the live database.
**Files:** src/components/app/* (App, Shell, HomeView, BoardView, CardDialog, VentureView, Charts, Hero, useBoard), src/styles/* (tokens, base, shell, home, board), src/lib/{ventures,metrics,sample,board}.ts, src/app/layout.tsx (fonts), src/app/workspace/[[...slug]]/page.tsx and src/app/preview/[[...slug]]/page.tsx (one page each, the view is chosen from the URL), public/brand/*-mark.png (cropped from the source logos). Removed: src/components/Workspace.tsx and ActivityFeed.tsx (replaced). New dependencies, exact versions: motion 14.0.0, @number-flow/react 0.6.2.
**Verified:** source typechecks; all 47 tests pass; looked at in a real browser at 1600px and 390px with no sideways scroll and no console errors: Home, all three business pages, Tasks, Businesses, a planned page, the landing and sign-in pages. In the sample workspace: search finds tasks, a task opens, moving a task changes the column counts, reduced motion turns animation off, the phone menu opens. Signed-out visits to /workspace/* redirect to sign in. Screenshots are in docs/screens/stage-2/.
**Not verified:** the signed-in live workspace (I have no account session), drag and drop by mouse (the Move to menu was used), and a local production build (the live server on Oscar's PC runs from this folder's .next, so I did not rebuild it; CI builds instead).
**Notes:** (1) supabase/pending/2026-10-02-essentials-business.sql must be applied to the live database before a task can be saved under OJ Essentials. It is NOT applied. (2) The live site still serves the old build until someone rebuilds and restarts it. (3) Pages in the rail that are not built yet (Calendar, Leads & CRM, Finance, Files, Messages, Analytics, Settings, and the non-board business tabs) say what they will hold and show no data. (4) Local `tsc` reports stale errors from .next/types until the next build; they are not in source.

## 2026-10-02 20:10 UTC -- Claude Code, for Oscar (Repo created; overhaul plan approved)
**Summary:** The OJ Workspace moved into its own private GitHub repo so Jacob can work on it too. Oscar approved a full overhaul: the workspace becomes the shared dashboard for all three businesses (OJ Exterior Care, OJ Solutions, OJ Essentials) with a dark navy redesign, real metrics, a calendar, documents and messages. The plan and build order are in docs/OVERHAUL_PLAN.md. This entry is stage 1 of 11: repo, this log, CLAUDE.md, CONTRIBUTING.md, .env.example, and a CI check that runs typecheck and tests on every push and pull request. No app code changed in this entry.
**Files:** AGENT_LOG.md, CLAUDE.md, CONTRIBUTING.md, .env.example, .github/workflows/ci.yml, docs/OVERHAUL_PLAN.md, docs/inspiration/, public/brand/source/.
**Verified:** see the stage 1 note in the pull history: typecheck and the existing test suite were run before the first commit.
**Notes:** Everything before this entry was built by Codex and is described in docs/BUILD_PLAN.md and docs/DEPLOYMENT.md; read both before changing access control or the database. The live app is still served from Oscar's PC (port 3011 behind the public address) from a build made before this repo existed. Decisions Oscar made: cloud hosting at the end; Exterior Care screens are rebuilt here while the existing oj-sms-system server keeps sending texts (never run a second SMS send loop); dark navy look with each business section in its own logo colours; OJ Solutions numbers come from GoHighLevel.
