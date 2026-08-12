// registry.js -- item definitions and merge chains.
//
// Every chain below is transcribed from the Merge Dragons! Fandom wiki merge-chain
// tables (Life Flowers, Life Orbs, Grass, Living Stones, Stone Bricks, Magic
// Currency, Dragon Trees, Fruit Trees, Prism Flowers, Treasure Chests, Goal Stars,
// Water, Mushrooms, Bushes, Graves, Dragon Homes, Dragon Gems, Autumn Trees,
// Dragon Essence, Bulbs) plus the per-breed dragon tables (Grass / Green / Rock /
// Crimson / Golem / Spotted / Sharp / Toadstool Dragons).
//
// A chain is an ordered array. Merging N copies of items[i] yields items[i+1].
// `art` selects the procedural painter in art.js; `tint` drives its palette.

// Wiki rarity colours, ascending: Common grey, Uncommon teal, Rare dark blue,
// Epic orange, Legendary yellow, Mythical pink.
export const RARITY = {
  common: '#c2c8cc', uncommon: '#3fc7b4', rare: '#3f7fd8',
  epic: '#f08a2f', legendary: '#f7d032', mythical: '#ff5fa8',
};

// How many next-tier objects a merge of N identical objects produces.
// Wiki "Merging Table": 3->1 4->1 5->2 6->2 7->2 8->3 9->3 10->4 ...
// Equivalent to optimally partitioning N into 5s (worth 2) and 3s (worth 1).
const _yieldMemo = [0, 0, 0];
export function mergeYield(n) {
  if (n < 3) return 0;
  if (_yieldMemo[n] !== undefined) return _yieldMemo[n];
  const a = n >= 5 ? 2 + mergeYield(n - 5) : 0;
  const b = 1 + mergeYield(n - 3);
  return (_yieldMemo[n] = Math.max(a, b));
}

// How many of the ORIGINAL objects a merge of N gives back.
//
// The wiki's Merging Table carries two rows below Y that are usually skipped:
// "Ejected X" (an input handed back to the board) and "Wasted X" (an input
// destroyed for nothing). Reading the published columns 3..20:
//
//   X        3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
//   Y        1  1  2  2  2  3  3  4  4  4  5  5  6  6  6  7  7  8
//   ejected  .  1  .  .  1  .  .  .  .  1  .  .  .  .  1  .  .  .
//   wasted   .  .  .  1  1  .  1  .  1  1  .  1  .  1  1  .  1  .
//
// Y next-tier objects cost the minimum inputs that can make them -- 5 per two
// (a 5-merge), 3 for an odd one (a 3-merge) -- and whatever is left over is
// either ejected or wasted. Two leftovers always split one of each; a single
// leftover is wasted, except at X=4, the one column where the spare comes back.
// So a 4-merge is never worse than a 3-merge, which is the point of the rule.
export function mergeSpent(n) {
  const y = mergeYield(n);
  if (y < 1) return 0;
  return (y % 2 === 0) ? (y / 2) * 5 : ((y - 1) / 2) * 5 + 3;
}
export function mergeSpare(n) {
  const left = n - mergeSpent(n);
  if (left >= 2) return 1;
  if (left === 1) return n === 4 ? 1 : 0;
  return 0;
}
export function mergeWasted(n) { return (n - mergeSpent(n)) - mergeSpare(n); }

// ---------------------------------------------------------------------------
// helpers for terse chain declaration
// ---------------------------------------------------------------------------
let _uid = 0;
function chain(id, label, art, tint, rows) {
  const items = rows.map((r, i) => ({
    key: `${id}:${i}`,
    idx: i,
    chain: id,
    chainLabel: label,
    art: r.art || art,
    tint: r.tint || tint,
    name: r.n,
    level: r.lv === undefined ? i : r.lv,
    size: r.s || [1, 1],
    rarity: r.r || 'common',
    worth: r.w || 0,
    desc: r.d || '',
    harvest: r.h || null,     // {item, every, n}
    heal: r.heal || 0,        // healing power released when merged
    tapHeal: r.tapHeal || 0,  // healing power released when tapped
    tapCoins: r.tapCoins || 0,
    tapBricks: r.tapBricks || 0,
    tapGems: r.tapGems || 0,
    consumeOnTap: !!r.consumeOnTap,
    taps: r.taps || 0,
    wonder: !!r.wonder,
    loot: r.loot || null,
    spawns: r.spawns || null, // {item, every} passive spawner
    statueEgg: r.statueEgg || 0, // statues/topiaries: dragon eggs from one tap
    godHeal: r.godHeal || 0,  // healing goddesses: power per cycle
    godEvery: r.godEvery || 0,
    uid: _uid++,
  }));
  return { id, label, art, tint, items };
}

export const CHAINS = {};
function reg(c) { CHAINS[c.id] = c; return c; }

// --- Life Flowers -----------------------------------------------------------
reg(chain('lifeFlower', 'Life Flowers', 'flower', '#ff6f9c', [
  { n: 'Life Flower Seed', lv: 0, w: 1, d: 'Merge to grow Life Flower Sprouts.', art: 'seed', tint: '#c98f5e' },
  { n: 'Life Flower Sprout', lv: 1, w: 1, d: 'Merge to create a Life Flower.', art: 'sprout', tint: '#7bd06a' },
  { n: 'Life Flower', lv: 2, w: 2, d: 'Harvest for Life Essence.', h: { item: 'lifeOrb:0', every: 9 }, heal: 1 },
  { n: 'Blue Life Flower', lv: 3, w: 4, d: 'Harvest for Life Essence.', tint: '#6fa8ff', h: { item: 'lifeOrb:0', every: 9 }, heal: 2 },
  { n: 'Glowing Life Flower', lv: 4, r: 'common', w: 8, d: 'Harvest for Tiny Life Orb.', tint: '#ffe066', h: { item: 'lifeOrb:1', every: 11 }, heal: 4 },
  { n: 'Twin Life Flower', lv: 5, r: 'uncommon', w: 15, d: 'Harvest for Tiny Life Orb.', tint: '#ff8fd0', h: { item: 'lifeOrb:1', every: 11 }, heal: 8 },
  { n: 'Brilliant Life Flower', lv: 6, r: 'uncommon', w: 30, d: 'Harvest for Small Life Orb.', tint: '#ffd0f0', h: { item: 'lifeOrb:2', every: 13 }, heal: 16 },
  { n: 'Giant Life Flower', lv: 7, r: 'uncommon', w: 60, d: 'Harvest for Small Life Orb.', tint: '#ff5fa0', h: { item: 'lifeOrb:2', every: 13 }, heal: 32 },
  { n: 'Life Tree Sprout', lv: 8, r: 'rare', w: 120, d: 'Harvest for Life Orb.', art: 'lifetree', tint: '#8fe07a', h: { item: 'lifeOrb:3', every: 15 }, heal: 64 },
  { n: 'Life Tree Sapling', lv: 9, r: 'rare', w: 240, d: 'Harvest for Life Orb.', art: 'lifetree', tint: '#7ad8a0', h: { item: 'lifeOrb:3', every: 15 }, heal: 96 },
  { n: 'Rooted Life Tree', lv: 10, r: 'rare', w: 480, d: 'Harvest for Furious Life Orb.', art: 'lifetree', tint: '#63d6c0', h: { item: 'lifeOrb:4', every: 17 }, heal: 128 },
  { n: 'Fanciful Life Tree', lv: 11, r: 'rare', w: 960, d: 'Harvest for Furious Life Orb.', art: 'lifetree', tint: '#7fd0ff', h: { item: 'lifeOrb:4', every: 17 }, heal: 192 },
  { n: 'Gossamer Life Tree', lv: 12, r: 'epic', w: 1900, d: 'Harvest for Wondrous Life Orb.', art: 'lifetree', tint: '#c0a0ff', h: { item: 'lifeOrb:5', every: 19 }, heal: 256 },
  { n: 'Incredible Life Tree', lv: 13, r: 'epic', w: 3800, d: 'Harvest for Wondrous Life Orb.', art: 'lifetree', tint: '#ff9ce0', h: { item: 'lifeOrb:5', every: 19 }, heal: 384 },
  { n: 'Worldly Life Tree', lv: 14, r: 'epic', w: 7600, d: 'Harvest for Great Life Orb.', art: 'lifetree', tint: '#ffd15c', h: { item: 'lifeOrb:6', every: 21 }, heal: 512 },
  { n: 'Stellar Life Tree', lv: 15, r: 'legendary', s: [2, 1], w: 15000, d: 'Harvest for Great Life Orb.', art: 'lifetree', tint: '#9fe8ff', h: { item: 'lifeOrb:6', every: 21 }, heal: 768 },
  { n: 'Heavenly Life Tree', lv: 16, r: 'legendary', s: [2, 2], w: 30000, d: 'Harvest for Giant Life Orb.', art: 'lifetree', tint: '#fff0a0', h: { item: 'lifeOrb:7', every: 23 }, heal: 1024 },
  { n: 'Life Tree of Cosmic Dreams', lv: 17, r: 'mythical', s: [2, 2], w: 60000, d: 'Harvest for Giant Life Orb.', art: 'lifetree', tint: '#d3b0ff', h: { item: 'lifeOrb:7', every: 23 }, heal: 2048 },
  { n: 'Rainbow', lv: 18, r: 'mythical', s: [3, 2], w: 120000, wonder: true, d: 'The Rainbow of Creation. Wonder #2 of the Merge Dragon World.', art: 'rainbow', tint: '#ff77bb' },
]));

// --- Life Orbs (healing power carriers; tap to release) ---------------------
reg(chain('lifeOrb', 'Life Orbs', 'orb', '#8affc8', [
  { n: 'Life Essence', lv: 0, w: 1, d: 'Tap to release Healing Power.', tapHeal: 1, consumeOnTap: true, tint: '#c9ffd8' },
  { n: 'Tiny Life Orb', lv: 1, w: 3, d: 'Tap to release Healing Power.', tapHeal: 4, consumeOnTap: true, tint: '#9dffcf' },
  { n: 'Small Life Orb', lv: 2, r: 'uncommon', w: 8, d: 'Tap to release Healing Power.', tapHeal: 16, consumeOnTap: true, tint: '#7fffd0' },
  { n: 'Life Orb', lv: 3, r: 'uncommon', w: 20, d: 'Tap to release Healing Power.', tapHeal: 64, consumeOnTap: true, tint: '#6ff0dd' },
  { n: 'Furious Life Orb', lv: 4, r: 'rare', w: 50, d: 'Tap to release Healing Power.', tapHeal: 256, consumeOnTap: true, tint: '#5fe0ff' },
  { n: 'Wondrous Life Orb', lv: 5, r: 'rare', w: 130, d: 'Tap to release Healing Power.', tapHeal: 1024, consumeOnTap: true, tint: '#9fd0ff' },
  { n: 'Great Life Orb', lv: 6, r: 'epic', w: 320, d: 'Tap to release Healing Power.', tapHeal: 4096, consumeOnTap: true, tint: '#c8b4ff' },
  { n: 'Giant Life Orb', lv: 7, r: 'legendary', w: 800, d: 'Tap to release Healing Power.', tapHeal: 16384, consumeOnTap: true, tint: '#ffd9ff' },
  { n: 'Life Orb of Souls', lv: 8, r: 'legendary', w: 2000, d: 'Tap to release Healing Power.', tapHeal: 65536, consumeOnTap: true, tint: '#fff2c0' },
  { n: 'The Life Orb of Heavens', lv: 9, r: 'mythical', w: 5000, d: 'Tap to release Healing Power.', tapHeal: 327680, consumeOnTap: true, tint: '#ffffff' },
]));

// --- Grass ------------------------------------------------------------------
reg(chain('grass', 'Grass', 'grass', '#6dbd52', [
  { n: 'Mysterious Seed', lv: 0, w: 1, d: 'Merge to grow something.', art: 'seed', tint: '#b98b55' },
  { n: 'Grass Tuft', lv: 1, w: 1, d: 'May die if left alone.', tint: '#7fc75f' },
  { n: 'Lawn Grass', lv: 2, w: 2, d: 'Harvest for Fresh Stones.', tint: '#6dbd52', h: { item: 'stone:0', every: 12 } },
  { n: 'Great Grass', lv: 3, r: 'uncommon', w: 4, d: 'Harvest for Fresh Stones.', tint: '#5fae46', h: { item: 'stone:0', every: 12 } },
  { n: 'Marsh Grass', lv: 4, r: 'uncommon', w: 8, d: 'Harvest for Fresh Stones.', tint: '#57a06a', h: { item: 'stone:0', every: 12 } },
  { n: 'Tall Grass', lv: 5, r: 'uncommon', w: 15, d: 'Harvest for Moss Covered Stones.', tint: '#4f9c3f', h: { item: 'stone:1', every: 14 } },
  { n: 'Golden Wheatgrass', lv: 6, r: 'rare', w: 30, d: 'Harvest for Moss Covered Stones.', tint: '#d9b64a', h: { item: 'stone:1', every: 14 } },
  { n: "Dragon's Whisker", lv: 7, r: 'rare', w: 50, d: 'Harvest for Moss Covered Stones.', tint: '#8fd6c0', h: { item: 'stone:1', every: 14 } },
  { n: 'Radiant Grass', lv: 8, r: 'epic', w: 150, d: 'Harvest for Moss Covered Stones.', tint: '#b6f07a', h: { item: 'stone:1', every: 14 } },
  { n: 'Ensnared Virtue', lv: 9, r: 'legendary', s: [2, 2], w: 2500, wonder: true, d: 'The Sword that Slayed Bahamut. Wonder #3 of the Dragon World.', art: 'sword', tint: '#dfe8f0' },
]));
CHAINS.grass.tint = '#6dbd52';

// --- Living Stones ----------------------------------------------------------
reg(chain('stone', 'Living Stones', 'stone', '#9aa79a', [
  { n: 'Fresh Stones', lv: 1, w: 1, d: 'Harvest for Moss Covered Stone.', h: { item: 'brick:0', every: 14 } },
  { n: 'Moss Covered Stone', lv: 2, w: 2, d: 'Harvest for a Stone Brick.', tint: '#8ea884', h: { item: 'brick:0', every: 14 } },
  { n: 'Living Stone', lv: 3, w: 4, d: 'Harvest for a Stone Brick.', tint: '#7f9e78', h: { item: 'brick:0', every: 13 } },
  { n: 'Large Moss Stone', lv: 4, r: 'uncommon', w: 8, d: 'Harvest for a Stone Brick.', tint: '#77987a', h: { item: 'brick:0', every: 13 } },
  { n: 'Cloverstone', lv: 5, r: 'uncommon', w: 15, d: 'Harvest for Stone Bricks.', tint: '#6fae72', h: { item: 'brick:1', every: 15 } },
  { n: 'Basalt Rock', lv: 6, r: 'rare', w: 30, d: 'Harvest for Stone Bricks.', tint: '#6a6a74', h: { item: 'brick:1', every: 15 } },
  { n: "King's Seat", lv: 7, r: 'rare', w: 50, d: 'Harvest for a Pile of Stone Bricks.', tint: '#a89a86', h: { item: 'brick:2', every: 17 } },
  { n: 'Dino Rock', lv: 8, r: 'epic', w: 150, d: 'Harvest for a Pile of Stone Bricks.', tint: '#8c7f9a', h: { item: 'brick:2', every: 17 } },
  { n: 'Bluemoss Stoneguard', lv: 9, r: 'epic', s: [2, 2], w: 400, d: 'Harvest for a Nightstone Brick.', tint: '#6f8fa8', h: { item: 'brick:3', every: 19 } },
  { n: 'Dragonmoss Steppes', lv: 10, r: 'legendary', s: [2, 2], w: 900, d: 'Harvest for a Nightstone Brick.', tint: '#5f8f7a', h: { item: 'brick:3', every: 19 } },
  { n: 'Stonehenge', lv: 11, r: 'mythical', s: [3, 2], w: 2500, wonder: true, d: 'Ancient Burial Site... it feels cold. Wonder #5 of the Dragon World.', art: 'henge', tint: '#b3b8bd' },
]));

// --- Stone Bricks (tap to bank bricks) -------------------------------------
reg(chain('brick', 'Stone Bricks', 'brick', '#c8b48f', [
  { n: 'Stone Brick', lv: 1, w: 1, d: 'Worth 1 Brick. Tap to collect, or Merge.', tapBricks: 1, consumeOnTap: true },
  { n: 'Stone Bricks', lv: 2, w: 4, d: 'Worth 5 Bricks. Tap to collect, or Merge.', tapBricks: 5, consumeOnTap: true },
  { n: 'Pile of Stone Bricks', lv: 3, w: 15, d: 'Worth 20 Bricks. Tap to collect, or Merge.', tapBricks: 20, consumeOnTap: true },
  { n: 'Nightstone Brick', lv: 4, r: 'uncommon', w: 50, d: 'Worth 75 Bricks. Stone made from petrified ogres.', tint: '#7a7490', tapBricks: 75, consumeOnTap: true },
  { n: 'Nightstone Bricks', lv: 5, r: 'uncommon', w: 175, d: 'Worth 250 Bricks. Buildings from this stone never crumble.', tint: '#6f6a88', tapBricks: 250, consumeOnTap: true },
  { n: 'Pile of Nightstone Bricks', lv: 6, r: 'uncommon', w: 550, d: 'Worth 800 Bricks. Heavier than a boulder.', tint: '#655f80', tapBricks: 800, consumeOnTap: true },
  { n: 'Ogre Stone Shards', lv: 7, r: 'uncommon', w: 2000, d: 'Worth 2500 Bricks. Bits of a petrified ogre.', tint: '#8e8478', tapBricks: 2500, consumeOnTap: true },
  { n: 'Ogre Stone', lv: 8, r: 'uncommon', w: 7500, d: 'Worth 8000 Bricks. Chunk of a petrified ogre.', tint: '#847a6e', tapBricks: 8000, consumeOnTap: true },
  { n: 'Ogre Stone Monolith', lv: 9, r: 'uncommon', w: 25000, d: 'Worth 25000 Bricks. Piece of a great petrified ogre.', tint: '#79706a', tapBricks: 25000, consumeOnTap: true },
]));

// --- Magic Currency ---------------------------------------------------------
reg(chain('coin', 'Magic Currency', 'coin', '#f2c14e', [
  { n: 'Tiny Magic Coin', lv: 1, w: 1, d: 'Tap to collect, or Merge.', tapCoins: 1, consumeOnTap: true, tint: '#e0b56a' },
  { n: 'Magic Coin - Bronze', lv: 2, w: 4, d: 'Worth 4 Coins.', tapCoins: 4, consumeOnTap: true, tint: '#c9803f' },
  { n: 'Magic Coin - Silver', lv: 3, w: 15, d: 'A nice emblem. Worth 15 Coins.', tapCoins: 15, consumeOnTap: true, tint: '#d5dde5' },
  { n: 'Magic Coin - Gold', lv: 4, r: 'uncommon', w: 50, d: 'A valuable emblem. Worth 50 Coins.', tapCoins: 50, consumeOnTap: true, tint: '#f7cf49' },
  { n: 'Magic Coin - Spellium', lv: 5, r: 'uncommon', w: 175, d: 'Fetches a nice value. Worth 175 Coins.', tapCoins: 175, consumeOnTap: true, tint: '#8fe8ff' },
  { n: 'Magic Gem of Blood', lv: 6, r: 'rare', w: 550, d: 'Ooo, sparkly! Worth 550 Coins.', art: 'gem', tapCoins: 550, consumeOnTap: true, tint: '#e0384f' },
  { n: 'Magic Gem of Tears', lv: 7, r: 'rare', w: 2000, d: 'Wow, shimmers! Worth 2000 Coins.', art: 'gem', tapCoins: 2000, consumeOnTap: true, tint: '#49a8e8' },
  { n: 'Magic Gem of Fate', lv: 8, r: 'epic', w: 7500, d: 'Aaaahh, pretty! Worth 7500 Coins.', art: 'gem', tapCoins: 7500, consumeOnTap: true, tint: '#a95fe0' },
  { n: 'Magic Gem of Life', lv: 9, r: 'legendary', w: 25000, d: 'Woah... Very valuable! Worth 25K Coins.', art: 'gem', tapCoins: 25000, consumeOnTap: true, tint: '#5fe08f' },
]));

