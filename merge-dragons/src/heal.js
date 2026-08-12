// heal.js -- Healing Power and Dead Land.
//
// Per the wiki: healing power cannot be targeted by the player but "prioritizes
// nearby tiles". It is released by activating Life Orbs, tapping Prism Flowers,
// merging Life Flowers / Prism Flowers / high Dragon Trees, and by merge combos.
// Super Dead Land officially cannot be healed by healing power (its hidden cost
// is 15,000 per tile) -- it is cleared by merging objects off it.

import { LIVE, DEAD } from './board.js';

// Dead tiles touching healed land, nearest to (ox,oy) first.
function frontier(board, ox, oy) {
  const out = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const i = board.idx(x, y);
      if (!board.playable[i] || board.land[i] === LIVE) continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (board.isLive(x + dx, y + dy)) { touches = true; break; }
        }
      }
      if (!touches) continue;
      const d = Math.hypot(x + 0.5 - ox, y + 0.5 - oy);
      out.push({ x, y, i, d });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out;
}

/**
 * Pour `amount` healing power into the board starting near (ox,oy).
 * Returns {healed:[[x,y]...], spent, partial:[{x,y,frac}]}
 */
export function applyHealing(board, amount, ox, oy) {
  const healed = [];
  let left = amount;
  let guard = 0;
  while (left > 0.0001 && guard++ < 400) {
    const f = frontier(board, ox, oy);
    if (!f.length) break;
    let progressed = false;
    for (const t of f) {
      if (left <= 0.0001) break;
      const need = board.cost[t.i] - board.paid[t.i];
      if (need <= left) {
        left -= Math.max(0, need);
        board.paid[t.i] = board.cost[t.i];
        board.land[t.i] = LIVE;
        board.landDirty = true;
        healed.push([t.x, t.y]);
        progressed = true;
      } else {
        board.paid[t.i] += left;
        left = 0;
      }
    }
    if (!progressed) break;
  }
  return { healed, spent: amount - left };
}

/** Free-heal specific tiles (dead-land merging, heal extenders, goddesses). */
export function forceHeal(board, cells) {
  const healed = [];
  for (const [x, y] of cells) {
    if (!board.inside(x, y)) continue;
    const i = board.idx(x, y);
    if (!board.playable[i] || board.land[i] === LIVE) continue;
    board.land[i] = LIVE;
    board.paid[i] = board.cost[i];
    board.landDirty = true;
    healed.push([x, y]);
  }
  return healed;
}

export function tileProgress(board, x, y) {
  const i = board.idx(x, y);
  if (board.land[i] === LIVE) return 1;
  const c = board.cost[i];
  return c <= 0 ? 0 : Math.min(1, board.paid[i] / c);
}
