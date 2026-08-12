// Thronefall's score, generated in code. No sample files: a step sequencer over
// WebAudio voices, scheduled with a lookahead against the audio clock so it can
// neither drift nor stutter when the frame rate drops under a 130-enemy wave.
//
// The whole score sits on one root, D, and moves by mode instead of by key. The
// realm map is D Aeolian, the build day brightens the same root to Dorian
// (the raised sixth is the only note that changes), the night falls back to
// Aeolian, and a boss night flattens the second to Phrygian. Every transition is
// therefore consonant with the one before it, and the drama comes from mode,
// tempo and instrumentation rather than from modulation. Harmony is modal and
// drone-based — open fifths, no leading-tone dominant — which is the medieval
// colour the flat low-poly look asks for.
//
// Layout of a scene: a 2- or 4-bar phrase of 16th-note patterns, one chord per
// bar, and a per-layer target gain. Layers are always sequenced; a layer at gain
// 0 is silent but still running, so a scene change is a crossfade rather than a
// restart. Pattern swaps and scene swaps only ever land on a bar line.

const LOOKAHEAD = 0.35;     // seconds of notes queued ahead of the audio clock
const STEPS = 16;           // one bar of sixteenths
const EASE = 1.8;           // gain crossfade rate, per second

const LAYERS = ["drone", "pad", "bass", "arp", "lead", "choir", "drum", "pulse"];

const AEOLIAN  = [0, 2, 3, 5, 7, 8, 10];
const DORIAN   = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const MIXO     = [0, 2, 4, 5, 7, 9, 10];

const D3 = 146.83;          // the root every scene is spelled against

/** Equal-temperament offset from a root frequency. */
function nf(root, semis) { return root * Math.pow(2, semis / 12); }

