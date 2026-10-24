# Exterior Integration P1 — real two-founder phone acceptance

**Status:** R42 implementation merged with green GitHub CI, but **actual Windows-served SHA and independent Oscar/Jacob phone acceptance have not been observed**. Do not mark this as completed from source code or synthetic sample tests.

## Source-and-security boundaries

Oscar and Jacob must use their separate *existing authorized company accounts*. Choose a genuinely legitimate existing booking appropriate for internal follow-up. No customer SMS/email, changes to booking, invented crew/payout, public test customer records, production DDL or private restored database information. Only share sanitized PASS/FAIL with software-version evidence, never raw client/task IDs, addresses, credentials or private logs.

R42: [PR #128](https://github.com/OJ-Holdings/oj-workspace/pull/128) merged `098dd3fa1b32928a6449e180da17cb990321d02c`; [feature CI 40130639857](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40130639857), [post-merge CI 40130932237](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40130932237) both SUCCESS.

## Operator test steps

1. **Real deployment:** On trusted Windows host verify served commit matches tested GitHub revision. Use existing `scripts/verify-production-windows.ps1` privately. GitHub green by itself isn't deployment proof. No private host configuration in chat.
2. **Oscar phone:** Sign in, open **Jobs & Bookings**, choose an actual authorized original booking, tap **Open job workflow**. Confirm customer/date/time/scope, actual source status, unique quote eligibility, crew assignment uncertainty, explicitly browser-local field worksheet and absent invoice/bank claim. Nothing is written by opening this view.
3. **Independent link:** Copy exact job link and privately open it on Jacob's phone while he is independently authenticated. Confirm same original booking and no unauthorized access.
4. **One real internal action:** From existing Dispatch Preflight, if a legitimate exception warrants it, create a carefully worded **internal follow-up** assigned to the actual other founder. Do not include PII, private field costs or customer-facing messages. It should persist in existing member-protected company tasks.
5. **Jacob refresh:** Verify same job and task, assignee/due/priority on separate device. Use the existing authenticated task UI to update In progress and add a short internal non-PII comment. No field/job/payroll status should change.
6. **Oscar refresh:** Verify same task and progress from another session and no duplicate task on retry. The task marked Done must NEVER imply source booking completed, invoice issued or bank payment received.
7. **Negative coverage:** When an original customer is missing, source history is partial, price is not uniquely attributable, or approval pending, the view must present review/unknown state rather than invent price, dispatch readiness, complete field evidence or collected money. Do not deliberately mutate real customers to manufacture a negative case.
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
