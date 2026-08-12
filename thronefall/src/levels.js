// Level definitions and procedural layout.
// A level is: a biome, an island heightfield, a castle layout of fixed build
// plots (the only places you may build), roads from each spawn point to the
// keep, and a night-by-night wave table.

import { BIOMES } from './palette.js';

// --- deterministic RNG -------------------------------------------------------
export function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// value noise, smooth, seeded
function makeNoise(seed) {
  const rnd = mulberry(seed);
  const N = 256;
  const perm = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) perm[i] = rnd();
  const at = (ix, iz) => perm[((iz & 255) * N + (ix & 255))];
  const sm = (t) => t * t * (3 - 2 * t);
  return function (x, z) {
    const xi = Math.floor(x), zi = Math.floor(z);
    const xf = sm(x - xi), zf = sm(z - zi);
    const a = at(xi, zi), b = at(xi + 1, zi), c = at(xi, zi + 1), d = at(xi + 1, zi + 1);
    return (a * (1 - xf) + b * xf) * (1 - zf) + (c * (1 - xf) + d * xf) * zf;
  };
}

// The realm. Night counts, spawn layouts and starting gold follow the wikis
// where documented; where they are not, they are tuned for pacing.
export const LEVELS = [
  {
    id: 'neuland', name: 'Neuland', biome: 'grass', seed: 1337,
    blurb: 'A quiet first holding. One road in from the east.',
    radius: 84, nights: 5, startGold: 10, wallRadius: 22, wallSides: 11,
    spawnAngles: [0.0], flyOnly: [], difficulty: 0.6,
    unlockedBy: null, ecoInner: 5, ecoOuter: 3, unitPlots: 2, towerExtra: 1,
    features: ['One approach', 'Learn the loop'],
    map: { x: 0.085, y: 0.485 },
    extras: ['field'], fieldPlots: 2,
  },
  {
    id: 'nordfels', name: 'Nordfels', biome: 'grass', seed: 90210,
    blurb: 'Mountains to the north, a river for a border. Five approaches, three of them airborne.',
    radius: 106, nights: 13, startGold: 12, wallRadius: 26, wallSides: 14,
    spawnAngles: [0.35, 1.25, 2.45, 3.75, 5.15], flyOnly: [0, 3, 4], difficulty: 1.0,
    unlockedBy: 'neuland', ecoInner: 7, ecoOuter: 5, unitPlots: 3, towerExtra: 2,
    features: ['3 flyer-only spawns', 'Outer mills are exposed'],
    unlocksWeapon: 'spear',
    map: { x: 0.2, y: 0.3 },
    extras: ['field'], fieldPlots: 3,
  },
  {
    id: 'durststein', name: 'Durststein', biome: 'desert', seed: 4242,
    blurb: 'A desert crossroads. The richest start in the realm and the least cover.',
    radius: 112, nights: 10, startGold: 26, wallRadius: 28, wallSides: 16,
    spawnAngles: [0.2, 1.1, 2.0, 2.9, 3.8, 4.7, 5.6], flyOnly: [2, 5], difficulty: 1.2,
    unlockedBy: 'nordfels', ecoInner: 8, ecoOuter: 7, unitPlots: 3, towerExtra: 3,
    features: ['Most starting gold', 'Seven approaches'],
    unlocksWeapon: 'sword',
    map: { x: 0.255, y: 0.725 },
    extras: ['field'], fieldPlots: 4,
  },
  {
    id: 'frostsee', name: 'Frostsee', biome: 'snow', seed: 777,
    blurb: 'A frozen lake. Rams, slimes, and something moving under the ice.',
    radius: 104, nights: 11, startGold: 16, wallRadius: 25, wallSides: 14,
    spawnAngles: [0.9, 2.1, 3.3, 4.4, 5.6], flyOnly: [1], difficulty: 1.4,
    unlockedBy: 'durststein', ecoInner: 7, ecoOuter: 5, unitPlots: 4, towerExtra: 3,
    boss: 'shadow', features: ['Siege rams', 'Boss on the final night'],
    unlocksWeapon: 'staff',
    map: { x: 0.415, y: 0.135 },
    // The Shadow rises out of this lake, and eats the harbours on it.
    extras: ['harbour', 'blacksmith'],
    lake: { a: 4.9, d: 47, r: 24, boss: true }, harbourPlots: 3,
  },
  {
    id: 'uferwind', name: 'Uferwind', biome: 'grass', seed: 5150,
    blurb: 'Rugged shore on one side, open grass on the other. Plenty to build, plenty to lose.',
    radius: 114, nights: 12, startGold: 22, wallRadius: 27, wallSides: 15,
    spawnAngles: [0.5, 1.4, 2.3, 3.4, 4.3, 5.4], flyOnly: [0, 4], difficulty: 1.5,
    unlockedBy: 'frostsee', ecoInner: 9, ecoOuter: 7, unitPlots: 4, towerExtra: 3,
    features: ['Wide build space', 'Six approaches'],
    unlocksWeapon: 'codex',
    map: { x: 0.455, y: 0.51 },
    extras: ['harbour', 'blacksmith', 'bridge'],
    lake: { a: 2.95, d: 55, r: 26 }, harbourPlots: 3, bridgePlots: 2,
  },
  {
    id: 'sturmklamm', name: 'Sturmklamm', biome: 'volcanic', seed: 31337,
    blurb: 'The last gorge. Four bridges south, and four statues that wake on the final night.',
    radius: 100, nights: 13, startGold: 18, wallRadius: 24, wallSides: 14,
    spawnAngles: [2.4, 3.0, 3.6, 4.2, 0.4, 1.3, 5.6], flyOnly: [4, 5, 6], difficulty: 1.7,
    unlockedBy: 'uferwind', ecoInner: 8, ecoOuter: 6, unitPlots: 4, towerExtra: 4,
    boss: 'statues', rain: true, features: ['Rain', 'Four bosses at once'],
    unlocksWeapon: 'falchion',
    map: { x: 0.63, y: 0.3 },
    extras: ['forge'],
  },
  {
    id: 'wildbach', name: 'Wildbach', biome: 'grass', seed: 8080,
    blurb: 'Small clearings joined by bridges. They come from every side but the north.',
    radius: 108, nights: 12, startGold: 20, wallRadius: 25, wallSides: 13,
    spawnAngles: [0.3, 1.0, 2.2, 3.5, 4.2, 5.0, 5.8], flyOnly: [1, 5], difficulty: 1.85,
    unlockedBy: 'sturmklamm', ecoInner: 8, ecoOuter: 6, unitPlots: 4, towerExtra: 4,
    features: ['Surrounded', 'Hardest holding'],
    map: { x: 0.6, y: 0.775 },
    extras: ['harbour', 'blacksmith', 'forge'],
    lake: { a: 0.6, d: 50, r: 20 }, harbourPlots: 3,
    unlocksWeapon: 'vials',
  },
  // ---- The last three holdings. What is documented about them: their place in
  // the order, their night counts, which buildings they carry, and their boss's
  // name. Biome, spawn layout, starting gold and every boss behaviour below are
  // invented — nothing published describes them.
  {
    id: 'moorweg', name: 'Moorweg', biome: 'grass', seed: 60613,
    blurb: 'Sunken moorland. Elara the Vile drifts in on the last night.',
    radius: 110, nights: 12, startGold: 20, wallRadius: 26, wallSides: 14,
    spawnAngles: [0.4, 1.5, 2.6, 3.4, 4.5, 5.5], flyOnly: [1, 4], difficulty: 1.95,
    unlockedBy: 'wildbach', ecoInner: 8, ecoOuter: 6, unitPlots: 4, towerExtra: 4,
    boss: 'elara', features: ['Boggy approaches', 'Elara the Vile'],
    map: { x: 0.775, y: 0.575 },
    extras: ['harbour', 'blacksmith', 'forge'],
    lake: { a: 1.2, d: 48, r: 22 }, harbourPlots: 2,
    unlocksWeapon: 'axe',
  },
  {
    id: 'freifort', name: 'Freifort', biome: 'desert', seed: 71177,
    blurb: 'A free city on open ground. An Iron Castle rolls up to the walls.',
    radius: 116, nights: 13, startGold: 24, wallRadius: 29, wallSides: 16,
    spawnAngles: [0.3, 1.0, 1.8, 2.7, 3.5, 4.3, 5.1, 5.9], flyOnly: [2, 6], difficulty: 2.1,
    unlockedBy: 'moorweg', ecoInner: 9, ecoOuter: 7, unitPlots: 5, towerExtra: 4,
    boss: 'ironcastle', features: ['Eight approaches', 'Iron Castle'],
    map: { x: 0.83, y: 0.73 },
    extras: ['harbour', 'blacksmith', 'forge'],
    lake: { a: 2.2, d: 56, r: 24 }, harbourPlots: 2,
    unlocksWeapon: 'bloodwand',
  },
  {
    id: 'totend', name: 'Totend', biome: 'volcanic', seed: 90909,
    blurb: 'The end of the road. The Corrupt King is waiting, and he does not stand still.',
    radius: 104, nights: 15, startGold: 18, wallRadius: 25, wallSides: 15,
    spawnAngles: [0.2, 0.9, 1.7, 2.5, 3.2, 4.0, 4.8, 5.6], flyOnly: [3, 5, 7], difficulty: 2.35,
    unlockedBy: 'freifort', ecoInner: 8, ecoOuter: 6, unitPlots: 5, towerExtra: 5,
    boss: 'corruptking', rain: true, features: ['15 nights', 'The final boss'],
    map: { x: 0.88, y: 0.35 },
    // One Royal Forge, not two: the developers cut the second for balance.
    extras: ['blacksmith', 'forge'],
  },
];

