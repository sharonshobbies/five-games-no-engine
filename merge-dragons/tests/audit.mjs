import { readFileSync } from 'fs';
// stub DOM for sprites/hud imports
global.document = { createElement: () => ({ getContext: () => new Proxy({}, {get:()=>()=>{}}), style:{} }) };
global.devicePixelRatio = 1;
const reg = await import('/Users/sharon.gao/Downloads/claude-code-test-merge-dragons/src/registry.js');
const src = readFileSync('/Users/sharon.gao/Downloads/claude-code-test-merge-dragons/src/levels.js','utf8')
  + readFileSync('/Users/sharon.gao/Downloads/claude-code-test-merge-dragons/src/main.js','utf8')
  + readFileSync('/Users/sharon.gao/Downloads/claude-code-test-merge-dragons/src/merge.js','utf8')
  + readFileSync('/Users/sharon.gao/Downloads/claude-code-test-merge-dragons/src/dragons.js','utf8');
const keys = [...new Set([...src.matchAll(/['"`]([a-zA-Z]+):(\d+)['"`]/g)].map(m=>m[1]+':'+m[2]))];
const bad = keys.filter(k=>!reg.ITEMS[k]);
console.log('keys referenced:', keys.length, 'invalid:', bad.length);
if (bad.length) console.log('INVALID:', bad.join(', '));
// also validate harvest/spawn/hatch targets inside the registry itself
const probs=[];
for (const it of Object.values(reg.ITEMS)) {
  if (it.harvest && !reg.ITEMS[it.harvest.item]) probs.push(it.key+' harvest->'+it.harvest.item);
  if (it.spawns && !reg.ITEMS[it.spawns.item]) probs.push(it.key+' spawns->'+it.spawns.item);
  if (it.hatch && !reg.ITEMS[it.hatch.egg]) probs.push(it.key+' hatch->'+it.hatch.egg);
  if (it.grave && !reg.ITEMS[it.grave]) probs.push(it.key+' grave->'+it.grave);
  if (it.gaiaBloom && !reg.ITEMS[it.gaiaBloom]) probs.push(it.key+' bloom->'+it.gaiaBloom);
}
console.log('registry cross-ref problems:', probs.length, probs.join(' | '));
// merge yield table check
const want={3:1,4:1,5:2,6:2,7:2,8:3,9:3,10:4,13:5,15:6,20:8};
for (const [n,y] of Object.entries(want)) {
  const got = reg.mergeYield(+n);
  if (got !== y) console.log('YIELD MISMATCH', n, 'want', y, 'got', got);
}
console.log('chains:', Object.keys(reg.CHAINS).length, 'items:', Object.keys(reg.ITEMS).length);
