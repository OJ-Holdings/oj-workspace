import test from 'node:test';
import assert from 'node:assert/strict';
import type {ExtBooking,ExtLead} from '../src/lib/exterior';
import {newFieldLog,type ExteriorFieldLog} from '../src/lib/exterior-field-log';
import {
 createFieldHandoffRequest,createFieldHandoffReply,
 parseFieldHandoffRequest,parseFieldHandoffReply,
 newHandoffMailbox,readHandoffMailbox,serializeHandoffMailbox,
 handoffRevisionMatchesField,replyReviewStillCurrent,type FieldHandoffRequest,
} from '../src/lib/exterior-crew-handoff';

const org='org-exterior',otherOrg='org-unrelated';
const booking:ExtBooking={id:'booking-35',lead_id:'lead-35',date:'2026-10-23',time_block:'9-12',status:'confirmed'};
const lead:ExtLead={
 id:'lead-35',name:'Test owner',phone:null,address:'Example site',
 service_requested:'Exterior windows',quote_amount:800,status:'booked',
 source:'LSA',notes:null,job_revenue:null,job_cost:null,
 created_at:'2026-10-22T12:00:00.000Z',updated_at:null,completed_at:null,
};
const clock=new Date('2026-10-23T18:30:00.000Z');
const field=():ExteriorFieldLog=>({
 ...newFieldLog(booking),stage:'wrap-up',
 arrivalAt:'2026-10-23T14:00:00.000Z',departureAt:'2026-10-23T17:00:00.000Z',
 labor:[{id:'a',role:'Operator',hours:3,hourlyCost:40,notes:'Water-fed upper rows'}],
 materials:[{id:'m',name:'Consumable',quantity:1,unitCost:7,notes:''}],
 travelMiles:12,vehicleCostPerMile:.5,otherDirectCost:0,
 review:{labor:true,materials:true,travel:true,other:true},
 checks:{water:'ready',ppe:'ready',runoff:'ready',chemicals:'ready',
  pump:'not-required',hoses:'ready',pureWater:'ready'},
 issues:[],siteNotes:'Water access granted by customer.',
});
const request=(f=field()):FieldHandoffRequest=>
 createFieldHandoffRequest(org,booking,lead,f,'Jacob','request-r35',clock);
const reply=(req=request(),values?:Partial<{
 reviewedBy:string;decision:'follow-up-needed'|'reviewed-internally';
 followUpTo:'crew'|'owner'|'none';dueOn:string|null;note:string;
}>)=>createFieldHandoffReply(
 req,booking,lead,[booking],true,
 {reviewedBy:'Oscar',decision:'reviewed-internally',followUpTo:'none',
  dueOn:null,note:'Reviewed field notes locally.',...values},clock,
);

