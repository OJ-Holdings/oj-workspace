import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bounceBrake, classifyReply, composeEmail, emailStats, engineStatus, lintEmail, nextStatus, planEmailRun, selectSendable, sendWindow, validEmail, warmupCap,
  type EmailEvent, type EngineProspect, type EngineState,
} from '../src/lib/email-engine';

const sender = { name: 'Oscar', company: 'OJ Solutions', postalAddress: '123 Main St, Kenosha, WI 53140' };
const body = 'Hi Sam, I saw your crew is out on jobs most of the day, so calls probably roll to voicemail. We built an AI receptionist that answers, takes the details and texts you.';
const prospect = (id: string, over: Partial<EngineProspect> = {}): EngineProspect => ({
  id, business_name: `Biz ${id}`, industry: null, best_fit_service: null, secondary_fit: null, email: `${id}@biz.com`, email_subject: 'Missed calls at Biz',
  email_body: body, sent_by: null, date_added: '2026-10-01', source_status: 'Not Sent', outreach_status: null, ...over,
});
const ev = (prospect_id: string, kind: EmailEvent['kind'], event_at: string): EmailEvent => ({ prospect_id, kind, event_at });
// Tuesday 2026-10-27, 11:00 Central (CDT, UTC-5).
const tuesdayMorning = new Date('2026-10-27T16:00:00Z');

test('send window: Monday to Saturday, 9:00 to 16:30 Central', () => {
  assert.deepEqual(sendWindow(tuesdayMorning), { open: true, reason: 'open' });
  assert.equal(sendWindow(new Date('2026-10-27T13:59:00Z')).reason, 'before-hours');
  assert.equal(sendWindow(new Date('2026-10-27T14:00:00Z')).open, true);
  assert.equal(sendWindow(new Date('2026-10-27T21:29:00Z')).open, true);
  assert.equal(sendWindow(new Date('2026-10-27T21:30:00Z')).reason, 'after-hours');
  assert.equal(sendWindow(new Date('2026-10-25T17:00:00Z')).reason, 'sunday');
  assert.equal(sendWindow(new Date('2026-10-31T17:00:00Z')).open, true);
});

test('warm-up: 5, 10, 15, 20, then 25 growing 5 a week to the ceiling', () => {
  assert.equal(warmupCap(null, '2026-10-27', 25), 5);
  assert.equal(warmupCap('2026-10-27', '2026-10-27', 25), 5);
  assert.equal(warmupCap('2026-10-27', '2026-10-30', 25), 10);
  assert.equal(warmupCap('2026-10-27', '2026-11-03', 25), 15);
  assert.equal(warmupCap('2026-10-27', '2026-11-10', 25), 20);
  assert.equal(warmupCap('2026-10-27', '2026-11-17', 25), 25);
  assert.equal(warmupCap('2026-10-27', '2026-12-01', 40), 35);
  assert.equal(warmupCap('2026-10-27', '2026-12-15', 40), 40);
  assert.equal(warmupCap('2026-10-27', '2026-12-01', 12), 12);
  assert.equal(warmupCap(null, '2026-10-27', 3), 3);
});

test('lint stands in for approval: bad drafts are skipped, never sent', () => {
  assert.equal(lintEmail('Missed calls at Biz', body).ok, true);
  assert.equal(lintEmail('', body).ok, false);
  assert.equal(lintEmail('LAST CHANCE TO ACT', body).ok, false);
  assert.equal(lintEmail('Re: our call', body).ok, false);
  assert.equal(lintEmail('Quick one!!', body).ok, false);
  assert.equal(lintEmail('Hello', 'too short').ok, false);
  assert.equal(lintEmail('Hello', `${body} [Name]`).ok, false);
  assert.equal(lintEmail('Hello', `${body} {{company}}`).ok, false);
  assert.equal(lintEmail('Hello', `${body} Guaranteed results.`).ok, false);
  assert.equal(lintEmail('Hello', `${body} https://a.com https://b.com`).ok, false);
  assert.equal(lintEmail('Hello', `${body} https://a.com`).ok, true);
  assert.equal(validEmail('sam@biz.com'), true);
  assert.equal(validEmail('not-an-email'), false);
  assert.equal(validEmail('sam@example.invalid'), false);
  assert.equal(validEmail('a@b.com, c@d.com'), false);
  assert.equal(validEmail(null), false);
});

