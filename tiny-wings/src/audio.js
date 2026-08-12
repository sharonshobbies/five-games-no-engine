// All sound is synthesised with WebAudio — no files. A continuous wind/whoosh layer
// tracks speed, a soft pad chord shifts per island, and one-shots mark landings,
// launches, coins, great slides and fever.

export class Audio {
  constructor() {
    this.ok = false;
    this.ctx = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return this.ok;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
    } catch (e) {
      return false;
    }
    const c = this.ctx;

    this.master = c.createGain();
    this.master.gain.value = 0.55;
    this.master.connect(c.destination);

    // ---- wind: filtered noise whose cutoff + gain follow speed ----
    const len = Math.floor(c.sampleRate * 2);
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      last = last * 0.55 + w * 0.45;
      d[i] = last;
    }
    this.noise = c.createBufferSource();
    this.noise.buffer = buf;
    this.noise.loop = true;
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.frequency.value = 520;
    this.windFilter.Q.value = 0.7;
    this.windGain = c.createGain();
    this.windGain.gain.value = 0;
    this.noise.connect(this.windFilter).connect(this.windGain).connect(this.master);
    this.noise.start();

    // ---- pad: three detuned saw-ish oscillators through a lowpass ----
    this.padGain = c.createGain();
    this.padGain.gain.value = 0.0;
    this.padFilter = c.createBiquadFilter();
    this.padFilter.type = 'lowpass';
    this.padFilter.frequency.value = 900;
    this.padGain.connect(this.padFilter).connect(this.master);
    this.padOsc = [];
    for (let i = 0; i < 3; i++) {
      const o = c.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      const g = c.createGain();
      g.gain.value = 0.33;
      o.connect(g).connect(this.padGain);
      o.start();
      this.padOsc.push(o);
    }
    this.setChord(0);
    this.padGain.gain.setTargetAtTime(0.10, c.currentTime, 1.5);

    this.ok = true;
    return true;
  }

  setChord(islandIndex) {
    if (!this.ok) return;
    // a gentle major-ish triad that rotates through keys per island
    const roots = [130.81, 146.83, 164.81, 174.61, 196.0, 110.0, 123.47, 138.59];
    const r = roots[islandIndex % roots.length];
    const freqs = [r, r * 1.5, r * 2.5];
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      this.padOsc[i].frequency.setTargetAtTime(freqs[i], t, 0.8);
    }
  }

  /** Continuous layer, called every frame. */
  setMotion(speed, grounded, dark) {
    if (!this.ok || this.muted) return;
    const t = this.ctx.currentTime;
    const s = Math.min(1, speed / 1000);
    const g = s * s * (grounded ? 0.20 : 0.13);
    this.windGain.gain.setTargetAtTime(g, t, 0.08);
    this.windFilter.frequency.setTargetAtTime(320 + s * 2100 + (grounded ? 240 : 0), t, 0.08);
    this.padFilter.frequency.setTargetAtTime(500 + (1 - dark) * 900, t, 1.0);
  }

  _env(node, t0, a, d, peak) {
    node.gain.cancelScheduledValues(t0);
    node.gain.setValueAtTime(0.0001, t0);
    node.gain.exponentialRampToValueAtTime(peak, t0 + a);
    node.gain.exponentialRampToValueAtTime(0.0001, t0 + a + d);
  }

  tone(freq, { type = 'sine', a = 0.005, d = 0.18, peak = 0.22, slideTo = null, delay = 0 } = {}) {
    if (!this.ok || this.muted) return;
    const c = this.ctx, t0 = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + a + d);
    o.connect(g).connect(this.master);
    this._env(g, t0, a, d, peak);
    o.start(t0);
    o.stop(t0 + a + d + 0.05);
  }

  noiseBurst({ d = 0.18, peak = 0.25, freq = 900, q = 1.0, delay = 0, type = 'bandpass' } = {}) {
    if (!this.ok || this.muted) return;
    const c = this.ctx, t0 = c.currentTime + delay;
    const src = c.createBufferSource();
    src.buffer = this.noise.buffer;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = c.createGain();
    src.connect(f).connect(g).connect(this.master);
    this._env(g, t0, 0.006, d, peak);
    src.start(t0);
    src.stop(t0 + d + 0.1);
  }

  land(impact, quality) {
    const f = 150 + quality * 220;
    this.noiseBurst({ d: 0.13 + impact * 0.0004, peak: 0.10 + Math.min(0.16, impact * 0.0011), freq: f + 400, q: 0.8 });
    this.tone(f, { type: 'sine', d: 0.10, peak: 0.10 });
  }

  bounce(impact) {
    this.tone(220, { type: 'square', d: 0.07, peak: 0.05, slideTo: 130 });
    this.noiseBurst({ d: 0.09, peak: 0.09, freq: 700, q: 0.6 });
  }

  launch(speed) {
    const s = Math.min(1, speed / 900);
    this.tone(300 + s * 260, { type: 'triangle', d: 0.24, peak: 0.13, slideTo: 700 + s * 700 });
    this.noiseBurst({ d: 0.22, peak: 0.06, freq: 1400, q: 0.5 });
  }

  coin() {
    this.tone(1318, { type: 'sine', d: 0.09, peak: 0.10 });
    this.tone(1975, { type: 'sine', d: 0.11, peak: 0.07, delay: 0.045 });
  }

  cloud() {
    this.noiseBurst({ d: 0.32, peak: 0.10, freq: 2400, q: 0.4, type: 'highpass' });
    this.tone(880, { type: 'sine', d: 0.3, peak: 0.07, slideTo: 1760 });
  }

  greatSlide(chain) {
    const base = 523.25 * Math.pow(2, Math.min(4, chain - 1) / 12 * 2);
    [0, 4, 7, 12].forEach((semi, i) => {
      this.tone(base * Math.pow(2, semi / 12), { type: 'triangle', d: 0.26, peak: 0.11, delay: i * 0.055 });
    });
  }

  fever() {
    [0, 4, 7, 12, 16, 19].forEach((semi, i) => {
      this.tone(392 * Math.pow(2, semi / 12), { type: 'sine', d: 0.4, peak: 0.13, delay: i * 0.06 });
    });
    this.noiseBurst({ d: 0.7, peak: 0.07, freq: 3200, q: 0.3, type: 'highpass' });
  }

  splash(strength) {
    this.noiseBurst({ d: 0.35, peak: 0.10 + strength * 0.10, freq: 1300, q: 0.4 });
    this.tone(160, { type: 'sine', d: 0.25, peak: 0.09, slideTo: 70 });
  }

  island() {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
      this.tone(f, { type: 'triangle', d: 0.42, peak: 0.13, delay: i * 0.09 }));
  }

  gameOver() {
    if (!this.ok) return;
    this.windGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.4);
    [392, 349.23, 293.66, 261.63].forEach((f, i) =>
      this.tone(f, { type: 'sine', d: 0.7, peak: 0.15, delay: i * 0.18 }));
  }
}
