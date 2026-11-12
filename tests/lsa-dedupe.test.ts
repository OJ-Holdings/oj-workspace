import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyEvents, emailFitsName, engineStats, isBlank, matchLead, mergeLeads, nameParts, needsReply, planIngest, planSheetArchive, sameFirstName, sameStreet, streetKey, streetParts, suggestionsFor, type EngineLead, type LeadReview, type LsaLead, type ThreadEvent } from '../src/lib/lead-pipeline';
import { applySheetArchive, readLeads, runBackfill, syncLsa } from '../src/lib/lsa-sync';
import { readOverrides } from '../scripts/lsa-overrides';
import { allRows, insideRepo, ORG, readBaseline, readSnapshot, rehearsalCopy, supabaseLike } from '../scripts/lsa-dry-run';

const lead = (over: Partial<EngineLead> = {}): EngineLead => ({
  id: over.id ?? 'a0000000-0000-4000-8000-000000000001', name: 'Pat Doe', phone: '+12625550100', email: null, address: null, service_requested: null, quote_amount: null,
  status: 'new', source: 'dtd', notes: null, created_at: '2026-10-01T15:00:00.000Z', updated_at: null, manually_updated_fields: [], lsa_lead_id: null, lsa: null,
  proxy_phone: null, stage: null, stage_at: null, attempts: 0, contact_log: [], thread: [], cycle_at: null, last_customer_at: null, last_ours_at: null, quoted_at: null,
  scheduled_on: null, dead_reason: null, archived_at: null, revive_on: null, original_status: null, dispute: false, auto_fields: [], ...over,
});
const lsa = (over: Partial<LsaLead> = {}): LsaLead => ({
  id: '111', type: 'MESSAGE', category: 'xcat:service_area_business_window_cleaner', service: null, status: 'NEW', charged: true, credit: null, creditAt: null,
  locale: 'en', createdAt: '2026-11-02T14:00:00.000Z', name: null, phone: '+1 (262) 555-0199 ext. 1234', email: null, note: null, feedback: null, ...over,
});
const ev = (id: string, who: ThreadEvent['who'], at: string, text?: string, lsaId = '111'): ThreadEvent => ({ id, lsa: lsaId, at, who, channel: 'MESSAGE', ...(text ? { text } : {}) });
const NOW = '2026-11-12T15:00:00.000Z';

/* ------------------------------ One-tap suggestions ------------------------------ */

test('quote suggestions come from our latest message with amounts, skip discounts, the current quote and older quotes', () => {
  const thread = [ev('1', 'customer', '2026-11-10T15:00:00.000Z', 'How much for the house?'), ev('2', 'us', '2026-11-10T16:00:00.000Z', 'Total would be $600 for the house and $150 for gutters. $50 off for seniors.')];
  const l = lead({ stage: 'contacted', thread });
  assert.deepEqual(suggestionsFor(l, new Date(NOW)).map(s => s.kind === 'quoted' && s.amount), [600, 150]);
  assert.deepEqual(suggestionsFor({ ...l, quote_amount: 600 }, new Date(NOW)).map(s => s.kind === 'quoted' && s.amount), [150]);
  assert.deepEqual(suggestionsFor({ ...l, quoted_at: '2026-11-10T17:00:00.000Z', stage: 'quoted' }, new Date(NOW)), []);
  assert.deepEqual(suggestionsFor({ ...l, stage: 'won' }, new Date(NOW)), []);
  // Only our words count: an amount the customer names is never a quote.
  assert.deepEqual(suggestionsFor(lead({ stage: 'new', thread: [ev('3', 'customer', '2026-11-10T15:00:00.000Z', 'Someone quoted me $300')] }), new Date(NOW)), []);
});

test('schedule suggestions need our offer and a later yes; a date in the reply wins; a take-back, a no, past days and the day already set give nothing', () => {
  const offer = ev('1', 'us', '2026-11-11T16:00:00.000Z', 'We could come Tuesday 11/17 or Wednesday 11/18.');
  const days = (thread: ThreadEvent[], over: Partial<EngineLead> = {}, now = NOW) => suggestionsFor(lead({ stage: 'contacted', thread, ...over }), new Date(now)).flatMap(s => s.kind === 'scheduled' ? [s.day] : []);
  assert.deepEqual(days([offer, ev('2', 'customer', '2026-11-12T14:00:00.000Z', 'Yes Tuesday works')]), ['2026-11-17']);
  assert.deepEqual(days([offer, ev('2', 'customer', '2026-11-12T14:00:00.000Z', 'Sounds good!')]), ['2026-11-17', '2026-11-18']);
  assert.deepEqual(days([offer, ev('2', 'customer', '2026-11-12T14:00:00.000Z', 'Sounds good!'), ev('3', 'customer', '2026-11-12T15:00:00.000Z', 'Actually I need to reschedule')]), []);
  assert.deepEqual(days([offer, ev('2', 'customer', '2026-11-12T14:00:00.000Z', "No, Tuesday doesn't work")]), []);
  assert.deepEqual(days([offer, ev('2', 'customer', '2026-11-12T14:00:00.000Z', 'Yes Tuesday works')], { scheduled_on: '2026-11-17' }), []);
  assert.deepEqual(days([offer, ev('2', 'customer', '2026-11-12T14:00:00.000Z', 'Sounds good!')], {}, '2026-11-18T06:00:00.000Z'), ['2026-11-18']);
  assert.deepEqual(days([ev('2', 'customer', '2026-11-12T14:00:00.000Z', 'Yes Tuesday works')]), []);
  // "Thursday works" sent on that Thursday means the Thursday we offered, not a week later.
  const thursday = [ev('1', 'us', '2026-11-09T16:00:00.000Z', 'How about Thursday morning?'), ev('2', 'customer', '2026-11-12T13:00:00.000Z', 'Thursday works')];
  assert.deepEqual(days(thursday, {}, '2026-11-12T14:00:00.000Z'), ['2026-11-12']);
});

