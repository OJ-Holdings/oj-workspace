# OJ OS V2 - Full System Audit (2026-11-12)

Author: Claude Code, with Oscar. Live data, read only (signed in as Oscar, local dev server on main a883a3b).
Purpose: a complete map of every page, tab, button and where it leads, plus what is wrong with each,
so the V2 overhaul plan (docs/OJ_OS_V2_PLAN.md) can be exact. Nothing was saved, booked or sent during the walk.

Legend: KEEP (works, keep the idea), REBUILD (idea right, execution wrong), CUT (delete), FOLD (merge into another page), DEAD (broken or empty).

---

## 0. The route tree (from code)

Everything inside the app is one client app mounted at `/workspace/[[...slug]]` (live) and `/preview/[[...slug]]` (sample data).
`src/components/app/App.tsx` decides the page from the URL parts.

```
/                         landing (signed out)
/login, /auth/password, /auth/recovery, /setup, /join/[token], /strathos-link
/p/[token]                customer portal page (proposal / invoice link for customers)
/employee                 employee portal (crew)  /employee/join/[token]
/workspace/team           team and invitations (server page)
/workspace/employees      employee accounts (server page)
/workspace/invoices/[id]  printable invoice
/workspace/proposals/[id] printable proposal
/workspace/...            THE APP:
  (root)                  Today / Command  (HomeView)
  /pulse                  owner Pulse activity (owner + live only)
  /calendar               Schedule (CalendarView)
  /tasks                  "Crew" in the rail, but it is the Tasks board (BoardView + SuggestedWork)
  /growth                 Growth (GrowthView)
  /finance                Money (FinanceView)
  /invoices               Invoices (InvoicesView)
  /analytics              Insight (AnalyticsView)
  /businesses             Businesses index (4 tiles + Oscar Jacob studio preview)
  /summit                 Hyperborea (founders only)
  /customers              Customer directory (CustomersView: Directory | Commercial)
  /proposals              Proposals
  /books                  Bank to books (owner)
  /rig                    Truck plan
  /quality                Data quality
  /files                  Files
  /messages               Messages
  /team                   Team stub page -> link to /workspace/team
  /settings               Settings
  /crm                    Leads and CRM (no nav entry; reachable by URL)
  /tools/fleet            Fleet Command (browser-local)
  /tools/systems          Systems Health & Releases
  /tools/content-preview  Oscar Jacob studio read-only sample
  /tools/*                anything else falls back to Today
  /b/<venture>/<tab>      business rooms: exterior, solutions, essentials, content
```

Business room tabs (VentureView.tsx):
- exterior: overview(Command) board leads customer estimate intake bookings field money calendar projects commercial jobs door-knocking quotes activity upgrades settings metrics documents
  - Exterior has its OWN second nav (ExteriorCommandNav): Command / Customers / Operations / Intelligence + "Full directory" dropdown with 14 links.
- solutions: overview(Command) dms(Daily 10) email outreach(Prospects) warm consultations(Website requests) clients calls leads(Contacts) money metrics board documents
- essentials: overview board leads money metrics documents orders products inventory
- content: overview studio board money metrics documents

Rail (Shell.tsx): Today, Jobs(/b/exterior/bookings), Customers(/b/exterior/leads), Schedule, Crew(/tasks), Growth, Money, Invoices, Insight | Businesses, Hyperborea | More: Fleet & Equipment, Customer directory, Proposals, Bank to books, Truck plan, Data quality, Files, Messages, Team, Settings, System status.

Note: the rail "Customers" goes to Exterior leads, while "Customer directory" under More goes to /customers. Two customer pages.
Note: the rail "Crew" opens the Tasks board, not anything about crew.

---

## 1. Shell (frame around every page)

Top bar, left to right: rail toggle (OJ mark) | company switcher | breadcrumb "OJ HOLDINGS / OJ OS" + page name | search (Ctrl K) | Start timer | bell | avatar + role | sign out.
Under it: window-tab strip, then a "Team at work" presence strip (+ button), then the page. Bottom: status bar (Live, jobs today, tomorrow, open tasks, clock "Thu 4:13 PM Chicago", OJ OS). Floating: chat bubble and a gold + button.

| Element | What it does | Verdict / notes |
|---|---|---|
| Company switcher | Menu: OJ Holdings, Exterior Care, Solutions, Essentials, Oscar Jacob. Re-themes and scopes. | KEEP idea. Works. Menu is plain; no figures per company. |
| Search (Ctrl K) | Modal. Typing "deb" found 1 booking only. Quick actions exist (new lead, book a job, record expense, new task). | REBUILD. Only bookings matched; no customers, invoices, tasks, files or pages in results, no recent items, no action language. Must become the main way around (Raycast / Linear style). |
| Start timer | Starts a work session (not clicked: it writes data). | KEEP, but the history shows many "0m Auto-ended" sessions: the timer creates junk sessions. |
| Bell | Notifications panel: newest item 6 days old, yellow warning "Some sources aren't connected; this list may be incomplete", links "Exterior website inbox" and "Open full Pulse". | REBUILD. Stale; misses today's events (Today shows "Email engine sent 9 emails 4h ago", the bell does not). Warning is noise. |
| Sign out icon | Signs out (not clicked). | Move into an avatar menu; one mis-click logs you out today. |
| Window tabs strip | A new tab opens for EVERY page visited and they persist (after a short walk: Hyperborea, Fleet & Equipment, Solutions, Essentials, System status, Today, Jobs & Bookings, Customers & Leads, Exterior Care x3). Duplicates. Shown on phone too. | CUT, or rebuild as user-pinned tabs only. |
| Team at work strip | "1 online" and a + button. A full row on every page. | FOLD into the top bar as avatars with a live dot. |
| Status bar | Live dot, counts, clock. | KEEP; most OS-like piece. Add running timer, sync state, next-job countdown. |
| Chat bubble | Small founder chat panel, one thread. | REBUILD as a side panel: threads per business and per job, mentions, attachments, read state. |
| Gold + button | Opens the New task dialog only. | REBUILD as quick capture (lead, job, expense, photo, note, task, time). On phone it is the main button. |
| Rail active state | On Customer 360 (/b/exterior/customer) the rail highlights Businesses, not Customers. | BUG. |
| Rail labels | "Crew" opens the Tasks board. "Customers" opens Exterior leads while "Customer directory" (More) opens a different page. | REBUILD the information architecture. |

