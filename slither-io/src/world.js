// The simulation. Owns the snakes, the food, the spatial grids and every rule.
//
// Frame order:
//   1. rebuild the food grid (only when dirty enough) and the body grid
//   2. steer  (player input, then one bot decision pass)
//   3. move   (fixed 8ms ticks, with the remainder carried across frames)
//   4. eat    (heads vs food, with the magnet pull)
//   5. collide(heads vs foreign bodies, and heads vs the wall)
//   6. resolve deaths -> corpse orbs -> respawn bots
//
// Only heads are tested against bodies. Your own body is never a hazard, which
// is the rule that makes the whole game work: length is not armour, and a
// 500-length snake dies to a 12-length one that gets in front of it.

import {
  ARENA_R, TICK_MS, TICKS_PER_SEC, BOT_COUNT, NAME_POOL, SKINS,
  FOOD_TARGET, MAX_COLLISION_NODES, FOOD_MAGNET, START_MASS, SPAWN_GRACE,
} from './config.js';
import { SpatialGrid } from './spatial.js';
import { Snake } from './snake.js';
import { FoodField, PreyField, PREY_MASS, KIND_CORPSE } from './food.js';
import { makeBrain, driveBot } from './bots.js';
import { makeRng, randRange, pick, TAU, clamp } from './math.js';

const BODY_CELL = 260;
const FOOD_CELL = 220;

export class World {
  constructor(seed = (Math.random() * 1e9) | 0) {
    this.rng = makeRng(seed);
    this.snakes = [];
    this.player = null;
    this.food = new FoodField(this.rng);
    this.prey = new PreyField(this.rng);
    this.bodyGrid = new SpatialGrid(ARENA_R + 400, BODY_CELL, MAX_COLLISION_NODES);
    this.foodGrid = new SpatialGrid(ARENA_R + 400, FOOD_CELL, 32000);
    this.time = 0;
    this.tickAcc = 0;
    this.events = []; // {type, x, y, ...} consumed by audio/fx each frame
    this.collisionNodes = 0;
    this.deathToll = 0;
    this._tmp = [0, 0];
    this._rgb = [0, 0, 0];

    for (let i = 0; i < BOT_COUNT + 1; i++) this.snakes.push(new Snake(i));
    this.food.fill(FOOD_TARGET);
    this.rebuildFoodGrid();
  }

  // -------------------------------------------------------------- population
  /**
   * Random spawn point that is not sitting inside somebody's body, with a
   * heading that points at the emptiest nearby direction. The grid has to be
   * current for this to mean anything, so callers rebuild it first.
   */
  findSpawn(clearance = 700, radiusFrac = 0.84) {
    const rng = this.rng;
    let bestX = 0;
    let bestY = 0;
    let bestClear = -1;
    for (let attempt = 0; attempt < 48; attempt++) {
      const a = rng() * TAU;
      const rad = Math.sqrt(rng()) * (ARENA_R * radiusFrac);
      const x = Math.cos(a) * rad;
      const y = Math.sin(a) * rad;
      // Nearest body node distance, capped at the clearance we care about.
      let near = clearance * clearance;
      this.bodyGrid.forEachNear(x, y, clearance, (i) => {
        const dx = this.bodyGrid.x[i] - x;
        const dy = this.bodyGrid.y[i] - y;
        const d = dx * dx + dy * dy;
        if (d < near) near = d;
      });
      if (near > bestClear) {
        bestClear = near;
        bestX = x;
        bestY = y;
        if (near >= clearance * clearance) break; // nothing within reach, done
      }
    }
    return [bestX, bestY, this.openHeading(bestX, bestY)];
  }

