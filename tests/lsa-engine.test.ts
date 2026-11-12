import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { createVerify, generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { confirms, extractLeadFields, findAddresses, findAmounts, findDates, serviceFor } from '../src/lib/lead-extract';
import { applyEvents, autoDeadReason, bucket, dueDay, fromChicago, manualContact, needsReply, planIngest, planSheetArchive, stageAction, type EngineLead, type LsaLead, type ThreadEvent } from '../src/lib/lead-pipeline';
import { accessToken, googleConfig, LsaApi, LsaError, serviceAccount, toEvent, toLead } from '../src/lib/lsa-sync';

const lead = (over: Partial<EngineLead> = {}): EngineLead => ({
  id: over.id ?? 'a0000000-0000-4000-8000-000000000001', name: 'Pat Doe', phone: '+12625550100', email: null, address: null, service_requested: null, quote_amount: null,
  status: 'new', source: 'dtd', notes: null, created_at: '2026-10-01T15:00:00.000Z', updated_at: null, manually_updated_fields: [], lsa_lead_id: null, lsa: null,
  proxy_phone: null, stage: null, stage_at: null, attempts: 0, contact_log: [], thread: [], cycle_at: null, last_customer_at: null, last_ours_at: null, quoted_at: null,
  scheduled_on: null, dead_reason: null, archived_at: null, revive_on: null, original_status: null, dispute: false, auto_fields: [], ...over,
});
const lsa = (over: Partial<LsaLead> = {}): LsaLead => ({
  id: '111', type: 'MESSAGE', category: 'xcat:service_area_business_pressure_washer', service: null, status: 'NEW', charged: true, credit: null, creditAt: null,
  locale: 'en', createdAt: '2026-11-02T14:00:00.000Z', name: null, phone: '+1 (262) 555-0199 ext. 1234', email: null, note: null, feedback: null, ...over,
});
const ev = (id: string, who: ThreadEvent['who'], at: string, text?: string, lsaId = '111'): ThreadEvent => ({ id, lsa: lsaId, at, who, channel: 'MESSAGE', ...(text ? { text } : {}) });

test('the extractor finds address, phone, email, name and service, says which line each came from, and skips look-alikes', () => {
  const found = extractLeadFields({ messages: ['Hi, my name is Sarah Lopez. Can you wash my house at 4521 22nd Ave, Kenosha WI 53140? Call 262-555-0142 or sarah.l@example.com'] });
  assert.deepEqual(found.fields, { address: '4521 22nd Ave, Kenosha, WI 53140', phone: '+12625550142', email: 'sarah.l@example.com', name: 'Sarah Lopez', service: 'House Washing' });
  assert.equal(found.from.name, 'Hi, my name is Sarah Lopez.');
  const address = (text: string) => extractLeadFields({ messages: [text] }).fields.address;
  assert.equal(address('I have 15 windows by the way'), undefined);
  assert.equal(address('Can you come at 10 AM'), undefined);
  assert.equal(address('I have 2 Windows, Kenosha'), undefined);
  assert.equal(address('123 Main St'), '123 Main St');
  assert.equal(address("We're at S94W23640 Kunzendorf Ct, Mukwonago"), 'S94W23640 Kunzendorf Ct, Mukwonago');
  assert.equal(address('Address N12W34567 Hillside please'), 'N12W34567 Hillside');
  assert.equal(address('my address is 1234 Sheridan'), '1234 Sheridan');
  assert.equal(address('1234 Sheridan Kenosha WI'), '1234 Sheridan, Kenosha, WI');
  // A number with no street name after it is never saved cut off; a lone direction letter is not a street name.
  assert.equal(address('12345 W.'), undefined);
  assert.equal(address('My address is 12345 W'), undefined);
  assert.equal(address('We are at 123 N St'), undefined);
  assert.equal(address('My address is 12345 W. Main St, Kenosha'), '12345 W. Main St, Kenosha');
  assert.equal(address('My address is 12345 W. Thanks!'), undefined);
  assert.equal(address("I'm at 12345 W. Can you come Tuesday?"), undefined);
  assert.equal(address('123 O’Brien Ct, Kenosha'), '123 O’Brien Ct, Kenosha');
  assert.equal(address('123 1/2 Main St'), '123 1/2 Main St');
  assert.deepEqual(findAddresses('100 Main St, Kenosha, WI 2200 Oak St, Racine').map(a => a.value), ['100 Main St, Kenosha, WI', '2200 Oak St, Racine']);
  assert.equal(address('The home is at 512 Elm Ave, Gurnee.'), '512 Elm Ave, Gurnee');
  assert.deepEqual(findAddresses('100 9th Avenue, Union Grove, WI 53182 (Shop) 120 9th Avenue, Union Grove, WI 53182 (Office)').map(a => a.value),
    ['100 9th Avenue, Union Grove, WI 53182', '120 9th Avenue, Union Grove, WI 53182']);
  assert.equal(extractLeadFields({ messages: ["I'm looking for a quote"] }).fields.name, undefined);
  const flagged = extractLeadFields({ messages: ['Hi this is Kenosha Window Pros calling back'] });
  assert.equal(flagged.fields.name, undefined); assert.equal(flagged.flagged[0].why, 'a place, not a person');
  assert.equal(extractLeadFields({ messages: ['This is Oscar'] }).flagged[0].why, 'one of our own names');
});

test("the service comes from Google's service id, then the customer's words, then the category; a call with no id is Unknown", () => {
  const category = 'xcat:service_area_business_window_cleaner';
  assert.deepEqual(serviceFor({ serviceId: 'power_pressure_washing', category, type: 'MESSAGE', messages: ['windows please'] }), { service: 'Pressure Washing', from: 'service_id' });
  assert.deepEqual(serviceFor({ serviceId: 'window_cleaning', category, type: 'PHONE_CALL', messages: [] }), { service: 'Window Cleaning', from: 'service_id' });
  assert.deepEqual(serviceFor({ serviceId: null, category, type: 'PHONE_CALL', messages: [] }), { service: 'Unknown', from: 'none' });
  assert.deepEqual(serviceFor({ serviceId: null, category, type: 'MESSAGE', messages: ['Can you clean my gutters?'] }), { service: 'Gutter Cleaning', from: 'message' });
  assert.deepEqual(serviceFor({ serviceId: null, category, type: 'MESSAGE', messages: ['Hi, are you free next week?'] }), { service: 'Window Cleaning', from: 'category' });
});

test('quote amounts skip discounts, minimums and deposits; dates and confirmations are read from the day sent', () => {
  assert.deepEqual(findAmounts('Total would be $600 for the house and $150 for gutters. We take a $100 deposit and give $50 off for seniors. Minimum $120.').map(a => a.amount), [600, 150]);
  assert.deepEqual(findAmounts('That comes to 1,250 dollars').map(a => a.amount), [1250]);
  assert.deepEqual(findDates('How about 11/18?', '2026-11-11'), ['2026-11-18']);
  assert.deepEqual(findDates('We can do Tuesday', '2026-11-11'), ['2026-11-17']);
  assert.deepEqual(findDates('Tuesday the 17th works?', '2026-11-11'), ['2026-11-17']);
  assert.deepEqual(findDates('the 5th', '2026-11-11'), ['2026-12-05']);
  assert.deepEqual(findDates('tomorrow morning', '2026-11-11'), ['2026-11-12']);
  assert.equal(confirms('Yes Tuesday works'), true); assert.equal(confirms("No, Tuesday doesn't work"), false); assert.equal(confirms('Sounds good!'), true);
});

test('Google date-times are read as Chicago time', () => {
  assert.equal(fromChicago('2026-11-02 14:00:00'), '2026-11-02T20:00:00.000Z');
  assert.equal(fromChicago('2026-07-01 14:00:00'), '2026-07-01T19:00:00.000Z');
  assert.equal(fromChicago('2026-07-01 14:00:00-05:00'), '2026-07-01T19:00:00.000Z');
  assert.equal(fromChicago('not a date'), null);
});

test('API rows flatten into leads and thread events', () => {
  const l = toLead({ localServicesLead: { id: '987', leadType: 'PHONE_CALL', creationDateTime: '2026-11-02 09:00:00', contactDetails: { consumerName: ' Ann ', phoneNumber: '+12625550111', email: 'A@X.COM' }, leadCharged: false } });
  assert.equal(l?.name, 'Ann'); assert.equal(l?.email, 'a@x.com'); assert.equal(l?.charged, false); assert.equal(l?.createdAt, '2026-11-02T15:00:00.000Z');
  const e = toEvent({ localServicesLeadConversation: { id: '5', lead: 'customers/9016334601/localServicesLeads/987', participantType: 'CONSUMER', conversationChannel: 'PHONE_CALL', eventDateTime: '2026-11-02 09:01:00', phoneCallDetails: { callDurationMillis: '65000', callRecordingUrl: 'https://rec' } } });
  assert.deepEqual(e, { id: '5', lsa: '987', at: '2026-11-02T15:01:00.000Z', who: 'customer', channel: 'PHONE_CALL', seconds: 65, recording: 'https://rec' });
});

test('a new message lead keeps the proxy number apart, counts our replies and fills empty fields tagged auto', () => {
  const plan = planIngest([], [lsa()], [
    ev('1', 'customer', '2026-11-02T14:00:00.000Z', 'Need my gutters cleaned at 812 Oak Ln, Pleasant Prairie'),
    ev('2', 'us', '2026-11-02T14:10:00.000Z', 'Thanks! We can quote that.'),
    ev('2', 'us', '2026-11-02T14:10:00.000Z', 'Thanks! We can quote that.'),
  ], '2026-11-02T15:00:00.000Z');
  assert.equal(plan.created, 1);
  const row = plan.inserts[0];
  assert.equal(row.phone, 'NP_LSA_111'); assert.equal(row.proxy_phone, '+1 (262) 555-0199 ext. 1234');
  assert.equal(row.lsa_lead_id, '111'); assert.match(String(row.notes), /^LSA lead #111/);
  assert.equal(row.stage, 'contacted'); assert.equal(row.attempts, 1); assert.equal((row.thread as unknown[]).length, 2);
  assert.equal(row.address, '812 Oak Ln, Pleasant Prairie'); assert.equal(row.service_requested, 'Gutter Cleaning');
  assert.deepEqual(row.auto_fields, ['address', 'service_requested']);
  assert.equal(row.name, 'LSA msg Nov 2 Pleasant Prairie');
});

test('an existing lead is linked by phone or by one exact name, never duplicated, and hand edits win', () => {
  const byPhone = lead({ id: 'p', phone: '+12625550111', address: 'typed by hand', manually_updated_fields: ['address'] });
  const plan = planIngest([byPhone], [lsa({ id: '222', type: 'PHONE_CALL', phone: '262.555.0111' })], [ev('9', 'customer', '2026-11-02T14:05:00.000Z', 'Address is 55 Elm St', '222')], '2026-11-02T15:00:00.000Z');
  assert.equal(plan.created, 0); assert.equal(plan.linked, 1);
  const patch = plan.updates[0].patch;
  assert.equal(patch.lsa_lead_id, '222'); assert.equal(patch.address, undefined);
  assert.equal(needsReply({ ...byPhone, ...patch } as EngineLead, new Date('2026-11-02T15:00:00.000Z')), true);

  // Two leads with that exact name: nobody is linked or added; it waits for Merge or Keep separate.
  const twins = [lead({ id: 'x', name: 'Sam Lee', phone: 'NP_1' }), lead({ id: 'y', name: 'sam  lee', phone: 'NP_2' })];
  const unsure = planIngest(twins, [lsa({ name: 'Sam Lee' })], [], '2026-11-02T15:00:00.000Z');
  assert.equal(unsure.created + unsure.linked, 0); assert.deepEqual(unsure.reviews[0].candidates.map(c => c.id), ['x', 'y']);
  const single = planIngest([lead({ id: 'z', name: 'Sam Lee', phone: 'NP_3' })], [lsa({ name: 'Sam Lee' })], [], '2026-11-02T15:00:00.000Z');
  assert.equal(single.linked, 1); assert.equal(single.created, 0);

  const already = lead({ id: 'k', lsa_lead_id: '111', stage: 'new' });
  const again = planIngest([already], [lsa()], [], '2026-11-02T15:00:00.000Z');
  assert.equal(again.created + again.linked, 0); assert.equal(again.updates[0].id, 'k');
});

test('follow-ups fall on day 0, 1 and 3; the 3rd unanswered for 2 days is Dead; contact past the max is Dead with a reason', () => {
  const l = lead({ stage: 'contacted', attempts: 1, cycle_at: '2026-11-02T14:00:00.000Z', contact_log: [{ at: '2026-11-02T15:00:00.000Z', via: 'manual' }], last_ours_at: '2026-11-02T15:00:00.000Z' });
  assert.equal(dueDay(l), '2026-11-03');
  assert.equal(bucket(l, new Date('2026-11-04T15:00:00Z')), 'overdue');
  const third = { ...l, attempts: 3, contact_log: [...l.contact_log, { at: '2026-11-03T15:00:00.000Z', via: 'manual' as const }, { at: '2026-11-05T15:00:00.000Z', via: 'manual' as const }], last_ours_at: '2026-11-05T15:00:00.000Z' };
  assert.equal(dueDay(third), null);
  assert.equal(autoDeadReason(third, new Date('2026-11-06T15:00:00Z')), null);
  assert.match(autoDeadReason(third, new Date('2026-11-07T15:00:01Z')) ?? '', /No reply 2 days after attempt 3 of 3/);
  const past = manualContact(third, '2026-11-06T12:00:00.000Z');
  assert.equal(past.stage, 'dead'); assert.equal(past.revive_on, '2027-03-15'); assert.match(String(past.dead_reason), /attempt 4 of 3/);
});

test('quotes follow up on day 1, 3, 7 and 14; a customer message resets the count and revives a Dead lead', () => {
  const quoted = { ...lead({ stage: 'contacted' }), ...stageAction(lead({ stage: 'contacted' }), 'quoted', '2026-11-02T15:00:00.000Z', 450) } as EngineLead;
  assert.equal(quoted.quote_amount, 450); assert.equal(dueDay(quoted), '2026-11-03');
  assert.equal(dueDay({ ...quoted, attempts: 2 }), '2026-11-09');
  assert.equal(dueDay({ ...quoted, attempts: 3 }), '2026-11-16');
  assert.equal(dueDay({ ...quoted, attempts: 4 }), null);
  const dead = lead({ stage: 'dead', attempts: 4, quoted_at: '2026-11-02T15:00:00.000Z', archived_at: '2026-11-20T00:00:00.000Z', revive_on: '2027-03-15', dead_reason: 'x' });
  const revived = { ...dead, ...applyEvents(dead, [ev('7', 'customer', '2026-11-21T10:00:00.000Z', 'Still interested?')]) } as EngineLead;
  assert.equal(revived.stage, 'quoted'); assert.equal(revived.attempts, 0); assert.equal(revived.archived_at, null); assert.equal(revived.dead_reason, null);
  assert.equal(needsReply(revived, new Date('2026-11-21T12:00:00Z')), true); assert.equal(bucket(revived, new Date('2026-11-21T12:00:00Z')), 'reply');
});

test('backfill makes leads quiet for 30 days Dead and archived', () => {
  const plan = planIngest([], [lsa({ createdAt: '2026-08-01T14:00:00.000Z' })], [], '2026-11-02T15:00:00.000Z', { backfill: true });
  assert.equal(plan.inserts[0].stage, 'dead'); assert.equal(plan.inserts[0].revive_on, '2027-03-15');
});

test('the sheet archive keeps only Scheduled and follow-ups within 30 days active, archives Won too, makes Ghosted Dead, and merges a matching LSA lead', () => {
  const now = new Date('2026-11-02T15:00:00Z');
  const rows = [
    lead({ id: 's1', name: 'Booked Bob', status: 'booked' }),
    lead({ id: 's2', name: 'Follow Fay', status: 'contacted', notes: '[Next Follow Up: 12/1/2026] call back' }),
    lead({ id: 's3', name: 'Later Lou', status: 'contacted', notes: '[Next Follow Up: 4/1/2027]' }),
    lead({ id: 's6', name: 'March Mae', status: 'contacted', notes: '[Next Follow Up: 3/1/27]' }),
    lead({ id: 's7', name: 'Past Pam', status: 'contacted', notes: '[Next Follow Up: 6/4/26]' }),
    lead({ id: 's8', name: 'Won Will', status: 'completed', notes: '[Next Follow Up: 12/3/2026]' }),
    lead({ id: 's9', name: 'Done Dot', status: 'completed' }),
    lead({ id: 's10', name: 'Done Dee', status: 'completed', notes: '[Priority: Completed | Next Follow Up: 3/1/27]' }),
    lead({ id: 's4', name: 'Ghost Gus', status: 'closed', quote_amount: 300, notes: 'keep me' }),
    lead({ id: 's5', name: 'Mo Match', phone: '+12625550777', status: 'contacted' }),
    lead({ id: 'l1', name: 'Mo', phone: '+12625550777', lsa_lead_id: '555', notes: 'LSA lead #555 - message', thread: [ev('1', 'customer', '2026-11-01T10:00:00.000Z', 'hi', '555')], lsa: { ids: ['555'], origin: 'sync', type: 'MESSAGE', category: null, service: null, status: 'NEW', charged: true, credit: null, creditAt: null, locale: null, createdAt: null, note: null, feedback: null } }),
  ].map(r => r as EngineLead & Record<string, unknown>);
  const plan = planSheetArchive(rows, now);
  assert.equal(plan.total, 10);
  assert.deepEqual(plan.keep.map(k => k.lead.id), ['s1', 's2']);
  assert.deepEqual(plan.archive.map(a => a.lead.id).sort(), ['s10', 's3', 's4', 's5', 's6', 's7', 's8', 's9']);
  // Back on the follow-up date when it is after the 30 days and by Spring Revival; past-due, later and no date: Spring Revival.
  const revive = Object.fromEntries(plan.archive.map(a => [a.lead.id, a.patch.revive_on]));
  assert.deepEqual(revive, { s3: '2027-03-15', s4: '2027-03-15', s5: '2027-03-15', s6: '2027-03-01', s7: '2027-03-15', s8: '2026-12-03', s9: '2027-03-15', s10: '2027-03-01' }); // a Completed lead with 3/1/27 comes back on 3/1/27
  assert.equal(plan.archive.find(a => a.lead.id === 's9')!.patch.original_status, 'completed');
  const gus = plan.archive.find(a => a.lead.id === 's4')!.patch;
  assert.equal(gus.stage, 'dead'); assert.equal(gus.original_status, 'closed'); assert.equal(gus.revive_on, '2027-03-15');
  assert.equal('notes' in gus || 'quote_amount' in gus || 'attempts' in gus, false);
  assert.equal(plan.merges.length, 1);
  // The sheet lead keeps its own name (reported as a difference); the duplicate is archived, not deleted.
  const merge = plan.merges[0];
  assert.equal(merge.patch.lsa_lead_id, '555'); assert.equal('name' in merge.patch, false); assert.equal('notes' in merge.patch, false);
  assert.deepEqual(merge.conflicts, [{ field: 'name', kept: 'Mo Match', lsa: 'Mo' }]);
  assert.equal(merge.dupPatch.lsa_lead_id, null); assert.equal(merge.dupPatch.stage, 'dead'); assert.equal((merge.dupPatch.lsa as { mergedInto: string }).mergedInto, 's5');
});

/* ------------------------------ Service account sign-in ------------------------------ */

// A throwaway key made here; Google is never called (fetch is answered in-process).
const keyDir = mkdtempSync(join(tmpdir(), 'oj-lsa-'));
after(() => rmSync(keyDir, { recursive: true, force: true }));
const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const keyFile = join(keyDir, 'lsa-service-account.json');
const robot = 'oj-lsa-sync@oj-automations.iam.gserviceaccount.com';
writeFileSync(keyFile, JSON.stringify({ type: 'service_account', project_id: 'oj-automations', private_key_id: 'kid1', private_key: privateKey.export({ type: 'pkcs8', format: 'pem' }), client_email: robot }));
const env = (over: Record<string, string> = {}) => ({ GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH: keyFile, GOOGLE_ADS_LSA_CUSTOMER_ID: '901-633-4601', GOOGLE_ADS_LOGIN_CUSTOMER_ID: '972-393-9798', ...over }) as unknown as NodeJS.ProcessEnv;
const reply = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
async function withFetch(handler: (url: string, init: RequestInit) => Response, work: () => Promise<void>) {
  const real = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => handler(String(input), init ?? {})) as typeof fetch;
  try { await work(); } finally { globalThis.fetch = real; }
}

test('the key path must be absolute and point at a service account key; ids lose their hyphens', () => {
  const cfg = googleConfig(env());
  assert.equal(cfg.clientEmail, robot); assert.equal(cfg.customerId, '9016334601'); assert.equal(cfg.loginCustomerId, '9723939798');
  assert.throws(() => serviceAccount(env({ GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH: '' })), /not set/);
  assert.throws(() => serviceAccount(env({ GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH: 'keys/lsa.json' })), /must be a full path/);
  assert.throws(() => serviceAccount(env({ GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH: join(keyDir, 'missing.json') })), /No service account key file/);
  const oauthClientFile = join(keyDir, 'client.json');
  writeFileSync(oauthClientFile, JSON.stringify({ installed: { client_id: 'x' } }));
  assert.throws(() => serviceAccount(env({ GOOGLE_ADS_SERVICE_ACCOUNT_KEY_PATH: oauthClientFile })), /not a service account key/);
});

test('sign-in sends a signed one-hour JWT for the Ads scope, with no impersonation and no refresh token', async () => {
  const seen: { form?: URLSearchParams } = {};
  await withFetch((url, init) => {
    assert.equal(url, 'https://oauth2.googleapis.com/token');
    seen.form = new URLSearchParams(String(init.body));
    return reply({ access_token: 'ya29.test', expires_in: 3599 });
  }, async () => { assert.equal(await accessToken(googleConfig(env())), 'ya29.test'); });
  assert.equal(seen.form?.get('grant_type'), 'urn:ietf:params:oauth:grant-type:jwt-bearer');
  assert.equal(seen.form?.has('refresh_token'), false);
  const [head, claims, signature] = seen.form!.get('assertion')!.split('.');
  assert.equal(createVerify('RSA-SHA256').update(`${head}.${claims}`).verify(publicKey, signature, 'base64url'), true);
  const c = JSON.parse(Buffer.from(claims, 'base64url').toString());
  assert.equal(c.iss, robot); assert.equal(c.scope, 'https://www.googleapis.com/auth/adwords'); assert.equal(c.aud, 'https://oauth2.googleapis.com/token');
  assert.equal(c.exp - c.iat, 3600); assert.equal('sub' in c, false);
  assert.equal(JSON.parse(Buffer.from(head, 'base64url').toString()).kid, 'kid1');
});

test('a service account not yet added in Google Ads gets a clear NOT_ADS_USER message', async () => {
  const cfg = googleConfig(env());
  await withFetch((url, init) => {
    if (url.startsWith('https://oauth2.googleapis.com/')) return reply({ access_token: 'ya29.test', expires_in: 3599 });
    const headers = new Headers(init.headers);
    assert.match(url, /\/v26\/customers\/9016334601\/googleAds:search$/);
    assert.equal(headers.get('login-customer-id'), '9723939798'); assert.equal(headers.has('developer-token'), false);
    return reply({ error: { code: 401, status: 'UNAUTHENTICATED', message: 'Request had invalid authentication credentials.', details: [{ '@type': 'type.googleapis.com/google.ads.googleads.v26.errors.GoogleAdsFailure', errors: [{ errorCode: { authenticationError: 'NOT_ADS_USER' }, message: 'User in the cookie is not a valid Ads user.' }] }] } }, 401);
  }, async () => {
    const api = new LsaApi(cfg, await accessToken(cfg));
    await assert.rejects(() => api.search('SELECT local_services_lead.id FROM local_services_lead'),
      (e: unknown) => e instanceof LsaError && e.kind === 'access' && /NOT_ADS_USER/.test(e.message) && e.message.includes(robot) && e.message.includes('972-393-9798') && e.message.includes('Read only'));
  });
});

test('no private key or service account key is tracked in git', () => {
  // Patterns are split so this file never matches itself. git grep exits 1 when nothing matches.
  let found = '';
  try { found = execFileSync('git', ['grep', '-l', '-I', '-e', 'BEGIN ' + 'PRIVATE KEY', '-e', '"type": *"service' + '_account"', '-e', '"private' + '_key"', '--', '.'], { encoding: 'utf8' }); }
  catch (e) { if ((e as { status?: number }).status === 1) return; throw e; }
  assert.equal(found.trim(), '', `Key material is tracked in git: ${found}`);
});

/* ------------------------------ The staged database change ------------------------------ */

const org = '00000000-0000-4000-8000-000000000001', other = '00000000-0000-4000-8000-000000000002';
const owner = '00000000-0000-4000-8000-000000000011', viewer = '00000000-0000-4000-8000-000000000012', stranger = '00000000-0000-4000-8000-000000000013';
async function setup() {
  const db = new PGlite();
  await db.exec(`create role authenticated; create role anon; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema auth,public to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;
    insert into auth.users values ('${owner}'),('${viewer}'),('${stranger}');
    create table public.leads(id uuid primary key default gen_random_uuid(), name text, phone text not null, status text, notes text);`);
  await db.exec(await readFile(new URL('../supabase/schemas/workspace.sql', import.meta.url), 'utf8'));
  await db.exec(`insert into oj_organizations(id,name) values ('${org}','OJ'),('${other}','Other');
    insert into oj_memberships(organization_id,user_id,role,display_name) values ('${org}','${owner}','owner','Oscar'),('${org}','${viewer}','viewer','View'),('${other}','${stranger}','owner','Eve');`);
  await db.exec(await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-11-02-lsa-lead-engine.sql', import.meta.url), 'utf8'));
  return db;
}
const as = async (db: PGlite, uid: string) => { await db.exec(`reset role; set request.jwt.claim.sub='${uid}'; set role authenticated;`); };
const count = async (db: PGlite, sql: string) => (await db.query<{ n: number }>(sql)).rows[0].n;

test('leads get the engine columns; one lead per LSA id; stages are checked', async () => {
  const db = await setup();
  await db.exec(`insert into public.leads(name,phone,lsa_lead_id,stage,thread) values ('A','NP_LSA_1','1','new','[{"id":"1"}]')`);
  await assert.rejects(() => db.exec(`insert into public.leads(name,phone,lsa_lead_id) values ('B','NP_LSA_1b','1')`), /duplicate|unique/);
  await assert.rejects(() => db.exec(`insert into public.leads(name,phone,stage) values ('C','x','ghosted')`));
  await assert.rejects(() => db.exec(`insert into public.leads(name,phone,lsa_lead_id) values ('D','y','not-a-number')`));
  assert.equal(await count(db, `select count(*)::int as n from public.leads where attempts = 0 and dispute = false and auto_fields = '[]'::jsonb`), 1);
});

test('only owners and members of the workspace read and write its sync state', async () => {
  const db = await setup();
  await as(db, owner);
  await db.exec(`insert into oj_lsa_sync(organization_id, ops_used) values ('${org}', 3)`);
  await db.exec(`update oj_lsa_sync set last_error = 'x', error_kind = 'token' where organization_id = '${org}'`);
  assert.equal(await count(db, 'select count(*)::int as n from oj_lsa_sync'), 1);
  await assert.rejects(() => db.exec(`update oj_lsa_sync set error_kind = 'other'`));
  await as(db, viewer);
  assert.equal(await count(db, 'select count(*)::int as n from oj_lsa_sync'), 0);
  await assert.rejects(() => db.exec(`insert into oj_lsa_sync(organization_id) values ('${other}')`));
  await as(db, stranger);
  assert.equal(await count(db, 'select count(*)::int as n from oj_lsa_sync'), 0);
  await assert.rejects(() => db.exec(`insert into oj_lsa_sync(organization_id) values ('${org}')`));
});

test('the script is one transaction and refuses a second run', async () => {
  const db = await setup();
  await db.exec('reset role');
  const sql = await readFile(new URL('../docs/db-change-proposals/RUN-ME-2026-11-02-lsa-lead-engine.sql', import.meta.url), 'utf8');
  await assert.rejects(() => db.exec(sql), /already exists/);
});

test('possible duplicates: owners and members read, add and decide; viewers and strangers see nothing; nobody deletes', async () => {
  const db = await setup();
  const lead = `'{"id":"777","name":"Jenny"}'`;
  await as(db, owner);
  await db.exec(`insert into oj_lsa_review(organization_id, lsa_lead_id, lead, candidates, reason) values ('${org}', '777', ${lead}, '[{"id":"x"}]', 'same last name')`);
  await assert.rejects(() => db.exec(`insert into oj_lsa_review(organization_id, lsa_lead_id, lead) values ('${org}', '777', ${lead})`), /duplicate|unique/);
  await assert.rejects(() => db.exec(`update oj_lsa_review set status = 'merge'`), /check/);
  await db.exec(`update oj_lsa_review set status = 'merge', merge_into = gen_random_uuid(), decided_by = '${owner}', decided_at = now()`);
  await assert.rejects(() => db.exec(`update oj_lsa_review set status = 'maybe'`), /check/);
  await assert.rejects(() => db.exec('delete from oj_lsa_review'), /permission denied/);
  assert.equal(await count(db, 'select count(*)::int as n from oj_lsa_review'), 1);
  await as(db, viewer);
  assert.equal(await count(db, 'select count(*)::int as n from oj_lsa_review'), 0);
  await assert.rejects(() => db.exec(`insert into oj_lsa_review(organization_id, lsa_lead_id, lead) values ('${org}', '778', ${lead})`));
  await as(db, stranger);
  assert.equal(await count(db, 'select count(*)::int as n from oj_lsa_review'), 0);
  await assert.rejects(() => db.exec(`insert into oj_lsa_review(organization_id, lsa_lead_id, lead) values ('${org}', '779', ${lead})`));
  await db.exec(`update oj_lsa_review set status = 'done'`);
  await as(db, owner);
  assert.equal(await count(db, `select count(*)::int as n from oj_lsa_review where status = 'merge'`), 1);
});
