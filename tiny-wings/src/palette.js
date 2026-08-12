// Per-island colour palettes.
//
// The original Tiny Wings re-rolls its palettes procedurally every day; each island
// in a run has its own hue family. We keep a hand-tuned base set (bright, saturated,
// two-tone striped hills the way the original reads) and then rotate/jitter it with
// the day seed so a run on a different day genuinely looks different.

import { mulberry32, clamp, lerp } from './rng.js';

export const ISLAND_NAMES = [
  'Meadow', 'Sunburst', 'Lavender', 'Lagoon', 'Coral',
  'Deep Blue', 'Honey', 'Mint', 'Ember', 'Twilight',
  'Frost', 'Jungle',
];

// hills: [darkStripe, lightStripe, topRim]  sky: [zenith, horizon]  water: [deep, foam]
//
// The look leans on one thing hard: the horizon end of the sky gradient is nearly white
// so the saturated hills punch against it, the way the original's do. Hill dark/light
// are a real two-tone pair (not two shades of the same value) because the stripes are
// the whole visual identity.
// Every row deliberately pairs the hills with a sky from a DIFFERENT hue family. Green
// hills under a green sky turns the whole screen into one wash and the bird disappears
// into it; the original always keeps a strong figure/ground split between the hills, the
// sky and the sea.
const BASE = [
  // green hills, blue sky
  { sky: ['#1e93ec', '#d3f0ff'], hills: ['#26762c', '#7cc244', '#d2f193'], water: ['#1470b8', '#93e2f7'], sun: '#fff6bd', cloud: '#ffffff' },
  // orange-red hills, cyan sky
  { sky: ['#1a9ed6', '#defaff'], hills: ['#ab3410', '#ee7a29', '#ffcb78'], water: ['#12729e', '#a6ecff'], sun: '#fff6cc', cloud: '#f4feff' },
  // purple hills, gold sky
  { sky: ['#f2a824', '#fff2d4'], hills: ['#561f85', '#a253d2', '#e2b0f8'], water: ['#2c53a8', '#a8cef5'], sun: '#fffbe8', cloud: '#fff6e4' },
  // teal hills, coral sky
  { sky: ['#f36f57', '#ffe4d6'], hills: ['#04656b', '#1fbcab', '#96f0d4'], water: ['#0a6f92', '#a4f4f0'], sun: '#fff2d8', cloud: '#fff0e8' },
  // crimson-pink hills, cool blue sky
  { sky: ['#2f80d2', '#dcefff'], hills: ['#8f0f4b', '#e6538a', '#ffabc6'], water: ['#1e5fa8', '#a8d8fa'], sun: '#fff2cc', cloud: '#f2f9ff' },
  // deep blue hills, warm cream sky
  { sky: ['#ffb23c', '#fff4dd'], hills: ['#0b3a70', '#2f7fd0', '#9ccdf7'], water: ['#0d4f8c', '#8fd4f5'], sun: '#fffaea', cloud: '#fff6e6' },
  // gold hills, azure sky
  { sky: ['#1c86dc', '#d8efff'], hills: ['#9e6209', '#e2ab1c', '#ffe485'], water: ['#1266a8', '#9ee0fa'], sun: '#fffce6', cloud: '#f2faff' },
  // mint-green hills, peach sky
  { sky: ['#f5913c', '#ffeacf'], hills: ['#115b32', '#4cb64c', '#b0ec92'], water: ['#0d7f7a', '#a8f0dc'], sun: '#fff8e0', cloud: '#fff2e4' },
  // ember-orange hills, indigo sky
  { sky: ['#3c54ba', '#d0dcff'], hills: ['#701807', '#cd4614', '#ff9c52'], water: ['#23347f', '#96b2f2'], sun: '#ffeec4', cloud: '#eaf0ff' },
  // violet hills, mint sky
  { sky: ['#2ec29c', '#defff2'], hills: ['#241d6b', '#5d50c4', '#a79af2'], water: ['#1d6f8c', '#9ce8ea'], sun: '#f4ffe4', cloud: '#effff8' },
  // slate-blue hills, rose sky
  { sky: ['#e05c86', '#ffdce6'], hills: ['#1d4e70', '#5fa5cc', '#c6ecff'], water: ['#22587f', '#b6e6ff'], sun: '#fff0e0', cloud: '#ffeef4' },
  // jungle hills, turquoise sky
  { sky: ['#11a9ca', '#dcf8ff'], hills: ['#0a4620', '#2b8f31', '#8bda6d'], water: ['#0d6f8c', '#a2ecf2'], sun: '#fffbd6', cloud: '#f0fdff' },
];

export function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  ];
}

