/**
 * Structural test for the score's scene data. Runs in plain node — music.js
 * touches no browser API until a voice is scheduled, so the tables can be
 * checked without an AudioContext.
 *
 * What this proves: every scene is well formed (a mode, a chord per bar, 16-step
 * patterns, drum kits per tier), every scale degree resolves inside its mode, and
 * every one-shot scene names a real successor. What it cannot prove is anything
 * about the audio clock — that is tests/music-live.mjs.
 *
 *   node tests/music-structure.mjs
 */
import { SCENES, SCENE_NAMES, STEPS, LAYERS, patAt } from '../src/music.js';

let failures = 0;
function check(label, cond, detail) {
  if (cond) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`);
}

const REQUIRED = ['realm', 'day', 'nightfall', 'night', 'boss', 'victory', 'defeat'];

console.log('the scene set');
for (const name of REQUIRED) check(`${name} exists`, !!SCENES[name]);
check('no extra scenes', SCENE_NAMES.length === REQUIRED.length, SCENE_NAMES.join(','));

console.log('\nevery scene is well formed');
for (const name of SCENE_NAMES) {
  const s = SCENES[name];
  check(`${name}: tempo in range`, s.bpm >= 40 && s.bpm <= 200, s.bpm);
  check(`${name}: 7-note mode`, Array.isArray(s.mode) && s.mode.length === 7);
  check(`${name}: mode ascends from 0`, s.mode[0] === 0 && s.mode.every((v, i) => i === 0 || v > s.mode[i - 1]));
  check(`${name}: has chords`, Array.isArray(s.chords) && s.chords.length >= 2);
  check(`${name}: chords are triads`, s.chords.every((c) => Array.isArray(c) && c.length === 3));
  check(`${name}: mix covers every layer`, LAYERS.every((k) => typeof (s.mix[k] || 0) === 'number'));
  check(`${name}: mix gains in 0..1`, LAYERS.every((k) => (s.mix[k] || 0) >= 0 && (s.mix[k] || 0) <= 1));
  check(`${name}: a drum kit per tier`,
    Array.isArray(s.drums) && s.drums.length === (s.tiers ? s.tiers.length : 1),
    `${s.drums.length} kits, ${s.tiers ? s.tiers.length : 1} tiers`);

  // note patterns: 16 steps per bar, degrees that land inside the mode
  for (const key of ['bass', 'arp', 'arp2', 'lead']) {
    if (!s[key]) continue;
    const bars = Array.isArray(s[key][0]) ? s[key].length : 1;
    let ok = true, bad = null;
    for (let b = 0; b < bars; b++) {
      const row = patAt(s[key], b);
      if (!row || row.length !== STEPS) { ok = false; bad = `bar ${b} has ${row ? row.length : 0} steps`; break; }
      for (const d of row) {
        if (d === null) continue;
        if (!Number.isInteger(d) || d < -7 || d > 20) { ok = false; bad = `degree ${d}`; break; }
      }
      if (!ok) break;
    }
    check(`${name}.${key}: ${bars} bar(s) of ${STEPS} steps`, ok, bad);
  }

  // drum patterns: step indices inside the bar
  for (let t = 0; t < s.drums.length; t++) {
    const kit = s.drums[t];
    for (const part of ['kick', 'hat', 'snare']) {
      const bars = Array.isArray(kit[part][0]) ? kit[part].length : 1;
      let ok = true, bad = null;
      for (let b = 0; b < bars; b++) {
        const row = patAt(kit[part], b);
        for (const step of row) {
          if (!Number.isInteger(step) || step < 0 || step >= STEPS) { ok = false; bad = `step ${step}`; break; }
        }
        if (!ok) break;
      }
      check(`${name}.drums[${t}].${part}: steps in 0..${STEPS - 1}`, ok, bad);
    }
  }

  if (s.pulse) {
    let ok = true;
    for (let t = 0; t < s.pulse.length; t++) {
      for (const step of patAt(s.pulse, t)) {
        if (!Number.isInteger(step) || step < 0 || step >= STEPS) { ok = false; break; }
      }
    }
    check(`${name}.pulse: steps in range`, ok);
  }
}

console.log('\nphrases actually carry melody, harmony, bass and rhythm');
for (const name of ['realm', 'day', 'night', 'boss']) {
  const s = SCENES[name];
  const bars = s.chords.length;
  const countOf = (key) => {
    if (!s[key]) return 0;
    let n = 0;
    for (let b = 0; b < bars; b++) for (const d of (patAt(s[key], b) || [])) if (d !== null) n++;
    return n;
  };
  check(`${name}: bass notes per phrase`, countOf('bass') >= bars, countOf('bass'));
  const melodic = countOf('lead') + countOf('arp') + countOf('arp2');
  check(`${name}: melodic notes per phrase`, melodic >= 6, melodic);
  const distinct = new Set();
  for (let b = 0; b < bars; b++) {
    for (const key of ['lead', 'arp', 'arp2']) {
      for (const d of (patAt(s[key], b) || [])) if (d !== null) distinct.add(d);
    }
  }
  check(`${name}: melody uses several pitches`, distinct.size >= 4, `${distinct.size} distinct degrees`);
  check(`${name}: harmony moves`, new Set(s.chords.map((c) => c.join(','))).size >= 2);
}

console.log('\nrhythm is present where it should be, absent where it should not');
check('realm has no percussion', SCENES.realm.drums[0].kick.length === 0
  && SCENES.realm.drums[0].hat.length === 0);
for (const name of ['day', 'nightfall', 'night', 'boss']) {
  const kit = SCENES[name].drums[0];
  const hits = patAt(kit.kick, 0).length + patAt(kit.hat, 0).length;
  check(`${name} has percussion`, hits > 0, hits);
}

console.log('\nintensity tiers escalate');
for (const name of ['night', 'boss']) {
  const s = SCENES[name];
  const density = (t) => {
    const kit = s.drums[t];
    return patAt(kit.kick, 0).length + patAt(kit.hat, 0).length + patAt(kit.snare, 0).length
      + patAt(s.pulse, t).length;
  };
  check(`${name}: tier 1 denser than tier 0`, density(1) > density(0), `${density(0)} -> ${density(1)}`);
  check(`${name}: tier 2 denser than tier 1`, density(2) > density(1), `${density(1)} -> ${density(2)}`);
  const drumGain = (t) => (s.tiers[t].drum == null ? s.mix.drum : s.tiers[t].drum);
  check(`${name}: drum gain rises with tier`,
    drumGain(0) < drumGain(1) && drumGain(1) < drumGain(2));
}
check('night tier 0 is quiet, tier 2 is not', SCENES.night.mix.pulse === 0
  && SCENES.night.tiers[2].pulse > 0.2);
check('night swaps to a running arp above tier 0', !!SCENES.night.arp2);
check('night kit turns to war drums under pressure',
  SCENES.night.tierKit[0] === 'frame' && SCENES.night.tierKit[2] === 'war');

console.log('\ntransitions are authored');
check('nightfall is a hard cut, not a fade', SCENES.nightfall.hard === true);
check('nightfall is two bars long', SCENES.nightfall.oneShot.bars === 2);
check('nightfall hands off to the night', SCENES.nightfall.oneShot.then === 'night');
check('nightfall tolls a bell', SCENES.nightfall.leadVoice === 'bell');
for (const name of SCENE_NAMES) {
  const os = SCENES[name].oneShot;
  if (!os) continue;
  check(`${name} hands off to a real scene`, !!SCENES[os.then], os.then);
  check(`${name} is short`, os.bars >= 1 && os.bars <= 4, os.bars);
}
check('victory and defeat both return to the realm',
  SCENES.victory.oneShot.then === 'realm' && SCENES.defeat.oneShot.then === 'realm');

console.log('\nthe score stays on one root and moves by mode');
const roots = new Set(SCENE_NAMES.map((n) => SCENES[n].root));
check('every scene shares a root', roots.size === 1, [...roots].join(','));
const modes = new Set(SCENE_NAMES.map((n) => SCENES[n].mode.join(',')));
check('at least four distinct modes', modes.size >= 4, modes.size);
check('boss is the darkest (flat second)', SCENES.boss.mode[1] === 1);
check('day is brighter than night (raised sixth)',
  SCENES.day.mode[5] > SCENES.night.mode[5]);
check('night is faster than day', SCENES.night.bpm > SCENES.day.bpm);
check('boss is faster than a normal night', SCENES.boss.bpm > SCENES.night.bpm);
check('defeat is the slowest scene',
  SCENE_NAMES.every((n) => n === 'defeat' || SCENES[n].bpm > SCENES.defeat.bpm));

console.log(failures === 0 ? '\nPASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
