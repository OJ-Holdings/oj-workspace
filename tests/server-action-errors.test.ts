import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isStaleServerAction, mutationFailureMessage, STALE_SERVER_ACTION_NOTICE } from '../src/lib/server-action-errors';

test('missing Next.js action ID explains a stale workspace release without suggesting resending DMs', () => {
  const error = new Error('Server Action "703afd1abed81f6498bb013806c87894b979e7f4dd" was not found on the server. Read more: https://nextjs.org/docs/messages/failed-to-find-server-action');
  assert.equal(isStaleServerAction(error), true);
  assert.equal(mutationFailureMessage(error, 'Could not record the DM.'), STALE_SERVER_ACTION_NOTICE);
  assert.match(STALE_SERVER_ACTION_NOTICE, /Do not resend/);
  assert.equal(isStaleServerAction('Failed to find Server Action "abc"'), true);
});

test('ordinary save errors retain their useful message', () => {
  assert.equal(isStaleServerAction(new Error('Network request failed')), false);
  assert.equal(mutationFailureMessage(new Error('Check your access.'), 'Try again.'), 'Check your access.');
  assert.equal(mutationFailureMessage(null, 'Try again.'), 'Try again.');
});