test('crew package roundtrips exact organization/job with private draft status',()=>{
 const original=request();
 const imported=parseFieldHandoffRequest(JSON.stringify(original),org,booking.id,lead.id);
 assert.deepEqual(imported,original);
 assert.equal(imported.prepared_by,'Jacob');
 assert.equal(imported.field.labor[0].hours,3);
 assert.equal(handoffRevisionMatchesField(imported,field()),true);
 assert.equal('paid' in imported,false);
 assert.equal('customerAccepted' in imported,false);
 assert.equal('invoice' in imported,false);
});
test('the package strips untrusted nested field attributes but never imports finalized flags',()=>{
 const d=JSON.parse(JSON.stringify(request()));
 d.field.labor[0].bank_account='not accepted';d.field.isPaid=true;
 const parsed=parseFieldHandoffRequest(JSON.stringify(d),org,booking.id,lead.id);
 assert.equal('bank_account' in parsed.field.labor[0],false);
 assert.equal('isPaid' in parsed.field,false);
 d.paid=true;
 assert.throws(()=>parseFieldHandoffRequest(JSON.stringify(d),org,booking.id,lead.id),/falsely finalized/);
 delete d.paid;d.purpose='customer-invoice';
 assert.throws(()=>parseFieldHandoffRequest(JSON.stringify(d),org,booking.id,lead.id),/falsely finalized/);
});
test('cross-company, cross-job, cross-lead and forged field IDs fail closed',()=>{
 const raw=JSON.stringify(request());
 assert.throws(()=>parseFieldHandoffRequest(raw,otherOrg,booking.id,lead.id),/different organization/);
 assert.throws(()=>parseFieldHandoffRequest(raw,org,'wrong',lead.id),/different organization/);
 assert.throws(()=>parseFieldHandoffRequest(raw,org,booking.id,'wrong'),/different organization/);
 const d=JSON.parse(raw);d.field.bookingId='wrong';
 assert.throws(()=>parseFieldHandoffRequest(JSON.stringify(d),org,booking.id,lead.id),/field snapshot/);
 assert.throws(()=>createFieldHandoffRequest(org,booking,{...lead,id:'wrong'},field(),'Jacob','id'),/original source/);
});
test('missing, oversized, malformed, stale and invalid request data are rejected',()=>{
 assert.throws(()=>parseFieldHandoffRequest('{bad',org,booking.id,lead.id),/JSON/);
 assert.throws(()=>parseFieldHandoffRequest('x'.repeat(115001),org,booking.id,lead.id),/exceeds/);
 const d=JSON.parse(JSON.stringify(request()));
 d.issued_at='2026-02-30T12:00:00.000Z';
 assert.throws(()=>parseFieldHandoffRequest(JSON.stringify(d),org,booking.id,lead.id),/valid request/);
 d.issued_at=clock.toISOString();d.field.materials[0].unitCost=-1;
 assert.throws(()=>parseFieldHandoffRequest(JSON.stringify(d),org,booking.id,lead.id),/field snapshot/);
});
test('owner may return an internal review only when original booking field evidence is reviewable',()=>{
 const result=reply();
 assert.equal(result.decision,'reviewed-internally');
 assert.equal(result.follow_up_to,'none');
 assert.equal(result.purpose,'internal-feedback-only');
 assert.equal('jobCompleted' in result,false);
 assert.equal('customerSigned' in result,false);
 const imported=parseFieldHandoffReply(JSON.stringify(result),org,booking.id,lead.id,request());
 assert.deepEqual(imported,result);
 const unsafe=field();unsafe.checks.ppe='issue';
 assert.throws(()=>reply(request(unsafe)),/Unresolved source, cost or safety/);
 const partial=field();partial.review.travel=false;
 assert.throws(()=>reply(request(partial)),/Unresolved source, cost or safety/);
});
test('owner can assign follow-up even for blocked stop-work, with explicit actionable note',()=>{
 const unsafe=field();
 unsafe.issues=[{id:'danger',category:'equipment',severity:'stop-work',resolved:false,description:'Leaking fitting'}];
 const result=reply(request(unsafe),{
  decision:'follow-up-needed',followUpTo:'crew',dueOn:'2026-10-26',
  note:'Replace the leaking fitting, retest the pump and upload new handoff.',
 });
 assert.equal(result.follow_up_to,'crew');assert.equal(result.due_on,'2026-10-26');
 assert.match(result.note,/Replace the leaking fitting/);
});
test('follow-up and due dates cannot be empty, fictitious or contradicted',()=>{
 assert.throws(()=>reply(request(),{decision:'follow-up-needed',followUpTo:'none',note:'Please fix leak.'}),/Follow-up needs/);
 assert.throws(()=>reply(request(),{decision:'follow-up-needed',followUpTo:'crew',note:'ok'}),/Follow-up needs/);
 assert.throws(()=>reply(request(),{dueOn:'2026-10-25'}),/Due date requires/);
 assert.throws(()=>reply(request(),{decision:'reviewed-internally',followUpTo:'crew'}),/cannot create/);
 assert.throws(()=>reply(request(),{decision:'follow-up-needed',followUpTo:'owner',dueOn:'2026-02-30',note:'Call the customer to clarify access.'}),/invalid feedback/);
});
test('reply is bound to the precise crew request version, not just matching customer',()=>{
 const original=request(),feedback=reply(original);
 const other=createFieldHandoffRequest(org,booking,lead,field(),'Jacob','new-version',clock);
 assert.throws(()=>parseFieldHandoffReply(JSON.stringify(feedback),org,booking.id,lead.id,other),/different handoff revision/);
 const forged=JSON.parse(JSON.stringify(feedback));forged.customerAccepted=true;
 assert.throws(()=>parseFieldHandoffReply(JSON.stringify(forged),org,booking.id,lead.id,original),/falsely finalized/);
 assert.throws(()=>parseFieldHandoffReply(JSON.stringify(feedback),otherOrg,booking.id,lead.id,original),/different organization/);
});
test('local mailbox validates cross-role records and preserves matching response',()=>{
 const outbound=request(),inbound=createFieldHandoffRequest(org,booking,lead,field(),'Crew 2','inbound-new',clock);
 const state={
  outgoing:outbound,incoming:inbound,
  outgoingReply:reply(inbound,{decision:'follow-up-needed',followUpTo:'crew',note:'Recheck blocked drain before signing off.'}),
  incomingReply:reply(outbound),
 };
 const raw=serializeHandoffMailbox(state,org,booking.id,lead.id);
 assert.deepEqual(readHandoffMailbox(raw,org,booking.id,lead.id),state);
 assert.deepEqual(readHandoffMailbox(null,org,booking.id,lead.id),newHandoffMailbox());
 const d=JSON.parse(raw);d.incomingReply.request_id='wrong-version';
 assert.throws(()=>readHandoffMailbox(JSON.stringify(d),org,booking.id,lead.id),/different handoff revision/);
 d.incomingReply=null;d.outgoing=null;
 assert.throws(()=>readHandoffMailbox(JSON.stringify({...d,incomingReply:state.incomingReply}),org,booking.id,lead.id),/Orphaned/);
});
test('outgoing crew response cannot silently apply to a changed field draft',()=>{
 const req=request(),edited=field();
 edited.siteNotes='Owner asked to revisit water access';
 assert.equal(handoffRevisionMatchesField(req,field()),true);
 assert.equal(handoffRevisionMatchesField(req,edited),false);
 assert.equal(handoffRevisionMatchesField(req,{...edited,bookingId:'some-other'}),false);
});
test('all local info remains user-entered without any provider/authenticity guarantees',()=>{
 const req=request(),feedback=reply(req);
 assert.equal(req.purpose,'internal-review-only');
 assert.equal(feedback.purpose,'internal-feedback-only');
 assert.equal('verifiedByAuth' in feedback,false);
 assert.equal('certified' in feedback,false);
 assert.equal('externalMessageId' in req,false);
});

