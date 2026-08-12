// All sound is synthesised at runtime — a few oscillator/noise voices plus a
// two-chord ambient bed that swaps between day and night.
export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.lastAt = new Map();
    this.musicNodes = [];
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return null; }
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      this.sfxBus = this.ctx.createGain();
      this.sfxBus.gain.value = 0.85;
      this.sfxBus.connect(this.master);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.35;
      this.musicBus.connect(this.master);
      this.noiseBuf = this.makeNoise();
    } catch (e) { this.enabled = false; }
    return this.ctx;
  }

  resume() { const c = this.ensure(); if (c && c.state === 'suspended') c.resume(); }
  setVolume(v) { if (this.master) this.master.gain.value = v; }

  makeNoise() {
    const ctx = this.ctx;
    const b = ctx.createBuffer(1, ctx.sampleRate * 0.7, ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  tone(freq, dur, type, gain, slideTo, delay) {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + Math.min(0.02, dur * 0.2));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(dur, gain, freq, q, delay) {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    const t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource();
    s.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = freq || 900;
    f.Q.value = q || 1.2;
    const g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  }

  play(name, vol) {
    if (!this.enabled) return;
    const v = vol == null ? 1 : vol;
    const now = performance.now();
    const gate = { bow: 45, hit: 55, slash: 60, cannon: 90, catapult: 110, boom: 70, crumble: 120 }[name];
    if (gate) {
      const last = this.lastAt.get(name) || 0;
      if (now - last < gate) return;
      this.lastAt.set(name, now);
    }
    switch (name) {
      case 'bow': this.noise(0.09, 0.10 * v, 2400, 2.5); break;
      case 'hit': this.noise(0.06, 0.13 * v, 700, 1.4); this.tone(180, 0.05, 'square', 0.05 * v); break;
      case 'slash': this.noise(0.12, 0.12 * v, 1500, 1.1, 0); this.tone(320, 0.08, 'triangle', 0.06 * v, 180); break;
      case 'cannon': this.noise(0.3, 0.22 * v, 260, 0.8); this.tone(80, 0.28, 'sawtooth', 0.14 * v, 40); break;
      case 'catapult': this.noise(0.2, 0.14 * v, 420, 0.9); break;
      case 'boom': this.noise(0.55, 0.3 * v, 180, 0.6); this.tone(60, 0.5, 'sine', 0.2 * v, 28); break;
      case 'crumble': this.noise(0.7, 0.2 * v, 340, 0.5); break;
      case 'build': this.tone(440, 0.09, 'square', 0.09); this.tone(660, 0.1, 'square', 0.08, null, 0.08); break;
      case 'upgrade':
        this.tone(523, 0.09, 'square', 0.09); this.tone(659, 0.09, 'square', 0.09, null, 0.08);
        this.tone(784, 0.14, 'square', 0.09, null, 0.16); break;
      case 'coin': this.tone(1100, 0.06, 'square', 0.06); this.tone(1500, 0.08, 'square', 0.05, null, 0.05); break;
      case 'nightStart':
        this.tone(160, 0.7, 'sawtooth', 0.14, 110);
        this.tone(80, 1.1, 'sine', 0.16, 60, 0.05);
        this.noise(0.9, 0.06, 420, 0.5, 0.1); break;
      case 'dawn':
        [392, 494, 587, 784].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.09, null, i * 0.11)); break;
      case 'ability': this.tone(300, 0.22, 'sawtooth', 0.13, 900); this.noise(0.2, 0.1, 1800, 1.5); break;
      case 'kinghurt': this.tone(220, 0.12, 'sawtooth', 0.1, 120); break;
      case 'kingdown': this.tone(260, 0.9, 'sawtooth', 0.18, 60); this.noise(0.6, 0.12, 300, 0.6); break;
      case 'revive': [523, 659, 880].forEach((f, i) => this.tone(f, 0.35, 'triangle', 0.1, null, i * 0.09)); break;
      case 'win': [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.5, 'triangle', 0.12, null, i * 0.14)); break;
      case 'lose': [400, 340, 280, 200].forEach((f, i) => this.tone(f, 0.6, 'sawtooth', 0.13, null, i * 0.2)); break;
      case 'click': this.tone(720, 0.04, 'square', 0.06); break;
      default: break;
    }
  }

  // --- ambient bed --------------------------------------------------------
  music(mode) {
    const ctx = this.ensure();
    if (!ctx || !this.enabled) return;
    this.stopMusic();
    const chords = mode === 'night'
      ? [[110, 130.81, 164.81], [98, 116.54, 146.83]]
      : [[130.81, 164.81, 196], [146.83, 174.61, 220]];
    const g = ctx.createGain();
    g.gain.value = 0;
    g.gain.linearRampToValueAtTime(mode === 'night' ? 0.16 : 0.12, ctx.currentTime + 2.5);
    g.connect(this.musicBus);
    this.musicGain = g;
    const lfo = ctx.createOscillator();
    const lg = ctx.createGain();
    lfo.frequency.value = 0.05;
    lg.gain.value = 0.35;
    lfo.connect(lg);
    lfo.start();
    this.musicNodes.push(lfo);
    chords.forEach((ch, ci) => {
      ch.forEach((f, i) => {
        const o = ctx.createOscillator();
        o.type = mode === 'night' ? 'sawtooth' : 'triangle';
        o.frequency.value = f * (ci === 0 ? 1 : 1.0);
        const og = ctx.createGain();
        og.gain.value = 0.2 / ch.length;
        const filt = ctx.createBiquadFilter();
        filt.type = 'lowpass';
        filt.frequency.value = mode === 'night' ? 480 : 900;
        lg.connect(og.gain);
        o.connect(filt); filt.connect(og); og.connect(g);
        o.detune.value = (i - 1) * 6 + ci * 4;
        o.start();
        this.musicNodes.push(o);
      });
    });
  }

  stopMusic() {
    if (this.musicGain && this.ctx) {
      try {
        this.musicGain.gain.cancelScheduledValues(this.ctx.currentTime);
        this.musicGain.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.8);
      } catch (e) { /* ignore */ }
    }
    const nodes = this.musicNodes;
    this.musicNodes = [];
    setTimeout(() => { for (const n of nodes) { try { n.stop(); } catch (e) { /* ignore */ } } }, 900);
  }
}
