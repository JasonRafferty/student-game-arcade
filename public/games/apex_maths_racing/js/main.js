// Menus, garage (with 3D car preview), quests, save data and starting races.
import * as THREE from 'three';
import { CIRCUITS } from './track.js';
import { CIRCUIT_DATA } from './circuitData.js';
import { CARS, TEAMS, DIFFICULTY, POINTS_FOR_POSITION } from './data.js';
import { buildCar } from './carModel.js';
import { Race } from './race.js';
import { LIVERIES, FINISHES, isUnlocked, requirement, playerTeam, defaultDesign, designColours } from './liveries.js';
import { liveryPreviewURL } from './textures.js';

const $ = (id) => document.getElementById(id);
const today = () => new Date().toLocaleDateString('en-CA');

// ---------- save data ----------
const DEFAULT_SETTINGS = { laps: 3, difficulty: 'rookie', time: 'day', assist: true, racingLine: true, camera: 'chase', quality: 'high' };
let save;
try { save = JSON.parse(localStorage.apexMaths || 'null'); } catch { save = null; }
save = Object.assign({ points: 0, owned: [0], car: 0, engine: 0, tyres: 0, ers: 0, crew: 0, races: 0, correct: 0, daily: '',
  questRace: false, questMath: false, questPodium: false, questWin: false, questMonaco: false, questPerfect: false, questChampion: false,
  podiums: 0, wins: 0, best: {}, track: 0 }, save || {});
save.settings = Object.assign({}, DEFAULT_SETTINGS, save.settings || {});
save.design = Object.assign(defaultDesign(), save.design || {});
save.liveries ||= []; save.finishes ||= ['gloss', 'matte']; save.seenLiveries ||= ['factory'];
if (save.car >= CARS.length) save.car = 0;
const persist = () => { try { localStorage.apexMaths = JSON.stringify(save); } catch { /* storage unavailable */ } };
const fmt = (t) => `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}`;

// ---------- menu rendering ----------
function circuitSvg(id) {
  const pts = CIRCUIT_DATA[id].points;
  const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const pad = 60;
  const d = 'M' + pts.map(([x, z]) => `${(x - minX + pad).toFixed(0)},${(z - minZ + pad).toFixed(0)}`).join(' L') + ' Z';
  return `<svg viewBox="0 0 ${maxX - minX + pad * 2} ${maxZ - minZ + pad * 2}" preserveAspectRatio="xMidYMid meet"><path d="${d}" fill="none" stroke="rgba(0,0,0,.5)" stroke-width="44" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="currentColor" stroke-width="22" stroke-linejoin="round"/></svg>`;
}

