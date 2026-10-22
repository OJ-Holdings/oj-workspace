# ATLAS 03 — Comprehensive Feature Atlas

> **19 domains, 413 independently selectable capabilities.** All items are **proposed**, not declarations of shipped software. `GATE` = mandatory dependency; `CORE` = priority operating release; `ADV` = later evidence-driven breadth; `LAB` = experimental proof of value. A product may already contain a limited ancestor; check current code before rebuilding.

## Portfolio architecture

This ledger is intentionally exhaustive and designed for backlog conversion. One bullet is a feature candidate, not a promise to deliver in a single sprint. Prioritize vertical slices that actually share customers, jobs, assets, money and status. Put cross-record relationships **inside relevant screens**, not in a permanent redundant Connected Operations tab.

| Tier | Meaning | Practical gate |
| --- | --- | --- |
| GATE | Correctness, backup, auth, security, canonical identities | Proven before unrestricted persistence/writes |
| CORE | Highest-frequency founder/operating workflows | End-to-end on real authorized records |
| ADV | Richer enterprise capabilities | Validated demand, sufficient data, clear maintainer |
| LAB | Signature “wow” experience | User tested, physically/sources accurate, performant |


## FOUND — Core engineering, trust and identities

*Ownership:* FOUND domain lead to be assigned · *Default tier:* **GATE** · 22 candidates.

- **AT-001** [GATE] Canonical organization and venture registry — distinguish business brand from legal entity.
- **AT-002** [GATE] Production inventory and data lineage — document table ownership and source of truth.
- **AT-003** [GATE] Reversible Supabase Free backup and isolated restore rehearsal — actual evidence receipt.
- **AT-004** [GATE] Provider-qualified change and schema registry — additive, reviewed migration protocol.
- **AT-005** [GATE] Founder authentication and secure recovery — preserve existing user identity.
- **AT-006** [GATE] Capability-based role and RLS matrix — founder, employee, client, advisor.
- **AT-007** [GATE] Audit event envelope — immutable provenance for material state changes.
- **AT-008** [GATE] Stable canonical entity IDs — no silent rekeying of historic records.
- **AT-009** [GATE] External identifier/alias table — provider, remote ID, sync status and timestamps.
- **AT-010** [GATE] Optimistic revision controls — conflicts and stale changes cannot overwrite.
- **AT-011** [GATE] Outbox/idempotency contract — external actions only once with receipts.
- **AT-012** [GATE] Secrets vault and scoped credential ownership — never client-exposed.
- **AT-013** [GATE] Disaster recovery runbook and restore-point objectives — measured, not claimed.
- **AT-014** [GATE] Import validation and quarantine — malformed and duplicate records safely isolated.
- **AT-015** [GATE] Retention and privacy deletion rules — lawful, reviewed, auditable requests.
- **AT-016** [GATE] Integration error/coverage taxonomy — unknown ≠ zero and partial ≠ complete.
- **AT-017** [GATE] Trusted release SHA, CI and host status — exact main-to-host attestation.
- **AT-018** [GATE] Security adviser/RPC/grant audit — tested least privilege.
- **AT-019** [GATE] Observability with PII scrubbing — trace, error, correlation and incident IDs.
- **AT-020** [GATE] Data ownership and connector-to-domain contracts — read/write boundaries explicit.
- **AT-021** [GATE] Backwards compatibility / feature flags — reversible gated rollouts.
- **AT-022** [GATE] Two-founder acceptance fixtures — positive/negative cross-role E2E tests.

## HQ — Executive Command and founder collaboration

*Ownership:* HQ domain lead to be assigned · *Default tier:* **CORE** · 21 candidates.

- **AT-023** [CORE] Context-aware daily mission stack — ranked and evidence-linked.
- **AT-024** [CORE] Four-venture vitality strip — true current key figures and unknown states.
- **AT-025** [CORE] Personal priorities and owner handoff queues — Oscar/Jacob attribution.
- **AT-026** [CORE] Daily business status digest — changes since prior confirmed viewing.
- **AT-027** [CORE] Decision inbox with approval packet — not merely unread feed.
- **AT-028** [CORE] One-click sourced next action — authorized mutation paths.
- **AT-029** [CORE] 7-day time ribbon — service jobs, demos, shoots, commitments.
- **AT-030** [CORE] Executive revenue state waterfall — booked versus collected separation.
- **AT-031** [CORE] At-risk commitment board — stale, blocked, overdue and conflicts.
- **AT-032** [CORE] Goal/OKR portfolio — venture and company objectives linked to projects.
- **AT-033** [CORE] Founder meeting review journal — decisions converted to approved tasks.
- **AT-034** [CORE] Responsibility matrix — explicit single accountable owner per item.
- **AT-035** [CORE] Escalation policy and snooze ledger — deadline ownership retained.
- **AT-036** [CORE] Incident command lane — outage/job hazard/client issue priority.
- **AT-037** [CORE] Scenario snapshot with assumptions — board-style capital options.
- **AT-038** [CORE] What-changed revision playback — linked before/after differences.
- **AT-039** [CORE] Quick switch contextual ribbon — people, accounts, jobs, brands.
- **AT-040** [CORE] Saved role-specific HQ layout — user-owned versioned presets.
- **AT-041** [CORE] Operations screen-sharing TV mode — redacted PII and accessible.
- **AT-042** [CORE] Private end-of-day shutdown/handoff report — documented work.
- **AT-043** [CORE] Founder focus and distraction controls — intentional calm modes.

