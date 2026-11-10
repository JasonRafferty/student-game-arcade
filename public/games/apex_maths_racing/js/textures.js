// Procedurally painted textures (no image files needed).
import * as THREE from 'three';

const cache = new Map();
let maxAniso = 8;
export function setMaxAnisotropy(n) { maxAniso = n; }

function rand(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

function make(key, w, h, draw, { repeat = true, srgb = true } = {}) {
  if (cache.has(key)) return cache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = maxAniso;
  cache.set(key, t);
  return t;
}

function noise(g, w, h, r, count, colours, size = [1, 2]) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colours[Math.floor(r() * colours.length)];
    const s = size[0] + r() * (size[1] - size[0]);
    g.fillRect(r() * w, r() * h, s, s);
  }
}

export const tex = {
  asphalt: () => make('asphalt', 512, 512, (g, w, h) => {
    const r = rand(1);
    g.fillStyle = '#45484c'; g.fillRect(0, 0, w, h);
    noise(g, w, h, r, 26000, ['#3a3d41', '#505357', '#5b5e62', '#33363a', '#615f5b'], [1, 2.4]);
    // darker rubbered-in racing groove down the middle
    const grad = g.createLinearGradient(0, 0, w, 0);
    grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(.35, 'rgba(15,15,18,.22)');
    grad.addColorStop(.65, 'rgba(15,15,18,.22)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grad; g.fillRect(0, 0, w, h);
    // repair seams
    g.strokeStyle = 'rgba(25,25,28,.45)'; g.lineWidth = 3;
    for (let i = 0; i < 3; i++) { g.beginPath(); const x = r() * w; g.moveTo(x, 0); g.bezierCurveTo(x + 30, h * .3, x - 30, h * .6, x + 10, h); g.stroke(); }
  }),
  grass: () => make('grass', 512, 512, (g, w, h) => {
    const r = rand(2);
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#4f7f39' : '#5a8d40'; g.fillRect(0, i * h / 8, w, h / 8); }
    noise(g, w, h, r, 30000, ['#46742f', '#64974a', '#3f6a2c', '#6fa052', '#557f3b'], [1, 2]);
  }),
  field: () => make('field', 512, 512, (g, w, h) => {
    const r = rand(3);
    g.fillStyle = '#7f8b45'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 64; i++) { g.fillStyle = i % 2 ? 'rgba(90,100,40,.35)' : 'rgba(160,150,80,.25)'; g.fillRect(i * w / 64, 0, w / 64, h); }
    noise(g, w, h, r, 16000, ['#6d7a3c', '#99984f', '#5f6f35'], [1, 2]);
  }),
  gravel: () => make('gravel', 256, 256, (g, w, h) => {
    const r = rand(4);
    g.fillStyle = '#c9b48c'; g.fillRect(0, 0, w, h);
    noise(g, w, h, r, 14000, ['#b39d74', '#ddcaa3', '#a58e66', '#e8dbbd', '#8f7a57'], [1, 3]);
  }),
  runoff: () => make('runoff', 256, 256, (g, w, h) => {
    const r = rand(5);
    g.fillStyle = '#5b6066'; g.fillRect(0, 0, w, h);
    noise(g, w, h, r, 9000, ['#50555b', '#676c72', '#4a4f55'], [1, 2]);
  }),
  paving: () => make('paving', 256, 256, (g, w, h) => {
    const r = rand(6);
    g.fillStyle = '#a7a39b'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
      const v = 150 + Math.floor(r() * 30);
      g.fillStyle = `rgb(${v},${v - 3},${v - 9})`;
      g.fillRect(x * 32 + 1, y * 32 + 1, 30, 30);
    }
    noise(g, w, h, r, 3000, ['rgba(0,0,0,.08)', 'rgba(255,255,255,.08)'], [1, 2]);
  }),
  kerb: () => make('kerb', 64, 256, (g, w, h) => {
    for (let i = 0; i < 4; i++) { g.fillStyle = i % 2 ? '#f2f0ea' : '#d4232c'; g.fillRect(0, i * h / 4, w, h / 4); }
    g.fillStyle = 'rgba(0,0,0,.12)'; g.fillRect(0, 0, 6, h); g.fillRect(w - 6, 0, 6, h);
  }),
  chequer: () => make('chequer', 256, 64, (g, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 16; x++) { g.fillStyle = (x + y) % 2 ? '#111' : '#f4f4f4'; g.fillRect(x * 16, y * 16, 16, 16); }
  }),
  armco: () => make('armco', 256, 64, (g, w, h) => {
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#7d8487'); grd.addColorStop(.2, '#d5dadc'); grd.addColorStop(.32, '#8e9598');
    grd.addColorStop(.5, '#cfd4d6'); grd.addColorStop(.68, '#8e9598'); grd.addColorStop(.8, '#d5dadc'); grd.addColorStop(1, '#6f7578');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a6063'; for (let x = 0; x < w; x += 64) g.fillRect(x, 0, 4, h);
  }),
  tyreWall: () => make('tyreWall', 256, 128, (g, w, h) => {
    g.fillStyle = '#151515'; g.fillRect(0, 0, w, h);
    for (let row = 0; row < 4; row++) for (let x = 0; x < 8; x++) {
      const cx = x * 32 + 16 + (row % 2) * 4, cy = row * 32 + 16;
      g.fillStyle = '#262626'; g.beginPath(); g.ellipse(cx, cy, 15, 13, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#0c0c0c'; g.beginPath(); g.ellipse(cx, cy, 7, 6, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#e8e8e8'; g.fillRect(0, 44, w, 10); g.fillStyle = '#d4232c'; g.fillRect(0, 76, w, 10);
  }),
  fence: () => make('fence', 128, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.strokeStyle = 'rgba(200,205,210,.9)'; g.lineWidth = 1.4;
    for (let i = -h; i < w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + h, h); g.stroke(); g.beginPath(); g.moveTo(i + h, 0); g.lineTo(i, h); g.stroke(); }
    g.fillStyle = '#5c6266'; g.fillRect(0, 0, 4, h); g.fillRect(0, 0, w, 3);
  }),
  crowd: () => make('crowd', 512, 256, (g, w, h) => {
    const r = rand(7);
    g.fillStyle = '#2b2f36'; g.fillRect(0, 0, w, h);
    const cols = ['#d43a3a', '#f3f3f3', '#2f6bd8', '#f2c230', '#2a9d58', '#ff7f2a', '#9a5ad6', '#111', '#e8b38e', '#c98a5b', '#f15b8a'];
    for (let row = 0; row < 16; row++) {
      g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, row * 16 + 12, w, 4);
      for (let x = 0; x < w; x += 5) {
        if (r() < .12) continue;
        g.fillStyle = cols[Math.floor(r() * cols.length)]; g.fillRect(x, row * 16 + 4, 4, 8);
        g.fillStyle = r() < .5 ? '#e8b38e' : '#8d5a3b'; g.fillRect(x + 1, row * 16 + 1, 2, 3);
      }
    }
  }),
  carbon: () => make('carbon', 128, 128, (g, w, h) => {
    g.fillStyle = '#16181b'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
      g.fillStyle = (x + y) % 2 ? '#202327' : '#111315';
      g.fillRect(x * 8, y * 8, 8, 8);
      g.fillStyle = 'rgba(255,255,255,.04)'; g.fillRect(x * 8, y * 8, (x + y) % 2 ? 8 : 2, (x + y) % 2 ? 2 : 8);
    }
  }),
  window: (palette, night) => make(`win_${palette}_${night}`, 256, 512, (g, w, h) => {
    const r = rand(palette.length * 31 + (night ? 7 : 0) + palette.charCodeAt(1));
    g.fillStyle = palette; g.fillRect(0, 0, w, h);
    noise(g, w, h, r, 2500, ['rgba(0,0,0,.05)', 'rgba(255,255,255,.06)'], [1, 3]);
    for (let fy = 0; fy < 8; fy++) {
      g.fillStyle = 'rgba(255,255,255,.35)'; g.fillRect(0, fy * 64 + 56, w, 4); // floor band
      for (let fx = 0; fx < 4; fx++) {
        const x = fx * 64 + 16, y = fy * 64 + 14;
        const lit = night && r() < .55;
        g.fillStyle = lit ? (r() < .5 ? '#ffd98a' : '#ffefc4') : (r() < .5 ? '#3f5466' : '#2d3d4c');
        g.fillRect(x, y, 32, 36);
        if (!lit) { g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x + 2, y + 2, 10, 32); }
        g.fillStyle = 'rgba(40,40,40,.5)'; g.fillRect(x - 4, y + 36, 40, 4); // balcony
        if (r() < .5) { g.fillStyle = ['#2e6a4f', '#7b4a2e', '#3b5c7a'][fy % 3]; g.fillRect(x - 6, y, 5, 36); g.fillRect(x + 33, y, 5, 36); } // shutters
      }
    }
  }),
  billboard: (text, bg, fg) => make(`bb_${text}_${bg}`, 512, 96, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = fg; g.font = '900 54px system-ui, Helvetica, Arial';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 3);
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, w, 6);
  }),
  label: (text, bg, fg, w = 512, h = 128, font = '900 72px system-ui, Helvetica, Arial') => make(`lbl_${text}_${bg}_${fg}_${w}`, w, h, (g) => {
    if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); } else g.clearRect(0, 0, w, h);
    g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, w / 2, h / 2 + 4);
  }, { repeat: false }),
  sidewall: (band) => make(`sidewall_${band}`, 256, 256, (g, w, h) => {
    g.fillStyle = '#141414'; g.fillRect(0, 0, w, h);
    g.save(); g.translate(w / 2, h / 2);
    g.strokeStyle = band; g.lineWidth = 9; g.beginPath(); g.arc(0, 0, 110, 0.15, Math.PI - 0.15); g.stroke();
    g.beginPath(); g.arc(0, 0, 110, Math.PI + 0.15, Math.PI * 2 - 0.15); g.stroke();
    g.fillStyle = '#e7e7e7'; g.font = '900 22px system-ui, Arial';
    for (const a of [-Math.PI / 2, Math.PI / 2]) {
      g.save(); g.rotate(a); g.textAlign = 'center'; g.fillText('APEX P', 0, -88); g.restore();
    }
    g.restore();
  }, { repeat: false }),
  water: () => make('water', 256, 256, (g, w, h) => {
    const r = rand(9);
    g.fillStyle = '#1d5c7a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) { g.fillStyle = r() < .5 ? 'rgba(255,255,255,.10)' : 'rgba(0,30,50,.18)'; g.fillRect(r() * w, r() * h, 6 + r() * 14, 1.5); }
  }),
};

