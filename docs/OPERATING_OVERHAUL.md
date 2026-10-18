# Operating workspace overhaul

## Audit and priorities

Inspected the running /preview app, shared shell, navigation, tasks, business views, data loaders, reporting and collaboration code. Baseline screenshots are in docs/screens/overhaul. The repository was clean and current before work began; implementation is on codex/oj-operating-workspace.

1. Correct operational reporting: completing work must not imply payment; unknown costs must not imply profit. Preserve completion dates and disclose source coverage.
2. Connect daily work: searchable loaded records, addressable task/customer/file/event/message links, preserved business context, guarded task drafts and filtered task metrics.
3. Make the interface compact and coherent: replace decorative welcome area with today's work, group business sections, retain all existing destinations, make tables/forms/loading and keyboard interactions consistent.
4. Collaboration: explicit working status, linked tasks, expiry, last seen and reconnection through membership-verified infrastructure. Additive schema stays unapplied until reviewed; unavailable is distinct from offline.
5. Deterministic suggested work: evidence-backed triage, local enable/disable controls, reviewed task creation with source references, duplicate prevention and existing activity history. No outbound communications or paid inference.
6. Verify behavioral/database checks, build and desktop/mobile preview interactions. Production access and two-founder collaboration require actual authenticated sessions; do not substitute preview for that evidence.

## Design direction

Keep the OJ family recognizable: midnight #081022, slate surface #111c33, paper text #f3f6fc, work blue #6191ff, Exterior orange #f58220, Solutions copper #c98a6b. Essentials retains its existing cream and ink identity. Existing locally hosted Manrope handles body/forms, Sora handles concise headings, Cormorant is limited to Essentials branding. No new assets or dependencies are necessary.

Left-aligned workbench: quiet rail, compact context header, focused action strip, useful records. The three business identities remain the memorable visual element. Replace the generic oversized welcome graphic with current tasks and direct routes to work. Avoid identical decorative tiles for unrelated information.

    shared rail | search / workspace context / current work
                | compact business identity + primary action
                | Work | Customers | Results | Workspace
                | relevant sections, records and contextual actions

Audit versus brief: preserving the current giant hero would keep visual branding at the expense of daily use. Retain brand color and typography instead, and use the recovered space for actionable records. Groups must never hide the active section; mobile receives the same real destinations.

## Boundaries

No changes to private STRATHOS, secrets, existing personal/business records, external sends, accounting features, paid tools or live migrations/deployments. Preview data is labeled and isolated. Existing authorization remains authoritative. No invented revenue, completion, recovery, forecasts or online teammates.
