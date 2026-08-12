// The mining pod: thrust physics, tile collision, drilling, fuel and hull.

import {
  TILE, POD_W, POD_H, GRAVITY, MAX_FALL, AIR_DRAG_X, GROUND_FRICTION,
  BASE_THRUST, SIDE_THRUST, FALL_SAFE_FT, FALL_TABLE, FUEL_PER_SEC_THRUST,
  FUEL_PER_SEC_SIDE, FUEL_PER_SEC_IDLE, FUEL_PER_SEC_DRILL, DIG_MIN_TIME,
  DIG_MAX_TIME, SURFACE_ROW, START_CASH, FEET_PER_TILE, LAVA_DAMAGE_FULL,
  LAVA_DAMAGE_GRAZE, LAVA_TICK, LAVA_CONVERTER_CASH, REGEN_HULL_PER_SEC,
  GAS_TRIGGER_PROGRESS, SKY_CEILING_FT,
} from "./config.js";
import { T } from "./world.js";
import { tierValue, FUEL_INTEGRATOR_LITRES } from "./upgrades.js";
import { SELLABLE, cargoUnits, sellValue, sellPoints } from "./ore.js";

const HALF_W = POD_W / 2;
const HALF_H = POD_H / 2;

export class Pod {
  constructor(world) {
    this.world = world;
    this.tiers = { fuel: 0, drill: 0, engine: 0, hull: 0, cargo: 0, radiator: 0 };
    this.items = { dynamite: 0, plastic: 0, teleporter: 0, transmitter: 0, reserve: 0, nanobots: 0 };
    this.blueprints = {};
    this.eggs = {};              // guardian, oilbird, mrdog
    this.cash = START_CASH;
    this.score = 0;
    this.satanHeads = 0;         // one per Mr. Natas kill; drives New Game+
    this.cargo = {};             // sellable id -> count
    this.hull = this.maxHull();
    this.fuel = this.maxFuel();
    this.stats = { deepest: 0, earned: 0, dug: 0, deaths: 0, highest: 0 };
    this.reset();
  }

  // ---- derived stats --------------------------------------------------------
  maxFuel()  {
    const base = tierValue("fuel", this.tiers.fuel);
    return this.blueprints.fuelIntegrator ? Math.max(base, FUEL_INTEGRATOR_LITRES) : base;
  }
  maxHull()  {
    const base = tierValue("hull", this.tiers.hull);
    return this.blueprints.regenHull ? Math.max(base, 180) : base;
  }
  maxCargo() { return this.blueprints.wormhole ? 99999 : tierValue("cargo", this.tiers.cargo); }
  drillSpeed() {
    const base = tierValue("drill", this.tiers.drill);
    return this.blueprints.multidrill ? Math.max(base, 150) : base;
  }
  enginePower() {
    const base = tierValue("engine", this.tiers.engine);
    return this.blueprints.hyperdrive ? Math.max(base, 240) : base;
  }
  thrustMul() { return 0.88 + (this.enginePower() - 150) / 170; }
  heatResist() {
    const r = tierValue("radiator", this.tiers.radiator) / 100;
    return this.blueprints.magmaConverter ? Math.max(r, 0.8) : r;
  }
  damageMul() { return this.eggs.guardian ? 0.5 : 1; }
  canCutRock() { return !!this.blueprints.multidrill; }

  cargoUsed() {
    let n = 0;
    for (const k in this.cargo) n += this.cargo[k] * cargoUnits(SELLABLE[k]);
    return n;
  }
  cargoValue() {
    let v = 0;
    for (const k in this.cargo) v += this.cargo[k] * sellValue(SELLABLE[k]);
    return v;
  }
  cargoPoints() {
    let v = 0;
    for (const k in this.cargo) v += this.cargo[k] * sellPoints(SELLABLE[k]);
    return v;
  }

