# Hyperborea expedition desk — October 27, 2026

Founder request: keep the mountain uncluttered, inspect detail along the climb, replace the long report below it, deepen achievements, smooth the camera and provide a whole-mountain view.

## Implemented

- Mountain camp labels, historical monthly cairns and upcoming revenue markers are real keyboard-accessible inspection buttons. Distant/overlapping labels are hidden from both pointer and keyboard access. Camps remain accessible through the gauge and inspector when labels are occluded.
- The long instrument/journal/objectives/route/badges stack is replaced by one compact ascent chart and four inspection entry points. A native modal dialog handles focus trapping, Escape, close and focus return. Detailed lists use disclosures and categories.
- 24h, 7D, 30D, 90D, YTD and all-history comparisons show signed altitude meters and altitude-relative percentages. Starting altitude zero has no percentage. Current daily dated entries reconstruct history; there is no claim of immutable historical or intraday observations. The 24h option compares Chicago calendar dates.
- Movement detail identifies current income entering and expiring from the rolling 365-day revenue window. Corrections can alter reconstructed history. Loaded-record/source coverage limits remain inspectable.
- +10/50/100/250/500 meter requirements invert the existing log-linear altitude scale, clamp at the summit, disclose income expiring in 30 days and show the monthly revenue to sustain the target.
- 43 achievements with the current four configured segments: lifetime/monthly income tiers, first business income, camp crossings, customer/operational/company goals. Revenue achievements derive crossing dates from recorded rows. Unconnected customer/workforce/legal/profit evidence remains explicitly unknown, with requirements and existing supporting-record links. No fabricated completion buttons or parallel data store.
- Camp operational requirements remain distinct from revenue altitude. Configured business tabs no longer count as verified owned operating companies or unlock the ultimate summit claim.
- Forecast repair: constant projected daily revenue cannot accumulate indefinitely after a year. Targets above the stationary rolling-year pace are unreachable unless genuinely attained during the first year's historic rollover.
- Camera repair: normalize/bound wheel input, reduce drag sensitivity, remove artificial camera shake, damp both position and aim and prevent ground intersection. Smoothly transition to aspect-aware whole-mountain framing and back. Reduced-motion preference skips the travel interpolation.

## Validation and release

Local TypeScript, 898 tests and Webpack production build passed before browser inspection. New tests cover forecast rollover, expired-income reconciliation, zero baselines, chart endpoints, inverse altitude requirements, summit clamping and dated/unknown achievements. Browser synthetic preview verified whole-mountain toggle, a historical mountain-marker dialog, next-meter changes across a camp, achievement inventory, Escape and focus return. Final branch CI and actual live-route evidence are recorded in the PR after release; a preview alone is not production proof.

Read-only UI/math change. No SQL, credentials, customer mutations, notifications or financial transactions. Existing deployment controls, exact-head CI, staging health and rollback retained. Physical iPhone/two-founder acceptance and quantitative frame-time measurement are not claimed. Manual evidence capture and complete audited financial history remain separate future integrations. Exterior roadmap scores unchanged.
