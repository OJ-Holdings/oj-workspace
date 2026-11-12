import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseAccountReceipt,parseCommercialAccountsPage,validateCommercialAccountDraft,latestLogos,websiteIcon} from '../src/lib/commercial-accounts';
const id='11111111-1111-4111-8111-111111111111';
const person='22222222-2222-4222-8222-222222222222';
const property='33333333-3333-4333-8333-333333333333';
const draft={name:'Industrial Building Group',industry:'Facilities',website:'',notes:'',
 contacts:[{id:person,fullName:'Facilities manager',role:'Manager',email:'',phone:''}],
 properties:[{id:property,name:'Main facility',address:'',serviceNotes:'',frequency:'quarterly'} as const]};
test('company and property validation preserves distinct source identities',()=>{
 assert.deepEqual(validateCommercialAccountDraft(draft),draft);
 assert.throws(()=>validateCommercialAccountDraft({...draft,name:'   '}));
 assert.throws(()=>validateCommercialAccountDraft({...draft,contacts:[draft.contacts[0],draft.contacts[0]]}));
 assert.throws(()=>validateCommercialAccountDraft({...draft,properties:[{...draft.properties[0],frequency:'paid'}]}));
 assert.throws(()=>validateCommercialAccountDraft({...draft,contacts:[{...draft.contacts[0],id:'not-a-uuid'}]}));
 assert.throws(()=>validateCommercialAccountDraft({...draft,properties:Array.from({length:31},()=>draft.properties[0])}));
});
test('only verified save revisions and bounded normalized pages are accepted',()=>{
 assert.deepEqual(parseAccountReceipt({ok:true,revision:1,replayed:false}),
  {status:'saved',revision:1,replayed:false});
 assert.deepEqual(parseAccountReceipt({ok:false,conflict:true,currentRevision:2}),
  {status:'conflict',revision:2});
 assert.throws(()=>parseAccountReceipt({ok:true,revision:0,replayed:false}));
 const now='2026-10-26T00:00:00.000Z';
 const page={accounts:[{id,revision:1,createdAt:now,updatedAt:now,...draft}],hasMore:false};
 assert.equal(parseCommercialAccountsPage(page).accounts[0].properties[0].frequency,'quarterly');
 assert.throws(()=>parseCommercialAccountsPage({...page,hasMore:'false'}));
 assert.throws(()=>parseCommercialAccountsPage({...page,accounts:[page.accounts[0],page.accounts[0]]}));
});
test('client wall readouts come only from saved fields',async()=>{
 const {townOf,accountTowns,siteDomain,accountRhythm,initialsOf,monogramHue}=await import('../src/lib/commercial-accounts');
 assert.equal(townOf('544 Fakery Avenue, Union Grove, WI 53182'),'Union Grove, WI');
 assert.equal(townOf('Wonka National Airport'),'');
 assert.deepEqual(accountTowns({...draft,properties:[
  {...draft.properties[0],address:'1 A St, Kenosha, WI 53140'},
  {...draft.properties[0],id:person,address:'2 B St, Kenosha, WI 53144'}]}),['Kenosha, WI']);
 assert.equal(siteDomain('https://www.americanroller.com/about'),'americanroller.com');
 assert.equal(siteDomain('americanroller.com'),'americanroller.com');
 assert.equal(siteDomain('  '),'');
 assert.equal(accountRhythm(draft),'Quarterly service');
 assert.equal(accountRhythm({...draft,properties:[]}),'No rhythm agreed');
 assert.equal(accountRhythm({...draft,properties:[draft.properties[0],{...draft.properties[0],id:person,frequency:'monthly'}]}),'Mixed rhythm');
 assert.equal(initialsOf('Acme Roller Company'),'AR');
 assert.equal(initialsOf('Lakeside Aviation / Waukegan'),'LA');
 assert.equal(initialsOf(''),'OJ');
 assert.equal(monogramHue('Acme'),monogramHue(' acme '));
});

test('company logos: newest upload per account wins, website icon only from a saved domain', () => {
  const a = '11111111-1111-4111-8111-111111111111', b = '22222222-2222-4222-8222-222222222222';
  const got = latestLogos([`${a}--100.png`, `${a}--900.jpg`, `${a}--50.webp`, `${b}--7.png`, 'stray.txt', `${a}--1.gif`]);
  assert.equal(got.get(a)?.latest, `${a}--900.jpg`);
  assert.equal(got.get(a)?.all.length, 3);
  assert.equal(got.get(b)?.latest, `${b}--7.png`);
  assert.equal(got.size, 2);
  assert.equal(websiteIcon(''), '');
  assert.equal(websiteIcon('https://www.americanroller.com/about'), 'https://www.google.com/s2/favicons?domain=americanroller.com&sz=128');
});

test('company ledger counts only real invoices, and name matches are suggested first', async () => {
  const {companyLedger, suggestRecords} = await import('../src/lib/commercial-accounts');
  const r = (kind: 'proposal'|'invoice'|'document', id: string, status: string, total: number|null, paid: number|null, customer = '', date = '2026-11-01') =>
    ({kind, id, title: id, customer, status, date, totalCents: total, paidCents: paid});
  const ledger = companyLedger([r('invoice','a','paid',50000,50000), r('invoice','b','open',20000,5000), r('invoice','c','void',99900,0),
    r('proposal','d','accepted',50000,null), r('proposal','e','sent',10000,null), r('document','f','',null,null)]);
  assert.deepEqual(ledger, {invoiced: 70000, paid: 55000, open: 15000, invoices: 2, proposals: 2, won: 1, documents: 1});
  assert.deepEqual(companyLedger([]), {invoiced: 0, paid: 0, open: 0, invoices: 0, proposals: 0, won: 0, documents: 0});
  const order = suggestRecords('Acme Roller Company', [r('invoice','x','open',1,0,'Smith Residence','2026-11-03'),
    r('invoice','y','open',1,0,'acme roller co','2026-10-01'), r('invoice','z','open',1,0,'Lake Company','2026-11-02')]);
  assert.deepEqual(order.map(o => o.id), ['y','x','z']);
});
