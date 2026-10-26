import test from 'node:test';
import assert from 'node:assert/strict';
import { addDays, buildReminders, centralHour, dayCount, dmTargets, isRestDay, lastSevenDays, levelFor, partnerOf, questLine, streakFor, teamStreak, weekStart, weekTotal, xpFor, type DmLogEntry } from '../src/lib/dm-quests';
import type { OutreachProspect } from '../src/lib/outreach';

// 2026-10-26 is a Monday.
const me = 'u-oscar', pal = 'u-jacob';
let n = 0;
const dm = (actor: string, day: string, extra: Partial<DmLogEntry> = {}): DmLogEntry =>
  ({ id: `d${++n}`, actor_id: actor, prospect_id: null, channel: 'instagram', work_day: day, undone_at: null, created_at: `${day}T15:00:00Z`, ...extra });
const many = (actor: string, day: string, count: number) => Array.from({ length: count }, () => dm(actor, day));

test('days: Sunday is a rest day and weeks start Monday', () => {
  assert.equal(isRestDay('2026-10-25'), true);
  assert.equal(isRestDay('2026-10-26'), false);
  assert.equal(addDays('2026-10-31', 1), '2026-11-01');
  assert.equal(weekStart('2026-10-28'), '2026-10-26');
  assert.equal(weekStart('2026-10-25'), '2026-10-19');
  assert.equal(centralHour(new Date('2026-10-26T20:30:00Z')), 15);
});

test('counts ignore undone DMs and other people', () => {
  const log = [...many(me, '2026-10-26', 3), dm(me, '2026-10-26', { undone_at: '2026-10-26T16:00:00Z' }), dm(pal, '2026-10-26')];
  assert.equal(dayCount(log, me, '2026-10-26'), 3);
  assert.equal(dayCount(log, pal, '2026-10-26'), 1);
});

test('streak counts goal days, skips Sunday, and is at risk until today is met', () => {
  const log = [...many(me, '2026-10-22', 10), ...many(me, '2026-10-23', 10), ...many(me, '2026-10-24', 10), ...many(me, '2026-10-26', 4)];
  const open = streakFor(log, me, 10, '2026-10-26');
  assert.deepEqual(open, { days: 3, metToday: false, atRisk: true });
  const met = streakFor([...log, ...many(me, '2026-10-26', 6)], me, 10, '2026-10-26');
  assert.deepEqual(met, { days: 4, metToday: true, atRisk: false });
  const broken = streakFor([...many(me, '2026-10-22', 10), ...many(me, '2026-10-24', 9)], me, 10, '2026-10-26');
  assert.equal(broken.days, 0);
  assert.equal(streakFor([], me, 10, '2026-10-26').days, 0);
});

test('team streak needs every partner on the same day', () => {
  const log = [...many(me, '2026-10-23', 10), ...many(pal, '2026-10-23', 10), ...many(me, '2026-10-24', 10), ...many(pal, '2026-10-24', 6)];
  assert.equal(teamStreak(log, [me, pal], 10, '2026-10-26'), 0);
  const both = [...log, ...many(pal, '2026-10-24', 4)];
  assert.equal(teamStreak(both, [me, pal], 10, '2026-10-26'), 2);
  assert.equal(teamStreak(both, [], 10, '2026-10-26'), 0);
});

test('XP and levels: 10 per DM, 50 for the goal, levels at 0, 100, 300, 600', () => {
  assert.equal(xpFor([...many(me, '2026-10-26', 10)], me, 10), 150);
  assert.equal(xpFor([...many(me, '2026-10-26', 9)], me, 10), 90);
  assert.equal(levelFor(0).level, 1);
  assert.equal(levelFor(99).level, 1);
  assert.equal(levelFor(100).level, 2);
  assert.equal(levelFor(599).level, 3);
  assert.equal(levelFor(600).title, 'Operator');
  assert.deepEqual([levelFor(150).into, levelFor(150).span, levelFor(150).pct], [50, 200, 25]);
  assert.equal(levelFor(10_000_000).title, 'Mythic');
});

test('quest copy escalates through the day and rewards a clear', () => {
  assert.equal(questLine(0, 10, 9).tone, 'start');
  assert.equal(questLine(6, 10, 11).tone, 'go');
  assert.equal(questLine(2, 10, 15).tone, 'push');
  assert.equal(questLine(7, 10, 19).tone, 'urgent');
  assert.equal(questLine(7, 10, 21).tone, 'closed');
  assert.equal(questLine(10, 10, 12).tone, 'done');
  assert.match(questLine(12, 10, 12).sub, /2 over/);
  assert.match(questLine(3, 10, 18).headline, /7 to go/);
});