## CRM — Customers, identity, opportunities and commercial relationships

*Ownership:* CRM domain lead to be assigned · *Default tier:* **CORE** · 22 candidates.

- **AT-044** [CORE] Canonical people and organization contacts — shared with all domains.
- **AT-045** [CORE] Multiple service properties per account — validated addresses.
- **AT-046** [CORE] Contact consent and communication preferences — allowed channels documented.
- **AT-047** [CORE] Deduplication candidate review — reversible non-destructive resolution.
- **AT-048** [CORE] Opportunity stage engine per venture — distinct semantic funnels.
- **AT-049** [CORE] Customer 360 timeline — every linked authorized business event.
- **AT-050** [CORE] Manual/automated intake provenance — web, GHL, LSA, referral.
- **AT-051** [CORE] Next-touch schedule with owner — follow-up history.
- **AT-052** [CORE] Activity and communication receipts — draft versus actually sent.
- **AT-053** [CORE] Proposal and agreement association — version and status history.
- **AT-054** [CORE] Sales source and attribution with confidence — no guessed channel credit.
- **AT-055** [CORE] Tag/custom fields governance — typed and searchable.
- **AT-056** [CORE] Company account relationships and contact roles — buying committee map.
- **AT-057** [CORE] Customer satisfaction/review requests — opt-in and evidentiary states.
- **AT-058** [CORE] Recurrence and service-plan opportunities — renewal reminder.
- **AT-059** [CORE] Lost-deal reason register — differentiated abandoned/unqualified.
- **AT-060** [CORE] Pipeline aging and risk flags — source timestamps and owner.
- **AT-061** [CORE] Duplicate-safe import from CSV/CRM — preview then approved reconcile.
- **AT-062** [CORE] Client portal access and visibility — per-account permissions.
- **AT-063** [CORE] Contact geographic territory grouping — avoid inferred location.
- **AT-064** [CORE] Cross-business relationship permissions — never leak another venture's confidential data.
- **AT-065** [CORE] Account-level document and money links — scoped evidence view.

## TASK — Work, project portfolio, knowledge and decisions

*Ownership:* TASK domain lead to be assigned · *Default tier:* **CORE** · 22 candidates.

- **AT-066** [CORE] Personal task command views — by owner, due, urgency, source.
- **AT-067** [CORE] Unified stage and actual completion history — timestamps not inferred.
- **AT-068** [CORE] Project milestones and dependencies — critical path.
- **AT-069** [CORE] Kanban/list/timeline/board views — same underlying tasks.
- **AT-070** [CORE] Workload and capacity planner — owner hours and availability.
- **AT-071** [CORE] Subtasks and reusable checklists — reusable templates.
- **AT-072** [CORE] Custom approval types with required signer — quote, spend, publish.
- **AT-073** [CORE] Decision record with options and rationale — superseding decisions.
- **AT-074** [CORE] Meeting notes to reviewed action drafts — no silent creation.
- **AT-075** [CORE] Versioned file and comment evidence — link IDs.
- **AT-076** [CORE] Reusable work templates by business — standardized practices.
- **AT-077** [CORE] Issue/risk/incident register — severity, mitigation, recurrence.
- **AT-078** [CORE] Cross-project initiative portfolio — time and spend.
- **AT-079** [CORE] Searchable company procedures and SOPs — accountable owners.
- **AT-080** [CORE] Training/acknowledgment receipts — future crew onboarding.
- **AT-081** [CORE] Audit timeline for assignments and approvals — actor + reason.
- **AT-082** [CORE] Blocker/dependency alerting — not fabricated priority.
- **AT-083** [CORE] Saved views and collaborator filters — private/shared layouts.
- **AT-084** [CORE] Mobile quick-capture and offline draft queue — conflict-safe merge.
- **AT-085** [CORE] Time tracking and work-session context — authorized attribution.
- **AT-086** [CORE] Contract/insurance renewal obligations — owner reminders.
- **AT-087** [CORE] Secure bulk edits with diff review — no blind mass mutations.

## SCHED — Calendar, dispatch and real-world execution

*Ownership:* SCHED domain lead to be assigned · *Default tier:* **CORE** · 22 candidates.

