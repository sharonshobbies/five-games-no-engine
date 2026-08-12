// Headless AI probe. Drives the simulation modules directly -- no browser, no
// renderer -- so bot behaviour can be measured over simulated minutes instead of
// eyeballed over seconds. Every number quoted in README.md and FIDELITY.md comes
// from this file.
//
//   node tools/probe-ai.mjs deaths  [secs] [seeds]   classify every death
//   node tools/probe-ai.mjs pockets [secs] [seeds]   can a boxed-in bot get out
//   node tools/probe-ai.mjs player  [secs] [seeds]   can a player still cut bots off
//   node tools/probe-ai.mjs perf    [secs]           simulation cost per update
//
// Several seeds are averaged because one world is noisy; the defaults below are
// the six used for the committed figures. Output is JSON on stdout.

import { World } from '../src/world.js';
import { SKINS } from '../src/config.js';

const MODE = process.argv[2] || 'deaths';
const SECONDS = Number(process.argv[3] || 300);
const SEEDS = (process.argv[4] || '1234,99,777777,20260812,5150,31337').split(',').map(Number);
const DT = 1 / 60;
const RING = 16;

const median = (a) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pctl = (a, p) => {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))];
};
const r2 = (n) => +n.toFixed(2);

/** Fresh world with all bots alive and no player. */
function botWorld(seed) {
  const w = new World(seed);
  w.fillBots();
  return w;
}

/**
 * How closed is a body around this snake's head? Bins the bearing of every
 * matching body node within `reach` into 24 sectors: a real trap leaves no wide
 * gap. `owner` < 0 means "any snake but this one".
 */
function enclosure(w, s, owner, reach) {
  const BINS = 24;
  const bins = new Uint8Array(BINS);
  const g = w.bodyGrid;
  g.forEachNear(s.x, s.y, reach, (i) => {
    if (owner >= 0 ? g.tag[i] !== owner : g.tag[i] === s.id) return;
    const dx = g.x[i] - s.x;
    const dy = g.y[i] - s.y;
    if (dx * dx + dy * dy > reach * reach) return;
    let b = Math.floor(((Math.atan2(dy, dx) + Math.PI) / (Math.PI * 2)) * BINS);
    bins[b < 0 ? 0 : b >= BINS ? BINS - 1 : b] = 1;
  });
  let occ = 0;
  for (const v of bins) occ += v;
  let gap = BINS;
  if (occ > 0) {
    gap = 0;
    let run = 0;
    for (let k = 0; k < BINS * 2; k++) {
      if (!bins[k % BINS]) { run++; if (run > gap) gap = run; }
      else run = 0;
    }
    if (gap > BINS) gap = BINS;
  }
  return { occDeg: (occ / BINS) * 360, gapDeg: (gap / BINS) * 360 };
}

/** Blocked/open count in 16 directions out of a snake's head. AI-independent. */
function openSectors(w, s) {
  const g = w.bodyGrid;
  const myR = s.radius;
  const reach = Math.max((s.speed / Math.max(1e-4, s.turnRate)) * 2.3, myR * 7);
  const STEPS = 5;
  const step = reach / STEPS;
  const hitR = myR + 12 + step * 0.5;
  let open = 0;
  for (let k = 0; k < RING; k++) {
    const ca = Math.cos((k / RING) * Math.PI * 2);
    const sa = Math.sin((k / RING) * Math.PI * 2);
    let free = reach;
    for (let j = 1; j <= STEPS; j++) {
      const t = j * step;
      const px = s.x + ca * t;
      const py = s.y + sa * t;
      let hit = false;
      g.forEachNear(px, py, hitR + 70, (i) => {
        if (g.tag[i] === s.id) return;
        const dx = g.x[i] - px;
        const dy = g.y[i] - py;
        const rr = hitR + g.r[i];
        if (dx * dx + dy * dy < rr * rr) { hit = true; return true; }
      });
      if (hit) { free = t; break; }
    }
    if (free >= reach * 0.8) open++;
  }
  return open;
}

