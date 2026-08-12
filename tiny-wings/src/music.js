// The soundtrack. No sample files: a step sequencer over WebAudio voices, scheduled with
// a lookahead against the audio clock so it never depends on frame timing.
//
// This replaces a three-oscillator pad that held a triad and changed key per island. That
// was atmosphere, and a player described it as "an annoying monotone sound", which is a
// fair description of a sustained chord. What is here instead is one actual tune.
//
// THE PIECE. One composition, four bars long, played for the whole game:
//
//   chords   D  |  A  |  Bm  |  G          I - V - vi - IV in D major
//   bass     root-and-fifth bounce, one chord per bar
//   arp      a sixteenth-note arpeggio over the chord tones — this is the layer that
//            carries the movement, so nothing has to sustain to fill space
//   lead     the melody: F#-A-B-A / A-C#-B / F#-A-B-D / C#-B-A-F#-D. Four bars, peaks on
//            the high D in bar three, resolves down to the tonic at the end of bar four,
//            so bar four hands back to bar one without a seam.
//   pad      the chord itself, struck once a bar underneath everything
//   drums    kick, hat and a light clap
//
// Every scene plays THAT piece. A scene changes the tempo, which layers are audible and
// how loud they are — never the notes. So the title screen, a run, Fever, dusk and the
// summary card are the same song at different weights rather than five different songs.
//
// Per ISLAND the key moves (see KEY_ROTATION) and the intensity creeps up. Same tune,
// new key: the thing the original does with its daily re-roll.
//
// Two rules make it seamless. Layer gains are eased every frame, so a scene change is a
// crossfade and a silent layer is still being sequenced underneath. Tempo, key and scene
// pattern swaps are DEFERRED to the next bar line, so nothing ever lands mid-bar. And no
// voice is ever cut: every note owns a gain envelope that starts and ends at silence, so
// there is no click anywhere, including across the loop point.

const LOOKAHEAD = 0.3;      // seconds of notes scheduled ahead of the clock
const STEPS = 16;           // one bar of sixteenths
const BARS = 4;             // the piece

/** Equal-temperament offset from a root frequency. */
function nf(root, semis) { return root * Math.pow(2, semis / 12); }

// A layer gain of 0 means "silent but still sequenced", so a scene change is a crossfade
// rather than a restart.
const LAYERS = ['bass', 'arp', 'pad', 'lead', 'drum', 'shine'];

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const _ = null;             // a rest, so the patterns below stay readable as rhythm

// Scale-degree indices, 0 = the root. 0=D 1=E 2=F# 3=G 4=A 5=B 6=C# 7=D' ...
// Chord roots as degrees: D=0, A=4, Bm=5, G=3.
const PIECE = {
  mode: MAJOR,
  // Sustained chord under each bar, as semitone offsets from the root.
  chords: [
    [0, 4, 7],        // D
    [7, 11, 14],      // A
    [9, 12, 16],      // Bm
    [5, 9, 12],       // G
  ],
  // Root-and-fifth bounce. Played an octave down.
  bass: [
    [0, _, _, 0, _, _, 4, _, 0, _, _, 0, _, 4, _, 2],
    [4, _, _, 4, _, _, 1, _, 4, _, _, 4, _, 1, _, 6],
    [5, _, _, 5, _, _, 2, _, 5, _, _, 5, _, 2, _, 4],
    [3, _, _, 3, _, _, 0, _, 3, _, _, 3, _, 0, _, 4],
  ],
  // Arpeggio over the chord tones, played an octave up. The engine of the groove.
  arp: [
    [0, _, 2, _, 4, _, 2, _, 7, _, 4, _, 2, _, 4, _],
    [4, _, 6, _, 8, _, 6, _, 11, _, 8, _, 6, _, 8, _],
    [5, _, 7, _, 9, _, 7, _, 12, _, 9, _, 7, _, 9, _],
    [3, _, 5, _, 7, _, 5, _, 10, _, 7, _, 5, _, 7, _],
  ],
  // The tune.
  lead: [
    [_, _, _, _, 9, _, 11, _, 12, _, _, 11, _, _, _, _],
    [11, _, _, _, _, _, 13, _, 12, _, _, _, _, _, _, _],
    [_, _, 9, _, 11, _, _, _, 12, _, 14, _, _, _, _, _],
    [13, _, _, 12, _, _, 11, _, 9, _, _, _, _, _, 7, _],
  ],
};

