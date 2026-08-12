// Synthesised soundtrack. No sample files: a step sequencer over WebAudio
// voices, scheduled with a lookahead against the audio clock so it never
// depends on frame timing.
//
// The original's score is a looping industrial/ambient bed rather than a tune
// you hum, so this is built the same way: a small stack of layers (drone, bass,
// pad, pluck, drums, lead) whose gains and pattern set are chosen by scene.
// Underground the scene is the depth band, so the music darkens as you sink:
// the mode flattens (natural minor -> Phrygian), the tempo drops, the drone
// comes up and the bright layers fade out.

// The Goldium Edition soundtrack is nine tracks -- 66.6 FM, Heavy Industry
// (Alternative Mix), Malfunction, Shop, Wealthonium, Heavy Industry,
// Undergrounds, Nano Tech, Core -- and the depth-tiered shape of that list is
// what the scenes below are named for. The titles are sourced; the arrangements
// are not: no composer is credited anywhere for the 2004 game, and nothing in
// print describes the music beyond those names, so every note here is invented.

const LOOKAHEAD = 0.3;      // seconds of notes scheduled ahead of the clock
const STEPS = 16;           // one bar of sixteenths

/** Equal-temperament offset from a root frequency. */
function nf(root, semis) { return root * Math.pow(2, semis / 12); }

// A layer gain of 0 means "silent but still sequenced", so a band change is a
// crossfade rather than a restart.
const L = ["drone", "bass", "pad", "pluck", "drum", "lead"];

/**
 * Scenes. `scale` is semitone offsets from `root`; `bass`/`pluck`/`lead` are
 * 16-step patterns of scale indices (null = rest). `mix` is the per-layer
 * target gain.
 */
