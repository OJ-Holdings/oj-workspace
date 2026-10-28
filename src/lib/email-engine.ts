import { workDay } from './task-workflows';
import { effectiveOutreachStatus, isExteriorNiche, type OutreachProspect, type OutreachStatus } from './outreach';

/**
 * Rules for the OJ Solutions email engine. The sender is a Google Apps Script that
 * only does what netlify/functions/outreach-email-engine.ts tells it to; every
 * decision about who gets an email, and when, is made here so it can be tested.
 */
export const HEARTBEAT_FRESH_MINUTES = 25;
export const BATCH_SIZE = 3;
export const SEND_OPEN_MINUTE = 9 * 60;
export const SEND_CLOSE_MINUTE = 16 * 60 + 30;
export const WATCH_LIMIT = 300;

export const engineStates = ['sending', 'idle', 'outside-window', 'cap-reached', 'paused', 'braked', 'blocked', 'nothing-to-send'] as const;
export type EngineStateName = typeof engineStates[number];
export type EngineSettings = { enabled: boolean; daily_cap_max: number; niche_filter: string | null };
export const defaultEngineSettings: EngineSettings = { enabled: true, daily_cap_max: 25, niche_filter: null };
export type EngineState = { last_heartbeat_at: string; state: EngineStateName; detail: string; warmup_started_on: string | null; sender_domain: string | null };
export const eventKinds = ['reserved', 'sent', 'failed', 'reply', 'bounce', 'stop'] as const;
export type EmailEventKind = typeof eventKinds[number];
export type EmailEvent = { prospect_id: string; kind: EmailEventKind; event_at: string; detail?: string };
export type EngineProspect = Pick<OutreachProspect, 'id' | 'business_name' | 'industry' | 'best_fit_service' | 'secondary_fit' | 'email' | 'email_subject' | 'email_body' | 'sent_by' | 'date_added' | 'source_status' | 'outreach_status'>;

// ---- Time --------------------------------------------------------------------------------
function central(now: Date) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? '';
  return { weekday: get('weekday'), minutes: (Number(get('hour')) % 24) * 60 + Number(get('minute')) };
}
export type WindowState = { open: boolean; reason: 'open' | 'sunday' | 'before-hours' | 'after-hours' };
/** Mondays to Saturdays, 9:00 to 16:30 Central. */
export function sendWindow(now: Date): WindowState {
  const { weekday, minutes } = central(now);
  if (weekday === 'Sun') return { open: false, reason: 'sunday' };
  if (minutes < SEND_OPEN_MINUTE) return { open: false, reason: 'before-hours' };
  if (minutes >= SEND_CLOSE_MINUTE) return { open: false, reason: 'after-hours' };
  return { open: true, reason: 'open' };
}
const daysBetween = (from: string, to: string) => {
  const t = (d: string) => { const [y, m, day] = d.split('-').map(Number); return Date.UTC(y, m - 1, day); };
  return Math.round((t(to) - t(from)) / 86_400_000);
};

/** New sending domains earn trust slowly: 5 a day, doubling over the first weeks, then up to the ceiling. */
export function warmupCap(startedOn: string | null, today: string, max: number) {
  const ceiling = Math.min(Math.max(Math.floor(max), 1), 40);
  if (!startedOn) return Math.min(5, ceiling);
  const days = Math.max(daysBetween(startedOn, today), 0);
  const cap = days < 3 ? 5 : days < 7 ? 10 : days < 14 ? 15 : days < 21 ? 20 : 25 + 5 * Math.floor((days - 21) / 7);
  return Math.min(cap, ceiling);
}

// ---- Drafts ------------------------------------------------------------------------------
const spam = /\b(free money|guarantee[d]?|act now|limited time|click here|winner|100% free|risk[- ]free|no obligation|urgent!?|congratulations)\b|\$\$\$/i;
const placeholder = /\[[^\]]{0,80}\]|\{\{[^}]*\}\}|<[^>]+>|lorem ipsum|\bTODO\b|\bINSERT\b|\bXXX\b/i;
export const validEmail = (v: string | null | undefined): v is string =>
  !!v && v.length <= 254 && /^[^\s@,;<>()]+@[^\s@,;<>()]+\.[^\s@,;<>()]{2,}$/.test(v.trim()) && !/@[^@]*\.(invalid|test|example|localhost)$/i.test(v.trim()) && !/@example\./i.test(v.trim());

