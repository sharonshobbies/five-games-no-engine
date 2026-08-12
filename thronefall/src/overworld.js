// The overworld: a drawn map of the realm, not a grid of cards.
//
// The whole thing is generated here, in the same terms the 3D game uses — a
// seeded landmass, a faceted triangle mesh painted one flat colour per face
// from height and biome, and the holdings joined by roads. It is SVG rather
// than WebGL because it is a menu, but every colour comes out of palette.js and
// every shape is computed, so it reads as the same world seen from higher up.

import { LEVELS, mulberry } from './levels.js';
import { BIOMES, C } from './palette.js';

const W = 1200;
const H = 680;

// The Eternal Trials sit off the north-east corner of the realm.
const TRIALS_AT = { x: 0.885, y: 0.125 };

const hex = (v) => '#' + (v >>> 0).toString(16).padStart(6, '0');

/** Seeded 2D value noise, smoothed — the same construction levels.js uses. */
function makeNoise(seed) {
  const rnd = mulberry(seed);
  const N = 128;
  const p = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) p[i] = rnd();
  const at = (i, j) => p[((j & (N - 1)) * N + (i & (N - 1)))];
  const sm = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return (a * (1 - xf) + b * xf) * (1 - yf) + (c * (1 - xf) + d * xf) * yf;
  };
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function mix(hexA, hexB, t) {
  const ar = (hexA >> 16) & 255, ag = (hexA >> 8) & 255, ab = hexA & 255;
  const br = (hexB >> 16) & 255, bg = (hexB >> 8) & 255, bb = hexB & 255;
  return ((Math.round(ar + (br - ar) * t) << 16)
    | (Math.round(ag + (bg - ag) * t) << 8)
    | Math.round(ab + (bb - ab) * t));
}

// --------------------------------------------------------------------- terrain
const REGIONS = [
  { biome: 'snow', kind: 'band', y: 0.255, feather: 0.085 },
  { biome: 'desert', kind: 'blob', x: 0.40, y: 0.725, rx: 0.17, ry: 0.20 },
  { biome: 'desert', kind: 'blob', x: 0.84, y: 0.75, rx: 0.135, ry: 0.15 },
  { biome: 'volcanic', kind: 'blob', x: 0.755, y: 0.36, rx: 0.185, ry: 0.20 },
];

