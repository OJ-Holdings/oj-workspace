# Employee portal readiness

The employee portal keeps employee identity outside `oj_memberships`. An employee invitation is bound to a verified email and creates an `oj_private.employees` record only; workspace membership is rejected. Employees use `/employee` and receive job data from allow-listed security-definer functions. They do not receive direct access to customer, booking, workspace, or finance tables.

Owners manage invitations and access at `/workspace/employees`, assign one active employee to a booking, and set a rate for each assignment. There is no default rate. Instructions and checklist changes are recorded in the private audit table. Once a commission exists, its rate and employee stay fixed; corrections use a separately approved ledger adjustment with an owner-entered reason. Payouts are recorded manually.

## Commission rules

- The owner’s commission approval function requires a completed job and positive `leads.job_revenue`.
- Commission is `round(job_revenue * commission_percent / 100, 2)` and snapshots the rate and collected amount into the private ledger.
- Quotes are not read by the employee functions. Missing or non-positive payment data produces no estimate and cannot be approved.
- Employee responses expose only their calculated estimate and ledger amounts, not raw collected revenue, client names, phone numbers, quotes, company totals, or other workers.

## Live migration and validation

The migration is recorded at `supabase/applied/2026-10-18-employee-portal.sql` and is installed in the configured OJ Supabase project as migration `20261018215143` (`oj_employee_portal`). It creates private employee tables and narrowly scoped RPCs, plus a non-public `oj-employee-jobs` Storage bucket with assignment-scoped read and upload policies. The employee portal setup screen is expected to show the empty owner controls until Edy is invited; no employee or assignment was created in production.

Validation used a separate Supabase test project with synthetic owner, employee, second employee, and viewer identities. Authenticated role/JWT checks confirmed that employees see only assigned job RPC rows, direct lead/booking/private-table reads stay empty or denied, owner-only assignment RPCs reject employees, and Storage RLS allows the assigned employee and owner while blocking an unrelated employee and an upload to another assignment. Own-job uploads were allowed before closeout submission and denied afterward. Invite validation/acceptance bound the invitation to a verified email; commission approval required recorded payment and produced $53.19 from $425.55 at 12.5%; owner payout then appeared as paid in the employee ledger. The test also confirmed the owner portal RPCs run on the real configured project and return an empty employee setup with upcoming jobs available.

The local regression suite executes the production migration with Exterior Care `varchar` columns, preserving the return-type compatibility coverage. `npm test` (230 tests), `npm run typecheck`, and `npm run build` passed. Direct browser login with an employee account and binary photo transfer through the Storage HTTP API have not been exercised; the owner can create Edy's invitation from `/workspace/employees`. Do not use a service-role key in browser or employee request paths.
