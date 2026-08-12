// Procedural low-poly building art. Each (type,tier,branch) resolves to one
// merged, vertex-colored geometry, cached. Animated pieces (mill blades, flags)
// come back as separate named sub-geometries.
import * as THREE from '../vendor/three.module.min.js';
import { merge, box, cyl, cone, sph, prism, disc, ring } from './geo.js';
import { C } from './palette.js';

const cache = new Map();

function crenel(parts, w, d, y, c, step = 1.1) {
  const n = Math.max(2, Math.floor(w / step));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + step * 0.5 + i * (w / n);
    parts.push({ g: box(w / n * 0.62, 0.48, d), c, p: [x, y, 0] });
  }
}

function towerBase(parts, r, h, c, cTop) {
  parts.push({ g: cyl(r * 0.92, r, h, 8), c, p: [0, h / 2, 0] });
  parts.push({ g: cyl(r * 1.16, r * 1.16, 0.34, 8), c: cTop, p: [0, h + 0.1, 0] });
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    parts.push({
      g: box(0.55, 0.62, 0.42), c: cTop,
      p: [Math.cos(a) * r * 1.0, h + 0.55, Math.sin(a) * r * 1.0], r: [0, -a, 0],
    });
  }
}

function banner(parts, x, y, z, col, h = 2.6) {
  parts.push({ g: cyl(0.07, 0.07, h, 4), c: C.woodDark, p: [x, y + h / 2, z] });
  parts.push({ g: box(0.06, 1.0, 1.35), c: col, p: [x, y + h - 0.62, z + 0.7] });
  parts.push({ g: cone(0.13, 0.3, 4), c: C.gold, p: [x, y + h + 0.15, z] });
}

// --------------------------------------------------------------------------
function houseParts(tier, branch) {
  const p = [];
  if (branch === 'fort') {
    // stone, squat, battlemented
    const w = tier >= 2 ? 4.6 : 4.0, d = tier >= 2 ? 4.0 : 3.6, h = tier >= 2 ? 3.2 : 2.6;
    p.push({ g: box(w, h, d), c: C.wallStone, p: [0, h / 2, 0] });
    p.push({ g: box(w + 0.5, 0.35, d + 0.5), c: C.wallDark, p: [0, h + 0.1, 0] });
    crenel(p, w + 0.5, d + 0.5, h + 0.5, C.wallStoneHi, 1.15);
    p.push({ g: box(0.9, 1.3, 0.2), c: C.woodDark, p: [0, 0.65, d / 2 + 0.02] });
    if (tier >= 2) { p.push({ g: box(0.5, 0.5, 0.2), c: 0x2b3a52, p: [-1.2, h - 0.7, d / 2 + 0.02] }); banner(p, 0, h + 0.6, -0.4, C.banner, 2.2); }
    return p;
  }
  const big = tier >= 2 ? 1.22 : (tier >= 1 ? 1.08 : 1.0);
  const w = 3.5 * big, d = 3.0 * big, h = 2.1 * big;
  p.push({ g: box(w, h, d), c: C.plaster, p: [0, h / 2, 0] });
  // exposed timber
  p.push({ g: box(w + 0.06, 0.16, 0.16), c: C.wood, p: [0, h * 0.55, d / 2] });
  p.push({ g: box(0.16, h, 0.16), c: C.wood, p: [-w / 2 + 0.1, h / 2, d / 2] });
  p.push({ g: box(0.16, h, 0.16), c: C.wood, p: [w / 2 - 0.1, h / 2, d / 2] });
  const roofC = tier >= 2 ? C.roofBlue : C.roofRed;
  p.push({ g: prism(d + 0.7, 1.5 * big, w + 0.7), c: roofC, p: [0, h, 0], r: [0, Math.PI / 2, 0] });
  p.push({ g: box(0.55, 1.1, 0.55), c: C.wallDark, p: [w * 0.28, h + 0.85, -d * 0.2] });
  p.push({ g: box(0.75, 1.05, 0.18), c: C.woodDark, p: [0, 0.53, d / 2 + 0.02] });
  p.push({ g: box(0.42, 0.42, 0.16), c: 0x3d5470, p: [-w * 0.28, h * 0.62, d / 2 + 0.02] });
  if (tier >= 1) {
    // side wing
    p.push({ g: box(w * 0.62, h * 0.8, d * 0.7), c: C.plaster, p: [w * 0.72, h * 0.4, -d * 0.1] });
    p.push({ g: prism(d * 0.7 + 0.4, 1.0, w * 0.62 + 0.4), c: roofC, p: [w * 0.72, h * 0.8, -d * 0.1], r: [0, Math.PI / 2, 0] });
  }
  if (tier >= 2) banner(p, -w * 0.55, 0, d * 0.4, C.banner, 2.9);
  return p;
}

