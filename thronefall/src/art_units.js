// Procedural low-poly unit art: the king on horseback, allied troops, and the
// full enemy roster. One merged geometry per archetype, cached.
import * as THREE from '../vendor/three.module.min.js';
import { merge, box, cyl, cone, sph, prism, disc } from './geo.js';
import { C } from './palette.js';

const cache = new Map();

// --- shared humanoid ------------------------------------------------------
function humanoid(o) {
  const {
    body = C.allyBody, trim = C.allyBodyAlt, skin = C.allySkin, metal = C.allyMetal,
    scale = 1, helm = 'cap', shield = false, weapon = 'sword', cape = null, bow = false,
  } = o;
  const p = [];
  const s = scale;
  // legs
  p.push({ g: box(0.2 * s, 0.42 * s, 0.2 * s), c: trim, p: [-0.14 * s, 0.21 * s, 0] });
  p.push({ g: box(0.2 * s, 0.42 * s, 0.2 * s), c: trim, p: [0.14 * s, 0.21 * s, 0] });
  // torso
  p.push({ g: box(0.52 * s, 0.56 * s, 0.34 * s), c: body, p: [0, 0.7 * s, 0] });
  p.push({ g: box(0.56 * s, 0.14 * s, 0.38 * s), c: trim, p: [0, 0.48 * s, 0] });
  // arms
  p.push({ g: box(0.14 * s, 0.42 * s, 0.16 * s), c: body, p: [-0.33 * s, 0.72 * s, 0.02 * s] });
  p.push({ g: box(0.14 * s, 0.42 * s, 0.16 * s), c: body, p: [0.33 * s, 0.72 * s, 0.02 * s] });
  // head
  p.push({ g: box(0.3 * s, 0.3 * s, 0.28 * s), c: skin, p: [0, 1.13 * s, 0] });
  if (helm === 'cap') p.push({ g: box(0.34 * s, 0.16 * s, 0.32 * s), c: metal, p: [0, 1.3 * s, 0] });
  else if (helm === 'full') {
    p.push({ g: box(0.36 * s, 0.34 * s, 0.34 * s), c: metal, p: [0, 1.16 * s, 0] });
    p.push({ g: box(0.3 * s, 0.07 * s, 0.05 * s), c: 0x24232a, p: [0, 1.14 * s, 0.17 * s] });
    p.push({ g: cone(0.1 * s, 0.3 * s, 4), c: metal, p: [0, 1.45 * s, 0] });
  } else if (helm === 'horn') {
    p.push({ g: box(0.36 * s, 0.24 * s, 0.34 * s), c: metal, p: [0, 1.2 * s, 0] });
    p.push({ g: cone(0.08 * s, 0.36 * s, 4), c: 0xe8e0cc, p: [-0.22 * s, 1.36 * s, 0], r: [0, 0, 0.7] });
    p.push({ g: cone(0.08 * s, 0.36 * s, 4), c: 0xe8e0cc, p: [0.22 * s, 1.36 * s, 0], r: [0, 0, -0.7] });
  } else if (helm === 'hood') {
    p.push({ g: cone(0.26 * s, 0.42 * s, 6), c: trim, p: [0, 1.28 * s, 0] });
  } else if (helm === 'crown') {
    p.push({ g: cyl(0.22 * s, 0.22 * s, 0.14 * s, 8), c: C.kingGoldTrim, p: [0, 1.32 * s, 0] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      p.push({ g: cone(0.05 * s, 0.16 * s, 4), c: C.kingGoldTrim, p: [Math.cos(a) * 0.19 * s, 1.45 * s, Math.sin(a) * 0.19 * s] });
    }
  }
  if (cape) {
    p.push({ g: box(0.5 * s, 0.75 * s, 0.08 * s), c: cape, p: [0, 0.68 * s, -0.22 * s], r: [-0.14, 0, 0] });
  }
  if (shield) {
    p.push({ g: box(0.1 * s, 0.5 * s, 0.42 * s), c: metal, p: [-0.44 * s, 0.7 * s, 0.04 * s] });
    p.push({ g: box(0.05 * s, 0.2 * s, 0.16 * s), c: body, p: [-0.5 * s, 0.7 * s, 0.04 * s] });
  }
  if (weapon === 'sword') {
    p.push({ g: box(0.09 * s, 0.85 * s, 0.05 * s), c: metal, p: [0.4 * s, 0.95 * s, 0.1 * s], r: [0.2, 0, -0.12] });
    p.push({ g: box(0.24 * s, 0.07 * s, 0.07 * s), c: C.woodDark, p: [0.4 * s, 0.6 * s, 0.08 * s] });
  } else if (weapon === 'bigsword') {
    p.push({ g: box(0.14 * s, 1.25 * s, 0.07 * s), c: metal, p: [0.42 * s, 1.15 * s, 0.12 * s], r: [0.24, 0, -0.16] });
    p.push({ g: box(0.32 * s, 0.09 * s, 0.09 * s), c: C.gold, p: [0.4 * s, 0.62 * s, 0.06 * s] });
  } else if (weapon === 'spear') {
    p.push({ g: cyl(0.045 * s, 0.045 * s, 1.7 * s, 5), c: C.wood, p: [0.36 * s, 0.95 * s, 0.05 * s], r: [0.16, 0, -0.06] });
    p.push({ g: cone(0.09 * s, 0.32 * s, 4), c: metal, p: [0.4 * s, 1.85 * s, 0.18 * s] });
  } else if (weapon === 'axe') {
    p.push({ g: cyl(0.05 * s, 0.05 * s, 0.9 * s, 5), c: C.wood, p: [0.4 * s, 0.9 * s, 0.08 * s], r: [0.2, 0, -0.1] });
    p.push({ g: box(0.08 * s, 0.34 * s, 0.3 * s), c: metal, p: [0.44 * s, 1.28 * s, 0.16 * s] });
  } else if (weapon === 'club') {
    p.push({ g: cyl(0.09 * s, 0.14 * s, 1.0 * s, 6), c: C.woodDark, p: [0.42 * s, 0.9 * s, 0.1 * s], r: [0.3, 0, -0.15] });
    p.push({ g: sph(0.22 * s, 5, 4), c: 0x6b6157, p: [0.5 * s, 1.35 * s, 0.24 * s] });
  } else if (weapon === 'staff') {
    p.push({ g: cyl(0.05 * s, 0.05 * s, 1.5 * s, 5), c: C.woodDark, p: [0.36 * s, 0.9 * s, 0.05 * s] });
    p.push({ g: sph(0.16 * s, 6, 4), c: 0x8ad4ef, p: [0.36 * s, 1.68 * s, 0.05 * s] });
  } else if (weapon === 'pitchfork') {
    p.push({ g: cyl(0.045 * s, 0.045 * s, 1.4 * s, 5), c: C.wood, p: [0.36 * s, 0.85 * s, 0.05 * s], r: [0.1, 0, -0.05] });
    for (let i = -1; i <= 1; i++) p.push({ g: box(0.05 * s, 0.3 * s, 0.05 * s), c: metal, p: [0.36 * s + i * 0.1 * s, 1.6 * s, 0.1 * s] });
  }
  if (bow) {
    p.push({ g: cyl(0.045 * s, 0.045 * s, 0.9 * s, 5), c: C.wood, p: [0.36 * s, 0.78 * s, 0.16 * s], r: [0, 0, 0.1] });
    p.push({ g: box(0.02 * s, 0.86 * s, 0.02 * s), c: 0xe6dcc0, p: [0.32 * s, 0.78 * s, 0.16 * s] });
    p.push({ g: box(0.14 * s, 0.3 * s, 0.1 * s), c: C.woodDark, p: [-0.3 * s, 0.95 * s, -0.16 * s] });
  }
  return p;
}

function horseParts(bodyC, darkC, s = 1) {
  const p = [];
  p.push({ g: box(0.6 * s, 0.56 * s, 1.35 * s), c: bodyC, p: [0, 0.95 * s, 0] });
  p.push({ g: box(0.42 * s, 0.5 * s, 0.44 * s), c: bodyC, p: [0, 1.28 * s, 0.66 * s], r: [-0.5, 0, 0] });
  p.push({ g: box(0.32 * s, 0.34 * s, 0.6 * s), c: bodyC, p: [0, 1.5 * s, 0.98 * s], r: [0.25, 0, 0] });
  p.push({ g: box(0.14 * s, 0.16 * s, 0.16 * s), c: darkC, p: [0, 1.42 * s, 1.26 * s] });
  p.push({ g: cone(0.07 * s, 0.18 * s, 4), c: darkC, p: [-0.1 * s, 1.68 * s, 0.9 * s] });
  p.push({ g: cone(0.07 * s, 0.18 * s, 4), c: darkC, p: [0.1 * s, 1.68 * s, 0.9 * s] });
  // mane + tail
  p.push({ g: box(0.1 * s, 0.34 * s, 0.5 * s), c: darkC, p: [0, 1.55 * s, 0.62 * s], r: [-0.4, 0, 0] });
  p.push({ g: box(0.12 * s, 0.42 * s, 0.12 * s), c: darkC, p: [0, 0.95 * s, -0.74 * s], r: [0.6, 0, 0] });
  // legs
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    p.push({ g: box(0.16 * s, 0.72 * s, 0.16 * s), c: darkC, p: [sx * 0.22 * s, 0.36 * s, sz * 0.48 * s] });
  }
  return p;
}

