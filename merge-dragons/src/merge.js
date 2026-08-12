// merge.js -- merge resolution, the merge-5 bonus, chain-reaction combos and
// dead-land merging.
//
// Rules taken from the wiki's "Merging" page:
//  * a merge needs 3+ identical objects, actively brought together by a drag;
//  * 3 or 4 -> 1 object of the next level, 5 -> 2 objects ("always merge in 5s");
//  * merging objects that stand on dead land adjacent to healed land heals that
//    land for free -- the only route for Super Dead Land;
//  * chain reactions (combos) award bonus healing power / loot orbs;
//  * some merges emit by-products (life flowers emit Healing Power, graves emit
//    skulls & bones, fruit merges emit coins).

import { def, next, mergeYield, mergeSpare, isMergeable, CHAINS } from './registry.js';
import { LIVE } from './board.js';
import { applyHealing, forceHeal } from './heal.js';

/**
 * Attempt a merge on the group containing `seed`.
 * `fx` is the effects sink (see fx.js) so this stays free of rendering.
 * Returns null if nothing merged, else a report.
 */
export function tryMerge(game, seed, opts = {}) {
  const board = game.board;
  if (!seed || !isMergeable(seed.key)) return null;
  const group = board.group(seed);
  if (group.length < 3) return null;
  return resolveMerge(game, group, seed, opts.combo || 0);
}

