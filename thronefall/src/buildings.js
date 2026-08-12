// Building definitions. Costs, health and damage follow the numbers published
// on the Thronefall wikis; ranges are scaled by ~0.7 to suit this map scale.
//
// A building instance has three moving parts:
//   variant  — locked in at construction (mill traits, garrison unit type)
//   level    — 1..3
//   picks[]  — for buildings whose level-ups are a choice of four (tower, keep)
// resolveStats() folds all of them into one flat stat block.

export const PLOT_LABEL = {
  eco: 'Economy', tower: 'Defence', unit: 'Garrison', wall: 'Wall', gate: 'Gate',
  harbour: 'Waterside', bridge: 'Crossing',
};

/**
 * Buildings the original only offers on some maps. Anything not listed here is
 * available everywhere; a level declares which of these it carries in `extras`.
 * The per-map lists come from the community wiki's building availability table.
 */
export const MAP_GATED = {
  field: 1, harbour: 1, bridge: 1, blacksmith: 1, forge: 1, temple: 1,
};

/**
 * Multi-night research. A Blacksmith or Royal Forge offers a choice of four the
 * moment it is built, and another with every level; each project then runs for a
 * fixed number of NIGHTS before its buff lands, and the same project may be
 * taken again. Durations and effects are the published ones.
 */
export const RESEARCH = {
  smith: {
    title: 'Blacksmith research',
    options: [
      { id: 'meleeatk', name: 'Melee Attack', icon: '⚔️', nights: 3, desc: '+20% melee damage for your soldiers.', f: (m) => { m.rMeleeDmg *= 1.2; } },
      { id: 'rangedatk', name: 'Ranged Attack', icon: '🏹', nights: 3, desc: '+20% ranged damage for your soldiers and towers.', f: (m) => { m.rRangedDmg *= 1.2; } },
      { id: 'meleeres', name: 'Melee Resistance', icon: '🪖', nights: 2, desc: '+30% melee resistance for everything you own.', f: (m) => { m.meleeRes /= 1.3; } },
      { id: 'rangedres', name: 'Ranged Resistance', icon: '🎽', nights: 2, desc: '+30% ranged resistance for everything you own.', f: (m) => { m.rangedRes /= 1.3; } },
    ],
  },
  forge: {
    title: 'Royal Forge research',
    options: [
      { id: 'lighter', name: 'Lighter Weaponry', icon: '🪶', nights: 2, desc: "−40% cooldown on the king's auto-attack.", f: (m) => { m.kingRate /= 0.6; } },
      { id: 'armor', name: 'Additional Armor', icon: '🛡️', nights: 2, desc: '+50% king health and health regeneration.', f: (m) => { m.kingHp *= 1.5; m.regenRate *= 1.5; } },
      { id: 'blessed', name: 'Blessed Weaponry', icon: '✨', nights: 2, desc: "−40% cooldown on the king's ability.", f: (m) => { m.abilityCd *= 0.6; } },
      { id: 'sharper', name: 'Sharper Weaponry', icon: '🗡️', nights: 3, desc: '+50% king damage, passive and active alike.', f: (m) => { m.kingDmg *= 1.5; } },
    ],
  },
};

export function researchOption(kind, id) {
  const t = RESEARCH[kind];
  return t ? t.options.find((o) => o.id === id) : null;
}

// Ranges are used as published: this map's castle-to-wall distance matches the
// original's closely enough that scaling them down starved the towers.
const R = 1.0;

