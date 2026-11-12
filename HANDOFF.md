# HANDOFF: LSA lead engine, branch `lsa-leads` (2026-11-12, after session 4)

Start here in a fresh session. Read this, then the top AGENT_LOG.md entries and docs/LSA_GO_LIVE.md.
Branch `lsa-leads` is local only: **not pushed**, `main` untouched, staged SQL **not applied**.

## Session 5 (next): wait for Jacob's review of the session-4 dry run
Nothing is approved for live. Jacob reads the session-4 summary (run it again with
`npm run lsa -- dry-run --summary --out <file outside the repo> --focus <LSA ids>`; the LSA ids to check are in the
private notes next to lsa-overrides.json), then either asks for
changes or approves. After his OK, follow "Session 3 result" below (push, PR, live steps).
Choices made in session 4 that Jacob may want to change (each is one line in lead-pipeline.ts):
- A Next Follow Up after 2027-03-15 revives on 2027-03-15 (capped), like past-due and no-date leads.
- An answered customer call (Google duration > 0; Google has no "connected" flag) resets the counter and counts as ONE attempt (New -> Contacted).
- Only the backfill archives customer-last threads older than 14 days; in the live sync such a lead just leaves Needs Reply (it is not archived).
- Sheet leads stay active for Needs Reply (customer wrote last within 14 days) as well as Scheduled / follow-up within 30 days.
- "Link to existing lead" shows only on leads the LSA sync created (not on sheet leads that were linked). Linking into a
  lead someone entered keeps that lead's own follow-up count; linking into an archived lead the customer wrote to since revives it.
- In the backfill a Scheduled (booked) LSA lead is never archived or made Dead for being quiet.
- The live sync (poller and Sync now) adds nothing until the one-time backfill has finished, so turning LSA_POLL=on before
  the backfill is safe: it shows "Waiting for the one-time backfill" until `npm run lsa -- backfill` completes.
- A work email counts as a company match only for business-looking names (company word, 3+ words, or not a person's name).
- A 4-reviewer check of the diff found 9 defects; all fixed with tests (session-4 commit).
- One of the two override leads has a misspelled email domain in Google, and its sheet lead's address starts with a place name (no street key), so only the override links it.

## Session 4 (DONE 2026-11-12): Jacob reviewed the dry run. Build these 6, update tests, rerun the dry run, then STOP
Built all 6 (details in AGENT_LOG.md). Dry run 2026-11-12: 71 LSA leads; 49 new, 16 linked, 2 overrides, 4 held;
38 of 239 leads active, 1 in Needs Reply; RESULT PASS, 0 deletes, 0 overwrites. The first-name-only lead Jacob asked
about is correctly CREATE NEW (no snapshot lead at that address or with that name in that town).
Jacob's words are condensed below; design notes are settled unless marked. Nothing is approved for live yet.
Baseline output of the last dry run (for "Dead decisions that changed"): `C:/Users/jacob/.secrets/oj-workspace/lsa-dry-run-2026-11-11.txt` (customer data: never into the repo).

1. **Missed links.** Two LSA leads (contacts at two commercial clients) must link to those clients' existing leads.
   Which ones is in lsa-overrides.json (outside the repo: it names customers).
   - DONE: `C:/Users/jacob/.secrets/oj-workspace/lsa-overrides.json` exists (outside the repo):
     `{ note, links: [{ lsa_lead_id, lead_id (full uuid), why }] }`. Build: `planIngest(..., { overrides })`
     forces a link (same fill-empty-only `link()`), reported as kind `override`; `runBackfill` and the dry run
     read the file (dry run flag `--overrides <file>`, default that path; missing file = no overrides). One-time:
     overrides apply only in the backfill, never in the live sync.
   - Matcher: extract EVERY address in the customer's messages (add `findAddresses` next to `findAddress` in
     lead-extract.ts); the probe carries `addresses[]`; any one matching a lead's street = strong; a street
     conflict only when none match. Email domain = name match: `americanroller.com` vs a lead name with spaces and
     punctuation removed ("americanrollercompany" starts with / contains "americanroller", ignore words like
     company/co/inc/llc), skipping free-mail domains (gmail, yahoo, hotmail, outlook, aol, icloud, live, msn,
     comcast, att, sbcglobal, charter, me). Counts as strong "email domain matches the company name" and as `nameFits`.
   - UI: "Link to existing lead" on every LSA lead's panel (LeadEngine.tsx): search box over leads, pick one,
     server action `linkLsaLead(org, fromId, toId)` in exterior-actions.ts: moves the LSA ids and thread onto the
     chosen lead with the same fill-empty-only merge as `mergeIntoSheetLead` (generalise it), archives the source
     lead with `lsa.mergedInto` (never deletes), logs activity. Free the unique `lsa_lead_id` first, as
     `applySheetArchive` does.
   - Also report the decision for an LSA lead known only by a first name that a completed sheet lead shares.
     Show why it did or did not match.