// --- Dragon Trees -----------------------------------------------------------
reg(chain('dragonTree', 'Dragon Trees', 'tree', '#5f9e4f', [
  { n: 'Dragon Tree Leaf', lv: 0, r: 'uncommon', w: 1, d: 'This leaf has a mystical energy!', art: 'leaf', tint: '#7fc75f' },
  { n: 'Dragon Tree Seeds', lv: 0, r: 'uncommon', w: 1, d: 'Worth trading a cow for.', art: 'seed', tint: '#a8763f' },
  { n: 'Dragon Tree Sapling', lv: 1, w: 2, d: 'This sapling is destined for great things.', art: 'sprout', tint: '#6fbf55' },
  { n: 'Sprouting Dragon Tree', lv: 2, w: 4, d: "Each Dragon Tree has a dragon's spirit within.", h: { item: 'coin:0', every: 14 } },
  { n: 'Young Dragon Tree', lv: 3, w: 8, d: 'Dragon Trees can live for tens of thousands of years.', h: { item: 'coin:0', every: 13 } },
  { n: 'Vermillion Dragon Tree', lv: 4, w: 15, d: 'An endless source of Wood!', tint: '#c04f3f', h: { item: 'coin:1', every: 14 } },
  { n: 'Nice Dragon Tree', lv: 5, r: 'uncommon', w: 30, d: 'An endless source of Wood and treasures!', tint: '#4f9e6f', h: { item: 'coin:1', every: 13 } },
  { n: 'Aged Dragon Tree', lv: 6, r: 'uncommon', w: 60, d: 'An endless source of Wood and loot!', tint: '#3f8e5f', h: { item: 'coin:2', every: 15 } },
  { n: 'Elder Dragon Tree', lv: 7, r: 'uncommon', w: 120, d: 'An endless source of Wood and riches!', tint: '#5f7f4f', h: { item: 'coin:2', every: 15 }, heal: 8 },
  { n: 'Ancient Dragon Tree', lv: 8, r: 'rare', w: 300, d: 'An endless source of Wood and wealth!', tint: '#6f6a4f', h: { item: 'coin:3', every: 17 }, heal: 24 },
  { n: 'Arcane Dragon Tree', lv: 9, r: 'rare', s: [1, 2], w: 700, d: 'An endless source of Wood and fortune!', tint: '#7f5fa8', h: { item: 'coin:3', every: 17 }, heal: 64 },
  { n: 'Legendary Dragon Tree', lv: 10, r: 'epic', s: [1, 2], w: 1600, d: 'An endless source of Wood and wild bounties!', tint: '#c9a04f', h: { item: 'coin:4', every: 19 }, heal: 128 },
  { n: 'Remains of The Dragon God', lv: 11, r: 'mythical', s: [3, 2], w: 6000, wonder: true, d: 'Here lies Bahamut. Wonder #1 of the Merge Dragon World.', art: 'bones', tint: '#e8e0cf' },
]));

// --- Fruit Trees ------------------------------------------------------------
reg(chain('fruitTree', 'Fruit Trees', 'tree', '#4fa86f', [
  { n: 'Leaf of a Fruit Tree', lv: 0, w: 1, d: 'This leaf is lucky. Merge to grow a Sapling.', art: 'leaf', tint: '#8fd06a' },
  { n: 'Fruit Tree Seed', lv: 0, w: 1, d: 'Merge to grow a Sapling. Or wait a while...', art: 'seed', tint: '#b0854f' },
  { n: 'Fruit Tree Sapling', lv: 1, w: 2, d: "It's alive! It's ALIVE!!!", art: 'sprout', tint: '#6fc75f' },
  { n: 'Young Fruit Tree', lv: 2, w: 4, d: 'Occasionally grows Life Flower Sprouts nearby.', spawns: { item: 'lifeFlower:1', every: 26 } },
  { n: 'Small Fruit Tree', lv: 3, w: 8, d: 'Occasionally grows Life Flower Sprouts nearby.', spawns: { item: 'lifeFlower:1', every: 22 } },
  { n: 'Fruit Tree', lv: 4, w: 15, d: 'Can sometimes Tap for Grapes.', tint: '#3f9e5f', h: { item: 'coin:1', every: 12 }, spawns: { item: 'lifeFlower:1', every: 20 } },
  { n: 'Large Fruit Tree', lv: 5, r: 'uncommon', w: 30, d: 'Can sometimes Tap for a Raspberry.', tint: '#4f9e4f', h: { item: 'coin:1', every: 11 }, spawns: { item: 'lifeFlower:1', every: 18 } },
  { n: 'Nice Fruit Tree', lv: 6, r: 'uncommon', w: 60, d: 'Can sometimes Tap for Bananas.', tint: '#6faf4f', h: { item: 'coin:2', every: 12 }, spawns: { item: 'lifeFlower:1', every: 16 } },
  { n: 'Aged Fruit Tree', lv: 7, r: 'rare', w: 120, d: 'Can sometimes tap for a Pear.', tint: '#7fa84f', h: { item: 'coin:2', every: 12 }, spawns: { item: 'lifeFlower:2', every: 18 } },
  { n: 'Elder Fruit Tree', lv: 8, r: 'rare', w: 300, d: 'Can sometimes tap for Dragon Fruit.', tint: '#af6f8f', h: { item: 'coin:3', every: 14 }, spawns: { item: 'lifeFlower:2', every: 16 } },
  { n: 'Ancient Fruit Tree', lv: 9, r: 'epic', s: [2, 1], w: 700, d: 'Can sometimes tap for a Pineapple.', tint: '#c9a83f', h: { item: 'coin:3', every: 13 }, spawns: { item: 'lifeFlower:3', every: 18 } },
  { n: 'Mystical Fruit Tree', lv: 10, r: 'epic', s: [2, 1], w: 1600, d: 'Can sometimes tap for Watermelons.', tint: '#4fc78f', h: { item: 'coin:4', every: 14 }, spawns: { item: 'lifeFlower:3', every: 16 } },
  { n: 'Magic Beanstalk', lv: 11, r: 'mythical', s: [2, 2], w: 6000, wonder: true, d: 'Leads to the Heavens. Wonder #8 of the Merge Dragon World.', art: 'beanstalk', tint: '#6fd07f' },
]));

// --- Prism Flowers ----------------------------------------------------------
reg(chain('prism', 'Prism Flowers', 'prism', '#c07fff', [
  { n: 'Seeds of the Prism Flower', lv: 0, r: 'uncommon', w: 2, d: 'Can be found in the Necromancer Grass.', art: 'seed', tint: '#a87fc9' },
  { n: 'Sprouting Prism Flower', lv: 1, r: 'uncommon', w: 4, d: 'Can sometimes tap for Life Essence!', tapHeal: 1, h: { item: 'dragonTree:0', every: 20 } },
  { n: 'Prism Flower Buds', lv: 2, r: 'uncommon', w: 8, d: 'Nice! Can sometimes tap for Life Essence!', tapHeal: 2, h: { item: 'dragonTree:0', every: 18 } },
  { n: 'Opening Prism Flowers', lv: 3, r: 'uncommon', w: 15, d: 'Radiant flowers! Tap for Healing Power!', tapHeal: 6, heal: 8 },
  { n: 'Prism Flowers', lv: 4, r: 'rare', w: 30, d: 'Smell the rainbow! Tap for Healing Power!', tapHeal: 16, heal: 16 },
  { n: 'Blossoming Prism Flowers', lv: 5, r: 'rare', w: 60, d: 'Beautiful! Tap for Healing Power!', tapHeal: 40, heal: 32 },
  { n: 'Gorgeous Prism Flowers', lv: 6, r: 'rare', w: 120, d: 'Tap for Healing Power!', tapHeal: 90, heal: 64 },
  { n: 'Brilliant Prism Flowers', lv: 7, r: 'epic', w: 300, d: 'Wow! Tap for Healing Power!', tapHeal: 220, heal: 128 },
  { n: 'Spectral Prism Flowers', lv: 8, r: 'epic', w: 700, d: "A unicorn's favorite. Tap for Great Healing Power!", tapHeal: 560, heal: 256 },
  { n: 'Glowing Prism Flowers', lv: 9, r: 'legendary', w: 1600, d: 'Incredible! Tap for Great Healing Power!', tapHeal: 1400, heal: 512 },
  { n: 'Trinity Dome', lv: 10, r: 'mythical', s: [2, 2], w: 6000, wonder: true, d: 'Wonder #7 of the World. An homage to the Lost Trinity Dragon.', art: 'dome', tint: '#d0a0ff' },
]));

// --- Treasure Chests --------------------------------------------------------
reg(chain('chest', 'Treasure Chests', 'chest', '#c08a4f', [
  { n: 'Ordinary Treasure Chest', lv: 1, w: 5, d: 'Tap to open. Or Merge with other chests...', loot: 1 },
  { n: 'Nice Treasure Chest', lv: 2, r: 'uncommon', w: 15, d: 'Tap to open. Or Merge with other chests...', tint: '#a8763f', loot: 2 },
  { n: 'Chained Treasure Chest', lv: 3, r: 'uncommon', w: 40, d: 'Tap to open. Or Merge with other chests...', tint: '#8f8f9a', loot: 3 },
  { n: 'Sunken Chest', lv: 4, r: 'rare', s: [1, 2], w: 100, d: 'Tap to open. Or Merge with other chests...', tint: '#4f8f9a', loot: 4 },
  { n: 'Noble Chest', lv: 5, r: 'rare', w: 250, d: 'Tap to open. Or Merge with other chests...', tint: '#9a4f5f', loot: 5 },
  { n: 'Glowing Chest', lv: 6, r: 'epic', w: 600, d: 'Tap to open. This is as good as it gets!', tint: '#e0c04f', loot: 6 },
  { n: 'Giant Treasure Chest', lv: 7, r: 'epic', s: [2, 2], w: 1500, d: "It's SO BIG! Tap to open, if you can handle it!", tint: '#c9a03f', loot: 7 },
]));

// --- Goal Stars -------------------------------------------------------------
reg(chain('star', 'Goal Stars', 'star', '#ffe066', [
  { n: 'Tiny Fallen Star', lv: 1, r: 'uncommon', w: 10, d: 'Tap or Merge for something good...', taps: 2, loot: 1 },
  { n: 'Fallen Star', lv: 2, r: 'uncommon', w: 10, d: 'Tap or Merge for something good...', taps: 3, loot: 2 },
  { n: 'Great Fallen Star', lv: 3, r: 'uncommon', w: 10, d: 'Tap or Merge for something good...', taps: 3, loot: 3 },
  { n: 'Magnificent Fallen Star', lv: 4, r: 'uncommon', w: 10, d: 'Tap for something good...', taps: 4, loot: 4 },
  { n: 'Fallen Star of the Ages', lv: 5, r: 'uncommon', w: 10, d: 'Tap for something good...', taps: 4, loot: 5 },
  { n: 'The Cosmos Star', lv: 6, r: 'uncommon', s: [2, 2], w: 10, d: 'Tap for something good...', taps: 7, loot: 6 },
]));

// --- Water ------------------------------------------------------------------
reg(chain('water', 'Water', 'water', '#5fb8e8', [
  { n: 'Rain Puddle', lv: 1, w: 1, d: 'May turn into Spotted Shrooms.' },
  { n: 'Fledgling Puddle', lv: 2, w: 2, d: 'May turn into a Hero Mushroom.' },
  { n: 'Puddle', lv: 3, w: 4, d: 'May turn into a Hero Mushroom.' },
  { n: 'Water', lv: 4, w: 8, d: 'Grass may grow nearby, or something magical...', spawns: { item: 'grass:1', every: 24 } },
  { n: 'Watering Hole', lv: 5, r: 'uncommon', s: [1, 2], w: 15, d: 'Grass may grow nearby...', spawns: { item: 'grass:1', every: 20 } },
  { n: 'Manicured Pond', lv: 6, r: 'uncommon', s: [2, 1], w: 30, d: 'Grass may grow nearby...', spawns: { item: 'grass:2', every: 20 } },
  { n: 'Large Pond', lv: 7, r: 'rare', s: [2, 2], w: 60, d: 'Grass may grow nearby...', spawns: { item: 'grass:2', every: 18 } },
  { n: 'Beautiful Pond', lv: 8, r: 'rare', s: [2, 2], w: 150, d: 'Grass may grow nearby...', spawns: { item: 'grass:3', every: 18 } },
  { n: 'Bottled Ocean', lv: 9, r: 'legendary', s: [2, 2], w: 2500, wonder: true, d: 'An entire ocean captured within. Wonder #6 of the Dragon World.', art: 'bottle', tint: '#4fa8e8' },
]));

// --- Mushrooms --------------------------------------------------------------
reg(chain('mushroom', 'Mushrooms', 'shroom', '#e05f7f', [
  { n: 'Mushroom Caps', lv: 0, w: 1, d: 'Merge to grow Mushrooms!', tint: '#c9a08f' },
  { n: 'Spotted Shrooms', lv: 1, w: 2, d: 'These tend to pop up in wet areas, or near shrubs.' },
  { n: 'Hero Mushroom', lv: 2, w: 4, d: 'From another time, another place...', tint: '#c94f4f' },
  { n: 'Triple Shroom', lv: 3, w: 8, d: 'These mushrooms want to be merged.', tint: '#d06f8f' },
  { n: 'Carnivorous Shroom', lv: 4, r: 'uncommon', w: 15, d: 'Harvest for more shrooms or a Fungus Log!', tint: '#a83f5f', h: { item: 'mushroom:0', every: 13 } },
  { n: 'Stalwart Shroom', lv: 5, r: 'uncommon', w: 30, d: 'Harvest for more shrooms or a Fungus Log!', tint: '#8f4f7f', h: { item: 'mushroom:0', every: 13 } },
  { n: 'Umbrella Shroom', lv: 6, r: 'rare', w: 60, d: 'Harvest for more shrooms or a Fungus Log!', tint: '#c98f4f', h: { item: 'mushroom:1', every: 15 } },
  { n: 'Pod Fungus', lv: 7, r: 'rare', w: 120, d: 'Harvest for more shrooms or a Fungus Log!', tint: '#7fa84f', h: { item: 'mushroom:1', every: 15 } },
  { n: 'Dwarf Fungus', lv: 8, r: 'epic', w: 300, d: 'Dwarves brushed their teeth with these spores.', tint: '#8f7fc9' },
  { n: '1000 Year Fungus', lv: 9, r: 'epic', w: 700, d: 'So old, it was licked by a dinosaur.', tint: '#5f9ec9' },
  { n: 'Prehistoric Mushrooms', lv: 10, r: 'legendary', w: 1600, d: 'Do NOT merge this mushroom! Or maybe you should...', tint: '#e0704f' },
  { n: 'Dragonfire Shroom Forest', lv: 11, r: 'mythical', s: [2, 2], w: 6000, wonder: true, d: 'Over 5 millenia old! Wonder #11 of the Dragon World.', tint: '#ff5f4f' },
]));

// --- Bushes -----------------------------------------------------------------
reg(chain('bush', 'Bushes', 'bush', '#4f8f4f', [
  { n: 'Shrub Sprouts', lv: 1, w: 1, d: 'Harvest for Mushroom Caps.', h: { item: 'mushroom:0', every: 14 } },
  { n: 'Budding Shrub', lv: 2, w: 2, d: 'Harvest for Mushroom Caps.', h: { item: 'mushroom:0', every: 14 } },
  { n: 'Nice Shrub', lv: 3, w: 4, d: 'Harvest for Mushroom Caps.', tint: '#5f9e57', h: { item: 'mushroom:0', every: 13 } },
  { n: 'Flowering Shrub', lv: 4, r: 'uncommon', w: 8, d: 'Harvest for Mushroom Caps.', tint: '#6faf6f', h: { item: 'mushroom:0', every: 13 } },
  { n: 'Gorgeous Shrub', lv: 5, r: 'uncommon', w: 15, d: 'Harvest for Mushroom Caps.', tint: '#7fbf6f', h: { item: 'mushroom:0', every: 12 } },
  { n: 'Ruins of the Sky Palace', lv: 6, r: 'epic', s: [2, 2], w: 2500, wonder: true, d: "All that's left of the Sky Palace. Wonder #10 of the Dragon World.", art: 'ruins', tint: '#c9d0d8' },
]));

// --- Graves (dead things) ---------------------------------------------------
reg(chain('grave', 'Graves', 'grave', '#8f8f9a', [
  { n: 'Fresh Grave', lv: 1, w: 1, d: 'Here lies a Zomblin.' },
  { n: "Corwin's Tomb", lv: 2, r: 'uncommon', w: 2, d: 'Necromancer Grass may grow nearby.', spawns: { item: 'prism:0', every: 30 } },
  { n: "Lost Soul's Grave", lv: 3, r: 'uncommon', w: 4, d: 'Necromancer Grass may grow nearby.', spawns: { item: 'prism:0', every: 26 } },
  { n: 'Doom Cross', lv: 4, r: 'rare', w: 8, d: 'Can sometimes Tap to get an eerie vessel...', h: { item: 'lifeFlower:0', every: 16 } },
  { n: "Fiend's Resting Place", lv: 5, r: 'rare', w: 15, d: 'Can sometimes Tap to get an eerie vessel...', h: { item: 'lifeFlower:0', every: 16 } },
  { n: 'Tomb of the Innocent', lv: 6, r: 'epic', w: 30, d: 'Can sometimes Tap to get an eerie vessel...', h: { item: 'lifeFlower:1', every: 18 } },
  { n: 'Tomb of the Forgiven', lv: 7, r: 'epic', w: 60, d: 'Can sometimes Tap to get an eerie vessel...', h: { item: 'lifeFlower:1', every: 18 } },
  { n: 'Tomb of the Righteous', lv: 8, r: 'legendary', w: 150, d: 'Can sometimes Tap to get an eerie vessel...', h: { item: 'lifeFlower:2', every: 20 } },
]));

