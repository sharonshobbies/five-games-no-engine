// The bird: a body quad plus two little wing quads that flap. Wings beat fast while
// gliding (the bird is trying, bless it) and tuck flat while diving.
//
// One class serves the player and the race rivals: a rival passes a tint and an opacity
// so the pack reads as four separate birds, and the same class carries the asleep face
// used for the sunset beat and for the mother asleep on the nest.

import * as THREE from '../vendor/three.module.min.js';
import { birdTexture, wingTexture } from './textures.js';
import { BIRD_R } from './physics.js';
import { clamp, lerp } from './rng.js';

// Four birds on screen must not mean the same canvases drawn and uploaded four times.
let shared = null;
function textures() {
  if (!shared) {
    shared = {
      awake: birdTexture(),
      asleep: birdTexture(256, { asleep: true }),
      wing: wingTexture(),
    };
  }
  return shared;
}

/** The shared bird/wing textures, so the motion smear reuses the very same upload. */
export function birdTextures() { return textures(); }

export class BirdView {
  constructor({ tint = [1, 1, 1], opacity = 1, scale = 1 } = {}) {
    this.group = new THREE.Group();
    this.group.renderOrder = 44;
    this.tint = tint;
    this.dim = 1;
    this.asleep = false;

    const tex = textures();
    this.tex = tex;

    const mk = (map, w, h, order) => {
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({
          map, transparent: true, depthTest: false, depthWrite: false, opacity,
        })
      );
      m.renderOrder = order;
      m.frustumCulled = false;
      return m;
    };

    const S = BIRD_R * 3.0 * scale;
    this.wingBack = mk(tex.wing, S * 0.58, S * 0.58, 43);
    this.body = mk(tex.awake, S, S, 44);
    this.wingFront = mk(tex.wing, S * 0.62, S * 0.62, 45);

    // The wings hinge from the shoulder, which sits left of and above centre, so the
    // pivot has to be offset from the quad centre or the flap looks like a spin.
    this.wingBack.position.set(-BIRD_R * 0.52 * scale, BIRD_R * 0.30 * scale, 0);
    this.wingFront.position.set(-BIRD_R * 0.44 * scale, -BIRD_R * 0.16 * scale, 0);

    this.group.add(this.wingBack, this.body, this.wingFront);
    this.flap = 0;
    this.squash = 1;
    this.setDim(1);
  }

  update(dt, bird) {
    this.group.position.set(bird.x, bird.y, 0);

    // flap rate: fast when gliding through air, near-still when tucked, and asleep means
    // the wings stop altogether
    const rate = this.asleep ? 0 : (bird.grounded ? 5 : (bird.diving ? 7 : 21));
    this.flap += dt * rate;
    const amp = this.asleep ? 0.02 : (bird.grounded ? 0.18 : (bird.diving ? 0.22 : 0.85));
    const a = Math.sin(this.flap) * amp;

    this.wingFront.rotation.z = -0.35 + a;
    this.wingBack.rotation.z = -0.20 - a * 0.8;
    this.wingFront.scale.set(1, 0.75 + 0.35 * Math.cos(this.flap), 1);

    // squash on impact, stretch at speed
    const target = bird.grounded ? 1 : 1 + clamp(bird.speed / 2600, 0, 0.22);
    this.squash = lerp(this.squash, target, Math.min(1, dt * 8));
    this.body.scale.set(this.squash, 1 / this.squash, 1);

    this.group.rotation.z = this.asleep
      ? lerp(this.group.rotation.z, 0, Math.min(1, dt * 3))
      : bird.angle;
  }

  hit(strength) {
    this.squash = 1 + clamp(strength, 0, 0.45);
  }

  /** Swap the face. Used at sunset, and by the mother asleep on the nest. */
  setAsleep(on) {
    if (on === this.asleep) return;
    this.asleep = on;
    this.body.material.map = on ? this.tex.asleep : this.tex.awake;
    this.body.material.needsUpdate = true;
  }

  setDim(d) {
    this.dim = d;
    const [r, g, b] = this.tint;
    this.body.material.color.setRGB(r * d, g * d, b * d);
    this.wingFront.material.color.setRGB(r * d, g * d, b * d);
    this.wingBack.material.color.setRGB(0.72 * r * d, 0.82 * g * d, 0.92 * b * d);
  }

  setVisible(v) { this.group.visible = v; }
}
