// Enemy and allied troop rosters. Health, damage, attack rate and speed follow
// the published Thronefall tables, and ranges are used as published.
//
// target:  'none'      march for the keep, fight whatever is adjacent
//          'castle'    beeline for the Castle Center, never stops for the king
//          'king'      hunt the player
//          'units'     prefer living defenders
//          'building'  any structure
//          'defensive' towers, walls, garrisons
//          'economic'  houses, mills, mines
// mul:     damage multipliers by target tag
// tags:    used by other things' multipliers (fast, flying, siege, monster, highhp)

const R = 1.0;
const r = (v) => v * R;

export const ENEMY_DEFS = {
  peasant: {
    name: 'Peasant', hp: 8.7, dmg: 1, rate: 0.5, range: r(3), spd: 4,
    target: 'none', tags: ['melee'], loot: 0.08, pts: 0.6,
  },
  swordsman: {
    name: 'Swordsman', hp: 25, dmg: 2.5, rate: 1, range: r(3), spd: 5,
    target: 'none', tags: ['melee'], loot: 0.12, pts: 2.0,
  },
  archer: {
    name: 'Archer', hp: 20, dmg: 4, rate: 0.5, range: r(30), spd: 5,
    target: 'none', proj: 'arrow', tags: ['ranged', 'towervuln'], loot: 0.14, pts: 1.6,
  },
  crossbow: {
    name: 'Elite Crossbowman', hp: 40, dmg: 15, rate: 0.625, range: r(16), spd: 4,
    target: 'units', proj: 'bolt', tags: ['ranged', 'towervuln'],
    mul: { wall: 0.15, king: 0.75 }, loot: 0.3, pts: 3.5,
  },
  pike: {
    name: 'Pikeman', hp: 25, dmg: 30, rate: 0.25, range: r(6), spd: 5,
    target: 'king', tags: ['melee', 'rangedvuln'], mul: { king: 1.4 }, loot: 0.24, pts: 3.0,
  },
  mage: {
    name: 'Flying Mage', hp: 45, dmg: 2, rate: 0.5, range: r(17), spd: 4.5,
    target: 'units', proj: 'magic', splash: r(3.25), splashDmg: 3,
    flying: true, tags: ['ranged', 'flying'], mul: { castle: 0.5 }, loot: 0.35, pts: 5.0,
  },
  slime: {
    name: 'Slime', hp: 12.5, dmg: 1.2, rate: 2.5, range: r(2.5), spd: 5,
    target: 'none', tags: ['melee', 'monster'], mul: { wall: 0.5 }, loot: 0.1, pts: 1.0,
  },
  spiky: {
    name: 'Spiky Slime', hp: 50, dmg: 3.6, rate: 2.5, range: r(2.5), spd: 5,
    target: 'none', tags: ['melee', 'monster'], mul: { wall: 0.33 },
    resist: { melee: 0.4 }, loot: 0.2, pts: 4.25,
  },
  ogre: {
    name: 'Ogre', hp: 200, dmg: 20, rate: 1, range: r(3), spd: 4,
    target: 'defensive', tags: ['melee', 'highhp'], mul: { unit: 0.5 }, loot: 0.7, pts: 17,
  },
  racer: {
    name: 'Racer', hp: 35, dmg: 2.5, rate: 1, range: r(3), spd: 10,
    target: 'castle', tags: ['melee', 'fast', 'monster'], mul: { castle: 2, wall: 0.5 },
    ignoresKing: true, loot: 0.18, pts: 5.0,
  },
  wasp: {
    name: 'Wasp', hp: 25, dmg: 2.5, rate: 1, range: r(9), spd: 8,
    target: 'economic', proj: 'arrow', flying: true, tags: ['ranged', 'flying', 'monster'],
    loot: 0.18, pts: 5.0,
  },
  hunterling: {
    name: 'Hunterling', hp: 30, dmg: 5, rate: 2, range: r(3.5), spd: 10,
    target: 'king', tags: ['melee', 'fast', 'monster'],
    resist: { melee: 0.25 }, mul: { economic: 0.25 }, loot: 0.24, pts: 2.4,
  },
  rider: {
    name: 'Monster Rider', hp: 40, dmg: 3, rate: 1, range: r(4), spd: 11,
    target: 'units', tags: ['melee', 'fast', 'monster'], loot: 0.22, pts: 3.3,
  },
  exploder: {
    name: 'Exploder', hp: 60, dmg: 3.5, rate: 1, range: r(3), spd: 6,
    target: 'building', tags: ['melee', 'monster', 'fast'], ignoresKing: true,
    boom: { radius: r(6.5), dmg: 90 }, mul: { building: 2, king: 0.5, castle: 0.5 },
    diesOnAttack: true, loot: 0.25, pts: 18,
  },
  fury: {
    name: 'Fury', hp: 75, dmg: 30, rate: 0.25, range: r(15), spd: 8,
    target: 'defensive', proj: 'fire', flying: true, tags: ['ranged', 'rangedvuln'],
    ignoresKing: true, projSpeed: 14, loot: 0.5, pts: 13,
  },
  catapult: {
    name: 'Catapult', hp: 45, dmg: 150, rate: 0.2, range: r(26.4), spd: 2,
    target: 'building', proj: 'rock', tags: ['siege'], ignoresKing: true,
    mul: { castle: 0.2 }, loot: 0.6, pts: 6.0,
  },
  quicksling: {
    name: 'Quicksling', hp: 55, dmg: 8.5, rate: 2.2, range: r(37.5), spd: 3,
    target: 'none', proj: 'rock', tags: ['siege', 'towervuln'],
    mul: { king: 0.5, castle: 0.5, unit: 0.7 }, loot: 0.4, pts: 6.5,
  },
  ram: {
    name: 'Battering Ram', hp: 250, dmg: 15, rate: 0.5, range: r(4), spd: 2.25,
    target: 'building', tags: ['siege', 'highhp'], resist: { ranged: 0.5 },
    loot: 0.9, pts: 18,
  },
  barrel: {
    name: 'Barrel Knight', hp: 100, dmg: 3.5, rate: 0.8, range: r(3.5), spd: 8,
    target: 'units', tags: ['melee', 'siege'], loot: 0.5, pts: 7.0,
  },
  // ---- the moles. Every number here is published, including the dig range and
  // its 8-16s cooldown; what the wiki does not say is whether they are safe
  // while underground or exactly where they surface. Both are decided below.
  mole_archer: {
    name: 'Mole Archer', hp: 50, dmg: 3.75, rate: 1, range: r(40), spd: 5,
    target: 'none', proj: 'arrow', projSpeed: 20, tags: ['ranged', 'towervuln'],
    dig: { range: 30, cdMin: 8, cdMax: 16 },
    mul: { king: 0.8, unit: 1.4, building: 0.5 },
    resist: { tower: 1.5 }, loot: 0.3, pts: 4.0,
  },
  mole_knight: {
    name: 'Mole Knight', hp: 60, dmg: 5, rate: 1, range: r(3), spd: 5,
    target: 'none', tags: ['melee', 'towervuln'],
    dig: { range: 30, cdMin: 8, cdMax: 16, chase: 5 },
    mul: { castle: 0.25, defensive: 0.5 },
    resist: { tower: 1.5 }, loot: 0.3, pts: 4.5,
  },
  // ------------------------------------------------------------------ bosses
  statue: {
    name: 'Strange Statue', hp: 1400, dmg: 22.5, rate: 2, range: r(6), spd: 2.4,
    target: 'king', tags: ['melee', 'boss', 'towervuln'], boss: true,
    mul: { king: 0.5, castle: 0.5 }, resist: { melee: 0.5, ranged: 0.5 },
    loot: 6, pts: 90,
  },
  shadow: {
    name: 'Shadow in the Water', hp: 2600, dmg: 0, rate: 1, range: r(8), spd: 2.0,
    target: 'castle', tags: ['boss', 'highhp'], boss: true, spawner: true,
    resist: { melee: 0.5, ranged: 0.5 }, loot: 14, pts: 200,
  },
  // The three late-map bosses. Only their NAMES and which map they close are
  // documented; every number and every behaviour below is invented.
  elara: {
    name: 'Elara the Vile', hp: 2100, dmg: 26, rate: 0.5, range: r(22), spd: 3.0,
    target: 'units', proj: 'magic', splash: r(4.5), flying: true,
    tags: ['ranged', 'boss'], boss: true, slow: 0.5,
    mul: { castle: 0.6 }, resist: { ranged: 0.6 }, loot: 10, pts: 150,
  },
  ironcastle: {
    name: 'Iron Castle', hp: 3400, dmg: 120, rate: 0.22, range: r(24), spd: 1.6,
    target: 'building', proj: 'rock', tags: ['siege', 'boss', 'highhp'], boss: true,
    ignoresKing: true, mul: { castle: 0.35 },
    resist: { ranged: 0.45, melee: 0.8 }, loot: 12, pts: 190,
  },
  corruptking: {
    name: 'The Corrupt King', hp: 3000, dmg: 34, rate: 1.2, range: r(4.5), spd: 7.5,
    target: 'king', tags: ['melee', 'boss'], boss: true,
    // The one documented thing about him: he leaps around constantly.
    dig: { range: 26, cdMin: 4, cdMax: 7, chase: 4, leap: true },
    mul: { king: 1.3, castle: 0.5 },
    resist: { melee: 0.6, ranged: 0.6 }, loot: 18, pts: 240,
  },
};

