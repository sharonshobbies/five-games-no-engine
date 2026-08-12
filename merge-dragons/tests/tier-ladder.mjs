// Reproduces the player's report: "I can merge 3 level 1 things, but not 3
// level 2 things." Walks each chain seeded by the starting levels from tier 1
// to its declared top tier THROUGH THE REAL DRAG PATH (game.drop), asserting
// every rung yields the next one.
import { chromium } from '/Users/sharon.gao/Downloads/claude-code-test-benchmark/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/Users/sharon.gao/Downloads/claude-code-test-merge-dragons';
const srv = http.createServer((q, r) => {
  let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': p.endsWith('.js') ? 'text/javascript' : 'text/html' });
    r.end(d);
  });
});
await new Promise((r) => srv.listen(8799, r));
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
pg.on('pageerror', (e) => errs.push(e.message));
pg.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await pg.goto('http://localhost:8799/?level=15', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1500);

const R = await pg.evaluate(async () => {
  const g = window.__game, B = g.board;
  const heal = await import('./src/heal.js');
  const reg = await import('./src/registry.js');
  const lv = await import('./src/levels.js');
  const all = [];
  for (let y = 0; y < B.rows; y++) for (let x = 0; x < B.cols; x++) if (B.playable[B.idx(x, y)]) all.push([x, y]);
  heal.forceHeal(B, all);

  const wipe = () => { for (const o of [...B.objs]) { if (o.dragon) g.dragons.release(o); B.remove(o); } };

  // One rung: 3 identical `key` merged through the real drop path.
  // Returns the key actually produced, or a diagnostic string.
  const rung = (key) => {
    wipe();
    const d = reg.def(key);
    if (!d) return { err: 'no def' };
    const [w, h] = d.size;
    // lay the three out in a row, spaced by the object footprint
    const y0 = 2;
    const a = B.spawn(key, 2, y0);
    const c = B.spawn(key, 2 + w, y0);
    const mover = B.spawn(key, 2 + 2 * w, y0 + h + 2);   // parked away
    let seen = null;
    const prev = g.onMerge;
    g.onMerge = (dd, nd, cnt, made) => { if (!seen) seen = { cnt, made: made.map((m) => m.key) }; prev && prev(dd, nd, cnt, made); };
    g.drop(mover, 2 + 2 * w, y0, [2 + 2 * w, y0 + h + 2]);
    g.onMerge = prev;
    if (!seen) {
      return {
        err: 'no merge fired',
        mergeable: reg.isMergeable(key),
        next: reg.next(key) ? reg.next(key).key : null,
        standing: B.objs.filter((o) => o.key === key).length,
        groupOfA: B.objs.includes(a) ? B.group(a).length : -1,
      };
    }
    return { made: seen.made, cnt: seen.cnt };
  };

  // --- the player's actual sequence -----------------------------------------
  // Three tier-i objects that are THEMSELVES merge outputs, dragged together.
  // A produced object must be indistinguishable from a placed one to the group
  // scan; if it is not, this dies at whatever tier the difference shows up.
  // A free cell for THIS object's own layer. board.findFree() deliberately only
  // consults the item layer, so the test must not use it to park a dragon --
  // otherwise the test itself stacks two dragons on one cell and we would be
  // measuring our own bug instead of the game's.
  const freeFor = (obj, x, y, maxR, banned) => {
    const layer = obj.d && obj.d.dragon ? B.dgrid : B.grid;
    const w = obj.w, h = obj.h;
    const tryCell = (cx, cy) => {
      if (cx < 0 || cy < 0 || cx + w > B.cols || cy + h > B.rows) return false;
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        if (!B.isPlayable(cx + i, cy + j)) return false;
        const cur = layer[B.idx(cx + i, cy + j)];
        if (cur && cur !== obj) return false;
        if (banned && banned.has(`${cx + i},${cy + j}`)) return false;
      }
      return true;
    };
    x = Math.round(x); y = Math.round(y);
    if (tryCell(x, y)) return [x, y];
    for (let r = 1; r <= (maxR || 20); r++) {
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        if (tryCell(x + dx, y + dy)) return [x + dx, y + dy];
      }
    }
    return null;
  };
  const halo = (objs) => {
    const s = new Set();
    for (const k of objs) {
      if (!k || !B.objs.includes(k)) continue;
      for (const [cx, cy] of k.cells()) {
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) s.add(`${cx + dx},${cy + dy}`);
      }
    }
    return s;
  };

  // Capture the merge outputs of one drop.
  const withOutputs = (fn) => {
    let out = null;
    const prev = g.onMerge;
    g.onMerge = (dd, nd, cnt, made) => { if (!out) out = made.slice(); prev && prev(dd, nd, cnt, made); };
    fn();
    g.onMerge = prev;
    return out;
  };

  // Merge three freshly spawned `key` in a scratch corner and return the output
  // object, parked out of the way (`keep` are the objects it must not touch).
  // A row of three side-by-side footprints, all free on `key`'s layer. This is
  // the "vault": where the three produced objects are gathered.
  const findVault = (key) => {
    const d = reg.def(key);
    const w = d.size[0], h = d.size[1];
    const proto = { d, w, h, cells: () => [] };
    const fits = (x, y) => {
      const s = freeFor(proto, x, y, 0, null);
      return !!s;
    };
    for (let y = 0; y + h <= B.rows; y++) {
      for (let x = 0; x + 3 * w <= B.cols; x++) {
        if (fits(x, y) && fits(x + w, y) && fits(x + 2 * w, y)) {
          return [[x, y], [x + w, y], [x + 2 * w, y]];
        }
      }
    }
    return null;
  };

  // Merge three freshly spawned `key` somewhere clear of `ban`, and return the
  // produced object (still wherever the game put it).
  const produceOne = (key, ban) => {
    const d = reg.def(key);
    const proto = { d, w: d.size[0], h: d.size[1], cells: () => [] };
    const a0 = freeFor(proto, Math.floor(B.cols / 2), B.rows - 1 - proto.h, 24, ban);
    if (!a0) return null;
    const a = B.spawn(key, a0[0], a0[1]);
    const ban2 = new Set(ban || []);
    const a1 = freeFor(proto, a0[0] + proto.w, a0[1], 4, ban2);
    if (!a1) { B.remove(a); return null; }
    const bb = B.spawn(key, a1[0], a1[1]);
    const park = freeFor(proto, 0, 0, 24, ban2);
    if (!park) { B.remove(a); B.remove(bb); return null; }
    const mover = B.spawn(key, park[0], park[1]);
    const out = withOutputs(() => g.drop(mover, a1[0], a1[1], park));
    if (!out || !out.length) {
      for (const o of [a, bb, mover]) if (B.objs.includes(o)) B.remove(o);
      return null;
    }
    // Clear the whole scratch area: the lower tier's leftovers AND every
    // by-product the merge threw off (a Gaia Statue blooms 9 Life Flowers, a
    // fruit merge drops Magic Coins). Left in place these crowd the board out
    // and the next production fails for want of space, which would read as a
    // merge failure. Everything the caller is holding is kept.
    const keep = new Set([out[0], ...(window.__held || [])]);
    for (const o of [...B.objs]) {
      if (keep.has(o)) continue;
      if (o.dragon) g.dragons.release(o);
      B.remove(o);
    }
    return out[0];
  };

  const cascade = (cid, startIdx, endIdx) => {
    const c = reg.CHAINS[cid];
    const rows = [];
    for (let i = startIdx + 1; i <= endIdx; i++) {
      const it = c.items[i];
      if (it.unmergeable) break;
      const key = `${cid}:${i}`;
      const want = `${cid}:${i + 1}`;
      wipe();
      const vault = findVault(key);
      if (!vault) { rows.push({ i, want, got: null, ok: false, diag: { err: 'no vault' } }); return { rows }; }
      const vaultBan = (() => {
        const s = new Set();
        for (const [vx, vy] of vault) {
          for (let j = -1; j <= it.size[1]; j++) for (let k = -1; k <= it.size[0]; k++) s.add(`${vx + k},${vy + j}`);
        }
        return s;
      })();
      // three genuine merge OUTPUTS of tier i, gathered in the vault
      const held = [];
      window.__held = held;               // produceOne must not sweep these away
      let bail = null;
      for (let k = 0; k < 3; k++) {
        const o = produceOne(`${cid}:${i - 1}`, vaultBan);
        if (!o) { bail = `could not produce ${key} (#${k + 1} of 3)`; break; }
        if (o.key !== key) { bail = `producing ${key} gave ${o.key}`; break; }
        B.unplace(o);
        if (k < 2) B.place(o, vault[k][0], vault[k][1]);
        else {
          // the third stays off to the side and is DRAGGED in, the real path
          const s = freeFor(o, 0, 0, 24, vaultBan);
          if (!s) { bail = 'nowhere to stage the mover'; break; }
          B.place(o, s[0], s[1]);
        }
        held.push(o);
      }
      if (bail) { rows.push({ i, want, got: null, ok: false, diag: { err: bail } }); return { rows }; }
      const [A, Bo, C] = held;
      const before = {
        group: B.group(A).length,
        at: [[A.x, A.y], [Bo.x, Bo.y], [C.x, C.y]],
        distinct: new Set(held.map((o) => o.id)).size,
      };
      const out = withOutputs(() => g.drop(C, vault[1][0], vault[1][1], [C.x, C.y]));
      const got = out && out.length ? out[0].key : null;
      const ok = got === want;
      rows.push({ i, want, got, ok,
        diag: ok ? null : {
          before,
          mergeable: reg.isMergeable(key),
          next: reg.next(key) ? reg.next(key).key : null,
          groupAfter: B.objs.includes(A) ? B.group(A).length : -1,
          standing: B.objs.filter((o) => o.key === key).map((o) => [o.x, o.y]),
          onGrid: held.map((o) => {
            const layer = o.d.dragon ? B.dgrid : B.grid;
            return B.objs.includes(o) && layer[B.idx(o.x, o.y)] === o;
          }),
        } });
      if (!ok) return { rows };
    }
    return { rows };
  };

  // Which chains do the starting levels seed?
  const seeded = new Set();
  const levels = lv.LEVELS || lv.default || [];
  for (const L of levels.slice(0, 6)) {
    const src = JSON.stringify(L);
    for (const m of src.matchAll(/"([a-zA-Z]+):(\d+)"/g)) seeded.add(m[1]);
  }

  // Walk every seeded chain tier 1 -> top.
  const report = [];
  for (const cid of [...seeded].sort()) {
    const c = reg.CHAINS[cid];
    if (!c) continue;
    const rows = [];
    let depth = 0, broke = false;
    for (let i = 0; i < c.items.length - 1; i++) {
      const it = c.items[i];
      // Nests are tap-to-hatch containers and never merge (wiki) -- skip them,
      // they are not a rung. Anything else declared unmergeable is likewise a
      // deliberate terminal (obstacles, loot orbs).
      if (it.unmergeable) { if (!broke) depth = i + 1; continue; }
      const key = `${cid}:${i}`;
      const want = `${cid}:${i + 1}`;
      const r = rung(key);
      const got = r.made ? r.made[0] : null;
      const ok = got === want;
      rows.push({ i, want, got, ok, err: r.err, info: r });
      if (!ok) { broke = true; continue; }
      if (!broke) depth = i + 1;
    }
    // The player's own sequence: cascade from merge OUTPUTS, not placed objects.
    // A chain can be split by a tap-to-hatch gate (a dragon nest), which is not
    // a merge rung -- so cascade each contiguous mergeable run on its own.
    // A "source" is an index that can be merged UP: mergeable, and with a tier
    // above it. Contiguous sources form a run; a run of length n covers n-1
    // produced-cascade rungs, because its first tier has to be produced from
    // spawned objects to get the cascade started.
    const isSource = (i) => i <= c.items.length - 2 && !c.items[i].unmergeable;
    const runs = [];
    for (let i = 0; i <= c.items.length - 2; i++) {
      if (!isSource(i)) continue;
      let j = i;
      while (isSource(j + 1)) j++;
      if (j > i) runs.push([i, j]);
      i = j;
    }
    const cascRows = [];
    let cascErr = null;
    for (const [s, e] of runs) {
      const r = cascade(cid, s, e);
      cascRows.push(...r.rows);
      if (r.err && !cascErr) cascErr = r.err;
    }
    report.push({ cid, len: c.items.length, depth, rows, runs,
      casc: { rows: cascRows, err: cascErr } });
  }
  return { report, seeded: [...seeded], displaced: B.displacedCount || 0 };
});

