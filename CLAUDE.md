# OJ Workspace -- rules for Claude (and any other AI agent)

This is the shared business dashboard for Oscar and Jacob: OJ Exterior Care
(pressure washing, Kenosha WI), OJ Solutions (AI receptionists, on GoHighLevel)
and OJ Essentials (ojessentials.store, Shopify). Both founders edit it with AI help.

@AGENTS.md

## Every session

1. `git pull`, then read the top entries of AGENT_LOG.md.
2. Read docs/OJ_OS_V2_PLAN.md for what is being built and in what order (the older OVERHAUL_PLAN and OJ_OS_MASTER_PLAN are history).
3. Work on a branch, open a pull request, let CI pass, then merge. Small pull requests.
4. When you finish something meaningful, add an entry at the top of AGENT_LOG.md.

## Hard rules

- **No customer data in the repo. This repo is public.** No customer names, phones,
  emails, addresses or lead IDs (workspace, LSA or any other) in any committed file:
  code, comments, tests, docs, HANDOFF.md, AGENT_LOG.md, commit messages or PR text.
  Tests use made-up data (555-01xx phones, example.com emails, invented names and
  streets). Real data (lead snapshots, dry-run reports, overrides) stays outside the
  repo, in ~/.secrets or a scratch folder. HANDOFF.md is session notes and stays local
  (it is gitignored).
- **No secrets in the repo.** Keys live in `.env.local` (ignored by git) and in the
  host's settings. `.env.example` lists the names only. Never print a key, never
  put one in a card, comment, document, log entry or commit message.
- **Real numbers only.** No sample or invented figures on live screens. If a
  business is not connected, show what to connect. Sample data stays in /preview.
- **One SMS sender.** The existing oj-sms-system server owns texting and the daily
  follow-up job. This app must never start its own send loop.
- **Database changes are staged.** Edit the desired-state files in
  supabase/schemas/, add permission tests in tests/, run them, and get a human's
  OK before anything is applied to the live Supabase project. All changes additive.
- **Membership decides access.** Every table carries organization_id and uses
  `oj_private.member_role`. No service-role key in anything a user can trigger.
- **This is not Oscar's private STRATHOS dashboard.** Nothing from it is imported here.

## Before you say something is done

    npm run typecheck
    npm test
    npm run build

Then look at it in a browser at desktop and phone width. Say plainly what you
checked and what you did not.

## Design

Dark navy shared frame; each business section takes its own logo colours
(Exterior Care orange and green on black, Solutions charcoal and copper,
Essentials cream and near-black with a serif). Tokens live in src/styles/.
Do not add new colours or fonts outside the token files.
