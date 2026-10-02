# Staging setup and release checklist

## Public access enabled (2026-09-30)

OJ is available without installing Tailscale at https://desktop-lbi2ein.tail3f006f.ts.net:10000/login. Tailscale Funnel publishes only HTTPS port 10000 to loopback 3011. Ports 443 and 8443 remain tailnet-only, forwarding to the existing private services. The app still requires individual Auth sessions and OJ memberships. The original URL and callback allowlist remain valid, so new invitation links already use the public origin. The PC, app process and Tailscale service must remain running; this is public desktop hosting, not an independent cloud deployment. App automatic restart after reboot is not configured.

Applied restrict_legacy_public_access_before_oj_sharing after reviewing the legacy backend's SUPABASE_SERVICE_KEY connection and reproducing permissions in PGlite. All seven legacy tables now have RLS; six backend-only tables deny anon/authenticated privileges, including TRUNCATE. Their service_role grants remain unchanged. quote_requests retains anon INSERT for the website; authenticated SELECT is restricted to an administrator-only snapshot of the two accounts already existing at migration time. New signups do not inherit quote visibility. No customer data, SMS scheduler or legacy backend source was changed. Fixed the legacy timestamp trigger's search_path.

Verification: 47 automated checks and production build/TypeScript passed. Live catalog confirms grants and policies. Actual public-key REST reads of eleven legacy/workspace tables return 401. Anonymous app snapshot returns 401/no-store; workspace/team redirect to login; private dashboard API path returns 404. Public DNS-over-HTTPS returned Funnel relay addresses, and TLS-verified requests forced through those public addresses returned login 200 and anonymous snapshot 401. Both advertised relay addresses returned login 200 after one transient TLS handshake failure during startup.

Security advisors still report intentional no-policy backend/private tables and narrowly checked definer RPCs. Leaked-password checking is disabled. These are recorded limits, not a claim of a complete security certification. Actual Jacob account/invitation acceptance, two-device synchronization and the deployed legacy backend's end-to-end operation remain unverified. Quote submission was tested only in the isolated database, not against real customer intake.

To revert public exposure, run `tailscale funnel --https=10000 off`, then restore private access with `tailscale serve --bg --https=10000 http://127.0.0.1:3011`. Do not reset Serve/Funnel globally: that would affect private services. Keep the database restrictions; restoring permissive policies would reopen customer-data access. Provision any additional legitimate legacy quote reader by exact administrator-approved Auth ID in oj_private.legacy_quote_readers.

Vercel project inspection is connected, but its advertised deployment tool returned Tool deploy_to_vercel not found and no local CLI was installed. No Vercel projects, domains, plans or billing settings were changed. An independent cloud deployment remains the reliability upgrade; check account plan and commercial hosting eligibility before provisioning it. Earlier private-only hosting and legacy-policy warnings below are historical and superseded by this section.

This app is independent of dashboard. Do not give it the private STRATHOS environment, filesystem, SQLite database, or service-role key. The Exterior Care workspace schema and public client connection are installed; owner/member email verification and callback setup remain.

## Password-only account setup (2026-09-30)

At the user's explicit request, project Confirm email is disabled. Actual /auth/v1/settings reports mailer_autoconfirm=true. No SMTP or verification emails are required for signup. This setting applies to all future email signups in the shared Exterior Care project; the one pre-existing Auth account was not changed. An auto-confirmed email is an account identifier, not proof of mailbox ownership.

Owner setup now requires oj_private.owner_setup.approved_user_id to equal the authenticated user ID. This private approval is administrator-only; no public or member operation can set it. After the user creates their password and confirms they can sign in, inspect the matching Auth account and bind that exact ID through authorized administration. Do not approve an arbitrary pre-existing account by email alone. Jacob joins through possession of an owner-created, high-entropy, email-bound invitation link. Keep links private.

Email recovery is disabled in both the screen and server action. A signed-in user can change their password; lost access requires project-administrator assistance. No automatic administrator recovery workflow is implemented. Earlier verification/SMTP requirements below are historical and superseded by this section. Actual signup/sign-in and two-account collaboration still need verification.

## Live setup status (2026-09-30)

Migration 20260930221605, oj_shared_workspace_accounts_and_collaboration, applied workspace.sql, collaboration.sql and owner-setup.sql to the user-selected Exterior Care project after restoration and schema collision review. Do not apply these CREATE statements again to the same project. Existing outreach tables and policies were preserved. Owner enrollment is provisioned for the user-specified email; /setup grants ownership only after actual Auth verification. Jacob has no new account or invitation yet.

The app uses an intentionally public publishable connection in src/lib/oj-connection.ts, with optional hosting overrides. No secret environment files or service-role keys are used. Public REST checks reject anonymous card access, and live catalog checks confirm RLS on all new public tables, no direct member updates to membership, and Realtime publication of shared records.

The Supabase connector lacks Auth-settings operations. Admin sign-in completed in Chrome. Saved redirect allowlist entry https://desktop-lbi2ein.tail3f006f.ts.net:10000/auth/callback** for the exact workspace origin and callback prefix; original Site URL http://localhost:3000 remains. Confirmation template uses .ConfirmationURL. The project uses the built-in test email service; custom SMTP remains required for dependable owner/Jacob verification and production delivery. Recovery template and actual callback/email flows remain unverified. Account forms are enabled, but their email callbacks remain unverified. Do not ask users to register until this configuration is complete.