function buildMapModel() {
  const noise = makeNoise(20240812);
  const noise2 = makeNoise(0x5eed1);
  const rnd = mulberry(918273);
  const nodes = [];
  for (const L of LEVELS) {
    if (!L.map) continue;
    nodes.push({ id: L.id, cfg: L, x: L.map.x, y: L.map.y });
  }
  nodes.push({ id: '__trials', cfg: null, x: TRIALS_AT.x, y: TRIALS_AT.y });

  /** How far inside the coast a point is: >0 land, <=0 sea. */
  function landness(nx, ny) {
    const dx = (nx - 0.5) / 0.465, dy = (ny - 0.5) / 0.45;
    const r = Math.hypot(dx, dy) || 0.0001;
    const a = Math.atan2(dy, dx);
    const wob = (noise(Math.cos(a) * 2.1 + 7, Math.sin(a) * 2.1 + 7) - 0.5) * 0.34
      + (noise2(Math.cos(a) * 5.3 + 3, Math.sin(a) * 5.3 + 3) - 0.5) * 0.17;
    let v = (0.9 + wob) - r;
    // Every holding sits on land: a headland bulges out to meet it.
    for (const n of nodes) {
      const d = Math.hypot(nx - n.x, ny - n.y);
      if (d < 0.095) v = Math.max(v, 0.045 * (1 - d / 0.095) + 0.004);
    }
    return v;
  }

  /** Which biome palette a point belongs to, blended by region membership. */
  function biomeAt(nx, ny) {
    let best = 'grass', bestW = 0.001;
    for (const rg of REGIONS) {
      let w = 0;
      if (rg.kind === 'band') {
        const line = rg.y + (noise(nx * 5 + 21, 4) - 0.5) * 0.08;
        w = 1 - smoothstep(line - rg.feather, line + rg.feather, ny);
      } else {
        const d = Math.hypot((nx - rg.x) / rg.rx, (ny - rg.y) / rg.ry);
        const wob = (noise(nx * 6 + 40, ny * 6 + 40) - 0.5) * 0.28;
        w = 1 - smoothstep(0.62 + wob, 1.02 + wob, d);
      }
      if (w > bestW) { bestW = w; best = rg.biome; }
    }
    return { biome: best, w: bestW };
  }

  // ---- faceted mesh: a jittered lattice, two triangles per cell
  const CX = 30, CY = 18;
  const vx = [], vy = [];
  for (let j = 0; j <= CY; j++) {
    for (let i = 0; i <= CX; i++) {
      const edge = i === 0 || j === 0 || i === CX || j === CY;
      const jx = edge ? 0 : (rnd() - 0.5) * 0.62;
      const jy = edge ? 0 : (rnd() - 0.5) * 0.62;
      vx.push(((i + jx) / CX) * W);
      vy.push(((j + jy) / CY) * H);
    }
  }
  const vi = (i, j) => j * (CX + 1) + i;

  const faces = [];
  const pushFace = (a, b, c) => {
    const cx = (vx[a] + vx[b] + vx[c]) / 3;
    const cy = (vy[a] + vy[b] + vy[c]) / 3;
    const nx = cx / W, ny = cy / H;
    const land = landness(nx, ny);
    let col;
    if (land <= 0) {
      // Sea, banded into two or three flat tones by distance offshore.
      const deep = Math.min(1, -land / 0.26);
      const t = noise2(nx * 9 + 60, ny * 9 + 60);
      const base = mix(BIOMES.grass.water, BIOMES.grass.waterDeep, Math.min(1, deep * 1.1));
      col = mix(base, BIOMES.grass.waterDeep, t * 0.22);
    } else {
      const bm = biomeAt(nx, ny);
      const pal = BIOMES[bm.biome];
      const shore = smoothstep(0.0, 0.035, land);
      const t = noise(nx * 7.5 + 12, ny * 7.5 + 12) * 0.68
        + noise2(nx * 19 + 5, ny * 19 + 5) * 0.32;
      let g = t > 0.575 ? pal.grassHigh : (t < 0.415 ? pal.grassDry : pal.grassLow);
      if (bm.biome === 'volcanic' && t > 0.72) g = pal.cliff;
      col = mix(pal.sand, g, shore);
    }
    faces.push([
      `${vx[a].toFixed(1)},${vy[a].toFixed(1)} ${vx[b].toFixed(1)},${vy[b].toFixed(1)} ${vx[c].toFixed(1)},${vy[c].toFixed(1)}`,
      hex(col),
    ]);
  };
  for (let j = 0; j < CY; j++) {
    for (let i = 0; i < CX; i++) {
      const a = vi(i, j), b = vi(i + 1, j), c = vi(i, j + 1), d = vi(i + 1, j + 1);
      if (((i + j) & 1) === 0) { pushFace(a, c, d); pushFace(a, d, b); }
      else { pushFace(a, c, b); pushFace(b, c, d); }
    }
  }

  // ---- mountains, forests: flat two-face silhouettes over the mesh
  const mountains = [];
  for (let n = 0, g = 0; n < 34 && g < 900; g++) {
    const nx = rnd(), ny = rnd() * 0.62;
    if (landness(nx, ny) < 0.05) continue;
    const bm = biomeAt(nx, ny);
    if (bm.biome === 'desert') continue;
    if (ny > 0.36 && bm.biome !== 'volcanic') continue;
    let clash = false;
    for (const nd of nodes) if (Math.hypot(nx - nd.x, ny - nd.y) < 0.075) clash = true;
    for (const m of mountains) if (Math.hypot(nx - m.nx, ny - m.ny) < 0.048) clash = true;
    if (clash) continue;
    const s = 22 + rnd() * 22;
    const pal = BIOMES[bm.biome];
    mountains.push({
      nx, ny, x: nx * W, y: ny * H, s,
      lit: hex(bm.biome === 'snow' ? 0xf2f7fb : mix(pal.cliff, 0xffffff, 0.24)),
      dark: hex(mix(pal.cliff, 0x000000, 0.22)),
      cap: bm.biome === 'snow' || rnd() < 0.4,
    });
    n++;
  }

  const trees = [];
  for (let n = 0, g = 0; n < 120 && g < 3000; g++) {
    const nx = rnd(), ny = rnd();
    if (landness(nx, ny) < 0.055) continue;
    const bm = biomeAt(nx, ny);
    let clash = false;
    for (const nd of nodes) if (Math.hypot(nx - nd.x, ny - nd.y) < 0.062) clash = true;
    for (const m of mountains) if (Math.hypot(nx - m.nx, ny - m.ny) < 0.034) clash = true;
    for (const t of trees) if (Math.hypot(nx - t.nx, ny - t.ny) < 0.021) clash = true;
    if (clash) continue;
    const pal = BIOMES[bm.biome];
    trees.push({
      nx, ny, x: nx * W, y: ny * H, s: 7 + rnd() * 5,
      col: hex(rnd() < 0.5 ? pal.tree : pal.treeAlt),
      round: bm.biome === 'grass' && rnd() < 0.35,
    });
    n++;
  }

  return { nodes, faces, mountains, trees, landness };
}

