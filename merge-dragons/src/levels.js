// levels.js -- level definitions, quest objectives, star rating, world map.
//
// Region names are the wiki's World Map regions in map order (Intro, Grassy,
// Haven, Outskirts, Grove, Quarry, Hilltop, Zomblin Falls, Fear Isle, Silent
// Bay, Sun Veldt, Shroomia, Dread Marsh, Prism Rift, Totem Shire, Drakeshire...).
// Most levels' End Goal is merging Gaia Statues, as in the real game. Each level
// carries three quests; each completed quest awards a Goal Star (5% Dragon Star).

import { Board, Obj, DEAD, SUPER, LIVE, SUPER_COST } from './board.js';
import { def, CHAINS } from './registry.js';

function mulberry(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// objectives
// ---------------------------------------------------------------------------
export const OBJ = {
  heal: (n) => ({ type: 'heal', n, label: `Heal ${n} pieces of land`, prog: (g) => g.board.liveTiles() - g.level.startLive, target: n }),
  healAll: () => ({ type: 'healAll', label: 'Heal all the land', prog: (g) => g.board.totalTiles() - g.board.deadTiles(), target: -1, dyn: (g) => g.board.totalTiles() }),
  create: (key, n = 1) => ({ type: 'create', key, n, label: `Create ${n > 1 ? n + ' ' : ''}${def(key).name}${n > 1 ? 's' : ''}`, prog: (g) => g.made[key] || 0, target: n }),
  tier: (chain, idx) => ({ type: 'tier', chain, idx, label: `Create a ${CHAINS[chain].items[idx].name}`, prog: (g) => (g.board.maxTier(chain) >= idx ? 1 : 0), target: 1 }),
  coins: (n) => ({ type: 'coins', n, label: `Collect ${n} Coins`, prog: (g) => g.level.coins, target: n }),
  bricks: (n) => ({ type: 'bricks', n, label: `Collect ${n} Stone Bricks`, prog: (g) => g.level.bricks, target: n }),
  merges: (n) => ({ type: 'merges', n, label: `Make ${n} merges`, prog: (g) => g.level.merges, target: n }),
  merge5: (n) => ({ type: 'merge5', n, label: `Make ${n} 5-merges`, prog: (g) => g.level.merge5, target: n }),
  harvest: (n) => ({ type: 'harvest', n, label: `Harvest ${n} times`, prog: (g) => g.level.harvests, target: n }),
  dragons: (n) => ({ type: 'dragons', n, label: `Have ${n} dragons`, prog: (g) => g.dragons.count(), target: n }),
  power: (n) => ({ type: 'power', n, label: `Reach ${n} Dragon Power`, prog: (g) => g.dragons.totalPower(), target: n }),
  slay: (n) => ({ type: 'slay', n, label: `Defeat ${n} Zomblins`, prog: (g) => g.level.slain, target: n }),
  gates: () => ({ type: 'gates', label: 'Destroy every Demon Gate', prog: (g) => g.level.gatesStart - g.board.objs.filter((o) => o.d.chain === 'gate').length, target: -1, dyn: (g) => g.level.gatesStart }),
  extenders: (n) => ({ type: 'extenders', n, label: `Activate ${n} Heal Extenders`, prog: (g) => g.level.extenders, target: n }),
};

// ---------------------------------------------------------------------------
// board painting helpers used by level specs
// ---------------------------------------------------------------------------
function shapeBlob(board, rnd, fill = 0.86) {
  const cx = (board.cols - 1) / 2, cy = (board.rows - 1) / 2;
  const rx = board.cols * 0.52, ry = board.rows * 0.54;
  const wob = [];
  for (let i = 0; i < 8; i++) wob.push(0.78 + rnd() * 0.34);
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const dx = (x - cx) / rx, dy = (y - cy) / ry;
      const a = Math.atan2(dy, dx);
      const k = wob[((Math.floor(((a + Math.PI) / (Math.PI * 2)) * 8) % 8) + 8) % 8];
      const d = Math.hypot(dx, dy) / (k * fill + 0.16);
      board.playable[board.idx(x, y)] = d <= 1 ? 1 : 0;
    }
  }
  // guarantee a connected core
  for (let y = 1; y < board.rows - 1; y++) for (let x = 1; x < board.cols - 1; x++) board.playable[board.idx(x, y)] = 1;
}

