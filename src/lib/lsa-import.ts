import { normalizePhone } from './exterior-ops';

/** One row of the Google Local Services Ads lead export (Customer, Job type, Search Intent, Location, Lead type, Charge status, Lead received, Last activity, Lead id). */
export type LsaRow = {
  leadId: string; name: string | null; phone: string | null; jobType: string; location: string; leadType: string;
  charge: 'charged' | 'credited' | 'not charged' | 'unknown';
  /** YYYY-MM-DD, and the same moment as an ISO timestamp (Central time). */
  day: string; receivedAt: string;
};
export type LsaLead = { id: string; name: string | null; phone: string | null; source: string | null; notes: string | null };
export type LsaStep = { row: LsaRow; action: 'create' | 'tag' | 'same' | 'already'; leadId?: string };

export const MAX_LSA_ROWS = 300;
/** Google's help pages say charged leads can be disputed for about 30 days; confirm in the LSA account. */
export const DISPUTE_DAYS = 30;
export const lsaMarker = (id: string) => `LSA lead #${id}`;

const pad = (n: number) => String(n).padStart(2, '0');
/** Central offset for a calendar day: daylight time runs from the second Sunday of March to the first Sunday of November. */
function centralOffset(y: number, m: number, d: number) {
  const nthSunday = (month: number, n: number) => { const first = new Date(Date.UTC(y, month - 1, 1)).getUTCDay(); return 1 + ((7 - first) % 7) + 7 * (n - 1); };
  const dst = (m > 3 && m < 11) || (m === 3 && d >= nthSunday(3, 2)) || (m === 11 && d < nthSunday(11, 1));
  return dst ? '-05:00' : '-06:00';
}

/** "10/25/26 5:55 PM" -> { day: '2026-10-25', at: '2026-10-25T17:55:00-05:00' }, or null when it is not a date. */
export function parseLsaTime(raw: string): { day: string; at: string } | null {
  const m = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AP]M))?$/i);
  if (!m) return null;
  const mo = Number(m[1]), d = Number(m[2]), y = m[3].length === 2 ? 2000 + Number(m[3]) : Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  let h = m[4] ? Number(m[4]) % 12 : 12;
  if (m[6]?.toUpperCase() === 'PM') h += 12;
  const day = `${y}-${pad(mo)}-${pad(d)}`;
  return { day, at: `${day}T${pad(h)}:${m[5] ?? '00'}:00${centralOffset(y, mo, d)}` };
}

const norm = (s: string | null | undefined) => (s ?? '').toLowerCase().replace(/\s+/g, ' ').trim();

function toRow(c: string[]): LsaRow | null {
  const [customer, jobType, , location, leadType, charge, received, , leadId] = c.map(x => x.trim());
  const when = parseLsaTime(received ?? '');
  if (!/^\d{6,14}$/.test(leadId ?? '') || !when) return null;
  const isPhone = (customer.match(/\d/g) ?? []).length >= 10;
  const c0 = norm(charge);
  return {
    leadId, name: isPhone ? null : customer.slice(0, 255) || null, phone: isPhone ? normalizePhone(customer.replace(/\s*ext\.?.*$/i, '')) : null,
    jobType: jobType.slice(0, 255), location: location.slice(0, 255), leadType: leadType.slice(0, 40),
    charge: c0 === 'charged' || c0 === 'credited' || c0 === 'not charged' ? c0 : 'unknown', day: when.day, receivedAt: when.at,
  };
}

/**
 * Reads the LSA lead export however it was copied: spreadsheet rows (tab separated, empty cells kept) or the web page copy where every cell
 * lands on its own line. Rows that cannot be read are counted, not guessed.
 */
export function parseLsaExport(text: string): { rows: LsaRow[]; skipped: number } {
  const lines = text.replace(/\r/g, '').split('\n');
  const head = lines.findIndex(l => /lead id/i.test(l));
  const body = head >= 0 ? lines.slice(head + 1) : lines;
  const found: LsaRow[] = [];
  let skipped = 0;
  if (body.some(l => l.split('\t').length >= 9)) {
    for (const l of body) {
      if (!l.trim()) continue;
      const row = toRow(l.split('\t'));
      if (row) found.push(row); else skipped++;
    }
  } else {
    let buf: string[] = [];
    for (const tok of body.map(l => l.trim()).filter(Boolean)) {
      if (/^\d{6,14}$/.test(tok)) {
        const row = buf.length === 8 ? toRow([...buf, tok]) : null;
        if (row) found.push(row); else skipped++;
        buf = [];
      } else buf.push(tok);
    }
    if (buf.length) skipped++;
  }
  const seen = new Set<string>();
  return { rows: found.filter(r => !seen.has(r.leadId) && seen.add(r.leadId)), skipped };
}

/** What importing would do to each row: new lead, tag an existing lead as LSA, nothing (already tagged) or nothing (imported before). */
export function planLsaImport(rows: LsaRow[], leads: LsaLead[]): LsaStep[] {
  const byPhone = new Map<string, LsaLead>();
  const byName = new Map<string, LsaLead[]>();
  for (const l of leads) {
    const p = normalizePhone(l.phone); if (p && !byPhone.has(p)) byPhone.set(p, l);
    const n = norm(l.name); if (n) byName.set(n, [...(byName.get(n) ?? []), l]);
  }
  return rows.map<LsaStep>(row => {
    const done = leads.find(l => (l.notes ?? '').includes(lsaMarker(row.leadId)));
    if (done) return { row, action: 'already', leadId: done.id };
    const nameHits = row.name ? byName.get(norm(row.name)) ?? [] : [];
    const hit = (row.phone ? byPhone.get(row.phone) : undefined) ?? (nameHits.length === 1 ? nameHits[0] : undefined);
    if (!hit) return { row, action: 'create' };
    return { row, action: norm(hit.source) === 'lsa' ? 'same' : 'tag', leadId: hit.id };
  });
}

export const lsaNote = (r: LsaRow) => `${lsaMarker(r.leadId)} - ${r.leadType || 'lead'} - ${r.charge === 'unknown' ? 'charge unknown' : r.charge} - ${r.day}`;

/** Per-month counts for the preview, and the charged leads still inside the dispute window (soonest deadline first). */
export function lsaSummary(steps: LsaStep[], today: string) {
  const months = new Map<string, { month: string; leads: number; charged: number; credited: number; notCharged: number }>();
  for (const { row } of steps) {
    const key = row.day.slice(0, 7);
    const m = months.get(key) ?? { month: key, leads: 0, charged: 0, credited: 0, notCharged: 0 };
    m.leads++; if (row.charge === 'charged') m.charged++; else if (row.charge === 'credited') m.credited++; else if (row.charge === 'not charged') m.notCharged++;
    months.set(key, m);
  }
  const t = Date.parse(`${today}T12:00:00Z`);
  const disputes = steps.map(s => s.row).filter(r => r.charge === 'charged').map(r => {
    const deadline = new Date(Date.parse(`${r.day}T12:00:00Z`) + DISPUTE_DAYS * 86_400_000).toISOString().slice(0, 10);
    return { row: r, deadline, daysLeft: Math.round((Date.parse(`${deadline}T12:00:00Z`) - t) / 86_400_000) };
  }).filter(d => d.daysLeft >= 0).sort((a, b) => a.daysLeft - b.daysLeft);
  return { months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)), disputes };
}
