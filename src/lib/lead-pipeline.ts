// The Exterior Care lead pipeline: stages, the follow-up counter, and how
// Local Services Ads leads and their threads become workspace leads. Every rule
// is in PIPELINE below. Pure functions only: the lead screen, the live sync and
// the one-time scripts all use these same ones.

import { isRealPhone } from './exterior-ops';
import { lsaMarker } from './lsa-import';
import { confirms, extractLeadFields, findAddresses, findAmounts, findDates, findTown, serviceFor, serviceFromId, TOWNS, type Extractor } from './lead-extract';

export const PIPELINE = {
  timeZone: 'America/Chicago',
  stages: ['new', 'contacted', 'quoted', 'scheduled', 'won', 'lost', 'dead'],
  /** New and Contacted leads with no reply since our first contact: attempts on these days (day 0 = first contact), then Dead once the last goes unanswered this many days. */
  firstContact: { days: [0, 1, 3], deadAfterDays: 2 },
  /** Quoted leads: follow-ups on these days after the quote, then Dead once the last goes unanswered this many days. */
  quoted: { days: [1, 3, 7, 14], deadAfterDays: 3 },
  /** No follow-ups are counted or due at these stages. */
  noFollowUp: ['scheduled', 'won', 'lost'],
  /** Dead leads are archived, never deleted, and come back on the Spring Revival list on this date. */
  reviveOn: '2027-03-15',
  /** Backfill only: leads with no activity for this many days become Dead. */
  backfillQuietDays: 30,
  /** Needs Reply: the customer's last message or missed call is at most this many days old. Older ones wait for Spring Revival. */
  needsReplyDays: 14,
  /** Our messages within this many minutes of the last counted one are the same attempt. */
  attemptWindowMinutes: 60,
  /** Sheet archive: leads with a next follow-up from today to this many days ahead stay active. */
  keepActiveDays: 30,
  /** What the rest of the workspace (bookings, reports) sees as the lead's status. */
  legacyStatus: { new: 'new', contacted: 'contacted', quoted: 'following_up', scheduled: 'booked', won: 'booked', lost: 'closed', dead: 'closed' },
} as const;

export type Stage = typeof PIPELINE.stages[number];
export type ThreadEvent = { id: string; lsa: string; at: string; who: 'customer' | 'us' | 'other'; channel: string; text?: string; attachments?: string[]; seconds?: number; recording?: string };
export type Contact = { at: string; via: 'lsa' | 'manual' };
export type LsaMeta = {
  ids: string[]; origin: 'sync' | 'linked'; type: string | null; category: string | null; service: string | null; status: string | null; charged: boolean | null; credit: string | null; creditAt: string | null; locale: string | null; createdAt: string | null; note: string | null; feedback: boolean | null;
  /** Set on a duplicate the sheet archive merged away: the lead that now holds its LSA ids. It is never matched again. */
  mergedInto?: string | null;
  /** Set when someone tapped Keep separate: the leads this one must never be merged with. */
  separateFrom?: string[];
};
export type EngineLead = {
  id: string; name: string | null; phone: string | null; email: string | null; address: string | null; service_requested: string | null;
  quote_amount: number | null; status: string | null; source: string | null; notes: string | null; created_at: string; updated_at?: string | null;
  manually_updated_fields: unknown; lsa_lead_id: string | null; lsa: LsaMeta | null; proxy_phone: string | null;
  stage: Stage | null; stage_at: string | null; attempts: number; contact_log: Contact[]; thread: ThreadEvent[];
  cycle_at: string | null; last_customer_at: string | null; last_ours_at: string | null; quoted_at: string | null; scheduled_on: string | null;
  dead_reason: string | null; archived_at: string | null; revive_on: string | null; original_status: string | null; dispute: boolean; auto_fields: string[];
};
/** One lead as Google's API returns it, already flattened. */
export type LsaLead = { id: string; type: string | null; category: string | null; service: string | null; status: string | null; charged: boolean | null; credit: string | null; creditAt: string | null; locale: string | null; createdAt: string; name: string | null; phone: string | null; email: string | null; note: string | null; feedback: boolean | null };
type Patch = Record<string, unknown>;

export const ENGINE_COLUMNS = 'id,name,phone,email,address,service_requested,quote_amount,status,source,notes,created_at,updated_at,manually_updated_fields,lsa_lead_id,lsa,proxy_phone,stage,stage_at,attempts,contact_log,thread,cycle_at,last_customer_at,last_ours_at,quoted_at,scheduled_on,dead_reason,archived_at,revive_on,original_status,dispute,auto_fields';

/* ------------------------------ Time (America/Chicago) ------------------------------ */

const DAY = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const ms = (iso: string | null | undefined) => iso ? Date.parse(iso) : NaN;
const clock = new Intl.DateTimeFormat('en-US', { timeZone: PIPELINE.timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
function wall(at: number) {
  const p = Object.fromEntries(clock.formatToParts(new Date(at)).map(x => [x.type, x.value]));
  return { y: Number(p.year), m: Number(p.month), d: Number(p.day), h: Number(p.hour), mi: Number(p.minute), s: Number(p.second) };
}
export const chicagoDay = (at: string | number | Date) => { const p = wall(+new Date(at)); return `${p.y}-${pad(p.m)}-${pad(p.d)}`; };
export const chicagoHour = (at: string | number | Date) => wall(+new Date(at)).h;
/** "2026-11-02 14:05:00" in Chicago time: the form Google Ads queries take. */
export const chicagoStamp = (at: string | number | Date) => { const p = wall(+new Date(at)); return `${p.y}-${pad(p.m)}-${pad(p.d)} ${pad(p.h)}:${pad(p.mi)}:${pad(p.s)}`; };
export const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
/** A Google Ads date-time (Chicago wall time, or with an offset) as ISO. */
export function fromChicago(stamp: string | null | undefined): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?(\.\d+)?)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec((stamp ?? '').trim());
  if (!m) return null;
  if (m[8]) {
    const zone = m[8] === 'Z' ? 'Z' : `${m[8].slice(0, 3)}:${m[8].slice(-2)}`;
    const t = Date.parse(`${m[1]}-${m[2]}-${m[3]}T${m[4] ?? '00'}:${m[5] ?? '00'}:${m[6] ?? '00'}${m[7] ?? ''}${zone}`);
    return Number.isNaN(t) ? null : new Date(t).toISOString();
  }
  const local = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0), +(m[6] ?? 0), m[7] ? Math.round(parseFloat(m[7]) * 1000) : 0);
  const offset = (at: number) => { const p = wall(at); return Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s) - Math.floor(at / 1000) * 1000; };
  return new Date(local - offset(local - offset(local))).toISOString();
}
const shortDay = (iso: string) => new Date(iso).toLocaleDateString('en-US', { timeZone: PIPELINE.timeZone, month: 'short', day: 'numeric' });
/** "45m", "3h", "2d". */
export const ago = (iso: string | null, now: Date) => {
  if (!iso) return null;
  const minutes = Math.max(0, Math.floor((+now - ms(iso)) / 60_000));
  return minutes < 60 ? `${minutes}m` : minutes < 48 * 60 ? `${Math.floor(minutes / 60)}h` : `${Math.floor(minutes / 1440)}d`;
};

/* ------------------------------ Stages and the counter ------------------------------ */

const placeholderNames = new Set(['', 'unknown', 'unnamed customer', 'na', 'n/a', 'none']);
/** The name a new LSA lead gets until a real one is known: "LSA call Oct 22", "LSA msg Oct 22 Waukegan". */
export const placeholderName = /^LSA (call|msg|booking|lead) [A-Z][a-z]{2} \d{1,2}\b/;
const nameKey = (n: string | null | undefined) => (n ?? '').trim().replace(/\s+/g, ' ').toLowerCase();
export const hasName = (n: string | null | undefined) => !placeholderNames.has(nameKey(n)) && !placeholderName.test((n ?? '').trim());
/** A real US number as its 10 digits; placeholders and proxies give null. */
export const tenDigits = (p: string | null | undefined) => {
  if (!p || !isRealPhone(p)) return null;
  const d = p.replace(/\D/g, '');
  return d.length === 11 && d.startsWith('1') ? d.slice(1) : d.length === 10 ? d : null;
};
const placeholderText = /^(na|n\/a|none|unknown|tbd|-+|\?+)$/i;
/** Empty for filling: nothing, "n/a", "Unknown", or a phone that is not a real 10-digit number (NP_..., "na"). Anything else is a real value and is never overwritten. */
export function isBlank(field: string, value: unknown): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value !== 'string') return false;
  const v = value.trim();
  if (!v || placeholderText.test(v)) return true;
  return field === 'phone' ? !tenDigits(v) : field === 'name' ? !hasName(v) : false;
}
export const lockedFields = (l: { manually_updated_fields: unknown }) => Array.isArray(l.manually_updated_fields) ? l.manually_updated_fields.filter((f): f is string => typeof f === 'string') : [];

