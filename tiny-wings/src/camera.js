// Follow camera.
//
// Framing is driven by view WIDTH, not height: how much hill you can see ahead of the
// bird is the thing that decides whether the game is readable, and that has to stay
// constant whether you are on a 16:9 desktop, an ultrawide, or a portrait phone (the
// original's native shape, where the extra room simply becomes sky).
//
// It leads the bird, zooms out with speed and height so a big launch shows the whole
// arc, and never lets the camera drop below the sea.

import * as THREE from '../vendor/three.module.min.js';
import { clamp, lerp } from './rng.js';

const BASE_W = 272;      // world units of hill visible at rest
const MAX_W = 760;
const MIN_H = 150;       // ultrawide gets extra width rather than a letterbox slot

export class FollowCam {
  constructor(aspect) {
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 2000);
    this.cam.position.z = 500;
    this.aspect = aspect;
    this.w = BASE_W;
    this.targetWidth = BASE_W;
    this.viewW = BASE_W;
    this.viewH = BASE_W / aspect;
    this.x = 0; this.y = 0;
    this.shake = 0;
    this.shakeT = 0;
    // Extra rightward push, as a fraction of the view width. Only the title screen sets
    // it, so the nest and the sleeping bird sit clear of the title card.
    this.xBiasFrac = 0;
  }

  setAspect(a) { this.aspect = a; }

  _resolve() {
    // Pure fit-width on a tall phone would show an absurd column of sky, so the width
    // target shrinks as the aspect narrows — landscape is untouched, portrait lands near
    // the original's own framing of a little over one hill across.
    const fit = clamp(0.55 + 0.45 * this.aspect / 1.6, 0.66, 1.0);
    let vw = this.w * fit;
    let vh = vw / this.aspect;
    // ...and an ultrawide gets extra width rather than a letterbox slot.
    if (vh < MIN_H) { vh = MIN_H; vw = vh * this.aspect; }
    this.viewW = vw;
    this.viewH = vh;
  }

  snap(bird) {
    this.w = this.targetWidth = BASE_W;
    this._resolve();
    this.x = bird.x + this.viewW * (0.16 + this.xBiasFrac);
    this.y = bird.y + this.viewH * 0.10;
    this.shake = 0;
  }

  kick(amount) { this.shake = Math.min(1, this.shake + amount); }

  update(dt, bird, terrain) {
    const sp = bird.speed;
    const alt = Math.max(0, bird.y - terrain.height(bird.x));

    this.targetWidth = clamp(
      BASE_W
      + clamp((sp - 330) / 900, 0, 1) * 300
      + clamp((alt - 55) / 250, 0, 1) * 300,
      BASE_W, MAX_W,
    );
    this.w = lerp(this.w, this.targetWidth, Math.min(1, dt * 2.2));
    this._resolve();

    // horizontal: lead ahead, more when fast
    const lead = 0.10 * this.viewW + clamp(sp / 1200, 0, 1) * 0.16 * this.viewW + bird.vx * 0.055
      + this.xBiasFrac * this.viewW;
    this.x = lerp(this.x, bird.x + lead, Math.min(1, dt * 5.5));

    // vertical: track the bird but bias downward so the hills stay in frame, and never
    // show so much sea that the horizon leaves the top of the screen
    let ty = bird.y + this.viewH * 0.10;
    ty = Math.max(ty, -58 + this.viewH * 0.30);
    this.y = lerp(this.y, ty, Math.min(1, dt * 3.4));

    // shake
    this.shake = Math.max(0, this.shake - dt * 2.6);
    this.shakeT += dt * 47;
    const s = this.shake * this.shake * this.viewH * 0.020;
    const ox = Math.sin(this.shakeT * 1.7) * s;
    const oy = Math.cos(this.shakeT * 2.3) * s;

    const c = this.cam;
    c.left = -this.viewW / 2 + ox;
    c.right = this.viewW / 2 + ox;
    c.top = this.viewH / 2 + oy;
    c.bottom = -this.viewH / 2 + oy;
    c.position.x = this.x;
    c.position.y = this.y;
    c.updateProjectionMatrix();
  }
}
