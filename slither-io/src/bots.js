// Bot AI.
//
// Steering is candidate-fan scoring, not pathfinding: each bot fans out 15
// candidate headings around its current one, walks a probe along the arc it
// would actually fly to reach each one, and scores it. The winner becomes the
// target angle, which the snake's own limited turn rate then chases. That single
// mechanism gives wall avoidance, body dodging, food seeking and interception at
// once, and it degrades gracefully -- a bot boxed in picks the least-bad heading
// instead of freezing.
//
// On top of that sit four personalities, which change the score weights and
// the boost policy:
//   grazer    - food first, very timid
//   scrapper  - hunts snakes near its own size, boosts to close
//   assassin  - intercepts a target's future position to cut it off
//   coiler    - wraps a snake it can out-turn and holds the ring shut
//
// Two behaviours sit above the fan and can override it:
//   - a committed coil (the encirclement kill): a state machine that holds a
//     ring around one victim and keeps arriving across its nose, since a snake
//     only turns when something is in front of it
//   - a break-out, when a ring scan says this bot is the one being enclosed
//
// Bots deliberately do NOT get perfect information: they see bodies only along
// their own probe, neighbours only within 1100 units, and a neighbour's heading
// only 0.56s ahead in a straight line -- and reaction is throttled to a few times
// a second, so they can be baited.

import { ARENA_R, BOOST_MIN_MASS, TICKS_PER_SEC, SPEED_SCALE } from './config.js';
import { TAU, angleDelta, clamp, pick, randRange, turnToward } from './math.js';

export const PERSONALITIES = ['grazer', 'grazer', 'scrapper', 'scrapper', 'assassin', 'coiler'];

const THREAT_R2 = 1100 * 1100;

// Probe geometry, as multiples of the bot's own turn radius and body radius.
const PROBE_TR = 1.75;
const PROBE_R = 2.0;
// The clamp on the result is in world units, so it carries SPEED_SCALE: the
// probe length is what every safety fraction below (the 0.62/0.7/0.93 boost
// gates, clear/probeLen, dangerRoom) is measured against, and it is only
// meaningful as a proportion of the turn circle it was tuned against. Left at
// the unscaled 320 the floor would have started binding for thin snakes, whose
// probe is now 221 units, and quietly loosened their danger cliff from 0.92 of
// the probe to 0.64.
const PROBE_MIN = 320 * SPEED_SCALE;
const PROBE_MAX = 2600 * SPEED_SCALE;
// Room a heading must leave before it counts as safe. What matters is the ratio
// of this to the probe length, and it is a strong lever: widening the margin from
// 0.9 turn radii to 1.4 took bot deaths from 2.61/sec to 2.00/sec with nothing
// else changed. A graded penalty instead of the cliff below was tried and lost.
const DANGER_TR = 1.6;
const DANGER_R = 2.0;
// Weight on "this heading crosses a path that is about to become a body", and
// how far ahead a neighbour's heading is extrapolated when judging that.
const CROSS_W = 190;
const CROSS_LEAD = 70; // ticks, ~0.56s

// Threats, flattened into scratch arrays: the fan reads them ~200 times per
// decision and Snake.speed/radius are computed getters (a Math.pow each).
const TH_CAP = 40;
const TH_X = new Float64Array(TH_CAP);
const TH_Y = new Float64Array(TH_CAP);
const TH_CA = new Float64Array(TH_CAP);
const TH_SA = new Float64Array(TH_CAP);
const TH_SP = new Float64Array(TH_CAP);
const TH_R = new Float64Array(TH_CAP);
const TH_ID = new Int32Array(TH_CAP);
let thN = 0;

const FAN = [
  0, 0.13, -0.13, 0.28, -0.28, 0.46, -0.46, 0.70, -0.70,
  1.0, -1.0, 1.45, -1.45, 2.0, -2.0,
];

// Ring scan for the break-out check.
const RING = 16;
const ringFree = new Float64Array(RING);
const GAP_OUT = [0, 0]; // [angle, width in sectors]

