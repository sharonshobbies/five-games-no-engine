// Loadout: exactly one weapon, up to five perks (slots unlock with account
// level), and any number of mutators. Everything folds into one flat multiplier
// struct the simulation reads.

// One range scale across the whole game; see buildings.js.
const R = 1.0;

export const WEAPONS = {
  bow: {
    id: 'bow', name: 'Bow & Dagger', icon: '🏹', unlock: null,
    desc: 'Fast arrows. Doubles up on flyers and bosses, feeble against siege.',
    atk: { dmg: 5, rate: 1.05, range: 30 * R, airRange: 36 * R, proj: 'arrow', mul: { flying: 2, boss: 2, siege: 0.5 } },
    ability: { name: 'Dagger', cd: 6, kind: 'dagger', desc: 'Stab the nearest enemy. Cooldown shrinks the lower its health.' },
  },
  spear: {
    id: 'spear', name: 'Light Spear', icon: '🔻', unlock: 'nordfels',
    desc: 'Three jabs a second. Tears through fast enemies and slows them hard.',
    atk: { dmg: 1.71, rate: 3, range: 5 * R, melee: true, slow: 0.67, mul: { fast: 2.06, boss: 2 } },
    ability: { name: 'Second Wind', cd: 13, kind: 'heal', desc: 'Triple attack speed and heal fast for 2s — 4s if you are below 30% health.' },
  },
  sword: {
    id: 'sword', name: 'Heavy Sword', icon: '⚔️', unlock: 'durststein',
    desc: 'One slow, wide swing that splashes. Triple damage to bosses.',
    atk: { dmg: 3.465, rate: 1, range: 4 * R, melee: true, splash: 2.8, mul: { boss: 3 } },
    ability: { name: 'Cleave', cd: 9, kind: 'cleave', desc: 'A far wider sweep at double damage.' },
  },
  staff: {
    id: 'staff', name: 'Lightning Staff', icon: '⚡', unlock: 'frostsee',
    desc: 'Strikes every enemy in a huge radius at once — but only ones standing apart.',
    atk: { dmg: 2.25, rate: 0.333, range: 35 * R, proj: 'magic', spread: 5 * R, mul: { flying: 2, boss: 2 } },
    ability: { name: 'Thunderfall', cd: 9, kind: 'thunder', desc: 'After a 1s delay, lightning erupts where you stood.' },
  },
  codex: {
    id: 'codex', name: 'Shadow Codex', icon: '📕', unlock: 'uferwind',
    desc: 'Curses what it hits. Every new curse damages everything already cursed.',
    atk: { dmg: 2, rate: 0.667, range: 17 * R, proj: 'magic', curse: 1.4 },
    ability: { name: 'Reckoning', cd: 10, kind: 'reckon', desc: 'Detonate every curse at once, then clear them.' },
  },
  falchion: {
    id: 'falchion', name: 'Falchion & Traps', icon: '🗡️', unlock: 'sturmklamm',
    desc: 'The hardest-hitting blade. Doubles on monsters and heals you on every kill.',
    atk: { dmg: 6.88, rate: 1, range: 4 * R, melee: true, lifeOnKill: 12.5, mul: { monster: 2, boss: 2 } },
    ability: { name: 'Bear Trap', cd: 8, kind: 'trap', desc: 'Drop a trap that holds and shreds whatever walks into it.' },
  },
  // The last three shipped weapons. The original publishes no numbers for any
  // of them — only what each one DOES — so the behaviour below follows the
  // patch notes and the numbers are set by analogy with the six above.
  vials: {
    id: 'vials', name: 'Potion Vials', icon: '🧪', unlock: 'wildbach',
    desc: 'Thrown vials that splash: they hurt and slow whatever they hit, and mend your soldiers standing in it.',
    atk: {
      dmg: 2.4, rate: 0.7, range: 22 * R, proj: 'magic', splash: 3.4 * R,
      slow: 0.4, allyHeal: 7, mul: { monster: 1.5, boss: 1.5 },
    },
    ability: { name: 'Elixir Flask', cd: 11, kind: 'flask', desc: 'Shatter a flask underfoot: every nearby soldier is mended and every enemy slowed hard.' },
  },
  axe: {
    id: 'axe', name: 'Battle Ax', icon: '🪓', unlock: 'moorweg',
    desc: 'A slow, wide swing that bites hardest into the big ones.',
    atk: { dmg: 5.2, rate: 0.8, range: 4.4 * R, melee: true, splash: 3.2 * R, mul: { highhp: 1.6, siege: 1.4, boss: 2 } },
    ability: { name: 'Unbreakable', cd: 16, kind: 'immune', desc: 'Take no damage at all for 4 seconds. Stand in front of your soldiers and let them work.' },
  },
  bloodwand: {
    id: 'bloodwand', name: 'Blood Wand', icon: '🩸', unlock: 'freifort',
    desc: 'Feeble on its own. Everything it has goes into the ability.',
    atk: { dmg: 1.6, rate: 0.9, range: 20 * R, proj: 'magic', lifeOnKill: 4, mul: { boss: 1.5 } },
    ability: { name: 'Exsanguinate', cd: 12, kind: 'drain', desc: 'Empty one enemy at the cost of a tenth of your own health. It deletes bosses.' },
  },
};

