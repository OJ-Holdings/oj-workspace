import type { Card } from './board';
import type { FleetWorkbook } from './fleet-command';
import { assetHealth, validDay } from './fleet-command';

/**
 * User-reviewed SHARED task draft from an existing DEVICE-LOCAL Fleet asset.
 * Neither this snapshot nor matching its textual ID makes Fleet assets shared,
 * reserves parts, authorizes a repair, or records a certified inspection.
 */
export type FleetServiceTaskDraft=Pick<Card,'business'|'title'|'description'|'priority'|'due_date'>;
const idPattern=/^[A-Za-z0-9_-]{1,80}$/;
const inline=(value:string,max:number)=>value.replace(/[\r\n\t\u0000-\u001f]/g,' ').trim().slice(0,max);
export function exactLocalFleetAssetIds(description:string):string[]{
  if(typeof description!=='string')return [];
  const expression=/^Local fleet asset ID:\s*([A-Za-z0-9_-]{1,80})[ \t]*$/gm;
  return [...new Set([...description.matchAll(expression)].map(match=>match[1]))];
}
export function fleetServiceTask(
  fleet:FleetWorkbook,assetId:string,day:string,
):FleetServiceTaskDraft{
  if(!idPattern.test(assetId))throw new Error('Invalid local Fleet asset identifier.');
  if(!validDay(day))throw new Error('A valid local calendar date is required for the equipment review.');
  const asset=fleet.assets.find(a=>a.id===assetId);
  if(!asset)throw new Error('The selected asset is not in this validated local Fleet workbook.');
  const health=assetHealth(asset,day);
  const service=fleet.maintenance.filter(m=>m.assetId===assetId);
  const last=service.slice().sort((a,b)=>b.date.localeCompare(a.date))[0];
  const priority=health==='needs-service'||health==='out-of-service'||health==='due'?'high':'normal';
  return {
    business:'exterior',title:'Review fleet service: '+(inline(asset.name,118)||'Unnamed equipment'),
    priority,due_date:'',
    description:[
      'FLEET SERVICE FOLLOW-UP — manually prepared task draft. Nothing has been repaired or authorized.',
      'The original Fleet workbook is PRIVATE to the creating device; the other founder sees only this text if you explicitly save the task.',
      '',
      'Local fleet asset ID: '+assetId,
      'Asset name: '+inline(asset.name,140),
      'Equipment kind: '+asset.kind+' | model: '+(inline(asset.model,120)||'not recorded'),
      'Manual equipment status: '+asset.status,
      'Service condition evaluated for '+day+': '+health+' (based solely on entered information)',
      'Entered meter: '+(asset.reading===null?'UNKNOWN':asset.reading+' '+asset.unit),
      'Next manually entered service threshold: '+(asset.nextServiceReading===null?'UNKNOWN':asset.nextServiceReading+' '+asset.unit),
      'Next manually entered service date: '+(asset.nextServiceDate??'UNKNOWN'),
      'Local service ledger count: '+service.length+' (not proof of actual maintenance or accounting expenses)',
      'Most recent locally logged service date: '+(last?.date??'UNKNOWN'),
      '',
      'REQUIRED FOLLOW-UP:',
      'Inspect the equipment physically, verify faults and risks, determine qualified technician/parts/repair actions and update the local service ledger with truthful evidence.',
      'Check safety, pressure, chemical, electrical and PPE risks as applicable before re-enabling field use.',
      'Source UI (available only on the creating device): /workspace/tools/fleet',
      '',
      'NOT A PURCHASE ORDER, PARTS RESERVATION, DISPATCH CLEARANCE, INSPECTION CERTIFICATE, INVOICE OR PAYMENT.',
      'The task must be reviewed and saved manually; no crew member is automatically assigned.',
    ].join('\n').slice(0,7900),
  };
}
