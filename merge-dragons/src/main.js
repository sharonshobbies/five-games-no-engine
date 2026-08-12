// main.js -- game orchestration: mode switching (world map / level / camp),
// the tick, tap and drop resolution, harvesting, healing, quests and rewards.

import { Board, Obj, LIVE, DEAD, SUPER } from './board.js';
import { def, next, CHAINS, ITEMS, isMergeable, mergeYield, RARITY } from './registry.js';
import { tryMerge } from './merge.js';
import { applyHealing, forceHeal, tileProgress } from './heal.js';
import { Renderer, TW, TH } from './render.js';
import { Input } from './input.js';
import { Fx, fmt } from './fx.js';
import { Audio } from './audio.js';
import { Dragons, MAX_ACTIVE } from './dragons.js';
import { DRAGON_CHAINS } from './registry.js';
import { Hud } from './hud.js';
import { LEVELS, buildLevel, buildCamp, CAMP_STARTERS, OBJ } from './levels.js';
import * as SaveLib from './save.js';
import { primeGrowth } from './sprites.js';

primeGrowth(CHAINS);

const params = new URLSearchParams(location.search);
const DEBUG = params.has('debug');
const AUTOLEVEL = params.get('level');

// Starting storage, before any Coin Vault or Stone Yard is built. The wiki does
// not publish these two numbers; they are set here to bite within a session.
const BASE_COIN_CAP = 500;
const BASE_BRICK_CAP = 250;
// Dragon Breeding unlocks at 1,250 Dragon Power in the real game. Scaled here
// like every other timing in this build, so it is reachable in one sitting.
const BREEDING_POWER = 250;
// A Dimensional Jar stands for an hour in the real game.
const JAR_SECONDS = 75;

class Game {
  constructor() {
    this.save = SaveLib.load();
    this.canvas = document.getElementById('game');
    this.render = new Renderer(this.canvas);
    this.fx = new Fx();
    this.audio = new Audio();
    this.dragons = new Dragons(this);
    this.board = new Board(4, 4);
    this.input = new Input(this, this.canvas);
    this.hud = new Hud(this, document.getElementById('ui'));
    this.stats = this.save.stats;
    this.mode = 'boot';
    this.selected = null;
    this.level = null;
    this.levelSpec = null;
    this.made = {};
    this.acc = 0;
    this.saveTimer = 0;

    this.onMerge = (d, nd, n, made) => this.afterMerge(d, nd, n, made);
    this.onWonder = (nd) => { this.audio.fanfare(); };

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.regenChalices();

    if (AUTOLEVEL) {
      const L = LEVELS.find((l) => String(l.id) === AUTOLEVEL) || LEVELS[0];
      this.enterLevel(L);
    } else if (DEBUG) {
      this.gotoCamp();
    } else if (!this.save.seen) {
      this.showIntro();
    } else {
      this.gotoMap();
    }
    this.last = performance.now();
    requestAnimationFrame((t) => this.frame(t));
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.render.resize(w, h);
    if (this.board) this.render.clampCam(this.board);
  }

  // ------------------------------------------------------------------------
  // modes
  // ------------------------------------------------------------------------
  // The real game drops you straight into its tutorial level, so the first run
  // enters Grassy 1 with the rules taught as on-canvas banners. The full
  // how-to-play stays one tap away on the "?" button.
  showIntro() {
    this.save.seen = true;
    this.enterLevel(LEVELS[0]);
    const tips = [
      'Drag 3 matching objects together to merge them',
      'Merge 5 at once and you get TWO of the next tier',
      'Merging life flowers heals the grey Dead Land',
      'Merge 3 dragon eggs to hatch a dragon',
      'Merge the broken Gaia Statues to win',
    ];
    tips.forEach((t, i) => setTimeout(() => this.fx.banner(t, 'info'), 1400 + i * 2600));
    this.persist();
  }

  // Buy Menu. Egg prices follow the wiki's Egg Shop tiering; buildings cost
  // Stone Bricks, the currency the Build Menu actually spends.
  shopEntries() {
    const eggs = [
      ['grassd:1', 25], ['greend:1', 25], ['rockd:1', 40],
      ['crimsond:1', 40], ['spottedd:1', 60], ['toadstoold:1', 60],
    ];
    const out = [{ head: 'Egg Shop' }];
    for (const [key, cost] of eggs) out.push({ key, cost, cur: 'coins' });
    out.push({ key: 'golemd:1', cost: 60, cur: 'coins' });
    out.push({ key: 'sharpd:1', cost: 80, cur: 'coins' });
    out.push({ key: 'natured:1', cost: 100, cur: 'coins' });
    out.push({ head: 'Build Shop' });
    out.push({ key: 'home:0', cost: 40, cur: 'bricks' });
    out.push({ key: 'home:1', cost: 180, cur: 'bricks' });
    // The storage buildings: the wiki's base costs, 5 coins for a Level 1 Coin
    // Vault and 40 bricks for a Level 2, 5 bricks for a Level 1 Stone Yard.
    out.push({ key: 'coinVault:0', cost: 5, cur: 'coins' });
    out.push({ key: 'coinVault:1', cost: 40, cur: 'bricks' });
    out.push({ key: 'stoneYard:0', cost: 5, cur: 'bricks' });
    out.push({ key: 'stoneYard:1', cost: 40, cur: 'bricks' });
    out.push({ head: 'Treasure Shop' });
    out.push({ key: 'lifeFlower:1', cost: 10, cur: 'coins' });
    out.push({ key: 'grass:0', cost: 10, cur: 'coins' });
    out.push({ key: 'stone:0', cost: 20, cur: 'coins' });
    out.push({ key: 'chest:0', cost: 120, cur: 'coins' });
    // "Buy the Chest of Soul Crystals from the Buy Menu for 99 Dragon Gems" --
    // the wiki's own gem price, and the second thing gems are for here.
    out.push({ key: 'soulCrystal:2', cost: 99, cur: 'gems' });
    return out;
  }

  showShop() {
    if (this.mode !== 'camp') {
      this.hud.showModal(`<div class="m-title">The shop is in Camp</div>
        <div class="m-blurb">Buy eggs and buildings from your camp, as in the original.</div>`,
        [['OK', () => this.hud.hideModal(), 'primary']]);
      return;
    }
    this.hud.showShop(
      this.shopEntries(),
      (e) => this.save[e.cur === 'bricks' ? 'bricks' : e.cur === 'gems' ? 'gems' : 'coins'] >= e.cost,
      (e) => this.buy(e),
    );
  }

