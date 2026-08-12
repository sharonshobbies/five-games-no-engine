// The level runtime: structures on fixed plots, allied troops, enemy waves,
// combat resolution, projectiles and the dawn/dusk bookkeeping.
import * as THREE from '../vendor/three.module.min.js';
import { buildTerrain, buildWater, buildDecor, buildSpawnMarker, animateWater } from './terrain.js';
import { buildingArt, plotMarkerArt } from './art_buildings.js';
import { unitArt, projectileGeos } from './art_units.js';
import { outlineGeo } from './geo.js';
import {
  BUILD_DEFS, CASTLE_UPS, CASTLE_BASE, resolveStats, nextLevelOptions, maxLevel, totalSpent,
  MAP_GATED, RESEARCH, researchOption,
} from './buildings.js';
import { ENEMY_DEFS, ALLY_DEFS, scaleDamage } from './enemies.js';
import { NavGrid, SpatialHash } from './pathing.js';
import { Puffs, HealthBars, makeRing, torchArt, flameArt, Rain } from './fx.js';
import { C } from './palette.js';
import { mulberry } from './levels.js';

const OUTLINE = 0x241d17;

export class World {
  constructor(rnd, level, mods, weaponId, audio) {
    this.R = rnd;
    this.scene = rnd.scene;
    this.level = level;
    this.mods = mods;
    this.audio = audio;
    this.weaponId = weaponId;
    this.rng = mulberry(level.cfg.seed ^ 0xbeef);

    this.group = new THREE.Group();
    this.scene.add(this.group);
    this.unitMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    this.buildMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
    // Faction materials carry a night-only emissive lift, which is what keeps
    // units readable after dark without washing out the daytime palette.
    this.allyMat = new THREE.MeshLambertMaterial({
      vertexColors: true, flatShading: true, emissive: 0x2a3f6b, emissiveIntensity: 0,
    });
    this.enemyMat = new THREE.MeshLambertMaterial({
      vertexColors: true, flatShading: true, emissive: 0x5e2030, emissiveIntensity: 0,
    });
    this.outlineMat = new THREE.MeshBasicMaterial({ color: OUTLINE, side: THREE.BackSide });
    // unlit material for anything that should stay bright after dark
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });

    this.units = [];
    this.projectiles = [];
    this.projPool = [];
    this.meshPool = new Map();
    this.traps = [];

    this.allyHash = new SpatialHash(5);
    this.enemyHash = new SpatialHash(5);
    this._near = [];

    this.gold = 0;
    this.night = 0;
    this.phase = 'day';
    this.score = 0;
    this.loot = 0;
    this.kills = 0;
    this.spawnQueue = [];
    this.nightTime = 0;
    this.lastSpawnTime = 0;
    this.nightBlend = 0;
    this.enemyCount = 0;
    this.destroyedThisNight = 0;
    this.baseScore = 0;
    this.eliteCounter = 0;
    this.lockedTarget = null;
    this.build();
  }

  // ================================================================= setup
  build() {
    const L = this.level;
    this.terrain = buildTerrain(L);
    this.group.add(this.terrain);
    this.water = buildWater(L);
    this.group.add(this.water);
    const decor = buildDecor(L, this.rng);
    if (decor) { this.group.add(decor); this.addOutline(decor, 0.16); }

    this.spawnMarkers = L.spawns.map((s) => {
      const m = buildSpawnMarker(s);
      this.group.add(m);
      this.addOutline(m, 0.16);
      return m;
    });

    // ---- keep
    this.castleMesh = new THREE.Mesh(buildingArt('castle', 1, null).geo, this.buildMat);
    this.castleMesh.castShadow = true;
    this.castleMesh.receiveShadow = true;
    this.castleMesh.position.set(0, L.sampleHeight(0, 0), 0);
    this.group.add(this.castleMesh);
    this.addOutline(this.castleMesh, 0.24);
    this.castle = {
      isCastle: true, x: 0, z: 0, y: L.sampleHeight(0, 0),
      level: 1, picks: [], tag: 'castle', dead: false, cd: 0,
      hp: CASTLE_BASE.hp[0] * this.mods.castleHp,
      maxHp: CASTLE_BASE.hp[0] * this.mods.castleHp,
      def: { tags: [], resist: null },
    };

    // ---- plot markers
    this.markerMat = new THREE.MeshLambertMaterial({
      vertexColors: true, transparent: true, opacity: 0.8,
    });
    const mg = plotMarkerArt();
    for (const p of L.plots) {
      p.marker = new THREE.Mesh(mg, this.markerMat);
      p.marker.position.set(p.x, p.y + 0.09, p.z);
      if (p.kind === 'wall' || p.kind === 'gate') {
        p.marker.scale.set(Math.max(1, (p.segLen || 8) / 5.4), 1, 0.6);
        p.marker.rotation.y = -p.rot;
      }
      this.group.add(p.marker);
      p.mesh = null;
      p.building = null;
      p.rebuildDelay = 0;
    }

    this.nav = new NavGrid(L);
    L.decks.length = 0;
    this.nav.setBlockers(L.plots);
    this.nav.compute(0, 0);

    this.puffs = new Puffs(this.scene, 300);
    this.rain = L.cfg.rain ? new Rain(this.scene, 620) : null;
    this.bars = new HealthBars(this.scene, 520);
    this.selRing = makeRing(3.2, 0xffe9a8, 0.42);
    this.selRing.visible = false;
    this.group.add(this.selRing);
    this.rangeRing = makeRing(20, 0x9fd8ff, 0.4);
    this.rangeRing.visible = false;
    this.group.add(this.rangeRing);
    this.cmdRing = makeRing(11, 0x8fd4ff, 0.5);
    this.cmdRing.visible = false;
    this.group.add(this.cmdRing);
    this.heroRing = makeRing(2.1, 0xa8d4ff, 0.4);
    this.heroRing.material.opacity = 0.95;
    this.group.add(this.heroRing);
    // Target-lock reticle: a hard ring plus four inward ticks, unlit so it
    // still reads at the darkest point of the night.
    this.lockRing = makeRing(2.4, 0xffd24a, 0.55);
    this.lockRing.material.opacity = 0.98;
    this.lockRing.visible = false;
    this.group.add(this.lockRing);
    // One white circle per held soldier — the original's confirmation that a
    // hold-position order landed, and on whom.
    this.holdRings = [];
    for (let i = 0; i < 28; i++) {
      const r = makeRing(1.35, 0xf4f0e2, 0.28);
      r.material.opacity = 0.9;
      r.visible = false;
      this.group.add(r);
      this.holdRings.push(r);
    }

    // ---- torches around the keep
    const tm = new THREE.Mesh(torchArt(), this.buildMat);
    tm.add(new THREE.Mesh(flameArt(), this.glowMat));
    this.torchGroup = new THREE.Group();
    const tp = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const x = Math.cos(a) * 7.6, z = Math.sin(a) * 7.6;
      const y = L.sampleHeight(x, z);
      const t = tm.clone();
      t.position.set(x, y, z);
      t.castShadow = true;
      this.torchGroup.add(t);
      tp.push([x, y + 2.0, z]);
    }
    this.group.add(this.torchGroup);
    this.torchPoints = tp;
    this.torchPoints.push([0, L.sampleHeight(0, 0) + 13, 0]);
    this.R.placeTorches(this.torchPoints);
    this.R.setPalette(L.pal);
  }

  /** Ground height, or the deck height when a built bridge carries the spot. */
  groundY(x, z) {
    const d = this.level.deckAt(x, z);
    if (d) return d.y;
    return this.level.sampleHeight(x, z);
  }

  /** Can a ground unit stand here? Water says no unless a bridge spans it. */
  walkable(x, z) {
    return this.level.sampleHeight(x, z) > 0.5 || !!this.level.deckAt(x, z);
  }

  /** Rebuild the bridge-deck list from whatever spans are currently standing. */
  refreshDecks() {
    const decks = this.level.decks;
    decks.length = 0;
    for (const p of this.level.plots) {
      if (p.kind !== 'bridge' || !p.building || p.dead) continue;
      decks.push({
        x: p.x, z: p.z, y: p.y,
        c: Math.cos(p.rot), s: Math.sin(p.rot),
        halfL: (p.segLen || 10) * 0.5, halfW: 2.4,
      });
    }
    this.nav.setDecks(decks);
  }

  addOutline(mesh, amount) {
    const o = new THREE.Mesh(outlineGeo(mesh.geometry, amount || 0.06), this.outlineMat);
    o.castShadow = false;
    o.receiveShadow = false;
    o.frustumCulled = mesh.frustumCulled;
    mesh.add(o);
    return o;
  }

  // =============================================================== economy
  incomeBreakdown() {
    let base = 0;
    for (const p of this.level.plots) {
      const b = p.building;
      if (!b || p.dead) continue;
      base += Math.max(0, this.buildingIncome(b));
    }
    if (this.mods.mintGold) base += this.castle.level;
    return base;
  }

  buildingIncome(b) {
    // A harbour pays per boat afloat, not a flat sum: it lays down one boat a
    // night up to five, and a night spent in rubble lays none.
    if (b.stats.boat) return b.boats * b.stats.boat;
    let v = b.stats.income || 0;
    if (v <= 0) return 0;
    if (b.stats.decay) v = Math.max(0, v - b.nightsHeld * b.stats.decay + (this.mods.mineBonus ? 1 : 0));
    return v;
  }

  castleBonus(key) {
    let v = 0;
    for (const id of this.castle.picks) {
      for (const step of CASTLE_UPS) {
        const o = step.options.find((x) => x.id === id);
        if (o && o[key]) v += (typeof o[key] === 'number' ? o[key] : 1);
      }
    }
    return v;
  }
  hasCastlePick(id) { return this.castle.picks.indexOf(id) >= 0; }

  // ============================================================== building
  buildCost(def) {
    let c = def.cost;
    if (def.plot === 'unit') c += this.mods.barracksCost;
    if (def.id === 'shrine' && this.mods.freeShrines) c = 0;
    if (def.research) c -= this.mods.researchDiscount;
    return Math.max(0, c);
  }

  blockedByMutator(def) {
    if (this.mods.noWalls && def.plot === 'wall') return true;
    if (this.mods.noWalls && def.plot === 'gate') return true;
    if (this.mods.noTowers && def.plot === 'tower') return true;
    if (this.mods.noUnits && def.plot === 'unit') return true;
    return false;
  }

  /** Buildings gated behind keep level, as in the original tier system. */
  defAvailable(def) {
    const lead = this.mods.architect ? 1 : 0;
    // The original only offers some buildings on some maps.
    if (MAP_GATED[def.id] && (this.level.cfg.extras || []).indexOf(def.id) < 0) return false;
    // One smith of each kind per holding: the developers cut Totend's second
    // Royal Forge for exactly this reason — two of them snowball the map.
    if (def.oneOnly && this.level.plots.some(
      (p) => p.building && p.building.def.id === def.id)) return false;
    // A Field is opened by putting up a Mill, not by the keep.
    if (def.needsMill && !this.level.plots.some(
      (p) => p.building && !p.dead && p.building.def.id === 'mill')) return false;
    if (def.id === 'heroq') return this.castle.level + lead >= 2;
    if (def.id === 'mine' || def.id === 'shrine') return this.castle.level + lead >= 2;
    return true;
  }

  /** Why a building is greyed out, for the panel to say out loud. */
  unavailableReason(def) {
    if (MAP_GATED[def.id] && (this.level.cfg.extras || []).indexOf(def.id) < 0) {
      return 'Not built in this part of the realm';
    }
    if (def.oneOnly) return 'One to a holding — you already have it';
    if (def.needsMill) return 'Needs a Mill standing';
    return 'Needs a higher Castle Center';
  }

  // ============================================================== research
  /** Every research slot on the map, finished or running. */
  researchSlots() {
    const out = [];
    for (const p of this.level.plots) {
      const b = p.building;
      if (!b || !b.stats.research) continue;
      for (const r of b.projects) out.push({ plot: p, kind: b.stats.research, r });
    }
    return out;
  }

  /** How many projects this building may run: one per level. */
  researchCapacity(b) { return b.level; }

  /**
   * Commit a slot to one project. Faster Research is the published shape: a
   * night off the duration, which is the same thing as a day's head start.
   */
  startResearch(plot, optId) {
    const b = plot.building;
    if (!b || !b.stats.research) return false;
    if (b.projects.length >= this.researchCapacity(b)) return false;
    const o = researchOption(b.stats.research, optId);
    if (!o) return false;
    const nights = Math.max(1, o.nights - (this.mods.fasterResearch ? 1 : 0));
    b.projects.push({ id: optId, left: nights, total: nights, done: false });
    this.audio && this.audio.play('upgrade');
    this.puffs.burst(plot.x, plot.y + 2.2, plot.z, 12, 0xffd98a, 0.5, 4, 0.7);
    return true;
  }

  /** Called at dawn: tick every running project, land the ones that finish. */
  advanceResearch(hero) {
    const landed = [];
    for (const p of this.level.plots) {
      const b = p.building;
      if (!b || !b.stats.research) continue;
      for (const r of b.projects) {
        if (r.done) continue;
        r.left -= 1;
        if (r.left <= 0) {
          r.done = true;
          const o = researchOption(b.stats.research, r.id);
          if (o) { o.f(this.mods); landed.push(o); }
          this.puffs.burst(p.x, p.y + 2.6, p.z, 20, C.gold, 0.7, 6, 1.0);
        }
      }
    }
    if (landed.length && hero) hero.refresh();
    return landed;
  }

  canPlace(plot, defId) {
    const def = BUILD_DEFS[defId];
    if (!def || plot.building || plot.rebuildDelay > 0) return false;
    if (def.plot !== plot.kind) return false;
    if (this.blockedByMutator(def) || !this.defAvailable(def)) return false;
    return this.gold >= this.buildCost(def);
  }

  place(plot, defId, variantId) {
    if (!this.canPlace(plot, defId)) return false;
    const def = BUILD_DEFS[defId];
    this.gold -= this.buildCost(def);
    plot.building = {
      def, variant: variantId || (def.variants ? def.variants[0].id : null),
      level: 1, picks: [], stats: null, hp: null, cd: 0, energy: 0,
      nightsHeld: 0, spawnT: 0,
      projects: [],     // multi-night research, one slot per level
      boats: 0,         // fishing harbour: one boat a night, capped
    };
    this.refreshBuilding(plot);
    plot.building.hp = plot.building.maxHp;
    this.rebuildNav();
    this.audio && this.audio.play('build');
    this.puffs.burst(plot.x, plot.y + 1, plot.z, 10, 0xe8dcc0, 0.55, 4, 0.6);
    if (this.phase === 'day') this.spawnGarrison(plot);
    return true;
  }

  levelUpOptions(plot) {
    const b = plot.building;
    if (!b || b.level >= maxLevel(b.def)) return [];
    return nextLevelOptions(b);
  }

  levelUpCost(plot, optId) {
    const opts = this.levelUpOptions(plot);
    const o = opts.find((x) => x.id === optId) || opts[0];
    if (!o) return null;
    let c = o.cost - this.mods.upgradeDiscount;
    if (this.hasCastlePick('castleup') && (plot.kind === 'wall' || plot.kind === 'gate' || plot.kind === 'tower')) {
      c -= Math.min(3, this.night);
    }
    if (plot.building.def.plot === 'unit') c += this.mods.barracksCost;
    return Math.max(1, Math.round(c));
  }

  levelUp(plot, optId) {
    const cost = this.levelUpCost(plot, optId);
    if (cost == null || this.gold < cost) return false;
    const b = plot.building;
    const frac = b.hp / b.maxHp;
    this.gold -= cost;
    b.level += 1;
    if (b.def.levelOptions) b.picks.push(optId);
    this.refreshBuilding(plot);
    b.hp = b.maxHp * Math.max(frac, 0.8);
    this.rebuildNav();
    this.audio && this.audio.play('upgrade');
    this.puffs.burst(plot.x, plot.y + 1.8, plot.z, 14, C.gold, 0.5, 4.5, 0.7);
    if (this.phase === 'day') this.spawnGarrison(plot);
    return true;
  }

  castleUpgradeStep() {
    return CASTLE_UPS.find((s) => s.level === this.castle.level + 1) || null;
  }

  upgradeCastle(optId) {
    const step = this.castleUpgradeStep();
    if (!step) return false;
    const o = step.options.find((x) => x.id === optId);
    const cost = Math.max(1, step.cost - this.mods.upgradeDiscount);
    if (!o || this.gold < cost) return false;
    this.gold -= cost;
    this.castle.level = step.level;
    this.castle.picks.push(optId);
    const art = buildingArt('castle', this.castle.level, null);
    this.castleMesh.geometry = art.geo;
    if (this.castleMesh.children[0]) {
      this.castleMesh.children[0].geometry = outlineGeo(art.geo, 0.24);
    }
    const frac = this.castle.hp / this.castle.maxHp;
    this.castle.maxHp = CASTLE_BASE.hp[this.castle.level - 1] * this.mods.castleHp;
    this.castle.hp = this.castle.maxHp * Math.max(frac, 0.9);
    this.audio && this.audio.play('upgrade');
    this.puffs.burst(0, this.castle.y + 8, 0, 26, C.gold, 0.85, 7, 1.2);
    return true;
  }

  refreshBuilding(plot) {
    const b = plot.building;
    const s = resolveStats(b);
    let hpMul = 1;
    if (s.tag === 'wall') hpMul = this.mods.wallHp;
    else if (b.def.plot === 'tower') hpMul = this.mods.towerHp;
    else if (b.def.id === 'house') hpMul = this.mods.houseHp;
    s.hp = Math.round(s.hp * hpMul);
    if (s.atk) {
      s.atk.dmg *= this.mods.towerDmg;
      s.atk.range *= this.mods.towerRange;
      if (b.def.id === 'shrine' && this.mods.freeShrines) { s.atk.dmg *= 1.5; s.needEnergy = 700; }
    }
    if (this.mods.houseArrows && b.def.id === 'house' && b.level >= 2 && !s.atk) {
      s.atk = { dmg: 8, rate: 0.58, range: 18, proj: 'arrow', antiAir: true };
    }
    if (s.squad) s.squad.n += 0;
    b.stats = s;
    b.maxHp = s.hp;
    if (b.hp == null) b.hp = s.hp;
    plot.dead = false;
    plot.tag = s.tag;

    // ---- mesh
    const art = buildingArt(s.art, b.level, s.artBranch, { len: plot.segLen || 8 });
    if (plot.mesh) { this.group.remove(plot.mesh); plot.mesh = null; }
    const g = new THREE.Group();
    const m = new THREE.Mesh(art.geo, this.buildMat);
    m.castShadow = true; m.receiveShadow = true;
    this.addOutline(m, 0.2);
    g.add(m);
    plot.animParts = [];
    for (const ex of art.extras) {
      const em = new THREE.Mesh(ex.geo, this.buildMat);
      em.castShadow = true;
      em.position.set(ex.pos[0], ex.pos[1], ex.pos[2]);
      this.addOutline(em, 0.12);
      g.add(em);
      plot.animParts.push({ mesh: em, spin: ex.spin, aim: ex.aim });
    }
    g.position.set(plot.x, plot.y, plot.z);
    g.rotation.y = -plot.rot;
    this.group.add(g);
    plot.mesh = g;
    plot.marker.visible = false;
  }

  rebuildNav() {
    this.refreshDecks();
    this.nav.setBlockers(this.level.plots);
    this.nav.compute(0, 0);
  }

  // ================================================================= units
  acquireMesh(kind, side) {
    let pool = this.meshPool.get(kind);
    if (!pool) { pool = []; this.meshPool.set(kind, pool); }
    let m = pool.pop();
    if (!m) {
      const art = unitArt(kind);
      m = new THREE.Mesh(art.geo, side === 'enemy' ? this.enemyMat : this.allyMat);
      m.castShadow = true;
      this.addOutline(m, kind === 'king' || art.h > 2.5 ? 0.09 : 0.055);
    }
    m.visible = true;
    m.scale.set(1, 1, 1);
    this.group.add(m);
    return m;
  }
  releaseMesh(kind, mesh) {
    this.group.remove(mesh);
    mesh.visible = false;
    let pool = this.meshPool.get(kind);
    if (!pool) { pool = []; this.meshPool.set(kind, pool); }
    if (pool.length < 80) pool.push(mesh);
  }

  spawnAlly(kind, x, z, home) {
    const d = ALLY_DEFS[kind];
    if (!d) return null;
    const art = unitArt(kind);
    const heroMul = home && home.building ? (home.building.stats.heroMul || 1) : 1;
    const hp = d.hp * this.mods.unitHp * heroMul;
    const u = {
      side: 'ally', kind, def: d, tag: 'unit',
      x, z, y: this.level.sampleHeight(x, z),
      hp, maxHp: hp, heroMul,
      cd: this.rng() * 0.6, target: null, mesh: this.acquireMesh(kind, 'ally'),
      homeX: home ? home.x : x, homeZ: home ? home.z : z, home,
      face: 0, bob: this.rng() * 6.28, slowT: 0, slowAmt: 0, dead: false,
      r: art.r, h: art.h, fly: art.fly || 0, commanded: false, hit: 0, retarget: 0,
      spd: d.spd * (d.tags.indexOf('ranged') >= 0 ? this.mods.archerSpeed : 1),
      range: d.range * (d.tags.indexOf('ranged') >= 0 ? this.mods.archerRange : 1),
    };
    this.units.push(u);
    return u;
  }

  spawnEnemy(kind, x, z, forceElite) {
    const d = ENEMY_DEFS[kind];
    if (!d) return null;
    const art = unitArt(kind);
    let hpMul = this.mods.enemyHp;
    let dmgMul = this.mods.enemyDmg;
    if (this.mods.growth) {
      const g = Math.pow(1.75, this.night / Math.max(1, this.level.cfg.nights));
      hpMul *= g; dmgMul *= g;
    }
    if (this.mods.airNerf && d.flying) { hpMul *= 0.75; dmgMul *= 0.75; }
    // Elite status is decided when the wave is composed, so the pre-night list
    // can name it. Anything spawned mid-night (the Shadow's brood) rolls here.
    let elite = false;
    if (forceElite === true) elite = true;
    else if (forceElite == null && this.mods.eliteEvery && !d.boss) {
      this.eliteCounter++;
      if (this.eliteCounter % this.mods.eliteEvery === 0) elite = true;
    }
    if (elite) { hpMul *= 4; dmgMul *= 3; }
    let range = d.range, spd = d.spd * this.mods.enemySpeed;
    if (this.mods.rangedBuff && d.tags.indexOf('ranged') >= 0) {
      range *= 1.7; hpMul *= 2; dmgMul *= 1.4; spd *= 1.5;
    }
    const hp = d.hp * hpMul;
    const u = {
      side: 'enemy', kind, def: d, tag: 'enemy',
      x, z, y: this.level.sampleHeight(x, z),
      hp, maxHp: hp, dmgMul, elite,
      cd: this.rng() * 1.2, target: null, mesh: this.acquireMesh(kind, 'enemy'),
      face: 0, bob: this.rng() * 6.28, slowT: 0, slowAmt: 0, dead: false,
      r: art.r, h: art.h, fly: art.fly || (d.flying ? 4 : 0),
      hit: 0, retarget: 0, spd, range, cursed: 0, spawnCd: 3,
      burrow: 0, digCd: 0, chaseT: 0, digTarget: null,
    };
    if (d.dig) {
      u.digCd = d.dig.cdMin + this.rng() * (d.dig.cdMax - d.dig.cdMin);
    }
    if (elite) u.mesh.scale.set(1.25, 1.25, 1.25);
    this.units.push(u);
    this.enemyCount++;
    return u;
  }

  spawnGarrison(plot) {
    const b = plot.building;
    if (!b || plot.dead || !b.stats.squad) return;
    const have = this.units.filter((u) => u.side === 'ally' && u.home === plot).length;
    const want = b.stats.squad.n;
    for (let i = have; i < want; i++) {
      const a = (i / Math.max(1, want)) * Math.PI * 2;
      const r = 3.2 + (i % 3) * 1.1;
      this.spawnAlly(b.stats.squad.kind, plot.x + Math.cos(a) * r, plot.z + Math.sin(a) * r, plot);
    }
  }

  refillGarrisons() {
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.side === 'ally') { this.releaseMesh(u.kind, u.mesh); this.units.splice(i, 1); }
    }
    for (const p of this.level.plots) this.spawnGarrison(p);
  }

  // ================================================================= night
  startNight(waveList, hero) {
    this.phase = 'night';
    this.night += 1;
    this.nightTime = 0;
    this.loot = 0;
    this.destroyedThisNight = 0;
    this.startStructures = this.countStructures();
    const dur = 22 + this.night * 2.6;
    this.nightDuration = dur;
    const ground = this.level.spawns.filter((s) => !s.flying);
    const air = this.level.spawns.filter((s) => s.flying);
    const anyS = this.level.spawns;
    const q = [];
    for (const g of waveList) {
      const def = ENEMY_DEFS[g.kind];
      let n = g.n;
      if (this.mods.earlyRush && this.night <= 3 && !def.boss) n = Math.round(n * 2);
      const pool = def.flying ? (air.length ? air : anyS) : (ground.length ? ground : anyS);
      const gateCount = n > 12 ? 3 : (n > 6 ? 2 : 1);
      const gates = [];
      for (let k = 0; k < gateCount; k++) gates.push(pool[Math.floor(this.rng() * pool.length)]);
      const groupStart = def.boss ? dur * 0.4 : this.rng() * dur * 0.62;
      // Spread this group's telegraphed elites evenly through it, so the list
      // and the night agree on exactly how many arrive.
      const eliteN = Math.min(n, g.elite || 0);
      const every = eliteN > 0 ? n / eliteN : 0;
      let placed = 0;
      for (let i = 0; i < n; i++) {
        let elite = false;
        if (eliteN > 0 && placed < eliteN && i >= Math.round(placed * every)) {
          elite = true; placed++;
        }
        q.push({
          t: groupStart + i * (0.22 + this.rng() * 0.35),
          kind: g.kind, sp: gates[i % gates.length], elite,
        });
      }
    }
    q.sort((a, b) => a.t - b.t);
    this.spawnQueue = q;
    this.lastSpawnTime = q.length ? q[q.length - 1].t : 0;
    this.totalToSpawn = q.length;
    this.eliteCounter = 0;
    this.converge = false;
    this.convergeT = 0;
    for (const p of this.level.plots) if (p.building) p.building.spawnT = 0;
    if (hero) hero.onNightStart();
    this.audio && this.audio.play('nightStart');
  }

  countStructures() {
    let n = 0;
    for (const p of this.level.plots) if (p.building) n++;
    return n;
  }

  /** Base score for the night, per the original's three components. */
  nightScore() {
    const total = Math.max(1, this.startStructures);
    const surviving = total - this.destroyedThisNight;
    const protect = 250 * Math.pow(Math.max(0, surviving) / total, 2);
    const over = Math.max(0, this.nightTime - this.lastSpawnTime);
    const timeBonus = 250 * Math.pow(Math.max(0, (90 - over)) / 85, 2);
    return 100 + protect + Math.min(250, timeBonus);
  }

  endNight(hero) {
    this.converge = false;
    this.baseScore += this.nightScore();
    this.phase = 'day';
    // A surviving harbour lays down another boat before the morning's count. A
    // harbour that spent the night in rubble keeps the boats it had and lays
    // none, which is what makes losing one hurt for two mornings, not one.
    for (const p of this.level.plots) {
      const b = p.building;
      if (!b || p.dead || !b.stats.boat) continue;
      b.boats = Math.min(b.stats.boatCap || 5, b.boats + 1);
    }
    // Multi-night research advances one night, and anything finishing lands now.
    this.lastResearch = this.advanceResearch(hero);
    this.lastIncome = this.incomeBreakdown();
    this.lastLoot = Math.floor(this.loot);
    this.gold += this.lastIncome + this.lastLoot;
    // treasure hunter pays out before the final three nights
    if (this.mods.treasure) {
      const left = this.level.cfg.nights - this.night;
      const pay = left === 2 ? 15 : (left === 1 ? 25 : (left === 0 ? 0 : 0));
      if (pay) { this.gold += pay; this.lastLoot += pay; }
    }
    // buildings heal, and count another night held (mines decay)
    const frac = this.mods.repairFrac;
    let rebuilt = false;
    for (const p of this.level.plots) {
      const b = p.building;
      // A plot that fell in the night is rebuilt by dawn. The God of
      // Destruction leaves the rubble standing one extra day first.
      if (b && p.dead) {
        if (p.rebuildDelay > 0) { p.rebuildDelay -= 1; continue; }
        if (this.rebuildStruct(p, frac)) rebuilt = true;
        continue;
      }
      if (p.rebuildDelay > 0) p.rebuildDelay -= 1;
      if (!b) continue;
      b.nightsHeld++;
      b.hp = Math.min(b.maxHp, b.maxHp * frac + b.hp * (1 - frac));
      if (b.hp <= 0) b.hp = b.maxHp * frac;
    }
    // A rebuilt wall blocks again, so the flow field has to be recut once.
    if (rebuilt) this.rebuildNav();
    this.castle.hp = Math.min(this.castle.maxHp, this.castle.maxHp * frac + this.castle.hp * (1 - frac));
    // builder's guild upgrades a house for free
    if (this.hasCastlePick('builders')) {
      const h = this.level.plots.find((p) => p.building && !p.dead
        && p.building.def.id === 'house' && p.building.level < maxLevel(p.building.def));
      if (h) { h.building.level++; this.refreshBuilding(h); h.building.hp = h.building.maxHp; }
    }
    for (let i = this.units.length - 1; i >= 0; i--) {
      if (this.units[i].side === 'enemy') this.killUnit(this.units[i], true);
    }
    for (const p of this.projectiles) if (p.mesh) this.group.remove(p.mesh);
    this.projectiles.length = 0;
    for (const t of this.traps) this.group.remove(t.mesh);
    this.traps.length = 0;
    this.refillGarrisons();
    this.audio && this.audio.play('dawn');
  }

  finalScore() {
    const base = this.baseScore + this.gold * 10;
    return Math.round(base + base * this.mods.scoreMul);
  }

  // ============================================================== damage
  structures() {
    const out = [this.castle];
    for (const p of this.level.plots) {
      // A bridge cannot be attacked, so it is not a structure anything targets.
      if (p.building && !p.dead && !p.building.stats.indestructible) out.push(p);
    }
    return out;
  }
  structHp(s) { return s.isCastle ? s.hp : s.building.hp; }
  structMaxHp(s) { return s.isCastle ? s.maxHp : s.building.maxHp; }
  structRadius(s) {
    if (s.isCastle) return 5.3;
    if (s.kind === 'wall' || s.kind === 'gate') return Math.max(2.4, (s.segLen || 8) * 0.44);
    if (s.kind === 'harbour') return 3.2;
    return 2.5;
  }

  /** One entry point for every hit landing on a structure. */
  damageStruct(s, amount, attacker) {
    if (s.dead) return;
    let amt = amount;
    if (attacker && attacker.def) {
      amt = scaleDamage(amt, attacker.def, s.isCastle ? 'castle' : (s.tag || 'building'), null);
      if (attacker.def.tags) {
        if (attacker.def.tags.indexOf('melee') >= 0) amt *= this.mods.meleeRes;
        if (attacker.def.tags.indexOf('ranged') >= 0) amt *= this.mods.rangedRes;
      }
    }
    if (s.isCastle) {
      s.hp -= amt;
      this.puffs.burst(s.x + (this.rng() - 0.5) * 6, s.y + 5 + this.rng() * 4, s.z + (this.rng() - 0.5) * 6,
        3, 0xd8cdb8, 0.45, 3, 0.4);
      if (this.hasCastlePick('magicarmor') && attacker && attacker.side === 'enemy') {
        this.damageUnit(attacker, 6, null);
      }
      if (s.hp <= 0) { s.hp = 0; this.phase = 'lost'; }
      return;
    }
    const b = s.building;
    b.hp -= amt;
    if (attacker && attacker.side === 'enemy' && b.stats.thorns) {
      const tagOk = !b.stats.thornsTag
        || (attacker.def.tags && attacker.def.tags.indexOf(b.stats.thornsTag) >= 0);
      if (tagOk && !attacker.def.flying) this.damageUnit(attacker, b.stats.thorns, null, true);
    }
    this.puffs.burst(s.x + (this.rng() - 0.5) * 3, s.y + 1.6 + this.rng() * 2, s.z + (this.rng() - 0.5) * 3,
      2, 0xd8cdb8, 0.35, 2.5, 0.35);
    if (b.hp <= 0) this.destroyStruct(s);
  }

  destroyStruct(s) {
    const b = s.building;
    s.dead = true;
    b.hp = 0;
    this.destroyedThisNight++;
    if (b.stats.boom) this.explode(s.x, s.y + 1.5, s.z, b.stats.boom.radius, b.stats.boom.dmg, 'enemy');
    if (b.def.id === 'mine' && this.mods.mineBonus) b.nightsHeld = 0;
    this.puffs.burst(s.x, s.y + 1.6, s.z, 22, 0xa89a80, 0.75, 6, 0.9);
    if (s.mesh) { this.group.remove(s.mesh); s.mesh = null; }
    s.marker.visible = true;
    if (this.mods.slowRebuild) s.rebuildDelay = 1;
    this.rebuildNav();
    this.audio && this.audio.play('crumble');
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.side === 'ally' && u.home === s) this.killUnit(u, false);
    }
  }

  /**
   * Dawn's counterpart to destroyStruct: the crown's masons put the building
   * back up in place, free, at the morning's repair fraction — full health
   * normally, 25% under the God of Destruction, the same fraction that heals a
   * survivor. What it does not give back is the night the plot missed: income
   * was already paid without it, a razed mine's decay stays reset, the harbour
   * laid no boat, and nightsHeld does not advance. Losing a building costs the
   * income, not the structure.
   */
  rebuildStruct(plot, frac) {
    const b = plot.building;
    if (!b || !plot.dead) return false;
    this.refreshBuilding(plot);          // clears plot.dead, puts the mesh back
    b.hp = Math.max(1, b.maxHp * frac);
    this.puffs.burst(plot.x, plot.y + 1, plot.z, 10, 0xe8dcc0, 0.55, 4, 0.6);
    return true;
  }

  damageUnit(u, amount, attacker, trueDamage) {
    if (u.dead || u.burrow > 0) return;
    let amt = amount;
    if (!trueDamage && attacker && attacker.def) {
      amt = scaleDamage(amt, attacker.def, u.side === 'ally' ? 'unit' : 'enemy', u.def);
      if (u.side === 'ally' && attacker.def.tags) {
        if (attacker.def.tags.indexOf('melee') >= 0) amt *= this.mods.meleeRes;
        if (attacker.def.tags.indexOf('ranged') >= 0) amt *= this.mods.rangedRes;
      }
    }
    // Godly Curse reads the king's locked target: whatever he has marked takes
    // +50% from everything on the field, not just from him.
    if (u.side === 'enemy' && this.hasCastlePick('curse') && u === this.lockedTarget) amt *= 1.5;
    u.hp -= amt;
    u.hit = 0.12;
    if (u.hp <= 0) this.killUnit(u, false);
  }

  killUnit(u, silent) {
    if (u.dead) return;
    if (u === this.lockedTarget) this.lockedTarget = null;
    u.dead = true;
    if (u.side === 'enemy') {
      this.enemyCount--;
      if (!silent) {
        this.kills++;
        this.loot += (u.def.loot || 0.1) * this.mods.loot * (u.elite ? 3 : 1);
        this.puffs.burst(u.x, u.y + u.h * 0.5, u.z, u.def.boss ? 26 : 5,
          u.def.boss ? 0xffd070 : (u.elite ? 0xffd070 : C.enemyBody), u.def.boss ? 1.0 : 0.4, u.def.boss ? 9 : 3.2, 0.5);
        if (u.def.boom && u.def.diesOnAttack !== true) {
          this.explode(u.x, u.y + 0.8, u.z, u.def.boom.radius, u.def.boom.dmg * 0.5, 'ally', true);
        }
        // shrines feed on nearby death
        for (const p of this.level.plots) {
          const b = p.building;
          if (!b || p.dead || !b.stats.needEnergy) continue;
          if (Math.hypot(p.x - u.x, p.z - u.z) < 16) b.energy += u.maxHp;
        }
      }
    } else if (!silent) {
      this.puffs.burst(u.x, u.y + u.h * 0.5, u.z, 4, C.allyBody, 0.35, 3, 0.5);
    }
    const i = this.units.indexOf(u);
    if (i >= 0) this.units.splice(i, 1);
    this.releaseMesh(u.kind, u.mesh);
  }

  explode(x, y, z, radius, dmg, againstSide, hitStructs, attacker) {
    this.puffs.burst(x, y, z, 18, C.fire, 0.9, 7, 0.6);
    this.puffs.burst(x, y, z, 8, 0x5a5048, 1.15, 5, 0.9);
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.side !== againstSide || u.dead) continue;
      const d = Math.hypot(u.x - x, u.z - z);
      if (d <= radius) this.damageUnit(u, dmg * (1 - (d / radius) * 0.45), attacker || null);
    }
    if (hitStructs) {
      for (const s of this.structures()) {
        const d = Math.hypot(s.x - x, s.z - z);
        if (d <= radius + this.structRadius(s)) this.damageStruct(s, dmg * 0.7, attacker || null);
      }
    }
    this.audio && this.audio.play('boom');
  }

  // ========================================================== projectiles
  fire(kind, fx, fy, fz, target, dmg, opts) {
    const o = opts || {};
    let p = this.projPool.pop() || { mesh: null };
    const geos = projectileGeos();
    const g = geos[kind] || geos.arrow;
    if (!p.mesh) {
      p.mesh = new THREE.Mesh(g, this.unitMat);
      p.mesh.castShadow = false;
    } else if (p.mesh.geometry !== g) p.mesh.geometry = g;
    p.mesh.visible = true;
    this.group.add(p.mesh);
    p.x = fx; p.y = fy; p.z = fz;
    p.startY = fy;
    p.kind = kind;
    p.target = target;
    p.dmg = dmg;
    p.splash = o.splash || 0;
    p.side = o.side || 'ally';
    p.arc = o.arc || 0;
    p.speed = o.speed || (kind === 'rock' ? 30 : (kind === 'ball' ? 34 : (kind === 'fire' ? 20 : 50)));
    p.life = 5;
    p.t = 0;
    p.slow = o.slow || 0;
    p.attacker = o.attacker || null;
    p.heal = o.heal || 0;
    p.curse = o.curse || 0;
    p.allyHeal = o.allyHeal || 0;
    const tp = this.targetPos(target);
    p.total = Math.max(0.001, Math.hypot(tp[0] - fx, tp[2] - fz) / p.speed);
    this.projectiles.push(p);
  }

  targetPos(t) {
    if (!t) return [0, 0, 0];
    if (t.isCastle) return [t.x, t.y + 6, t.z];
    if (t.building) return [t.x, t.y + 2.2, t.z];
    if (t.isHero) return [t.x, t.y + 1.6, t.z];
    return [t.x, t.y + (t.h || 1.4) * 0.55, t.z];
  }

  targetAlive(t) {
    if (!t) return false;
    if (t.isCastle) return t.hp > 0;
    if (t.building) return !t.dead && t.building.hp > 0;
    if (t.isHero) return !t.down;
    return !t.dead;
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.t += dt;
      p.life -= dt;
      // wind spirits and support mages swat enemy projectiles down
      if (p.side === 'enemy' && this.interceptCheck(p)) {
        this.puffs.burst(p.x, p.y, p.z, 4, 0xbfe8ff, 0.3, 3, 0.3);
        this.group.remove(p.mesh); this.projPool.push(p);
        this.projectiles.splice(i, 1);
        continue;
      }
      const tp = this.targetPos(p.target);
      const dx = tp[0] - p.x, dz = tp[2] - p.z;
      const dist = Math.hypot(dx, dz);
      const stepLen = p.speed * dt;
      if (dist <= Math.max(0.9, stepLen) || p.life <= 0 || !this.targetAlive(p.target)) {
        if (this.targetAlive(p.target) || p.splash) this.projHit(p, tp[0], tp[1], tp[2]);
        this.group.remove(p.mesh);
        this.projPool.push(p);
        this.projectiles.splice(i, 1);
        continue;
      }
      const nx = dx / dist, nz = dz / dist;
      p.x += nx * stepLen; p.z += nz * stepLen;
      const frac = Math.min(1, p.t / p.total);
      p.y = p.startY + (tp[1] - p.startY) * frac + (p.arc ? Math.sin(frac * Math.PI) * p.arc : 0);
      p.mesh.position.set(p.x, p.y, p.z);
      p.mesh.rotation.set(p.arc ? -Math.cos(frac * Math.PI) * 0.7 : 0, Math.atan2(nx, nz), 0);
      if (p.kind === 'magic' || p.kind === 'fire') {
        p.mesh.rotation.z += dt * 9;
        if (this.rng() < 0.35) {
          this.puffs.spawn(p.x, p.y, p.z, p.kind === 'fire' ? C.fire : 0x9a7ce8, 0.22, 0.3, 0, 0.4);
        }
      }
    }
  }

  interceptCheck(p) {
    for (const pl of this.level.plots) {
      const b = pl.building;
      if (!b || pl.dead || !b.stats.intercept) continue;
      if (Math.hypot(pl.x - p.x, pl.z - p.z) < b.stats.intercept && this.rng() < 0.03) return true;
    }
    for (const u of this.units) {
      if (u.side !== 'ally' || !u.def.intercept) continue;
      if (Math.hypot(u.x - p.x, u.z - p.z) < u.def.intercept && this.rng() < 0.05) return true;
    }
    return false;
  }

  projHit(p, x, y, z) {
    const against = p.side === 'ally' ? 'enemy' : 'ally';
    // A thrown vial mends whoever of yours is standing in it.
    if (p.allyHeal) {
      for (const u of this.units) {
        if (u.side !== 'ally' || u.dead) continue;
        if (Math.hypot(u.x - x, u.z - z) > (p.splash || 3)) continue;
        u.hp = Math.min(u.maxHp, u.hp + p.allyHeal * this.mods.unitHeal);
        this.puffs.burst(u.x, u.y + u.h, u.z, 2, 0x8ce8a0, 0.24, 1.6, 0.3);
      }
    }
    if (p.heal) {
      for (const u of this.units) {
        if (u.side !== 'ally' || u.dead) continue;
        if (Math.hypot(u.x - x, u.z - z) < 4) u.hp = Math.min(u.maxHp, u.hp + p.heal * this.mods.unitHeal);
      }
      this.puffs.burst(x, y, z, 5, 0x8ce8a0, 0.3, 2.5, 0.35);
      return;
    }
    if (p.splash) {
      this.explode(x, y, z, p.splash, p.dmg, against, p.side === 'enemy', p.attacker);
      if (p.slow) {
        for (const u of this.units) {
          if (u.side !== against || u.dead) continue;
          if (Math.hypot(u.x - x, u.z - z) > p.splash) continue;
          u.slowT = Math.max(u.slowT, 1.6 * this.mods.slowLong); u.slowAmt = p.slow;
        }
      }
      return;
    }
    const t = p.target;
    if (this.targetAlive(t)) {
      if (t.isCastle || t.building) this.damageStruct(t, p.dmg, p.attacker);
      else if (t.isHero) t.hurt(p.dmg, 'ranged', p.attacker);
      else {
        this.damageUnit(t, p.dmg, p.attacker);
        if (p.slow) { t.slowT = Math.max(t.slowT, 1.6 * this.mods.slowLong); t.slowAmt = p.slow; }
        if (p.curse) { t.cursed = Math.max(t.cursed, 6); }
      }
      this.puffs.burst(x, y, z, 2, 0xffffff, 0.2, 2, 0.22);
    }
  }

  // ============================================================ targeting
  nearestEnemy(x, z, range, allowAir, mode) {
    let best = null, bestScore = Infinity;
    this.enemyHash.query(x, z, range, this._near);
    for (const u of this._near) {
      if (u.dead) continue;
      if (u.fly && allowAir === false) continue;
      const d2 = (u.x - x) ** 2 + (u.z - z) ** 2;
      if (d2 > range * range) continue;
      let sc = d2;
      if (mode === 'big') sc = -u.hp;
      else if (mode === 'weak') sc = u.hp;
      else if (mode === 'random') sc = this.rng() * 1000;
      if (sc < bestScore) { bestScore = sc; best = u; }
    }
    return best;
  }

  nearestAlly(x, z, range, hurtOnly) {
    let best = null, bd = range * range;
    this.allyHash.query(x, z, range, this._near);
    for (const u of this._near) {
      if (u.dead) continue;
      if (hurtOnly && u.hp >= u.maxHp) continue;
      const d = (u.x - x) ** 2 + (u.z - z) ** 2;
      if (d < bd) { bd = d; best = u; }
    }
    return best;
  }

  nearestStructOfTag(x, z, tags) {
    let best = null, bd = 1e9;
    for (const s of this.structures()) {
      if (s.isCastle) continue;
      if (tags && tags.indexOf(s.tag) < 0) continue;
      const dd = Math.hypot(s.x - x, s.z - z) + this.nav.distAt(s.x, s.z) * 0.04;
      if (dd < bd) { bd = dd; best = s; }
    }
    return best;
  }

  pickTarget(u, hero) {
    // Endgame convergence: once the spawns are done and only a handful are
    // left, the survivors abandon whatever wall they were chewing on and
    // charge the keep. Without this a lone peasant can gnaw an iron gate for
    // twenty minutes and the night never ends.
    if (u.side === 'enemy' && this.converge) return this.castle;
    if (u.side === 'ally') {
      if (u.def.heal) {
        const hurt = this.nearestAlly(u.x, u.z, u.range, true);
        if (hurt) return hurt;
        return null;
      }
      const range = u.commanded ? 22 : Math.max(16, u.range + (u.def.search || 8));
      return this.nearestEnemy(u.x, u.z, range, true);
    }
    const d = u.def;
    const adjacent = Math.max(6, u.range + 2.5);
    switch (d.target) {
      case 'king':
        if (hero && !hero.down) return hero;
        return this.nearestAlly(u.x, u.z, 26) || this.castle;
      case 'castle':
        return this.castle;
      case 'units': {
        const a = this.nearestAlly(u.x, u.z, 30);
        if (a) return a;
        if (!d.ignoresKing && hero && !hero.down && Math.hypot(hero.x - u.x, hero.z - u.z) < 30) return hero;
        return this.nearestStructOfTag(u.x, u.z, null) || this.castle;
      }
      case 'building':
        return this.nearestStructOfTag(u.x, u.z, null) || this.castle;
      case 'defensive':
        return this.nearestStructOfTag(u.x, u.z, ['defensive', 'wall']) || this.castle;
      case 'economic':
        return this.nearestStructOfTag(u.x, u.z, ['economic'])
          || this.nearestStructOfTag(u.x, u.z, null) || this.castle;
      default: {
        // No preferred target: fight whatever is actually in front of you, and
        // march for the keep otherwise. Without the structure check, ranged
        // enemies park at max range and shell the Castle Center from outside
        // every wall, which is not how the original behaves.
        const a = this.nearestAlly(u.x, u.z, adjacent);
        if (a) return a;
        if (!d.ignoresKing && hero && !hero.down
          && Math.hypot(hero.x - u.x, hero.z - u.z) < adjacent) return hero;
        const s = this.nearestStructOfTag(u.x, u.z, null);
        if (s && Math.hypot(s.x - u.x, s.z - u.z) <= u.range + this.structRadius(s) + 4) return s;
        return this.castle;
      }
    }
  }

  // =============================================================== update
  update(dt, hero) {
    const L = this.level;
    this.allyHash.clear(); this.enemyHash.clear();
    for (const u of this.units) {
      // A burrowing mole is underground: nothing can see it and nothing can hit
      // it. The wiki does not say whether that is true in the original, so this
      // is a decision, not a citation.
      if (u.burrow > 0) continue;
      if (u.side === 'ally') this.allyHash.insert(u); else this.enemyHash.insert(u);
    }

    if (this.phase === 'night') {
      this.nightTime += dt;
      while (this.spawnQueue.length && this.spawnQueue[0].t <= this.nightTime) {
        const ev = this.spawnQueue.shift();
        const x = ev.sp.x + (this.rng() - 0.5) * 4;
        const z = ev.sp.z + (this.rng() - 0.5) * 4;
        this.spawnEnemy(ev.kind, x, z, !!ev.elite);
      }
      if (!this.spawnQueue.length && this.enemyCount <= 0) {
        if (this.night >= L.cfg.nights) { this.baseScore += this.nightScore(); this.phase = 'won'; }
        else this.endNight(hero);
      }
      // stragglers converge on the keep, and smoke signals mark where they are
      // Only for genuine stragglers: a small early wave must not be treated as
      // one, or the whole night becomes a keep rush.
      this.converge = !this.spawnQueue.length && this.enemyCount > 0 && this.enemyCount <= 6
        && this.nightTime > this.lastSpawnTime + 18;
      if (this.converge) {
        this.convergeT = (this.convergeT || 0) + dt;
        if (this.convergeT > 30) {
          for (const u of this.units.slice()) if (u.side === 'enemy') this.killUnit(u, false);
        }
        this.signalT = (this.signalT || 0) - dt;
        if (this.signalT <= 0) {
          this.signalT = 0.28;
          for (const u of this.units) {
            if (u.side !== 'enemy' || u.dead) continue;
            this.puffs.spawn(u.x, u.y + u.h + 1.4, u.z, 0xff9060, 0.42, 0.9, 3.2, 0.4);
          }
        }
      }
      // garrisons trickle replacements back in during the night
      if (!this.mods.noNightRespawn) {
        for (const p of L.plots) {
          const b = p.building;
          if (!b || p.dead || !b.stats.squad) continue;
          b.spawnT -= dt * this.mods.trainSpeed;
          if (b.spawnT <= 0) {
            b.spawnT = 10;
            const have = this.units.filter((u) => u.side === 'ally' && u.home === p).length;
            if (have < b.stats.squad.n) {
              this.spawnAlly(b.stats.squad.kind, p.x + (this.rng() - 0.5) * 4, p.z + (this.rng() - 0.5) * 4, p);
            }
          }
        }
      }
    }

    this.updateUnits(dt, hero);
    this.updateStructures(dt, hero);
    this.updateProjectiles(dt);
    this.updateTraps(dt);
    this.puffs.update(dt);
    animateWater(this.water, performance.now() * 0.001);
    for (const p of L.plots) {
      if (!p.animParts) continue;
      for (const a of p.animParts) if (a.spin === 'z') a.mesh.rotation.z += dt * 1.1;
    }
    this.allyMat.emissiveIntensity = this.nightBlend * 0.55;
    this.enemyMat.emissiveIntensity = this.nightBlend * 0.75;
    const f = 0.86 + Math.sin(performance.now() * 0.006) * 0.1 + Math.sin(performance.now() * 0.017) * 0.04;
    for (const l of this.R.torches) if (l.intensity > 0) l.intensity = 30 * this.nightBlend * f;
  }

  updateTraps(dt) {
    for (let i = this.traps.length - 1; i >= 0; i--) {
      const t = this.traps[i];
      t.life -= dt;
      const hit = this.nearestEnemy(t.x, t.z, 2.6, false);
      if (hit) {
        this.damageUnit(hit, t.dmg * dt, null, true);
        hit.slowT = 0.4; hit.slowAmt = 0.85;
        if (this.rng() < 0.2) this.puffs.spawn(t.x, t.y + 0.3, t.z, 0xc85a3a, 0.2, 0.3, 1, 0.6);
      }
      if (t.life <= 0) { this.group.remove(t.mesh); this.traps.splice(i, 1); }
    }
  }

  updateUnits(dt, hero) {
    const flow = [0, 0];
    const L = this.level;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];
      if (u.dead) continue;
      u.bob += dt * 9;
      if (u.hit > 0) u.hit -= dt;
      if (u.cursed > 0) u.cursed -= dt;
      let spd = u.spd;
      if (u.side === 'enemy' && this.converge) spd *= 2.0;   // stragglers hurry
      if (u.slowT > 0) { u.slowT -= dt; spd *= (1 - (u.slowAmt || 0.4)); }
      if (u.side === 'enemy' && this.mods.enemyRegen && u.hp < u.maxHp) {
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * this.mods.enemyRegen * dt);
      }
      if (u.side === 'ally') {
        let regen = this.mods.unitRegen;
        if (this.hasCastlePick('commander') && hero && !hero.down
          && Math.hypot(hero.x - u.x, hero.z - u.z) < 12) regen += 4;
        if (regen && u.hp < u.maxHp) u.hp = Math.min(u.maxHp, u.hp + regen * dt * this.mods.unitHeal);
        // Marching in formation costs speed, until the Commander upgrade — that
        // is what its "+60% while commanded" is measured against.
        if (u.commanded) spd *= this.hasCastlePick('commander') ? 1.6 : 0.82;
      }

      // ---- tunnelling. Published: a dig range of 30 on an 8-16s cooldown, and
      // that they move through terrain. Where they surface, and the fact that
      // they cannot be hit on the way, are this build's decisions.
      if (u.def.dig) {
        if (u.burrow > 0) {
          u.burrow -= dt;
          // A mole goes under; the Corrupt King leaps, so he stays in sight.
          if (u.def.dig.leap) {
            const k = 1 - Math.abs(u.burrow / 0.7 - 0.5) * 2;
            u.mesh.position.y = this.groundY(u.x, u.z) + k * 5.5;
            u.mesh.rotation.z = k * 0.5;
          } else u.mesh.visible = false;
          if (u.burrow <= 0) {
            const t = u.digTarget;
            if (t && this.targetAlive(t)) {
              const dx = t.x - u.x, dz = t.z - u.z;
              const d = Math.hypot(dx, dz) || 1;
              const want = Math.min(u.def.dig.range, Math.max(0, d - Math.max(3, u.range * 0.7)));
              // surface at the last walkable point along the way
              for (let step = want; step > 0; step -= 2) {
                const nx = u.x + (dx / d) * step, nz = u.z + (dz / d) * step;
                if (this.walkable(nx, nz)) { u.x = nx; u.z = nz; break; }
              }
              if (u.def.dig.chase) { u.target = t; u.chaseT = u.def.dig.chase; }
            }
            u.mesh.visible = true;
            u.mesh.rotation.z = 0;
            this.puffs.burst(u.x, this.groundY(u.x, u.z) + 0.3, u.z,
              u.def.dig.leap ? 18 : 12, u.def.dig.leap ? 0xd04a5a : 0x8a7250, 0.6, 5, 0.7);
            u.digCd = u.def.dig.cdMin + this.rng() * (u.def.dig.cdMax - u.def.dig.cdMin);
          }
          continue;                       // no steering, no attacking, no bar
        }
        u.digCd -= dt;
        if (u.chaseT > 0) u.chaseT -= dt;
        const dt2 = u.target ? Math.hypot(u.target.x - u.x, u.target.z - u.z) : 1e9;
        if (u.digCd <= 0 && u.target && dt2 > Math.max(8, u.range + 4)) {
          u.burrow = 0.7;
          u.digTarget = u.target;
          this.puffs.burst(u.x, this.groundY(u.x, u.z) + 0.3, u.z, 14, 0x8a7250, 0.6, 4.5, 0.7);
          this.audio && this.audio.play('crumble', 0.2);
          continue;
        }
      }

      u.retarget -= dt;
      const keepTarget = u.chaseT > 0 && this.targetAlive(u.target);
      if (!keepTarget && (!this.targetAlive(u.target) || u.retarget <= 0)) {
        u.retarget = 0.3 + this.rng() * 0.35;
        u.target = this.pickTarget(u, hero);
      }
      const t = u.target;
      let tx = 0, tz = 0, range = u.range;
      let targetIsStruct = false;
      if (t) {
        tx = t.x; tz = t.z;
        if (t.isCastle || t.building) { targetIsStruct = true; range += this.structRadius(t) * 0.8; }
      }
      const distT = t ? Math.hypot(tx - u.x, tz - u.z) : 1e9;

      // ---- steering
      let mvx = 0, mvz = 0;
      if (u.side === 'enemy') {
        if (u.fly) {
          if (t && distT > range * 0.85) { mvx = (tx - u.x) / distT; mvz = (tz - u.z) / distT; }
        } else if (t && distT < 30 && (targetIsStruct || t.isHero || distT < 16)) {
          if (distT > range * 0.9) { mvx = (tx - u.x) / distT; mvz = (tz - u.z) / distT; }
        } else if (this.nav.flowAt(u.x, u.z, flow)) {
          mvx = flow[0]; mvz = flow[1];
          const bid = this.converge ? -1 : this.nav.blockerAhead(u.x, u.z, mvx, mvz);
          if (bid >= 0) {
            const plot = L.plots[bid];
            if (plot && plot.building && !plot.dead) {
              // gates let your own troops through; enemies must break them
              u.target = plot;
            }
          }
        } else if (t) { mvx = (tx - u.x) / distT; mvz = (tz - u.z) / distT; }
      } else {
        const dk = hero && !hero.down ? Math.hypot(hero.x - u.x, hero.z - u.z) : 1e9;
        let ax, az;
        const canFight = !u.commanded || this.hasCastlePick('commander');
        if (u.commanded) {
          if (hero.holdX != null) {
            ax = u.postX != null ? u.postX : hero.holdX;
            az = u.postZ != null ? u.postZ : hero.holdZ;
          }
          else {
            const a = (i % 9) / 9 * Math.PI * 2;
            const rr = 3.4 + (i % 3) * 1.4;
            ax = hero.x + Math.cos(a) * rr - Math.sin(hero.face) * 2;
            az = hero.z + Math.sin(a) * rr - Math.cos(hero.face) * 2;
          }
          if (canFight && t && distT < 20) { ax = tx; az = tz; }
        } else if (t && distT < Math.max(20, u.range + 8)) { ax = tx; az = tz; }
        else { ax = u.homeX; az = u.homeZ; }
        const d = Math.hypot(ax - u.x, az - u.z);
        const stop = (t && distT < 26 && (ax === tx)) ? range * 0.85 : 1.3;
        if (d > stop) { mvx = (ax - u.x) / d; mvz = (az - u.z) / d; }
        if (u.commanded && !canFight) u.noAttack = true; else u.noAttack = false;
        u.commandedDist = dk;
      }

      // ---- separation
      const hash = u.side === 'ally' ? this.allyHash : this.enemyHash;
      hash.query(u.x, u.z, 2.6, this._near);
      let sx = 0, sz = 0;
      for (const o of this._near) {
        if (o === u || o.dead) continue;
        const ddx = u.x - o.x, ddz = u.z - o.z;
        const d2 = ddx * ddx + ddz * ddz;
        const minD = (u.r + o.r) * 1.08;
        if (d2 > 0.0001 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          sx += (ddx / d) * (1 - d / minD);
          sz += (ddz / d) * (1 - d / minD);
        }
      }
      mvx += sx * 1.6; mvz += sz * 1.6;
      const ml = Math.hypot(mvx, mvz);
      if (ml > 0.001) {
        mvx /= ml; mvz /= ml;
        const nx = u.x + mvx * spd * dt, nz = u.z + mvz * spd * dt;
        if (u.fly || this.walkable(nx, nz)) { u.x = nx; u.z = nz; }
        else { u.x += mvz * spd * dt * 0.6; u.z -= mvx * spd * dt * 0.6; }
        u.face = Math.atan2(mvx, mvz);
      } else if (t) u.face = Math.atan2(tx - u.x, tz - u.z);

      // ---- attack
      u.cd -= dt;
      if (t && !u.noAttack && distT <= range + 0.4 && u.cd <= 0) {
        u.cd = 1 / Math.max(0.05, u.def.rate);
        this.unitAttack(u, t, hero);
      }
      // the shadow boss spawns instead of striking
      if (u.def.spawner && this.phase === 'night') {
        u.spawnCd -= dt;
        if (u.spawnCd <= 0 && this.enemyCount < 95) {
          u.spawnCd = 4.0;
          for (let k = 0; k < 2; k++) {
            this.spawnEnemy(this.rng() < 0.5 ? 'swordsman' : 'racer',
              u.x + (this.rng() - 0.5) * 7, u.z + (this.rng() - 0.5) * 7);
          }
          this.damageUnit(u, u.maxHp * 0.045, null, true);
          this.puffs.burst(u.x, u.y + 2, u.z, 10, 0x4a6ba8, 0.6, 5, 0.7);
        }
      }

      // ---- transform
      const gy = this.groundY(u.x, u.z);
      u.y = u.fly ? gy + u.fly + Math.sin(u.bob * 0.35) * 0.35 : gy;
      const m = u.mesh;
      const walking = ml > 0.02;
      m.position.set(u.x, u.y + (walking && !u.fly ? Math.abs(Math.sin(u.bob)) * 0.09 : 0), u.z);
      m.rotation.y = u.face;
      m.rotation.z = u.fly ? Math.sin(u.bob * 0.5) * 0.12 : (walking ? Math.sin(u.bob) * 0.05 : 0);
    }
  }

  unitAttack(u, t, hero) {
    let dmg = u.def.dmg;
    if (u.side === 'enemy') dmg *= u.dmgMul;
    else {
      dmg *= this.mods.unitDmg * (u.heroMul || 1);
      // Blacksmith research, split the way the smith splits it
      dmg *= u.def.tags.indexOf('ranged') >= 0 ? this.mods.rRangedDmg : this.mods.rMeleeDmg;
    }
    const tp = this.targetPos(t);

    if (u.def.heal) {
      this.fire('magic', u.x, u.y + u.h * 0.8, u.z, t, 0, { side: 'ally', heal: u.def.heal, speed: 40 });
      return;
    }
    if (u.def.proj) {
      this.fire(u.def.proj, u.x, u.y + u.h * 0.75, u.z, t, dmg, {
        side: u.side, splash: u.def.splash || 0, attacker: u,
        arc: u.def.proj === 'rock' ? 8 : (u.def.proj === 'fire' ? 3 : 0),
        speed: u.def.projSpeed,
      });
      this.audio && this.audio.play(u.def.proj === 'rock' ? 'catapult' : 'bow', 0.3);
      return;
    }
    if (u.def.splash) {
      this.explode(tp[0], tp[1], tp[2], u.def.splash, dmg,
        u.side === 'ally' ? 'enemy' : 'ally', u.side === 'enemy', u);
      return;
    }
    if (t.isCastle || t.building) this.damageStruct(t, dmg, u);
    else if (t.isHero) t.hurt(dmg, u.def.tags.indexOf('ranged') >= 0 ? 'ranged' : 'melee', u);
    else this.damageUnit(t, dmg, u);
    if (u.def.slow && !t.isCastle && !t.building && !t.isHero) {
      t.slowT = 1.5 * this.mods.slowLong; t.slowAmt = u.def.slow;
    }
    this.puffs.burst(tp[0], tp[1], tp[2], 2, 0xffe9c0, 0.24, 2.2, 0.2);
    this.audio && this.audio.play('hit', 0.28);
    if (u.def.diesOnAttack && u.side === 'enemy') {
      this.explode(u.x, u.y + 0.8, u.z, u.def.boom.radius, u.def.boom.dmg * u.dmgMul, 'ally', true, u);
      this.killUnit(u, true);
    }
  }

  updateStructures(dt, hero) {
    // find the tower nearest the keep once, for Power Tower
    let powerId = -1;
    if (this.mods.powerTower) {
      let bd = 1e9;
      for (const p of this.level.plots) {
        if (!p.building || p.dead || p.kind !== 'tower') continue;
        const d = p.x * p.x + p.z * p.z;
        if (d < bd) { bd = d; powerId = p.id; }
      }
    }
    for (const p of this.level.plots) {
      const b = p.building;
      if (!b || p.dead) continue;
      // healing spire
      if (b.stats.heal) {
        b.cd -= dt;
        if (b.cd <= 0) {
          const tgt = this.nearestAlly(p.x, p.z, b.stats.heal.range, true);
          if (tgt) {
            b.cd = 1 / b.stats.heal.rate;
            tgt.hp = Math.min(tgt.maxHp, tgt.hp + b.stats.heal.amount * this.mods.unitHeal);
            this.puffs.burst(tgt.x, tgt.y + tgt.h, tgt.z, 3, 0x8ce8a0, 0.28, 2, 0.35);
          } else b.cd = 0.25;
        }
        continue;
      }
      const atk = b.stats.atk;
      if (!atk) continue;
      if (b.stats.needEnergy && b.energy < b.stats.needEnergy) continue;
      b.cd -= dt;
      const target = this.nearestEnemy(p.x, p.z, atk.range, atk.antiAir !== false, atk.aim);
      if (p.animParts) {
        for (const a of p.animParts) {
          if (a.aim && target) a.mesh.rotation.y = Math.atan2(target.x - p.x, target.z - p.z) + p.rot;
        }
      }
      if (!target || b.cd > 0) continue;
      let rate = atk.rate;
      if (powerId === p.id) rate *= 3.5;
      b.cd = 1 / Math.max(0.05, rate);
      const dmg = atk.dmg * this.mods.rRangedDmg;
      const shots = atk.multi || 1;
      // The 'tower' tag is what lets an enemy declare it is soft against towers.
      const attacker = { side: 'ally', def: { tags: ['ranged', 'tower'], mul: atk.mul || null } };
      for (let s = 0; s < shots; s++) {
        const tg = s === 0 ? target
          : (this.nearestEnemy(p.x + (this.rng() - 0.5) * 8, p.z + (this.rng() - 0.5) * 8, atk.range, true) || target);
        this.fire(atk.proj, p.x + (this.rng() - 0.5) * 0.7, p.y + 4.8, p.z, tg, dmg, {
          side: 'ally', splash: atk.splash || 0, slow: atk.slow || 0, attacker,
          arc: atk.proj === 'ball' ? 6 : 0,
        });
      }
      this.audio && this.audio.play(atk.proj === 'ball' || atk.proj === 'bolt' ? 'cannon' : 'bow', 0.28);
    }
    // the keep shoots too
    const catk = CASTLE_BASE.atk[this.castle.level - 1];
    this.castle.cd -= dt;
    if (this.castle.cd <= 0) {
      const range = catk.range * this.mods.castleRange;
      const t = this.nearestEnemy(0, 0, range, true);
      if (t) {
        this.castle.cd = 1 / (catk.rate * this.mods.castleRate);
        this.fire('arrow', 0, this.castle.y + 11, 0, t, catk.dmg * this.mods.towerDmg, {
          side: 'ally', attacker: { side: 'ally', def: { tags: ['ranged'] } },
        });
      } else this.castle.cd = 0.3;
    }
  }

  // ================================================================= bars
  drawBars(camQuat, hero) {
    // A white circle on every posted soldier while a hold order stands: the
    // original's confirmation that the order landed, and on whom.
    let hr = 0;
    if (hero && hero.commanding && hero.holdX != null) {
      for (const u of this.units) {
        if (!u.commanded || u.dead || hr >= this.holdRings.length) continue;
        const px = u.postX != null ? u.postX : u.x;
        const pz = u.postZ != null ? u.postZ : u.z;
        const r = this.holdRings[hr++];
        r.visible = true;
        r.position.set(px, this.groundY(px, pz) + 0.12, pz);
      }
    }
    for (let i = hr; i < this.holdRings.length; i++) this.holdRings[i].visible = false;

    this.bars.begin(camQuat);
    for (const u of this.units) {
      if (u.dead || (u.burrow > 0 && !u.def.dig.leap)) continue;
      const frac = u.hp / u.maxHp;
      if (frac >= 0.999 && !u.def.boss) continue;
      const w = u.def.boss ? 5.5 : (u.side === 'ally' ? 1.4 : 1.3);
      this.bars.add(u.x, u.y + u.h + 0.55, u.z, frac, w,
        u.side === 'ally' ? 0x6fa8f0 : (u.def.boss ? 0xff7a5a : (u.elite ? 0xffc94a : undefined)));
    }
    for (const s of this.structures()) {
      const hp = this.structHp(s), mx = this.structMaxHp(s);
      if (hp >= mx * 0.999) continue;
      this.bars.add(s.x, s.isCastle ? s.y + 16 : s.y + 5.6, s.z, hp / mx,
        s.isCastle ? 7 : 3, 0xe8d47a);
    }
    this.bars.end();
  }

  bossState() {
    let boss = null;
    for (const u of this.units) if (!u.dead && u.def.boss) { boss = u; break; }
    return boss;
  }

  dispose() {
    this.scene.remove(this.group);
    this.scene.remove(this.puffs.mesh);
    if (this.rain) this.scene.remove(this.rain.mesh);
    this.scene.remove(this.bars.bg);
    this.scene.remove(this.bars.fg);
  }
}