test('an archived lead is only revived by a customer message sent after it was archived', () => {
  const archived = lead({ stage: 'dead', attempts: 3, archived_at: '2026-11-20T00:00:00.000Z', revive_on: '2027-03-15', dead_reason: 'x' });
  const old = applyEvents(archived, [ev('7', 'customer', '2026-11-01T10:00:00.000Z', 'hi from the old thread')]);
  assert.equal('archived_at' in old, false); assert.equal(old.stage, undefined);
  const fresh = applyEvents(archived, [ev('8', 'customer', '2026-11-21T10:00:00.000Z', 'Still interested?')]);
  assert.equal(fresh.archived_at, null); assert.equal(fresh.revive_on, null);
});

/* ------------------------------ Same customer? ------------------------------ */

test('street keys ignore case, units, ordinals and suffixes, and stop at the town, state or ZIP', () => {
  assert.equal(streetKey('4521 22nd Ave., Apt 2, Kenosha WI 53140'), '4521 22');
  assert.equal(streetKey('4521 22ND AVENUE'), '4521 22');
  assert.equal(streetKey('S94 W23640 Kunzendorf Ct, Mukwonago'), 's94w23640 kunzendorf');
  assert.equal(streetKey('1234 North Sheridan Road #4'), '1234 n sheridan');
  assert.equal(streetKey('1234 Sheridan Kenosha WI'), '1234 sheridan');
  assert.equal(streetKey('1234 Pleasant Prairie Rd'), '1234 pleasant prairie');
  assert.equal(streetKey('na'), null); assert.equal(streetKey('Kenosha'), null); assert.equal(streetKey('1234'), null);
  const same = (a: string, b: string) => sameStreet(streetParts(a)!, streetParts(b)!);
  assert.equal(same('1234 Derby Line, Grayslake', '1234 derby line grayslake il 60030'), true);
  assert.equal(same('4521 22nd Ave', '4521 22nd Avenue, Kenosha'), true);
  assert.equal(same('4521 22nd Ave', '4521 22'), true);
  // Not the same house: another suffix, another unit, a longer street name, another number.
  assert.equal(same('4521 22nd Ave, Kenosha WI', '4521 22nd St, Kenosha WI'), false);
  assert.equal(same('900 Pine St Apt 2', '900 Pine St Apt 3'), false);
  assert.equal(same('12 Oak St', '12 Oak Ridge Dr'), false);
  assert.equal(same('1234 22nd Ave', '1234 2nd Ave'), false);
});

test('names: nicknames and initials fit, placeholders and non-names are not names', () => {
  assert.equal(sameFirstName('jenny', 'jennifer'), true); assert.equal(sameFirstName('pat', 'patricia'), true); assert.equal(sameFirstName('pat', 'patrick'), true);
  assert.equal(sameFirstName('j', 'john'), true); assert.equal(sameFirstName('jenny', 'jessica'), false); assert.equal(sameFirstName('patricia', 'patrick'), false);
  assert.deepEqual(nameParts('Mrs. Jennifer  Smith'), { first: 'jennifer', last: 'smith', words: ['jennifer', 'smith'] });
  assert.equal(nameParts('Unknown'), null); assert.equal(nameParts('June 3rd big blue house by the lake'), null); assert.equal(nameParts('n/a'), null);
});

test('matchLead links only on one strong match with no conflict; otherwise asks, or adds new', () => {
  const pool = [
    lead({ id: 'a', name: 'Jennifer Smith', phone: '+12625550111', address: '812 Oak Ln, Pleasant Prairie' }),
    lead({ id: 'b', name: 'Bob', phone: 'NP_1', address: '55 Elm St' }),
    lead({ id: 'c', name: 'Sam Lee', phone: '+12625550133', address: null }),
    lead({ id: 'd', name: 'Gone', phone: '+12625550144', lsa: { ids: [], origin: 'sync', mergedInto: 'x' } as unknown as EngineLead['lsa'] }),
  ];
  const probe = (over: Partial<Parameters<typeof matchLead>[0]>) => ({ name: null, phones: [], email: null, address: null, town: null, ...over });
  assert.equal(matchLead(probe({ name: 'Jen', address: '812 Oak Lane' }), pool).kind, 'link');
  // The street alone, with no name to confirm it, is only a possible duplicate (a household, a duplex).
  const street = matchLead(probe({ address: '812 Oak Lane' }), pool);
  assert.equal(street.kind, 'review'); assert.match(street.why, /no name, phone or email to confirm/);
  assert.equal(matchLead(probe({ name: 'Mike', address: '812 Oak St' }), pool).kind, 'new');
  assert.equal((matchLead(probe({ phones: ['2625550111'] }), pool) as { lead: EngineLead }).lead.id, 'a');
  assert.equal((matchLead(probe({ name: 'Robert Jones', address: '55 Elm Street' }), pool) as { lead: EngineLead }).lead.id, 'b');
  // Phone and street point at different leads: ask.
  const split = matchLead(probe({ phones: ['2625550111'], address: '55 Elm St' }), pool);
  assert.equal(split.kind, 'review'); assert.deepEqual(split.kind === 'review' && split.candidates.map(c => c.id).sort(), ['a', 'b']);
  // Exact name but a different real phone: ask, do not link.
  const sam = matchLead(probe({ name: 'Sam Lee', phones: ['2625550999'] }), pool);
  assert.equal(sam.kind, 'review'); assert.match(sam.why, /same full name, but a different phone/);
  // Nickname with the same last name, and first name in the same town: ask.
  assert.equal(matchLead(probe({ name: 'Jenny Smith' }), pool).kind, 'review');
  assert.equal(matchLead(probe({ name: 'Jenny', town: 'Pleasant Prairie' }), pool).kind, 'review');
  assert.equal(matchLead(probe({ name: 'Jenny', town: 'Kenosha' }), pool).kind, 'new');
  // Same street, clearly someone else: ask.
  assert.equal(matchLead(probe({ name: 'Mary Jones', address: '812 Oak Ln' }), pool).kind, 'review');
  // A lead merged away is never matched.
  assert.equal(matchLead(probe({ phones: ['2625550144'] }), pool).kind, 'new');
});

