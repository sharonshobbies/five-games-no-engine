// Coins (3 pts) and cloud touches (20 pts) — the original's two collectibles besides
// slides. Both are laid out deterministically per island by Terrain.features().

import * as THREE from '../vendor/three.module.min.js';
import { PointBatch } from './points.js';
import { coinTexture, cloudTexture } from './textures.js';
import { BIRD_R } from './physics.js';

export class Pickups {
  constructor(terrain) {
    this.t = terrain;
    this.coins = new PointBatch(coinTexture(), 260, { renderOrder: 30 });
    this.taken = new Set();      // "i:j" keys
    this.cloudsTaken = new Set();

    // clouds: a modest pool of textured quads, repositioned each frame
    this.cloudTex = cloudTexture();
    this.cloudGroup = new THREE.Group();
    this.cloudGroup.renderOrder = 6;
    this.cloudPool = [];
    for (let i = 0; i < 10; i++) {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(1, 0.6),
        new THREE.MeshBasicMaterial({ map: this.cloudTex, transparent: true, depthTest: false, depthWrite: false })
      );
      m.renderOrder = 6;
      m.visible = false;
      m.frustumCulled = false;
      this.cloudPool.push(m);
      this.cloudGroup.add(m);
    }
    this.objects = [this.cloudGroup, this.coins.points];
    this.time = 0;
  }

  reset() {
    this.taken.clear();
    this.cloudsTaken.clear();
  }

  /** Returns {coins, clouds} collected this frame. */
  update(dt, bird, camX, viewW, particles, palette) {
    this.time += dt;
    const t = this.t;
    const i0 = t.islandIndexAt(camX - viewW);
    const i1 = t.islandIndexAt(camX + viewW * 1.2);
    let gotCoins = 0, gotClouds = 0;

    this.coins.begin();
    let cloudSlot = 0;
    const bx = bird.x, by = bird.y;
    const grabR = BIRD_R + 9;

    for (let i = i0; i <= i1; i++) {
      const f = t.features(i);
      for (let j = 0; j < f.coins.length; j++) {
        const key = i * 10000 + j;
        if (this.taken.has(key)) continue;
        const c = f.coins[j];
        if (c.x < camX - viewW) continue;
        if (c.x > camX + viewW * 1.2) break;
        const dx = c.x - bx, dy = c.y - by;
        if (dx * dx + dy * dy < grabR * grabR) {
          this.taken.add(key);
          gotCoins++;
          particles.burst(c.x, c.y, 6, [1.0, 0.85, 0.35], 150);
          continue;
        }
        const bob = Math.sin(this.time * 3.0 + j * 0.9 + i) * 1.6;
        this.coins.push(c.x, c.y + bob, 11.5, 1, Math.sin(this.time * 2.2 + j) * 0.25, 1, 1, 1);
      }

      for (let j = 0; j < f.clouds.length; j++) {
        const cl = f.clouds[j];
        if (cl.x < camX - viewW || cl.x > camX + viewW * 1.2) continue;
        const key = i * 10000 + j;
        const gone = this.cloudsTaken.has(key);
        const dx = cl.x - bx, dy = cl.y - by;
        if (!gone && Math.abs(dx) < cl.r * 1.25 && Math.abs(dy) < cl.r * 0.62 + BIRD_R) {
          this.cloudsTaken.add(key);
          gotClouds++;
          particles.dust(bx, by, 1.5, [1, 1, 1]);
          particles.burst(bx, by, 8, [1, 1, 1], 190);
          continue;
        }
        if (cloudSlot < this.cloudPool.length) {
          const m = this.cloudPool[cloudSlot++];
          m.visible = true;
          const drift = Math.sin(this.time * 0.20 + cl.seed) * 12;
          m.position.set(cl.x + drift, cl.y, 0);
          m.scale.set(cl.r * 2.7, cl.r * 2.7, 1);
          const c = palette.cloud;
          m.material.color.setRGB(c[0], c[1], c[2]);
          m.material.opacity = gone ? 0.30 : 0.92;
        }
      }
    }
    for (let k = cloudSlot; k < this.cloudPool.length; k++) this.cloudPool[k].visible = false;
    this.coins.end();
    return { coins: gotCoins, clouds: gotClouds };
  }

  setPxPerUnit(p, dim) {
    this.coins.uniforms.uPxPerUnit.value = p;
    this.coins.uniforms.uDim.value = dim;
  }
}