// --------------------------------------------------------------------------
const DEFS = {
  king: () => {
    const p = horseParts(C.horseBody, C.horseDark, 1.35);
    // caparison
    p.push({ g: box(0.72 * 1.35, 0.46, 1.35), c: C.kingCloak, p: [0, 0.86 * 1.35, -0.05] });
    for (const q of humanoid({ body: C.kingCloak, trim: 0x24457f, metal: C.allyMetal, helm: 'crown', weapon: 'bigsword', shield: true, cape: 0xb03a3a, scale: 1.2 })) {
      p.push(Object.assign({}, q, { p: [q.p[0], q.p[1] + 1.58, q.p[2] - 0.05] }));
    }
    return { parts: p, h: 3.5, r: 0.9 };
  },
  militia: () => ({ parts: humanoid({ body: C.allyBody, trim: C.allyBodyAlt, helm: 'cap', weapon: 'spear', shield: true }), h: 1.5, r: 0.35 }),
  knight: () => ({ parts: humanoid({ body: C.allyBodyAlt, trim: 0x24406f, helm: 'full', weapon: 'sword', shield: true, scale: 1.14 }), h: 1.7, r: 0.4 }),
  guard: () => ({ parts: humanoid({ body: 0x2b4c86, trim: C.gold, helm: 'full', weapon: 'bigsword', shield: true, scale: 1.24, cape: 0x2f5fa8 }), h: 1.85, r: 0.44 }),
  bowman: () => ({ parts: humanoid({ body: 0x3c6b58, trim: 0x2c5344, helm: 'hood', weapon: 'none', bow: true }), h: 1.5, r: 0.34 }),
  longbow: () => ({ parts: humanoid({ body: 0x2f6b8c, trim: 0x21506b, helm: 'cap', weapon: 'none', bow: true, scale: 1.05 }), h: 1.6, r: 0.34 }),
  spearmen: () => ({ parts: humanoid({ body: 0x4b7ec4, trim: 0x2f5b96, helm: 'cap', weapon: 'spear', scale: 0.98 }), h: 1.6, r: 0.33 }),
  flails: () => {
    const p = humanoid({ body: 0x35538f, trim: 0x24406f, helm: 'full', weapon: 'none', shield: false, scale: 1.06 });
    p.push({ g: cyl(0.05, 0.05, 0.55, 4), c: C.woodDark, p: [0.4, 0.95, 0.1], r: [0.4, 0, -0.2] });
    p.push({ g: box(0.05, 0.4, 0.05), c: 0x9aa2ae, p: [0.5, 1.28, 0.28] });
    p.push({ g: sph(0.22, 6, 4), c: 0x6b6157, p: [0.54, 1.5, 0.36] });
    return { parts: p, h: 1.66, r: 0.38 };
  },
  berserks: () => ({ parts: humanoid({ body: 0x2f6b8f, trim: 0x8a4a2a, helm: 'horn', weapon: 'axe', scale: 1.05 }), h: 1.62, r: 0.36 }),
  crossbowman: () => {
    const p = humanoid({ body: 0x2b4c86, trim: 0xc3cbd6, helm: 'full', weapon: 'none', scale: 1.08 });
    p.push({ g: box(0.72, 0.08, 0.1), c: 0xc3cbd6, p: [0.32, 0.86, 0.22] });
    p.push({ g: box(0.1, 0.08, 0.68), c: C.woodDark, p: [0.32, 0.86, 0.32] });
    return { parts: p, h: 1.62, r: 0.37 };
  },
  hunter: () => {
    const p = humanoid({ body: 0x3f6b4a, trim: 0x2c4f36, helm: 'hood', weapon: 'none', bow: true, scale: 1.0 });
    p.push({ g: box(0.06, 0.3, 0.05), c: 0xc3cbd6, p: [-0.36, 0.5, 0.12] });
    return { parts: p, h: 1.55, r: 0.34 };
  },
  firearcher: () => {
    const p = humanoid({ body: 0x8a4a2a, trim: 0xc86a2a, helm: 'hood', weapon: 'none', bow: true, scale: 1.0 });
    p.push({ g: sph(0.16, 6, 4), c: C.fire, p: [0.42, 0.9, 0.3] });
    return { parts: p, h: 1.55, r: 0.34 };
  },
  mole_archer: () => {
    // squat, snouted, goggled — it lives underground and shoots from cover
    const p = humanoid({
      body: 0x6b5a4a, trim: 0x4e4036, skin: 0xa88a6a, metal: 0x8a7a5a,
      helm: 'none', weapon: 'none', bow: true, scale: 0.92,
    });
    p.push({ g: cone(0.13, 0.34, 5), c: 0xd8b8a0, p: [0, 1.02, 0.24], r: [1.4, 0, 0] });
    p.push({ g: box(0.34, 0.11, 0.08), c: 0x2b2620, p: [0, 1.16, 0.16] });
    p.push({ g: sph(0.07, 5, 3), c: 0xffe9a8, p: [-0.09, 1.16, 0.2] });
    p.push({ g: sph(0.07, 5, 3), c: 0xffe9a8, p: [0.09, 1.16, 0.2] });
    for (const sx of [-1, 1]) {
      p.push({ g: cone(0.06, 0.24, 4), c: 0xe8e0cc, p: [sx * 0.34, 0.5, 0.16], r: [1.2, 0, 0] });
    }
    p.push({ g: box(0.5, 0.2, 0.34), c: 0x54463a, p: [0, 0.28, -0.22] });
    return { parts: p, h: 1.42, r: 0.36 };
  },
  mole_knight: () => {
    const p = humanoid({
      body: 0x5c4c40, trim: 0x3f342c, skin: 0xa88a6a, metal: 0x7d7268,
      helm: 'full', weapon: 'axe', shield: true, scale: 1.02,
    });
    p.push({ g: cone(0.15, 0.36, 5), c: 0xd8b8a0, p: [0, 1.0, 0.28], r: [1.4, 0, 0] });
    for (const sx of [-1, 1]) {
      p.push({ g: cone(0.09, 0.42, 4), c: 0xe8e0cc, p: [sx * 0.36, 0.46, 0.2], r: [1.15, 0, 0] });
    }
    p.push({ g: box(0.58, 0.24, 0.4), c: 0x4a3d33, p: [0, 0.3, -0.26] });
    return { parts: p, h: 1.6, r: 0.4 };
  },
  elara: () => {
    const p = humanoid({
      body: 0x5a2f6b, trim: 0x3d1f4a, skin: 0xcfa8c0, metal: 0x8f57ad,
      helm: 'hood', weapon: 'staff', cape: 0x2b1436, scale: 2.5,
    });
    p.push({ g: sph(0.6, 8, 5), c: 0xd06ae0, p: [1.0, 3.4, 0.4] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      p.push({ g: cone(0.22, 1.5, 4), c: 0x3d1f4a, p: [Math.cos(a) * 1.2, 0.7, Math.sin(a) * 1.2], r: [Math.PI, 0, 0] });
    }
    return { parts: p, h: 4.2, r: 1.1, fly: 3.2 };
  },
  ironcastle: () => {
    const p = [];
    // a walking siege keep: a squat iron drum on rollers with a ram in the front
    p.push({ g: cyl(2.1, 2.4, 3.6, 8), c: 0x3d3940, p: [0, 2.0, 0] });
    p.push({ g: cyl(2.6, 2.6, 0.5, 8), c: 0x2c2930, p: [0, 3.9, 0] });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      p.push({ g: box(0.7, 0.8, 0.5), c: 0x4c4750, p: [Math.cos(a) * 2.3, 4.4, Math.sin(a) * 2.3], r: [0, -a, 0] });
    }
    p.push({ g: box(1.4, 1.6, 0.4), c: 0x241d18, p: [0, 1.8, 2.3] });
    p.push({ g: cyl(0.55, 0.55, 3.2, 8), c: 0x8a7a5a, p: [0, 1.4, 3.2], r: [1.57, 0, 0] });
    p.push({ g: cone(0.75, 1.0, 6), c: 0x9aa2ae, p: [0, 1.4, 5.0], r: [-1.57, 0, 0] });
    for (const sx of [-1, 1]) {
      p.push({ g: cyl(0.9, 0.9, 0.6, 8), c: 0x3a332c, p: [sx * 2.0, 0.9, 1.1], r: [0, 0, 1.57] });
      p.push({ g: cyl(0.9, 0.9, 0.6, 8), c: 0x3a332c, p: [sx * 2.0, 0.9, -1.4], r: [0, 0, 1.57] });
    }
    p.push({ g: box(0.14, 3.0, 0.14), c: C.woodDark, p: [1.4, 6.0, -1.2] });
    p.push({ g: box(0.1, 1.3, 1.7), c: C.enemyBody, p: [1.4, 6.6, -0.4] });
    return { parts: p, h: 5.2, r: 2.4 };
  },
  corruptking: () => {
    const p = horseParts(0x3a2f38, 0x241d24, 1.9);
    p.push({ g: box(0.72 * 1.9, 0.5, 1.6), c: 0x5c1f2c, p: [0, 0.86 * 1.9, -0.05] });
    for (const q of humanoid({
      body: 0x6b2438, trim: 0x3d1420, skin: 0x9a8a94, metal: 0x6b6570,
      helm: 'crown', weapon: 'bigsword', shield: false, cape: 0x2b0e16, scale: 1.7,
    })) {
      p.push(Object.assign({}, q, { p: [q.p[0], q.p[1] + 2.2, q.p[2] - 0.05] }));
    }
    p.push({ g: sph(0.2, 6, 4), c: 0xd04a5a, p: [-0.16, 4.4, 0.3] });
    p.push({ g: sph(0.2, 6, 4), c: 0xd04a5a, p: [0.16, 4.4, 0.3] });
    return { parts: p, h: 4.8, r: 1.25 };
  },
  golem: () => {
    const p = [];
    p.push({ g: box(0.5, 0.7, 0.5), c: 0x7a8288, p: [-0.42, 0.35, 0] });
    p.push({ g: box(0.5, 0.7, 0.5), c: 0x7a8288, p: [0.42, 0.35, 0] });
    p.push({ g: box(1.7, 1.5, 1.1), c: 0x8b939a, p: [0, 1.4, 0] });
    p.push({ g: box(1.1, 0.5, 0.9), c: 0x6d757c, p: [0, 2.3, 0] });
    p.push({ g: box(0.9, 0.8, 0.85), c: 0x9aa2a8, p: [0, 2.75, 0.05] });
    p.push({ g: box(0.2, 0.16, 0.1), c: 0x7fe8ff, p: [-0.22, 2.85, 0.44] });
    p.push({ g: box(0.2, 0.16, 0.1), c: 0x7fe8ff, p: [0.22, 2.85, 0.44] });
    for (const sx of [-1, 1]) {
      p.push({ g: box(0.55, 1.5, 0.55), c: 0x7a8288, p: [sx * 1.15, 1.45, 0], r: [0, 0, -sx * 0.12] });
      p.push({ g: box(0.75, 0.7, 0.7), c: 0x6d757c, p: [sx * 1.3, 0.6, 0.05] });
    }
    p.push({ g: box(0.36, 0.9, 0.36), c: 0x5c6469, p: [0, 3.35, -0.1], r: [0.2, 0, 0.2] });
    return { parts: p, h: 3.2, r: 0.9 };
  },
  supportmage: () => {
    const p = humanoid({ body: 0xe4ecf4, trim: 0x6f9bd0, skin: C.allySkin, metal: 0xc3cbd6, helm: 'hood', weapon: 'staff', scale: 1.02 });
    p.push({ g: sph(0.2, 6, 4), c: 0x9fe8c8, p: [0.36, 1.7, 0.05] });
    return { parts: p, h: 1.6, r: 0.34 };
  },
  firewing: () => {
    const p = [];
    p.push({ g: sph(0.5, 7, 5), c: 0xc86a2a, p: [0, 0, 0], s: [1, 0.8, 1.4] });
    p.push({ g: sph(0.3, 6, 4), c: 0xe08a3a, p: [0, 0.08, 0.6] });
    p.push({ g: cone(0.12, 0.34, 4), c: 0xffd08a, p: [0, 0.3, 0.5], r: [-0.4, 0, 0] });
    for (const sx of [-1, 1]) {
      p.push({ g: box(1.7, 0.07, 0.72), c: 0xa8501f, p: [sx * 1.0, 0.24, -0.05], r: [0, 0, -sx * 0.3] });
      p.push({ g: box(1.7, 0.05, 0.24), c: C.fire, p: [sx * 1.0, 0.34, 0.32], r: [0, 0, -sx * 0.3] });
    }
    p.push({ g: cone(0.2, 1.0, 5), c: 0xa8501f, p: [0, 0, -0.95], r: [-1.57, 0, 0] });
    return { parts: p, h: 0.9, r: 0.55, fly: 5.0 };
  },

  // enemies -----------------------------------------------------------------
  peasant: () => ({ parts: humanoid({ body: 0x7c5a4a, trim: 0x5f4436, skin: C.enemySkin, metal: 0x8b8378, helm: 'none', weapon: 'pitchfork', scale: 0.94 }), h: 1.45, r: 0.34 }),
  swordsman: () => ({ parts: humanoid({ body: C.enemyBody, trim: C.enemyBodyAlt, skin: C.enemySkin, metal: C.enemyMetal, helm: 'cap', weapon: 'sword', shield: true }), h: 1.5, r: 0.35 }),
  archer: () => ({ parts: humanoid({ body: 0x7a3648, trim: 0x5c2536, skin: C.enemySkin, metal: C.enemyMetal, helm: 'hood', weapon: 'none', bow: true }), h: 1.5, r: 0.34 }),
  crossbow: () => {
    const p = humanoid({ body: 0x53304a, trim: 0x3d2338, skin: C.enemySkin, metal: 0x9aa2ae, helm: 'full', weapon: 'none', scale: 1.1 });
    p.push({ g: box(0.7, 0.08, 0.1), c: 0x9aa2ae, p: [0.34, 0.86, 0.2] });
    p.push({ g: box(0.1, 0.08, 0.65), c: C.woodDark, p: [0.34, 0.86, 0.3] });
    return { parts: p, h: 1.6, r: 0.38 };
  },
  pike: () => ({ parts: humanoid({ body: 0x6d3a55, trim: 0x4e2740, skin: C.enemySkin, metal: C.enemyMetal, helm: 'cap', weapon: 'spear', scale: 1.06 }), h: 1.6, r: 0.36 }),
  ogre: () => {
    const p = humanoid({ body: 0x7a5f4e, trim: 0x5d4739, skin: 0x9c8a6c, metal: 0x6b6157, helm: 'horn', weapon: 'club', scale: 1.75 });
    p.push({ g: box(1.2, 0.5, 0.55), c: 0x6b533f, p: [0, 1.0, -0.1] });
    return { parts: p, h: 2.7, r: 0.72 };
  },
  racer: () => {
    // fast four-legged monster
    const p = [];
    p.push({ g: box(0.5, 0.4, 1.15), c: C.enemyMonster, p: [0, 0.6, 0] });
    p.push({ g: box(0.38, 0.36, 0.42), c: C.enemyMonsterAlt, p: [0, 0.75, 0.72], r: [0.2, 0, 0] });
    p.push({ g: cone(0.12, 0.34, 4), c: 0xe8e0cc, p: [-0.12, 0.98, 0.7], r: [-0.4, 0, 0.2] });
    p.push({ g: cone(0.12, 0.34, 4), c: 0xe8e0cc, p: [0.12, 0.98, 0.7], r: [-0.4, 0, -0.2] });
    p.push({ g: box(0.1, 0.1, 0.5), c: C.enemyMonsterAlt, p: [0, 0.62, -0.75], r: [-0.5, 0, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      p.push({ g: box(0.13, 0.5, 0.13), c: C.enemyMonsterAlt, p: [sx * 0.2, 0.25, sz * 0.42] });
    }
    return { parts: p, h: 1.15, r: 0.42 };
  },
  hunterling: () => {
    const p = [];
    p.push({ g: sph(0.42, 6, 4), c: 0x5f7a3c, p: [0, 0.6, 0], s: [1, 1.15, 1] });
    p.push({ g: sph(0.3, 6, 4), c: 0x4c6330, p: [0, 1.05, 0.08] });
    p.push({ g: cone(0.09, 0.3, 4), c: 0xf0e8cc, p: [-0.14, 1.28, 0.05] });
    p.push({ g: cone(0.09, 0.3, 4), c: 0xf0e8cc, p: [0.14, 1.28, 0.05] });
    p.push({ g: box(0.1, 0.1, 0.06), c: 0xffe066, p: [-0.11, 1.05, 0.3] });
    p.push({ g: box(0.1, 0.1, 0.06), c: 0xffe066, p: [0.11, 1.05, 0.3] });
    p.push({ g: box(0.14, 0.36, 0.14), c: 0x4c6330, p: [-0.2, 0.18, 0] });
    p.push({ g: box(0.14, 0.36, 0.14), c: 0x4c6330, p: [0.2, 0.18, 0] });
    p.push({ g: box(0.12, 0.44, 0.12), c: 0x3d5028, p: [-0.42, 0.66, 0.1], r: [0, 0, 0.5] });
    p.push({ g: box(0.12, 0.44, 0.12), c: 0x3d5028, p: [0.42, 0.66, 0.1], r: [0, 0, -0.5] });
    return { parts: p, h: 1.35, r: 0.4 };
  },
  exploder: () => {
    const p = [];
    p.push({ g: sph(0.55, 7, 5), c: 0x9a5a2c, p: [0, 0.6, 0] });
    p.push({ g: cyl(0.4, 0.42, 0.7, 8), c: 0x3d3128, p: [0, 0.62, 0], s: [1.15, 1, 1.15] });
    p.push({ g: cyl(0.06, 0.06, 0.4, 4), c: 0x6b6157, p: [0, 1.2, 0], r: [0.3, 0, 0] });
    p.push({ g: sph(0.12, 5, 4), c: C.fire, p: [0.1, 1.42, 0.05] });
    p.push({ g: box(0.13, 0.3, 0.13), c: 0x3d3128, p: [-0.24, 0.16, 0] });
    p.push({ g: box(0.13, 0.3, 0.13), c: 0x3d3128, p: [0.24, 0.16, 0] });
    return { parts: p, h: 1.3, r: 0.45 };
  },
  slime: () => {
    const p = [];
    p.push({ g: sph(0.55, 7, 5), c: 0x8f5aa8, p: [0, 0.45, 0], s: [1.1, 0.85, 1.1] });
    p.push({ g: sph(0.28, 6, 4), c: 0xa874c4, p: [0, 0.78, 0] });
    p.push({ g: box(0.1, 0.1, 0.06), c: 0x2a1b2a, p: [-0.16, 0.55, 0.44] });
    p.push({ g: box(0.1, 0.1, 0.06), c: 0x2a1b2a, p: [0.16, 0.55, 0.44] });
    return { parts: p, h: 1.0, r: 0.5 };
  },
  spiky: () => {
    const p = [];
    p.push({ g: sph(0.8, 7, 5), c: 0x6d2f8a, p: [0, 0.62, 0], s: [1.1, 0.9, 1.1] });
    p.push({ g: sph(0.36, 6, 4), c: 0x8a48a8, p: [0, 1.05, 0] });
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      p.push({ g: cone(0.15, 0.65, 4), c: 0xe0d8e8, p: [Math.cos(a) * 0.6, 0.95, Math.sin(a) * 0.6], r: [Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7] });
    }
    p.push({ g: box(0.13, 0.13, 0.07), c: 0x1b0f20, p: [-0.22, 0.72, 0.66] });
    p.push({ g: box(0.13, 0.13, 0.07), c: 0x1b0f20, p: [0.22, 0.72, 0.66] });
    return { parts: p, h: 1.4, r: 0.7 };
  },
  rider: () => {
    const p = [];
    p.push({ g: box(0.52, 0.42, 1.2), c: 0x54376a, p: [0, 0.62, 0] });
    p.push({ g: box(0.4, 0.38, 0.44), c: 0x42284f, p: [0, 0.78, 0.76], r: [0.2, 0, 0] });
    p.push({ g: cone(0.11, 0.3, 4), c: 0xe8e0cc, p: [-0.12, 1.0, 0.74], r: [-0.4, 0, 0.2] });
    p.push({ g: cone(0.11, 0.3, 4), c: 0xe8e0cc, p: [0.12, 1.0, 0.74], r: [-0.4, 0, -0.2] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      p.push({ g: box(0.14, 0.52, 0.14), c: 0x42284f, p: [sx * 0.21, 0.26, sz * 0.44] });
    }
    for (const q of humanoid({ body: C.enemyBody, trim: C.enemyBodyAlt, skin: C.enemySkin, metal: C.enemyMetal, helm: 'cap', weapon: 'sword', scale: 0.78 })) {
      p.push(Object.assign({}, q, { p: [q.p[0], q.p[1] + 0.85, q.p[2] - 0.1] }));
    }
    return { parts: p, h: 1.9, r: 0.44 };
  },
  quicksling: () => {
    const p = [];
    p.push({ g: box(1.2, 0.3, 1.6), c: C.siegeWood, p: [0, 0.55, 0] });
    for (const sx of [-1, 1]) {
      p.push({ g: cyl(0.36, 0.36, 0.2, 8), c: 0x4a3524, p: [sx * 0.68, 0.36, 0.4], r: [0, 0, 1.57] });
      p.push({ g: cyl(0.36, 0.36, 0.2, 8), c: 0x4a3524, p: [sx * 0.68, 0.36, -0.5], r: [0, 0, 1.57] });
    }
    p.push({ g: box(0.2, 1.5, 0.2), c: C.siegeWood, p: [0, 1.35, -0.2], r: [0.25, 0, 0] });
    p.push({ g: box(0.16, 0.16, 1.9), c: 0x8a6a45, p: [0, 2.0, 0.35], r: [0.15, 0, 0] });
    p.push({ g: box(0.42, 0.3, 0.42), c: 0x4a3524, p: [0, 2.05, 1.25] });
    p.push({ g: sph(0.22, 6, 4), c: 0x59545c, p: [0, 2.2, 1.25] });
    return { parts: p, h: 2.2, r: 0.6 };
  },
  wasp: () => {
    const p = [];
    p.push({ g: sph(0.32, 6, 4), c: 0xc8a02c, p: [0, 0, 0], s: [1, 0.85, 1.35] });
    p.push({ g: sph(0.2, 6, 4), c: 0x2f2a24, p: [0, 0.04, 0.36] });
    p.push({ g: cone(0.14, 0.42, 4), c: 0x2f2a24, p: [0, -0.02, -0.5], r: [-1.57, 0, 0] });
    p.push({ g: box(0.06, 0.06, 0.3), c: 0xe8e0cc, p: [0, 0.02, -0.82], r: [-0.2, 0, 0] });
    p.push({ g: box(0.7, 0.04, 0.28), c: 0xdbe8f0, p: [-0.42, 0.22, 0.05], r: [0, 0, 0.25] });
    p.push({ g: box(0.7, 0.04, 0.28), c: 0xdbe8f0, p: [0.42, 0.22, 0.05], r: [0, 0, -0.25] });
    return { parts: p, h: 0.7, r: 0.4, fly: 4.2 };
  },
  mage: () => {
    const p = humanoid({ body: 0x4a3a86, trim: 0x342a63, skin: 0xb8a2d0, metal: 0x9aa2ae, helm: 'hood', weapon: 'staff', scale: 1.0 });
    p.push({ g: box(0.9, 0.05, 0.4), c: 0x7a63c8, p: [-0.55, 0.5, -0.1], r: [0, 0, 0.3] });
    p.push({ g: box(0.9, 0.05, 0.4), c: 0x7a63c8, p: [0.55, 0.5, -0.1], r: [0, 0, -0.3] });
    return { parts: p, h: 1.6, r: 0.38, fly: 5.0 };
  },
  fury: () => {
    const p = [];
    p.push({ g: sph(0.85, 7, 5), c: 0x5a2f5e, p: [0, 0, 0], s: [1, 0.8, 1.5] });
    p.push({ g: sph(0.5, 6, 4), c: 0x431f47, p: [0, 0.12, 0.9] });
    p.push({ g: cone(0.16, 0.5, 4), c: 0xe8dccc, p: [-0.24, 0.42, 0.85], r: [-0.3, 0, 0.3] });
    p.push({ g: cone(0.16, 0.5, 4), c: 0xe8dccc, p: [0.24, 0.42, 0.85], r: [-0.3, 0, -0.3] });
    for (const sx of [-1, 1]) {
      p.push({ g: box(2.5, 0.09, 1.0), c: 0x3a1c3e, p: [sx * 1.4, 0.3, -0.1], r: [0, 0, -sx * 0.3] });
      p.push({ g: box(2.5, 0.06, 0.3), c: 0x6b3a70, p: [sx * 1.4, 0.42, 0.45], r: [0, 0, -sx * 0.3] });
    }
    p.push({ g: cone(0.3, 1.2, 5), c: 0x431f47, p: [0, -0.05, -1.4], r: [-1.57, 0, 0] });
    return { parts: p, h: 1.4, r: 1.0, fly: 6.5 };
  },
  catapult: () => {
    const p = [];
    p.push({ g: box(1.5, 0.34, 2.1), c: C.siegeWood, p: [0, 0.62, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      p.push({ g: cyl(0.42, 0.42, 0.24, 8), c: 0x4a3524, p: [sx * 0.85, 0.42, sz * 0.75], r: [0, 0, 1.57] });
    }
    p.push({ g: box(0.22, 1.5, 0.22), c: C.siegeWood, p: [-0.5, 1.45, -0.2], r: [0.3, 0, 0] });
    p.push({ g: box(0.22, 1.5, 0.22), c: C.siegeWood, p: [0.5, 1.45, -0.2], r: [0.3, 0, 0] });
    p.push({ g: box(0.2, 2.3, 0.2), c: 0x8a6a45, p: [0, 1.6, 0.3], r: [-0.9, 0, 0] });
    p.push({ g: box(0.55, 0.4, 0.55), c: 0x4a3524, p: [0, 2.4, 1.15] });
    p.push({ g: sph(0.3, 6, 4), c: 0x59545c, p: [0, 2.55, 1.15] });
    return { parts: p, h: 2.6, r: 0.95 };
  },
  ram: () => {
    const p = [];
    p.push({ g: box(1.9, 1.5, 3.0), c: C.siegeWood, p: [0, 1.0, 0] });
    p.push({ g: prism(3.3, 0.9, 2.2), c: 0x4a3524, p: [0, 1.75, 0], r: [0, Math.PI / 2, 0] });
    p.push({ g: cyl(0.34, 0.34, 3.2, 8), c: 0x6b5138, p: [0, 0.9, 0.6], r: [1.57, 0, 0] });
    p.push({ g: cone(0.48, 0.9, 6), c: 0x8b8378, p: [0, 0.9, 2.55], r: [1.57, 0, 0] });
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      p.push({ g: cyl(0.48, 0.48, 0.28, 8), c: 0x3d2c1e, p: [sx * 1.05, 0.48, sz * 1.0], r: [0, 0, 1.57] });
    }
    return { parts: p, h: 2.6, r: 1.2 };
  },
  barrel: () => {
    const p = [];
    p.push({ g: cyl(0.6, 0.68, 1.3, 10), c: 0x7a5a38, p: [0, 0.85, 0] });
    p.push({ g: cyl(0.64, 0.7, 0.14, 10), c: 0x4a3524, p: [0, 0.6, 0] });
    p.push({ g: cyl(0.62, 0.66, 0.14, 10), c: 0x4a3524, p: [0, 1.15, 0] });
    p.push({ g: box(0.28, 0.28, 0.26), c: 0x3d3128, p: [0, 1.62, 0] });
    p.push({ g: box(0.1, 0.1, 0.06), c: 0xff8a3c, p: [-0.08, 1.62, 0.16] });
    p.push({ g: box(0.1, 0.1, 0.06), c: 0xff8a3c, p: [0.08, 1.62, 0.16] });
    p.push({ g: box(0.16, 0.42, 0.16), c: 0x3d3128, p: [-0.3, 0.2, 0] });
    p.push({ g: box(0.16, 0.42, 0.16), c: 0x3d3128, p: [0.3, 0.2, 0] });
    p.push({ g: box(0.14, 0.5, 0.14), c: 0x5a4430, p: [-0.72, 0.9, 0.1], r: [0, 0, 0.4] });
    p.push({ g: box(0.14, 0.5, 0.14), c: 0x5a4430, p: [0.72, 0.9, 0.1], r: [0, 0, -0.4] });
    return { parts: p, h: 1.8, r: 0.6 };
  },
  statue: () => {
    const p = [];
    p.push({ g: cyl(1.5, 1.7, 0.6, 8), c: 0x5a5550, p: [0, 0.3, 0] });
    p.push({ g: box(1.7, 3.4, 1.2), c: 0x6e6862, p: [0, 2.3, 0] });
    p.push({ g: box(2.4, 0.7, 1.0), c: 0x5f5a54, p: [0, 3.4, 0] });
    p.push({ g: box(1.0, 1.0, 0.95), c: 0x7a746c, p: [0, 4.4, 0] });
    p.push({ g: box(0.24, 0.2, 0.1), c: 0xff5a3c, p: [-0.24, 4.5, 0.5] });
    p.push({ g: box(0.24, 0.2, 0.1), c: 0xff5a3c, p: [0.24, 4.5, 0.5] });
    p.push({ g: cone(0.5, 1.2, 6), c: 0x6e6862, p: [0, 5.4, 0] });
    p.push({ g: box(0.4, 2.6, 0.4), c: 0x5f5a54, p: [-1.25, 2.4, 0.2], r: [0, 0, 0.15] });
    p.push({ g: box(0.4, 2.6, 0.4), c: 0x5f5a54, p: [1.25, 2.4, 0.2], r: [0, 0, -0.15] });
    p.push({ g: box(0.7, 2.9, 0.28), c: 0x8b8378, p: [1.6, 3.0, 0.5], r: [0.2, 0, -0.2] });
    return { parts: p, h: 6.2, r: 1.6 };
  },
  shadow: () => {
    const p = [];
    p.push({ g: sph(2.2, 9, 6), c: 0x1f2a4a, p: [0, 1.2, 0], s: [1, 0.7, 1.5] });
    p.push({ g: sph(1.1, 8, 5), c: 0x2b3a63, p: [0, 2.0, 1.9] });
    p.push({ g: box(0.5, 0.4, 0.2), c: 0x7fe8ff, p: [-0.5, 2.3, 2.8] });
    p.push({ g: box(0.5, 0.4, 0.2), c: 0x7fe8ff, p: [0.5, 2.3, 2.8] });
    for (let i = 0; i < 7; i++) {
      p.push({ g: cone(0.26, 1.5, 5), c: 0x16203a, p: [-1.4 + i * 0.47, 2.9 - Math.abs(i - 3) * 0.2, 0.4] });
    }
    for (const sx of [-1, 1]) {
      p.push({ g: cone(0.4, 3.2, 5), c: 0x2b3a63, p: [sx * 2.3, 1.4, -0.6], r: [0.5, 0, -sx * 0.9] });
    }
    p.push({ g: cone(0.7, 3.4, 6), c: 0x1f2a4a, p: [0, 1.3, -3.0], r: [-1.57, 0, 0] });
    return { parts: p, h: 4.2, r: 2.4 };
  },
};

export function unitArt(kind) {
  if (cache.has(kind)) return cache.get(kind);
  const f = DEFS[kind] || DEFS.swordsman;
  const d = f();
  const out = { geo: merge(d.parts), h: d.h, r: d.r, fly: d.fly || 0 };
  cache.set(kind, out);
  return out;
}

// --- projectiles & fx ------------------------------------------------------
let projCache = null;
export function projectileGeos() {
  if (projCache) return projCache;
  projCache = {
    arrow: merge([
      { g: box(0.06, 0.06, 0.85), c: C.arrow },
      { g: cone(0.09, 0.24, 4), c: 0x9aa2ae, p: [0, 0, 0.52], r: [1.57, 0, 0] },
      { g: box(0.02, 0.22, 0.2), c: 0xe8e8e8, p: [0, 0, -0.4] },
    ]),
    bolt: merge([
      { g: box(0.1, 0.1, 1.4), c: 0xd8d0b8 },
      { g: cone(0.16, 0.5, 5), c: 0x9aa2ae, p: [0, 0, 0.9], r: [1.57, 0, 0] },
    ]),
    ball: merge([{ g: sph(0.34, 7, 5), c: 0x3f3a40 }]),
    rock: merge([{ g: sph(0.5, 6, 4), c: 0x6e6862 }]),
    magic: merge([
      { g: sph(0.34, 7, 5), c: 0x9a7ce8 },
      { g: sph(0.18, 6, 4), c: 0xe0d4ff, p: [0, 0, 0.2] },
    ]),
    fire: merge([
      { g: sph(0.38, 7, 5), c: C.fire },
      { g: sph(0.2, 6, 4), c: C.fireCore },
    ]),
  };
  return projCache;
}
