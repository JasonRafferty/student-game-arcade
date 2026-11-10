// Circuit surroundings: sky, ground, trees, buildings, harbour, tunnel, grandstands,
// advertising boards, pit garages with crews, start-light gantry and night lighting.
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { tex } from './textures.js';

function rng(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
function insidePoly(x, z, poly) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i], [xj, zj] = poly[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}
const dummy = new THREE.Object3D();

// Geometry builder for many boxes with world-scaled UVs (for windows) and vertex colours.
class BoxBatch {
  constructor() { this.pos = []; this.uv = []; this.col = []; this.nrm = []; }
  add(cx, cz, w, d, h, yaw, colour, y0 = 0, tileW = 12, tileH = 24, top = false) {
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const P = (lx, y, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
    const hw = w / 2, hd = d / 2;
    const faces = [ // [corner a, corner b, length, outward normal local]
      [[-hw, -hd], [hw, -hd], w, [0, -1]], [[hw, -hd], [hw, hd], d, [1, 0]],
      [[hw, hd], [-hw, hd], w, [0, 1]], [[-hw, hd], [-hw, -hd], d, [-1, 0]],
    ];
    for (const [a, b, len, n] of faces) {
      const p1 = P(a[0], y0, a[1]), p2 = P(b[0], y0, b[1]), p3 = P(b[0], y0 + h, b[1]), p4 = P(a[0], y0 + h, a[1]);
      const nx = n[0] * c + n[1] * s, nz = -n[0] * s + n[1] * c;
      const u1 = len / tileW, v1 = h / tileH;
      for (const [p, u, v] of [[p1, 0, 0], [p2, u1, 0], [p3, u1, v1], [p1, 0, 0], [p3, u1, v1], [p4, 0, v1]]) {
        this.pos.push(...p); this.uv.push(u, v); this.col.push(colour.r, colour.g, colour.b); this.nrm.push(nx, 0, nz);
      }
    }
    if (top) {
      const y = y0 + h, q = [P(-hw, y, -hd), P(hw, y, -hd), P(hw, y, hd), P(-hw, y, hd)];
      for (const k of [0, 2, 1, 0, 3, 2]) { this.pos.push(...q[k]); this.uv.push(0, 0); this.col.push(colour.r, colour.g, colour.b); this.nrm.push(0, 1, 0); }
    }
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    return g;
  }
}

export function setupSky(scene, renderer, def, night) {
  const sky = new Sky(); sky.scale.setScalar(9000);
  const u = sky.material.uniforms;
  u.turbidity.value = def.sky.turbidity * 0.6; u.rayleigh.value = 2.2;
  u.mieCoefficient.value = 0.004; u.mieDirectionalG.value = 0.8;
  const elev = night ? 25 : def.sky.elevation;
  const sunDir = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - elev), THREE.MathUtils.degToRad(def.sky.azimuth));
  u.sunPosition.value.copy(sunDir);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  if (night) {
    envScene.background = new THREE.Color(0x0a1020);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(10, 16, 8), new THREE.MeshBasicMaterial({ color: 0x8090b0 }));
    glow.position.set(0, 60, 0); glow.scale.set(8, 1, 8); envScene.add(glow);
  } else envScene.add(sky);
  scene.environment = pmrem.fromScene(envScene, 0.02).texture;
  pmrem.dispose();
  if (night) {
    scene.background = new THREE.Color(0x060a14);
    const starG = new THREE.BufferGeometry(), pts = [], r = rng(5);
    for (let i = 0; i < 1500; i++) { const v = new THREE.Vector3().setFromSphericalCoords(7000, r() * 1.35, r() * Math.PI * 2); pts.push(v.x, v.y, v.z); }
    starG.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    scene.add(new THREE.Points(starG, new THREE.PointsMaterial({ color: 0xffffff, size: 2, sizeAttenuation: false, fog: false })));
    scene.fog = new THREE.Fog(0x0a1020, 250, 2600);
  } else {
    scene.add(sky);
    scene.fog = new THREE.Fog(0xa9c4e0, 1100, 6000);
  }
  return sunDir;
}

