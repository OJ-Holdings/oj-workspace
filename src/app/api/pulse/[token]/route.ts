import { createClient } from '@supabase/supabase-js';
import { ojConnection } from '@/lib/oj-connection';

export const dynamic = 'force-dynamic';

// A read-only summary for the owner's own private dashboard (STRATHOS). Same credential as the calendar
// subscription: the long random token in the address. The database function returns nothing for an unknown
// token or a removed member, and never returns messages, documents, lead details or private notes.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response('Not found', { status: 404 });
  const client = createClient(ojConnection.url, ojConnection.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc('oj_pulse', { token });
  if (error) return new Response('Summary unavailable', { status: 503 });
  if (!data) return new Response('Not found', { status: 404 });
  return Response.json(data, { headers: { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' } });
}