function render() {
  $('points').textContent = `${save.points} PTS`;
  const S = save.settings;
  $('tracks').innerHTML = CIRCUITS.map((c, i) => `
    <button class="circuit ${save.track === i ? 'selected' : ''}" data-track="${i}">
      <div class="c-map">${circuitSvg(c.id)}</div>
      <div class="c-info"><div class="tag">${c.flag} ${c.country}</div><h3>${c.name}</h3><p class="small">${c.desc}</p>
      <div class="small">${c.length} · ${c.turns} turns · Best lap <b>${save.best[c.id] ? fmt(save.best[c.id]) : '—'}</b></div></div>
    </button>`).join('');
  document.querySelectorAll('[data-track]').forEach((b) => b.onclick = () => { save.track = +b.dataset.track; persist(); render(); });

  const seg = (key, opts) => `<div class="seg">${opts.map(([v, l]) => `<button data-set="${key}" data-val="${v}" class="${String(S[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  $('settings').innerHTML = `
    <label>Laps ${seg('laps', [[2, '2'], [3, '3'], [5, '5']])}</label>
    <label>Rivals ${seg('difficulty', Object.entries(DIFFICULTY).map(([k, d]) => [k, d.label]))}</label>
    <label>Time ${seg('time', [['day', 'Day'], ['night', 'Night']])}</label>
    <label>Braking assist ${seg('assist', [[true, 'On'], [false, 'Off']])}</label>
    <label>Racing line ${seg('racingLine', [[true, 'Show'], [false, 'Hide']])}</label>
    <label>Camera ${seg('camera', [['chase', 'Chase'], ['tcam', 'T-cam'], ['cockpit', 'Cockpit']])}</label>
    <label>Graphics ${seg('quality', [['high', 'High'], ['low', 'Fast']])}</label>`;
  document.querySelectorAll('[data-set]').forEach((b) => b.onclick = () => {
    let v = b.dataset.val; if (v === 'true') v = true; else if (v === 'false') v = false; else if (/^\d+$/.test(v)) v = +v;
    save.settings[b.dataset.set] = v; persist(); render();
  });

  $('cars').innerHTML = CARS.map((c, i) => {
    const t = TEAMS[c.team], owned = save.owned.includes(i);
    return `<div class="card carcard ${save.car === i ? 'selected' : ''}"><div class="swatch" style="background:linear-gradient(90deg,${t.livery.base} 60%,${t.livery.accent} 60% 80%,${t.livery.stripe} 80%)"></div>
      <h3>${c.name}</h3><p class="small">${t.name} · #${t.number}</p><p class="small">${c.blurb}</p>
      <div class="stats"><span>Top speed ${Math.round(c.vmax * 3.6)} km/h</span><span>Grip ${Math.round(c.grip * 100)}</span></div>
      <button data-car="${i}">${save.car === i ? 'SELECTED' : owned ? 'SELECT' : `UNLOCK · ${c.price} PTS`}</button></div>`;
  }).join('');
  document.querySelectorAll('[data-car]').forEach((b) => b.onclick = () => chooseCar(+b.dataset.car));

  const ups = [['engine', 'Engine', '+3 km/h top speed per level'], ['tyres', 'Tyres', 'More grip in corners'], ['ers', 'ERS battery', 'Longer boost'], ['crew', 'Pit crew', 'Faster pit stops']];
  $('upgrades').innerHTML = ups.map(([k, name, desc]) => {
    const lvl = save[k], cost = 200 * (lvl + 1);
    return `<div class="upgrade"><b>${name}</b><div class="pips">${[0, 1, 2, 3, 4].map((n) => `<i class="${n < lvl ? 'on' : ''}"></i>`).join('')}</div><small>${desc}</small>
      <button data-up="${k}" ${lvl >= 5 ? 'disabled' : ''}>${lvl >= 5 ? 'MAX' : `UPGRADE · ${cost} PTS`}</button></div>`;
  }).join('');
  document.querySelectorAll('[data-up]').forEach((b) => b.onclick = () => upgrade(b.dataset.up));

  renderDesigner();

  const quests = [
    ['daily', 'Daily reward', 'Collect 150 points once per day.', 150, save.daily !== today(), save.daily === today()],
    ['questRace', 'Race finisher', 'Finish your first race.', 200, save.races >= 1, save.questRace],
    ['questMath', 'Pit wall genius', `Answer 3 pit-stop questions right first time (${Math.min(3, save.correct)}/3).`, 300, save.correct >= 3, save.questMath],
    ['questPerfect', 'Lightning stop', 'Do a pit stop in under 2.5 seconds.', 250, save.perfectDone, save.questPerfect],
    ['questPodium', 'Podium place', 'Finish in the top 3.', 300, save.podiums >= 1, save.questPodium],
    ['questWin', 'Race winner', 'Win a race.', 500, save.wins >= 1, save.questWin],
    ['questMonaco', 'King of Monaco', 'Win at Monaco.', 600, save.monacoWin, save.questMonaco],
    ['questChampion', 'World Champion', 'Win a race on Champion difficulty.', 1000, save.championWin, save.questChampion],
  ];
  $('questCards').innerHTML = quests.map(([k, name, desc, pts, ready, claimed]) => `
    <div class="card quest ${claimed ? 'done' : ready ? 'ready' : ''}"><h3>${name}</h3><p class="small">${desc}</p>
    <button data-claim="${k}" data-pts="${pts}" ${!ready || claimed ? 'disabled' : ''}>${claimed ? 'CLAIMED ✓' : `CLAIM ${pts} PTS`}</button></div>`).join('');
  document.querySelectorAll('[data-claim]').forEach((b) => b.onclick = () => {
    const k = b.dataset.claim;
    if (k === 'daily') save.daily = today(); else save[k] = true;
    save.points += +b.dataset.pts; persist(); render();
  });
  updatePreviewCar();
}

function toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2200); }
function chooseCar(i) {
  if (!save.owned.includes(i)) {
    if (save.points < CARS[i].price) return toast('Not enough points yet — race, answer questions and claim quests!');
    save.points -= CARS[i].price; save.owned.push(i);
  }
  save.car = i; persist(); render();
}
function upgrade(k) {
  const cost = 200 * (save[k] + 1);
  if (save[k] >= 5) return;
  if (save.points < cost) return toast('Not enough points yet.');
  save.points -= cost; save[k]++; persist(); render();
}

document.querySelectorAll('[data-tab]').forEach((b) => b.onclick = () => {
  document.querySelectorAll('[data-tab], .panel').forEach((e) => e.classList.remove('active'));
  b.classList.add('active'); $(b.dataset.tab).classList.add('active');
  preview.active = b.dataset.tab === 'garage';
});

// ---------- livery designer ----------
function renderDesigner() {
  const d = save.design, team = playerTeam(save), cols = designColours(save);
  $('designer').innerHTML = `
    <div class="field"><b>Colours</b><div class="swatches">
      ${['Main', 'Accent', 'Detail'].map((n, k) => `<label><input type="color" data-col="${k}" value="${cols[k]}">${n}</label>`).join('')}
      <button class="ghost" id="resetCols">RESET</button></div></div>
    <div class="field"><b>Paint finish</b><div class="finishes">
      ${Object.entries(FINISHES).map(([k, f]) => { const owned = save.finishes.includes(k); return `<button data-finish="${k}" class="${team.livery.finish === k ? 'on' : owned ? '' : 'locked'}">${f.name}${owned ? '' : ` 🔒 ${f.price}`}</button>`; }).join('')}
    </div></div>
    <div class="field"><b>Car number</b><input class="numinput" id="carNum" type="number" min="1" max="99" value="${team.number}"></div>
    <p class="small">Drag the car to spin it. Win races, answer maths questions and earn points to unlock more designs.</p>`;
  document.querySelectorAll('[data-col]').forEach((inp) => {
    inp.onchange = () => { const c = designColours(save).slice(); c[+inp.dataset.col] = inp.value; save.design.colours = c; persist(); render(); };
  });
  $('resetCols').onclick = () => { save.design.colours = null; persist(); render(); };
  document.querySelectorAll('[data-finish]').forEach((b) => b.onclick = () => {
    const k = b.dataset.finish, f = FINISHES[k];
    if (!save.finishes.includes(k)) {
      if (save.points < f.price) return toast(`${f.name} paint costs ${f.price} points.`);
      save.points -= f.price; save.finishes.push(k); toast(`${f.name} paint unlocked!`);
    }
    save.design.finish = k; persist(); render();
  });
  $('carNum').onchange = (e) => { const n = Math.max(1, Math.min(99, Math.round(+e.target.value) || 1)); save.design.number = n; persist(); render(); };

  const base = TEAMS[CARS[save.car].team];
  $('liveries').innerHTML = LIVERIES.map((l) => {
    const unlocked = isUnlocked(l, save), cols = l.colours || [base.livery.base, base.livery.accent, base.livery.stripe];
    const url = liveryPreviewURL({ livery: { base: cols[0], accent: cols[1], stripe: cols[2], pattern: l.pattern } });
    const isNew = unlocked && !save.seenLiveries.includes(l.id);
    return `<button class="livery ${d.id === l.id ? 'on' : ''} ${unlocked ? '' : 'locked'} ${isNew ? 'new' : ''}" data-livery="${l.id}">
      <div class="thumb" style="background-image:url(${url})">${unlocked ? '' : '<div class="lock">🔒</div>'}</div>
      <div class="info"><h3>${l.name}</h3><div class="small">${l.blurb}</div>
      ${unlocked ? (d.id === l.id ? '<div class="req">EQUIPPED</div>' : isNew ? '<div class="req">NEW! Tap to equip</div>' : '') : `<div class="req">🔒 ${requirement(l, save)}</div>`}</div></button>`;
  }).join('');
  document.querySelectorAll('[data-livery]').forEach((b) => b.onclick = () => {
    const l = LIVERIES.find((x) => x.id === b.dataset.livery);
    if (!isUnlocked(l, save)) {
      if (!l.unlock.points) return toast(`Locked: ${l.unlock.text}`);
      if (save.points < l.unlock.points) return toast(`${l.name} costs ${l.unlock.points} points.`);
      save.points -= l.unlock.points; save.liveries.push(l.id); toast(`${l.name} unlocked! 🎉`);
    }
    if (!save.seenLiveries.includes(l.id)) save.seenLiveries.push(l.id);
    save.design.id = l.id; save.design.colours = null;
    if (l.finish) { if (!save.finishes.includes(l.finish)) save.finishes.push(l.finish); save.design.finish = l.finish; }
    persist(); render();
  });
}

// ---------- garage 3D preview ----------
const preview = { active: false };
function initPreview() {
  const canvas = $('carPreview');
  const r = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 0.95; r.shadowMap.enabled = true;
  const scene = new THREE.Scene();
  const env = new THREE.Scene();
  env.background = new THREE.Color(0x1a1f29);
  for (const [x, y, z, w, h] of [[0, 8, 0, 12, 4], [10, 4, 4, 2, 6], [-10, 4, -4, 2, 6]]) {
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide }));
    panel.position.set(x, y, z); panel.lookAt(0, 0, 0); env.add(panel);
  }
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(env, 0.03).texture;
  scene.environmentIntensity = 1.5;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.5); key.position.set(4, 8, 5); key.castShadow = true; key.shadow.bias = -0.0005; key.shadow.normalBias = 0.02;
  Object.assign(key.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(key);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(5, 64), new THREE.MeshStandardMaterial({ color: 0x1b2230, roughness: 0.35, metalness: 0.4 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
  const ring = new THREE.Mesh(new THREE.RingGeometry(4.9, 5.0, 64), new THREE.MeshBasicMaterial({ color: 0xe10600 })); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.01; scene.add(ring);
  const cam = new THREE.PerspectiveCamera(32, 2, 0.1, 100); cam.position.set(6.5, 2.6, 6.5); cam.lookAt(0, 0.45, 0);
  const turn = new THREE.Group(); scene.add(turn);
  Object.assign(preview, { r, scene, cam, turn, canvas });
  let drag = null, spin = 0.6;
  canvas.addEventListener('pointerdown', (e) => { drag = e.clientX; });
  addEventListener('pointerup', () => { drag = null; });
  addEventListener('pointermove', (e) => { if (drag !== null) { turn.rotation.y += (e.clientX - drag) * 0.01; drag = e.clientX; } });
  const tick = () => {
    requestAnimationFrame(tick);
    if (!preview.active || document.hidden || $('menu').style.display === 'none') return;
    const w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * Math.min(devicePixelRatio, 2))) { r.setPixelRatio(Math.min(devicePixelRatio, 2)); r.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix(); }
    if (drag === null) turn.rotation.y += 0.004 * spin;
    r.render(scene, cam);
  };
  tick();
}
function updatePreviewCar() {
  if (!preview.turn) return;
  const team = playerTeam(save), key = JSON.stringify([save.car, team.livery, team.number]);
  const l = LIVERIES.find((x) => x.id === save.design.id) || LIVERIES[0];
  $('previewName').innerHTML = `${CARS[save.car].name} <small>${l.name.toUpperCase()} · #${team.number} · ${FINISHES[team.livery.finish].name.toUpperCase()}</small>`;
  if (preview.key === key) return;
  preview.key = key;
  preview.turn.clear();
  const car = buildCar(team, { compound: 'soft' });
  car.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  preview.turn.add(car);
}

