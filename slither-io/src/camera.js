// Camera: follows the player's head, zooms out as the snake fattens.
//
// The follow is critically damped rather than rigid -- a rigid lock makes the
// whole arena jitter with every steering correction. The zoom is smoothed
// harder still, so growth reads as a slow pull-back instead of a snap.

import { zoomForSc } from './config.js';
import { lerp, clamp } from './math.js';

export class CameraRig {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.zoom = 1;
    this.shake = 0;
    this.shakeSeed = 0;
    this.snapped = false;
  }

  snapTo(x, y, sc) {
    this.x = x;
    this.y = y;
    this.zoom = zoomForSc(sc);
    this.snapped = true;
  }

  kick(amount) {
    this.shake = Math.min(1.4, this.shake + amount);
  }

  update(dt, targetX, targetY, sc, boosting) {
    if (!this.snapped) return this.snapTo(targetX, targetY, sc);
    // Lead the camera slightly in the direction of travel while sprinting so
    // boosting feels like it buys you sight-distance.
    const kx = 1 - Math.pow(0.0008, dt);
    this.x = lerp(this.x, targetX, kx);
    this.y = lerp(this.y, targetY, kx);

    const want = zoomForSc(sc) * (boosting ? 0.975 : 1);
    const kz = 1 - Math.pow(0.06, dt);
    this.zoom = lerp(this.zoom, want, kz);

    if (this.shake > 0) {
      this.shake = Math.max(0, this.shake - dt * 2.6);
      this.shakeSeed += dt * 47;
    }
  }

  /** Effective camera centre including shake, into out[0..1]. */
  centre(out) {
    let ox = 0;
    let oy = 0;
    if (this.shake > 0) {
      const a = this.shake * this.shake * 26;
      ox = Math.sin(this.shakeSeed * 1.7) * a;
      oy = Math.cos(this.shakeSeed * 2.3) * a;
    }
    out[0] = this.x + ox;
    out[1] = this.y + oy;
  }

  pxPerUnit(pixelRatioIndependent = 1) {
    return this.zoom * pixelRatioIndependent;
  }
}
