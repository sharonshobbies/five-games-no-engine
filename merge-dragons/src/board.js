// board.js -- the tile grid: land state (dead / super dead / healed), object
// occupancy, placement and neighbour queries.

import { def } from './registry.js';

export const DEAD = 0, SUPER = 1, LIVE = 2;

// Healing-power cost per tile. The wiki gives Super Dead Land a hidden 15,000
// requirement; ordinary dead land varies per level, so levels set their own base.
export const SUPER_COST = 15000;

let nextId = 1;

export class Obj {
  constructor(key, x, y) {
    const d = def(key);
    this.id = nextId++;
    this.key = key;
    this.d = d;
    this.x = x; this.y = y;
    this.w = d.size[0]; this.h = d.size[1];
    this.born = 0;              // sim time when created
    this.lastHarvest = 0;
    this.lastSpawn = 0;
    this.tapsLeft = d.taps || 0;
    this.pop = 0;               // merge/spawn pop animation 0..1
    this.bob = Math.random() * Math.PI * 2;
    this.dragging = false;
    this.dx = 0; this.dy = 0;   // pixel offset while dragging / flying
    this.fly = null;            // {fx,fy,tx,ty,t,dur} tween in tile space
    this.ready = false;         // harvest ready marker
    this.dragon = null;         // set by dragons.js for live dragons
    this.hidden = false;        // buried under dead land until healed
  }
  cells() {
    const out = [];
    for (let j = 0; j < this.h; j++) for (let i = 0; i < this.w; i++) out.push([this.x + i, this.y + j]);
    return out;
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
}

export class Board {
  constructor(cols, rows) {
    this.cols = cols; this.rows = rows;
    this.land = new Uint8Array(cols * rows);       // DEAD / SUPER / LIVE
    this.cost = new Float32Array(cols * rows);     // healing power remaining
    this.paid = new Float32Array(cols * rows);     // healing power applied so far
    this.playable = new Uint8Array(cols * rows).fill(1); // 0 = outside the level shape
    this.objs = [];
    this.grid = new Array(cols * rows).fill(null);   // cell -> item Obj
    // Dragons live on their own layer: in the real game they walk over objects,
    // so they must not be blocked by (or block) ordinary items. One dragon per
    // cell still, so dragons don't stack.
    this.dgrid = new Array(cols * rows).fill(null);
    this.landDirty = true;
    this.healedCount = 0;
    this.time = 0;
  }
  idx(x, y) { return y * this.cols + x; }
  inside(x, y) { return x >= 0 && y >= 0 && x < this.cols && y < this.rows; }
  isPlayable(x, y) { return this.inside(x, y) && this.playable[this.idx(x, y)] === 1; }
  landAt(x, y) { return this.inside(x, y) ? this.land[this.idx(x, y)] : DEAD; }
  isLive(x, y) { return this.landAt(x, y) === LIVE && this.isPlayable(x, y); }

  setLand(x, y, v, cost) {
    if (!this.inside(x, y)) return;
    const i = this.idx(x, y);
    this.land[i] = v;
    this.cost[i] = cost !== undefined ? cost : (v === SUPER ? SUPER_COST : v === DEAD ? 10 : 0);
    this.landDirty = true;
  }

  // --- occupancy -----------------------------------------------------------
  // A dragon standing on a tile is what the player means to grab, so it wins
  // the pick; the item underneath is still reachable through atItem().
  at(x, y) {
    if (!this.inside(x, y)) return null;
    const i = this.idx(x, y);
    return this.dgrid[i] || this.grid[i];
  }
  atItem(x, y) { return this.inside(x, y) ? this.grid[this.idx(x, y)] : null; }
  atDragon(x, y) { return this.inside(x, y) ? this.dgrid[this.idx(x, y)] : null; }
  layerOf(obj) { return obj.d && obj.d.dragon ? this.dgrid : this.grid; }

  fits(obj, x, y, ignore) {
    const layer = (obj.d && obj.d.dragon) ? this.dgrid : this.grid;
    for (let j = 0; j < obj.h; j++) {
      for (let i = 0; i < obj.w; i++) {
        const cx = x + i, cy = y + j;
        if (!this.isPlayable(cx, cy)) return false;
        const o = layer[this.idx(cx, cy)];
        if (o && o !== obj && o !== ignore) return false;
      }
    }
    return true;
  }
  // A cell an object may rest on: playable and (for most things) healed land.
  // Objects can sit on dead land (levels place them there); they just can't be
  // dropped onto it by the player.
  canDrop(obj, x, y) {
    if (!this.fits(obj, x, y, obj)) return false;
    for (let j = 0; j < obj.h; j++) {
      for (let i = 0; i < obj.w; i++) if (!this.isLive(x + i, y + j)) return false;
    }
    return true;
  }