function clamp01(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

/**
 * A 16-step pattern, written as whitespace-separated scale degrees with `.` for
 * a rest. Degrees are indices into the scene's mode and may run past its length
 * or below zero; the octave is worked out from the index.
 */
function p(str) {
  const out = str.trim().split(/\s+/).map((s) => (s === "." ? null : parseInt(s, 10)));
  while (out.length < STEPS) out.push(null);
  return out.slice(0, STEPS);
}

/**
 * Patterns are either one value reused every bar, or an array of per-bar values.
 * Note patterns are arrays of 16 degrees; drum patterns are lists of step
 * indices. Both shapes are told apart the same way: a per-bar pattern is an
 * array whose first element is itself an array.
 */
function patAt(pat, bar) {
  if (!pat) return null;
  return Array.isArray(pat[0]) ? pat[bar % pat.length] : pat;
}

// ---------------------------------------------------------------------- scenes

const SCENES = {
  // The realm map, the title, the loadout. Wide and unhurried: a solo lute over
  // an open fifth, no percussion at all, so nothing here implies a clock.
  realm: {
    root: D3, bpm: 68, mode: AEOLIAN, kit: "frame",
    chords: [[0, 3, 7], [0, 3, 7], [-4, 0, 3], [-2, 2, 5]],   // Dm Dm Bb C
    mix: { drone: 0.50, pad: 0.42, bass: 0.26, arp: 0.20, lead: 0.24, choir: 0, drum: 0, pulse: 0 },
    bass: [
      p("0 . . . . . . . 4 . . . . . . ."),
      p("0 . . . . . . . 4 . . . . . . ."),
      p("5 . . . . . . . 2 . . . . . . ."),
      p("6 . . . . . . . 3 . . . . . . ."),
    ],
    lead: [
      p("0 . . . . . 2 . . . 4 . . . . ."),
      p("3 . . . 2 . . . . . 1 . . . . ."),
      p(". . 4 . . . 5 . . . 4 . . . 2 ."),
      p("1 . . . . . 0 . . . . . . . . ."),
    ],
    arp: [
      p(". . . . . . . . . . . . . . . ."),
      p(". . 7 . . . 9 . . . 7 . . . . ."),
      p(". . . . . . . . . . . . . . . ."),
      p(". . 7 . . . 6 . . . 4 . . . . ."),
    ],
    drums: [{ kick: [], hat: [], snare: [] }],
  },

  // The build day. Same root, raised sixth: the one note that separates this
  // from the realm theme, and it is the whole difference between waiting and
  // working. A running lute figure, a walking bass, an unhurried frame drum.
  day: {
    root: D3, bpm: 84, mode: DORIAN, kit: "frame",
    chords: [[0, 3, 7], [5, 9, 12], [0, 3, 7], [-2, 2, 5]],   // Dm G Dm C
    mix: { drone: 0.20, pad: 0.34, bass: 0.40, arp: 0.34, lead: 0.22, choir: 0, drum: 0.22, pulse: 0 },
    bass: [
      p("0 . . . 4 . . . 0 . . . 2 . . ."),
      p("3 . . . 0 . . . 3 . . . 5 . . ."),
      p("0 . . . 4 . . . 0 . . . 6 . . ."),
      p("6 . . . 3 . . . 6 . . . 4 . . ."),
    ],
    arp: [
      p("4 . 6 . 7 . 6 . 4 . 6 . 4 . 2 ."),
      p("5 . 7 . 9 . 7 . 5 . 4 . 5 . 2 ."),
      p("4 . 6 . 7 . 6 . 4 . 3 . 2 . 0 ."),
      p("6 . 8 . 6 . 5 . 3 . 5 . 6 . 4 ."),
    ],
    lead: [
      p(". . . . . . . . . . . . . . . ."),
      p(". . . . 11 . . . . . 9 . . . . ."),
      p(". . . . . . . . . . . . . . . ."),
      p(". . . . 10 . . . 9 . . . 7 . . ."),
    ],
    drums: [{ kick: [[0, 8], [0, 8], [0, 8], [0, 8, 14]], hat: [4, 12], snare: [] }],
  },

  // The cut. Two bars, hard in and hard out: war drums on the beat, a bell
  // tolling the night, and the bass walking the descending tetrachord D-C-Bb-A.
  // `hard` means the mix snaps at the bar line instead of crossfading, and
  // cueTransition() schedules a drum pickup that lands exactly on that line, so
  // the change arrives on a downbeat you can hear coming.
  nightfall: {
    root: D3, bpm: 84, mode: AEOLIAN, kit: "war", hard: true,
    oneShot: { bars: 2, then: "night" },
    chords: [[0, 3, 7], [0, 3, 7]],
    mix: { drone: 0.50, pad: 0.50, bass: 0.55, arp: 0, lead: 0.34, choir: 0.20, drum: 0.60, pulse: 0 },
    leadVoice: "bell",
    bass: [
      p("0 . . . . . . . 6 . . . . . . ."),
      p("5 . . . . . . . 4 . . . . . . ."),
    ],
    lead: [
      p("0 . . . . . . . . . . . . . . ."),
      p(". . . . . . . . 4 . . . . . . ."),
    ],
    drums: [{
      kick: [[0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
      hat: [[], [6, 14]],
      snare: [[], [14]],
    }],
  },

  // Night combat. Faster than the day and back in Aeolian. Three pattern tiers
  // selected by how hard the night is going; the tier swaps on a bar line, and
  // intensity between tiers rides continuously on the drum, pulse and arp gains.
  night: {
    root: D3, bpm: 96, mode: AEOLIAN, kit: "frame",
    chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [0, 3, 7]],   // Dm Bb C Dm
    mix: { drone: 0.34, pad: 0.30, bass: 0.46, arp: 0.14, lead: 0.20, choir: 0, drum: 0.26, pulse: 0 },
    tiers: [
      {},
      { bass: 0.52, arp: 0.26, lead: 0.28, choir: 0.12, drum: 0.44, pulse: 0.18 },
      { bass: 0.58, arp: 0.34, lead: 0.34, choir: 0.26, drum: 0.60, pulse: 0.30, drone: 0.44 },
    ],
    tierKit: ["frame", "war", "war"],
    bass: [
      p("0 . 0 . . . 4 . 0 . 0 . 2 . . ."),
      p("5 . 5 . . . 2 . 5 . 5 . 0 . . ."),
      p("6 . 6 . . . 3 . 6 . 6 . 4 . . ."),
      p("0 . 0 . . . 4 . 0 . 2 . 4 . . ."),
    ],
    // sparse and cold while the night is quiet
    arp: [
      p(". . . . . . 7 . . . . . . . . ."),
      p(". . . . . . . . . . 5 . . . . ."),
      p(". . . . 6 . . . . . . . . . . ."),
      p(". . . . . . . . . . . . 4 . . ."),
    ],
    // and running once the wave is on the walls
    arp2: [
      p("7 . 9 . 7 . 6 . 7 . 9 . 11 . 9 ."),
      p("5 . 7 . 5 . 4 . 5 . 7 . 9 . 7 ."),
      p("6 . 8 . 6 . 5 . 6 . 8 . 10 . 8 ."),
      p("7 . 6 . 4 . 3 . 4 . 6 . 7 . 9 ."),
    ],
    lead: [
      p(". . . . 4 . . . . . 3 . . . . ."),
      p("2 . . . . . . . 1 . . . 2 . . ."),
      p("3 . . . 4 . . . . . 5 . . . . ."),
      p("4 . . . 3 . . . 2 . . . . . . ."),
    ],
    drums: [
      { kick: [0, 8], hat: [4, 12], snare: [] },
      { kick: [0, 6, 8, 14], hat: [2, 6, 10, 14], snare: [4, 12] },
      { kick: [0, 3, 6, 8, 11, 14], hat: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12] },
    ],
    pulse: [[], [0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14]],
  },

  // A boss night. Phrygian — the flattened second is the darkest note available
  // without leaving the mode system — plus a choir, war drums on every beat and
  // the fastest tempo in the score.
  boss: {
    root: D3, bpm: 108, mode: PHRYGIAN, kit: "war",
    chords: [[0, 3, 7], [1, 5, 8], [0, 3, 7], [7, 10, 14]],   // Dm Eb Dm Am
    mix: { drone: 0.50, pad: 0.34, bass: 0.62, arp: 0.30, lead: 0.38, choir: 0.34, drum: 0.62, pulse: 0.26 },
    tiers: [
      {},
      { drum: 0.70, pulse: 0.34, choir: 0.40, lead: 0.42 },
      { drum: 0.78, pulse: 0.42, choir: 0.50, lead: 0.48, drone: 0.60 },
    ],
    tierKit: ["war", "war", "war"],
    bass: [
      p("0 . 0 . 1 . 0 . 0 . 0 . 4 . 1 ."),
      p("1 . 1 . 0 . 1 . 1 . 1 . 5 . 4 ."),
      p("0 . 0 . 1 . 0 . 0 . 3 . 4 . 2 ."),
      p("4 . 4 . 3 . 4 . 4 . 2 . 1 . 0 ."),
    ],
    arp: [
      p("7 . . 8 . . 7 . 11 . . 10 . . 7 ."),
      p("8 . . 7 . . 8 . 12 . . 11 . . 8 ."),
      p("7 . . 8 . . 10 . 11 . . 12 . . 11 ."),
      p("11 . . 10 . . 8 . 7 . . 8 . . 4 ."),
    ],
    lead: [
      p("11 . . . . . 10 . . . 8 . . . 7 ."),
      p("8 . . . 7 . . . 8 . . . . . . ."),
      p("10 . . . 11 . . . 12 . . . 11 . . ."),
      p("8 . . . 7 . . . 4 . . . . . . ."),
    ],
    drums: [
      { kick: [0, 3, 6, 8, 11, 14], hat: [2, 6, 10, 14], snare: [4, 12] },
      { kick: [0, 3, 6, 8, 11, 14], hat: [0, 2, 4, 6, 8, 10, 12, 14], snare: [4, 12] },
      { kick: [0, 2, 3, 6, 8, 10, 11, 14], hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15], snare: [4, 12] },
    ],
    pulse: [[0, 4, 8, 12], [0, 2, 4, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 10, 12, 14]],
  },

  // The realm holds. Mixolydian: major third, flat seventh — bright without
  // becoming a fanfare in a key the rest of the score never visits.
  victory: {
    root: D3, bpm: 96, mode: MIXO, kit: "frame", hard: true,
    oneShot: { bars: 2, then: "realm" },
    chords: [[0, 4, 7], [5, 9, 12]],
    mix: { drone: 0.10, pad: 0.40, bass: 0.42, arp: 0.40, lead: 0.42, choir: 0.16, drum: 0.34, pulse: 0 },
    leadVoice: "bell",
    bass: [
      p("0 . . . . . . . 4 . . . . . . ."),
      p("3 . . . . . . . 0 . . . . . . ."),
    ],
    arp: [
      p("4 . 6 . 7 . 9 . 11 . 9 . 7 . 6 ."),
      p("7 . 9 . 11 . 12 . 11 . 9 . 7 . 4 ."),
    ],
    lead: [
      p("0 . . . . . . . 4 . . . . . . ."),
      p("7 . . . . . . . . . . . . . . ."),
    ],
    drums: [{ kick: [[0, 8], [0, 4, 8, 12]], hat: [[4, 12], [2, 6, 10, 14]], snare: [[], [8]] }],
  },

  // The keep has fallen. Phrygian, half the tempo of anything else, one war
  // drum a bar and a bell tolling down the Phrygian cadence A-Eb-D.
  defeat: {
    root: D3, bpm: 60, mode: PHRYGIAN, kit: "war", hard: true,
    oneShot: { bars: 2, then: "realm" },
    chords: [[0, 3, 7], [1, 5, 8]],
    mix: { drone: 0.60, pad: 0.36, bass: 0.44, arp: 0, lead: 0.34, choir: 0.24, drum: 0.30, pulse: 0 },
    leadVoice: "bell",
    bass: [
      p("4 . . . . . . . . . . . . . . ."),
      p("1 . . . . . . . 0 . . . . . . ."),
    ],
    lead: [
      p("7 . . . . . . . 4 . . . . . . ."),
      p("1 . . . . . . . 0 . . . . . . ."),
    ],
    drums: [{ kick: [0], hat: [], snare: [] }],
  },
};