// ---------------------------------------------------------------- deaths
function deaths() {
  const lifetimes = [];
  const hist = { '0-3': 0, '3-5': 0, '5-10': 0, '10-20': 0, '20-40': 0, '40+': 0 };
  const bearing = { head: 0, oblique: 0, side: 0, behind: 0 };
  const age = { neck: 0, recent: 0, mid: 0, old: 0 };
  const byKiller = {};
  const coilArcs = [];
  const killOcc = [];
  const killGap = [];
  let n = 0, wall = 0, boosting = 0, ownTarget = 0, enc = 0, encDeliberate = 0;
  let commits = 0, coilKills = 0, held = [];
  let botFrames = 0, boostFrames = 0, coilFrames = 0, trapFrames = 0, targetFrames = 0;
  const leaders = [], means = [];
  let secs = 0;

  for (const seed of SEEDS) {
    const w = botWorld(seed);
    const raw = w.kill.bind(w);
    w.kill = function (s, byWall, killerId) {
      if (!s.alive) return;
      const life = w.time - s.bornAt;
      n++;
      lifetimes.push(life);
      hist[life < 3 ? '0-3' : life < 5 ? '3-5' : life < 10 ? '5-10'
        : life < 20 ? '10-20' : life < 40 ? '20-40' : '40+']++;
      if (s.boosting) boosting++;
      if (byWall) wall++;
      else {
        const k = killerId >= 0 ? w.snakes[killerId] : null;
        const kind = k && k.brain ? k.brain.kind : (killerId === 0 ? 'player' : '?');
        byKiller[kind] = (byKiller[kind] || 0) + 1;
        if (s.brain && s.brain.targetId === killerId) ownTarget++;

        const tr = s.speed / Math.max(1e-4, s.turnRate);
        const e = enclosure(w, s, killerId, Math.max(520, Math.min(2200, tr * 2.6)));
        const trapped = e.occDeg >= 223 && e.gapDeg <= 105;
        if (trapped) {
          enc++;
          if (k && k.brain && k.brain.targetId === s.id) encDeliberate++;
        }
        // The strictest evidence of a coil: the killer held a committed ring
        // around THIS snake at the moment it died on that body.
        if (k && k.brain && k.brain.coilOn && k.brain.coilId === s.id) {
          coilKills++;
          killOcc.push(e.occDeg);
          killGap.push(e.gapDeg);
        }
        // Was the fatal node fresh (a cut-off) or an established wall the victim
        // drove into? And did it sit ahead of the victim or come from the side?
        const g = w.bodyGrid;
        let bd = Infinity, bx = 0, by = 0;
        g.forEachNear(s.x, s.y, s.radius * 4 + 60, (i) => {
          if (g.tag[i] !== killerId) return;
          const dx = g.x[i] - s.x;
          const dy = g.y[i] - s.y;
          const d = dx * dx + dy * dy;
          if (d < bd) { bd = d; bx = dx; by = dy; }
        });
        if (bd < Infinity) {
          const off = Math.abs(((Math.atan2(by, bx) - s.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
          const deg = (off * 180) / Math.PI;
          bearing[deg < 40 ? 'head' : deg < 75 ? 'oblique' : deg < 115 ? 'side' : 'behind']++;
          if (k && k.alive) {
            const o = [0, 0];
            let best = Infinity, arc = 0;
            const stride = Math.max(8, k.radius * 0.8);
            for (let d = 0; d <= k.bodyLength; d += stride) {
              k.pointBack(d, o);
              const q = (o[0] - (s.x + bx)) ** 2 + (o[1] - (s.y + by)) ** 2;
              if (q < best) { best = q; arc = d; }
            }
            const t = arc / (k.speed * 125);
            age[t < 0.35 ? 'neck' : t < 1.2 ? 'recent' : t < 3 ? 'mid' : 'old']++;
          }
        }
      }
      raw(s, byWall, killerId);
    };

    const prevCoil = new Map();
    const startedAt = new Map();
    const steps = Math.round(SECONDS / DT);
    for (let i = 0; i < steps; i++) {
      w.update(DT, null);
      for (const s of w.snakes) {
        if (!s.brain) continue;
        const on = s.alive && s.brain.coilOn;
        if (on && !prevCoil.get(s.id)) { commits++; startedAt.set(s.id, w.time); }
        if (!on && prevCoil.get(s.id)) {
          const t0 = startedAt.get(s.id);
          if (t0 !== undefined) held.push(w.time - t0);
          coilArcs.push((Math.abs(s.brain.coilArc || 0) * 180) / Math.PI);
        }
        prevCoil.set(s.id, on);
      }
      if (i % 6 === 0) {
        for (const s of w.snakes) {
          if (!s.alive || !s.brain) continue;
          botFrames++;
          if (s.boosting) boostFrames++;
          if (s.brain.coilOn) coilFrames++;
          if (s.brain.trapT > 0) trapFrames++;
          if (s.brain.targetId >= 0) targetFrames++;
        }
        if (i % 600 === 0 && i > 0) {
          const board = w.leaderboard();
          leaders.push(board[0] ? board[0].mass : 0);
          let sum = 0, c = 0;
          for (const s of w.snakes) if (s.alive) { sum += s.mass; c++; }
          means.push(c ? sum / c : 0);
        }
      }
    }
    secs += SECONDS;
  }

  const perMin = (v) => r2(v / (secs / 60));
  return {
    mode: 'deaths', seeds: SEEDS, simSeconds: secs,
    deathsPerSec: r2(n / secs),
    lifetime: {
      // Little's law: with the population held at 30, mean life is
      // population / death rate. Unbiased, unlike a median over the deaths that
      // happen to fall inside a finite window.
      meanBySteadyState: r2(30 / (n / secs)),
      median: r2(median(lifetimes)),
      p25: r2(pctl(lifetimes, 0.25)), p75: r2(pctl(lifetimes, 0.75)),
      p90: r2(pctl(lifetimes, 0.9)), max: r2(Math.max(0, ...lifetimes)),
      histogram: hist,
    },
    cause: {
      wallPct: r2((100 * wall) / n),
      boostingAtDeathPct: r2((100 * boosting) / n),
      killedByOwnTargetPct: r2((100 * ownTarget) / (n - wall)),
      // ahead of the victim = it drove in; side = something crossed into it
      fatalNodeBearing: bearing,
      // neck = laid down within 0.35s of the killer's head passing: a cut-off
      fatalNodeAge: age,
      byKillerPersonality: byKiller,
    },
    coil: {
      commitsPerMin: perMin(commits),
      heldMedianSecs: r2(median(held)),
      heldMaxSecs: r2(Math.max(0, ...held)),
      killsOfWrappedVictim: coilKills,
      killsOfWrappedVictimPerMin: perMin(coilKills),
      conversionPct: r2((100 * coilKills) / (commits || 1)),
      atKill: {
        bodyArcAroundVictimDegMedian: Math.round(median(killOcc)),
        widestEscapeGapDegMedian: Math.round(median(killGap)),
      },
      ringTravelDegMedian: Math.round(median(coilArcs)),
      ringTravelDegMax: Math.round(Math.max(0, ...coilArcs)),
      ringsPast270Deg: coilArcs.filter((a) => a >= 270).length,
    },
    encirclementDeaths: {
      // >=223 deg of one snake's body around the victim's head, no gap over 105
      total: enc,
      perMin: perMin(enc),
      shareOfBodyDeathsPct: r2((100 * enc) / (n - wall)),
      byTheVictimsOwnHunter: encDeliberate,
    },
    behaviour: {
      boostDutyPct: r2((100 * boostFrames) / botFrames),
      coilDutyPct: r2((100 * coilFrames) / botFrames),
      breakoutDutyPct: r2((100 * trapFrames) / botFrames),
      hasTargetPct: r2((100 * targetFrames) / botFrames),
    },
    growth: {
      leaderMassMedian: Math.round(median(leaders)),
      meanMassMedian: Math.round(median(means)),
    },
  };
}

// ---------------------------------------------------------------- pockets
/**
 * Detects "boxed in" from outside the AI -- 12 or more of 16 directions shut --
 * then asks whether the snake is still alive 3 seconds later. Independent of
 * what the AI believes, so it compares fairly against any version of the bots.
 */
function pockets() {
  const TIGHT = 4;
  const VERDICT = 3.0;
  let episodes = 0, escaped = 0, died = 0, allDeaths = 0, secs = 0;
  for (const seed of SEEDS) {
    const w = botWorld(seed);
    const open = new Map();
    const raw = w.kill.bind(w);
    w.kill = function (s, byWall, killerId) {
      if (!s.alive) return;
      allDeaths++;
      const ep = open.get(s.id);
      if (ep && ep.born === s.bornAt) { episodes++; died++; open.delete(s.id); }
      raw(s, byWall, killerId);
    };
    let nextScan = 0;
    const steps = Math.round(SECONDS / DT);
    for (let i = 0; i < steps; i++) {
      w.update(DT, null);
      for (const [id, ep] of open) {
        const s = w.snakes[id];
        if (!s.alive || s.bornAt !== ep.born) { open.delete(id); continue; }
        if (w.time - ep.start >= VERDICT) { episodes++; escaped++; open.delete(id); }
      }
      if (w.time >= nextScan) {
        nextScan = w.time + 0.25;
        for (const s of w.snakes) {
          if (!s.alive || !s.brain || open.has(s.id)) continue;
          if (openSectors(w, s) <= TIGHT) open.set(s.id, { start: w.time, born: s.bornAt });
        }
      }
    }
    secs += SECONDS;
  }
  return {
    mode: 'pockets', seeds: SEEDS, simSeconds: secs,
    openSectorsThreshold: `${TIGHT} of ${RING}`,
    episodes, escapedWithin3s: escaped, diedBoxedIn: died,
    escapeRatePct: r2((100 * escaped) / (episodes || 1)),
    boxedInDeathsShareOfAllPct: r2((100 * died) / (allDeaths || 1)),
  };
}

// ---------------------------------------------------------------- player
/**
 * A scripted player running the cut-off, so the player's kill rate can be
 * compared across bot versions. Crude -- it dies constantly -- but identical in
 * both arms, which is what makes it a regression test rather than a score.
 */
function player() {
  const START = 400;
  const intent = (w, p) => {
    let t = null, bd = 1800 * 1800;
    for (const o of w.snakes) {
      if (!o.alive || o.id === p.id) continue;
      const d = (o.x - p.x) ** 2 + (o.y - p.y) ** 2;
      if (d < bd && o.mass < p.mass * 3) { bd = d; t = o; }
    }
    if (!t) return { angle: Math.atan2(-p.y, -p.x), boost: false };
    const d = Math.sqrt(bd);
    const lead = Math.min(1.4, Math.max(0.2, d / Math.max(1, p.speed * 60)));
    const px = t.x + Math.cos(t.angle) * t.speed * 60 * lead;
    const py = t.y + Math.sin(t.angle) * t.speed * 60 * lead;
    const side = ((t.x - p.x) * Math.sin(p.angle) - (t.y - p.y) * Math.cos(p.angle)) > 0 ? 1 : -1;
    const ax = px + Math.cos(t.angle + (Math.PI / 2) * side) * t.radius * 4;
    const ay = py + Math.sin(t.angle + (Math.PI / 2) * side) * t.radius * 4;
    return {
      angle: Math.atan2(ay - p.y, ax - p.x),
      boost: d > 500 && d < 1500 && p.mass > 120,
    };
  };

  let kills = 0, deaths = 0, alive = 0, secs = 0;
  for (const seed of SEEDS) {
    const w = botWorld(seed);
    let p = w.startPlayer('probe', SKINS[0]);
    p.mass = START;
    const steps = Math.round(SECONDS / DT);
    for (let i = 0; i < steps; i++) {
      if (!p.alive) {
        kills += p.kills;
        deaths++;
        p = w.startPlayer('probe', SKINS[0]);
        p.mass = START;
      }
      alive += DT;
      w.update(DT, intent(w, p));
    }
    kills += p.kills;
    secs += SECONDS;
  }
  return {
    mode: 'player', seeds: SEEDS, simSeconds: secs,
    playerKills: kills,
    killsPerMinuteAlive: r2(kills / (alive / 60)),
    playerDeaths: deaths,
  };
}

// ---------------------------------------------------------------- perf
function perf() {
  const w = botWorld(4242);
  for (let i = 0; i < 60 * 30; i++) w.update(DT, null); // warm to steady state
  const N = 60 * 60;
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) w.update(DT, null);
  const ms = Number(process.hrtime.bigint() - t0) / 1e6 / N;
  let sum = 0, c = 0;
  for (const s of w.snakes) if (s.alive) { sum += s.mass; c++; }
  return {
    mode: 'perf', msPerUpdate: +ms.toFixed(3),
    snakes: c, meanMass: Math.round(sum / c),
    orbs: w.food.count, collisionNodes: w.collisionNodes,
  };
}

const modes = { deaths, pockets, player, perf };
if (!modes[MODE]) {
  console.error(`unknown mode "${MODE}" -- expected one of ${Object.keys(modes).join(', ')}`);
  process.exit(2);
}
console.log(JSON.stringify(modes[MODE](), null, 2));
