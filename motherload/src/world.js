// The destructible tile world: generation, queries, digging, chunk bookkeeping.

import {
  TILE, GRID_W, GRID_H, SURFACE_ROW, FEET_PER_TILE, CHUNK, DIG_ROWS,
  BARRIER_ROWS, LAIR_ROWS, ROCK_DEPTH_FT, LAVA_DEPTH_FT, GAS_DEPTH_FT,
  GAS_COMMON_FT, MAX_DIG_DEPTH_FT,
} from "./config.js";
import { rollOre, ORE_INDEX, ORES, ARTIFACTS } from "./ore.js";
import { BLUEPRINTS } from "./upgrades.js";
import { mulberry32, hash2, fbm } from "./rng.js";

export const T = {
  AIR: 0,
  SOIL: 1,
  ROCK: 2,      // undrillable stone -- explosives only (or the Multi-Drill)
  LAVA: 3,
  BEDROCK: 4,   // world frame and the -7,300 ft barrier
};

// `art` values: 0 none, 1..4 artifact kinds, 20+i an Ancient Blueprint.
export const ART_BLUEPRINT_BASE = 20;

export const CHUNKS_X = Math.ceil(GRID_W / CHUNK);
export const CHUNKS_Y = Math.ceil(GRID_H / CHUNK);

export const BARRIER_ROW0 = SURFACE_ROW + DIG_ROWS;
export const LAIR_ROW0 = BARRIER_ROW0 + BARRIER_ROWS;

export class World {
  constructor(seed = 20040101) {
    this.seed = seed;
    this.w = GRID_W;
    this.h = GRID_H;
    const n = GRID_W * GRID_H;
    this.type = new Uint8Array(n);
    this.ore = new Uint8Array(n);   // 0 = none, else ORE index + 1
    this.art = new Uint8Array(n);
    this.gas = new Uint8Array(n);   // invisible: renders as plain soil
    this.tint = new Uint8Array(n);
    this.dirty = new Set();
    this.edits = new Set();         // tile indices the player has cleared
    this.generate();
  }

  idx(c, r) { return r * this.w + c; }
  inBounds(c, r) { return c >= 0 && r >= 0 && c < this.w && r < this.h; }

  typeAt(c, r) {
    if (!this.inBounds(c, r)) return r < 0 ? T.AIR : T.BEDROCK;
    return this.type[this.idx(c, r)];
  }
  isSolid(c, r) {
    const t = this.typeAt(c, r);
    return t === T.SOIL || t === T.ROCK || t === T.BEDROCK;
  }
  /** Rock resists every drill in the shop; only the Multi-Drill cuts it. */
  isDiggable(c, r, canCutRock = false) {
    const t = this.typeAt(c, r);
    if (t === T.SOIL) return true;
    if (t === T.ROCK) return canCutRock;
    return false;
  }
  depthFtOfRow(r) { return (r - SURFACE_ROW) * FEET_PER_TILE; }
  depthFtAt(y) { return (y / TILE - SURFACE_ROW) * FEET_PER_TILE; }

  hardness(c, r) {
    const t = this.typeAt(c, r);
    if (t === T.BEDROCK) return Infinity;
    if (t === T.ROCK) return 6.0;   // only reachable with the Multi-Drill
    const depth = Math.max(0, this.depthFtOfRow(r));
    return 1.0 + (depth / MAX_DIG_DEPTH_FT) * 1.35;
  }

  markDirty(c, r) {
    const cx = (c / CHUNK) | 0, cy = (r / CHUNK) | 0;
    this.dirty.add(cy * CHUNKS_X + cx);
    if (c % CHUNK === 0 && cx > 0) this.dirty.add(cy * CHUNKS_X + cx - 1);
    if (c % CHUNK === CHUNK - 1 && cx < CHUNKS_X - 1) this.dirty.add(cy * CHUNKS_X + cx + 1);
    if (r % CHUNK === 0 && cy > 0) this.dirty.add((cy - 1) * CHUNKS_X + cx);
    if (r % CHUNK === CHUNK - 1 && cy < CHUNKS_Y - 1) this.dirty.add((cy + 1) * CHUNKS_X + cx);
  }

