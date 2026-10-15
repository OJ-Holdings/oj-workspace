'use server';

import { createHash, randomBytes } from 'node:crypto';
import { requireMember } from '@/lib/supabase';

/**
 * Creates (or replaces) the workspace's STRATHOS summary link. Owner only: the database function refuses anyone
 * else. The random token is returned once and only its SHA-256 is stored; making a new one cancels the old one.
 */
export async function createStrathosLink(org: string): Promise<string> {
  if (!/^[0-9a-f-]{36}$/i.test(org)) throw new Error('Choose a workspace.');
  const { client } = await requireMember(org);
  const token = randomBytes(32).toString('hex');
  const { error } = await client.rpc('oj_set_pulse_feed', { org, digest: createHash('sha256').update(token).digest('hex') });
  if (error) throw new Error('Only a workspace owner can create this link.');
  return `/api/pulse/${token}`;
}
