'use server';

import { requireMember } from '@/lib/supabase';
import { readShopify, shopifyConfigured } from '@/lib/shopify-server';
import type { ShopResult } from '@/lib/shopify';

/** Store figures for signed-in workspace members only. Returns a result instead of throwing so the screen can say what is wrong. */
export async function loadShopify(org: string): Promise<ShopResult> {
  await requireMember(org);
  if (!shopifyConfigured()) return { ok: false, reason: 'not-connected' };
  try {
    return { ok: true, data: await readShopify() };
  } catch (error) {
    console.error('Shopify read failed:', error instanceof Error ? error.message : error);
    return { ok: false, reason: 'failed' };
  }
}
