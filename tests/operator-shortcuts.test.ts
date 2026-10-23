import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isFinanceLaunch,isOperatorLaunch,operatorActionHref,
  operatorActionIds,operatorActionLabels,visibleBusinessRoute,
} from '../src/lib/operator-shortcuts';
import { discoverableVentures,contentPersistenceEnabled,ventureList,isVenture } from '../src/lib/ventures';

test('every daily action navigates to a real existing editor flow, not a placeholder module',()=>{
  assert.deepEqual(operatorActionIds,['new-lead','book-job','record-expense','new-task']);
  assert.equal(operatorActionHref('/workspace','new-lead'),'/workspace/b/exterior/leads?new=1');
  assert.equal(operatorActionHref('/workspace','book-job'),'/workspace/b/exterior/bookings?new=1');
  assert.equal(operatorActionHref('/workspace','record-expense'),'/workspace/finance?new=cost');
  assert.equal(operatorActionHref('/workspace','record-expense','exterior'),'/workspace/b/exterior/money?new=cost');
  assert.equal(operatorActionHref('/workspace','record-expense','solutions'),'/workspace/b/solutions/money?new=cost');
  assert.equal(operatorActionHref('/preview','new-lead'),'/preview/b/exterior/leads?new=1');
  assert.equal(operatorActionHref('/preview','book-job'),'/preview/b/exterior/bookings?new=1');
  assert.equal(new Set(Object.keys(operatorActionLabels)).size,4);
  assert.equal(operatorActionIds.every(action=>Boolean(operatorActionLabels[action])),true);
});

test('untrusted quick-launch query values cannot silently activate write forms',()=>{
  assert.equal(isOperatorLaunch('1'),true);
  for(const untrusted of [null,'0','true','2','1&extra','new','']){
    assert.equal(isOperatorLaunch(untrusted),false);
  }
  assert.equal(isFinanceLaunch('cost'),true);
  assert.equal(isFinanceLaunch('revenue'),true);
  for(const untrusted of [null,'auto','bank','transfer','Cost','']){
    assert.equal(isFinanceLaunch(untrusted),false);
  }
});

test('Oscar Jacob is navigable as clearly labeled preview without weakening server write controls',()=>{
  assert.deepEqual(discoverableVentures.map(v=>v.id),['exterior','solutions','essentials','content']);
  assert.equal(contentPersistenceEnabled,false);
  assert.equal(ventureList.some(v=>v.id==='content'),false);
  assert.equal(isVenture('content'),false);
  assert.equal(visibleBusinessRoute('/workspace','content',false),'/workspace/tools/content-preview');
  assert.equal(visibleBusinessRoute('/preview','content',false),'/preview/tools/content-preview');
  assert.equal(visibleBusinessRoute('/workspace','content',true),'/workspace/b/content');
  assert.equal(visibleBusinessRoute('/workspace','exterior',false),'/workspace/b/exterior');
  assert.throws(()=>visibleBusinessRoute('/workspace','wrong-company',false),/Unknown division/);
});

test('founders can launch bookkeeping by venture without creating a fictional content ledger',()=>{
  assert.equal(operatorActionHref('/workspace','record-expense','content'),'/workspace/finance?new=cost');
  assert.equal(operatorActionHref('/workspace','record-expense','essentials'),'/workspace/b/essentials/money?new=cost');
});
