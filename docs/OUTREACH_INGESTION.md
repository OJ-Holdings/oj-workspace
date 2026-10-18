# OJ Solutions daily outreach ingest

The `Outreach` tab in the source spreadsheet is the source for prospect details. The workspace keeps a local, searchable copy under OJ Solutions -> Outreach. The synced source columns are separate from the workspace's `outreach_status`, so the nightly import cannot roll back status changes made by Oscar or Jacob in OJ. Every status change is recorded in the append-only activity table. A row missing from the sheet is never deleted from the workspace.

The source currently has one tab (`Outreach`) with columns A:T: Business Name, Industry, City and State, Website URL, Phone Number, Decision Maker, Best Fit Service, Secondary Fit, The Leak, Evidence, Email, Instagram, Facebook, Email Subject, Email Body, DM, Date Added, Sent By, Outreach Status, Notes. It currently contains the header only; there are no prospect records to import yet.

## Private access and scheduled run

The Netlify scheduled function reads the sheet with a Google service account that is shared as Viewer on this spreadsheet only. It requests the Sheets read-only scope. Do not publish the sheet to the web or enable anyone-with-the-link access.

Set these values in Netlify's production environment variables (never in source control):

- `GOOGLE_SHEETS_CLIENT_EMAIL`: service account email shared on the spreadsheet.
- `GOOGLE_SHEETS_PRIVATE_KEY`: service account private key, with newlines preserved or escaped as `\\n`.
- `OJ_OUTREACH_ORGANIZATION_ID`: the OJ workspace's UUID from `oj_organizations`.
- `OJ_SUPABASE_SERVICE_ROLE_KEY`: the OJ project's server-only service key. It is consumed only by the scheduled import function and must never be added to a public variable, user-triggered route, or client bundle.
- `NEXT_PUBLIC_OJ_SUPABASE_URL`: existing OJ project URL.

The scheduled function runs at 04:30 UTC (10:30 PM CST or 11:30 PM CDT), before the end of the Chicago calendar day in either season. Netlify schedules use UTC, so the local time shifts by an hour with daylight saving. Scheduled functions run only on a published deploy; use Netlify's **Run now** control for a controlled first run. The Netlify function has a 30-second runtime limit; the source tab is bounded to rows 1-1000.

The source identity key uses the website domain when present, otherwise normalized business name, city/state and phone. This makes repeat imports idempotent. If the same business is intentionally entered twice, only the first copy is used and the sync report counts duplicates. Imported records are upserted; missing sheet rows are not treated as deletions. The app does not send email or DMs. Oscar or Jacob records the actual outreach result in the workspace.

## Release sequence

1. Apply `supabase/pending/RUN-ME-2026-10-19-outreach-pipeline.sql` to the OJ Supabase project only after reviewing it with the workspace owner. The migration is additive and has local policy tests; it has not been applied to production.
2. Create the Google service account, enable Google Sheets API, and share only this spreadsheet with its email as Viewer.
3. Add the Netlify environment variables above and deploy the code containing `netlify/functions/daily-outreach-sync.ts`.
4. Run the function once from Netlify. Confirm the `Outreach` page shows a successful sync time and record count. Then verify the next scheduled run and an Oscar/Jacob status change.

Until those steps are done, the Outreach page explains that live syncing is not configured. The preview uses clearly fictional examples.
