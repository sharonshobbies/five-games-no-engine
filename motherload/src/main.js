// Game shell: state machine, input, the event hooks every system calls into.

import {
  VIEW_W, VIEW_H, TILE, GRID_W, DYNAMITE_FUSE, DYNAMITE_RADIUS, PLASTIC_RADIUS,
  BLAST_SELF_DAMAGE, GAS_RADIUS, GAS_FUEL_GAIN, MAX_DIG_DEPTH_FT, SURFACE_ROW,
  RESERVE_TANK_LITRES, ALTIMETER_FAIL_FT,
} from "./config.js";
import { World, T } from "./world.js";
import { Pod } from "./pod.js";
import { Renderer } from "./render.js";
import { Particles } from "./particles.js";
import { Audio } from "./audio.js";
import { Story, TRANSMISSIONS, LAIR_INTRO, NATAS_FORM2, OILERS } from "./story.js";
import { Boss, BLAST_DAMAGE } from "./boss.js";
import { drawHUD, drawTransmission, drawTitle, drawDeath, drawVictory, drawPause } from "./hud.js";
import { drawShop, shopClick, shopHover } from "./shop.js";
import { NANOBOT_REPAIR, LINES } from "./upgrades.js";
import { saveGame, loadRaw, applySave, clearSave } from "./save.js";
import { hit, money } from "./ui.js";
import { SELLABLE, sellValue, setCycle, getCycle, MAX_CYCLES } from "./ore.js";
import { Music, sceneForDepth } from "./music.js";
import { loadSettings } from "./settings.js";
import {
  drawOptions, optionsClick, optionsHover, optionsDrag, drawInventory,
} from "./screens.js";
import {
  CHALLENGES, ChallengeRun, prepareWorld, loadoutFor, loadProgress, saveProgress,
  resetProgress,
} from "./challenge.js";
import {
  drawChallengeSelect, challengeSelectClick, challengeSelectHover, drawChallengeHUD,
  drawChallengeResult, challengeResultClick, challengeResultHover,
  nextChallenge,
} from "./challenge-ui.js";

const KEYMAP = {
  ArrowUp: "up", KeyW: "up",
  ArrowDown: "down", KeyS: "down",
  ArrowLeft: "left", KeyA: "left",
  ArrowRight: "right", KeyD: "right",
};

class Game {
  constructor(canvas) {
    this.canvas = canvas;
    loadSettings();
    this.world = new World(20040101);
    this.pod = new Pod(this.world);
    this.renderer = new Renderer(canvas, this.world);
    this.particles = new Particles();
    this.audio = new Audio();
    this.music = new Music(this.audio);
    this.story = new Story();
    this.boss = null;

    this.state = "title";
    this.input = { up: false, down: false, left: false, right: false };
    this.bombs = [];
    this.time = 0;
    this.blink = 0;
    this.strandedTimer = 0;
    this.warning = null;
    this.warningTimer = 0;
    this.shopTab = "shop";
    this.shopRects = [];
    this.shopMessage = null;
    this.shopMessageTimer = 0;
    this.hoverKey = null;
    this.mouse = { x: 0, y: 0 };
    this.nearVendor = null;
    this.hasSave = !!loadRaw();
    this.lostValue = 0;
    this.newGamePlus = 0;
    this.pendingSaveTimer = 0;

    // Challenge mode, and the two overlays the original also has.
    this.mode = "adventure";          // adventure | challenge
    this.challenge = null;            // a ChallengeRun while one is in progress
    this.challengeProgress = loadProgress();
    this.challengeIndex = 0;
    this.challengeAllClear = false;
    this.overlay = null;              // null | "options" | "inventory"
    this.sliderDrag = null;
    this.saveFlashTimer = 0;
    setCycle(this.newGamePlus);

    this.bindEvents();
  }

  // ---- lifecycle ------------------------------------------------------------
  startGame(fresh) {
    this.mode = "adventure";
    this.challenge = null;
    this.overlay = null;
    if (fresh) {
      clearSave();
      this.world = new World(20040101 + this.newGamePlus * 7919);
      this.pod = new Pod(this.world);
      this.renderer.world = this.world;
      this.renderer.chunks.clear();
      this.renderer.chunkOrder.length = 0;
      this.renderer.vendorSprites = null;
      this.story = new Story();
    } else {
      const raw = loadRaw();
      if (raw) applySave(this, raw);
    }
    setCycle(this.newGamePlus);
    // Clearing Challenge mode fits the Multi-Drill on every new game after it.
    if (this.challengeProgress.multidrill) this.pod.blueprints.multidrill = true;
    this.pod.reset();
    this.boss = null;
    this.bombs.length = 0;
    this.state = "play";
    this.audio.resume();
    this.story.fire(TRANSMISSIONS[0]);
    for (const code of this.pendingCheats || []) this.applyCode(code);
    this.save();
  }

