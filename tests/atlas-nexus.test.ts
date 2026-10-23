import assert from 'node:assert/strict';
import test from 'node:test';
import { newEstimate } from '../src/lib/commercial-estimate';
import { emptyCommercialPortfolio, savePortfolioProject } from '../src/lib/atlas-commercial-portfolio';
import { emptyFleet, type FleetAsset } from '../src/lib/fleet-command';
import { buildNexusOverview, buildNexusProject, type NexusInputs } from '../src/lib/atlas-nexus';
import type { ExtLead, ExtBooking } from '../src/lib/exterior';
import type { Card, Activity } from '../src/lib/board';
import { exactLocalProjectIds } from '../src/lib/atlas-task-handoff';

const org='00000000-0000-4000-8000-000000000001';
const otherOrg='00000000-0000-4000-8000-000000000002';
const bookingId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const bookingTwo='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const leadId='cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const time='2026-10-22T16:00:00.000Z';
const readyAsset: FleetAsset={
  id:'washer-1',name:'Local GX390 Washer',kind:'pressure-washer',model:'Honda',
  status:'needs-service',unit:'hours',reading:40,nextServiceReading:100,
  nextServiceDate:null,notes:'PRIVATE SOURCE NOTE',createdAt:time,
};
const lead:ExtLead={
  id:leadId,name:'Private Property Customer',phone:'PRIVATE PHONE',address:'PRIVATE CLIENT ADDRESS',
  service_requested:'Commercial windows',quote_amount:38250,status:'booked',source:'google',
  notes:'PRIVATE ACCESS CODE',job_revenue:null,job_cost:null,created_at:time,
  updated_at:null,completed_at:null,
};
const booking:ExtBooking={id:bookingId,lead_id:leadId,date:'2026-10-27',time_block:'9 to 12',status:'confirmed'};
const task=(id:string,description:string,organization_id=org):Card=>({
  id,organization_id,title:'Confirm qualified lift operators',description,
  business:'exterior',stage:'In progress',priority:'normal',assignee:'',due_date:'',
  revision:1,checklist:[],
});
const taskA=task('task-a','Line one\nLocal portfolio project ID: project1\nCrew assumptions unverified.');
const activityA:Activity={id:'event-a',card_id:taskA.id,actor:'INTERNAL MEMBER UUID',action:'card_updated',created_at:time};
function inputs(overrides:Partial<NexusInputs>={}):NexusInputs{
  const input=newEstimate();
  input.sites[0]={...input.sites[0],name:'North facade',panes:240,crewHours:30,
    access:'lift',liftDays:0,notes:'PRIVATE SITE ACCESS',location:'PRIVATE SITE ADDRESS'};
  const portfolio=savePortfolioProject(emptyCommercialPortfolio(org),org,'project1',{
    name:'Hospital campus',input,review:[false,false,false,false,false],
    phase:'founder-review',bookingId,plannedAssetIds:[readyAsset.id],
    fieldCrewPlan:{crewSize:2,productiveHoursPerPersonDay:6,plannedFieldDays:2,stagingNote:'PRIVATE CREW NOTES'},
  },null,time);
  const fleet=emptyFleet(org);
  fleet.assets=[readyAsset];
  return {
    org,portfolio,fleet,bookings:[booking],leads:[lead],cards:[taskA],activity:[activityA],
    today:'2026-10-22',coverage:{bookings:{loaded:1,total:5},leads:{loaded:1,total:4}},
    ...overrides,
  };
}

test('NEXUS assembles exactly matched source booking, customer and shared-task relationships',()=>{
  const report=buildNexusOverview(inputs());
  assert.equal(report.projects.length,1);
  assert.equal(report.active,1);
  assert.equal(report.sourceMatchedBookings,1);
  assert.equal(report.attentionProjects,1);
  assert.equal(report.crewShortfalls,1);
  assert.equal(report.linkedSharedTasks,1);
  assert.equal(report.hasFleetWorkbook,true);
  assert.equal(report.hasRealProjectPersistence,false);
  assert.equal(report.sourceCoverage.bookings.total,5);
  const p=report.projects[0];
  assert.equal(p.booking.state,'matched');
  assert.equal(p.booking.date,'2026-10-27');
  assert.equal(p.customer.state,'source-linked');
  assert.equal(p.customer.id,leadId);
  assert.equal(p.customer.name,'Private Property Customer');
  assert.equal(p.assets[0].state,'needs-service');
  assert.equal(p.tasks[0].id,'task-a');
  assert.deepEqual(p.activity.map(a=>a.action),['card_updated']);
  assert.equal(p.crewGap,-6);
  assert.equal(p.buildings,1);
  assert.equal(p.panes,240);
  assert.equal(p.scenarioPrice>p.estimatedCost,true);
  assert.equal(p.findings.some(f=>f.id==='equipment-washer-1'&&f.priority==='attention'),true);
  assert.equal(p.findings.some(f=>f.id==='rental-unmodeled'),true);
  assert.equal(p.findings.some(f=>f.id==='crew-shortfall'),true);
  assert.deepEqual(p.edges.find(e=>e.to==='booking:'+bookingId),{
    from:'project:project1',to:'booking:'+bookingId,
    label:'manual ID resolved in source',evidence:'device-local-plan',
  });
  assert.deepEqual(p.edges.find(e=>e.to==='customer:'+leadId),{
    from:'booking:'+bookingId,to:'customer:'+leadId,
    label:'source booking.lead_id',evidence:'verified-source-record',
  });
  assert.equal(p.edges.find(e=>e.to==='task:task-a')?.evidence,'text-reference');
  assert.equal(p.nodes.find(n=>n.id==='task:task-a')?.evidence,'verified-source-record');
});

