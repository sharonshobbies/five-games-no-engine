// input.js -- pointer handling: drag objects between tiles, snap on drop, tap to
// harvest / open / collect, drag-empty-land to pan, wheel to zoom.

import { previewGroup } from './merge.js';
import { isMergeable } from './registry.js';
import { TW, TH } from './render.js';

const TAP_SLOP = 9;      // px of movement still counted as a tap
const TAP_TIME = 0.45;   // seconds

export class Input {
  constructor(game, canvas) {
    this.game = game;
    this.canvas = canvas;
    this.held = null;
    this.highlight = [];
    this.gx = null; this.gy = null;
    this.dropOk = null;
    this.origin = null;
    this.down = false;
    this.panning = false;
    this.downPos = [0, 0];
    this.lastPos = [0, 0];
    this.downT = 0;
    this.moved = 0;
    this.hover = null;
    this.enabled = true;

    const opt = { passive: false };
    canvas.addEventListener('pointerdown', (e) => this.onDown(e), opt);
    window.addEventListener('pointermove', (e) => this.onMove(e), opt);
    window.addEventListener('pointerup', (e) => this.onUp(e), opt);
    window.addEventListener('pointercancel', (e) => this.onUp(e), opt);
    canvas.addEventListener('wheel', (e) => this.onWheel(e), opt);
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  pos(e) {
    const r = this.canvas.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  }

  cellAt(sx, sy) {
    const [tx, ty] = this.game.render.s2t(sx, sy);
    return [Math.floor(tx), Math.floor(ty)];
  }

  objAt(sx, sy) {
    const board = this.game.board;
    const [cx, cy] = this.cellAt(sx, sy);
    let o = board.at(cx, cy);
    if (o && o.hidden) o = null;
    if (o) return o;
    // forgiving: a tall sprite drawn upward means the visual centre sits a bit
    // above the tile, so also try one row down
    let p = board.at(cx, cy + 1);
    if (p && !p.hidden && p.d.size[1] === 1) {
      const [, py] = this.game.render.t2s(p.x, p.y);
      if (sy < py) return p;
    }
    return null;
  }

  onWheel(e) {
    e.preventDefault();
    const c = this.game.render.cam;
    c.tz = Math.max(0.4, Math.min(1.7, c.tz * (e.deltaY > 0 ? 0.9 : 1.11)));
  }

  onDown(e) {
    if (!this.enabled) return;
    this.game.audio.resume();
    const [sx, sy] = this.pos(e);
    this.down = true;
    this.downPos = [sx, sy];
    this.lastPos = [sx, sy];
    this.downT = 0;
    this.moved = 0;
    this.panning = false;

    const o = this.objAt(sx, sy);
    if (o && this.movable(o)) {
      this.held = o;
      this.origin = [o.x, o.y];
      o.dragging = true;
      o.dx = 0; o.dy = 0;
      // where inside the object the grab happened, so it tracks the cursor
      const [gx, gy] = this.game.render.t2s(o.x + o.w / 2, o.y + o.h);
      this.grabOff = [sx - gx, sy - gy];
      this.game.audio.pickup();
      this.game.select(o);
      this.updateDrag(sx, sy);
    } else {
      this.held = null;
      this.panning = true;
      if (o) this.game.select(o);
    }
    e.preventDefault();
  }

  movable(o) {
    // Demon Gates are immovable; everything else can be dragged.
    if (o.d.chain === 'gate') return false;
    return true;
  }

  onMove(e) {
    if (!this.down) { this.updateHover(e); return; }
    const [sx, sy] = this.pos(e);
    this.moved += Math.hypot(sx - this.lastPos[0], sy - this.lastPos[1]);
    this.lastPos = [sx, sy];
    if (this.held) {
      this.updateDrag(sx, sy);
    } else if (this.panning) {
      const c = this.game.render.cam;
      const z = c.zoom;
      c.tx -= (sx - this.downPos[0]) / (TW * z);
      c.ty -= (sy - this.downPos[1]) / (TH * z);
      c.x = c.tx; c.y = c.ty;
      this.downPos = [sx, sy];
    }
    e.preventDefault();
  }

  updateHover(e) {
    if (!this.enabled) return;
    const [sx, sy] = this.pos(e);
    const o = this.objAt(sx, sy);
    if (o !== this.hover) {
      this.hover = o;
      if (o && !this.held) {
        this.highlight = isMergeable(o.key) ? this.game.board.group(o) : [];
        if (this.highlight.length < 3) this.highlight = [];
      } else if (!this.held) this.highlight = [];
    }
  }

  updateDrag(sx, sy) {
    const o = this.held;
    const board = this.game.board;
    const [bx, by] = this.game.render.t2s(o.x + o.w / 2, o.y + o.h);
    o.dx = sx - bx - this.grabOff[0];
    o.dy = sy - by - this.grabOff[1];

    // target cell = where the object's top-left would land
    const [tx, ty] = this.game.render.s2t(sx - this.grabOff[0], sy - this.grabOff[1]);
    const gx = Math.round(tx - o.w / 2);
    const gy = Math.round(ty - o.h);
    this.gx = gx; this.gy = gy;

    const target = board.at(gx, gy);
    const sameKind = target && target !== o && target.key === o.key;
    this.dropOk = board.canDrop(o, gx, gy) || sameKind;

    // preview merge group at the prospective cell
    if (isMergeable(o.key)) {
      const g = previewGroup(board, o, gx, gy);
      this.highlight = g.length >= 3 ? g : [];
    } else this.highlight = [];
  }

  onUp(e) {
    if (!this.down) return;
    this.down = false;
    const wasTap = this.moved < TAP_SLOP && this.downT < TAP_TIME;
    const o = this.held;
    this.held = null;
    this.panning = false;

    if (o) {
      o.dragging = false;
      o.dx = 0; o.dy = 0;
      if (wasTap) {
        this.highlight = [];
        this.gx = this.gy = null; this.dropOk = null;
        this.game.tap(o);
        return;
      }
      this.game.drop(o, this.gx, this.gy, this.origin);
    } else if (wasTap) {
      const [sx, sy] = this.pos(e);
      const t = this.objAt(sx, sy);
      if (t) this.game.tap(t);
      else {
        const [cx, cy] = this.cellAt(sx, sy);
        this.game.tapLand(cx, cy);
      }
    }
    this.highlight = [];
    this.gx = this.gy = null;
    this.dropOk = null;
  }

  update(dt) {
    if (this.down) this.downT += dt;
  }
}
