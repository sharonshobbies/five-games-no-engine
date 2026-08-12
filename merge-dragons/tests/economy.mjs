// The economy-pressure and breeding mechanics, driven through the real game
// object: storage caps, Leftover Stones/Coins, Dimensional Jars as a gem sink,
// statue egg taps and Dragon Breeding with Soul Crystals.
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
await new Promise((r) => srv.listen(8798, r));
const b = await chromium.launch();
const pg = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
pg.on('pageerror', (e) => errs.push('PE ' + e.message));
pg.on('console', (m) => { if (m.type() === 'error') errs.push('CE ' + m.text()); });
await pg.goto('http://localhost:8798/?debug', { waitUntil: 'networkidle' });
await pg.waitForTimeout(2500);

const R = await pg.evaluate(() => {
  const g = window.__game, B = g.board, out = [];
  const ok = (name, cond, detail) => { out.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`); return !!cond; };
  const results = [];
  // clear a working strip of healed land: the debug camp is deliberately full,
  // and every check below needs somewhere to put things
  const bench = [];
  for (let y = 1; y < B.rows - 1 && bench.length < 40; y++) {
    for (let x = 1; x < B.cols - 1 && bench.length < 40; x++) {
      if (!B.isLive(x, y)) continue;
      if (B.atDragon(x, y)) continue;          // leave the camp's dragons be
      const o = B.atItem(x, y);
      if (o) B.remove(o);
      bench.push([x, y]);
    }
  }
  let bi = 0;
  const free = () => bench[bi++ % bench.length];

  // --- storage cap ---------------------------------------------------------
  for (const o of [...B.objs]) if (o.d.leftover || o.d.chain === 'jar') B.remove(o);
  const cap = g.storageCap('coins');
  g.save.coins = cap - 10;
  const before = B.objs.filter((o) => o.key === 'leftover:1').length;
  g.gainCoins(60, null);                       // 10 fits, 50 spills
  const piles = B.objs.filter((o) => o.key === 'leftover:1');
  results.push(ok('coins clamp at the cap', g.save.coins === cap, `${g.save.coins}/${cap}`));
  results.push(ok('overflow becomes Leftover Coins', piles.length === before + 1
    && piles[piles.length - 1].amount === 50, `pile holds ${piles.length ? piles[piles.length - 1].amount : 'none'}`));

  // tapping a full-storage leftover refuses; with room it collects
  const pile = piles[piles.length - 1];
  g.tap(pile);
  results.push(ok('a full store refuses the pile', pile.amount === 50 && B.objs.includes(pile)));
  g.save.coins = cap - 30;
  g.tap(pile);
  results.push(ok('with room, the pile pays out partially',
    g.save.coins === cap && pile.amount === 20, `coins ${g.save.coins}, pile ${pile.amount}`));
  g.save.coins = 0;
  g.tap(pile);
  results.push(ok('emptied piles disappear', !B.objs.includes(pile) && g.save.coins === 20));

  // --- storage buildings raise the cap ------------------------------------
  const capBefore = g.storageCap('bricks');
  const sp = free();
  const yard = B.spawn('stoneYard:4', sp[0], sp[1]);   // Opulent Stone Yard, +800
  results.push(ok('a Stone Yard raises the brick cap',
    g.storageCap('bricks') === capBefore + 800, `${capBefore} -> ${g.storageCap('bricks')}`));
  B.remove(yard);

  // --- Dimensional Jars: the gem sink ------------------------------------
  const spot = free();
  const src = B.spawn('lifeFlower:8', spot[0], spot[1]);   // jar price 30 gems
  let jar = null;
  for (let i = 0; i < 400 && !jar; i++) {
    g.maybeJar(src);
    jar = B.objs.find((o) => o.d.chain === 'jar');
  }
  results.push(ok('merging can leave a Dimensional Jar', !!jar,
    jar ? `${jar.gems} gems for ${jar.contents}` : 'never appeared'));
  if (jar) {
    results.push(ok('the jar price is the published one', jar.gems === 30, String(jar.gems)));
    const gems0 = g.save.gems;
    g.tap(jar);                                        // opens the modal
    const openBtn = [...document.querySelectorAll('.modal-btns .btn')].find((x) => /Open/.test(x.textContent));
    results.push(ok('the jar offers an Open button', !!openBtn));
    if (openBtn) {
      openBtn.click();
      results.push(ok('opening a jar spends gems', g.save.gems === gems0 - 30, `${gems0} -> ${g.save.gems}`));
      results.push(ok('opening a jar yields its contents',
        B.objs.some((o) => o.key === 'lifeFlower:8' && o !== src)));
    }
    // and a second jar can be sold for 50 coins instead
    let jar2 = null;
    for (let i = 0; i < 400 && !jar2; i++) { g.maybeJar(src); jar2 = B.objs.find((o) => o.d.chain === 'jar'); }
    if (jar2) {
      g.save.coins = 0;
      g.tap(jar2);
      const sellBtn = [...document.querySelectorAll('.modal-btns .btn')].find((x) => /Sell/.test(x.textContent));
      if (sellBtn) sellBtn.click();
      results.push(ok('a jar can be sold for 50 coins', g.save.coins === 50, String(g.save.coins)));
    }
    g.hud.hideModal();
  }

  // --- statues tap once for an egg ---------------------------------------
  bi = Math.max(bi, 20);                                   // move to clear ground
  const s2 = free();
  const statue = B.spawn('goldStatue:5', s2[0], s2[1]);    // Gilded Rhino, 2 eggs
  const eggs0 = B.objs.filter((o) => o.d.art === 'egg').length;
  g.tap(statue);
  const eggs1 = B.objs.filter((o) => o.d.art === 'egg').length;
  results.push(ok('a statue taps once for eggs', eggs1 === eggs0 + 2, `${eggs0} -> ${eggs1}`));
  g.tap(statue);
  results.push(ok('a statue gives eggs only once',
    B.objs.filter((o) => o.d.art === 'egg').length === eggs1));
  B.remove(statue);

  // --- Dragon Breeding ---------------------------------------------------
  // two grown dragons of different breeds, plus a Soul Crystal
  for (const key of ['grassd:10', 'crimsond:10']) {
    const s = free();
    const dr = B.spawn(key, s[0], s[1]);
    g.dragons.attach(dr);
  }
  const dragons0 = g.dragons.count();
  const power = g.dragons.totalPower();
  const cs = free();
  const crystal = B.spawn('soulCrystal:2', cs[0], cs[1]);
  g.tap(crystal);
  const newDragons = g.dragons.count();
  results.push(ok('breeding needs power and two grown breeds', power >= 250, `${power} power`));
  results.push(ok('a Soul Crystal breeds a dragon', newDragons === dragons0 + 1 && !B.objs.includes(crystal),
    `${dragons0} -> ${newDragons}`));
  results.push(ok('breeding leaves both parents alive',
    B.objs.some((o) => o.key === 'grassd:10') && B.objs.some((o) => o.key === 'crimsond:10')));

  return { out, allPass: results.every(Boolean) };
});
R.out.forEach((l) => console.log(' ', l));
console.log('ALL PASS:', R.allPass, '| errors:', errs.length);
errs.slice(0, 8).forEach((e) => console.log('  -', e));
await b.close(); srv.close();
process.exit(R.allPass && errs.length === 0 ? 0 : 1);
