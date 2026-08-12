// Procedural terrain.
//
// The original's hills are, per EDais's teardown of Tiny Wings, "just the interference
// pattern between a diagonal stripe and sine functions". We use the same idea for the
// *shape*: each island's surface is a sum of three sine waves with island-specific
// amplitude and wavelength, multiplied by a shore envelope so the island rises out of
// the sea. That is C-infinity smooth, so the slide never catches on a crease, and
// slope/curvature are well behaved everywhere (the physics needs both).
//
// Island layout, left to right:
//   [ shore ramp ][ rolling hills ][ ramp down ] ~ shallow bay ~ [ next island's ramp ]
// The island's length is snapped so its trailing edge lands on a TROUGH of the primary
// sine, so the last hill flows continuously downhill into the bay instead of ending in
// an unclearable cliff. A fast bird launches off the last crest and clears the bay
// outright; a slow one skips across the water and climbs the far shore.
//
// World units: 10 units == 1 metre of displayed distance.

import { mulberry32, rngRange, smoothstep, clamp } from './rng.js';

export const SEA_LEVEL = 0;
const SHORE_Y = -4;         // island surface height where it meets the sea
const GAP_FLOOR = -28;      // deepest point of the bay between islands
export const GAP = 115;     // width of open water between islands
const RAMP_IN = 0.052;      // fraction of island length spent rising out of the sea
const RAMP_OUT = 0.050;     // fraction spent sloping back down into the bay

export class Terrain {
  constructor(seed) {
    this.seed = seed >>> 0;
    this.islands = [];
    this._ensure(3);
  }

  _ensure(upto) {
    while (this.islands.length <= upto) {
      const i = this.islands.length;
      const rnd = mulberry32(this.seed + i * 104729 + 7);
      const prev = this.islands[i - 1];
      const x0 = prev ? prev.x1 + GAP : 0;

      // Islands grow: longer wavelengths and taller hills, with the amplitude/wavelength
      // ratio creeping up only slightly so slopes stay slideable rather than becoming
      // cliffs. Bigger hills mean more air and more speed, which is the real escalation.
      const t = Math.min(1, i / 9);
      const wl = rngRange(rnd, 142, 162) + t * 68;
      const amp = wl * (0.200 + t * 0.038) * rngRange(rnd, 0.94, 1.06);
      const base = 34 + t * 24;
      const wantL = rngRange(rnd, 1750, 2150) + t * 950;

      const k1 = (Math.PI * 2) / wl;
      const p1 = rnd() * Math.PI * 2;

      // Snap the island end onto a TROUGH of the primary sine: k1*x1 + p1 = -pi/2 + 2*pi*n
      const target = x0 + wantL;
      const n = Math.round((k1 * target + p1 + Math.PI / 2) / (Math.PI * 2));
      const x1 = (-Math.PI / 2 + n * Math.PI * 2 - p1) / k1;
      const L = x1 - x0;

      this.islands.push({
        index: i, x0, x1, L, amp, wl, base,
        k1, p1,
        // The secondary harmonics stay deliberately gentle. High-frequency content
        // raises the crest curvature, and crest curvature is what throws the bird off
        // the ground — too much and a slow bird chatters into a stream of tiny hops
        // instead of gliding along the hill.
        k2: (Math.PI * 2) / (wl * rngRange(rnd, 0.60, 0.70)),
        k3: (Math.PI * 2) / (wl * rngRange(rnd, 0.28, 0.34)),
        p2: rnd() * Math.PI * 2, p3: rnd() * Math.PI * 2,
        w1: 0.76, w2: 0.15 + rnd() * 0.04, w3: 0.022 + rnd() * 0.022,
        seed: (this.seed + i * 104729 + 7) >>> 0,
      });
    }
  }

  islandIndexAt(x) {
    while (this.islands[this.islands.length - 1].x1 + GAP < x) {
      this._ensure(this.islands.length);
    }
    if (x < 0) return 0;
    for (let i = 0; i < this.islands.length; i++) {
      if (x < this.islands[i].x1 + GAP) return i;
    }
    return this.islands.length - 1;
  }

  island(i) {
    this._ensure(Math.max(0, i));
    return this.islands[clamp(i, 0, this.islands.length - 1)];
  }

  /** Is x over the open water between two islands (or before island 0)? */
  inGap(x) {
    if (x < 0) return true;
    const is = this.island(this.islandIndexAt(x));
    return x > is.x1;
  }

