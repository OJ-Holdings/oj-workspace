import test from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../netlify/functions/outreach-email-engine';
import { planRun, questRun, reportRun, type EngineStore, type NewEvent, type QuestData } from '../src/lib/email-engine-api';
import { defaultEngineSettings, type EmailEvent, type EngineProspect, type EngineSettings, type EngineState } from '../src/lib/email-engine';
import type { OutreachStatus } from '../src/lib/outreach';

const body = 'Hi Sam, I saw your crew is out on jobs most of the day, so calls probably roll to voicemail. We built an AI receptionist that answers, takes the details and texts you.';
const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const prospect = (n: number, over: Partial<EngineProspect> = {}): EngineProspect => ({
  id: id(n), business_name: `Biz ${n}`, industry: null, best_fit_service: null, secondary_fit: null, email: `p${n}@biz.com`, email_subject: 'Missed calls',
  email_body: body, sent_by: null, date_added: '2026-10-01', source_status: 'Not Sent', outreach_status: null, ...over,
});
const env = { postalAddress: '123 Main St, Kenosha, WI 53140', company: 'OJ Solutions', workspaceUrl: 'https://ws.test' };
const tuesday = new Date('2026-10-27T16:00:00Z');

function memoryStore(init: { prospects: EngineProspect[]; events?: EmailEvent[]; settings?: EngineSettings | null; state?: EngineState | null; quest?: QuestData }) {
  const s = {
    prospects: init.prospects, events: [...(init.events ?? [])] as (EmailEvent & { dedupe_key?: string })[], keys: new Set<string>(),
    settings: init.settings === undefined ? { ...defaultEngineSettings } : init.settings, state: init.state ?? null as EngineState | null,
    statuses: [] as [string, OutreachStatus][],
  };
  const store: EngineStore = {
    settings: async () => s.settings, state: async () => s.state, prospects: async () => s.prospects, events: async () => s.events,
    async record(events: NewEvent[]) {
      const fresh = events.filter(e => !s.keys.has(e.dedupe_key));
      for (const e of fresh) { s.keys.add(e.dedupe_key); s.events.push({ prospect_id: e.prospect_id, kind: e.kind, event_at: e.event_at, detail: e.detail, dedupe_key: e.dedupe_key }); }
      return fresh;
    },
    async setStatus(pid, status) { s.statuses.push([pid, status]); },
    async saveState({ now, state, detail, warmupStartedOn, senderDomain }) {
      s.state = { last_heartbeat_at: now.toISOString(), state: state ?? s.state?.state ?? 'idle', detail: detail ?? s.state?.detail ?? '', warmup_started_on: warmupStartedOn ?? s.state?.warmup_started_on ?? null, sender_domain: senderDomain ?? s.state?.sender_domain ?? null };
    },
    questData: async () => init.quest ?? { goal: 10, members: [], log: [] },
  };
  return { s, store };
}

test('plan reserves what it hands out, records a heartbeat', async () => {
  const { s, store } = memoryStore({ prospects: [1, 2, 3].map(n => prospect(n)) });
  const first = await planRun(store, env, { now: tuesday, senderName: 'Oscar', senderDomain: 'ojsolutions.org' });
  assert.equal(first.state, 'sending');
  assert.deepEqual(first.items.map(i => i.prospect_id), [id(1), id(2), id(3)]);
  assert.match(first.items[0].body, /Oscar\nOJ Solutions\n123 Main St/);
  assert.equal(s.state?.last_heartbeat_at, tuesday.toISOString());
  assert.equal(s.state?.warmup_started_on, '2026-10-27');
  assert.equal(s.state?.sender_domain, 'ojsolutions.org');
  // A second run right after must not hand out the same people again.
  const second = await planRun(store, env, { now: new Date(tuesday.getTime() + 60_000), senderName: 'Oscar' });
  assert.deepEqual(second.items.map(i => i.prospect_id), []);
  assert.notEqual(second.state, 'sending');
});

