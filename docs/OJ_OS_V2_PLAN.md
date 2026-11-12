# OJ OS V2 - The Overhaul Plan (planning document, 2026-11-12)

Status: PLAN ONLY. Nothing here is built. Companion to docs/OJ_OS_V2_AUDIT.md (the page-by-page audit this plan answers).
Supersedes as direction: docs/OJ_OS_MASTER_PLAN.md sections 5, 6 and 11 (its business facts in sections 1b-1e still stand).
Deadline: everything in "Season-critical" is live, tested and used daily by **March 1, 2027** (Exterior Care season start).

The one-sentence brief from Oscar: *if someone handed OJ Holdings a million-to-billion-dollar operating system, built only for us, what would it be?*

---

## 0. What OJ OS V2 is

One operating system for OJ Holdings LLC. Every lead, job, dollar, person, truck part, email and goal lives in it, and it does the boring work itself.
It should feel like opening the cockpit of the company: calm, fast, beautiful, and it always knows what matters next.

Five laws (they settle every argument later):
1. **One record per thing.** One customer, one job, one quote tool, one calendar, one equipment list, one score. Duplicates found in the audit are deleted, not restyled.
2. **The system does the work.** If a fact can be read (bank, Shopify, Google, weather, the job itself), nobody types it. If a step can be automated (reminders, follow-ups, rebooking, categorising), it is.
3. **Numbers always show.** No "Withheld", no "Unknown" tiles, no disclaimer paragraphs. Uncertainty is a small badge ("est.", "3 jobs missing cost") that opens the fix.
4. **Three taps on a phone.** Every daily action (book, start, photo, done, get paid, log a cost) is three taps or fewer, one-handed, in a truck.
5. **Aura is a requirement, not polish.** Every room has one signature visual moment; everything around it is quiet and exact.

---

## 1. Decisions (answered by Oscar, 2026-11-12)

| # | Question | Decision |
|---|---|---|
| D1 | Visual direction | **A, Lakefront.** Plus heavy motion and animation, speed, looks (section 17). |
| D2 | Hyperborea | **Keep** (Goals room; its altitude reads from the same ledger as Money). |
| D3 | Score system | **One all-in-one XP system for Oscar and Jacob** (section 18) replacing leaderboard points, Pulse levels and Daily 10 XP. |
| D4 | Customer texting | **No SMS.** Customer messages go by email, the customer portal and (for us and crew) web push. Twilio is out of the plan. |
| D5 | Payments | **Stripe will be opened.** Card fees are fine (they come out of money we are paid). |
| D6 | Crew | 1 crew member now, likely many more in 2027. **Commission pay.** Everything must scale to many crew (lanes, assignment, statements). |
| D7 | Instant quotes / online booking | **No instant quotes: Oscar and Jacob price every quote by hand.** Online booking **already exists on ojexteriorcare.com**; OJ OS must receive those bookings, not rebuild the booking page. |
| D8 | Price book | No formal sheet. Averages: **house wash about $300, exterior windows about $250.** The price book holds these as suggestions only; the founder sets the price. |
| D9 | Google APIs | **Apply.** Jacob's **LSA lead engine** merged on Nov 12 (PR #256): Google Ads API (read only) -> legacy `leads` table with new LSA columns, `oj_lsa_sync`, `oj_lsa_review` (possible duplicates), the Exterior lead inbox at /b/exterior/inbox (LeadEngine), Needs Reply, Spring Revival, backfill and sheet archive. Staged SQL docs/db-change-proposals/RUN-ME-2026-11-02-lsa-lead-engine.sql, not applied yet; go-live steps in docs/LSA_GO_LIVE.md. **The V2 Inbox is built on top of this engine, not beside it.** |
| D10 | Solutions | **Go much further in on OJ Solutions** (section 15 makes Solutions an agency operating system). |
| D11 | Essentials | **Paused**, but rebuild a Shopify-like store we host for free so Shopify can be dropped (section 16). |
| D12 | Books | **An in-depth books system inside OJ OS** (section 14). |
| D13 | Hosting | **Cloud server eventually (by March), not yet; it must be free**, and both founders must be able to build and deploy for free (section 19). |
| D14 | Budget | **$0.** Stripe fees are fine. Everything else free or self-hosted. |
| D15 | Junk data | **Yes, delete the test and junk records** (staged SQL in Stage 0, first PR; Oscar runs it). |
| D16 | Employee portal | Oscar will sign in as an employee when asked. Still to audit. |
| D17 | Per-person Command | **Jacob's is the same as Oscar's.** |
| D18 | Reverse engineering | **Use REA heavily wherever possible** (section 20 sets the lawful method per app). |
| D19 | Skills | **Install as many useful skills as possible** (section 21 is the vetted list). |

Consequences already applied below: no SMS anywhere; no /book instant-quote page (website bookings flow in instead); quote builder stays manual with suggested prices; Twilio removed from integrations; budget $0 rules everywhere.

---

## 2. The new map (information architecture)

### 2.1 Shell

```
+----+------------------------------------------------------------------------------+
| OJ |  [Holdings v]   Search or do anything  (Ctrl K)        timer  bell  Jacob*  O |  <- one top bar
|----+------------------------------------------------------------------------------|
| C  |                                                                              |
| I  |                          the room                                            |
| J  |                                                                              |
| S  |                                                                              |
| C  |                                                                              |
| $  |                                                                              |
| G  |                                                                              |
| E  |                                                                              |
| *  |                                                                              |
|----+------------------------------------------------------------------------------|
| live . next job in 42 min (Sample Smith, Kenosha) . timer 1h12 . $1,942 cash . synced  |  <- status bar
+-----------------------------------------------------------------------------------+
```
- Removed: the window-tab strip (or kept only as user-pinned tabs, D-level setting), the "Team at work" row (becomes live avatars in the top bar), the Exterior second nav, the in-page link tiles, the separate sign-out icon (moves into the avatar menu).
- Company switcher: Holdings / Exterior Care / Solutions / Essentials / Studio. Holdings shows everything; a company scopes every room and re-themes the accent.
- Right side panel (toggle, remembers state): Chat (threads per business and per job), Activity (Pulse), AI (Ask OJ). One panel, three tabs, instead of a bubble + a page + a bell.

### 2.2 Rail (desktop) - 9 rooms, in this order

| Key | Room | Route | Replaces |
|---|---|---|---|
| C | **Command** | /workspace | Today, Businesses index, Winter plan, Pulse (feed moves to side panel) |
| I | **Inbox** | /inbox | Website intake, quote requests, LSA leads, Solutions website requests, consultation requests, notifications bell list |
| J | **Jobs** | /jobs | /b/exterior/bookings, /b/exterior/field, Jobs and income report (moves to Insight), Field log, Job continuity, Dispatch preflight |
| S | **Schedule** | /schedule | /calendar, /b/exterior/calendar |
| C | **Customers** | /customers | /b/exterior/leads, /customers directory, Customer 360, company profiles, Commercial tab |
| $ | **Money** | /money | /finance, /invoices, /books, Exterior money tab, money in Customers, truck fund cards |
| G | **Growth** | /growth | /growth, door knocking, LSA card, rebooking (all 3 versions), Solutions outreach when scoped to Solutions |
| E | **Crew & Gear** | /crew | /workspace/employees, /workspace/team (people part), Fleet Command, Upgrade register, Truck plan, equipment notes |
| * | **Insight** | /insight | /analytics, Jobs and income, data quality, metrics tab, forecasts |

Bottom of rail: Goals (Hyperborea, if D2 keeps it), Files, Settings.
Business rooms (Solutions, Essentials, Studio) are reached by the company switcher; each has its own home and the shared rooms filter to it.

### 2.3 Phone - bottom bar

`Today | Jobs | (+) | Money | Me`
- (+) is the capture button: New lead, Book job, Photo, Expense (receipt), Note, Task, Start timer. Long-press = voice.
- Me = my schedule, my pay, settings, the other rooms.
- No window tabs, no team strip, no desktop drawer. Chrome under 110 px total.

### 2.4 Full route tree (V2)

```
/workspace                         Command (per company when scoped)
/workspace/inbox                   Inbox (all incoming) ?item=
/workspace/jobs                    Jobs: Board | List | Map | Calendar views; ?view=
/workspace/jobs/[id]               Job page (THE job record)
/workspace/schedule                Schedule: Day (crew lanes) | Week | Month | Map; ?date=
/workspace/customers               Customers: People | Companies | Pipeline; saved views
/workspace/customers/[id]          Customer page (person or company)
/workspace/customers/[id]/p/[pid]  Property page
/workspace/quotes                  Quotes list (residential + commercial)   (lives under Customers in the rail)
/workspace/quotes/[id]             Quote builder / proposal
/workspace/money                   Money home: cash, owed, due, P&L month, alerts
/workspace/money/invoices          Invoices + /[id]
/workspace/money/payments
/workspace/money/expenses          Expenses + receipts
/workspace/money/bank              Bank feed (was Bank to books) - categorise inbox
/workspace/money/reports           P&L, balance sheet, cash flow, AR aging, by division, by service
/workspace/money/taxes             Set-asides, sales tax, 1099 list, CPA package
/workspace/money/plan              Allocation (the split), budgets, truck fund, goals money
/workspace/growth                  Growth home: speed to lead, follow-ups, cadences
/workspace/growth/lsa              LSA command center
/workspace/growth/campaigns        Email campaigns + rebooking pushes
/workspace/growth/reviews          Reviews and referrals
/workspace/growth/territory        Door knocking + map
/workspace/growth/sources          Attribution
/workspace/crew                    People, assignments, time, pay
/workspace/crew/[person]           Person page (docs, pay, jobs, training)
/workspace/crew/gear               Equipment, vehicles, maintenance, failures, supplies
/workspace/crew/rig                Truck and rig plan
/workspace/insight                 Reports, goals pacing, forecast, Ask OJ
/workspace/goals                   Hyperborea (if kept)
/workspace/files                   Files and vault
/workspace/settings/*              Company profiles, services and price book, templates, people and access, integrations, automations, notifications, appearance, system, data
/workspace/b/solutions/*           Solutions room (Command, Daily 10, Email engine, Prospects, Clients, Calls)
/workspace/b/essentials/*          Essentials room (Store, Products, Orders, Ads)
/workspace/b/studio/*              Oscar Jacob studio (Productions, Calendar, Channels)
/employee                          Crew app (phone-first)
/p/[token]                         Customer portal (quotes, invoices, booking, history, referral)
/store (or ojessentials.store)     Essentials storefront we host (section 16)
(ojexteriorcare.com keeps its own booking form; its submissions arrive in Inbox and Jobs)
```
Every old route redirects to its new home (no dead links from bookmarks or the iPhone calendar feed).

### 2.5 Old page -> V2 fate (complete)