// --- Dragon Homes -----------------------------------------------------------
reg(chain('home', 'Dragon Homes', 'home', '#a8764f', [
  { n: 'Tiny Dragon Home', lv: 1, r: 'uncommon', w: 10, d: 'Fully rests 1 Dragon in 20 minutes.', rest: 1 },
  { n: 'Quaint Dragon Home', lv: 2, r: 'uncommon', w: 25, d: 'Fully rests 1 Dragon in 17 minutes.' },
  { n: 'Dragon Treehouse', lv: 3, r: 'uncommon', w: 60, d: 'Fully rests 1 Dragon in 15 minutes.', tint: '#6f8f4f' },
  { n: 'Stone Dragon Dwelling', lv: 4, r: 'uncommon', w: 140, d: 'Fully rests 1 Dragon in 13 minutes.', tint: '#8f8f9a' },
  { n: 'Nice Dragon Home', lv: 5, r: 'rare', w: 320, d: 'Fully rests 1 Dragon in 11 minutes.', tint: '#c98f5f' },
  { n: 'Grand Dragon Home', lv: 6, r: 'rare', w: 700, d: 'Fully rests 1 Dragon in 9 minutes.', tint: '#c9a04f' },
  { n: 'Opulent Dragon Cave', lv: 7, r: 'epic', w: 1600, d: 'Fully rests 1 Dragon in 7 minutes.', tint: '#7f6f9a' },
  { n: 'Giant Dragon Mansion', lv: 8, r: 'legendary', s: [2, 2], w: 4000, d: 'Fully rests 1 Dragon in 5 minutes.', tint: '#d0a86f' },
]));

// --- Dragon Gems ------------------------------------------------------------
reg(chain('dgem', 'Dragon Gems', 'dgem', '#ff5fa8', [
  { n: 'Dragon Gem', lv: 1, r: 'epic', w: 0, d: 'Tap to collect, or Merge.', tapGems: 1, consumeOnTap: true },
  { n: 'Giant Dragon Gem', lv: 2, r: 'legendary', w: 0, d: 'Tap to collect, or Merge.', tapGems: 5, consumeOnTap: true, tint: '#ff7fc9' },
  { n: 'Insane Dragon Gem', lv: 3, r: 'mythical', w: 0, d: 'Tap to collect.', tapGems: 25, consumeOnTap: true, tint: '#ffa8e0' },
]));

// --- Dragon Stars -----------------------------------------------------------
reg(chain('dstar', 'Dragon Stars', 'dstar', '#ffd0ff', [
  { n: 'Dragon Star', lv: 1, r: 'legendary', w: 0, d: 'Tap for Dragon Gems!', taps: 3, tapGems: 1 },
  { n: 'Magnificent Dragon Star', lv: 2, r: 'mythical', w: 0, d: 'Tap for Extra Dragon Gems!', taps: 5, tapGems: 3 },
]));

// --- Autumn Trees -----------------------------------------------------------
reg(chain('autumnTree', 'Autumn Trees', 'tree', '#e0803f', [
  { n: 'Autumn Leaf', lv: 0, r: 'uncommon', w: 1, d: "Merge for a Lil' Autumn Sprout.", art: 'leaf', tint: '#e0a03f' },
  { n: "Lil' Autumn Sprout", lv: 1, r: 'uncommon', w: 2, d: 'Awww... look at this lil\' guy!', art: 'sprout', tint: '#e0903f' },
  { n: 'Autumn Sapling', lv: 2, r: 'uncommon', w: 4, d: "Awww... look at this lil' gal!", art: 'sprout', tint: '#d0803f' },
  { n: 'Young Autumn Tree', lv: 3, r: 'uncommon', w: 8, d: 'Beautiful! But the leaves cause 3rd degree burns.', tint: '#e0953f' },
  { n: 'Bushy Autumn Tree', lv: 4, r: 'uncommon', w: 15, d: 'Gorgeous! But the leaves drip poison.', tint: '#e07f3f' },
  { n: 'Mystical Autumn Tree', lv: 5, r: 'rare', w: 30, d: "Pretty, when it isn't covered in angry hornets.", tint: '#d06f4f' },
  { n: 'Pinkberry Autumn Tree', lv: 6, r: 'rare', w: 60, d: 'A wonderful tree, except when it stabs you in the eye.', tint: '#e06f8f' },
  { n: 'Fancy Autumn Tree', lv: 7, r: 'rare', w: 120, d: 'Ogres use these as pom-poms sometimes.', tint: '#e0603f' },
  { n: 'Broadleaf Autumn Tree', lv: 8, r: 'epic', w: 300, d: "A great decoration. It's also a tree.", tint: '#c9a03f' },
  { n: 'Great Autumn Tree', lv: 9, r: 'epic', s: [2, 2], w: 700, d: "Why is this tree shaped like a leaf...? It's a secret...", tint: '#e0952f' },
  { n: 'Brilliant Autumn Tree', lv: 10, r: 'legendary', s: [2, 2], w: 1600, d: 'The most magnificent Autumn tree of them all!', tint: '#ffb03f' },
]));

// --- Dragon Essence ---------------------------------------------------------
reg(chain('essence', 'Dragon Essence', 'essence', '#7fe0ff', [
  { n: 'Pure Dragon Essence', lv: 1, w: 2, d: 'Forged by dragon breath.' },
  { n: 'Dragon Essence Candle', lv: 2, w: 6, d: 'Forged by dragon breath.', tint: '#ffd07f' },
  { n: 'Enriched Dragon Essence', lv: 3, w: 18, d: 'Forged by dragon breath.', tint: '#9fffd0' },
  { n: 'Dragon Essence Lamp', lv: 4, r: 'uncommon', w: 50, d: 'Forged by dragon breath.', tint: '#ffc04f' },
  { n: 'Dragon Essence Potion', lv: 5, r: 'uncommon', w: 140, d: 'Forged by dragon breath.', tint: '#c07fff' },
  { n: 'Silo Of Dragon Essence', lv: 6, r: 'rare', w: 400, d: 'Forged by dragon breath.', tint: '#7fa8ff' },
  { n: 'Enchanted Dragon Tome', lv: 7, r: 'rare', w: 1100, d: 'Forged by dragon breath.', tint: '#e07fa8' },
]));

// --- Bulbs ------------------------------------------------------------------
reg(chain('bulb', 'Bulbs', 'bulb', '#ffd9f0', [
  { n: 'Bulb Bunch', lv: 0, r: 'rare', w: 4, d: 'Luckier than a clover!' },
  { n: 'Baby Bulb', lv: 1, r: 'rare', w: 10, d: 'A slight shimmer. Complete the chain for wondrous rewards!' },
  { n: 'Budding Bulb', lv: 2, r: 'epic', w: 25, d: 'They grow up so fast! Merge to make them bloom.', tint: '#ffc0e8' },
  { n: 'Blooming Bulb', lv: 3, r: 'epic', w: 60, d: 'Healthy, happy blooms. Merge to find the light!', tint: '#ffa8e0' },
  { n: 'Big Bloom Bulb', lv: 4, r: 'epic', w: 150, d: 'Brightens up your day. Tap rewards!', tint: '#ff8fd8', loot: 3 },
  { n: 'Bella Bulb', lv: 5, r: 'legendary', w: 380, d: 'As beautiful as it sounds.', tint: '#ff77d0', loot: 4 },
  { n: 'Beaming Bulb', lv: 6, r: 'legendary', w: 900, d: 'Is that a shining light? Can sometimes Tap for Bulb Bunches.', tint: '#ffe0ff', h: { item: 'bulb:0', every: 16 } },
  { n: 'Brilliant Bulb', lv: 7, r: 'mythical', s: [2, 2], w: 4000, wonder: true, d: 'Wonder #22 of the Dragon World. Tap for premium eggs & nests.', tint: '#ffb0ff', loot: 7 },
]));

// --- Hills (Wonder #4) ------------------------------------------------------
reg(chain('hill', 'Hills', 'hill', '#8f9e6f', [
  { n: 'Topsoil', lv: 0, w: 1, d: 'Merge to raise a Hill.', tint: '#8f7250' },
  { n: 'Hill', lv: 1, w: 2, d: 'Harvest for Topsoil.', h: { item: 'hill:0', every: 14 } },
  { n: "Drake's Ridge", lv: 2, w: 4, d: 'Harvest for Topsoil and riches.', tint: '#7f9e5f', h: { item: 'coin:0', every: 14 } },
  { n: "Elwind's Knoll", lv: 3, r: 'uncommon', w: 8, d: 'Harvest for Topsoil and riches.', tint: '#6f9e6f', h: { item: 'coin:1', every: 15 } },
  { n: 'Garden Summit', lv: 4, r: 'uncommon', w: 15, d: 'Harvest for riches.', tint: '#5fae6f', h: { item: 'coin:1', every: 14 } },
  { n: "Moon's Precipice", lv: 5, r: 'rare', s: [2, 1], w: 30, d: 'Harvest for riches.', tint: '#8f9ec9', h: { item: 'coin:2', every: 16 } },
  { n: "Zomblin's Butte", lv: 6, r: 'rare', s: [1, 2], w: 60, d: 'Harvest for riches.', tint: '#7f7f8f', h: { item: 'coin:2', every: 16 } },
  { n: 'Cliff of Forgotten Souls', lv: 7, r: 'epic', s: [2, 1], w: 150, d: 'Harvest for riches.', tint: '#6f6f8f', h: { item: 'coin:3', every: 18 } },
  { n: 'Wanderlust Peak', lv: 8, r: 'epic', s: [2, 2], w: 400, d: 'Harvest for riches.', tint: '#9fa8c9', h: { item: 'coin:3', every: 18 } },
  { n: 'Mythical Aerie Microcosm', lv: 9, r: 'legendary', s: [2, 2], w: 900, d: 'Harvest for great riches.', tint: '#c9b0e0', h: { item: 'coin:4', every: 20 } },
  { n: 'Fountain of Youth', lv: 10, r: 'mythical', s: [2, 2], w: 6000, wonder: true, d: 'Wonder #4 of the Dragon World.', art: 'fountain', tint: '#8fd8ff' },
]));

// --- Gaia Statues: the level end goal ---------------------------------------
// "You usually need to Merge these to win." L2-4 spawn 9 Life Flowers on creation.
reg(chain('gaia', 'Gaia Statues', 'gaia', '#c9c0a8', [
  { n: 'Destroyed Gaia Statue', lv: 1, r: 'uncommon', w: 20, d: 'You usually need to Merge these to win.', tint: '#9a948a' },
  { n: 'Restored Gaia Statue', lv: 2, r: 'rare', w: 80, d: 'Restored! The land rejoices.', tint: '#d8cfae', gaiaBloom: 'lifeFlower:2' },
  { n: 'Grand Gaia Statue', lv: 3, r: 'epic', s: [2, 2], w: 300, d: 'Grand and glorious.', tint: '#f0e0b0', gaiaBloom: 'lifeFlower:4' },
  { n: 'Heavenly Gaia Statue', lv: 4, r: 'legendary', s: [2, 2], w: 1200, d: 'Heavenly. The land is whole.', tint: '#fff4d0', gaiaBloom: 'lifeFlower:6' },
]));
CHAINS.gaia.items.forEach((it, i) => { if (i > 0) it.gaiaBloom = ['', 'lifeFlower:2', 'lifeFlower:4', 'lifeFlower:6'][i]; });

// --- Demon Gates: destroy to clear, drops a Gaia Statue ---------------------
reg(chain('gate', 'Demon Gates', 'gate', '#6f3f5f', [
  { n: 'Demon Gate', lv: 1, r: 'uncommon', w: 0, d: 'The root of all evil and sadness. It must be destroyed.', hp: 6, unmergeable: true },
  { n: 'Lesser Demon Gate', lv: 2, r: 'rare', w: 0, d: 'The root of all evil and sadness. It must be destroyed.', hp: 50, unmergeable: true, tint: '#7f3f6f' },
  { n: 'Greater Demon Gate', lv: 3, r: 'epic', w: 0, d: 'The root of all evil and sadness. It must be destroyed.', hp: 250, unmergeable: true, tint: '#5f2f5f' },
  { n: 'Supreme Demon Gate', lv: 4, r: 'legendary', w: 0, d: 'The root of all evil and sadness. It must be destroyed.', hp: 2000, unmergeable: true, tint: '#4f2f4f' },
]));
CHAINS.gate.items.forEach((it, i) => { it.unmergeable = true; it.hp = [6, 50, 250, 2000][i]; });

// --- Zomblins: they destroy the land; healing power damages them ------------
reg(chain('zomblin', 'Zomblins', 'zomblin', '#7f9e5f', [
  { n: 'Rotten Zomblin', lv: 1, w: 0, d: 'Evil! Destroys the Land!', hp: 6, grave: 'grave:0', unmergeable: true },
  { n: 'Woodland Zomblin', lv: 2, w: 0, d: 'Evil! Destroys the Land!', hp: 12, grave: 'grave:0', unmergeable: true, tint: '#6f8f4f' },
  { n: 'Swamp Zomblin', lv: 3, r: 'uncommon', w: 0, d: 'Evil! Destroys the Land!', hp: 30, grave: 'grave:1', unmergeable: true, tint: '#5f7f5f' },
  { n: 'Dragon-Eater Zomblin', lv: 4, r: 'rare', w: 0, d: 'Evil! Destroys the Land!', hp: 100, grave: 'grave:1', unmergeable: true, tint: '#4f6f4f' },
]));
CHAINS.zomblin.items.forEach((it, i) => {
  it.unmergeable = true; it.hp = [6, 12, 30, 100][i];
  it.grave = ['grave:0', 'grave:0', 'grave:1', 'grave:1'][i];
});

// --- Heal Extenders (levels only) ------------------------------------------
reg(chain('healext', 'Heal Extenders', 'healext', '#7fffc0', [
  { n: 'Heal Extender', lv: 1, r: 'rare', w: 0, d: 'Tap once healed to heal the land around it.', unmergeable: true },
]));
CHAINS.healext.items[0].unmergeable = true;

// --- Loot Orbs (bubbles that hold rewards) ---------------------------------
reg(chain('loot', 'Loot Orbs', 'loot', '#bfe8ff', [
  { n: 'Loot Orb', lv: 1, r: 'uncommon', w: 0, d: 'Tap to smash it open.', unmergeable: true },
]));
CHAINS.loot.items[0].unmergeable = true;

// --- Dead things: bones, skulls ---------------------------------------------
reg(chain('bone', 'Bones', 'bone', '#e8dfc8', [
  { n: 'Bones', lv: 1, w: 1, d: 'Merge for Life Flower Sprouts.', boneBonus: true },
  { n: 'Unearthed Skeleton', lv: 2, w: 2, d: 'Tap to scatter Bones.', taps: 3, unmergeable: true },
]));
CHAINS.bone.items[1].unmergeable = true;
CHAINS.bone.items[0].boneBonus = true;

reg(chain('skull', 'Skulls', 'skull', '#efe6d2', [
  { n: 'Skull', lv: 1, w: 1, d: 'Merge for Fruit Tree Seeds.' },
  { n: 'Skull & Bones 1', lv: 2, w: 2, d: 'Merge for Fruit Tree Seeds.' },
  { n: 'Skull & Bones 2', lv: 3, r: 'uncommon', w: 4, d: 'Merge for Fruit Tree Seeds.' },
  { n: 'Skull & Bones 3', lv: 4, r: 'uncommon', s: [2, 1], w: 8, d: 'Merge for Treasure Chests.' },
]));

// --- Brambles (unmergeable obstacles cleared by tapping) --------------------
reg(chain('bramble', 'Brambles', 'bramble', '#6a5f4f', [
  { n: 'Zomblin Brush', lv: 1, w: 0, d: 'Tap to clear. Harvest for Life Flower Sprouts.', taps: 2, unmergeable: true },
  { n: 'Brambles', lv: 2, w: 0, d: 'Tap repeatedly to clear.', taps: 4, unmergeable: true, tint: '#5f4f3f' },
  { n: 'Large Brambles', lv: 3, w: 0, s: [2, 1], d: 'Tap many times to clear.', taps: 8, unmergeable: true, tint: '#4f4234' },
]));
CHAINS.bramble.items.forEach((it) => { it.unmergeable = true; });

// ===========================================================================
// Second wave of chains. Every name, tier order, size, rarity, coin worth and
// description below is transcribed from that chain's own wiki data table
// (api.php?action=parse&page=<Chain>&prop=wikitext). Behaviour fields
// (harvest, spawns, tap payouts) are set from what each row's own description
// says it does.
// ===========================================================================

// --- Magic Mushrooms (from Bushes; the Golden Mushroom is Wonder #9) --------
reg(chain('magicShroom', 'Magic Mushrooms', 'shroom', '#7fd06a', [
  { n: 'Magic Mushroom Caps', lv: 0, r: 'uncommon', w: 1, d: 'Merge to grow Magic Mushrooms.', tint: '#c9b08f' },
  { n: 'Magic Shroom Cluster', lv: 1, r: 'uncommon', w: 1, d: 'An odd growth.', tint: '#9fc98f' },
  { n: 'Magic Shroom Stalk', lv: 2, r: 'uncommon', w: 2, d: 'No ordinary mushroom.', tint: '#8fc97f' },
  { n: 'Magic Shrooms', lv: 3, r: 'uncommon', w: 4, d: 'An unknown species of shroom.', tint: '#7fd06a' },
  { n: 'Green Dream Shrooms', lv: 4, r: 'uncommon', w: 8, d: 'Strangely attractive. Harvesting might give a Fungus Log! OMG!', tint: '#6fd08f', h: { item: 'fungusLog:0', every: 15 } },
  { n: 'Blue Belly Shrooms', lv: 5, r: 'rare', w: 15, d: 'Said to resemble the belly of a Blue Dragon.', tint: '#6fa8e0', h: { item: 'fungusLog:0', every: 15 } },
  { n: 'Glowflap Shrooms', lv: 6, r: 'rare', w: 30, d: "These glow when they're happy. (All the time!)", tint: '#8fe0ff', h: { item: 'chest:0', every: 18 } },
  { n: 'Dragonfan Shrooms', lv: 7, r: 'epic', w: 50, d: 'Used as seats by kings and queens.', tint: '#c98fe0', h: { item: 'chest:1', every: 18 } },
  { n: 'Alien Shrooms', lv: 8, r: 'epic', s: [2, 2], w: 150, d: 'From a galaxy far, far away.', tint: '#7fffc9', h: { item: 'chest:2', every: 20 } },
  { n: 'Fantasy Shrooms', lv: 9, r: 'legendary', w: 300, d: 'A city of sentient mushrooms.', tint: '#ff9fd0', h: { item: 'chest:3', every: 20 } },
  { n: 'The Golden Mushroom', lv: 10, r: 'legendary', w: 500, wonder: true, d: 'Incredible! A shroom of pure gold. Wonder #9 of the Dragon World.', art: 'goldshroom', tint: '#ffd24f' },
]));

// --- Fungus Logs (harvested out of mushrooms) -------------------------------
reg(chain('fungusLog', 'Fungus Logs', 'log', '#a8845f', [
  { n: 'Fungus Log', lv: 1, r: 'uncommon', w: 4, d: 'Comes from mushrooms. Its use... ???' },
  { n: 'Sporewood', lv: 2, r: 'uncommon', w: 12, d: 'Merge to grow Undead Trees.', tint: '#8f9e6f' },
]));

// --- Wood (Elderwood, from Dragon Trees) ------------------------------------
reg(chain('wood', 'Wood', 'log', '#b08553', [
  { n: 'Elderwood', lv: 1, w: 2, d: 'A simple log. Nothing more.' },
  { n: 'Stack of Elderwood', lv: 2, w: 4, d: 'Smells wonderful! Tastes... like a chicken carved from wood.', tint: '#a87f4f' },
  { n: 'Bundle of Elderwood', lv: 3, w: 8, d: 'Bush gnomes love Elderwood. Merge to build a cabin for them.', tint: '#9e7548' },
  { n: 'Tiny Cabin for Hedge Gnomes', lv: 4, r: 'uncommon', s: [2, 2], w: 15, d: 'Grows bushes nearby, then disappears. Tap for more.', art: 'cabin', tint: '#c08f5f', spawns: { item: 'bush:0', every: 20 }, h: { item: 'bush:1', every: 16 } },
]));