// --- the player's literal action, through real mouse events -----------------
// Merge 3 dragon eggs into a Whelp three times over, then drag the three Whelps
// together with the actual pointer. This is the sequence in the bug report.
//
// On a fresh page: the cascade above makes hundreds of merges, which completes
// the level's quests, opens the level-complete modal and disables input.
await pg.goto('http://localhost:8799/?level=15', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1500);
const stage = await pg.evaluate(async () => {
  const g = window.__game, B = g.board;
  const heal = await import('./src/heal.js');
  const all = [];
  for (let y = 0; y < B.rows; y++) for (let x = 0; x < B.cols; x++) if (B.playable[B.idx(x, y)]) all.push([x, y]);
  heal.forceHeal(B, all);
  for (const o of [...B.objs]) { if (o.dragon) g.dragons.release(o); B.remove(o); }
  // three eggs -> one Whelp, three times, each Whelp parked in a row
  const made = [];
  for (let k = 0; k < 3; k++) {
    const y = 8;
    const a = B.spawn('grassd:1', 2, y), b2 = B.spawn('grassd:1', 3, y);
    const m = B.spawn('grassd:1', 2, y + 2);
    g.drop(m, 3, y, [2, y + 2]);
    const w = B.objs.find((o) => o.key === 'grassd:2' && !made.includes(o));
    if (!w) return { err: `egg merge ${k} produced no whelp` };
    B.unplace(w); B.place(w, 2 + k * (k === 2 ? 4 : 1), 3);
    made.push(w);
    for (const o of [...B.objs]) if (o.key === 'grassd:1') B.remove(o);
  }
  // Freeze dragon autonomy for the duration of the drag: a wandering dragon
  // would move out from under the cursor and the test would measure that
  // instead of the merge. Everything else keeps ticking.
  g.dragons.update = () => {};
  // centre the camera so all three whelps are comfortably on screen
  g.render.cam.x = g.render.cam.tx = B.cols / 2;
  g.render.cam.y = g.render.cam.ty = B.rows / 2;
  window.__whelps = made;
  return { whelps: made.map((o) => [o.x, o.y]), kinds: made.map((o) => o.key) };
});
if (stage.err) { console.log('STAGING FAILED:', stage.err); }
// Let the camera lerp settle before reading screen coordinates -- reading them
// in the same turn as the pan gives stale pixels and the drag misses.
await pg.waitForTimeout(500);
const pts = stage.err ? null : await pg.evaluate(() => {
  const g = window.__game, m = window.__whelps;
  g.render.cam.zoom = g.render.cam.tz;
  // Ask the game's OWN hit-test where each whelp is pickable, rather than
  // trusting t2s to still match after a camera lerp. Nudge around the nominal
  // centre until objAt() actually returns the object we mean to grab.
  const pointOn = (o) => {
    const [cx, cy] = g.render.t2s(o.x + 0.5, o.y + 0.5);
    for (let r = 0; r <= 40; r += 4) {
      for (const [dx, dy] of [[0, 0], [0, r], [0, -r], [r, 0], [-r, 0]]) {
        const px = cx + dx, py = cy + dy;
        if (px < 0 || py < 0 || px > g.canvas.clientWidth || py > g.canvas.clientHeight) continue;
        if (g.input.objAt(px, py) === o) return [px, py];
      }
    }
    return null;
  };
  const from = pointOn(m[2]);
  const to = pointOn(m[1]);
  return { from, to, cam: [g.render.cam.x, g.render.cam.y, g.render.cam.zoom],
    at: m.map((o) => [o.x, o.y]) };
});
if (pts && (!pts.from || !pts.to)) {
  console.log('could not find a pickable point for the whelps', JSON.stringify(pts));
}
let mouseResult = { err: 'not run' };
if (pts && pts.from && pts.to) {
  await pg.mouse.move(pts.from[0], pts.from[1]);
  await pg.mouse.down();
  const held = await pg.evaluate(() => (window.__game.input.held || {}).key || null);
  await pg.mouse.move(pts.to[0], pts.to[1], { steps: 12 });
  await pg.mouse.up();
  await pg.waitForTimeout(400);
  mouseResult = await pg.evaluate(() => {
    const B = window.__game.board;
    return {
      kid: B.objs.filter((o) => o.key === 'grassd:3').length,
      whelpsLeft: B.objs.filter((o) => o.key === 'grassd:2').length,
    };
  });
  mouseResult.grabbed = held;
}
console.log('real-mouse dragon merge (3 Whelps -> Kid):', JSON.stringify(mouseResult));

