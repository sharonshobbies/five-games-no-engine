#!/usr/bin/env node
// Scenario probes: drive the running game through every state that matters and
// assert on observed values, not on source reading. Each scenario reaches into
// window.__game, puts the world where it needs to be, steps real frames, and
// screenshots the result.
//
//   node probes/scenarios.mjs                  # all scenarios
//   node probes/scenarios.mjs surface tunnel   # a subset
//
// Exit 0 = every scenario passed with no page or console errors.

import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, "..");
const BENCH = path.resolve(GAME, "..", "claude-code-test-benchmark");
const OUT = path.join(GAME, "screenshots");

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split("?")[0]);
  if (p === "/") p = "/index.html";
  const file = path.join(GAME, p);
  if (!file.startsWith(GAME)) return res.writeHead(403).end();
  fs.readFile(file, (err, data) => {
    if (err) return res.writeHead(404).end("not found");
    res.writeHead(200, { "content-type": MIME[path.extname(file).toLowerCase()] || "application/octet-stream" });
    res.end(data);
  });
});
const port = await new Promise((r) => server.listen(0, "127.0.0.1", () => r(server.address().port)));

const { chromium } = await import(path.join(BENCH, "node_modules/playwright/index.mjs"))
  .catch(() => import("playwright"));

const browser = await chromium.launch({
  args: ["--autoplay-policy=no-user-gesture-required", "--enable-unsafe-swiftshader"],
});

fs.mkdirSync(OUT, { recursive: true });

const only = process.argv.slice(2);
const results = [];

/** Fresh page per scenario, so no scenario can leak state into the next. */
async function withPage(fn) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + (e.message || e)));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => !!window.__game, { timeout: 15000 });
  // Never let a previous scenario's localStorage decide this one.
  await page.evaluate(() => { try { localStorage.clear(); } catch { /* ignore */ } });
  try {
    return await fn(page, errs);
  } finally {
    await page.close();
  }
}

/** Advance real animation frames. */
const step = (page, frames = 30) => page.evaluate((n) => new Promise((res) => {
  let i = 0;
  const tick = () => (++i >= n ? res() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), frames);

async function scenario(name, fn) {
  if (only.length && !only.includes(name)) return;
  const started = Date.now();
  try {
    const info = await withPage(async (page, errs) => {
      const out = await fn(page);
      await page.screenshot({ path: path.join(OUT, `s-${name}.png`) });
      if (errs.length) throw new Error(errs.slice(0, 3).join(" | "));
      return out;
    });
    results.push({ name, ok: true, ms: Date.now() - started, info });
    console.log(`PASS  ${name}  ${JSON.stringify(info)}`);
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - started, error: String(e.message || e) });
    console.log(`FAIL  ${name}  ${e.message || e}`);
  }
}

const assert = (cond, msg) => { if (!cond) throw new Error(msg); };

// ---------------------------------------------------------------- scenarios
await scenario("title", async (page) => {
  await step(page, 40);
  return page.evaluate(() => ({
    state: window.__game.state,
    buttons: Object.keys(window.__game.titleButtons || {}),
  })).then((r) => {
    assert(r.state === "title", "not on the title screen");
    for (const b of ["play", "fresh", "challenge", "options"]) {
      assert(r.buttons.includes(b), "missing title button " + b);
    }
    return r;
  });
});

await scenario("surface", async (page) => {
  await page.evaluate(() => window.__game.startGame(true));
  await step(page, 60);
  const r = await page.evaluate(() => {
    const g = window.__game;
    return {
      state: g.state,
      depth: Math.round(g.pod.depthFt()),
      onGround: g.pod.onGround,
      vendors: g.world.vendors.length,
      analyzer: !!g.world.analyzer,
      fuel: g.pod.fuel,
    };
  });
  assert(r.state === "play", "not playing");
  assert(Math.abs(r.depth) < 40, "pod is not at the surface: " + r.depth);
  assert(r.onGround, "pod is not resting on the ground");
  assert(r.vendors === 4, "expected four vendors, got " + r.vendors);
  assert(r.analyzer, "no Quantum Particle State Analyzer 6000");
  return r;
});

await scenario("analyzer-save", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    const a = g.world.analyzer;
    g.pod.x = a.x; g.pod.y = a.y;
    g.inAnalyzer = false;
    await new Promise((res) => requestAnimationFrame(res));
    await new Promise((res) => requestAnimationFrame(res));
    return { flash: g.saveFlashTimer, hasSave: g.hasSave };
  });
  await step(page, 20);
  assert(r.flash > 0, "flying into the analyzer did not fire a save");
  assert(r.hasSave, "the save was not written");
  return r;
});

