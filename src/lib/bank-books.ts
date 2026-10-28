export type Division = 'exterior' | 'solutions' | 'essentials' | 'content' | 'shared';
/** One completed Mercury transaction. Cents are signed: money in is positive, money out is negative. */
export type BankTx = { id: string; accountId: string; accountName: string; cents: number; status: string; kind: string; counterparty: string; note: string; day: string };
export type LedgerAccount = { id: string; code: string; name: string; type: string };

export const bankKey = (txId: string) => `bank:${txId}`;
export const MAX_POST_BATCH = 50;

const clip = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');

/** Mercury's transaction list, reduced to what the books need. Anything without a usable amount or id is dropped; nothing is guessed. */
export function mapBankTransactions(body: unknown, accountNames: Map<string, string>): BankTx[] {
  const rows = body && typeof body === 'object' ? (body as Record<string, unknown>).transactions : null;
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((raw): BankTx[] => {
    if (!raw || typeof raw !== 'object') return [];
    const r = raw as Record<string, unknown>;
    const amount = typeof r.amount === 'number' ? r.amount : Number(r.amount);
    const id = clip(r.id, 80), accountId = clip(r.accountId, 80);
    const when = clip(r.postedAt, 40) || clip(r.createdAt, 40);
    if (!id || !Number.isFinite(amount) || !/^\d{4}-\d{2}-\d{2}/.test(when)) return [];
    return [{
      id, accountId, accountName: accountNames.get(accountId) ?? 'Mercury account', cents: Math.round(amount * 100), status: clip(r.status, 30),
      kind: clip(r.kind, 40), counterparty: clip(r.counterpartyName, 200) || clip(r.bankDescription, 200), note: clip(r.note, 300) || clip(r.externalMemo, 300), day: when.slice(0, 10),
    }];
  });
}

/** Only money that has actually moved is booked. Pending, failed, cancelled and reversed items stay out. */
export const isBooked = (t: BankTx) => t.status === 'sent' && t.cents !== 0;

const isEssentials = (name: string) => /\bes\b|essentials/i.test(name);

/** Which ledger account and division a Mercury account belongs to, from its name. Null means the owner must choose (for example the owner distribution accounts). */
export function ledgerForBankAccount(name: string): { code: string; division: Division } | null {
  const n = name.toLowerCase();
  const division: Division = isEssentials(name) ? 'essentials' : 'exterior';
  if (/truck/.test(n)) return { code: '1030', division };
  if (/tax/.test(n)) return { code: '1020', division };
  if (/clearing/.test(n)) return { code: '1010', division };
  if (/operations/.test(n)) return { code: '1000', division };
  if (/credit|card/.test(n)) return { code: '2000', division };
  return null;
}

const rules: Array<[RegExp, string, boolean | null]> = [
  // [pattern on counterparty and note, ledger code, money out only (true), money in only (false), either (null)]
  [/google ?ads|google \*ads|local services|\blsa\b/i, '6000', true],
  [/facebook|meta platforms|fb ?ads|instagram/i, '6010', true],
  [/home ?depot|menards|sherwin|lowe'?s|ace hardware|harbor freight|northern tool|grainger|hydrochloric|hypochlorite|xero|chemical|surfactant|uline/i, '5000', true],
  [/shell|bp#?\b|kwik ?trip|citgo|mobil|exxon|speedway|marathon|casey'?s|pilot|fuel|gas ?station|mobil/i, '5020', true],
  [/sunbelt|united rentals|home depot rental|rent-?a|equipment rental|rental/i, '5040', true],
  [/insurance|geico|progressive|state farm|hiscox|next insurance|thimble/i, '6100', true],
  [/vercel|github|supabase|openai|anthropic|claude|google workspace|gsuite|zoom|notion|godaddy|namecheap|squarespace|adobe|canva|netlify|highlevel|gohighlevel|twilio|slack|dropbox|apple\.com|microsoft|shopify/i, '6110', true],
  [/verizon|t-?mobile|at&t|xfinity|spectrum|comcast|mint mobile|us mobile/i, '6120', true],
  [/stripe|square|paypal/i, '6130', true],
  [/department of revenue|wi ?dor|secretary of state|dfi|license|llc annual/i, '6140', true],
  [/shopify/i, '4200', false],
];

export type Suggestion = { code: string; reason: string };

/** A starting category for a transaction, from what the bank says about it. A suggestion is a pre-filled choice, never posted without a tap. */
export function suggestCategory(t: BankTx, bankAccounts: Array<{ id: string; name: string }>): Suggestion | null {
  const text = `${t.counterparty} ${t.note}`;
  if (/transfer/i.test(t.kind) || /^\d{2}\s/.test(t.counterparty)) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    const target = bankAccounts.find(a => a.id !== t.accountId && norm(t.counterparty).length > 3 && (norm(a.name).includes(norm(t.counterparty)) || norm(t.counterparty).includes(norm(a.name))));
    const ledger = target && ledgerForBankAccount(target.name);
    if (ledger) return { code: ledger.code, reason: `Moved to ${target.name}` };
  }
  if (/credit card|mercury credit|card payment/i.test(text) && t.cents < 0) return { code: '2000', reason: 'Credit card payment' };
  for (const [pattern, code, out] of rules) {
    if (!pattern.test(text)) continue;
    if (out === true && t.cents >= 0) continue;
    if (out === false && t.cents <= 0) continue;
    return { code, reason: `Matched "${(text.match(pattern) ?? [''])[0]}"` };
  }
  return null;
}

/**
 * Money moved between our own Mercury accounts shows up twice, once out of one account and once into the other. The outgoing leg is hidden when its
 * incoming twin is in the list (same amount, different account, within four days), so the move is booked once, from the incoming side.
 */
export function pairedOutgoing(txs: BankTx[]): Set<string> {
  const incoming = txs.filter(t => t.cents > 0 && /transfer/i.test(t.kind));
  const used = new Set<string>();
  const hidden = new Set<string>();
  for (const out of txs.filter(t => t.cents < 0 && /transfer/i.test(t.kind))) {
    const twin = incoming.find(i => !used.has(i.id) && i.cents === -out.cents && i.accountId !== out.accountId && Math.abs(Date.parse(i.day) - Date.parse(out.day)) <= 4 * 86_400_000);
    if (twin) { used.add(twin.id); hidden.add(out.id); }
  }
  return hidden;
}

export type JournalLine = { account_id: string; division: Division; debit_cents: number; credit_cents: number; memo: string };

/** Two lines for one bank transaction. Money in: bank up, category credited. Money out: category debited, bank down. Balanced by construction. */
export function bankLines(t: BankTx, bankAccountId: string, categoryAccountId: string, division: Division, memo: string): JournalLine[] {
  const abs = Math.abs(t.cents);
  const bank = { account_id: bankAccountId, division, memo };
  const cat = { account_id: categoryAccountId, division, memo };
  return t.cents > 0
    ? [{ ...bank, debit_cents: abs, credit_cents: 0 }, { ...cat, debit_cents: 0, credit_cents: abs }]
    : [{ ...cat, debit_cents: abs, credit_cents: 0 }, { ...bank, debit_cents: 0, credit_cents: abs }];
}

/** What the bank says should be in each ledger account (assets add up; a credit card is a liability) against what the books hold, in cents. */
export function bankDifference(mercuryCents: number, ledgerDebit: number, ledgerCredit: number, isLiability: boolean) {
  const books = isLiability ? ledgerCredit - ledgerDebit : ledgerDebit - ledgerCredit;
  return { books, difference: mercuryCents - books };
}
