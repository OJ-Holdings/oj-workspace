'use client';

import { useEffect, useState } from 'react';
import NumberFlow from '@number-flow/react';
import { loadShopify } from '@/app/workspace/shopify-actions';
import { lowStock, lowStockAt, summariseOrders, type ShopResult } from '@/lib/shopify';
import { dollars } from '@/lib/metrics';
import { LineChart } from './Charts';

const words = (s: string) => s ? s.charAt(0) + s.slice(1).toLowerCase().replace(/_/g, ' ') : '-';
const usd = { style: 'currency', currency: 'USD', maximumFractionDigits: 0 } as const;

/** The Orders, Products and Inventory tabs of OJ Essentials, read live from Shopify. */
export function ShopifyView({ tab, org, mode }: { tab: string; org: string; mode: 'preview' | 'live' }) {
  const [result, setResult] = useState<ShopResult | null>(null);
  const [now, setNow] = useState<Date | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (mode !== 'live') return;
    let live = true;
    setResult(null);
    loadShopify(org).then(r => { if (live) { setResult(r); setNow(new Date()); } }, () => { if (live) setResult({ ok: false, reason: 'failed' }); });
    return () => { live = false; };
  }, [org, mode, attempt]);

  if (mode === 'preview') return <div className="planned"><h2>Shown in your live workspace</h2><p>Orders, products and stock come straight from the Shopify store, so there is no sample version of this tab.</p></div>;
  if (!result || !now) return <div className="loading" aria-busy="true" />;
  if (!result.ok) return result.reason === 'not-connected'
    ? <div className="planned"><h2>Shopify is not connected</h2><p>Add the store address and the app's client ID and secret to the host settings. The steps are in docs/CONNECTIONS.md.</p></div>
    : <div className="planned" role="alert"><h2>Shopify did not answer</h2><p>Nothing is shown rather than out-of-date figures. Check that the OJ Workspace app is still installed on the store.</p><button className="primary" onClick={() => setAttempt(attempt + 1)}>Try again</button></div>;

  const { data } = result;
  const fetched = <p className="quiet">Read from Shopify at {new Date(data.fetchedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}. Refreshes every five minutes.</p>;

  if (tab === 'orders') {
    const s = summariseOrders(data.orders, now);
    return <>
      <div className="kpis">
        <div><span>Order totals, last 30 days</span><strong><NumberFlow value={s.revenue} format={usd} /></strong><small className="quiet">Includes shipping and tax, after refunds</small></div>
        <div><span>Orders, last 30 days</span><strong><NumberFlow value={s.count} /></strong></div>
        <div><span>Average order</span><strong>{s.average === null ? '-' : dollars(Math.round(s.average * 100) / 100)}</strong></div>
      </div>
      <section className="panel">
        <header className="panel-head"><h2>Order totals by day</h2></header>
        {s.count ? <LineChart labels={s.labels} series={[{ id: 'essentials', label: 'Order totals', color: 'var(--c-essentials)', values: s.daily }]} />
          : <div className="empty"><p><b>No orders in the last 30 days.</b> They appear here as soon as Shopify records one.</p></div>}
      </section>
      {s.top.length > 0 && <section className="panel">
        <header className="panel-head"><h2>Best sellers, last 30 days</h2></header>
        <div className="tablewrap"><table className="table"><thead><tr><th>Product</th><th className="num">Units sold</th></tr></thead>
          <tbody>{s.top.map(t => <tr key={t.title}><td>{t.title}</td><td className="num">{t.sold}</td></tr>)}</tbody></table></div>
      </section>}
      <section className="panel">
        <header className="panel-head"><h2>Recent orders</h2></header>
        {data.orders.length ? <div className="tablewrap"><table className="table">
          <thead><tr><th>Order</th><th>Date</th><th>Items</th><th>Payment</th><th>Delivery</th><th className="num">Total</th></tr></thead>
          <tbody>{data.orders.slice(0, 50).map(o => (
            <tr key={o.id}><td>{o.name}{o.test && ' (test)'}</td><td>{new Date(o.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</td>
              <td>{o.items.map(i => `${i.quantity} x ${i.title}`).join(', ') || '-'}</td><td>{o.cancelled ? 'Cancelled' : words(o.paid)}</td><td>{o.cancelled ? '-' : words(o.fulfilled)}</td><td className="num">{dollars(o.total)}</td></tr>
          ))}</tbody></table></div>
          : <div className="empty"><p><b>No orders in the last 60 days.</b> Shopify shares 60 days of orders with this app.</p></div>}
        {(data.ordersTruncated || data.orders.length > 50) && <p className="quiet">Showing the latest 50. {data.ordersTruncated ? 'Figures above cover the most recent 250 orders only.' : ''}</p>}
        {fetched}
      </section>
    </>;
  }

  if (tab === 'products') {
    const live = data.products.filter(p => p.status === 'ACTIVE').length;
    return <>
      <div className="kpis">
        <div><span>Products</span><strong><NumberFlow value={data.products.length} /></strong></div>
        <div><span>On sale now</span><strong><NumberFlow value={live} /></strong></div>
        <div><span>Drafts and archived</span><strong><NumberFlow value={data.products.length - live} /></strong></div>
      </div>
      <section className="panel">
        <header className="panel-head"><h2>Catalogue</h2></header>
        {data.products.length ? <div className="tablewrap"><table className="table">
          <thead><tr><th>Product</th><th>Status</th><th className="num">Price from</th><th className="num">In stock</th></tr></thead>
          <tbody>{data.products.map(p => <tr key={p.id}><td>{p.title}</td><td>{words(p.status)}</td><td className="num">{dollars(p.price)}</td><td className="num">{p.tracked ? p.stock : 'Not tracked'}</td></tr>)}</tbody></table></div>
          : <div className="empty"><p><b>No products in the store yet.</b> Add one in Shopify and it appears here.</p></div>}
        {data.productsTruncated && <p className="quiet">Showing the first 250 products.</p>}
        {fetched}
      </section>
    </>;
  }

  const low = lowStock(data.products);
  const rows = data.products.filter(p => p.status === 'ACTIVE').flatMap(p => p.variants.map(v => ({ ...v, product: p.title, key: `${p.id}-${v.title}` })));
  const tracked = rows.filter(r => r.quantity !== null);
  return <>
    <div className="kpis">
      <div><span>Units in stock</span><strong><NumberFlow value={tracked.reduce((n, r) => n + Math.max(0, r.quantity as number), 0)} /></strong><small className="quiet">Products on sale, tracked stock only</small></div>
      <div><span>Running low ({lowStockAt} or fewer)</span><strong className={low.length ? 'neg' : ''}><NumberFlow value={low.length} /></strong></div>
      <div><span>Sold out</span><strong className={low.some(l => l.quantity <= 0) ? 'neg' : ''}><NumberFlow value={low.filter(l => l.quantity <= 0).length} /></strong></div>
    </div>
    <section className="panel">
      <header className="panel-head"><h2>Stock by product</h2></header>
      {rows.length ? <div className="tablewrap"><table className="table">
        <thead><tr><th>Product</th><th>Option</th><th>SKU</th><th className="num">In stock</th><th>Status</th></tr></thead>
        <tbody>{[...rows].sort((a, b) => (a.quantity ?? Infinity) - (b.quantity ?? Infinity)).map(r => (
          <tr key={r.key}><td>{r.product}</td><td>{r.title === 'Default Title' ? '-' : r.title}</td><td>{r.sku || '-'}</td>
            <td className={r.quantity !== null && r.quantity <= lowStockAt ? 'num neg' : 'num'}>{r.quantity ?? '-'}</td>
            <td>{r.quantity === null ? 'Not tracked' : r.quantity <= 0 ? 'Sold out' : r.quantity <= lowStockAt ? 'Low' : 'OK'}</td></tr>
        ))}</tbody></table></div>
        : <div className="empty"><p><b>Nothing on sale yet.</b> Stock for each product on sale appears here.</p></div>}
      {fetched}
    </section>
  </>;
}
