import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assertSharedReference, parseSharedDocument, parseSharedSaveReceipt,
  validateSharedPayload,
} from '../src/lib/oj-shared-documents';
import { emptyFleet } from '../src/lib/fleet-command';
import type { LocalEstimateBook } from '../src/lib/exterior-estimate';
import { newFieldLog } from '../src/lib/exterior-field-log';
import { makeEquipmentPlan } from '../src/lib/exterior-field-equipment';

const org = '11111111-1111-4111-8111-111111111111';
const lead = '22222222-2222-4222-8222-222222222222';
const estimate: LocalEstimateBook = {
  schema: 1,
  current: {
    schema: 1, leadId: lead, sourceUpdatedAt: null, sourceQuote: null,
    lines: [{id:'line-1',service:'House wash',quantity:1,unit:'flat',pricePerUnit:350,costPerUnit:null,notes:''}],
    discount:0, travelCost:null, contingencyPct:0,
  },
  revisions: [],
};

test('shared draft keys remain company scoped and tied to original source IDs', () => {
  assert.doesNotThrow(() => assertSharedReference(org, 'fleet', 'main'));
  assert.doesNotThrow(() => assertSharedReference(org, 'exterior_estimate', lead));
  assert.throws(() => assertSharedReference(org, 'fleet', lead));
  assert.throws(() => assertSharedReference(org, 'exterior_estimate', 'main'));
  assert.throws(() => assertSharedReference('wrong-org', 'fleet', 'main'));
});

test('shared estimate validation refuses unrelated customers and unsupported payloads', () => {
  assert.deepEqual(validateSharedPayload(org,'exterior_estimate',lead,estimate),estimate);
  assert.throws(() => validateSharedPayload(org,'exterior_estimate',org,estimate));
  assert.throws(() => validateSharedPayload(org,'exterior_estimate',lead,{...estimate,revisions:[{id:'bad',savedAt:'bad',estimate:estimate.current}]}));
});

test('field reports are bound to their original booking IDs and validated', () => {
  const booking = '33333333-3333-4333-8333-333333333333';
  const record = newFieldLog({ id:booking,lead_id:lead,date:'2026-10-26',status:'confirmed' } as Parameters<typeof newFieldLog>[0]);
  assert.deepEqual(validateSharedPayload(org,'exterior_field',booking,record),record);
  assert.throws(()=>validateSharedPayload(org,'exterior_field',lead,record));
  assert.throws(()=>validateSharedPayload(org,'exterior_field',booking,{...record,materials:[{id:'bad',name:'',quantity:-1}]}));
  assert.equal(parseSharedDocument(org,'exterior_field',booking,{
    revision:1,payload:record,updatedAt:'2026-10-26T12:00:00.000Z'
  })?.payload.leadId,lead);
});

test('source-bound equipment plans reject cross-organization and mismatched booking',()=>{
  const bookingId='33333333-3333-4333-8333-333333333333';
  const plan=makeEquipmentPlan(org,{id:bookingId,lead_id:lead,date:'2026-10-26',status:'confirmed'} as Parameters<typeof makeEquipmentPlan>[1]);
  assert.deepEqual(validateSharedPayload(org,'exterior_equipment',bookingId,plan),plan);
  assert.throws(()=>validateSharedPayload(org,'exterior_equipment',lead,plan));
  assert.throws(()=>validateSharedPayload(org,'exterior_equipment',bookingId,{...plan,organizationId:lead}));
  assert.throws(()=>validateSharedPayload(org,'exterior_equipment',bookingId,{...plan,selectedAssetIds:['asset-1','asset-1']}));
});

test('internal crew handoffs preserve exact booking and company source',()=>{
  const bookingId='33333333-3333-4333-8333-333333333333';
  const data={bookingId,leadId:lead,mailbox:{
    outgoing:null,incoming:null,outgoingReply:null,incomingReply:null
  }};
  assert.deepEqual(validateSharedPayload(org,'exterior_handoff',bookingId,data),data);
  assert.throws(()=>validateSharedPayload(org,'exterior_handoff',lead,data));
  assert.throws(()=>validateSharedPayload(org,'exterior_handoff',bookingId,{...data,leadId:'another'}));
  assert.throws(()=>validateSharedPayload(org,'exterior_handoff',bookingId,{...data,mailbox:{outgoingReply:{}}}));
});

test('fleet validator rejects foreign-company records and accepts empty local recovery', () => {
  assert.deepEqual(validateSharedPayload(org,'fleet','main',emptyFleet(org)),emptyFleet(org));
  assert.throws(() => validateSharedPayload(org,'fleet','main',emptyFleet(lead)));
});

test('document receipts require a positive integer revision and valid timestamp', () => {
  const value={revision:3,updatedAt:'2026-10-25T12:00:00.000Z',payload:estimate};
  assert.equal(parseSharedDocument(org,'exterior_estimate',lead,value)?.revision,3);
  assert.equal(parseSharedDocument(org,'exterior_estimate',lead,null),null);
  assert.throws(() => parseSharedDocument(org,'exterior_estimate',lead,{...value,revision:0}));
  assert.throws(() => parseSharedDocument(org,'exterior_estimate',lead,{...value,payload:{}}));
  assert.deepEqual(parseSharedSaveReceipt({ok:true,replayed:true,revision:3}),{ok:true,replayed:true,revision:3});
  assert.deepEqual(parseSharedSaveReceipt({ok:false,conflict:true,currentRevision:4}),{ok:false,conflict:true,currentRevision:4});
  assert.throws(() => parseSharedSaveReceipt({ok:true,replayed:true,revision:0}));
});