export const PERKS = [
  { id: 'mint', name: 'Royal Mint', icon: '🪙', lvl: 2, desc: 'The keep mints +1 gold per level each morning, and you start with 1 more.', f: (m) => { m.mintGold = true; m.startGold += 1; } },
  { id: 'arcane', name: 'Arcane Towers', icon: '🔮', lvl: 3, desc: 'Towers gain +20% range and +33% damage.', f: (m) => { m.towerRange *= 1.2; m.towerDmg *= 1.33; } },
  { id: 'heavyarmor', name: 'Heavy Armor', icon: '🛡️', lvl: 5, desc: '+250% king health and +35% self-healing, but your horse is 20% slower at night.', f: (m) => { m.kingHp *= 3.5; m.kingHeal *= 1.35; m.kingNightSpeed *= 0.8; } },
  { id: 'fortifications', name: 'Castle Fortifications', icon: '🏰', lvl: 7, desc: 'The keep gets +150% health, triple fire rate and +50% range.', f: (m) => { m.castleHp *= 2.5; m.castleRate *= 3; m.castleRange *= 1.5; } },
  { id: 'resurrection', name: 'Ring of Resurrection', icon: '💍', lvl: 9, desc: 'Your first death each night revives you instantly, and every dead soldier with you.', f: (m) => { m.ringRevive = true; } },
  { id: 'commandermode', name: 'Commander Mode', icon: '📯', lvl: 11, desc: 'Your units and buildings deal +45% damage. You deal 60% less.', f: (m) => { m.unitDmg *= 1.45; m.towerDmg *= 1.45; m.kingDmg *= 0.4; } },
  { id: 'architect', name: "Architect's Council", icon: '📐', lvl: 13, desc: 'The next keep tier\'s buildings unlock a level early.', f: (m) => { m.architect = true; } },
  { id: 'warrior', name: 'Warrior Training', icon: '💪', lvl: 16, desc: 'Your weapon strengthens every night, up to +100% on the last.', f: (m) => { m.growingDmg = true; } },
  { id: 'blueprints', name: 'Castle Blueprints', icon: '📜', lvl: 18, desc: 'Walls and towers get +50% health.', f: (m) => { m.wallHp *= 1.5; m.towerHp *= 1.5; } },
  { id: 'gladiator', name: 'Gladiator School', icon: '🏟️', lvl: 20, desc: 'Soldiers train 75% faster, but every garrison and upgrade costs 1 more.', f: (m) => { m.trainSpeed *= 1.75; m.barracksCost += 1; } },
  { id: 'warhorse', name: 'War Horse', icon: '🐎', lvl: 21, desc: 'Your horse is 20% faster and tramples what you ride through.', f: (m) => { m.kingSpeed *= 1.2; m.trample = 2.5; } },
  { id: 'glasscannon', name: 'Glass Cannon', icon: '💎', lvl: 23, desc: '+100% damage, −80% health.', f: (m) => { m.kingDmg *= 2; m.kingHp *= 0.2; } },
  { id: 'elitewarriors', name: 'Elite Warriors', icon: '🎖️', lvl: 26, desc: 'All your soldiers get +75% health.', f: (m) => { m.unitHp *= 1.75; } },
  { id: 'archery', name: 'Archery Skills', icon: '🎯', lvl: 28, desc: 'Your archers gain +60% range and move 40% faster.', f: (m) => { m.archerRange *= 1.6; m.archerSpeed *= 1.4; } },
  { id: 'research', name: 'Faster Research', icon: '⚗️', lvl: 30, desc: 'Blacksmith and Royal Forge projects finish a night sooner, and both cost 1 gold less.', f: (m) => { m.fasterResearch = true; m.researchDiscount += 1; } },
  { id: 'fortifiedhouses', name: 'Fortified Houses', icon: '🧱', lvl: 32, desc: 'Houses get +250% health, and upgraded houses shoot arrows.', f: (m) => { m.houseHp *= 3.5; m.houseArrows = true; } },
  { id: 'healingspirits', name: 'Healing Spirits', icon: '🌿', lvl: 34, desc: 'All healing on you and your soldiers is 65% stronger.', f: (m) => { m.kingHeal *= 1.65; m.unitHeal *= 1.65; } },
  { id: 'icemagic', name: 'Ice Magic', icon: '❄️', lvl: 36, desc: 'Slows last twice as long, and everything you touch is slowed.', f: (m) => { m.slowLong *= 2; m.kingSlow = 0.35; } },
  { id: 'meleeres', name: 'Melee Resistance', icon: '🪖', lvl: 38, desc: 'You, your soldiers and your buildings take 32% less melee damage.', f: (m) => { m.meleeRes *= 0.68; } },
  { id: 'rangedres', name: 'Ranged Resistance', icon: '🎽', lvl: 40, desc: 'You, your soldiers and your buildings take 32% less ranged damage.', f: (m) => { m.rangedRes *= 0.68; } },
  { id: 'powertower', name: 'Power Tower', icon: '⚡', lvl: 42, desc: 'The tower nearest the keep fires 250% faster.', f: (m) => { m.powerTower = true; } },
  { id: 'treasure', name: 'Treasure Hunter', icon: '💰', lvl: 44, desc: '+15, +25 and +40 gold before each of the last three nights.', f: (m) => { m.treasure = true; } },
  { id: 'lotion', name: "God's Lotion", icon: '🧴', lvl: 46, desc: 'You regenerate twice as fast, and start regenerating twice as soon.', f: (m) => { m.regenRate *= 2.1; m.regenDelay *= 0.5; } },
  { id: 'potions', name: 'Health Potions', icon: '🧪', lvl: 48, desc: 'Every soldier heals 2.5 health a second.', f: (m) => { m.unitRegen += 2.5; } },
  { id: 'lighter', name: 'Lighter Materials', icon: '🪶', lvl: 50, desc: 'Your auto-attack cooldown is a third shorter.', f: (m) => { m.kingRate *= 1.5; } },
  { id: 'scroll', name: 'Spell Scroll', icon: '📃', lvl: 52, desc: 'Your ability cooldown is 35% shorter.', f: (m) => { m.abilityCd *= 0.65; } },
  { id: 'daredevil', name: 'Daredevil', icon: '🔥', lvl: 54, desc: 'The lower your health, the more damage — up to +115%.', f: (m) => { m.daredevil = true; } },
  { id: 'telescope', name: 'Anti-Air Telescope', icon: '🔭', lvl: 15, desc: 'Flying enemies arrive with 25% less health and damage.', f: (m) => { m.airNerf = true; } },
  { id: 'mining', name: 'Sustainable Mining', icon: '⛏️', lvl: 25, desc: 'Mines make +1 gold, and reset to full yield whenever destroyed.', f: (m) => { m.mineBonus = true; } },
  { id: 'shrines', name: 'Ancient Shrines', icon: '⛩️', lvl: 43, desc: 'Shrines are free, and fire 50% stronger — but need twice the energy.', f: (m) => { m.freeShrines = true; } },
];