function millParts(tier, branch) {
  const p = [], extras = [];
  // field
  p.push({ g: box(7.4, 0.14, 6.2), c: 0x8a6b45, p: [0, 0.07, 0] });
  for (let i = 0; i < 6; i++) {
    p.push({ g: box(7.0, 0.1, 0.44), c: i % 2 ? 0x9c7c50 : 0xb59a5f, p: [0, 0.17, -2.4 + i * 0.96] });
  }
  const boom = branch === 'boom';
  const bodyC = boom ? 0x8a6a5a : C.plaster;
  const th = tier >= 2 ? 4.6 : (tier >= 1 ? 3.9 : 3.1);
  p.push({ g: cyl(1.0, 1.35, th, 8), c: bodyC, p: [0, th / 2 + 0.1, 0] });
  p.push({ g: cone(1.5, 1.2, 8), c: boom ? 0x6d4b3c : C.roofRed, p: [0, th + 0.7, 0] });
  p.push({ g: box(0.7, 1.0, 0.18), c: C.woodDark, p: [0, 0.6, 1.15] });
  if (boom) {
    p.push({ g: cyl(0.42, 0.42, 0.7, 8), c: 0x4a3a30, p: [1.6, 0.45, 1.4] });
    p.push({ g: cyl(0.42, 0.42, 0.7, 8), c: 0x4a3a30, p: [2.2, 0.45, 0.9] });
    if (tier >= 2) p.push({ g: cyl(0.42, 0.42, 0.7, 8), c: 0x4a3a30, p: [1.9, 0.45, 2.1] });
  }
  if (tier >= 1) {
    // rotating sails as an animated extra
    const b = [];
    const nb = tier >= 2 ? 5 : 4;
    b.push({ g: cyl(0.2, 0.2, 0.5, 6), c: C.woodDark, p: [0, 0, 0], r: [Math.PI / 2, 0, 0] });
    for (let i = 0; i < nb; i++) {
      const a = (i / nb) * Math.PI * 2;
      b.push({
        g: box(0.55, tier >= 2 ? 3.4 : 2.8, 0.12), c: i % 2 ? C.wood : C.plaster,
        p: [Math.sin(a) * (tier >= 2 ? 1.8 : 1.5), Math.cos(a) * (tier >= 2 ? 1.8 : 1.5), 0.2],
        r: [0, 0, -a],
      });
    }
    extras.push({ name: 'sails', parts: b, pos: [0, th * 0.82, 1.4], spin: 'z' });
  }
  return { parts: p, extras };
}

function towerParts(tier, branch) {
  const p = [], extras = [];
  const h = tier >= 2 ? 6.6 : (tier >= 1 ? 5.4 : 4.2);
  const r = (tier >= 2 ? 1.5 : 1.3) * (branch === 'stone' ? 1.22 : 1);
  towerBase(p, r, h, branch === 'stone' ? C.wallDark : C.wallStone, C.wallStoneHi);
  p.push({ g: box(0.7, 1.1, 0.2), c: C.woodDark, p: [0, 0.58, r * 0.95] });
  if (branch === 'fire') {
    p.push({ g: cyl(r * 1.3, r * 1.3, 0.22, 8), c: C.wood, p: [0, h + 0.5, 0] });
    p.push({ g: cyl(0.95, 0.7, 0.9, 8), c: 0x4a4038, p: [0, h + 1.1, 0] });
    p.push({ g: sph(0.75, 7, 5), c: C.fire, p: [0, h + 1.7, 0] });
    p.push({ g: sph(0.4, 6, 4), c: C.fireCore, p: [0, h + 2.0, 0] });
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2;
      p.push({ g: cone(0.22, 0.8, 4), c: C.fire, p: [Math.cos(a) * 0.5, h + 2.3, Math.sin(a) * 0.5] });
    }
    return { parts: p, extras };
  }
  if (branch === 'heal') {
    p.push({ g: cyl(r * 1.3, r * 1.3, 0.22, 8), c: 0xd8d0b8, p: [0, h + 0.5, 0] });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      p.push({ g: box(0.24, 2.4, 0.24), c: 0xe8e0cc, p: [Math.cos(a) * r * 0.9, h + 1.7, Math.sin(a) * r * 0.9] });
    }
    p.push({ g: cyl(r * 1.2, r * 1.2, 0.3, 8), c: 0xe8e0cc, p: [0, h + 3.0, 0] });
    p.push({ g: cone(0.65, 1.7, 6), c: 0x7ce8a8, p: [0, h + 2.0, 0] });
    p.push({ g: cone(0.65, 1.2, 6), c: 0x7ce8a8, p: [0, h + 1.55, 0], r: [Math.PI, 0, 0] });
    p.push({ g: sph(0.3, 6, 4), c: 0xd8ffe8, p: [0, h + 1.85, 0] });
    return { parts: p, extras };
  }
  if (branch === 'bal') {
    // ballista / cannon on top
    p.push({ g: cyl(0.9, 0.9, 0.3, 8), c: C.woodDark, p: [0, h + 0.8, 0] });
    const w = [];
    if (tier >= 2) {
      // bombard: fat barrel
      w.push({ g: cyl(0.46, 0.6, 2.5, 8), c: 0x4d4a4f, p: [0, 0.35, 0.6], r: [1.35, 0, 0] });
      w.push({ g: box(1.5, 0.4, 1.2), c: C.woodDark, p: [0, 0.05, 0] });
      w.push({ g: cyl(0.22, 0.22, 1.7, 6), c: C.wood, p: [0, 0.1, -0.8], r: [1.5, 0, 0] });
    } else {
      w.push({ g: box(2.9, 0.16, 0.22), c: C.wood, p: [0, 0.45, 0.15] });
      w.push({ g: box(0.3, 0.22, 2.1), c: C.woodDark, p: [0, 0.4, -0.2] });
      w.push({ g: cone(0.16, 0.7, 5), c: C.allyMetal, p: [0, 0.45, 1.0], r: [1.57, 0, 0] });
      w.push({ g: box(1.1, 0.3, 0.7), c: C.woodDark, p: [0, 0.1, -0.4] });
    }
    extras.push({ name: 'turret', parts: w, pos: [0, h + 1.0, 0], aim: true });
  } else {
    // archer platform, wooden roof
    p.push({ g: cyl(r * 1.3, r * 1.3, 0.22, 8), c: C.wood, p: [0, h + 0.5, 0] });
    p.push({ g: cone(r * 1.6, tier >= 2 ? 2.1 : 1.6, 8), c: tier >= 2 ? C.roofBlue : C.roofRed, p: [0, h + 1.5, 0] });
    if (tier >= 1) banner(p, 0, h + 2.4, 0, tier >= 2 ? C.bannerAlt : C.banner, 1.8);
    // arrow slits
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      p.push({ g: box(0.22, 0.8, 0.16), c: 0x3a3630, p: [Math.cos(a) * r * 0.95, h * 0.72, Math.sin(a) * r * 0.95], r: [0, -a, 0] });
    }
  }
  return { parts: p, extras };
}

