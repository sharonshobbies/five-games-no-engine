// Renderer: chunk-cached tile painting, depth strata, pod-mounted light,
// lava glow, sky, the surface vendors and the arena. 2D canvas throughout.

import {
  TILE, CHUNK, VIEW_W, VIEW_H, SURFACE_ROW, POD_W, POD_H, GRID_H,
  CHUNK_CACHE, MAX_DIG_DEPTH_FT, SKY_CEILING_FT, FEET_PER_TILE,
} from "./config.js";
import { T, CHUNKS_X, CHUNKS_Y, ART_BLUEPRINT_BASE, LAIR_ROW0 } from "./world.js";
import { ORES } from "./ore.js";
import {
  makeCanvas, strataColors, rgb, mixColor, makePodSprite, makeDrillFrames,
  makeOreSprite, makeArtSprite, makeVendorSprite, roundRect, clamp,
} from "./textures.js";
import { hash2, fbm } from "./rng.js";
import { drawChallengeGoal } from "./challenge-ui.js";

const CHUNK_PX = CHUNK * TILE;

export class Renderer {
  constructor(canvas, world) {
    this.canvas = canvas;
    this.g = canvas.getContext("2d");
    this.world = world;
    this.cam = { x: 0, y: 0 };
    this.chunks = new Map();
    this.chunkOrder = [];
    this.time = 0;

    this.pod = makePodSprite(POD_W, POD_H);
    this.drillFrames = makeDrillFrames(18, 16, 4);
    this.oreSprites = ORES.map((o) => [makeOreSprite(o, 0), makeOreSprite(o, 1.9)]);
    this.artSprites = ["bones", "chest", "skull", "relic", "blueprint"].map(makeArtSprite);
    this.vendorSprites = null;

    this.light = makeCanvas(VIEW_W, VIEW_H);
    this.lightG = this.light.getContext("2d");
    this.shake = 0;
    this.flash = 0;
    this.flashColor = "#ffffff";
  }

  addShake(v) { this.shake = Math.min(26, this.shake + v); }
  addFlash(v, color = "#ffffff") { this.flash = Math.max(this.flash, v); this.flashColor = color; }

  ensureVendorSprites() {
    if (this.vendorSprites) return;
    this.vendorSprites = this.world.vendors.map((v) =>
      makeVendorSprite(v.short, v.name, v.color, 200, 132));
  }

  centerOn(x, y) {
    const worldW = this.world.w * TILE, worldH = GRID_H * TILE;
    this.cam.x = clamp(x - VIEW_W / 2, 0, Math.max(0, worldW - VIEW_W));
    const minY = -(SKY_CEILING_FT / FEET_PER_TILE) * TILE - VIEW_H;
    this.cam.y = clamp(y - VIEW_H * 0.48, minY, Math.max(0, worldH - VIEW_H));
  }

  // ---- chunk cache ----------------------------------------------------------
  getChunk(cx, cy) {
    const key = cy * CHUNKS_X + cx;
    let cv = this.chunks.get(key);
    if (!cv || this.world.dirty.has(key)) {
      if (!cv) {
        cv = makeCanvas(CHUNK_PX, CHUNK_PX);
        this.chunks.set(key, cv);
        this.chunkOrder.push(key);
        while (this.chunkOrder.length > CHUNK_CACHE && this.chunkOrder[0] !== key) {
          this.chunks.delete(this.chunkOrder.shift());
        }
      }
      this.paintChunk(cv, cx, cy);
      this.world.dirty.delete(key);
    }
    return cv;
  }

