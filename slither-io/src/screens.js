// Title screen and death screen. Plain DOM over the canvas.

import { SKINS } from './config.js';
import { drawSkinSwatch } from './textures.js';

const BEST_KEY = 'slitherclone.best';

export class Screens {
  constructor(root, onPlay) {
    this.root = root;
    this.onPlay = onPlay;
    this.title = root.querySelector('#title');
    this.death = root.querySelector('#death');
    this.nameInput = root.querySelector('#nick');
    this.skinRow = root.querySelector('#skins');
    this.playBtn = root.querySelector('#play');
    this.againBtn = root.querySelector('#again');
    this.skinIndex = (Math.random() * SKINS.length) | 0;
    this.best = Number(localStorage.getItem(BEST_KEY) || 0) || 0;

    this.nameInput.value = localStorage.getItem('slitherclone.nick') || '';

    this.swatches = [];
    SKINS.forEach((skin, i) => {
      const b = document.createElement('button');
      b.className = 'swatch';
      b.type = 'button';
      b.title = skin.name;
      const c = document.createElement('canvas');
      c.width = 128;
      c.height = 34;
      b.appendChild(c);
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectSkin(i);
      });
      this.skinRow.appendChild(b);
      this.swatches.push(b);
      drawSkinSwatch(c, skin);
    });
    this.selectSkin(this.skinIndex);

    this.playBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.start();
    });
    this.againBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.start();
    });

    // The whole overlay is a start button, except the fields you might want to
    // interact with first. Keeps a click-anywhere test harness honest, too.
    const overlayClick = (e) => {
      const t = e.target;
      if (t.closest && (t.closest('#nick') || t.closest('.swatch') || t.closest('#mute'))) return;
      this.start();
    };
    this.title.addEventListener('click', overlayClick);
    this.death.addEventListener('click', overlayClick);

    window.addEventListener('keydown', (e) => {
      if (this.isOpen() && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        this.start();
      }
    });

    this.updateBest();
  }

  selectSkin(i) {
    this.skinIndex = i;
    this.swatches.forEach((s, k) => s.classList.toggle('sel', k === i));
  }

  isOpen() {
    return !this.title.classList.contains('hidden') || !this.death.classList.contains('hidden');
  }

  start() {
    const nick = this.nameInput.value.trim().slice(0, 20);
    localStorage.setItem('slitherclone.nick', nick);
    this.title.classList.add('hidden');
    this.death.classList.add('hidden');
    this.onPlay(nick || 'anonymous snake', SKINS[this.skinIndex]);
  }

  showDeath(info) {
    if (info.score > this.best) {
      this.best = info.score;
      localStorage.setItem(BEST_KEY, String(this.best));
    }
    this.updateBest();
    this.death.querySelector('#d-length').textContent = info.score.toLocaleString();
    this.death.querySelector('#d-rank').textContent = info.rank ? `#${info.rank}` : '-';
    this.death.querySelector('#d-kills').textContent = String(info.kills);
    this.death.querySelector('#d-best').textContent = this.best.toLocaleString();
    this.death.querySelector('#d-cause').textContent = info.byWall
      ? 'You hit the wall.'
      : info.killerName
        ? `You crashed into ${info.killerName}.`
        : 'You crashed.';
    this.death.classList.remove('hidden');
  }

  updateBest() {
    const el = this.root.querySelector('#t-best');
    if (el) el.textContent = this.best.toLocaleString();
  }
}