export const BUILD_DEFS = {
  // ---------------------------------------------------------------- economy
  house: {
    id: 'house', name: 'House', plot: 'eco', cost: 2, hp: 20, income: 1,
    icon: '🏠', art: 'house', tag: 'economic',
    desc: '1 gold every morning.',
    levels: [{ cost: 2, hp: 30, income: 2, desc: '2 gold every morning.' }],
  },
  mill: {
    id: 'mill', name: 'Mill', plot: 'eco', cost: 3, hp: 30, income: 1,
    icon: '🌾', art: 'mill', tag: 'economic',
    desc: 'Grain fields. Grows into the best income in the realm.',
    levels: [
      { cost: 4, hp: 50, income: 2, desc: '2 gold, bigger sails.' },
      { cost: 6, hp: 80, income: 6, desc: '6 gold. The heart of your economy.' },
    ],
    variants: [
      { id: 'plow', name: 'Improved Plow', icon: '🌾', desc: 'Income 1 / 3 / 8 instead of 1 / 2 / 6.', incomeByLevel: [1, 3, 8] },
      { id: 'trap', name: 'Explosive Trap', icon: '💥', desc: 'Detonates when destroyed: 39 / 78 / 137 damage.', art: 'boom', boomByLevel: [[5.5, 39], [7, 78], [8.5, 137]] },
      { id: 'scare', name: 'Scarecrows', icon: '🎯', desc: 'A slow, long-ranged shot. Very strong against flyers.', atk: { dmg: 25, rate: 0.33, range: 48 * R, proj: 'arrow', antiAir: true, mul: { flying: 1.6 } } },
      { id: 'spirits', name: 'Wind Spirits', icon: '🌀', desc: 'Intercepts enemy arrows flying nearby.', intercept: 24 * R },
    ],
  },
  mine: {
    id: 'mine', name: 'Gold Mine', plot: 'eco', cost: 5, hp: 20, income: 6, decay: 1,
    icon: '⛏️', art: 'mine', tag: 'economic',
    desc: '6 gold, but one less every night as the seam runs out.',
    levels: [],
  },
  field: {
    id: 'field', name: 'Field', plot: 'eco', cost: 1, hp: 10, income: 1,
    icon: '🌱', art: 'field', tag: 'economic', needsMill: true,
    desc: 'One gold for one gold — it pays for itself the first morning. Needs a Mill standing.',
    levels: [],
  },
  blacksmith: {
    id: 'blacksmith', name: 'Blacksmith', plot: 'eco', cost: 4, hp: 80,
    icon: '⚒️', art: 'blacksmith', tag: 'economic', research: 'smith', oneOnly: true,
    desc: 'Researches a permanent buff for your army. Each level runs one more project.',
    levels: [
      { cost: 9, hp: 80, desc: 'A second research project, alongside the first.' },
      { cost: 16, hp: 80, desc: 'A third research project.' },
    ],
  },
  forge: {
    id: 'forge', name: 'Royal Forge', plot: 'eco', cost: 4, hp: 80,
    icon: '🔥', art: 'forge', tag: 'economic', research: 'forge', oneOnly: true,
    desc: 'Researches a permanent buff for the king. Each level runs one more project.',
    levels: [
      { cost: 7, hp: 80, desc: 'A second research project, alongside the first.' },
      { cost: 14, hp: 80, desc: 'A third research project.' },
    ],
  },
  // --------------------------------------------------------------- waterside
  harbour: {
    id: 'harbour', name: 'Fishing Harbour', plot: 'harbour', cost: 3, hp: 60,
    icon: '⛵', art: 'harbour', tag: 'economic', boat: 1, boatCap: 5,
    desc: 'Lays down one boat a night, up to five. Every boat lands a gold each morning.',
    levels: [{ cost: 7, hp: 120, boat: 2, desc: 'Bigger hulls: two gold a boat.' }],
  },
  bridge: {
    id: 'bridge', name: 'Bridge', plot: 'bridge', cost: 2, hp: 120, income: 1,
    icon: '🌉', art: 'bridge', tag: 'economic', indestructible: true,
    desc: 'Opens the far bank — its plots, and its road. 1 gold every morning. They can cross too.',
    levels: [],
  },
  // ---------------------------------------------------------------- defence
  tower: {
    id: 'tower', name: 'Tower', plot: 'tower', cost: 3, hp: 100,
    atk: { dmg: 8, rate: 0.5, range: 36 * R, proj: 'arrow', antiAir: true, mul: { flying: 1.15, siege: 1.0 } },
    icon: '🗼', art: 'tower', tag: 'defensive',
    desc: 'Shoots arrows at whatever comes into range.',
    levelOptions: [
      [
        { id: 'castle', name: 'Castle Tower', cost: 5, hp: 250, desc: 'Faster, quicker arrows. Shoots whatever is closest.', atk: { dmg: 8, rate: 0.833, range: 36 * R, proj: 'arrow', antiAir: true, aim: 'close' } },
        { id: 'sniper', name: 'Sniper Tower', cost: 5, hp: 100, desc: '+50% range, huge damage, very slow. Prefers siege and big targets.', atk: { dmg: 22.4, rate: 0.25, range: 54 * R, proj: 'bolt', antiAir: true, aim: 'big', mul: { siege: 1.6 } } },
        { id: 'armour', name: 'Armoured Tower', cost: 5, hp: 450, desc: 'Very tough. Picks off the weakest and the flyers.', atk: { dmg: 8, rate: 0.5, range: 36 * R, proj: 'arrow', antiAir: true, aim: 'weak', mul: { flying: 1.5 } } },
        { id: 'bunker', name: 'Bunker Tower', cost: 5, hp: 175, desc: 'Short range, fires wildly into the crowd.', atk: { dmg: 9, rate: 1.2, range: 20 * R, proj: 'arrow', antiAir: true, aim: 'random' } },
      ],
      [
        { id: 'archerspire', name: "Archer's Spire", cost: 15, hp: 600, desc: 'Two arrows per volley, and faster.', atk: { dmg: 9, rate: 1.19, range: 36 * R, proj: 'arrow', antiAir: true, multi: 2 } },
        { id: 'ballistic', name: 'Ballistic Spire', cost: 15, hp: 375, desc: 'One enormous bolt. Slows what it hits.', atk: { dmg: 62, rate: 0.16, range: 54 * R, proj: 'bolt', pierce: 2, slow: 0.5, mul: { siege: 1.8 } } },
        { id: 'firespire', name: 'Fire Spire', cost: 15, hp: 500, desc: 'Burning shells that splash.', atk: { dmg: 16, rate: 1.0, range: 32 * R, proj: 'fire', splash: 4.6, antiAir: true } },
        { id: 'healspire', name: 'Healing Spire', cost: 15, hp: 900, desc: 'Fires no arrows — mends your soldiers instead.', heal: { amount: 14, rate: 1.2, range: 30 * R } },
      ],
    ],
  },
  shrine: {
    id: 'shrine', name: 'Shrine', plot: 'tower', cost: 3, hp: 777,
    atk: { dmg: 3.5, rate: 3, range: 20 * R, proj: 'magic', antiAir: true },
    icon: '⛩️', art: 'shrine', tag: 'defensive', needEnergy: 350,
    desc: 'Inert until 350 health of enemies die beside it. Then it wakes up.',
    levels: [],
  },
  // ---------------------------------------------------------------- garrison
  barracks: {
    id: 'barracks', name: 'Barracks', plot: 'unit', cost: 4, hp: 30,
    squad: { kind: 'knight', n: 3 }, icon: '🛡️', art: 'barracks', tag: 'defensive',
    desc: 'Melee soldiers who hold the ground around it.',
    levels: [
      { cost: 8, hp: 40, squadN: 5, desc: '5 soldiers instead of 3.' },
      { cost: 16, hp: 50, squadN: 8, desc: '8 soldiers.' },
    ],
    variants: [
      { id: 'knight', name: 'Knights', icon: '🛡️', desc: 'Tough, resistant to arrows. The plain frontline.', squadKind: 'knight' },
      { id: 'spearmen', name: 'Spearmen', icon: '🔻', desc: 'Fast, hits fast enemies hard and slows them.', squadKind: 'spearmen' },
      { id: 'flails', name: 'Flails', icon: '🔗', desc: 'The only melee troops that hit everything around them.', squadKind: 'flails' },
      { id: 'berserks', name: 'Berserks', icon: '🪓', desc: 'Leap onto siege engines and tear them apart.', squadKind: 'berserks' },
    ],
  },
  archery: {
    id: 'archery', name: 'Archery Range', plot: 'unit', cost: 4, hp: 30,
    squad: { kind: 'longbow', n: 3 }, icon: '🏹', art: 'archery', tag: 'defensive',
    desc: 'Ranged troops who shoot from behind the line.',
    levels: [
      { cost: 8, hp: 40, squadN: 5, desc: '5 archers instead of 3.' },
      { cost: 16, hp: 50, squadN: 8, desc: '8 archers.' },
    ],
    variants: [
      { id: 'longbow', name: 'Longbow Archers', icon: '🏹', desc: 'The longest reach in the realm, and the frailest.', squadKind: 'longbow' },
      { id: 'crossbow', name: 'Crossbowmen', icon: '🎯', desc: 'Armoured, hits hard, short range.', squadKind: 'crossbowman' },
      { id: 'hunters', name: 'Hunters', icon: '🦌', desc: 'Doubles damage to monsters, and can fight in melee.', squadKind: 'hunter' },
      { id: 'firearchers', name: 'Fire Archers', icon: '🔥', desc: 'Leaves burning ground. Wrecks siege engines.', squadKind: 'firearcher' },
    ],
  },
  heroq: {
    id: 'heroq', name: "Hero's Quarter", plot: 'unit', cost: 5, hp: 50,
    squad: { kind: 'golem', n: 1 }, icon: '👑', art: 'heroq', tag: 'defensive',
    desc: 'Quarters one champion. Levelling it makes the champion far stronger.',
    levels: [
      { cost: 9, hp: 70, heroMul: 2, desc: 'The champion is twice as strong.' },
      { cost: 18, hp: 90, heroMul: 4, desc: 'Four times as strong.' },
    ],
    variants: [
      { id: 'golem', name: 'Golem', icon: '🗿', desc: '300 health, heavy splash. An immovable wall.', squadKind: 'golem' },
      { id: 'mage', name: 'Support Mage', icon: '✨', desc: 'Heals your soldiers and swats enemy spells out of the air.', squadKind: 'supportmage' },
      { id: 'firewing', name: 'Firewing', icon: '🐉', desc: 'Flies, and splashes both ground and air.', squadKind: 'firewing' },
    ],
  },
  // ---------------------------------------------------------------- walls
  wall: {
    id: 'wall', name: 'Wall', plot: 'wall', cost: 3, hp: 240, blocks: true,
    icon: '🧱', art: 'wall', tag: 'wall',
    desc: 'Enemies have to break through it.',
    levels: [{ cost: 5, hp: 640, desc: 'Far thicker stone.' }],
  },
  barricade: {
    id: 'barricade', name: 'Barricade', plot: 'wall', cost: 4, hp: 200, blocks: true,
    icon: '⛔', art: 'spikewall', tag: 'wall', thorns: 15, thornsTag: 'fast',
    desc: 'Cheap timber and spikes. Shreds fast enemies that hit it.',
    levels: [{ cost: 6, hp: 380, thorns: 26, desc: 'More spikes, more timber.' }],
  },
  gate: {
    id: 'gate', name: 'Gate', plot: 'gate', cost: 4, hp: 300, blocks: true, gate: true,
    icon: '🚪', art: 'gate', tag: 'wall',
    desc: 'Your soldiers pass through. Enemies do not.',
    levels: [{ cost: 6, hp: 780, desc: 'Iron-banded oak.' }],
  },
};

