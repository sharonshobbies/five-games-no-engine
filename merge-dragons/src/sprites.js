// sprites.js -- procedural painters for every object family, plus a sprite cache.
// One painter per `art` key in the registry. Each draws into an offscreen canvas
// once; the board then blits the cached bitmap.

import {
  makeCanvas, shade, mix, rgba, hueShift, rngFrom, hashStr, roundRect, blob,
  petal, leafPath, starPath, radialGlow, groundShadow, litFill, rim, speckle,
  sparkle,
} from './artlib.js';

export const T = 84;         // sprite pixels per tile unit
const PAD = 16;
const HEAD = 46;             // headroom above the tile for tall objects

const cache = new Map();

// Growth factor: higher tiers read as bigger and more ornate.
function growth(d) {
  const c = d._chainLen || 10;
  return 0.66 + 0.34 * Math.min(1, d.idx / Math.max(1, c - 1));
}

export function spriteFor(d, variant = '') {
  const key = d.key + '|' + variant;
  let s = cache.get(key);
  if (s) return s;
  const sw = d.size[0], sh = d.size[1];
  const w = sw * T + PAD * 2;
  const h = sh * T + PAD * 2 + HEAD;
  const cv = makeCanvas(w, h);
  const box = {
    w, h,
    gx: w / 2,                       // ground point x
    gy: h - PAD - sh * T * 0.10,     // ground point y (slightly inside the tile)
    tw: sw * T, th: sh * T,
  };
  const rnd = rngFrom(hashStr(d.key + variant));
  const painter = PAINTERS[d.art] || PAINTERS.blobby;
  try {
    painter(cv.ctx, box, d, rnd, variant);
  } catch (err) {
    console.error(`painter "${d.art}" failed for ${d.key}:`, err && err.message);
    PAINTERS.blobby(cv.ctx, box, d, rngFrom(1), variant);
  }
  s = { canvas: cv.canvas, w, h, gx: box.gx, gy: box.gy };
  cache.set(key, s);
  return s;
}

export function clearSpriteCache() { cache.clear(); }

// ---------------------------------------------------------------------------
// shared sub-drawings
// ---------------------------------------------------------------------------
function stem(ctx, x, y, h, w, col, bend = 0) {
  ctx.beginPath();
  ctx.moveTo(x - w / 2, y);
  ctx.quadraticCurveTo(x - w / 2 + bend * 0.6, y - h * 0.5, x + bend - w * 0.22, y - h);
  ctx.lineTo(x + bend + w * 0.22, y - h);
  ctx.quadraticCurveTo(x + w / 2 + bend * 0.6, y - h * 0.5, x + w / 2, y);
  ctx.closePath();
  litFill(ctx, shade(col, 0.22), shade(col, -0.3), y - h, y);
}

function trunk(ctx, x, y, h, w, col) {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.quadraticCurveTo(x - w * 0.42, y - h * 0.55, x - w * 0.3, y - h);
  ctx.lineTo(x + w * 0.3, y - h);
  ctx.quadraticCurveTo(x + w * 0.42, y - h * 0.55, x + w, y);
  ctx.closePath();
  litFill(ctx, shade(col, 0.18), shade(col, -0.34), y - h, y);
  // bark strokes
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba(shade(col, -0.45), 0.45);
  ctx.lineWidth = 1.1;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    const px = x - w * 0.5 + i * w * 0.5;
    ctx.moveTo(px, y);
    ctx.quadraticCurveTo(px + w * 0.1, y - h * 0.6, px - w * 0.05, y - h);
    ctx.stroke();
  }
  ctx.restore();
}

function canopy(ctx, cx, cy, rx, ry, col, rnd, lobes = 7) {
  // dark under-mass first, then a mid mass, then a lit crown: strong value
  // separation is what stops a canopy reading as a flat lollipop
  ctx.save();
  blob(ctx, cx + rx * 0.08, cy + ry * 0.16, rx, ry, lobes, 0.18, rnd, rnd() * 6);
  ctx.fillStyle = shade(col, -0.42);
  ctx.fill();
  ctx.restore();

  ctx.save();
  blob(ctx, cx, cy + ry * 0.02, rx * 0.97, ry * 0.95, lobes, 0.17, rnd, rnd() * 6);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.restore();

  ctx.save();
  blob(ctx, cx - rx * 0.2, cy - ry * 0.26, rx * 0.66, ry * 0.6, lobes - 1, 0.2, rnd, rnd() * 6);
  ctx.fillStyle = shade(col, 0.24);
  ctx.fill();
  ctx.restore();

  ctx.save();
  blob(ctx, cx - rx * 0.3, cy - ry * 0.45, rx * 0.36, ry * 0.28, 6, 0.24, rnd, rnd() * 6);
  ctx.fillStyle = shade(col, 0.48);
  ctx.fill();
  ctx.restore();

  // leaf clumps breaking the silhouette so the edge is not a clean oval
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + rnd() * 0.5;
    const lx = cx + Math.cos(a) * rx * 0.9, ly = cy + Math.sin(a) * ry * 0.86;
    ctx.save();
    blob(ctx, lx, ly, rx * 0.2, ry * 0.19, 5, 0.3, rnd, a);
    ctx.fillStyle = Math.sin(a) < -0.2 ? shade(col, 0.34) : shade(col, -0.2);
    ctx.fill();
    ctx.restore();
  }
  // a few bright leaf strokes for texture
  ctx.save();
  ctx.strokeStyle = rgba(shade(col, 0.55), 0.45);
  ctx.lineWidth = Math.max(1, rx * 0.045);
  for (let i = 0; i < 9; i++) {
    const a = rnd() * 6.28, r = rx * (0.2 + rnd() * 0.62);
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * (ry / rx);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + (rnd() - 0.5) * rx * 0.2, py - rx * 0.12);
    ctx.stroke();
  }
  ctx.restore();
}

function petalRing(ctx, cx, cy, n, L, W, col, rnd, phase = 0, curl = 0.4) {
  for (let i = 0; i < n; i++) {
    const a = phase + (i / n) * Math.PI * 2;
    const t = 0.5 + 0.5 * Math.cos(a);
    const c = mix(shade(col, -0.16), shade(col, 0.42), t);
    petal(ctx, cx, cy, L * (0.92 + rnd() * 0.16), W, a, curl);
    ctx.fillStyle = c;
    ctx.fill();
    ctx.strokeStyle = rgba(shade(col, -0.4), 0.28);
    ctx.lineWidth = 0.8;
    ctx.stroke();
  }
}

function flowerCore(ctx, cx, cy, r, col) {
  const g = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#fffbe8');
  g.addColorStop(0.5, shade(col, 0.5));
  g.addColorStop(1, shade(col, -0.1));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

// ---------------------------------------------------------------------------
// painters
// ---------------------------------------------------------------------------
const PAINTERS = {};

PAINTERS.blobby = (ctx, b, d, rnd) => {
  const g = growth(d), r = T * 0.3 * g;
  groundShadow(ctx, b.gx, b.gy, r * 1.15, r * 0.42);
  blob(ctx, b.gx, b.gy - r, r, r, 8, 0.16, rnd);
  litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.3), b.gy - r * 2, b.gy);
  rim(ctx, '#ffffff', 1.4, 0.4);
};

// --- seeds, sprouts, leaves -------------------------------------------------
PAINTERS.seed = (ctx, b, d, rnd) => {
  const r = T * 0.17;
  groundShadow(ctx, b.gx, b.gy, r * 1.7, r * 0.55);
  // three teardrop seeds fanned out, each outlined so they stay separate
  const spots = [[-r * 0.86, 0.1, -0.5], [r * 0.82, 0.16, 0.5], [0, -r * 0.5, 0]];
  for (const [ox, oy, rot] of spots) {
    const cx = b.gx + ox, cy = b.gy - r * 0.62 + oy;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.beginPath();
    ctx.moveTo(0, -r * 1.05);
    ctx.bezierCurveTo(r * 0.72, -r * 0.4, r * 0.56, r * 0.62, 0, r * 0.72);
    ctx.bezierCurveTo(-r * 0.56, r * 0.62, -r * 0.72, -r * 0.4, 0, -r * 1.05);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.42), shade(d.tint, -0.42), -r * 1.1, r * 0.8);
    ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.8);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // seam down the middle and a specular dab
    ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.55);
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(0, -r * 0.86); ctx.lineTo(0, r * 0.5); ctx.stroke();
    ctx.fillStyle = rgba('#ffffff', 0.42);
    ctx.beginPath(); ctx.ellipse(-r * 0.24, -r * 0.42, r * 0.16, r * 0.26, -0.3, 0, 6.3); ctx.fill();
    ctx.restore();
  }
  // a hint of green life already pushing out of the top seed
  ctx.strokeStyle = '#6fbf55';
  ctx.lineWidth = Math.max(1.6, r * 0.16);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.gx, b.gy - r * 1.7);
  ctx.quadraticCurveTo(b.gx + r * 0.2, b.gy - r * 2.1, b.gx + r * 0.06, b.gy - r * 2.3);
  ctx.stroke();
  sparkle(ctx, b.gx + r * 0.9, b.gy - r * 2.2, r * 0.4, '#fff3c0', 0.75);
};

PAINTERS.sprout = (ctx, b, d, rnd) => {
  const g = growth(d), H = T * 0.46 * (0.85 + g * 0.55);
  groundShadow(ctx, b.gx, b.gy, T * 0.2, T * 0.07);
  // the seed it grew from, still at the base
  ctx.beginPath();
  ctx.ellipse(b.gx, b.gy - H * 0.06, T * 0.055, T * 0.04, 0, 0, 6.3);
  ctx.fillStyle = '#a8763f'; ctx.fill();
  // stem
  ctx.strokeStyle = '#4f9040';
  ctx.lineWidth = Math.max(2, T * 0.035);
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.gx, b.gy - H * 0.04);
  ctx.quadraticCurveTo(b.gx - T * 0.01, b.gy - H * 0.6, b.gx, b.gy - H);
  ctx.stroke();
  // two splayed cotyledons, narrow and pointed so they never merge into a blob
  for (const sgn of [-1, 1]) {
    ctx.save();
    ctx.translate(b.gx, b.gy - H * 0.86);
    ctx.rotate(sgn * 1.42);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-H * 0.14, -H * 0.4, 0, -H * 0.74);
    ctx.quadraticCurveTo(H * 0.19, -H * 0.38, 0, 0);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.42), shade(d.tint, -0.3), -H * 0.8, 0);
    ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.6);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    // midrib
    ctx.strokeStyle = rgba(shade(d.tint, -0.4), 0.5);
    ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(0, -H * 0.06); ctx.lineTo(0, -H * 0.66); ctx.stroke();
    ctx.restore();
  }
  // a small central shoot
  ctx.beginPath();
  ctx.moveTo(b.gx, b.gy - H);
  ctx.quadraticCurveTo(b.gx - H * 0.08, b.gy - H * 1.16, b.gx, b.gy - H * 1.3);
  ctx.quadraticCurveTo(b.gx + H * 0.08, b.gy - H * 1.16, b.gx, b.gy - H);
  ctx.closePath();
  ctx.fillStyle = shade(d.tint, 0.3); ctx.fill();
  ctx.strokeStyle = rgba(shade(d.tint, -0.45), 0.55); ctx.lineWidth = 1; ctx.stroke();
  sparkle(ctx, b.gx + T * 0.11, b.gy - H * 1.1, T * 0.055, '#eaffd0', 0.8);
};

