// fx.js -- particles, floating numbers, banners. Positions are in TILE units;
// the renderer converts to screen space so effects follow camera pan/zoom.

import { rgba, shade } from './artlib.js';

export class Fx {
  constructor() {
    this.parts = [];
    this.texts = [];
    this.banners = [];
    this.rings = [];
    this.bolts = [];
    this.landPulses = [];
    this.shake = 0;
  }

  // --- emitters -----------------------------------------------------------
  spark(x, y, color, n = 8, spd = 2.2, life = 0.7, size = 3) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = spd * (0.3 + Math.random() * 0.9);
      this.parts.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 0.6,
        g: 2.4, life, t: 0, color, size: size * (0.5 + Math.random()), kind: 'spark',
      });
    }
  }

  mote(x, y, color, n = 3) {
    for (let i = 0; i < n; i++) {
      this.parts.push({
        x: x + (Math.random() - 0.5) * 0.7, y: y + (Math.random() - 0.5) * 0.5,
        vx: (Math.random() - 0.5) * 0.25, vy: -0.25 - Math.random() * 0.3,
        g: -0.05, life: 1.6 + Math.random(), t: 0, color, size: 1.6 + Math.random() * 1.8, kind: 'mote',
      });
    }
  }

  merge(obj, cx, cy, d) {
    // each merged object flies to the centre then bursts
    this.parts.push({
      x: obj.cx - 0.5, y: obj.cy - 0.5, tx: cx - 0.5, ty: cy - 0.5,
      life: 0.22, t: 0, color: d.tint, kind: 'suck', obj: null,
    });
    this.spark(obj.cx - 0.5, obj.cy - 0.5, d.tint, 5, 1.6, 0.5, 2.6);
  }

  mergePop(made, n, combo) {
    for (const m of made) {
      this.rings.push({ x: m.cx - 0.5, y: m.cy - 0.5, r: 0.2, max: 1.5 + m.d.idx * 0.06, life: 0.5, t: 0, color: m.d.tint });
      this.spark(m.cx - 0.5, m.cy - 0.5, '#fff8d0', 14, 3, 0.8, 3.4);
      this.spark(m.cx - 0.5, m.cy - 0.5, m.d.tint, 10, 2.2, 0.9, 3);
    }
    if (n >= 5) {
      const m = made[0];
      if (m) this.floatText(m.cx, m.cy - 0.7, 'MERGE 5!  x2', '#ffe066', 1.5);
    }
    this.shake = Math.min(1, this.shake + 0.18 + n * 0.012);
  }

  combo(level, x, y) {
    this.floatText(x, y - 1.1, `COMBO x${level}!`, '#ff9fe0', 1.6);
    this.rings.push({ x: x - 0.5, y: y - 0.5, r: 0.3, max: 2.6, life: 0.7, t: 0, color: '#ff9fe0' });
  }

  spawnBurst(obj) {
    this.spark(obj.cx - 0.5, obj.cy - 0.5, shade(obj.d.tint, 0.4), 8, 1.8, 0.6, 2.6);
    this.rings.push({ x: obj.cx - 0.5, y: obj.cy - 0.5, r: 0.1, max: 0.9, life: 0.35, t: 0, color: '#ffffff' });
  }

  // The spare a merge could not spend, popped back out of the merge flash so
  // the player can see it was returned rather than eaten.
  eject(obj) {
    this.rings.push({ x: obj.cx - 0.5, y: obj.cy - 0.5, r: 0.1, max: 1.05, life: 0.45, t: 0, color: '#ffe9a8' });
    this.spark(obj.cx - 0.5, obj.cy - 0.5, '#ffe9a8', 7, 1.5, 0.55, 2.4);
    this.floatText(obj.cx, obj.cy - 0.55, 'spare returned', '#ffe9a8', 0.9);
  }

  harvestPop(obj) {
    this.spark(obj.cx - 0.5, obj.cy - 0.9, '#fff3b0', 9, 2, 0.6, 2.6);
    this.rings.push({ x: obj.cx - 0.5, y: obj.cy - 0.5, r: 0.2, max: 1.1, life: 0.4, t: 0, color: '#c9ffb0' });
  }

  tap(x, y, color = '#ffffff') {
    this.rings.push({ x: x - 0.5, y: y - 0.5, r: 0.1, max: 0.85, life: 0.32, t: 0, color });
  }

  healPower(x, y, amount) {
    this.floatText(x, y - 0.5, `+${fmt(amount)} healing`, '#8affc8', 1.2);
    for (let i = 0; i < Math.min(26, 8 + Math.log2(amount + 1) * 3); i++) {
      const a = Math.random() * Math.PI * 2;
      this.parts.push({
        x: x - 0.5, y: y - 0.5,
        vx: Math.cos(a) * (1.4 + Math.random() * 2.6), vy: Math.sin(a) * (1.4 + Math.random() * 2.6),
        g: 0, life: 1.1, t: 0, color: '#a8ffd8', size: 2.6, kind: 'heal',
      });
    }
    this.rings.push({ x: x - 0.5, y: y - 0.5, r: 0.2, max: 4.5, life: 0.9, t: 0, color: '#8affc8' });
  }

  landHeal(cells, how) {
    for (const [x, y] of cells) {
      this.landPulses.push({ x, y, t: 0, life: 0.85 });
      this.mote(x, y, '#c9ffd8', 3);
      if (Math.random() < 0.5) this.spark(x, y, '#a8ffd0', 4, 1.2, 0.6, 2.2);
    }
    if (cells.length && how === 'merge') {
      this.floatText(cells[0][0] + 0.5, cells[0][1], 'Land healed!', '#c9ffd8', 1.1);
    }
  }

  fireball(from, to) {
    this.bolts.push({
      x: from.cx - 0.5, y: from.cy - 0.9,
      tx: to.cx - 0.5, ty: to.cy - 0.6, t: 0, life: 0.28,
    });
  }

  floatText(x, y, text, color = '#ffffff', scale = 1) {
    let ty = y - 0.5;
    // stack rather than overlap: nudge above any young label already near here
    for (const t of this.texts) {
      if (t.t > 0.6) continue;
      if (Math.abs(t.x - (x - 0.5)) < 1.4 && Math.abs(t.y - ty) < 0.42) ty = t.y - 0.44;
    }
    this.texts.push({ x: x - 0.5, y: ty, text, color, scale, t: 0, life: 1.5 });
  }

  // One banner on screen at a time; the rest queue behind it so a burst of
  // events never buries the board.
  banner(text, kind = 'info') {
    this.bannerQueue = this.bannerQueue || [];
    if (this.banners.length === 0) this.banners.push({ text, kind, t: 0, life: 2.6 });
    else if (this.bannerQueue.length < 4) this.bannerQueue.push({ text, kind });
  }

  // --- integration --------------------------------------------------------
  update(dt) {
    dt = Math.max(0, Math.min(0.1, dt));
    this.shake = Math.max(0, this.shake - dt * 2.4);
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.t += dt;
      if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
      if (p.kind === 'suck') {
        const k = p.t / p.life;
        p.x += (p.tx - p.x) * Math.min(1, dt * 14);
        p.y += (p.ty - p.y) * Math.min(1, dt * 14);
      } else {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += (p.g || 0) * dt;
        p.vx *= 1 - dt * 1.6; p.vy *= 1 - dt * 0.7;
      }
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.t += dt; t.y -= dt * 0.75;
      if (t.t >= t.life) this.texts.splice(i, 1);
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt;
      if (r.t >= r.life) this.rings.splice(i, 1);
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i]; b.t += dt;
      if (b.t >= b.life) this.bolts.splice(i, 1);
    }
    for (let i = this.landPulses.length - 1; i >= 0; i--) {
      const p = this.landPulses[i]; p.t += dt;
      if (p.t >= p.life) this.landPulses.splice(i, 1);
    }
    for (let i = this.banners.length - 1; i >= 0; i--) {
      const b = this.banners[i]; b.t += dt;
      if (b.t >= b.life) this.banners.splice(i, 1);
    }
    if (this.banners.length === 0 && this.bannerQueue && this.bannerQueue.length) {
      const nb = this.bannerQueue.shift();
      this.banners.push({ text: nb.text, kind: nb.kind, t: 0, life: 2.6 });
    }
  }
}

export function fmt(n) {
  if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'K';
  if (n >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(Math.round(n));
}