// --- Midas Trees (Wonder #15) ----------------------------------------------
reg(chain('midasTree', 'Midas Trees', 'midas', '#e8c24f', [
  { n: 'Golden Seeds', lv: 0, r: 'rare', w: 15, d: 'These seeds are said to be living gold...', art: 'seed', tint: '#e0b83f' },
  { n: 'Sprouting Midas Tree', lv: 1, r: 'rare', w: 30, d: 'Budding with leaves of gold!' },
  { n: 'Golden Sapling', lv: 2, r: 'epic', w: 50, d: 'What secrets does this magical tree hold?' },
  { n: 'Golden Tree', lv: 3, r: 'epic', w: 150, d: 'A captivating plant of living gold!' },
  { n: 'Midas Tree', lv: 4, r: 'epic', w: 200, d: 'Roots of a Midas Tree extend down to the core of the world.', h: { item: 'coin:2', every: 16 } },
  { n: 'Glowing Midas Tree', lv: 5, r: 'epic', w: 300, d: 'The roots absorb gold and crystal from the core of the planet.', h: { item: 'coin:2', every: 16 } },
  { n: 'The Orb Holder', lv: 6, r: 'epic', w: 400, d: 'The tree draws crystal up through its roots and reconstitutes it.', h: { item: 'coin:3', every: 18 } },
  { n: 'The Crystal Catcher', lv: 7, r: 'epic', w: 500, d: 'Midas Trees are the grandparents of Midas Drakes.', h: { item: 'coin:3', every: 18 } },
  { n: 'The Moon Bearer', lv: 8, r: 'legendary', w: 600, d: 'This crystal absorbs the light of the 3 moons and radiates happiness.', h: { item: 'coin:4', every: 20 } },
  { n: 'The Star Mother', lv: 9, r: 'legendary', w: 700, d: 'The crystal gives these trees the gift of immortality.', h: { item: 'coin:4', every: 20 } },
  { n: 'Greater Midas Tree', lv: 10, r: 'legendary', w: 800, d: 'Myth tells of a continent that is entirely a great forest of Midas Trees.', h: { item: 'coin:5', every: 22 } },
  { n: 'Divine Midas Tree', lv: 11, r: 'mythical', s: [1, 2], w: 1000, d: 'These crystals resonate with an energy that bring life to the world.', h: { item: 'coin:5', every: 22 }, heal: 256 },
  { n: 'Bearer of the World Crystal', lv: 12, r: 'epic', s: [2, 2], w: 1500, wonder: true, d: 'Wonder #15. This tree can commune with the World Crystal it protects.', art: 'worldcrystal', tint: '#ffe07f' },
]));

// --- Glowing Dragon Trees (by-product of Dragon Tree merges; source of Amber)
// The wiki lists Remains of The Dragon God as this chain's Wonder too; it is
// already the Dragon Tree chain's terminus here, so this chain stops below it.
reg(chain('glowTree', 'Glowing Dragon Trees', 'glowtree', '#8fe0c9', [
  { n: 'Young Glowing Dragon Tree', lv: 1, r: 'rare', w: 4, d: 'No way! A tree from another dimension!' },
  { n: 'Vermillion Glowing Dragon Tree', lv: 2, r: 'rare', w: 8, d: 'Glowing Dragon Trees are the only source of Amber!', tint: '#e08f6f' },
  { n: 'Nice Glowing Dragon Tree', lv: 3, r: 'rare', w: 15, d: 'Glowing Dragon Trees are the only source of Amber!', tint: '#7fe0a8', h: { item: 'essence:0', every: 16 } },
  { n: 'Aged Glowing Dragon Tree', lv: 4, r: 'epic', w: 30, d: 'Glowing Dragon Trees are the only source of Amber!', tint: '#8fd0ff', h: { item: 'essence:0', every: 16 } },
  { n: 'Elder Glowing Dragon Tree', lv: 5, r: 'epic', w: 50, d: 'Glowing Dragon Trees are the only source of Amber!', tint: '#c9a8ff', h: { item: 'essence:1', every: 18 }, heal: 16 },
  { n: 'Ancient Glowing Dragon Tree', lv: 6, r: 'legendary', w: 150, d: 'Glowing Dragon Trees are the only source of Amber!', tint: '#ffd08f', h: { item: 'essence:1', every: 18 }, heal: 48 },
  { n: 'Arcane Glowing Dragon Tree', lv: 7, r: 'legendary', s: [2, 1], w: 300, d: 'Glowing Dragon Trees are the only source of Amber!', tint: '#a88fff', h: { item: 'essence:2', every: 20 }, heal: 128 },
  { n: 'Legendary Glowing Dragon Tree', lv: 8, r: 'mythical', s: [2, 1], w: 1000, d: 'This tree ties worlds together. An incredible source of Amber!', tint: '#ffe0a8', h: { item: 'essence:3', every: 22 }, heal: 320 },
]));

// --- Grimm Trees ------------------------------------------------------------
reg(chain('grimmTree', 'Grimm Trees', 'grimm', '#6f6a80', [
  { n: 'Grimm Seed', lv: 0, r: 'uncommon', w: 2, d: 'The darkness radiates from within.', art: 'seed', tint: '#5f5a70' },
  { n: 'Grimm Sapling', lv: 1, r: 'uncommon', w: 4, d: 'A ghostly plant.' },
  { n: 'Young Grimm Tree', lv: 2, r: 'uncommon', w: 8, d: 'A ghastly plant.' },
  { n: 'Small Grimm Tree', lv: 3, r: 'uncommon', w: 15, d: 'An eerie tree.' },
  { n: 'Grimm Tree', lv: 4, r: 'rare', w: 30, d: 'A spooky tree.', h: { item: 'grave:0', every: 18 } },
  { n: 'Dark Grimm Tree', lv: 5, r: 'rare', w: 50, d: 'A spectre of a sight.', tint: '#5f5a78', h: { item: 'grave:0', every: 18 } },
  { n: 'Foreboding Grimm Tree', lv: 6, r: 'rare', w: 150, d: 'A grim growth.', tint: '#574f6f', h: { item: 'grave:1', every: 20 } },
  { n: 'Grimm Tree of Dread', lv: 7, r: 'epic', w: 300, d: 'A scary tree.', tint: '#4f4762' },
  { n: 'Chilling Grimm Tree', lv: 8, r: 'epic', w: 500, d: 'A supernatural tree.', tint: '#7f8fa8' },
  { n: 'Grimm Tree of Fear', lv: 9, r: 'legendary', s: [2, 1], w: 1000, d: 'Its branches sever the sky.', tint: '#4f4a6f' },
  { n: 'Grimm Tree of Despair', lv: 10, r: 'mythical', s: [2, 1], w: 2500, d: 'Its roots impale the heart of the Earth.', tint: '#3f3a58' },
]));

// --- Shadow Trees -----------------------------------------------------------
reg(chain('shadowTree', 'Shadow Trees', 'grimm', '#5f5a7f', [
  { n: 'Specter Leaf', lv: 0, r: 'uncommon', w: 1, d: 'This leaf is spooky. Merge to grow an Umbral Sprout.', art: 'leaf', tint: '#8f8fb0' },
  { n: 'Umbral Sprout', lv: 1, r: 'uncommon', w: 1, d: "It doesn't like being in the sun.", art: 'sprout', tint: '#6f6f9a' },
  { n: 'Dark Sapling', lv: 2, r: 'uncommon', w: 2, d: 'It has a tiny dark dream..' },
  { n: 'Crude Shadow Tree', lv: 3, r: 'uncommon', w: 4, d: 'Ouch! Its leaves are a bit sharp.' },
  { n: 'Somber Shadow Tree', lv: 4, r: 'uncommon', w: 8, d: "Don't fall asleep underneath it. It will give you nightmares." },
  { n: 'Sanguine Shadow Tree', lv: 5, r: 'rare', w: 15, d: 'Why is there a bit of crimson on top of it?', tint: '#8f4f6f' },
  { n: 'Ghastly Shadow Tree', lv: 6, r: 'rare', w: 30, d: 'Bewitching! Spirits might be living in it.', tint: '#6f8f9a' },
  { n: 'Argent Shadow Tree', lv: 7, r: 'rare', w: 50, d: 'A delicate tree. Its leaves never move in the wind..', tint: '#b0b8c9' },
  { n: 'Livid Shadow Tree', lv: 8, r: 'epic', w: 150, d: 'This solemn tree shines at night.', tint: '#8f7fd0' },
  { n: 'Eerie Shadow Tree', lv: 9, r: 'epic', s: [2, 2], w: 300, d: 'So beautiful yet unnerving.', tint: '#6f5fa8' },
  { n: 'Lustrous Shadow Tree', lv: 10, r: 'legendary', s: [2, 2], w: 500, d: 'They say lost souls come to rest in it..', tint: '#c9b0ff' },
]));

// --- Spooky Trees (grow Necromancer Grass) ---------------------------------
reg(chain('spookyTree', 'Spooky Trees', 'grimm', '#7f6a5f', [
  { n: 'Undead Tree', lv: 2, w: 2, d: 'Grows Necromancer Grass nearby. Harvest for Decayed Logs.', spawns: { item: 'prism:0', every: 28 }, h: { item: 'fungusLog:0', every: 17 } },
  { n: 'Deathly Hollow Tree', lv: 3, w: 4, d: 'Grows Necromancer Grass nearby. Harvest for Decayed Logs.', tint: '#6f5a4f', spawns: { item: 'prism:0', every: 24 }, h: { item: 'fungusLog:0', every: 17 } },
  { n: 'Spooky Old Tree', lv: 4, r: 'uncommon', w: 8, d: 'Grows Necromancer Grass nearby. Harvest for Decayed Logs.', tint: '#5f4f48', spawns: { item: 'prism:1', every: 24 }, h: { item: 'fungusLog:1', every: 19 } },
]));

// --- Haunted Houses ---------------------------------------------------------
reg(chain('haunted', 'Haunted Houses', 'house', '#7f6f8f', [
  { n: 'Fresh Graveyard', lv: 0, r: 'uncommon', w: 2, d: 'Turns into a Small Haunted Crypt!', art: 'grave', tint: '#8f8f9a' },
  { n: 'Small Haunted Crypt', lv: 1, r: 'uncommon', w: 4, d: 'Merge for a Haunted Crypt.' },
  { n: 'Haunted Crypt', lv: 2, r: 'uncommon', w: 8, d: 'Harvest for a Candy Eyeball for the special event!', h: { item: 'mushroom:0', every: 16 } },
  { n: 'Haunted Shack', lv: 3, r: 'uncommon', w: 15, d: 'Harvest for a Candy Eyeball for the special event!', h: { item: 'mushroom:0', every: 16 } },
  { n: 'Haunted House', lv: 4, r: 'uncommon', w: 30, d: 'Harvest for a Candy Eyeball for the special event!', h: { item: 'mushroom:1', every: 18 } },
  { n: 'Large Haunted House', lv: 5, r: 'rare', w: 60, d: 'Harvest for a Chocolate Truffle for the special event!', tint: '#6f5f80', h: { item: 'mushroom:1', every: 18 } },
  { n: 'Haunted Manor', lv: 6, r: 'rare', w: 150, d: 'Harvest for a Chocolate Truffle for the special event!', tint: '#6f5f80', h: { item: 'chest:0', every: 20 } },
  { n: 'Haunted Mansion', lv: 7, r: 'rare', w: 300, d: 'Harvest for a Chocolate Truffle for the special event!', tint: '#5f5075', h: { item: 'chest:1', every: 20 } },
  { n: 'Haunted Estate', lv: 8, r: 'epic', w: 600, d: 'Harvest for a Living Truffle for the special event!', tint: '#584a70', h: { item: 'chest:2', every: 22 } },
  { n: 'Grand Haunted Estate', lv: 9, r: 'epic', s: [2, 2], w: 1200, d: 'Harvest for a Living Truffle for the special event!', tint: '#4f4268', h: { item: 'chest:3', every: 22 } },
  { n: 'Paranormal Purgatory', lv: 10, r: 'legendary', s: [2, 2], w: 2500, d: 'Harvest for a Goblin Truffle for the special event!', tint: '#3f3760', h: { item: 'chest:4', every: 24 } },
]));

// --- Zen Temples (Wonder #14 Shambala) --------------------------------------
reg(chain('zenTemple', 'Zen Temples', 'temple', '#c9a86f', [
  { n: 'Small Zen Temple', lv: 1, r: 'uncommon', w: 5, d: 'A quiet place to sit.' },
  { n: 'Zen Temple', lv: 2, r: 'rare', w: 10, d: 'A quiet place to think.' },
  { n: 'Nice Zen Temple', lv: 3, r: 'rare', w: 50, d: 'A quiet place to breathe.', h: { item: 'coin:1', every: 16 } },
  { n: 'Large Zen Temple', lv: 4, r: 'rare', w: 100, d: 'A quiet place to be still.', h: { item: 'coin:1', every: 16 } },
  { n: 'Temple of Peace', lv: 5, r: 'rare', w: 200, d: 'Peace lives here.', h: { item: 'coin:2', every: 18 }, heal: 8 },
  { n: 'Temple of Tranquillity', lv: 6, r: 'epic', w: 400, d: 'Tranquillity lives here.', h: { item: 'coin:2', every: 18 }, heal: 16 },
  { n: 'Temple of Balance', lv: 7, r: 'epic', w: 800, d: 'Balance lives here.', h: { item: 'coin:3', every: 20 }, heal: 32 },
  { n: 'Temple of Honor', lv: 8, r: 'epic', w: 1000, d: 'Honor lives here.', h: { item: 'coin:3', every: 20 }, heal: 64 },
  { n: 'Temple of Spirit', lv: 9, r: 'epic', s: [2, 1], w: 1500, d: 'Spirit lives here.', h: { item: 'coin:4', every: 22 }, heal: 128 },
  { n: 'Temple of Unity', lv: 10, r: 'legendary', s: [2, 1], w: 2000, d: 'Unity lives here.', h: { item: 'coin:4', every: 22 }, heal: 256 },
  { n: 'Grand Temple of Enlightenment', lv: 11, r: 'legendary', s: [2, 2], w: 3750, d: 'Enlightenment lives here.', h: { item: 'coin:5', every: 24 }, heal: 512 },
  { n: 'Shangri-La', lv: 12, r: 'legendary', s: [2, 2], w: 5000, d: 'The hidden valley of legend.', h: { item: 'coin:5', every: 24 }, heal: 1024 },
  { n: 'Shambala', lv: 13, r: 'mythical', s: [2, 2], w: 7500, wonder: true, d: 'Wonder #14 of the Dragon World. The kingdom beyond the mountains.', art: 'shambala', tint: '#ffe0a8' },
]));

// --- Nirvana Temples (Wonder #13 Elysium) -----------------------------------
reg(chain('nirvanaTemple', 'Nirvana Temples', 'temple', '#9fc9d8', [
  { n: 'Small Nirvana Temple', lv: 1, r: 'uncommon', w: 5, d: 'A cool white stone.' },
  { n: 'Nirvana Temple', lv: 2, r: 'rare', w: 10, d: 'Cool white stone, and a bell.' },
  { n: 'Nice Nirvana Temple', lv: 3, r: 'rare', w: 50, d: 'The bell can be heard for miles.', h: { item: 'lifeOrb:0', every: 16 } },
  { n: 'Large Nirvana Temple', lv: 4, r: 'rare', w: 100, d: 'Pilgrims come from far away.', h: { item: 'lifeOrb:0', every: 16 } },
  { n: 'Temple of Harmony', lv: 5, r: 'rare', w: 200, d: 'Harmony lives here.', h: { item: 'lifeOrb:1', every: 18 }, heal: 8 },
  { n: 'Temple of Serenity', lv: 6, r: 'epic', w: 400, d: 'Serenity lives here.', h: { item: 'lifeOrb:1', every: 18 }, heal: 16 },
  { n: 'Temple of Contentment', lv: 7, r: 'epic', w: 800, d: 'Contentment lives here.', h: { item: 'lifeOrb:2', every: 20 }, heal: 32 },
  { n: 'Temple of Glory', lv: 8, r: 'epic', w: 1000, d: 'Glory lives here.', h: { item: 'lifeOrb:2', every: 20 }, heal: 64 },
  { n: 'Temple of Life', lv: 9, r: 'epic', s: [2, 1], w: 1500, d: 'Life lives here.', h: { item: 'lifeOrb:3', every: 22 }, heal: 128 },
  { n: 'Temple of Wisdom', lv: 10, r: 'legendary', s: [2, 1], w: 2000, d: 'Wisdom lives here.', h: { item: 'lifeOrb:3', every: 22 }, heal: 256 },
  { n: 'Grand Temple of Life', lv: 11, r: 'legendary', s: [2, 2], w: 3500, d: 'The land around it is always green.', h: { item: 'lifeOrb:4', every: 24 }, heal: 512 },
  { n: 'Utopia', lv: 12, r: 'legendary', s: [2, 2], w: 5000, d: 'Nowhere, and everywhere.', h: { item: 'lifeOrb:4', every: 24 }, heal: 1024 },
  { n: 'Elysium', lv: 13, r: 'mythical', s: [2, 2], w: 7500, wonder: true, d: 'Wonder #13 of the Dragon World. Where the blessed rest.', art: 'elysium', tint: '#d0f0ff' },
]));

// --- Honey (Wonder #16 Sanctuary of Bees) -----------------------------------
reg(chain('honey', 'Honey', 'honey', '#f0b83f', [
  { n: 'Tiny Honeycomb', lv: 1, w: 1, d: 'The beginning of something special.' },
  { n: 'Small Honeycomb', lv: 2, w: 2, d: 'The sweet aroma is irresistible.' },
  { n: 'Large Honeycomb', lv: 3, w: 4, d: 'A rare delicacy!' },
  { n: 'Classic Honey Jar', lv: 4, r: 'uncommon', w: 8, d: 'A favourite snack of a loveable bear. Harvest for Honey.', h: { item: 'honey:0', every: 14 } },
  { n: 'Fancy Honey Jar', lv: 5, r: 'uncommon', w: 15, d: 'A delicious treat! Harvest for Honey.', h: { item: 'honey:0', every: 14 } },
  { n: 'Crystalized Honey Jar', lv: 6, r: 'uncommon', w: 30, d: 'A scrumptious snack! Harvest for Honey.', tint: '#ffd06f', h: { item: 'honey:1', every: 16 } },
  { n: 'Simple Beehive', lv: 7, r: 'rare', w: 50, d: 'A great source of Honey and other Loot!', tint: '#d9a04f', h: { item: 'honey:1', every: 16 } },
  { n: 'Magnificent Beehive', lv: 8, r: 'rare', w: 150, d: 'An incredible source of Honey and other riches!', tint: '#e0a83f', h: { item: 'honey:2', every: 18 } },
  { n: 'Extravagant Beehive', lv: 9, r: 'epic', w: 300, d: 'An amazing source of Honey and other treasures!', tint: '#ffc04f', h: { item: 'chest:1', every: 20 } },
  { n: 'Sanctuary of Bees', lv: 10, r: 'legendary', s: [2, 2], w: 500, wonder: true, d: 'The legendary home of bees. Wonder #16 of the Dragon World.', art: 'sanctuary', tint: '#ffd45f' },
]));

