/**
 * Regression test: a building destroyed during a night is rebuilt at dawn.
 *
 * The bug this guards: destroyStruct() set plot.dead = true and left
 * plot.building in place. Nothing cleared plot.dead at dawn, canPlace() refused
 * the plot because plot.building was truthy, and endNight() skipped dead plots
 * when healing — so a building lost in the night was lost for the whole run,
 * with paying for its next upgrade the only accidental way back. Both the README
 * ("rebuilt free at dawn") and FIDELITY.md said otherwise.
 *
 * Headless: three.js runs fine in node as long as nothing asks for a
 * WebGLRenderer, so the test builds a real World against a stub renderer.
 *
 *   node tests/rebuild-at-dawn.mjs
 */
import * as THREE from '../vendor/three.module.min.js';
import { LEVELS, buildLevel } from '../src/levels.js';
import { applyLoadout } from '../src/perks.js';
import { World } from '../src/world.js';

let failures = 0;
function check(label, cond, detail) {
  if (cond) { console.log(`  ok   ${label}`); return; }
  failures++;
  console.log(`  FAIL ${label}${detail === undefined ? '' : ` — ${detail}`}`);
}

/** A World with no window: only three's scene graph and a torch stub are used. */
function makeWorld(perks = [], mutators = []) {
  const rnd = {
    scene: new THREE.Scene(), torches: [],
    placeTorches() {}, setPalette() {},
  };
  const level = buildLevel(LEVELS[0]);
  const w = new World(rnd, level, applyLoadout(perks, mutators), 'bow', null);
  w.gold = 999;
  return w;
}

const plotOf = (w, kind) => w.level.plots.find((p) => p.kind === kind && !p.building);

/** Take the plot's building to zero the way an enemy would. */
function raze(w, plot) {
  w.damageStruct(plot, plot.building.maxHp * 4, null);
}

// ---------------------------------------------------------------- the main case
console.log('a destroyed building is rebuilt at dawn');
{
  const w = makeWorld();
  const plot = plotOf(w, 'eco');
  check('house placed', w.place(plot, 'house'), 'place() refused');
  const b = plot.building;
  const maxHp = b.maxHp;

  w.startNight([], null);
  raze(w, plot);
  check('destroyed during the night', plot.dead === true && b.hp === 0);
  check('rubble is not a target', !w.structures().includes(plot));
  check('rubble has no mesh', plot.mesh === null);

  w.endNight(null);

  // The point of the fix.
  check('alive again at dawn', plot.dead === false);
  check('still the same building', plot.building === b && b.def.id === 'house');
  check('healed to full', b.hp === maxHp, `hp=${b.hp} of ${maxHp}`);
  check('mesh restored', !!plot.mesh);
  check('plot marker hidden', plot.marker.visible === false);
  check('targetable again', w.structures().includes(plot));

  // Usable: it can be upgraded, and it survives a second night unchanged.
  check('upgrade offered', w.levelUpOptions(plot).length > 0);
  w.startNight([], null);
  w.endNight(null);
  check('still standing the next dawn', !plot.dead && plot.building === b);
}

// ------------------------------------------------------- a maxed-out building
// The old bug's worst case: at max level there was no upgrade left to buy, so
// the plot could never come back by any route.
console.log('a max-level building comes back too');
{
  const w = makeWorld();
  const plot = plotOf(w, 'eco');
  w.place(plot, 'house');
  let guard = 0;
  while (w.levelUpOptions(plot).length > 0 && guard++ < 10) {
    w.gold = 999;
    w.levelUp(plot, w.levelUpOptions(plot)[0].id);
  }
  check('house is maxed', w.levelUpOptions(plot).length === 0);
  const maxHp = plot.building.maxHp;

  w.startNight([], null);
  raze(w, plot);
  w.endNight(null);
  check('maxed house rebuilt', plot.dead === false && plot.building.hp === maxHp);
}

// ------------------------------------------------------------- a razed garrison
// destroyStruct kills the plot's troops; the rebuild has to get them back.
console.log('a razed garrison is manned again at dawn');
{
  const w = makeWorld();
  const plot = plotOf(w, 'unit');
  check('barracks placed', w.place(plot, 'barracks'));
  w.startNight([], null);
  raze(w, plot);
  const during = w.units.filter((u) => u.home === plot).length;
  check('troops died with it', during === 0, `${during} left`);
  w.endNight(null);
  const after = w.units.filter((u) => u.home === plot).length;
  check('troops back at dawn', after > 0, `${after} troops`);
}

// ----------------------------------------------------------------- a razed wall
// A rebuilt wall has to block the flow field again, or the rebuild is cosmetic.
console.log('a razed wall blocks again at dawn');
{
  const w = makeWorld();
  const plot = plotOf(w, 'wall');
  check('wall placed', w.place(plot, 'wall'));
  check('wall blocks', plot.building.stats.blocks === true);
  w.startNight([], null);
  raze(w, plot);
  w.endNight(null);
  check('wall standing at dawn', plot.dead === false);
  // pathing.js skips a plot when `!p.building || p.dead || !blocks`.
  const blocks = !!plot.building && !plot.dead && plot.building.stats.blocks;
  check('counted as a blocker again', blocks);
}

// ---------------------------------------------- the God of Destruction mutator
// "Buildings only heal 25% each morning, and destroyed ones take an extra day."
console.log('the God of Destruction delays the rebuild one day');
{
  const w = makeWorld([], ['destruction']);
  check('mutator applied', w.mods.slowRebuild === true && w.mods.repairFrac === 0.25);
  const plot = plotOf(w, 'eco');
  w.place(plot, 'house');
  const maxHp = plot.building.maxHp;

  w.startNight([], null);
  raze(w, plot);
  w.endNight(null);
  check('still rubble the first dawn', plot.dead === true);

  w.startNight([], null);
  w.endNight(null);
  check('rebuilt the second dawn', plot.dead === false);
  check('rebuilt at 25%', Math.abs(plot.building.hp - maxHp * 0.25) < 1e-9,
    `hp=${plot.building.hp} of ${maxHp}`);
}

// ------------------------------------------------------ income, not the structure
// The README's promise: the night it fell costs the income, not the building.
console.log('a lost building costs the income, not the structure');
{
  const w = makeWorld();
  const plot = plotOf(w, 'eco');
  w.place(plot, 'house');
  w.startNight([], null);
  w.endNight(null);
  const healthy = w.lastIncome;

  w.startNight([], null);
  raze(w, plot);
  w.endNight(null);
  check('paid less the morning it fell', w.lastIncome < healthy,
    `${w.lastIncome} vs ${healthy}`);

  w.startNight([], null);
  w.endNight(null);
  check('paying again once rebuilt', w.lastIncome === healthy,
    `${w.lastIncome} vs ${healthy}`);
}

console.log(failures === 0 ? '\nPASS' : `\nFAIL (${failures})`);
process.exit(failures === 0 ? 0 : 1);