| Old | Fate |
|---|---|
| Today (/workspace) | Rebuilt as Command |
| Exterior Care home (/b/exterior) | Becomes Command scoped to Exterior |
| Jobs (/b/exterior/bookings) | Jobs room |
| Job sheet dialog | Grows into the Job page (keeps its money, costs, photos) |
| Job continuity / crew brief / assign-report | CUT (assign + notes live on the Job page) |
| Dispatch preflight (Heads-up) | CUT (conflicts and gaps become Command exceptions and Schedule warnings) |
| Field (/b/exterior/field) | Phone Today + Job page |
| Field log (?booking=) | CUT |
| Customers (leads) + Customer directory + Customer 360 + Commercial | One Customers room + one Customer page |
| Estimate workbench, Commercial estimates, Proposals | One Quote builder |
| Website intake, Quote requests, Solutions website requests | Inbox |
| Project 360 / NEXUS | CUT |
| Exterior calendar + Calendar | Schedule |
| Jobs and income | Insight > Jobs report |
| Door knocking | Growth > Territory |
| Exterior money, Money, Invoices, Bank to books | Money room |
| Metrics tab (log a number) | CUT (goals live in Insight; manual numbers become Goals inputs) |
| Documents tabs, Files | Files and vault |
| Activity (34,000 px) | Side panel Activity with filters and paging |
| Upgrade register, Fleet Command, Truck plan | Crew & Gear > Gear and Rig |
| Exterior settings | Settings > Exterior Care |
| Company board (task board on 5 routes) | Tasks live in Command (mine) and a Tasks view in the side panel; board view under Insight > Work |
| Growth | Growth room (kept and deepened) |
| Insight (analytics) | Insight room |
| Businesses index | Command (Holdings) portfolio strip |
| Hyperborea | Goals (D2) |
| Pulse | Side panel Activity + Command feed |
| Data quality | Insight > Data health (honest score) and Command exceptions |
| Messages + chat bubble | Side panel Chat |
| Team (stub), /workspace/team, /workspace/employees | Settings > People and Crew room |
| System status | Settings > System |
| Fleet Command | CUT, rebuilt as Gear |
| Solutions tabs (11) | Solutions room with 5 tabs: Today, Outreach (Daily 10, Email, Prospects), Clients, Calls, Money |
| Essentials tabs | Essentials room with 4 tabs: Store, Products, Orders, Marketing |
| Studio | Studio room: Productions, Calendar, Channels |

---

## 3. Design language V2

### 3.1 Three directions (Oscar picks one in D1; the first built room proves it)

**A. Lakefront (recommended).** The trade is clarity: clean glass, water, light. Kenosha sits on Lake Michigan.
- Signature: a live **horizon** across the top of Command. A rendered sky over a lake line, coloured by the real time of day and Kenosha weather (dawn gold at 6 AM, grey drizzle when it rains, stars after dark). Today's jobs sit on the horizon as lit markers; the water level is cash on hand against the month goal. Everything below it is quiet glass.
- Surfaces: deep lake navy, not black. Panels are frosted glass with a 1 px light edge on the top side only (light comes from above, like a window).
- Motion: water-like easing (slow out), numbers that roll, the horizon breathing with weather. One orchestrated moment per room, nothing else moves.
- Per business: Exterior lights the horizon orange; Solutions copper dusk; Essentials pale morning cream; Holdings cold blue.

**B. Expedition.** Take Hyperborea (the mountain, camps, journal, achievements) and make the whole OS the expedition. Command is base camp; rooms are camps; goals are altitude.
- Strongest story and aura, highest risk: it can feel like a game when you need to invoice someone at 7 AM.

**C. Machined.** A precision instrument: brushed graphite, brass details, gauge dials for cash, pace and capacity, a car-cockpit status bar.
- Very premium and dense; colder; less personal to the trade.

### 3.2 Tokens (direction A; B and C swap surfaces and the signature only)

Color (one file, src/styles/tokens.css; every other colour in the repo is deleted):
| Token | Value | Use |
|---|---|---|
| --lake-0 | #07101F | app background (lake at night) |
| --lake-1 | #0C1A2E | panels |
| --lake-2 | #13243C | raised panels, inputs |
| --glass-edge | rgba(214, 232, 255, 0.10) | 1 px top light edge |
| --ink | #EEF3F8 | primary text |
| --ink-2 | #A9B7C9 | secondary text |
| --ink-3 | #6E7F96 | tertiary, axis labels |
| --horizon | #F2B866 | Holdings signal (dawn gold): focus rings, primary action, live states |
| --good / --watch / --bad | #4FD1A5 / #F2B866 / #FF7A7A | status only, never decoration |
| --c-exterior | #FF8A1F (+ green #5BBF6A) | Exterior accent |
| --c-solutions | #C98A6B | Solutions copper |
| --c-essentials | #EDE4D3 | Essentials cream (its room switches to a light surface) |
| --c-studio | #8E7CF2 | Studio violet |
Contrast: all text 4.5:1 on its surface (checked by a test that reads tokens.css).

Type:
- One family for UI and display, chosen for tabular figures and a display cut with character. Shortlist to test in a specimen page in stage 2: Bricolage Grotesque (display, variable optical size) paired with its own text sizes; Schibsted Grotesk; Hanken Grotesk. Essentials keeps a serif for its room only. Manrope, Sora and Cormorant go.
- Scale (1.25 ratio): 12 / 13 / 15 / 18 / 22 / 28 / 36 / 48 / 64. Body 15 desktop, 16 phone. Numbers always tabular. Money in big figures uses the display cut at 36-64.
- Sentence case everywhere. No all-caps eyebrow labels, no "01 / 02" numbering unless it is a real sequence (steps of a job, stages of a pipeline).

Space and shape:
- 4 px grid; spacing steps 4, 8, 12, 16, 24, 32, 48, 72.
- Radius by hierarchy, not one radius for all: 6 (inputs, chips), 10 (cards), 16 (sheets, dialogs), full (avatars, status dots).
- Elevation: three levels only (flat, raised, floating). Shadow is a soft lake-dark glow, not grey.

Motion:
- Durations 120 ms (press), 220 ms (open/close), 480 ms (room entrance), 900 ms+ only for the signature moment. Easing: out-expo for open, standard for close.
- Rolling numbers (number-flow is already installed) on every live figure.
- prefers-reduced-motion turns all of it into instant swaps.

Density: Comfortable (default) and Compact (tables at 32 px rows). Setting per person.

### 3.3 Components (one library, src/components/ui/, documented on /preview/kit)

App frame: TopBar, Rail, StatusBar, SidePanel (Chat / Activity / Ask), CommandPalette, CaptureMenu, Toasts, PageHeader (title + one line + actions, never a paragraph).
Data: Stat (number + delta + spark + badge), StatRow, DataTable (sortable, filterable, saved views, column picker, bulk select, keyboard, virtualised, CSV), Timeline, ActivityItem, KanbanBoard, Calendar (day lanes / week / month), MapView, Chart set (area, bar, stacked, funnel, donut-free), Sparkline, Meter (goal pacing), Badge (est., missing, overdue).
Records: RecordHeader (avatar/logo, name, status, key numbers, primary actions), RecordTabs, FieldGrid (inline edit), Notes, Photos (grid, before/after slider), Attachments, LinkedRecords.
Input: Button (primary / secondary / ghost / danger), IconButton, Field, Money input (cents, tabular), Date and time picker (one, not a grid of day buttons), Address field (autocomplete + map pin + out-of-state flag), Phone field, Select / Combobox, Segmented, Toggle, Slider, Signature pad, Camera capture, Voice button.
Feedback: Skeleton (every loading state; no blank 10-second pages), Empty (one sentence + one action), Error (what happened + the fix), Confirm sheet, Undo toast (5 s undo instead of "are you sure" where safe).

### 3.4 Page templates

1. **Home** (Command, business homes): signature band + exceptions + today + pulse. Fits 2 screens on desktop.
2. **Index** (Jobs, Customers, Invoices, Prospects): header, view switcher (board / list / map / calendar), filters as chips, saved views, the table or board, a detail drawer on click (no page change for a quick look), full page on open.
3. **Record** (Job, Customer, Invoice, Quote, Person, Asset): RecordHeader, a left column of the story (timeline, notes, photos) and a right column of facts and money; tabs only when there is a lot.
4. **Workbench** (Bank feed, Inbox, Follow-ups): a queue on the left, the item on the right, keyboard to move (J/K, Enter, E for done), bulk actions.
5. **Report** (Insight, Money reports): filters bar, headline numbers, charts, the table under them, export.
6. **Phone** versions of each: one column, sticky primary action at the bottom, swipe actions on rows, pull to refresh.

### 3.5 Copy rules

- Headings name the thing ("Jobs"), never sell it ("One job. One source of truth.").
- One line under a heading at most, only if it helps; most pages need none.
- Plain words: Money in, Owed, Paid, Booked, Done. No "source-qualified", "attributable", "evidence", "operator", "mission".
- Missing data is a task with a button ("3 jobs missing cost - Add"), never a paragraph.
- Errors say what happened and the fix. Empty states invite one action.
- A test fails the build if a component ships a paragraph over 25 words outside Settings and Help (a cheap lint that stops the disclaimer creep coming back).

### 3.6 Performance and quality floor

- First meaningful paint under 1.5 s on the production build over Funnel (today Exterior pages are blank for 8-15 s on dev); skeletons always.
- Lists over 50 rows are virtualised or paged. No page over 3 screens tall on desktop or 6 on phone without a reason.
- Keyboard: every action reachable; J/K in lists; Ctrl K everywhere; focus rings visible.
- Phone: 44 px targets, one-handed reach for primary actions, works offline for the crew app.
- CSS: 572 KB in 33 files today, much of it for deleted features (corporate-intelligence.css, scenario-lab.css, founder-weekly-review.css, atlas-v3.css, commercial-war-room.css, fleet-command.css...). V2 target under 120 KB, one file per component family.

---

## 4. The data spine (what the database has to become)

Today: Exterior Care runs on the legacy `leads` row (lead = customer = job, with a status) plus `bookings`; the workspace has `oj_customers`, `oj_properties`, `oj_lead_links`, `oj_job_expenses`, `oj_job_photos`, `oj_invoices` (+ lines, payments), `oj_proposals` (+ lines, acceptances), `oj_portal_links`, the ledger (`oj_journal_entries/lines`, `oj_accounts`, `oj_ledger_locks`), `oj_finance_entries`, `oj_metric_entries`, tasks (`oj_cards`, comments, activity), outreach and email engine tables, presence and work sessions.

V2 spine (all new tables additive, staged SQL in docs/db-change-proposals, PGlite permission tests, Oscar runs them; nothing destructive):

```
Customer (person or company) -- Contact(s) -- Property / Site (geo, access, water source, surfaces, measurements, photos)
   |
   +-- Request (inbox item: LSA lead, web form, call, email, referral, door knock)  -> source, received_at, first_response_at
   +-- Quote (versioned; options good/better/best; lines from the price book; deposit; expiry; e-sign) -> status draft/sent/viewed/accepted/declined/expired
   +-- Job (one piece of work; may be one-off or from a Plan) -> status: scheduled / in progress / done / invoiced / paid / cancelled
   |     +-- Visit(s) (date, window, crew, check-in/out, route order, weather snapshot)
   |     +-- Line items (service, qty, price), Costs (materials, fuel, labor/commission, equipment, other), Photos (before/after), Checklist, Signature, Notes, Timeline
   +-- Plan (recurring: monthly / quarterly / semiannual / annual; generates Jobs and Invoices)
   +-- Invoice -> Payment(s) -> ledger postings (already built)
   +-- Messages (email / text / portal, logged both ways), Review request, Referral
Service (catalogue) -> Price book entries (package, per pane, per sq ft, per story, minimums, add-ons, commercial rates)
Person (owner, crew) -> Time entries, Assignments, Commission lines, Documents (W-9, license), Training
Asset (washer, pump, poles, vehicle) -> Maintenance, Failures, Hours; Supply items -> stock, usage per job
Bank transaction -> Rule -> Posting; Expense (receipt image, vendor, category, job link)
Goal (metric, target, period) ; Automation (trigger, conditions, actions, run log)
Event (append-only audit of every change that matters, powers Activity)
```