// ---------------------------------------------------------------- the keep
export const CASTLE_BASE = {
  name: 'Castle Center',
  // Deliberate deviation: the published values are 100/300/700. At this map
  // scale a 100 HP keep dies to the first ten melee units that walk past an
  // unfinished wall, so all three tiers are tripled. The progression between
  // them is unchanged.
  hp: [300, 900, 2100],
  atk: [{ dmg: 4.5, rate: 0.25, range: 35, proj: 'arrow', antiAir: true },
        { dmg: 4.5, rate: 0.5, range: 35, proj: 'arrow', antiAir: true },
        { dmg: 4.5, rate: 1.0, range: 35, proj: 'arrow', antiAir: true }],
};

export const CASTLE_UPS = [
  {
    level: 2, cost: 7, options: [
      { id: 'royaltraining', name: 'Royal Training', icon: '⚔️', desc: '+75% king health, +75% king damage.', kingHp: 0.75, kingDmg: 0.75 },
      { id: 'builders', name: "Builder's Guild", icon: '🔨', desc: 'Upgrades one house free each night. +50% king health.', autoHouse: true, kingHp: 0.5 },
      { id: 'magicarmor', name: 'Magic Armor', icon: '🛡️', desc: 'Attackers take reflected damage. +150% king health.', reflect: 6, kingHp: 1.5 },
      { id: 'assassin', name: "Assassin's Training", icon: '🗡️', desc: '+150% king damage, and kills cut your ability cooldown.', kingDmg: 1.5, cdOnKill: 0.5 },
    ],
  },
  {
    level: 3, cost: 20, options: [
      { id: 'mastery', name: 'Royal Mastery', icon: '👑', desc: '+75% king health, +75% king damage.', kingHp: 0.75, kingDmg: 0.75 },
      { id: 'commander', name: 'Commander', icon: '📯', desc: 'Commanded soldiers move +60% faster AND can attack. +30% king damage, healing aura.', commander: true, kingDmg: 0.3 },
      { id: 'castleup', name: 'Castle-Up', icon: '📜', desc: 'Wall and tower upgrades cost 1 less each night.', castleUp: true },
      { id: 'curse', name: 'Godly Curse', icon: '☠️', desc: 'Your locked target takes +50% damage from everything. +75% king health.', curse: 0.5, kingHp: 0.75 },
    ],
  },
];

