import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lowStock, summariseOrders, type ShopOrder, type ShopProduct } from '../src/lib/shopify';

const now = new Date(2026, 9, 2, 15, 0);
const at = (daysAgo: number) => new Date(2026, 9, 2 - daysAgo, 12, 0).toISOString();
const order = (o: Partial<ShopOrder>): ShopOrder => ({ id: Math.random().toString(), name: '#1', createdAt: at(0), total: 10, cancelled: false, test: false, paid: 'PAID', fulfilled: 'FULFILLED', items: [], ...o });

test('order summary counts only real, uncancelled orders inside the window', () => {
  const s = summariseOrders([
    order({ total: 40, items: [{ title: 'Tea', quantity: 2 }] }),
    order({ total: 20, createdAt: at(29), items: [{ title: 'Tea', quantity: 1 }, { title: 'Balm', quantity: 5 }] }),
    order({ total: 999, createdAt: at(30) }),
    order({ total: 999, cancelled: true }),
    order({ total: 999, test: true }),
  ], now);
  assert.equal(s.revenue, 60);
  assert.equal(s.count, 2);
  assert.equal(s.average, 30);
  assert.equal(s.daily.length, 30);
  assert.equal(s.daily[29], 40);
  assert.equal(s.daily[0], 20);
  assert.deepEqual(s.top, [{ title: 'Balm', sold: 5 }, { title: 'Tea', sold: 3 }]);
});

test('no orders gives no average rather than zero', () => {
  const s = summariseOrders([], now);
  assert.equal(s.average, null);
  assert.equal(s.revenue, 0);
});

test('low stock lists tracked variants of products on sale only', () => {
  const product = (p: Partial<ShopProduct>): ShopProduct => ({ id: 'p', title: 'Tea', status: 'ACTIVE', price: 10, tracked: true, stock: 0, variants: [], ...p });
  const low = lowStock([
    product({ variants: [{ title: 'S', sku: 'a', quantity: 5 }, { title: 'M', sku: 'b', quantity: 6 }, { title: 'L', sku: 'c', quantity: 0 }, { title: 'XL', sku: 'd', quantity: null }] }),
    product({ title: 'Draft', status: 'DRAFT', variants: [{ title: 'S', sku: 'e', quantity: 0 }] }),
    product({ title: 'Untracked', tracked: false, variants: [{ title: 'S', sku: 'f', quantity: 0 }] }),
  ]);
  assert.deepEqual(low.map(l => l.sku), ['c', 'a']);
});
