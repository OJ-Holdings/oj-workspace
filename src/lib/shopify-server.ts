import 'server-only';
import type { ShopData, ShopOrder, ShopProduct } from './shopify';

// Reads the OJ Essentials store through Shopify's Admin API. Read only: this file
// sends queries, never mutations, whatever scopes the app has been given. The
// client secret and the token it buys never leave the server.

const version = '2026-07';
const env = () => ({ domain: process.env.SHOPIFY_STORE_DOMAIN, id: process.env.SHOPIFY_CLIENT_ID, secret: process.env.SHOPIFY_CLIENT_SECRET });
export const shopifyConfigured = () => { const e = env(); return Boolean(e.domain && e.id && e.secret); };

let token: { value: string; expires: number } | null = null;
async function accessToken() {
  if (token && token.expires > Date.now() + 60000) return token.value;
  const e = env();
  if (!/^[a-z0-9-]+\.myshopify\.com$/i.test(e.domain ?? '')) throw new Error('SHOPIFY_STORE_DOMAIN must be the .myshopify.com address.');
  const response = await fetch(`https://${e.domain}/admin/oauth/access_token`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(10000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: e.id!, client_secret: e.secret! }),
  });
  if (!response.ok) throw new Error(`Shopify refused the app credentials (${response.status}).`);
  const body = await response.json() as { access_token: string; expires_in: number };
  token = { value: body.access_token, expires: Date.now() + body.expires_in * 1000 };
  return token.value;
}

async function query<T>(document: string, variables: Record<string, unknown>): Promise<T> {
  const response = await fetch(`https://${env().domain}/admin/api/${version}/graphql.json`, {
    method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(15000),
    headers: { 'Content-Type': 'application/json', 'X-Shopify-Access-Token': await accessToken() },
    body: JSON.stringify({ query: document, variables }),
  });
  if (response.status === 401) token = null;
  if (!response.ok) throw new Error(`Shopify answered ${response.status}.`);
  const body = await response.json() as { data?: T; errors?: { message: string }[] };
  if (body.errors?.length || !body.data) throw new Error(`Shopify query failed: ${body.errors?.[0]?.message ?? 'no data'}`);
  return body.data;
}

type Page<T> = { nodes: T[]; pageInfo: { hasNextPage: boolean; endCursor: string | null } };
// ponytail: at most 5 pages of 50 (250 orders, 250 products). The screens say when the cap is hit; raise it or move to bulk operations if the store outgrows it.
async function pages<T>(document: string, field: string, variables: Record<string, unknown>) {
  const nodes: T[] = [];
  let after: string | null = null, more = true;
  for (let i = 0; i < 5 && more; i++) {
    const data: Record<string, Page<T>> = await query(document, { ...variables, after });
    nodes.push(...data[field].nodes);
    more = data[field].pageInfo.hasNextPage; after = data[field].pageInfo.endCursor;
  }
  return { nodes, truncated: more };
}

const ordersQuery = `query ($after: String, $since: String) { orders(first: 50, after: $after, sortKey: CREATED_AT, reverse: true, query: $since) {
  nodes { id name createdAt cancelledAt test displayFinancialStatus displayFulfillmentStatus currentTotalPriceSet { shopMoney { amount currencyCode } } lineItems(first: 10) { nodes { title quantity } } }
  pageInfo { hasNextPage endCursor } } }`;
const productsQuery = `query ($after: String) { products(first: 50, after: $after, sortKey: TITLE) {
  nodes { id title status tracksInventory totalInventory priceRangeV2 { minVariantPrice { amount } } variants(first: 10) { nodes { title sku inventoryQuantity inventoryItem { tracked } } } }
  pageInfo { hasNextPage endCursor } } }`;

type RawOrder = { id: string; name: string; createdAt: string; cancelledAt: string | null; test: boolean; displayFinancialStatus: string | null; displayFulfillmentStatus: string | null; currentTotalPriceSet: { shopMoney: { amount: string; currencyCode: string } }; lineItems: { nodes: { title: string; quantity: number }[] } };
type RawProduct = { id: string; title: string; status: string; tracksInventory: boolean; totalInventory: number; priceRangeV2: { minVariantPrice: { amount: string } }; variants: { nodes: { title: string; sku: string | null; inventoryQuantity: number | null; inventoryItem: { tracked: boolean } }[] } };

let cached: { data: ShopData; at: number } | null = null;
/** Orders from the last 60 days (all Shopify gives without extra approval) and the catalogue. Cached for five minutes. */
export async function readShopify(): Promise<ShopData> {
  if (cached && Date.now() - cached.at < 300000) return cached.data;
  const since = `created_at:>=${new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10)}`;
  const orders = await pages<RawOrder>(ordersQuery, 'orders', { since });
  const products = await pages<RawProduct>(productsQuery, 'products', {});
  const data: ShopData = {
    currency: orders.nodes[0]?.currentTotalPriceSet.shopMoney.currencyCode ?? 'USD',
    orders: orders.nodes.map((o): ShopOrder => ({
      id: o.id, name: o.name, createdAt: o.createdAt, total: Number(o.currentTotalPriceSet.shopMoney.amount), cancelled: o.cancelledAt !== null, test: o.test,
      paid: o.displayFinancialStatus ?? '', fulfilled: o.displayFulfillmentStatus ?? '', items: o.lineItems.nodes,
    })),
    ordersTruncated: orders.truncated,
    products: products.nodes.map((p): ShopProduct => ({
      id: p.id, title: p.title, status: p.status, price: Number(p.priceRangeV2.minVariantPrice.amount), tracked: p.tracksInventory, stock: p.totalInventory,
      variants: p.variants.nodes.map(v => ({ title: v.title, sku: v.sku ?? '', quantity: v.inventoryItem.tracked ? v.inventoryQuantity : null })),
    })),
    productsTruncated: products.truncated,
    fetchedAt: new Date().toISOString(),
  };
  cached = { data, at: Date.now() };
  return data;
}
