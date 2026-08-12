// Deterministic RNG + value noise, so a seed always makes the same planet.

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

export function hash2(x, y, seed) {
  // Math.imul keeps the multiply in 32-bit: a plain `*` overflows to a float
  // and throws away the high bits, which leaves visible blocky correlation.
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(seed | 0, 1274126177)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

/** 2D value noise on a lattice of `scale` tiles. */
export function noise2(x, y, seed, scale) {
  const fx = x / scale, fy = y / scale;
  const x0 = Math.floor(fx), y0 = Math.floor(fy);
  const tx = smooth(fx - x0), ty = smooth(fy - y0);
  const a = hash2(x0, y0, seed), b = hash2(x0 + 1, y0, seed);
  const c = hash2(x0, y0 + 1, seed), d = hash2(x0 + 1, y0 + 1, seed);
  return (a + (b - a) * tx) * (1 - ty) + (c + (d - c) * tx) * ty;
}

export function fbm(x, y, seed, scale, octaves = 3) {
  let sum = 0, amp = 1, norm = 0, s = scale;
  for (let i = 0; i < octaves; i++) {
    sum += noise2(x, y, seed + i * 7919, s) * amp;
    norm += amp;
    amp *= 0.5;
    s *= 0.5;
  }
  return sum / norm;
}
