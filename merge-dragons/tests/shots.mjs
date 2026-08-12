// Dev tool: screenshots of the debug camp, so the board art can be judged in
// situ rather than only in the atlas. Writes screenshots/camp-*.png.
import { chromium } from '/Users/sharon.gao/Downloads/claude-code-test-benchmark/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT = '/Users/sharon.gao/Downloads/claude-code-test-merge-dragons';
const MIME = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer((q, r) => {
  let p = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (p.endsWith('/')) p += 'index.html';
  fs.readFile(p, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'text/plain' });
    r.end(d);
  });
});
await new Promise((r) => srv.listen(8792, r));
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const errs = [];
pg.on('pageerror', (e) => errs.push('PE ' + e.message));
pg.on('console', (m) => { if (m.type() === 'error') errs.push('CE ' + m.text()); });
await pg.goto('http://localhost:8792/?debug', { waitUntil: 'networkidle' });
await pg.waitForTimeout(3000);
await pg.screenshot({ path: `${ROOT}/screenshots/camp-wide.png` });
// zoom in on the middle of the camp
await pg.evaluate(() => { const g = window.__game; g.render.cam.tz = 1.5; });
await pg.waitForTimeout(1200);
await pg.screenshot({ path: `${ROOT}/screenshots/camp-zoom.png` });
// the shop, showing the storage buildings and the gem-priced crystal chest
await pg.click('button[title^="Buy Menu"]');
await pg.waitForTimeout(700);
await pg.screenshot({ path: `${ROOT}/screenshots/camp-shop.png` });
console.log('errors', errs.length);
errs.slice(0, 10).forEach((e) => console.log(' -', e));
await b.close(); srv.close();
