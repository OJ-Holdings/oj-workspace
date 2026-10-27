# OJ OS - Master Overhaul V1 (planning document)

Status: PLAN ONLY. Nothing here is built, applied to the live database, or deployed.
Authors: Oscar (direction), Claude (research and plan). Written 2026-10-26. Revision 4: 2026-10-27 (adds truck-fund goal and rig plan, equipment inventory, SMS parked, $0 budget rules, Illinois gap, GBP API path). Revision 3: 2026-10-27 (adds Mercury account structure, real commercial proposals, LSA account facts, commission and tax answers, iPhone decision). Revision 2: 2026-10-27
(adds Oscar's answers, real Supabase data findings, payments, GPS, live presence/chat, premium customer
experience, connections catalogue, free-AI gateway, hiring/truck planning, season strategy).
Supersedes (as direction, not as history): the ATLAS V3 docs, the Exterior R-series, WORKSPACE_UPGRADE_ROADMAP.

Plain ASCII on purpose, like the rest of this repo.

---

## 0. One-paragraph vision

OJ OS is the single operating system for OJ Holdings LLC: one place where Oscar and Jacob
sell, schedule, run crews, get paid, keep the books, market, and watch the whole company
breathe in real time. It replaces the stack of paid tools a service business normally rents
(field service software, accounting, invoicing, CRM, e-sign, scheduling, review tools,
forms, automation, BI) with first-party modules built on our own data, with free and
open-source engines underneath wherever that is smarter than writing it ourselves. It must
feel like a million-dollar tool: fast, dense where it counts, calm everywhere else, and
never a wall of disclaimers.

The organizing law:  **Customer -> Job -> Money.**  Every screen, number and automation
traces to those three things. No silo has numbers the others cannot see.

## 1. Where we are today (from the live audit, 2026-10-26)

Facts, not opinions:
- 402 commits in about 10 days, ~80 of them fixes/guards/evidence gates. Docs are ~4.8 MB, about twice the source (2.3 MB).
- 17 sidebar items, 41 entries in a "Tools" hub of which 13 are placeholders ("Planned", "Not available yet").
- Exterior Care has real data: 181 customers, 72 completed jobs, $18,670 recorded job revenue, 6 upcoming jobs.
- Finance and Analytics default to the current month and already roll Exterior job revenue and cost in (that is why they showed $2,995 in / $30 out for October while Exterior showed $18,670 for the whole season). CORRECTION (2026-10-27): an earlier draft of this plan said the two were unconnected; that was wrong, it was a date-range difference. The real gap is that costs are almost never recorded and `oj_finance_entries` is empty, so there is no expense side.
- 60 of 72 completed jobs have no cost recorded; 17 have no revenue.
- "Team at work" says "Not connected" everywhere (presence tables never applied).
- Company CRM shows 0 leads (a second, empty CRM). Project 360 holds one synthetic test record.
- Fleet runs on browser-local storage only. Automation Studio: "not available yet".
- Test/spam rows exist in website intake and messages.
- Strong foundations to keep: Supabase auth + roles + row-level security, employee portal, work timer,
  Daily 10 outreach game, calendar, files, 5-minute CI-gated auto-deploy, ~700+ tests.

What went wrong: effort went into proving the system is safe and honest, not into letting two
founders run a company. The fix is not less rigor; it is a product spine and fewer, deeper screens.

## 1b. The business as Oscar described it (2026-10-27) - these facts drive priorities

- **One LLC: OJ Holdings LLC.** Exterior Care, Solutions, Essentials and the Oscar Jacob content brand are divisions of one legal entity. Consequence: "entities" in the ledger are classes/divisions (tags on one set of books), not separate legal books. Consolidated is the real statement; division P&Ls are management views. Intercompany eliminations are not needed in V1.
- **Crew:** one inconsistent crew member today; hiring more at the start of next season; all have smartphones. Pay is commission, about 20-25% of the job, higher/lower depending on whether the crew member drives (far jobs). So the commission engine needs a rule table (base rate, driver bonus/travel tier by distance) and the job record needs "who drove" and distance.
- **Biggest pain:** Oscar does the jobs himself, fights equipment failures, and carries the washer in the back of his car; there is no work truck and no crew that can run jobs without him. This is a capital + operations problem. OJ OS must help with: reliability (equipment failure log, spares checklist), capital planning (when a truck/trailer rig pays for itself), crew onboarding and "run the job without Oscar" playbooks (checklists, photo requirements, scripts), and dispatch so a crew member can run a day alone.
- **Banking:** checks deposit at Mercury Credit Union, then the money is sent to Mercury "to be split across" (allocation). Mercury is the operating bank. We need to accept ACH and card (and checks, cash) because a commercial window-cleaning job was just won.
- **No bookkeeping exists yet.** No CPA (one will review later; founders will self-review until then). Opening books start from zero: bank history import, categorize, self-review checklist, CPA package later.
- **Current tools:** only Shopify (Essentials). GoHighLevel plan is currently down. Everything else is spreadsheets/Supabase. So there is almost nothing to retire, and almost everything to build. GHL-dependent Solutions views must degrade gracefully while it is down.
- **Sales tax:** Essentials collects tax (about 2 sales so far, a few dollars of tax). Exterior: no CPA guidance on whether house washing is taxable in Wisconsin (still unresolved, see 7.6).
- **Lead sources today:** Google Local Services Ads (LSA) is the main source and has been huge for commercial window cleaning; then website; then referrals; then Google Business Profile presence. Social posting is minimal. Door knocking stopped when college started (Jacob at UW-Milwaukee); the founders still meet and work together.
- **Growth focus:** Exterior Care while in season (it is ending now, and the business is "blowing up"); off-season focus shifts to recurring online revenue: OJ Solutions (AI receptionists) and Oscar Jacob (content/brand). Oscar is split on which matters most, so OJ OS must be excellent for both modes (see 11b Season strategy).
- **Preferences:** layout decision approved (entity switcher + command bar + dock + live ops Home). Wants OJ OS-native invoices and payment links. Wants GPS tracking ON. Wants live presence ("Jacob is working on X"), a pop-up chat bubble between the two founders while both are on the dashboard, a premium customer experience, and as many connections as possible. Comfortable with AI reading and writing data and with full admin/control capability. Wants free online AI used wherever possible. Wants creative, niche, "omniscient" features. Will pay for tools later if the system warrants it, but wants to start free.

### 1c. What the live Supabase data actually says (read-only queries, project "OJ EXTERIOR CARE LEADS", 2026-10-27; aggregates only, no customer details were read)

Tables that hold the business today: `leads` (181 rows), `bookings` (38 confirmed), `doorknocking_sessions` (36), `quote_requests` (website form, ~20), `activity_log` (367), plus the workspace tables (`oj_cards` 28 tasks, `oj_work_sessions` 23, `oj_outreach_prospects` 80, `oj_events`, `oj_documents`, and commercial/content tables with 1 test row each). `oj_finance_entries` has 0 rows (so Finance has nothing to show for Exterior - confirmed).

| Fact | Number |
|---|---|
| Leads (all time, season Apr-Oct 2026) | 181 |
| Total quoted value across all leads | $38,575 |
| Completed jobs | 72 |
| Recorded job revenue (completed) | $18,670 (matches "about $18k this season") |
| Average recorded revenue per completed job | $339 |
| Completed jobs missing revenue | 17 (so true revenue is higher than $18,670) |
| Recorded job cost total | $192 (only 12 jobs have any cost; real cost of chemicals, fuel, labor, truck wear is not captured) |
| Statuses | closed 83, completed 72, following_up 9, contacted 8, booked 6, new 3 |
| Completed revenue by month | Apr $450, May $3,755, Jun $5,510, Jul $5,960, Aug none, Sep none, Oct $2,995 so far |
| New leads by month | Apr 21, May 67, Jun 5, Jul 39, Oct 49 (Oct quoted value $16,550: the LSA/commercial surge) |
| Door knocking (all time) | 1,716 doors knocked, 41 jobs scheduled, $12,620 job total (about $7.35 per door) |

What this means for the build:
1. **Aug and Sep show zero completed jobs and no leads in Aug/Sep.** Either the business paused, or jobs were not logged. Ask Oscar; if jobs were done and not logged, there is unrecorded revenue.
2. **Source tagging is weak.** 133 of 181 leads are tagged DTD/door-to-door (since door knocking built the base), but Oscar says LSA, website and referrals now dominate. The recent surge is probably under "other"/blank. OJ OS needs mandatory lead source on every new lead and a re-tagging pass on the Oct leads (LSA vs website vs referral).
3. **Cost capture is almost nonexistent**, so margin is unknowable today. Expense capture (chemicals, fuel, equipment repair, LSA ad spend, labor/commission) is the first money feature that pays for itself.
4. **Conversion:** quoted $38,575 vs revenue $18,670 on completed work. 83 leads closed without revenue. A "why lost" reason on closing would teach pricing and channel quality.
5. **Rebooking goldmine:** 72 completed customers are the cheapest revenue next spring (annual house wash/windows). A spring rebook campaign list can be built on day one of OJ OS.
6. Data quality: leads store phone/address as plain text; no structured property, no customer id beyond the lead. The Phase 1 customer/property model must dedupe and link these 181 leads without losing history.

### 1d. More real facts from Oscar's screenshots and files (2026-10-27)

**Mercury account structure today (10 accounts, available about $2,763 plus $345 pending):**
- Exterior (EXT): `01 Revenue Clearing` (checking), `03 Operations & ...` (checking, about $169), `02 Tax Reserve` (savings, about $568), `OJ EC TRUCK FUND` (savings, about $1,995), plus an Owner Distribution pair (`04` and `05`, one per founder, $0 each) and a Mercury credit card ($200, autopay daily from 01 Revenue Clearing).
- Essentials (ES): `01 ES Clearing`, `02 ES Operations & G...`, `03 ES Tax Reserve`, with a 30% tax / 70% reinvestment auto-transfer rule.
- Exterior revenue clearing has an auto-transfer rule that splits incoming funds by percentages (visible text: "60 Growth / 25 Tax / 15 Oscar ..." and a truck-fund share; the full rule is truncated in the screenshot). Oscar says that today all Mercury money is going into the truck fund accounts.
- Design consequence: the allocation engine (7.9) mirrors this exact bucket model (Clearing -> Operations / Tax reserve / Truck fund / Owner distributions) and reads Mercury balances per account. We will treat these accounts as ledger accounts (asset sub-accounts) so each bucket is a real balance on the balance sheet.
- Observation to review during bookkeeping: $18,670 recorded revenue vs about $2,763 available cash. The difference is spent or moved (ad spend, equipment, personal draws, the truck fund, card payments). Bookkeeping from zero will show where it went.

