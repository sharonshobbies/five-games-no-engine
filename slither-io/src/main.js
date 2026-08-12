// Boot, game loop, and the glue between simulation and presentation.

import { World } from './world.js';
import { Renderer } from './render.js';
import { CameraRig } from './camera.js';
import { Input } from './input.js';
import { Hud } from './hud.js';
import { Minimap } from './minimap.js';
import { Screens } from './screens.js';
import { Audio } from './audio.js';
import { ARENA_R, BOT_COUNT, SPEED_SCALE } from './config.js';
import { rgbToCss, clamp, TAU, randRange } from './math.js';

const canvas = document.getElementById('gl');
const ui = document.getElementById('ui');

const renderer = new Renderer(canvas);
const cam = new CameraRig();
const input = new Input(canvas);
const hud = new Hud(ui);
const minimap = new Minimap(document.getElementById('minimap'));
const audio = new Audio();
const world = new World();

let playing = false;
let spectateAngle = 0;

const screens = new Screens(ui, (nick, skin) => {
  audio.ensure();
  world.startPlayer(nick, skin);
  world.fillBots();
  cam.snapTo(world.player.x, world.player.y, world.player.sc);
  playing = true;
  ui.classList.add('playing');
});

// Bots populate the arena behind the title screen, so the menu sits over a
// living game rather than an empty field.
world.fillBots();
cam.snapTo(0, 0, 1.6);

// ---------------------------------------------------------------- mute toggle
const muteBtn = document.getElementById('mute');
let muted = localStorage.getItem('slitherclone.muted') === '1';
const paintMute = () => {
  muteBtn.textContent = muted ? 'sound off' : 'sound on';
  muteBtn.classList.toggle('off', muted);
  audio.setMuted(muted);
};
muteBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  muted = !muted;
  localStorage.setItem('slitherclone.muted', muted ? '1' : '0');
  paintMute();
});
paintMute();

// ---------------------------------------------------------------- resize
function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.resize(w, h);
}
window.addEventListener('resize', resize);
resize();

// ---------------------------------------------------------------- fx particles
const particles = [];
function burst(x, y, rgb, n, spread) {
  for (let i = 0; i < n; i++) {
    if (particles.length > 900) break;
    const a = Math.random() * TAU;
    const sp = spread * (0.25 + Math.random());
    particles.push({
      x, y,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      r: 8 + Math.random() * 22,
      r0: clamp(rgb[0] * 0.6 + 0.4, 0, 1),
      g0: clamp(rgb[1] * 0.6 + 0.4, 0, 1),
      b0: clamp(rgb[2] * 0.6 + 0.4, 0, 1),
      life: 0,
      maxLife: 0.45 + Math.random() * 0.55,
    });
  }
}
function stepParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.life += dt;
    if (p.life >= p.maxLife) {
      particles.splice(i, 1);
      continue;
    }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    const d = Math.pow(0.02, dt);
    p.vx *= d;
    p.vy *= d;
  }
}

