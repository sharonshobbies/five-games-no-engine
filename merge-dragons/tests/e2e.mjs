import { chromium } from '/Users/sharon.gao/Downloads/claude-code-test-benchmark/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/Users/sharon.gao/Downloads/claude-code-test-merge-dragons';
const MIME={'.html':'text/html','.js':'text/javascript'};
const srv=http.createServer((q,r)=>{let p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(p.endsWith('/'))p+='index.html';
 fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'text/plain'});r.end(d);});});
await new Promise(r=>srv.listen(8795,r));
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1280,height:800}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); pg.on('pageerror',e=>errs.push('PE '+e.message));
await pg.goto('http://localhost:8795/?level=1',{waitUntil:'networkidle'});
await pg.waitForTimeout(1500);
// complete every quest + the end goal by driving the real game API
const r1 = await pg.evaluate(async () => {
  const g = window.__game, B = g.board;
  const heal = await import('./src/heal.js');
  const all=[]; for(let y=0;y<B.rows;y++)for(let x=0;x<B.cols;x++) if(B.playable[B.idx(x,y)]) all.push([x,y]);
  heal.forceHeal(B, all);                      // satisfies heal quests
  g.made['lifeFlower:4'] = 1;                  // pretend the tier quest is met
  g.level.merges = 99;
  // build a real Gaia merge to trip the end goal. The three statues must be in
  // contact, so clear an explicit strip rather than trusting findFree to keep
  // them adjacent.
  for (const o of [...B.objs]) { if (o.d.chain==='gaia') { if(o.dragon) g.dragons.release(o); B.remove(o);} }
  let strip=null;
  for (let y=1;y<B.rows-1 && !strip;y++) for (let x=1;x<B.cols-3 && !strip;x++) {
    const cells=[[x,y],[x+1,y],[x+2,y]];
    if (cells.every(([cx,cy])=>B.isLive(cx,cy))) strip=cells;
  }
  for (const [cx,cy] of strip) { const o=B.atItem(cx,cy); if(o){ if(o.dragon) g.dragons.release(o); B.remove(o);} }
  const spots=strip;
  for (const [cx,cy] of strip) B.spawn('gaia:0',cx,cy);
  const mv = B.atItem(strip[0][0], strip[0][1]);
  g.drop(mv, spots[1][0], spots[1][1], spots[0]);
  return {complete:g.level.complete, stars:g.level.starsDone, restored:B.objs.filter(o=>o.key==='gaia:1').length};
});
await pg.waitForTimeout(2500);
const r2 = await pg.evaluate(()=>({
  modal: !document.querySelector('.modal').classList.contains('hidden'),
  title: (document.querySelector('.m-title')||{}).textContent,
  rewards: document.querySelectorAll('#mrew2 canvas').length,
  saved: JSON.parse(localStorage.getItem('mergedragons.save.v1')||'{}'),
}));
console.log('after end goal:', JSON.stringify(r1));
console.log('modal shown:', r2.modal, '| title:', r2.title, '| reward thumbs:', r2.rewards);
console.log('save levels:', JSON.stringify(r2.saved.levels), 'carried:', (r2.saved.carried||[]).length, 'gems:', r2.saved.gems);
await pg.screenshot({path:'/tmp/e2e-complete.png'});
// collect and go to the map, then enter camp to check persistence path
await pg.click('.modal-btns .btn.primary');
await pg.waitForTimeout(1200);
const r3 = await pg.evaluate(()=>({mode:window.__game.mode, mapVisible:!document.querySelector('.map').classList.contains('hidden'),
  nodes:document.querySelectorAll('.mapnode').length, doneNodes:document.querySelectorAll('.mapnode.done').length}));
console.log('after collect:', JSON.stringify(r3));
await pg.screenshot({path:'/tmp/e2e-map.png'});
await pg.evaluate(()=>window.__game.gotoCamp());
await pg.waitForTimeout(2500);
const r4 = await pg.evaluate(()=>({mode:window.__game.mode, objs:window.__game.board.objs.length,
  carriedLeft:(window.__game.save.carried||[]).length, dragons:window.__game.dragons.count()}));
console.log('camp after carry:', JSON.stringify(r4));
await pg.screenshot({path:'/tmp/e2e-camp.png'});
console.log('errors', errs.length); errs.slice(0,8).forEach(e=>console.log(' -',e));
await b.close(); srv.close();