export function levelById(id) { return LEVELS.find((l) => l.id === id) || LEVELS[0]; }

// ---------------------------------------------------------------------------
// Layout construction
// ---------------------------------------------------------------------------
export function buildLevel(cfg) {
  const rnd = mulberry(cfg.seed);
  const noise = makeNoise(cfg.seed);
  const noise2 = makeNoise(cfg.seed ^ 0x9e37);
  const pal = BIOMES[cfg.biome];
  const R = cfg.radius;

  // --- the inlet -----------------------------------------------------------
  // Maps with a coastline get a bay cut inland from the sea toward the keep.
  // That is what gives the Fishing Harbour water-adjacent plots to sit on and
  // the Bridge a gap worth spanning, without inventing an inland pond that the
  // sea never reaches. Its axis is dropped into the widest gap between two
  // approach roads so it never swallows a road.
  let lake = null;
  if (cfg.lake) {
    let a = cfg.lake.a;
    if (cfg.spawnAngles.length > 1) {
      const angs = cfg.spawnAngles.slice().sort((p, q) => p - q);
      let bestGap = -1;
      for (let i = 0; i < angs.length; i++) {
        const a0 = angs[i];
        const a1 = i === angs.length - 1 ? angs[0] + Math.PI * 2 : angs[i + 1];
        if (a1 - a0 > bestGap) { bestGap = a1 - a0; a = a0 + (a1 - a0) / 2; }
      }
    }
    lake = {
      a, head: cfg.lake.d, r: cfg.lake.r, boss: !!cfg.lake.boss,
      c: Math.cos(a), s: Math.sin(a),
      x: Math.cos(a) * cfg.lake.d, z: Math.sin(a) * cfg.lake.d,
    };
  }

  /** 0 outside the bay, 1 at its middle. A capsule that widens toward the sea. */
  function bayCut(x, z) {
    if (!lake) return 0;
    const along = x * lake.c + z * lake.s;
    const across = Math.abs(-x * lake.s + z * lake.c);
    if (along < lake.head - lake.r) return 0;
    const t = Math.min(1, Math.max(0, (along - lake.head) / Math.max(1, (R + 8) - lake.head)));
    const halfW = lake.r * (0.37 + 0.63 * t);
    const inner = along < lake.head ? lake.head - along : 0;
    const d = Math.hypot(across, inner);
    return 1 - smoothstep(halfW * 0.58, halfW, d);
  }
  /** Half-width of the bay at a distance along its axis. */
  function bayHalfWidth(along) {
    if (!lake) return 0;
    const t = Math.min(1, Math.max(0, (along - lake.head) / Math.max(1, (R + 8) - lake.head)));
    return lake.r * (0.37 + 0.63 * t);
  }

  // --- roads: straight-ish spokes from keep to each spawn point
  const spawns = cfg.spawnAngles.map((a, i) => {
    const d = R - 8 - rnd() * 6;
    return {
      i, angle: a,
      x: Math.cos(a) * d, z: Math.sin(a) * d,
      flying: false,
      // Some spawn points only send flyers (Nordfels-style).
    };
  });
  for (const i of (cfg.flyOnly || [])) if (spawns[i]) spawns[i].flying = true;

  const roads = spawns.map((s) => {
    const pts = [];
    const steps = 10;
    const bend = (rnd() - 0.5) * 0.5;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const a = s.angle + bend * Math.sin(t * Math.PI);
      const d = t * Math.hypot(s.x, s.z);
      pts.push([Math.cos(a) * d, Math.sin(a) * d]);
    }
    return pts;
  });

  // --- wall ring polygon (rounded, slightly irregular)
  const WR = cfg.wallRadius, sides = cfg.wallSides;
  const ringPts = [];
  for (let i = 0; i < sides; i++) {
    const a = (i / sides) * Math.PI * 2;
    const r = WR * (0.93 + noise(Math.cos(a) * 2 + 10, Math.sin(a) * 2 + 10) * 0.16);
    ringPts.push([Math.cos(a) * r, Math.sin(a) * r, a]);
  }

  const plots = [];
  let pid = 0;
  const addPlot = (kind, x, z, rot, extra) => {
    plots.push(Object.assign({
      id: pid++, kind, x, z, rot: rot || 0,
      building: null, tier: 0, branch: null, hp: 0, maxHp: 0, dead: false,
    }, extra || {}));
    return plots[plots.length - 1];
  };

  // Wall segments: one plot per segment midpoint. Segments whose midpoint is
  // near a road become gate plots.
  const roadAngles = spawns.map((s) => s.angle);
  for (let i = 0; i < sides; i++) {
    const a0 = ringPts[i], a1 = ringPts[(i + 1) % sides];
    const mx = (a0[0] + a1[0]) / 2;
    const midz = (a0[1] + a1[1]) / 2;
    const rot = Math.atan2(a1[1] - a0[1], a1[0] - a0[0]);
    const len = Math.hypot(a1[0] - a0[0], a1[1] - a0[1]);
    const midAngle = Math.atan2(midz, mx);
    let isGate = false;
    for (const ra of roadAngles) {
      let d = Math.abs(((midAngle - ra + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
      if (d < (Math.PI / sides) * 1.05) { isGate = true; break; }
    }
    addPlot(isGate ? 'gate' : 'wall', mx, midz, rot, { segLen: len });
  }
  // Tower plots on the ring vertices (pushed slightly outward).
  for (let i = 0; i < sides; i++) {
    if (sides > 8 && i % 2 === 1 && cfg.towerExtra < 3) continue;
    const p = ringPts[i];
    const a = Math.atan2(p[1], p[0]);
    const r = Math.hypot(p[0], p[1]) + 1.4;
    addPlot('tower', Math.cos(a) * r, Math.sin(a) * r, -a + Math.PI / 2);
  }

  // Inner economy plots — a loose ring inside the wall, avoiding roads/keep.
  const placed = [];
  const tooClose = (x, z, min) => {
    if (Math.hypot(x, z) < 7.5) return true;
    for (const p of placed) if (Math.hypot(p[0] - x, p[1] - z) < min) return true;
    for (const rd of roads) for (const q of rd) if (Math.hypot(q[0] - x, q[1] - z) < 4.2) return true;
    return false;
  };
  const scatter = (count, rMin, rMax, kind, minSep) => {
    let guard = 0;
    for (let n = 0; n < count && guard < 4000; guard++) {
      const a = rnd() * Math.PI * 2;
      const r = rMin + rnd() * (rMax - rMin);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (tooClose(x, z, minSep)) continue;
      placed.push([x, z]);
      addPlot(kind, x, z, rnd() * Math.PI * 2);
      n++;
    }
  };
  scatter(cfg.ecoInner, 9, WR - 4.5, 'eco', 6.4);
  scatter(cfg.unitPlots, 11, WR - 5.5, 'unit', 7.2);
  // Outer farmland: the extra plots a map's Fields want, out past the wall.
  scatter(cfg.ecoOuter, WR + 9, Math.min(R - 20, WR + 34), 'eco', 8.5);

  // Fields cluster around the mills they feed, the way they do in the original:
  // each one is a satellite plot a short walk from an inner economy plot.
  if (cfg.fieldPlots) {
    const ecoPlots = plots.filter((p) => p.kind === 'eco');
    let made = 0;
    for (let pass = 0; pass < 3 && made < cfg.fieldPlots; pass++) {
      for (const host of ecoPlots) {
        if (made >= cfg.fieldPlots) break;
        for (let k = 0; k < 8; k++) {
          const a = rnd() * Math.PI * 2;
          const r = 7.6 + rnd() * 2.4;
          const x = host.x + Math.cos(a) * r, z = host.z + Math.sin(a) * r;
          if (Math.hypot(x, z) < 9 || Math.hypot(x, z) > R - 16) continue;
          if (tooClose(x, z, 7.2)) continue;
          placed.push([x, z]);
          addPlot('field', x, z, rnd() * Math.PI * 2);
          made++;
          break;
        }
      }
    }
  }
  // one or two outer tower plots guarding roads
  const outerTowers = Math.max(1, Math.round(cfg.towerExtra * 0.8));
  for (let i = 0; i < outerTowers; i++) {
    const s = spawns[(i * 2 + 1) % spawns.length];
    const a = s.angle + (rnd() - 0.5) * 0.35;
    const r = WR + 12 + rnd() * 8;
    addPlot('tower', Math.cos(a) * r, Math.sin(a) * r, -a + Math.PI / 2);
  }

  // --- heightfield --------------------------------------------------------
  const roadFlat = [];
  for (const rd of roads) for (const q of rd) roadFlat.push(q);

  function baseHeight(x, z) {
    const d = Math.hypot(x, z);
    const edge = 1 - smoothstep(R - 26, R + 4, d);
    let h = 3.5;
    h += (noise(x * 0.016 + 3, z * 0.016 + 3) - 0.5) * 11;
    h += (noise2(x * 0.045 + 9, z * 0.045 + 9) - 0.5) * 4.0;
    // a ridge on one side gives the map a silhouette to read against
    const ridgeA = 1.9;
    const along = (x * Math.cos(ridgeA) + z * Math.sin(ridgeA)) / Math.max(1, R);
    if (along > 0.42) h += (along - 0.42) * 78 * (0.6 + noise(x * 0.03, z * 0.03) * 0.8);
    const bc = bayCut(x, z);
    if (bc > 0) h = h * (1 - bc) - 7.5 * bc;
    h *= edge;
    h -= (1 - edge) * 13;
    return h;
  }

  const flattenR = WR + 7;
  const PLATEAU = 2.8;

  function roadDist(x, z) {
    let best = 1e9;
    for (let i = 0; i < roadFlat.length; i++) {
      const dd = (roadFlat[i][0] - x) ** 2 + (roadFlat[i][1] - z) ** 2;
      if (dd < best) best = dd;
    }
    return Math.sqrt(best);
  }

  /**
   * Terrain before plot flattening. Order matters: the road cut is applied to
   * the raw noise, then the castle plateau overrides it outright — the other
   * way round the converging roads dig the keep below the waterline.
   */
  function terrainBase(x, z) {
    let h = baseHeight(x, z);
    const rt = 1 - smoothstep(4.0, 12, roadDist(x, z));
    if (rt > 0) h = h * (1 - rt * 0.4) - rt * 0.35;
    const d = Math.hypot(x, z);
    const t = 1 - smoothstep(flattenR - 6, flattenR + 14, d);
    h = h * (1 - t) + PLATEAU * t;
    return h;
  }

  // --- water-adjacent plots ------------------------------------------------
  // Harbour plots must genuinely touch water, or a Fishing Harbour is a lie:
  // a candidate qualifies only when it stands on dry bank AND the ground five
  // metres toward the bay axis is already below the waterline.
  if (lake && cfg.harbourPlots) {
    const spots = [];
    for (const side of [-1, 1]) {
      for (let k = 0; k < 30; k++) {
        const along = lake.head - 5 + k * 3.4;
        const halfW = bayHalfWidth(along);
        let found = null;
        for (let across = halfW * 0.5; across < halfW + 16; across += 0.8) {
          const x = lake.c * along - lake.s * across * side;
          const z = lake.s * along + lake.c * across * side;
          const h = terrainBase(x, z);
          if (h < 1.0 || h > 3.4) continue;
          const wx = lake.c * along - lake.s * (across - 5.5) * side;
          const wz = lake.s * along + lake.c * (across - 5.5) * side;
          if (terrainBase(wx, wz) > 0.15) continue;
          if (Math.hypot(x, z) > R - 8) continue;
          // Face the quay out into the bay: the art runs along local -Z, and the
          // group is rotated by -rot, so this is the angle that lines them up.
          found = { x, z, rot: Math.atan2(wx - x, z - wz) };
          break;
        }
        if (!found) continue;
        let clash = false;
        for (const s of spots) if (Math.hypot(s.x - found.x, s.z - found.z) < 14) clash = true;
        for (const p of plots) if (Math.hypot(p.x - found.x, p.z - found.z) < 8) clash = true;
        for (const rd of roads) for (const q of rd) {
          if (Math.hypot(q[0] - found.x, q[1] - found.z) < 5) clash = true;
        }
        if (!clash) spots.push(found);
      }
    }
    // Prefer the spots nearest the head of the bay: closest to the keep, so a
    // harbour is defensible rather than a write-off.
    spots.sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z));
    for (let i = 0; i < Math.min(cfg.harbourPlots, spots.length); i++) {
      const s = spots[i];
      addPlot('harbour', s.x, s.z, s.rot, { onWater: true });
    }
  }

  // Bridge plots: one span across the narrow neck of the inlet. The length is
  // measured off the water rather than assumed, so a span is only offered where
  // the crossing is actually short enough to be worth building.
  if (lake && cfg.bridgePlots) {
    const MAX_SPAN = 26;
    const hw = bayHalfWidth(lake.head);
    for (let i = 0; i < cfg.bridgePlots; i++) {
      const along = lake.head - hw * 0.5 + i * hw * 1.6;
      const x = lake.c * along, z = lake.s * along;
      if (Math.hypot(x, z) > R - 12) break;
      if (terrainBase(x, z) > 0.2) continue;
      // walk out to each bank and take the wider half
      let reach = 0;
      for (const side of [-1, 1]) {
        let d = 1;
        for (; d < MAX_SPAN; d += 0.7) {
          const px = lake.c * along - lake.s * d * side;
          const pz = lake.s * along + lake.c * d * side;
          if (terrainBase(px, pz) > 0.35) break;
        }
        reach = Math.max(reach, d);
      }
      const span = reach * 2 + 5;
      if (span > MAX_SPAN) continue;
      addPlot('bridge', x, z, lake.a, { segLen: span, spanY: 0.85, overWater: true });
    }
  }

  const plotBaseCache = new Map();
  function heightAtPlotBase(p) {
    if (plotBaseCache.has(p.id)) return plotBaseCache.get(p.id);
    // A bridge plot stands in open water: its deck height is authored, and the
    // terrain under it is left alone.
    const h = p.spanY != null ? p.spanY : Math.max(0.9, terrainBase(p.x, p.z));
    plotBaseCache.set(p.id, h);
    return h;
  }

  function heightAt(x, z) {
    let h = terrainBase(x, z);
    for (let i = 0; i < plots.length; i++) {
      const p = plots[i];
      if (p.overWater) continue;                    // never fill in the bay
      // A quay keeps a tight pad so the water still laps against it.
      const far = p.kind === 'harbour' ? 3.4 : 6.0;
      const near = p.kind === 'harbour' ? 1.6 : 2.8;
      const dd = Math.hypot(p.x - x, p.z - z);
      if (dd < far) {
        const pt = 1 - smoothstep(near, far, dd);
        h = h * (1 - pt) + heightAtPlotBase(p) * pt;
      }
    }
    return h;
  }

  for (const p of plots) p.y = heightAtPlotBase(p);
  for (const s of spawns) s.y = heightAt(s.x, s.z);

  // Road surface samples for terrain painting
  // Painted samples start outside the keep, so the converging spokes never
  // merge into one brown blob over the castle plateau.
  const roadSamples = [];
  for (const rd of roads) {
    for (let i = 0; i < rd.length - 1; i++) {
      const a = rd[i], b = rd[i + 1];
      for (let t = 0; t < 1; t += 0.1) {
        const x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
        if (Math.hypot(x, z) < WR + 2) continue;
        roadSamples.push([x, z]);
      }
    }
  }

  // --- decor: trees & rocks, avoiding roads, plots, water
  const decor = [];
  const decorGuard = 9000;
  const wantTrees = cfg.biome === 'desert' ? 90 : 240;
  for (let n = 0, g = 0; n < wantTrees && g < decorGuard; g++) {
    const a = rnd() * Math.PI * 2, r = 8 + rnd() * (R - 6);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h < 1.1 || h > 30) continue;
    if (Math.hypot(x, z) < WR + 6) continue;
    let bad = false;
    for (const p of plots) if (Math.hypot(p.x - x, p.z - z) < 6) { bad = true; break; }
    if (!bad) for (const q of roadSamples) if (Math.hypot(q[0] - x, q[1] - z) < 5) { bad = true; break; }
    if (bad) continue;
    decor.push({ type: rnd() < 0.82 ? 'tree' : 'rock', x, z, y: h, s: 0.75 + rnd() * 0.6, rot: rnd() * 6.283 });
    n++;
  }

  // --- baked height grid: heightAt() is expensive (it scans plots+roads), so
  // bake it once and sample bilinearly at runtime. The terrain mesh uses the
  // exact same lattice, so visuals and physics agree.
  const step = 2;
  const min = -(R + 14), max = R + 14;
  const gn = Math.ceil((max - min) / step) + 1;
  const hGrid = new Float32Array(gn * gn);
  for (let j = 0; j < gn; j++) {
    for (let i = 0; i < gn; i++) {
      hGrid[j * gn + i] = heightAt(min + i * step, min + j * step);
    }
  }
  function sampleHeight(x, z) {
    const fx = (x - min) / step, fz = (z - min) / step;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0) i = 0; if (j < 0) j = 0;
    if (i > gn - 2) i = gn - 2; if (j > gn - 2) j = gn - 2;
    const tx = Math.min(1, Math.max(0, fx - i)), tz = Math.min(1, Math.max(0, fz - j));
    const a = hGrid[j * gn + i], b = hGrid[j * gn + i + 1];
    const c = hGrid[(j + 1) * gn + i], d = hGrid[(j + 1) * gn + i + 1];
    return (a * (1 - tx) + b * tx) * (1 - tz) + (c * (1 - tx) + d * tx) * tz;
  }

  // Built bridge decks: cells that are walkable despite standing over water.
  const decks = [];
  function deckAt(x, z) {
    for (let i = 0; i < decks.length; i++) {
      const d = decks[i];
      const dx = x - d.x, dz = z - d.z;
      const along = dx * d.c + dz * d.s;
      const across = -dx * d.s + dz * d.c;
      if (Math.abs(along) <= d.halfL && Math.abs(across) <= d.halfW) return d;
    }
    return null;
  }

  return {
    cfg, pal, noise, radius: R, wallRadius: WR, ringPts, lake,
    plots, spawns, roads, roadSamples, decor, heightAt, baseHeight,
    grid: { min, step, n: gn, h: hGrid }, sampleHeight,
    waterLevel: 0.0, decks, deckAt,
  };
}

