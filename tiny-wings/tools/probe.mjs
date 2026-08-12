#!/usr/bin/env node
// Headless physics probe.
//
// Runs scripted strategies against the real Terrain + Bird for a full run with the
// night chase active, and reports the skill curve plus the bounce rate. This is the
// instrument every physics tune is measured with: run it before a change, run it
// after, and compare.
//
//   node tools/probe.mjs            human-readable table
//   node tools/probe.mjs --json     machine-readable
//
// Strategies, weakest to strongest:
//   none     never presses
//   hold     presses the whole run
//   dive     presses only while the ground ahead falls away
//   skilled  the same, plus aiming mid-air so it lands on a downslope
//
// The night-chase constants are mirrored from game.js; keep them in step.

import { Terrain, SEA_LEVEL } from '../src/terrain.js';
import { Bird, BIRD_R } from '../src/physics.js';
import { Race, RACE_METRES, RIVAL_PROFILES } from '../src/race.js';

const SUBSTEP = 1 / 300;
const FRAME = 1 / 60;
const NIGHT_SPEED0 = 108;
const NIGHT_RAMP = 1.05;
const NIGHT_SPEED_MAX = 420;
const NIGHT_HEADSTART = 1250;
const ISLAND_PUSHBACK = 980;
const MAX_TIME = 420;
// What counts as "flying" rather than "chattering along the hill". The player's
// complaint is about arcs, not about the launch flag flipping: a hop of a tenth of a
// second and half a bird-height off the grass is technically airborne and reads as
// nothing. An arc that lasts REAL_ARC_S and clears REAL_ARC_CLEAR world units (=2.5 m
// displayed) is one you can see and steer.
const REAL_ARC_S = 0.55;
const REAL_ARC_CLEAR = 25;

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

// A strategy is a FACTORY: called once per run, it returns the per-frame decision
// function (bird, terrain, elapsed) -> bool. Factories rather than bare functions because
// the human models below carry state (their own delayed view of the world).
const STRATEGIES = {
  none: () => () => false,
  hold: () => () => true,
  dive: () => (b, t) => (b.grounded ? t.slope(b.x + 4) < -0.02 : false),
  // Mirrors game.js's ?autoplay=1 bot: on the ground, dive down slopes; in the air,
  // integrate the arc forward and dive only if that lands it on a downslope.
  skilled: () => (b, t) => {
    if (b.grounded) return t.slope(b.x + 4) < -0.02;
    let x = b.x, y = b.y, vy = b.vy;
    for (let i = 0; i < 70; i++) {
      x += b.vx / 70; vy -= 620 / 70; y += vy / 70;
      if (y <= t.height(x) + BIRD_R) break;
    }
    return t.slope(x) < -0.05 && vy < 0;
  },
  // --- human models ---------------------------------------------------------------
  // `dive` and `skilled` above are frame-perfect oracles: they read the exact slope and
  // act on it the same frame. A person cannot, and the gap between those two facts is
  // what a distance-only probe hides. These two decide at a human rate, from a view of
  // the world that is `lag` seconds stale, and they are the rows to watch when the
  // question is "can a player actually fly" rather than "how far can a bot get".
  //
  //   human   reads the crest coming (looks 40 units ahead) — a player who has understood
  //           the mechanic and is trying to time the release
  //   sloppy  reacts to the slope under the bird — a player who has not yet worked out
  //           that the release has to be early
  human: () => humanModel({ rate: 8, lag: 0.18, look: 40 }),
  sloppy: () => humanModel({ rate: 8, lag: 0.18, look: 4 }),
};

/** A player with reaction latency, a finite decision rate, and a look-ahead distance. */
function humanModel({ rate, lag, look }) {
  const seen = [];
  let nextDecision = 0;
  let held = false;
  return (b, t, elapsed) => {
    seen.push({ t: elapsed, x: b.x, grounded: b.grounded });
    while (seen.length > 2 && seen[0].t < elapsed - lag - 0.02) seen.shift();
    const past = seen[0];
    if (elapsed >= nextDecision) {
      nextDecision = elapsed + 1 / rate;
      held = past.grounded ? t.slope(past.x + look) < -0.02 : false;
    }
    return held;
  };
}