  reset() {
    // Column-aligned, clear of every vendor pad, and positioned so the opening
    // camera frames all four shopfronts.
    this.x = 13.5 * TILE;
    this.y = SURFACE_ROW * TILE - HALF_H - 1;
    this.vx = 0; this.vy = 0;
    this.onGround = true;
    this.tilt = 0;
    this.drill = null;
    this.drillSpin = 0;
    this.thrusting = { up: false, left: false, right: false };
    this.dead = false;
    this.heat = 0;
    this.lavaCd = 0;
    this.lavaPending = 0;
    this.fallFromY = this.y;
    this.falling = false;
    this.inLair = false;
    // Mr. Natas's contact bounce: while this is running you cannot arm a charge
    // or teleport, which is exactly what makes touching him a mistake.
    this.bounceLock = 0;
  }

  depthFt() { return this.world.depthFtAt(this.y + HALF_H); }
  altitudeFt() { return Math.max(0, -this.depthFt()); }

  // ---- collision helpers ----------------------------------------------------
  blocked(x, y, skip) {
    const c0 = Math.floor((x - HALF_W) / TILE);
    const c1 = Math.floor((x + HALF_W - 0.01) / TILE);
    const r0 = Math.floor((y - HALF_H) / TILE);
    const r1 = Math.floor((y + HALF_H - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (skip && skip.c === c && skip.r === r) continue;
        if (this.world.isSolid(c, r)) return true;
      }
    }
    return false;
  }

