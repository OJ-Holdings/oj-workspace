import assert from 'node:assert/strict';
import test from 'node:test';
import { retiredRoute } from '../src/lib/retired-routes';

test('the empty workspace CRM sends people to Exterior customers', () => {
  assert.equal(retiredRoute(['crm']), '/b/exterior/leads');
});

test('retired tools pages and the tools hub go to Today', () => {
  for (const slug of [['tools'], ['tools', 'operations'], ['tools', 'intelligence'], ['tools', 'weekly-review'], ['tools', 'scenarios'], ['tools', 'unknown']]) assert.equal(retiredRoute(slug), '', slug.join('/'));
});

test('real destinations are left alone', () => {
  for (const slug of [[], ['tasks'], ['finance'], ['invoices'], ['b', 'exterior'], ['tools', 'fleet'], ['tools', 'systems'], ['tools', 'content-preview'], ['crm', 'x']]) assert.equal(retiredRoute(slug), null, slug.join('/'));
});