export const SCENE_NAMES = Object.keys(SCENES);
export { SCENES, STEPS, LAYERS, patAt };

export class Music {
  constructor(audio) {
    this.audio = audio;
    this.enabled = true;          // the persisted music toggle
    this.sceneName = null;
    this.scene = null;
    this.pending = null;
    this.oneShotThen = null;
    this.step = 0;
    this.bar = 0;
    this.tier = 0;
    this.wantTier = 0;
    this.intensity = 0;
    this.bellLift = 0;            // the nightfall bell climbs with the night
    this.nextTime = 0;
    this.prevStepTime = 0;
    this.prevStepDur = 0;
    this.started = false;
    this.base = {};               // per-layer target before the intensity scale
    this.gains = {};              // live per-layer gain
    for (const k of LAYERS) { this.base[k] = 0; this.gains[k] = 0; }
    this.verb = null;

    // ---- diagnostics. This score cannot be checked by ear from a headless
    // run, so the sequencer records enough to prove it is running correctly.
    this.notesScheduled = 0;
    this.stepsScheduled = 0;
    this.barsScheduled = 0;
    this.sceneChanges = 0;
    this.maxStepGapError = 0;     // worst |actual - expected| step spacing
    this.cueTime = 0;             // bar-line time the last transition cue targets
    this.cueHits = 0;
    this.sceneLog = [];           // {name, at, bar} per scene change
    this.stepLog = [];            // ring of recent {t, step, bar, scene, notes}
    this.barLog = [];             // {at, scene, dur} per bar, for spacing checks
    this.notesByScene = {};       // proof each scene really sequences notes
  }