- **AT-088** [CORE] Multi-source corporate calendar — timezone-safe event models.
- **AT-089** [CORE] Cross-venture day/week/month agenda — consistent date semantics.
- **AT-090** [CORE] Crew and vehicle resource lanes — double-booking prevention.
- **AT-091** [CORE] Exterior dispatch board — crews, jobs, assets and site readiness.
- **AT-092** [CORE] Grounded job map with real geocoded addresses — missing stays unresolved.
- **AT-093** [CORE] Explicit ETA routing on demand — provider source and freshness.
- **AT-094** [CORE] Region and service territory planning — Milwaukee/Kenosha corridors.
- **AT-095** [CORE] Drive-cost/route scenario model — labeled estimates.
- **AT-096** [CORE] Work order lifecycle — queued, assigned, underway, QA, closed.
- **AT-097** [CORE] Site arrival/start/finish evidence — optional consent-based timestamps.
- **AT-098** [CORE] Checklist gated closeout — safety, photos, service quality.
- **AT-099** [CORE] Customer-facing appointment confirmation drafts — approval before send.
- **AT-100** [CORE] Service reschedule proposal with conflict check — no silent move.
- **AT-101** [CORE] Recurring service bookings and renewals — source-linked.
- **AT-102** [CORE] No-show/cancellation ledger — reason and charge policy evidence.
- **AT-103** [CORE] Employee skill and availability match — avoid invalid assignment.
- **AT-104** [CORE] Winter/weather contingency planning — sources current and opt-in.
- **AT-105** [CORE] Field emergency/stop work protocol — manual escalation.
- **AT-106** [CORE] Calendar subscriptions and permissions — revocable private links.
- **AT-107** [CORE] Photo/evidence sync with offline safeguards — retry and integrity.
- **AT-108** [CORE] Crew payroll/commission eligibility flag — not disbursement.
- **AT-109** [CORE] Supplier dropoff and equipment reservation timing — related job.

## EST — Commercial property intelligence, estimating and proposals

*Ownership:* EST domain lead to be assigned · *Default tier:* **CORE** · 24 candidates.

- **AT-110** [CORE] Property account with multi-building hierarchy — canonical ID links.
- **AT-111** [CORE] Site survey mobile capture — panes, floors, glass and access conditions.
- **AT-112** [CORE] Measurement confidence and photo annotations — explicit verification.
- **AT-113** [CORE] Building-by-building scope and exclusions — readable audit.
- **AT-114** [CORE] Cleaning production rate library — empirical range and source.
- **AT-115** [CORE] Labor burden and crew-size modeling — owner assumptions.
- **AT-116** [CORE] Lift access rental and mobilization costs — line item provenance.
- **AT-117** [CORE] Parking, travel, consumables and water costs — cost known/unknown.
- **AT-118** [CORE] Winter risk and weather contingency factor — not guaranteed conditions.
- **AT-119** [CORE] Bid price scenario tuner — target, competitive, protected.
- **AT-120** [CORE] Margin stress simulation — hours/rental/material overrides.
- **AT-121** [CORE] Commercial customer qualification score — evidence and confidence.
- **AT-122** [CORE] Two-founder bid review and revision comments — conflict-safe.
- **AT-123** [CORE] Internal cost sheet vs client scope sheet — privilege separation.
- **AT-124** [CORE] Branded estimate/proposal generation — audited template variables.
- **AT-125** [CORE] Proposal status and acceptance receipt — never equate sent to signed.
- **AT-126** [CORE] Recurring/maintenance contract options — interval and renewal evidence.
- **AT-127** [CORE] Version comparison and rollback — original terms retained.
- **AT-128** [CORE] Contract obligation and COI links — expiry and requirements.
- **AT-129** [CORE] Invoice schedule and deposit milestones — distinct cash states.
- **AT-130** [CORE] Win/loss bid analysis — attributable dates and reasons.
- **AT-131** [CORE] Shareable scoped customer review — revoke and watermark as appropriate.
- **AT-132** [CORE] Portable local bid import migration — never clobber founder edits.
- **AT-133** [CORE] Project kickoff from accepted scope — controlled state transition.

## FLEET — Vehicles, rig builder, maintenance and assets

*Ownership:* FLEET domain lead to be assigned · *Default tier:* **CORE** · 22 candidates.

- **AT-134** [CORE] Fleet master roster with VIN/serial safeguards — scoped asset view.
- **AT-135** [CORE] 2.5D truck/rig topology — components linked to real asset IDs.
- **AT-136** [CORE] Water tank volume and live-entered fill state — not invented sensors.
- **AT-137** [CORE] Verified payload/GVWR/axle constraints — sticker-backed safety checks.
- **AT-138** [CORE] Hose/reel/pump/injector component compatibility — manufacturer evidence.
- **AT-139** [CORE] Pressure/flow production scenario model — GPM and PSI correctly distinguished.
- **AT-140** [CORE] Surface cleaner and WFP/XERO device readiness — service assignments.
- **AT-141** [CORE] Chemical storage handling and PPE checklist — safety-first.
- **AT-142** [CORE] Pretrip departure inspection with digital receipt — driver and time.
- **AT-143** [CORE] Preventive maintenance intervals — calendar, engine-hours, miles.
- **AT-144** [CORE] Service ticket and fault codes — diagnosis history.
- **AT-145** [CORE] Consumable parts stock and reorder point — minimum inventory.
- **AT-146** [CORE] Supplier and compatible replacement catalog — check model/spec.
- **AT-147** [CORE] Parts cross-reference and source link — verify threads/material safety.
- **AT-148** [CORE] Equipment reservation per job and crew — availability/conflicts.
- **AT-149** [CORE] Rig purchase/upgrade planner — cost and payback scenarios.
- **AT-150** [CORE] Truck utility and fuel mileage log — reimbursement assumptions.
- **AT-151** [CORE] Vehicle insurance/registration/inspection reminders — document receipts.
- **AT-152** [CORE] Photo-based asset history and warranty — secure file references.
- **AT-153** [CORE] Fleet cost per billable hour/route — coverage flags.
- **AT-154** [CORE] Damage/incident investigation and lockout — approval and repair.
- **AT-155** [CORE] Garage/warehouse location and custody record — optional checkout.