PAINTERS.leaf = (ctx, b, d, rnd) => {
  groundShadow(ctx, b.gx, b.gy, T * 0.2, T * 0.07);
  const L = T * 0.46;
  ctx.save();
  ctx.translate(b.gx, b.gy - L * 0.34); ctx.rotate(-0.35);
  leafPath(ctx, 0, L * 0.5, L, L * 0.42, 0);
  litFill(ctx, shade(d.tint, 0.36), shade(d.tint, -0.28), -L * 0.6, L * 0.5);
  rim(ctx, '#f0ffd8', 1.1, 0.5);
  ctx.strokeStyle = rgba(shade(d.tint, -0.42), 0.6); ctx.lineWidth = 1.1;
  ctx.beginPath(); ctx.moveTo(0, L * 0.5); ctx.lineTo(0, -L * 0.44); ctx.stroke();
  for (let i = 1; i <= 3; i++) {
    const y = L * 0.5 - (L * 0.9 * i) / 4;
    ctx.beginPath(); ctx.moveTo(0, y);
    ctx.lineTo(L * 0.2 * (i % 2 ? 1 : -1), y - L * 0.14); ctx.stroke();
  }
  ctx.restore();
  sparkle(ctx, b.gx + T * 0.16, b.gy - L * 0.9, T * 0.07, '#fffbd0', 0.8);
};

// --- life flowers -----------------------------------------------------------
PAINTERS.flower = (ctx, b, d, rnd) => {
  const g = growth(d);
  const H = T * (0.28 + g * 0.32);
  const R = T * (0.20 + g * 0.22);
  const heads = d.idx >= 5 ? (d.idx >= 7 ? 3 : 2) : 1;
  groundShadow(ctx, b.gx, b.gy, R * 1.5, R * 0.5);
  radialGlow(ctx, b.gx, b.gy - H * 0.9, R * 2.5, d.tint, 0.22);

  // basal leaves
  for (const s of [-1, 1]) {
    leafPath(ctx, b.gx + s * R * 0.24, b.gy, H * 0.62, H * 0.34, s * 1.25);
    litFill(ctx, '#8fd06a', '#3f7a3a', b.gy - H, b.gy);
  }
  const positions = heads === 1 ? [[0, 0]]
    : heads === 2 ? [[-R * 0.52, R * 0.16], [R * 0.5, -R * 0.1]]
      : [[-R * 0.66, R * 0.2], [R * 0.62, R * 0.06], [0, -R * 0.42]];
  for (const [ox, oy] of positions) {
    const hx = b.gx + ox, hy = b.gy - H + oy;
    stem(ctx, b.gx + ox * 0.35, b.gy, H - oy, T * 0.05, '#4f9448', ox * 0.55);
    const n = 5 + Math.min(6, Math.floor(d.idx * 0.7));
    if (d.idx >= 4) petalRing(ctx, hx, hy, n, R * 1.16, R * 0.5, shade(d.tint, 0.3), rnd, 0.3);
    petalRing(ctx, hx, hy, n, R, R * 0.46, d.tint, rnd);
    flowerCore(ctx, hx, hy, R * 0.3, hueShift(d.tint, 30));
    if (d.idx >= 4) {
      for (let i = 0; i < 4; i++) {
        const a = rnd() * 6.28, rr = R * (0.55 + rnd() * 0.7);
        sparkle(ctx, hx + Math.cos(a) * rr, hy + Math.sin(a) * rr, R * 0.15, '#fffce0', 0.85);
      }
    }
  }
};

PAINTERS.lifetree = (ctx, b, d, rnd) => {
  const g = growth(d);
  const H = b.th * (0.5 + g * 0.36);
  const R = b.tw * (0.28 + g * 0.22);
  groundShadow(ctx, b.gx, b.gy, R * 1.35, R * 0.4);
  radialGlow(ctx, b.gx, b.gy - H * 0.78, R * 2.4, d.tint, 0.11);
  // roots
  ctx.strokeStyle = '#6a4f38'; ctx.lineWidth = Math.max(2, R * 0.1); ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(b.gx, b.gy - H * 0.1);
    ctx.quadraticCurveTo(b.gx + s * R * 0.4, b.gy - H * 0.02, b.gx + s * R * 0.72, b.gy);
    ctx.stroke();
  }
  trunk(ctx, b.gx, b.gy, H * 0.62, R * 0.3, '#6f4a2f');
  canopy(ctx, b.gx, b.gy - H * 0.78, R, R * 0.8, d.tint, rnd, 8);
  // glowing life orbs in the branches: 1 per 3 tiers above L8
  const orbs = Math.min(6, 1 + Math.floor(Math.max(0, d.idx - 8) / 2));
  for (let i = 0; i < orbs; i++) {
    const a = -Math.PI / 2 + (i - (orbs - 1) / 2) * (1.5 / Math.max(1, orbs));
    const ox = b.gx + Math.cos(a) * R * 0.62, oy = b.gy - H * 0.74 + Math.sin(a) * R * 0.5;
    radialGlow(ctx, ox, oy, R * 0.32, '#c9ffe0', 0.5);
    ctx.fillStyle = '#f0fff5';
    ctx.beginPath(); ctx.arc(ox, oy, R * 0.1, 0, Math.PI * 2); ctx.fill();
  }
  for (let i = 0; i < 5; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2.3, b.gy - H * (0.4 + rnd() * 0.8), R * 0.1, '#ffffff', 0.5);
};

PAINTERS.rainbow = (ctx, b, d, rnd) => {
  const R = Math.min(b.tw, b.th * 1.6) * 0.52;
  groundShadow(ctx, b.gx, b.gy, R, R * 0.28);
  const cols = ['#ff5f6f', '#ff9f4f', '#ffe14f', '#6fdd7f', '#5fb0ff', '#9f7fff'];
  ctx.lineCap = 'butt';
  for (let i = 0; i < cols.length; i++) {
    ctx.strokeStyle = rgba(cols[i], 0.92);
    ctx.lineWidth = R * 0.13;
    ctx.beginPath();
    ctx.arc(b.gx, b.gy, R - i * R * 0.128, Math.PI, 0);
    ctx.stroke();
  }
  radialGlow(ctx, b.gx, b.gy - R * 0.3, R * 1.3, '#ffffff', 0.3);
  for (let i = 0; i < 22; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2.1, b.gy - rnd() * R * 1.05, R * 0.06, '#ffffff', 0.85);
};

// --- grass ------------------------------------------------------------------
PAINTERS.grass = (ctx, b, d, rnd) => {
  const g = growth(d);
  const H = T * (0.26 + g * 0.38);
  const n = 6 + Math.round(g * 10);
  groundShadow(ctx, b.gx, b.gy, T * 0.26, T * 0.08);
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) - 0.5;
    const bx = b.gx + t * T * 0.42;
    const hh = H * (0.6 + rnd() * 0.55);
    const bend = t * H * 0.42 + (rnd() - 0.5) * H * 0.2;
    ctx.beginPath();
    ctx.moveTo(bx - T * 0.028, b.gy);
    ctx.quadraticCurveTo(bx + bend * 0.4, b.gy - hh * 0.6, bx + bend, b.gy - hh);
    ctx.quadraticCurveTo(bx + bend * 0.5 + T * 0.02, b.gy - hh * 0.55, bx + T * 0.028, b.gy);
    ctx.closePath();
    const c = mix(shade(d.tint, -0.3), shade(d.tint, 0.35), rnd());
    litFill(ctx, shade(c, 0.24), shade(c, -0.3), b.gy - hh, b.gy);
  }
  if (d.idx >= 6) for (let i = 0; i < 5; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * T * 0.5, b.gy - rnd() * H, T * 0.05, '#fff6c0', 0.8);
};

PAINTERS.sword = (ctx, b, d, rnd) => {
  const H = b.th * 0.86, W = b.tw * 0.1;
  groundShadow(ctx, b.gx, b.gy, b.tw * 0.3, b.tw * 0.1);
  // vines
  ctx.strokeStyle = '#4f8f3f'; ctx.lineWidth = W * 0.5; ctx.lineCap = 'round';
  for (let i = 0; i < 4; i++) {
    ctx.beginPath(); ctx.moveTo(b.gx - W, b.gy - H * 0.1 * i);
    ctx.quadraticCurveTo(b.gx + W * (i % 2 ? 3 : -3), b.gy - H * (0.2 + i * 0.16), b.gx, b.gy - H * (0.3 + i * 0.17));
    ctx.stroke();
  }
  // blade
  ctx.beginPath();
  ctx.moveTo(b.gx, b.gy - H);
  ctx.lineTo(b.gx + W, b.gy - H * 0.78);
  ctx.lineTo(b.gx + W * 0.7, b.gy - H * 0.16);
  ctx.lineTo(b.gx - W * 0.7, b.gy - H * 0.16);
  ctx.lineTo(b.gx - W, b.gy - H * 0.78);
  ctx.closePath();
  litFill(ctx, '#ffffff', '#8fa0b0', b.gy - H, b.gy);
  rim(ctx, '#ffffff', 1.5, 0.8);
  // guard + hilt
  roundRect(ctx, b.gx - W * 2.1, b.gy - H * 0.2, W * 4.2, H * 0.06, H * 0.03);
  ctx.fillStyle = '#c9a04f'; ctx.fill();
  roundRect(ctx, b.gx - W * 0.5, b.gy - H * 0.15, W, H * 0.15, W * 0.4);
  ctx.fillStyle = '#8f5f3f'; ctx.fill();
  radialGlow(ctx, b.gx, b.gy - H * 0.6, b.tw * 0.4, '#dff0ff', 0.35);
};

// --- stones -----------------------------------------------------------------
PAINTERS.stone = (ctx, b, d, rnd) => {
  const g = growth(d);
  const R = Math.min(b.tw, b.th) * (0.24 + g * 0.22);
  const n = d.idx < 2 ? 3 : d.idx < 5 ? 2 : 1;
  groundShadow(ctx, b.gx, b.gy, R * 1.5, R * 0.44);
  const spots = n === 3 ? [[-R * 0.7, 0, 0.6], [R * 0.66, -R * 0.1, 0.7], [0, -R * 0.5, 0.95]]
    : n === 2 ? [[-R * 0.45, 0, 0.8], [R * 0.4, -R * 0.35, 1]]
      : [[0, 0, 1.25]];
  for (const [ox, oy, sc] of spots) {
    const cx = b.gx + ox, cy = b.gy + oy - R * sc * 0.58;
    const rr = R * sc;
    // angular boulder: a faceted polygon reads as stone where a blob reads as a pot
    const n = 7;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2 + (rnd() - 0.5) * 0.3;
      const k = 0.78 + rnd() * 0.32;
      pts.push([cx + Math.cos(a) * rr * k, cy + Math.sin(a) * rr * 0.86 * k]);
    }
    ctx.save();
    ctx.beginPath();
    pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.2), shade(d.tint, -0.52), cy - rr, cy + rr);
    ctx.strokeStyle = rgba(shade(d.tint, -0.62), 0.75);
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.clip();
    // lit top-left facet
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    ctx.lineTo(pts[n - 1][0], pts[n - 1][1]);
    ctx.lineTo(cx - rr * 0.1, cy + rr * 0.1);
    ctx.lineTo(pts[1][0], pts[1][1]);
    ctx.closePath();
    ctx.fillStyle = rgba(shade(d.tint, 0.44), 0.75);
    ctx.fill();
    // shadowed lower-right facet
    ctx.beginPath();
    ctx.moveTo(pts[3][0], pts[3][1]);
    ctx.lineTo(pts[4][0], pts[4][1]);
    ctx.lineTo(cx, cy + rr * 0.1);
    ctx.closePath();
    ctx.fillStyle = rgba('#000000', 0.2);
    ctx.fill();
    speckle(ctx, cx - rr, cy - rr, rr * 2, rr * 2, rgba('#000000', 0.13), 14, rnd, 0.7, 2.2);
    ctx.restore();
    // moss only on the crown, with tufts breaking the outline
    ctx.save();
    blob(ctx, cx - rr * 0.08, cy - rr * 0.6, rr * 0.6, rr * 0.24, 6, 0.32, rnd);
    ctx.fillStyle = mix('#5f9e4a', d.tint, 0.15);
    ctx.fill();
    ctx.strokeStyle = rgba('#8fd05f', 0.85);
    ctx.lineWidth = 1.3;
    for (let k = 0; k < 6; k++) {
      const px = cx - rr * 0.55 + rnd() * rr * 1.1, py = cy - rr * (0.62 + rnd() * 0.16);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (rnd() - 0.5) * 5, py - 4 - rnd() * 4); ctx.stroke();
    }
    ctx.restore();
  }
};

