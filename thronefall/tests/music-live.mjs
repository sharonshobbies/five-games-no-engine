/**
 * Live verification of the score in a real browser, because nobody writing this
 * can hear it.
 *
 * Serves the game, drives it through every phase in headless chromium with the
 * autoplay policy relaxed, and asserts against the sequencer's own bookkeeping:
 *
 *   1. the AudioContext really runs and the sequencer really starts
 *   2. notes are scheduled in EVERY scene, counted per scene, not just overall
 *   3. scene transitions fire when the game changes phase, in the right order,
 *      including the two-bar nightfall cut handing off to the night on its own
 *   4. no scheduling gap or overlap anywhere: every step lands exactly one step
 *      duration after the previous one, across bar lines, across tempo changes
 *      and across scene changes
 *   5. bar spacing equals 16 steps of that bar's own tempo
 *   6. intensity moves the pattern tier and the drum gain
 *   7. the mute toggle stops scheduling, persists, and resumes cleanly
 *
 * What it CANNOT catch: whether any of it sounds good. It proves the sequencer's
 * timing and structure, not the music. Voice timbre, balance between layers, and
 * whether the harmony is pleasant are unverified by anything here.
 *
 *   node tests/music-live.mjs
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const GAME = path.resolve(HERE, '..');
const SHARED = '/Users/sharon.gao/Downloads/claude-code-test-benchmark';

let failures = 0;
function check(label, cond, detail) {
  if (cond) { console.log(`  ok   ${label}`); return true; }
  failures++;
  console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`);
  return false;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.png': 'image/png',
};

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const file = path.join(GAME, p);
  if (!file.startsWith(GAME)) { res.writeHead(403).end('no'); return; }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404).end('missing'); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  });
});
const port = await new Promise((r) => server.listen(0, '127.0.0.1', () => r(server.address().port)));

const { chromium } = await import(path.join(SHARED, 'node_modules/playwright/index.mjs'))
  .catch(() => import('playwright'));

const consoleErrors = [];
const pageErrors = [];
const browser = await chromium.launch({
  args: [
    '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--ignore-gpu-blocklist', '--enable-webgl',
    '--autoplay-policy=no-user-gesture-required',
  ],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300)); });
page.on('pageerror', (e) => pageErrors.push(String(e.message || e).slice(0, 500)));

await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__game, null, { timeout: 20000 });

const snap = () => page.evaluate(() => window.__game.music.debugSnapshot());

/** Poll until `pred` holds over a fresh snapshot, or give up. */
async function until(pred, ms, label) {
  const t0 = Date.now();
  let last = null;
  while (Date.now() - t0 < ms) {
    last = await snap();
    if (pred(last)) return last;
    await page.waitForTimeout(120);
  }
  return last;
}

/** Notes scheduled over `ms` of real time. */
async function notesOver(ms) {
  const a = await snap();
  await page.waitForTimeout(ms);
  const b = await snap();
  return { delta: b.notesScheduled - a.notesScheduled, a, b };
}

// ---------------------------------------------------------------- 1. it starts
console.log('the sequencer starts on first input');
// The score waits for a gesture, exactly as a browser requires.
const cold = await snap();
check('a scene is selected before any input', cold.scene === 'realm', cold.scene);
check('nothing is scheduled before a gesture', cold.notesScheduled === 0, cold.notesScheduled);

await page.keyboard.press('KeyQ');   // any key: wakeAudio() runs on keydown
await page.waitForTimeout(500);
const ctxState = await page.evaluate(() => window.__game.audio.ctx && window.__game.audio.ctx.state);
check('AudioContext is running', ctxState === 'running', ctxState);
const started = await until((s) => s.started && s.notesScheduled > 0, 6000);
check('the sequencer started', started.started === true);
check('notes are being scheduled', started.notesScheduled > 0, started.notesScheduled);