Legacy security findings remain a launch gate: public ALL policies on leads/conversations/bookings/settings and RLS-disabled door-knocking sessions permit anonymous access. Plan a compatible backend and policy migration before broader sharing; do not enable RLS blindly and break the current outreach backend. New private tables deliberately deny direct access, and enrollment/admin RPCs use narrow verified-identity checks.

## Local preview

Run npm install, then npm run dev. Open http://127.0.0.1:3010/preview. Fixtures are sample records, edits persist only in browser storage. Local development binds to loopback. /workspace redirects to sign in when no OJ account connection is configured.

## Staging connection

The user selected the existing Exterior Care Supabase project on 2026-09-30. Inspect its current schemas and authentication settings before migration; shared tables must be additive and must not alter legacy outreach tables or permissions. Use a staging branch/clone before applying to the live project. Set NEXT_PUBLIC_OJ_SUPABASE_URL and NEXT_PUBLIC_OJ_SUPABASE_PUBLISHABLE_KEY through account-owner-managed hosting settings (publishable key only). Set OJ_WORKSPACE_URL to the exact HTTPS app origin; it defaults to the private Tailscale origin. Never read/copy legacy environment files or service keys.

Review supabase/schemas/workspace.sql and collaboration.sql. They are desired-state schemas, not applied migrations. Inspect for existing oj_* objects, generate and review an additive migration through the declarative workflow, and verify against staging. Run workspace.sql before collaboration.sql on a clean test database. Existing legacy OJ leads remain untouched. The new collaboration schema conditionally adds workspace tables to Supabase Realtime publication; never publish private invitations or auth records.

Bootstrap the OJ organization and Oscar's owner membership using his verified Auth user ID, through the authorized project administrator. Then use /workspace/team to create Jacob's email-bound member invitation. Invitation links expire after seven days; tokens are hashed in private storage, single-use, revocable and checked against verified Auth email. Members/viewers cannot issue invitations or edit memberships. Owners can manage member/viewer access but cannot grant owner access or remove owner accounts through the app. Direct signup alone grants no business membership. Do not store tokens, passwords or GoHighLevel credentials in cards, descriptions or comments.

Configure Auth URL allowlists for this origin's /auth/callback and /join/* destinations. Verify the project's email templates preserve the RedirectTo URL and use the PKCE callback flow. Confirmation/recovery links must open in the browser where the flow started, because the verifier is stored there. Enable email confirmation and a suitable password policy. Invitation signup requires the email provider to be enabled and signups permitted; do not change these settings on the legacy project before checking its existing workflows. If its signup policy must remain disabled, provision Jacob's Auth account through the administrator and have him sign in to accept the invitation. Configure production SMTP and rate limits; the built-in mail provider is for limited testing.

## Before production

### Current private preview hosting

Tailscale Serve exposes the built app at `https://desktop-lbi2ein.tail3f006f.ts.net:10000/preview`, forwarding to the loopback-only production server on port 3011. This is tailnet-only; public Funnel is not enabled for this app. Existing 443 and 8443 services are preserved. Local and Tailscale HTTPS preview requests returned HTTP 200.

The app process runs while this PC remains on; automatic restart after reboot is not configured. Start it with `scripts/serve-local.ps1` after a successful build. Logs are in `C:/STRATHOS/reports/oj-workspace-server.stdout.log` and `.stderr.log`. Disable only this proxy with `tailscale serve --https=10000 off`. The URL serves sample preview data; business accounts remain unconfigured.

- Repeat permission tests on actual staging Supabase using Oscar, Jacob, viewer and unauthenticated sessions.
- Before giving Jacob network access, scope his Tailscale permissions to this app's HTTPS port 10000. Membership in OJ does not itself restrict access to other tailnet services. The OJ app has no private STRATHOS routes; private dashboard authentication and tailnet network grants remain separate controls.
- Verify login, invitation signup/acceptance, recovery, signout and membership removal with actual accounts. These interfaces are built; live Auth/email verification remains pending.
- Verify card creation/editing, stale-save rejection, comments, activity history and shared visibility on two devices. Realtime subscriptions, authenticated refresh polling and activity feed are built but live Realtime remains unverified. Open drafts remain intact on remote changes and must be reloaded before saving a stale revision. Offline editing pauses; no offline write queue is offered.
- Add scoped attachment storage, file validation and short-lived authorized download URLs before offering attachments.
- Verify the live team label and owner/member/viewer controls use verified membership, not preview labels. Database access ends immediately on revocation; connected active boards recheck within 15 seconds, and on focus/reconnection.
- Complete board pagination/search on the server before workloads exceed the first 1,000 cards/comments. Current foundation uses a bounded initial load.
- Review public preview availability: contains no private data, but should be removed or intentionally retained for demos.
- Test backup restoration and migration rollback, run dependency/security review, configure monitoring and alerts.
- Move legacy schedulers only during coordinated cutover; never run both SMS send loops.
- Set HTTPS hosting with persistent background worker service for integrations; no dependency on Oscar's desktop remaining on.

Do not mark the shared system production-ready while these gates remain outstanding.
