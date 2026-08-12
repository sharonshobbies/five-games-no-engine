import { chromium } from '/Users/sharon.gao/Downloads/claude-code-test-benchmark/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/Users/sharon.gao/Downloads/claude-code-test-merge-dragons';
const MIME={'.html':'text/html','.js':'text/javascript'};
const srv=http.createServer((q,r)=>{let p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(p.endsWith('/'))p+='index.html';
 fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'text/plain'});r.end(d);});});
await new Promise(r=>srv.listen(8794,r));
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:1280,height:800}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); pg.on('pageerror',e=>errs.push('PE '+e.message));
await pg.goto('http://localhost:8794/?debug',{waitUntil:'networkidle'});
await pg.waitForTimeout(2000);
const t0 = await pg.evaluate(()=>{const g=window.__game;return{
  mode:g.mode, dragons:g.dragons.count(), power:g.dragons.totalPower(), objs:g.board.objs.length,
  dead:g.board.deadTiles(), hidden:g.board.objs.filter(o=>o.hidden).length,
  pos:g.dragons.list.map(o=>[+o.dragon.px.toFixed(2),+o.dragon.py.toFixed(2)])};});
await pg.waitForTimeout(14000);
const t1 = await pg.evaluate(()=>{const g=window.__game;return{
  dragons:g.dragons.count(), harvests:g.level.harvests+g.stats.harvests, objs:g.board.objs.length,
  dead:g.board.deadTiles(), hidden:g.board.objs.filter(o=>o.hidden).length,
  states:g.dragons.list.map(o=>o.dragon.state),
  pos:g.dragons.list.map(o=>[+o.dragon.px.toFixed(2),+o.dragon.py.toFixed(2)]),
  ready:g.board.objs.filter(o=>o.ready).length};});
let moved=0;
for(let i=0;i<Math.min(t0.pos.length,t1.pos.length);i++){
  if (Math.hypot(t1.pos[i][0]-t0.pos[i][0], t1.pos[i][1]-t0.pos[i][1])>0.4) moved++;
}
console.log('t0',JSON.stringify(t0.pos?{...t0,pos:t0.pos.length}:t0));
console.log('t1',JSON.stringify({...t1,pos:t1.pos.length}));
console.log('dragon states after 14s:', t1.states.join(','));
console.log('dragons that moved >0.4 tiles:', moved, 'of', t0.pos.length);
console.log('errors', errs.length); errs.slice(0,8).forEach(e=>console.log(' -',e));
await pg.screenshot({path:'/tmp/dragontest.png'});
await b.close(); srv.close();
