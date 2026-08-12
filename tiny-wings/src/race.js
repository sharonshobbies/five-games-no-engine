// Race mode: the player against three AI birds over a fixed stretch of the same
// generated islands.
//
// The rivals are not a second physics model — each one owns a real `Bird` on the real
// `Terrain` and is stepped with the same substep loop the player is. All an AI does is
// decide, a few times a second, whether its bird is holding the button. Everything that
// makes the player's slide feel the way it does (dive gravity, the friction swap, surface
// adhesion, the launch condition) therefore applies to the rivals unchanged, and a rival
// can bounce, splash and plow exactly like a player who mistimed a dive.
//
// A rival's skill is expressed as the four things that actually separate a good player
// from a bad one:
//
//   react    how often it re-decides (a weak bird commits late and holds too long)
//   look     how far up the slope it reads (a weak bird dives at what is under it)
//   thresh   the slope it calls "downhill" (a weak bird dives into flats and climbs)
//   aim      whether it steers a landing mid-air onto a downslope at all
//
// plus blunders: a weak bird occasionally holds straight into an upslope for a beat,
// which is the mistake that costs a real player their Great Slide chain.

import { Bird, BIRD_R } from './physics.js';
import { mulberry32, clamp } from './rng.js';

const SUBSTEP = 1 / 300;

/** Course length in displayed metres (10 world units == 1 m). */
export const RACE_METRES = 600;

// A race has no night chase, so it needs its own outer bound: the crawl force means a
// bird that is barely playing still creeps forward, and it should not creep forever.
const RACE_TIMEOUT = 240;

// Three rivals whose skill brackets a competent player: Skip races about as well as the
// probe's best scripted bot, Bo about as well as someone who holds the button down and
// hopes. Names and colours are only for the HUD and the sprite tint.
export const RIVAL_PROFILES = [
  { name: 'Skip', skill: 0.90, tint: [1.00, 0.48, 0.42] },
  { name: 'Pip', skill: 0.70, tint: [0.78, 0.58, 1.00] },
  { name: 'Bo', skill: 0.48, tint: [0.45, 0.90, 0.70] },
];

class Rival {
  constructor(terrain, profile, seed, index) {
    this.t = terrain;
    this.name = profile.name;
    this.tint = profile.tint;
    this.index = index;
    this.rnd = mulberry32(seed >>> 0);
    this.bird = new Bird(terrain);
    // Each rival's skill wobbles a little per race, so the field does not finish in the
    // same order every time.
    this.skill = clamp(profile.skill + (this.rnd() - 0.5) * 0.20, 0.20, 1);
    this.react = 0.04 + (1 - this.skill) * 0.20;
    this.look = 4 + (1 - this.skill) * 7;
    this.thresh = -0.02 - (1 - this.skill) * 0.05;
    this.aim = this.skill > 0.55;
    this.blunderRate = (1 - this.skill) * 0.09;
    this.reset(terrain.startX());
  }

  reset(x) {
    this.bird.reset(x);
    this.bird.vx = 160;
    this.bird.vy = 0;
    this.startX = x;
    this.clock = 0;
    this.nextThink = 0;
    this.blunderUntil = -1;
    this.want = false;
    this.finishTime = null;
    this.distance = 0;
  }

  get x() { return this.bird.x; }
  get y() { return this.bird.y; }

  /** Decide whether to be holding the button right now. */
  _think() {
    const b = this.bird, t = this.t;
    if (b.grounded) return t.slope(b.x + this.look) < this.thresh;
    if (!this.aim) return false;
    // Integrate the arc forward and hold only if that puts it down on a downslope —
    // the mid-air "mini tap" a good player uses to line up the next hill.
    let x = b.x, y = b.y, vy = b.vy;
    for (let i = 0; i < 70; i++) {
      x += b.vx / 70; vy -= 620 / 70; y += vy / 70;
      if (y <= t.height(x) + BIRD_R) break;
    }
    return t.slope(x) < -0.05 && vy < 0;
  }

  update(dt, finishX) {
    this.clock += dt;
    if (this.finishTime !== null) return;

    if (this.clock >= this.nextThink) {
      this.nextThink = this.clock + this.react * (0.7 + this.rnd() * 0.6);
      this.want = this._think();
      if (this.rnd() < this.blunderRate) {
        this.blunderUntil = this.clock + 0.22 + this.rnd() * 0.55;
      }
    }
    this.bird.diving = this.clock < this.blunderUntil ? !this.want : this.want;

    let acc = dt;
    while (acc > 0) {
      const h = Math.min(SUBSTEP, acc);
      this.bird.step(h);
      acc -= h;
    }
    this.bird.events.length = 0;   // rivals make no noise and no popups

    this.distance = Math.max(this.distance, (this.bird.x - this.startX) / 10);
    if (this.bird.x >= finishX) this.finishTime = this.clock;
  }
}

export class Race {
  constructor(terrain) {
    this.t = terrain;
    this.rivals = [];
    this.startX = terrain.startX();
    this.finishX = this.startX + RACE_METRES * 10;
    this.clock = 0;
    this.playerFinish = null;
    this.playerPlace = 0;
  }

  /**
   * Fresh race on the current terrain. `seed` is rolled per race so two races on the
   * same day are not the same race. `metres` overrides the course length (?course=N).
   */
  reset(startX, seed, metres = RACE_METRES) {
    this.metres = metres;
    this.startX = startX;
    this.finishX = startX + metres * 10;
    this.clock = 0;
    this.playerFinish = null;
    this.playerPlace = 0;
    this.rivals = RIVAL_PROFILES.map((p, i) =>
      new Rival(this.t, p, (seed + i * 7919) >>> 0, i));
    for (const r of this.rivals) r.reset(startX);
  }

  /** Steps the rivals; returns true once the race is over for the player. */
  update(dt, playerBird) {
    this.clock += dt;
    for (const r of this.rivals) r.update(dt, this.finishX);
    if (this.playerFinish === null && playerBird.x >= this.finishX) {
      this.playerFinish = this.clock;
      // Place = everyone already home, plus you.
      this.playerPlace = 1 + this.rivals.filter((r) => r.finishTime !== null).length;
    }
    return this.playerFinish !== null || this.clock > RACE_TIMEOUT;
  }

  playerProgress(playerBird) {
    return clamp((playerBird.x - this.startX) / (this.finishX - this.startX), 0, 1);
  }

  /**
   * Everyone ordered as they stand right now: finishers first by time, then the rest by
   * how far along the course they are.
   */
  standings(playerBird) {
    const rows = this.rivals.map((r) => ({
      name: r.name,
      you: false,
      tint: r.tint,
      x: r.bird.x,
      progress: clamp((r.bird.x - this.startX) / (this.finishX - this.startX), 0, 1),
      metres: Math.max(0, (r.bird.x - this.startX) / 10),
      time: r.finishTime,
    }));
    rows.push({
      name: 'You',
      you: true,
      tint: [1, 1, 1],
      x: playerBird.x,
      progress: this.playerProgress(playerBird),
      metres: Math.max(0, (playerBird.x - this.startX) / 10),
      time: this.playerFinish,
    });
    rows.sort((a, b) => {
      if (a.time !== null && b.time !== null) return a.time - b.time;
      if (a.time !== null) return -1;
      if (b.time !== null) return 1;
      return b.x - a.x;
    });
    rows.forEach((r, i) => { r.place = i + 1; });
    return rows;
  }

  /** 1-based place the player is currently running in. */
  place(playerBird) {
    return this.standings(playerBird).findIndex((r) => r.you) + 1;
  }
}