const SCENES = {
  // "Malfunction". Title screen: sparse, wide, waiting.
  menu: {
    root: 110, bpm: 78, mode: [0, 2, 3, 7, 10],
    mix: { drone: 0.35, bass: 0.30, pad: 0.60, pluck: 0.16, drum: 0, lead: 0.22 },
    bass:  [0, null, null, null, 3, null, null, null, 0, null, null, null, 2, null, null, null],
    pluck: [null, null, 4, null, null, null, 3, null, null, null, 4, null, null, 2, null, null],
    lead:  [4, null, null, 3, null, null, 2, null, null, null, 0, null, null, null, null, null],
    chords: [[0, 3, 7], [0, 3, 7], [-2, 2, 5], [-2, 2, 5]],
    kick: [], hat: [], snare: [],
  },
  // "Shop". Daylight, four shopfronts, nothing trying to kill you.
  surface: {
    root: 146.83, bpm: 108, mode: [0, 2, 3, 5, 7, 9, 10],
    mix: { drone: 0.10, bass: 0.42, pad: 0.34, pluck: 0.30, drum: 0.34, lead: 0.26 },
    bass:  [0, null, 0, null, 4, null, null, 2, 3, null, 3, null, 4, null, 2, null],
    pluck: [7, null, 5, 4, null, 5, null, 7, 9, null, 7, 5, null, 4, null, null],
    lead:  [null, null, null, null, 11, null, null, 9, null, null, 7, null, null, null, null, null],
    chords: [[0, 3, 7], [3, 7, 10], [5, 9, 12], [-2, 3, 7]],
    kick: [0, 6, 8, 14], hat: [2, 4, 6, 10, 12, 14], snare: [4, 12],
  },
  // "Undergrounds". -0 to -1,500 ft: the loop that plays for most of a session.
  shallow: {
    root: 130.81, bpm: 100, mode: [0, 2, 3, 5, 7, 8, 10],
    mix: { drone: 0.22, bass: 0.46, pad: 0.40, pluck: 0.22, drum: 0.18, lead: 0.14 },
    bass:  [0, null, null, 0, 5, null, null, null, 3, null, null, 3, 7, null, 5, null],
    pluck: [null, 7, null, null, 10, null, null, 7, null, 5, null, null, 7, null, null, null],
    lead:  [null, null, null, null, null, null, 10, null, null, null, null, null, 7, null, null, null],
    chords: [[0, 3, 7], [0, 3, 7], [5, 8, 12], [3, 7, 10]],
    kick: [0, 8], hat: [4, 12], snare: [],
  },
  // "Heavy Industry". -1,500 to -3,500 ft. Rock starts here, and so does a pulse.
  deep: {
    root: 123.47, bpm: 94, mode: [0, 2, 3, 5, 6, 8, 10],
    mix: { drone: 0.34, bass: 0.50, pad: 0.36, pluck: 0.16, drum: 0.30, lead: 0.12 },
    bass:  [0, null, 0, null, 0, null, 6, null, 5, null, 5, null, 3, null, null, null],
    pluck: [null, null, null, 10, null, null, null, null, null, null, 8, null, null, null, 6, null],
    lead:  [null, null, null, null, null, null, null, null, 10, null, null, 8, null, null, null, null],
    chords: [[0, 3, 6], [0, 3, 6], [5, 8, 10], [3, 6, 10]],
    kick: [0, 5, 8, 11], hat: [2, 6, 10, 14], snare: [8],
  },
  // "Nano Tech". -3,500 to -5,000 ft. Gas country: Phrygian second, drone forward.
  abyss: {
    root: 110, bpm: 86, mode: [0, 1, 3, 5, 6, 8, 10],
    mix: { drone: 0.52, bass: 0.48, pad: 0.30, pluck: 0.10, drum: 0.22, lead: 0.10 },
    bass:  [0, null, null, null, 1, null, null, null, 0, null, null, 6, 5, null, null, null],
    pluck: [null, null, null, null, null, null, 8, null, null, null, null, null, null, 6, null, null],
    lead:  [null, null, null, null, null, null, null, null, null, null, 13, null, null, null, 12, null],
    chords: [[0, 3, 6], [1, 5, 8], [0, 3, 6], [-1, 3, 6]],
    kick: [0, 6, 10], hat: [3, 11], snare: [],
  },
  // "Core". Below -5,000 ft. He is jamming the altimeter and he knows you are coming.
  core: {
    root: 98, bpm: 76, mode: [0, 1, 3, 4, 6, 8, 9],
    mix: { drone: 0.70, bass: 0.44, pad: 0.24, pluck: 0.06, drum: 0.16, lead: 0.08 },
    bass:  [0, null, null, null, null, null, 1, null, 0, null, null, null, 6, null, null, null],
    pluck: [null, null, null, null, null, null, null, null, null, null, null, 6, null, null, null, null],
    lead:  [null, null, null, null, null, null, null, null, null, null, null, null, null, 13, null, null],
    chords: [[0, 3, 6], [0, 3, 6], [1, 4, 8], [0, 3, 6]],
    kick: [0, 9], hat: [], snare: [],
  },
  // "66.6 FM". -66,666 ft.
  boss: {
    root: 87.31, bpm: 148, mode: [0, 1, 3, 6, 7, 8, 11],
    mix: { drone: 0.40, bass: 0.62, pad: 0.20, pluck: 0.34, drum: 0.52, lead: 0.36 },
    bass:  [0, 0, null, 0, 3, null, 0, null, 0, 0, null, 6, 3, null, 1, null],
    pluck: [null, 11, null, 11, null, 10, null, 11, null, 7, null, 6, null, 3, null, 6],
    lead:  [14, null, null, 13, null, null, 11, null, 10, null, null, null, 6, null, null, null],
    chords: [[0, 3, 6], [0, 3, 6], [1, 6, 8], [0, 3, 7]],
    kick: [0, 3, 6, 8, 11, 14], hat: [1, 2, 4, 5, 7, 9, 10, 12, 13, 15], snare: [4, 12],
  },
  // "Wealthonium". The estate is yours.
  victory: {
    root: 174.61, bpm: 116, mode: [0, 2, 4, 5, 7, 9, 11],
    mix: { drone: 0.06, bass: 0.40, pad: 0.42, pluck: 0.36, drum: 0.30, lead: 0.40 },
    bass:  [0, null, 0, null, 5, null, null, 4, 3, null, 3, null, 0, null, 4, null],
    pluck: [7, 9, 11, 12, null, 11, 9, 7, 9, 11, 12, 14, null, 12, 11, 9],
    lead:  [12, null, null, 11, null, 9, null, null, 7, null, null, 9, null, null, 11, null],
    chords: [[0, 4, 7], [5, 9, 12], [3, 7, 10], [0, 4, 7]],
    kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], snare: [4, 12],
  },
};