export function makeBrain(rng) {
  return {
    kind: pick(rng, PERSONALITIES),
    think: 0,
    thinkEvery: randRange(rng, 0.055, 0.14), // seconds between decisions
    boostTimer: 0,
    targetId: -1,
    retarget: 0,
    coilDir: rng() < 0.5 ? 1 : -1,
    greed: randRange(rng, 0.7, 1.5),
    caution: randRange(rng, 0.7, 1.6),
    aggression: randRange(rng, 0.2, 1.0),
    wanderPhase: rng() * TAU,
    // committed coil
    wantCoil: false,
    coilOn: false,
    coilT: 0,
    coilR: 0,
    coilId: -1,
    coilSide: 1,
    coilAim: 0,
    coilArc: 0, // net radians travelled around the victim
    coilLastTh: 0,
    coilVAng: 0,
    coilBorn: -1,
    coilEnd: '',
    // break-out
    trapT: 0,
    trapA: 0,
    lastClearFrac: 1,
  };
}

/** Squared distance from a point to a segment. No allocations. */
function segDist2(px, py, ax, ay, bx, by) {
  const vx = bx - ax;
  const vy = by - ay;
  const wx = px - ax;
  const wy = py - ay;
  const vv = vx * vx + vy * vy;
  let t = vv > 1e-9 ? (wx * vx + wy * vy) / vv : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  const dx = wx - vx * t;
  const dy = wy - vy * t;
  return dx * dx + dy * dy;
}

/**
 * Decide targetAngle and boosting for one bot.
 *
 * @param {Snake} s
 * @param {World} world
 * @param {number} dt seconds
 */