// ------------------------------------------------------- 2. notes in the realm
console.log('\nrealm: notes accumulate on the audio clock');
{
  const { delta, a, b } = await notesOver(3000);
  check('notes scheduled over 3s', delta > 8, delta);
  check('bpm is the realm tempo', b.bpm === 68, b.bpm);
  // The strongest thing a deaf test can assert: steps advanced over 3s of wall
  // clock at exactly the rate the scene's tempo implies. The lookahead is a
  // constant offset in both samples, so the delta is clean.
  {
    const stepDelta = b.stepsScheduled - a.stepsScheduled;
    const expected = 3.0 / b.stepDur;
    check('steps advance at the scene tempo', Math.abs(stepDelta - expected) <= 3,
      `${stepDelta} steps vs ~${expected.toFixed(1)} implied by ${b.bpm}bpm`);
  }
  check('bars complete', b.barsScheduled >= 1, b.barsScheduled);
  check('no percussion in the realm', b.gains.drum < 0.001, b.gains.drum);
  check('a drone is sounding', b.gains.drone > 0.3, b.gains.drone);
}

// ----------------------------------------------------------- 3. the day scene
console.log('\nday: the build phase gets its own arrangement');
await page.evaluate(() => { window.__game.pendingLevel = null; window.__game.startRun(); });
{
  const s = await until((x) => x.scene === 'day', 8000);
  check('scene became day', s.scene === 'day', s.scene);
  check('day tempo', s.bpm === 84, s.bpm);
  const { delta, b } = await notesOver(2500);
  check('notes scheduled during the day', delta > 8, delta);
  check('percussion entered', b.gains.drum > 0.05, b.gains.drum);
  check('a bass line is sounding', b.gains.bass > 0.2, b.gains.bass);
  check('intensity is 0 during the day', b.intensity === 0, b.intensity);
}

// --------------------------------------- 4. the nightfall cut and night combat
console.log('\nnightfall: an authored cut, landing on a bar line');
const beforeNight = await snap();
await page.evaluate(() => window.__game.beginNight());
const cued = await snap();
check('a transition cue was scheduled', cued.cueTime > 0, cued.cueTime);
check('the cue targets a future bar line', cued.cueTime > beforeNight.stepLog.at(-1).t, cued.cueTime);
check('the cue placed drum hits', cued.cueHits > 0, cued.cueHits);
{
  const s = await until((x) => x.sceneLog.some((e) => e.name === 'nightfall'), 8000);
  check('nightfall fired', s.sceneLog.some((e) => e.name === 'nightfall'));
  // The cut is a bar line: the nightfall entry's bar index is a whole bar count,
  // and its own bookkeeping says it landed at one.
  const entry = s.sceneLog.find((e) => e.name === 'nightfall');
  check('nightfall landed on a bar line', Number.isInteger(entry.bar), entry.bar);
  const cut = s.barLog.find((b) => b.scene === 'nightfall');
  check('the cut time matches the cue target',
    cut && Math.abs(cut.at - cued.cueTime) < 1e-6,
    cut ? `${cut.at} vs ${cued.cueTime}` : 'no nightfall bar');
}
console.log('\nnight: nightfall hands off after exactly two bars');
{
  const s = await until((x) => x.scene === 'night', 12000);
  check('scene became night', s.scene === 'night', s.scene);
  const bars = s.barLog.filter((b) => b.scene === 'nightfall').length;
  check('nightfall lasted two bars', bars === 2, bars);
  check('night tempo', s.bpm === 96, s.bpm);
  const { delta } = await notesOver(2500);
  check('notes scheduled during the night', delta > 8, delta);
}

