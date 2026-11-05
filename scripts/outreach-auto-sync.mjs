import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, renameSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SHEET = 'https://docs.google.com/spreadsheets/d/1p98z0dW-KERPxTTDQo_mBLUlXSGdFB_pNsWGyJieYpU/export?format=csv';
const MAX_CSV = 2_000_000;
const MAX_BODY = 2_000_000;
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const state = path.resolve(root, '..', 'oj-workspace-releases', 'outreach-sheet-sync.json');
const deploymentState = path.resolve(root, '..', 'oj-workspace-releases', 'state.json');

export function parseSheetCsv(text) {
  const rows = []; let row = [], field = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') { quoted = false; closed = true; }
      else if (c === '\r' && text[i + 1] === '\n') { field += '\n'; i++; }
      else field += c;
    } else if (c === '"' && !field && !closed) quoted = true;
    else if (c === ',') { row.push(field); field = ''; closed = false; }
    else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = ''; closed = false; }
    else if (closed) throw new Error('INVALID_CSV');
    else field += c;
  }
  if (quoted) throw new Error('INVALID_CSV');
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows;
}

export function sheetPayload(text) {
  const rows = parseSheetCsv(text.replace(/^\uFEFF/, ''));
  const headers = (rows[0] ?? []).map(x => x.trim().toLowerCase());
  if (rows.length < 2 || rows.length > 1000 || rows.some(r => r.length > 20) || headers[4] !== 'message' || !headers.includes('business name') || !headers.includes('best fit service') || !headers.includes('sender') || !headers.includes('status')) throw new Error('SHEET_FORMAT_CHANGED');
  const body = JSON.stringify({ rows });
  if (Buffer.byteLength(body, 'utf8') > MAX_BODY) throw new Error('SHEET_TOO_LARGE');
  return { body, rowCount: rows.length - 1 };
}

export async function fetchSheet(fetcher = fetch) {
  let url = new URL(SHEET);
  for (let redirects = 0; redirects <= 4; redirects++) {
    if (url.protocol !== 'https:' || !(url.hostname === 'docs.google.com' || url.hostname.endsWith('.googleusercontent.com'))) throw new Error('UNTRUSTED_REDIRECT');
    const response = await fetcher(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('SHEET_UNAVAILABLE');
      url = new URL(location, url); continue;
    }
    if (!response.ok || !/^text\/csv(?:;|$)/i.test(response.headers.get('content-type') ?? '')) throw new Error('SHEET_UNAVAILABLE');
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > MAX_CSV) throw new Error('SHEET_TOO_LARGE');
    const reader = response.body?.getReader();
    if (!reader) throw new Error('SHEET_UNAVAILABLE');
    const chunks = []; let bytes = 0;
    try {
      for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.byteLength; if (bytes > MAX_CSV) { await reader.cancel(); throw new Error('SHEET_TOO_LARGE'); } chunks.push(value); }
    } finally { reader.releaseLock(); }
    return Buffer.concat(chunks).toString('utf8');
  }
  throw new Error('SHEET_UNAVAILABLE');
}

function syncToken() {
  const file = readFileSync(path.join(root, '.env.local'), 'utf8');
  const lines = file.split(/\r?\n/).filter(x => /^\s*OJ_OUTREACH_SYNC_TOKEN\s*=/.test(x));
  if (lines.length !== 1) throw new Error('SYNC_NOT_CONFIGURED');
  const token = lines[0].slice(lines[0].indexOf('=') + 1).trim().replace(/^['"]|['"]$/g, '');
  if (!token || /[\r\n]/.test(token)) throw new Error('SYNC_NOT_CONFIGURED');
  return token;
}

export function needsSync(digest, previous, now) {
  const age = now - Date.parse(previous?.syncedAt ?? '');
  return previous?.sha256 !== digest || !(age >= 0 && age < 3_600_000);
}

export function validDeployment(record, health) {
  return /^[0-9a-f]{40}$/.test(record?.sha ?? '') && health?.status === 'ok' && health.release === record.sha;
}

async function main() {
  const text = await fetchSheet();
  const { body, rowCount } = sheetPayload(text);
  const digest = createHash('sha256').update(text).digest('hex');
  if (process.argv.includes('--dry-run')) { console.log(JSON.stringify({ status: 'DRY_RUN_OK', rows: rowCount, bytes: Buffer.byteLength(body) })); return; }
  let previous = null;
  try { previous = JSON.parse(readFileSync(state, 'utf8')); } catch { /* first run or unreadable receipt */ }
  if (!needsSync(digest, previous, Date.now())) { console.log(JSON.stringify({ status: 'UNCHANGED', rows: rowCount })); return; }
  const deployed = JSON.parse(readFileSync(deploymentState, 'utf8').replace(/^\uFEFF/, ''));
  const healthResponse = await fetch('http://127.0.0.1:3011/api/deploy-health', { signal: AbortSignal.timeout(8_000) });
  if (!healthResponse.ok || !validDeployment(deployed, await healthResponse.json())) throw new Error('WORKSPACE_UNAVAILABLE');
  const response = await fetch('http://127.0.0.1:3011/api/daily-outreach-sync', { method: 'POST', headers: { authorization: `Bearer ${syncToken()}`, 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error('IMPORT_REFUSED');
  const receipt = await response.json();
  if (typeof receipt.imported !== 'number' || receipt.skipped !== 0 || receipt.duplicates !== 0) throw new Error('IMPORT_INCOMPLETE');
  const tmp = `${state}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify({ sha256: digest, syncedAt: new Date().toISOString(), imported: receipt.imported }), { flag: 'wx' });
  renameSync(tmp, state);
  console.log(JSON.stringify({ status: 'SYNCED', imported: receipt.imported }));
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch(error => { const code = typeof error?.message === 'string' && /^[A-Z_]+$/.test(error.message) ? error.message : 'SYNC_FAILED'; console.error(`Outreach sync: ${code}`); process.exitCode = 1; });
}
