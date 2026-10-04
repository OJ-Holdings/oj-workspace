// The rules the original Exterior Care app applies when a lead or booking is
// changed, kept identical here so both apps treat the shared records the same way.

export const leadStatuses = ['new', 'contacted', 'following_up', 'booked', 'completed', 'closed'] as const;
export type LeadStatus = typeof leadStatuses[number];
/*
 * Time blocks. A booking's time_block is text in the 12-hour style the original app used: '9-12' is 9 AM to
 * 12 PM, '12-3' is 12 to 3 PM, '4-6' is 4 to 6 PM. The workspace now books any start time and any length, so
 * minutes are allowed too: '4:30-9' is 4:30 to 9 PM, '8:15-9:45' is 8:15 to 9:45 AM. Hours 1 to 7 are PM and
 * 8 to 11 are AM (so a start is 8:00 AM to 7:59 PM), and the end is the next time after the start that
 * matches. Everything already stored stays valid.
 */
export const DAY_FIRST_START = 8 * 60;
export const DAY_LAST_START = 20 * 60 - 1;
export const DAY_LAST_END = 22 * 60;
export const MIN_JOB = 15;
export const MAX_JOB = 8 * 60;
/** Job lengths offered when booking, in minutes. */
export const jobLengths = [30, 60, 90, 120, 180, 240, 300, 360, 480] as const;
export const lengthLabel = (minutes: number) => minutes < 60 ? `${minutes} min` : minutes === 60 ? '1 hour' : `${minutes / 60} hours`;
/** Quick start times on the booking screen (any other time can be typed). */
export const quickStarts = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19].map(h => h * 60);

/** A block id as start and end in minutes after midnight (24-hour clock), or null when it is not a block. */
export function parseBlock(block: string | null | undefined): { start: number; end: number } | null {
  const m = /^(1[0-2]|[1-9])(?::([0-5]\d))?-(1[0-2]|[1-9])(?::([0-5]\d))?$/.exec(block ?? '');
  if (!m) return null;
  const a = Number(m[1]), b = Number(m[3]);
  const start = (a < 8 ? a + 12 : a) * 60 + Number(m[2] ?? 0);
  const end = [(b) * 60 + Number(m[4] ?? 0), (b + 12) * 60 + Number(m[4] ?? 0)].find(t => t > start);
  return end === undefined ? null : { start, end };
}
const side = (minutes: number) => { const h = Math.floor(minutes / 60), mm = minutes % 60; return `${h % 12 || 12}${mm ? `:${String(mm).padStart(2, '0')}` : ''}`; };
/** The block id for a job starting at `start` minutes (24-hour clock) and lasting `length` minutes. */
export const makeBlock = (start: number, length: number) => `${side(start)}-${side(start + length)}`;
/** A block the workspace will accept: starts 8:00 AM to 7:59 PM, ends by 10 PM, 15 minutes to 8 hours long. */
export const isValidBlock = (block: unknown): block is string => {
  const p = typeof block === 'string' ? parseBlock(block) : null;
  return !!p && p.start >= DAY_FIRST_START && p.start <= DAY_LAST_START && p.end <= DAY_LAST_END && p.end - p.start >= MIN_JOB && p.end - p.start <= MAX_JOB;
};
const part = (minutes: number) => minutes >= 12 * 60 ? 'PM' : 'AM';
/** '9-12' -> '9 AM to 12 PM', '12-3' -> '12 to 3 PM', '4:30-9' -> '4:30 to 9 PM'. */
export const blockLabel = (block: string | null) => {
  const p = parseBlock(block);
  if (!p) return block ?? '-';
  return part(p.start) === part(p.end) ? `${side(p.start)} to ${side(p.end)} ${part(p.end)}` : `${side(p.start)} ${part(p.start)} to ${side(p.end)} ${part(p.end)}`;
};
/** Just the start, for tight spaces: '4:30-9' -> '4:30 PM'. */
export const blockStartLabel = (block: string | null) => { const p = parseBlock(block); return p ? `${side(p.start)} ${part(p.start)}` : block ?? '-'; };
/** A clock time from minutes after midnight, for showing a start or end: 990 -> '4:30 PM'. */
export const clockLabel = (minutes: number) => `${side(minutes)} ${part(minutes)}`;
/** Do two blocks share any time? */
export const blocksOverlap = (a: string | null, b: string | null) => {
  const x = parseBlock(a), y = parseBlock(b);
  return x && y ? x.start < y.end && y.start < x.end : a === b;
};
export const services = ['House Washing', 'Roof Cleaning', 'Driveway Cleaning', 'Deck Cleaning', 'Gutter Cleaning', 'Window Cleaning', 'Pressure Washing', 'Full Service'];
export const leadSources = [['dtd', 'Door to door'], ['Facebook', 'Facebook'], ['Nextdoor', 'Nextdoor'], ['Referral', 'Referral'], ['phone', 'Phone'], ['website', 'Website'], ['other', 'Other']] as const;

