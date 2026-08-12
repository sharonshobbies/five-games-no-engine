import { chromium } from '/Users/sharon.gao/Downloads/claude-code-test-benchmark/node_modules/playwright/index.mjs';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
const ROOT='/Users/sharon.gao/Downloads/claude-code-test-merge-dragons';
const MIME={'.html':'text/html','.js':'text/javascript','.json':'application/json','.png':'image/png'};
const srv=http.createServer((req,res)=>{
  let p=path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if(p.endsWith('/')) p+='index.html';
  fs.readFile(p,(e,d)=>{ if(e){res.writeHead(404);res.end();return;}
    res.writeHead(200,{'Content-Type':MIME[path.extname(p)]||'text/plain'}); res.end(d); });
});
await new Promise(r=>srv.listen(8791,r));
const b=await chromium.launch();
const pg=await b.newPage({viewport:{width:1180,height:2200},deviceScaleFactor:1});
const errors=[];
pg.on('console',m=>{ if(m.type()==='error') errors.push(m.text()); });
pg.on('pageerror',e=>errors.push('PAGEERROR '+e.message));
await pg.goto('http://localhost:8791/'+(process.argv[2]||'atlas.html'),{waitUntil:'networkidle'});
await pg.waitForTimeout(2500);
const se=await pg.evaluate(()=>window.__spriteErrors||[]);
await pg.screenshot({path:'/Users/sharon.gao/Downloads/claude-code-test-merge-dragons/screenshots/atlas.png',fullPage:true});
console.log('console/page errors:',errors.length); errors.slice(0,20).forEach(e=>console.log('  -',e));
console.log('sprite painter errors:',se.length); [...new Set(se)].slice(0,20).forEach(e=>console.log('  *',e));
await b.close(); srv.close();