function barracksParts(tier, branch) {
  const p = [];
  const w = tier >= 2 ? 5.4 : 4.6, d = tier >= 2 ? 4.4 : 3.8, h = 2.3;
  p.push({ g: box(w, h, d), c: branch === 'arch' ? 0xd8cbb0 : C.plaster, p: [0, h / 2, 0] });
  p.push({ g: box(w + 0.1, 0.2, d + 0.1), c: C.wood, p: [0, h * 0.5, 0] });
  p.push({ g: prism(d + 0.8, 1.5, w + 0.8), c: branch === 'arch' ? 0x4a6b48 : C.roofRedDark, p: [0, h, 0], r: [0, Math.PI / 2, 0] });
  p.push({ g: box(1.3, 1.6, 0.2), c: C.woodDark, p: [0, 0.8, d / 2 + 0.02] });
  // yard
  p.push({ g: disc(3.4, 12), c: 0xb9a478, p: [0, h * 0 + 0.06, d / 2 + 3.0] });
  if (branch === 'arch') {
    // archery targets
    for (let i = 0; i < 2; i++) {
      const x = -1.3 + i * 2.6;
      p.push({ g: cyl(0.85, 0.85, 0.18, 10), c: 0xe8e0cc, p: [x, 1.1, d / 2 + 4.0], r: [Math.PI / 2, 0, 0] });
      p.push({ g: cyl(0.45, 0.45, 0.2, 10), c: 0xc4443a, p: [x, 1.1, d / 2 + 4.02], r: [Math.PI / 2, 0, 0] });
      p.push({ g: cyl(0.1, 0.12, 1.1, 4), c: C.woodDark, p: [x, 0.55, d / 2 + 4.0] });
    }
  } else {
    // training dummies + weapon rack
    for (let i = 0; i < 2; i++) {
      const x = -1.2 + i * 2.4;
      p.push({ g: cyl(0.13, 0.16, 1.6, 5), c: C.woodDark, p: [x, 0.8, d / 2 + 3.6] });
      p.push({ g: box(1.3, 0.18, 0.18), c: C.woodDark, p: [x, 1.35, d / 2 + 3.6] });
      p.push({ g: sph(0.34, 5, 3), c: 0xb59a72, p: [x, 1.7, d / 2 + 3.6] });
    }
    p.push({ g: box(2.2, 0.15, 0.4), c: C.wood, p: [0, 1.05, d / 2 + 1.6] });
  }
  banner(p, -w / 2 + 0.3, h + 0.2, d / 2 - 0.3, branch === 'arch' ? 0x2f6b46 : C.banner, tier >= 2 ? 3.2 : 2.6);
  if (tier >= 2) banner(p, w / 2 - 0.3, h + 0.2, d / 2 - 0.3, branch === 'arch' ? 0x2f6b46 : C.banner, 3.2);
  return p;
}