  paintChunk(cv, cx, cy) {
    const g = cv.getContext("2d");
    g.clearRect(0, 0, CHUNK_PX, CHUNK_PX);
    const w = this.world;
    const c0 = cx * CHUNK, r0 = cy * CHUNK;

    for (let ry = 0; ry < CHUNK; ry++) {
      const r = r0 + ry;
      if (r >= w.h) break;
      const depth = w.depthFtOfRow(r);
      const pal = strataColors(Math.max(0, depth));
      for (let rx = 0; rx < CHUNK; rx++) {
        const c = c0 + rx;
        if (c >= w.w) break;
        const t = w.typeAt(c, r);
        if (t === T.AIR) continue;
        const px = rx * TILE, py = ry * TILE;
        const i = w.idx(c, r);
        const jitter = (w.tint[i] / 255 - 0.5) * 2;

        if (t === T.BEDROCK) {
          g.fillStyle = r >= LAIR_ROW0 ? "#20090a" : "#15161c";
          g.fillRect(px, py, TILE, TILE);
          g.strokeStyle = r >= LAIR_ROW0 ? "rgba(200,60,40,0.28)" : "rgba(90,96,110,0.26)";
          g.lineWidth = 1;
          for (let k = -TILE; k < TILE; k += 8) {
            g.beginPath(); g.moveTo(px + k, py + TILE); g.lineTo(px + k + TILE, py); g.stroke();
          }
          g.strokeStyle = "rgba(0,0,0,0.7)";
          g.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
          continue;
        }

        if (t === T.LAVA) {
          const grd = g.createLinearGradient(px, py, px, py + TILE);
          grd.addColorStop(0, "#ffe27a");
          grd.addColorStop(0.22, "#ff9a20");
          grd.addColorStop(0.7, "#e03c05");
          grd.addColorStop(1, "#8c1602");
          g.fillStyle = grd;
          g.fillRect(px, py, TILE, TILE);
          // dark crust islands floating on the melt
          g.fillStyle = "rgba(50,8,0,0.55)";
          for (let k = 0; k < 3; k++) {
            const hx = hash2(c * 7 + k, r * 13, 5) * (TILE - 14);
            const hy = hash2(c * 3, r * 11 + k, 9) * (TILE - 10);
            g.beginPath();
            g.ellipse(px + 7 + hx, py + 5 + hy, 6, 3, hash2(c, r + k, 61) * 3, 0, Math.PI * 2);
            g.fill();
          }
          // molten surface line where lava meets open air
          if (w.typeAt(c, r - 1) === T.AIR) {
            g.fillStyle = "rgba(255,250,210,0.92)";
            g.fillRect(px, py, TILE, 4);
            g.fillStyle = "rgba(255,190,90,0.55)";
            g.fillRect(px, py + 4, TILE, 3);
          }
          g.fillStyle = "rgba(255,250,210,0.85)";
          for (let k = 0; k < 3; k++) {
            const hx = hash2(c * 5 + k, r * 17, 25) * (TILE - 4);
            const hy = hash2(c * 9, r * 23 + k, 35) * (TILE - 4);
            g.fillRect(px + hx, py + hy, 3, 2);
          }
          continue;
        }

        // --- soil / rock ------------------------------------------------------
        // Mottling comes from continuous noise, not a per-tile constant: a
        // per-tile tint paints a visible 48px checkerboard over the whole map.
        const base = t === T.ROCK ? pal.rock : pal.soil;
        const band = Math.sin(r * 0.62) * 0.05 + Math.sin(r * 0.19 + 1.3) * 0.04;
        const mott = (fbm(c * 2, r * 2, 4242, 5, 2) - 0.5) * 0.20;
        const lift = band + mott;
        let shade = mixColor(base, lift > 0 ? [255, 255, 255] : [0, 0, 0], Math.min(0.3, Math.abs(lift)));
        g.fillStyle = rgb(shade);
        g.fillRect(px, py, TILE, TILE);

        if (t === T.ROCK) {
          // Undrillable stone: dark, plated, obviously a different material.
          g.fillStyle = "rgba(14,16,22,0.45)";
          g.fillRect(px, py, TILE, TILE);
          const a = hash2(c, r, 555) * Math.PI;
          g.save();
          g.beginPath(); g.rect(px, py, TILE, TILE); g.clip();
          g.strokeStyle = "rgba(220,228,244,0.22)";
          g.lineWidth = 2;
          for (let k = -1; k <= 1; k++) {
            g.beginPath();
            const off = k * 16;
            g.moveTo(px + TILE / 2 - Math.cos(a) * TILE + Math.sin(a) * off,
              py + TILE / 2 - Math.sin(a) * TILE - Math.cos(a) * off);
            g.lineTo(px + TILE / 2 + Math.cos(a) * TILE + Math.sin(a) * off,
              py + TILE / 2 + Math.sin(a) * TILE - Math.cos(a) * off);
            g.stroke();
          }
          g.restore();
          g.strokeStyle = "rgba(0,0,0,0.55)";
          g.lineWidth = 2;
          g.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
          g.fillStyle = "rgba(255,255,255,0.13)";
          g.fillRect(px + 2, py + 2, TILE - 4, 3);
        } else {
          // pebbles + grain, positioned by hash so they never form a grid
          for (let k = 0; k < 3; k++) {
            if (hash2(c - k, r + k, 133) > 0.42) continue;
            const hx = hash2(c * 71 + k, r * 41, 909);
            const hy = hash2(c * 19, r * 53 + k, 707);
            const rad = 1.8 + hash2(c + k * 3, r, 411) * 2.6;
            g.fillStyle = hash2(c, r + k, 222) > 0.5 ? "rgba(255,255,255,0.09)" : "rgba(0,0,0,0.14)";
            g.beginPath();
            g.arc(px + 4 + hx * (TILE - 8), py + 4 + hy * (TILE - 8), rad, 0, Math.PI * 2);
            g.fill();
          }
          for (let k = 0; k < 9; k++) {
            const hx = hash2(c * 31 + k, r * 17, 101);
            const hy = hash2(c * 13, r * 29 + k, 211);
            g.fillStyle = hash2(c + k, r - k, 307) > 0.5 ? "rgba(0,0,0,0.17)" : "rgba(255,255,255,0.09)";
            g.fillRect(px + hx * (TILE - 3), py + hy * (TILE - 3), 3, 3);
          }
        }
        void jitter;

        // ore nugget
        const o = w.ore[i];
        if (o) g.drawImage(this.oreSprites[o - 1][w.tint[i] & 1], px, py);

        // buried artifact / blueprint
        const art = w.art[i];
        if (art) {
          const idx = art >= ART_BLUEPRINT_BASE ? 4 : art - 1;
          g.drawImage(this.artSprites[idx], px, py);
        }

        // rim shading against open tunnel
        if (!w.isSolid(c, r - 1)) {
          g.fillStyle = "rgba(255,255,255,0.17)";
          g.fillRect(px, py, TILE, 3);
        }
        if (!w.isSolid(c, r + 1)) {
          g.fillStyle = "rgba(0,0,0,0.34)";
          g.fillRect(px, py + TILE - 4, TILE, 4);
        }
        if (!w.isSolid(c - 1, r)) {
          g.fillStyle = "rgba(255,255,255,0.07)";
          g.fillRect(px, py, 3, TILE);
        }
        if (!w.isSolid(c + 1, r)) {
          g.fillStyle = "rgba(0,0,0,0.20)";
          g.fillRect(px + TILE - 3, py, 3, TILE);
        }
      }
    }
  }