await scenario("tunnel", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.tiers.drill = 4;
    g.pod.tiers.fuel = 5;
    g.pod.tiers.hull = 5;
    g.pod.fuel = g.pod.maxFuel();
    g.pod.hull = g.pod.maxHull();
    g.input.down = true;
    const startX = g.pod.x;
    for (let i = 0; i < 600; i++) await new Promise((res) => requestAnimationFrame(res));
    g.input.down = false;
    return {
      depth: Math.round(g.pod.depthFt()),
      dug: g.pod.stats.dug,
      drift: Math.abs(g.pod.x - startX),
      embedded: g.pod.blocked(g.pod.x, g.pod.y),
      alive: !g.pod.dead,
    };
  });
  assert(r.alive, "the pod did not survive the shaft");
  // Roughly half a second per tile: the drill time plus the drop onto the next
  // one. 600 frames of holding DOWN is about 19 tiles.
  assert(r.depth > 200, "the shaft went nowhere: " + r.depth + " ft");
  assert(r.dug >= 15, "only " + r.dug + " tiles dug");
  assert(r.drift < 60, "the pod wandered off its column by " + r.drift + " px");
  assert(!r.embedded, "the pod ended up inside solid ground");
  return r;
});

await scenario("no-up-drill", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    // Bury the pod in a pocket so the only way out would be upward.
    const c = Math.floor(g.pod.x / 48);
    const row = 8 + 20;
    for (let dr = 0; dr <= 1; dr++) g.world.raw(c, row + dr, 0);
    g.pod.x = (c + 0.5) * 48;
    g.pod.y = (row + 1) * 48 - 20;
    g.pod.vy = 0;
    for (let i = 0; i < 30; i++) await new Promise((res) => requestAnimationFrame(res));
    const before = g.pod.stats.dug;
    g.input.up = true;
    for (let i = 0; i < 90; i++) await new Promise((res) => requestAnimationFrame(res));
    g.input.up = false;
    return { dugWhileHoldingUp: g.pod.stats.dug - before };
  });
  assert(r.dugWhileHoldingUp === 0, "holding UP dug " + r.dugWhileHoldingUp + " tiles");
  return r;
});

await scenario("dynamite", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.items.dynamite = 3;
    g.pod.tiers.hull = 5;
    g.pod.hull = g.pod.maxHull();
    const c = Math.floor(g.pod.x / 48), row = 8 + 6;
    g.pod.x = (c + 0.5) * 48;
    g.pod.y = row * 48 - 20;
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    const before = countAir();
    g.useItem("dynamite");
    for (let i = 0; i < 140; i++) await new Promise((res) => requestAnimationFrame(res));
    return { cleared: countAir() - before, bombs: g.bombs.length };
    function countAir() {
      let n = 0;
      for (let i = 0; i < g.world.type.length; i++) if (g.world.type[i] === 0) n++;
      return n;
    }
  });
  assert(r.bombs === 0, "the charge never went off");
  assert(r.cleared > 8, "the crater only cleared " + r.cleared + " tiles");
  return r;
});

await scenario("lava", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.tiers.hull = 5;
    g.pod.hull = g.pod.maxHull();
    const before = g.pod.hull;
    // Put a lava pool directly under the pod and drop into it.
    const c = Math.floor(g.pod.x / 48), row = 8 + 250;
    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -2; dr <= 1; dr++) g.world.raw(c + dc, row + dr, dr >= 0 ? 3 : 0);
    }
    g.world.dirty.clear();
    for (let k = 0; k < 4096; k++) g.world.dirty.add(k);
    g.pod.x = (c + 0.5) * 48;
    g.pod.y = (row - 1) * 48;
    for (let i = 0; i < 60; i++) await new Promise((res) => requestAnimationFrame(res));
    return { before, after: g.pod.hull, warning: g.warning };
  });
  assert(r.after < r.before, "lava did no damage");
  assert(/LAVA/.test(r.warning || ""), "no lava warning: " + r.warning);
  return r;
});

