// Uniform spatial hash over the arena's bounding square.
//
// Brute force is out: ~30 snakes plus the player put 6-10k body nodes in the
// world and every head has to be tested against all of them every frame, which
// is ~300k pair tests. The grid turns that into ~9 cell walks per head.
//
// The buckets are singly-linked lists inside two Int32Arrays, so a full rebuild
// each frame allocates nothing: clear() is one typed-array fill.

export class SpatialGrid {
  /**
   * @param {number} half   half-extent of the covered square, centred on origin
   * @param {number} cell   cell edge length in world units
   * @param {number} maxItems capacity
   */
  constructor(half, cell, maxItems) {
    this.half = half;
    this.cell = cell;
    this.cols = Math.ceil((half * 2) / cell) + 1;
    this.cellHead = new Int32Array(this.cols * this.cols);
    this.nextIdx = new Int32Array(maxItems);
    this.x = new Float32Array(maxItems);
    this.y = new Float32Array(maxItems);
    this.r = new Float32Array(maxItems);
    this.tag = new Int32Array(maxItems); // owner id (snake index, food index...)
    this.max = maxItems;
    this.count = 0;
    this.cellHead.fill(-1);
  }

  clear() {
    this.cellHead.fill(-1);
    this.count = 0;
  }

  col(v) {
    const c = ((v + this.half) / this.cell) | 0;
    return c < 0 ? 0 : c >= this.cols ? this.cols - 1 : c;
  }

  /** @returns {number} slot index, or -1 if full */
  insert(x, y, r, tag) {
    const i = this.count;
    if (i >= this.max) return -1;
    this.count++;
    this.x[i] = x;
    this.y[i] = y;
    this.r[i] = r;
    this.tag[i] = tag;
    const ci = this.col(y) * this.cols + this.col(x);
    this.nextIdx[i] = this.cellHead[ci];
    this.cellHead[ci] = i;
    return i;
  }

  /**
   * Visit every item whose cell overlaps the query circle. `fn(slot)` may
   * return true to stop the walk early.
   */
  forEachNear(x, y, r, fn) {
    const c0 = this.col(x - r);
    const c1 = this.col(x + r);
    const r0 = this.col(y - r);
    const r1 = this.col(y + r);
    const cols = this.cols;
    const head = this.cellHead;
    const next = this.nextIdx;
    for (let cy = r0; cy <= r1; cy++) {
      const rowBase = cy * cols;
      for (let cx = c0; cx <= c1; cx++) {
        let i = head[rowBase + cx];
        while (i !== -1) {
          if (fn(i) === true) return;
          i = next[i];
        }
      }
    }
  }

  /**
   * Nearest item to (x,y) within `r`, ignoring items whose tag is `skipTag`.
   * @returns {number} slot index or -1
   */
  nearest(x, y, r, skipTag = -1) {
    let best = -1;
    let bestD = r * r;
    const gx = this.x;
    const gy = this.y;
    this.forEachNear(x, y, r, (i) => {
      if (this.tag[i] === skipTag) return;
      const dx = gx[i] - x;
      const dy = gy[i] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    return best;
  }
}