function wallParts(tier, branch, len, isGate) {
  const p = [];
  const L = Math.max(4, len || 8);
  const th = tier >= 2 ? 1.9 : 1.5;
  const h = tier >= 2 ? 4.2 : 3.5;
  if (isGate) {
    const gw = 3.4;
    const sideL = (L - gw) / 2;
    for (const s of [-1, 1]) {
      const cx = s * (gw / 2 + sideL / 2);
      p.push({ g: box(sideL, h, th), c: C.wallStone, p: [cx, h / 2, 0] });
      p.push({ g: box(sideL, 0.3, th + 0.4), c: C.wallDark, p: [cx, h + 0.1, 0] });
    }
    // gate towers
    for (const s of [-1, 1]) {
      const cx = s * (gw / 2 + 0.55);
      p.push({ g: cyl(1.0, 1.15, h + 1.7, 8), c: C.wallStoneHi, p: [cx, (h + 1.7) / 2, 0] });
      p.push({ g: cone(1.35, 1.5, 8), c: C.roofRed, p: [cx, h + 2.4, 0] });
    }
    // arch + door
    p.push({ g: box(gw + 1.2, 0.7, th + 0.3), c: C.wallStoneHi, p: [0, h - 0.1, 0] });
    p.push({ g: box(gw, h - 0.6, 0.3), c: C.woodDark, p: [0, (h - 0.6) / 2, 0] });
    for (let i = 0; i < 4; i++) p.push({ g: box(gw - 0.2, 0.16, 0.36), c: C.wood, p: [0, 0.4 + i * 0.7, 0] });
    if (branch === 'spike') for (let i = 0; i < 5; i++) {
      p.push({ g: cone(0.2, 0.7, 4), c: C.allyMetal, p: [-1.4 + i * 0.7, 0.4, th / 2 + 0.35], r: [1.57, 0, 0] });
    }
    return p;
  }
  p.push({ g: box(L, h, th), c: C.wallStone, p: [0, h / 2, 0] });
  p.push({ g: box(L, 0.32, th + 0.45), c: C.wallDark, p: [0, h + 0.1, 0] });
  crenel(p, L, th + 0.45, h + 0.55, C.wallStoneHi, 1.5);
  if (tier >= 1) {
    p.push({ g: box(0.4, h * 0.8, th + 0.3), c: C.wallDark, p: [-L * 0.28, h * 0.4, 0] });
    p.push({ g: box(0.4, h * 0.8, th + 0.3), c: C.wallDark, p: [L * 0.28, h * 0.4, 0] });
  }
  if (branch === 'spike') {
    const n = Math.floor(L / 1.2);
    for (let i = 0; i < n; i++) {
      p.push({
        g: cone(tier >= 2 ? 0.24 : 0.18, tier >= 2 ? 1.1 : 0.8, 4), c: C.allyMetal,
        p: [-L / 2 + 0.6 + i * 1.2, h * 0.55, th / 2 + (tier >= 2 ? 0.55 : 0.4)], r: [1.57, 0, 0],
      });
    }
  }
  return p;
}

function castleParts(level) {
  const p = [];
  const s = level >= 3 ? 1.18 : (level >= 2 ? 1.09 : 1.0);
  const N = 9;                         // courtyard wall segments
  const cr = 5.2 * s;                  // courtyard radius
  const cw = 2.0;                      // courtyard wall height

  // ---- courtyard: a real wall ring of segments, not a solid drum
  const segW = 2 * cr * Math.sin(Math.PI / N) * 1.06;
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2 + Math.PI / N;
    const x = Math.cos(a) * cr, z = Math.sin(a) * cr;
    if (i === Math.floor(N * 0.25)) continue;      // leave the gate open
    p.push({ g: box(segW, cw, 0.85), c: C.wallStone, p: [x, cw / 2, z], r: [0, -a + Math.PI / 2, 0] });
    p.push({ g: box(segW, 0.24, 1.15), c: C.wallDark, p: [x, cw + 0.08, z], r: [0, -a + Math.PI / 2, 0] });
    for (let k = 0; k < 3; k++) {
      const t = (-segW / 2) + segW * (0.2 + k * 0.3);
      p.push({
        g: box(segW * 0.2, 0.44, 1.15), c: C.wallStoneHi,
        p: [x + Math.cos(-a + Math.PI / 2) * t, cw + 0.42, z - Math.sin(-a + Math.PI / 2) * t],
        r: [0, -a + Math.PI / 2, 0],
      });
    }
  }
  // courtyard floor
  p.push({ g: cyl(cr - 0.3, cr - 0.3, 0.34, N * 2), c: 0xc9b48d, p: [0, 0.17, 0] });

  // ---- the keep: a square tower that dominates the silhouette
  const kh = 8.2 * s;
  const kw = 4.3 * s;
  p.push({ g: box(kw, kh, kw), c: C.wallStone, p: [0, kh / 2, 0] });
  p.push({ g: box(kw + 0.85, 0.5, kw + 0.85), c: C.wallDark, p: [0, kh + 0.2, 0] });
  crenel(p, kw + 0.85, kw + 0.85, kh + 0.7, C.wallStoneHi, 1.1);
  for (let i = 0; i < 3; i++) {
    p.push({ g: box(0.45, 0.8, 0.18), c: 0x39332c, p: [0, 3.2 + i * 1.9, kw / 2 + 0.02] });
    p.push({ g: box(0.18, 0.8, 0.45), c: 0x39332c, p: [kw / 2 + 0.02, 3.2 + i * 1.9, 0] });
  }
  // keep door
  p.push({ g: box(1.5, 2.2, 0.24), c: C.woodDark, p: [0, 1.1, kw / 2 + 0.03] });

  // ---- corner turrets hugging the keep, taller than its battlements
  const off = kw / 2 + 0.35;
  const th = kh + 1.3 * s;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    p.push({ g: cyl(0.78 * s, 0.9 * s, th, 8), c: C.wallStoneHi, p: [sx * off, th / 2, sz * off] });
    p.push({ g: cyl(1.05 * s, 1.05 * s, 0.26, 8), c: C.wallDark, p: [sx * off, th + 0.13, sz * off] });
    p.push({ g: cone(1.1 * s, 2.2 * s, 8), c: level >= 3 ? C.roofBlue : C.roofRed, p: [sx * off, th + 1.4 * s, sz * off] });
    p.push({ g: sph(0.2, 6, 4), c: C.gold, p: [sx * off, th + 2.8 * s, sz * off] });
  }
  // ---- gatehouse on the courtyard wall
  const ga = Math.PI / 2;
  const gx = Math.cos(ga) * cr, gz = Math.sin(ga) * cr;
  for (const side of [-1, 1]) {
    const ox = gx + Math.cos(ga + Math.PI / 2) * side * 2.1;
    const oz = gz + Math.sin(ga + Math.PI / 2) * side * 2.1;
    p.push({ g: cyl(0.9, 1.05, 4.4, 8), c: C.wallStoneHi, p: [ox, 2.2, oz] });
    p.push({ g: cone(1.25, 1.9, 8), c: level >= 3 ? C.roofBlue : C.roofRedDark, p: [ox, 5.3, oz] });
  }
  p.push({ g: box(4.2, 0.7, 1.2), c: C.wallStoneHi, p: [gx, 3.5, gz], r: [0, -ga + Math.PI / 2, 0] });
  p.push({ g: box(3.0, 3.0, 0.3), c: C.woodDark, p: [gx, 1.5, gz], r: [0, -ga + Math.PI / 2, 0] });

  // ---- crowning spire
  const sh = 2.4 * s;
  p.push({ g: cyl(1.05 * s, 1.4 * s, sh, 8), c: C.wallStoneHi, p: [0, kh + sh / 2 + 0.4, 0] });
  p.push({ g: cone(1.5 * s, 2.9 * s, 8), c: level >= 3 ? C.roofBlue : C.roofRedDark, p: [0, kh + sh + 1.9 * s, 0] });
  p.push({ g: sph(0.32, 6, 4), c: C.gold, p: [0, kh + sh + 3.8 * s, 0] });
  banner(p, -1.5 * s, kh + 0.5, 1.4 * s, C.banner, 3.0 * s);
  banner(p, 1.5 * s, kh + 0.5, 1.4 * s, C.banner, 3.0 * s);

  if (level >= 2) {
    // royal treasury in the courtyard
    p.push({ g: box(1.3, 0.6, 1.3), c: C.gold, p: [-2.6, 0.65, -3.2] });
    p.push({ g: cyl(0.45, 0.62, 0.85, 8), c: C.goldDark, p: [-2.6, 1.2, -3.2] });
  }
  if (level >= 3) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 + 0.6;
      p.push({ g: cyl(0.24, 0.3, 2.1, 6), c: C.wallStoneHi, p: [Math.cos(a) * (cr - 1.4), 1.2, Math.sin(a) * (cr - 1.4)] });
      p.push({ g: sph(0.3, 6, 4), c: C.fire, p: [Math.cos(a) * (cr - 1.4), 2.5, Math.sin(a) * (cr - 1.4)] });
    }
  }
  return p;
}

