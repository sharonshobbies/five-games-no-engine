// What the race adds to the world: the three rival birds and the finish banner.
//
// The rivals are drawn with the same BirdView the player uses, tinted per rival and a
// little translucent, and lifted by a couple of world units each so that a pack running
// shoulder to shoulder still reads as four birds rather than one smeared one. The banner
// stands on the terrain at the finish line, so the end of the course is a thing you can
// see coming rather than a number in the HUD.

import * as THREE from '../vendor/three.module.min.js';
import { BirdView } from './birdView.js';
import { finishBannerTexture } from './textures.js';
import { RIVAL_PROFILES } from './race.js';

export class RaceView {
  constructor(terrain) {
    this.t = terrain;
    this.group = new THREE.Group();
    this.group.visible = false;

    this.views = RIVAL_PROFILES.map((p) => new BirdView({
      tint: p.tint, opacity: 0.84, scale: 0.94,
    }));
    for (const v of this.views) {
      v.group.renderOrder = 38;
      this.group.add(v.group);
    }

    this.banner = new THREE.Mesh(
      new THREE.PlaneGeometry(52, 52),
      new THREE.MeshBasicMaterial({
        map: finishBannerTexture(), transparent: true, depthTest: false, depthWrite: false,
      })
    );
    this.banner.renderOrder = 12;
    this.banner.frustumCulled = false;
    this.group.add(this.banner);
  }

  setActive(on) { this.group.visible = on; }

  /** Place the banner once per race, on the ground at the finish line. */
  placeFinish(x) {
    this.banner.position.set(x, this.t.height(x) + 25, 0);
  }

  update(dt, race, dim) {
    for (let i = 0; i < this.views.length; i++) {
      const r = race.rivals[i];
      const v = this.views[i];
      if (!r) { v.setVisible(false); continue; }
      v.setVisible(true);
      v.update(dt, r.bird);
      // stack the pack so overlapping birds stay countable
      v.group.position.y += 2.0 + i * 2.4;
      v.setDim(dim);
    }
    this.banner.material.color.setRGB(dim, dim, dim);
  }
}
