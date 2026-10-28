import 'server-only';
import type { MercuryAccount, MercurySnapshot } from '@/lib/dashboard';
import { mapMercuryAccounts, mapMercuryTransactions } from '@/lib/mercury';
import { mapBankTransactions, type BankTx } from '@/lib/bank-books';

const endpoint = 'https://api.mercury.com/api/v1';
let cached: { expiresAt: number; snapshot: MercurySnapshot } | null = null;
let inFlight: Promise<MercurySnapshot> | null = null;
async function get(path: string, token: string, signal: AbortSignal): Promise<unknown> {
  const response = await fetch(`${endpoint}${path}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    cache: 'no-store', redirect: 'error', signal,
  });
  if (!response.ok) throw new Error(`Mercury returned HTTP ${response.status}`);
  return response.json();
}

/** Read balances and recent activity only. No write endpoints are used. */
export async function readMercury(): Promise<MercurySnapshot | null> {
  const token = process.env.OJ_MERCURY_API_TOKEN?.trim();
  if (!token) return null;
  if (cached && cached.expiresAt > Date.now()) return cached.snapshot;
  if (inFlight) return inFlight;
  inFlight = loadMercury(token);
  try {
    const snapshot = await inFlight;
    cached = { expiresAt: Date.now() + (snapshot.state === 'unavailable' ? 15_000 : 60_000), snapshot };
    return snapshot;
  } finally {
    inFlight = null;
  }
}

async function loadMercury(token: string): Promise<MercurySnapshot> {
  const checkedAt = new Date().toISOString();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    const accountBody = await get('/accounts?limit=1000&order=asc', token, controller.signal);
    const accounts = mapMercuryAccounts(accountBody);
    if (!accounts) throw new Error('Mercury account response was not understood');
    try {
      const transactionBody = await get('/transactions?limit=50&order=desc', token, controller.signal);
      const transactions = mapMercuryTransactions(transactionBody, accounts);
      if (!transactions) throw new Error('Mercury transaction response was not understood');
      return { state: 'available', detail: `Read-only snapshot of ${accounts.length} accounts and the latest ${transactions.length} transactions.`, accounts, transactions, checkedAt };
    } catch (error) {
      console.error('Mercury transactions omitted:', error instanceof Error ? error.message : 'request failed');
      return { state: 'partial', detail: 'Account balances loaded; recent transactions are temporarily unavailable.', accounts, transactions: [], checkedAt };
    }
  } catch (error) {
    console.error('Mercury bank snapshot omitted:', error instanceof Error ? error.message : 'request failed');
    return { state: 'unavailable', detail: 'Mercury did not respond. Bank figures are omitted rather than treated as zero.', accounts: [], transactions: [], checkedAt };
  } finally {
    clearTimeout(timer);
  }
}

export function mercuryConfigured(): boolean { return Boolean(process.env.OJ_MERCURY_API_TOKEN?.trim()); }

export const HISTORY_LIMIT = 3000;
export type MercuryHistory = { accounts: MercuryAccount[]; txs: BankTx[]; truncated: boolean };

/** Every transaction the bank holds (newest first, up to HISTORY_LIMIT), for the bookkeeping queue. Read-only, never cached, null when not connected or unreachable. */
export async function readMercuryHistory(): Promise<MercuryHistory | null> {
  const token = process.env.OJ_MERCURY_API_TOKEN?.trim();
  if (!token) return null;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const accounts = mapMercuryAccounts(await get('/accounts?limit=1000&order=asc', token, controller.signal));
    if (!accounts) return null;
    const names = new Map(accounts.map(a => [a.id, a.name]));
    const txs: BankTx[] = [];
    const seen = new Set<string>();
    const page = 500;
    for (let offset = 0; offset < HISTORY_LIMIT; offset += page) {
      const body = await get(`/transactions?limit=${page}&offset=${offset}&order=desc`, token, controller.signal);
      const rows = mapBankTransactions(body, names);
      const raw = (body as { transactions?: unknown[] } | null)?.transactions;
      // If the bank ignored the offset and sent the same page again, stop instead of listing everything twice.
      const fresh = rows.filter(r => !seen.has(r.id));
      fresh.forEach(r => seen.add(r.id));
      txs.push(...fresh);
      if (rows.length > 0 && fresh.length === 0) return { accounts, txs, truncated: true };
      if (!Array.isArray(raw) || raw.length < page) return { accounts, txs, truncated: false };
    }
    return { accounts, txs, truncated: true };
  } catch (error) {
    console.error('Mercury history omitted:', error instanceof Error ? error.message : 'request failed');
    return null;
  } finally { clearTimeout(timer); }
}
