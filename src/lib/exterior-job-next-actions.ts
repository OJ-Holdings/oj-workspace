import type {ExtBooking} from './exterior';
import type {JobContinuitySnapshot} from './exterior-job-continuity';
import type {OriginalBookingSnapshot} from './exterior-job-action-loop';
import {originalBookingActionable} from './exterior-job-action-loop';
import {originalJobMatchesTask} from './exterior-operations-inbox';
import type {SharedJobFollowup} from './exterior-job-followup';

/**
 * R47: deterministic operator assistance from a source-verified job snapshot.
 * These are suggested INTERNAL task drafts, not verified customer decisions,
 * work orders, automatic assignments, site dispatch, or money movement.
 * No inference from absent field/financial modules is treated as completed work.
 */
export type JobNextAction={
 key:'approval'|'time'|'customer'|'quote'|'crew';
 title:string;
 reason:string;
 note:string;
 priority:'normal'|'high';
 existing:{id:string;assignee:string;stage:string}|null;
};
export type JobNextActionReport={
 state:'ready'|'source-missing'|'source-stale'|'booking-inactive'|'partial-team-source';
 actions:JobNextAction[];
};
const clean=(note:string)=>note.trim().replace(/\s+/g,' ').toLowerCase();
export function buildJobNextActions(
 view:JobContinuitySnapshot,
 booking:ExtBooking,
 server:OriginalBookingSnapshot|null,
 tasks:readonly SharedJobFollowup[],
 partialTeamSource:boolean,
):JobNextActionReport{
 const result=(state:JobNextActionReport['state'],actions:JobNextAction[]=[]):JobNextActionReport=>({state,actions});
 if(!view.sourceLinked||!view.leadId||view.leadId!==booking.lead_id||
    view.bookingId!==booking.id)return result('source-missing');
 if(booking.status!=='confirmed'&&booking.status!=='pending_approval')
  return result('booking-inactive');
 if(!originalBookingActionable(booking,server))return result('source-stale');
 // Cannot reliably suppress duplicated assignments when the task window is partial.
 if(partialTeamSource)return result('partial-team-source');
 const review=(key:JobContinuitySnapshot['steps'][number]['key'])=>
  view.steps.some(step=>step.key===key&&step.evidence==='review');
 const possibilities:Omit<JobNextAction,'existing'>[]=[];
 if(booking.status==='pending_approval')possibilities.push({
  key:'approval',title:'Resolve pending booking',
  reason:'Original booking is awaiting approval; no dispatch is implied.',
  note:'Review this pending appointment in the original booking source. Confirm whether it has been approved or declined before any crew dispatch, then record the internal decision.',
  priority:'high',
 });
 if(booking.status==='confirmed'&&review('booking'))possibilities.push({
  key:'time',title:'Verify booking time',
  reason:'The recorded booking time block is missing or cannot be validated.',
  note:'Review the original confirmed booking time window. Verify and correct the authorized appointment source before making crew travel or arrival commitments. Report the outcome internally.',
  priority:'high',
 });
 if(review('customer'))possibilities.push({
  key:'customer',title:'Review customer and service site',
  reason:'At least one original customer, contact, site, or requested-scope field needs source review.',
  note:'Review the exact original customer source for name, service location, usable contact information, and requested service scope. Correct incomplete source data through authorized workflow and report what was verified internally.',
  priority:'high',
 });
 if(review('quote'))possibilities.push({
  key:'quote',title:'Review visit-specific estimate',
  reason:view.sourceCoverage==='partial'?
   'Customer or booking history coverage is incomplete; visit price is not attributable.':
   'An accepted, visit-specific proposal has not been established.',
  note:'Review source completeness and confirm whether a price uniquely belongs to this exact visit. Do not treat a lead-level quote as an accepted proposal or collected revenue. Record what requires approval internally.',
  priority:'normal',
 });
 if(review('crew'))possibilities.push({
  key:'crew',title:'Check employee and equipment plan',
  reason:'The accessible crew source does not establish a complete job assignment.',
  note:'Verify whether an actual crew member and the required equipment have been assigned to this exact booking in authorized sources. Resolve capacity or access questions before dispatch and report the result internally.',
  priority:'normal',
 });
 return result('ready',possibilities.slice(0,4).map(p=>{
  const previous=tasks.find(task=>task.stage!=='Done'&&
   originalJobMatchesTask(task,booking)&&clean(task.note)===clean(p.note));
  return {...p,existing:previous?
   {id:previous.id,assignee:previous.assignee,stage:previous.stage}:null};
 }));
}