export function optionsFor(plotKind) {
  const out = [];
  for (const id in BUILD_DEFS) if (BUILD_DEFS[id].plot === plotKind) out.push(BUILD_DEFS[id]);
  return out;
}

/**
 * Fold variant + level + picks into one stat block.
 * b = { def, variant, level, picks[] }
 */
export function resolveStats(b) {
  const def = b.def;
  const s = {
    name: def.name, tag: def.tag, icon: def.icon,
    hp: def.hp, income: def.income || 0, decay: def.decay || 0,
    atk: def.atk ? clone(def.atk) : null,
    heal: null, intercept: 0, boom: null, thorns: def.thorns || 0,
    thornsTag: def.thornsTag || null,
    squad: def.squad ? clone(def.squad) : null,
    blocks: !!def.blocks, gate: !!def.gate,
    boats: def.boats || 0, indestructible: !!def.indestructible,
    art: def.art, artBranch: null, heroMul: 1,
    needEnergy: def.needEnergy || 0,
    boat: def.boat || 0, boatCap: def.boatCap || 0,
    research: def.research || null,
    indestructible: !!def.indestructible,
  };
  const v = def.variants && b.variant ? def.variants.find((x) => x.id === b.variant) : null;
  const lvl = b.level || 1;
  // flat level bumps
  if (def.levels) {
    for (let i = 0; i < lvl - 1 && i < def.levels.length; i++) {
      const L = def.levels[i];
      if (L.hp != null) s.hp = L.hp;
      if (L.income != null) s.income = L.income;
      if (L.squadN != null && s.squad) s.squad.n = L.squadN;
      if (L.thorns != null) s.thorns = L.thorns;
      if (L.heroMul != null) s.heroMul = L.heroMul;
      if (L.boat != null) s.boat = L.boat;
      if (L.boats != null) s.boats = L.boats;
    }
  }
  // choice-based level-ups replace the whole stat block
  if (def.levelOptions) {
    for (let i = 0; i < b.picks.length; i++) {
      const opts = def.levelOptions[i];
      if (!opts) break;
      const o = opts.find((x) => x.id === b.picks[i]);
      if (!o) break;
      if (o.hp != null) s.hp = o.hp;
      if (o.atk) s.atk = clone(o.atk);
      if (o.heal) { s.heal = clone(o.heal); s.atk = null; }
      s.name = o.name;
      s.artBranch = o.art || towerArtFor(o.id);
    }
  }
  // variant overrides
  if (v) {
    if (v.incomeByLevel) s.income = v.incomeByLevel[Math.min(lvl - 1, v.incomeByLevel.length - 1)];
    if (v.boomByLevel) {
      const bb = v.boomByLevel[Math.min(lvl - 1, v.boomByLevel.length - 1)];
      s.boom = { radius: bb[0], dmg: bb[1] };
    }
    if (v.atk) s.atk = clone(v.atk);
    if (v.intercept) s.intercept = v.intercept;
    if (v.squadKind && s.squad) s.squad.kind = v.squadKind;
    if (v.art) s.artBranch = v.art;
    s.variantName = v.name;
  }
  return s;
}

