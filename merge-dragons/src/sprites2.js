// sprites2.js -- the second wave of procedural painters: the families the
// second wave of merge chains needs, plus the bespoke Wonder illustrations.
//
// Two rules drive everything here, both learned from auditing the first wave in
// atlas.html:
//
//  1. A tier must change SHAPE, not just hue and scale. Every painter below
//     that covers more than three tiers switches silhouette at least once --
//     a honeycomb becomes a jar becomes a hive; a temple gains storeys and
//     then a courtyard; a statue changes animal. Reading `d.idx` for a colour
//     ramp alone is what made the first wave's tiers 8+ interchangeable.
//  2. A Wonder is drawn once, by hand, for its own subject. None of them
//     shares a painter with its chain.
//
// register(PAINTERS) is called from sprites.js so both files draw into the same
// painter table and share the sprite cache.

import {
  shade, mix, rgba, hueShift, roundRect, blob, petal, leafPath, starPath,
  radialGlow, groundShadow, litFill, rim, speckle, sparkle,
} from './artlib.js';

const T = 84;

// ---------------------------------------------------------------------------
// shared sub-drawings
// ---------------------------------------------------------------------------

// A stepped stone plinth. Statues, idols and temples all stand on one, which
// is what makes them read as built rather than grown.
function plinth(ctx, cx, gy, w, h, col) {
  const steps = 2;
  for (let i = steps; i >= 1; i--) {
    const ww = w * (0.72 + 0.14 * i), hh = h / steps;
    const y = gy - (steps - i) * hh;
    ctx.beginPath();
    ctx.moveTo(cx - ww / 2, y);
    ctx.lineTo(cx + ww / 2, y);
    ctx.lineTo(cx + ww / 2 * 0.9, y - hh);
    ctx.lineTo(cx - ww / 2 * 0.9, y - hh);
    ctx.closePath();
    litFill(ctx, shade(col, 0.2 - i * 0.04), shade(col, -0.34), y - hh, y);
    ctx.strokeStyle = rgba(shade(col, -0.5), 0.45);
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }
}

// One flared pagoda roof, drawn as a curved sweep rather than a triangle so it
// reads as tiled timber.
function pagodaRoof(ctx, cx, y, w, h, col) {
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, y);
  ctx.quadraticCurveTo(cx - w * 0.2, y - h * 0.25, cx, y - h);
  ctx.quadraticCurveTo(cx + w * 0.2, y - h * 0.25, cx + w / 2, y);
  ctx.quadraticCurveTo(cx + w * 0.3, y + h * 0.16, cx, y + h * 0.1);
  ctx.quadraticCurveTo(cx - w * 0.3, y + h * 0.16, cx - w / 2, y);
  ctx.closePath();
  litFill(ctx, shade(col, 0.3), shade(col, -0.36), y - h, y + h * 0.18);
  // ridge tiles
  ctx.save();
  ctx.clip();
  ctx.strokeStyle = rgba(shade(col, -0.5), 0.4);
  ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    const t = i / 5;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + w * t, y + h * 0.12);
    ctx.lineTo(cx + (t - 0.5) * w * 0.3, y - h * 0.9);
    ctx.stroke();
  }
  ctx.restore();
  // finial
  ctx.fillStyle = shade(col, 0.5);
  ctx.beginPath(); ctx.arc(cx, y - h * 1.02, Math.max(1.6, w * 0.035), 0, 6.3); ctx.fill();
}

// A faceted crystal: one lit face, one shadowed face, a bright edge between.
function crystalShard(ctx, cx, gy, w, h, col, tilt = 0) {
  ctx.save();
  ctx.translate(cx, gy);
  ctx.rotate(tilt);
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w * 0.5, -h * 0.62);
  ctx.lineTo(w * 0.38, 0);
  ctx.lineTo(-w * 0.38, 0);
  ctx.lineTo(-w * 0.5, -h * 0.62);
  ctx.closePath();
  litFill(ctx, shade(col, 0.55), shade(col, -0.28), -h, 0);
  // shadow face on the right
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w * 0.5, -h * 0.62);
  ctx.lineTo(w * 0.38, 0);
  ctx.lineTo(0, -h * 0.12);
  ctx.closePath();
  ctx.fillStyle = rgba(shade(col, -0.42), 0.75);
  ctx.fill();
  // bright spine
  ctx.strokeStyle = rgba('#ffffff', 0.7);
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(0, -h); ctx.lineTo(0, -h * 0.12); ctx.stroke();
  ctx.restore();
}

// A four-walled building box seen slightly from the left: a lit front face and
// a darker side face, so it has volume without a real projection.
function buildingBox(ctx, cx, gy, w, h, col, sideFrac = 0.26) {
  const sw = w * sideFrac;
  // side
  ctx.beginPath();
  ctx.moveTo(cx + w / 2 - sw, gy);
  ctx.lineTo(cx + w / 2, gy - h * 0.08);
  ctx.lineTo(cx + w / 2, gy - h * 0.92);
  ctx.lineTo(cx + w / 2 - sw, gy - h);
  ctx.closePath();
  litFill(ctx, shade(col, -0.18), shade(col, -0.45), gy - h, gy);
  // front
  ctx.beginPath();
  ctx.rect(cx - w / 2, gy - h, w - sw, h);
  litFill(ctx, shade(col, 0.24), shade(col, -0.26), gy - h, gy);
  ctx.strokeStyle = rgba(shade(col, -0.55), 0.5);
  ctx.lineWidth = 1;
  ctx.stroke();
  return { fx: cx - w / 2, fw: w - sw, top: gy - h };
}

function litWindow(ctx, x, y, w, h, glow = '#ffd97f') {
  roundRect(ctx, x, y, w, h, Math.min(w, h) * 0.22);
  litFill(ctx, glow, shade(glow, -0.35), y, y + h);
  ctx.strokeStyle = rgba('#3a2a20', 0.6);
  ctx.lineWidth = 0.9;
  ctx.stroke();
  radialGlow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 1.6, glow, 0.28);
}

// A crescent-lit sphere, used for orbs, world crystals and moons.
function sphere(ctx, cx, cy, r, col) {
  const g = ctx.createRadialGradient(cx - r * 0.35, cy - r * 0.4, r * 0.1, cx, cy, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, shade(col, 0.42));
  g.addColorStop(0.82, col);
  g.addColorStop(1, shade(col, -0.42));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.3); ctx.fill();
  ctx.strokeStyle = rgba('#ffffff', 0.35);
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, r * 0.98, Math.PI * 0.9, Math.PI * 1.75); ctx.stroke();
}

// A quadruped silhouette on a plinth -- the statue families. `kind` selects the
// animal so tiers differ in outline, not only in colour.
function animalStatue(ctx, cx, gy, S, col, kind, rnd) {
  const body = shade(col, -0.05);
  const draw = (path) => { path(); litFill(ctx, shade(body, 0.34), shade(body, -0.34), gy - S * 1.3, gy); ctx.strokeStyle = rgba(shade(col, -0.55), 0.5); ctx.lineWidth = 1; ctx.stroke(); };
  if (kind === 'bird') {
    draw(() => {
      ctx.beginPath();
      ctx.moveTo(cx - S * 0.1, gy);
      ctx.quadraticCurveTo(cx - S * 0.5, gy - S * 0.5, cx - S * 0.3, gy - S * 1.0);
      ctx.quadraticCurveTo(cx - S * 0.1, gy - S * 1.35, cx + S * 0.16, gy - S * 1.2);
      ctx.quadraticCurveTo(cx + S * 0.45, gy - S * 1.0, cx + S * 0.3, gy - S * 0.42);
      ctx.quadraticCurveTo(cx + S * 0.2, gy - S * 0.1, cx + S * 0.1, gy);
      ctx.closePath();
    });
    // beak + wing
    ctx.beginPath();
    ctx.moveTo(cx + S * 0.14, gy - S * 1.18);
    ctx.lineTo(cx + S * 0.45, gy - S * 1.06);
    ctx.lineTo(cx + S * 0.16, gy - S * 1.0);
    ctx.closePath();
    ctx.fillStyle = shade(col, 0.5); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.16, gy - S * 0.95);
    ctx.quadraticCurveTo(cx - S * 0.62, gy - S * 0.72, cx - S * 0.2, gy - S * 0.28);
    ctx.closePath();
    ctx.fillStyle = rgba(shade(col, 0.42), 0.85); ctx.fill();
  } else if (kind === 'cat') {
    draw(() => {
      ctx.beginPath();
      ctx.moveTo(cx - S * 0.62, gy);
      ctx.lineTo(cx - S * 0.5, gy - S * 0.52);
      ctx.quadraticCurveTo(cx - S * 0.2, gy - S * 0.72, cx + S * 0.3, gy - S * 0.66);
      ctx.quadraticCurveTo(cx + S * 0.6, gy - S * 0.62, cx + S * 0.56, gy - S * 0.2);
      ctx.lineTo(cx + S * 0.62, gy);
      ctx.closePath();
    });
    // head with ears
    ctx.beginPath(); ctx.arc(cx + S * 0.46, gy - S * 0.88, S * 0.26, 0, 6.3);
    litFill(ctx, shade(body, 0.4), shade(body, -0.26), gy - S * 1.14, gy - S * 0.62);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + S * (0.46 + s * 0.2), gy - S * 1.02);
      ctx.lineTo(cx + S * (0.46 + s * 0.3), gy - S * 1.3);
      ctx.lineTo(cx + S * (0.46 + s * 0.04), gy - S * 1.1);
      ctx.closePath(); ctx.fillStyle = shade(body, 0.2); ctx.fill();
    }
  } else if (kind === 'horned') {
    draw(() => {
      ctx.beginPath();
      ctx.moveTo(cx - S * 0.6, gy);
      ctx.lineTo(cx - S * 0.52, gy - S * 0.58);
      ctx.quadraticCurveTo(cx, gy - S * 0.82, cx + S * 0.5, gy - S * 0.6);
      ctx.lineTo(cx + S * 0.6, gy);
      ctx.closePath();
    });
    ctx.beginPath(); ctx.arc(cx + S * 0.5, gy - S * 0.82, S * 0.24, 0, 6.3);
    litFill(ctx, shade(body, 0.4), shade(body, -0.26), gy - S * 1.06, gy - S * 0.58);
    ctx.strokeStyle = shade(col, 0.55); ctx.lineWidth = Math.max(1.6, S * 0.07); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + S * (0.5 + s * 0.12), gy - S * 0.98);
      ctx.quadraticCurveTo(cx + S * (0.5 + s * 0.42), gy - S * 1.3, cx + S * (0.5 + s * 0.16), gy - S * 1.5);
      ctx.stroke();
    }
  } else if (kind === 'serpent') {
    ctx.strokeStyle = shade(body, 0.1);
    ctx.lineWidth = S * 0.26; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.6, gy - S * 0.1);
    ctx.bezierCurveTo(cx - S * 0.1, gy - S * 0.7, cx + S * 0.2, gy - S * 0.1, cx + S * 0.5, gy - S * 0.9);
    ctx.stroke();
    ctx.strokeStyle = rgba(shade(body, 0.45), 0.7);
    ctx.lineWidth = S * 0.09;
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.6, gy - S * 0.16);
    ctx.bezierCurveTo(cx - S * 0.1, gy - S * 0.76, cx + S * 0.2, gy - S * 0.16, cx + S * 0.5, gy - S * 0.96);
    ctx.stroke();
    ctx.beginPath(); ctx.arc(cx + S * 0.52, gy - S * 1.06, S * 0.2, 0, 6.3);
    litFill(ctx, shade(body, 0.44), shade(body, -0.2), gy - S * 1.26, gy - S * 0.86);
  } else { // 'wing' -- a winged beast, the top tier of every statue chain
    draw(() => {
      ctx.beginPath();
      ctx.moveTo(cx - S * 0.44, gy);
      ctx.lineTo(cx - S * 0.34, gy - S * 0.64);
      ctx.quadraticCurveTo(cx, gy - S * 0.92, cx + S * 0.36, gy - S * 0.68);
      ctx.lineTo(cx + S * 0.46, gy);
      ctx.closePath();
    });
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(cx + s * S * 0.2, gy - S * 0.72);
      ctx.quadraticCurveTo(cx + s * S * 1.05, gy - S * 1.5, cx + s * S * 0.42, gy - S * 0.36);
      ctx.closePath();
      ctx.fillStyle = rgba(shade(col, s > 0 ? 0.16 : 0.44), 0.88);
      ctx.fill();
      ctx.strokeStyle = rgba(shade(col, -0.5), 0.4); ctx.lineWidth = 0.9; ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, gy - S * 1.0, S * 0.22, 0, 6.3);
    litFill(ctx, shade(body, 0.46), shade(body, -0.2), gy - S * 1.24, gy - S * 0.78);
  }
  // gemstone eye glint, because every one of these is carved from a gem
  sparkle(ctx, cx + S * 0.36, gy - S * 0.96, S * 0.13, '#ffffff', 0.9);
}

// A layered foliage mass: dark under-body, mid body, lit crown, rim clumps.
// Value separation plus a broken silhouette; no gloss highlight, which is what
// made the first-wave canopies read as plastic balls.
function foliage(ctx, cx, cy, rx, ry, col, rnd, lobes = 9) {
  blob(ctx, cx + rx * 0.1, cy + ry * 0.2, rx, ry, lobes, 0.15, rnd, rnd() * 6);
  ctx.fillStyle = shade(col, -0.46); ctx.fill();
  blob(ctx, cx, cy + ry * 0.04, rx * 0.96, ry * 0.94, lobes, 0.16, rnd, rnd() * 6);
  ctx.fillStyle = shade(col, -0.12); ctx.fill();
  blob(ctx, cx - rx * 0.22, cy - ry * 0.26, rx * 0.64, ry * 0.56, lobes - 2, 0.2, rnd, rnd() * 6);
  ctx.fillStyle = col; ctx.fill();
  blob(ctx, cx - rx * 0.34, cy - ry * 0.44, rx * 0.3, ry * 0.22, 6, 0.26, rnd, rnd() * 6);
  ctx.fillStyle = shade(col, 0.3); ctx.fill();
  // clumps on the rim, alternately lit and shadowed, to break the outline
  for (let i = 0; i < lobes; i++) {
    const a = (i / lobes) * 6.283 + rnd() * 0.4;
    const lx = cx + Math.cos(a) * rx * 0.92, ly = cy + Math.sin(a) * ry * 0.9;
    blob(ctx, lx, ly, rx * 0.19, ry * 0.17, 5, 0.3, rnd, a);
    ctx.fillStyle = Math.sin(a) < -0.15 ? shade(col, 0.24) : shade(col, -0.3);
    ctx.fill();
  }
  // leaf strokes for texture
  ctx.strokeStyle = rgba(shade(col, 0.45), 0.35);
  ctx.lineWidth = Math.max(1, rx * 0.04);
  for (let i = 0; i < 12; i++) {
    const a = rnd() * 6.28, r = rx * (0.15 + rnd() * 0.6);
    const px = cx + Math.cos(a) * r, py = cy + Math.sin(a) * r * (ry / rx);
    ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (rnd() - 0.5) * rx * 0.18, py - rx * 0.1); ctx.stroke();
  }
}

// A branch armature: a recursive fork, drawn as tapering filled limbs.
function branches(ctx, x, y, a, len, w, depth, col, rnd) {
  const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
  ctx.beginPath();
  ctx.moveTo(x - Math.sin(a) * w, y + Math.cos(a) * w);
  ctx.lineTo(ex - Math.sin(a) * w * 0.55, ey + Math.cos(a) * w * 0.55);
  ctx.lineTo(ex + Math.sin(a) * w * 0.55, ey - Math.cos(a) * w * 0.55);
  ctx.lineTo(x + Math.sin(a) * w, y - Math.cos(a) * w);
  ctx.closePath();
  litFill(ctx, shade(col, 0.2), shade(col, -0.4), ey, y);
  if (depth <= 0) return [[ex, ey]];
  const spread = 0.44 + rnd() * 0.26;
  return [
    ...branches(ctx, ex, ey, a - spread, len * 0.68, w * 0.62, depth - 1, col, rnd),
    ...branches(ctx, ex, ey, a + spread * 0.9, len * 0.7, w * 0.64, depth - 1, col, rnd),
  ];
}

function lifeOrbs(ctx, pts, r, n) {
  for (let i = 0; i < Math.min(n, pts.length); i++) {
    const [x, y] = pts[i];
    radialGlow(ctx, x, y, r * 3, '#c9ffe0', 0.5);
    ctx.fillStyle = '#f2fff7';
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.3); ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.8); ctx.lineWidth = 0.9; ctx.stroke();
  }
}

function youngLifeTree(ctx, b, d, rnd) {
  const t = (d.idx - 8) / 3;
  const H = b.th * (0.62 + t * 0.16), R = b.tw * (0.26 + t * 0.07);
  groundShadow(ctx, b.gx, b.gy, R * 1.2, R * 0.36);
  // a single trunk with a lean, and two surface roots
  ctx.strokeStyle = '#6a4f38'; ctx.lineWidth = Math.max(2, R * 0.09); ctx.lineCap = 'round';
  for (const s of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(b.gx, b.gy - H * 0.06);
    ctx.quadraticCurveTo(b.gx + s * R * 0.34, b.gy - H * 0.02, b.gx + s * R * 0.6, b.gy);
    ctx.stroke();
  }
  const lean = -Math.PI / 2 + 0.1;
  const tips = branches(ctx, b.gx, b.gy, lean, H * 0.5, R * 0.17, 2, '#6f4a2f', rnd);
  foliage(ctx, b.gx + R * 0.06, b.gy - H * 0.66, R * 0.78, R * 0.6, d.tint, rnd, 8);
  // a couple of smaller masses on the branch tips, so the crown is not one ball
  for (const [x, y] of tips.slice(0, 2)) foliage(ctx, x, y - R * 0.1, R * 0.3, R * 0.24, d.tint, rnd, 6);
  lifeOrbs(ctx, tips, R * 0.075, 1 + (d.idx - 8));
  radialGlow(ctx, b.gx, b.gy - H * 0.6, R * 2, d.tint, 0.14);
  for (let i = 0; i < 4; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2, b.gy - H * (0.3 + rnd() * 0.6), R * 0.09, '#ffffff', 0.55);
}

function matureLifeTree(ctx, b, d, rnd) {
  const t = (d.idx - 12) / 2;
  const H = b.th * (0.76 + t * 0.1), R = b.tw * (0.34 + t * 0.05);
  groundShadow(ctx, b.gx, b.gy, R * 1.35, R * 0.38);
  // buttress roots: a flared base, which is what says "old tree"
  ctx.beginPath();
  ctx.moveTo(b.gx - R * 0.62, b.gy);
  ctx.quadraticCurveTo(b.gx - R * 0.3, b.gy - H * 0.1, b.gx - R * 0.2, b.gy - H * 0.34);
  ctx.lineTo(b.gx + R * 0.2, b.gy - H * 0.34);
  ctx.quadraticCurveTo(b.gx + R * 0.3, b.gy - H * 0.1, b.gx + R * 0.62, b.gy);
  ctx.closePath();
  litFill(ctx, '#8f6a48', '#4a3220', b.gy - H * 0.34, b.gy);
  ctx.strokeStyle = rgba('#33220f', 0.5); ctx.lineWidth = 1; ctx.stroke();
  // bark seams
  ctx.strokeStyle = rgba('#33220f', 0.35); ctx.lineWidth = 1;
  for (let i = -1; i <= 1; i++) {
    ctx.beginPath();
    ctx.moveTo(b.gx + i * R * 0.2, b.gy - H * 0.04);
    ctx.quadraticCurveTo(b.gx + i * R * 0.26, b.gy - H * 0.2, b.gx + i * R * 0.14, b.gy - H * 0.33);
    ctx.stroke();
  }
  const tips = branches(ctx, b.gx, b.gy - H * 0.3, -Math.PI / 2, H * 0.3, R * 0.16, 3, '#6f4a2f', rnd);
  // two crown masses at different heights
  foliage(ctx, b.gx - R * 0.34, b.gy - H * 0.72, R * 0.66, R * 0.52, d.tint, rnd, 9);
  foliage(ctx, b.gx + R * 0.4, b.gy - H * 0.88, R * 0.6, R * 0.48, shade(d.tint, -0.06), rnd, 9);
  foliage(ctx, b.gx + R * 0.02, b.gy - H * 0.6, R * 0.5, R * 0.36, shade(d.tint, 0.1), rnd, 8);
  lifeOrbs(ctx, tips, R * 0.07, 3 + (d.idx - 12));
  // hanging light strands
  for (let i = 0; i < 4; i++) {
    const vx = b.gx + (i - 1.5) * R * 0.42;
    const len = H * (0.1 + rnd() * 0.16);
    ctx.strokeStyle = rgba(shade(d.tint, 0.4), 0.7); ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(vx, b.gy - H * 0.52);
    ctx.quadraticCurveTo(vx + R * 0.06, b.gy - H * 0.52 + len * 0.6, vx, b.gy - H * 0.52 + len);
    ctx.stroke();
    radialGlow(ctx, vx, b.gy - H * 0.52 + len, R * 0.13, '#e0ffe8', 0.55);
  }
  radialGlow(ctx, b.gx, b.gy - H * 0.7, R * 2.2, d.tint, 0.16);
  for (let i = 0; i < 7; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2.4, b.gy - H * (0.35 + rnd() * 0.7), R * 0.08, '#ffffff', 0.6);
}

// --- hill landforms ---------------------------------------------------------
function grassFuzz(ctx, x0, x1, yAt, n, rnd, col = '#8fd06a') {
  ctx.strokeStyle = rgba(col, 0.85);
  ctx.lineWidth = 1.3; ctx.lineCap = 'round';
  for (let i = 0; i < n; i++) {
    const px = x0 + rnd() * (x1 - x0);
    const py = yAt(px);
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + (rnd() - 0.5) * 5, py - 4 - rnd() * 5);
    ctx.stroke();
  }
}

function knoll(ctx, b, d, rnd) {
  const W = b.tw * 0.44, H = b.th * 0.3;
  groundShadow(ctx, b.gx, b.gy, W * 1.15, W * 0.26);
  // a long asymmetric rise with a shoulder, not a symmetric dome
  ctx.beginPath();
  ctx.moveTo(b.gx - W, b.gy);
  ctx.bezierCurveTo(b.gx - W * 0.7, b.gy - H * 1.2, b.gx - W * 0.1, b.gy - H * 1.5, b.gx + W * 0.24, b.gy - H * 1.2);
  ctx.bezierCurveTo(b.gx + W * 0.5, b.gy - H * 1.0, b.gx + W * 0.7, b.gy - H * 0.4, b.gx + W, b.gy);
  ctx.closePath();
  litFill(ctx, shade(d.tint, 0.32), shade(d.tint, -0.36), b.gy - H * 1.5, b.gy);
  ctx.strokeStyle = rgba(shade(d.tint, -0.55), 0.4); ctx.lineWidth = 1; ctx.stroke();
  ctx.save(); ctx.clip();
  // shadowed right flank
  ctx.fillStyle = rgba('#2f3a2a', 0.16);
  ctx.beginPath();
  ctx.moveTo(b.gx + W * 0.1, b.gy - H * 1.4);
  ctx.lineTo(b.gx + W, b.gy); ctx.lineTo(b.gx + W * 0.1, b.gy);
  ctx.closePath(); ctx.fill();
  // a worn path winding up the near face
  ctx.strokeStyle = rgba('#c9b48f', 0.55);
  ctx.lineWidth = Math.max(2.4, W * 0.06);
  ctx.beginPath();
  ctx.moveTo(b.gx - W * 0.7, b.gy);
  ctx.bezierCurveTo(b.gx - W * 0.2, b.gy - H * 0.4, b.gx - W * 0.5, b.gy - H * 0.8, b.gx + W * 0.1, b.gy - H * 1.15);
  ctx.stroke();
  grassFuzz(ctx, b.gx - W * 0.85, b.gx + W * 0.85, (px) => b.gy - H * (0.3 + 0.9 * Math.max(0, 1 - Math.abs((px - b.gx) / W) * 1.1)) + rnd() * 6, 24, rnd);
  ctx.restore();
  // an outcrop breaking the crown, and a lone tree on the higher tier
  blob(ctx, b.gx + W * 0.34, b.gy - H * 1.06, W * 0.2, H * 0.28, 6, 0.22, rnd);
  litFill(ctx, '#b8b0a0', '#5f5a50', b.gy - H * 1.4, b.gy - H * 0.8);
  ctx.strokeStyle = rgba('#3f3a34', 0.45); ctx.lineWidth = 0.9; ctx.stroke();
  if (d.idx >= 4) {
    ctx.strokeStyle = '#6a4f38'; ctx.lineWidth = Math.max(1.8, W * 0.035);
    ctx.beginPath(); ctx.moveTo(b.gx - W * 0.24, b.gy - H * 1.32); ctx.lineTo(b.gx - W * 0.24, b.gy - H * 1.7); ctx.stroke();
    foliage(ctx, b.gx - W * 0.24, b.gy - H * 1.9, W * 0.2, W * 0.15, '#4f9e5f', rnd, 7);
  }
  // wildflowers on the crown
  for (let i = 0; i < 5; i++) {
    const px = b.gx + (rnd() - 0.5) * W * 1.3, py = b.gy - H * (0.5 + rnd() * 0.7);
    ctx.fillStyle = ['#ffe066', '#ff9fc0', '#c9a8ff'][i % 3];
    ctx.beginPath(); ctx.arc(px, py, W * 0.022, 0, 6.3); ctx.fill();
  }
}

function precipice(ctx, b, d, rnd) {
  const W = b.tw * 0.46, H = b.th * 0.5;
  groundShadow(ctx, b.gx, b.gy, W * 1.2, W * 0.24);
  // a cliff: a sheer vertical face on the right, a grassy slope on the left
  ctx.beginPath();
  ctx.moveTo(b.gx - W, b.gy);
  ctx.bezierCurveTo(b.gx - W * 0.6, b.gy - H * 0.7, b.gx - W * 0.2, b.gy - H * 1.0, b.gx + W * 0.36, b.gy - H * 1.05);
  ctx.lineTo(b.gx + W * 0.72, b.gy - H * 1.0);
  ctx.lineTo(b.gx + W * 0.78, b.gy);
  ctx.closePath();
  litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.4), b.gy - H * 1.05, b.gy);
  ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.45); ctx.lineWidth = 1.1; ctx.stroke();
  ctx.save(); ctx.clip();
  // the sheer face, in shadow, with horizontal strata
  ctx.fillStyle = rgba('#2a3040', 0.34);
  ctx.beginPath();
  ctx.moveTo(b.gx + W * 0.36, b.gy - H * 1.05);
  ctx.lineTo(b.gx + W * 0.78, b.gy - H * 1.0);
  ctx.lineTo(b.gx + W * 0.78, b.gy); ctx.lineTo(b.gx + W * 0.3, b.gy);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba('#1f2430', 0.4); ctx.lineWidth = 1.2;
  for (let i = 1; i <= 6; i++) {
    const y = b.gy - H * 0.15 * i;
    ctx.beginPath(); ctx.moveTo(b.gx + W * 0.28, y); ctx.lineTo(b.gx + W * 0.8, y - H * 0.02); ctx.stroke();
  }
  grassFuzz(ctx, b.gx - W * 0.9, b.gx + W * 0.3, (px) => b.gy - H * (0.1 + 0.95 * Math.min(1, (px - (b.gx - W)) / (W * 1.3))) + rnd() * 5, 22, rnd);
  ctx.restore();
  // a moon low behind the cliff edge -- Moon's Precipice
  radialGlow(ctx, b.gx - W * 0.5, b.gy - H * 1.4, W * 0.9, '#e8eeff', 0.5);
  sphere(ctx, b.gx - W * 0.5, b.gy - H * 1.42, W * 0.19, '#f0f4ff');
  // a lip of overhanging turf at the cliff top
  ctx.beginPath();
  ctx.moveTo(b.gx + W * 0.3, b.gy - H * 1.05);
  ctx.quadraticCurveTo(b.gx + W * 0.56, b.gy - H * 1.14, b.gx + W * 0.8, b.gy - H * 1.0);
  ctx.quadraticCurveTo(b.gx + W * 0.56, b.gy - H * 1.02, b.gx + W * 0.3, b.gy - H * 1.05);
  ctx.closePath();
  ctx.fillStyle = '#5fa84f'; ctx.fill();
  for (let i = 0; i < 8; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * W * 1.8, b.gy - rnd() * H * 1.3, W * 0.04, '#ffffff', 0.5);
}

