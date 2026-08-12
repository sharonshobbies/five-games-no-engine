// World dressing: the things that make the islands feel lived in without competing with
// the slide for attention.
//
//   nest     a woven nest with two eggs on the first crest, and the mother asleep beside
//            it — the beat the original opens and closes on. It stays where it is, so on
//            a short run you can still see it behind you.
//   zzz      little rising "z"s over a sleeping bird: over the mother the whole time, and
//            over the player's bird once the sun has set on the run.
//   flocks   far-off double-arc silhouettes drifting across the sky, well behind the
//            playfield and slower than the camera, so they read as distance.
//   fish     one jumps out of a bay every few seconds when open water is on screen,
//            arcs under gravity and splashes back in.
//
// Everything here is decoration: nothing in this file touches the bird, the terrain or
// the score, and the whole layer can be dropped without changing a single simulated
// value. Counts are deliberately small — four birds and three fish at a time.

import * as THREE from '../vendor/three.module.min.js';
import { nestTexture, fishTexture, flockBirdTexture, zzzTexture } from './textures.js';
import { birdTextures } from './birdView.js';
import { SEA_LEVEL } from './terrain.js';
import { mulberry32, lerp } from './rng.js';

const FLOCKS = 4;
const FISH = 3;
const ZZZ = 6;    // enough for the mother's stream and the player's at the same time

function quad(map, w, h, order, opts = {}) {
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({
      map, transparent: true, depthTest: false, depthWrite: false, ...opts,
    })
  );
  m.renderOrder = order;
  m.frustumCulled = false;
  return m;
}

export class Dressing {
  constructor(terrain, seed) {
    this.t = terrain;
    this.rnd = mulberry32((seed ^ 0x51ed270b) >>> 0);
    this.group = new THREE.Group();
    this.time = 0;

    // ---- the nest with the eggs still in it, and the mother asleep beside it ----
    // Side by side rather than stacked: a bird sitting behind a nest whose eggs draw over
    // her reads as neither one thing nor the other.
    this.mother = quad(birdTextures().asleep, 33, 33, 11);
    this.nest = quad(nestTexture(), 38, 24, 12);
    this.group.add(this.mother, this.nest);

    // ---- rising z's, shared between the mother and the player at sunset ----
    this.zzz = [];
    for (let i = 0; i < ZZZ; i++) {
      const m = quad(zzzTexture(), 9, 9, 47);
      m.visible = false;
      this.zzz.push({ m, live: false, x: 0, y: 0, t: 0, life: 1, size: 9 });
      this.group.add(m);
    }
    this.zzzTimer = 0;
    this.sleeperTimer = 0;

    // ---- distant flocks ----
    this.flocks = [];
    for (let i = 0; i < FLOCKS; i++) {
      const m = quad(flockBirdTexture(), 10, 5, 4, { opacity: 0.42 });
      m.visible = false;
      this.flocks.push({ m, x: 0, y: 0, vx: 0, phase: this.rnd() * 6.28, size: 1 });
      this.group.add(m);
    }

    // ---- fish in the bays ----
    this.fishTex = fishTexture();
    this.fish = [];
    for (let i = 0; i < FISH; i++) {
      const m = quad(this.fishTex, 13, 8, 8);
      m.visible = false;
      this.fish.push({ m, live: false, x: 0, y: 0, vx: 0, vy: 0 });
      this.group.add(m);
    }
    this.fishTimer = 1.2;

    this.placeNest(terrain.startX());
  }

  /** Put the nest on the crest the trip starts from, with the mother a little behind it. */
  placeNest(startX) {
    const nx = startX - 30;
    const mx = nx - 25;
    this.nestX = nx;
    this.nestY = this.t.height(nx);
    this.motherX = mx;
    this.motherY = this.t.height(mx);
    // each sits at its own ground height, so neither floats off a sloping crest
    this.nest.position.set(nx, this.nestY + 7.5, 0);
    this.mother.position.set(mx, this.motherY + 12.5, 0);
  }

  _spawnZzz(x, y, size) {
    for (const z of this.zzz) {
      if (z.live) continue;
      z.live = true;
      z.x = x; z.y = y; z.t = 0;
      z.life = 1.5 + this.rnd() * 0.7;
      z.size = size;
      return;
    }
  }