  buy(e) {
    const d = def(e.key);
    const spot = this.board.findFree(this.board.cols / 2, this.board.rows / 2, d.size[0], d.size[1], 12, true);
    if (!spot) { this.fx.banner('Need more space in camp!', 'info'); this.audio.deny(); return; }
    if (e.cur === 'bricks') this.save.bricks -= e.cost;
    else if (e.cur === 'gems') this.save.gems -= e.cost;
    else this.save.coins -= e.cost;
    const o = this.board.spawn(e.key, spot[0], spot[1]);
    o.pop = 1;
    this.fx.spawnBurst(o);
    this.fx.floatText(o.cx, o.cy, d.name, '#ffe066', 1.2);
    this.discover(e.key);
    this.dragons.sync();
    this.audio.coin();
    this.render.cam.tx = o.cx; this.render.cam.ty = o.cy;
    this.persist();
  }

  showBook() { this.hud.showBook(this.save.discovered || {}); }

  showHelp() {
    this.hud.showModal(`
      <div class="m-kicker">A land gone grey</div>
      <div class="m-title">Merge Dragons</div>
      <div class="m-blurb">Zomblins tore the life out of this world. Everything that grows can be
      brought back &mdash; but only by <b>merging</b>.</div>
      <ul class="m-list">
        <li><b>Drag</b> one object onto two or more identical ones to merge them into the next tier.</li>
        <li><b>Merge 5 at once</b> and you get <b>two</b> of the next tier instead of one. Always merge in fives.</li>
        <li>Merging life flowers, prism flowers or big dragon trees releases <b>Healing Power</b>,
        which heals the grey <b>Dead Land</b> and reveals what is buried in it.</li>
        <li>Merging objects that <b>stand on</b> dead land heals that land for free &mdash; the only way
        to clear <b>Super Dead Land</b>.</li>
        <li>Tap a <b>Life Orb</b> to smash it and release its healing power. Tap a grown plant to harvest it.</li>
        <li>Merge three <b>dragon eggs</b> to hatch a dragon. Dragons wander, harvest and fight on their own.
        Merge three level-4 dragons for a <b>Nest</b> of the next breed.</li>
        <li>Merge the broken <b>Gaia Statues</b> to win a level. Three side quests give <b>Goal Stars</b>.</li>
        <li>A merge only spends objects in fives and threes. A <b>4-merge</b> gives one of the next
        tier and hands the spare back &mdash; watch for &ldquo;spare returned&rdquo;.</li>
        <li>Coins and bricks have a <b>storage cap</b>. Past it, collections land as
        <b>Leftover Stones</b> and <b>Leftover Coins</b> holding what would not fit. Build
        <b>Coin Vaults</b> and <b>Stone Yards</b> from the Build Shop to raise the cap.</li>
        <li>A camp merge can leave a <b>Dimensional Jar</b> holding a copy of what you just made.
        Open it with <b>Dragon Gems</b>, or sell it for 50 coins before it fades.</li>
        <li>Tap a <b>Soul Crystal</b> with two grown dragons of different breeds on the board to
        <b>breed</b> a third breed. The parents are not consumed.</li>
        <li>Statues, idols and topiaries <b>tap once for a dragon egg</b>, then merge as normal.</li>
        <li>Drag empty land to pan, scroll to zoom.</li>
      </ul>`,
      [['Got it', () => this.hud.hideModal(), 'primary'],
       ['Reset save', () => { SaveLib.wipe(); location.reload(); }, 'danger']]);
  }

  gotoMap() {
    this.mode = 'map';
    this.selected = null;
    this.hud.showMap(this.save, (L, st) => this.pickLevel(L, st));
    this.hud.hideModal();
    this.input.enabled = false;
  }

  pickLevel(L, st) {
    this.hud.showLevelInfo(L, st, () => {
      if (this.save.chalices < L.chalices) {
        this.hud.showModal(`<div class="m-title">Not enough Chalices</div>
          <div class="m-blurb">You have ${this.save.chalices}. ${L.name} costs ${L.chalices}.
          One Chalice returns every 30 seconds (the real game takes an hour).</div>`,
          [['OK', () => this.hud.hideModal(), 'primary']]);
        this.audio.deny();
        return;
      }
      this.save.chalices -= L.chalices;
      this.persist();
      this.enterLevel(L);
    });
  }

  enterLevel(spec) {
    this.hud.hideMap();
    this.hud.hideModal();
    this.mode = 'level';
    this.input.enabled = true;
    this.levelSpec = spec;
    this.board = buildLevel(spec);
    this.dragons.list = [];
    this.made = {};
    this.selected = null;
    this.level = {
      startLive: this.board.liveTiles(),
      coins: 0, bricks: 0, merges: 0, merge5: 0, harvests: 0, slain: 0, extenders: 0,
      gatesStart: this.board.objs.filter((o) => o.d.chain === 'gate').length,
      end: spec.end, quests: spec.quests, starsDone: 0, complete: false,
    };
    this.dragons.sync();
    this.render.centreOn(this.board);
    this.fx.banner(spec.name, 'info');
    this.hud.setHint(spec.blurb);
    if (DEBUG) this.debugSeed();
  }

  gotoCamp() {
    this.hud.hideMap();
    this.hud.hideModal();
    this.mode = 'camp';
    this.input.enabled = true;
    this.levelSpec = null;
    if (this.save.camp) {
      this.board = SaveLib.restoreBoard(Board, this.save.camp);
      for (const s of this.save.camp.objs) {
        if (!ITEMS[s.k]) continue;
        const o = this.board.spawn(s.k, s.x, s.y);
        o.pop = 0;
        o.tapsLeft = s.t === undefined ? (o.d.taps || 0) : s.t;
        if (s.hp !== undefined) o.hpLeft = s.hp;
        o.hidden = !!s.h;
        if (s.am !== undefined) o.amount = s.am;
        if (s.eg) o.eggTapped = true;
        o.born = -100; o.lastHarvest = -100;
      }
    } else {
      this.board = buildCamp(this.save);
      const rnd = () => Math.random();
      for (const [key, n] of CAMP_STARTERS) {
        for (let i = 0; i < n; i++) {
          const spot = this.board.findFree(
            8 + Math.floor((rnd() - 0.5) * 6), 6 + Math.floor((rnd() - 0.5) * 6),
            def(key).size[0], def(key).size[1], 8, true);
          if (spot) { const o = this.board.spawn(key, spot[0], spot[1]); o.pop = 0; o.born = -100; o.lastHarvest = -100; }
        }
      }
    }
    this.dragons.list = [];
    this.dragons.sync();
    // deliver anything carried out of levels
    if (this.save.carried && this.save.carried.length) {
      const got = [...this.save.carried];
      this.save.carried = [];
      for (const k of got) {
        if (!ITEMS[k]) continue;
        const spot = this.board.findFree(9, 7, def(k).size[0], def(k).size[1], 10, true);
        if (spot) { const o = this.board.spawn(k, spot[0], spot[1]); o.pop = 1; this.fx.spawnBurst(o); }
      }
      if (got.length) this.fx.banner(`${got.length} item${got.length > 1 ? 's' : ''} carried home`, 'info');
    }
    this.level = {
      startLive: this.board.liveTiles(), coins: 0, bricks: 0, merges: 0, merge5: 0,
      harvests: 0, slain: 0, extenders: 0, gatesStart: 0,
      end: OBJ.power(Math.max(60, Math.ceil((this.dragons.totalPower() + 40) / 20) * 20)),
      quests: [OBJ.heal(10), OBJ.tier('lifeFlower', 6), OBJ.dragons(4)],
      starsDone: 0, complete: false, isCamp: true,
    };
    this.render.centreOn(this.board);
    this.hud.setHint('Your camp. Dragon Power burns off the Evil Fog; healing power revives the land.');
    if (DEBUG) this.debugSeed();
    this.persist();
  }

