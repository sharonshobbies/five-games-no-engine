// Challenge mode: the twelve timed objectives from the Goldium Edition.
//
// The targets and time limits below are transcribed CHARACTER-EXACT from the
// Motherload wiki's Challenge page (raw wikitext, columns `#` / `Target` /
// `Time limit`). The objectives have no names in the source, so none are
// invented here -- the target string IS the objective.
//
//   1  5 Ironium                                          1:00
//   2  3 Ironium and 3 Bronzium                           1:20
//   3  3 Silverium                                        2:00
//   4  Reach 600 feet                                     1:00
//   5  Reach 1400 feet                                    2:00
//   6  Reach 2400 feet and 5 Goldium                      3:00
//   7  Reach 2500 feet and 5 Platinium                    2:00
//   8  5 more Platinium                                   2:00
//   9  Destroy the rock layer at 2560 feet with dynamite  1:00
//   10 Navigate through 1st maze                          1:00
//   11 Navigate through 2nd maze                          2:00
//   12 Navigate through 3rd maze                          5:00
//
// The same page states the rest of the rules: challenges exist only in Goldium
// Edition, fuel is refilled and the hull repaired between them, "every few
// challenges you get better equipment to make goal reachable", and clearing all
// twelve grants the Multi-Drill on a new game. The Ancient Blueprints page adds
// the stricter condition -- all twelve "without failing" -- which is the one
// enforced here.
//
// What is NOT sourced, and is therefore this build's invention:
//   * the three maze layouts (the wiki names them only as 1st / 2nd / 3rd)
//   * the per-challenge loadout, i.e. what "better equipment" actually is
//   * whether challenge 8's "5 more" continues challenge 7's count; it is read
//     here as a fresh count of five, starting at the 2,500 ft it left you at
//   * the failure conditions (timer expiry or a destroyed pod)

import { TILE, SURFACE_ROW, FEET_PER_TILE } from "./config.js";
import { T } from "./world.js";
import { ORE_INDEX, ORES } from "./ore.js";
import { mulberry32 } from "./rng.js";

const KEY = "motherload.challenge.v1";

/** Loadout per challenge: the escalation the wiki mentions but never itemises. */
const LOADOUTS = [
  { fuel: 2, drill: 1, engine: 1, hull: 2, cargo: 1, radiator: 0 },
  { fuel: 2, drill: 2, engine: 1, hull: 2, cargo: 1, radiator: 0 },
  { fuel: 3, drill: 2, engine: 2, hull: 2, cargo: 2, radiator: 0 },
  { fuel: 3, drill: 3, engine: 3, hull: 3, cargo: 2, radiator: 1 },
  { fuel: 4, drill: 4, engine: 3, hull: 3, cargo: 2, radiator: 1 },
  { fuel: 4, drill: 4, engine: 4, hull: 4, cargo: 3, radiator: 2 },
  { fuel: 5, drill: 5, engine: 4, hull: 4, cargo: 3, radiator: 2 },
  { fuel: 5, drill: 5, engine: 5, hull: 5, cargo: 3, radiator: 3 },
  { fuel: 5, drill: 6, engine: 5, hull: 5, cargo: 3, radiator: 3 },
  { fuel: 6, drill: 6, engine: 6, hull: 5, cargo: 4, radiator: 4 },
  { fuel: 6, drill: 6, engine: 6, hull: 6, cargo: 4, radiator: 4 },
  { fuel: 6, drill: 6, engine: 6, hull: 6, cargo: 5, radiator: 5 },
];

