import * as THREE from 'three';
import { makeRoute, makeTerrain, MOUNTAIN_R, routeAt, routeTop, worldYFor, type RoutePoint } from '@/lib/hyperborea-terrain';
import type { Weather } from '@/lib/hyperborea';
import { cameraReadout } from '@/lib/hyperborea-camera';
import { boundedZoom } from '@/lib/hyperborea-trail';
import { alpineMaterial } from './alpine-material';
import { expeditionProps, moraine } from './expedition-props';

/**
 * Hyperborea's 3D scene. Imperative three.js, mounted into a container by HyperboreaView.
 * The camera sits close on one point of the route (the expedition, or wherever the founders
 * are looking) instead of showing the whole ascent; scroll and drag move it along the climb.
 */

export type SceneCamp = { id: string; name: string; altitude: number; reached: boolean };
export type SceneWaypoint = { id?: string; altitude: number; label: string };
export type SceneInput = { altitude: number; ghost: number; camps: SceneCamp[]; waypoints: SceneWaypoint[]; weather: Weather; summitReached: boolean; summitMetres: number };
export type SceneHandle = {
  set: (input: SceneInput) => void;
  /** Point the camera at an altitude in metres (smoothly). */
  look: (metres: number) => void;
  nudge: (metres: number) => void;
  recenter: () => void;
  overview: (on: boolean) => void;
  zoom: (factor: number) => void;
  setSound: (on: boolean) => Promise<boolean>;
  dispose: () => void;
};

// Colours come from the .hb tokens in src/styles/tokens.css (WebGL needs them as numbers, so they are read at mount).
type Palette = Record<'abyss' | 'fog' | 'skyTop' | 'skyLow' | 'moon' | 'fill' | 'hemiSky' | 'hemiGround' | 'ember' | 'ghost' | 'route' | 'tent' | 'snow' | 'cloud' | 'plain' | 'rock' | 'snowpack', THREE.Color>;
function readPalette(el: HTMLElement): Palette {
  const css = getComputedStyle(el);
  const get = (name: string) => new THREE.Color(css.getPropertyValue(name).trim() || 'black');
  return {
    abyss: get('--hb3-abyss'), fog: get('--hb3-fog'), skyTop: get('--hb3-sky-top'), skyLow: get('--hb3-sky-low'),
    moon: get('--hb3-moon'), fill: get('--hb3-fill'), hemiSky: get('--hb3-hemi-sky'), hemiGround: get('--hb3-hemi-ground'),
    ember: get('--hb3-ember'), ghost: get('--hb3-ghost'), route: get('--hb3-route'), tent: get('--hb3-tent'),
    snow: get('--hb3-snow'), cloud: get('--hb3-cloud'), plain: get('--hb3-plain'), rock: get('--hb3-rock'), snowpack: get('--hb3-snowpack'),
  };
}
const fogDensity: Record<Weather, number> = { clear: 0.0045, wind: 0.006, storm: 0.009, unknown: 0.008 };
const flakeCount: Record<Weather, number> = { clear: 1100, wind: 2700, storm: 4500, unknown: 2200 };
const windFor: Record<Weather, THREE.Vector3> = {
  clear: new THREE.Vector3(-0.8, -1.4, 0.3), wind: new THREE.Vector3(-7, -2.2, 1.8),
  storm: new THREE.Vector3(-16, -3.5, 4), unknown: new THREE.Vector3(-1.4, -0.9, 0.4),
};