export function driveBot(s, world, dt) {
  const b = s.brain;
  b.think -= dt;
  b.boostTimer -= dt;
  b.retarget -= dt;
  b.coilT -= dt;
  b.trapT -= dt;
  if (b.think > 0) return;
  b.think = b.thinkEvery;

  const rng = world.rng;
  const bodies = world.bodyGrid;
  const foods = world.foodGrid;

  // Getters recompute parts/sc (a Math.pow) on every read; cache them once.
  const speed = s.speed;
  const turnRate = Math.max(1e-4, s.turnRate);
  const myR = s.radius;
  const cur = s.angle;
  const dcentre = Math.hypot(s.x, s.y);

  // How far ahead a bot must look is set by its own turn radius, not by a
  // constant. Both speed and turn rate are per-tick, so speed/turnRate is the
  // circle a snake carves at full lock, in world units. For a thin snake that
  // is ~116 units; for a fat one it is ~525, and for a fat one sprinting it is
  // ~1010. A fixed 760-unit probe was therefore blind for exactly the snakes
  // that most needed the warning: they physically could not complete a 90 degree
  // turn inside the distance they were checking. (These figures are the
  // pre-SPEED_SCALE 166/750/1440 at the 0.70 the arena now runs at; every one of
  // them is a distance, so they all moved by the same factor and none of the
  // ratios this file is tuned on did.)
  const turnRadius = speed / turnRate;
  // Angular rate saturates at SPANGDV, which every snake exceeds at base speed,
  // so turnRate is identical boosted or not. The un-boosted turn radius is
  // therefore just baseSpeed/turnRate, and it is the right number for planning
  // geometry a boost must not invalidate.
  const trBase = s.baseSpeed / turnRate;
  const probeLen = clamp(turnRadius * PROBE_TR + myR * PROBE_R, PROBE_MIN, PROBE_MAX);
  const dangerRoom = turnRadius * DANGER_TR + myR * DANGER_R;

  // ---------------------------------------------------------- pick a victim
  if (b.retarget <= 0 && !b.coilOn) {
    b.retarget = randRange(rng, 0.6, 1.6);
    b.targetId = chooseTarget(s, world, b, trBase);
  }
  let victim = b.targetId >= 0 ? world.snakes[b.targetId] : null;
  if (victim && !victim.alive) victim = null;

  // ---------------------------------------------------------- coil state
  // 0 = not coiling, 1 = closing onto the ring, 2 = ring committed and held
  const coilMode = updateCoil(s, world, b, victim, trBase);
  const coiling = coilMode === 2;

  // Nearby foreign heads, flattened. A static body probe cannot see a head-on
  // approach: both snakes are moving, so the collision happens in space neither
  // of them currently occupies.
  thN = 0;
  for (const o of world.snakes) {
    if (!o.alive || o.id === s.id) continue;
    const dx = o.x - s.x;
    const dy = o.y - s.y;
    if (dx * dx + dy * dy >= THREAT_R2 || thN >= TH_CAP) continue;
    TH_X[thN] = o.x;
    TH_Y[thN] = o.y;
    TH_CA[thN] = Math.cos(o.angle);
    TH_SA[thN] = Math.sin(o.angle);
    TH_SP[thN] = o.speed;
    TH_R[thN] = o.radius;
    TH_ID[thN] = o.id;
    thN++;
  }

  // ---------------------------------------------------------- break-out check
  //
  // A closing loop used to read only as diminishing clearance, so a bot would
  // orbit inside a tightening ring until it died. The ring scan asks the
  // different question: of the 16 directions out of here, how many are shut?
  // Past two thirds shut this is a pocket, not a wall, and the answer is to
  // commit to the widest remaining gap now rather than keep circling. Gated on
  // the previous decision's clearance so the scan costs nothing in open water.
  let trapped = false;
  if (b.lastClearFrac < 0.62 || b.trapT > 0) {
    const escapeLen = Math.max(turnRadius * 2.3, myR * 7);
    const open = scanEnclosure(s, bodies, myR, escapeLen);
    if (open <= RING * 0.4) {
      pickGap(cur, escapeLen, b);
      if (GAP_OUT[1] > 0) {
        trapped = true;
        b.trapA = GAP_OUT[0];
        b.trapT = 0.45;
      }
    } else if (open >= RING * 0.6) {
      b.trapT = 0;
    }
  }
  if (b.trapT > 0) trapped = true;

  // ---------------------------------------------------------- probe the fan
  let bestScore = -Infinity;
  let bestAngle = cur;
  let bestClear = 0;

  // A coiler closing onto its ring steers by the same tangent-and-radius blend
  // it will use to hold it, which spirals it onto the circle instead of
  // charging the victim's head. Only the committed ring gets the heavy weight.
  const intent = coilMode > 0 ? b.coilAim
    : (victim ? intentAngle(s, victim, b) : null);
  const intentW = coiling ? 640 : 300 * (0.5 + b.aggression);
  const foodW = (coiling ? 0.9 : 3.4) * b.greed;
  // Wrapping a snake means deliberately running a body-length from it, so the
  // probe's conservative inflation -- which exists to stop bots clipping bodies
  // they did not mean to touch -- reads the victim as a wall and vetoes the only
  // headings that hold the ring. Measured: rings lasted a median of 0.9s and one
  // in sixty got past 270 degrees. The victim being wrapped therefore gets a
  // near-contact test instead of an inflated one, and nothing else does.
  const softId = coiling ? b.coilId : -1;

  for (let f = 0; f < FAN.length; f++) {
    const a = cur + FAN[f];

    // --- danger: how far along the path we would actually fly before hitting
    //     something?
    //
    // Two things make this honest. It is a swept capsule, not a string of
    // points: with five bare samples over ~500 units the gaps between them were
    // 100 units wide -- wider than any snake -- so bots probed straight through
    // a body. Inflating each sample's test radius by half the sample spacing
    // closes the gaps, which makes the probe conservative (it can report a hit
    // slightly early) and that is the right way to be wrong.
    //
    // And it follows an arc, not a ray. A bot cannot teleport onto the heading
    // it picks; it turns onto it at its own rate, sweeping space a straight ray
    // from the head never samples. Probing the ray meant a bot could choose a
    // heading that was clear and die on the way to it.
    let clear = probeLen;
    let crossPen = 0;
    const STEPS = Math.round(clamp(probeLen / (myR * 1.7), 6, 16));
    const segLen = probeLen / STEPS;
    const segTicks = segLen / speed;
    const hitR = myR * 1.25 + 20 + segLen * 0.5;
    const softR = myR * 0.85 + 8;
    let px = s.x;
    let py = s.y;
    let pa = cur;
    for (let k = 1; k <= STEPS; k++) {
      pa = turnToward(pa, a, turnRate * segTicks);
      px += Math.cos(pa) * segLen;
      py += Math.sin(pa) * segLen;
      const t = k * segLen;
      if (Math.hypot(px, py) > ARENA_R - myR * 1.2) {
        clear = Math.min(clear, t);
        break;
      }
      let hit = false;
      bodies.forEachNear(px, py, hitR + 70, (i) => {
        const owner = bodies.tag[i];
        if (owner === s.id) return;
        const dx = bodies.x[i] - px;
        const dy = bodies.y[i] - py;
        const rr = (owner === softId ? softR : hitR) + bodies.r[i];
        if (dx * dx + dy * dy < rr * rr) {
          hit = true;
          return true;
        }
      });
      if (hit) {
        clear = Math.min(clear, t);
        break;
      }

      // --- the space a neighbour is about to turn into body
      //
      // 60% of bot deaths were on a node laid down within 0.35s of the killer's
      // head passing it: not a wall anybody drove into, but a snake crossing in
      // front and the victim eating the fresh neck. Penalising predicted HEAD
      // proximity cannot see that -- the two heads are never close. What matters
      // is whether this path crosses ground the neighbour will already have
      // covered, because that ground is its body by the time we arrive.
      // Extrapolate a neighbour's heading half a second, not the whole probe.
      // Straight-lining a fat snake's motion over the 1.4s its own probe spans
      // is more foresight than a player has, and it showed: a scripted player
      // running the cut-off scored 1.55 kills/min against bots that could see
      // that far and 2.1/min once the horizon was capped, for 0.7s of bot life.
      const ticks = Math.min(t / speed, CROSS_LEAD);
      for (let ti = 0; ti < thN; ti++) {
        // Crossing in front of the snake being wrapped is the entire move, so
        // the one thing a coiler is allowed to cut off is its own victim.
        if (TH_ID[ti] === softId) continue;
        const reach = TH_SP[ti] * ticks;
        const need = myR + TH_R[ti] + 30;
        const d2 = segDist2(
          px, py,
          TH_X[ti], TH_Y[ti],
          TH_X[ti] + TH_CA[ti] * reach, TH_Y[ti] + TH_SA[ti] * reach,
        );
        if (d2 < need * need) {
          // Weight the near future above the far, and normalise by step count
          // so the penalty does not depend on probe resolution.
          crossPen += (1 - Math.sqrt(d2) / need) * CROSS_W * (1 - (k - 1) / STEPS) * (16 / STEPS);
        }
      }
    }

    // Deep penalty for anything that runs out of room, scaled by caution.
    let score = (clear / probeLen) * 520 * b.caution;
    if (clear < dangerRoom) score -= 1300;
    score -= crossPen;

    // --- wall bias: prefer turning inward when near the rim
    if (dcentre > ARENA_R * 0.72) {
      const inward = Math.atan2(-s.y, -s.x);
      const align = Math.cos(angleDelta(a, inward));
      const urgency = (dcentre - ARENA_R * 0.72) / (ARENA_R * 0.28);
      score += align * 420 * urgency * urgency;
    }

    // --- food along this heading
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let foodScore = 0;
    for (let k = 1; k <= 3; k++) {
      const t = (k / 3) * probeLen * 0.9;
      const fx = s.x + ca * t;
      const fy = s.y + sa * t;
      const rad = 130 + k * 40;
      let m = 0;
      foods.forEachNear(fx, fy, rad, (i) => {
        const dx = foods.x[i] - fx;
        const dy = foods.y[i] - fy;
        if (dx * dx + dy * dy < rad * rad) m += world.food.mass[foods.tag[i]];
      });
      foodScore += m / k;
    }
    // Capped, not linear. A fresh corpse is 200-plus fat orbs in one place, which
    // uncapped scored high enough to outvote the danger term outright, so every
    // bot in range dived into the same feast and the pile-up was the single
    // largest remaining source of death: capping the food term at 260 took bot
    // deaths from 1.08/sec to 0.90/sec and median life from 20.0s to 25.1s
    // without slowing growth (leader mass held at ~2550). Ordinary foraging
    // scores about 110 and never reaches the cap, so only the frenzy is damped:
    // bots still race for a corpse, they just no longer ignore a snake in the way.
    score += Math.min(foodScore * foodW, 260);

    // --- momentum: no jittering
    score -= Math.abs(FAN[f]) * 26;

    // --- intent toward the victim, but only along headings that are actually
    // open. Unweighted, this term made aggressive bots drive into the very body
    // they were trying to cut off: 37% of bot deaths were to their own target.
    // Gating it on clearance is also just how the move is played -- you get in
    // front of a snake, you do not drive into it. A committed coil is the one
    // case that gets a linear gate rather than a quadratic one: wrapping a snake
    // means deliberately running close to it, and squaring the gate made
    // coilers bail out of every ring they started.
    if (intent !== null) {
      const openness = clamp((clear - dangerRoom) / probeLen, 0, 1);
      const gate = coiling ? openness : openness * openness;
      score += Math.cos(angleDelta(a, intent)) * intentW * gate;
    }

    // --- committed break-out
    if (trapped) score += Math.cos(angleDelta(a, b.trapA)) * 760;

    // --- gentle wander so idle bots don't beeline
    score += Math.cos(a * 1.7 + b.wanderPhase) * 12;

    if (score > bestScore) {
      bestScore = score;
      bestAngle = a;
      bestClear = clear;
    }
  }

  s.targetAngle = bestAngle;
  b.lastClearFrac = bestClear / probeLen;

  // ---------------------------------------------------------- boost policy
  //
  // Boosting was by far the biggest killer of bots: 55% of all bot deaths
  // happened mid-sprint. The reason is a property of the movement model rather
  // than the AI -- angular speed already saturates at base speed (spang caps at
  // 1), so a boost doubles the distance covered per tick without buying any
  // extra turn rate, which doubles the effective turn radius. A committed
  // sprint therefore has to be abandoned the moment the road ahead closes, and
  // it needs far more headroom to start than ordinary travel.
  // Expressed as a fraction of probeLen rather than an absolute distance: the
  // probe is already scaled to the boosted turn radius (s.speed feeds it), and
  // an absolute threshold derived from the boosted radius came out larger than
  // probeLen itself, which silently disabled bot boosting altogether.
  if (b.boostTimer > 0 && s.canBoost() && bestClear > probeLen * 0.62) {
    s.boosting = true;
    return;
  }
  b.boostTimer = 0;
  s.boosting = false;

  // Punching out of a closing ring is the one time a bot spends mass on a
  // straight line: the gap is narrowing, and the sprint only stays survivable
  // while it needs no turning, since a boost doubles the turn radius.
  if (trapped && s.canBoost() && GAP_OUT[1] > 0 && GAP_OUT[1] <= 5
      && Math.abs(angleDelta(cur, b.trapA)) < 0.5 && bestClear > probeLen * 0.7) {
    b.boostTimer = randRange(rng, 0.3, 0.6);
    s.boosting = true;
    return;
  }

  if (!s.canBoost() || s.mass < BOOST_MIN_MASS * 2.4) return;
  if (bestClear < probeLen * 0.93) return;

  let wantBoost = false;
  if (victim) {
    const d = Math.hypot(victim.x - s.x, victim.y - s.y);
    if (b.kind === 'assassin' && d < 1400 && d > 260) wantBoost = true;
    if (b.kind === 'scrapper' && d < 800 && victim.mass < s.mass * 1.25) wantBoost = true;
    // A coiler sprints to get INTO position and never while wrapping: the ring
    // it plans is barely wider than its own locked turn, and a boost doubles
    // that radius, which would open the loop it is trying to close.
    if (coilMode === 1 && d > b.coilR * 1.8) wantBoost = true;
    if (b.kind === 'coiler' && !b.wantCoil && d < 1200 && d > 260) wantBoost = true;
  }
  // Occasional dash toward a big food pile.
  if (!wantBoost && rng() < 0.005 && s.mass > 120) wantBoost = true;

  if (wantBoost) {
    b.boostTimer = randRange(rng, 0.25, 0.85);
    s.boosting = true;
  }
}

