import { isRealPhone, leadStatuses, normalizePhone } from './exterior-ops';

// Sheet sync and duplicate clean-up, ported from the original Exterior Care app
// (sheetsService.js, doorknocking.js, leads.js) as plain functions: they decide
// what should change and the caller applies it. One difference from the
// original: a lead is only written when something actually differs.

/** The address Google serves a shared sheet's first (or chosen) tab from, as CSV. Built only from the sheet id, never the pasted URL. */
export function sheetCsvUrl(url: string) {
  const id = url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
  if (!id) throw new Error('That is not a Google Sheets link.');
  const gid = url.match(/[#?&]gid=(\d+)/)?.[1];
  return `https://docs.google.com/spreadsheets/d/${id}/gviz/tq?tqx=out:csv${gid ? `&gid=${gid}` : ''}`;
}

export function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], field = '', quoted = false;
  for (let i = 0; i < csv.length; i++) {
    const c = csv[i];
    if (quoted) {
      if (c === '"' && csv[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field.trim()); field = ''; }
    else if (c === '\n') { row.push(field.trim()); rows.push(row); row = []; field = ''; }
    else if (c !== '\r') field += c;
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row); }
  return rows.filter(r => r.some(Boolean));
}

export function mapStatus(raw: string) {
  const s = raw.toLowerCase().replace(/[^a-z0-9\s/-]/g, '').trim();
  if (!s) return 'new';
  if (s === 'job completed' || s.includes('job done')) return 'completed';
  if (s === 'scheduled' || s === 'schedule') return 'booked';
  if (['needs follow up', 'need follow up', 'waiting on client', 'waiting for client'].includes(s)) return 'following_up';
  if (['ghosted', 'cancelled', 'canceled'].includes(s)) return 'closed';
  if (s === 'new lead' || s === 'soft lead') return 'new';
  const has = (...words: string[]) => words.some(w => s.includes(w));
  if (has('complet', 'done', 'finish', 'paid') || s === 'won') return 'completed';
  if (has('book', 'schedul', 'confirm', 'appt', 'appointment')) return 'booked';
  if (has('follow', 'f/u', 'callback', 'call back', 'pending', 'waiting') || s === 'fu') return 'following_up';
  if (has('contact', 'text', 'call', 'reach', 'sent', 'messag')) return 'contacted';
  if (has('close', 'lost', 'declin', 'not interest', 'no interest', 'nope', 'pass', 'skip', 'ghost', 'cancel') || ['no', 'na', 'n/a'].includes(s)) return 'closed';
  return 'new';
}

export const parseQuote = (raw: string) => { const m = raw.replace(/[$,\s]/g, '').match(/^(\d+\.?\d*)/); return m ? parseFloat(m[1]) : null; };

const aliases: Record<string, string[]> = {
  name: ['name'], address: ['address'], phone: ['phone', 'phone number', 'phone #'], source: ['source'],
  service: ['service type', 'service', 'service requested'], quote: ['quote', 'quote amount', 'price'], priority: ['priority'], status: ['status'],
  attempts: ['attempts', 'attempt count', '# attempts', 'contact attempts'], lastContacted: ['last contacted', 'last contact'],
  nextFollowUp: ['next follow up', 'next follow-up', 'next followup', 'followup date'], followUpNotes: ['follow up notes', 'follow-up notes', 'followup notes'], notes: ['notes', 'note'],
};
const legacyOrder: Record<string, number> = { name: 0, address: 1, phone: 2, source: 3, service: 4, quote: 5, status: 6, lastContacted: 7, nextFollowUp: 8, notes: 9 };

export type SyncLead = { id: string; name: string | null; phone: string | null; address: string | null; source: string | null; service_requested: string | null; quote_amount: number | null; status: string | null; notes: string | null; manually_updated_fields: unknown };
type Fields = { name: string; address: string | null; source: string; service_requested: string | null; quote_amount: number | null; status: string; notes: string | null; phone?: string };

