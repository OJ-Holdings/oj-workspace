import assert from 'node:assert/strict';
import test from 'node:test';
import { linkedSourcesForTask, linkedTasksForLead } from '../src/lib/atlas-relations';
import type { Card } from '../src/lib/board';
import type { Dashboard, Lead } from '../src/lib/dashboard';
import type { JobItem } from '../src/app/workspace/exterior-actions';

const task=(id:string,description:string,business:Card['business']='exterior',stage:Card['stage']='Ready'):Card=>({
  id,description,organization_id:'test',business,title:'Task '+id,
  stage,priority:'normal',assignee:'Oscar',due_date:'',revision:0,checklist:[],
});
const lead=(id:string,venture:Lead['venture']='exterior'):Lead=>({
  id,venture,name:'Example customer',contact:'not for matching',stage:'New',
  value:null,source:'manual',notes:'',created_at:'2026-10-20T14:00:00Z',
});
const dashboard=(leads:Lead[]):Dashboard=>({
  leads,finance:[],metricEntries:[],messages:[],documents:[],events:[],
});
const booking=(id:string,status='confirmed'):JobItem=>({
  id,lead_id:'legacy-'+id,date:'2026-10-28',time_block:'9 AM',status,
  name:'Property A',service:'Window cleaning',address:null,quote:650,
});

test('a CRM customer only sees tasks with an exact same-venture lead ID',()=>{
  const cards=[
    task('linked','CRM source: /workspace/crm?lead=42'),
    task('done','Refer to /workspace/crm?lead=42', 'exterior','Done'),
    task('other','CRM source: /workspace/crm?lead=42','solutions'),
    task('fuzzy','Call Example customer, lead 42'),
    task('different','/workspace/crm?lead=420'),
  ];
  const result=linkedTasksForLead(lead('42'),cards);
  assert.deepEqual(result.map(x=>x.id),['linked','done']);
  assert.deepEqual(result.map(x=>x.href),['/tasks?task=linked','/tasks?task=done']);
});

test('task context resolves only actually loaded CRM and active Exterior booking source IDs',()=>{
  const c=task('job',
    'Workspace CRM source: /workspace/crm?lead=xyz\nBooking record ID: b7');
  const source=linkedSourcesForTask(c,dashboard([lead('xyz')]),[booking('b7')]);
  assert.deepEqual(source.map(x=>x.kind),['workspace-lead','exterior-booking']);
  assert.deepEqual(source.map(x=>x.href),['/crm?lead=xyz','/b/exterior/calendar']);
  assert.doesNotMatch(source.map(x=>x.detail).join(' '),/650|not for matching/);
});

test('wrong business, missing records and cancelled bookings cannot be presented as links',()=>{
  const source=linkedSourcesForTask(
    task('x','/crm?lead=crm\nBooking record ID: b7','solutions'),
    dashboard([lead('crm','exterior')]),[booking('b7')]);
  assert.equal(source.length,0);
  assert.equal(linkedSourcesForTask(task('no','/crm?lead=crm\nBooking record ID: b7'),
    dashboard([]),[booking('b7','cancelled')]).length,0);
});

test('source IDs require explicit structured references, not fuzzy person-name matching',()=>{
  const source=linkedSourcesForTask(task('x','Customer Property A, Example customer, id xyz and b7'),
    dashboard([lead('xyz')]),[booking('b7')]);
  assert.deepEqual(source,[]);
  assert.deepEqual(linkedTasksForLead(lead('xyz'),[task('x','Call Example customer xyz')]),[]);
});
