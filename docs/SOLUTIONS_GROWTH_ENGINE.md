# OJ Solutions growth engine

The OJ Solutions section is built around the outreach plan: automated email, a daily DM quest, and phone calls only to people who already replied.

| Screen | What it does |
|---|---|
| Command | What to do now, today's quest, email engine status, pipeline, warm leads, inbound |
| Daily 10 | Each partner's DM quest: next target with the drafted message, "I sent it" button, XP, levels, streaks, duo streak |
| Email engine | Honest status, today's limit, results, pause switch |
| Prospects | The existing imported list, now with an "Exterior cleaning" filter |
| Warm leads | Replied and Demo Booked people, website requests, the warm-call script |

## What runs where

- **Email sender:** the Google Apps Script `scripts/google-apps-script/outreach-email-engine.gs`, bound to the Outreach spreadsheet. It sends from that Google account. It asks the server what to send, sends exactly that, and reports back.
- **Rules:** `src/lib/email-engine.ts` (window, daily limit, draft checks, bounce brake, reply handling), exposed two ways with the same code: the app route `/api/outreach-email-engine` (served by the Windows/Tailscale Funnel host) and `netlify/functions/outreach-email-engine.ts` (Netlify). Bearer-token only, using the same secret as the spreadsheet import. The service key stays on the server that answers. No signed-in user can trigger it, and it sends nothing itself.
- **Texting is untouched.** The one SMS sender rule still holds. This is email only.
- **Reminders:** the same script emails each partner who is under the DM goal at 10 AM, 2 PM, 6 PM and 8 PM Central. The server picks the reminder text.

The Outreach sheet's **Message** column is the source for the Daily 10 message and the email draft. Literal `\n` sequences become line breaks; the Daily 10 uses its starter only when that cell is empty. The email engine retains its existing sender/address/opt-out footer.

The checked-in `outreach-sync.gs` targets the authenticated Windows host at `/api/daily-outreach-sync` and reads the actual sheet width, capped at 20 columns. Updating this repository does **not** update a spreadsheet-bound Apps Script: a founder must update the bound script separately before that change can take effect. The email sender's `ENGINE_URL` is a separate script property; verify it points to the intended live `/api/outreach-email-engine` host before enabling any sending. Neither change runs an import or sends mail by itself.

For the Windows host, `scripts/install-outreach-auto-sync.ps1 -ExpectedCommit <full-deployed-sha>` installs an opt-in per-user task that checks the existing sheet every 10 minutes and imports it through the same token-protected importer when it changes. An unchanged sheet is refreshed at least hourly to recover from an older database restore. It stores only a digest and receipt in `oj-workspace-releases`, never sheet contents or the token; status and errors go to `logs/outreach-auto-sync.log`. It does not send email or change the email engine's setting. Disable the **OJ Workspace - Outreach Sheet Sync** scheduled task to stop polling. This reader requires the sheet's existing link-sharing access; if access is removed or its shape or size exceeds the import limits, it fails closed and logs the reason.

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
- There is no warm-up ramp. The day's limit is the ceiling set on the page (50 to 1,500 a day; 1,500 is Google's own limit for a Workspace account). Each 10-minute run sends up to 40 emails a few seconds apart, Monday to Saturday, 9:00 AM to 4:30 PM Central. The bounce brake still stops sending if too many emails bounce. Mail from a new sending domain at high volume is likely to land in spam, so watch the reply and bounce numbers.

## What it does by itself instead of an approval step

- Sends Monday to Saturday, 9:00 AM to 4:30 PM Central, a few at a time with random gaps.
- Skips any draft with placeholders, markup, spam phrases, all-caps subjects or more than one link.
- Adds name, company, the mailing address and a one-word opt-out to every email.
- Reply "stop" (or similar) marks the prospect Not Interested and they are never emailed again. Auto-replies are ignored. A stop request keeps no text. A real reply keeps its tone (interested, question, maybe later) and its first 280 characters so the Email engine page can show it. Never the whole thread.
- Pauses itself if 4 or more recent emails bounced and bounces are 8% of sends or more.
- Never emails an address this Google account has already written to.

## Verified and not verified

Verified by tests: the database permissions, the rules above, the server door, and the Daily 10 scoring. Not verified until a founder completes the steps: live database installation, the Apps Script running against real Gmail, real deliverability, and the reminder emails arriving. Treat the first week as a supervised trial: watch bounces and replies on the Email engine screen.
