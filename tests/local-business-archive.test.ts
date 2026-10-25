import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { exportLocalBusinessArchive, restoreMissingLocalBusinessArchive, validateLocalBusinessArchive } from '../src/lib/local-business-archive';

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

test('recovery validates hashes and restores only missing same-organization keys', async () => {
  const values = {
    [`oj-commercial-estimate-v2:${org}`]: '{"estimate":"old"}',
    [`oj-commercial-project-portfolio-v1:${org}`]: '{"projects":["kept"]}',
  };
  const archive = await exportLocalBusinessArchive(storage(values), org, 'https://oj.example.test', '2026-10-25T12:00:00.000Z');
  const serialized = JSON.stringify(archive);
  const validated = await validateLocalBusinessArchive(serialized, org);
  const restored: Record<string, string> = { [archive.records[0].key]: '{"estimate":"newer local draft"}' };
  const target = {
    getItem(key: string) { return Object.prototype.hasOwnProperty.call(restored, key) ? restored[key] : null; },
    setItem(key: string, value: string) { restored[key] = value; },
    removeItem(key: string) { delete restored[key]; },
  };

  const result = await restoreMissingLocalBusinessArchive(target, validated, org);
  assert.deepEqual(result.restoredKeys, [archive.records[1].key]);
  assert.deepEqual(result.skippedExistingKeys, [archive.records[0].key]);
  assert.equal(restored[archive.records[0].key], '{"estimate":"newer local draft"}');
  assert.equal(restored[archive.records[1].key], archive.records[1].value);
});

test('recovery rejects a corrupt record and a cross-organization archive before writes', async () => {
  const archive = await exportLocalBusinessArchive(storage({ [`oj-commercial-estimate-v2:${org}`]: '{"estimate":1}' }), org, 'https://oj.example.test');
  const corrupt = structuredClone(archive);
  corrupt.records[0].value = '{"estimate":2}';
  await assert.rejects(() => validateLocalBusinessArchive(JSON.stringify(corrupt), org), /checksum/);
  await assert.rejects(() => validateLocalBusinessArchive(JSON.stringify(archive), '00000000-0000-4000-8000-000000000002'), /organization-matched/);
});

test('storage quota failure rolls back only keys inserted by this archive', async () => {
  const values: Record<string, string> = {
    [`oj-commercial-estimate-v2:${org}`]: '{"estimate":1}',
    [`oj-commercial-project-portfolio-v1:${org}`]: '{"projects":[]}',
  };
  const archive = await exportLocalBusinessArchive(storage(values), org, 'https://oj.example.test');
  const restored: Record<string, string> = { 'unrelated': 'preserved' };
  let writes = 0;
  const target = {
    getItem(key: string) { return Object.prototype.hasOwnProperty.call(restored, key) ? restored[key] : null; },
    setItem(key: string, value: string) { writes += 1; if (writes === 2) throw new Error('quota'); restored[key] = value; },
    removeItem(key: string) { delete restored[key]; },
  };
  await assert.rejects(() => restoreMissingLocalBusinessArchive(target, archive, org), /rolled back/);
  assert.deepEqual(restored, { unrelated: 'preserved' });
});
