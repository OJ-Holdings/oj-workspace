// The links a person chose before the LSA backfill (lsa-overrides.json, outside the
// repo because it names customers). Only the founder-run scripts read it: the app
// and the live sync never do, so the server bundle never touches this file.

import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { LinkOverride } from '../src/lib/lead-pipeline';
import { LsaError } from '../src/lib/lsa-sync';

/** Links a person decided before the backfill. Kept outside the repo (it names customers). */
export const defaultOverrides = join(homedir(), '.secrets', 'oj-workspace', 'lsa-overrides.json');
/**
 * Reads `{ note, links: [{ lsa_lead_id, lead_id, why }] }`. No file means no overrides;
 * a file that is there but wrong stops the backfill (a typo must never be skipped quietly).
 */
export function readOverrides(file = defaultOverrides): LinkOverride[] {
  if (!existsSync(file)) return [];
  let body: { links?: unknown };
  try { body = JSON.parse(readFileSync(file, 'utf8').replace(/^﻿/, '')); } catch { throw new LsaError('setup', `The overrides file ${file} is not valid JSON.`); }
  if (!Array.isArray(body?.links)) throw new LsaError('setup', `The overrides file ${file} has no "links" list.`);
  const seen = new Set<string>();
  return body.links.map((raw, i) => {
    const o = (raw ?? {}) as Record<string, unknown>;
    const lsa = String(o.lsa_lead_id ?? ''), lead = String(o.lead_id ?? '');
    if (!/^\d+$/.test(lsa)) throw new LsaError('setup', `Overrides link ${i + 1}: lsa_lead_id must be the LSA lead number.`);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(lead)) throw new LsaError('setup', `Overrides link ${i + 1}: lead_id must be the full lead id (a uuid).`);
    if (seen.has(lsa)) throw new LsaError('setup', `Overrides link ${i + 1}: LSA lead ${lsa} is listed twice.`);
    seen.add(lsa);
    return { lsa_lead_id: lsa, lead_id: lead.toLowerCase(), why: typeof o.why === 'string' && o.why.trim() ? o.why.trim().slice(0, 300) : 'chosen by hand' };
  });
}
