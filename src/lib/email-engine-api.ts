import { buildReminders, centralHour, partnerOf, streakFor, todayKey, DEFAULT_DM_GOAL, type DmLogEntry, type Partner, type Reminder } from './dm-quests';
import { classifyReply, nextStatus, planEmailRun, type EmailEvent, type EmailEventKind, type EngineProspect, type EngineSettings, type EngineState, type EngineStateName, type PlanItem } from './email-engine';
import type { OutreachStatus } from './outreach';
import { effectiveOutreachStatus } from './outreach';

/**
 * What the sender script may ask for. The script holds no rules of its own: it asks
 * "what should I send now?", sends exactly that, then reports what happened.
 * The storage is behind an interface so the rules here are tested without a database.
 */
export type NewEvent = { prospect_id: string; kind: EmailEventKind; dedupe_key: string; detail: string; event_at: string };
export type QuestData = { goal: number; members: { userId: string; displayName: string }[]; log: DmLogEntry[] };
export interface EngineStore {
  settings(): Promise<EngineSettings | null>;
  state(): Promise<EngineState | null>;
  prospects(): Promise<EngineProspect[]>;
  events(since: Date): Promise<EmailEvent[]>;
  /** Inserts events whose dedupe key is new and returns only those. */
  record(events: NewEvent[]): Promise<NewEvent[]>;
  setStatus(prospectId: string, status: OutreachStatus, at: Date): Promise<void>;
  saveState(patch: { now: Date; state?: EngineStateName; detail?: string; warmupStartedOn?: string | null; senderDomain?: string | null }): Promise<void>;
  questData(since: string): Promise<QuestData>;
}

