// hud.js -- DOM overlay: resource bar, quest panel, object information bar,
// world map, and the reward/chest moment. Mirrors the real game's layout:
// resources across the top, quests top-right, an Object Information Bar at the
// bottom-left carrying the item name, its quote, its chain level and an action
// button whose label states what a tap does.

import { fmt } from './fx.js';
import { RARITY, def, CHAINS } from './registry.js';
import { spriteFor } from './sprites.js';
import { LEVELS, MAP_NODES } from './levels.js';
import { makeCanvas, rgba, shade, rngFrom, radialGlow, sparkle, roundRect, blob, mix } from './artlib.js';

function el(tag, cls, html) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
}

// A small canvas thumbnail of an item, used all over the UI.
export function thumb(key, size = 46) {
  const d = def(key);
  const c = el('canvas', 'thumb');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  const sp = spriteFor(d, d.art === 'dragon' ? 'r1' : '');
  const s = Math.min(size / sp.w, size / sp.h) * 1.32;
  ctx.drawImage(sp.canvas, size / 2 - sp.gx * s, size * 0.94 - sp.gy * s, sp.w * s, sp.h * s);
  c.style.width = size + 'px'; c.style.height = size + 'px';
  return c;
}

export class Hud {
  constructor(game, root) {
    this.game = game;
    this.root = root;
    this.build();
  }

  build() {
    const g = this.game;

    // ---- top resource bar
    this.top = el('div', 'topbar');
    this.res = {};
    const mk = (id, icon, title) => {
      const b = el('div', 'chip');
      b.title = title;
      b.appendChild(el('span', 'chip-ico', icon));
      const v = el('span', 'chip-val', '0');
      b.appendChild(v);
      this.res[id] = v;
      this.top.appendChild(b);
      return b;
    };
    this.levelTag = el('div', 'levelname', 'Camp');
    this.top.appendChild(this.levelTag);
    mk('coins', coinIcon(), 'Magic Coins');
    mk('bricks', brickIcon(), 'Stone Bricks');
    mk('gems', gemIcon(), 'Dragon Gems');
    mk('power', clawIcon(), 'Dragon Power');
    mk('chal', chaliceIcon(), 'Dragon Chalices');

    this.btnMap = el('button', 'btn ghost', 'World Map');
    this.btnMap.onclick = () => g.gotoMap();
    this.btnCamp = el('button', 'btn ghost', 'Camp');
    this.btnCamp.onclick = () => g.gotoCamp();
    this.btnSound = el('button', 'btn ghost icon', '&#9835;');
    this.btnSound.title = 'Sound on/off';
    this.btnSound.onclick = () => {
      g.audio.enabled = !g.audio.enabled;
      g.audio.musicOn = g.audio.enabled;
      this.btnSound.classList.toggle('off', !g.audio.enabled);
    };
    this.btnShop = el('button', 'btn ghost', 'Buy');
    this.btnShop.title = 'Buy Menu: Egg Shop and Build Shop';
    this.btnShop.onclick = () => g.showShop();
    this.btnBook = el('button', 'btn ghost', 'Book');
    this.btnBook.title = 'Dragon Book: everything discovered';
    this.btnBook.onclick = () => g.showBook();
    this.btnHelp = el('button', 'btn ghost icon', '?');
    this.btnHelp.title = 'How to play';
    this.btnHelp.onclick = () => g.showHelp();
    const nav = el('div', 'nav');
    nav.append(this.btnCamp, this.btnMap, this.btnShop, this.btnBook, this.btnSound, this.btnHelp);
    this.top.appendChild(nav);
    this.root.appendChild(this.top);

    // ---- quest panel
    this.quest = el('div', 'panel quests');
    this.root.appendChild(this.quest);

    // ---- object information bar
    this.info = el('div', 'panel infobar hidden');
    this.infoThumb = el('div', 'info-thumb');
    this.infoBody = el('div', 'info-body');
    this.infoName = el('div', 'info-name', '');
    this.infoQuote = el('div', 'info-quote', '');
    this.infoMeta = el('div', 'info-meta', '');
    this.infoBody.append(this.infoName, this.infoQuote, this.infoMeta);
    this.infoActions = el('div', 'info-actions');
    this.actBtn = el('button', 'btn primary', 'Tap');
    this.actBtn.onclick = () => { if (g.selected) g.tap(g.selected); };
    this.sellBtn = el('button', 'btn danger', 'Sell');
    this.sellBtn.onclick = () => { if (g.selected) g.sell(g.selected); };
    this.chainBtn = el('button', 'btn ghost', 'Chain');
    this.chainBtn.onclick = () => { if (g.selected) this.showChain(g.selected.key); };
    this.infoActions.append(this.actBtn, this.chainBtn, this.sellBtn);
    this.info.append(this.infoThumb, this.infoBody, this.infoActions);
    this.root.appendChild(this.info);

    // ---- hint line
    this.hint = el('div', 'hint', 'Drag 3 matching objects together to merge. 5 at once gives two.');
    this.root.appendChild(this.hint);

    // ---- modal layer
    this.modal = el('div', 'modal hidden');
    this.modalBox = el('div', 'modal-box');
    this.modal.appendChild(this.modalBox);
    this.modal.onclick = (e) => { if (e.target === this.modal) this.hideModal(); };
    this.root.appendChild(this.modal);

    // ---- world map screen
    this.map = el('div', 'screen map hidden');
    this.mapCanvas = el('canvas', 'mapcanvas');
    this.map.appendChild(this.mapCanvas);
    this.mapNodes = el('div', 'mapnodes');
    this.map.appendChild(this.mapNodes);
    const mapTop = el('div', 'maptop');
    mapTop.appendChild(el('div', 'maptitle', 'Merge Dragons'));
    const backCamp = el('button', 'btn primary', 'Enter Camp');
    backCamp.onclick = () => g.gotoCamp();
    mapTop.appendChild(backCamp);
    this.map.appendChild(mapTop);
    this.root.appendChild(this.map);
  }