PAINTERS.henge = (ctx, b, d, rnd) => {
  const H = b.th * 0.66, W = b.tw * 0.13;
  groundShadow(ctx, b.gx, b.gy, b.tw * 0.44, b.tw * 0.14);
  const posts = [-2.1, -0.7, 0.7, 2.1];
  for (const p of posts) {
    const x = b.gx + p * W * 1.35;
    roundRect(ctx, x - W / 2, b.gy - H, W, H, W * 0.2);
    litFill(ctx, shade(d.tint, 0.26), shade(d.tint, -0.34), b.gy - H, b.gy);
    rim(ctx, '#ffffff', 1, 0.28);
  }
  roundRect(ctx, b.gx - W * 3.2, b.gy - H - W * 0.7, W * 6.4, W * 0.72, W * 0.2);
  litFill(ctx, shade(d.tint, 0.34), shade(d.tint, -0.24), b.gy - H - W, b.gy - H);
  radialGlow(ctx, b.gx, b.gy - H * 0.6, b.tw * 0.5, '#a8c0ff', 0.24);
};

PAINTERS.brick = (ctx, b, d, rnd) => {
  const g = growth(d);
  const W = T * (0.26 + g * 0.11), Hh = W * 0.46;
  const rows = d.idx < 1 ? 1 : d.idx < 3 ? 2 : 3;
  groundShadow(ctx, b.gx, b.gy, W * 1.1, W * 0.34);
  for (let r = 0; r < rows; r++) {
    const cnt = rows - r;
    for (let i = 0; i < cnt; i++) {
      const x = b.gx - ((cnt - 1) * W) / 2 + i * W - (r % 2 ? W * 0.1 : 0);
      const y = b.gy - (r + 1) * Hh;
      roundRect(ctx, x - W / 2, y, W, Hh, Hh * 0.16);
      litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.3), y, y + Hh);
      ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.5); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = rgba('#ffffff', 0.2);
      ctx.fillRect(x - W / 2 + 1.5, y + 1.2, W - 3, Hh * 0.2);
    }
  }
  if (d.idx >= 4) radialGlow(ctx, b.gx, b.gy - Hh * rows, W * 1.3, d.tint, 0.3);
};

// --- coins / gems -----------------------------------------------------------
PAINTERS.coin = (ctx, b, d, rnd) => {
  const g = growth(d);
  const R = T * (0.16 + g * 0.11);
  const n = d.idx === 0 ? 1 : d.idx < 3 ? 2 : 3;
  groundShadow(ctx, b.gx, b.gy, R * (n > 1 ? 2 : 1.3), R * 0.42);
  const spots = n === 1 ? [[0, 0]] : n === 2 ? [[-R * 0.6, 0], [R * 0.55, -R * 0.3]]
    : [[-R * 0.9, 0], [R * 0.85, -R * 0.14], [0, -R * 0.7]];
  for (const [ox, oy] of spots) {
    const cx = b.gx + ox, cy = b.gy + oy - R * 0.9;
    ctx.save(); ctx.translate(cx, cy); ctx.scale(1, 0.9);
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2);
    const gr = ctx.createLinearGradient(-R, -R, R, R);
    gr.addColorStop(0, shade(d.tint, 0.55));
    gr.addColorStop(0.45, d.tint);
    gr.addColorStop(1, shade(d.tint, -0.4));
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = shade(d.tint, -0.42); ctx.lineWidth = 1.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2);
    ctx.strokeStyle = rgba(shade(d.tint, -0.3), 0.7); ctx.lineWidth = 1; ctx.stroke();
    // dragon-scale emblem
    ctx.fillStyle = rgba(shade(d.tint, -0.36), 0.75);
    starPath(ctx, 0, 0, 4, R * 0.44, R * 0.14);
    ctx.fill();
    ctx.restore();
    sparkle(ctx, cx + R * 0.55, cy - R * 0.6, R * 0.4, '#fffbe0', 0.9);
  }
};

PAINTERS.gem = (ctx, b, d, rnd) => {
  const g = growth(d), R = T * (0.20 + g * 0.14);
  groundShadow(ctx, b.gx, b.gy, R * 1.2, R * 0.36);
  const cy = b.gy - R * 1.05;
  radialGlow(ctx, b.gx, cy, R * 2.2, d.tint, 0.4);
  const facets = 6;
  ctx.beginPath();
  for (let i = 0; i < facets; i++) {
    const a = -Math.PI / 2 + (i / facets) * Math.PI * 2;
    const x = b.gx + Math.cos(a) * R, y = cy + Math.sin(a) * R * 1.12;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
  litFill(ctx, shade(d.tint, 0.6), shade(d.tint, -0.35), cy - R, cy + R);
  ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 1.2; ctx.stroke();
  for (let i = 0; i < facets; i++) {
    const a = -Math.PI / 2 + (i / facets) * Math.PI * 2;
    ctx.beginPath(); ctx.moveTo(b.gx, cy);
    ctx.lineTo(b.gx + Math.cos(a) * R, cy + Math.sin(a) * R * 1.12);
    ctx.strokeStyle = rgba('#ffffff', 0.28); ctx.lineWidth = 0.9; ctx.stroke();
  }
  sparkle(ctx, b.gx - R * 0.3, cy - R * 0.4, R * 0.6, '#ffffff', 0.95);
};

PAINTERS.dgem = (ctx, b, d, rnd) => { PAINTERS.gem(ctx, b, d, rnd); };

// --- trees ------------------------------------------------------------------
PAINTERS.tree = (ctx, b, d, rnd) => {
  const g = growth(d);
  const H = b.th * (0.44 + g * 0.44);
  const R = b.tw * (0.25 + g * 0.22);
  groundShadow(ctx, b.gx, b.gy, R * 1.3, R * 0.4);
  trunk(ctx, b.gx, b.gy, H * 0.56, R * 0.24, '#6f4a2f');
  canopy(ctx, b.gx, b.gy - H * 0.76, R, R * 0.78, d.tint, rnd, 7);
  // fruit dots for fruit trees
  if (d.chain === 'fruitTree' && d.idx >= 4) {
    const fc = ['#e04f5f', '#ff9f3f', '#c94fd0', '#ffd93f'][d.idx % 4];
    for (let i = 0; i < 4 + (d.idx > 7 ? 3 : 0); i++) {
      const a = rnd() * 6.28, rr = R * (0.3 + rnd() * 0.6);
      const fx = b.gx + Math.cos(a) * rr, fy = b.gy - H * 0.7 + Math.sin(a) * rr * 0.7;
      ctx.beginPath(); ctx.arc(fx, fy, R * 0.11, 0, Math.PI * 2);
      ctx.fillStyle = fc; ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.6);
      ctx.beginPath(); ctx.arc(fx - R * 0.04, fy - R * 0.04, R * 0.035, 0, Math.PI * 2); ctx.fill();
    }
  }
  if (d.chain === 'dragonTree' && d.idx >= 7) {
    radialGlow(ctx, b.gx, b.gy - H * 0.7, R * 1.9, d.tint, 0.22);
  }
  if (d.chain === 'autumnTree') {
    for (let i = 0; i < 5; i++) {
      const lx = b.gx + (rnd() - 0.5) * R * 2, ly = b.gy - rnd() * H * 0.3;
      leafPath(ctx, lx, ly, R * 0.22, R * 0.1, rnd() * 6);
      ctx.fillStyle = rgba(shade(d.tint, 0.1), 0.85); ctx.fill();
    }
  }
};

PAINTERS.bones = (ctx, b, d, rnd) => {
  const W = b.tw * 0.42, H = b.th * 0.5;
  groundShadow(ctx, b.gx, b.gy, W * 1.1, W * 0.3);
  // ribcage arcs
  ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = Math.max(2.4, W * 0.09); ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const y = b.gy - H * 0.16 - i * H * 0.14;
    ctx.beginPath();
    ctx.moveTo(b.gx - W * (0.8 - i * 0.08), y);
    ctx.quadraticCurveTo(b.gx, y - H * 0.16, b.gx + W * (0.8 - i * 0.08), y);
    ctx.stroke();
  }
  // spine
  ctx.beginPath(); ctx.moveTo(b.gx, b.gy - H * 0.05); ctx.lineTo(b.gx, b.gy - H * 0.86); ctx.stroke();
  // skull
  ctx.beginPath(); ctx.ellipse(b.gx, b.gy - H * 1.0, W * 0.3, W * 0.24, 0, 0, Math.PI * 2);
  litFill(ctx, '#fffaf0', '#c8bda6', b.gy - H * 1.3, b.gy - H * 0.8);
  ctx.fillStyle = '#4a3f3a';
  ctx.beginPath(); ctx.arc(b.gx - W * 0.11, b.gy - H * 1.02, W * 0.055, 0, 6.3); ctx.fill();
  ctx.beginPath(); ctx.arc(b.gx + W * 0.11, b.gy - H * 1.02, W * 0.055, 0, 6.3); ctx.fill();
  // horns
  ctx.strokeStyle = '#efe6d2'; ctx.lineWidth = W * 0.07;
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(b.gx + s * W * 0.22, b.gy - H * 1.12);
    ctx.quadraticCurveTo(b.gx + s * W * 0.5, b.gy - H * 1.3, b.gx + s * W * 0.3, b.gy - H * 1.42);
    ctx.stroke();
  }
  radialGlow(ctx, b.gx, b.gy - H * 0.7, b.tw * 0.5, '#c9b0ff', 0.2);
};

PAINTERS.beanstalk = (ctx, b, d, rnd) => {
  const H = b.th * 0.95, W = b.tw * 0.09;
  groundShadow(ctx, b.gx, b.gy, W * 3, W * 0.9);
  ctx.strokeStyle = '#4f9e4f'; ctx.lineWidth = W; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(b.gx, b.gy);
    for (let i = 1; i <= 8; i++) {
      const t = i / 8;
      ctx.lineTo(b.gx + Math.sin(t * 7) * W * 1.8 * s, b.gy - H * t);
    }
    ctx.stroke();
  }
  for (let i = 0; i < 12; i++) {
    const t = 0.1 + rnd() * 0.9;
    const lx = b.gx + Math.sin(t * 7) * W * 1.8 * (i % 2 ? 1 : -1), ly = b.gy - H * t;
    leafPath(ctx, lx, ly, W * 3.2, W * 1.5, (i % 2 ? 1 : -1) * 1.2 + rnd() * 0.4);
    litFill(ctx, '#9fe07f', '#4f8f3f', ly - W * 3, ly);
  }
  radialGlow(ctx, b.gx, b.gy - H, b.tw * 0.6, '#ffffcf', 0.34);
};

// --- prism flowers ----------------------------------------------------------
PAINTERS.prism = (ctx, b, d, rnd) => {
  const g = growth(d);
  const H = T * (0.28 + g * 0.3), R = T * (0.19 + g * 0.22);
  groundShadow(ctx, b.gx, b.gy, R * 1.5, R * 0.46);
  radialGlow(ctx, b.gx, b.gy - H, R * 2.8, '#ffffff', 0.2);
  stem(ctx, b.gx, b.gy, H, T * 0.05, '#5f9e6f');
  for (const s of [-1, 1]) {
    leafPath(ctx, b.gx, b.gy - H * 0.24, H * 0.5, H * 0.26, s * 1.3);
    litFill(ctx, '#8fd0a0', '#3f7a5f', b.gy - H, b.gy);
  }
  const cols = ['#ff5f7f', '#ff9f4f', '#ffe14f', '#6fdd8f', '#5fb0ff', '#a87fff'];
  const n = Math.max(6, 6 + Math.floor(d.idx * 0.5));
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    const c = cols[i % cols.length];
    petal(ctx, b.gx, b.gy - H, R * (0.95 + rnd() * 0.16), R * 0.42, a, 0.45);
    const gr = ctx.createRadialGradient(b.gx, b.gy - H, 0, b.gx, b.gy - H, R);
    gr.addColorStop(0, shade(c, 0.6)); gr.addColorStop(1, c);
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 0.8; ctx.stroke();
  }
  flowerCore(ctx, b.gx, b.gy - H, R * 0.28, '#ffffff');
  for (let i = 0; i < 6; i++) {
    const a = rnd() * 6.28, rr = R * (0.9 + rnd() * 0.8);
    sparkle(ctx, b.gx + Math.cos(a) * rr, b.gy - H + Math.sin(a) * rr, R * 0.16, '#ffffff', 0.9);
  }
};