2. **Needs Reply** = only leads whose customer's last message or missed call is within the last 14 days.
   A call event never puts a Won, Scheduled or Lost lead in Needs Reply. A Google call that connected or has
   duration > 0 is answered: it counts as Contacted (an answered customer call is a contact, not a wait).
   Older customer-last threads go to Spring Revival (archived, revive 2027-03-15). Where: `needsReply()` gets a
   `now` (14-day window; check every caller: LeadEngine lists, engineStats, bucket, dry run), `applyEvents`
   treats a customer PHONE_CALL with seconds > 0 as contact; the backfill archives customer-last threads older
   than 14 days on sync-created leads; linked hand-entered leads follow item 4. Check the call event fields
   Google gives (seconds from `phone_call_details.call_duration_millis`; there may be no "connected" flag).
3. **Attempts**: our outbound messages within 60 minutes of each other are ONE attempt (in `applyEvents`: an
   `us` event within 60 min of the last counted one adds no attempt and no contact_log entry). Rerun the Dead
   rule and list every lead whose Dead decision changed vs the baseline file above.
4. **Sheet archive**: keep active ONLY status booked (Scheduled) or a Next Follow Up between today and today+30
   days. Everything else archives, Completed/Won included. Revive date = the Next Follow Up when it falls after
   today+30 and on or before 2027-03-15 (the 3/1/27 ones revive 2027-03-01); past-due and no-date leads revive
   2027-03-15. Drop the "recent LSA message keeps it active" rule unless item 2's 14-day Needs Reply applies
   (ask if unclear). `PIPELINE.keepActiveBefore` becomes a 30-day window.
5. **Names**: a new lead with no name gets a readable placeholder instead of "Unknown": "LSA call Oct 22" or
   "LSA msg Oct 22 Waukegan" (town from `findTown` over the address/messages when found). `isBlank('name', ...)`
   must treat `/^LSA (call|msg) [A-Z][a-z]{2} \d{1,2}\b/` as a placeholder so a real name replaces it later.
6. **Addresses**: never save a truncated address like "12345 W" (a customer line "12345 W."). If there is
   no street name word after the number (a lone direction letter is not one), save nothing. Fix in
   `findAddress` and add the test.

**Then show Jacob ONLY:** the decisions for the two override leads and the first-name lead; every lead in Needs
Reply; the full kept-active list; the Dead decisions that changed; and the before/after totals with deletes and
overwrites (add a `--summary` mode to the dry run, or filter the saved output). Commit locally, do not push, stop.

## Session 3 result (before Jacob's review)
Session 3 built everything in the session-2 list (items 1-10) and ran the dry run on the real
snapshot (`C:/Users/jacob/.secrets/oj-workspace/leads-snapshot.json`, 190 leads, a plain JSON array)
and the real Google history (read only, 13 API operations): **70 LSA leads, 604 conversation events
(Jul-Nov 2026); 50 would be added, 16 linked to existing leads, 4 held as possible duplicates;
RESULT: PASS, 0 deletes, 0 overwrites.** Nothing was written anywhere. Supabase was never contacted.

**Nothing gets written to live data until Jacob approves the dry run.** After his OK:
1. Push `lsa-leads`, open a PR into `main` (do not merge), PR body = Oscar's checklist below; bind it
   with the ccd_pr tools; do not poll CI.
2. Live steps (founder runs, in order, see docs/LSA_GO_LIVE.md): backup, apply the RUN-ME SQL with a
   human OK, `npm run lsa -- backfill`, `npm run lsa -- archive-sheet-leads --dry-run` then without
   `--dry-run`, then `LSA_POLL=on` and restart.