test('every email carries who we are, a real address and a one-word opt-out', () => {
  const mail = composeEmail({ email_subject: ' Hi ', email_body: ` ${body} ` }, sender);
  assert.equal(mail.subject, 'Hi');
  assert.ok(mail.body.startsWith(body));
  assert.match(mail.body, /Oscar\nOJ Solutions\n123 Main St, Kenosha, WI 53140/);
  assert.match(mail.body, /Reply "stop"/);
});

test('reply classification: stop wins, auto-replies are ignored, quoted text is not read', () => {
  assert.equal(classifyReply('Sounds interesting, call me tomorrow'), 'reply');
  assert.equal(classifyReply('Please stop emailing me'), 'stop');
  assert.equal(classifyReply('Not interested, thanks'), 'stop');
  assert.equal(classifyReply('Remove me from your list'), 'stop');
  assert.equal(classifyReply("Don't contact me again"), 'stop');
  assert.equal(classifyReply('Automatic reply: I am out of office until Monday'), 'auto');
  assert.equal(classifyReply('Yes please\n> On Mon you wrote:\n> Reply "stop" and I will not email you again.'), 'reply');
  assert.equal(classifyReply('The bus stop is near our shop, come by'), 'stop');
});

test('status after an event moves forward only', () => {
  assert.equal(nextStatus('sent', 'Not Sent'), 'Emailed');
  assert.equal(nextStatus('sent', 'DMed'), 'Emailed + DMed');
  assert.equal(nextStatus('sent', 'Replied'), null);
  assert.equal(nextStatus('reply', 'Emailed'), 'Replied');
  assert.equal(nextStatus('reply', 'Demo Booked'), null);
  assert.equal(nextStatus('stop', 'Replied'), 'Not Interested');
  assert.equal(nextStatus('stop', 'Dead'), null);
  assert.equal(nextStatus('bounce', 'Emailed'), null);
  assert.equal(nextStatus('failed', 'Not Sent'), null);
});

test('who is sendable: untouched, valid, clean, on niche, once', () => {
  const list = [
    prospect('ok'),
    prospect('exterior', { industry: 'Pressure washing', date_added: '2026-10-20' }),
    prospect('dmed', { source_status: 'DMed' }),
    prospect('emailed', { outreach_status: 'Emailed' }),
    prospect('noemail', { email: null }),
    prospect('baddraft', { email_body: 'short' }),
    prospect('reserved'), prospect('bounced'), prospect('stopped'),
    prospect('failed-once'), prospect('failed-twice'),
    prospect('theirs', { sent_by: 'Jacob' }),
  ];
  const events = [ev('reserved', 'reserved', '2026-10-26T15:00:00Z'), ev('bounced', 'bounce', '2026-10-26T15:00:00Z'), ev('stopped', 'stop', '2026-10-26T15:00:00Z'),
    ev('failed-once', 'failed', '2026-10-26T15:00:00Z'), ev('failed-twice', 'failed', '2026-10-26T15:00:00Z'), ev('failed-twice', 'failed', '2026-10-26T16:00:00Z')];
  const all = selectSendable(list, events);
  assert.deepEqual(all.ready.map(p => p.id), ['exterior', 'dmed', 'failed-once', 'ok', 'theirs']);
  assert.deepEqual(all.skips, { notEmailable: 1, badDraft: 1, alreadyHandled: 5, offNiche: 0, wrongSender: 0 });
  assert.deepEqual(selectSendable(list, events, { niche: 'exterior' }).ready.map(p => p.id), ['exterior']);
  assert.deepEqual(selectSendable(list, events, { niche: 'pressure' }).ready.map(p => p.id), ['exterior']);
  assert.deepEqual(selectSendable(list, events, { sender: 'Oscar' }).ready.map(p => p.id), ['exterior', 'dmed', 'failed-once', 'ok']);
});