  place(obj, x, y) {
    const layer = this.layerOf(obj);
    obj.x = x; obj.y = y;
    // Safety net. Writing over a cell another object still holds erases that
    // object from the grid: it stays in objs, alive and drawn, but neighbours()
    // and group() stop seeing it, which silently caps merge groups below 3.
    // Callers are supposed to land on a free cell (findFree with the right
    // layer, or canDrop); if one slips through, relocate the displaced object
    // instead of losing it, and count it so tests can assert this never fires.
    const displaced = new Set();
    for (const [cx, cy] of obj.cells()) {
      if (!this.inside(cx, cy)) continue;
      const cur = layer[this.idx(cx, cy)];
      if (cur && cur !== obj) displaced.add(cur);
    }
    for (const [cx, cy] of obj.cells()) if (this.inside(cx, cy)) layer[this.idx(cx, cy)] = obj;
    if (!this.objs.includes(obj)) this.objs.push(obj);
    for (const other of displaced) {
      this.displacedCount = (this.displacedCount || 0) + 1;
      // its old cells may be partly overwritten; clear whatever it still owns
      for (const [cx, cy] of other.cells()) {
        if (this.inside(cx, cy) && layer[this.idx(cx, cy)] === other) layer[this.idx(cx, cy)] = null;
      }
      const spot = this.findFree(other.x, other.y, other.w, other.h, 8, false, other);
      if (spot) {
        other.x = spot[0]; other.y = spot[1];
        for (const [cx, cy] of other.cells()) if (this.inside(cx, cy)) layer[this.idx(cx, cy)] = other;
      } else {
        // nowhere to go: drop it rather than leave a grid-invisible ghost
        const i = this.objs.indexOf(other);
        if (i >= 0) this.objs.splice(i, 1);
      }
    }
    return obj;
  }
  unplace(obj) {
    const layer = this.layerOf(obj);
    for (const [cx, cy] of obj.cells()) {
      if (this.inside(cx, cy) && layer[this.idx(cx, cy)] === obj) layer[this.idx(cx, cy)] = null;
    }
  }
  remove(obj) {
    this.unplace(obj);
    const i = this.objs.indexOf(obj);
    if (i >= 0) this.objs.splice(i, 1);
  }

  spawn(key, x, y) {
    const o = new Obj(key, x, y);
    o.born = this.time;
    o.pop = 1;
    this.place(o, x, y);
    return o;
  }

  // Which occupancy layer decides "is this cell taken" for a newcomer. The two
  // layers overlap by design (dragons walk over objects), so the answer depends
  // on which layer the newcomer will live on -- not on what is visible there.
  // Accepts an Obj, a def, or a key; null/undefined means an ordinary item.
  layerFor(what) {
    if (!what) return this.grid;
    const d = typeof what === 'string' ? def(what) : (what.d || what);
    return d && d.dragon ? this.dgrid : this.grid;
  }

  // Nearest free cell to (x,y) that an object of size w*h can occupy on live land.
  //
  // `forWhat` is the thing about to stand there (Obj, def or key). Omitting it
  // means "an ordinary item", which is the historical behaviour: an item only
  // cares about the item layer, since a dragon may legitimately stand over it.
  //
  // Passing it matters whenever the newcomer is a DRAGON. place() overwrites
  // whatever entry it finds in its own layer, so a dragon sent to a cell another
  // dragon already holds erases that dragon from the grid. The erased dragon
  // stays in objs -- alive, drawn, still attached -- but neighbours() and
  // group() can no longer see it, so a merge group silently caps below 3 and the
  // dragon chain dead-ends after its first merge.
  findFree(x, y, w = 1, h = 1, maxR = 9, requireLive = true, forWhat = null) {
    const layer = this.layerFor(forWhat);
    const tryCell = (cx, cy) => {
      if (cx < 0 || cy < 0 || cx + w > this.cols || cy + h > this.rows) return false;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if (!this.isPlayable(cx + i, cy + j)) return false;
        if (requireLive && !this.isLive(cx + i, cy + j)) return false;
        if (layer[this.idx(cx + i, cy + j)]) return false;
      }
      return true;
    };
    x = Math.round(x); y = Math.round(y);
    if (tryCell(x, y)) return [x, y];
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          if (tryCell(x + dx, y + dy)) return [x + dx, y + dy];
        }
      }
    }
    return null;
  }

  // 8-neighbour adjacency (Merge Dragons merges diagonals too). Both layers are
  // scanned so dragon-to-dragon and item-to-item merges both work.
  neighbours(obj) {
    const out = new Set();
    for (const [cx, cy] of obj.cells()) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const a = this.atItem(cx + dx, cy + dy);
          if (a && a !== obj) out.add(a);
          const b = this.atDragon(cx + dx, cy + dy);
          if (b && b !== obj) out.add(b);
        }
      }
    }
    return [...out];
  }

  // Connected group of identical objects containing `obj`.
  group(obj) {
    const seen = new Set([obj]);
    const stack = [obj];
    const out = [obj];
    while (stack.length) {
      const cur = stack.pop();
      for (const n of this.neighbours(cur)) {
        if (seen.has(n)) continue;
        if (n.key !== obj.key) continue;
        seen.add(n); stack.push(n); out.push(n);
      }
    }
    return out;
  }

  liveTiles() {
    let n = 0;
    for (let i = 0; i < this.land.length; i++) if (this.playable[i] && this.land[i] === LIVE) n++;
    return n;
  }
  deadTiles() {
    let n = 0;
    for (let i = 0; i < this.land.length; i++) if (this.playable[i] && this.land[i] !== LIVE) n++;
    return n;
  }
  totalTiles() {
    let n = 0;
    for (let i = 0; i < this.playable.length; i++) if (this.playable[i]) n++;
    return n;
  }

  countKey(key) { return this.objs.filter((o) => o.key === key).length; }
  countChainAtLeast(chain, idx) {
    return this.objs.filter((o) => o.d.chain === chain && o.d.idx >= idx).length;
  }
  maxTier(chain) {
    let m = -1;
    for (const o of this.objs) if (o.d.chain === chain) m = Math.max(m, o.d.idx);
    return m;
  }
}