  /** Clear a tile to air and record it for the save file. */
  clear(c, r) {
    if (!this.inBounds(c, r)) return null;
    const i = this.idx(c, r);
    const oreId = this.ore[i];
    const artId = this.art[i];
    this.type[i] = T.AIR;
    this.ore[i] = 0;
    this.art[i] = 0;
    this.gas[i] = 0;
    this.edits.add(i);
    this.markDirty(c, r);
    return {
      ore: oreId ? ORES[oreId - 1] : null,
      art: artId ? this.artEntry(artId) : null,
    };
  }

  artEntry(artId) {
    if (artId >= ART_BLUEPRINT_BASE) {
      return { blueprint: BLUEPRINTS[artId - ART_BLUEPRINT_BASE] };
    }
    return { artifact: ARTIFACTS[artId - 1] };
  }

  hasGas(c, r) {
    if (!this.inBounds(c, r)) return false;
    return this.gas[this.idx(c, r)] === 1;
  }

  serializeEdits() { return Array.from(this.edits); }
  applyEdits(list) {
    for (const i of list) {
      if (i < 0 || i >= this.type.length) continue;
      this.type[i] = T.AIR;
      this.ore[i] = 0;
      this.art[i] = 0;
      this.gas[i] = 0;
      this.edits.add(i);
    }
    this.dirty.clear();
    for (let k = 0; k < CHUNKS_X * CHUNKS_Y; k++) this.dirty.add(k);
  }

  // ---------------------------------------------------------------- generation
  generate() {
    const rand = mulberry32(this.seed);
    const { w, h } = this;

    // Three wandering soil faults so a rock-heavy band never seals the map.
    const faults = [];
    for (let f = 0; f < 3; f++) {
      faults.push({ x: 4 + f * 9 + rand() * 4, drift: (rand() - 0.5) * 0.7 });
    }

    for (let r = 0; r < h; r++) {
      const depth = this.depthFtOfRow(r);
      for (const f of faults) {
        f.x += f.drift;
        if (rand() < 0.06) f.drift = (rand() - 0.5) * 0.8;
        if (f.x < 3) { f.x = 3; f.drift = Math.abs(f.drift); }
        if (f.x > w - 4) { f.x = w - 4; f.drift = -Math.abs(f.drift); }
      }

      for (let c = 0; c < w; c++) {
        const i = this.idx(c, r);
        this.tint[i] = (hash2(c, r, this.seed ^ 0x9e37) * 255) | 0;

        if (r < SURFACE_ROW) { this.type[i] = T.AIR; continue; }
        if (c === 0 || c === w - 1) { this.type[i] = T.BEDROCK; continue; }
        if (r >= BARRIER_ROW0) { this.type[i] = T.BEDROCK; continue; }

        let t = T.SOIL;

        // Undrillable stone from -1,500 ft, thickening with depth. The bias
        // range is tuned against the noise's actual distribution: 0.615 gives
        // a few percent coverage, 0.51 gives about a third.
        if (depth >= ROCK_DEPTH_FT) {
          const grow = Math.min(1, (depth - ROCK_DEPTH_FT) / 5800);
          const bias = 0.615 - grow * 0.105;
          const n = fbm(c, r * 0.62, this.seed + 11, 7, 3);
          const inFault = faults.some((f) => Math.abs(c - f.x) < 1.4);
          if (n > bias && !inFault) t = T.ROCK;
        }

        // Open cave pockets: small voids, not caverns.
        if (r > SURFACE_ROW + 6) {
          const caveN = fbm(c * 1.2, r * 0.95, this.seed + 29, 6, 3);
          if (caveN > 0.855) t = T.AIR;
        }

        this.type[i] = t;

        if (t === T.SOIL || t === T.ROCK) {
          const o = rollOre(depth, rand);
          if (o) this.ore[i] = ORE_INDEX[o.id] + 1;
        }
      }
    }

    this.placeLava(rand);
    this.placeGas(rand);
    this.placeArtifacts(rand);
    this.placeBlueprints(rand);
    this.buildBarrierAndLair();
    this.placeOilers(rand);
    this.carveSurface();
  }