// --------------------------------------------------------------------- coiling
/**
 * Run the coil state machine. Returns 0 (not coiling), 1 (closing onto the
 * ring) or 2 (ring committed and being held shut). Writes b.coilAim, the
 * heading the fan then weights heavily.
 *
 * The first version of this orbited the victim's live position with no
 * commitment and never closed anything. Freezing the ring's centre to a patch
 * of ground does not work either -- measured, rings survived a median of 1.1s
 * before the victim simply drove out of them, because a snake at full speed
 * leaves a 400-unit circle in about half a second.
 *
 * What makes the kill work is not geometry held against a fleeing target, it is
 * that the victim is not fleeing in a straight line. Orbit a snake at a radius
 * inside its own turn circle and your fresh body keeps appearing across its
 * nose, so it is forced to keep turning; a snake turning at full lock makes
 * almost no net progress, and the coiler -- orbiting at the smaller radius, and
 * so covering more angle per second -- gains on it. In practice that buys a half
 * ring across the nose and not a closed loop (see coilRadius for why the
 * constants do not allow one), which is enough to convert 1.1 kills a minute of
 * the snake being wrapped. That is why the controller below is a pursuit staying
 * AHEAD of the victim's nose rather than a circle around a point:
 *
 *   - the ring tracks the victim's live position
 *   - the coiler holds a bearing ~70 degrees ahead of where the victim points
 *   - being behind that bearing tightens the radius (more angle per second),
 *     being ahead of it widens (less), which is the only throttle a
 *     constant-speed snake has
 *   - completed arc is accumulated, so "did it get all the way round" is a
 *     number rather than an impression
 */
