// Food orbs and prey.
//
// Orbs are stored in parallel typed arrays with a free-list, so the 6000+
// pellets plus every corpse feast churn without allocating. Three flavours:
//   natural  - ambient pellets that keep the arena stocked
//   shed     - dropped behind a boosting snake
//   corpse   - the fat, bright orbs a dead snake leaves behind
//
// Corpse orbs are the whole economy: killing a leader leaves a line of food
// worth two thirds of everything they ate.

import {
  ARENA_R, FOOD_TARGET, FOOD_MASS_MIN, FOOD_MASS_MAX, FOOD_R_BASE,
  DEATH_MASS_FRACTION, DEATH_ORB_MASS, PREY_COUNT, PREY_MASS,
} from './config.js';
import { randRange, neon, TAU, clamp } from './math.js';

export const KIND_NATURAL = 0;
export const KIND_SHED = 1;
export const KIND_CORPSE = 2;

const CAP = 30000;

export class FoodField {
  constructor(rng) {
    this.rng = rng;
    this.x = new Float32Array(CAP);
    this.y = new Float32Array(CAP);
    this.vx = new Float32Array(CAP);
    this.vy = new Float32Array(CAP);
    this.mass = new Float32Array(CAP);
    this.r = new Float32Array(CAP);
    this.cr = new Float32Array(CAP);
    this.cg = new Float32Array(CAP);
    this.cb = new Float32Array(CAP);
    this.phase = new Float32Array(CAP);
    this.kind = new Uint8Array(CAP);
    this.alive = new Uint8Array(CAP);
    this.free = [];
    this.n = 0; // high-water slot
    this.count = 0;
  }

  radiusFor(mass) {
    return FOOD_R_BASE * Math.sqrt(mass) * 0.86 + 2.2;
  }

  add(x, y, mass, kind, rgb, vx = 0, vy = 0) {
    let i;
    if (this.free.length) i = this.free.pop();
    else if (this.n < CAP) i = this.n++;
    else return -1;
    this.alive[i] = 1;
    this.count++;
    this.x[i] = x;
    this.y[i] = y;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.mass[i] = mass;
    this.r[i] = this.radiusFor(mass);
    this.cr[i] = rgb[0];
    this.cg[i] = rgb[1];
    this.cb[i] = rgb[2];
    this.phase[i] = this.rng() * TAU;
    this.kind[i] = kind;
    return i;
  }

  remove(i) {
    if (!this.alive[i]) return;
    this.alive[i] = 0;
    this.count--;
    this.free.push(i);
  }

  /** Seed the arena with ambient pellets. Uniform over the disc. */
  fill(target = FOOD_TARGET) {
    while (this.count < target) this.spawnNatural();
  }

  spawnNatural() {
    const rng = this.rng;
    const a = rng() * TAU;
    // sqrt keeps the distribution uniform in area rather than clumped centrally
    const rad = Math.sqrt(rng()) * (ARENA_R - 90);
    const mass = randRange(rng, FOOD_MASS_MIN, FOOD_MASS_MAX);
    return this.add(Math.cos(a) * rad, Math.sin(a) * rad, mass, KIND_NATURAL, neon(rng));
  }

  /** Top the arena back up gradually so cleared regions refill. */
  replenish(target, maxPerFrame = 14) {
    let added = 0;
    while (this.count < target && added < maxPerFrame) {
      this.spawnNatural();
      added++;
    }
  }

  /** Pellet shed by a boosting snake, tossed slightly off the tail. */
  shed(x, y, angle, rgb) {
    const rng = this.rng;
    const spread = (rng() - 0.5) * 0.8;
    const sp = randRange(rng, 8, 26);
    const a = angle + Math.PI + spread;
    return this.add(
      x + Math.cos(a) * 6, y + Math.sin(a) * 6,
      randRange(rng, 1.1, 1.7), KIND_SHED, rgb,
      Math.cos(a) * sp, Math.sin(a) * sp,
    );
  }

