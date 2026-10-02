import { dayKey } from './dashboard';

// What the workspace reads from the OJ Essentials Shopify store. Fetched on the
// server (shopify-server.ts); summarised in the browser so days follow the
// viewer's own clock.

export type ShopOrder = { id: string; name: string; createdAt: string; total: number; cancelled: boolean; test: boolean; paid: string; fulfilled: string; items: { title: string; quantity: number }[] };
export type ShopVariant = { title: string; sku: string; quantity: number | null };
export type ShopProduct = { id: string; title: string; status: string; price: number; tracked: boolean; stock: number; variants: ShopVariant[] };
export type ShopData = { currency: string; orders: ShopOrder[]; ordersTruncated: boolean; products: ShopProduct[]; productsTruncated: boolean; fetchedAt: string };
export type ShopResult = { ok: true; data: ShopData } | { ok: false; reason: 'not-connected' | 'failed' };

export const lowStockAt = 5;

/** Sales figures for the `days` ending today. Cancelled and test orders never count. */
export function summariseOrders(orders: ShopOrder[], now: Date, days = 30) {
  const labels: string[] = [], keys: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    keys.push(dayKey(d));
    labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
  }
  const daily = keys.map(() => 0), units = new Map<string, number>();
  let revenue = 0, count = 0;
  for (const o of orders) {
    if (o.cancelled || o.test) continue;
    const at = keys.indexOf(dayKey(new Date(o.createdAt)));
    if (at < 0) continue;
    daily[at] += o.total; revenue += o.total; count++;
    for (const item of o.items) units.set(item.title, (units.get(item.title) ?? 0) + item.quantity);
  }
  const top = [...units].map(([title, sold]) => ({ title, sold })).sort((a, b) => b.sold - a.sold || a.title.localeCompare(b.title)).slice(0, 5);
  return { labels, daily, revenue, count, average: count ? revenue / count : null, top };
}

/** Tracked variants at or below the low-stock line, emptiest first. */
export function lowStock(products: ShopProduct[]) {
  return products.filter(p => p.status === 'ACTIVE' && p.tracked)
    .flatMap(p => p.variants.filter(v => v.quantity !== null && v.quantity <= lowStockAt).map(v => ({ product: p.title, variant: v.title, sku: v.sku, quantity: v.quantity as number })))
    .sort((a, b) => a.quantity - b.quantity);
}
