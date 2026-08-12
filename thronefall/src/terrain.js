// Terrain, water and static decor. All faceted, flat-shaded, one color per
// triangle — that single choice is most of the low-poly look.
import * as THREE from '../vendor/three.module.min.js';
import { merge, box, cyl, cone, sph, disc } from './geo.js';
import { smoothstep } from './levels.js';

const _c = new THREE.Color();

export function buildTerrain(level) {
  const g = level.grid, pal = level.pal, cfg = level.cfg;
  const n = g.n, step = g.step, min = g.min;
  const H = (i, j) => g.h[j * n + i];

  const tris = (n - 1) * (n - 1) * 2;
  const pos = new Float32Array(tris * 9);
  const col = new Float32Array(tris * 9);
  let o = 0;

  // road proximity field, cheap: rasterize road samples into a coarse grid
  const rn = n;
  const roadField = new Float32Array(rn * rn);
  for (const s of level.roadSamples) {
    const ci = Math.round((s[0] - min) / step), cj = Math.round((s[1] - min) / step);
    const rad = 4;
    for (let dj = -rad; dj <= rad; dj++) for (let di = -rad; di <= rad; di++) {
      const i = ci + di, j = cj + dj;
      if (i < 0 || j < 0 || i >= rn || j >= rn) continue;
      const cx = min + i * step, cz = min + j * step;
      const d = Math.hypot(cx - s[0], cz - s[1]);
      const v = 1 - smoothstep(2.2, 5.2, d);
      if (v > roadField[j * rn + i]) roadField[j * rn + i] = v;
    }
  }
  const roadAt = (i, j) => (i < 0 || j < 0 || i >= rn || j >= rn) ? 0 : roadField[j * rn + i];

  const roadCol = cfg.biome === 'desert' ? 0xb5924f
    : cfg.biome === 'snow' ? 0xa9bccb
    : cfg.biome === 'volcanic' ? 0x4f453f : 0xb59a6c;
  const roadC3 = new THREE.Color(roadCol);

  function faceColor(h, slope, ri, rj, cx, cz) {
    const r = Math.max(roadAt(ri, rj), 0);
    let hex;
    if (h < 0.45) hex = pal.sand;
    else if (slope > 0.7) hex = pal.cliff;
    else if (h > 27) hex = cfg.biome === 'snow' ? 0xffffff : pal.rock;
    else if (h > 14) hex = pal.cliff;
    else {
      // three-tone banding from two noise octaves — the painted-field look
      const t = level.noise(cx * 0.028 + 40, cz * 0.028 + 40) * 0.7
        + level.noise(cx * 0.09 + 11, cz * 0.09 + 11) * 0.3;
      hex = t > 0.58 ? pal.grassHigh : (t < 0.4 ? pal.grassDry : pal.grassLow);
    }
    if (r > 0.1 && h > 0.4) {
      _c.setHex(hex);
      _c.lerp(roadC3, Math.min(0.92, r * 1.3));
      return _c.getHex();
    }
    return hex;
  }

  const put = (i0, j0, i1, j1, i2, j2) => {
    const x0 = min + i0 * step, z0 = min + j0 * step, y0 = H(i0, j0);
    const x1 = min + i1 * step, z1 = min + j1 * step, y1 = H(i1, j1);
    const x2 = min + i2 * step, z2 = min + j2 * step, y2 = H(i2, j2);
    // face normal → slope
    const ax = x1 - x0, ay = y1 - y0, az = z1 - z0;
    const bx = x2 - x0, by = y2 - y0, bz = z2 - z0;
    let nx = ay * bz - az * by, ny = az * bx - ax * bz, nz = ax * by - ay * bx;
    const l = Math.hypot(nx, ny, nz) || 1;
    ny /= l;
    const slope = 1 - Math.abs(ny);
    const hAvg = (y0 + y1 + y2) / 3;
    const cx = (x0 + x1 + x2) / 3, cz = (z0 + z1 + z2) / 3;
    const hex = faceColor(hAvg, slope, i0, j0, cx, cz);
    _c.setHex(hex);
    const p = o * 9;
    pos[p] = x0; pos[p + 1] = y0; pos[p + 2] = z0;
    pos[p + 3] = x1; pos[p + 4] = y1; pos[p + 5] = z1;
    pos[p + 6] = x2; pos[p + 7] = y2; pos[p + 8] = z2;
    for (let k = 0; k < 3; k++) {
      col[p + k * 3] = _c.r; col[p + k * 3 + 1] = _c.g; col[p + k * 3 + 2] = _c.b;
    }
    o++;
  };

  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      // alternate diagonal for a less regular facet pattern
      if (((i + j) & 1) === 0) {
        put(i, j, i, j + 1, i + 1, j + 1);
        put(i, j, i + 1, j + 1, i + 1, j);
      } else {
        put(i, j, i, j + 1, i + 1, j);
        put(i + 1, j, i, j + 1, i + 1, j + 1);
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos.subarray(0, o * 9), 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col.subarray(0, o * 9), 3));
  geo.computeVertexNormals();
  geo.computeBoundingSphere();
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.castShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}