function run(makeStrategy, daySeed) {
  const terrain = new Terrain((daySeed ^ 0x2f6a1b3d) >>> 0);
  const bird = new Bird(terrain);
  bird.reset(terrain.startX());
  bird.vx = 160;
  bird.vy = 0;
  const strategy = makeStrategy();

  const startX = bird.x;
  let nightX = startX - NIGHT_HEADSTART;
  let elapsed = 0;
  let lastIsland = 0;
  let distance = 0;
  let bounces = 0;
  let bounces60 = 0;
  let hardLandings = 0;
  let slides = 0;
  let topSpeed = 0;
  let islands = 1;
  // Softlock watch: the longest the bird ever went without gaining 20 world units (2 m)
  // of ground. The crawl force (WADDLE_K) is what keeps this small; if it ever climbs
  // into the tens of seconds, the bird is parked in a pocket somewhere.
  let stallSince = 0;
  let stallFromX = bird.x;
  let worstStall = 0;

  // --- flight book: one record per grounded->airborne transition ---
  // This is the instrument for "I can't fly": distance says nothing about whether the
  // bird ever leaves the hill, and a launch COUNT says nothing about whether the arc
  // was big enough to read as flight. So each flight records how long it lasted and how
  // far it got above the hill under it (measured over land only — skimming a bay reads
  // as huge clearance above a sea floor 28 units down, which is not flying).
  const flights = [];
  let flight = null;
  let prevGrounded = bird.grounded;
  let airTotal = 0;

  while (elapsed < MAX_TIME) {
    bird.diving = strategy(bird, terrain, elapsed);

    let acc = FRAME;
    while (acc > 0) {
      const h = Math.min(SUBSTEP, acc);
      bird.step(h);
      acc -= h;
    }
    elapsed += FRAME;

    if (!bird.grounded) {
      airTotal += FRAME;
      if (prevGrounded) flight = { t0: elapsed, peak: 0, wet: false };
      if (flight) {
        const gh = terrain.height(bird.x);
        if (gh > SEA_LEVEL) flight.peak = Math.max(flight.peak, bird.y - gh - BIRD_R);
        if (bird.inWater) flight.wet = true;
      }
    } else if (!prevGrounded && flight) {
      flight.air = elapsed - flight.t0;
      flights.push(flight);
      flight = null;
    }
    prevGrounded = bird.grounded;

    for (const e of bird.events) {
      if (e.type === 'land' && e.bounce) {
        bounces++;
        if (elapsed <= 60) bounces60++;
      }
      if (e.type === 'land' && !e.bounce && e.impact > 90) hardLandings++;
      if (e.type === 'greatSlide') slides++;
    }
    bird.events.length = 0;

    const nightSpeed = Math.min(NIGHT_SPEED_MAX, NIGHT_SPEED0 + elapsed * NIGHT_RAMP);
    nightX += nightSpeed * FRAME;

    const island = terrain.islandIndexAt(bird.x);
    if (island > lastIsland) {
      nightX -= ISLAND_PUSHBACK;
      lastIsland = island;
      islands = island + 1;
    }

    distance = Math.max(distance, (bird.x - startX) / 10);
    topSpeed = Math.max(topSpeed, bird.speed);

    if (bird.x > stallFromX + 20) { stallFromX = bird.x; stallSince = elapsed; }
    worstStall = Math.max(worstStall, elapsed - stallSince);

    if (nightX >= bird.x - BIRD_R) break;
  }

  if (flight) { flight.air = elapsed - flight.t0; flights.push(flight); }

  const airs = flights.map((f) => f.air);
  const peaks = flights.map((f) => f.peak);
  const real = flights.filter((f) => f.air >= REAL_ARC_S && f.peak >= REAL_ARC_CLEAR);

  return {
    survived: elapsed,
    distance,
    islands,
    bounces,
    bounces60,
    hardLandings,
    slides,
    topSpeed,
    worstStall,
    bouncesPer60: (bounces / elapsed) * 60,
    // flight metrics
    launches: flights.length,
    launchesPer60: (flights.length / elapsed) * 60,
    realArcs: real.length,
    realArcsPer60: (real.length / elapsed) * 60,
    airFrac: airTotal / elapsed,
    airMed: median(airs),
    airMax: airs.length ? Math.max(...airs) : 0,
    peakMed: median(peaks),
    peakMax: peaks.length ? Math.max(...peaks) : 0,
    // the same two, restricted to arcs that actually read as flight
    realAirMed: median(real.map((f) => f.air)),
    realPeakMed: median(real.map((f) => f.peak)),
  };
}