// --- Chocolate Fountains (Wonder #20) ---------------------------------------
reg(chain('chocolate', 'Chocolate Fountains', 'choco', '#7a4a2f', [
  { n: 'Cocoa Bean', lv: 1, r: 'rare', w: 15, d: 'A bean destined to be delicious.', art: 'seed', tint: '#6f4028' },
  { n: 'Cocoa Bean Trio', lv: 2, r: 'rare', w: 30, d: 'A tasty trio of beans!', art: 'seed', tint: '#7a4a2f' },
  { n: 'Cocoa Sprout', lv: 3, r: 'epic', w: 50, d: 'A flavorful flower ready to bloom. Tap for a sweet surprise!', tint: '#8f6a3f', h: { item: 'coin:1', every: 15 } },
  { n: 'Sweet Cocoa Bloom', lv: 4, r: 'epic', w: 150, d: 'Emits the sweetest of scents. Tap for a tasty treat!', tint: '#a87f4f', h: { item: 'coin:1', every: 15 } },
  { n: 'Flavorful Choco Flower', lv: 5, r: 'epic', w: 200, d: 'A flower as tasty as it looks. Tap for dipped berries!', tint: '#8f5f3f', h: { item: 'coin:2', every: 17 } },
  { n: 'Soothing Choco Sculpture', lv: 6, r: 'epic', w: 300, d: 'Sweet and soothing to the soul. Tap for dipped berries!', tint: '#7f4f30', h: { item: 'coin:2', every: 17 } },
  { n: 'Scrumptious Choco Statue', lv: 7, r: 'epic', w: 500, d: 'Surrounded by sugar and a great source for dipped berries!', tint: '#6f4028', h: { item: 'coin:3', every: 19 } },
  { n: 'Fancy Chocolate Fountain', lv: 8, r: 'legendary', w: 750, d: 'Overflowing with chocolate and perfect for dipped berries!', tint: '#8f5a38', h: { item: 'coin:3', every: 19 } },
  { n: 'Delightful Chocolate Cascade', lv: 9, r: 'legendary', s: [2, 1], w: 1000, d: 'An amazing flow of chocolate, ripe with dipped berries!', tint: '#a06a40', h: { item: 'coin:4', every: 21 } },
  { n: 'The Chocolate Spring', lv: 10, r: 'mythical', s: [2, 2], w: 1500, wonder: true, d: 'A towering monument to all things sweet. Wonder #20 of Dragonia.', art: 'chocospring', tint: '#b07a48' },
]));

// --- Golden Apples ----------------------------------------------------------
reg(chain('goldenApple', 'Golden Apples', 'fruit', '#f0c94f', [
  { n: 'Golden Apple', lv: 1, r: 'epic', w: 50, d: "Fruit from King Midas's Garden." },
  { n: 'Giant Golden Apple', lv: 2, r: 'epic', w: 200, d: 'Touched by a Midas Duck.' },
  { n: 'Golden Apple of the Cosmos', lv: 3, r: 'legendary', s: [2, 2], w: 800, d: 'This fruit has a strange, goldeny-magic about it.', tint: '#ffe07f', loot: 5 },
]));

// --- Wildberries ------------------------------------------------------------
reg(chain('wildberry', 'Wildberries', 'fruit', '#5f8fe0', [
  { n: 'Tiny Blue Wildberry', lv: 1, w: 1, d: 'A strange, exotic berry - beloved by wild and tamed dragons alike!' },
  { n: 'Blue Wildberry', lv: 2, w: 2, d: 'A strange, exotic berry - beloved by wild and tamed dragons alike!' },
  { n: 'Juicy Blue Wildberry', lv: 3, w: 4, d: 'A strange, exotic berry - beloved by wild and tamed dragons alike!', tint: '#4f7fd8', tapCoins: 8, consumeOnTap: true },
]));

// --- Crystal Fruit ----------------------------------------------------------
reg(chain('crystalFruit', 'Crystal Fruit', 'fruit', '#5fd0a8', [
  { n: 'Emerald Fruit', lv: 1, w: 1, d: 'Tap to collect, or Merge.', tapCoins: 1, consumeOnTap: true, tint: '#4fd08f' },
  { n: 'Moonstone Fruit', lv: 2, w: 4, d: 'Tap to collect, or Merge.', tapCoins: 4, consumeOnTap: true, tint: '#d8e0f0' },
  { n: 'Amethyst Fruit', lv: 3, w: 15, d: 'Tap to collect, or Merge.', tapCoins: 15, consumeOnTap: true, tint: '#a87fe0' },
  { n: 'Ruby Fruit', lv: 4, r: 'uncommon', w: 50, d: 'Tap to collect, or Merge.', tapCoins: 50, consumeOnTap: true, tint: '#e04f5f' },
  { n: 'Tourmaline Fruit', lv: 5, r: 'uncommon', w: 175, d: 'Tap to collect, or Merge.', tapCoins: 175, consumeOnTap: true, tint: '#5fd0c9' },
  { n: 'Topaz Fruit', lv: 6, r: 'rare', w: 550, d: 'Tap to collect, or Merge.', tapCoins: 550, consumeOnTap: true, tint: '#f0c04f' },
  { n: 'Garnet Fruit', lv: 7, r: 'rare', w: 1750, d: 'Tap to collect, or Merge.', tapCoins: 1750, consumeOnTap: true, tint: '#c93f4f' },
  { n: 'Rose Quartz Fruit', lv: 8, r: 'epic', w: 5500, d: 'Tap to collect, or Merge.', tapCoins: 5500, consumeOnTap: true, tint: '#ffb0c9' },
  { n: 'Gemstone Fruit', lv: 9, r: 'legendary', w: 20000, d: 'Incredible! Tap to collect, or Merge.', tapCoins: 20000, consumeOnTap: true, tint: '#e0d0ff' },
  { n: 'Crystal Fruit', lv: 10, r: 'legendary', w: 75000, d: 'Out of this world! Tap to collect.', tapCoins: 75000, consumeOnTap: true, tint: '#ffffff' },
]));

// --- Seashells --------------------------------------------------------------
reg(chain('seashell', 'Seashells', 'shell', '#f0d0b0', [
  { n: 'Tiny Seashell', lv: 1, w: 1, d: 'Tap to collect, or Merge.', tapCoins: 1, consumeOnTap: true },
  { n: 'Medium Seashell', lv: 2, w: 4, d: 'Tap to collect, or Merge.', tapCoins: 4, consumeOnTap: true },
  { n: 'Large Seashell', lv: 3, w: 15, d: 'Tap to collect, or Merge.', tapCoins: 15, consumeOnTap: true, tint: '#ffd9b0' },
  { n: 'Huge Seashell', lv: 4, r: 'uncommon', w: 50, d: 'Tap to collect, or Merge.', tapCoins: 50, consumeOnTap: true, tint: '#ffc9a8' },
  { n: 'Uncommon Seashell', lv: 5, r: 'uncommon', w: 175, d: 'Tap to collect, or Merge.', tapCoins: 175, consumeOnTap: true, tint: '#e0b8d0' },
  { n: 'Rare Spiky Seashell', lv: 6, r: 'rare', w: 550, d: 'Tap to collect, or Merge.', tapCoins: 550, consumeOnTap: true, tint: '#c9a8e0' },
  { n: 'Rare Golden Seashell', lv: 7, r: 'rare', w: 1750, d: 'Tap to collect, or Merge.', tapCoins: 1750, consumeOnTap: true, tint: '#f0c44f' },
  { n: 'Sea Maggot Shell', lv: 8, r: 'epic', w: 5500, d: 'Tap to collect, or Merge.', tapCoins: 5500, consumeOnTap: true, tint: '#9fd0c0' },
  { n: 'Legendary Seashell', lv: 9, r: 'legendary', w: 20000, d: 'Incredible! Tap to collect, or Merge.', tapCoins: 20000, consumeOnTap: true, tint: '#ffe9d0' },
  { n: 'Giant Red Crab Shell', lv: 10, r: 'legendary', s: [2, 2], w: 75000, d: 'Out of this world! Tap to collect.', tapCoins: 75000, consumeOnTap: true, tint: '#e0603f' },
]));

// --- Starfishes -------------------------------------------------------------
reg(chain('starfish', 'Starfishes', 'starfish', '#ff8fb0', [
  { n: 'Tiny Pink Starfish', lv: 0, r: 'uncommon', w: 1, d: 'Merge or wait to grow a Starfish!' },
  { n: 'Uncommon Red Starfish', lv: 1, r: 'uncommon', w: 2, d: 'Merge for Large Purple Starfish!', tint: '#e0504f' },
  { n: 'Large Purple Starfish', lv: 2, r: 'uncommon', w: 4, d: 'Harvest for a Tiny Seashell.', tint: '#9f5fd0', h: { item: 'seashell:0', every: 13 } },
  { n: 'Island Starfish', lv: 3, r: 'uncommon', w: 8, d: 'Harvest for a Tiny Seashell.', tint: '#e0a04f', h: { item: 'seashell:0', every: 13 } },
  { n: 'Sea Starfish', lv: 4, r: 'uncommon', w: 15, d: 'Harvest for a Tiny Seashell.', tint: '#4fa8d0', h: { item: 'seashell:0', every: 13 } },
  { n: 'Ocean Starfish', lv: 5, r: 'rare', w: 30, d: 'Harvest for a Medium Seashell.', tint: '#3f7fc9', h: { item: 'seashell:1', every: 15 } },
  { n: 'Rare Sun Starfish', lv: 6, r: 'rare', w: 60, d: 'Harvest for a Medium Seashell.', tint: '#ffc03f', h: { item: 'seashell:1', every: 15 } },
  { n: 'Rare Moon Starfish', lv: 7, r: 'rare', w: 150, d: 'Harvest for a Medium Seashell.', tint: '#d0d8f0', h: { item: 'seashell:1', every: 15 } },
  { n: 'Epic Dark Starfish', lv: 8, r: 'epic', s: [2, 2], w: 300, d: 'Harvest for a Large Shell.', tint: '#5f4f8f', h: { item: 'seashell:2', every: 17 } },
  { n: 'Epic Planet Starfish', lv: 9, r: 'epic', s: [2, 2], w: 700, d: 'Harvest for a Large Shell.', tint: '#7fd0ff', h: { item: 'seashell:2', every: 17 } },
]));

// --- Fairy Houses -----------------------------------------------------------
reg(chain('fairyHouse', 'Fairy Houses', 'fairyhouse', '#e07f9f', [
  { n: 'Tiny Fairy House', lv: 0, r: 'uncommon', w: 2, d: 'Merge or wait to grow a House!' },
  { n: 'Fairy Neighbour', lv: 1, r: 'uncommon', w: 4, d: 'Merge for Fairy Houses!' },
  { n: 'Fairy House', lv: 2, r: 'uncommon', w: 8, d: 'Harvest for a Tiny Red Spotted Mushroom.', h: { item: 'fairyShroom:0', every: 14 } },
  { n: 'Fairy House Deluxe', lv: 3, r: 'uncommon', w: 15, d: 'Harvest for a Tiny Red Spotted Mushroom.', h: { item: 'fairyShroom:0', every: 14 } },
  { n: 'Fairy Villa', lv: 4, r: 'uncommon', w: 30, d: 'Harvest for a Tiny Red Spotted Mushroom.', tint: '#d06f9f', h: { item: 'fairyShroom:0', every: 14 } },
  { n: 'Fairy Tower', lv: 5, r: 'rare', w: 60, d: 'Harvest for Red Spotted Mushrooms.', tint: '#c95f9f', h: { item: 'fairyShroom:1', every: 16 } },
  { n: 'Fairy Wizard Tower', lv: 6, r: 'rare', w: 150, d: 'Harvest for Red Spotted Mushrooms.', tint: '#a05fc9', h: { item: 'fairyShroom:1', every: 16 } },
  { n: 'Fairy Manor', lv: 7, r: 'rare', s: [2, 2], w: 300, d: 'Harvest for Red Spotted Mushrooms.', tint: '#8f5fd0', h: { item: 'fairyShroom:1', every: 16 } },
  { n: 'Fairy Castle', lv: 8, r: 'epic', s: [2, 2], w: 700, d: 'Harvest for an Uncommon Purple Mushroom.', tint: '#7f6fe0', h: { item: 'fairyShroom:2', every: 18 } },
  { n: 'Epic Fairy Kingdom', lv: 9, r: 'epic', s: [2, 2], w: 1600, d: 'Harvest for an Uncommon Purple Mushroom.', tint: '#9f8fff', h: { item: 'fairyShroom:2', every: 18 } },
]));

// --- Fairy Mushrooms --------------------------------------------------------
reg(chain('fairyShroom', 'Fairy Mushrooms', 'shroom', '#e0504f', [
  { n: 'Tiny Red Spotted Mushroom', lv: 1, w: 1, d: 'Tap to collect, or Merge.', tapCoins: 1, consumeOnTap: true },
  { n: 'Red Spotted Mushroom', lv: 2, w: 4, d: 'Tap to collect, or Merge.', tapCoins: 4, consumeOnTap: true },
  { n: 'Uncommon Purple Mushroom', lv: 3, r: 'uncommon', w: 15, d: 'Tap to collect, or Merge.', tapCoins: 15, consumeOnTap: true, tint: '#9f5fd0' },
  { n: 'Magic Blue Mushroom', lv: 4, r: 'uncommon', w: 50, d: 'Tap to collect, or Merge.', tapCoins: 50, consumeOnTap: true, tint: '#4f8fe0' },
  { n: 'Rainbow Mushroom', lv: 5, r: 'uncommon', w: 175, d: 'Tap to collect, or Merge.', tapCoins: 175, consumeOnTap: true, tint: '#ff9fd0' },
  { n: 'Mushroom Flower', lv: 6, r: 'rare', w: 550, d: 'Tap to collect, or Merge.', tapCoins: 550, consumeOnTap: true, tint: '#ffb04f' },
  { n: 'Mushroom Bloom', lv: 7, r: 'rare', w: 1750, d: 'Tap to collect, or Merge.', tapCoins: 1750, consumeOnTap: true, tint: '#ff7f9f' },
  { n: 'Mystic Blue Mushroom', lv: 8, r: 'epic', w: 5500, d: 'Tap to collect, or Merge.', tapCoins: 5500, consumeOnTap: true, tint: '#5fc9ff' },
  { n: 'Mystic Mushrooms', lv: 9, r: 'legendary', w: 20000, d: 'Incredible! Tap to collect, or Merge.', tapCoins: 20000, consumeOnTap: true, tint: '#c9a8ff' },
  { n: 'King Mushroom', lv: 10, r: 'legendary', s: [2, 2], w: 75000, d: 'Out of this world! Tap to collect.', tapCoins: 75000, consumeOnTap: true, tint: '#ffd24f' },
]));

// --- Gnomes -----------------------------------------------------------------
reg(chain('gnome', 'Gnomes', 'gnome', '#d05f4f', [
  { n: 'Pinecone Gnome', lv: 1, r: 'rare', w: 1, d: 'Carved from a single pinecone.', tint: '#a8764f' },
  { n: 'Gnome at Home', lv: 2, r: 'epic', w: 2, d: "Doesn't want to be disturbed." },
  { n: 'Chrome Gnome', lv: 3, r: 'epic', w: 4, d: 'Its metal coat protects it from the harsh weathers of Dragonia.', tint: '#c0c8d0' },
  { n: 'Roaming Gnome', lv: 4, r: 'epic', w: 8, d: "Don't expect to find this gnome where you left it. Tap rewards!", tint: '#4f8fd0', loot: 2 },
  { n: 'Dozing Gnome', lv: 5, r: 'legendary', w: 15, d: 'Expect to find this gnome exactly where you left it.', tint: '#7f6fc9' },
  { n: 'Gloam Gnome', lv: 6, r: 'legendary', w: 30, d: 'This gnome sparkles brightest at twilight.', tint: '#5f4f9a' },
  { n: 'Glowing Throne Gnome', lv: 7, r: 'legendary', w: 50, d: 'Lights up even the darkest forests. Tap for premium eggs & nests.', tint: '#ffd06f', loot: 5 },
]));

// --- Lost Treasures (Kala's chain) -----------------------------------------
reg(chain('lostTreasure', 'Lost Treasures', 'treasure', '#e0c04f', [
  { n: "Kala's Fire & Ice Pendant", lv: 1, r: 'epic', w: 50, d: 'A treasure lost from Feroxia. Worth 50 Coins.', tapCoins: 50, consumeOnTap: true, tint: '#e0704f' },
  { n: 'Emperor Dragon Plume', lv: 2, r: 'epic', w: 200, d: 'The ancient Dragon Emperor lost this a millenia ago. Worth 200 Coins.', tapCoins: 200, consumeOnTap: true, tint: '#9fd0ff' },
  { n: 'Liquid Gem', lv: 3, r: 'legendary', w: 750, d: 'Literally molten ruby and sapphire. Worth 750 Coins.', tapCoins: 750, consumeOnTap: true, tint: '#c94f8f' },
  { n: 'Pearl of the Shadow World', lv: 4, r: 'legendary', w: 2500, d: 'A treasure of fable said to lead to great fortune. Worth 2,500 Coins.', tapCoins: 2500, consumeOnTap: true, tint: '#d0c9e8' },
  { n: 'Crown of the Dragon Empress', lv: 5, r: 'mythical', w: 10000, wonder: true, d: "Worth 10,000 Coins... but that's not all...", tint: '#ffe07f', tapCoins: 10000, consumeOnTap: true },
]));

// --- Magnificent Artefacts (Wonder #17) -------------------------------------
reg(chain('artefact', 'Magnificent Artefacts', 'artefact', '#c9a8ff', [
  { n: 'Soul Crescent Artefact', lv: 1, r: 'epic', w: 50, d: 'A shard of something older than the world.', tint: '#9fd0ff' },
  { n: 'Elemental Artefact', lv: 2, r: 'epic', w: 100, d: 'It hums with all four elements at once.', tint: '#7fe0c0' },
  { n: 'Surging Light Artefact', lv: 3, r: 'legendary', w: 800, d: 'Too bright to look at directly.', tint: '#ffe9a8', heal: 64 },
  { n: 'Midnight Artefact', lv: 4, r: 'legendary', w: 1500, d: 'It drinks the light around it.', tint: '#6f5fa8', heal: 192 },
  { n: 'The Last Relic Artefact', lv: 5, r: 'mythical', s: [2, 2], w: 7500, wonder: true, d: 'Wonder #17 of the Dragon World. The last relic of the first age.', art: 'relic', tint: '#e0c9ff' },
]));

