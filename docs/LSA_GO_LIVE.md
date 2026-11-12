# LSA lead engine: going live, in plain words

Nothing here has been run against the live database. This page says what each step
changes, what it never changes, and how it was rehearsed. A founder runs each step,
after a backup, and only after the dry run below has been read and approved.

## 1. The database update (`docs/db-change-proposals/RUN-ME-2026-11-02-lsa-lead-engine.sql`)

It only **adds**. No existing row or column is changed or removed.

- **New columns on `public.leads`** (every existing lead gets them empty, or 0 / empty list / false):
  the LSA lead id and Google's details, the Google proxy number, the engine's stage and
  follow-up counter, the conversation, the archive and revive dates, the dispute flag, and
  which fields were filled in automatically. `email` is added only if the table has none.
  Your status, quote, notes, phone, address and every other existing value stay as they are.
- **New table `oj_lsa_sync`**: where the sync is up to and its last error (one row per workspace).
- **New table `oj_lsa_review`**: "possible duplicates". When the engine is not sure an LSA lead
  is someone already in the workspace, it does not add or link it; it waits here until
  someone taps **Merge** or **Keep separate**. Nobody signed in can delete these rows.
- Both new tables: owners and members of the workspace read and write them; viewers and other
  workspaces see nothing. The whole script is one transaction, and a second run is refused.

## 2. The backfill (`npm run lsa -- backfill`)

Reads every LSA lead and conversation Google still has (read only) and, month by month:

- **Links** an LSA lead to your existing lead only when it is sure: the same street, the same
  real phone, the same email, the "LSA lead #id" note, or the exact full name, pointing at
  exactly one lead, with nothing that disagrees. Linking fills only **empty** fields (an
  NP_ phone, "n/a" or "Unknown" counts as empty) and never touches status, quote, dates,
  notes, or anything you typed by hand.
- **Holds** anything less certain (a nickname, a first name in the same town, two leads that
  match, or a match with a different phone or name) under Possible duplicates.
- **Adds** a new lead otherwise. New leads quiet for 30 days are marked Dead and archived
  (never deleted); they come back on the Spring Revival list on 2027-03-15.

## 3. The sheet archive (`npm run lsa -- archive-sheet-leads`)

Archives the leads that came from the Google Sheet until 2027-03-15, keeping their status in
`original_status`. Booked leads, leads with a next follow-up before 2027-03-15 and leads with an
LSA message in the last 30 days stay active. If a lead the sync added is surely a duplicate of a
sheet lead, it is merged: the sheet lead keeps every value it has and only empty fields are
filled; the duplicate is **archived, not deleted**, and nothing (bookings, history) is re-pointed.
Values that differ are listed, never overwritten. A JSON backup is written first. The Google
Sheet itself is never written to by anything in the engine.

## 4. The dry run and rehearsal (`npm run lsa -- dry-run [--from file] [--rehearse]`)

Run before any of the above. It reads Google (read only) and a snapshot of the leads table
(`select json_agg(l) from public.leads l;` saved to
`C:/Users/<you>/.secrets/oj-workspace/leads-snapshot.json`), and **never connects to Supabase**:
every network request except Google sign-in and the Google Ads search is refused.

It builds an in-memory copy of the database (the leads table as in the snapshot, then the
update above), runs the real backfill, the automatic Dead rule and the sheet archive on it,
and prints every LSA lead (name and the line it came from, address and its line, service,
link / possible duplicate / create new and why, one-tap suggestions, what it ends as), then a
before-and-after check of every existing value. It must say **0 deletes, 0 overwrites**.
`--rehearse` also lists every single field change.

## Order

1. Dry run, read it, approve. 2. Backup. 3. Run the SQL (with a human OK). 4. Backfill.
5. Sheet archive. 6. Turn the poller on (`LSA_POLL=on` on the host) and restart.
