import type {ExtBooking} from './exterior';
import {actionableJobStatus,type SharedJobFollowup} from './exterior-job-followup';
import {originalJobMatchesTask} from './exterior-operations-inbox';

/**
 * R43: a protected company task is NOT a work order or verified crew dispatch.
 * Each interactive job action must match BOTH the original source snapshot
 * loaded by the authenticated server and the task's original source receipt.
 */
export type OriginalBookingSnapshot={
 date:string;time:string|null;status:string|null;
};
export function originalBookingActionable(
 booking:ExtBooking,server:OriginalBookingSnapshot|null,
):boolean{
 return !!server&&booking.lead_id!==null&&
 actionableJobStatus(booking.status)&&
 booking.date===server.date&&booking.time_block===server.time&&
 booking.status===server.status;
}
export function linkedTaskActionable(
 task:SharedJobFollowup,booking:ExtBooking,server:OriginalBookingSnapshot|null,
):boolean{
 return originalBookingActionable(booking,server)&&originalJobMatchesTask(task,booking);
}
/** Guard the common accidental double-click/reload case; only an operator
 * intent confirmation can create another identical live team assignment. */
export function existingOpenJobAction(
 tasks:readonly SharedJobFollowup[],assignee:string,note:string,
):SharedJobFollowup|null{
 const normalized=note.trim().replace(/\s+/g,' ').toLowerCase();
 const name=assignee.trim();
 if(normalized.length<10||!name)return null;
 return tasks.find(t=>t.stage!=='Done'&&t.assignee===name&&
  t.note.trim().replace(/\s+/g,' ').toLowerCase()===normalized)??null;
}
export function validOperatorNote(note:string,min=3,max=600):boolean{
 return typeof note==='string'&&note.trim().length>=min&&note.length<=max&&
  !/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(note);
}