/**
 * Scenes. `mix` is the per-layer target gain; `bpm` the tempo; `kick`/`hat`/`clap` the
 * drum rhythm. None of them touch the notes — that is what keeps it one piece.
 */
const SCENES = {
  // Title: the tune with the rhythm section lifted off, so it reads as an invitation.
  title: {
    bpm: 96,
    mix: { bass: 0.20, arp: 0.16, pad: 0.60, lead: 0.34, drum: 0, shine: 0.10 },
    kick: [], hat: [], clap: [],
  },
  // A run in daylight. The default: everything in, drums light.
  day: {
    bpm: 116,
    mix: { bass: 0.46, arp: 0.40, pad: 0.34, lead: 0.40, drum: 0.30, shine: 0.14 },
    kick: [0, 8], hat: [2, 6, 10, 14], clap: [12],
  },
  // Fever. Faster, drums driving, the shimmer layer up — the same melody, celebrating.
  fever: {
    bpm: 126,
    mix: { bass: 0.52, arp: 0.54, pad: 0.30, lead: 0.46, drum: 0.46, shine: 0.40 },
    kick: [0, 6, 8, 14], hat: [1, 2, 4, 6, 9, 10, 12, 14], clap: [4, 12],
  },
  // Golden hour. Warmer and thinner: the drums step back, the pad opens up.
  dusk: {
    bpm: 108,
    mix: { bass: 0.40, arp: 0.26, pad: 0.46, lead: 0.36, drum: 0.14, shine: 0.10 },
    kick: [0, 8], hat: [6, 14], clap: [],
  },
  // Night on your heels. Quieter and sparser, but still the tune — pulling ahead brings
  // the daylight back, and the music has to be able to come back with it.
  night: {
    bpm: 104,
    mix: { bass: 0.42, arp: 0.18, pad: 0.40, lead: 0.24, drum: 0.10, shine: 0.06 },
    kick: [0, 8], hat: [], clap: [],
  },
  // Race: no night, no drifting — a flat-out version.
  race: {
    bpm: 128,
    mix: { bass: 0.52, arp: 0.46, pad: 0.26, lead: 0.42, drum: 0.44, shine: 0.16 },
    kick: [0, 4, 8, 12], hat: [2, 6, 10, 14], clap: [4, 12],
  },
  // The run-end card. Thinned right out so the summary can be read over it.
  summary: {
    bpm: 100,
    mix: { bass: 0.16, arp: 0.06, pad: 0.34, lead: 0.20, drum: 0, shine: 0.06 },
    kick: [], hat: [], clap: [],
  },
};

// Per-island key. The same tune moved to a new key each island — near-relative keys only,
// and it comes back to D, so an hour of play never drifts somewhere shrill or muddy.
const KEY_ROTATION = [0, 2, 5, -3, 7, -5, 3, -1];
const ROOT_D3 = 146.83;

export class Music {
  constructor(audio) {
    this.audio = audio;
    this.sceneName = null;
    this.scene = null;
    this.pendingScene = null;
    this.transpose = 0;
    this.pendingTranspose = null;
    this.intensity = 0;          // creeps up with the island index
    this.pendingIntensity = null;
    this.step = 0;
    this.bar = 0;
    this.nextTime = 0;
    this.started = false;
    this.gains = {};
    this.targets = {};
    for (const k of LAYERS) { this.gains[k] = 0; this.targets[k] = 0; }
    // Diagnostics. There is no way to listen to this in a headless check, so the
    // sequencer counts what it schedules and the verification asserts on that.
    this.notesScheduled = 0;
    this.barsPlayed = 0;
  }