  // ------------------------------------------------------------------ control

  /**
   * Ask for a scene. Layer gains start crossfading now; the pattern set, key and
   * tempo swap at the next bar line, so nothing ever jumps mid-bar. A scene
   * marked `hard` defers its mix too and snaps it on that bar line instead.
   */
  setScene(name, opts) {
    const s = SCENES[name];
    if (!s) return;
    const o = opts || {};
    if (!this.scene) {
      this.pending = { name, then: o.then || null };
      this.applyPending();
      return;
    }
    if (name === this.sceneName && !this.pending) return;
    if (this.pending && this.pending.name === name) return;
    this.pending = { name, then: o.then || null };
    if (!s.hard) this.applyMix(false, s, this.tierOf(s));
  }

  /** 0..1, how hard the night is going. Drives the pattern tier and the mix. */
  setIntensity(v) { this.intensity = clamp01(v); }

  /** The bell tolls a scale degree higher each night, so progress is audible. */
  setNight(night) { this.bellLift = Math.max(0, Math.min(7, (night | 0) - 1)); }

  setEnabled(on) {
    this.enabled = !!on;
    const a = this.audio;
    const c = a.ctx;
    if (this.enabled) { this.step = 0; this.prevStepTime = 0; }
    if (!c || !a.musicBus) return;
    const g = a.musicBus.gain;
    const now = c.currentTime;
    try {
      g.cancelScheduledValues(now);
      g.setValueAtTime(g.value, now);
      g.linearRampToValueAtTime(this.enabled ? (a.musicLevel || 0.35) : 0.0001, now + 0.45);
    } catch (e) { /* ignore */ }
  }

