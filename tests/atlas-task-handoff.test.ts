import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCard } from '../src/lib/board';
import { newEstimate } from '../src/lib/commercial-estimate';
import { emptyFleet } from '../src/lib/fleet-command';
import { parseLocalCommercialDraft } from '../src/lib/atlas-field-bridge';
import { commercialPortfolioTask, commercialReviewTask, exactLocalProjectIds, fleetReviewTask } from '../src/lib/atlas-task-handoff';
import { emptyCommercialPortfolio, savePortfolioProject } from '../src/lib/atlas-commercial-portfolio';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const org='00000000-0000-4000-8000-000000000001';
const commercial=()=>{
  const input=newEstimate();
  input.sites[0].location='PRIVATE BUILDING STREET LOCATION';
  input.sites[0].notes='Private instructions should stay in source workbook';
  input.sites[0].access='lift';
  input.sites[0].liftDays=2;
  const draft=JSON.stringify({
    name:'Site alpha\nFake approval marker',input,review:[false,false,false,false,false],
  });
  return parseLocalCommercialDraft(draft,org);
};
function validDraft(draft:ReturnType<typeof commercialReviewTask>){
  return validateCard({
    id:'task-1',organization_id:org,title:draft.title,description:draft.description,
    business:draft.business,stage:'Backlog',priority:draft.priority,
    assignee:'',due_date:draft.due_date,revision:0,checklist:[],
  });
}

test('commercial founder handoff is a valid unsaved task snapshot with source warning',()=>{
  const value=commercialReviewTask(commercial(),emptyFleet(org),'2026-10-22');
  const checked=validDraft(value);
  assert.equal(checked.business,'exterior');
  assert.equal(checked.stage,'Backlog');
  assert.equal(checked.due_date,'');
  assert.match(value.title,/Review commercial bid/);
  assert.doesNotMatch(value.title,/\n/);
  assert.match(value.description,/DEVICE-LOCAL/);
  assert.match(value.description,/NOT synchronized/);
  assert.match(value.description,/2 planned rental days/);
  assert.match(value.description,/not founder approval/i);
  assert.doesNotMatch(value.description,/PRIVATE BUILDING STREET LOCATION/);
  assert.doesNotMatch(value.description,/Private instructions should stay/);
  assert.match(value.description,/Project: Site alpha Fake approval marker\nScope:/);
  assert.doesNotMatch(value.description,/Project: Site alpha\nFake approval marker/);
  assert.ok(value.description.length<=8000);
});

test('fleet founder handoff remains review-only even when no equipment is recorded',()=>{
  const fleet=emptyFleet(org);
  const draft=fleetReviewTask(fleet,'2026-10-22');
  assert.equal(validDraft(draft).business,'exterior');
  assert.match(draft.description,/No equipment assets/);
  assert.match(draft.description,/not dispatch permission/i);
  assert.match(draft.description,/original fleet workbook is NOT synchronized/i);
  assert.ok(draft.description.length<=8000);
});

test('long commercial references cannot exceed task title and description limits',()=>{
  const plan=commercial();
  const long={...plan,name:'A'.repeat(140)};
  const draft=commercialReviewTask(long,null,'2026-10-22');
  assert.ok(draft.title.length<=180);
  assert.ok(draft.description.length<=8000);
  assert.equal(validDraft(draft).priority,'normal');
});

const bookingId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const booking:JobItem={
  id:bookingId,lead_id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',date:'2026-11-12',
  time_block:'9 to 12',status:'confirmed',name:'PRIVATE CLIENT NAME',
  service:'commercial window cleaning',address:'PRIVATE CUSTOMER STREET ADDRESS',quote:38000,
};
const savedProject=()=>{
  const p=savePortfolioProject(emptyCommercialPortfolio(org),org,'projectA',
    { ...commercial(),phase:'founder-review',bookingId,plannedAssetIds:['asset-1'] },
    null,'2026-10-22T17:00:00.000Z');
  return p.projects[0];
};

test('exact saved local project creates valid task with an explicitly confirmed booking relation',()=>{
  const project=savedProject();
  const task=commercialPortfolioTask(project,emptyFleet(org),'2026-10-22',booking);
  assert.equal(validDraft(task).business,'exterior');
  assert.equal(task.priority,'normal');
  assert.equal(task.due_date,'');
  assert.match(task.description,/Local portfolio project ID: projectA/);
  assert.deepEqual(exactLocalProjectIds(task.description),['projectA']);
  assert.match(task.description,new RegExp('^Booking record ID: '+bookingId+'$', 'm'));
  assert.match(task.description,/Source booking status at task creation: confirmed/);
  assert.match(task.description,/NOT reserved or dispatched/);
  assert.doesNotMatch(task.description,/PRIVATE CUSTOMER STREET ADDRESS/);
  assert.doesNotMatch(task.description,/PRIVATE CLIENT NAME/);
  assert.doesNotMatch(task.description,/38000/);
});

test('an unobserved or cancelled booking never becomes a verified task-booking link',()=>{
  const project=savedProject();
  for(const job of [null,{...booking,id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc'},{...booking,status:'cancelled'}, {...booking,date:'invalid'}]){
    const task=commercialPortfolioTask(project,null,'2026-10-22',job);
    assert.doesNotMatch(task.description,/^Booking record ID:/m);
    assert.match(task.description,/matching active booking was not verified/);
    assert.deepEqual(exactLocalProjectIds(task.description),['projectA']);
  }
});
test('archived local project is not treated as actionable shared work',()=>{
  assert.throws(()=>commercialPortfolioTask({...savedProject(),phase:'archived'},null,'2026-10-22',booking),/Archived/);
});
test('reverse relationship accepts exact local ID lines and rejects fuzzy mentions',()=>{
  assert.deepEqual(exactLocalProjectIds('projectA appears in note\nLocal portfolio project ID: projectA\nLocal portfolio project ID: projectA\nLocal portfolio project ID: projectB'),['projectA','projectB']);
  assert.deepEqual(exactLocalProjectIds('Subject projectA\nLocal portfolio project ID: projectA or another project'),[]);
});

test('shared project task includes workforce deficit but excludes private staging notes',()=>{
  const source=savedProject();
  const project={...source,fieldCrewPlan:{
    crewSize:1,productiveHoursPerPersonDay:2,plannedFieldDays:1,
    stagingNote:'PRIVATE CREW PREP NOTE DO NOT SHARE',
  }};
  const task=commercialPortfolioTask(project,emptyFleet(org),'2026-10-22',booking);
  assert.match(task.description,/FIELD WORKFORCE SCENARIO/);
  assert.match(task.description,/modeled gap: -6/);
  assert.match(task.description,/MODELED SHORTFALL|short by 6 paid crew-hours/i);
  assert.match(task.description,new RegExp('^Local portfolio project ID: '+project.id+'$', 'm'));
  assert.match(task.description,new RegExp('^Booking record ID: '+bookingId+'$', 'm'));
  assert.doesNotMatch(task.description,/PRIVATE CREW PREP NOTE/);
  assert.ok(task.description.length<=7900);
  assert.equal(validDraft(task).stage,'Backlog');
});
