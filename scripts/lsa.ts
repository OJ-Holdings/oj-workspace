// Local Services Ads jobs a founder runs from the repo folder (they read .env.local):
//   npm run lsa -- test                           prints the last 30 days of LSA leads; reads Google only, saves nothing
//   npm run lsa -- backfill                       imports every lead and conversation Google still has (resumable)
//   npm run lsa -- archive-sheet-leads --dry-run  shows what the sheet archive would do, changes nothing
//   npm run lsa -- archive-sheet-leads            backs up, merges duplicates into sheet leads, then archives (never deletes)
//   npm run lsa -- backfill [--overrides file]    the overrides file (default ~/.secrets/oj-workspace/lsa-overrides.json) forces links chosen by hand
//   npm run lsa -- dry-run [--from file] [--rehearse] [--overrides file] [--summary] [--out file] [--baseline file] [--focus ids]
//                                                 rehearses backfill + archive on an in-memory copy of a leads snapshot; never contacts Supabase
// Google sign-in uses the service account key at GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH,
// so nothing depends on a person logging in. Secrets are never printed.

import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { accessToken, applySheetArchive, backfillLsa, dashed, eventsForLeads, googleConfig, leadQuery, LsaApi, LsaError, lsaOrganization, readLeads, serviceClient, toLead, type Db } from '../src/lib/lsa-sync';
import { chicagoStamp, isSheetLead, planSheetArchive, type LsaLead } from '../src/lib/lead-pipeline';
import { serviceFor } from '../src/lib/lead-extract';
import { describeArchive, dryRun, flagValue, valueFlags } from './lsa-dry-run';
import { defaultOverrides, readOverrides } from './lsa-overrides';

try { process.loadEnvFile(resolve('.env.local')); } catch { /* each job says what is missing */ }

/** Read only: the last 30 days of leads with type, service and message count. */
async function test() {
  const cfg = googleConfig();
  console.log(`Signing in as service account ${cfg.clientEmail}${cfg.loginCustomerId ? ` through manager account ${dashed(cfg.loginCustomerId)}` : ''}, reading account ${dashed(cfg.customerId)}.`);
  const api = new LsaApi(cfg, await accessToken(cfg));
  const rows = await api.search(leadQuery(`local_services_lead.creation_date_time >= '${chicagoStamp(Date.now() - 30 * 86_400_000)}'`));
  const leads = rows.map(toLead).filter((l): l is LsaLead => l !== null);
  let events: Awaited<ReturnType<typeof eventsForLeads>> = [], note = '';
  try { events = await eventsForLeads(api, leads.map(l => l.id)); }
  catch (e) { if (e instanceof LsaError && e.kind === 'access') note = ` Conversations are blocked: ${e.message}`; else throw e; }
  console.log(`${leads.length} LSA lead${leads.length === 1 ? '' : 's'} in the last 30 days (${api.ops} API operations).${note}`);
  for (const l of leads) {
    const thread = events.filter(e => e.lsa === l.id), messages = thread.filter(e => e.channel !== 'PHONE_CALL').length;
    // Only the customer's own words count toward the service, never ours.
    const svc = serviceFor({ serviceId: l.service, category: l.category, type: l.type, messages: thread.filter(e => e.who === 'customer' && e.text).map(e => e.text!) });
    console.log(`- ${l.name ?? '(no name)'} | ${l.type ?? 'unknown type'} | service_id=${l.service ?? '-'} | category_id=${l.category ?? '-'} | -> ${svc.service} (from ${svc.from.replace('_', ' ')}) | ${messages} message${messages === 1 ? '' : 's'}${thread.length > messages ? `, ${thread.length - messages} call${thread.length - messages === 1 ? '' : 's'}` : ''}`);
  }
}

/** The database with the server-only key. Only these founder-run scripts and the host poller use it. */
function database(): { db: Db; org: string | null } {
  const key = process.env.OJ_SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error('OJ_SUPABASE_SERVICE_ROLE_KEY is not in .env.local. Add it (Supabase > Project Settings > API) and run again.');
  return { db: serviceClient(key), org: lsaOrganization() };
}

async function backfill() {
  const { db, org } = database();
  if (!org) throw new Error('OJ_EXTERIOR_ORGANIZATION_ID is not in .env.local (the workspace id the Exterior Care leads belong to).');
  const file = flagValue(process.argv, '--overrides') ?? defaultOverrides, overrides = readOverrides(file);
  console.log(overrides.length ? `Overrides: ${overrides.length} link${overrides.length === 1 ? '' : 's'} chosen by hand (${file}).` : `Overrides: none (no file at ${file}).`);
  await backfillLsa(db, org, line => console.log(line), overrides);
}

/** Archives the leads that came from the Google Sheet. Nothing is deleted, and the sheet itself is never touched. */
async function archiveSheetLeads(dryRun: boolean) {
  const { db } = database();
  const now = new Date();
  const rows = await readLeads(db, '*');
  const plan = planSheetArchive(rows, now);
  describeArchive(plan, line => console.log(line));
  if (dryRun) { console.log('\nDry run: nothing was changed.'); return; }

  mkdirSync('backups', { recursive: true });
  const file = resolve('backups', `sheet-leads-${now.toISOString().replace(/[:.]/g, '-')}.json`);
  const dups = new Set(plan.merges.map(m => m.dup.id));
  writeFileSync(file, JSON.stringify({ takenAt: now.toISOString(), leads: rows.filter(r => isSheetLead(r) || dups.has(r.id)) }, null, 2));
  console.log(`\nBackup written: ${file}`);
  const done = await applySheetArchive(db, plan, now);
  console.log(`Done: ${done.archived} archived, ${done.merged} merged, ${plan.keep.length} kept active.${done.failed.length ? `\n${done.failed.length} could not be saved:\n  ${done.failed.join('\n  ')}` : ''}`);
  if (done.failed.length) process.exitCode = 1;
}

const jobs: Record<string, () => Promise<void>> = { test, backfill, 'archive-sheet-leads': () => archiveSheetLeads(process.argv.includes('--dry-run')), 'dry-run': () => dryRun(process.argv.slice(2)) };
const command = process.argv.slice(2).find((a, i, all) => !a.startsWith('--') && !valueFlags.includes(all[i - 1])) ?? '';
if (command === 'login') {
  console.error('Retired: the lead engine signs in with a service account key now, so there is no login step. Set GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH in .env.local (see .env.example), then run: npm run lsa -- test');
  process.exitCode = 1;
} else if (!jobs[command]) {
  console.error('Usage: npm run lsa -- test | backfill | archive-sheet-leads [--dry-run] | dry-run [--from snapshot.json] [--rehearse] [--overrides file] [--summary] [--out file] [--baseline file] [--focus ids]');
  process.exitCode = 1;
} else {
  jobs[command]().catch(e => { console.error(e instanceof LsaError ? `${e.kind}: ${e.message}` : e instanceof Error ? e.message : String(e)); process.exitCode = 1; });
}