  // ------------------------------------------------------------------------
  update() {
    const g = this.game;
    const coinCap = g.storageCap('coins'), brickCap = g.storageCap('bricks');
    this.res.coins.textContent = `${fmt(g.save.coins)}/${fmt(coinCap)}`;
    this.res.bricks.textContent = `${fmt(g.save.bricks)}/${fmt(brickCap)}`;
    this.res.coins.parentNode.classList.toggle('full', g.save.coins >= coinCap);
    this.res.bricks.parentNode.classList.toggle('full', g.save.bricks >= brickCap);
    this.res.gems.textContent = fmt(g.save.gems);
    this.res.power.textContent = fmt(g.dragons.totalPower());
    this.res.chal.textContent = `${g.save.chalices}/7`;
    this.levelTag.textContent = g.mode === 'camp' ? 'Camp' : (g.levelSpec ? g.levelSpec.name : '');
    this.btnCamp.classList.toggle('hidden', g.mode === 'camp');

    this.renderQuests();
    this.renderInfo();
  }

  renderQuests() {
    const g = this.game;
    const L = g.level;
    if (!L) { this.quest.classList.add('hidden'); return; }
    this.quest.classList.remove('hidden');
    const rows = [];
    const line = (o, isEnd) => {
      const target = o.dyn ? o.dyn(g) : o.target;
      const p = Math.min(target, Math.max(0, o.prog(g)));
      const done = p >= target && target > 0;
      const pct = target > 0 ? Math.round((p / target) * 100) : 0;
      return `<div class="q ${done ? 'done' : ''} ${isEnd ? 'end' : ''}">
        <div class="q-tick">${done ? '&#10003;' : (isEnd ? '&#9873;' : '&#9734;')}</div>
        <div class="q-main">
          <div class="q-label">${o.label}</div>
          <div class="q-bar"><i style="width:${Math.min(100, pct)}%"></i></div>
        </div>
        <div class="q-num">${fmt(p)}/${fmt(target)}</div>
      </div>`;
    };
    rows.push(`<div class="panel-h">Goal</div>`);
    rows.push(line(L.end, true));
    rows.push(`<div class="panel-h">Quests <span class="stars">${'&#9733;'.repeat(L.starsDone)}${'&#9734;'.repeat(3 - L.starsDone)}</span></div>`);
    for (const q of L.quests) rows.push(line(q, false));
    if (this.game.mode === 'level') {
      rows.push(`<div class="q-foot">Dead land left: <b>${this.game.board.deadTiles()}</b></div>`);
    }
    this.quest.innerHTML = rows.join('');
  }