  /**
   * An authored run-up into the next bar line: war-drum hits that accelerate
   * into the downbeat, plus a noise riser that arrives with it. Pair this with
   * setScene("nightfall") and the cut lands on a beat the player heard coming
   * instead of whenever the key happened to be pressed.
   */
  cueTransition() {
    const c = this.audio.ctx;
    if (!c || !this.started || !this.enabled || !this.scene) return 0;
    const spb = this.stepDur();
    const barAt = this.nextTime + ((STEPS - this.step) % STEPS) * spb;
    this.cueTime = barAt;
    this.cueHits = 0;
    for (const stepsBefore of [8, 5, 3, 1.5, 0.5]) {
      const t = barAt - stepsBefore * spb;
      if (t <= c.currentTime + 0.02) continue;
      this.warDrum(t, 0.30 + 0.30 * (1 - stepsBefore / 8));
      this.cueHits++;
    }
    const rt = barAt - 8 * spb;
    if (rt > c.currentTime + 0.02) this.riser(rt, 8 * spb, 0.18);
    return barAt;
  }

  // -------------------------------------------------------------------- clock

  stepDur() { return 60 / this.scene.bpm / 4; }

  tierOf(s) { return s.tiers ? Math.min(this.tier, s.tiers.length - 1) : 0; }

  applyMix(snap, scene, tier) {
    const s = scene || this.scene;
    const t = tier == null ? this.tierOf(s) : tier;
    const mix = Object.assign({}, s.mix, (s.tiers && s.tiers[t]) || {});
    for (const k of LAYERS) this.base[k] = mix[k] || 0;
    if (snap) for (const k of LAYERS) this.gains[k] = this.effTarget(k, s);
  }

  /** The intensity scale rides on top of the tier mix, so it reads continuously. */
  effTarget(k, scene) {
    const s = scene || this.scene;
    let v = this.base[k];
    if (s && s.tiers && (k === "drum" || k === "pulse" || k === "arp")) {
      v *= 0.72 + 0.38 * this.intensity;
    }
    return v;
  }

  applyPending() {
    const pd = this.pending;
    this.pending = null;
    this.sceneName = pd.name;
    this.scene = SCENES[pd.name];
    this.bar = 0;
    this.tier = this.wantTier;
    this.oneShotThen = pd.then
      || (this.scene.oneShot ? this.scene.oneShot.then : null);
    this.applyMix(!!this.scene.hard);
    this.sceneChanges++;
    this.sceneLog.push({ name: pd.name, at: this.prevStepTime, bar: this.barsScheduled });
    if (this.sceneLog.length > 40) this.sceneLog.shift();
  }

  /** Called once per finished bar — the only place a swap is allowed to happen. */
  onBarLine() {
    if (this.pending) { this.applyPending(); return; }
    if (this.wantTier !== this.tier) {
      this.tier = this.wantTier;
      this.applyMix(false);
    }
    const os = this.scene.oneShot;
    if (os && this.bar >= os.bars) {
      this.pending = { name: this.oneShotThen || os.then, then: null };
      this.applyPending();
    }
  }

  /** Every frame: ease the layer gains, then queue whatever the clock is due. */
  update(dt) {
    const a = this.audio;
    const c = a.ctx;
    const k = Math.min(1, dt * EASE);
    for (const layer of LAYERS) {
      this.gains[layer] += (this.effTarget(layer) - this.gains[layer]) * k;
    }
    if (!c || c.state !== "running" || !a.musicBus || !this.scene || !this.enabled) return;
    this.ensureVerb();

    // intensity -> pattern tier, with hysteresis so a value hovering on a
    // boundary cannot flip the arrangement every bar
    const up = [0.38, 0.70], down = [0.32, 0.64];
    let want = this.wantTier;
    if (this.intensity > up[1]) want = 2;
    else if (this.intensity > up[0] && want < 1) want = 1;
    else if (this.intensity < down[0]) want = 0;
    else if (this.intensity < down[1] && want > 1) want = 1;
    this.wantTier = want;

    if (!this.started) { this.started = true; this.nextTime = c.currentTime + 0.10; }
    // A long stall must not turn into a backlog of catch-up notes.
    if (this.nextTime < c.currentTime - 0.5) { this.nextTime = c.currentTime + 0.05; this.prevStepTime = 0; }

    let budget = 128;
    while (this.nextTime < c.currentTime + LOOKAHEAD && budget-- > 0) {
      const t = this.nextTime;
      const before = this.notesScheduled;
      this.scheduleStep(t);
      // The step duration is read before any bar-line swap, so the first step of
      // a new scene sits exactly one old step after the last step of the old
      // one: a tempo change leaves neither a gap nor an overlap.
      const spb = this.stepDur();
      if (this.prevStepTime > 0) {
        const err = Math.abs((t - this.prevStepTime) - this.prevStepDur);
        if (err > this.maxStepGapError) this.maxStepGapError = err;
      }
      this.stepLog.push({
        t, step: this.step, bar: this.bar, scene: this.sceneName,
        notes: this.notesScheduled - before, dur: spb,
      });
      if (this.stepLog.length > 96) this.stepLog.shift();
      this.prevStepTime = t;
      this.prevStepDur = spb;
      this.nextTime = t + spb;
      this.stepsScheduled++;
      this.step++;
      if (this.step >= STEPS) {
        this.step = 0;
        this.bar++;
        this.barsScheduled++;
        this.onBarLine();
        // Recorded after the swap, so the entry names the scene the bar starting
        // at `at` actually belongs to.
        this.barLog.push({ at: this.nextTime, scene: this.sceneName, dur: this.stepDur() });
        if (this.barLog.length > 240) this.barLog.shift();
      }
    }
  }

