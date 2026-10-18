# Team availability and current work

`PresencePanel` shows online/away/offline signals and member-written status with an optional task link. It does not observe typing, mouse motion, visited customer records or other private activity. Task links use existing task dialogs and database organization boundaries.

## Activation

The desired additive schema is `supabase/schemas/presence.sql`, applied after `workspace.sql`. It has **not been applied to the live OJ project**. Follow the deployment runbook: inspect the configured OJ project, generate/review its schema diff, apply the reviewed migration, and verify with two real accounts. The app intentionally says availability is not connected when these tables are missing. No privileged API key, new service or metered AI is needed.

The schema adds `oj_presence_sessions` and `oj_current_work` to the existing Postgres Changes publication when it exists. Browser events only trigger authenticated reloads; event payloads are not treated as trusted identity or business records. A 15-second refresh also works when realtime delivery is unavailable. Every API request verifies the current account and organization membership; RLS repeats these boundaries for direct database clients. Revoking membership also cascades that member's presence and work rows.

## Semantics

- Each mounted workspace tab has its own random session ID. A heartbeat every 30 seconds receives a database timestamp. Tab closure attempts an offline heartbeat; crashes and lost networks expire within 90 seconds without relying on that request.
- A visible tab is online unless explicitly set away/offline. Hidden tabs are away. Aggregate status is online if any recent tab is online, then away if any is away, otherwise offline. Availability choices affect this tab; they are not a global privacy setting.
- While this browser cannot refresh, it displays unknown/reconnecting rather than claiming teammates are offline. Last seen is the last workspace heartbeat, not the last action or proof of work.
- Current work is an explicit note (160 characters) with an optional same-organization task. It is preserved while offline. An expected revision prevents two tabs from silently replacing one another's status; the editor preserves its draft until the user loads the newer version.
- Old ephemeral session rows are pruned when the same member returns after seven days. No business records or shared task data are removed by this housekeeping.
- Preview uses session storage only, clearly labels members as samples and never claims a remote teammate is online. It does not call the presence API.

## Verification

`npm test` includes deterministic expiration/multi-tab/input tests and isolated PGlite policy tests for impersonation, cross-organization access, anonymous access, forged timestamps, same-org task links, stale status revisions and immediate membership revocation. These are not proof of deployed permissions or real network reconnect behavior. Complete the live two-account checklist after activation, including disconnecting both browsers and confirming expiry, reconnecting, testing two tabs and removing a member.

Uses existing React, Supabase and Lucide dependencies. No new dependency, asset or AI cost.
