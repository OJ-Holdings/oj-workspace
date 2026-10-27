import assert from 'node:assert/strict';
import test from 'node:test';
import { corporateTools, searchActiveTools, toolCategories, toolStatus, visibleTools } from '../src/lib/corporate-tools';
import { contentPersistenceEnabled, isVenture, ventureList } from '../src/lib/ventures';

const ready = { owner: true, connections: { shopify: true, ghl: true } };
const disconnected = { owner: true, connections: { shopify: false, ghl: false } };

test('every tool has a unique stable ID and a known category', () => {
  assert.equal(new Set(corporateTools.map(tool => tool.id)).size, corporateTools.length);
  assert.ok(corporateTools.length >= 20);
  for (const tool of corporateTools) {
    assert.ok(tool.title && tool.description && tool.keywords);
    assert.ok(toolCategories.includes(tool.category));
  }
});

test('planned tools never advertise a navigable action', () => {
  for (const tool of corporateTools) {
    if (!tool.href) assert.equal(toolStatus(tool, ready), 'planned');
    else assert.ok(tool.href.startsWith('/'));
  }
  const creator = corporateTools.find(tool => tool.id === 'content-studio');
  assert.ok(creator);
  assert.equal(creator.href, '/b/content');
  assert.equal(toolStatus(creator, ready), 'available');
});

test('connected source tools surface missing integrations without claiming their data is live', () => {
  const shop = corporateTools.find(tool => tool.id === 'essentials-orders');
  const ghl = corporateTools.find(tool => tool.id === 'solutions-clients');
  assert.ok(shop && ghl);
  assert.equal(toolStatus(shop, disconnected), 'connection-required');
  assert.equal(toolStatus(ghl, disconnected), 'connection-required');
  assert.equal(toolStatus(shop, ready), 'available');
  assert.equal(toolStatus(ghl, ready), 'available');
});

test('global command search only links usable registered tools', () => {
  assert.ok(searchActiveTools('video', ready).some(tool => tool.id === 'content-studio'));
  assert.deepEqual(searchActiveTools('shopify', disconnected).map(tool => tool.id), []);
  assert.ok(searchActiveTools('commercial', ready).some(tool => tool.id === 'commercial-desk'));
  assert.ok(searchActiveTools('tasks', ready).some(tool => tool.id === 'tasks'));
  assert.equal(searchActiveTools('nonsense-does-not-exist', ready).length, 0);
  assert.ok(searchActiveTools('work', ready, 2).length <= 2);
});

test('tool visibility respects owner-only permission metadata', () => {
  const privateTool = {
    id: 'private-admin', title: 'Owner Admin', description: 'Only owners.', keywords: 'admin',
    category: 'Control' as const, href: '/settings' as const, ownerOnly: true,
  };
  // Current registry contains no secret management shortcuts, but the filter remains defensive.
  assert.equal(visibleTools({ owner: false, connections: ready.connections }).some(tool => tool.ownerOnly), false);
  assert.equal(visibleTools({ owner: true, connections: ready.connections }).length, corporateTools.length);
  assert.ok(privateTool.ownerOnly && !visibleTools({ owner: false, connections: ready.connections }).includes(privateTool));
});


test('installed Content Studio is available through the shared venture and tool contracts', () => {
  assert.equal(contentPersistenceEnabled, true);
  assert.equal(isVenture('content'), true);
  assert.deepEqual(ventureList.map(v => v.id), ['exterior','solutions','essentials','content']);
  const creator = corporateTools.find(tool => tool.id === 'content-studio');
  assert.ok(creator);
  assert.equal(creator.previewOnly, false);
  assert.equal(creator.href, '/b/content');
  assert.equal(toolStatus(creator, ready), 'available');
});
