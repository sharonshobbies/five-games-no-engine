// The snake: a head that steers, plus a trail the body samples.
//
// The body is not a chain of springs. As in the original, the head walks a path
// and every body part sits at a fixed arc-distance behind it along the recorded
// path -- that is what produces the exact follow-the-leader serpentine motion
// (and it means the tail can never overshoot a corner).
//
// The trail is a ring buffer of samples spaced TRAIL_STEP apart, so "the point
// D units behind the head" is an index lookup plus one lerp, not a search.

import {
  MAMU, NSP1, NSP2, SPANGDV, BOOST_MUL, MAX_SC, SC_TO_RADIUS, PART_SEP,
  TRAIL_STEP, MAX_PARTS, BASE_PARTS, SC_PER_PART, START_MASS, TICKS_PER_SEC,
  PART_COEF, PART_EXP,
  BOOST_MIN_MASS, BOOST_MASS_PER_SEC, BOOST_ORB_MASS, BAND_UNITS,
} from './config.js';
import { turnToward, hexToRgb, TAU, clamp } from './math.js';

const TRAIL_CAP = Math.ceil((MAX_PARTS * PART_SEP * MAX_SC) / TRAIL_STEP) + 16;

export class Snake {
  constructor(id) {
    this.id = id;
    this.tx = new Float32Array(TRAIL_CAP);
    this.ty = new Float32Array(TRAIL_CAP);
    this.head = 0; // ring index of the newest sample
    this.samples = 0;
    this.bandRgb = [];
    this.reset();
  }

  reset() {
    this.alive = false;
    this.isPlayer = false;
    this.name = '';
    this.skin = null;
    this.mass = START_MASS;
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.targetAngle = 0;
    this.boosting = false;
    this.boostShed = 0;
    this.samples = 0;
    this.head = 0;
    this.kills = 0;
    this.bornAt = 0;
    this.grace = 0; // seconds of head-collision immunity left
    // bot fields, unused by the player
    this.brain = null;
  }

  spawn(x, y, angle, name, skin, mass, grace = 0) {
    this.reset();
    this.alive = true;
    this.grace = grace;
    this.x = x;
    this.y = y;
    this.angle = angle;
    this.targetAngle = angle;
    this.name = name;
    this.skin = skin;
    this.mass = mass;
    this.bandRgb = skin.bands.map(hexToRgb);
    // Lay a straight starting trail out behind the head so the body has
    // something to sit on from frame one.
    this.samples = 0;
    this.head = 0;
    const dx = -Math.cos(angle) * TRAIL_STEP;
    const dy = -Math.sin(angle) * TRAIL_STEP;
    const need = Math.ceil(this.bodyLength / TRAIL_STEP) + 4;
    for (let i = need; i >= 0; i--) {
      this.pushTrail(x + dx * i, y + dy * i);
    }
  }

  // ------------------------------------------------------------------ derived
  /** Body part count. Sub-linear in mass, capped like the original's mscps. */
  get parts() {
    const over = Math.max(0, this.mass - START_MASS);
    return Math.min(MAX_PARTS, BASE_PARTS + PART_COEF * Math.pow(over, PART_EXP));
  }

  /** [slither] sc = min(6, 1 + (sct - 2) / 106), retuned for our part cap. */
  get sc() {
    return Math.min(MAX_SC, 1 + (this.parts - BASE_PARTS) / SC_PER_PART);
  }

  get radius() {
    return this.sc * SC_TO_RADIUS;
  }

  /** Distance between body parts. [slither] wsep = 6 * sc. */
  get partSep() {
    return PART_SEP * this.sc;
  }

  get bodyLength() {
    return this.parts * this.partSep;
  }

  /** [slither] ssp = nsp1 + nsp2 * sc; fsp = ssp + 0.1, per 8ms tick. */
  get baseSpeed() {
    return NSP1 + NSP2 * this.sc + 0.1;
  }

  get speed() {
    return this.baseSpeed * (this.boosting ? BOOST_MUL : 1);
  }

  /** [slither] scang = 0.13 + 0.87 * ((7 - sc) / 6)^2 -- fat snakes steer badly. */
  get turnRate() {
    const sc = this.sc;
    const scang = 0.13 + 0.87 * Math.pow((7 - sc) / 6, 2);
    const spang = Math.min(1, this.speed / SPANGDV);
    return MAMU * scang * spang; // rad per 8ms tick
  }

