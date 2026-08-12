// Dust puffs, water splashes, fever sparkles and the high-speed trail.

import { PointBatch } from './points.js';
import { puffTexture, starTexture } from './textures.js';
import { clamp } from './rng.js';

const MAX = 520;

export class Particles {
  constructor() {
    this.puffs = new PointBatch(puffTexture(), MAX, { renderOrder: 42 });
    this.stars = new PointBatch(starTexture(), 300, { additive: true, renderOrder: 46 });
    this.pool = [];
    for (let i = 0; i < MAX; i++) {
      this.pool.push({ live: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, t: 0, life: 1, size: 4, rot: 0, spin: 0, col: [1, 1, 1], grav: 0, drag: 1.6 });
    }
    this.head = 0;
    this.objects = [this.puffs.points, this.stars.points];
  }

  _spawn() {
    for (let k = 0; k < MAX; k++) {
      const p = this.pool[(this.head + k) % MAX];
      if (!p.live) { this.head = (this.head + k + 1) % MAX; p.live = true; return p; }
    }
    const p = this.pool[this.head];
    this.head = (this.head + 1) % MAX;
    return p;
  }

  /** kind 0 = soft puff, 1 = sparkle star */
  emit(kind, x, y, vx, vy, size, life, col, grav = 0, drag = 1.6, spin = 0) {
    const p = this._spawn();
    p.kind = kind; p.x = x; p.y = y; p.vx = vx; p.vy = vy;
    p.size = size; p.life = life; p.t = 0; p.col = col;
    p.grav = grav; p.drag = drag; p.rot = Math.random() * Math.PI * 2; p.spin = spin;
  }

  dust(x, y, strength, tint = [1, 1, 1]) {
    const n = Math.round(clamp(strength * 9, 3, 16));
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.15 + Math.random() * 0.7);
      const sp = 30 + Math.random() * 130 * strength;
      this.emit(0, x + (Math.random() - 0.5) * 6, y + Math.random() * 3,
        Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1) * 0.7, Math.sin(a) * sp * 0.7,
        4 + Math.random() * 7 * strength, 0.45 + Math.random() * 0.4, tint, -80, 2.6);
    }
  }

  splash(x, y, strength) {
    const n = Math.round(clamp(strength * 14, 6, 28));
    for (let i = 0; i < n; i++) {
      const a = Math.PI * (0.18 + Math.random() * 0.64);
      const sp = 70 + Math.random() * 240 * strength;
      this.emit(0, x + (Math.random() - 0.5) * 8, y,
        Math.cos(a) * sp * (Math.random() < 0.5 ? -1 : 1), Math.sin(a) * sp,
        3 + Math.random() * 5, 0.5 + Math.random() * 0.45,
        [0.78, 0.93, 1.0], -520, 0.9);
    }
  }

  burst(x, y, n, col, spread = 240) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = spread * (0.25 + Math.random());
      this.emit(1, x, y, Math.cos(a) * sp, Math.sin(a) * sp,
        7 + Math.random() * 9, 0.55 + Math.random() * 0.5, col, -70, 1.6,
        (Math.random() - 0.5) * 8);
    }
  }

  update(dt) {
    for (const p of this.pool) {
      if (!p.live) continue;
      p.t += dt;
      if (p.t >= p.life) { p.live = false; continue; }
      p.vy += p.grav * dt;
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
    }
  }

  render(pxPerUnit, dim) {
    this.puffs.begin();
    this.stars.begin();
    this.puffs.uniforms.uPxPerUnit.value = pxPerUnit;
    this.stars.uniforms.uPxPerUnit.value = pxPerUnit;
    this.puffs.uniforms.uDim.value = dim;
    this.stars.uniforms.uDim.value = 1;
    for (const p of this.pool) {
      if (!p.live) continue;
      const f = p.t / p.life;
      const a = f < 0.15 ? f / 0.15 : 1 - (f - 0.15) / 0.85;
      const s = p.size * (p.kind === 0 ? 0.7 + f * 1.1 : 1.25 - f * 0.75);
      const b = p.kind === 0 ? this.puffs : this.stars;
      b.push(p.x, p.y, s, Math.max(0, a) * (p.kind === 0 ? 0.85 : 1), p.rot, p.col[0], p.col[1], p.col[2]);
    }
    this.puffs.end();
    this.stars.end();
  }
}