test('missing booking must not infer customer from identical names or site locations',()=>{
  const given=inputs({bookings:[],leads:[lead]});
  const report=buildNexusOverview(given).projects[0];
  assert.equal(report.booking.state,'not-loaded');
  assert.equal(report.booking.date,null);
  assert.equal(report.customer.state,'unlinked');
  assert.equal(report.customer.name,null);
  assert.equal(report.edges.some(e=>e.to==='customer:'+leadId),false);
  assert.equal(report.findings.some(f=>f.id==='booking-unloaded'),true);
});

test('cancelled source booking never generates a scheduled date or exact customer identity',()=>{
  const given=inputs({bookings:[{...booking,status:'cancelled'}]});
  const p=buildNexusOverview(given).projects[0];
  assert.equal(p.booking.state,'inactive');
  assert.equal(p.booking.date,null);
  assert.equal(p.customer.name,null);
  assert.equal(p.findings.some(f=>f.id==='booking-inactive'&&f.priority==='attention'),true);
});

test('booking lead ID must resolve against authorized loaded leads, not fuzzy customer matching',()=>{
  const p=buildNexusOverview(inputs({leads:[{...lead,id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd'}]})).projects[0];
  assert.equal(p.booking.state,'matched');
  assert.equal(p.customer.state,'not-loaded');
  assert.equal(p.customer.name,null);
  assert.equal(p.findings.some(f=>f.id==='customer-unloaded'),true);
});

test('cross-organization task records and activity are excluded from graph and events',()=>{
  const given=inputs({
    cards:[taskA,task('other-task','Local portfolio project ID: project1',otherOrg),
      task('fake-name','Hospital campus',''+org)],
    activity:[activityA,{...activityA,id:'other-event',card_id:'other-task'}],
  });
  const p=buildNexusOverview(given).projects[0];
  assert.deepEqual(p.tasks.map(t=>t.id),['task-a']);
  assert.deepEqual(p.activity.map(a=>a.id),['event-a']);
  assert.equal(p.nodes.some(n=>n.id==='task:other-task'),false);
  assert.equal(p.nodes.some(n=>n.id==='task:fake-name'),false);
});

test('plan scopes fail closed when the organization mismatches the portfolio, even when sources are loaded',()=>{
  const given=inputs({org:otherOrg});
  assert.throws(()=>buildNexusOverview(given),/current organization/);
  assert.throws(()=>buildNexusProject(given.portfolio.projects[0],given),/current organization/);
});

test('project to task edge remains a text reference, not a database FK',()=>{
  assert.deepEqual(exactLocalProjectIds('Local portfolio project ID:\nproject1'),[]);
  assert.deepEqual(exactLocalProjectIds('Local portfolio project ID: project1 or another'),[]);
  assert.deepEqual(exactLocalProjectIds('Local portfolio project ID: project1'),['project1']);
  const p=buildNexusOverview(inputs()).projects[0];
  assert.ok(p.edges.some(e=>e.evidence==='text-reference'&&e.label.includes('not FK')));
  assert.equal(p.activity[0].title,'Confirm qualified lift operators');
});

test('two same-day planned projects with one asset get advisory contention, not actual reservation',()=>{
  const i=inputs();
  const second=newEstimate();
  i.portfolio=savePortfolioProject(i.portfolio,org,'project2',{
    name:'Other building complex',input:second,review:[true,true,true,true,true],
    phase:'scoping',bookingId:bookingTwo,plannedAssetIds:['washer-1'],
    fieldCrewPlan:{crewSize:null,productiveHoursPerPersonDay:null,plannedFieldDays:null,stagingNote:''},
  },null,'2026-10-23T02:00:00.000Z');
  i.bookings=[booking,{...booking,id:bookingTwo,lead_id:null,date:booking.date,status:'confirmed'}];
  const report=buildNexusOverview(i);
  assert.equal(report.projects.length,2);
  assert.ok(report.projects[0].findings.some(f=>f.id.startsWith('asset-overlap')&&f.priority==='review'));
  assert.ok(report.projects[1].findings.some(f=>f.id.startsWith('asset-overlap')&&f.priority==='review'));
  assert.equal(report.sourceMatchedBookings,2);
  assert.equal(report.hasRealProjectPersistence,false);
});

test('absence of Fleet workbook never creates an inspected or reserved asset claim',()=>{
  const p=buildNexusOverview(inputs({fleet:null})).projects[0];
  assert.equal(p.assets[0].state,'missing');
  assert.equal(p.findings.some(f=>f.id==='equipment-washer-1'&&f.priority==='unknown'),true);
  assert.equal(p.nodes.find(n=>n.id==='equipment:washer-1')?.evidence,'unverified');
});

test('archived and incomplete plans are accounted separately from active scheduled work',()=>{
  const i=inputs();
  i.portfolio=savePortfolioProject(i.portfolio,org,'archived1',{
    name:'Dormant project',input:newEstimate(),review:[false,false,false,false,false],
    phase:'archived',bookingId:null,plannedAssetIds:[],
    fieldCrewPlan:{crewSize:null,productiveHoursPerPersonDay:null,plannedFieldDays:null,stagingNote:''},
  },null,'2026-10-23T02:00:00.000Z');
  const report=buildNexusOverview(i);
  assert.equal(report.projects.length,2);
  assert.equal(report.active,1);
  assert.ok(report.projects.find(p=>p.id==='archived1')?.findings.some(f=>f.id==='archived'));
});