export const ALLY_DEFS = {
  knight: {
    name: 'Knight', hp: 100, dmg: 2.5, rate: 1, range: r(3.5), spd: 4,
    tags: ['melee'], resist: { ranged: 0.6 },
  },
  spearmen: {
    name: 'Spearman', hp: 60, dmg: 1.75, rate: 2, range: r(4.5), spd: 8,
    tags: ['melee', 'rangedvuln'], mul: { fast: 1.75 }, slow: 0.4,
  },
  flails: {
    name: 'Flail', hp: 70, dmg: 1.5, rate: 1, range: r(4), spd: 5,
    tags: ['melee'], splash: r(3.4),
  },
  berserks: {
    name: 'Berserk', hp: 65, dmg: 2.5, rate: 2, range: r(3), spd: 6.5,
    tags: ['melee'], mul: { siege: 2 }, search: 60,
  },
  longbow: {
    name: 'Longbow Archer', hp: 15, dmg: 4, rate: 0.5, range: r(34), spd: 9,
    tags: ['ranged'], proj: 'arrow', antiAir: true, mul: { boss: 0.5, flying: 1.3 },
  },
  crossbowman: {
    name: 'Crossbowman', hp: 35, dmg: 7, rate: 0.5, range: r(15), spd: 4,
    tags: ['ranged'], proj: 'bolt', antiAir: true, mul: { ranged: 2 }, resist: { ranged: 0.6 },
  },
  hunter: {
    name: 'Hunter', hp: 45, dmg: 3.5, rate: 0.75, range: r(25), spd: 6,
    tags: ['ranged'], proj: 'arrow', antiAir: true, mul: { monster: 2 },
  },
  firearcher: {
    name: 'Fire Archer', hp: 30, dmg: 12, rate: 0.4, range: r(25), spd: 5,
    tags: ['ranged'], proj: 'fire', antiAir: true, splash: r(3.25), mul: { siege: 3 },
  },
  golem: {
    name: 'Golem', hp: 300, dmg: 30, rate: 0.4, range: r(4.5), spd: 4,
    tags: ['melee', 'hero'], splash: r(3.4), mul: { flying: 0 },
  },
  supportmage: {
    name: 'Support Mage', hp: 25, dmg: 0, rate: 1.5, range: r(26), spd: 9,
    tags: ['hero'], heal: 14, intercept: r(28),
  },
  firewing: {
    name: 'Firewing', hp: 30, dmg: 4, rate: 1, range: r(38), spd: 10,
    tags: ['ranged', 'flying', 'hero'], proj: 'fire', antiAir: true, splash: r(3), flying: true,
  },
};

