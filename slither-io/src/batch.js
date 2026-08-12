// Instanced quad batch: one draw call for tens of thousands of glowing discs.
//
// Points would be simpler but they are wrong here: a gl_PointSize sprite is
// culled the moment its CENTRE leaves the frustum, so a fat body segment would
// pop out of existence at the screen edge, and drivers cap point size (and
// SwiftShader caps it low). Instanced quads have neither problem and cost one
// extra vertex attribute.
//
// Two fragment modes:
//   disc  - analytically shaded circle with a screen-space-constant soft edge,
//           which is what makes overlapping segments read as one solid tube
//   tex   - a texture lookup, for the additive glow sprites and the eyes

import * as THREE from '../vendor/three.module.min.js';

const VERT = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  attribute vec2 uv;
  attribute vec2 iPos;
  attribute float iRadius;
  attribute vec3 iColor;
  attribute float iAlpha;
  uniform mat4 projectionMatrix;
  uniform mat4 modelViewMatrix;
  uniform float uPxPerUnit;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vEdge;
  void main() {
    vUv = uv;
    vColor = iColor;
    vAlpha = iAlpha;
    // Keep the antialiased rim ~1.6px wide no matter how big the disc is.
    float pxDiam = max(iRadius * 2.0 * uPxPerUnit, 1.5);
    vEdge = clamp(1.9 / pxDiam, 0.012, 0.42);
    vec3 p = vec3(iPos + position.xy * (iRadius * 2.0), 0.0);
    gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  }
`;

const FRAG_DISC = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  varying float vEdge;
  uniform float uShade;
  void main() {
    vec2 d = vUv - 0.5;
    float r = length(d) * 2.0;
    float a = 1.0 - smoothstep(1.0 - vEdge, 1.0, r);
    if (a <= 0.002) discard;
    // Radial shading: a lit crown and a darker rim give the tube volume.
    float sh = mix(1.0, 1.0 - uShade, smoothstep(0.10, 1.0, r));
    sh += (1.0 - smoothstep(0.0, 0.55, r)) * uShade * 0.42;
    gl_FragColor = vec4(vColor * sh, a * vAlpha);
  }
`;

const FRAG_TEX = /* glsl */ `
  precision highp float;
  varying vec2 vUv;
  varying vec3 vColor;
  varying float vAlpha;
  uniform sampler2D uMap;
  void main() {
    vec4 t = texture2D(uMap, vUv);
    if (t.a <= 0.002) discard;
    gl_FragColor = vec4(vColor * t.rgb, t.a * vAlpha);
  }
`;

let quadGeoTemplate = null;
function quadAttribs() {
  if (!quadGeoTemplate) {
    const g = new THREE.PlaneGeometry(1, 1);
    quadGeoTemplate = {
      position: g.getAttribute('position'),
      uv: g.getAttribute('uv'),
      index: g.getIndex(),
    };
  }
  return quadGeoTemplate;
}

export class SpriteBatch {
  /**
   * @param {number} capacity max instances
   * @param {object} opts { mode:'disc'|'tex', map, blending, shade, depthWrite }
   */
  constructor(capacity, opts = {}) {
    const mode = opts.mode || 'disc';
    this.capacity = capacity;
    this.n = 0;

    this.iPos = new Float32Array(capacity * 2);
    this.iRadius = new Float32Array(capacity);
    this.iColor = new Float32Array(capacity * 3);
    this.iAlpha = new Float32Array(capacity);

    const base = quadAttribs();
    const geo = new THREE.InstancedBufferGeometry();
    geo.setAttribute('position', base.position);
    geo.setAttribute('uv', base.uv);
    geo.setIndex(base.index);
    this.aPos = new THREE.InstancedBufferAttribute(this.iPos, 2);
    this.aRadius = new THREE.InstancedBufferAttribute(this.iRadius, 1);
    this.aColor = new THREE.InstancedBufferAttribute(this.iColor, 3);
    this.aAlpha = new THREE.InstancedBufferAttribute(this.iAlpha, 1);
    for (const a of [this.aPos, this.aRadius, this.aColor, this.aAlpha]) a.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iRadius', this.aRadius);
    geo.setAttribute('iColor', this.aColor);
    geo.setAttribute('iAlpha', this.aAlpha);
    geo.instanceCount = 0;
    // We cull by hand; a computed sphere would be wrong for dynamic instances.
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e9);

    const uniforms = { uPxPerUnit: { value: 1 } };
    if (mode === 'disc') uniforms.uShade = { value: opts.shade ?? 0.34 };
    else uniforms.uMap = { value: opts.map };

    const mat = new THREE.RawShaderMaterial({
      vertexShader: VERT,
      fragmentShader: mode === 'disc' ? FRAG_DISC : FRAG_TEX,
      uniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      blending: opts.blending ?? THREE.NormalBlending,
    });

    this.geometry = geo;
    this.material = mat;
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = opts.renderOrder ?? 0;
  }

  begin() {
    this.n = 0;
  }

  /** @returns {boolean} false when the batch is full */
  push(x, y, radius, r, g, b, alpha) {
    const i = this.n;
    if (i >= this.capacity) return false;
    this.n++;
    this.iPos[i * 2] = x;
    this.iPos[i * 2 + 1] = y;
    this.iRadius[i] = radius;
    const c = i * 3;
    this.iColor[c] = r;
    this.iColor[c + 1] = g;
    this.iColor[c + 2] = b;
    this.iAlpha[i] = alpha;
    return true;
  }

  end(pxPerUnit) {
    const n = this.n;
    this.geometry.instanceCount = n;
    this.material.uniforms.uPxPerUnit.value = pxPerUnit;
    if (n === 0) return;
    // One upload per batch per frame. Ranges keep SwiftShader honest.
    this.aPos.needsUpdate = true;
    this.aRadius.needsUpdate = true;
    this.aColor.needsUpdate = true;
    this.aAlpha.needsUpdate = true;
    this.aPos.clearUpdateRanges?.();
    this.aRadius.clearUpdateRanges?.();
    this.aColor.clearUpdateRanges?.();
    this.aAlpha.clearUpdateRanges?.();
    this.aPos.addUpdateRange?.(0, n * 2);
    this.aRadius.addUpdateRange?.(0, n);
    this.aColor.addUpdateRange?.(0, n * 3);
    this.aAlpha.addUpdateRange?.(0, n);
  }
}