const COIL_AHEAD = 1.22; // radians ahead of the victim's heading to hold

function updateCoil(s, world, b, victim, trBase) {
  if (b.kind !== 'coiler') return 0;

  let v = null;
  let mode = 0;
  if (b.coilOn) {
    v = b.coilId >= 0 ? world.snakes[b.coilId] : null;
    // Ids are slot indices and a dead bot is replaced in its own slot on the
    // same frame, so identity has to be the birth stamp: without it a coiler
    // silently carries on wrapping whatever respawned into its victim's slot.
    if (v && v.bornAt !== b.coilBorn) v = null;
    if (!v || !v.alive || b.coilT <= 0) {
      b.coilEnd = !v || !v.alive ? 'victim-died' : 'timeout';
      b.coilOn = false;
      b.coilId = -1;
      b.retarget = 0;
      return 0;
    }
    mode = 2;
  } else {
    if (!victim || !b.wantCoil) return 0;
    v = victim;
    mode = 1;
  }

  // Feasibility is tested strictly before committing and loosely afterwards. Re-
  // running the strict test every decision aborted 41% of rings mid-loop, on a
  // margin that moves as both snakes eat.
  const R = coilRadius(s, v, trBase, mode === 2 ? 1.3 : 1);
  if (R <= 0) {
    b.coilEnd = 'geometry-lost';
    b.coilOn = false;
    b.coilId = -1;
    b.retarget = 0;
    return 0;
  }
  b.coilR = R;
  const vTurn = v.baseSpeed / Math.max(1e-4, v.turnRate);
  const rMin = Math.max(trBase * 1.12, v.radius * 2.4 + 36);
  const rMax = Math.min(vTurn * 0.9, R * 1.7);

  const mx = s.x - v.x;
  const my = s.y - v.y;
  const d = Math.hypot(mx, my) || 1;
  const thMe = Math.atan2(my, mx);

  if (mode === 1) {
    b.coilSide = angleDelta(thMe, v.angle) > 0 ? 1 : -1;
    if (d > R * 1.8) {
      b.coilAim = ringHeading(thMe, d, R, b.coilSide);
      return 1;
    }
    b.coilOn = true;
    b.coilId = v.id;
    b.coilBorn = v.bornAt;
    b.coilArc = 0;
    b.coilLastTh = thMe;
    b.coilVAng = v.angle;
    // Time for two laps plus slack: one to lay the ring, the rest to hold it.
    const lap = (TAU * R) / (s.baseSpeed * TICKS_PER_SEC);
    b.coilT = Math.min(11, lap * 2.4 + 1.5);
    mode = 2;
  }

  if (d > rMax * 4) { // genuinely lost it, rather than merely off the ring
    b.coilEnd = 'drifted-off';
    b.coilOn = false;
    b.coilId = -1;
    b.retarget = 0;
    return 0;
  }

  // Net arc travelled around the victim, in the direction being laid.
  b.coilArc += angleDelta(b.coilLastTh, thMe) * b.coilSide;
  b.coilLastTh = thMe;

  // Follow the victim round its own turn. A blocked snake turns away from the
  // body across its nose, so it circles; the coiler has to circle the same way
  // to keep arriving in front of it, and only the observed turn says which way
  // that is -- reading the victim's steering intent would be information a
  // player does not have. A near-straight victim leaves the side alone.
  const seen = angleDelta(b.coilVAng, v.angle);
  b.coilVAng = v.angle;
  if (Math.abs(seen) > 0.012) b.coilSide = seen > 0 ? 1 : -1;

  // Radius is the throttle: a constant-speed snake can only gain angle on its
  // victim by cutting in. Behind the bearing it wants to hold, tighten (more
  // radians per second); ahead of it, widen. Diving straight at the point across
  // the victim's nose instead was measured killing it in 0.7s flat -- more
  // kills, but every one a cut-off, with no loop ever drawn.
  const want = v.angle + COIL_AHEAD * b.coilSide;
  const behind = clamp((angleDelta(thMe, want) * b.coilSide) / 1.6, -1, 1);
  const rt = clamp(R * (1 - 0.3 * behind), rMin, rMax);
  b.coilAim = blockPoint(s, v, rt, b.coilSide, rMin, d, thMe);
  return 2;
}

