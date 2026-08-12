// audio.js -- all sound is synthesised with WebAudio; no audio files.
// A warm pentatonic bell for merges (pitch rises with tier), soft plucks for
// spawns, a chime for healing, a whoosh for pickups.

const PENT = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24, 26, 28, 31, 33, 36];

export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.musicOn = true;
    this._musicT = 0;
    this._musicStep = 0;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return null; }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      // gentle bus compression via a soft waveshaper
      const shaper = this.ctx.createWaveShaper();
      const n = 1024, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * 2 - 1;
        curve[i] = Math.tanh(x * 1.4) * 0.85;
      }
      shaper.curve = curve;
      this.master.connect(shaper);
      shaper.connect(this.ctx.destination);
      this.reverb = this.makeReverb();
    } catch (e) { this.enabled = false; }
    return this.ctx;
  }

  makeReverb() {
    const ctx = this.ctx;
    try {
      const conv = ctx.createConvolver();
      const len = Math.floor(ctx.sampleRate * 1.4);
      const buf = ctx.createBuffer(2, len, ctx.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) {
          data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
        }
      }
      conv.buffer = buf;
      const wet = ctx.createGain();
      wet.gain.value = 0.24;
      conv.connect(wet);
      wet.connect(this.master);
      return conv;
    } catch (e) { return null; }
  }

  resume() {
    const c = this.ensure();
    if (c && c.state === 'suspended') c.resume();
  }

  tone(freq, dur, type = 'sine', gain = 0.2, when = 0, sweep = 0, reverb = 0.3) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (sweep) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * sweep), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(this.master);
    if (this.reverb && reverb > 0) {
      const rg = ctx.createGain(); rg.gain.value = gain * reverb;
      g.connect(rg); rg.connect(this.reverb);
    }
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  noise(dur, gain = 0.12, hp = 800, when = 0) {
    if (!this.enabled) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t0 = ctx.currentTime + when;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp;
    const g = ctx.createGain(); g.gain.value = gain;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0);
  }

  note(semi, dur, type, gain, when, reverb) {
    this.tone(261.63 * Math.pow(2, semi / 12), dur, type, gain, when, 0, reverb);
  }

  // --- game events --------------------------------------------------------
  merge(tier, five, combo = 0) {
    const base = PENT[Math.min(PENT.length - 1, tier)] + combo * 2;
    this.note(base, 0.5, 'triangle', 0.2, 0, 0.4);
    this.note(base + 7, 0.42, 'sine', 0.14, 0.045, 0.4);
    this.note(base + 12, 0.6, 'sine', 0.11, 0.09, 0.5);
    if (five) {
      this.note(base + 16, 0.5, 'triangle', 0.13, 0.16, 0.5);
      this.note(base + 19, 0.6, 'sine', 0.1, 0.22, 0.5);
    }
    this.noise(0.12, 0.05, 2200);
  }

  pluck(tier = 0) {
    this.note(PENT[Math.min(PENT.length - 1, tier)] + 12, 0.16, 'triangle', 0.1, 0, 0.2);
  }
  pickup() { this.tone(520, 0.09, 'sine', 0.08, 0, 1.5, 0.1); this.noise(0.05, 0.03, 3000); }
  drop() { this.tone(300, 0.11, 'sine', 0.1, 0, 0.7, 0.15); }
  heal() {
    for (let i = 0; i < 4; i++) this.note(PENT[i + 4], 0.7, 'sine', 0.09, i * 0.06, 0.6);
    this.noise(0.4, 0.03, 1800);
  }
  coin() { this.tone(1180, 0.07, 'square', 0.05); this.tone(1560, 0.1, 'square', 0.04, 0.05); }
  fire() { this.noise(0.16, 0.09, 500); this.tone(180, 0.16, 'sawtooth', 0.07, 0, 0.4, 0.1); }
  chest() {
    this.noise(0.2, 0.07, 700);
    for (let i = 0; i < 5; i++) this.note(PENT[i] + 12, 0.5, 'triangle', 0.1, i * 0.05, 0.5);
  }
  star() { for (let i = 0; i < 3; i++) this.note(PENT[i + 6], 0.6, 'sine', 0.11, i * 0.07, 0.6); }
  hatch() {
    this.noise(0.1, 0.07, 1500);
    this.note(PENT[3], 0.3, 'triangle', 0.14, 0, 0.3);
    this.note(PENT[6], 0.45, 'sine', 0.12, 0.1, 0.4);
  }
  fanfare() {
    const seq = [0, 4, 7, 12, 16, 19];
    seq.forEach((s, i) => this.note(s, 0.7, 'triangle', 0.14, i * 0.1, 0.55));
  }
  deny() { this.tone(160, 0.13, 'sawtooth', 0.06, 0, 0.7, 0.05); }

  // --- ambient music: slow arpeggio over a warm pad ------------------------
  updateMusic(dt) {
    if (!this.musicOn || !this.enabled || !this.ctx) return;
    this._musicT += dt;
    if (this._musicT < 1.15) return;
    this._musicT = 0;
    const prog = [[0, 4, 7], [-3, 2, 5], [-5, 0, 4], [2, 5, 9]];
    const chord = prog[Math.floor(this._musicStep / 4) % prog.length];
    const n = chord[this._musicStep % 3];
    const oct = (this._musicStep % 8) < 4 ? 0 : 12;
    this.note(n + oct - 12, 2.4, 'sine', 0.045, 0, 0.8);
    if (this._musicStep % 4 === 0) this.note(chord[0] - 24, 3.2, 'sine', 0.05, 0, 0.5);
    this._musicStep++;
  }
}
