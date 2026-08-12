// The king: the one unit you drive yourself, and the only one that can build.
// Camera-relative movement, automatic attacks, one manual ability, a sprint
// that only works at full health, and a troop-command toggle.
import * as THREE from '../vendor/three.module.min.js';
import { unitArt } from './art_units.js';
import { WEAPONS } from './perks.js';
import { merge, cyl, cone, box } from './geo.js';
import { C } from './palette.js';

const BASE_HP = 100;
const WALK = 14;
const SPRINT = 23;
const REGEN = 0.10;       // fraction of max health per second
const REGEN_DELAY = 1.0;
const REVIVE = 10;
const CMD_RADIUS = 11;

/**
 * The four command categories the number keys select. The original lets you
 * command a subset of your army rather than the whole rabble; this is that
 * split, derived from each troop's own tags so it needs no per-unit table.
 */
export const CMD_CATS = [
  { id: 'melee', key: '1', name: 'Melee', test: (d) => d.tags.indexOf('hero') < 0 && d.tags.indexOf('ranged') < 0 },
  { id: 'ranged', key: '2', name: 'Ranged', test: (d) => d.tags.indexOf('hero') < 0 && d.tags.indexOf('ranged') >= 0 },
  { id: 'champion', key: '3', name: 'Champions', test: (d) => d.tags.indexOf('hero') >= 0 },
  { id: 'all', key: '4', name: 'Everyone', test: () => true },
];

function catOf(id) { return CMD_CATS.find((c) => c.id === id) || null; }

export class Hero {
  constructor(world, weaponId) {
    this.w = world;
    this.isHero = true;
    this.tag = 'king';
    this.def = { tags: ['hero'], resist: null };
    this.weapon = WEAPONS[weaponId] || WEAPONS.bow;
    const art = unitArt('king');
    this.mesh = world.acquireMesh('king', 'ally');
    this.h = art.h;
    this.r = art.r;
    this.x = 12; this.z = -10; this.y = 0;
    this.face = Math.PI;
    this.vx = 0; this.vz = 0;
    this.maxHp = BASE_HP; this.hp = BASE_HP;
    this.down = false;
    this.reviveT = 0;
    this.cd = 0;
    this.abilityCd = 0;
    this.hasteT = 0;
    this.invulnT = 0;
    this.healT = 0;
    this.bob = 0;
    this.dmgFlash = 0;
    this.hurtT = 99;
    this.nights = 0;
    this.pending = null;
    this.commanding = false;
    this.holdX = null; this.holdZ = null;
    // Command filter: null = everyone, otherwise one of CMD_CATS.
    this.cmdFilter = null;
    this.lockTarget = null;
    this.usedRing = false;
    this.sprinting = false;
    this.kills = 0;
    this.refresh();
    this.hp = this.maxHp;
  }

  refresh() {
    const m = this.w.mods;
    const frac = this.maxHp ? this.hp / this.maxHp : 1;
    this.maxHp = Math.round(BASE_HP * m.kingHp * (1 + this.w.castleBonus('kingHp')));
    this.hp = Math.min(this.maxHp, this.maxHp * frac);
    const growth = m.growingDmg
      ? Math.pow(2, this.nights / Math.max(1, this.w.level.cfg.nights)) : 1;
    this.dmgMul = m.kingDmg * (1 + this.w.castleBonus('kingDmg')) * growth;
    this.speed = WALK * m.kingSpeed;
    this.sprintSpeed = SPRINT * m.kingSpeed;
  }

  onNightStart() {
    this.nights++;
    this.refresh();
    this.hp = this.maxHp;
    this.down = false;
    this.usedRing = false;
    this.abilityCd = 0;
  }

  effDmg() {
    let d = this.dmgMul;
    if (this.w.mods.daredevil) d *= 1 + 1.15 * (1 - this.hp / this.maxHp);
    return d;
  }