let MODEL = null;
function model() {
  if (!MODEL) MODEL = buildMapModel();
  return MODEL;
}

// ------------------------------------------------------------------- drawing
function mountainSvg(m) {
  const { x, y, s } = m;
  const half = s * 0.78;
  const peak = `${x.toFixed(1)},${(y - s).toFixed(1)}`;
  let out = `<polygon points="${x - half},${y} ${peak} ${x + half * 0.12},${y}" fill="${m.lit}"/>`
    + `<polygon points="${x + half * 0.12},${y} ${peak} ${x + half},${y}" fill="${m.dark}"/>`;
  if (m.cap) {
    const cy = y - s * 0.62;
    out += `<polygon points="${(x - half * 0.34).toFixed(1)},${cy.toFixed(1)} ${peak} ${(x + half * 0.34).toFixed(1)},${cy.toFixed(1)}" fill="#f6fbff"/>`;
  }
  return out;
}

function treeSvg(t) {
  const { x, y, s } = t;
  if (t.round) {
    return `<rect x="${(x - 1).toFixed(1)}" y="${(y - s * 0.34).toFixed(1)}" width="2" height="${(s * 0.36).toFixed(1)}" fill="${hex(C.woodDark)}"/>`
      + `<circle cx="${x.toFixed(1)}" cy="${(y - s * 0.56).toFixed(1)}" r="${(s * 0.42).toFixed(1)}" fill="${t.col}"/>`;
  }
  return `<rect x="${(x - 1).toFixed(1)}" y="${(y - s * 0.24).toFixed(1)}" width="2" height="${(s * 0.26).toFixed(1)}" fill="${hex(C.woodDark)}"/>`
    + `<polygon points="${(x - s * 0.42).toFixed(1)},${(y - s * 0.2).toFixed(1)} ${x.toFixed(1)},${(y - s).toFixed(1)} ${(x + s * 0.42).toFixed(1)},${(y - s * 0.2).toFixed(1)}" fill="${t.col}"/>`;
}

