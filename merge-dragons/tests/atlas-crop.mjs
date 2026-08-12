// Dev tool: render one or more chains from the atlas at a large size so the art
// can be judged. `node tests/atlas-crop.mjs lifeFlower stone hill` writes
// screenshots/crop-<n>.png.
import { chromium } from '/Users/sharon.gao/Downloads/claude-code-test-benchmark/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = '/Users/sharon.gao/Downloads/claude-code-test-merge-dragons';
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((req, res) => {
  let p = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'text/plain' });
    res.end(d);
  });
});
await new Promise((r) => srv.listen(8793, r));
const chains = process.argv.slice(2);
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1500, height: 900 }, deviceScaleFactor: 2 });
const errs = [];
pg.on('pageerror', (e) => errs.push(e.message));
await pg.goto('http://localhost:8793/atlas.html', { waitUntil: 'networkidle' });
await pg.waitForTimeout(800);
await pg.evaluate(async (want) => {
  const { CHAINS } = await import('./src/registry.js');
  const { spriteFor } = await import('./src/sprites.js');
  document.body.innerHTML = '';
  document.body.style.background = '#5a9440';
  for (const id of want) {
    const c = CHAINS[id];
    if (!c) continue;
    const h = document.createElement('h2');
    h.textContent = `${id} — ${c.label}`;
    document.body.appendChild(h);
    const row = document.createElement('div');
    row.className = 'row';
    for (const it of c.items) {
      const sp = spriteFor(it, it.art === 'dragon' ? 'r1' : '');
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.style.width = '178px';
      const cv = document.createElement('canvas');
      const S = 172;
      cv.width = S; cv.height = S;
      const ctx = cv.getContext('2d');
      const s = Math.min(S / sp.w, S / sp.h) * 1.05;
      ctx.drawImage(sp.canvas, S / 2 - sp.gx * s, S * 0.95 - sp.gy * s, sp.w * s, sp.h * s);
      cell.appendChild(cv);
      const lab = document.createElement('div');
      lab.textContent = `${it.idx} ${it.name}`;
      lab.style.fontSize = '11px';
      cell.appendChild(lab);
      row.appendChild(cell);
    }
    document.body.appendChild(row);
  }
}, chains);
await pg.waitForTimeout(900);
await pg.screenshot({ path: `${ROOT}/screenshots/crop-${chains.join('-').slice(0, 40)}.png`, fullPage: true });
console.log('errors', errs.length, errs.slice(0, 5).join(' | '));
await b.close(); srv.close();
