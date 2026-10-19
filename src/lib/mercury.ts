import type { MercuryAccount, MercuryTransaction } from '@/lib/dashboard';

const currencyCode = (value: unknown) => typeof value === 'string' && /^[A-Z]{3}$/.test(value) ? value : 'USD';
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value.slice(0, 500) : fallback;
const amount = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : typeof value === 'string' && value.trim() && Number.isFinite(Number(value)) ? Number(value) : null;

function records(body: unknown, key: string): Record<string, unknown>[] | null {
  if (!body || typeof body !== 'object') return null;
  const rows = (body as Record<string, unknown>)[key];
  return Array.isArray(rows) ? rows.filter((row): row is Record<string, unknown> => !!row && typeof row === 'object') : null;
}

/** Map Mercury responses into the smallest UI-safe shape; never forward full or routing numbers. */
export function mapMercuryAccounts(body: unknown): MercuryAccount[] | null {
  const rows = records(body, 'accounts');
  if (!rows) return null;
  return rows.filter(row => row.type === 'mercury').map((row, index) => ({
    id: text(row.id, `account-${index}`), name: text(row.nickname) || text(row.name, 'Mercury account'),
    currentBalance: amount(row.currentBalance), availableBalance: amount(row.availableBalance),
    currency: currencyCode(row.currency), status: text(row.status, 'unknown'),
  }));
}

export function mapMercuryTransactions(body: unknown, accounts: MercuryAccount[]): MercuryTransaction[] | null {
  const rows = records(body, 'transactions');
  if (!rows) return null;
  const accountNames = new Map(accounts.map(account => [account.id, account.name]));
  return rows.slice(0, 50).flatMap((row, index) => {
    const value = amount(row.amount);
    if (value === null) return [];
    return [{
      id: text(row.id, `transaction-${index}`), accountName: accountNames.get(text(row.accountId)) ?? 'Mercury account',
      amount: value, currency: currencyCode(row.currency), status: text(row.status, 'unknown'),
      description: text(row.counterpartyName) || text(row.note) || text(row.kind, 'Transaction'),
      postedAt: typeof row.postedAt === 'string' ? row.postedAt : null, createdAt: text(row.createdAt), kind: text(row.kind, 'transaction'),
    }];
  });
}