/** Depth (ft) -> underground scene name. */
export function sceneForDepth(depthFt) {
  if (depthFt < 30) return "surface";
  if (depthFt < 1500) return "shallow";
  if (depthFt < 3500) return "deep";
  if (depthFt < 5000) return "abyss";
  return "core";
}

export class Music {
  constructor(audio) {
    this.audio = audio;
    this.scene = null;
    this.sceneName = null;
    this.pendingScene = null;
    this.step = 0;
    this.bar = 0;
    this.nextTime = 0;
    this.gains = {};      // live layer gain, eased toward the scene's mix
    this.targets = {};
    for (const k of L) { this.gains[k] = 0; this.targets[k] = 0; }
    this.started = false;
    this.notesScheduled = 0;    // diagnostic: proof the sequencer is running
  }

  /**
   * Ask for a scene. Layer gains crossfade immediately; the pattern set and
   * key swap at the next bar line, so a depth change never stutters the loop.
   */
  setScene(name) {
    if (!SCENES[name] || name === this.sceneName) return;
    if (!this.scene) {
      this.sceneName = name;
      this.scene = SCENES[name];
      this.bar = 0;
      this.step = 0;
    } else {
      this.pendingScene = name;
    }
    const mix = SCENES[name].mix;
    for (const k of L) this.targets[k] = mix[k] || 0;
  }

  stop() {
    for (const k of L) this.targets[k] = 0;
  }

  /** Called every frame. Eases gains and schedules whatever is due. */
  update(dt) {
    const a = this.audio;
    for (const k of L) {
      const d = this.targets[k] - this.gains[k];
      this.gains[k] += d * Math.min(1, dt * 1.6);
    }
    const c = a.ctx;
    if (!c || c.state !== "running" || !a.musicBus || !this.scene) return;
    if (!this.started) {
      this.started = true;
      this.nextTime = c.currentTime + 0.08;
    }
    // Guard against a long tab stall: never try to catch up on a backlog.
    if (this.nextTime < c.currentTime - 0.5) this.nextTime = c.currentTime + 0.05;

    let budget = 64;   // hard cap on notes per frame
    while (this.nextTime < c.currentTime + LOOKAHEAD && budget-- > 0) {
      this.scheduleStep(this.nextTime);
      const spb = 60 / this.scene.bpm / 4;
      this.nextTime += spb;
      this.step++;
      if (this.step >= STEPS) {
        this.step = 0;
        this.bar = (this.bar + 1) % 4;
        if (this.pendingScene) {
          this.sceneName = this.pendingScene;
          this.scene = SCENES[this.pendingScene];
          this.pendingScene = null;
          this.bar = 0;
        }
      }
    }
  }

