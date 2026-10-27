import * as THREE from 'three';
import { routeAt, type RoutePoint, type Terrain } from '@/lib/hyperborea-terrain';

type Keep = <T extends {dispose:()=>void}>(item:T)=>T;

/** Shared geometry/materials keep expedition detail bounded and disposable. */
export function expeditionProps(keep:Keep, ember:THREE.Color) {
  const cloth = keep(new THREE.MeshStandardMaterial({color:0xb97336,roughness:0.95,side:THREE.DoubleSide}));
  const coldCloth = keep(new THREE.MeshStandardMaterial({color:0x485b69,roughness:0.95,side:THREE.DoubleSide}));
  const dark = keep(new THREE.MeshStandardMaterial({color:0x18212b,roughness:0.85}));
  const metal = keep(new THREE.MeshStandardMaterial({color:0x9aa6ae,roughness:0.68,metalness:0.45}));
  const lanternMat = keep(new THREE.MeshStandardMaterial({color:ember,emissive:ember,emissiveIntensity:1.3,roughness:0.5}));
  const tentGeo = keep(new THREE.ConeGeometry(0.75,0.7,4)); tentGeo.rotateY(Math.PI/4);
  const doorGeo = keep(new THREE.PlaneGeometry(0.38,0.42));
  const poleGeo = keep(new THREE.CylinderGeometry(0.018,0.018,1.05,5));
  const crateGeo = keep(new THREE.BoxGeometry(0.27,0.21,0.33));
  const lanternGeo = keep(new THREE.SphereGeometry(0.065,6,5));
  const guyGeo = keep(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0.7,0),new THREE.Vector3(1.2,0,0.9)]));
  const guyMat = keep(new THREE.LineBasicMaterial({color:0x8d877b,transparent:true,opacity:0.7}));
  const torsoGeo = keep(new THREE.CapsuleGeometry(0.12,0.22,3,5));
  const headGeo = keep(new THREE.SphereGeometry(0.095,7,6));
  const limbGeo = keep(new THREE.CylinderGeometry(0.035,0.045,0.32,5));
  const packGeo = keep(new THREE.BoxGeometry(0.2,0.29,0.13));
  const yellow = keep(new THREE.MeshStandardMaterial({color:0xcc8a39,roughness:0.95}));
  const blue = keep(new THREE.MeshStandardMaterial({color:0x476e82,roughness:0.95}));
  const mesh=(geometry:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0)=>{
    const m=new THREE.Mesh(geometry,material);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;return m;
  };
  function camp(reached:boolean,base:boolean) {
    const group=new THREE.Group();
    for(let i=0;i<(base?3:2);i++) {
      const tent=new THREE.Group(); tent.position.set((i-0.5)*1.3,0.12,i%2?0.65:-0.25);tent.rotation.y=i*1.7;
      tent.add(mesh(tentGeo,reached?cloth:coldCloth,0,0.35,0));
      tent.add(mesh(doorGeo,dark,0,0.24,0.38));
      const line=new THREE.Line(guyGeo,guyMat);tent.add(line);
      group.add(tent);
    }
    group.add(mesh(crateGeo,dark,0.3,0.11,-1.25),mesh(crateGeo,metal,0.65,0.11,-1.2));
    group.add(mesh(poleGeo,metal,-0.9,0.5,-0.65));
    if(reached)group.add(mesh(lanternGeo,lanternMat,-0.9,1.03,-0.65));
    return group;
  }
  function climber(partner:boolean) {
    const group=new THREE.Group(),parka=partner?blue:yellow;
    group.add(mesh(torsoGeo,parka,0,0.5,0),mesh(headGeo,parka,0,0.83,-0.015),mesh(packGeo,dark,0,0.56,0.13));
    const left=mesh(limbGeo,dark,-0.075,0.21,0.025);left.rotation.x=-0.22;
    const right=mesh(limbGeo,dark,0.075,0.21,-0.035);right.rotation.x=0.2;
    const arm=mesh(limbGeo,parka,0.16,0.47,-0.05);arm.rotation.x=-0.4;arm.rotation.z=0.25;
    group.add(left,right,arm,mesh(poleGeo,metal,0.26,0.42,-0.2));
    group.add(mesh(lanternGeo,lanternMat,0,0.84,-0.1));
    return group;
  }
  return {camp,climber};
}

/** One instanced draw call for moraine boulders; clear a corridor around the path. */
export function moraine(terrain:Terrain,route:RoutePoint[],keep:Keep,small:boolean) {
  const count=small?130:420;
  const geometry=keep(new THREE.DodecahedronGeometry(1,0));
  const material=keep(new THREE.MeshStandardMaterial({color:0x42474e,roughness:0.98}));
  const rocks= new THREE.InstancedMesh(geometry,material,count), dummy=new THREE.Object3D();
  let emitted=0;
  for(let i=0;i<count*4&&emitted<count;i++) {
    const angle=i*2.39996,r=26+Math.sqrt((i*0.618033)%1)*122,x=Math.cos(angle)*r,z=Math.sin(angle)*r;
    const y=terrain.height(x,z),onRoute=routeAt(route,y);
    if(Math.hypot(onRoute.x-x,onRoute.z-z)<3.2||y>78)continue;
    const size=0.2+Math.abs(terrain.noise(x*0.4,z*0.4))*1.2;
    dummy.position.set(x,y+size*0.25,z);dummy.scale.set(size,size*0.6,size*0.8);
    dummy.rotation.set(i*0.2,i*1.3,i*0.8);dummy.updateMatrix();rocks.setMatrixAt(emitted++,dummy.matrix);
  }
  rocks.count=emitted;rocks.receiveShadow=true;
  keep(rocks);
  return rocks;
}
