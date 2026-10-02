# Connecting the three businesses

A founder does each of these by hand. Keys go in `.env.local` on the machine that
serves the app (later: the host's settings). Never paste a key into a chat, a
card, a commit or this file. After changing `.env.local`, rebuild and restart the
live copy.

## 1. Exterior Care: existing leads, texts, bookings, door knocking

Read-only access for workspace owners and members. Nothing in the old app changes.

1. Open `supabase/pending/RUN-ME-exterior-care-read-access.sql` and copy all of it.
2. Supabase dashboard -> project "OJ EXTERIOR CARE LEADS" -> SQL Editor -> New query.
3. Paste, press Run. Expect "Success. No rows returned". Run it once only.
4. Tell whoever is building, so the file moves to `supabase/applied/`.

Sending texts from the workspace is separate: it needs the oj-sms-system server
running somewhere reachable, then `EXTERIOR_API_URL` and `EXTERIOR_API_KEY`.

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

## After any change to `.env.local`

Build on `main`, stop the process on port 3011, run `scripts/serve-local.ps1`.
Settings -> Connections in the workspace then shows the connection as on.