## FIELD — Exterior crew, jobs, safety and client closeout

*Ownership:* FIELD domain lead to be assigned · *Default tier:* **CORE** · 22 candidates.

- **AT-156** [CORE] Lead response SLA with source timeline — no fake speed metric.
- **AT-157** [CORE] Residential property quote calculator — service type and scope.
- **AT-158** [CORE] House wash/soft wash chemical and dilution job plan — training gate.
- **AT-159** [CORE] Concrete cleaning productivity and area estimates — source rate.
- **AT-160** [CORE] Interior/exterior window pane measurement — count and access class.
- **AT-161** [CORE] Water-fed pole TDS/system readiness check — measurements entered.
- **AT-162** [CORE] Bin/deck/patio service checklists — customizable procedures.
- **AT-163** [CORE] Job preview pack with property photo map — consent and evidence.
- **AT-164** [CORE] Crew labor/drive time entries — supervisor review.
- **AT-165** [CORE] Job site hazards and stop-work checklist — mandatory guardrail.
- **AT-166** [CORE] Arrival and departure evidence — privacy-preserving.
- **AT-167** [CORE] Customer change order and scope approval — recorded acceptance.
- **AT-168** [CORE] Before/after photo QA — permission and correct job association.
- **AT-169** [CORE] Equipment consumption and fault reporting — fleet links.
- **AT-170** [CORE] Customer service issue/redo workflow — owner and remedy.
- **AT-171** [CORE] Invoice trigger after verified closeout — not automatic collection.
- **AT-172** [CORE] Warranty/service satisfaction follow-up — customer consent.
- **AT-173** [CORE] Review/referral invitation drafts — no unapproved texts.
- **AT-174** [CORE] Recurring maintenance offers — documented agreement.
- **AT-175** [CORE] Job direct cost known/missing coverage — distinguish estimated.
- **AT-176** [CORE] Property lifecycle/service history — seasonal suggestions.
- **AT-177** [CORE] Local Service Ads campaign and conversion records — tracked source.

## SOLS — OJ Solutions agency operations and AI-client delivery

*Ownership:* SOLS domain lead to be assigned · *Default tier:* **CORE** · 24 candidates.

- **AT-178** [CORE] Prospect ingestion provenance and list hygiene — no sent-status fiction.
- **AT-179** [CORE] Research workspace with local business evidence — compliant research.
- **AT-180** [CORE] Custom demo personalization draft — approved real client details.
- **AT-181** [CORE] Prospect scoring with explainable rubric — no false predictive claims.
- **AT-182** [CORE] One-to-one outbound message drafts — human approval and receipt.
- **AT-183** [CORE] Actual send/reply timeline from provider — integration permissions.
- **AT-184** [CORE] Appointment/demo calendar and rehearsal — source record.
- **AT-185** [CORE] Proposal and service package builder — setup plus recurring split.
- **AT-186** [CORE] Signed client onboarding with owner — contract receipt.
- **AT-187** [CORE] Agent/client configuration registry — integration key isolation.
- **AT-188** [CORE] AI receptionist scenario testing — synthetic consent-safe fixtures.
- **AT-189** [CORE] Call quality scorecards and transcripts — privacy and retention.
- **AT-190** [CORE] Voice escalation and human handoff playbook — failures are visible.
- **AT-191** [CORE] GoHighLevel contacts/opportunities paging — completeness.
- **AT-192** [CORE] Customer support ticket and SLA — incident-to-remediation.
- **AT-193** [CORE] Live service status and deployment receipts — measured signal.
- **AT-194** [CORE] Versioned prompt/agent changes and rollback — approved deployment.
- **AT-195** [CORE] Client reporting and ROI evidence — confidence and baseline.
- **AT-196** [CORE] Recurring invoice/renewal status — bank-verified when available.
- **AT-197** [CORE] Client-specific asset and file area — per-tenant ACL.
- **AT-198** [CORE] Privacy/consent compliance for call recording — jurisdiction-aware.
- **AT-199** [CORE] Upsell/renewal expansion opportunity — owner proposal.
- **AT-200** [CORE] Agency margin model by client and labor — missing cost flags.
- **AT-201** [CORE] Multi-client deliverable portfolio and deadlines — current.

## COMM — OJ Essentials e-commerce and growth

*Ownership:* COMM domain lead to be assigned · *Default tier:* **CORE** · 22 candidates.

