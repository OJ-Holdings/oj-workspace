/**
 * Hyperborea's mountain, as pure maths: a seeded 2D simplex noise, the height field, and the
 * climbing route over it. No rendering here, so the shape can be tested and stays identical
 * on every device. World units: the summit stands at roughly SUMMIT_Y above a plain at y = 0.
 */

// ---- seeded 2D simplex noise (after Stefan Gustavson's public-domain reference) ----
const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
const grad = [[1, 1], [-1, 1], [1, -1], [-1, -1], [1, 0], [-1, 0], [0, 1], [0, -1]];

export function makeNoise(seed: number) {
  const perm = new Uint8Array(512);
  const p = Array.from({ length: 256 }, (_, i) => i);
  let s = seed >>> 0 || 1;
  for (let i = 255; i > 0; i--) { s = (s * 1664525 + 1013904223) >>> 0; const j = s % (i + 1); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  return (x: number, y: number) => {
    const sk = (x + y) * F2, i = Math.floor(x + sk), j = Math.floor(y + sk);
    const t = (i + j) * G2, x0 = x - (i - t), y0 = y - (j - t);
    const i1 = x0 > y0 ? 1 : 0, j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let n = 0;
    const corner = (cx: number, cy: number, g: number) => {
      let tt = 0.5 - cx * cx - cy * cy;
      if (tt <= 0) return 0;
      tt *= tt; const gr = grad[g & 7];
      return tt * tt * (gr[0] * cx + gr[1] * cy);
    };
    n += corner(x0, y0, perm[ii + perm[jj]]);
    n += corner(x1, y1, perm[ii + i1 + perm[jj + j1]]);
    n += corner(x2, y2, perm[ii + 1 + perm[jj + 1]]);
    return 70 * n; // roughly -1..1
  };
}

export const SUMMIT_Y = 100;
export const MOUNTAIN_R = 150;

export type Terrain = {
  height: (x: number, z: number) => number;
  /** 0..1, where 1 is a sharp ridge crest; used to darken gullies and pick out aretes. */
  ridge: (x: number, z: number) => number;
  noise: ReturnType<typeof makeNoise>;
};

const smooth = (a: number, b: number, x: number) => { const t = Math.min(Math.max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t); };

export function makeTerrain(seed = 8849): Terrain {
  const noise = makeNoise(seed);
  const warp = makeNoise(seed + 7);
  const ridgeFbm = (x: number, z: number) => {
    let amp = 1, freq = 1 / 38, sum = 0, norm = 0;
    for (let o = 0; o < 5; o++) {
      const n = 1 - Math.abs(noise(x * freq, z * freq));
      sum += n * n * amp; norm += amp; amp *= 0.5; freq *= 2.03;
    }
    return sum / norm;
  };
  const fbm = (x: number, z: number) => {
    let amp = 1, freq = 1 / 22, sum = 0, norm = 0;
    for (let o = 0; o < 4; o++) { sum += warp(x * freq, z * freq) * amp; norm += amp; amp *= 0.5; freq *= 2.1; }
    return sum / norm;
  };
  const ridge = (x: number, z: number) => {
    const r = Math.hypot(x, z), theta = Math.atan2(z, x);
    const w = warp(x / 60, z / 60) * 0.9;
    const arete = Math.pow(0.5 + 0.5 * Math.cos(5 * theta + w + r / 45), 5);
    return Math.min(1, arete * 0.6 + ridgeFbm(x, z) * 0.55);
  };
  const height = (x: number, z: number) => {
    const r = Math.hypot(x, z);
    // An asymmetric pyramidal massif, not a radial dome. Long buttresses and
    // glacial bowls establish geology; fine roughness never changes the business scale.
    const theta = Math.atan2(z, x);
    const buttress = Math.pow(0.5 + 0.5 * Math.cos(theta * 4 + warp(x / 65, z / 65) * 0.5), 3);
    const radius = Math.hypot(x * 0.91, z * 1.04) * (0.88 + 0.32 * (1 - buttress));
    const massif = Math.pow(Math.max(0, 1 - radius / 157), 1.72);
    const edge = 1 - smooth(112, 151, r);
    const peakFade = smooth(3, 22, r);
    const shoulder = Math.exp(-((x + 48) ** 2 / 650 + (z + 26) ** 2 / 490)) * 15
      + Math.exp(-((x - 43) ** 2 / 360 + (z + 17) ** 2 / 720)) * 12;
    const bowl = Math.exp(-((x - 23) ** 2 / 220 + (z - 54) ** 2 / 380)) * 9;
    const rough = peakFade * edge * (0.25 + 0.75 * Math.sqrt(massif));
    const crests = ((ridge(x, z) - 0.38) * 16 + buttress * 9) * rough;
    const detail = fbm(x, z) * 3.4 * rough;
    return Math.max(0, SUMMIT_Y * massif + (shoulder - bowl) * peakFade * edge + crests + detail);
  };
  return { height, ridge, noise };
}

export type RoutePoint = { x: number; y: number; z: number; climb: number };

/**
 * The climbing line: switchbacks from the plain to the peak. `climb` is the running maximum of
 * height along the path, so it only ever rises and can be used to place an altitude on it.
 */
export function makeRoute(t: Terrain, samples = 900): RoutePoint[] {
  const pts: RoutePoint[] = [];
  const theta0 = 0.95;
  let climb = 0;
  for (let i = 0; i <= samples; i++) {
    const s = i / samples;
    const r = MOUNTAIN_R * 1.02 * Math.pow(1 - s, 1.08);
    const theta = theta0 + 0.42 * Math.sin(s * Math.PI * 5.5) * (1 - s) + 0.25 * s;
    const x = r * Math.cos(theta), z = r * Math.sin(theta);
    const y = t.height(x, z);
    climb = Math.max(climb, y);
    pts.push({ x, y, z, climb });
  }
  return pts;
}

/** The peak's real height (the route's last point sits on it). */
export const routeTop = (route: RoutePoint[]) => route[route.length - 1].climb;

/** World height for an expedition altitude in metres (0 at the foot of the route, the summit at 8,849 m). */
export function worldYFor(route: RoutePoint[], metres: number, summitMetres: number) {
  const foot = route[0].climb, top = routeTop(route);
  return foot + (Math.min(Math.max(metres, 0), summitMetres) / summitMetres) * (top - foot);
}

/** The first point on the route that reaches a given world height (interpolated). */
export function routeAt(route: RoutePoint[], y: number): RoutePoint & { index: number; dir: { x: number; z: number } } {
  let i = route.findIndex(p => p.climb >= y);
  if (i < 0) i = route.length - 1;
  const a = route[Math.max(i - 1, 0)], b = route[i];
  const f = b.climb === a.climb ? 0 : Math.min(Math.max((y - a.climb) / (b.climb - a.climb), 0), 1);
  const x = a.x + (b.x - a.x) * f, z = a.z + (b.z - a.z) * f;
  const nx = b.x - a.x, nz = b.z - a.z, len = Math.hypot(nx, nz) || 1;
  return { x, z, y: Math.max(a.y + (b.y - a.y) * f, y - 0.5), climb: y, index: i, dir: { x: nx / len, z: nz / len } };
}