function mineParts(tier) {
  const p = [];
  // cut into a rock face with a timber-framed adit and a cart
  p.push({ g: cyl(3.2, 3.6, 1.0, 8), c: 0x7d7566, p: [0, 0.5, 0] });
  p.push({ g: sph(2.6, 7, 5), c: C.wallDark, p: [0, 0.9, -1.6], s: [1.5, 1.1, 1] });
  p.push({ g: box(2.3, 2.3, 0.5), c: 0x241d18, p: [0, 1.3, 0.3] });
  p.push({ g: box(0.34, 2.5, 0.34), c: C.woodDark, p: [-1.2, 1.35, 0.55] });
  p.push({ g: box(0.34, 2.5, 0.34), c: C.woodDark, p: [1.2, 1.35, 0.55] });
  p.push({ g: box(2.9, 0.4, 0.4), c: C.woodDark, p: [0, 2.65, 0.55] });
  // rails + cart
  p.push({ g: box(0.14, 0.1, 4.2), c: 0x6b6157, p: [-0.55, 1.05, 2.6] });
  p.push({ g: box(0.14, 0.1, 4.2), c: 0x6b6157, p: [0.55, 1.05, 2.6] });
  p.push({ g: box(1.3, 0.8, 1.5), c: C.wood, p: [0, 1.5, 3.1] });
  p.push({ g: box(1.0, 0.3, 1.2), c: C.gold, p: [0, 1.95, 3.1] });
  if (tier >= 1) p.push({ g: cyl(0.4, 0.5, 1.6, 6), c: C.wallStone, p: [2.6, 1.6, 1.2] });
  return p;
}

function shrineParts() {
  const p = [];
  p.push({ g: cyl(2.4, 2.7, 0.5, 8), c: C.wallStoneHi, p: [0, 0.25, 0] });
  p.push({ g: cyl(1.9, 2.1, 0.35, 8), c: C.wallDark, p: [0, 0.6, 0] });
  for (const sx of [-1, 1]) {
    p.push({ g: box(0.36, 3.2, 0.36), c: 0xd0c6ae, p: [sx * 1.35, 2.2, 0.55] });
    p.push({ g: box(0.36, 3.2, 0.36), c: 0xd0c6ae, p: [sx * 1.35, 2.2, -0.55] });
  }
  p.push({ g: box(4.1, 0.4, 2.1), c: 0xb44a3a, p: [0, 3.95, 0] });
  p.push({ g: box(3.4, 0.35, 1.6), c: 0x8f3a2d, p: [0, 4.3, 0] });
  p.push({ g: sph(0.55, 7, 5), c: 0x8ad4ef, p: [0, 1.55, 0] });
  p.push({ g: cyl(0.5, 0.6, 0.9, 8), c: C.wallStone, p: [0, 1.0, 0] });
  return p;
}

