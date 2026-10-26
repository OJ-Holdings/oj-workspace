import assert from 'node:assert/strict';
import test from 'node:test';
import { GET, POST } from '../src/app/api/outreach-email-engine/route';

test('the app route serves the same token-protected door as the Netlify function', async () => {
  const saved = process.env.OJ_OUTREACH_SYNC_TOKEN;
  process.env.OJ_OUTREACH_SYNC_TOKEN = 'route-test-token';
  try {
    const post = (headers: Record<string, string>, body: string) => POST(new Request('http://localhost/api/outreach-email-engine', { method: 'POST', headers, body }));
    assert.equal((await post({}, '{"action":"plan"}')).status, 401);
    assert.equal((await post({ authorization: 'Bearer wrong' }, '{"action":"plan"}')).status, 401);
    assert.equal((await post({ authorization: 'Bearer route-test-token' }, 'not json')).status, 400);
    assert.equal((await post({ authorization: 'Bearer route-test-token' }, '{"action":"nope"}')).status, 400);
    assert.equal((await GET()).status, 405);
  } finally {
    if (saved === undefined) delete process.env.OJ_OUTREACH_SYNC_TOKEN; else process.env.OJ_OUTREACH_SYNC_TOKEN = saved;
  }
});
