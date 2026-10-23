import assert from 'node:assert/strict';
import test from 'node:test';
import { newEstimate, type Site } from '../src/lib/commercial-estimate';
import {
  emptyCommercialPortfolio, decodeCommercialPortfolio, encodeCommercialPortfolio,
  savePortfolioProject,
} from '../src/lib/atlas-commercial-portfolio';
import {
  emptyFieldCrewPlan, fieldCrewCapacity, fieldWorkforceFindings,
  internalFieldMissionPacket, validateFieldCrewPlan,
} from '../src/lib/atlas-field-mission';

const org='00000000-0000-4000-8000-000000000001';
const at='2026-10-22T16:00:00.000Z';
const id='field-project-1';
const plan={crewSize:2,productiveHoursPerPersonDay:6,plannedFieldDays:2,stagingNote:'PRIVATE STAGING ACCESS CODE'};
const create=(crew=plan)=>{
  const input=newEstimate();
  input.sites[0]={...input.sites[0],name:'West Building',location:'PRIVATE STREET / UNIT',notes:'PRIVATE SITE NOTES',crewHours:30};
  const p=savePortfolioProject(emptyCommercialPortfolio(org),org,id,{
    name:'Industrial campus',input,review:[false,false,false,false,false],
    phase:'scoping',bookingId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',plannedAssetIds:['asset-a'],
    fieldCrewPlan:crew,
  },null,at);
  return p;
};

test('new field plan defaults to unknown rather than an invented staff capacity',()=>{
  const p=emptyFieldCrewPlan();
  assert.equal(p.crewSize,null);
  assert.equal(p.plannedFieldDays,null);
  const result=fieldCrewCapacity(newEstimate(),p);
  assert.equal(result.state,'not-modeled');
  assert.equal(result.plannedPaidCrewHourCapacity,null);
  assert.equal(result.capacityGapHours,null);
  assert.equal(result.estimatedMinimumFieldDays,null);
  assert.equal(result.utilizationPct,null);
});

test('crew model compares PAID person-hours to entered production-day capacity and rounds up days',()=>{
  const input=newEstimate();
  input.sites[0].crewHours=30;
  const result=fieldCrewCapacity(input,plan);
  assert.deepEqual({
    state:result.state,required:result.requiredPaidCrewHours,capacity:result.plannedPaidCrewHourCapacity,
    gap:result.capacityGapHours,days:result.estimatedMinimumFieldDays,utilization:result.utilizationPct,
  },{state:'shortfall',required:30,capacity:24,gap:-6,days:3,utilization:125});
  assert.equal(fieldWorkforceFindings(input,plan)[0].severity,'attention');
  const covered=fieldCrewCapacity(input,{...plan,plannedFieldDays:3});
  assert.equal(covered.state,'assumptions-fit');
  assert.equal(covered.capacityGapHours,6);
  assert.equal(covered.estimatedMinimumFieldDays,3);
  assert.equal(fieldWorkforceFindings(input,{...plan,plannedFieldDays:3})[0].severity,'review');
});

test('zero labor hours cannot be treated as an approved safe/staffed plan',()=>{
  const input=newEstimate();
  input.sites[0].crewHours=0;
  const result=fieldCrewCapacity(input,plan);
  assert.equal(result.state,'no-labor-entered');
  assert.equal(result.estimatedMinimumFieldDays,null);
  assert.equal(fieldWorkforceFindings(input,plan)[0].id,'labor-zero');
});

test('crew planning captures access assessment and lift-rental omissions, not safety approval',()=>{
  const input=newEstimate();
  input.sites=[
    {...input.sites[0],access:'review'},
    {...input.sites[0],id:'site-two',name:'Second',access:'lift',liftDays:0},
  ] satisfies Site[];
  assert.deepEqual(fieldWorkforceFindings(input,emptyFieldCrewPlan()).map(f=>f.id),
    ['crew-unmodeled','access-unassessed','rental-unmodeled','high-access']);
  assert.equal(fieldWorkforceFindings(input,emptyFieldCrewPlan()).every(f=>!f.text.includes('approved')),true);
});