test('bounce brake trips at 4 bounces and 8 percent, not before', () => {
  const sent = Array.from({ length: 40 }, (_, i) => ev(`s${i}`, 'sent', '2026-10-26T15:00:00Z'));
  const bounces = (n: number) => Array.from({ length: n }, (_, i) => ev(`s${i}`, 'bounce', '2026-10-26T16:00:00Z'));
  assert.equal(bounceBrake([...sent, ...bounces(3)], tuesdayMorning).braked, false);
  assert.equal(bounceBrake([...sent, ...bounces(4)], tuesdayMorning).braked, true);
  assert.equal(bounceBrake([...sent, ...bounces(4)].map(e => ({ ...e, event_at: '2026-09-01T00:00:00Z' })), tuesdayMorning).braked, false);
  assert.equal(bounceBrake([...Array.from({ length: 100 }, (_, i) => ev(`t${i}`, 'sent', '2026-10-26T15:00:00Z')), ...bounces(0), ...Array.from({ length: 4 }, (_, i) => ev(`t${i}`, 'bounce', '2026-10-26T16:00:00Z'))], tuesdayMorning).braked, false);
});

test('plan: sends a small paced batch (two an hour at the start), in order, with the footer', () => {
  const prospects = ['a', 'b', 'c', 'd', 'e'].map(id => prospect(id));
  const plan = planEmailRun({ now: tuesdayMorning, settings: null, state: null, prospects, events: [], sender });
  assert.equal(plan.state, 'sending');
  assert.equal(plan.capToday, 5);
  assert.deepEqual(plan.items.map(i => i.prospect_id), ['a', 'b']);
  assert.equal(plan.items[0].to, 'a@biz.com');
  assert.match(plan.items[0].body, /123 Main St/);
  assert.equal(plan.warmupStartedOn, '2026-10-27');
});

test('plan: every reason not to send is reported honestly', () => {
  const prospects = [prospect('a')];
  const run = (over: Partial<Parameters<typeof planEmailRun>[0]> = {}) => planEmailRun({ now: tuesdayMorning, settings: null, state: null, prospects, events: [], sender, ...over });
  assert.equal(run({ sender: { ...sender, postalAddress: ' ' } }).state, 'blocked');
  assert.equal(run({ sender: null }).state, 'blocked');
  assert.equal(run({ settings: { enabled: false, daily_cap_max: 25, niche_filter: null } }).state, 'paused');
  assert.equal(run({ now: new Date('2026-10-25T17:00:00Z') }).state, 'outside-window');
  assert.equal(run({ now: new Date('2026-10-27T23:00:00Z') }).state, 'outside-window');
  assert.equal(run({ prospects: [] }).state, 'nothing-to-send');
  assert.equal(run({ settings: { enabled: true, daily_cap_max: 25, niche_filter: 'dentist' } }).state, 'nothing-to-send');

  const fiveToday = ['p1', 'p2', 'p3', 'p4', 'p5'].map(id => ev(id, 'sent', '2026-10-27T14:30:00Z'));
  const capped = run({ events: fiveToday, state: { warmup_started_on: '2026-10-27' } });
  assert.equal(capped.state, 'cap-reached');
  assert.equal(capped.sentToday, 5);
  // Yesterday's sends do not count against today.
  assert.equal(run({ events: fiveToday.map(e => ({ ...e, event_at: '2026-10-26T20:00:00Z' })), state: { warmup_started_on: '2026-10-26' } }).state, 'sending');
  // Two sent in the last hour on a day with room: wait so mail is not sent in a burst.
  const paced = run({ events: [ev('p1', 'sent', '2026-10-27T15:30:00Z'), ev('p2', 'reserved', '2026-10-27T15:40:00Z'), ev('p3', 'sent', '2026-10-27T15:50:00Z')], state: { warmup_started_on: '2026-10-20' } });
  assert.equal(paced.state, 'idle');
  const bounced = run({ events: [...Array.from({ length: 20 }, (_, i) => ev(`s${i}`, 'sent', '2026-10-20T15:00:00Z')), ...Array.from({ length: 5 }, (_, i) => ev(`s${i}`, 'bounce', '2026-10-21T15:00:00Z'))] });
  assert.equal(bounced.state, 'braked');
});

test('plan: a batch never exceeds what is left of today or this hour', () => {
  const prospects = ['a', 'b', 'c', 'd', 'e', 'f'].map(id => prospect(id));
  const plan = planEmailRun({ now: tuesdayMorning, settings: null, state: { warmup_started_on: '2026-10-27' }, prospects, sender, events: [ev('x', 'sent', '2026-10-27T14:10:00Z'), ev('y', 'sent', '2026-10-27T14:20:00Z'), ev('z', 'sent', '2026-10-27T14:30:00Z'), ev('w', 'sent', '2026-10-27T14:40:00Z')] });
  assert.equal(plan.capToday, 5);
  assert.equal(plan.items.length, 1);
});

