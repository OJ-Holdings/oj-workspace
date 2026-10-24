# ATLAS 06 — Execution Roadmap / Connected Release Train

> **Planning only, no release dates or implementation are promised.** V2 baseline: `main` `04a077d340fe44c842cc005fe3d9d846aa938986` on 2026-10-22. The 413-feature atlas is deliberately larger than one executable season. See [master](./ATLAS_V3_MASTER_INDEX.md), [features](./ATLAS_03_FEATURE_ATLAS.md), [architecture](./ATLAS_04_CONNECTED_DATA_AND_WORKFLOWS.md).

## Priority override: Exterior integration-before-expansion pass train

**Current founder instruction (October 24, 2026):** Execute [Exterior Integration & Adoption P1–P7](./EXTERIOR_INTEGRATION_ADOPTION_PROGRAM.md) **before returning to normal standalone Exterior feature releases**. This is a dependency-first reshuffle of this roadmap, not deletion of any original AT-01…AT-30 goals. Phase G0 genuine production recoverability still gates *all* new shared schema. Start with safe in-place source-connected job continuity. Preserve existing implementation and source IDs, and do not invent completed cloud persistence, field evidence or money. A final second full product critique and prioritized remaining backlog at P7 is explicitly required **before restoring the prior feature sequence**. Track progress only in [the existing 12-wave ledger](./EXTERIOR_COMMAND_PROGRESS.md).

## One program, four parallel tracks

- **PLATFORM/TRUTH:** source identities, backups, auth/RLS, audit, data contracts, integration quality and safe event/outbox.
- **EXPERIENCE/WOW:** ATLAS design system, streamlined HQ, contextual entity drawers, immersive business rooms, mobile, maps and fleet.
- **VERTICAL WORKFLOWS:** Exterior field/service, Solutions clients/agents, Essentials commerce, Oscar Jacob content, company-wide sales/finance.
- **CONTROL/INTELLIGENCE:** finance truth, founder decisions, analytics, approvals, scenarios, bounded safe AI and automation.

Parallelize only independent work. A gorgeous rig UI can be prototyped without the database, but cannot claim two-founder sync before shared Fleet persistence and RLS. Any finance dashboard must distinguish booked/recorded from collected cash.

## Mandatory execution protocol

1. Recheck latest `main`, competing PRs, actual Windows host SHA and current Supabase applied migrations.
2. Write actor → action → record → evidence → expected state → negative test acceptance scenarios.
3. Ship **vertical slices** with source, domain mapping, related entities, UI, human action and receipt—never another isolated tab without linked value.
4. Use isolated feature PRs, CI, browser/device tests, rollback plan and honest coverage.
5. DB/config migration only through separate supervised approval after a verified backup plus isolated restore drill, never via unattended code-only Windows updater.
6. Post-merge main CI and host SHA verification are separate from PR green. Write accurate changelog and don't claim deploy without observed receipt.

## PHASE G0 — Production confidence / unblock future persistence

| Gate | Outcome | Exit evidence |
| --- | --- | --- |
| G0.1 | Inventory live Windows/Tailscale release, source status and migrations | actual commit SHA, ports and actor-authenticated smoke |
| G0.2 | Protect Supabase Free project through PostgreSQL 17 private dump and checksum | verified archive, protected second copy, no secrets in repo/chat |
| G0.3 | Restore independently to isolated environment and rehearse permissions | row/relation comparison and owner/member/viewer/outsider negative tests |
| G0.4 | Audit production SECURITY DEFINER/grants, RLS, secrets, file URLs and Auth accounts | triaged issues and before/after tests |
| G0.5 | Approve additive migration sequencing against applied history | signed founder plan, test/rollback and restore receipt |

**Current draft PR #42 stays draft/unmerged** until G0 is actually satisfied. Planning alone is not permission.

## PHASE 1 — The unified visual foundation (safe code-only lane)

| Release | Integrated deliverable | Exit test |
| --- | --- | --- |
| AT-01 | ATLAS tokens/typography, adaptive rail, command header, responsive grid and accessibility foundation | screenshot and keyboard/mobile regression |
| AT-02 | Beautiful HQ Today/Ops/Money/Growth/Strategy modes; unify Command, Intelligence, Weekly Review data instead of more cards | founder answers five daily questions without manual navigation |
| AT-03 | Entity cockpit with related activity/source/tasks/booking/documents in contextual drawer | link follows actual IDs without cross-venture leakage |
| AT-04 | Global scoped search, Quick Create, favorites and owner-specific layouts | two-step navigation and no dead action |
| AT-05 | Retire standalone Connected Operations from primary rail/home; keep URL compatibility redirects | CRM→task and booking→task flows still work; no lost bookmarks |