export function buildScenery(track, scene, { night = false, quality = 'high', boxTeams = [], playerBox = 0 }) {
  const def = track.def, r = rng(def.id.length * 977 + 13);
  const isMonaco = def.id === 'monaco';
  const hw = track.halfW;
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < track.n; i++) { minX = Math.min(minX, track.x[i]); maxX = Math.max(maxX, track.x[i]); minZ = Math.min(minZ, track.z[i]); maxZ = Math.max(maxZ, track.z[i]); }
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  const occupied = []; // circles kept clear of trees / buildings
  const isFree = (x, z, rad) => occupied.every((o) => (o.x - x) ** 2 + (o.z - z) ** 2 > (o.r + rad) ** 2);
  const out = { startLights: [], crews: [], boxMarker: null, update: () => {} };

  // ---------- ground ----------
  if (isMonaco) {
    const W = 3200, seg = 260;
    const g = new THREE.PlaneGeometry(W, W, seg, seg); g.rotateX(-Math.PI / 2); g.translate(cx, 0, cz);
    const p = g.attributes.position;
    for (let v = 0; v < p.count; v++) {
      const x = p.getX(v), z = p.getZ(v);
      if (insidePoly(x, z, track.data.sea) && track.nearestDist(x, z, 1).dist > 24) p.setY(v, -5);
    }
    g.computeVertexNormals();
    const t = tex.paving().clone(); t.needsUpdate = true; t.repeat.set(W / 10, W / 10);
    const ground = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 , polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 }));
    ground.receiveShadow = true; scene.add(ground);
    const wt = tex.water().clone(); wt.needsUpdate = true; wt.repeat.set(200, 200);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.MeshStandardMaterial({ map: wt, color: 0x5d9cbf, roughness: 0.08, metalness: 0.35 }));
    sea.rotation.x = -Math.PI / 2; sea.position.set(cx, -0.8, cz); scene.add(sea);
    out.update = (dt) => { wt.offset.x += dt * 0.004; wt.offset.y += dt * 0.002; };
  } else {
    const t = (def.id === 'silverstone' ? tex.grass() : tex.grass()).clone(); t.needsUpdate = true; t.repeat.set(8000 / 32, 8000 / 32);
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(8000, 8000), new THREE.MeshStandardMaterial({ map: t, roughness: 1, color: def.id === 'monza' ? 0xd8e6c8 : 0xffffff , polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 }));
    ground.rotation.x = -Math.PI / 2; ground.position.set(cx, 0, cz); ground.receiveShadow = true; scene.add(ground);
    if (def.id === 'silverstone') { // farm fields beyond the circuit
      const ft = tex.field().clone(); ft.needsUpdate = true; ft.repeat.set(6, 6);
      const fieldMat = new THREE.MeshStandardMaterial({ map: ft, roughness: 1 , polygonOffset: true, polygonOffsetFactor: 4, polygonOffsetUnits: 8 });
      for (let k = 0; k < 14; k++) {
        const a = (k / 14) * Math.PI * 2, d = Math.max(maxX - minX, maxZ - minZ) * (0.75 + r() * 0.3);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(500 + r() * 300, 400 + r() * 300), fieldMat);
        f.rotation.x = -Math.PI / 2; f.rotation.z = r() * 3; f.position.set(cx + Math.cos(a) * d, 0.01, cz + Math.sin(a) * d);
        f.receiveShadow = true; scene.add(f);
      }
    }
  }

  // distant hills / mountains
  {
    const hillMat = new THREE.MeshStandardMaterial({ color: isMonaco ? 0x6c7a5c : 0x5f7a52, roughness: 1, flatShading: true });
    const g = new THREE.IcosahedronGeometry(1, 2);
    const count = 36, inst = new THREE.InstancedMesh(g, hillMat, count);
    for (let k = 0; k < count; k++) {
      let a = (k / count) * Math.PI * 2, d = 3200 + r() * 900, h = 120 + r() * 240, w = 500 + r() * 500;
      if (isMonaco) { a = Math.PI * (1.05 + 0.9 * (k / count)); d = 1500 + r() * 900; h = 350 + r() * 450; w = 600 + r() * 400; }
      dummy.position.set(cx + Math.cos(a) * d, -h * 0.25, cz + Math.sin(a) * d); dummy.scale.set(w, h, w * 0.8); dummy.rotation.set(0, r() * 3, 0);
      dummy.updateMatrix(); inst.setMatrixAt(k, dummy.matrix);
    }
    scene.add(inst);
  }

  // ---------- pit garages, box markings and crews ----------
  const P = track.pit, sg = P.side;
  const frameAt = (s, lat) => { const p = track.point(s, lat); const h = track.heading(s); return { p, h }; };
  {
    const shellMat = new THREE.MeshStandardMaterial({ color: 0xe9ecef, roughness: 0.6, metalness: 0.1 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x223040, roughness: 0.1, metalness: 0.8, emissive: night ? 0x334455 : 0x000000 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xbfc5cc, roughness: 0.5, metalness: 0.4 });
    const units = boxTeams.length + 6;
    for (let k = 0; k < units; k++) {
      const s = track.boxS[0] + (k - 3) * 22;
      const { p, h } = frameAt(s, sg * (P.garageLat + 9));
      const g = new THREE.Group(); g.position.copy(p); g.rotation.y = h; scene.add(g);
      // local: +z along track, +x is left of travel; garage depth extends away from the pit lane
      const toLane = sg; // local x direction pointing toward the pit lane
      const shell = new THREE.Mesh(new THREE.BoxGeometry(18, 9, 21.6), shellMat); shell.position.y = 4.5; shell.castShadow = true; shell.receiveShadow = true; g.add(shell);
      const roof = new THREE.Mesh(new THREE.BoxGeometry(24, 0.6, 22), roofMat); roof.position.set(toLane * 3, 9.3, 0); roof.castShadow = true; g.add(roof);
      const glass = new THREE.Mesh(new THREE.PlaneGeometry(21, 2.4), glassMat); glass.rotation.y = toLane * Math.PI / 2; glass.position.set(toLane * 9.02, 7.2, 0); g.add(glass);
      const teamIdx = k - 3;
      const team = boxTeams[teamIdx];
      if (team) {
        const door = new THREE.Mesh(new THREE.PlaneGeometry(17, 5.6), new THREE.MeshStandardMaterial({ map: garageTexture(team), emissive: 0xffffff, emissiveMap: garageTexture(team), emissiveIntensity: night ? 0.7 : 0.25 }));
        door.rotation.y = toLane * Math.PI / 2; door.position.set(toLane * 9.02, 2.8, 0); g.add(door);
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), new THREE.MeshBasicMaterial({ map: tex.label(team.name.toUpperCase(), team.livery.base, '#ffffff', 1024, 128, '900 80px system-ui, Helvetica, Arial'), toneMapped: false }));
        sign.rotation.y = toLane * Math.PI / 2; sign.position.set(toLane * 9.03, 5.0, 0); g.add(sign);
      } else {
        const door = new THREE.Mesh(new THREE.PlaneGeometry(17, 5.6), new THREE.MeshStandardMaterial({ color: 0x5b636b, roughness: 0.6, metalness: 0.4 }));
        door.rotation.y = toLane * Math.PI / 2; door.position.set(toLane * 9.02, 2.8, 0); g.add(door);
      }
    }
    // box markings + crews
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    boxTeams.forEach((team, k) => {
      const s = track.boxS[k];
      const { p, h } = frameAt(s, sg * P.boxLat);
      const mark = new THREE.Group(); mark.position.set(p.x, 0.055, p.z); mark.rotation.y = h; scene.add(mark);
      const fill = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 6.4), new THREE.MeshBasicMaterial({ color: team.livery.base, transparent: true, opacity: 0.55, depthWrite: false }));
      fill.rotation.x = -Math.PI / 2; mark.add(fill);
      for (const [w, d, x, z] of [[3.4, 0.15, 0, 3.2], [3.4, 0.15, 0, -3.2], [0.15, 6.4, 1.65, 0], [0.15, 6.4, -1.65, 0]]) {
        const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d), lineMat); l.rotation.x = -Math.PI / 2; l.position.set(x, 0.002, z); mark.add(l);
      }
      if (k === playerBox) {
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 6.8), new THREE.MeshBasicMaterial({ color: 0x40ff90, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false }));
        glow.rotation.x = -Math.PI / 2; glow.position.y = 0.01; mark.add(glow);
        out.boxMarker = glow;
      }
      out.crews.push(makeCrew(scene, track, team, s, sg));
    });
  }

  // ---------- start-light gantry ----------
  {
    const s0 = 2;
    const { p, h } = frameAt(s0, 0);
    const g = new THREE.Group(); g.position.copy(p); g.rotation.y = h; scene.add(g);
    const steel = new THREE.MeshStandardMaterial({ color: 0x2a2f36, roughness: 0.5, metalness: 0.6 });
    for (const x of [-(hw + 1.5), hw + 1.5]) { const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 7.6, 0.6), steel); post.position.set(x, 3.8, 0); post.castShadow = true; g.add(post); }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(hw * 2 + 3.6, 0.9, 0.7), steel); beam.position.y = 7.2; beam.castShadow = true; g.add(beam);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(6.4, 1.5, 0.4), new THREE.MeshStandardMaterial({ color: 0x0c0d10 })); panel.position.set(0, 6.1, -0.2); g.add(panel);
    for (let c = 0; c < 5; c++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x220000, emissive: 0xff1a10, emissiveIntensity: 0, toneMapped: false });
      for (const y of [6.45, 5.8]) {
        const lamp = new THREE.Mesh(new THREE.CircleGeometry(0.24, 20), m);
        lamp.rotation.y = Math.PI; lamp.position.set((c - 2) * 1.2, y, -0.41); g.add(lamp);
      }
      out.startLights.push(m);
    }
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 0.8), new THREE.MeshBasicMaterial({ map: tex.label('APEX MATHS GRAND PRIX', '#e10600', '#ffffff', 1024, 96, '900 64px system-ui, Helvetica, Arial'), side: THREE.DoubleSide }));
    banner.position.set(0, 7.2, -0.36); banner.rotation.y = Math.PI; g.add(banner);
  }

  // ---------- grandstands ----------
  {
    const crowdTex = tex.crowd();
    const standMat = new THREE.MeshStandardMaterial({ map: crowdTex, roughness: 0.9 });
    const concrete = new THREE.MeshStandardMaterial({ color: 0xc9c9c3, roughness: 0.9 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4, metalness: 0.3 });
    const wanted = isMonaco ? 4 : 8, placed = [];
    // main straight grandstand opposite the pits
    const candidates = [{ s: track.boxS[2], side: -sg, len: 140 }];
    const order = [...Array(track.n).keys()].filter((i) => i % 15 === 0).sort((a, b) => track.cornerness[b] - track.cornerness[a]);
    for (const i of order) candidates.push({ s: i * track.ds, side: track.k[i] < 0 ? 1 : -1, len: 70 + r() * 50 });
    for (const c of candidates) {
      if (placed.length >= wanted) break;
      if (placed.some((q) => Math.abs(track.rel(q - c.s)) < 260)) continue;
      const i = track.idx(c.s), side = c.side > 0 ? 1 : 0;
      const lat = c.side * (track.barrier[side][i] + 4);
      const depth = 16;
      // check the footprint is clear of other track parts
      let ok = true;
      for (const t of [-0.5, -0.25, 0, 0.25, 0.5]) for (const dd of [0, depth]) {
        const q = track.point(c.s + t * c.len, lat + c.side * dd);
        const near = track.nearestDist(q.x, q.z, 2);
        if (near.dist < hw + 6) ok = false;
        if (isMonaco && insidePoly(q.x, q.z, track.data.sea)) ok = false;
      }
      if (!ok) continue;
      placed.push(c.s);
      const { p, h } = frameAt(c.s, lat + c.side * depth / 2);
      const g = new THREE.Group(); g.position.copy(p); g.rotation.y = h; scene.add(g);
      const away = -c.side; // local x pointing away from the track
      const rows = 14, H = 11;
      const slope = new THREE.PlaneGeometry(c.len, Math.hypot(depth, H));
      const ct = crowdTex.clone(); ct.needsUpdate = true; ct.repeat.set(c.len / 7, 4);
      const seats = new THREE.Mesh(slope, new THREE.MeshStandardMaterial({ map: ct, roughness: 0.9 }));
      seats.rotation.order = 'YXZ'; seats.rotation.y = -away * Math.PI / 2; seats.rotation.x = -Math.atan2(depth, H);
      seats.position.set(0, H / 2 + 1, 0); g.add(seats);
      const back = new THREE.Mesh(new THREE.BoxGeometry(1, H + 6, c.len), concrete); back.position.set(away * depth / 2, (H + 6) / 2, 0); back.castShadow = true; g.add(back);
      const front = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.2, c.len), concrete); front.position.set(-away * depth / 2, 0.6, 0); g.add(front);
      for (const zz of [-c.len / 2, c.len / 2]) {
        const sideWall = new THREE.Mesh(new THREE.BoxGeometry(depth, H + 1, 0.5), concrete); sideWall.position.set(0, (H + 1) / 2, zz); sideWall.castShadow = true; g.add(sideWall);
      }
      const roof = new THREE.Mesh(new THREE.BoxGeometry(depth + 4, 0.5, c.len + 2), roofMat); roof.position.set(-away * 2, H + 6.2, 0); roof.rotation.z = away * 0.08; roof.castShadow = true; g.add(roof);
      for (let zz = -c.len / 2 + 5; zz <= c.len / 2 - 5; zz += 15) { const col = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, H + 6, 8), concrete); col.position.set(away * depth / 2 - away * 0.6, (H + 6) / 2, zz); g.add(col); }
      occupied.push({ x: p.x, z: p.z, r: Math.max(c.len, depth) / 2 + 8 });
      void rows; void standMat;
    }
  }

  // ---------- advertising boards on the barriers ----------
  {
    const ads = [['APEX FUEL', '#e10600', '#fff'], ['FRACTION FORCE', '#111', '#ffd200'], ['TIMES TABLE TYRES', '#ffd200', '#111'], ['NUMBER CRUNCH', '#0b57d0', '#fff'], ['Y6 RACING CLUB', '#0a8f4a', '#fff'], ['DECIMAL DASH', '#fff', '#e10600']];
    const per = ads.map(() => []);
    for (const side of [0, 1]) {
      const sgn = side ? 1 : -1;
      for (let s = 10, k = side * 3; s < track.length; s += 46, k++) {
        const i = track.idx(s);
        if (track.pitOffset(s) > 0 && sgn === sg) continue;
        const b = track.barrier[side][i];
        if (b > hw + 40) continue;
        const p = track.point(s, sgn * (b - 0.06));
        const h = track.heading(s) + (sgn > 0 ? Math.PI / 2 : -Math.PI / 2);
        per[k % ads.length].push([p.x, p.z, h]);
      }
    }
    const g = new THREE.PlaneGeometry(9, 0.8); g.translate(0, 0.45, 0);
    ads.forEach(([text, bg, fg], k) => {
      if (!per[k].length) return;
      const inst = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ map: tex.billboard(text, bg, fg), roughness: 0.5, emissive: 0xffffff, emissiveMap: tex.billboard(text, bg, fg), emissiveIntensity: night ? 0.5 : 0.08 }), per[k].length);
      per[k].forEach(([x, z, h], j) => { dummy.position.set(x, 0, z); dummy.rotation.set(0, h, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); inst.setMatrixAt(j, dummy.matrix); });
      scene.add(inst);
    });
  }

  // ---------- Monaco: buildings, tunnel and yachts ----------
  if (isMonaco) {
    const walls = new BoxBatch(), roofs = new BoxBatch();
    const palette = ['#f6e7c8', '#f3d1b5', '#ecc9a2', '#fff4e0', '#f2dccb', '#e7b9a0', '#f7efe2', '#e9d6b0'].map((c) => new THREE.Color(c));
    const roofCol = new THREE.Color('#9a6b52');
    for (let gx = minX - 300; gx < maxX + 300; gx += 24) for (let gz = minZ - 300; gz < maxZ + 300; gz += 24) {
      const x = gx + (r() - 0.5) * 6, z = gz + (r() - 0.5) * 6;
      if (insidePoly(x, z, track.data.sea)) continue;
      const near = track.nearestDist(x, z, 2);
      if (near.dist < hw + 15 || near.dist > 340) continue;
      if (!isFree(x, z, 12)) continue;
      const tunnel = track.data.tunnel, si = near.i * track.ds;
      if (si > tunnel[0] - 20 && si < tunnel[1] + 20 && near.dist < 40) continue;
      const yaw = Math.atan2(track.tx[near.i], track.tz[near.i]);
      const w = 14 + r() * 7, d = 14 + r() * 7, h = 9 + Math.floor(r() * (near.dist > 120 ? 12 : 7)) * 3;
      walls.add(x, z, w, d, h, yaw, palette[Math.floor(r() * palette.length)]);
      // roof slab
      roofs.add(x, z, w + 0.6, d + 0.6, 0.6, yaw, roofCol, h, 12, 24, true);
    }
    const facade = tex.window('#ffffff', night);
    const wallMat = new THREE.MeshStandardMaterial({ map: facade, vertexColors: true, roughness: 0.85, emissive: night ? 0xffffff : 0x000000, emissiveMap: night ? facade : null, emissiveIntensity: night ? 0.3 : 0, side: THREE.DoubleSide });
    const wm = new THREE.Mesh(walls.geometry(), wallMat); wm.castShadow = true; wm.receiveShadow = true; scene.add(wm);
    const rm = new THREE.Mesh(roofs.geometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide })); scene.add(rm);

    // tunnel under the Fairmont hotel
    const [t0, t1] = track.data.tunnel;
    const i0 = Math.floor(t0 / track.ds), i1 = Math.ceil(t1 / track.ds);
    const concrete = new THREE.MeshStandardMaterial({ color: 0xbdb7ac, roughness: 0.9, side: THREE.DoubleSide });
    const H = 6.4;
    const roof = new THREE.Mesh(track.ribbon(-(hw + 1.2), hw + 1.2, H, { from: i0, to: i1 }), concrete); roof.castShadow = true; scene.add(roof);
    const top = new THREE.Mesh(track.ribbon(-(hw + 26), hw + 26, H + 4, { from: i0 - 4, to: i1 + 4 }), new THREE.MeshStandardMaterial({ color: 0xd9cdb8, roughness: 0.9, side: THREE.DoubleSide })); top.castShadow = true; scene.add(top);
    for (const sgn of [-1, 1]) {
      const w = new THREE.Mesh(track.wall(() => sgn * (hw + 1.1), 0, H, { from: i0, to: i1, step: 1 }), concrete); w.castShadow = true; scene.add(w);
      const facadeT = tex.window('#efe2c6', night).clone(); facadeT.needsUpdate = true;
      const outer = new THREE.Mesh(track.wall(() => sgn * (hw + 26), 0, H + 4, { from: i0 - 4, to: i1 + 4, step: 2, uScale: 1 / 12 }), new THREE.MeshStandardMaterial({ map: facadeT, roughness: 0.85, side: THREE.DoubleSide }));
      outer.castShadow = true; scene.add(outer);
      const lights = new THREE.Mesh(track.wall(() => sgn * (hw + 1.05), H - 0.9, H - 0.6, { from: i0, to: i1, step: 1 }), new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false, side: THREE.DoubleSide }));
      scene.add(lights);
    }
    // the tunnel portals mark where the hotel sits; keep buildings away (done above)

    // yachts in the harbour
    const hull = new THREE.BoxGeometry(4, 1.6, 15); const cabin = new THREE.BoxGeometry(3, 1.6, 6);
    hull.translate(0, 0.2, 0); cabin.translate(0, 1.8, -1.5);
    const N = 70, hm = new THREE.InstancedMesh(hull, new THREE.MeshStandardMaterial({ color: 0xf7f7f5, roughness: 0.3, metalness: 0.1 }), N);
    const cm = new THREE.InstancedMesh(cabin, new THREE.MeshStandardMaterial({ color: 0x2b3440, roughness: 0.1, metalness: 0.6 }), N);
    let yi = 0;
    for (let k = 0; k < 3000 && yi < N; k++) {
      const x = minX + r() * (maxX - minX), z = minZ + r() * (maxZ - minZ);
      if (!insidePoly(x, z, track.data.sea)) continue;
      const d = track.nearestDist(x, z, 2).dist;
      if (d < 38 || d > 200) continue;
      const sc = 0.7 + r() * 1.4;
      dummy.position.set(x, -0.8, z); dummy.rotation.set(0, Math.round(r()) * Math.PI / 2 + (r() - 0.5) * 0.2, 0); dummy.scale.set(sc, sc, sc); dummy.updateMatrix();
      hm.setMatrixAt(yi, dummy.matrix); cm.setMatrixAt(yi, dummy.matrix); yi++;
    }
    hm.count = cm.count = yi; hm.castShadow = true; scene.add(hm, cm);
  }

  // ---------- trees ----------
  if (!isMonaco) {
    const count = quality === 'high' ? (def.id === 'monza' ? 3200 : 1400) : 900;
    const canopyG = new THREE.IcosahedronGeometry(1, 1);
    const pp = canopyG.attributes.position;
    for (let v = 0; v < pp.count; v++) pp.setXYZ(v, pp.getX(v) * (0.85 + r() * 0.3), pp.getY(v) * (0.9 + r() * 0.25), pp.getZ(v) * (0.85 + r() * 0.3));
    canopyG.computeVertexNormals();
    const spots = [];
    for (let k = 0; k < count * 8 && spots.length < count; k++) {
      let x, z;
      if (def.id === 'monza' || r() < 0.4) { x = minX - 300 + r() * (maxX - minX + 600); z = minZ - 300 + r() * (maxZ - minZ + 600); }
      else { const a = r() * Math.PI * 2, d = Math.max(maxX - minX, maxZ - minZ) * (0.55 + r() * 0.45); x = cx + Math.cos(a) * d; z = cz + Math.sin(a) * d; }
      const near = track.nearestDist(x, z, 1);
      if (near.dist < 34) continue;
      if (near.dist < 80 && near.i >= 0) {
        const side = ((x - track.x[near.i]) * -track.tz[near.i] + (z - track.z[near.i]) * track.tx[near.i]) > 0 ? 1 : 0;
        if (near.dist < track.barrier[side][near.i] + 10) continue;
      }
      if (track.pitOffset(near.i * track.ds) > 0 && near.dist < 90) continue;
      if (!isFree(x, z, 4)) continue;
      spots.push([x, z]);
    }
    const canopy = new THREE.InstancedMesh(canopyG, new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), spots.length);
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.22, 0.35, 1, 6).translate(0, 0.5, 0), new THREE.MeshStandardMaterial({ color: 0x4e3a29, roughness: 1 }), spots.length);
    const col = new THREE.Color();
    spots.forEach(([x, z], k) => {
      const h = (def.id === 'monza' ? 10 : 7) + r() * 10, w = 2.6 + r() * 3.4;
      dummy.position.set(x, 0, z); dummy.rotation.set(0, r() * 6, 0); dummy.scale.set(1, h * 0.55, 1); dummy.updateMatrix(); trunk.setMatrixAt(k, dummy.matrix);
      dummy.position.set(x, h * 0.6, z); dummy.scale.set(w, h * 0.45, w); dummy.updateMatrix(); canopy.setMatrixAt(k, dummy.matrix);
      canopy.setColorAt(k, col.setHSL(0.22 + r() * 0.09, 0.42 + r() * 0.15, 0.17 + r() * 0.1));
    });
    canopy.castShadow = true; trunk.castShadow = true; canopy.receiveShadow = true;
    scene.add(canopy, trunk);
  }

  // ---------- floodlights for night races ----------
  if (night) {
    const spots = [];
    for (let s = 0, k = 0; s < track.length; s += 55, k++) {
      const side = k % 2, sgn = side ? 1 : -1, i = track.idx(s);
      const lat = sgn * (Math.min(track.barrier[side][i], hw + 30) + 2.5);
      if (track.pitOffset(s) > 0 && sgn === sg) continue;
      const p = track.point(s, lat);
      spots.push([p.x, p.z, track.heading(s) + (sgn > 0 ? Math.PI / 2 : -Math.PI / 2)]);
    }
    const pole = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.25, 16, 6).translate(0, 8, 0), new THREE.MeshStandardMaterial({ color: 0x777d84, metalness: 0.6, roughness: 0.4 }), spots.length);
    const head = new THREE.InstancedMesh(new THREE.BoxGeometry(2.6, 0.5, 1.2).translate(0, 16, 1), new THREE.MeshBasicMaterial({ color: 0xfff6e0, toneMapped: false }), spots.length);
    spots.forEach(([x, z, h], k) => { dummy.position.set(x, 0, z); dummy.rotation.set(0, h, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); pole.setMatrixAt(k, dummy.matrix); head.setMatrixAt(k, dummy.matrix); });
    scene.add(pole, head);
  }

  return out;
}

