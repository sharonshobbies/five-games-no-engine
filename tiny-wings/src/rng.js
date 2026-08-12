// Tiny deterministic PRNG (mulberry32) + helpers.
// Every island's terrain, coin layout and cloud layout derives from a seed, so a
// given run number reproduces exactly the same world.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rngRange(rnd, lo, hi) {
  return lo + rnd() * (hi - lo);
}

export function rngPick(rnd, arr) {
  return arr[Math.min(arr.length - 1, Math.floor(rnd() * arr.length))];
}

// Cheap stable hash -> [0,1) for "give me a number for integer key n"
export function hash01(n) {
  let x = Math.imul(n ^ 0x9e3779b9, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return (x >>> 0) / 4294967296;
}

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (t) => {
  t = clamp(t, 0, 1);
  return t * t * (3 - 2 * t);
};
