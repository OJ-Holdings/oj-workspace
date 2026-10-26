import assert from 'node:assert/strict';
import {test} from 'node:test';
import {commercialProjectLinkSelection,parseCommercialProjectLink,
 parseCommercialLinkedProjectsPage,parseProjectLinkSaveReceipt} from '../src/lib/commercial-project-links';
const account='11111111-1111-4111-8111-111111111111';
const property='22222222-2222-4222-8222-222222222222';
const project='33333333-3333-4333-8333-333333333333';

test('only an explicit exact account/property pair can be bound to a project',()=>{
 assert.deepEqual(commercialProjectLinkSelection(account,property),{accountId:account,propertyId:property});
 assert.deepEqual(commercialProjectLinkSelection(null,null),{accountId:null,propertyId:null});
 assert.throws(()=>commercialProjectLinkSelection(account,null));
 assert.throws(()=>commercialProjectLinkSelection(null,property));
 assert.throws(()=>commercialProjectLinkSelection('matching-address-not-an-id',property));
});

test('link reads and account-linked project pages are validated',()=>{
 const now='2026-10-26T00:00:00.000Z';
 assert.equal(parseCommercialProjectLink(null),null);
 assert.deepEqual(parseCommercialProjectLink({accountId:account,propertyId:property,revision:2,updatedAt:now}),
  {accountId:account,propertyId:property,revision:2,updatedAt:now});
 assert.throws(()=>parseCommercialProjectLink({accountId:account,propertyId:null,revision:2,updatedAt:now}));
 assert.throws(()=>parseCommercialProjectLink({accountId:account,propertyId:property,revision:0,updatedAt:now}));
 const row={projectId:project,title:'Commercial cleaning',phase:'scoping',propertyId:property,linkRevision:2};
 assert.equal(parseCommercialLinkedProjectsPage({projects:[row],hasMore:false}).projects[0].projectId,project);
 assert.throws(()=>parseCommercialLinkedProjectsPage({projects:[row,row],hasMore:false}));
 assert.throws(()=>parseCommercialLinkedProjectsPage({projects:[{...row,propertyId:account.slice(0,8)}],hasMore:false}));
});

test('save receipts reject false confirmation or malformed revision',()=>{
 assert.deepEqual(parseProjectLinkSaveReceipt({ok:true,revision:1,replayed:false}),
  {status:'saved',revision:1,replayed:false});
 assert.deepEqual(parseProjectLinkSaveReceipt({ok:false,conflict:true,currentRevision:3}),
  {status:'conflict',revision:3});
 assert.throws(()=>parseProjectLinkSaveReceipt({ok:true,revision:0,replayed:false}));
 assert.throws(()=>parseProjectLinkSaveReceipt({ok:false,conflict:true}));
});