  debugSeed() {
    // A rich board so the verification harness always sees a full scene.
    const b = this.board;
    const seeds = [
      ['lifeFlower:4', 5], ['lifeFlower:6', 3], ['lifeFlower:8', 2],
      ['prism:4', 3], ['dragonTree:5', 3], ['fruitTree:6', 3],
      ['stone:4', 3], ['grass:5', 3], ['water:4', 2], ['mushroom:5', 3],
      ['chest:3', 2], ['star:2', 2], ['coin:4', 3], ['brick:3', 2],
      ['lifeOrb:5', 3], ['home:2', 2], ['grassd:2', 2], ['grassd:4', 1],
      ['crimsond:3', 2], ['rockd:2', 2], ['spottedd:5', 1], ['toadstoold:3', 2],
      ['gaia:1', 2], ['hill:3', 2], ['bulb:3', 2], ['essence:3', 2],
      ['zomblin:1', 1], ['gate:0', 1], ['healext:0', 2], ['dgem:0', 2],
      ['bone:0', 2], ['skull:1', 2], ['grave:2', 2], ['bush:3', 2],
      ['autumnTree:5', 2], ['loot:0', 1], ['dstar:0', 1],
      // second-wave content, so a screenshot shows the new art too
      ['magicShroom:8', 1], ['midasTree:8', 1], ['glowTree:5', 2],
      ['grimmTree:6', 2], ['shadowTree:9', 1], ['haunted:5', 1],
      ['zenTemple:9', 1], ['nirvanaTemple:5', 1], ['honey:7', 2],
      ['chocolate:8', 1], ['fairyHouse:5', 1], ['gnome:4', 2],
      ['goldStatue:3', 2], ['jewelStatue:1', 2], ['mysticTopiary:5', 1],
      ['mysticLantern:5', 2], ['seashell:6', 2], ['starfish:5', 2],
      ['crystalFruit:5', 2], ['forgottenFlower:6', 2], ['bonusPoint:6', 2],
      ['lostTreasure:2', 1], ['artefact:2', 1], ['goddess:2', 1],
      ['fluff:1', 2], ['wood:2', 2], ['gemsteel:3', 2],
      ['mysticPlant:4', 2], ['soulCrystal:2', 2], ['crystalTree:3', 1],
      ['coinVault:2', 1], ['stoneYard:3', 1], ['golemd:3', 2], ['sharpd:4', 1],
      ['natured:2', 2], ['sund:3', 1], ['moond:2', 1], ['stard:2', 1],
      ['prismd:3', 1], ['lifed:2', 1],
    ];
    // heal a big region so the contrast reads
    const cells = [];
    for (let y = 0; y < b.rows; y++) for (let x = 0; x < b.cols; x++) {
      if (b.playable[b.idx(x, y)] && Math.hypot(x - b.cols / 2, y - b.rows / 2) < Math.min(b.cols, b.rows) * 0.42) cells.push([x, y]);
    }
    forceHeal(b, cells);
    if (b.fog) for (let i = 0; i < b.fog.length; i++) b.fog[i] = Math.min(b.fog[i], 40);
    for (const [k, n] of seeds) {
      if (!ITEMS[k]) continue;
      const d = def(k);
      for (let i = 0; i < n; i++) {
        const spot = b.findFree(
          Math.floor(Math.random() * b.cols), Math.floor(Math.random() * b.rows),
          d.size[0], d.size[1], 12, true);
        if (!spot) continue;
        const o = b.spawn(k, spot[0], spot[1]);
        o.born = -100; o.lastHarvest = -100; o.pop = 0;
      }
    }
    this.dragons.sync();
    this.save.coins = Math.max(this.save.coins, 4820);
    this.save.bricks = Math.max(this.save.bricks, 1340);
    this.save.gems = Math.max(this.save.gems, 620);
    // clamp to what storage actually holds, then leave the overflow on the
    // board as Leftovers -- the debug camp should show the cap biting
    for (const cur of ['coins', 'bricks']) {
      const cap = this.storageCap(cur);
      if (this.save[cur] > cap) {
        const over = this.save[cur] - cap;
        this.save[cur] = cap;
        this.spillLeftover(cur, over, null);
      }
    }
  }

  // ------------------------------------------------------------------------
  // interaction
  // ------------------------------------------------------------------------
  select(o) { this.selected = o; }

  canMerge(o) { return isMergeable(o.key); }

  actionLabel(o) {
    const d = o.d;
    if (d.leftover) return `Collect ${fmt(o.amount || 0)} ${d.leftover}`;
    if (d.chain === 'jar') return `Open the Jar (${fmt(o.gems || 0)} gems)`;
    if (d.statueEgg && !o.eggTapped) return `Tap for ${d.statueEgg > 1 ? d.statueEgg + ' Eggs' : 'an Egg'}`;
    if (d.soul) return 'Breed Dragons';
    if (d.hatch) return 'Hatch the Nest';
    if (d.chain === 'loot') return 'Smash Orb';
    if (d.tapCoins) return `Collect ${fmt(d.tapCoins)} Coins`;
    if (d.tapBricks) return `Collect ${fmt(d.tapBricks)} Bricks`;
    if (d.tapGems) return `Collect ${fmt(d.tapGems)} Gems`;
    if (d.chain === 'lifeOrb') return `Smash Orb (${fmt(d.tapHeal)} healing)`;
    if (d.chain === 'healext') return 'Activate Heal Extender';
    if (d.loot) return 'Open it';
    if (d.chain === 'bramble') return 'Clear it';
    if (d.chain === 'zomblin') return 'It must be destroyed';
    if (d.chain === 'gate') return 'It must be destroyed';
    if (d.tapHeal) return 'Tap for Healing Power';
    if (d.harvest) {
      const ready = (this.board.time - o.lastHarvest) >= d.harvest.every;
      return ready ? this.harvestVerb(d) : 'Not ready yet';
    }
    if (d.taps) return 'Tap it';
    return null;
  }

