# OJ Solutions daily outreach ingest

The private `Outreach` tab in the source spreadsheet is the source for prospect details. The workspace keeps a searchable copy under OJ Solutions → Outreach. Synced source columns stay separate from `outreach_status`, so imports cannot roll back updates made by Oscar or Jacob. Every workspace status change is recorded in the activity table. A row missing from the sheet is never deleted from the workspace.

The tab uses columns A:T: Business Name, Industry, City and State, Website URL, Phone Number, Decision Maker, Best Fit Service, Secondary Fit, The Leak, Evidence, Email, Instagram, Facebook, Email Subject, Email Body, DM, Date Added, Sent By, Outreach Status, Notes. The source previously had a header only; import it once populated.

## Daily sync without a Google Cloud project

The spreadsheet-bound Apps Script in `scripts/google-apps-script/outreach-sync.gs` reads only the `Outreach` tab and pushes its values to the Netlify function at 10 PM local spreadsheet time. It uses the spreadsheet's existing sharing permissions and Google Apps Script authorization. No service account, Google Sheets API enablement, separate Google Cloud project, public sheet sharing, or Google Cloud private key is needed.

The Netlify receiver accepts POST only, requires `OJ_OUTREACH_SYNC_TOKEN`, rejects malformed or oversized payloads, and keeps the Supabase service-role key server-side. Set these Netlify production variables:

- `OJ_OUTREACH_SYNC_TOKEN`: a randomly generated secret of at least 32 bytes.
- `OJ_OUTREACH_ORGANIZATION_ID`: the OJ workspace UUID.
- `OJ_SUPABASE_SERVICE_ROLE_KEY`: the OJ Supabase server key. It is consumed only by the Netlify function, never exposed to the browser or Apps Script.

Then open the spreadsheet, choose **Extensions → Apps Script**, replace the starter file with `scripts/google-apps-script/outreach-sync.gs`, and set the project timezone to `America/Chicago`. Under **Project Settings → Script properties**, set `OUTREACH_SYNC_TOKEN` to the same value configured in Netlify. Save, run `syncOutreachSheet` once, and approve its spreadsheet-read and external-request scopes. Confirm the Outreach page shows a successful sync. Finally run `installDailyOutreachTrigger` once and approve trigger access. The trigger is recreated rather than duplicated if installed again.

The request is bounded to 1,000 rows and 20 columns (500 KB maximum). Source identity uses a website domain when available, otherwise normalized business name, city/state, and phone. Re-imports are idempotent; duplicates and invalid rows are counted. Missing rows are not deleted. The app does not send email or DMs; Oscar or Jacob records the actual outreach result in OJ.

## Release sequence

1. The additive outreach tables and member-read policies are installed on the OJ Supabase project.
2. Deploy the authenticated Netlify receiver, then set the production variables above.
3. Install and authorize the bound Apps Script, run a first sync, and verify its report in OJ Workspace.
4. Install its daily trigger and verify the next run in Apps Script execution history and the Outreach page.

Until the first successful import, the live Outreach page shows no imported prospects rather than substituting sample records. The `/preview` route remains clearly fictional and cannot perform production mutations.
