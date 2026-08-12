// render.js -- board renderer. Painterly land baked to an offscreen canvas and
// re-baked only when land changes; objects blitted from the sprite cache, sorted
// back-to-front; particles and UI overlays on top.

import { makeCanvas, rgba, shade, mix, rngFrom, hashStr, roundRect, radialGlow, sparkle, speckle, blob } from './artlib.js';
import { spriteFor, T } from './sprites.js';
import { LIVE, SUPER, DEAD } from './board.js';
import { tileProgress } from './heal.js';
import { fmt } from './fx.js';
import { RARITY, def } from './registry.js';

export const TW = 76, TH = 68;

const GRASS_A = '#7fc45a', GRASS_B = '#4f9440', GRASS_C = '#a8d96a';
const DEAD_A = '#6b6474', DEAD_B = '#494455', DEAD_C = '#847d90';
const SUPER_A = '#4a4356', SUPER_B = '#2e2a3a';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cam = { x: 0, y: 0, zoom: 1, tx: 0, ty: 0, tz: 1 };
    this.land = null;
    this.landKey = '';
    this.w = 0; this.h = 0;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.time = 0;
    this.sky = null;
  }

  resize(w, h) {
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * this.dpr);
    this.canvas.height = Math.round(h * this.dpr);
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.sky = null;
  }

  centreOn(board) {
    // frame the playable island, not the full grid rectangle
    let x0 = board.cols, y0 = board.rows, x1 = 0, y1 = 0;
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        if (!board.playable[board.idx(x, y)]) continue;
        if (x < x0) x0 = x; if (y < y0) y0 = y;
        if (x + 1 > x1) x1 = x + 1; if (y + 1 > y1) y1 = y + 1;
      }
    }
    if (x1 <= x0) { x0 = 0; y0 = 0; x1 = board.cols; y1 = board.rows; }
    this.cam.x = this.cam.tx = (x0 + x1) / 2;
    this.cam.y = this.cam.ty = (y0 + y1) / 2;
    const z = Math.min(this.w / ((x1 - x0) * TW + 70), (this.h - 72) / ((y1 - y0) * TH + 70));
    this.cam.zoom = this.cam.tz = Math.max(0.42, Math.min(1.6, z));
  }

  t2s(tx, ty) {
    const z = this.cam.zoom;
    return [
      (tx - this.cam.x) * TW * z + this.w / 2,
      (ty - this.cam.y) * TH * z + this.h / 2,
    ];
  }
  s2t(sx, sy) {
    const z = this.cam.zoom;
    return [
      (sx - this.w / 2) / (TW * z) + this.cam.x,
      (sy - this.h / 2) / (TH * z) + this.cam.y,
    ];
  }

  clampCam(board) {
    const c = this.cam;
    const marginX = this.w / (2 * TW * c.zoom);
    const marginY = this.h / (2 * TH * c.zoom);
    const lo = 1.4, hi = 1.4;
    c.tx = Math.max(Math.min(marginX - lo, board.cols / 2), Math.min(c.tx, Math.max(board.cols - marginX + hi, board.cols / 2)));
    c.ty = Math.max(Math.min(marginY - lo, board.rows / 2), Math.min(c.ty, Math.max(board.rows - marginY + hi, board.rows / 2)));
  }

  update(dt, board) {
    this.time += dt;
    const c = this.cam;
    this.clampCam(board);
    const k = Math.min(1, dt * 12);
    c.x += (c.tx - c.x) * k;
    c.y += (c.ty - c.y) * k;
    c.zoom += (c.tz - c.zoom) * k;
  }

  // ------------------------------------------------------------------------
  // land bake
  // ------------------------------------------------------------------------
  // Build ONE path covering a set of cells as overlapping organic blobs. Filling
  // it once produces a seamless mass with no visible tile grid.
  regionPath(ctx, board, test, grow, OX, OY, salt) {
    ctx.beginPath();
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        if (!test(x, y)) continue;
        const j = rngFrom(hashStr(`${salt}${x},${y}`));
        const cx = OX + x * TW + TW / 2, cy = OY + y * TH + TH / 2;
        // radii must exceed the tile half-diagonal so neighbouring blobs fully
        // union with no gaps at the corners
        const rx = TW * grow * (0.97 + j() * 0.08);
        const ry = TH * grow * 1.09 * (0.97 + j() * 0.08);
        // 7-lobe blob, jittered but deterministic, added as its own subpath
        const n = 7, jit = 0.09;
        const pts = [];
        const rot = j() * 6.28;
        for (let i = 0; i < n; i++) {
          const a = rot + (i / n) * Math.PI * 2;
          const k = 1 + (j() - 0.5) * 2 * jit;
          pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
        }
        ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
        for (let i = 0; i < n; i++) {
          const p = pts[i], q = pts[(i + 1) % n];
          ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
        }
        ctx.closePath();
      }
    }
  }

  bakeLand(board) {
    const w = board.cols * TW, h = board.rows * TH;
    const pad = 100;
    const cv = makeCanvas(w + pad * 2, h + pad * 2);
    const ctx = cv.ctx;
    const rnd = rngFrom(hashStr(`land${board.cols}x${board.rows}`));
    const OX = pad, OY = pad;
    const play = (x, y) => board.isPlayable(x, y);
    const live = (x, y) => board.isPlayable(x, y) && board.land[board.idx(x, y)] === LIVE;
    const sup = (x, y) => board.isPlayable(x, y) && board.land[board.idx(x, y)] === SUPER;

    const GROW = 0.72;

    // ---- dead land: one seamless grey mass. The drop shadow rides on the fill
    // as a canvas shadow so it silhouettes the UNION, never each blob.
    ctx.save();
    this.regionPath(ctx, board, play, GROW, OX, OY, 'p');
    ctx.shadowColor = 'rgba(20,10,30,0.55)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 16;
    const dg = ctx.createLinearGradient(0, OY - 30, 0, OY + h);
    dg.addColorStop(0, '#7a7386');
    dg.addColorStop(0.45, DEAD_A);
    dg.addColorStop(1, '#3f3a4c');
    ctx.fillStyle = dg;
    ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    ctx.fill();
    ctx.restore();

    // dead-land texture, clipped to the mass
    ctx.save();
    this.regionPath(ctx, board, play, GROW, OX, OY, 'p');
    ctx.clip();
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        if (!play(x, y)) continue;
        const j = rngFrom(hashStr(`dt${x},${y}`));
        const px = OX + x * TW, py = OY + y * TH;
        // dry cracks
        ctx.strokeStyle = rgba('#2b2534', 0.42);
        ctx.lineWidth = 1 + j();
        for (let k = 0; k < 2; k++) {
          ctx.beginPath();
          let a = px + j() * TW, b = py + j() * TH;
          ctx.moveTo(a, b);
          for (let s = 0; s < 3; s++) {
            a += (j() - 0.5) * TW * 0.8; b += (j() - 0.5) * TH * 0.8;
            ctx.lineTo(a, b);
          }
          ctx.stroke();
        }
        speckle(ctx, px, py, TW, TH, rgba('#191424', 0.2), 10, j, 0.8, 3.4);
        speckle(ctx, px, py, TW, TH, rgba('#a49ab4', 0.13), 7, j, 0.6, 2.2);
        // dead twigs / stones
        if (j() < 0.3) {
          ctx.strokeStyle = rgba('#3a3040', 0.6); ctx.lineWidth = 1.8;
          const tx = px + 14 + j() * (TW - 28), ty = py + 14 + j() * (TH - 28);
          ctx.beginPath();
          ctx.moveTo(tx - 7, ty + 3); ctx.lineTo(tx + 6, ty - 2);
          ctx.moveTo(tx, ty + 1); ctx.lineTo(tx + 3, ty - 6);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    // ---- Super Dead Land: darker, veined
    if (board.land.some((v) => v === SUPER)) {
      ctx.save();
      this.regionPath(ctx, board, sup, GROW, OX, OY, 's');
      const sg = ctx.createLinearGradient(0, OY, 0, OY + h);
      sg.addColorStop(0, SUPER_A); sg.addColorStop(1, '#1e1a2a');
      ctx.fillStyle = sg; ctx.fill();
      ctx.clip();
      for (let y = 0; y < board.rows; y++) {
        for (let x = 0; x < board.cols; x++) {
          if (!sup(x, y)) continue;
          const j = rngFrom(hashStr(`sv${x},${y}`));
          const px = OX + x * TW, py = OY + y * TH;
          ctx.strokeStyle = rgba('#7f4fa8', 0.5); ctx.lineWidth = 1.6;
          for (let k = 0; k < 3; k++) {
            ctx.beginPath();
            let a = px + j() * TW, b = py + j() * TH;
            ctx.moveTo(a, b);
            for (let s = 0; s < 3; s++) { a += (j() - 0.5) * 30; b += (j() - 0.5) * 26; ctx.lineTo(a, b); }
            ctx.stroke();
          }
          speckle(ctx, px, py, TW, TH, rgba('#0d0a14', 0.3), 12, j, 1, 3.6);
        }
      }
      ctx.restore();
    }

    // ---- healed land: the grass mass with a soft bright rim. The rim is a
    // canvas shadow on the union silhouette, so no per-blob arcs appear.
    ctx.save();
    this.regionPath(ctx, board, live, GROW, OX, OY, 'g');
    ctx.shadowColor = 'rgba(206,240,150,0.55)';
    ctx.shadowBlur = 7;
    ctx.fillStyle = '#7fc45a';
    ctx.fill();
    ctx.fill();
    ctx.restore();

    ctx.save();
    this.regionPath(ctx, board, live, GROW, OX, OY, 'g');
    const gg = ctx.createLinearGradient(0, OY - 40, 0, OY + h);
    gg.addColorStop(0, '#a8dd6d');
    gg.addColorStop(0.4, GRASS_A);
    gg.addColorStop(0.78, GRASS_B);
    gg.addColorStop(1, '#3a7434');
    ctx.fillStyle = gg;
    ctx.fill();
    ctx.clip();
    // painterly grass texture
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        if (!live(x, y)) continue;
        const j = rngFrom(hashStr(`gt${x},${y}`));
        const px = OX + x * TW, py = OY + y * TH;
        // broad value blotches so it reads as painted, not flat
        ctx.globalAlpha = 0.3;
        blob(ctx, px + TW * (0.2 + j() * 0.6), py + TH * (0.2 + j() * 0.6), TW * 0.36, TH * 0.3, 6, 0.25, j);
        ctx.fillStyle = j() > 0.5 ? '#b6e879' : '#4d8f42';
        ctx.fill();
        ctx.globalAlpha = 1;
        for (let k = 0; k < 18; k++) {
          const gx = px + j() * TW, gy = py + j() * TH;
          ctx.strokeStyle = rgba(j() > 0.5 ? '#ccf094' : '#3a7f36', 0.35 + j() * 0.35);
          ctx.lineWidth = 1 + j() * 1.5;
          ctx.beginPath();
          ctx.moveTo(gx, gy);
          ctx.lineTo(gx + (j() - 0.5) * 8, gy - 5 - j() * 8);
          ctx.stroke();
        }
        // wildflowers
        for (let k = 0; k < 3; k++) {
          if (j() > 0.4) continue;
          const fx = px + 10 + j() * (TW - 20), fy = py + 10 + j() * (TH - 20);
          const fc = ['#ffe36b', '#ff9fc9', '#fff3d0', '#c9a0ff', '#ffffff'][Math.floor(j() * 5)];
          for (let p = 0; p < 5; p++) {
            const a = (p / 5) * Math.PI * 2;
            ctx.beginPath();
            ctx.ellipse(fx + Math.cos(a) * 3, fy + Math.sin(a) * 3, 2.2, 1.7, a, 0, 6.3);
            ctx.fillStyle = fc; ctx.fill();
          }
          ctx.beginPath(); ctx.arc(fx, fy, 1.4, 0, 6.3);
          ctx.fillStyle = '#fff8c0'; ctx.fill();
        }
        // pebbles
        if (j() < 0.22) {
          const sx = px + 12 + j() * (TW - 24), sy = py + 12 + j() * (TH - 24);
          ctx.beginPath(); ctx.ellipse(sx, sy, 4 + j() * 3, 3 + j() * 2, j(), 0, 6.3);
          ctx.fillStyle = rgba('#9aa08f', 0.7); ctx.fill();
          ctx.beginPath(); ctx.ellipse(sx - 1, sy - 1, 2 + j(), 1.4 + j(), j(), 0, 6.3);
          ctx.fillStyle = rgba('#ffffff', 0.3); ctx.fill();
        }
      }
    }
    ctx.restore();

    // ---- grass tufts spilling over the healed/dead boundary
    ctx.save();
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        if (!live(x, y)) continue;
        const j = rngFrom(hashStr(`tuft${x},${y}`));
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (live(x + dx, y + dy)) continue;
          for (let k = 0; k < 7; k++) {
            const t = (k + 0.5) / 7 + (j() - 0.5) * 0.1;
            const ex = OX + x * TW + (dx === 1 ? TW : dx === -1 ? 0 : t * TW) + dx * 6;
            const ey = OY + y * TH + (dy === 1 ? TH : dy === -1 ? 0 : t * TH) + dy * 6;
            ctx.strokeStyle = rgba(j() > 0.5 ? '#8fd05f' : '#b8e878', 0.85);
            ctx.lineWidth = 1.5 + j();
            ctx.beginPath();
            ctx.moveTo(ex, ey);
            ctx.lineTo(ex + (j() - 0.5) * 7 + dx * 3, ey - 6 - j() * 7 + dy * 3);
            ctx.stroke();
          }
        }
      }
    }
    ctx.restore();

    // ---- warm top light inside the island
    ctx.save();
    this.regionPath(ctx, board, play, GROW, OX, OY, 'p');
    ctx.clip();
    const tl = ctx.createRadialGradient(OX + w * 0.42, OY + h * 0.14, 10, OX + w * 0.42, OY + h * 0.2, Math.max(w, h) * 0.9);
    tl.addColorStop(0, 'rgba(255,238,196,0.24)');
    tl.addColorStop(1, 'rgba(255,238,196,0)');
    ctx.fillStyle = tl;
    ctx.fillRect(0, 0, cv.w, cv.h);
    // edge darkening so the island reads as a raised mass
    const eg = ctx.createRadialGradient(OX + w / 2, OY + h / 2, Math.min(w, h) * 0.3,
      OX + w / 2, OY + h / 2, Math.max(w, h) * 0.62);
    eg.addColorStop(0, 'rgba(0,0,0,0)');
    eg.addColorStop(1, 'rgba(30,18,38,0.34)');
    ctx.fillStyle = eg;
    ctx.fillRect(0, 0, cv.w, cv.h);
    ctx.restore();

    this.land = { canvas: cv.canvas, w: cv.w, h: cv.h, ox: pad, oy: pad };
    board.landDirty = false;
  }

  bakeSky() {
    const cv = makeCanvas(this.w, this.h);
    const ctx = cv.ctx;
    const g = ctx.createLinearGradient(0, 0, 0, this.h);
    g.addColorStop(0, '#3a2f5e');
    g.addColorStop(0.35, '#5c4a7a');
    g.addColorStop(0.68, '#8f6f86');
    g.addColorStop(1, '#c98f77');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, this.w, this.h);
    const rnd = rngFrom(99);
    // distant stars
    for (let i = 0; i < 70; i++) {
      const x = rnd() * this.w, y = rnd() * this.h * 0.55;
      ctx.fillStyle = rgba('#ffffff', 0.15 + rnd() * 0.5);
      ctx.beginPath(); ctx.arc(x, y, 0.6 + rnd() * 1.2, 0, 6.3); ctx.fill();
    }
    // soft cloud bands
    for (let i = 0; i < 9; i++) {
      const cx = rnd() * this.w, cy = this.h * (0.16 + rnd() * 0.6);
      const r = 120 + rnd() * 300;
      radialGlow(ctx, cx, cy, r, i % 2 ? '#ffc9a8' : '#c9a8ff', 0.09);
    }
    radialGlow(ctx, this.w * 0.5, this.h * 0.56, Math.max(this.w, this.h) * 0.62, '#ffe0b0', 0.13);
    // vignette
    const vg = ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35,
      this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.78);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(24,14,30,0.5)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, this.w, this.h);
    this.sky = cv.canvas;
  }

  // ------------------------------------------------------------------------
  draw(game) {
    const ctx = this.ctx;
    const board = game.board;
    ctx.save();
    ctx.scale(this.dpr, this.dpr);
    ctx.clearRect(0, 0, this.w, this.h);

    if (!this.sky) this.bakeSky();
    ctx.drawImage(this.sky, 0, 0, this.w, this.h);

    // camera shake
    const sh = game.fx.shake;
    if (sh > 0.01) {
      ctx.translate((Math.random() - 0.5) * sh * 7, (Math.random() - 0.5) * sh * 7);
    }

    if (board.landDirty || !this.land) this.bakeLand(board);

    const z = this.cam.zoom;
    const [ox, oy] = this.t2s(0, 0);
    ctx.save();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this.land.canvas,
      ox - this.land.ox * z, oy - this.land.oy * z,
      this.land.w * z, this.land.h * z);
    ctx.restore();

    // healing-progress shimmer on partially healed tiles + heal pulses
    this.drawLandOverlay(game);

    // fog of the camp (dragon-power gate)
    if (board.fog) this.drawFog(game);

    // sort objects back-to-front
    const objs = board.objs.filter((o) => !o.hidden);
    objs.sort((a, b) => {
      const ay = a.dragon ? a.dragon.py : a.y;
      const by = b.dragon ? b.dragon.py : b.y;
      return (ay + a.h) - (by + b.h) || a.id - b.id;
    });

    // merge-preview outlines
    const hl = game.input.highlight;
    if (hl && hl.length) {
      for (const o of hl) {
        if (o === game.input.held) continue;
        this.outlineCell(o, '#ffffff', 0.95);
      }
    }
    if (game.input.dropOk !== null && game.input.held) {
      this.dropMarker(game);
    }

    for (const o of objs) {
      if (o === game.input.held) continue;
      this.drawObj(ctx, o, game);
    }
    // the held object last, above everything
    if (game.input.held) this.drawObj(ctx, game.input.held, game, true);

    this.drawFx(game);
    ctx.restore();
  }

  drawLandOverlay(game) {
    const ctx = this.ctx;
    const board = game.board;
    const z = this.cam.zoom;
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        const i = board.idx(x, y);
        if (!board.playable[i] || board.land[i] === LIVE) continue;
        const p = tileProgress(board, x, y);
        if (p <= 0.001) continue;
        const [px, py] = this.t2s(x, y);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // organic pool of gathered healing power rising inside the tile
        ctx.beginPath();
        const pf = Math.max(0, 0.5 + p * 0.5);
        ctx.ellipse(px + TW * z / 2, py + TH * z * (1 - p * 0.55),
          TW * z * 0.42 * pf, TH * z * 0.3 * pf, 0, 0, 6.3);
        ctx.fillStyle = rgba('#8affc8', 0.1 + p * 0.22);
        ctx.fill();
        radialGlow(ctx, px + TW * z / 2, py + TH * z * (1 - p * 0.5), TW * z * 0.5 * p, '#c9ffd8', 0.22 * p);
        ctx.restore();
      }
    }
    // heal pulses
    for (const p of game.fx.landPulses) {
      const k = p.t / p.life;
      const [px, py] = this.t2s(p.x, p.y);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.85;
      radialGlow(ctx, px + TW * z / 2, py + TH * z / 2, TW * z * (0.5 + k * 1.1), '#c9ffd8', 0.7);
      ctx.restore();
    }
  }

  drawFog(game) {
    const ctx = this.ctx;
    const board = game.board;
    const z = this.cam.zoom;
    const power = game.dragons.totalPower();
    for (let y = 0; y < board.rows; y++) {
      for (let x = 0; x < board.cols; x++) {
        const i = board.idx(x, y);
        if (!board.playable[i] || board.fog[i] <= power) continue;
        const [px, py] = this.t2s(x, y);
        const t = this.time * 0.5 + x * 0.7 + y * 0.5;
        ctx.save();
        roundRect(ctx, px - 2 * z, py - 2 * z, (TW + 4) * z, (TH + 4) * z, 14 * z);
        ctx.clip();
        const g = ctx.createLinearGradient(px, py, px + TW * z, py + TH * z);
        g.addColorStop(0, 'rgba(52,32,72,0.88)');
        g.addColorStop(1, 'rgba(28,18,42,0.94)');
        ctx.fillStyle = g;
        ctx.fillRect(px - 4, py - 4, TW * z + 8, TH * z + 8);
        for (let k = 0; k < 3; k++) {
          const wx = px + (0.3 + 0.34 * k) * TW * z + Math.sin(t + k * 2) * 8 * z;
          const wy = py + (0.3 + 0.3 * ((k + 1) % 3)) * TH * z + Math.cos(t * 0.8 + k) * 6 * z;
          radialGlow(ctx, wx, wy, TW * z * 0.5, '#9f7fd0', 0.22);
        }
        ctx.restore();
        // locked marker
        ctx.save();
        ctx.globalAlpha = 0.8;
        ctx.fillStyle = '#c9b0e8';
        ctx.font = `600 ${Math.round(10 * z)}px system-ui, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(`${fmt(board.fog[i])} DP`, px + TW * z / 2, py + TH * z / 2 + 4 * z);
        ctx.restore();
      }
    }
  }

  outlineCell(o, color, alpha) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const [px, py] = this.t2s(o.x, o.y);
    ctx.save();
    ctx.strokeStyle = rgba(color, alpha);
    ctx.lineWidth = 3 * z;
    ctx.setLineDash([]);
    roundRect(ctx, px + 3 * z, py + 3 * z, (TW * o.w - 6) * z, (TH * o.h - 6) * z, 9 * z);
    ctx.stroke();
    ctx.strokeStyle = rgba('#000000', 0.18);
    ctx.lineWidth = 1 * z;
    ctx.stroke();
    ctx.restore();
  }

  dropMarker(game) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const held = game.input.held;
    const gx = game.input.gx, gy = game.input.gy;
    if (gx === null) return;
    const [px, py] = this.t2s(gx, gy);
    ctx.save();
    const ok = game.input.dropOk;
    ctx.strokeStyle = ok ? 'rgba(255,255,255,0.95)' : 'rgba(255,120,120,0.9)';
    ctx.lineWidth = 3 * z;
    ctx.setLineDash([7 * z, 5 * z]);
    roundRect(ctx, px + 3 * z, py + 3 * z, (TW * held.w - 6) * z, (TH * held.h - 6) * z, 9 * z);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = ok ? 'rgba(255,255,255,0.12)' : 'rgba(255,90,90,0.12)';
    ctx.fill();
    ctx.restore();
  }

  drawObj(ctx, o, game, held = false) {
    const z = this.cam.zoom;
    const d = o.d;
    let tx = o.x, ty = o.y;
    if (o.dragon) { tx = o.dragon.px; ty = o.dragon.py; }
    // ground point
    let [sx, sy] = this.t2s(tx + o.w / 2, ty + o.h);
    // objects sit slightly larger than their tile, the way the original's
    // illustrated props overlap their cell
    let scale = (TW / T) * z * 1.17;
    let lift = 0;

    // animations
    if (o.pop > 0) {
      const p = 1 - o.pop;
      const s = 1 + Math.sin(p * Math.PI) * 0.42 - p * 0.0;
      scale *= Math.max(0.05, s * (0.4 + 0.6 * Math.min(1, p * 2.4)));
    }
    if (d.chain === 'lifeOrb' || d.chain === 'loot' || d.chain === 'dgem' || d.chain === 'star' || d.chain === 'dstar') {
      lift = Math.sin(this.time * 2 + o.bob) * 5 * z;
    }
    if (o.dragon) {
      lift = Math.abs(Math.sin(o.dragon.bob)) * 3.5 * z;
      if (o.dragon.state === 'harvest' || o.dragon.state === 'attack') {
        sx += Math.sin(this.time * 18) * 3 * z;
      }
      if (o.dragon.state === 'rest') lift = Math.sin(this.time * 1.4) * 2 * z;
    }
    if (held) {
      sx += o.dx; sy += o.dy;
      lift += 16 * z;
      scale *= 1.1;
    }

    // ready-to-harvest halo
    if (o.ready) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const pulse = 0.5 + 0.5 * Math.sin(this.time * 4 + o.bob);
      radialGlow(ctx, sx, sy - TH * z * o.h * 0.4, TW * z * o.w * 0.75, '#fff3a0', 0.18 + pulse * 0.2);
      ctx.restore();
    }

    // living things get a soft aura
    const living = ['lifeFlower', 'prism', 'grass', 'fruitTree', 'dragonTree', 'bulb', 'lifeOrb', 'healext'].includes(d.chain);
    if (living && d.idx >= 2) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      radialGlow(ctx, sx, sy - TH * z * o.h * 0.45, TW * z * o.w * 0.62, d.tint, 0.1);
      ctx.restore();
    }

    const variant = o.dragon ? `${o.dragon.facing < 0 ? 'l' : 'r'}${o.dragon.flap}` : '';
    const sp = spriteFor(d, variant);
    const dw = sp.w * scale, dh = sp.h * scale;
    const dx = sx - sp.gx * scale;
    const dy = sy - sp.gy * scale - lift;

    ctx.save();
    if (held) {
      ctx.shadowColor = 'rgba(20,10,30,0.55)';
      ctx.shadowBlur = 20 * z;
      ctx.shadowOffsetY = 12 * z;
    } else {
      // a soft dark halo keeps every object legible against bright grass
      ctx.shadowColor = 'rgba(28,16,38,0.5)';
      ctx.shadowBlur = 5 * z;
      ctx.shadowOffsetY = 2.5 * z;
    }
    ctx.drawImage(sp.canvas, dx, dy, dw, dh);
    ctx.restore();

    // dragon extras: harvest bar, stamina pips, zzz
    if (o.dragon) this.drawDragonUI(ctx, o, sx, sy, z);
    // enemy health bar
    if (d.hp) {
      const hp = o.hpLeft === undefined ? d.hp : o.hpLeft;
      if (hp < d.hp) this.bar(ctx, sx, sy - TH * z * o.h - 6 * z, 34 * z, 5 * z, hp / d.hp, '#ff5f6f');
    }
    // taps remaining
    if (d.taps && o.tapsLeft > 0 && o.tapsLeft < d.taps) {
      this.pips(ctx, sx, sy + 6 * z, o.tapsLeft, d.taps, z);
    }
    // a Leftover pile carries its value above it, as in the original; a
    // Dimensional Jar carries its gem price and the seconds it has left
    if (d.leftover || d.chain === 'jar') {
      const label = d.leftover ? fmt(o.amount || 0)
        : `${fmt(o.gems || 0)}◆ ${Math.max(0, Math.ceil((o.expires || 0) - game.board.time))}s`;
      ctx.save();
      ctx.font = `800 ${Math.round(12 * z)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      const w = ctx.measureText(label).width + 10 * z;
      // just above the sprite, not a full tile above it: these objects are short
      const bx = sx, by = sy - TH * z * o.h * 0.62 - 6 * z;
      ctx.fillStyle = 'rgba(28,16,38,0.72)';
      ctx.beginPath();
      ctx.roundRect(bx - w / 2, by - 9 * z, w, 15 * z, 7 * z);
      ctx.fill();
      ctx.strokeStyle = d.leftover ? 'rgba(255,176,176,0.85)' : 'rgba(255,159,224,0.85)';
      ctx.lineWidth = 1.2 * z;
      ctx.stroke();
      ctx.fillStyle = d.leftover ? '#ffd0d0' : '#ffd0f4';
      ctx.fillText(label, bx, by + 3 * z);
      ctx.restore();
    }
    // dead-land cost label under objects sitting on dead land
    if (!game.board.isLive(o.x, o.y) && game.board.playable[game.board.idx(o.x, o.y)]) {
      // handled by land overlay; nothing here
    }
  }

  drawDragonUI(ctx, o, sx, sy, z) {
    const dr = o.dragon;
    if (dr.state === 'harvest' || dr.state === 'attack') {
      this.bar(ctx, sx, sy - TH * z * 1.35, 32 * z, 5 * z, dr.progress, dr.state === 'attack' ? '#ff8f5f' : '#8fe07f');
    }
    if (dr.state === 'rest') {
      ctx.save();
      ctx.fillStyle = rgba('#dfe8ff', 0.7 + 0.3 * Math.sin(this.time * 3));
      ctx.font = `700 ${Math.round(13 * z)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('z z', sx + 16 * z, sy - TH * z * 1.15 + Math.sin(this.time * 2) * 3 * z);
      ctx.restore();
    }
    if (dr.carrying) {
      // show what the dragon is hauling, bobbing above its head
      const cd = def(dr.carrying);
      if (cd) {
        const sp = spriteFor(cd, '');
        const s = (TW / T) * z * 0.62;
        const bx = sx + 12 * z, by = sy - TH * z * 1.5 + Math.sin(this.time * 4) * 2 * z;
        ctx.save();
        ctx.globalAlpha = 0.96;
        ctx.drawImage(sp.canvas, bx - sp.gx * s, by - sp.gy * s, sp.w * s, sp.h * s);
        ctx.restore();
      }
    }
    // stamina pips
    const n = dr.maxStamina;
    if (n <= 12) {
      const r = 2.1 * z, gap = 5.4 * z;
      const total = (n - 1) * gap;
      ctx.save();
      for (let i = 0; i < n; i++) {
        ctx.beginPath();
        ctx.arc(sx - total / 2 + i * gap, sy + 8 * z, r, 0, 6.3);
        ctx.fillStyle = i < dr.stamina ? 'rgba(255,225,110,0.95)' : 'rgba(0,0,0,0.32)';
        ctx.fill();
      }
      ctx.restore();
    }
  }

  bar(ctx, cx, y, w, h, frac, color) {
    ctx.save();
    roundRect(ctx, cx - w / 2, y, w, h, h / 2);
    ctx.fillStyle = 'rgba(20,14,26,0.6)'; ctx.fill();
    roundRect(ctx, cx - w / 2 + 1, y + 1, Math.max(0, (w - 2) * Math.max(0, Math.min(1, frac))), h - 2, (h - 2) / 2);
    ctx.fillStyle = color; ctx.fill();
    ctx.restore();
  }

  pips(ctx, cx, y, left, total, z) {
    const gap = 5 * z, r = 2 * z;
    const w = (total - 1) * gap;
    ctx.save();
    for (let i = 0; i < total; i++) {
      ctx.beginPath();
      ctx.arc(cx - w / 2 + i * gap, y, r, 0, 6.3);
      ctx.fillStyle = i < left ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.35)';
      ctx.fill();
    }
    ctx.restore();
  }

  // ------------------------------------------------------------------------
  drawFx(game) {
    const ctx = this.ctx;
    const z = this.cam.zoom;
    const fx = game.fx;

    // rings
    for (const r of fx.rings) {
      const k = r.t / r.life;
      const [px, py] = this.t2s(r.x + 0.5, r.y + 0.5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = (1 - k) * 0.7;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = Math.max(1, 4 * z * (1 - k));
      ctx.beginPath();
      const rr = Math.max(0, r.r + (r.max - r.r) * k);
      ctx.ellipse(px, py, rr * TW * z, rr * TH * z * 0.72, 0, 0, 6.3);
      ctx.stroke();
      ctx.restore();
    }

    // fireball bolts
    for (const b of fx.bolts) {
      const k = b.t / b.life;
      const x = b.x + (b.tx - b.x) * k, y = b.y + (b.ty - b.y) * k;
      const [px, py] = this.t2s(x + 0.5, y + 0.5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      radialGlow(ctx, px, py, 16 * z, '#ffb04f', 0.9);
      ctx.fillStyle = '#fff3c0';
      ctx.beginPath(); ctx.arc(px, py, 4 * z, 0, 6.3); ctx.fill();
      ctx.restore();
    }

    // particles
    for (const p of fx.parts) {
      const k = p.t / p.life;
      const [px, py] = this.t2s(p.x + 0.5, p.y + 0.5);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = Math.max(0, 1 - k);
      if (p.kind === 'spark' || p.kind === 'heal') {
        sparkle(ctx, px, py, p.size * z * (1 - k * 0.5), p.color, 0.9);
      } else if (p.kind === 'suck') {
        radialGlow(ctx, px, py, 12 * z, p.color, 0.6);
      } else {
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(px, py, p.size * z * (1 - k * 0.4), 0, 6.3); ctx.fill();
      }
      ctx.restore();
    }

    // floating text
    for (const t of fx.texts) {
      const k = t.t / t.life;
      const [px, py] = this.t2s(t.x + 0.5, t.y + 0.5);
      ctx.save();
      ctx.globalAlpha = k < 0.15 ? k / 0.15 : Math.max(0, 1 - (k - 0.15) / 0.85);
      const s = (1 + Math.sin(Math.min(1, k * 5) * Math.PI * 0.5) * 0.25) * t.scale;
      ctx.font = `800 ${Math.round(15 * s * z)}px "Trebuchet MS", system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.lineWidth = 4 * z;
      ctx.strokeStyle = 'rgba(30,18,36,0.75)';
      ctx.strokeText(t.text, px, py);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, px, py);
      ctx.restore();
    }

    // banners
    let by = 92;
    for (const b of fx.banners) {
      const k = b.t / b.life;
      const a = k < 0.1 ? k / 0.1 : k > 0.8 ? (1 - k) / 0.2 : 1;
      ctx.save();
      ctx.globalAlpha = a;
      ctx.textAlign = 'center';
      ctx.font = `800 ${b.kind === 'wonder' ? 30 : 22}px "Trebuchet MS", system-ui, sans-serif`;
      const wid = ctx.measureText(b.text).width + 56;
      roundRect(ctx, this.w / 2 - wid / 2, by - 26, wid, 44, 22);
      const g = ctx.createLinearGradient(0, by - 26, 0, by + 18);
      g.addColorStop(0, 'rgba(76,44,96,0.94)');
      g.addColorStop(1, 'rgba(42,24,58,0.94)');
      ctx.fillStyle = g; ctx.fill();
      ctx.strokeStyle = b.kind === 'wonder' ? '#ffd24f' : 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = b.kind === 'wonder' ? '#ffe98f' : '#fff0e0';
      ctx.fillText(b.text, this.w / 2, by + 6);
      ctx.restore();
      by += 54;
    }
  }
}
