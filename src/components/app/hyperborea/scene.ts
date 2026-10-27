import * as THREE from 'three';
import { makeRoute, makeTerrain, MOUNTAIN_R, routeAt, routeTop, worldYFor, type RoutePoint } from '@/lib/hyperborea-terrain';
import type { Weather } from '@/lib/hyperborea';

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
const fogDensity: Record<Weather, number> = { clear: 0.0075, wind: 0.0105, storm: 0.016, unknown: 0.014 };
const flakeCount: Record<Weather, number> = { clear: 1400, wind: 3600, storm: 6500, unknown: 2600 };
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
  const renderer = new THREE.WebGLRenderer({ antialias: !small, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
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
    uniforms: { top: { value: new THREE.Color(C.skyTop) }, low: { value: new THREE.Color(C.skyLow) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: 'uniform vec3 top; uniform vec3 low; varying vec3 vP; void main(){ float h = clamp(vP.y*1.6+0.15,0.0,1.0); gl_FragColor = vec4(mix(low, top, h),1.0); }',
  }));
  const sky = new THREE.Mesh(keep(new THREE.SphereGeometry(700, 32, 16)), skyMat); scene.add(sky);
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
  const hemi = new THREE.HemisphereLight(C.hemiSky, C.hemiGround, 0.55); scene.add(hemi);
  const moonLight = new THREE.DirectionalLight(C.moon, 1.9); moonLight.position.set(-160, 220, -200); scene.add(moonLight);
  const fill = new THREE.DirectionalLight(C.fill, 0.35); fill.position.set(200, 60, 220); scene.add(fill);
  const headlamp = new THREE.PointLight(C.ember, 7, 12, 1.8); scene.add(headlamp);

  // ---- the mountain ----
  const size = MOUNTAIN_R * 2.3, seg = small ? 190 : 330;
  const geo = keep(new THREE.PlaneGeometry(size, size, seg, seg)); geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const ridgeVals = new Float32Array(pos.count);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i);
    pos.setY(i, terrain.height(x, z)); ridgeVals[i] = terrain.ridge(x, z);
  }
  geo.computeVertexNormals();
  const normals = geo.attributes.normal as THREE.BufferAttribute;
  const colors = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), ny = normals.getY(i);
    const n = terrain.noise(x / 9, z / 9), n2 = terrain.noise(x / 2.5 + 40, z / 2.5);
    const shade = 0.7 + 0.25 * n + 0.12 * n2;
    const gully = 0.55 + 0.45 * ridgeVals[i];
    let r = C.rock.r * shade * gully, g = C.rock.g * shade * gully, b = C.rock.b * shade * gully;
    const snowline = 30 - 12 * smooth(55, 95, y);
    const flatness = smooth(0.32 - 0.14 * smooth(55, 95, y), 0.7, ny);
    const snow = smooth(snowline - 10, snowline + 8, y + n * 12) * flatness;
    const s = 0.78 + 0.22 * n2;
    r += (s * C.snowpack.r - r) * snow; g += (s * C.snowpack.g - g) * snow; b += (s * C.snowpack.b - b) * snow;
    const far = smooth(MOUNTAIN_R * 0.95, MOUNTAIN_R * 1.15, Math.hypot(x, z));
    r *= 1 - far * 0.6; g *= 1 - far * 0.6; b *= 1 - far * 0.55;
    colors.set([r, g, b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const grain = keep(grainTexture(terrain.noise));
  const rockMat = keep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.94, metalness: 0, bumpMap: grain, bumpScale: 1.4 }));
  scene.add(new THREE.Mesh(geo, rockMat));
  const plain = new THREE.Mesh(keep(new THREE.CircleGeometry(800, 48)), keep(new THREE.MeshStandardMaterial({ color: C.plain, roughness: 1 })));
  plain.rotation.x = -Math.PI / 2; plain.position.y = -0.4; scene.add(plain);

  // ---- the route ----
  const lineFrom = (pts: RoutePoint[]) => {
    const g = keep(new THREE.BufferGeometry());
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pts.flatMap(p => [p.x, p.y + 0.3, p.z])), 3)); return g;
  };
  const routeLine = new THREE.Line(lineFrom(route), keep(new THREE.LineDashedMaterial({ color: C.route, dashSize: 0.7, gapSize: 1.1, transparent: true, opacity: 0.4 })));
  routeLine.computeLineDistances(); scene.add(routeLine);
  const doneMat = keep(new THREE.LineBasicMaterial({ color: C.ember, transparent: true, opacity: 0.9 }));
  let doneLine: THREE.Line | null = null;

  const emberTex = keep(glowTexture(C.ember, 1));
  const coldTex = keep(glowTexture(C.ghost, 0.7));
  const climber = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: emberTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })));
  climber.scale.setScalar(2.6); scene.add(climber);
  const ghost = new THREE.Sprite(keep(new THREE.SpriteMaterial({ map: coldTex, transparent: true, depthWrite: false, opacity: 0.45 })));
  ghost.scale.setScalar(2.2); scene.add(ghost);

  const campGroup = new THREE.Group(); scene.add(campGroup);
  const tentGeo = keep(new THREE.ConeGeometry(0.45, 0.6, 4)), tentMat = keep(new THREE.MeshStandardMaterial({ color: C.tent, roughness: 0.8 }));
  const poleGeo = keep(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 5)), poleMat = keep(new THREE.MeshBasicMaterial({ color: C.ghost }));
  const flagGeo = keep(new THREE.PlaneGeometry(0.9, 0.55)), flagMat = keep(new THREE.MeshBasicMaterial({ color: C.ember, side: THREE.DoubleSide }));
  const campGlowWarm = keep(new THREE.SpriteMaterial({ map: emberTex, transparent: true, depthWrite: false, opacity: 0.55, blending: THREE.AdditiveBlending }));
  const campGlowCold = keep(new THREE.SpriteMaterial({ map: coldTex, transparent: true, depthWrite: false, opacity: 0.35 }));

  // ---- cloud: a shroud over the summit, drifting banks lower down ----
  const cloudTex = keep(cloudTexture(terrain.noise));
  type Cloud = { s: THREE.Sprite; base: THREE.Vector3; phase: number; summit: boolean };
  const clouds: Cloud[] = [];
  const addCloud = (x: number, y: number, z: number, scale: number, opacity: number, summit: boolean) => {
    const m = keep(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, depthWrite: false, opacity, color: C.cloud }));
    const s = new THREE.Sprite(m); s.position.set(x, y, z); s.scale.set(scale, scale * 0.55, 1); s.material.rotation = Math.random() * Math.PI;
    scene.add(s); clouds.push({ s, base: s.position.clone(), phase: Math.random() * 10, summit });
  };
  for (let i = 0; i < 34; i++) { const a = Math.random() * Math.PI * 2, r = Math.random() * 26; addCloud(Math.cos(a) * r, top - 10 + Math.random() * 16, Math.sin(a) * r, 22 + Math.random() * 22, 0.42, true); }
  for (let i = 0; i < 46; i++) { const a = Math.random() * Math.PI * 2, r = 28 + Math.random() * 110; addCloud(Math.cos(a) * r, 22 + Math.random() * 62, Math.sin(a) * r, 30 + Math.random() * 40, 0.16 + Math.random() * 0.14, false); }

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
    const el = document.createElement(id ? 'button' : 'div'); el.className = 'hb3-label ' + cls; el.textContent = text;
    if (el instanceof HTMLButtonElement) {
      el.type = 'button'; el.setAttribute('aria-label', `Inspect ${text}`);
      el.addEventListener('click', () => { if (id) opts.onInspect?.(id); });
    }
    labelLayer.appendChild(el); labels.push({ el, at, near }); return el;
  };

  // ---- state ----
  let input = first;
  const yFor = (m: number) => worldYFor(route, m, input.summitMetres);
  let viewTarget = first.altitude, viewNow = first.altitude, orbitTarget = 0, orbitNow = 0;
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
      const tent = new THREE.Mesh(tentGeo, tentMat); tent.position.set(1.1, 0.25, 0.4); tent.rotation.y = Math.PI / 4; g.add(tent);
      const glow = new THREE.Sprite(c.reached ? campGlowWarm : campGlowCold); glow.position.y = 0.8; glow.scale.setScalar(c.reached ? 2.6 : 1.8); g.add(glow);
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
    headlamp.position.set(me.x, me.y + 1.8, me.z);
    // The next objectives: small cold cairns on the route ahead.
    input.waypoints.forEach((w, i) => {
      const wp = routeAt(route, yFor(w.altitude));
      const cairn = new THREE.Sprite(campGlowCold); cairn.position.set(wp.x, terrain.height(wp.x, wp.z) + 0.5, wp.z); cairn.scale.setScalar(1.3);
      campGroup.add(cairn);
      makeLabel(w.label, w.id?.startsWith('history:') ? 'is-history' : 'is-waypoint', cairn.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 60, w.id);
    });
    makeLabel('OJ · inspect', 'is-me', climber.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 200, 'records');
    const gh = routeAt(route, yFor(input.ghost));
    ghost.position.set(gh.x, gh.y + 1.1, gh.z);
    ghost.visible = Math.abs(input.ghost - input.altitude) > 20;
    if (ghost.visible) makeLabel('Pace for 2046', 'is-ghost', ghost.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 120);
    if (doneLine) { scene.remove(doneLine); doneLine.geometry.dispose(); }
    doneLine = new THREE.Line(lineFrom(route.slice(0, Math.max(me.index, 1)).concat([{ ...me, climb: me.climb }])), doneMat);
    scene.add(doneLine);
    for (const cl of clouds) if (cl.summit) (cl.s.material as THREE.SpriteMaterial).opacity = input.summitReached ? 0 : 0.42;
    (scene.fog as THREE.FogExp2).density = fogDensity[input.weather];
    starMat.opacity = input.weather === 'clear' ? 0.55 : input.weather === 'wind' ? 0.25 : 0.04;
    moonMat.opacity = input.weather === 'storm' ? 0.12 : input.weather === 'clear' ? 0.6 : 0.3;
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
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3(), look = new THREE.Vector3(), peak = new THREE.Vector3(0, top, 0);
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    if (!visible || document.hidden) { clock.getDelta(); return; }
    const dt = Math.min(clock.getDelta(), 0.05), t = clock.elapsedTime;
    const k = opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 3.4);
    viewNow += (viewTarget - viewNow) * k; orbitNow += (orbitTarget - orbitNow) * k;
    overviewNow += (overviewTarget - overviewNow) * (opts.reducedMotion ? 1 : 1 - Math.exp(-dt * 3));
    const viewFrac = viewNow / input.summitMetres;

    // Camera: close on the route at the viewed altitude, outside the mountain, looking a little up the face.
    const focus = routeAt(route, yFor(viewNow));
    const outward = Math.atan2(focus.z, focus.x) + orbitNow;
    const dist = 14 + 4 * (1 - viewFrac), lift = 4 + 1.5 * viewFrac;
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
    look.set(focus.x, focus.y + 2.2, focus.z).lerp(peak, 0.035);
    // Fit the entire route/massif even on a portrait phone. Smooth position AND aim,
    // rather than snapping X/Z and lookAt while only damping camera height.
    const halfFov = Math.min(THREE.MathUtils.degToRad(camera.fov / 2), Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect));
    const radius = Math.max(MOUNTAIN_R * 1.12, top * 0.65);
    const overviewDistance = radius / Math.sin(halfFov) * 1.12;
    const wholeLook = new THREE.Vector3(0, top * 0.35, 0);
    const wholePosition = new THREE.Vector3(Math.cos(0.9 + orbitNow) * overviewDistance * 0.88, top * 0.35 + overviewDistance * 0.48, Math.sin(0.9 + orbitNow) * overviewDistance * 0.88);
    tmp.lerp(wholePosition, overviewNow); look.lerp(wholeLook, overviewNow);
    if (!cameraReady || opts.reducedMotion) { camera.position.copy(tmp); smoothLook.copy(look); cameraReady = true; }
    else { camera.position.lerp(tmp, 1 - Math.exp(-dt * 5)); smoothLook.lerp(look, 1 - Math.exp(-dt * 5)); }
    camera.position.y = Math.max(camera.position.y, terrain.height(camera.position.x, camera.position.z) + 2.2);
    camera.lookAt(smoothLook);

    // Weather-driven fog: thicker in the Death Zone.
    const deathZone = smooth(7800, 8300, viewNow);
    (scene.fog as THREE.FogExp2).density = fogDensity[input.weather] * (1 + 0.5 * deathZone) * (1 - overviewNow * 0.94);

    // Headlamp flicker and the climber's breath.
    headlamp.intensity = 6.5 + Math.sin(t * 13) * 0.6 + Math.sin(t * 31) * 0.4 + (Math.random() < 0.01 ? -3.5 : 0);
    climber.scale.setScalar(2 + Math.sin(t * 2.2) * 0.2);
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
    hemi.intensity = 0.55 + lightning * 5; moonLight.intensity = 1.9 + lightning * 3;

    // Wind sound tracks the weather, the gusts and the altitude.
    if (audio) {
      const baseGain = { clear: 0.12, wind: 0.28, storm: 0.45, unknown: 0.18 }[input.weather];
      audio.gain.gain.setTargetAtTime(baseGain * (0.5 + 0.7 * viewFrac) * gust, audio.ctx.currentTime, 0.3);
      audio.filter.frequency.setTargetAtTime(260 + 520 * gust + 300 * viewFrac, audio.ctx.currentTime, 0.4);
    }

    renderer.render(scene, camera);

    // Labels follow their anchors; far ones fade.
    const w = container.clientWidth, h = container.clientHeight;
    const occupied: {x:number;y:number}[] = [];
    for (const l of [...labels].sort((a,b)=>Number(b.el.classList.contains('is-me'))-Number(a.el.classList.contains('is-me')))) {
      tmp.copy(l.at).project(camera);
      const d = camera.position.distanceTo(l.at);
      const x=(tmp.x+1)/2*w, y=(1-tmp.y)/2*h;
      let fade = tmp.z > -1 && tmp.z < 1 && Math.abs(tmp.x) < 0.95 && Math.abs(tmp.y) < 0.95 ? Math.max(overviewNow, Math.max(0, Math.min(1, 1 - (d - l.near) / 40))) : 0;
      if (fade > 0.3 && occupied.some(p=>Math.abs(p.x-x)<135&&Math.abs(p.y-y)<35)) fade=0;
      if (fade>0.3) occupied.push({x,y});
      l.el.style.opacity = fade.toFixed(2);
      l.el.style.visibility = fade>0.3 ? 'visible' : 'hidden';
      l.el.style.transform = `translate(${((tmp.x + 1) / 2 * w).toFixed(1)}px, ${((1 - tmp.y) / 2 * h).toFixed(1)}px) translate(-50%, -100%)`;
    }

    const rounded = Math.round(viewNow / 10) * 10;
    if (rounded !== lastEmitted) { lastEmitted = rounded; opts.onView(viewNow); }
  }
  frame();

  return {
    set(next) { const moved = next.altitude !== input.altitude; input = next; build(); if (moved) viewTarget = next.altitude; },
    look(m) { overviewTarget = 0; viewTarget = clampView(m); },
    nudge(m) { overviewTarget = 0; viewTarget = clampView(viewTarget + m); },
    recenter() { overviewTarget = 0; viewTarget = input.altitude; orbitTarget = 0; },
    overview(on) { overviewTarget = on ? 1 : 0; },
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
