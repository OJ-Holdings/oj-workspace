// The rules the original Exterior Care app applies when a lead or booking is
// changed, kept identical here so both apps treat the shared records the same way.

export const leadStatuses = ['new', 'contacted', 'following_up', 'booked', 'completed', 'closed'] as const;
export type LeadStatus = typeof leadStatuses[number];
export const timeBlocks = [['9-12', '9 AM to 12 PM', 'Morning'], ['12-3', '12 to 3 PM', 'Midday'], ['4-6', '4 to 6 PM', 'Afternoon']] as const;
export const blockLabel = (block: string | null) => timeBlocks.find(([id]) => id === block)?.[1] ?? block ?? '-';
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

/** A time block is taken when a confirmed or pending booking already holds it. */
export const slotTaken = (bookings: { id: string; date: string; time_block: string | null; status: string | null }[], date: string, block: string, ignoreId?: string) =>
  bookings.some(b => b.id !== ignoreId && b.date === date && b.time_block === block && (b.status === 'confirmed' || b.status === 'pending_approval'));

/** The settings the workspace may read and change, with how each is edited. */
export const settingKeys = ['businessName', 'ownerPhone', 'ownerEmail', 'address', 'timezone', 'googleSheetUrl', 'google_sheet_url', 'd2dSheetUrl', 'maxFollowUps', 'aiStyle', 'notifyOnBooking', 'notifyOnReply', 'dailySummary', 'monthlyRevenueGoal'] as const;
export type SettingKey = typeof settingKeys[number];
export const isSheetUrl = (url: string) => /^https:\/\/docs\.google\.com\/spreadsheets\/d\/[a-zA-Z0-9_-]+/.test(url);