test('plan: watch list covers recent sends that have not answered', () => {
  const prospects = ['a', 'b', 'c'].map(id => prospect(id));
  const events = [ev('a', 'sent', '2026-10-20T15:00:00Z'), ev('b', 'sent', '2026-10-20T15:00:00Z'), ev('b', 'reply', '2026-10-21T15:00:00Z'), ev('c', 'sent', '2026-08-01T15:00:00Z')];
  const plan = planEmailRun({ now: tuesdayMorning, settings: null, state: { warmup_started_on: '2026-10-20' }, prospects, events, sender });
  assert.deepEqual(plan.watch, [{ prospect_id: 'a', email: 'a@biz.com' }]);
});

test('status shown on the dashboard is only "Running" when the sender really checked in', () => {
  const state = (over: Partial<EngineState> = {}): EngineState => ({ last_heartbeat_at: '2026-10-27T15:55:00Z', state: 'sending', detail: 'Sending 2 now.', warmup_started_on: null, sender_domain: null, ...over });
  const get = (s: EngineState | null, enabled = true) => engineStatus({ settings: { enabled, daily_cap_max: 25, niche_filter: null }, state: s, now: tuesdayMorning });
  assert.deepEqual([get(null).label, get(null).running], ['Not started', false]);
  assert.deepEqual([get(state()).label, get(state()).running, get(state()).tone], ['Running', true, 'live']);
  assert.equal(get(state({ last_heartbeat_at: '2026-10-27T15:00:00Z' })).label, 'Stopped checking in');
  assert.equal(get(state({ last_heartbeat_at: '2026-10-27T15:00:00Z' })).running, false);
  assert.equal(get(state(), false).label, 'Paused');
  assert.equal(get(state({ state: 'braked', detail: 'x' })).running, false);
  assert.equal(get(state({ state: 'blocked', detail: 'x' })).tone, 'warn');
  assert.equal(get(state({ state: 'outside-window', detail: '' })).running, true);
  assert.equal(get(state({ state: 'nothing-to-send', detail: '' })).label, 'Running, queue empty');
  assert.equal(get(state({ last_heartbeat_at: 'garbage' })).running, false);
});

test('stats count people, not emails; and flag sends that never confirmed', () => {
  const prospects = ['a', 'b', 'c', 'd'].map(id => prospect(id, id === 'a' ? { outreach_status: 'Demo Booked' } : {}));
  const events = [
    ev('a', 'sent', '2026-10-27T15:00:00Z'), ev('b', 'sent', '2026-10-26T15:00:00Z'), ev('c', 'sent', '2026-10-10T15:00:00Z'),
    ev('a', 'reply', '2026-10-27T16:00:00Z'), ev('a', 'reply', '2026-10-27T17:00:00Z'), ev('b', 'stop', '2026-10-27T16:00:00Z'), ev('c', 'bounce', '2026-10-11T00:00:00Z'),
    ev('d', 'reserved', '2026-10-27T10:00:00Z'),
  ];
  const stats = emailStats(events, prospects, tuesdayMorning, null);
  assert.deepEqual([stats.sentTotal, stats.sentToday, stats.sentWeek, stats.replied, stats.stopped, stats.bounced, stats.demos, stats.stuck], [3, 1, 2, 1, 1, 1, 1, 1]);
  assert.equal(stats.replyRate, 1 / 3);
  assert.equal(stats.series.length, 14);
  assert.equal(stats.series.at(-1)?.count, 1);
  assert.equal(stats.lastSentAt, '2026-10-27T15:00:00Z');
  assert.equal(emailStats([], prospects, tuesdayMorning, null).replyRate, null);
});

// ---- Reply inbox, sent mail, next up ------------------------------------------------------
import { nextUp, packReply, replyInbox, replyTone, sentMail, unpackReply } from '../src/lib/email-engine';

