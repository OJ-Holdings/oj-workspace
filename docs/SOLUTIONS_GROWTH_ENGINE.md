# OJ Solutions growth engine

The OJ Solutions section is built around the outreach plan: automated email, a daily DM quest, and phone calls only to people who already replied.

| Screen | What it does |
|---|---|
| Command | What to do now, today's quest, email engine status, pipeline, warm leads, inbound |
| Daily 10 | Each partner's DM quest: next target with the drafted message, "I sent it" button, XP, levels, streaks, duo streak |
| Email engine | Honest status, today's limit, warm-up ramp, results, pause switch |
| Prospects | The existing imported list, now with an "Exterior cleaning" filter |
| Warm leads | Replied and Demo Booked people, website requests, the warm-call script |

## What runs where

- **Email sender:** the Google Apps Script `scripts/google-apps-script/outreach-email-engine.gs`, bound to the Outreach spreadsheet. It sends from that Google account. It asks the server what to send, sends exactly that, and reports back.
- **Rules:** `src/lib/email-engine.ts` (window, warm-up, draft checks, bounce brake, reply handling), exposed two ways with the same code: the app route `/api/outreach-email-engine` (served by the Windows/Tailscale Funnel host) and `netlify/functions/outreach-email-engine.ts` (Netlify). Bearer-token only, using the same secret as the spreadsheet import. The service key stays on the server that answers. No signed-in user can trigger it, and it sends nothing itself.
- **Texting is untouched.** The one SMS sender rule still holds. This is email only.
- **Reminders:** the same script emails each partner who is under the DM goal at 10 AM, 2 PM, 6 PM and 8 PM Central. The server picks the reminder text.

## "Running" means running

The dashboard says **Running** only when the sender has checked in within the last 25 minutes and is switched on. Otherwise it says Not started, Stopped checking in, Paused, Auto-paused or Blocked, with the reason. It never shows a made-up status.

## Switch it on (a founder does this once)

1. **Database.** Review and apply, in this order, to the OJ Supabase project (after taking the usual backup per `docs/DEPLOYMENT.md`):
   `supabase/schemas/solutions-dm-quests.sql`, then `supabase/schemas/solutions-email-engine.sql`.
   Both are additive. The permission tests are `tests/solutions-growth-sql.test.ts`.
2. **Server settings, on whichever host answers the script.** On the Windows/Tailscale host these go in `.env.local` (then restart the app); on Netlify, in the site settings. Add `OJ_EMAIL_POSTAL_ADDRESS` (required; shown on every email), optionally `OJ_EMAIL_COMPANY`, and `OJ_WORKSPACE_URL` (the exact https address you open the workspace at, so the reminder emails link to it). The Windows host also needs `OJ_OUTREACH_SYNC_TOKEN`, `OJ_OUTREACH_ORGANIZATION_ID` and `OJ_SUPABASE_SERVICE_ROLE_KEY`; Netlify already has them for the spreadsheet import. Google's servers run the script, so it can only reach a **public** address: the Tailscale **Funnel** address works, a tailnet-only address does not.
3. **Apps Script.** In the Outreach spreadsheet, Extensions, Apps Script, add the file `outreach-email-engine.gs` next to `outreach-sync.gs`. Project Settings, Script properties:
   - `SENDER_NAME` (signature name, for example Oscar)
   - `NAG_EMAILS` (for example `{"Oscar":"oscar@example.com","Jacob":"jacob@example.com"}`)
   - optional `SENDER_FILTER` (`Oscar` or `Jacob`)
   - `ENGINE_URL` when the Tailscale Funnel host is the one answering: `https://<your-funnel-host>/api/outreach-email-engine`. Blank uses the Netlify function.
4. Run `previewNextEmails` once. It logs the emails that would go out and sends nothing. Then run `installEngineTriggers` and approve the Gmail permission. The Email engine screen switches to Running after the first check-in (within 10 minutes during the day).

If the Windows PC is off or asleep, the script cannot reach it. Nothing sends, and the screen says Stopped checking in after 25 minutes. It never claims Running without a real check-in.

To stop: press Pause on the Email engine screen (takes effect within 10 minutes), or delete the triggers in Apps Script.

## Sender setup we strongly recommend

- Send from a **separate domain** (for example a lookalike of ojsolutions.org), never the main one, so a spam problem cannot touch the company mail.
- Use a Google Workspace mailbox on that domain (a free Gmail address is capped near 100 recipients a day and looks less credible), with SPF, DKIM and DMARC set up.
- The warm-up ramp starts at 5 a day and climbs to 50 by day 28 (5, then 10, 20, 30, 40, 50), never above the ceiling you set. 50 a day is the hard maximum. A new sender that jumps straight to 50 gets flagged, so the ramp is not skipped. Cold email results take weeks to judge.

## What it does by itself instead of an approval step

- Sends Monday to Saturday, 9:00 AM to 4:30 PM Central, a few at a time with random gaps.
- Skips any draft with placeholders, markup, spam phrases, all-caps subjects or more than one link.
- Adds name, company, the mailing address and a one-word opt-out to every email.
- Reply "stop" (or similar) marks the prospect Not Interested and they are never emailed again. Auto-replies are ignored. A stop request keeps no text. A real reply keeps its tone (interested, question, maybe later) and its first 280 characters so the Email engine page can show it. Never the whole thread.
- Pauses itself if 4 or more recent emails bounced and bounces are 8% of sends or more.
- Never emails an address this Google account has already written to.

## Verified and not verified

Verified by tests: the database permissions, the rules above, the server door, and the Daily 10 scoring. Not verified until a founder completes the steps: live database installation, the Apps Script running against real Gmail, real deliverability, and the reminder emails arriving. Treat the first week as a supervised trial: watch bounces and replies on the Email engine screen.