  forEachOverlap(fn) {
    const c0 = Math.floor((this.x - HALF_W) / TILE);
    const c1 = Math.floor((this.x + HALF_W - 0.01) / TILE);
    const r0 = Math.floor((this.y - HALF_H) / TILE);
    const r1 = Math.floor((this.y + HALF_H - 0.01) / TILE);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) fn(c, r);
  }

  // ---- main step ------------------------------------------------------------
  update(dt, input, game) {
    if (this.dead) return;
    const w = this.world;
    const hasFuel = this.fuel > 0;
    this.bounceLock = Math.max(0, this.bounceLock - dt);

    this.updateDrill(dt, input, game);

    const tm = this.thrustMul();
    let ax = 0, ay = 0;
    // Side thrust stays on while drilling sideways: it is what feeds the pod
    // into the tile as the auger chews it. The penetration clamp stops it from
    // overshooting into solid ground.
    const up = input.up && hasFuel;
    const left = input.left && hasFuel;
    const right = input.right && hasFuel;
    this.thrusting.up = up;
    this.thrusting.left = left;
    this.thrusting.right = right;

    if (up) ay -= BASE_THRUST * tm;
    if (left) ax -= SIDE_THRUST * tm;
    if (right) ax += SIDE_THRUST * tm;

    let burn = 0;
    if (up) burn += FUEL_PER_SEC_THRUST;
    if (left || right) burn += FUEL_PER_SEC_SIDE;
    if (!up && !left && !right && !this.drill) burn += FUEL_PER_SEC_IDLE;
    this.fuel = Math.max(0, this.fuel - burn * dt);

    // Sinking a shaft aligns the pod to the column it is cutting. Without this
    // the pod straddles two columns and stands on the one it did not dig.
    if (this.drill && this.drill.dir === "down") {
      const cx = (this.drill.c + 0.5) * TILE;
      const k = Math.min(1, dt * 14);
      this.x += (cx - this.x) * k;
      if (Math.abs(cx - this.x) < 0.6) this.x = cx;
    }

    ay += GRAVITY;
    this.vx += ax * dt;
    this.vy += ay * dt;
    this.vx *= Math.pow(AIR_DRAG_X, dt * 60);
    if (this.onGround && !left && !right) this.vx *= Math.pow(GROUND_FRICTION, dt * 60);
    this.vy = Math.min(this.vy, MAX_FALL);

    // Collision never enters the tile being drilled: the pod presses against it
    // and moves in only once the tile is gone. Abandoning a half-finished dig
    // therefore cannot leave the pod embedded in solid ground.
    // fall tracking, for the distance-based damage table
    if (this.vy > 40 && !this.falling) { this.falling = true; this.fallFromY = this.y; }

    let ny = this.y + this.vy * dt;
    if (this.blocked(this.x, ny)) {
      const dir = Math.sign(this.vy) || 1;
      let lo = 0, hi = Math.abs(ny - this.y);
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (this.blocked(this.x, this.y + dir * mid)) hi = mid; else lo = mid;
      }
      ny = this.y + dir * lo;
      if (this.vy > 0) {
        this.onGround = true;
        this.landed(ny, game);
      }
      this.vy = 0;
    } else {
      this.onGround = false;
    }
    this.y = ny;

    let nx = this.x + this.vx * dt;
    if (this.blocked(nx, this.y)) {
      const dir = Math.sign(this.vx) || 1;
      let lo = 0, hi = Math.abs(nx - this.x);
      for (let i = 0; i < 12; i++) {
        const mid = (lo + hi) / 2;
        if (this.blocked(this.x + dir * mid, this.y)) hi = mid; else lo = mid;
      }
      nx = this.x + dir * lo;
      this.vx = 0;
    }
    this.x = nx;

    this.x = Math.max(TILE + HALF_W, Math.min(this.x, (w.w - 1) * TILE - HALF_W));
    const ceilingY = (SURFACE_ROW - SKY_CEILING_FT / FEET_PER_TILE) * TILE;
    if (this.y < ceilingY) { this.y = ceilingY; this.vy = Math.max(0, this.vy); }

    const targetTilt = (right ? 0.20 : 0) - (left ? 0.20 : 0);
    this.tilt += (targetTilt - this.tilt) * Math.min(1, dt * 9);
    if (this.drill) this.drillSpin += dt * 22;

    this.checkEnvironment(dt, game);

    if (this.blueprints.regenHull && this.hull < this.maxHull()) {
      this.hull = Math.min(this.maxHull(), this.hull + REGEN_HULL_PER_SEC * dt);
    }

    const d = this.depthFt();
    if (d > this.stats.deepest) this.stats.deepest = d;
    const alt = this.altitudeFt();
    if (alt > this.stats.highest) this.stats.highest = alt;
    this.inLair = this.y > w.lair.row0 * TILE;

    if (this.hull <= 0) {
      game.killPod("HULL BREACH", "The pod tore itself apart. Everything in the hold is gone.");
    } else if (this.fuel <= 0.0001 && d > 40 && this.onGround && Math.abs(this.vy) < 8) {
      game.strandedTimer += dt;
      if (game.strandedTimer > 2.2) {
        game.killPod("OUT OF FUEL", "Dead in the dark, thousands of feet down. Nobody is coming.");
      }
    } else {
      game.strandedTimer = 0;
    }
  }

  landed(y, game) {
    if (!this.falling) return;
    this.falling = false;
    const fallenFt = ((y - this.fallFromY) / TILE) * FEET_PER_TILE;
    if (fallenFt <= FALL_SAFE_FT) return;
    let dmg = 8;
    for (const [maxFt, d] of FALL_TABLE) {
      if (fallenFt <= maxFt) { dmg = d; break; }
    }
    dmg *= this.damageMul();
    this.hull -= dmg;
    game.onImpact(dmg, this.x, this.y + HALF_H, fallenFt);
  }

  // ---- drilling -------------------------------------------------------------
  updateDrill(dt, input, game) {
    const w = this.world;
    const cutRock = this.canCutRock();

    // Targets are the tiles just OUTSIDE the box the pod occupies. Probing a
    // few pixels past the hull instead picks the pod's own tile whenever it
    // sits centred in a column.
    const c0 = Math.floor((this.x - HALF_W) / TILE);
    const c1 = Math.floor((this.x + HALF_W - 0.01) / TILE);
    const r1 = Math.floor((this.y + HALF_H - 0.01) / TILE);
    const rr = Math.floor(this.y / TILE);
    const targets = {
      down: { c: Math.floor(this.x / TILE), r: r1 + 1 },
      left: { c: c0 - 1, r: rr },
      right: { c: c1 + 1, r: rr },
    };

    // Never upward: the pod has no upward drill. That is what makes a deep
    // shaft a commitment instead of a convenience.
    let dir = null;
    // Stay on the tile already being chewed so the target does not flip as the
    // pod sinks into it.
    if (this.drill && input[this.drill.dir]
      && w.isDiggable(this.drill.c, this.drill.r, cutRock)) {
      dir = this.drill.dir;
    } else {
      for (const d of ["down", "left", "right"]) {
        if (input[d] && w.isDiggable(targets[d].c, targets[d].r, cutRock)) { dir = d; break; }
      }
    }

    // Blocked by stone: tell the player what to do about it.
    if (!dir) {
      let stone = false;
      for (const d of ["down", "left", "right"]) {
        if (input[d] && w.typeAt(targets[d].c, targets[d].r) === T.ROCK) stone = true;
      }
      if (stone) game.onRockBlocked();
      this.drill = null;
      return;
    }
    if (this.fuel <= 0) { this.drill = null; return; }
    // Sideways digging needs footing, as in the original.
    if (dir !== "down" && !this.onGround) { this.drill = null; return; }

    const t = this.drill && this.drill.dir === dir ? this.drill : null;
    const c = t ? t.c : targets[dir].c;
    const r = t ? t.r : targets[dir].r;
    if (!t) this.drill = { c, r, dir, progress: 0, gasFired: false };

    const hard = w.hardness(c, r);
    const time = Math.max(DIG_MIN_TIME, Math.min(DIG_MAX_TIME,
      (FEET_PER_TILE / this.drillSpeed()) * hard));
    this.drill.progress += dt / time;
    this.drill.time = time;

    this.fuel = Math.max(0, this.fuel - FUEL_PER_SEC_DRILL * dt);
    game.onDrilling(dt, c, r, dir);

    // Gas ignites part-way in, before the tile is even cleared.
    if (!this.drill.gasFired && this.drill.progress > GAS_TRIGGER_PROGRESS && w.hasGas(c, r)) {
      this.drill.gasFired = true;
      game.igniteGas(c, r);
      this.drill = null;
      return;
    }

    if (this.drill.progress >= 1) {
      const got = w.clear(c, r);
      this.stats.dug++;
      game.onTileDug(c, r, got);
      this.drill = null;
    }
  }

  /** Returns "ok" | "full". */
  collect(entry) {
    if (this.cargoUsed() + cargoUnits(entry) > this.maxCargo()) return "full";
    this.cargo[entry.id] = (this.cargo[entry.id] || 0) + 1;
    return "ok";
  }

  sellAll() {
    const v = this.cargoValue();
    const p = this.cargoPoints();
    this.cash += v;
    this.score += p;
    this.stats.earned += v;
    this.cargo = {};
    return { cash: v, points: p };
  }

  damage(amount, game, x, y) {
    const dmg = amount * this.damageMul();
    this.hull -= dmg;
    if (game) game.onImpact(dmg, x ?? this.x, y ?? this.y);
    return dmg;
  }

  // ---- hazards in contact ---------------------------------------------------
  checkEnvironment(dt, game) {
    const w = this.world;
    let lavaTiles = 0, total = 0;
    this.forEachOverlap((c, r) => {
      total++;
      if (w.typeAt(c, r) === T.LAVA) lavaTiles++;
    });

    this.lavaCd = Math.max(0, this.lavaCd - dt);
    if (lavaTiles > 0) {
      this.heat = Math.min(1, this.heat + dt * 1.8);
      if (this.lavaCd <= 0) {
        // One hit per contact window. The sources list two damage magnitudes
        // (58 and 41) and also claim a Steel Hull (50 HP) plus a Single Turbine
        // (-25% -> 43) is the minimum survivable loadout, which only holds if a
        // single touch costs one hit -- so that is what this does.
        const deep = lavaTiles / Math.max(1, total) > 0.4;
        const base = deep ? LAVA_DAMAGE_FULL : LAVA_DAMAGE_GRAZE;
        const dmg = Math.round(base * (1 - this.heatResist()));
        this.damage(dmg, game, this.x, this.y);
        this.lavaPending = dmg;
        this.lavaCd = LAVA_TICK;
        game.onLavaHit(dmg);
        if (this.blueprints.magmaConverter) {
          this.cash += LAVA_CONVERTER_CASH;
          this.stats.earned += LAVA_CONVERTER_CASH;
          game.particles.floatText(this.x, this.y - 30, `+$${LAVA_CONVERTER_CASH}`, "#ffd451");
        }
      }
    } else {
      this.heat = Math.max(0, this.heat - dt * 0.7);
    }
  }
}
