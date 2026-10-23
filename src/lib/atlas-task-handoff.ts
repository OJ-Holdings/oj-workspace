import type { Card } from './board';
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
