// Detailed procedural model of a modern (2022+ regulations) Formula 1 car.
// Local axes: +z = forward, +y = up. Units are metres (car is ~5.6 m long, 2.0 m wide).
import * as THREE from 'three';
import { tex, liveryTexture, liveryGlowTexture } from './textures.js';

export const TYRES = {
  soft: { name: 'Soft', colour: '#e8262e', grip: 1.07, wear: 1.6 },
  medium: { name: 'Medium', colour: '#f5c518', grip: 1.0, wear: 1.0 },
  hard: { name: 'Hard', colour: '#f2f2f2', grip: 0.94, wear: 0.62 },
};

const Z_MIN = -2.85, Z_MAX = 3.15;
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------- geometry helpers ----------
function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}
// Lofted body through superellipse cross-sections {z, x, y, w, h, n}.
function loft(sections, { ring = 28, sub = 4, capStart = false, capEnd = false } = {}) {
  const S = [];
  const keys = ['z', 'x', 'y', 'w', 'h', 'n'];
  for (let i = 0; i < sections.length - 1; i++) {
    for (let k = 0; k < sub; k++) {
      const t = k / sub, o = {};
      for (const key of keys) {
        const g = (j) => sections[Math.max(0, Math.min(sections.length - 1, j))][key] ?? (key === 'x' ? 0 : 3);
        o[key] = catmull(g(i - 1), g(i), g(i + 1), g(i + 2), t);
      }
      S.push(o);
    }
  }
  const last = sections[sections.length - 1]; S.push({ x: 0, n: 3, ...last });
  const pos = [], uv = [], idx = [];
  for (let s = 0; s < S.length; s++) {
    const c = S[s];
    for (let r = 0; r <= ring; r++) {
      const phi = (r / ring) * Math.PI * 2 - Math.PI / 2;
      const cs = Math.cos(phi), sn = Math.sin(phi), e = 2 / c.n;
      const px = Math.sign(cs) * Math.pow(Math.abs(cs), e), py = Math.sign(sn) * Math.pow(Math.abs(sn), e);
      pos.push(c.x + px * c.w, c.y + py * c.h, c.z);
      uv.push((c.z - Z_MIN) / (Z_MAX - Z_MIN), r / ring);
    }
  }
  const W = ring + 1;
  for (let s = 0; s < S.length - 1; s++) for (let r = 0; r < ring; r++) {
    const a = s * W + r, b = a + 1, c = a + W, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  const addCap = (s) => {
    const c = S[s], centre = pos.length / 3;
    pos.push(c.x, c.y, c.z); uv.push((c.z - Z_MIN) / (Z_MAX - Z_MIN), 0.5);
    for (let r = 0; r < ring; r++) idx.push(centre, s * W + r, s * W + r + 1);
  };
  if (capStart) addCap(0);
  if (capEnd) addCap(S.length - 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// Cambered aerofoil section (inverted for downforce), unit chord, LE at 0, TE at 1.
function aerofoil(thick = 0.12, camber = 0.07, pts = 9) {
  const up = [], lo = [];
  for (let i = 0; i <= pts; i++) {
    const x = (1 - Math.cos((i / pts) * Math.PI)) / 2;
    const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = -camber * (x < 0.4 ? (2 * 0.4 * x - x * x) / 0.16 : ((1 - 0.8) + 2 * 0.4 * x - x * x) / 0.36);
    up.push([x, yc + yt]); lo.push([x, yc - yt]);
  }
  return up.reverse().concat(lo.slice(1)); // TE(top) -> LE -> TE(bottom)
}
// Wing swept along x through stations {x, y, z(LE), chord, angle(rad, +ve lifts the trailing edge)}.
function wing(stations, { thick = 0.12, camber = 0.07, caps = true } = {}) {
  const prof = aerofoil(thick, camber), P = prof.length;
  const pos = [], uv = [], idx = [];
  stations.forEach((st, si) => {
    const ca = Math.cos(st.angle), sa = Math.sin(st.angle);
    prof.forEach(([px, py], pi) => {
      const lz = -px * st.chord, ly = py * st.chord; // chord runs backwards (-z)
      pos.push(st.x, st.y + ly * ca - lz * sa, st.z + lz * ca + ly * sa);
      uv.push(si / (stations.length - 1), pi / (P - 1));
    });
  });
  for (let s = 0; s < stations.length - 1; s++) for (let p = 0; p < P - 1; p++) {
    const a = s * P + p, b = a + 1, c = a + P, d = c + 1;
    idx.push(a, b, c, b, d, c);
  }
  if (caps) for (const s of [0, stations.length - 1]) for (let p = 1; p < P - 2; p++) idx.push(s * P, s * P + p, s * P + p + 1);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals();
  return g;
}
function spanStations(x0, x1, n, fn) { const out = []; for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * (i / n); out.push({ x, ...fn(x) }); } return out; }
// Flat plate in the y-z plane at x, from a 2D outline of [z, y] points.
function plate(points, thick, x) {
  const shape = new THREE.Shape(points.map(([z, y]) => new THREE.Vector2(z, y)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateY(-Math.PI / 2); g.translate(x + thick / 2, 0, 0);
  return g;
}
// Flat plate in the x-z plane (floor), outline of [x, z] points.
function floorPlate(points, thick, y) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, z)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: thick, bevelEnabled: false });
  g.rotateX(Math.PI / 2); g.translate(0, y + thick, 0);
  return g;
}
function tube(points, r, seg = 40) {
  return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p))), seg, r, 8, false);
}
function rod(a, b, r = 0.016) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), len = A.distanceTo(B);
  const g = new THREE.CylinderGeometry(r, r, len, 6, 1);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize()));
  g.translate((A.x + B.x) / 2, (A.y + B.y) / 2, (A.z + B.z) / 2);
  return g;
}
const mirrorX = (g) => { const m = g.clone(); m.scale(-1, 1, 1); flipWinding(m); return m; };
function flipWinding(g) {
  if (g.index) { const a = g.index.array; for (let i = 0; i < a.length; i += 3) { const t = a[i + 1]; a[i + 1] = a[i + 2]; a[i + 2] = t; } g.index.needsUpdate = true; }
  g.computeVertexNormals();
}
// Merge geometries (position/normal/uv) into one.
function merge(list) {
  const parts = list.map((g) => {
    const n = g.index ? g.toNonIndexed() : g;
    if (!n.attributes.normal) n.computeVertexNormals();
    if (!n.attributes.uv) n.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(n.attributes.position.count * 2), 2));
    return n;
  });
  const out = new THREE.BufferGeometry();
  for (const name of ['position', 'normal', 'uv']) {
    const size = name === 'uv' ? 2 : 3;
    const total = parts.reduce((s, p) => s + p.attributes[name].count * size, 0);
    const arr = new Float32Array(total); let o = 0;
    for (const p of parts) { arr.set(p.attributes[name].array.subarray(0, p.attributes[name].count * size), o); o += p.attributes[name].count * size; }
    out.setAttribute(name, new THREE.BufferAttribute(arr, size));
  }
  return out;
}