function glowTexture(color: THREE.Color, alpha = 1) {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!; const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  const rgb = `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`;
  r.addColorStop(0, `rgba(${rgb},${alpha})`); r.addColorStop(0.25, `rgba(${rgb},${alpha * 0.85})`); r.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = r; g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function cloudTexture(noise: (x: number, y: number) => number) {
  const size = 128, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!; const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (x - 64) / 64, dy = (y - 64) / 64, d = Math.hypot(dx, dy);
    let n = 0, a = 0.5, f = 3;
    for (let o = 0; o < 4; o++) { n += noise(x / size * f + 11, y / size * f + 3) * a; a *= 0.5; f *= 2; }
    const v = Math.max(0, Math.min(1, (1 - d) * 1.5 + n * 0.8 - 0.3));
    const i = (y * size + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = 255; img.data[i + 3] = v * v * 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function grainTexture(noise: (x: number, y: number) => number) {
  // Isotropic multi-octave grain; mirrored repeats hide the tile seams.
  const size = 256, c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d')!; const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    let n = 0, a = 0.55, f = 6 / size;
    for (let o = 0; o < 5; o++) { n += noise(x * f + o * 17.3, y * f - o * 9.1) * a; a *= 0.55; f *= 2.1; }
    const v = Math.round(Math.min(Math.max(n * 0.5 + 0.5, 0), 1) * 255); const i = (y * size + x) * 4;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.MirroredRepeatWrapping; t.repeat.set(90, 90); return t;
}
const smooth = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

export function mountScene(container: HTMLElement, labelLayer: HTMLElement, first: SceneInput, opts: { reducedMotion: boolean; onView: (metres: number) => void; onInspect?: (id: string) => void }): SceneHandle {
  const small = container.clientWidth < 700;
  container.dataset.materialStatus='loading';
  container.dataset.renderQuality=small?'compact':'desktop';
  const renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.74;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !small; renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  container.appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const C = readPalette(container);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(C.abyss);
  scene.fog = new THREE.FogExp2(C.fog, fogDensity[first.weather]);
  const camera = new THREE.PerspectiveCamera(48, container.clientWidth / container.clientHeight, 0.1, 2400);

  const terrain = makeTerrain();
  const route = makeRoute(terrain);
  const top = routeTop(route);
  const disposables: { dispose: () => void }[] = [];
  const keep = <T extends { dispose: () => void }>(x: T) => { disposables.push(x); return x; };

  // ---- sky: a dark gradient dome, faint stars, a moon smothered in haze ----
  const skyMat = keep(new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(C.skyTop).lerp(new THREE.Color(0x15253e),0.15) }, low: { value: new THREE.Color(C.skyLow).lerp(new THREE.Color(0x516078),0.13) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 low; varying vec3 vP; void main(){ float h = clamp(vP.y*1.45+0.04,0.0,1.0); gl_FragColor = vec4(mix(low, top, h),1.0); }',
  }));
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(1800, 32, 16)), skyMat); scene.add(sky);
  const starGeo = keep(new THREE.BufferGeometry());
  const starPos = new Float32Array(1600 * 3);
  for (let i = 0; i < 1600; i++) {
    const u = Math.random() * Math.PI * 2, v = Math.acos(Math.random() * 0.9 + 0.1);
    starPos.set([Math.sin(v) * Math.cos(u) * 650, Math.cos(v) * 650, Math.sin(v) * Math.sin(u) * 650], i * 3);
  }
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  const starMat = keep(new THREE.PointsMaterial({ color: C.snow, size: 1.1, sizeAttenuation: false, transparent: true, opacity: 0.5, fog: false, depthWrite: false }));
  scene.add(new THREE.Points(starGeo, starMat));
  const moonTex = keep(glowTexture(C.moon, 0.9));
  const moonMat = keep(new THREE.SpriteMaterial({ map: moonTex, fog: false, transparent: true, depthWrite: false, opacity: 0.55 }));
  const moon = new THREE.Sprite(moonMat); moon.position.set(-260, 330, -380); moon.scale.setScalar(90); scene.add(moon);

  // ---- light ----
  const hemi = new THREE.HemisphereLight(0x7486a4, 0x080c14, 0.40); scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(0xc8d5ef, 1.25); moonLight.position.set(-90, 155, 110); scene.add(moonLight);
  moonLight.castShadow = !small;
  moonLight.shadow.mapSize.set(1024,1024);
  Object.assign(moonLight.shadow.camera,{left:-135,right:135,top:155,bottom:-110,near:1,far:430});
  moonLight.shadow.bias=-0.0005; moonLight.shadow.normalBias=0.16;
  keep(moonLight.shadow);
  moonLight.target.position.set(0,35,0);scene.add(moonLight.target);
  const dawnRim = new THREE.DirectionalLight(0x7487a9,0.2);dawnRim.position.set(60,90,-130);scene.add(dawnRim);
  const fill = new THREE.DirectionalLight(0x5b6d91, 0.22); fill.position.set(200, 60, 220); scene.add(fill);
  const headlamp = new THREE.PointLight(C.ember, 7, 12, 1.8); scene.add(headlamp);

  // ---- the mountain ----
  const size = MOUNTAIN_R * 2.3, seg = small ? 190 : 330;
  const geo = keep(new THREE.PlaneGeometry(size, size, seg, seg)); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) pos.setY(i,terrain.height(pos.getX(i),pos.getZ(i)));
  geo.computeVertexNormals();
  const grain = keep(grainTexture(terrain.noise));
  grain.anisotropy = Math.min(8,renderer.capabilities.getMaxAnisotropy());
  const rockMat = keep(alpineMaterial(grain,C.rock,C.snowpack,C.plain,small,keep,state=>{container.dataset.materialStatus=state;}));
  const mountain = new THREE.Mesh(geo,rockMat);mountain.castShadow=!small;mountain.receiveShadow=!small;scene.add(mountain);
  scene.add(moraine(terrain,route,keep,small));
  // Far ridgelines establish scale without adding expensive foreground detail.
  for (const [i,x,z,scale] of [[0,-140,-155,0.8],[1,135,-180,0.95],[2,-210,25,0.6]]) {
    const distant=makeTerrain(610+i*137),g=keep(new THREE.PlaneGeometry(310,310,small?40:64,small?40:64));g.rotateX(-Math.PI/2);
    const points=g.attributes.position as THREE.BufferAttribute;
    for(let n=0;n<points.count;n++)points.setY(n,distant.height(points.getX(n),points.getZ(n)));
    g.computeVertexNormals();
    const distantColors=new Float32Array(points.count*3),baseColor=C.plain.clone(),ridgeColor=new THREE.Color(0x445366);
    for(let n=0;n<points.count;n++) {
      const color=baseColor.clone().lerp(ridgeColor,smooth(0,12,points.getY(n)));
      distantColors.set([color.r,color.g,color.b],n*3);
    }
    g.setAttribute('color',new THREE.BufferAttribute(distantColors,3));
    const m=keep(new THREE.MeshStandardMaterial({vertexColors:true,roughness:1,transparent:true,opacity:0.16,depthWrite:false}));
    const peak=new THREE.Mesh(g,m);peak.position.set(x,-4,z);peak.scale.setScalar(scale);scene.add(peak);
  }
  renderer.shadowMap.needsUpdate=true;
  const plain = new THREE.Mesh(keep(new THREE.CircleGeometry(800, 48)), keep(new THREE.MeshStandardMaterial({ color: C.plain, roughness: 1 })));
  plain.rotation.x = -Math.PI / 2; plain.position.y = -0.4; scene.add(plain);

  // ---- the route ----
  const lineFrom = (pts: RoutePoint[], tracked=true) => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flatMap(p => [p.x, p.y + 0.3, p.z])), 3)); return tracked?keep(g):g;
  };
  const routeLine = new THREE.Line(lineFrom(route), keep(new THREE.LineDashedMaterial({ color: C.route, dashSize: 0.7, gapSize: 1.1, transparent: true, opacity: 0.4 })));
  routeLine.computeLineDistances(); scene.add(routeLine);
  const doneMat = keep(new THREE.LineBasicMaterial({ color: C.ember, transparent: true, opacity: 0.9 }));
  let doneLine: THREE.Line | null = null;

  const emberTex = keep(glowTexture(C.ember, 1));
  const coldTex = keep(glowTexture(C.ghost, 0.7));
  const climber = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: emberTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  climber.scale.setScalar(0.65); scene.add(climber);
  const props=expeditionProps(keep,C.ember);
  const founders=[props.climber(false),props.climber(true)];founders.forEach(f=>scene.add(f));
  const safetyRopeGeo=keep(new THREE.BufferGeometry());
  const safetyRope=new THREE.Line(safetyRopeGeo,keep(new THREE.LineBasicMaterial({color:C.ember,transparent:true,opacity:0.8})));scene.add(safetyRope);
  const ghost = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: coldTex, transparent: true, depthWrite: false, opacity: 0.45 })));
  ghost.scale.setScalar(2.2); scene.add(ghost);

  const campGroup = new THREE.Group(); scene.add(campGroup);
  const poleGeo = keep(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5)), poleMat = keep(new THREE.MeshBasicMaterial({ color: C.ghost }));
  const flagGeo = keep(new THREE.PlaneGeometry(0.9, 0.55)), flagMat = keep(new THREE.MeshBasicMaterial({ color: C.ember, side: THREE.DoubleSide }));
  const campGlowWarm = keep(new THREE.SpriteMaterial({ map: emberTex, transparent: true, depthWrite: false, opacity: 0.55, blending: THREE.AdditiveBlending }));
  const campGlowCold = keep(new THREE.SpriteMaterial({ map: coldTex, transparent: true, depthWrite: false, opacity: 0.35 }));
  const trailPins=keep(new THREE.InstancedMesh(keep(new THREE.ConeGeometry(0.065,0.18,4)),keep(new THREE.MeshBasicMaterial({color:0xa6bad2,transparent:true,opacity:0.65})),4096));
  scene.add(trailPins);
  const pinMatrix=new THREE.Object3D();

  // ---- cloud: a shroud over the summit, drifting banks lower down ----
  const cloudTex = keep(cloudTexture(terrain.noise));
  type Cloud = { s: THREE.Sprite; base: THREE.Vector3; phase: number; summit: boolean };
  const clouds: Cloud[] = [];
  const addCloud = (x: number, y: number, z: number, scale: number, opacity: number, summit: boolean) => {
    const m = keep(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity, color: C.cloud }));
    const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.set(scale, scale * 0.55, 1); s.material.rotation = Math.random() * Math.PI;
    scene.add(s); clouds.push({ s, base: s.position.clone(), phase: Math.random() * 10, summit });
  };
  for (let i = 0; i < (small?7:12); i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 26; addCloud(Math.cos(a) * r, top - 10 + Math.random() * 16, Math.sin(a) * r, 22 + Math.random() * 22, 0.16, true); }
  for (let i = 0; i < (small?9:18); i++) { const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * 110; addCloud(Math.cos(a) * r, 22 + Math.random() * 62, Math.sin(a) * r, 30 + Math.random() * 40, 0.065 + Math.random() * 0.07, false); }

  // ---- snow ----
  const BOX = new THREE.Vector3(46, 30, 46), maxFlakes = 6500;
  const flakePos = new Float32Array(maxFlakes * 3);
  for (let i = 0; i < maxFlakes; i++) flakePos.set([(Math.random() - 0.5) * BOX.x, (Math.random() - 0.5) * BOX.y, (Math.random() - 0.5) * BOX.z], i * 3);
  const flakeGeo = keep(new THREE.BufferGeometry()); flakeGeo.setAttribute('position', new THREE.BufferAttribute(flakePos, 3));
  const flakeTex = keep(glowTexture(C.snow, 1));
  const flakeMat = keep(new THREE.PointsMaterial({ color: C.snow, map: flakeTex, size: 0.16, transparent: true, opacity: 0.85, depthWrite: false }));
  const flakes = new THREE.Points(flakeGeo, flakeMat); flakes.frustumCulled = false; scene.add(flakes);
  const flakeJitter = new Float32Array(maxFlakes).map(() => 0.6 + Math.random() * 0.8);

  // ---- labels (DOM, positioned each frame) ----
  type Label = { el: HTMLElement; at: THREE.Vector3; near: number };
  let labels: Label[] = [];
  const makeLabel = (text: string, cls: string, at: THREE.Vector3, near = 70, id?: string) => {
    const el = document.createElement(id ? 'button' : 'div'); el.className = 'hb3-label ' + cls;
    el.dataset.title=text;
    const caption=document.createElement('span');caption.textContent=text;el.appendChild(caption);
    if (el instanceof HTMLButtonElement) {
      el.type = 'button'; el.setAttribute('aria-label', `Inspect ${text}`);
      el.addEventListener('click', () => { const target=el.dataset.inspectId??id;if(target)opts.onInspect?.(target); });
    }
    labelLayer.appendChild(el); labels.push({ el, at, near }); return el;
  };

  // ---- state ----
  let input = first;
  const yFor = (m: number) => worldYFor(route, m, input.summitMetres);
  let viewTarget = first.altitude, viewNow = first.altitude, orbitTarget = 0, orbitNow = 0;
  let zoomTarget=1,zoomNow=1;
  let stepWaypoints:SceneWaypoint[]=[];
  let stepPool:Label[]=[];
  let lastStepWindow='';
  let lastEmitted = -1;
  let wind = windFor[first.weather].clone();
  let overviewTarget = 0, overviewNow = 0, cameraReady = false;
  const smoothLook = new THREE.Vector3();
  let lightning = 0, nextBolt = 4 + Math.random() * 6;

  function build() {
    campGroup.clear();
    labels.forEach(l => l.el.remove()); labels = [];
    for (const c of input.camps) {
      if (c.id === 'summit') continue;
      const p = routeAt(route, yFor(c.altitude));
      const g = new THREE.Group(); g.position.set(p.x, terrain.height(p.x, p.z), p.z);
      const shelter=props.camp(c.reached,c.id==='base');
      for(const item of shelter.children) {
        const ground=terrain.height(g.position.x+item.position.x,g.position.z+item.position.z)-g.position.y;
        item.position.y+=ground;
      }
      g.add(shelter);
      const glow = new THREE.Sprite(c.reached ? campGlowWarm : campGlowCold); glow.position.y = 0.8; glow.scale.setScalar(c.reached ? 1.0 : 0.55); g.add(glow);
      if (c.reached && c.id !== 'base') {
        const pole = new THREE.Mesh(poleGeo, poleMat); pole.position.y = 1.1; g.add(pole);
        const flag = new THREE.Mesh(flagGeo, flagMat); flag.position.set(0.45, 1.9, 0); g.add(flag);
      }
      campGroup.add(g);
      makeLabel(c.name, c.reached ? 'is-reached' : '', g.position.clone().add(new THREE.Vector3(0, 3, 0)), 70, 'camp:' + c.id);
    }
    const peak = new THREE.Vector3(0, top + 4, 0);
    makeLabel(input.summitReached ? 'Summit' : 'Summit, 8,849 m', 'is-summit', peak, 400, 'camp:summit');
    const me = routeAt(route, yFor(input.altitude));
    climber.position.set(me.x, me.y + 1.1, me.z);
    headlamp.position.set(me.x, me.y + 0.9, me.z);
    founders[0].position.set(me.x,terrain.height(me.x,me.z)+0.08,me.z);
    const behind=route[Math.max(0,me.index-14)],partnerX=behind.x+0.25*me.dir.z,partnerZ=behind.z-0.25*me.dir.x;
    founders[1].position.set(partnerX,terrain.height(partnerX,partnerZ)+0.08,partnerZ);
    founders.forEach(f=>{f.rotation.y=Math.atan2(-me.dir.x,-me.dir.z);});
    safetyRopeGeo.setFromPoints([founders[0].position.clone().add(new THREE.Vector3(0,0.45,0)),founders[1].position.clone().add(new THREE.Vector3(0,0.45,0))]);
    renderer.shadowMap.needsUpdate=true;
    // The next objectives: small cold cairns on the route ahead.
    stepWaypoints=input.waypoints.filter(w=>w.id?.startsWith('step:'));
    let pin=0;
    input.waypoints.forEach(w => {
      const wp = routeAt(route, yFor(w.altitude));
      if(pin<4096){pinMatrix.position.set(wp.x,terrain.height(wp.x,wp.z)+0.16,wp.z);pinMatrix.updateMatrix();trailPins.setMatrixAt(pin++,pinMatrix.matrix);}
      if(!w.id?.startsWith('step:'))makeLabel(w.label, w.id?.startsWith('history:') ? 'is-history' : 'is-waypoint', new THREE.Vector3(wp.x,terrain.height(wp.x,wp.z)+1.0,wp.z),60,w.id);
    });
    trailPins.count=pin;trailPins.instanceMatrix.needsUpdate=true;
    stepPool=[];
    for(let i=0;i<24;i++) {makeLabel('Trail step','is-step',new THREE.Vector3(),90,'step:5');stepPool.push(labels[labels.length-1]);}
    lastStepWindow='';
    makeLabel('Current position', 'is-me', climber.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 200, 'records');
    const gh = routeAt(route, yFor(input.ghost));
    ghost.position.set(gh.x, gh.y + 1.1, gh.z);
    ghost.visible = Math.abs(input.ghost - input.altitude) > 20;
    if (ghost.visible) makeLabel('Pace for 2046', 'is-ghost', ghost.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 120);
    if (doneLine) { scene.remove(doneLine); doneLine.geometry.dispose(); }
    doneLine = new THREE.Line(lineFrom(route.slice(0, Math.max(me.index, 1)).concat([{ ...me, climb: me.climb }]),false), doneMat);
    scene.add(doneLine);
    for (const cl of clouds) (cl.s.material as THREE.SpriteMaterial).opacity = cl.summit ? (input.summitReached ? 0 : 0.13) : ({clear:0.025,wind:0.06,storm:0.11,unknown:0.08}[input.weather]);
    (scene.fog as THREE.FogExp2).density = fogDensity[input.weather];
    starMat.opacity = input.weather === 'clear' ? 0.55 : input.weather === 'wind' ? 0.25 : 0.04;
    moonMat.opacity = input.weather === 'storm' ? 0.14 : input.weather === 'clear' ? 0.45 : 0.25;
    wind = windFor[input.weather].clone();
    flakeGeo.setDrawRange(0, opts.reducedMotion ? 600 : small ? Math.round(flakeCount[input.weather] * 0.55) : flakeCount[input.weather]);
  }
  build();

  // ---- interaction ----
  const el = renderer.domElement;
  el.style.touchAction = 'pan-y';
  let drag: { x: number; y: number; id: number; touch: boolean } | null = null;
  const clampView = (m: number) => Math.min(Math.max(m, 0), input.summitMetres);
  const onDown = (e: PointerEvent) => { drag = { x: e.clientX, y: e.clientY, id: e.pointerId, touch: e.pointerType === 'touch' }; el.setPointerCapture(e.pointerId); container.dataset.touched = '1'; };
  const onMove = (e: PointerEvent) => {
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; drag.x = e.clientX; drag.y = e.clientY;
    orbitTarget = Math.min(Math.max(orbitTarget - dx * 0.006, -1.2), 1.2);
    if (!drag.touch) viewTarget = clampView(viewTarget + dy * 3);
  };
  const onUp = (e: PointerEvent) => { if (drag?.id === e.pointerId) drag = null; };
  const onWheel = (e: WheelEvent) => {
    if (overviewTarget) return; // Let the surrounding page scroll in the overview.
    const pixels = e.deltaY * (e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? container.clientHeight : 1);
    const next = clampView(viewTarget - Math.max(-100, Math.min(100, pixels)) * 0.8);
    // At the foot or the summit, let the page scroll on.
    if (next === viewTarget) return;
    e.preventDefault(); viewTarget = next; container.dataset.touched = '1';
  };
  el.addEventListener('pointerdown', onDown); el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp); el.addEventListener('pointercancel', onUp);
  el.addEventListener('wheel', onWheel, { passive: false });

  const resize = () => {
    const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return;
    renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize); ro.observe(container);
  let visible = true;
  const io = new IntersectionObserver(([en]) => { visible = en.isIntersecting; }, { threshold: 0.01 }); io.observe(container);

  // ---- sound: brown-noise wind through a moving band-pass, thunder on lightning ----
  let audio: { ctx: AudioContext; gain: GainNode; filter: BiquadFilterNode; thunder: () => void } | null = null;
  async function setSound(on: boolean) {
    if (!on) { if (audio) { await audio.ctx.close().catch(() => undefined); audio = null; } return false; }
    if (audio) return true;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return false;
    const ctx = new Ctx();
    const len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.2; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const filter = ctx.createBiquadFilter(); filter.type = 'bandpass'; filter.Q.value = 0.7; filter.frequency.value = 420;
    const gain = ctx.createGain(); gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(ctx.destination); src.start();
    const thunder = () => {
      const n = ctx.createBufferSource(); n.buffer = buf;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 110;
      const g = ctx.createGain(); const t = ctx.currentTime;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(1.6, t + 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + 3.2);
      n.connect(lp).connect(g).connect(ctx.destination); n.start(t, Math.random()); n.stop(t + 3.4);
    };
    audio = { ctx, gain, filter, thunder };
    if (ctx.state === 'suspended') await ctx.resume().catch(() => undefined);
    return true;
  }

  // ---- loop ----
  const clock = keep(new THREE.Timer()); clock.connect(document);
  const tmp = new THREE.Vector3(), look = new THREE.Vector3(), peak = new THREE.Vector3(0, top, 0);
  let raf = 0;
  let frameSamples=0,meanFrameMs=16.7,qualityReduced=false;
  function frame() {
    raf = requestAnimationFrame(frame);
    clock.update();
    if (!visible || document.hidden) return;
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.getElapsed();
    meanFrameMs+=(Math.min(clock.getDelta()*1000,100)-meanFrameMs)*0.025;
    frameSamples++;
    // Local-only diagnostics and one bounded downgrade; never send telemetry externally.
    if(frameSamples%120===0) {
      container.dataset.frameMs=meanFrameMs.toFixed(1);
      container.dataset.triangles=String(renderer.info.render.triangles);
      if(frameSamples>240&&meanFrameMs>32&&!qualityReduced) {
        qualityReduced=true;renderer.setPixelRatio(1);resize();
        renderer.shadowMap.enabled=false;
        flakeGeo.setDrawRange(0,Math.min(flakeGeo.drawRange.count,900));
        container.dataset.renderQuality='adaptive';
      }
    }
    const k = opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.4);
    viewNow += (viewTarget - viewNow) * k; orbitNow += (orbitTarget - orbitNow) * k;
    overviewNow += (overviewTarget - overviewNow) * (opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 3));
    zoomNow+=(zoomTarget-zoomNow)*k;
    const viewFrac = viewNow / input.summitMetres;

    // Camera: close on the route at the viewed altitude, outside the mountain, looking a little up the face.
    const focus = routeAt(route, yFor(viewNow));
    const outward = Math.atan2(focus.z, focus.x) + orbitNow;
    const dist = (28 + 8 * (1 - viewFrac))*zoomNow, lift = (6 + 2 * viewFrac)*Math.sqrt(zoomNow);
    tmp.set(focus.x + Math.cos(outward) * dist, focus.y + lift, focus.z + Math.sin(outward) * dist);
    // Keep the camera out of the rock and the line of sight to the focus clear of ridges.
    const ground = terrain.height(tmp.x, tmp.z) + 2.2; if (tmp.y < ground) tmp.y = ground;
    const fy = focus.y + 1.2;
    for (let s = 1; s < 10; s++) {
      const f = s / 10, sx = tmp.x + (focus.x - tmp.x) * f, sz = tmp.z + (focus.z - tmp.z) * f;
      const need = terrain.height(sx, sz) + 1.0;
      const lineY = tmp.y + (fy - tmp.y) * f;
      if (lineY < need) tmp.y += (need - lineY) / (1 - f);
    }
    look.set(focus.x, focus.y + 1.2, focus.z).lerp(peak, 0.13*Math.min(1,zoomNow));
    // Fit the entire route/massif even on a portrait phone. Smooth position AND aim,
    // rather than snapping X/Z and lookAt while only damping camera height.
    const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    const radius = Math.max(MOUNTAIN_R * 0.82, top * 0.65);
    const overviewDistance = radius / Math.sin(halfFov) * 1.12;
    const wholeLook = new THREE.Vector3(0, top * 0.43, 0);
    const wholePosition = new THREE.Vector3(Math.cos(0.9 + orbitNow) * overviewDistance * 0.88, top * 0.43 + overviewDistance * 0.42, Math.sin(0.9 + orbitNow) * overviewDistance * 0.88);
    tmp.lerp(wholePosition, overviewNow); look.lerp(wholeLook, overviewNow);
    if (!cameraReady || opts.reducedMotion) { camera.position.copy(tmp); smoothLook.copy(look); cameraReady = true; }
    else { camera.position.lerp(tmp, 1 - Math.exp(-dt * 5)); smoothLook.lerp(look, 1 - Math.exp(-dt * 5)); }
    camera.position.y = Math.max(camera.position.y, terrain.height(camera.position.x, camera.position.z) + 2.2);
    camera.lookAt(smoothLook);

    // Weather-driven fog: thicker in the Death Zone.
    const deathZone = smooth(7800, 8300, viewNow);
    (scene.fog as THREE.FogExp2).density = fogDensity[input.weather] * (1 + 0.5 * deathZone) * (1 - overviewNow * 0.88);

    // Headlamp flicker and the climber's breath.
    headlamp.intensity = 6.5 + Math.sin(t * 13) * 0.6 + Math.sin(t * 31) * 0.4 + (Math.random() < 0.01 ? -3.5 : 0);
    climber.scale.setScalar(0.6 + Math.sin(t * 1.2) * 0.025);
    (ghost.material as THREE.SpriteMaterial).opacity = 0.3 + 0.15 * Math.sin(t * 0.9);

    // Snow in a box that follows the camera.
    const count = flakeGeo.drawRange.count, p = flakeGeo.attributes.position as THREE.BufferAttribute, arr = p.array as Float32Array;
    const gust = 0.65 + 0.35 * Math.sin(t * 0.4) + 0.25 * terrain.noise(t * 0.3, 7);
    for (let i = 0; i < count; i++) {
      const j = i * 3, s = flakeJitter[i];
      arr[j] += wind.x * gust * s * dt; arr[j + 1] += wind.y * s * dt; arr[j + 2] += wind.z * gust * s * dt;
      for (let a = 0; a < 3; a++) { const half = (a === 0 ? BOX.x : a === 1 ? BOX.y : BOX.z) / 2; if (arr[j + a] < -half) arr[j + a] += half * 2; else if (arr[j + a] > half) arr[j + a] -= half * 2; }
    }
    p.needsUpdate = true; flakes.position.copy(camera.position);

    // Clouds drift with the wind.
    for (const cl of clouds) {
      cl.s.position.set(cl.base.x + Math.sin(t * 0.05 + cl.phase) * 6 + wind.x * 0.4 * Math.sin(t * 0.02 + cl.phase), cl.base.y + Math.sin(t * 0.11 + cl.phase) * 1.5, cl.base.z + Math.cos(t * 0.04 + cl.phase) * 5);
      cl.s.material.rotation += dt * 0.01 * (cl.phase > 5 ? 1 : -1);
    }

    // Lightning in a storm.
    if (input.weather === 'storm' && !opts.reducedMotion) {
      nextBolt -= dt;
      if (nextBolt <= 0) { lightning = 1; nextBolt = 6 + Math.random() * 9; setTimeout(() => { lightning = Math.max(lightning, 0.7); }, 110); if (audio) setTimeout(() => audio?.thunder(), 400 + Math.random() * 1400); }
    }
    lightning = Math.max(0, lightning - dt * 3.2);
    hemi.intensity = 0.40 + lightning * 0.7; moonLight.intensity = 1.25 + lightning * 0.9;

    // Wind sound tracks the weather, the gusts and the altitude.
    if (audio) {
      const baseGain = { clear: 0.12, wind: 0.28, storm: 0.45, unknown: 0.18 }[input.weather];
      audio.gain.gain.setTargetAtTime(baseGain * (0.5 + 0.7 * viewFrac) * gust, audio.ctx.currentTime, 0.3);
      audio.filter.frequency.setTargetAtTime(260 + 520 * gust + 300 * viewFrac, audio.ctx.currentTime, 0.4);
    }

    renderer.render(scene, camera);

    // Labels follow their anchors; far ones fade.
    const w = container.clientWidth, h = container.clientHeight;
    const stride=Math.max(1,Math.round(zoomNow*15));
    const stepKey=`${Math.round(viewNow/5)}:${stride}:${overviewNow>0.5}`;
    if(stepKey!==lastStepWindow) {
      lastStepWindow=stepKey;
      const start=Math.max(0,Math.min(stepWaypoints.length-24*stride,Math.floor(viewNow/5)-12*stride));
      stepPool.forEach((label,i)=>{
        const step=stepWaypoints[start+i*stride];
        label.el.hidden=!step;
        if(!step)return;
        const point=routeAt(route,yFor(step.altitude));
        label.at.set(point.x,terrain.height(point.x,point.z)+0.5,point.z);
        label.el.dataset.inspectId=step.id;label.el.dataset.title=step.label;
        label.el.setAttribute('aria-label',`Inspect step ${step.label}`);
        label.el.firstElementChild!.textContent=step.label;
      });
    }
    const occupied: {x:number;y:number}[] = [];
    for (const l of [...labels].sort((a,b)=>Number(b.el.classList.contains('is-me'))-Number(a.el.classList.contains('is-me')))) {
      tmp.copy(l.at).project(camera);
      const d = camera.position.distanceTo(l.at);
      const x=(tmp.x+1)/2*w, y=(1-tmp.y)/2*h;
      let fade = tmp.z > -1 && tmp.z < 1 && Math.abs(tmp.x) < 0.95 && Math.abs(tmp.y) < 0.95 ? Math.max(overviewNow, Math.max(0, Math.min(1, 1 - (d - l.near) / 40))) : 0;
      const isStep=l.el.classList.contains('is-step');
      if(isStep&&overviewNow>0.25)fade=0;
      // Reserve quiet space for the title, readout and controls rather than drawing through them.
      if (y < (small?65:130) || y > h - 100 || (!small&&x < 210 && y > h - 210) || (!small&&x > w - 280 && y < 235)) fade = 0;
      const spacing=small||isStep?26:100;
      if (fade > 0.3 && occupied.some(p=>Math.abs(p.x-x)<spacing&&Math.abs(p.y-y)<26)) fade=0;
      if (fade>0.3) occupied.push({x,y});
      l.el.style.opacity = fade.toFixed(2);
      l.el.style.visibility = fade>0.3 ? 'visible' : 'hidden';
      l.el.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
    }

    const rounded = cameraReadout(viewNow,viewTarget);
    if (rounded !== lastEmitted) { lastEmitted = rounded; opts.onView(rounded); }
  }
  frame();

  return {
    set(next) { const moved = next.altitude !== input.altitude; input = next; build(); if (moved) viewTarget = next.altitude; },
    look(m) { overviewTarget = 0; orbitTarget=0; viewTarget = clampView(m); },
    nudge(m) { overviewTarget = 0; viewTarget = clampView(viewTarget + m); },
    recenter() { overviewTarget = 0; viewTarget = input.altitude; orbitTarget = 0; },
    overview(on) { overviewTarget = on ? 1 : 0; },
    zoom(factor) { overviewTarget=0;zoomTarget=boundedZoom(zoomTarget,factor); },
    setSound,
    dispose() {
      cancelAnimationFrame(raf); ro.disconnect(); io.disconnect();
      el.removeEventListener('pointerdown', onDown); el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp); el.removeEventListener('pointercancel', onUp); el.removeEventListener('wheel', onWheel);
      void setSound(false);
      labels.forEach(l => l.el.remove());
      disposables.forEach(d => d.dispose()); doneLine?.geometry.dispose();
      renderer.dispose(); el.remove();
    },
  };
}
