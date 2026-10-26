import { test } from 'node:test';
import assert from 'node:assert/strict';
import { removeWorkspaceDocument } from '../src/lib/workspace-document-removal';
import { verifyCommercialSaveReadback, validateCommercialProjectDraft, validateCommercialProjectPage } from '../src/lib/commercial-persistence';
import { newEstimate } from '../src/lib/commercial-estimate';
import type { CommercialProject, ProjectDraft } from '../src/lib/atlas-commercial-portfolio';

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

function fixture() {
  const draft: ProjectDraft = { name: 'Synthetic estimate', input: newEstimate(), review: [false,false,false,false,false],
    phase: 'scoping', bookingId: null, plannedAssetIds: [] };
  const stored: CommercialProject = { ...validateCommercialProjectDraft(org, draft),
    id, revision: 1, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:01.000Z' };
  return { draft, stored };
}

test('commercial readback accepts exact normalized content and generated timestamps', () => {
  const { draft, stored } = fixture();
  assert.equal(verifyCommercialSaveReadback(org, id, 1, draft, stored), stored);
});

test('matching commercial revision cannot hide lost scope, costs, review or phase', () => {
  const { draft, stored } = fixture();
  for (const changed of [
    { ...stored, name: 'Truncated estimate' },
    { ...stored, input: { ...stored.input, laborRate: stored.input.laborRate + 1 } },
    { ...stored, review: [true,false,false,false,false] },
    { ...stored, phase: 'archived' as const },
    { ...stored, plannedAssetIds: ['synthetic-truck'] },
  ]) assert.throws(() => verifyCommercialSaveReadback(org, id, 1, draft, changed), /did not match/);
});

test('commercial readback refuses missing, wrong-project and newer-revision results', () => {
  const { draft, stored } = fixture();
  assert.throws(() => verifyCommercialSaveReadback(org, id, 1, draft, null), /could not be reloaded/);
  assert.throws(() => verifyCommercialSaveReadback(org, id, 1, draft, { ...stored, id: org }), /different project/);
  assert.throws(() => verifyCommercialSaveReadback(org, id, 1, draft, { ...stored, revision: 2 }), /newer revision/);
});

test('commercial pagination cannot silently strand records behind a missing cursor', () => {
  assert.throws(() => validateCommercialProjectPage({ projects: [], hasMore: true }, org), /next page could not be verified/);
  assert.equal(validateCommercialProjectPage({ projects: [], hasMore: false }, org).hasMore, false);
});
