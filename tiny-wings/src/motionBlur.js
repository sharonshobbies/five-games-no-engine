// Directional motion blur on the bird.
//
// Two parts, both aligned to the velocity vector rather than to the screen:
//
//   ghosts   the bird's own sprite redrawn at where it actually WAS a few milliseconds
//            ago, sampled from a time-stamped history ring so the smear follows the
//            real curved path through a valley instead of a straight extrapolation.
//   streak   a tapered lens quad trailing the bird, rotated to the direction of travel
//            and stretched with speed — the highlight smear itself.
//
// Both fade in from BLUR_FROM and are capped low: the original stays readable at speed,
// so this reads as a smear and never as a second bird. Below the threshold nothing is
// drawn at all (the meshes go invisible), so slow play costs nothing.

import * as THREE from '../vendor/three.module.min.js';
import { birdTextures } from './birdView.js';
import { streakTexture } from './textures.js';
import { BIRD_R } from './physics.js';
import { clamp } from './rng.js';

// Real play tops out around 650-800 units/s (the probe's best scripted run peaks at
// 749), so the ramp is set against that rather than against MAX_SPEED, which the bird
// only ever approaches falling out of a huge launch.
const BLUR_FROM = 520;        // world units/s the smear starts at
const BLUR_FULL = 900;        // ...and is at full strength by
const GHOSTS = 7;
const GHOST_LAG = 0.006;      // seconds between ghosts (max smear ~ speed * GHOSTS * lag)
const GHOST_ALPHA = 0.17;     // alpha of the nearest ghost at full blur
const HISTORY = 48;

export class MotionBlur {
  constructor() {
    const tex = birdTextures();
    const S = BIRD_R * 3.0;

    this.ghosts = [];
    for (let i = 0; i < GHOSTS; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(S, S),
        new THREE.MeshBasicMaterial({
          map: tex.awake, transparent: true, depthTest: false, depthWrite: false, opacity: 0,
        })
      );
      m.renderOrder = 41;
      m.frustumCulled = false;
      m.visible = false;
      this.ghosts.push(m);
    }

    this.streak = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: streakTexture(), transparent: true, depthTest: false, depthWrite: false,
        blending: THREE.AdditiveBlending, opacity: 0,
      })
    );
    this.streak.renderOrder = 41;
    this.streak.frustumCulled = false;
    this.streak.visible = false;

    this.objects = [...this.ghosts, this.streak];

    // time-stamped path history
    this.hist = new Array(HISTORY);
    for (let i = 0; i < HISTORY; i++) this.hist[i] = { t: 0, x: 0, y: 0, a: 0 };
    this.head = 0;
    this.clock = 0;
    this.filled = 0;
    this.amount = 0;
    this.out = { x: 0, y: 0, a: 0 };
  }

  reset(bird) {
    this.clock = 0;
    this.filled = 0;
    this.head = 0;
    for (const h of this.hist) { h.t = 0; h.x = bird.x; h.y = bird.y; h.a = bird.angle; }
    for (const g of this.ghosts) g.visible = false;
    this.streak.visible = false;
    this.amount = 0;
  }

  /**
   * The path position at time `t`, interpolated between the two samples that bracket it.
   * History is recorded once per frame (~16 ms), and the ghosts are spaced 6 ms apart, so
   * snapping to the nearest sample would collapse several ghosts onto the same point and
   * the smear would read as three discrete birds instead of one blur.
   */
  _sample(t) {
    let newer = null;
    for (let k = 1; k <= Math.min(this.filled, HISTORY); k++) {
      const h = this.hist[(this.head - k + HISTORY) % HISTORY];
      if (h.t <= t) {
        if (!newer) return h;
        const span = newer.t - h.t;
        const f = span > 1e-6 ? (t - h.t) / span : 0;
        const o = this.out;
        o.x = h.x + (newer.x - h.x) * f;
        o.y = h.y + (newer.y - h.y) * f;
        o.a = h.a + (newer.a - h.a) * f;
        return o;
      }
      newer = h;
    }
    return newer || this.hist[0];
  }

  update(dt, bird, dim = 1) {
    this.clock += dt;
    const h = this.hist[this.head];
    h.t = this.clock; h.x = bird.x; h.y = bird.y; h.a = bird.angle;
    this.head = (this.head + 1) % HISTORY;
    this.filled = Math.min(HISTORY, this.filled + 1);

    // Grounded at speed still smears, just a shade less, so the contact with the hill
    // stays legible.
    const blur = clamp((bird.speed - BLUR_FROM) / (BLUR_FULL - BLUR_FROM), 0, 1)
      * (bird.grounded ? 0.78 : 1);
    this.amount = blur;

    if (blur <= 0.001) {
      for (const g of this.ghosts) g.visible = false;
      this.streak.visible = false;
      return;
    }

    for (let i = 0; i < GHOSTS; i++) {
      const g = this.ghosts[i];
      const s = this._sample(this.clock - GHOST_LAG * (i + 1));
      const f = 1 - i / GHOSTS;
      g.visible = true;
      g.position.set(s.x, s.y, 0);
      g.rotation.z = s.a;
      // shrinking down the tail so the trail tapers rather than stamping copies
      const sc = 1 - 0.05 * i;
      g.scale.set(sc, sc, 1);
      g.material.opacity = GHOST_ALPHA * blur * f * f;
      g.material.color.setRGB(dim, dim, dim);
    }

    // the highlight streak, along the direction of travel
    const ang = Math.atan2(bird.vy, bird.vx);
    const len = (BIRD_R * 2.6) + blur * BIRD_R * 7.4;
    const wid = BIRD_R * (1.30 + 0.25 * blur);
    this.streak.visible = true;
    this.streak.scale.set(len, wid, 1);
    this.streak.rotation.z = ang;
    // the bright end sits at the bird, the taper trails behind it
    this.streak.position.set(
      bird.x - Math.cos(ang) * len * 0.5,
      bird.y - Math.sin(ang) * len * 0.5,
      0,
    );
    this.streak.material.opacity = (0.07 + 0.24 * blur) * dim;
  }

  setVisible(v) {
    if (!v) {
      for (const g of this.ghosts) g.visible = false;
      this.streak.visible = false;
    }
  }
}
