# OJ Solutions — Optional consultation SMS consent (Phase 1, staged)

Companion to `OJ-Holdings/ojsolutions-site` branch `feat/phase1-live-audit-alignment`.

## Status
- **Staged PR only. Do not merge / apply before founder approval.**
- A private intake Edge Function already processes consultation requests; the new build validates the optional boolean `smsConsent` and requires a phone number when checked.
- It persists affirmative consent and a server timestamp to `public.oj_solutions_consultations`, defaulting to **false**, never implicitly opting in from a phone number.
- Workspace's authenticated consultation inbox shows Yes/No per prospect.
- No SMS is actually sent by this work. This is a consent capture and audit trail, not an SMS campaign integration.
- Existing requests should automatically receive `sms_consent=false` after the database migration.

## Release dependencies
1. Founder approval of consent copy and real messaging practices.
2. Apply `supabase/pending/oj_solutions_sms_consent_phase1.sql` in the shared Supabase project, confirm constraint and RLS policies/grants remain intact.
3. Deploy revised `supabase/functions/oj-solutions-consultations/index.ts` with `verify_jwt=false` preserved. The allowed public origins are the real website only.
4. Deploy Workspace UI (Netlify) after schema is live; verify authenticated member read and negative consent value, while viewers/anonymous users cannot inspect records.
5. Only then merge the **website** PR, whose preview currently blocks live submissions.
6. End-to-end positive/negative test, verify no automatic texts and no emails/SMS with marketing content without separate permission.

## Safety notes
No secrets belong in website JavaScript. Do not transmit opt-in by URL parameters. Retain the immutable-consent trigger and column-limited member UPDATE privileges. Legal review of Privacy, Terms, STOP/HELP copy and retention expectations is still required.
