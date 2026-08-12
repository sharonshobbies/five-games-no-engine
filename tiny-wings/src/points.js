// One generic GPU point-sprite batch, reused for dust puffs, sparkles, coins and
// speed motes. Sizes are given in world units and converted to pixels each frame, so
// sprites stay the right physical size while the camera zooms.

import * as THREE from '../vendor/three.module.min.js';

const VERT = /* glsl */`
attribute float aSize;
attribute float aAlpha;
attribute float aRot;
attribute vec3  aColor;
uniform float uPxPerUnit;
varying float vAlpha;
varying float vRot;
varying vec3  vColor;
void main(){
  vAlpha = aAlpha;
  vRot = aRot;
  vColor = aColor;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, aSize * uPxPerUnit);
}
`;

const FRAG = /* glsl */`
precision highp float;
uniform sampler2D uMap;
uniform float uDim;
varying float vAlpha;
varying float vRot;
varying vec3  vColor;
void main(){
  vec2 uv = gl_PointCoord - 0.5;
  float c = cos(vRot), s = sin(vRot);
  uv = mat2(c, -s, s, c) * uv + 0.5;
  if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) discard;
  vec4 t = texture2D(uMap, uv);
  if (t.a * vAlpha < 0.003) discard;
  gl_FragColor = vec4(t.rgb * vColor * uDim, t.a * vAlpha);
}
`;

export class PointBatch {
  constructor(texture, capacity, { additive = false, renderOrder = 40 } = {}) {
    this.capacity = capacity;
    this.count = 0;

    const pos = new Float32Array(capacity * 3);
    const size = new Float32Array(capacity);
    const alpha = new Float32Array(capacity);
    const rot = new Float32Array(capacity);
    const color = new Float32Array(capacity * 3);

    const g = new THREE.BufferGeometry();
    this.aPos = new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage);
    this.aSize = new THREE.BufferAttribute(size, 1).setUsage(THREE.DynamicDrawUsage);
    this.aAlpha = new THREE.BufferAttribute(alpha, 1).setUsage(THREE.DynamicDrawUsage);
    this.aRot = new THREE.BufferAttribute(rot, 1).setUsage(THREE.DynamicDrawUsage);
    this.aColor = new THREE.BufferAttribute(color, 3).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('position', this.aPos);
    g.setAttribute('aSize', this.aSize);
    g.setAttribute('aAlpha', this.aAlpha);
    g.setAttribute('aRot', this.aRot);
    g.setAttribute('aColor', this.aColor);
    g.setDrawRange(0, 0);
    this.geo = g;

    this.uniforms = {
      uMap: { value: texture },
      uPxPerUnit: { value: 1 },
      uDim: { value: 1 },
    };
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = renderOrder;
  }

  begin() { this.count = 0; }

  push(x, y, size, alpha, rot, r, g, b) {
    if (this.count >= this.capacity) return;
    const i = this.count++;
    this.aPos.array[i * 3] = x;
    this.aPos.array[i * 3 + 1] = y;
    this.aPos.array[i * 3 + 2] = 0;
    this.aSize.array[i] = size;
    this.aAlpha.array[i] = alpha;
    this.aRot.array[i] = rot;
    this.aColor.array[i * 3] = r;
    this.aColor.array[i * 3 + 1] = g;
    this.aColor.array[i * 3 + 2] = b;
  }

  end() {
    this.geo.setDrawRange(0, this.count);
    this.aPos.needsUpdate = true;
    this.aSize.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aRot.needsUpdate = true;
    this.aColor.needsUpdate = true;
  }
}