function butte(ctx, b, d, rnd) {
  const W = b.tw * 0.4, H = b.th * 0.62;
  groundShadow(ctx, b.gx, b.gy, W * 1.1, W * 0.26);
  // a flat-topped column with a talus skirt: nothing else in the chain is tall
  ctx.beginPath();
  ctx.moveTo(b.gx - W * 0.9, b.gy);
  ctx.quadraticCurveTo(b.gx - W * 0.56, b.gy - H * 0.2, b.gx - W * 0.44, b.gy - H * 0.98);
  ctx.lineTo(b.gx + W * 0.44, b.gy - H * 0.98);
  ctx.quadraticCurveTo(b.gx + W * 0.56, b.gy - H * 0.2, b.gx + W * 0.9, b.gy);
  ctx.closePath();
  litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.42), b.gy - H, b.gy);
  ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.5); ctx.lineWidth = 1.1; ctx.stroke();
  ctx.save(); ctx.clip();
  ctx.fillStyle = rgba('#2a2434', 0.3);
  ctx.beginPath();
  ctx.moveTo(b.gx + W * 0.1, b.gy - H); ctx.lineTo(b.gx + W * 0.9, b.gy);
  ctx.lineTo(b.gx + W * 0.1, b.gy); ctx.closePath(); ctx.fill();
  // vertical erosion flutes
  ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.45); ctx.lineWidth = 1.2;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(b.gx + i * W * 0.13, b.gy - H * 0.96);
    ctx.quadraticCurveTo(b.gx + i * W * 0.17, b.gy - H * 0.4, b.gx + i * W * 0.2, b.gy);
    ctx.stroke();
  }
  ctx.restore();
  // flat cap with turf
  ctx.beginPath();
  ctx.ellipse(b.gx, b.gy - H * 0.98, W * 0.48, W * 0.13, 0, 0, 6.3);
  litFill(ctx, '#7fbf5f', '#3f7f3f', b.gy - H * 1.1, b.gy - H * 0.9);
  ctx.strokeStyle = rgba('#2f5f2f', 0.5); ctx.lineWidth = 1; ctx.stroke();
  grassFuzz(ctx, b.gx - W * 0.4, b.gx + W * 0.4, () => b.gy - H * 1.0, 12, rnd);
  // a grave marker on top: it is the Zomblin's butte
  ctx.fillStyle = '#8f8f9a';
  ctx.beginPath();
  ctx.moveTo(b.gx - W * 0.08, b.gy - H * 1.02);
  ctx.lineTo(b.gx - W * 0.08, b.gy - H * 1.24);
  ctx.quadraticCurveTo(b.gx, b.gy - H * 1.32, b.gx + W * 0.08, b.gy - H * 1.24);
  ctx.lineTo(b.gx + W * 0.08, b.gy - H * 1.02);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = rgba('#4f4f58', 0.7); ctx.lineWidth = 1; ctx.stroke();
  // talus rubble at the foot
  for (let i = 0; i < 7; i++) {
    const px = b.gx + (rnd() - 0.5) * W * 1.7, py = b.gy - rnd() * H * 0.06;
    blob(ctx, px, py, W * 0.07, W * 0.045, 5, 0.3, rnd);
    litFill(ctx, shade(d.tint, 0.16), shade(d.tint, -0.44), py - W * 0.06, py + W * 0.06);
  }
  radialGlow(ctx, b.gx, b.gy - H * 0.7, W * 1.4, '#a89fc0', 0.14);
}