  hurt(amount, kind, attacker) {
    if (this.down) return;
    if (this.invulnT > 0) {
      this.w.puffs.burst(this.x, this.y + 1.5, this.z, 2, 0xffe9a8, 0.3, 2, 0.25);
      return;
    }
    const m = this.w.mods;
    let a = amount * (kind === 'melee' ? m.meleeRes : m.rangedRes);
    if (attacker && attacker.def) {
      const mul = attacker.def.mul;
      if (mul && mul.king != null) a *= mul.king;
      if (mul && mul.hero != null) a *= mul.hero;
    }
    this.hp -= a;
    this.hurtT = 0;
    this.dmgFlash = 0.25;
    this.w.audio && this.w.audio.play('kinghurt', 0.35);
    if (this.hp <= 0) {
      this.hp = 0;
      if (m.ringRevive && !this.usedRing) {
        this.usedRing = true;
        this.hp = this.maxHp;
        this.w.puffs.burst(this.x, this.y + 1.6, this.z, 24, C.gold, 0.7, 6, 1.0);
        this.w.audio && this.w.audio.play('revive');
        // and every fallen soldier gets back up
        for (const p of this.w.level.plots) this.w.spawnGarrison(p);
        return;
      }
      this.down = true;
      this.commanding = false;
      this.holdX = null; this.holdZ = null;
      this.clearLock();
      this.reviveT = REVIVE * m.reviveTime;
      this.w.puffs.burst(this.x, this.y + 1.5, this.z, 22, 0xd8d0c0, 0.75, 6, 1.0);
      this.w.audio && this.w.audio.play('kingdown');
    }
  }

  // ---------------------------------------------------------------- commanding
  /** Does this troop match the active command filter? */
  matchesFilter(u) {
    if (!this.cmdFilter || this.cmdFilter === 'all') return true;
    const c = catOf(this.cmdFilter);
    return c ? c.test(u.def) : true;
  }

  /** Verb 1 / 2: R gathers whatever the filter admits, R again releases. */
  toggleCommand() {
    if (this.down) return;
    if (this.commanding) this.releaseCommand();
    else this.gatherCommand();
  }

  gatherCommand() {
    const W = this.w;
    if (this.down) return 0;
    this.holdX = null; this.holdZ = null;
    W.allyHash.query(this.x, this.z, CMD_RADIUS, W._near);
    let n = 0;
    for (const u of W._near) {
      if (u.dead || !this.matchesFilter(u)) continue;
      if (Math.hypot(u.x - this.x, u.z - this.z) <= CMD_RADIUS) { u.commanded = true; n++; }
    }
    this.commanding = n > 0;
    W.audio && W.audio.play(n ? 'click' : 'hit', 0.3);
    return n;
  }

  /** Verb 2: release the group where it stands — that ground becomes its post. */
  releaseCommand() {
    const W = this.w;
    this.commanding = false;
    this.holdX = null; this.holdZ = null;
    for (const u of W.units) if (u.commanded) { u.commanded = false; u.homeX = u.x; u.homeZ = u.z; }
    W.audio && W.audio.play('click');
  }

  /**
   * Verb 3 / 4: hold position, then resume following. The group stays yours
   * either way, which is what separates holding from releasing.
   */
  toggleHold() {
    const W = this.w;
    if (this.down) return;
    if (!this.commanding) {
      if (!this.gatherCommand()) return;
    }
    if (this.holdX == null) {
      this.holdX = this.x; this.holdZ = this.z;
      // Each soldier is posted where it already stands — that is what the white
      // circles mark. Nobody shuffles into a new formation to hold ground.
      for (const u of W.units) {
        if (!u.commanded || u.dead) continue;
        u.postX = u.x; u.postZ = u.z;
      }
      W.puffs.burst(this.x, this.y + 0.4, this.z, 10, 0x8fd4ff, 0.5, 4, 0.5);
    } else {
      this.holdX = null; this.holdZ = null;
      for (const u of W.units) { u.postX = null; u.postZ = null; }
    }
    W.audio && W.audio.play('click');
  }