// ---------------------------------------------------------------- loop
const board = [];
const centre = [0, 0];
const nameEntries = [];
let last = performance.now();
let fpsAcc = 0;
let fpsFrames = 0;
let fps = 60;
let perfAcc = 0;
let simMs = 0;
let logAcc = 0;
let loggedOnce = false;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  if (!(dt > 0)) dt = 1 / 60;
  dt = Math.min(dt, 1 / 20); // a tab-switch must not teleport anybody

  // ---- simulate
  const t0 = performance.now();
  const player = world.player;
  let intent = null;
  if (playing && player && player.alive) {
    centre[0] = cam.x;
    centre[1] = cam.y;
    intent = input.read(cam.x, cam.y, cam.zoom, window.innerWidth, window.innerHeight, player);
  }
  world.update(dt, intent);
  simMs = simMs * 0.9 + (performance.now() - t0) * 0.1;

  // ---- consume events
  for (const e of world.events) {
    if (e.type === 'eat') {
      audio.eat(e.big);
    } else if (e.type === 'death') {
      audio.death(e.isPlayer);
      if (!e.byWall) burst(e.x, e.y, e.rgb, e.isPlayer ? 90 : 26, 420);
      if (e.isPlayer) {
        cam.kick(1.3);
        playing = false;
        ui.classList.remove('playing');
        // The player is already off the board by now, so the rank is "how many
        // living snakes outscored me", counted directly.
        let ahead = 0;
        for (const s of world.snakes) if (s.alive && s.mass > e.score) ahead++;
        screens.showDeath({
          score: e.score,
          rank: ahead + 1,
          kills: player.kills,
          byWall: e.byWall,
          killerName: e.killerName,
        });
      } else if (e.killedByPlayer) {
        audio.kill();
        cam.kick(0.5);
        hud.pushFeed(`you killed <b>${escapeHtml(e.name)}</b> &nbsp;+${e.orbs} orbs`, rgbToCss(e.rgb));
      } else if (world.player && world.player.alive) {
        const d = Math.hypot(e.x - world.player.x, e.y - world.player.y);
        if (d < 2600) {
          hud.pushFeed(
            e.byWall
              ? `<b>${escapeHtml(e.name)}</b> hit the wall`
              : `<b>${escapeHtml(e.name)}</b> died &nbsp;${e.score.toLocaleString()}`,
            rgbToCss(e.rgb),
          );
        }
      }
    }
  }
  stepParticles(dt);

  // ---- camera
  if (playing && player && player.alive) {
    cam.update(dt, player.x, player.y, player.sc, player.boosting);
    // The divisor is a speed, so it carries SPEED_SCALE: the sprint hiss keeps
    // the exact intensity curve it had before the arena slowed down.
    audio.boost(player.boosting, clamp(player.speed / (12 * SPEED_SCALE), 0.6, 1.4));
  } else {
    // Spectator drift: orbit the leader so the menu has something to watch.
    world.leaderboard(board);
    const star = board[0];
    audio.boost(false);
    spectateAngle += dt * 0.12;
    if (star) {
      cam.update(dt, star.x, star.y, Math.max(star.sc, 2.0), false);
    } else {
      cam.update(dt, Math.cos(spectateAngle) * ARENA_R * 0.4, Math.sin(spectateAngle) * ARENA_R * 0.4, 2.4, false);
    }
  }

  // ---- render
  cam.centre(centre);
  renderer.setView(centre[0], centre[1], cam.zoom);
  renderer.beginFrame(world.time);
  renderer.drawFood(world.food, world.time);
  renderer.drawPrey(world.prey, world.time);

  nameEntries.length = 0;
  const w2 = window.innerWidth / 2;
  const h2 = window.innerHeight / 2;
  for (const s of world.snakes) {
    if (!s.alive) continue;
    renderer.drawSnake(s, world.time, s.isPlayer);
    // Nickname label, only for heads actually on screen.
    if (renderer.visible(s.x, s.y, 0)) {
      const sx = w2 + (s.x - centre[0]) * cam.zoom;
      const sy = h2 - (s.y - centre[1]) * cam.zoom - (s.radius * cam.zoom + 14);
      nameEntries.push({
        name: s.name,
        sx,
        sy,
        alpha: s.isPlayer ? 0.95 : 0.62,
        size: clamp(11 + s.sc * 1.7, 11, 22),
        colour: s.isPlayer ? '#ffffff' : 'rgba(215,228,255,0.85)',
      });
    }
  }
  renderer.drawSparks(particles);
  renderer.endFrame();

  // ---- ui
  world.leaderboard(board);
  hud.updateBoard(board, world.player && world.player.alive ? world.player : null);
  hud.updateStats(
    world.player && world.player.alive ? world.player : null,
    world.player && world.player.alive ? world.rankOf(world.player, board) : 0,
    board.length,
  );
  hud.updateNames(nameEntries);
  hud.tickFeed(dt);
  minimap.update(dt, world, world.player && world.player.alive ? world.player : null);

  // ---- perf
  fpsAcc += dt;
  fpsFrames++;
  if (fpsAcc >= 0.4) {
    fps = fpsFrames / fpsAcc;
    fpsAcc = 0;
    fpsFrames = 0;
  }
  perfAcc += dt;
  if (perfAcc > 0.25) {
    perfAcc = 0;
    hud.updatePerf(
      `${fps.toFixed(0)} fps · sim ${simMs.toFixed(1)}ms · ${world.aliveCount()} snakes · ` +
      `${world.food.count} orbs · ${renderer.stats.drawn.toLocaleString()} sprites · ` +
      `${world.collisionNodes.toLocaleString()} hit nodes`,
    );
  }
  logAcc += dt;
  if (logAcc > 5) {
    logAcc = 0;
    console.log(
      `[perf] ${fps.toFixed(1)} fps | sim ${simMs.toFixed(2)}ms | snakes ${world.aliveCount()}` +
      ` | orbs ${world.food.count} | collision nodes ${world.collisionNodes}` +
      ` | sprite instances ${renderer.stats.drawn} | particles ${particles.length}`,
    );
  }
  if (!loggedOnce) {
    loggedOnce = true;
    console.log(
      `[slither] arena radius ${ARENA_R}, ${BOT_COUNT} bots + player, ` +
      `${world.food.count} food orbs seeded, ${world.prey.items.length} prey`,
    );
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

requestAnimationFrame(frame);

// Expose a tiny handle for debugging and for the verification harness.
window.__slither = { world, renderer, cam, stats: () => renderer.stats };