  harvestVerb(d) {
    if (d.chain === 'fruitTree' || d.chain === 'dragonTree' || d.chain === 'autumnTree') return 'Shake the Tree';
    if (d.chain === 'stone' || d.chain === 'hill') return 'Dig it up';
    if (d.chain === 'grass') return 'Pick the Grass';
    if (d.chain === 'lifeFlower') return 'Harvest for Life';
    return 'Harvest';
  }

  tap(o) {
    const board = this.board;
    const d = o.d;
    this.selected = o;
    this.fx.tap(o.cx, o.cy, d.tint);

    // nests hatch into eggs
    if (d.hatch) {
      const n = d.hatch.min + Math.floor(Math.random() * (d.hatch.max - d.hatch.min + 1));
      let made = 0;
      for (let i = 0; i < n; i++) {
        const spot = board.findFree(o.x, o.y, 1, 1, 6, true);
        if (!spot) break;
        const e = board.spawn(d.hatch.egg, spot[0], spot[1]);
        e.pop = 1; made++;
        this.fx.spawnBurst(e);
      }
      if (made) {
        board.remove(o);
        this.audio.hatch();
        this.fx.floatText(o.cx, o.cy, `${made} eggs!`, '#ffe066', 1.3);
        this.discover(d.hatch.egg);
      } else this.fx.floatText(o.cx, o.cy, 'Need more space!', '#ff9f9f');
      return;
    }

    // leftovers: collect what storage will now take, keep the rest.
    // This must not go through bank(), or the part that does not fit would be
    // spilled straight back into this same pile and counted twice.
    if (d.leftover) {
      const cur = d.leftover;
      const want = o.amount || 0;
      const room = Math.max(0, this.storageCap(cur) - (cur === 'bricks' ? this.save.bricks : this.save.coins));
      const got = Math.min(room, want);
      if (got > 0) {
        if (cur === 'bricks') { this.save.bricks += got; this.level.bricks += got; }
        else { this.save.coins += got; this.level.coins += got; }
        this.fx.floatText(o.cx, o.cy, `+${fmt(got)}${cur === 'bricks' ? ' bricks' : ''}`,
          cur === 'bricks' ? '#e0c9a0' : '#ffd966', 1.15);
      }
      if (got <= 0) {
        this.fx.floatText(o.cx, o.cy, 'Storage still full', '#ffb0b0', 1.05);
        this.audio.deny();
        return;
      }
      o.amount = want - got;
      if (o.amount <= 0) { board.remove(o); this.audio.coin(); }
      return;
    }

    // a Dimensional Jar: open it for gems, or sell it for 50 coins
    if (d.chain === 'jar') { this.openJar(o); return; }

    // a statue or topiary: one tap ever, for an egg; then it merges as normal
    if (d.statueEgg && !o.eggTapped) {
      o.eggTapped = true;
      const breeds = DRAGON_CHAINS;
      let made = 0;
      for (let i = 0; i < d.statueEgg; i++) {
        const spot = board.findFree(o.x, o.y, 1, 1, 6, true);
        if (!spot) break;
        const key = `${breeds[Math.floor(Math.random() * breeds.length)]}:1`;
        const e = board.spawn(key, spot[0], spot[1]);
        e.pop = 1; made++;
        this.fx.spawnBurst(e);
        this.discover(key);
      }
      this.audio.hatch();
      this.fx.floatText(o.cx, o.cy, made ? `${made} egg${made > 1 ? 's' : ''}!` : 'Need space!', '#ffe066', 1.25);
      return;
    }

    // a Soul Crystal: Dragon Breeding
    if (d.soul) { this.breed(o); return; }

    // loot orbs
    if (d.chain === 'loot') {
      const contents = o.contents && o.contents.length ? o.contents : ['coin:1', 'lifeFlower:1'];
      for (const k of contents) {
        const spot = board.findFree(o.x, o.y, 1, 1, 6, true);
        if (!spot) continue;
        const it = board.spawn(k, spot[0], spot[1]);
        it.pop = 1;
        this.fx.spawnBurst(it);
      }
      board.remove(o);
      this.audio.chest();
      return;
    }

    // currency
    if (d.tapCoins) { this.gainCoins(d.tapCoins, o); board.remove(o); this.audio.coin(); return; }
    if (d.tapBricks) { this.gainBricks(d.tapBricks, o); board.remove(o); this.audio.coin(); return; }
    if (d.tapGems) {
      this.save.gems += d.tapGems;
      this.fx.floatText(o.cx, o.cy, `+${d.tapGems} gems`, '#ff9fe0', 1.2);
      this.audio.star();
      if (d.consumeOnTap) board.remove(o);
      else { o.tapsLeft--; if (o.tapsLeft <= 0) board.remove(o); }
      return;
    }

    // heal extender: heals its 4 orthogonal neighbours
    if (d.chain === 'healext') {
      if (!board.isLive(o.x, o.y)) {
        this.fx.floatText(o.cx, o.cy, 'Heal this tile first', '#ffcf8f');
        this.audio.deny();
        return;
      }
      const cells = [[o.x + 1, o.y], [o.x - 1, o.y], [o.x, o.y + 1], [o.x, o.y - 1]];
      const healed = forceHeal(board, cells);
      this.fx.landHeal(healed, 'merge');
      this.level.extenders++;
      board.remove(o);
      this.audio.heal();
      this.fx.floatText(o.cx, o.cy, 'Heal Extender!', '#8affc8', 1.3);
      return;
    }

    // life orbs and prism flowers release healing power
    if (d.tapHeal) {
      this.releaseHeal(o, d.tapHeal);
      if (d.consumeOnTap) board.remove(o);
      else { o.lastHarvest = board.time; }
      return;
    }

    // chests / stars give loot
    if (d.loot) {
      this.openLoot(o);
      return;
    }

    // brambles, skeletons, gates, zomblins: tap to chip away
    if (d.taps || d.hp) {
      if (d.hp) { this.damage(o, 1 + Math.floor(this.dragons.totalPower() / 60)); this.audio.fire(); return; }
      o.tapsLeft--;
      this.audio.pluck(1);
      this.fx.spark(o.cx - 0.5, o.cy - 0.5, d.tint, 6, 1.6, 0.5, 2.4);
      if (o.tapsLeft <= 0) {
        board.remove(o);
        const drop = d.chain === 'bramble' ? (Math.random() < 0.5 ? 'lifeFlower:1' : 'bone:0')
          : d.chain === 'bone' ? 'bone:0' : 'lifeFlower:0';
        for (let i = 0; i < (d.chain === 'bone' ? 3 : 1); i++) {
          const spot = board.findFree(o.x, o.y, 1, 1, 4, true);
          if (spot) { const it = board.spawn(drop, spot[0], spot[1]); it.pop = 1; this.fx.spawnBurst(it); }
        }
      }
      return;
    }

    // harvest
    if (d.harvest) {
      const ready = (board.time - o.lastHarvest) >= d.harvest.every;
      if (!ready) {
        const left = Math.ceil(d.harvest.every - (board.time - o.lastHarvest));
        this.fx.floatText(o.cx, o.cy, `${left}s`, '#cfd8e8');
        this.audio.deny();
        return;
      }
      o.lastHarvest = board.time;
      o.ready = false;
      const spot = board.findFree(o.x, o.y, 1, 1, 5, true);
      if (!spot) { this.fx.floatText(o.cx, o.cy, 'Need more space!', '#ff9f9f'); return; }
      const it = board.spawn(d.harvest.item, spot[0], spot[1]);
      it.pop = 1;
      this.fx.harvestPop(o);
      this.fx.spawnBurst(it);
      this.audio.pluck(it.d.idx);
      this.level.harvests++;
      this.stats.harvests++;
      this.discover(d.harvest.item);
      return;
    }

    this.fx.floatText(o.cx, o.cy, d.name, RARITY[d.rarity] || '#fff', 0.95);
  }