function makeDead(board, baseCost, rnd) {
  for (let i = 0; i < board.land.length; i++) {
    if (!board.playable[i]) continue;
    board.land[i] = DEAD;
    board.cost[i] = Math.round(baseCost * (0.6 + rnd() * 0.9));
    board.paid[i] = 0;
  }
}

function healRegion(board, cx, cy, r) {
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      if (!board.playable[board.idx(x, y)]) continue;
      if (Math.hypot(x - cx, y - cy) <= r) { board.land[board.idx(x, y)] = LIVE; board.paid[board.idx(x, y)] = board.cost[board.idx(x, y)]; }
    }
  }
}

function superPatch(board, cx, cy, r) {
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const i = board.idx(x, y);
      if (!board.playable[i] || board.land[i] === LIVE) continue;
      if (Math.hypot(x - cx, y - cy) <= r) { board.land[i] = SUPER; board.cost[i] = SUPER_COST; }
    }
  }
}

// Scatter `n` copies of `key` in the level, on any playable cell.
function scatter(board, key, n, rnd, opts = {}) {
  const d = def(key);
  if (!d) return;
  let placed = 0, guard = 0;
  while (placed < n && guard++ < 900) {
    const x = Math.floor(rnd() * board.cols), y = Math.floor(rnd() * board.rows);
    if (opts.live && !board.isLive(x, y)) continue;
    if (opts.dead && board.isLive(x, y)) continue;
    if (!board.fits({ w: d.size[0], h: d.size[1] }, x, y)) continue;
    let ok = true;
    for (let j = 0; j < d.size[1] && ok; j++) for (let i = 0; i < d.size[0]; i++) if (!board.isPlayable(x + i, y + j)) ok = false;
    if (!ok) continue;
    const o = board.spawn(key, x, y);
    o.born = -100;
    o.lastHarvest = -100;
    if (opts.hidden && !board.isLive(x, y)) o.hidden = true;
    placed++;
  }
}

