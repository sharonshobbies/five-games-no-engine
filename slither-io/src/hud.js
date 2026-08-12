// HUD: live leaderboard, length/rank readout, kill feed, perf line.
//
// All DOM. The leaderboard rebuilds its ten rows in place rather than
// re-creating nodes, so a 60fps update costs nothing measurable.

import { rgbToCss } from './math.js';

const ROWS = 10;

export class Hud {
  constructor(root) {
    this.root = root;
    this.board = root.querySelector('#lb-rows');
    this.boardTitle = root.querySelector('#lb-title');
    this.lengthEl = root.querySelector('#stat-length');
    this.rankEl = root.querySelector('#stat-rank');
    this.killsEl = root.querySelector('#stat-kills');
    this.perfEl = root.querySelector('#perf');
    this.feed = root.querySelector('#killfeed');
    this.nameLayer = root.querySelector('#namelayer');

    this.rows = [];
    for (let i = 0; i < ROWS; i++) {
      const li = document.createElement('li');
      const rank = document.createElement('span');
      rank.className = 'lb-rank';
      const chip = document.createElement('i');
      chip.className = 'lb-chip';
      const name = document.createElement('span');
      name.className = 'lb-name';
      const score = document.createElement('span');
      score.className = 'lb-score';
      li.append(rank, chip, name, score);
      this.board.appendChild(li);
      this.rows.push({ li, rank, chip, name, score });
    }

    this.feedItems = [];
    this.nameTags = [];
    this.nameTagPool = [];
  }

  updateBoard(board, player) {
    for (let i = 0; i < ROWS; i++) {
      const r = this.rows[i];
      const s = board[i];
      if (!s) {
        r.li.style.display = 'none';
        continue;
      }
      r.li.style.display = '';
      r.li.className = s === player ? 'me' : '';
      r.rank.textContent = `${i + 1}.`;
      r.chip.style.background = rgbToCss(s.avgColor());
      r.name.textContent = s.name.length > 15 ? s.name.slice(0, 14) + '…' : s.name;
      r.score.textContent = s.score.toLocaleString();
    }
    this.boardTitle.textContent = `${board.length} snakes`;
  }

  updateStats(player, rank, total) {
    this.lengthEl.textContent = player ? player.score.toLocaleString() : '0';
    this.rankEl.textContent = player ? `${rank} of ${total}` : '-';
    this.killsEl.textContent = player ? String(player.kills) : '0';
  }

  updatePerf(text) {
    this.perfEl.textContent = text;
  }

  pushFeed(text, colour) {
    const el = document.createElement('div');
    el.className = 'feed-line';
    el.innerHTML = text;
    if (colour) el.style.borderLeftColor = colour;
    this.feed.appendChild(el);
    this.feedItems.push({ el, t: 0 });
    while (this.feedItems.length > 5) {
      const old = this.feedItems.shift();
      old.el.remove();
    }
  }

  tickFeed(dt) {
    for (let i = this.feedItems.length - 1; i >= 0; i--) {
      const f = this.feedItems[i];
      f.t += dt;
      if (f.t > 5) {
        f.el.remove();
        this.feedItems.splice(i, 1);
      } else if (f.t > 4) {
        f.el.style.opacity = String(1 - (f.t - 4));
      }
    }
  }

  /**
   * Nickname labels above visible snakes, projected from world to screen.
   * Pooled divs; only visible snakes get one.
   */
  updateNames(entries) {
    // entries: [{name, sx, sy, alpha, scale, colour}]
    while (this.nameTags.length < entries.length) {
      const el = document.createElement('div');
      el.className = 'nametag';
      this.nameLayer.appendChild(el);
      this.nameTags.push(el);
    }
    for (let i = 0; i < this.nameTags.length; i++) {
      const el = this.nameTags[i];
      const e = entries[i];
      if (!e) {
        el.style.display = 'none';
        continue;
      }
      el.style.display = '';
      if (el._name !== e.name) {
        el.textContent = e.name;
        el._name = e.name;
      }
      el.style.transform = `translate(-50%,-50%) translate(${e.sx.toFixed(1)}px,${e.sy.toFixed(1)}px)`;
      el.style.opacity = String(e.alpha);
      el.style.fontSize = `${e.size.toFixed(1)}px`;
      el.style.color = e.colour;
    }
  }
}
