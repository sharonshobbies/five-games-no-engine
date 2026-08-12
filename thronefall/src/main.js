// Game shell: state machine, input, the day/night blend, and the frame loop.
import * as THREE from '../vendor/three.module.min.js';
import { Renderer } from './render.js';
import { GameCamera } from './camera.js';
import { LEVELS, levelById, buildLevel, waveFor, mulberry } from './levels.js';
import { World } from './world.js';
import { Hero, CMD_CATS } from './hero.js';
import { Hud } from './hud.js';
import { Audio } from './audio.js';
import { applyLoadout, WEAPONS, PERKS, perkSlots } from './perks.js';
import * as SaveMod from './save.js';

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up', KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left', KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'sprint', ShiftRight: 'sprint',
};

class Game {
  constructor(canvas) {
    this.R = new Renderer(canvas);
    this.cam = new GameCamera();
    this.audio = new Audio();
    this.save = SaveMod.load();
    this.audio.enabled = true;
    this.state = 'title';
    this.world = null;
    this.hero = null;
    this.input = { up: 0, down: 0, left: 0, right: 0, sprint: 0 };
    this.nightBlend = 0;
    this.nightTarget = 0;
    this.paused = false;
    this.hud = new Hud(this);
    this.trials = null;
    this.pendingLevel = null;
    this._v = new THREE.Vector3();
    this.hoverPlot = null;
    this.bindInput(canvas);
    this.resize();
    addEventListener('resize', () => this.resize());
    document.getElementById('muteBtn').textContent = 'Sound: ' + (this.save.volume > 0 ? 'on' : 'off');
    document.getElementById('volBtn').textContent = document.getElementById('muteBtn').textContent;
    this.show('title');
  }