const garageTexture = (team) => makeGarageTex(team);
const garageCache = new Map();
function makeGarageTex(team) {
  if (garageCache.has(team.code)) return garageCache.get(team.code);
  const c = document.createElement('canvas'); c.width = 512; c.height = 192; const g = c.getContext('2d');
  g.fillStyle = '#1b1e23'; g.fillRect(0, 0, 512, 192);
  g.fillStyle = team.livery.base; g.fillRect(0, 30, 512, 110);
  g.fillStyle = team.livery.accent; g.fillRect(0, 70, 512, 10);
  g.fillStyle = '#ffffff'; g.font = '900 40px system-ui, Helvetica, Arial'; g.textAlign = 'center'; g.fillText(team.name.toUpperCase(), 256, 125);
  for (let x = 30; x < 512; x += 70) { g.fillStyle = '#fffbe8'; g.fillRect(x, 6, 40, 8); }
  g.fillStyle = '#3a3f46'; g.fillRect(0, 150, 512, 42);
  for (let x = 20; x < 512; x += 90) { g.fillStyle = '#c7ccd2'; g.fillRect(x, 155, 60, 30); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  garageCache.set(team.code, t);
  return t;
}

// Pit crew of 10 for one team. Idle near the garage; "work" positions around the car.
function makeCrew(scene, track, team, boxS, sg) {
  const P = track.pit;
  const body = new THREE.CapsuleGeometry(0.27, 0.85, 4, 8); body.translate(0, 0.72, 0);
  const head = new THREE.SphereGeometry(0.17, 12, 8); head.translate(0, 1.5, 0);
  const N = 10;
  const bm = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ color: team.livery.base, roughness: 0.7 }), N);
  const hm = new THREE.InstancedMesh(head, new THREE.MeshStandardMaterial({ color: team.livery.accent, roughness: 0.3, metalness: 0.2 }), N);
  bm.castShadow = hm.castShadow = true;
  scene.add(bm, hm);
  // local frame: a = along track, b = lateral (towards garage = +)
  const work = [[1.9, -1.35], [1.9, 1.35], [-1.75, -1.4], [-1.75, 1.4], [2.3, -1.6], [2.3, 1.6], [-2.15, -1.7], [-2.15, 1.7], [3.6, 0], [-3.4, 0]];
  const idle = work.map((_, k) => [-9 + k * 2, 3.6]);
  const toWorld = ([a, b]) => { const p = track.point(boxS + a, sg * (P.boxLat + b)); return p; };
  const W = work.map(toWorld), I = idle.map(toWorld);
  const cur = I.map((p) => p.clone());
  const heading = track.heading(boxS);
  const state = { working: false, t: 0 };
  const place = (time = 0) => {
    for (let k = 0; k < N; k++) {
      const target = state.working ? W[k] : I[k];
      cur[k].lerp(target, state.working ? 0.25 : 0.08);
      const bob = state.working ? Math.abs(Math.sin(time * 9 + k)) * 0.06 : 0;
      const face = state.working ? Math.atan2(W[k].x - track.point(boxS, sg * P.boxLat).x, W[k].z - track.point(boxS, sg * P.boxLat).z) + Math.PI : heading + (sg > 0 ? -Math.PI / 2 : Math.PI / 2);
      dummy.position.set(cur[k].x, bob, cur[k].z); dummy.rotation.set(0, face, 0); dummy.scale.set(1, state.working && k < 8 ? 0.82 : 1, 1); dummy.updateMatrix();
      bm.setMatrixAt(k, dummy.matrix); hm.setMatrixAt(k, dummy.matrix);
    }
    bm.instanceMatrix.needsUpdate = hm.instanceMatrix.needsUpdate = true;
  };
  for (let k = 0; k < 30; k++) place();
  return { setWorking: (w) => { state.working = w; }, update: (time) => place(time) };
}