  // ---- challenge mode -------------------------------------------------------
  /**
   * Twelve timed objectives. Each one gets its own purpose-shaped world and its
   * own loadout, and fuel/hull arrive full -- the wiki's "every time challenge
   * is completed, fuel is refilled, and hull is repaired".
   */
  startChallenge(n) {
    const spec = CHALLENGES[Math.max(1, Math.min(CHALLENGES.length, n)) - 1];
    this.mode = "challenge";
    this.overlay = null;
    this.challengeAllClear = false;
    setCycle(0);
    this.world = new World(90000 + spec.n * 1313);
    this.pod = new Pod(this.world);
    this.renderer.world = this.world;
    this.renderer.chunks.clear();
    this.renderer.chunkOrder.length = 0;
    this.renderer.vendorSprites = null;
    this.story = new Story();
    this.boss = null;
    this.bombs.length = 0;
    this.warning = null;
    this.warningTimer = 0;

    const prep = prepareWorld(this.world, spec);
    Object.assign(this.pod.tiers, loadoutFor(spec.n));
    // Enough charges to answer challenge 9, and a little field support.
    this.pod.items = {
      dynamite: 8, plastic: 3, teleporter: 0, transmitter: 0, reserve: 2, nanobots: 2,
    };
    this.pod.reset();
    if (prep.spawn) {
      this.pod.x = prep.spawn.x;
      this.pod.y = prep.spawn.y;
    }
    this.pod.fuel = this.pod.maxFuel();
    this.pod.hull = this.pod.maxHull();

    this.challenge = new ChallengeRun(spec);
    this.challenge.goal = prep.goal;
    this.challengeIndex = spec.n;
    this.state = "play";
    this.audio.resume();
    this.audio.blip(880, 0.12, "square", 0.12);
  }

  finishChallenge() {
    const run = this.challenge;
    if (!run) return;
    const p = this.challengeProgress;
    if (run.status === "cleared") {
      if (!p.cleared.includes(run.spec.n)) p.cleared.push(run.spec.n);
      this.audio.discovery();
      this.renderer.addFlash(0.5, "#8dffa8");
    } else {
      // "Complete all 12 challenges in challenge mode without failing."
      p.flawless = false;
      this.audio.death();
    }
    this.challengeAllClear = p.cleared.length >= CHALLENGES.length;
    if (this.challengeAllClear && p.flawless) p.multidrill = true;
    saveProgress(p);
    this.state = "challengeResult";
    this.audio.setDrill(false);
    this.audio.setThrust(0);
  }

  resetChallengeProgress() {
    this.challengeProgress = resetProgress();
    this.audio.deny();
  }

  /** The interface is locked out during the boss fight, as in the original. */
  inBossFight() { return !!(this.boss && !this.boss.dead); }

  closeOverlay() {
    this.overlay = null;
    this.sliderDrag = null;
    this.audio.blip(320, 0.07);
  }

  /**
   * Four squares above the arena ceiling abandons the fight. He heals and the
   * chamber is empty until you drop back in.
   */
  abandonBossFight() {
    if (!this.boss) return;
    this.boss = null;
    this.bombs.length = 0;
    this.setWarning("YOU LEFT THE CHAMBER - MR. NATAS IS WHOLE AGAIN");
    this.audio.alarm();
  }

  // Using a cheat code stamps the run and stops it being saved, as in the
  // original (where a cheated score is tagged "Cheater").
  save() {
    if (this.cheated) return;
    this.hasSave = saveGame(this);
  }

  /** Options-screen cheat codes, typed on the title or pause screen. */
  feedCode(ch) {
    this.codeBuffer = ((this.codeBuffer || "") + ch).slice(-12);
    for (const code in this.codeTable()) {
      if (!this.codeBuffer.endsWith(code)) continue;
      this.pendingCheats = this.pendingCheats || [];
      this.pendingCheats.push(code);
      this.applyCode(code);
      this.cheated = true;
      this.codeBuffer = "";
      this.cheatMessage = `CHEAT ACCEPTED: ${code.toUpperCase()} - saving disabled`;
      this.cheatTimer = 3.5;
      this.audio.discovery();
      return true;
    }
    return false;
  }

  applyCode(code) {
    const fn = this.codeTable()[code];
    if (fn) fn();
  }

  codeTable() {
    return {
      blingbling: () => { this.pod.cash += 100000; },
      penetrable: () => this.bumpTier("hull"),
      digdug: () => this.bumpTier("drill"),
      warp9: () => this.bumpTier("engine"),
      guzzle: () => this.bumpTier("fuel"),
      toocool: () => this.bumpTier("radiator"),
      supersize: () => this.bumpTier("cargo"),
      fillerup: () => { this.pod.fuel = this.pod.maxFuel(); },
      ntouchable: () => {
        for (const k of ["fuel", "drill", "engine", "hull", "cargo", "radiator"]) {
          this.pod.tiers[k] = LINES[k].tiers.length - 1;
        }
        this.pod.fuel = this.pod.maxFuel();
        this.pod.hull = this.pod.maxHull();
        for (const k in this.pod.items) this.pod.items[k] += 5;
      },
    };
  }