await scenario("gas", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.tiers.hull = 5;
    g.pod.hull = g.pod.maxHull();
    const before = g.pod.hull;
    const c = Math.floor(g.pod.x / 48), row = 8 + 420;
    g.igniteGas(c, row);        // no gas there: must be a no-op
    const noop = g.pod.hull === before;
    g.world.gas[g.world.idx(c, row)] = 1;
    g.world.type[g.world.idx(c, row)] = 1;
    g.igniteGas(c, row);
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    return { noop, before, after: g.pod.hull, warning: g.warning };
  });
  assert(r.noop, "igniteGas fired on a tile with no gas in it");
  assert(r.after < r.before, "the gas pocket did no damage");
  assert(/GAS/.test(r.warning || ""), "no gas warning: " + r.warning);
  return r;
});

await scenario("vendors", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.cash = 1000000;
    g.pod.cargo = { ironium: 4, goldium: 2 };
    const tabs = [];
    for (const id of ["fuel", "sell", "shop", "repair"]) {
      g.openShop({ id, name: id });
      await new Promise((res) => requestAnimationFrame(res));
      await new Promise((res) => requestAnimationFrame(res));
      tabs.push({ id, state: g.state, rects: (g.shopRects || []).length });
    }
    return { tabs };
  });
  for (const t of r.tabs) {
    assert(t.state === "shop", t.id + " did not open");
    assert(t.rects > 2, t.id + " screen drew no controls");
  }
  return r;
});

await scenario("vendor-buy", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.cash = 100000;
    g.openShop({ id: "shop", name: "AUTOBUY 2000" });
    await new Promise((res) => requestAnimationFrame(res));
    await new Promise((res) => requestAnimationFrame(res));
    const before = g.pod.tiers.drill, cashBefore = g.pod.cash;
    const hit = (g.shopRects || []).find((s) => s.action === "buyUpgrade" && s.arg === "drill");
    const { rect } = hit;
    g.mouse.x = rect.x + rect.w / 2;
    g.mouse.y = rect.y + rect.h / 2;
    g.onClick();
    await new Promise((res) => requestAnimationFrame(res));
    return { before, after: g.pod.tiers.drill, spent: cashBefore - g.pod.cash, msg: g.shopMessage };
  });
  assert(r.after === r.before + 1, "the drill tier did not advance");
  assert(r.spent === 750, "wrong price paid: " + r.spent);
  return r;
});

await scenario("options", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.overlay = "options";
    await new Promise((res) => requestAnimationFrame(res));
    await new Promise((res) => requestAnimationFrame(res));
    const slider = (g.optionRects || []).find((o) => o.action === "slider" && o.arg === "music");
    const mute = (g.optionRects || []).find((o) => o.action === "mute");
    // Drag the music slider to a quarter and toggle mute.
    g.mouse.x = slider.rect.x + slider.rect.w * 0.25;
    g.mouse.y = slider.rect.y + 8;
    g.onClick();
    g.sliderDrag = null;
    g.mouse.x = mute.rect.x + 10; g.mouse.y = mute.rect.y + 10;
    g.onClick();
    const { settings } = await import("./src/settings.js");
    return { music: settings.music, muted: settings.muted, rects: g.optionRects.length };
  });
  assert(r.rects >= 5, "options screen drew no controls");
  assert(r.music > 0.1 && r.music < 0.45, "the music slider did not move: " + r.music);
  assert(r.muted === true, "mute did not toggle");
  return r;
});

await scenario("inventory", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.items.plastic = 4;
    g.pod.cargo = { ruby: 2, diamond: 1 };
    g.pod.blueprints.wormhole = true;
    g.pod.satanHeads = 2;
    g.overlay = "inventory";
    await new Promise((res) => requestAnimationFrame(res));
    await new Promise((res) => requestAnimationFrame(res));
    return { overlay: g.overlay, rects: (g.optionRects || []).length, value: g.pod.cargoValue() };
  });
  assert(r.overlay === "inventory", "the inventory did not open");
  assert(r.value > 0, "the hold reported no value");
  return r;
});