test('week strips and totals follow Monday to today', () => {
  const log = [...many(me, '2026-10-26', 2), ...many(me, '2026-10-24', 10), ...many(me, '2026-10-19', 5)];
  const strip = lastSevenDays(log, me, 10, '2026-10-26');
  assert.equal(strip.length, 7);
  assert.deepEqual([strip[0].day, strip[6].day], ['2026-10-20', '2026-10-26']);
  assert.equal(strip.find(d => d.day === '2026-10-24')?.goalMet, true);
  assert.equal(strip.find(d => d.day === '2026-10-25')?.rest, true);
  assert.equal(weekTotal(log, me, '2026-10-26'), 2);
  assert.equal(weekTotal(log, me, '2026-10-24'), 15);
});

const prospect = (over: Partial<OutreachProspect>): OutreachProspect => ({
  id: 'x', organization_id: 'o', source_key: 'k', source_row: 2, business_name: 'Biz', industry: null, city_state: null, website_url: null, phone_number: null,
  decision_maker: null, best_fit_service: null, secondary_fit: null, leak: null, evidence: null, email: null, instagram: null, facebook: null, email_subject: null,
  email_body: null, dm: null, date_added: null, sent_by: null, source_status: 'Not Sent', source_notes: null, outreach_status: null, outreach_notes: '',
  status_updated_at: null, created_at: '', updated_at: '', last_seen_at: '', ...over,
});

test('DM targets: reachable, not yet DMed, own list and exterior cleaning first', () => {
  const list = [
    prospect({ id: 'plain', business_name: 'Plain Dental', instagram: '@plaindental' }),
    prospect({ id: 'ext', business_name: 'Shine Pressure Washing', instagram: 'https://instagram.com/shine' , sent_by: 'Jacob' }),
    prospect({ id: 'mine-ext', business_name: 'Kenosha Soft Wash', industry: 'Exterior cleaning', facebook: 'kenoshasoftwash', sent_by: 'Oscar' }),
    prospect({ id: 'no-social', business_name: 'No Social', email: 'a@b.com' }),
    prospect({ id: 'already', business_name: 'Already DMed', instagram: 'x', source_status: 'DMed' }),
    prospect({ id: 'replied', business_name: 'Replied', instagram: 'y', outreach_status: 'Replied' }),
    prospect({ id: 'today', business_name: 'Done Today', instagram: 'z' }),
    prospect({ id: 'bad', business_name: 'Bad Handle', instagram: 'not a handle!!' }),
    prospect({ id: 'js', business_name: 'Unsafe', instagram: 'javascript:alert(1)' }),
  ];
  const targets = dmTargets(list, 'Oscar', new Set(['today']));
  assert.deepEqual(targets.map(t => t.prospect.id), ['mine-ext', 'ext', 'plain']);
  assert.equal(targets[0].channel, 'facebook');
  assert.equal(targets[0].url, 'https://facebook.com/kenoshasoftwash');
  assert.equal(targets[2].url, 'https://instagram.com/plaindental');
  assert.equal(targets[0].mine, true);
  assert.equal(dmTargets(list, null).length, 4);
});

test('reminders: latest slot only, only people under goal, none on Sunday or after the cutoff', () => {
  const people = [
    { name: 'Oscar' as const, done: 3, streak: 5, atRisk: true },
    { name: 'Jacob' as const, done: 10, streak: 2, atRisk: false },
  ];
  const base = { people, goal: 10, today: '2026-10-26', link: 'https://x.test/q' };
  assert.deepEqual(buildReminders({ ...base, hour: 9 }), []);
  const ten = buildReminders({ ...base, hour: 10 });
  assert.equal(ten.length, 1);
  assert.equal(ten[0].key, '2026-10-26:10:Oscar');
  assert.match(ten[0].subject, /3\/10/);
  const six = buildReminders({ ...base, hour: 19 });
  assert.equal(six[0].slot, 18);
  assert.match(six[0].subject, /7 DMs to go: streak at risk/);
  assert.match(six[0].body, /5-day streak ends tonight/);
  assert.match(six[0].body, /Jacob already cleared/);
  assert.match(buildReminders({ ...base, hour: 20 })[0].subject, /Last call/);
  assert.deepEqual(buildReminders({ ...base, hour: 21 }), []);
  assert.deepEqual(buildReminders({ ...base, today: '2026-10-25', hour: 12 }), []);
  assert.deepEqual(buildReminders({ ...base, people: people.map(p => ({ ...p, done: 10 })), hour: 12 }), []);
});

test('partner names come from the first word of the display name', () => {
  assert.equal(partnerOf('Oscar Rivera'), 'Oscar');
  assert.equal(partnerOf(' jacob '), 'Jacob');
  assert.equal(partnerOf('Someone Else'), null);
});
