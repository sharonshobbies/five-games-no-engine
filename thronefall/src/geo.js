// Geometry helpers. Everything in the game is one merged, vertex-colored
// BufferGeometry per archetype so a unit or a building is a single draw call
// and the whole world shares two or three materials.
import * as THREE from '../vendor/three.module.min.js';

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _c = new THREE.Color();

/**
 * Merge a list of parts into one non-indexed, vertex-colored geometry.
 * part: { g: BufferGeometry, c: hexColor, p:[x,y,z], r:[rx,ry,rz], s:[x,y,z]|number }
 */
export function merge(parts) {
  const geos = [];
  let total = 0;
  for (const part of parts) {
    let g = part.g;
    if (g.index) g = g.toNonIndexed();
    else g = g.clone();
    const p = part.p || [0, 0, 0];
    const r = part.r || [0, 0, 0];
    let s = part.s == null ? [1, 1, 1] : part.s;
    if (typeof s === 'number') s = [s, s, s];
    _e.set(r[0], r[1], r[2]);
    _q.setFromEuler(_e);
    _m.compose(_v.set(p[0], p[1], p[2]), _q, new THREE.Vector3(s[0], s[1], s[2]));
    g.applyMatrix4(_m);
    const count = g.attributes.position.count;
    const col = new Float32Array(count * 3);
    _c.setHex(part.c == null ? 0xffffff : part.c);
    for (let i = 0; i < count; i++) {
      col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    total += count;
    geos.push(g);
  }
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  let o = 0;
  for (const g of geos) {
    const n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3);
    if (g.attributes.normal) nor.set(g.attributes.normal.array, o * 3);
    col.set(g.attributes.color.array, o * 3);
    o += n;
    g.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

// --- primitive shorthands (cached where the params repeat) -------------------
const boxCache = new Map();
export function box(w, h, d) {
  const k = `${w}|${h}|${d}`;
  let g = boxCache.get(k);
  if (!g) { g = new THREE.BoxGeometry(w, h, d); boxCache.set(k, g); }
  return g;
}
const cylCache = new Map();
export function cyl(rt, rb, h, seg = 8, open = false) {
  const k = `${rt}|${rb}|${h}|${seg}|${open}`;
  let g = cylCache.get(k);
  if (!g) { g = new THREE.CylinderGeometry(rt, rb, h, seg, 1, open); cylCache.set(k, g); }
  return g;
}
export function cone(r, h, seg = 6) { return cyl(0.0001, r, h, seg); }
const sphCache = new Map();
export function sph(r, w = 6, h = 4) {
  const k = `${r}|${w}|${h}`;
  let g = sphCache.get(k);
  if (!g) { g = new THREE.SphereGeometry(r, w, h); sphCache.set(k, g); }
  return g;
}
export function prism(w, h, d) {
  // triangular prism, apex along +Y, length along X — a low-poly roof
  const hw = w / 2, hd = d / 2;
  const v = [
    // +Z slope
    -hw, 0, hd, hw, 0, hd, hw, h, 0, -hw, 0, hd, hw, h, 0, -hw, h, 0,
    // -Z slope
    hw, 0, -hd, -hw, 0, -hd, -hw, h, 0, hw, 0, -hd, -hw, h, 0, hw, h, 0,
    // -X gable
    -hw, 0, -hd, -hw, 0, hd, -hw, h, 0,
    // +X gable
    hw, 0, hd, hw, 0, -hd, hw, h, 0,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(v), 3));
  g.computeVertexNormals();
  return g;
}

/** A flat regular polygon disc in the XZ plane at y=0. */
export function disc(r, seg = 16) {
  const g = new THREE.CircleGeometry(r, seg);
  g.rotateX(-Math.PI / 2);
  return g;
}

/** A ring (annulus) in the XZ plane. */
export function ring(ri, ro, seg = 24) {
  const g = new THREE.RingGeometry(ri, ro, seg);
  g.rotateX(-Math.PI / 2);
  return g;
}

export const flatMat = (extra = {}) => new THREE.MeshLambertMaterial(
  Object.assign({ vertexColors: true }, extra));

/**
 * Inverted-hull outline: push every vertex out along its normal and render the
 * back faces in near-black. This is what gives objects the inked silhouette the
 * original leans on for readability.
 */
const outlineCache = new WeakMap();
export function outlineGeo(geo, amount = 0.055) {
  let m = outlineCache.get(geo);
  if (m && m.amount === amount) return m.geo;
  const src = geo.attributes.position.array;
  const nor = geo.attributes.normal.array;
  const pos = new Float32Array(src.length);
  for (let i = 0; i < src.length; i += 3) {
    pos[i] = src[i] + nor[i] * amount;
    pos[i + 1] = src[i + 1] + nor[i + 1] * amount;
    pos[i + 2] = src[i + 2] + nor[i + 2] * amount;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.BufferAttribute(nor.slice(), 3));
  out.boundingSphere = geo.boundingSphere ? geo.boundingSphere.clone() : null;
  if (out.boundingSphere) out.boundingSphere.radius *= 1.05;
  outlineCache.set(geo, { geo: out, amount });
  return out;
}
