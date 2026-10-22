# ATLAS 07 — Acceptance, Quality, Evidence & Adoption Scorecard

> Program-level definition of done, measurable quality, and how Oscar and Jacob will know ATLAS is worth operating. **No target below is asserted to be currently achieved.** See [master](./ATLAS_V3_MASTER_INDEX.md).

## 1. Score the system by the founders' real work, not by number of tabs

| Pillar | Metric | Ground truth | Failed state |
| --- | --- | --- | --- |
| Navigation | % frequent founder workflows completed without copying an ID, plus median interaction count | timed manual founder acceptance recordings with synthetic fixture | user must transcribe a customer or job identifier |
| Operations | inquiry→job→invoice→payment trace completeness | sampled real authorized transactions with evidence | orphaned booking or “paid” without settlement receipt |
| Two-founder collaboration | shared work visibility, concurrency, conflict resolution and handoff speed | Oscar/Jacob E2E UAT and audit | one founder overwrites other's quote or cannot see saved assets |
| Time saved | manual steps removed from 10 repeated workflows | before/after trial of same scenario | more clicks, slower than existing app |
| Revenue protection | actual response, booked, completed and collected conversion denominators | provider receipts and date-window controls | imported/estimated counted as sold |
| Field UX | checklist completion and successful offline recovery on phones | device tests, interrupted network run | phantom sync or lost inspection evidence |
| Finance | % of money summaries with source, basis and complete numerator/denominator | audited metric dictionary | unknown direct costs silently treated as $0 |
| Source reliability | connector success, freshness, partial coverage and provider errors disclosed | bounded provider pulls and logs | stale provider shown “green live” |
| Security | positive/negative access across roles and tenants | RLS/API/file URL fixtures | viewer opens founder bank records |
| Recovery | successful isolated restore duration and exact record comparison | actually executed restore drill | untested backup claimed safe |
| Aesthetics | founder design preference, legibility, scan speed, reduced motion | structured desktop/mobile review | gorgeous demo can't be used with real dense records |
| Subscription value | verified recurring cost avoided minus replacement operations | canceled invoices and new runtime bills | claim to “replace” a subscription without parity or savings |
| Reliability | observed p75/p95 responsiveness on representative device/data sizes | instrumented build and field telemetry with consent | animation jank, crashed mobile upload |

## 2. Workflow acceptance test templates

Every new feature PR contains a compact contract:

```text
Scenario ID:
Actor / role / permission:
Starting canonical record(s):
External source IDs and freshness:
Intended action / approval requirement:
Expected new state and audit receipt:
Expected financial value_basis, if any:
Positive E2E steps:
Negative E2E steps (unauthorized/stale/retry/unknown data):
UI states on desktop and phone:
Network/provider failure scenario:
Rollback/recovery:
Known limitations:
Owner signoff and measured outcome:
```

A pure list/table feature can use lighter tests; bank/payment/HR/auth/outward messaging must use stricter approval and evidence tests.

## 3. High-value end-to-end simulations (minimum 25)