test('a dry run shows the next emails without claiming them or recording a check-in', async () => {
  const { s, store } = memoryStore({ prospects: [1, 2].map(n => prospect(n)) });
  const look = await planRun(store, env, { now: tuesday, senderName: 'Oscar', dryRun: true });
  assert.equal(look.items.length, 2);
  assert.equal(s.events.length, 0);
  assert.equal(s.state, null);
  const real = await planRun(store, env, { now: tuesday, senderName: 'Oscar' });
  assert.deepEqual(real.items.map(i => i.prospect_id), look.items.map(i => i.prospect_id));
});

test('plan without an address or a sender name is blocked and sends nothing', async () => {
  const noAddress = memoryStore({ prospects: [prospect(1)] });
  const a = await planRun(noAddress.store, { ...env, postalAddress: null }, { now: tuesday, senderName: 'Oscar' });
  assert.equal(a.state, 'blocked');
  assert.deepEqual(a.items, []);
  assert.equal(noAddress.s.events.length, 0);
  const noName = memoryStore({ prospects: [prospect(1)] });
  const b = await planRun(noName.store, env, { now: tuesday, senderName: '<script>' });
  assert.equal(b.state, 'blocked');
  assert.deepEqual(b.items, []);
  assert.equal(noName.s.events.length, 0);
});

test('plan honours the dashboard pause switch', async () => {
  const { store, s } = memoryStore({ prospects: [prospect(1)], settings: { enabled: false, daily_cap_max: 25, niche_filter: null } });
  const plan = await planRun(store, env, { now: tuesday, senderName: 'Oscar' });
  assert.equal(plan.state, 'paused');
  assert.deepEqual(plan.items, []);
  assert.equal(s.state?.state, 'paused');
});

test('report records sends and moves status forward once, even if the script retries', async () => {
  const { s, store } = memoryStore({ prospects: [prospect(1), prospect(2, { source_status: 'DMed' })] });
  const results = [{ prospect_id: id(1), kind: 'sent' }, { prospect_id: id(2), kind: 'sent' }, { prospect_id: 'nope', kind: 'sent' }, { prospect_id: id(1), kind: 'mystery' }];
  const first = await reportRun(store, { now: tuesday, results });
  assert.deepEqual([first.recorded, first.ignored], [2, 2]);
  assert.deepEqual(s.statuses, [[id(1), 'Emailed'], [id(2), 'Emailed + DMed']]);
  const again = await reportRun(store, { now: tuesday, results });
  assert.deepEqual([again.recorded, again.duplicates], [0, 2]);
  assert.equal(s.statuses.length, 2);
});

test('report classifies replies: stop requests suppress, auto-replies are ignored, only a real reply keeps its first lines', async () => {
  const { s, store } = memoryStore({ prospects: [1, 2, 3, 4].map(n => prospect(n, { outreach_status: 'Emailed' })) });
  const out = await reportRun(store, { now: tuesday, results: [
    { prospect_id: id(1), kind: 'reply', ref: 'm1', text: 'Sure, call me at 3' },
    { prospect_id: id(2), kind: 'reply', ref: 'm2', text: 'Please stop emailing me' },
    { prospect_id: id(3), kind: 'reply', ref: 'm3', text: 'Automatic reply: out of office' },
    { prospect_id: id(4), kind: 'bounce' },
  ] });
  assert.equal(out.recorded, 3);
  assert.equal(out.ignored, 1);
  assert.deepEqual(s.statuses, [[id(1), 'Replied'], [id(2), 'Not Interested']]);
  assert.ok(s.events.filter(e => e.kind !== 'reply').every(e => !e.detail), 'stops and bounces keep no text');
  assert.equal(s.events.find(e => e.kind === 'reply')?.detail, 'interested|Sure, call me at 3');
  assert.ok(!JSON.stringify(s.events).includes('stop emailing'), 'a stop request is never stored');
  assert.deepEqual(s.events.map(e => e.kind).sort(), ['bounce', 'reply', 'stop']);
});