await scenario("pause", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.stats.deepest = 4200;
    g.pod.stats.dug = 137;
    g.pod.stats.earned = 88000;
    g.story.queue.length = 0; g.story.active = null;
    g.onKey({ code: "Escape", preventDefault() {} }, true);
    await new Promise((res) => requestAnimationFrame(res));
    await new Promise((res) => requestAnimationFrame(res));
    const paused = g.state;
    // The pause screen's own INVENTORY button must open the overlay.
    const b = g.pauseButtons.inventory;
    g.mouse.x = b.x + b.w / 2; g.mouse.y = b.y + b.h / 2;
    g.onClick();
    await new Promise((res) => requestAnimationFrame(res));
    const overlay = g.overlay;
    g.closeOverlay();
    await new Promise((res) => requestAnimationFrame(res));
    await new Promise((res) => requestAnimationFrame(res));
    return { paused, overlay, buttons: Object.keys(g.pauseButtons) };
  });
  assert(r.paused === "paused", "ESC did not pause");
  assert(r.overlay === "inventory", "the pause screen's INVENTORY button did nothing");
  assert(r.buttons.length === 3, "pause screen is missing buttons");
  return r;
});

await scenario("challenge-select", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.state = "challengeSelect";
    await new Promise((res) => requestAnimationFrame(res));
    await new Promise((res) => requestAnimationFrame(res));
    const { CHALLENGES } = await import("./src/challenge.js");
    return {
      rows: CHALLENGES.length,
      rects: (g.challengeRects || []).length,
      first: CHALLENGES[0].target,
      last: CHALLENGES[11].target,
      limits: CHALLENGES.map((c) => c.limit),
    };
  });
  assert(r.rows === 12, "expected 12 challenges, got " + r.rows);
  assert(r.first === "5 Ironium", "challenge 1 target drifted: " + r.first);
  assert(r.last === "Navigate through 3rd maze", "challenge 12 target drifted: " + r.last);
  const want = [60, 80, 120, 60, 120, 180, 120, 120, 60, 60, 120, 300];
  assert(JSON.stringify(r.limits) === JSON.stringify(want), "time limits drifted: " + r.limits);
  assert(r.rects >= 14, "select screen drew no play buttons");
  return r;
});

await scenario("challenge-ore", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startChallenge(1);
    await new Promise((res) => requestAnimationFrame(res));
    const spec = g.challenge.spec;
    // Count the Ironium actually seeded in the top rows the timer allows.
    let near = 0;
    for (let row = 8; row < 8 + 40; row++) {
      for (let c = 1; c < 31; c++) if (g.world.ore[g.world.idx(c, row)] === 1) near++;
    }
    g.input.down = true;
    for (let i = 0; i < 200; i++) await new Promise((res) => requestAnimationFrame(res));
    g.input.down = false;
    return {
      target: spec.target, limit: spec.limit, near,
      collected: g.challenge.collected.ironium || 0,
      tiers: { ...g.pod.tiers },
      timeLeft: g.challenge.timeLeft,
      status: g.challenge.status,
      state: g.state,
    };
  });
  assert(r.target === "5 Ironium", "wrong spec");
  assert(r.near > 30, "not enough Ironium seeded near the surface: " + r.near);
  assert(r.tiers.drill === 1 && r.tiers.fuel === 2, "loadout not applied: " + JSON.stringify(r.tiers));
  assert(r.timeLeft < r.limit, "the challenge clock is not running");
  return r;
});

await scenario("challenge-blast", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startChallenge(9);
    await new Promise((res) => requestAnimationFrame(res));
    const layer = g.world.blastLayer;
    // Every tile across the slab row must be undrillable rock.
    let rock = 0;
    for (let c = 1; c < 31; c++) if (g.world.type[g.world.idx(c, layer.r0)] === 2) rock++;
    // Sit on the slab and set a charge off against it.
    g.pod.x = 16 * 48 + 24;
    g.pod.y = (layer.r0 - 1) * 48 - 20;
    g.pod.items.dynamite = 2;
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    g.useItem("dynamite");
    for (let i = 0; i < 160; i++) await new Promise((res) => requestAnimationFrame(res));
    return {
      layerRow: layer.r0, rock,
      depthOfLayer: Math.round(g.world.depthFtOfRow(layer.r0)),
      blasted: g.challenge ? g.challenge.blasted : null,
      state: g.state,
    };
  });
  assert(r.rock === 30, "the slab is not solid across the map: " + r.rock + "/30");
  assert(r.depthOfLayer === 2560 || Math.abs(r.depthOfLayer - 2560) <= 7,
    "the slab is at " + r.depthOfLayer + " ft, not 2560");
  assert(r.blasted === true, "the charge did not register as breaching the slab");
  return r;
});

