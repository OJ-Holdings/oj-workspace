# Hyperborea alpine rendering — October 27, 2026

Founder direction: make the mountain materially more realistic and make the business ascent feel like an expedition, preserving the uncluttered inspection interface.

## Visual implementation

- Seeded asymmetric pyramidal massif, long buttresses, eroded gullies, secondary shoulders and a glacial bowl. The same terrain and monotonic climbing route are used at every quality level. Revenue-to-altitude mathematics is unchanged.
- World-space triplanar photographic stone, fine grain, stratification, slope/height-dependent snow, blue glacial ice, crevasse relief and separate surface roughness. Native Three.js StandardMaterial retains physical lighting, shadows, fog and color management. Failed image loads retain procedural geology.
- Locally served photographic material: **Rocky Terrain**, Amal Kumar / Poly Haven, CC0-1.0. Source: https://polyhaven.com/a/rocky_terrain ; license: https://polyhaven.com/license . Official 2K source files were verified against provider byte sizes and MD5; derived WebP SHA-256 hashes, byte sizes and provenance are committed in `public/hyperborea/materials.json`. Desktop pair plus compact pair total 1,112,574 bytes. No runtime third-party API or hotlinks. Credit is available in Evidence → Mountain materials.
- Cold directional moonlight, restrained warm rim light, static cached desktop shadows, distant ridgelines, terrain blending into the surrounding ground, less opaque cloud banks and less obstructive wind-driven snow.
- Shared-geometry tents, doors, guy ropes, supplies, lanterns, instanced moraine rocks and two roped founder figures. Shelters follow local ground rather than floating on wide pads. Warm completed route/camps and a cold unfinished route remain symbolic. They do not prove staffing or completed business gates. Weather still comes from recorded 90-day revenue momentum.
- Wider route-level camera framing shows the massif above the expedition; whole-mountain framing, damped navigation, inspections and reduced-motion behavior remain available.

## Runtime limits and lifecycle

Compact view uses 768px photo maps, a smaller terrain mesh, fewer backdrop vertices/clouds/boulders, lower pixel ratio and no real-time shadows. Desktop photos are 2048px. One bounded adaptive downgrade reduces pixel ratio, shadows and snow after sustained slow frames; diagnostics remain DOM-local and are never uploaded.

Three.js Timer replaces deprecated Clock, and supported PCF shadows replace the removed soft-shadow constant. Resource cleanup covers photo textures, timer visibility listeners, terrain/props, instanced rocks and shadow targets. Disposed scenes cannot accept late texture callbacks. Replaced completed-path geometry is disposed immediately without accumulating retained geometry references.

## Acceptance evidence

Local TypeScript and 901 tests pass, including asset integrity/budget, two-map readiness/failure/disposal fencing, terrain determinism and complete altitude-to-route ordering. Synthetic browser observed photographic maps loaded, no WebGL errors and approximately 16.8 ms mean frame interval at 259,122 rendered triangles on this desktop. This is a bounded observation, not a guaranteed frame rate or physical-phone benchmark. Close/overview visual reviews led to higher snowline, reduced haze, exposed photographic rock, grounded camp objects and natural terrain edges.

Exact final PR/main CI, production build, served SHA and authenticated live inspection are recorded in the PR after deployment. No schema, customer/financial writes, credentials, notifications or commercial actions are part of this release. Existing deployment guards and rollback are preserved. Exterior roadmap scores unchanged.