// ---------- materials ----------
const matCache = new Map();
function teamMaterials(team) {
  const key = JSON.stringify([team.code, team.livery, team.helmet, team.tcam]);
  if (matCache.has(key)) return matCache.get(key);
  const L = team.livery;
  const F = {
    gloss: { roughness: 0.32, metalness: 0.25, clearcoat: 1, clearcoatRoughness: 0.06 },
    matte: { roughness: 0.75, metalness: 0.05, clearcoat: 0, clearcoatRoughness: 1 },
    satin: { roughness: 0.48, metalness: 0.35, clearcoat: 0.4, clearcoatRoughness: 0.4 },
    pearl: { roughness: 0.25, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.05, iridescence: 1, iridescenceIOR: 1.6, iridescenceThicknessRange: [200, 600] },
    chrome: { roughness: 0.12, metalness: 1, clearcoat: 1, clearcoatRoughness: 0.03 },
  }[L.finish || 'gloss'] || {};
  const glow = liveryGlowTexture(team);
  const glowOpts = glow ? { emissive: 0xffffff, emissiveMap: glow, emissiveIntensity: 1.6 } : {};
  const physical = (o) => new THREE.MeshPhysicalMaterial({ side: THREE.DoubleSide, ...o });
  const carbonMap = tex.carbon(); carbonMap.repeat.set(6, 6);
  const m = {
    livery: physical({ map: liveryTexture(team), ...F, ...glowOpts }),
    paint: physical({ color: L.base, ...F }),
    accent: physical({ color: L.accent, ...F }),
    carbon: physical({ map: carbonMap, color: 0x8a8f96, roughness: 0.38, metalness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.55, metalness: 0.2, side: THREE.DoubleSide }),
    tyre: new THREE.MeshStandardMaterial({ color: 0x1b1b1c, roughness: 0.88, metalness: 0 }),
    rim: physical({ color: 0x24272b, roughness: 0.3, metalness: 0.8, clearcoat: 0.5 }),
    metal: new THREE.MeshStandardMaterial({ color: 0xb9c0c7, roughness: 0.25, metalness: 0.95 }),
    helmet: physical({ color: team.helmet || L.accent, roughness: 0.2, metalness: 0.1, clearcoat: 1 }),
    visor: physical({ color: 0x111820, roughness: 0.05, metalness: 0.9, clearcoat: 1 }),
    tcam: new THREE.MeshStandardMaterial({ color: team.tcam || 0xf5e026, roughness: 0.4 }),
    rain: new THREE.MeshStandardMaterial({ color: 0x330000, emissive: 0xff1010, emissiveIntensity: 0.2 }),
  };
  matCache.set(key, m);
  return m;
}
const sidewallMats = {};
function sidewallMaterial(compound) {
  if (!sidewallMats[compound]) sidewallMats[compound] = new THREE.MeshStandardMaterial({ map: tex.sidewall(TYRES[compound].colour), roughness: 0.8, side: THREE.DoubleSide });
  return sidewallMats[compound];
}