Load time: Exterior pages show a blank area under the Exterior header for 8 to 15 s on the dev server ("Connecting shared updates..."). Needs skeletons and a production-build timing check.

## 2. Today / Command (/workspace)

Content (live, Nov 12): greeting "Good day, Oscar"; chips 0 jobs today / 0 tomorrow / 8 overdue tasks; quick row Add a lead / Book a job / Record expense / New task; Jobs card (today, later this week, other calendar events); tiles Open tasks 14, In this month $275, In the bank $1,942 (9 Mercury accounts), Out this month $0; Winter plan (Spring rebooking 42 customers, $3,509 if 25% rebook; Truck fund; Open quotes 16 worth $5,200); Act now (2 leads waiting 30+ min, 13 quotes going cold, 1 invoice overdue $422, 17 finished jobs with no revenue); This month (revenue, jobs done 1, average job, owed $422, close rate 52%, pipeline counts); Weather ahead (7 days, freeze flag); Needs you (5 overdue tasks); Work truck fund card; Company Pulse (1 item); weekly leaderboard (points = hours + 3 per task) with a Sessions and history modal.

Findings:
- DATA CONFLICT: Winter plan says truck fund "$1,995 of $20,000"; the Work truck fund card on the same page says "$1,880 ... read from Mercury". Two numbers for one fact (one is a stale manual log).
- Layout: two columns of very unequal height. The left column ends after the Jobs card, leaving a big empty black void beside 4 screens of right-column cards. Page is about 2,900 px tall.
- "Add a lead" does not open a dialog here: it navigates to /b/exterior/leads?new=1 and the form appears only after the Exterior page loads (8+ s blank on dev). Book a job and Record expense also route away.
- New lead form: name, phone, address, service (free text), quote, lead source (DEFAULTS TO "Door to door" though LSA is the main source), notes, "Book a job now". No email, no service picker, no price book, no property type.
- Act now is the best idea on the page (exceptions with a fix). KEEP and make it the core of Command.
- Leaderboard: KEEP (it motivates) but it is large; its history is full of 0-minute auto-ended rows.
- Weather: KEEP, attach to jobs (rain or freeze on a booked day = warning on that job).
- Missing for an OS home: today's route and map, cash trend, what Jacob is doing, deadlines (proposal expiry, LSA disputes, invoices due), a daily brief.

## 3. Customers (rail) = Exterior leads (/b/exterior/leads)

Header: the Exterior second nav (ATLAS / FIELD SERVICES DIVISION; Command / Customers / Operations / Intelligence; Full directory). Sub-tabs Pipeline | Directory.
Pipeline: "Open pipeline $12,460 quoted on open leads, not money in"; tiles New 2, Follow-up 16, Quoted 13, Booked 12, Missing job figures 62; collapsible Rebooking list (20 not served in 5+ months); "Customer workbench 190 visible of 190 loaded" with Website intake, Tag lead sources, New lead; search; status chips (All 190, New 2, Contacted 8, Following up 8, Booked 12, Completed 77, Closed 83); toggle Customer cards / Compact table.
Every card repeats: name, added date and source, status pill, "Requested service", "Entered quote, not paid", phone, address, status dropdown, Customer 360, Estimate, Book job / Book again, Edit details, Add/Edit job figures.

Findings:
- 190 records rendered as one endless list of big cards (no paging, no virtual list). "Entered quote, not paid" printed on every card.
- Compact table: rows are NOT clickable and have no actions (dead-end table). Service and Source columns wrap badly.
- Data quality on screen: names like "LSA", "LSA n/a", "N/A", "UNKNOWN", "Duplicate", a joke name, a test lead named "Oscar"; same phone on two records; most October leads tagged "Other" though they came from LSA.
- "Missing job figures 62" here vs Today's "17 finished jobs with no revenue": two measures of one problem, different numbers.
- Leads, customers and jobs are one row with a status. There is no separate Job object.

## 4. Customer 360 (/b/exterior/customer?lead=id)

Content: breadcrumb, avatar letter, name, "Completed, from Local Services Ads"; buttons Book service, Build estimate, Update customer, Add job figures, Call customer; tiles Quote, Bookings, Paid, Profit ("Unknown"); Details (address, phone, service, status, notes, Open in Customers); Jobs list (each booking, CONFIRMED); History (booking confirmed / job completed / record updated / lead added); Possible duplicates (a big empty card when none).
Findings:
- Page fades in dim and stays grey for about 2 s.
- Sample record: 2 CONFIRMED bookings (Nov 3 and Nov 9) for one completed job; the earlier one was probably moved, but both read CONFIRMED.
- Missing: photos, invoices, payments, messages and emails, property details (stories, sq ft, window count), map or satellite view, tags, lifetime value, next service due, review status.

## 5. Customer directory (/customers) - a SECOND customer system

