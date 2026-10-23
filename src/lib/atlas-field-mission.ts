import { calculateEstimate, type EstimateInput } from './commercial-estimate';
import { validDay } from './fleet-command';

/** Private, operator-entered WORKFORCE SCENARIO. No crew member is assigned,
 * booked, paid or verified by recording this plan. */
export type FieldCrewPlan = {
  crewSize: number | null;
  productiveHoursPerPersonDay: number | null;
  plannedFieldDays: number | null;
  stagingNote: string;
};
export const emptyFieldCrewPlan = (): FieldCrewPlan => ({
  crewSize: null, productiveHoursPerPersonDay: null, plannedFieldDays: null, stagingNote: '',
});
export type CrewCapacity = {
  requiredPaidCrewHours: number;
  crewSize: number | null;
  productiveHoursPerPersonDay: number | null;
  plannedFieldDays: number | null;
  plannedPaidCrewHourCapacity: number | null;
  estimatedMinimumFieldDays: number | null;
  capacityGapHours: number | null;
  utilizationPct: number | null;
  state: 'not-modeled' | 'no-labor-entered' | 'shortfall' | 'assumptions-fit';
};
export type FieldPackFinding = { id: string; severity: 'attention' | 'review' | 'unknown'; text: string };

const record = (raw: unknown): Record<string, unknown> => {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw))
    throw new Error('Field crew plan must be an object.');
  return raw as Record<string, unknown>;
};
const count = (value: unknown, label: string, maximum: number): number | null => {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1 || value > maximum)
    throw new Error(label + ' must be a whole number from 1 to ' + maximum + '.');
  return value;
};
const duration = (value: unknown): number | null => {
  if (value === null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0.5 || value > 12 ||
      Math.round(value * 4) !== value * 4)
    throw new Error('Productive hours per person per day must be 0.5–12 in quarter-hour increments.');
  return value;
};
export function validateFieldCrewPlan(raw: unknown): FieldCrewPlan {
  if (raw === undefined || raw === null) return emptyFieldCrewPlan(); // old R08–R10 portfolios
  const data = record(raw);
  if (typeof data.stagingNote !== 'string' || data.stagingNote.length > 1800 ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(data.stagingNote))
    throw new Error('Private field staging note is invalid or too long.');
  return {
    crewSize: count(data.crewSize, 'Crew size', 40),
    productiveHoursPerPersonDay: duration(data.productiveHoursPerPersonDay),
    plannedFieldDays: count(data.plannedFieldDays, 'Planned field days', 45),
    stagingNote: data.stagingNote,
  };
}
const round = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;
export function fieldCrewCapacity(estimate: EstimateInput, plan: FieldCrewPlan): CrewCapacity {
  const validated = validateFieldCrewPlan(plan);
  const requiredPaidCrewHours = calculateEstimate(estimate).crewHours;
  const { crewSize, productiveHoursPerPersonDay, plannedFieldDays } = validated;
  const haveDaily = crewSize !== null && productiveHoursPerPersonDay !== null;
  const haveAll = haveDaily && plannedFieldDays !== null;
  const plannedPaidCrewHourCapacity = haveAll ? round(crewSize * productiveHoursPerPersonDay * plannedFieldDays) : null;
  const estimatedMinimumFieldDays = haveDaily && requiredPaidCrewHours > 0
    ? Math.ceil(requiredPaidCrewHours / (crewSize * productiveHoursPerPersonDay)) : null;
  const capacityGapHours = plannedPaidCrewHourCapacity === null ? null
    : round(plannedPaidCrewHourCapacity - requiredPaidCrewHours);
  const utilizationPct = plannedPaidCrewHourCapacity && requiredPaidCrewHours > 0
    ? round(requiredPaidCrewHours / plannedPaidCrewHourCapacity * 100) : null;
  const state: CrewCapacity['state'] = requiredPaidCrewHours <= 0 ? 'no-labor-entered'
    : !haveAll ? 'not-modeled'
    : capacityGapHours! < 0 ? 'shortfall' : 'assumptions-fit';
  return {
    requiredPaidCrewHours, crewSize, productiveHoursPerPersonDay, plannedFieldDays,
    plannedPaidCrewHourCapacity, estimatedMinimumFieldDays, capacityGapHours, utilizationPct, state,
  };
}
export function fieldWorkforceFindings(estimate: EstimateInput, plan: FieldCrewPlan): FieldPackFinding[] {
  const result = fieldCrewCapacity(estimate, plan);
  const findings: FieldPackFinding[] = [];
  if (result.state === 'no-labor-entered')
    findings.push({id:'labor-zero',severity:'unknown',text:'No paid crew-hours are entered in the estimate. Duration and crew coverage cannot be calculated.'});
  else if (result.state === 'not-modeled')
    findings.push({id:'crew-unmodeled',severity:'unknown',text:'Enter crew size, productive hours per person per day, and planned field days to evaluate paid-labor capacity.'});
  else if (result.state === 'shortfall')
    findings.push({id:'crew-shortfall',severity:'attention',text:
      'Under your assumptions, planned field capacity is short by '+round(-result.capacityGapHours!)+' paid crew-hours. Increase crew/day count or revisit the original site labor estimate.'});
  else findings.push({id:'crew-fit',severity:'review',text:
    'Entered workforce capacity covers estimated paid crew-hours on paper. Actual crew availability, elapsed job duration, breaks, travel, qualifications and productivity remain unverified.'});
  const reviewSites = estimate.sites.filter(s=>s.access==='review');
  if(reviewSites.length) findings.push({
    id:'access-unassessed',severity:'attention',
    text:reviewSites.length+' building(s) still have access strategy marked for site review.',
  });
  const missingRental = estimate.sites.filter(s=>s.access==='lift'&&s.liftDays===0);
  if(missingRental.length) findings.push({
    id:'rental-unmodeled',severity:'attention',
    text:missingRental.length+' lift-access building(s) have zero rental days entered.',
  });
  if(estimate.sites.some(s=>s.access==='lift'))findings.push({
    id:'high-access',severity:'review',
    text:'High-access work requires qualified site assessment, equipment/operator suitability, insurance, site permission and rental-provider confirmation. A planned lift day is not a reservation.',
  });
  return findings;
}

