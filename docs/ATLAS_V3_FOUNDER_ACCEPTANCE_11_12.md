# ATLAS V3 — Release 11–12 Founder Acceptance & Privacy Audit

> **Owner acceptance checklist, not a statement that production or device QA passed.** GitHub CI verifies repository code, not which SHA is actually running on the Windows port 3011 release, whether the current browser has a valid local portfolio, or whether Oscar and Jacob completed these end-to-end workflows.

## Verified code release evidence

| Release | PR | Merged GitHub SHA | Exact-head CI |
| --- | --- | --- | --- |
| 11 — Field Mission Planner & Workforce Modeling | [#70](https://github.com/OJ-Holdings/oj-workspace/pull/70) | `d3ed846467922e9c5043a227f886c519b017c952` | `39890001290` SUCCESS |
| 12 — Equipment-Specific Fleet Maintenance Task Handoffs | [#71](https://github.com/OJ-Holdings/oj-workspace/pull/71) | `dbbfeb7d9b3deb0e8b974917aa99436a8522dab2` | `39890565690` SUCCESS |

Neither release includes a Supabase migration, cross-device shared Fleet/Commercial workbook, automatic staffing, rental, work-order execution, vendor purchase, customer quote, invoice, settled payment or approval.

## 1. Commercial crew and work-duration model

1. In an editor session, open **Exterior Care → Commercial → Commercial project register**, create a test project, and enter a known paid crew-hour total per building.
2. In the **Field Mission Planner**, initially leave all three workforce inputs blank. The model must say **Unknown / Not modeled**, not invent staffing, field days or sufficiency.
3. Enter one worker × two productive hours/day × one planned day against an eight-paid-crew-hour job. The model must flag a **six-person-hour shortfall**, and minimum modeled field days must round **up** to four. Enter two workers × four productive hours/day × one day to see the scenario fit on paper. Neither fit state establishes staff availability or a safe job.
4. Distinguish **paid crew-hours** from elapsed hours and from paid labor dollars. Actual weather, breaks, mobilization, qualifications and job-site conditions remain unverified regardless of model result.
5. Set a building to `access=review` and another to `access=lift, liftDays=0`. Verify the panel flags unresolved access and rental assumptions. Confirm it **does not** mark a rental reserved, lift operator qualified or insurance cleared when modeled days increase.
6. Save the selected local project, navigate away, reload on the **same browser**, and verify the three workforce parameters and private staging note persist. Select a different project to confirm each project has its own crew scenario. A pre-R11 JSON portfolio without the optional field must reopen with all workforce parameters unknown; never silently populate new staffing assignments.
7. Enter edge cases (zero labor requirement, negative/oversized crew size, excessive field days, invalid productivity precision and overlong note) in a disposable test environment. Invalid imports must be rejected without overwriting the original portfolio.
8. Open **Fleet Command → Commercial dispatch planning radar**. Verify the same project's modeled shortfall appears beside source booking and candidate equipment statuses. The Fleet display must not expose the private staging note or create an actual crew assignment.

## 2. Internal field mission pack — explicit data boundary

1. Generate the internal field pack using both **Copy internal pack** and **Download pack**. Verify it is a current-editor snapshot (which might include unsaved changes) rather than a signed/customer-facing proposal or permanent shared artifact.
2. The pack may include explicitly entered **project and building names**, approximate pane counts, paid labor, lift-access assumptions, locally entered candidate asset IDs/status and only the **exact matched booking ID** from currently loaded records.
3. Verify that dedicated building-location fields, private site notes, workforce staging notes, customer phone numbers, booking names and quote amounts are **not automatically copied**. **Caveat:** project/building names themselves can include identifying text or addresses typed by an operator—review the output before sharing.
4. Test missing, cancelled, invalid-date and differently identified bookings. An unknown source must not produce a verified booking date or a forged booking receipt.
5. Verify the internal pack explicitly says it does not dispatch equipment, contact customers, approve quotes, certify safety, record invoices or make payments. Manually confirm relevant source details again before acting.
6. Open **Save & prepare project task** and inspect the standard shared task draft. Verify it includes modeled paid-hour gaps and exact booking receipt (only when verified), but not the private workforce note. Closing without saving must not create any shared task.
7. After explicitly saving a test task, check Jacob's member view: the task text is visible subject to existing membership, but the underlying project and staging notes are **not synchronized**.

## 3. Fleet asset-specific service handoffs

1. Record a test Fleet asset in a founder editor browser (e.g. an existing washer), including status, meter, next service date and optional service threshold. If testing in the real workspace, clearly mark synthetic test records.
2. Open **Fleet Command → Asset Registry**, choose **Prepare service task** on the exact asset. Confirm a standard task draft appears; it should contain `Local fleet asset ID: <exact id>` on a single line, recorded equipment condition and meter, thresholds, local service-count and most recent locally logged service date.
3. Confirm the task does **not** copy private equipment notes, maintenance descriptions, repair-expense amounts, passwords or customer information. Beware that an asset's **name/model** may also contain sensitive operator-entered text; review before sharing.
4. Confirm the task explicitly says no equipment inspection, repair, parts purchase, reservation, dispatch permission or payment has occurred. No due date or technician assignment is invented. A locally recorded due/out-of-service flag can affect the draft's **suggested priority**, not certify urgency.
5. Close the task editor without saving. No shared task or historical service entry should appear.
6. Reopen and explicitly save the task. Return to Fleet Command's asset card: the **exact textual asset ID** should now identify the shared task. Mere similar names, fuzzy descriptions, unrelated organizations and spoofed multiline asset IDs must not create links.
7. Try a missing ID, invalid source JSON, revoked/read-only role or preview session. Source task preparation must fail closed without exposing private local workbook contents.
8. Review the same asset from Jacob's device. Jacob may see the shared task snapshot if authorized, but **does not automatically receive** the underlying asset workbook; this is not a canonical database FK.

## 4. Existing safety and deployment regression

- Run the earlier [Founder Acceptance 03–07](./ATLAS_V3_FOUNDER_ACCEPTANCE_03_07.md) and [08–10](./ATLAS_V3_FOUNDER_ACCEPTANCE_08_10.md) acceptance cases for task links, historical portfolio import, source loading, role isolation and date boundaries.
- Use `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-production-windows.ps1` **on the actual Windows host** under the expected workspace directory. Record exact served SHA, local timestamp, user and browser. A successful GitHub merge alone is **not proof of a live deployment**.
- Keep Supabase draft PR #42 blocked. The [Shared Persistence Gate](./ATLAS_V3_SHARED_PERSISTENCE_GATE.md) requires real protected backup, separate restore drill, RLS/tenant/security review and independent supervised migration approval. No production SQL changes are authorized by this document.
- Never paste exported private portfolios, live customer locations, phone numbers, asset notes, booking records or database credentials into public issue reports, GitHub CI fixtures, chat logs or screenshots.
- Record device model, browser, actor/role, exact test project/asset IDs (in private evidence only), expected result, observed result and timestamp. Re-run after changes rather than calling CI success equivalent to founder acceptance.

## Manual sign-off — open at document creation

| Gate | Result |
| --- | --- |
| Release 11 exact-head GitHub CI | Passed |
| Release 12 exact-head GitHub CI | Passed |
| Windows host actual SHA and deployment receipts | Not independently verified |
| Oscar desktop commercial/crew test | Not independently observed |
| Jacob task visibility and private workbook isolation | Not independently observed |
| Viewer + preview negative/permission tests | Not independently observed |
| iPhone responsive Fleet/Commercial field QA | Not independently observed |
| Protected Supabase backup and isolated restore drill | Not independently verified |
| Canonical cross-device Fleet/Commercial database sync | Not implemented |