  bumpTier(line) {
    const max = LINES[line].tiers.length - 1;
    this.pod.tiers[line] = Math.min(max, this.pod.tiers[line] + 1);
    if (line === "fuel") this.pod.fuel = this.pod.maxFuel();
    if (line === "hull") this.pod.hull = this.pod.maxHull();
  }

  killPod(title, text) {
    if (this.pod.dead) return;
    if (this.mode === "challenge" && this.challenge) {
      this.pod.dead = true;
      this.audio.setDrill(false);
      this.audio.setThrust(0);
      this.renderer.addShake(20);
      this.particles.sparks(this.pod.x, this.pod.y, 60, "#ffb040");
      this.challenge.fail(title);
      return;
    }
    this.pod.dead = true;
    this.pod.stats.deaths++;
    this.lostValue = this.pod.cargoValue();
    this.deathTitle = title;
    this.deathText = text;
    this.state = "dead";
    this.audio.death();
    this.audio.setDrill(false);
    this.audio.setThrust(0);
    this.renderer.addShake(20);
    this.renderer.addFlash(0.8, "#ff5a2a");
    this.particles.sparks(this.pod.x, this.pod.y, 60, "#ffb040");
    this.particles.smoke(this.pod.x, this.pod.y, 24);
  }

  restoreSave() {
    const raw = loadRaw();
    // Losing the run means losing the hold and the tunnels since the last dock.
    this.world = new World(this.world.seed);
    this.renderer.world = this.world;
    this.renderer.chunks.clear();
    this.renderer.chunkOrder.length = 0;
    const deaths = this.pod.stats.deaths;
    const score = this.pod.score;
    this.pod = new Pod(this.world);
    this.pod.stats.deaths = deaths;
    this.pod.score = score;
    if (raw) applySave(this, raw);
    this.pod.cargo = {};
    this.pod.dead = false;
    this.pod.reset();
    this.bombs.length = 0;
    this.boss = null;
    this.state = "play";
  }

  // ---- event hooks ----------------------------------------------------------
  onDrilling(dt, c, r, dir) {
    this.audio.setDrill(true, 0.7 + this.pod.drillSpeed() / 160);
    if (Math.random() < dt * 26) {
      const px = c * TILE + TILE / 2, py = r * TILE + TILE / 2;
      const col = this.world.typeAt(c, r) === T.ROCK ? "#8a8f9a" : "#6b4a2c";
      this.particles.dust(
        px - Math.sign(dir === "left" ? -1 : dir === "right" ? 1 : 0) * 8,
        py, col, 2, 90);
    }
  }

  onTileDug(c, r, got) {
    this.particles.dust(c * TILE + TILE / 2, r * TILE + TILE / 2, "#7a5432", 8, 120);
    this.audio.blip(240 + Math.random() * 60, 0.05, "triangle", 0.06);
    if (!got) return;

    if (got.art && got.art.blueprint) {
      const bp = got.art.blueprint;
      this.pod.blueprints[bp.id] = true;
      this.story.push({
        id: "bp" + bp.id, speaker: "ANCIENT BLUEPRINT", face: "god",
        lines: [`${bp.name} recovered.`, bp.desc],
      });
      this.audio.discovery();
      this.renderer.addFlash(0.5, "#c9a4ff");
      this.particles.sparks(c * TILE + TILE / 2, r * TILE + TILE / 2, 30, "#c9a4ff");
      this.save();
      return;
    }

    const entry = got.art ? got.art.artifact : got.ore;
    if (!entry) {
      // The Oil-Bird pays for plain dirt.
      if (this.pod.eggs.oilbird) {
        this.pod.cash += 8;
        this.pod.stats.earned += 8;
        if (Math.random() < 0.25) {
          this.particles.floatText(c * TILE + TILE / 2, r * TILE, "+$8", "#9ff0a4", 0.8);
        }
      }
      return;
    }
    const res = this.pod.collect(entry);
    if (res !== "full" && this.challenge) this.challenge.onCollect(entry.id);
    const px = c * TILE + TILE / 2, py = r * TILE + TILE / 2;
    if (res === "full") {
      this.particles.floatText(px, py, "CARGO FULL", "#f0533f");
      this.setWarning("CARGO HOLD FULL - RETURN TO THE SURFACE");
      this.audio.deny();
    } else {
      this.particles.floatText(px, py, `${entry.name}  ${money(sellValue(entry))}`, entry.color || "#ffd451");
      this.particles.sparks(px, py, 10, entry.glint || "#fff2b0");
      this.audio.pickup(sellValue(entry));
    }
  }

  onImpact(dmg, x, y, extra) {
    if (dmg <= 0) return;
    this.particles.floatText(x, y - 18, `-${Math.round(dmg)}`, "#f0533f", 1.0);
    this.particles.sparks(x, y, Math.min(22, 5 + dmg), "#ffcf70");
    this.renderer.addShake(Math.min(14, 2 + dmg * 0.35));
    this.audio.hit();
    void extra;
  }