test('a returned internally reviewed packet becomes stale when source coverage or safety changes',()=>{
 const req=request(),feedback=reply(req);
 assert.equal(replyReviewStillCurrent(req,feedback,booking,lead,[booking],true),true);
 assert.equal(replyReviewStillCurrent(req,feedback,booking,lead,[booking],false),false);
 assert.equal(replyReviewStillCurrent(req,feedback,{...booking,date:'2026-10-24'},lead,[booking],true),false);
 assert.equal(replyReviewStillCurrent(req,feedback,booking,lead,[booking,{...booking,id:'second'}],true),false);
 const followUp=reply(req,{
  decision:'follow-up-needed',followUpTo:'crew',note:'Check that the water access is still available.',
 });
 assert.equal(replyReviewStillCurrent(req,followUp,booking,lead,[booking],false),true);
 assert.equal(replyReviewStillCurrent({...req,request_id:'wrong'},feedback,booking,lead,[booking],true),false);
});
test('reply timestamp cannot precede the crew handoff',()=>{
 const req=request();
 const d=JSON.parse(JSON.stringify(reply(req)));
 d.replied_at='2026-10-23T18:29:59.000Z';
 assert.throws(()=>parseFieldHandoffReply(JSON.stringify(d),org,booking.id,lead.id,req),/predates the original/);
});
test('malformed local mailbox with omitted keys is denied rather than replacing saved evidence',()=>{
 const state={schema:1,outgoing:request(),incoming:null,incomingReply:null};
 assert.throws(()=>readHandoffMailbox(JSON.stringify(state),org,booking.id,lead.id),/schema is invalid/);
});