PAINTERS.dome = (ctx, b, d, rnd) => {
  const R = b.tw * 0.36;
  groundShadow(ctx, b.gx, b.gy, R * 1.15, R * 0.32);
  const cy = b.gy - R * 0.1;
  ctx.beginPath(); ctx.arc(b.gx, cy, R, Math.PI, 0); ctx.closePath();
  const gr = ctx.createLinearGradient(0, cy - R, 0, cy);
  gr.addColorStop(0, rgba('#ffffff', 0.9));
  gr.addColorStop(0.5, rgba(d.tint, 0.7));
  gr.addColorStop(1, rgba('#8fd0ff', 0.55));
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 2; ctx.stroke();
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(b.gx, cy, R * (1 - i * 0.18), R, 0, Math.PI, 0);
    ctx.strokeStyle = rgba('#ffffff', 0.32); ctx.lineWidth = 1; ctx.stroke();
  }
  radialGlow(ctx, b.gx, cy - R * 0.4, R * 1.6, '#ffe0ff', 0.4);
  for (let i = 0; i < 14; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2, cy - rnd() * R, R * 0.06, '#ffffff', 0.85);
};

// --- chests -----------------------------------------------------------------
PAINTERS.chest = (ctx, b, d, rnd) => {
  const g = growth(d);
  const W = Math.min(b.tw * 0.72, T * (0.50 + g * 0.26));
  const H = W * 0.7;
  groundShadow(ctx, b.gx, b.gy, W * 0.72, W * 0.22);
  const x = b.gx - W / 2, y = b.gy - H;
  // body
  roundRect(ctx, x, y + H * 0.34, W, H * 0.66, W * 0.07);
  litFill(ctx, shade(d.tint, 0.26), shade(d.tint, -0.4), y + H * 0.3, b.gy);
  ctx.strokeStyle = shade(d.tint, -0.55); ctx.lineWidth = 1.4; ctx.stroke();
  // lid
  ctx.beginPath();
  ctx.moveTo(x, y + H * 0.4);
  ctx.quadraticCurveTo(b.gx, y - H * 0.16, x + W, y + H * 0.4);
  ctx.closePath();
  litFill(ctx, shade(d.tint, 0.4), shade(d.tint, -0.2), y - H * 0.1, y + H * 0.4);
  ctx.strokeStyle = shade(d.tint, -0.55); ctx.lineWidth = 1.4; ctx.stroke();
  // metal bands
  ctx.fillStyle = '#c9a04f';
  ctx.fillRect(x + W * 0.06, y + H * 0.36, W * 0.07, H * 0.62);
  ctx.fillRect(x + W * 0.87, y + H * 0.36, W * 0.07, H * 0.62);
  // lock
  roundRect(ctx, b.gx - W * 0.1, y + H * 0.32, W * 0.2, H * 0.26, W * 0.04);
  litFill(ctx, '#ffe08f', '#a8752f', y + H * 0.3, y + H * 0.6);
  ctx.strokeStyle = '#6f4a1f'; ctx.lineWidth = 1; ctx.stroke();
  ctx.beginPath(); ctx.arc(b.gx, y + H * 0.44, W * 0.035, 0, 6.3);
  ctx.fillStyle = '#5f3f1f'; ctx.fill();
  if (d.idx >= 3) {
    radialGlow(ctx, b.gx, y + H * 0.2, W * 0.9, d.idx >= 5 ? '#ffe98f' : '#c9d8ff', 0.35);
    for (let i = 0; i < 6; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * W, y + (rnd() - 0.2) * H * 0.5, W * 0.07, '#fffbd0', 0.9);
  }
  if (d.idx === 2) { // chains
    ctx.strokeStyle = '#9aa0a8'; ctx.lineWidth = W * 0.05;
    ctx.beginPath(); ctx.moveTo(x, y + H * 0.62); ctx.lineTo(x + W, y + H * 0.62); ctx.stroke();
  }
};

// --- goal stars -------------------------------------------------------------
PAINTERS.star = (ctx, b, d, rnd) => {
  const g = growth(d);
  const R = Math.min(b.tw, b.th) * (0.24 + g * 0.19);
  const cy = b.gy - R * 1.05;
  groundShadow(ctx, b.gx, b.gy, R * 0.95, R * 0.3);
  radialGlow(ctx, b.gx, cy, R * 2.2, '#fff3a0', 0.3);
  starPath(ctx, b.gx, cy, 5, R, R * 0.42);
  const gr = ctx.createRadialGradient(b.gx, cy - R * 0.3, R * 0.1, b.gx, cy, R);
  gr.addColorStop(0, '#fffef0'); gr.addColorStop(0.5, '#ffe677'); gr.addColorStop(1, '#f0a83f');
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = rgba('#fff8c0', 0.9); ctx.lineWidth = 1.4; ctx.stroke();
  // lens flare cross
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = rgba('#ffffff', 0.32); ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(b.gx - R * 1.4, cy); ctx.lineTo(b.gx + R * 1.4, cy);
  ctx.moveTo(b.gx, cy - R * 1.4); ctx.lineTo(b.gx, cy + R * 1.4); ctx.stroke();
  ctx.restore();
};

PAINTERS.dstar = (ctx, b, d, rnd) => {
  PAINTERS.star(ctx, b, d, rnd);
  const R = Math.min(b.tw, b.th) * 0.3, cy = b.gy - R * 1.05;
  radialGlow(ctx, b.gx, cy, R * 2.2, '#ff9fe0', 0.45);
  for (let i = 0; i < 10; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 3, cy + (rnd() - 0.5) * R * 3, R * 0.14, '#ffd0ff', 0.9);
};

// --- orbs / essence ---------------------------------------------------------
PAINTERS.orb = (ctx, b, d, rnd) => {
  const g = growth(d);
  const R = T * (0.16 + g * 0.16);
  const cy = b.gy - R * 1.25;
  groundShadow(ctx, b.gx, b.gy, R * 1.1, R * 0.3, 0.2);
  radialGlow(ctx, b.gx, cy, R * 2.5, d.tint, 0.4);
  const gr = ctx.createRadialGradient(b.gx - R * 0.32, cy - R * 0.36, R * 0.08, b.gx, cy, R);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.35, shade(d.tint, 0.55));
  gr.addColorStop(0.8, d.tint);
  gr.addColorStop(1, shade(d.tint, -0.3));
  ctx.fillStyle = gr;
  ctx.beginPath(); ctx.arc(b.gx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 1.2; ctx.stroke();
  // inner swirl
  ctx.save(); ctx.clip();
  ctx.strokeStyle = rgba('#ffffff', 0.4); ctx.lineWidth = R * 0.14;
  ctx.beginPath(); ctx.arc(b.gx + R * 0.2, cy + R * 0.2, R * 0.55, 0.6, 3.4); ctx.stroke();
  ctx.restore();
  sparkle(ctx, b.gx - R * 0.35, cy - R * 0.45, R * 0.55, '#ffffff', 0.95);
  for (let i = 0; i < 3 + d.idx; i++) {
    const a = rnd() * 6.28, rr = R * (1.2 + rnd() * 1.1);
    sparkle(ctx, b.gx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9, R * 0.16, '#ffffff', 0.7);
  }
};

PAINTERS.essence = (ctx, b, d, rnd) => {
  const g = growth(d), W = T * (0.16 + g * 0.1), H = W * 1.7;
  groundShadow(ctx, b.gx, b.gy, W * 0.9, W * 0.28);
  radialGlow(ctx, b.gx, b.gy - H * 0.6, W * 2.4, d.tint, 0.4);
  // little flask
  ctx.beginPath();
  ctx.moveTo(b.gx - W * 0.22, b.gy - H);
  ctx.lineTo(b.gx - W * 0.22, b.gy - H * 0.7);
  ctx.quadraticCurveTo(b.gx - W * 0.62, b.gy - H * 0.5, b.gx - W * 0.5, b.gy - H * 0.08);
  ctx.quadraticCurveTo(b.gx, b.gy + H * 0.06, b.gx + W * 0.5, b.gy - H * 0.08);
  ctx.quadraticCurveTo(b.gx + W * 0.62, b.gy - H * 0.5, b.gx + W * 0.22, b.gy - H * 0.7);
  ctx.lineTo(b.gx + W * 0.22, b.gy - H);
  ctx.closePath();
  litFill(ctx, rgba('#ffffff', 0.5), rgba(d.tint, 0.85), b.gy - H, b.gy);
  ctx.strokeStyle = rgba('#ffffff', 0.75); ctx.lineWidth = 1.3; ctx.stroke();
  ctx.fillStyle = '#8f6f4f';
  roundRect(ctx, b.gx - W * 0.28, b.gy - H - W * 0.14, W * 0.56, W * 0.2, W * 0.06); ctx.fill();
  sparkle(ctx, b.gx, b.gy - H * 0.35, W * 0.5, '#ffffff', 0.9);
};

PAINTERS.bulb = (ctx, b, d, rnd) => {
  const g = growth(d), R = T * (0.15 + g * 0.16), H = T * (0.2 + g * 0.24);
  groundShadow(ctx, b.gx, b.gy, R * 1.3, R * 0.4);
  radialGlow(ctx, b.gx, b.gy - H, R * 2.6, d.tint, 0.4);
  stem(ctx, b.gx, b.gy, H, T * 0.045, '#5f9e5f');
  // teardrop bud
  ctx.beginPath();
  ctx.moveTo(b.gx, b.gy - H - R * 1.15);
  ctx.bezierCurveTo(b.gx + R * 0.95, b.gy - H - R * 0.5, b.gx + R * 0.7, b.gy - H + R * 0.3, b.gx, b.gy - H + R * 0.34);
  ctx.bezierCurveTo(b.gx - R * 0.7, b.gy - H + R * 0.3, b.gx - R * 0.95, b.gy - H - R * 0.5, b.gx, b.gy - H - R * 1.15);
  ctx.closePath();
  litFill(ctx, '#fffdf5', shade(d.tint, -0.15), b.gy - H - R * 1.2, b.gy - H + R * 0.4);
  ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 1.2; ctx.stroke();
  if (d.idx >= 3) petalRing(ctx, b.gx, b.gy - H + R * 0.1, 6, R * 0.7, R * 0.3, shade(d.tint, 0.2), rnd, 0.4);
  for (let i = 0; i < 5; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2.4, b.gy - H - rnd() * R * 1.4, R * 0.14, '#ffffff', 0.85);
};