| Test | Setup | Must prove |
| --- | --- | --- |
| QA-01 | Fresh Exterior LSA inquiry | received timestamp, customer lead source and correct assignee |
| QA-02 | Exterior lead with no quote | no invented quote, visible request and next action |
| QA-03 | Multi-building commercial survey | per-building glass/access/height assumptions saved |
| QA-04 | Oscar and Jacob edit same bid | no silent lost changes; merge/review |
| QA-05 | Customer proposal sent vs accepted | distinct verified statuses and receipts |
| QA-06 | Date with crew and vehicle double-booked | conflict signaled; confirmed dispatch requires resolution |
| QA-07 | Pressure washer out of service | ready-to-depart blocked until documented inspection/exception |
| QA-08 | Rig water/payload what-if | sticker/manufacturer input required; unsafe threshold never given false certification |
| QA-09 | Field loses network mid-photo upload | draft preserved with retry/conflict, no fake uploaded |
| QA-10 | Completed job, unpaid invoice | reported fulfilled yes, paid no/unknown |
| QA-11 | Payment webhook replay twice | one settlement event, no double-count |
| QA-12 | Job missing direct costs | net profit unknown; coverage warning |
| QA-13 | Two customer contacts share surname | do not merge by name; candidate only |
| QA-14 | GHL imports 80 prospect fixtures | imported not automatically “sent” |
| QA-15 | Actual Solutions message draft | no outbound until authorized action with receipt |
| QA-16 | Solutions client agent outage | actual signal and assigned incident owner |
| QA-17 | Shopify order placed but refund pending | gross/order/payment/refund/settlement clear |
| QA-18 | SKU missing shipping/advertising costs | contribution confidence not claimed |
| QA-19 | Creative edit approved but not posted | published status false until platform URL receipt |
| QA-20 | Media sponsor commitment without payment | contracted vs invoiced vs settled explicit |
| QA-21 | Employee requests owner-only finance URL | denied via RLS and server/API |
| QA-22 | Revoked client portal URL | cannot access other project or expired token |
| QA-23 | Provider rate limit/error mid sync | incomplete/last-seen badge and retry |
| QA-24 | Founder pauses an automation mid workflow | no new external action begins after pause acknowledgement |
| QA-25 | User replays external approve button | idempotent action; no second charge/message |
| QA-26 | Windows updater on pending schema change | blocks automatically; no unsafe migration |
| QA-27 | Failed new deployment | previous release and records remain intact |
| QA-28 | Verified backup restored into isolation | data and role access comparison pass |
| QA-29 | HQ at 430px mobile screen | readable priorities, accessible tap targets and source links |
| QA-30 | Keyboard-only, reduced motion and screen-reader use | actions/filters/dialogs behave correctly |
| QA-31 | Founder search “customer” with partial provider data | appropriate unknown/not-connected notice, no leakage |
| QA-32 | Client/employee reviews PDF receipt | correct restricted attachment permissions |
| QA-33 | Fleet and Commercial local draft migration | old devices retain exports until synced and reconciled |
| QA-34 | Role-permission change and re-login | old membership rights revoked, no JWT trust-only bypass |
| QA-35 | Company-wide dashboard sums multi-source money | avoids double-counting original and imported same transaction |

These tests are targets, not claimed CI cases. Production fixtures must use authorized, privacy-preserving data with secret/log controls.

## 4. UI acceptance and polish

- **Scan speed:** In a timed demo with representative data, the most urgent live/recorded work is identifiable without scrolling into unrelated content.
- **Context retrieval:** From customer name in CRM, job, quote or invoice, related records reachable in ≤2 deliberate interactions without passing through a separate Connected Operations page.
- **Density:** Desktop view handles 200+ relevant records using filtering/virtualization without truncating important text in irrecoverable ways.
- **Phone-first:** Key field flows tested at ~375–430px with one-handed control, large checkboxes, readable status and camera/upload states.
- **Accessibility:** Contrast, keyboard, focus traps, screen-reader labels, reduced motion, readable charts and accessible table alternatives. Work toward WCAG 2.2 AA where applicable; verify rather than merely claim.
- **Status truth:** Visible badges distinguish active, disconnected, partial, stale, unsynced, review, denied and unknown, with direct explanation.
- **Motion:** animation budget and lightweight SVG/canvas/WebGL fallback; disable expensive rendering when hidden/low-power/reduced-motion.
- **Performance:** measure on midrange consumer devices and authentic data volumes, record baselines per release and set justified budgets; no invented benchmark claim.
- **Brand quality:** each venture differentiated through accent/logo/hero treatment but shares navigation, typography, interaction language and source truth.

## 5. Finance integrity review

Before labeling company summary “Revenue,” decide which class it represents:

```text
Quoted / Proposed
Contracted / Accepted
Invoiced / Accounts receivable
Payment authorized or initiated
Settled / Bank verified cash
Refunded / Disputed
Manually recorded / not reconciled
Recognized accounting revenue (accountant-defined policy)
Estimated future performance
Unknown / missing record
```