  raw(c, r, t) {
    const i = this.idx(c, r);
    this.type[i] = t;
    this.ore[i] = 0;
    this.art[i] = 0;
    this.gas[i] = 0;
  }

  /** Lava pockets: visible, from -3,000 ft, denser with depth. */
  placeLava(rand) {
    const r0 = SURFACE_ROW + Math.round(LAVA_DEPTH_FT / FEET_PER_TILE);
    const rows = BARRIER_ROW0 - r0;
    // Pockets, not a lava sea: about 3% of the tiles below -3,000 ft, weighted
    // heavily toward the bottom.
    const count = Math.round(rows * 0.13);
    for (let n = 0; n < count; n++) {
      const row = r0 + Math.floor(rows * Math.pow(rand(), 0.45));
      const col = 2 + Math.floor((this.w - 4) * rand());
      const rx = 1 + Math.floor(rand() * 2.4);
      const ry = 1 + Math.floor(rand() * 1.6);
      for (let dy = -ry; dy <= ry; dy++) {
        for (let dx = -rx; dx <= rx; dx++) {
          if ((dx * dx) / (rx * rx + 0.4) + (dy * dy) / (ry * ry + 0.3) > 1) continue;
          const c = col + dx, r = row + dy;
          if (!this.inBounds(c, r) || c <= 0 || c >= this.w - 1 || r >= BARRIER_ROW0) continue;
          this.raw(c, r, T.LAVA);
        }
      }
    }
  }

  /**
   * Gas pockets: from -4,750 ft, rare until -4,950 ft, near-certain by
   * -6,500 ft. They look exactly like soil, and never sit inside a mineral.
   */
  placeGas(rand) {
    const r0 = SURFACE_ROW + Math.round(GAS_DEPTH_FT / FEET_PER_TILE);
    for (let r = r0; r < BARRIER_ROW0; r++) {
      const depth = this.depthFtOfRow(r);
      let p;
      if (depth < GAS_COMMON_FT) p = 0.004;
      else p = 0.02 + 0.16 * Math.min(1, (depth - GAS_COMMON_FT) / (6800 - GAS_COMMON_FT));
      for (let c = 1; c < this.w - 1; c++) {
        const i = this.idx(c, r);
        if (this.type[i] !== T.SOIL || this.ore[i]) continue;
        if (rand() < p) this.gas[i] = 1;
      }
    }
  }

  placeArtifacts(rand) {
    const r0 = SURFACE_ROW + Math.round(300 / FEET_PER_TILE);
    const rows = BARRIER_ROW0 - r0;
    // Value is not depth-correlated, per the Motherload wiki.
    const counts = [16, 12, 9, 5];
    counts.forEach((count, kind) => {
      for (let n = 0; n < count; n++) {
        const row = r0 + Math.floor(rows * rand());
        const col = 2 + Math.floor((this.w - 4) * rand());
        if (!this.inBounds(col, row)) continue;
        const i = this.idx(col, row);
        if (this.type[i] !== T.SOIL) continue;
        this.art[i] = kind + 1;
        this.ore[i] = 0;
        this.gas[i] = 0;
      }
    });
  }

  placeBlueprints(rand) {
    BLUEPRINTS.forEach((bp, n) => {
      if (!bp.buried) return;      // the Multi-Drill is the Challenge reward
      for (let attempt = 0; attempt < 400; attempt++) {
        const minRow = SURFACE_ROW + Math.round(bp.depth / FEET_PER_TILE);
        const row = minRow + Math.floor((BARRIER_ROW0 - minRow) * Math.pow(rand(), 1.8));
        const col = 2 + Math.floor((this.w - 4) * rand());
        if (!this.inBounds(col, row)) continue;
        const i = this.idx(col, row);
        if (this.type[i] !== T.SOIL) continue;
        this.art[i] = ART_BLUEPRINT_BASE + n;
        this.ore[i] = 0;
        this.gas[i] = 0;
        break;
      }
    });
  }