function heroqParts(tier, branch) {
  const p = [];
  const s = tier >= 2 ? 1.2 : (tier >= 1 ? 1.08 : 1);
  p.push({ g: cyl(3.0 * s, 3.3 * s, 0.5, 10), c: C.wallStoneHi, p: [0, 0.25, 0] });
  p.push({ g: box(3.6 * s, 3.4 * s, 3.6 * s), c: C.wallStone, p: [0, 1.9 * s, 0] });
  p.push({ g: box(4.1 * s, 0.35, 4.1 * s), c: C.wallDark, p: [0, 3.7 * s, 0] });
  crenel(p, 4.1 * s, 4.1 * s, 4.05 * s, C.wallStoneHi, 1.2);
  p.push({ g: box(1.3, 1.9, 0.24), c: C.woodDark, p: [0, 1.1, 1.82 * s] });
  p.push({ g: cyl(0.8 * s, 0.9 * s, 4.6 * s, 8), c: C.wallStoneHi, p: [1.9 * s, 2.3 * s, -1.7 * s] });
  p.push({ g: cone(1.1 * s, 1.7 * s, 8), c: branch === 'mage' ? 0x4a3a86 : C.roofBlue, p: [1.9 * s, 5.4 * s, -1.7 * s] });
  banner(p, -1.5 * s, 3.8 * s, 1.5 * s, branch === 'mage' ? 0x5c46a0 : C.banner, 3.0);
  if (tier >= 2) banner(p, 1.5 * s, 3.8 * s, 1.5 * s, C.gold, 3.0);
  return p;
}


function fieldParts() {
  const p = [];
  p.push({ g: box(6.6, 0.16, 5.6), c: 0x8a6b45, p: [0, 0.08, 0] });
  for (let i = 0; i < 7; i++) {
    p.push({ g: box(6.2, 0.12, 0.36), c: i % 2 ? 0xa8863f : 0xc4a352, p: [0, 0.2, -2.2 + i * 0.74] });
  }
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    p.push({ g: cone(0.2, 0.55, 4), c: 0x9fb04a, p: [Math.cos(a) * 2.2, 0.4, Math.sin(a) * 1.8] });
  }
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    p.push({ g: box(0.18, 0.9, 0.18), c: C.woodDark, p: [sx * 3.2, 0.45, sz * 2.7] });
  }
  return p;
}

function blacksmithParts(tier) {
  const p = [];
  // A timber-framed smithy: open forge on one side, chimney over it, and the
  // anvil and quench trough out front where the work happens.
  const w = tier >= 2 ? 5.2 : (tier >= 1 ? 4.6 : 4.0);
  const d = tier >= 2 ? 4.2 : 3.7, h = 2.4;
  p.push({ g: box(w, h, d), c: C.wallStone, p: [0, h / 2, 0] });
  p.push({ g: box(w + 0.1, 0.18, d + 0.1), c: C.wood, p: [0, h * 0.52, 0] });
  p.push({ g: prism(d + 0.8, 1.4, w + 0.8), c: 0x5a4a42, p: [0, h, 0], r: [0, Math.PI / 2, 0] });
  // chimney with a smoke hood
  p.push({ g: box(1.2, 2.6, 1.2), c: C.wallDark, p: [-w * 0.3, h + 1.1, -d * 0.2] });
  p.push({ g: box(1.5, 0.3, 1.5), c: 0x39332c, p: [-w * 0.3, h + 2.5, -d * 0.2] });
  // forge mouth: the one warm colour on the building
  p.push({ g: box(1.3, 1.2, 0.3), c: 0x2b241e, p: [-w * 0.3, 1.0, d / 2 + 0.02] });
  p.push({ g: box(0.9, 0.7, 0.2), c: C.fire, p: [-w * 0.3, 0.9, d / 2 + 0.1] });
  // anvil, block and quench trough
  p.push({ g: cyl(0.5, 0.6, 0.6, 8), c: C.woodDark, p: [w * 0.36, 0.3, d / 2 + 1.5] });
  p.push({ g: box(1.1, 0.34, 0.5), c: 0x4d4a4f, p: [w * 0.36, 0.75, d / 2 + 1.5] });
  p.push({ g: cone(0.26, 0.5, 5), c: 0x4d4a4f, p: [w * 0.36 + 0.65, 0.8, d / 2 + 1.5], r: [0, 0, 1.57] });
  p.push({ g: box(1.6, 0.5, 0.9), c: C.woodDark, p: [-w * 0.1, 0.25, d / 2 + 2.3] });
  p.push({ g: box(1.4, 0.16, 0.7), c: 0x3f6088, p: [-w * 0.1, 0.5, d / 2 + 2.3] });
  // weapon rack
  p.push({ g: box(1.8, 0.14, 0.35), c: C.wood, p: [w * 0.2, 1.5, -d / 2 - 0.2] });
  for (let i = 0; i < 3; i++) {
    p.push({ g: box(0.12, 1.5, 0.12), c: C.allyMetal, p: [w * 0.2 - 0.6 + i * 0.6, 0.9, -d / 2 - 0.2] });
  }
  if (tier >= 1) {
    p.push({ g: box(1.6, 1.3, 1.6), c: C.plaster, p: [w * 0.62, 0.65, -d * 0.3] });
    p.push({ g: prism(1.8, 0.8, 1.8), c: 0x5a4a42, p: [w * 0.62, 1.3, -d * 0.3], r: [0, Math.PI / 2, 0] });
  }
  if (tier >= 2) banner(p, w / 2 - 0.2, h + 0.1, d / 2 - 0.3, C.banner, 2.8);
  return p;
}