  /** Of eight headings, the one with the most empty space ahead. */
  openHeading(x, y) {
    let bestA = Math.atan2(-y, -x);
    let bestScore = -Infinity;
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * TAU;
      const px = x + Math.cos(a) * 520;
      const py = y + Math.sin(a) * 520;
      let score = -Math.hypot(px, py) / ARENA_R * 600; // prefer inward
      let near = 900 * 900;
      this.bodyGrid.forEachNear(px, py, 900, (i) => {
        const dx = this.bodyGrid.x[i] - px;
        const dy = this.bodyGrid.y[i] - py;
        const d = dx * dx + dy * dy;
        if (d < near) near = d;
      });
      score += Math.sqrt(near);
      if (score > bestScore) {
        bestScore = score;
        bestA = a;
      }
    }
    return bestA;
  }

  startPlayer(name, skin) {
    const s = this.snakes[0];
    this.rebuildBodyGrid();
    // The player enters the middle of the arena, not its edge. Bots spawn
    // anywhere; a fresh player facing a wall inside the first few seconds is
    // just a bad first impression, and the wall is a hazard to discover rather
    // than to be dropped next to.
    const [x, y, a] = this.findSpawn(900, 0.45);
    s.spawn(x, y, a, name || 'anonymous snake', skin, START_MASS, SPAWN_GRACE);
    s.isPlayer = true;
    s.bornAt = this.time;
    this.player = s;
    return s;
  }

  spawnBot(slot) {
    const s = this.snakes[slot];
    const rng = this.rng;
    const [x, y, a] = this.findSpawn(900);
    // Spread starting sizes so the leaderboard has texture from second one.
    // Most bots start small, a fifth start mid-sized, and a couple start as
    // genuine giants -- otherwise the leaderboard takes minutes to mean anything
    // and the player never meets a snake worth killing.
    const roll = rng();
    const m = randRange(rng, 12, 60)
      * (roll < 0.06 ? randRange(rng, 12, 30) : roll < 0.26 ? randRange(rng, 3, 9) : 1);
    s.spawn(x, y, a, pick(rng, NAME_POOL), pick(rng, SKINS), m, SPAWN_GRACE);
    s.brain = makeBrain(rng);
    s.bornAt = this.time;
    return s;
  }

  fillBots() {
    for (let i = 1; i < this.snakes.length; i++) {
      if (!this.snakes[i].alive) this.spawnBot(i);
    }
  }

  // -------------------------------------------------------------- grid builds
  rebuildFoodGrid() {
    const g = this.foodGrid;
    const f = this.food;
    g.clear();
    for (let i = 0; i < f.n; i++) {
      if (f.alive[i]) g.insert(f.x[i], f.y[i], f.r[i], i);
    }
  }

  /**
   * Body nodes for collision, sampled at ~0.85 radius so there are no gaps a
   * head could slip through, and skipping the first stretch behind each head
   * (the neck) which no head could realistically reach anyway.
   */
  rebuildBodyGrid() {
    const g = this.bodyGrid;
    g.clear();
    const out = this._tmp;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const r = s.radius;
      const step = Math.max(6, r * 0.85);
      const len = s.bodyLength;
      for (let d = r * 0.5; d <= len; d += step) {
        s.pointBack(d, out);
        if (g.insert(out[0], out[1], r, s.id) < 0) break;
      }
    }
    this.collisionNodes = g.count;
  }

  // -------------------------------------------------------------- main update
  update(dt, playerIntent) {
    this.time += dt;
    this.events.length = 0;
    for (const s of this.snakes) if (s.alive && s.grace > 0) s.grace -= dt;

    this.rebuildBodyGrid();
    this.rebuildFoodGrid();

    // ---- steer
    if (this.player && this.player.alive && playerIntent) {
      this.player.targetAngle = playerIntent.angle;
      this.player.boosting = playerIntent.boost && this.player.canBoost();
    }
    for (let i = 1; i < this.snakes.length; i++) {
      const s = this.snakes[i];
      if (s.alive) driveBot(s, this, dt);
    }

    // ---- move, on fixed 8ms ticks so speeds/turn rates stay frame-independent
    this.tickAcc += dt * TICKS_PER_SEC;
    let ticks = Math.floor(this.tickAcc);
    this.tickAcc -= ticks;
    if (ticks > 8) ticks = 8; // don't let a stall become a teleport
    for (let t = 0; t < ticks; t++) this.stepAll(1);
    if (this.tickAcc > 0) {
      // keep the fractional remainder so motion is smooth at any refresh rate
      this.stepAll(this.tickAcc);
      this.tickAcc = 0;
    }

    // ---- consume
    this.food.update(dt);
    this.prey.update(dt, (x, y, r) => this.nearestHead(x, y, r));
    this.eatPass(dt);
    this.preyPass();

    // ---- kill
    this.collidePass();

    // ---- restock
    this.food.replenish(FOOD_TARGET);
    this.fillBots();
  }

  stepAll(scale) {
    const f = this.food;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const orbs = s.step(scale);
      if (orbs > 0) {
        s.bandAt(s.bodyLength * 0.98, this._rgb);
        for (let i = 0; i < orbs; i++) {
          const out = this._tmp;
          s.pointBack(s.bodyLength * 0.96, out);
          f.shed(out[0], out[1], s.angle, this._rgb);
        }
      }
    }
  }

  // -------------------------------------------------------------- eating
  eatPass(dt) {
    const f = this.food;
    const g = this.foodGrid;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const eat = s.eatRadius;
      const magnet = eat * FOOD_MAGNET;
      const hx = s.x;
      const hy = s.y;
      g.forEachNear(hx, hy, magnet, (slot) => {
        const i = g.tag[slot];
        if (!f.alive[i]) return;
        const dx = f.x[i] - hx;
        const dy = f.y[i] - hy;
        const d2 = dx * dx + dy * dy;
        if (d2 > magnet * magnet) return;
        const d = Math.sqrt(d2);
        if (d < eat) {
          s.grow(f.mass[i]);
          if (s.isPlayer) {
            this.events.push({ type: 'eat', mass: f.mass[i], big: f.kind[i] === KIND_CORPSE });
          }
          f.remove(i);
        } else {
          // Magnet: closer orbs are pulled harder. Reads as suction.
          const t = 1 - (d - eat) / (magnet - eat);
          f.attract(i, hx, hy, dt, 320 * t * t);
        }
      });
    }
  }

  preyPass() {
    for (const p of this.prey.items) {
      if (!p.alive) continue;
      for (const s of this.snakes) {
        if (!s.alive) continue;
        const rr = s.eatRadius + p.r;
        const dx = s.x - p.x;
        const dy = s.y - p.y;
        if (dx * dx + dy * dy < rr * rr) {
          s.grow(PREY_MASS);
          if (s.isPlayer) this.events.push({ type: 'eat', mass: PREY_MASS, big: true });
          this.prey.respawn(p);
          break;
        }
      }
    }
  }

  // -------------------------------------------------------------- collisions
  collidePass() {
    const g = this.bodyGrid;
    const dead = [];
    for (const s of this.snakes) {
      if (!s.alive) continue;

      // Wall. The original kills you at the border and leaves NO food behind.
      // The wall ignores spawn grace: nobody spawns inside it.
      if (Math.hypot(s.x, s.y) > ARENA_R - s.radius * 0.35) {
        dead.push({ s, byWall: true, killer: -1 });
        continue;
      }
      if (s.grace > 0) continue;

      // Head vs foreign bodies. The head hitbox is a little forgiving so
      // grazing a body at speed does not feel like a cheat death.
      const hr = s.radius * 0.74;
      let killer = -1;
      g.forEachNear(s.x, s.y, hr + s.radius * 3 + 40, (i) => {
        const owner = g.tag[i];
        if (owner === s.id) return;
        const dx = g.x[i] - s.x;
        const dy = g.y[i] - s.y;
        const rr = hr + g.r[i];
        if (dx * dx + dy * dy < rr * rr) {
          killer = owner;
          return true;
        }
      });
      if (killer >= 0) dead.push({ s, byWall: false, killer });
    }

    for (const d of dead) this.kill(d.s, d.byWall, d.killer);
  }

  kill(s, byWall, killerId) {
    if (!s.alive) return;
    s.alive = false;
    this.deathToll++;
    let orbs = 0;
    if (!byWall) orbs = this.food.explode(s);
    if (killerId >= 0) {
      const k = this.snakes[killerId];
      if (k && k.alive) k.kills++;
    }
    this.events.push({
      type: 'death',
      x: s.x,
      y: s.y,
      isPlayer: s.isPlayer,
      byWall,
      score: s.score,
      orbs,
      name: s.name,
      killerName: killerId >= 0 ? this.snakes[killerId].name : null,
      killedByPlayer: killerId === 0,
      rgb: s.avgColor(),
    });
  }

  // -------------------------------------------------------------- queries
  nearestHead(x, y, r) {
    let best = null;
    let bd = r * r;
    for (const s of this.snakes) {
      if (!s.alive) continue;
      const d = (s.x - x) ** 2 + (s.y - y) ** 2;
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  /** Snakes sorted by score, descending. Reuses one array. */
  leaderboard(out = []) {
    out.length = 0;
    for (const s of this.snakes) if (s.alive) out.push(s);
    out.sort((a, b) => b.mass - a.mass);
    return out;
  }

  rankOf(snake, board) {
    for (let i = 0; i < board.length; i++) if (board[i] === snake) return i + 1;
    return board.length;
  }

  aliveCount() {
    let n = 0;
    for (const s of this.snakes) if (s.alive) n++;
    return n;
  }
}