- **AT-202** [CORE] Shopify order webhooks with replay-safe import — idempotency.
- **AT-203** [CORE] Product/SKU/variant master — supplier cross-reference.
- **AT-204** [CORE] Tested product evidence and sampling journal — actual test notes.
- **AT-205** [CORE] Supplier quotes and landed COGS worksheet — freight, tariffs where applicable.
- **AT-206** [CORE] Stock on hand and reservations — fresh-source badge.
- **AT-207** [CORE] Low-stock/out-of-stock exception queue — fulfillment priority.
- **AT-208** [CORE] Order/payment/fulfillment/refund state machine — not conflated.
- **AT-209** [CORE] Chargeback/dispute review and evidence pack — manual handling.
- **AT-210** [CORE] Unit contribution model — actual fees, shipping, returns, ads.
- **AT-211** [CORE] Paid ads spend connectors and manual allocations — confidence.
- **AT-212** [CORE] Customer lifecycle repeat-order and cohort metrics — identifiable scope.
- **AT-213** [CORE] Product page and creative experiment registry — attribution.
- **AT-214** [CORE] UGC/influencer campaign agreements — rights and expenses.
- **AT-215** [CORE] Marketing pixel/event consent governance — privacy settings.
- **AT-216** [CORE] Return reason and defect trends — denominators.
- **AT-217** [CORE] Supplier lead-time and quality-score history — observed.
- **AT-218** [CORE] Cash conversion cycle and reorder planning — inventory commitment.
- **AT-219** [CORE] Discount/bundle price laboratory — profit floors.
- **AT-220** [CORE] Shipping customer support integration — authorized outbound.
- **AT-221** [CORE] Multi-channel fulfillment adapter architecture — not presumed live.
- **AT-222** [CORE] Subscription and repeat-order opportunities — platform constraints.
- **AT-223** [CORE] Tax/shipping compliance evidence links — accountant-reviewed.

## MEDIA — Oscar Jacob production, audience and sponsorships

*Ownership:* MEDIA domain lead to be assigned · *Default tier:* **CORE** · 24 candidates.

- **AT-224** [CORE] Idea inbox with themes, hook and ownership — real durable record.
- **AT-225** [CORE] Treatment/script editor with versions — collaboration.
- **AT-226** [CORE] Storyboard, frame references and shot plan — media rights.
- **AT-227** [CORE] Cinematic mood and soundboard — licensed source assets.
- **AT-228** [CORE] Equipment/crew/location call sheet — availability and consent.
- **AT-229** [CORE] Shoot day calendar, checklist and transport — related asset.
- **AT-230** [CORE] Camera media intake and checksum verification — privacy.
- **AT-231** [CORE] Footage proxy/preview pipeline — storage budget.
- **AT-232** [CORE] Edit version history and timestamped review — immutable version links.
- **AT-233** [CORE] Thumbnail/title experiments — sourced results.
- **AT-234** [CORE] Publishing approval packet — manual channel posting.
- **AT-235** [CORE] Platform post URL and release receipt — actually published state.
- **AT-236** [CORE] Content calendar by channel and series — event source.
- **AT-237** [CORE] Channel analytics import with API coverage — no invented views.
- **AT-238** [CORE] Audience retention, watch time and cohorts — provider semantics.
- **AT-239** [CORE] Collaboration and talent release records — legal consent.
- **AT-240** [CORE] Music license and usage-right expiration — source doc.
- **AT-241** [CORE] Sponsor/brand contact and negotiation pipeline — CRM relationship.
- **AT-242** [CORE] Contract deliverables and usage windows — obligation.
- **AT-243** [CORE] Sponsor invoice and paid collection evidence — separate states.
- **AT-244** [CORE] Content production cost tracking — gear, time, travel.
- **AT-245** [CORE] Brand assets and motion graphics templates — own IP.
- **AT-246** [CORE] Series strategy and editorial objectives — learnings backed by posts.
- **AT-247** [CORE] Studio reliability/backlog risk — operator alerts.

## MONEY — Treasury, accounting evidence and capital allocation

*Ownership:* MONEY domain lead to be assigned · *Default tier:* **CORE** · 24 candidates.

- **AT-248** [CORE] Quoted/contracted/invoiced/paid state separation — explicit source.
- **AT-249** [CORE] Authorized bank account ingestion and reconcile — consent/least privilege.
- **AT-250** [CORE] Chart of accounts with business/cost center scopes — accountant-reviewed.
- **AT-251** [CORE] Accounts receivable aging — invoices with due dates.
- **AT-252** [CORE] Accounts payable and approved vendor bill flow — commitments.
- **AT-253** [CORE] Receipt capture and cost coding — review before posting.
- **AT-254** [CORE] Line-item job cost allocation — labor, fuel, chemicals, rentals.
- **AT-255** [CORE] Shopify fees/refunds/settlement reconciliation — payout evidence.
- **AT-256** [CORE] MRR contract vs actual collections tracking — Solutions.
- **AT-257** [CORE] Tax preparation category export — not auto tax advice.
- **AT-258** [CORE] Sales tax collection evidence and nexus review — accountant input.
- **AT-259** [CORE] Payroll and commission approval records — no automated pay.
- **AT-260** [CORE] Founder expense reimbursement ledger — receipt and authorization.
- **AT-261** [CORE] Owner distributions and contribution history — legal agreement controls.
- **AT-262** [CORE] Budget versions, variance and alerts — real committed spend.
- **AT-263** [CORE] Subscription vault and auto-renewal calendar — owner verification.
- **AT-264** [CORE] Cash runway scenarios with coverage indicator — no false precision.
- **AT-265** [CORE] Capital expenditure comparison and payback range — assumptions.
- **AT-266** [CORE] Loan/lease comparison and total ownership cost — source rates.
- **AT-267** [CORE] Insurance policy and deductible calendar — linked files.
- **AT-268** [CORE] Vendor contract commitments and cancellation windows — reminders.
- **AT-269** [CORE] Margin confidence gating by job/product/client — suppress false profit.
- **AT-270** [CORE] Multi-company money sharing rule — no cross-legal-entity netting without policy.
- **AT-271** [CORE] Exports, period close and adjustment audit — accountant controls.

