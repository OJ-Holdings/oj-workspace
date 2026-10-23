# ATLAS V3 — Release 13 NEXUS Project 360 Founder Acceptance

> **Verification plan, not a claim of successful live QA.** The records and security checks described here were reviewed in the repository and through read-only Supabase project metadata, not through a confirmed Windows/Tailscale release or Oscar/Jacob device session.

## Code source of truth

| Release | Merged PR | Merged SHA | Exact-head CI |
| --- | --- | --- | --- |
| R13: NEXUS Project 360 | [#74](https://github.com/OJ-Holdings/oj-workspace/pull/74) | `e034b19f64eb6b2bdce40cd2817f40c09ed4841d` | `39906488281` SUCCESS |
| R13.1: Corporation rail and Fleet/Commercial handoffs | [#75](https://github.com/OJ-Holdings/oj-workspace/pull/75) | `397243c283e092a16bff5c49696234b849816f96` | `39907267432` SUCCESS |

**Superseded branch:** [#73](https://github.com/OJ-Holdings/oj-workspace/pull/73) was closed **without** merging because #74 delivered the canonical Exterior source graph first. Do not merge #73 or deploy its duplicate component/graph contract.

### What Release 13 actually implements

- The EXISTING Exterior Projects tab, `/workspace/b/exterior/projects`, uses `AtlasNexusProjects` and `buildNexusOverview` to show locally saved commercial estimates, site entries, internal modeled economics, candidate Fleet assets, exact source bookings, booking-linked source leads/customers, shared task snapshots and already-recorded task activity.
- Source edges are labeled **verified source**, **device-local plan**, **text receipt** or **unverified**. An entered project booking UUID resolved in loaded source records is still a manually asserted relationship; a shared task description with an exact project ID is not a canonical project foreign key.
- The corporation COMMAND rail and capability library link to this **same** NEXUS project view. Fleet planning cards open the corresponding NEXUS project, and the Commercial portfolio toolbar opens the currently selected **last-saved snapshot**.
- Preview and read-only workspace roles may navigate but must **never load an editor's device-local commercial or Fleet JSON**. Cross-organization Fleet workbook identity is rejected in graph logic even with an empty portfolio.
- NEXUS only reads. It does not create a project in Supabase, import local projects to the server, send proposals, assign crews, reserve equipment, collect payments, book suppliers, update a task or dispatch work.

## Founder manual acceptance scenarios

### A. Corporate navigation and device/role behavior

1. On the **actual** Windows host with the authenticated Oscar owner account, open the main sidebar **NEXUS / Project 360**. Confirm it navigates to the **Exterior Projects source view**, not a second duplicate NEXUS implementation. Check that it is discoverable in the Capability Library / command search.
2. On the same device, save a disposable private commercial portfolio project, open it through NEXUS and verify the project's local revision and source labels agree with the original Commercial Estimating register.
3. In Fleet Command's 7/30/90-day project cards, follow **Open in NEXUS / Project 360** and verify the exact local project opens; in Commercial Estimating, follow **NEXUS / Last saved snapshot** and verify unsaved edits are NOT silently represented as saved or synchronized.
4. Follow **Open project editor** from the NEXUS project. Confirm existing unsaved-change prompts protect any estimate currently in progress.
5. Repeat on a viewer account and the public preview. Neither should access the owner's locally saved workbook; any shared tasks exposed elsewhere still require the existing server role checks.
6. Repeat on Jacob's independent browser and iPhone. The project should only exist there after an **explicit trusted private import**; shared membership does not synchronize local project estimates or equipment plans.

### B. Exact booking → customer → task linkage

1. Select a project with a legitimate exact Exterior booking ID returned in the current user's source data. Check the recorded date/status and the customer relationship uses `booking.lead_id`, not fuzzy matching on name, address, phone or price.
2. Test unloaded and cancelled bookings in a disposable environment. NEXUS must label the booking/customer unverified or inactive and must not infer that work can be dispatched.
3. Test partial booking/lead source coverage, including more source records than loaded results. NEXUS must warn that missing matches are unknown, **not nonexistent**.
4. Create a real shared task through the normal authorized task editor with an exact `Local portfolio project ID` text receipt. NEXUS may show the task but must label the relationship as textual, **not** an authoritative database foreign key. Similar names, malformed multiline IDs and other-company tasks must not match.
5. Confirm recorded task activity only includes actual already-loaded events for exact linked tasks. No fabricated project/asset audit entries, fake founders, timestamps or phantom signatures.

### C. Operational exceptions and privacy

1. Check a project with insufficient entered crew-day capacity, unresolved access review, zero planned lift days for a lift-access building and equipment marked needs-service. Confirm each presents as planning attention, not proof of actual risk resolution, insurance, rental, staff availability or client approval.
2. Configure two projects with different exact loaded booking dates on the same day and the same candidate asset ID. Confirm any overlapping allocation is labeled possible contention, **not proven actual time overlap** or a reservation.
3. Confirm internal estimate price and modeled contribution are labeled hypothetical internal scenarios, not recognized revenue, gross profit or client contractual commitment.
4. Inspect the Project 360 information on both desktop and iPhone. Keep long project names, task text and property names from clipping actionable controls. User-entered names may themselves contain PII: do not assume names are sanitized just because address/note fields are omitted.
5. Corrupt or provide another organization's local portfolio/Fleet workbook in an isolated test profile. Confirm a visible fail-closed error and **no overwrite**, not a silent switch to a different company or mock data.

### D. Live production and protected database gates

1. Record the actual Windows-hosted app SHA using `scripts/verify-production-windows.ps1`; compare the served build to current GitHub `main`. CI only proves the repository build; it does **not** establish the production SHA.
2. Conduct a protected private PostgreSQL backup and an **independently isolated restore drill**. Record actual row count, Auth/Storage/RLS, checksum, recovery evidence and required paid-plan/PITR limitations as applicable. This is still NOT evidenced by a GitHub merge.
3. Complete a **private, read-only privileged-function security review** using the current Supabase Security Advisor. Elevated function execution advisories require function-by-function access and authorization review before new migrations/privilege changes; they are not themselves proof of an exploitable vulnerability. Never paste private credentials or sensitive function details into public tickets or repo logs.
4. Confirm actual RLS policies against intended owner/member/viewer/anonymous roles and legacy Exterior booking ownership before writing any canonical project/asset schema. On a new server implementation, require explicit owner approval, additive migration, tenant tests, transaction-safe revisions, opt-in source import with identity reconciliation and migration rollback.
5. The older draft PR #42 remains protected and **unmerged**. No new SQL should be placed in the normal guarded code-only Windows deploy path.

## Current acceptance ledger

| Required evidence | Status at creation |
| --- | --- |
| Source code R13 and R13.1 exact-head CI | Passed; see table |
| Read-only live Supabase table discovery | Observed: workspace membership/tasks, legacy booking tables with RLS enabled; no shared commercial/Fleet tables among reviewed public schema |
| Current Supabase security advisor | Reviewed; privileged execution advisory categories remain for private audit |
| Actual private database backup + isolated restore | Not verified |
| Oscar owner desktop NEXUS exercise | Not observed |
| Jacob independent browser data-isolation exercise | Not observed |
| Preview/viewer negative permissions | Not observed |
| iPhone responsive and source-link QA | Not observed |
| Exact Windows production release SHA | Not independently verified |
| Canonical multi-device Commercial/Fleet database sync | Not implemented |