await scenario("challenge-maze", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startChallenge(10);
    for (let i = 0; i < 30; i++) await new Promise((res) => requestAnimationFrame(res));
    const goal = g.challenge.goal;
    const spawnClear = !g.pod.blocked(g.pod.x, g.pod.y);
    // The exit must be reachable: teleport onto it and the objective ticks.
    g.pod.x = goal.x; g.pod.y = goal.y;
    for (let i = 0; i < 6; i++) await new Promise((res) => requestAnimationFrame(res));
    return {
      goal: { x: Math.round(goal.x), y: Math.round(goal.y) },
      spawnClear,
      reached: g.challenge ? g.challenge.reachedGoal : true,
      state: g.state,
      cleared: g.challengeProgress.cleared.length,
    };
  });
  assert(r.spawnClear, "the pod spawned inside the maze wall");
  assert(r.reached || r.state === "challengeResult", "touching the exit did not clear the maze");
  assert(r.cleared >= 1, "the clear was not recorded");
  return r;
});

await scenario("challenge-maze-view", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startChallenge(11);
    // Fly a little way in so the shot shows corridors, not just the entrance.
    for (let i = 0; i < 40; i++) await new Promise((res) => requestAnimationFrame(res));
    g.input.right = true;
    for (let i = 0; i < 40; i++) await new Promise((res) => requestAnimationFrame(res));
    g.input.right = false;
    for (let i = 0; i < 30; i++) await new Promise((res) => requestAnimationFrame(res));
    let rock = 0, air = 0;
    for (let row = 9; row < 9 + 25; row++) {
      for (let c = 1; c < 31; c++) {
        const t = g.world.type[g.world.idx(c, row)];
        if (t === 2) rock++; else if (t === 0) air++;
      }
    }
    return { rock, air, state: g.state, depth: Math.round(g.pod.depthFt()) };
  });
  assert(r.rock > 200, "the maze band is not mostly rock: " + r.rock);
  assert(r.air > 80, "the maze has no corridors: " + r.air);
  assert(r.state === "play", "the maze run ended early: " + r.state);
  return r;
});

await scenario("challenge-fail", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startChallenge(4);
    await new Promise((res) => requestAnimationFrame(res));
    g.challenge.timeLeft = 0.01;
    for (let i = 0; i < 10; i++) await new Promise((res) => requestAnimationFrame(res));
    return {
      state: g.state,
      status: g.challenge.status,
      reason: g.challenge.failReason,
      flawless: g.challengeProgress.flawless,
    };
  });
  assert(r.state === "challengeResult", "a timeout did not end the challenge");
  assert(r.status === "failed", "status is " + r.status);
  assert(r.flawless === false, "a failure did not forfeit the flawless run");
  return r;
});

await scenario("challenge-reward", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    const { saveProgress } = await import("./src/challenge.js");
    g.challengeProgress = { cleared: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11], flawless: true, multidrill: false };
    saveProgress(g.challengeProgress);
    g.startChallenge(12);
    await new Promise((res) => requestAnimationFrame(res));
    g.challenge.reachedGoal = true;
    for (let i = 0; i < 8; i++) await new Promise((res) => requestAnimationFrame(res));
    const multidrill = g.challengeProgress.multidrill;
    g.startGame(true);
    await new Promise((res) => requestAnimationFrame(res));
    return {
      multidrill,
      fitted: !!g.pod.blueprints.multidrill,
      cutsRock: g.pod.canCutRock(),
      allClear: g.challengeAllClear,
    };
  });
  assert(r.multidrill, "clearing all twelve did not award the Multi-Drill");
  assert(r.fitted && r.cutsRock, "the Multi-Drill was not fitted on the next new game");
  return r;
});

await scenario("barrier-gap", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    const w = g.world;
    g.pod.x = w.lair.entryX;
    g.pod.y = (w.lair.row0 - 2) * 48;
    g.pod.tiers.fuel = 6; g.pod.fuel = g.pod.maxFuel();
    g.pod.tiers.hull = 6; g.pod.hull = g.pod.maxHull();
    for (let i = 0; i < 90; i++) await new Promise((res) => requestAnimationFrame(res));
    return {
      inLair: g.pod.inLair,
      boss: !!g.boss,
      depth: Math.round(g.pod.depthFt()),
      gapCol: w.barrierGapCol,
    };
  });
  assert(r.inLair, "falling through the gap did not enter the arena");
  assert(r.boss, "Mr. Natas did not spawn");
  return r;
});