// A tight cluster so the player has an immediate merge available.
function cluster(board, key, n, rnd, opts = {}) {
  const d = def(key);
  let guard = 0;
  while (guard++ < 400) {
    const x = 1 + Math.floor(rnd() * (board.cols - 2));
    const y = 1 + Math.floor(rnd() * (board.rows - 2));
    if (opts.live && !board.isLive(x, y)) continue;
    const spots = [];
    for (let dy = -1; dy <= 1 && spots.length < n; dy++) {
      for (let dx = -1; dx <= 1 && spots.length < n; dx++) {
        const nx = x + dx, ny = y + dy;
        if (!board.isPlayable(nx, ny)) continue;
        if (opts.live && !board.isLive(nx, ny)) continue;
        if (board.at(nx, ny)) continue;
        if (d.size[0] > 1 || d.size[1] > 1) { if (!board.fits({ w: d.size[0], h: d.size[1] }, nx, ny)) continue; }
        spots.push([nx, ny]);
      }
    }
    if (spots.length < n) continue;
    for (const [sx, sy] of spots.slice(0, n)) {
      const o = board.spawn(key, sx, sy);
      o.born = -100; o.lastHarvest = -100;
    }
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// level specs
// ---------------------------------------------------------------------------
const anyDragon = () => ['grassd', 'greend', 'rockd', 'crimsond', 'spottedd', 'toadstoold'];

export const LEVELS = [
  {
    id: 1, name: 'Grassy 1', region: 'Grassy', chalices: 1, cols: 9, rows: 8, seed: 1011,
    blurb: 'The land is grey and still. Bring it back.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.9); makeDead(b, 8, rnd); healRegion(b, 4, 4, 2.4);
      cluster(b, 'lifeFlower:1', 5, rnd, { live: true });
      cluster(b, 'lifeFlower:1', 3, rnd, { live: true });
      cluster(b, 'grass:1', 3, rnd, { live: true });
      cluster(b, 'grassd:1', 3, rnd, { live: true });
      cluster(b, 'lifeFlower:2', 3, rnd, { live: true });
      cluster(b, 'fruitTree:0', 3, rnd, { live: true });
      scatter(b, 'grassd:2', 1, rnd, { live: true });
      scatter(b, 'grass:2', 2, rnd, { live: true });
      scatter(b, 'lifeOrb:2', 2, rnd, { live: true });
      scatter(b, 'coin:0', 2, rnd, { live: true });
      scatter(b, 'lifeFlower:1', 6, rnd, { hidden: true });
      scatter(b, 'lifeOrb:1', 4, rnd, { hidden: true });
      scatter(b, 'bramble:0', 3, rnd);
      cluster(b, 'gaia:0', 3, rnd, {});
      scatter(b, 'grassd:1', 3, rnd, { hidden: true });
    },
    end: OBJ.create('gaia:1'),
    quests: [OBJ.heal(14), OBJ.tier('lifeFlower', 4), OBJ.merges(8)],
    rewards: ['lifeFlower:2', 'grass:1', 'coin:1'],
  },
  {
    id: 2, name: 'Grassy 3', region: 'Grassy', chalices: 1, cols: 10, rows: 9, seed: 2022,
    blurb: 'Dragon eggs sleep under the dead land.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.9); makeDead(b, 10, rnd); healRegion(b, 5, 4, 2.2);
      cluster(b, 'lifeFlower:1', 5, rnd, { live: true });
      cluster(b, 'grassd:1', 3, rnd, { live: true });
      cluster(b, 'lifeFlower:2', 3, rnd, { live: true });
      scatter(b, 'lifeFlower:1', 8, rnd, { hidden: true });
      scatter(b, 'grassd:1', 4, rnd, { hidden: true });
      scatter(b, 'lifeOrb:2', 3, rnd, { hidden: true });
      scatter(b, 'chest:0', 2, rnd, { hidden: true });
      scatter(b, 'bramble:1', 2, rnd);
      cluster(b, 'gaia:0', 3, rnd, {});
      scatter(b, 'home:0', 1, rnd, { hidden: true });
    },
    end: OBJ.create('gaia:1'),
    quests: [OBJ.heal(20), OBJ.dragons(2), OBJ.tier('lifeFlower', 5)],
    rewards: ['grassd:1', 'lifeFlower:3', 'home:0'],
  },
  {
    id: 3, name: 'Haven 2', region: 'Haven', chalices: 1, cols: 11, rows: 9, seed: 3033,
    blurb: 'Grass and stone, and a dragon to work them.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.92); makeDead(b, 12, rnd); healRegion(b, 5, 4, 2.6);
      cluster(b, 'grass:1', 5, rnd, { live: true });
      cluster(b, 'lifeFlower:1', 5, rnd, { live: true });
      cluster(b, 'stone:0', 3, rnd, { live: true });
      cluster(b, 'greend:1', 3, rnd, { live: true });
      scatter(b, 'grass:1', 8, rnd, { hidden: true });
      scatter(b, 'stone:0', 5, rnd, { hidden: true });
      scatter(b, 'lifeOrb:2', 4, rnd, { hidden: true });
      scatter(b, 'lifeFlower:2', 5, rnd, { hidden: true });
      scatter(b, 'bramble:0', 4, rnd);
      cluster(b, 'gaia:0', 3, rnd, {});
    },
    end: OBJ.create('gaia:1'),
    quests: [OBJ.tier('grass', 4), OBJ.bricks(12), OBJ.heal(26)],
    rewards: ['grass:2', 'stone:1', 'chest:0'],
  },
  {
    id: 4, name: 'Outskirts 5', region: 'Outskirts', chalices: 2, cols: 11, rows: 10, seed: 4044,
    blurb: 'Zomblins have been busy here.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.9); makeDead(b, 16, rnd); healRegion(b, 5, 5, 2.4);
      superPatch(b, 2, 2, 1.6);
      cluster(b, 'lifeFlower:2', 5, rnd, { live: true });
      cluster(b, 'toadstoold:1', 3, rnd, { live: true });
      cluster(b, 'grave:0', 3, rnd, {});
      scatter(b, 'zomblin:0', 3, rnd, { hidden: true });
      scatter(b, 'lifeFlower:1', 9, rnd, { hidden: true });
      scatter(b, 'lifeOrb:3', 3, rnd, { hidden: true });
      scatter(b, 'bone:0', 4, rnd, { hidden: true });
      scatter(b, 'bramble:1', 3, rnd);
      scatter(b, 'healext:0', 2, rnd);
      cluster(b, 'gaia:0', 5, rnd, {});
    },
    end: OBJ.create('gaia:1'),
    quests: [OBJ.slay(3), OBJ.heal(30), OBJ.merge5(2)],
    rewards: ['toadstoold:1', 'grave:1', 'lifeOrb:3'],
  },
  {
    id: 5, name: 'Quarry 3', region: 'Quarry', chalices: 2, cols: 11, rows: 10, seed: 5055,
    blurb: 'Stone country. Bring bricks home.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.92); makeDead(b, 18, rnd); healRegion(b, 5, 5, 2.8);
      cluster(b, 'stone:0', 5, rnd, { live: true });
      cluster(b, 'stone:1', 3, rnd, { live: true });
      cluster(b, 'rockd:1', 3, rnd, { live: true });
      cluster(b, 'grass:2', 5, rnd, { live: true });
      scatter(b, 'stone:0', 10, rnd, { hidden: true });
      scatter(b, 'stone:2', 3, rnd, { hidden: true });
      scatter(b, 'lifeFlower:2', 8, rnd, { hidden: true });
      scatter(b, 'lifeOrb:3', 4, rnd, { hidden: true });
      scatter(b, 'brick:0', 5, rnd, { hidden: true });
      scatter(b, 'hill:0', 4, rnd, { hidden: true });
      cluster(b, 'gaia:0', 3, rnd, {});
    },
    end: OBJ.create('gaia:1'),
    quests: [OBJ.tier('stone', 4), OBJ.bricks(60), OBJ.harvest(10)],
    rewards: ['stone:2', 'brick:2', 'rockd:1'],
  },
  {
    id: 6, name: 'Hilltop Bluffs', region: 'Hilltop', chalices: 2, cols: 12, rows: 10, seed: 6066,
    blurb: 'Fruit tree leaves drift on the wind.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.92); makeDead(b, 20, rnd); healRegion(b, 6, 5, 3);
      cluster(b, 'fruitTree:0', 5, rnd, { live: true });
      cluster(b, 'fruitTree:0', 5, rnd, { live: true });
      cluster(b, 'lifeFlower:2', 5, rnd, { live: true });
      cluster(b, 'hill:1', 3, rnd, { live: true });
      cluster(b, 'spottedd:1', 3, rnd, { live: true });
      scatter(b, 'fruitTree:1', 6, rnd, { hidden: true });
      scatter(b, 'skull:0', 3, rnd, { hidden: true });
      scatter(b, 'lifeOrb:3', 5, rnd, { hidden: true });
      scatter(b, 'lifeFlower:3', 5, rnd, { hidden: true });
      scatter(b, 'coin:1', 5, rnd, { hidden: true });
      cluster(b, 'gaia:0', 5, rnd, {});
    },
    end: OBJ.create('gaia:1'),
    quests: [OBJ.tier('fruitTree', 4), OBJ.coins(150), OBJ.heal(38)],
    rewards: ['fruitTree:3', 'coin:3', 'chest:1'],
  },
  {
    id: 7, name: 'Zomblin Falls 2', region: 'Zomblin Falls', chalices: 3, cols: 12, rows: 11, seed: 7077,
    blurb: 'A Demon Gate festers at the heart of it.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.9); makeDead(b, 24, rnd); healRegion(b, 6, 6, 2.6);
      superPatch(b, 9, 2, 2); superPatch(b, 2, 8, 1.6);
      cluster(b, 'lifeFlower:3', 5, rnd, { live: true });
      cluster(b, 'crimsond:1', 3, rnd, { live: true });
      cluster(b, 'toadstoold:1', 5, rnd, { live: true });
      scatter(b, 'gate:0', 2, rnd, {});
      scatter(b, 'zomblin:1', 4, rnd, { hidden: true });
      scatter(b, 'grave:1', 3, rnd, { hidden: true });
      scatter(b, 'lifeOrb:4', 4, rnd, { hidden: true });
      scatter(b, 'lifeFlower:2', 10, rnd, { hidden: true });
      scatter(b, 'healext:0', 3, rnd);
      scatter(b, 'bramble:1', 4, rnd);
      cluster(b, 'gaia:0', 5, rnd, {});
    },
    end: OBJ.gates(),
    quests: [OBJ.slay(4), OBJ.create('gaia:1'), OBJ.extenders(2)],
    rewards: ['crimsond:1', 'lifeOrb:4', 'chest:2'],
  },
  {
    id: 8, name: 'Silent Bay 2', region: 'Silent Bay', chalices: 2, cols: 12, rows: 11, seed: 8088,
    blurb: 'Water pools where the land remembers rain.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.92); makeDead(b, 22, rnd); healRegion(b, 6, 5, 3);
      cluster(b, 'water:0', 5, rnd, { live: true });
      cluster(b, 'water:1', 3, rnd, { live: true });
      cluster(b, 'lifeFlower:2', 5, rnd, { live: true });
      cluster(b, 'greend:1', 5, rnd, { live: true });
      scatter(b, 'water:0', 8, rnd, { hidden: true });
      scatter(b, 'mushroom:0', 6, rnd, { hidden: true });
      scatter(b, 'lifeOrb:3', 5, rnd, { hidden: true });
      scatter(b, 'grass:1', 8, rnd, { hidden: true });
      scatter(b, 'chest:1', 2, rnd, { hidden: true });
      cluster(b, 'gaia:0', 3, rnd, {});
    },
    end: OBJ.create('gaia:2'),
    quests: [OBJ.tier('water', 4), OBJ.tier('mushroom', 3), OBJ.heal(44)],
    rewards: ['water:3', 'mushroom:2', 'greend:2'],
  },
  {
    id: 9, name: 'Shroomia 4', region: 'Shroomia', chalices: 3, cols: 12, rows: 11, seed: 9099,
    blurb: 'Everything here has spores.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.92); makeDead(b, 26, rnd); healRegion(b, 6, 6, 2.8);
      cluster(b, 'mushroom:0', 5, rnd, { live: true });
      cluster(b, 'mushroom:1', 5, rnd, { live: true });
      cluster(b, 'bush:0', 5, rnd, { live: true });
      cluster(b, 'toadstoold:1', 5, rnd, { live: true });
      scatter(b, 'mushroom:0', 10, rnd, { hidden: true });
      scatter(b, 'lifeFlower:3', 8, rnd, { hidden: true });
      scatter(b, 'lifeOrb:4', 5, rnd, { hidden: true });
      scatter(b, 'bramble:2', 2, rnd);
      cluster(b, 'gaia:0', 5, rnd, {});
    },
    end: OBJ.create('gaia:2'),
    quests: [OBJ.tier('mushroom', 5), OBJ.tier('bush', 4), OBJ.merge5(4)],
    rewards: ['mushroom:4', 'bush:3', 'toadstoold:3'],
  },
  {
    id: 10, name: 'Dread Marsh 3', region: 'Dread Marsh', chalices: 3, cols: 13, rows: 11, seed: 10101,
    blurb: 'Grass grows tall on rot. Take the tufts home.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.9); makeDead(b, 30, rnd); healRegion(b, 6, 6, 2.6);
      superPatch(b, 10, 8, 2);
      cluster(b, 'grass:1', 5, rnd, { live: true });
      cluster(b, 'grass:2', 5, rnd, { live: true });
      cluster(b, 'grave:1', 3, rnd, {});
      cluster(b, 'lifeFlower:3', 5, rnd, { live: true });
      scatter(b, 'grass:2', 10, rnd, { hidden: true });
      scatter(b, 'prism:0', 6, rnd, { hidden: true });
      scatter(b, 'zomblin:2', 3, rnd, { hidden: true });
      scatter(b, 'lifeOrb:5', 4, rnd, { hidden: true });
      scatter(b, 'healext:0', 3, rnd);
      cluster(b, 'gaia:0', 5, rnd, {});
    },
    end: OBJ.create('gaia:2'),
    quests: [OBJ.tier('grass', 6), OBJ.tier('prism', 3), OBJ.slay(3)],
    rewards: ['grass:5', 'prism:2', 'chest:3'],
  },
  {
    id: 11, name: 'Prism Rift 1', region: 'Prism Rift', chalices: 4, cols: 13, rows: 12, seed: 11111,
    blurb: 'Rainbow flowers grow where nothing else will.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.92); makeDead(b, 40, rnd); healRegion(b, 6, 6, 2.6);
      superPatch(b, 2, 2, 1.8); superPatch(b, 11, 10, 1.8);
      cluster(b, 'prism:0', 5, rnd, { live: true });
      cluster(b, 'prism:1', 5, rnd, { live: true });
      cluster(b, 'lifeFlower:4', 5, rnd, { live: true });
      cluster(b, 'crimsond:1', 5, rnd, { live: true });
      scatter(b, 'prism:0', 10, rnd, { hidden: true });
      scatter(b, 'lifeOrb:5', 6, rnd, { hidden: true });
      scatter(b, 'dragonTree:0', 6, rnd, { hidden: true });
      scatter(b, 'healext:0', 4, rnd);
      scatter(b, 'bramble:1', 5, rnd);
      cluster(b, 'gaia:0', 5, rnd, {});
    },
    end: OBJ.create('gaia:2'),
    quests: [OBJ.tier('prism', 5), OBJ.healAll(), OBJ.tier('dragonTree', 3)],
    rewards: ['prism:4', 'dragonTree:2', 'lifeOrb:5'],
  },
  {
    id: 12, name: 'Totem Shire 2', region: 'Totem Shire', chalices: 4, cols: 13, rows: 12, seed: 12121,
    blurb: 'Fruit trees as far as the eye can see.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.93); makeDead(b, 44, rnd); healRegion(b, 6, 6, 3);
      cluster(b, 'fruitTree:1', 5, rnd, { live: true });
      cluster(b, 'fruitTree:2', 5, rnd, { live: true });
      cluster(b, 'hill:1', 5, rnd, { live: true });
      cluster(b, 'spottedd:1', 5, rnd, { live: true });
      scatter(b, 'fruitTree:0', 10, rnd, { hidden: true });
      scatter(b, 'skull:1', 5, rnd, { hidden: true });
      scatter(b, 'lifeOrb:5', 6, rnd, { hidden: true });
      scatter(b, 'coin:2', 8, rnd, { hidden: true });
      scatter(b, 'chest:2', 3, rnd, { hidden: true });
      cluster(b, 'gaia:0', 5, rnd, {});
    },
    end: OBJ.create('gaia:3'),
    quests: [OBJ.tier('fruitTree', 6), OBJ.tier('hill', 4), OBJ.coins(900)],
    rewards: ['fruitTree:5', 'hill:3', 'coin:4'],
  },
  {
    id: 13, name: 'Drakeshire 2', region: 'Drakeshire', chalices: 5, cols: 14, rows: 12, seed: 13131,
    blurb: 'Dragon trees remember Bahamut.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.93); makeDead(b, 55, rnd); healRegion(b, 7, 6, 3);
      superPatch(b, 12, 2, 2);
      cluster(b, 'dragonTree:0', 5, rnd, { live: true });
      cluster(b, 'dragonTree:1', 5, rnd, { live: true });
      cluster(b, 'dragonTree:2', 5, rnd, { live: true });
      cluster(b, 'lifeFlower:5', 5, rnd, { live: true });
      cluster(b, 'rockd:1', 5, rnd, { live: true });
      scatter(b, 'dragonTree:0', 10, rnd, { hidden: true });
      scatter(b, 'lifeOrb:6', 5, rnd, { hidden: true });
      scatter(b, 'essence:0', 6, rnd, { hidden: true });
      scatter(b, 'gate:1', 1, rnd, {});
      scatter(b, 'zomblin:3', 2, rnd, { hidden: true });
      scatter(b, 'healext:0', 4, rnd);
      cluster(b, 'gaia:0', 5, rnd, {});
    },
    end: OBJ.create('gaia:3'),
    quests: [OBJ.tier('dragonTree', 6), OBJ.gates(), OBJ.power(120)],
    rewards: ['dragonTree:5', 'essence:2', 'chest:4'],
  },
  {
    id: 14, name: 'Craven Crypt 17', region: 'Craven Crypt', chalices: 6, cols: 14, rows: 13, seed: 14141,
    blurb: 'The longest chain in the world starts with one sprout.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.94); makeDead(b, 70, rnd); healRegion(b, 7, 7, 3);
      superPatch(b, 2, 2, 2); superPatch(b, 12, 11, 2);
      cluster(b, 'lifeFlower:4', 5, rnd, { live: true });
      cluster(b, 'lifeFlower:5', 5, rnd, { live: true });
      cluster(b, 'lifeFlower:6', 5, rnd, { live: true });
      cluster(b, 'grave:2', 5, rnd, {});
      cluster(b, 'toadstoold:2', 5, rnd, { live: true });
      scatter(b, 'lifeFlower:3', 12, rnd, { hidden: true });
      scatter(b, 'lifeOrb:6', 6, rnd, { hidden: true });
      scatter(b, 'bone:0', 8, rnd, { hidden: true });
      scatter(b, 'zomblin:2', 4, rnd, { hidden: true });
      scatter(b, 'healext:0', 5, rnd);
      scatter(b, 'bramble:2', 3, rnd);
      cluster(b, 'gaia:0', 5, rnd, {});
    },
    end: OBJ.create('gaia:3'),
    quests: [OBJ.tier('lifeFlower', 8), OBJ.healAll(), OBJ.merge5(8)],
    rewards: ['lifeFlower:7', 'lifeOrb:6', 'chest:5'],
  },
  {
    id: 15, name: 'Spell Shore 17', region: 'Spell Shore', chalices: 7, cols: 15, rows: 13, seed: 15151,
    blurb: 'Everything at once. Show what you have learned.',
    build(b, rnd) {
      shapeBlob(b, rnd, 0.95); makeDead(b, 90, rnd); healRegion(b, 7, 6, 3.2);
      superPatch(b, 2, 10, 2.2); superPatch(b, 13, 2, 2.2);
      cluster(b, 'lifeFlower:6', 5, rnd, { live: true });
      cluster(b, 'prism:3', 5, rnd, { live: true });
      cluster(b, 'dragonTree:3', 5, rnd, { live: true });
      cluster(b, 'fruitTree:3', 5, rnd, { live: true });
      cluster(b, 'stone:3', 5, rnd, { live: true });
      cluster(b, 'crimsond:2', 5, rnd, { live: true });
      cluster(b, 'grassd:2', 5, rnd, { live: true });
      scatter(b, 'lifeOrb:7', 6, rnd, { hidden: true });
      scatter(b, 'dstar:0', 2, rnd, { hidden: true });
      scatter(b, 'gate:2', 1, rnd, {});
      scatter(b, 'zomblin:3', 4, rnd, { hidden: true });
      scatter(b, 'healext:0', 6, rnd);
      scatter(b, 'chest:3', 3, rnd, { hidden: true });
      cluster(b, 'gaia:0', 5, rnd, {});
      cluster(b, 'gaia:1', 3, rnd, {});
    },
    end: OBJ.create('gaia:3'),
    quests: [OBJ.tier('lifeFlower', 9), OBJ.gates(), OBJ.healAll()],
    rewards: ['lifeFlower:8', 'prism:5', 'dstar:0'],
  },
];

