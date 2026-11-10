// The race: player physics, AI drivers, pit stops, laps, cameras and rendering.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { Track, engineAccel } from './track.js';
import { setupSky, buildScenery } from './scenery.js';
import { buildCar, animateCar, setTyreCompound, TYRES } from './carModel.js';
import { TEAMS, CARS, DRIVERS, DIFFICULTY } from './data.js';
import { makeQuestion, checkAnswer } from './maths.js';
import { RaceAudio } from './audio.js';
import { Hud } from './hud.js';
import { setMaxAnisotropy } from './textures.js';
import { playerTeam } from './liveries.js';

const clamp = THREE.MathUtils.clamp;
const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
const WHEELBASE = 3.6, CAR_HALF_W = 1.0;

export class Race {
  constructor({ container, circuit, settings, save, onFinish, onQuit, onSave }) {
    Object.assign(this, { container, circuit, settings, save, onFinish, onQuit, onSave });
    this.keys = {};
    this.time = 0; this.raceTime = 0; this.state = 'grid'; this.stateT = 0;
    this.camMode = settings.camera || 'chase';
    this.paused = false; this.disposed = false;
    this.totalLaps = settings.laps;
    this.questions = { asked: 0, correct: 0 };

    this.track = new Track(circuit);
    this.setupRenderer();
    this.setupScene();
    this.setupCars();
    this.hud = new Hud(container, this);
    this.audio = new RaceAudio();
    this.bindInput();
    this.clock = new THREE.Clock();
    this.hud.message(`${circuit.name} · ${this.totalLaps} laps · Pit once for new tyres!`, 4);
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  // ---------- setup ----------
  setupRenderer() {
    const high = this.settings.quality !== 'low';
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: !high, powerPreference: 'high-performance' });
    r.setPixelRatio(Math.min(devicePixelRatio, high ? 2 : 1));
    r.setSize(innerWidth, innerHeight);
    r.toneMapping = THREE.NeutralToneMapping;
    r.toneMappingExposure = this.settings.time === 'night' ? 1.0 : 0.85;
    r.shadowMap.enabled = true;
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    setMaxAnisotropy(r.capabilities.getMaxAnisotropy());
    r.domElement.className = 'race-canvas';
    this.container.appendChild(r.domElement);
    this.camera = new THREE.PerspectiveCamera(64, innerWidth / innerHeight, 0.1, 12000);
    this.onResize = () => {
      r.setSize(innerWidth, innerHeight);
      this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
      this.composer?.setSize(innerWidth, innerHeight);
    };
    addEventListener('resize', this.onResize);
  }

  setupScene() {
    const night = this.settings.time === 'night', high = this.settings.quality !== 'low';
    const scene = this.scene = new THREE.Scene();
    this.sunDir = setupSky(scene, this.renderer, this.circuit, night);
    scene.environmentIntensity = night ? 0.5 : 0.6;
    this.hemi = new THREE.HemisphereLight(night ? 0xb8c8ff : 0xdcecff, night ? 0x40485a : 0x5d6b4c, night ? 1.4 : 0.6);
    scene.add(this.hemi);
    const sun = this.sun = new THREE.DirectionalLight(night ? 0xcfdcff : 0xfff0d8, night ? 1.4 : 3.2);
    sun.castShadow = true;
    sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
    Object.assign(sun.shadow.camera, { left: -55, right: 55, top: 55, bottom: -55, near: 1, far: 500 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.04;
    scene.add(sun, sun.target);

    this.roadGroup = new THREE.Group(); scene.add(this.roadGroup);
    this.track.buildRoad(this.roadGroup, { night, showLine: this.settings.racingLine });

    // teams: player first, then five rivals
    const baseTeam = TEAMS[CARS[this.save.car].team];
    this.teams = [playerTeam(this.save), ...TEAMS.filter((t) => t !== baseTeam).slice(0, 5)];
    this.scenery = buildScenery(this.track, scene, { night, quality: this.settings.quality, boxTeams: this.teams, playerBox: 0 });

    if (high) {
      const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { type: THREE.HalfFloatType, samples: 4 });
      this.composer = new EffectComposer(this.renderer, rt);
      this.composer.addPass(new RenderPass(scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), night ? 0.75 : 0.22, 0.45, night ? 0.6 : 0.92);
      this.composer.addPass(this.bloom);
      this.composer.addPass(new OutputPass());
    }
  }

  setupCars() {
    const T = this.track, S = this.save, car = CARS[S.car], diff = DIFFICULTY[this.settings.difficulty];
    this.stats = {
      vmax: car.vmax + S.engine * 0.8,
      grip: car.grip * (1 + S.tyres * 0.012),
      ersSeconds: 7 * (1 + S.ers * 0.12),
      crewBonus: S.crew * 0.12,
    };
    const assist = this.settings.assist;
    this.playerProfile = T.speedProfile(this.stats.grip * (assist ? 1.04 : 1) * 0.97, this.stats.vmax);
    const playerSlot = { rookie: 3, pro: 4, champion: 5 }[this.settings.difficulty];
    // AI pace values; fastest starts at the front
    const ai = DRIVERS.slice(0, 5).map((d, k) => ({ driver: d, team: this.teams[k + 1], pace: diff.pace * (0.975 + Math.random() * 0.05) }))
      .sort((a, b) => b.pace - a.pace);
    this.cars = [];
    let aiIdx = 0;
    for (let slot = 0; slot < 6; slot++) {
      const isPlayer = slot === playerSlot;
      const info = isPlayer ? { driver: { name: 'You', code: 'YOU' }, team: this.teams[0] } : ai[aiIdx++];
      const { s, lat } = T.gridSlot(slot);
      const p = T.point(s, lat);
      const compound = isPlayer ? 'medium' : (Math.random() < 0.5 ? 'medium' : 'soft');
      const mesh = buildCar(info.team, { compound, shadows: true });
      this.scene.add(mesh);
      const c = {
        id: this.cars.length, isPlayer, mesh, team: info.team, driver: info.driver, box: this.teams.indexOf(info.team),
        x: p.x, z: p.z, yaw: T.heading(s), v: 0, s, lat, hint: T.idx(s), laps: -1, progress: s - T.length,
        steer: 0, steerIn: 0, compound, wear: 0, ers: 1, damage: 0, slide: 0, boost: false,
        pit: { state: null, done: false, timer: 0, plannedLap: 0 }, finished: false, finishTime: 0,
        lapStart: 0, lastLap: 0, bestLap: 0, cp: [],
      };
      if (!isPlayer) {
        c.pace = info.pace;
        c.prof = T.speedProfile(info.pace, diff.vmax * (0.99 + (info.pace - diff.pace) * 0.5));
        c.personality = { risk: [0.82, 0.45, 0.72, 0.96, 0.56][aiIdx - 1],
          defence: [0.75, 0.9, 0.55, 0.6, 0.8][aiIdx - 1],
          tyreCare: [0.95, 1.12, 1.04, 0.86, 1.08][aiIdx - 1],
          consistency: [0.025, 0.012, 0.018, 0.035, 0.015][aiIdx - 1] };
        c.laneOff = 0; c.passTarget = null; c.passTime = 0; c.overtakeT = 0; c.react = 0.15 + Math.random() * 0.35; c.vmax = diff.vmax;
        c.launchLat = lat; c.launchDistance = 0;
        c.pit.plannedLap = Math.max(0, Math.min(this.totalLaps - 2, compound === 'soft' ? 0 : Math.floor(this.totalLaps / 2)));
      }
      mesh.position.set(c.x, 0, c.z); mesh.rotation.y = c.yaw;
      this.cars.push(c);
    }
    this.player = this.cars.find((c) => c.isPlayer);
  }

  bindInput() {
    const map = { arrowup: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', a: 'left', arrowright: 'right', d: 'right', ' ': 'ers', shift: 'ers' };
    this.onKeyDown = (e) => {
      const k = e.key.toLowerCase();
      if (this.hud.modalOpen && !this.paused && k !== 'escape') return; // typing an answer
      if (map[k]) { this.keys[map[k]] = true; e.preventDefault(); }
      if (k === 'c') this.cycleCamera();
      if (k === 'm') { this.audio.setMuted(!this.audio.muted); this.hud.message(this.audio.muted ? 'Sound off' : 'Sound on', 1.2); }
      if (k === 'r' && this.state === 'racing' && !this.player.pit.state) this.resetToTrack();
      if (k === 'escape' || k === 'p') { e.preventDefault(); this.togglePause(); }
    };
    this.onKeyUp = (e) => { const k = map[e.key.toLowerCase()]; if (k) this.keys[k] = false; };
    this.onBlur = () => { this.keys = {}; if (!this.paused && !this.hud.modalOpen && this.state !== 'finished') this.togglePause(); };
    addEventListener('keydown', this.onKeyDown);
    addEventListener('keyup', this.onKeyUp);
    addEventListener('blur', this.onBlur);
  }

  cycleCamera() {
    const order = ['chase', 'tcam', 'cockpit', 'far'];
    this.camMode = order[(order.indexOf(this.camMode) + 1) % order.length];
    this.hud.message({ chase: 'Chase camera', tcam: 'T-cam', cockpit: 'Cockpit camera', far: 'Wide chase camera' }[this.camMode], 1.2);
  }

  togglePause() {
    if (this.state === 'finished' || this.player.pit.state === 'stopped' && this.hud.modalOpen && !this.paused) return;
    this.paused = !this.paused;
    if (this.paused) {
      this.hud.modal(`<div class="tag">PAUSED</div><h2>Take a breather</h2>
        <div class="controls-list">↑ / W accelerate · ↓ / S brake (hold to reverse) · ← → / A D steer<br>Space ERS boost · C camera · R back to track · M sound · Esc pause</div>
        <div class="row center"><button data-act="resume">RESUME</button><button class="ghost" data-act="restart">RESTART</button><button class="ghost" data-act="quit">QUIT TO GARAGE</button></div>`, {
        resume: () => this.togglePause(), restart: () => this.onQuit('restart'), quit: () => this.onQuit('menu'),
      });
    } else { this.hud.closeModal(); this.clock.getDelta(); }
  }

  resetToTrack() {
    const p = this.player, T = this.track;
    const lat = clamp(p.lat, -T.halfW + 1.5, T.halfW - 1.5);
    const pt = T.point(p.s, lat);
    p.x = pt.x; p.z = pt.z; p.yaw = T.heading(p.s); p.v = 0;
    this.hud.message('Back on track', 1.2);
  }

  // ---------- main loop ----------
  loop() {
    if (this.disposed) return;
    requestAnimationFrame(this.loop);
    let frameDt = Math.min(this.clock.getDelta(), 0.05);
    if (this.settings.ff > 0) { // testing: fast-forward the simulation without drawing
      this.settings.ff -= 2; frameDt = 0;
      if (!(this.hud.modalOpen && this.player.pit.state === 'stopped')) for (let k = 0; k < 240; k++) { this.time += 1 / 120; this.step(1 / 120); }
      this.updateVisuals(1 / 60, true);
      return;
    }
    this.time += frameDt;
    const running = !this.paused && !(this.hud.modalOpen && this.player.pit.state === 'stopped');
    if (running) {
      const steps = Math.ceil(frameDt / (1 / 120));
      const dt = frameDt / steps;
      for (let k = 0; k < steps; k++) this.step(dt);
    }
    this.updateVisuals(frameDt, running);
    this.render();
  }

  step(dt) {
    this.stateT += dt;
    if (this.state === 'grid' && this.stateT > 2) { this.state = 'lights'; this.stateT = 0; }
    if (this.state === 'lights') {
      const lit = Math.min(5, Math.floor(this.stateT / 0.9) + 1);
      if (lit !== this.litCount) { this.litCount = lit; this.audio.beep(520, 0.12); }
      this.lightsOutAt ??= 4.6 + 0.4 + Math.random() * 1.2;
      if (this.stateT > this.lightsOutAt) {
        this.state = 'racing'; this.stateT = 0; this.litCount = 0; this.raceTime = 0;
        this.audio.beep(1040, 0.35); this.hud.message("IT'S LIGHTS OUT AND AWAY WE GO!", 2.5);
      }
    }
    if (this.state === 'racing' || this.state === 'finished') this.raceTime += dt;
    // Keep the player's finish time and position fixed while rivals complete their laps.
    if (this.state !== 'finished') this.stepPlayer(this.player, dt);
    for (const c of this.cars) if (!c.isPlayer) this.stepAI(c, dt);
    if (this.state !== 'finished') this.collisions();
    this.updateProgress();
  }

  // ---------- player physics ----------
  surface(p) {
    const T = this.track, hw = T.halfW, P = T.pit, sl = p.lat * P.side, al = Math.abs(p.lat), i = p.hint;
    const pitOff = T.pitOffset(p.s);
    if (al <= hw + 0.15) return { grip: 1, drag: 0, kerb: false, name: 'road' };
    if (pitOff > 0 && sl > hw - 0.5 && sl < pitOff + P.laneHalf + 0.6) return { grip: 1, drag: 0, kerb: false, name: 'pit' };
    const corner = T.cornerness[i];
    if (al < hw + 1.25 && corner > 1 / 260) return { grip: 0.96, drag: 0.6, kerb: true, name: 'kerb' };
    const style = this.circuit.runoffStyle;
    if (corner > 1 / 200 && style === 'gravel') return { grip: 0.45, drag: 10, kerb: false, name: 'gravel' };
    if (corner > 1 / 200 && style === 'tarmac') return { grip: 0.85, drag: 1.2, kerb: false, name: 'runoff' };
    return { grip: 0.55, drag: 4.5, kerb: false, name: 'grass' };
  }

  stepPlayer(p, dt) {
    const T = this.track, S = this.stats, k = this.keys, assist = this.settings.assist;
    const held = this.state === 'grid' || this.state === 'lights' || p.pit.state === 'stopped';
    let throttle = k.up ? 1 : 0, brake = k.down ? 1 : 0, steerIn = (k.right ? 1 : 0) - (k.left ? 1 : 0), ers = !!k.ers;
    if (this.settings.autopilot || this.state === 'finished') ({ throttle, brake, steerIn, ers } = this.autopilot(p));
    p.throttleIn = throttle;
    if (held) { throttle = 0; brake = 0; ers = false; }

    const rate = steerIn === 0 ? 7 : 4.2;
    p.steerIn += clamp(steerIn - p.steerIn, -rate * dt, rate * dt);
    const v = p.v, av = Math.abs(v);
    const surf = p.surf = this.surface(p);
    const tyre = TYRES[p.compound];
    const grip = S.grip * tyre.grip * (1 - 0.28 * p.wear) * (1 - p.damage / 400) * surf.grip * (assist ? 1.04 : 1);

    // braking assist: brake for corners automatically if going too fast
    let autoBrake = 0;
    p.inPit = T.inPitZone(p.s, p.lat);
    if (assist && !brake && v > 8 && !p.inPit && surf.name !== 'pit') {
      const target = T.profileAt(p.s + 3, this.playerProfile);
      if (v > target * 1.02) { autoBrake = clamp((v - target) / 5, 0.25, 1); throttle = 0; }
    }
    const totalBrake = Math.max(brake, autoBrake);

    // ERS boost (also opens the DRS flap visually)
    let power = 1; p.boost = false;
    if (ers && p.ers > 0 && throttle > 0 && v > 10) { power = 1.2; p.ers = Math.max(0, p.ers - dt / S.ersSeconds); p.boost = true; }
    else if (!held) p.ers = Math.min(1, p.ers + dt * (totalBrake ? 0.16 : 0.02));

    const vmax = S.vmax * (1 - p.damage / 500);
    if (brake && !throttle && v <= 0.3) p.v = Math.max(-7, v - 5 * dt);          // reverse
    else if (v < -0.1) p.v = Math.min(0, v + (throttle ? 12 : 4) * dt);           // stop reversing
    else {
      let acc = throttle ? engineAccel(Math.max(v, 0), vmax, power) : -(0.0013 * v * v + 0.15 + 1.4);
      if (totalBrake && v > 0.3) acc -= (20 + 0.0035 * v * v) * Math.min(1.1, grip) * totalBrake;
      p.v = Math.max(0, v + acc * dt);
    }
    if (surf.drag && p.v > 0) p.v = Math.max(0, p.v - surf.drag * Math.min(1, av / 15) * dt);
    if (p.inPit && p.v > T.pit.speedLimit) p.v = Math.max(T.pit.speedLimit, p.v - 28 * dt);
    if (held) p.v = 0;

    // steering
    const maxSteer = 0.38 / (1 + av / 25);
    let yawRate = -(p.v * Math.tan(p.steerIn * maxSteer)) / WHEELBASE;
    const latMax = grip * (16 + 0.0045 * v * v), maxYaw = latMax / Math.max(av, 1);
    p.slide = 0;
    if (Math.abs(yawRate) > maxYaw) {
      p.slide = Math.min(1, (Math.abs(yawRate) - maxYaw) / maxYaw);
      p.v -= Math.sign(p.v) * p.slide * 7 * dt;
      yawRate = Math.sign(yawRate) * maxYaw * (1 + 0.08 * p.slide);
    }
    p.steer = p.steerIn * maxSteer;
    p.yaw += yawRate * dt;
    p.wear = Math.min(1, p.wear + Math.abs(p.v) * dt / (this.totalLaps * T.length) * 0.85 * tyre.wear * (1 + p.slide * 2));

    const prevLat = p.lat, prevS = p.s;
    p.x += Math.sin(p.yaw) * p.v * dt; p.z += Math.cos(p.yaw) * p.v * dt;
    const pr = T.project(p.x, p.z, p.hint);
    p.hint = pr.i; p.s = pr.s; p.lat = pr.lat;
    this.walls(p, prevLat);
    this.lapCheck(p, prevS);
    this.playerPit(p, dt);
  }

  walls(p, prevLat) {
    const T = this.track, P = T.pit, side = p.lat > 0 ? 1 : 0, sgn = side ? 1 : -1;
    const lim = T.barrier[side][p.hint] - CAR_HALF_W;
    if (Math.abs(p.lat) > lim) this.hitWall(p, sgn * lim);
    if (T.pitWallActive(p.s)) {
      const w = P.wallLat + 0.4 + CAR_HALF_W * 0.9, w2 = P.wallLat - 0.4 - CAR_HALF_W * 0.9;
      const sl = p.lat * P.side, psl = prevLat * P.side;
      if (psl <= P.wallLat && sl > w2) this.hitWall(p, P.side * w2);
      else if (psl > P.wallLat && sl < w) this.hitWall(p, P.side * w);
    }
  }
  hitWall(p, newLat) {
    const T = this.track, th = T.heading(p.s), d = wrapAngle(p.yaw - th);
    const toward = -Math.sin(d) * p.v * Math.sign(newLat - 0 || 1) * (Math.abs(newLat) > Math.abs(p.lat) ? -1 : 1);
    const impact = Math.abs(Math.sin(d) * p.v);
    const pt = T.point(p.s, newLat); p.x = pt.x; p.z = pt.z; p.lat = newLat;
    p.v *= 1 - Math.min(0.75, 0.65 * Math.abs(Math.sin(d)) + 0.04);
    p.yaw = th + d * 0.35 + (p.v < 0 ? 0 : 0);
    if (impact > 2.5 && this.time > (p.hitCooldown || 0)) {
      p.hitCooldown = this.time + 0.6;
      p.damage = Math.min(100, p.damage + Math.min(25, impact * 0.7));
      this.audio.bump(impact / 8); this.shake = Math.min(1, impact / 15);
      if (impact > 8) this.hud.message('Ouch! Barrier hit — damage to the front wing', 1.6);
    }
    void toward;
  }

  autopilot(p) {
    const T = this.track;
    const relNow = T.rel(p.s);
    const wantPit = !p.pit.done && p.laps >= 0 && this.state === 'racing' && relNow < T.boxS[0] + 3 && relNow > T.pit.from - 300;
    const look = 9 + Math.abs(p.v) * 0.35;
    let lat = T.lineAt(p.s + look);
    if (p.inPit && !wantPit) lat = T.pit.side * T.pitOffset(p.s + look); // stay in the pit lane until it rejoins
    if (p.inPit && !wantPit) lat = T.pit.side * T.pitOffset(p.s + look); // stay in the pit lane until it rejoins
    const off = T.pitOffset(p.s + look);
    if (wantPit && off > 0) lat = T.pit.side * (T.rel(p.s) > T.boxS[0] - 40 ? T.pit.boxLat : off);
    const tp = T.point(p.s + look, lat);
    const want = Math.atan2(tp.x - p.x, tp.z - p.z);
    const err = wrapAngle(want - p.yaw);
    let target = T.profileAt(p.s + 3, this.playerProfile) * (this.state === 'finished' ? 0.6 : 0.97);
    if (wantPit && T.pitOffset(p.s) > 0) {
      const toBox = T.boxS[0] - T.rel(p.s);
      target = Math.min(T.pit.speedLimit - 0.5, toBox > 0 ? Math.sqrt(2 * 6 * toBox) + 0.3 : 0);
    } else if (wantPit && T.rel(p.s + 200) > T.pit.from - 1 && T.rel(p.s) < T.pit.from) target = Math.min(target, 40);
    return { throttle: p.v < target ? 1 : 0, brake: p.v > target + 1 ? 1 : 0, steerIn: clamp(-err * 4, -1, 1), ers: false };
  }

  // ---------- pit stop (player) ----------
  playerPit(p, dt) {
    const T = this.track, P = T.pit, hud = this.hud;
    const boxRel = T.boxS[p.box], rel = T.rel(p.s), sl = p.lat * P.side;
    if (p.inPit && !p.wasInPit) { hud.message(p.pit.done ? 'Pit limiter on — 80 km/h' : 'PIT LIMITER ON · Stop in your glowing box', 2.5); }
    p.wasInPit = p.inPit;
    if (p.pit.state === 'stopped') {
      if (!hud.modalOpen) {
        p.pit.timer -= dt;
        this.scenery.crews[p.box]?.setWorking(true);
        if (p.pit.timer <= 0) {
          p.pit.state = null; p.pit.done = true; p.damage = 0; p.wear = 0; p.ers = Math.max(p.ers, 0.6);
          this.scenery.crews[p.box]?.setWorking(false);
          this.audio.beep(1200, 0.25);
          hud.message(`GO GO GO! Stop time ${p.pit.stopTime.toFixed(1)} s`, 2.2);
        }
      }
      return;
    }
    if (!p.pit.done && p.inPit && Math.abs(rel - boxRel) < 4.5 && Math.abs(sl - P.boxLat) < 3.2 && p.v < 11 && this.state === 'racing') {
      // stop in the box
      p.pit.state = 'stopped'; p.v = 0;
      const pt = T.point(boxRel, P.side * P.boxLat); p.x = pt.x; p.z = pt.z; p.yaw = T.heading(boxRel); p.lat = P.side * P.boxLat; p.s = T.wrapS(boxRel);
      this.openPitStop(p);
    } else if (!p.pit.done && p.inPit && rel > boxRel + 7 && rel < P.to && this.state === 'racing' && !p.missedMsg) {
      p.missedMsg = true; hud.message('You drove past your box! Hold ↓ to reverse back to it', 3);
    }
    if (rel < boxRel) p.missedMsg = false;
  }

  openPitStop(p) {
    const hud = this.hud, q = makeQuestion();
    let wrong = 0, compound = 'medium';
    this.keys = {};
    this.audio.beep(700, 0.2);
    const finish = (correct) => {
      const base = 2.1 + Math.random() * 0.5 - this.stats.crewBonus;
      p.pit.stopTime = Math.max(1.8, base + wrong * 1.5 + (correct ? 0 : 2));
      p.pit.timer = p.pit.stopTime;
      p.compound = compound; setTyreCompound(p.mesh, compound);
      this.questions.asked++;
      if (correct && wrong === 0) { this.questions.correct++; this.save.correct++; this.save.points += 50; this.onSave?.(); }
      if (p.pit.stopTime < 2.5) this.perfectStop = true;
      hud.closeModal();
      this.clock.getDelta();
    };
    const askQuestion = () => {
      hud.modal(`<div class="tag">PIT STOP · ${TYRES[compound].name.toUpperCase()} TYRES ON THE WAY</div>
        <h2>The crew needs your answer!</h2><p class="topic">${q.topic}</p><p class="question">${q.text}</p>
        <form class="answer-form"><input id="pitAnswer" inputmode="decimal" autocomplete="off" placeholder="Type your answer" required><button>FIT THE TYRES</button></form>
        <p class="feedback" id="pitFeedback">Right first time = fastest stop and +50 points.</p>`, {});
      const input = this.container.querySelector('#pitAnswer'), fb = this.container.querySelector('#pitFeedback');
      setTimeout(() => input?.focus(), 60);
      if (this.settings.autopilot) setTimeout(() => { input.value = q.answer; input.form.requestSubmit(); }, 400);
      input.form.onsubmit = (e) => {
        e.preventDefault();
        if (checkAnswer(q, input.value)) {
          fb.innerHTML = `<b class="good">Correct! ${wrong === 0 ? '+50 points · ' : ''}Wheels going on…</b>`;
          this.audio.beep(1320, 0.2);
          setTimeout(() => finish(true), 700);
        } else {
          wrong++;
          this.audio.beep(220, 0.25);
          if (wrong >= 3) {
            fb.innerHTML = `<b class="bad">The answer was ${q.answer}.</b> ${q.explain}<br><button type="button" id="pitContinue">CONTINUE</button>`;
            this.container.querySelector('#pitContinue').onclick = () => finish(false);
          } else fb.innerHTML = `<b class="bad">Not quite — try again!</b> ${wrong === 2 ? 'Hint: ' + q.explain.split('=')[0] : 'Each wrong answer adds time to your stop.'}`;
          input.select();
        }
      };
    };
    const wearPct = Math.round((1 - p.wear) * 100);
    hud.modal(`<div class="tag">BOX, BOX! · TYRES ${wearPct}% · DAMAGE ${Math.round(p.damage)}%</div><h2>Choose your tyres</h2>
      <div class="tyre-pick">
        ${Object.entries(TYRES).map(([key, t]) => `<button class="tyre" data-act="${key}"><i style="border-color:${t.colour}">${t.name[0]}</i><b>${t.name}</b><small>${{ soft: 'Most grip, wears fastest', medium: 'All-rounder', hard: 'Less grip, lasts longest' }[key]}</small></button>`).join('')}
      </div>`, Object.fromEntries(Object.keys(TYRES).map((key) => [key, () => { compound = key; askQuestion(); }])));
    if (this.settings.autopilot) setTimeout(() => this.container.querySelector('[data-act="soft"]')?.click(), 300);
  }

  // ---------- AI ----------
  stepAI(c, dt) {
    const T = this.track, P = T.pit;
    if (this.state === 'grid' || this.state === 'lights') return;
    if (this.raceTime < c.react) return;
    const rel = T.rel(c.s);
    let target = T.profileAt(c.s + 4, c.prof);
    const temperament = c.personality;
    target *= 1 + Math.sin(c.s / 115 + c.id * 2.3) * temperament.consistency;
    target *= 1 - c.wear * 0.18;
    let laneTarget = T.lineAt(c.s + 10) + c.laneOff;
    let latRate = 3.5 * Math.min(1, c.v / 18 + 0.2);

    // pit stop plan
    const pit = c.pit;
    const tyreLimit = c.compound === 'soft' ? 0.43 : c.compound === 'medium' ? 0.56 : 0.68;
    const needsStop = c.laps >= pit.plannedLap || c.wear > tyreLimit * temperament.tyreCare;
    if (!pit.done && !pit.state && c.laps >= 0 && needsStop && rel > P.from - 3 && rel < P.from + 20) pit.state = 'in';
    if (pit.state) {
      const boxRel = T.boxS[c.box];
      latRate = 12;
      laneTarget = P.side * T.pitOffset(c.s);
      target = Math.min(target, P.speedLimit - 0.6);
      if (pit.state === 'in') {
        if (rel > boxRel - 35) laneTarget = P.side * P.boxLat;
        const toBox = boxRel - rel;
        target = Math.min(target, Math.sqrt(2 * 6 * Math.max(0, toBox)) + 0.2);
        if (toBox < 0.6) {
          pit.state = 'stopped'; pit.timer = 2.2 + Math.random() * 1.3; c.v = 0;
          this.scenery.crews[c.box]?.setWorking(true);
        }
      } else if (pit.state === 'stopped') {
        laneTarget = P.side * P.boxLat; target = 0; c.v = 0;
        pit.timer -= dt;
        if (pit.timer <= 0) {
          pit.state = 'out'; c.compound = this.totalLaps - c.laps <= 2 ? 'soft' : temperament.tyreCare > 1 ? 'hard' : 'medium'; c.wear = 0; setTyreCompound(c.mesh, c.compound);
          this.scenery.crews[c.box]?.setWorking(false);
        }
      } else if (pit.state === 'out') {
        if (rel > boxRel + 25) laneTarget = P.side * T.pitOffset(c.s);
        if (rel > P.to - 2) { pit.state = null; pit.done = true; }
      }
    } else {
      // Judge nearby traffic before committing to one move. A committed pass stays
      // in its lane until the target is behind, avoiding side-to-side weaving.
      c.overtakeT = Math.max(0, c.overtakeT - dt);
      const nearestAhead = this.cars.filter(o => o !== c && !o.pit.state && !o.finished)
        .map(o => ({ o, gap: o.progress - c.progress }))
        .filter(x => x.gap > 0 && x.gap < 45).sort((a, b) => a.gap - b.gap)[0];
      const passing = this.cars.find(o => o.id === c.passTarget);
      if (c.passTarget !== null) c.passTime += dt;
      if (c.passTarget !== null && (!passing || passing.pit.state || passing.finished || c.progress > passing.progress + 7 || c.passTime > 9)) {
        c.passTarget = null; c.overtakeT = 1.5;
      }
      if (c.passTarget === null && c.overtakeT <= 0) c.laneOff *= Math.max(0, 1 - dt * 0.8);
      if (nearestAhead) {
        const { o, gap } = nearestAhead;
        const sameLane = Math.abs(o.lat - (T.lineAt(c.s) + c.laneOff)) < 2.5;
        const cornerSoon = T.profileAt(c.s + 38, c.prof) < c.v * 0.82;
        if (sameLane && c.passTarget === null && c.launchDistance > 65 && gap < 27 && !cornerSoon && c.v >= o.v - 1) {
          const limit = T.halfW - 1.4, choices = [o.lat - 3.4, o.lat + 3.4]
            .filter(lat => Math.abs(lat) < limit)
            .filter(lat => !this.cars.some(other => other !== c && other !== o && Math.abs(other.progress - c.progress) < 12 && Math.abs(other.lat - lat) < 2.5));
          if (choices.length && gap > 6 + (1 - temperament.risk) * 8) {
            const choice = choices.sort((a, b) => Math.abs(a - T.lineAt(c.s)) - Math.abs(b - T.lineAt(c.s)))[0];
            c.laneOff = choice - T.lineAt(c.s); c.passTarget = o.id; c.passTime = 0;
          }
        }
        if (sameLane && c.passTarget === null) target = Math.min(target, Math.max(0, o.v + (gap - 8) * 0.9));
      }
      if (c.passTarget === null && c.launchDistance > 100) {
        const attacker = this.cars.find(o => o !== c && !o.pit.state && o.progress < c.progress && c.progress - o.progress < 18 && o.v > c.v + 2);
        if (attacker) c.laneOff += clamp((attacker.lat > c.lat ? 1 : -1) * temperament.defence - c.laneOff, -dt * 0.6, dt * 0.6);
      }
      laneTarget = T.lineAt(c.s + 10) + c.laneOff;
      laneTarget = clamp(laneTarget, -T.halfW + 1.1, T.halfW - 1.1);
    }
    // longitudinal
    if (c.v < target) c.v = Math.min(target, c.v + Math.max(1, engineAccel(c.v, c.vmax, 1)) * dt);
    else c.v = Math.max(target, c.v - (20 + 0.0035 * c.v * c.v) * c.pace * dt);
    if (pit.state === 'stopped') c.v = 0;
    if (!pit.state && c.launchDistance < 120) {
      const blend = Math.max(0, 1 - c.launchDistance / 120);
      laneTarget = laneTarget * (1 - blend) + c.launchLat * blend;
      latRate = Math.min(latRate, 1.4 + c.launchDistance / 100);
    }
    c.lat += clamp(laneTarget - c.lat, -latRate * dt, latRate * dt);

    const prevS = c.s;
    c.s = T.wrapS(c.s + c.v * dt);
    c.launchDistance += Math.max(0, c.v) * dt;
    c.wear = Math.min(1, c.wear + c.v * dt / (this.totalLaps * T.length) * 0.85 * TYRES[c.compound].wear / temperament.tyreCare);
    const pt = T.point(c.s, c.lat);
    const dx = pt.x - c.x, dz = pt.z - c.z;
    if (dx * dx + dz * dz > 1e-6) {
      const want = Math.atan2(dx, dz), dy = wrapAngle(want - c.yaw);
      c.yaw += dy * Math.min(1, dt * 12);
      c.steer = clamp(-dy * 0.8 / Math.max(dt, 1e-3) * WHEELBASE / Math.max(c.v, 4) * 0.08, -0.3, 0.3);
    }
    c.x = pt.x; c.z = pt.z; c.hint = T.idx(c.s);
    this.lapCheck(c, prevS);
  }

  // ---------- shared ----------
  lapCheck(c, prevS) {
    const L = this.track.length;
    if (prevS > L - 80 && c.s < 80) {
      c.laps++;
      if (c.laps >= 1) {
        const lt = this.raceTime - c.lapStart;
        c.lastLap = lt; c.lapStart = this.raceTime;
        if (!c.bestLap || lt < c.bestLap) c.bestLap = lt;
        if (c.isPlayer) this.hud.lapFlash(lt, c.bestLap === lt);
      }
      if (c.laps >= this.totalLaps && !c.finished && this.state !== 'grid') {
        c.finished = true; c.finishTime = this.raceTime;
        if (c.isPlayer) this.playerFinished();
      } else if (c.isPlayer && c.laps === this.totalLaps - 1) this.hud.message('FINAL LAP!', 2);
    } else if (prevS < 80 && c.s > L - 80) c.laps--;
  }

  collisions() {
    const p = this.player;
    for (const o of this.cars) {
      if (o === p) continue;
      const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
      const dx = o.x - p.x, dz = o.z - p.z;
      const along = dx * fx + dz * fz, side = dx * -fz + dz * fx;
      if (Math.abs(along) > 5.1 || Math.abs(side) > 1.95) continue;
      const penA = 5.1 - Math.abs(along), penS = 1.95 - Math.abs(side);
      let impact = 0;
      if (penS < penA) {
        const push = penS * Math.sign(side || 1);
        p.x -= -fz * push; p.z -= fx * push;
        impact = Math.abs(p.v - o.v) * 0.3 + 1;
        p.v *= 0.985;
      } else if (along > 0) { // we hit the car ahead
        impact = Math.max(0, p.v - o.v);
        p.x -= fx * penA; p.z -= fz * penA;
        if (this.time > (p.contactCooldown || 0)) {
          p.contactCooldown = this.time + 0.45;
          p.v = Math.max(0, p.v - Math.min(7, impact * 0.35));
          if (!o.pit.state) o.v += Math.min(3, impact * 0.12);
        }
      } else { // a car hit us from behind
        impact = Math.max(0, o.v - p.v);
        if (!o.pit.state) o.s = this.track.wrapS(o.s - penA);
        if (this.time > (p.contactCooldown || 0)) {
          p.contactCooldown = this.time + 0.45;
          if (!o.pit.state) o.v = Math.max(0, o.v - Math.min(7, impact * 0.35));
          p.v += Math.min(3, impact * 0.12);
        }
      }
      if (impact > 4 && this.time > (p.hitCooldown || 0)) { p.hitCooldown = this.time + 0.6; p.damage = Math.min(100, p.damage + Math.min(15, impact * 0.5)); this.audio.bump(impact / 10); this.shake = Math.min(1, impact / 12); }
    }
  }

  updateProgress() {
    const L = this.track.length;
    for (const c of this.cars) {
      c.progress = c.laps * L + c.s;
      if (c.progress > 0 && this.state !== 'grid') {
        const cp = Math.floor(c.progress / 50);
        if (c.cp[cp] === undefined) c.cp[cp] = this.raceTime;
      }
    }
    this.order = [...this.cars].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      return b.progress - a.progress;
    });
    const leader = this.order[0];
    for (const c of this.order) {
      const cp = Math.floor(c.progress / 50);
      c.gap = c === leader ? 0 : (c.cp[cp] !== undefined && leader.cp[cp] !== undefined ? c.cp[cp] - leader.cp[cp] : null);
      c.lapsDown = Math.floor((leader.progress - c.progress) / L);
    }
    this.player.position = this.order.indexOf(this.player) + 1;
  }

  playerFinished() {
    const p = this.player;
    this.state = 'finished';
    const penalty = p.pit.done ? 0 : 10;
    p.finishTime += penalty;
    if (penalty) this.hud.message('No pit stop! +10 second penalty', 3);
    else this.hud.message('CHEQUERED FLAG!', 3);
    setTimeout(() => this.showResults(penalty), 2600);
  }

  showResults(penalty) {
    if (this.disposed) return;
    // With a missed pit stop, wait until the 10-second penalty window closes.
    // Any rival still racing then cannot finish ahead of the player's adjusted time.
    if (this.raceTime < this.player.finishTime) {
      setTimeout(() => this.showResults(penalty), 200);
      return;
    }
    const rows = this.cars.map((c) => ({ c, t: c.finished ? c.finishTime : null }))
      .sort((a, b) => a.t === null ? (b.t === null ? b.c.progress - a.c.progress : 1)
        : b.t === null ? -1 : a.t - b.t);
    const pos = rows.findIndex((r) => r.c.isPlayer) + 1;
    const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`;
    const res = { position: pos, time: this.player.finishTime, bestLap: this.player.bestLap, penalty, correct: this.questions.correct, perfectStop: !!this.perfectStop, pitted: this.player.pit.done };
    const reward = this.onFinish(res);
    const winner = rows[0].t;
    this.hud.modal(`<div class="tag">CHEQUERED FLAG · ${this.circuit.name.toUpperCase()}</div>
      <h2>${pos === 1 ? 'YOU WIN! 🏆' : pos <= 3 ? `Podium! P${pos} 🥈` : `You finished P${pos}`}</h2>
      <table class="results">${rows.map((r, k) => `<tr class="${r.c.isPlayer ? 'me' : ''}"><td>P${k + 1}</td><td><i style="background:${r.c.team.livery.base}"></i>${r.c.driver.name}</td><td>${r.c.team.name}</td><td>${r.t === null ? 'Still racing' : k === 0 ? fmt(r.t) : '+' + (r.t - winner).toFixed(3) + 's'}${r.c.isPlayer && penalty ? ' (incl. 10s penalty)' : ''}</td></tr>`).join('')}</table>
      <p>Best lap ${this.player.bestLap ? fmt(this.player.bestLap) : '—'} · Maths answers right first time: ${this.questions.correct}/${this.questions.asked}</p>
      <p class="reward">+${reward} points</p>
      <div class="row center"><button data-act="menu">BACK TO GARAGE</button><button class="ghost" data-act="restart">RACE AGAIN</button></div>`, {
      menu: () => this.onQuit('menu'), restart: () => this.onQuit('restart'),
    });
  }

  // ---------- visuals ----------
  updateVisuals(dt, running) {
    const p = this.player;
    for (const c of this.cars) {
      c.mesh.position.set(c.x, 0, c.z);
      c.mesh.rotation.y = c.yaw;
      // slight body roll/pitch for weight transfer
      const body = c.mesh.userData.body;
      body.rotation.z = THREE.MathUtils.lerp(body.rotation.z, clamp(c.steer * c.v * 0.004, -0.03, 0.03), 0.2);
      animateCar(c.mesh, {
        speed: running ? c.v : 0, steer: c.steer, dt: running ? dt : 0,
        drs: c.isPlayer ? c.boost : (c.v > 75 && T_ahead(this.track, c)),
        rainOn: !!c.pit.state || (c.isPlayer && p.inPit), time: this.time,
      });
    }
    for (const crew of this.scenery.crews) crew.update(this.time);
    if (this.scenery.boxMarker) {
      this.scenery.boxMarker.visible = !p.pit.done;
      this.scenery.boxMarker.material.opacity = 0.35 + Math.sin(this.time * 5) * 0.2;
    }
    this.scenery.update(dt);
    const lit = this.state === 'lights' ? this.litCount : 0;
    this.scenery.startLights.forEach((m, k) => { m.emissiveIntensity = k < lit ? 9 : 0; });
    this.updateCamera(dt);
    // sound
    const gearInfo = gearFor(p.v);
    p.gear = gearInfo.gear; p.rpm = gearInfo.rpm;
    if (this.state === 'grid' || this.state === 'lights') { p.rpm = 4000 + (this.keys.up ? 7000 : 0) * (0.85 + Math.random() * 0.15); }
    this.audio.update({ rpm: p.rpm, throttle: p.throttleIn || 0, speed: Math.abs(p.v), slide: p.slide + (p.surf?.kerb ? 0.15 : 0), paused: this.paused || (this.hud.modalOpen && this.state !== 'finished') });
    this.hud.update(dt);
  }

  updateCamera(dt) {
    const p = this.player, m = p.mesh, cam = this.camera, T = this.track;
    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    let mode = this.camMode;
    if (p.pit.state === 'stopped') mode = 'pit';
    if (this.state === 'grid') mode = 'grid';
    this.shake = Math.max(0, (this.shake || 0) - dt * 2);
    const kerbShake = p.surf?.kerb ? 0.03 : 0;
    const sh = (this.shake * 0.25 + kerbShake) * (Math.random() - 0.5);
    let fov = 64;
    if (mode === 'chase' || mode === 'far') {
      const back = mode === 'far' ? 11 : 7.2, up = mode === 'far' ? 3.6 : 2.25;
      const want = m.position.clone().addScaledVector(fwd, -back).add(new THREE.Vector3(0, up, 0));
      if (!this.camInit || cam.position.distanceTo(want) > 60) { cam.position.copy(want); this.camInit = true; }
      cam.position.lerp(want, 1 - Math.exp(-dt * 9));
      cam.position.y = want.y + sh;
      const look = m.position.clone().addScaledVector(fwd, 6).add(new THREE.Vector3(0, 0.95, 0));
      cam.lookAt(look);
      fov = 60 + Math.abs(p.v) / 92 * 16;
    } else if (mode === 'tcam') {
      cam.position.copy(m.localToWorld(new THREE.Vector3(0, 1.2 + sh * 0.3, -1.05)));
      cam.lookAt(m.localToWorld(new THREE.Vector3(0, 0.82, 12)));
      fov = 72 + Math.abs(p.v) / 92 * 6;
    } else if (mode === 'cockpit') {
      cam.position.copy(m.localToWorld(new THREE.Vector3(0, 0.95 + sh * 0.3, 0.02)));
      cam.lookAt(m.localToWorld(new THREE.Vector3(0, 0.8, 12)));
      fov = 76;
    } else if (mode === 'pit') {
      const b = T.boxS[p.box], P = T.pit;
      cam.position.copy(T.point(b + 7, P.side * (P.boxLat - 6))).add(new THREE.Vector3(0, 3.2, 0));
      cam.lookAt(m.position.x, 0.5, m.position.z); fov = 55;
      this.camInit = false;
    } else if (mode === 'grid') {
      const t = this.stateT;
      const side = new THREE.Vector3(-fwd.z, 0, fwd.x);
      cam.position.copy(m.position).addScaledVector(fwd, 6 - t * 4).addScaledVector(side, 3.5).add(new THREE.Vector3(0, 1.2 + t * 0.5, 0));
      cam.lookAt(m.position.x, 0.6, m.position.z); fov = 50;
      this.camInit = false;
    }
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 4); cam.updateProjectionMatrix(); }
    // shadows follow the player
    this.sun.target.position.copy(m.position);
    this.sun.position.copy(m.position).addScaledVector(this.sunDir, 220);
  }

  render() {
    if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.disposed = true;
    removeEventListener('keydown', this.onKeyDown); removeEventListener('keyup', this.onKeyUp);
    removeEventListener('blur', this.onBlur); removeEventListener('resize', this.onResize);
    this.audio.stop();
    this.hud.dispose();
    this.scene.traverse((o) => { o.geometry?.dispose?.(); });
    this.composer?.dispose?.();
    this.renderer.dispose(); this.renderer.forceContextLoss?.();
    this.renderer.domElement.remove();
  }
}

function T_ahead(track, c) { return track.profileAt(c.s + 60, c.prof) > c.v + 3; }

// 8-speed gearbox approximation for the HUD and engine sound.
const GEAR_TOP = [0, 22, 33, 44, 54, 64, 74, 84, 999];
export function gearFor(v) {
  const av = Math.abs(v);
  if (v < -0.3) return { gear: 'R', rpm: 5000 + av * 300 };
  if (av < 0.5) return { gear: 'N', rpm: 4000 };
  let g = 1; while (g < 8 && av > GEAR_TOP[g]) g++;
  const lo = g === 1 ? 0 : GEAR_TOP[g - 1], hi = g === 8 ? 96 : GEAR_TOP[g];
  return { gear: g, rpm: 6500 + clamp((av - lo) / (hi - lo), 0, 1) * 5500 };
}