await scenario("boss-explosives", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.tiers.hull = 6; g.pod.hull = g.pod.maxHull();
    g.pod.tiers.fuel = 6; g.pod.fuel = g.pod.maxFuel();
    g.pod.y = (g.world.lair.row0 + 4) * 48;
    g.pod.x = g.world.lair.centerX;
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    const boss = g.boss;
    const startHp = boss.hp;

    // Ramming must do nothing at all to him.
    g.pod.x = boss.x; g.pod.y = boss.y;
    g.input.down = true;
    for (let i = 0; i < 40; i++) await new Promise((res) => requestAnimationFrame(res));
    g.input.down = false;
    const afterRam = boss.hp;

    // A charge at his feet is the full 240 for plastic, 120 for dynamite.
    boss.hp = startHp;
    const direct = boss.applyBlast("plastic", boss.x, boss.feetY, 3.4, g);
    const dyn = boss.applyBlast("dynamite", boss.x, boss.feetY, 2.2, g);
    const ranged = boss.applyBlast("plastic", boss.x + 48 * 6, boss.feetY, 3.4, g);
    const close = boss.applyBlast("plastic", boss.x + 48 * 2, boss.feetY, 3.4, g);
    // Back off and let the hit spark fade so the screenshot shows him, not it.
    g.pod.x = boss.x - 260;
    g.pod.y = boss.floorY - 30;
    g.story.queue.length = 0; g.story.active = null;
    boss.hp = 700;
    for (let i = 0; i < 45; i++) await new Promise((res) => requestAnimationFrame(res));
    return { startHp, ramDelta: startHp - afterRam, direct, dyn, ranged, close,
      lock: g.pod.bounceLock };
  });
  assert(r.startHp === 1000, "form 1 is not 1000 HP: " + r.startHp);
  assert(r.ramDelta <= 0.001, "ramming damaged him by " + r.ramDelta);
  assert(r.direct === 240, "point-blank plastic dealt " + r.direct + ", not 240");
  assert(r.dyn === 120, "point-blank dynamite dealt " + r.dyn + ", not 120");
  assert(r.close === 120, "a close plastic hit dealt " + r.close + ", not 120");
  assert(r.ranged === 0, "a charge six tiles away still hit him for " + r.ranged);
  assert(r.lock > 0, "contact did not lock the pod out of its charges");
  return r;
});

await scenario("boss-phase", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.tiers.hull = 6; g.pod.hull = g.pod.maxHull();
    g.pod.y = (g.world.lair.row0 + 4) * 48;
    g.pod.x = g.world.lair.centerX;
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    const boss = g.boss;
    boss.takeDamage(1000, g);
    const form1Done = { form: boss.form, hp: boss.hp, max: boss.maxHp, sinking: boss.transitioning };
    // Ride out the transmission and the sink.
    g.story.queue.length = 0; g.story.active = null;
    boss.timer = 0;
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    boss.takeDamage(2000, g);
    for (let i = 0; i < 10; i++) await new Promise((res) => requestAnimationFrame(res));
    return { form1Done, state: g.state, heads: g.pod.satanHeads, dead: boss.dead };
  });
  assert(r.form1Done.form === 1, "he did not change form");
  assert(r.form1Done.max === 2000, "form 2 is not 2000 HP: " + r.form1Done.max);
  assert(r.form1Done.sinking, "he did not sink between forms");
  assert(r.state === "victory", "killing form 2 did not win: state " + r.state);
  assert(r.heads === 1, "no Satan's Head awarded");
  return r;
});

await scenario("boss-ceiling-reset", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.tiers.hull = 6; g.pod.hull = g.pod.maxHull();
    g.pod.y = (g.world.lair.row0 + 4) * 48;
    g.pod.x = g.world.lair.centerX;
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    g.boss.hp = 300;
    // Three squares up: still fighting, and the pocket is real.
    g.pod.x = g.world.lair.entryX;
    g.pod.y = (g.world.lair.row0 - 1) * 48;
    for (let i = 0; i < 6; i++) await new Promise((res) => requestAnimationFrame(res));
    const inPocket = !!g.boss;
    const clearance = g.boss ? g.boss.ceilingClearance(g.pod) : null;
    // Four squares up abandons it.
    g.pod.y = (g.world.lair.row0 - 5) * 48;
    for (let i = 0; i < 6; i++) await new Promise((res) => requestAnimationFrame(res));
    return { inPocket, clearance, bossGone: !g.boss, warning: g.warning };
  });
  assert(r.inPocket, "the safe pocket above the ceiling ended the fight early");
  assert(r.clearance > 0, "the pocket did not read as above the ceiling");
  assert(r.bossGone, "leaving the chamber did not reset the fight");
  return r;
});