/**
 * Heading toward the point across the victim's nose at ring radius, on the side
 * it is turning toward. This is the move the whole coil rests on: a snake only
 * turns when something is in front of it, and a snake at full lock makes little
 * net progress, which is the only condition under which an equal-speed coiler
 * can gain bearing on it at all.
 *
 * Aiming straight at that point is only allowed while the line to it clears the
 * victim; from the far side, walk the ring round instead.
 */
function blockPoint(s, v, R, side, rMin, d, thMe) {
  const aim = v.angle + COIL_AHEAD * side;
  const bx = v.x + Math.cos(aim) * R;
  const by = v.y + Math.sin(aim) * R;
  const keep = rMin * 0.85;
  if (segDist2(v.x, v.y, s.x, s.y, bx, by) > keep * keep) {
    return Math.atan2(by - s.y, bx - s.x);
  }
  return ringHeading(thMe, d, R, side);
}

/**
 * Heading that walks the ring of radius `rt` around a victim we sit at bearing
 * `thMe` and distance `d` from: tangential when on the ring, radial when off it.
 */
function ringHeading(thMe, d, rt, side) {
  const tangent = thMe + (Math.PI / 2) * side;
  const radial = d > rt ? thMe + Math.PI : thMe;
  const blend = clamp(Math.abs(d - rt) / rt, 0, 1) * 0.85;
  const tx = Math.cos(tangent) * (1 - blend) + Math.cos(radial) * blend;
  const ty = Math.sin(tangent) * (1 - blend) + Math.sin(radial) * blend;
  return Math.atan2(ty, tx);
}

