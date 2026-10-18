import { test } from 'node:test';
import assert from 'node:assert/strict';
import { memberPresence, presenceAge, validPresenceOrigin, validatePresenceUpdate } from '../src/lib/presence';

const now = Date.parse('2026-10-04T20:00:00Z');
const session = (state: 'online' | 'away' | 'offline', age = 0, user_id = 'oscar') => ({ user_id, session_id: `${user_id}-${age}`, state, seen_at: new Date(now - age).toISOString() });
test('presence expires, aggregates tabs, and never confuses a teammate with yourself', () => {
  assert.equal(memberPresence([session('online', 89_999)], 'oscar', now).state, 'online');
  assert.equal(memberPresence([session('online', 90_000)], 'oscar', now).state, 'offline');
  assert.equal(memberPresence([session('away'), session('online', 1000)], 'oscar', now).state, 'online');
  assert.equal(memberPresence([session('offline'), session('away', 1000)], 'oscar', now).state, 'away');
  assert.equal(memberPresence([session('online', 0, 'jacob')], 'oscar', now).state, 'offline');
  assert.equal(memberPresence([session('online', -60_000)], 'oscar', now).state, 'offline');
  assert.equal(memberPresence([], 'oscar', now).lastSeen, null);
  assert.equal(presenceAge(session('online', 120_000).seen_at, now), 'Last seen 2m ago');
});
test('work updates validate lengths, references and revisions and ignore asserted identities', () => {
  assert.deepEqual(validatePresenceUpdate({ action: 'work', note: ' Quotes ', cardId: null, revision: null, userId: 'jacob' }), { action: 'work', note: 'Quotes', cardId: null, revision: null });
  assert.throws(() => validatePresenceUpdate({ action: 'work', note: 'x'.repeat(161), cardId: null, revision: 0 }));
  assert.throws(() => validatePresenceUpdate({ action: 'work', note: '', cardId: '/somewhere', revision: 0 }));
  assert.throws(() => validatePresenceUpdate({ action: 'work', note: '', cardId: null, revision: -1 }));
  assert.throws(() => validatePresenceUpdate({ action: 'heartbeat', sessionId: 'bad', state: 'online' }));
});
test('cross-site and malformed status requests fail closed', () => {
  assert.equal(validPresenceOrigin('https://workspace.test', 'workspace.test'), true);
  assert.equal(validPresenceOrigin('http://127.0.0.1:3010', '127.0.0.1:3010'), true);
  assert.equal(validPresenceOrigin('https://other.test', 'workspace.test'), false);
  assert.equal(validPresenceOrigin(null, 'workspace.test'), false);
  assert.equal(validPresenceOrigin('null', 'workspace.test'), false);
  assert.equal(validPresenceOrigin('malformed', 'workspace.test'), false);
});