function resolveMerge(game, group, anchor, combo) {
  const board = game.board;
  const d = anchor.d;
  const nd = next(anchor.key);
  if (!nd) return null;
  const n = group.length;
  const produced = mergeYield(n);
  if (produced < 1) return null;

  // --- dead-land merging: any dead tile the group stands on, that touches
  // healed land, is healed for free.
  const freeHeal = [];
  for (const o of group) {
    for (const [cx, cy] of o.cells()) {
      const i = board.idx(cx, cy);
      if (board.land[i] === LIVE) continue;
      let touches = false;
      for (let dy = -1; dy <= 1 && !touches; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          if (board.isLive(cx + dx, cy + dy)) { touches = true; break; }
        }
      }
      if (touches) freeHeal.push([cx, cy]);
    }
  }

  // anchor position: the dragged object's cell wins, like the real game
  const ax = anchor.x, ay = anchor.y;

  // remove the group
  const centre = [0, 0];
  for (const o of group) { centre[0] += o.cx; centre[1] += o.cy; }
  centre[0] /= n; centre[1] /= n;
  for (const o of group) {
    game.fx.merge(o, centre[0], centre[1], d);
    board.remove(o);
    if (o.dragon) game.dragons.release(o);
  }

  const healedFree = forceHeal(board, freeHeal);
  if (healedFree.length) game.fx.landHeal(healedFree, 'merge');

  // --- place the produced objects
  const made = [];
  const slots = [];
  const first = board.fits({ w: nd.size[0], h: nd.size[1], cells: () => [] }, ax, ay)
    ? [ax, ay] : board.findFree(ax, ay, nd.size[0], nd.size[1], 6, false);
  if (first) slots.push(first);
  while (slots.length < produced) {
    const s = board.findFree(centre[0] - 0.5, centre[1] - 0.5, nd.size[0], nd.size[1], 7, false);
    if (!s) break;
    // reserve by placing a stub later; use a temp marker to avoid duplicates
    if (slots.some(([sx, sy]) => sx === s[0] && sy === s[1])) {
      // nudge outward
      const s2 = board.findFree(centre[0] + 1.5, centre[1] + 1.5, nd.size[0], nd.size[1], 8, false);
      if (!s2 || slots.some(([sx, sy]) => sx === s2[0] && sy === s2[1])) break;
      slots.push(s2);
    } else slots.push(s);
    // temporarily occupy so findFree returns a different cell next round
    const tmp = board.spawn(nd.key, slots[slots.length - 1][0], slots[slots.length - 1][1]);
    made.push(tmp);
  }
  if (made.length === 0 && slots.length) {
    made.push(board.spawn(nd.key, slots[0][0], slots[0][1]));
  } else if (made.length < slots.length) {
    made.push(board.spawn(nd.key, slots[0][0], slots[0][1]));
  }
  // if slot-reservation produced fewer than expected, top up around the anchor
  while (made.length < produced) {
    const s = board.findFree(ax, ay, nd.size[0], nd.size[1], 9, false);
    if (!s) break;
    made.push(board.spawn(nd.key, s[0], s[1]));
  }
  for (const m of made) { m.pop = 1; m.born = board.time; }

  // --- the ejected spare ---------------------------------------------------
  // A merge only ever spends 5 inputs per two outputs (or 3 for an odd one);
  // an input the merge could not spend is handed back rather than eaten. The
  // wiki's table calls it "Ejected X"; a 4-merge is its clearest case.
  const ejected = [];
  for (let k = 0; k < mergeSpare(n); k++) {
    const s = board.findFree(ax, ay, d.size[0], d.size[1], 7, false);
    if (!s) break;
    const back = board.spawn(anchor.key, s[0], s[1]);
    back.pop = 1;
    back.born = board.time;
    // A dragon handed back is a live dragon again, not a statue.
    if (back.d.dragon) game.dragons.attach(back);
    ejected.push(back);
    game.fx.eject(back);
  }

  // --- by-products ---------------------------------------------------------
  const byproducts = [];
  const emit = (key, x, y) => {
    const s = board.findFree(x, y, 1, 1, 5, false);
    if (!s) return;
    const o = board.spawn(key, s[0], s[1]);
    o.pop = 1;
    byproducts.push(o);
    game.fx.spawnBurst(o);
  };

  // Merging Life Flowers / Prism Flowers / high Dragon Trees releases Healing Power.
  let healPower = d.heal || 0;
  if (combo > 0) healPower += 4 * combo * (1 + d.idx);

  // Graves emit skulls/bones -> we express that as Life Flower Seeds + a grave-line
  if (d.chain === 'grave' && Math.random() < 0.8) emit('lifeFlower:0', ax, ay);
  // Fruit-tree merges create Magic Coins (wiki: "Merging Fruits creates Magic Coins")
  if (d.chain === 'fruitTree' && d.idx >= 3 && Math.random() < 0.7) emit(`coin:${Math.min(3, Math.floor(d.idx / 3))}`, ax, ay);
  // Dragon Tree merges of L2+ may create Glowing Dragon Trees -> stand-in: essence
  if (d.chain === 'dragonTree' && d.idx >= 3 && Math.random() < 0.35) emit('essence:0', ax, ay);
  // Mushroom merges create Mushroom Caps
  if (d.chain === 'mushroom' && d.idx >= 4 && Math.random() < 0.5) emit('mushroom:0', ax, ay);
  // Wonder creation also drops one object of the previous level
  if (nd.wonder) {
    emit(d.key, ax, ay);
    game.fx.banner(`Wonder created: ${nd.name}!`, 'wonder');
    game.onWonder && game.onWonder(nd);
  }
  // Goal Star merges drop a Treasure Chest
  if (d.chain === 'star' && Math.random() < 0.8) emit(`chest:${Math.min(6, d.idx)}`, ax, ay);
  // Dragon level-4 merge creates a Nest (already the next chain entry) -- announce
  if (d.dragon && nd.nest) game.fx.banner(`${nd.name}!`, 'nest');

  if (healPower > 0) {
    const res = applyHealing(board, healPower, centre[0], centre[1]);
    game.fx.healPower(centre[0], centre[1], healPower);
    if (res.healed.length) game.fx.landHeal(res.healed, 'power');
  }

  game.fx.mergePop(made, n, combo);
  game.audio.merge(d.idx, n >= 5, combo);
  game.stats.merges++;
  if (n >= 5) game.stats.merge5++;
  game.onMerge && game.onMerge(d, nd, n, made);

  // --- chain reaction ------------------------------------------------------
  const report = {
    def: d, nextDef: nd, count: n, produced: made.length, combo, made, byproducts,
    ejected, spare: ejected.length,
  };
  for (const m of made) {
    if (!m.d || !isMergeable(m.key)) continue;
    if (!board.objs.includes(m)) continue;
    const g2 = board.group(m);
    if (g2.length >= 3) {
      const sub = resolveMerge(game, g2, m, combo + 1);
      if (sub) {
        report.chained = sub;
        if (combo + 1 >= 1) game.fx.combo(combo + 2, m.cx, m.cy);
        break;
      }
    }
  }
  // combo bonus: a loot orb the player can drag and pop
  if (report.chained && board.deadTiles() > 0) {
    const s = board.findFree(ax, ay, 1, 1, 6, true);
    if (s) {
      const orb = board.spawn(`lifeOrb:${Math.min(5, 1 + combo)}`, s[0], s[1]);
      orb.pop = 1;
      game.fx.spawnBurst(orb);
    }
  }
  return report;
}

/** Would dropping `obj` at (x,y) merge? Returns the group it would form. */
export function previewGroup(board, obj, x, y) {
  if (!isMergeable(obj.key)) return [];
  const ox = obj.x, oy = obj.y;
  board.unplace(obj);
  obj.x = x; obj.y = y;
  const seen = new Set([obj]);
  const stack = [obj];
  const out = [obj];
  while (stack.length) {
    const cur = stack.pop();
    const cells = cur === obj
      ? (() => { const a = []; for (let j = 0; j < obj.h; j++) for (let i = 0; i < obj.w; i++) a.push([x + i, y + j]); return a; })()
      : cur.cells();
    for (const [cx, cy] of cells) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (!dx && !dy) continue;
          const o = board.at(cx + dx, cy + dy);
          if (!o || seen.has(o) || o.key !== obj.key) continue;
          seen.add(o); stack.push(o); out.push(o);
        }
      }
    }
  }
  obj.x = ox; obj.y = oy;
  board.place(obj, ox, oy);
  return out;
}
