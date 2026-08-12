// Navigation: one Dijkstra flow field over a coarse grid, recomputed only when
// the set of blocking structures changes. Walls are not impassable, they are
// expensive — so attackers naturally funnel through gaps and gates, and only
// smash a wall when going around would cost more than going through.

const DIRS = [
  [1, 0], [-1, 0], [0, 1], [0, -1],
  [1, 1], [1, -1], [-1, 1], [-1, -1],
];
const DCOST = [1, 1, 1, 1, 1.4142, 1.4142, 1.4142, 1.4142];

class Heap {
  constructor() { this.a = []; this.k = []; }
  get size() { return this.a.length; }
  push(v, key) {
    this.a.push(v); this.k.push(key);
    let i = this.a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.k[p] <= this.k[i]) break;
      this.swap(p, i); i = p;
    }
  }
  swap(i, j) {
    const t = this.a[i]; this.a[i] = this.a[j]; this.a[j] = t;
    const u = this.k[i]; this.k[i] = this.k[j]; this.k[j] = u;
  }
  pop() {
    const top = this.a[0], n = this.a.length - 1;
    this.a[0] = this.a[n]; this.k[0] = this.k[n];
    this.a.pop(); this.k.pop();
    let i = 0;
    for (;;) {
      const l = i * 2 + 1, r = l + 1;
      let s = i;
      if (l < n && this.k[l] < this.k[s]) s = l;
      if (r < n && this.k[r] < this.k[s]) s = r;
      if (s === i) break;
      this.swap(s, i); i = s;
    }
    return top;
  }
}

export class NavGrid {
  constructor(level) {
    this.level = level;
    this.step = 2.0;
    this.min = -(level.radius + 6);
    this.n = Math.ceil((-this.min * 2) / this.step) + 1;
    const n = this.n;
    this.terrain = new Float32Array(n * n);   // static walk cost, Infinity = water
    this.deck = new Uint8Array(n * n);        // 1 = a built bridge carries this cell
    this.block = new Int32Array(n * n).fill(-1); // plot id occupying the cell
    this.cost = new Float32Array(n * n);
    this.dist = new Float32Array(n * n);
    this.fx = new Float32Array(n * n);
    this.fz = new Float32Array(n * n);
    this.bakeTerrain();
    this.dirty = true;
  }
  idx(i, j) { return j * this.n + i; }
  toCell(x, z) {
    return [Math.round((x - this.min) / this.step), Math.round((z - this.min) / this.step)];
  }
  cellCenter(i, j) { return [this.min + i * this.step, this.min + j * this.step]; }