## MARK — Demand generation, campaigns and reputation

*Ownership:* MARK domain lead to be assigned · *Default tier:* **ADV** · 21 candidates.

- **AT-272** [ADV] LSA lead mapping to actual booked/paid customer — attribution quality.
- **AT-273** [ADV] Google Business Profile review monitoring — official access.
- **AT-274** [ADV] Local service zone map and opportunity density — grounded data.
- **AT-275** [ADV] Residential direct-mail campaign tracker — consent and spend.
- **AT-276** [ADV] Commercial property target research notebook — verified source.
- **AT-277** [ADV] Door-knocking session outcome ledger — historical support.
- **AT-278** [ADV] Source-aware funnel and touchpoint campaign metrics — sample size.
- **AT-279** [ADV] Email personalization drafts and approval — opt-out records.
- **AT-280** [ADV] Customer review/referral follow-up planning — consent.
- **AT-281** [ADV] Paid creative experiment and ad angle library — approvals.
- **AT-282** [ADV] Campaign budget/stop-loss and effectiveness — no autonomous overspend.
- **AT-283** [ADV] Retargeting audience governance — consent/privacy.
- **AT-284** [ADV] Seasonality and weather-sensitive demand model — uncertainty.
- **AT-285** [ADV] Partner/referral outreach pipeline — relationship owner.
- **AT-286** [ADV] Organic social campaign plan and schedule — manual publish receipts.
- **AT-287** [ADV] Landing page and lead form conversion experiments — privacy.
- **AT-288** [ADV] SEO content opportunity register — no fabricated rankings.
- **AT-289** [ADV] Competitor price/offer observations — lawful public evidence.
- **AT-290** [ADV] Brand sentiment and reputation incident queue — source verification.
- **AT-291** [ADV] Multi-venture bundling hypotheses — never silently commingle client data.
- **AT-292** [ADV] Agency sales funnel cost per booked demo — sourced denominator.

## PEOPLE — People, hiring, payroll prep and collaboration

*Ownership:* PEOPLE domain lead to be assigned · *Default tier:* **ADV** · 18 candidates.

- **AT-293** [ADV] Role and permission visual matrix — tested capability.
- **AT-294** [ADV] Employee candidate pipeline and interview scorecards — privacy.
- **AT-295** [ADV] Onboarding task pack and training acknowledgement — accountability.
- **AT-296** [ADV] Uniform/PPE/asset issuance and retrieval — linked assets.
- **AT-297** [ADV] Skills/certification expiration calendar — document evidence.
- **AT-298** [ADV] Crew work availability and PTO requests — consent.
- **AT-299** [ADV] Timeclock/manual corrections with approval — accurate wage records.
- **AT-300** [ADV] Earnings and commissions preview vs approved — explicit pay state.
- **AT-301** [ADV] Performance coaching notes with ACL — private.
- **AT-302** [ADV] Contractor/vendor scopes and signed agreements — renewal.
- **AT-303** [ADV] Incident/injury reporting and retention policy — legal review.
- **AT-304** [ADV] Shift handoff briefs and route preparation — attributable.
- **AT-305** [ADV] Internal announcements and read acknowledgments — truthful.
- **AT-306** [ADV] Founder division of responsibility and meeting cadence — transparent.
- **AT-307** [ADV] HR document vault restricted from general search — RLS.
- **AT-308** [ADV] Job/crew labor hour variance analysis — coverage.
- **AT-309** [ADV] Hiring capacity scenario modeling — legal wage assumptions.
- **AT-310** [ADV] Role-specific mobile experience and training mode — accessibility.

## FILES — Knowledge vault, documents and legal operations

*Ownership:* FILES domain lead to be assigned · *Default tier:* **ADV** · 20 candidates.

