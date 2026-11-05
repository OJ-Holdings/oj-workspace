import assert from 'node:assert/strict';
import {test} from 'node:test';
import {parseAccountReceipt,parseCommercialAccountsPage,validateCommercialAccountDraft} from '../src/lib/commercial-accounts';
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
 assert.equal(townOf('1440 13th Avenue, Union Grove, WI 53182'),'Union Grove, WI');
 assert.equal(townOf('Waukegan National Airport'),'');
 assert.deepEqual(accountTowns({...draft,properties:[
  {...draft.properties[0],address:'1 A St, Kenosha, WI 53140'},
  {...draft.properties[0],id:person,address:'2 B St, Kenosha, WI 53144'}]}),['Kenosha, WI']);
 assert.equal(siteDomain('https://www.americanroller.com/about'),'americanroller.com');
 assert.equal(siteDomain('americanroller.com'),'americanroller.com');
 assert.equal(siteDomain('  '),'');
 assert.equal(accountRhythm(draft),'Quarterly service');
 assert.equal(accountRhythm({...draft,properties:[]}),'No rhythm agreed');
 assert.equal(accountRhythm({...draft,properties:[draft.properties[0],{...draft.properties[0],id:person,frequency:'monthly'}]}),'Mixed rhythm');
 assert.equal(initialsOf('American Roller Company'),'AR');
 assert.equal(initialsOf('Leiferman Aviation / Waukegan'),'LA');
 assert.equal(initialsOf(''),'OJ');
 assert.equal(monogramHue('Acme'),monogramHue(' acme '));
});