export const CHALLENGES = [
  { n: 1,  target: "5 Ironium",                    limit: 60,  kind: "ore",   need: { ironium: 5 } },
  { n: 2,  target: "3 Ironium and 3 Bronzium",     limit: 80,  kind: "ore",   need: { ironium: 3, bronzium: 3 } },
  { n: 3,  target: "3 Silverium",                  limit: 120, kind: "ore",   need: { silverium: 3 } },
  { n: 4,  target: "Reach 600 feet",               limit: 60,  kind: "depth", depth: 600 },
  { n: 5,  target: "Reach 1400 feet",              limit: 120, kind: "depth", depth: 1400 },
  { n: 6,  target: "Reach 2400 feet and 5 Goldium", limit: 180, kind: "both", depth: 2400, need: { goldium: 5 } },
  { n: 7,  target: "Reach 2500 feet and 5 Platinium", limit: 120, kind: "both", depth: 2500, need: { platinium: 5 } },
  { n: 8,  target: "5 more Platinium",             limit: 120, kind: "ore",   need: { platinium: 5 }, startDepth: 2500 },
  { n: 9,  target: "Destroy the rock layer at 2560 feet with dynamite", limit: 60, kind: "blast", layerFt: 2560 },
  { n: 10, target: "Navigate through 1st maze",    limit: 60,  kind: "maze",  maze: 0 },
  { n: 11, target: "Navigate through 2nd maze",    limit: 120, kind: "maze",  maze: 1 },
  { n: 12, target: "Navigate through 3rd maze",    limit: 300, kind: "maze",  maze: 2 },
];

// Maze sizes in cells; corridors are one tile wide with one-tile rock walls.
const MAZES = [
  { cols: 9,  rows: 7,  seed: 7717 },
  { cols: 13, rows: 12, seed: 4231 },
  { cols: 15, rows: 22, seed: 9059 },
];

export function loadoutFor(n) { return LOADOUTS[Math.min(LOADOUTS.length - 1, n - 1)]; }

// ---- persistence ------------------------------------------------------------
export function loadProgress() {
  const blank = { cleared: [], flawless: true, multidrill: false };
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return blank;
    const d = JSON.parse(s);
    return {
      cleared: Array.isArray(d.cleared) ? d.cleared.filter((x) => x >= 1 && x <= 12) : [],
      flawless: d.flawless !== false,
      multidrill: !!d.multidrill,
    };
  } catch { return blank; }
}

export function saveProgress(p) {
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* ignore */ }
}

export function resetProgress() {
  const p = { cleared: [], flawless: true, multidrill: false };
  saveProgress(p);
  return p;
}

// ---- world shaping ----------------------------------------------------------
function rowOf(depthFt) { return SURFACE_ROW + Math.round(depthFt / FEET_PER_TILE); }

/** Seed extra specimens of one mineral through a depth window. */
function seedOre(world, oreId, fromFt, toFt, chance, rand) {
  const r0 = Math.max(SURFACE_ROW + 1, rowOf(fromFt));
  const r1 = Math.min(world.h - 1, rowOf(toFt));
  const oi = ORE_INDEX[oreId] + 1;
  for (let r = r0; r <= r1; r++) {
    for (let c = 1; c < world.w - 1; c++) {
      const i = world.idx(c, r);
      if (world.type[i] !== T.SOIL || world.art[i]) continue;
      if (rand() < chance) { world.ore[i] = oi; world.gas[i] = 0; }
    }
  }
}

/**
 * A recursive-backtracker maze carved into solid rock. Cell (0,0) is the
 * entrance at the top left; the exit is the bottom-right cell, marked with a
 * goal beacon. Rock walls mean you fly the corridors instead of drilling
 * through them.
 */