// ---------------------------------------------------------------- race probe
// Runs the race course with the three AI profiles plus a scripted "player" of a given
// strategy, and reports who wins. This is how the rival skill levels were set: the
// field has to straddle a competent player, or the race is a foregone conclusion.
function raceProbe(makePlayerStrategy, daySeed, raceSeed) {
  const terrain = new Terrain((daySeed ^ 0x2f6a1b3d) >>> 0);
  const startX = terrain.startX();
  const race = new Race(terrain);
  race.reset(startX, raceSeed >>> 0);

  const bird = new Bird(terrain);
  bird.reset(startX);
  bird.vx = 160; bird.vy = 0;
  const playerStrategy = makePlayerStrategy();

  let clock = 0;
  while (clock < 300) {
    bird.diving = playerStrategy(bird, terrain, clock);
    let acc = FRAME;
    while (acc > 0) { const h = Math.min(SUBSTEP, acc); bird.step(h); acc -= h; }
    bird.events.length = 0;
    clock += FRAME;
    if (race.update(FRAME, bird)) break;
    if (race.rivals.every((r) => r.finishTime !== null) && clock > 250) break;
  }
  return {
    playerTime: race.playerFinish,
    place: race.playerPlace || 4,
    rivals: race.rivals.map((r) => ({ name: r.name, time: r.finishTime, skill: r.skill })),
  };
}

if (process.argv.includes('--race')) {
  const players = ['hold', 'dive', 'skilled'];
  console.log('');
  console.log(`race probe — ${RACE_METRES} m course, 24 races per scripted player`);
  console.log('');
  for (const p of players) {
    const results = [];
    for (let s = 0; s < 24; s++) {
      results.push(raceProbe(STRATEGIES[p], (20260812 + (s % 6)) >>> 0, 1000 + s * 37));
    }
    const places = [0, 0, 0, 0];
    for (const r of results) places[Math.min(3, r.place - 1)]++;
    const finished = results.filter((r) => r.playerTime !== null);
    const avgT = finished.length
      ? (finished.reduce((a, r) => a + r.playerTime, 0) / finished.length).toFixed(1) : '—';
    const rivalT = {};
    for (const nm of RIVAL_PROFILES.map((x) => x.name)) {
      const ts = results.flatMap((r) => r.rivals.filter((x) => x.name === nm && x.time !== null).map((x) => x.time));
      rivalT[nm] = ts.length ? (ts.reduce((a, b) => a + b, 0) / ts.length).toFixed(1) : '—';
    }
    console.log(`player "${p}": ${avgT}s   places 1st/2nd/3rd/4th = ${places.join('/')}   ` +
      `win rate ${Math.round((places[0] / results.length) * 100)}%`);
    console.log(`   rival times  ${Object.entries(rivalT).map(([k, v]) => `${k} ${v}s`).join('   ')}`);
  }
  console.log('');
  process.exit(0);
}

