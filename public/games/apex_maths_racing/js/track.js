// Track: turns a real circuit centreline into samples, queries and road geometry.
import * as THREE from 'three';
import { CIRCUIT_DATA } from './circuitData.js';
import { tex } from './textures.js';

export const CIRCUITS = [
  {
    id: 'silverstone', name: 'Silverstone', country: 'GREAT BRITAIN', flag: '🇬🇧', halfWidth: 7.5, runoff: 20,
    desc: 'High-speed Maggotts–Becketts, the Hangar Straight and Club. 5.891 km.',
    runoffStyle: 'tarmac', sky: { elevation: 32, azimuth: 200, turbidity: 6 }, length: '5.891 km', turns: 18,
  },
  {
    id: 'monaco', name: 'Monaco', country: 'MONACO', flag: '🇲🇨', halfWidth: 5.4, runoff: 0,
    desc: 'Barriers everywhere: Casino, the Grand Hotel hairpin, the tunnel and the Swimming Pool. 3.337 km.',
    runoffStyle: 'none', sky: { elevation: 40, azimuth: 160, turbidity: 3 }, length: '3.337 km', turns: 19,
  },
  {
    id: 'monza', name: 'Monza', country: 'ITALY', flag: '🇮🇹', halfWidth: 7, runoff: 18,
    desc: 'The Temple of Speed: huge straights, chicanes, the Lesmos and the Parabolica. 5.793 km.',
    runoffStyle: 'gravel', sky: { elevation: 28, azimuth: 230, turbidity: 8 }, length: '5.793 km', turns: 11,
  },
];

const DS = 2; // sample spacing in metres

