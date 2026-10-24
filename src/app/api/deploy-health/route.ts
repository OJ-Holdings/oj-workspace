/**
 * Read-only localhost release probe for the OJ Windows deployment manager.
 * Exposes only a commit identifier; no environment configuration or customer data.
 */
import {resolveServedRelease} from '@/lib/release-health';

export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    { status: 'ok', release: resolveServedRelease({
      explicit:process.env.OJ_WORKSPACE_RELEASE_SHA,
      netlify:process.env.COMMIT_REF,
      vercel:process.env.VERCEL_GIT_COMMIT_SHA,
    }) },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