// --- Healing Goddesses (levels only; emit healing power over time) ---------
reg(chain('goddess', 'Healing Goddesses', 'goddess', '#d8e8ff', [
  { n: 'Minor Goddess of Healing', lv: 1, w: 0, d: 'Emits land-healing magic. 3 Healing Power a minute.', godHeal: 3, godEvery: 6 },
  { n: 'Goddess of Healing', lv: 2, w: 0, d: 'Emits land-healing magic. 10 Healing Power every 2 minutes.', godHeal: 10, godEvery: 12 },
  { n: 'Strong Goddess of Healing', lv: 3, r: 'uncommon', w: 0, d: 'Emits land-healing magic. 38 Healing Power every 3 minutes.', godHeal: 38, godEvery: 18, tint: '#c9e0ff' },
  { n: 'Greater Goddess of Healing', lv: 4, r: 'uncommon', w: 0, d: 'Emits land-healing magic. 128 Healing Power every 4 minutes.', godHeal: 128, godEvery: 24, tint: '#c0d8ff' },
  { n: 'Healing Goddess of Legend', lv: 5, r: 'rare', w: 0, d: 'Emits land-healing magic. 450 Healing Power every 5 minutes.', godHeal: 450, godEvery: 30, tint: '#e8f0ff' },
]));
CHAINS.goddess.items.forEach((it, i) => {
  it.godHeal = [3, 10, 38, 128, 450][i];
  it.godEvery = [6, 12, 18, 24, 30][i];   // wiki minutes, played as seconds
});

// --- Ornate Gold Statues (tap once for an Egg) ------------------------------
reg(chain('goldStatue', 'Ornate Gold Statues', 'statue', '#e8c14f', [
  { n: 'Ornate Llama', lv: 1, r: 'uncommon', w: 75, d: 'Beautifully encrusted. Can Tap once for an Egg.', statueEgg: 1 },
  { n: 'Jeweled Tortoise', lv: 2, r: 'uncommon', w: 100, d: 'Very dazzling. Can Tap once for an Egg.', statueEgg: 1 },
  { n: 'Lavish Toad', lv: 3, r: 'uncommon', w: 200, d: "That's a fancy frog! Can Tap once for an Egg.", statueEgg: 1 },
  { n: 'Halcyon Cougar', lv: 4, r: 'uncommon', w: 300, d: 'Feline fine. Can Tap once for an Egg.', statueEgg: 1 },
  { n: 'Aureate Deer', lv: 5, r: 'uncommon', w: 500, d: 'A treasure to fawn over. Can Tap once for an Egg.', statueEgg: 1 },
  { n: 'Gilded Rhino', lv: 6, r: 'uncommon', w: 750, d: 'Radiant Rhino. Can Tap once for an Egg.', statueEgg: 2 },
  { n: 'Paragon Dragon', lv: 7, r: 'uncommon', s: [2, 2], w: 1000, d: 'Flamboyant firebreather. Pretty fly for a gold guy.', statueEgg: 3 },
]));

// --- Jeweled Precious Statues ----------------------------------------------
reg(chain('jewelStatue', 'Jeweled Precious Statues', 'statue', '#4f8fe0', [
  { n: 'Sapphire Eagle', lv: 1, r: 'rare', w: 150, d: 'Sparkling Liberty. Can Tap once for an Egg.', statueEgg: 1, tint: '#4f8fe0' },
  { n: 'Emerald Lion', lv: 2, r: 'rare', w: 300, d: 'Regal Roar. Can Tap once for an Egg.', statueEgg: 1, tint: '#3fc98f' },
  { n: 'Aquamarine Wolf', lv: 3, r: 'rare', w: 550, d: 'Howling Elegance. Can Tap once for an Egg.', statueEgg: 1, tint: '#5fd8d0' },
  { n: 'Ruby Bear', lv: 4, r: 'rare', w: 700, d: 'Glistening Grizzly. Can Tap once for an Egg.', statueEgg: 2, tint: '#e0405f' },
  { n: 'Amethyst Peacock', lv: 5, r: 'rare', s: [2, 2], w: 1000, d: 'Iridescent crest. Can Tap once for an Egg.', statueEgg: 3, tint: '#a85fe0' },
]));

// --- Monster Idols ----------------------------------------------------------
reg(chain('monsterIdol', 'Monster Idols', 'statue', '#8f8f9a', [
  { n: 'Kattryx', lv: 1, r: 'uncommon', w: 75, d: 'A Mysterious Idol. Can Tap once for an Egg. Then Merge.', statueEgg: 1 },
  { n: 'Guardian Sphinx', lv: 2, r: 'uncommon', w: 100, d: 'A Mysterious Idol. Can Tap once for an Egg. Then Merge.', statueEgg: 1, tint: '#c9b08f' },
  { n: 'Young Cerberus', lv: 3, r: 'rare', s: [2, 1], w: 150, d: 'A Mysterious Idol. Can Tap once for an Egg. Then Merge.', statueEgg: 1, tint: '#6f6a7f' },
  { n: 'Noble Gryphon', lv: 4, r: 'rare', s: [2, 1], w: 200, d: 'A Mysterious Idol. Can Tap once for an Egg. Then Merge.', statueEgg: 2, tint: '#c9a86f' },
  { n: 'Mythical Ogopogo', lv: 5, r: 'epic', s: [2, 2], w: 500, d: 'The Most Mysterious of Idols. Can Tap once for an Egg.', statueEgg: 3, tint: '#4f9e8f' },
]));

// --- Mythical Idols ---------------------------------------------------------
reg(chain('mythicalIdol', 'Mythical Idols', 'statue', '#d0c0e0', [
  { n: 'The Gromblin', lv: 1, r: 'rare', w: 150, d: 'A Mysterious Idol. Can Tap once for an Egg. Then Merge.', statueEgg: 1, tint: '#8fc97f' },
  { n: 'The Capricorn', lv: 2, r: 'epic', s: [2, 1], w: 300, d: 'A Mysterious Idol. Can Tap once for an Egg. Then Merge.', statueEgg: 1, tint: '#c9b8a8' },
  { n: 'The Dragon Idol', lv: 3, r: 'epic', s: [1, 2], w: 550, d: 'A Mysterious Idol. Can Tap once for an Egg. Then Merge.', statueEgg: 2, tint: '#c94f5f' },
  { n: 'The Rising Phoenix', lv: 4, r: 'legendary', s: [2, 1], w: 700, d: 'A Mysterious Idol. Can Tap once for an Egg. Then Merge.', statueEgg: 2, tint: '#ff9f3f' },
  { n: 'The Mythical Pegasus Idol', lv: 5, r: 'mythical', s: [2, 2], w: 1000, d: 'The Pinnacle of Idols. Can Tap once for an Egg.', statueEgg: 4, tint: '#ffffff' },
]));

// --- Mystic Topiaries (Wonder #18 in the Lobelia variant) -------------------
reg(chain('mysticTopiary', 'Mystic Topiaries', 'topiary', '#4f9e5f', [
  { n: 'Bunny Topiary', lv: 1, w: 100, d: 'Looks fluffy, also gives an Egg!', statueEgg: 1 },
  { n: 'Bear Topiary', lv: 2, w: 200, d: 'Sweet as honey, also gives a Premium Egg!', statueEgg: 1 },
  { n: 'Rex Topiary', lv: 3, r: 'uncommon', w: 300, d: 'Welcoming with tiny arms, also gives 2x Premium Eggs.', statueEgg: 2 },
  { n: 'Magnificient Rose Swan Topiary', lv: 4, r: 'uncommon', w: 500, d: 'Graceful and serene, also gives 3x Premium Eggs.', statueEgg: 3, tint: '#7fbf6f' },
  { n: 'Seahorse Topiary', lv: 5, r: 'rare', w: 750, d: 'Proud and majestic, also gives 5x Premium Eggs.', statueEgg: 4, tint: '#5faf8f' },
  { n: 'Dolphin Topiary', lv: 6, r: 'epic', w: 1000, d: 'Leaping towards the sky, also gives 10x Premium Eggs.', statueEgg: 5, tint: '#5f9eaf' },
  { n: 'Lilac Unicorn Topiary', lv: 7, r: 'mythical', w: 2000, d: 'Gives 20x Premium Eggs.', statueEgg: 6, tint: '#a88fd0' },
  { n: 'Magnificent Dragon Topiary', lv: 8, r: 'mythical', s: [2, 2], w: 5000, wonder: true, d: 'Wonder of the Dragon World. Shy and loyal, also gives 40x Premium Eggs.', statueEgg: 8, tint: '#6fc97f' },
]));

// --- Lobelia Topiaries ------------------------------------------------------
reg(chain('lobeliaTopiary', 'Lobelia Topiaries', 'topiary', '#4f6fc9', [
  { n: 'Cobalt Cottontail Topiary', lv: 1, w: 100, d: 'Looks fluffy, also gives a Nature Egg!', statueEgg: 1 },
  { n: 'Sweet Grizzly Topiary', lv: 2, w: 200, d: 'Sweet as honey, also gives a Premium Egg!', statueEgg: 1, tint: '#5f7fd0' },
  { n: 'Delphinium Dino Topiary', lv: 3, r: 'uncommon', w: 300, d: 'Welcoming with tiny arms, also gives 2x Premium Eggs.', statueEgg: 2, tint: '#6f8fd8' },
  { n: 'Winged Orchid Topiary', lv: 4, r: 'uncommon', w: 500, d: 'Graceful and serene, also gives 3x Premium Eggs.', statueEgg: 3, tint: '#8f9fe0' },
  { n: 'Aquatic Indigo Topiary', lv: 5, r: 'rare', w: 750, d: 'Proud and majestic, also gives 5x Premium Eggs.', statueEgg: 4, tint: '#4f5fc0' },
  { n: 'Celestial Fin Topiary', lv: 6, r: 'epic', w: 1000, d: 'Leaping towards the sky, also gives 10x Premium Eggs.', statueEgg: 5, tint: '#5f8fe8' },
  { n: 'Enchanted Horn Topiary', lv: 7, r: 'mythical', w: 2000, d: 'Wonder #18 of the Dragon World! Gives 20x Premium Eggs.', statueEgg: 6, tint: '#9fb0ff' },
  { n: 'Blushing Wyvern Topiary', lv: 8, r: 'mythical', s: [2, 2], w: 5000, wonder: true, d: 'Shy and loyal, also gives 40x Premium Eggs.', statueEgg: 8, tint: '#c0a8ff' },
]));

// --- Crystal Trees ----------------------------------------------------------
reg(chain('crystalTree', 'Crystal Trees', 'tree', '#c95f8f', [
  { n: 'Cerise Yew', lv: 1, r: 'uncommon', w: 8, d: 'Merge for an Amber Oak.', tint: '#c95f8f' },
  { n: 'Amber Oak', lv: 2, r: 'uncommon', w: 15, d: 'Harvest for an Emerald Fruit.', tint: '#e0a04f', h: { item: 'crystalFruit:0', every: 14 } },
  { n: 'Coral Aspen', lv: 3, r: 'uncommon', w: 30, d: 'Harvest for an Emerald Fruit.', tint: '#e07f6f', h: { item: 'crystalFruit:0', every: 14 } },
  { n: 'Lavender Ash', lv: 4, r: 'uncommon', w: 60, d: 'Harvest for an Emerald Fruit.', tint: '#b08fd0', h: { item: 'crystalFruit:0', every: 14 } },
  { n: 'Plum Willow', lv: 5, r: 'rare', w: 150, d: 'Harvest for a Moonstone Fruit.', tint: '#8f5f9a', h: { item: 'crystalFruit:1', every: 16 } },
  { n: 'Crimson Elm', lv: 6, r: 'rare', s: [2, 2], w: 300, d: 'Harvest for a Moonstone Fruit.', tint: '#b03f4f', h: { item: 'crystalFruit:1', every: 16 } },
]));

// --- Spiritual Trees --------------------------------------------------------
reg(chain('spiritualTree', 'Spiritual Trees', 'tree', '#6fae7f', [
  { n: 'Bamboo Shrub', lv: 1, r: 'uncommon', w: 8, d: 'Merge for a Budding Blossom Tree!', tint: '#8fc95f' },
  { n: 'Budding Blossom Tree', lv: 2, r: 'uncommon', w: 15, d: 'Harvest for a Drum Lamp.', tint: '#ffb0c9', h: { item: 'mysticLantern:0', every: 15 } },
  { n: 'Mountain Fir Tree', lv: 3, r: 'uncommon', s: [2, 1], w: 30, d: 'Harvest for a Drum Lamp.', tint: '#3f7f5f', h: { item: 'mysticLantern:0', every: 15 } },
  { n: 'Blessed Redwood Tree', lv: 4, r: 'uncommon', s: [2, 1], w: 60, d: 'Harvest for a Drum Lamp.', tint: '#a85f4f', h: { item: 'mysticLantern:0', every: 15 } },
  { n: 'Aquamarine Bead Tree', lv: 5, r: 'rare', s: [2, 2], w: 150, d: 'Harvest for a Lampion.', tint: '#5fd0c9', h: { item: 'mysticLantern:1', every: 17 } },
  { n: 'Violet Cypress Tree', lv: 6, r: 'rare', s: [2, 2], w: 300, d: 'Harvest for a Lampion.', tint: '#8f6fc9', h: { item: 'mysticLantern:1', every: 17 } },
]));

// --- Opal Trees -------------------------------------------------------------
reg(chain('opalTree', 'Opal Trees', 'tree', '#9fd8c9', [
  { n: 'Sacred Fir', lv: 1, r: 'rare', s: [2, 1], w: 60, d: 'A 5000 year old gorgeous tree.', heal: 24 },
  { n: 'Blessed Sequoia', lv: 2, r: 'rare', s: [2, 1], w: 150, d: 'Guardian of the Forest of Time', tint: '#b0e0d0', heal: 96 },
  { n: 'Holy Inabe', lv: 3, r: 'rare', s: [2, 2], w: 400, d: 'Last of its kind. It was there when the First Calamity happened', tint: '#d0f0e8', heal: 384 },
]));

// --- Passion Trees ----------------------------------------------------------
reg(chain('passionTree', 'Passion Trees', 'tree', '#e05f8f', [
  { n: 'Passion Tree Seed', lv: 0, r: 'uncommon', w: 1, d: 'Merge or wait to grow a Passion Tree!', art: 'seed', tint: '#c07f6f' },
  { n: 'Planted Passion Tree', lv: 1, r: 'uncommon', w: 2, d: 'Merge for a Passion Tree Sprout!', art: 'sprout', tint: '#8fc95f' },
  { n: 'Passion Tree Sprout', lv: 2, r: 'uncommon', w: 4, d: 'Harvest for a Caramel Heart.', h: { item: 'chocolate:0', every: 15 } },
  { n: 'Young Passion Tree', lv: 3, r: 'uncommon', w: 8, d: 'Harvest for a Caramel Heart.', h: { item: 'chocolate:0', every: 15 } },
  { n: 'Growing Passion Tree', lv: 4, r: 'uncommon', w: 15, d: 'Harvest for a Caramel Heart.', h: { item: 'chocolate:0', every: 15 } },
  { n: 'Blooming Passion Tree', lv: 5, r: 'rare', w: 30, d: 'Harvest for a Dipped Strawberry.', tint: '#ff7fa8', h: { item: 'chocolate:1', every: 17 } },
  { n: 'Full Passion Tree', lv: 6, r: 'rare', w: 60, d: 'Harvest for a Dipped Strawberry.', tint: '#ff5f9f', h: { item: 'chocolate:1', every: 17 } },
  { n: 'Entwined Passion Trees', lv: 7, r: 'rare', w: 150, d: 'Harvest for a Dipped Strawberry.', tint: '#e04f8f', h: { item: 'chocolate:1', every: 17 } },
  { n: 'Kissing Passion Trees', lv: 8, r: 'epic', s: [2, 2], w: 300, d: 'Harvest for Creme Brulove.', tint: '#ff8fc0', h: { item: 'chocolate:2', every: 19 } },
  { n: "Lovers' Embrace", lv: 9, r: 'epic', s: [2, 2], w: 700, d: 'Harvest for Creme Brulove.', tint: '#ffb0d8', h: { item: 'chocolate:3', every: 19 } },
]));

// --- Forgotten Flowers ------------------------------------------------------
reg(chain('forgottenFlower', 'Forgotten Flowers', 'flower', '#e8e0b0', [
  { n: 'Lost Bud', lv: 1, w: 2, d: 'Merge for Sunday Flower', tint: '#c9d08f' },
  { n: 'Sunday Flower', lv: 2, w: 4, d: 'Merge for Twin Flowers', tint: '#ffe97f' },
  { n: 'Twin Flowers', lv: 3, w: 8, d: 'Merge for Three Graces', tint: '#ffd0a8' },
  { n: 'Three Graces', lv: 4, r: 'uncommon', w: 15, d: 'Merge for Moonflower', tint: '#ffc9d8' },
  { n: 'Moonflower', lv: 5, r: 'uncommon', w: 30, d: 'Merge for Plumeria', tint: '#d8e0ff', tapHeal: 20 },
  { n: 'Plumeria', lv: 6, r: 'rare', w: 60, d: "Merge for Apollo's Bloom", tint: '#fff0c0', tapHeal: 45 },
  { n: "Apollo's Bloom", lv: 7, r: 'rare', w: 150, d: "Merge for Athena's Flowers", tint: '#ffcf5f', tapHeal: 110 },
  { n: "Athena's Flowers", lv: 8, r: 'epic', w: 300, d: "Merge for Aphrodite's Vase", tint: '#c0d8c0', tapHeal: 260 },
  { n: "Aphrodite's Vase", lv: 9, r: 'epic', w: 700, d: "Merge for Zeus's Cup", tint: '#f0c9a8', tapHeal: 620 },
  { n: "Zeus's Cup", lv: 10, r: 'legendary', s: [2, 2], w: 1600, d: 'He lost it. And he will never find it.', tint: '#ffe9c0', tapHeal: 1500 },
]));

// --- Mystic Lanterns --------------------------------------------------------
reg(chain('mysticLantern', 'Mystic Lanterns', 'lantern', '#e0704f', [
  { n: 'Drum Lamp', lv: 1, w: 1, d: 'Tap to collect, or Merge.', tapCoins: 1, consumeOnTap: true },
  { n: 'Lampion', lv: 2, w: 4, d: 'Tap to collect, or Merge.', tapCoins: 4, consumeOnTap: true },
  { n: 'Trio of Lampions', lv: 3, w: 15, d: 'Tap to collect, or Merge.', tapCoins: 15, consumeOnTap: true },
  { n: 'Lotus Lamp', lv: 4, r: 'uncommon', w: 50, d: 'Tap to collect, or Merge.', tapCoins: 50, consumeOnTap: true, tint: '#ff9fb0' },
  { n: 'Jade Turtle Lamp', lv: 5, r: 'uncommon', w: 175, d: 'Tap to collect, or Merge.', tapCoins: 175, consumeOnTap: true, tint: '#5fc98f' },
  { n: 'Festive Carp Lamp', lv: 6, r: 'rare', w: 550, d: 'Tap to collect, or Merge.', tapCoins: 550, consumeOnTap: true, tint: '#ffa03f' },
  { n: 'Sensuous Swan Lamp', lv: 7, r: 'rare', w: 1750, d: 'Tap to collect, or Merge.', tapCoins: 1750, consumeOnTap: true, tint: '#f0f0ff' },
  { n: 'Happy Panda Lamp', lv: 8, r: 'epic', w: 5500, d: 'Tap to collect, or Merge.', tapCoins: 5500, consumeOnTap: true, tint: '#e8e8f0' },
  { n: 'White Tiger Lamp', lv: 9, r: 'legendary', w: 20000, d: 'Incredible! Tap to collect, or Merge.', tapCoins: 20000, consumeOnTap: true, tint: '#d0e8ff' },
  { n: 'Furious Dragon Lamp', lv: 10, r: 'legendary', s: [2, 2], w: 75000, d: 'Out of this world! Tap to collect.', tapCoins: 75000, consumeOnTap: true, tint: '#ff5f4f' },
]));