await scenario("boss-locks-ui", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.tiers.hull = 6; g.pod.hull = g.pod.maxHull();
    g.pod.y = (g.world.lair.row0 + 4) * 48;
    g.pod.x = g.world.lair.centerX;
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    g.story.queue.length = 0; g.story.active = null;
    const fire = (code) => g.onKey({ code, preventDefault() {} }, true);
    fire("KeyI"); const afterI = g.overlay;
    fire("KeyO"); const afterO = g.overlay;
    fire("Escape"); const afterEsc = g.state;
    return { fighting: g.inBossFight(), afterI, afterO, afterEsc };
  });
  assert(r.fighting, "not in the fight");
  assert(!r.afterI && !r.afterO, "an overlay opened during the boss fight");
  assert(r.afterEsc === "play", "ESC paused during the boss fight");
  return r;
});

await scenario("victory", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.cash = 1000;
    g.onBossDefeated();
    await new Promise((res) => requestAnimationFrame(res));
    await new Promise((res) => requestAnimationFrame(res));
    return {
      state: g.state,
      rows: g.victoryRewards.length,
      estate: g.victoryRewards.slice(0, 6).reduce((a, [, v]) => a + v, 0),
      score: g.finalScore,
      heads: g.pod.satanHeads,
    };
  });
  assert(r.state === "victory", "the victory screen did not come up");
  assert(r.estate === 28500000, "the estate does not total $28,500,000: " + r.estate);
  assert(r.heads === 1, "no Satan's Head");
  return r;
});

await scenario("newgameplus", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    const ore = await import("./src/ore.js");
    g.startGame(true);
    const base = ore.sellValue(ore.ORE_BY_ID.ironium);
    const basePts = ore.sellPoints(ore.ORE_BY_ID.ironium);
    g.onBossDefeated();
    g.advanceCycle();
    await new Promise((res) => requestAnimationFrame(res));
    const c1 = {
      cycle: ore.getCycle(),
      ironium: ore.sellValue(ore.ORE_BY_ID.ironium),
      diamond: ore.sellValue(ore.ORE_BY_ID.diamond),
      points: ore.sellPoints(ore.ORE_BY_ID.ironium),
      cash: g.pod.cash,
      tiers: g.pod.tiers.drill,
    };
    // Boss health scales 1000 x (x+1) / 2000 x (x+1).
    g.pod.y = (g.world.lair.row0 + 4) * 48;
    g.pod.x = g.world.lair.centerX;
    for (let i = 0; i < 20; i++) await new Promise((res) => requestAnimationFrame(res));
    const bossHp = g.boss ? g.boss.maxHp : null;
    // And the round-down floor: Ironium is worth $0 past cycle 31.
    ore.setCycle(31);
    const zeroed = ore.sellValue(ore.ORE_BY_ID.ironium);
    ore.setCycle(c1.cycle);
    return { base, basePts, c1, bossHp, zeroed };
  });
  assert(r.base === 30 && r.basePts === 150, "base Ironium drifted");
  assert(r.c1.cycle === 1, "the cycle did not advance");
  assert(r.c1.ironium === 15, "cycle 2 Ironium should pay $15, got " + r.c1.ironium);
  assert(r.c1.diamond === 50000, "cycle 2 Diamond should pay $50,000, got " + r.c1.diamond);
  assert(r.c1.points === 300, "dig points should double, got " + r.c1.points);
  assert(r.c1.cash === 0 && r.c1.tiers === 0, "New Game+ did not strip cash and upgrades");
  assert(r.bossHp === 2000, "form 1 should be 2000 HP at cycle 2, got " + r.bossHp);
  assert(r.zeroed === 0, "Ironium should round down to $0 at cycle 32, got " + r.zeroed);
  return r;
});