/* ------------------------------ Reviews in planIngest ------------------------------ */

test('an unsure LSA lead is held as a review with its messages; nothing is added or linked', () => {
  const existing = [lead({ id: 'j', name: 'Jennifer Smith', phone: 'NP_9', address: '1 Main St' })];
  const plan = planIngest(existing, [lsa({ id: '300', name: 'Jenny Smith' })], [ev('1', 'customer', '2026-11-02T14:00:00.000Z', 'Hi', '300'), ev('2', 'us', '2026-11-02T14:05:00.000Z', 'Hello!', '300')], NOW);
  assert.equal(plan.created + plan.linked + plan.inserts.length + plan.updates.length, 0);
  assert.equal(plan.orphanEvents, 0); assert.equal(plan.reviews.length, 1);
  assert.deepEqual(plan.reviews[0].thread.map(e => e.id), ['1', '2']); assert.equal(plan.reviews[0].candidates[0].id, 'j');
  assert.equal(plan.matches[0].kind, 'review');

  // Still pending: a later message joins the stored review (status read is kept for the safe update).
  const stored: LeadReview = { ...plan.reviews[0], id: 'r1', status: 'pending' };
  const later = planIngest(existing, [], [ev('3', 'customer', '2026-11-03T14:00:00.000Z', 'Any update?', '300')], NOW, { reviews: [stored] });
  assert.equal(later.orphanEvents, 0); assert.equal(later.reviews[0].id, 'r1'); assert.equal(later.reviews[0].was, 'pending');
  assert.deepEqual(later.reviews[0].thread.map(e => e.id), ['1', '2', '3']);
});

test('Merge links into the chosen lead and fills only empty fields; Keep separate adds a lead never matched to the candidates', () => {
  const jen = lead({ id: 'j', name: 'Jennifer Smith', phone: 'NP_9', address: '1 Main St', status: 'completed', notes: 'great customer', quote_amount: 400, manually_updated_fields: ['status'] });
  const review: LeadReview = { id: 'r1', lsa_lead_id: '300', lead: lsa({ id: '300', name: 'Jenny Smith', type: 'PHONE_CALL', phone: '262-555-0300' }), thread: [ev('1', 'customer', '2026-11-02T14:00:00.000Z', 'Call me back', '300')], candidates: [{ id: 'j', name: 'Jennifer Smith', phone: null, address: '1 Main St', why: 'x' }], reason: 'x', status: 'merge', merge_into: 'j' };
  const merged = planIngest([jen], [], [], NOW, { reviews: [review] });
  assert.equal(merged.linked, 1); assert.deepEqual(merged.resolved, [{ lsa_lead_id: '300', was: 'merge' }]);
  const patch = merged.updates[0].patch;
  assert.equal(patch.lsa_lead_id, '300'); assert.equal(patch.phone, '+12625550300');
  for (const kept of ['name', 'address', 'status', 'notes', 'quote_amount', 'scheduled_on']) assert.equal(kept in patch, false, kept);
  assert.equal((patch.thread as ThreadEvent[]).length, 1);

  const separate = planIngest([jen], [], [], NOW, { reviews: [{ ...review, status: 'separate', merge_into: null }] });
  assert.equal(separate.created, 1); assert.deepEqual((separate.inserts[0].lsa as { separateFrom: string[] }).separateFrom, ['j']);
  // The sheet archive never merges a lead kept separate.
  const row = { ...separate.inserts[0], id: 'n1' } as unknown as EngineLead & Record<string, unknown>;
  assert.equal(planSheetArchive([jen as EngineLead & Record<string, unknown>, row], new Date(NOW)).merges.length, 0);
});

test('the sheet archive fills only empty fields, reports differences, keeps a lead in Needs Reply active, and archives the duplicate', () => {
  const now = new Date(NOW);
  const sheet = lead({ id: 's', name: 'Bob', phone: 'na', address: '55 Elm St', service_requested: 'Unknown', status: 'contacted', notes: 'keep' });
  const dup = lead({ id: 'd', name: 'Robert Jones', phone: '+12625550155', address: '55 Elm Street, Kenosha', service_requested: 'House Washing', email: 'rj@example.com', lsa_lead_id: '400', notes: 'LSA lead #400 - message',
    last_customer_at: '2026-11-10T14:00:00.000Z', thread: [ev('1', 'customer', '2026-11-10T14:00:00.000Z', 'hi', '400')], lsa: { ids: ['400'], origin: 'sync' } as unknown as EngineLead['lsa'] });
  const plan = planSheetArchive([sheet, dup].map(r => r as EngineLead & Record<string, unknown>), now);
  assert.equal(plan.merges.length, 1);
  const m = plan.merges[0];
  assert.equal(m.patch.phone, '+12625550155'); assert.equal(m.patch.email, 'rj@example.com'); assert.equal(m.patch.service_requested, 'House Washing');
  assert.equal('name' in m.patch, false); assert.equal('address' in m.patch, false);
  assert.deepEqual(m.conflicts.map(c => c.field), ['name']);
  assert.equal(m.dupPatch.archived_at, NOW); assert.equal(m.dupPatch.revive_on, null); assert.deepEqual((m.dupPatch.lsa as { ids: string[] }).ids, []);
  assert.deepEqual(plan.keep.map(k => [k.lead.id, k.why]), [['s', 'Needs reply: the customer wrote last on Nov 10']]);
  // Answered (our reply is the last word): archived like any other sheet lead.
  const answered = planSheetArchive([sheet, { ...dup, last_ours_at: '2026-11-10T15:00:00.000Z' }].map(r => r as EngineLead & Record<string, unknown>), now);
  assert.deepEqual(answered.keep, []);
});

