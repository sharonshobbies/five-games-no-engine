// Drives real drags through the real drop path and checks both halves of the
// wiki's Merging Table: the Y objects created, and the "Ejected X" spare handed
// back to the board. A 4-merge must leave 1 input behind; a 3-merge must not.
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
await new Promise((r) => srv.listen(8797, r));
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('http://localhost:8797/?level=5', { waitUntil: 'networkidle' });
await pg.waitForTimeout(1500);
const R = await pg.evaluate(async () => {
  const g = window.__game, B = g.board, out = [];
  const heal = await import('./src/heal.js');
  const reg = await import('./src/registry.js');
  const all = [];
  for (let y = 0; y < B.rows; y++) for (let x = 0; x < B.cols; x++) if (B.playable[B.idx(x, y)]) all.push([x, y]);
  heal.forceHeal(B, all);
  const key = 'stone:0';
  const test = (n) => {
    const wantY = reg.mergeYield(n);
    const wantSpare = reg.mergeSpare(n);
    let first = null;
    const prev = g.onMerge;
    g.onMerge = (d, nd, cnt, made) => { if (first === null) first = { cnt, produced: made.length }; prev && prev(d, nd, cnt, made); };
    // wipe the board so nothing else joins the group or chain-reacts in
    for (const o of [...B.objs]) { if (o.dragon) g.dragons.release(o); B.remove(o); }
    // a 5x4 block: n-1 in contact, the mover parked in the far corner
    const cells = [];
    for (let y = 2; y < 6; y++) for (let x = 2; x < 7; x++) cells.push([x, y]);
    const park = cells[cells.length - 1];
    for (let i = 0; i < n - 1; i++) B.spawn(key, cells[i][0], cells[i][1]);
    const mover = B.spawn(key, park[0], park[1]);
    g.drop(mover, cells[n - 1][0], cells[n - 1][1], park);
    g.onMerge = prev;
    const produced = first ? first.produced : 0;
    const grouped = first ? first.cnt : 0;
    // whatever of the ORIGINAL tier is still standing is the ejected spare
    const spare = B.objs.filter((o) => o.key === key).length;
    const ok = produced === wantY && grouped === n && spare === wantSpare;
    out.push(`${String(n).padStart(2)}-merge: group=${grouped} produced=${produced}/${wantY} `
      + `ejected=${spare}/${wantSpare} ${ok ? 'PASS' : 'FAIL'}`);
    return ok;
  };
  const results = [3, 4, 5, 6, 7, 8, 10, 12].map(test);
  return { out, allPass: results.every(Boolean) };
});
R.out.forEach((l) => console.log(' ', l));
console.log('ALL PASS:', R.allPass, '| page errors:', errs.length);
errs.slice(0, 5).forEach((e) => console.log('  -', e));
await b.close(); srv.close();
process.exit(R.allPass && errs.length === 0 ? 0 : 1);