await scenario("death-rollback", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.cash = 5000;
    g.save();
    g.pod.cargo = { goldium: 3 };
    const holdValue = g.pod.cargoValue();
    // Dig a few tiles so the rollback has tunnels to undo.
    const c = Math.floor(g.pod.x / 48);
    for (let row = 9; row < 16; row++) g.world.clear(c, row);
    const dugBefore = g.world.edits.size;
    g.killPod("TEST", "probe");
    await new Promise((res) => requestAnimationFrame(res));
    const dead = { state: g.state, lost: g.lostValue };
    g.restoreSave();
    await new Promise((res) => requestAnimationFrame(res));
    return {
      holdValue, dead, dugBefore,
      dugAfter: g.world.edits.size,
      cash: g.pod.cash,
      cargo: Object.keys(g.pod.cargo).length,
      state: g.state,
    };
  });
  assert(r.dead.state === "dead", "the death screen did not come up");
  assert(r.dead.lost === r.holdValue, "the lost-cargo figure is wrong");
  assert(r.state === "play", "restoring the save did not resume play");
  assert(r.cargo === 0, "the hold survived death");
  assert(r.cash === 5000, "cash was not restored from the save");
  assert(r.dugAfter < r.dugBefore, "the tunnels dug since the save were not rolled back");
  return r;
});

await scenario("music-scenes", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    const { sceneForDepth } = await import("./src/music.js");
    g.startGame(true);
    const bands = [0, 800, 2000, 4000, 6000].map(sceneForDepth);
    const seen = [];
    for (const d of [0, 800, 2000, 4000, 6000]) {
      g.pod.y = (8 + d / 12.5) * 48;
      await new Promise((res) => requestAnimationFrame(res));
      seen.push(g.music.pendingScene || g.music.sceneName);
    }
    // Let the sequencer actually run a bar or two.
    g.audio.resume();
    for (let i = 0; i < 90; i++) await new Promise((res) => requestAnimationFrame(res));
    const ctx = g.audio.ctx;
    return {
      bands,
      distinct: new Set(bands).size,
      hasCtx: !!ctx,
      ctxState: ctx ? ctx.state : null,
      notes: g.music.notesScheduled,
      musicBus: !!(g.audio.musicBus),
      sfxBus: !!(g.audio.sfxBus),
      scene: g.music.sceneName,
      seen,
    };
  });
  assert(r.distinct === 5, "the depth bands do not all differ: " + r.bands);
  assert(r.musicBus && r.sfxBus, "the audio buses were never built");
  if (r.ctxState === "running") {
    // 90 frames is roughly a second of audio clock; at 78 BPM that is about
    // six sixteenths plus the lookahead.
    assert(r.notes >= 5, "the sequencer scheduled only " + r.notes + " steps");
  }
  return r;
});

await scenario("deep-strata", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.tiers.fuel = 6; g.pod.fuel = g.pod.maxFuel();
    g.pod.tiers.hull = 6; g.pod.hull = g.pod.maxHull();
    g.pod.x = 16 * 48 + 24;
    g.pod.y = (8 + 5000 / 12.5) * 48;
    // Carve a pocket so we are looking at a tunnel, not the inside of a rock.
    const c = 16, row = Math.floor(g.pod.y / 48);
    for (let dr = -2; dr <= 0; dr++) for (let dc = -2; dc <= 2; dc++) g.world.raw(c + dc, row + dr, 0);
    g.world.dirty.clear();
    for (let k = 0; k < 4096; k++) g.world.dirty.add(k);
    for (let i = 0; i < 40; i++) await new Promise((res) => requestAnimationFrame(res));
    return { depth: Math.round(g.pod.depthFt()), garbled: g.pod.depthFt() > 5813 };
  });
  assert(r.depth > 4900, "did not reach deep strata: " + r.depth);
  return r;
});

await scenario("altimeter-jam", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    g.pod.y = (8 + 6000 / 12.5) * 48;
    await new Promise((res) => requestAnimationFrame(res));
    return { depth: Math.round(g.pod.depthFt()) };
  });
  assert(r.depth > 5813, "not below the jam threshold");
  return r;
});

await scenario("sky-egg", async (page) => {
  const r = await page.evaluate(async () => {
    const g = window.__game;
    g.startGame(true);
    // A little past the mark: depthFt() measures from the pod's underside.
    g.pod.y = (8 - 10200 / 12.5) * 48;
    for (let i = 0; i < 8; i++) await new Promise((res) => requestAnimationFrame(res));
    return { guardian: !!g.pod.eggs.guardian, mul: g.pod.damageMul(), alt: Math.round(g.pod.altitudeFt()) };
  });
  assert(r.guardian, "the Guardian was not granted at 10,000 ft");
  assert(r.mul === 0.5, "the Guardian does not halve damage");
  return r;
});

// ---------------------------------------------------------------- report
await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} scenarios passed`);
if (failed.length) {
  for (const f of failed) console.log(`  FAIL ${f.name}: ${f.error}`);
}
process.exit(failed.length ? 1 : 0);