export const MUTATORS = [
  { id: 'turtle', name: 'Challenge the Turtle God', icon: '🐢', score: 0.40, desc: 'Enemies have +75% health.', f: (m) => { m.enemyHp *= 1.75; } },
  { id: 'elite', name: 'Challenge the Elite God', icon: '⭐', score: 0.60, desc: 'Every third enemy is elite: four times the health, three times the damage.', f: (m) => { m.eliteEvery = 3; } },
  { id: 'growth', name: 'Challenge the Growth God', icon: '🌱', score: 0.50, desc: 'Enemies grow stronger every night, up to +75% health and damage.', f: (m) => { m.growth = true; } },
  { id: 'snake', name: 'Challenge the Snake God', icon: '🐍', score: 0.30, desc: 'Enemies drop half as much gold.', f: (m) => { m.loot *= 0.5; } },
  { id: 'phoenix', name: 'Challenge the Phoenix God', icon: '🔥', score: 0.30, desc: 'Enemies regenerate 8% of their health every second.', f: (m) => { m.enemyRegen = 0.08; } },
  { id: 'tiger', name: 'Challenge the Tiger God', icon: '🐅', score: 0.20, desc: 'Enemies deal +75% damage.', f: (m) => { m.enemyDmg *= 1.75; } },
  { id: 'falcon', name: 'Challenge the Falcon God', icon: '🦅', score: 0.20, desc: 'Enemies move 75% faster.', f: (m) => { m.enemySpeed *= 1.75; } },
  { id: 'destruction', name: 'The God of Destruction', icon: '💀', score: 0.20, desc: 'Buildings only heal 25% each morning, and destroyed ones take an extra day.', f: (m) => { m.repairFrac = 0.25; m.slowRebuild = true; } },
  { id: 'wasp', name: 'Challenge the Wasp God', icon: '🐝', score: 0.20, desc: 'The first three nights have twice the enemies.', f: (m) => { m.earlyRush = true; } },
  { id: 'death', name: 'Challenge the God of Death', icon: '☠️', score: 0.20, desc: 'Your soldiers never come back mid-night, and you revive twice as slowly.', f: (m) => { m.noNightRespawn = true; m.reviveTime *= 2; } },
  { id: 'range', name: 'Challenge the Range God', icon: '🏹', score: 0.20, desc: 'Ranged enemies get +70% range, +100% health and +40% damage.', f: (m) => { m.rangedBuff = true; } },
  { id: 'notowers', name: 'No Towers Pact', icon: '🚫', score: 0.20, desc: 'You cannot build towers.', f: (m) => { m.noTowers = true; } },
  { id: 'nounits', name: 'No Units Pact', icon: '🚷', score: 0.20, desc: 'You cannot build garrisons.', f: (m) => { m.noUnits = true; } },
  { id: 'nowalls', name: 'No Walls Pact', icon: '⛔', score: 0.10, desc: 'You cannot build walls or gates.', f: (m) => { m.noWalls = true; } },
  { id: 'wargods', name: 'Pray to the War Gods', icon: '🙏', score: -0.40, desc: 'Enemies have 20% less health and deal 20% less damage.', f: (m) => { m.enemyHp *= 0.8; m.enemyDmg *= 0.8; } },
];