// --- Bonus Points -----------------------------------------------------------
reg(chain('bonusPoint', 'Bonus Points', 'points', '#7fd0ff', [
  { n: '3 Points', lv: 1, w: 3, d: 'A bonus point. Tap to collect', tapCoins: 3, consumeOnTap: true },
  { n: '10 Points', lv: 2, w: 10, d: 'A few bonus points. Tap to collect', tapCoins: 10, consumeOnTap: true },
  { n: '30 Points', lv: 3, w: 30, d: 'Some bonus points. Tap to collect', tapCoins: 30, consumeOnTap: true },
  { n: '90 Points', lv: 4, w: 90, d: 'A handful of bonus points. Tap to collect', tapCoins: 90, consumeOnTap: true },
  { n: '300 Points', lv: 5, r: 'uncommon', w: 300, d: 'A bunch of bonus points. Tap to collect', tapCoins: 300, consumeOnTap: true },
  { n: '900 Points', lv: 6, r: 'uncommon', w: 900, d: 'Lots of bonus points. Tap to collect', tapCoins: 900, consumeOnTap: true },
  { n: '2,700 Points', lv: 7, r: 'uncommon', w: 2700, d: 'Plenty of bonus points. Tap to collect', tapCoins: 2700, consumeOnTap: true },
  { n: '8,500 Points', lv: 8, r: 'rare', w: 8500, d: 'Tons of bonus points. Tap to collect', tapCoins: 8500, consumeOnTap: true },
  { n: '25,500 Points', lv: 9, r: 'rare', w: 25500, d: 'Scads of bonus points. Tap to collect', tapCoins: 25500, consumeOnTap: true },
  { n: '76,500 Points', lv: 10, r: 'rare', w: 76500, d: 'Heaps of bonus points. Tap to collect', tapCoins: 76500, consumeOnTap: true },
  { n: '250K Points', lv: 11, r: 'epic', w: 250000, d: 'Spellfulls bonus points. Tap to collect', tapCoins: 250000, consumeOnTap: true },
  { n: '750K Points', lv: 12, r: 'epic', w: 750000, d: 'Oodles of bonus points. Tap to collect', tapCoins: 750000, consumeOnTap: true },
  { n: '2.25M Points', lv: 13, r: 'legendary', w: 2250000, d: 'The most bonus points EVAR!', tapCoins: 2250000, consumeOnTap: true },
]));

// --- Wishing Well Coins -----------------------------------------------------
reg(chain('wellCoin', 'Wishing Well Coins', 'coin', '#c9c0a8', [
  { n: 'Schilling', lv: 1, w: 1, d: 'A tiny coin. What happens when you merge it?', tint: '#b0a890' },
  { n: 'Denarius', lv: 2, w: 2, d: 'An old coin of pure silver. Merge it up!', tint: '#d8dde0' },
  { n: 'Sovereign', lv: 3, r: 'uncommon', w: 4, d: 'A discolored, dim coin. Merge it up!', tint: '#c9a86f' },
  { n: 'Ryal', lv: 4, r: 'rare', w: 8, d: 'A tarnished gold coin of many names. Merge it up!', tint: '#e0b84f' },
  { n: 'Aureus', lv: 5, r: 'legendary', w: 15, d: 'Throw this coin into the Wishing Well to receive a new Boon.', tint: '#ffd24f', tapGems: 1, consumeOnTap: true },
]));

// --- Gemsteel ---------------------------------------------------------------
reg(chain('gemsteel', 'Gemsteel', 'crystal', '#7fd0e8', [
  { n: 'Essence of Gemsteel', lv: 1, w: 2, d: 'Beaming with mystical energy.' },
  { n: 'Unrefined Gemsteel Ore', lv: 2, w: 6, d: 'Beaming with mystical energy.', tint: '#8f9eb0' },
  { n: 'Molten Gemsteel Pit', lv: 3, w: 18, d: 'Beaming with mystical energy.', tint: '#ff8f4f' },
  { n: 'Refined Gemsteel', lv: 4, r: 'uncommon', w: 50, d: 'Beaming with mystical energy.', tint: '#9fe0ff' },
  { n: 'Gemsteel Furnace', lv: 5, r: 'uncommon', w: 140, d: 'Beaming with mystical energy.', tint: '#ffb04f' },
  { n: 'Gemsteel Gate', lv: 6, r: 'rare', s: [2, 2], w: 400, d: 'Beaming with mystical energy.', tint: '#c0e8ff' },
]));

// --- Lightcrystal Veins (a conjurer chain) ---------------------------------
reg(chain('lightcrystal', 'Lightcrystal Veins', 'crystal', '#c9a8ff', [
  { n: 'Depleted Conjurer Stone', lv: 1, w: 2, d: 'Its conjuring powers have long since subsided.', tint: '#8f8f9a' },
  { n: 'Drained Conjurer Stone', lv: 2, w: 6, d: 'Faint glimmers of conjuring potential flicker within it.', tint: '#9f9fb0' },
  { n: 'Minor Conjurer Stone', lv: 3, r: 'uncommon', w: 18, d: 'Conjures Dragon Essence and Gemsteel objects.', spawns: { item: 'essence:0', every: 26 } },
  { n: 'Conjurer Stone', lv: 4, r: 'uncommon', w: 50, d: 'Conjures Dragon Essence and Gemsteel objects. Medium chance for rare objects.', spawns: { item: 'gemsteel:0', every: 22 } },
  { n: 'Enchanted Conjurer Stone', lv: 5, r: 'rare', w: 140, d: 'Conjures Dragon Essence and Gemsteel objects. High chance for rare objects.', spawns: { item: 'gemsteel:1', every: 20 } },
  { n: 'Mighty Conjurer Stone', lv: 6, r: 'rare', s: [2, 2], w: 400, d: 'Conjures Dragon Essence and Gemsteel objects. Very high chance for rare objects.', spawns: { item: 'gemsteel:2', every: 18 } },
]));

// --- Mystic Trees (conjurer logs) ------------------------------------------
reg(chain('mysticTree', 'Mystic Trees', 'log', '#7f8f6f', [
  { n: 'Depleted Conjurer Log', lv: 1, w: 2, d: 'Its conjuring powers have long since subsided.' },
  { n: 'Drained Conjurer Log', lv: 2, w: 6, d: 'Faint glimmers of conjuring potential flicker within it.' },
  { n: 'Conjurer Shrub', lv: 3, r: 'uncommon', w: 18, d: 'Conjures Mystic Plants and Mystic Shrooms objects.', art: 'bush', spawns: { item: 'mysticPlant:0', every: 26 } },
  { n: 'Conjurer Tree', lv: 4, r: 'uncommon', w: 50, d: 'Conjures Mystic Plants and Mystic Shrooms objects. Medium chance for rare objects.', art: 'tree', spawns: { item: 'mysticPlant:1', every: 22 } },
  { n: 'Enchanted Conjurer Tree', lv: 5, r: 'rare', w: 140, d: 'Conjures Mystic Plants and Mystic Shrooms objects. High chance for rare objects.', art: 'tree', tint: '#6fc9a8', spawns: { item: 'mysticPlant:2', every: 20 } },
  { n: 'Mighty Conjurer Tree', lv: 6, r: 'rare', s: [2, 2], w: 400, d: 'Conjures Mystic Plants and Mystic Shrooms objects. Very high chance for rare objects.', art: 'tree', tint: '#8fe0c0', spawns: { item: 'mysticPlant:3', every: 18 } },
]));

// --- Mystic Plants ----------------------------------------------------------
reg(chain('mysticPlant', 'Mystic Plants', 'terrarium', '#7fd0a8', [
  { n: 'Mystic Sprouts', lv: 1, w: 2, d: 'An enclosed environment for a rare species of microfauna.' },
  { n: 'Small Fungal Garden', lv: 2, w: 4, d: 'An enclosed environment for a rare species of microfauna.' },
  { n: 'Enclosed Fungal Garden', lv: 3, w: 8, d: 'An enclosed environment for a rare species of microfauna.' },
  { n: 'Fungal Terrarium', lv: 4, r: 'uncommon', w: 15, d: 'An enclosed environment for a rare species of microfauna.', tint: '#6fc9d0' },
  { n: 'Overflowing Fungal Terrarium', lv: 5, r: 'uncommon', w: 30, d: 'An enclosed environment for a rare species of microfauna.', tint: '#6fc9d0' },
  { n: 'Bustling Fungal Terrarium', lv: 6, r: 'rare', w: 60, d: 'An enclosed environment for a rare species of microfauna.', tint: '#8fd0ff' },
  { n: 'Fungal Greenhouse', lv: 7, r: 'rare', s: [2, 1], w: 150, d: 'An enclosed environment for a rare species of microfauna.', tint: '#a8e0ff' },
]));

// --- Ruined Fountains (conjurer puddles) -----------------------------------
reg(chain('ruinedFountain', 'Ruined Fountains', 'fountain', '#8fa8b0', [
  { n: 'Depleted Conjurer Puddle', lv: 1, w: 2, d: 'Its conjuring powers have long since subsided.', tint: '#7f8f96' },
  { n: 'Drained Conjurer Puddle', lv: 2, w: 6, d: 'Faint glimmers of conjuring potential flicker within it.', tint: '#8f9ea8' },
  { n: 'Minor Conjurer Fountain', lv: 3, r: 'uncommon', w: 18, d: 'Conjures Ancient Heirlooms and Ancient Ornaments objects.', spawns: { item: 'lostTreasure:0', every: 30 } },
  { n: 'Conjurer Fountain', lv: 4, r: 'uncommon', w: 50, d: 'Conjures Ancient Heirlooms and Ancient Ornaments objects. Medium chance for rare objects.', spawns: { item: 'lostTreasure:0', every: 26 } },
  { n: 'Enchanted Conjurer Fountain', lv: 5, r: 'rare', w: 140, d: 'Conjures Ancient Heirlooms and Ancient Ornaments objects. High chance for rare objects.', tint: '#9fd0e0', spawns: { item: 'lostTreasure:1', every: 24 } },
  { n: 'Mighty Conjurer Fountain', lv: 6, r: 'rare', s: [2, 2], w: 400, d: 'Conjures Ancient Heirlooms and Ancient Ornaments objects. Very high chance for rare objects.', tint: '#b0e0f0', spawns: { item: 'lostTreasure:2', every: 22 } },
]));

// --- Secret Fountains (produce eggs; tap for Life Flowers) -----------------
reg(chain('secretFountain', 'Secret Fountains', 'fountain', '#8fe0ff', [
  { n: 'Secret Lifespring', lv: 1, r: 'legendary', w: 75, d: 'Produces an Egg. Sometimes Tap for a Blue Life Flower.', h: { item: 'lifeFlower:3', every: 18 }, spawns: { item: 'grassd:1', every: 34 } },
  { n: 'Spectral Lifespring', lv: 2, r: 'legendary', s: [1, 2], w: 200, d: 'Produces an Egg. Sometimes Tap for a Glowing Life Flower.', tint: '#c9b0ff', h: { item: 'lifeFlower:4', every: 18 }, spawns: { item: 'greend:1', every: 30 } },
]));

// --- Misty Mountains --------------------------------------------------------
reg(chain('mistyMountain', 'Misty Mountains', 'hill', '#9fa8c0', [
  { n: 'Cloudy Summit', lv: 5, r: 'uncommon', s: [2, 1], w: 10, d: 'This is where Clouds come from.', h: { item: 'water:0', every: 15 } },
  { n: 'The Misty Mountain', lv: 6, r: 'rare', s: [2, 2], w: 20, d: 'A great source of Clouds.', tint: '#b0bcd8', h: { item: 'water:1', every: 17 } },
]));

// --- Small Fluffs -----------------------------------------------------------
reg(chain('fluff', 'Small Fluffs', 'fluff', '#f0d8b0', [
  { n: 'Ground Fluff', lv: 1, r: 'uncommon', w: 100, d: 'He really digs you! Tap to tickle him!', tint: '#c9a87f', taps: 3, tapCoins: 8 },
  { n: 'Soft Fluff', lv: 2, r: 'rare', w: 250, d: "She's so fluffy! Tap to tickle her!", tint: '#f0d8c0', taps: 3, tapCoins: 24 },
  { n: 'Round Fluff', lv: 3, r: 'legendary', w: 500, d: "He's the perfect circle. Tap to tickle him!", tint: '#ffe9d0', taps: 4, tapCoins: 70 },
  { n: 'Snug Fluff', lv: 4, r: 'mythical', w: 1000, d: "Shh, she's dreaming! Tap to tickle her!", tint: '#ffd0e8', taps: 5, tapCoins: 200 },
]));

// --- Spirit Rose ------------------------------------------------------------
reg(chain('spiritRose', 'Spirit Rose', 'flower', '#c94f7f', [
  { n: 'Thorny Bloom', lv: 1, r: 'rare', w: 2, d: 'Small but very spiky.' },
  { n: 'Dark Rose', lv: 2, r: 'rare', w: 6, d: "Oh no, I can't stop looking at it.", tint: '#8f3f5f' },
  { n: 'Spectral Rose Bush', lv: 3, r: 'epic', w: 18, d: 'Roses from out of this world.', tint: '#c9a8ff', tapHeal: 24 },
]));

// --- Precious Frogans -------------------------------------------------------
reg(chain('frogan', 'Precious Frogans', 'fluff', '#6fc95f', [
  { n: 'Frogan Egg', lv: 1, r: 'uncommon', w: 100, d: 'Merge to hatch this rare Frogan Egg!', art: 'egg', tint: '#8fd07f' },
  { n: 'Frogan Tadpole', lv: 2, r: 'rare', w: 250, d: 'Merge to create a Splendid Frogan!', tint: '#5faf4f' },
  { n: 'Splendid Frogan', lv: 3, r: 'legendary', w: 500, d: 'Throw him into the Wishing Well to choose a new Merge Goal.', tint: '#4fd0a8', taps: 2, tapGems: 1 },
]));

// --- Super Eggs -------------------------------------------------------------
reg(chain('superEgg', 'Super Eggs', 'egg', '#ffd0ff', [
  { n: 'Super Egg Fragment', lv: 1, r: 'legendary', w: 1, d: 'Merge 3 to create a Super Egg.', tint: '#ffb0e8' },
  { n: 'Super Egg', lv: 2, r: 'mythical', w: 25, d: 'Merge 3 to get something incredible...', tint: '#ffd0ff' },
  { n: 'Active Super Egg', lv: 3, r: 'mythical', w: 100, d: 'Hatches many dragons!', tint: '#ffffff', loot: 6 },
]));

// --- Basic Soul Crystals (Dragon Breeding) ---------------------------------
reg(chain('soulCrystal', 'Basic Soul Crystals', 'crystal', '#9fd8ff', [
  { n: 'Basic Soul Crystal Shard', lv: 0, w: 1, d: 'Merge 3 for a Basic Soul Crystal.', tint: '#b0e0ff', soul: 0 },
  { n: 'Small Basic Soul Crystal', lv: 1, r: 'uncommon', w: 2, d: 'Used in Dragon Breeding. Tap to breed for an Egg.', soul: 1 },
  { n: 'Medium Basic Soul Crystal', lv: 2, r: 'rare', w: 3, d: 'Used in Dragon Breeding. Tap to breed for a Whelp.', tint: '#8fc9ff', soul: 2 },
  { n: 'Large Basic Soul Crystal', lv: 3, r: 'epic', w: 8, d: 'Used in Dragon Breeding. Tap to breed for a Kid.', tint: '#c9b0ff', soul: 3 },
]));
CHAINS.soulCrystal.items.forEach((it, i) => { it.soul = i; });

// --- Magic Coin Storage: the coin cap ---------------------------------------
// Storage amounts, tap rewards, sizes, rarities and worths from the wiki's
// Magic Coin Storage table.
reg(chain('coinVault', 'Magic Coin Storage', 'vault', '#c9a04f', [
  { n: 'Tattered Coin Vault', lv: 1, w: 4, d: '+5 Coin Storage!', store: 5, h: { item: 'coin:0', every: 20 } },
  { n: 'Basic Coin Vault', lv: 2, w: 10, d: '+20 Coin Storage!', store: 20, h: { item: 'coin:0', every: 18 } },
  { n: 'Nice Coin Vault', lv: 3, w: 25, d: '+75 Coin Storage!', store: 75, h: { item: 'coin:1', every: 18 } },
  { n: 'Great Coin Vault', lv: 4, r: 'uncommon', w: 75, d: '+250 Coin Storage!', store: 250, h: { item: 'coin:1', every: 16 } },
  { n: 'Opulent Coin Vault', lv: 5, r: 'uncommon', w: 200, d: '+800 Coin Storage!', store: 800, h: { item: 'coin:1', every: 14 } },
  { n: 'Mythical Coin Vault', lv: 6, r: 'rare', w: 500, d: '+2,500 Coin Storage!', store: 2500, h: { item: 'coin:2', every: 18 } },
  { n: 'Gigantic Coin Vault', lv: 7, r: 'rare', s: [2, 1], w: 1000, d: '+10,000 Coin Storage!', store: 10000, h: { item: 'coin:2', every: 14 } },
  { n: 'Bottomless Coin Vault', lv: 8, r: 'legendary', s: [2, 2], w: 2500, d: '+50,000 Coin Storage!', store: 50000, h: { item: 'coin:3', every: 20 } },
]));
CHAINS.coinVault.items.forEach((it, i) => {
  it.storage = { cur: 'coins', add: [5, 20, 75, 250, 800, 2500, 10000, 50000][i] };
});

// --- Stone Storage: the brick cap ------------------------------------------
reg(chain('stoneYard', 'Stone Storage', 'yard', '#9aa79a', [
  { n: 'Tattered Stone Yard', lv: 1, w: 4, d: '+5 Stone Storage!', h: { item: 'brick:0', every: 20 } },
  { n: 'Basic Stone Yard', lv: 2, w: 10, d: '+20 Stone Storage!', h: { item: 'brick:0', every: 18 } },
  { n: 'Nice Stone Yard', lv: 3, w: 25, d: '+75 Stone Storage!', h: { item: 'brick:1', every: 18 } },
  { n: 'Great Stone Yard', lv: 4, r: 'uncommon', w: 75, d: '+250 Stone Storage!', h: { item: 'brick:1', every: 16 } },
  { n: 'Opulent Stone Yard', lv: 5, r: 'uncommon', w: 200, d: '+800 Stone Storage!', h: { item: 'brick:1', every: 14 } },
  { n: 'Mythical Stone Yard', lv: 6, r: 'rare', w: 500, d: '+2,500 Stone Storage!', h: { item: 'brick:2', every: 18 } },
  { n: 'Gigantic Stone Yard', lv: 7, r: 'rare', s: [1, 2], w: 1000, d: '+10,000 Stone Storage!', h: { item: 'brick:2', every: 14 } },
  { n: 'Bottomless Stone Yard', lv: 8, r: 'legendary', s: [2, 2], w: 2500, d: '+50,000 Stone Storage!', h: { item: 'brick:3', every: 20 } },
]));
CHAINS.stoneYard.items.forEach((it, i) => {
  it.storage = { cur: 'bricks', add: [5, 20, 75, 250, 800, 2500, 10000, 50000][i] };
});

