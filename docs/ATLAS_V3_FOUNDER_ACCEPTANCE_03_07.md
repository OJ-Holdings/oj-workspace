# ATLAS V3 — Founder Acceptance & Production Truth Audit

> Owner test plan, 2026-10-22 (America/Chicago). This is a manual verification plan; writing these checks does NOT mean they have been performed on the Windows/Tailscale production host, on Jacob's phone, or with real job records.

## Release scope and source-of-truth rules

- Corporate HQ, CRM and task workbench, Fleet Command, Commercial Bid War Room, validated local Commercial↔Fleet coordination and the explicit shared-task drafting seam are the acceptance target.
- Supabase additive schema PR #42 remains DRAFT/BLOCKED. No unverified database restore, RLS change or fabricated synchronized bid/fleet inventory is permitted.
- Private Fleet and Commercial workbooks are scoped by organization-specific localStorage keys. Both workbooks remain per-browser; ordinary existing shared CRM and task records have different persistence.
- “Source exists” means this role has actually loaded it. “Review complete” does not mean signed, rented, booked, insured, dispatched, invoiced, settled or paid. Marketing leads and planned margins are not cash.
- Automated CI is required but not sufficient. The checks below must be performed on desktop and mobile by each permitted role before declaring founder acceptance.

## Founder exercise A — Executive HQ and CRM/task identity

1. Open Executive HQ as an authenticated editor; cycle Today / Operations / Growth / Money / Strategy. Confirm numbers and linked missions are sourced, and unknown providers do not display invented zeros.
2. Create an internal workspace CRM lead, select it, and choose “Create follow-up task”. Review the *draft* before clicking Save.
3. Confirm the saved task exposes the original CRM lead by exact workspace ID, and the lead detail shows its related task, stage, due date and assignee; do not accept phone/name fuzzy matches.
4. Open the same workspace using a viewer account. Confirm task and CRM editing is blocked and private record details follow the user's existing permissions.
5. Open preview mode and confirm its Executive HQ navigation remains inside /preview, rather than redirecting into live /workspace.

## Founder exercise B — Fleet Command field safety

1. On the owner's desktop browser, open Fleet Command and record a test-only fleet asset and service flag. Clearly mark it as a test record if using a real company workspace.
2. Set realistic manually entered vehicle payload and rig weight assumptions. Confirm an over-capacity plan is flagged; an unspecified capacity must remain UNKNOWN, never “safe”.
3. Enter pre-departure checks. Confirm that checks entered yesterday are not counted as *today's* checks or displayed as a fresh checked state on the next calendar day in America/Chicago. Switching an old checklist to today asks before replacing prior checked items.
4. Verify the previous-day warning and the instruction to reset checks for **each job**, including multiple departures on the same day.
5. Export a private fleet JSON and verify secure offline custody. Cross-organization imports and corrupt or oversized files must be rejected without overwriting the original.
6. Sign in as read-only and preview roles. Confirm private local asset workbooks are not exposed through the new coordination panel.

## Founder exercise C — Commercial estimating and the Bid War Room

1. On the same browser, open Exterior Care → Commercial. Add a second building, enter pane counts, paid crew-hours, access approach and planned rental days.
2. Set at least one lift-access building to zero rental days, and another to “access review”. Confirm the field-bridge exceptions and Bid War Room findings remain unresolved.
3. Enter cost, contingency and target contribution margin scenarios. Confirm the model labels its price as an *internal scenario*, not a client quote, invoice, booked job or actual profit.
4. Save the estimate, switch back to Fleet Command, and verify that the **saved** commercial project scope appears in the cross-module panel. Repeat the direction Fleet → Commercial: its recorded service flag appears as an exception.
5. Change the draft but do not save. Another screen must not present the unsaved version as synchronized; it reads the last validated local save.
6. Test corrupt or wrong-organization local draft import. Confirm the interface rejects it and preserves the original browser data rather than silently overwriting it.
7. On a second device as Jacob, confirm Fleet and Commercial drafts do **not** appear automatically. A text summary or manually transferred JSON is NOT shared storage.

## Founder exercise D — Explicit team handoff (only after Release 07 code is deployed)

1. As an editor, click “Save & prepare shared task” in Commercial. Verify the current local estimate saves first, then the standard task editor opens with a source-labeled snapshot.
2. Before saving the task, verify the description includes building/labor/rental assumptions and honest review exceptions but **does not include site addresses, private site notes, hidden customer contacts or an invented verified-source ID**.
3. Close the unsaved task draft. Confirm the existing unsaved-change prompt works and no shared task was created.
4. Repeat, then explicitly Save the task; verify Jacob sees the task in the existing shared Task Board but still cannot fetch the originating browser-local estimate.
5. In Fleet Command, choose “Prepare shared task”. Verify the normal task editor shows recorded asset attention and dated checklist limitations. No dispatch, purchase, rental, email, external call, invoice or payment occurs.
6. Corrupt the relevant device-local source in a controlled test environment. Confirm that task preparation fails with a visible error and creates no task draft from untrusted records.
7. As viewer or in preview mode, confirm that no private-source task handoff action is available.

## Release and deployment gates

1. Each relevant PR must be merged from an exact SHA with green GitHub CI: PowerShell parser, npm ci, TypeScript, automated tests and production Next.js build.
2. From the Windows host, compare the locally served build at port 3011 to GitHub main. The checked-in verifier is:

   `cd C:\STRATHOS\apps\oj-workspace`

   `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify-production-windows.ps1`

3. Treat a green GitHub merge as **code delivered to main**, not proof that the Windows auto-updater ran successfully. Record the real production SHA, date, test devices and actual environment before declaring a feature live.
4. Never bypass the protected Supabase backup/isolated restore/RLS review gate to solve Fleet or Commercial data synchronization.
5. Do not paste real customer addresses, phone numbers, private raw JSON, access tokens, VINs or account data into public PR logs/screenshots or test fixtures.

## Acceptance sign-off record

| Gate | Status at document creation |
| --- | --- |
| GitHub implementation and CI | Verify latest per-release PR; this document is not CI evidence |
| Desktop Chrome / Windows host | Not independently observed |
| Oscar editor workflow | Not independently observed |
| Jacob editor workflow | Not independently observed |
| Viewer and preview permission check | Not independently observed |
| iPhone field layout | Not independently observed |
| Shared Fleet/Commercial server persistence | Not implemented; blocked by schema safety gate |
| Exact deployed SHA | Not independently observed |
| Backup + isolated restore drill for PR #42 | Not verified; migration remains blocked |

**Release rule:** do not mark every item “done” simply because the release built. Record the test actor, device, UTC and Chicago timestamps, expected/actual result, and links to evidence. Only then promote from CI-verified to founder-accepted.
