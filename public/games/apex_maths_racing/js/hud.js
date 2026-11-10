// F1 TV-style heads-up display: timing tower, lap timer, speed/gear/RPM, ERS, tyres, minimap, start lights, messages, modals.
import { TYRES } from './carModel.js';

const fmt = (t) => (t > 0 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(3).padStart(6, '0')}` : '-:--.---');

export class Hud {
  constructor(container, race) {
    this.race = race;
    this.root = document.createElement('div');
    this.root.className = 'hud';
    this.root.innerHTML = `
      <div class="tower"><div class="tower-head"><span class="f1">LAP</span> <b id="hLap">1/3</b></div><div id="hTower"></div></div>
      <div class="timer"><div class="pos" id="hPos">P6</div><div><div class="t-now" id="hNow">0:00.000</div><div class="t-sub"><span>LAST <b id="hLast">-:--.---</b></span><span>BEST <b id="hBest">-:--.---</b></span></div></div></div>
      <div class="lights" id="hLights">${'<div class="lcol"><i></i><i></i></div>'.repeat(5)}</div>
      <div class="banner" id="hMsg"></div>
      <div class="lapflash" id="hFlash"></div>
      <div class="dash">
        <div class="tyrebox"><div class="tyre-ring" id="hTyre">M</div><div><div class="small">TYRES</div><b id="hWear">100%</b><div class="small">DAMAGE <b id="hDmg">0%</b></div></div></div>
        <div class="speedo"><div class="rpm"><i id="hRpm"></i></div><div class="speed-row"><b id="hSpeed">0</b><span>KM/H</span><div class="gear" id="hGear">N</div></div>
          <div class="ers"><span>ERS</span><div class="ersbar"><i id="hErs"></i></div><span id="hBoost" class="boost">BOOST</span></div></div>
        <div class="status" id="hStatus"></div>
      </div>
      <canvas class="minimap" id="hMap" width="240" height="240"></canvas>
      <div class="keys">↑↓←→ drive · SPACE boost · C camera · R reset · ESC pause</div>
      <div class="overlay" id="hOverlay"><div class="modal" id="hModal"></div></div>`;
    container.appendChild(this.root);
    this.el = {};
    for (const n of this.root.querySelectorAll('[id]')) this.el[n.id] = n;
    this.modalOpen = false;
    this.msgT = 0; this.flashT = 0; this.towerT = 0;
    this.buildMap();
  }

  q(id) { return this.el[id]; }

  buildMap() {
    const T = this.race.track;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (let i = 0; i < T.n; i++) { minX = Math.min(minX, T.x[i]); maxX = Math.max(maxX, T.x[i]); minZ = Math.min(minZ, T.z[i]); maxZ = Math.max(maxZ, T.z[i]); }
    const size = 210, sc = size / Math.max(maxX - minX, maxZ - minZ);
    const ox = 15 + (size - (maxX - minX) * sc) / 2, oy = 15 + (size - (maxZ - minZ) * sc) / 2;
    this.mapT = (x, z) => [ox + (x - minX) * sc, oy + (z - minZ) * sc];
    const c = document.createElement('canvas'); c.width = c.height = 240; const g = c.getContext('2d');
    g.lineJoin = g.lineCap = 'round';
    const path = (lat = 0) => { g.beginPath(); for (let i = 0; i <= T.n; i += 2) { const p = T.point(i * T.ds, lat); const [x, y] = this.mapT(p.x, p.z); i ? g.lineTo(x, y) : g.moveTo(x, y); } g.closePath(); };
    g.strokeStyle = 'rgba(0,0,0,.6)'; g.lineWidth = 9; path(); g.stroke();
    g.strokeStyle = '#e9eef5'; g.lineWidth = 4.5; path(); g.stroke();
    // pit lane
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 2; g.beginPath();
    for (let r = T.pit.from; r <= T.pit.to; r += 4) { const p = T.point(r, T.pit.side * T.pitOffset(r)); const [x, y] = this.mapT(p.x, p.z); r === T.pit.from ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke();
    const p0 = T.point(0), p1 = T.point(0, 9), p2 = T.point(0, -9);
    const [a, b] = this.mapT(p1.x, p1.z), [c2, d] = this.mapT(p2.x, p2.z);
    g.strokeStyle = '#e10600'; g.lineWidth = 3; g.beginPath(); g.moveTo(a, b); g.lineTo(c2, d); g.stroke(); void p0;
    this.mapBase = c;
    this.mapCtx = this.el.hMap.getContext('2d');
  }

  message(text, secs = 2) { this.el.hMsg.textContent = text; this.el.hMsg.classList.add('show'); this.msgT = secs; }
  lapFlash(t, best) { this.el.hFlash.innerHTML = `LAP ${fmt(t)}${best ? ' <span>PERSONAL BEST</span>' : ''}`; this.el.hFlash.classList.add('show'); this.flashT = 3; }

  modal(html, actions = {}) {
    this.el.hModal.innerHTML = html;
    this.el.hOverlay.classList.add('show');
    this.modalOpen = true;
    this.el.hModal.querySelectorAll('[data-act]').forEach((b) => { const f = actions[b.dataset.act]; if (f) b.onclick = f; });
  }
  closeModal() { this.el.hOverlay.classList.remove('show'); this.modalOpen = false; }

  update(dt) {
    const R = this.race, p = R.player, e = this.el;
    // timer
    if (this.msgT > 0) { this.msgT -= dt; if (this.msgT <= 0) e.hMsg.classList.remove('show'); }
    if (this.flashT > 0) { this.flashT -= dt; if (this.flashT <= 0) e.hFlash.classList.remove('show'); }
    e.hLap.textContent = `${Math.max(1, Math.min(R.totalLaps, p.laps + 1))}/${R.totalLaps}`;
    e.hNow.textContent = fmt(R.state === 'racing' || R.state === 'finished' ? R.raceTime - p.lapStart : 0);
    e.hLast.textContent = fmt(p.lastLap); e.hBest.textContent = fmt(p.bestLap);
    e.hPos.textContent = `P${p.position || 6}`;
    // speedo
    e.hSpeed.textContent = Math.round(Math.abs(p.v) * 3.6);
    e.hGear.textContent = p.gear ?? 'N';
    const rpmPct = Math.max(0, Math.min(1, ((p.rpm || 4000) - 4000) / 8000));
    e.hRpm.style.width = `${rpmPct * 100}%`;
    e.hRpm.className = rpmPct > 0.92 ? 'red' : rpmPct > 0.75 ? 'amber' : '';
    e.hErs.style.width = `${p.ers * 100}%`;
    e.hBoost.classList.toggle('on', !!p.boost);
    // tyres
    const t = TYRES[p.compound];
    e.hTyre.textContent = t.name[0]; e.hTyre.style.borderColor = t.colour;
    const wear = Math.round((1 - p.wear) * 100);
    e.hWear.textContent = `${wear}%`; e.hWear.className = wear < 40 ? 'bad' : wear < 65 ? 'warn' : '';
    e.hDmg.textContent = `${Math.round(p.damage)}%`;
    // status line
    let status = '';
    if (p.inPit) status = '<span class="pitlim">PIT LIMITER 80</span>';
    else if (!p.pit.done && R.state === 'racing') status = p.laps >= 0 && wear < 55 ? '<span class="warnbox">BOX THIS LAP — tyres worn</span>' : '<span class="small">Pit stop still to do</span>';
    else if (p.pit.done) status = '<span class="good">Pit stop done ✓</span>';
    if (p.surf && ['grass', 'gravel'].includes(p.surf.name) && R.state === 'racing') status = '<span class="warnbox">OFF TRACK</span>';
    if (status !== this.lastStatus) { e.hStatus.innerHTML = status; this.lastStatus = status; }
    // start lights
    const lit = R.state === 'lights' ? R.litCount : 0;
    e.hLights.classList.toggle('show', R.state === 'lights' || R.state === 'grid');
    e.hLights.querySelectorAll('.lcol').forEach((c, k) => c.classList.toggle('on', k < lit));
    // tower (throttled)
    this.towerT -= dt;
    if (this.towerT <= 0 && R.order) {
      this.towerT = 0.25;
      e.hTower.innerHTML = R.order.map((c, k) => {
        let gap = k === 0 ? 'Leader' : c.lapsDown >= 1 ? `+${c.lapsDown} LAP` : c.gap != null ? `+${c.gap.toFixed(1)}` : '';
        if (c.pit.state) gap = 'PIT';
        if (c.finished) gap = '🏁';
        return `<div class="trow ${c.isPlayer ? 'me' : ''}"><span class="tp">${k + 1}</span><i style="background:${c.team.livery.base}"></i><b>${c.driver.code}</b><span class="tyrechip" style="border-color:${TYRES[c.compound].colour}">${TYRES[c.compound].name[0]}</span><span class="tg">${gap}</span></div>`;
      }).join('');
    }
    // minimap
    const g = this.mapCtx; g.clearRect(0, 0, 240, 240); g.drawImage(this.mapBase, 0, 0);
    for (const c of [...R.cars].sort((a, b) => a.isPlayer - b.isPlayer)) {
      const [x, y] = this.mapT(c.x, c.z);
      g.fillStyle = c.team.livery.base; g.strokeStyle = c.isPlayer ? '#ffe600' : '#fff'; g.lineWidth = c.isPlayer ? 3 : 1.5;
      g.beginPath(); g.arc(x, y, c.isPlayer ? 7 : 5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }

  dispose() { this.root.remove(); }
}
