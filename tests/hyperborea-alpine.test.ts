import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import test from 'node:test';
import * as THREE from 'three';
import {alpineMaterial} from '../src/components/app/hyperborea/alpine-material';
import {makeTerrain,makeRoute,routeAt,worldYFor} from '../src/lib/hyperborea-terrain';

test('locally served alpine assets match their checksum manifest and compact download budget',()=>{
  const root=new URL('../public/hyperborea/',import.meta.url);
  const manifest=JSON.parse(readFileSync(new URL('materials.json',root),'utf8'));
  assert.equal(manifest.license,'CC0-1.0');assert.equal(manifest.files.length,4);
  let compactBytes=0;
  for(const file of manifest.files) {
    assert.match(file.file,/^rock-(color|height)-(desktop|compact)\.webp$/);
    const bytes=readFileSync(new URL(file.file,root));
    assert.equal(bytes.length,file.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
    assert.equal(bytes.subarray(8,12).toString(),'WEBP');
    if(file.file.includes('compact'))compactBytes+=bytes.length;
  }
  assert.ok(compactBytes<250000,'phone material pair stays below 250 KB');
});

test('photographic material waits for both maps, supports failure, and fences disposal',()=>{
  const original=THREE.TextureLoader.prototype.load;
  const requests:{url:string;texture:THREE.Texture<HTMLImageElement>;loaded:(t:THREE.Texture<HTMLImageElement>)=>void;failed:()=>void}[]=[];
  THREE.TextureLoader.prototype.load=function(url,onLoad,_onProgress,onError){
    const texture=new THREE.Texture<HTMLImageElement>();requests.push({url,texture,loaded:onLoad!,failed:()=>onError?.(new Error('synthetic unavailable'))});return texture;
  };
  const tracked:{dispose:()=>void}[]=[],states:string[]=[];
  try {
    const material=alpineMaterial(new THREE.Texture(),new THREE.Color('gray'),new THREE.Color('white'),new THREE.Color('black'),true,item=>{tracked.push(item);return item;},state=>states.push(state));
    const source=THREE.ShaderLib.standard;
    const shader={vertexShader:source.vertexShader,fragmentShader:source.fragmentShader,uniforms:{}} as Parameters<typeof material.onBeforeCompile>[0];
    material.onBeforeCompile(shader,{} as THREE.WebGLRenderer);
    assert.ok(requests.every(r=>r.url.includes('-compact.webp')));
    assert.equal(shader.uniforms.hbPhotoReady.value,0);
    requests[0].loaded(requests[0].texture);assert.equal(shader.uniforms.hbPhotoReady.value,0);
    requests[1].failed();assert.deepEqual(states,['procedural-fallback']);
    requests[1].loaded(requests[1].texture);assert.equal(shader.uniforms.hbPhotoReady.value,1);
    assert.equal(states.at(-1),'photographic');
    assert.match(shader.fragmentShader,/perturbNormalArb/);assert.match(shader.fragmentShader,/hbGround/);
    material.dispose();requests[0].failed();assert.equal(states.at(-1),'photographic');
    const late=new THREE.Texture<HTMLImageElement>();let lateDisposed=false;
    late.addEventListener('dispose',()=>{lateDisposed=true;});requests[0].loaded(late);
    assert.equal(lateDisposed,true);assert.notEqual(shader.uniforms.hbRockPhoto.value,late);
    assert.equal(tracked.length,2);
  } finally {THREE.TextureLoader.prototype.load=original;tracked.forEach(t=>t.dispose());}
});

test('new geology stays finite and keeps every business altitude on the same seeded route',()=>{
  const terrain=makeTerrain(),again=makeTerrain(),route=makeRoute(terrain);
  for(let x=-180;x<=180;x+=9)for(let z=-180;z<=180;z+=9){
    const h=terrain.height(x,z);assert.ok(Number.isFinite(h)&&h>=0&&h<110);assert.equal(h,again.height(x,z));
  }
  let previous=-1;
  for(let altitude=0;altitude<=8849;altitude+=37){
    const point=routeAt(route,worldYFor(route,altitude,8849));
    assert.ok(point.index>=previous);assert.ok(Number.isFinite(point.y));previous=point.index;
  }
});