/** A small flat-poly keep: the same silhouette the 3D castle reads as. */
function keepSvg(scale, state) {
  const s = scale;
  const stone = state === 'locked' ? '#9a958c' : hex(C.wallStone);
  const stoneHi = state === 'locked' ? '#b0aba1' : hex(C.wallStoneHi);
  const dark = state === 'locked' ? '#767169' : hex(C.wallDark);
  const roof = state === 'locked' ? '#7d746e' : hex(state === 'cleared' ? C.roofBlue : C.roofRed);
  const g = [];
  // side towers
  for (const sx of [-1, 1]) {
    const x = sx * 8.2 * s;
    g.push(`<rect x="${(x - 3.1 * s).toFixed(2)}" y="${(-4.2 * s).toFixed(2)}" width="${(6.2 * s).toFixed(2)}" height="${(10.4 * s).toFixed(2)}" fill="${stone}"/>`);
    g.push(`<rect x="${(x - 3.7 * s).toFixed(2)}" y="${(-5.6 * s).toFixed(2)}" width="${(7.4 * s).toFixed(2)}" height="${(1.6 * s).toFixed(2)}" fill="${dark}"/>`);
    for (let k = 0; k < 3; k++) {
      g.push(`<rect x="${(x - 3.7 * s + k * 2.6 * s).toFixed(2)}" y="${(-7.4 * s).toFixed(2)}" width="${(1.5 * s).toFixed(2)}" height="${(1.9 * s).toFixed(2)}" fill="${stoneHi}"/>`);
    }
  }
  // curtain wall
  g.push(`<rect x="${(-6.2 * s).toFixed(2)}" y="${(-1.4 * s).toFixed(2)}" width="${(12.4 * s).toFixed(2)}" height="${(7.6 * s).toFixed(2)}" fill="${stoneHi}"/>`);
  // central keep + roof
  g.push(`<rect x="${(-4.4 * s).toFixed(2)}" y="${(-11.6 * s).toFixed(2)}" width="${(8.8 * s).toFixed(2)}" height="${(17.8 * s).toFixed(2)}" fill="${stone}"/>`);
  g.push(`<rect x="${(-5.2 * s).toFixed(2)}" y="${(-13.2 * s).toFixed(2)}" width="${(10.4 * s).toFixed(2)}" height="${(1.7 * s).toFixed(2)}" fill="${dark}"/>`);
  g.push(`<polygon points="${(-5.6 * s).toFixed(2)},${(-13.2 * s).toFixed(2)} 0,${(-21 * s).toFixed(2)} ${(5.6 * s).toFixed(2)},${(-13.2 * s).toFixed(2)}" fill="${roof}"/>`);
  // gate
  g.push(`<rect x="${(-1.9 * s).toFixed(2)}" y="${(1.4 * s).toFixed(2)}" width="${(3.8 * s).toFixed(2)}" height="${(4.8 * s).toFixed(2)}" fill="${hex(C.woodDark)}"/>`);
  if (state === 'locked') {
    // a padlock over the gate says why you cannot ride in
    g.push(`<rect x="${(-4 * s).toFixed(2)}" y="${(-2.4 * s).toFixed(2)}" width="${(8 * s).toFixed(2)}" height="${(6.6 * s).toFixed(2)}" rx="${(1.2 * s).toFixed(2)}" fill="#5d564e"/>`);
    g.push(`<path d="M ${(-2.3 * s).toFixed(2)} ${(-2.6 * s).toFixed(2)} a ${(2.3 * s).toFixed(2)} ${(2.6 * s).toFixed(2)} 0 0 1 ${(4.6 * s).toFixed(2)} 0" fill="none" stroke="#5d564e" stroke-width="${(1.5 * s).toFixed(2)}"/>`);
  } else {
    g.push(`<rect x="${(4.4 * s).toFixed(2)}" y="${(-20 * s).toFixed(2)}" width="${(0.9 * s).toFixed(2)}" height="${(7 * s).toFixed(2)}" fill="${hex(C.woodDark)}"/>`);
    g.push(`<polygon points="${(5.3 * s).toFixed(2)},${(-20 * s).toFixed(2)} ${(11 * s).toFixed(2)},${(-18.4 * s).toFixed(2)} ${(5.3 * s).toFixed(2)},${(-16.6 * s).toFixed(2)}" fill="${hex(C.banner)}"/>`);
  }
  return g.join('');
}

function portalSvg(s, locked) {
  const a = locked ? '#6a6272' : '#6b3a70';
  const b = locked ? '#8a8494' : '#b4553a';
  const g = [];
  for (let i = 4; i >= 1; i--) {
    g.push(`<circle cx="0" cy="${(-6 * s).toFixed(2)}" r="${(i * 3.1 * s).toFixed(2)}" fill="${i % 2 ? a : b}" opacity="${(0.35 + i * 0.14).toFixed(2)}"/>`);
  }
  for (const sx of [-1, 1]) {
    g.push(`<polygon points="${(sx * 9 * s).toFixed(2)},${(4 * s).toFixed(2)} ${(sx * 6.4 * s).toFixed(2)},${(-14 * s).toFixed(2)} ${(sx * 11.6 * s).toFixed(2)},${(-13 * s).toFixed(2)}" fill="#3a3048"/>`);
  }
  return g.join('');
}

/**
 * Build the whole overworld as one SVG string, plus the node hit-boxes the HUD
 * wires click and hover handlers onto.
 */