Tabs Pipeline | Directory | Commercial (Pipeline links back to /b/exterior/leads).
Directory: banner "5 jobs not in the directory yet. Sync builds a customer..." + Sync customers; tiles Customers 182, Repeat 1, Due to rebook 0, Lifetime revenue $20,050; chips Everyone / Repeat / Top 20 / Due to rebook / Open job 25 / No usable phone 38; rows (name, address, jobs, revenue, next due = job date + 1 year); Show 40 more.
Row click: dialog with Contact (name, phone, email, type, notes, Save contact), Properties (address, gate/pets/access, water source, surfaces and what worked, Save property, Add), Jobs, "Merge a duplicate into this customer".
Commercial: "The companies we work for"; tiles Companies 3, Service sites 2, Sites on a recurring rhythm 0, People 2; three company cards; Add a company. Company profile: logo, name, industry, sites with crew note ("Need 600ft garden hose"), Book here, People, Notes ("ACH"), "Work and money: Link a record" (nothing linked), "Linked commercial projects" ATLAS block.
Findings:
- THREE rebooking numbers for one idea: Today 42 past customers to call; Exterior leads 20 not served in 5+ months; directory Due to rebook 0. Must be ONE list.
- Two customer profiles: Customer 360 (lead page) and this dialog (customer record with properties). Different fields in each.
- The directory needs a manual "Sync customers" to pick up new jobs. Should be automatic.
- Data: "Filler Data", "Duplicate", "na" addresses, 38 with no usable phone.
- The largest open commercial proposal ($39,400) has no company here. A commercial visit booked for Nov 21 ($2,750) has a company profile that shows nothing linked: bookings are not tied to companies.
- The company profile is one of the nicer screens. KEEP the look, cut the "Linked commercial projects" block.

## 6. Exterior Care home (/b/exterior) "Command"

Order: Exterior second nav; hero "Exterior Care" + Book a job, New lead, Estimates, Field reports, Website requests, Commercial; "Updated 4:13 PM" + refresh; 4 tiles: Recorded job revenue $20,050 (60 of 77 have revenue), Quoted upcoming visits "Unknown", Unbooked lead quotes $5,200, Known job contribution $3,803 (15 jobs have revenue and cost); Google LSA card (spend and lead count inputs); Scheduled jobs with tabs Schedule | Acquisition; "6 open shared tasks, 4 overdue - Open mission board"; Needs attention ("Recorded as new; response and follow-up state need operator review", "1 more recorded issues"); Revenue by month (Jun-Nov, Aug and Sep "?"); Where customers come from (Door to door 133, Other 27, Referral 12, LSA 8, Website 4, Phone 3); 6 link tiles (Customers, Field reports, Commercial, Fleet, Money, Jobs and revenue); "Source coverage".
Findings:
- "Quoted upcoming visits: Unknown" while the list below shows the quotes.
- Revenue chart starts in June; April ($450) and May ($3,755) missing.
- Lead sources: LSA 8 of 190 though LSA is the main source. Tagging is broken at entry (default "Door to door"; many "Other" whose notes say LSA).
- Evidence-era copy: "mission board", "operator review", "recorded issues", "Source coverage".
- The 6 link tiles repeat navigation that already exists twice.
- KEEP: revenue by month (fix the range), lead-source breakdown (fix the data), LSA card (automate it).

## 7. Jobs (rail) = /b/exterior/bookings

