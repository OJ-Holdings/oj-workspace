import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { exportLocalBusinessArchive } from '../src/lib/local-business-archive';

const org = '00000000-0000-4000-8000-000000000001';

function storage(values: Record<string,string>) {
  const entries = Object.entries(values);
  return {
    get length() { return entries.length; },
    key(index: number) { return entries[index]?.[0] ?? null; },
    getItem(key: string) { return values[key] ?? null; },
  };
}

test('local business archive preserves originals, filters by organization and records verifiable hashes', async () => {
  const ownKey = `oj-commercial-project-portfolio-v1:${org}`;
  const otherOrgKey = 'oj-commercial-project-portfolio-v1:00000000-0000-4000-8000-000000000002';
  const values = {
    [ownKey]: '{"private":"estimate"}',
    [`oj-exterior-estimate-v1:${org}:lead-2`]: '{"amount":17}',
    [`oj-exterior-field-equipment-v1:${org}:booking-1`]: '{"plan":"candidate"}',
    [otherOrgKey]: '{"private":"other org"}',
    'oj-workspace-preview-v2': '{"fictional":true}',
    'unrelated-site-preference': 'compact',
  };
  const source = storage(values);
  const before = { ...values };
  const archive = await exportLocalBusinessArchive(source, org, 'https://oj.example.test', '2026-10-25T12:00:00.000Z');

  assert.equal(archive.records.length, 3);
  assert.deepEqual(archive.records.map(item => item.key), [
    ownKey, `oj-exterior-estimate-v1:${org}:lead-2`, `oj-exterior-field-equipment-v1:${org}:booking-1`,
  ]);
  assert.equal(archive.records[0].sha256, createHash('sha256').update('{"private":"estimate"}').digest('hex'));
  assert.equal(archive.records[1].sha256, createHash('sha256').update('{"amount":17}').digest('hex'));
  assert.equal(archive.records[2].sha256, createHash('sha256').update('{"plan":"candidate"}').digest('hex'));
  assert.equal(archive.archiveSha256.length, 64);
  assert.equal(archive.storage, 'current-origin-localStorage');
  assert.deepEqual(values, before);
  assert.equal(archive.records.some(item => item.value.includes('other org')), false);
});

test('archive refuses an invalid organization identifier', async () => {
  await assert.rejects(() => exportLocalBusinessArchive(storage({}), 'not-an-org', 'https://oj.example.test'));
});