  renderInfo() {
    const g = this.game;
    const o = g.selected;
    if (!o || !g.board.objs.includes(o)) {
      this.info.classList.add('hidden');
      return;
    }
    this.info.classList.remove('hidden');
    const d = o.d;
    if (this.infoThumb._key !== d.key) {
      this.infoThumb.innerHTML = '';
      this.infoThumb.appendChild(thumb(d.key, 62));
      this.infoThumb._key = d.key;
    }
    this.infoName.textContent = d.name;
    this.infoName.style.color = RARITY[d.rarity] || '#fff';
    this.infoQuote.textContent = d.desc;
    const chain = CHAINS[d.chain];
    let meta = `${chain.label} &middot; Level ${d.level}/${chain.items.length - 1} &middot; <span class="rar" style="color:${RARITY[d.rarity]}">${d.rarity}</span>`;
    if (o.dragon) {
      meta += ` &middot; ${o.dragon.type || 'No Type'} &middot; Stamina ${o.dragon.stamina}/${o.dragon.maxStamina} &middot; ${fmt(o.dragon.dp)} DP`;
    }
    if (d.hp) meta += ` &middot; ${o.hpLeft === undefined ? d.hp : o.hpLeft}/${d.hp} HP`;
    if (d.leftover) meta += ` &middot; holding ${fmt(o.amount || 0)} ${d.leftover}`;
    if (d.chain === 'jar' && o.contents) {
      const inside = def(o.contents);
      meta += ` &middot; ${inside ? inside.name : '?'} inside &middot; ${fmt(o.gems || 0)} gems`;
    }
    if (d.storage) meta += ` &middot; +${fmt(d.storage.add)} ${d.storage.cur} storage`;
    this.infoMeta.innerHTML = meta;

    const act = g.actionLabel(o);
    const merge = !act && g.canMerge(o);
    this.actBtn.textContent = act || (merge ? 'Merge 3 to advance' : 'Nothing to do');
    this.actBtn.disabled = !act;
    this.sellBtn.textContent = d.worth ? `Sell ${fmt(d.worth)}` : 'Sell';
    this.sellBtn.disabled = !d.worth;
    this.chainBtn.classList.toggle('hidden', !CHAINS[d.chain] || CHAINS[d.chain].items.length < 3);
  }

  setHint(text) { this.hint.textContent = text; }

  // ------------------------------------------------------------------------
  showModal(html, buttons) {
    this.modalBox.innerHTML = html;
    const bar = el('div', 'modal-btns');
    for (const [label, fn, cls] of buttons) {
      const b = el('button', 'btn ' + (cls || 'primary'), label);
      b.onclick = () => fn();
      bar.appendChild(b);
    }
    this.modalBox.appendChild(bar);
    this.modal.classList.remove('hidden');
  }
  hideModal() { this.modal.classList.add('hidden'); }

