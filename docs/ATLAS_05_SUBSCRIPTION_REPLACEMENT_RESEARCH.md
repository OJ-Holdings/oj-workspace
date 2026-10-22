# ATLAS 05 — Subscription Replacement Program + Reverse Engineer Anything Research

> Research and architecture, **not a claim that software has been installed, cloned or subscription spending eliminated**.
> Snapshot: 2026-10-22. Verify upstream licenses, releases, costs, API terms and actual feature parity again before implementation.
> Primary research reference: [NabilRFG12 / Reverse-Engineer-anything](https://github.com/NabilRFG12/Reverse-Engineer-anything).
> Companion: [master](./ATLAS_V3_MASTER_INDEX.md) · [feature atlas](./ATLAS_03_FEATURE_ATLAS.md).

## 1. The practical objective

Stop paying for avoidable *software functionality* by building an OJ-native implementation, adapting properly licensed open-source modules, using official APIs, or self-hosting appropriate software. **Do not duplicate separate vendor interfaces that still require manual sync.** ATLAS's value comes from operating the whole OJ company in one consistent data model.

A paid subscription has five different cost components:
1. **Software logic:** pipeline boards, scheduling, reports, approvals, workflow rules — often viable to implement independently.
2. **Hosting and reliability:** backups, email deliverability, queues, uptime, storage — not free even if code is free.
3. **Third-party networks/data:** paid advertisements, Google Maps, Stripe/processor fees, domain/email, messaging/SMS/voice minutes, financial data aggregation, external premium datasets — cannot be made free by reimplementing the UI.
4. **Regulated/high-liability functionality:** accounting/tax interpretation, payroll disbursement, insurance, employment law, compliance and banking — require qualified oversight or paid vendors where appropriate.
5. **Vendor-specific advantages:** proprietary datasets, distribution network, licenses and contracts — cannot be reproduced just by reverse-engineering client-side code.

**Business decision:** Build routine internal workflows; **buy or integrate hard infrastructure** when it avoids legal, security, cash or reliability risks; **reuse properly licensed open source** when speed is important.

## 2. What REA actually is

Project: **REA — Reverse Engineer Anything**, GitHub [NabilRFG12/Reverse-Engineer-anything](https://github.com/NabilRFG12/Reverse-Engineer-anything); checked its published README/license on 2026-10-22.
- It is an agent/MCP-assisted **investigation framework**, not a commercial SaaS clone generator and not access to a vendor's server or paid API.
- Published capabilities include examining a target's front-end/browser behavior, static JavaScript/Electron code/maps/imports/IPC, .NET metadata, native binaries via Ghidra/Hopper/IDA configurations, permitted local runtime observations, and evidence/dossiers. Platform/provider support is specific and not universally available.
- The README lists setup through \`npx rea-agents setup\`, and JavaScript inspection through \`npx -y rea-agents@latest analyze-javascript-application /absolute/path/to/app --json\`.
- Documentation currently states Node.js 22.x (>=22.19), 24.x (>=24.11), or 26+ and npm for the base REA tooling; individual native targets may require licensed/distributed tools and host support. Windows Ghidra native support is described as experimental.
- The repo is **MIT licensed** (license applies to REA itself, **not** to the proprietary targets inspected); its own disclaimer requires lawful authorization.
- Analysis may run locally, but findings transmitted to a coding assistant remain subject to the assistant/provider's privacy terms. Never send OJ customer records, passwords or private app keys to arbitrary analysis targets.
- A public page's network or compiled code does not grant a right to copy proprietary source/trade dress, bypass access controls, scrape personal data or sidestep license/usage contracts.

**Official-source citations:**
- https://github.com/NabilRFG12/Reverse-Engineer-anything
- https://github.com/NabilRFG12/Reverse-Engineer-anything/blob/main/LICENSE
- https://github.com/NabilRFG12/Reverse-Engineer-anything/blob/main/docs/installation.md

### Safe ATLAS investigation procedure

\`\`\`text
1. Write feature hypothesis and record why OJ needs it.
2. Inspect documentation, screenshots, accessible UX and published APIs first.
3. Prefer OSS project with verified license, tests and supported deployment.
4. If REA is useful: choose a target owned by us, open-source, a synthetic fixture,
   or an app we are explicitly authorized to inspect.
5. Record permitted scope, target version, exact source URL/hash, tool version,
   observed behavior, confidence, limitations and review author.
6. Produce an INDEPENDENT ATLAS behavior spec without copied vendor branding,
   code, assets, proprietary interfaces or secrets.
7. Implement against OJ's typed domain API; test parity with our own fixtures.
8. Add security, performance, licensing, data-retention and total-cost checks.
9. Measure actual operating benefit; don't ship a clone because it looks cool.
\`\`\`

**Do not:** bypass DRM/license checks or authentication, use stolen client binaries or private repos, extract subscriber-only assets, steal API keys or proprietary datasets, evade rate limits/anti-bot gates, impersonate a vendor, scrape private contacts, or deploy a decompiled proprietary component into OJ Workspace without appropriate rights. Legal research may be possible without any of those actions.

### Initial REA research tasks to approve separately

| Case ID | Investigation | Preferred target | Expected evidence | Production gate |
| --- | --- | --- | --- | --- |
| REA-01 | Contact/record relationship UX | Own OJ Workspace + openly licensed Twenty demo | State chart, search behavior, screenshot annotations | Separate independent design; review AGPL/SDK license |
| REA-02 | Field checklist offline queue | Own synthetic service-worker prototype | Conflict/failure behavior, retries, drafts | Cross-device data-loss tests |
| REA-03 | Fleet schematic inspection UI | Owned sample rig model and own assets | Component selection graph | Verified dimensions and safety disclaimer |
| REA-04 | Complex schedule conflict handling | Public documented APIs; authorized Cal-like test project | Conflict/atomicity contract | No vendor source copied without compliance |
| REA-05 | E-commerce reconciliation | Synthetic Shopify order/webhook fixtures | State transitions and settlement labels | Actual platform OAuth and replay tests |
| REA-06 | AI agent orchestration UI | Own STRATHOS sandbox + permissive examples | Approval/stop and cost-flow model | Strict separation from live company data |
| REA-07 | Media review/timestamp annotations | Own test video and open reference implementation | Version annotation contract | Rights check on sample assets |

These are **research proposals**, not permission to install tools on a founder's machine or execute arbitrary binaries.

## 3. Paid software capability replacement map

Classification:
- **BUILD:** narrow native ATLAS replacement based on our workflows is plausible.
- **ADAPT:** assess open-source implementation/API with license compliance.
- **CONNECT:** official external provider/data infrastructure remains source of truth.
- **KEEP/BUY:** higher risk, regulatory exposure or network effect means do not recreate casually.
- **HYBRID:** native management UI + external transport/system.

No price is asserted below; current pricing and subscription tiers vary. Each vendor is a **capability benchmark**, not an endorsement or permission to copy its protected code.

| Software / category benchmark | The useful capability to make native in ATLAS | Candidate strategy | Decision risk / exception |
| --- | --- | --- | --- |
| Jobber | Lead → quote → schedule → field work → invoice pipeline | BUILD | Payment settlement still requires provider |
| Housecall Pro | Dispatch, field work orders, client service | BUILD | SMS/payments keep paid transports |
| ServiceTitan | Production, route, service unit economics | BUILD selectively | Giant ERP-scale scope; don't replicate all |
| ServiceM8 | Mobile field crew and photo checklist | BUILD | iPhone/offline E2E required |
| ResponsiBid | Window/exterior quote calculations | BUILD | Field-rate validation |
| QuoteMachine / QuoteWerks | Estimate templates, scope revisions | BUILD | Legal acceptance/signature gates |
| Fleetio | Fleet maintenance, costs, faults, inspections | BUILD | Measured mileage/asset specs |
| MaintainX | Asset work orders, checklists and maintenance | BUILD | Safety standards and asset warranty |
| UpKeep | Preventive maintenance and parts inventory | BUILD | Reminder data quality |
| Samsara | Vehicle telemetry dashboard | HYBRID | Hardware, SIM, device contracts cannot be cloned |
| Verizon Connect | GPS fleet routes and dispatch visibility | CONNECT/KEEP | Tracking hardware, consent and fees |
| QuickBooks | Invoices/expenses/categories/financial reports | HYBRID | Bookkeeping compliance, accountant review |
| Xero | Reconciliation and accounting | HYBRID | Bank feeds and ledger controls |
| FreshBooks | Service invoice and expenses | BUILD + CONNECT | Processor fees remain |
| Wave | Basic accounting and invoicing | HYBRID | Settlement and tax considerations |
| Stripe Billing | Recurring invoice management | CONNECT | Payment rails and fees are essential provider |
| Ramp | Expense cards, approvals and receipt matching | BUILD + CONNECT | Card issuance/banking not buildable internally |
| Expensify | Receipt scanning and reimbursements | BUILD | Payout remains reviewed external action |
| Bill.com | Payables approval workflows | BUILD + CONNECT | Actual payments external |
| HubSpot | CRM record model, activity, opportunities | BUILD/ADAPT | Provider-only ecosystem integrations |
| Pipedrive | Deal stage pipeline, forecast | BUILD | Avoid fuzzy CRM identity joins |
| Salesforce | Custom object and approval workflow | BUILD selectively | Massive enterprise administration scope |
| Attio | Flexible modern CRM model | ADAPT/BUILD | Entity schema and ACL complexity |
| GoHighLevel | Leads, pipelines, conversations and agency accounts | CONNECT + BUILD | Already connected; don't break source |
| Close CRM | Sales cockpit, activity queue | BUILD | Calls and messages external provider |
| Apollo.io | Prospect workflows and enrichment | HYBRID | Proprietary contact data cannot be self-generated |
| ZoomInfo | B2B contact intelligence | KEEP/BUY if justified | Proprietary dataset/licensing |
| ClickUp | Tasks, docs, dashboards, Gantt | BUILD/ADAPT | Only needed workflow slice |
| Asana | Tasks, approvals, project portfolio | BUILD/ADAPT | Prevent duplicate task authority |
| Monday.com | Flexible workflows and board templates | BUILD | Governance and revision versioning |
| Linear | Precise issues and triage | BUILD | Engineering workflows should remain on GitHub where appropriate |
| Notion | Wiki, SOPs, templates and structured docs | BUILD/ADAPT | Rich editor and permissions are expensive |
| Airtable | Typed custom objects, views and rollups | BUILD | Don't permit arbitrary SQL across tenant scopes |
| Calendly | Booking/demos and availability | BUILD/ADAPT | Calendar/provider sync and DST |
| Cal.com | Calendar booking scheduling components | ADAPT | Verify AGPL vs enterprise code boundaries |
| Zapier | Trigger/action automation | BUILD/ADAPT | OAuth/quotas and action confirmations |
| Make | Visual workflow orchestration | BUILD/ADAPT | Reliability and idempotent executor |
| n8n | Internal workflow graphs | ADAPT internally only if license permits | Sustainable Use License is not OSI-open source |
| Activepieces | Permissively licensed automation core | ADAPT | Enterprise packages separately commercial |
| Metabase | Dashboards and SQL business intelligence | ADAPT | Community AGPL and enterprise license |
| Power BI | Finance and cross-venture scorecards | BUILD/ADAPT | Advanced enterprise connectors may remain paid |
| Tableau | Analytics and exploration | BUILD selectively | Viz sophistication/time |
| Datadog | Observability alerts and telemetry | BUILD + ADAPT | Infrastructure and storage recurring cost |
| Sentry | Error tracking/issue triage | CONNECT/ADAPT | License and hosted costs verify |
| Statuspage | Service status and incident updates | BUILD | Operational health must be measured |
| Gusto | Payroll and employee filings | KEEP/BUY | Wage/tax legal complexity |
| Rippling | HR records, onboarding and permission tasks | BUILD selectively | Payroll/device identity external |
| BambooHR | Team record and PTO workflows | BUILD selectively | HR confidentiality |
| Docusign | E-signature and audit trail | ADAPT/CONNECT | Enforce legal signature validity |
| PandaDoc | Sales proposal review and acceptance | BUILD + CONNECT | E-sign/legal receipt |
| Jotform | Field/customer forms | BUILD/ADAPT | Spam/security/privacy gates |
| Typeform | Fancy customer onboarding forms | BUILD/ADAPT | Accessibility and consent |
| Tally | Form builder and conditional pages | ADAPT | License/release audit |
| Dropbox / Drive | File browsing, versions, permissions | CONNECT | Storage backup/ownership |
| Frame.io | Timestamped media review and versioning | BUILD selectively | Video delivery/storage cost |
| Vimeo Review | Internal cuts and approvals | BUILD/CONNECT | Encoder/transcoding cost |
| Buffer | Content scheduler and post receipts | BUILD + CONNECT | Platform APIs/approval limits |
| Later | Multi-channel publishing calendar | BUILD + CONNECT | API/limits |
| Hootsuite | Social inbox and approvals | BUILD + CONNECT | Paid social platform APIs |
| TubeBuddy | YouTube metadata/optimization workspace | BUILD + CONNECT | Public rankings never guaranteed |
| vidIQ | Creator research and performance | BUILD + CONNECT | Proprietary insight/data limitations |
| Triple Whale | Shopify order attribution and margin | BUILD + CONNECT | Pixel/first-party data/causal limits |
| Klaviyo | Ecommerce email segmentation and campaigns | HYBRID | Email deliverability/compliance remains |
| Mailchimp | Audience, forms and campaign reports | BUILD + CONNECT | Email sending provider remains |
| Chatwoot | Omnichannel inbox/support | ADAPT | Channel access and consent |
| Intercom | Client helpdesk, tickets, AI handoff | BUILD/ADAPT | Actual customer communications external |
| Zendesk | Ticket lifecycle and SLA | BUILD | Enterprise depth not initially needed |
| Canva | Template/design workflow | BUILD selective assets | Licensed stock/fonts and editor cost |
| Adobe Creative Cloud | Asset review, lightweight crop/resize, thumbnails | BUILD selectively | Do not pretend to replace Photoshop/Premiere fully |
| Loom | Team video updates and review | BUILD selectively | Encoding/storage and sharing |
| Fathom / Fireflies | Meeting summary and action suggestions | BUILD + CONNECT | Recording consent + transcription cost |
| 1Password | Secure company credential management | KEEP/BUY | Do not casually implement password vault |
| Cloudflare | DNS/proxy/WAF/CDN | KEEP/BUY | Internet infrastructure not replaceable by UI |

## 4. Real open-source candidates and license status

**Licenses below are descriptions of sources inspected in October 2026, not permission to copy entire products into our app.** Verify current upstream files, component-level conditions, trademarks, commercial-feature exceptions, provenance and network-distribution obligations.

| Project | Official repo / verified policy | Possible ATLAS use | License boundary |
| --- | --- | --- | --- |
| **REA** | https://github.com/NabilRFG12/Reverse-Engineer-anything | Evidence-based UI/runtime investigation | MIT on REA itself; never applies to investigated targets |
| **Twenty** | https://github.com/twentyhq/twenty and https://github.com/twentyhq/twenty/blob/main/LICENSE | Modern CRM patterns and/or isolated connector | Most core AGPLv3; commercial files explicitly excluded; certain SDK/UI packages MIT; published application exception |
| **Activepieces** | https://github.com/activepieces/activepieces and https://www.activepieces.com/docs/about/license | Automation rules, connectors and execution references | Core MIT; enterprise/cloud portions commercially licensed |
| **n8n** | https://github.com/n8n-io/n8n/blob/master/LICENSE.md | Possible internal workflow engine | Sustainable Use/fair-code, **not OSI-open source**; enterprise exclusions; commercial embedding limitations |
| **Metabase** | https://github.com/metabase/metabase/blob/master/LICENSE.txt | Embedded internal analytics/reference | Core AGPL, enterprise components commercial |
| **Documenso** | https://github.com/documenso/documenso/blob/main/apps/docs/content/docs/policies/licenses.mdx | Legally reviewed e-sign integrations | Community AGPLv3, enterprise commercial; network terms matter |
| **ERPNext** | https://github.com/frappe/erpnext | ERP accounting/inventory/operations reference | Check current GPL code and integration boundaries before adoption |
| **Plane** | https://github.com/makeplane/plane | Issues/project UX benchmark | Verify current community/enterprise license and component exclusions |
| **Chatwoot** | https://github.com/chatwoot/chatwoot | Support inbox/reference | Verify upstream license and paid channel constraints |
| **Cal.com** | https://github.com/calcom/cal.com | Scheduling API/reference | Verify current AGPL/community and separate enterprise features |
| **Paperless-ngx** | https://github.com/paperless-ngx/paperless-ngx | Scannable document organization reference | Verify current GPL and dependency terms |
| **Formbricks** | https://github.com/formbricks/formbricks | Feedback/forms benchmarking | Verify license and enterprise modules |
| **Umami** | https://github.com/umami-software/umami | First-party website analytics reference | Verify license/current deployment |
| **OpenProject** | https://github.com/opf/openproject | Project/dependency workflows | Verify GPL/enterprise modules |
| **Frappe CRM** | https://github.com/frappe/crm | CRM/funnel reference | Verify license/version and integration fit |

Useful independent overviews (not licenses): https://www.shopify.com/enterprise/blog/open-source-erp-and-crm and https://www.ossalternatives.org/alternatives-to/asana.

## 5. Build vs adapt vs connect score

Every candidate gets a written answer to:
1. What recurring software charge might be avoided? What **real** current charge does OJ already pay? If none, savings are $0 until proven.
2. How many hours of founder work disappear weekly? Are they converted into actual customer capacity?
3. Does it require source data we can legally, reliably acquire and keep?
4. How many founder+engineer hours for MVP, parity, security, documentation and ongoing maintenance?
5. Is there an OSS product whose license, deployment, dependency and support cost is better?
6. What external payments/phone/email/maps/advertising/cloud costs remain regardless?
7. What is the risk of data loss, unaudited payout, customer privacy failure, or legal mistake?
8. How much additional value arises **because** the tool is linked to our own customer/job/crew/money graph?

### Practical score model

\`\`\`text
annual_estimated_savings = verified_current_subscription_spend_that_is_replaced
  - new_hosting_cost - external_API_usage - backup/monitoring_cost
  - ongoing_maintenance_cost - transition_and_support_cost

capacity_value = independently_measured founder_hours_saved *
                 conservative_realized_value_per_hour

build_only_if = reliability/security acceptance passes
  AND (annual_estimated_savings + capacity_value + cross_domain_value)
      justifies engineering opportunity cost versus other OJ work.
\`\`\`

Never put “saves $500/month” on HQ without actual canceled subscription receipts and replacement quality evidence. Do not treat free OSS as free operations.

## 6. Subscription replacement priority

**Lane 1: high-leverage native features** — field quote, multi-building bid, follow-up workflow, crew dispatch, commercial property history, photo QA, maintenance and parts, customer portal, board and review. They use our unique existing Exterior business data and work.

**Lane 2: cross-venture shared surfaces** — real CRM entity cockpit, calendar, task work, expense/procurement review, document vault, goals, source-aware analytics and automation approvals.

**Lane 3: OSS-assisted internal engines** — BI, OCR/doc indexing, automation execution, email templates and video comments, with staged evaluation, security and license checks.

**Lane 4: paid infrastructure stays external** — settlement/payment processors, compliant bulk email/SMS/voice, banks, premium geocoding/maps, domain/email, production-grade backups, insurance, payroll legal duties and specialized proprietary datasets.

**Lane 5: advanced labs** — REA-evidenced tool research, AI agent workbench, 3D rigs, property segmentation and experimental content intelligence, only when core workflows are dependable.

## 7. Repo research registry specification

Create future structured registry records with:
- \`candidate_id\`, \`feature_ids\`, \`paid_benchmark\`, \`target_capability\`, \`reference_repo\`, \`observed_version\`
- \`copyright_owner\`, \`license_url\`, \`license_type\`, \`copyleft_obligations\`, \`commercial_exclusions\`, \`trademark_notes\`
- \`investigation_authority\`, \`target_hash\`, \`REA_version\`, \`evidence_urls\`, \`limitations\`
- \`build_or_connect\`, \`authoritative_source\`, \`security_review\`, \`operational_cost\`, \`decision_owner\`, \`review_date\`, \`status\`.

Default \`status=research-only\`; no automatic package installation, decompilation, copying, account connection or SaaS signup.

## 8. Immediate implementation philosophy

**No indiscriminate “reverse engineer 60 tools.”** First identify real OJ value; map vendor capability behavior from documentation and authorized observations; spec a small independent feature; link it to canonical data; test using synthetic fixtures; compare outcomes; then decide if an OSS engine is worth embedding.

REA is especially appealing as a **research accelerator in a sandbox**, not as an authorization bypass or a reason to add a giant reverse-engineering runtime to the live business server.

## 9. Licensing review checklist (must pass)

- Is the project genuinely OSI open source, source-available with special limits, dual licensed, or proprietary?
- Are enterprise portions in otherwise open repositories clearly excluded?
- Does AGPL/GPL apply to networked derivative works, modifications or linking? Does the official application exception change this?
- Are fonts, images, templates and branding under separate licenses?
- Are third-party data collection and account access permitted by API/developer terms?
- Are hosted marketplace/commercial embedding/rebranding terms distinct from internal self-hosting?
- Can we comply with license notices, source distribution, attribution and trademark limits?
- Has a maintainer/security reviewer documented the decision before source reuse?
- Do we retain a copy of version/license decision and SBOM for future audits?

**Policy:** when unclear, independently implement behavior using our own source and synthetic tests, or seek permission. This is engineering design guidance, not legal advice.