function forgeParts(tier) {
  const p = [];
  // The Royal Forge: heavier stone, a domed furnace, bellows, and the king's
  // own gold on it — it works for him alone.
  const r = tier >= 2 ? 3.0 : (tier >= 1 ? 2.7 : 2.4);
  p.push({ g: cyl(r + 0.4, r + 0.6, 0.5, 10), c: C.wallStoneHi, p: [0, 0.25, 0] });
  p.push({ g: cyl(r * 0.78, r * 0.9, 3.0, 10), c: C.wallDark, p: [0, 1.9, 0] });
  p.push({ g: cyl(r * 0.6, r * 0.82, 0.4, 10), c: C.goldDark, p: [0, 3.5, 0] });
  p.push({ g: sph(r * 0.58, 9, 5), c: 0x4a4038, p: [0, 3.9, 0], s: [1, 0.7, 1] });
  p.push({ g: cyl(0.42, 0.5, 1.6, 8), c: C.wallDark, p: [0, 4.7, 0] });
  // furnace mouth and the heat coming off it
  p.push({ g: box(1.5, 1.5, 0.4), c: 0x241d18, p: [0, 1.2, r * 0.86] });
  p.push({ g: box(1.0, 0.9, 0.25), c: C.fire, p: [0, 1.05, r * 0.92] });
  p.push({ g: sph(0.34, 6, 4), c: C.fireCore, p: [0, 1.5, r * 0.9] });
  // bellows on one flank, quench trough on the other
  p.push({ g: box(1.0, 0.9, 2.0), c: C.wood, p: [-r * 0.95, 0.9, -0.3] });
  p.push({ g: cyl(0.16, 0.16, 1.6, 5), c: C.woodDark, p: [-r * 0.95, 1.5, -1.2], r: [0.5, 0, 0] });
  p.push({ g: box(1.8, 0.55, 0.95), c: C.woodDark, p: [r * 0.95, 0.3, 0.6] });
  p.push({ g: box(1.6, 0.16, 0.75), c: 0x3f6088, p: [r * 0.95, 0.58, 0.6] });
  // an anvil, and the king's crown-mark on a stand
  p.push({ g: cyl(0.44, 0.54, 0.55, 8), c: C.woodDark, p: [r * 0.5, 0.28, -r * 0.9] });
  p.push({ g: box(1.0, 0.3, 0.44), c: 0x4d4a4f, p: [r * 0.5, 0.68, -r * 0.9] });
  if (tier >= 1) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      p.push({ g: cyl(0.2, 0.24, 1.7, 6), c: C.wallStoneHi, p: [Math.cos(a) * (r + 0.1), 1.05, Math.sin(a) * (r + 0.1)] });
      p.push({ g: sph(0.26, 6, 4), c: C.fire, p: [Math.cos(a) * (r + 0.1), 2.05, Math.sin(a) * (r + 0.1)] });
    }
  }
  if (tier >= 2) {
    p.push({ g: cyl(0.5, 0.62, 0.5, 8), c: C.gold, p: [0, 5.6, 0] });
    p.push({ g: sph(0.26, 6, 4), c: C.gold, p: [0, 6.0, 0] });
  }
  return p;
}

function harbourParts(tier) {
  const p = [];
  // A short quay reaching out over the water, a hut on the bank, and the boats
  // moored alongside it — the ones the harbour's income is counted in.
  const L = tier >= 1 ? 6.0 : 5.0;
  p.push({ g: box(2.3, 0.34, L), c: C.wood, p: [0, 0.85, -L / 2 + 0.9] });
  for (let i = 0; i < 4; i++) {
    const z = -i * (L / 4) + 0.6;
    p.push({ g: cyl(0.14, 0.16, 1.5, 5), c: C.woodDark, p: [-0.95, 0.2, z] });
    p.push({ g: cyl(0.14, 0.16, 1.5, 5), c: C.woodDark, p: [0.95, 0.2, z] });
  }
  p.push({ g: box(2.3, 1.7, 2.1), c: C.plaster, p: [0, 1.95, 1.75] });
  p.push({ g: prism(2.5, 1.0, 2.7), c: C.roofRed, p: [0, 2.8, 1.75], r: [0, Math.PI / 2, 0] });
  p.push({ g: box(0.7, 1.0, 0.16), c: C.woodDark, p: [0, 1.6, 0.68] });
  p.push({ g: box(0.7, 0.55, 0.7), c: C.woodDark, p: [1.0, 1.35, 0.3] });
  p.push({ g: cyl(0.4, 0.4, 0.4, 8), c: 0x6b8a5a, p: [-1.0, 1.28, -0.4] });
  const boats = tier >= 1 ? 3 : 2;
  for (let i = 0; i < boats; i++) {
    const side = i % 2 ? 1 : -1;
    const z = -1.1 - Math.floor(i / 2) * 2.3;
    p.push({ g: box(1.0, 0.42, 2.1), c: 0x8a6a45, p: [side * 1.9, 0.35, z] });
    p.push({ g: box(0.72, 0.16, 1.7), c: 0x5b3f27, p: [side * 1.9, 0.6, z] });
    p.push({ g: cyl(0.07, 0.07, 1.9, 4), c: C.woodDark, p: [side * 1.9, 1.45, z] });
    p.push({ g: box(0.05, 1.1, 0.8), c: 0xf0e7d5, p: [side * 1.9, 1.65, z + 0.36] });
  }
  return p;
}