export function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

// ---------------------------------------------------------------------------
// Wave composition
// ---------------------------------------------------------------------------
// Each night has a hidden difficulty-point budget that grows with the night
// index; enemies are bought out of it at the point costs the wiki documents,
// so the mix shifts from cheap swarmers toward expensive siege on its own.
import { SPAWN_POOL, ENEMY_DEFS } from './enemies.js';

const MAX_PER_NIGHT = 140;

export function nightBudget(cfg, night) {
  // Flat early, explosive late: the wiki describes 'small swordsman groups'
  // for the first three nights of a 13-night map and ~200 units on the last.
  return Math.max(6, 1.2 + 0.5 * Math.pow(night, 2.8)) * cfg.difficulty;
}

export function waveFor(level, night, mods) {
  const cfg = level.cfg;
  const rnd = mulberry(cfg.seed * 131 + night * 7919);
  let budget = nightBudget(cfg, night);
  const lead = cfg.difficulty > 1.35 ? 1 : 0;
  const avail = SPAWN_POOL.filter((p) => p.at <= night + lead);
  const counts = new Map();
  const add = (kind, n) => counts.set(kind, (counts.get(kind) || 0) + n);

  // A frontline block leads the night, but it never eats the whole budget —
  // otherwise a late night degenerates into two hundred of one cheap unit.
  const frontKinds = avail.filter((p) => ['swordsman', 'peasant', 'slime'].includes(p.kind));
  const fk = frontKinds[Math.floor(rnd() * frontKinds.length)] || avail[0];
  const fpts = ENEMY_DEFS[fk.kind].pts;
  const fn = Math.max(3, Math.min(Math.round(MAX_PER_NIGHT * 0.3), Math.floor((budget * 0.26) / fpts)));
  add(fk.kind, fn);
  budget -= fn * fpts;

  let total = fn;
  let guard = 0;
  while (budget > 0.6 && total < MAX_PER_NIGHT && guard++ < 400) {
    const slots = MAX_PER_NIGHT - total;
    // points that must go into each remaining slot to spend the budget
    const need = budget / slots;
    let pool = avail.filter((p) => ENEMY_DEFS[p.kind].pts >= need * 0.55);
    if (!pool.length) pool = avail;
    const p = pool[Math.floor(rnd() * pool.length)];
    const def = ENEMY_DEFS[p.kind];
    const maxGroup = def.pts > 12 ? 3 : (def.pts > 5 ? 5 : 9);
    const want = 1 + Math.floor(rnd() * maxGroup);
    const afford = Math.min(want, Math.max(1, Math.floor(budget / def.pts)), slots);
    if (afford < 1) break;
    add(p.kind, afford);
    budget -= afford * def.pts;
    total += afford;
  }

  const out = [...counts.entries()].map(([kind, n]) => ({ kind, n }));
  if (night === cfg.nights) {
    if (cfg.boss === 'statues') out.push({ kind: 'statue', n: 4 });
    else if (cfg.boss) out.push({ kind: cfg.boss, n: 1 });
    else out.push({ kind: 'fury', n: 2 });
  }
  out.sort((a, b) => ENEMY_DEFS[b.kind].pts * b.n - ENEMY_DEFS[a.kind].pts * a.n);

  // Elites are decided here, not at spawn time, so the pre-night list can name
  // them honestly. Walking the sorted roster and taking every Nth non-boss
  // keeps the Elite God's "every third enemy" rate intact in aggregate.
  const every = (mods && mods.eliteEvery) || 0;
  if (every) {
    let counter = 0;
    for (const g of out) {
      if (ENEMY_DEFS[g.kind].boss) { g.elite = 0; continue; }
      let e = 0;
      for (let i = 0; i < g.n; i++) { counter++; if (counter % every === 0) e++; }
      g.elite = e;
    }
  }
  return out;
}
