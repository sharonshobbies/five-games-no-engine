// dragons.js -- autonomous dragon behaviour.
//
// From the wiki: dragons wander the camp, harvest objects (spending 1 Stamina
// per harvest), carry the harvested item to a free tile at half speed and prefer
// to drop it beside similar items. Only 2 dragons harvest at a time on their own.
// Out of stamina they sleep in a Dragon Home until rested. Defenders attack
// Zomblins and Demon Gates. Max 15 active dragons in camp.

import { def } from './registry.js';

export const MAX_ACTIVE = 15;
const MAX_HARVESTERS = 2;

const SPEED = { base: 1.35, Zoomer: 2.1, Builder: 1.0 };

export class Dragons {
  constructor(game) {
    this.game = game;
    this.list = [];
  }

  attach(obj) {
    if (!obj.d.dragon || obj.dragon) return;
    const dd = obj.d.dragon;
    obj.dragon = {
      state: 'idle',
      px: obj.x, py: obj.y,           // smooth position in tile units
      tx: obj.x, ty: obj.y,           // step target
      facing: 1,
      flap: 0, flapT: 0,
      stamina: dd.stamina,
      maxStamina: dd.stamina,
      progress: 0,
      target: null,
      carrying: null,
      wait: 0.4 + Math.random() * 1.2,
      type: dd.type,
      dp: dd.dp,
      bob: Math.random() * 6.28,
      restT: 0,
      home: null,
      zzz: 0,
    };
    this.list.push(obj);
    return obj.dragon;
  }

  release(obj) {
    const i = this.list.indexOf(obj);
    if (i >= 0) this.list.splice(i, 1);
    if (obj.dragon && obj.dragon.carrying) obj.dragon.carrying = null;
    obj.dragon = null;
  }

  sync() {
    // pick up any dragon objects created by merges
    for (const o of this.game.board.objs) if (o.d.dragon && !o.dragon) this.attach(o);
    for (const o of [...this.list]) if (!this.game.board.objs.includes(o)) this.release(o);
  }

  totalPower() {
    let p = 0;
    for (const o of this.list) p += o.dragon.dp;
    return p;
  }
  count() { return this.list.length; }

  speed(dr) { return (SPEED[dr.type] || SPEED.base) * (dr.carrying ? 0.55 : 1); }