// --- water ------------------------------------------------------------------
PAINTERS.water = (ctx, b, d, rnd) => {
  const g = growth(d);
  const rx = b.tw * (0.24 + g * 0.22), ry = rx * 0.55;
  const cy = b.gy - ry * 0.5;
  ctx.save();
  blob(ctx, b.gx, cy, rx, ry, 9, 0.1, rnd);
  const gr = ctx.createLinearGradient(0, cy - ry, 0, cy + ry);
  gr.addColorStop(0, shade(d.tint, 0.4));
  gr.addColorStop(0.5, d.tint);
  gr.addColorStop(1, shade(d.tint, -0.42));
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = rgba('#dff4ff', 0.75); ctx.lineWidth = 1.6; ctx.stroke();
  ctx.save(); ctx.clip();
  // highlights
  for (let i = 0; i < 4; i++) {
    ctx.strokeStyle = rgba('#ffffff', 0.4 - i * 0.07); ctx.lineWidth = 1.6;
    ctx.beginPath();
    const yy = cy - ry * 0.45 + i * ry * 0.36;
    ctx.moveTo(b.gx - rx * 0.5, yy);
    ctx.quadraticCurveTo(b.gx, yy - ry * 0.12, b.gx + rx * 0.45, yy);
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
  // lily pad on bigger ponds
  if (d.idx >= 5) {
    ctx.beginPath(); ctx.ellipse(b.gx + rx * 0.4, cy + ry * 0.16, rx * 0.2, rx * 0.13, 0.2, 0, 6.3);
    ctx.fillStyle = '#5fa85f'; ctx.fill();
    ctx.strokeStyle = rgba('#2f6f2f', 0.6); ctx.lineWidth = 1; ctx.stroke();
  }
  for (let i = 0; i < 4; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * rx * 1.6, cy + (rnd() - 0.5) * ry * 1.4, rx * 0.07, '#ffffff', 0.7);
};

PAINTERS.bottle = (ctx, b, d, rnd) => {
  const W = b.tw * 0.34, H = b.th * 0.5;
  groundShadow(ctx, b.gx, b.gy, W * 1.1, W * 0.32);
  ctx.beginPath();
  ctx.moveTo(b.gx - W * 0.22, b.gy - H);
  ctx.quadraticCurveTo(b.gx - W, b.gy - H * 0.6, b.gx - W * 0.82, b.gy - H * 0.06);
  ctx.quadraticCurveTo(b.gx, b.gy + H * 0.08, b.gx + W * 0.82, b.gy - H * 0.06);
  ctx.quadraticCurveTo(b.gx + W, b.gy - H * 0.6, b.gx + W * 0.22, b.gy - H);
  ctx.closePath();
  ctx.save(); ctx.clip();
  ctx.fillStyle = shade(d.tint, -0.2);
  ctx.fillRect(b.gx - W, b.gy - H * 0.62, W * 2, H);
  for (let i = 0; i < 5; i++) {
    ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 2;
    ctx.beginPath();
    const yy = b.gy - H * 0.5 + i * H * 0.12;
    ctx.moveTo(b.gx - W, yy); ctx.quadraticCurveTo(b.gx, yy - H * 0.06, b.gx + W, yy); ctx.stroke();
  }
  ctx.restore();
  ctx.strokeStyle = rgba('#e0f4ff', 0.85); ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#8f6f4f';
  roundRect(ctx, b.gx - W * 0.28, b.gy - H - W * 0.16, W * 0.56, W * 0.22, W * 0.07); ctx.fill();
  radialGlow(ctx, b.gx, b.gy - H * 0.5, W * 1.6, '#8fd0ff', 0.3);
};

// --- mushrooms / bushes -----------------------------------------------------
PAINTERS.shroom = (ctx, b, d, rnd) => {
  const g = growth(d);
  const R = T * (0.18 + g * 0.17), H = T * (0.17 + g * 0.22);
  const n = d.idx <= 1 ? 3 : d.idx <= 3 ? 3 : 1;
  groundShadow(ctx, b.gx, b.gy, R * 1.5, R * 0.44);
  const spots = n === 3 ? [[-R * 0.8, 0, 0.62], [R * 0.75, R * 0.06, 0.7], [0, -R * 0.2, 0.95]] : [[0, 0, 1.3]];
  for (const [ox, oy, sc] of spots) {
    const cx = b.gx + ox, cy = b.gy + oy;
    const hh = H * sc, rr = R * sc;
    // stem
    ctx.beginPath();
    ctx.moveTo(cx - rr * 0.28, cy);
    ctx.quadraticCurveTo(cx - rr * 0.2, cy - hh * 0.6, cx - rr * 0.22, cy - hh);
    ctx.lineTo(cx + rr * 0.22, cy - hh);
    ctx.quadraticCurveTo(cx + rr * 0.2, cy - hh * 0.6, cx + rr * 0.28, cy);
    ctx.closePath();
    litFill(ctx, '#fff6e8', '#c9b8a0', cy - hh, cy);
    // cap
    ctx.beginPath();
    ctx.moveTo(cx - rr, cy - hh);
    ctx.quadraticCurveTo(cx - rr * 0.9, cy - hh - rr * 1.05, cx, cy - hh - rr * 1.05);
    ctx.quadraticCurveTo(cx + rr * 0.9, cy - hh - rr * 1.05, cx + rr, cy - hh);
    ctx.quadraticCurveTo(cx, cy - hh + rr * 0.22, cx - rr, cy - hh);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.34), shade(d.tint, -0.36), cy - hh - rr * 1.1, cy - hh);
    ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.4); ctx.lineWidth = 1; ctx.stroke();
    ctx.save(); ctx.clip();
    ctx.fillStyle = rgba('#fff8e8', 0.9);
    for (let i = 0; i < 4; i++) {
      const px = cx + (rnd() - 0.5) * rr * 1.5, py = cy - hh - rr * (0.25 + rnd() * 0.6);
      ctx.beginPath(); ctx.ellipse(px, py, rr * 0.15, rr * 0.11, 0, 0, 6.3); ctx.fill();
    }
    ctx.restore();
  }
  if (d.idx >= 8) radialGlow(ctx, b.gx, b.gy - H, R * 2, d.tint, 0.3);
};

PAINTERS.bush = (ctx, b, d, rnd) => {
  const g = growth(d);
  const R = T * (0.25 + g * 0.18);
  groundShadow(ctx, b.gx, b.gy, R * 1.3, R * 0.4);
  canopy(ctx, b.gx, b.gy - R * 0.72, R, R * 0.7, d.tint, rnd, 9);
  if (d.idx >= 3) {
    for (let i = 0; i < 5; i++) {
      const a = rnd() * 6.28, rr = R * (0.3 + rnd() * 0.6);
      const fx = b.gx + Math.cos(a) * rr, fy = b.gy - R * 0.72 + Math.sin(a) * rr * 0.7;
      petalRing(ctx, fx, fy, 5, R * 0.15, R * 0.07, '#ffd0e8', rnd);
      ctx.fillStyle = '#fff6b0';
      ctx.beginPath(); ctx.arc(fx, fy, R * 0.035, 0, 6.3); ctx.fill();
    }
  }
};

PAINTERS.ruins = (ctx, b, d, rnd) => {
  const W = b.tw * 0.1, H = b.th * 0.5;
  groundShadow(ctx, b.gx, b.gy, b.tw * 0.4, b.tw * 0.13);
  const cols = [[-2.4, 1], [-0.9, 0.7], [0.9, 0.92], [2.4, 0.55]];
  for (const [p, hs] of cols) {
    const x = b.gx + p * W * 1.3, hh = H * hs;
    roundRect(ctx, x - W / 2, b.gy - hh, W, hh, W * 0.1);
    litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.3), b.gy - hh, b.gy);
    // fluting
    ctx.strokeStyle = rgba(shade(d.tint, -0.4), 0.4); ctx.lineWidth = 0.9;
    ctx.beginPath(); ctx.moveTo(x, b.gy - hh); ctx.lineTo(x, b.gy); ctx.stroke();
    roundRect(ctx, x - W * 0.72, b.gy - hh - W * 0.3, W * 1.44, W * 0.32, W * 0.08);
    ctx.fillStyle = shade(d.tint, 0.4); ctx.fill();
  }
  // broken lintel
  ctx.save(); ctx.translate(b.gx - W, b.gy - H * 1.05); ctx.rotate(-0.14);
  roundRect(ctx, -W * 2, 0, W * 4, W * 0.4, W * 0.1);
  ctx.fillStyle = shade(d.tint, 0.2); ctx.fill();
  ctx.restore();
  radialGlow(ctx, b.gx, b.gy - H * 0.7, b.tw * 0.5, '#dff0ff', 0.26);
};

// --- graves -----------------------------------------------------------------
PAINTERS.grave = (ctx, b, d, rnd) => {
  const g = growth(d);
  const W = T * (0.24 + g * 0.14), H = T * (0.26 + g * 0.24);
  groundShadow(ctx, b.gx, b.gy, W * 1.1, W * 0.34);
  // mound
  ctx.beginPath();
  ctx.ellipse(b.gx, b.gy, W * 0.86, W * 0.24, 0, Math.PI, 0);
  ctx.fillStyle = '#5f5346'; ctx.fill();
  const cross = d.idx === 3;
  if (cross) {
    ctx.fillStyle = shade(d.tint, -0.1);
    roundRect(ctx, b.gx - W * 0.1, b.gy - H, W * 0.2, H, W * 0.04); ctx.fill();
    roundRect(ctx, b.gx - W * 0.44, b.gy - H * 0.74, W * 0.88, W * 0.18, W * 0.04); ctx.fill();
    rim(ctx, '#ffffff', 1, 0.24);
  } else {
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 0.46, b.gy - H * 0.06);
    ctx.lineTo(b.gx - W * 0.46, b.gy - H * 0.68);
    ctx.quadraticCurveTo(b.gx, b.gy - H * 1.12, b.gx + W * 0.46, b.gy - H * 0.68);
    ctx.lineTo(b.gx + W * 0.46, b.gy - H * 0.06);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.28), shade(d.tint, -0.36), b.gy - H, b.gy);
    ctx.strokeStyle = shade(d.tint, -0.5); ctx.lineWidth = 1.2; ctx.stroke();
    // engraving
    ctx.strokeStyle = rgba('#000000', 0.22); ctx.lineWidth = 1.4;
    for (let i = 0; i < 2; i++) {
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.22, b.gy - H * (0.52 - i * 0.14));
      ctx.lineTo(b.gx + W * 0.22, b.gy - H * (0.52 - i * 0.14)); ctx.stroke();
    }
  }
  if (d.idx >= 3) radialGlow(ctx, b.gx, b.gy - H * 0.6, W * 1.5, '#a87fd0', 0.24);
};

PAINTERS.bramble = (ctx, b, d, rnd) => {
  const R = T * 0.26;
  groundShadow(ctx, b.gx, b.gy, R * 1.2, R * 0.34);
  ctx.strokeStyle = d.tint; ctx.lineCap = 'round';
  for (let i = 0; i < 9; i++) {
    ctx.lineWidth = 1.4 + rnd() * 1.6;
    const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
    ctx.beginPath();
    ctx.moveTo(b.gx + (rnd() - 0.5) * R * 0.5, b.gy);
    const mx = b.gx + Math.cos(a) * R * 0.7, my = b.gy + Math.sin(a) * R * 0.7;
    ctx.quadraticCurveTo(mx, my, b.gx + Math.cos(a) * R * 1.2, b.gy + Math.sin(a) * R * 1.1);
    ctx.stroke();
  }
  // thorns
  ctx.fillStyle = shade(d.tint, -0.3);
  for (let i = 0; i < 7; i++) {
    const a = rnd() * 6.28, rr = R * (0.4 + rnd() * 0.7);
    const tx = b.gx + Math.cos(a) * rr, ty = b.gy - R * 0.5 + Math.sin(a) * rr * 0.6;
    ctx.beginPath(); ctx.moveTo(tx, ty);
    ctx.lineTo(tx + 3, ty - 4); ctx.lineTo(tx + 1, ty + 1); ctx.closePath(); ctx.fill();
  }
};

