import { createClient } from '@supabase/supabase-js';
import { ojConnection } from '@/lib/oj-connection';
import { toICS } from '@/lib/dashboard';

export const dynamic = 'force-dynamic';

// The calendar subscription a phone's calendar app fetches. It cannot sign in,
// so the long random token in the address is the credential; the database
// function behind it returns nothing for an unknown token or a removed member.
export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.replace(/\.ics$/i, '');
  if (!/^[a-f0-9]{64}$/.test(token)) return new Response('Not found', { status: 404 });
  const client = createClient(ojConnection.url, ojConnection.publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.rpc('oj_calendar_feed', { token });
  if (error) return new Response('Calendar unavailable', { status: 503 });
  return new Response(toICS(data ?? [], new Date()), {
    headers: { 'Content-Type': 'text/calendar; charset=utf-8', 'Content-Disposition': 'inline; filename="oj-workspace.ics"', 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex' },
  });
}