function carveMaze(world, spec, topRow) {
  const rand = mulberry32(spec.seed);
  const { cols, rows } = spec;
  const visited = new Uint8Array(cols * rows);
  const open = new Uint8Array(cols * rows * 4);   // N E S W per cell
  const DX = [0, 1, 0, -1], DY = [-1, 0, 1, 0];
  const stack = [0];
  visited[0] = 1;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const cx = cur % cols, cy = (cur / cols) | 0;
    const options = [];
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      if (visited[ny * cols + nx]) continue;
      options.push(d);
    }
    if (!options.length) { stack.pop(); continue; }
    // Bias downward so the path drops with gravity instead of fighting it.
    const weighted = [];
    for (const d of options) weighted.push(d, ...(d === 2 ? [d, d] : []));
    const d = weighted[Math.floor(rand() * weighted.length)];
    const nx = cx + DX[d], ny = cy + DY[d];
    const nxt = ny * cols + nx;
    open[cur * 4 + d] = 1;
    open[nxt * 4 + ((d + 2) % 4)] = 1;
    visited[nxt] = 1;
    stack.push(nxt);
  }

  // Fill the whole band with rock, then punch the corridors out of it.
  const bandRows = rows * 2 + 1;
  const left = 1;
  for (let r = topRow; r < topRow + bandRows + 2; r++) {
    for (let c = 1; c < world.w - 1; c++) world.raw(c, r, T.ROCK);
  }
  const tileOf = (cx, cy) => ({ c: left + 1 + cx * 2, r: topRow + 1 + cy * 2 });
  for (let cy = 0; cy < rows; cy++) {
    for (let cx = 0; cx < cols; cx++) {
      const cell = cy * cols + cx;
      const { c, r } = tileOf(cx, cy);
      world.raw(c, r, T.AIR);
      for (let d = 0; d < 4; d++) {
        if (!open[cell * 4 + d]) continue;
        world.raw(c + DX[d], r + DY[d], T.AIR);
      }
    }
  }
  // A landing shelf under the entrance so the pod does not fall out of the maze
  // before the player has touched a key.
  const entry = tileOf(0, 0);
  world.raw(entry.c, entry.r + 1, T.ROCK);
  const exit = tileOf(cols - 1, rows - 1);
  world.raw(exit.c, exit.r + 1, T.ROCK);
  return {
    entryX: (entry.c + 0.5) * TILE,
    entryY: (entry.r + 1) * TILE,
    goalX: (exit.c + 0.5) * TILE,
    goalY: (exit.r + 0.5) * TILE,
  };
}

/**
 * Reshape a freshly generated world for one challenge, and return where the pod
 * should start plus any goal marker.
 */
export function prepareWorld(world, spec) {
  const rand = mulberry32(world.seed ^ (spec.n * 7919));
  const out = { spawn: null, goal: null };

  if (spec.kind === "maze") {
    // Everything above the maze becomes rock too, so the only way is through.
    const topRow = SURFACE_ROW + 1;
    const m = carveMaze(world, MAZES[spec.maze], topRow);
    out.spawn = { x: m.entryX, y: m.entryY - 24 };
    out.goal = { x: m.goalX, y: m.goalY, r: 40 };
    world.dirty.clear();
    for (let k = 0; k < 4096; k++) world.dirty.add(k);
    return out;
  }

  if (spec.kind === "blast") {
    // A full-width undrillable slab two rows thick at the stated depth. No
    // shop drill cuts it, so the only way through it is the charge.
    const r0 = rowOf(spec.layerFt);
    world.blastLayer = { r0, r1: r0 + 1 };
    for (let r = r0; r <= r0 + 1; r++) {
      for (let c = 1; c < world.w - 1; c++) world.raw(c, r, T.ROCK);
    }
    // Clear the lava and gas above it: the objective is the slab, not survival.
    for (let r = SURFACE_ROW; r < r0; r++) {
      for (let c = 1; c < world.w - 1; c++) {
        const i = world.idx(c, r);
        if (world.type[i] === T.LAVA) world.type[i] = T.SOIL;
        world.gas[i] = 0;
      }
    }
    world.dirty.clear();
    for (let k = 0; k < 4096; k++) world.dirty.add(k);
    return out;
  }

  // Ore and depth runs: guarantee the target mineral is actually findable in
  // the window the timer allows, and take the hazards out of the shallow rows.
  if (spec.need) {
    for (const id of Object.keys(spec.need)) {
      const ore = ORES[ORE_INDEX[id]];
      const from = Math.max(ore.minDepth, (spec.startDepth || 0) - 200);
      const to = spec.depth ? spec.depth + 400 : Math.max(from + 900, (spec.startDepth || 0) + 900);
      seedOre(world, id, from, to, 0.085, rand);
    }
  }
  // Rock would make a 60-second dig a coin flip, so the shallow band is clear
  // of it for every non-maze, non-blast challenge.
  const clearTo = rowOf((spec.depth || spec.startDepth || 600) + 600);
  for (let r = SURFACE_ROW; r < Math.min(world.h - 1, clearTo); r++) {
    for (let c = 1; c < world.w - 1; c++) {
      const i = world.idx(c, r);
      if (world.type[i] === T.ROCK || world.type[i] === T.LAVA) world.type[i] = T.SOIL;
      world.gas[i] = 0;
    }
  }
  if (spec.startDepth) {
    // Challenge 8 picks up where 7 left off: a chamber at 2,500 ft.
    const r = rowOf(spec.startDepth);
    const c = Math.floor(world.w / 2);
    for (let dr = -1; dr <= 0; dr++) {
      for (let dc = -2; dc <= 2; dc++) world.raw(c + dc, r + dr, T.AIR);
    }
    for (let dc = -2; dc <= 2; dc++) world.raw(c + dc, r + 1, T.SOIL);
    out.spawn = { x: (c + 0.5) * TILE, y: (r + 1) * TILE - 24 };
  }
  world.dirty.clear();
  for (let k = 0; k < 4096; k++) world.dirty.add(k);
  return out;
}