function rgbToHsl(r, g, b) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  let h = 0, s = 0;
  if (mx !== mn) {
    const d = mx - mn;
    s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    if (mx === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (mx === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return [h, s, l];
}

function hue2rgb(p, q, t) {
  if (t < 0) t += 1;
  if (t > 1) t -= 1;
  if (t < 1 / 6) return p + (q - p) * 6 * t;
  if (t < 1 / 2) return q;
  if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
  return p;
}

function hslToRgb(h, s, l) {
  if (s === 0) return [l, l, l];
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

function shiftRgb(rgb, hueShift, satMul, ligAdd) {
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  return hslToRgb((h + hueShift + 1) % 1, clamp(s * satMul, 0, 1), clamp(l + ligAdd, 0.02, 0.99));
}

function conv(entry, hueShift, satMul, ligAdd) {
  const map = (hex) => shiftRgb(hexToRgb(hex), hueShift, satMul, ligAdd);
  return {
    sky: entry.sky.map(map),
    hills: entry.hills.map(map),
    water: entry.water.map(map),
    sun: map(entry.sun),
    cloud: map(entry.cloud),
  };
}

/**
 * Build the palette list for one "day". A day seed rotates which base family each
 * island index gets, and nudges hue/saturation, so islands stay distinct from each
 * other while the whole day has its own tint.
 *
 * Island 1 always keeps the green meadow family — that is the original's signature
 * opening shot — and the rotation applies from island 2 onward.
 */
export function buildDayPalettes(daySeed, count = 24) {
  const rnd = mulberry32(daySeed >>> 0);
  const rotate = Math.floor(rnd() * (BASE.length - 1));
  const dayHue = (rnd() - 0.5) * 0.05;
  const daySat = 0.96 + rnd() * 0.14;
  const out = [];
  for (let i = 0; i < count; i++) {
    // Island 1 is pinned to family 0, so islands 2..12 permute the remaining eleven.
    // Stride 5 is coprime with 11, so each appears exactly once before anything repeats.
    const bi = i === 0 ? 0 : 1 + ((rotate + i * 5) % (BASE.length - 1));
    const base = BASE[bi];
    const jitter = i === 0 ? 0 : (mulberry32(daySeed + i * 7919)() - 0.5) * 0.035;
    // later islands read slightly deeper / more dramatic
    const deepen = -0.02 * Math.min(1, i / 10);
    out.push({
      name: ISLAND_NAMES[bi % ISLAND_NAMES.length],
      ...conv(base, (i === 0 ? 0 : dayHue) + jitter, i === 0 ? 1 : daySat, deepen),
    });
  }
  return out;
}

// Night target colours everything grades toward as the sun goes down.
export const NIGHT = {
  sky: [[0.035, 0.045, 0.13], [0.10, 0.12, 0.28]],
  hills: [[0.05, 0.07, 0.17], [0.10, 0.13, 0.27], [0.17, 0.21, 0.38]],
  water: [[0.03, 0.05, 0.15], [0.14, 0.19, 0.36]],
  sun: [0.85, 0.88, 1.0],
  cloud: [0.30, 0.34, 0.52],
};

// Golden-hour tint the scene passes through on the way to night.
export const DUSK = {
  sky: [[0.62, 0.29, 0.36], [1.0, 0.66, 0.38]],
  hills: [[0.32, 0.14, 0.22], [0.62, 0.29, 0.26], [0.95, 0.58, 0.35]],
  water: [[0.28, 0.15, 0.28], [0.95, 0.6, 0.45]],
  sun: [1.0, 0.72, 0.35],
  cloud: [1.0, 0.78, 0.62],
};

export function mixRgb(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

/**
 * Grade a palette by darkness 0..1: day -> dusk (golden hour around 0.55) -> night.
 * Deliberately flat for the first third so a healthy run genuinely looks like daytime.
 */
export function gradePalette(p, darkness) {
  const d = clamp(darkness, 0, 1);
  const ss = (t) => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
  const duskAmt = ss((d - 0.22) / 0.42) * (1 - ss((d - 0.66) / 0.30)) * 0.80;
  const nightAmt = ss((d - 0.52) / 0.48);
  const nightAmt2 = nightAmt;
  const g = (c, dusk, night) => mixRgb(mixRgb(c, dusk, duskAmt), night, nightAmt2);
  return {
    name: p.name,
    sky: [g(p.sky[0], DUSK.sky[0], NIGHT.sky[0]), g(p.sky[1], DUSK.sky[1], NIGHT.sky[1])],
    hills: [
      g(p.hills[0], DUSK.hills[0], NIGHT.hills[0]),
      g(p.hills[1], DUSK.hills[1], NIGHT.hills[1]),
      g(p.hills[2], DUSK.hills[2], NIGHT.hills[2]),
    ],
    water: [g(p.water[0], DUSK.water[0], NIGHT.water[0]), g(p.water[1], DUSK.water[1], NIGHT.water[1])],
    sun: g(p.sun, DUSK.sun, NIGHT.sun),
    cloud: g(p.cloud, DUSK.cloud, NIGHT.cloud),
  };
}

export function rgbCss(c) {
  const q = (v) => Math.round(clamp(v, 0, 1) * 255);
  return `rgb(${q(c[0])},${q(c[1])},${q(c[2])})`;
}