// ------------------------------------------------- 5. intensity drives the mix
console.log('\nintensity moves the arrangement');
{
  // The frame loop recomputes intensity from the world every frame, so pin the
  // method for the duration of this section instead of fighting it.
  await page.evaluate(() => {
    const g = window.__game;
    g.musicIntensity = () => 0.05;
    g.music.setIntensity(0.05);
  });
  // Gains crossfade rather than snapping, so each reading waits for the fade to
  // settle before it is trusted.
  const SETTLE = 2200;
  const reached = await until((x) => x.tier === 0, 10000);
  check('a quiet night sits at tier 0', reached.tier === 0, reached.tier);
  await page.waitForTimeout(SETTLE);
  const calm = await snap();

  await page.evaluate(() => {
    const g = window.__game;
    g.musicIntensity = () => 0.55;
    g.music.setIntensity(0.55);
  });
  const mid = await until((x) => x.tier === 1, 10000);
  check('a pressed night reaches tier 1', mid.tier === 1, mid.tier);

  await page.evaluate(() => {
    const g = window.__game;
    g.musicIntensity = () => 0.95;
    g.music.setIntensity(0.95);
  });
  const reachedHot = await until((x) => x.tier === 2, 10000);
  check('a desperate night reaches tier 2', reachedHot.tier === 2, reachedHot.tier);
  await page.waitForTimeout(SETTLE);
  const hot = await snap();

  check('drums are louder than at tier 0', hot.gains.drum > calm.gains.drum * 1.5,
    `${calm.gains.drum} -> ${hot.gains.drum}`);
  check('the running arp only appears under pressure', hot.gains.arp > calm.gains.arp * 1.5,
    `${calm.gains.arp} -> ${hot.gains.arp}`);
  check('the low pulse only exists under pressure',
    hot.gains.pulse > 0.1 && calm.gains.pulse < 0.02,
    `${calm.gains.pulse} -> ${hot.gains.pulse}`);
  check('the choir only joins under pressure', hot.gains.choir > 0.1 && calm.gains.choir < 0.02,
    `${calm.gains.choir} -> ${hot.gains.choir}`);
  const { delta } = await notesOver(2000);
  check('tier 2 schedules more per bar than tier 0 did', delta > 20, delta);
}

// -------------------------------------- 6. the intensity formula itself tracks
console.log('\nthe intensity formula tracks wave progress and keep damage');
{
  // Read the formula against a stub world, so the reading is a property of the
  // formula rather than of whatever the live night happens to be doing — and so
  // the live world is never mutated (setting a wave to zero mid-night would end
  // the night out from under the rest of the test).
  const probe = await page.evaluate(() => {
    const g = window.__game;
    delete g.musicIntensity;                     // restore the real method
    const real = g.world;
    const TOTAL = 60;                            // a mid-game wave size
    const read = (alive, queued, hpFrac, night = 1) => {
      g.world = {
        phase: 'night', night, totalToSpawn: TOTAL, enemyCount: alive,
        spawnQueue: { length: queued },
        castle: { hp: 1000 * hpFrac, maxHp: 1000 },
        level: { cfg: { nights: 5 } },
      };
      return g.musicIntensity();
    };
    const out = {
      total: TOTAL,
      cleared: read(0, 0, 1),
      earlyWave: read(2, TOTAL - 2, 1),
      halfWave: read(8, TOTAL / 2, 1),
      fullField: read(TOTAL * 0.5, 0, 1),
      keepHalf: read(0, 0, 0.5),
      keepCritical: read(0, 0, 0.1),
      lateNight: read(2, TOTAL - 2, 1, 5),
      worst: read(TOTAL * 0.5, TOTAL * 0.3, 0.15, 5),
      notNight: (() => {
        g.world = { phase: 'day', night: 1, totalToSpawn: TOTAL, enemyCount: 40,
          spawnQueue: { length: 20 }, castle: { hp: 100, maxHp: 1000 },
          level: { cfg: { nights: 5 } } };
        return g.musicIntensity();
      })(),
    };
    g.world = real;
    return out;
  });
  check('a cleared field is the calmest night reading', probe.cleared < probe.earlyWave,
    `${probe.cleared} vs ${probe.earlyWave}`);
  check('the wave arriving raises it', probe.halfWave > probe.earlyWave,
    `${probe.earlyWave} -> ${probe.halfWave}`);
  check('a full field is higher still', probe.fullField > probe.halfWave,
    `${probe.halfWave} -> ${probe.fullField}`);
  check('clearing the field walks it back down', probe.cleared < probe.fullField,
    `${probe.fullField} -> ${probe.cleared}`);
  check('keep damage raises it', probe.keepHalf > probe.cleared,
    `${probe.cleared} -> ${probe.keepHalf}`);
  check('a critical keep raises it further', probe.keepCritical > probe.keepHalf,
    `${probe.keepHalf} -> ${probe.keepCritical}`);
  check('a later night reads hotter than the same shape on night 1',
    probe.lateNight > probe.earlyWave, `${probe.earlyWave} -> ${probe.lateNight}`);
  check('everything at once saturates', probe.worst > 0.9, probe.worst);
  check('the day reads zero however bad the world looks', probe.notNight === 0, probe.notNight);
  check('every reading stays in 0..1',
    Object.entries(probe).filter(([k]) => k !== 'total').every(([, v]) => v >= 0 && v <= 1),
    JSON.stringify(probe));
}