test('Merge follows a lead merged away since; a Merge whose lead is gone is asked again, never added as new', () => {
  const live = lead({ id: 's', name: 'Jennifer Smith', phone: 'NP_1' });
  const gone = lead({ id: 'd', name: 'Jen', phone: 'NP_2', archived_at: NOW, lsa: { ids: [], origin: 'sync', mergedInto: 's' } as unknown as EngineLead['lsa'] });
  const review: LeadReview = { id: 'r1', lsa_lead_id: '600', lead: lsa({ id: '600', name: 'Jenny Smith' }), thread: [ev('1', 'customer', '2026-11-02T14:00:00.000Z', 'hi', '600')], candidates: [{ id: 'd', name: 'Jen', phone: null, address: null, why: 'x' }], reason: 'x', status: 'merge', merge_into: 'd' };
  const followed = planIngest([live, gone], [], [], NOW, { reviews: [review] });
  assert.equal(followed.updates[0].id, 's'); assert.equal(followed.updates[0].patch.lsa_lead_id, '600');
  const missing = planIngest([live], [], [], NOW, { reviews: [{ ...review, merge_into: 'x' }] });
  assert.equal(missing.created + missing.linked, 0); assert.deepEqual(missing.resolved, []);
  assert.equal(missing.reviews[0].status, 'pending'); assert.equal(missing.reviews[0].was, 'merge'); assert.equal(missing.reviews[0].thread.length, 1);
});

test('an old thread linked onto a hand-entered lead shows, but its old follow-ups neither count nor make the lead Dead', () => {
  const sheet = lead({ id: 's', name: 'Ann Lee', phone: '+12625550123', status: 'following_up', quote_amount: 450 });
  const old = [ev('1', 'customer', '2025-06-01T14:00:00.000Z', 'Quote please', '700'), ...[2, 3, 4, 5, 6].map(d => ev(`u${d}`, 'us', `2025-06-0${d}T14:00:00.000Z`, `Following up ${d}`, '700'))];
  const plan = planIngest([sheet], [lsa({ id: '700', type: 'PHONE_CALL', phone: '2625550123', createdAt: '2025-06-01T13:00:00.000Z' })], old, NOW, { backfill: true });
  const patch = plan.updates[0].patch;
  assert.equal(plan.linked, 1); assert.equal((patch.thread as ThreadEvent[]).length, 6);
  for (const k of ['archived_at', 'dead_reason', 'attempts', 'status']) assert.equal(k in patch, false, k);
  assert.equal(patch.stage, 'quoted');
});

/* ------------------------------ The rehearsal (in-memory copy) ------------------------------ */

test('the rehearsal runs the real backfill and sheet archive on an in-memory copy: nothing deleted, nothing overwritten', async () => {
  const snapshot = [
    { id: 'b1000000-0000-4000-8000-000000000001', name: 'Pat Doe', phone: '+12625550111', address: '55 Elm St', service_requested: 'House wash', quote_amount: 300, status: 'completed', notes: 'repeat', source: 'DTD', created_at: '2026-05-01T15:00:00+00:00', updated_at: '2026-06-01T15:00:00+00:00', job_cost: null, job_revenue: 300, manually_updated_fields: ['status'], completed_at: null },
    { id: 'b1000000-0000-4000-8000-000000000002', name: 'Jennifer Smith', phone: 'NP_17_1', address: '812 Oak Ln', service_requested: null, quote_amount: null, status: 'contacted', notes: null, source: 'DTD', created_at: '2026-06-01T15:00:00+00:00', updated_at: '2026-06-01T15:00:00+00:00', job_cost: null, job_revenue: null, manually_updated_fields: [], completed_at: null },
    { id: 'b1000000-0000-4000-8000-000000000003', name: 'Bob', phone: 'na', address: 'na', service_requested: null, quote_amount: null, status: 'closed', notes: 'ghosted', source: 'DTD', created_at: '2026-06-02T15:00:00+00:00', updated_at: '2026-06-02T15:00:00+00:00', job_cost: null, job_revenue: null, manually_updated_fields: [], completed_at: null },
  ];
  const pg = await rehearsalCopy(snapshot);
  const db = supabaseLike(pg);
  const before = await allRows(pg, 'leads');
  const now = new Date('2026-11-11T18:00:00.000Z');
  const month = {
    leads: [lsa({ id: '501', type: 'PHONE_CALL', phone: '262.555.0111', createdAt: '2026-11-03T15:00:00.000Z' }), lsa({ id: '502', name: 'Jenny Smith', createdAt: '2026-11-09T15:00:00.000Z' }), lsa({ id: '503', name: 'Sam Lee', createdAt: '2026-11-10T15:00:00.000Z' })],
    events: [ev('e1', 'customer', '2026-11-09T15:00:00.000Z', 'Can you wash my house at 812 Oak Lane?', '502'), ev('e2', 'customer', '2026-11-10T15:00:00.000Z', 'Need gutters done at 900 Pine St, Kenosha', '503'), ev('e3', 'us', '2026-11-10T16:00:00.000Z', 'Sure, $180 for the gutters', '503')],
  };
  await runBackfill(db, ORG, async m => m === '2026-11' ? month : { leads: [], events: [] }, () => {}, { now });
  await applySheetArchive(db, planSheetArchive(await readLeads(db, '*'), now), now);
  const after = new Map((await allRows(pg, 'leads')).map(r => [r.id, r]));
  assert.equal(after.size, 4); // one new lead (Sam Lee); nothing deleted
  for (const was of before) {
    const now_ = after.get(was.id)!;
    for (const k of Object.keys(snapshot[0])) if (k !== 'updated_at' && JSON.stringify(was[k]) !== JSON.stringify(now_[k])) assert.ok(was[k] === null || /^(NP_|na$)/.test(String(was[k])), `${was.name} ${k} overwritten`);
  }
  const pat = after.get(snapshot[0].id)!, jen = after.get(snapshot[1].id)!, bob = after.get(snapshot[2].id)!;
  assert.equal(pat.lsa_lead_id, '501'); assert.equal(pat.status, 'completed'); assert.ok(pat.archived_at);
  assert.equal(jen.lsa_lead_id, '502'); assert.equal(jen.name, 'Jennifer Smith'); assert.equal(jen.archived_at, null);
  assert.equal(bob.stage, 'dead'); assert.equal(bob.status, 'closed'); assert.equal(bob.notes, 'ghosted');
  const sam = [...after.values()].find(r => r.lsa_lead_id === '503')!;
  assert.equal(sam.address, '900 Pine St, Kenosha'); assert.equal(sam.stage, 'contacted');
  await pg.close();
});

