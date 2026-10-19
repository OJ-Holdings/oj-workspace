import 'server-only';
import type { MercurySnapshot } from '@/lib/dashboard';
import { mapMercuryAccounts, mapMercuryTransactions } from '@/lib/mercury';

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
