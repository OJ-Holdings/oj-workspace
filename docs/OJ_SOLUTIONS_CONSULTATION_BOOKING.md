# OJ Solutions — 15-minute consultation booking ↔ OJ Workspace

## Architecture (one source of truth)
Website `ojsolutions.org/book` → GoHighLevel's native 15-minute consultation calendar → GoHighLevel contact/appointment → authenticated OJ Workspace **Solutions → Clients** calendar/contacts view.

The site must never declare a slot booked until the native GoHighLevel booking widget confirms it. Use the same dedicated calendar for the site and for Workspace. Let GoHighLevel handle availability, calendar conflicts, daylight-saving time, confirmations, cancellation and rescheduling. No second website-side database or duplicate appointment writer.

## GoHighLevel setup — required before live booking
1. In the **OJ Solutions** sub-account (not Exterior Care), create a named **15-Minute OJ Solutions Consultation** calendar; set appointment duration exactly 15 minutes, staff, availability, buffer, minimum notice, timezone **America/Chicago**, and the connected staff calendar(s). Turn on conflict checking and auto-confirmation only if desired by the founders.
2. Add a native booking form capturing first/last name, email, phone, business name, requested service, and brief challenge. Only add SMS opt-in if accompanied by reviewed *unchecked* express consent wording.
3. Create an opportunity workflow triggered **on appointment booked in that calendar**: dedupe contacts by GHL contact ID; tag e.g. `website-15min-consult`; create/update an OJ Solutions pipeline opportunity at **New consultation**, avoid duplicates when rescheduled; route notifications to Oscar and Jacob as appropriate. Do not count appointments as won revenue.
4. Copy the calendar's native *Embed / Share* booking URL into the website's `src/config.ts` → `GHL_CALENDAR_EMBED` (or `BOOKING_URL`). Do **not** paste a GHL private integration token there. Preview first and then deploy.
5. In the **OJ Workspace server** environment, set private `GHL_ACCESS_TOKEN` and `GHL_LOCATION_ID` with *read-only Contacts, Conversations, Opportunities, Calendars and Calendar Events* scopes; add `GHL_BOOKING_CALENDAR_ID` using the calendar ID from Step 1. Never commit secrets. Restart/redeploy Workspace after adding these.
6. GoHighLevel is the booking and CRM source of truth; OJ Workspace renders the contact list, pipeline and upcoming consultations read-only. It does **not** yet mirror the lead into the workspace's separate `oj_leads` table; treat that as a follow-on idempotent sync with verified organization ID and proper service-auth controls.

## Test before activating
- A person from a new email/phone can choose a genuine free 15-minute Central-time slot.
- Booked slots stop appearing as available; daylight-saving/timezone conversions are correct; two visitors cannot book the same staff at once.
- Confirmation or rescheduling is sent only with correct consent and settings.
- The booking appears as a GHL contact and appointment and, after Workspace cache refresh (currently up to five minutes), under Solutions → Clients → Upcoming 15-minute consultations.
- Same contact reschedules → one active opportunity, no duplicate lead.
- Missing permission or invalid ID shows an error for consultations but doesn't suppress CRM contacts or pipeline.
- Preview and production /book work on 360px mobile; no secrets in browser network/JS.
- Verify Privacy/Terms, recording, messages and data retention with the appropriate reviewers.

## Status at code delivery
The dashboard appointment reader is committed on a branch and awaits the dedicated GHL calendar ID and environment configuration. No real booking can be represented as active until the embed and workflows are connected and a full test booking succeeds.