// --- dragon homes -----------------------------------------------------------
PAINTERS.home = (ctx, b, d, rnd) => {
  const g = growth(d);
  const W = Math.min(b.tw * 0.72, T * (0.44 + g * 0.28)), H = W * 0.92;
  groundShadow(ctx, b.gx, b.gy, W * 0.72, W * 0.22);
  const x = b.gx - W / 2, y = b.gy - H;
  // walls
  roundRect(ctx, x + W * 0.08, y + H * 0.42, W * 0.84, H * 0.58, W * 0.06);
  litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.34), y + H * 0.4, b.gy);
  ctx.strokeStyle = shade(d.tint, -0.5); ctx.lineWidth = 1.2; ctx.stroke();
  // roof
  ctx.beginPath();
  ctx.moveTo(x, y + H * 0.48);
  ctx.quadraticCurveTo(b.gx, y - H * 0.06, x + W, y + H * 0.48);
  ctx.closePath();
  litFill(ctx, '#b0543f', '#6f2f28', y, y + H * 0.5);
  ctx.strokeStyle = '#5f2620'; ctx.lineWidth = 1.2; ctx.stroke();
  // door
  ctx.beginPath();
  ctx.moveTo(b.gx - W * 0.15, b.gy);
  ctx.lineTo(b.gx - W * 0.15, y + H * 0.68);
  ctx.quadraticCurveTo(b.gx, y + H * 0.54, b.gx + W * 0.15, y + H * 0.68);
  ctx.lineTo(b.gx + W * 0.15, b.gy);
  ctx.closePath();
  ctx.fillStyle = '#3f2b22'; ctx.fill();
  radialGlow(ctx, b.gx, b.gy - H * 0.18, W * 0.3, '#ffcf7f', 0.55);
  // window
  ctx.beginPath(); ctx.arc(x + W * 0.24, y + H * 0.66, W * 0.07, 0, 6.3);
  ctx.fillStyle = '#ffd98f'; ctx.fill();
  ctx.strokeStyle = '#6f4a2f'; ctx.lineWidth = 1; ctx.stroke();
  if (d.idx >= 4) {
    // chimney smoke
    ctx.fillStyle = rgba('#ffffff', 0.35);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath(); ctx.arc(b.gx + W * 0.3 + i * 2, y - H * (0.08 + i * 0.12), W * (0.05 + i * 0.02), 0, 6.3); ctx.fill();
    }
  }
};

// --- hills / fountain -------------------------------------------------------
PAINTERS.hill = (ctx, b, d, rnd) => {
  const g = growth(d);
  const rx = b.tw * (0.3 + g * 0.2), ry = rx * (0.42 + g * 0.2);
  const cy = b.gy;
  if (d.idx === 0) { // topsoil
    groundShadow(ctx, b.gx, b.gy, rx * 0.6, rx * 0.2);
    blob(ctx, b.gx, b.gy - ry * 0.24, rx * 0.42, ry * 0.28, 7, 0.2, rnd);
    litFill(ctx, shade(d.tint, 0.24), shade(d.tint, -0.34), b.gy - ry * 0.5, b.gy);
    speckle(ctx, b.gx - rx * 0.4, b.gy - ry * 0.5, rx * 0.8, ry * 0.5, rgba('#000', 0.14), 8, rnd);
    return;
  }
  groundShadow(ctx, b.gx, b.gy, rx * 1.02, rx * 0.24);
  ctx.beginPath();
  ctx.moveTo(b.gx - rx, cy);
  ctx.bezierCurveTo(b.gx - rx * 0.6, cy - ry * 1.5, b.gx + rx * 0.55, cy - ry * 1.5, b.gx + rx, cy);
  ctx.closePath();
  litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.34), cy - ry * 1.4, cy);
  ctx.save(); ctx.clip();
  // grass fuzz on the crown
  ctx.strokeStyle = rgba(shade(d.tint, 0.36), 0.8); ctx.lineWidth = 1.4;
  for (let i = 0; i < 16; i++) {
    const px = b.gx - rx * 0.8 + rnd() * rx * 1.6;
    const py = cy - ry * (0.5 + rnd() * 0.8);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (rnd() - 0.5) * 5, py - 5 - rnd() * 4); ctx.stroke();
  }
  speckle(ctx, b.gx - rx, cy - ry * 1.4, rx * 2, ry * 1.4, rgba('#ffffff', 0.12), 12, rnd);
  ctx.restore();
  rim(ctx, '#ffffff', 1.3, 0.34);
  if (d.idx >= 5) { // rocky cap
    blob(ctx, b.gx + rx * 0.1, cy - ry * 1.15, rx * 0.26, ry * 0.3, 6, 0.2, rnd);
    litFill(ctx, '#b8b0a0', '#6f6a60', cy - ry * 1.5, cy - ry * 0.9);
  }
};

PAINTERS.fountain = (ctx, b, d, rnd) => {
  const R = b.tw * 0.32;
  groundShadow(ctx, b.gx, b.gy, R * 1.2, R * 0.34);
  // basin
  ctx.beginPath(); ctx.ellipse(b.gx, b.gy - R * 0.2, R, R * 0.42, 0, 0, 6.3);
  litFill(ctx, '#dfe8f0', '#8f9aa8', b.gy - R * 0.7, b.gy);
  ctx.strokeStyle = '#7f8a98'; ctx.lineWidth = 1.4; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(b.gx, b.gy - R * 0.26, R * 0.78, R * 0.3, 0, 0, 6.3);
  ctx.fillStyle = rgba('#7fd8ff', 0.85); ctx.fill();
  // column + water arcs
  roundRect(ctx, b.gx - R * 0.1, b.gy - R * 1.1, R * 0.2, R * 0.9, R * 0.06);
  ctx.fillStyle = '#cfd8e0'; ctx.fill();
  ctx.strokeStyle = rgba('#a8e8ff', 0.85); ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(b.gx, b.gy - R * 1.15);
    ctx.quadraticCurveTo(b.gx + s * R * 0.7, b.gy - R * 1.1, b.gx + s * R * 0.6, b.gy - R * 0.4);
    ctx.stroke();
  }
  radialGlow(ctx, b.gx, b.gy - R * 0.8, R * 1.8, '#c0f0ff', 0.42);
  for (let i = 0; i < 12; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2, b.gy - rnd() * R * 1.4, R * 0.08, '#ffffff', 0.85);
};

// --- Gaia statues -----------------------------------------------------------
PAINTERS.gaia = (ctx, b, d, rnd) => {
  const g = growth(d);
  const H = b.th * (0.56 + g * 0.32), W = b.tw * (0.19 + g * 0.1);
  const broken = d.idx === 0;
  groundShadow(ctx, b.gx, b.gy, W * 2.1, W * 0.66);
  // the broken statue must stand out against grey dead land
  if (broken) radialGlow(ctx, b.gx, b.gy - H * 0.4, W * 3.4, '#ffe9c0', 0.2);
  // plinth
  roundRect(ctx, b.gx - W * 1.5, b.gy - H * 0.16, W * 3, H * 0.16, W * 0.1);
  litFill(ctx, shade(d.tint, 0.24), shade(d.tint, -0.34), b.gy - H * 0.2, b.gy);
  if (!broken) radialGlow(ctx, b.gx, b.gy - H * 0.6, W * 4, '#fff0b0', 0.16 + d.idx * 0.08);

  ctx.save();
  if (broken) { ctx.translate(b.gx, b.gy - H * 0.16); ctx.rotate(0.16); ctx.translate(-b.gx, -(b.gy - H * 0.16)); }
  const top = broken ? b.gy - H * 0.74 : b.gy - H;
  // robed body
  ctx.beginPath();
  ctx.moveTo(b.gx - W * 1.05, b.gy - H * 0.16);
  ctx.quadraticCurveTo(b.gx - W * 0.6, top + H * 0.24, b.gx - W * 0.5, top + H * 0.1);
  ctx.lineTo(b.gx + W * 0.5, top + H * 0.1);
  ctx.quadraticCurveTo(b.gx + W * 0.6, top + H * 0.24, b.gx + W * 1.05, b.gy - H * 0.16);
  ctx.closePath();
  litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.3), top, b.gy);
  ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.5); ctx.lineWidth = 1.2; ctx.stroke();
  // robe folds
  ctx.strokeStyle = rgba(shade(d.tint, -0.42), 0.35); ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath(); ctx.moveTo(b.gx + i * W * 0.45, top + H * 0.16);
    ctx.lineTo(b.gx + i * W * 0.7, b.gy - H * 0.18); ctx.stroke();
  }
  if (!broken) {
    // head
    ctx.beginPath(); ctx.arc(b.gx, top - H * 0.02, W * 0.34, 0, 6.3);
    litFill(ctx, shade(d.tint, 0.42), shade(d.tint, -0.16), top - W * 0.4, top + W * 0.3);
    // raised arms holding an orb
    ctx.strokeStyle = shade(d.tint, 0.16); ctx.lineWidth = W * 0.22; ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(b.gx + s * W * 0.4, top + H * 0.2);
      ctx.quadraticCurveTo(b.gx + s * W * 0.9, top + H * 0.04, b.gx + s * W * 0.34, top - H * 0.16);
      ctx.stroke();
    }
    const oy = top - H * 0.22;
    radialGlow(ctx, b.gx, oy, W * 1.5, '#c9ffe0', 0.7);
    ctx.fillStyle = '#f0fff8';
    ctx.beginPath(); ctx.arc(b.gx, oy, W * 0.24, 0, 6.3); ctx.fill();
    if (d.idx >= 2) {
      // wings
      ctx.fillStyle = rgba('#fff8e0', 0.85);
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(b.gx + s * W * 0.4, top + H * 0.12);
        ctx.quadraticCurveTo(b.gx + s * W * 2.1, top - H * 0.24, b.gx + s * W * 1.1, top + H * 0.34);
        ctx.quadraticCurveTo(b.gx + s * W * 0.9, top + H * 0.16, b.gx + s * W * 0.4, top + H * 0.12);
        ctx.closePath(); ctx.fill();
      }
    }
  } else {
    // cracks
    ctx.strokeStyle = rgba('#2f2a28', 0.5); ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 0.6, top + H * 0.12);
    ctx.lineTo(b.gx - W * 0.1, top + H * 0.3);
    ctx.lineTo(b.gx + W * 0.5, top + H * 0.18); ctx.stroke();
  }
  ctx.restore();
  if (broken) {
    // rubble
    ctx.fillStyle = shade(d.tint, -0.2);
    for (let i = 0; i < 4; i++) {
      const px = b.gx + (rnd() - 0.5) * W * 3, py = b.gy - rnd() * H * 0.1;
      ctx.beginPath(); ctx.ellipse(px, py, W * 0.16, W * 0.1, rnd(), 0, 6.3); ctx.fill();
    }
  }
};

// --- demon gates ------------------------------------------------------------
PAINTERS.gate = (ctx, b, d, rnd) => {
  const g = growth(d);
  const H = b.th * (0.5 + g * 0.3), W = b.tw * (0.28 + g * 0.14);
  groundShadow(ctx, b.gx, b.gy, W * 1.3, W * 0.4);
  radialGlow(ctx, b.gx, b.gy - H * 0.5, W * 2.2, '#e0307f', 0.3);
  // arch
  ctx.beginPath();
  ctx.moveTo(b.gx - W, b.gy);
  ctx.lineTo(b.gx - W, b.gy - H * 0.55);
  ctx.quadraticCurveTo(b.gx, b.gy - H * 1.24, b.gx + W, b.gy - H * 0.55);
  ctx.lineTo(b.gx + W, b.gy);
  ctx.closePath();
  litFill(ctx, shade(d.tint, 0.2), shade(d.tint, -0.44), b.gy - H, b.gy);
  ctx.strokeStyle = '#2b1424'; ctx.lineWidth = 1.8; ctx.stroke();
  // portal mouth
  ctx.beginPath();
  ctx.moveTo(b.gx - W * 0.6, b.gy);
  ctx.lineTo(b.gx - W * 0.6, b.gy - H * 0.52);
  ctx.quadraticCurveTo(b.gx, b.gy - H * 1.0, b.gx + W * 0.6, b.gy - H * 0.52);
  ctx.lineTo(b.gx + W * 0.6, b.gy);
  ctx.closePath();
  const gr = ctx.createRadialGradient(b.gx, b.gy - H * 0.45, W * 0.05, b.gx, b.gy - H * 0.45, W * 0.9);
  gr.addColorStop(0, '#ff7fc0'); gr.addColorStop(0.5, '#8f1f5f'); gr.addColorStop(1, '#1f0a18');
  ctx.fillStyle = gr; ctx.fill();
  // spikes
  ctx.fillStyle = '#3f1f34';
  for (let i = 0; i < 5; i++) {
    const a = Math.PI + (i / 4) * Math.PI;
    const sx = b.gx + Math.cos(a) * W * 1.02, sy = b.gy - H * 0.6 + Math.sin(a) * H * 0.5;
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.lineTo(sx + Math.cos(a) * W * 0.34, sy + Math.sin(a) * W * 0.34);
    ctx.lineTo(sx + W * 0.1, sy + W * 0.12); ctx.closePath(); ctx.fill();
  }
  for (let i = 0; i < 6; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * W, b.gy - H * (0.2 + rnd() * 0.7), W * 0.1, '#ff9fd0', 0.8);
};