  tapLand(x, y) {
    const board = this.board;
    if (!board.isPlayable(x, y)) return;
    const i = board.idx(x, y);
    if (board.fog && board.fog[i] > this.dragons.totalPower()) {
      this.fx.floatText(x + 0.5, y + 0.5, `${fmt(board.fog[i])} Dragon Power`, '#c9b0e8', 1.1);
      return;
    }
    if (board.land[i] === LIVE) return;
    const need = board.cost[i] - board.paid[i];
    const label = board.land[i] === SUPER ? `Super Dead Land` : `${fmt(Math.ceil(need))} healing needed`;
    this.fx.floatText(x + 0.5, y + 0.5, label, board.land[i] === SUPER ? '#c9a8ff' : '#8affc8', 1.05);
    this.fx.tap(x + 0.5, y + 0.5, '#c9ffd8');
  }

  drop(o, gx, gy, origin) {
    const board = this.board;
    if (gx === null) { return; }
    const target = board.at(gx, gy);

    // dragon dropped onto a harvestable / hostile: task it
    if (o.dragon && target && target !== o && target.key !== o.key) {
      if (this.dragons.assign(o, target)) {
        this.audio.drop();
        this.fx.floatText(o.cx, o.cy, 'On it!', '#c9ffb0');
        return;
      }
    }

    // dropping onto an identical object => merge attempt from that cell
    if (target && target !== o && target.key === o.key && isMergeable(o.key)) {
      board.unplace(o);
      // stand the dragged object on the nearest free cell around the target
      const spot = board.findFree(gx, gy, o.w, o.h, 3, false) || origin;
      board.place(o, spot[0], spot[1]);
      const r = tryMerge(this, o);
      if (!r) { this.audio.drop(); }
      return;
    }

    if (board.canDrop(o, gx, gy)) {
      board.unplace(o);
      board.place(o, gx, gy);
      const r = isMergeable(o.key) ? tryMerge(this, o) : null;
      if (!r) this.audio.drop();
    } else {
      board.unplace(o);
      board.place(o, origin[0], origin[1]);
      this.audio.deny();
      this.fx.floatText(o.cx, o.cy, board.isLive(gx, gy) ? 'Occupied' : 'Heal the land first', '#ffb0b0');
    }
  }

  sell(o) {
    if (!o.d.worth) return;
    this.gainCoins(o.d.worth, o);
    this.board.remove(o);
    if (o.dragon) this.dragons.release(o);
    this.selected = null;
    this.audio.coin();
  }

  // ------------------------------------------------------------------------
  // resources / effects
  // ------------------------------------------------------------------------
  // ---- storage caps -------------------------------------------------------
  // Coins live in Coin Vaults and bricks in Stone Yards; what those buildings
  // add up to is the cap. The wiki publishes the per-building amounts (+5 up to
  // +50,000) but not the starting capacity, so the two BASE numbers below are
  // this build's choice, sized to the compressed economy here.
  storageCap(cur) {
    let cap = cur === 'bricks' ? BASE_BRICK_CAP : BASE_COIN_CAP;
    const add = (list) => {
      for (const s of list) {
        const d = def(s.k || s.key);
        if (d && d.storage && d.storage.cur === cur) cap += d.storage.add;
      }
    };
    if (this.mode === 'camp') add(this.board.objs);
    else if (this.save.camp) add(this.save.camp.objs);
    return cap;
  }

  /** Bank up to the cap; whatever will not fit is left on the board. */
  bank(cur, n, o) {
    const cap = this.storageCap(cur);
    const have = cur === 'bricks' ? this.save.bricks : this.save.coins;
    const room = Math.max(0, cap - have);
    const took = Math.min(room, n);
    const over = n - took;
    if (took > 0) {
      if (cur === 'bricks') { this.save.bricks += took; this.level.bricks += took; }
      else { this.save.coins += took; this.level.coins += took; }
      if (o) this.fx.floatText(o.cx, o.cy, `+${fmt(took)}${cur === 'bricks' ? ' bricks' : ''}`, cur === 'bricks' ? '#e0c9a0' : '#ffd966', 1.15);
    }
    if (over > 0) this.spillLeftover(cur, over, o);
    return took;
  }

  // "Stones you couldn't collect because your Stone Storage was full." The
  // number above it is what a tap will hand over once there is room again.
  spillLeftover(cur, amount, near) {
    const board = this.board;
    const key = cur === 'bricks' ? 'leftover:0' : 'leftover:1';
    const x = near ? near.x : Math.floor(board.cols / 2);
    const y = near ? near.y : Math.floor(board.rows / 2);
    // merge into an existing pile rather than littering the board
    let pile = board.objs.find((p) => p.key === key && Math.hypot(p.cx - x, p.cy - y) < 5);
    if (pile) { pile.amount = (pile.amount || 0) + amount; pile.pop = 1; }
    else {
      // a full board must not swallow the overflow: widen, then accept any tile
      const spot = board.findFree(x, y, 1, 1, 16, true) || board.findFree(x, y, 1, 1, 16, false);
      if (!spot) {
        // nowhere at all to put it: fold it into any existing pile of this kind
        const any = board.objs.find((p) => p.key === key);
        if (any) { any.amount = (any.amount || 0) + amount; any.pop = 1; }
        return;
      }
      pile = board.spawn(key, spot[0], spot[1]);
      pile.amount = amount;
      pile.pop = 1;
      this.fx.spawnBurst(pile);
    }
    this.fx.floatText(pile.cx, pile.cy - 0.6,
      `${cur === 'bricks' ? 'Stone' : 'Coin'} Storage full!`, '#ffb0b0', 1.15);
    this.audio.deny();
  }

