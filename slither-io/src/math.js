// Small math helpers. No allocations in the hot paths.

export const TAU = Math.PI * 2;

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Shortest signed difference from angle a to angle b, in (-PI, PI]. */
export function angleDelta(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  else if (d < -Math.PI) d += TAU;
  return d;
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function turnToward(from, to, maxStep) {
  const d = angleDelta(from, to);
  if (d > maxStep) return from + maxStep;
  if (d < -maxStep) return from - maxStep;
  return to;
}

export function dist2(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

// -------------------------------------------------------- deterministic-ish rng
export function makeRng(seed) {
  let s = seed >>> 0 || 0x9e3779b9;
  return function rng() {
    s ^= s << 13;
    s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 4294967296;
  };
}

export function randRange(rng, a, b) {
  return a + (b - a) * rng();
}

export function pick(rng, arr) {
  return arr[(rng() * arr.length) | 0];
}

// -------------------------------------------------------- colour
/** '#rrggbb' -> [r,g,b] in 0..1 */
export function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function rgbToCss(rgb) {
  const c = (v) => Math.round(clamp(v, 0, 1) * 255);
  return `rgb(${c(rgb[0])},${c(rgb[1])},${c(rgb[2])})`;
}

export function mixRgb(a, b, t, out) {
  out[0] = a[0] + (b[0] - a[0]) * t;
  out[1] = a[1] + (b[1] - a[1]) * t;
  out[2] = a[2] + (b[2] - a[2]) * t;
  return out;
}

/** Random saturated neon colour, as [r,g,b] 0..1. */
export function neon(rng) {
  const h = rng();
  const s = 0.72 + rng() * 0.28;
  const l = 0.55 + rng() * 0.15;
  return hslToRgb(h, s, l);
}

export function hslToRgb(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h * 12) % 12;
    return l - a * Math.max(-1, Math.min(Math.min(k - 3, 9 - k), 1));
  };
  return [f(0), f(8), f(4)];
}