- **AT-311** [ADV] Organization-wide entity-linked document library — no duplicate file copies.
- **AT-312** [ADV] Protected storage buckets and signed links — org/access scope.
- **AT-313** [ADV] Document version and supersession audit — stable original.
- **AT-314** [ADV] Contract obligations and renewal extraction — human verification.
- **AT-315** [ADV] Insurance COI/policy verification state — real dates.
- **AT-316** [ADV] Equipment manuals and parts PDFs — searchable.
- **AT-317** [ADV] OCR and automatic tagging as proposals — no silent edits.
- **AT-318** [ADV] Photo/video evidence with consent and retention — job-specific.
- **AT-319** [ADV] Secure customer-facing file request/share — revocable.
- **AT-320** [ADV] File comments and approval states — attributable.
- **AT-321** [ADV] Template library with approval and semantic version — typed fields.
- **AT-322** [ADV] Internal SOP wiki with owner and effective date — change control.
- **AT-323** [ADV] Full text/search index with PII protection — permission filtering.
- **AT-324** [ADV] Malware scanning and file-type restrictions — before preview.
- **AT-325** [ADV] External-storage connector bridge — opt-in tokens.
- **AT-326** [ADV] Source citations for AI answers — original file page.
- **AT-327** [ADV] Company policy acknowledgements — user action receipt.
- **AT-328** [ADV] Brand usage and media licensing register — legal boundaries.
- **AT-329** [ADV] Compliance incident tracker with review — confidential.
- **AT-330** [ADV] Data export/delete retention workflows — audited.

## ANALYTICS — Intelligence, dashboards, forecasting and source quality

*Ownership:* ANALYTICS domain lead to be assigned · *Default tier:* **ADV** · 21 candidates.

- **AT-331** [ADV] KPI dictionary with source and formula — canonical definitions.
- **AT-332** [ADV] Cross-business metric query/aggregation layer — typed dimensions.
- **AT-333** [ADV] Custom query builder with saved reports — permission-aware.
- **AT-334** [ADV] Time-window normalization and Chicago date basis — exact.
- **AT-335** [ADV] Partial provider coverage and rate-limit banners — honesty.
- **AT-336** [ADV] Cross-venture operational throughput comparison — semantic consistency.
- **AT-337** [ADV] Lead response and conversion cohort reports — defined stages.
- **AT-338** [ADV] Service route and labor productivity — actual work logs.
- **AT-339** [ADV] Truck/rig utilization versus capacity — recorded usage.
- **AT-340** [ADV] Client churn, retention and MRR bridge — actual contract evidence.
- **AT-341** [ADV] Shopify CAC/ROAS/contribution confidence — sourced spend.
- **AT-342** [ADV] Content channel views/retention import — provider timestamps.
- **AT-343** [ADV] Budget to actual variance with missing inputs — quality flag.
- **AT-344** [ADV] Anomaly detection proposals with explanation — no automatic action.
- **AT-345** [ADV] Monte Carlo capacity and margin scenario lab — assumptions.
- **AT-346** [ADV] Goal forecasts with intervals — no guarantee.
- **AT-347** [ADV] Quarterly strategy dashboard and initiative outcome — evidence.
- **AT-348** [ADV] Data reconciliation report to canonical sources — exception queue.
- **AT-349** [ADV] Integration sync health and delay status — actual logs.
- **AT-350** [ADV] Read-only board/CSV export with scope — safe sharing.
- **AT-351** [ADV] Audit/activity analytics and latency — privacy-safe.

## AUTOMATE — Opt-in workflow builder and responsible AI

*Ownership:* AUTOMATE domain lead to be assigned · *Default tier:* **ADV** · 22 candidates.

- **AT-352** [ADV] Automation registry with OFF-by-default state — owner authorization.
- **AT-353** [ADV] Graphical trigger / condition / action editor — versioned logic.
- **AT-354** [ADV] Dry run with synthetic fixture and preview diff — no side effects.
- **AT-355** [ADV] Per-action approval gates — money/send/publish/contracts.
- **AT-356** [ADV] Typed connector permissions and secret scopes — least privilege.
- **AT-357** [ADV] Rate/spend/time ceilings and fail-closed limits — enforce server-side.
- **AT-358** [ADV] Immediate pause/stop/resume switch — durable semantics.
- **AT-359** [ADV] Visible execution receipts and retry history — correlation IDs.
- **AT-360** [ADV] Rollback/compensating actions registry — when reversible.
- **AT-361** [ADV] Idempotency/outbox and duplicate suppression — real delivery.
- **AT-362** [ADV] Sandbox agent evaluation and cost ledger — measurable quality.
- **AT-363** [ADV] Private source-grounded knowledge Q&A — citations.
- **AT-364** [ADV] AI-generated task/quote/creative drafts — manual confirm.
- **AT-365** [ADV] Meeting summary with reviewed action list — no silent assign.
- **AT-366** [ADV] Troubleshooting copilot for washer/rig — source and safety checks.
- **AT-367** [ADV] Field photo classifier with uncertainty — no unsupported safety certifications.
- **AT-368** [ADV] Lead research suggestions from lawful public sources — no spam.
- **AT-369** [ADV] Client agent-change simulation and shadow mode — isolated.
- **AT-370** [ADV] Human escalation for failed workflows — owner/on-call.
- **AT-371** [ADV] Automation audit/security review checklist — pre-activation.
- **AT-372** [ADV] Local model vs cloud model routing policy — cost/quality limits.
- **AT-373** [ADV] Founder consent registry for external providers — revocable.

## SYSTEMS — Developer operations, infrastructure and security

*Ownership:* SYSTEMS domain lead to be assigned · *Default tier:* **CORE** · 20 candidates.

