# Hyperborea mobile trail - October 27, 2026

## Changes

- Removed the large floating inspection caption. Mobile camp, history and goal labels are compact touch markers with accessible names; details live in the existing expedition inspector.
- Compact mobile heading/readout, seven visible navigation controls, whole-mountain framing, bounded close zoom and 25 m travel controls.
- Darker cold lighting, heavier snow coverage/fall and barely visible background ridges. Existing photographic materials, adaptive rendering budgets and reduced-motion support remain.
- 1,770 calculated revenue requirements at 5 m intervals (plus the final 8,849 m summit) fill the spaces between major goals. One instanced mesh draws the pins; only 24 nearby detail buttons are pooled. Close zoom reveals finer steps without thousands of DOM labels.
- The Trail button opens a bounded 25-row window, slider and individual requirements at any camera angle. Requirements reuse the current revenue scale and are explicitly distinct from completed work or operational achievements. Revenue, achievements, histories and source records are unchanged.
- The scene uses overflow clipping instead of an internally scrollable hidden frame. Focus on projected labels can no longer shift the canvas and expose a blank area.

## Verification

- 905 tests passed, including monotonic/unique trail requirements, inverse revenue calculations, complete bounded list access, invalid input and zoom limits. Existing database role/isolation tests remain in the full suite.
- TypeScript passed. Production build and exact-head CI/release evidence recorded in the pull request after completion.
- Browser checks at 320 x 740, 390 x 844 and 430 x 932: compact controls, darker snow, quiet whole-mountain view, repeated close zoom, Trail list and a selected step's revenue requirement. After the clipping repair, repeated zoom kept scene scrollTop at zero. Native Escape closes the inspector. Latest local browser error/warning capture was empty; an earlier development hydration warning identified grammar-extension attributes on html/body, not scene markup.
- These are Chromium viewport checks, not a physical iPhone/Safari performance certification. Occluded/overlapping scene labels deliberately hide; the Trail list supplies camera-independent access. A 5 m requirement does not imply a customer task or a historical event at that altitude.

No migrations, credentials, financial records, customer actions or STRATHOS controls changed. Standard guarded deployment retains the previous production release for rollback.