// World-map node positions (fraction of the map canvas). A zigzag up the map so
// neighbouring islands never overlap their labels.
export const MAP_NODES = LEVELS.map((L, i) => {
  const t = i / (LEVELS.length - 1);
  return {
    id: L.id,
    x: 0.065 + t * 0.87,
    y: 0.74 - t * 0.40 + (i % 2 ? -0.115 : 0.115),
  };
});

export function buildLevel(spec) {
  const b = new Board(spec.cols, spec.rows);
  const rnd = mulberry(spec.seed);
  spec.build(b, rnd);
  return b;
}

/** Camp board: a big persistent island, mostly under Evil Fog. */
export function buildCamp(save) {
  const b = new Board(18, 14);
  const rnd = mulberry(4242);
  shapeBlob(b, rnd, 0.97);
  makeDead(b, 26, rnd);
  healRegion(b, 9, 7, 3.2);
  // Evil Fog covers the outer camp until Dragon Power reveals it (wiki: two gates).
  for (let y = 0; y < b.rows; y++) {
    for (let x = 0; x < b.cols; x++) {
      const i = b.idx(x, y);
      if (!b.playable[i]) continue;
      const d = Math.hypot(x - 8.5, y - 6.5);
      b.fog = b.fog || new Float32Array(b.cols * b.rows);
      // fog threshold in dragon power
      b.fog[i] = d <= 3.4 ? 0 : Math.round(Math.pow(d - 3.0, 2.1) * 6);
    }
  }
  if (!b.fog) b.fog = new Float32Array(b.cols * b.rows);
  return b;
}

export const CAMP_STARTERS = [
  ['lifeFlower:1', 3], ['lifeFlower:2', 2], ['grass:1', 3],
  ['grassd:1', 3], ['home:0', 1], ['stone:0', 2], ['bramble:0', 4],
  ['fruitTree:0', 3], ['lifeOrb:1', 2], ['coin:0', 2], ['gaia:0', 2],
];
