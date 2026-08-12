// Minerals and buried artifacts.
//
// value / points / weight / minDepth / commonDepth are the original's numbers.
// `weight` is the cargo cost in the wiki's kilograms; this build divides it by
// 10 into "cargo units" so that a Micro Bay (10) holds ten Ironium rather than
// one -- the raw kg figures against the published bay capacities would let the
// top bay hold a single Amazonite. `peak` is the per-tile spawn chance at the
// mineral's common depth, tuned so a screen at that depth shows a couple of
// specimens, matching how the wiki defines "common depth".

export const ORES = [
  { id: "ironium",     name: "Ironium",     value: 30,     points: 150,    weight: 10,  minDepth: 25,   common: 25,   peak: 0.038,  fade: 0.86, color: "#b2643c", glint: "#ffc79a" },
  { id: "bronzium",    name: "Bronzium",    value: 60,     points: 300,    weight: 10,  minDepth: 25,   common: 25,   peak: 0.028,  fade: 0.80, color: "#c98b3d", glint: "#ffdca0" },
  { id: "silverium",   name: "Silverium",   value: 100,    points: 500,    weight: 10,  minDepth: 25,   common: 25,   peak: 0.017,  fade: 0.70, color: "#ccd6e2", glint: "#ffffff" },
  { id: "goldium",     name: "Goldium",     value: 250,    points: 1250,   weight: 20,  minDepth: 25,   common: 250,  peak: 0.013,  fade: 0.50, color: "#e8c22a", glint: "#fff6b0" },
  { id: "platinium",   name: "Platinium",   value: 750,    points: 3750,   weight: 30,  minDepth: 800,  common: 1700, peak: 0.0090, fade: 0.30, color: "#8fe6d8", glint: "#e9fffb" },
  { id: "einsteinium", name: "Einsteinium", value: 2000,   points: 10000,  weight: 40,  minDepth: 1600, common: 2600, peak: 0.0070, fade: 0.18, color: "#9a6ef0", glint: "#e2cfff" },
  { id: "emerald",     name: "Emerald",     value: 5000,   points: 25000,  weight: 60,  minDepth: 2400, common: 4000, peak: 0.0055, fade: 0.10, color: "#31d160", glint: "#bcffd0" },
  { id: "ruby",        name: "Ruby",        value: 20000,  points: 100000, weight: 80,  minDepth: 4000, common: 4800, peak: 0.0044, fade: 0.05, color: "#f02a4d", glint: "#ffc0cc" },
  { id: "diamond",     name: "Diamond",     value: 100000, points: 500000, weight: 100, minDepth: 4400, common: 5700, peak: 0.0034, fade: 0.0,  color: "#a6ecff", glint: "#ffffff" },
  { id: "amazonite",   name: "Amazonite",   value: 500000, points: 500000, weight: 120, minDepth: 5500, common: 6200, peak: 0.0026, fade: 0.0,  color: "#ff5bd0", glint: "#ffdcf7" },
];

export const ORE_BY_ID = Object.fromEntries(ORES.map((o) => [o.id, o]));
export const ORE_INDEX = Object.fromEntries(ORES.map((o, i) => [o.id, i]));

/** Cargo units one specimen costs. */
export function cargoUnits(entry) { return Math.max(1, Math.round(entry.weight / 10)); }

// --- New Game+ scaling -------------------------------------------------------
// The wiki's Ending page gives the formulas outright, with x = the number of
// times Satan has been defeated:
//
//   mineral value    1 / (x + 1)
//   dig points       1 x (x + 1)
//   boss health      1000 x (x + 1)  form 1,  2000 x (x + 1)  form 2
//   boss damage      1 x (x + 1)
//
// The XGen Studios wiki confirms it with a worked example (four Satan's Heads =
// a fifth of the money, five times the damage and health) and adds the cycle
// cap: 99 levels, and "Motherload uses a round-down basis, which means Ironium
// becomes worth $0 after Level 31". Both are reproduced here, floor and all --
// a devaluation that can reach zero is the point of the scaling.
export const MAX_CYCLES = 99;

const state = { cycle: 0 };

export function setCycle(n) { state.cycle = Math.max(0, Math.min(MAX_CYCLES - 1, n | 0)); }
export function getCycle() { return state.cycle; }
export function valueScale() { return 1 / (state.cycle + 1); }
export function pointScale() { return state.cycle + 1; }

/** What the Mineral Processor actually pays for one specimen. Rounds down. */
export function sellValue(entry) {
  if (!entry) return 0;
  return Math.floor(entry.value * valueScale());
}

/** Score awarded for one specimen. Digging pays MORE each cycle, not less. */
export function sellPoints(entry) {
  if (!entry) return 0;
  return Math.floor(entry.points * pointScale());
}

/**
 * Buried artifacts: a separate collectible class from minerals. The wikis
 * disagree on depth (one says "not correlated with depth", the other "below
 * 950 ft"); this build seeds them from 300 ft down with no depth weighting on
 * value, which honours the first claim.
 */
export const ARTIFACTS = [
  { id: "bones",    name: "Dinosaur Bones",   value: 1000,  points: 500000, weight: 30, icon: "bones" },
  { id: "treasure", name: "Treasure",         value: 5000,  points: 500000, weight: 30, icon: "chest" },
  { id: "skeleton", name: "Martian Skeleton", value: 10000, points: 500000, weight: 40, icon: "skull" },
  { id: "relic",    name: "Religious Artifact", value: 50000, points: 500000, weight: 40, icon: "relic" },
];
export const ARTIFACT_BY_ID = Object.fromEntries(ARTIFACTS.map((a) => [a.id, a]));
export const SELLABLE = Object.fromEntries(
  [...ORES, ...ARTIFACTS].map((e) => [e.id, e]),
);

/** Roll a mineral for a tile at this depth, or null. */
export function rollOre(depthFt, rand) {
  for (const o of ORES) {
    if (depthFt < o.minDepth) continue;
    const ramp = o.common > o.minDepth
      ? Math.min(1, 0.25 + 0.75 * ((depthFt - o.minDepth) / (o.common - o.minDepth)))
      : 1;
    // Cheap minerals thin out as you go deep; the top four never fade.
    const deepT = Math.min(1, depthFt / 7300);
    const decay = 1 - o.fade * deepT;
    if (rand() < o.peak * ramp * decay) return o;
  }
  return null;
}
