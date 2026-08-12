// Game orchestration: state machine, the day/night chase, scoring, island transitions,
// palette blending, and wiring bird events to feedback.

import * as THREE from '../vendor/three.module.min.js';
import { Terrain, GAP } from './terrain.js';
import { Bird, BIRD_R } from './physics.js';
import { FollowCam } from './camera.js';
import { Sky } from './sky.js';
import { TerrainMesh } from './terrainMesh.js';
import { BirdView } from './birdView.js';
import { MotionBlur } from './motionBlur.js';
import { Dressing } from './dressing.js';
import { Race, RACE_METRES } from './race.js';
import { RaceView } from './raceView.js';
import { Particles } from './particles.js';
import { Pickups } from './pickups.js';
import { Hud } from './hud.js';
import { Audio } from './audio.js';
import { Progress } from './progress.js';
import { buildDayPalettes, gradePalette } from './palette.js';
import { clamp, lerp } from './rng.js';

const SUBSTEP = 1 / 300;
const NIGHT_SPEED0 = 108;         // world units/s the wall of night advances at the start
const NIGHT_RAMP = 1.05;          // + per second of run time
const NIGHT_SPEED_MAX = 420;
const NIGHT_HEADSTART = 1250;     // how far behind you it begins
// Daylight won back for reaching a new island — flat, not growing with the island
// index. A long run already compounds (more islands => more pushback => more islands),
// and once landings stopped pinballing the bird to a halt that compounding stretched a
// skilled run half again as far as the balance the probe was set against.
const ISLAND_PUSHBACK = 980;
const NIGHT_FEEL = 1600;          // distance over which the sky reads "night is close"

export class Game {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new THREE.Scene();

    // A "day seed" so the world and its palettes differ day to day, exactly like the
    // original's daily procedural re-roll.
    const now = new Date();
    const qseed = new URLSearchParams(location.search).get('seed');
    this.daySeed = (qseed ? parseInt(qseed, 10)
      : now.getFullYear() * 10000 + (now.getMonth() + 1) * 100 + now.getDate()) >>> 0;
    this.palettes = buildDayPalettes(this.daySeed, 40);

    this.terrain = new Terrain(this.daySeed ^ 0x2f6a1b3d);
    this.bird = new Bird(this.terrain);
    this.startX = this.bird.x;

    this.cam = new FollowCam(16 / 9);
    this.sky = new Sky();
    this.hills = new TerrainMesh(this.terrain);
    this.birdView = new BirdView();
    this.blur = new MotionBlur();
    this.dressing = new Dressing(this.terrain, this.daySeed);
    this.race = new Race(this.terrain);
    this.raceView = new RaceView(this.terrain);
    this.particles = new Particles();
    this.pickups = new Pickups(this.terrain);
    this.hud = new Hud();
    this.audio = new Audio();
    this.progress = new Progress();

    this.scene.add(this.sky.mesh);
    this.scene.add(this.dressing.group);
    this.scene.add(this.hills.mesh);
    for (const o of this.pickups.objects) this.scene.add(o);
    this.scene.add(this.raceView.group);
    for (const o of this.blur.objects) this.scene.add(o);
    this.scene.add(this.birdView.group);
    for (const o of this.particles.objects) this.scene.add(o);

    // Dev switches, for inspecting states a few seconds of play cannot reach:
    //   ?skip=N   start on island N        ?dark=0.7  force the sunset grade
    //   ?fever=1  start in fever           ?autoplay=1 let a simple bot fly it
    //   ?seed=N   pick a different "day"
    const q = new URLSearchParams(location.search);
    this.dbg = {
      skip: parseFloat(q.get('skip') || '0') || 0,
      catchSoon: q.get('catch') === '1',
      endAt: q.has('end') ? parseFloat(q.get('end')) : null,
      dark: q.has('dark') ? parseFloat(q.get('dark')) : null,
      fever: q.get('fever') === '1',
      autoplay: q.get('autoplay') === '1',
      race: q.get('race') === '1',
      course: parseFloat(q.get('course') || '0') || 0,   // shorter race, for screenshots
    };