/** Leads from before the engine have no stage: read one from their status. */
export function stageFromStatus(status: string | null, quote: number | null): Stage {
  switch ((status ?? '').toLowerCase()) {
    case 'contacted': return 'contacted';
    case 'following_up': return quote ? 'quoted' : 'contacted';
    case 'booked': return 'scheduled';
    case 'completed': return 'won';
    case 'closed': return 'lost';
    case 'ghosted': return 'dead';
    default: return 'new';
  }
}
export const stageOf = (l: Pick<EngineLead, 'stage' | 'status' | 'quote_amount'>) => l.stage ?? stageFromStatus(l.status, l.quote_amount);
export const ruleFor = (stage: Stage) => stage === 'quoted' ? PIPELINE.quoted : stage === 'new' || stage === 'contacted' ? PIPELINE.firstContact : null;
export const maxAttempts = (l: EngineLead) => ruleFor(stageOf(l))?.days.length ?? null;
export const attemptsLabel = (l: EngineLead) => { const max = maxAttempts(l); return max === null ? null : `${Math.min(l.attempts, max)} of ${max}`; };
/** The customer wrote (or called) last and we have not answered, however long ago. */
const customerLast = (l: EngineLead) => Boolean(l.last_customer_at) && (!l.last_ours_at || ms(l.last_customer_at) > ms(l.last_ours_at));
/** Scheduled, Won and Lost: no follow-ups, and a call alone never makes them wait on us. */
const settled = (l: EngineLead) => (PIPELINE.noFollowUp as readonly Stage[]).includes(stageOf(l));
/**
 * When the customer's unanswered wait that counts last moved: their last message or call
 * after our last word; on a Scheduled, Won or Lost lead only a message counts. Null when
 * nothing waits.
 */
function waitingSince(l: EngineLead): string | null {
  if (!customerLast(l)) return null;
  if (!settled(l)) return l.last_customer_at;
  return l.thread.filter(e => e.who === 'customer' && e.channel !== 'PHONE_CALL' && (!l.last_ours_at || ms(e.at) > ms(l.last_ours_at))).map(e => e.at).sort((a, b) => ms(a) - ms(b)).at(-1) ?? null;
}
/**
 * Needs Reply: the customer wrote or called last, at most 14 days ago, and we have not
 * answered. A call never puts a Scheduled, Won or Lost lead here (only a message does).
 */
export function needsReply(l: EngineLead, now: Date): boolean {
  const since = l.archived_at ? null : waitingSince(l);
  return Boolean(since) && +now - ms(since) <= PIPELINE.needsReplyDays * DAY;
}
const cycleContacts = (l: EngineLead) => l.contact_log.filter(c => !l.cycle_at || ms(c.at) >= ms(l.cycle_at));

/** The day the next attempt is due, or null when nothing is owed (archived, waiting on our reply, no rule, or the attempts are used up). */
export function dueDay(l: EngineLead): string | null {
  if (l.archived_at || !l.stage || customerLast(l)) return null;
  const rule = ruleFor(l.stage);
  if (!rule || l.attempts >= rule.days.length) return null;
  const anchor = l.stage === 'quoted' ? (l.cycle_at ?? l.quoted_at ?? l.created_at)
    : l.attempts > 0 ? (cycleContacts(l)[0]?.at ?? l.cycle_at ?? l.created_at) : (l.cycle_at ?? l.created_at);
  return addDays(chicagoDay(anchor), rule.days[l.attempts]);
}
export function bucket(l: EngineLead, now: Date): 'reply' | 'today' | 'overdue' | null {
  if (needsReply(l, now)) return 'reply';
  const due = dueDay(l);
  if (!due) return null;
  const today = chicagoDay(now);
  return due < today ? 'overdue' : due === today ? 'today' : null;
}
/** Why a lead should now be Dead under the automatic rule, or null. */
export function autoDeadReason(l: EngineLead, now: Date): string | null {
  if (l.archived_at || !l.stage) return null;
  const rule = ruleFor(l.stage);
  if (!rule || l.attempts < rule.days.length) return null;
  const last = cycleContacts(l).at(-1)?.at ?? l.last_ours_at;
  if (!last || (l.last_customer_at && ms(l.last_customer_at) > ms(last))) return null;
  if (+now - ms(last) < rule.deadAfterDays * DAY) return null;
  return `No reply ${rule.deadAfterDays} days after attempt ${l.attempts} of ${rule.days.length} (${shortDay(last)})`;
}

/**
 * Moves a lead to a stage. An automatic move only rewrites the status the rest of
 * the workspace sees on leads the sync itself created (and never one set by hand);
 * on leads you entered, the engine's stage changes and your status stays.
 */
function stagePatch(l: EngineLead, stage: Stage, nowIso: string, automatic: boolean): Patch {
  const patch: Patch = { stage };
  // A lead from before the engine keeps the date its status was last set, so an old win never counts as this week's.
  if (stage !== l.stage) patch.stage_at = !l.stage && stage === stageOf(l) ? (l.updated_at ?? l.created_at) : nowIso;
  if (!automatic || (l.lsa?.origin === 'sync' && !lockedFields(l).includes('status'))) patch.status = PIPELINE.legacyStatus[stage];
  return patch;
}
export function deadPatch(l: EngineLead, reason: string, nowIso: string, automatic: boolean): Patch {
  return { ...stagePatch(l, 'dead', nowIso, automatic), dead_reason: reason.slice(0, 300), archived_at: nowIso, revive_on: PIPELINE.reviveOn };
}
const revivedStage = (l: EngineLead, stage: Stage): Stage => stage !== 'dead' ? stage : l.quoted_at ? 'quoted' : l.contact_log.length || l.last_ours_at ? 'contacted' : 'new';

/** The Contacted button: one attempt, logged now. Past the limit the lead goes Dead and says why. */
export function manualContact(l: EngineLead, nowIso: string): Patch {
  const stage = stageOf(l);
  const base: Patch = { last_ours_at: nowIso, contact_log: [...l.contact_log, { at: nowIso, via: 'manual' }] };
  const rule = ruleFor(stage);
  if (!rule) return base;
  const attempts = l.attempts + 1;
  if (attempts > rule.days.length) return { ...base, attempts, ...deadPatch(l, `Contacted past the limit: attempt ${attempts} of ${rule.days.length} on ${shortDay(nowIso)}`, nowIso, false) };
  return { ...base, attempts, cycle_at: l.stage ? l.cycle_at : nowIso, ...stagePatch(l, stage === 'new' ? 'contacted' : stage, nowIso, false) };
}
export type StageAction = 'quoted' | 'scheduled' | 'won' | 'lost' | 'dead' | 'unarchive';
/** The one-tap stage buttons. */
export function stageAction(l: EngineLead, action: StageAction, nowIso: string, value?: number | string): Patch {
  switch (action) {
    case 'quoted': return { ...stagePatch(l, 'quoted', nowIso, false), quote_amount: value, quoted_at: nowIso, cycle_at: nowIso, attempts: 0, archived_at: null, revive_on: null, dead_reason: null };
    case 'scheduled': return { ...stagePatch(l, 'scheduled', nowIso, false), scheduled_on: value, archived_at: null, revive_on: null, dead_reason: null };
    case 'won': case 'lost': return { ...stagePatch(l, action, nowIso, false), dead_reason: null };
    case 'dead': return deadPatch(l, `Marked Dead by hand on ${shortDay(nowIso)}`, nowIso, false);
    case 'unarchive': return { ...stagePatch(l, revivedStage(l, stageOf(l)), nowIso, false), archived_at: null, revive_on: null, dead_reason: null, attempts: stageOf(l) === 'dead' ? 0 : l.attempts, cycle_at: stageOf(l) === 'dead' ? nowIso : l.cycle_at };
  }
}

/** A customer call Google recorded with a duration: someone picked up, so it is a contact, not a wait. (Google gives no "connected" flag.) */
export const answeredCall = (e: ThreadEvent) => e.who === 'customer' && e.channel === 'PHONE_CALL' && (e.seconds ?? 0) > 0;

/**
 * Adds new thread events to a lead in time order. A customer message resets the
 * counter, clears Dead and any countdown, and puts the lead in Needs Reply. A new
 * message from us counts one attempt; messages within 60 minutes of the last counted
 * one are the same attempt; one past the limit makes the lead Dead. A customer call
 * that was answered is the customer reaching out and us answering at once: the
 * counter resets and the call counts as one attempt (New becomes Contacted).
 */