// ---------- the car ----------
export function buildCar(team, { compound = 'medium', shadows = true } = {}) {
  const M = teamMaterials(team);
  const parts = {}; // material key -> geometries
  const add = (key, g) => { (parts[key] ||= []).push(g); };
  const both = (key, g) => { add(key, g); add(key, mirrorX(g)); };

  // Monocoque, nose and engine cover
  add('livery', loft([
    { z: 3.06, y: 0.25, w: 0.045, h: 0.04, n: 2.2 },
    { z: 2.88, y: 0.27, w: 0.095, h: 0.07, n: 2.4 },
    { z: 2.58, y: 0.31, w: 0.135, h: 0.1, n: 2.6 },
    { z: 2.18, y: 0.37, w: 0.165, h: 0.13, n: 2.8 },
    { z: 1.72, y: 0.43, w: 0.2, h: 0.16, n: 3.0 },
    { z: 1.25, y: 0.48, w: 0.235, h: 0.19, n: 3.2 },
    { z: 0.8, y: 0.51, w: 0.27, h: 0.21, n: 3.4 },
    { z: 0.4, y: 0.52, w: 0.3, h: 0.22, n: 3.6 },
    { z: 0.0, y: 0.51, w: 0.33, h: 0.22, n: 3.6 },
    { z: -0.38, y: 0.52, w: 0.34, h: 0.23, n: 3.4 },
    { z: -0.68, y: 0.6, w: 0.29, h: 0.34, n: 3.0 },
    { z: -0.95, y: 0.62, w: 0.24, h: 0.355, n: 2.6 },
    { z: -1.3, y: 0.58, w: 0.22, h: 0.3, n: 2.4 },
    { z: -1.7, y: 0.52, w: 0.19, h: 0.23, n: 2.4 },
    { z: -2.05, y: 0.46, w: 0.14, h: 0.165, n: 2.4 },
    { z: -2.4, y: 0.42, w: 0.09, h: 0.11, n: 2.4 },
    { z: -2.62, y: 0.4, w: 0.05, h: 0.06, n: 2.2 },
  ], { capStart: true, capEnd: true }));

  // Sidepods (with dark radiator inlets)
  const pod = [
    { z: 0.55, x: 0.49, y: 0.42, w: 0.13, h: 0.17, n: 4.4 },
    { z: 0.36, x: 0.53, y: 0.41, w: 0.19, h: 0.23, n: 4.4 },
    { z: 0.0, x: 0.55, y: 0.4, w: 0.2, h: 0.245, n: 4.2 },
    { z: -0.45, x: 0.52, y: 0.38, w: 0.2, h: 0.225, n: 4.0 },
    { z: -0.9, x: 0.44, y: 0.34, w: 0.17, h: 0.185, n: 3.8 },
    { z: -1.3, x: 0.33, y: 0.3, w: 0.12, h: 0.14, n: 3.6 },
    { z: -1.66, x: 0.22, y: 0.27, w: 0.07, h: 0.09, n: 3.4 },
  ];
  both('livery', loft(pod, { capEnd: true }));
  const inlet = new THREE.CircleGeometry(1, 24); inlet.scale(0.115, 0.15, 1); inlet.translate(0.49, 0.43, 0.551);
  both('black', inlet);

  // Cockpit opening, headrest, driver
  const cockpit = new THREE.CircleGeometry(1, 32); cockpit.scale(0.2, 0.46, 1); cockpit.rotateX(-Math.PI / 2); cockpit.translate(0, 0.755, -0.12);
  add('black', cockpit);
  const head = new THREE.BoxGeometry(0.09, 0.09, 0.32); head.translate(0.17, 0.77, -0.3); both('carbon', head);
  const helmet = new THREE.SphereGeometry(0.135, 24, 16); helmet.scale(1, 1, 1.12); helmet.translate(0, 0.84, -0.2); add('helmet', helmet);
  const visor = new THREE.SphereGeometry(0.139, 24, 8, Math.PI / 2 - 0.95, 1.9, 1.12, 0.42); visor.scale(1, 1, 1.12); visor.translate(0, 0.84, -0.2); add('visor', visor);

  // Airbox, roll hoop, T-cam, shark fin
  const intake = new THREE.CircleGeometry(1, 24); intake.scale(0.085, 0.07, 1); intake.rotateX(-0.45); intake.translate(0, 0.9, -0.64); add('black', intake);
  const tcam = new THREE.BoxGeometry(0.13, 0.05, 0.09); tcam.translate(0, 0.995, -0.86); add('tcam', tcam);
  add('livery', plate([[-0.95, 0.9], [-2.12, 0.86], [-2.3, 0.58], [-1.5, 0.66]], 0.012, 0));

  // Halo
  const hoop = [[0.29, 0.72, -0.42], [0.31, 0.86, -0.27], [0.29, 0.93, -0.02], [0.18, 0.955, 0.17], [0, 0.96, 0.25], [-0.18, 0.955, 0.17], [-0.29, 0.93, -0.02], [-0.31, 0.86, -0.27], [-0.29, 0.72, -0.42]];
  add('black', tube(hoop, 0.028, 60));
  add('black', tube([[0, 0.96, 0.25], [0, 0.9, 0.42], [0, 0.76, 0.52]], 0.03, 16));

  // Mirrors
  const mirror = new THREE.SphereGeometry(1, 16, 10); mirror.scale(0.095, 0.045, 0.05); mirror.translate(0.42, 0.72, 0.36);
  both('paint', mirror);
  both('carbon', rod([0.26, 0.66, 0.34], [0.38, 0.71, 0.36], 0.012));
  const glass = new THREE.CircleGeometry(1, 16); glass.scale(0.085, 0.036, 1); glass.rotateY(Math.PI); glass.translate(0.42, 0.72, 0.31); both('visor', glass);

  // Floor, edge wings, diffuser and plank
  add('carbon', floorPlate([[0.26, 1.3], [0.55, 0.95], [0.86, 0.55], [0.9, -1.3], [0.64, -1.6], [0.56, -2.3], [-0.56, -2.3], [-0.64, -1.6], [-0.9, -1.3], [-0.86, 0.55], [-0.55, 0.95], [-0.26, 1.3]], 0.025, 0.06));
  both('carbon', plate([[0.55, 0.085], [-1.25, 0.085], [-1.25, 0.16], [0.35, 0.12]], 0.01, 0.89));
  const ramp = new THREE.PlaneGeometry(1.1, 0.88); ramp.rotateX(-Math.PI / 2 + 0.3); ramp.translate(0, 0.2, -2.0); add('carbon', ramp);
  for (const x of [0, 0.2, 0.4, 0.56]) { const g = plate([[-1.6, 0.07], [-2.45, 0.08], [-2.45, 0.34], [-1.6, 0.09]], 0.01, x); add('carbon', g); if (x) add('carbon', mirrorX(g)); }

  // Front wing: 4 elements curling up into the endplates
  const fw = [
    { z: 3.12, y: 0.075, chord: 0.3, a: 0.05, rise: 0.03, key: 'carbon' },
    { z: 2.9, y: 0.115, chord: 0.17, a: 0.2, rise: 0.07, key: 'carbon' },
    { z: 2.79, y: 0.15, chord: 0.14, a: 0.33, rise: 0.1, key: 'carbon' },
    { z: 2.7, y: 0.185, chord: 0.12, a: 0.45, rise: 0.12, key: 'accent' },
  ];
  for (const e of fw) {
    const g = wing(spanStations(-0.98, 0.98, 30, (x) => {
      const o = smooth(0.35, 0.95, Math.abs(x));
      return { y: e.y + e.rise * o, z: e.z - 0.12 * o, chord: e.chord * (1 - 0.25 * o), angle: e.a + 0.25 * o };
    }), { thick: 0.1, camber: 0.08 });
    add(e.key, g);
  }
  both('paint', plate([[3.14, 0.04], [2.58, 0.04], [2.55, 0.14], [2.62, 0.3], [2.8, 0.31], [3.0, 0.19], [3.14, 0.1]], 0.014, 0.985));
  both('carbon', rod([0.08, 0.26, 2.9], [0.12, 0.12, 2.98], 0.012));

  // Rear wing (main plane fixed; DRS flap is a separate moving part), endplates, beam wing, pylons
  add('carbon', wing(spanStations(-0.5, 0.5, 20, (x) => {
    const o = smooth(0.32, 0.5, Math.abs(x));
    return { y: 0.93 - 0.06 * o, z: -2.33, chord: 0.31, angle: 0.22 + 0.2 * o };
  }), { thick: 0.11, camber: 0.09 }));
  both('paint', plate([[-2.26, 0.66], [-2.86, 0.6], [-2.88, 1.04], [-2.66, 1.09], [-2.36, 1.02], [-2.26, 0.86]], 0.014, 0.508));
  add('carbon', wing(spanStations(-0.42, 0.42, 10, () => ({ y: 0.4, z: -2.5, chord: 0.13, angle: 0.15 })), { thick: 0.12, camber: 0.08 }));
  add('carbon', wing(spanStations(-0.42, 0.42, 10, () => ({ y: 0.47, z: -2.6, chord: 0.11, angle: 0.45 })), { thick: 0.12, camber: 0.08 }));
  both('carbon', plate([[-2.2, 0.42], [-2.42, 0.42], [-2.5, 0.93], [-2.36, 0.93]], 0.012, 0.06));
  const exhaust = new THREE.CylinderGeometry(0.045, 0.05, 0.16, 16, 1, true); exhaust.rotateX(Math.PI / 2); exhaust.translate(0, 0.47, -2.62); add('metal', exhaust);

  // Suspension
  const susp = [
    [[0.2, 0.6, 2.05], [0.7, 0.52, 1.86]], [[0.2, 0.58, 1.5], [0.7, 0.52, 1.86]],
    [[0.18, 0.36, 2.12], [0.72, 0.24, 1.86]], [[0.18, 0.34, 1.45], [0.72, 0.24, 1.86]],
    [[0.7, 0.26, 1.82], [0.22, 0.64, 1.7]], [[0.2, 0.46, 2.1], [0.7, 0.4, 1.98]],
    [[0.26, 0.55, -1.5], [0.66, 0.56, -1.75]], [[0.22, 0.52, -2.05], [0.66, 0.56, -1.75]],
    [[0.26, 0.26, -1.45], [0.68, 0.22, -1.75]], [[0.22, 0.26, -2.05], [0.68, 0.22, -1.75]],
    [[0.66, 0.54, -1.7], [0.24, 0.3, -1.85]],
  ];
  for (const [a, b] of susp) both('carbon', rod(a, b, 0.017));
  // brake ducts / uprights
  for (const z of [1.86, -1.75]) { const g = new THREE.BoxGeometry(0.08, 0.3, 0.26); g.translate(0.64, 0.38, z); both('black', g); }

  const car = new THREE.Group();
  const body = new THREE.Group();
  for (const [key, list] of Object.entries(parts)) {
    const mesh = new THREE.Mesh(merge(list), M[key]);
    mesh.castShadow = shadows; mesh.receiveShadow = true;
    body.add(mesh);
  }
  car.add(body);

  // Number boards
  const numTex = tex.label(String(team.number), null, '#ffffff', 256, 128, '900 96px system-ui, Helvetica, Arial');
  const numMat = new THREE.MeshBasicMaterial({ map: numTex, transparent: true, depthWrite: false, toneMapped: false });
  const nose = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.14), numMat);
  nose.rotation.x = -Math.PI / 2 + 0.2; nose.rotation.z = Math.PI; nose.position.set(0, 0.512, 2.12); car.add(nose);
  for (const s of [-1, 1]) {
    const fin = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.18), numMat);
    fin.rotation.y = s * Math.PI / 2; fin.position.set(s * 0.008, 0.76, -1.55); car.add(fin);
  }

  // DRS flap (pivot at its leading edge)
  const flapPivot = new THREE.Group(); flapPivot.position.set(0, 1.0, -2.6);
  const flap = new THREE.Mesh(wing(spanStations(-0.5, 0.5, 16, () => ({ y: 0, z: 0, chord: 0.2, angle: 0 })), { thick: 0.1, camber: 0.08 }), M.livery);
  flap.castShadow = shadows; flapPivot.add(flap); flapPivot.rotation.x = 0.75; car.add(flapPivot);

  // Rain light
  const rain = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.06, 0.03), M.rain); rain.position.set(0, 0.36, -2.68); car.add(rain);

  // Wheels
  const wheels = [];
  const makeWheel = (front) => {
    const R = 0.36, rimR = 0.23, W = front ? 0.3 : 0.4, r = 0.045;
    const prof = [];
    prof.push(new THREE.Vector2(rimR, -W / 2));
    for (let i = 0; i <= 6; i++) { const a = -Math.PI / 2 + (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(R - r + Math.cos(a) * r, -W / 2 + r + Math.sin(a) * r)); }
    for (let i = 0; i <= 6; i++) { const a = (i / 6) * (Math.PI / 2); prof.push(new THREE.Vector2(R - r + Math.cos(a) * r, W / 2 - r + Math.sin(a) * r)); }
    prof.push(new THREE.Vector2(rimR, W / 2));
    const tyreG = new THREE.LatheGeometry(prof, 40); tyreG.rotateZ(Math.PI / 2);
    const spin = new THREE.Group();
    const tyre = new THREE.Mesh(tyreG, M.tyre); tyre.castShadow = shadows; spin.add(tyre);
    const sideMat = sidewallMaterial(compound);
    const sides = [];
    for (const s of [-1, 1]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(rimR, R - 0.012, 40), sideMat);
      ring.rotation.y = s * Math.PI / 2; ring.position.x = s * (W / 2 + 0.002); spin.add(ring); sides.push(ring);
      const cover = new THREE.Mesh(new THREE.CircleGeometry(rimR, 32), M.rim);
      cover.rotation.y = s * Math.PI / 2; cover.position.x = s * (W / 2 - 0.03); spin.add(cover);
      const stripe = new THREE.Mesh(new THREE.RingGeometry(rimR * 0.55, rimR * 0.68, 32, 1, 0, Math.PI * 1.2), M.accent);
      stripe.rotation.y = s * Math.PI / 2; stripe.position.x = s * (W / 2 - 0.028); spin.add(stripe);
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.05, 12), M.metal);
      nut.rotation.z = Math.PI / 2; nut.position.x = s * (W / 2 - 0.02); spin.add(nut);
    }
    return { spin, sides };
  };
  const pos = [[0.8, 1.86, true], [-0.8, 1.86, true], [0.78, -1.75, false], [-0.78, -1.75, false]];
  for (const [x, z, front] of pos) {
    const steer = new THREE.Group(); steer.position.set(x, 0.36, z);
    const { spin, sides } = makeWheel(front);
    steer.add(spin);
    if (front) { // wheel-wake winglet that turns with the wheel
      const wl = new THREE.Mesh(wing(spanStations(-0.15, 0.15, 6, () => ({ y: 0.4, z: 0.12, chord: 0.2, angle: 0.15 })), { thick: 0.1, camber: 0.08 }), M.carbon);
      wl.castShadow = shadows; steer.add(wl);
    }
    car.add(steer);
    wheels.push({ steer, spin, sides, front, side: Math.sign(x) });
  }

  car.userData = { wheels, flapPivot, rain, team, compound, body };
  return car;
}

export function setTyreCompound(car, compound) {
  car.userData.compound = compound;
  for (const w of car.userData.wheels) for (const r of w.sides) r.material = sidewallMaterial(compound);
}

// Animate wheels, steering, DRS and rain light.
export function animateCar(car, { speed = 0, steer = 0, dt = 0, drs = false, rainOn = false, time = 0 }) {
  const u = car.userData;
  for (const w of u.wheels) {
    w.spin.rotation.x += (speed / 0.36) * dt;
    if (w.front) w.steer.rotation.y = steer;
  }
  const target = drs ? 0.12 : 0.75;
  u.flapPivot.rotation.x += (target - u.flapPivot.rotation.x) * Math.min(1, dt * 10);
  u.rain.material.emissiveIntensity = rainOn ? (Math.sin(time * 18) > 0 ? 6 : 0.3) : 0.25;
}