  showLevelInfo(spec, state, onPlay) {
    const stars = state.stars || 0;
    const html = `
      <div class="m-kicker">${spec.region}</div>
      <div class="m-title">${spec.name}</div>
      <div class="m-blurb">${spec.blurb}</div>
      <div class="m-stars">${'&#9733;'.repeat(stars)}${'&#9734;'.repeat(3 - stars)}</div>
      <div class="m-row"><span>Goal</span><b>${spec.end.label}</b></div>
      <div class="m-quests">${spec.quests.map((q) => `<div>&#9734; ${q.label}</div>`).join('')}</div>
      <div class="m-row"><span>Cost</span><b>${spec.chalices} Chalice${spec.chalices > 1 ? 's' : ''}</b></div>
      <div class="m-rewards"><span>Carry out</span><div class="m-rew-list" id="mrew"></div></div>`;
    this.showModal(html, [
      ['Play', () => { this.hideModal(); onPlay(); }, 'primary'],
      ['Back', () => this.hideModal(), 'ghost'],
    ]);
    const slot = this.modalBox.querySelector('#mrew');
    if (slot) for (const k of spec.rewards) slot.appendChild(thumb(k, 44));
  }

  showLevelComplete(spec, stars, rewards, onCollect) {
    const html = `
      <div class="m-kicker">Level complete</div>
      <div class="m-title">${spec.name}</div>
      <div class="m-stars big">${'&#9733;'.repeat(stars)}${'&#9734;'.repeat(3 - stars)}</div>
      <div class="m-blurb">${stars === 3 ? 'Every quest done. The land is whole.' : stars > 0 ? 'Quests completed: ' + stars + ' of 3.' : 'Goal reached. The quests are still open.'}</div>
      <div class="chestwrap"><canvas id="chestcv" width="220" height="180"></canvas></div>
      <div class="m-rewards"><span>Carried to Camp</span><div class="m-rew-list" id="mrew2"></div></div>`;
    this.showModal(html, [['Collect', () => { this.hideModal(); onCollect(); }, 'primary']]);
    const slot = this.modalBox.querySelector('#mrew2');
    if (slot) for (const k of rewards) slot.appendChild(thumb(k, 48));
    const cv = this.modalBox.querySelector('#chestcv');
    if (cv) drawChestBurst(cv);
  }

  // The Buy Menu: an Egg Shop paid in Coins and a Build Shop paid in Bricks.
  showShop(entries, canAfford, onBuy) {
    const html = `<div class="m-kicker">Buy Menu</div><div class="m-title">Shop</div>
      <div class="shopgrid" id="shop"></div>
      <div class="m-blurb">Eggs cost Coins. Buildings cost Stone Bricks &mdash; Coin Vaults and Stone Yards
      raise how much currency you can hold. The Chest of Soul Crystals costs Dragon Gems.</div>`;
    this.showModal(html, [['Close', () => this.hideModal(), 'primary']]);
    const grid = this.modalBox.querySelector('#shop');
    let section = null;
    for (const e of entries) {
      if (e.head) {
        grid.appendChild(el('div', 'shop-head', e.head));
        continue;
      }
      const ok = canAfford(e);
      const b = el('button', 'shopitem' + (ok ? '' : ' poor'));
      b.appendChild(thumb(e.key, 46));
      b.appendChild(el('div', 'si-name', e.label || def(e.key).name));
      b.appendChild(el('div', 'si-cost', `${fmt(e.cost)} ${e.cur === 'bricks' ? 'bricks' : e.cur === 'gems' ? 'gems' : 'coins'}`));
      b.disabled = !ok;
      b.onclick = () => { onBuy(e); this.hideModal(); };
      grid.appendChild(b);
    }
  }

  // The Dragon Book: what has been discovered, per merge chain.
  showBook(discovered) {
    const chains = Object.values(CHAINS);
    let total = 0, found = 0;
    for (const c of chains) for (const it of c.items) { total++; if (discovered[it.key]) found++; }
    const html = `<div class="m-kicker">Discovery Book</div><div class="m-title">${found} / ${total} found</div>
      <div class="bookwrap" id="book"></div>`;
    this.showModal(html, [['Close', () => this.hideModal(), 'primary']]);
    const wrap = this.modalBox.querySelector('#book');
    for (const c of chains) {
      const n = c.items.filter((it) => discovered[it.key]).length;
      const row = el('div', 'bookrow');
      row.appendChild(el('div', 'bk-h', `${c.label} <b>${n}/${c.items.length}</b>`));
      const strip = el('div', 'bk-strip');
      for (const it of c.items) {
        const cell = el('div', 'bk-cell' + (discovered[it.key] ? '' : ' unknown'));
        if (discovered[it.key]) { cell.appendChild(thumb(it.key, 34)); cell.title = it.name; }
        else cell.textContent = '?';
        strip.appendChild(cell);
      }
      row.appendChild(strip);
      wrap.appendChild(row);
    }
  }

  showChain(key) {
    const d = def(key);
    const c = CHAINS[d.chain];
    const html = `<div class="m-kicker">Known Match Chain For</div><div class="m-title">${c.label}</div>
      <div class="chainstrip" id="cstrip"></div>
      <div class="m-blurb">Merge 3 for one of the next level. Merge 5 for two.</div>`;
    this.showModal(html, [['Close', () => this.hideModal(), 'primary']]);
    const strip = this.modalBox.querySelector('#cstrip');
    c.items.forEach((it, i) => {
      const cellEl = el('div', 'cstep' + (it.key === key ? ' cur' : ''));
      cellEl.appendChild(thumb(it.key, 44));
      cellEl.appendChild(el('div', 'cstep-n', it.name));
      strip.appendChild(cellEl);
      if (i < c.items.length - 1) strip.appendChild(el('div', 'carrow', '&rsaquo;'));
    });
  }

  // ------------------------------------------------------------------------
  showMap(save, onPick) {
    this.map.classList.remove('hidden');
    const w = this.map.clientWidth || window.innerWidth;
    const h = this.map.clientHeight || window.innerHeight;
    drawWorldMap(this.mapCanvas, w, h, save);
    this.mapNodes.innerHTML = '';
    LEVELS.forEach((L, i) => {
      const n = MAP_NODES[i];
      const st = save.levels[L.id] || { stars: 0, done: false };
      const unlocked = i === 0 || (save.levels[LEVELS[i - 1].id] && save.levels[LEVELS[i - 1].id].done);
      const node = el('button', `mapnode ${unlocked ? '' : 'locked'} ${st.done ? 'done' : ''}`);
      node.style.left = (n.x * 100) + '%';
      node.style.top = (n.y * 100) + '%';
      node.innerHTML = `<span class="mn-i">${unlocked ? (st.done ? '&#10003;' : L.id) : '&#128274;'}</span>
        <span class="mn-name">${L.name}</span>
        <span class="mn-stars">${'&#9733;'.repeat(st.stars)}${'&#9734;'.repeat(3 - st.stars)}</span>`;
      node.disabled = !unlocked;
      node.onclick = () => onPick(L, st);
      this.mapNodes.appendChild(node);
    });
  }
  hideMap() { this.map.classList.add('hidden'); }
}

// ---------------------------------------------------------------------------
// procedural icons for the resource chips
// ---------------------------------------------------------------------------
function svg(inner, vb = '0 0 24 24') {
  return `<svg viewBox="${vb}" width="20" height="20">${inner}</svg>`;
}
function coinIcon() {
  return svg(`<defs><radialGradient id="cg" cx="35%" cy="30%"><stop offset="0" stop-color="#fff3b0"/><stop offset="1" stop-color="#d99b2b"/></radialGradient></defs>
  <circle cx="12" cy="12" r="9" fill="url(#cg)" stroke="#8f5f16" stroke-width="1.4"/>
  <circle cx="12" cy="12" r="5.4" fill="none" stroke="#b07a20" stroke-width="1.1"/>
  <path d="M12 8.4l1.6 2.4 2.4.6-2 1.9.4 2.7-2.4-1.3-2.4 1.3.4-2.7-2-1.9 2.4-.6z" fill="#a86f1c"/>`);
}
function brickIcon() {
  return svg(`<rect x="3" y="12" width="8.5" height="5" rx="1" fill="#d0b48a" stroke="#8a6f45" stroke-width="1"/>
  <rect x="12.5" y="12" width="8.5" height="5" rx="1" fill="#c2a67d" stroke="#8a6f45" stroke-width="1"/>
  <rect x="7.5" y="6.5" width="9" height="5" rx="1" fill="#dcc39a" stroke="#8a6f45" stroke-width="1"/>`);
}
function gemIcon() {
  return svg(`<defs><linearGradient id="gg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffd0f5"/><stop offset="1" stop-color="#d6238c"/></linearGradient></defs>
  <path d="M12 3l7 5.5-2.6 10.5H7.6L5 8.5z" fill="url(#gg)" stroke="#96176a" stroke-width="1.2"/>
  <path d="M12 3v16M5 8.5h14" stroke="#fff" stroke-opacity=".45" stroke-width="1"/>`);
}
function clawIcon() {
  return svg(`<path d="M5 19c2-6 5-9 7-12M9 19c1-6 3-9 5-12M13 19c0-5 2-8 4-11" stroke="#ff9f5f" stroke-width="2.1" fill="none" stroke-linecap="round"/>
  <circle cx="12" cy="20.4" r="1.6" fill="#ffcf8f"/>`);
}
function chaliceIcon() {
  return svg(`<path d="M7 4h10l-1 5a4 4 0 0 1-8 0z" fill="#e8c76b" stroke="#8f6a1f" stroke-width="1.2"/>
  <path d="M12 13v5M9 19h6" stroke="#8f6a1f" stroke-width="1.6" stroke-linecap="round"/>
  <path d="M8.5 5.5h7l-.5 2.5H9z" fill="#fff5c0" opacity=".7"/>`);
}

// ---------------------------------------------------------------------------
// world map art
// ---------------------------------------------------------------------------
function drawWorldMap(canvas, w, h, save) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  const rnd = rngFrom(20260812);

  // sky / sea
  const g = ctx.createLinearGradient(0, 0, 0, h);
  g.addColorStop(0, '#2c2450');
  g.addColorStop(0.4, '#3f5f8f');
  g.addColorStop(0.75, '#4f8fa8');
  g.addColorStop(1, '#79b8b0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 120; i++) {
    const x = rnd() * w, y = rnd() * h * 0.45;
    ctx.fillStyle = rgba('#ffffff', 0.1 + rnd() * 0.55);
    ctx.beginPath(); ctx.arc(x, y, 0.5 + rnd() * 1.3, 0, 6.3); ctx.fill();
  }
  radialGlow(ctx, w * 0.78, h * 0.16, Math.min(w, h) * 0.42, '#ffd9a8', 0.24);

  // ocean sparkle bands
  for (let i = 0; i < 40; i++) {
    const y = h * 0.35 + rnd() * h * 0.65;
    ctx.strokeStyle = rgba('#ffffff', 0.05 + rnd() * 0.1);
    ctx.lineWidth = 1 + rnd() * 2;
    ctx.beginPath();
    const x0 = rnd() * w;
    ctx.moveTo(x0, y);
    ctx.quadraticCurveTo(x0 + 30, y - 4, x0 + 60 + rnd() * 60, y);
    ctx.stroke();
  }

  // the winding path
  ctx.save();
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255,240,200,0.28)';
  ctx.lineWidth = 16;
  ctx.setLineDash([2, 20]);
  ctx.beginPath();
  MAP_NODES.forEach((n, i) => {
    const x = n.x * w, y = n.y * h;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.restore();

  // islands under each node -- all islands first, then every label, so a later
  // island can never paint over an earlier island's text
  MAP_NODES.forEach((n, i) => {
    const L = LEVELS[i];
    const st = save.levels[L.id] || { stars: 0, done: false };
    const unlocked = i === 0 || (save.levels[LEVELS[i - 1].id] && save.levels[LEVELS[i - 1].id].done);
    const x = n.x * w, y = n.y * h;
    const r = 44 + (i % 3) * 7;
    ctx.save();
    // shadow
    ctx.fillStyle = 'rgba(10,20,40,0.3)';
    blob(ctx, x + 6, y + 16, r * 0.9, r * 0.32, 9, 0.16, rngFrom(i * 7 + 3));
    ctx.fill();
    // land
    const j = rngFrom(i * 31 + 11);
    blob(ctx, x, y + 6, r * 0.86, r * 0.42, 10, 0.18, j);
    const lg = ctx.createLinearGradient(0, y - r * 0.4, 0, y + r * 0.5);
    if (unlocked) {
      lg.addColorStop(0, '#8fd06a'); lg.addColorStop(0.6, '#559440'); lg.addColorStop(1, '#7a5a3a');
    } else {
      lg.addColorStop(0, '#6f6a7a'); lg.addColorStop(0.6, '#4a4656'); lg.addColorStop(1, '#3a3644');
    }
    ctx.fillStyle = lg;
    ctx.fill();
    ctx.strokeStyle = rgba('#2f2a38', 0.4); ctx.lineWidth = 2; ctx.stroke();
    // little trees / rocks
    for (let k = 0; k < 5; k++) {
      const tx = x + (j() - 0.5) * r * 1.2, ty = y + (j() - 0.5) * r * 0.28;
      if (unlocked) {
        ctx.fillStyle = '#3f7a3a';
        ctx.beginPath(); ctx.ellipse(tx, ty - 8, 6 + j() * 4, 8 + j() * 5, 0, 0, 6.3); ctx.fill();
        ctx.fillStyle = '#6f4a2f';
        ctx.fillRect(tx - 1.4, ty - 3, 2.8, 6);
      } else {
        ctx.fillStyle = '#5a5666';
        ctx.beginPath(); ctx.ellipse(tx, ty - 3, 5 + j() * 4, 4 + j() * 3, 0, 0, 6.3); ctx.fill();
      }
    }
    if (st.done) radialGlow(ctx, x, y, r * 1.1, '#ffe9a0', 0.3);
    ctx.restore();
  });

  // second pass: region labels above the islands, always legible
  MAP_NODES.forEach((n, i) => {
    const L = LEVELS[i];
    const x = n.x * w, y = n.y * h;
    const r = 44 + (i % 3) * 7;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '800 11px "Trebuchet MS", system-ui, sans-serif';
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(16,10,28,0.75)';
    ctx.strokeText(L.region.toUpperCase(), x, y - r * 1.0);
    ctx.fillStyle = rgba('#ffe9c0', 0.85);
    ctx.fillText(L.region.toUpperCase(), x, y - r * 1.0);
    ctx.restore();
  });

  // floating motes
  for (let i = 0; i < 50; i++) {
    sparkle(ctx, rnd() * w, rnd() * h, 1 + rnd() * 2.4, '#ffffff', 0.3 + rnd() * 0.4);
  }
}

function drawChestBurst(cv) {
  const ctx = cv.getContext('2d');
  const w = cv.width, h = cv.height;
  const rnd = rngFrom(7);
  ctx.clearRect(0, 0, w, h);
  radialGlow(ctx, w / 2, h * 0.52, w * 0.5, '#ffe08f', 0.55);
  // light rays
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + 0.2;
    ctx.strokeStyle = rgba('#fff3c0', 0.14 + rnd() * 0.16);
    ctx.lineWidth = 4 + rnd() * 9;
    ctx.beginPath();
    ctx.moveTo(w / 2, h * 0.56);
    ctx.lineTo(w / 2 + Math.cos(a) * w * 0.6, h * 0.56 + Math.sin(a) * w * 0.6);
    ctx.stroke();
  }
  ctx.restore();
  // open chest
  const cw = w * 0.46, ch = cw * 0.62, x = w / 2 - cw / 2, y = h * 0.56;
  roundRect(ctx, x, y, cw, ch, 8);
  const bg = ctx.createLinearGradient(0, y, 0, y + ch);
  bg.addColorStop(0, '#c98f4f'); bg.addColorStop(1, '#7a4f28');
  ctx.fillStyle = bg; ctx.fill();
  ctx.strokeStyle = '#5f3a1c'; ctx.lineWidth = 2; ctx.stroke();
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(-0.42);
  roundRect(ctx, -2, -ch * 0.72, cw, ch * 0.6, 10);
  const lg = ctx.createLinearGradient(0, -ch * 0.7, 0, 0);
  lg.addColorStop(0, '#e0a85f'); lg.addColorStop(1, '#9a6a35');
  ctx.fillStyle = lg; ctx.fill();
  ctx.strokeStyle = '#5f3a1c'; ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#c9a04f';
  ctx.fillRect(x + cw * 0.08, y, cw * 0.07, ch);
  ctx.fillRect(x + cw * 0.85, y, cw * 0.07, ch);
  for (let i = 0; i < 26; i++) {
    sparkle(ctx, w / 2 + (rnd() - 0.5) * w * 0.8, h * (0.2 + rnd() * 0.5), 2 + rnd() * 4, '#fffbd0', 0.85);
  }
}