test('the snapshot reader unwraps json_agg and refuses a snapshot that already has engine columns', async () => {
  const { mkdtempSync, writeFileSync, rmSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');
  const dir = mkdtempSync(join(tmpdir(), 'oj-snap-'));
  try {
    const rows = [{ id: 'x', name: 'A' }];
    for (const shape of [rows, [{ json_agg: rows }], { json_agg: rows }, JSON.stringify(rows), [{ json_agg: JSON.stringify(rows) }]]) {
      writeFileSync(join(dir, 's.json'), JSON.stringify(shape));
      assert.deepEqual(readSnapshot(join(dir, 's.json')), rows);
    }
    writeFileSync(join(dir, 's.json'), JSON.stringify([{ id: 'x', stage: 'new' }]));
    assert.throws(() => readSnapshot(join(dir, 's.json')), /already has lead engine columns/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* ------------------------------ Session 4: Jacob's six fixes ------------------------------ */

const call = (id: string, who: ThreadEvent['who'], at: string, seconds?: number, lsaId = '111'): ThreadEvent => ({ id, lsa: lsaId, at, who, channel: 'PHONE_CALL', ...(seconds ? { seconds } : {}) });

test('overrides force the link a person chose (backfill only), follow a merged lead, and fall back to matching when the lead is gone', () => {
  const company = lead({ id: 'c0000000-0000-4000-8000-000000000001', name: 'Acme Roller Company', phone: '+16105550100', address: '120 9th Avenue, Union Grove, WI 53182', status: 'booked' });
  const jen = lsa({ id: '347', name: 'Jane Roe' });
  const thread = [ev('1', 'customer', '2026-11-02T14:00:00.000Z', 'Direct: 262-555-0123. 100 9th Avenue, Union Grove', '347')];
  const plain = planIngest([company], [jen], thread, NOW, { backfill: true });
  assert.notEqual(plain.matches[0].kind, 'link'); // a different phone and name: never linked on its own
  const forced = planIngest([company], [jen], thread, NOW, { backfill: true, overrides: [{ lsa_lead_id: '347', lead_id: company.id, why: 'Jane works there' }] });
  assert.equal(forced.matches[0].kind, 'override'); assert.equal(forced.created, 0); assert.equal(forced.linked, 1);
  const patch = forced.updates[0].patch;
  assert.equal(patch.lsa_lead_id, '347'); assert.equal((patch.thread as ThreadEvent[]).length, 1);
  for (const kept of ['name', 'phone', 'address', 'status']) assert.equal(kept in patch, false, kept);
  // The chosen lead was merged away since: the override follows it.
  const gone = lead({ id: 'd0000000-0000-4000-8000-000000000002', name: 'Old', lsa: { ids: [], origin: 'sync', mergedInto: company.id } as unknown as EngineLead['lsa'] });
  assert.equal(planIngest([company, gone], [jen], thread, NOW, { overrides: [{ lsa_lead_id: '347', lead_id: gone.id, why: 'x' }] }).updates[0].id, company.id);
  // No such lead: matched as usual, and the report says so.
  const missing = planIngest([company], [jen], thread, NOW, { overrides: [{ lsa_lead_id: '347', lead_id: 'e0000000-0000-4000-8000-000000000003', why: 'x' }] });
  assert.notEqual(missing.matches[0].kind, 'override'); assert.match(missing.matches[0].why, /not here/);
  // A pending review the overrides file settles is linked, with the messages it held, and marked done.
  const review: LeadReview = { id: 'r', lsa_lead_id: '347', lead: jen, thread, candidates: [], reason: 'x', status: 'pending', merge_into: null };
  const settled = planIngest([company], [], [], NOW, { reviews: [review], overrides: [{ lsa_lead_id: '347', lead_id: company.id, why: 'x' }] });
  assert.equal(settled.matches[0].kind, 'override'); assert.deepEqual(settled.resolved, [{ lsa_lead_id: '347', was: 'pending' }]);
  assert.equal((settled.updates[0].patch.thread as ThreadEvent[]).length, 1);
});

test('the overrides file: missing means none, a wrong one stops the backfill', () => {
  const dir = mkdtempSync(join(tmpdir(), 'oj-ovr-'));
  try {
    assert.deepEqual(readOverrides(join(dir, 'none.json')), []);
    const file = join(dir, 'o.json');
    writeFileSync(file, JSON.stringify({ note: 'n', links: [{ lsa_lead_id: '300000001', lead_id: 'ABCDEF12-0000-4000-8000-000000000001', why: 'works there' }] }));
    assert.deepEqual(readOverrides(file), [{ lsa_lead_id: '300000001', lead_id: 'abcdef12-0000-4000-8000-000000000001', why: 'works there' }]);
    writeFileSync(file, JSON.stringify({ links: [{ lsa_lead_id: '300000001', lead_id: 'abcdef12' }] }));
    assert.throws(() => readOverrides(file), /full lead id/);
    writeFileSync(file, '{ not json');
    assert.throws(() => readOverrides(file), /not valid JSON/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('the matcher uses every address the customer wrote, and a work email at the company counts as a fitting name', () => {
  const company = lead({ id: 'c', name: 'Acme Roller Company', phone: 'NP_1', address: '120 9th Avenue, Union Grove, WI 53182' });
  const probe = { name: 'Jane Roe', phones: [], email: null, address: '100 9th Avenue, Union Grove', addresses: ['100 9th Avenue, Union Grove', '120 9th Avenue, Union Grove'], town: 'Union Grove' };
  // The second address is the company's: strong, but another person's name and nothing else: asked, not linked.
  const street = matchLead(probe, [company]);
  assert.equal(street.kind, 'review'); assert.match(street.why, /same street address/); assert.doesNotMatch(street.why, /different street/);
  // With her work email the name is no conflict: linked.
  const both = matchLead({ ...probe, email: 'jane.roe@acmeroller.com' }, [company]);
  assert.equal(both.kind, 'link'); assert.match(both.why, /email domain matches the company name/);
  // A street conflict only when none of the addresses match.
  const none = matchLead({ ...probe, address: '9 Elm St', addresses: ['9 Elm St'] }, [company]);
  assert.equal(none.kind, 'new');
  assert.equal(emailFitsName('jane.roe@acmeroller.com', 'Acme Roller Company'), true);
  assert.equal(emailFitsName('mdoe@northfieldaviation.com', 'Northfield Aviation / Lakeside Airfield'), true);
  assert.equal(emailFitsName('pat@gmail.com', 'Gmail Services Inc'), false);
  assert.equal(emailFitsName('jo@abc.com', 'ABC Co'), false); // too short to be sure
  assert.equal(emailFitsName('jo@smithpainting.com', 'Pat Doe'), false);
});

test('Needs Reply: only the last 14 days; a call never puts a Scheduled, Won or Lost lead there; an answered call is a contact', () => {
  const now = new Date('2026-11-20T15:00:00Z');
  const waiting = lead({ stage: 'contacted', last_customer_at: '2026-11-10T15:00:00.000Z', last_ours_at: '2026-11-09T15:00:00.000Z', thread: [ev('1', 'customer', '2026-11-10T15:00:00.000Z', 'hi')] });
  assert.equal(needsReply(waiting, now), true);
  assert.equal(needsReply(waiting, new Date('2026-11-24T15:00:01Z')), false); // more than 14 days
  assert.equal(engineStats([waiting], now).needsReply, 1);
  const missed = { ...waiting, thread: [call('2', 'customer', '2026-11-10T15:00:00.000Z')] };
  assert.equal(needsReply(missed, now), true);
  for (const stage of ['scheduled', 'won', 'lost'] as const) {
    assert.equal(needsReply({ ...missed, stage }, now), false, stage);
    assert.equal(needsReply({ ...waiting, stage }, now), true, `${stage} message`);
  }
  // Answered: Google recorded a duration. New becomes Contacted, one attempt, and nobody is waiting.
  const fresh = lead({ stage: 'new', created_at: '2026-11-10T14:00:00.000Z', cycle_at: '2026-11-10T14:00:00.000Z' });
  const answered = { ...fresh, ...applyEvents(fresh, [call('3', 'customer', '2026-11-10T15:00:00.000Z', 95)]) } as EngineLead;
  assert.equal(answered.stage, 'contacted'); assert.equal(answered.attempts, 1); assert.equal(answered.last_ours_at, '2026-11-10T15:00:00.000Z');
  assert.equal(needsReply(answered, now), false);
  const unanswered = { ...fresh, ...applyEvents(fresh, [call('4', 'customer', '2026-11-10T15:00:00.000Z')]) } as EngineLead;
  assert.equal(unanswered.attempts, 0); assert.equal(needsReply(unanswered, now), true);
});

test('our messages within 60 minutes of the last counted one are one attempt; a customer message starts a new count', () => {
  const l = lead({ stage: 'new', cycle_at: '2026-11-02T13:00:00.000Z' });
  const burst = applyEvents(l, [ev('1', 'us', '2026-11-02T14:00:00.000Z', 'Hi!'), ev('2', 'us', '2026-11-02T14:30:00.000Z', 'Pics?'), ev('3', 'us', '2026-11-02T14:59:00.000Z', 'Price'), ev('4', 'us', '2026-11-02T15:05:00.000Z', 'Following up')]);
  assert.equal(burst.attempts, 2); assert.equal((burst.contact_log as unknown[]).length, 2); assert.equal(burst.last_ours_at, '2026-11-02T15:05:00.000Z');
  // A later sync: a message 20 minutes after the last counted one adds nothing.
  const after = { ...l, ...burst } as EngineLead;
  assert.equal(applyEvents(after, [ev('5', 'us', '2026-11-02T15:25:00.000Z', 'One more')]).attempts, 2);
  const reply = applyEvents(after, [ev('6', 'customer', '2026-11-02T15:10:00.000Z', 'ok'), ev('7', 'us', '2026-11-02T15:20:00.000Z', 'Great')]);
  assert.equal(reply.attempts, 1);
});

test('the backfill sends a customer-last thread older than 14 days to Spring Revival, not Dead; a new lead with no name gets a readable placeholder', () => {
  const now = '2026-11-12T15:00:00.000Z';
  const plan = planIngest([], [lsa({ id: '801', createdAt: '2026-10-20T14:00:00.000Z' }), lsa({ id: '802', type: 'PHONE_CALL', phone: null, createdAt: '2026-09-01T14:00:00.000Z' }), lsa({ id: '803', createdAt: '2026-11-05T14:00:00.000Z' })], [
    ev('a', 'us', '2026-10-20T14:05:00.000Z', 'Hi, how can we help?', '801'), ev('b', 'customer', '2026-10-21T14:00:00.000Z', 'Windows in Waukegan please', '801'),
    ev('c', 'customer', '2026-11-05T14:00:00.000Z', 'Hi this is Dana, need gutters', '803'),
  ], now, { backfill: true });
  const row = (id: string) => plan.inserts.find(r => r.lsa_lead_id === id)!;
  assert.equal(row('801').archived_at, now); assert.equal(row('801').revive_on, '2027-03-15'); assert.notEqual(row('801').stage, 'dead');
  assert.match(String(row('801').dead_reason), /Spring Revival/);
  assert.equal(row('801').name, 'LSA msg Oct 20 Waukegan');
  assert.equal(row('802').stage, 'dead'); assert.equal(row('802').name, 'LSA call Sep 1');
  assert.equal(row('803').archived_at, null); assert.equal(row('803').name, 'Dana');
  assert.equal(isBlank('name', 'LSA msg Oct 20 Waukegan'), true); assert.equal(isBlank('name', 'LSA call Sep 1'), true); assert.equal(isBlank('name', 'Lisa Call'), false);
  assert.equal(nameParts('LSA msg Oct 20 Waukegan'), null);
  // A real name replaces the placeholder later.
  const linked = planIngest([lead({ id: 'q', name: 'LSA call Sep 1', phone: '+12625550888' })], [lsa({ id: '900', type: 'PHONE_CALL', phone: '2625550888', name: 'Robin Hart' })], [], now);
  assert.equal(linked.updates[0].patch.name, 'Robin Hart');
});

test('Link to existing lead merges an LSA lead into any lead: fills only empty fields and keeps a sync lead a sync lead', () => {
  const target = lead({ id: 't', name: 'Northfield Aviation', phone: '+13125550996', address: '700 Hangar Rd, Waukegan', lsa: { ids: ['1'], origin: 'sync' } as unknown as EngineLead['lsa'], lsa_lead_id: '1' });
  const source = lead({ id: 's', name: 'Max Doe', phone: 'NP_LSA_2', email: 'm@northfieldaviation.com', lsa_lead_id: '2', lsa: { ids: ['2'], origin: 'sync' } as unknown as EngineLead['lsa'], thread: [ev('1', 'customer', '2026-11-02T14:00:00.000Z', 'hi', '2')] });
  const m = mergeLeads(target, source, 'Linked by hand', NOW);
  assert.equal(m.patch.email, 'm@northfieldaviation.com'); assert.equal('name' in m.patch, false); assert.equal('phone' in m.patch, false);
  assert.deepEqual((m.patch.lsa as { ids: string[] }).ids, ['1', '2']); assert.equal((m.patch.lsa as { origin: string }).origin, 'sync');
  assert.equal(m.patch.lsa_lead_id, '1'); assert.equal(m.dupPatch.lsa_lead_id, null); assert.equal((m.dupPatch.lsa as { mergedInto: string }).mergedInto, 't');
  assert.equal(m.dupPatch.stage, 'dead'); assert.ok(m.dupPatch.archived_at);
});

test('the dry run reads the baseline report: each LSA lead\'s Dead decision and the sheet leads kept active', () => {
  const text = ['[1] LSA #300000002 | 2026-07-17 | phone call | 1 conversation event (0 customer messages)',
    '    After: new lead "Unknown" (0000aaaa), stage dead, archived until 2027-03-15, Dead: No activity in the 30 days before the backfill',
    '[2] LSA #300000003 | 2026-07-22 | message | 24 conversation events (14 customer messages)',
    '    After: new lead "Ann" (0000bbbb), stage contacted, NEEDS REPLY',
    '  kept active: Bob (0000cccc), status completed: Next follow up 3/1/27'].join('\n');
  const base = readBaseline(text);
  assert.equal(base.lsa.get('300000002')!.dead, 'No activity in the 30 days before the backfill');
  assert.equal(base.lsa.get('300000003')!.dead, null);
  assert.deepEqual([...base.kept], ['0000cccc']);
});

test('review fixes: settled leads, booked leads in the backfill, linking into a hand-entered or archived lead, business emails, the --out guard', () => {
  // A Scheduled lead: an old unanswered message plus a recent missed call is not Needs Reply (the call alone never counts).
  const now = new Date('2026-11-20T15:00:00Z');
  const booked = lead({ stage: 'scheduled', last_ours_at: '2026-10-30T15:00:00.000Z', last_customer_at: '2026-11-18T15:00:00.000Z',
    thread: [ev('1', 'us', '2026-10-30T15:00:00.000Z', 'See you then'), ev('2', 'customer', '2026-10-31T15:00:00.000Z', 'Also gutters?'), call('3', 'customer', '2026-11-18T15:00:00.000Z')] });
  assert.equal(needsReply(booked, now), false);
  assert.equal(needsReply({ ...booked, thread: [...booked.thread, ev('4', 'customer', '2026-11-18T16:00:00.000Z', 'Hello?')], last_customer_at: '2026-11-18T16:00:00.000Z' }, now), true);

  // The backfill never archives or kills a booked LSA lead; a quiet one stays Scheduled.
  const plan = planIngest([], [lsa({ id: '910', status: 'BOOKED', createdAt: '2026-09-15T14:00:00.000Z' })],
    [ev('a', 'us', '2026-09-20T14:00:00.000Z', 'Booked for Friday', '910'), ev('b', 'customer', '2026-10-01T14:00:00.000Z', 'Can you also do the gutters?', '910')], '2026-11-12T15:00:00.000Z', { backfill: true });
  assert.equal(plan.inserts[0].stage, 'scheduled'); assert.equal(plan.inserts[0].archived_at, null); assert.equal(plan.inserts[0].status, 'booked');

  // Linking into a lead someone entered keeps its own follow-up count, so the LSA lead's old attempts never make it Dead.
  const handEntered = lead({ id: 'h', name: 'Ann Lee', stage: 'contacted', attempts: 0, contact_log: [], cycle_at: '2026-11-01T15:00:00.000Z' });
  const lsaDup = lead({ id: 'x', name: 'LSA msg Nov 1', phone: 'NP_LSA_920', lsa_lead_id: '920', attempts: 3, cycle_at: '2026-11-02T15:00:00.000Z', last_ours_at: '2026-11-06T15:00:00.000Z',
    contact_log: [{ at: '2026-11-02T15:00:00.000Z', via: 'lsa' }, { at: '2026-11-03T15:00:00.000Z', via: 'lsa' }, { at: '2026-11-06T15:00:00.000Z', via: 'lsa' }], lsa: { ids: ['920'], origin: 'sync' } as unknown as EngineLead['lsa'] });
  const kept = mergeLeads(handEntered, lsaDup, 'Linked by hand', NOW).patch;
  assert.equal(kept.attempts, 0); assert.deepEqual(kept.contact_log, []); assert.equal(kept.cycle_at, '2026-11-01T15:00:00.000Z');
  // Linking into an archived lead the customer wrote to after it was archived brings it back.
  const archived = lead({ id: 'g', name: 'Gone Gus', stage: 'dead', archived_at: '2026-10-01T00:00:00.000Z', revive_on: '2027-03-15', dead_reason: 'x', quoted_at: '2026-09-01T15:00:00.000Z' });
  const back = mergeLeads(archived, { ...lsaDup, last_customer_at: '2026-11-05T15:00:00.000Z' }, 'Linked by hand', NOW).patch;
  assert.equal(back.archived_at, null); assert.equal(back.revive_on, null); assert.equal(back.stage, 'quoted');
  assert.equal('archived_at' in mergeLeads(archived, { ...lsaDup, last_customer_at: '2026-09-05T15:00:00.000Z' }, 'x', NOW).patch, false);

  // A work email only fits a business name, never a person's.
  assert.equal(emailFitsName('x@johnsmithhomes.com', 'John Smith'), false);
  assert.equal(emailFitsName('x@acmeroller.com', 'Acme Roller'), false); // two words, could be a person: no
  assert.equal(emailFitsName('x@acmeroller.com', 'Acme Roller Co'), true);

  // A Google name later replaces the placeholder on a lead already holding that LSA lead.
  const holder = lead({ id: 'p', name: 'LSA call Sep 1', lsa_lead_id: '930', lsa: { ids: ['930'], origin: 'sync' } as unknown as EngineLead['lsa'] });
  assert.equal(planIngest([holder], [lsa({ id: '930', type: 'PHONE_CALL', name: 'Robin Hart' })], [], NOW).updates[0].patch.name, 'Robin Hart');
  assert.equal('name' in planIngest([{ ...holder, manually_updated_fields: ['name'] }], [lsa({ id: '930', name: 'Robin Hart' })], [], NOW).updates[0].patch, false);

  // The report file must be outside the repo.
  const root = join(tmpdir(), 'repo');
  assert.equal(insideRepo(join(root, '..x.txt'), root), true);
  assert.equal(insideRepo(join(root, 'sub', 'r.txt'), root), true);
  assert.equal(insideRepo(join(root, '..', 'r.txt'), root), false);
});

test('the live sync adds nothing and never reads Google until the one-time backfill has finished', async () => {
  const pg = await rehearsalCopy([{ id: 'b2000000-0000-4000-8000-000000000001', name: 'Pat Doe', phone: '+12625550111', address: '55 Elm St', service_requested: null, quote_amount: null, status: 'new', notes: null, source: 'DTD', created_at: '2026-05-01T15:00:00+00:00', updated_at: '2026-05-01T15:00:00+00:00', manually_updated_fields: [] }]);
  const db = supabaseLike(pg);
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => { calls++; throw new Error('no network in this test'); }) as typeof fetch;
  try {
    const r = await syncLsa(db, ORG, 'manual');
    assert.equal(r.ok, false); assert.equal(!r.ok && r.kind, 'setup'); assert.match(!r.ok ? r.message : '', /npm run lsa -- backfill/);
    assert.equal(calls, 0);
    assert.equal((await allRows(pg, 'leads')).length, 1);
    const state = (await pg.query<{ error_kind: string; lead_checkpoint: string | null }>('select error_kind, lead_checkpoint from public.oj_lsa_sync')).rows[0];
    assert.equal(state.error_kind, 'setup'); assert.equal(state.lead_checkpoint, null);
  } finally { globalThis.fetch = real; await pg.close(); }
});
