import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchSheet, needsSync, parseSheetCsv, sheetPayload, validDeployment } from './outreach-auto-sync.mjs';

const header = 'Sender,Channel,Send To,Subject,Message,Status,Notes,Business Name,Decision Maker,Best Fit Service';

test('sync targets only the recorded healthy release', () => {
  const sha = 'a'.repeat(40);
  assert.equal(validDeployment({ sha }, { status: 'ok', release: sha }), true);
  assert.equal(validDeployment({ sha }, { status: 'ok', release: 'b'.repeat(40) }), false);
  assert.equal(validDeployment({ sha: 'invalid' }, { status: 'ok', release: 'invalid' }), false);
  assert.equal(validDeployment({ sha }, { status: 'error', release: sha }), false);
});

test('CSV parsing preserves quoted text, line breaks and escaped quotes', () => {
  const rows = parseSheetCsv(`${header}\r\nOscar,Email,,Hi," First\r\nSecond ""line"" ",Not Sent,,Sample,,Web\r\n`);
  assert.equal(rows.length, 2);
  assert.equal(rows[1][4], ' First\nSecond "line" ');
  assert.throws(() => parseSheetCsv('a,"unfinished'), /INVALID_CSV/);
});

test('sheet payload fails closed on wrong headers, excessive columns and oversized messages', () => {
  const valid = sheetPayload(`${header}\nOscar,Email,,Hi,"A\\nB",Not Sent,,Sample,,Web`);
  assert.equal(JSON.parse(valid.body).rows[1][4], 'A\\nB');
  assert.throws(() => sheetPayload('Business Name,Message\nExample,hello'), /SHEET_FORMAT_CHANGED/);
  assert.throws(() => sheetPayload(`${header},${Array(11).fill('extra').join(',')}\nOscar`), /SHEET_FORMAT_CHANGED/);
  assert.throws(() => sheetPayload(`${header}\nOscar,Email,,Hi,${'a'.repeat(2_000_001)},Not Sent,,Sample,,Web`), /SHEET_TOO_LARGE/);
});

test('sheet fetch follows only Google redirects and refuses an HTML login', async () => {
  let calls = 0;
  const csv = `${header}\nOscar,Email,,Hi,Hello,Not Sent,,Sample,,Web`;
  const result = await fetchSheet(async () => {
    calls++;
    return calls === 1 ? new Response(null, { status: 302, headers: { location: 'https://doc-example.googleusercontent.com/export' } }) : new Response(csv, { headers: { 'content-type': 'text/csv; charset=utf-8' } });
  });
  assert.equal(result, csv); assert.equal(calls, 2);
  await assert.rejects(() => fetchSheet(async () => new Response(null, { status: 302, headers: { location: 'https://not-google.example/export' } })), /UNTRUSTED_REDIRECT/);
  await assert.rejects(() => fetchSheet(async () => new Response('<html>login</html>', { headers: { 'content-type': 'text/html' } })), /SHEET_UNAVAILABLE/);
});

test('unchanged sheets are rechecked regularly and eventually refreshed', () => {
  const now = Date.parse('2026-11-04T12:00:00Z');
  assert.equal(needsSync('abc', null, now), true);
  assert.equal(needsSync('abc', { sha256: 'abc', syncedAt: '2026-11-04T11:30:00Z' }, now), false);
  assert.equal(needsSync('abc', { sha256: 'abc', syncedAt: '2026-11-04T10:59:59Z' }, now), true);
  assert.equal(needsSync('abc', { sha256: 'abc', syncedAt: '2026-11-04T12:01:00Z' }, now), true);
  assert.equal(needsSync('different', { sha256: 'abc', syncedAt: '2026-11-04T11:59:00Z' }, now), true);
});
