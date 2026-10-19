# Connecting the three businesses

A founder does each of these by hand. Keys go in `.env.local` on the machine that
serves the app (later: the host's settings). Never paste a key into a chat, a
card, a commit or this file. After changing `.env.local`, rebuild and restart the
live copy.

## 1. Exterior Care

Nothing to connect: Exterior Care's records live in this workspace's own
Supabase project, and the workspace is where leads, bookings, payments and
door knocking are recorded. The three database updates that allow this are in
`supabase/applied/`. The Google Sheets are only a starting point: Exterior Care
-> Settings -> "Bring in leads" / "Bring in door knocking", once each. Texting is
not used.

## 2. OJ Essentials: Shopify

Shopify no longer lets you create a custom app inside store admin. It is done
in the Dev Dashboard, and the app must be in the same Shopify organization as
the store.

1. Go to https://dev.shopify.com/dashboard and sign in as the store owner.
2. Create app -> Start from Dev Dashboard. Name it "OJ Workspace".
3. In the app's version settings, set Admin API access scopes to exactly:
   `read_orders`, `read_products`, `read_inventory`. No write scopes. Release the version.
4. On the app's Home, Install app -> choose the OJ Essentials store -> Install.
5. App -> Settings: copy the Client ID and the Client secret.
6. In Shopify admin -> Settings -> Domains, note the address ending in `.myshopify.com`.
7. Put all three in `.env.local`:

       SHOPIFY_STORE_DOMAIN=<name>.myshopify.com
       SHOPIFY_CLIENT_ID=<client id>
       SHOPIFY_CLIENT_SECRET=<client secret>

Note: `read_orders` covers the last 60 days of orders. Older history needs
`read_all_orders`, which Shopify has to approve. Ask for it later if needed.

## 3. OJ Solutions: GoHighLevel

1. Open the OJ Solutions sub-account (not the agency view).
2. Settings -> Private Integrations -> Create new integration. Name it "OJ Workspace".
   If the menu item is missing, switch it on under Settings -> Labs.
3. Tick the read-only scopes only: View Contacts, View Conversations, View
   Conversation Messages, View Opportunities, View Calendars, View Calendar
   Events, View Locations.
4. Create, then copy the token. It is shown once.
5. The location id is the code after `/location/` in the browser address while
   you are inside the sub-account (also under Settings -> Business Profile).
6. Put both in `.env.local`:

       GHL_ACCESS_TOKEN=<token>
       GHL_LOCATION_ID=<location id>

## Where the keys live

The live site runs on Netlify: keys go in Netlify -> Project configuration ->
Environment variables, followed by a redeploy (see docs/DEPLOYMENT.md).
`.env.local` is only for running the app on your own computer.
Settings -> Connections in the workspace shows whether each connection is on.

## Mercury bank accounts (owner-only, read-only)

The Finance page can show Mercury account balances and the latest 50 transactions. It uses only Mercury's read endpoints and displays a reduced response that omits full account and routing numbers. Transactions are not added to recorded revenue or costs: transfers and deposits are not necessarily sales.

To connect it, create an API token in Mercury with the **Read Only** role, then add it to the Netlify production environment as `OJ_MERCURY_API_TOKEN` and redeploy. For local testing, put the token in `.env.local`. Do not paste the token into the dashboard, source control, or chat. Only the workspace owner receives this bank snapshot; members with other roles and the separate employee portal do not.

The integration calls Mercury's [Get all accounts](https://docs.mercury.com/reference/getaccounts) and [List all transactions](https://docs.mercury.com/reference/listtransactions) endpoints. It does not initiate payments, create recipients, or change transaction metadata.