// ---------------------------------------------------------------------------
export function register(PAINTERS, growth) {
  const G = growth;

  // --- logs, cabins ------------------------------------------------------
  PAINTERS.log = (ctx, b, d, rnd) => {
    const g = G(d), R = T * (0.16 + g * 0.1);
    groundShadow(ctx, b.gx, b.gy, R * 2.2, R * 0.62);
    const stack = d.idx >= 2 ? 3 : d.idx >= 1 ? 2 : 1;
    for (let i = 0; i < stack; i++) {
      const y = b.gy - R * 0.6 - i * R * 0.92;
      const x = b.gx + (i % 2 ? R * 0.22 : -R * 0.18);
      // barrel
      roundRect(ctx, x - R * 1.05, y - R * 0.5, R * 2.1, R, R * 0.44);
      litFill(ctx, shade(d.tint, 0.24), shade(d.tint, -0.36), y - R * 0.5, y + R * 0.5);
      ctx.strokeStyle = rgba(shade(d.tint, -0.55), 0.6); ctx.lineWidth = 1; ctx.stroke();
      // cut end with rings
      ctx.beginPath(); ctx.ellipse(x - R * 1.02, y, R * 0.24, R * 0.5, 0, 0, 6.3);
      litFill(ctx, shade(d.tint, 0.42), shade(d.tint, -0.1), y - R * 0.5, y + R * 0.5);
      ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.7); ctx.lineWidth = 0.8;
      for (let k = 1; k <= 2; k++) {
        ctx.beginPath(); ctx.ellipse(x - R * 1.02, y, R * 0.24 * (k / 3), R * 0.5 * (k / 3), 0, 0, 6.3); ctx.stroke();
      }
      // bark strokes along the barrel
      ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.34); ctx.lineWidth = 0.9;
      for (let k = 0; k < 3; k++) {
        const yy = y - R * 0.28 + k * R * 0.28;
        ctx.beginPath(); ctx.moveTo(x - R * 0.7, yy); ctx.lineTo(x + R * 0.9, yy + R * 0.05); ctx.stroke();
      }
    }
    // the fungus that makes it a Fungus Log
    if (d.chain === 'fungusLog' || d.chain === 'mysticTree') {
      for (let i = 0; i < 3 + d.idx; i++) {
        const cx = b.gx - R * 0.7 + rnd() * R * 1.6, cy = b.gy - R * 0.6 - rnd() * R * stack * 0.9;
        const cr = R * (0.14 + rnd() * 0.1);
        ctx.beginPath(); ctx.ellipse(cx, cy, cr, cr * 0.62, 0, Math.PI, 0);
        ctx.fillStyle = mix('#e8e0c0', hueShift(d.tint, 60), 0.4); ctx.fill();
        ctx.strokeStyle = rgba('#5f5a4f', 0.5); ctx.lineWidth = 0.7; ctx.stroke();
      }
    }
    if (d.idx >= 4) for (let i = 0; i < 4; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 3, b.gy - rnd() * R * 2.4, R * 0.14, '#ffe9b0', 0.6);
  };

  PAINTERS.cabin = (ctx, b, d, rnd) => {
    const W = b.tw * 0.52, H = b.th * 0.44;
    groundShadow(ctx, b.gx, b.gy, W * 0.8, W * 0.24);
    const box = buildingBox(ctx, b.gx, b.gy, W, H, d.tint, 0.22);
    // log courses across the front
    ctx.save();
    ctx.beginPath(); ctx.rect(box.fx, box.top, box.fw, H); ctx.clip();
    ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.5); ctx.lineWidth = 1.1;
    for (let i = 1; i < 5; i++) {
      const y = box.top + (H / 5) * i;
      ctx.beginPath(); ctx.moveTo(box.fx, y); ctx.lineTo(box.fx + box.fw, y); ctx.stroke();
    }
    ctx.restore();
    // thatch roof
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 0.62, box.top + 2);
    ctx.quadraticCurveTo(b.gx, box.top - H * 0.62, b.gx + W * 0.62, box.top + 2);
    ctx.closePath();
    litFill(ctx, '#c9a45f', '#7a5f34', box.top - H * 0.6, box.top);
    ctx.strokeStyle = rgba('#4f3a20', 0.5); ctx.lineWidth = 1; ctx.stroke();
    // door + window
    roundRect(ctx, b.gx - W * 0.12, b.gy - H * 0.52, W * 0.24, H * 0.52, W * 0.05);
    litFill(ctx, '#5f4028', '#3a2618', b.gy - H * 0.52, b.gy);
    litWindow(ctx, b.gx + W * 0.18, b.gy - H * 0.62, W * 0.16, H * 0.2);
    // gnome bushes at the base
    for (const s of [-1, 1]) {
      blob(ctx, b.gx + s * W * 0.56, b.gy - H * 0.06, W * 0.16, W * 0.12, 6, 0.24, rnd);
      ctx.fillStyle = '#4f8f4f'; ctx.fill();
    }
  };

  // --- fruit (apples, berries, gem fruit) --------------------------------
  PAINTERS.fruit = (ctx, b, d, rnd) => {
    const g = G(d);
    const n = d.idx === 0 ? 3 : d.idx === 1 ? 2 : 1;
    const R = Math.min(b.tw, b.th) * (0.14 + g * 0.18) / (n > 1 ? 1.5 : 1);
    groundShadow(ctx, b.gx, b.gy, R * 1.9 * n * 0.7, R * 0.55);
    const faceted = d.chain === 'crystalFruit';
    const spots = n === 3 ? [[-R * 1.0, 0], [R * 1.0, R * 0.1], [0, -R * 0.9]]
      : n === 2 ? [[-R * 0.72, 0], [R * 0.7, -R * 0.3]] : [[0, 0]];
    for (const [ox, oy] of spots) {
      const cx = b.gx + ox, cy = b.gy - R - oy;
      if (faceted) {
        // a gem fruit: cut facets rather than a smooth skin
        starPath(ctx, cx, cy, 6, R, R * 0.72, -Math.PI / 2);
        litFill(ctx, shade(d.tint, 0.5), shade(d.tint, -0.3), cy - R, cy + R);
        ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = 1; ctx.stroke();
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i / 6) * 6.283;
          ctx.strokeStyle = rgba('#ffffff', 0.3); ctx.lineWidth = 0.8;
          ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
        }
      } else {
        ctx.beginPath();
        ctx.moveTo(cx, cy - R * 0.88);
        ctx.bezierCurveTo(cx + R * 1.06, cy - R * 0.9, cx + R * 1.02, cy + R * 0.86, cx, cy + R * 0.94);
        ctx.bezierCurveTo(cx - R * 1.02, cy + R * 0.86, cx - R * 1.06, cy - R * 0.9, cx, cy - R * 0.88);
        ctx.closePath();
        litFill(ctx, shade(d.tint, 0.46), shade(d.tint, -0.36), cy - R, cy + R);
        ctx.strokeStyle = rgba(shade(d.tint, -0.55), 0.5); ctx.lineWidth = 1; ctx.stroke();
        // dimple + specular
        ctx.strokeStyle = rgba(shade(d.tint, -0.4), 0.4); ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.arc(cx, cy - R * 0.7, R * 0.3, 0.6, 2.5); ctx.stroke();
        ctx.fillStyle = rgba('#ffffff', 0.42);
        ctx.beginPath(); ctx.ellipse(cx - R * 0.32, cy - R * 0.3, R * 0.2, R * 0.3, -0.4, 0, 6.3); ctx.fill();
      }
      // stalk + leaf
      ctx.strokeStyle = '#6f4f2f'; ctx.lineWidth = Math.max(1.2, R * 0.11); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, cy - R * 0.85); ctx.lineTo(cx + R * 0.1, cy - R * 1.3); ctx.stroke();
      leafPath(ctx, cx + R * 0.1, cy - R * 1.24, R * 0.62, R * 0.3, 1.1);
      litFill(ctx, '#8fd06a', '#3f7a3a', cy - R * 1.4, cy - R);
    }
    radialGlow(ctx, b.gx, b.gy - R * 1.2, R * 2.6, d.tint, d.idx >= 6 ? 0.3 : 0.14);
    if (d.idx >= 5) for (let i = 0; i < 4 + d.idx; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 3.4, b.gy - R * 0.4 - rnd() * R * 2.4, R * 0.15, '#ffffff', 0.8);
  };

  // --- seashells ---------------------------------------------------------
  PAINTERS.shell = (ctx, b, d, rnd) => {
    const g = G(d), R = Math.min(b.tw, b.th) * (0.17 + g * 0.2);
    groundShadow(ctx, b.gx, b.gy, R * 1.5, R * 0.44);
    const spiky = d.idx >= 5;
    const conch = d.idx >= 7;
    const cy = b.gy - R * 0.72;
    if (conch) {
      // a spiral conch: a different animal from the scallop fan below
      ctx.save();
      ctx.translate(b.gx, cy);
      ctx.rotate(-0.35);
      ctx.beginPath();
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, a = t * Math.PI * 3.2, rr = R * (0.16 + t * 0.95);
        const x = Math.cos(a) * rr, y = Math.sin(a) * rr * 0.78;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      for (let i = 60; i >= 0; i--) {
        const t = i / 60, a = t * Math.PI * 3.2, rr = R * (0.16 + t * 0.62);
        ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr * 0.78);
      }
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.5), shade(d.tint, -0.4), -R, R);
      ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.55); ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    } else {
      // scallop fan with ribs
      ctx.beginPath();
      ctx.moveTo(b.gx, cy + R * 0.62);
      for (let i = 0; i <= 10; i++) {
        const t = i / 10, a = Math.PI + t * Math.PI;
        const wob = spiky ? 1 + (i % 2 ? 0.14 : -0.04) : 1;
        ctx.lineTo(b.gx + Math.cos(a) * R * wob, cy + R * 0.62 + Math.sin(a) * R * 1.05 * wob);
      }
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.5), shade(d.tint, -0.34), cy - R * 0.5, cy + R * 0.7);
      ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.55); ctx.lineWidth = 1.1; ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = rgba(shade(d.tint, -0.42), 0.45); ctx.lineWidth = 1;
      for (let i = 1; i < 8; i++) {
        const a = Math.PI + (i / 8) * Math.PI;
        ctx.beginPath();
        ctx.moveTo(b.gx, cy + R * 0.62);
        ctx.lineTo(b.gx + Math.cos(a) * R * 1.2, cy + R * 0.62 + Math.sin(a) * R * 1.25);
        ctx.stroke();
      }
      ctx.restore();
      // hinge
      ctx.beginPath(); ctx.arc(b.gx, cy + R * 0.6, R * 0.16, Math.PI, 0);
      ctx.fillStyle = shade(d.tint, -0.2); ctx.fill();
    }
    ctx.fillStyle = rgba('#ffffff', 0.4);
    ctx.beginPath(); ctx.ellipse(b.gx - R * 0.3, cy - R * 0.1, R * 0.2, R * 0.12, -0.5, 0, 6.3); ctx.fill();
    if (d.idx >= 6) for (let i = 0; i < 5; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2.4, cy + (rnd() - 0.6) * R * 1.6, R * 0.13, '#ffffff', 0.8);
  };

  PAINTERS.starfish = (ctx, b, d, rnd) => {
    const g = G(d), R = Math.min(b.tw, b.th) * (0.2 + g * 0.2);
    groundShadow(ctx, b.gx, b.gy, R * 1.3, R * 0.4);
    const cy = b.gy - R * 0.6;
    const arms = 5;
    // fat-armed star drawn as bezier lobes, not a spiky polygon
    ctx.beginPath();
    for (let i = 0; i < arms; i++) {
      const a0 = -Math.PI / 2 + (i / arms) * 6.283;
      const a1 = -Math.PI / 2 + ((i + 0.5) / arms) * 6.283;
      const a2 = -Math.PI / 2 + ((i + 1) / arms) * 6.283;
      const p = (a, r) => [b.gx + Math.cos(a) * r, cy + Math.sin(a) * r * 0.9];
      const [x0, y0] = p(a0, R);
      const [xm, ym] = p(a1, R * 0.36);
      const [x2, y2] = p(a2, R);
      if (!i) ctx.moveTo(x0, y0);
      ctx.quadraticCurveTo(...p(a0 + 0.24, R * 0.62), xm, ym);
      ctx.quadraticCurveTo(...p(a2 - 0.24, R * 0.62), x2, y2);
    }
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.42), shade(d.tint, -0.38), cy - R, cy + R);
    ctx.strokeStyle = rgba(shade(d.tint, -0.55), 0.55); ctx.lineWidth = 1.2; ctx.stroke();
    // tube feet: rows of dots down each arm
    ctx.fillStyle = rgba(shade(d.tint, 0.6), 0.75);
    for (let i = 0; i < arms; i++) {
      const a = -Math.PI / 2 + (i / arms) * 6.283;
      for (let k = 1; k <= 3 + Math.min(3, d.idx); k++) {
        const rr = R * (0.24 + (k / (4 + d.idx)) * 0.68);
        ctx.beginPath();
        ctx.arc(b.gx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.9, Math.max(0.8, R * 0.055), 0, 6.3);
        ctx.fill();
      }
    }
    radialGlow(ctx, b.gx, cy, R * 1.6, d.tint, d.idx >= 6 ? 0.26 : 0.1);
    if (d.idx >= 7) for (let i = 0; i < 6; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2.4, cy + (rnd() - 0.5) * R * 2, R * 0.12, '#ffffff', 0.75);
  };

  // --- honey: comb -> jar -> hive ----------------------------------------
  PAINTERS.honey = (ctx, b, d, rnd) => {
    const g = G(d);
    const S = Math.min(b.tw, b.th) * (0.2 + g * 0.2);
    groundShadow(ctx, b.gx, b.gy, S * 1.5, S * 0.42);
    const hex = (cx, cy, r, col) => {
      starPath(ctx, cx, cy, 6, r, r, -Math.PI / 2);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i / 6) * 6.283;
        const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
        i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.closePath();
      litFill(ctx, shade(col, 0.4), shade(col, -0.3), cy - r, cy + r);
      ctx.strokeStyle = rgba(shade(col, -0.5), 0.65); ctx.lineWidth = 1; ctx.stroke();
    };
    if (d.idx <= 2) {
      // honeycomb clusters: 1, 3 then 7 cells
      const cells = d.idx === 0 ? [[0, 0]] : d.idx === 1 ? [[-0.5, 0.2], [0.5, 0.2], [0, -0.6]]
        : [[0, 0], [-0.9, 0], [0.9, 0], [-0.45, -0.8], [0.45, -0.8], [-0.45, 0.8], [0.45, 0.8]];
      const r = S * (d.idx === 2 ? 0.3 : 0.42);
      for (const [ox, oy] of cells) hex(b.gx + ox * r * 1.7, b.gy - S * 0.7 + oy * r * 1.5, r, d.tint);
    } else if (d.idx <= 5) {
      // a jar: glass body, honey fill, cloth lid
      const W = S * 0.86, H = S * 1.1;
      roundRect(ctx, b.gx - W / 2, b.gy - H, W, H, W * 0.22);
      litFill(ctx, rgba('#fff6d0', 0.5), rgba('#e8c46f', 0.7), b.gy - H, b.gy);
      ctx.save(); ctx.clip();
      ctx.fillStyle = shade(d.tint, -0.04);
      ctx.fillRect(b.gx - W / 2, b.gy - H * (0.52 + d.idx * 0.08), W, H);
      ctx.fillStyle = rgba('#ffffff', 0.3);
      ctx.fillRect(b.gx - W * 0.4, b.gy - H * 0.9, W * 0.14, H * 0.8);
      ctx.restore();
      ctx.strokeStyle = rgba('#8f6a2f', 0.7); ctx.lineWidth = 1.2; ctx.stroke();
      // cloth lid, tied
      ctx.beginPath();
      ctx.ellipse(b.gx, b.gy - H, W * 0.6, W * 0.2, 0, Math.PI, 0);
      ctx.lineTo(b.gx + W * 0.52, b.gy - H * 0.9);
      ctx.quadraticCurveTo(b.gx, b.gy - H * 0.82, b.gx - W * 0.52, b.gy - H * 0.9);
      ctx.closePath();
      litFill(ctx, '#e8d0a8', '#b09060', b.gy - H * 1.2, b.gy - H * 0.8);
      ctx.strokeStyle = rgba('#7f5f30', 0.6); ctx.lineWidth = 1; ctx.stroke();
      // dipper
      if (d.idx >= 4) {
        ctx.strokeStyle = '#c9a46f'; ctx.lineWidth = Math.max(1.6, S * 0.07); ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(b.gx + W * 0.5, b.gy - H * 1.0); ctx.lineTo(b.gx + W * 0.78, b.gy - H * 1.32); ctx.stroke();
      }
    } else {
      // a hive: stacked domed skeps with a doorway and bees
      const W = S * 1.05;
      const layers = 3 + Math.min(2, d.idx - 6);
      for (let i = 0; i < layers; i++) {
        const t = i / layers;
        const w = W * (1 - t * 0.42), h = S * 0.34;
        const y = b.gy - i * h * 0.92;
        ctx.beginPath();
        ctx.ellipse(b.gx, y - h * 0.4, w / 2, h * 0.62, 0, Math.PI, 0);
        ctx.lineTo(b.gx + w / 2, y);
        ctx.lineTo(b.gx - w / 2, y);
        ctx.closePath();
        litFill(ctx, shade(d.tint, 0.34 - t * 0.1), shade(d.tint, -0.34), y - h, y);
        ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.55); ctx.lineWidth = 1; ctx.stroke();
      }
      // doorway
      ctx.beginPath(); ctx.ellipse(b.gx, b.gy - S * 0.12, S * 0.16, S * 0.13, 0, Math.PI, 0);
      ctx.fillStyle = '#4f3418'; ctx.fill();
      radialGlow(ctx, b.gx, b.gy - S * 0.16, S * 0.5, '#ffd06f', 0.5);
      // bees on the wing
      for (let i = 0; i < 3 + d.idx - 6; i++) {
        const bx = b.gx + (rnd() - 0.5) * W * 1.9, by = b.gy - S * (0.5 + rnd() * layers * 0.5);
        ctx.fillStyle = '#ffdf6f';
        ctx.beginPath(); ctx.ellipse(bx, by, S * 0.075, S * 0.05, 0.3, 0, 6.3); ctx.fill();
        ctx.strokeStyle = 'rgba(40,30,10,0.8)'; ctx.lineWidth = 0.7;
        ctx.beginPath(); ctx.moveTo(bx - S * 0.02, by - S * 0.04); ctx.lineTo(bx - S * 0.02, by + S * 0.04); ctx.stroke();
        ctx.fillStyle = rgba('#ffffff', 0.6);
        ctx.beginPath(); ctx.ellipse(bx, by - S * 0.06, S * 0.05, S * 0.025, -0.4, 0, 6.3); ctx.fill();
      }
    }
    radialGlow(ctx, b.gx, b.gy - S * 0.6, S * 2, '#ffd06f', 0.16);
  };

  // --- chocolate ---------------------------------------------------------
  PAINTERS.choco = (ctx, b, d, rnd) => {
    const g = G(d), S = Math.min(b.tw, b.th) * (0.2 + g * 0.22);
    groundShadow(ctx, b.gx, b.gy, S * 1.5, S * 0.44);
    if (d.idx <= 3) {
      // a cocoa flower on a stem
      ctx.strokeStyle = '#4f7f3f'; ctx.lineWidth = Math.max(1.8, S * 0.09); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.gx, b.gy); ctx.quadraticCurveTo(b.gx + S * 0.1, b.gy - S * 0.5, b.gx, b.gy - S * 0.92); ctx.stroke();
      for (const s of [-1, 1]) {
        leafPath(ctx, b.gx, b.gy - S * 0.4, S * 0.5, S * 0.22, s * 1.2);
        litFill(ctx, '#8fd06a', '#3f7a3a', b.gy - S * 0.8, b.gy);
      }
      const R = S * (0.24 + d.idx * 0.05);
      for (let i = 0; i < 5; i++) {
        petal(ctx, b.gx, b.gy - S * 0.92, R, R * 0.42, (i / 5) * 6.283, 0.4);
        litFill(ctx, shade(d.tint, 0.42), shade(d.tint, -0.2), b.gy - S * 1.3, b.gy - S * 0.6);
      }
      ctx.beginPath(); ctx.arc(b.gx, b.gy - S * 0.92, R * 0.34, 0, 6.3);
      ctx.fillStyle = '#5f3a20'; ctx.fill();
    } else if (d.idx <= 6) {
      // a chocolate sculpture: a glossy swirl cone
      const H = S * 1.3;
      ctx.beginPath();
      ctx.moveTo(b.gx - S * 0.4, b.gy);
      ctx.bezierCurveTo(b.gx - S * 0.36, b.gy - H * 0.5, b.gx + S * 0.3, b.gy - H * 0.62, b.gx + S * 0.06, b.gy - H);
      ctx.bezierCurveTo(b.gx + S * 0.5, b.gy - H * 0.6, b.gx + S * 0.42, b.gy - H * 0.24, b.gx + S * 0.4, b.gy);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.36), shade(d.tint, -0.44), b.gy - H, b.gy);
      ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.5); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = rgba('#ffffff', 0.28);
      ctx.beginPath(); ctx.ellipse(b.gx - S * 0.12, b.gy - H * 0.6, S * 0.08, H * 0.26, -0.2, 0, 6.3); ctx.fill();
      // dipped berries at the base
      for (let i = 0; i < 3; i++) {
        const bx = b.gx + (i - 1) * S * 0.38;
        ctx.beginPath(); ctx.arc(bx, b.gy - S * 0.12, S * 0.11, 0, 6.3);
        ctx.fillStyle = i % 2 ? '#c93f5f' : '#5f3a20'; ctx.fill();
        ctx.strokeStyle = rgba('#2f1a10', 0.5); ctx.lineWidth = 0.7; ctx.stroke();
      }
    } else {
      // a tiered fountain with falling chocolate
      const H = S * 1.5;
      for (let i = 0; i < 3; i++) {
        const t = i / 3;
        const w = S * (1.1 - t * 0.5), y = b.gy - i * H * 0.32;
        ctx.beginPath(); ctx.ellipse(b.gx, y - H * 0.06, w / 2, w * 0.14, 0, 0, 6.3);
        litFill(ctx, shade('#c9b09a', 0.3), shade('#8f7a68', -0.2), y - H * 0.2, y);
        ctx.strokeStyle = rgba('#5f4a38', 0.5); ctx.lineWidth = 1; ctx.stroke();
        // chocolate sheet falling off the rim
        ctx.beginPath();
        ctx.moveTo(b.gx - w / 2, y - H * 0.06);
        ctx.quadraticCurveTo(b.gx, y + H * 0.1, b.gx + w / 2, y - H * 0.06);
        ctx.quadraticCurveTo(b.gx, y - H * 0.02, b.gx - w / 2, y - H * 0.06);
        ctx.closePath();
        ctx.fillStyle = shade(d.tint, 0.1 + t * 0.1); ctx.fill();
        for (let k = 0; k < 4; k++) {
          const px = b.gx - w * 0.4 + k * w * 0.26;
          ctx.strokeStyle = rgba(shade(d.tint, 0.16), 0.85);
          ctx.lineWidth = Math.max(1.4, S * 0.06);
          ctx.beginPath(); ctx.moveTo(px, y - H * 0.02); ctx.lineTo(px, y + H * 0.22); ctx.stroke();
        }
      }
      // spout
      ctx.beginPath(); ctx.arc(b.gx, b.gy - H * 1.02, S * 0.13, 0, 6.3);
      ctx.fillStyle = '#c9b09a'; ctx.fill();
      radialGlow(ctx, b.gx, b.gy - H * 0.6, S * 2, '#c98f5f', 0.2);
    }
  };

  // --- temples -----------------------------------------------------------
  PAINTERS.temple = (ctx, b, d, rnd) => {
    const g = G(d);
    const storeys = Math.min(4, 1 + Math.floor(d.idx / 3));
    const W = b.tw * (0.42 + g * 0.2);
    const H = b.th * (0.2 + g * 0.14);
    groundShadow(ctx, b.gx, b.gy, W * 0.9, W * 0.26);
    plinth(ctx, b.gx, b.gy, W * 1.24, H * 0.34, '#b8b0a0');
    // a courtyard wall appears at the top of the chain: the silhouette widens
    if (d.idx >= 9) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.rect(b.gx + s * W * 0.78 - W * 0.1, b.gy - H * 0.7, W * 0.2, H * 0.55);
        litFill(ctx, '#cfc6b4', '#8f8878', b.gy - H * 0.7, b.gy);
        ctx.strokeStyle = rgba('#5f5a4f', 0.4); ctx.lineWidth = 0.9; ctx.stroke();
        pagodaRoof(ctx, b.gx + s * W * 0.78, b.gy - H * 0.7, W * 0.36, H * 0.24, shade(d.tint, -0.1));
      }
    }
    let y = b.gy - H * 0.34;
    for (let i = 0; i < storeys; i++) {
      const t = i / Math.max(1, storeys);
      const w = W * (1 - t * 0.3), h = H * 0.62;
      // wall with pillars
      ctx.beginPath(); ctx.rect(b.gx - w / 2, y - h, w, h);
      litFill(ctx, '#e0d8c4', '#a89e88', y - h, y);
      ctx.strokeStyle = rgba('#5f5a4f', 0.45); ctx.lineWidth = 1; ctx.stroke();
      const pil = 3 + i;
      ctx.fillStyle = rgba('#8f8878', 0.5);
      for (let k = 0; k < pil; k++) {
        const px = b.gx - w / 2 + (w / pil) * (k + 0.5);
        ctx.fillRect(px - w * 0.02, y - h * 0.92, w * 0.04, h * 0.86);
      }
      // doorway on the ground storey
      if (i === 0) {
        roundRect(ctx, b.gx - w * 0.1, y - h * 0.72, w * 0.2, h * 0.72, w * 0.06);
        litFill(ctx, '#6f4a30', '#3a2416', y - h * 0.72, y);
        if (d.idx >= 4) radialGlow(ctx, b.gx, y - h * 0.36, w * 0.34, '#ffd06f', 0.4);
      }
      pagodaRoof(ctx, b.gx, y - h, w * 1.34, H * 0.5, d.tint);
      y -= h + H * 0.24;
    }
    // a bell hangs under the top roof from mid-chain
    if (d.idx >= 5) {
      const by = y + H * 0.3;
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.09, by);
      ctx.quadraticCurveTo(b.gx - W * 0.1, by - H * 0.3, b.gx, by - H * 0.34);
      ctx.quadraticCurveTo(b.gx + W * 0.1, by - H * 0.3, b.gx + W * 0.09, by);
      ctx.closePath();
      litFill(ctx, '#e8c05f', '#8f6f2f', by - H * 0.36, by);
      ctx.strokeStyle = rgba('#5f4a20', 0.6); ctx.lineWidth = 0.9; ctx.stroke();
    }
    if (d.idx >= 6) radialGlow(ctx, b.gx, b.gy - H * 1.6, W * 1.6, d.tint, 0.2);
    if (d.idx >= 8) for (let i = 0; i < 8; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * W * 2.2, b.gy - rnd() * H * 3.4, W * 0.05, '#fff6d0', 0.7);
  };

  // --- haunted houses ----------------------------------------------------
  PAINTERS.house = (ctx, b, d, rnd) => {
    const g = G(d);
    const W = b.tw * (0.4 + g * 0.22), H = b.th * (0.3 + g * 0.3);
    groundShadow(ctx, b.gx, b.gy, W * 0.85, W * 0.24);
    // the whole house leans, more with tier -- the silhouette itself is wrong
    const lean = 0.03 + Math.min(0.09, d.idx * 0.012);
    ctx.save();
    ctx.translate(b.gx, b.gy);
    ctx.transform(1, 0, -lean, 1, 0, 0);
    ctx.translate(-b.gx, -b.gy);
    const wings = d.idx >= 6 ? 2 : d.idx >= 3 ? 1 : 0;
    for (let i = 0; i < wings; i++) {
      const s = i === 0 ? -1 : 1;
      const ww = W * 0.44, hh = H * 0.5;
      buildingBox(ctx, b.gx + s * W * 0.56, b.gy, ww, hh, shade(d.tint, -0.1), 0.2);
      ctx.beginPath();
      ctx.moveTo(b.gx + s * W * 0.56 - ww * 0.62, b.gy - hh);
      ctx.lineTo(b.gx + s * W * 0.56, b.gy - hh - H * 0.26);
      ctx.lineTo(b.gx + s * W * 0.56 + ww * 0.62, b.gy - hh);
      ctx.closePath();
      litFill(ctx, '#5f4f60', '#332a3a', b.gy - hh - H * 0.3, b.gy - hh);
      litWindow(ctx, b.gx + s * W * 0.56 - ww * 0.1, b.gy - hh * 0.62, ww * 0.2, hh * 0.24, '#a8ff9f');
    }
    const box = buildingBox(ctx, b.gx, b.gy, W, H, d.tint, 0.24);
    // steep roof
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 0.64, box.top + 1);
    ctx.lineTo(b.gx - W * 0.04, box.top - H * 0.52);
    ctx.lineTo(b.gx + W * 0.6, box.top + 1);
    ctx.closePath();
    litFill(ctx, '#6f5a72', '#332a3a', box.top - H * 0.52, box.top);
    ctx.strokeStyle = rgba('#241d2c', 0.7); ctx.lineWidth = 1; ctx.stroke();
    // broken shingles
    ctx.strokeStyle = rgba('#241d2c', 0.4); ctx.lineWidth = 0.8;
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.64 + W * 0.6 * t, box.top - H * 0.52 * t + 1);
      ctx.lineTo(b.gx + W * 0.6 - W * 0.64 * t, box.top - H * 0.52 * t + 1);
      ctx.stroke();
    }
    // windows: count grows with tier, all lit sickly green
    const wins = Math.min(6, 1 + Math.floor(d.idx * 0.6));
    for (let i = 0; i < wins; i++) {
      const col = i % 3, row = Math.floor(i / 3);
      litWindow(ctx, box.fx + box.fw * (0.16 + col * 0.3), box.top + H * (0.16 + row * 0.3), box.fw * 0.16, H * 0.18, '#a8ff9f');
    }
    // door
    roundRect(ctx, b.gx - W * 0.1, b.gy - H * 0.34, W * 0.2, H * 0.34, W * 0.04);
    litFill(ctx, '#3f2f38', '#1f1720', b.gy - H * 0.34, b.gy);
    // chimney + crooked weathervane
    ctx.fillStyle = '#4f4250';
    ctx.fillRect(b.gx + W * 0.24, box.top - H * 0.42, W * 0.09, H * 0.3);
    ctx.restore();
    // ghosts drifting out, from mid-chain
    if (d.idx >= 4) {
      for (let i = 0; i < 1 + Math.floor((d.idx - 4) / 2); i++) {
        const gx2 = b.gx + (rnd() - 0.5) * W * 1.6, gy2 = b.gy - H * (1.1 + rnd() * 0.5);
        ctx.save();
        ctx.globalAlpha = 0.42;
        blob(ctx, gx2, gy2, W * 0.11, W * 0.15, 7, 0.2, rnd);
        ctx.fillStyle = '#dff0ff'; ctx.fill();
        ctx.restore();
        radialGlow(ctx, gx2, gy2, W * 0.3, '#c9f0ff', 0.3);
      }
    }
    radialGlow(ctx, b.gx, b.gy - H * 0.5, W * 1.3, '#7fff9f', d.idx >= 7 ? 0.16 : 0.07);
  };

  // --- fairy houses ------------------------------------------------------
  PAINTERS.fairyhouse = (ctx, b, d, rnd) => {
    const g = G(d);
    const S = Math.min(b.tw, b.th) * (0.22 + g * 0.24);
    groundShadow(ctx, b.gx, b.gy, S * 1.2, S * 0.34);
    const towers = d.idx >= 7 ? 3 : d.idx >= 5 ? 2 : 1;
    for (let i = 0; i < towers; i++) {
      const s = towers === 1 ? 0 : (i - (towers - 1) / 2);
      const cx = b.gx + s * S * 0.78;
      const h = S * (1.0 + (i === Math.floor(towers / 2) ? 0.55 : 0) + Math.min(0.5, d.idx * 0.06));
      const w = S * 0.6;
      // trunk-like body
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, b.gy);
      ctx.quadraticCurveTo(cx - w * 0.42, b.gy - h * 0.6, cx - w * 0.36, b.gy - h);
      ctx.lineTo(cx + w * 0.36, b.gy - h);
      ctx.quadraticCurveTo(cx + w * 0.42, b.gy - h * 0.6, cx + w / 2, b.gy);
      ctx.closePath();
      litFill(ctx, '#d8c0a0', '#8f7458', b.gy - h, b.gy);
      ctx.strokeStyle = rgba('#5f4a34', 0.55); ctx.lineWidth = 1; ctx.stroke();
      // toadstool cap roof
      ctx.beginPath();
      ctx.ellipse(cx, b.gy - h, w * 0.82, h * 0.3, 0, Math.PI, 0);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.34), shade(d.tint, -0.32), b.gy - h - h * 0.3, b.gy - h);
      ctx.strokeStyle = rgba(shade(d.tint, -0.55), 0.5); ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = rgba('#fff4e8', 0.85);
      for (let k = 0; k < 4; k++) {
        const a = Math.PI + 0.3 + k * 0.6;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * w * 0.5, b.gy - h + Math.sin(a) * h * 0.18, w * 0.08, h * 0.05, 0, 0, 6.3);
        ctx.fill();
      }
      // round door and window
      ctx.beginPath(); ctx.arc(cx, b.gy - h * 0.18, w * 0.16, Math.PI, 0);
      ctx.lineTo(cx + w * 0.16, b.gy); ctx.lineTo(cx - w * 0.16, b.gy); ctx.closePath();
      litFill(ctx, '#6f4a30', '#3a2416', b.gy - h * 0.34, b.gy);
      litWindow(ctx, cx - w * 0.12, b.gy - h * 0.66, w * 0.24, h * 0.16, '#ffe9a8');
    }
    // fairy lights
    for (let i = 0; i < 4 + d.idx; i++) {
      const fx = b.gx + (rnd() - 0.5) * S * 2.6, fy = b.gy - S * (0.4 + rnd() * 1.7);
      radialGlow(ctx, fx, fy, S * 0.16, '#ffe9c0', 0.55);
      sparkle(ctx, fx, fy, S * 0.07, '#ffffff', 0.85);
    }
  };

  // --- gnomes ------------------------------------------------------------
  PAINTERS.gnome = (ctx, b, d, rnd) => {
    const g = G(d), S = Math.min(b.tw, b.th) * (0.2 + g * 0.16);
    groundShadow(ctx, b.gx, b.gy, S * 0.9, S * 0.28);
    const sitting = d.idx === 1 || d.idx === 4;
    const H = S * (sitting ? 1.05 : 1.35);
    // robe: a cone
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.5, b.gy);
    ctx.quadraticCurveTo(b.gx - S * 0.3, b.gy - H * 0.5, b.gx - S * 0.16, b.gy - H * 0.62);
    ctx.lineTo(b.gx + S * 0.16, b.gy - H * 0.62);
    ctx.quadraticCurveTo(b.gx + S * 0.3, b.gy - H * 0.5, b.gx + S * 0.5, b.gy);
    ctx.closePath();
    litFill(ctx, shade('#4f6f9a', 0.3), shade('#4f6f9a', -0.34), b.gy - H * 0.62, b.gy);
    ctx.strokeStyle = rgba('#2a3a52', 0.6); ctx.lineWidth = 1; ctx.stroke();
    // head
    ctx.beginPath(); ctx.arc(b.gx, b.gy - H * 0.72, S * 0.2, 0, 6.3);
    litFill(ctx, '#f0cfae', '#c09a76', b.gy - H * 0.92, b.gy - H * 0.52);
    // beard: a big white wedge, the gnome's whole read
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.2, b.gy - H * 0.72);
    ctx.quadraticCurveTo(b.gx - S * 0.26, b.gy - H * 0.36, b.gx, b.gy - H * 0.24);
    ctx.quadraticCurveTo(b.gx + S * 0.26, b.gy - H * 0.36, b.gx + S * 0.2, b.gy - H * 0.72);
    ctx.quadraticCurveTo(b.gx, b.gy - H * 0.62, b.gx - S * 0.2, b.gy - H * 0.72);
    ctx.closePath();
    litFill(ctx, '#ffffff', '#c8cdd4', b.gy - H * 0.76, b.gy - H * 0.22);
    ctx.strokeStyle = rgba('#8f96a0', 0.5); ctx.lineWidth = 0.8; ctx.stroke();
    // pointed hat
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.26, b.gy - H * 0.8);
    ctx.quadraticCurveTo(b.gx - S * 0.1, b.gy - H * 1.24, b.gx + S * 0.12, b.gy - H * 1.34);
    ctx.quadraticCurveTo(b.gx + S * 0.14, b.gy - H * 1.0, b.gx + S * 0.26, b.gy - H * 0.8);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.36), b.gy - H * 1.34, b.gy - H * 0.78);
    ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.55); ctx.lineWidth = 1; ctx.stroke();
    // eyes
    ctx.fillStyle = '#3a2a20';
    for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(b.gx + s * S * 0.08, b.gy - H * 0.76, S * 0.026, 0, 6.3); ctx.fill(); }
    // a throne behind the top tier
    if (d.idx >= 6) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-over';
      roundRect(ctx, b.gx - S * 0.62, b.gy - H * 1.15, S * 1.24, H * 1.15, S * 0.14);
      litFill(ctx, '#e0c06f', '#8f6f2f', b.gy - H * 1.15, b.gy);
      ctx.restore();
      radialGlow(ctx, b.gx, b.gy - H * 0.6, S * 1.8, '#ffe9a8', 0.34);
    }
    if (d.idx >= 3) for (let i = 0; i < 4; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 1.8, b.gy - rnd() * H * 1.3, S * 0.1, '#ffffff', 0.8);
  };

  // --- statues and idols -------------------------------------------------
  PAINTERS.statue = (ctx, b, d, rnd) => {
    const g = G(d);
    const S = Math.min(b.tw, b.th) * (0.28 + g * 0.16);
    groundShadow(ctx, b.gx, b.gy, S * 1.1, S * 0.3);
    plinth(ctx, b.gx, b.gy, S * 1.5, S * 0.3, '#b0a894');
    // each tier is a different animal, cycling by index -- the chains describe
    // llamas, tortoises, toads, cougars, deer, rhinos then dragons
    const kinds = ['cat', 'serpent', 'horned', 'cat', 'horned', 'bird', 'wing', 'wing'];
    const kind = kinds[Math.min(kinds.length - 1, d.idx)];
    animalStatue(ctx, b.gx, b.gy - S * 0.3, S * 0.9, d.tint, kind, rnd);
    // gem lustre over the whole thing
    radialGlow(ctx, b.gx - S * 0.2, b.gy - S * 0.9, S * 1.2, shade(d.tint, 0.4), 0.22);
    for (let i = 0; i < 3 + d.idx; i++) {
      sparkle(ctx, b.gx + (rnd() - 0.5) * S * 1.7, b.gy - S * (0.3 + rnd() * 1.1), S * 0.1, '#ffffff', 0.85);
    }
  };

  // --- topiaries ---------------------------------------------------------
  PAINTERS.topiary = (ctx, b, d, rnd) => {
    const g = G(d);
    const S = Math.min(b.tw, b.th) * (0.26 + g * 0.2);
    groundShadow(ctx, b.gx, b.gy, S * 1.1, S * 0.3);
    // stone pot
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.34, b.gy - S * 0.36);
    ctx.lineTo(b.gx + S * 0.34, b.gy - S * 0.36);
    ctx.lineTo(b.gx + S * 0.26, b.gy);
    ctx.lineTo(b.gx - S * 0.26, b.gy);
    ctx.closePath();
    litFill(ctx, '#cfc6b4', '#8f8878', b.gy - S * 0.4, b.gy);
    ctx.strokeStyle = rgba('#5f5a4f', 0.5); ctx.lineWidth = 1; ctx.stroke();
    // the hedge animal: a mass of clipped foliage with a recognisable outline
    const kinds = ['bunny', 'bear', 'rex', 'swan', 'seahorse', 'dolphin', 'unicorn', 'dragon'];
    const kind = kinds[Math.min(kinds.length - 1, d.idx)];
    const cy = b.gy - S * 0.36;
    const foliage = (cx, yy, rx, ry, dark) => {
      blob(ctx, cx, yy, rx, ry, 9, 0.16, rnd);
      ctx.fillStyle = dark ? shade(d.tint, -0.3) : d.tint;
      ctx.fill();
    };
    // body
    foliage(b.gx + S * 0.05, cy - S * 0.42, S * 0.44, S * 0.36, true);
    foliage(b.gx, cy - S * 0.46, S * 0.42, S * 0.34, false);
    // head, placed by kind
    const headPos = {
      bunny: [0.02, 1.0, 0.24], bear: [0.2, 0.92, 0.26], rex: [0.3, 1.0, 0.26],
      swan: [0.3, 1.24, 0.2], seahorse: [0.26, 1.2, 0.2], dolphin: [0.34, 1.06, 0.22],
      unicorn: [0.28, 1.2, 0.24], dragon: [0.32, 1.16, 0.26],
    }[kind];
    foliage(b.gx + S * headPos[0], cy - S * headPos[1], S * headPos[2], S * headPos[2] * 0.9, false);
    // the feature that names it
    ctx.strokeStyle = shade(d.tint, 0.3);
    ctx.lineWidth = Math.max(1.8, S * 0.1); ctx.lineCap = 'round';
    if (kind === 'bunny') {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(b.gx + S * (0.02 + s * 0.1), cy - S * 1.16);
        ctx.quadraticCurveTo(b.gx + S * (0.02 + s * 0.2), cy - S * 1.6, b.gx + S * (0.02 + s * 0.1), cy - S * 1.72);
        ctx.stroke();
      }
    } else if (kind === 'swan' || kind === 'seahorse') {
      ctx.beginPath();
      ctx.moveTo(b.gx + S * 0.1, cy - S * 0.6);
      ctx.quadraticCurveTo(b.gx + S * 0.46, cy - S * 0.96, b.gx + S * 0.28, cy - S * 1.24);
      ctx.stroke();
    } else if (kind === 'unicorn') {
      ctx.strokeStyle = '#fff0c0';
      ctx.beginPath();
      ctx.moveTo(b.gx + S * 0.3, cy - S * 1.38);
      ctx.lineTo(b.gx + S * 0.42, cy - S * 1.86);
      ctx.stroke();
    } else if (kind === 'dragon' || kind === 'rex') {
      // wings / crest
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(b.gx, cy - S * 0.62);
        ctx.quadraticCurveTo(b.gx + s * S * 0.9, cy - S * 1.3, b.gx + s * S * 0.3, cy - S * 0.34);
        ctx.closePath();
        ctx.fillStyle = rgba(shade(d.tint, s > 0 ? -0.14 : 0.22), 0.9);
        ctx.fill();
      }
    } else if (kind === 'dolphin' || kind === 'bear') {
      ctx.beginPath();
      ctx.moveTo(b.gx - S * 0.3, cy - S * 0.8);
      ctx.quadraticCurveTo(b.gx - S * 0.05, cy - S * 1.2, b.gx + S * 0.12, cy - S * 0.86);
      ctx.stroke();
    }
    // clipped-leaf texture
    ctx.strokeStyle = rgba(shade(d.tint, 0.5), 0.4);
    ctx.lineWidth = 1;
    for (let i = 0; i < 16; i++) {
      const px = b.gx + (rnd() - 0.5) * S * 1.0, py = cy - S * (0.2 + rnd() * 1.1);
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (rnd() - 0.5) * S * 0.14, py - S * 0.1); ctx.stroke();
    }
    // little blossoms, more with tier
    for (let i = 0; i < 2 + d.idx; i++) {
      const px = b.gx + (rnd() - 0.5) * S * 1.0, py = cy - S * (0.2 + rnd() * 1.1);
      ctx.fillStyle = mix('#ffffff', hueShift(d.tint, 140), 0.5);
      ctx.beginPath(); ctx.arc(px, py, S * 0.05, 0, 6.3); ctx.fill();
    }
    if (d.idx >= 6) radialGlow(ctx, b.gx, cy - S * 0.7, S * 1.7, shade(d.tint, 0.4), 0.24);
  };

  // --- crystals (soul crystals, gemsteel, lightcrystal) -------------------
  PAINTERS.crystal = (ctx, b, d, rnd) => {
    const g = G(d);
    const S = Math.min(b.tw, b.th) * (0.2 + g * 0.22);
    groundShadow(ctx, b.gx, b.gy, S * 1.3, S * 0.36);
    const n = Math.min(5, 1 + Math.floor(d.idx * 0.8));
    // a rock base from mid-chain: the crystals grow OUT of something
    if (d.idx >= 3) {
      blob(ctx, b.gx, b.gy - S * 0.16, S * 0.7, S * 0.26, 7, 0.2, rnd);
      litFill(ctx, '#8f8a96', '#4f4a58', b.gy - S * 0.42, b.gy);
      ctx.strokeStyle = rgba('#332e3c', 0.5); ctx.lineWidth = 1; ctx.stroke();
    }
    for (let i = 0; i < n; i++) {
      const t = n === 1 ? 0 : (i / (n - 1)) - 0.5;
      const cx = b.gx + t * S * 0.86;
      const h = S * (0.7 + (1 - Math.abs(t) * 1.5) * 0.6) * (0.7 + g * 0.5);
      crystalShard(ctx, cx, b.gy - S * 0.12, S * (0.3 + g * 0.1), h, d.tint, t * 0.42);
      radialGlow(ctx, cx, b.gy - S * 0.12 - h * 0.6, h * 0.7, d.tint, 0.34);
    }
    // a floating mote of light above the tallest, from mid-chain
    if (d.idx >= 4) {
      sphere(ctx, b.gx, b.gy - S * 1.7, S * 0.14, shade(d.tint, 0.4));
      radialGlow(ctx, b.gx, b.gy - S * 1.7, S * 0.7, '#ffffff', 0.4);
    }
    for (let i = 0; i < 4 + d.idx; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 2.2, b.gy - rnd() * S * 1.8, S * 0.1, '#ffffff', 0.8);
  };

  // --- terrariums (mystic plants) ----------------------------------------
  PAINTERS.terrarium = (ctx, b, d, rnd) => {
    const g = G(d);
    const S = Math.min(b.tw, b.th) * (0.22 + g * 0.2);
    groundShadow(ctx, b.gx, b.gy, S * 1.2, S * 0.34);
    const open = d.idx <= 1;
    const H = S * (1.0 + g * 0.5);
    // soil
    ctx.beginPath(); ctx.ellipse(b.gx, b.gy - S * 0.12, S * 0.6, S * 0.18, 0, 0, 6.3);
    litFill(ctx, '#6f4f38', '#3f2c1e', b.gy - S * 0.3, b.gy);
    // the plants inside
    for (let i = 0; i < 2 + d.idx; i++) {
      const px = b.gx + (rnd() - 0.5) * S * 0.8;
      const ph = S * (0.3 + rnd() * 0.5) * (0.7 + g * 0.6);
      ctx.strokeStyle = mix('#4f9e5f', d.tint, 0.4);
      ctx.lineWidth = Math.max(1.4, S * 0.06); ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(px, b.gy - S * 0.14);
      ctx.quadraticCurveTo(px + (rnd() - 0.5) * S * 0.3, b.gy - S * 0.14 - ph * 0.6, px + (rnd() - 0.5) * S * 0.3, b.gy - S * 0.14 - ph);
      ctx.stroke();
      // a cap on top: these are fungal gardens
      ctx.beginPath();
      ctx.ellipse(px, b.gy - S * 0.14 - ph, S * 0.11, S * 0.07, 0, Math.PI, 0);
      ctx.fillStyle = mix('#ffffff', hueShift(d.tint, 40), 0.6); ctx.fill();
    }
    if (!open) {
      // glass dome / bell jar with two specular streaks
      ctx.beginPath();
      ctx.moveTo(b.gx - S * 0.66, b.gy - S * 0.1);
      ctx.lineTo(b.gx - S * 0.6, b.gy - H * 0.62);
      ctx.quadraticCurveTo(b.gx, b.gy - H * 1.15, b.gx + S * 0.6, b.gy - H * 0.62);
      ctx.lineTo(b.gx + S * 0.66, b.gy - S * 0.1);
      ctx.closePath();
      ctx.fillStyle = rgba('#cfe8ff', 0.24);
      ctx.fill();
      ctx.strokeStyle = rgba('#e8f4ff', 0.75); ctx.lineWidth = 1.3; ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.gx - S * 0.38, b.gy - H * 0.28);
      ctx.quadraticCurveTo(b.gx - S * 0.46, b.gy - H * 0.7, b.gx - S * 0.2, b.gy - H * 0.98);
      ctx.stroke();
      // brass rim and knob
      roundRect(ctx, b.gx - S * 0.7, b.gy - S * 0.2, S * 1.4, S * 0.14, S * 0.05);
      litFill(ctx, '#e0c07f', '#8f6f3f', b.gy - S * 0.2, b.gy - S * 0.06);
      if (d.idx >= 4) {
        ctx.beginPath(); ctx.arc(b.gx, b.gy - H * 1.16, S * 0.08, 0, 6.3);
        ctx.fillStyle = '#e0c07f'; ctx.fill();
      }
    }
    radialGlow(ctx, b.gx, b.gy - H * 0.5, S * 1.5, d.tint, 0.2);
    if (d.idx >= 4) for (let i = 0; i < 5; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 1.2, b.gy - S * 0.3 - rnd() * H * 0.8, S * 0.08, '#ffffff', 0.7);
  };

  // --- lanterns ----------------------------------------------------------
  PAINTERS.lantern = (ctx, b, d, rnd) => {
    const g = G(d);
    const S = Math.min(b.tw, b.th) * (0.2 + g * 0.2);
    const H = S * (0.9 + g * 0.5);
    groundShadow(ctx, b.gx, b.gy, S * 1.1, S * 0.3);
    const many = d.idx === 2;
    const shapes = ['drum', 'round', 'trio', 'lotus', 'turtle', 'carp', 'swan', 'panda', 'tiger', 'dragon'];
    const shape = shapes[Math.min(shapes.length - 1, d.idx)];
    const paint = (cx, cy, r) => {
      radialGlow(ctx, cx, cy, r * 3, d.tint, 0.4);
      if (shape === 'drum') {
        roundRect(ctx, cx - r, cy - r * 0.8, r * 2, r * 1.6, r * 0.3);
      } else if (shape === 'lotus') {
        for (let i = 0; i < 8; i++) {
          petal(ctx, cx, cy, r * 1.3, r * 0.5, (i / 8) * 6.283, 0.45);
          litFill(ctx, shade(d.tint, 0.45), shade(d.tint, -0.2), cy - r, cy + r);
        }
        ctx.beginPath(); ctx.arc(cx, cy, r * 0.5, 0, 6.3);
      } else if (shape === 'carp' || shape === 'dragon') {
        ctx.beginPath();
        ctx.moveTo(cx - r * 1.2, cy);
        ctx.quadraticCurveTo(cx - r * 0.3, cy - r * 1.0, cx + r * 0.9, cy - r * 0.36);
        ctx.quadraticCurveTo(cx + r * 1.5, cy - r * 0.1, cx + r * 0.9, cy + r * 0.4);
        ctx.quadraticCurveTo(cx - r * 0.3, cy + r * 0.95, cx - r * 1.2, cy);
        ctx.closePath();
      } else if (shape === 'swan' || shape === 'turtle') {
        ctx.beginPath();
        ctx.ellipse(cx, cy + r * 0.1, r * 1.15, r * 0.72, 0, 0, 6.3);
        ctx.closePath();
      } else {
        ctx.beginPath();
        ctx.ellipse(cx, cy, r * 0.95, r, 0, 0, 6.3);
      }
      litFill(ctx, shade(d.tint, 0.5), shade(d.tint, -0.22), cy - r, cy + r);
      ctx.strokeStyle = rgba(shade(d.tint, -0.55), 0.6); ctx.lineWidth = 1.1; ctx.stroke();
      // paper ribs
      ctx.save(); ctx.clip();
      ctx.strokeStyle = rgba(shade(d.tint, -0.4), 0.4); ctx.lineWidth = 0.9;
      for (let i = -2; i <= 2; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * r * 0.4, cy - r * 1.2);
        ctx.lineTo(cx + i * r * 0.4, cy + r * 1.2);
        ctx.stroke();
      }
      ctx.restore();
      // inner flame
      radialGlow(ctx, cx, cy, r * 0.8, '#fff3c0', 0.7);
      // beast features on the animal lanterns
      if (shape === 'swan' || shape === 'turtle' || shape === 'panda' || shape === 'tiger') {
        ctx.beginPath(); ctx.arc(cx + r * 0.9, cy - r * 0.6, r * 0.32, 0, 6.3);
        litFill(ctx, shade(d.tint, 0.55), shade(d.tint, -0.1), cy - r, cy);
        ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.5); ctx.lineWidth = 0.9; ctx.stroke();
      }
      if (shape === 'dragon' || shape === 'carp') {
        ctx.fillStyle = '#2f2018';
        ctx.beginPath(); ctx.arc(cx + r * 0.72, cy - r * 0.32, r * 0.09, 0, 6.3); ctx.fill();
      }
    };
    if (many) {
      for (let i = 0; i < 3; i++) paint(b.gx + (i - 1) * S * 0.6, b.gy - H * (0.5 + (i === 1 ? 0.22 : 0)), S * 0.28);
    } else {
      paint(b.gx, b.gy - H * 0.62, S * (0.4 + g * 0.16));
    }
    // hanging cord and tassel
    ctx.strokeStyle = rgba('#c9a86f', 0.8); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(b.gx, b.gy - H * 1.5); ctx.lineTo(b.gx, b.gy - H * 1.1); ctx.stroke();
    ctx.strokeStyle = rgba('#e0604f', 0.9); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(b.gx, b.gy - H * 0.16); ctx.lineTo(b.gx, b.gy + H * 0.02); ctx.stroke();
    for (let i = 0; i < 3 + d.idx; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 2, b.gy - rnd() * H * 1.4, S * 0.09, '#ffe9b0', 0.7);
  };

  // --- bonus points ------------------------------------------------------
  PAINTERS.points = (ctx, b, d, rnd) => {
    const g = G(d);
    const R = Math.min(b.tw, b.th) * (0.18 + g * 0.16);
    groundShadow(ctx, b.gx, b.gy, R * 1.4, R * 0.4);
    const cy = b.gy - R * 1.05;
    // a rosette badge: ribbon points behind a disc
    const pts = 6 + Math.min(8, d.idx);
    starPath(ctx, b.gx, cy, pts, R * 1.3, R * 0.95, -Math.PI / 2);
    litFill(ctx, shade(d.tint, 0.35), shade(d.tint, -0.4), cy - R * 1.3, cy + R * 1.3);
    ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.5); ctx.lineWidth = 1; ctx.stroke();
    // disc
    ctx.beginPath(); ctx.arc(b.gx, cy, R * 0.86, 0, 6.3);
    const gr = ctx.createRadialGradient(b.gx - R * 0.3, cy - R * 0.36, R * 0.1, b.gx, cy, R * 0.9);
    gr.addColorStop(0, '#ffffff');
    gr.addColorStop(0.5, shade(d.tint, 0.45));
    gr.addColorStop(1, shade(d.tint, -0.2));
    ctx.fillStyle = gr; ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 1.4; ctx.stroke();
    // pips: how many, in a ring, is the tier read
    const pips = Math.min(9, 1 + Math.floor(d.idx * 0.7));
    ctx.fillStyle = rgba(shade(d.tint, -0.55), 0.85);
    for (let i = 0; i < pips; i++) {
      const a = -Math.PI / 2 + (i / pips) * 6.283;
      ctx.beginPath();
      ctx.arc(b.gx + Math.cos(a) * R * 0.5, cy + Math.sin(a) * R * 0.5, R * 0.13, 0, 6.3);
      ctx.fill();
    }
    ctx.beginPath(); ctx.arc(b.gx, cy, R * 0.2, 0, 6.3);
    ctx.fillStyle = '#fffbe8'; ctx.fill();
    // ribbon tails
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(b.gx + s * R * 0.3, cy + R * 0.9);
      ctx.lineTo(b.gx + s * R * 0.66, b.gy);
      ctx.lineTo(b.gx + s * R * 0.14, b.gy - R * 0.14);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.16), shade(d.tint, -0.44), cy + R, b.gy);
    }
    radialGlow(ctx, b.gx, cy, R * 2.4, d.tint, 0.24);
    for (let i = 0; i < 3 + Math.floor(d.idx / 2); i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 3, cy + (rnd() - 0.5) * R * 2.6, R * 0.12, '#ffffff', 0.85);
  };

  // --- treasures ---------------------------------------------------------
  PAINTERS.treasure = (ctx, b, d, rnd) => {
    const g = G(d);
    const S = Math.min(b.tw, b.th) * (0.22 + g * 0.18);
    groundShadow(ctx, b.gx, b.gy, S * 1.2, S * 0.34);
    const cy = b.gy - S * 0.8;
    if (d.idx === 0) {
      // pendant on a chain
      ctx.strokeStyle = rgba('#e0c07f', 0.9); ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.arc(b.gx, cy - S * 0.1, S * 0.6, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
      starPath(ctx, b.gx, cy + S * 0.4, 4, S * 0.4, S * 0.14, -Math.PI / 2);
      litFill(ctx, '#ffe9a8', '#c98f3f', cy, cy + S * 0.8);
      ctx.strokeStyle = rgba('#8f6f2f', 0.7); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.arc(b.gx, cy + S * 0.4, S * 0.13, 0, 6.3);
      ctx.fillStyle = d.tint; ctx.fill();
    } else if (d.idx === 1) {
      // a plume
      ctx.beginPath();
      ctx.moveTo(b.gx - S * 0.1, b.gy);
      ctx.quadraticCurveTo(b.gx - S * 0.7, cy - S * 0.2, b.gx + S * 0.1, cy - S * 0.8);
      ctx.quadraticCurveTo(b.gx + S * 0.5, cy - S * 0.1, b.gx + S * 0.1, b.gy);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.45), shade(d.tint, -0.34), cy - S * 0.8, b.gy);
      ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.5); ctx.lineWidth = 1; ctx.stroke();
      ctx.strokeStyle = rgba('#ffffff', 0.4); ctx.lineWidth = 0.9;
      for (let i = 0; i < 7; i++) {
        const t = i / 7;
        ctx.beginPath();
        ctx.moveTo(b.gx, b.gy - t * S * 1.5);
        ctx.lineTo(b.gx - S * (0.15 + t * 0.3), b.gy - t * S * 1.5 - S * 0.16);
        ctx.stroke();
      }
    } else if (d.idx === 2) {
      // liquid gem: a droplet with a molten core
      ctx.beginPath();
      ctx.moveTo(b.gx, cy - S * 0.7);
      ctx.bezierCurveTo(b.gx + S * 0.62, cy, b.gx + S * 0.44, cy + S * 0.7, b.gx, cy + S * 0.72);
      ctx.bezierCurveTo(b.gx - S * 0.44, cy + S * 0.7, b.gx - S * 0.62, cy, b.gx, cy - S * 0.7);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.5), shade(d.tint, -0.36), cy - S * 0.7, cy + S * 0.8);
      ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 1.2; ctx.stroke();
      radialGlow(ctx, b.gx, cy + S * 0.2, S * 0.6, '#ffb04f', 0.6);
    } else if (d.idx === 3) {
      // pearl on a shell base
      ctx.beginPath(); ctx.ellipse(b.gx, b.gy - S * 0.18, S * 0.7, S * 0.24, 0, Math.PI, 0);
      litFill(ctx, '#d0c0a8', '#8f8070', b.gy - S * 0.4, b.gy);
      sphere(ctx, b.gx, b.gy - S * 0.66, S * 0.44, d.tint);
      radialGlow(ctx, b.gx, b.gy - S * 0.66, S * 1.3, '#e8e0ff', 0.4);
    } else {
      // a crown: the chain terminus
      const W = S * 1.15;
      ctx.beginPath();
      ctx.moveTo(b.gx - W / 2, b.gy - S * 0.16);
      ctx.lineTo(b.gx - W / 2, b.gy - S * 0.7);
      for (let i = 0; i < 5; i++) {
        const x0 = b.gx - W / 2 + (W / 5) * i;
        ctx.lineTo(x0 + W / 10, b.gy - S * 1.3);
        ctx.lineTo(x0 + W / 5, b.gy - S * 0.7);
      }
      ctx.lineTo(b.gx + W / 2, b.gy - S * 0.16);
      ctx.closePath();
      litFill(ctx, '#fff0a8', '#c9922f', b.gy - S * 1.3, b.gy);
      ctx.strokeStyle = rgba('#8f6a20', 0.7); ctx.lineWidth = 1.2; ctx.stroke();
      // band jewels
      for (let i = 0; i < 5; i++) {
        const px = b.gx - W * 0.4 + i * W * 0.2;
        ctx.beginPath(); ctx.arc(px, b.gy - S * 0.44, S * 0.1, 0, 6.3);
        ctx.fillStyle = ['#e0384f', '#49a8e8', '#5fe08f', '#a95fe0', '#ff9f3f'][i];
        ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 0.8; ctx.stroke();
      }
      for (let i = 0; i < 5; i++) {
        sparkle(ctx, b.gx - W * 0.4 + i * W * 0.2, b.gy - S * 1.24, S * 0.14, '#ffffff', 0.9);
      }
    }
    radialGlow(ctx, b.gx, cy, S * 1.8, shade(d.tint, 0.3), 0.24);
    for (let i = 0; i < 4 + d.idx; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 2.4, b.gy - rnd() * S * 1.8, S * 0.11, '#ffffff', 0.8);
  };

  // --- artefacts ---------------------------------------------------------
  PAINTERS.artefact = (ctx, b, d, rnd) => {
    const g = G(d);
    const S = Math.min(b.tw, b.th) * (0.24 + g * 0.16);
    groundShadow(ctx, b.gx, b.gy, S * 1.1, S * 0.32);
    const cy = b.gy - S * 1.0;
    // a floating ring, tilted, with the artefact hanging inside it
    ctx.save();
    ctx.translate(b.gx, cy);
    ctx.rotate(-0.2);
    for (let k = 0; k < 2; k++) {
      ctx.beginPath();
      ctx.ellipse(0, 0, S * (0.8 - k * 0.18), S * (0.34 - k * 0.1), k * 0.7, 0, 6.3);
      ctx.strokeStyle = rgba(k ? shade(d.tint, 0.5) : '#e0c07f', 0.85);
      ctx.lineWidth = Math.max(1.6, S * 0.07);
      ctx.stroke();
    }
    ctx.restore();
    // the artefact: a crescent, then a stacked stone, then a spike
    if (d.idx <= 0) {
      ctx.beginPath();
      ctx.arc(b.gx, cy, S * 0.44, Math.PI * 0.25, Math.PI * 1.75);
      ctx.arc(b.gx + S * 0.14, cy, S * 0.34, Math.PI * 1.75, Math.PI * 0.25, true);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.5), shade(d.tint, -0.3), cy - S * 0.5, cy + S * 0.5);
    } else if (d.idx <= 2) {
      for (let i = 0; i < 3; i++) {
        const w = S * (0.5 - i * 0.1), h = S * 0.2;
        const y = cy + S * 0.3 - i * h * 1.1;
        ctx.beginPath();
        ctx.moveTo(b.gx - w, y); ctx.lineTo(b.gx + w, y);
        ctx.lineTo(b.gx + w * 0.82, y - h); ctx.lineTo(b.gx - w * 0.82, y - h);
        ctx.closePath();
        litFill(ctx, shade(d.tint, 0.4 - i * 0.1), shade(d.tint, -0.34), y - h, y);
        ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.5); ctx.lineWidth = 0.9; ctx.stroke();
      }
    } else {
      crystalShard(ctx, b.gx, cy + S * 0.5, S * 0.5, S * 1.05, d.tint, 0);
    }
    ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 1;
    ctx.stroke();
    radialGlow(ctx, b.gx, cy, S * 2.2, shade(d.tint, 0.3), 0.34);
    for (let i = 0; i < 8 + d.idx * 2; i++) {
      const a = rnd() * 6.283, rr = S * (0.6 + rnd() * 1.3);
      sparkle(ctx, b.gx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.7, S * 0.1, '#ffffff', 0.75);
    }
  };

  // --- healing goddesses -------------------------------------------------
  PAINTERS.goddess = (ctx, b, d, rnd) => {
    const g = G(d);
    const S = Math.min(b.tw, b.th) * (0.24 + g * 0.14);
    const H = S * (1.5 + g * 0.5);
    groundShadow(ctx, b.gx, b.gy, S * 1.0, S * 0.3);
    plinth(ctx, b.gx, b.gy, S * 1.3, S * 0.24, '#c0bcb0');
    const base = b.gy - S * 0.24;
    // robe: a tall bell with folds
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.52, base);
    ctx.quadraticCurveTo(b.gx - S * 0.34, base - H * 0.5, b.gx - S * 0.2, base - H * 0.72);
    ctx.lineTo(b.gx + S * 0.2, base - H * 0.72);
    ctx.quadraticCurveTo(b.gx + S * 0.34, base - H * 0.5, b.gx + S * 0.52, base);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.32), base - H * 0.72, base);
    ctx.strokeStyle = rgba('#8f96a8', 0.55); ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = rgba('#8f96a8', 0.4); ctx.lineWidth = 0.9;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(b.gx + i * S * 0.16, base - H * 0.68);
      ctx.quadraticCurveTo(b.gx + i * S * 0.3, base - H * 0.3, b.gx + i * S * 0.36, base);
      ctx.stroke();
    }
    // arms raised, cupping the light
    ctx.strokeStyle = shade(d.tint, 0.36);
    ctx.lineWidth = Math.max(2, S * 0.1); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(b.gx + s * S * 0.16, base - H * 0.66);
      ctx.quadraticCurveTo(b.gx + s * S * 0.44, base - H * 0.8, b.gx + s * S * 0.24, base - H * 1.02);
      ctx.stroke();
    }
    // head + halo
    ctx.beginPath(); ctx.arc(b.gx, base - H * 0.84, S * 0.18, 0, 6.3);
    litFill(ctx, '#f4e8d8', '#c0b0a0', base - H * 1.02, base - H * 0.66);
    ctx.strokeStyle = rgba('#8f8478', 0.5); ctx.lineWidth = 0.9; ctx.stroke();
    const halo = S * (0.34 + d.idx * 0.05);
    ctx.strokeStyle = rgba('#fff6d0', 0.9);
    ctx.lineWidth = Math.max(1.4, S * 0.05);
    ctx.beginPath(); ctx.ellipse(b.gx, base - H * 0.92, halo, halo * 0.36, 0, 0, 6.3); ctx.stroke();
    // the light she holds: bigger with every tier
    const orbR = S * (0.16 + d.idx * 0.055);
    sphere(ctx, b.gx, base - H * 1.1, orbR, '#c9ffe0');
    radialGlow(ctx, b.gx, base - H * 1.1, orbR * 4.5, '#8affc8', 0.42);
    // wings from tier 3 up: the silhouette changes, not just the glow
    if (d.idx >= 2) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(b.gx + s * S * 0.14, base - H * 0.62);
        ctx.quadraticCurveTo(b.gx + s * S * (0.9 + d.idx * 0.1), base - H * 1.1, b.gx + s * S * 0.5, base - H * 0.16);
        ctx.quadraticCurveTo(b.gx + s * S * 0.4, base - H * 0.44, b.gx + s * S * 0.14, base - H * 0.62);
        ctx.closePath();
        ctx.fillStyle = rgba('#f0f8ff', s > 0 ? 0.5 : 0.72);
        ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 0.9; ctx.stroke();
      }
    }
    for (let i = 0; i < 6 + d.idx * 3; i++) {
      const a = rnd() * 6.283, rr = S * (0.5 + rnd() * 1.6);
      sparkle(ctx, b.gx + Math.cos(a) * rr, base - H * 0.8 + Math.sin(a) * rr * 0.8, S * 0.09, '#c9ffe0', 0.8);
    }
  };

  // --- storage buildings -------------------------------------------------
  PAINTERS.vault = (ctx, b, d, rnd) => {
    const g = G(d);
    const W = b.tw * (0.4 + g * 0.2), H = b.th * (0.24 + g * 0.22);
    groundShadow(ctx, b.gx, b.gy, W * 0.85, W * 0.24);
    const box = buildingBox(ctx, b.gx, b.gy, W, H, d.tint, 0.24);
    // iron bands, more with tier
    ctx.strokeStyle = rgba('#4f4238', 0.75);
    ctx.lineWidth = Math.max(1.6, H * 0.05);
    const bands = 2 + Math.min(3, Math.floor(d.idx / 2));
    for (let i = 1; i <= bands; i++) {
      const y = box.top + (H / (bands + 1)) * i;
      ctx.beginPath(); ctx.moveTo(box.fx, y); ctx.lineTo(box.fx + box.fw, y); ctx.stroke();
    }
    // the vault door: a round hatch with a wheel
    const cx = box.fx + box.fw * 0.5, cy = box.top + H * 0.52;
    const R = Math.min(box.fw, H) * 0.3;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 6.3);
    litFill(ctx, '#b0a89a', '#5f584e', cy - R, cy + R);
    ctx.strokeStyle = rgba('#332e28', 0.7); ctx.lineWidth = 1.3; ctx.stroke();
    ctx.strokeStyle = rgba('#e8e0cf', 0.7); ctx.lineWidth = Math.max(1.4, R * 0.16);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 4 + 0.3;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(a) * R * 0.72, cy - Math.sin(a) * R * 0.72);
      ctx.lineTo(cx + Math.cos(a) * R * 0.72, cy + Math.sin(a) * R * 0.72);
      ctx.stroke();
    }
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.2, 0, 6.3);
    ctx.fillStyle = '#e8c05f'; ctx.fill();
    // roof: flat for low tiers, domed with a coin finial high up
    if (d.idx >= 5) {
      ctx.beginPath();
      ctx.ellipse(b.gx, box.top, W * 0.44, H * 0.34, 0, Math.PI, 0);
      ctx.closePath();
      litFill(ctx, '#e8c05f', '#8f6f2f', box.top - H * 0.34, box.top);
      ctx.strokeStyle = rgba('#5f4a20', 0.6); ctx.lineWidth = 1; ctx.stroke();
    } else {
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.56, box.top);
      ctx.lineTo(b.gx + W * 0.5, box.top);
      ctx.lineTo(b.gx + W * 0.4, box.top - H * 0.16);
      ctx.lineTo(b.gx - W * 0.46, box.top - H * 0.16);
      ctx.closePath();
      litFill(ctx, '#8f8478', '#4f4a42', box.top - H * 0.2, box.top);
    }
    // the coin on the side that says it is ready to collect (wiki detail)
    const coinY = box.top + H * 0.2;
    ctx.beginPath(); ctx.arc(box.fx + box.fw * 0.16, coinY, Math.max(3, W * 0.06), 0, 6.3);
    litFill(ctx, '#ffe066', '#c9922f', coinY - W * 0.06, coinY + W * 0.06);
    ctx.strokeStyle = rgba('#8f6a20', 0.8); ctx.lineWidth = 0.9; ctx.stroke();
    radialGlow(ctx, box.fx + box.fw * 0.16, coinY, W * 0.2, '#ffe066', 0.45);
    // spilling coins at the foot, more with tier
    for (let i = 0; i < 2 + d.idx; i++) {
      const px = b.gx + (rnd() - 0.5) * W * 1.1, py = b.gy - rnd() * H * 0.1;
      ctx.beginPath(); ctx.ellipse(px, py, Math.max(2, W * 0.045), Math.max(1.2, W * 0.022), 0, 0, 6.3);
      ctx.fillStyle = '#ffd24f'; ctx.fill();
      ctx.strokeStyle = rgba('#8f6a20', 0.6); ctx.lineWidth = 0.6; ctx.stroke();
    }
  };

  PAINTERS.yard = (ctx, b, d, rnd) => {
    const g = G(d);
    const W = b.tw * (0.44 + g * 0.2), H = b.th * (0.2 + g * 0.18);
    groundShadow(ctx, b.gx, b.gy, W * 0.9, W * 0.24);
    // a low walled yard, seen from slightly above: back wall then a brick pile
    ctx.beginPath();
    ctx.moveTo(b.gx - W / 2, b.gy - H * 0.3);
    ctx.lineTo(b.gx - W * 0.42, b.gy - H);
    ctx.lineTo(b.gx + W * 0.42, b.gy - H);
    ctx.lineTo(b.gx + W / 2, b.gy - H * 0.3);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.22), shade(d.tint, -0.36), b.gy - H, b.gy);
    ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.55); ctx.lineWidth = 1; ctx.stroke();
    // course lines
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.45); ctx.lineWidth = 0.9;
    for (let i = 1; i < 4; i++) {
      const y = b.gy - H + (H * 0.7 / 4) * i;
      ctx.beginPath(); ctx.moveTo(b.gx - W, y); ctx.lineTo(b.gx + W, y); ctx.stroke();
      for (let k = -3; k <= 3; k++) {
        const x = b.gx + k * W * 0.16 + (i % 2 ? W * 0.08 : 0);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x, y + H * 0.18); ctx.stroke();
      }
    }
    ctx.restore();
    // the stack of dressed bricks inside, taller with tier
    const rows = 2 + Math.min(4, Math.floor(d.idx * 0.7));
    const bw = W * 0.2, bh = H * 0.2;
    for (let r2 = 0; r2 < rows; r2++) {
      const cols = Math.max(1, 3 - Math.floor(r2 / 2));
      for (let c = 0; c < cols; c++) {
        const x = b.gx - (cols - 1) * bw * 0.5 + c * bw + (r2 % 2 ? bw * 0.14 : 0);
        const y = b.gy - H * 0.28 - r2 * bh * 0.94;
        roundRect(ctx, x - bw * 0.48, y - bh, bw * 0.96, bh, bh * 0.16);
        litFill(ctx, shade('#c8b48f', 0.24), shade('#c8b48f', -0.34), y - bh, y);
        ctx.strokeStyle = rgba('#6f6248', 0.6); ctx.lineWidth = 0.8; ctx.stroke();
      }
    }
    // a shovel leaning against the wall from mid-chain
    if (d.idx >= 3) {
      ctx.strokeStyle = '#a8784f'; ctx.lineWidth = Math.max(1.6, W * 0.028); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(b.gx + W * 0.4, b.gy); ctx.lineTo(b.gx + W * 0.3, b.gy - H * 1.05); ctx.stroke();
      ctx.beginPath();
      ctx.ellipse(b.gx + W * 0.4, b.gy - H * 0.04, W * 0.05, H * 0.1, 0.2, 0, 6.3);
      ctx.fillStyle = '#9aa0a8'; ctx.fill();
    }
    if (d.idx >= 6) radialGlow(ctx, b.gx, b.gy - H * 0.6, W * 1.2, '#c9b8ff', 0.2);
  };

  // --- leftovers ---------------------------------------------------------
  PAINTERS.leftover = (ctx, b, d, rnd) => {
    const S = T * 0.24;
    groundShadow(ctx, b.gx, b.gy, S * 1.5, S * 0.42);
    const coins = d.leftover === 'coins';
    // a spilled heap in a burlap sack, so it reads as "not collected"
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.7, b.gy);
    ctx.quadraticCurveTo(b.gx - S * 0.9, b.gy - S * 0.7, b.gx - S * 0.3, b.gy - S * 0.9);
    ctx.lineTo(b.gx + S * 0.3, b.gy - S * 0.9);
    ctx.quadraticCurveTo(b.gx + S * 0.9, b.gy - S * 0.7, b.gx + S * 0.7, b.gy);
    ctx.closePath();
    litFill(ctx, '#c9b490', '#8f7c5c', b.gy - S, b.gy);
    ctx.strokeStyle = rgba('#5f5240', 0.65); ctx.lineWidth = 1.1; ctx.stroke();
    // sack mouth, tied open
    ctx.beginPath(); ctx.ellipse(b.gx, b.gy - S * 0.9, S * 0.34, S * 0.13, 0, 0, 6.3);
    ctx.fillStyle = '#6f5f48'; ctx.fill();
    // the contents piled above the mouth
    for (let i = 0; i < 8; i++) {
      const px = b.gx + (rnd() - 0.5) * S * 0.7, py = b.gy - S * (0.95 + rnd() * 0.4);
      if (coins) {
        ctx.beginPath(); ctx.ellipse(px, py, S * 0.16, S * 0.08, rnd() * 0.6, 0, 6.3);
        litFill(ctx, '#ffe066', '#c9922f', py - S * 0.1, py + S * 0.1);
      } else {
        roundRect(ctx, px - S * 0.16, py - S * 0.1, S * 0.32, S * 0.2, S * 0.04);
        litFill(ctx, '#d8c8a0', '#8f8068', py - S * 0.1, py + S * 0.1);
      }
      ctx.strokeStyle = rgba('#5f5240', 0.6); ctx.lineWidth = 0.7; ctx.stroke();
    }
    // the crossed-out storage tag: this is what a full store looks like
    const tx = b.gx + S * 0.68, ty = b.gy - S * 1.25;
    roundRect(ctx, tx - S * 0.34, ty - S * 0.26, S * 0.68, S * 0.52, S * 0.14);
    ctx.fillStyle = rgba('#3a2a34', 0.82); ctx.fill();
    ctx.strokeStyle = rgba('#ff8f8f', 0.9); ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(tx - S * 0.2, ty - S * 0.16); ctx.lineTo(tx + S * 0.2, ty + S * 0.16);
    ctx.moveTo(tx + S * 0.2, ty - S * 0.16); ctx.lineTo(tx - S * 0.2, ty + S * 0.16);
    ctx.stroke();
    radialGlow(ctx, b.gx, b.gy - S * 0.9, S * 1.6, coins ? '#ffd24f' : '#c8b48f', 0.2);
  };

  // --- dimensional jars --------------------------------------------------
  PAINTERS.jar = (ctx, b, d, rnd) => {
    const W = Math.min(b.tw, b.th) * 0.62, H = Math.min(b.tw, b.th) * 0.86;
    groundShadow(ctx, b.gx, b.gy, W * 0.8, W * 0.24);
    // glass body
    ctx.beginPath();
    ctx.moveTo(b.gx - W / 2, b.gy - H * 0.1);
    ctx.quadraticCurveTo(b.gx - W * 0.62, b.gy - H * 0.6, b.gx - W * 0.3, b.gy - H * 0.9);
    ctx.lineTo(b.gx + W * 0.3, b.gy - H * 0.9);
    ctx.quadraticCurveTo(b.gx + W * 0.62, b.gy - H * 0.6, b.gx + W / 2, b.gy - H * 0.1);
    ctx.quadraticCurveTo(b.gx, b.gy + H * 0.06, b.gx - W / 2, b.gy - H * 0.1);
    ctx.closePath();
    ctx.fillStyle = rgba('#bfe8ff', 0.26);
    ctx.fill();
    // the swirl of held content inside
    ctx.save();
    ctx.clip();
    radialGlow(ctx, b.gx, b.gy - H * 0.44, W * 0.62, '#ffffff', 0.6);
    for (let i = 0; i < 3; i++) {
      ctx.strokeStyle = rgba(['#ffd0f0', '#c9e8ff', '#d8ffd0'][i], 0.7);
      ctx.lineWidth = W * 0.07;
      ctx.beginPath();
      for (let k = 0; k <= 24; k++) {
        const t = k / 24, a = t * 6.283 * 1.4 + i * 2.1, rr = W * (0.08 + t * 0.32);
        const x = b.gx + Math.cos(a) * rr, y = b.gy - H * 0.44 + Math.sin(a) * rr * 0.85;
        k ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
      }
      ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = rgba('#e8f6ff', 0.85); ctx.lineWidth = 1.4;
    ctx.stroke();
    // specular streak
    ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 0.26, b.gy - H * 0.24);
    ctx.quadraticCurveTo(b.gx - W * 0.36, b.gy - H * 0.6, b.gx - W * 0.16, b.gy - H * 0.82);
    ctx.stroke();
    // cork stopper and brass collar
    roundRect(ctx, b.gx - W * 0.24, b.gy - H * 1.06, W * 0.48, H * 0.18, W * 0.06);
    litFill(ctx, '#d8a86f', '#8f6a3f', b.gy - H * 1.06, b.gy - H * 0.88);
    ctx.strokeStyle = rgba('#5f4520', 0.7); ctx.lineWidth = 1; ctx.stroke();
    roundRect(ctx, b.gx - W * 0.32, b.gy - H * 0.94, W * 0.64, H * 0.09, W * 0.03);
    litFill(ctx, '#e8c884', '#8f6f30', b.gy - H * 0.94, b.gy - H * 0.85);
    // the gem price tag floating over it
    const gy2 = b.gy - H * 1.3;
    starPath(ctx, b.gx, gy2, 4, W * 0.2, W * 0.07, -Math.PI / 2);
    litFill(ctx, '#ffb0e8', '#c94f9f', gy2 - W * 0.2, gy2 + W * 0.2);
    ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 0.9; ctx.stroke();
    radialGlow(ctx, b.gx, gy2, W * 0.6, '#ff9fe0', 0.5);
    for (let i = 0; i < 7; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * W * 1.9, b.gy - rnd() * H * 1.1, W * 0.08, '#ffffff', 0.8);
  };

  // --- fluffs ------------------------------------------------------------
  PAINTERS.fluff = (ctx, b, d, rnd) => {
    const g = G(d);
    const R = Math.min(b.tw, b.th) * (0.2 + g * 0.16);
    groundShadow(ctx, b.gx, b.gy, R * 1.3, R * 0.36);
    const cy = b.gy - R * 0.86;
    // fur silhouette: a blob with a spiky rim so it reads as fluff not a ball
    ctx.save();
    blob(ctx, b.gx, cy, R, R * 0.92, 14, 0.13, rnd);
    litFill(ctx, shade(d.tint, 0.36), shade(d.tint, -0.3), cy - R, cy + R);
    ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.5); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    ctx.strokeStyle = rgba(shade(d.tint, 0.5), 0.6);
    ctx.lineWidth = 1.1; ctx.lineCap = 'round';
    for (let i = 0; i < 26; i++) {
      const a = rnd() * 6.283, rr = R * (0.8 + rnd() * 0.2);
      ctx.beginPath();
      ctx.moveTo(b.gx + Math.cos(a) * rr * 0.8, cy + Math.sin(a) * rr * 0.75);
      ctx.lineTo(b.gx + Math.cos(a) * rr * 1.18, cy + Math.sin(a) * rr * 1.1);
      ctx.stroke();
    }
    // face: eyes that close on the sleeping top tier
    const sleeping = d.idx >= 3;
    ctx.strokeStyle = '#3a2a24'; ctx.lineWidth = Math.max(1.4, R * 0.06);
    for (const s of [-1, 1]) {
      if (sleeping) {
        ctx.beginPath();
        ctx.arc(b.gx + s * R * 0.26, cy - R * 0.06, R * 0.13, 0.3, Math.PI - 0.3);
        ctx.stroke();
      } else {
        ctx.fillStyle = '#3a2a24';
        ctx.beginPath(); ctx.arc(b.gx + s * R * 0.26, cy - R * 0.1, R * 0.09, 0, 6.3); ctx.fill();
        ctx.fillStyle = rgba('#ffffff', 0.9);
        ctx.beginPath(); ctx.arc(b.gx + s * R * 0.29, cy - R * 0.14, R * 0.035, 0, 6.3); ctx.fill();
      }
    }
    // nose + blush
    ctx.fillStyle = '#c9707f';
    ctx.beginPath(); ctx.ellipse(b.gx, cy + R * 0.12, R * 0.09, R * 0.07, 0, 0, 6.3); ctx.fill();
    for (const s of [-1, 1]) {
      radialGlow(ctx, b.gx + s * R * 0.5, cy + R * 0.12, R * 0.26, '#ff9fb0', 0.4);
    }
    // little feet
    ctx.fillStyle = shade(d.tint, -0.24);
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.ellipse(b.gx + s * R * 0.34, b.gy - R * 0.05, R * 0.18, R * 0.09, 0, 0, 6.3); ctx.fill();
    }
    if (sleeping) {
      // Zs
      ctx.fillStyle = rgba('#ffffff', 0.8);
      ctx.font = `${Math.round(R * 0.4)}px system-ui`;
      ctx.fillText('z', b.gx + R * 0.9, cy - R * 0.8);
      ctx.font = `${Math.round(R * 0.28)}px system-ui`;
      ctx.fillText('z', b.gx + R * 1.2, cy - R * 1.05);
    }
    if (d.idx >= 2) radialGlow(ctx, b.gx, cy, R * 2, shade(d.tint, 0.4), 0.24);
  };

  // --- Midas trees -------------------------------------------------------
  PAINTERS.midas = (ctx, b, d, rnd) => {
    const g = G(d);
    const H = b.th * (0.5 + g * 0.42);
    const R = b.tw * (0.24 + g * 0.2);
    groundShadow(ctx, b.gx, b.gy, R * 1.3, R * 0.4);
    // golden roots gripping the ground
    ctx.strokeStyle = '#c9922f'; ctx.lineWidth = Math.max(2, R * 0.1); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(b.gx, b.gy - H * 0.08);
      ctx.quadraticCurveTo(b.gx + s * R * 0.5, b.gy - H * 0.02, b.gx + s * R * 0.85, b.gy);
      ctx.stroke();
    }
    // trunk: two twisting metal columns that fuse
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(b.gx + s * R * 0.2, b.gy);
      ctx.bezierCurveTo(b.gx + s * R * 0.32, b.gy - H * 0.3, b.gx - s * R * 0.14, b.gy - H * 0.45, b.gx + s * R * 0.06, b.gy - H * 0.68);
      ctx.lineTo(b.gx + s * R * 0.2, b.gy - H * 0.68);
      ctx.bezierCurveTo(b.gx + s * R * 0.06, b.gy - H * 0.44, b.gx + s * R * 0.44, b.gy - H * 0.3, b.gx + s * R * 0.34, b.gy);
      ctx.closePath();
      litFill(ctx, '#ffe9a8', '#8f6a20', b.gy - H * 0.7, b.gy);
      ctx.strokeStyle = rgba('#6f4f18', 0.6); ctx.lineWidth = 1; ctx.stroke();
    }
    // branches: metal arms that curl in and hold the crystal
    const arms = 2 + Math.min(4, Math.floor(d.idx / 2));
    ctx.strokeStyle = '#e8c25f';
    ctx.lineWidth = Math.max(1.8, R * 0.075);
    for (let i = 0; i < arms; i++) {
      const t = (i / (arms - 1 || 1)) - 0.5;
      ctx.beginPath();
      ctx.moveTo(b.gx, b.gy - H * 0.62);
      ctx.quadraticCurveTo(b.gx + t * R * 1.5, b.gy - H * 0.86, b.gx + t * R * 0.7, b.gy - H * 1.06);
      ctx.stroke();
      // a gold leaf on each arm
      leafPath(ctx, b.gx + t * R * 0.7, b.gy - H * 1.06, R * 0.34, R * 0.16, t * 1.4);
      litFill(ctx, '#fff0b0', '#c9922f', b.gy - H * 1.3, b.gy - H * 0.9);
    }
    // the crystal the chain is really about, from tier 6 on
    if (d.idx >= 5) {
      const cr = R * (0.22 + (d.idx - 5) * 0.05);
      sphere(ctx, b.gx, b.gy - H * 1.06, cr, '#bfe8ff');
      radialGlow(ctx, b.gx, b.gy - H * 1.06, cr * 4, '#dff4ff', 0.42);
      // moons orbiting the crystal on the high tiers
      if (d.idx >= 8) {
        for (let i = 0; i < 3; i++) {
          const a = i * 2.1 + 0.4;
          const mx = b.gx + Math.cos(a) * cr * 2.2, my = b.gy - H * 1.06 + Math.sin(a) * cr * 0.9;
          sphere(ctx, mx, my, cr * 0.24, '#fff2d0');
        }
      }
    } else {
      // early tiers: a gold canopy blob instead
      blob(ctx, b.gx, b.gy - H * 0.94, R * 0.66, R * 0.5, 8, 0.18, rnd);
      litFill(ctx, '#ffe9a8', '#b0842a', b.gy - H * 1.3, b.gy - H * 0.7);
    }
    for (let i = 0; i < 6 + d.idx; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2.6, b.gy - H * (0.4 + rnd() * 0.9), R * 0.11, '#fff6d0', 0.85);
  };

  // --- glowing dragon trees ----------------------------------------------
  PAINTERS.glowtree = (ctx, b, d, rnd) => {
    const g = G(d);
    const H = b.th * (0.48 + g * 0.44);
    const R = b.tw * (0.24 + g * 0.22);
    groundShadow(ctx, b.gx, b.gy, R * 1.3, R * 0.4);
    radialGlow(ctx, b.gx, b.gy - H * 0.72, R * 3, d.tint, 0.26);
    // pale trunk with luminous seams
    ctx.beginPath();
    ctx.moveTo(b.gx - R * 0.28, b.gy);
    ctx.quadraticCurveTo(b.gx - R * 0.16, b.gy - H * 0.4, b.gx - R * 0.14, b.gy - H * 0.62);
    ctx.lineTo(b.gx + R * 0.14, b.gy - H * 0.62);
    ctx.quadraticCurveTo(b.gx + R * 0.16, b.gy - H * 0.4, b.gx + R * 0.28, b.gy);
    ctx.closePath();
    litFill(ctx, '#e8e0d0', '#8f8878', b.gy - H * 0.62, b.gy);
    ctx.strokeStyle = rgba('#5f5a4f', 0.5); ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = rgba(shade(d.tint, 0.5), 0.9); ctx.lineWidth = Math.max(1.4, R * 0.05);
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(b.gx + i * R * 0.1, b.gy - H * 0.06);
      ctx.quadraticCurveTo(b.gx + i * R * 0.2, b.gy - H * 0.34, b.gx + i * R * 0.07, b.gy - H * 0.6);
      ctx.stroke();
    }
    // canopy: hanging luminous strands rather than a solid mass, which is what
    // makes this chain read differently from the ordinary Dragon Tree
    const strands = 7 + Math.min(9, d.idx * 2);
    for (let i = 0; i < strands; i++) {
      const t = (i / (strands - 1)) - 0.5;
      const sx = b.gx + t * R * 1.7;
      const top = b.gy - H * (0.62 + 0.28 * (1 - Math.abs(t) * 1.3));
      const len = H * (0.18 + rnd() * 0.3);
      ctx.strokeStyle = rgba(shade(d.tint, 0.2), 0.85);
      ctx.lineWidth = Math.max(1.2, R * 0.035);
      ctx.beginPath();
      ctx.moveTo(b.gx + t * R * 0.5, b.gy - H * 0.62);
      ctx.quadraticCurveTo(sx, top, sx + t * R * 0.1, top + len);
      ctx.stroke();
      // amber bead at the tip -- the wiki says these are the only source of Amber
      const bx = sx + t * R * 0.1, by = top + len;
      radialGlow(ctx, bx, by, R * 0.22, '#ffd08f', 0.6);
      ctx.beginPath(); ctx.arc(bx, by, R * 0.065, 0, 6.3);
      ctx.fillStyle = '#ffe9c0'; ctx.fill();
    }
    // a bright crown mass above the strands
    blob(ctx, b.gx, b.gy - H * 0.92, R * 0.8, R * 0.4, 9, 0.2, rnd);
    ctx.fillStyle = rgba(shade(d.tint, 0.35), 0.55); ctx.fill();
    for (let i = 0; i < 7 + d.idx; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 3, b.gy - H * (0.4 + rnd() * 0.8), R * 0.1, '#ffffff', 0.7);
  };

  // --- grimm / shadow / spooky trees -------------------------------------
  PAINTERS.grimm = (ctx, b, d, rnd) => {
    const g = G(d);
    const H = b.th * (0.5 + g * 0.44);
    const R = b.tw * (0.24 + g * 0.24);
    groundShadow(ctx, b.gx, b.gy, R * 1.4, R * 0.4);
    // bare gnarled trunk that forks
    const drawLimb = (x, y, a, len, w, depth) => {
      const ex = x + Math.cos(a) * len, ey = y + Math.sin(a) * len;
      ctx.beginPath();
      ctx.moveTo(x - Math.sin(a) * w, y + Math.cos(a) * w);
      ctx.quadraticCurveTo(
        (x + ex) / 2 - Math.sin(a) * w * 0.5 + (rnd() - 0.5) * len * 0.2,
        (y + ey) / 2 + Math.cos(a) * w * 0.5,
        ex, ey);
      ctx.quadraticCurveTo(
        (x + ex) / 2 + Math.sin(a) * w * 0.6,
        (y + ey) / 2 - Math.cos(a) * w * 0.6,
        x + Math.sin(a) * w, y - Math.cos(a) * w);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.2), shade(d.tint, -0.5), ey, y);
      ctx.strokeStyle = rgba(shade(d.tint, -0.65), 0.55); ctx.lineWidth = 0.9; ctx.stroke();
      if (depth <= 0) return;
      const spread = 0.5 + rnd() * 0.4;
      drawLimb(ex, ey, a - spread, len * 0.66, w * 0.6, depth - 1);
      drawLimb(ex, ey, a + spread * 0.8, len * 0.7, w * 0.62, depth - 1);
      if (depth >= 2 && rnd() < 0.5) drawLimb(ex, ey, a + (rnd() - 0.5) * 0.4, len * 0.55, w * 0.5, depth - 1);
    };
    drawLimb(b.gx, b.gy, -Math.PI / 2 + (rnd() - 0.5) * 0.2, H * 0.42, R * 0.2, 2 + Math.min(2, Math.floor(d.idx / 4)));
    // sparse leaf wisps, never a full canopy
    const wisps = Math.min(14, 2 + d.idx * 2);
    for (let i = 0; i < wisps; i++) {
      const a = -Math.PI / 2 + (rnd() - 0.5) * 2.4;
      const rr = R * (0.5 + rnd() * 0.9);
      const wx = b.gx + Math.cos(a) * rr, wy = b.gy - H * 0.72 + Math.sin(a) * rr * 0.6;
      ctx.save();
      ctx.globalAlpha = 0.5 + rnd() * 0.3;
      blob(ctx, wx, wy, R * 0.2, R * 0.11, 6, 0.3, rnd, a);
      ctx.fillStyle = shade(d.tint, 0.24);
      ctx.fill();
      ctx.restore();
    }
    // roots clawing outward
    ctx.strokeStyle = shade(d.tint, -0.4); ctx.lineWidth = Math.max(1.6, R * 0.07); ctx.lineCap = 'round';
    for (let i = -2; i <= 2; i++) {
      if (!i) continue;
      ctx.beginPath();
      ctx.moveTo(b.gx, b.gy - H * 0.05);
      ctx.quadraticCurveTo(b.gx + i * R * 0.4, b.gy - H * 0.02, b.gx + i * R * 0.62, b.gy);
      ctx.stroke();
    }
    // spirits in the branches on the higher tiers
    if (d.idx >= 5) {
      for (let i = 0; i < 1 + Math.floor((d.idx - 5) / 2); i++) {
        const sx = b.gx + (rnd() - 0.5) * R * 1.6, sy = b.gy - H * (0.6 + rnd() * 0.4);
        radialGlow(ctx, sx, sy, R * 0.42, '#a8ffd0', 0.4);
        ctx.save();
        ctx.globalAlpha = 0.5;
        blob(ctx, sx, sy, R * 0.1, R * 0.14, 7, 0.2, rnd);
        ctx.fillStyle = '#dfffe8'; ctx.fill();
        ctx.restore();
      }
    }
    if (d.idx >= 3) radialGlow(ctx, b.gx, b.gy - H * 0.6, R * 2.4, d.tint, 0.16);
  };

  // ======================================================================
  // Wonders -- one bespoke illustration each, never a scaled chain sprite
  // ======================================================================

  // Magic Mushrooms, Wonder #9
  PAINTERS.goldshroom = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.42;
    groundShadow(ctx, b.gx, b.gy, S * 1.5, S * 0.4);
    radialGlow(ctx, b.gx, b.gy - S * 1.1, S * 3, '#ffd24f', 0.34);
    // a heavy gold stalk with a collar
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.3, b.gy);
    ctx.quadraticCurveTo(b.gx - S * 0.18, b.gy - S * 0.6, b.gx - S * 0.22, b.gy - S * 1.0);
    ctx.lineTo(b.gx + S * 0.22, b.gy - S * 1.0);
    ctx.quadraticCurveTo(b.gx + S * 0.18, b.gy - S * 0.6, b.gx + S * 0.3, b.gy);
    ctx.closePath();
    litFill(ctx, '#fff0b0', '#a87a20', b.gy - S, b.gy);
    ctx.strokeStyle = rgba('#6f5010', 0.6); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(b.gx, b.gy - S * 0.78, S * 0.42, S * 0.1, 0, 0, 6.3);
    litFill(ctx, '#ffe9a8', '#b0842a', b.gy - S * 0.9, b.gy - S * 0.68);
    // the cap: hammered gold with a rolled rim
    ctx.beginPath();
    ctx.ellipse(b.gx, b.gy - S * 1.02, S * 1.0, S * 0.62, 0, Math.PI, 0);
    ctx.quadraticCurveTo(b.gx + S * 0.5, b.gy - S * 0.9, b.gx, b.gy - S * 0.94);
    ctx.quadraticCurveTo(b.gx - S * 0.5, b.gy - S * 0.9, b.gx - S, b.gy - S * 1.02);
    ctx.closePath();
    litFill(ctx, '#fff6cf', '#b58420', b.gy - S * 1.7, b.gy - S * 0.9);
    ctx.strokeStyle = rgba('#6f5010', 0.7); ctx.lineWidth = 1.4; ctx.stroke();
    // hammer facets
    ctx.save(); ctx.clip();
    for (let i = 0; i < 26; i++) {
      const a = Math.PI + rnd() * Math.PI, rr = rnd();
      const px = b.gx + Math.cos(a) * S * rr, py = b.gy - S * 1.02 + Math.sin(a) * S * 0.6 * rr;
      ctx.fillStyle = rgba(rnd() < 0.5 ? '#ffffff' : '#c9922f', 0.28);
      ctx.beginPath(); ctx.arc(px, py, S * (0.05 + rnd() * 0.08), 0, 6.3); ctx.fill();
    }
    ctx.restore();
    // gilded spots
    for (let i = 0; i < 6; i++) {
      const a = Math.PI + 0.24 + i * 0.5;
      const px = b.gx + Math.cos(a) * S * 0.62, py = b.gy - S * 1.02 + Math.sin(a) * S * 0.38;
      ctx.beginPath(); ctx.ellipse(px, py, S * 0.11, S * 0.07, 0, 0, 6.3);
      litFill(ctx, '#ffffff', '#e0bf6f', py - S * 0.1, py + S * 0.1);
      ctx.strokeStyle = rgba('#8f6a20', 0.5); ctx.lineWidth = 0.8; ctx.stroke();
    }
    for (let i = 0; i < 18; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 2.6, b.gy - S * (0.4 + rnd() * 1.6), S * 0.11, '#ffffff', 0.9);
  };

  // Midas Trees, Wonder #15
  PAINTERS.worldcrystal = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.44;
    groundShadow(ctx, b.gx, b.gy, S * 1.6, S * 0.42);
    // a golden cradle of six arms rising from the ground
    for (let i = 0; i < 6; i++) {
      const t = (i / 5) - 0.5;
      ctx.strokeStyle = i % 2 ? '#e8c25f' : '#c9922f';
      ctx.lineWidth = Math.max(2.4, S * 0.11);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(b.gx + t * S * 0.9, b.gy);
      ctx.bezierCurveTo(
        b.gx + t * S * 1.5, b.gy - S * 0.7,
        b.gx + t * S * 0.4, b.gy - S * 1.3,
        b.gx + t * S * 0.75, b.gy - S * 1.7);
      ctx.stroke();
    }
    // the World Crystal itself, held aloft
    const cy = b.gy - S * 1.7;
    radialGlow(ctx, b.gx, cy, S * 2.4, '#bfe8ff', 0.5);
    ctx.save();
    ctx.translate(b.gx, cy);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * 6.283;
      ctx.beginPath();
      ctx.moveTo(0, -S * 0.9);
      ctx.lineTo(Math.cos(a) * S * 0.5, Math.sin(a) * S * 0.24);
      ctx.lineTo(Math.cos(a + 0.785) * S * 0.5, Math.sin(a + 0.785) * S * 0.24);
      ctx.closePath();
      ctx.fillStyle = rgba(i % 2 ? '#e8f8ff' : '#9fd8f0', 0.9);
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 0.9; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, S * 0.72);
      ctx.lineTo(Math.cos(a) * S * 0.5, Math.sin(a) * S * 0.24);
      ctx.lineTo(Math.cos(a + 0.785) * S * 0.5, Math.sin(a + 0.785) * S * 0.24);
      ctx.closePath();
      ctx.fillStyle = rgba(i % 2 ? '#7fc0e0' : '#bfe8ff', 0.85);
      ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.4); ctx.stroke();
    }
    ctx.restore();
    // a ring of gold leaves orbiting
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * 6.283;
      leafPath(ctx, b.gx + Math.cos(a) * S * 1.25, cy + Math.sin(a) * S * 0.5, S * 0.3, S * 0.13, a + 1.57);
      litFill(ctx, '#fff0b0', '#c9922f', cy - S, cy + S);
    }
    for (let i = 0; i < 24; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 3.2, cy + (rnd() - 0.5) * S * 2.4, S * 0.1, '#ffffff', 0.85);
  };

  // Zen Temples, Wonder #14
  PAINTERS.shambala = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.42;
    groundShadow(ctx, b.gx, b.gy, S * 1.7, S * 0.44);
    // a mountain valley: two peaks with a temple city between them
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(b.gx + s * S * 0.4, b.gy);
      ctx.lineTo(b.gx + s * S * 1.2, b.gy - S * 1.5);
      ctx.lineTo(b.gx + s * S * 1.9, b.gy);
      ctx.closePath();
      litFill(ctx, '#c9c0b0', '#6f6a60', b.gy - S * 1.5, b.gy);
      ctx.strokeStyle = rgba('#4f4a42', 0.4); ctx.lineWidth = 1; ctx.stroke();
      // snow cap
      ctx.beginPath();
      ctx.moveTo(b.gx + s * S * 0.94, b.gy - S * 1.0);
      ctx.lineTo(b.gx + s * S * 1.2, b.gy - S * 1.5);
      ctx.lineTo(b.gx + s * S * 1.46, b.gy - S * 1.0);
      ctx.quadraticCurveTo(b.gx + s * S * 1.2, b.gy - S * 1.16, b.gx + s * S * 0.94, b.gy - S * 1.0);
      ctx.closePath();
      ctx.fillStyle = '#f4f8ff'; ctx.fill();
    }
    // terraces of temples climbing the valley
    for (let i = 0; i < 4; i++) {
      const y = b.gy - i * S * 0.4;
      const w = S * (1.5 - i * 0.24);
      ctx.beginPath();
      ctx.rect(b.gx - w / 2, y - S * 0.14, w, S * 0.14);
      litFill(ctx, '#e0d8c4', '#a89e88', y - S * 0.16, y);
      ctx.strokeStyle = rgba('#5f5a4f', 0.4); ctx.lineWidth = 0.8; ctx.stroke();
      const n = 3 - Math.floor(i / 2);
      for (let k = 0; k < n; k++) {
        const cx = b.gx - w * 0.3 + (w * 0.6 / Math.max(1, n - 1)) * (n === 1 ? 0.5 : k);
        pagodaRoof(ctx, cx, y - S * 0.14, S * 0.4, S * 0.22, i % 2 ? '#c96f4f' : '#e0a04f');
        if (i === 0) litWindow(ctx, cx - S * 0.05, y - S * 0.1, S * 0.1, S * 0.07);
      }
    }
    // the great gate at the front
    ctx.strokeStyle = '#c94f3f'; ctx.lineWidth = Math.max(2.4, S * 0.1);
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.5, b.gy); ctx.lineTo(b.gx - S * 0.5, b.gy - S * 0.5);
    ctx.moveTo(b.gx + S * 0.5, b.gy); ctx.lineTo(b.gx + S * 0.5, b.gy - S * 0.5);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.7, b.gy - S * 0.5);
    ctx.quadraticCurveTo(b.gx, b.gy - S * 0.66, b.gx + S * 0.7, b.gy - S * 0.5);
    ctx.stroke();
    // sun disc behind the peaks
    radialGlow(ctx, b.gx, b.gy - S * 1.7, S * 2.4, '#ffd88f', 0.5);
    sphere(ctx, b.gx, b.gy - S * 1.8, S * 0.34, '#ffe9b0');
    for (let i = 0; i < 20; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 3.6, b.gy - rnd() * S * 2.2, S * 0.09, '#fff6d0', 0.7);
  };

  // Nirvana Temples, Wonder #13
  PAINTERS.elysium = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.42;
    groundShadow(ctx, b.gx, b.gy, S * 1.6, S * 0.42);
    // a floating white colonnade over still water
    ctx.beginPath();
    ctx.ellipse(b.gx, b.gy - S * 0.1, S * 1.5, S * 0.3, 0, 0, 6.3);
    litFill(ctx, rgba('#bfe8ff', 0.8), rgba('#5f9ec9', 0.8), b.gy - S * 0.4, b.gy + S * 0.2);
    ctx.strokeStyle = rgba('#ffffff', 0.5); ctx.lineWidth = 1; ctx.stroke();
    // platform
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 1.2, b.gy - S * 0.2);
    ctx.lineTo(b.gx + S * 1.2, b.gy - S * 0.2);
    ctx.lineTo(b.gx + S * 1.05, b.gy - S * 0.42);
    ctx.lineTo(b.gx - S * 1.05, b.gy - S * 0.42);
    ctx.closePath();
    litFill(ctx, '#ffffff', '#c0cbd8', b.gy - S * 0.42, b.gy - S * 0.2);
    ctx.strokeStyle = rgba('#8f9eb0', 0.5); ctx.lineWidth = 1; ctx.stroke();
    // pillars with fluting
    const n = 6;
    for (let i = 0; i < n; i++) {
      const x = b.gx - S * 0.9 + (S * 1.8 / (n - 1)) * i;
      const h = S * 1.2;
      ctx.beginPath(); ctx.rect(x - S * 0.09, b.gy - S * 0.42 - h, S * 0.18, h);
      litFill(ctx, '#ffffff', '#b8c4d0', b.gy - S * 0.42 - h, b.gy - S * 0.42);
      ctx.strokeStyle = rgba('#8f9eb0', 0.45); ctx.lineWidth = 0.8; ctx.stroke();
      ctx.strokeStyle = rgba('#a8b4c0', 0.4);
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * S * 0.05, b.gy - S * 0.44 - h * 0.96);
        ctx.lineTo(x + k * S * 0.05, b.gy - S * 0.46);
        ctx.stroke();
      }
      // capital
      ctx.beginPath(); ctx.rect(x - S * 0.13, b.gy - S * 0.42 - h - S * 0.08, S * 0.26, S * 0.08);
      litFill(ctx, '#ffffff', '#c8d2dc', b.gy - S * 0.42 - h - S * 0.08, b.gy - S * 0.42 - h);
    }
    // architrave and pediment
    ctx.beginPath(); ctx.rect(b.gx - S * 1.05, b.gy - S * 1.78, S * 2.1, S * 0.14);
    litFill(ctx, '#ffffff', '#c0cbd8', b.gy - S * 1.78, b.gy - S * 1.64);
    ctx.strokeStyle = rgba('#8f9eb0', 0.5); ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 1.1, b.gy - S * 1.78);
    ctx.lineTo(b.gx, b.gy - S * 2.16);
    ctx.lineTo(b.gx + S * 1.1, b.gy - S * 1.78);
    ctx.closePath();
    litFill(ctx, '#ffffff', '#cdd6e0', b.gy - S * 2.16, b.gy - S * 1.78);
    ctx.strokeStyle = rgba('#8f9eb0', 0.5); ctx.stroke();
    // the light inside
    radialGlow(ctx, b.gx, b.gy - S * 1.0, S * 1.6, '#dff4ff', 0.5);
    // lily pads on the water
    for (let i = 0; i < 5; i++) {
      const px = b.gx + (rnd() - 0.5) * S * 2.6, py = b.gy - S * 0.06 + (rnd() - 0.5) * S * 0.2;
      ctx.beginPath(); ctx.ellipse(px, py, S * 0.13, S * 0.06, 0, 0, 6.3);
      ctx.fillStyle = rgba('#7fc98f', 0.85); ctx.fill();
    }
    for (let i = 0; i < 22; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 3.2, b.gy - rnd() * S * 2.4, S * 0.09, '#ffffff', 0.8);
  };

  // Honey, Wonder #16
  PAINTERS.sanctuary = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.4;
    groundShadow(ctx, b.gx, b.gy, S * 1.6, S * 0.42);
    radialGlow(ctx, b.gx, b.gy - S * 1.1, S * 3, '#ffd06f', 0.34);
    // a great hive built as a honeycomb dome
    const cx = b.gx, cy = b.gy - S * 1.1;
    const RX = S * 1.25, RY = S * 1.1;
    ctx.beginPath();
    ctx.ellipse(cx, cy, RX, RY, 0, Math.PI, 0);
    ctx.lineTo(cx + RX, b.gy);
    ctx.lineTo(cx - RX, b.gy);
    ctx.closePath();
    litFill(ctx, '#ffd979', '#a8762a', cy - RY, b.gy);
    ctx.strokeStyle = rgba('#6f4f18', 0.6); ctx.lineWidth = 1.4;
    ctx.stroke();
    // hexagonal cells over the dome
    ctx.save();
    ctx.clip();
    const r = S * 0.2;
    for (let row = -6; row <= 6; row++) {
      for (let col = -6; col <= 6; col++) {
        const hx = cx + col * r * 1.74 + (row % 2 ? r * 0.87 : 0);
        const hy = cy + row * r * 1.5;
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = -Math.PI / 2 + (i / 6) * 6.283;
          const x = hx + Math.cos(a) * r * 0.94, y = hy + Math.sin(a) * r * 0.94;
          i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
        }
        ctx.closePath();
        const t = (hy - (cy - RY)) / (RY * 2);
        ctx.fillStyle = rgba(mix('#ffe9a8', '#c9922f', Math.max(0, Math.min(1, t))), 0.75);
        ctx.fill();
        ctx.strokeStyle = rgba('#8f6a20', 0.55); ctx.lineWidth = 1; ctx.stroke();
        // a few cells full of honey
        if ((row + col) % 5 === 0) {
          ctx.beginPath(); ctx.arc(hx, hy, r * 0.5, 0, 6.3);
          ctx.fillStyle = rgba('#ffb03f', 0.85); ctx.fill();
        }
      }
    }
    ctx.restore();
    // arched doorway
    ctx.beginPath();
    ctx.moveTo(cx - S * 0.34, b.gy);
    ctx.lineTo(cx - S * 0.34, b.gy - S * 0.4);
    ctx.quadraticCurveTo(cx, b.gy - S * 0.86, cx + S * 0.34, b.gy - S * 0.4);
    ctx.lineTo(cx + S * 0.34, b.gy);
    ctx.closePath();
    litFill(ctx, '#7f5418', '#3f2a08', b.gy - S * 0.86, b.gy);
    radialGlow(ctx, cx, b.gy - S * 0.4, S * 0.8, '#ffd06f', 0.6);
    // a swarm of bees circling
    for (let i = 0; i < 14; i++) {
      const a = rnd() * 6.283, rr = S * (1.3 + rnd() * 0.8);
      const bx = cx + Math.cos(a) * rr, by = cy + Math.sin(a) * rr * 0.8;
      ctx.fillStyle = '#ffdf6f';
      ctx.beginPath(); ctx.ellipse(bx, by, S * 0.06, S * 0.04, a, 0, 6.3); ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.7);
      ctx.beginPath(); ctx.ellipse(bx, by - S * 0.05, S * 0.045, S * 0.02, -0.4, 0, 6.3); ctx.fill();
    }
    for (let i = 0; i < 16; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 3.4, b.gy - rnd() * S * 2.4, S * 0.1, '#fff6d0', 0.8);
  };

  // Chocolate Fountains, Wonder #20
  PAINTERS.chocospring = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.4;
    groundShadow(ctx, b.gx, b.gy, S * 1.6, S * 0.42);
    // a five-tier spring, wide bowl at the base
    const tiers = 5;
    for (let i = 0; i < tiers; i++) {
      const t = i / tiers;
      const w = S * (2.0 - t * 1.4);
      const y = b.gy - i * S * 0.42;
      // bowl
      ctx.beginPath();
      ctx.ellipse(b.gx, y - S * 0.08, w / 2, w * 0.14, 0, 0, 6.3);
      litFill(ctx, '#e8d0b8', '#8f7058', y - S * 0.26, y);
      ctx.strokeStyle = rgba('#4f3a28', 0.55); ctx.lineWidth = 1.1; ctx.stroke();
      // the chocolate pooled in it
      ctx.beginPath();
      ctx.ellipse(b.gx, y - S * 0.1, w * 0.42, w * 0.1, 0, 0, 6.3);
      ctx.fillStyle = shade('#7a4a2f', 0.12 + t * 0.1); ctx.fill();
      ctx.fillStyle = rgba('#ffffff', 0.16);
      ctx.beginPath(); ctx.ellipse(b.gx - w * 0.14, y - S * 0.13, w * 0.12, w * 0.03, 0, 0, 6.3); ctx.fill();
      // curtains of chocolate falling to the tier below
      if (i > 0) {
        for (let k = 0; k < 7; k++) {
          const px = b.gx - w * 0.44 + (w * 0.88 / 6) * k;
          ctx.strokeStyle = rgba(shade('#7a4a2f', 0.2), 0.9);
          ctx.lineWidth = Math.max(1.6, S * 0.055);
          ctx.beginPath();
          ctx.moveTo(px, y - S * 0.06);
          ctx.quadraticCurveTo(px + (rnd() - 0.5) * S * 0.06, y + S * 0.2, px, y + S * 0.42);
          ctx.stroke();
        }
      }
      // column to the next tier
      if (i < tiers - 1) {
        ctx.beginPath(); ctx.rect(b.gx - S * 0.1, y - S * 0.42, S * 0.2, S * 0.36);
        litFill(ctx, '#e8d0b8', '#8f7058', y - S * 0.42, y);
      }
    }
    // the spout at the top and its plume
    const ty = b.gy - tiers * S * 0.42;
    ctx.beginPath(); ctx.arc(b.gx, ty, S * 0.16, 0, 6.3);
    litFill(ctx, '#ffe9c0', '#a8845f', ty - S * 0.2, ty + S * 0.2);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 + (i - 4) * 0.22;
      ctx.strokeStyle = rgba('#8f5a38', 0.85); ctx.lineWidth = Math.max(1.4, S * 0.05);
      ctx.beginPath();
      ctx.moveTo(b.gx, ty - S * 0.1);
      ctx.quadraticCurveTo(b.gx + Math.cos(a) * S * 0.6, ty - S * 0.6, b.gx + Math.cos(a) * S * 0.9, ty - S * 0.2);
      ctx.stroke();
    }
    // dipped berries around the base
    for (let i = 0; i < 9; i++) {
      const px = b.gx + (rnd() - 0.5) * S * 2.4, py = b.gy - rnd() * S * 0.12;
      ctx.beginPath(); ctx.arc(px, py, S * 0.11, 0, 6.3);
      ctx.fillStyle = i % 3 ? '#c93f5f' : '#5f3a20'; ctx.fill();
      ctx.strokeStyle = rgba('#2f1a10', 0.5); ctx.lineWidth = 0.7; ctx.stroke();
      ctx.fillStyle = rgba('#ffffff', 0.4);
      ctx.beginPath(); ctx.arc(px - S * 0.035, py - S * 0.04, S * 0.028, 0, 6.3); ctx.fill();
    }
    radialGlow(ctx, b.gx, b.gy - S * 1.0, S * 2.6, '#c98f5f', 0.24);
    for (let i = 0; i < 14; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 3.2, b.gy - rnd() * S * 2.4, S * 0.09, '#ffe9c0', 0.7);
  };

  // Magnificent Artefacts, Wonder #17
  PAINTERS.relic = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.4;
    groundShadow(ctx, b.gx, b.gy, S * 1.4, S * 0.4);
    const cy = b.gy - S * 1.3;
    radialGlow(ctx, b.gx, cy, S * 3, '#e0c9ff', 0.44);
    // a broken stone arch on the ground
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(b.gx + s * S * 0.9, b.gy);
      ctx.lineTo(b.gx + s * S * 1.16, b.gy);
      ctx.lineTo(b.gx + s * S * 1.0, b.gy - S * (0.9 + (s > 0 ? 0.24 : 0)));
      ctx.lineTo(b.gx + s * S * 0.78, b.gy - S * (0.8 + (s > 0 ? 0.2 : 0)));
      ctx.closePath();
      litFill(ctx, '#cfc6b4', '#6f685c', b.gy - S * 1.2, b.gy);
      ctx.strokeStyle = rgba('#4f4a42', 0.5); ctx.lineWidth = 1; ctx.stroke();
    }
    // three concentric rings, each tilted differently, orbiting the relic
    for (let k = 0; k < 3; k++) {
      ctx.save();
      ctx.translate(b.gx, cy);
      ctx.rotate(-0.3 + k * 0.9);
      ctx.beginPath();
      ctx.ellipse(0, 0, S * (1.1 - k * 0.16), S * (0.34 - k * 0.06), 0, 0, 6.3);
      ctx.strokeStyle = rgba(['#e8c884', '#c9a8ff', '#9fd8ff'][k], 0.9);
      ctx.lineWidth = Math.max(1.8, S * 0.06);
      ctx.stroke();
      // glyph beads on the ring
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * 6.283;
        const px = Math.cos(a) * S * (1.1 - k * 0.16), py = Math.sin(a) * S * (0.34 - k * 0.06);
        ctx.beginPath(); ctx.arc(px, py, S * 0.05, 0, 6.3);
        ctx.fillStyle = rgba('#ffffff', 0.85); ctx.fill();
      }
      ctx.restore();
    }
    // the relic: a tall faceted shard with an eye of light
    crystalShard(ctx, b.gx, cy + S * 0.6, S * 0.6, S * 1.35, '#c9a8ff', 0);
    sphere(ctx, b.gx, cy - S * 0.1, S * 0.2, '#ffffff');
    radialGlow(ctx, b.gx, cy - S * 0.1, S * 1.0, '#ffffff', 0.6);
    for (let i = 0; i < 26; i++) {
      const a = rnd() * 6.283, rr = S * (0.5 + rnd() * 1.6);
      sparkle(ctx, b.gx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.8, S * 0.1, '#ffffff', 0.8);
    }
  };

  // ======================================================================
  // High-tier bands over the first wave's painters.
  //
  // Each of these wraps the original: below its threshold the original runs
  // unchanged, at or above it a different structure is drawn. This is the fix
  // for "tiers 8+ differ only by hue and scale" -- the top of a chain is now a
  // different object, and every multi-tile entry gets its own composition.
  // ======================================================================
  const base = {};
  for (const k of ['lifetree', 'tree', 'stone', 'hill', 'shroom', 'chest', 'home', 'water', 'gaia']) {
    base[k] = PAINTERS[k];
  }

  // Life Trees: three structures across the band, not one canopy rescaled.
  //  8-11  a young tree -- single leaning trunk, forked branch armature
  //  12-14 a mature tree -- buttress roots, two-mass crown, orb cluster
  //  15+   a banyan -- several fused trunks under a canopy platform
  PAINTERS.lifetree = (ctx, b, d, rnd, variant) => {
    if (d.idx < 12) return youngLifeTree(ctx, b, d, rnd);
    if (d.idx < 15) return matureLifeTree(ctx, b, d, rnd);
    const H = b.th * 0.92, R = b.tw * 0.44;
    groundShadow(ctx, b.gx, b.gy, R * 1.5, R * 0.34);
    radialGlow(ctx, b.gx, b.gy - H * 0.72, R * 3, d.tint, 0.24);
    // aerial roots: a few slim ones that taper and curve, the banyan read
    ctx.lineCap = 'round';
    for (let i = 0; i < 5; i++) {
      const t = ((i / 4) - 0.5) * 1.6;
      ctx.strokeStyle = rgba('#9a7a58', 0.6);
      ctx.lineWidth = Math.max(1.1, R * 0.022 * (1.3 - Math.abs(t) * 0.5));
      ctx.beginPath();
      ctx.moveTo(b.gx + t * R * 0.9, b.gy - H * 0.56);
      ctx.quadraticCurveTo(b.gx + t * R * 1.12, b.gy - H * 0.26, b.gx + t * R * 0.98, b.gy - H * 0.02);
      ctx.stroke();
    }
    // three fused trunks, the middle one heaviest
    for (const [ox, w, h] of [[-0.44, 0.085, 0.5], [0, 0.14, 0.62], [0.4, 0.08, 0.46]]) {
      ctx.beginPath();
      ctx.moveTo(b.gx + ox * R - R * w * 1.6, b.gy);
      ctx.quadraticCurveTo(b.gx + ox * R - R * w * 0.7, b.gy - H * h * 0.6, b.gx + ox * R - R * w * 0.5, b.gy - H * h);
      ctx.lineTo(b.gx + ox * R + R * w * 0.5, b.gy - H * h);
      ctx.quadraticCurveTo(b.gx + ox * R + R * w * 0.7, b.gy - H * h * 0.6, b.gx + ox * R + R * w * 1.6, b.gy);
      ctx.closePath();
      litFill(ctx, '#8f6a48', '#4f3520', b.gy - H * h, b.gy);
      ctx.strokeStyle = rgba('#33220f', 0.5); ctx.lineWidth = 1; ctx.stroke();
    }
    // the canopy platform: a dark under-mass, then five overlapping foliage
    // masses across it, so the crown is wide and flat-bottomed rather than round
    ctx.beginPath();
    ctx.moveTo(b.gx - R * 1.44, b.gy - H * 0.6);
    ctx.quadraticCurveTo(b.gx - R * 1.5, b.gy - H * 0.84, b.gx - R * 0.9, b.gy - H * 0.92);
    ctx.quadraticCurveTo(b.gx, b.gy - H * 1.04, b.gx + R * 0.9, b.gy - H * 0.92);
    ctx.quadraticCurveTo(b.gx + R * 1.5, b.gy - H * 0.84, b.gx + R * 1.44, b.gy - H * 0.6);
    ctx.quadraticCurveTo(b.gx, b.gy - H * 0.5, b.gx - R * 1.44, b.gy - H * 0.6);
    ctx.closePath();
    ctx.fillStyle = shade(d.tint, -0.5);
    ctx.fill();
    for (let i = 0; i < 5; i++) {
      const t = (i / 4) - 0.5;
      foliage(ctx,
        b.gx + t * R * 2.1,
        b.gy - H * (0.78 + 0.1 * Math.cos(t * 3.2)),
        R * (0.52 - Math.abs(t) * 0.1), R * (0.4 - Math.abs(t) * 0.08),
        i % 2 ? d.tint : shade(d.tint, -0.08), rnd, 8);
    }
    // hanging light vines
    for (let i = 0; i < 7; i++) {
      const t = (i / 6) - 0.5;
      const vx = b.gx + t * R * 2.3;
      const len = H * (0.14 + rnd() * 0.22);
      ctx.strokeStyle = rgba(shade(d.tint, 0.4), 0.8);
      ctx.lineWidth = Math.max(1.1, R * 0.025);
      ctx.beginPath();
      ctx.moveTo(vx, b.gy - H * 0.58);
      ctx.quadraticCurveTo(vx + R * 0.1, b.gy - H * 0.58 + len * 0.6, vx, b.gy - H * 0.58 + len);
      ctx.stroke();
      radialGlow(ctx, vx, b.gy - H * 0.58 + len, R * 0.16, '#e0ffe8', 0.6);
      ctx.fillStyle = '#f0fff5';
      ctx.beginPath(); ctx.arc(vx, b.gy - H * 0.58 + len, R * 0.045, 0, 6.3); ctx.fill();
    }
    // a constellation of orbs above the crown -- the "cosmic" register
    const orbs = 5 + (d.idx - 15) * 3;
    for (let i = 0; i < orbs; i++) {
      const a = -Math.PI + (i / (orbs - 1)) * Math.PI;
      const rr = R * (1.1 + Math.sin(i * 1.7) * 0.25);
      const ox = b.gx + Math.cos(a) * rr, oy = b.gy - H * 1.02 + Math.sin(a) * rr * 0.34;
      radialGlow(ctx, ox, oy, R * 0.24, '#ffffff', 0.5);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath(); ctx.arc(ox, oy, R * 0.05, 0, 6.3); ctx.fill();
    }
    if (d.idx >= 17) {
      // the top tier carries a ring of light around the whole crown
      ctx.strokeStyle = rgba('#ffffff', 0.5);
      ctx.lineWidth = Math.max(1.4, R * 0.03);
      ctx.beginPath(); ctx.ellipse(b.gx, b.gy - H * 0.86, R * 1.85, R * 0.55, -0.1, 0, 6.3); ctx.stroke();
    }
    for (let i = 0; i < 20; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 3.4, b.gy - H * (0.4 + rnd() * 0.8), R * 0.08, '#ffffff', 0.7);
  };

  // Autumn Trees 9-10 are 2x2 and the wiki asks the obvious question about the
  // first one: "Why is this tree shaped like a leaf...?" So it is.
  PAINTERS.tree = (ctx, b, d, rnd, variant) => {
    const big = d.size[0] >= 2 && d.size[1] >= 2;
    if (!big) return base.tree(ctx, b, d, rnd, variant);
    const H = b.th * 0.9, R = b.tw * 0.42;
    groundShadow(ctx, b.gx, b.gy, R * 1.4, R * 0.34);
    const leafShaped = d.chain === 'autumnTree';
    // trunk: forked, with a visible root flare
    ctx.beginPath();
    ctx.moveTo(b.gx - R * 0.36, b.gy);
    ctx.quadraticCurveTo(b.gx - R * 0.13, b.gy - H * 0.3, b.gx - R * 0.1, b.gy - H * 0.5);
    ctx.lineTo(b.gx + R * 0.1, b.gy - H * 0.5);
    ctx.quadraticCurveTo(b.gx + R * 0.13, b.gy - H * 0.3, b.gx + R * 0.36, b.gy);
    ctx.closePath();
    litFill(ctx, '#8f6a48', '#4a3220', b.gy - H * 0.5, b.gy);
    ctx.strokeStyle = rgba('#33220f', 0.5); ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = '#6a4f38'; ctx.lineWidth = Math.max(2, R * 0.06); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(b.gx, b.gy - H * 0.46);
      ctx.quadraticCurveTo(b.gx + s * R * 0.4, b.gy - H * 0.58, b.gx + s * R * 0.55, b.gy - H * 0.68);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(b.gx, b.gy - H * 0.06);
      ctx.quadraticCurveTo(b.gx + s * R * 0.5, b.gy - H * 0.02, b.gx + s * R * 0.8, b.gy);
      ctx.stroke();
    }
    if (leafShaped) {
      // one enormous leaf outline as the whole canopy, with a midrib and veins
      const cy = b.gy - H * 0.72;
      ctx.beginPath();
      ctx.moveTo(b.gx, b.gy - H * 0.46);
      ctx.bezierCurveTo(b.gx - R * 1.5, b.gy - H * 0.62, b.gx - R * 1.25, b.gy - H * 1.12, b.gx, b.gy - H * 1.22);
      ctx.bezierCurveTo(b.gx + R * 1.25, b.gy - H * 1.12, b.gx + R * 1.5, b.gy - H * 0.62, b.gx, b.gy - H * 0.46);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.4), b.gy - H * 1.22, b.gy - H * 0.46);
      ctx.strokeStyle = rgba(shade(d.tint, -0.55), 0.6); ctx.lineWidth = 1.3; ctx.stroke();
      ctx.save(); ctx.clip();
      ctx.strokeStyle = rgba(shade(d.tint, 0.45), 0.55);
      ctx.lineWidth = Math.max(1.4, R * 0.035);
      ctx.beginPath(); ctx.moveTo(b.gx, b.gy - H * 0.46); ctx.lineTo(b.gx, b.gy - H * 1.2); ctx.stroke();
      for (let i = 1; i <= 6; i++) {
        const t = i / 7;
        for (const s of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(b.gx, b.gy - H * (0.5 + t * 0.66));
          ctx.quadraticCurveTo(
            b.gx + s * R * 0.7 * (1 - t * 0.4), b.gy - H * (0.52 + t * 0.68),
            b.gx + s * R * 1.15 * (1 - t * 0.5), b.gy - H * (0.62 + t * 0.6));
          ctx.stroke();
        }
      }
      // a few leaves already fallen at the foot
      ctx.restore();
      for (let i = 0; i < 7; i++) {
        leafPath(ctx, b.gx + (rnd() - 0.5) * R * 2.4, b.gy - rnd() * H * 0.05, R * 0.2, R * 0.1, rnd() * 6.283);
        ctx.fillStyle = rgba(shade(d.tint, rnd() * 0.4 - 0.1), 0.9); ctx.fill();
      }
    } else {
      // a double crown: two masses at different heights, which reads as a big
      // old tree rather than one scaled-up ball
      const crowns = [[-0.5, 0.78, 0.72], [0.42, 0.96, 0.86], [0.05, 0.66, 0.6]];
      for (const [ox, oy, s] of crowns) {
        for (let layer = 0; layer < 3; layer++) {
          blob(ctx, b.gx + ox * R + layer * R * 0.05, b.gy - H * oy + layer * R * 0.06,
            R * 0.78 * s * (1 - layer * 0.16), R * 0.6 * s * (1 - layer * 0.16), 9, 0.18, rnd);
          ctx.fillStyle = layer === 0 ? shade(d.tint, -0.42) : layer === 1 ? d.tint : shade(d.tint, 0.3);
          ctx.fill();
        }
      }
      // clumps on the silhouette edge
      for (let i = 0; i < 13; i++) {
        const a = rnd() * 6.283;
        const cx2 = b.gx + Math.cos(a) * R * 1.25, cy2 = b.gy - H * 0.82 + Math.sin(a) * R * 0.72;
        blob(ctx, cx2, cy2, R * 0.2, R * 0.14, 6, 0.28, rnd, a);
        ctx.fillStyle = Math.sin(a) < -0.1 ? shade(d.tint, 0.4) : shade(d.tint, -0.24);
        ctx.fill();
      }
    }
    if (d.idx >= 8) radialGlow(ctx, b.gx, b.gy - H * 0.8, R * 2.4, d.tint, 0.18);
    for (let i = 0; i < 8; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2.8, b.gy - H * (0.4 + rnd() * 0.8), R * 0.08, '#fff6d0', 0.6);
  };

  // Living Stones 7+ stop being boulders: Dino Rock is a spined fossil ridge,
  // the Bluemoss Stoneguard a standing figure, Dragonmoss Steppes a terrace.
  PAINTERS.stone = (ctx, b, d, rnd, variant) => {
    if (d.idx < 7) return base.stone(ctx, b, d, rnd, variant);
    const W = b.tw * 0.46, H = b.th * (d.size[1] >= 2 ? 0.62 : 0.52);
    groundShadow(ctx, b.gx, b.gy, W * 1.3, W * 0.32);
    const facet = (pts, lit) => {
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.fillStyle = lit;
      ctx.fill();
      ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.45);
      ctx.lineWidth = 1;
      ctx.stroke();
    };
    if (d.idx === 7) {
      // Dino Rock: a spined ridge with a fossil skull profile
      const pts = [];
      for (let i = 0; i <= 7; i++) {
        const t = i / 7;
        pts.push([b.gx - W + t * W * 2, b.gy - H * (0.2 + Math.sin(t * 3.1) * 0.7 + (i % 2 ? 0.16 : 0))]);
      }
      facet([[b.gx - W, b.gy], ...pts, [b.gx + W, b.gy]], shade(d.tint, -0.1));
      // lit top faces on each spine
      for (let i = 0; i < pts.length - 1; i++) {
        facet([pts[i], pts[i + 1], [(pts[i][0] + pts[i + 1][0]) / 2, pts[i][1] + H * 0.2]],
          shade(d.tint, i % 2 ? 0.34 : 0.14));
      }
      // eye socket
      ctx.beginPath(); ctx.ellipse(b.gx - W * 0.6, b.gy - H * 0.5, W * 0.1, H * 0.12, 0.2, 0, 6.3);
      ctx.fillStyle = rgba('#221c1a', 0.7); ctx.fill();
    } else if (d.idx === 8) {
      // Bluemoss Stoneguard: a standing figure of stacked slabs
      const slabs = [[0, 0.0, 0.9, 0.16], [0, 0.16, 0.72, 0.3], [0, 0.46, 0.56, 0.24], [0, 0.7, 0.36, 0.2]];
      for (const [ox, oy, sw, sh] of slabs) {
        const y = b.gy - H * oy;
        facet([
          [b.gx + ox * W - W * sw, y],
          [b.gx + ox * W + W * sw, y],
          [b.gx + ox * W + W * sw * 0.86, y - H * sh],
          [b.gx + ox * W - W * sw * 0.86, y - H * sh],
        ], shade(d.tint, 0.16 - oy * 0.1));
        // lit left face
        facet([
          [b.gx + ox * W - W * sw, y],
          [b.gx + ox * W - W * sw * 0.86, y - H * sh],
          [b.gx + ox * W - W * sw * 0.4, y - H * sh],
          [b.gx + ox * W - W * sw * 0.5, y],
        ], shade(d.tint, 0.36));
      }
      // shoulders and head
      facet([
        [b.gx - W * 0.5, b.gy - H * 0.9], [b.gx + W * 0.5, b.gy - H * 0.9],
        [b.gx + W * 0.3, b.gy - H * 1.02], [b.gx - W * 0.3, b.gy - H * 1.02],
      ], shade(d.tint, 0.24));
      facet([
        [b.gx - W * 0.22, b.gy - H * 1.02], [b.gx + W * 0.22, b.gy - H * 1.02],
        [b.gx + W * 0.16, b.gy - H * 1.3], [b.gx - W * 0.16, b.gy - H * 1.3],
      ], shade(d.tint, 0.42));
      // two moss-lit eyes
      for (const s of [-1, 1]) {
        radialGlow(ctx, b.gx + s * W * 0.08, b.gy - H * 1.18, W * 0.12, '#8fffd0', 0.8);
      }
    } else {
      // Dragonmoss Steppes: terraces stepping back, with grass on each lip
      const steps = 4;
      for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const y = b.gy - H * t * 0.9;
        const w = W * (1 - t * 0.34);
        facet([
          [b.gx - w, y], [b.gx + w, y],
          [b.gx + w * 0.94, y - H * 0.22], [b.gx - w * 0.94, y - H * 0.22],
        ], shade(d.tint, 0.1 - t * 0.06));
        facet([
          [b.gx - w * 0.94, y - H * 0.22], [b.gx + w * 0.94, y - H * 0.22],
          [b.gx + w * 0.8, y - H * 0.3], [b.gx - w * 0.8, y - H * 0.3],
        ], shade(d.tint, 0.38));
        // grass fringe
        ctx.strokeStyle = rgba('#7fc75f', 0.9); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        for (let k = 0; k < 10; k++) {
          const px = b.gx - w * 0.9 + (w * 1.8 / 9) * k;
          ctx.beginPath();
          ctx.moveTo(px, y - H * 0.28);
          ctx.lineTo(px + (rnd() - 0.5) * 5, y - H * 0.28 - 5 - rnd() * 5);
          ctx.stroke();
        }
      }
    }
    // moss patches, the family's signature
    for (let i = 0; i < 9; i++) {
      const px = b.gx + (rnd() - 0.5) * W * 1.7, py = b.gy - rnd() * H * 0.9;
      blob(ctx, px, py, W * 0.13, W * 0.07, 6, 0.3, rnd);
      ctx.fillStyle = rgba('#6fae52', 0.6); ctx.fill();
    }
    if (d.idx >= 8) radialGlow(ctx, b.gx, b.gy - H * 0.7, W * 1.8, '#8fffd0', 0.14);
  };

  // Hills: a mound (0-2), a knoll with an outcrop and a path (3-4), then the
  // two named landforms the wiki gives -- Moon's Precipice is a cliff and
  // Zomblin's Butte a flat-topped column (5-6) -- then a terraced massif with a
  // waterfall (7+). Every step changes the landform, not the hue.
  PAINTERS.hill = (ctx, b, d, rnd, variant) => {
    if (d.idx < 3) return base.hill(ctx, b, d, rnd, variant);
    if (d.idx <= 4) return knoll(ctx, b, d, rnd);
    if (d.idx === 5) return precipice(ctx, b, d, rnd);
    if (d.idx === 6) return butte(ctx, b, d, rnd);
    const W = b.tw * 0.5, H = b.th * 0.72;
    groundShadow(ctx, b.gx, b.gy, W * 1.4, W * 0.3);
    // back peaks first, cooler and paler for depth
    for (const [ox, hs, sw] of [[-0.6, 0.78, 0.5], [0.62, 0.9, 0.55]]) {
      ctx.beginPath();
      ctx.moveTo(b.gx + ox * W - W * sw, b.gy);
      ctx.quadraticCurveTo(b.gx + ox * W - W * sw * 0.3, b.gy - H * hs, b.gx + ox * W, b.gy - H * hs);
      ctx.quadraticCurveTo(b.gx + ox * W + W * sw * 0.4, b.gy - H * hs * 0.8, b.gx + ox * W + W * sw, b.gy);
      ctx.closePath();
      litFill(ctx, mix(shade(d.tint, 0.24), '#c0cbe0', 0.45), mix(shade(d.tint, -0.3), '#8f9ab0', 0.4), b.gy - H * hs, b.gy);
      ctx.strokeStyle = rgba('#5f6a80', 0.35); ctx.lineWidth = 1; ctx.stroke();
    }
    // the front massif with a stepped shoulder
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 1.1, b.gy);
    ctx.lineTo(b.gx - W * 0.66, b.gy - H * 0.42);
    ctx.lineTo(b.gx - W * 0.42, b.gy - H * 0.4);
    ctx.lineTo(b.gx - W * 0.12, b.gy - H * 0.98);
    ctx.lineTo(b.gx + W * 0.2, b.gy - H * 0.72);
    ctx.lineTo(b.gx + W * 0.5, b.gy - H * 0.86);
    ctx.lineTo(b.gx + W * 1.05, b.gy);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.36), b.gy - H, b.gy);
    ctx.strokeStyle = rgba(shade(d.tint, -0.55), 0.4); ctx.lineWidth = 1.1; ctx.stroke();
    ctx.save(); ctx.clip();
    // shadowed right flanks
    ctx.fillStyle = rgba('#2f3a4a', 0.22);
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 0.12, b.gy - H * 0.98);
    ctx.lineTo(b.gx + W * 0.2, b.gy - H * 0.72);
    ctx.lineTo(b.gx + W * 1.05, b.gy);
    ctx.lineTo(b.gx + W * 0.1, b.gy);
    ctx.closePath(); ctx.fill();
    // terraces
    ctx.strokeStyle = rgba(shade(d.tint, 0.45), 0.5); ctx.lineWidth = 1.4;
    for (let i = 1; i <= 4; i++) {
      const y = b.gy - H * 0.12 * i;
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 1.05, y);
      ctx.quadraticCurveTo(b.gx, y - H * 0.06, b.gx + W * 1.0, y);
      ctx.stroke();
    }
    // grass fuzz on the terraces
    ctx.strokeStyle = rgba('#8fd06a', 0.7); ctx.lineWidth = 1.2;
    for (let i = 0; i < 26; i++) {
      const px = b.gx + (rnd() - 0.5) * W * 2, py = b.gy - rnd() * H * 0.6;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + (rnd() - 0.5) * 4, py - 4 - rnd() * 4); ctx.stroke();
    }
    // waterfall down the notch
    ctx.strokeStyle = rgba('#dff4ff', 0.85); ctx.lineWidth = Math.max(2, W * 0.05);
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.06 + i * W * 0.05, b.gy - H * 0.72);
      ctx.quadraticCurveTo(b.gx + i * W * 0.04, b.gy - H * 0.4, b.gx - W * 0.02 + i * W * 0.06, b.gy - H * 0.08);
      ctx.stroke();
    }
    ctx.restore();
    // snow / rock cap on the tallest peak
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 0.3, b.gy - H * 0.78);
    ctx.lineTo(b.gx - W * 0.12, b.gy - H * 0.98);
    ctx.lineTo(b.gx + W * 0.06, b.gy - H * 0.8);
    ctx.quadraticCurveTo(b.gx - W * 0.12, b.gy - H * 0.86, b.gx - W * 0.3, b.gy - H * 0.78);
    ctx.closePath();
    ctx.fillStyle = d.idx >= 9 ? '#f0f6ff' : '#c8c2b4';
    ctx.fill();
    // mist pooling at the base
    for (let i = 0; i < 5; i++) {
      ctx.save();
      ctx.globalAlpha = 0.16;
      blob(ctx, b.gx + (rnd() - 0.5) * W * 1.8, b.gy - H * (0.04 + rnd() * 0.12), W * 0.4, W * 0.1, 8, 0.3, rnd);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
    }
    if (d.idx >= 9) {
      radialGlow(ctx, b.gx, b.gy - H * 0.9, W * 2, '#c9b0ff', 0.2);
      for (let i = 0; i < 10; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * W * 2.4, b.gy - rnd() * H, W * 0.05, '#ffffff', 0.7);
    }
  };

  // Mushrooms from tier 4 up: one ringed toadstool, then a pair, then a grove.
  // Below that the first-wave painter's cap clusters still read fine.
  PAINTERS.shroom = (ctx, b, d, rnd, variant) => {
    if (d.idx < 4) return base.shroom(ctx, b, d, rnd, variant);
    const W = b.tw * 0.44, H = b.th * (d.idx >= 8 ? 0.7 : 0.56);
    groundShadow(ctx, b.gx, b.gy, W * 1.4, W * 0.34);
    const caps = d.idx <= 5 ? [[0, 1.0, 1.1]]
      : d.idx <= 7 ? [[-0.3, 1.0, 0.95], [0.44, 0.56, 0.6]]
        : [[-0.78, 0.5, 0.6], [0.72, 0.62, 0.66], [-0.16, 1.0, 1.0], [0.34, 0.4, 0.44]];
    // draw back to front by height
    caps.sort((p, q) => p[1] - q[1]);
    for (const [ox, hs, ss] of caps) {
      const cx = b.gx + ox * W;
      const top = b.gy - H * hs;
      // stalk with a flared foot and a collar
      ctx.beginPath();
      ctx.moveTo(cx - W * 0.16 * ss, b.gy);
      ctx.quadraticCurveTo(cx - W * 0.07 * ss, b.gy - H * hs * 0.5, cx - W * 0.08 * ss, top);
      ctx.lineTo(cx + W * 0.08 * ss, top);
      ctx.quadraticCurveTo(cx + W * 0.07 * ss, b.gy - H * hs * 0.5, cx + W * 0.16 * ss, b.gy);
      ctx.closePath();
      litFill(ctx, '#f0e8d8', '#a89e88', top, b.gy);
      ctx.strokeStyle = rgba('#6f6858', 0.5); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath(); ctx.ellipse(cx, top + H * 0.06, W * 0.16 * ss, W * 0.04, 0, 0, 6.3);
      ctx.fillStyle = '#e0d6c0'; ctx.fill();
      // cap: a domed bell on even tiers, a peaked cone on odd ones, gills
      // showing under the rim either way
      ctx.beginPath();
      if (d.idx % 2) {
        ctx.moveTo(cx - W * 0.44 * ss, top + H * 0.02 * ss);
        ctx.quadraticCurveTo(cx - W * 0.16 * ss, top - H * 0.16 * ss, cx, top - H * 0.42 * ss);
        ctx.quadraticCurveTo(cx + W * 0.16 * ss, top - H * 0.16 * ss, cx + W * 0.44 * ss, top + H * 0.02 * ss);
      } else {
        ctx.ellipse(cx, top, W * 0.44 * ss, H * 0.3 * ss, 0, Math.PI, 0);
      }
      ctx.quadraticCurveTo(cx + W * 0.2 * ss, top + H * 0.06 * ss, cx, top + H * 0.03 * ss);
      ctx.quadraticCurveTo(cx - W * 0.2 * ss, top + H * 0.06 * ss, cx - W * 0.44 * ss, top);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.36), shade(d.tint, -0.36), top - H * 0.3 * ss, top + H * 0.06);
      ctx.strokeStyle = rgba(shade(d.tint, -0.55), 0.55); ctx.lineWidth = 1.1; ctx.stroke();
      ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.35); ctx.lineWidth = 0.9;
      for (let i = -3; i <= 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * W * 0.11 * ss, top + H * 0.045 * ss);
        ctx.lineTo(cx + i * W * 0.13 * ss, top - H * 0.02 * ss);
        ctx.stroke();
      }
      // spots
      for (let i = 0; i < 4; i++) {
        const a = Math.PI + 0.35 + i * 0.62;
        ctx.beginPath();
        ctx.ellipse(cx + Math.cos(a) * W * 0.26 * ss, top + Math.sin(a) * H * 0.17 * ss, W * 0.06 * ss, W * 0.04 * ss, 0, 0, 6.3);
        ctx.fillStyle = rgba('#fff6e0', 0.9); ctx.fill();
      }
      radialGlow(ctx, cx, top, W * 0.7 * ss, d.tint, d.idx >= 10 ? 0.3 : 0.16);
    }
    // spore motes drifting between them
    for (let i = 0; i < 14; i++) {
      const px = b.gx + (rnd() - 0.5) * W * 2.4, py = b.gy - rnd() * H;
      ctx.fillStyle = rgba('#fff0c0', 0.5);
      ctx.beginPath(); ctx.arc(px, py, W * 0.02, 0, 6.3); ctx.fill();
    }
    if (d.idx >= 11) {
      // Dragonfire: embers rising off the grove
      for (let i = 0; i < 12; i++) {
        const px = b.gx + (rnd() - 0.5) * W * 2, py = b.gy - H * (0.6 + rnd() * 0.6);
        radialGlow(ctx, px, py, W * 0.14, '#ff8f4f', 0.6);
      }
    }
    for (let i = 0; i < 8; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * W * 2.4, b.gy - rnd() * H, W * 0.06, '#ffffff', 0.7);
  };

  // The Giant Treasure Chest (2x2) gets a domed lid, corner bosses and spill.
  PAINTERS.chest = (ctx, b, d, rnd, variant) => {
    if (!(d.size[0] >= 2 && d.size[1] >= 2)) return base.chest(ctx, b, d, rnd, variant);
    const W = b.tw * 0.66, H = W * 0.62;
    groundShadow(ctx, b.gx, b.gy, W * 0.8, W * 0.22);
    // body
    roundRect(ctx, b.gx - W / 2, b.gy - H, W, H, W * 0.05);
    litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.38), b.gy - H, b.gy);
    ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.7); ctx.lineWidth = 1.6; ctx.stroke();
    // plank lines and iron straps
    ctx.save(); ctx.clip();
    ctx.strokeStyle = rgba(shade(d.tint, -0.5), 0.4); ctx.lineWidth = 1;
    for (let i = 1; i < 5; i++) {
      const x = b.gx - W / 2 + (W / 5) * i;
      ctx.beginPath(); ctx.moveTo(x, b.gy - H); ctx.lineTo(x, b.gy); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = '#5f5548';
    for (const t of [0.22, 0.78]) ctx.fillRect(b.gx - W / 2 + W * t - W * 0.03, b.gy - H, W * 0.06, H);
    // domed lid, thrown open
    ctx.save();
    ctx.translate(b.gx, b.gy - H);
    ctx.rotate(-0.2);
    ctx.beginPath();
    ctx.ellipse(0, 0, W * 0.52, H * 0.56, 0, Math.PI, 0);
    ctx.lineTo(W * 0.52, H * 0.06);
    ctx.lineTo(-W * 0.52, H * 0.06);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.36), shade(d.tint, -0.3), -H * 0.6, H * 0.1);
    ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.7); ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = rgba('#5f5548', 0.8); ctx.lineWidth = W * 0.05;
    for (const a of [Math.PI * 1.25, Math.PI * 1.5, Math.PI * 1.75]) {
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * W * 0.52, Math.sin(a) * H * 0.56);
      ctx.lineTo(Math.cos(a) * W * 0.1, H * 0.06);
      ctx.stroke();
    }
    ctx.restore();
    // corner bosses
    ctx.fillStyle = '#e8c05f';
    for (const sx of [-1, 1]) for (const sy of [0, 1]) {
      ctx.beginPath();
      ctx.arc(b.gx + sx * W * 0.44, b.gy - H * (0.12 + sy * 0.72), W * 0.045, 0, 6.3);
      ctx.fill();
      ctx.strokeStyle = rgba('#8f6a20', 0.7); ctx.lineWidth = 0.9; ctx.stroke();
    }
    // lock plate
    roundRect(ctx, b.gx - W * 0.09, b.gy - H * 0.62, W * 0.18, H * 0.28, W * 0.03);
    litFill(ctx, '#ffe066', '#a8791f', b.gy - H * 0.62, b.gy - H * 0.34);
    ctx.strokeStyle = rgba('#6f5010', 0.8); ctx.lineWidth = 1; ctx.stroke();
    // overflowing treasure
    radialGlow(ctx, b.gx, b.gy - H * 0.98, W * 0.8, '#ffe066', 0.55);
    for (let i = 0; i < 22; i++) {
      const px = b.gx + (rnd() - 0.5) * W * 0.86, py = b.gy - H * (0.9 + rnd() * 0.3);
      if (rnd() < 0.6) {
        ctx.beginPath(); ctx.ellipse(px, py, W * 0.042, W * 0.02, rnd() * 0.8, 0, 6.3);
        litFill(ctx, '#ffe066', '#c9922f', py - 3, py + 3);
      } else {
        starPath(ctx, px, py, 4, W * 0.05, W * 0.017, rnd() * 3);
        ctx.fillStyle = ['#ff5f8f', '#5fd0ff', '#8fff9f'][i % 3]; ctx.fill();
      }
      ctx.strokeStyle = rgba('#6f5010', 0.5); ctx.lineWidth = 0.6; ctx.stroke();
    }
    for (let i = 0; i < 14; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * W * 1.5, b.gy - H * (0.6 + rnd() * 0.9), W * 0.055, '#ffffff', 0.9);
  };

  // Dragon Homes 7+: the Opulent Cave, then the Giant Mansion.
  PAINTERS.home = (ctx, b, d, rnd, variant) => {
    if (d.idx < 6) return base.home(ctx, b, d, rnd, variant);
    const W = b.tw * (d.size[0] >= 2 ? 0.62 : 0.7), H = b.th * (d.size[1] >= 2 ? 0.62 : 0.72);
    groundShadow(ctx, b.gx, b.gy, W * 0.9, W * 0.24);
    if (d.idx === 6) {
      // Opulent Dragon Cave: a rock face with a lit arched mouth
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.72, b.gy);
      ctx.quadraticCurveTo(b.gx - W * 0.6, b.gy - H * 0.8, b.gx - W * 0.1, b.gy - H * 0.98);
      ctx.quadraticCurveTo(b.gx + W * 0.5, b.gy - H * 0.88, b.gx + W * 0.74, b.gy);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.24), shade(d.tint, -0.42), b.gy - H, b.gy);
      ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.5); ctx.lineWidth = 1.2; ctx.stroke();
      // strata
      ctx.save(); ctx.clip();
      ctx.strokeStyle = rgba(shade(d.tint, -0.45), 0.4); ctx.lineWidth = 1.2;
      for (let i = 1; i <= 4; i++) {
        const y = b.gy - H * 0.18 * i;
        ctx.beginPath(); ctx.moveTo(b.gx - W, y); ctx.quadraticCurveTo(b.gx, y - H * 0.05, b.gx + W, y); ctx.stroke();
      }
      ctx.restore();
      // mouth
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.24, b.gy);
      ctx.lineTo(b.gx - W * 0.24, b.gy - H * 0.36);
      ctx.quadraticCurveTo(b.gx, b.gy - H * 0.7, b.gx + W * 0.24, b.gy - H * 0.36);
      ctx.lineTo(b.gx + W * 0.24, b.gy);
      ctx.closePath();
      litFill(ctx, '#4f3828', '#1f150e', b.gy - H * 0.7, b.gy);
      radialGlow(ctx, b.gx, b.gy - H * 0.28, W * 0.5, '#ffb04f', 0.7);
      // gold hoard glinting at the lip
      for (let i = 0; i < 9; i++) {
        const px = b.gx + (rnd() - 0.5) * W * 0.42, py = b.gy - rnd() * H * 0.1;
        ctx.beginPath(); ctx.ellipse(px, py, W * 0.03, W * 0.014, 0, 0, 6.3);
        ctx.fillStyle = '#ffd24f'; ctx.fill();
      }
      // crystals growing out of the rock
      for (const s of [-1, 1]) {
        crystalShard(ctx, b.gx + s * W * 0.52, b.gy - H * 0.06, W * 0.16, H * 0.4, '#c9a8ff', s * 0.3);
      }
    } else {
      // Giant Dragon Mansion: a central hall, two wings and a tower
      for (const s of [-1, 1]) {
        const wx = b.gx + s * W * 0.5;
        const box = buildingBox(ctx, wx, b.gy, W * 0.5, H * 0.52, d.tint, 0.2);
        ctx.beginPath();
        ctx.moveTo(wx - W * 0.32, box.top + 1);
        ctx.lineTo(wx, box.top - H * 0.2);
        ctx.lineTo(wx + W * 0.3, box.top + 1);
        ctx.closePath();
        litFill(ctx, '#b0543f', '#6f2f28', box.top - H * 0.22, box.top);
        ctx.strokeStyle = rgba('#5f2620', 0.7); ctx.lineWidth = 1; ctx.stroke();
        for (let i = 0; i < 2; i++) litWindow(ctx, wx - W * 0.16 + i * W * 0.2, b.gy - H * 0.34, W * 0.1, H * 0.14);
      }
      const box = buildingBox(ctx, b.gx, b.gy, W * 0.66, H * 0.78, shade(d.tint, 0.08), 0.22);
      // gabled roof with a ridge
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.42, box.top + 1);
      ctx.lineTo(b.gx - W * 0.02, box.top - H * 0.32);
      ctx.lineTo(b.gx + W * 0.4, box.top + 1);
      ctx.closePath();
      litFill(ctx, '#c05f45', '#6f2f28', box.top - H * 0.34, box.top);
      ctx.strokeStyle = rgba('#5f2620', 0.7); ctx.lineWidth = 1.2; ctx.stroke();
      // tower
      const tx = b.gx + W * 0.26;
      ctx.beginPath(); ctx.rect(tx - W * 0.09, box.top - H * 0.5, W * 0.18, H * 0.52);
      litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.3), box.top - H * 0.5, box.top);
      ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.6); ctx.lineWidth = 1; ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tx - W * 0.14, box.top - H * 0.5);
      ctx.lineTo(tx, box.top - H * 0.86);
      ctx.lineTo(tx + W * 0.14, box.top - H * 0.5);
      ctx.closePath();
      litFill(ctx, '#c05f45', '#6f2f28', box.top - H * 0.86, box.top - H * 0.5);
      litWindow(ctx, tx - W * 0.05, box.top - H * 0.4, W * 0.1, H * 0.12);
      // grand door and steps
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.13, b.gy);
      ctx.lineTo(b.gx - W * 0.13, b.gy - H * 0.34);
      ctx.quadraticCurveTo(b.gx, b.gy - H * 0.5, b.gx + W * 0.13, b.gy - H * 0.34);
      ctx.lineTo(b.gx + W * 0.13, b.gy);
      ctx.closePath();
      litFill(ctx, '#5f3a24', '#2a180e', b.gy - H * 0.5, b.gy);
      radialGlow(ctx, b.gx, b.gy - H * 0.2, W * 0.4, '#ffcf7f', 0.6);
      for (let i = 0; i < 4; i++) litWindow(ctx, b.gx - W * 0.24 + (i % 2) * W * 0.34, b.gy - H * (0.46 + Math.floor(i / 2) * 0.18), W * 0.11, H * 0.13);
      // a dragon weathervane
      ctx.strokeStyle = '#e8c05f'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(tx, box.top - H * 0.86); ctx.lineTo(tx, box.top - H * 1.02); ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(tx, box.top - H * 1.02);
      ctx.quadraticCurveTo(tx + W * 0.12, box.top - H * 1.08, tx + W * 0.16, box.top - H * 0.96);
      ctx.quadraticCurveTo(tx + W * 0.06, box.top - H * 0.98, tx, box.top - H * 1.02);
      ctx.closePath();
      ctx.fillStyle = '#e8c05f'; ctx.fill();
    }
    // chimney smoke
    ctx.fillStyle = rgba('#ffffff', 0.3);
    for (let i = 0; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(b.gx - W * 0.3 + i * 3, b.gy - H * (0.9 + i * 0.1), W * (0.03 + i * 0.012), 0, 6.3);
      ctx.fill();
    }
  };

  // Big ponds (2x1 and up): an irregular pool with a rock rim, reeds and lilies.
  PAINTERS.water = (ctx, b, d, rnd, variant) => {
    if (d.idx < 5 || d.wonder) return base.water(ctx, b, d, rnd, variant);
    const RX = b.tw * 0.46, RY = b.th * 0.3;
    const cy = b.gy - RY * 0.7;
    groundShadow(ctx, b.gx, cy + RY * 0.9, RX * 1.1, RY * 0.5, 0.2);
    // the water body: an irregular blob, then a second lighter one inside
    blob(ctx, b.gx, cy, RX, RY, 11, 0.12, rnd);
    const g2 = ctx.createLinearGradient(0, cy - RY, 0, cy + RY);
    g2.addColorStop(0, shade(d.tint, 0.34));
    g2.addColorStop(0.55, d.tint);
    g2.addColorStop(1, shade(d.tint, -0.3));
    ctx.fillStyle = g2;
    ctx.fill();
    ctx.save();
    ctx.clip();
    // sky reflection band and ripples
    ctx.fillStyle = rgba('#dff4ff', 0.3);
    ctx.beginPath(); ctx.ellipse(b.gx - RX * 0.2, cy - RY * 0.42, RX * 0.5, RY * 0.2, -0.1, 0, 6.3); ctx.fill();
    ctx.strokeStyle = rgba('#ffffff', 0.42);
    ctx.lineWidth = 1.3;
    for (let i = 0; i < 6; i++) {
      const yy = cy - RY * 0.5 + i * RY * 0.28;
      ctx.beginPath();
      ctx.moveTo(b.gx - RX * 0.8, yy);
      ctx.bezierCurveTo(b.gx - RX * 0.3, yy - RY * 0.08, b.gx + RX * 0.3, yy + RY * 0.08, b.gx + RX * 0.8, yy);
      ctx.stroke();
    }
    ctx.restore();
    // rock rim, dark and chunky at the front so the pool reads as sunken
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * 6.283 + rnd() * 0.2;
      const px = b.gx + Math.cos(a) * RX * (0.98 + rnd() * 0.1);
      const py = cy + Math.sin(a) * RY * (0.98 + rnd() * 0.1);
      const rr = RX * (0.06 + rnd() * 0.07);
      blob(ctx, px, py, rr, rr * 0.7, 6, 0.24, rnd);
      litFill(ctx, Math.sin(a) > 0 ? '#a89e8c' : '#8f8878', '#4f4a42', py - rr, py + rr);
      ctx.strokeStyle = rgba('#332e28', 0.4); ctx.lineWidth = 0.8; ctx.stroke();
    }
    // reeds at the back edge
    ctx.lineCap = 'round';
    for (let i = 0; i < 10; i++) {
      const px = b.gx + (rnd() - 0.5) * RX * 1.6;
      const py = cy - RY * (0.7 + rnd() * 0.25);
      const hh = RY * (0.6 + rnd() * 0.8);
      ctx.strokeStyle = rnd() < 0.5 ? '#5fa84f' : '#7fc75f';
      ctx.lineWidth = Math.max(1.3, RX * 0.016);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.quadraticCurveTo(px + (rnd() - 0.5) * RX * 0.1, py - hh * 0.6, px + (rnd() - 0.5) * RX * 0.14, py - hh);
      ctx.stroke();
      if (rnd() < 0.4) {
        ctx.fillStyle = '#8f6a3f';
        ctx.beginPath(); ctx.ellipse(px + (rnd() - 0.5) * RX * 0.1, py - hh, RX * 0.014, hh * 0.14, 0, 0, 6.3); ctx.fill();
      }
    }
    // lily pads and a flower, more with tier
    const pads = 2 + Math.min(5, d.idx - 4);
    for (let i = 0; i < pads; i++) {
      const px = b.gx + (rnd() - 0.5) * RX * 1.3, py = cy + (rnd() - 0.3) * RY * 1.1;
      const pr = RX * (0.1 + rnd() * 0.06);
      ctx.beginPath();
      ctx.ellipse(px, py, pr, pr * 0.5, 0, 0.35, Math.PI * 2 - 0.35);
      ctx.closePath();
      litFill(ctx, '#7fc98f', '#3f7f5f', py - pr * 0.5, py + pr * 0.5);
      ctx.strokeStyle = rgba('#2f5f3f', 0.5); ctx.lineWidth = 0.8; ctx.stroke();
      if (i === 0) {
        for (let k = 0; k < 6; k++) {
          petal(ctx, px, py - pr * 0.2, pr * 0.6, pr * 0.22, (k / 6) * 6.283, 0.4);
          litFill(ctx, '#ffffff', '#ffc0d8', py - pr, py);
        }
        ctx.beginPath(); ctx.arc(px, py - pr * 0.2, pr * 0.14, 0, 6.3);
        ctx.fillStyle = '#ffe066'; ctx.fill();
      }
    }
    radialGlow(ctx, b.gx, cy, RX * 1.4, '#bfe8ff', 0.16);
    for (let i = 0; i < 8; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * RX * 1.7, cy + (rnd() - 0.5) * RY * 1.4, RX * 0.035, '#ffffff', 0.7);
  };

  // Grand and Heavenly Gaia Statues (2x2): a winged goddess on an arch.
  PAINTERS.gaia = (ctx, b, d, rnd, variant) => {
    if (d.idx < 2) return base.gaia(ctx, b, d, rnd, variant);
    const S = Math.min(b.tw, b.th) * 0.3;
    const H = b.th * 0.82;
    groundShadow(ctx, b.gx, b.gy, S * 1.7, S * 0.4);
    plinth(ctx, b.gx, b.gy, S * 2.2, S * 0.38, '#b8b0a0');
    const base2 = b.gy - S * 0.38;
    // the arch behind her
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.95, base2);
    ctx.lineTo(b.gx - S * 0.95, base2 - H * 0.42);
    ctx.quadraticCurveTo(b.gx, base2 - H * 0.96, b.gx + S * 0.95, base2 - H * 0.42);
    ctx.lineTo(b.gx + S * 0.95, base2);
    ctx.lineTo(b.gx + S * 0.7, base2);
    ctx.lineTo(b.gx + S * 0.7, base2 - H * 0.4);
    ctx.quadraticCurveTo(b.gx, base2 - H * 0.82, b.gx - S * 0.7, base2 - H * 0.4);
    ctx.lineTo(b.gx - S * 0.7, base2);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.24), shade(d.tint, -0.34), base2 - H, base2);
    ctx.strokeStyle = rgba('#8f8878', 0.55); ctx.lineWidth = 1.1; ctx.stroke();
    // the figure: robe, arms out, head, halo
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.42, base2);
    ctx.quadraticCurveTo(b.gx - S * 0.26, base2 - H * 0.36, b.gx - S * 0.16, base2 - H * 0.54);
    ctx.lineTo(b.gx + S * 0.16, base2 - H * 0.54);
    ctx.quadraticCurveTo(b.gx + S * 0.26, base2 - H * 0.36, b.gx + S * 0.42, base2);
    ctx.closePath();
    litFill(ctx, shade(d.tint, 0.4), shade(d.tint, -0.24), base2 - H * 0.56, base2);
    ctx.strokeStyle = rgba('#8f8878', 0.5); ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = rgba('#8f8878', 0.4); ctx.lineWidth = 0.9;
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(b.gx + i * S * 0.12, base2 - H * 0.5);
      ctx.quadraticCurveTo(b.gx + i * S * 0.24, base2 - H * 0.22, b.gx + i * S * 0.3, base2);
      ctx.stroke();
    }
    // arms opened wide, palms up
    ctx.strokeStyle = shade(d.tint, 0.42);
    ctx.lineWidth = Math.max(2, S * 0.09); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(b.gx + s * S * 0.14, base2 - H * 0.5);
      ctx.quadraticCurveTo(b.gx + s * S * 0.5, base2 - H * 0.56, b.gx + s * S * 0.6, base2 - H * 0.7);
      ctx.stroke();
      radialGlow(ctx, b.gx + s * S * 0.6, base2 - H * 0.72, S * 0.3, '#c9ffe0', 0.55);
    }
    // head + halo
    ctx.beginPath(); ctx.arc(b.gx, base2 - H * 0.64, S * 0.15, 0, 6.3);
    litFill(ctx, shade(d.tint, 0.5), shade(d.tint, -0.1), base2 - H * 0.8, base2 - H * 0.5);
    ctx.strokeStyle = rgba('#8f8878', 0.5); ctx.lineWidth = 0.9; ctx.stroke();
    ctx.strokeStyle = rgba('#fff6d0', 0.9); ctx.lineWidth = Math.max(1.4, S * 0.045);
    ctx.beginPath(); ctx.ellipse(b.gx, base2 - H * 0.72, S * 0.32, S * 0.11, 0, 0, 6.3); ctx.stroke();
    // wings: only the Heavenly statue has them
    if (d.idx >= 3) {
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(b.gx + s * S * 0.12, base2 - H * 0.5);
        ctx.quadraticCurveTo(b.gx + s * S * 1.3, base2 - H * 0.96, b.gx + s * S * 0.62, base2 - H * 0.08);
        ctx.quadraticCurveTo(b.gx + s * S * 0.5, base2 - H * 0.32, b.gx + s * S * 0.12, base2 - H * 0.5);
        ctx.closePath();
        ctx.fillStyle = rgba('#fff8e8', s > 0 ? 0.6 : 0.82);
        ctx.fill();
        ctx.strokeStyle = rgba('#ffffff', 0.7); ctx.lineWidth = 1; ctx.stroke();
        ctx.strokeStyle = rgba('#d8cfae', 0.6); ctx.lineWidth = 0.8;
        for (let i = 1; i <= 3; i++) {
          ctx.beginPath();
          ctx.moveTo(b.gx + s * S * 0.16, base2 - H * 0.48);
          ctx.quadraticCurveTo(b.gx + s * S * (0.6 + i * 0.2), base2 - H * (0.7 - i * 0.1), b.gx + s * S * (0.56 + i * 0.02), base2 - H * (0.14 + i * 0.08));
          ctx.stroke();
        }
      }
    }
    // life blooming at her feet
    for (let i = 0; i < 5; i++) {
      const px = b.gx + (rnd() - 0.5) * S * 1.9, py = b.gy - rnd() * S * 0.16;
      for (let k = 0; k < 5; k++) {
        petal(ctx, px, py, S * 0.09, S * 0.04, (k / 5) * 6.283, 0.4);
        ctx.fillStyle = '#ff9fc0'; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(px, py, S * 0.025, 0, 6.3);
      ctx.fillStyle = '#ffe066'; ctx.fill();
    }
    radialGlow(ctx, b.gx, base2 - H * 0.6, S * 2.4, '#fff6d0', 0.3);
    for (let i = 0; i < 16; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 3, base2 - rnd() * H, S * 0.08, '#ffffff', 0.8);
  };

  // ======================================================================
  // Rebuilt Wonders from the first wave. Each was a handful of rectangles;
  // each is now its own illustration.
  // ======================================================================

  // Living Stones, Wonder #5
  PAINTERS.henge = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.4;
    groundShadow(ctx, b.gx, b.gy, S * 1.8, S * 0.4);
    // a ring: back trilithons small and cool, front ones large and warm
    const ring = [
      [-1.55, 0.62, 0.5], [-0.55, 0.6, 0.42], [0.55, 0.6, 0.42], [1.55, 0.62, 0.5],
    ];
    // back arc, drawn first and paler
    for (const [ox, hs, ws] of [[-1.05, 0.44, 0.3], [0, 0.46, 0.3], [1.05, 0.44, 0.3]]) {
      const x = b.gx + ox * S, h = S * hs * 1.6, w = S * ws;
      ctx.beginPath(); ctx.rect(x - w / 2, b.gy - S * 0.34 - h, w, h);
      litFill(ctx, mix(shade(d.tint, 0.2), '#c0cbe0', 0.5), mix(shade(d.tint, -0.3), '#8f9ab0', 0.45), b.gy - h, b.gy);
      ctx.strokeStyle = rgba('#5f6a80', 0.35); ctx.lineWidth = 1; ctx.stroke();
    }
    // the front trilithons: two uprights and a lintel each, weathered
    for (let i = 0; i < ring.length; i += 2) {
      const a = ring[i], c = ring[i + 1];
      const tops = [];
      for (const [ox, hs, ws] of [a, c]) {
        const x = b.gx + ox * S, h = S * hs * 1.9, w = S * ws;
        ctx.beginPath();
        ctx.moveTo(x - w / 2, b.gy);
        ctx.lineTo(x - w / 2 + w * 0.06, b.gy - h);
        ctx.lineTo(x + w / 2 - w * 0.04, b.gy - h);
        ctx.lineTo(x + w / 2, b.gy);
        ctx.closePath();
        litFill(ctx, shade(d.tint, 0.3), shade(d.tint, -0.36), b.gy - h, b.gy);
        ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.5); ctx.lineWidth = 1.2; ctx.stroke();
        // weathering: pits and a shadowed right face
        ctx.save(); ctx.clip();
        ctx.fillStyle = rgba('#2f2a28', 0.18);
        ctx.fillRect(x + w * 0.1, b.gy - h, w * 0.4, h);
        speckle(ctx, x - w / 2, b.gy - h, w, h, rgba('#3f3a34', 0.2), 14, rnd, 0.8, 2.4);
        ctx.restore();
        tops.push([x, b.gy - h, w]);
      }
      // lintel spanning them
      const [x0, y0, w0] = tops[0], [x1, y1] = tops[1];
      const ly = Math.min(y0, y1);
      ctx.beginPath();
      ctx.moveTo(x0 - w0 * 0.6, ly);
      ctx.lineTo(x1 + w0 * 0.6, ly);
      ctx.lineTo(x1 + w0 * 0.55, ly - S * 0.2);
      ctx.lineTo(x0 - w0 * 0.55, ly - S * 0.2);
      ctx.closePath();
      litFill(ctx, shade(d.tint, 0.36), shade(d.tint, -0.28), ly - S * 0.2, ly);
      ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.5); ctx.lineWidth = 1.2; ctx.stroke();
    }
    // the altar slab in the middle, and the cold light over it
    ctx.beginPath();
    ctx.ellipse(b.gx, b.gy - S * 0.12, S * 0.46, S * 0.14, 0, 0, 6.3);
    litFill(ctx, shade(d.tint, 0.2), shade(d.tint, -0.4), b.gy - S * 0.3, b.gy);
    ctx.strokeStyle = rgba(shade(d.tint, -0.6), 0.5); ctx.lineWidth = 1; ctx.stroke();
    // a shaft of moonlight down the centre
    const grad = ctx.createLinearGradient(0, b.gy - S * 2.2, 0, b.gy);
    grad.addColorStop(0, rgba('#c9d8ff', 0.34));
    grad.addColorStop(1, rgba('#c9d8ff', 0));
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.18, b.gy - S * 2.2);
    ctx.lineTo(b.gx + S * 0.18, b.gy - S * 2.2);
    ctx.lineTo(b.gx + S * 0.46, b.gy - S * 0.1);
    ctx.lineTo(b.gx - S * 0.46, b.gy - S * 0.1);
    ctx.closePath(); ctx.fill();
    // mist at the foot of the stones
    for (let i = 0; i < 6; i++) {
      ctx.save(); ctx.globalAlpha = 0.14;
      blob(ctx, b.gx + (rnd() - 0.5) * S * 3, b.gy - rnd() * S * 0.16, S * 0.5, S * 0.1, 8, 0.3, rnd);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
    }
    radialGlow(ctx, b.gx, b.gy - S * 1.1, S * 2, '#a8c0ff', 0.2);
    for (let i = 0; i < 12; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 3, b.gy - rnd() * S * 1.8, S * 0.06, '#dfe8ff', 0.6);
  };

  // Bushes, Wonder #10
  PAINTERS.ruins = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.4;
    groundShadow(ctx, b.gx, b.gy, S * 1.8, S * 0.4);
    // a broken marble platform floating slightly, with sky under its edge
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 1.5, b.gy - S * 0.2);
    ctx.lineTo(b.gx + S * 1.5, b.gy - S * 0.2);
    ctx.lineTo(b.gx + S * 1.2, b.gy - S * 0.02);
    ctx.quadraticCurveTo(b.gx + S * 0.2, b.gy + S * 0.2, b.gx - S * 0.9, b.gy - S * 0.04);
    ctx.closePath();
    litFill(ctx, '#e8ecf4', '#9aa4b4', b.gy - S * 0.3, b.gy + S * 0.2);
    ctx.strokeStyle = rgba('#7f8a9a', 0.55); ctx.lineWidth = 1.2; ctx.stroke();
    // steps up to it
    for (let i = 0; i < 3; i++) {
      const w = S * (1.0 - i * 0.2);
      const y = b.gy - S * 0.2 - i * S * 0.1;
      ctx.beginPath(); ctx.rect(b.gx - w / 2, y - S * 0.1, w, S * 0.1);
      litFill(ctx, '#f0f4fa', '#b0bac8', y - S * 0.1, y);
      ctx.strokeStyle = rgba('#7f8a9a', 0.45); ctx.lineWidth = 0.9; ctx.stroke();
    }
    // five columns of falling heights, two snapped off
    const cols = [[-1.24, 1.5], [-0.66, 1.05], [0.0, 1.62], [0.66, 0.5], [1.26, 1.32]];
    for (const [ox, hs] of cols) {
      const x = b.gx + ox * S, h = S * hs, w = S * 0.19;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, b.gy - S * 0.5);
      ctx.lineTo(x - w * 0.44, b.gy - S * 0.5 - h);
      ctx.lineTo(x + w * 0.44, b.gy - S * 0.5 - h);
      ctx.lineTo(x + w / 2, b.gy - S * 0.5);
      ctx.closePath();
      litFill(ctx, '#f4f6fa', '#a8b2c0', b.gy - S * 0.5 - h, b.gy - S * 0.5);
      ctx.strokeStyle = rgba('#7f8a9a', 0.5); ctx.lineWidth = 1; ctx.stroke();
      // fluting
      ctx.strokeStyle = rgba('#9aa4b4', 0.5); ctx.lineWidth = 0.9;
      for (let k = -1; k <= 1; k++) {
        ctx.beginPath();
        ctx.moveTo(x + k * w * 0.24, b.gy - S * 0.52);
        ctx.lineTo(x + k * w * 0.22, b.gy - S * 0.5 - h * 0.96);
        ctx.stroke();
      }
      // capital, or a jagged break on the short one
      if (hs > 0.7) {
        ctx.beginPath(); ctx.rect(x - w * 0.78, b.gy - S * 0.5 - h - S * 0.12, w * 1.56, S * 0.12);
        litFill(ctx, '#ffffff', '#b8c2d0', b.gy - S * 0.5 - h - S * 0.12, b.gy - S * 0.5 - h);
        ctx.strokeStyle = rgba('#7f8a9a', 0.5); ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x - w * 0.44, b.gy - S * 0.5 - h);
        ctx.lineTo(x - w * 0.1, b.gy - S * 0.5 - h - S * 0.08);
        ctx.lineTo(x + w * 0.2, b.gy - S * 0.5 - h + S * 0.02);
        ctx.lineTo(x + w * 0.44, b.gy - S * 0.5 - h);
        ctx.closePath();
        ctx.fillStyle = '#c8d0dc'; ctx.fill();
      }
      // ivy climbing two of them
      if (ox < 0) {
        ctx.strokeStyle = rgba('#4f8f4f', 0.85); ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.moveTo(x, b.gy - S * 0.5);
        for (let k = 1; k <= 6; k++) {
          ctx.lineTo(x + Math.sin(k * 1.6) * w * 0.6, b.gy - S * 0.5 - (h / 6) * k);
        }
        ctx.stroke();
        for (let k = 0; k < 6; k++) {
          const lx = x + Math.sin(k * 1.6) * w * 0.6, ly = b.gy - S * 0.5 - (h / 6) * k;
          leafPath(ctx, lx, ly, S * 0.14, S * 0.07, k * 1.1);
          ctx.fillStyle = '#5f9e4f'; ctx.fill();
        }
      }
    }
    // a snapped architrave lying across two columns
    ctx.save();
    ctx.translate(b.gx - S * 0.6, b.gy - S * 1.72);
    ctx.rotate(-0.12);
    ctx.beginPath(); ctx.rect(-S * 0.7, 0, S * 1.4, S * 0.16);
    litFill(ctx, '#ffffff', '#b0bac8', 0, S * 0.16);
    ctx.strokeStyle = rgba('#7f8a9a', 0.5); ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    // clouds beneath: it is a SKY palace
    for (let i = 0; i < 5; i++) {
      ctx.save(); ctx.globalAlpha = 0.5;
      blob(ctx, b.gx + (rnd() - 0.5) * S * 3, b.gy + S * (0.1 + rnd() * 0.14), S * 0.5, S * 0.14, 9, 0.24, rnd);
      ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.restore();
    }
    radialGlow(ctx, b.gx, b.gy - S * 1.1, S * 2.2, '#dff0ff', 0.26);
    for (let i = 0; i < 14; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 3, b.gy - rnd() * S * 2, S * 0.06, '#ffffff', 0.7);
  };

  // Prism Flowers, Wonder #7
  PAINTERS.dome = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.4;
    groundShadow(ctx, b.gx, b.gy, S * 1.5, S * 0.36);
    const cy = b.gy - S * 0.24;
    // three interlocking glass shells -- the Trinity, not one bubble
    const shells = [[-0.42, 0.86, 0.9], [0.42, 0.86, 0.9], [0, 1.15, 1.0]];
    // stone ring base
    ctx.beginPath(); ctx.ellipse(b.gx, b.gy - S * 0.1, S * 1.25, S * 0.28, 0, 0, 6.3);
    litFill(ctx, '#dfe8f0', '#8f9aa8', b.gy - S * 0.4, b.gy);
    ctx.strokeStyle = rgba('#7f8a98', 0.6); ctx.lineWidth = 1.2; ctx.stroke();
    for (const [ox, hs, ws] of shells) {
      const x = b.gx + ox * S;
      ctx.beginPath();
      ctx.ellipse(x, cy, S * 0.62 * ws, S * hs, 0, Math.PI, 0);
      ctx.closePath();
      const gr = ctx.createLinearGradient(0, cy - S * hs, 0, cy);
      gr.addColorStop(0, rgba('#ffffff', 0.8));
      gr.addColorStop(0.45, rgba(d.tint, 0.55));
      gr.addColorStop(1, rgba('#8fd0ff', 0.4));
      ctx.fillStyle = gr; ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.85); ctx.lineWidth = 1.8; ctx.stroke();
      // meridians and one latitude, so it reads as glass panelling
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.ellipse(x, cy, S * 0.62 * ws * (1 - i * 0.2), S * hs, 0, Math.PI, 0);
        ctx.strokeStyle = rgba('#ffffff', 0.3); ctx.lineWidth = 1; ctx.stroke();
      }
      for (const t of [0.4, 0.72]) {
        ctx.beginPath();
        ctx.ellipse(x, cy - S * hs * t, S * 0.62 * ws * Math.sqrt(1 - t * t), S * 0.1 * ws, 0, 0, Math.PI);
        ctx.strokeStyle = rgba('#ffffff', 0.28); ctx.stroke();
      }
      // the prism flower inside
      const fy = cy - S * hs * 0.42;
      for (let k = 0; k < 7; k++) {
        petal(ctx, x, fy, S * 0.3 * ws, S * 0.11 * ws, (k / 7) * 6.283, 0.45);
        ctx.fillStyle = rgba(['#ff8fd0', '#ffd06f', '#8fffd0', '#8fc0ff', '#c9a8ff', '#ffa8a8', '#d0ff8f'][k], 0.85);
        ctx.fill();
      }
      ctx.beginPath(); ctx.arc(x, fy, S * 0.08 * ws, 0, 6.3);
      ctx.fillStyle = '#fffbe8'; ctx.fill();
      radialGlow(ctx, x, fy, S * 0.5 * ws, '#ffffff', 0.5);
    }
    // a spectrum arc thrown off the top
    for (let i = 0; i < 6; i++) {
      ctx.strokeStyle = rgba(['#ff5f6f', '#ff9f4f', '#ffe14f', '#6fdd7f', '#5fb0ff', '#9f7fff'][i], 0.55);
      ctx.lineWidth = S * 0.05;
      ctx.beginPath();
      ctx.arc(b.gx, cy - S * 0.9, S * (1.0 + i * 0.055), Math.PI * 1.15, Math.PI * 1.85);
      ctx.stroke();
    }
    radialGlow(ctx, b.gx, cy - S * 0.7, S * 2.2, '#ffe0ff', 0.34);
    for (let i = 0; i < 20; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 3, cy - rnd() * S * 1.8, S * 0.06, '#ffffff', 0.85);
  };

  // Water, Wonder #6
  PAINTERS.bottle = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.4;
    const W = S * 1.1, H = S * 1.7;
    groundShadow(ctx, b.gx, b.gy, W * 1.1, W * 0.3);
    // a stand of driftwood the bottle rests in
    ctx.strokeStyle = '#8f7458'; ctx.lineWidth = Math.max(2.4, S * 0.09); ctx.lineCap = 'round';
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(b.gx + s * W * 0.7, b.gy);
      ctx.quadraticCurveTo(b.gx + s * W * 0.5, b.gy - S * 0.3, b.gx + s * W * 0.24, b.gy - S * 0.16);
      ctx.stroke();
    }
    // the bottle body
    const body = () => {
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.2, b.gy - H * 0.86);
      ctx.quadraticCurveTo(b.gx - W * 0.62, b.gy - H * 0.62, b.gx - W * 0.56, b.gy - H * 0.2);
      ctx.quadraticCurveTo(b.gx - W * 0.5, b.gy - H * 0.02, b.gx, b.gy - H * 0.01);
      ctx.quadraticCurveTo(b.gx + W * 0.5, b.gy - H * 0.02, b.gx + W * 0.56, b.gy - H * 0.2);
      ctx.quadraticCurveTo(b.gx + W * 0.62, b.gy - H * 0.62, b.gx + W * 0.2, b.gy - H * 0.86);
      ctx.closePath();
    };
    body();
    ctx.save();
    ctx.clip();
    // the ocean inside: horizon, waves, a tiny island and a ship
    const oy = b.gy - H * 0.5;
    const gr = ctx.createLinearGradient(0, b.gy - H * 0.9, 0, b.gy);
    gr.addColorStop(0, '#a8dcff');
    gr.addColorStop(0.42, '#dff4ff');
    gr.addColorStop(0.44, shade(d.tint, 0.2));
    gr.addColorStop(1, shade(d.tint, -0.42));
    ctx.fillStyle = gr;
    ctx.fillRect(b.gx - W, b.gy - H, W * 2, H);
    // sun over the horizon
    radialGlow(ctx, b.gx + W * 0.22, oy - H * 0.14, W * 0.4, '#ffe9b0', 0.8);
    // island
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 0.5, oy);
    ctx.quadraticCurveTo(b.gx - W * 0.3, oy - H * 0.1, b.gx - W * 0.06, oy);
    ctx.closePath();
    ctx.fillStyle = '#7f6a4f'; ctx.fill();
    ctx.strokeStyle = '#4f8f4f'; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(b.gx - W * 0.28, oy); ctx.lineTo(b.gx - W * 0.3, oy - H * 0.09); ctx.stroke();
    for (let i = 0; i < 3; i++) {
      leafPath(ctx, b.gx - W * 0.3, oy - H * 0.09, W * 0.14, W * 0.05, -1 + i * 1.0);
      ctx.fillStyle = '#5fa84f'; ctx.fill();
    }
    // waves
    ctx.strokeStyle = rgba('#ffffff', 0.65);
    for (let i = 0; i < 7; i++) {
      const yy = oy + H * 0.05 + i * H * 0.06;
      ctx.lineWidth = 1.1 + i * 0.14;
      ctx.beginPath();
      ctx.moveTo(b.gx - W * 0.6, yy);
      ctx.bezierCurveTo(b.gx - W * 0.2, yy - H * 0.02, b.gx + W * 0.2, yy + H * 0.02, b.gx + W * 0.6, yy);
      ctx.stroke();
    }
    // a little ship
    ctx.fillStyle = '#5f4030';
    ctx.beginPath();
    ctx.moveTo(b.gx + W * 0.1, oy + H * 0.07);
    ctx.lineTo(b.gx + W * 0.34, oy + H * 0.07);
    ctx.lineTo(b.gx + W * 0.28, oy + H * 0.12);
    ctx.lineTo(b.gx + W * 0.16, oy + H * 0.12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#fff8e8';
    ctx.beginPath();
    ctx.moveTo(b.gx + W * 0.22, oy + H * 0.06);
    ctx.lineTo(b.gx + W * 0.22, oy - H * 0.05);
    ctx.lineTo(b.gx + W * 0.33, oy + H * 0.06);
    ctx.closePath(); ctx.fill();
    ctx.restore();
    // glass edge, specular streaks
    body();
    ctx.strokeStyle = rgba('#e8f8ff', 0.9); ctx.lineWidth = 2.2; ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.55); ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 0.34, b.gy - H * 0.18);
    ctx.quadraticCurveTo(b.gx - W * 0.46, b.gy - H * 0.5, b.gx - W * 0.24, b.gy - H * 0.76);
    ctx.stroke();
    // neck, rope and cork
    ctx.beginPath();
    ctx.rect(b.gx - W * 0.2, b.gy - H * 1.06, W * 0.4, H * 0.22);
    ctx.fillStyle = rgba('#cfe8ff', 0.4); ctx.fill();
    ctx.strokeStyle = rgba('#e8f8ff', 0.85); ctx.lineWidth = 1.8; ctx.stroke();
    roundRect(ctx, b.gx - W * 0.19, b.gy - H * 1.2, W * 0.38, H * 0.16, W * 0.05);
    litFill(ctx, '#d8a86f', '#8f6a3f', b.gy - H * 1.2, b.gy - H * 1.04);
    ctx.strokeStyle = rgba('#5f4520', 0.7); ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = rgba('#c9b490', 0.9); ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(b.gx - W * 0.22, b.gy - H * 0.99); ctx.lineTo(b.gx + W * 0.22, b.gy - H * 0.99); ctx.stroke();
    radialGlow(ctx, b.gx, b.gy - H * 0.5, W * 1.8, '#8fd0ff', 0.28);
    for (let i = 0; i < 12; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * W * 2.2, b.gy - rnd() * H * 1.2, W * 0.05, '#ffffff', 0.8);
  };

  // Fruit Trees, Wonder #8
  PAINTERS.beanstalk = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.4;
    const H = b.th * 0.95;
    groundShadow(ctx, b.gx, b.gy, S * 1.2, S * 0.32);
    // two vines braiding up, each drawn as a filled ribbon so it has volume
    for (const s of [-1, 1]) {
      const pts = [];
      for (let i = 0; i <= 16; i++) {
        const t = i / 16;
        pts.push([b.gx + Math.sin(t * 7.2 + (s > 0 ? 0 : Math.PI)) * S * 0.34, b.gy - H * t]);
      }
      const w = S * 0.13;
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x - w, y) : ctx.moveTo(x - w, y)));
      for (let i = pts.length - 1; i >= 0; i--) ctx.lineTo(pts[i][0] + w, pts[i][1]);
      ctx.closePath();
      litFill(ctx, s > 0 ? '#7fc75f' : '#5fa84f', '#316a2f', b.gy - H, b.gy);
      ctx.strokeStyle = rgba('#265a24', 0.5); ctx.lineWidth = 1; ctx.stroke();
      // tendrils curling off
      ctx.strokeStyle = rgba('#8fd06a', 0.9); ctx.lineWidth = 1.4; ctx.lineCap = 'round';
      for (let i = 2; i < 16; i += 3) {
        const [x, y] = pts[i];
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + s * S * 0.3, y - S * 0.1, x + s * S * 0.22, y - S * 0.28);
        ctx.stroke();
      }
    }
    // big leaves alternating up the stalk
    for (let i = 0; i < 12; i++) {
      const t = 0.08 + (i / 12) * 0.88;
      const s = i % 2 ? 1 : -1;
      const lx = b.gx + Math.sin(t * 7.2) * S * 0.34, ly = b.gy - H * t;
      leafPath(ctx, lx, ly, S * (0.6 - t * 0.16), S * (0.28 - t * 0.06), s * 1.25);
      litFill(ctx, '#9fe07f', '#3f7f3a', ly - S * 0.6, ly);
      ctx.strokeStyle = rgba('#2f6a2c', 0.45); ctx.lineWidth = 0.9; ctx.stroke();
      // vein
      ctx.strokeStyle = rgba('#d0ffb0', 0.5); ctx.lineWidth = 0.9;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + s * S * (0.5 - t * 0.14), ly - S * 0.16);
      ctx.stroke();
      // a bean pod on a few of them
      if (i % 4 === 1) {
        ctx.beginPath();
        ctx.ellipse(lx + s * S * 0.2, ly + S * 0.1, S * 0.06, S * 0.16, s * 0.4, 0, 6.3);
        litFill(ctx, '#c9e08f', '#7f9e4f', ly, ly + S * 0.24);
        ctx.strokeStyle = rgba('#4f6f2f', 0.6); ctx.lineWidth = 0.8; ctx.stroke();
      }
    }
    // the cloud it disappears into, with a castle gate above
    for (let i = 0; i < 7; i++) {
      const cx = b.gx + (rnd() - 0.5) * S * 2.2;
      const cy = b.gy - H * (0.92 + rnd() * 0.1);
      ctx.save(); ctx.globalAlpha = 0.75;
      blob(ctx, cx, cy, S * (0.4 + rnd() * 0.3), S * (0.16 + rnd() * 0.1), 9, 0.22, rnd);
      ctx.fillStyle = i % 2 ? '#ffffff' : '#e8f0ff'; ctx.fill();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(b.gx - S * 0.3, b.gy - H * 1.0);
    ctx.lineTo(b.gx - S * 0.3, b.gy - H * 1.14);
    ctx.lineTo(b.gx, b.gy - H * 1.24);
    ctx.lineTo(b.gx + S * 0.3, b.gy - H * 1.14);
    ctx.lineTo(b.gx + S * 0.3, b.gy - H * 1.0);
    ctx.closePath();
    litFill(ctx, '#fff4d0', '#c9b48f', b.gy - H * 1.24, b.gy - H);
    ctx.strokeStyle = rgba('#8f7f5f', 0.6); ctx.lineWidth = 1; ctx.stroke();
    radialGlow(ctx, b.gx, b.gy - H * 1.05, S * 1.8, '#ffffcf', 0.42);
    for (let i = 0; i < 16; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 2.4, b.gy - H * (0.4 + rnd() * 0.7), S * 0.06, '#ffffff', 0.7);
  };

  // Life Flowers, Wonder #2
  PAINTERS.rainbow = (ctx, b, d, rnd) => {
    const R = Math.min(b.tw, b.th * 1.7) * 0.5;
    groundShadow(ctx, b.gx, b.gy, R * 1.1, R * 0.26);
    // clouds anchoring both feet, drawn first
    for (const s of [-1, 1]) {
      for (let i = 0; i < 4; i++) {
        ctx.save(); ctx.globalAlpha = 0.9;
        blob(ctx, b.gx + s * R * (0.82 + rnd() * 0.2), b.gy - R * (0.02 + rnd() * 0.12), R * (0.2 + rnd() * 0.12), R * (0.09 + rnd() * 0.05), 8, 0.24, rnd);
        ctx.fillStyle = i % 2 ? '#ffffff' : '#e8f0ff'; ctx.fill();
        ctx.restore();
      }
    }
    // the bow: seven bands with soft inner edges, painted as filled arcs
    const cols = ['#ff5f6f', '#ff9f4f', '#ffe14f', '#7fe07f', '#5fb0ff', '#7f7fff', '#b06fff'];
    for (let i = 0; i < cols.length; i++) {
      const r0 = R - i * R * 0.1;
      ctx.beginPath();
      ctx.arc(b.gx, b.gy, r0, Math.PI, 0);
      ctx.arc(b.gx, b.gy, r0 - R * 0.1, 0, Math.PI, true);
      ctx.closePath();
      const gr = ctx.createLinearGradient(b.gx - r0, 0, b.gx + r0, 0);
      gr.addColorStop(0, rgba(cols[i], 0.75));
      gr.addColorStop(0.5, rgba(cols[i], 0.95));
      gr.addColorStop(1, rgba(cols[i], 0.75));
      ctx.fillStyle = gr;
      ctx.fill();
    }
    // a fainter second bow inside, as real double rainbows have
    ctx.save();
    ctx.globalAlpha = 0.3;
    for (let i = 0; i < cols.length; i++) {
      ctx.strokeStyle = cols[cols.length - 1 - i];
      ctx.lineWidth = R * 0.045;
      ctx.beginPath();
      ctx.arc(b.gx, b.gy, R * 0.28 - i * R * 0.03, Math.PI, 0);
      ctx.stroke();
    }
    ctx.restore();
    // light spilling from under the arch
    const gr2 = ctx.createRadialGradient(b.gx, b.gy, 0, b.gx, b.gy, R);
    gr2.addColorStop(0, rgba('#ffffff', 0.4));
    gr2.addColorStop(1, rgba('#ffffff', 0));
    ctx.fillStyle = gr2;
    ctx.beginPath(); ctx.arc(b.gx, b.gy, R * 0.7, Math.PI, 0); ctx.fill();
    // flowers blooming under it -- this is the Life Flower chain's Wonder
    for (let i = 0; i < 9; i++) {
      const px = b.gx + (rnd() - 0.5) * R * 1.3, py = b.gy - rnd() * R * 0.12;
      const pr = R * (0.035 + rnd() * 0.02);
      for (let k = 0; k < 5; k++) {
        petal(ctx, px, py, pr * 2, pr * 0.8, (k / 5) * 6.283, 0.4);
        ctx.fillStyle = ['#ff9fc0', '#ffd06f', '#c9a8ff'][i % 3]; ctx.fill();
      }
      ctx.beginPath(); ctx.arc(px, py, pr * 0.5, 0, 6.3);
      ctx.fillStyle = '#fffbe8'; ctx.fill();
    }
    for (let i = 0; i < 30; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * R * 2.1, b.gy - rnd() * R * 1.1, R * 0.05, '#ffffff', 0.8);
  };

  // Grass, Wonder #3 -- the sword that slayed Bahamut, in a stone.
  PAINTERS.sword = (ctx, b, d, rnd) => {
    const S = Math.min(b.tw, b.th) * 0.4;
    const H = b.th * 0.86, W = S * 0.16;
    groundShadow(ctx, b.gx, b.gy, S * 1.2, S * 0.32);
    // the stone it is driven into
    blob(ctx, b.gx, b.gy - S * 0.22, S * 0.7, S * 0.3, 8, 0.16, rnd);
    litFill(ctx, '#a8a094', '#57514a', b.gy - S * 0.55, b.gy);
    ctx.strokeStyle = rgba('#332e28', 0.5); ctx.lineWidth = 1.2; ctx.stroke();
    // grass and flowers around the stone
    ctx.lineCap = 'round';
    for (let i = 0; i < 18; i++) {
      const px = b.gx + (rnd() - 0.5) * S * 1.6;
      const hh = S * (0.16 + rnd() * 0.3);
      ctx.strokeStyle = rnd() < 0.5 ? '#5fa84f' : '#7fc75f';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(px, b.gy - S * 0.02);
      ctx.quadraticCurveTo(px + (rnd() - 0.5) * S * 0.2, b.gy - hh * 0.6, px + (rnd() - 0.5) * S * 0.3, b.gy - hh);
      ctx.stroke();
    }
    // vines wrapping the blade
    // the blade itself: a long tapered lens with a fuller down the middle
    ctx.beginPath();
    ctx.moveTo(b.gx, b.gy - H);
    ctx.quadraticCurveTo(b.gx + W * 1.3, b.gy - H * 0.7, b.gx + W, b.gy - H * 0.24);
    ctx.lineTo(b.gx - W, b.gy - H * 0.24);
    ctx.quadraticCurveTo(b.gx - W * 1.3, b.gy - H * 0.7, b.gx, b.gy - H);
    ctx.closePath();
    litFill(ctx, '#ffffff', '#8f9ead', b.gy - H, b.gy - H * 0.2);
    ctx.strokeStyle = rgba('#5f6a78', 0.6); ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = rgba('#6f7a88', 0.5); ctx.lineWidth = Math.max(1.4, W * 0.3);
    ctx.beginPath(); ctx.moveTo(b.gx, b.gy - H * 0.94); ctx.lineTo(b.gx, b.gy - H * 0.3); ctx.stroke();
    ctx.strokeStyle = rgba('#ffffff', 0.9); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(b.gx - W * 0.5, b.gy - H * 0.9); ctx.lineTo(b.gx - W * 0.62, b.gy - H * 0.32); ctx.stroke();
    // crossguard: swept, with a gem
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 3.4, b.gy - H * 0.2);
    ctx.quadraticCurveTo(b.gx, b.gy - H * 0.3, b.gx + W * 3.4, b.gy - H * 0.2);
    ctx.quadraticCurveTo(b.gx, b.gy - H * 0.15, b.gx - W * 3.4, b.gy - H * 0.2);
    ctx.closePath();
    litFill(ctx, '#ffe9a8', '#a8791f', b.gy - H * 0.3, b.gy - H * 0.14);
    ctx.strokeStyle = rgba('#6f5010', 0.7); ctx.lineWidth = 1; ctx.stroke();
    for (const s of [-1, 1]) {
      ctx.beginPath(); ctx.arc(b.gx + s * W * 3.2, b.gy - H * 0.2, W * 0.5, 0, 6.3);
      ctx.fillStyle = '#e0384f'; ctx.fill();
      ctx.strokeStyle = rgba('#ffffff', 0.6); ctx.lineWidth = 0.8; ctx.stroke();
    }
    // grip and pommel
    roundRect(ctx, b.gx - W * 0.7, b.gy - H * 0.18, W * 1.4, H * 0.12, W * 0.4);
    litFill(ctx, '#7f4f38', '#3f2418', b.gy - H * 0.18, b.gy - H * 0.06);
    ctx.strokeStyle = rgba('#2a170e', 0.7); ctx.lineWidth = 0.9; ctx.stroke();
    // vines climbing the blade
    ctx.strokeStyle = '#4f8f3f'; ctx.lineWidth = Math.max(1.6, W * 0.5); ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(b.gx - W * 1.4, b.gy - H * 0.2);
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      ctx.lineTo(b.gx + Math.sin(i * 1.9) * W * 1.5, b.gy - H * (0.2 + t * 0.62));
    }
    ctx.stroke();
    for (let i = 1; i <= 6; i++) {
      const t = i / 6;
      const lx = b.gx + Math.sin(i * 1.9) * W * 1.5, ly = b.gy - H * (0.2 + t * 0.62);
      leafPath(ctx, lx, ly, S * 0.22, S * 0.1, (i % 2 ? 1 : -1) * 1.2);
      litFill(ctx, '#8fd06a', '#3f7a3a', ly - S * 0.24, ly);
    }
    // the light off the point
    radialGlow(ctx, b.gx, b.gy - H * 0.98, S * 1.2, '#dff0ff', 0.6);
    radialGlow(ctx, b.gx, b.gy - H * 0.55, S * 1.5, '#dff0ff', 0.24);
    for (let i = 0; i < 14; i++) sparkle(ctx, b.gx + (rnd() - 0.5) * S * 1.6, b.gy - H * (0.3 + rnd() * 0.75), S * 0.07, '#ffffff', 0.85);
  };
}
