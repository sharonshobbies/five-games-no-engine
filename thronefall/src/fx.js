// Visual-only effects: pooled hit sparks, explosion puffs, rising coins,
// and instanced billboard health bars.
import * as THREE from '../vendor/three.module.min.js';
import { merge, box, sph, cyl } from './geo.js';
import { C } from './palette.js';

export class Puffs {
  constructor(scene, cap = 220) {
    const g = new THREE.IcosahedronGeometry(0.5, 0);
    this.mat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.95 });
    this.mesh = new THREE.InstancedMesh(g, this.mat, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    scene.add(this.mesh);
    this.items = [];
    this.cap = cap;
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
  }
  spawn(x, y, z, color, size, life, vy, spread) {
    if (this.items.length >= this.cap) return;
    this.items.push({
      x, y, z, color, size, life, t: 0, ttl: life,
      vx: (Math.random() - 0.5) * (spread || 3),
      vy: vy == null ? 3 + Math.random() * 2 : vy,
      vz: (Math.random() - 0.5) * (spread || 3),
      rot: Math.random() * 6.28,
    });
  }
  burst(x, y, z, n, color, size, spread, life) {
    for (let i = 0; i < n; i++) this.spawn(x, y, z, color, size * (0.6 + Math.random() * 0.8), life || 0.55, 2 + Math.random() * 5, spread);
  }
  update(dt) {
    const it = this.items;
    for (let i = it.length - 1; i >= 0; i--) {
      const p = it[i];
      p.t += dt;
      if (p.t >= p.ttl) { it.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      p.vy -= 9 * dt;
      p.vx *= 0.96; p.vz *= 0.96;
    }
    const n = Math.min(it.length, this.cap);
    for (let i = 0; i < n; i++) {
      const p = it[i];
      const k = 1 - p.t / p.ttl;
      const s = p.size * (0.4 + k * 0.9);
      this._q.setFromAxisAngle(this._v.set(0.4, 1, 0.2).normalize(), p.rot + p.t * 4);
      this._m.compose(this._v.set(p.x, p.y, p.z), this._q, this._s.set(s, s, s));
      this.mesh.setMatrixAt(i, this._m);
      this._c.setHex(p.color);
      this.mesh.setColorAt(i, this._c);
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.items.length = 0; this.mesh.count = 0; }
}

export class HealthBars {
  constructor(scene, cap = 420) {
    const g = new THREE.PlaneGeometry(1, 1);
    g.translate(0.5, 0, 0); // pivot on the left edge so scale.x fills rightward
    this.matBg = new THREE.MeshBasicMaterial({ color: 0x1c1a20, transparent: true, opacity: 0.75 });
    this.matFg = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true });
    this.bg = new THREE.InstancedMesh(g, this.matBg, cap);
    this.fg = new THREE.InstancedMesh(g, this.matFg, cap);
    for (const m of [this.bg, this.fg]) {
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.frustumCulled = false;
      m.count = 0;
      m.renderOrder = 20;
      scene.add(m);
    }
    this.fg.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
    this.cap = cap;
    this.n = 0;
    this._m = new THREE.Matrix4();
    this._v = new THREE.Vector3();
    this._s = new THREE.Vector3();
    this._c = new THREE.Color();
    this.quat = new THREE.Quaternion();
  }
  begin(camQuat) { this.n = 0; this.quat.copy(camQuat); }
  add(x, y, z, frac, width, color) {
    if (this.n >= this.cap) return;
    const i = this.n++;
    const w = width || 1.6, h = w * 0.13;
    this._m.compose(this._v.set(x - w / 2, y, z), this.quat, this._s.set(w, h, 1));
    this.bg.setMatrixAt(i, this._m);
    const f = Math.max(0, Math.min(1, frac));
    this._m.compose(this._v.set(x - w / 2, y, z), this.quat, this._s.set(w * f, h * 0.72, 1));
    this.fg.setMatrixAt(i, this._m);
    this._c.setHex(color != null ? color : (f > 0.5 ? C.hpGood : (f > 0.22 ? 0xe0b23c : C.hpBad)));
    this.fg.setColorAt(i, this._c);
  }
  end() {
    this.bg.count = this.n; this.fg.count = this.n;
    this.bg.instanceMatrix.needsUpdate = true;
    this.fg.instanceMatrix.needsUpdate = true;
    if (this.fg.instanceColor) this.fg.instanceColor.needsUpdate = true;
  }
}

/**
 * Ambient rain, as an instanced streak field that follows the camera. Only
 * Sturmklamm declares weather, matching the map that introduced it.
 */
export class Rain {
  constructor(scene, count = 600) {
    const g = new THREE.BoxGeometry(0.055, 1.5, 0.055);
    const m = new THREE.MeshBasicMaterial({ color: 0xbcd2e4, transparent: true, opacity: 0.42 });
    this.mesh = new THREE.InstancedMesh(g, m, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.n = count;
    this.p = new Float32Array(count * 3);
    this.v = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      this.p[i * 3] = (Math.random() - 0.5) * 150;
      this.p[i * 3 + 1] = Math.random() * 60;
      this.p[i * 3 + 2] = (Math.random() - 0.5) * 150;
      this.v[i] = 42 + Math.random() * 26;
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.16, 0, 0.1));
    this._t = new THREE.Vector3();
    this._s = new THREE.Vector3(1, 1, 1);
  }
  update(dt, cx, cz) {
    for (let i = 0; i < this.n; i++) {
      const o = i * 3;
      this.p[o + 1] -= this.v[i] * dt;
      this.p[o] += 6 * dt;
      if (this.p[o + 1] < -2) {
        this.p[o] = cx + (Math.random() - 0.5) * 150;
        this.p[o + 1] = 46 + Math.random() * 22;
        this.p[o + 2] = cz + (Math.random() - 0.5) * 150;
      }
      const l = 0.7 + this.v[i] * 0.045;
      this._s.set(1, l, 1);
      this._m.compose(this._t.set(this.p[o], this.p[o + 1], this.p[o + 2]), this._q, this._s);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

/** Ground ring used for build placement, ability radius, and boss telegraphs. */
export function makeRing(radius, color, thickness = 0.5) {
  const g = new THREE.RingGeometry(radius - thickness, radius, 48);
  g.rotateX(-Math.PI / 2);
  const m = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false });
  const mesh = new THREE.Mesh(g, m);
  mesh.renderOrder = 5;
  return mesh;
}

let torchGeo = null, flameGeo = null;
export function torchArt() {
  if (!torchGeo) {
    torchGeo = merge([
      { g: cyl(0.09, 0.12, 1.5, 5), c: C.woodDark, p: [0, 0.75, 0] },
      { g: cyl(0.2, 0.14, 0.3, 6), c: 0x4a4038, p: [0, 1.55, 0] },
    ]);
  }
  return torchGeo;
}
/** Unlit so it stays bright at night — this is what reads as fire. */
export function flameArt() {
  if (!flameGeo) {
    flameGeo = merge([
      { g: sph(0.3, 6, 4), c: C.fire, p: [0, 1.82, 0] },
      { g: sph(0.16, 5, 4), c: C.fireCore, p: [0, 1.95, 0] },
    ]);
  }
  return flameGeo;
}