  // ------------------------------------------------------------------------
  update(dt) {
    this.sync();
    const board = this.game.board;
    let harvesting = 0;
    for (const o of this.list) if (o.dragon.state === 'harvest' || o.dragon.state === 'carry') harvesting++;

    for (const o of this.list) {
      const dr = o.dragon;
      // smooth move toward the logical cell
      const sp = this.speed(dr) * dt;
      const ddx = o.x - dr.px, ddy = o.y - dr.py;
      const dist = Math.hypot(ddx, ddy);
      if (dist > 0.001) {
        const step = Math.min(dist, sp);
        dr.px += (ddx / dist) * step;
        dr.py += (ddy / dist) * step;
        if (Math.abs(ddx) > 0.02) dr.facing = ddx > 0 ? 1 : -1;
        dr.flapT += dt * 9;
        dr.flap = Math.floor(dr.flapT) % 3;
      } else {
        dr.px = o.x; dr.py = o.y;
        dr.flapT += dt * 2.4;
        dr.flap = Math.floor(dr.flapT) % 3;
      }
      dr.bob += dt * 3;
      const arrived = dist <= 0.02;

      switch (dr.state) {
        case 'idle': {
          dr.wait -= dt;
          if (dr.wait > 0 || !arrived) break;
          if (dr.stamina <= 0) { this.goRest(o); break; }
          // Defenders prefer hostiles. Trophy dragons have no ability in the
          // real game, so they get no preference here either.
          if (dr.type === 'Defender') {
            const foe = this.findFoe(o);
            if (foe) { dr.target = foe; dr.state = 'seek'; break; }
          }
          if (harvesting < MAX_HARVESTERS) {
            const t = this.findHarvest(o);
            if (t) { dr.target = t; dr.state = 'seek'; harvesting++; break; }
          }
          const foe = this.findFoe(o);
          if (foe && Math.random() < 0.5) { dr.target = foe; dr.state = 'seek'; break; }
          this.wander(o);
          dr.wait = 0.5 + Math.random() * 1.6;
          break;
        }
        case 'seek': {
          const t = dr.target;
          if (!t || !board.objs.includes(t)) { dr.state = 'idle'; dr.target = null; dr.wait = 0.3; break; }
          if (this.adjacentTo(o, t)) {
            dr.state = t.d.hp ? 'attack' : 'harvest';
            dr.progress = 0;
            dr.facing = t.cx > o.cx ? 1 : -1;
            break;
          }
          if (arrived) if (!this.stepToward(o, t.cx - 0.5, t.cy - 0.5)) { dr.state = 'idle'; dr.wait = 0.6; }
          break;
        }
        case 'harvest': {
          const t = dr.target;
          if (!t || !board.objs.includes(t)) { dr.state = 'idle'; dr.target = null; break; }
          const rate = dr.type === 'Harvester' ? 1.5 : dr.type === 'Builder' ? 0.65 : 1;
          dr.progress += dt * rate * 0.45;
          if (dr.progress >= 1) {
            dr.progress = 0;
            this.doHarvest(o, t);
          }
          break;
        }
        case 'attack': {
          const t = dr.target;
          if (!t || !board.objs.includes(t)) { dr.state = 'idle'; dr.target = null; break; }
          dr.progress += dt * (dr.type === 'Defender' ? 0.9 : 0.55);
          if (dr.progress >= 1) {
            dr.progress = 0;
            const dmg = 1 + Math.floor(dr.dp / 20);
            this.game.damage(t, dmg, o);
            this.game.fx.fireball(o, t);
            this.game.audio.fire();
            if (!board.objs.includes(t)) { dr.state = 'idle'; dr.target = null; }
          }
          break;
        }
        case 'carry': {
          if (!dr.carrying) { dr.state = 'idle'; break; }
          if (arrived) {
            const spot = board.findFree(o.x, o.y, 1, 1, 4, true);
            if (spot) {
              const it = board.spawn(dr.carrying, spot[0], spot[1]);
              it.pop = 1;
              this.game.fx.spawnBurst(it);
              this.game.audio.pluck(def(dr.carrying).idx);
              dr.carrying = null;
              dr.state = 'idle';
              dr.wait = 0.3 + Math.random() * 0.8;
            } else if (!this.wander(o)) {
              // no space at all: bubble it into a Loot Orb where the dragon stands
              dr.carrying = null;
              dr.state = 'idle';
            }
          }
          break;
        }
        case 'rest': {
          if (!arrived) break;
          dr.restT += dt;
          dr.zzz += dt;
          const homeLvl = dr.home && board.objs.includes(dr.home) ? dr.home.d.idx : 0;
          const per = 3.2 - homeLvl * 0.3;   // seconds per stamina point
          if (dr.restT >= per) {
            dr.restT = 0;
            dr.stamina = Math.min(dr.maxStamina, dr.stamina + 1);
            if (dr.stamina >= dr.maxStamina) {
              dr.state = 'idle'; dr.home = null; dr.wait = 0.4;
            }
          }
          break;
        }
      }
    }
  }

  // ------------------------------------------------------------------------
  doHarvest(o, t) {
    const dr = o.dragon;
    const board = this.game.board;
    const h = t.d.harvest;
    dr.stamina = Math.max(0, dr.stamina - 1);
    this.game.stats.harvests++;
    if (t.d.tapHeal) {
      this.game.releaseHeal(t, t.d.tapHeal);
    }
    if (h) {
      dr.carrying = h.item;
      dr.state = 'carry';
      t.lastHarvest = board.time;
      t.ready = false;
      this.game.fx.harvestPop(t);
      // walk somewhere to put it down
      const spot = board.findFree(o.x + (Math.random() * 4 - 2), o.y + (Math.random() * 4 - 2), 1, 1, 6, true);
      if (spot) this.pathTo(o, spot[0], spot[1]); else this.wander(o);
    } else {
      dr.state = 'idle';
      dr.wait = 0.4;
    }
    if (dr.stamina <= 0 && dr.state !== 'carry') this.goRest(o);
  }