  /**
   * The -7,300 ft barrier with a gap at the far right, and the arena beneath.
   */
  buildBarrierAndLair() {
    const w = this.w;
    // gap on the right-hand side
    this.barrierGapCol = w - 3;
    for (let r = BARRIER_ROW0; r < LAIR_ROW0; r++) {
      for (let c = this.barrierGapCol - 1; c <= this.barrierGapCol; c++) {
        this.raw(c, r, T.AIR);
      }
    }
    // arena
    for (let r = LAIR_ROW0; r < this.h; r++) {
      for (let c = 0; c < w; c++) {
        const edge = c === 0 || c === w - 1 || r >= this.h - 2;
        this.raw(c, r, edge ? T.BEDROCK : T.AIR);
      }
    }
    this.lair = {
      row0: LAIR_ROW0,
      floorRow: this.h - 2,
      centerX: (w / 2) * TILE,
      floorY: (this.h - 2) * TILE,
      entryX: (this.barrierGapCol + 0.5) * TILE,
    };
  }

  /** Flat surface strip with the four vendor buildings. */
  carveSurface() {
    for (let c = 1; c < this.w - 1; c++) {
      const i = this.idx(c, SURFACE_ROW);
      this.type[i] = T.SOIL;
      this.ore[i] = 0;
      this.art[i] = 0;
      this.gas[i] = 0;
    }
    this.pad = { c0: 2, c1: this.w - 3 };
    const groundY = SURFACE_ROW * TILE;
    // Four vendors spread across the surface, as in the original.
    this.vendors = [
      { id: "fuel",   name: "PROPELLENT VENDOR 12000", short: "FUEL",     col: 4,  color: "#c8451f" },
      { id: "sell",   name: "MINERAL PROCESSOR 3000",  short: "SELL",     col: 10, color: "#2f7fbf" },
      { id: "shop",   name: "AUTOBUY 2000",            short: "UPGRADES", col: 16, color: "#3f8f4a" },
      { id: "repair", name: "EMENDATION STATION 3500", short: "REPAIR",   col: 22, color: "#8a5bbf" },
    ].map((v) => ({ ...v, x: (v.col + 0.5) * TILE, y: groundY, w: 5 * TILE }));

    // The Quantum Particle State Analyzer 6000: the game's actual save point,
    // a bot hovering above the Mineral Processor. XGen's own instructions say
    // "fly up to the hovering bot right above the mineral depot"; the wiki adds
    // that it preserves upgrades, items, cash and hull/fuel but resets score.
    const depot = this.vendors.find((v) => v.id === "sell");
    this.analyzer = {
      id: "analyzer",
      name: "QUANTUM PARTICLE STATE ANALYZER 6000",
      x: depot.x,
      y: groundY - 3.1 * TILE,
      r: 54,
    };
  }

  /** Is the pod inside the analyzer's field? */
  atAnalyzer(x, y) {
    const a = this.analyzer;
    if (!a) return false;
    return Math.hypot(x - a.x, y - a.y) < a.r;
  }

  /** The Martian Oilers craft: a flashing pod parked at about -500 ft. */
  placeOilers(rand) {
    const row = SURFACE_ROW + Math.round(500 / FEET_PER_TILE);
    const col = 3 + Math.floor((this.w - 6) * rand());
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) this.raw(col + dc, row + dr, T.AIR);
    }
    this.oilers = { x: (col + 0.5) * TILE, y: (row + 0.5) * TILE, taken: false };
  }

  vendorAt(x, y) {
    if (this.depthFtAt(y) > 24) return null;
    for (const v of this.vendors) {
      if (Math.abs(x - v.x) < v.w * 0.42) return v;
    }
    return null;
  }
}
