'use server';

import { requireMember } from '@/lib/supabase';
import { ghlConfigured, readGhl } from '@/lib/ghl-server';
import type { GhlResult } from '@/lib/ghl';

/** OJ Solutions clients, pipeline and calls, for owners and members (these are people's names, so view-only access is not enough). */
export async function loadGhl(org: string): Promise<GhlResult> {
  try { await requireMember(org, true); } catch { return { ok: false, reason: 'no-access' }; }
  if (!ghlConfigured()) return { ok: false, reason: 'not-connected' };
  try {
    return { ok: true, data: await readGhl() };
  } catch (error) {
    console.error('GoHighLevel read failed:', error instanceof Error ? error.message : error);
    return { ok: false, reason: 'failed' };
  }
}