The UI must never silently roll these into one number. For cost, classify direct material/labor/fuel/rental/fees/fulfillment versus overhead, unallocated and missing coverage. Profit/ROAS require denominator and cost confidence. Investors, taxes and legal income reporting should be accountant-reviewed.

## 6. Security and legal acceptance

- Existing founder Auth accounts remain intact unless they personally request an approved change.
- Every sensitive write is server-authorized and RLS-scoped; service_role never reaches the browser.
- File URLs, uploaded receipts, contacts and recordings never leak through cross-venture search snippets.
- Bulk export/share has preview and permission checks, retention rules and log redaction.
- Vendor SDKs and copied code have SBOM/license review, appropriate notices and enterprise-section exclusion.
- Call recording, SMS/email marketing, payroll, employment, tax and signature rules get jurisdiction-aware professional review where appropriate.
- REA research target/version/authority is documented; no license circumvention.
- AI tools have input bounds, policy scopes, evidence, explicit opt-in and pause/stop controls.

## 7. QA testing stack to design before build

- **Pure domain tests:** normalization, state machines, pricing/asset/payload equations, timezone, source ID reconciliation, snapshot coverage, rank policy.
- **Contract tests:** Supabase schema/RLS, Shopify/GHL adapter payloads and paging, source versioning, webhooks signatures, duplicate/idempotency and secrets.
- **Integration tests:** contact→bid→booking→asset→invoice, client→service support, SKU→order→refund/COGS, media→published receipt.
- **Browser E2E:** founder A/B logins, viewer/employee denial, phone and desktop, offline recovery, giant dataset.
- **Visual regression:** shell, HQ, venture colorways, bid/rig, modal, empty/partial/error/permission denied, light/dark/reduced motion.
- **Deployment drills:** stage/CI/host SHA, schema guard blocks, rollback and backup restore, secret safety.
- **Manual founder UAT:** genuine site survey + quoting, dispatch and cancellation, hardware readiness, provider outage and a customer money reconciliation.
- **Data-protection gates:** privacy and retention, access request handling, audit event authenticity, source provenance.

## 8. Adoption scorecard

Each staged release has a 7/14/30-day **optional observed adoption** report when sufficient data is available:
- founders who actually used feature, number of real workflows completed and completion/failure count
- median clicks/time observed in named tasks versus baseline
- incidence of double-entry, missing source, misjoins and unresolved conflicts
- provider/host faults impacting operations, support load, user-reported bugs
- ongoing maintenance and service costs; external subscription actually canceled where applicable
- comments from Oscar/Jacob and whether they would go back to the previous workflow.

If measurement is unavailable: `not measured`, never `0 issues`. Do not add invasive founder tracking simply to score productivity.

## 9. Program reality/status vocabulary

- **IDEA:** hypothesis, no spec.
- **RESEARCHED:** external examples/source evidence, legal/license notes.
- **SPECIFIED:** flows, ownership, gates, acceptance scenarios.
- **PROTOTYPE:** interactive/fictional demonstration, not durable business data.
- **IMPLEMENTED:** code exists, tests pass on reviewed ref.
- **MERGED:** GitHub target branch contains it; deployment status separate.
- **STAGED:** running on controlled candidate environment.
- **DEPLOYED:** exact live host SHA + smoke observed.
- **VERIFIED:** named founder performed critical E2E and data checks.
- **BLOCKED:** prerequisites documented; no silent bypass.
- **DEPRECATED:** replacements proven; original links/data preserved until archival.

Progress in percentage terms should count **accepted user workflows weighted by value**, not 413 checkbox bullets or subjective excitement.

## 10. “Done” for ATLAS

Both founders can trust HQ as the default operating surface, manage real commercial/residential service, clients/commerce/content, protect real money/records and permissions, and collaborate from laptop and phone without copying information between five apps. The interface should feel exceptional, but evidence, security, utility and recoverability win every tie.