Top: "Jobs" + Book commercial client + Book a job; tiles Upcoming 8, Confirmed 8, Quoted value "Withheld", Bookings this month 10; filter tiles All upcoming 8 / Today 0 / Next 7 days 4 / Awaiting approval 0 / Past 41 / Denied 0; collapsible "Heads-up for upcoming jobs"; "Job workbench 8 matching records" + View calendar + Job cards / Compact table.
Each job card: date and time, name, Confirmed, Requested service, "Entered quote (not paid)", address, "Crew: Not assigned in workspace", and 9 buttons: Open job, Customer record, Field log, Call, Directions, Edit job, Reschedule, Assign crew, Cancel.
Heads-up (DispatchPreflight): "DISPATCH / SOURCE-BASED PREFLIGHT - See what could disrupt the next job"; tiles Scheduled records, Requires source review, Overlapping windows ("Capacity caution, not proof of conflict"), Attributable quoted work "Withheld"; rows with "Original lead quote for this visit: Withheld - no acceptance or payment inferred", "Lead quote cannot safely be attributed to this particular visit", Review / Field sheet / Customer / Call / Assign action; footer "Crew, vehicle and insurance readiness are not verified".
Open job = the Job sheet dialog (GOOD): name, date, status, service, quote, address, phone; Call, Directions, Customer record, Proposal, Invoice this job; Money (Customer paid + "Use the $400 quote", Job costs by type + Add cost, Profit); Notes; Photos (Before / After / Other, Take or add photo); History; "Crew, field and closeout details"; Mark complete and save; Save figures.
"Crew, field and closeout details" expands the ATLAS JobContinuity block (Oscar's screenshot): "One job. One source of truth." 6 cards (Customer and site, Estimate and approval, Booking and timing, Crew and equipment "Needs source review", Field and owner closeout "Device local", Invoice and collected funds "Not connected") each with a disclaimer and an "Open original ..." link; "One job. One crew brief." + Copy internal crew brief; "Assign. Work. Report back." (suggested next actions, Prepare task, instruction box, team member, due date, priority, Assign internal task; Work and progress, Refresh, Company board, Copy this exact job link). 648 words of disclaimers on one job.
Edit job: name, phone, address, service (free text), quote, lead source, notes, a grid of day buttons, times. (Sample: notes say "LSA", source says "Other".)
Book a job: search existing record or "+ New client". Book commercial client: saved company, contact, site, service, price per visit, source, first visit, start, hours per day, days in a row, repeat, visits. Assign job: employee, commission % (default 20), instructions, checklist.
Findings:
- Status words disagree: card "Confirmed", job sheet "Booked".
- "Withheld" on two tiles: the app refuses to show a sum it can compute.
- Out-of-state flag (built Oct 28) does not show on Jobs cards; the booked Illinois job has no flag here.
- Four doors into one job (Open job, Customer record, Field log, Edit job).
- The job sheet is the right idea: grow it into the full Job page; delete JobContinuity, DispatchPreflight, crew brief, ActionLoop.
- Missing: map, route, drive time, weather on the job, checklist on the job sheet, signature, customer notices ("on my way", "done", review request).

## 8. The rest of Exterior Care (every tab and the Full directory)

Full directory menu (14 links): Customer dossier, Estimate workbench, Company board, Field Command / mobile job log, Operations calendar, Project 360, Website intake command, Acquisition history, Exterior Finance, Service metrics, Documents, Source activity, Upgrade register, Division settings.

| Route | What is there (live) | Size | Verdict |
|---|---|---|---|
| /b/exterior/field (no job) | Today (no jobs), "Needs its figures" (5 past jobs missing revenue, Call / Directions / Open job), Next 7 days. | 3,700 px, 270 words | FOLD into the Job page and the phone Today. The simple list is fine. |
| /b/exterior/field?booking=id ("Field log") | "FIELD COMMAND / SHARED WORK SHEET - Own the work. Record the evidence." Buttons Export private field report, Save to company, Import from crew, Reset local; Pre-job / On site / Post-job review; Record arrival now / departure now; Crew labor, Materials used, Mileage and other costs, Conditions and equipment, Issues and disruptions, Closeout notes; "Assign the rig. Verify readiness." (Fleet Command link, Refresh local fleet, Save equipment to company, Record manual equipment review); "Estimate versus field costs"; "What's still unknown?"; "Prepare the job for owner review" (Copy private owner handoff, Save handoff to company, Download crew review packet, Import crew packet, Import owner reply); "Shared follow-ups. Same job, both founders."; Assign next action; Exact-job shared work. Mostly saved in THIS BROWSER only. Example text: "No trustworthy Fleet Command workbook is loaded on this device. Assets, maintenance and load capacity are unknown - not ready." | 9,400 px, 1,795 words | CUT. Replace with a 3-tap phone job flow (arrive, photos, done) that saves to the database. |
| /b/exterior/estimate | "Estimate a real job." Export all residential drafts, Restore missing from archive, pick a customer record. With a record: "Estimate the scope. Own the margin." Save shared revision, Copy internal brief, Export quote package, Backup every residential draft, Restore missing drafts, Import private package, Reset local, Service line items, Unit economics ("Totals and margin are withheld until all direct costs are represented"), Price recording, Quote readiness, Pricing history, Ready to schedule? | 2,700 px, 511 words | REBUILD as one Quote builder (shared with Proposals): price book, measured property, good/better/best options, send to customer, e-sign, deposit. |
| /b/exterior/intake | "Website intake. Into real work." 14 website requests since June, each with "No matching lead found" or "1 possible related"; spam included (a marketing pitch, a request with "asdfghjk" address); "This source doesn't expose a reviewed/closed disposition" - requests can never be marked handled. | 1,950 px, 554 words | FOLD into a single Inbox (website forms, LSA leads, emails, calls) with Convert to lead / Mark spam / Done. |
| /b/exterior/commercial | Same Companies view as /customers Commercial + "Estimates and project work": "Shared commercial project register", "Estimate - Review - Controlled handoff", "Commercial - Fleet coordination", "Building-by-building scope", "Release readiness", "Internal suggested price", "Site access and safety", 01 Property scope / 02 Cost engineering / 03 Bid War Room / 04 Existing leads, Export browser recovery, Import recovery file. The only saved project is "SYSTEM SAVE VERIFICATION - synthetic archived". | 4,800 px, 1,351 words | CUT the estimator; commercial pricing goes into the one Quote builder (per building, per pane, packages, frequency). |
| /b/exterior/projects | "ATLAS / NEXUS 13.0 - Project 360 Command", "Mission portfolio 1/1", the same synthetic test record, Relationship graph, Activity and evidence. | 1,860 px, 421 words | CUT (in the cut list since Oct 26, still here). |
| /b/exterior/jobs ("Jobs and income", Intelligence) | "Completed work, clearly accounted for": filters (dates, service, source), tiles Recorded revenue $20,050, costs $247, contribution $3,803, average $334.17; "What still needs recording" (All 77, revenue missing 17, cost not recorded 62, both 15); Nov revenue goal; completion months; service mix; sources; list of jobs. | 6,000 px, 1,294 words | REBUILD into Insight > Jobs report. Note 18 different spellings of services (House Wash, House Washing, Soft Washing, Full Exterior, Full Service, ...): there is no service catalogue. |
| /b/exterior/calendar | Month grid with jobs and prices, "Confirmed quote exposure: Withheld", Today side panel, Book a job. Shows one customer on both Nov 3 and Nov 9 (old booking never closed). | 1,290 px | FOLD into the one Schedule (there are two calendars: this and /calendar). |
| /b/exterior/door-knocking | KPIs (doors 1,716, answer rate 34%, jobs 41, $7.35 a door), funnel door to job, best areas by money per door, sessions list, Log a session. | 2,800 px, 585 words | KEEP, it is good. Add a map of areas (heat by $/door) and a phone "knock mode" counter. Move under Growth. |
| /b/exterior/money | Month tiles, Season P&L by month (Apr-Nov, with costs), money-in chart, transactions list (Record expense, Record income, Export CSV, Log money, filters, cards/table). | 2,980 px, 316 words | FOLD into Money with a division filter. |
| /b/exterior/metrics | "Log a number" form + table; the only entry is "Truck fund balance 1,995 USD" from Oct 27 - this stale entry is why Today shows $1,995 next to the Mercury $1,880. | 1,100 px | CUT the free-form metric log for things the system can read; keep manual KPIs as goals. |
| /b/exterior/documents | Upload form (name, type Legal/Insurance/Tax/Contract/Brand/Other, business); "No documents yet." | 1,100 px | FOLD into one Files and Vault (with expiry dates for insurance and COIs). |
| /b/exterior/activity | Full activity log, every change ever, unpaginated: 34,400 px tall, 4,677 words. | 34,400 px | REBUILD as a filterable timeline (Pulse) with paging. |
| /b/exterior/upgrades | Gamified equipment register: "Level Rising, 39% of the way"; 8 groups (Pressure washing equipment 12 of 20, Window cleaning, Fleet and transport, Branding, Business and legal, Marketing, Services offered, Team); items Done / Ready / Locked with price ranges. Lists a "Yamaha 3200 PSI" as the main machine, while the real fleet is ALH4240 hot water + Simpson 4200 + Xero poles. | 4,360 px, 1,225 words | FOLD: this is the third equipment list (with Fleet Command and the Truck plan). One Equipment room. |
| /b/exterior/settings | Business details (incl. monthly revenue goal), Google Sheets import (leads, door knocking), Find duplicates / Merge duplicates. | 1,140 px | FOLD into Settings > Exterior Care. Sheets import can go once the data is in. |
| /b/exterior/board | The same Tasks board filtered to Exterior (27 tasks). | 1,750 px | Duplicate of /tasks. Keep as a filter, not a page. |
| /b/exterior/quotes | Same as intake. | - | duplicate route. |

Equipment lives in THREE places: Fleet Command (browser-local), Upgrade register (gamified checklist), Truck plan (budget lines). None knows the others.
Quoting lives in FOUR places: lead "quote" field, residential Estimate workbench, Commercial estimator, Proposals.
Calendars: TWO (/calendar and /b/exterior/calendar). Customer profiles: TWO. Task boards: one board, shown on 5 routes.

## 9. Schedule (/calendar)

"Calendar - Events and task due dates for all four businesses, with a private link for your iPhone." Month grid only (no week, day or crew-lane view), side panel Thursday Nov 12 (Add event on this day), Coming up list, "On your iPhone" (Create my private link = ICS feed). New event is an inline form (title, business, starts, ends, location, all day, notes; Cancel / Save event).
Findings: a job on the calendar links to the OTHER calendar (/b/exterior/calendar), not to the job. No drag to reschedule, no week view, no map, no capacity per day, no weather on days, no Google Calendar two-way sync. Tasks, personal events ("Oscar at work") and jobs are mixed with no filter.

## 10. Crew (rail) = Tasks (/tasks)

Header "Tasks" appears twice (page head and board head). Tiles: All 53, Overdue 8, Due today 0, Unassigned 2, Ready to review 0; filters by business (All, General, Exterior, Solutions, Essentials, Oscar Jacob) and person (Everyone, Mine, Jacob); New task; 5 columns Backlog / Ready / In progress / Review / Done (Done folded to 5 rows, "Show 34 more done"); every card has its own "Move to" dropdown; under the board "Suggested work" (rule-based: "Resolve the due date: ..." x10).
Task dialog: business chip, title, description, business, status, assigned to, due date, high priority, checklist, Delete task, Save task, Conversation (comments).
Findings: KEEP the board (it is used: 53 tasks, comments). The tasks themselves are a feature wish list from the founders: "Lead organization LSA build - pull leads from LSA every 15 minutes into leads", "connect all social medias to workspace to track all stats", "Give the workspace an https address", "Update OJ Exterior Website", "Register solutions DBA", "Post week 2 long form on all platforms", "Cold calling training for milwaukee guys", "Build a subaccount and agents for OJ Solutions in GHL". The rail calls this page "Crew", which is wrong. Missing: list and calendar views, recurring tasks, sub-tasks, task templates (season checklists), linking a task to a job/customer/invoice, mentions, notifications.

## 11. Growth (/growth)

Tiles Waiting for a reply 2, Quoted out $5,200 (13 going cold), Booked 12; "Answer these now" (2 leads, age, Call / Open / Mark contacted); "Quotes going cold" (13 rows with days since last check-in, Call / Open / Followed up); "Messages ready to send" (NEW LEADS, QUOTE FOLLOW-UPS, AFTER THE JOB) - each a pre-written message with Copy message / Call / Done (the user copies and sends by hand); Google LSA card (spend, leads, Add, Import LSA leads); "Where leads come from" table (source, leads, won, win rate, revenue: Door to door 133 / 55 won / $14,675; Other 27; Referral 12; LSA 8; Website 4; Phone 3; Facebook 2; Nextdoor 1); Rebooking list (20).
Findings: KEEP the structure (it is the most useful sales page). Problems: sending is copy-paste; no email send from the app (Gmail is allowed), no sequences, no review requests, no campaign tool, no speed-to-lead timer on LSA; source data is wrong (see section 6). 4,350 px tall.

## 12. Money (/finance)

"Money - What came in, what went out, and what is left." November 2026 tiles (Money in, Money out, Left over "No costs entered yet", In the bank $1,942.44); Record expense / Record income; Booked ahead ($5,160 across 5 jobs, this week / next week / 2 / 3 weeks); Season profit and loss (2026: in $20,050, out $247, left $19,803, by month Apr-Nov; "Costs are only what has been entered, so months with unentered job costs look better than they are."); business filter; Money in last 12 months chart (Inspect period, View chart data); Transactions (Export CSV, Log money, filters All / In / Out / Manual / From connected records, cards or table, Show 50 more); Mercury accounts; Recent activity.
Findings: "Left over $19,803" on a season with $247 of recorded costs is a fantasy number (LSA alone was about $1,600 Aug-Oct). Money is job-figure based, while the real ledger (journal, Bank to books) lives on separate pages. Needs: one money room with Cash (Mercury), P&L from the ledger, AR, AP/bills, expenses with receipts, allocation (the split), taxes set-aside, truck fund.

## 13. Invoices (/invoices) and the printable invoice

Tiles Owed to you $422 (1 open invoice), Overdue $422, Invoiced this month $0; table (invoice, customer, issued, due, total, balance, status) with View / Record payment / Void. New invoice dialog: bill to, email, business, terms (Net 30 default), issue date, address, lines (description, qty, price, income account "4000 Exterior - Residential Services"), Add line, notes and payment instructions.
Printable invoice: white page "Invoice INV-2026-0001", OJ Exterior Care operated by OJ Holdings LLC, bill to Oscar, 2 lines "Window" $400 + $22, Print or save as PDF.
Findings: the only invoice is a test made out to Oscar (overdue since Oct 28) - it pollutes Act now and Money. Invoice page has no logo, no Pay button, no payment link, no send-by-email, no reminders, no deposit, no partial payments view, no customer portal link. For the season, invoice-and-get-paid has to be one tap from a finished job.

## 14. Insight (/analytics)

Next 30 days (Booked $5,160, Open quotes $5,200 = $2,691 at a 52% win rate, Likely in $7,851, Last 30 days $2,325); "Worth a second look" (anomaly: a $170 house wash where the usual is $335); Reports (business, from/through, This month / Last 30 days / All history; Revenue, Costs "Not recorded", Left over "Not recorded", New leads 0); Revenue by month chart; By business table (Solutions, Essentials, Oscar Jacob all "Not recorded"); Team workload (Jacob 10 open / 6 overdue, Oscar 2 open / 1 overdue); Entries table.
Findings:
- BUG: "New leads 0" for November while at least 6 Exterior leads were added in November (Nov 2 to Nov 11). Insight counts the empty workspace CRM table, not the Exterior leads.
- Essentials (Shopify) sales are not counted ("Not recorded"), Solutions has no revenue model at all.
- KEEP: forecast tiles and the anomaly ("Worth a second look") - those are the right ideas. Thin otherwise: no margin by service, no cost per lead by source, no seasonality, no goal pacing, no cohort or rebook rate.

## 15. Businesses index (/businesses)

Four big tiles (Exterior Care, Solutions, Essentials, Oscar Jacob) with logo, tagline, This month in/out, This year in and % left over, Share of revenue, open tasks. Exterior shows "$20,050 in, 99% left over" (because costs are missing). KEEP the portfolio idea (it answers "where should we put time"), but put it on the Holdings home with real margin.

## 16. OJ Solutions (/b/solutions) - takes 10 to 20 s to render on dev

Two tab rows: Today / Outreach / Customers / Results / Workspace, and under each a sub-row (Today: Command, Daily 10; Outreach: Email engine, Prospects, Warm leads; Customers: Clients, Calls, Contacts, Website requests; Results: Money, Metrics; Workspace: Board, Documents). A Daily 10 quest bar sits above every Solutions page (Oscar 0/10, Jacob 0/10, Open quest).
- Command ("Growth command - Outreach and client acquisition ... No cold calling."): Do this next (10 DMs left), Today's quest, Email engine (Running, 233 emailed, 0 replied, 3 bounced), Pipeline (prospects / contacted / replied / demo booked; "568 not contacted yet"), Warm leads (none), This week (DMs, emails, replies, demos - labels render with blank values), Inbound (website consultations 0 waiting, AI line calls 30 days 0).
- Daily 10 (/dms): gamified DM queue. Oscar Level 1 Rookie, Jacob Level 3 Closer, XP, streaks, "10 to go. You are behind. 5 hours left."; Your next DM (509 ready): business, owner, location, "Why them" research note, message from the research sheet, Copy message / Open Instagram / Skip / I sent it +10 XP; log a DM not on the list (Instagram, Facebook, LinkedIn, Somewhere else, +1 DM); Up next; How points work. KEEP - this is a genuinely good, focused tool.
- Email engine (/email): Running, "27 of 50 sent today" AND "Today's limit of 50 is used" (contradiction), sending from ojsolutions.org, Pause sending, Daily ceiling selector (shows 50 while the code and the Oct 28 SQL moved to 1500), who to email, tiles (Sent today, Emailed all time - blank, Replied - blank, Demos, Bounced 1%, Asked to stop), Replies (none), Last 14 days chart, Recent activity table, What went out, Next up, Ready to send, What it does by itself. 3,900 px.
  BUSINESS FINDING: 233 emails sent (116 this week), 0 replies. The engine works; the offer or targeting or deliverability does not. Needs reply detection check, inbox placement test, copy A/B.
- Prospects (/outreach): 821 prospects in ONE page, 77,000 px tall, 13,700 words (each with research note, draft, owner, status, "Review draft and contact"). Needs a real table with paging, saved views and bulk actions.
- Warm leads (/warm): none; "Website 15-minute consultations" table shows one TEST booking ("Testing testt, test@test.com, Test company"); four-step warm-call script.
- Clients (/clients): GoHighLevel pipeline and deals - ALL "(Example)" demo rows (Dunder Mifflin, MacLaren's Pub, Goliath National Bank). Sample data on a live screen, against the repo rule.
- Calls (/calls): "Recent calls" from GoHighLevel, empty (GHL plan is down).
- Contacts (/leads): "Client Pipeline" New/Contacted/Qualified/Proposal/Won/Lost all 0, tiles captioned "Stage label only", "Not signed contracts", "Not proof of payment", link "Executive HQ".
- Website requests (/consultations): the same single test booking.
Findings: Solutions has no clients, no MRR, no product (receptionist builds, call logs, minutes, client portal), no demo booking flow. It is an outreach machine only. What it needs to be: a SaaS/agency console (clients, plans, MRR, onboarding checklist per client, AI line health, call logs, invoices, churn).

## 17. OJ Essentials (/b/essentials) - cream and serif theme

Tabs Work (Overview, Board) / Customers (Leads, Orders) / Results / Workspace. Overview: "No figures yet. Log money on the Money tab or add a lead ... Shopify will add its own once connected." although Orders, Products and Inventory read live from Shopify. Orders: none in 60 days. Products (Catalogue): 8 products, 7 Archived, 1 Active (R01 Smart Ring $49.99). Inventory: the ring's variants with stock counts in the thousands (dropship placeholders). Board: 1 task.
Findings: the theme is lovely (KEEP the look). Content is thin; the business is effectively paused. Needs: store health (sessions, conversion, AOV, ad spend, COGS, refunds), product research pipeline, supplier and margin per product, sales tax reserve (30/70 Mercury rule).

## 18. Oscar Jacob studio (/b/content)

"Production command." New production; tiles Projects 1, In production 1, Awaiting review 1, Recorded releases 0; warning "1 project has a past planned release date"; search and stage filter (Idea ... Published, Archived); one card "Week 1 Video" (YouTube, producer Jacob, planned Oct 26). Tabs Work / Results / Workspace.
Findings: KEEP the pipeline idea. Missing what the founders asked for in tasks: connected social stats (YouTube, Instagram, TikTok, Facebook views, followers), content calendar, repurposing (long form to shorts), sponsor pipeline.

## 19. Hyperborea (/summit) - founders only

A 3D/illustrated mountain: "Expedition day 17 of 7,305", "Next ridgeline $40,000 a year ($19,950 more a year, about $3,333 a month)", altitude = trailing revenue (1,358 m of 8,849 m), camps (Base Camp, The Treeline, Seven Figures, The Icewall, South Col, The Death Zone, Summit), "Storm on the mountain, -67% revenue over the last 90 days", time ranges, Journal (9 milestones), Achievements 8 / 43, Codex, The North Wind, Wind off toggle.
Findings: this is the one place with real visual ambition and a story. Oscar asked for "aura": this is the direction, but it lives on a side page. Decide: keep as the long-term goal room and borrow its visual language for Command.

## 20. Pulse (/pulse)

"Real activity from the last 30 days." Warning banner "Some sources are unavailable, limited, or not yet connected." Oscar and Jacob cards (0 today, Level 9 / 348 this week / 4 day streak; Level 6 / 720 / 1 day streak); Recent activity by day (email engine runs, task updates with +points, calendar events, work sessions). 19,500 px tall.
Findings: THIRD scoring system. Points exist in (1) the weekly leaderboard (hours + 3 per task), (2) Pulse (levels and points per action), (3) Daily 10 (XP, Rookie/Closer levels). Plus Exterior "Upgrade register" levels and Hyperborea achievements. Pick ONE progression system.

## 21. "More" pages

| Route | What is there (live) | Verdict |
|---|---|---|
| /proposals | Tiles Out waiting $0, Won $0, Drafts 0; "No proposals yet." New proposal dialog: prepared for, email, business, valid through, site address, lines (description, qty, price, optional add-on), package discount, payment (ACH net 30 / due on receipt / per PO / ACH on completion), terms (pre-filled 12-month / 30 days cancellation / COI), exclusions, notes, Save. | REBUILD into the single Quote builder. Zero proposals in the system although three real commercial proposals ($43,380) were sent as hand-made PDFs - the tool is not being used because quoting happens elsewhere. |
| /books (Bank to books) | Bank versus books (Revenue Clearing $3.41, Tax Reserve $7.46, Operating $51.38, Truck Fund $1,880.19; all $0 in books); "0 transactions posted, 375 waiting, 57 moves between your own accounts"; filter by bank account; table where every row has a dropdown of the full chart of accounts (page is 6,500 px, 16,500 words); "Post 0". | KEEP the engine, REBUILD the UX: rules ("always categorise Menards as Chemicals"), bulk select and post, AI suggestions, receipt match, keyboard flow (like a bank-feed inbox). 375 unposted transactions = the books are not started. |
| /rig (Truck plan) | Rig budget ($0 of $20K, truck fund $1,880, needed $3,926 a month to Apr 1), rig budget lines (empty; suggested lines listed), trucks being weighed (empty), washer repair / rent / replace (empty). | KEEP the idea, fold into Equipment and Goals. Unused so far. |
| /quality (Data quality) | "Records in order 82%", 3 things to fix: 62 jobs no costs, 17 no revenue, 27 leads no source. | REBUILD. 82% is flattering: it does not count duplicates, junk names, test records, 38 customers without a usable phone, the bad service names or 375 unposted bank lines. |
| /files | Upload (file up to 25 MB, name, type, business), filter by type; 2 files (two OJ Solutions commercial videos). | REBUILD as Files and Vault: folders per business/customer/job, photos library, insurance and COI with expiry reminders, W-9, contracts, search. |
| /messages | Threads by business (Everything 1, Shared 1, others 0); a single test message from Oct 28 (an offensive word; delete it). | FOLD into the chat side panel; delete the test message. |
| /team (in-app) | Stub page "Team - Members, roles and invitations..." with a link to /workspace/team. | CUT the stub. |
| /workspace/team (outside the app shell, no rail) | "People and access." Invite (email + Member or Viewer, creates a link, does not email), Workspace members (Jacob owner, Oscar owner), Recent invitations; "Manage employees and assigned jobs" link. | FOLD into Settings > People (inside the shell). |
| /workspace/employees (outside the shell) | "Employee work." Add an employee (invite link), Employee access (the crew member, Active, Pause access), Assign upcoming work (every upcoming job with employee, commission %, instructions, checklist, Assign job / Save assignment), Assigned jobs and commission (estimated, "Commission is calculated from customer payments actually recorded, never from the quote"), Approved earnings. 4,000 px. | This IS the Crew room and it is hidden 3 clicks deep outside the app. PROMOTE to the rail as Crew (people, schedule, pay, docs, training). |
| /settings | You (name, access, "change your password from the sign-in page"), Connections (Workspace database, Shopify, GoHighLevel - all "Connected"). Mercury is not listed though it is connected. | REBUILD: business profiles, services and price book, tax rates, invoice and proposal templates, notifications, integrations (Mercury, Google, Stripe, LSA, Shopify, GHL, Apps Script), people, appearance and density, data export. |
| /tools/systems | "Systems Health and Releases": deployment identity "Release identifier not configured", app probe (running SHA unknown), GitHub main SHA, Operational release gates, Check now. | MOVE to Settings > System (owner only). |
| /tools/fleet | "Fleet Command": "LOCAL RECOVERY - edits have not been confirmed in Supabase"; Dispatch readiness console (Pre-departure, Service ledger, Rig Lab, Sync company fleet, Prepare shared task), Commercial - Fleet coordination, dispatch planning radar, equipment attention queue, rig readiness, payload planning, transfer and backup. 478 words, browser-local. | CUT and rebuild as the Equipment room (database-backed). |
| /crm | Redirects to /b/exterior/leads. | Leave the redirect. |

## 22. Phone (390 x 844)

- Frame: top bar (menu, company, search, timer, bell, avatar, sign out) + window-tab strip + "Team at work" strip = about 160 px of chrome before any content. Bottom bar: Today, Jobs, Tasks, Money, More. Floating gold + over content.
- "More" opens the full desktop sidebar as a drawer (Do the work, Your businesses, Hyperborea, More...) - not a phone menu.
- Page heights on phone: Today 4,740 px; Jobs 5,090 px; Growth 6,410 px; Money 7,450 px. Every page is a long scroll of desktop cards stacked.
- Today: job rows wrap badly (long company names stack against the time).
- Money: "In the bank $1,942.44" overflows its tile and is clipped.
- Jobs: the first screen is the Exterior header (ATLAS / FIELD SERVICES DIVISION, 4 nav buttons, Full directory) instead of jobs.
- Job sheet dialog on phone is decent (big title, call, directions, money, sticky Mark complete and save). Keep it as the base of the phone job screen.
- 26 of 84 tap targets on Today are under 36 px tall.
- No offline mode, no camera-first capture, no swipe actions, no pull to refresh, no haptics, no push notifications.

## 23. Employee portal (/employee)

Signed in as an owner, /employee shows "EMPLOYEE ACCESS - This account has no employee portal access." with "Sign in with another account". The crew view itself was NOT seen yet - needs an employee sign-in (Oscar to provide a test employee login or sign in as one in the browser pane). Known from code and docs: assigned jobs, instructions, checklist, closeout, commission (flat 20%), approved earnings.

---

## 24. Cross-cutting findings (the real problems, ranked)

1. **No single source of truth.** Duplicated systems for the same thing: customers (2 profiles, 2 directories), quoting (4 tools), calendars (2), equipment (3), scoring (3), task board shown on 5 routes, rebooking (3 different counts: 42 / 20 / 0), truck fund (2 different balances on one page: $1,995 and $1,880).
2. **The data model is a lead row.** Lead, customer and job are one record with a status; bookings hang off it. No Job/Visit object, no service catalogue (18 spellings of services), no price book, no property object used by jobs. Everything downstream (money, crew, invoices, rebooking) is weak because of this.
3. **Evidence-era UI.** About 11,000 words of disclaimers in the components; the worst pages (Field log 1,795 words, Commercial estimator 1,351, Job continuity 648) are browser-local or export/import-file workflows that two founders cannot use. Numbers are hidden behind "Withheld" and "Unknown".
4. **Capability without use.** 0 proposals, 1 test invoice, 0 payments, 375 unposted bank lines, 0 rig lines, 2 files, 1 test message. The system is not where the business happens yet: quotes, payments, receipts and texts happen elsewhere.
5. **Wrong numbers on screen.** Insight "New leads 0" (wrong table); LSA 8 of 190 leads (wrong tags); "Left over $19,803" (no costs); "Records in order 82%" (ignores junk); email engine "27 of 50 sent" and "limit used" together; Essentials "Shopify will add its own once connected" while connected; Solutions Clients shows "(Example)" demo deals.
6. **Navigation is three systems at once.** Rail (with mislabelled items: Crew = Tasks, Customers = Exterior leads), the Exterior second nav with a 14-link directory, the auto-opening window tabs, plus link tiles inside pages. The real Crew page (/workspace/employees) and Team page live outside the app shell.
7. **Pages are endless.** Activity 34,400 px, Outreach 77,000 px, Field log 9,400 px, Bank to books 16,500 words, 190 lead cards in one list. No paging, no tables with saved views, no virtualisation.
8. **Phone is desktop squeezed.** 4,700 to 7,500 px pages, 160 px of chrome, a drawer copied from desktop.
9. **Slow first paint.** Exterior pages blank for 8 to 15 s on the dev server; Solutions 10 to 20 s; pages fade in dim. (Re-time on the production build.)
10. **No outbound loop.** The app cannot email a customer (quote, invoice, reminder, review request, on-my-way). Growth produces "Copy message" text to paste elsewhere.
11. **Junk in live data.** Test invoice (to Oscar), test consultation, "Filler Data", "Duplicate", "Oscar" test lead, joke names, an offensive test chat message, the synthetic commercial project, website spam.

## 25. What is genuinely good (keep and build on)

- Job sheet dialog (money, costs by type, photos before/after, invoice this job, mark complete).
- Act now on Today; Weather ahead; Winter plan cards; forecast tiles and "Worth a second look" on Insight.
- Growth: Answer these now, Quotes going cold, follow-up message templates, Where leads come from table.
- Door knocking analytics (funnel, best areas by $/door).
- Daily 10 DM queue and the email engine (as machines - their results need work).
- Commercial company profile look; Essentials cream/serif theme; Hyperborea's visual ambition; the leaderboard as motivation.
- Double-entry ledger, invoices, Mercury read, Bank to books engine, RLS and membership, CI-gated deploy, employee invites and commission.
- Status bar, company switcher, Ctrl K (as a start).