/** Fields a person can edit. Once edited by hand, the sheet sync leaves that field alone. */
export const trackable = ['name', 'address', 'phone', 'service_requested', 'quote_amount', 'notes', 'status', 'source', 'job_cost', 'job_revenue'] as const;
export type LeadPatch = Partial<{ name: string; address: string | null; phone: string; service_requested: string | null; quote_amount: number | null; notes: string | null; status: LeadStatus; source: string | null; job_cost: number | null; job_revenue: number | null }>;
type Current = { status: string | null; quote_amount: number | null; job_revenue: number | null; completed_at: string | null; manually_updated_fields: unknown };

/** US numbers become +1XXXXXXXXXX; anything unreadable returns null. */
export function normalizePhone(raw: string | null | undefined) {
  const digits = (raw ?? '').replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  if (digits.length > 10 && digits.length <= 15) return `+${digits}`;
  return null;
}
export const isRealPhone = (phone: string | null | undefined) => Boolean(phone) && !phone!.startsWith('NP_') && !phone!.startsWith('NO_PHONE');

/**
 * What to write when a person edits a lead:
 * - marking it completed with no payment entered fills the payment from the quote;
 * - completed_at is stamped the first time it is completed, and again whenever a
 *   payment is entered on a completed job, so money lands in the month it was collected;
 * - every edited field is remembered so the sheet sync will not overwrite it.
 */
export function planLeadUpdate(current: Current, patch: LeadPatch, nowIso: string): Record<string, unknown> {
  const data: Record<string, unknown> = { ...patch };
  if (patch.status === 'completed' && patch.job_revenue === undefined && !(Number(current.job_revenue) > 0) && Number(current.quote_amount) > 0) data.job_revenue = current.quote_amount;
  const becoming = patch.status === 'completed', already = current.status === 'completed';
  const settingRevenue = data.job_revenue != null && Number(data.job_revenue) > 0;
  if ((becoming && !current.completed_at) || ((becoming || already) && settingRevenue)) data.completed_at = nowIso;
  const locked = Array.isArray(current.manually_updated_fields) ? current.manually_updated_fields.filter((f): f is string => typeof f === 'string') : [];
  const edited = Object.keys(data).filter(k => (trackable as readonly string[]).includes(k));
  return { ...data, manually_updated_fields: [...new Set([...locked, ...edited])], updated_at: nowIso };
}

/** A time block is taken when a confirmed or pending booking that day shares any of its time (an old 3-hour block holds all three hours). */
export const slotTaken = (bookings: { id: string; date: string; time_block: string | null; status: string | null }[], date: string, block: string, ignoreId?: string) =>
  bookings.some(b => b.id !== ignoreId && b.date === date && blocksOverlap(b.time_block, block) && (b.status === 'confirmed' || b.status === 'pending_approval'));

/** The settings the workspace may read and change, with how each is edited. */
export const settingKeys = ['businessName', 'ownerPhone', 'ownerEmail', 'address', 'timezone', 'googleSheetUrl', 'google_sheet_url', 'd2dSheetUrl', 'maxFollowUps', 'aiStyle', 'notifyOnBooking', 'notifyOnReply', 'dailySummary', 'monthlyRevenueGoal'] as const;
export type SettingKey = typeof settingKeys[number];
export const isSheetUrl = (url: string) => /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+/.test(url);
