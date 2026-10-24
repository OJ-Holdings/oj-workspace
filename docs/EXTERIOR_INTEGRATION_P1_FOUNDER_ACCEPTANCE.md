# Exterior Integration P1 — real two-founder phone acceptance

**Status:** R42 Job Continuity and R43 in-job assignment/progress/comment actions merged with green GitHub CI, but **actual Windows-served SHA and independent Oscar/Jacob phone acceptance have not been observed**. Do not mark this as completed from source code or synthetic sample tests.

## Source-and-security boundaries

Oscar and Jacob must use their separate *existing authorized company accounts*. Choose a genuinely legitimate existing booking appropriate for internal follow-up. No customer SMS/email, changes to booking, invented crew/payout, public test customer records, production DDL or private restored database information. Only share sanitized PASS/FAIL with software-version evidence, never raw client/task IDs, addresses, credentials or private logs.

R42 job source view [PR #128](https://github.com/OJ-Holdings/oj-workspace/pull/128) merged `098dd3fa1b32928a6449e180da17cb990321d02c`; R43 job action loop [PR #130](https://github.com/OJ-Holdings/oj-workspace/pull/130) merged `628e465f9c16fda82d08aa6d25c7959d18465c76`, exact feature [CI 40135901958](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40135901958) and [post-merge CI 40136080889](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40136080889) both SUCCESS.

## Operator test steps

1. **Real deployment:** On trusted Windows host verify served commit matches tested GitHub revision. Use existing `scripts/verify-production-windows.ps1` privately. GitHub green by itself isn't deployment proof. No private host configuration in chat.
2. **Oscar phone:** Sign in, open **Jobs & Bookings**, choose an actual authorized original booking, tap **Open job workflow**. Confirm customer/date/time/scope, actual source status, unique quote eligibility, crew assignment uncertainty, explicitly browser-local field worksheet and absent invoice/bank claim. Nothing is written by opening this view.
3. **Independent link:** Copy exact job link and privately open it on Jacob's phone while he is independently authenticated. Confirm same original booking and no unauthorized access.
4. **Oscar assigns work from the SAME job:** In **Jobs & Bookings → Open job workflow → Assign next action**, choose the other actual member, an optional due date and priority, and publish one legitimate internal action. No raw customer PII, private field costs, bank information, customer messages or source booking mutation. The new company task must persist on the existing member-protected board after explicit confirmation. There is no automatic assignee notification.
5. **Jacob acts from the SAME job:** Open the previously shared exact booking on his independent authenticated phone, refresh the company action panel, verify the task/assignee/due/priority and change **Progress** to Working or Needs owner review. Post a short private-data-free company progress comment **right inside that job**. No field/job/payroll/customer status should change.
6. **Oscar closes the internal loop:** Refresh the exact job, verify the task stage and Jacob's actual attributed comment without changing source booking or field work. Update only the team task Done after appropriate confirmation, then refresh on Jacob's phone. Verify a retry doesn't duplicate an identical open action. Task Done MUST NOT imply job complete, customer signoff, invoice issued or bank deposit.
7. **Negative coverage:** When an original customer is missing, source history is partial, price is not uniquely attributable, or approval is pending, the view must present review/unknown state, not invent price, crew dispatch, completed field evidence or collected money. The R43 server additionally rejects attempts to post NEW comments to original-task snapshots whose booking was moved or cancelled; verify this on safe authorized staging, **not by deliberately mutating actual customer appointments**.
8. **Mobile experience:** Independently record whether each founder can find the correct job in two purposeful navigation steps and understand what is shared vs still local/absent; record input problems, sunlight/readability issues and route redundancies.

## Redacted observation card — all pending

| Check | Actual observation |
| --- | --- |
| Served Windows SHA verified | NOT TESTED |
| Oscar signed-in original booking source | NOT TESTED |
| Jacob same exact booking on independent phone | NOT TESTED |
| One legitimate source-bound team task appears for both | NOT TESTED |
| One real stage/comment roundtrip persisted | NOT TESTED |
| No false quote, completed field or paid cash | NOT TESTED |
| No duplicate, cross-account/booking exposure or unintended write | NOT TESTED |
| Both founders understand the phone workflow | NOT TESTED |

Keep all false positives, permission failures and friction as P1 fixes before marking independent acceptance. A viewer/outsider/revoked actor matrix is a controlled **P2 staging RLS** test, not a test on real customer records.

## After P1

Proceed to P2 actual encrypted founder-host archive, physically independent protected mirror, isolated real source restore and reconciliation, authenticated RLS negatives, actual Storage file-byte retrieval and rollback. Green synthetic PostgreSQL CI does not constitute any P2 proof. Continue the [Integration Program P1–P7](./EXTERIOR_INTEGRATION_ADOPTION_PROGRAM.md), and only at P7 perform the second complete critique before returning to standard roadmap work.
