# OJ Workspace: the shared business dashboard for Oscar and Jacob

(The STRATHOS UI overhaul is paused at its stage 2, waiting on Oscar's verdict on the Discipline room. Its plan is recorded in AGENT_LOG.md and memory.)

## Context

The OJ Workspace today is a small shared task board (5 columns, two businesses) at `C:\STRATHOS\apps\oj-workspace`, built by Codex, running on Oscar's PC. Oscar wants it to become the one place he and Jacob run all three businesses from: a full visual redesign, real metrics, each business with its own logo and tabs, a calendar, documents, and a way for Jacob to edit the app himself with Claude.

What I found:

- **The app is small and clean.** Next.js 16, Supabase sign-in and membership, about 600 lines. The database only allows two businesses (`exterior`, `solutions`); OJ Essentials does not exist in it yet. It is not in git.
- **Exterior Care already has a real system** in `Documents\Claude\Projects\OJ Exterior Care LEADS OUTREACH\oj-sms-system`: leads, AI texting through Twilio, bookings on Google Calendar, door-knocking tracker, analytics. It has its own server and its own GitHub repo, and uses the same Supabase project as the workspace. Its tables are currently locked so only that server can read them.
- **OJ Essentials** is a live Shopify store (ojessentials.store, Basic plan, USD): "Wellness, tested before listed", four categories, about $15 to $90.
- **OJ Exterior Care** is pressure washing in Kenosha, WI, jobs about $149 to $399.
- **OJ Solutions** sells AI receptionists and runs on GoHighLevel.
- GitHub is signed in on this PC as Oscarlifts556.

Oscar's decisions: move to cloud hosting; rebuild the Exterior Care screens inside the workspace while the existing server keeps sending texts; match the dark navy inspiration, with each business's section heavily coloured by its own logo; OJ Solutions numbers come from GoHighLevel.

## The look

- **Shared frame (Home, Calendar, Tasks, Team):** deep navy, like the inspiration. Bright blue for primary actions. A photographic hero on Home with the greeting.
- **Each business takes over its own section.** Opening a business changes the accent colours, the header and the logo:
  - Exterior Care: black with the orange and leaf green from its logo.
  - OJ Solutions: charcoal with the copper from its logo.
  - OJ Essentials: warm cream and near-black, with a light serif for headings, as in its logo sheet.
- **Logos:** cropped from the files Oscar attached into clean marks with transparent backgrounds, shown in the side rail, on each Home card, and large at the top of each business section.
- **Type:** one geometric sans across the app (matching the Solutions wordmark), the serif only inside Essentials, and aligned figures for every number.
- **Motion:** numbers roll when they change, cards glide when moved between columns, the tab marker slides, pages cross-fade, and each business's colours wash in when you open it. All of it switches off under reduced motion. Libraries: Motion for React and NumberFlow, plus the page transitions built into Next.js 16.
- Real numbers only. The inspiration image's figures are placeholders; where a business has no data connected yet, the tile says what to connect instead of showing a made-up number.

## What gets built

### Everything in the inspiration screenshot

Every element in the image Oscar attached is in scope. Nothing on it is left out.

**Side rail, all eleven destinations:**

| Item | What it is |
|---|---|
| Home | The overview screen described below. |
| Businesses | The three business sections, each with its logo and tabs. |
| Tasks | Every task across all businesses, as a list and as the board, with filters by business, person and due date. |
| Calendar | The shared calendar, with the iPhone link. |
| Leads & CRM | One pipeline across all three businesses: Exterior Care leads, Solutions prospects, and Essentials wholesale or supplier contacts. |
| Finance | Revenue, costs and profit per business and combined, by month. |
| Files | Every document across the businesses, searchable, with the per-business Documents tabs feeding it. |
| Messages | Notes and messages between Oscar and Jacob, with threads per business. |
| Analytics | Charts and comparisons across the three businesses. |
| Team | Members, roles and invitations (exists today, restyled). |
| Settings | Profile, notifications, and the Connections page for API keys. |

**Top bar:** "Search anything" across tasks, leads, files, messages and events (with the keyboard shortcut), a notifications bell, and both founders shown with their names and roles.

**Rail footer:** the Shared Workspace box with both avatars, online status and an Invite button, and the motto.

**Home screen, piece by piece:**

- The mountain-photo hero with the greeting, the workspace title, the tagline, and the quote.
- Three business cards. Each has the logo, a one-line description, three headline numbers, an "Open dashboard" button and one quick action:
  - Exterior Care: revenue this month, active leads, jobs this month. Quick action: New lead.
  - OJ Solutions: revenue this month, active leads, projects. Quick action: New project.
  - OJ Essentials: revenue this month, active leads, new products. Quick action: Add product.
- **Revenue overview:** a line per business over the last 12 months, total and percentage change, a range picker, hover readout, and a legend.
- **Business performance:** each business with its figure, percentage change and a small trend line, with a period picker.
- **Leads pipeline:** New, Contacted, Qualified, Proposal, Won, as bars with counts, and a "View all" link.
- **Today's tasks:** tick-off list with business and priority, due time, and "View all".
- **Schedule:** today's timeline, colour-coded by business, with a day picker and an add button.
- **Recent files:** latest documents with type icon, name and time, and "View all".
- **Messages & notes:** the latest notes from each of you, with a box to write a new one.

Figures are in US dollars and are real: where a business is not connected yet, its tile says what to connect.

**Each business has the same core tabs:** Overview, Board, Metrics, Documents. Plus its own:

| Business | Extra tabs | Where the data comes from |
|---|---|---|
| Exterior Care | Leads, Conversations, Bookings, Door knocking, Analytics | The existing Exterior Care database. Texts are still sent by the existing server. |
| OJ Solutions | Clients, Calls, Revenue | GoHighLevel, plus a manual log for setup fees, monthly fees and costs. |
| OJ Essentials | Orders, Products, Inventory | Shopify. |

**Calendar.** One shared calendar showing workspace events, Exterior Care bookings and task due dates, colour-coded by business. For iPhone: each of you gets a private subscribe link, so the OJ calendar appears in the iPhone Calendar app and stays updated. That direction is one-way (dashboard to phone). Events made on the phone flow back through Google Calendar, which Exterior Care already uses. Direct two-way iCloud sync is possible later but needs each person to create an Apple app-specific password.

**Documents.** Per business: upload, name, tag (legal, insurance, tax, contract, brand), preview and download. Files are private to workspace members.

**Metrics logging.** Every business gets a "log a number" form for anything no system tracks, kept separate from connected data and labelled as hand-entered.

**Connections.** An owner-only page listing each connection (Shopify, GoHighLevel, Exterior Care server, Google Calendar) with its status and last sync. Keys are stored in the host's protected settings, never in the code, the database tables members can read, or the page itself.

**Shared with Jacob.** A private GitHub repo, with an agent log and a short rules file so his Claude follows the same rules as mine, and a checklist that runs the tests on every change.

## Build order

Each stage ends with something you can open, and screenshots.

1. **Repo and ground rules.** Put the app in its own private GitHub repo (`oj-workspace`), add `AGENT_LOG.md`, the Claude rules file, a contributor guide for Jacob, an example settings file with no secrets, and automatic typecheck and tests on every change.
2. **The new look, on Home and the board.** Design tokens, fonts, cropped logos, the full eleven-item side rail, the top bar, and the complete Home screen from the inspiration image. Add `essentials` as a third business. Panels whose data arrives in a later stage show a clear "connect this" state, not sample numbers.
3. **Business sections, Tasks, Messages, search and notifications.** The shared four tabs for all three businesses, each in its own colours with the logo header; the all-business Tasks page; Messages and notes; "Search anything"; the notifications bell.
4. **Exterior Care data.** A database change that lets signed-in workspace members read and edit the Exterior Care tables (today only the old server can). Then the five Exterior Care tabs, rebuilt from the existing app's screens.
5. **OJ Essentials.** Shopify connection: revenue, orders, average order, top products, low stock.
6. **OJ Solutions.** GoHighLevel connection: clients, calls handled, pipeline; plus the manual revenue and cost log.
7. **Leads & CRM, Finance and Analytics.** The cross-business pipeline, the money view and the comparison charts, once all three data sources are connected.
8. **Calendar and iPhone link.**
9. **Files and Documents.**
10. **Settings and Connections page.**
11. **Cloud launch.** Deploy, move the address, test with both real accounts on two devices, then retire the PC-hosted copy.

## Key technical points

- **Files:** all work is in the app's own folder, which becomes the repo. New: `src/app/(app)/` routes for home, calendar, each business and its tabs; `src/components/` for the shell, charts and shared pieces; `src/styles/tokens.css` and per-business theme files; `src/lib/integrations/{shopify,ghl,exterior}.ts`; `supabase/schemas/` additions; `public/brand/` for logos.
- **Database additions (all additive):** `essentials` allowed on cards; new tables for events, documents, messages, notifications, cross-business leads, finance entries (revenue and costs), hand-logged metrics, Solutions clients, calendar-link tokens (stored hashed) and connection status; a private storage bucket for documents. Every table gets the same membership rules the existing ones use (`oj_private.member_role`).
- **Exterior Care access:** new policies on the existing leads, conversations, bookings, door-knocking and settings tables for workspace members. The old server's own access is unchanged. Tested in the isolated test database before touching the live one, following the staging steps in `docs/DEPLOYMENT.md`.
- **Texting stays single-owner.** The workspace never runs its own send loop. "Send a text" in the Conversations tab calls the existing server.
- **Shopify and GoHighLevel** are read on the server with caching, so keys never reach the browser.
- **New dependencies:** `motion`, `@number-flow/react`, `recharts`. Versions pinned.
- Existing code reused: sign-in, invitations, membership, the board logic in `src/lib/board.ts`, the live-update wiring in `LiveWorkspace.tsx`, and the 47 existing tests.

## What I need from you

- **Jacob's GitHub username** (to add him to the repo) and confirmation his workspace invitation has been accepted.
- **A Shopify access token** for the dashboard (I'll give exact click-by-click steps; you create it, I never see your password).
- **A GoHighLevel access token**, same approach.
- **Where the Exterior Care server runs today** (your PC, or Railway). If it only runs on your PC, sending texts from the workspace only works while your PC is on, until that server is hosted too.
- **Photos of you and Jacob** for the avatars, if you want faces instead of initials, and a pick for the Home hero photo (I'll propose a free-licence mountain image).
- **Hosting cost decision at stage 11.** Vercel's free tier does not allow commercial use, so it is either Vercel Pro (about $20 a month) or Cloudflare (free tier allows commercial use). I'll check current terms and limits then.

## Boundaries

- I will not open the existing `.env` files or the two key text files in the Exterior Care folder. New keys go in fresh, by you.
- No secrets in the repo, in cards, or in documents.
- No invented metrics, and no sample data on live screens.
- Database changes to the live project are staged and tested first, and I'll tell you before each one is applied.
- Nothing from your private STRATHOS dashboard is shared into this app.
- This is Codex's app too. I'll record the handover in STRATHOS's AGENT_LOG.md and work from the new repo's log after that.

## Verification

- Typecheck, production build and the existing test suite after every stage, plus new permission tests for each new table (member, viewer, signed-out, other organisation).
- Every screen checked by eye in the visible test browser at desktop and phone width, with screenshots sent to you.
- Reduced motion, keyboard use and contrast checked on each new screen.
- Shopify and GoHighLevel figures compared against their own dashboards for the same date range.
- The iPhone calendar link tested on your phone by you; I'll verify the feed file itself.
- Before launch: both real accounts signed in on two devices, a card, a document and an event created by one and seen by the other.