These are UI/data-contract releases; **not** a new persistent join or full end-to-end ERP.

## PHASE 2 — Shared canonical company kernel (gated)

| Release | Deliverable | Exit test |
| --- | --- | --- |
| AT-06 | Fourth-venture registry; canonical Person/Company/Property/SourceMapping, permissions | preserve legacy Exterior data and both founder Auth identities |
| AT-07 | WorkOrder/Project/Relation/Audit and optimistic revision contract | customer/opportunity/task/file state shared without retyping |
| AT-08 | Supervised versioned import of browser-local commercial drafts and Fleet assets | both founders can see/edit same durable records; conflict and rollback proven |
| AT-09 | Durable approvals, outbox idempotency, actor/intent/receipt and provider reconciliation | duplicate webhook cannot duplicate payment/message/record |
| AT-10 | Private entity-linked files, contracts, history and scoped search | explicit denial for employees/outsiders/other customers |

No giant one-shot migration; each additive step has separate negative tests and observed backup evidence.

## PHASE 3 — Exterior flagship end-to-end

| Release | Deliverable | Exit test |
| --- | --- | --- |
| AT-11 | Canonical CRM 360 + property/site account + lead response and duplicate review | source Exterior lead IDs retained |
| AT-12 | Shared Bid War Room 2.0, phone site survey, building scope, assumptions/versioning, founder approvals | no unsent proposal marked accepted |
| AT-13 | Scheduling/Dispatch, routes, crew skills and availability, resource conflicts | valid actual booking/vehicle/crew allocations |
| AT-14 | Cinematic Fleet Operations Center, 2.5D rigs, real asset specs, inspections, service and parts | payload warnings sticker-backed; mobile checklist usable |
| AT-15 | Field check-in/closeout evidence, labor, photos, scope changes and QA | completed field service distinct from customer-paid |
| AT-16 | Invoice, expenses, bank/payment settlement evidence, reviews, recurring service | actual collected cash proven before revenue is marked settled |

**Signature acceptance epic:** One Milwaukee/Waukegan commercial property: site survey → founder-reviewed multi-building bid → customer approval → scheduled and resourced work → verified field closeout → invoice → collected payment/reconciliation. No retyping customer site names or confusing cost unknowns.

## PHASE 4 — Corporate services

| Release | Deliverable | Exit test |
| --- | --- | --- |
| AT-17 | Treasury states, budgets, verified source-based AR/AP, reimbursements and accountant exports | profit suppressed when cost coverage incomplete |
| AT-18 | Founder decision log, goals, ownership/board review and work capacity | decisions have approver and follow-up |
| AT-19 | Contracts, COIs, warranties, procurement, subscriptions and SOP Vault | access control, versioning, obligation due dates |
| AT-20 | Analytics/KPI dictionary, comparable periods, data quality, evidence-backed forecast | each chart exposes source, denominator, caveat |
| AT-21 | People, shifts, internal comms, training and approved earnings | RLS test, no unapproved wage/bank transfer |

## PHASE 5 — Deep venture-specific operating rooms

| Release | Deliverable | Exit test |
| --- | --- | --- |
| AT-22 | Solutions prospect→outreach evidence→demo→proposal, full GHL pagination/coverage | imported prospect != sent activity |
| AT-23 | Solutions client onboarding, agent QA/version change, support/renewal and collected MRR evidence | client isolation, provider outage and rollback |
| AT-24 | Essentials catalog/order/returns/fulfillment/landed cost/ad attribution | Shopify order gross != deposit/profit |
| AT-25 | Oscar Jacob scripts/shoots/edit review, rights, approval and publication URL receipt | fourth-venture persistence gated, no auto-publish |
| AT-26 | Cross-business marketing, LSA/GBP, referrals, outreach experiments and sponsorships | consent, attributable conversion, approved action |

## PHASE 6 — Internal subscription replacement and standout labs

| Release | Deliverable | Exit test |
| --- | --- | --- |
| AT-27 | Replace high-cost founder workflows: field forms, quotes, approvals, calendar, analytics, support | subscription actually cancelled, replacement parity and cost measured |
| AT-28 | Automation Studio OFF by default; dry-run, expense/action limits, approval packet and pause/stop | duplicate, failure, unauthorized actor and rollback rehearsed |
| AT-29 | Approved REA/OSS Research Lab with evidence/target rights/license decision records | independent implementation with no prohibited copying |
| AT-30 | ATLAS Wall, rig cutaway, Property Atlas, operational time replay, strategy war table | operators demonstrably faster; useful low-motion fallback |