  findHarvest(o) {
    const board = this.game.board;
    const cands = [];
    for (const t of board.objs) {
      if (t === o || t.hidden) continue;
      const ready = t.d.harvest && (board.time - t.lastHarvest) >= t.d.harvest.every;
      const healable = t.d.tapHeal > 0 && board.deadTiles() > 0 && (board.time - t.lastHarvest) >= 6;
      if (!ready && !healable) continue;
      // taken by another dragon?
      if (this.list.some((d) => d !== o && d.dragon.target === t)) continue;
      const dist = Math.hypot(t.cx - o.cx, t.cy - o.cy);
      if (dist > 14) continue;
      cands.push({ t, dist });
    }
    if (!cands.length) return null;
    cands.sort((a, b) => a.dist - b.dist);
    return cands[Math.floor(Math.random() * Math.min(3, cands.length))].t;
  }

  findFoe(o) {
    const board = this.game.board;
    let best = null, bd = 1e9;
    for (const t of board.objs) {
      if (!t.d.hp || t.hidden) continue;
      const dist = Math.hypot(t.cx - o.cx, t.cy - o.cy);
      if (dist < bd) { bd = dist; best = t; }
    }
    return bd < 12 ? best : null;
  }

  goRest(o) {
    const dr = o.dragon;
    const board = this.game.board;
    let home = null, bd = 1e9;
    for (const t of board.objs) {
      if (t.d.chain !== 'home') continue;
      if (this.list.some((d) => d !== o && d.dragon.home === t)) continue;
      const dist = Math.hypot(t.cx - o.cx, t.cy - o.cy);
      if (dist < bd) { bd = dist; home = t; }
    }
    dr.home = home;
    dr.state = 'rest';
    dr.restT = 0;
    if (home) {
      const spot = board.findFree(home.x, home.y + 1, 1, 1, 3, true);
      if (spot) this.pathTo(o, spot[0], spot[1]);
    }
  }

  adjacentTo(o, t) {
    for (const [ax, ay] of o.cells()) {
      for (const [bx, by] of t.cells()) {
        if (Math.abs(ax - bx) <= 1 && Math.abs(ay - by) <= 1) return true;
      }
    }
    return false;
  }

  // Greedy single-cell step toward (gx,gy).
  stepToward(o, gx, gy) {
    const board = this.game.board;
    const options = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = o.x + dx, ny = o.y + dy;
        if (!board.canDrop(o, nx, ny)) continue;
        options.push({ nx, ny, d: Math.hypot(nx - gx, ny - gy) });
      }
    }
    if (!options.length) return false;
    options.sort((a, b) => a.d - b.d);
    const cur = Math.hypot(o.x - gx, o.y - gy);
    const pick = options[0].d < cur ? options[0] : options[Math.floor(Math.random() * options.length)];
    board.unplace(o);
    board.place(o, pick.nx, pick.ny);
    return true;
  }
  pathTo(o, gx, gy) { return this.stepToward(o, gx, gy); }

  wander(o) {
    const board = this.game.board;
    const options = [];
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        if (board.canDrop(o, o.x + dx, o.y + dy)) options.push([o.x + dx, o.y + dy]);
      }
    }
    if (!options.length) return false;
    const [nx, ny] = options[Math.floor(Math.random() * options.length)];
    board.unplace(o);
    board.place(o, nx, ny);
    return true;
  }

  /** Player dragged a dragon onto an object: task it explicitly. */
  assign(o, t) {
    if (!o.dragon) return false;
    if (!t || t === o) return false;
    if (!t.d.harvest && !t.d.hp && !t.d.tapHeal) return false;
    if (o.dragon.stamina <= 0) { this.game.fx.floatText(o.cx, o.cy, 'Too Tired', '#ff9f9f'); return false; }
    o.dragon.target = t;
    o.dragon.state = 'seek';
    o.dragon.wait = 0;
    return true;
  }
}