// --- zomblins ---------------------------------------------------------------
PAINTERS.zomblin = (ctx, b, d, rnd) => {
  const g = growth(d);
  const S = T * (0.24 + g * 0.14);
  const cy = b.gy - S * 0.9;
  groundShadow(ctx, b.gx, b.gy, S * 0.9, S * 0.28);
  // hunched body
  ctx.beginPath(); ctx.ellipse(b.gx, cy + S * 0.3, S * 0.6, S * 0.52, 0, 0, 6.3);
  litFill(ctx, shade(d.tint, 0.2), shade(d.tint, -0.42), cy - S * 0.2, cy + S * 0.9);
  // arms
  ctx.strokeStyle = shade(d.tint, -0.2); ctx.lineWidth = S * 0.15; ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(b.gx + s * S * 0.4, cy + S * 0.2);
    ctx.quadraticCurveTo(b.gx + s * S * 0.9, cy + S * 0.4, b.gx + s * S * 0.7, cy + S * 0.8);
    ctx.stroke();
  }
  // head
  ctx.beginPath(); ctx.ellipse(b.gx, cy - S * 0.34, S * 0.44, S * 0.4, 0, 0, 6.3);
  litFill(ctx, shade(d.tint, 0.32), shade(d.tint, -0.24), cy - S * 0.8, cy);
  // glowing eyes
  for (const s of [-1, 1]) {
    radialGlow(ctx, b.gx + s * S * 0.16, cy - S * 0.36, S * 0.24, '#ff4f3f', 0.9);
    ctx.fillStyle = '#ffe07f';
    ctx.beginPath(); ctx.ellipse(b.gx + s * S * 0.16, cy - S * 0.36, S * 0.075, S * 0.055, 0, 0, 6.3); ctx.fill();
  }
  // jagged mouth
  ctx.strokeStyle = '#2f1a1a'; ctx.lineWidth = 1.4;
  ctx.beginPath();
  for (let i = 0; i <= 4; i++) {
    const x = b.gx - S * 0.2 + (i / 4) * S * 0.4;
    const y = cy - S * 0.15 + (i % 2 ? -S * 0.05 : S * 0.03);
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.stroke();
  // horns / ears
  ctx.fillStyle = shade(d.tint, -0.3);
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(b.gx + s * S * 0.36, cy - S * 0.5);
    ctx.lineTo(b.gx + s * S * 0.62, cy - S * 0.78);
    ctx.lineTo(b.gx + s * S * 0.3, cy - S * 0.62); ctx.closePath(); ctx.fill();
  }
  radialGlow(ctx, b.gx, cy, S * 1.8, '#7f4faf', 0.2);
};

// --- heal extenders / loot orbs ---------------------------------------------
PAINTERS.healext = (ctx, b, d, rnd) => {
  const R = T * 0.24;
  groundShadow(ctx, b.gx, b.gy, R * 1.1, R * 0.34);
  radialGlow(ctx, b.gx, b.gy - R * 0.9, R * 3, '#7fffc0', 0.5);
  // 4-way rune plate
  ctx.save(); ctx.translate(b.gx, b.gy - R * 0.8);
  for (let i = 0; i < 4; i++) {
    ctx.save(); ctx.rotate((i / 4) * Math.PI * 2);
    ctx.beginPath();
    ctx.moveTo(0, -R * 0.3); ctx.lineTo(R * 0.24, -R * 1.02); ctx.lineTo(-R * 0.24, -R * 1.02);
    ctx.closePath();
    litFill(ctx, '#e0fff0', '#4fc79a', -R, 0);
    ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
  ctx.beginPath(); ctx.arc(0, 0, R * 0.36, 0, 6.3);
  const gr = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.36);
  gr.addColorStop(0, '#ffffff'); gr.addColorStop(1, '#4fd8a8');
  ctx.fillStyle = gr; ctx.fill();
  ctx.restore();
  for (let i = 0; i < 6; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2.4, b.gy - R * (0.2 + rnd() * 1.4), R * 0.12, '#ffffff', 0.85);
};

PAINTERS.loot = (ctx, b, d, rnd) => {
  const R = T * 0.26;
  const cy = b.gy - R * 1.2;
  groundShadow(ctx, b.gx, b.gy, R * 0.7, R * 0.2, 0.18);
  radialGlow(ctx, b.gx, cy, R * 2.4, '#bfe8ff', 0.45);
  // bubble
  ctx.beginPath(); ctx.arc(b.gx, cy, R, 0, 6.3);
  const gr = ctx.createRadialGradient(b.gx - R * 0.3, cy - R * 0.35, R * 0.05, b.gx, cy, R);
  gr.addColorStop(0, rgba('#ffffff', 0.85));
  gr.addColorStop(0.55, rgba('#cfeaff', 0.35));
  gr.addColorStop(1, rgba('#7fbfe8', 0.5));
  ctx.fillStyle = gr; ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.9); ctx.lineWidth = 1.8; ctx.stroke();
  // little gift inside
  roundRect(ctx, b.gx - R * 0.3, cy - R * 0.22, R * 0.6, R * 0.46, R * 0.08);
  ctx.fillStyle = '#e0a84f'; ctx.fill();
  ctx.fillStyle = '#c04f6f';
  ctx.fillRect(b.gx - R * 0.06, cy - R * 0.22, R * 0.12, R * 0.46);
  sparkle(ctx, b.gx - R * 0.34, cy - R * 0.42, R * 0.4, '#ffffff', 0.95);
};

// --- bones / skulls ---------------------------------------------------------
PAINTERS.bone = (ctx, b, d, rnd) => {
  const S = T * 0.2;
  groundShadow(ctx, b.gx, b.gy, S * 1.4, S * 0.4);
  if (d.idx === 0) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI + 0.3;
      ctx.save();
      ctx.translate(b.gx + (i - 1) * S * 0.42, b.gy - S * 0.24 - i * S * 0.14);
      ctx.rotate(a);
      ctx.strokeStyle = '#f0e8d4'; ctx.lineWidth = S * 0.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-S * 0.4, 0); ctx.lineTo(S * 0.4, 0); ctx.stroke();
      ctx.fillStyle = '#f7f0dd';
      for (const s of [-1, 1]) for (const o of [-1, 1]) {
        ctx.beginPath(); ctx.arc(s * S * 0.44, o * S * 0.1, S * 0.11, 0, 6.3); ctx.fill();
      }
      ctx.restore();
    }
  } else {
    // skeleton
    ctx.strokeStyle = '#f0e8d4'; ctx.lineWidth = S * 0.15; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.gx, b.gy - S * 0.1); ctx.lineTo(b.gx, b.gy - S * 1.1); ctx.stroke();
    for (let i = 0; i < 4; i++) {
      const y = b.gy - S * (0.3 + i * 0.2);
      ctx.beginPath(); ctx.moveTo(b.gx - S * 0.4, y); ctx.lineTo(b.gx + S * 0.4, y); ctx.stroke();
    }
    ctx.beginPath(); ctx.ellipse(b.gx, b.gy - S * 1.3, S * 0.3, S * 0.26, 0, 0, 6.3);
    litFill(ctx, '#fffaf0', '#c8bda6', b.gy - S * 1.6, b.gy - S);
    ctx.fillStyle = '#3f3634';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(b.gx + s * S * 0.11, b.gy - S * 1.32, S * 0.055, 0, 6.3); ctx.fill(); }
  }
};

PAINTERS.skull = (ctx, b, d, rnd) => {
  const g = growth(d), S = T * (0.16 + g * 0.1);
  groundShadow(ctx, b.gx, b.gy, S * 1.3, S * 0.4);
  const n = Math.min(3, d.idx + 1);
  for (let k = 0; k < n; k++) {
    const ox = (k - (n - 1) / 2) * S * 0.9;
    const cx = b.gx + ox, cy = b.gy - S * 0.6 - (k % 2) * S * 0.14;
    ctx.beginPath(); ctx.ellipse(cx, cy, S * 0.5, S * 0.44, 0, 0, 6.3);
    litFill(ctx, '#fffaf0', '#c0b49c', cy - S * 0.5, cy + S * 0.5);
    ctx.strokeStyle = rgba('#8f8474', 0.7); ctx.lineWidth = 1; ctx.stroke();
    // jaw
    ctx.beginPath(); ctx.ellipse(cx, cy + S * 0.36, S * 0.3, S * 0.16, 0, 0, Math.PI);
    ctx.fillStyle = '#e8dcc4'; ctx.fill();
    ctx.fillStyle = '#3a3230';
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(cx + s * S * 0.17, cy - S * 0.06, S * 0.11, S * 0.13, 0, 0, 6.3); ctx.fill();
    }
    ctx.beginPath(); ctx.moveTo(cx, cy + S * 0.06);
    ctx.lineTo(cx - S * 0.06, cy + S * 0.2); ctx.lineTo(cx + S * 0.06, cy + S * 0.2);
    ctx.closePath(); ctx.fill();
  }
  if (d.idx >= 1) {
    ctx.strokeStyle = '#f0e8d4'; ctx.lineWidth = S * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(b.gx - S * 0.7, b.gy - S * 0.08); ctx.lineTo(b.gx + S * 0.7, b.gy - S * 0.14); ctx.stroke();
  }
};

// ---------------------------------------------------------------------------
// eggs, nests, dragons
// ---------------------------------------------------------------------------
PAINTERS.egg = (ctx, b, d, rnd) => {
  const R = T * 0.25;
  const cy = b.gy - R * 1.05;
  groundShadow(ctx, b.gx, b.gy, R * 1.05, R * 0.32);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(b.gx, cy - R * 1.28);
  ctx.bezierCurveTo(b.gx + R * 1.02, cy - R * 0.62, b.gx + R * 1.0, cy + R * 1.05, b.gx, cy + R * 1.05);
  ctx.bezierCurveTo(b.gx - R * 1.0, cy + R * 1.05, b.gx - R * 1.02, cy - R * 0.62, b.gx, cy - R * 1.28);
  ctx.closePath();
  const gr = ctx.createRadialGradient(b.gx - R * 0.34, cy - R * 0.5, R * 0.1, b.gx, cy, R * 1.5);
  gr.addColorStop(0, shade(d.tint, 0.62));
  gr.addColorStop(0.55, d.tint);
  gr.addColorStop(1, shade(d.tint, -0.34));
  ctx.fillStyle = gr; ctx.fill();
  ctx.save(); ctx.clip();
  // spots
  ctx.fillStyle = rgba(shade(d.tint, -0.42), 0.5);
  for (let i = 0; i < 6; i++) {
    const px = b.gx + (rnd() - 0.5) * R * 1.7, py = cy + (rnd() - 0.5) * R * 2;
    ctx.beginPath(); ctx.ellipse(px, py, R * (0.1 + rnd() * 0.14), R * (0.08 + rnd() * 0.1), rnd() * 3, 0, 6.3); ctx.fill();
  }
  ctx.restore();
  ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 1.2; ctx.stroke();
  ctx.restore();
  sparkle(ctx, b.gx - R * 0.36, cy - R * 0.6, R * 0.42, '#ffffff', 0.85);
  radialGlow(ctx, b.gx, cy, R * 2.2, d.tint, 0.2);
};