  onLavaHit(dmg) {
    this.setWarning(`LAVA - ${Math.round(dmg)} DAMAGE. GET OUT.`);
    this.renderer.addFlash(0.3, "#ff5a10");
    this.particles.smoke(this.pod.x, this.pod.y, 10, "rgba(90,40,20,0.8)");
  }

  onRockBlocked() {
    this.setWarning("SOLID ROCK - NO DRILL CUTS IT. USE EXPLOSIVES.");
  }

  setWarning(text) {
    this.warning = text;
    this.warningTimer = 2.6;
  }

  grantBounty(amount) {
    this.pod.cash += amount;
    this.pod.stats.earned += amount;
    this.particles.floatText(this.pod.x, this.pod.y - 40, `+${money(amount)}`, "#ffd451", 2.2);
    this.audio.sell();
    this.save();
  }

  grantEgg(id) {
    this.pod.eggs[id] = true;
    this.audio.discovery();
    this.renderer.addFlash(0.6, "#ffffff");
    this.save();
  }

  /** Gas pockets look exactly like soil, so this is always a nasty surprise. */
  igniteGas(c, r) {
    if (!this.world.hasGas(c, r)) return;
    const depth = Math.max(0, this.world.depthFtOfRow(r));
    // ((depth - 3000) / 15) * (1 - radiator effectiveness). The wiki prints the
    // sign as "+3000" but its own worked values (180 HP at -5,700 ft, 287 HP at
    // -7,300 ft) only come out with -3000, so that is the form used here.
    const raw = Math.max(8, (depth - 3000) / 15);
    const dmg = Math.round(raw * (1 - this.pod.heatResist()));
    this.explode(c, r, GAS_RADIUS, 0, "#7dff9a");
    this.pod.damage(dmg, this, this.pod.x, this.pod.y);
    this.setWarning(`GAS POCKET - ${dmg} DAMAGE`);
    this.renderer.addFlash(0.55, "#8dffa8");
    this.audio.explosion();
    if (this.pod.blueprints.fuelIntegrator) {
      this.pod.fuel = Math.min(this.pod.maxFuel(), this.pod.fuel + GAS_FUEL_GAIN);
      this.particles.floatText(this.pod.x, this.pod.y - 36, `+${GAS_FUEL_GAIN} L`, "#ffa726");
    }
  }

  /** Clear a blast crater. `selfDamage` > 0 also hurts a pod inside it. */
  explode(cc, rr, radiusTiles, selfDamage, color = "#ffb040", kind = null) {
    const w = this.world;
    const rad = radiusTiles;
    const chained = [];
    for (let dr = -Math.ceil(rad); dr <= Math.ceil(rad); dr++) {
      for (let dc = -Math.ceil(rad); dc <= Math.ceil(rad); dc++) {
        if (dc * dc + dr * dr > rad * rad) continue;
        const c = cc + dc, r = rr + dr;
        if (!w.inBounds(c, r)) continue;
        if (w.typeAt(c, r) === T.BEDROCK) continue;
        if (w.hasGas(c, r) && !(dc === 0 && dr === 0)) chained.push([c, r]);
        w.clear(c, r);
      }
    }
    const px = cc * TILE + TILE / 2, py = rr * TILE + TILE / 2;
    this.particles.sparks(px, py, 46, color);
    this.particles.smoke(px, py, 20);
    this.particles.dust(px, py, "#6b4a2c", 26, 300);
    this.renderer.addShake(14);
    this.renderer.addFlash(0.35, color);

    if (selfDamage > 0) {
      const d = Math.hypot(this.pod.x - px, this.pod.y - py) / TILE;
      if (d < rad + 0.8) this.pod.damage(selfDamage, this, this.pod.x, this.pod.y);
    }
    // Explosives are the only thing that hurts Mr. Natas, and the charge has to
    // land at his feet for full damage. A gas pocket cooking off is not a weapon.
    if (this.boss && !this.boss.dead && kind) {
      const dealt = this.boss.applyBlast(kind, px, py, rad, this);
      if (dealt > 0) {
        this.particles.floatText(this.boss.x, this.boss.y - this.boss.h * 0.5,
          `-${dealt}`, dealt >= BLAST_DAMAGE.plastic ? "#ffe08a" : "#ffb060", 1.4);
      }
    }
    // Challenge 9 is judged on whether the charge actually breached the slab.
    if (this.challenge) {
      this.challenge.onBlastRows(rr - Math.ceil(rad), rr + Math.ceil(rad), this.world.blastLayer);
    }
    // chain reaction, next frame
    for (const [c, r] of chained) {
      setTimeout(() => this.igniteGas(c, r), 90 + Math.random() * 120);
    }
  }