  get eatRadius() {
    return this.radius * 1.05 + 12;
  }

  /** Displayed score, the original's "length". */
  get score() {
    return Math.floor(this.mass);
  }

  // ------------------------------------------------------------------ trail
  pushTrail(x, y) {
    this.head = (this.head + 1) % TRAIL_CAP;
    this.tx[this.head] = x;
    this.ty[this.head] = y;
    if (this.samples < TRAIL_CAP) this.samples++;
  }

  /**
   * Position `d` world units back along the recorded path.
   * Writes into out[0], out[1]. Clamps at the oldest sample.
   */
  pointBack(d, out) {
    const t = d / TRAIL_STEP;
    let i0 = t | 0;
    const maxI = this.samples - 1;
    if (i0 >= maxI) {
      const idx = (this.head - maxI + TRAIL_CAP * 2) % TRAIL_CAP;
      out[0] = this.tx[idx];
      out[1] = this.ty[idx];
      return;
    }
    const f = t - i0;
    const a = (this.head - i0 + TRAIL_CAP * 2) % TRAIL_CAP;
    const b = (this.head - i0 - 1 + TRAIL_CAP * 2) % TRAIL_CAP;
    out[0] = this.tx[a] + (this.tx[b] - this.tx[a]) * f;
    out[1] = this.ty[a] + (this.ty[b] - this.ty[a]) * f;
  }

  // ------------------------------------------------------------------ tick
  /**
   * Advance one simulation tick (TICK_MS). Returns shed-orb count to spawn.
   * @param {number} tickScale fraction of a full tick (for the fractional remainder)
   */
  step(tickScale) {
    // Steering: limited turn rate toward the desired heading.
    this.angle = turnToward(this.angle, this.targetAngle, this.turnRate * tickScale);
    if (this.angle > Math.PI) this.angle -= TAU;
    else if (this.angle < -Math.PI) this.angle += TAU;

    const step = this.speed * tickScale;
    this.x += Math.cos(this.angle) * step;
    this.y += Math.sin(this.angle) * step;

    // Record trail samples at fixed spacing, interpolating if we outran a step.
    const hi = this.head;
    let lx = this.tx[hi];
    let ly = this.ty[hi];
    let dx = this.x - lx;
    let dy = this.y - ly;
    let d = Math.hypot(dx, dy);
    while (d >= TRAIL_STEP) {
      const k = TRAIL_STEP / d;
      lx += dx * k;
      ly += dy * k;
      this.pushTrail(lx, ly);
      dx = this.x - lx;
      dy = this.y - ly;
      d = Math.hypot(dx, dy);
    }

    // Boost burn.
    let orbs = 0;
    if (this.boosting) {
      const cost = (BOOST_MASS_PER_SEC * tickScale) / TICKS_PER_SEC;
      this.mass -= cost;
      this.boostShed += cost;
      while (this.boostShed >= BOOST_ORB_MASS) {
        this.boostShed -= BOOST_ORB_MASS;
        orbs++;
      }
      if (this.mass < BOOST_MIN_MASS) {
        this.mass = BOOST_MIN_MASS;
        this.boosting = false;
      }
    }
    return orbs;
  }

  canBoost() {
    return this.mass > BOOST_MIN_MASS + 0.5;
  }

  grow(m) {
    this.mass += m;
  }

  /** Colour of the band at arc-distance `d` from the head, into out[0..2]. */
  bandAt(d, out) {
    const bands = this.bandRgb;
    const bandLen = this.radius * BAND_UNITS;
    let i = Math.floor(d / bandLen) % bands.length;
    if (i < 0) i += bands.length;
    const c = bands[i];
    out[0] = c[0];
    out[1] = c[1];
    out[2] = c[2];
  }

  /** Average skin colour, for the minimap and leaderboard chips. */
  avgColor() {
    const n = this.bandRgb.length || 1;
    let r = 0, g = 0, b = 0;
    for (const c of this.bandRgb) {
      r += c[0]; g += c[1]; b += c[2];
    }
    return [r / n, g / n, b / n];
  }

  distFromCentre() {
    return Math.hypot(this.x, this.y);
  }
}

export { TRAIL_CAP };