  // --------------------------------------------------------------- one 16th

  scheduleStep(t) {
    const s = this.scene;
    const bar = this.bar;
    const step = this.step;
    const spb = this.stepDur();
    const g = this.gains;
    const tier = this.tierOf(s);
    const chord = s.chords[bar % s.chords.length];
    const mode = s.mode;

    const pitch = (i) => {
      const n = mode.length;
      const idx = ((i % n) + n) % n;
      return nf(s.root, mode[idx] + 12 * Math.floor(i / n));
    };
    const degOf = (pat) => {
      const row = patAt(pat, bar);
      return row && row[step] != null ? row[step] : null;
    };

    if (g.bass > 0.02) {
      const d = degOf(s.bass);
      if (d !== null) this.bassNote(t, pitch(d) / 2, spb * 3.0, g.bass);
    }
    if (g.arp > 0.02) {
      const src = tier > 0 && s.arp2 ? s.arp2 : s.arp;
      const d = degOf(src);
      if (d !== null) this.lute(t, pitch(d), spb * 2.6, g.arp);
    }
    if (g.lead > 0.02) {
      const d = degOf(s.lead);
      if (d !== null) {
        if (s.leadVoice === "bell") this.bell(t, pitch(d + this.bellLift), spb * 12, g.lead);
        else this.horn(t, pitch(d), spb * 5.5, g.lead);
      }
    }
    if (g.pulse > 0.02) {
      const row = patAt(s.pulse, tier);
      if (row && row.indexOf(step) >= 0) this.pulseNote(t, s.root / 2, spb * 0.9, g.pulse);
    }
    if (g.drum > 0.02) {
      const kit = s.drums[Math.min(tier, s.drums.length - 1)];
      const kick = patAt(kit.kick, bar);
      const hat = patAt(kit.hat, bar);
      const snare = patAt(kit.snare, bar);
      const heavy = (s.tierKit ? s.tierKit[Math.min(tier, s.tierKit.length - 1)] : s.kit) === "war";
      if (kick && kick.indexOf(step) >= 0) {
        if (heavy) this.warDrum(t, g.drum); else this.frameDrum(t, g.drum);
      }
      if (hat && hat.indexOf(step) >= 0) this.tamb(t, g.drum * 0.42);
      if (snare && snare.indexOf(step) >= 0) this.snareHit(t, g.drum * 0.62);
    }

    // Sustained layers are re-struck once a bar, on its chord, not per step.
    if (step === 0) {
      const barDur = spb * STEPS;
      if (g.pad > 0.02) {
        for (const semi of chord) {
          this.pad(t, nf(s.root, semi), barDur * 1.02, g.pad / chord.length);
        }
      }
      if (g.drone > 0.02) this.drone(t, s.root / 2, barDur * 1.06, g.drone);
      if (g.choir > 0.02) {
        this.choir(t, nf(s.root, chord[0]) * 2, barDur * 1.02, g.choir * 0.6);
        this.choir(t, nf(s.root, chord[chord.length - 1]) * 2, barDur * 1.02, g.choir * 0.4);
      }
    }
  }

  // -------------------------------------------------------------------- voices
  // Every voice owns exactly one env() gain, which is what makes notesScheduled
  // an honest count of notes rather than of nodes.

  get bus() { return this.audio.musicBus; }

