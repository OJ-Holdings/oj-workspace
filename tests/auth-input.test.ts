import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeAuthNext, validEmail, passwordError } from '../src/lib/auth-input';
test('account callbacks permit only exact internal destinations', () => {
  for (const next of ['https://evil.test','//evil.test','/\\evil.test','/join/x','/workspace/team','/auth/password?next=https://evil.test',null]) assert.equal(safeAuthNext(next),'/workspace');
  assert.equal(safeAuthNext('/auth/password'),'/auth/password');
  assert.equal(safeAuthNext('/employee'),'/employee');
  const path = `/join/${'a'.repeat(64)}`; assert.equal(safeAuthNext(path),path);
  const employeePath = `/employee/join/${'b'.repeat(64)}`; assert.equal(safeAuthNext(employeePath),employeePath);
});
test('account input validates email and confirmed password without modifying passphrases', () => {
  assert.equal(validEmail('jacob@example.test'),true); assert.equal(validEmail('bad address@example.test'),false);
  assert.ok(passwordError('short','short')); assert.ok(passwordError('long-password-here','different-password'));
  assert.equal(passwordError('a unique passphrase','a unique passphrase'),'');
});