/**
 * Compares the sheet with the leads on record. Existing leads are matched by
 * phone, then name and address, then name alone when the row has no usable
 * phone. Fields edited by hand are never overwritten, and a status only ever
 * moves forward. Rows with no usable phone are still imported, with a placeholder.
 */
export function planSheetSync(rows: string[][], existing: SyncLead[], stamp: string) {
  const plan = { inserts: [] as (Fields & { phone: string })[], updates: [] as { id: string; changes: Partial<Fields> }[], unchanged: 0, blank: 0 };
  if (rows.length < 2) return plan;
  const header = rows[0].map(h => h.toLowerCase().trim().replace(/\s+/g, ' '));
  const found = Object.fromEntries(Object.entries(aliases).map(([field, names]) => [field, header.findIndex(h => names.includes(h))]));
  const columns = found.name === -1 && found.phone === -1 ? legacyOrder : found;
  const lower = (s: string | null) => (s ?? '').toLowerCase().trim();
  const claimed = new Set<string>();

  rows.slice(1).forEach((row, i) => {
    const cell = (field: string) => { const at = columns[field]; return at === undefined || at < 0 ? '' : (row[at] ?? '').trim(); };
    const name = cell('name'), address = cell('address'), rawPhone = cell('phone');
    if (!name && !rawPhone) { plan.blank++; return; }
    const phone = normalizePhone(rawPhone);

    let notes = cell('notes');
    const extra = [['Priority', cell('priority')], ['Attempts', cell('attempts')], ['Last Contacted', cell('lastContacted')], ['Next Follow Up', cell('nextFollowUp')]].filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`);
    if (extra.length) notes = notes ? `[${extra.join(' | ')}] ${notes}` : `[${extra.join(' | ')}]`;
    if (cell('followUpNotes')) notes = notes ? `${notes}\nFollow-up notes: ${cell('followUpNotes')}` : `Follow-up notes: ${cell('followUpNotes')}`;
    if (!phone && rawPhone) notes = notes ? `[Phone from sheet: "${rawPhone}"] ${notes}` : `[Phone from sheet: "${rawPhone}"]`;

    const fields: Fields = { name: name || 'Unknown', address: address || null, source: cell('source') || 'door-to-door', service_requested: cell('service') || null, quote_amount: parseQuote(cell('quote')), status: mapStatus(cell('status')), notes: notes || null };
    const free = existing.filter(l => !claimed.has(l.id));
    const match = (phone && free.find(l => l.phone === phone))
      || (name && address && free.find(l => lower(l.name) === lower(name) && lower(l.address) === lower(address)))
      || (name && !phone && free.find(l => lower(l.name) === lower(name)))
      || null;

    if (!match) { plan.inserts.push({ ...fields, phone: phone ?? `NP_${i + 2}_${stamp}` }); return; }
    claimed.add(match.id);
    const locked = Array.isArray(match.manually_updated_fields) ? match.manually_updated_fields : [];
    const changes: Partial<Fields> = {};
    // An empty sheet cell never wipes a value already on record.
    for (const key of ['name', 'address', 'source', 'service_requested', 'notes'] as const) {
      if (!locked.includes(key) && fields[key] !== null && fields[key] !== match[key] && !(key === 'name' && !name)) (changes as Record<string, unknown>)[key] = fields[key];
    }
    if (!locked.includes('quote_amount') && fields.quote_amount !== null && fields.quote_amount !== Number(match.quote_amount)) changes.quote_amount = fields.quote_amount;
    const order = leadStatuses as readonly string[];
    if (!locked.includes('status') && order.indexOf(fields.status) > order.indexOf(match.status ?? 'new')) changes.status = fields.status;
    if (phone && !isRealPhone(match.phone)) changes.phone = phone;
    if (Object.keys(changes).length) plan.updates.push({ id: match.id, changes }); else plan.unchanged++;
  });
  return plan;
}

const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const number = (raw: string | undefined) => { const n = parseFloat((raw ?? '').replace(/[$,%]/g, '').trim()); return Number.isNaN(n) ? null : n; };

/**
 * Door-knocking sheet rows to session records. Columns, in order: Date, Who,
 * Area, Start, End, Doors, Answers, Interested, Quotes, Jobs, Job total, four
 * rate columns, $ per door, Avg job, Doors per hour, Notes. A date with no year
 * is taken as this year, or last year if that would put it more than a month ahead.
 */
export function parseDoorRows(rows: string[][], today: Date) {
  return rows.slice(1).flatMap(row => {
    const raw = (row[0] ?? '').trim();
    let date: string | null = /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : null;
    const m = raw.match(/^([a-zA-Z]+)\s+(\d+)(?:st|nd|rd|th)?,?\s*(\d{4})?$/);
    if (!date && m && months.includes(m[1].toLowerCase())) {
      const month = months.indexOf(m[1].toLowerCase());
      let year = m[3] ? Number(m[3]) : today.getFullYear();
      if (!m[3] && new Date(year, month, Number(m[2])).getTime() - today.getTime() > 31 * 86400000) year--;
      date = `${year}-${String(month + 1).padStart(2, '0')}-${String(Number(m[2])).padStart(2, '0')}`;
    }
    const doors = parseInt(row[5]) || 0;
    if (!date || (doors === 0 && !row[1])) return [];
    return [{
      session_date: date, knocked_by: row[1] || 'Both', area: row[2] || null, start_time: row[3] || null, end_time: row[4] || null,
      doors_knocked: doors, answers: parseInt(row[6]) || 0, interested: parseInt(row[7]) || 0, quotes_given: parseInt(row[8]) || 0, jobs_scheduled: parseInt(row[9]) || 0, job_total: number(row[10]) ?? 0,
      answer_rate: number(row[11]), interest_rate: number(row[12]), quote_rate: number(row[13]), close_rate: number(row[14]), dollars_per_door: number(row[15]), avg_job_value: number(row[16]), doors_per_hour: number(row[17]), notes: row[18] || null,
    }];
  });
}

/**
 * Duplicate leads: first those sharing a real phone number, then those sharing a
 * name and address. In each group the lead furthest along (then with the most
 * detail) is kept; the others' texts and bookings move to it and their notes are added.
 */
export function planDedupe(leads: SyncLead[]) {
  const digits = (p: string | null) => isRealPhone(p) ? p!.replace(/\D/g, '') : '';
  const score = (l: SyncLead) => Math.max(0, (leadStatuses as readonly string[]).indexOf(l.status ?? 'new')) * 10 + [l.address, l.service_requested, l.quote_amount, l.notes].filter(Boolean).length + (digits(l.phone) ? 2 : 0);
  const done = new Set<string>();
  const merges: { keep: string; remove: string[]; notes: string | null; phone: string | null }[] = [];
  const pass = (key: (l: SyncLead) => string) => {
    const groups = new Map<string, SyncLead[]>();
    for (const l of leads) if (!done.has(l.id) && key(l)) groups.set(key(l), [...(groups.get(key(l)) ?? []), l]);
    for (const group of groups.values()) {
      if (group.length < 2) continue;
      const [keep, ...rest] = [...group].sort((a, b) => score(b) - score(a));
      let notes = keep.notes;
      for (const r of rest) if (r.notes && r.notes !== keep.notes) notes = notes ? `${notes}\n[Merged] ${r.notes}` : `[Merged] ${r.notes}`;
      const better = !digits(keep.phone) ? rest.find(r => digits(r.phone))?.phone ?? null : null;
      merges.push({ keep: keep.id, remove: rest.map(r => r.id), notes: notes !== keep.notes ? notes : null, phone: better });
      group.forEach(l => done.add(l.id));
    }
  };
  pass(l => digits(l.phone));
  pass(l => { const n = (l.name ?? '').toLowerCase().trim(), a = (l.address ?? '').toLowerCase().trim().replace(/\s+/g, ' '); return n && a ? `${n}||${a}` : ''; });
  return merges;
}