  /** A short stone-hall tail, fed only by the sustained and bell voices. */
  ensureVerb() {
    if (this.verb !== null) return;
    const c = this.audio.ctx;
    try {
      const conv = c.createConvolver();
      const len = Math.floor(c.sampleRate * 1.2);
      const buf = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = buf.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.0);
      }
      conv.buffer = buf;
      const wet = c.createGain();
      wet.gain.value = 0.30;
      conv.connect(wet);
      wet.connect(this.bus);
      this.verb = conv;
    } catch (e) { this.verb = false; }
  }

  env(t, dur, peak, attack, tail) {
    this.notesScheduled++;
    this.notesByScene[this.sceneName] = (this.notesByScene[this.sceneName] || 0) + 1;
    const c = this.audio.ctx;
    const g = c.createGain();
    const a = attack == null ? 0.005 : attack;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + a);
    g.gain.exponentialRampToValueAtTime(tail == null ? 0.0008 : tail, t + Math.max(a + 0.01, dur));
    return g;
  }

  send(g, amount) {
    if (!this.verb) return;
    const c = this.audio.ctx;
    const s = c.createGain();
    s.gain.value = amount;
    g.connect(s);
    s.connect(this.verb);
  }

  /** Low plucked string: the bass line. */
  bassNote(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 8 + 220, t);
    f.frequency.exponentialRampToValueAtTime(freq * 2.4 + 100, t + dur);
    f.Q.value = 3;
    const g = this.env(t, dur, 0.26 * vol, 0.006);
    for (const [type, det, lvl] of [["triangle", 0, 1], ["sawtooth", 5, 0.45]]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = det;
      const og = c.createGain();
      og.gain.value = lvl;
      o.connect(og); og.connect(f);
      o.start(t); o.stop(t + dur + 0.04);
    }
    f.connect(g); g.connect(this.bus);
  }

  /** Plucked lute: the arpeggio and counter-melody. */
  lute(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.setValueAtTime(freq * 5 + 1200, t);
    f.frequency.exponentialRampToValueAtTime(500, t + dur);
    f.Q.value = 1.2;
    const g = this.env(t, dur, 0.070 * vol, 0.003);
    o.connect(f); f.connect(g); g.connect(this.bus);
    this.send(g, 0.16);
    o.start(t); o.stop(t + dur + 0.03);
  }

  /** Reed horn: the melody. Slight vibrato so a held note does not sit dead. */
  horn(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq * 3.2 + 700;
    f.Q.value = 2.2;
    const lfo = c.createOscillator();
    lfo.frequency.value = 4.8;
    const lg = c.createGain();
    lg.gain.value = freq * 0.005;
    lfo.connect(lg); lg.connect(o.frequency);
    const g = this.env(t, dur, 0.095 * vol, 0.055, 0.0006);
    o.connect(f); f.connect(g); g.connect(this.bus);
    this.send(g, 0.24);
    o.start(t); lfo.start(t);
    o.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  /**
   * The bell. Root, fifth and octave struck a few milliseconds apart with long
   * decays — so the toll reads as one pitched event with a body, and moving its
   * root moves the whole stack. The nightfall toll is lifted a scale degree per
   * night, which makes climbing a level's nights audible.
   */
  bell(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const parts = [[1, 0, 1.0, "sine"], [1.5, 0.03, 0.52, "sine"], [2, 0.06, 0.34, "triangle"]];
    for (const [mul, off, lvl, type] of parts) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq * mul;
      const g = this.env(t + off, dur * (mul === 1 ? 1 : 0.8), 0.16 * vol * lvl, 0.004, 0.0004);
      o.connect(g); g.connect(this.bus);
      this.send(g, 0.42);
      o.start(t + off); o.stop(t + off + dur + 0.06);
    }
  }

  /** Bowed strings: the chord bed. */
  pad(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 1300;
    const g = this.env(t, dur, 0.125 * vol, dur * 0.26, 0.0006);
    for (const det of [-6, 7]) {
      const o = c.createOscillator();
      o.type = "triangle";
      o.frequency.value = freq;
      o.detune.value = det;
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.06);
    }
    f.connect(g); g.connect(this.bus);
    this.send(g, 0.30);
  }

  /** The open fifth underneath everything. */
  drone(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = 360;
    const g = this.env(t, dur, 0.155 * vol, dur * 0.28, 0.0006);
    for (const [mul, type] of [[1, "sine"], [1.004, "sine"], [1.5, "triangle"]]) {
      const o = c.createOscillator();
      o.type = type;
      o.frequency.value = freq * mul;
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.07);
    }
    f.connect(g); g.connect(this.bus);
    this.send(g, 0.22);
  }

  /** Two formants over a saw: a voice-ish tone for the boss nights. */
  choir(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "sawtooth";
    o.frequency.value = freq;
    const g = this.env(t, dur, 0.085 * vol, dur * 0.34, 0.0006);
    for (const [hz, q, lvl] of [[720, 7, 1.0], [1180, 9, 0.6]]) {
      const f = c.createBiquadFilter();
      f.type = "bandpass";
      f.frequency.value = hz;
      f.Q.value = q;
      const fg = c.createGain();
      fg.gain.value = lvl;
      o.connect(f); f.connect(fg); fg.connect(g);
    }
    g.connect(this.bus);
    this.send(g, 0.40);
    o.start(t); o.stop(t + dur + 0.06);
  }

  /** The driving low blip that only appears once a night turns bad. */
  pulseNote(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "square";
    o.frequency.value = freq;
    const f = c.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = freq * 4 + 200;
    const g = this.env(t, dur, 0.085 * vol, 0.004);
    o.connect(f); f.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + dur + 0.02);
  }

  noise(t, dur, type, hz, peak, q) {
    const c = this.audio.ctx;
    const src = c.createBufferSource();
    src.buffer = this.audio.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = hz;
    f.Q.value = q == null ? 1 : q;
    const g = this.env(t, dur, peak, 0.001);
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t, Math.random() * 0.6);
    src.stop(t + dur + 0.02);
    return g;
  }

  /** A hand drum: the day's pulse. */
  frameDrum(t, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(205, t);
    o.frequency.exponentialRampToValueAtTime(96, t + 0.10);
    const g = this.env(t, 0.19, 0.40 * vol, 0.002);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.22);
  }

  /** A war drum: deeper, with a skin thump on top. */
  warDrum(t, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(168, t);
    o.frequency.exponentialRampToValueAtTime(52, t + 0.15);
    const g = this.env(t, 0.28, 0.56 * vol, 0.002);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.32);
    this.noise(t, 0.06, "lowpass", 900, 0.14 * vol, 0.7);
  }

  tamb(t, vol) { this.noise(t, 0.038, "highpass", 6800, 0.10 * vol); }

  snareHit(t, vol) {
    this.noise(t, 0.11, "bandpass", 1750, 0.19 * vol, 0.8);
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = "triangle";
    o.frequency.setValueAtTime(215, t);
    o.frequency.exponentialRampToValueAtTime(125, t + 0.08);
    const g = this.env(t, 0.09, 0.09 * vol, 0.002);
    o.connect(g); g.connect(this.bus);
    o.start(t); o.stop(t + 0.12);
  }

  /** The noise swell that carries a transition cue into its downbeat. */
  riser(t, dur, vol) {
    const c = this.audio.ctx;
    const src = c.createBufferSource();
    src.buffer = this.audio.noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = "bandpass";
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(240, t);
    f.frequency.exponentialRampToValueAtTime(2600, t + dur);
    this.notesScheduled++;
    this.notesByScene[this.sceneName] = (this.notesByScene[this.sceneName] || 0) + 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.92);
    g.gain.exponentialRampToValueAtTime(0.0008, t + dur + 0.10);
    src.connect(f); f.connect(g); g.connect(this.bus);
    src.start(t); src.stop(t + dur + 0.14);
  }

  // ------------------------------------------------------------- diagnostics

  /** Everything a headless run needs to judge the sequencer without listening. */
  debugSnapshot() {
    return {
      scene: this.sceneName,
      pending: this.pending ? this.pending.name : null,
      bpm: this.scene ? this.scene.bpm : 0,
      stepDur: this.scene ? this.stepDur() : 0,
      step: this.step,
      bar: this.bar,
      tier: this.tier,
      intensity: this.intensity,
      enabled: this.enabled,
      started: this.started,
      bellLift: this.bellLift,
      notesScheduled: this.notesScheduled,
      stepsScheduled: this.stepsScheduled,
      barsScheduled: this.barsScheduled,
      sceneChanges: this.sceneChanges,
      maxStepGapError: this.maxStepGapError,
      cueTime: this.cueTime,
      cueHits: this.cueHits,
      gains: Object.assign({}, this.gains),
      base: Object.assign({}, this.base),
      sceneLog: this.sceneLog.slice(),
      stepLog: this.stepLog.slice(),
      barLog: this.barLog.slice(),
      notesByScene: Object.assign({}, this.notesByScene),
    };
  }
}