  gainCoins(n, o) { this.bank('coins', n, o); }
  gainBricks(n, o) { this.bank('bricks', n, o); }

  releaseHeal(o, amount) {
    const board = this.board;
    // healing power also damages zomblins (wiki)
    let dealt = false;
    for (const z of [...board.objs]) {
      if (!z.d.hp) continue;
      if (Math.hypot(z.cx - o.cx, z.cy - o.cy) <= 2.6) { this.damage(z, amount); dealt = true; }
    }
    if (board.deadTiles() > 0) {
      const res = applyHealing(board, amount, o.cx - 0.5, o.cy - 0.5);
      this.fx.healPower(o.cx, o.cy, amount);
      if (res.healed.length) {
        this.fx.landHeal(res.healed, 'power');
        this.stats.healed += res.healed.length;
        this.revealHidden(res.healed);
      }
      this.audio.heal();
    } else if (!dealt) {
      // no dead land: healing power becomes score/coins
      this.gainCoins(Math.max(1, Math.round(amount / 4)), o);
      this.fx.floatText(o.cx, o.cy - 0.4, 'Land is whole!', '#c9ffd8', 1.1);
      this.audio.coin();
    }
  }

  revealHidden(cells) {
    const board = this.board;
    for (const [x, y] of cells) {
      const o = board.at(x, y);
      if (o && o.hidden) {
        o.hidden = false;
        o.pop = 1;
        this.fx.spawnBurst(o);
        this.fx.floatText(o.cx, o.cy - 0.5, o.d.name, RARITY[o.d.rarity] || '#fff', 0.95);
        this.discover(o.key);
      }
    }
  }

  damage(o, amount, by) {
    if (o.hpLeft === undefined) o.hpLeft = o.d.hp || 1;
    o.hpLeft -= amount;
    this.fx.spark(o.cx - 0.5, o.cy - 0.7, '#ff9f5f', 6, 2, 0.5, 2.6);
    this.fx.floatText(o.cx, o.cy - 0.6, `-${fmt(amount)}`, '#ff9f6f', 0.9);
    if (o.hpLeft > 0) return;
    const d = o.d;
    this.board.remove(o);
    this.fx.spark(o.cx - 0.5, o.cy - 0.5, '#ffd0a0', 16, 3, 0.9, 3.4);
    this.fx.shake = Math.min(1, this.fx.shake + 0.3);
    if (d.chain === 'zomblin') {
      this.level.slain++;
      // leaves a grave behind
      const spot = this.board.findFree(o.x, o.y, 1, 1, 4, false);
      if (spot && d.grave) { const gr = this.board.spawn(d.grave, spot[0], spot[1]); gr.pop = 1; }
      this.fx.floatText(o.cx, o.cy, 'Zomblin destroyed!', '#c9ffb0', 1.2);
    } else if (d.chain === 'gate') {
      // destroying a Demon Gate yields a Gaia Statue
      const spot = this.board.findFree(o.x, o.y, 1, 1, 5, false);
      if (spot) { const gs = this.board.spawn('gaia:0', spot[0], spot[1]); gs.pop = 1; this.fx.spawnBurst(gs); }
      this.fx.banner('Demon Gate destroyed!', 'wonder');
      this.audio.fanfare();
    }
  }

  openLoot(o) {
    const board = this.board;
    const d = o.d;
    const tier = d.loot || 1;
    const pool = [];
    for (let i = 0; i < 2 + Math.floor(tier / 2); i++) {
      const r = Math.random();
      if (r < 0.34) pool.push(`coin:${Math.min(8, Math.max(0, tier - 1 + Math.floor(Math.random() * 2)))}`);
      else if (r < 0.58) pool.push(`lifeFlower:${Math.min(7, 1 + Math.floor(Math.random() * (tier + 1)))}`);
      else if (r < 0.76) pool.push(`lifeOrb:${Math.min(7, Math.max(1, tier - 1))}`);
      else if (r < 0.86) pool.push(`brick:${Math.min(6, Math.max(0, tier - 2))}`);
      else if (r < 0.94) {
        const breeds = ['grassd', 'greend', 'rockd', 'crimsond', 'spottedd', 'toadstoold'];
        pool.push(`${breeds[Math.floor(Math.random() * breeds.length)]}:1`);
      } else pool.push(`star:${Math.min(4, tier)}`);
    }
    if (d.taps && o.tapsLeft > 1) {
      o.tapsLeft--;
      // stars shrink with each tap
      const k = pool[0];
      const spot = board.findFree(o.x, o.y, 1, 1, 5, true);
      if (spot) { const it = board.spawn(k, spot[0], spot[1]); it.pop = 1; this.fx.spawnBurst(it); this.discover(k); }
      this.audio.star();
      return;
    }
    board.remove(o);
    this.audio.chest();
    this.fx.shake = Math.min(1, this.fx.shake + 0.35);
    for (const k of pool) {
      if (!ITEMS[k]) continue;
      const spot = board.findFree(o.x, o.y, 1, 1, 6, true);
      if (!spot) continue;
      const it = board.spawn(k, spot[0], spot[1]);
      it.pop = 1;
      this.fx.spawnBurst(it);
      this.discover(k);
    }
    this.fx.floatText(o.cx, o.cy, 'Loot!', '#ffe066', 1.4);
  }

  // ---- Dimensional Jars: the gem sink ------------------------------------
  // "A non-mergeable object which sometimes appears upon merging, usually
  // higher-level ones (the chance is greater the higher the item's level). The
  // item it contains is a clone of the object that was just created." Tapping
  // offers the gem price; every jar sells for 50 coins whatever is inside.
  maybeJar(made) {
    if (this.mode !== 'camp') return;          // camp and events only, per the wiki
    const src = made && made.d;
    if (!src || !src.jarGems) return;
    const chance = Math.min(0.4, 0.06 + src.idx * 0.02);
    if (Math.random() > chance) return;
    const spot = this.board.findFree(made.x, made.y, 1, 1, 5, true);
    if (!spot) return;
    const jar = this.board.spawn('jar:0', spot[0], spot[1]);
    jar.pop = 1;
    jar.contents = made.key;
    jar.gems = src.jarGems;
    jar.expires = this.board.time + JAR_SECONDS;
    this.fx.spawnBurst(jar);
    this.fx.floatText(jar.cx, jar.cy - 0.5, 'A Dimensional Jar!', '#ff9fe0', 1.2);
  }

