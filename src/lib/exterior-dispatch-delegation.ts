import type {ExtBooking,ExtLead} from './exterior';
import type {DispatchFinding,DispatchPreflightRow} from './exterior-dispatch-preflight';

/** A source-bound operational TASK. This is not customer contact, accepted
 * scope, job completion, or staff/rig dispatch confirmation. */
const guidance:Record<string,string>={
 'pending-approval':'Verify the pending booking approval in the original booking source. Record the actual outcome before dispatching anyone.',
 'unconfirmed-status':'Review the original booking status and resolve the unconfirmed visit before scheduling crew work.',
 'lead-absent':'Restore the exact customer linkage from the authorized source before creating an assignment.',
 'customer-name':'Verify the customer name in the original customer source and correct it before dispatch.',
 'site-address':'Verify and record the service address in the authorized customer source before the crew travels.',
 'scope':'Verify the customer requested services and record a clear job scope in the original source.',
 'contact':'Verify a usable customer contact number in the original source before relying on outreach.',
 'time':'Confirm a real booking time with the customer and correct the original appointment record.',
 'overlap':'Compare the overlapping bookings and confirm real crew, vehicle and equipment capacity before assigning them.',
 'quote-identity':'Verify the price for this specific visit in the source record. A lead-level quote alone does not establish this visit price.',
};
export const dispatchAssignableFindings=new Set(Object.keys(guidance));

/** The incoming row is display-only. Always bind it to the actual loaded
 * booking and lead (and then re-query both again under server-side RLS). */
export function eligibleDispatchAssignment(
 row:DispatchPreflightRow,booking:ExtBooking|undefined,lead:ExtLead|undefined,
):boolean{
 return !!booking&&!!lead&&row.leadId===lead.id&&booking.id===row.id&&
  booking.lead_id===lead.id&&booking.date===row.date&&
  booking.status!==null&&booking.status!== 'denied'&&booking.status!=='cancelled'&&
  row.status===booking.status&&
  row.findings.length>0;
}
export function dispatchAssignmentOptions(row:DispatchPreflightRow):DispatchFinding[]{
 return row.findings.filter(f=>dispatchAssignableFindings.has(f.code));
}
/** Deliberately excludes names, addresses, phone, prices, private labor, and
 * customer text. The operator can review/alter before explicit publication. */
export function suggestDispatchAssignment(row:DispatchPreflightRow,issueCode:string):string|null{
 if(!row.findings.some(x=>x.code===issueCode))return null;
 const instruction=guidance[issueCode];
 if(!instruction)return null;
 return 'Dispatch follow-up: '+instruction;
}
export function dispatchAssignmentDueDay(row:DispatchPreflightRow,issueCode:string,today:string):string{
 const finding=row.findings.find(f=>f.code===issueCode);
 if(!finding||finding.level==='blocker')return today;
 return row.date>=today?row.date:today;
}
export function dispatchAssignmentPriority(row:DispatchPreflightRow,issueCode:string):'high'|'normal'{
 return row.findings.find(f=>f.code===issueCode)?.level==='blocker'?'high':'normal';
}