test('replyTone reads what a reply probably means, and never labels a stop as interest', () => {
  assert.equal(replyTone('Sounds good, can you call me tomorrow?'), 'interested');
  assert.equal(replyTone('How much does it cost?'), 'interested');
  assert.equal(replyTone('Not right now, maybe next spring.'), 'later');
  assert.equal(replyTone('Do you work with pressure washing companies in Racine?'), 'question');
  assert.equal(replyTone('Got it.'), 'other');
  assert.equal(replyTone('> yes\nThanks, got it.'), 'other', 'quoted lines are ignored');
});

test('packReply keeps the tone and the first lines only, and unpackReply reads it back', () => {
  const long = `Sounds interested, call me. ${'x'.repeat(600)}`;
  const packed = packReply(`${long}\n\nOn Tue, Oct 27, 2026 at 9:01 AM Oscar <o@ojsolutions.org> wrote:\n> the original email`);
  assert.ok(packed.length <= 280);
  const back = unpackReply(packed);
  assert.equal(back?.tone, 'interested');
  assert.ok(back!.text.startsWith('Sounds interested, call me.'));
  assert.ok(!/wrote:|original email/.test(packReply('Yes please.\nOn Tue, Oct 27, 2026 at 9:01 AM Oscar <o@ojsolutions.org> wrote:\n> the original email')));
  assert.equal(unpackReply(''), null);
  assert.equal(unpackReply('Replied'), null, 'older replies with no text read as plain replies');
});

test('replyInbox lists newest first with the business and what the prospect is now', () => {
  const prospects = [
    { id: 'a', business_name: 'Alpha Wash', outreach_status: 'Replied' as const, source_status: 'Emailed' as const },
    { id: 'b', business_name: 'Bravo Wash', outreach_status: null, source_status: 'Emailed' as const },
  ];
  const events = [
    { prospect_id: 'a', kind: 'reply' as const, event_at: '2026-10-27T15:00:00Z', detail: 'interested|Yes, call me.' },
    { prospect_id: 'b', kind: 'reply' as const, event_at: '2026-10-27T16:00:00Z', detail: '' },
    { prospect_id: 'a', kind: 'sent' as const, event_at: '2026-10-27T14:00:00Z' },
  ];
  const inbox = replyInbox(events, prospects);
  assert.deepEqual(inbox.map(r => r.business), ['Bravo Wash', 'Alpha Wash']);
  assert.equal(inbox[0].text, '');
  assert.equal(inbox[0].tone, 'other');
  assert.equal(inbox[1].tone, 'interested');
  assert.equal(inbox[1].status, 'Replied');
});

test('sentMail pairs each sent email with the subject recorded when it was claimed', () => {
  const prospects = [{ id: 'a', business_name: 'Alpha Wash', email: 'a@alpha.com', email_body: 'Hello Alpha' }];
  const events = [
    { prospect_id: 'a', kind: 'reserved' as const, event_at: '2026-10-27T14:00:00Z', detail: 'Missed calls' },
    { prospect_id: 'a', kind: 'sent' as const, event_at: '2026-10-27T14:01:00Z' },
  ];
  const [mail] = sentMail(events, prospects);
  assert.equal(mail.subject, 'Missed calls');
  assert.equal(mail.body, 'Hello Alpha');
  assert.equal(mail.to, 'a@alpha.com');
  assert.equal(sentMail([{ prospect_id: 'a', kind: 'sent', event_at: '2026-10-27T14:01:00Z' }], prospects)[0].subject, null);
});

test('nextUp is the same list the sender would pick, capped', () => {
  const body = 'Hi Sam, I saw your crew is out on jobs most of the day, so calls probably roll to voicemail. We built an AI receptionist that answers, takes the details and texts you.';
  const mk = (n: number) => ({ id: `p${n}`, business_name: `Biz ${n}`, industry: null, best_fit_service: null, secondary_fit: null, email: `p${n}@biz.com`, email_subject: 'Missed calls', email_body: body, sent_by: null, date_added: '2026-10-01', source_status: 'Not Sent' as const, outreach_status: null });
  const prospects = [1, 2, 3, 4, 5, 6, 7].map(mk);
  assert.equal(nextUp(prospects, [], null, 5).length, 5);
  const sentOne = [{ prospect_id: 'p1', kind: 'sent' as const, event_at: '2026-10-27T14:00:00Z' }];
  assert.ok(!nextUp(prospects, sentOne, null, 7).some(p => p.id === 'p1'));
});
