import { NextResponse } from 'next/server';
import { isConfigured, supabaseServer } from '@/lib/supabase';
import { loadWorkspace } from '@/lib/workspace-data';
export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'private, no-store', Vary: 'Cookie' };
export async function GET(_request: Request, { params }: { params: Promise<{ org: string }> }) {
  const { org } = await params;
  if (!/^[a-f0-9-]{36}$/i.test(org)) return NextResponse.json({ error: 'Invalid workspace.' }, { status: 400, headers });
  if (!isConfigured()) return NextResponse.json({ error: 'Workspace connection is unavailable.' }, { status: 503, headers });
  try {
    const client = await supabaseServer();
    const { data: { user }, error: authError } = await client.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401, headers });
    const { data: member, error } = await client.from('oj_memberships').select('role').eq('organization_id', org).eq('user_id', user.id).maybeSingle();
    if (error) return NextResponse.json({ error: 'Workspace connection is unavailable.' }, { status: 503, headers });
    if (!member) return NextResponse.json({ error: 'Workspace access ended.' }, { status: 403, headers });
    return NextResponse.json(await loadWorkspace(org), { headers });
  } catch { return NextResponse.json({ error: 'Workspace connection is unavailable.' }, { status: 503, headers }); }
}
