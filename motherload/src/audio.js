// WebAudio synthesis. No sample files: every sound is generated.
//
// Three nodes deep: every cue lands on `sfxBus`, the sequencer in music.js
// lands on `musicBus`, and both feed `master`, which the options screen drives.

import { settings } from "./settings.js";

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.sfxBus = null;
    this.musicBus = null;
    this.drillGain = null;
    this.thrustGain = null;
    this.noiseBuf = null;
  }

  ensure() {
    if (this.ctx) return this.ctx;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this.enabled = false; return null; }
    try {
      this.ctx = new AC();
    } catch { this.enabled = false; return null; }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.sfxBus = c.createGain();
    this.musicBus = c.createGain();
    this.sfxBus.connect(this.master);
    this.musicBus.connect(this.master);
    this.applySettings();

    // shared white-noise buffer
    const len = c.sampleRate * 1.5;
    this.noiseBuf = c.createBuffer(1, len, c.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // continuous drill loop (gain-gated)
    this.drill = this.makeLoop(320, "sawtooth", 900);
    this.thrust = this.makeNoiseLoop(700);
    return c;
  }

  /** Push the options-screen values into the three gain stages. */
  applySettings() {
    if (!this.master) return;
    const t = this.ctx.currentTime;
    const m = settings.muted ? 0 : settings.master;
    this.master.gain.setTargetAtTime(m, t, 0.02);
    this.sfxBus.gain.setTargetAtTime(settings.sfx, t, 0.02);
    this.musicBus.gain.setTargetAtTime(settings.music, t, 0.05);
  }

  makeLoop(freq, type, filterHz) {
    const c = this.ctx;
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const lfo = c.createOscillator();
    lfo.frequency.value = 26;
    const lfoGain = c.createGain();
    lfoGain.gain.value = 90;
    lfo.connect(lfoGain).connect(osc.frequency);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterHz;
    const g = c.createGain();
    g.gain.value = 0;
    osc.connect(f).connect(g).connect(this.sfxBus);
    osc.start(); lfo.start();
    return { gain: g, osc, filter: f };
  }

  makeNoiseLoop(filterHz) {
    const c = this.ctx;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = filterHz;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start();
    return { gain: g, filter: f };
  }

  resume() {
    const c = this.ensure();
    if (c && c.state === "suspended") c.resume().catch(() => {});
  }

  setDrill(on, pitch = 1) {
    if (!this.ctx || !this.drill) return;
    const t = this.ctx.currentTime;
    this.drill.gain.gain.setTargetAtTime(on ? 0.10 : 0, t, 0.05);
    this.drill.osc.frequency.setTargetAtTime(230 * pitch, t, 0.1);
  }

  setThrust(level) {
    if (!this.ctx || !this.thrust) return;
    const t = this.ctx.currentTime;
    this.thrust.gain.gain.setTargetAtTime(level * 0.13, t, 0.04);
    this.thrust.filter.frequency.setTargetAtTime(500 + level * 900, t, 0.08);
  }

  blip(freq, dur = 0.09, type = "square", vol = 0.16) {
    const c = this.ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.value = 0;
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0006, c.currentTime + dur);
    o.connect(g).connect(this.sfxBus);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  sweep(f0, f1, dur = 0.3, type = "sine", vol = 0.18) {
    const c = this.ensure();
    if (!c) return;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, c.currentTime);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), c.currentTime + dur);
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0006, c.currentTime + dur);
    o.connect(g).connect(this.sfxBus);
    o.start();
    o.stop(c.currentTime + dur + 0.02);
  }

  noiseBurst(dur = 0.5, filterFrom = 2400, filterTo = 120, vol = 0.5) {
    const c = this.ensure();
    if (!c) return;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(filterFrom, c.currentTime);
    f.frequency.exponentialRampToValueAtTime(filterTo, c.currentTime + dur);
    const g = c.createGain();
    g.gain.setValueAtTime(vol, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0006, c.currentTime + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start();
    src.stop(c.currentTime + dur + 0.05);
  }

  // ---- named cues -----------------------------------------------------------
  pickup(value) {
    const n = Math.min(6, Math.max(0, Math.log10(Math.max(10, value)) - 1));
    this.blip(520 + n * 190, 0.07, "square", 0.13);
    setTimeout(() => this.blip(760 + n * 240, 0.08, "square", 0.11), 55);
  }
  explosion() { this.noiseBurst(0.75, 2200, 70, 0.55); this.sweep(120, 34, 0.5, "sine", 0.3); }
  hit() { this.noiseBurst(0.18, 1400, 200, 0.3); this.blip(140, 0.1, "sawtooth", 0.14); }
  sell() {
    [660, 880, 1170].forEach((f, i) => setTimeout(() => this.blip(f, 0.1, "square", 0.12), i * 80));
  }
  buy() { this.blip(880, 0.06, "square", 0.12); setTimeout(() => this.blip(1320, 0.09, "square", 0.1), 60); }
  deny() { this.blip(180, 0.16, "sawtooth", 0.13); }
  death() { this.sweep(420, 40, 1.1, "sawtooth", 0.24); this.noiseBurst(1.0, 1200, 60, 0.4); }
  teleport() { this.sweep(200, 1800, 0.45, "sine", 0.2); this.noiseBurst(0.35, 600, 3000, 0.15); }
  discovery() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.28, "triangle", 0.14), i * 130));
  }
  alarm() { this.blip(1000, 0.09, "square", 0.09); setTimeout(() => this.blip(700, 0.09, "square", 0.09), 110); }
}