  /** Verb 5: F cycles the filter through melee → ranged → champions → all. */
  cycleFilter() {
    const i = CMD_CATS.findIndex((c) => c.id === this.cmdFilter);
    const next = CMD_CATS[(i + 1) % CMD_CATS.length];
    this.setFilter(next.id);
    return next;
  }

  /**
   * Verb 6: the number keys pick one category outright. Selecting a category
   * re-forms the group around it: troops that no longer qualify are let go on
   * the spot, and matching troops nearby fall in.
   */
  setFilter(id) {
    const W = this.w;
    this.cmdFilter = id === 'all' ? 'all' : id;
    if (this.commanding) {
      for (const u of W.units) {
        if (u.commanded && !this.matchesFilter(u)) {
          u.commanded = false; u.homeX = u.x; u.homeZ = u.z;
        }
      }
      this.gatherCommand();
      if (!W.units.some((u) => u.commanded)) this.commanding = false;
    }
    W.audio && W.audio.play('click');
    return catOf(this.cmdFilter);
  }

  commandCount() {
    let n = 0;
    for (const u of this.w.units) if (u.commanded && !u.dead) n++;
    return n;
  }

  filterName() {
    const c = catOf(this.cmdFilter);
    return c && c.id !== 'all' ? c.name : 'All troops';
  }

  // -------------------------------------------------------------- target lock
  /**
   * Left Alt locks the auto-attack onto one enemy and holds it there. It is
   * also what Godly Curse reads: the locked target takes +50% from everything.
   */
  toggleLock() {
    const W = this.w;
    if (this.down) return;
    if (this.lockTarget && !this.lockTarget.dead) { this.clearLock(); return; }
    // Prefer what the weapon could actually reach, then widen out.
    const r = Math.max(this.weapon.atk.range, this.weapon.atk.airRange || 0);
    const t = W.nearestEnemy(this.x, this.z, r * 1.6, true)
      || W.nearestEnemy(this.x, this.z, 150, true);
    if (!t) { W.audio && W.audio.play('hit', 0.25); return; }
    this.lockTarget = t;
    W.lockedTarget = t;
    W.audio && W.audio.play('click');
  }

  clearLock() {
    this.lockTarget = null;
    this.lockIdle = 0;
    this.w.lockedTarget = null;
  }