  openJar(o) {
    const inside = def(o.contents) || def('lifeFlower:2');
    const cost = o.gems || 20;
    const left = Math.max(0, Math.ceil((o.expires || 0) - this.board.time));
    this.hud.showModal(`
      <div class="m-kicker">Dimensional Jar &mdash; ${left}s left</div>
      <div class="m-title">${inside.name}</div>
      <div class="m-blurb">A clone of what you just merged, held in the jar. Open it with
      Dragon Gems, or sell the jar for 50 Coins. You have <b>${fmt(this.save.gems)}</b> gems.</div>`,
      [
        [`Open &mdash; ${fmt(cost)} gems`, () => {
          if (this.save.gems < cost) {
            this.fx.floatText(o.cx, o.cy, 'Not enough gems', '#ffb0b0', 1.1);
            this.audio.deny();
            this.hud.hideModal();
            return;
          }
          this.save.gems -= cost;
          const spot = this.board.findFree(o.x, o.y, inside.size[0], inside.size[1], 6, true);
          this.board.remove(o);
          if (spot) {
            const it = this.board.spawn(inside.key, spot[0], spot[1]);
            it.pop = 1;
            this.fx.spawnBurst(it);
            this.discover(it.key);
            if (it.d.dragon) this.dragons.attach(it);
          }
          this.audio.fanfare();
          this.fx.banner(`${inside.name} released!`, 'wonder');
          this.hud.hideModal();
          this.persist();
        }, 'primary'],
        ['Sell for 50 Coins', () => {
          this.board.remove(o);
          this.gainCoins(50, o);
          this.audio.coin();
          this.hud.hideModal();
        }, ''],
        ['Leave it', () => this.hud.hideModal(), 'ghost'],
      ]);
  }

  // ---- Dragon Breeding ----------------------------------------------------
  // The wiki's Soul Tree: combine two level-3+ dragons with a Soul Crystal to
  // get a dragon of another breed. The parents are NOT consumed -- "unlike
  // merging, combining Dragons won't use them up" -- so the autonomy state of
  // everything on the board is untouched. Crystal level sets what you get:
  // level 1 an Egg, 2 a Whelp, 3 a Kid.
  breed(o) {
    const power = this.dragons.totalPower();
    if (power < BREEDING_POWER) {
      this.fx.floatText(o.cx, o.cy, `Needs ${BREEDING_POWER} Dragon Power`, '#c9b0e8', 1.15);
      this.audio.deny();
      return;
    }
    const parents = this.dragons.list.filter((x) => x.d.dragon.stage >= 2);
    const breeds = [...new Set(parents.map((x) => x.d.dragon.breed))];
    if (parents.length < 2 || breeds.length < 2) {
      this.fx.floatText(o.cx, o.cy, 'Needs 2 grown dragons of different breeds', '#c9b0e8', 1.15);
      this.audio.deny();
      return;
    }
    // the child is a third breed, never one of the parents
    const pool = DRAGON_CHAINS.filter((bid) => !breeds.includes(bid));
    const bid = (pool.length ? pool : DRAGON_CHAINS)[Math.floor(Math.random() * (pool.length || DRAGON_CHAINS.length))];
    const stageIdx = [1, 2, 3][Math.min(2, Math.max(0, (o.d.soul || 1) - 1))];
    const key = `${bid}:${stageIdx}`;
    const spot = this.board.findFree(o.x, o.y, 1, 1, 6, true);
    if (!spot) { this.fx.floatText(o.cx, o.cy, 'Need more space!', '#ff9f9f'); return; }
    this.board.remove(o);
    const child = this.board.spawn(key, spot[0], spot[1]);
    child.pop = 1;
    this.fx.spawnBurst(child);
    if (child.d.dragon) this.dragons.attach(child);
    this.discover(key);
    this.audio.fanfare();
    this.fx.banner(`Bred: ${child.d.name}!`, 'nest');
    this.stats.bred = (this.stats.bred || 0) + 1;
    this.persist();
  }

  discover(key) {
    if (!this.save.discovered[key]) {
      this.save.discovered[key] = true;
    }
  }

  afterMerge(d, nd, n, made) {
    this.made[nd.key] = (this.made[nd.key] || 0) + made.length;
    this.level.merges++;
    if (n >= 5) this.level.merge5++;
    this.discover(nd.key);
    // Gaia statues bloom life flowers when created (wiki)
    for (const m of made) {
      if (m.d.gaiaBloom) {
        for (let i = 0; i < 9; i++) {
          const spot = this.board.findFree(m.x + (Math.random() * 5 - 2), m.y + (Math.random() * 5 - 2), 1, 1, 6, true);
          if (!spot) break;
          const f = this.board.spawn(m.d.gaiaBloom, spot[0], spot[1]);
          f.pop = 1;
          this.fx.spawnBurst(f);
        }
        this.fx.banner(`${m.d.name}! The land rejoices.`, 'wonder');
        this.audio.fanfare();
      }
    }
    // a merge in camp can leave a Dimensional Jar behind
    for (const m of made) this.maybeJar(m);
    if (d.boneBonus) {
      // Bones merge into extra Life Flower Sprouts
      for (let i = 0; i < 2; i++) {
        const spot = this.board.findFree(made[0] ? made[0].x : 0, made[0] ? made[0].y : 0, 1, 1, 5, true);
        if (spot) { const f = this.board.spawn('lifeFlower:1', spot[0], spot[1]); f.pop = 1; }
      }
    }
  }

  // ------------------------------------------------------------------------
  // quests
  // ------------------------------------------------------------------------
  checkQuests() {
    const L = this.level;
    if (!L) return;
    let done = 0;
    for (const q of L.quests) {
      const target = q.dyn ? q.dyn(this) : q.target;
      if (target > 0 && q.prog(this) >= target) {
        done++;
        if (!q._done) {
          q._done = true;
          this.awardStar(q);
        }
      }
    }
    L.starsDone = done;
    const et = L.end.dyn ? L.end.dyn(this) : L.end.target;
    if (!L.complete && et > 0 && L.end.prog(this) >= et) {
      L.complete = true;
      this.finishLevel();
    }
  }

  awardStar(q) {
    // a completed quest awards a Goal Star; 5% chance of a Dragon Star instead
    const dragonStar = Math.random() < 0.05;
    const key = dragonStar ? 'dstar:0' : 'star:1';
    const spot = this.board.findFree(this.board.cols / 2, this.board.rows / 2, 1, 1, 12, true);
    if (spot) {
      const s = this.board.spawn(key, spot[0], spot[1]);
      s.pop = 1;
      this.fx.spawnBurst(s);
    }
    this.fx.banner(`Quest complete: ${q.label}`, 'info');
    this.audio.star();
  }