  bakeTerrain() {
    const { n, step, min } = this;
    const L = this.level;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const x = min + i * step, z = min + j * step;
        const h = L.sampleHeight(x, z);
        let c = 1;
        if (h < 0.55) c = Infinity;
        else {
          const hx = L.sampleHeight(x + step, z) - L.sampleHeight(x - step, z);
          const hz = L.sampleHeight(x, z + step) - L.sampleHeight(x, z - step);
          const slope = Math.hypot(hx, hz) / (step * 2);
          if (slope > 1.15) c = Infinity;
          else c = 1 + slope * 5;
        }
        this.terrain[this.idx(i, j)] = c;
      }
    }
  }

  /**
   * Stamp bridge decks: cells that water made impassable but a built span now
   * carries. Everything — your troops, the king, the enemy — uses the deck.
   */
  setDecks(decks) {
    this.deck.fill(0);
    for (const d of decks) {
      const steps = Math.ceil((d.halfL * 2) / (this.step * 0.5));
      for (let s = 0; s <= steps; s++) {
        const t = -d.halfL + (s / steps) * d.halfL * 2;
        for (let w = -d.halfW; w <= d.halfW; w += this.step * 0.5) {
          const x = d.x + d.c * t - d.s * w;
          const z = d.z + d.s * t + d.c * w;
          const [i, j] = this.toCell(x, z);
          if (i < 0 || j < 0 || i >= this.n || j >= this.n) continue;
          this.deck[this.idx(i, j)] = 1;
        }
      }
    }
    this.dirty = true;
  }

  /** Stamp blocking structures. plots = array of live plots with .blocks */
  setBlockers(plots) {
    this.block.fill(-1);
    for (const p of plots) {
      if (!p.building || p.dead || !p.building.stats.blocks) continue;
      const half = p.kind === 'wall' || p.kind === 'gate'
        ? { l: (p.segLen || 8) / 2, w: 1.1 } : { l: 2.4, w: 2.4 };
      const cs = Math.cos(p.rot), sn = Math.sin(p.rot);
      const steps = Math.ceil((half.l * 2) / (this.step * 0.5));
      for (let s = 0; s <= steps; s++) {
        const t = -half.l + (s / steps) * half.l * 2;
        for (let w = -half.w; w <= half.w; w += this.step * 0.5) {
          const x = p.x + cs * t - sn * w;
          const z = p.z + sn * t + cs * w;
          const [i, j] = this.toCell(x, z);
          if (i < 0 || j < 0 || i >= this.n || j >= this.n) continue;
          this.block[this.idx(i, j)] = p.id;
        }
      }
    }
    this.dirty = true;
  }

  compute(tx, tz) {
    const { n } = this;
    const dist = this.dist, cost = this.cost;
    for (let k = 0; k < n * n; k++) {
      let t = this.terrain[k];
      if (t === Infinity && this.deck[k]) t = 1.2;   // a bridge carries the cell
      cost[k] = t === Infinity ? Infinity : (this.block[k] >= 0 ? t + 34 : t);
      dist[k] = Infinity;
    }
    const [ti, tj] = this.toCell(tx, tz);
    const start = this.idx(Math.max(0, Math.min(n - 1, ti)), Math.max(0, Math.min(n - 1, tj)));
    const heap = new Heap();
    dist[start] = 0;
    heap.push(start, 0);
    while (heap.size) {
      const cur = heap.pop();
      const d = dist[cur];
      const ci = cur % n, cj = (cur - ci) / n;
      for (let k = 0; k < 8; k++) {
        const ni = ci + DIRS[k][0], nj = cj + DIRS[k][1];
        if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
        const nk = this.idx(ni, nj);
        const c = cost[nk];
        if (c === Infinity) continue;
        const nd = d + c * DCOST[k];
        if (nd < dist[nk] - 1e-6) { dist[nk] = nd; heap.push(nk, nd); }
      }
    }
    // gradient
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        const k = this.idx(i, j);
        if (dist[k] === Infinity) { this.fx[k] = 0; this.fz[k] = 0; continue; }
        let best = dist[k], bi = 0, bj = 0;
        for (let d = 0; d < 8; d++) {
          const ni = i + DIRS[d][0], nj = j + DIRS[d][1];
          if (ni < 0 || nj < 0 || ni >= n || nj >= n) continue;
          const nk = this.idx(ni, nj);
          if (dist[nk] < best) { best = dist[nk]; bi = DIRS[d][0]; bj = DIRS[d][1]; }
        }
        const l = Math.hypot(bi, bj) || 1;
        this.fx[k] = bi / l; this.fz[k] = bj / l;
      }
    }
    this.dirty = false;
  }

  /** Flow direction at a world position; falls back to straight-to-target. */
  flowAt(x, z, out) {
    const [i, j] = this.toCell(x, z);
    if (i < 1 || j < 1 || i >= this.n - 1 || j >= this.n - 1) { out[0] = 0; out[1] = 0; return false; }
    const k = this.idx(i, j);
    out[0] = this.fx[k]; out[1] = this.fz[k];
    return !(out[0] === 0 && out[1] === 0);
  }

  /** Which structure sits in the cell one step ahead, if any. */
  blockerAhead(x, z, dx, dz) {
    const [i, j] = this.toCell(x + dx * this.step * 1.1, z + dz * this.step * 1.1);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return this.block[this.idx(i, j)];
  }

  distAt(x, z) {
    const [i, j] = this.toCell(x, z);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return Infinity;
    return this.dist[this.idx(i, j)];
  }
}

// --- cheap uniform-grid neighbour lookup for unit separation and targeting --
export class SpatialHash {
  constructor(cell = 4) { this.cell = cell; this.map = new Map(); }
  clear() { this.map.clear(); }
  key(x, z) { return ((Math.floor(x / this.cell) + 4096) << 13) | (Math.floor(z / this.cell) + 4096); }
  insert(obj) {
    const k = this.key(obj.x, obj.z);
    let a = this.map.get(k);
    if (!a) { a = []; this.map.set(k, a); }
    a.push(obj);
  }
  query(x, z, r, out) {
    out.length = 0;
    const c = this.cell;
    const i0 = Math.floor((x - r) / c), i1 = Math.floor((x + r) / c);
    const j0 = Math.floor((z - r) / c), j1 = Math.floor((z + r) / c);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const a = this.map.get(((i + 4096) << 13) | (j + 4096));
        if (!a) continue;
        for (let n = 0; n < a.length; n++) out.push(a[n]);
      }
    }
    return out;
  }
}