  useAbility() {
    if (this.down || this.abilityCd > 0) return false;
    const ab = this.weapon.ability;
    const W = this.w;
    this.abilityCd = ab.cd * W.mods.abilityCd;
    if (ab.kind === 'heal') {
      const dur = this.hp < this.maxHp * 0.3 ? 4 : 2;
      this.hasteT = dur;
      this.healT = dur;
      W.puffs.burst(this.x, this.y + 1.6, this.z, 16, 0x8ce8a0, 0.5, 4, 0.8);
    } else if (ab.kind === 'cleave') {
      W.explode(this.x, this.y + 1.2, this.z, 5.5,
        this.weapon.atk.dmg * 2 * this.effDmg(), 'enemy', false,
        { side: 'ally', def: { tags: ['melee'], mul: this.weapon.atk.mul } });
      W.puffs.burst(this.x, this.y + 1.0, this.z, 22, 0xdfe6ef, 0.6, 9, 0.45);
    } else if (ab.kind === 'dagger') {
      const lt = this.lockTarget;
      const t = (lt && !lt.dead && Math.hypot(lt.x - this.x, lt.z - this.z) <= 5)
        ? lt : W.nearestEnemy(this.x, this.z, 5, true);
      if (t) {
        W.damageUnit(t, 10 * 3 * this.effDmg(), { side: 'ally', def: { tags: ['melee'], mul: { boss: 3 } } });
        W.puffs.burst(t.x, t.y + t.h * 0.6, t.z, 10, 0xff6a5a, 0.4, 4, 0.4);
        this.abilityCd = (0.75 + 5.25 * (t.hp > 0 ? t.hp / t.maxHp : 0)) * W.mods.abilityCd;
      }
    } else if (ab.kind === 'thunder') {
      this.pending = { t: 1.0, x: this.x, z: this.z, kind: 'thunder' };
    } else if (ab.kind === 'reckon') {
      let n = 0;
      for (const u of W.units.slice()) {
        if (u.side !== 'enemy' || u.dead || u.cursed <= 0) continue;
        W.damageUnit(u, 18 * this.effDmg(), { side: 'ally', def: { tags: [], mul: { boss: 2 } } });
        u.cursed = 0; n++;
        W.puffs.burst(u.x, u.y + u.h * 0.6, u.z, 6, 0x9a5ac8, 0.4, 4, 0.4);
      }
      if (!n) this.abilityCd = 1.5;
    } else if (ab.kind === 'flask') {
      // Potion Vials: mend every soldier in the splash, slow every enemy in it.
      const rad = 11;
      for (const u of W.units) {
        if (u.dead || Math.hypot(u.x - this.x, u.z - this.z) > rad) continue;
        if (u.side === 'ally') {
          u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.4 * W.mods.unitHeal);
          W.puffs.burst(u.x, u.y + u.h * 0.7, u.z, 3, 0x8ce8a0, 0.3, 2, 0.4);
        } else {
          u.slowT = Math.max(u.slowT, 3.2 * W.mods.slowLong);
          u.slowAmt = 0.7;
          W.damageUnit(u, this.weapon.atk.dmg * 2 * this.effDmg(),
            { side: 'ally', def: { tags: [], mul: this.weapon.atk.mul } });
        }
      }
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.2 * W.mods.kingHeal);
      W.puffs.burst(this.x, this.y + 0.6, this.z, 26, 0x9ce8c0, 0.7, 10, 0.8);
    } else if (ab.kind === 'immune') {
      // Battle Ax: the documented payoff is a window of pure immunity.
      this.invulnT = 4;
      W.puffs.burst(this.x, this.y + 1.4, this.z, 20, 0xe8dcb0, 0.6, 5, 0.9);
    } else if (ab.kind === 'drain') {
      // Blood Wand: everything into one target, paid for out of your own health.
      const lt = this.lockTarget;
      const t = (lt && !lt.dead && Math.hypot(lt.x - this.x, lt.z - this.z) <= 26)
        ? lt : W.nearestEnemy(this.x, this.z, 26, true, 'big');
      if (t) {
        const cost = this.maxHp * 0.1;
        this.hp = Math.max(1, this.hp - cost);
        this.hurtT = 0;
        W.damageUnit(t, 120 * this.effDmg(),
          { side: 'ally', def: { tags: [], mul: { boss: 3, highhp: 1.5 } } });
        W.puffs.burst(t.x, t.y + t.h * 0.6, t.z, 22, 0xc23a4a, 0.7, 6, 0.8);
        W.puffs.burst(this.x, this.y + 1.6, this.z, 8, 0x8f2030, 0.4, 3, 0.6);
        if (t.dead) this.onKill();
      } else this.abilityCd = 1.5;
    } else if (ab.kind === 'trap') {
      const g = merge([
        { g: cyl(1.0, 1.1, 0.14, 10), c: 0x4a3a30, p: [0, 0.07, 0] },
        { g: cone(0.16, 0.5, 4), c: 0xc3cbd6, p: [0.5, 0.3, 0] },
        { g: cone(0.16, 0.5, 4), c: 0xc3cbd6, p: [-0.5, 0.3, 0] },
        { g: cone(0.16, 0.5, 4), c: 0xc3cbd6, p: [0, 0.3, 0.5] },
        { g: cone(0.16, 0.5, 4), c: 0xc3cbd6, p: [0, 0.3, -0.5] },
      ]);
      const m = new THREE.Mesh(g, this.w.buildMat);
      m.position.set(this.x, this.w.level.sampleHeight(this.x, this.z) + 0.05, this.z);
      this.w.group.add(m);
      this.w.traps.push({ x: this.x, z: this.z, y: m.position.y, mesh: m, life: 30, dmg: 40 * this.effDmg() });
    }
    W.audio && W.audio.play('ability');
    return true;
  }

  onKill() {
    this.kills++;
    if (this.weapon.atk.lifeOnKill) {
      this.hp = Math.min(this.maxHp, this.hp + this.weapon.atk.lifeOnKill * this.w.mods.kingHeal);
    }
    if (this.w.hasCastlePick('assassin')) this.abilityCd = Math.max(0, this.abilityCd - 0.5);
  }

  update(dt, input, cameraYaw) {
    const W = this.w;
    const m = W.mods;
    if (this.dmgFlash > 0) this.dmgFlash -= dt;
    if (this.abilityCd > 0) this.abilityCd -= dt;
    if (this.hasteT > 0) this.hasteT -= dt;
    if (this.invulnT > 0) this.invulnT -= dt;
    this.hurtT += dt;

    if (this.healT > 0) {
      this.healT -= dt;
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * 0.33 * dt * m.kingHeal);
    }
    if (this.pending) {
      this.pending.t -= dt;
      const py = W.level.sampleHeight(this.pending.x, this.pending.z);
      if (W.rng() < 0.6) {
        W.puffs.spawn(this.pending.x + (W.rng() - 0.5) * 3, py + 3 + W.rng() * 6,
          this.pending.z + (W.rng() - 0.5) * 3, 0xbfe8ff, 0.4, 0.3, 0, 0.4);
      }
      if (this.pending.t <= 0) {
        const p = this.pending;
        W.explode(p.x, py + 1, p.z, 3.5, 25 * 3 * this.effDmg(), 'enemy', false,
          { side: 'ally', def: { tags: [], mul: { flying: 2, boss: 2 } } });
        for (let i = 0; i < 6; i++) {
          W.puffs.spawn(p.x + (W.rng() - 0.5) * 2, py + 2 + i * 2.4, p.z + (W.rng() - 0.5) * 2,
            0xdff4ff, 0.8, 0.35, 0, 0.4);
        }
        this.pending = null;
      }
    }

    // ---- down and reviving
    if (this.down) {
      this.reviveT -= dt;
      // he can still drift toward the keep while down
      let ix = 0, iz = 0;
      if (input.up) iz -= 1; if (input.down) iz += 1;
      if (input.left) ix -= 1; if (input.right) ix += 1;
      if (ix || iz) {
        const [wx, wz] = this.camDir(ix, iz, cameraYaw);
        const nx = this.x + wx * 8 * dt, nz = this.z + wz * 8 * dt;
        if (W.level.sampleHeight(nx, nz) > 0.6 || W.level.deckAt(nx, nz)) { this.x = nx; this.z = nz; }
      }
      this.y = W.groundY(this.x, this.z);
      this.mesh.visible = false;
      if (this.reviveT <= 0) {
        this.down = false;
        this.hp = this.maxHp;
        this.x = 12; this.z = -10;
        this.mesh.visible = true;
        W.puffs.burst(this.x, this.y + 1.5, this.z, 22, C.gold, 0.65, 5, 0.9);
        W.audio && W.audio.play('revive');
      }
      return;
    }
    this.mesh.visible = true;

    // ---- regeneration
    if (this.hp < this.maxHp && this.hurtT > REGEN_DELAY * m.regenDelay) {
      this.hp = Math.min(this.maxHp, this.hp + this.maxHp * REGEN * m.regenRate * m.kingHeal * dt);
    }

    // ---- movement
    let ix = 0, iz = 0;
    if (input.up) iz -= 1; if (input.down) iz += 1;
    if (input.left) ix -= 1; if (input.right) ix += 1;
    this.sprinting = !!input.sprint && this.hp >= this.maxHp - 0.01;
    let spd = (this.sprinting ? this.sprintSpeed : this.speed)
      * (W.phase === 'night' ? m.kingNightSpeed : 1);
    if (ix || iz) {
      const [wx, wz] = this.camDir(ix, iz, cameraYaw);
      this.vx += (wx * spd - this.vx) * Math.min(1, dt * 12);
      this.vz += (wz * spd - this.vz) * Math.min(1, dt * 12);
    } else {
      const k = Math.pow(0.0006, dt);
      this.vx *= k; this.vz *= k;
    }
    const L = W.level;
    const nx = this.x + this.vx * dt, nz = this.z + this.vz * dt;
    const passable = L.sampleHeight(nx, nz) > 0.6 || !!L.deckAt(nx, nz);
    if (passable && Math.hypot(nx, nz) < L.radius + 2) { this.x = nx; this.z = nz; }
    else { this.vx *= 0.2; this.vz *= 0.2; }
    const moving = Math.hypot(this.vx, this.vz) > 0.7;
    if (moving) { this.face = Math.atan2(this.vx, this.vz); this.bob += dt * (this.sprinting ? 15 : 11); }

    // ---- trample
    if (m.trample && moving) {
      W.enemyHash.query(this.x, this.z, 2, W._near);
      for (const u of W._near) {
        if (u.dead || u.fly) continue;
        if (Math.hypot(u.x - this.x, u.z - this.z) < 1.7) {
          W.damageUnit(u, m.trample * 20 * dt, null, true);
          u.x += (u.x - this.x) * dt * 4; u.z += (u.z - this.z) * dt * 4;
          if (u.dead) this.onKill();
        }
      }
    }

    const atkRange = this.weapon.atk.range;
    // ---- target lock upkeep. Two published behaviours: the lock steps to the
    // next enemy when its target dies, and it lets go after a couple of seconds
    // with nothing of yours in range to shoot at.
    if (this.lockTarget) {
      const lt = this.lockTarget;
      const reach = Math.max(atkRange, this.weapon.atk.airRange || 0) * 1.35;
      if (lt.dead) {
        const next = W.nearestEnemy(this.x, this.z, reach, true);
        if (next) { this.lockTarget = next; W.lockedTarget = next; this.lockIdle = 0; }
        else this.clearLock();
      } else if (Math.hypot(lt.x - this.x, lt.z - this.z) > reach) {
        this.lockIdle = (this.lockIdle || 0) + dt;
        if (this.lockIdle > 2.5) this.clearLock(); else W.lockedTarget = lt;
      } else {
        this.lockIdle = 0;
        W.lockedTarget = lt;
      }
    }

    // ---- auto attack
    this.cd -= dt;
    const atk = this.weapon.atk;
    const rate = atk.rate * m.kingRate * (this.hasteT > 0 ? 3 : 1);
    if (this.cd <= 0) {
      const range = atk.range;
      const wide = atk.airRange ? Math.max(range, atk.airRange) : range;
      // A locked target wins whenever it is in reach at all.
      const lt = this.lockTarget;
      const t = (lt && !lt.dead && Math.hypot(lt.x - this.x, lt.z - this.z) <= wide)
        ? lt : W.nearestEnemy(this.x, this.z, wide, true);
      if (t && Math.hypot(t.x - this.x, t.z - this.z) <= (t.fly && atk.airRange ? atk.airRange : range)) {
        this.cd = 1 / rate;
        if (!moving) this.face = Math.atan2(t.x - this.x, t.z - this.z);
        const dmg = atk.dmg * this.effDmg();
        const attacker = { side: 'ally', def: { tags: atk.melee ? ['melee'] : ['ranged'], mul: atk.mul } };
        if (atk.spread) {
          // lightning staff: hits everything in range that stands far enough apart
          const hits = [];
          W.enemyHash.query(this.x, this.z, range, W._near);
          for (const e of W._near) {
            if (e.dead || Math.hypot(e.x - this.x, e.z - this.z) > range) continue;
            let ok = true;
            for (const h of hits) if (Math.hypot(h.x - e.x, h.z - e.z) < atk.spread) { ok = false; break; }
            if (ok) hits.push(e);
          }
          for (const e of hits) {
            W.damageUnit(e, dmg, attacker);
            for (let k = 0; k < 3; k++) {
              W.puffs.spawn(e.x, e.y + 1 + k * 1.4, e.z, 0xdff4ff, 0.3, 0.22, 0, 0.3);
            }
            if (e.dead) this.onKill();
          }
          W.audio && W.audio.play('ability', 0.3);
        } else if (atk.melee) {
          if (atk.splash) {
            W.explode(t.x, t.y + 0.8, t.z, atk.splash, dmg, 'enemy', false, attacker);
          } else {
            W.damageUnit(t, dmg, attacker);
          }
          if (atk.slow) { t.slowT = 1.5 * m.slowLong; t.slowAmt = atk.slow; }
          if (m.kingSlow) { t.slowT = Math.max(t.slowT, 1.5 * m.slowLong); t.slowAmt = m.kingSlow; }
          W.puffs.burst(t.x, t.y + t.h * 0.6, t.z, 3, 0xffeccc, 0.3, 3, 0.3);
          W.audio && W.audio.play('slash', 0.3);
          if (t.dead) this.onKill();
        } else {
          W.fire(atk.proj, this.x, this.y + 2.2, this.z, t, dmg, {
            side: 'ally', attacker, curse: atk.curse || 0,
            splash: atk.splash || 0, slow: atk.slow || 0, allyHeal: atk.allyHeal || 0,
          });
          if (atk.curse) {
            // every existing curse takes a bite when a new one lands
            for (const e of W.units) {
              if (e.side === 'enemy' && !e.dead && e.cursed > 0 && e !== t) {
                W.damageUnit(e, atk.curse * this.effDmg(), attacker);
              }
            }
          }
          W.audio && W.audio.play('bow', 0.35);
        }
      }
    }

    // ---- command ring: on the king while following, on the ground while holding
    W.cmdRing.visible = this.commanding;
    if (this.commanding) {
      const cx = this.holdX != null ? this.holdX : this.x;
      const cz = this.holdZ != null ? this.holdZ : this.z;
      W.cmdRing.position.set(cx, L.sampleHeight(cx, cz) + 0.14, cz);
      // Keep sweeping up nearby troops the filter admits — but only while the
      // group is following. A holding group stays exactly the size you posted.
      if (this.holdX == null) {
        W.allyHash.query(this.x, this.z, CMD_RADIUS, W._near);
        for (const u of W._near) {
          if (u.dead || !this.matchesFilter(u)) continue;
          if (Math.hypot(u.x - this.x, u.z - this.z) < CMD_RADIUS) u.commanded = true;
        }
      }
      if (!this.commandCount()) { this.commanding = false; this.holdX = null; this.holdZ = null; }
    }

    this.y = W.groundY(this.x, this.z);
    this.mesh.position.set(this.x,
      this.y + (moving ? Math.abs(Math.sin(this.bob)) * 0.16 : 0), this.z);
    this.mesh.rotation.y = this.face;
    this.mesh.rotation.z = moving ? Math.sin(this.bob) * 0.05 : 0;
    this.mesh.rotation.x = this.sprinting ? -0.08 : (moving ? -0.03 : 0);
  }

  camDir(ix, iz, yaw) {
    const l = Math.hypot(ix, iz) || 1;
    ix /= l; iz /= l;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    // camera looks from (cos,sin)*d back toward the target, so forward = -(cos,sin)
    const fx = -c, fz = -s;
    const rx = -s, rz = c;
    const wx = fx * -iz + rx * ix;
    const wz = fz * -iz + rz * ix;
    const wl = Math.hypot(wx, wz) || 1;
    return [wx / wl, wz / wl];
  }
}