/**
 * The ring a coiler can actually draw around this victim, or 0 for "cannot".
 *
 * Three hard constraints, all geometric:
 *  - it must be wider than the coiler's own locked turn, or the coiler spirals
 *    into its own victim
 *  - it must be TIGHTER than the victim's locked turn, or the victim simply
 *    drives around inside it. This is the whole trick, and it means the victim
 *    has to be the clumsier snake: a nimble snake coils a giant, never the
 *    reverse, exactly as in the original
 *  - the coiler needs enough body to cover at least half the ring, or there is
 *    no wall for the victim to run into
 */
function coilRadius(s, victim, trBase, slack = 1) {
  const vTurn = victim.baseSpeed / Math.max(1e-4, victim.turnRate);
  // Wide enough to carve without spiralling into the victim, and clear of the
  // victim's own girth.
  const R = Math.max(trBase * 1.22, victim.radius * 3.2 + 50);
  if (R > vTurn * 0.8 * slack) return 0;
  // Enough body to line at least half the ring. Demanding a fully closable loop
  // (body >= 0.85 of the circumference) was measured too: it cut coil
  // commitments from 5.4/min to 2.5/min and kills of the wrapped victim from
  // 1.20/min to 0.43/min without lengthening a single ring, because what limits
  // closure is not the radius chosen but that body length per turn radius peaks
  // at 7.6 (around thickness 4, and thickness itself caps at 4.37 given the
  // 215-part limit) against the 6.28 a closed circle needs. A half ring across
  // the nose is what this movement model actually affords.
  if (s.bodyLength * slack < Math.PI * R) return 0;
  return R;
}


// ------------------------------------------------------------------ break-out
/**
 * Blocked distance in each of 16 directions out of here. Returns how many of
 * them are open. Writes ringFree.
 */
function scanEnclosure(s, bodies, myR, escapeLen) {
  const STEPS = 5;
  const gap = escapeLen / STEPS;
  const hitR = myR + 12 + gap * 0.5;
  let open = 0;
  for (let k = 0; k < RING; k++) {
    const a = (k / RING) * TAU;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    let free = escapeLen;
    for (let j = 1; j <= STEPS; j++) {
      const t = j * gap;
      const px = s.x + ca * t;
      const py = s.y + sa * t;
      if (Math.hypot(px, py) > ARENA_R - myR * 1.2) {
        free = t;
        break;
      }
      let hit = false;
      bodies.forEachNear(px, py, hitR + 70, (i) => {
        if (bodies.tag[i] === s.id) return;
        const dx = bodies.x[i] - px;
        const dy = bodies.y[i] - py;
        const rr = hitR + bodies.r[i];
        if (dx * dx + dy * dy < rr * rr) {
          hit = true;
          return true;
        }
      });
      if (hit) {
        free = t;
        break;
      }
    }
    ringFree[k] = free;
    if (free >= escapeLen * 0.8) open++;
  }
  return open;
}

