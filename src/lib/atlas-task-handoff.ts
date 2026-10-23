import type { Card } from './board';
import type { CommercialProject } from './atlas-commercial-portfolio';
import type { JobItem } from '@/app/workspace/exterior-actions';
import { validDay } from './fleet-command';
import type { FleetWorkbook } from './fleet-command';
import { fieldBridgeReport, internalFieldBrief, type CommercialPlan } from './atlas-field-bridge';

type HandoffDraft = Pick<Card,'business'|'title'|'description'|'priority'|'due_date'>;
const clean = (value:string,limit:number) => value.replace(/[\r\n\t]/g,' ').trim().slice(0,limit);

/**
 * A one-time TEXT SNAPSHOT in a user-reviewed shared task draft.
 * No canonical bid/asset relation is invented for browser-local workbooks.
 * The ordinary board editor must still be explicitly saved by the user.
 */
export function commercialReviewTask(plan:CommercialPlan, fleet:FleetWorkbook|null, day:string):HandoffDraft{
  const report=fieldBridgeReport(plan,fleet,day);
  const reference=clean(plan.name,115)||'Unnamed opportunity';
  return {
    business:'exterior',priority:'normal',due_date:'',
    title:'Review commercial bid: '+reference,
    description:[
      'COMMERCIAL REVIEW — source snapshot from the creating user’s DEVICE-LOCAL workbook.',
      'The original bid and fleet workbook are NOT synchronized. This text snapshot is visible to authorized company task members only after you choose Save.',
      '',
      internalFieldBrief(report,day),
      '',
      'Next: review site conditions, realistic labor, rental/provider terms, crew capacity, equipment condition, permits and founder approval. No client quote, booking, rental or payment was created.',
      'Original local editor (only available on the source device): /workspace/b/exterior/commercial',
    ].join('\n').slice(0,7900),
  };
}
export function fleetReviewTask(fleet:FleetWorkbook,day:string):HandoffDraft{
  const report=fieldBridgeReport(null,fleet,day);
  return {
    business:'exterior',priority:'normal',due_date:'',
    title:'Inspect fleet readiness and outstanding service',
    description:[
      'FLEET FOLLOW-UP — source snapshot from the creating user’s DEVICE-LOCAL workbook.',
      'The original fleet workbook is NOT synchronized. This is a manually reviewed task draft, not dispatch permission.',
      '',
      internalFieldBrief(report,day),
      '',
      'Next: inspect the actual equipment, complete a fresh pre-departure checklist for the specific job, verify capacity and assign accountable follow-up.',
      'Original local Fleet Command (only available on the source device): /workspace/tools/fleet',
    ].join('\n').slice(0,7900),
  };
}

/**
 * Converts a VERIFIED local portfolio snapshot into an ordinary user-reviewed
 * task draft. Booking deep-link receipt appears only when its exact ID has
 * actually been returned by an authorized Exterior bookings source.
 * Local portfolio IDs are NOT resolvable on other founder devices.
 */
export function commercialPortfolioTask(
  project:CommercialProject,fleet:FleetWorkbook|null,day:string,
  loadedBooking:JobItem|null,
):HandoffDraft{
  if(project.phase==='archived')throw new Error('Archived local projects must be restored before task preparation.');
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(project.id))throw new Error('Invalid local project ID.');
  const task=commercialReviewTask(project,fleet,day);
  const linked=!!project.bookingId&&!!loadedBooking&&
    loadedBooking.id.toLowerCase()===project.bookingId.toLowerCase()&&
    loadedBooking.status!=='cancelled'&&loadedBooking.status!=='denied'&&
    validDay(loadedBooking.date);
  const projectReceipt=[
    'Local portfolio project ID: '+project.id,
    'Local project revision: '+project.revision+' · saved '+project.updatedAt,
    'Locally planned candidate equipment IDs: '+project.plannedAssetIds.length+'. These are NOT reserved or dispatched.',
    linked
      ? 'Booking source verified by exact currently loaded ID; this does NOT approve or complete the booking.'
      : project.bookingId
        ? 'Booking reference exists in the LOCAL project, but the matching active booking was not verified in currently loaded source records.'
        : 'No source booking linked to this local project.',
    ...(linked?[
      'Booking record ID: '+loadedBooking!.id,
      'Source booking: /workspace/b/exterior/calendar',
      'Source booking status at task creation: '+clean(loadedBooking!.status??'unknown',40),
      'Source booking date: '+loadedBooking!.date,
    ]:[]),
  ];
  return {
    ...task,
    description:[task.description.slice(0,6500),'',...projectReceipt].join('\n').slice(0,7900),
  };
}
/** Recognize only explicit local project IDs in user-saved task bodies. This is
 * a same-device relationship hint, never a server-side authoritative FK.
 */
export function exactLocalProjectIds(description:string):string[]{
  const expression=/^Local portfolio project ID:\s*([A-Za-z0-9_-]{1,80})\s*$/gm;
  return [...new Set([...description.matchAll(expression)].map(match=>match[1]))];
}