const seeds = [20260812, 1, 2, 3, 4, 5, 6, 7];
const out = {};
for (const name of Object.keys(STRATEGIES)) {
  const runs = seeds.map((s) => run(STRATEGIES[name], s >>> 0));
  const avg = (k) => runs.reduce((a, r) => a + r[k], 0) / runs.length;
  out[name] = {
    survived: +avg('survived').toFixed(1),
    distance: Math.round(avg('distance')),
    islands: +avg('islands').toFixed(1),
    bounces: +avg('bounces').toFixed(1),
    bounces60: +avg('bounces60').toFixed(1),
    bouncesPer60: +avg('bouncesPer60').toFixed(1),
    hardLandings: +avg('hardLandings').toFixed(1),
    slides: +avg('slides').toFixed(1),
    topSpeed: Math.round(avg('topSpeed')),
    worstStall: +Math.max(...runs.map((r) => r.worstStall)).toFixed(1),
    launchesPer60: +avg('launchesPer60').toFixed(1),
    realArcsPer60: +avg('realArcsPer60').toFixed(1),
    airFrac: +avg('airFrac').toFixed(3),
    airMed: +avg('airMed').toFixed(2),
    airMax: +Math.max(...runs.map((r) => r.airMax)).toFixed(2),
    peakMed: +avg('peakMed').toFixed(1),
    peakMax: +Math.max(...runs.map((r) => r.peakMax)).toFixed(1),
    realAirMed: +avg('realAirMed').toFixed(2),
    realPeakMed: +avg('realPeakMed').toFixed(1),
    ref: {
      survived: +runs[0].survived.toFixed(1),
      distance: Math.round(runs[0].distance),
      islands: runs[0].islands,
      bounces60: runs[0].bounces60,
    },
  };
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(out, null, 2));
} else {
  console.log('');
  console.log(`physics probe — ${seeds.length} day seeds, full run with the night chase`);
  console.log('');
  console.log('strategy  survives  distance  islands  slides  bounce/60s  hardLand  topSpd  worstStall');
  for (const [k, v] of Object.entries(out)) {
    console.log(
      k.padEnd(9) +
      `${v.survived}s`.padStart(8) +
      `${v.distance} m`.padStart(10) +
      `${v.islands}`.padStart(9) +
      `${v.slides}`.padStart(8) +
      `${v.bouncesPer60}`.padStart(12) +
      `${v.hardLandings}`.padStart(10) +
      `${v.topSpeed}`.padStart(8) +
      `${v.worstStall}s`.padStart(12),
    );
  }
  console.log('');
  console.log('flight — is the bird actually getting airborne, and does the arc read as flight?');
  console.log('  (height in metres above the hill under it; "arcs" = airtime >= ' +
    `${REAL_ARC_S}s AND clearance >= ${REAL_ARC_CLEAR / 10} m)`);
  console.log('');
  console.log('strategy  launch/60s  arcs/60s  air%   airMed  airMax   hMed    hMax  arcAirMed  arcHMed');
  for (const [k, v] of Object.entries(out)) {
    console.log(
      k.padEnd(9) +
      `${v.launchesPer60}`.padStart(11) +
      `${v.realArcsPer60}`.padStart(10) +
      `${Math.round(v.airFrac * 100)}%`.padStart(6) +
      `${v.airMed}s`.padStart(9) +
      `${v.airMax}s`.padStart(8) +
      `${(v.peakMed / 10).toFixed(1)}m`.padStart(8) +
      `${(v.peakMax / 10).toFixed(1)}m`.padStart(8) +
      `${v.realAirMed}s`.padStart(11) +
      `${(v.realPeakMed / 10).toFixed(1)}m`.padStart(9),
    );
  }
  console.log('');
  console.log('reference seed 20260812 only:');
  for (const [k, v] of Object.entries(out)) {
    console.log(`  ${k.padEnd(9)} ${`${v.ref.survived}s`.padStart(7)} ${`${v.ref.distance} m`.padStart(9)}  islands ${v.ref.islands}  bounces(60s) ${v.ref.bounces60}`);
  }
  console.log('');
}