  persist() { SaveMod.save(this.save); }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.R.resize(w, h);
    this.cam.resize(w, h);
  }

  // ------------------------------------------------------------ input
  bindInput(canvas) {
    addEventListener('keydown', (e) => {
      if (KEYMAP[e.code]) { this.input[KEYMAP[e.code]] = 1; e.preventDefault(); }
      if (e.code === 'Space') {
        e.preventDefault();
        this.onSpace();
      }
      // ---- troop commanding: gather/release, hold, cycle, filter
      const cmd = this.state === 'play' && this.hero && !this.paused;
      // Left Ctrl is the original's command key, and the length of the press is
      // what distinguishes the two orders: a tap gathers and they follow, a long
      // press posts them on the ground where they stand.
      if (e.code === 'ControlLeft' && cmd && !e.repeat) {
        e.preventDefault();
        this.ctrlDown = performance.now();
        if (!this.hero.commanding) this.hero.gatherCommand();
        else if (this.hero.holdX != null) this.hero.toggleHold();
      }
      if (e.code === 'ControlLeft' && cmd && e.repeat && this.ctrlDown
        && performance.now() - this.ctrlDown > 520 && this.hero.holdX == null
        && this.hero.commanding) {
        this.hero.toggleHold();
        this.hud.toast('Holding this ground', 1.5);
      }
      if (e.code === 'KeyR' && cmd) {
        this.hero.toggleCommand();
        this.hud.toast(this.hero.commanding
          ? `Commanding ${this.hero.commandCount()} · ${this.hero.filterName()}`
          : 'Troops released', 1.5);
      }
      if (e.code === 'KeyH' && cmd) {
        this.hero.toggleHold();
        if (this.hero.commanding) {
          this.hud.toast(this.hero.holdX != null ? 'Hold this ground' : 'Follow me', 1.5);
        }
      }
      if (e.code === 'KeyF' && cmd) {
        const c = this.hero.cycleFilter();
        this.hud.toast(`Command filter: ${c.name}`, 1.5);
      }
      if (e.code === 'AltLeft' && cmd) {
        e.preventDefault();
        this.hero.toggleLock();
        this.hud.toast(this.hero.lockTarget
          ? `Locked: ${this.hero.lockTarget.def.name}` : 'Target released', 1.4);
      }
      if (e.code === 'Enter' && this.state === 'play' && this.world
        && this.world.phase === 'day' && !this.paused) this.beginNight();
      if (e.code === 'Escape') {
        if (this.hud.buildPlot) this.hud.closeBuild();
        else if (this.state === 'play') this.togglePause();
      }
      if (e.code === 'KeyQ') this.cam.zoom(12);
      if (e.code === 'KeyE') this.cam.zoom(-12);
      // number keys: command filters in play, holdings on the menus
      const digit = /^Digit([1-9])$/.exec(e.code);
      if (digit && cmd) {
        const c = CMD_CATS.find((x) => x.key === digit[1]);
        if (c) this.hud.toast(`Command filter: ${this.hero.setFilter(c.id).name}`, 1.5);
      }
      if (digit && this.state !== 'play') {
        const idx = parseInt(digit[1], 10) - 1;
        const L = LEVELS[idx];
        if (L && (!L.unlockedBy || this.save.cleared[L.unlockedBy] || idx === 0)) {
          this.pendingLevel = L; this.trials = null; this.startRun();
        }
      }
      // debug: dress every empty plot (documented in the README)
      if (e.code === 'KeyP' && this.state === 'play') this.devFill();
      // debug: jump to the last night so a big wave can be inspected
      if (e.code === 'KeyO' && this.state === 'play' && this.world && this.world.phase === 'day') {
        this.world.night = this.world.level.cfg.nights - 1;
        this.previewNight();
        this.beginNight();
      }
    });
    addEventListener('keyup', (e) => {
      if (KEYMAP[e.code]) this.input[KEYMAP[e.code]] = 0;
      if (e.code === 'ControlLeft') this.ctrlDown = 0;
    });
    canvas.addEventListener('wheel', (e) => {
      this.cam.zoom(Math.sign(e.deltaY) * 9);
      e.preventDefault();
    }, { passive: false });
    canvas.addEventListener('pointerdown', (e) => {
      this.audio.resume();
      if (this.state !== 'play' || this.paused) return;
      // middle mouse is the original's other command binding
      if (e.button === 1 && this.hero) {
        e.preventDefault();
        this.hero.toggleCommand();
        return;
      }
      if (e.button !== 0) return;
      this.pickAt(e.clientX, e.clientY);
    });
    canvas.addEventListener('pointermove', (e) => { this.mx = e.clientX; this.my = e.clientY; });
    addEventListener('blur', () => {
      for (const k in this.input) this.input[k] = 0;
    });
  }

  onSpace() {
    if (this.state !== 'play' || this.paused) return;
    // diegetic build: if the king is standing at a plot, open it
    const p = this.nearestPlotToHero();
    if (p && this.world.phase === 'day') {
      const sp = this.worldToScreen(p.x, p.y + 2, p.z);
      this.hud.openBuild(p, sp[0], sp[1]);
      this.audio.play('click');
      return;
    }
    if (this.hero) this.hero.useAbility();
  }

  /** Debug helper: fill the map so a night can be inspected at a glance. */
  devFill() {
    const w = this.world;
    if (!w) return;
    const keep = w.gold;
    w.gold = 9999;
    const kinds = {
      eco: ['mill', 'house', 'blacksmith', 'field', 'house', 'forge', 'mill'],
      tower: ['tower'], unit: ['barracks', 'archery'],
      wall: ['wall'], gate: ['gate'],
      harbour: ['harbour'], bridge: ['bridge'],
    };
    let i = 0;
    for (const p of w.level.plots) {
      if (p.building) continue;
      const list = kinds[p.kind];
      if (!list) continue;
      if (w.place(p, list[(i++) % list.length], null)) {
        const opts = w.levelUpOptions(p);
        if (opts.length && i % 2 === 0) w.levelUp(p, opts[Math.floor(Math.random() * opts.length)].id);
      }
    }
    // put one project in flight so the research readout has something to show
    for (const p of w.level.plots) {
      const b = p.building;
      if (!b || !b.stats.research || b.projects.length) continue;
      const table = b.stats.research === 'forge' ? 'sharper' : 'meleeatk';
      w.startResearch(p, table);
    }
    if (w.castle.level < 2) w.upgradeCastle('royaltraining');
    w.refillGarrisons();
    this.hero.refresh();
    w.gold = keep + 20;
    this.hud.toast('Debug: plots dressed', 1.6);
  }

  nearestPlotToHero() {
    if (!this.world || !this.hero) return null;
    let best = null, bd = 8;
    for (const pl of this.world.level.plots) {
      const d = Math.hypot(pl.x - this.hero.x, pl.z - this.hero.z);
      const rad = (pl.kind === 'wall' || pl.kind === 'gate') ? 5.5 : 6;
      if (d < Math.min(bd, rad)) { bd = d; best = pl; }
    }
    const dc = Math.hypot(this.hero.x, this.hero.z);
    if (dc < 11 && dc < bd) return this.world.castle;
    return best;
  }

  pickAt(sx, sy) {
    const w = this.world;
    const ndcX = (sx / innerWidth) * 2 - 1;
    const ndcY = -(sy / innerHeight) * 2 + 1;
    if (!this.cam.groundPoint(ndcX, ndcY, 1.0, this._v)) return;
    const gx = this._v.x, gz = this._v.z;
    let best = null, bd = 7;
    for (const pl of w.level.plots) {
      const d = Math.hypot(pl.x - gx, pl.z - gz);
      const rad = (pl.kind === 'wall' || pl.kind === 'gate') ? Math.max(4, (pl.segLen || 8) * 0.5) : 4.2;
      if (d < rad && d < bd) { bd = d; best = pl; }
    }
    if (Math.hypot(gx, gz) < 7) best = w.castle;
    if (best) {
      const sp = this.worldToScreen(best.x, (best.y || 0) + 2, best.z);
      this.hud.openBuild(best, sp[0], sp[1]);
      this.audio.play('click');
    } else this.hud.closeBuild();
  }

  worldToScreen(x, y, z) {
    this._v.set(x, y, z).project(this.cam.cam);
    return [(this._v.x * 0.5 + 0.5) * innerWidth, (-this._v.y * 0.5 + 0.5) * innerHeight];
  }

  // ------------------------------------------------------------ states
  show(name) {
    this.state = name;
    this.hud.showScreen(name);
    if (name !== 'play') this.ensureShowcase();
    if (name === 'levels') { this.hud.renderLevels(); this.audio.music('day'); }
    if (name === 'loadout') this.hud.renderLoadout();
    if (name === 'title') this.audio.music('day');
  }

  /** A dressed, playable-looking keep used as the menu backdrop. */
  ensureShowcase() {
    if (this.world) return;
    const cfg = LEVELS[1];
    const level = buildLevel(cfg);
    const mods = applyLoadout([], []);
    this.world = new World(this.R, level, mods, 'bow', this.audio);
    this.showcaseWorld = true;
    this.world.gold = 999;
    const kinds = { eco: ['house', 'mill'], tower: ['tower'], unit: ['barracks', 'archery'], wall: ['wall'], gate: ['gate'] };
    let i = 0;
    for (const p of level.plots) {
      const list = kinds[p.kind];
      if (!list) continue;
      const id = list[(i++) % list.length];
      const def = this.world.canPlace(p, id);
      if (def) {
        this.world.place(p, id, null);
        if (i % 3 === 0) {
          const opts = this.world.levelUpOptions(p);
          if (opts.length) this.world.levelUp(p, opts[0].id);
        }
      }
    }
    this.world.upgradeCastle('royaltraining');
    this.world.refillGarrisons();
    for (const m of this.world.spawnMarkers) m.visible = true;
    this.nightBlend = 0.0;
    this.R.applyNight(0, true);
    this.cam.distWant = 130;
    this.cam.dist = 130;
    this.cam.setTarget(0, 0, true);
  }

  pickLevel(id) {
    this.pendingLevel = levelById(id);
    this.trials = null;
    this.show('loadout');
  }

  // --- Eternal Trials: a roguelike ladder that drafts as you climb
  startTrials() {
    this.trials = { stage: 0, perks: [], score: 0, cleared: 0 };
    this.offerTrial();
  }

  offerTrial() {
    const t = this.trials;
    t.stage += 1;
    const rnd = mulberry(Date.now() ^ (t.stage * 7919));
    const acc = SaveMod.accountLevel(this.save.xp);
    const pool = PERKS.filter((p) => p.lvl <= Math.max(12, acc.level));
    const weapons = Object.values(WEAPONS).filter((w) => (
      (!w.unlock || !!this.save.cleared[w.unlock]) && (!w.lvl || acc.level >= w.lvl)));
    const opts = [];
    for (let i = 0; i < 3; i++) {
      const lv = LEVELS[Math.min(LEVELS.length - 1, Math.floor(rnd() * Math.min(LEVELS.length, 2 + t.stage)))];
      const perks = [];
      while (perks.length < 2) {
        const p = pool[Math.floor(rnd() * pool.length)];
        if (p && perks.indexOf(p) < 0) perks.push(p);
      }
      opts.push({ level: lv, weapon: weapons[Math.floor(rnd() * weapons.length)] || WEAPONS.bow, perks });
    }
    this.show('trial');
    this.hud.renderTrialPick(opts, t.stage);
  }

  chooseTrial(opt) {
    const t = this.trials;
    for (const p of opt.perks) if (t.perks.indexOf(p.id) < 0) t.perks.push(p.id);
    this.pendingLevel = opt.level;
    this.trialWeapon = opt.weapon.id;
    this.startRun();
  }

  startRun() {
    const cfg = this.pendingLevel || LEVELS[0];
    this.teardown();
    const level = buildLevel(cfg);
    const perks = this.trials ? this.trials.perks : this.save.perks;
    const muts = this.trials ? [] : this.save.mutators;
    const weapon = this.trials ? this.trialWeapon : this.save.weapon;
    const mods = applyLoadout(perks, muts);
    // trials scale up as you climb
    if (this.trials && this.trials.stage > 1) {
      const s = 1 + (this.trials.stage - 1) * 0.22;
      mods.enemyHp *= s; mods.enemyDmg *= s;
      mods.scoreMul += (this.trials.stage - 1) * 0.25;
    }
    this.world = new World(this.R, level, mods, weapon, this.audio);
    this.world.gold = Math.max(0, Math.round(cfg.startGold + mods.startGold));
    this.hero = new Hero(this.world, weapon);
    this.hero.x = 12; this.hero.z = -10;
    this.cam.distWant = 112;
    this.cam.setTarget(0, 6, true);
    this.nightBlend = 0; this.nightTarget = 0;
    this.world.nightBlend = 0;
    this.R.applyNight(0, true);
    this.hud.showMutTags(muts);
    this.show('play');
    this.audio.music('day');
    this.hud.toast(`${cfg.name} — ${cfg.nights} nights to hold`, 3.4);
    this.previewNight();
    this.paused = false;
  }

  previewNight() {
    if (!this.world) return;
    this.pendingWave = waveFor(this.world.level, this.world.night + 1, this.world.mods);
    this.hud.showWavePreview(this.pendingWave);
  }

  beginNight() {
    const w = this.world;
    if (!w || w.phase !== 'day') return;
    this.hud.closeBuild();
    w.startNight(this.pendingWave || waveFor(w.level, w.night + 1, w.mods), this.hero);
    this.nightTarget = 1;
    this.audio.music('night');
    this.hud.toast(`Night ${w.night} falls`, 2.2);
  }

  togglePause() {
    if (this.state !== 'play' && !this.paused) return;
    this.paused = !this.paused;
    document.getElementById('pause').classList.toggle('hidden', !this.paused);
  }

  abandon() {
    this.paused = false;
    document.getElementById('pause').classList.add('hidden');
    this.finish(false, true);
  }

  finish(won, silent) {
    const w = this.world;
    if (!w) return;
    const score = w.finalScore();
    const xpGain = Math.round(score / 8);
    let extra = '';
    if (this.trials) {
      this.trials.score += score;
      if (won) {
        this.trials.cleared++;
        const total = this.trials.score + this.trials.cleared * this.trials.cleared * 10000;
        extra = `<br><b>Trials stage ${this.trials.stage} cleared.</b> Run total ${total.toLocaleString()}.`;
      } else {
        const total = this.trials.score + this.trials.cleared * this.trials.cleared * 10000;
        const prev = this.save.cleared.__trials;
        this.save.cleared.__trials = { best: Math.max(prev ? prev.best : 0, total), mutators: [] };
        extra = `<br>Trials run over after ${this.trials.cleared} stage(s). Total ${total.toLocaleString()}.`;
      }
    }
    if (!silent) {
      this.save.xp += xpGain;
      if (won && !this.trials) {
        SaveMod.recordClear(this.save, w.level.cfg.id, score, this.save.mutators);
        const wp = w.level.cfg.unlocksWeapon;
        if (wp && WEAPONS[wp]) extra += `<br><b>${WEAPONS[wp].name}</b> unlocked.`;
      }
      this.persist();
    }
    this.audio.play(won ? 'win' : 'lose');
    this.audio.music('day');
    if (this.trials && won) {
      // straight into the next stage draft
      this.hud.renderResult(true, w, xpGain, extra);
      this.show('result');
      const nextBtn = document.getElementById('resRetry');
      nextBtn.textContent = 'Next stage →';
      nextBtn.onclick = () => { nextBtn.textContent = 'Try again'; this.offerTrial(); };
      return;
    }
    document.getElementById('resRetry').textContent = 'Try again';
    document.getElementById('resRetry').onclick = () => this.startRun();
    if (this.trials && !won) this.trials = null;
    this.hud.renderResult(won, w, xpGain, extra);
    this.show('result');
  }

  teardown() {
    if (this.world) { this.world.dispose(); this.world = null; }
    this.hero = null;
    this.hud.closeBuild();
  }

  // ------------------------------------------------------------ loop
  frame(dt) {
    const playing = this.state === 'play' && this.world && !this.paused;
    if (playing) {
      const w = this.world;
      // day/night lighting blend
      const k = Math.min(1, dt / 2.4);
      this.nightBlend += (this.nightTarget - this.nightBlend) * k;
      w.nightBlend = this.nightBlend;
      this.R.applyNight(this.nightBlend);
      // spawn markers glow during the day
      const dayVis = this.nightBlend < 0.9;
      for (const m of w.spawnMarkers) m.visible = dayVis;
      for (const p of w.level.plots) {
        if (!p.building) p.marker.visible = w.phase === 'day';
      }
      this.world.markerMat.opacity = 0.26 + 0.22 * (0.5 + 0.5 * Math.sin(performance.now() * 0.0028));

      this.hero.update(dt, this.input, this.cam.yaw);
      w.update(dt, this.hero);

      // highlight the plot the king is standing at
      const np = this.hero.down ? null : this.nearestPlotToHero();
      w.selRing.visible = !!np && w.phase === 'day';
      if (np) {
        w.selRing.position.set(np.x, (np.y || 0) + 0.15, np.z);
        w.selRing.scale.setScalar(np === w.castle ? 2.6 : 1);
      }
      // show range for the selected building
      const bp = this.hud.buildPlot;
      if (bp && bp.building && bp.building.stats.atk) {
        w.rangeRing.visible = true;
        w.rangeRing.position.set(bp.x, bp.y + 0.16, bp.z);
        w.rangeRing.scale.setScalar(bp.building.stats.atk.range / 20);
      } else w.rangeRing.visible = false;

      // target-lock reticle sits on the marked enemy
      const lt = this.hero.lockTarget;
      w.lockRing.visible = !!lt && !lt.dead;
      if (lt && !lt.dead) {
        w.lockRing.position.set(lt.x, lt.y + 0.16, lt.z);
        const pulse = 1 + Math.sin(performance.now() * 0.007) * 0.09;
        w.lockRing.scale.setScalar(pulse * (0.55 + (lt.r || 0.6) * 0.75));
      }
      w.heroRing.visible = !this.hero.down;
      this.R.heroLight.position.set(this.hero.x, this.hero.y + 4.5, this.hero.z);
      w.heroRing.position.set(this.hero.x, this.hero.y + 0.13, this.hero.z);
      this.cam.setTarget(this.hero.x, this.hero.z, false);
      this.cam.update(dt, w.level);
      w.drawBars(this.cam.cam.quaternion, this.hero);
      if (w.rain) w.rain.update(dt, this.hero.x, this.hero.z);
      this.hud.update(w, this.hero, dt);

      if (w.phase === 'day' && this.nightTarget === 1) {
        // dawn just broke
        this.nightTarget = 0;
        this.audio.music('day');
        this.hud.goldDelta(w.lastIncome || 0, w.lastLoot || 0);
        const done = w.lastResearch || [];
        if (done.length) {
          this.hud.toast(`Research complete: ${done.map((o) => o.name).join(', ')}`, 3.4);
        } else {
          this.hud.toast(`Dawn. +${(w.lastIncome || 0) + (w.lastLoot || 0)} gold`, 2.6);
        }
        this.hud.nextTip();
        this.previewNight();
        this.hero.refresh();
      }
      if (w.phase === 'won') { this.finish(true); }
      else if (w.phase === 'lost') { this.finish(false); }
    } else if (this.world) {
      // menu backdrop: slow orbit over a dressed keep, mills turning
      this.cam.yaw += dt * 0.045;
      this.cam.setTarget(0, 0, false);
      this.cam.update(dt, this.world.level);
      const w = this.world;
      for (const p of w.level.plots) {
        if (!p.animParts) continue;
        for (const a of p.animParts) if (a.spin === 'z') a.mesh.rotation.z += dt * 1.1;
      }
      w.puffs.update(dt);
      w.bars.begin(this.cam.cam.quaternion);
      w.bars.end();
      if (this.paused) this.cam.yaw -= dt * 0.045;
    }
    this.R.render(this.cam.cam);
  }
}

export async function boot() {
  const canvas = document.getElementById('gl');
  const game = new Game(canvas);
  window.__game = game;
  const loading = document.getElementById('loading');
  if (loading) loading.remove();
  let last = performance.now();
  function tick(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    try {
      game.frame(dt);
    } catch (e) {
      console.error('frame error', e);
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
  return game;
}
