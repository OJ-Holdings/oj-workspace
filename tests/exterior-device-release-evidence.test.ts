import test from 'node:test';
import assert from 'node:assert/strict';
import {
 assessDeviceReleaseResponse,sanitizedDeviceReleaseReceipt,
} from '../src/lib/exterior-device-release-evidence';

const sha='abcdef0123456789abcdef0123456789abcdef01';
test('R44 same origin may report a full commit but cannot claim it matches Github',()=>{
 const x=assessDeviceReleaseResponse({status:'ok',release:sha.toUpperCase()});
 assert.equal(x.state,'reported');assert.equal(x.sha,sha);
 assert.match(x.detail,/not independent GitHub\/main/);
 assert.equal(x.label,'Server-reported commit');
});
test('R44 unmanaged Netlify or old Windows runtime stays unverified',()=>{
 const v=assessDeviceReleaseResponse({status:'ok',release:'unmanaged'});
 assert.equal(v.state,'unmanaged');assert.equal(v.sha,null);
});
test('R44 bad health, partial SHA, missing object and spoofing fail closed',()=>{
 for(const x of [null,[],{},'ok',{status:'bad',release:sha}]){
  const a=assessDeviceReleaseResponse(x);assert.equal(a.state,'unavailable');assert.equal(a.sha,null);
 }
 for(const x of [null,undefined,1,{},'bad','a'.repeat(39),'x'.repeat(40)]){
  const a=assessDeviceReleaseResponse({status:'ok',release:x});
  assert.equal(a.state,'invalid');assert.equal(a.sha,null);
 }
});
test('manual device evidence copies only allowlisted public commit, never secrets or acceptance',()=>{
 const v=assessDeviceReleaseResponse({
  status:'ok',release:sha,authorization:'LEAK-SENTINEL',
  bookingId:'LEAK-SENTINEL',private_file:'LEAK-SENTINEL',
 });
 const r=sanitizedDeviceReleaseReceipt(v,'2026-10-24T20:10:00.000Z');
 assert.match(r,new RegExp(sha));
 assert.match(r,/second founder: NOT VERIFIED/);
 assert.match(r,/production backup.*NOT VERIFIED/);
 assert.match(r,/GitHub main.*NOT VERIFIED/);
 assert.doesNotMatch(r,/LEAK-SENTINEL/);
 assert.doesNotMatch(r,/customer ID|booking ID|signed.*verified/i);
});
test('unknown timestamp cannot leak arbitrary string into sanitized receipt',()=>{
 const e=assessDeviceReleaseResponse({status:'ok',release:sha});
 const receipt=sanitizedDeviceReleaseReceipt(e,'SECRET-PATH-AND-TOKEN');
 assert.match(receipt,/Observed UTC: unknown/);
 assert.doesNotMatch(receipt,/SECRET-PATH-AND-TOKEN/);
});