// ---- the run ----------------------------------------------------------------
export class ChallengeRun {
  constructor(spec) {
    this.spec = spec;
    this.timeLeft = spec.limit;
    this.collected = {};
    this.depthReached = 0;
    this.blasted = false;
    this.reachedGoal = false;
    this.status = "running";     // running | cleared | failed
    this.failReason = null;
    this.goal = null;
  }

  /** A mineral just went into the hold. */
  onCollect(id) {
    if (this.status !== "running") return;
    this.collected[id] = (this.collected[id] || 0) + 1;
  }

  /** An explosion cleared tiles; did any belong to the target slab? */
  onBlastRows(r0, r1, layer) {
    if (!layer || this.spec.kind !== "blast") return;
    if (r1 >= layer.r0 && r0 <= layer.r1) this.blasted = true;
  }

  /** Per-objective progress rows for the HUD. */
  progress() {
    const s = this.spec;
    const rows = [];
    if (s.depth) {
      rows.push({
        label: `Depth ${Math.round(this.depthReached).toLocaleString("en-US")} / ${s.depth} ft`,
        done: this.depthReached >= s.depth,
      });
    }
    if (s.need) {
      for (const id of Object.keys(s.need)) {
        const have = this.collected[id] || 0;
        rows.push({
          label: `${ORES[ORE_INDEX[id]].name} ${Math.min(have, s.need[id])} / ${s.need[id]}`,
          done: have >= s.need[id],
        });
      }
    }
    if (s.kind === "blast") rows.push({ label: "Rock layer breached", done: this.blasted });
    if (s.kind === "maze") rows.push({ label: "Reach the exit beacon", done: this.reachedGoal });
    return rows;
  }

  complete() { return this.progress().every((r) => r.done); }

  update(dt, game) {
    if (this.status !== "running") return;
    this.timeLeft -= dt;
    const d = game.pod.depthFt();
    if (d > this.depthReached) this.depthReached = d;
    if (this.goal && !this.reachedGoal) {
      if (Math.hypot(game.pod.x - this.goal.x, game.pod.y - this.goal.y) < this.goal.r) {
        this.reachedGoal = true;
      }
    }
    if (this.complete()) { this.status = "cleared"; return; }
    if (this.timeLeft <= 0) { this.timeLeft = 0; this.fail("TIME EXPIRED"); }
  }

  fail(reason) {
    if (this.status !== "running") return;
    this.status = "failed";
    this.failReason = reason;
  }
}

export function formatClock(sec) {
  const s = Math.max(0, Math.ceil(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