function towerArtFor(id) {
  if (id === 'sniper' || id === 'ballistic') return 'bal';
  if (id === 'firespire') return 'fire';
  if (id === 'healspire') return 'heal';
  if (id === 'armour' || id === 'bunker') return 'stone';
  return null;
}

function clone(o) { return JSON.parse(JSON.stringify(o)); }

export function maxLevel(def) {
  if (def.levelOptions) return def.levelOptions.length + 1;
  return (def.levels ? def.levels.length : 0) + 1;
}

/** What the next level-up offers: [] = maxed, list of options = a choice. */
export function nextLevelOptions(b) {
  const def = b.def;
  const lvl = b.level || 1;
  if (def.levelOptions) {
    const opts = def.levelOptions[lvl - 1];
    return opts ? opts.slice() : [];
  }
  const L = def.levels && def.levels[lvl - 1];
  if (!L) return [];
  return [Object.assign({ id: '_lvl', name: `${def.name} ${['I', 'II', 'III'][lvl]}` }, L)];
}

export function totalSpent(b) {
  let t = b.def.cost;
  const lvl = b.level || 1;
  if (b.def.levelOptions) {
    for (let i = 0; i < b.picks.length; i++) {
      const o = (b.def.levelOptions[i] || []).find((x) => x.id === b.picks[i]);
      if (o) t += o.cost;
    }
  } else if (b.def.levels) {
    for (let i = 0; i < lvl - 1; i++) if (b.def.levels[i]) t += b.def.levels[i].cost;
  }
  return t;
}
