/**
 * The same email-engine door as netlify/functions/outreach-email-engine.ts, served by the app itself,
 * so the Windows/Tailscale Funnel host answers the Google Apps Script sender without Netlify.
 * Bearer-token only. Needs the same server settings as the function (see docs/SOLUTIONS_GROWTH_ENGINE.md).
 */
import { handler } from '../../../../netlify/functions/outreach-email-engine';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const result = await handler({
    httpMethod: 'POST',
    headers: { authorization: request.headers.get('authorization') ?? undefined },
    body: await request.text(),
  });
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
}

export async function GET() {
  return Response.json({ error: 'Method not allowed.' }, { status: 405, headers: { 'Cache-Control': 'no-store' } });
}