  /**
   * `sleeper` is {x, y} for the player's bird once it has fallen asleep, or null while
   * the run is live. The mother is always asleep.
   */
  update(dt, camX, camY, viewW, viewH, dim, sleeper, particles) {
    this.time += dt;

    // ---------------- nest ----------------
    const nestOn = this.nestX > camX - viewW * 0.75 && this.nestX < camX + viewW * 0.75;
    this.nest.visible = nestOn;
    this.mother.visible = nestOn;
    if (nestOn) {
      // she breathes
      const br = 1 + Math.sin(this.time * 1.5) * 0.020;
      this.mother.scale.set(br, 1 / br, 1);
      this.nest.material.color.setRGB(dim, dim, dim);
      // the same bird, a shade paler and warmer for being the adult
      this.mother.material.color.setRGB(dim, dim * 0.96, dim * 0.93);
      this.zzzTimer -= dt;
      if (this.zzzTimer <= 0) {
        this.zzzTimer = 1.35;
        this._spawnZzz(this.motherX + 11, this.motherY + 26, 10);
      }
    }

    // ---------------- the player asleep at sunset ----------------
    if (sleeper) {
      this.sleeperTimer -= dt;
      if (this.sleeperTimer <= 0) {
        this.sleeperTimer = 0.95;
        this._spawnZzz(sleeper.x + 7, sleeper.y + 12, 8);
      }
    } else {
      this.sleeperTimer = 0.35;
    }

    for (const z of this.zzz) {
      if (!z.live) { z.m.visible = false; continue; }
      z.t += dt;
      const f = z.t / z.life;
      if (f >= 1) { z.live = false; z.m.visible = false; continue; }
      const s = z.size * (0.55 + f * 0.85);
      z.m.visible = true;
      z.m.scale.set(s / 9, s / 9, 1);
      z.m.position.set(z.x + Math.sin(f * 3.4) * 4.5, z.y + f * 26, 0);
      z.m.material.opacity = (f < 0.2 ? f / 0.2 : 1 - (f - 0.2) / 0.8) * 0.85 * dim;
    }

    // ---------------- flocks ----------------
    for (let i = 0; i < this.flocks.length; i++) {
      const f = this.flocks[i];
      const offscreen = f.x < camX - viewW * 0.9 || f.x > camX + viewW * 0.9;
      if (offscreen) {
        // re-place ahead of, or behind, the camera at a fresh altitude
        const ahead = this.rnd() < 0.75;
        f.x = camX + (ahead ? 1 : -1) * viewW * (0.55 + this.rnd() * 0.3);
        // kept high in the sky: a silhouette crossing a crest reads as an obstacle
        f.y = camY + viewH * (0.24 + this.rnd() * 0.22);
        f.vx = (ahead ? -1 : 1) * (9 + this.rnd() * 16);
        f.size = 0.5 + this.rnd() * 0.55;
        f.phase = this.rnd() * 6.28;
      }
      f.x += f.vx * dt;
      f.m.visible = true;
      f.m.position.set(f.x, f.y + Math.sin(this.time * 0.9 + f.phase) * 3.5, 0);
      // wings beat by squashing the silhouette vertically
      const beat = 0.55 + 0.45 * Math.abs(Math.sin(this.time * 3.1 + f.phase));
      f.m.scale.set(f.size * (f.vx > 0 ? -1 : 1), f.size * beat, 1);
      f.m.material.opacity = 0.42 * dim;
    }

    // ---------------- fish ----------------
    this.fishTimer -= dt;
    if (this.fishTimer <= 0) {
      this.fishTimer = 1.6 + this.rnd() * 2.6;
      // is there open water on screen to jump out of?
      const x0 = camX - viewW * 0.45, x1 = camX + viewW * 0.45;
      let found = null;
      for (let k = 0; k < 8; k++) {
        const x = lerp(x0, x1, this.rnd());
        if (this.t.height(x) < SEA_LEVEL - 8) { found = x; break; }
      }
      if (found !== null) {
        for (const fs of this.fish) {
          if (fs.live) continue;
          fs.live = true;
          fs.x = found;
          fs.y = SEA_LEVEL - 2;
          // always jumping forward, so the sprite only ever needs rotating, never
          // mirroring — a mirrored fish rotated by its velocity swims on its back
          fs.vx = 5 + this.rnd() * 22;
          fs.vy = 62 + this.rnd() * 46;
          if (particles) particles.splash(found, 1, 0.28);
          break;
        }
      }
    }
    for (const fs of this.fish) {
      if (!fs.live) { fs.m.visible = false; continue; }
      fs.vy -= 190 * dt;
      fs.x += fs.vx * dt;
      fs.y += fs.vy * dt;
      if (fs.y < SEA_LEVEL - 3 && fs.vy < 0) {
        fs.live = false;
        fs.m.visible = false;
        if (particles) particles.splash(fs.x, 1, 0.34);
        continue;
      }
      fs.m.visible = true;
      fs.m.position.set(fs.x, fs.y, 0);
      fs.m.rotation.z = Math.atan2(fs.vy, Math.max(6, fs.vx));
      fs.m.material.color.setRGB(dim, dim, dim);
      fs.m.material.opacity = 0.9;
    }
  }
}