  /** Ask for a scene. Gains crossfade now; tempo and patterns swap at the next bar. */
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
    for (const k of LAYERS) this.targets[k] = mix[k] || 0;
  }

  /** New island: same piece, new key, a little more intensity. Lands on a bar line. */
  setIsland(index) {
    const semis = KEY_ROTATION[((index % KEY_ROTATION.length) + KEY_ROTATION.length) % KEY_ROTATION.length];
    const inten = Math.min(1, index / 7);
    if (!this.scene) { this.transpose = semis; this.intensity = inten; return; }
    this.pendingTranspose = semis;
    this.pendingIntensity = inten;
  }

  stop() { for (const k of LAYERS) this.targets[k] = 0; }

  get root() { return nf(ROOT_D3, this.transpose); }

  /** Called every frame: ease the gains, then schedule whatever is due. */
  update(dt) {
    const a = this.audio;
    for (const k of LAYERS) {
      this.gains[k] += (this.targets[k] - this.gains[k]) * Math.min(1, dt * 1.5);
    }
    const c = a.ctx;
    if (!c || c.state !== 'running' || !a.musicBus || !this.scene) return;
    if (!this.started) {
      this.started = true;
      this.nextTime = c.currentTime + 0.08;
    }
    // A long tab stall must not try to catch up on a backlog of bars.
    if (this.nextTime < c.currentTime - 0.5) this.nextTime = c.currentTime + 0.05;

    let budget = 96;                  // hard cap on notes scheduled per frame
    while (this.nextTime < c.currentTime + LOOKAHEAD && budget-- > 0) {
      this.scheduleStep(this.nextTime);
      this.nextTime += 60 / this.scene.bpm / 4;
      this.step++;
      if (this.step >= STEPS) {
        this.step = 0;
        this.bar = (this.bar + 1) % BARS;
        this.barsPlayed++;
        // Everything structural lands here, on the bar line, never mid-bar.
        if (this.pendingScene) {
          this.sceneName = this.pendingScene;
          this.scene = SCENES[this.pendingScene];
          this.pendingScene = null;
        }
        if (this.pendingTranspose !== null) {
          this.transpose = this.pendingTranspose;
          this.pendingTranspose = null;
        }
        if (this.pendingIntensity !== null) {
          this.intensity = this.pendingIntensity;
          this.pendingIntensity = null;
        }
      }
    }
  }

  // ---- one sixteenth -----------------------------------------------------------------
  scheduleStep(t) {
    const s = this.scene;
    const step = this.step;
    const bar = this.bar;
    const spb = 60 / s.bpm / 4;
    const root = this.root;
    const pitch = (i) => nf(root, MAJOR[((i % 7) + 7) % 7] + 12 * Math.floor(i / 7));
    const at = (pat) => (pat[bar][step] != null ? pat[bar][step] : null);
    const audible = (k) => this.gains[k] > 0.02;
    let n = 0;

    if (audible('bass')) {
      const d = at(PIECE.bass);
      if (d !== null) { this.bassNote(t, pitch(d) / 2, spb * 2.6, this.gains.bass); n++; }
    }
    if (audible('arp')) {
      const d = at(PIECE.arp);
      // Intensity thickens the arp rather than adding notes, so the rhythm never changes.
      if (d !== null) { this.pluck(t, pitch(d) * 2, spb * 2.0, this.gains.arp * (0.8 + 0.35 * this.intensity)); n++; }
    }
    if (audible('lead')) {
      const d = at(PIECE.lead);
      if (d !== null) { this.lead(t, pitch(d), spb * 5.5, this.gains.lead); n++; }
    }
    if (audible('drum')) {
      if (s.kick.includes(step)) { this.kick(t, this.gains.drum); n++; }
      if (s.hat.includes(step)) { this.hat(t, this.gains.drum * 0.55); n++; }
      if (s.clap.includes(step)) { this.clap(t, this.gains.drum * 0.7); n++; }
    }
    // Pad and shimmer are struck once a bar, not per step.
    if (step === 0) {
      const chord = PIECE.chords[bar];
      if (audible('pad')) {
        for (const semi of chord) {
          this.padNote(t, nf(root, semi), spb * STEPS * 1.04, this.gains.pad / chord.length);
          n++;
        }
      }
      if (audible('shine')) {
        this.shine(t, nf(root, chord[chord.length - 1] + 12), spb * STEPS * 0.9, this.gains.shine);
        n++;
      }
    }
    this.notesScheduled += n;
  }

  // ---- voices ------------------------------------------------------------------------
  get bus() { return this.audio.musicBus; }

  /** Every voice goes through one of these, so nothing is ever cut and nothing clicks. */
  env(t, dur, peak, attack = 0.005, tail = 0.0008) {
    const g = this.audio.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(tail, t + dur);
    return g;
  }

  bassNote(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(freq, t);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq * 6 + 220, t);
    f.frequency.exponentialRampToValueAtTime(freq * 2.4 + 110, t + dur);
    f.Q.value = 3.2;
    const g = this.env(t, dur, 0.26 * vol, 0.008);
    o.connect(f).connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.03);
  }

  /** The arpeggio: a short marimba-ish blip. Bright, so it carries over the wind. */
  pluck(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const o2 = c.createOscillator();       // an octave up at low level = wooden attack
    o2.type = 'sine';
    o2.frequency.value = freq * 2;
    const og = c.createGain();
    og.gain.value = 0.35;
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(freq * 5 + 1200, t);
    f.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = this.env(t, dur, 0.085 * vol, 0.003);
    o.connect(f); o2.connect(og).connect(f);
    f.connect(g).connect(this.bus);
    o.start(t); o2.start(t);
    o.stop(t + dur + 0.02); o2.stop(t + dur + 0.02);
  }

  /** The melody. A warm whistle with a slow vibrato so a held note does not sit dead. */
  lead(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const o2 = c.createOscillator();
    o2.type = 'sine';
    o2.frequency.value = freq * 1.005;     // a hair of detune = a thicker line
    const lfo = c.createOscillator();
    lfo.frequency.value = 5.0;
    const lg = c.createGain();
    lg.gain.value = freq * 0.005;
    lfo.connect(lg).connect(o.frequency);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 3200;
    const g = this.env(t, dur, 0.13 * vol, 0.035, 0.0006);
    o.connect(f); o2.connect(f);
    f.connect(g).connect(this.bus);
    o.start(t); o2.start(t); lfo.start(t);
    o.stop(t + dur + 0.05); o2.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
  }

  padNote(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const g = this.env(t, dur, 0.12 * vol, dur * 0.22, 0.0006);
    const f = c.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 1800;
    for (const cents of [-6, 7]) {
      const o = c.createOscillator();
      o.type = 'triangle';
      o.frequency.value = freq * Math.pow(2, cents / 1200);
      o.connect(f);
      o.start(t); o.stop(t + dur + 0.05);
    }
    f.connect(g).connect(this.bus);
  }

  /** Fever's sparkle: a high bell on the bar line. */
  shine(t, freq, dur, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq * 4;
    const g = this.env(t, dur, 0.05 * vol, 0.01, 0.0004);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + dur + 0.05);
  }

  kick(t, vol) {
    const c = this.audio.ctx;
    const o = c.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(160, t);
    o.frequency.exponentialRampToValueAtTime(48, t + 0.12);
    const g = this.env(t, 0.19, 0.42 * vol, 0.002);
    o.connect(g).connect(this.bus);
    o.start(t); o.stop(t + 0.23);
  }

  noise(t, dur, type, hz, peak, q = 1) {
    const c = this.audio.ctx;
    const src = c.createBufferSource();
    src.buffer = this.audio.noiseBuf;
    const f = c.createBiquadFilter();
    f.type = type; f.frequency.value = hz; f.Q.value = q;
    const g = this.env(t, dur, peak, 0.001);
    src.connect(f).connect(g).connect(this.bus);
    src.start(t, (this.notesScheduled % 17) * 0.05);
    src.stop(t + dur + 0.02);
  }

  hat(t, vol) { this.noise(t, 0.032, 'highpass', 7600, 0.075 * vol); }

  clap(t, vol) { this.noise(t, 0.085, 'bandpass', 1500, 0.13 * vol, 0.9); }
}