export type FieldPacketContext = {
  organizationId: string;
  project: {
    id: string; name: string; revision: number; phase: 'scoping'|'founder-review'|'archived';
    input: EstimateInput; review: boolean[]; plannedAssetIds: string[]; bookingId: string|null;
    fieldCrewPlan?: FieldCrewPlan;
  };
  // These facts originate in authorized, CURRENTLY LOADED same-workspace UI context.
  booking: { id: string; date: string; time_block: string|null; status: string|null } | null;
  bookingState: 'unlinked'|'loaded-active'|'loaded-inactive'|'not-loaded';
  assets: { id:string; name:string; state:string }[];
  linkedTasks: { id:string; title:string; stage:string }[];
  localToday: string;
};
const oneLine = (input: string, maximum: number): string =>
  input.replace(/[\r\n\t\u0000-\u001f]/g,' ').trim().slice(0,maximum);
const num = (n:number|null,unit=''):string=>n===null?'UNKNOWN':String(n)+unit;
export function internalFieldMissionPacket(ctx: FieldPacketContext): string {
  const {project}=ctx;
  const crew = fieldCrewCapacity(project.input,project.fieldCrewPlan??emptyFieldCrewPlan());
  const estimate = calculateEstimate(project.input);
  const findings = fieldWorkforceFindings(project.input,project.fieldCrewPlan??emptyFieldCrewPlan());
  const verified = ctx.bookingState==='loaded-active' && ctx.booking!==null &&
    ctx.booking.id.toLowerCase()===project.bookingId?.toLowerCase() &&
    validDay(ctx.booking.date) && ctx.booking.status!=='cancelled' && ctx.booking.status!=='denied';
  return [
    'OJ EXTERIOR CARE / ATLAS — INTERNAL FIELD MISSION PACK',
    'CONFIDENTIAL FIELD PLANNING • NOT A DISPATCH ORDER, CONTRACT, APPROVED PRICE OR SAFETY CERTIFICATION',
    'Generated local planning day: '+oneLine(ctx.localToday,20),
    'Organization scope: '+oneLine(ctx.organizationId,80),
    'Local project: '+oneLine(project.name,140),
    'Project ID: '+oneLine(project.id,80)+' | revision '+String(project.revision),
    'Local workflow status: '+project.phase+' (not client approval)',
    '',
    'SOURCE BOOKING',
    verified
      ? 'Exact authorized source booking ID: '+ctx.booking!.id
      : 'Booking: UNKNOWN / NOT VERIFIED from a currently loaded exact source.',
    verified ? 'Source booking calendar date: '+ctx.booking!.date : 'Source booking date: UNKNOWN',
    verified ? 'Source booking time block: '+oneLine(ctx.booking!.time_block??'not entered',60) : 'Source booking time: UNKNOWN',
    '',
    'WORK SCOPE — THESE ARE PLANNING INPUTS',
    'Buildings: '+estimate.sites+' | approximate panes: '+estimate.panes,
    'Paid labor budget: '+estimate.crewHours+' person-hours; NOT elapsed work hours',
    'Summed planned lift rental days: '+estimate.liftDays+'; NOT confirmed rentals',
    ...project.input.sites.slice(0,12).map((s,i)=>
      '  '+(i+1)+'. '+oneLine(s.name||'Building',100)+' | '+s.panes+' panes | '+s.crewHours+
      ' paid crew-hours | '+s.access+' access | '+s.liftDays+' entered lift days'),
    '',
    'CREW CAPACITY — MODELED, NOT STAFFED',
    'Crew: '+num(crew.crewSize)+' workers | productive hours/person/day: '+num(crew.productiveHoursPerPersonDay),
    'Planned field days: '+num(crew.plannedFieldDays)+' | modeled paid-hour capacity: '+num(crew.plannedPaidCrewHourCapacity),
    'Minimum estimated field days under inputs: '+num(crew.estimatedMinimumFieldDays),
    'Modeled capacity gap: '+num(crew.capacityGapHours,' paid hours')+' | '+crew.state,
    '',
    'CANDIDATE EQUIPMENT — NOT RESERVED OR INSPECTED FOR THIS JOB',
    ...(ctx.assets.length ? ctx.assets.slice(0,40).map(a=>
      '- '+oneLine(a.name,120)+' | local asset '+oneLine(a.id,80)+' | '+oneLine(a.state,50))
      : ['- None recorded / equipment unknown']),
    '',
    'LOADED SHARED TASK SNAPSHOTS — TASK PRESENCE IS NOT FOUNDER APPROVAL',
    ...(ctx.linkedTasks.length ? ctx.linkedTasks.slice(0,20).map(t=>
      '- '+oneLine(t.title,160)+' | '+oneLine(t.stage,40)+' | task '+oneLine(t.id,80))
      : ['- None with an exact local project ID in the currently loaded task list']),
    '',
    'OPEN WORKFORCE / ACCESS FINDINGS',
    ...findings.map(f=>'- ['+f.severity.toUpperCase()+'] '+f.text),
    '',
    'REQUIRED INDEPENDENT HUMAN CHECKS: weather, site access, hazards, PPE, permissions, client terms, confirmed crew, actual equipment condition, rentals, liability/worker coverage and authorized schedule.',
    'No invoices, revenue, customer payments, email, phone calls, equipment bookings, task assignments or dispatches were generated.',
    'This pack is the CURRENT EDITOR state and may contain UNSAVED changes; verify all sources again before field execution.',
    'If project or building NAMES themselves contain personal information, remove it before sharing this private pack.',
  ].join('\n').slice(0,16000);
}