test('invalid crew input is rejected rather than clamped invisibly by a source import',()=>{
  assert.throws(()=>validateFieldCrewPlan({...plan,crewSize:0}),/Crew size/);
  assert.throws(()=>validateFieldCrewPlan({...plan,crewSize:1.5}),/Crew size/);
  assert.throws(()=>validateFieldCrewPlan({...plan,crewSize:Infinity}),/Crew size/);
  assert.throws(()=>validateFieldCrewPlan({...plan,plannedFieldDays:46}),/Planned field days/);
  assert.throws(()=>validateFieldCrewPlan({...plan,productiveHoursPerPersonDay:12.5}),/Productive hours/);
  assert.throws(()=>validateFieldCrewPlan({...plan,productiveHoursPerPersonDay:6.3}),/Productive hours/);
  assert.throws(()=>validateFieldCrewPlan({...plan,stagingNote:'X'.repeat(1801)}),/note/);
  assert.throws(()=>validateFieldCrewPlan({...plan,stagingNote:'unsafe\u0000payload'}),/note/);
  assert.deepEqual(validateFieldCrewPlan(undefined),emptyFieldCrewPlan());
});

test('new field crew plan is versioned with each local project; legacy portfolio loads with UNKNOWN defaults',()=>{
  const data=create();
  const project=data.projects[0];
  assert.deepEqual(project.fieldCrewPlan,plan);
  assert.deepEqual(decodeCommercialPortfolio(encodeCommercialPortfolio(data,org),org),data);
  const oldRecord={...project};
  delete oldRecord.fieldCrewPlan;
  const legacy={...data,projects:[oldRecord]};
  const imported=decodeCommercialPortfolio(JSON.stringify(legacy),org);
  assert.deepEqual(imported.projects[0].fieldCrewPlan,emptyFieldCrewPlan());
  const modified=savePortfolioProject(imported,org,id,{
    name:project.name,input:project.input,review:project.review,
    phase:project.phase,bookingId:project.bookingId,plannedAssetIds:project.plannedAssetIds,
    fieldCrewPlan:{...plan,crewSize:3},
  },project.revision,'2026-10-22T17:00:00.000Z');
  assert.equal(modified.projects[0].fieldCrewPlan?.crewSize,3);
  assert.equal(modified.projects[0].revision,project.revision+1);
  assert.equal(imported.projects[0].fieldCrewPlan?.crewSize,null);
  const corrupt=JSON.parse(encodeCommercialPortfolio(data,org));
  corrupt.projects[0].fieldCrewPlan.plannedFieldDays=-1;
  assert.throws(()=>decodeCommercialPortfolio(JSON.stringify(corrupt),org),/Planned field days/);
});

test('internal field pack omits private addresses, site notes, crew staging notes, customer prices and names',()=>{
  const project=create().projects[0];
  const packet=internalFieldMissionPacket({
    organizationId:org,
    project,
    booking:{id:project.bookingId!,date:'2026-11-12',time_block:'9 to 12',status:'confirmed'},
    bookingState:'loaded-active',
    assets:[{id:'asset-a',name:'Washer Unit 4',state:'needs-service'}],
    linkedTasks:[{id:'task-1',title:'Confirm lift plan',stage:'Review'}],
    localToday:'2026-10-22',
  });
  assert.match(packet,/30 paid crew-hours/);
  assert.match(packet,/Minimum estimated field days under inputs: 3/);
  assert.match(packet,/Washer Unit 4/);
  assert.match(packet,/Exact authorized source booking ID: aaaaaaaa/);
  assert.match(packet,/task-1/);
  assert.doesNotMatch(packet,/PRIVATE STREET|PRIVATE SITE NOTES|PRIVATE STAGING ACCESS CODE/);
  assert.doesNotMatch(packet,/automatically dispatched|automatically approved/i);
  assert.match(packet,/NOT A DISPATCH ORDER/);
});

test('unknown or mis-matched source bookings never yield a verified time/date in a field packet',()=>{
  const project=create().projects[0];
  for(const variant of [
    {bookingState:'not-loaded' as const,booking:null},
    {bookingState:'loaded-active' as const,booking:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',date:'2026-11-12',time_block:'9 to 12',status:'confirmed'}},
    {bookingState:'loaded-inactive' as const,booking:{id:project.bookingId!,date:'2026-11-12',time_block:'9 to 12',status:'cancelled'}},
  ]){
    const packet=internalFieldMissionPacket({
      organizationId:org,project,assets:[],linkedTasks:[],localToday:'2026-10-22',...variant,
    });
    assert.match(packet,/Source booking date: UNKNOWN/);
    assert.doesNotMatch(packet,/Exact authorized source booking ID:/);
  }
});
