// artlib.js -- low-level procedural drawing helpers shared by every painter.
// Everything in this game is drawn with 2D canvas paths and gradients; there are
// no image assets anywhere.

export const DPR = Math.min(2, (typeof devicePixelRatio === 'number' ? devicePixelRatio : 1) || 1);

export function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * DPR));
  c.height = Math.max(1, Math.round(h * DPR));
  const ctx = c.getContext('2d');
  ctx.scale(DPR, DPR);
  c._cw = w; c._ch = h;
  return { canvas: c, ctx, w, h };
}

// ---------------------------------------------------------------------------
// colour utilities
// ---------------------------------------------------------------------------
export function hex2rgb(h) {
  h = h.replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
export function rgb2hex(r, g, b) {
  const f = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0');
  return `#${f(r)}${f(g)}${f(b)}`;
}
export function shade(hex, amt) {
  const [r, g, b] = hex2rgb(hex);
  if (amt >= 0) return rgb2hex(r + (255 - r) * amt, g + (255 - g) * amt, b + (255 - b) * amt);
  const k = 1 + amt;
  return rgb2hex(r * k, g * k, b * k);
}
export function mix(a, b, t) {
  const A = hex2rgb(a), B = hex2rgb(b);
  return rgb2hex(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
export function rgba(hex, a) {
  const [r, g, b] = hex2rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}
export function hueShift(hex, deg) {
  let [r, g, b] = hex2rgb(hex).map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0; const l = (max + min) / 2; const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
  }
  h = (h * 60 + deg + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = l - c / 2;
  let rr, gg, bb;
  if (h < 60) [rr, gg, bb] = [c, x, 0];
  else if (h < 120) [rr, gg, bb] = [x, c, 0];
  else if (h < 180) [rr, gg, bb] = [0, c, x];
  else if (h < 240) [rr, gg, bb] = [0, x, c];
  else if (h < 300) [rr, gg, bb] = [x, 0, c];
  else [rr, gg, bb] = [c, 0, x];
  return rgb2hex((rr + m) * 255, (gg + m) * 255, (bb + m) * 255);
}

// ---------------------------------------------------------------------------
// deterministic pseudo-random, so a sprite always looks the same
// ---------------------------------------------------------------------------
export function rngFrom(seed) {
  let s = (seed | 0) || 1;
  return function () {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}
export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
  return h >>> 0;
}

// ---------------------------------------------------------------------------
// shapes
// ---------------------------------------------------------------------------
export function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// A soft organic blob: n lobes with radius jitter, closed with quadratic curves.
export function blob(ctx, cx, cy, rx, ry, n, jitter, rnd, rot = 0) {
  ctx.beginPath();
  const pts = [];
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const k = 1 + (rnd() - 0.5) * 2 * jitter;
    pts.push([cx + Math.cos(a) * rx * k, cy + Math.sin(a) * ry * k]);
  }
  ctx.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
  for (let i = 0; i < n; i++) {
    const p = pts[i], q = pts[(i + 1) % n];
    ctx.quadraticCurveTo(p[0], p[1], (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
  }
  ctx.closePath();
}

// A single petal pointing "up" from (cx,cy), length L, width W, rotated by a.
export function petal(ctx, cx, cy, L, W, a, curl = 0.35) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-W, -L * curl, -W * 0.85, -L * 0.82, 0, -L);
  ctx.bezierCurveTo(W * 0.85, -L * 0.82, W, -L * curl, 0, 0);
  ctx.closePath();
  ctx.restore();
}

// Pointed leaf shape from (0,0) to (0,-L).
export function leafPath(ctx, cx, cy, L, W, a) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(-W, -L * 0.45, 0, -L);
  ctx.quadraticCurveTo(W, -L * 0.45, 0, 0);
  ctx.closePath();
  ctx.restore();
}

export function starPath(ctx, cx, cy, spikes, outer, inner, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const r = i % 2 ? inner : outer;
    const a = rot + (i / (spikes * 2)) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  }
  ctx.closePath();
}

// ---------------------------------------------------------------------------
// lighting / atmosphere
// ---------------------------------------------------------------------------
export function radialGlow(ctx, cx, cy, r, color, alpha = 0.5, stops) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  if (stops) { for (const [p, c] of stops) g.addColorStop(p, c); }
  else {
    g.addColorStop(0, rgba(color, alpha));
    g.addColorStop(0.45, rgba(color, alpha * 0.45));
    g.addColorStop(1, rgba(color, 0));
  }
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();
}

// Soft contact shadow ellipse under an object.
export function groundShadow(ctx, cx, cy, rx, ry, alpha = 0.38) {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  g.addColorStop(0, `rgba(38,28,44,${alpha})`);
  g.addColorStop(0.6, `rgba(38,28,44,${alpha * 0.5})`);
  g.addColorStop(1, 'rgba(38,28,44,0)');
  ctx.save();
  ctx.translate(cx, cy); ctx.scale(1, ry / rx); ctx.translate(-cx, -cy);
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(cx, cy, rx, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Fill the current path with a top-lit vertical gradient.
export function litFill(ctx, top, bottom, y0, y1) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  ctx.fillStyle = g;
  ctx.fill();
}

// Rim light: stroke only the upper-left of the current path.
export function rim(ctx, color, w = 1.5, alpha = 0.55) {
  ctx.save();
  ctx.strokeStyle = rgba(color, alpha);
  ctx.lineWidth = w;
  ctx.stroke();
  ctx.restore();
}

// Painterly speckle inside the current clip.
export function speckle(ctx, x, y, w, h, color, n, rnd, rmin = 0.6, rmax = 2.2) {
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w, py = y + rnd() * h, r = rmin + rnd() * (rmax - rmin);
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  }
}

export function sparkle(ctx, cx, cy, r, color, alpha = 0.9) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = rgba(color, alpha);
  ctx.beginPath();
  ctx.moveTo(cx, cy - r);
  ctx.quadraticCurveTo(cx + r * 0.16, cy - r * 0.16, cx + r, cy);
  ctx.quadraticCurveTo(cx + r * 0.16, cy + r * 0.16, cx, cy + r);
  ctx.quadraticCurveTo(cx - r * 0.16, cy + r * 0.16, cx - r, cy);
  ctx.quadraticCurveTo(cx - r * 0.16, cy - r * 0.16, cx, cy - r);
  ctx.fill();
  ctx.restore();
}

// Rounded outline used for the "living thing" halo.
export function auraRing(ctx, cx, cy, r, color, alpha = 0.35) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  radialGlow(ctx, cx, cy, r, color, alpha);
  ctx.restore();
}
