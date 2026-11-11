import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const sql = readFileSync('docs/db-change-proposals/RUN-ME-2026-11-07-email-reservation-review.sql', 'utf8');

test('reservation review SQL is unapplied, permission checked, and never deletes reservations', () => {
  assert.match(sql, /NOT APPLIED/);
  assert.match(sql, /oj_list_email_reservation_reviews/);
  assert.match(sql, /oj_decide_email_reservation/);
  assert.match(sql, /oj_private\.member_role/);
  assert.match(sql, /kind='needs_review'/);
  assert.match(sql, /kind='released'/);
  assert.match(sql, /dedupe_key='released:'\|\|claim\.id/);
  assert.doesNotMatch(sql, /\bDELETE\s+FROM\s+public\.oj_email_events\b/i);
});
