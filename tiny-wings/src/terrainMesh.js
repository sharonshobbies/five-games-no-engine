// The playfield hills: a triangle strip sampled straight from Terrain.height so the
// silhouette the player reads is exactly the surface the physics uses. The strip is a
// fixed vertex budget that we re-fill every frame over the visible window, so there is
// no chunk streaming and no seams.

import * as THREE from '../vendor/three.module.min.js';
import { NOISE, HILL_SHADE } from './shaderlib.js';

const COLS = 300;   // sample columns across the view

const VERT = /* glsl */`
attribute float aSurfaceY;
varying vec2 vWp;
varying float vSurf;
void main(){
  vWp = position.xy;
  vSurf = aSurfaceY;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vWp;
varying float vSurf;

uniform vec3 uDarkA, uDarkB, uLightA, uLightB, uRimA, uRimB;
uniform float uBlendX, uBlendW;
uniform float uDark, uFever, uTime;
uniform float uNightX;

${NOISE}
${HILL_SHADE}

void main(){
  float bt = smoothstep(uBlendX - uBlendW, uBlendX + uBlendW, vWp.x);
  vec3 d = mix(uDarkA, uDarkB, bt);
  vec3 l = mix(uLightA, uLightB, bt);
  vec3 r = mix(uRimA, uRimB, bt);

  float depth = max(0.0, vSurf - vWp.y);
  vec3 col = twHillShade(vWp, vSurf, depth, d, l, r, 11.0, 0.034, 0.55, 1.0);

  // a hint of sun from the upper right
  col *= 1.0 + 0.045 * smoothstep(-1.0, 1.0, sin(vWp.x * 0.02 + 1.2));

  // fever tints the grass warm and adds a shimmer along the surface line
  float band = 1.0 - smoothstep(0.0, 7.0, depth);
  col = mix(col, col * vec3(1.20, 1.06, 0.72) + vec3(0.10, 0.06, 0.0),
            uFever * (0.28 + 0.45 * band * (0.5 + 0.5 * sin(vWp.x * 0.35 - uTime * 9.0))));

  // night wall
  float nf = 1.0 - smoothstep(uNightX, uNightX + 520.0, vWp.x);
  col = mix(col, mix(col * 0.14, vec3(0.035, 0.045, 0.12), 0.6), nf * 0.94);

  col *= mix(1.0, 0.70, uDark);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class TerrainMesh {
  constructor(terrain) {
    this.terrain = terrain;
    const n = COLS + 1;
    this.n = n;

    const positions = new Float32Array(n * 2 * 3);
    const surf = new Float32Array(n * 2);
    const index = [];
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2, b = i * 2 + 1, c = (i + 1) * 2, dd = (i + 1) * 2 + 1;
      index.push(a, b, c, b, dd, c);
    }

    const geo = new THREE.BufferGeometry();
    this.posAttr = new THREE.BufferAttribute(positions, 3);
    this.posAttr.setUsage(THREE.DynamicDrawUsage);
    this.surfAttr = new THREE.BufferAttribute(surf, 1);
    this.surfAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('position', this.posAttr);
    geo.setAttribute('aSurfaceY', this.surfAttr);
    geo.setIndex(index);
    this.geo = geo;

    this.uniforms = {
      uDarkA: { value: new THREE.Color() }, uDarkB: { value: new THREE.Color() },
      uLightA: { value: new THREE.Color() }, uLightB: { value: new THREE.Color() },
      uRimA: { value: new THREE.Color() }, uRimB: { value: new THREE.Color() },
      uBlendX: { value: 1e9 }, uBlendW: { value: 120 },
      uDark: { value: 0 }, uFever: { value: 0 }, uTime: { value: 0 },
      uNightX: { value: -5000 },
    };

    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 10;
  }

  /** Re-sample the strip for the current view window. */
  update(camX, camY, viewW, viewH) {
    const t = this.terrain;
    const left = camX - viewW * 0.62;
    const right = camX + viewW * 0.62;
    const step = (right - left) / (this.n - 1);
    const floorY = camY - viewH * 0.62 - 40;

    const p = this.posAttr.array;
    const s = this.surfAttr.array;
    for (let i = 0; i < this.n; i++) {
      const x = left + i * step;
      const y = t.height(x);
      const o = i * 6;
      p[o + 0] = x; p[o + 1] = y; p[o + 2] = 0;
      p[o + 3] = x; p[o + 4] = floorY; p[o + 5] = 0;
      s[i * 2] = y; s[i * 2 + 1] = y;
    }
    this.posAttr.needsUpdate = true;
    this.surfAttr.needsUpdate = true;
  }
}
