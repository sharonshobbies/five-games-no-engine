// WebAudio, fully synthesised. No files.
//
// Four voices: a pitched blip per pellet (pitch rises with a small streak
// counter, which is most of why eating feels good), a filtered-noise sprint
// hiss, a low noise thud on death, and a two-note chime on a kill.

export class Audio {
  constructor() {
    this.ctx = null;
    this.enabled = true;
    this.master = null;
    this.boostGain = null;
    this.streak = 0;
    this.streakT = 0;
    this.lastBlip = 0;
  }

  ensure() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
    } catch {
      return false;
    }
    const c = this.ctx;
    this.master = c.createGain();
    this.master.gain.value = 0.5;
    this.master.connect(c.destination);

    // Sprint hiss: brown-ish noise through a band-pass, gated by a gain node.
    const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.2;
    }
    this.noiseBuf = buf;

    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 620;
    bp.Q.value = 0.9;
    this.boostGain = c.createGain();
    this.boostGain.gain.value = 0;
    src.connect(bp).connect(this.boostGain).connect(this.master);
    src.start();
    return true;
  }

  setMuted(m) {
    this.enabled = !m;
    if (this.master) this.master.gain.value = m ? 0 : 0.5;
  }

  eat(big) {
    if (!this.enabled || !this.ensure()) return;
    const c = this.ctx;
    const now = c.currentTime;
    if (now - this.lastBlip < 0.028) return;
    this.lastBlip = now;
    if (now - this.streakT > 0.55) this.streak = 0;
    this.streakT = now;
    this.streak = Math.min(14, this.streak + 1);

    const o = c.createOscillator();
    const g = c.createGain();
    o.type = big ? 'triangle' : 'sine';
    const base = big ? 300 : 480;
    o.frequency.value = base * Math.pow(1.0595, this.streak * 1.6);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(big ? 0.20 : 0.085, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (big ? 0.20 : 0.10));
    o.connect(g).connect(this.master);
    o.start(now);
    o.stop(now + 0.24);
  }

  boost(on, intensity = 1) {
    if (!this.ctx || !this.boostGain) {
      if (on) this.ensure();
      if (!this.boostGain) return;
    }
    const t = this.ctx.currentTime;
    this.boostGain.gain.cancelScheduledValues(t);
    this.boostGain.gain.linearRampToValueAtTime(on ? 0.11 * intensity : 0, t + 0.07);
  }

  death(isPlayer) {
    if (!this.enabled || !this.ensure()) return;
    const c = this.ctx;
    const now = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(isPlayer ? 1400 : 800, now);
    lp.frequency.exponentialRampToValueAtTime(90, now + (isPlayer ? 0.8 : 0.32));
    const g = c.createGain();
    g.gain.setValueAtTime(isPlayer ? 0.45 : 0.12, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + (isPlayer ? 0.9 : 0.34));
    src.connect(lp).connect(g).connect(this.master);
    src.start(now);
    src.stop(now + 1.0);
  }

  kill() {
    if (!this.enabled || !this.ensure()) return;
    const c = this.ctx;
    const now = c.currentTime;
    [660, 990].forEach((f, i) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'square';
      o.frequency.value = f;
      const t0 = now + i * 0.085;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(0.10, t0 + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.22);
      o.connect(g).connect(this.master);
      o.start(t0);
      o.stop(t0 + 0.3);
    });
  }
}