    this.state = 'title';
    this.time = 0;
    this.held = false;
    // Three modes off the title screen. "Night Trip" pins the grade to a starry night
    // for the whole trip; "Race" swaps the night chase for three AI birds and a finish
    // line 600 m out. The bird physics is identical in all three.
    this.mode = this.dbg.race ? 'race' : 'day';
    this.nightMode = false;
    this.hud.onMode = (mode) => {
      this.mode = mode;
      this.nightMode = mode === 'night';
    };
    this.gradedA = gradePalette(this.palettes[0], 0);
    this.gradedB = gradePalette(this.palettes[1], 0);
    this._resetRun();
    this.cam.xBiasFrac = 0.10;      // title framing: nest and sleeping bird, card-clear
    this.cam.snap(this.bird);
    this.hud.showTitle(this.progress);
  }

  _resetRun() {
    this.bird.reset(this.terrain.startX());
    this.startX = this.bird.x;
    this.pickups.reset();
    this.elapsed = 0;
    this.nightX = this.bird.x - NIGHT_HEADSTART;
    this.darkness = 0;
    this.feverVis = 0;
    this.lastIsland = 0;
    this.trailTimer = 0;
    this.feverWas = false;
    this.blur.reset(this.bird);
    this.birdView.setAsleep(this.state !== 'playing');
    this.racing = false;
    this.raceView.setActive(false);
    this.run = {
      distance: 0, score: 0, islands: 1, slides: 0, fevers: 0,
      coins: 0, clouds: 0, topSpeed: 0, maxChain: 0,
    };
  }

  // ---------------------------------------------------------------- input
  press() {
    this.audio.ensure();
    if (this.state === 'title') { this.start(); return; }
    if (this.state === 'over') { if (this.time - this.overAt > 0.55) this.start(); return; }
    this.held = true;
    this.bird.diving = true;
  }

  release() {
    this.held = false;
    this.bird.diving = false;
  }

  start() {
    this._resetRun();

    if (this.dbg.skip > 0) {
      // integer part = island index, fraction = how far along it to start
      const idx = Math.floor(this.dbg.skip);
      const frac = Math.max(0.10, this.dbg.skip - idx);
      const is = this.terrain.island(idx);
      const x = this.terrain.findCrest(is.x0 + is.L * frac, 900);
      this.bird.reset(x);
      this.nightX = x - NIGHT_HEADSTART;
      this.lastIsland = idx;
      this.run.islands = idx + 1;
      this.audio.setChord(idx);
    }
    if (this.dbg.catchSoon) this.nightX = this.bird.x - 260;
    if (this.dbg.fever) { this.bird.chain = 3; this.bird.fever = true; this.feverWas = true; }

    // --- race mode: three rivals off the same line, no night, a finish line 600 m out ---
    this.racing = this.mode === 'race';
    if (this.racing) {
      // A fresh race seed each time, so two races on the same day are different races.
      this.race.reset(this.bird.x, (Math.random() * 0xffffffff) >>> 0,
        this.dbg.course || RACE_METRES);
      this.raceView.setActive(true);
      this.raceView.placeFinish(this.race.finishX);
      this.nightX = this.bird.x - 1e6;    // the chase is off; the finish line is the clock
    }

    this.cam.xBiasFrac = 0;         // gameplay framing is untouched by the title bias
    this.cam.snap(this.bird);
    this.state = 'playing';
    this.birdView.setAsleep(false);
    this.blur.reset(this.bird);
    this.hud.startRun(this.racing);
    if (this.racing) this.hud.banner(1, `${this.race.metres} m Race`, 'Go!', 'THREE RIVALS');
    else this.hud.banner(this.run.islands, this.palettes[this.run.islands - 1].name, 'Go!');
    // a nudge so the run starts moving without waiting on gravity alone
    this.bird.vx = 160;
    this.bird.vy = 0;
  }

  /** Dev bot for ?autoplay=1: dive down the slope, release on the way up. */
  _autopilot() {
    const b = this.bird, t = this.terrain;
    if (b.grounded) { b.diving = t.slope(b.x + 4) < -0.02; return; }
    let x = b.x, y = b.y, vy = b.vy;
    for (let i = 0; i < 70; i++) {
      x += b.vx / 70; vy -= 620 / 70; y += vy / 70;
      if (y <= t.height(x) + BIRD_R) break;
    }
    b.diving = t.slope(x) < -0.05 && vy < 0;
  }

  // ---------------------------------------------------------------- helpers
  worldToFrac(x, y) {
    const c = this.cam;
    return {
      x: (x - c.x) / c.viewW + 0.5,
      y: 0.5 - (y - c.y) / c.viewH,
    };
  }

  get multiplier() {
    return this.progress.multiplier * (this.bird.fever ? 2 : 1);
  }

  award(points, label, x, y, cls = '') {
    const total = points * this.multiplier;
    this.run.score += total;
    if (label) {
      const f = this.worldToFrac(x, y);
      this.hud.pop(label, cls, f.x, f.y);
    }
    return total;
  }

  // ---------------------------------------------------------------- update
  update(dt) {
    this.time += dt;
    dt = Math.min(dt, 1 / 25);

    if (this.state === 'playing') {
      this._simulate(dt);
    } else {
      // Keep the bird falling for a beat after the run ends so it settles onto the hill
      // instead of freezing mid-air.
      if (this.state === 'over' && this.time - this.overAt < 2.5) {
        this.bird.diving = false;
        let acc = dt;
        while (acc > 0) { const h = Math.min(SUBSTEP, acc); this.bird.step(h); acc -= h; }
        this.bird.events.length = 0;
      }
      this.particles.update(dt);
    }

    this._updateVisuals(dt);
  }

  _simulate(dt) {
    const bird = this.bird;
    this.elapsed += dt;
    if (this.dbg.autoplay) this._autopilot();

    // fixed-step physics for a slide that never jitters
    let acc = dt;
    while (acc > 0) {
      const h = Math.min(SUBSTEP, acc);
      bird.step(h);
      acc -= h;
    }

    // --- the rivals run on the same terrain, stepped the same way ---
    if (this.racing) {
      const done = this.race.update(dt, bird);
      if (done) { this._raceOver(); return; }
    } else {
      // --- night advances, islands push it back ---
      const nightSpeed = Math.min(NIGHT_SPEED_MAX, NIGHT_SPEED0 + this.elapsed * NIGHT_RAMP);
      this.nightX += nightSpeed * dt;
    }

    const island = this.terrain.islandIndexAt(bird.x);
    if (island > this.lastIsland) {
      this.nightX -= ISLAND_PUSHBACK;
      this.lastIsland = island;
      this.run.islands = island + 1;
      const p = this.palettes[island % this.palettes.length];
      if (!this.racing) {
        this.hud.banner(island + 1, p.name, '+ daylight');
        this.award(50, `ISLAND ${island + 1}`, bird.x, bird.y + 40, 'small');
      }
      this.audio.island();
      this.audio.setChord(island);
      this.cam.kick(0.25);
      this.particles.burst(bird.x, bird.y, 16, [1, 0.95, 0.6], 260);
    }

    // --- stats ---
    this.run.distance = Math.max(this.run.distance, (bird.x - this.startX) / 10);
    this.run.topSpeed = Math.max(this.run.topSpeed, bird.speed);
    this.run.maxChain = Math.max(this.run.maxChain, bird.chain);

    // --- pickups ---
    const got = this.pickups.update(dt, bird, this.cam.x, this.cam.viewW, this.particles, this.gradedA);
    if (got.coins) {
      this.run.coins += got.coins;
      const pts = this.award(3 * got.coins, null);
      this.audio.coin();
      if (got.coins > 1) {
        const f = this.worldToFrac(bird.x, bird.y + 14);
        this.hud.pop(`+${pts}`, 'small', f.x, f.y);
      }
    }
    if (got.clouds) {
      this.run.clouds += got.clouds;
      this.award(20 * got.clouds, 'CLOUD!', bird.x, bird.y + 16, 'small');
      this.audio.cloud();
    }

    // --- bird events ---
    for (const e of bird.events) this._onEvent(e);
    bird.events.length = 0;

    // --- speed trail ---
    this.trailTimer -= dt;
    const fast = bird.speed > 520;
    if ((fast || bird.fever) && this.trailTimer <= 0) {
      this.trailTimer = bird.speed > 800 ? 0.010 : 0.022;
      const back = -Math.cos(bird.angle), up = -Math.sin(bird.angle);
      const px = bird.x + back * BIRD_R * 1.4 + (Math.random() - 0.5) * 4;
      const py = bird.y + up * BIRD_R * 1.4 + (Math.random() - 0.5) * 4;
      if (bird.fever) {
        this.particles.emit(1, px, py, -bird.vx * 0.10, -bird.vy * 0.10 + 20,
          6 + Math.random() * 7, 0.42 + Math.random() * 0.3,
          [1.0, 0.86, 0.42], 0, 2.2, (Math.random() - 0.5) * 9);
      } else {
        this.particles.emit(0, px, py, -bird.vx * 0.07, -bird.vy * 0.07,
          3 + Math.random() * 3.5, 0.30, [1, 1, 1], 0, 3.0);
      }
    }

    // --- water skim spray ---
    if (bird.inWater && bird.speed > 90 && Math.random() < 0.6) {
      this.particles.splash(bird.x, 1, clamp(bird.speed / 700, 0.2, 1));
    }

    // --- has night caught us? ---
    if (this.dbg.endAt !== null && this.elapsed > this.dbg.endAt) this._gameOver();
    if (!this.racing && this.nightX >= bird.x - BIRD_R) this._gameOver();
  }

  _onEvent(e) {
    const bird = this.bird;
    switch (e.type) {
      case 'land': {
        if (e.bounce) {
          this.particles.dust(e.x, e.y - BIRD_R * 0.6, clamp(e.impact / 420, 0.3, 1.4));
          this.audio.bounce(e.impact);
          this.birdView.hit(clamp(e.impact / 900, 0.05, 0.4));
          this.cam.kick(clamp(e.impact / 1600, 0.03, 0.35));
        } else {
          this.particles.dust(e.x, e.y - BIRD_R * 0.6, clamp(e.speed / 900, 0.2, 0.8));
          this.audio.land(e.impact, e.quality);
          this.birdView.hit(clamp(e.impact / 1400, 0.02, 0.2));
        }
        break;
      }
      case 'launch': {
        this.audio.launch(e.speed);
        this.particles.dust(e.x, e.y - BIRD_R * 0.7, clamp(e.speed / 800, 0.2, 1.0));
        if (e.speed > 600) this.cam.kick(0.10);
        break;
      }
      case 'greatSlide': {
        this.run.slides++;
        const wasFever = this.feverWas === true;
        const pts = this.award(10, null);
        const f = this.worldToFrac(e.x, e.y + 26);
        if (bird.fever && !wasFever) {
          this.run.fevers++;
          this.hud.pop('FEVER!', 'big', f.x, f.y);
          this.hud.pop(`+${pts}`, 'small', f.x, Math.min(0.8, f.y + 0.09));
          this.audio.fever();
          this.particles.burst(e.x, e.y, 34, [1.0, 0.85, 0.35], 420);
          this.cam.kick(0.5);
        } else {
          this.hud.pop(`GREAT SLIDE  +${pts}`, bird.fever ? '' : 'small', f.x, f.y);
          this.audio.greatSlide(bird.chain);
          this.particles.burst(e.x, e.y, bird.fever ? 18 : 11, [1.0, 0.92, 0.55], 260);
        }
        this.feverWas = bird.fever;
        break;
      }
      case 'feverEnd': {
        this.feverWas = false;
        const f = this.worldToFrac(bird.x, bird.y + 20);
        this.hud.pop('fever lost', 'small', f.x, f.y);
        break;
      }
      case 'splash': {
        this.particles.splash(e.x, 1, clamp(e.speed / 600, 0.3, 1.2));
        this.audio.splash(clamp(e.speed / 700, 0.2, 1));
        this.cam.kick(0.16);
        break;
      }
    }
  }

  _gameOver() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.overAt = this.time;
    this.release();
    this.hud.rush(0, false);
    this.audio.gameOver();
    // shift the framing so the bird settling down to sleep is not behind the card
    this.cam.xBiasFrac = 0.12;
    const res = this.progress.finishRun({ ...this.run, distance: this.run.distance });
    this.hud.showEnd(this.run, this.progress, res);
  }

  /**
   * The player crossed the finish line. The standings are read at that moment, so a
   * rival still out on the course is listed by how far it has left to run.
   */
  _raceOver() {
    if (this.state !== 'playing') return;
    this.state = 'over';
    this.overAt = this.time;
    this.release();
    this.hud.rush(0, false);
    this.cam.xBiasFrac = 0.12;      // keep the bird and the banner clear of the card
    const rows = this.race.standings(this.bird);
    const won = rows.find((r) => r.you).place === 1;
    if (won) {
      this.audio.fever();
      this.particles.burst(this.bird.x, this.bird.y, 40, [1.0, 0.9, 0.45], 460);
      this.cam.kick(0.5);
    } else {
      this.audio.gameOver();
    }
    // A race is its own thing: it leaves the nest, the missions and the best distance
    // to the Day Trip.
    this.hud.showRaceEnd(this.run, rows, this.race.metres);
  }

  // ---------------------------------------------------------------- visuals
  _updateVisuals(dt) {
    const bird = this.bird;
    const cam = this.cam;

    if (this.state === 'playing' || this.state === 'over') {
      cam.update(dt, bird, this.terrain);
    } else {
      // title: slow drift so the scene breathes
      cam.update(dt, bird, this.terrain);
    }

    this.birdView.update(dt, bird);
    this.particles.update(dt);

    // ---- the sleep beat ----
    // The trip opens on the bird dozing by the nest and closes the same way: once the
    // sun has set and it has settled onto the hill, it tucks in and the z's start. A
    // race ends at a finish line, not at sunset, so nobody falls asleep.
    const asleep = this.state === 'title'
      || (this.state === 'over' && !this.racing && this.time - this.overAt > 1.6);
    this.birdView.setAsleep(asleep);

    // ---- darkness: time-of-day plus how close night is behind you ----
    const closeness = clamp(1 - (bird.x - this.nightX) / NIGHT_FEEL, 0, 1);
    const byTime = clamp(this.elapsed / 190, 0, 1) * 0.42;
    const chase = clamp((closeness - 0.30) / 0.70, 0, 1);
    let target = this.state === 'title' ? 0 : clamp(byTime + chase * chase * 0.92, 0, 1);
    if (this.racing) target = Math.min(target, 0.10);   // a race runs in full daylight
    if (this.nightMode) target = Math.max(target, 0.88);
    if (this.dbg.dark !== null) target = this.dbg.dark;
    this.darkness = lerp(this.darkness, target, Math.min(1, dt * 1.6));

    this.feverVis = lerp(this.feverVis, bird.fever ? 1 : 0, Math.min(1, dt * 4));

    // ---- palette blend across the nearest island boundary ----
    const iCur = this.terrain.islandIndexAt(bird.x);
    const bx = (i) => this.terrain.island(i).x1 + GAP * 0.5;
    let bi = iCur;
    if (iCur > 0 && Math.abs(bx(iCur - 1) - cam.x) < Math.abs(bx(iCur) - cam.x)) bi = iCur - 1;
    const blendX = bx(bi);
    const pa = this.palettes[bi % this.palettes.length];
    const pb = this.palettes[(bi + 1) % this.palettes.length];
    this.gradedA = gradePalette(pa, this.darkness);
    this.gradedB = gradePalette(pb, this.darkness);
    const A = this.gradedA, B = this.gradedB;

    const su = this.sky.uniforms;
    su.uCam.value.set(cam.x, cam.y);
    su.uView.value.set(cam.viewW, cam.viewH);
    su.uTime.value = this.time;
    su.uDark.value = this.darkness;
    su.uNightX.value = this.state === 'title' ? -1e6 : this.nightX;
    su.uFever.value = this.feverVis;
    su.uBlendX.value = blendX;
    su.uBlendW.value = GAP * 1.1;
    const set = (u, c) => u.value.setRGB(c[0], c[1], c[2]);
    set(su.uSkyTopA, A.sky[0]); set(su.uSkyTopB, B.sky[0]);
    set(su.uSkyBotA, A.sky[1]); set(su.uSkyBotB, B.sky[1]);
    set(su.uHillDarkA, A.hills[0]); set(su.uHillDarkB, B.hills[0]);
    set(su.uHillLightA, A.hills[1]); set(su.uHillLightB, B.hills[1]);
    set(su.uRimA, A.hills[2]); set(su.uRimB, B.hills[2]);
    set(su.uWaterA, A.water[0]); set(su.uWaterB, B.water[0]);
    set(su.uFoamA, A.water[1]); set(su.uFoamB, B.water[1]);
    set(su.uSunA, A.sun); set(su.uSunB, B.sun);
    set(su.uCloudA, A.cloud); set(su.uCloudB, B.cloud);

    const hu = this.hills.uniforms;
    set(hu.uDarkA, A.hills[0]); set(hu.uDarkB, B.hills[0]);
    set(hu.uLightA, A.hills[1]); set(hu.uLightB, B.hills[1]);
    set(hu.uRimA, A.hills[2]); set(hu.uRimB, B.hills[2]);
    hu.uBlendX.value = blendX;
    hu.uBlendW.value = GAP * 1.1;
    hu.uDark.value = this.darkness;
    hu.uFever.value = this.feverVis;
    hu.uTime.value = this.time;
    hu.uNightX.value = su.uNightX.value;
    this.hills.update(cam.x, cam.y, cam.viewW, cam.viewH);


    // gl_PointSize is in framebuffer pixels, and canvas.height already includes DPR
    const pxPerUnit = this.renderer.domElement.height / cam.viewH;
    const dim = lerp(1, 0.62, this.darkness);
    const birdDim = lerp(1, 0.68, this.darkness);
    this.particles.render(pxPerUnit, dim);
    this.pickups.setPxPerUnit(pxPerUnit, dim);
    this.birdView.setDim(birdDim);

    // ---- directional smear, world dressing, rivals ----
    this.blur.update(dt, bird, birdDim);
    this.dressing.update(
      dt, cam.x, cam.y, cam.viewW, cam.viewH, birdDim,
      asleep ? { x: bird.x, y: bird.y } : null,
      this.particles,
    );
    if (this.raceView.group.visible) this.raceView.update(dt, this.race, birdDim);

    if (this.state === 'playing') {
      const nightFrac = closeness;
      this.hud.rush(clamp((bird.speed - 560) / 620, 0, 1) * 0.85, bird.fever);
      this.hud.update(this.run, bird, nightFrac);
      if (this.racing) this.hud.raceUpdate(this.race.standings(bird));
      this.audio.setMotion(bird.speed, bird.grounded, this.darkness);
    }
  }

  resize(w, h) {
    this.cam.setAspect(w / h);
  }

  render() {
    this.renderer.render(this.scene, this.cam.cam);
  }
}
