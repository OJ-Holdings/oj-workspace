/**
 * Read-only localhost release probe for the OJ Windows deployment manager.
 * Exposes only a commit identifier; no environment configuration or customer data.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json(
    { status: 'ok', release: process.env.OJ_WORKSPACE_RELEASE_SHA ?? 'unmanaged' },
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}
