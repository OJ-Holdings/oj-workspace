import { NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase';
import { validPresenceId, validPresenceOrigin, validatePresenceUpdate } from '@/lib/presence';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
const fail = (error: string, status: number) => NextResponse.json({ error }, { status, headers });
type Context = { params: Promise<{ org: string }> };
async function access(org: string) {
  const client = await supabaseServer();
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return { error: fail('Sign in required.', 401) };
  const member = await client.from('oj_memberships').select('user_id').eq('organization_id', org).eq('user_id', user.id).maybeSingle();
  if (member.error) return { error: fail('Team connection is unavailable.', 503) };
  if (!member.data) return { error: fail('Workspace access ended.', 403) };
  return { client, user };
}
export async function GET(_request: Request, context: Context) {
  const { org } = await context.params;
  if (!validPresenceId(org)) return fail('Invalid workspace.', 400);
  try {
    const auth = await access(org); if (auth.error) return auth.error;
    const { client, user } = auth;
    const [members, sessions, work] = await Promise.all([
      client.from('oj_memberships').select('user_id,display_name').eq('organization_id', org).order('display_name'),
      client.from('oj_presence_sessions').select('user_id,session_id,state,seen_at').eq('organization_id', org).order('seen_at', { ascending: false }).limit(1000),
      client.from('oj_current_work').select('user_id,note,card_id,revision,updated_at').eq('organization_id', org),
    ]);
    if (members.error || sessions.error || work.error) return fail('Team availability is not connected yet. Tasks and messages still work.', 503);
    return NextResponse.json({ userId: user.id, members: members.data, sessions: sessions.data, work: work.data, now: new Date().toISOString() }, { headers });
  } catch { return fail('Team connection is unavailable.', 503); }
}
export async function POST(request: Request, context: Context) {
  const { org } = await context.params;
  if (!validPresenceId(org)) return fail('Invalid workspace.', 400);
  const origin = request.headers.get('origin');
  if (!validPresenceOrigin(origin, request.headers.get('host')) || !request.headers.get('content-type')?.startsWith('application/json')) return fail('Use this workspace to update your status.', 403);
  let input;
  try {
    const body = await request.text(); if (body.length > 2000) return fail('Status is too long.', 400);
    input = validatePresenceUpdate(JSON.parse(body));
  } catch { return fail('Check your status and linked task.', 400); }
  try {
    const auth = await access(org); if (auth.error) return auth.error;
    const { client, user } = auth;
    if (input.action === 'heartbeat') {
      const result = await client.from('oj_presence_sessions').upsert({ organization_id: org, user_id: user.id, session_id: input.sessionId, state: input.state }, { onConflict: 'organization_id,user_id,session_id' });
      if (result.error) return fail('Your availability could not be shared.', 503);
      // Ephemeral session rows only. Keep this user's most recent connection and prune old tabs.
      await client.from('oj_presence_sessions').delete().eq('organization_id', org).eq('user_id', user.id).lt('seen_at', new Date(Date.now() - 7 * 86400_000).toISOString());
      return NextResponse.json({ ok: true }, { headers });
    }
    if (input.cardId) {
      const card = await client.from('oj_cards').select('id').eq('organization_id', org).eq('id', input.cardId).maybeSingle();
      if (card.error || !card.data) return fail('That task is no longer available in this workspace.', 400);
    }
    const result = input.revision === null
      ? await client.from('oj_current_work').insert({ organization_id: org, user_id: user.id, note: input.note, card_id: input.cardId }).select('revision').single()
      : await client.from('oj_current_work').update({ note: input.note, card_id: input.cardId, revision: input.revision }).eq('organization_id', org).eq('user_id', user.id).eq('revision', input.revision).select('revision').maybeSingle();
    if (result.error?.code === '23505' || (!result.error && !result.data)) return fail('Your status changed in another tab. Reload its latest version before saving.', 409);
    if (result.error) return fail('Your work status did not save. Try again.', 503);
    return NextResponse.json({ ok: true }, { headers });
  } catch { return fail('Team connection is unavailable.', 503); }
}
