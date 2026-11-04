import { handler, hasValidSyncToken, MAX_BODY_BYTES } from '../../../../netlify/functions/daily-outreach-sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
const reply = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });

// The same bearer-authorized import contract as Netlify, with a bounded stream
// before handing private sheet rows to the existing server-side importer.
export async function POST(request: Request) {
  const authorization = request.headers.get('authorization') ?? undefined;
  if (!hasValidSyncToken(authorization, process.env.OJ_OUTREACH_SYNC_TOKEN)) return reply(401, 'Unauthorized.');
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_BODY_BYTES)) return reply(413, 'Request body is too large.');
  const reader = request.body?.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  if (reader) {
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_BODY_BYTES) { await reader.cancel(); return reply(413, 'Request body is too large.'); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
  }
  const result = await handler({ httpMethod: 'POST', headers: { authorization }, body: Buffer.concat(chunks).toString('utf8') });
  return new Response(result.body, { status: result.statusCode, headers: result.headers });
}

export async function GET() { return reply(405, 'Method not allowed.'); }
