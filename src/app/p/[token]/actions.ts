'use server';

import { headers } from 'next/headers';
import { supabasePublic } from '@/lib/supabase-public';

export type DecideResult = { ok: true; decision: 'accepted' | 'declined'; agreedCents: number; hash: string } | { ok: false; message: string };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The customer accepts (typed signature, optional add-ons) or declines. This runs with the public role only: the database function checks the token,
 * the proposal's status and its expiry. The caller's IP address and browser are recorded as part of the audit trail.
 */
export async function decideProposal(token: string, input: { decision: 'accepted' | 'declined'; name: string; note: string; optionalIds: string[] }): Promise<DecideResult> {
  if (typeof token !== 'string' || token.length < 32 || token.length > 200) return { ok: false, message: 'This link is no longer valid.' };
  if (input.decision !== 'accepted' && input.decision !== 'declined') return { ok: false, message: 'Choose accept or decline.' };
  const name = String(input.name ?? '').trim();
  if (name.length < 2) return { ok: false, message: 'Type your full name to sign.' };
  const h = await headers();
  const ip = (h.get('x-forwarded-for')?.split(',')[0] ?? h.get('x-real-ip') ?? '').trim().slice(0, 64) || null;
  const agent = (h.get('user-agent') ?? '').slice(0, 300) || null;
  const optional = (Array.isArray(input.optionalIds) ? input.optionalIds : []).filter(id => typeof id === 'string' && UUID.test(id)).slice(0, 60);
  try {
    const { data, error } = await supabasePublic().rpc('oj_portal_decide', { p_token: token, p_decision: input.decision, p_name: name.slice(0, 200), p_note: String(input.note ?? '').slice(0, 500), p_optional: optional, p_ip: ip, p_agent: agent });
    if (error) return { ok: false, message: (error.message.replace(/^.*?(ERROR:\s*)/i, '') || 'That did not go through.').slice(0, 200) };
    const r = data as { decision: 'accepted' | 'declined'; agreed_total_cents: number; document_hash: string };
    return { ok: true, decision: r.decision, agreedCents: Number(r.agreed_total_cents), hash: String(r.document_hash) };
  } catch { return { ok: false, message: 'That did not go through. Please try again.' }; }
}
