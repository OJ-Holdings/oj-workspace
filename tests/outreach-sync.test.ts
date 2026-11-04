import test from 'node:test';
import assert from 'node:assert/strict';
import { handler, hasValidSyncToken } from '../netlify/functions/daily-outreach-sync';
import { GET as nextGet, POST as nextPost } from '../src/app/api/daily-outreach-sync/route';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('outreach sync token requires an exact Bearer credential', () => {
  assert.equal(hasValidSyncToken('Bearer secret-token', 'secret-token'), true);
  assert.equal(hasValidSyncToken('bearer secret-token', 'secret-token'), false);
  assert.equal(hasValidSyncToken('Bearer wrong-token', 'secret-token'), false);
  assert.equal(hasValidSyncToken(undefined, 'secret-token'), false);
  assert.equal(hasValidSyncToken('Bearer secret-token', undefined), false);
});

test('Windows import route authenticates before reading and limits uploaded bytes', async () => {
  const previous = process.env.OJ_OUTREACH_SYNC_TOKEN;
  process.env.OJ_OUTREACH_SYNC_TOKEN = 'synthetic-token';
  try {
    assert.equal((await nextGet()).status, 405);
    assert.equal((await nextPost(new Request('http://localhost/api/daily-outreach-sync', { method: 'POST', body: 'not json' }))).status, 401);
    const auth = { authorization: 'Bearer synthetic-token' };
    assert.equal((await nextPost(new Request('http://localhost/api/daily-outreach-sync', { method: 'POST', headers: { ...auth, 'content-length': '512001' }, body: 'x' }))).status, 413);
    assert.equal((await nextPost(new Request('http://localhost/api/daily-outreach-sync', { method: 'POST', headers: auth, body: 'x'.repeat(512_001) }))).status, 413);
    assert.equal((await nextPost(new Request('http://localhost/api/daily-outreach-sync', { method: 'POST', headers: auth, body: 'invalid json' }))).status, 400);
  } finally { if (previous === undefined) delete process.env.OJ_OUTREACH_SYNC_TOKEN; else process.env.OJ_OUTREACH_SYNC_TOKEN = previous; }
});

test('sheet script reads the actual 18-column layout and targets the OJ import route', () => {
  const script = readFileSync(new URL('../scripts/google-apps-script/outreach-sync.gs', import.meta.url), 'utf8');
  let capturedColumns = 0, capturedUrl = '';
  const context = {
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => 'synthetic-token' }) },
    SpreadsheetApp: { openById: () => ({ getSheetByName: () => ({ getLastRow: () => 2, getLastColumn: () => 18, getRange: (_r: number, _c: number, _n: number, cols: number) => { capturedColumns = cols; return { getDisplayValues: () => [['Message'], ['Test']] }; } }) }) },
    UrlFetchApp: { fetch: (url: string) => { capturedUrl = url; return { getResponseCode: () => 200, getContentText: () => '{}' }; } },
    console: { log: () => {} },
  };
  runInNewContext(`${script}\nsyncOutreachSheet();`, context);
  assert.equal(capturedColumns, 18);
  assert.equal(new URL(capturedUrl).pathname, '/api/daily-outreach-sync');
});

test('outreach sync endpoint rejects untrusted requests before parsing data', async () => {
  const unauthorized = await handler({ httpMethod: 'POST', headers: {}, body: 'not-json' });
  assert.equal(unauthorized.statusCode, 401);

  const method = await handler({ httpMethod: 'GET', headers: {}, body: '' });
  assert.equal(method.statusCode, 405);

  const previous = process.env.OJ_OUTREACH_SYNC_TOKEN;
  process.env.OJ_OUTREACH_SYNC_TOKEN = 'test';
  try {
    const oversized = await handler({
      httpMethod: 'POST', headers: { authorization: 'Bearer test' }, body: 'x'.repeat(512_001),
    });
    assert.equal(oversized.statusCode, 413);
    const invalid = await handler({ httpMethod: 'POST', headers: { authorization: 'Bearer test' }, body: 'not-json' });
    assert.equal(invalid.statusCode, 400);
  } finally {
    if (previous === undefined) delete process.env.OJ_OUTREACH_SYNC_TOKEN;
    else process.env.OJ_OUTREACH_SYNC_TOKEN = previous;
  }
});
