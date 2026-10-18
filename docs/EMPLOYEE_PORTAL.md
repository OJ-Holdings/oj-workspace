# Employee portal readiness

The employee portal keeps employee identity outside `oj_memberships`. An employee invitation is bound to a verified email and creates an `oj_private.employees` record only; workspace membership is rejected. Employees use `/employee` and receive job data from allow-listed security-definer functions. They do not receive direct access to customer, booking, workspace, or finance tables.

Owners manage invitations and access at `/workspace/employees`, assign one active employee to a booking, and set a rate for each assignment. There is no default rate. Instructions and checklist changes are recorded in the private audit table. Once a commission exists, its rate and employee stay fixed; corrections use a separately approved ledger adjustment with an owner-entered reason. Payouts are recorded manually.

## Commission rules

- The owner’s commission approval function requires a completed job and positive `leads.job_revenue`.
- Commission is `round(job_revenue * commission_percent / 100, 2)` and snapshots the rate and collected amount into the private ledger.
- Quotes are not read by the employee functions. Missing or non-positive payment data produces no estimate and cannot be approved.
- Employee responses expose only their calculated estimate and ledger amounts, not raw collected revenue, client names, phone numbers, quotes, company totals, or other workers.

## Pending migration

Review `supabase/pending/employee-portal.sql` before applying it. It creates private tables and narrowly scoped RPCs, plus a non-public `oj-employee-jobs` Storage bucket with assignment-scoped read and upload policies. It has not been applied to production. The SQL test `tests/employee-portal.test.ts` executes the migration against an isolated PGlite database and checks invitation, role, assignment, closeout, and commission boundaries. PGlite does not provide Supabase Storage's schema, so the dynamic Storage policies still require validation against a separate Supabase test project before the migration is considered deployable.

Before production application, use a separate Supabase test project with distinct owner, employee, unrelated employee, and ordinary workspace accounts. Exercise invite verification/expiry/revocation, all direct PostgREST table requests, Storage list/read/upload attempts across assignment IDs, private signed URLs, account revocation during an active session, closeout transitions, rate/payment corrections, and manual payouts. Confirm Storage policies and bucket limits in that project's `storage.objects` and `storage.buckets`, then run the full workspace tests and build. Do not use a service-role key in browser or employee request paths.
