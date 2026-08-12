import { chromium } from '/Users/sharon.gao/Downloads/claude-code-test-benchmark/node_modules/playwright/index.mjs';
import http from 'node:http'; import fs from 'node:fs'; import path from 'node:path';
const ROOT='/Users/sharon.gao/Downloads/claude-code-test-merge-dragons';
const MIME={'.html':'text/html','.js':'text/javascript'};
const srv=http.createServer((q,r)=>{let p=path.join(ROOT,decodeURIComponent(q.url.split('?')[0]));if(p.endsWith('/'))p+='index.html';
 fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'text/plain'});r.end(d);});});
await new Promise(r=>srv.listen(8796,r));
const b=await chromium.launch(); const pg=await b.newPage({viewport:{width:1280,height:800}});
const errs=[]; pg.on('console',m=>{if(m.type()==='error')errs.push(m.text())}); pg.on('pageerror',e=>errs.push('PE '+e.message));
await pg.goto('http://localhost:8796/?debug',{waitUntil:'networkidle'});
await pg.waitForTimeout(2000);
// SHOP
await pg.click('button[title^="Buy Menu"]');
await pg.waitForTimeout(600);
const shop = await pg.evaluate(()=>({items:document.querySelectorAll('.shopitem').length,
  heads:[...document.querySelectorAll('.shop-head')].map(e=>e.textContent),
  poor:document.querySelectorAll('.shopitem.poor').length}));
await pg.screenshot({path:'/tmp/ui-shop.png'});
const coins0 = await pg.evaluate(()=>window.__game.save.coins);
await pg.click('.shopitem:not(.poor)');
await pg.waitForTimeout(800);
const bought = await pg.evaluate(()=>({coins:window.__game.save.coins, objs:window.__game.board.objs.length}));
// BOOK
await pg.click('button[title^="Dragon Book"]');
await pg.waitForTimeout(800);
const book = await pg.evaluate(()=>({rows:document.querySelectorAll('.bookrow').length,
  cells:document.querySelectorAll('.bk-cell').length, known:document.querySelectorAll('.bk-cell:not(.unknown)').length,
  title:document.querySelector('.m-title').textContent}));
await pg.screenshot({path:'/tmp/ui-book.png'});
await pg.click('.modal-btns .btn');
await pg.waitForTimeout(300);
// INFO BAR: click a real object, found by asking the renderer where it is
const at = await pg.evaluate(()=>{
  const g=window.__game;
  const o=g.board.objs.find(x=>!x.hidden && x.d.harvest) || g.board.objs[0];
  const [sx,sy]=g.render.t2s(o.x+o.w/2, o.y+o.h*0.6);
  return {sx:Math.round(sx), sy:Math.round(sy), name:o.d.name};
});
await pg.mouse.click(at.sx, at.sy);
await pg.waitForTimeout(500);
const info = await pg.evaluate(()=>{const i=document.querySelector('.infobar');
  return {shown:!i.classList.contains('hidden'), name:(document.querySelector('.info-name')||{}).textContent,
    act:(document.querySelector('.info-actions .btn')||{}).textContent, meta:(document.querySelector('.info-meta')||{}).textContent};});
console.log('shop:',JSON.stringify(shop));
console.log('bought: coins',coins0,'->',bought.coins,' objs',bought.objs);
console.log('book:',JSON.stringify(book));
console.log('clicked:',at.name,'at',at.sx+','+at.sy);
console.log('infobar:',JSON.stringify(info));
console.log('errors',errs.length); errs.slice(0,8).forEach(e=>console.log(' -',e));
await b.close(); srv.close();