/** Enemy pools by night, with the documented difficulty-point costs. */
/** Enemy pools by night, staged the way the wiki describes Nordfels. */
export const SPAWN_POOL = [
  { at: 1, kind: 'peasant' },
  { at: 1, kind: 'swordsman' },
  { at: 2, kind: 'archer' },
  { at: 3, kind: 'slime' },
  { at: 4, kind: 'racer' },
  { at: 5, kind: 'hunterling' },
  { at: 5, kind: 'wasp' },
  { at: 6, kind: 'ogre' },
  { at: 6, kind: 'rider' },
  { at: 7, kind: 'catapult' },
  { at: 7, kind: 'pike' },
  { at: 8, kind: 'spiky' },
  { at: 8, kind: 'crossbow' },
  { at: 9, kind: 'exploder' },
  { at: 9, kind: 'quicksling' },
  { at: 10, kind: 'mage' },
  { at: 10, kind: 'barrel' },
  { at: 11, kind: 'ram' },
  { at: 8, kind: 'mole_archer' },
  { at: 9, kind: 'mole_knight' },
  { at: 12, kind: 'fury' },
];

/** Damage after tag multipliers and the defender's resistances. */
export function scaleDamage(base, attackerDef, targetTag, targetDef) {
  let d = base;
  const mul = attackerDef && attackerDef.mul;
  if (mul && targetTag && mul[targetTag] != null) d *= mul[targetTag];
  if (mul && targetDef && targetDef.tags) {
    for (const t of targetDef.tags) if (mul[t] != null) d *= mul[t];
  }
  if (targetDef && targetDef.resist && attackerDef && attackerDef.tags) {
    for (const t of attackerDef.tags) {
      if (targetDef.resist[t] != null) d *= targetDef.resist[t];
    }
  }
  return d;
}