**Release labels are proposed program IDs, not existing PRs or deployed features.**

## Dependency map

```text
Host truth + backup/restore + RLS audit
         -> supervised schema + canonical identity
         -> relations + audit + approvals/outbox
         -> shared CRM/property/estimates
         -> dispatch/fleet/field closeout
         -> invoicing/settlement
         -> finance intelligence + repeat service

Code-only parallel track:
Design tokens -> Shell -> HQ -> entity cockpit -> global search
                                 -> embedded cross-domain relations
                                 -> remove redundant standalone tab
                                 -> richer business redesigns

Future safe autonomy:
Grounded data + explicit policy + restore confidence
         -> dry-run AI -> founder approval -> bounded action -> receipt
```

## Design implementation sequence

1. Shared tokens, typography, surfaces, navigation, search and role-aware source badges.
2. HQ Today + customer/entity dock + tasks/CRM/calendar interactions.
3. Fleet and Commercial showpieces (keeping local-only persistence honest).
4. Exterior dispatch/field workflows; then Finance/Library/Team/Settings.
5. Solutions/Essentials/Studio complete domain rooms after source/persistence gates.
6. Optional map/rig 3D and agent workbench once measurable practical utility is proven.

**Do not rewrite every route at once.** Use route and token adapters, preserve deep links and existing founders' work. A “complete redesign” is an eventually complete design system + screens delivered in reviewable slices, not a risky one-shot branch.

## Acceptance pilots for Oscar and Jacob

1. Morning command: both see same authorized source state, independent priorities, honest disconnected badges.
2. Commercial survey on iPhone: record access/height/lifts and scope; second founder reviews without overwriting.
3. Dispatch: booking with overdue washer service cannot be marked ready without acknowledged exception.
4. Field: photo/time QA can be reviewed but does not claim customer paid.
5. Money: booked $1,000 job, $1,000 invoice, $0 confirmed settlement -> settled still $0/unknown as evidence supports.
6. Solutions: imported list has 80 prospects and 0 activity rows in dated verified fixture; display makes neither “contacted 80” nor “0 real sent” without source coverage.
7. Ecommerce: unknown landed cost cannot produce assured net margin; refund and fees reconcile.
8. Studio: review link vs actually published video URL are distinct records.
9. Permissions: viewer/employee/outsider cannot deep-link bank, HR, restricted contract or another customer's information.
10. Resilience: lost network, conflicting edits, repeated webhook, source outage and bad deployment produce truthful state and recoverability.

## How to prioritize a huge atlas

Scoring: real weekly founder hours saved **25%**, measured revenue protected/captured **25%**, shared cross-domain leverage **20%**, frequency **15%**, delivery/operational risk **10%**, differentiated user delight **5%**. P0 security and backup overrides scores. This produces high leverage customer/booking/dispatch/finance wins ahead of low-impact decorative widgets.

## Release definition of done

- Persona and workflow documented; canonical entity and source owner identified.
- Desktop+phone UX, empty/loading/error/offline/conflict and accessible patterns reviewed.
- Unit/integration/E2E security/permission and financial provenance tests pass.
- Backward-compatible data/URL transition with fallback and documented rollback.
- Human approvals and receipts for sensitive actions; no silent external send/pay/post.
- PR-head green checks; then main checks; then **actual production host SHA** and founder smoke separately observed.
- Changelog accurately distinguishes implemented, preview, staged, blocked and deployed.
- Operators can demonstrate time saved or a safer/more accurate task than before.

## What must NOT happen

A new top-level tab for each of 413 features; claims of synced Fleet before migration; fake live status/maps/crew locations; mass outsourced software source copying; unauthorized binary/DRM bypass; premature microservice infrastructure; a huge destructive schema release; anonymous “AI did it” financial tasks; false profit; broken existing sign-ins; unobserved deployment success.

## First actionable backlog

**Code-only now:** screen-by-screen research, ATLAS design tokens/prototypes, merge existing Executive Command/Intelligence/Weekly Review surfaces, contextual customer/job/asset record dock, and plan to de-emphasize standalone Connected Operations with redirects. Refine browser-local Fleet/Rig and Commercial UX without mislabeling it shared. Test cross-source honesty and mobile load times.

**Gated next:** actual private Supabase backup/restore, RLS audit, founder-supervised additive domain schema, canonical ID graph, shared bid/fleet migration, end-to-end dispatch and evidence-backed money lifecycle.