- **AT-374** [CORE] Accurate production release status for exact host — independently checked.
- **AT-375** [CORE] CI green SHA and staged-build promotion evidence — gates.
- **AT-376** [CORE] Deploy/rollback history with linked incidents — source logs.
- **AT-377** [CORE] Daily backup execution with checksum and storage location — no invented receipt.
- **AT-378** [CORE] Quarterly or change-triggered isolated restore rehearsal — measured.
- **AT-379** [CORE] PostgreSQL RLS and least-privilege policy tests — deny cases.
- **AT-380** [CORE] Provider secret rotation reminders and validation — no secret reveal.
- **AT-381** [CORE] Critical error alerting with owner and silence policy — no alarm spam.
- **AT-382** [CORE] Background job queue status and stuck task detector — measured.
- **AT-383** [CORE] Connector outage retry/backoff and service-level expectations — source.
- **AT-384** [CORE] API/webhook usage and per-provider cost tracker — bounds.
- **AT-385** [CORE] Performance p75/p95 and bundle regressions — instrumented.
- **AT-386** [CORE] Mobile offline queue health and conflict resolution — signed records.
- **AT-387** [CORE] Read-only environment and license inventory — owner-reviewed.
- **AT-388** [CORE] Feature flag and canary rollout policy — instant disable.
- **AT-389** [CORE] Endpoint permission and CSRF safeguards — systematic.
- **AT-390** [CORE] Audit exports and tamper-aware retention — scoped.
- **AT-391** [CORE] System incident postmortems with follow-up tasks — ownership.
- **AT-392** [CORE] Dependency/license vulnerability tracking — human review.
- **AT-393** [CORE] Developer source contract documentation and fixtures — always current.

## SIGNATURE — Signature high-wow experiences with measurable purpose

*Ownership:* SIGNATURE domain lead to be assigned · *Default tier:* **LAB** · 20 candidates.

- **AT-394** [LAB] ATLAS Wall live ops display — PII redacted and source-based.
- **AT-395** [LAB] Fleet 2.5D Explorer/truck rig cutaway — verified component anchors.
- **AT-396** [LAB] Interactive hose/water routing schematic — physically plausible.
- **AT-397** [LAB] Rig load and axle scenario cockpit — sticker-backed warnings.
- **AT-398** [LAB] Commercial Property Atlas with building panels — authorized geography.
- **AT-399** [LAB] Field site inspection AR-style overlay sketch — never unverified measurement.
- **AT-400** [LAB] Founders two-seat collaboration mirror — actionable changes.
- **AT-401** [LAB] Operational timeline replay of historic events — actual audit source.
- **AT-402** [LAB] Multi-business corporate “war table” scenario view — real model inputs.
- **AT-403** [LAB] Extreme-weather field readiness radar — sourced forecasts.
- **AT-404** [LAB] AI opportunity research board with evidence — no autonomous outreach.
- **AT-405** [LAB] Project dependency star-map / capability graph — stable nodes.
- **AT-406** [LAB] Corporate digital-twin inventory model — manually measured fidelity.
- **AT-407** [LAB] Procurement bidding compare table — actual supplier quotes.
- **AT-408** [LAB] Mobile field glove mode and big touch checklists — field-tested.
- **AT-409** [LAB] Voice-command navigation and note dictation — explicit recording consent.
- **AT-410** [LAB] AI meeting/action copilot in shadow mode — review.
- **AT-411** [LAB] Custom sidebar workspace themes and venture immersions — accessible.
- **AT-412** [LAB] Corporate cinematic presentation mode — real report snapshots.
- **AT-413** [LAB] Interactive service area demand heatmap — consent and sampled sources.

## Backlog grooming rules

1. **One feature = one verified user outcome** attached to a canonical entity, actor/permission, record source, read/write behavior, event/receipt and failure state.
2. Each ticket must identify: its authoritative source, cross-domain consumers, user persona, screen(s), data migration status, tests, rollout and rollback, and what it intentionally **does not** do.
3. Critical chains cannot ship as disconnected buttons: customer→job→asset→invoice→bank is an end-to-end epic with truthful intermediate stages.
4. A feature is not done if founder A sees it and founder B cannot, if mobile entry loses saved data, if an unavailable provider turns unknown into zero, or if a status transition is unaudited.
5. **Prioritization scoring**: expected real hours saved 25%, revenue protection/creation 25%, cross-domain leverage 20%, usage frequency 15%, implementation cost/risk 10%, “wow and delight” 5%; security/P0 gates override scoring.
6. Every LAB feature requires a measured operator benefit—not just a video demonstration—and an accessible low-motion fallback.
7. Do not ship patented/trademarked imitation or license-restricted source from another vendor. Research behavior, build independently and verify dependencies.
8. This catalogue is intentionally larger than one season's executable roadmap; [release waves](./ATLAS_06_EXECUTION_ROADMAP.md) decide what earns development time.

## Important historical context

The currently merged V2 already has elements of tasks, CRM, estimates, local fleet, founder review, intelligence and temporary cross-record navigation. Some ATLAS items extend these; they are not to be rebuilt from scratch. Current functionality and data integrity must be re-audited before implementation. As of this blueprint, the fourth venture's persistent schema is blocked pending recoverable Supabase backup and isolated restore verification.