  finishLevel() {
    if (this.mode !== 'level') {
      this.fx.banner('Camp goal reached!', 'wonder');
      this.audio.fanfare();
      // re-arm a harder camp goal
      this.level.complete = false;
      this.level.end = OBJ.power(Math.ceil((this.dragons.totalPower() + 60) / 20) * 20);
      return;
    }
    const spec = this.levelSpec;
    const stars = this.level.starsDone;
    const prev = this.save.levels[spec.id] || { stars: 0, done: false, plays: 0 };
    this.save.levels[spec.id] = {
      stars: Math.max(prev.stars, stars),
      done: true,
      plays: (prev.plays || 0) + 1,
    };
    this.stats.levelsDone++;
    // rewards: the declared carry-out list, plus the best things left on the board
    const rewards = [...spec.rewards];
    const best = this.board.objs
      .filter((o) => o.d.worth > 0 && !o.d.unmergeable)
      .sort((a, b) => b.d.worth - a.d.worth)
      .slice(0, 1 + stars);
    for (const o of best) rewards.push(o.key);
    this.save.carried = [...(this.save.carried || []), ...rewards];
    this.save.coins += 40 * (1 + stars);
    this.save.gems += stars === 3 ? 3 : 1;
    this.persist();
    this.input.enabled = false;
    this.audio.fanfare();
    setTimeout(() => {
      this.hud.showLevelComplete(spec, stars, rewards, () => this.gotoMap());
    }, 900);
  }

  regenChalices() {
    // one chalice per 30s here (the real game takes an hour); capped at 7
    const now = Date.now();
    const per = 30000;
    const elapsed = now - (this.save.chaliceAt || now);
    if (this.save.chalices >= 7) { this.save.chaliceAt = now; return; }
    const gained = Math.floor(elapsed / per);
    if (gained > 0) {
      this.save.chalices = Math.min(7, this.save.chalices + gained);
      this.save.chaliceAt = now - (elapsed % per);
    }
  }

  persist() {
    if (this.mode === 'camp') this.save.camp = SaveLib.snapshotBoard(this.board);
    this.save.stats = this.stats;
    SaveLib.save(this.save);
  }

  // ------------------------------------------------------------------------
  // tick
  // ------------------------------------------------------------------------
  tick(dt) {
    const board = this.board;
    board.time += dt;

    // pop animations, harvest-ready markers, passive spawners
    for (const o of [...board.objs]) {
      if (o.pop > 0) o.pop = Math.max(0, o.pop - dt * 2.6);
      const d = o.d;
      // anything buried surfaces as soon as its tile is alive, whatever healed
      // it -- healing power, a dead-land merge, a heal extender or a goddess
      if (!o.hidden && !this.save.discovered[o.key]) this.discover(o.key);
      if (o.hidden && board.isLive(o.x, o.y)) {
        o.hidden = false;
        o.pop = 1;
        this.fx.spawnBurst(o);
        this.fx.floatText(o.cx, o.cy - 0.5, o.d.name, RARITY[o.d.rarity] || '#fff', 0.95);
        this.discover(o.key);
        if (o.d.dragon) this.dragons.attach(o);
      }
      if (d.harvest && !o.hidden) {
        o.ready = (board.time - o.lastHarvest) >= d.harvest.every;
      }
      // a Dimensional Jar stands for a while, then is gone
      if (d.chain === 'jar' && o.expires && board.time > o.expires) {
        this.fx.spark(o.cx - 0.5, o.cy - 0.5, '#bfe8ff', 10, 2, 0.7, 2.6);
        this.fx.floatText(o.cx, o.cy, 'The jar fades away', '#bfe8ff', 1);
        board.remove(o);
        continue;
      }
      // Healing Goddesses pour out healing power on their own timer
      if (d.godHeal && !o.hidden) {
        if (board.time - (o.lastGod || 0) >= d.godEvery) {
          o.lastGod = board.time;
          if (board.time > 1) this.releaseHeal(o, d.godHeal);
        }
      }
      if (d.spawns && !o.hidden) {
        if (board.time - o.lastSpawn >= d.spawns.every) {
          o.lastSpawn = board.time + Math.random() * 4;
          const spot = board.findFree(o.x, o.y, 1, 1, 3, true);
          if (spot) {
            const it = board.spawn(d.spawns.item, spot[0], spot[1]);
            it.pop = 1;
            this.fx.mote(it.cx - 0.5, it.cy - 0.5, '#d0ffb0', 4);
          }
        }
      }
      // zomblins creep and un-heal the land
      if (d.chain === 'zomblin' && !o.hidden) {
        o.zTimer = (o.zTimer || 0) + dt;
        if (o.zTimer > 6) {
          o.zTimer = 0;
          const i = board.idx(o.x, o.y);
          if (board.land[i] === LIVE && Math.random() < 0.5) {
            board.land[i] = DEAD;
            board.paid[i] = 0;
            board.landDirty = true;
            this.fx.floatText(o.cx, o.cy, 'The land dies!', '#c98fd0', 1);
          }
          // shamble
          const opts = [];
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
            if ((!dx && !dy)) continue;
            if (board.fits(o, o.x + dx, o.y + dy, o) && board.isPlayable(o.x + dx, o.y + dy)) opts.push([o.x + dx, o.y + dy]);
          }
          if (opts.length) {
            const [nx, ny] = opts[Math.floor(Math.random() * opts.length)];
            board.unplace(o); board.place(o, nx, ny);
          }
        }
      }
      // ambient motes over living things
      if (o.ready && Math.random() < dt * 1.4) this.fx.mote(o.cx - 0.5, o.cy - 1, '#fff3b0', 1);
    }

    this.dragons.update(dt);
    this.fx.update(dt);
    this.input.update(dt);
    this.checkQuests();

    this.saveTimer += dt;
    if (this.saveTimer > 4) {
      this.saveTimer = 0;
      this.regenChalices();
      if (this.mode === 'camp') this.persist(); else SaveLib.save(this.save);
    }
  }

  frame(t) {
    // A requestAnimationFrame timestamp can predate the performance.now() taken
    // in the constructor, so the first frame's delta can come out negative --
    // which ran effect timers backwards and produced negative draw radii.
    const dt = Math.max(0, Math.min(0.05, (t - this.last) / 1000));
    this.last = t;
    if (this.mode === 'level' || this.mode === 'camp') {
      this.tick(dt);
      this.render.update(dt, this.board);
      this.render.draw(this);
    } else {
      this.fx.update(dt);
      const ctx = this.render.ctx;
      ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    this.audio.updateMusic(dt);
    this.hud.update();
    requestAnimationFrame((tt) => this.frame(tt));
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.__game = new Game();
    document.getElementById('boot').classList.add('gone');
  } catch (err) {
    const b = document.getElementById('boot');
    if (b) b.textContent = 'Failed to start: ' + (err && err.message);
    console.error(err);
  }
});