/** A machine check in place of an approval queue: a draft that fails any rule is skipped, never sent. */
export function lintEmail(subject: string | null | undefined, body: string | null | undefined) {
  const problems: string[] = [];
  const s = (subject ?? '').trim(), b = (body ?? '').trim();
  if (s.length < 3 || s.length > 90) problems.push('Subject must be 3 to 90 characters.');
  const letters = s.replace(/[^a-z]/gi, '');
  if (letters.length > 6 && letters === letters.toUpperCase()) problems.push('Subject is all capitals.');
  if (/^(re|fwd?):/i.test(s)) problems.push('Subject imitates a reply or forward.');
  if (/!{2,}/.test(s)) problems.push('Subject has repeated exclamation marks.');
  if (b.length < 40 || b.length > 1800) problems.push('Body must be 40 to 1,800 characters.');
  if (placeholder.test(s) || placeholder.test(b)) problems.push('Draft still contains a placeholder or markup.');
  if (spam.test(s) || spam.test(b)) problems.push('Draft contains a spam-trigger phrase.');
  if ((b.match(/https?:\/\//gi) ?? []).length > 1) problems.push('Draft has more than one link.');
  return { ok: problems.length === 0, problems };
}

export type Sender = { name: string; company: string; postalAddress: string };
/** The compliance footer is added to every email: who we are, a real address, and a one-word way out. */
export function composeEmail(p: Pick<EngineProspect, 'email_subject' | 'email_body'>, sender: Sender) {
  const body = (p.email_body ?? '').trim();
  const footer = `${sender.name}\n${sender.company}\n${sender.postalAddress}\n\nNot a fit? Reply "stop" and I will not email you again.`;
  return { subject: (p.email_subject ?? '').trim(), body: `${body}\n\n${footer}` };
}

export type ReplyKind = 'reply' | 'stop' | 'auto';
/** The new text of a reply with quoted lines dropped, spaces collapsed. */
function freshReply(text: string, max: number) {
  const unquoted = text.split(/\r?\n/).filter(l => !l.trim().startsWith('>')).join(' ');
  return unquoted.split(/\bOn [^\n]{0,160}\bwrote:/i)[0].replace(/\s+/g, ' ').trim().slice(0, max);
}
/** Reads only the new text of a reply (quoted lines ignored). */
export function classifyReply(text: string): ReplyKind {
  const fresh = freshReply(text, 700).toLowerCase();
  if (/out of office|automatic reply|auto-?reply|autoreply|away from (my|the) (desk|email)|on vacation|will be back/.test(fresh)) return 'auto';
  if (/\b(stop|unsubscribe|remove me|take me off|opt[\s-]?out|not interested|no thanks|no thank you)\b|do not (contact|email)|don'?t (contact|email)|leave me alone/.test(fresh)) return 'stop';
  return 'reply';
}

/** A best guess at what a real reply means, so "yes, call me" is not lost among the rest. Always shown beside the text itself. */
export type ReplyTone = 'interested' | 'question' | 'later' | 'other';
export const replyToneLabel: Record<ReplyTone, string> = { interested: 'Sounds interested', question: 'Asked a question', later: 'Maybe later', other: 'Replied' };
export function replyTone(text: string): ReplyTone {
  const fresh = freshReply(text, 700).toLowerCase();
  if (/\b(not right now|maybe later|later (this|next)|next (year|spring|season|month|quarter)|circle back|check back|reach out (again )?(in|later)|busy (right now|season))\b/.test(fresh)) return 'later';
  if (/\b(interested|sounds (good|great|interesting)|tell me more|more (info|information|details)|send (me )?(over )?(some |more )?(info|details|a quote|pricing)|call me|give me a call|how much|what does it cost|pricing|let'?s (talk|chat|connect|set up|schedule)|demo|yes|yeah|love to)\b/.test(fresh)) return 'interested';
  if (fresh.includes('?')) return 'question';
  return 'other';
}
const REPLY_STORE_MAX = 280;
/** What is kept of a reply: its tone and the first lines, so the inbox can show it. Never the whole thread. */
export function packReply(text: string): string {
  const tone = replyTone(text);
  return `${tone}|${freshReply(text, REPLY_STORE_MAX - tone.length - 1)}`;
}
export function unpackReply(detail: string | null | undefined): { tone: ReplyTone; text: string } | null {
  const m = /^(interested|question|later|other)\|([\s\S]*)$/.exec(detail ?? '');
  return m ? { tone: m[1] as ReplyTone, text: m[2] } : null;
}

/** What a recorded event does to the prospect's status, or null to leave it. */
export function nextStatus(kind: EmailEventKind, current: OutreachStatus): OutreachStatus | null {
  if (kind === 'sent') return current === 'Not Sent' ? 'Emailed' : current === 'DMed' ? 'Emailed + DMed' : null;
  if (kind === 'reply') return ['Not Sent', 'Emailed', 'DMed', 'Emailed + DMed'].includes(current) ? 'Replied' : null;
  if (kind === 'stop') return current === 'Not Interested' || current === 'Dead' ? null : 'Not Interested';
  return null;
}

// ---- Choosing who to email ---------------------------------------------------------------
export function matchesNiche(p: EngineProspect, niche: string | null) {
  const n = niche?.trim().toLowerCase();
  if (!n) return true;
  if (n === 'exterior' || n === 'exterior cleaning') return isExteriorNiche(p);
  return [p.industry, p.best_fit_service, p.secondary_fit, p.business_name].some(v => v?.toLowerCase().includes(n));
}

const count = (events: EmailEvent[], id: string, kind: EmailEventKind) => events.filter(e => e.prospect_id === id && e.kind === kind).length;
export type Skips = { notEmailable: number; badDraft: number; alreadyHandled: number; offNiche: number; wrongSender: number };
export function selectSendable(prospects: EngineProspect[], events: EmailEvent[], opts: { niche?: string | null; sender?: string | null } = {}) {
  const skips: Skips = { notEmailable: 0, badDraft: 0, alreadyHandled: 0, offNiche: 0, wrongSender: 0 };
  const blocked = new Set(events.filter(e => ['reserved', 'sent', 'bounce', 'stop'].includes(e.kind)).map(e => e.prospect_id));
  const ready: EngineProspect[] = [];
  for (const p of prospects) {
    const status = effectiveOutreachStatus(p);
    if (status !== 'Not Sent' && status !== 'DMed') { skips.alreadyHandled++; continue; }
    if (blocked.has(p.id) || count(events, p.id, 'failed') >= 2) { skips.alreadyHandled++; continue; }
    if (opts.sender && p.sent_by && p.sent_by !== opts.sender) { skips.wrongSender++; continue; }
    if (!validEmail(p.email)) { skips.notEmailable++; continue; }
    if (!matchesNiche(p, opts.niche ?? null)) { skips.offNiche++; continue; }
    if (!lintEmail(p.email_subject, p.email_body).ok) { skips.badDraft++; continue; }
    ready.push(p);
  }
  ready.sort((a, b) => Number(isExteriorNiche(b)) - Number(isExteriorNiche(a)) || (a.date_added ?? '').localeCompare(b.date_added ?? '') || a.business_name.localeCompare(b.business_name));
  return { ready, skips };
}

/** Pause by itself when too many addresses are bouncing: damaged sender reputation is hard to repair. */
export function bounceBrake(events: EmailEvent[], now: Date) {
  const since = now.getTime() - 14 * 86_400_000;
  const recent = events.filter(e => Date.parse(e.event_at) >= since);
  const sent = new Set(recent.filter(e => e.kind === 'sent').map(e => e.prospect_id)).size;
  const bounced = new Set(recent.filter(e => e.kind === 'bounce').map(e => e.prospect_id)).size;
  return { sent, bounced, braked: bounced >= 4 && bounced / Math.max(sent, 1) >= 0.08 };
}

export type PlanItem = { prospect_id: string; to: string; subject: string; body: string };
export type Plan = {
  state: EngineStateName; detail: string; items: PlanItem[]; capToday: number; sentToday: number;
  warmupStartedOn: string | null; watch: { prospect_id: string; email: string }[];
};
export function planEmailRun(input: {
  now: Date; settings: EngineSettings | null; state: Pick<EngineState, 'warmup_started_on'> | null; prospects: EngineProspect[]; events: EmailEvent[];
  sender: Sender | null; senderFilter?: string | null;
}): Plan {
  const { now, events } = input;
  const settings = input.settings ?? defaultEngineSettings;
  const today = workDay(now);
  const counted = events.filter(e => (e.kind === 'sent' || e.kind === 'reserved'));
  const sentToday = counted.filter(e => workDay(new Date(e.event_at)) === today).length;
  const capToday = warmupCap(input.state?.warmup_started_on ?? null, today, settings.daily_cap_max);
  const answered = new Set(events.filter(e => ['reply', 'bounce', 'stop'].includes(e.kind)).map(e => e.prospect_id));
  const sentRecently = new Set(events.filter(e => e.kind === 'sent' && Date.parse(e.event_at) >= now.getTime() - 30 * 86_400_000).map(e => e.prospect_id));
  const byId = new Map(input.prospects.map(p => [p.id, p]));
  const watch = [...sentRecently].filter(id => !answered.has(id) && validEmail(byId.get(id)?.email)).slice(0, WATCH_LIMIT)
    .map(id => ({ prospect_id: id, email: byId.get(id)!.email!.trim().toLowerCase() }));
  const done = (state: EngineStateName, detail: string, items: PlanItem[] = []): Plan =>
    ({ state, detail, items, capToday, sentToday, warmupStartedOn: input.state?.warmup_started_on ?? (items.length ? today : null), watch });

  if (!input.sender?.postalAddress.trim()) return done('blocked', 'Add the business mailing address to the server settings (OJ_EMAIL_POSTAL_ADDRESS). Every cold email must carry one.');
  if (!settings.enabled) return done('paused', 'Paused from the dashboard.');
  const brake = bounceBrake(events, now);
  if (brake.braked) return done('braked', `${brake.bounced} of ${brake.sent} recent emails bounced. Sending stopped to protect the sender. Fix the list, then switch it on again.`);
  const window = sendWindow(now);
  if (!window.open) return done('outside-window', window.reason === 'sunday' ? 'Sundays are off. Sending resumes Monday 9:00 AM Central.' : 'Sending runs Monday to Saturday, 9:00 AM to 4:30 PM Central.');
  if (sentToday >= capToday) return done('cap-reached', `Today's limit of ${capToday} is used. This ramps up as the sender builds a track record.`);
  const hourlyLimit = Math.max(2, Math.ceil(capToday / 6));
  const lastHour = counted.filter(e => Date.parse(e.event_at) >= now.getTime() - 3_600_000).length;
  if (lastHour >= hourlyLimit) return done('idle', 'Spacing sends out so they do not arrive in a burst.');

  const { ready } = selectSendable(input.prospects, events, { niche: settings.niche_filter, sender: input.senderFilter });
  if (!ready.length) return done('nothing-to-send', 'Nobody left with a valid email and a clean draft. Add prospects to the sheet.');
  const room = Math.min(BATCH_SIZE, hourlyLimit - lastHour, capToday - sentToday);
  const items = ready.slice(0, room).map(p => ({ prospect_id: p.id, to: p.email!.trim().toLowerCase(), ...composeEmail(p, input.sender!) }));
  return done('sending', `Sending ${items.length} now.`, items);
}

// ---- What the dashboard shows ------------------------------------------------------------
export type StatusTone = 'live' | 'idle' | 'warn' | 'off';
export function engineStatus(input: { settings: EngineSettings | null; state: EngineState | null; now: Date }): { tone: StatusTone; label: string; detail: string; running: boolean } {
  const { state, now } = input;
  const settings = input.settings ?? defaultEngineSettings;
  if (!state) return { tone: 'off', label: 'Not started', detail: 'The sender has not checked in yet. Finish the three setup steps below and this turns on by itself.', running: false };
  const age = (now.getTime() - Date.parse(state.last_heartbeat_at)) / 60_000;
  if (!Number.isFinite(age) || age > HEARTBEAT_FRESH_MINUTES) {
    return { tone: 'warn', label: 'Stopped checking in', detail: `Last check-in ${ago(age)}. Open the Apps Script Executions page to see why.`, running: false };
  }
  if (!settings.enabled || state.state === 'paused') return { tone: 'off', label: 'Paused', detail: 'Paused from this dashboard. Switch it on to resume.', running: false };
  switch (state.state) {
    case 'sending': return { tone: 'live', label: 'Running', detail: state.detail || 'Sending the next batch.', running: true };
    case 'idle': return { tone: 'live', label: 'Running', detail: state.detail || 'Pacing sends.', running: true };
    case 'outside-window': return { tone: 'live', label: 'Running', detail: state.detail || 'Waiting for the send window.', running: true };
    case 'cap-reached': return { tone: 'live', label: 'Running', detail: state.detail || 'Daily limit reached.', running: true };
    case 'nothing-to-send': return { tone: 'idle', label: 'Running, queue empty', detail: state.detail || 'Add prospects with an email.', running: true };
    case 'braked': return { tone: 'warn', label: 'Auto-paused', detail: state.detail, running: false };
    case 'blocked': return { tone: 'warn', label: 'Blocked', detail: state.detail, running: false };
  }
}
export function ago(minutes: number) {
  if (!Number.isFinite(minutes)) return 'a while ago';
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  if (minutes < 60 * 36) return `${Math.round(minutes / 60)} h ago`;
  return `${Math.round(minutes / 1440)} days ago`;
}

export type EmailStats = {
  sentTotal: number; sentToday: number; sentWeek: number; replied: number; replyRate: number | null;
  stopped: number; bounced: number; bounceRate: number | null; demos: number; lastSentAt: string | null;
  series: { day: string; count: number }[]; ready: number; skips: Skips; stuck: number;
};
export function emailStats(events: EmailEvent[], prospects: EngineProspect[], now: Date, settings: EngineSettings | null): EmailStats {
  const today = workDay(now);
  const sent = events.filter(e => e.kind === 'sent');
  const distinct = (kind: EmailEventKind) => new Set(events.filter(e => e.kind === kind).map(e => e.prospect_id)).size;
  const sentIds = new Set(sent.map(e => e.prospect_id));
  const replied = distinct('reply'), bounced = distinct('bounce');
  const dayOf = (iso: string) => workDay(new Date(iso));
  const series = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now.getTime() - (13 - i) * 86_400_000);
    return { day: workDay(d), count: 0 };
  });
  for (const e of sent) { const slot = series.find(s => s.day === dayOf(e.event_at)); if (slot) slot.count++; }
  const weekAgo = now.getTime() - 7 * 86_400_000;
  const reservedOnly = events.filter(e => e.kind === 'reserved' && !sentIds.has(e.prospect_id) && !events.some(x => x.prospect_id === e.prospect_id && x.kind === 'failed') && now.getTime() - Date.parse(e.event_at) > 3_600_000);
  const { ready, skips } = selectSendable(prospects, events, { niche: settings?.niche_filter ?? null });
  return {
    sentTotal: sentIds.size, sentToday: sent.filter(e => dayOf(e.event_at) === today).length, sentWeek: sent.filter(e => Date.parse(e.event_at) >= weekAgo).length,
    replied, replyRate: sentIds.size ? replied / sentIds.size : null, stopped: distinct('stop'), bounced, bounceRate: sentIds.size ? bounced / sentIds.size : null,
    demos: prospects.filter(p => sentIds.has(p.id) && effectiveOutreachStatus(p) === 'Demo Booked').length,
    lastSentAt: sent.map(e => e.event_at).sort().at(-1) ?? null, series, ready: ready.length, skips, stuck: new Set(reservedOnly.map(e => e.prospect_id)).size,
  };
}

// ---- Inbox and sent mail -----------------------------------------------------------------
export type InboxReply = { prospect_id: string; at: string; business: string; tone: ReplyTone; text: string; status: OutreachStatus };
/** Replies, newest first. Older replies recorded before text was kept show a plain "Replied" with no text. */
export function replyInbox(events: EmailEvent[], prospects: Pick<EngineProspect, 'id' | 'business_name' | 'outreach_status' | 'source_status'>[], limit = 20): InboxReply[] {
  const byId = new Map(prospects.map(p => [p.id, p]));
  return events.filter(e => e.kind === 'reply').sort((a, b) => b.event_at.localeCompare(a.event_at)).slice(0, limit).map(e => {
    const p = byId.get(e.prospect_id), packed = unpackReply(e.detail);
    return { prospect_id: e.prospect_id, at: e.event_at, business: p?.business_name ?? 'Unknown business', tone: packed?.tone ?? 'other', text: packed?.text ?? '', status: p ? effectiveOutreachStatus(p) : 'Replied' };
  });
}
export type SentMail = { prospect_id: string; at: string; business: string; to: string | null; subject: string | null; body: string | null };
/** What went out, newest first. The subject was recorded when the email was claimed; the body is the prospect's draft (the footer is added at send time). */
export function sentMail(events: EmailEvent[], prospects: Pick<EngineProspect, 'id' | 'business_name' | 'email' | 'email_body'>[], limit = 30): SentMail[] {
  const byId = new Map(prospects.map(p => [p.id, p]));
  const subject = new Map<string, string>();
  for (const e of [...events].sort((a, b) => a.event_at.localeCompare(b.event_at))) if (e.kind === 'reserved' && e.detail) subject.set(e.prospect_id, e.detail);
  return events.filter(e => e.kind === 'sent').sort((a, b) => b.event_at.localeCompare(a.event_at)).slice(0, limit).map(e => {
    const p = byId.get(e.prospect_id);
    return { prospect_id: e.prospect_id, at: e.event_at, business: p?.business_name ?? 'Unknown business', to: p?.email ?? null, subject: subject.get(e.prospect_id) ?? null, body: p?.email_body ?? null };
  });
}
/** The next emails the engine would pick, in order. Same rules the sender uses. */
export function nextUp(prospects: EngineProspect[], events: EmailEvent[], settings: EngineSettings | null, limit = 5) {
  return selectSendable(prospects, events, { niche: settings?.niche_filter ?? null }).ready.slice(0, limit);
}