export type EngineEnv = { postalAddress: string | null; company: string; workspaceUrl: string | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const cleanName = (v: unknown) => typeof v === 'string' && /^[\p{L}][\p{L} .'-]{0,59}$/u.test(v.trim()) ? v.trim() : null;
const cleanDomain = (v: unknown) => typeof v === 'string' && /^[a-z0-9.-]{3,120}$/i.test(v.trim()) ? v.trim().toLowerCase() : null;
const cleanRef = (v: unknown) => typeof v === 'string' ? v.replace(/[^\w.@+=-]/g, '').slice(0, 120) : '';

export async function planRun(store: EngineStore, env: EngineEnv, input: { now: Date; senderName?: unknown; senderFilter?: unknown; senderDomain?: unknown; dryRun?: boolean }) {
  const name = cleanName(input.senderName);
  const filter = cleanName(input.senderFilter);
  const [settings, state, prospects, events] = await Promise.all([
    store.settings(), store.state(), store.prospects(), store.events(new Date(input.now.getTime() - 60 * 86_400_000)),
  ]);
  const sender = env.postalAddress && name ? { name, company: env.company, postalAddress: env.postalAddress } : null;
  const plan = planEmailRun({ now: input.now, settings, state, prospects, events, sender, senderFilter: filter });
  let items: PlanItem[] = plan.items;
  if (items.length && !input.dryRun) {
    const claimed = await store.record(items.map(i => ({ prospect_id: i.prospect_id, kind: 'reserved' as const, dedupe_key: `reserve:${i.prospect_id}`, detail: '', event_at: input.now.toISOString() })));
    const won = new Set(claimed.map(c => c.prospect_id));
    items = items.filter(i => won.has(i.prospect_id));
  }
  const missingName = env.postalAddress && !name;
  const reported = plan.items.length && !items.length ? { state: 'idle' as const, detail: 'Another run already claimed this batch.' }
    : missingName ? { state: 'blocked' as const, detail: 'The sender script has no sender name. Set SENDER_NAME in its script properties.' }
    : { state: plan.state, detail: plan.detail };
  // A dry run only looks: nothing is claimed and no check-in is recorded.
  if (!input.dryRun) await store.saveState({ now: input.now, ...reported, warmupStartedOn: plan.warmupStartedOn, senderDomain: cleanDomain(input.senderDomain) });
  return { state: reported.state, detail: reported.detail, items: reported.state === 'blocked' ? [] : items, watch: plan.watch, capToday: plan.capToday, sentToday: plan.sentToday };
}

export type Reported = { prospect_id?: unknown; kind?: unknown; ref?: unknown; text?: unknown; detail?: unknown };
export async function reportRun(store: EngineStore, input: { now: Date; results: unknown; senderDomain?: unknown }) {
  const results = Array.isArray(input.results) ? (input.results as Reported[]).slice(0, 200) : [];
  const at = input.now.toISOString();
  const events: NewEvent[] = [];
  let ignored = 0;
  for (const r of results) {
    const id = typeof r?.prospect_id === 'string' && uuid.test(r.prospect_id) ? r.prospect_id : null;
    const ref = cleanRef(r?.ref);
    const detail = typeof r?.detail === 'string' ? r.detail.replace(/\s+/g, ' ').slice(0, 200) : '';
    if (!id) { ignored++; continue; }
    switch (r.kind) {
      case 'sent': events.push({ prospect_id: id, kind: 'sent', dedupe_key: `sent:${id}`, detail: '', event_at: at }); break;
      case 'failed': events.push({ prospect_id: id, kind: 'failed', dedupe_key: `failed:${id}:${ref || input.now.getTime()}`, detail, event_at: at }); break;
      case 'bounce': events.push({ prospect_id: id, kind: 'bounce', dedupe_key: `bounce:${id}`, detail: '', event_at: at }); break;
      case 'reply': {
        // The reply text is read once to tell a stop request from a reply, and is not kept.
        const verdict = classifyReply(typeof r.text === 'string' ? r.text.slice(0, 4000) : '');
        if (verdict === 'auto') { ignored++; break; }
        events.push(verdict === 'stop'
          ? { prospect_id: id, kind: 'stop', dedupe_key: `stop:${id}`, detail: '', event_at: at }
          : { prospect_id: id, kind: 'reply', dedupe_key: `reply:${id}:${ref || 'first'}`, detail: '', event_at: at });
        break;
      }
      default: ignored++;
    }
  }
  const fresh = events.length ? await store.record(events) : [];
  if (fresh.length) {
    const prospects = new Map((await store.prospects()).map(p => [p.id, p]));
    const order: Record<string, number> = { sent: 0, reply: 1, stop: 2 };
    for (const e of [...fresh].sort((a, b) => (order[a.kind] ?? 9) - (order[b.kind] ?? 9))) {
      const p = prospects.get(e.prospect_id);
      if (!p) continue;
      const next = nextStatus(e.kind, effectiveOutreachStatus(p));
      if (next) { await store.setStatus(p.id, next, input.now); p.outreach_status = next; }
    }
  }
  await store.saveState({ now: input.now, senderDomain: cleanDomain(input.senderDomain) });
  return { recorded: fresh.length, duplicates: events.length - fresh.length, ignored };
}

/** Today's counts for each partner, and the reminders due now. */
export async function questRun(store: EngineStore, env: EngineEnv, input: { now: Date }) {
  const today = todayKey(input.now);
  const since = new Date(input.now.getTime() - 60 * 86_400_000);
  const data = await store.questData(since.toISOString().slice(0, 10));
  const goal = data.goal || DEFAULT_DM_GOAL;
  const people = data.members.flatMap(m => {
    const name = partnerOf(m.displayName);
    if (!name) return [];
    const streak = streakFor(data.log, m.userId, goal, today);
    return [{ name, done: data.log.filter(e => !e.undone_at && e.actor_id === m.userId && e.work_day === today).length, streak: streak.days, atRisk: streak.atRisk }];
  });
  const link = env.workspaceUrl ? `${env.workspaceUrl.replace(/\/+$/, '')}/workspace/b/solutions/dms` : 'the OJ Workspace, OJ Solutions, Daily 10';
  const reminders: Reminder[] = buildReminders({ people, goal, hour: centralHour(input.now), today, link });
  return { goal, today, people: people as { name: Partner; done: number; streak: number; atRisk: boolean }[], reminders };
}
