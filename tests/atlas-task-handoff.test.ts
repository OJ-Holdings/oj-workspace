import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCard } from '../src/lib/board';
import { newEstimate } from '../src/lib/commercial-estimate';
import { emptyFleet } from '../src/lib/fleet-command';
import { parseLocalCommercialDraft } from '../src/lib/atlas-field-bridge';
import { commercialReviewTask, fleetReviewTask } from '../src/lib/atlas-task-handoff';

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
  assert.doesNotMatch(value.description,/Fake approval marker\n/);
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