// --- Leftovers: what a full store hands you instead of currency ------------
// "Stones you couldn't collect because your Stone Storage was full." Not
// mergeable, not even with another of the same value (wiki Trivia).
reg(chain('leftover', 'Leftovers', 'leftover', '#c8b48f', [
  { n: 'Leftover Stones', lv: 1, w: 0, d: "Stones you couldn't collect because your Stone Storage was full.", unmergeable: true },
  { n: 'Leftover Coins', lv: 1, w: 0, d: "Coins you couldn't collect because your Coin Storage was full.", unmergeable: true, tint: '#f2c14e' },
]));
CHAINS.leftover.items.forEach((it, i) => { it.unmergeable = true; it.leftover = i === 0 ? 'bricks' : 'coins'; });

// --- Dimensional Jars: the gem sink ----------------------------------------
// "A non-mergeable object which sometimes appears upon merging... The item it
// contains is a clone of the object that was just created... Every Dimensional
// Jar can be sold for 50 Magic Coins, regardless of content."
reg(chain('jar', 'Dimensional Jars', 'jar', '#bfe8ff', [
  { n: 'Dimensional Jar', lv: 1, r: 'rare', w: 50, d: 'Tap to open it with Dragon Gems, or sell it for 50 Coins.', unmergeable: true },
]));
CHAINS.jar.items[0].unmergeable = true;

// ---------------------------------------------------------------------------
// Dragon breeds. Each breed: 4 base levels, then a tier-2 evolution reached by
// merging level-4 dragons (which produces a Nest of tier-2 eggs).
// Dragon Power / Stamina values are the wiki's.
// ---------------------------------------------------------------------------
// Dragon Types (wiki): Builder, Defender, Harvester, Trophy, Worker, Zoomer.
// Crimson Dragons are the only breed with no type.
//
// Each breed's twelve row names, its Dragon Power ladder and its Camp Stamina
// ladder are transcribed from that breed's own wiki Data table -- they are NOT
// a shared template. Sharp Dragons are "Vicious"/"Fierce" where Grass Dragons
// are plain/"Noble"; Golem Dragons carry 1/4/16/55 power where Grass carry
// 1/4/15/50; Green Dragons hold twice the stamina of Rock. The colour palettes
// are the one part chosen here: the wiki publishes art, not hex values.
//
// dp / st are the eight playable stages: base L1-L4 then evolved L1-L4.
const DP_A = [1, 4, 15, 50, 165, 525, 1600, 5000];
const DP_B = [1, 4, 16, 55, 181, 577, 1760, 5500];
const DP_C = [3, 12, 45, 150, 495, 1575, 4800, 15000];
const ST_A = [1, 2, 3, 4, 5, 6, 8, 10];
const ST_B = [1, 1, 2, 3, 3, 3, 4, 6];
const ST_C = [4, 6, 8, 10, 12, 14, 17, 20];

export const BREEDS = [
  { id: 'grassd', base: 'Grass', evo: 'Sunset', l4: 'Noble', evoL4: 'Royal', type: 'Harvester', dp: DP_A, st: ST_A, body: '#7fc75f', belly: '#e0f0a8', wing: '#a8e07f', evoBody: '#ff8f5f', evoBelly: '#ffd9a8', evoWing: '#ffb07f' },
  { id: 'greend', base: 'Green', evo: 'Twilight', l4: 'Noble', evoL4: 'Royal', type: 'Worker', dp: DP_A, st: [2, 3, 5, 6, 8, 9, 12, 15], body: '#4fae7f', belly: '#c9f0d8', wing: '#7fd0a0', evoBody: '#6f5fc9', evoBelly: '#d0c9ff', evoWing: '#9f8fe0' },
  { id: 'rockd', base: 'Rock', evo: 'Mountain', l4: 'Adept', evoL4: 'Master', type: 'Builder', dp: DP_A, st: ST_A, body: '#9a8f7f', belly: '#d8cfbf', wing: '#b0a08f', evoBody: '#6f7f9a', evoBelly: '#c9d8e8', evoWing: '#8fa0bf' },
  { id: 'crimsond', base: 'Crimson', evo: 'Sapphire', l4: 'Noble', evoL4: 'Royal', type: null, dp: DP_A, st: ST_A, body: '#c94f4f', belly: '#ffcfc0', wing: '#e07f6f', evoBody: '#4f7fd0', evoBelly: '#c0dcff', evoWing: '#7fa8e8' },
  { id: 'spottedd', base: 'Spotted', evo: 'Citrus', l4: 'Noble', evoL4: 'Royal', type: 'Zoomer', dp: DP_B, st: ST_A, body: '#c98f4f', belly: '#f0dcb0', wing: '#e0b07f', evoBody: '#e0c93f', evoBelly: '#fff0a8', evoWing: '#f0d95f' },
  { id: 'toadstoold', base: 'Toadstool', evo: 'Amanita', l4: 'Noble', evoL4: 'Royal', type: 'Harvester', dp: DP_B, st: ST_A, body: '#a85f8f', belly: '#f0c9e0', wing: '#c97fa8', evoBody: '#d04f4f', evoBelly: '#ffd8d0', evoWing: '#e87f7f' },
  { id: 'golemd', base: 'Golem', evo: 'Golden', l4: 'Adept', evoL4: 'Master', type: 'Builder', dp: DP_B, st: ST_B, body: '#7f8f8f', belly: '#c0d0cf', wing: '#9fb0af', evoBody: '#e0b83f', evoBelly: '#fff0b0', evoWing: '#f0cf5f' },
  { id: 'sharpd', base: 'Sharp', evo: 'Sentinel', l4: 'Fierce', evoL4: 'Supreme', type: 'Defender', dp: DP_B, st: ST_A, body: '#5f7f9a', belly: '#c0d8e8', wing: '#7f9fbf', evoBody: '#8f5f4f', evoBelly: '#e8c9b0', evoWing: '#b07f5f', l3: 'Vicious', evoL3: 'Almighty' },
  { id: 'gargoyled', base: 'Gargoyle', evo: 'Beast', l4: 'Fierce', evoL4: 'Supreme', type: 'Defender', dp: DP_B, st: ST_B, body: '#6f6a70', belly: '#a8a4ac', wing: '#88838f', evoBody: '#8f4f3f', evoBelly: '#d8b09f', evoWing: '#a86f4f', l3: 'Vicious', evoL3: 'Almighty' },
  { id: 'natured', base: 'Nature', evo: 'Bloom', l4: 'Bright', evoL4: 'Magnificent', type: 'Harvester', dp: [2, 6, 22, 75, 247, 787, 2400, 7500], st: [6, 6, 6, 6, 6, 7, 9, 10], body: '#5fa84f', belly: '#d8f0b0', wing: '#8fd06f', evoBody: '#e05f9f', evoBelly: '#ffd0e8', evoWing: '#ff8fc0' },
  { id: 'cactusd', base: 'Cactus', evo: 'Prickly', l4: 'Budding', evoL4: 'Blooming', type: 'Trophy', dp: DP_C, st: ST_C, body: '#4f9e6f', belly: '#c9e8b0', wing: '#6fbf8f', evoBody: '#c95f8f', evoBelly: '#ffd0d8', evoWing: '#e08fa8' },
  { id: 'chameleond', base: 'Chameleon', evo: 'Rhampholeon', l4: 'Bloomy', evoL4: 'Glamorous', type: 'Trophy', dp: DP_C, st: ST_C, body: '#6fc94f', belly: '#e0f0a8', wing: '#a8d86f', evoBody: '#c9a03f', evoBelly: '#f0dcaf', evoWing: '#e0bf6f' },
  { id: 'sund', base: 'Sun', evo: 'Aurora', l4: 'Bright', evoL4: 'Magnificent', type: 'Trophy', dp: DP_C, st: ST_C, body: '#ffb03f', belly: '#fff0c0', wing: '#ffd06f', evoBody: '#5fd0c9', evoBelly: '#d8ffff', evoWing: '#8fe8e0' },
  { id: 'moond', base: 'Moon', evo: 'Eclipse', l4: 'Noble', evoL4: 'Royal', type: 'Trophy', dp: DP_C, st: ST_C, body: '#9fa8d0', belly: '#e0e8ff', wing: '#b8c0e8', evoBody: '#4f4762', evoBelly: '#a89fc9', evoWing: '#6f6790' },
  { id: 'stard', base: 'Star', evo: 'Supergiant', l4: 'Luminous', evoL4: 'Hyper', type: 'Trophy', dp: DP_C, st: [5, 6, 7, 8, 9, 10, 12, 14], body: '#ffe07f', belly: '#fffbe0', wing: '#fff0b0', evoBody: '#7f6fe0', evoBelly: '#d8d0ff', evoWing: '#a89fff' },
  { id: 'waterd', base: 'River', evo: 'Rain', l4: 'Grumpy', evoL4: 'Clumsy', type: 'Trophy', dp: DP_C, st: ST_C, body: '#4f9ec9', belly: '#c9ecff', wing: '#7fc0e0', evoBody: '#7f8fa8', evoBelly: '#d8e8f0', evoWing: '#a0b0c9' },
  { id: 'earthd', base: 'Terra', evo: 'Stone', l4: 'Reliable', evoL4: 'Energetic', type: 'Trophy', dp: DP_C, st: ST_C, body: '#8f7f5f', belly: '#e0d0a8', wing: '#b09f7f', evoBody: '#7f7f8f', evoBelly: '#c9c9d8', evoWing: '#9f9fb0' },
  { id: 'lifed', base: 'Life', evo: 'Afterlife', l4: 'Radiant', evoL4: 'Scintillating', type: 'Trophy', dp: [1, 4, 18, 60, 198, 630, 1920, 6000], st: [2, 4, 6, 8, 8, 8, 9, 10], body: '#7fe0a8', belly: '#e0ffe8', wing: '#a8f0c9', evoBody: '#c9d0ff', evoBelly: '#f0f4ff', evoWing: '#e0e8ff', evoL3: 'Glowing', evoNoDragonWord: true },
  { id: 'prismd', base: 'Prism', evo: 'Spectrum', l4: 'Grand', evoL4: 'Opulent', type: 'Trophy', dp: [1, 4, 18, 60, 195, 650, 2080, 6500], st: ST_A, body: '#c07fff', belly: '#f0d8ff', wing: '#d8a8ff', evoBody: '#ff7fc9', evoBelly: '#ffd8f0', evoWing: '#ffa8dc', birthling: true },
  { id: 'rosed', base: 'Rose', evo: 'Blossom', l4: 'Vibrant', evoL4: 'Eternal', type: 'Trophy', dp: DP_C, st: ST_C, body: '#d04f6f', belly: '#ffd0d8', wing: '#e88f9f', evoBody: '#ff9fc0', evoBelly: '#fff0f4', evoWing: '#ffc0d8' },
];

for (const b of BREEDS) {
  const DP = b.dp, STAM = b.st;
  // Whelp / Kid, or Birthling / Kid for the breeds the wiki names that way.
  const young = b.birthling ? 'Birthling' : 'Whelp';
  // Level 3 is usually the bare breed name; Sharp and Gargoyle prefix it.
  const l3 = b.l3 ? `${b.l3} ${b.base} Dragon` : `${b.base} Dragon`;
  const evoL3 = b.evoL3 ? `${b.evoL3} ${b.evo} Dragon` : `${b.evo} Dragon`;
  // Life Dragons evolve into "Afterlife Eggs", not "Afterlife Dragon Eggs".
  const evoEgg = b.evoNoDragonWord ? `${b.evo} Egg` : `${b.evo} Dragon Egg`;
  const evoNest = b.evoNoDragonWord ? `Nest of ${b.evo} Eggs` : `Nest of ${b.evo} Dragon Eggs`;
  const evoYoung = b.birthling ? `${b.evo} ${young}` : `${b.evo} Dragon ${young}`;
  const evoKid = b.birthling ? `${b.evo} Kid` : `${b.evo} Dragon Kid`;
  const rows = [
    { n: `Nest of ${b.base} Dragon Eggs`, lv: 0, r: 'uncommon', w: 25, d: 'Tap to hatch the eggs!', art: 'nest', tint: b.body, nest: 1 },
    { n: `${b.base} Dragon Egg`, lv: 0, r: 'uncommon', w: 1, d: 'Merge 3 to hatch a Dragon Whelp.', art: 'egg', tint: b.body },
    { n: `${b.base} Dragon ${young}`, lv: 1, w: 20, d: `Dragon Power ${DP[0]}. Harvests nearby objects.`, art: 'dragon', tint: b.body, dragon: { breed: b.id, stage: 0, dp: DP[0], stamina: STAM[0] } },
    { n: `${b.base} Dragon Kid`, lv: 2, w: 50, d: `Dragon Power ${DP[1]}.`, art: 'dragon', tint: b.body, dragon: { breed: b.id, stage: 1, dp: DP[1], stamina: STAM[1] } },
    { n: l3, lv: 3, w: 100, d: `Dragon Power ${DP[2]}.`, art: 'dragon', tint: b.body, dragon: { breed: b.id, stage: 2, dp: DP[2], stamina: STAM[2] } },
    { n: `${b.l4} ${b.base} Dragon`, lv: 4, r: 'uncommon', w: 250, d: `Dragon Power ${DP[3]}. Merge 3 for a ${evoNest}.`, art: 'dragon', tint: b.body, dragon: { breed: b.id, stage: 3, dp: DP[3], stamina: STAM[3] } },
    { n: evoNest, lv: 0, r: 'rare', w: 25, d: 'Tap to hatch the eggs!', art: 'nest', tint: b.evoBody, nest: 2 },
    { n: evoEgg, lv: 0, r: 'epic', w: 1, d: 'Merge 3 to hatch a Dragon Whelp.', art: 'egg', tint: b.evoBody },
    { n: evoYoung, lv: 7, r: 'rare', w: 500, d: `Dragon Power ${DP[4]}.`, art: 'dragon', tint: b.evoBody, dragon: { breed: b.id, stage: 4, dp: DP[4], stamina: STAM[4] } },
    { n: evoKid, lv: 8, r: 'rare', w: 1000, d: `Dragon Power ${DP[5]}.`, art: 'dragon', tint: b.evoBody, dragon: { breed: b.id, stage: 5, dp: DP[5], stamina: STAM[5] } },
    { n: evoL3, lv: 9, r: 'rare', w: 2500, d: `Dragon Power ${DP[6]}.`, art: 'dragon', tint: b.evoBody, dragon: { breed: b.id, stage: 6, dp: DP[6], stamina: STAM[6] } },
    { n: `${b.evoL4} ${b.evo} Dragon`, lv: 10, r: 'epic', w: 5000, d: `Dragon Power ${DP[7]}.`, art: 'dragon', tint: b.evoBody, dragon: { breed: b.id, stage: 7, dp: DP[7], stamina: STAM[7] } },
  ];
  const c = chain(b.id, `${b.base} Dragons`, 'dragon', b.body, rows);
  // carry the extra fields chain() does not know about
  rows.forEach((r, i) => {
    if (r.dragon) c.items[i].dragon = { ...r.dragon, breedRef: b, type: b.type };
    if (r.nest) {
      // Nests are tap-to-hatch containers -- they do NOT merge (wiki).
      c.items[i].nest = r.nest;
      c.items[i].unmergeable = true;
      c.items[i].hatch = { egg: c.items[i + 1].key, min: r.nest === 1 ? 3 : 4, max: 7 };
    }
    c.items[i].breedRef = b;
  });
  c.isDragon = true;
  reg(c);
}

// ---------------------------------------------------------------------------
// lookup
// ---------------------------------------------------------------------------
export const ITEMS = {};
for (const c of Object.values(CHAINS)) for (const it of c.items) ITEMS[it.key] = it;

// ---------------------------------------------------------------------------
// Dimensional Jar gem prices, transcribed from the "Jar Cost (Gems)" column of
// each chain's own wiki table. Only the chains the wiki's Dimensional Jar page
// lists as jar-spawning carry a price, and only from the level it names.
// The ladder is forced non-decreasing: a couple of the published tables use
// row-spanning cells that make a lower tier read higher than its neighbour.
// ---------------------------------------------------------------------------
const JAR_GEMS = {
  lifeFlower: { 6: 15, 7: 24, 8: 30, 9: 90, 10: 120, 11: 150, 12: 180, 13: 210, 14: 240, 15: 270, 16: 300, 17: 600 },
  lifeOrb: { 6: 8, 7: 11, 8: 45, 9: 75 },
  grass: { 6: 30, 7: 75, 8: 135, 9: 420 },
  stone: { 5: 45, 6: 60, 7: 75, 8: 165, 9: 375, 10: 300 },
  dragonTree: { 5: 8, 6: 11, 7: 23, 8: 75, 9: 150, 10: 240, 11: 300, 12: 450 },
  fruitTree: { 5: 8, 6: 11, 7: 23, 8: 30, 9: 60, 10: 105, 11: 240, 12: 450 },
  prism: { 5: 15, 6: 21, 7: 60, 8: 150, 9: 240, 10: 300 },
  chest: { 4: 5, 5: 6, 6: 8 },
  water: { 4: 11, 5: 18, 6: 105, 7: 210, 8: 300 },
  mushroom: { 7: 18, 8: 24, 9: 60, 10: 150, 11: 300 },
  bush: { 4: 90, 5: 180 },
  grave: { 3: 45, 4: 75, 5: 105, 6: 150, 7: 210 },
  hill: { 5: 24, 6: 45, 7: 90, 8: 150, 9: 180, 10: 225 },
  home: { 4: 150, 5: 195, 6: 240, 7: 450 },
  magicShroom: { 6: 18, 7: 24, 8: 60, 9: 150, 10: 300 },
  midasTree: { 2: 8, 3: 15, 4: 27, 5: 36, 6: 75, 7: 150, 8: 240, 9: 375, 10: 450, 11: 525, 12: 600 },
  glowTree: { 4: 75, 5: 150, 6: 240, 7: 300, 8: 450 },
  grimmTree: { 5: 20, 6: 27, 7: 45, 8: 75, 9: 120, 10: 240 },
  shadowTree: { 5: 23, 6: 75, 7: 90, 8: 150, 9: 240, 10: 300 },
  honey: { 3: 11, 4: 23, 5: 30, 6: 60, 7: 105, 8: 240, 9: 450 },
  mysticTopiary: { 1: 90, 2: 225, 3: 550 },
  lobeliaTopiary: { 1: 90, 2: 225, 3: 550 },
};
for (const [cid, rows] of Object.entries(JAR_GEMS)) {
  const c = CHAINS[cid];
  if (!c) continue;
  let last = 0;
  for (const it of c.items) {
    const v = rows[it.idx];
    if (v === undefined) continue;
    last = Math.max(last, v);
    it.jarGems = last;
  }
}
// Tier-2 dragon nests can appear in jars too ("Any Tier 2 Dragon Nests").
for (const b of BREEDS) {
  const nest2 = CHAINS[b.id].items[6];
  if (nest2) nest2.jarGems = 450;
}

export function def(key) { return ITEMS[key] || null; }
export function next(key) {
  const it = ITEMS[key];
  if (!it) return null;
  const c = CHAINS[it.chain];
  // dragons: level-4 (index 5) merges into the tier-2 NEST (index 6)
  return c.items[it.idx + 1] || null;
}
export function isMergeable(key) {
  const it = ITEMS[key];
  if (!it || it.unmergeable) return false;
  return !!next(key);
}
export function chainOf(key) { return CHAINS[ITEMS[key].chain]; }

// convenience: keys of all dragon eggs / nests
export const DRAGON_CHAINS = BREEDS.map((b) => b.id);
