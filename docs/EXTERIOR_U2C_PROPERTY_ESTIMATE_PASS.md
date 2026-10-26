# Exterior U2C — property-first estimate workflow

## Implementation checkpoint — staged, not deployed

Builds on existing U2 Commercial Accounts #162 and U2B exact project links #164.

1. Operators can view saved property profiles with their requested/proposed one-time, monthly, quarterly or annual service interest. This field is **not** an accepted contract, signed recurring agreement, scheduled job, payment, or confirmed revenue.
2. Each **already saved** property exposes **Start estimate for this saved property**. The button remains unavailable for unsaved/dirty company records. The founder must explicitly confirm discarding unsaved estimator context.
3. Starting a property estimate resets the estimator to an entirely new unsaved commercial project (does not overwrite an existing project), preserves the exact company and property UUID as a **pending suggestion only**, clears stale `?project=` URL navigation, and never writes Supabase records automatically.
4. After the internal estimate has explicitly saved to the existing shared Project 360 portfolio, the user can choose **Use selected property**, then separately click **Save company link**, with exact-source membership, source-ID and foreign key validation performed in staged U2B. The suggestion alone does **not** establish an approved client, create an appointment or change an invoice.
5. On the Commercial Account view, linked project cards display the saved property name rather than raw database UUIDs. Overview cards distinguish *saved properties*, *recurring-service interest*, and *loaded linked projects*, without invented contracts, due dates, or bookings.

### Required release gates

- Exact latest U2C branch-head TypeScript, full tests, Next production build and synthetic actor/DB recovery suites
- Stage chain #161 (merged), #162 (not yet installed), #164, then this U2C review
- Fresh real-source backup and independent recoverability of all private Storage object bytes; authenticated positive and negative actor tests; explicit owner migration approval, exact application release identity, two founder devices
- **No** automatic external message/contract/payment or mass-update of legacy `bookings`, `leads`, or existing `oj_commercial_projects` records

### Percentage accounting

Original 12-wave formal score 42/100; provisional overall engineering 49%. Original founder audit 16 findings, five initial U0 fixes merged and U1 merged; provisional audit implementation ~50% with strict independent founder-accepted closure still 0/16. Do not raise either provisional score just for a staged UI change.