/**
 * Widest open run of sectors, traded off against how far we must turn to use
 * it, with a bonus for the run we already committed to so the bot does not
 * dither between two exits. Writes GAP_OUT = [angle, width].
 */
function pickGap(cur, escapeLen, b) {
  const thresh = escapeLen * 0.8;
  let best = -Infinity;
  GAP_OUT[0] = cur;
  GAP_OUT[1] = 0;
  for (let k = 0; k < RING; k++) {
    if (ringFree[k] < thresh) continue;
    if (ringFree[(k - 1 + RING) % RING] >= thresh) continue; // not a run start
    let w = 0;
    while (w < RING && ringFree[(k + w) % RING] >= thresh) w++;
    const centre = ((k + (w - 1) / 2) / RING) * TAU;
    const turn = Math.abs(angleDelta(cur, centre));
    let score = w * 60 - turn * 150;
    if (b.trapT > 0 && Math.abs(angleDelta(b.trapA, centre)) < 0.5) score += 90;
    if (score > best) {
      best = score;
      GAP_OUT[0] = centre;
      GAP_OUT[1] = w;
    }
  }
}

// ------------------------------------------------------------------ targeting
/** Nearest interesting snake, filtered by personality. */
function chooseTarget(s, world, b, trBase) {
  b.wantCoil = false;
  if (b.kind === 'grazer') return -1;

  let best = -1;
  let bestScore = -Infinity;
  const range2 = 2600 * 2600;

  for (const o of world.snakes) {
    if (!o.alive || o.id === s.id) continue;
    const d2 = (o.x - s.x) ** 2 + (o.y - s.y) ** 2;
    if (d2 > range2) continue;
    const d = Math.sqrt(d2);

    if (b.kind === 'coiler') {
      // Prefer a victim this bot can wrap; the fatter and clumsier, the better
      // the prize and the easier the ring.
      const R = coilRadius(s, o, trBase);
      if (R > 0 && d < R * 3.4) {
        const vTurn = o.baseSpeed / Math.max(1e-4, o.turnRate);
        const score = 4000 + (vTurn / R) * 120 - d * 0.4 + Math.min(o.mass, 4000) * 0.06;
        if (score > bestScore) {
          bestScore = score;
          best = o.id;
          b.wantCoil = true;
        }
        continue;
      }
      // Nothing wrappable in reach: fall back to cutting off anything it is not
      // outweighed by, rather than standing around.
      if (b.wantCoil || o.mass > s.mass * 1.25) continue;
      if (-d > bestScore) {
        bestScore = -d;
        best = o.id;
      }
      continue;
    }

    // scrappers pick fights near their weight; assassins take the nearest.
    if (b.kind === 'scrapper' && o.mass > s.mass * 1.6) continue;
    if (-d > bestScore) {
      bestScore = -d;
      best = o.id;
    }
  }
  return best;
}

/**
 * Where this bot wants to be heading with respect to its victim.
 * The cut-off is the real slither.io kill: get in front of the head, not behind
 * it, so the victim's own momentum drives it into your flank.
 */
function intentAngle(s, victim, b) {
  const dx = victim.x - s.x;
  const dy = victim.y - s.y;
  const d = Math.hypot(dx, dy) || 1;

  // Lead the target: aim at where its head will be, offset to its side so we
  // arrive across its path rather than trailing it.
  const closeSpeed = Math.max(1, s.speed * 60);
  const lead = clamp(d / closeSpeed, 0.15, 1.5);
  const px = victim.x + Math.cos(victim.angle) * victim.speed * 60 * lead;
  const py = victim.y + Math.sin(victim.angle) * victim.speed * 60 * lead;
  const side = b.coilDir;
  const ax = px + Math.cos(victim.angle + (Math.PI / 2) * side) * victim.radius * 5;
  const ay = py + Math.sin(victim.angle + (Math.PI / 2) * side) * victim.radius * 5;
  return Math.atan2(ay - s.y, ax - s.x);
}