  /** Surface height. Continuous and C1 across every island/gap boundary. */
  height(x) {
    // Left of the world: sea floor falling away, so the start reads as a shoreline.
    if (x < 0) {
      return SHORE_Y + (GAP_FLOOR - SHORE_Y) * smoothstep(-x / 110);
    }

    const is = this.island(this.islandIndexAt(x));

    if (x <= is.x1) {
      const t = (x - is.x0) / is.L;
      const env = smoothstep(t / RAMP_IN) * smoothstep((1 - t) / RAMP_OUT);
      const h =
        is.amp * (is.w1 * Math.sin(x * is.k1 + is.p1) +
                  is.w2 * Math.sin(x * is.k2 + is.p2) +
                  is.w3 * Math.sin(x * is.k3 + is.p3));
      return SHORE_Y + env * (is.base + h - SHORE_Y);
    }

    // channel between islands: cosine dip, zero derivative at both shores
    const u = (x - is.x1) / GAP;
    const d = 0.5 * (1 - Math.cos(u * Math.PI * 2));
    return SHORE_Y + (GAP_FLOOR - SHORE_Y) * d;
  }

  /** dy/dx (central difference; the underlying function is smooth so this is exact enough) */
  slope(x, h = 0.5) {
    return (this.height(x + h) - this.height(x - h)) / (2 * h);
  }

  /** d2y/dx2 */
  secondDeriv(x, h = 1.1) {
    return (this.height(x + h) - 2 * this.height(x) + this.height(x - h)) / (h * h);
  }

  /** Signed curvature of the graph y=f(x): kappa = f'' / (1+f'^2)^1.5 */
  kappa(x) {
    const s = this.slope(x);
    return this.secondDeriv(x) / Math.pow(1 + s * s, 1.5);
  }

  /** First local maximum at or after `from`. */
  findCrest(from, maxScan = 700) {
    let prevSlope = this.slope(from);
    for (let d = 3; d < maxScan; d += 3) {
      const x = from + d;
      const s = this.slope(x);
      if (prevSlope > 0 && s <= 0) {
        // refine
        let lo = x - 3, hi = x;
        for (let k = 0; k < 14; k++) {
          const mid = (lo + hi) / 2;
          if (this.slope(mid) > 0) lo = mid; else hi = mid;
        }
        return (lo + hi) / 2;
      }
      prevSlope = s;
    }
    return from + maxScan * 0.5;
  }

  /** First local minimum (valley floor) at or after `from`. */
  findValley(from, maxScan = 700) {
    let prevSlope = this.slope(from);
    for (let d = 3; d < maxScan; d += 3) {
      const x = from + d;
      const s = this.slope(x);
      if (prevSlope < 0 && s >= 0) return x;
      prevSlope = s;
    }
    return from + maxScan * 0.5;
  }

  /**
   * Coins along the hills and clouds in the sky, deterministic per island.
   * Coins are 3 points each, cloud touches 20 (matching the original's scoring).
   */
  features(i) {
    const is = this.island(i);
    if (is._features) return is._features;
    const rnd = mulberry32(is.seed ^ 0x5bf03635);
    const coins = [];
    const clouds = [];

    let x = is.x0 + is.L * 0.11;
    while (x < is.x1 - is.L * 0.05) {
      if (rnd() < 0.60) {
        // arc hugging a crest
        const cx = this.findCrest(x, 420);
        const n = 3 + Math.floor(rnd() * 4);
        const span = 15 + rnd() * 11;
        for (let j = 0; j < n; j++) {
          const px = cx + (j - (n - 1) / 2) * span;
          const f = n > 1 ? j / (n - 1) : 0.5;
          coins.push({ x: px, y: this.height(px) + 11 + Math.sin(f * Math.PI) * 9 });
        }
      } else {
        // high arc rewarding a big launch
        const cx = x + rnd() * 220;
        const n = 4 + Math.floor(rnd() * 5);
        const span = 23 + rnd() * 14;
        const top = this.height(cx) + 78 + rnd() * 95;
        for (let j = 0; j < n; j++) {
          const px = cx + (j - (n - 1) / 2) * span;
          const f = n > 1 ? j / (n - 1) : 0.5;
          coins.push({ x: px, y: top + Math.sin(f * Math.PI) * 28 - 14 });
        }
      }
      x += 240 + rnd() * 300;
    }

    let cx2 = is.x0 + 240 + rnd() * 420;
    while (cx2 < is.x1) {
      clouds.push({ x: cx2, y: 122 + rnd() * 150, r: 15 + rnd() * 13, seed: rnd() * 1000 });
      cx2 += 430 + rnd() * 540;
    }

    is._features = { coins, clouds };
    return is._features;
  }

  /** Start the bird on the first crest of island 0, the way the original opens. */
  startX() {
    const is = this.island(0);
    return this.findCrest(is.x0 + is.L * RAMP_IN * 1.05, 900);
  }
}