  // ---- items ----------------------------------------------------------------
  useItem(key) {
    const p = this.pod;
    if (this.state !== "play" || p.dead) return;

    if (p.bounceLock > 0 && (key === "dynamite" || key === "plastic" || key === "teleporter")) {
      this.audio.deny();
      return this.setWarning("KNOCKED BACK - WAIT FOR THE POD TO SETTLE");
    }

    if (key === "dynamite" || key === "plastic") {
      if (!p.onGround) return this.setWarning("MUST BE ON SOLID GROUND");
      if (p.items[key] <= 0) return this.deny();
      p.items[key]--;
      this.bombs.push({
        x: p.x, y: p.y + 10, fuse: DYNAMITE_FUSE,
        radius: key === "plastic" ? PLASTIC_RADIUS : DYNAMITE_RADIUS,
        kind: key,
      });
      this.audio.blip(300, 0.08, "square", 0.1);
      return;
    }

    if (key === "teleporter") {
      const infinite = !!p.blueprints.hyperdrive;
      if (!infinite && p.items.teleporter <= 0) return this.deny();
      if (!p.onGround && !infinite) return this.setWarning("MUST BE ON SOLID GROUND");
      if (!infinite) p.items.teleporter--;
      this.audio.teleport();
      this.particles.sparks(p.x, p.y, 40, "#a0e0ff");
      p.x = 13.5 * TILE;
      p.y = SURFACE_ROW * TILE - 40;
      p.vx = 0; p.vy = 0;
      p.falling = false;
      this.renderer.addFlash(0.4, "#a0e0ff");
      return;
    }

    if (key === "transmitter") {
      if (p.items.transmitter <= 0) return this.deny();
      if (!p.onGround) return this.setWarning("MUST BE ON SOLID GROUND");
      if (p.cargoValue() <= 0) return this.setWarning("NOTHING IN THE HOLD");
      p.items.transmitter--;
      const got = p.sellAll();
      this.audio.sell();
      this.particles.floatText(p.x, p.y - 30, `BEAMED  +${money(got.cash)}`, "#ffd451", 2.4);
      this.save();
      return;
    }

    if (key === "reserve") {
      if (p.items.reserve <= 0) return this.deny();
      p.items.reserve--;
      p.fuel = Math.min(p.maxFuel(), p.fuel + RESERVE_TANK_LITRES);
      this.audio.buy();
      this.particles.floatText(p.x, p.y - 30, `+${RESERVE_TANK_LITRES} L`, "#ffa726");
      return;
    }

    if (key === "nanobots") {
      if (p.items.nanobots <= 0) return this.deny();
      if (p.hull >= p.maxHull()) return this.setWarning("HULL ALREADY INTACT");
      p.items.nanobots--;
      p.hull = Math.min(p.maxHull(), p.hull + NANOBOT_REPAIR);
      this.audio.buy();
      this.particles.floatText(p.x, p.y - 30, `+${NANOBOT_REPAIR} HULL`, "#6fe08a");
      this.particles.sparks(p.x, p.y, 16, "#6fe08a");
    }
  }

  deny() {
    this.audio.deny();
    this.setWarning("NONE IN STOCK - BUY AT EMENDATION STATION 3500");
  }

  // ---- boss -----------------------------------------------------------------
  enterLair() {
    if (this.boss) return;
    this.boss = new Boss(this.world, getCycle());
    this.story.push(LAIR_INTRO);
    this.audio.sweep(90, 40, 2.2, "sawtooth", 0.22);
    this.renderer.addFlash(0.7, "#ff2a10");
  }
  onBossPhase() {
    this.story.push(NATAS_FORM2);
    this.renderer.addFlash(0.8, "#ffffff");
    this.audio.explosion();
  }
  onBossDefeated() {
    const p = this.pod;
    this.victoryRewards = [
      ["Tailored suit", 2500000],
      ["Ceremonial staff", 4000000],
      ["Laser monocle", 6000000],
      ["Satan's horns and hooves", 3000000],
      ["Salvaged robot components", 5500000],
      ["250,000 shares, Natas HI Inc.", 7500000],
      ["Cash on hand", Math.floor(p.cash)],
      ["Cargo in the hold", p.cargoValue()],
    ];
    const total = this.victoryRewards.reduce((a, [, v]) => a + v, 0);
    p.cash += 28500000;
    // One Satan's Head per kill, and it is what drives the New Game+ scaling.
    p.satanHeads = (p.satanHeads || 0) + 1;
    this.finalScore = p.score + p.cargoPoints() + total;
    this.state = "victory";
    this.audio.discovery();
    this.renderer.addFlash(1, "#ffd451");
    this.save();
  }

  // ---- vendors --------------------------------------------------------------
  openShop(vendor) {
    this.shopTab = vendor.id;
    this.state = "shop";
    this.audio.setDrill(false);
    this.audio.setThrust(0);
    this.audio.blip(520, 0.08);
    this.save();      // docking is the save point
  }
  closeShop() {
    this.state = "play";
    // Launching while still parked on the pad must not re-dock instantly.
    this.dockedVendor = this.nearVendor ? this.nearVendor.id : null;
    this.dockTimer = 0;
    this.audio.blip(320, 0.08);
    this.save();
  }