function bridgeParts(len) {
  const p = [];
  const L = Math.max(8, len || 14);
  p.push({ g: box(L, 0.4, 4.2), c: C.wood, p: [0, 0.2, 0] });
  const planks = Math.max(4, Math.floor(L / 1.3));
  for (let i = 0; i < planks; i++) {
    p.push({ g: box(0.9, 0.14, 4.3), c: i % 2 ? 0x8a6544 : 0x6f5236, p: [-L / 2 + 0.8 + i * 1.3, 0.44, 0] });
  }
  for (const sz of [-1, 1]) {
    p.push({ g: box(L, 0.14, 0.14), c: C.woodDark, p: [0, 1.25, sz * 2.05] });
    const posts = Math.max(2, Math.floor(L / 3));
    for (let i = 0; i <= posts; i++) {
      p.push({ g: box(0.18, 1.1, 0.18), c: C.woodDark, p: [-L / 2 + i * (L / posts), 0.75, sz * 2.05] });
    }
  }
  const piles = Math.max(2, Math.floor(L / 5));
  for (let i = 0; i <= piles; i++) {
    const x = -L / 2 + i * (L / piles);
    for (const sz of [-1, 1]) {
      p.push({ g: cyl(0.22, 0.26, 2.6, 5), c: 0x4a3524, p: [x, -1.2, sz * 1.6] });
    }
    p.push({ g: box(0.34, 0.3, 3.6), c: 0x4a3524, p: [x, 0.0, 0] });
  }
  return p;
}

// --------------------------------------------------------------------------
export function buildingArt(typeId, level, branch, extra) {
  const tier = Math.max(0, (level || 1) - 1);
  const key = `${typeId}|${tier}|${branch}|${extra ? extra.len : 0}`;
  if (cache.has(key)) return cache.get(key);
  let parts = [], extras = [];
  switch (typeId) {
    case 'house': parts = houseParts(tier, branch); break;
    case 'mill': { const r = millParts(tier, branch); parts = r.parts; extras = r.extras; break; }
    case 'mine': parts = mineParts(tier); break;
    case 'shrine': parts = shrineParts(); break;
    case 'tower': { const r = towerParts(tier, branch); parts = r.parts; extras = r.extras; break; }
    case 'barracks': parts = barracksParts(tier, null); break;
    case 'archery': parts = barracksParts(tier, 'arch'); break;
    case 'heroq': parts = heroqParts(tier, branch); break;
    case 'wall': parts = wallParts(tier, branch, extra && extra.len, false); break;
    case 'spikewall': parts = wallParts(tier, 'spike', extra && extra.len, false); break;
    case 'gate': parts = wallParts(tier, branch, extra && extra.len, true); break;
    case 'field': parts = fieldParts(); break;
    case 'blacksmith': parts = blacksmithParts(tier); break;
    case 'forge': parts = forgeParts(tier); break;
    case 'harbour': parts = harbourParts(tier); break;
    case 'bridge': parts = bridgeParts(extra && extra.len); break;
    case 'castle': parts = castleParts(level || 1); break;
    default: parts = houseParts(tier, branch);
  }
  const out = {
    geo: merge(parts),
    extras: extras.map((e) => ({ name: e.name, geo: merge(e.parts), pos: e.pos, spin: e.spin, aim: e.aim })),
  };
  cache.set(key, out);
  return out;
}

let plotArtCache = null;
export function plotMarkerArt() {
  if (plotArtCache) return plotArtCache;
  const p = [];
  // a surveyed footprint: corner stakes and a thin chalk ring, nothing more
  p.push({ g: ring(2.05, 2.35, 22), c: 0xf0e7c8 });
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    p.push({ g: box(0.2, 0.62, 0.2), c: 0xe8dcb4, p: [Math.cos(a) * 1.75, 0.31, Math.sin(a) * 1.75] });
    p.push({ g: box(0.12, 0.12, 0.55), c: 0xd8caa2, p: [Math.cos(a) * 1.75, 0.56, Math.sin(a) * 1.75], r: [0, -a, 0] });
  }
  plotArtCache = merge(p);
  return plotArtCache;
}