**Google Local Services Ads account (from Oscar's screenshots and lead export):**
- Bidding: automated (maximize leads). Average weekly budget: $1,500. Previous 7 days: 14 leads.
- Billing: Oct 1-26 charges $1,075.60; Sep $300.52; Aug $245.74 (LSA spend and lead volume are ramping fast). Payment threshold $500; last manual payment Oct 26 for $575.60. Primary card: a Mastercard (exp 07/31); NO backup payment method.
- **Operational risk seen on screen:** a red banner said "Service may be suspended - you've significantly exceeded your payment threshold ... make a payment." The page also showed the full $500 threshold available and a payment on Oct 26, so the banner may be stale, but a suspended LSA account would stop the main lead source. Action for Oscar: confirm the banner cleared, add a backup payment method, and consider switching to a payment profile that cannot fail silently. OJ OS will watch LSA billing status and alert on suspension risk.
- Job types on: glass and mirror cleaning, power/pressure washing, window cleaning, other. Off: gutter cleaning, rooftop/skylight cleaning.
- The lead export (about 45 leads in the pasted sample from Jul to Oct) shows: window cleaning is the dominant job type; many leads are far from Kenosha (Wauwatosa, Sussex, Oconomowoc, Gurnee, Beach Park, Hainesville, Waukegan in Illinois, Franklin, New Berlin, Oak Creek); lead types are Message and Phone; charge status Charged / Not charged / Credited (so credits are real); October had about 33 leads (about 29 charged), roughly $37 per charged lead if all October charges are those leads. Each lead has a numeric Lead ID, received time and last-activity time.
- **LSA leads existed in Aug and Sep** even though the `leads` table has none for those months, so the Aug/Sep gap is a logging gap: jobs and leads were not logged then (Oscar confirmed). OJ OS will import LSA exports and match them to existing leads by phone/name (and create the missing ones) so the history is complete and source = LSA is set correctly. The pasted export contains customer phone numbers; they are not stored in this document.
- Service area implication: LSA brings leads 30-60 miles away. Travel cost is real money, so job costing must include drive time/fuel and the commission travel rule must be defined (see 6.4).

**Three real commercial proposals (PDFs Oscar supplied; the plan builds the system that produces and tracks these):**
1. **Waukegan office/hangar (108 exterior panes, IL):** one-time $1,230; quarterly $1,110 per visit; monthly $1,000 per visit; ACH payment; client-provided water; entry-door interior glass free; 12-month agreement for recurring plans with 30 days written cancellation; COI on request; restoration of staining not guaranteed.
2. **American Roller Company (Union Grove, WI, two buildings):** Facility A $950, Facility B $1,950, combined $2,750 (a $150 coordination discount); ref OJ-AR-2026-1021; valid through Nov 4, 2026; net 30 or per purchase order; optional semiannual maintenance $2,350 per combined visit; vendor onboarding and insurance docs; scope exclusions listed.
3. **ND Cleaning MKE (Milwaukee, four buildings: Atlas, Timbers, Trade Center, 222 E. Erie):** individual prices $11,350 / $16,250 / $6,200 / $13,850 ($47,650 separate); preferred four-building package $39,400 (saves $8,250); two- and three-building combos; optional monthly ground-floor maintenance per building ($275 and $675 per visit on two of them). This single proposal exceeds the entire season's recorded revenue ($18,670); its status needs tracking.
Design consequences: (a) proposals are currently hand-built PDFs; OJ OS must generate branded proposals from a pricing builder (per-building/per-pane pricing, package and frequency discounts, exclusions text blocks, validity date, reference number, terms net 30 or ACH, 12-month agreements with 30-day cancellation) and track them through sent, viewed, accepted, e-signed; (b) commercial pipeline value must be visible and weighted by probability (these three proposals total about $43,000 of open quotes: $1,230 + $2,750 + $39,400, ignoring recurring options); (c) recurring options (monthly, quarterly, semiannual) must become recurring plans that generate visits and invoices; (d) vendor onboarding packets (W-9, COI, insurance, vendor forms) need a document vault per commercial customer; (e) payment terms differ by client (ACH, net 30, PO), so invoice terms are per customer.

**Other answers recorded:** commission will be a flat 20% for crew once there is a company truck (crew will not drive personal vehicles); partnership taxation (to be confirmed by a CPA); equal owner draws taken when the founders decide, with an agreed adjusted split when one does more work; all crew use iPhones.

### 1e. Decisions and facts from Oscar, round 3 (2026-10-27)

- **ND Cleaning MKE ($39,400):** no response yet. Treated as one-time unless they ask for recurring. OJ OS needs proposal status tracking and follow-up reminders (a reminder cadence for big proposals, for example day 3, 7, 14).
- **LSA suspension banner:** Oscar says it cleared and he will add a backup payment method. OJ OS still watches billing status.
- **Mercury auto-transfer:** stays pointed at the truck fund until further notice.
- **Truck goal: $20,000 all-in** (a fully rigged work truck including all costs), ready before next season starts; Oscar will accept a great-deal truck to save money; not financing unless it turns out to be feasible. Current truck fund balance seen in the screenshot: about $1,995. Gap: about $18,000 in roughly 5 months (target date: start of the 2027 season, assume early April) = about $3,600 per month into the fund, or about $830 per week. The dashboard will carry this as a first-class goal (see 6.17).
- **Commission:** 20% of revenue before any costs, and it applies to commercial jobs for now.
- **Illinois:** the company has no insurance or registration set up for Illinois (the Waukegan proposal is in Illinois). Insurance is handled by the founders. OJ OS will flag any job outside Wisconsin as "needs out-of-state check" (insurance, registration, tax) until cleared.
- **Equipment owned today:** ALH4240 hot-water pressure washer unit, a Simpson 4200 psi washer, Xero Pure and Xero Pro (basic) water-fed pole system. Currently renting a washer until the main washer is repaired (the pressure washer fails most often and takes the whole rig down). No ladder mounting and no lift access.
- **Current rig:** pressure washer and hose reels on a skid in the back of a Ford Explorer (FPIU), run with the trunk open and exhaust pointed out the trunk; it began leaking and needs servicing. (Safety note: running a gas engine in or at the back of an enclosed SUV can let carbon monoxide into the cabin even with the trunk open. A truck bed or trailer rig, an exhaust extension pointed away from the vehicle, and a battery CO alarm in the cabin are cheap protections; this is part of why the truck matters.)
- **Website:** Oscar runs ojexteriorcare.com and agrees to give API access for reviews and traffic. **DNS:** the founders control DNS (to be confirmed), so a customer portal can live on a subdomain (for example pay.ojexteriorcare.com or portal.ojexteriorcare.com) added with one DNS record when we are ready.
- **GoHighLevel:** will return once Solutions has a paying client to justify it; until then Solutions views degrade gracefully.
- **SMS: parked.** No SMS in OJ OS for now (no Twilio sending, no SMS campaigns, no text "on my way"). Customer communication uses email, the customer portal and web push for founders/crew. The old oj-sms-system is left alone. Anything in this plan that says "text" should be read as "email or portal notification" until SMS is revisited.
- **Budget: about $0 for now.** Rules: free and open-source first; no required monthly subscriptions; pay-per-transaction fees (Stripe) are fine because they scale with revenue; the Apple Developer Program ($99/year) is deferred, so background GPS with the phone locked waits (see 6.4) and the first GPS release is foreground "job mode"; email goes out through the existing Google Workspace/Gmail account (free within its limits) instead of a paid email sender; AI uses local and free tiers (4.4).

## 2. Principles (these decide arguments later)

1. Customer -> Job -> Money is the spine. If a feature does not attach to it, it needs a strong reason.
2. One record, many views. Never two stores for the same fact.
3. Enter once. Quick entry from the command bar or phone in under 10 seconds.
4. Numbers always show. Uncertainty is a small badge ("est.", "no cost yet"), never a paragraph or a blank tile.
   Every missing figure is one tap from being entered. Missing data is a task, not a disclaimer.
5. Phone first for crews, desktop first for the office. Two designed experiences, one codebase.
6. Aggressive on features, conservative on money and data: integer cents, append-only ledger, RLS everywhere, staged SQL a human approves.
7. Own the data and the engine. Adopt open source where license and quality allow; clone behavior, not code, from commercial products.
8. Ship in vertical slices. Each phase leaves the company able to do something it could not do the day before.
9. Boring infrastructure: Postgres, a few services, tested, backed up, restorable.
10. Delete before adding. Every phase ends with a deletion list.

## 3. The "paid software, free in our dashboard" strategy (the big idea)

### 3.1 What we are replacing (price points are approximate or unverified unless marked)

| Paid product category | Examples | What OJ OS ships instead |
|---|---|---|
| Field service management | Jobber (from ~$49/mo, up to ~$199/mo for 10 users, verified in search), Housecall Pro (~$59/mo entry, verified in search), ServiceTitan (enterprise, expensive) | Jobs, dispatch, crew app, customer portal, recurring plans |
| Small business accounting | QuickBooks Online, Xero | Double-entry books, bank feeds, statements, tax set-aside |
| Invoicing / payments | Invoice Ninja, Square invoices | Invoices, payment links, AR aging, receipts |
| Expense capture | Expensify, Dext | Phone receipt capture + OCR + auto-categorize |
| CRM | HubSpot, Pipedrive, GoHighLevel pieces | One customer/lead record across all companies |
| E-sign | DocuSign | Quote/contract e-sign with audit trail |
| Scheduling / booking | Calendly, Cal.com | Public booking page tied to crew capacity |
| Reviews / reputation | Podium, Birdeye | Auto review requests + reply queue |
| Marketing / email / SMS | Mailchimp, Klaviyo | Campaigns, drips, win-back, seasonal rebooking |
| Automation | Zapier, Make | Native rules engine with run log and approvals |
| BI / reporting | Tableau, Looker | Built-in analytics, forecasting, cohorts |
| Route planning | Route4Me, OptimoRoute | Self-hosted routing + job sequencing |
| Time clock | TSheets, Homebase | Crew clock-in tied to jobs and payroll |
| Equipment/maintenance | Fleetio | Equipment hours, service ledger, alerts |
| Doc management | Dropbox, Paperless | Files tied to customer/job/entity |
| Project/task management | Asana, Monday | Mission board (already exists, simplify) |
| Payroll | Gusto, ADP | NOT replaced. We compute commissions/hours and export; Gusto or similar stays (legal/tax risk). |

Honest limit: payroll tax filing, card processing, and bank connectivity are regulated infrastructure.
We integrate, we do not rebuild. Everything else is on the table.

### 3.2 REA (github.com/morluto/rea) - what it is and how we use it

Verified from the repository README (2026-10-26):
- MIT-licensed toolkit that connects AI agents (Claude Code, Codex, Cursor, Gemini CLI) to reverse-engineering tools over MCP, with a CLI.
- Analyzes native binaries (Ghidra/Hopper/IDA backends), JavaScript/Electron apps, .NET, Android APKs, Flutter, websites, HAR network captures, packet captures, firmware, and more.
- Stated scope: lawful research, interoperability, preservation, and analysis of software you own or are authorized to examine. It explicitly excludes cracked copies, stolen keys, and bypassing license restrictions. Analysis runs locally and results cite evidence and limitations.
- It can build local test environments from recorded web API traffic.

How OJ OS should use it (the lawful, valuable way):
1. **Behavioral specs from products we pay for or have authorized access to.** We already use GoHighLevel, Shopify, Mercury, Twilio, Google Workspace. Capture our own sessions (HAR) and API traffic, have REA + an agent produce a written behavior spec ("what states does a Jobber job go through, what does the quote-approval email contain, how does a recurring plan bill"). We implement our own version from the spec. This is clean-room style: behavior, not code.
2. **Interoperability.** Where we must talk to a system (GHL, Mercury, Shopify, our old oj-sms-system), REA helps map undocumented API behavior from our own traffic so our connectors are exact.
3. **Migration.** Reading our own legacy data formats and exports (old sheets, SMS system, exported CSVs) with traceable evidence.
4. **Competitive teardown from public surfaces.** Public marketing sites, public docs, free trials we legitimately hold. Feature lists and UX flows are fair to study; copying code, assets, copy, or trade dress is not.

Hard rules (put in CLAUDE.md for this repo):
- Never reverse engineer a product we have no right to inspect; read its terms first. Many SaaS terms forbid reverse engineering even of the web client. When in doubt, use public docs and our own account's visible behavior only.
- Never copy source, images, icons, text, or proprietary data models verbatim. Specs describe behavior; our code is written from the spec.
- Never bypass licensing, paywalls, rate limits, or auth. No scraping of other customers' data.
- Every spec records: source, date, what was observed, what was inferred. We keep the evidence.
- Keep REA as a dev-time tool (runs on a dev machine), not a runtime dependency in the app.

### 3.3 Free and open-source engines worth using (license notes are from search where stated; ALL must be rechecked in each repo's LICENSE file before adopting)

| Need | Candidate | Notes |
|---|---|---|
| Accounting design reference | ERPNext/Frappe, Akaunting, Odoo Community, Firefly III (AGPL-3.0, verified), Actual Budget (MIT, verified), GnuCash, Ledger/hledger | We build our own ledger in Postgres. Study their chart-of-accounts, journal, reconciliation, tax models. ERPNext is believed GPLv3 (unverified); Akaunting license not confirmed in search. AGPL/GPL code must not be pasted into our code. |
| Invoicing reference | Invoice Ninja | README states Attribution Assurance License (verified in search); still read LICENSE. Good invoice/quote/payment-flow reference. |
| Receipts / docs | Paperless-ngx (GPL-3.0, verified), Tesseract/OCRmyPDF (OCR) | Paperless alone does not extract totals/line items (verified). We run OCR then an extraction step (local model or API) into our expense form. |
| Route optimization | OSRM (BSD-2-Clause, verified) + VROOM (verified: time windows, skills, priorities; works with OSRM) | Self-hostable via Docker (Docker Desktop is installed on the PC). Wisconsin OSM extract is small. Real route sequencing for free. |
| Maps | MapLibre GL JS + OpenStreetMap data, vector tiles via Protomaps/PMTiles | No per-load fees. Check tile-use policies; self-host tiles for Wisconsin. |
| Workflow automation | Activepieces (core MIT, verified in search) or n8n (Sustainable Use License: free for internal use, verified in search) | We prefer a native rules engine for core flows (receipts, audit trail), and may run Activepieces/n8n for long-tail glue. |
| E-sign | Documenso (believed AGPL, UNVERIFIED) | Or build simple e-sign: typed/drawn signature + audit trail + PDF hash. Lower risk, small scope. |
| Scheduling page | Cal.com (license recheck needed) | Probably build our own booking widget tied to crew capacity. |
| CRM reference | Twenty (believed AGPL, UNVERIFIED) | Reference only; our customer model is custom. |
| BI | Metabase / Apache Superset (license not confirmed in search) | Optional power-user layer on a read-only replica; built-in dashboards come first. |
| Weather | National Weather Service API (free, US) | Rain/wind-aware scheduling. |
| Building size estimates | Microsoft US Building Footprints (open data), OSM buildings | Rough square-footage for instant ballpark quotes. Must label as estimate. |
| Charts | Existing chart library in repo (verify) / Recharts / visx | Keep whatever is installed. |
| PDF generation | react-pdf / pdf-lib / headless Chromium | Invoices, quotes, reports. |
| Push/notifications | Web Push (PWA) + existing Twilio SMS (oj-sms-system owns SMS sending) | One SMS sender rule stays. |

## 4. System architecture

### 4.1 Stack (keep what works)
- App: Next.js (current 16.x), TypeScript, same repo `OJ-Holdings/oj-workspace`, same Supabase project.
- Database: Supabase Postgres. All money in integer cents (bigint). Every table has `organization_id` and RLS through `oj_private.member_role`.
- Hosting: the always-on Windows PC behind Tailscale Funnel, CI-gated 5-minute auto-deploy (already running). Netlify is out (credits exhausted).
- Realtime: Supabase Realtime for the live operations board and crew status.
- Background work: a small worker process (Node) on the PC for scheduled jobs (automations, bank sync, reminders, OCR, reports). Windows scheduled task supervises it.
- Services on the PC via Docker: OSRM + VROOM (routing), optional Tesseract/OCR worker, optional Metabase. Each isolated, each optional.
- Phone: installable PWA (home-screen icon, push notifications, camera, offline queue via IndexedDB, background sync).
- Isolation: OJ OS never imports Oscar's private STRATHOS dashboard. Keep that wall. A one-way read-only "pulse" feed already exists; keep it narrow.

### 4.2 The data spine (core entities)

```
Organization (OJ Holdings LLC)
  Entity (Exterior Care | Solutions | Essentials | Studio | Holdings)     <- books are per entity
  Person (contact)  <-  Customer (a person or company; one record across entities)
     Property / Site (address, geo, notes, access info, photos, sq ft estimates)
  Lead -> Quote(version) -> Job -> Visit(s) -> Invoice -> Payment
  Job
     scope lines, price, discount, tax, materials used, labor entries, expenses, photos, checklist,
     crew assignments, commission, notes, events (append-only timeline), documents, review request
  Recurring Plan (annual wash, monthly windows) -> generates Jobs on a schedule
  Ledger: Account (chart of accounts), Journal Entry (balanced, immutable once posted), Entry Line
  Bank: Account link, Transaction (raw), Match (transaction <-> ledger entry/invoice/expense)
  Expense (receipt image, vendor, category, job link, entity, who paid)
  Time Entry (person, job, start/stop, source, approved)
  Crew/Employee, Equipment, Vehicle, Supply item + stock, Vendor
  Campaign, Source/Channel, Territory/Door-knock session, Review
  Automation Rule, Run (receipt), Approval
  Document (contract, insurance, license) with expiry
  Audit Log (who/what/when for every write that matters)
```

Rules: job and ledger writes go through database functions (RPCs) that enforce invariants (balanced journals,
no edits to posted entries, reversal only, idempotency keys). The UI never writes the ledger directly.
Everything user-visible that matters has an append-only event row.

### 4.3 Security and roles
- Roles: owner, manager, member, crew (employee portal), accountant (read-only books, time-boxed), viewer.
- Crew see only assigned jobs and their own earnings. Accountant sees books, not CRM notes.
- Secrets only in server env, never in the DB or browser. Owner-only connections page.
- Backups: the existing encrypted Supabase backup + Storage backup scripts become a scheduled task with verified restore drills (exists, make it routine). Off-PC copy is a must (see risks).
- Audit log viewable by owners. 2FA for owners (Supabase supports TOTP).

### 4.4 AI layer: a provider-agnostic gateway, free first (Oscar approved AI read/write and full admin control)

One internal "AI gateway" module; every AI feature calls it, never a vendor SDK directly. It routes by task, tries free options first, and falls back.

| Tier | Provider | Use for | Notes (from search, unverified; free tiers change without notice) |
|---|---|---|---|
| Local | Ollama on the PC (already installed; NVIDIA GPU present) with a small open model | private data: receipt OCR text cleanup, categorization, customer notes summaries, embeddings/search | zero cost, zero data leaving the PC; limited by PC load (do not starve the app) |
| Free cloud | Google Gemini API free tier (Flash class), Groq free (~30 req/min, ~1K req/day on one model), OpenRouter ":free" models (~20 rpm, ~50/day), Cloudflare Workers AI (10,000 Neurons/day), Mistral/NVIDIA/Cohere/SambaNova free tiers | drafting messages, the weekly brief, assistant Q&A, extraction | quotas are small and models get withdrawn; the gateway rotates and caches; check each provider's terms for data use (free tiers may train on prompts - never send sensitive PII there) |
| Paid fallback | Claude / OpenAI APIs | hard reasoning, high-stakes drafting, when free tiers are exhausted | only if budget allows; per-feature monthly cap |

Rules:
- Data classes: **public/business** (OK for any provider), **customer PII** (local or paid-with-no-training only), **financial/bank** (local only by default). The gateway enforces this by data class, not by developer memory.
- Structured outputs only for actions (JSON schema); the app validates before anything is written.
- Everything the AI reads/writes is logged: prompt summary, model, inputs referenced, output, who approved.
- Caching and rate limiting built in; per-provider health checks; automatic fallback.
- **Autonomy levels (Oscar chose broad admin control):** Level 1 read/analyze anything; Level 2 draft anything; Level 3 write low-risk data directly (notes, tags, task creation, categorizing receipts, scheduling suggestions accepted by rule); Level 4 outbound messages and money movement require a confirmation tap by default (can be relaxed per rule later by an owner); Level 5 destructive/ledger-altering actions never run autonomously (reversal entries only, owner confirm). Owners can raise or lower each level in Settings; a global kill switch pauses all AI writes.
- Voice: push-to-talk in the command bar (browser speech recognition free; optional local Whisper) so Oscar can say "log 40 dollars of chemicals on the Patrick job" from the truck.

## 5. The shell: layout and feel (replaces the 17-item sidebar)

### 5.1 Structure
1. **Entity switcher (top-left):** Holdings | Exterior Care | Solutions | Essentials | Studio. Switching re-themes (each business keeps its logo/colors) and scopes every screen. Holdings = consolidated view.
2. **Command bar (Ctrl K) is the main way around.** Jump anywhere, search anything (customers, jobs, invoices, files, tasks), and do things: "new job for Fay", "log $84 chemicals on Patrick", "complete job", "invoice Debbie", "what's my cash". Typed natural language with confirmation.
3. **Dock (thin left rail, icons + tooltips, 8 rooms):** Command, Jobs, Customers, Schedule, Crew, Money, Growth, Insight. Settings/Files/Messages in a utility menu.
4. **Live strip (top center):** timer, cash today, jobs in progress, alerts count. Always visible.
5. **Phone:** bottom tab bar (Today, Jobs, Capture, Money, More) and a big + for quick entry (job, expense, photo, time).

### 5.2 Command (home) - the live operations board
The thing that makes it feel like a company, not a spreadsheet.
- **Timeline of today:** every job as a block by crew lane (not started, driving, on site, finishing, done). Drag to reschedule.
- **Map:** Kenosha area, today's stops, routes, crew pins (job-status based first; GPS later if crews opt in).
- **Money pulse:** today's revenue booked/collected, expenses, unpaid invoices, cash position (Mercury), runway.
- **Exceptions only:** late crew, job with no price, unassigned job tomorrow, overdue invoice, weather risk, quote waiting 3+ days, equipment due. Each with a one-tap fix.
- **Next up:** the next 3 jobs with address, scope, price, call, directions.
- **Pipeline snapshot:** new leads, quotes out, booked this week.
- **Company ticker:** revenue MTD vs goal, jobs done, average job value, close rate. Numbers roll on change.
- Layouts customizable per person (Oscar = money-heavy, Jacob = growth-heavy), saved.

### 5.3 Design language
- Keep the dark navy base with per-business accents already built (Exterior orange/green, Solutions copper, Essentials cream/serif). One design token system, no ad hoc colors.
- Density modes: Comfortable (default) and Compact (power users). Tabular numerals everywhere. Motion only where it explains change (rolling numbers, card glide); respects reduced motion.
- Copy rules: task-first headings, no explainer paragraphs on working screens, tooltips for definitions, plain language ("Money in", not "source-qualified recorded inflow").
- Empty states are actions ("No jobs today - book one").
- Accessibility floor: keyboard everywhere, focus rings, contrast 4.5:1, phone 44px targets.

## 6. The rooms and modules, in depth

### 6.1 Jobs (the spine)
Pipeline board and list: Lead - Quoted - Booked - In progress - Done - Invoiced - Paid (and Lost/Cancelled with reason).
**Job drawer (one place for everything about a job):**
- Header: customer, property, service(s), status, crew, date/time window, price, margin so far.
- Scope and price: price-book lines (services with unit pricing: per sq ft, per window, per linear ft, flat), add-ons, discounts, tax (see 8.6), deposits.
- Costs: materials (from supplies, auto-deduct inventory), labor (time entries x rate, or commission), other expenses (receipt photos), vehicle/fuel allocation.
- Live margin: price - costs, shown on the job and rolled to reports.
- Field: checklist, before/after photos (required by template), notes, customer signature, weather snapshot at time of job.
- Timeline: every event (created, quoted, booked, assigned, started, finished, invoiced, paid, reviewed), who and when.
- Actions: Start, Pause, Complete, Reschedule, Reassign, Duplicate, Create recurring plan, Send invoice, Request review, Rebook.
- **Complete = one tap** (with required fields enforced by template). Completion posts revenue, creates the invoice, queues the review request and rebooking reminder, notifies the customer (rule-driven, see 6.9).
- Quick entry from anywhere: "Fay house wash $200 Tue 2pm" creates a job.
Backfill: the 72 completed jobs, their revenue/cost where recorded, flagged "needs cost" as tasks (not warnings).

### 6.2 Customers (one record, all companies)
- Person or company. Multiple properties. Contacts, preferred channel, notes, tags, source, referral chain.
- Timeline of every touch: calls, texts, quotes, jobs, invoices, payments, reviews.
- Value: lifetime revenue, jobs, margin, average ticket, last service, next due, churn risk.
- Segments (saved filters): "house wash >11 months ago", "commercial", "unpaid", "top 20".
- Merge duplicates tool (existing dedupe code: reuse), import from sheets, website intake inbox with spam filter and one-tap convert-to-lead/delete.
- Commercial accounts: company, logo, contacts, many properties, service frequency, contract terms, per-property jobs and billing. (Replaces the Commercial Desk sprawl.)
- Cross-entity: a customer who bought from Essentials and hired Exterior is one person.
- Retires: Company CRM, Customer 360 diagnostics, duplicate lead lists.

### 6.3 Schedule and Dispatch
- Calendar (day/week/month) + crew lanes + map view. Drag to move/assign. Conflict detection (crew double-booked, travel time impossible).
- **Smart routing:** OSRM + VROOM sequence the day's stops, honor time windows and crew skills, show drive time and fuel estimate, "optimize" button with before/after savings.
- **Weather-aware:** NWS forecast per job day; flags rain/wind/freezing; one-tap "propose reschedule" to affected customers (message drafted, you approve).
- Capacity view: hours booked vs crew hours available by week; suggests how many more jobs fit.
- Recurring plans generate future jobs; seasonal plans (spring wash, fall windows).
- Public booking page (our own widget): customer picks service + time from real capacity, lands as a lead/booked job with deposit option.
- Calendar feeds to phones (iCal link; already partly built), Google Calendar sync (two-way later).

### 6.4 Crew
- Employee portal (exists: employee identity separate from membership). Expand to a phone-first "My day": jobs in order, directions, checklist, clock in/out per job, photos, notes, mark done, see today's earnings.
- Time clock: per-job entries, breaks, GPS stamp (opt-in), edits need approval, overtime alerts.
- Commissions and pay: per-job commission rates (no defaults, owner sets), approval queue, payout ledger, adjustments with reasons, export for payroll (Gusto etc.). Employee sees an explanation of each earning.
- Roster: skills, availability, certifications, onboarding checklist, documents (W-4/I-9 storage is sensitive; store only if we can secure properly, else link out).
- Performance: jobs/day, revenue per labor hour, callbacks, reviews, on-time rate. Fair, transparent, visible to the employee.
- Safety/incident log, equipment sign-out.

**Crew additions from Oscar's answers**
- **Commission engine:** Oscar's decision: **flat 20% of job revenue for crew once a company truck exists** (the 20-25% range today existed because crew drove personal vehicles). The engine is still a rule table (rate by person/role/service, optional travel tier and per-job overrides) so it can change without code, but the default rule is one rule: 20%. Owners confirm each rate; no hidden defaults. Per-job: who drove, miles from base (from routing), crew member, rate applied, amount, status. Employee sees the math. Disputes and adjustments are ledger-style (reason required).
- **GPS tracking (ON):** crew location shared only while clocked in or driving to a job (shift-bound), shown on the live map and used for arrival detection (auto "on site" and "done driving"), mileage, and "how far is the crew" ETAs for customers. Rules: written notice and consent at onboarding (we should confirm exact Wisconsin employee-monitoring notice requirements with a lawyer/CPA; this is not legal advice), location is never tracked off-shift, history retention limited (for example 90 days of breadcrumbs, then only job arrival/departure stamps), owners see an access log of who viewed location. Implementation: all crew use iPhones, and iOS web apps cannot reliably track location in the background. Decision (budget-aware, Oscar's $0 rule): build the crew app as a PWA first for jobs, photos, checklists and clock-in, with GPS captured while the app is open on screen (job mode keeps the screen awake, and arrival/departure are stamped at clock-in/out); when budget allows, wrap it in a thin native shell (for example Capacitor with a background-geolocation plugin, distributed via TestFlight or the App Store; an Apple developer account is about $99 per year) in Phase 3 so shift-bound GPS and arrival detection work with the phone locked. Until then, a "job mode" that keeps the screen awake is the fallback.
- **Hiring and onboarding (next season):** applicant tracker (simple pipeline: applied, screened, trial day, hired), offer text templates, onboarding checklist (W-4/I-9 handled outside the app unless secured; training videos; equipment sign-out; safety acknowledgement), trial-day scorecard, reliability metrics (on-time clock-ins, completed checklists, photo compliance, customer ratings) presented as coaching, not surveillance, and visible to the employee.
- **"Run it without Oscar" kit:** per-service playbooks (checklist, chemical ratios, photos required, customer script, upsell prompts, what to do if something goes wrong), phone-first, so a new hire can deliver a consistent job. This directly attacks the founder bottleneck.
- **Truck and rig planning:** a capital planner that models buying a work truck/trailer rig (price, financing, insurance, fuel, maintenance) against jobs/month and margin, using real job data, so the decision "buy a rig and hire a crew lead" is made with numbers. Includes an equipment reliability log (failures, repair cost, downtime) and a spares/pre-departure checklist so failures stop being a surprise.

### 6.5 Growth (Marketing, Sales, Outreach)
- **Google Local Services Ads command (LSA is the #1 source, and huge for commercial window cleaning):**
  - Lead inbox for LSA leads (calls, messages, booking requests) with a **speed-to-lead timer** (alert if a lead is unanswered for N minutes; first response time strongly affects conversion) and one-tap call/text-back.
  - Per-lead cost (pay-per-lead), cost per booked job, cost per dollar of revenue, ROAS by service and by residential vs commercial, weekly spend vs budget, budget pacing.
  - **Lead dispute/credit tracker:** LSA charged leads can be disputed within about 30 days (per Google help pages found in research; Google is also moving toward automatic credits, so check how your own account behaves). OJ OS flags leads that look invalid (wrong service, out of area, spam, duplicate) and keeps a dispute deadline list so credits are never missed. Disputes are filed in Google's UI unless the API exposes it (the Google Ads API LocalServicesLead resource was NOT confirmed in research; verify before promising automation).
  - Connection options: Google Ads API (developer token and approval needed), or CSV/email export parsing as the free fallback. Google Business Profile API for reviews/profile insights (access rules apply).
  - Commercial window cleaning funnel view: LSA lead -> site visit/walkthrough -> proposal -> e-signed -> recurring plan -> invoices (ACH) -> renewal.
- **Lead sources:** every lead tagged to a channel (LSA, website, referral, Google Business Profile, door knock, Facebook/Nextdoor, repeat, other). Required field, no blanks; QR codes and tracked phone numbers/links per channel. The 133 historic DTD tags stay as history; recent leads get re-tagged in the Phase 1 cleanup.
- **Door-knocking:** sessions, territories on the map, heat map of money per door (exists in data; make it live), route planner for knocking days, do-not-knock list.
- **Quote follow-up cadence:** automatic reminders and texts (approved) at 2/5/10 days; "stale quote" board.
- **Review engine:** after paid job, request review (Google link), track rating, reply queue with drafted replies.
- **Campaigns:** SMS/email to segments (spring rebook, win-back, referral ask). Sending uses the existing single SMS owner (oj-sms-system/Twilio) and an email sender (see 7.4); all outbound needs approval rules + unsubscribe handling + quiet hours.
- **Referral program:** tracked codes, credits ledger, auto-thank-you.
- **Local SEO:** per-city landing pages and Google Business Profile checklist (content generated, human approved).
- **Solutions outreach (existing):** Daily 10 game, prospect list, email engine, results. Keep; it already works.
- **Attribution:** cost per lead and per booked job by channel; ad spend entered or imported (Meta/Google CSV).

### 6.6 Money (see section 7: Finance and accounting in depth)

### 6.7 Insight (Analytics, Forecasting, Assistant)
- **Built-in dashboards** (all drill to the underlying jobs/entries): revenue, margin, cash, AR aging, close rate, lead-to-booked time, revenue per labor hour, average job value, service mix, seasonality, customer lifetime value, repeat rate, cohort retention, crew productivity, route efficiency, channel ROI.
- **Targets:** monthly/seasonal revenue and margin goals with pacing ("you are $1,200 behind pace; 4 jobs would close the gap").
- **Forecast:** seasonality-aware revenue and cash forecast from booked jobs + pipeline x close rate + recurring plans. Scenario sliders (price +5%, add a crew, ad spend) - the old Scenario Lab, but fed by real numbers.
- **Pricing intelligence:** actual cost per sq ft by service from past jobs; "you are underpricing driveway cleaning by 18%".
- **Assistant (ask anything):** natural-language questions answered from the database with the SQL/inputs shown (no guessing): "margin on house washes this season?", "who owes us money?", "which neighborhoods pay best?". Read-only by default; actions go through the command bar with confirmation.
- **Weekly founder brief:** auto-generated Monday summary (what happened, what is stuck, what to do), delivered in-app and by email/SMS.
- Optional: Metabase on a read-only replica for ad hoc exploration.

### 6.8 Entity rooms (Exterior, Solutions, Essentials, Studio)
Each is a *view* of the same spine, scoped, with its own extras - not a separate app.
- **Exterior Care:** everything above, plus fleet/rig lab, equipment hours, chemical usage per sq ft, door-knocking, commercial accounts, estimate calculator, field reports.
- **Solutions (AI receptionists):** clients as accounts with MRR, setup fees, monthly fees, churn, onboarding checklist, call volume and minutes from GoHighLevel, outreach pipeline, demo bookings, margin per client (our cost to serve vs fee). Revenue posts to the Solutions books.
- **Essentials (Shopify):** orders, revenue, refunds, COGS and gross margin per SKU, inventory and reorder points, supplier list, payout reconciliation (Shopify payouts vs bank), product pipeline (research tasks).
- **Studio (Oscar Jacob content):** production pipeline, publishing calendar, sponsorship deals and revenue, asset library. Keep small; it earns its place only if used.

### 6.9 Automation engine (rules with receipts)
Native rules: trigger -> conditions -> actions, with a run log, dry-run, pause switch, rate limits, and approval for anything outbound or money-touching.
Starter library (turn on with one click):
- Job completed -> create invoice -> send payment link -> request review after 2 days -> schedule rebook reminder in N months.
- Quote sent and no reply in 3/7 days -> draft follow-up for approval.
- Invoice overdue 7/14/30 days -> nudge, then escalate to a task.
- New website intake -> spam check -> create lead -> text acknowledgement -> assign follow-up -> notify.
- Booking tomorrow -> reminder to customer and crew, weather check.
- Job has no cost 3 days after completion -> task to the assigned person.
- Equipment hours threshold -> maintenance task + block scheduling if critical.
- Large expense or odd transaction -> flag for review.
- Supplies below reorder point -> add to shopping list.
- Weekly: founder brief, backup verification, data-quality report.
Engine design: event table + worker; idempotent actions; every action records inputs/outputs; failures retry with backoff and alert; kill switch per rule and global.

### 6.10 Documents, contracts, compliance
- Files tied to customer/job/entity/vendor; tags; full-text search (OCR).
- Quotes and contracts as PDFs with e-sign (typed/drawn signature, IP/time, document hash, audit certificate).
- Compliance calendar: insurance expiry, business license, equipment registration, annual LLC filing, quarterly estimated taxes, sales tax filing, 1099 deadlines, vehicle inspections. Reminders and checklists.
- Retention policy and export.

### 6.11 Fleet, equipment, supplies
- Assets: pressure washers, vehicles, trailers, ladders, hoses. Serial, purchase price (feeds depreciation), service ledger, hour meters, checklists (pre-departure), who has what.
- Maintenance by hours/miles/date with alerts. Cost per hour of operation feeds job costing.
- Supplies: chemicals (SH, surfactants), fuel, consumables; stock levels, usage per job (estimated by sq ft), reorder points, vendor price history.
- Replaces the browser-local Fleet Command with shared persistent data.

### 6.12 Customer portal
- Magic-link page per customer: see upcoming/past jobs and before/after photos, approve quotes, pay invoices, request service or rebook, update contact info, refer a friend.
- No passwords for customers; link expires; limited to their own data.

### 6.13 Admin
People & access (exists), connections (owner-only, status and last sync), data quality center (see 9), audit log viewer, backups/restore status, release/health (one small page, not a top-level feature), feature flags.

### 6.14 Live presence and the founder chat bubble
- **Who is online and what they are doing:** a presence strip shows Oscar and Jacob (and crew when clocked in) as avatars with state: online, in a job, clocked in on "Patrick house wash", working on task "Outreach automation", in a call, away. Built on realtime presence (Supabase Realtime). Presence ties to the work timer and the job/task they have open, so "Jacob is editing Estimate #12 right now" is visible and we avoid double-editing (soft locks with "Jacob is here" cursors on shared records).
- **Chat bubble (the pop-up):** a floating bubble bottom-right on every screen. Click to expand a compact chat between the founders (and later crew/room-per-job). Features: instant messages, typing indicator, unread badge, @mention a customer/job/invoice (renders as a live card), paste a screenshot, voice note, "send to task" (turn a message into a task), threads attached to a job so conversation history stays with the record, and a quick **huddle** button that starts a free WebRTC call (Jitsi or LiveKit open source, self-hostable) when you both need to talk. Notifications: in-app, push (PWA), optional SMS for urgent only. Everything is stored (Supabase) and searchable; the AI can summarize "what did we decide about the Marquette job".
- **Presence privacy:** shown only inside the workspace to members; crew see their own job rooms only.

### 6.15 The omniscience layer (creative ideas that make OJ OS feel like it knows everything)
Ranked roughly by wow per effort; all are built on the single data spine, so they are cheap once the spine exists.
1. **Everything timeline ("Pulse"):** one live feed of every event across the company (lead came in, quote viewed, job started, payment landed, review posted, crew arrived, bank transaction, automation ran, a teammate opened a record). Filter by customer, job, person, money. It is also the company's memory.
2. **Ask OJ anything (text or voice):** answers from the database with the query shown. "Who has not been serviced in 11 months?" "Which crew member is most profitable?" "What did LSA cost us per booked job this month?" Can also act (with the confirmation rules in 4.4): "text everyone booked tomorrow a reminder."
3. **Mission-control wall mode:** a full-screen TV/second-monitor view (live jobs map, cash today, LSA leads waiting, crew pins, next job, weather) for the garage/office. Ambient, glanceable, big numbers.
4. **Instant quote from an address:** type an address, OJ OS pulls the satellite image and building footprint (open footprint data / OSM), estimates exterior area and window count, and proposes a price range from your own historical price-per-square-foot and margin targets. Always labeled estimate; a human confirms. Also lets an LSA lead be answered with a ballpark in seconds.
5. **Property memory:** every property remembers gate codes, water source location, pets, soil/roof/siding type, chemicals that worked, before/after photos, customer preferences, previous quotes. Any crew member opening the job sees it. This is the thing that makes service feel personal at scale.
6. **Smart next best action:** a ranked "do this next" list for each person (call this lead now, invoice that job, ask this customer for a review, rebook these 12 spring customers, reorder this chemical).
7. **Cash-flow oracle:** forecast cash 13 weeks out from booked jobs, invoices due, bills, payroll, tax set-aside; answers "can we afford a truck down payment in March?" and shows the decision on a timeline.
8. **Anomaly radar:** flags weirdness (a job priced 40% under normal, expense spike, duplicate customer, bank transaction with no job, crew drove 30 miles off route, lead response slowing down).
9. **Rebooking radar:** per customer predicted next-service date and probability, automatically queued as campaigns each season.
10. **Weather/season engine:** NWS forecast drives scheduling suggestions; season mode (see 11b) changes the whole dashboard's emphasis (in-season Exterior vs off-season Solutions/Content).
11. **Daily brief and weekly review:** a short written brief each morning and a Monday review, in text and optionally voice, generated by the AI gateway from real numbers.
12. **Digital twin of the company (later):** a simple graph view (customers - properties - jobs - crews - money) you can fly through; fun, and genuinely useful for spotting concentration risk (for example 30% of revenue from one commercial client).
13. **Gamified goals (extends Daily 10):** shared team goals, streaks, season scoreboard, crew leaderboards that reward quality (photos, on-time, reviews), not just speed.
14. **Review wall and brand moments:** pipe 5-star reviews and best before/after photos to a public gallery on the website and to content ideas for the Oscar Jacob channel (content flywheel: real jobs become videos).
15. **Hands-free job mode (crew phone):** huge buttons, voice commands ("start job", "add photo", "finished"), auto-navigation, auto-timestamps; reduces mistakes.

### 6.16 The premium customer experience
Goal: customers feel like they hired a much bigger, more expensive company.
**Before the job**
- Instant, branded response to every inquiry (text + email within a minute, even at night, drafted by AI, signed by a human name; speed matters for LSA).
- A clean quote page: scope, price, before/after examples of similar jobs, one-tap approve/e-sign, deposit option, financing option later.
- Online booking from real capacity, with calendar invite and a confirmation that includes the crew member's name and photo.
**Day of the job**
- "On my way" text with a live ETA link (Uber-style, using crew GPS, shown only while en route) and an "arrived" notice.
- Property-aware crew (gate code, pets, water spigot) so the customer never repeats themselves.
- Photos taken at start and finish automatically assembled into a before/after story.
**After the job**
- Branded invoice and payment page: card, Apple Pay/Google Pay, ACH bank transfer, pay by link in the text; receipts instantly.
- Completion report: photos, what was done, products used, aftercare tips (for example "do not pressure wash the deck for 6 months"), and the next recommended service date.
- Thank-you from the person who did the work; review request after 24 to 48 hours; referral reward link.
- Annual care plan offer ("same crew, same time next spring, 10% loyalty price") and automatic reminders.
**Customer portal** (see 6.12): service history, photos, upcoming visits, pay, request service, refer a friend, download receipts.
**Commercial clients (window cleaning contracts, LSA-sourced)**
- Proposal with building/window counts per property, frequency, per-pane or flat pricing, insurance certificate (COI) download, W-9, service agreement e-sign.
- Recurring service calendar with auto-generated visits, service reports with photos per visit, monthly statement with net terms, ACH autopay option, renewal reminders and a quarterly review summary.
- Contact roles (billing vs on-site), multiple properties per company, a single invoice or per-property invoices, PO number support.
**Brand details that make it feel premium:** consistent branded emails and texts, fast pages, no jargon, your logo and colors, custom domain for the customer portal and payment pages, a human tone, handwritten-style thank-you card option (print-and-mail API later).

### 6.17 Truck Fund and the rig plan (goal: $20,000, ready before the 2027 season)
A first-class goal widget on Command and in Money, because the single biggest pain (founder as bottleneck, rig failures) is solved by this purchase.
- **Goal tracker:** target $20,000, deadline (assume April 1, 2027; editable), current balance (from the Mercury `OJ EC TRUCK FUND` account via the feed, or manual entry until the feed exists), required weekly/monthly deposit to hit the date, pace indicator (ahead/behind), projected completion date at the current rate, and a "what would close the gap" panel (for example "3 average commercial jobs" or "a win on ND Cleaning MKE covers it"). Every incoming payment shows how much it moved the goal.
- **Rig budget (editable template, numbers are placeholders until priced):** truck or van purchase (the biggest line); water tank and pump or direct hookup; pressure washer (repair or replace the ALH4240 / Simpson); hose reels and skid mounting; chemical storage/injection; water-fed pole system (Xero Pure and Xero Pro owned) and extra poles; ladder racks and ladders; optional lift/high-reach access later; exhaust-safe installation and CO alarm; insurance and registration; lettering/wrap (brand, trust, LSA conversion); tools, spare parts, fittings and a spares kit; first-year maintenance reserve. Each line has a quoted price, a vendor link, status (researching, quoted, bought), and rolls up to the $20,000 target.
- **Deal hunter board:** a simple list of candidate trucks (link, price, mileage, condition notes, inspection checklist, distance, score) so "settle for a great deal" is a comparison, not a memory. Score weights: price, mileage, bed/cargo fit, reliability record, towing/payload, inspection result.
- **Decision support (uses real data):** payback model (jobs per month the truck enables beyond today's capacity x average margin), "financing vs cash" comparison only if cash falls short (Oscar's rule: no financing unless feasible), and the effect on the commission/crew plan (a company truck lets crew run jobs without personal vehicles, which is why commission can be a flat 20%).
- **Repair-or-replace tracker for the current washer:** repair quote, rental cost per day while down, total rental spend so far; shows whether repairing the main washer beats continued rental and feeds the rig budget.
- Linked to the allocation engine (7.9): the Truck Fund bucket is the funding source; when the fund hits target, the rule redirects to the next goal automatically (Oscar decides where).

## 7. Finance and accounting in depth (the crown jewel)

### 7.1 Ledger design
- Double-entry from day one. **OJ Holdings LLC is a single legal entity**, so there is ONE set of books. Divisions (Exterior Care, Solutions, Essentials, Studio, Holdings/shared) are a required "class/division" dimension on every journal line, giving management P&Ls per division and the consolidated company P&L from the same data. Shared costs (insurance, software, the truck) are allocated to divisions by rule. No intercompany eliminations in V1. (If the structure ever changes, the division dimension can become real entities.)
- Chart of accounts template for a small service business + e-commerce + services company; editable by an accountant. Account types: asset, liability, equity, income, COGS, expense, other.
- Journal entries: balanced (debits = credits) enforced by DB constraint/trigger; immutable once posted; corrections by reversal + new entry; each with source reference (job, invoice, payment, bank txn, payout) and who/when.
- Cash vs accrual: keep accrual books; show cash-basis reports too. Default tax view: cash (confirm with CPA).
- Period close: monthly close checklist, lock periods, adjusting entries, accountant sign-off.
- Money = bigint cents; currency USD only for V1.
- **Partnership accounting (Oscar believes OJ Holdings is taxed as a partnership; CPA to confirm):** equity is tracked per partner: capital contributions, **draws** (each partner, equal by default, with an "agreed split" record when one partner worked more, stored as a draw agreement with date and ratio), and share of profit (K-1 style summary for the CPA). Draws are posted from the Owner Distribution accounts. No payroll for partners (guaranteed payments, if any, are a CPA decision).

### 7.2 Flows that post automatically
- Job completed + invoiced: Dr Accounts Receivable, Cr Service Revenue (+ Cr Sales Tax Payable if taxable).
- Payment received: Dr Cash/Undeposited, Cr AR. Card/processor fees posted from processor reports.
- Expense (receipt): Dr Expense/COGS (by category), Cr Cash/Card/Owner Contribution.
- Crew pay: commissions and wages as labor expense; payouts clear payable.
- Inventory purchase and usage: asset to COGS on job use.
- Owner draw/contribution, transfers between entities.
- Shopify orders/payouts/fees; GHL subscriptions (Solutions MRR) as deferred revenue/revenue.
- Depreciation for equipment/vehicles (straight-line schedule; tax-depreciation is CPA's call).

### 7.3 Bank and card connectivity
- **Mercury** (already planned, read-only): API token with Read Only role; HMAC-signed webhooks for new transactions (webhook payloads thinly documented; verify live). Rate limits unpublished; backfill carefully.
- Other banks/cards: aggregators (Plaid, Teller) vary in cost and coverage; prices in search were conflicting and unverified. Get current quotes before committing; fallback is CSV/OFX import with smart matching.
- **Reconciliation workspace:** unmatched transactions on the left, suggested matches on the right (rules + learned vendor patterns), one-tap accept, split transactions, transfer detection, duplicate detection. Reconciled-to-statement checkpoints per month.

### 7.4 Invoicing and payments
- Invoices, estimates/quotes, deposits, progress billing for commercial, recurring invoices for plans/MRR, credit memos, late fees (optional), statements.
- **Payments: accept everything (card, ACH, checks, cash, Venmo/Zelle noted manually).** Oscar wants OJ OS-native invoices and payment links (branded, on our domain), which is the plan: OJ OS creates the invoice and a payment page; the processor only moves money behind it. We never store card data (hosted fields/links only).
  - **Recommended processor: Stripe** under the OJ OS-branded pages. Search findings (third-party blogs, not Stripe's own page; confirm on stripe.com before budgeting): ACH Direct Debit about 0.8% per transaction capped at $5; cards about 2.9% + 30 cents; Stripe Invoicing about 0.4% per paid invoice if we use their invoicing (we won't need it if we generate our own); failed ACH about $4, ACH dispute about $15; Apple Pay/Google Pay ride on the card rate. On a $5,000 commercial window contract, ACH costs about $5 while a card costs about $145, so commercial clients should be steered to ACH (show "pay by bank, save us the fee" with an optional card surcharge/discount policy decided with a CPA/legal check on surcharge rules).
  - **Alternative worth evaluating: Mercury Invoicing** (built into the bank you already use). Per Mercury help pages found in research: customers can pay by ACH, wire or Mercury transfer free; card payments via a connected Stripe account carry Stripe's normal rate with no Mercury markup; some features (recurring invoices, ACH debit) may require a paid Mercury plan (plan prices conflicted between sources: about $29.90 to $35 per month). Pro: money lands directly in the bank with no payout step. Con: less control over our branded experience and fewer webhooks/automation hooks (needs verification). Decision: build the OJ OS payment layer behind an interface so Stripe first, Mercury Invoicing or others later, without changing screens.
  - Checks: deposit at Mercury Credit Union, then transfer to Mercury (Oscar's current flow). OJ OS records the check against the invoice as "deposit pending", then matches it to the Mercury credit when it lands (two-step reconciliation: check recorded -> deposited at MCU -> transferred to Mercury -> matched). A mobile check-capture photo attaches to the payment.
  - Commercial terms: net 15/30, deposits, progress billing, autopay on file (ACH mandate with proper authorization text), late fees optional, statements, credit memos.
- Receipts and customer emails from our domain. Email delivery needs a real sender (Resend/Postmark/SES or Google Workspace SMTP) with SPF/DKIM; low volume is cheap or free-tier.
- AR aging, dunning rules (automation 6.9), write-offs with reason.

### 7.5 Expenses and receipts
- Phone capture: snap, auto-crop, OCR (Tesseract/OCRmyPDF), field extraction (vendor, date, total, tax, line items) via local model or API, you confirm with one tap; assign to job/entity/category.
- Email-in address (forward receipts) and bank-feed-first workflow (transaction appears, attach receipt later).
- Mileage log (IRS rate table), per-job fuel allocation, per diem if ever needed.
- Vendor list, 1099 tracking (annual threshold watch, W-9 on file), recurring bills (software, insurance, truck payments).

### 7.6 Taxes (planning aids, not tax advice)
- **Sales tax:** Wisconsin treatment of exterior pressure washing is UNRESOLVED in our research. Sources conflict: some say specialized cleaning of tangible personal property is taxable and list pressure washing; others suggest cleaning real property (building exteriors) may be exempt while vehicles/equipment cleaning is taxable. Must be confirmed with a CPA / WI Department of Revenue (Publication 201, Wis. Stat. 77.52) before we ship tax logic. Build tax as per-service configurable, default OFF until confirmed. Essentials (Shopify) has its own nexus/tax rules - confirm.
- Estimated-tax set-aside: dashboard "safe to spend" = cash - taxes owed estimate - upcoming bills. Percentage configurable by CPA guidance.
- Year-end: P&L by entity, 1099 list, depreciation, mileage summary, accountant export package (CSV + PDF + trial balance).
- LLC/entity structure: confirm with CPA how OJ Holdings LLC, the divisions, and Jacob/Oscar's ownership are reported (single entity with divisions vs subsidiaries) - this decides whether "entities" are real legal entities or classes.

### 7.7 Reports and cash intelligence
- P&L, balance sheet, cash flow statement, trial balance, general ledger, AR/AP aging, sales tax summary, job profitability, entity vs consolidated, budget vs actual, month-over-month, year-over-year.
- Cash: 13-week cash forecast from booked jobs, invoices due, bills due, payroll, recurring costs; runway; "safe to spend" number on the home screen.
- Budgets by entity/category; alerts on overspend.
- Everything drills to the transaction and the receipt.

### 7.8 Bookkeeping from zero (nothing exists today; no CPA yet)
- **Catch-up wizard:** (1) set the books start date (recommended: Jan 1 of the tax year, or the first Mercury transaction), (2) import all Mercury history via API/CSV, (3) import checks/deposits from Mercury Credit Union (statement CSV/PDF), (4) auto-suggest categories from vendor rules and the AI gateway, you confirm, (5) link transactions to jobs (revenue) and expenses, (6) enter opening balances, (7) reconcile month by month, (8) self-review checklist with plain-language prompts ("does this match your bank balance?").
- Simple default chart of accounts so founders are not asked accounting questions; an "accountant mode" exposes everything.
- **CPA package (later):** one click exports the trial balance, GL, P&L, balance sheet, 1099 list, depreciation schedule, sales tax summary, mileage log, and receipts as a zip so a CPA can review fast and cheaply. Also a "questions for my CPA" list that OJ OS builds from flagged items (uncertain categories, owner draws, taxable status).
- Self-review guardrails: reconciliation required before month lock; unmatched/uncategorized counts visible; an "I am unsure" flag per entry feeds the CPA question list.

### 7.9 Money allocation: the "split" Oscar does today
Oscar sends deposits to Mercury "to be split across" accounts (the structure is documented in 1d: Clearing, Operations, Tax Reserve, Truck Fund, Owner Distributions for Exterior, and a 30/70 tax/reinvestment rule for Essentials). Today everything is flowing to the truck fund. Build an **allocation engine**: rules like Profit-First style percentages (for example operating, tax set-aside, owner pay Oscar/Jacob, equipment/truck fund, marketing/LSA budget). OJ OS computes, for each incoming payment or weekly, how much each bucket should receive, shows "transfers to make" (and later, with Mercury write scope and IP allowlisting, can propose or execute transfers with confirmation). Includes a **truck fund** bucket tied to the capital planner (6.4) so progress toward a work truck is visible. Mercury write access requires an IP allowlist and owner approval; Phase 2 is read-only plus instructions.

### 7.10 Guardrails (keep the rigor, drop the noise)
- Ledger is append-only; reversals only. Posted period locks. Balanced-entry DB constraint. Idempotency keys on all external events.
- Bank/processor data is evidence; a payment is "collected" only when matched to a bank transaction or processor payout. Until then it shows "pending deposit" - one small badge, not a paragraph.
- Every report has an "as of" timestamp and shows unreconciled counts in the corner.

## 8. Connections (Oscar: "as many as possible")
Principle: every connection is a module behind one interface (auth, sync, health, last-sync, error log, kill switch) listed on an owner-only Connections page. Each syncs into the data spine, never into side tables. "Priority" = when it ships.

**Money and business**
| System | Role | Direction | Priority |
|---|---|---|---|
| Mercury (bank) | balances, transactions, transfers/allocation, invoicing option | read first, write later with approval | P2 |
| Mercury Credit Union | check deposits | CSV/statement import, manual entry | P2 |
| Stripe (recommended) | card, Apple/Google Pay, ACH payment pages, payouts | payments in, webhooks | P2 |
| Square / PayPal / Venmo / Zelle | alternate payments | record manually or via webhook | later |
| Shopify | orders, products, inventory, refunds, payouts, tax | read (exists); inventory/COGS sync | P6 |
| QuickBooks / Xero | CPA handoff | export file (we do not depend on it) | P2 |
| Gusto or similar | payroll | export hours/commissions | P3 |
| Wise/Brex-style cards (future) | company cards | feed in | later |
**Leads and marketing**
| System | Role | Direction | Priority |
|---|---|---|---|
| Google Local Services Ads | leads, spend, disputes | Google Ads API if approved; else email/CSV parser | P4 (high value) |
| Google Business Profile | reviews, profile insights, posts, Q&A | read/reply as API allows | P4 |
| Google Search Console + GA4 | website traffic, queries, conversions | read | P4 |
| Google Ads (search/PMax, if ever run) | spend and conversions | read | later |
| Meta (Facebook/Instagram) | lead forms, ads, messages | read | later |
| Nextdoor / Yelp / Angi / Thumbtack | leads and reviews | email parsing or APIs where allowed | later |
| Website (ojexteriorcare.com / forms) | quote requests | webhook in (exists) | P1 |
| YouTube / TikTok / Instagram analytics | Oscar Jacob content metrics | read | P6 |
| Email sender (Resend, Postmark or Google Workspace SMTP) | invoices, notices, campaigns | send (SPF/DKIM) | P2 |
| Twilio via oj-sms-system | all SMS (single sender) | OJ OS requests, it sends; later migrate | P2 |
| WhatsApp/iMessage-style channels | no | out of scope | - |
**Operations**
| System | Role | Direction | Priority |
|---|---|---|---|
| Google Workspace (Calendar, Gmail, Drive, Contacts) | calendar sync, optional mail logging, docs | OAuth | P3 |
| Apple Calendar (iCal feed) | personal calendar view | feed (exists in part) | P3 |
| Google Maps/Places or OSM/Nominatim | address autocomplete, geocoding | Google has fees; OSM free with limits | P1 |
| OSRM + VROOM (self-hosted) | routing, ETAs, route optimization | local Docker | P3 |
| NWS / Open-Meteo | weather | read, free | P3 |
| Web Push / PWA | notifications to phones | built in | P3 |
| LiveKit / Jitsi (self-hosted) | huddle calls in the chat bubble | optional | P4 |
**Solutions (AI receptionists)**
| System | Role | Direction | Priority |
|---|---|---|---|
| GoHighLevel | clients, calls, pipeline (plan currently down) | read; degrade gracefully while down | P6 |
| Voice AI vendor(s) used for receptionists | call logs/minutes/cost | read | P6 |
| Stripe subscriptions | Solutions MRR billing | payments | P6 |
**AI and tools**
| System | Role | Priority |
|---|---|---|
| AI gateway (4.4): Ollama local, Gemini/Groq/OpenRouter/Cloudflare free tiers, paid fallback | assistant, OCR cleanup, drafting, briefs | P2 onward |
| Tesseract/OCRmyPDF, optional Paperless-ngx | receipt OCR | P2 |
| Activepieces/n8n (optional) | long-tail glue (like a self-hosted Zapier) | P4 |
| Metabase (optional) | ad hoc analytics on a read replica | P5 |
| REA (dev-time only) | derive behavior specs for interoperability (3.2) | as needed |
| Webhooks in/out + public API + API keys | let any future tool talk to OJ OS | P4 |
| Old oj-sms-system | texting, door-knocking, bookings source | keep running; migrate over time |

**Cool/niche software we could connect or imitate (ideas to evaluate, none committed):** Apple Wallet/Google Wallet passes for loyalty or service cards; Cal.com-style booking widgets; CompanyCam-style photo documentation (we build it); Loom-style screen/voice notes in tasks; Obsidian-style linked notes for playbooks; Notion-style SOP wiki inside OJ OS; Typeform-style intake forms; QR yard signs and truck decals with tracked links; Stripe Tap to Pay on iPhone for in-person card payments (crew phone as a card reader, if supported on our devices); Plaid-style account linking for Solutions clients; Twilio Voice or Telnyx for tracked call numbers per channel; PrintOne/Lob for mailed thank-you cards and spring rebook postcards; CarPlay/Android Auto-friendly "next job" view; smart-watch complications for "next stop". Each earns its place only if it attaches to Customer -> Job -> Money.

## 9. Data migration and cleanup (Phase 0 + 1)
- Inventory every table and field now in use (the `OJ_DATA_PERSISTENCE_INVENTORY.md` is a start); decide keep/merge/drop.
- Delete: test/spam intake rows, synthetic Project 360 record, junk messages, duplicate customers (dedupe tool, owner approved), "Alienware", "test" rows. All database deletes proposed as SQL for Oscar to run.
- Backfill: 181 customers and their properties, 72 completed jobs with revenue/cost, 38 bookings, door-knocking sessions, finance entries (2,995/30), Shopify history, Solutions pipeline.
- Unify money: existing `oj_finance_entries` + `job_revenue/job_cost` -> opening balance journal + historical jobs. Where cost is unknown, mark "needs cost" and make it a task for a person who knows.
- Data quality center: counts of customers missing phone/address, jobs missing price/cost/crew, unmatched bank transactions, duplicate candidates, each with a fix button.
- Fix suspect data (e.g., a booking showing "Oct 28, 2025" appears to be a wrong year; verify and correct).

## 10. What we delete or fold in (the cut list)
Delete: 13 roadmap placeholder tools; Tools hub as a destination (search covers it); Company CRM; NEXUS / Company View; Project 360; Corporate Intelligence Desk; Founder Weekly Review (replaced by auto brief); Scenario Lab as a standalone toy (folds into Forecast); Executive Command; Systems Health as a top-level item (move to Admin); Estimate/Field/Intake as separate tabs (fold into Job/Customer); `Hero.tsx`, `TodayWork.tsx`, `ExecutiveCommand.tsx`, `atlas-posting-preflight`, `email-engine-api`, `outreach-import` if still unused; most explainer prose and evidence-gate text; the docs archive (replace with ~6 living docs); 3.6 MB of tracked screenshots; tracked build artifacts; one-shot deploy scripts and the host-loop script.
Fold: Analytics into Insight, Finance into Money, Fleet into Equipment, Commercial into Customers, Door-knocking into Growth.
Keep and promote: Jobs workbench cards, Daily 10, work timer, calendar, files, messages (simplified), employee portal, team/access.

## 11. Roadmap (phases, outcomes, exit criteria)
Sizes: S = days, M = 1-2 weeks, L = 3+ weeks of focused AI-assisted work. Phases overlap; order is by dependency.

**Phase 0 - Clean and re-shell (M).**
Cut list executed behind feature flags; new shell (entity switcher, command bar, dock, live strip, phone tab bar); design tokens consolidated; docs archive collapsed; junk data removed (SQL approved by Oscar).
Exit: 8-room navigation live, Today page under 2 screens tall, no placeholder anywhere.

**Phase 1 - The Job spine (L).**
Customer/Property/Job/Visit model; job drawer; quick entry; completion flow; costs (materials, labor, expenses) entry; backfill; one customer record across entities; Jobs board; Customers room; data quality center v1.
Exit: Oscar can create, price, complete a job, and add its costs in under 60 seconds on a phone; the 72 historical jobs are in the new model; Exterior revenue = Finance revenue.

**Phase 2 - Money core (L). Payments ship first (a commercial window-cleaning job is waiting).**
2a (first, quick win): OJ OS-branded invoices and payment pages with Stripe (card, Apple/Google Pay, ACH), manual check/cash recording, receipts by email, AR list. Usable the moment it ships.
2b: Chart of accounts, journal, posting RPCs, period locks; Mercury feed + reconciliation workspace; Mercury Credit Union check flow; receipt capture + OCR via the AI gateway; expenses and LSA ad-spend capture; bookkeeping catch-up wizard; allocation engine (the "split"); P&L, balance sheet, cash flow, AR aging; one set of books with division tags.
Exit: a month of real activity reconciled to the bank; P&L ties to jobs; the commercial client pays by ACH through an OJ OS invoice; accountant export package opens cleanly.

**Phase 3 - Live operations and crew (L).**
Command board; schedule/dispatch with routing (OSRM/VROOM) and weather; crew phone app (PWA, offline queue, clock-in, photos, checklists); commissions and payout ledger; presence/"team at work" truly working.
GPS tracking (shift-bound, with consent and access log), live presence strip and founder chat bubble, customer "on my way" ETA links, commission engine with driver/travel tiers, hiring pipeline and onboarding checklist, "run it without Oscar" playbooks, equipment failure log and truck/rig capital planner.
Exit: a full real work day run entirely from OJ OS by Oscar and a crew member (GPS, clock-in, photos, commission statement matches expectation); Jacob and Oscar can see each other's presence and chat from the bubble.

**Phase 4 - Growth, portal, automations (L).**
LSA command center (speed-to-lead, cost per booked job, dispute deadlines), required lead sources and attribution; quote follow-ups; instant quote from address; commercial proposal/e-sign/recurring-contract flow; spring rebooking campaign from the 72 completed customers; review engine; campaigns; customer portal; public booking page; e-sign quotes/contracts; rules engine with starter library; referral program.
Exit: a lead can go source -> quote -> e-signed -> booked -> done -> paid -> review -> rebook reminder with no manual re-entry; every automation has a run log.

**Phase 5 - Insight and assistant (M).**
Dashboards, targets, forecasts, pricing intelligence, weekly brief, ask-anything assistant with shown queries, optional Metabase.
Exit: Oscar answers "what's my margin on house washes this season and what should I charge" from the app in under a minute.

**Phase 6 - Entity depth: Solutions, Essentials, Studio, Fleet, Compliance (M-L).**
Solutions MRR/clients; Essentials COGS/inventory/payout recon; fleet/supplies persistent; compliance calendar; documents search.
Exit: Holdings consolidated P&L shows all four businesses from real data.

**OJ OS V1 = Phases 0-6.** Everything after is V1.x (two-way Google sync, Mercury transfer execution with approvals, native mobile wrapper for reliable background GPS, accountant portal, fleet telematics, print-and-mail thank-yous, Apple/Google Wallet passes).

Parallelization: Claude Code and Codex share this repo via AGENT_LOG.md. Suggested lanes: (A) shell + design system, (B) job spine + customers, (C) ledger + banking, (D) crew/PWA/routing, (E) automations + portal. Each lane owns its tables and routes; shared contracts (types, RPC names) reviewed before coding.

## 11b. Season strategy (Oscar is split between Exterior and recurring online revenue)
OJ OS runs in two modes and can show both at once.
- **In-season mode (Exterior focus, roughly Apr-Oct):** Command shows jobs, crews, LSA leads and speed-to-lead, cash today, and equipment readiness. Everything optimizes for throughput and not letting a lead go cold.
- **Off-season mode (Nov-Mar):** Command shifts to recurring revenue and brand: Solutions pipeline/demos/MRR, Oscar Jacob content calendar and analytics, Exterior rebooking campaign for spring, commercial recurring window-cleaning accounts, hiring and truck/rig purchase planning, equipment maintenance and winterization, books clean-up and the CPA package, and pre-season marketing (LSA budget plan, Google Business Profile refresh, website SEO).
- A **season switch** (auto by date, overridable) changes the Home layout, default KPIs, and which automations are most prominent. A "portfolio view" always shows all four divisions side by side with the same three KPIs (revenue, margin, cash), so the question "where should we put time" is answered with numbers, not feelings (Oscar's stated dilemma).
- Winter revenue ideas OJ OS can support (to evaluate, not committed): recurring commercial window cleaning (weather permitting), prepay spring care plans, Essentials seasonal products, Solutions outbound campaigns (Daily 10 already exists), content sponsorship pipeline.

## 12. Quality, testing, operations
- Per phase: typecheck, build, unit tests, database permission tests (member/viewer/crew/outsider/anon), and a real two-device acceptance script run by Oscar and Jacob. The existing CI (typecheck, tests, build, PG17 restore, RLS actor tests) stays.
- Ledger property tests: random journals always balance; reversal restores balances; period locks hold; idempotent replays are no-ops.
- Visual QA at desktop and phone widths on every screen; reduced motion; keyboard.
- Observability: error log table + health page; automation run log; backup verification report weekly.
- Deploy: existing 5-minute CI-gated auto-deploy. DB changes: staged SQL, human-approved, applied before dependent code merges (the deployer already blocks otherwise).
- Rollback: previous release folders kept; feature flags per room.

## 13. Risks and mitigations
| Risk | Mitigation |
|---|---|
| The PC is a single point of failure (power, Windows update, drive) | UPS; auto-restart task (exists); off-PC encrypted backups; plan a $5-10/mo VPS or cloud host as a warm standby; weekly restore drill |
| Free-tier limits (Supabase storage/bandwidth/DB size) | Watch usage; compress photos on device; move cold files to cheaper storage; budget a paid tier if growth demands |
| Scope is enormous | Vertical slices with exit criteria; delete-first; strict module owners; no new module without a user (Oscar/Jacob/crew) and a spine attachment |
| Accounting mistakes | Append-only ledger, balanced constraints, accountant review of chart and first close, parallel-run beside current bookkeeping for one month |
| Tax logic wrong | Tax config defaults off until CPA confirms (WI sales tax unresolved) |
| Payment/PCI exposure | Hosted payment links only; never store card data |
| Outbound messaging spam/legal (TCPA, CAN-SPAM) | Opt-in/out tracking, quiet hours, unsubscribe, physical address in email (already required by email engine), approvals |
| Reverse-engineering legal exposure | Section 3.2 rules; read ToS; behavior specs only; no code copying |
| AGPL/GPL license contamination | Reference only unless license verified; prefer MIT/BSD/Apache; review before any dependency |
| AI features hallucinate numbers | Assistant answers from queries and shows them; no free-text financial claims |
| Crew adoption | Phone-first, 3-tap flows, offline-capable, they see their own earnings |
| Two-agent merge collisions | AGENT_LOG.md protocol, lane ownership, small PRs |
| GPS/location tracking of employees (privacy, consent, background-tracking limits on iOS) | Shift-bound only, written consent, access log, short retention, verify Wisconsin notice rules with a lawyer; PWA background tracking is limited, so plan a keep-awake job mode first and a thin native wrapper if needed |
| Free AI tiers change or train on prompts | Gateway abstraction with fallbacks; data classes keep PII/financials local; no hard dependency on any single free tier |
| Payment fees on cards for large commercial invoices | Steer commercial to ACH; clear policy on card surcharges (check legality/network rules first) |
| Carbon monoxide risk from running a gas pressure washer in/at the back of an enclosed SUV; rig leaking | Short term: exhaust extension pointed away, battery CO alarm in the cabin, service the leak; long term: the truck/rig purchase (6.17) |
| Out-of-state work (Illinois) without insurance/registration | Out-of-state flag on jobs and proposals until cleared; compliance calendar tracks coverage |
| Single inconsistent crew member and founder-as-bottleneck | OJ OS playbooks, hiring pipeline, truck/rig planner; do not build features that assume a full crew yet |
| GoHighLevel plan is down | Solutions views degrade gracefully; keep a manual log; decide whether GHL is worth restoring |
| Data privacy (customer addresses/phones, employee IDs) | RLS, minimal sensitive storage, owner 2FA, audit log, no PII in logs |

## 14. Success metrics (how we know V1 worked)
- Oscar/Jacob open OJ OS instead of Sheets/other tools daily; zero money tracked elsewhere.
- Job entry-to-complete under 60 s on phone; expense capture under 15 s.
- 100% of jobs have price and cost within 3 days of completion.
- Books reconciled monthly within 5 days of month end.
- Cash position, margin by service, and receivables answerable in under 10 s.
- Rebook/review automation produces measurable repeat revenue within a season.
- Paid-tool spend replaced: list monthly subscriptions retired.
- Sidebar items: 8. Placeholder screens: 0. Page height of Today: under two screens.

## 15. Open questions (answered ones removed; remaining decisions)
Answered: see sections 1b to 1e. Still open:
1. **Truck timeline check:** is early April 2027 the real deadline, and is $20,000 firm for truck plus rig plus insurance and lettering?
2. **Washer:** repair quote for the main washer and the rental cost per day so far? (Feeds the repair-or-replace tracker.)
3. **Mercury Clearing rule:** since everything stays on the truck fund for now, should OJ OS record the old 60/25/15 split as inactive history?
4. **Insurance (founders handle it):** when you have it, upload the certificate so OJ OS can track expiry and attach it to commercial proposals.
5. **Illinois:** do you want to do the Waukegan job at all without Illinois coverage, or decline/defer it? (OJ OS will flag out-of-state jobs either way.)
6. **Proposal follow-up:** want an automatic reminder to follow up on ND Cleaning MKE (for example every 3 days for a week)?
7. **Domain:** confirm who holds the DNS login for ojexteriorcare.com so the portal subdomain can be added (details in the "Customer portal subdomain" note below).
8. **Google access:** confirm which Google account is an owner or manager on the Business Profile (needed for the API application).
9. **Email:** which Google Workspace/Gmail address should invoices and notices send from (for example billing@ojexteriorcare.com)?

**Customer portal subdomain (when we get there):** in your DNS provider add one CNAME record, for example `portal` pointing to the OJ OS host name we give you; the app serves the portal on that name over HTTPS (the host runs behind Tailscale Funnel today, so we will decide between a Funnel custom domain and a free proxy like Cloudflare in Phase 4; I will give exact steps then).

**Google Business Profile API (apply early because approval takes time):** per Google's documentation (checked via search; confirm on the live page), you apply for "Basic API Access" through the Business Profile API contact form with a Google Cloud project number and an email that is an owner or manager of the profile; until approved the project's quota is zero. Secondary sources say approval can take days to a few weeks and recommend a complete, current profile with the website listed. Traffic data is easier: Google Analytics 4 and Search Console use standard Google Cloud OAuth (no special approval). Plan: in Phase 4 I will walk Oscar through creating the Cloud project and filing the form (one sitting).

## 17. Build progress (updated 2026-10-27, overnight session)

**Live on the site (merged to main and deployed by the guarded deployer):**
- Phase 0: 13 placeholder tools and dead code deleted; sidebar cut from 17 items to 7 primary plus a collapsed More group; collapsible icon rail; company switcher in the top bar; Ctrl K quick actions; compact Today (about 1,700 px instead of about 4,000 px); retired report pages and the Tools hub removed; Exterior Care landing, Jobs and Customers pages trimmed (about half the height); founder chat bubble (shared with the Messages page); mobile top-bar and bubble fixes.
- Phase 1 start: Add or Edit figures right in the Jobs report list; bulk Tag lead sources tool with Local Services Ads and Google Business Profile sources; Rebooking list with a spreadsheet-safe Copy button; expense and income category suggestions; Work truck fund card ($20,000 by Apr 1, 2027; balance logged by a founder); the dead "Team at work: Not connected" banner hidden until presence exists.

**Built, merged to main, switches on only after an owner runs SQL (nothing here is applied):**
- docs/db-change-proposals/RUN-ME-money-core.sql: double-entry ledger + invoices and payments (27 database checks). The Invoices page (new, under Money) and a printable invoice page ship in the same release and say "not switched on yet" until the SQL is applied.
- docs/db-change-proposals/RUN-ME-2026-10-27-presence.sql: live "who is online / working on what".
- docs/db-change-proposals/RUN-ME-2026-10-27-cleanup-junk-rows.sql: removes 7 test/spam website requests and 1 abusive message by exact id.

**Correction to section 1:** Finance already includes Exterior job revenue; the earlier "two money stores" claim was a date-range misunderstanding.

**Not started yet (next, in the order I would do them):** Stripe/Mercury payment links (needs Oscar's Stripe account), Mercury bank feed and reconciliation (needs a read-only Mercury token), receipt capture and OCR, expense-to-job linking and job costing, live operations board and dispatch map, crew phone app with clock-in and GPS (needs the iOS wrapper decision and the $99 developer account), commission statements at the flat 20%, customer portal, quote/proposal generator and e-sign, LSA lead import and speed-to-lead tracking, automations engine, assistant, Solutions and Essentials depth.

## 16. Sources (research done 2026-10-26)
- REA repository: https://github.com/morluto/rea (README: MIT, MCP reverse-engineering toolkit, lawful-use scope)
- Field service software landscape and prices: https://www.servicetitan.com/blog/housecall-pro-vs-jobber-vs-servicetitan (vendor page), https://fieldservicesoftware.io/best-field-service-software/servicetitan-competitors/ , https://www.selecthub.com/field-service-software/housecall-pro-vs-servicetitan/
- Accounting alternatives: https://alternativeto.net/software/quickbooks/?license=opensource , https://alternativeto.net/feature/accounting
- Invoice Ninja license (Attribution Assurance License per README): https://github.com/bafi/invoiceninja (a fork mirror; verify upstream)
- Routing: https://github.com/mbachem/vroom (VROOM fork mirror; verify upstream), OSRM via https://alternativeto.net/software/open-source-routing-machine/about
- Mercury API: https://posthog.com/docs/data-pipelines/sources/mercury , https://supergood.ai/api-report-card/mercury
- Bank aggregators: https://beancount.io/blog/2026/10/18/plaid-vs-mx-vs-finicity-bank-data-aggregators-coverage-reliability-price-guide , https://willisallstead.substack.com/p/why-theres-no-cheaper-alternative
- Automation licenses: https://blog.elest.io/n8n-vs-activepieces-which-self-hosted-automation-platform-in-2026/
- Receipts/OCR: https://localtonet.com/blog/how-to-self-host-paperless-ngx
- Wisconsin sales tax: https://handsoffsalestax.com/are-services-taxable-in-wisconsin/ , https://startbusinessbystate.com/wisconsin/cleaning-service/ , https://www.avalara.com/us/en/blog/2015/05/repetitive-v-non-repetitive-cleaning-services-wacky-tax-wednesday.html
Notes: several search results were blogs, vendor pages, or fork mirrors. Anything marked UNVERIFIED or "recheck" must be confirmed against the primary source (LICENSE file, official docs, CPA) before we rely on it.
- Stripe fees (third-party summaries; confirm on stripe.com): https://dodopayments.com/blogs/stripe-ach-fees/ , https://superdupr.com/blog/stripe-fees , https://transferfees.io/guides/stripe-fees-explained/
- Mercury invoicing: https://support.mercury.com/hc/en-us/articles/29647747304084-Mercury-Invoicing-Overview , https://support.mercury.com/hc/en-us/articles/29647920189332-Getting-paid-through-invoicing
- Local Services Ads disputes/credits: https://support.google.com/google-ads/answer/7435486 , https://support.google.com/adwords/answer/7195435
- Free LLM API tiers (limits change; verify): https://openrouter.ai/blog/tutorials/free-llm-apis-compared/ , https://blogs.novita.ai/free-llm-api-comparison-2026/
- Live data findings in section 1c came from read-only SQL aggregates against the OJ EXTERIOR CARE LEADS Supabase project on 2026-10-27; no customer personal data was read or copied.
- Oscar-provided files and screenshots (Mercury account list, Google Local Services Ads billing/settings/lead export, three commercial proposal PDFs) were read on 2026-10-27; customer phone numbers from the lead export are intentionally not copied here.
- Google Business Profile API access (verify on Google's page): https://developers.google.com/my-business/content/prereqs , https://slashpost.ai/blogs/google-business-profile/google-business-profile-api-documentation-2026 , https://unified.to/blog/how_to_set_up_google_business_profile_api_access_and_get_oauth_2_credentials