  // ---- input ----------------------------------------------------------------
  bindEvents() {
    window.addEventListener("keydown", (e) => this.onKey(e, true));
    window.addEventListener("keyup", (e) => this.onKey(e, false));
    this.canvas.addEventListener("mousemove", (e) => {
      const r = this.canvas.getBoundingClientRect();
      this.mouse.x = (e.clientX - r.left) * (VIEW_W / r.width);
      this.mouse.y = (e.clientY - r.top) * (VIEW_H / r.height);
      if (this.overlay === "options") {
        if (this.sliderDrag) optionsDrag(this, this.mouse.x);
        else optionsHover(this, this.mouse.x, this.mouse.y);
      } else if (this.overlay === "inventory") optionsHover(this, this.mouse.x, this.mouse.y);
      else if (this.state === "shop") shopHover(this, this.mouse.x, this.mouse.y);
      else if (this.state === "challengeSelect") challengeSelectHover(this, this.mouse.x, this.mouse.y);
      else if (this.state === "challengeResult") challengeResultHover(this, this.mouse.x, this.mouse.y);
      else this.updateHover();
    });
    this.canvas.addEventListener("mousedown", () => this.onClick());
    window.addEventListener("mouseup", () => { this.sliderDrag = null; });
    window.addEventListener("blur", () => {
      this.input.up = this.input.down = this.input.left = this.input.right = false;
    });
  }

  updateHover() {
    const { x, y } = this.mouse;
    this.hoverKey = null;
    if (this.state === "title" && this.titleButtons) {
      if (hit(this.titleButtons.play, x, y)) this.hoverKey = "play";
      else if (hit(this.titleButtons.fresh, x, y)) this.hoverKey = "fresh";
      else if (hit(this.titleButtons.challenge, x, y)) this.hoverKey = "challenge";
      else if (hit(this.titleButtons.options, x, y)) this.hoverKey = "options";
    } else if (this.state === "dead" && this.deathButton) {
      if (hit(this.deathButton, x, y)) this.hoverKey = "death";
    } else if (this.state === "victory" && this.victoryButton) {
      if (hit(this.victoryButton, x, y)) this.hoverKey = "victory";
    }
  }

  onClick() {
    this.audio.resume();
    const { x, y } = this.mouse;
    if (this.overlay === "options") { optionsClick(this, x, y); return; }
    if (this.overlay === "inventory") { optionsClick(this, x, y); return; }
    if (this.state === "title") {
      const b = this.titleButtons;
      if (b && hit(b.challenge, x, y)) { this.state = "challengeSelect"; this.audio.blip(700, 0.07); return; }
      if (b && hit(b.options, x, y)) { this.overlay = "options"; this.audio.blip(700, 0.07); return; }
      if (b && hit(b.fresh, x, y)) return this.startGame(true);
      return this.startGame(!this.hasSave ? true : false);
    }
    if (this.state === "challengeSelect") { challengeSelectClick(this, x, y); return; }
    if (this.state === "challengeResult") { challengeResultClick(this, x, y); return; }
    if (this.state === "shop") { shopClick(this, x, y); return; }
    if (this.state === "dead") { this.restoreSave(); return; }
    if (this.state === "victory") { this.advanceCycle(); return; }
    if (this.state === "paused" && this.pauseButtons) {
      if (hit(this.pauseButtons.options, x, y)) { this.overlay = "options"; return; }
      if (hit(this.pauseButtons.inventory, x, y)) { this.overlay = "inventory"; return; }
      if (hit(this.pauseButtons.quit, x, y)) { this.state = "title"; this.audio.blip(300, 0.1); return; }
    }
    if (this.story.busy) { this.advanceStory(); return; }
  }

  /** Victory rolls into the next New Game+ cycle. 99 of them, as documented. */
  advanceCycle() {
    this.newGamePlus = Math.min(MAX_CYCLES - 1, this.newGamePlus + 1);
    setCycle(this.newGamePlus);
    this.startGame(true);
  }

  /** The lowest challenge not yet cleared, for the SPACE shortcut. */
  nextUncleared() {
    const done = new Set(this.challengeProgress.cleared);
    for (const ch of CHALLENGES) if (!done.has(ch.n)) return ch.n;
    return 1;
  }

  advanceStory() {
    this.story.advance();
    this.audio.blip(620, 0.04, "square", 0.06);
  }