// ----------------------------------------------------------- 7. the boss night
console.log('\nboss: the final night gets its own arrangement');
await page.evaluate(() => {
  const g = window.__game;
  g.world.phase = 'day';                         // step out of the running night
  g.world.night = g.world.level.cfg.nights - 1;  // the same jump the O key makes
  g.previewNight();
  g.beginNight();
});
{
  const s = await until((x) => x.scene === 'boss', 14000);
  check('scene became boss', s.scene === 'boss', s.scene);
  check('boss tempo is the fastest', s.bpm === 108, s.bpm);
  check('the bell climbed with the night', s.bellLift > 0, s.bellLift);
  const { delta, b } = await notesOver(2500);
  check('notes scheduled during the boss night', delta > 12, delta);
  check('a choir is sounding', b.gains.choir > 0.05, b.gains.choir);
}

// -------------------------------------------------------------- 8. the stings
console.log('\nvictory and defeat sting, then hand back to the realm');
await page.evaluate(() => window.__game.finish(true, true));
{
  const s = await until((x) => x.notesByScene.victory > 0, 10000);
  check('victory scheduled notes', (s.notesByScene.victory || 0) > 0, s.notesByScene.victory);
  const bars = await until((x) => x.barLog.filter((b) => b.scene === 'victory').length >= 2, 10000);
  check('victory ran two bars', bars.barLog.filter((b) => b.scene === 'victory').length === 2);
  const back = await until((x) => x.scene === 'realm', 10000);
  check('victory handed back to the realm', back.scene === 'realm', back.scene);
}
await page.evaluate(() => {
  const g = window.__game;
  g.pendingLevel = null; g.startRun();
});
await until((x) => x.scene === 'day', 10000);
await page.evaluate(() => window.__game.finish(false, true));
{
  const s = await until((x) => x.notesByScene.defeat > 0, 10000);
  check('defeat scheduled notes', (s.notesByScene.defeat || 0) > 0, s.notesByScene.defeat);
  const back = await until((x) => x.scene === 'realm', 14000);
  check('defeat handed back to the realm', back.scene === 'realm', back.scene);
}

// -------------------------------------- 9. every scene really produced sound
console.log('\nevery scene in the set scheduled notes');
{
  const s = await snap();
  for (const name of ['realm', 'day', 'nightfall', 'night', 'boss', 'victory', 'defeat']) {
    check(`${name} scheduled notes`, (s.notesByScene[name] || 0) > 0, s.notesByScene[name] || 0);
  }
  check('the scene order was authored, never random',
    s.sceneLog.map((e) => e.name).join(' -> ').includes('day -> nightfall -> night'),
    s.sceneLog.map((e) => e.name).join(' -> '));
}