  /**
   * Convert a dead snake into a line of fat orbs along its body.
   * Returns the orb count. The original does not drop food for border deaths --
   * the caller decides whether to call this.
   */
  explode(snake) {
    const total = snake.mass * DEATH_MASS_FRACTION;
    const n = Math.max(3, Math.min(420, Math.round(total / DEATH_ORB_MASS)));
    const per = total / n;
    const rng = this.rng;
    const bodyLen = snake.bodyLength;
    const out = [0, 0];
    const rgb = [0, 0, 0];
    for (let k = 0; k < n; k++) {
      const d = (k / n) * bodyLen;
      snake.pointBack(d, out);
      snake.bandAt(d, rgb);
      // Brighten so a corpse reads as treasure at a glance, but keep enough of
      // the dead snake's hue that you can tell whose feast you are eating.
      const c = [
        clamp(rgb[0] * 0.76 + 0.27, 0, 1),
        clamp(rgb[1] * 0.76 + 0.27, 0, 1),
        clamp(rgb[2] * 0.76 + 0.27, 0, 1),
      ];
      const jr = snake.radius * 0.7;
      const ja = rng() * TAU;
      const jd = rng() * jr;
      const kick = randRange(rng, 12, 52);
      const ka = rng() * TAU;
      this.add(
        out[0] + Math.cos(ja) * jd, out[1] + Math.sin(ja) * jd,
        per, KIND_CORPSE, c,
        Math.cos(ka) * kick, Math.sin(ka) * kick,
      );
    }
    return n;
  }

  /** Damp orb drift; called once per frame. */
  update(dt) {
    const damp = Math.pow(0.0022, dt);
    for (let i = 0; i < this.n; i++) {
      if (!this.alive[i]) continue;
      const vx = this.vx[i];
      const vy = this.vy[i];
      if (vx !== 0 || vy !== 0) {
        this.x[i] += vx * dt;
        this.y[i] += vy * dt;
        this.vx[i] = vx * damp;
        this.vy[i] = vy * damp;
        if (Math.abs(this.vx[i]) < 0.5 && Math.abs(this.vy[i]) < 0.5) {
          this.vx[i] = 0;
          this.vy[i] = 0;
        }
        // Never let drift push an orb outside the wall.
        const d = Math.hypot(this.x[i], this.y[i]);
        if (d > ARENA_R - 40) {
          const k = (ARENA_R - 40) / d;
          this.x[i] *= k;
          this.y[i] *= k;
          this.vx[i] = 0;
          this.vy[i] = 0;
        }
      }
    }
  }

  /** Pull an orb toward a nearby head (the original's magnet feel). */
  attract(i, hx, hy, dt, strength) {
    const dx = hx - this.x[i];
    const dy = hy - this.y[i];
    const d = Math.hypot(dx, dy) || 1;
    const pull = strength * dt;
    this.x[i] += (dx / d) * pull;
    this.y[i] += (dy / d) * pull;
  }
}

// ----------------------------------------------------------------------- prey
// The original's little wandering critters: worth a lot, and they run away.

export class PreyField {
  constructor(rng) {
    this.rng = rng;
    this.items = [];
    for (let i = 0; i < PREY_COUNT; i++) this.items.push(this.make());
  }

  make() {
    const rng = this.rng;
    const a = rng() * TAU;
    const rad = Math.sqrt(rng()) * (ARENA_R - 400);
    return {
      x: Math.cos(a) * rad,
      y: Math.sin(a) * rad,
      angle: rng() * TAU,
      wander: (rng() - 0.5) * 1.4,
      speed: randRange(rng, 90, 150),
      r: 13,
      phase: rng() * TAU,
      rgb: neon(rng),
      alive: true,
      scared: 0,
    };
  }

  update(dt, nearestHead) {
    for (const p of this.items) {
      if (!p.alive) continue;
      // Meander, or bolt if something big is close.
      const threat = nearestHead(p.x, p.y, 420);
      if (threat) {
        const away = Math.atan2(p.y - threat.y, p.x - threat.x);
        p.angle += Math.max(-4 * dt, Math.min(4 * dt, ((away - p.angle + Math.PI * 3) % TAU) - Math.PI));
        p.scared = 1;
      } else {
        p.angle += p.wander * dt;
        p.scared = 0;
        if (this.rng() < dt * 0.6) p.wander = (this.rng() - 0.5) * 1.8;
      }
      const sp = p.speed * (p.scared ? 2.4 : 1);
      p.x += Math.cos(p.angle) * sp * dt;
      p.y += Math.sin(p.angle) * sp * dt;
      const d = Math.hypot(p.x, p.y);
      if (d > ARENA_R - 260) {
        p.angle = Math.atan2(-p.y, -p.x) + (this.rng() - 0.5) * 0.6;
        const k = (ARENA_R - 260) / d;
        p.x *= k;
        p.y *= k;
      }
    }
  }

  respawn(p) {
    Object.assign(p, this.make());
  }
}

export { PREY_MASS };