  onKey(e, down) {
    const code = e.code;
    if (KEYMAP[code]) {
      this.input[KEYMAP[code]] = down;
      if (this.state === "play" || this.state === "title") e.preventDefault();
    }
    if (!down) return;
    this.audio.resume();

    // Cheat codes are typed where letters are not movement keys: the title
    // screen, the pause screen, and the Options screen's code field.
    const codeScreen = this.overlay === "options"
      || (!this.overlay && (this.state === "title" || this.state === "paused"));
    if (codeScreen && /^Key[A-Z]$/.test(code)) {
      if (this.feedCode(code.slice(3).toLowerCase())) return;
      return;   // letters belong to the code buffer here, nothing else
    }
    if (codeScreen && /^Digit[0-9]$/.test(code)) { this.feedCode(code.slice(5)); return; }

    if (code === "Space" || code === "Enter") {
      e.preventDefault();
      if (this.overlay) return this.closeOverlay();
      if (this.state === "title") return this.startGame(this.hasSave);
      if (this.state === "dead") return this.restoreSave();
      if (this.state === "victory") return this.advanceCycle();
      if (this.state === "challengeResult") {
        const next = nextChallenge(this);
        return this.startChallenge(next || this.challengeIndex);
      }
      if (this.state === "challengeSelect") return this.startChallenge(this.nextUncleared());
      if (this.story.busy) return this.advanceStory();
      if (this.state === "shop") return this.closeShop();
    }
    if (code === "Escape") {
      if (this.overlay) return this.closeOverlay();
      // No pause, inventory or options during the boss fight, as in the original.
      if (this.state === "play" && this.inBossFight()) {
        return this.setWarning("NO PAUSE DOWN HERE. FINISH HIM.");
      }
      if (this.state === "play") this.state = "paused";
      else if (this.state === "paused") this.state = "play";
      else if (this.state === "shop") this.closeShop();
      else if (this.state === "challengeSelect") this.state = "title";
      else if (this.state === "challengeResult") this.state = "challengeSelect";
      return;
    }
    if (this.state !== "play" || this.overlay) return;

    // The two overlays. Both are locked out in the arena.
    if (code === "KeyI" || code === "KeyO") {
      if (this.inBossFight()) {
        return this.setWarning("THE INTERFACE IS JAMMED. FIGHT.");
      }
      this.overlay = code === "KeyI" ? "inventory" : "options";
      this.audio.blip(660, 0.07);
      return;
    }

    if (code === "KeyE") {
      if (this.nearVendor) this.openShop(this.nearVendor);
      return;
    }
    if (code === "KeyX") return this.useItem("dynamite");
    if (code === "KeyC") return this.useItem("plastic");
    if (code === "KeyQ") return this.useItem("teleporter");
    if (code === "KeyM") return this.useItem("transmitter");
    if (code === "KeyF") return this.useItem("reserve");
    if (code === "KeyR") return this.useItem("nanobots");
  }

  // ---- update ---------------------------------------------------------------
  /** Music follows the screen you are on and, underground, the depth band. */
  updateMusic(dt) {
    let scene;
    if (this.state === "victory") scene = "victory";
    else if (this.inBossFight()) scene = "boss";
    else if (this.state === "play" && !this.overlay) scene = sceneForDepth(this.pod.depthFt());
    else if (this.state === "shop") scene = "surface";
    else scene = "menu";
    this.music.setScene(scene);
    this.music.update(dt);
  }