Migration of the 190 lead rows (stage 3, no data loss):
1. Every completed lead becomes Customer + Property + Job (status done) + Visit(s) from its bookings; revenue and costs move to the Job; the lead row stays read-only and linked.
2. Every open lead becomes Customer + Request or Quote (if it has a quote amount).
3. Every confirmed future booking becomes Job + Visit.
4. Duplicates merged by phone, then name + address, with a review sheet (never automatic for two people with one name - the existing rule).
5. Service names mapped to the new catalogue (18 spellings -> ~10 services) with a review sheet.
6. Lead sources re-tagged from notes ("LSA" in notes -> LSA) with a review sheet, then the LSA import closes the gaps.
7. A read-only "legacy" badge on migrated records for one season; the old tables are kept, never dropped.

---

## 5. Room by room (exact spec)

### 5.1 Command (home)

Purpose: in 10 seconds, know the state of the company and the next thing to do.
```
+------------------------------------------------------------------------------------+
|  HORIZON (signature): sky over the lake, live weather, time of day                  |
|  "Good morning, Oscar."   Thu Nov 12 . 44F cloudy . sunset 4:27                      |
|   o 9:00 Sample A    o 2:45 Sample B         water line = cash $1,942 / goal          |
+-------------------------------+------------------------------+---------------------+
| Needs you (exceptions)        | Today and next               | Money now           |
|  2 leads waiting 30+ min  Fix |  timeline: jobs, events,     |  Cash $1,942 (Merc) |
|  13 quotes going cold   Chase |  drive times, weather flags  |  Owed $422          |
|  Invoice overdue $422  Remind |  [crew lanes if >1 crew]     |  This month in/out  |
|  17 jobs no revenue      Add  |                              |  Truck fund 9% ...  |
|  375 bank lines       Sort    |                              |                     |
+-------------------------------+------------------------------+---------------------+
| Pipeline: new 2 . quoted $5,200 . booked $5,160 next 30d . win rate 52%            |
| Portfolio (Holdings only): Exterior | Solutions | Essentials | Studio - in, margin, cash |
| Brief (AI, 5 lines, written each morning) . Jacob is working on: LSA lead import   |
+------------------------------------------------------------------------------------+
```
- Exceptions are the heart: each row = what is wrong + one button that fixes it in place (drawer), ordered by money at stake. Sources: leads not answered, quotes going cold, invoices due/overdue, jobs missing figures, unassigned jobs tomorrow, weather on a booked day, equipment due, proposal expiring, LSA dispute window closing, bank lines waiting, out-of-state job without a check, Mercury low balance.
- Daily brief (5 spoken-style lines) generated at 6 AM from the data: yesterday's money, today's jobs, the one risk, the one opportunity. Free model via the AI gateway; numbers come from queries, never from the model.
- Per person: Oscar's default = money-heavy; Jacob's = growth-heavy (D17). Cards can be hidden/reordered and the layout is saved.
- Season switch (auto by date, override in Settings): in season the middle column is the job timeline; off-season it is rebooking + pipeline + books catch-up.
- Phone: horizon shrinks to a 120 px band; then Needs you, then Today as a list; money in one row.
- Acceptance: fits 2 desktop screens; loads under 1.5 s; every exception has a working fix button; the truck fund shows one number (from Mercury).

### 5.2 Inbox

