import { createClient } from '@supabase/supabase-js';
import { hasValidSyncToken } from '../../../../netlify/functions/daily-outreach-sync';

// Read-only authorization for the bound Apps Script. Only column F/G values leave this endpoint.
// Supabase remains authoritative; the sheet receives a bounded snapshot keyed by source row.
export const dynamic = 'force-dynamic';
const failure = (status: number, error: string) => Response.json({ error }, { status, headers: { 'Cache-Control': 'no-store' } });
const central = (s: string) => new Date(s).toLocaleDateString('en-US', { timeZone: 'America/Chicago', month: 'short', day: 'numeric', year: 'numeric' });

export async function GET(request: Request) {
  if (!hasValidSyncToken(request.headers.get('authorization'), process.env.OJ_OUTREACH_SYNC_TOKEN)) return failure(401, 'Unauthorized');
  const org = process.env.OJ_OUTREACH_ORGANIZATION_ID;
  const key = process.env.OJ_SUPABASE_SERVICE_ROLE_KEY;
  if (!org || !key) return failure(503, 'Sheet writeback is not configured on this host.');
  const db = createClient<any>(process.env.NEXT_PUBLIC_OJ_SUPABASE_URL || '', key, { auth: { autoRefreshToken: false, persistSession: false } });
  const [prospects, dm, skips, email, people] = await Promise.all([
    db.from('oj_outreach_prospects').select('id,source_row,business_name,source_status,outreach_status,status_updated_at').eq('organization_id', org).limit(1000),
    db.from('oj_outreach_dm_log').select('prospect_id,actor_id,created_at,undone_at').eq('organization_id', org).order('created_at', { ascending: false }).limit(5000),
    db.from('oj_outreach_skips').select('prospect_id,reason,note,skipped_at').eq('organization_id', org).order('skipped_at', { ascending: false }).limit(1000),
    db.from('oj_email_events').select('prospect_id,kind,event_at').eq('organization_id', org).in('kind', ['sent','followup_sent']).order('event_at', { ascending: false }).limit(5000),
    db.from('oj_memberships').select('user_id,display_name').eq('organization_id', org),
  ]);
  if ([prospects, dm, skips, email, people].some(r => r.error)) {
    console.error('Outreach sheet F:G writeback is unavailable', [prospects,dm,skips,email,people].filter(r=>r.error).map(r=>({code:r.error?.code,message:r.error?.message})));
    return failure(503, 'Outreach writeback requires the reviewed database migrations and a working Supabase connection.');
  }
  const names = new Map((people.data ?? []).map((p: any) => [p.user_id, p.display_name]));
  const rows: { row: number; business: string; status: string; notes: string; at: string }[] = [];
  for (const p of (prospects.data ?? [])) {
    const candidates: { at: string; status: string; notes: string }[] = [];
    for (const d of (dm.data ?? [])) if (d.prospect_id === p.id && !d.undone_at)
      candidates.push({ at: d.created_at, status: 'Sent', notes: `Sent by ${names.get(d.actor_id) || 'team'} ${central(d.created_at)}` });
    for (const s of (skips.data ?? [])) if (s.prospect_id === p.id)
      candidates.push({ at: s.skipped_at, status: 'Skipped', notes: `Skip: ${s.reason}${s.note ? ' ' + s.note : ''}` });
    for (const e of (email.data ?? [])) if (e.prospect_id === p.id)
      candidates.push({ at: e.event_at, status: e.kind === 'followup_sent' ? 'Followed up' : 'Emailed', notes: `${e.kind === 'followup_sent' ? 'Followed up' : 'Emailed'} ${central(e.event_at)}` });
    candidates.sort((a,b) => b.at.localeCompare(a.at));
    const latest = candidates[0];
    if (!latest || !Number.isInteger(p.source_row) || p.source_row < 2) continue;
    // Never roll back stronger human outcomes just to fill the sheet.
    if (['Replied','Demo Booked','Not Interested','Dead'].includes(p.outreach_status) && latest.status !== 'Skipped') continue;
    rows.push({ row: p.source_row, business: p.business_name, ...latest });
  }
  return Response.json({ rows }, { headers: { 'Cache-Control': 'no-store' } });
}