PAINTERS.nest = (ctx, b, d, rnd) => {
  const R = T * 0.36;
  groundShadow(ctx, b.gx, b.gy, R * 1.25, R * 0.36);
  // twig bowl
  ctx.save();
  ctx.beginPath(); ctx.ellipse(b.gx, b.gy - R * 0.3, R, R * 0.5, 0, 0, Math.PI * 2);
  litFill(ctx, '#a87f4f', '#5f4326', b.gy - R * 0.8, b.gy);
  ctx.restore();
  // eggs peeking
  const eggs = [[-R * 0.42, -R * 0.5, 0.78], [R * 0.4, -R * 0.46, 0.8], [0, -R * 0.72, 0.92]];
  for (const [ox, oy, sc] of eggs) {
    const ex = b.gx + ox, ey = b.gy + oy;
    ctx.beginPath(); ctx.ellipse(ex, ey, R * 0.28 * sc, R * 0.36 * sc, 0, 0, 6.3);
    const gr = ctx.createRadialGradient(ex - R * 0.1, ey - R * 0.12, R * 0.03, ex, ey, R * 0.4);
    gr.addColorStop(0, shade(d.tint, 0.6)); gr.addColorStop(1, shade(d.tint, -0.2));
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.45); ctx.lineWidth = 1; ctx.stroke();
  }
  // twigs over the front
  ctx.strokeStyle = '#8f6a3f'; ctx.lineWidth = 2.4; ctx.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = Math.PI * (0.06 + (i / 8) * 0.88);
    ctx.beginPath();
    ctx.moveTo(b.gx + Math.cos(a) * R * 1.02, b.gy - R * 0.3 + Math.sin(a) * R * 0.5);
    ctx.lineTo(b.gx + Math.cos(a + 0.5) * R * 0.8, b.gy - R * 0.3 + Math.sin(a + 0.5) * R * 0.42);
    ctx.stroke();
  }
  radialGlow(ctx, b.gx, b.gy - R * 0.6, R * 2, d.tint, 0.24);
  for (let i = 0; i < 5; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2, b.gy - R * (0.4 + rnd()), R * 0.12, '#fffbd0', 0.8);
};

// Dragon: stylized side-on silhouette. `variant` is "<facing><flapFrame>",
// e.g. "r1" = facing right, wing frame 1.
PAINTERS.dragon = (ctx, b, d, rnd, variant) => {
  const face = variant && variant[0] === 'l' ? -1 : 1;
  const flap = variant ? (parseInt(variant.slice(1), 10) || 0) : 0;
  const st = d.dragon ? d.dragon.stage : 0;
  const br = d.breedRef || {};
  const evo = st >= 4;
  const body = evo ? (br.evoBody || d.tint) : (br.body || d.tint);
  const belly = evo ? (br.evoBelly || shade(body, 0.5)) : (br.belly || shade(body, 0.5));
  const wingC = evo ? (br.evoWing || shade(body, 0.25)) : (br.wing || shade(body, 0.25));
  // size grows with stage within its tier
  const tierStage = st % 4;
  const S = T * (0.44 + tierStage * 0.065 + (evo ? 0.06 : 0));
  const cy = b.gy - S * 0.86;

  ctx.save();
  ctx.translate(b.gx, 0);
  ctx.scale(face, 1);
  ctx.translate(-b.gx, 0);

  groundShadow(ctx, b.gx, b.gy, S * 0.9, S * 0.26, 0.3);
  if (evo) radialGlow(ctx, b.gx, cy, S * 2.4, body, 0.2);

  // tail
  ctx.strokeStyle = shade(body, -0.16);
  ctx.lineWidth = S * 0.2; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(b.gx - S * 0.34, cy + S * 0.2);
  ctx.quadraticCurveTo(b.gx - S * 1.05, cy + S * 0.3, b.gx - S * 0.95, cy - S * 0.34);
  ctx.stroke();
  // tail fin
  ctx.beginPath();
  ctx.moveTo(b.gx - S * 0.95, cy - S * 0.3);
  ctx.lineTo(b.gx - S * 1.3, cy - S * 0.66);
  ctx.lineTo(b.gx - S * 0.78, cy - S * 0.6);
  ctx.closePath();
  ctx.fillStyle = wingC; ctx.fill();

  // far wing
  const flapA = [-0.5, -0.05, 0.42][flap % 3];
  drawWing(ctx, b.gx - S * 0.1, cy - S * 0.28, S * 0.95, flapA - 0.24, shade(wingC, -0.2), body);

  // hind leg
  ctx.fillStyle = shade(body, -0.22);
  roundRect(ctx, b.gx - S * 0.42, cy + S * 0.22, S * 0.3, S * 0.5, S * 0.12); ctx.fill();

  // body
  ctx.beginPath();
  ctx.ellipse(b.gx, cy + S * 0.06, S * 0.56, S * 0.48, -0.1, 0, Math.PI * 2);
  const bg = ctx.createLinearGradient(0, cy - S * 0.5, 0, cy + S * 0.55);
  bg.addColorStop(0, shade(body, 0.3));
  bg.addColorStop(0.6, body);
  bg.addColorStop(1, shade(body, -0.3));
  ctx.fillStyle = bg; ctx.fill();
  // belly
  ctx.beginPath();
  ctx.ellipse(b.gx + S * 0.1, cy + S * 0.22, S * 0.36, S * 0.26, -0.1, 0, Math.PI * 2);
  ctx.fillStyle = rgba(belly, 0.92); ctx.fill();

  // front leg
  ctx.fillStyle = shade(body, -0.1);
  roundRect(ctx, b.gx + S * 0.18, cy + S * 0.28, S * 0.26, S * 0.46, S * 0.11); ctx.fill();
  ctx.fillStyle = shade(belly, -0.1);
  roundRect(ctx, b.gx + S * 0.16, cy + S * 0.62, S * 0.34, S * 0.14, S * 0.06); ctx.fill();

  // neck + head
  const hx = b.gx + S * 0.6, hy = cy - S * 0.5;
  ctx.beginPath();
  ctx.moveTo(b.gx + S * 0.2, cy - S * 0.2);
  ctx.quadraticCurveTo(b.gx + S * 0.52, cy - S * 0.34, hx - S * 0.06, hy + S * 0.16);
  ctx.lineTo(hx + S * 0.12, hy + S * 0.3);
  ctx.quadraticCurveTo(b.gx + S * 0.5, cy - S * 0.02, b.gx + S * 0.28, cy + S * 0.06);
  ctx.closePath();
  ctx.fillStyle = body; ctx.fill();

  ctx.beginPath();
  ctx.ellipse(hx, hy, S * 0.32, S * 0.27, -0.08, 0, Math.PI * 2);
  const hg = ctx.createRadialGradient(hx - S * 0.1, hy - S * 0.12, S * 0.03, hx, hy, S * 0.4);
  hg.addColorStop(0, shade(body, 0.42)); hg.addColorStop(1, shade(body, -0.14));
  ctx.fillStyle = hg; ctx.fill();
  // snout
  ctx.beginPath();
  ctx.ellipse(hx + S * 0.22, hy + S * 0.06, S * 0.16, S * 0.12, 0, 0, Math.PI * 2);
  ctx.fillStyle = shade(body, 0.16); ctx.fill();
  // nostril
  ctx.fillStyle = rgba('#000000', 0.4);
  ctx.beginPath(); ctx.arc(hx + S * 0.32, hy + S * 0.03, S * 0.022, 0, 6.3); ctx.fill();
  // eye
  ctx.fillStyle = '#ffffff';
  ctx.beginPath(); ctx.ellipse(hx + S * 0.06, hy - S * 0.04, S * 0.085, S * 0.095, 0, 0, 6.3); ctx.fill();
  ctx.fillStyle = '#1d1620';
  ctx.beginPath(); ctx.arc(hx + S * 0.09, hy - S * 0.03, S * 0.045, 0, 6.3); ctx.fill();
  ctx.fillStyle = rgba('#ffffff', 0.9);
  ctx.beginPath(); ctx.arc(hx + S * 0.07, hy - S * 0.06, S * 0.018, 0, 6.3); ctx.fill();
  // horns
  ctx.strokeStyle = shade(wingC, -0.3); ctx.lineWidth = S * 0.075; ctx.lineCap = 'round';
  for (let i = 0; i < (st >= 2 ? 2 : 1); i++) {
    ctx.beginPath();
    ctx.moveTo(hx - S * (0.08 + i * 0.12), hy - S * 0.2);
    ctx.quadraticCurveTo(hx - S * (0.2 + i * 0.14), hy - S * 0.46, hx - S * (0.04 + i * 0.1), hy - S * 0.52);
    ctx.stroke();
  }
  // dorsal spines
  ctx.fillStyle = wingC;
  for (let i = 0; i < 3 + st % 4; i++) {
    const t = i / (3 + (st % 4));
    const sx = b.gx + S * (0.2 - t * 0.85), sy = cy - S * (0.42 - t * 0.14);
    ctx.beginPath(); ctx.moveTo(sx, sy);
    ctx.lineTo(sx + S * 0.06, sy - S * (0.2 - t * 0.1));
    ctx.lineTo(sx + S * 0.14, sy); ctx.closePath(); ctx.fill();
  }

  // near wing
  drawWing(ctx, b.gx + S * 0.02, cy - S * 0.3, S * 1.08, flapA, wingC, body);

  // crown for level-4/royal dragons
  if (st === 3 || st === 7) {
    ctx.fillStyle = '#ffd24f';
    ctx.beginPath();
    ctx.moveTo(hx - S * 0.16, hy - S * 0.24);
    ctx.lineTo(hx - S * 0.1, hy - S * 0.44);
    ctx.lineTo(hx, hy - S * 0.28);
    ctx.lineTo(hx + S * 0.1, hy - S * 0.46);
    ctx.lineTo(hx + S * 0.16, hy - S * 0.24);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a8762f'; ctx.lineWidth = 0.9; ctx.stroke();
  }
  ctx.restore();
  if (evo) for (let i = 0; i < 5; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 2.4, cy + (rnd() - 0.5) * S * 2, S * 0.12, '#ffffff', 0.7);
};

function drawWing(ctx, x, y, L, a, col, bodyCol) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-L * 0.42, -L * 0.62, -L * 0.9, -L * 0.36);
  ctx.quadraticCurveTo(-L * 0.62, -L * 0.2, -L * 0.66, -L * 0.02);
  ctx.quadraticCurveTo(-L * 0.4, -L * 0.14, -L * 0.34, L * 0.1);
  ctx.quadraticCurveTo(-L * 0.16, -L * 0.04, 0, 0);
  ctx.closePath();
  const g = ctx.createLinearGradient(0, -L * 0.5, -L * 0.9, L * 0.1);
  g.addColorStop(0, shade(col, 0.34));
  g.addColorStop(1, shade(col, -0.24));
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = rgba(shade(bodyCol, -0.4), 0.5); ctx.lineWidth = 1.1; ctx.stroke();
  // wing bones
  ctx.strokeStyle = rgba(shade(col, -0.34), 0.6); ctx.lineWidth = 1;
  for (const [ex, ey] of [[-L * 0.88, -L * 0.34], [-L * 0.64, -L * 0.03], [-L * 0.33, L * 0.09]]) {
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(ex, ey); ctx.stroke();
  }
  ctx.restore();
}

// The second wave of painters lives in its own file and registers into the same
// table, so both halves share this cache and this growth() normalisation.
import { register as registerWave2 } from './sprites2.js';
registerWave2(PAINTERS, growth);

export { PAINTERS };

// Attach chain length so growth() can normalise. Called once from main.
export function primeGrowth(CHAINS) {
  for (const c of Object.values(CHAINS)) {
    for (const it of c.items) it._chainLen = c.items.length;
  }
}