// Team livery painted onto the lofted body.
// Canvas x: 0 = rear of the car, w = nose. Canvas y: h/2 = top centre, h*0.25 and h*0.75 = the two sides, 0/h = underside.
const SIDES = [0.25, 0.75];
const PATTERNS = {
  classic(g, w, h, { accent, stripe }) {
    g.fillStyle = stripe;
    for (const [lo, hi] of [[0, .2], [.8, 1]]) g.fillRect(0, h * lo, w, h * (hi - lo));
    g.fillStyle = accent;
    for (const v of [0.24, 0.76]) {
      const d = v < .5 ? 1 : -1;
      g.beginPath();
      g.moveTo(0, h * v); g.bezierCurveTo(w * .3, h * (v + d * .02), w * .45, h * (v + d * .12), w * .62, h * (v + d * .16));
      g.lineTo(w * .62, h * (v + d * .2)); g.bezierCurveTo(w * .45, h * (v + d * .15), w * .3, h * (v + d * .05), 0, h * (v + d * .035));
      g.fill();
    }
    g.fillRect(0, h * .493, w, h * .014);
  },
  split(g, w, h, { accent, stripe }) {
    g.fillStyle = accent;
    g.beginPath(); g.moveTo(w * .25, 0); g.lineTo(w * .55, 0); g.lineTo(w * .35, h); g.lineTo(0, h); g.lineTo(0, 0); g.fill();
    g.fillStyle = stripe;
    g.beginPath(); g.moveTo(w * .55, 0); g.lineTo(w * .6, 0); g.lineTo(w * .4, h); g.lineTo(w * .35, h); g.fill();
    g.fillRect(0, h * .49, w, h * .02);
  },
  flames(g, w, h, { accent, stripe }, r) {
    for (const [col, scale] of [[accent, 1], [stripe, 0.6]]) {
      g.fillStyle = col;
      for (const c of [...SIDES, 0.5]) {
        const band = (c === 0.5 ? 0.13 : 0.17) * scale;
        g.beginPath(); g.moveTo(w, h * (c - band));
        const tongues = 7;
        for (let k = 0; k < tongues; k++) {
          const yA = c - band + (2 * band) * (k / tongues), yB = c - band + (2 * band) * ((k + 0.5) / tongues);
          const len = w * (0.35 + r() * 0.35) * (0.7 + 0.3 * scale);
          g.quadraticCurveTo(w - len * 0.6, h * (yA - 0.02), w - len, h * yB);
          g.quadraticCurveTo(w - len * 0.55, h * (yB + 0.03), w - len * 0.15, h * (c - band + 2 * band * ((k + 1) / tongues)));
        }
        g.lineTo(w, h * (c + band)); g.closePath(); g.fill();
      }
    }
  },
  lightning(g, w, h, { accent, stripe }, r) {
    for (const c of [...SIDES, 0.5]) {
      for (const [col, lw] of [[stripe, 26], [accent, 12]]) {
        g.strokeStyle = col; g.lineWidth = lw; g.lineJoin = 'miter';
        g.beginPath(); let x = w * 0.98, y = h * c; g.moveTo(x, y);
        const rr = rand(Math.floor(c * 100));
        while (x > 0) { x -= w * (0.06 + rr() * 0.05); y = h * c + (rr() - 0.5) * h * 0.14; g.lineTo(x, y); }
        g.stroke();
      }
    }
    void r;
  },
  galaxy(g, w, h, { accent, stripe }, r) {
    for (let k = 0; k < 14; k++) {
      const x = r() * w, y = r() * h, rad = 60 + r() * 160;
      const gr = g.createRadialGradient(x, y, 0, x, y, rad);
      const col = k % 2 ? accent : stripe;
      gr.addColorStop(0, col + 'aa'); gr.addColorStop(1, col + '00');
      g.fillStyle = gr; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
    }
    for (let k = 0; k < 900; k++) { g.fillStyle = r() < .8 ? '#ffffff' : '#fff4b0'; const s = r() < .95 ? 1.5 : 3.5; g.fillRect(r() * w, r() * h, s, s); }
  },
  rainbow(g, w, h, { stripe }) {
    for (const c of SIDES) {
      for (let k = 0; k < 7; k++) {
        g.fillStyle = `hsl(${k * 50}, 95%, 55%)`;
        g.fillRect(0, h * (c - 0.105 + k * 0.03), w, h * 0.03);
      }
    }
    g.fillStyle = stripe; g.fillRect(0, h * .47, w, h * .06);
  },
  checker(g, w, h, { accent, stripe }) {
    const sq = 32;
    for (let x = 0; x < w * 0.55; x += sq) for (let y = 0; y < h; y += sq) {
      const fade = 1 - x / (w * 0.55);
      if (((x + y) / sq) % 2 === 0 && Math.random() < 0.25 + fade) { g.fillStyle = accent; g.fillRect(x, y, sq * Math.max(0.3, fade), sq * Math.max(0.3, fade)); }
    }
    g.fillStyle = stripe; for (const c of SIDES) g.fillRect(w * 0.5, h * (c - 0.015), w * 0.5, h * 0.03);
  },
  camo(g, w, h, { accent, stripe }, r) {
    for (const col of [accent, stripe, accent]) {
      g.fillStyle = col;
      for (let k = 0; k < 40; k++) {
        const x = r() * w, y = r() * h; g.beginPath();
        for (let a = 0; a < 7; a++) { const ang = a / 7 * Math.PI * 2, rad = 25 + r() * 45; g[a ? 'lineTo' : 'moveTo'](x + Math.cos(ang) * rad * 1.6, y + Math.sin(ang) * rad); }
        g.fill();
      }
    }
  },
  pixel(g, w, h, { accent, stripe }, r) {
    const sq = 24;
    for (let x = 0; x < w; x += sq) for (let y = 0; y < h; y += sq) {
      const p = (x / w) * 0.9;
      if (r() < p) { g.fillStyle = r() < .6 ? accent : stripe; g.fillRect(x + 1, y + 1, sq - 2, sq - 2); }
    }
  },
  tiger(g, w, h, { accent, stripe }, r) {
    g.fillStyle = accent;
    for (let k = 0; k < 26; k++) {
      const x = (k / 26) * w + r() * 20, top = r() * h * 0.2;
      g.beginPath(); g.moveTo(x, top);
      g.bezierCurveTo(x + 40, h * 0.3, x - 30, h * 0.6, x + 10, h - top);
      g.bezierCurveTo(x - 10, h * 0.6, x + 20, h * 0.3, x - 18, top); g.fill();
    }
    g.fillStyle = stripe; g.fillRect(w * 0.82, h * 0.45, w * 0.18, h * 0.1);
  },
  neon(g, w, h, { accent, stripe }) { neonLines(g, w, h, accent, stripe); },
  riviera(g, w, h, { accent, stripe }) {
    g.fillStyle = accent; g.fillRect(0, 0, w, h * 0.25); g.fillRect(0, h * 0.75, w, h * 0.25);
    g.fillStyle = stripe; for (const y of [0.25, 0.75]) g.fillRect(0, h * (y - 0.012), w, h * 0.024);
    g.fillRect(0, h * .49, w, h * .02);
  },
};
function neonLines(g, w, h, a, b) {
  g.lineWidth = 7;
  for (const [c, col] of [[0.25, a], [0.75, a], [0.5, b]]) {
    g.strokeStyle = col; g.beginPath(); g.moveTo(0, h * c);
    g.lineTo(w * 0.3, h * c); g.lineTo(w * 0.38, h * (c + 0.08)); g.lineTo(w * 0.7, h * (c + 0.08)); g.lineTo(w * 0.78, h * c); g.lineTo(w, h * c); g.stroke();
  }
  g.lineWidth = 3; g.strokeStyle = b;
  for (let x = 40; x < w; x += 110) { g.beginPath(); g.moveTo(x, h * 0.2); g.lineTo(x + 40, h * 0.32); g.stroke(); g.beginPath(); g.moveTo(x, h * 0.8); g.lineTo(x + 40, h * 0.68); g.stroke(); }
}

export function liveryTexture(team) {
  const L = team.livery, pattern = L.pattern || 'classic';
  return make(`livery_${pattern}_${L.base}_${L.accent}_${L.stripe}`, 1024, 512, (g, w, h) => {
    g.fillStyle = L.base; g.fillRect(0, 0, w, h);
    (PATTERNS[pattern] || PATTERNS.classic)(g, w, h, L, rand(pattern.length * 7919 + 3));
    // underside darker
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, 'rgba(0,0,0,.55)'); grd.addColorStop(.16, 'rgba(0,0,0,0)');
    grd.addColorStop(.84, 'rgba(0,0,0,0)'); grd.addColorStop(1, 'rgba(0,0,0,.55)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
  }, { repeat: false });
}
// Emission map for glowing liveries (only the neon pattern glows).
export function liveryGlowTexture(team) {
  const L = team.livery;
  if (L.pattern !== 'neon') return null;
  return make(`glow_${L.accent}_${L.stripe}`, 1024, 512, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); neonLines(g, w, h, L.accent, L.stripe); }, { repeat: false });
}
// Small flat preview of a livery for menu cards.
export function liveryPreviewURL(team) {
  const t = liveryTexture(team);
  return t.image.toDataURL('image/jpeg', 0.7);
}
