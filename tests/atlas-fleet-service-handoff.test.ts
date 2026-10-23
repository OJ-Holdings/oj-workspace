import assert from 'node:assert/strict';
import test from 'node:test';
import { validateCard } from '../src/lib/board';
import { emptyFleet, encodeFleet, decodeFleet, type FleetAsset } from '../src/lib/fleet-command';
import { exactLocalFleetAssetIds, fleetServiceTask } from '../src/lib/atlas-fleet-service-handoff';

const org='00000000-0000-4000-8000-000000000001';
const today='2026-10-22';
const asset: FleetAsset={
  id:'washer-12',name:'Power Washer Alpha',kind:'pressure-washer',model:'Honda GX390',
  status:'needs-service',unit:'hours',reading:140,
  nextServiceReading:130,nextServiceDate:'2026-10-20',
  notes:'PRIVATE OWNER SERVICE INFORMATION / PIN 1234',
  createdAt:'2026-10-01T10:00:00.000Z',
};
const fleet=()=>{
  const workbook=emptyFleet(org);
  workbook.assets=[asset];
  workbook.maintenance=[{
    id:'maintenance-1',assetId:asset.id,date:'2026-10-12',
    summary:'PRIVATE INVOICE CUSTOMER PHONE 555-0101',
    cost:1325,reading:137,
  }];
  return decodeFleet(encodeFleet(workbook,org),org);
};
const check=(draft:ReturnType<typeof fleetServiceTask>)=>validateCard({
  id:'new-task-id',organization_id:org,stage:'Backlog',assignee:'',
  revision:0,checklist:[],...draft,
});

test('specific asset task uses exact saved local ID, recorded service facts and a reviewed shared draft',()=>{
  const draft=fleetServiceTask(fleet(),asset.id,today);
  const valid=check(draft);
  assert.equal(valid.business,'exterior');
  assert.equal(valid.stage,'Backlog');
  assert.equal(valid.priority,'high');
  assert.equal(valid.due_date,''); // never invent deadline from service thresholds
  assert.match(valid.title,/Power Washer Alpha/);
  assert.match(valid.description,/Local fleet asset ID: washer-12/);
  assert.match(valid.description,/Service condition evaluated for 2026-10-22: needs-service/);
  assert.match(valid.description,/Entered meter: 140 hours/);
  assert.match(valid.description,/2026-10-20/);
  assert.match(valid.description,/Local service ledger count: 1/);
  assert.match(valid.description,/NOT A PURCHASE ORDER/);
  assert.deepEqual(exactLocalFleetAssetIds(valid.description),['washer-12']);
  assert.ok(valid.description.length<8000);
});

test('service task never copies asset private notes, service descriptions or expense amounts',()=>{
  const body=fleetServiceTask(fleet(),asset.id,today).description;
  assert.doesNotMatch(body,/PRIVATE OWNER|PIN 1234|PRIVATE INVOICE|555-0101|1325/);
  assert.doesNotMatch(body,/repair completed|service certified|automatically reserved/i);
  assert.match(body,/not proof of actual maintenance/i);
});

test('asset handoff refuses unknown assets or invalid local calendar dates',()=>{
  assert.throws(()=>fleetServiceTask(fleet(),'no-such-asset',today),/not in this validated local Fleet workbook/);
  assert.throws(()=>fleetServiceTask(fleet(),'abc\nBooking record ID: spoof',today),/Invalid local Fleet asset identifier/);
  assert.throws(()=>fleetServiceTask(fleet(),asset.id,'not a day'),/valid local calendar date/);
  const current=fleet();current.assets=[];
  assert.throws(()=>fleetServiceTask(current,asset.id,today),/not in this validated local Fleet workbook/);
});

test('unverified fleet assets cannot be represented as verified, repaired or service-clear',()=>{
  const w=fleet();w.assets[0]={...w.assets[0],status:'unverified',nextServiceDate:null,nextServiceReading:null};
  const draft=fleetServiceTask(w,asset.id,today);
  assert.match(draft.description,/condition evaluated for 2026-10-22: monitor/);
  assert.equal(draft.priority,'normal');
});

test('asset name line injection remains literal text and cannot forge a booking/source relation',()=>{
  const w=fleet();
  w.assets[0]={...w.assets[0],name:'Washer\nBooking record ID: aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'};
  const draft=fleetServiceTask(w,asset.id,today);
  assert.doesNotMatch(draft.description,/^Booking record ID:/m);
  assert.doesNotMatch(draft.title,/\n/);
  assert.deepEqual(exactLocalFleetAssetIds(draft.description),['washer-12']);
});

test('reverse asset link recognizes only exact bounded source ID lines, not names or approximate matches',()=>{
  assert.deepEqual(exactLocalFleetAssetIds([
    'Washer washer-12 might need service',
    'Local fleet asset ID: washer-12',
    'Local fleet asset ID: washer-12',
    'Local fleet asset ID: vehicle_7',
  ].join('\n')),['washer-12','vehicle_7']);
  assert.deepEqual(exactLocalFleetAssetIds('Local fleet asset ID: washer-12 or another asset'),[]);
  assert.deepEqual(exactLocalFleetAssetIds('asset washer-12'),[]);
  assert.deepEqual(exactLocalFleetAssetIds('Local fleet asset ID:\nwasher-12'),[]);
  assert.deepEqual(exactLocalFleetAssetIds('Local fleet asset ID: '+('A'.repeat(81))),[]);
});