export function freshMods() {
  return {
    kingHp: 1, kingDmg: 1, kingSpeed: 1, kingNightSpeed: 1, kingRate: 1,
    kingHeal: 1, regenRate: 1, regenDelay: 1, reviveTime: 1, abilityCd: 1,
    meleeRes: 1, rangedRes: 1, kingSlow: 0, slowLong: 1,
    towerDmg: 1, towerRange: 1, towerHp: 1,
    castleHp: 1, castleRate: 1, castleRange: 1,
    wallHp: 1, houseHp: 1, houseArrows: false,
    unitHp: 1, unitDmg: 1, unitHeal: 1, unitRegen: 0, trainSpeed: 1,
    archerRange: 1, archerSpeed: 1,
    // set by Blacksmith research, mid-run
    rMeleeDmg: 1, rRangedDmg: 1,
    researchDiscount: 0, fasterResearch: false,
    startGold: 0, upgradeDiscount: 0, barracksCost: 0, loot: 1, repairFrac: 1,
    mintGold: false, treasure: false, mineBonus: false, freeShrines: false,
    architect: false, ringRevive: false, powerTower: false, growingDmg: false,
    daredevil: false, trample: 0, airNerf: false,
    enemyHp: 1, enemyDmg: 1, enemySpeed: 1, enemyRegen: 0, eliteEvery: 0,
    growth: false, rangedBuff: false, earlyRush: false, noNightRespawn: false,
    slowRebuild: false, noTowers: false, noUnits: false, noWalls: false,
    scoreMul: 0,
  };
}

export function applyLoadout(perkIds, mutatorIds) {
  const m = freshMods();
  for (const id of perkIds) {
    const p = PERKS.find((x) => x.id === id);
    if (p) p.f(m);
  }
  // Mutator score multipliers compound, as they do in the original.
  let mul = 1;
  for (const id of mutatorIds) {
    const mu = MUTATORS.find((x) => x.id === id);
    if (mu) { mu.f(m); mul *= (1 + mu.score); }
  }
  m.scoreMul = Math.max(0, mul - 1);
  return m;
}

/** Perk slots unlock with account level, as in the original. */
export function perkSlots(level) {
  if (level >= 40) return 5;
  if (level >= 24) return 4;
  if (level >= 8) return 3;
  if (level >= 4) return 2;
  return 1;
}
