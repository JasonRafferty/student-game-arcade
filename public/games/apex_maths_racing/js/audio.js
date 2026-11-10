// Synthesised V6 hybrid engine, tyre squeal and impact sounds (Web Audio, no files).
export class RaceAudio {
  constructor() {
    this.muted = false;
    try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.ctx = null; return; }
    const c = this.ctx;
    this.master = c.createGain(); this.master.gain.value = 0.35; this.master.connect(c.destination);
    // engine: two detuned saws + square through a lowpass with a little waveshaping
    this.engGain = c.createGain(); this.engGain.gain.value = 0;
    this.filter = c.createBiquadFilter(); this.filter.type = 'lowpass'; this.filter.Q.value = 4;
    const shaper = c.createWaveShaper(); const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = i / 128 - 1; curve[i] = Math.tanh(x * 2.2); }
    shaper.curve = curve;
    this.oscs = [['sawtooth', 1, 0.5], ['sawtooth', 2.005, 0.25], ['square', 0.5, 0.18], ['triangle', 3, 0.12]].map(([type, mul, g]) => {
      const o = c.createOscillator(); o.type = type; const gn = c.createGain(); gn.gain.value = g;
      o.connect(gn); gn.connect(shaper); o.start(); return { o, mul };
    });
    shaper.connect(this.filter); this.filter.connect(this.engGain); this.engGain.connect(this.master);
    // noise source for squeal / turbo whoosh
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    this.noise = c.createBufferSource(); this.noise.buffer = buf; this.noise.loop = true;
    this.squealFilter = c.createBiquadFilter(); this.squealFilter.type = 'bandpass'; this.squealFilter.frequency.value = 1800; this.squealFilter.Q.value = 12;
    this.squealGain = c.createGain(); this.squealGain.gain.value = 0;
    this.noise.connect(this.squealFilter); this.squealFilter.connect(this.squealGain); this.squealGain.connect(this.master);
    this.windFilter = c.createBiquadFilter(); this.windFilter.type = 'lowpass'; this.windFilter.frequency.value = 600;
    this.windGain = c.createGain(); this.windGain.gain.value = 0;
    this.noise.connect(this.windFilter); this.windFilter.connect(this.windGain); this.windGain.connect(this.master);
    this.noise.start();
  }
  resume() { this.ctx?.resume?.(); }
  setMuted(m) { this.muted = m; if (this.master) this.master.gain.value = m ? 0 : 0.35; }
  update({ rpm, throttle, speed, slide, paused }) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime, f = rpm / 60 * 1.5;
    for (const { o, mul } of this.oscs) o.frequency.setTargetAtTime(f * mul, t, 0.03);
    this.filter.frequency.setTargetAtTime(500 + throttle * 2600 + rpm * 0.08, t, 0.05);
    this.engGain.gain.setTargetAtTime(paused ? 0 : 0.18 + throttle * 0.32, t, 0.06);
    this.squealGain.gain.setTargetAtTime(paused ? 0 : Math.min(0.25, slide * 0.3), t, 0.05);
    this.windGain.gain.setTargetAtTime(paused ? 0 : Math.min(0.25, speed / 90 * 0.25), t, 0.1);
  }
  bump(strength = 1) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'triangle'; o.frequency.setValueAtTime(140, c.currentTime); o.frequency.exponentialRampToValueAtTime(40, c.currentTime + 0.25);
    g.gain.setValueAtTime(Math.min(0.8, 0.25 * strength), c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.3);
    o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + 0.32);
  }
  beep(freq = 880, dur = 0.18) {
    if (!this.ctx || this.muted) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0.3, c.currentTime); g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
    o.connect(g); g.connect(this.master); o.start(); o.stop(c.currentTime + dur + 0.02);
  }
  stop() { try { this.ctx?.close(); } catch { /* ignore */ } this.ctx = null; }
}
