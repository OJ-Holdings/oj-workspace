import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const proposal = readFileSync('docs/db-change-proposals/RUN-ME-2026-11-07-general-business.sql', 'utf8');

test('General task SQL is explicitly NOT APPLIED and touches only the task business check', () => {
  assert.match(proposal, /NOT APPLIED/);
  assert.match(proposal, /public\.oj_cards/);
  assert.match(proposal, /check \(business in \('general', 'exterior', 'solutions', 'essentials', 'content'\)\)/i);
  assert.doesNotMatch(proposal, /\bdelete\s+from\b|\btruncate\b|\bdrop\s+table\b/i);
  assert.match(proposal, /^begin;/m);
  assert.match(proposal, /^commit;/m);
});