## Points for Jacob to decide (seen in the dry run)
- 100 of 190 sheet leads stay active, mostly because their Next Follow Up (often 3/1/27, or a past
  date like 6/4/26) is before the 2027-03-15 cut-off (`PIPELINE.keepActiveBefore`). That is the rule
  as set before; change it if past or 3/1/27 follow-ups should be archived too.
- About 19 leads would land in Needs Reply (the customer wrote last in an LSA thread), several of them old.
- A review agent found 7 defects in the live-write paths; all fixed in the second commit (street keys keep
  St/Ave and units, a street alone needs a fitting name, Merge follows merged leads, old linked threads
  never mark a hand-entered lead Dead, concurrent decisions are never lost, done reviews do not hide leads).
- Google gives a name for only 8 of 70 LSA leads; 2 more come from a customer line ("My name is ...").

## What session 3 added (all on `lsa-leads`, committed locally)
- `lead-pipeline.ts`: `isBlank` (NP_/na/n/a/Unknown count as empty), `nameParts`, nickname groups,
  `sameFirstName`, `streetKey`/`sameStreet`, `matchLead` (link | review | new, with reasons),
  `planIngest` with `{ reviews }` (pending reviews hold their events; decided ones are carried out;
  plan has `reviews`, `resolved`, `matches`), `mergeIntoSheetLead` + new `planSheetArchive` (fill empty
  only, report conflicts, duplicate archived with `lsa.mergedInto`, recent LSA conversations stay active).
- `lead-extract.ts`: `confirms` also reads "Thursday works", "tomorrow is fine".
- `lsa-sync.ts`: `readReviews`/`writeReviews`/`resolveReviews`/`applyIngest`; `runSync` passes reviews;
  backfill split into `googleMonths` + `fetchHistory` + `runBackfill` (+ `backfillLsa`); `applySheetArchive`.
- `exterior-actions.ts`: `decideLeadReview` (Merge / Keep separate, applied at once); load returns pending reviews.
- `LeadEngine.tsx` + `os-skin.css`: one-tap suggestion buttons, card hint, Possible duplicates tab, preview samples.
- Staged SQL: `oj_lsa_review` added to the same RUN-ME file (member RLS, no delete).
- `scripts/lsa-dry-run.ts` (`npm run lsa -- dry-run [--from file] [--rehearse]`): network guard,
  snapshot reader, in-memory PGlite rehearsal through a small Supabase-like adapter.
- `docs/LSA_GO_LIVE.md`: the plain-language explanation.
- Tests: `tests/lsa-dedupe.test.ts` (new) + `tests/lsa-engine.test.ts`; full suite 1064 passing.

## Hard rules for this work (from Jacob)
- Read-only against Google. Never push to `main`. Never apply SQL to the live database without asking.
- Never connect to Supabase from the dry run. Stop and ask if anything would delete or overwrite data.
  Never write to the Google Sheet.

## Oscar's PR checklist (no secret values)
- Key file: `C:\Users\<oscar>\.secrets\oj-workspace\lsa-service-account.json` (best: create his own key on
  service account `oj-lsa-sync@oj-automations.iam.gserviceaccount.com`; else USB or an expiring
  password-manager share; never email/chat/GitHub).
- `.env.local` in his repo checkout (the deployer copies it into each release):
  `GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH=C:/Users/<oscar>/.secrets/oj-workspace/lsa-service-account.json`,
  `GOOGLE_ADS_LSA_CUSTOMER_ID=9016334601`, `GOOGLE_ADS_LOGIN_CUSTOMER_ID=9723939798`,
  `OJ_SUPABASE_SERVICE_ROLE_KEY=<from Supabase>`, `OJ_EXTERIOR_ORGANIZATION_ID=<workspace id>`, `LSA_POLL=on`.
- Apply `docs/db-change-proposals/RUN-ME-2026-11-02-lsa-lead-engine.sql` after a backup, with a human OK.
- Restart the server; the poller logs "LSA poller on".

## Notes
- Commits on this branch use `git -c user.name=Jacob -c user.email=<Jacob's email>` (no identity is configured on this PC).
- Git Bash cannot see a git identity; commit from PowerShell.
- The dry-run output holds customer names and addresses: keep it out of the repo.