export class Track {
  constructor(def) {
    this.def = def;
    const data = CIRCUIT_DATA[def.id];
    this.data = data;
    this.halfW = def.halfWidth;
    const curve = new THREE.CatmullRomCurve3(data.points.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
    const len = curve.getLength();
    const n = Math.round(len / DS);
    let pts = curve.getSpacedPoints(n).slice(0, n);
    // light smoothing to remove GPS jitter
    for (let pass = 0; pass < 3; pass++) {
      pts = pts.map((p, i) => {
        const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n];
        return new THREE.Vector3((a.x + 2 * p.x + b.x) / 4, 0, (a.z + 2 * p.z + b.z) / 4);
      });
    }
    // rotate so index 0 is the start/finish line
    const shift = ((Math.round(data.startS / DS) % n) + n) % n;
    pts = pts.slice(shift).concat(pts.slice(0, shift));
    this.n = n;
    this.x = new Float32Array(n); this.z = new Float32Array(n);
    pts.forEach((p, i) => { this.x[i] = p.x; this.z[i] = p.z; });
    let L = 0;
    for (let i = 0; i < n; i++) { const j = (i + 1) % n; L += Math.hypot(this.x[j] - this.x[i], this.z[j] - this.z[i]); }
    this.length = L;
    this.ds = L / n;
    this.tx = new Float32Array(n); this.tz = new Float32Array(n); this.k = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const a = (i - 1 + n) % n, b = (i + 1) % n;
      const dx = this.x[b] - this.x[a], dz = this.z[b] - this.z[a], d = Math.hypot(dx, dz);
      this.tx[i] = dx / d; this.tz[i] = dz / d;
    }
    for (let i = 0; i < n; i++) {
      const a = (i - 3 + n) % n, b = (i + 3) % n;
      // curvature: + means turning right (right vector = (-tz, tx))
      const dtx = this.tx[b] - this.tx[a], dtz = this.tz[b] - this.tz[a];
      this.k[i] = (dtx * -this.tz[i] + dtz * this.tx[i]) / (6 * this.ds);
    }
    this.buildGrid();
    this.computeClearance();
    this.computeCornerZones();
    this.setupPit();
    this.computeRacingLine();
    this.computeSpeedProfile();
  }

  wrapIndex(i) { return ((i % this.n) + this.n) % this.n; }
  wrapS(s) { return ((s % this.length) + this.length) % this.length; }
  idx(s) { return this.wrapIndex(Math.round(this.wrapS(s) / this.ds)); }

  // Point at distance s along the lap, offset lat metres to the right.
  point(s, lat = 0, out = new THREE.Vector3()) {
    const f = this.wrapS(s) / this.ds, i0 = Math.floor(f) % this.n, i1 = (i0 + 1) % this.n, t = f - Math.floor(f);
    const x = this.x[i0] + (this.x[i1] - this.x[i0]) * t, z = this.z[i0] + (this.z[i1] - this.z[i0]) * t;
    const tx = this.tx[i0] + (this.tx[i1] - this.tx[i0]) * t, tz = this.tz[i0] + (this.tz[i1] - this.tz[i0]) * t;
    const d = Math.hypot(tx, tz);
    return out.set(x - (tz / d) * lat, 0, z + (tx / d) * lat);
  }
  heading(s) { const i = this.idx(s); return Math.atan2(this.tx[i], this.tz[i]); }

  // Spatial hash for nearest-centreline queries.
  buildGrid() {
    this.cell = 40; this.grid = new Map();
    for (let i = 0; i < this.n; i++) {
      const key = Math.floor(this.x[i] / this.cell) + ',' + Math.floor(this.z[i] / this.cell);
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(i);
    }
  }
  // Distance from (x,z) to the nearest centreline sample, optionally ignoring samples near index `skip`.
  nearestDist(x, z, radius = 1, skip = -1, skipRange = 0) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    let best = Infinity, bi = -1;
    for (let a = -radius; a <= radius; a++) for (let b = -radius; b <= radius; b++) {
      const list = this.grid.get((cx + a) + ',' + (cz + b));
      if (!list) continue;
      for (const i of list) {
        if (skip >= 0) { let d = Math.abs(i - skip); d = Math.min(d, this.n - d); if (d < skipRange) continue; }
        const d2 = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
        if (d2 < best) { best = d2; bi = i; }
      }
    }
    return { dist: Math.sqrt(best), i: bi };
  }

  // Project a world position onto the track. hint = last known sample index.
  project(x, z, hint = -1) {
    let bi = -1, best = Infinity;
    if (hint >= 0) {
      for (let k = -50; k <= 50; k++) {
        const i = this.wrapIndex(hint + k), d2 = (this.x[i] - x) ** 2 + (this.z[i] - z) ** 2;
        if (d2 < best) { best = d2; bi = i; }
      }
    }
    if (bi < 0 || best > 60 * 60) { const r = this.nearestDist(x, z, 2); if (r.i >= 0) bi = r.i; else bi = 0; }
    // refine with segment projection
    const i = bi, tx = this.tx[i], tz = this.tz[i];
    const dx = x - this.x[i], dz = z - this.z[i];
    const along = dx * tx + dz * tz, lat = dx * -tz + dz * tx;
    return { i, s: this.wrapS(i * this.ds + along), lat };
  }

  // How far the barriers can sit from the centreline without hitting another part of the track.
  computeClearance() {
    const n = this.n, skipRange = Math.round(150 / this.ds);
    this.clear = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const r = this.nearestDist(this.x[i], this.z[i], 2, i, skipRange);
      this.clear[i] = Math.min(80, r.dist);
    }
    this.barrier = [new Float32Array(n), new Float32Array(n)]; // [left, right]
    const base = this.def.runoff > 0 ? this.halfW + this.def.runoff : this.halfW + 0.9;
    for (let i = 0; i < n; i++) {
      // corners get more run-off on the outside
      const extra = this.def.runoff > 0 ? Math.min(14, Math.abs(this.k[i]) * 900) : 0;
      const half = this.clear[i] / 2 - 1.5;
      const outsideRight = this.k[i] < 0; // turning left -> outside is right
      this.barrier[1][i] = Math.max(this.halfW + 0.9, Math.min(base + (outsideRight ? extra : 0), half));
      this.barrier[0][i] = Math.max(this.halfW + 0.9, Math.min(base + (!outsideRight ? extra : 0), half));
    }
    for (const side of this.barrier) { // smooth barrier lines
      for (let p = 0; p < 6; p++) {
        const c = side.slice();
        for (let i = 0; i < n; i++) side[i] = Math.min(c[i], (c[this.wrapIndex(i - 1)] + c[i] * 2 + c[this.wrapIndex(i + 1)]) / 4);
      }
    }
  }

  computeCornerZones() {
    const n = this.n, w = Math.round(20 / this.ds);
    this.cornerness = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let m = 0;
      for (let k = -w; k <= w; k++) m = Math.max(m, Math.abs(this.k[this.wrapIndex(i + k)]));
      this.cornerness[i] = m;
    }
  }

  setupPit() {
    const p = this.data.pit, hw = this.halfW;
    this.pit = {
      from: p.from, to: p.to, side: p.side, ramp: 90,
      laneLat: hw + 13, laneHalf: 5, boxLat: hw + 15, wallLat: hw + 4.5, garageLat: hw + 19,
      speedLimit: 80 / 3.6,
    };
    const P = this.pit;
    P.fullFrom = P.from + P.ramp; P.fullTo = P.to - P.ramp;
    // 6 garages spaced along the full-width section
    const mid = (P.fullFrom + P.fullTo) / 2;
    this.boxS = [];
    for (let k = 0; k < 6; k++) this.boxS.push(mid + (k - 2.5) * 22);
    // pit lane widens the right-hand barrier
    const side = P.side > 0 ? 1 : 0;
    for (let i = 0; i < this.n; i++) {
      const off = this.pitOffset(i * this.ds);
      if (off > 0) this.barrier[side][i] = Math.max(this.barrier[side][i], off + P.laneHalf + 1.5);
    }
  }
  // signed s relative to the start line, in (-L/2, L/2]
  rel(s) { let r = this.wrapS(s); if (r > this.length / 2) r -= this.length; return r; }
  // Lateral offset of the pit lane centre at s (0 outside the pit area).
  pitOffset(s) {
    const P = this.pit, r = this.rel(s);
    if (r < P.from || r > P.to) return 0;
    let t = 1;
    if (r < P.fullFrom) t = (r - P.from) / P.ramp; else if (r > P.fullTo) t = (P.to - r) / P.ramp;
    t = t * t * (3 - 2 * t);
    return t * P.laneLat;
  }
  inPitZone(s, lat) {
    const off = this.pitOffset(s);
    return off > this.halfW + 1.5 && lat * this.pit.side > this.halfW + 1;
  }
  pitWallActive(s) { const r = this.rel(s); return r > this.pit.fullFrom - 30 && r < this.pit.fullTo + 30; }

  // Minimum-curvature style racing line by iterative relaxation.
  computeRacingLine() {
    const n = this.n, lim = this.halfW - 1.6;
    const a = new Float32Array(n);
    const px = new Float32Array(n), pz = new Float32Array(n);
    const K = Math.max(3, Math.round(14 / this.ds));
    for (let it = 0; it < 220; it++) {
      for (let i = 0; i < n; i++) { px[i] = this.x[i] - this.tz[i] * a[i]; pz[i] = this.z[i] + this.tx[i] * a[i]; }
      for (let i = 0; i < n; i++) {
        const i0 = this.wrapIndex(i - K), i1 = this.wrapIndex(i + K);
        const mx = (px[i0] + px[i1]) / 2, mz = (pz[i0] + pz[i1]) / 2;
        const target = (mx - this.x[i]) * -this.tz[i] + (mz - this.z[i]) * this.tx[i];
        a[i] = Math.max(-lim, Math.min(lim, a[i] + (target - a[i]) * 0.6));
      }
    }
    for (let p = 0; p < 4; p++) { const c = a.slice(); for (let i = 0; i < n; i++) a[i] = (c[this.wrapIndex(i - 2)] + c[this.wrapIndex(i - 1)] + c[i] + c[this.wrapIndex(i + 1)] + c[this.wrapIndex(i + 2)]) / 5; }
    this.line = a;
    // curvature of the racing line
    this.lineK = new Float32Array(n);
    for (let i = 0; i < n; i++) { px[i] = this.x[i] - this.tz[i] * a[i]; pz[i] = this.z[i] + this.tx[i] * a[i]; }
    for (let i = 0; i < n; i++) {
      const i0 = this.wrapIndex(i - 4), i1 = this.wrapIndex(i + 4);
      const ax = px[i] - px[i0], az = pz[i] - pz[i0], bx = px[i1] - px[i], bz = pz[i1] - pz[i];
      const cross = ax * bz - az * bx, la = Math.hypot(ax, az), lb = Math.hypot(bx, bz), lc = Math.hypot(px[i1] - px[i0], pz[i1] - pz[i0]);
      this.lineK[i] = 2 * cross / (la * lb * lc + 1e-6);
    }
  }
  lineAt(s) { const f = this.wrapS(s) / this.ds, i = Math.floor(f) % this.n, t = f - Math.floor(f); return this.line[i] + (this.line[(i + 1) % this.n] - this.line[i]) * t; }

  // Ideal speed for a car with a given grip level, along the racing line (m/s).
  speedProfile(grip = 1, vmax = 92, power = 1) {
    const n = this.n, v = new Float32Array(n), ds = this.ds;
    for (let i = 0; i < n; i++) {
      const R = 1 / Math.max(1e-4, Math.abs(this.lineK[i]));
      const a = 16 * grip, b = 0.0045 * grip;
      const den = 1 - b * R;
      v[i] = den <= 0 ? vmax : Math.min(vmax, Math.sqrt(a * R / den));
    }
    for (let pass = 0; pass < 2; pass++) {
      for (let k = 2 * n; k >= 0; k--) { // braking (backwards)
        const i = k % n, j = (i + 1) % n;
        const dec = (20 + 0.0035 * v[j] * v[j]) * Math.min(1.1, grip);
        v[i] = Math.min(v[i], Math.sqrt(v[j] * v[j] + 2 * dec * ds));
      }
      for (let k = 0; k <= 2 * n; k++) { // acceleration (forwards)
        const i = k % n, j = (i + 1) % n;
        const acc = engineAccel(v[i], vmax, power);
        v[j] = Math.min(v[j], Math.sqrt(v[i] * v[i] + 2 * acc * ds));
      }
    }
    return v;
  }
  computeSpeedProfile() { this.profile = this.speedProfile(1, 92); }
  profileAt(s, prof = this.profile) { return prof[this.idx(s)]; }

  // ---------- geometry ----------
  ribbon(latA, latB, y, { from = 0, to = this.n, vScale = 0.1, uFlip = false, latAFn = null, latBFn = null, step = 1 } = {}) {
    const pos = [], uv = [], idx = [];
    let row = 0;
    for (let k = from; k <= to; k += step) {
      const i = this.wrapIndex(k);
      const la = latAFn ? latAFn(i) : latA, lb = latBFn ? latBFn(i) : latB;
      const nx = -this.tz[i], nz = this.tx[i];
      pos.push(this.x[i] + nx * la, y, this.z[i] + nz * la, this.x[i] + nx * lb, y, this.z[i] + nz * lb);
      const v = k * this.ds * vScale;
      uv.push(uFlip ? 1 : 0, v, uFlip ? 0 : 1, v);
      if (row > 0) { const b = (row - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      row++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    // make every triangle face upwards so lighting works (wind consistently by checking the first one)
    if (idx.length >= 3) {
      const P = (k) => [pos[k * 3], pos[k * 3 + 1], pos[k * 3 + 2]];
      const [a, b, c] = [P(idx[0]), P(idx[1]), P(idx[2])];
      const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
      if (ny < 0) for (let k = 0; k < idx.length; k += 3) { const t = idx[k + 1]; idx[k + 1] = idx[k + 2]; idx[k + 2] = t; }
    }
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  // vertical wall following a lateral offset function
  wall(latFn, y0, y1, { from = 0, to = this.n, uScale = 0.25, step = 2 } = {}) {
    const pos = [], uv = [], idx = [];
    let row = 0, dist = 0, px = null, pz = null;
    for (let k = from; k <= to; k += step) {
      const i = this.wrapIndex(k), lat = latFn(i);
      const x = this.x[i] - this.tz[i] * lat, z = this.z[i] + this.tx[i] * lat;
      if (px !== null) dist += Math.hypot(x - px, z - pz);
      px = x; pz = z;
      pos.push(x, y0, z, x, y1, z);
      uv.push(dist * uScale, 0, dist * uScale, 1);
      if (row > 0) { const b = (row - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      row++;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  // spans of sample indices where predicate holds
  spans(pred, minLen = 6) {
    const out = []; let start = -1;
    // begin from a sample where pred is false so spans don't wrap
    let s0 = 0; while (s0 < this.n && pred(s0)) s0++;
    if (s0 >= this.n) return [[0, this.n]];
    for (let k = 0; k <= this.n; k++) {
      const i = (s0 + k) % this.n, on = k < this.n && pred(i);
      if (on && start < 0) start = s0 + k;
      if (!on && start >= 0) { if (s0 + k - start >= minLen) out.push([start, s0 + k]); start = -1; }
    }
    return out;
  }

  buildRoad(group, opts) {
    const { night, showLine } = opts;
    const hw = this.halfW;
    const mats = [];
    const std = (o) => { const m = new THREE.MeshStandardMaterial({ side: THREE.DoubleSide, ...o }); mats.push(m); return m; };
    const asphalt = tex.asphalt().clone(); asphalt.needsUpdate = true; asphalt.repeat.set(1, 1);
    const road = new THREE.Mesh(this.ribbon(-hw, hw, 0.03, { vScale: 1 / 14 }), std({ map: asphalt, roughness: 0.93, metalness: 0 }));
    road.receiveShadow = true; group.add(road);

    // white edge lines
    const white = std({ color: 0xf0efe9, roughness: 0.7 });
    for (const sgn of [-1, 1]) {
      const m = new THREE.Mesh(this.ribbon(sgn * (hw - 0.45), sgn * (hw - 0.1), 0.045), white); m.receiveShadow = true; group.add(m);
    }

    // kerbs in corners
    const kerbTex = tex.kerb();
    const kerbMat = std({ map: kerbTex, roughness: 0.6 });
    const corner = (i) => this.cornerness[i] > 1 / 260;
    for (const [a, b] of this.spans(corner, 8)) {
      for (const sgn of [-1, 1]) {
        const g = this.ribbon(sgn * (hw - 0.15), sgn * (hw + 1.25), 0.06, { from: a, to: b, vScale: 1 / 6 });
        // slope the kerb a little
        const p = g.attributes.position;
        for (let v = 0; v < p.count; v++) if (v % 2 === (sgn > 0 ? 1 : 0)) p.setY(v, 0.035);
        const m = new THREE.Mesh(g, kerbMat); m.receiveShadow = true; group.add(m);
      }
    }

    // run-off areas
    if (this.def.runoffStyle !== 'none') {
      const runTex = this.def.runoffStyle === 'gravel' ? tex.gravel() : tex.runoff();
      const runMat = std({ map: runTex, roughness: 1, color: this.def.runoffStyle === 'gravel' ? 0xffffff : 0xb9c4cf });
      for (const sgn of [-1, 1]) {
        const side = sgn > 0 ? 1 : 0;
        const pred = (i) => this.cornerness[i] > 1 / 200 && (sgn > 0 ? this.k[i] < 0 : this.k[i] > 0) && this.pitOffset(i * this.ds) === 0;
        for (const [a, b] of this.spans(pred, 10)) {
          const g = this.ribbon(0, 0, 0.022, {
            from: a - 6, to: b + 10, vScale: 1 / 8,
            latAFn: () => sgn * (hw + 1.2), latBFn: (i) => sgn * Math.max(hw + 2, this.barrier[side][i] - 1),
          });
          const m = new THREE.Mesh(g, runMat); m.receiveShadow = true; group.add(m);
        }
      }
    }

    // barriers: armco / tyre wall on both sides
    const armco = tex.armco();
    const armMat = std({ map: armco, roughness: 0.45, metalness: 0.6, side: THREE.DoubleSide });
    const fenceMat = std({ map: tex.fence(), transparent: true, alphaTest: 0.3, side: THREE.DoubleSide, roughness: 0.6, metalness: 0.4 });
    for (const side of [0, 1]) {
      const sgn = side ? 1 : -1;
      const latFn = (i) => sgn * this.barrier[side][i];
      const g = this.wall(latFn, 0, 0.9, { uScale: 0.25 });
      const w = new THREE.Mesh(g, armMat); w.castShadow = true; w.receiveShadow = true; group.add(w);
      const fg = this.wall((i) => sgn * (this.barrier[side][i] + 0.3), 0.9, 4.2, { uScale: 0.25, step: 3 });
      fg.attributes.uv.array.forEach((v, k, arr) => { if (k % 2 === 1) arr[k] = v * 3; });
      const f = new THREE.Mesh(fg, fenceMat); group.add(f);
    }

    // start/finish line and grid boxes
    const chequer = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 1.6), std({ map: tex.chequer(), roughness: 0.7 }));
    chequer.rotation.x = -Math.PI / 2; chequer.rotation.z = this.heading(0);
    chequer.position.copy(this.point(0)); chequer.position.y = 0.05; group.add(chequer);
    for (let g = 0; g < 6; g++) {
      const { s, lat } = this.gridSlot(g);
      const p = this.point(s, lat);
      const box = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.25), white);
      box.rotation.x = -Math.PI / 2; box.rotation.z = this.heading(s);
      box.position.set(p.x, 0.05, p.z);
      const p2 = this.point(s + 2.6, lat);
      box.position.set(p2.x, 0.05, p2.z);
      group.add(box);
    }

    // pit lane surface, lines, wall and boxes
    this.buildPit(group, std, white);

    // racing line guide (coloured by braking)
    if (showLine) {
      const pos = [], col = [], idx = [];
      const c = new THREE.Color();
      for (let i = 0; i <= this.n; i++) {
        const k = i % this.n, a = this.line[k];
        const nx = -this.tz[k], nz = this.tx[k];
        for (const d of [-0.35, 0.35]) pos.push(this.x[k] + nx * (a + d), 0.05, this.z[k] + nz * (a + d));
        const ahead = this.profile[(k + 3) % this.n], now = this.profile[k];
        if (ahead < now - 0.4) c.setRGB(0.95, 0.12, 0.1); else if (now < 60) c.setRGB(0.98, 0.78, 0.1); else c.setRGB(0.15, 0.85, 0.3);
        col.push(c.r, c.g, c.b, c.r, c.g, c.b);
        if (i > 0) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }));
      m.renderOrder = 2; group.add(m);
    }
    return mats;
  }

  gridSlot(pos) { // pos 0 = pole
    return { s: this.length - 12 - pos * 8, lat: (pos % 2 ? 1 : -1) * this.halfW * 0.42 };
  }

  buildPit(group, std, white) {
    const P = this.pit, sg = P.side;
    const i0 = Math.floor((P.from) / this.ds), i1 = Math.ceil((P.to) / this.ds);
    // pit lane asphalt (from track edge to lane outer edge)
    const lane = this.ribbon(0, 0, 0.028, {
      from: i0, to: i1, vScale: 1 / 14,
      latAFn: (i) => sg * Math.min(this.halfW, this.pitOffset(i * this.ds) - P.laneHalf),
      latBFn: (i) => sg * Math.max(this.halfW, this.pitOffset(i * this.ds) + P.laneHalf),
    });
    const laneMat = std({ map: tex.asphalt(), roughness: 0.9, color: 0xa9adb3 });
    const m = new THREE.Mesh(lane, laneMat); m.receiveShadow = true; group.add(m);
    // lane lines
    for (const off of [-P.laneHalf, -0.6]) {
      const g = this.ribbon(0, 0, 0.05, {
        from: i0 + 25, to: i1 - 25,
        latAFn: (i) => sg * (this.pitOffset(i * this.ds) + off - 0.12), latBFn: (i) => sg * (this.pitOffset(i * this.ds) + off + 0.12),
      });
      group.add(new THREE.Mesh(g, white));
    }
    // pit wall (concrete) between track and pit lane
    const f0 = Math.floor((P.fullFrom - 30) / this.ds), f1 = Math.ceil((P.fullTo + 30) / this.ds);
    const concrete = std({ color: 0xd8d8d2, roughness: 0.85 });
    for (const off of [P.wallLat - 0.4, P.wallLat + 0.4]) {
      const w = new THREE.Mesh(this.wall(() => sg * off, 0, 1.1, { from: f0, to: f1, step: 1 }), concrete);
      w.castShadow = true; w.receiveShadow = true; group.add(w);
    }
    group.add(new THREE.Mesh(this.ribbon(sg * (P.wallLat - 0.4), sg * (P.wallLat + 0.4), 1.1, { from: f0, to: f1 }), concrete));
    // speed limit lines
    for (const r of [P.from + 40, P.to - 40]) {
      const p = this.point(r, sg * this.pitOffset(r));
      const line = new THREE.Mesh(new THREE.PlaneGeometry(P.laneHalf * 2, 0.5), white);
      line.rotation.x = -Math.PI / 2; line.rotation.z = this.heading(r);
      line.position.set(p.x, 0.06, p.z); group.add(line);
    }
  }
}

// Engine acceleration (m/s^2) for an F1 car with the given top speed.
export function engineAccel(v, vmax = 92, power = 1) {
  const kd = 0.0013;
  const P = kd * vmax * vmax * vmax * power;
  return Math.min(11.5 * Math.min(1.25, power), P / Math.max(v, 6)) - kd * v * v - 0.15;
}