let fails = 0;
if (!(mouseResult.kid >= 1)) { fails++; console.log('  FAIL: dragging three Whelps together did not make a Dragon Kid'); }
for (const c of R.report) {
  const bad = c.rows.filter((r) => !r.ok);
  const cbad = (c.casc.rows || []).filter((r) => !r.ok);
  const cdepth = (c.casc.rows || []).filter((r) => r.ok).length;
  const wantRungs = c.runs.reduce((a, [s, e]) => a + (e - s), 0);
  const status = (bad.length === 0 && cbad.length === 0 && cdepth === wantRungs) ? 'PASS' : 'FAIL';
  if (cdepth !== wantRungs && cbad.length === 0) fails++;
  console.log(`${status}  ${c.cid.padEnd(16)} placed: tier ${c.depth}/${c.len - 1}`
    + `   produced-cascade: ${cdepth}/${wantRungs} rung(s)${c.casc.err ? ' [' + c.casc.err + ']' : ''}`);
  for (const r of bad) {
    fails++;
    console.log(`      PLACED tier ${r.i} -> want ${r.want} got ${r.got} ${r.err ? JSON.stringify(r.info) : ''}`);
  }
  for (const r of cbad) {
    fails++;
    console.log(`      PRODUCED tier ${r.i} -> want ${r.want} got ${r.got} ${JSON.stringify(r.diag)}`);
  }
}
const totPlaced = R.report.reduce((a, c) => a + c.rows.length, 0);
const totCasc = R.report.reduce((a, c) => a + (c.casc.rows || []).length, 0);
const okPlaced = R.report.reduce((a, c) => a + c.rows.filter((r) => r.ok).length, 0);
const okCasc = R.report.reduce((a, c) => a + (c.casc.rows || []).filter((r) => r.ok).length, 0);
console.log('chains seeded by starting levels:', R.seeded.join(', '));
console.log(`RUNG ASSERTIONS: freshly-placed ${okPlaced}/${totPlaced} pass | `
  + `produced-output ${okCasc}/${totCasc} pass | real-mouse dragon merge `
  + `${mouseResult.kid >= 1 ? 'pass' : 'FAIL'}`);
// place() had to rescue an object from being overwritten -- must never happen
if (R.displaced !== 0) { fails++; console.log('DISPLACED PLACEMENTS:', R.displaced); }
console.log('FAILING RUNGS:', fails, '| displaced:', R.displaced, '| page errors:', errs.length);
errs.slice(0, 8).forEach((e) => console.log('  -', e));
await b.close(); srv.close();
process.exit(fails === 0 && errs.length === 0 ? 0 : 1);
