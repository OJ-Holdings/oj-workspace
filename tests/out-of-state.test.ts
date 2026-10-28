import assert from 'node:assert/strict';
import test from 'node:test';
import { outOfState } from '../src/lib/out-of-state';

test('Illinois and other non-Wisconsin addresses are flagged with their state', () => {
  assert.equal(outOfState('1234 Sheridan Rd, Waukegan, IL 60085'), 'IL');
  assert.equal(outOfState('12 Main St, Gurnee, IL'), 'IL');
  assert.equal(outOfState('12 Main St, Gurnee IL 60031'), 'IL');
  assert.equal(outOfState('5 Lake Dr, Waukegan, Illinois 60085'), 'IL');
  assert.equal(outOfState('9 Pine Ave, Duluth, mn'), 'MN');
});

test('Wisconsin, blank and unreadable addresses are not flagged', () => {
  assert.equal(outOfState('2920 Roosevelt Rd, Kenosha, WI 53140'), null);
  assert.equal(outOfState('2920 Roosevelt Rd, Kenosha, Wisconsin'), null);
  assert.equal(outOfState('2920 Roosevelt Rd, Kenosha WI 53140'), null);
  assert.equal(outOfState(''), null);
  assert.equal(outOfState(null), null);
  assert.equal(outOfState(undefined), null);
  assert.equal(outOfState('Union Grove'), null);
});

test('a street suffix that looks like a state code is not a state', () => {
  assert.equal(outOfState('14 Oak CT'), null);
  assert.equal(outOfState('77 Maple LN'), null);
  assert.equal(outOfState('88 Elm Dr, Racine, WI'), null);
});