export function buildWater(level) {
  const grp = new THREE.Group();
  const R = level.radius;
  const size = (R + 90) * 2;
  const wg = new THREE.PlaneGeometry(size, size, 24, 24);
  wg.rotateX(-Math.PI / 2);
  const wm = new THREE.MeshLambertMaterial({
    color: level.pal.water, transparent: true, opacity: 0.92, flatShading: true,
  });
  const w = new THREE.Mesh(wg, wm);
  w.position.y = -0.05;
  w.receiveShadow = false;
  grp.add(w);
  // deep base so the island edge never shows through
  const dg = new THREE.PlaneGeometry(size * 1.2, size * 1.2);
  dg.rotateX(-Math.PI / 2);
  const d = new THREE.Mesh(dg, new THREE.MeshLambertMaterial({ color: level.pal.waterDeep }));
  d.position.y = -9;
  grp.add(d);
  grp.userData.surface = w;
  grp.userData.base = wg.attributes.position.array.slice();
  return grp;
}

export function animateWater(waterGrp, t) {
  const w = waterGrp.userData.surface;
  const arr = w.geometry.attributes.position.array;
  const base = waterGrp.userData.base;
  for (let i = 0; i < arr.length; i += 3) {
    arr[i + 1] = Math.sin(base[i] * 0.03 + t * 0.7) * 0.16 + Math.cos(base[i + 2] * 0.037 - t * 0.55) * 0.14;
  }
  w.geometry.attributes.position.needsUpdate = true;
  w.geometry.computeVertexNormals();
}

function treeParts(kind, pal, rnd) {
  const parts = [];
  if (kind === 'pine') {
    const h = 3.2 + rnd() * 2.2;
    parts.push({ g: cyl(0.16, 0.24, h * 0.42, 5), c: pal.trunk, p: [0, h * 0.21, 0] });
    for (let i = 0; i < 3; i++) {
      const y = h * (0.34 + i * 0.24);
      const r = 1.55 * (1 - i * 0.26);
      parts.push({ g: cone(r, h * 0.42, 6), c: i % 2 ? pal.treeAlt : pal.tree, p: [0, y, 0] });
    }
  } else if (kind === 'round') {
    const h = 2.6 + rnd() * 1.6;
    parts.push({ g: cyl(0.18, 0.26, h * 0.6, 5), c: pal.trunk, p: [0, h * 0.3, 0] });
    parts.push({ g: sph(1.25, 6, 4), c: pal.tree, p: [0, h * 0.72, 0], s: [1, 0.85, 1] });
    parts.push({ g: sph(0.8, 5, 3), c: pal.treeAlt, p: [0.5, h * 0.62, 0.35] });
  } else if (kind === 'palm') {
    const h = 4 + rnd() * 1.5;
    parts.push({ g: cyl(0.16, 0.24, h, 5), c: pal.trunk, p: [0, h / 2, 0], r: [0.09, 0, 0.06] });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      parts.push({
        g: box(1.9, 0.1, 0.5), c: pal.tree,
        p: [Math.cos(a) * 0.9, h, Math.sin(a) * 0.9], r: [0, -a, -0.35],
      });
    }
  } else if (kind === 'dead') {
    const h = 3 + rnd() * 1.4;
    parts.push({ g: cyl(0.12, 0.3, h, 5), c: pal.trunk, p: [0, h / 2, 0] });
    parts.push({ g: box(1.4, 0.12, 0.12), c: pal.trunk, p: [0.5, h * 0.72, 0], r: [0, 0, 0.5] });
    parts.push({ g: box(1.1, 0.12, 0.12), c: pal.trunk, p: [-0.4, h * 0.55, 0], r: [0, 0.8, -0.5] });
  }
  return parts;
}

