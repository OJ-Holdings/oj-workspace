import assert from 'node:assert/strict';
import {test} from 'node:test';
import {prepareCommercialPropertyEstimate,type CommercialAccount} from '../src/lib/commercial-accounts';

const companyId='11111111-1111-4111-8111-111111111111';
const siteId='22222222-2222-4222-8222-222222222222';
const account:CommercialAccount={
 id:companyId,revision:1,createdAt:'2026-10-25T00:00:00.000Z',updatedAt:'2026-10-25T00:00:00.000Z',
 name:'Office Group',industry:'Commercial',website:'',notes:'',contacts:[],
 properties:[{id:siteId,name:'North Facility',address:'',serviceNotes:'',frequency:'monthly'}],
};

test('explicitly selected stored property becomes a draft suggestion, not an automatic booking',()=>{
 const v=prepareCommercialPropertyEstimate(account,siteId);
 assert.deepEqual(v,{
  accountId:companyId,accountName:'Office Group',propertyId:siteId,
  propertyName:'North Facility',suggestedEstimateTitle:'Office Group · North Facility',
 });
 assert.equal(v.suggestedEstimateTitle.includes('booked'),false);
});
test('matching property names or addresses never substitute for the exact stored ID',()=>{
 assert.throws(()=>prepareCommercialPropertyEstimate(account,'33333333-3333-4333-8333-333333333333'));
 assert.throws(()=>prepareCommercialPropertyEstimate(account,'North Facility'));
 assert.throws(()=>prepareCommercialPropertyEstimate({...account,id:'not a UUID'},siteId));
});
test('suggested estimate names remain bounded to the shared project title limit',()=>{
 const long={...account,name:'A'.repeat(160),properties:[{...account.properties[0],name:'B'.repeat(120)}]};
 const result=prepareCommercialPropertyEstimate(long,siteId);
 assert.equal(result.suggestedEstimateTitle.length,160);
});