// ---------- racing ----------
// URL options used for automated testing, e.g. ?autostart&autopilot&low&t=1&night
function testOverrides() {
  const q = new URLSearchParams(location.search), o = {};
  if (q.has('autopilot')) o.autopilot = true;
  if (q.has('low')) o.quality = 'low';
  if (q.has('night')) o.time = 'night';
  if (q.has('cam')) o.camera = q.get('cam');
  if (q.has('laps')) o.laps = +q.get('laps');
  if (q.has('ff')) o.ff = +q.get('ff');
  return o;
}
if (new URLSearchParams(location.search).has('t')) save.track = +new URLSearchParams(location.search).get('t');
let race = null;
function startRace() {
  $('menu').style.display = 'none';
  $('loading').classList.add('show');
  setTimeout(() => {
    try {
      race = new Race({
        container: $('raceRoot'), circuit: CIRCUITS[save.track], settings: { ...save.settings, ...testOverrides() }, save,
        onSave: persist, onFinish: finishRace, onQuit: quitRace,
      });
      $('raceRoot').classList.add('show');
      window.__race = race; // handy for debugging in the browser console
    } catch (err) {
      console.error(err); $('menu').style.display = ''; toast('Could not start the race: ' + err.message);
    } finally { $('loading').classList.remove('show'); }
  }, 50);
}
function finishRace(res) {
  const id = CIRCUITS[save.track].id;
  const before = LIVERIES.filter((l) => isUnlocked(l, save)).map((l) => l.id);
  let reward = POINTS_FOR_POSITION[res.position - 1] ?? 100;
  if (save.settings.difficulty === 'pro') reward = Math.round(reward * 1.25);
  if (save.settings.difficulty === 'champion') reward = Math.round(reward * 1.6);
  save.points += reward; save.races++;
  if (res.position <= 3) save.podiums++;
  if (res.position === 1) { save.wins++; if (id === 'monaco') save.monacoWin = true; if (save.settings.difficulty === 'champion') save.championWin = true; }
  if (res.perfectStop) save.perfectDone = true;
  if (res.bestLap && (!save.best[id] || res.bestLap < save.best[id])) save.best[id] = res.bestLap;
  save.newUnlocks = LIVERIES.filter((l) => isUnlocked(l, save) && !before.includes(l.id)).map((l) => l.name);
  persist();
  return reward;
}
function quitRace(next) {
  race?.dispose(); race = null;
  $('raceRoot').classList.remove('show');
  if (next === 'restart') return startRace();
  $('menu').style.display = '';
  render();
  if (save.newUnlocks?.length) { toast(`🎨 New livery unlocked: ${save.newUnlocks.join(', ')}! See the Garage.`); save.newUnlocks = []; persist(); }
}
$('start').onclick = startRace;

initPreview();
render();
if (location.search.includes('autostart')) startRace();
