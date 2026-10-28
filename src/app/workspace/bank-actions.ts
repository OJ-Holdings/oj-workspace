'use server';

import { requireMember } from '@/lib/supabase';
import { readMercuryHistory } from '@/lib/mercury-server';
import { bankKey, bankLines, isBooked, MAX_POST_BATCH, pairedOutgoing, suggestCategory, type BankTx, type Division, type LedgerAccount, type Suggestion } from '@/lib/bank-books';
import { isMissingTable } from '@/lib/invoices';

// The bank queue turns Mercury transactions into balanced journal entries through oj_post_journal (source 'bank', key 'bank:<transaction id>', so posting
// the same transaction twice is a no-op). Owner only, because the bank itself is owner only. Amounts and dates are read from the bank again on the server.

export type QueueRow = BankTx & { suggest: Suggestion | null; paired: boolean };
export type BankQueue =
  | { ok: true; accounts: Array<{ id: string; name: string; balanceCents: number | null }>; rows: QueueRow[]; postedCount: number; ledger: LedgerAccount[];
      balances: Array<{ code: string; type: string; debit: number; credit: number }>; truncated: boolean }
  | { ok: false; reason: 'owner-only' | 'not-connected' | 'not-set-up' | 'failed' };
export type BankPost = { txId: string; bankAccountId: string; categoryAccountId: string; division: string };
export type PostResult = { ok: true; posted: number; failed: Array<{ txId: string; message: string }> } | { ok: false; message: string };

const DIVISIONS: Division[] = ['exterior', 'solutions', 'essentials', 'content', 'shared'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const friendly = (m: string | undefined) => (m ?? 'That did not go through.').replace(/^.*?(ERROR:\s*)/i, '').slice(0, 200);

export async function loadBankQueue(org: string): Promise<BankQueue> {
  let ctx;
  try { ctx = await requireMember(org); } catch { return { ok: false, reason: 'owner-only' }; }
  if (ctx.member.role !== 'owner') return { ok: false, reason: 'owner-only' };
  const { client } = ctx;
  const accounts = await client.from('oj_accounts').select('id,code,name,type').eq('organization_id', org).eq('active', true).order('code');
  if (accounts.error) return { ok: false, reason: isMissingTable(accounts.error) ? 'not-set-up' : 'failed' };
  if (!accounts.data?.length) return { ok: false, reason: 'not-set-up' };
  const history = await readMercuryHistory();
  if (!history) return { ok: false, reason: 'not-connected' };
  const posted = await client.from('oj_journal_entries').select('idempotency_key').eq('organization_id', org).like('idempotency_key', 'bank:%').limit(10000);
  if (posted.error) return { ok: false, reason: 'failed' };
  const done = new Set((posted.data ?? []).map(r => String(r.idempotency_key)));
  const trial = await client.rpc('oj_trial_balance', { p_org: org, p_through: new Date().toISOString().slice(0, 10) });
  if (trial.error) return { ok: false, reason: 'failed' };
  const booked = history.txs.filter(isBooked);
  const hidden = pairedOutgoing(booked);
  const names = history.accounts.map(a => ({ id: a.id, name: a.name }));
  const rows: QueueRow[] = booked.filter(t => !done.has(bankKey(t.id))).map(t => ({ ...t, suggest: suggestCategory(t, names), paired: hidden.has(t.id) }));
  return {
    ok: true, truncated: history.truncated, postedCount: booked.filter(t => done.has(bankKey(t.id))).length, rows,
    accounts: history.accounts.map(a => ({ id: a.id, name: a.name, balanceCents: a.currentBalance === null ? null : Math.round(a.currentBalance * 100) })),
    ledger: accounts.data as LedgerAccount[],
    balances: (trial.data ?? []).map((r: { code: string; type: string; debit_cents: number | string; credit_cents: number | string }) => ({ code: r.code, type: r.type, debit: Number(r.debit_cents), credit: Number(r.credit_cents) })),
  };
}

export async function postBankItems(org: string, items: BankPost[]): Promise<PostResult> {
  let ctx;
  try { ctx = await requireMember(org, true); } catch { return { ok: false, message: 'Only a workspace owner can post bank transactions.' }; }
  if (ctx.member.role !== 'owner') return { ok: false, message: 'Only a workspace owner can post bank transactions.' };
  if (!Array.isArray(items) || items.length === 0 || items.length > MAX_POST_BATCH) return { ok: false, message: `Choose between 1 and ${MAX_POST_BATCH} transactions.` };
  const history = await readMercuryHistory();
  if (!history) return { ok: false, message: 'The bank did not respond. Nothing was posted.' };
  const byId = new Map(history.txs.filter(isBooked).map(t => [t.id, t]));
  const hidden = pairedOutgoing([...byId.values()]);
  let posted = 0;
  const failed: Array<{ txId: string; message: string }> = [];
  for (const item of items) {
    const t = byId.get(String(item.txId));
    if (!t) { failed.push({ txId: String(item.txId), message: 'That transaction is not completed at the bank.' }); continue; }
    if (hidden.has(t.id)) { failed.push({ txId: t.id, message: 'This is the outgoing half of a move between your own accounts; post the incoming half.' }); continue; }
    if (!UUID.test(String(item.bankAccountId)) || !UUID.test(String(item.categoryAccountId)) || item.bankAccountId === item.categoryAccountId) { failed.push({ txId: t.id, message: 'Choose two different accounts.' }); continue; }
    if (!DIVISIONS.includes(item.division as Division)) { failed.push({ txId: t.id, message: 'Choose a division.' }); continue; }
    const memo = (t.counterparty || t.note || t.kind || 'Bank transaction').slice(0, 200);
    const lines = bankLines(t, item.bankAccountId, item.categoryAccountId, item.division as Division, memo);
    const { error } = await ctx.client.rpc('oj_post_journal', { p_org: org, p_date: t.day, p_memo: memo, p_source_type: 'bank', p_source_id: null, p_key: bankKey(t.id), p_lines: lines });
    if (error) failed.push({ txId: t.id, message: friendly(error.message) }); else posted += 1;
  }
  return { ok: true, posted, failed };
}
