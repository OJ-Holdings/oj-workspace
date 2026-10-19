import test from 'node:test';
import assert from 'node:assert/strict';
import { handler, hasValidSyncToken } from '../netlify/functions/daily-outreach-sync';

test('outreach sync token requires an exact Bearer credential', () => {
  assert.equal(hasValidSyncToken('Bearer secret-token', 'secret-token'), true);
  assert.equal(hasValidSyncToken('bearer secret-token', 'secret-token'), false);
  assert.equal(hasValidSyncToken('Bearer wrong-token', 'secret-token'), false);
  assert.equal(hasValidSyncToken(undefined, 'secret-token'), false);
  assert.equal(hasValidSyncToken('Bearer secret-token', undefined), false);
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
