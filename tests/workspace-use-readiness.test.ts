import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeWorkspaceDocument } from '../src/lib/workspace-document-removal';

const org = '00000000-0000-4000-8000-000000000001';
const id = '00000000-0000-4000-8000-000000000002';
const path = org + '/synthetic.bin';

function operations() {
  const calls: string[] = [];
  return {
    calls,
    lookup: async (): Promise<{ storagePath: string } | null> => { calls.push('lookup'); return { storagePath: path }; },
    removeObject: async (p: string) => { assert.equal(p, path); calls.push('object'); return true; },
    removeMetadata: async (p: string) => { assert.equal(p, path); calls.push('metadata'); },
  };
}

test('document record is kept when Storage refuses or fails deletion', async () => {
  for (const failure of ['permission denied', 'offline']) {
    const ops = operations();
    ops.removeObject = async () => { ops.calls.push('object'); throw new Error(failure); };
    await assert.rejects(removeWorkspaceDocument(org, id, ops), /company record was kept/);
    assert.deepEqual(ops.calls, ['lookup', 'object']);
  }
});

test('revoked/unavailable document or failed lookup never attempts file deletion', async () => {
  const ops = operations();
  ops.lookup = async () => null;
  await assert.rejects(removeWorkspaceDocument(org, id, ops), /no longer available/);
  assert.deepEqual(ops.calls, []);
  ops.lookup = async () => { throw new Error('synthetic unavailable'); };
  await assert.rejects(removeWorkspaceDocument(org, id, ops), /Nothing was removed/);
  assert.deepEqual(ops.calls, []);
});

test('empty Storage success receipt cannot discard the company reference', async () => {
  const ops = operations();
  ops.removeObject = async () => { ops.calls.push('object'); return false; };
  await assert.rejects(removeWorkspaceDocument(org, id, ops), /company record was kept/);
  assert.deepEqual(ops.calls, ['lookup', 'object']);
});

test('document removal rejects another organization or invalid identity before mutation', async () => {
  const ops = operations();
  ops.lookup = async () => ({ storagePath: id + '/synthetic.bin' });
  await assert.rejects(removeWorkspaceDocument(org, id, ops), /location could not be verified/);
  await assert.rejects(removeWorkspaceDocument(org, 'not-a-uuid', ops), /Invalid document reference/);
  assert.deepEqual(ops.calls, []);
});

test('successful document removal preserves Storage-before-metadata order', async () => {
  const ops = operations();
  await removeWorkspaceDocument(org, id, ops);
  assert.deepEqual(ops.calls, ['lookup', 'object', 'metadata']);
});

test('database failure after file removal is reported for reconciliation, never success', async () => {
  const ops = operations();
  ops.removeMetadata = async () => { throw new Error('synthetic revoked or replaced'); };
  await assert.rejects(removeWorkspaceDocument(org, id, ops), /reconcile the remaining record/);
  assert.deepEqual(ops.calls, ['lookup', 'object']);
});