export function buildDecor(level, rnd) {
  const pal = level.pal, biome = level.cfg.biome;
  const all = [];
  for (const d of level.decor) {
    if (d.type === 'rock') {
      const s = d.s * (0.8 + rnd() * 0.8);
      all.push({ g: sph(1.1, 5, 3), c: pal.rock, p: [d.x, d.y + 0.3 * s, d.z], s: [s * 1.2, s * 0.8, s], r: [0, d.rot, 0.2] });
      if (rnd() < 0.5) all.push({ g: sph(0.6, 5, 3), c: pal.rock, p: [d.x + s, d.y + 0.2, d.z + s * 0.4], s: s * 0.8 });
      continue;
    }
    let kind = 'pine';
    if (biome === 'desert') kind = rnd() < 0.6 ? 'palm' : 'dead';
    else if (biome === 'snow') kind = rnd() < 0.85 ? 'pine' : 'dead';
    else if (biome === 'volcanic') kind = rnd() < 0.5 ? 'dead' : 'pine';
    else kind = rnd() < 0.55 ? 'pine' : 'round';
    for (const p of treeParts(kind, pal, rnd)) {
      const sc = (typeof p.s === 'number' ? [p.s, p.s, p.s] : (p.s || [1, 1, 1]));
      all.push({
        g: p.g, c: p.c,
        p: [d.x + (p.p ? p.p[0] : 0) * d.s, d.y + (p.p ? p.p[1] : 0) * d.s, d.z + (p.p ? p.p[2] : 0) * d.s],
        r: [(p.r ? p.r[0] : 0), (p.r ? p.r[1] : 0) + d.rot, (p.r ? p.r[2] : 0)],
        s: [sc[0] * d.s, sc[1] * d.s, sc[2] * d.s],
      });
    }
  }
  if (!all.length) return null;
  const geo = merge(all);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  mesh.castShadow = true;
  mesh.receiveShadow = false;
  mesh.frustumCulled = false;
  return mesh;
}

/** Spawn point markers — telegraphed during the day. */
export function buildSpawnMarker(spawn) {
  const parts = [];
  const c = spawn.flying ? 0x8a5ac8 : 0xb43a34;
  parts.push({ g: cyl(2.6, 3.0, 0.4, 12), c: 0x30262a, p: [0, 0.2, 0] });
  parts.push({ g: cyl(2.1, 2.3, 0.25, 12), c, p: [0, 0.5, 0] });
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2;
    parts.push({ g: cyl(0.22, 0.3, 3.4, 5), c: 0x3a2c2e, p: [Math.cos(a) * 1.7, 1.7, Math.sin(a) * 1.7] });
    parts.push({ g: cone(0.5, 0.9, 5), c, p: [Math.cos(a) * 1.7, 3.6, Math.sin(a) * 1.7] });
  }
  const m = new THREE.Mesh(merge(parts), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  m.castShadow = true;
  m.position.set(spawn.x, spawn.y, spawn.z);
  return m;
}