// ------------------------------- 10. no gap or overlap at any step or bar line
console.log('\nthe grid has no gap and no overlap');
{
  const s = await snap();
  check('the sequencer reports zero spacing error', s.maxStepGapError < 1e-9, s.maxStepGapError);

  // Independent check over the raw step log, including the bar lines inside it.
  let worst = 0, worstAt = null, monotonic = true;
  for (let i = 1; i < s.stepLog.length; i++) {
    const prev = s.stepLog[i - 1], cur = s.stepLog[i];
    if (cur.t <= prev.t) monotonic = false;
    const err = Math.abs((cur.t - prev.t) - prev.dur);
    if (err > worst) { worst = err; worstAt = `${prev.scene}#${prev.bar}.${prev.step} -> ${cur.scene}#${cur.bar}.${cur.step}`; }
  }
  check('step times strictly increase', monotonic);
  check('every step lands one step duration after the last', worst < 1e-9, `${worst} at ${worstAt}`);
  const crossings = s.stepLog.filter((e, i) => i > 0 && e.step === 0).length;
  check('the checked window crosses bar lines', crossings >= 1, crossings);

  // Bar spacing: 16 steps of that bar's own tempo, so a tempo change between
  // scenes still leaves the grid continuous.
  let barWorst = 0, barAt = null;
  for (let i = 1; i < s.barLog.length; i++) {
    const prev = s.barLog[i - 1], cur = s.barLog[i];
    const err = Math.abs((cur.at - prev.at) - prev.dur * 16);
    if (err > barWorst) { barWorst = err; barAt = `${prev.scene} -> ${cur.scene}`; }
  }
  check('bars are exactly 16 steps long', barWorst < 1e-9, `${barWorst} at ${barAt}`);
  const sceneCuts = s.barLog.filter((b, i) => i > 0 && s.barLog[i - 1].scene !== b.scene).length;
  check('the bar log spans several scene changes', sceneCuts >= 3, sceneCuts);
  const tempoCuts = s.barLog.filter((b, i) => i > 0 && Math.abs(s.barLog[i - 1].dur - b.dur) > 1e-9).length;
  check('and at least one tempo change', tempoCuts >= 1, tempoCuts);
}

// ---------------------------------------------------------- 11. the mute toggle
console.log('\nthe music toggle mutes, persists and resumes');
{
  // The toggle lives on the title screen and in the pause menu; show the title.
  await page.evaluate(() => window.__game.show('title'));
  await page.waitForTimeout(200);
  const before = await snap();
  check('music starts enabled', before.enabled === true);
  await page.click('#musicBtn');
  await page.waitForTimeout(300);
  const off = await snap();
  check('toggle disabled the score', off.enabled === false);
  const label = await page.textContent('#musicBtn');
  check('the button reads off', /off/i.test(label), label);
  const persisted = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('thronefall.save.v1') || '{}').musicOn);
  check('the choice is persisted', persisted === false, String(persisted));
  const { delta } = await notesOver(1800);
  check('nothing is scheduled while muted', delta === 0, delta);

  await page.click('#musicBtn');
  await page.waitForTimeout(300);
  const on = await snap();
  check('toggle re-enabled the score', on.enabled === true);
  // The realm theme is the sparsest scene in the score and its bar is 3.5s long,
  // so the window has to be longer than a bar for the count to mean anything.
  const again = await notesOver(5000);
  check('scheduling resumed', again.delta > 6, again.delta);
  // The silence shows up in the step log as one long gap; the step right after
  // it must be a bar's first step, so the score picks back up on a downbeat.
  {
    const log = again.b.stepLog;
    let gapAt = -1, widest = 0;
    for (let i = 1; i < log.length; i++) {
      const d = log[i].t - log[i - 1].t;
      if (d > widest) { widest = d; gapAt = i; }
    }
    check('the mute shows as one long gap in the log', widest > 1.0, widest);
    check('scheduling resumed on a downbeat', gapAt > 0 && log[gapAt].step === 0,
      gapAt > 0 ? `step ${log[gapAt].step}` : 'no gap found');
  }
  const persistedOn = await page.evaluate(() =>
    JSON.parse(localStorage.getItem('thronefall.save.v1') || '{}').musicOn);
  check('the resumed choice is persisted', persistedOn === true, String(persistedOn));

  const after = await snap();
  check('no spacing error introduced by the mute cycle', after.maxStepGapError < 1e-9, after.maxStepGapError);
}

// ------------------------------------------------------------------ page health
console.log('\nthe page stayed clean');
check('no page errors', pageErrors.length === 0, pageErrors.join(' | '));
check('no console errors', consoleErrors.length === 0, consoleErrors.join(' | '));

await browser.close();
server.close();
console.log(failures === 0 ? '\nPASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
