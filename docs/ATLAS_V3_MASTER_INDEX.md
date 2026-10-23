# OJ Workspace V3 — ATLAS / The Ultimate Corporate Operating System

> **Status:** TARGET ARCHITECTURE + IMPLEMENTATION ROADMAP, not a declaration of implemented functionality.
> **Planning baseline:** 2026-10-22, OJ Workspace `main` `04a077d340fe44c842cc005fe3d9d846aa938986`.
> **Product owners:** OJ Holdings founders (Oscar and Jacob).
> **Target operations:** OJ Exterior Care; OJ Solutions; OJ Essentials; Oscar Jacob (content); shared holdings-level functions.
> **Project:** [OJ-Holdings/oj-workspace](https://github.com/OJ-Holdings/oj-workspace).

## The north star

**One place to run the whole business, not merely a place to look at it.**

ATLAS should feel like a purpose-built, premium corporate mission-control environment: fast, exceptionally beautiful, precise, mobile-capable, intensely practical, trustworthy and controllable. An operator should know what to do, why it matters, what record proves it, who owns it, what cash consequences are known, and what happens next.

Examples of natural flows, from any relevant screen:

- **Exterior:** Google LSA inquiry -> canonical customer/property -> site survey -> multi-building commercial bid -> founder review -> approved proposal -> booking -> crew, route, equipment/rig readiness -> field checklist, photos and time -> inspection -> invoice -> **verified** collected payment -> review and recurring opportunity.
- **Solutions:** imported prospect -> enrichment and validation -> owner/sequence -> personally approved outbound -> reply -> booked live demo -> signed proposal -> AI receptionist onboarding -> call quality, agent changes, uptime and support -> invoice and **verified** recurring collections.
- **Essentials:** product test -> supplier SKU -> margin scenario -> ad creative -> Shopify order -> payment/fulfillment event -> landed COGS + platform fees + ad attribution -> refund/dispute -> observed contribution margin -> reorder decision.
- **Oscar Jacob:** idea -> storyboard, script and production board -> locations/assets -> shoot -> edit version review -> approval -> user-initiated publishing -> URL receipt -> sourced view/retention metrics -> sponsorship invoicing and evidence.
- **Company-wide:** one global calendar and work ledger, shared files and searchable history, founder decisions and obligations, secure permissions, verified accounts, unified analytics, equipment, procurement, expenses and systems health.

**The smallest visible unit of ATLAS is a business decision attached to real evidence.** Page counts and module counts are not success metrics.

## Non-negotiable product calls

1. **Do not preserve a redundant Connected Operations tab as permanent top-level navigation.** Integration is a horizontal **record relationship layer**: shared entity panels, contextual actions, history, search, universal activity, related resources, and normal navigation inside every room. Existing `/tools/operations` may be used as temporary compatibility / diagnostics, then retire its sidebar entry after parity tests; do not delete existing code/data blindly.
2. **HQ is the prime command deck.** No generic 80-widget homepage: one decisive high-density viewport with clear hierarchy, expandable layers and personalized tiles. Each meaningful alert either opens evidence or leads to an authorized next action.
3. **Four distinct operating rooms, one design system.** Exterior is dispatch/production-first; Solutions is growth/client-delivery-first; Essentials is commerce/unit-economics-first; Oscar Jacob is production/media-first. Shared people, money, assets, companies and history are never duplicated.
4. **A visually remarkable interface without sacrificing speed:** navy/graphite canvas; precise typography; custom venture accents; live-but-honest operational signals; immersive fleet map/rig viewer; dense desktop boards and true phone-first field interfaces. Accessibility, contrast and reduced-motion support are acceptance criteria.
5. **One source of truth per field, not per entire screen.** The workspace may index Shopify, GHL and Exterior source rows but must preserve origin IDs, sync timestamps, completeness flags, conflict states and ownership. Imported contacts ≠ contacted; scheduled ≠ completed; invoiced ≠ paid; invoice ≠ bank reconciliation.
6. **Human command before external action.** AI and automations default to off, with proposal/preview/approval/execute receipts and immediate pause/stop. No silent marketing outreach, purchase, banking action, public publishing, employment changes, contracts, customer updates or production migrations.
7. **Use open-source/standards intelligently, not an unlicensed copy of a SaaS.** Research established behavior, build independent UX and modules, integrate where sensible, inspect licenses before copying any source, honor third-party API terms and usage costs.
8. **Preserve real production.** Active host reportedly Windows/Tailscale; current run SHA must be independently verified. Supabase Free database migrations are blocked until real recoverable backup + independent restore drill; no auth-user recreation.
9. **Treat legal entity accurately.** OJ Holdings LLC, its operating brands, ownership, accounts, service territories and roles are distinct concepts; this product is “corporate” in capability, not a claim of incorporation or separate subsidiaries.
10. **Build integrations as native seams, not a second database of copied customer names.** A booking, lead, client, payment, task, file, equipment assignment and approval should reference one canonical identity graph.

## Two-founder design: every view has an answer

| Founder question | System behavior |
| --- | --- |
| What should I work on right now? | Today's Mission, next action, evidence, time/dependency, owner and due date |
| Where is Jacob, what is he handling, and where can I help? | Permission-aware task/dispatch status, founder availability and attributable work changes; never covert tracking |
| What happened since I last checked? | Change digest with source links, revisions, owners, before/after and acknowledgement |
| What's actually sold, booked, owed, collected or still unknown? | Financial states separately with source coverage, bank reconciliation where authorized and explicit unknowns |
| Which commercial account or customer needs action? | Source-backed relationship drawer with next best **proposed** action and history |
| Can we do a job with our rig, crew and schedule? | Dispatch capacity + skill + availability + asset readiness + verified vehicle payload constraints |
| What's going wrong with ads or sales? | Spend with provenance, funnel conversion denominators, attribution confidence, aging leads, no phantom sales |
| What can we stop paying for? | Subscription vault, capability replacement matrix, build/buy comparison, quantified savings only after verification |
| What's coming next for the company? | Portfolio, roadmap, capacity, capital allocation and dependency-aware approved initiatives |
| Is the system itself healthy and backed up? | Actual deploy SHA, CI checks, source freshness, connector failures, backup evidence and restore-test receipt |

## Already implemented ATLAS releases

ATLAS V3 **Releases 01–10** are merged and CI-validated: source-aware HQ/shell, exact-ID CRM/task/booking context, CRM and Mission workbenches, Fleet Dispatch, Commercial Bid Command, validated same-device field context, explicit founder-reviewed shared task snapshots, a **versioned multi-project local commercial portfolio**, locally planned Fleet asset candidates and an exact booking/task-linked 7/30/90-day resource timeline. See [the detailed release ledger](./ATLAS_V3_RELEASE_CHANGELOG.md), [founder acceptance 03–07](./ATLAS_V3_FOUNDER_ACCEPTANCE_03_07.md), [founder acceptance 08–10](./ATLAS_V3_FOUNDER_ACCEPTANCE_08_10.md), and [shared persistence gate](./ATLAS_V3_SHARED_PERSISTENCE_GATE.md). These improvements are not full multiuser Fleet/Commercial sync; most of the 413-feature vision remains proposed. Windows-host deployment and phone-based founder acceptance remain **unverified**.

## Package navigation

| Document | Purpose |
| --- | --- |
| [01 — Product Doctrine & HQ](./ATLAS_01_PRODUCT_DOCTRINE_AND_HQ.md) | Product identity, personas, permanent navigation, operating cadence, command philosophy |
| [02 — Complete Experience / Tab Redesigns](./ATLAS_02_COMPLETE_UI_REDESIGN.md) | Screen-by-screen redesign, visual system, responsive behavior, interaction patterns, exciting hero features |
| [03 — Feature Atlas](./ATLAS_03_FEATURE_ATLAS.md) | Massive numbered feature inventory with domain scope, outcomes and priority lanes |
| [04 — Connected Domain Architecture](./ATLAS_04_CONNECTED_DATA_AND_WORKFLOWS.md) | Canonical identity graph, source-adapter seams, security, event/outbox, handoffs and lifecycle contracts |
| [05 — Subscription Replacement + REA Research](./ATLAS_05_SUBSCRIPTION_REPLACEMENT_RESEARCH.md) | Paid-software category map, OSS reference candidates, licensing, REA, build-versus-buy economics |
| [06 — Release Train & Dependencies](./ATLAS_06_EXECUTION_ROADMAP.md) | Cohesive release waves, foundational migration gates, explicit exit criteria, concurrency and priorities |
| [07 — Design QA, Scores & Realistic Adoption](./ATLAS_07_ACCEPTANCE_AND_METRICS.md) | Acceptance scenarios, release safety, performance, accessibility, observational measurement, stakeholder sign-off |
| [08 — Vision Lab: Signature “Cool Shit”](./ATLAS_08_SIGNATURE_CONCEPTS.md) | Differentiated experimental 2.5D/3D, fleet simulator, what-if world, founder desk and intelligent command surfaces |
| [Founder Acceptance / Releases 03–07](./ATLAS_V3_FOUNDER_ACCEPTANCE_03_07.md) | Windows, role, preview, Fleet, Commercial, handoff and iPhone manual verification |
| [Founder Acceptance / Releases 08–10](./ATLAS_V3_FOUNDER_ACCEPTANCE_08_10.md) | Multi-project local storage, exact booking/task relations and sourced Fleet date timeline QA |
| [Shared Fleet & Commercial Persistence Gate](./ATLAS_V3_SHARED_PERSISTENCE_GATE.md) | Proposed canonical server model, authorization, import and non-negotiable backup/restore signoff; no migration applied |

These **new V3 planning files** supersede V2 documents for future product direction, but **not** for truth about implemented features, historical migrations or current deployment. Always use [the live-engineering handoff](./START_HERE_CHAT_HANDOFF.md) for the latter.

## Reality baseline — protect what already exists

As of this planning snapshot, the repository already includes Executive Command, Corporate Tools, Scenario Lab, Corporate Intelligence, commercial estimator/transfer/Bid War Room, Fleet Command/Rig Lab (browser-local), Founder Weekly Review, Systems Health and the temporary Connected Operations index and task handoffs. These are partial products with real constraints, not the target ATLAS feature set. The actual user-hosted production SHA **has not been verified in this planning pass**.

Specific gated state: `contentPersistenceEnabled=false` for Oscar Jacob; Supabase additive schema in draft PR #42 has not been authorized or applied; browser-local fleets/bids cannot be represented as synced founder records; source coverage and finance collection remain incomplete. Do not lose existing user records or pretend a proposed V3 module already exists.

## Definition of a successful V3

- Founders run a normal seven-day workweek from HQ and business rooms without manual copy/paste across multiple tabs.
- A customer/project has a single identity, a multi-domain linked history, actor-attributed updates, and fully traceable revenue lifecycle.
- Field use on iPhone is faster than paper, while office use on desktop is richer than separate project, CRM, finance and calendar products.
- Every needed workflow is discoverable in at most two intentional navigation actions or one global command search; deep workflows may remain multi-step.
- The business looks amazing on a 27-inch screen **and** functions in sunlight on a phone with gloved/wet hands where appropriate.
- Founders can trust numbers, source coverage, security, rollback and approved external actions.
- A premium commercial software bill is reduced only where the replacement is equivalent enough, legally operable, reliable and measurably cheaper.

**Construction principle:** new capabilities must attach to existing entities, workflows and ownership. Another island of UI is a failure even if it looks impressive.