export function applyEvents(lead: EngineLead, incoming: ThreadEvent[]): Patch {
  const seen = new Set(lead.thread.map(e => e.id));
  const fresh = incoming.filter(e => !seen.has(e.id) && Boolean(seen.add(e.id))).sort((a, b) => ms(a.at) - ms(b.at));
  if (!fresh.length) return {};
  const l: EngineLead = { ...lead, contact_log: [...lead.contact_log] };
  let stage: Stage = stageOf(lead);
  // Set inside contact(): `as` keeps TypeScript from treating it as always null.
  let dead = null as { reason: string; at: string } | null;
  const lastContact = cycleContacts(lead).at(-1);
  let lastCounted = lastContact ? ms(lastContact.at) : null;
  const contact = (e: ThreadEvent) => {
    if (!l.last_ours_at || ms(e.at) > ms(l.last_ours_at)) l.last_ours_at = e.at;
    const rule = ruleFor(stage);
    if (!rule || dead) return;
    if (lastCounted !== null && Math.abs(ms(e.at) - lastCounted) < PIPELINE.attemptWindowMinutes * 60_000) return;
    if (stage === 'new') stage = 'contacted';
    l.attempts += 1; lastCounted = ms(e.at);
    l.contact_log.push({ at: e.at, via: 'lsa' });
    if (l.attempts > rule.days.length) { stage = 'dead'; dead = { reason: `Contacted again after ${rule.days.length} of ${rule.days.length} attempts (${shortDay(e.at)})`, at: e.at }; }
  };
  for (const e of fresh) {
    if (e.who === 'customer') {
      if (!l.last_customer_at || ms(e.at) > ms(l.last_customer_at)) l.last_customer_at = e.at;
      l.attempts = 0; l.cycle_at = e.at; lastCounted = null;
      // Only a message sent after the lead was archived brings it back (an old thread merged in later does not).
      const afterArchive = !l.archived_at || ms(e.at) > ms(l.archived_at);
      if ((stage === 'dead' || l.archived_at || dead) && afterArchive) { stage = revivedStage(l, stage); l.archived_at = null; l.revive_on = null; l.dead_reason = null; dead = null; }
      if (answeredCall(e)) contact(e);
    } else if (e.who === 'us') contact(e);
  }
  const patch: Patch = {
    thread: [...lead.thread, ...fresh].sort((a, b) => ms(a.at) - ms(b.at)).slice(-1000),
    attempts: l.attempts, contact_log: l.contact_log.slice(-200), cycle_at: l.cycle_at,
    last_customer_at: l.last_customer_at, last_ours_at: l.last_ours_at,
  };
  const at = fresh.at(-1)!.at;
  if (dead) Object.assign(patch, deadPatch(lead, dead.reason, dead.at, true));
  else {
    if (stage !== lead.stage) Object.assign(patch, stagePatch(lead, stage, at, true));
    if (lead.archived_at && !l.archived_at) Object.assign(patch, { archived_at: null, revive_on: null, dead_reason: null });
  }
  return patch;
}

/* ------------------------------ One-tap suggestions ------------------------------ */

export type Suggestion =
  | { kind: 'quoted'; amount: number; line: string; at: string }
  | { kind: 'scheduled'; day: string; line: string; ours: string; at: string };