Purpose: everything that arrives from outside, in one queue, answered fast.
- Sources: LSA leads (Jacob's existing automatic pull; Google Ads API when approved), website bookings and forms (ojexteriorcare.com, ojsolutions.org), consultation bookings, customer portal requests, replies to our emails (Gmail), missed calls (later), referrals.
- Workbench template: queue left (newest first, speed-to-lead timer on each: green < 5 min, amber < 30, red after), item right: who, what they asked, map of the address, past history if known, suggested reply (template + AI draft), actions: Reply (email), Call (tel: link from the phone), Quote, Book, Convert to customer, Spam, Done.
- Spam detection (marketing pitches, gibberish addresses) auto-filed into Spam with one-tap restore.
- Speed-to-lead stat per source and per person on Insight.
- Replaces: Website intake, Quote requests, Solutions website requests, consultation table, the bell list. Paid equivalent: Jobber Requests / Housecall Job Inbox / Podium inbox.

### 5.3 Jobs

Index views: Board (columns: To schedule / Scheduled / Today / In progress / Done - needs figures / Invoiced / Paid), List (DataTable), Map (all jobs this week as pins, colour by status), Calendar (links into Schedule).
Filters: date range, status, crew, service, company, city, out-of-state, unpaid.
Row/card shows: customer, service, date/time, address short, price, crew avatar, status pill, badges (needs cost, unpaid, weather, out-of-state). Three actions max on a card: Open, Call, Directions (rest inside).

**Job page** (the record everything hangs on):
```
[Back] Sample Smith . Window cleaning . Sun Nov 15, 12-2 PM . Scheduled  [Start] [...]
+------------------------------------------+-----------------------------------------+
| Timeline (requested > quoted > booked >  | Money: price $400 | paid $0 | cost $0  |
|  on my way > started > done > invoiced > |  profit bar | commission 20% $80        |
|  paid > review asked)                    |  [Invoice] [Take payment]                |
| Scope: lines from the price book         | Crew: (assign)      . drive 38 min       |
| Checklist (from the service template)    | Property: 2-story, 38 panes, water: spigot north wall, dog |
| Photos: before / after (slider)          | Weather for the visit: 46F cloudy        |
| Notes & chat (thread for this job)       | Customer: history, lifetime $, contact   |
+------------------------------------------+-----------------------------------------+
```
- Actions: Start (records arrival, optional "on my way" message), Pause, Done (requires after photos if the service template says so, collects signature optional, prompts payment), Invoice (one tap, from the lines), Take payment (Stripe link / card on file / cash / check / ACH), Reschedule (drag on Schedule or date picker), Duplicate, Make recurring (creates a Plan), Cancel (reason).
- Costs: quick add chips (Chemicals, Fuel, Commission auto, Rental, Other) + receipt photo; commission line created automatically at the crew's rate when marked paid.
- After done: review request emailed at the configured delay; rebook date set from the service interval.
- Replaces: job sheet, JobContinuity, Field log, Dispatch preflight, crew brief, Assign dialog. Paid equivalent: Jobber Work Orders + Complete Job; Housecall job app; CompanyCam (photos).
- Acceptance: a job goes book -> start -> done -> invoice -> paid on a phone in under 60 s of taps; before/after photos attach; profit shows the moment costs exist.

### 5.4 Schedule (dispatch)

- Views: Day (crew lanes horizontally, hours vertically, unscheduled jobs tray on the side), Week, Month, Map (route of the day with drive times between stops).
- Drag to move or reassign; conflicts and overlaps show live; drive time between consecutive jobs computed (OSRM, self-hosted, free) and shown as gaps; "Optimise order" button (VROOM) for a day with 3+ jobs.
- Weather strip on every day (NWS / Open-Meteo): rain probability, wind (bad for washing), freeze (no washing). Booking a job on a bad-weather day warns.
- Capacity: hours booked vs available per crew per day; season heatmap on Month.
- Events (meetings, personal) on their own lane; Google Calendar two-way sync per person (later), iPhone feed stays.
- Replaces: two calendars, Exterior calendar's month grid. Paid equivalent: Jobber Schedule, Housecall dispatch, OptimoRoute, Route4Me.

### 5.5 Customers (and Quotes)

Index: People | Companies | Pipeline (board: New, Contacted, Quoted, Won, Lost) | Map. DataTable with saved views ("Due to rebook", "LSA leads this month", "Top 20 by lifetime", "No phone", "Out of state"), bulk actions (tag, email, merge, export).
**Customer page:**
- Header: name / logo, type, tags, lifetime value, last job, next due, source, rating (if they reviewed us), quick actions (Call, Email, Quote, Book, Invoice).
- Left: timeline of everything (requests, quotes, jobs with before/after thumbnails, invoices, payments, emails, notes, reviews).
- Right: contacts, properties (each with a mini satellite map, measurements, access notes, water source, surfaces and what worked), open money, plans, files (COI, W-9 for commercial), duplicates (only when they exist).
- Company customers add: sites list, people with roles, payment terms (net 30 / PO / ACH), vendor onboarding packet, proposals.
**Quote builder** (one tool for residential and commercial):
- Pick customer + property (or create inline). Property facts to price by hand: stories, pane count, sq ft (optional map outline tool later), photos, notes.
- Pricing is manual (D7/D8): the founder types the price; the price book only suggests (house wash about $300, exterior windows about $250, and your past prices for similar jobs and the same customer shown beside the field). Lines, add-ons, discounts, packages; Good / Better / Best options side by side; recurring frequency pricing (one-time / quarterly / monthly) for commercial, like the three commercial proposals sent this fall.
- Margin preview (cost model per service: time x crew rate + chemicals + drive) visible to owners only.
- Output: a branded quote page at /p/[token] (photos, scope, options, terms, exclusions, validity), Accept + e-sign + optional deposit; PDF download. Follow-up cadence day 2 / 5 / 10 automatic until accepted or declined; viewed notifications.
- Accepted quote -> Job (or Plan) created, scheduling link offered to the customer.
- Replaces: 4 quoting tools; paid equivalent: Jobber Quotes, ResponsiBid ($179-229/mo), QuoteIQ ($30-75/mo), DocuSign/PandaDoc, Proposify.

### 5.6 Money

Home: Cash (all Mercury accounts live, with the split buckets), Owed to us (AR aging), Due from us (bills), This month in/out/profit (from the ledger), Truck fund, Tax set-aside, alerts (low balance, overdue, unposted bank lines).
- **Invoices**: list + DataTable; invoice page is branded (logo, colours, pay button); send by email; reminders day 3 / 7 / 14 after due; partial payments; deposits; batch invoice for a commercial month; statements per customer.
- **Payments**: Stripe (card, Apple/Google Pay, ACH), cash, check (photo of the check), Zelle/other manual; payouts reconcile against Mercury deposits automatically.
- **Expenses**: snap a receipt (phone) -> OCR (local) -> vendor, amount, date, category suggestion -> link to a job or overhead; mileage log (manual trips now, GPS later).
- **Bank feed**: the Bank-to-books engine as a workbench: rules ("Menards -> Chemicals, Exterior"), AI suggestions, bulk post, split a transaction, match to invoice payments, keyboard flow. Goal: 375 waiting -> 0 by January.
- **Reports**: P&L (month, quarter, season, YTD; by division and by service), Balance sheet, Cash flow, AR aging, Job profitability, Cost per lead by source; export CSV/PDF; CPA package.
- **Taxes**: set-aside tracker (the 25% Tax Reserve rule), Wisconsin sales tax note (Essentials collects; Exterior pending CPA), 1099 list for crew, quarterly estimate reminders.
- **Plan**: the Mercury split rules mirrored as buckets, budgets by category, the truck fund goal with pace, "safe to spend" figure.
- Replaces: QuickBooks Online ($35-235/mo), Expensify/Dext, Invoice Ninja, Mercury's own views. Payroll stays outside (Gusto later) - we export commission statements.

### 5.7 Growth

Home: Speed to lead (median response time this week), Follow-ups due today (leads + quotes, with templates and one-tap send), Rebooking (ONE list: customers due by service interval, with campaign), Reviews (count, average, requests sent, replies), Sources (leads, booked, revenue, cost per booked job).
- **LSA command center**: leads by day, charged / credited, cost per lead and per booked job, dispute deadlines (30 days) with a list of disputable leads, budget pacing, billing status.
- **Campaigns**: email campaigns from Gmail/Workspace to segments (rebook spring, past customers 6+ months, commercial prospects), templates, schedule, unsubscribe, results.
- **Reviews and referrals**: after-job review request (Google review link), reply drafts, referral link per customer with credit tracking.
- **Territory**: door-knocking sessions on a map (heat by $ per door), knock mode on the phone (counter: knocked / answered / interested / quoted), best streets.
- **Website**: bookings and form submissions from ojexteriorcare.com by week and source (visits when Google Analytics is connected).
- Replaces: NiceJob ($75-125/mo), Broadly, Mailchimp, Jobber marketing add-ons, Housecall marketing suite, LSA dashboards.

### 5.8 Crew & Gear

- **People**: each person (owners + crew): role, access, phone, pay model, documents (W-9, license, signed agreement), training checklist (job playbooks), schedule, availability, time off.
- **Assignments**: unassigned jobs queue, drag to a person, instructions and checklist per job, notify crew (push/email).
- **Time and pay**: clock in/out per job from the crew app (location stamp when allowed), timesheets to approve, commission lines from paid jobs, pay statements per period, export for payroll.
- **Gear**: assets (ALH4240 hot-water unit, Simpson 4200, Xero Pure, Xero Pro, rented washer, hoses, reels, ladders), hours/uses, service schedule, failure log (the washer is the #1 failure), parts and spares checklist, supplies (chemicals stock, used per job).
- **Rig**: the truck plan (budget lines, trucks being weighed, washer repair/rent/replace) reading the truck fund from Mercury.
- Replaces: Fleetio, Homebase/TSheets, Connecteam, Upgrade register, Fleet Command, Truck plan page.

### 5.9 Insight

- Reports: Revenue (by month, division, service, source, city), Margin by service, Cost per lead and per booked job by source, Close rate, Speed to lead, Average job, Rebook rate, Seasonality, Crew productivity ($ per hour), Door-knock $ per door.
- Goals: monthly revenue goal ($20,000 in Exterior settings today), truck fund, review count, response time; pacing meters with "on pace / behind by $X".
- Forecast: 30 / 90 days (booked + weighted quotes + plans), season projection.
- Data health (honest): duplicates, junk names, missing phone, missing cost/revenue, unposted bank lines, untagged sources - each with a fix queue; the score drops when any of these grow.
- **Ask OJ**: type a question ("what's my margin on house washes this season?"), the AI writes the query, the app runs it, shows the answer with the numbers and the query.
- Replaces: Looker/Tableau-style BI; Jobber/Housecall reporting tiers.

### 5.10 Business rooms

**Solutions** becomes the agency operating system in section 15 (tabs: Today, Outreach, Demos, Clients, Calls, Billing). Fix first: the email engine shows contradictory counts and has 0 replies on 233 sends - add reply detection check, inbox placement test, A/B subject lines, and a "pause if 0 replies after N" rule. Remove "(Example)" demo deals from live screens.
**Essentials** (keeps the cream serif skin): Store health (sessions, conversion, orders, AOV, refunds from Shopify), Products (active/archived, margin per product, supplier), Orders, Marketing (ads spend, ROAS when connected), tax set-aside (30/70 rule).
**Studio**: Productions pipeline (Idea -> Published), Content calendar, Channels (YouTube / Instagram / TikTok / Facebook stats when connected), repurpose list (long form -> shorts), sponsor pipeline.

### 5.11 Goals (Hyperborea)

If kept (D2): the mountain stays as the long-term goal room (revenue altitude, camps, journal, achievements). Its visual quality is the bar for the signature moments elsewhere. Its numbers read from the same ledger as Money (no separate math).

### 5.12 Crew app (/employee)

Phone-first, offline-capable PWA:
- Today: my jobs in route order with drive times, weather, a big Start button.
- Job: address (tap = navigate), access notes, checklist, scope, before photos required, Start / Pause / Done, after photos, notes to the office, problem button (photo + note -> founders get a push).
- My pay: commission this week / period, per job, approved.
- My time: clock in/out, hours this week.
- Training: playbooks per service (videos/photos/steps), safety (CO alarm, ladder rules).
- Crew see the job and their own commission, not the company's margins. Built for many crew from day one (D6).
- Replaces: Jobber/Housecall field apps, Connecteam.

### 5.13 Customer portal and public pages

- /p/[token] portal: their quotes (accept, e-sign, pay deposit), upcoming visits (confirm / reschedule request), invoices (pay), history with before/after photos, review and referral link.
- ojexteriorcare.com booking form: unchanged for customers; each submission lands in Inbox (and as a pending Job when it includes a time), with a confirmation email from OJ OS.
- Emails (no SMS): branded templates for quote sent, quote reminder, booking confirmed, reminder day before, on my way, done (with photos), invoice, receipt, review request, rebook reminder. Sent through the Gmail/Workspace account (free within Google's limits).

### 5.14 Settings

Company profiles (logos, colours, addresses, tax ids, invoice footers) | Services and price book | Templates (emails, checklists, quote terms, exclusions) | People and access (members, crew, invites, roles) | Integrations (Mercury, Stripe, Google Ads/LSA, Business Profile, Gmail, Shopify, GoHighLevel, Apps Script, weather) with status and last sync | Automations (rules + run log) | Notifications (per person: push, email, quiet hours) | Appearance (direction, density, reduced motion) | System (release SHA, health, backups) | Data (import, export, cleanup).

---

## 6. Systems that run through every room

### 6.1 Command palette (Ctrl K) - the main way around
- Searches everything: customers, jobs, quotes, invoices, tasks, files, people, pages, settings, recent items.
- Does things in plain words: "book Smith next Tuesday 10am", "log $84 chemicals on the Smith job", "invoice Smith", "what's my cash", "who owes us". Parsed into a preview card with Confirm.
- Keyboard first: arrows, Enter, Tab to refine, Esc. Recent and pinned at the top.
- Paid equivalent: Raycast/Linear-style palettes; none of the field-service tools have this.

### 6.2 Quick capture (+)
New lead, Book job, Photo (to a job), Expense (receipt), Note, Task, Start timer, Voice. Each opens a sheet, not a page. Voice: hold to talk -> transcribed -> parsed like the palette.

### 6.3 Automations (rules with receipts)
Trigger (lead created, quote viewed, job done, invoice due, payment received, weather alert, date) -> conditions -> actions (send template, create task, move status, notify, post to ledger). Every run logged with what it did; owners can pause any rule; a global kill switch.
Starter library: speed-to-lead auto-reply, quote follow-up cadence, appointment reminder, on my way, job done + photos email, review request, invoice reminders, rebook reminder by service interval, LSA dispute reminder, low-balance alert, equipment service due, proposal expiring, weekly owner digest.
Replaces: Zapier/Make, Jobber/Housecall automations.

### 6.4 AI layer (free first, numbers from queries)
- Daily brief, Ask OJ, reply drafts in Inbox, quote scope drafts from photos/notes, receipt reading, transaction categorising, review reply drafts, weekly summary.
- Data rules from the master plan stay: PII and bank data local (Ollama on the host) or no-training providers only; every AI write logged; owner confirm for outbound messages and money.

### 6.5 Notifications
One stream (side panel Activity + bell count + web push on phones): new lead, lead waiting too long, quote viewed/accepted, payment received, job started/done by crew, crew problem, weather warning, invoice overdue, bank alert. Per person preferences and quiet hours.

### 6.6 Integrations (target list)
| Integration | Use | Status today |
|---|---|---|
| Mercury (read) | balances, transactions, bank feed | connected |
| Stripe | payments on invoices/quotes, deposits, payouts | needs account (D5) |
| Google Ads API (LSA leads) | leads every 15 min, charge status, disputes | needs developer token (D9) |
| Google Business Profile API | reviews in, reply out | needs API access (D9) |
| Gmail / Workspace | send templates and campaigns, read replies | email engine uses Apps Script today |
| Google Calendar | two-way per person | later |
| Shopify | Essentials orders, products, stock | connected (read) |
| GoHighLevel | Solutions calls and contacts | connected, plan down |
| OSRM + VROOM (self-hosted) | drive times, route order | to build |
| Open-Meteo / NWS | weather per day and per job | Open-Meteo in use |
| MapLibre + OpenStreetMap tiles | maps, satellite via a free imagery source with attribution (check terms) | to build |
| Web push (VAPID, free) | alerts to founders and crew phones | to build |
| YouTube / Meta / TikTok APIs | Studio channel stats | later |

### 6.7 Phone and offline
PWA installed to the home screen (web push works there on iOS 16.4+). Crew app caches today's jobs, queues photos and status changes offline, syncs when back. Background GPS is not reliable on iOS web apps; "job mode" stamps location on Start/Done only. Live tracking would need a native wrapper and the $99/yr Apple account, so it stays out while the budget is $0 (D14).

### 6.8 Security and roles
Owner, Member, Crew, Viewer, Accountant (read-only books, time-boxed). Membership-based RLS everywhere (existing rule). Owner 2FA. Audit log viewable by owners. No service-role key in anything a user can trigger.

### 6.9 Hosting and reliability
Today: the Windows PC + Tailscale Funnel + guarded auto-deployer. By March (D13): the free cloud setup in section 19; keep the PC as dev box and backup runner; nightly encrypted backups off-site with a monthly restore drill; uptime check with a push alert to both founders.

---

## 7. Paid software we rebuild inside OJ OS (the "reverse engineer" list)

Clean-room only: we study public features, docs, free trials and our own accounts' behaviour; we never copy code, text, assets or private APIs (rules in docs/OJ_OS_MASTER_PLAN.md section 3.2 stay).

| What we rebuild | Paid products it replaces (public pricing seen in research, Nov 2026, approximate) | Where in OJ OS |
|---|---|---|
| Field service core (requests, quotes, jobs, schedule, invoices, client hub, field app) | Jobber (~$29-199+/mo), Housecall Pro (~$59-149+/mo), ServiceTitan (~$245-500/tech/mo, contract) | Inbox, Jobs, Schedule, Customers, Crew app, Portal |
| Quote presentation, good/better/best, follow-ups (pricing stays manual) | ResponsiBid (~$179-229/mo), QuoteIQ (~$30-75/mo) | Quote builder |
| Proposals and e-sign | PandaDoc, DocuSign, Proposify | Quote builder + portal e-sign |
| Accounting, bank feed, receipts, reports | QuickBooks Online, Xero, Expensify, Dext | Money |
| Reviews and referrals | NiceJob (~$75-125/mo), Broadly (~$79/mo), Podium | Growth > Reviews |
| Email marketing | Mailchimp, Klaviyo, Jobber Campaigns | Growth > Campaigns |
| CRM and pipeline | HubSpot, Pipedrive, GoHighLevel pieces | Customers, Growth |
| Routing and dispatch | OptimoRoute, Route4Me, ServiceTitan Dispatch Pro | Schedule |
| Time clock and crew app | Homebase, Connecteam, TSheets | Crew |
| Fleet and equipment | Fleetio | Crew & Gear |
| Photo documentation | CompanyCam | Job page photos |
| Automation | Zapier, Make | Automations |
| BI and AI analyst | Looker/Tableau, Housecall "Analyst AI" | Insight + Ask OJ |
| Team chat and tasks | Slack, Asana, Monday | Side panel Chat, Tasks |
| Scheduling page | Calendly, Cal.com | Solutions demo booking page |
| Online store | Shopify Basic (~$39/mo) | Essentials store engine (section 16) |
| AI receptionist agency console | GoHighLevel agency + SaaS mode, white-label dashboards | Solutions agency OS (section 15) |
Not rebuilt (regulated or not worth it): card processing (Stripe), bank connectivity (Mercury API), payroll tax filing. No SMS (D4).
Rough value: a comparable paid stack for a 2-4 person crew runs well over $500/month.

---

## 8. Feature catalogue and priority

**Season-critical (live by March 1):**
1. New shell, rail, palette, capture, side panel; old navigation and dead pages removed.
2. Design system V2 + the chosen direction across every room.
3. Data spine: customers/properties (exists), jobs + visits, service catalogue + price book, migration of the 190 leads.
4. Inbox with LSA import (API if approved, paste import otherwise) and speed-to-lead.
5. Jobs room + Job page + Schedule (day lanes, week, map, drive times, weather).
6. Quote builder + quote page + e-sign + follow-up cadence.
7. Invoices with Stripe pay links, reminders, payments; deposits.
8. Crew app (today, start/done, photos, checklist, pay) + assignments + commission statements.
9. Customer emails (confirmations, reminders, on my way, done with photos, review request).
10. Money home, bank feed workbench with rules, expenses with receipt photos, P&L.
11. Command with exceptions, brief, horizon.
12. Growth: follow-ups, one rebooking list + spring campaign, reviews, LSA center.
13. Data cleanup done; honest data health.
14. Cloud hosting + backups (D13).

**Next (March to May, in season):** Essentials store migration off Shopify, map outline measuring, route optimise, recurring plans for commercial, Gear and failure log, Rig plan, Insight reports and goals, Ask OJ, Google review sync, Studio channel stats, Solutions clients console (when a client signs).

**Later:** native wrapper + live GPS, Google Calendar two-way, payroll export to Gusto, accountant portal, Essentials ads/ROAS, Wallet passes, voice-first "truck mode", wall display mode for the office.

---

## 9. Roadmap to March 1, 2027 (16 weeks from Nov 16)

Each stage = several small PRs, each merged to main and deployed through the guarded deployer, verified live. Staged SQL only with Oscar's OK. Stage 0 needs no SQL.

| Weeks | Stage | Outcome you can see | Exit check |
|---|---|---|---|
| 1 (Nov 16-22) | 0. Gut + tooling | Install the section 21 skills and REA; junk-data cleanup SQL staged (D15, Oscar runs it); Project 360, Fleet Command, Field log, Job continuity, Dispatch preflight, Commercial estimator, Upgrade register, metrics tab, Team stub, window tabs, Exterior second nav and link tiles removed; disclaimers stripped; AGENTS.md rewritten; dead CSS deleted; find where Jacob's LSA auto-pull and the website booking form write today | No paragraph over 25 words; no browser-local business data; CSS halved; LSA and website feeds mapped |
| 2 (Nov 23-29) | 1. Look | Lakefront tokens + component kit + motion system; Command built first with the horizon - shown to Oscar for a yes before rolling out | Oscar approves Command on desktop and phone |
| 3 | 2. Shell + XP | New top bar, rail (9 rooms), status bar, side panel (chat, activity, AI), palette v2, capture menu, phone bottom bar; OJ XP engine replacing the 3 score systems | Every old route redirects; phone chrome under 110 px; XP awards from real events |
| 4-5 | 3. Spine | Jobs + visits + plans + service catalogue + price book tables (staged SQL), migration of 190 leads with review sheets | Every completed job, booking and lead is in the new model; revenue matches |
| 5-6 | 4. Jobs | Jobs room (board, list, map), Job page, Schedule (day lanes, week, month, map, weather, drive times), recurring plans | Book -> done -> invoice on phone under 60 s |
| 7 | 5. Customers | Customers room, Customer page, Property page (history, photos, equipment), companies, merge tool | One customer page; duplicates queue empty |
| 8 | 6. Quotes | Manual quote builder with suggestions, quote page, e-sign, deposits, follow-up cadence | The three commercial proposals recreated in OJ OS and sent from it |
| 9 | 7. Get paid | Stripe, branded invoice page, reminders, payments, batch invoices, receipts | A real invoice paid by card and one by ACH |
| 10 | 8. Inbox | Inbox on top of Jacob's LSA feed + website bookings + forms + email replies, speed to lead, customer email templates (no SMS) | Every LSA lead since July is in, tagged LSA |
| 11 | 9. Crew | Crew app, assignments, time, commission statements, playbooks, hiring pipeline (many crew in 2027) | The crew member runs a test job end to end on an iPhone |
| 12-13 | 10. Books | Section 14: bank feed rules + bulk post, reconciliation, bills/AP, expenses with receipt OCR, mileage, 1099s, sales tax, partner equity, all reports, closing | 375 bank lines posted; Oct-Jan reconciled; P&L ties to bank |
| 13 | 11. Growth | Follow-ups, one rebooking list + spring campaign, reviews and referrals, LSA center, territory map | Spring campaign drafted and scheduled |
| 14 | 12. Command + Insight | Exceptions, brief, horizon finished; reports, goals, data health, Ask OJ | Command answers "what now" for both founders |
| 15 | 13. Solutions agency OS | Section 15: email engine fix and tests, prospect table, demo booking page, client workspace, call log, monthly client report, Stripe subscriptions, MRR | Email engine gets measured replies; first client could be onboarded end to end |
| 15-16 | 14. Free cloud host | Section 19: Oracle Always Free + Coolify + Cloudflare Tunnel, backups, restore drill; PC stays as fallback | One full week on the cloud box with no incident |
| 16 (Feb 22-28) | 15. Season dress rehearsal | Both founders + crew run a full fake day; fix list burned down | Zero blocker bugs; phone and desktop signed off |

After March 1 ("Next"): Essentials store engine and Shopify migration (section 16), Studio channel stats, map outline measuring, route optimisation.

Buffer: the plan has no slack inside stages; anything that slips moves to "Next", never the dress rehearsal.
Codex: agrees lanes via AGENT_LOG.md before each stage (suggested: Codex on Books/ledger and the Solutions email engine, Claude on look, shell, Jobs, Customers, Crew app, Command).

---

## 10. Data cleanup list (D15: approved by Oscar 2026-11-12; staged as one SQL file by exact id in Stage 0, Oscar runs it)

Test invoice INV-2026-0001 (to Oscar), test consultation ("Testing testt"), test lead "Oscar", "Filler Data", "Duplicate" record (merge), joke-name lead, the offensive test chat message, synthetic commercial project "SYSTEM SAVE VERIFICATION", website spam requests, GoHighLevel "(Example)" deals (hide from screens; delete in GHL when the plan is back), the stale "Truck fund balance 1,995" metric entry, 0-minute auto-ended work sessions, a superseded duplicate booking found on the Exterior calendar (verify), leads named "LSA" / "LSA n/a" / "N/A" / "UNKNOWN" (rename from LSA export where possible).

## 11. Skills, tools and references used for design and build

- Claude skills installed here: frontend-design (direction and anti-template rules, loaded for this plan), ui-ux-pro-max (palettes, font pairings, UX guidelines search), theme-factory, artifact-design, dataviz (chart rules), threejs-* and particles-* (signature moments: horizon, Hyperborea), artifact-diagramming, run, code-review, simplify, security-review.
- Design research MCPs: inspo (real production sites: references used - Bluejack client dashboard's plain-English summary over 4 big numbers, Opal's single hero object + one number on phone, DesignMaestro's command palette), awwwards (motion and 3D references), playwright-video (recorded walkthroughs for reviews).
- Libraries already installed and kept: motion, @number-flow/react, three, lucide-react. Likely additions (license-checked first): cmdk (palette), MapLibre GL, a virtual list, a charting kit, react-pdf or pdf-lib.
- The vetted skills-to-install list is section 21 (GitHub and skills.sh search, Nov 12).

## 12. Risks

| Risk | Answer |
|---|---|
| 16 weeks is tight for this scope | Season-critical list is fixed; everything else is "Next"; weekly visible stage |
| Migration loses or doubles money | Review sheets, totals must match before switch, legacy rows kept read-only |
| Codex and Claude collide | Lanes agreed per stage in AGENT_LOG.md; small PRs; one merge at a time |
| Crew rely on a PC at home | Cloud host by February (D13) |
| Google API approvals slow | Apply in week 1; paste importer is the fallback |
| Pretty but slow | Performance budget in CI (bundle size, first paint) |
| Disclaimer creep returns | Lint on paragraph length; AGENTS.md rewritten |

## 14. Books - the in-depth accounting system (D12)

Goal: OJ OS is the company's books. A CPA can open it (or its export) at year end and find clean, reconciled, documented books for OJ Holdings LLC and each division. Benchmarked against QuickBooks Online Plus/Advanced and Xero; everything below is in scope.

**Foundations (exists: double-entry ledger, invoices, payments, posting function, period locks, chart of accounts seeded with Mercury buckets and division revenue accounts)**
- Chart of accounts editor: types (asset, liability, equity, income, COGS, expense), sub-accounts, numbering, archive (never delete with history), mapping to tax lines (Form 1065 / Schedule K-1 lines) so a tax summary prints.
- Divisions as classes on every line (Exterior, Solutions, Essentials, Studio, Holdings) + optional "location" (city) for job analysis; reports by division.
- Partners' equity: capital and draws per partner (Oscar, Jacob), contributions, the agreed split, an equity roll-forward report; "owner distribution" accounts mirror Mercury 04/05.
- Opening balances wizard (balance sheet as of the start date) and a catch-up mode (the 375 bank lines).

**Money in**
- Invoices (exist) + estimates/quotes linked; recurring invoices for commercial plans; deposits as liabilities until earned (2200 Customer Deposits exists); credit notes and refunds; write-offs (bad debt); customer statements; AR aging (current, 1-30, 31-60, 61-90, 90+).
- Payments: Stripe (fees booked automatically as expense: gross to income, fee to 6xxx Merchant fees, net to Undeposited Funds then to Mercury on payout), checks and cash (Undeposited Funds -> bank deposit grouping), ACH.
- Sales receipts for paid-on-the-spot jobs.

**Money out**
- Bills (accounts payable): vendor, due date, line categories, attach the PDF, pay from Mercury (recorded, not executed), AP aging.
- Expenses: receipt capture (phone photo -> local OCR (Tesseract or the Ollama vision model on the host) -> vendor, date, total, tax -> category suggestion -> job link), card and cash expenses, mileage log (IRS standard rate table kept in Settings; trips entered or stamped by the crew app), reimbursements to a partner who paid personally.
- Vendors: list, W-9 on file, 1099-NEC tracking (crew paid commission as contractors, vendors over the threshold), year-end 1099 report.
- Commission: crew commission accrued when a job is paid (5010 Crew Commission) and cleared when the payout is recorded.

**Bank and card**
- Bank feed (Mercury, read-only) into the categorise workbench: rules (contains / amount / account -> category + division + vendor; auto-apply or suggest), splits, match to existing invoice payments, bills or transfers (transfer pairing exists), "exclude" for duplicates, keyboard flow, bulk post.
- Reconciliation: per account per month, statement ending balance entered, tick-off, difference must be $0, then the month locks (period locks exist); reconciliation reports kept.
- Credit card account (Mercury card, 2000) handled the same way with statement payments.

**Taxes (planning aids; a CPA confirms)**
- Sales tax: Wisconsin 5% + Kenosha County 0.5% = 5.5% (Kenosha 2026, per research); rates by county table; taxable flag per service and product (Essentials collects; whether exterior cleaning services are taxable in Wisconsin is still OPEN - confirm with the WI DOR or a CPA before turning it on); sales tax liability report and filing calendar.
- Income tax: OJ Holdings LLC is taxed as a partnership (Form 1065 federal, Wisconsin Form 3 - to confirm with a CPA); estimated tax set-aside per partner (the 25% Tax Reserve bucket), quarterly reminders, a year-end tax pack (P&L by tax line, balance sheet, fixed asset list, 1099 list, mileage log, home-office or vehicle notes).
- Fixed assets: equipment and the future truck capitalised with a depreciation schedule (straight-line or Section 179 noted for the CPA).

**Reports (each with drill-down to the transaction and export to CSV/PDF)**
P&L (cash and accrual toggle; by month, quarter, year; by division; vs last period; vs budget), Balance sheet, Cash flow statement, General ledger, Trial balance, Journal report, AR aging, AP aging, Sales by customer, Sales by service, Expenses by vendor, Job profitability, Division profitability, 1099 summary, Sales tax liability, Partner equity roll-forward, Budget vs actual, Reconciliation reports, Audit log of every change.

**Controls**
Closing date (lock months after reconciling), no editing of posted entries (reversal only - exists), audit log, accountant role (read-only, time-boxed), monthly close checklist (reconcile all accounts, review uncategorised, review AR/AP, lock), anomaly flags (duplicate payment, unusual vendor amount).

**Planning**
Budgets by account and month, cash forecast (13 weeks: booked jobs + plans + recurring bills), allocation engine (the Mercury split percentages as rules with a "move this week" suggestion; money movement stays manual in Mercury), truck fund and goals.

**Skills that help build it:** finance-skills bundle and month-end-close (alirezarezvani/claude-skills), bookkeeping-automation and statement-reconciler skills (section 21). Benchmark docs: QuickBooks and Xero public help centers (section 20).

---

## 15. OJ Solutions - the agency operating system (D10: go much further in)

What Solutions sells: AI receptionists for local businesses. What the OS must cover: win clients, deliver receptionists, run them, prove value, bill monthly, keep them.

**Acquire**
- Prospect database (821 today) as a real table: filters, saved views, bulk assign, research notes, score (fit + "why them"), source, status history.
- Daily 10 DM quests (keep; fold into the XP system).
- Email engine fix first: 233 sent, 0 replies. Steps: verify reply detection end to end with a seeded test reply; inbox placement test (seed accounts at Gmail/Outlook); check SPF/DKIM/DMARC on ojsolutions.org; personalisation quality review; A/B two subject lines and two openers; send-window and volume tuning; auto-pause a segment after N sends with 0 replies; dashboard of open/reply/bounce by segment.
- Demo booking page (our own Calendly clone): a public page with available 15-minute slots from the founders' calendars, confirmation and reminder emails, no-show tracking.
- Live demo line: a demo receptionist number prospects can call (built on the same engine as clients).
- Proposals and contracts: the Quote builder with Solutions templates (setup fee + monthly plan + per-minute overage), e-sign, Stripe checkout for the setup fee and the subscription.
- Case study: OJ Exterior Care's own line as the first client (dogfood) - real call stats become the sales proof.

**Deliver (per client workspace)**
- Client record: business, industry, hours, services, prices they quote, FAQs, transfer rules, calendar to book into, CRM to push leads to.
- Onboarding checklist: kickoff call, script draft (AI-drafted from their website), knowledge base, test calls, client approval, go-live, 7-day check-in.
- Receptionist config editor: greeting, voice, script, knowledge, booking rules, escalation, after-hours; versioned with notes.
- Engine choice per client: GoHighLevel Voice AI (when the GHL plan is back) or an open-source stack we host (Pipecat BSD-2 or LiveKit Agents Apache-2.0, with a telephony provider and model costs passed through to the client's plan). Decide with the first client; the console works with either through one adapter.

**Run and prove**
- Call log per client: time, caller, duration, outcome (booked, lead captured, transferred, spam), transcript, recording link, sentiment.
- Live health: calls today, minutes used vs plan, failed calls, latency, alerts on errors.
- Monthly client report (auto, branded, emailed + in their portal): calls answered, after-hours calls caught, bookings made, leads captured, estimated revenue saved (their average job value x bookings), top questions.
- Client portal (/p/[token]): their stats, recordings, invoices, a "request a change" form.

**Bill and keep**
- Stripe subscriptions: plans, setup fees, usage overage, failed payment retries, invoices into the books (4100 Setup Fees, 4110 Monthly Fees exist).
- SaaS metrics: MRR, new / expansion / churned MRR, churn rate, LTV, CAC from outreach effort, payback; cohort view.
- Retention: usage drop alerts, QBR reminders, NPS email.

Benchmarks to clone (section 20): GoHighLevel agency view (sub-accounts, snapshots, SaaS mode billing), white-label receptionist dashboards (call logs, transcripts, analytics, rebilling), Calendly, PandaDoc.

---

## 16. Essentials - our own store engine (D11)

Goal: stop paying Shopify (~$39/month) while keeping a store that can restart any time.
- **Recommended: a store module inside OJ OS** (products, variants, inventory, collections, cart, Stripe Checkout, orders, customers, discount codes, shipping rates, Wisconsin sales tax on products, order emails, simple CMS pages) with a public storefront served on ojessentials.store from the same free host. Smallest moving parts, same database, same books.
- Alternative: Medusa v2 (core MIT, modular commerce, Next.js storefront starter) self-hosted. More features out of the box (promotions, regions, returns) but another server to run on a free VM.
- Migration from Shopify: export products, images, customers and order history via the Admin API we already read; recreate URLs (301 redirects for the product handles) so search rankings survive; move the domain DNS last; cancel Shopify after one clean week.
- What we lose and how we cover it: Shopify app ecosystem (dropshipping apps such as supplier sync - confirm how the smart ring is fulfilled), Shop Pay (Stripe Link covers fast checkout), Shopify's built-in fraud screening (Stripe Radar basic is included).
- Use REA on our own Shopify store's admin and storefront traffic (we own the account) to write the behaviour spec for the clone (section 20).

---

## 17. Motion, speed and looks (D1 + "hella motion")

- **Libraries (all free):** Motion (installed) for component and layout animation; GSAP (free for all uses including plugins since Webflow's 2025 change - re-verify the licence page before adding) for timelines, ScrollTrigger and number counters on the signature moments; the native View Transitions API for room-to-room and list-to-record morphs (Next.js supports it; falls back to a crossfade); three.js (installed) for the Lakefront horizon and Hyperborea; Rive or Lottie runtimes (free) for small illustrated states (empty states, success). Official skills exist for GSAP (greensock/gsap-skills) and animation review (emilkowalski/skills).
- **Motion grammar:**
  - Entrances: a room plays one choreographed entrance (header, then the signature, then content in a single 400-600 ms stagger), never per-card fade-ups everywhere.
  - Continuity: opening a job card morphs the card into the Job page (shared element); closing reverses it. Drawers slide from where they were opened.
  - Feedback: every press has a 120 ms response; success states pulse once; money landing (payment received) gets a special moment (number rolls, the horizon water rises).
  - Live data: numbers roll (number-flow), new rows slide in with a highlight that fades in 2 s, presence avatars breathe.
  - Ambient: only the horizon and Hyperborea move on their own, slowly, and pause when the tab is hidden.
  - Reduced motion: everything collapses to opacity swaps.
- **Speed budget (CI-enforced):** route JS under 200 KB gzip, first meaningful paint under 1.5 s on the production build, interactions under 100 ms, 60 fps on animations (transform and opacity only), skeletons on every async view, data cached and revalidated in the background, optimistic updates with undo.
- **Looks:** the design language in section 3 (Lakefront), one signature per room: Command horizon; Jobs - the day's route drawn on the map; Money - water-level cash gauge; Customers - property satellite tiles; Growth - live speed-to-lead dial; Crew - lanes that fill as the day progresses; Insight - one hero chart per report; Solutions - live call waveform; Essentials - product imagery on cream; Goals - Hyperborea.

---

## 18. OJ XP - one progression system for Oscar and Jacob (D3)

Replaces: weekly leaderboard points, Pulse levels and points, Daily 10 XP and levels, Upgrade register levels. Keeps Hyperborea achievements (renamed "summits").
- **Earned only from verified events in the database** (no self-reported points): lead answered in under 5 min (+15), quote sent (+10), quote accepted (+40), job done with after photos (+25), invoice paid (+1 per $10, capped per job), review received (+30), DM sent from the Daily 10 queue (+3, capped 10 a day), email reply received (+20), demo booked (+50), client signed (+250), bank lines posted (+1 each, capped 50 a day), hour worked on the timer (+10, capped 10 a day), task finished (+5, +15 if high priority).
- **Levels:** a smooth curve (each level about 12% more XP than the last), named after Hyperborea camps; level-up gets the one big animation in the OS.
- **Streaks:** daily (any 50 XP), Daily 10 streak, speed-to-lead streak; streak freezes earned weekly.
- **Head to head:** this week Oscar vs Jacob (the current leaderboard idea), all-time, and per season (Exterior season, off-season); weekly winner badge.
- **Quests:** Daily (Daily 10, answer every lead), Weekly (post the bank lines, chase every cold quote), Season (truck fund goal, 50 reviews).
- **Where it shows:** a level ring on each avatar in the top bar, an XP toast on each earning event, the XP room inside Goals (history, quests, badges), weekly recap in the Monday brief.
- **Crew XP (2027):** same engine, crew-only events (on-time start, photos complete, 5-star review on their job), visible to them in the crew app.
- **Anti-gaming:** caps per day, no XP for edits or deletions, reversed XP when an event is undone (job reopened, payment refunded).

---

## 19. Free hosting and free deploys (D13, D14)

Constraint: $0, both founders can build and ship.
- **Recommended target: Oracle Cloud Always Free ARM VM** (as of Aug 2026 reportedly 2 OCPU / 12 GB RAM, down from 4/24 - verify on Oracle's page; capacity can be scarce in some regions; idle instances can be reclaimed, ours is busy daily) running **Coolify** (open-source, self-hosted deploy platform; licence to confirm) which builds and deploys the app on every push to GitHub main, with preview deploys per pull request. Both founders deploy by merging a PR (GitHub is free). A credit card is needed to verify the Oracle account; the Always Free resources are not charged.
- **Domain and HTTPS:** Cloudflare (free plan) DNS + Cloudflare Tunnel to the VM (no open ports), custom domains for the app, the store and customer portals.
- **Database and files:** Supabase stays (free tier limits watched: database size, storage, egress; photos compressed on the phone before upload).
- **Builds:** on the VM (Coolify) or GitHub Actions (free minutes for private repos) producing an image the VM pulls.
- **Backups:** nightly database dump + storage sync to a free off-site bucket (Cloudflare R2 free tier) and the PC; monthly restore drill.
- **Fallback:** the current Windows PC + Funnel + guarded deployer stays working until the cloud box has run a full week without issues.
- Rejected: Vercel Hobby (non-commercial only), Netlify (credits ran out), Render/Fly free tiers (sleep or removed).

---

## 20. Reverse engineering with REA - method and app-by-app clone specs (D18)

### 20.1 What REA is (verified from github.com/morluto/rea, Nov 12 2026)
MIT-licensed MCP server + CLI ("Reverse Engineer Anything") for AI agents. Analyses websites (page structure, scripts, network), saved network captures (HAR), JavaScript/Electron apps (modules, routes, source maps), APIs via recorded traffic, plus native binaries, APKs, WASM and more. It can build a callable test environment from a HAR (`rea environment-build ./session.har ./env`). Install: `npx rea-agents setup` (registers with Claude Code; restart after), optional `npm install --global rea-agents`. Skill: `reverse-engineer-anything` on skills.sh. Stated scope: lawful research, interoperability, preservation, and software you own or are authorised to examine; no cracked tools or licence bypass.

### 20.2 The lawful method we use for every app
1. **Read the terms first.** Many SaaS terms forbid reverse engineering their app or using a trial to build a competing product. If the terms forbid it, we do not capture or analyse their app's traffic or code. We still use everything public.
2. **Public evidence first (always allowed):** public help centers (Jobber, Housecall Pro, QuickBooks, Xero, GoHighLevel and Shopify all publish detailed help docs describing every screen, field, status and email), public API documentation, public marketing pages, public videos and webinars, review sites. REA's website analysis on public pages for structure and flows.
3. **Our own accounts (allowed for interoperability):** Shopify, GoHighLevel, Mercury, Google, Stripe - capture HAR of our own sessions, run REA to map behaviour and data shapes, so our clone and our connectors match exactly.
4. **Our own app:** REA on OJ OS itself (bundle routes, release exposure audit, HAR-based test environments for agents) - this is where it gives the most day-to-day value.
5. **Output for each app:** `docs/specs/<app>.md` - screens, fields, states and transitions, automations, emails, edge cases, each line tagged with its evidence source and date; then OUR implementation from the spec. No copied code, text, icons, images or trade dress.

### 20.3 App-by-app clone specs (what we take, exactly, and where it lands)

| App | Evidence sources (20.2) | Features we implement (exact list) | OJ OS home |
|---|---|---|---|
| **Jobber** | Help center, feature pages, public API docs | Requests (online intake, manual entry, on-site assessment); Quotes (line items, optional add-ons, markups, deposits, approvals, automated follow-ups); Work orders (scheduling, details, checklists, tracking); Schedule (calendar, map, routing, visit reminders); Complete job (on-my-way message, job forms, time tracking, location timers, follow-ups); Client manager (details, history, communication history, leads); Client Hub (request work, approve quotes, view appointments, pay, refer); Invoices (quick-create, reminders, batch, follow-ups); Payments; Reviews (automated Google review requests, AI-drafted replies); Email campaigns (segments, automated campaigns, reports); Referrals (credits, tracking links); Job costing (profit bar, materials, labour, expenses); Team (permissions, GPS waypoints, time tracking, checklists); Real-time notifications (push, activity feed, message center) | Inbox, Quotes, Jobs, Schedule, Customers, Portal, Money, Growth, Crew |
| **Housecall Pro** | Help center, feature pages | Pipeline board with lead-to-job automations; Recurring service plans; Property profiles (history and equipment per property); Drag-and-drop dispatch; Job inbox; Price book (flat-rate, customer-facing); Sales proposals with photos; Checklists; Job photo app; Postcard/email/campaign marketing; Customer portal (past jobs, approvals, payments); In-app chat with crew; Reporting dashboards; Time tracking; AI analyst/coach | Growth, Jobs, Customers, Schedule, Insight |
| **ServiceTitan** (Pro modules) | Public product pages, reviews | Dispatch Pro (weekly board, one-click route optimisation, map planning, skill matching); Pricebook Pro (digital price book on the phone); Marketing Pro (segments, ROI per campaign); Field Mobile (forms, photos, estimates, payments in the field); Contact Center (call outcomes) | Schedule, Quotes, Growth, Crew app |
| **ResponsiBid / QuoteIQ** | Feature and pricing pages | Good/better/best packaging; upsells by property facts; follow-up by pipeline stage; quote page presentation (pricing stays manual per D7) | Quote builder |
| **CompanyCam** | Public pages, help docs | Photo timeline per job and property, before/after pairs, annotations (arrows, text), photo reports to customers, tags | Job page, Customer page |
| **QuickBooks Online / Xero** | Help centers | Everything in section 14 | Money |
| **Expensify / Dext** | Public pages | Receipt capture, OCR fields, auto-categorise, attach to transaction | Money > Expenses |
| **NiceJob / Broadly** | Product pages | Review request sequences until response, review dashboard, AI replies, referral invites after positive reviews, referral widget and credits | Growth > Reviews |
| **Mailchimp / Klaviyo** | Help docs | Audiences and segments, templates, campaigns, automations, unsubscribe and compliance, reports | Growth > Campaigns |
| **Calendly / Cal.com** | Docs (Cal.com source is public - check licence before reading code; behaviour only) | Availability rules, buffers, booking page, confirmations, reminders, reschedule/cancel links, no-show | Solutions demo booking |
| **PandaDoc / DocuSign** | Help docs | Proposal templates, e-sign with audit trail (signer name, time, IP, document hash), signed PDF | Quote builder, Solutions |
| **GoHighLevel** (our account) | Our own account sessions (REA on HAR), help docs | Agency view of sub-accounts, snapshots (template a client setup), conversation inbox, Voice AI config, workflows, SaaS-mode rebilling | Solutions agency OS |
| **White-label AI receptionist consoles** (Retell partners, My AI Front Desk, Trillet) | Public pages | Client dashboards (call logs, transcripts, bookings, analytics), agency view, rebilling | Solutions |
| **Shopify** (our account) | Our own admin and storefront traffic (REA), Admin API docs | Products, variants, inventory, collections, cart, checkout, orders, discounts, shipping, taxes, customer accounts, order emails, CMS pages | Essentials store |
| **Fleetio** | Public pages | Assets, service schedules, work orders, failures, parts, costs per asset | Crew & Gear |
| **Homebase / Connecteam** | Public pages | Clock in/out, timesheets, approvals, schedule, crew chat, training checklists | Crew app |
| **Linear** | Public docs | Command palette, keyboard-first lists, cycles, triage, issue views | Tasks, palette |
| **Odoo** (completeness checklist) | Public app list | Coverage check: CRM, Sales, Subscriptions, Accounting, Invoicing, Expenses, Documents, Sign, Inventory, Purchase, Maintenance, Employees, Recruitment, Time Off, Fleet, Marketing Automation, Email Marketing, Social, Surveys, Project, Timesheet, Field Service, Helpdesk, Planning, Appointments, Discuss, Approvals, Knowledge, Website, eCommerce, Studio | Every row we do not need is marked "not needed" with a reason |

### 20.4 Gaps the comparison found in the earlier plan (now added)
- Recurring service plans with auto-generated visits and invoices (Housecall Pro, Service Autopilot) -> Jobs > Plans.
- Property profiles with equipment and service history (Housecall Pro) -> Property page.
- Batch invoicing for commercial months (Jobber) -> Money > Invoices.
- Location timers and GPS waypoints at start/finish (Jobber) -> Crew app stamps.
- Photo annotations and photo reports (CompanyCam) -> Job page.
- Hiring pipeline, time off and training (Odoo HR, Connecteam) -> Crew (needed with many 2027 crew).
- Helpdesk-style customer requests after the job (Odoo Helpdesk) -> Inbox "customer issue" type with SLA.
- Knowledge base of playbooks (Odoo Knowledge, Notion) -> Crew > Playbooks and Settings > Templates.
- Approvals (Odoo Approvals) -> owner approval on expenses over a limit and on discounts.
- Purchase orders for supplies (Odoo Purchase) -> Gear > Supplies (simple reorder list).

---

## 21. Skills to install (D19) - vetted list

Rule before installing any skill: read its SKILL.md and scripts (third-party code runs with our permissions). alirezarezvani/claude-skills ships a `skill-security-auditor`; use it on everything else.

**Already installed here:** frontend-design, ui-ux-pro-max, theme-factory, artifact-design, dataviz, threejs-* (9), particles-*, skill-creator, mcp-builder, docx/pdf/pptx/xlsx, feature-dev, code-review, pr-review-toolkit, security-review, simplify, run, supabase, supabase-postgres-best-practices, marketing set (copywriting, cro, seo, emails, ads, analytics, attribution and ~40 more), graphify, ponytail, hookify, commit-commands.

**Install for this project (recommended):**
| Skill or collection | Why | Install |
|---|---|---|
| REA - reverse-engineer-anything | D18 | `npx rea-agents setup` |
| obra/superpowers (15 skills: TDD, systematic debugging, verification before completion, writing/executing plans, parallel agents, worktrees, code review) | build discipline for a 16-week build | `/plugin install superpowers@claude-plugins-official` |
| mattpocock/skills (27: grill-me, to-spec, to-tickets, implement, tdd, domain-modeling, codebase-design, diagnosing-bugs, handoff, writing-for-agents) | turning this plan into specs and tickets; handoffs between Claude, Codex and Jacob | `claude plugin install mattpocock-skills@claude-plugins-official` |
| vercel-labs/agent-skills (react-best-practices, web-design-guidelines, composition-patterns) | React/Next.js performance and UI rule audits | `/plugin marketplace add vercel-labs/agent-skills` |
| Next.js official skills | Next 16 specifics | `npx skills add vercel/next.js` |
| greensock/gsap-skills | timelines, ScrollTrigger, React, performance | `/plugin marketplace add greensock/gsap-skills` |
| emilkowalski/skills (review-animations, improve-animations) | motion quality | `npx -y skills add emilkowalski/skills --skill review-animations --agent claude-code` |
| pbakaus/impeccable (24 design commands: polish, audit, critique) | design QA vocabulary | `/plugin marketplace add pbakaus/impeccable` |
| Leonxlnx/taste-skill | premium frontends + multi-width browser checks | `npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"` |
| nutlope/hallmark | anti-generic design audit and redesign | `npx skills add nutlope/hallmark` |
| Dammyjay93/interface-design | keeps design decisions in a system file across sessions | `/plugin marketplace add Dammyjay93/interface-design` |
| accesslint/claude-marketplace | WCAG 2.1 AA audits | `/plugin marketplace add accesslint/claude-marketplace` |
| LovroPodobnik/refactoring-ui-skill, wondelai/skills (ux-heuristics) | hierarchy and usability audits | clone into ~/.claude/skills |
| anthropics/skills webapp-testing, lackeyjb/playwright-skill | browser tests of every flow | `/plugin marketplace add anthropics/skills` |
| supabase/agent-skills | Postgres and RLS rules (partly installed) | `npx skills add supabase/agent-skills` |
| stripe/agent-toolkit (stripe-best-practices) | correct Stripe payments, subscriptions | check the repo, then install |
| alirezarezvani/claude-skills bundles: engineering-advanced-skills (database-designer, migration-architect, ci-cd-pipeline-builder, performance-profiler, observability-designer, dependency-auditor, env-secrets-manager, skill-security-auditor), finance-skills (month-end-close, financial analyst, saas-metrics-coach), business-growth-skills, product-skills (design-qa) | books, Solutions SaaS metrics, migrations, CI, perf | `/plugin marketplace add alirezarezvani/claude-skills` then `/plugin install <bundle>@claude-code-skills` |
| bookkeeping skills (NeverSight bookkeeping-automation, lyndonkl statement-reconciler, anthropics knowledge-work-plugins reconciliation) | section 14 | review, then install |
| remotion-dev/skills, heygen-com/hyperframes | Studio videos and app walkthrough videos | `npx skills add remotion-dev/skills` |
| trailofbits/skills | security review of payments, portal, RLS | `/plugin marketplace add trailofbits/skills` |
| vercel-labs/skills find-skills | discovering more skills later | `npx skills add vercel-labs/skills` |
| ComposioHQ app automations (Gmail, Google Calendar, Stripe, Supabase, Shopify, YouTube, Instagram) | only if we adopt Composio's MCP; otherwise skip | see repo |

Big catalogues to browse later: ComposioHQ/awesome-claude-skills, travisvn/awesome-claude-skills, skills.sh leaderboard (300+ ranked), alirezarezvani/claude-skills (415 skills), wshobson/agents (94 plugins).

---

## 22. Gap review (2026-11-12, evening) - what was missing, now added

**Still open (each blocks one stage, not the whole plan):**
| Item | Blocks | Who |
|---|---|---|
| LSA engine go-live (its dry run, backup, SQL, backfill, sheet archive, poller - docs/LSA_GO_LIVE.md) | Inbox (week 10) | Jacob + Oscar |
| How the ojexteriorcare.com booking form delivers bookings (email? Supabase table? Google Sheet?) | Inbox, Jobs | Oscar/Jacob |
| Employee portal audit (sign in as an employee) | Crew app (week 11) | Oscar |
| Stripe account opened | Get paid (week 9) | Oscar |
| Google Ads API developer token + Business Profile API applications | LSA via API, reviews | Oscar/Jacob |
| Is exterior cleaning taxable in Wisconsin? | Sales tax on invoices | CPA or WI DOR |
| Illinois coverage (an Illinois commercial job is booked for Nov 17) | Out-of-state jobs | Oscar/Jacob |
| Oracle Always Free limits and capacity in our region | Free host (week 15) | Claude (verify when we get there) |

**Missing from the plan until now (added to scope):**
1. **Photo storage on a $0 budget.** Supabase's free tier has about 1 GB of file storage; before/after photos for a season will pass that. Phone compresses to ~200 KB WebP before upload, thumbnails generated, and photos stored in Cloudflare R2's free 10 GB tier; the database keeps only references. Watch the 500 MB database limit too (usage card in Settings > System).
2. **Two email lanes.** Customer email (quotes, invoices, reminders, "on my way") goes from the Exterior domain; the Solutions cold-email engine stays on ojsolutions.org only, so cold outreach can never hurt invoice deliverability. Daily sending limits per Google account tracked.
3. **Calls.** Every phone number is a tap-to-call; after a call, a one-tap "log call" sheet (outcome, note, next step) so calls show on the customer timeline. LSA call leads link their recording when the feed provides it.
4. **Manual texting stays manual.** No automated SMS (D4). Optional: a "Text from my phone" button that opens the phone's own Messages app with a template filled in and logs that it was opened. Oscar to say yes or no.
5. **Legal paper.** Service terms and property-damage clause on every quote, photo-use consent (for marketing before/afters), privacy note on the customer portal, unsubscribe + address on every campaign (exists for the email engine), crew contractor agreement + W-9 in the Crew room, insurance and COI expiry reminders.
6. **Monitoring for free.** Error tracking (a free hosted tier or self-hosted GlitchTip) and an uptime monitor (self-hosted Uptime Kuma) with push alerts to both founders.
7. **Tests that protect money.** Playwright end-to-end tests for the ten core flows (lead -> quote -> accept -> book -> start -> done -> invoice -> pay -> post -> report) run in CI on every PR, beside the existing unit and PGlite permission tests.
8. **Feature flags and rollback per stage.** Each new room ships behind a flag; the old page stays reachable until the new one is signed off, then is deleted.
9. **Rebuilding Aug-Sep history.** Jobs done in August and September were never logged. Match Mercury deposits from those months to LSA leads and customers in a review sheet so the season's revenue is complete.
10. **Off-season revenue in the system.** The price book and Growth support winter services if you add them (holiday lighting installs, gutter cleaning, commercial window contracts in winter, prepaid spring plans). Business decision for Oscar and Jacob; the plan just makes room.
11. **Crew onboarding.** "Add to Home Screen" install steps for iPhone (needed for push notifications), a 60-second first-run tour in the crew app, playbook per service.
12. **Codex reads V2.** The rewritten AGENTS.md points every agent at docs/OJ_OS_V2_PLAN.md and the audit, so Codex builds to the same plan.
13. **Production timing baseline.** The audit measured the dev server; Stage 0 measures the live production build first so speed targets have a real starting point.
14. **What's new.** A short changelog card on Command after each release so Jacob sees what changed without asking.
15. **Free AI on a free host.** Heavy local models run on the PC (Ollama) over the private network; the cloud box calls them when the PC is on and falls back to free hosted tiers for non-sensitive text only.

**Is the plan ready?** Direction, scope, design language, data model, rooms, systems and the 16-week order are settled. Each stage is turned into exact tickets at its start (mattpocock to-spec / to-tickets) from this plan - by design, so the tickets match the code as it is that week. Stage 0 (gut + tooling + cleanup SQL) does not depend on any open item and can start the moment Oscar says go; nothing in it touches LSA.

---

## 23. Sources (research Nov 12, 2026; vendor pages and reviews, prices approximate)

- Jobber features: https://www.getjobber.com/features/ ; Jobber vs Housecall: https://getjobber.com/comparison/jobber-vs-housecall-pro/ , https://fieldservicesoftware.io/comparisons/housecall-pro-vs-jobber/
- Housecall Pro features: https://www.housecallpro.com/features/
- ServiceTitan lineup and pricing estimates: https://www.schedulingkit.com/reviews/servicetitan-review , https://www.permitflow.com/blog/complete-guide-servicetitan
- ResponsiBid: https://responsibid.com/features/ , https://responsibid.com/pricing/
- QuoteIQ (vendor claims): https://myquoteiq.com/best-satellite-measuring-software-cleaning-businesses-2026/
- NiceJob / Broadly: https://get.nicejob.com/product/referrals , https://www.krowdbase.com/compare/broadly-vs-nicejob
- QuickBooks 2026 features: https://quickbooks.intuit.com/r/product-update/quickbooks-improvements-2026/
- LSA leads via Google Ads API: https://developers.google.com/google-ads/api/docs/campaigns/local-service-campaigns , https://developers.google.com/local-services-ads/guides/reporting
- iOS PWA limits: https://www.magicbell.com/blog/pwa-ios-limitations-safari-support-complete-guide , https://www.forrester.com/blogs/web-push-comes-to-ios-but-web-apps-are-still-second-class/
- Open-source licenses: https://www.activepieces.com/docs/about/license , https://marmelab.com/blog/2026/01/09/open-source-crm-benchmark-2026.html
- White-label AI receptionist consoles: https://www.retellai.com/use-cases/white-label-ai-receptionist , https://trillet.ai/blogs/ai-receptionist-white-label-pricing
- Dashboard design trends: https://www.buildmvpfast.com/blog/linear-aesthetic-tokens-density-keyboard-first-ux-2026 , https://saasui.design/blog/7-saas-ui-design-trends-2026
- REA: https://github.com/morluto/rea
- Skills: https://github.com/anthropics/skills , https://github.com/ComposioHQ/awesome-claude-skills , https://github.com/travisvn/awesome-claude-skills , https://skills.sh , https://github.com/alirezarezvani/claude-skills , https://github.com/obra/superpowers , https://github.com/mattpocock/skills , https://github.com/wshobson/agents , https://github.com/greensock/gsap-skills , https://pasqualepillitteri.it/en/news/576/claude-code-skills-design-uiux-guide , https://supabase.com/blog/postgres-best-practices-for-ai-agents , https://www.remotion.dev/docs/ai/skills
- Odoo apps (completeness checklist): https://www.odoo.com/page/all-apps
- QuickBooks Online plans: https://quickbooks.intuit.com/products/ , https://fitsmallbusiness.com/quickbooks-online-features/
- Kenosha sales tax 5.5%: https://www.salestaxhandbook.com/wisconsin/rates/kenosha-county , https://www.avalara.com/us/en/taxrates/state-rates/wisconsin/counties/kenosha.html
- Oracle Always Free changes: https://buttondown.com/freetierwatch/archive/oracle-quietly-halved-its-famous-free-tier-and/ , https://terminalbytes.com/oracle-cloud-free-tier-changes-2026
- Medusa / Saleor / Vendure: https://www.pkgpulse.com/guides/medusa-vs-saleor-vs-vendure-headless-ecommerce-2026 , https://ecommerceguide.com/platforms/medusa/
- GoHighLevel AI features: https://rsla.io/blog/gohighlevel-updates-2026 , https://netpartners.marketing/gohighlevel-ai-tools-automate-content-conversations-and-campaigns/
- Service Autopilot (recurring routes): https://fieldservicesoftware.io/software/service-autopilot/