export function overworldSvg(save, opts) {
  const m = model();
  const cleared = save.cleared || {};
  const out = [];
  out.push(`<svg id="owSvg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">`);

  // terrain facets
  out.push('<g shape-rendering="crispEdges">');
  for (const f of m.faces) out.push(`<polygon points="${f[0]}" fill="${f[1]}"/>`);
  out.push('</g>');

  // mountains, then forests
  out.push('<g>');
  for (const mt of m.mountains) out.push(mountainSvg(mt));
  out.push('</g><g>');
  for (const t of m.trees) out.push(treeSvg(t));
  out.push('</g>');

  const at = (n) => [n.x * W, n.y * H];

  // ---- roads between holdings, following the unlock chain
  out.push('<g fill="none" stroke-linecap="round">');
  for (const L of LEVELS) {
    if (!L.unlockedBy || !L.map) continue;
    const from = m.nodes.find((n) => n.id === L.unlockedBy);
    const to = m.nodes.find((n) => n.id === L.id);
    if (!from || !to) continue;
    const [x0, y0] = at(from), [x1, y1] = at(to);
    // bow the road out perpendicular so it reads as a route, not a wire
    const mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
    const dx = x1 - x0, dy = y1 - y0;
    const len = Math.hypot(dx, dy) || 1;
    const bow = 0.085 * len * (L.id.charCodeAt(0) % 2 ? 1 : -1);
    const cx = mx - (dy / len) * bow, cy = my + (dx / len) * bow;
    const open = !!cleared[L.unlockedBy];
    const d = `M ${x0.toFixed(1)} ${y0.toFixed(1)} Q ${cx.toFixed(1)} ${cy.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    out.push(`<path d="${d}" stroke="rgba(46,36,24,.30)" stroke-width="10"/>`);
    out.push(`<path d="${d}" stroke="${open ? 'rgba(214,193,150,.92)' : 'rgba(206,188,150,.30)'}" stroke-width="6"${open ? ' stroke-dasharray="16 11"' : ' stroke-dasharray="8 12"'}/>`);
  }
  // the trials road leaves the realm from the last holding
  {
    const from = m.nodes.find((n) => n.id === 'totend') || m.nodes.find((n) => n.id === 'wildbach');
    const to = m.nodes.find((n) => n.id === '__trials');
    if (from && to) {
      const [x0, y0] = at(from), [x1, y1] = at(to);
      out.push(`<path d="M ${x0.toFixed(1)} ${y0.toFixed(1)} Q ${(x0 + 150).toFixed(1)} ${((y0 + y1) / 2).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}" stroke="rgba(150,95,190,.55)" stroke-width="5" stroke-dasharray="4 11"/>`);
    }
  }
  out.push('</g>');

  // ---- the holdings
  for (const n of m.nodes) {
    const [x, y] = at(n);
    const trials = n.id === '__trials';
    const L = n.cfg;
    const unlocked = trials ? !!cleared.nordfels : (!L.unlockedBy || !!cleared[L.unlockedBy]);
    const rec = cleared[trials ? '__trials' : n.id];
    const state = !unlocked ? 'locked' : (rec ? 'cleared' : 'open');
    const label = trials ? 'Eternal Trials' : L.name;
    const meta = trials ? 'Endless · draft as you climb'
      : `${L.nights} nights · ${L.spawnAngles.length} approaches${L.boss ? ' · boss' : ''}`;
    const best = rec ? `Best ${rec.best.toLocaleString()}` : (unlocked ? '' : 'Locked');
    out.push(`<g class="owNode ${state}" data-id="${n.id}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})" tabindex="0">`);
    // ground shadow so the marker lifts off the terrain
    out.push(`<ellipse cx="0" cy="8" rx="27" ry="9" fill="rgba(30,24,16,.30)"/>`);
    out.push(`<g class="owArt">${trials ? portalSvg(1.55, !unlocked) : keepSvg(1.55, state)}</g>`);
    const labCol = state === 'locked' ? '#c9c2b4' : '#fdf3dc';
    out.push(`<text class="owName" x="0" y="38" text-anchor="middle" fill="${labCol}">${label}</text>`);
    out.push(`<text class="owMeta" x="0" y="56" text-anchor="middle" fill="rgba(240,230,210,.82)">${meta}</text>`);
    if (best) out.push(`<text class="owBest" x="0" y="73" text-anchor="middle" fill="${state === 'cleared' ? '#f6cf5c' : '#cbbfa6'}">${best}</text>`);
    // generous invisible hit target
    out.push(`<circle class="owHit" cx="0" cy="-8" r="42" fill="transparent"/>`);
    out.push('</g>');
  }

  out.push('</svg>');
  return out.join('');
}

/** Which levels the map can enter right now, in the order they appear. */
export function overworldNodes() { return model().nodes; }