const clip = (s: string, n = 140) => { const t = s.replace(/\s+/g, ' ').trim(); return t.length > n ? `${t.slice(0, n - 1)}…` : t; };
const takesBack = /\b(cancel|reschedule|can'?t make|cannot make|won'?t work|doesn'?t work|does not work|another day|different day)\b/i;

/**
 * Suggestions read from the conversation. They never change a lead by themselves:
 * each is a button that runs the normal Quoted or Scheduled action.
 * - Quote: the amounts in OUR latest message that names one (discounts, deposits and
 *   minimums skipped), for New, Contacted and Quoted leads, when the amount differs
 *   from the current quote and the message is newer than the last quote.
 * - Schedule: OUR latest message naming a day, then a later customer reply that says
 *   yes (and is not taken back). A date in the reply wins; several dates give one
 *   button each. Past dates and the date already set are skipped.
 */
export function suggestionsFor(l: EngineLead, now: Date): Suggestion[] {
  const out: Suggestion[] = [];
  const stage = stageOf(l);
  const thread = [...l.thread].sort((a, b) => ms(a.at) - ms(b.at));
  if (['new', 'contacted', 'quoted'].includes(stage)) {
    const ours = thread.filter(e => e.who === 'us' && e.text).map(e => ({ e, amounts: findAmounts(e.text!) })).filter(x => x.amounts.length).at(-1);
    if (ours && !(l.quoted_at && ms(ours.e.at) <= ms(l.quoted_at)))
      for (const a of ours.amounts) if (a.amount !== l.quote_amount) out.push({ kind: 'quoted', amount: a.amount, line: a.line, at: ours.e.at });
  }
  if (!['won', 'lost'].includes(stage)) {
    const today = chicagoDay(now);
    const offerAt = thread.reduce((found, e, i) => e.who === 'us' && e.text && findDates(e.text, chicagoDay(e.at)).length ? i : found, -1);
    if (offerAt >= 0) {
      const offer = thread[offerAt];
      const offered = findDates(offer.text!, chicagoDay(offer.at));
      const replies = thread.slice(offerAt + 1).filter(e => e.who === 'customer' && e.text);
      const yes = replies.findIndex(e => confirms(e.text!));
      if (yes >= 0 && !replies.slice(yes + 1).some(e => takesBack.test(e.text!))) {
        const reply = replies[yes], replyDay = chicagoDay(reply.at);
        // "Thursday works" sent on the Thursday itself reads as a week later: use the Thursday we offered.
        const named = findDates(reply.text!, replyDay).map(d => offered.find(o => o >= replyDay && addDays(o, 7) === d) ?? d);
        for (const day of named.length ? named : offered)
          if (day >= today && day !== l.scheduled_on) out.push({ kind: 'scheduled', day, line: clip(reply.text!), ours: clip(offer.text!), at: reply.at });
      }
    }
  }
  return out;
}

/* ------------------------------ LSA leads into workspace leads ------------------------------ */

/** Message leads show Google's proxy number with an extension: it is never the customer's real phone. */
export const isProxyPhone = (type: string | null, phone: string | null) => Boolean(phone) && (type === 'MESSAGE' || /ext|x\s*\d|[,;#*]/i.test(phone!) || phone!.replace(/\D/g, '').length > 11);
const realPhone = (lead: LsaLead) => {
  if (!lead.phone || isProxyPhone(lead.type, lead.phone)) return null;
  const d = lead.phone.replace(/\D/g, '');
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith('1') ? `+${d}` : null;
};
const metaOf = (lead: LsaLead, origin: LsaMeta['origin'], ids: string[]): LsaMeta => ({
  ids, origin, type: lead.type, category: lead.category, service: lead.service, status: lead.status, charged: lead.charged, credit: lead.credit,
  creditAt: lead.creditAt, locale: lead.locale, createdAt: lead.createdAt, note: lead.note, feedback: lead.feedback,
});
export const lsaIds = (l: Pick<EngineLead, 'lsa_lead_id' | 'lsa'>) => [...new Set([l.lsa_lead_id, ...(l.lsa?.ids ?? [])].filter((x): x is string => Boolean(x)))];
/** A readable name for a new LSA lead with none: "LSA call Oct 22", "LSA msg Oct 22 Waukegan". `placeholderName` matches it, so a real name replaces it later. */
export const nameFor = (lead: Pick<LsaLead, 'type' | 'createdAt'>, town: string | null) =>
  `LSA ${lead.type === 'PHONE_CALL' ? 'call' : lead.type === 'MESSAGE' ? 'msg' : lead.type === 'BOOKING' ? 'booking' : 'lead'} ${shortDay(lead.createdAt)}${town ? ` ${town}` : ''}`;
const byTime = <T extends { at: string }>(a: T, b: T) => ms(a.at) - ms(b.at);

/* ------------------------------ Is it the same customer? ------------------------------ */

// Names that belong to the same person. A single letter (an initial) fits any name it starts.
const nicknames = [
  'jennifer jenny jen jenn', 'patricia pat patty patti trish tricia', 'patrick pat paddy', 'robert rob bob bobby robbie', 'william will bill billy willy liam',
  'james jim jimmy jamie', 'john johnny jon jack', 'jonathan jon jonny', 'michael mike mikey mick', 'richard rich rick ricky dick', 'thomas tom tommy',
  'elizabeth liz lizzie beth betsy betty eliza', 'katherine catherine kathryn kate katie kathy cathy kat', 'margaret maggie meg peggy marge', 'christopher chris',
  'christine christina chris tina chrissy', 'daniel dan danny', 'danielle dani', 'david dave davey', 'joseph joe joey', 'anthony tony', 'steven stephen steve',
  'edward ed eddie ted', 'charles charlie chuck', 'nicholas nick nicky', 'matthew matt', 'andrew andy drew', 'benjamin ben benny', 'samuel sam sammy',
  'samantha sam sammy', 'alexander alex', 'alexandra alex lexi', 'jessica jess jessie', 'rebecca becky becca', 'deborah debra deb debbie', 'susan sue susie suzanne',
  'kimberly kim', 'joshua josh', 'zachary zach zack', 'timothy tim timmy', 'kenneth ken kenny', 'ronald ron ronnie', 'donald don donnie', 'gregory greg',
  'jeffrey geoffrey jeff', 'raymond ray', 'gerald jerry', 'lawrence larry', 'douglas doug', 'frederick fred freddie', 'theodore ted teddy theo', 'victoria vicky tori',
  'abigail abby', 'amanda mandy', 'cynthia cindy', 'pamela pam', 'barbara barb', 'judith judy', 'sandra sandy', 'melissa missy mel', 'jacqueline jackie',
  'valerie val', 'philip phillip phil', 'peter pete', 'walter walt', 'nathan nathaniel nate', 'mitchell mitch', 'leonard len lenny leo', 'vincent vince',
  'harold hal harry', 'henry hank harry', 'albert al bert', 'allen alan al', 'beverly bev', 'carolyn caroline carol', 'allison alison ali allie', 'natalie nat',
  'gabriel gabe', 'isabella isabel bella izzy', 'jacob jake', 'nicole nikki', 'angela angie', 'stephanie steph', 'kristen kristin kris', 'teresa theresa terri terry',
  'terrance terrence terry', 'russell russ', 'francis frank fran frankie', 'mary molly mae', 'dorothy dot dottie', 'eugene gene', 'stanley stan',
];
const nickGroups = new Map<string, number[]>();
nicknames.forEach((group, i) => { for (const n of group.split(' ')) nickGroups.set(n, [...(nickGroups.get(n) ?? []), i]); });
/** Same first name: equal, nicknames of one name (Jenny = Jennifer, Pat = Patricia or Patrick), or an initial that fits. */
export const sameFirstName = (a: string, b: string) => a === b
  || (a.length === 1 || b.length === 1 ? a[0] === b[0] : (nickGroups.get(a) ?? []).some(g => (nickGroups.get(b) ?? []).includes(g)));
const titles = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'jr', 'sr', 'ii', 'iii', 'iv']);
/** A person's name as lowercase words; null for placeholders and things that are not a name ("June 3rd blue house"). */
export function nameParts(name: string | null | undefined) {
  if (!hasName(name) || /\d/.test(name!)) return null;
  const words = name!.toLowerCase().replace(/[.,&/]/g, ' ').replace(/[^a-z'\s-]/g, '').split(/\s+/).map(w => w.replace(/^['-]+|['-]+$/g, '')).filter(w => w && !titles.has(w));
  if (!words.length || words.length > 4) return null;
  return { first: words[0], last: words.length > 1 ? words.at(-1)! : null, words };
}

const streetSuffixes: Record<string, string> = { st: 'st', street: 'st', ave: 'ave', av: 'ave', avenue: 'ave', rd: 'rd', road: 'rd', dr: 'dr', drive: 'dr', ln: 'ln', lane: 'ln', ct: 'ct', court: 'ct', cir: 'cir', circle: 'cir', blvd: 'blvd', boulevard: 'blvd', way: 'way', pl: 'pl', place: 'pl', pkwy: 'pkwy', parkway: 'pkwy', ter: 'ter', terrace: 'ter', trl: 'trl', trail: 'trl', hwy: 'hwy', highway: 'hwy' };
const compass: Record<string, string> = { north: 'n', south: 's', east: 'e', west: 'w' };
const townWords = TOWNS.map(t => t.toLowerCase().split(' '));
const unitWords = /\b(?:apt|apartment|unit|ste|suite|lot|bldg|building|rm|room)\b\.?\s*#?\s*([a-z0-9-]+)|#\s*([a-z0-9-]+)/;
export type StreetParts = { key: string; suffix: string | null; unit: string | null };
/**
 * The street of an address, for comparing two addresses: the house number and street
 * name from the first comma part (ordinals 22nd -> 22, north -> n, grid numbers joined:
 * S94 W23640 -> s94w23640), stopping at the suffix, WI/IL, a ZIP or a town; plus the
 * suffix (Street -> st) and any unit, kept apart. "4521 22nd Ave., Apt 2, Kenosha WI" ->
 * { key "4521 22", suffix "ave", unit "2" }. Null without a house number and a street name.
 */
export function streetParts(address: string | null | undefined): StreetParts | null {
  const lower = (address ?? '').toLowerCase().split(/[,\n;]/)[0];
  const unit = unitWords.exec(lower);
  const first = lower.replace(new RegExp(unitWords.source, 'g'), ' ')
    .replace(/\b([nsew])\s?(\d{1,4})\s?([nsew])\s?(\d{2,6})\b/g, '$1$2$3$4')
    .replace(/\b(\d+)(st|nd|rd|th)\b/g, '$1')
    .replace(/[^a-z0-9\s]/g, ' ');
  const words = first.split(/\s+/).filter(Boolean);
  if (!words.length || !/^(\d+[a-z]?|[nsew]\d+[nsew]\d+)$/.test(words[0])) return null;
  const out = [words[0]];
  let suffix: string | null = null;
  for (let i = 1; i < words.length; i++) {
    const w = words[i];
    if (out.length >= 2 && streetSuffixes[w]) { suffix = streetSuffixes[w]; break; }
    if (out.length >= 2 && (/^(wi|il|wisconsin|illinois|\d{5})$/.test(w) || townWords.some(t => t.every((p, j) => words[i + j] === p)))) break;
    out.push(compass[w] ?? w);
  }
  if (!out.some((w, i) => i > 0 && !/^[nsew]$/.test(w))) return null;
  return { key: out.join(' '), suffix, unit: unit ? unit[1] ?? unit[2] : null };
}
export const streetKey = (address: string | null | undefined) => streetParts(address)?.key ?? null;
/**
 * The same place: the same number and street name, and no different suffix (22nd Ave is
 * not 22nd St) or unit (Apt 2 is not Apt 3). Without a suffix on either side, one may run
 * on into a town the list does not know ("1234 derby line" and "1234 derby line grayslake").
 */
export function sameStreet(a: StreetParts, b: StreetParts) {
  if ((a.suffix && b.suffix && a.suffix !== b.suffix) || (a.unit && b.unit && a.unit !== b.unit)) return false;
  if (a.key === b.key) return true;
  const [s, l] = a.key.length <= b.key.length ? [a.key, b.key] : [b.key, a.key];
  return !a.suffix && !b.suffix && l.startsWith(`${s} `);
}

/**
 * What is known about the person behind an LSA lead. Phones are 10 digits from the call
 * record or the customer's own message, never the proxy. `addresses` holds every address
 * the customer wrote (`address` is the first, kept for callers with only one).
 */
export type Probe = { lsaId?: string; name: string | null; phones: string[]; email: string | null; address: string | null; addresses?: string[]; town: string | null };
export type Candidate = { id: string; name: string | null; phone: string | null; address: string | null; why: string };
export type Match = { kind: 'link'; lead: EngineLead; why: string } | { kind: 'review'; candidates: Candidate[]; why: string } | { kind: 'new'; why: string };

const freeMail = new Set(['gmail', 'googlemail', 'yahoo', 'ymail', 'hotmail', 'outlook', 'aol', 'icloud', 'live', 'msn', 'comcast', 'att', 'sbcglobal', 'charter', 'me', 'mac', 'protonmail', 'proton', 'gmx', 'mail', 'verizon', 'rr', 'cox', 'frontier', 'earthlink', 'bellsouth']);
const companyWords = new Set(['company', 'co', 'inc', 'incorporated', 'llc', 'corp', 'corporation', 'ltd', 'the', 'and', 'of']);
/**
 * A work email whose domain is the lead's company name: "jo@acmeroller.com" and
 * "Acme Roller Company" (spaces, punctuation and company/co/inc/llc ignored; one key
 * starts the other, at least 5 letters). Only for business names, never a person's
 * name, and free-mail domains never count.
 */
export function emailFitsName(email: string | null | undefined, name: string | null | undefined): boolean {
  const labels = /@([a-z0-9.-]+)$/.exec((email ?? '').trim().toLowerCase())?.[1].split('.').filter(Boolean) ?? [];
  const domain = labels.length >= 2 ? labels.at(-2)!.replace(/[^a-z0-9]/g, '') : '';
  if (domain.length < 5 || freeMail.has(domain) || !hasName(name)) return false;
  // Only a business name: a company word, more than two words, or not a person's name at all. "Pat Doe" never matches a domain.
  const words = (name ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!(words.some(w => companyWords.has(w) && !['the', 'and', 'of'].includes(w)) || words.length > 2 || !nameParts(name))) return false;
  const company = words.filter(w => !companyWords.has(w)).join('');
  return company.length >= 5 && (company.startsWith(domain) || domain.startsWith(company));
}

function evidence(p: Probe, l: EngineLead) {
  const strong: string[] = [], weak: string[] = [], conflict: string[] = [];
  if (p.lsaId && !l.lsa_lead_id && new RegExp(`${lsaMarker(p.lsaId)}(\\D|$)`).test(l.notes ?? '')) strong.push('its notes name this LSA lead');
  const phone = tenDigits(l.phone);
  if (phone && p.phones.includes(phone)) strong.push('same phone');
  else if (phone && p.phones.length) conflict.push('a different phone');
  if (p.email && l.email && p.email.trim().toLowerCase() === l.email.trim().toLowerCase()) strong.push('same email');
  // Any one of the customer's addresses on the lead's street is a match; a conflict only when none is.
  const ps = [...new Set([...(p.addresses ?? []), p.address].filter((a): a is string => Boolean(a)))].map(streetParts).filter((s): s is StreetParts => Boolean(s));
  const ls = streetParts(l.address);
  if (ps.length && ls) { if (ps.some(s => sameStreet(s, ls))) strong.push('same street address'); else conflict.push('a different street address'); }
  const lt = findTown(l.address);
  if (p.town && lt && p.town !== lt) conflict.push(`a different town (${lt})`);
  // A work email at the lead's company: the person works there, so a different person's name is no conflict.
  const domainFits = emailFitsName(p.email, l.name);
  if (domainFits) strong.push('email domain matches the company name');
  const pn = nameParts(p.name), ln = nameParts(l.name);
  const nameFits = domainFits || Boolean(pn && ln && sameFirstName(pn.first, ln.first));
  if (pn && ln && !domainFits) {
    const first = nameFits;
    if (pn.words.length > 1 && pn.words.join(' ') === ln.words.join(' ')) strong.push('same full name');
    else if (pn.last && ln.last) { if (pn.last === ln.last && first) weak.push('same last name, first name fits'); else conflict.push('a different name'); }
    else if (!first) conflict.push('a different name');
    else if (p.town && p.town === lt) weak.push(`same first name in ${lt}`);
  }
  return { strong, weak, conflict, nameFits };
}

/** Why one lead does or does not match a probe: the strong, weak and conflicting evidence (the dry run shows it). */
export const explainMatch = (p: Probe, l: EngineLead) => evidence(p, l);

/** What an LSA lead and its customer's own messages say about who it is: the matcher's input. */
export function probeFor(lead: LsaLead, events: ThreadEvent[], extract: Extractor = extractLeadFields): Probe {
  const texts = events.filter(e => e.lsa === lead.id && e.who === 'customer' && e.text).sort(byTime).map(e => e.text!);
  const found = extract({ messages: texts }).fields;
  const phones = [...new Set([tenDigits(realPhone(lead)), tenDigits(found.phone)].filter((p): p is string => Boolean(p)))];
  const address = found.address ?? null;
  const addresses = [...new Set(texts.flatMap(t => findAddresses(t).map(a => a.value)))];
  return { lsaId: lead.id, name: hasName(lead.name) ? lead.name : found.name ?? null, phones, email: lead.email ?? found.email ?? null, address, addresses, town: findTown(address) ?? findTown(texts.join('\n')) };
}

/**
 * Finds the workspace lead an LSA lead belongs to.
 * - Strong evidence: the "LSA lead #id" note, the same street, the same 10-digit phone,
 *   the same email, or the exact full name (two words or more).
 * - Weak evidence: the same last name with a fitting first name (Jenny = Jennifer, J = John),
 *   or the same first name in the same town.
 * Link only when strong evidence points at exactly one lead and nothing conflicts
 * (a different real phone, street, town, or a clearly different name). Anything less
 * certain is a review for a person to decide. Leads merged away are never matched.
 */
export function matchLead(p: Probe, pool: EngineLead[]): Match {
  const scored = pool.filter(l => !l.lsa?.mergedInto).map(l => ({ l, ...evidence(p, l) }));
  type Scored = typeof scored[number];
  const said = (s: Scored) => [...s.strong, ...s.weak].join(', ') + (s.conflict.length ? `, but ${s.conflict.join(' and ')}` : '');
  const candidate = (s: Scored): Candidate => ({ id: s.l.id, name: s.l.name, phone: tenDigits(s.l.phone), address: s.l.address, why: said(s) });
  const strong = scored.filter(s => s.strong.length);
  // The street alone is not enough (a household, a duplex, a family member): the name must fit too.
  const streetOnly = (s: Scored) => s.strong.length === 1 && s.strong[0] === 'same street address' && !s.nameFits;
  if (strong.length === 1 && !strong[0].conflict.length && !streetOnly(strong[0])) return { kind: 'link', lead: strong[0].l, why: strong[0].strong.join(' + ') };
  if (strong.length === 1 && !strong[0].conflict.length) return { kind: 'review', candidates: strong.map(candidate), why: `${strong[0].l.name ?? 'no name'}: same street address, but no name, phone or email to confirm it is the same person` };
  if (strong.length > 1) return { kind: 'review', candidates: strong.map(candidate), why: `${strong.length} leads match: ${strong.map(s => `${s.l.name ?? 'no name'} (${said(s)})`).join('; ')}` };
  if (strong.length) return { kind: 'review', candidates: strong.map(candidate), why: `${strong[0].l.name ?? 'no name'}: ${said(strong[0])}` };
  const weak = scored.filter(s => s.weak.length && !s.conflict.length);
  if (weak.length > 5) return { kind: 'new', why: `${weak.length} leads share only a first name or nickname: too many to ask about` };
  if (weak.length) return { kind: 'review', candidates: weak.map(candidate), why: weak.map(s => `${s.l.name ?? 'no name'} (${said(s)})`).join('; ') };
  return { kind: 'new', why: 'no lead with the same phone, street, email or name' };
}

/* ------------------------------ Planning a batch ------------------------------ */

export type ReviewStatus = 'pending' | 'merge' | 'separate' | 'done';
/** An LSA lead that might be someone already here: held, not added, until someone taps Merge or Keep separate. */
export type LeadReview = { id?: string; lsa_lead_id: string; lead: LsaLead; thread: ThreadEvent[]; candidates: Candidate[]; reason: string | null; status: ReviewStatus; merge_into: string | null };
export type MatchReport = { lsaId: string; name: string | null; kind: 'known' | 'link' | 'override' | 'review' | 'new' | 'merged' | 'separate'; targets: { id: string; name: string | null }[]; why: string };
/** A link decided by a person before the backfill (lsa-overrides.json): this LSA lead belongs to that workspace lead. Backfill only. */
export type LinkOverride = { lsa_lead_id: string; lead_id: string; why: string };
export type IngestPlan = {
  inserts: Patch[]; updates: { id: string; patch: Patch }[]; created: number; linked: number; events: number; orphanEvents: number;
  /** Reviews to save: new ones and pending ones with news. `was` is the status read, so a decision made meanwhile is never overwritten. */
  reviews: (LeadReview & { was?: ReviewStatus })[];
  /** Decided reviews this plan carries out: marked done once the plan is written. */
  resolved: { lsa_lead_id: string; was: ReviewStatus }[];
  /** What happened to each LSA lead and why (for the dry run). */
  matches: MatchReport[];
};

/**
 * Plans how a batch of LSA leads and thread events lands in the workspace. One
 * workspace lead per LSA lead id: a lead already holding the id is updated; else
 * matchLead decides: link to the one lead it surely is (filling only empty fields,
 * never status, quote, dates, notes or anything typed by hand), hold it as a review
 * when unsure, or add a new lead. A pending review collects its messages until it is
 * decided; a decided review comes back in with the lead and thread it stored.
 * Customer messages then fill empty fields that were never edited by hand, tagged
 * "auto". A new lead with no name is called "LSA call Oct 22" / "LSA msg Oct 22 Waukegan"
 * until a real name replaces it. With `backfill`, leads the sync created whose customer
 * wrote last more than 14 days ago go to Spring Revival (archived), and the rest that
 * have been quiet for 30 days go Dead. `overrides` (backfill only) force a link to the
 * lead a person chose, with the same fill-empty-only rules, before any matching.
 */
export function planIngest(existing: EngineLead[], leads: LsaLead[], events: ThreadEvent[], nowIso: string, opts: { backfill?: boolean; extract?: Extractor; reviews?: LeadReview[]; overrides?: LinkOverride[] } = {}): IngestPlan {
  const extract = opts.extract ?? extractLeadFields;
  const work = new Map<string, { lead: EngineLead; patch: Patch; insert: boolean }>();
  const byLsa = new Map<string, string>();
  for (const l of existing) for (const id of lsaIds(l)) byLsa.set(id, l.id);
  const current = (id: string) => { const w = work.get(id); return w ? { ...w.lead, ...w.patch } as EngineLead : existing.find(l => l.id === id)!; };
  const touch = (id: string, patch: Patch) => {
    const w = work.get(id) ?? { lead: existing.find(l => l.id === id)!, patch: {}, insert: false };
    Object.assign(w.patch, patch); work.set(id, w);
  };
  let created = 0, linked = 0;
  const matches: MatchReport[] = [];
  const resolved: IngestPlan['resolved'] = [];
  const reviews = new Map((opts.reviews ?? []).filter(r => r.status !== 'done').map(r => [r.lsa_lead_id, r]));
  const held = new Map<string, LeadReview & { was?: ReviewStatus }>();
  const justLinked = new Set<string>();
  const overrideFor = new Map((opts.overrides ?? []).map(o => [o.lsa_lead_id, o]));

  // Decided reviews (and pending ones a person settled in the overrides file) come back in with the lead and thread they stored (a fresher copy from Google wins).
  const batch = new Map(leads.map(l => [l.id, l]));
  const allEvents = [...events];
  for (const r of reviews.values()) {
    if (r.status === 'pending' && !overrideFor.has(r.lsa_lead_id)) continue;
    if (byLsa.has(r.lsa_lead_id)) { resolved.push({ lsa_lead_id: r.lsa_lead_id, was: r.status }); continue; }
    if (!batch.has(r.lsa_lead_id)) batch.set(r.lsa_lead_id, r.lead);
    allEvents.push(...r.thread);
  }
  const eventsBy = new Map<string, ThreadEvent[]>();
  for (const e of allEvents) eventsBy.set(e.lsa, [...(eventsBy.get(e.lsa) ?? []), e]);
  const customerTexts = (id: string) => (eventsBy.get(id) ?? []).filter(e => e.who === 'customer' && e.text).sort(byTime).map(e => e.text!);
  const pool = () => [...existing.map(l => current(l.id)), ...[...work.values()].filter(w => w.insert).map(w => ({ ...w.lead, ...w.patch }) as EngineLead)];

  const create = (lead: LsaLead, extra: Partial<LsaMeta> = {}) => {
    const id = `new:${lead.id}`, proxy = isProxyPhone(lead.type, lead.phone) ? lead.phone : null;
    const texts = customerTexts(lead.id);
    const row: EngineLead = {
      id, name: hasName(lead.name) ? lead.name : nameFor(lead, findTown(extract({ messages: texts }).fields.address) ?? findTown(texts.join('\n'))),
      phone: realPhone(lead) ?? `NP_LSA_${lead.id}`, email: lead.email, address: null,
      service_requested: serviceFromId(lead.service), quote_amount: null, status: 'new', source: 'lsa',
      notes: `${lsaMarker(lead.id)} - ${(lead.type ?? 'lead').toLowerCase().replace(/_/g, ' ')}`, created_at: lead.createdAt, updated_at: nowIso,
      manually_updated_fields: [], lsa_lead_id: lead.id, lsa: { ...metaOf(lead, 'sync', [lead.id]), ...extra }, proxy_phone: proxy,
      stage: lead.status === 'BOOKED' ? 'scheduled' : 'new', stage_at: lead.createdAt, attempts: 0, contact_log: [], thread: [],
      cycle_at: lead.createdAt, last_customer_at: null, last_ours_at: null, quoted_at: null, scheduled_on: null,
      dead_reason: null, archived_at: null, revive_on: null, original_status: null, dispute: false, auto_fields: [],
    };
    if (row.stage === 'scheduled') row.status = PIPELINE.legacyStatus.scheduled;
    work.set(id, { lead: row, patch: {}, insert: true });
    byLsa.set(lead.id, id);
    created++;
  };
  const link = (targetId: string, lead: LsaLead) => {
    const l = current(targetId), locked = lockedFields(l), phone = realPhone(lead);
    const ids = [...new Set([...lsaIds(l), lead.id])];
    const patch: Patch = { lsa: { ...metaOf(lead, l.lsa?.origin ?? 'linked', ids), ...(l.lsa?.separateFrom ? { separateFrom: l.lsa.separateFrom } : {}) } };
    if (!l.lsa_lead_id) patch.lsa_lead_id = lead.id;
    if (isProxyPhone(lead.type, lead.phone) && !l.proxy_phone) patch.proxy_phone = lead.phone;
    if (phone && isBlank('phone', l.phone) && !locked.includes('phone')) patch.phone = phone;
    if (lead.email && isBlank('email', l.email) && !locked.includes('email')) patch.email = lead.email;
    if (hasName(lead.name) && isBlank('name', l.name) && !locked.includes('name')) patch.name = lead.name;
    if (isBlank('service_requested', l.service_requested) && !locked.includes('service_requested')) { const s = serviceFromId(lead.service); if (s) patch.service_requested = s; }
    if (!l.stage) Object.assign(patch, { stage: stageOf(l), stage_at: l.updated_at ?? l.created_at, cycle_at: l.cycle_at ?? lead.createdAt });
    touch(targetId, patch);
    byLsa.set(lead.id, targetId);
    justLinked.add(targetId);
    linked++;
  };
  const report = (lead: LsaLead, kind: MatchReport['kind'], targets: { id: string; name: string | null }[], why: string) => matches.push({ lsaId: lead.id, name: lead.name, kind, targets, why });

  for (const lead of [...batch.values()].sort((a, b) => ms(a.createdAt) - ms(b.createdAt))) {
    const known = byLsa.get(lead.id);
    if (known) {
      const l = current(known);
      const meta = { ...metaOf(lead, l.lsa?.origin ?? 'linked', lsaIds(l).length ? lsaIds(l) : [lead.id]), ...(l.lsa?.separateFrom ? { separateFrom: l.lsa.separateFrom } : {}) };
      const patch: Patch = { lsa: meta };
      if (lead.status === 'BOOKED' && l.lsa?.status !== 'BOOKED' && ['new', 'contacted', 'quoted'].includes(stageOf(l))) Object.assign(patch, stagePatch(l, 'scheduled', nowIso, true));
      // A name Google gives later replaces an empty or "LSA msg Oct 22" name (never one typed by hand).
      if (hasName(lead.name) && isBlank('name', l.name) && !lockedFields(l).includes('name')) patch.name = lead.name;
      touch(known, patch);
      report(lead, 'known', [{ id: known, name: l.name }], 'already holds this LSA lead');
      continue;
    }
    const review = reviews.get(lead.id);
    const forced = overrideFor.get(lead.id);
    let overrideMissed = '';
    if (forced) {
      // The chosen lead, or the lead it was merged into since.
      let target = existing.find(l => l.id === forced.lead_id);
      for (let hop = 0; target?.lsa?.mergedInto && hop < 5; hop++) { const next: string = target.lsa.mergedInto; target = existing.find(l => l.id === next); }
      if (target) {
        if (review) resolved.push({ lsa_lead_id: lead.id, was: review.status });
        link(target.id, lead); report(lead, 'override', [{ id: target.id, name: target.name }], `set by hand in the overrides file: ${forced.why}`);
        continue;
      }
      overrideMissed = ` (the overrides file names lead ${forced.lead_id}, which is not here, so it was matched as usual)`;
    }
    if (review?.status === 'pending') {
      held.set(lead.id, { ...review, lead, was: review.status });
      report(lead, 'review', review.candidates.map(c => ({ id: c.id, name: c.name })), review.reason ?? 'waiting for Merge or Keep separate');
      continue;
    }
    if (review) {
      if (review.status === 'merge') {
        // A lead merged away since points at the lead that holds it now.
        let target = review.merge_into ? existing.find(l => l.id === review.merge_into) : undefined;
        for (let hop = 0; target?.lsa?.mergedInto && hop < 5; hop++) { const next: string = target.lsa.mergedInto; target = existing.find(l => l.id === next); }
        if (!target) {
          held.set(lead.id, { ...review, lead, status: 'pending', merge_into: null, was: 'merge', reason: `The lead chosen for Merge is gone: choose again. ${review.reason ?? ''}`.slice(0, 500) });
          report(lead, 'review', review.candidates.map(c => ({ id: c.id, name: c.name })), 'Merge was tapped but that lead is gone: asking again');
          continue;
        }
        resolved.push({ lsa_lead_id: lead.id, was: review.status });
        link(target.id, lead); report(lead, 'merged', [{ id: target.id, name: target.name }], 'Merge was tapped');
      } else {
        resolved.push({ lsa_lead_id: lead.id, was: review.status });
        create(lead, { separateFrom: review.candidates.map(c => c.id) }); report(lead, 'separate', [], 'Keep separate was tapped');
      }
      continue;
    }
    let m = matchLead(probeFor(lead, eventsBy.get(lead.id) ?? [], extract), pool());
    if (m.kind === 'review') {
      // Leads added in this same run have no id yet, so nobody can be asked about them.
      const real = m.candidates.filter(c => !c.id.startsWith('new:'));
      m = real.length ? { ...m, candidates: real } : { kind: 'new', why: `${m.why} (only a lead added in this same run, so it is added as new)` };
    }
    if (overrideMissed) m = { ...m, why: m.why + overrideMissed };
    if (m.kind === 'link') { link(m.lead.id, lead); report(lead, 'link', [{ id: m.lead.id, name: m.lead.name }], m.why); }
    else if (m.kind === 'review') {
      held.set(lead.id, { lsa_lead_id: lead.id, lead, thread: [], candidates: m.candidates, reason: m.why.slice(0, 500), status: 'pending', merge_into: null });
      report(lead, 'review', m.candidates.map(c => ({ id: c.id, name: c.name })), m.why);
    } else { create(lead); report(lead, 'new', [], m.why); }
  }

  // Thread events, grouped onto the lead that holds their LSA lead id; a held lead keeps them in its review.
  let orphanEvents = 0;
  const grouped = new Map<string, ThreadEvent[]>();
  for (const e of allEvents) {
    const id = byLsa.get(e.lsa);
    if (id) { grouped.set(id, [...(grouped.get(id) ?? []), e]); continue; }
    const stored = reviews.get(e.lsa);
    const r = held.get(e.lsa) ?? (stored?.status === 'pending' ? { ...stored, was: stored.status } : undefined);
    if (!r) { orphanEvents++; continue; }
    if (!r.thread.some(x => x.id === e.id)) { r.thread = [...r.thread, e].sort(byTime); held.set(e.lsa, r); }
  }
  for (const [id, list] of grouped) {
    const patch = applyEvents(current(id), list);
    // A thread just linked onto a lead someone entered is history: it shows and says who wrote last,
    // but its old messages from us neither count as follow-up attempts nor make the lead Dead.
    if (justLinked.has(id) && current(id).lsa?.origin !== 'sync') {
      for (const k of ['attempts', 'contact_log', 'cycle_at']) delete patch[k];
      if (patch.stage === 'dead') for (const k of ['stage', 'stage_at', 'status', 'dead_reason', 'archived_at', 'revive_on']) delete patch[k];
    }
    if (Object.keys(patch).length) touch(id, patch);
  }

  // Fill empty fields from what the customer wrote (and the service from Google's category when nothing better is known).
  for (const [id] of work) {
    const l = current(id), locked = lockedFields(l);
    const messages = l.thread.filter(e => e.who === 'customer' && e.text).map(e => e.text!);
    const found = extract({ messages }).fields;
    const fill: Patch = {};
    const empty = (field: string, value: unknown) => !locked.includes(field) && isBlank(field, value);
    if (found.address && empty('address', l.address)) fill.address = found.address;
    if (found.phone && empty('phone', l.phone)) fill.phone = found.phone;
    if (found.email && empty('email', l.email)) fill.email = found.email;
    if (found.name && empty('name', l.name)) fill.name = found.name;
    // Service: Google's service id, then the customer's words, then the category; a call with no id is Unknown.
    // Unknown is only written on leads the sync created; a lead you entered keeps its empty service.
    const svc = serviceFor({ serviceId: l.lsa?.service, category: l.lsa?.category, type: l.lsa?.type, messages });
    if (empty('service_requested', l.service_requested) && svc.service !== l.service_requested && (svc.from !== 'none' || l.lsa?.origin === 'sync')) fill.service_requested = svc.service;
    const guessed = Object.keys(fill).filter(k => k !== 'service_requested' || svc.from === 'message' || svc.from === 'category');
    if (Object.keys(fill).length) touch(id, { ...fill, ...(guessed.length ? { auto_fields: [...new Set([...(l.auto_fields ?? []), ...guessed])] } : {}) });
  }

  if (opts.backfill) {
    for (const [id] of work) {
      const l = current(id);
      if (l.lsa?.origin !== 'sync' || l.stage === 'dead' || l.archived_at) continue;
      // The customer wrote last and nobody answered for more than 14 days: Spring Revival, not Dead (they were waiting on us).
      // A Scheduled lead is a booked job: it stays active, and quiet never makes it (or a Won or Lost one) Dead.
      const since = waitingSince(l);
      if (stageOf(l) !== 'scheduled' && since && Date.parse(nowIso) - ms(since) > PIPELINE.needsReplyDays * DAY) {
        touch(id, { archived_at: nowIso, revive_on: PIPELINE.reviveOn, dead_reason: `Spring Revival: the customer wrote last on ${shortDay(since)} and it was not answered within ${PIPELINE.needsReplyDays} days` });
        continue;
      }
      if (settled(l)) continue;
      const last = Math.max(ms(l.created_at), ...l.thread.map(e => ms(e.at)));
      if (Date.parse(nowIso) - last > PIPELINE.backfillQuietDays * DAY) touch(id, deadPatch(l, `No activity in the ${PIPELINE.backfillQuietDays} days before the backfill`, nowIso, true));
    }
  }

  const plan: IngestPlan = { inserts: [], updates: [], created, linked, events: allEvents.length - orphanEvents, orphanEvents, reviews: [...held.values()], resolved, matches };
  for (const [id, w] of work) {
    if (w.insert) { const { id: _drop, ...row } = { ...w.lead, ...w.patch }; void _drop; plan.inserts.push(row); }
    else if (Object.keys(w.patch).length) plan.updates.push({ id, patch: { ...w.patch, updated_at: nowIso } });
  }
  return plan;
}

/** Every lead the automatic Dead rule now applies to. */
export const autoDeadUpdates = (leads: EngineLead[], now: Date) => leads.flatMap(l => {
  const reason = autoDeadReason(l, now);
  return reason ? [{ id: l.id, patch: { ...deadPatch(l, reason, now.toISOString(), true), updated_at: now.toISOString() } }] : [];
});

/* ------------------------------ Archiving the sheet leads ------------------------------ */

const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "2026-11-05", "11/5/2026", "11/5", "Nov 5, 2026" or "Thu Nov 5" as YYYY-MM-DD. A date with no year is this year. */
export function looseDate(raw: string | null | undefined, now: Date): string | null {
  const s = (raw ?? '').trim().replace(/^[a-z]{3,9},?\s+(?=[a-z]{3,9}\.?\s+\d)/i, '');
  const year = Number(chicagoDay(now).slice(0, 4));
  const valid = (y: number, m: number, d: number) => m >= 1 && m <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(m)}-${pad(d)}` : null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);
  if (m) return valid(+m[1], +m[2], +m[3]);
  m = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?\b/.exec(s);
  if (m) return valid(m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : year, +m[1], +m[2]);
  m = /^([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/i.exec(s);
  if (m && months.includes(m[1].slice(0, 3).toLowerCase())) return valid(m[3] ? +m[3] : year, months.indexOf(m[1].slice(0, 3).toLowerCase()) + 1, +m[2]);
  return null;
}
/** The sheet's Next Follow Up: its own column if the table has one, else the "[... | Next Follow Up: ...]" the sheet import wrote into notes. */
export function nextFollowUp(row: EngineLead & Record<string, unknown>, now: Date) {
  const column = ['next_follow_up', 'next_follow_up_date', 'next_followup', 'follow_up_date'].map(k => row[k]).find(v => typeof v === 'string' && v);
  const raw = (column as string | undefined) ?? /Next Follow Up:\s*([^|\]\n]+)/i.exec(row.notes ?? '')?.[1];
  return raw ? { raw: raw.trim(), day: looseDate(raw, now) } : null;
}
/** Leads the sync added (or the old LSA paste import created) are LSA leads; every other lead came from the sheet. */
export const isSheetLead = (l: EngineLead) => l.lsa?.origin !== 'sync' && !/^LSA lead #\d+/.test(l.notes ?? '');

export type ArchiveMerge = {
  sheet: EngineLead; dup: EngineLead; why: string;
  /** Fills the sheet lead's empty fields and joins the threads. */
  patch: Patch;
  /** Archives the duplicate (never deletes it) and frees its LSA id; `restore` undoes that if the sheet lead cannot be saved. */
  dupPatch: Patch; restore: Patch;
  /** Values that differ: the sheet lead's is kept, the LSA one is only reported. */
  conflicts: { field: string; kept: unknown; lsa: unknown }[];
};
export type ArchivePlan = {
  total: number; alreadyArchived: number; alreadyLinked: number;
  merges: ArchiveMerge[];
  possible: { lead: EngineLead; candidates: Candidate[]; why: string }[];
  archive: { lead: EngineLead; patch: Patch }[];
  keep: { lead: EngineLead; why: string }[];
  dead: number;
};

const contactFields = ['name', 'phone', 'email', 'address', 'service_requested'] as const;
const sameText = (field: string, a: unknown, b: unknown) => {
  if (field === 'phone') return tenDigits(String(a)) === tenDigits(String(b));
  const [ka, kb] = field === 'address' ? [streetParts(String(a)), streetParts(String(b))] : [null, null];
  return ka && kb ? sameStreet(ka, kb) : String(a).trim().toLowerCase().replace(/\s+/g, ' ') === String(b).trim().toLowerCase().replace(/\s+/g, ' ');
};
const latestOf = (...values: (string | null | undefined)[]) => values.filter((v): v is string => Boolean(v)).sort((a, b) => ms(a) - ms(b)).at(-1) ?? null;

/**
 * Folds a lead the sync added into the lead it duplicates (a sheet lead in the sheet
 * archive, any lead chosen with Link to existing lead). Only empty fields are filled
 * (NP_ phones, "Unknown", "LSA msg Oct 22" and "n/a" count as empty; fields edited by
 * hand never); a value that differs is kept and reported. Threads and contact logs are
 * joined and the last-message times are the later of the two. The duplicate is archived,
 * never deleted: Dead, no revive date, its LSA ids moved over, and `lsa.mergedInto` so it
 * is never matched again.
 */
export function mergeLeads(sheet: EngineLead, dup: EngineLead, why: string, nowIso: string): ArchiveMerge {
  const locked = lockedFields(sheet), conflicts: ArchiveMerge['conflicts'] = [], patch: Patch = {};
  const row = (l: EngineLead) => l as unknown as Record<string, unknown>;
  for (const f of contactFields) {
    const kept = row(sheet)[f], theirs = row(dup)[f];
    if (isBlank(f, theirs)) continue;
    if (isBlank(f, kept) && !locked.includes(f)) patch[f] = theirs;
    else if (isBlank(f, kept) || !sameText(f, kept, theirs)) conflicts.push({ field: f, kept: kept ?? null, lsa: theirs });
  }
  const filled = Object.keys(patch);
  Object.assign(patch, {
    lsa_lead_id: sheet.lsa_lead_id ?? dup.lsa_lead_id,
    // A lead the sync created stays one (its status keeps following the engine); any other is linked.
    lsa: { ...(dup.lsa as LsaMeta), ...(sheet.lsa ?? {}), ids: [...new Set([...lsaIds(sheet), ...lsaIds(dup)])], origin: sheet.lsa?.origin === 'sync' ? 'sync' : 'linked', mergedInto: null },
    thread: [...new Map([...sheet.thread, ...dup.thread].map(e => [e.id, e])).values()].sort(byTime).slice(-1000),
    contact_log: [...new Map([...sheet.contact_log, ...dup.contact_log].map(c => [`${c.at}|${c.via}`, c])).values()].sort(byTime).slice(-200),
    last_customer_at: latestOf(sheet.last_customer_at, dup.last_customer_at), last_ours_at: latestOf(sheet.last_ours_at, dup.last_ours_at),
    cycle_at: latestOf(sheet.cycle_at, dup.cycle_at), attempts: sheet.attempts || dup.attempts, quoted_at: sheet.quoted_at ?? dup.quoted_at,
    proxy_phone: sheet.proxy_phone ?? dup.proxy_phone, dispute: sheet.dispute || dup.dispute,
    auto_fields: [...new Set([...(sheet.auto_fields ?? []), ...(dup.auto_fields ?? []).filter(f => filled.includes(f))])], updated_at: nowIso,
  });
  // A lead someone entered keeps its own follow-up count: the LSA lead's old attempts are history and must never make it Dead.
  if (sheet.lsa?.origin !== 'sync') Object.assign(patch, { contact_log: sheet.contact_log, cycle_at: sheet.cycle_at, attempts: sheet.attempts });
  if (!sheet.stage) Object.assign(patch, { stage: stageOf(sheet), stage_at: sheet.updated_at ?? sheet.created_at });
  // The customer wrote after the lead was archived: it comes back, as a new message would bring it back.
  const lastCustomer = patch.last_customer_at as string | null;
  if (sheet.archived_at && lastCustomer && ms(lastCustomer) > ms(sheet.archived_at)) {
    Object.assign(patch, { archived_at: null, revive_on: null, dead_reason: null });
    if (stageOf(sheet) === 'dead') Object.assign(patch, stagePatch(sheet, revivedStage(sheet, 'dead'), nowIso, true));
  }
  const dupPatch: Patch = {
    ...deadPatch(dup, `Merged into ${sheet.name ?? 'a sheet lead'} (${sheet.id})`, nowIso, true),
    revive_on: null, lsa_lead_id: null, lsa: { ...(dup.lsa as LsaMeta), ids: [], mergedInto: sheet.id }, updated_at: nowIso,
  };
  const restore = Object.fromEntries(Object.keys(dupPatch).map(k => [k, row(dup)[k] ?? null]));
  return { sheet, dup, why, patch, dupPatch, restore, conflicts };
}
export const mergeIntoSheetLead = mergeLeads;

/**
 * The one-time sheet archive. Only these sheet leads stay active: Scheduled (booked),
 * a Next Follow Up from today to 30 days ahead, or Needs Reply (the customer wrote last
 * within 14 days). Every other one is archived, Completed/Won included, its status kept
 * in original_status. It comes back on its Next Follow Up when that falls after the
 * 30 days and on or before the Spring Revival date; past-due, later and no-date ones
 * come back on the Spring Revival date. Ghosted (closed) becomes Dead. Nothing is deleted.
 * First, each lead the sync added that matchLead is sure duplicates a sheet lead (and
 * was never kept separate from it) is merged into it with mergeLeads; unsure pairs are
 * only listed under `possible`.
 */
export function planSheetArchive(rows: (EngineLead & Record<string, unknown>)[], now: Date): ArchivePlan {
  const nowIso = now.toISOString();
  const live = rows.filter(l => !l.lsa?.mergedInto);
  const sheet = live.filter(isSheetLead), synced = live.filter(l => l.lsa?.origin === 'sync');
  const plan: ArchivePlan = { total: sheet.length, alreadyArchived: 0, alreadyLinked: 0, merges: [], possible: [], archive: [], keep: [], dead: 0 };
  const merged = new Map<string, ArchiveMerge>();

  for (const s of synced) {
    const pool = sheet.filter(l => !l.archived_at && !(s.lsa?.separateFrom ?? []).includes(l.id));
    const m = matchLead({ name: s.name, phones: [tenDigits(s.phone)].filter((p): p is string => Boolean(p)), email: s.email, address: s.address, town: findTown(s.address) }, pool);
    if (m.kind === 'review') plan.possible.push({ lead: s, candidates: m.candidates, why: m.why });
    else if (m.kind === 'link' && merged.has(m.lead.id)) plan.possible.push({ lead: s, candidates: [{ id: m.lead.id, name: m.lead.name, phone: tenDigits(m.lead.phone), address: m.lead.address, why: m.why }], why: `${m.why}, but another LSA lead is already being merged into it` });
    else if (m.kind === 'link') { const merge = mergeIntoSheetLead(m.lead, s, m.why, nowIso); merged.set(m.lead.id, merge); plan.merges.push(merge); }
  }

  const today = chicagoDay(now), until = addDays(today, PIPELINE.keepActiveDays);
  for (const s of sheet) {
    if (s.archived_at) { plan.alreadyArchived++; continue; }
    if (s.lsa_lead_id) plan.alreadyLinked++;
    const merge = merged.get(s.id);
    const lead = (merge ? { ...s, ...merge.patch } : s) as EngineLead & Record<string, unknown>;
    const follow = nextFollowUp(s, now);
    const why = (lead.status ?? '').toLowerCase() === 'booked' || lead.stage === 'scheduled' ? 'Scheduled'
      : follow?.day && follow.day >= today && follow.day <= until ? `Next follow up ${follow.raw} (within ${PIPELINE.keepActiveDays} days)`
      : needsReply(lead, now) ? `Needs reply: the customer wrote last on ${shortDay(lead.last_customer_at!)}` : null;
    if (why) { plan.keep.push({ lead, why }); continue; }
    const ghosted = ['closed', 'ghosted'].includes((lead.status ?? '').toLowerCase());
    if (ghosted) plan.dead++;
    const revive = follow?.day && follow.day > until && follow.day <= PIPELINE.reviveOn ? follow.day : PIPELINE.reviveOn;
    plan.archive.push({
      lead,
      patch: { archived_at: nowIso, revive_on: revive, original_status: lead.status, stage: ghosted ? 'dead' : stageOf(lead), stage_at: ghosted ? nowIso : lead.stage_at ?? lead.updated_at ?? lead.created_at, dead_reason: ghosted ? 'Ghosted or closed in the sheet' : null, updated_at: nowIso },
    });
  }
  return plan;
}

/* ------------------------------ What the lead screen shows ------------------------------ */

export const townOf = (address: string | null) => {
  const parts = (address ?? '').split(',').map(p => p.trim()).filter(Boolean);
  return parts.length > 1 ? parts[1].replace(/\s+(WI|IL)\b.*$/i, '') : null;
};
export const isSpringRevival = (l: EngineLead, now: Date) => Boolean(l.archived_at && l.revive_on && l.revive_on <= chicagoDay(now));
export function engineStats(leads: EngineLead[], now: Date) {
  const today = chicagoDay(now);
  const weekday = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7;
  const weekStart = addDays(today, -weekday);
  const active = leads.filter(l => !l.archived_at);
  return {
    newToday: leads.filter(l => chicagoDay(l.created_at) === today).length,
    needsReply: active.filter(l => needsReply(l, now)).length,
    dueToday: active.filter(l => bucket(l, now) === 'today').length,
    quotesOut: active.filter(l => stageOf(l) === 'quoted').length,
    wonThisWeek: leads.filter(l => l.stage === 'won' && l.stage_at && chicagoDay(l.stage_at) >= weekStart).length,
  };
}