  // ---- frame ---------------------------------------------------------------
  draw(game, dt) {
    this.time += dt;
    const g = this.g;
    const pod = game.pod;
    this.ensureVendorSprites();

    this.centerOn(pod.x, pod.y);
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 48);
    const ox = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const oy = this.shake ? (Math.random() - 0.5) * this.shake : 0;
    const camX = this.cam.x + ox, camY = this.cam.y + oy;

    this.drawBackground(g, camY, pod);
    g.save();
    g.translate(-camX, -camY);
    this.drawSurface(g, camX, camY);
    this.drawTiles(g, camX, camY);
    this.drawLairDressing(g, camY);
    this.drawLavaShimmer(g, camX, camY);
    if (game.boss) game.boss.draw(g, this.time);
    game.particles.draw(g);
    this.drawBombs(g, game);
    this.drawOilers(g);
    this.drawAnalyzer(g, game, camY);
    drawChallengeGoal(g, game, this.time);
    this.drawPod(g, pod);
    g.restore();

    this.drawLighting(g, game, camX, camY);
    if (game.boss && !game.boss.dead) this.drawBossBar(g, game.boss);

    if (this.flash > 0) {
      g.save();
      g.globalAlpha = Math.min(0.85, this.flash);
      g.fillStyle = this.flashColor;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      g.restore();
      this.flash = Math.max(0, this.flash - dt * 3.2);
    }
  }

  drawBackground(g, camY, pod) {
    const w = this.world;
    const topDepth = w.depthFtAt(camY);
    // Below the ground line the backdrop must be cave dark, or an open tunnel
    // near the surface shows daylight through it.
    const groundScreenY = SURFACE_ROW * TILE - camY;
    if (camY + VIEW_H * 0.5 > LAIR_ROW0 * TILE) {
      const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
      grd.addColorStop(0, "#1a0304");
      grd.addColorStop(0.5, "#4a0a06");
      grd.addColorStop(1, "#210304");
      g.fillStyle = grd;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      return;
    }
    if (topDepth < 20) {
      const alt = Math.max(0, -topDepth);
      const t = clamp(alt / 40000, 0, 1);
      const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
      grd.addColorStop(0, rgb(mixColor([64, 96, 160], [2, 2, 8], t)));
      grd.addColorStop(0.42, rgb(mixColor([124, 156, 198], [8, 10, 26], t)));
      grd.addColorStop(0.74, rgb(mixColor([210, 176, 148], [24, 22, 44], t)));
      grd.addColorStop(1, rgb(mixColor([238, 196, 146], [40, 30, 40], t)));
      g.fillStyle = grd;
      g.fillRect(0, 0, VIEW_W, VIEW_H);
      // Dust haze stacked just above the horizon line, wherever that is now.
      const horizon = SURFACE_ROW * TILE - camY;
      g.save();
      g.globalAlpha = 0.13 * (1 - t);
      for (let i = 0; i < 6; i++) {
        const hy = horizon - 30 - i * 26;
        if (hy < -40 || hy > VIEW_H) continue;
        g.fillStyle = i % 2 ? "#ffe8c8" : "#e0a878";
        g.fillRect(0, hy, VIEW_W, 16 + i * 3);
      }
      g.restore();
      // stars, brighter the higher you fly
      g.fillStyle = `rgba(255,255,255,${0.25 + t * 0.7})`;
      for (let i = 0; i < 90; i++) {
        const sx = hash2(i, 3, 77) * VIEW_W;
        const sy = (hash2(i, 9, 88) * 3600 + camY * 0.25) % 3600;
        if (sy < VIEW_H) g.fillRect(sx, sy, 1.8, 1.8);
      }
      // a small sun
      const sunY = 90 - camY * 0.05;
      if (sunY > -60 && sunY < VIEW_H) {
        const sg = g.createRadialGradient(VIEW_W - 140, sunY, 6, VIEW_W - 140, sunY, 90);
        sg.addColorStop(0, "rgba(255,246,210,0.95)");
        sg.addColorStop(1, "rgba(255,200,120,0)");
        g.fillStyle = sg;
        g.beginPath(); g.arc(VIEW_W - 140, sunY, 90, 0, Math.PI * 2); g.fill();
      }
      if (groundScreenY < VIEW_H) this.fillCave(g, groundScreenY, 0);
      return;
    }
    this.fillCave(g, 0, topDepth);
    void pod;
  }

  /** The void behind open tunnels: darker the deeper you are. */
  fillCave(g, fromY, depthFt) {
    const t = clamp(depthFt / 3200, 0, 1);
    const y = Math.max(0, fromY);
    const grd = g.createLinearGradient(0, y, 0, VIEW_H);
    grd.addColorStop(0, rgb(mixColor([44, 30, 22], [10, 6, 9], t)));
    grd.addColorStop(1, rgb(mixColor([26, 17, 13], [5, 3, 5], t)));
    g.fillStyle = grd;
    g.fillRect(0, y, VIEW_W, VIEW_H - y);
  }

  drawSurface(g, camX, camY) {
    const groundY = SURFACE_ROW * TILE;
    if (camY > groundY + VIEW_H) return;

    // distant ridges
    for (let layer = 0; layer < 3; layer++) {
      const amp = 30 - layer * 8;
      const yBase = groundY - 54 - layer * 20;
      g.fillStyle = ["#2b3a55", "#3a4a63", "#4d5a6e"][layer];
      g.beginPath();
      g.moveTo(camX - 60, groundY);
      for (let x = camX - 60; x < camX + VIEW_W + 60; x += 22) {
        const h = Math.sin(x * 0.006 + layer * 2.1) * amp + Math.sin(x * 0.019 + layer) * amp * 0.45;
        g.lineTo(x, yBase + h);
      }
      g.lineTo(camX + VIEW_W + 60, groundY);
      g.closePath();
      g.fill();
    }

    // crust
    g.fillStyle = "#8a5a34";
    g.fillRect(camX - 60, groundY - 7, VIEW_W + 120, 8);
    g.fillStyle = "#a97a48";
    g.fillRect(camX - 60, groundY - 7, VIEW_W + 120, 3);

    // landing pads first, so a shopfront is never clipped by its own pad
    this.world.vendors.forEach((v) => {
      if (v.x < camX - 300 || v.x > camX + VIEW_W + 300) return;
      g.fillStyle = "#3f434d";
      g.fillRect(v.x - v.w / 2, groundY - 8, v.w, 9);
      g.fillStyle = v.color;
      for (let x = v.x - v.w / 2 + 6; x < v.x + v.w / 2 - 6; x += 20) g.fillRect(x, groundY - 6, 10, 3);
    });
    this.world.vendors.forEach((v, i) => {
      const sprite = this.vendorSprites[i];
      if (v.x < camX - 300 || v.x > camX + VIEW_W + 300) return;
      g.drawImage(sprite, v.x - sprite.width / 2, groundY - sprite.height - 6);
    });
  }

  drawTiles(g, camX, camY) {
    const cx0 = Math.max(0, Math.floor(camX / CHUNK_PX));
    const cx1 = Math.min(CHUNKS_X - 1, Math.floor((camX + VIEW_W) / CHUNK_PX));
    const cy0 = Math.max(0, Math.floor(camY / CHUNK_PX));
    const cy1 = Math.min(CHUNKS_Y - 1, Math.floor((camY + VIEW_H) / CHUNK_PX));
    for (let cy = cy0; cy <= cy1; cy++) {
      for (let cx = cx0; cx <= cx1; cx++) {
        g.drawImage(this.getChunk(cx, cy), cx * CHUNK_PX, cy * CHUNK_PX);
      }
    }
  }

  /** Wrecks of the pods Mr. Natas buried down here, scattered on the floor. */
  drawLairDressing(g, camY) {
    const lair = this.world.lair;
    if (camY + VIEW_H < lair.row0 * TILE) return;
    const floorY = lair.floorY;
    for (let i = 0; i < 11; i++) {
      const x = 90 + hash2(i, 7, 4711) * (this.world.w * TILE - 180);
      const tilt = (hash2(i, 3, 91) - 0.5) * 1.5;
      const scale = 0.55 + hash2(i, 11, 55) * 0.5;
      g.save();
      g.translate(x, floorY - 8 * scale);
      g.rotate(tilt);
      g.scale(scale, scale);
      // burnt-out hull
      g.fillStyle = "#5a3a08";
      roundRect(g, -17, -20, 34, 26, 5); g.fill();
      g.fillStyle = "rgba(0,0,0,0.55)";
      roundRect(g, -17, -20, 34, 26, 5); g.fill();
      g.fillStyle = "#20242c";
      roundRect(g, -1, -16, 14, 11, 3); g.fill();
      g.fillStyle = "#3a3f48";
      g.beginPath(); g.moveTo(-7, 6); g.lineTo(7, 6); g.lineTo(0, 18); g.closePath(); g.fill();
      g.restore();
      // faint ember under each wreck
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = 0.20 + 0.1 * Math.sin(this.time * 2 + i);
      const gr = g.createRadialGradient(x, floorY - 6, 1, x, floorY - 6, 42);
      gr.addColorStop(0, "#ff7a20");
      gr.addColorStop(1, "rgba(255,60,0,0)");
      g.fillStyle = gr;
      g.beginPath(); g.arc(x, floorY - 6, 42, 0, Math.PI * 2); g.fill();
      g.restore();
    }
  }

  drawLavaShimmer(g, camX, camY) {
    const w = this.world;
    const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const c1 = Math.min(w.w - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const r1 = Math.min(w.h - 1, Math.floor((camY + VIEW_H) / TILE) + 1);
    g.save();
    g.globalCompositeOperation = "lighter";
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        if (w.typeAt(c, r) !== T.LAVA) continue;
        g.globalAlpha = 0.28 + 0.22 * Math.sin(this.time * 3 + c * 0.9 + r * 1.4);
        g.fillStyle = "#ff6a10";
        g.fillRect(c * TILE, r * TILE, TILE, TILE);
      }
    }
    g.restore();
  }

  drawBombs(g, game) {
    for (const b of game.bombs) {
      const blink = Math.sin(b.fuse * 30) > 0;
      g.save();
      g.translate(b.x, b.y);
      g.fillStyle = b.kind === "plastic" ? "#c8c2a8" : "#b5321f";
      g.fillRect(-6, -9, 12, 18);
      g.fillStyle = "#20242c";
      g.fillRect(-6, -3, 12, 4);
      g.fillStyle = blink ? "#fff2a0" : "#6a4a10";
      g.fillRect(-1.5, -14, 3, 5);
      if (blink) {
        g.save();
        g.globalCompositeOperation = "lighter";
        const gr = g.createRadialGradient(0, -14, 1, 0, -14, 20);
        gr.addColorStop(0, "rgba(255,240,150,0.9)");
        gr.addColorStop(1, "rgba(255,180,40,0)");
        g.fillStyle = gr;
        g.beginPath(); g.arc(0, -14, 20, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      g.restore();
    }
  }

  /** The Martian Oilers craft: looks like a pod but flashes through colours. */
  drawOilers(g) {
    const o = this.world.oilers;
    if (!o || o.taken) return;
    const hue = (this.time * 120) % 360;
    g.save();
    g.translate(o.x, o.y);
    g.globalCompositeOperation = "lighter";
    const gr = g.createRadialGradient(0, 0, 2, 0, 0, 40);
    gr.addColorStop(0, `hsla(${hue},100%,70%,0.75)`);
    gr.addColorStop(1, "hsla(0,0%,0%,0)");
    g.fillStyle = gr;
    g.beginPath(); g.arc(0, 0, 40, 0, Math.PI * 2); g.fill();
    g.globalCompositeOperation = "source-over";
    g.fillStyle = `hsl(${hue},80%,55%)`;
    roundRect(g, -14, -12, 28, 22, 5); g.fill();
    g.strokeStyle = "#14171e";
    g.lineWidth = 2;
    roundRect(g, -14, -12, 28, 22, 5); g.stroke();
    g.fillStyle = "#dff6ff";
    roundRect(g, 0, -8, 11, 9, 2); g.fill();
    g.restore();
  }

  /**
   * The Quantum Particle State Analyzer 6000: the save point, a bot hovering
   * over the Mineral Processor. Fly into its field and the run is written down.
   */
  drawAnalyzer(g, game, camY) {
    const a = this.world.analyzer;
    if (!a) return;
    if (a.y < camY - 200 || a.y > camY + VIEW_H + 200) return;
    const bob = Math.sin(this.time * 1.7) * 5;
    const inside = this.world.atAnalyzer(game.pod.x, game.pod.y);
    const flash = game.saveFlashTimer > 0;
    const pulse = 0.55 + 0.45 * Math.sin(this.time * 3.4);
    g.save();
    g.translate(a.x, a.y + bob);

    // containment field
    g.save();
    g.globalCompositeOperation = "lighter";
    const fg = g.createRadialGradient(0, 0, 6, 0, 0, a.r);
    const col = flash ? "160,255,190" : inside ? "120,240,170" : "90,190,255";
    fg.addColorStop(0, `rgba(${col},${(flash ? 0.5 : inside ? 0.34 : 0.16) * pulse})`);
    fg.addColorStop(1, `rgba(${col},0)`);
    g.fillStyle = fg;
    g.beginPath(); g.arc(0, 0, a.r, 0, Math.PI * 2); g.fill();
    g.restore();
    g.strokeStyle = `rgba(${col},${0.35 + pulse * 0.35})`;
    g.lineWidth = 2;
    g.setLineDash([7, 6]);
    g.beginPath(); g.arc(0, 0, a.r - 4, this.time * 0.9, this.time * 0.9 + Math.PI * 1.7); g.stroke();
    g.setLineDash([]);

    // chassis: a squat drum with a lens and two thruster nacelles
    g.fillStyle = "#4a5260";
    roundRect(g, -22, -15, 44, 30, 8); g.fill();
    g.strokeStyle = "#111419";
    g.lineWidth = 2;
    roundRect(g, -22, -15, 44, 30, 8); g.stroke();
    g.fillStyle = "#2b313c";
    roundRect(g, -26, -6, 8, 13, 3); g.fill();
    roundRect(g, 18, -6, 8, 13, 3); g.fill();
    // hazard chevrons
    g.save();
    g.beginPath(); roundRect(g, -22, 4, 44, 8, 2); g.clip();
    for (let i = -4; i < 8; i++) {
      g.fillStyle = i % 2 ? "#e8b21c" : "#20242c";
      g.fillRect(-22 + i * 6, 4, 6, 8);
    }
    g.restore();
    // scanning lens
    g.fillStyle = "#0a1018";
    g.beginPath(); g.arc(0, -5, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = `rgba(${col},${0.7 + pulse * 0.3})`;
    g.beginPath(); g.arc(0, -5, 5.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = "rgba(255,255,255,0.85)";
    g.beginPath(); g.arc(-2, -7, 2, 0, Math.PI * 2); g.fill();
    // antenna
    g.strokeStyle = "#8a929c";
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -15); g.lineTo(0, -28); g.stroke();
    g.fillStyle = `rgba(255,${flash ? 240 : 120},${flash ? 200 : 80},${0.5 + pulse * 0.5})`;
    g.beginPath(); g.arc(0, -30, 3.5, 0, Math.PI * 2); g.fill();
    g.restore();

    // Placard, on its own dark plate: the sky behind it is too bright for text.
    g.save();
    g.textAlign = "center";
    g.fillStyle = "rgba(6,10,16,0.78)";
    roundRect(g, a.x - 92, a.y - 62, 184, 32, 4); g.fill();
    g.strokeStyle = flash ? "rgba(140,255,180,0.7)" : "rgba(120,180,230,0.45)";
    g.lineWidth = 1.5;
    roundRect(g, a.x - 92, a.y - 62, 184, 32, 4); g.stroke();
    g.font = "bold 10px 'Lucida Console', monospace";
    g.fillStyle = flash ? "#8dffa8" : "#bfe2fb";
    g.fillText("Q.P.S. ANALYZER 6000", a.x, a.y - 48);
    g.font = "bold 9px 'Lucida Console', monospace";
    g.fillStyle = flash ? "#8dffa8" : "#93a3b8";
    g.fillText(flash ? "GAME SAVED" : "FLY IN TO SAVE", a.x, a.y - 36);
    g.restore();
  }

  drawPod(g, pod) {
    if (pod.dead) return;
    g.save();
    // Physics keeps the pod out of the tile it is drilling; a small render
    // offset plus a rattle sells the auger biting into it.
    let nx = 0, ny = 0;
    if (pod.drill) {
      const bite = pod.drill.progress * 7;
      const shiver = (Math.random() - 0.5) * 1.6;
      if (pod.drill.dir === "down") { ny = bite; nx = shiver; }
      else if (pod.drill.dir === "left") { nx = -bite; ny = shiver; }
      else { nx = bite; ny = shiver; }
    }
    g.translate(pod.x + nx, pod.y + ny);
    g.rotate(pod.tilt);
    const flick = () => 0.7 + Math.random() * 0.6;
    if (pod.thrusting.up) this.drawFlame(g, 0, POD_H / 2 - 3, 13, 28 * flick(), 0);
    if (pod.thrusting.left) this.drawFlame(g, POD_W / 2 - 3, 3, 10, 18 * flick(), Math.PI / 2);
    if (pod.thrusting.right) this.drawFlame(g, -POD_W / 2 + 3, 3, 10, 18 * flick(), -Math.PI / 2);

    // A soft drop shadow so the pod separates from the soil behind it.
    g.save();
    g.globalAlpha = 0.35;
    g.fillStyle = "#000";
    roundRect(g, -POD_W / 2 + 2, -POD_H / 2 + 3, POD_W, POD_H, 7);
    g.fill();
    g.restore();

    const frame = this.drillFrames[Math.floor(pod.drillSpin) % this.drillFrames.length];
    g.fillStyle = "#23272f";
    g.fillRect(-10, POD_H / 2 - 13, 20, 6);
    g.drawImage(frame, -10, POD_H / 2 - 11, 20, 18);
    g.drawImage(this.pod, -POD_W / 2, -POD_H / 2, POD_W, POD_H);

    if (pod.heat > 0.05) {
      g.save();
      g.globalCompositeOperation = "lighter";
      g.globalAlpha = pod.heat * 0.65;
      g.fillStyle = "#ff4400";
      roundRect(g, -POD_W / 2, -POD_H / 2, POD_W, POD_H - 8, 6);
      g.fill();
      g.restore();
    }
    g.restore();

    // guardian angel easter egg
    if (pod.eggs && pod.eggs.guardian) {
      const gx = pod.x - 34 + Math.sin(this.time * 2) * 8;
      const gy = pod.y - 34 + Math.cos(this.time * 2.6) * 6;
      g.save();
      g.globalCompositeOperation = "lighter";
      const gr = g.createRadialGradient(gx, gy, 1, gx, gy, 22);
      gr.addColorStop(0, "rgba(255,255,255,0.95)");
      gr.addColorStop(1, "rgba(180,200,255,0)");
      g.fillStyle = gr;
      g.beginPath(); g.arc(gx, gy, 22, 0, Math.PI * 2); g.fill();
      g.restore();
      g.fillStyle = "#ffffff";
      g.beginPath(); g.ellipse(gx, gy, 5, 7, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = "rgba(255,255,255,0.8)";
      g.beginPath(); g.ellipse(gx - 7, gy - 2, 5, 3, -0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(gx + 7, gy - 2, 5, 3, 0.5, 0, Math.PI * 2); g.fill();
    }
  }

  drawFlame(g, x, y, w, h, rot) {
    g.save();
    g.translate(x, y);
    g.rotate(rot);
    g.globalCompositeOperation = "lighter";
    const grd = g.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, "rgba(255,255,225,0.95)");
    grd.addColorStop(0.35, "rgba(255,170,50,0.8)");
    grd.addColorStop(1, "rgba(255,50,0,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.moveTo(-w / 2, 0);
    g.lineTo(w / 2, 0);
    g.lineTo(0, h);
    g.closePath();
    g.fill();
    g.restore();
  }

  drawLighting(g, game, camX, camY) {
    const pod = game.pod;
    const depth = pod.depthFt();
    const inLair = pod.inLair;
    // A vignette, not a blackout. The original is legible underground, so the
    // ambient floor stays high enough to read strata, ore and rock everywhere.
    let dark = inLair ? 0.5 : clamp((depth - 40) / 1400, 0, 1) * 0.70;
    if (dark <= 0.01) return;

    const lg = this.lightG;
    lg.setTransform(1, 0, 0, 1, 0, 0);
    lg.globalCompositeOperation = "source-over";
    lg.clearRect(0, 0, VIEW_W, VIEW_H);
    lg.fillStyle = `rgba(0,0,0,${dark})`;
    lg.fillRect(0, 0, VIEW_W, VIEW_H);

    lg.globalCompositeOperation = "destination-out";
    const px = pod.x - camX, py = pod.y - camY;
    // A wide pool so the working area stays legible, falling off to dark
    // screen edges rather than a small keyhole.
    const radius = 400 + Math.sin(this.time * 4) * 8;
    let grd = lg.createRadialGradient(px, py, 10, px, py, radius);
    grd.addColorStop(0, "rgba(0,0,0,1)");
    grd.addColorStop(0.42, "rgba(0,0,0,1)");
    grd.addColorStop(0.72, "rgba(0,0,0,0.62)");
    grd.addColorStop(1, "rgba(0,0,0,0)");
    lg.fillStyle = grd;
    lg.beginPath(); lg.arc(px, py, radius, 0, Math.PI * 2); lg.fill();

    // headlight cone, pointing the way you drill
    lg.save();
    lg.translate(px, py);
    const coneLen = 330, coneHalf = 92;
    const cg = lg.createLinearGradient(0, 0, 0, coneLen);
    cg.addColorStop(0, "rgba(0,0,0,0.92)");
    cg.addColorStop(1, "rgba(0,0,0,0)");
    lg.fillStyle = cg;
    lg.beginPath();
    lg.moveTo(-12, 0); lg.lineTo(12, 0);
    lg.lineTo(coneHalf, coneLen); lg.lineTo(-coneHalf, coneLen);
    lg.closePath(); lg.fill();
    lg.restore();

    const punch = (x, y, rad, a = 0.85) => {
      const gr = lg.createRadialGradient(x, y, 2, x, y, rad);
      gr.addColorStop(0, `rgba(0,0,0,${a})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      lg.fillStyle = gr;
      lg.beginPath(); lg.arc(x, y, rad, 0, Math.PI * 2); lg.fill();
    };

    const w = this.world;
    const c0 = Math.max(0, Math.floor(camX / TILE) - 1);
    const c1 = Math.min(w.w - 1, Math.floor((camX + VIEW_W) / TILE) + 1);
    const r0 = Math.max(0, Math.floor(camY / TILE) - 1);
    const r1 = Math.min(w.h - 1, Math.floor((camY + VIEW_H) / TILE) + 1);
    for (let r = r0; r <= r1; r++) {
      for (let c = c0; c <= c1; c++) {
        const t = w.typeAt(c, r);
        const i = w.idx(c, r);
        if (t === T.LAVA) punch(c * TILE + TILE / 2 - camX, r * TILE + TILE / 2 - camY, 60);
        else if (w.art[i]) punch(c * TILE + TILE / 2 - camX, r * TILE + TILE / 2 - camY, 42, 0.6);
        // Minerals glint in the dark, so a vein is worth spotting from a shaft.
        else if (w.ore[i]) punch(c * TILE + TILE / 2 - camX, r * TILE + TILE / 2 - camY, 30, 0.42);
      }
    }
    for (const b of game.bombs) punch(b.x - camX, b.y - camY, 50, 0.6);
    if (game.boss && !game.boss.dead) punch(game.boss.x - camX, game.boss.y - camY, 300, 0.8);

    lg.globalCompositeOperation = "source-over";
    g.drawImage(this.light, 0, 0);

    // warm additive lamp glow so the tunnel is not just grey
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.18;
    const wg = g.createRadialGradient(px, py, 8, px, py, 190);
    wg.addColorStop(0, "#ffd9a0");
    wg.addColorStop(1, "rgba(255,180,90,0)");
    g.fillStyle = wg;
    g.beginPath(); g.arc(px, py, 190, 0, Math.PI * 2); g.fill();
    g.restore();
    void MAX_DIG_DEPTH_FT;
  }

  drawBossBar(g, boss) {
    // Below the warning strip, which ends at 122.
    const w = 520, x = (VIEW_W - w) / 2, y = 132;
    g.save();
    g.fillStyle = "rgba(0,0,0,0.65)";
    roundRect(g, x - 4, y - 4, w + 8, 30, 5); g.fill();
    g.fillStyle = "#2a0a08";
    g.fillRect(x, y, w, 14);
    const frac = Math.max(0, boss.hp / boss.maxHp);
    const grd = g.createLinearGradient(x, y, x, y + 14);
    grd.addColorStop(0, "#ff8a5a");
    grd.addColorStop(0.5, "#e02010");
    grd.addColorStop(1, "#6a0a04");
    g.fillStyle = grd;
    g.fillRect(x, y, w * frac, 14);
    g.strokeStyle = "#ffb060";
    g.lineWidth = 1.5;
    g.strokeRect(x, y, w, 14);
    g.font = "bold 11px 'Lucida Console', monospace";
    g.textAlign = "center";
    g.fillStyle = "#ffd0a0";
    const cyc = boss.cycle > 0 ? `  x${boss.cycle + 1}` : "";
    g.fillText(`${boss.name}${cyc}   ${Math.max(0, Math.ceil(boss.hp))} / ${boss.maxHp}`,
      VIEW_W / 2, y + 26);
    // The one thing a player has to know, and cannot guess from a drill.
    g.font = "bold 10px 'Lucida Console', monospace";
    g.fillStyle = "#a9b3c4";
    g.fillText("EXPLOSIVES AT HIS FEET ARE THE ONLY THING THAT HURTS HIM",
      VIEW_W / 2, y + 42);
    if (boss.lastHitTimer > 0) {
      g.globalAlpha = Math.min(1, boss.lastHitTimer * 1.6);
      g.font = "bold 12px 'Lucida Console', monospace";
      g.fillStyle = "#ffe08a";
      g.fillText(boss.lastHitLabel, VIEW_W / 2, y + 60);
      g.globalAlpha = 1;
    }
    g.restore();
  }
}