test('quests: counts today per partner and returns only the reminders due', async () => {
  const log = (actor: string, day: string, n: number) => Array.from({ length: n }, (_, i) => ({ id: `${actor}${day}${i}`, actor_id: actor, prospect_id: null, channel: 'instagram' as const, work_day: day, undone_at: null, created_at: `${day}T15:00:00Z` }));
  const quest: QuestData = { goal: 10, members: [{ userId: 'o', displayName: 'Oscar R' }, { userId: 'j', displayName: 'Jacob' }, { userId: 'x', displayName: 'Intern' }],
    log: [...log('o', '2026-10-26', 10), ...log('o', '2026-10-27', 4), ...log('j', '2026-10-27', 10)] };
  const { store } = memoryStore({ prospects: [], quest });
  const noon = await questRun(store, env, { now: new Date('2026-10-27T17:30:00Z') });
  assert.deepEqual(noon.people, [{ name: 'Oscar', done: 4, streak: 1, atRisk: true }, { name: 'Jacob', done: 10, streak: 1, atRisk: false }]);
  assert.equal(noon.reminders.length, 1);
  assert.equal(noon.reminders[0].name, 'Oscar');
  assert.match(noon.reminders[0].body, /https:\/\/ws\.test\/workspace\/b\/solutions\/dms/);
});

test('endpoint: bearer token, JSON object and known action are required before anything runs', async () => {
  const previous = process.env.OJ_OUTREACH_SYNC_TOKEN;
  process.env.OJ_OUTREACH_SYNC_TOKEN = 'secret-token';
  try {
    const post = (headers: Record<string, string>, b: string) => handler({ httpMethod: 'POST', headers, body: b });
    assert.equal((await handler({ httpMethod: 'GET' })).statusCode, 405);
    assert.equal((await post({}, '{}')).statusCode, 401);
    assert.equal((await post({ authorization: 'Bearer nope' }, '{}')).statusCode, 401);
    const ok = { authorization: 'Bearer secret-token' };
    assert.equal((await post(ok, '')).statusCode, 413);
    assert.equal((await post(ok, 'x'.repeat(200_001))).statusCode, 413);
    assert.equal((await post(ok, 'not json')).statusCode, 400);
    assert.equal((await post(ok, '[]')).statusCode, 400);
    assert.equal((await post(ok, '{"action":"drop"}')).statusCode, 400);
    const { store } = memoryStore({ prospects: [prospect(1)] });
    const planned = await handler({ httpMethod: 'POST', headers: ok, body: JSON.stringify({ action: 'plan', senderName: 'Oscar' }) }, { store, env, now: tuesday });
    assert.equal(planned.statusCode, 200);
    assert.equal(JSON.parse(planned.body).state, 'sending');
    const broken = { ...store, settings: async () => { throw new Error('secret db detail'); } };
    const failed = await handler({ httpMethod: 'POST', headers: ok, body: '{"action":"plan"}' }, { store: broken, env, now: tuesday });
    assert.equal(failed.statusCode, 500);
    assert.ok(!failed.body.includes('secret db detail'));
  } finally {
    if (previous === undefined) delete process.env.OJ_OUTREACH_SYNC_TOKEN; else process.env.OJ_OUTREACH_SYNC_TOKEN = previous;
  }
});

test('the claim keeps the subject, and a real reply keeps its tone and first lines but a stop keeps nothing', async () => {
  const { s, store } = memoryStore({ prospects: [1, 2].map(n => prospect(n)) });
  const plan = await planRun(store, env, { now: tuesday, senderName: 'Oscar' });
  assert.equal(plan.items.length, 2);
  assert.ok(s.events.filter(e => e.kind === 'reserved').every(e => e.detail === 'Missed calls'));
  await reportRun(store, { now: tuesday, results: [
    { prospect_id: id(1), kind: 'reply', ref: 'm1', text: 'Sounds good, call me tomorrow.\n\nOn Mon, Oct 26, 2026 at 9:00 AM Oscar wrote:\n> Hi Sam' },
    { prospect_id: id(2), kind: 'reply', ref: 'm2', text: 'Please remove me from your list.' },
  ] });
  const reply = s.events.find(e => e.kind === 'reply');
  assert.equal(reply?.detail, 'interested|Sounds good, call me tomorrow.');
  const stop = s.events.find(e => e.kind === 'stop');
  assert.equal(stop?.detail, '');
});
