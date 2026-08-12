// Renderer, lighting and the day→night lighting shift.
import * as THREE from '../vendor/three.module.min.js';

const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: true, powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.75));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xa9c6d6, 130, 320);

    this.ambient = new THREE.HemisphereLight(0x9ab9d8, 0x4a5236, 0.9);
    this.scene.add(this.ambient);
    this.fill = new THREE.AmbientLight(0xffffff, 0.22);
    this.scene.add(this.fill);

    this.sun = new THREE.DirectionalLight(0xfff0d0, 1.85);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const s = this.sun.shadow.camera;
    s.left = -95; s.right = 95; s.top = 95; s.bottom = -95;
    s.near = 1; s.far = 340;
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    this.sunTarget = new THREE.Object3D();
    this.scene.add(this.sunTarget);
    this.sun.target = this.sunTarget;

    this.sky = this.makeSky();
    this.scene.add(this.sky);

    this.torches = [];
    for (let i = 0; i < 7; i++) {
      const l = new THREE.PointLight(0xffa348, 0, 34, 1.7);
      this.torches.push(l);
      this.scene.add(l);
    }

    // the king carries his own light at night, so the unit you drive is
    // always the most readable thing on screen
    this.heroLight = new THREE.PointLight(0xffd9a0, 0, 30, 1.6);
    this.scene.add(this.heroLight);

    this.night = 0;
    this.pal = null;
  }

  makeSky() {
    const g = new THREE.SphereGeometry(600, 20, 12);
    const count = g.attributes.position.count;
    const col = new Float32Array(count * 3);
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    const mesh = new THREE.Mesh(g, m);
    mesh.frustumCulled = false;
    return mesh;
  }

  paintSky(top, bottom) {
    const g = this.sky.geometry;
    const pos = g.attributes.position, col = g.attributes.color;
    _c1.setHex(top); _c2.setHex(bottom);
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i) / 600;
      const t = Math.min(1, Math.max(0, (y + 0.25) / 1.0));
      const r = _c2.r + (_c1.r - _c2.r) * t;
      const gg = _c2.g + (_c1.g - _c2.g) * t;
      const b = _c2.b + (_c1.b - _c2.b) * t;
      col.setXYZ(i, r, gg, b);
    }
    col.needsUpdate = true;
  }

  setPalette(pal) {
    this.pal = pal;
    this.applyNight(this.night, true);
  }

  /** night: 0 = full day, 1 = deep night. */
  applyNight(night, force) {
    this.night = night;
    const p = this.pal;
    if (!p) return;
    const t = night;
    const lerpHex = (a, b) => {
      _c1.setHex(a); _c2.setHex(b);
      return _c1.lerp(_c2, t).getHex();
    };
    this.ambient.color.setHex(lerpHex(p.ambDay, p.ambNight));
    this.ambient.groundColor.setHex(lerpHex(0x6b6f4e, 0x131c30));
    this.ambient.intensity = 1.0 - t * 0.72;
    this.fill.intensity = 0.34 - t * 0.27;
    this.sun.color.setHex(lerpHex(p.sunDay, p.sunNight));
    this.sun.intensity = 2.0 - t * 1.66;
    const fogC = lerpHex(p.fog, p.skyNight);
    this.scene.fog.color.setHex(fogC);
    this.scene.fog.near = 150 - t * 66;
    this.scene.fog.far = 350 - t * 175;
    this.paintSky(lerpHex(p.skyDay, p.skyNight), lerpHex(0xe8f0f4, 0x24365e));
    // sun swings from high noon toward a low blue moon
    const ang = 0.95 - t * 0.55;
    this.sun.position.set(Math.cos(ang) * -110, Math.sin(ang) * 130 + 26, 78 - t * 40);
    for (const l of this.torches) l.intensity = t * 26;
    this.heroLight.intensity = t * 34;
  }

  placeTorches(points) {
    for (let i = 0; i < this.torches.length; i++) {
      const p = points[i];
      if (p) this.torches[i].position.set(p[0], p[1], p[2]);
      else this.torches[i].position.set(0, -100, 0);
    }
  }

  resize(w, h) { this.renderer.setSize(w, h, false); }
  render(cam) { this.renderer.render(this.scene, cam); }
}