  // ---- one sixteenth ---------------------------------------------------------
  scheduleStep(t) {
    this.notesScheduled++;
    const s = this.scene;
    const step = this.step;
    const spb = 60 / s.bpm / 4;
    const deg = (pat) => (pat && pat[step] != null ? pat[step] : null);
    const pitch = (i) => nf(s.root, s.mode[((i % s.mode.length) + s.mode.length) % s.mode.length]
      + 12 * Math.floor(i / s.mode.length));

    if (this.gains.bass > 0.02) {
      const d = deg(s.bass);
      if (d !== null) this.bassNote(t, pitch(d) / 2, spb * 3.2, this.gains.bass);
    }
    if (this.gains.pluck > 0.02) {
      const d = deg(s.pluck);
      if (d !== null) this.pluck(t, pitch(d) * 2, spb * 2.2, this.gains.pluck);
    }
    if (this.gains.lead > 0.02) {
      const d = deg(s.lead);
      if (d !== null) this.lead(t, pitch(d), spb * 5, this.gains.lead);
    }
    if (this.gains.drum > 0.02) {
      if (s.kick.includes(step)) this.kick(t, this.gains.drum);
      if (s.hat.includes(step)) this.hat(t, this.gains.drum * 0.5);
      if (s.snare.includes(step)) this.snare(t, this.gains.drum * 0.7);
    }
    // Pad and drone are re-struck once a bar, not per step.
    if (step === 0) {
      const chord = s.chords[this.bar % s.chords.length];
      if (this.gains.pad > 0.02) {
        for (const semi of chord) {
          this.padNote(t, nf(s.root, semi), spb * STEPS * 1.05, this.gains.pad / chord.length);
        }
      }
      if (this.gains.drone > 0.02) {
        this.drone(t, s.root / 2, spb * STEPS * 1.1, this.gains.drone);
      }
    }
  }

  // ---- voices ----------------------------------------------------------------
  get bus() { return this.audio.musicBus; }

  env(t, dur, peak, attack = 0.004, curve = 0.0008) {
    const c = this.audio.ctx;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(curve, t + dur);
    return g;
  }

  bassNote(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(freq, t);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 7 + 180, t);
    f.frequency.exponentialRampToValueAtTime(freq * 2.2 + 90, t + dur);
    f.Q.value = 4;
    const g = this.env(t, dur, 0.24 * vol, 0.008);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  padNote(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const g = this.env(t, dur, 0.13 * vol, dur * 0.28, 0.0006);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1400;
    for (const det of [-5, 6]) {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq * Math.pow(2, det / 1200);
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.05);
    }
    f.connect(g).connect(this.bus);
  }

  pluck(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 4 + 900, t);
    f.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = this.env(t, dur, 0.075 * vol);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  lead(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.value = freq;
    // a slow vibrato so a held note does not sit dead
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.2;
    const lg = c.createGain();
    lg.gain.value = freq * 0.006;
    lfo.connect(lg).connect(o.frequency);
    const g = this.env(t, dur, 0.11 * vol, 0.05, 0.0006);
    o.connect(g).connect(this.bus);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  drone(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const g = this.env(t, dur, 0.16 * vol, dur * 0.3, 0.0006);
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 340;
    for (const mul of [1, 1.004, 1.5]) {
      const o = c.createOscillator();
      o.type = mul === 1.5 ? "triangle" : "sine";
      o.frequency.value = freq * mul;
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.06);
    }
    f.connect(g).connect(this.bus);
  }

  kick(t, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(44, t + 0.13);
    const g = this.env(t, 0.2, 0.5 * vol, 0.002);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + 0.24);
  }

  noise(t, dur, type, hz, peak, q = 1) {
    const c = this.audio.ctx;
    const src = c.createBufferSource();
    src.buffer = this.audio.noiseBuf;
    src.playbackRate.value = 1;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q;
    const g = this.env(t, dur, peak, 0.001);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, Math.random() * 0.9);
    src.stop(t + dur + 0.02);
  }

  hat(t, vol) { this.noise(t, 0.035, "highpass", 7000, 0.10 * vol); }
  snare(t, vol) {
    this.noise(t, 0.10, "bandpass", 1700, 0.20 * vol, 0.8);
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(210, t);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.08);
    const g = this.env(t, 0.09, 0.10 * vol, 0.002);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + 0.12);
  }
}
