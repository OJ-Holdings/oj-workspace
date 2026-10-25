# OJ Workspace Releases 48–49 — dependency patch and CI guard

**Scope:** Small, separately reviewed software supply-chain changes. They are not production host verification, database recovery, authorization certification or customer acceptance.

## Why patch now

CI for R47 printed **one critical npm advisory** under pinned Next.js 16.3.8. The official [Next.js October 14, 2026 security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026) identifies unauthenticated remote-code-execution risk involving some App Router/cache and Linux SVG optimization flows and a high-severity Server Actions denial-of-service issue. Whether each route was exploitable on OJ's actual host was **not established**; upgrading remains prudent.

## R48 implemented

- Exact repository [PR #139](https://github.com/OJ-Holdings/oj-workspace/pull/139), merge commit `9a5c5c21909eb9516761f8d96154f559f14763fe`.
- Dependency `next` 16.3.8 -> 16.4.1; regenerate `package-lock.json` using a networked GitHub Actions runner with `npm install next@16.4.1 --save-exact --package-lock-only --ignore-scripts --no-audit`.
- Lockfile confirms `node_modules/next` 16.4.1 and `node_modules/sharp` 0.35.5. Temporary regeneration workflow deleted from final two-file diff.
- Exact PR head `fa2e453a80d999a39bef1233a6fb48c98a684a70`, [GitHub CI 40149496633](https://github.com/OJ-Holdings/oj-workspace/actions/runs/40149496633) passed TypeScript, full app tests, Next.js production build and isolated synthetic PG17 recovery. `npm ci` in that run printed **0 vulnerabilities** (a dated audit observation, not a guarantee against future disclosures).

## R49 proposed permanent guard

After `npm ci`, run `npm audit --audit-level=critical` in the existing GitHub CI check job. Fail if the registry reports a known critical npm dependency advisory. The audit uses no production/customer credentials and grants no new CI permission; it can fail from npm registry outages as well as actual advisories and requires operator investigation. Review R49 CI and actual merged main before describing it as in effect.

## Boundaries still open

No claim of latest served Netlify/Funnel SHA, independent founder mobile acceptance, production encrypted archive/mirror, actual separate restore, Storage byte recovery, authenticated actor RLS negatives or rollback. Schema PR #42 remains blocked. The sole 12-wave Exterior engineering score stays **42/100**; dependency patch and CI policy do not earn unrelated product wave points.