  update(dt) {
    this.time += dt;
    this.blink = (this.time * 1.6) % 1;
    if (this.warningTimer > 0) this.warningTimer -= dt;
    if (this.shopMessageTimer > 0) this.shopMessageTimer -= dt;
    if (this.cheatTimer > 0) this.cheatTimer -= dt;
    if (this.saveFlashTimer > 0) this.saveFlashTimer -= dt;
    this.updateMusic(dt);
    this.story.update(dt);

    // Auto-advance a finished line so a transmission never traps the player.
    if (this.story.busy) {
      const t = this.story.active;
      const line = t.lines[this.story.lineIndex] || "";
      if (this.story.charTimer > line.length + 46) this.story.advance();
    }

    if (this.state !== "play" || this.overlay) {
      this.audio.setDrill(false);
      this.audio.setThrust(0);
      this.particles.update(dt);
      return;
    }

    const p = this.pod;
    p.update(dt, this.input, this);
    this.particles.update(dt);

    // thruster puffs + engine noise
    let thrustLevel = 0;
    if (p.thrusting.up) {
      thrustLevel = 1;
      this.particles.thrusterPuff(p.x + (Math.random() - 0.5) * 10, p.y + 18, 0, 1);
    }
    if (p.thrusting.left) { thrustLevel = Math.max(thrustLevel, 0.6); this.particles.thrusterPuff(p.x + 16, p.y, 1, 0.2); }
    if (p.thrusting.right) { thrustLevel = Math.max(thrustLevel, 0.6); this.particles.thrusterPuff(p.x - 16, p.y, -1, 0.2); }
    this.audio.setThrust(thrustLevel);
    if (!p.drill) this.audio.setDrill(false);

    // bombs
    for (let i = this.bombs.length - 1; i >= 0; i--) {
      const b = this.bombs[i];
      b.fuse -= dt;
      // let them settle onto the floor
      const c = Math.floor(b.x / TILE), r = Math.floor((b.y + 10) / TILE);
      if (!this.world.isSolid(c, r)) b.y += 240 * dt;
      if (b.fuse <= 0) {
        this.bombs.splice(i, 1);
        this.audio.explosion();
        this.explode(Math.floor(b.x / TILE), Math.floor(b.y / TILE), b.radius,
          BLAST_SELF_DAMAGE * (b.kind === "plastic" ? 1.6 : 1), "#ffb040", b.kind);
      }
    }

    // story triggers
    const depth = p.depthFt();
    this.story.checkDepth(depth, this);
    this.story.checkAltitude(p.altitudeFt(), this);

    // Martian Oilers craft: fly into it and the black angel joins you.
    const oil = this.world.oilers;
    if (oil && !oil.taken && Math.hypot(p.x - oil.x, p.y - oil.y) < 42) {
      oil.taken = true;
      this.story.tryFire(OILERS, this);
    }

    // Marsquakes start once the score passes 100,000, as Mr. Natas warns.
    if (p.score >= 100000 && depth > 200) {
      this.quakeCd = (this.quakeCd ?? 26) - dt;
      if (this.quakeCd <= 0) {
        this.quakeCd = 22 + Math.random() * 34;
        this.quakeTimer = 1.9;
        this.setWarning("MARSQUAKE");
        this.audio.noiseBurst(1.6, 320, 60, 0.4);
      }
    }
    if (this.quakeTimer > 0) {
      this.quakeTimer -= dt;
      this.renderer.addShake(7);
      p.vx += (Math.random() - 0.5) * 620 * dt;
      if (!p.onGround) p.vy += (Math.random() - 0.5) * 260 * dt;
    }

    // vendors
    this.nearVendor = this.mode === "challenge" ? null : this.world.vendorAt(p.x, p.y + 20);
    if (!this.nearVendor || this.nearVendor.id !== this.dockedVendor) this.dockedVendor = null;
    if (this.nearVendor && p.onGround && depth < 24 && !this.dockedVendor) {
      // auto-dock the moment you settle on a vendor pad
      if (Math.abs(p.vx) < 30 && Math.abs(p.vy) < 30) {
        this.dockTimer = (this.dockTimer || 0) + dt;
        if (this.dockTimer > 0.55 && !this.story.busy) {
          this.dockTimer = 0;
          this.openShop(this.nearVendor);
        }
      }
    } else {
      this.dockTimer = 0;
    }

    // the barrier gap and the arena beneath it
    if (p.inLair) this.enterLair();
    if (this.boss) this.boss.update(dt, this);

    // The Quantum Particle State Analyzer 6000 is the save point: fly into its
    // field and the run is written down.
    const inField = this.world.atAnalyzer(p.x, p.y);
    if (inField && !this.inAnalyzer) {
      this.save();
      this.saveFlashTimer = 1.8;
      this.audio.blip(1040, 0.1, "triangle", 0.13);
      setTimeout(() => this.audio.blip(1400, 0.12, "triangle", 0.1), 90);
      this.particles.floatText(p.x, p.y - 40, "GAME SAVED", "#8dffa8", 2.0);
    }
    this.inAnalyzer = inField;

    if (this.mode === "challenge" && this.challenge) {
      this.challenge.update(dt, this);
      if (this.challenge.status !== "running") this.finishChallenge();
      return;   // no autosave and no adventure bookkeeping inside a challenge
    }

    // periodic autosave while flying, so upgrades never evaporate
    this.pendingSaveTimer += dt;
    if (this.pendingSaveTimer > 12) { this.pendingSaveTimer = 0; this.save(); }
  }

  // ---- draw -----------------------------------------------------------------
  draw(dt) {
    const g = this.canvas.getContext("2d");
    if (this.state === "title") {
      drawTitle(g, this);
      if (this.overlay === "options") drawOptions(g, this);
      return;
    }
    if (this.state === "challengeSelect") {
      drawChallengeSelect(g, this);
      if (this.overlay === "options") drawOptions(g, this);
      return;
    }
    this.renderer.draw(this, dt);
    drawHUD(g, this);
    if (this.mode === "challenge" && this.challenge && this.state === "play") {
      drawChallengeHUD(g, this);
    }
    if (this.story.busy) drawTransmission(g, this);
    if (this.state === "shop") drawShop(g, this);
    if (this.state === "dead") drawDeath(g, this);
    if (this.state === "victory") drawVictory(g, this);
    if (this.state === "challengeResult") drawChallengeResult(g, this);
    if (this.state === "paused") drawPause(g, this);
    if (this.overlay === "options") drawOptions(g, this);
    else if (this.overlay === "inventory") drawInventory(g, this);
  }
}

// ---- boot -------------------------------------------------------------------
const canvas = document.getElementById("game");
const game = new Game(canvas);
window.__game = game;

let last = performance.now();
function frame(now) {
  let dt = (now - last) / 1000;
  last = now;
  if (!isFinite(dt) || dt < 0) dt = 0;
  dt = Math.min(dt, 0.05);
  try {
    game.update(dt);
    game.draw(dt);
  } catch (err) {
    console.error(err);
    throw err;
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
void GRID_W; void MAX_DIG_DEPTH_FT; void ALTIMETER_FAIL_FT; void SELLABLE; void VIEW_H;
