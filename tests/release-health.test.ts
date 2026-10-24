import assert from 'node:assert/strict';
import test from 'node:test';
import { assessRelease,resolveServedRelease } from '../src/lib/release-health';
const a='4f749b2199fc657522277f93bffe01bb32cc1aec';
const b='e6274f43b6160082ab9ce8e1daa3ad706c0e8343';

test('same exact full SHA is a limited release identifier match only',()=>{
  const result=assessRelease({status:'ok',release:a.toUpperCase()},{sha:a});
  assert.equal(result.state,'matched');
  assert.equal(result.runningSha,a);
  assert.equal(result.mainSha,a);
  assert.match(result.detail,/NOT an end-to-end health/i);
});

test('different SHA is a mismatch; never invent a deploy failure cause',()=>{
  const result=assessRelease({status:'ok',release:a},{sha:b});
  assert.equal(result.state,'different');
  assert.match(result.detail,/may be in progress, blocked or deliberately pinned/i);
  assert.doesNotMatch(result.detail,/failed deploy/i);
});

test('host probe must actually report ok before any matching claim',()=>{
  for(const host of [null,{},[],{status:'error',release:a},{status:'unhealthy',release:a}]){
    assert.equal(assessRelease(host,{sha:a}).state,'host-unavailable');
  }
});

test('unmanaged build cannot pretend to be current',()=>{
  const result=assessRelease({status:'ok',release:'unmanaged'},{sha:a});
  assert.equal(result.state,'unmanaged');
  assert.equal(result.runningSha,null);
});

test('invalid or short host SHA is never silently accepted',()=>{
  for(const value of ['abc','4f749b2199fc','',null,{},'z'.repeat(40)]){
    assert.equal(assessRelease({status:'ok',release:value},{sha:a}).state,'invalid-release');
  }
});

test('unavailable or malformed GitHub response means unknown even for healthy host',()=>{
  for(const github of [null,{},[],{message:'API rate limit exceeded'},{sha:'partial'}]){
    assert.equal(assessRelease({status:'ok',release:a},github).state,'github-unknown');
  }
});

test('remote response injection fields are ignored and SHAs are validated',()=>{
  const r=assessRelease({status:'ok',release:a,secret:'never expose'},
    {sha:a,authorization:'no'});
  assert.equal(r.state,'matched');
  assert.deepEqual(Object.keys(r).sort(),['detail','label','mainSha','runningSha','state'].sort());
  assert.equal(JSON.stringify(r).includes('secret'),false);
  assert.equal(JSON.stringify(r).includes('authorization'),false);
});


test('R44 Netlify build SHA, explicit Windows SHA, and Vercel build SHA resolve safely',()=>{
 assert.equal(resolveServedRelease({netlify:a}),a);
 assert.equal(resolveServedRelease({explicit:a}),a);
 assert.equal(resolveServedRelease({vercel:a.toUpperCase()}),a);
 assert.equal(resolveServedRelease({netlify:a,explicit:a.toUpperCase()}),a);
});
test('R44 conflicting or invalid hosting release environments never leak arbitrary values',()=>{
 assert.equal(resolveServedRelease({}), 'unmanaged');
 assert.equal(resolveServedRelease({explicit:'SECRET-PASSWORD'}),'unmanaged');
 assert.equal(resolveServedRelease({explicit:'SECRET-PASSWORD',netlify:a}),a);
 assert.equal(resolveServedRelease({explicit:a,netlify:b}),'unmanaged');
 assert.equal(resolveServedRelease({explicit:a,netlify:a,vercel:b}),'unmanaged');
 assert.equal(resolveServedRelease({netlify:'abc',vercel:'nope'}),'unmanaged');
});
