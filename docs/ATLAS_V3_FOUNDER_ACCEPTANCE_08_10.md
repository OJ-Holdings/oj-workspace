# ATLAS V3 — Release 08–10 Founder Acceptance & Verification

> This is a **test plan, not evidence that manual tests have passed**. GitHub CI green does not establish that Windows port 3011, the Tailscale endpoint, or Oscar and Jacob's phones serve these releases. The private browser-local portfolio is **not synchronized** by GitHub merge.

## Verified engineering baseline (GitHub, not live host)

| Release | GitHub PR | Merged SHA | Exact-head CI |
| --- | --- | --- | --- |
| 08 — Commercial Portfolio & Resource Candidates | #66 | `ff8a56a7969cc4fd519b44d59228777f31beb718` | `39885587630` SUCCESS |
| 09 — Portfolio → Verified Booking → Shared Task | #67 | `33e5958fa1f54158e37e66471f1691b750d54422` | `39886433047` SUCCESS |
| 10 — Fleet Resource Timeline | #68 | `697e7660880785f0e8fc40d87073ecf94ea46dd2` | `39887258616` SUCCESS |

**Scope:** code-only. No database changes, migrations, external customer actions or actual dispatch.

## E1 — Real-project portfolio lifecycle

1. Open Exterior Care → Commercial on the approved editor account. Save a test estimate with two buildings, entered pane count, paid crew-hours, rental days, cost assumptions and review checklist; choose **Save as new project**. Confirm original standalone local-draft functionality remains intact.
2. Create a second project with different scope/pricing. Reload each separately. Confirm changing project B does not change project A. Confirm project names and scope survive reload in the **same browser**.
3. Edit project A from one tab, then modify it from a second tab. The first tab must reject a stale revision rather than silently overwrite the other version. This is a best-effort browser revision guard, not cross-device atomic database locking.
4. Archive a project: it should disappear from active Fleet planning. Restore the locally archived project by selecting and changing its stage; it is not an approved job when its status changes.
5. Import/export the portfolio through a **private, encrypted trusted transfer channel**. This JSON is **unencrypted** and can contain addresses and financial assumptions; never paste it into chat, GitHub or publicly shared storage. Confirm importing another organization's file is rejected and original data unchanged. Verify delete is scoped to one selected entry and prompts confirmation.
6. Test the 24-project cap, 1 MB import cap, duplicate IDs, corrupt JSON and negative cost values in an isolated test browser; confirm rejection without erasing the original draft.

## E2 — Exact booking and candidate asset relationships

1. Select a booking from the **loaded** Exterior Care booking list. Save the selected local project's link. Verify that the UI shows the recorded date/status with an exact booking ID, not fuzzy name, phone or address matching.
2. Create a local project with no booking, a deleted/unloaded booking ID and a cancelled booking. Confirm unlinked/unknown/inactive labels are distinct; none is treated as dispatch authorization.
3. On the same device, create a test fleet asset with entered service thresholds and status. Select the asset in project A; verify the project and Fleet Command planning overlay show the same **candidate** assignment, not an actual reservation.
4. Plan the same asset on two projects with different loaded booking IDs on the same calendar date. Confirm the planning conflict is flagged as a **possible same-day contention**; different time blocks and actual overlap must still be verified separately.
5. Mark equipment as needs-service/out-of-service in the local Fleet workbook. Confirm the project does not falsely mark it cleared, even if manually recorded as operational previously.
6. On a **different device** as Jacob, confirm project scopes, candidate asset selections and the local portfolio are **not automatically present**. Shared workspace membership alone does not synchronize browser data.

## E3 — Shared task handoff and reverse links

1. Select an existing saved project, modify entered assumptions if needed, and choose **Save & prepare project task**. Confirm the portfolio version saves, then the **standard shared task draft** opens.
2. Check task details. Its description must carry the local project ID/revision, scenario assumptions, warning that the source workbook is local-only, and **no private building addresses, notes, booking customer names, private phone numbers or source booking quote amounts** inserted automatically.
3. When the linked booking is in the currently loaded, authorized, valid-date Exterior booking source, the description may contain a **Booking record ID** receipt. When the booking is missing, cancelled, not yet loaded or invalid, that exact-ID relation **must not** appear.
4. Close the unsaved task and confirm no shared task was created. Repeat and explicitly Save. Verify Jacob can read the task subject to existing membership, while he still cannot open the original local project on his own device.
5. Return to the original device and project. Verify it finds only loaded shared tasks with the exact local project ID line; merely mentioning a project name or ID inside free text should not create a relation.
6. Preview or viewer role must not read owner/member private local portfolios or initiate the commercial source-to-task draft.

## E4 — Fleet 7/30/90-day operations planning

1. Open Fleet Command → Commercial dispatch planning radar. Confirm the source-load indicator distinguishes **loading**, **failed**, and actual loaded booking records; never label a failed or missing source as an empty verified schedule.
2. Use the 7-day, 30-day and 90-day filters. Verify date boundaries on America/Chicago planning day and correct sorting of loaded exact-ID booking dates.
3. Confirm that cancellation, invalid booking date and source records outside the loader's coverage do **not** create invented scheduled cards.
4. Confirm each card keeps **paid crew-hours** distinct from elapsed job duration, rental days as unverified assumptions, asset status flags and explicitly matched task links.
5. Confirm two same-day asset candidates raise a review warning, **not an actual scheduling conflict or booked equipment reservation**; missing crew/vehicle/insurance data must remain unknown.
6. Check iPhone width: cards and action buttons usable without horizontal clipping, text readable, and linked tasks open the existing editor.

## E5 — Production and database safety gates

1. Verify source main CI green on the exact merged commits; separately inspect the Windows live SHA with `scripts/verify-production-windows.ps1`. Record timestamps and which role/device you tested. Do not equate a green PR with live deployment.
2. **Do not merge PR #42 or any new schema-bearing PR** until a *real* encrypted private backup, isolated restore drill, Auth/storage/row-count audit, RLS role tests and explicit supervised approval exist. Consult [backup runbook](./BACKUP_FREE_TIER_WINDOWS.md).
3. Confirm all new project/asset storage is still device-local. For shared database persistence, use [the gated persistence contract](./ATLAS_V3_SHARED_PERSISTENCE_GATE.md), not an ad-hoc client database write.
4. Record any failures with reproducible steps and sanitized evidence. Never upload customer records, exported private portfolios, backup archives or credentials to GitHub.

## Acceptance ledger — manual sign-off still required

| Evidence | Current status |
| --- | --- |
| Exact-head GitHub CI for #66–68 | Success, see PRs |
| Windows port 3011 actual production SHA | Not independently verified here |
| Oscar editor workflow | Manual test not observed |
| Jacob editor/device workflow | Manual test not observed |
| Viewer/preview permission exercise | Manual test not observed |
| Actual iPhone field QA | Manual test not observed |
| End-to-end shared commercial/fleet database persistence | Not implemented |
| Supabase private backup + independent isolated restore | Not verified; migration remains blocked |
