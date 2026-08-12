// Rendering: three.js, orthographic, everything additive-or-disc instanced.
//
// Layer order (all depth-testless, painted back to front):
//   0 background    hex lattice + arena rim, one full-view quad
//   1 food glow     additive halos
//   2 food core     additive bright centres
//   3 body glow     additive bloom around every snake
//   4 body shell    dark outline discs, one radius step larger
//   5 body          the banded skin discs
//   6 eyes/pupils   textured discs on the head
//   7 sparks        additive boost flare + death burst particles
//
// Everything offscreen is culled per-snake and per-orb before it reaches a
// batch, so the instance counts track what is visible rather than what exists.

import * as THREE from '../vendor/three.module.min.js';
import { SpriteBatch } from './batch.js';
import { makeGlowTexture, makeEyeTexture, makePupilTexture } from './textures.js';
import {
  ARENA_R, BODY_INSTANCE_CAP, FOOD_INSTANCE_CAP, BORDER_GLOW,
} from './config.js';
import { clamp, TAU } from './math.js';

const BG_VERT = /* glsl */ `
  precision highp float;
  attribute vec3 position;
  uniform vec2 uCentre;
  uniform vec2 uViewHalf;
  varying vec2 vWorld;
  void main() {
    vWorld = uCentre + position.xy * uViewHalf * 2.0;
    gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
  }
`;

// The arena floor is generated in the fragment shader rather than sampled from
// a tiling texture. A texture was the first attempt and it went flat grey-black
// under minification: at the zoom levels the game actually uses, a 192px hex
// tile lands three mip levels down and averages itself away. Solving it
// analytically keeps the lattice crisp at every zoom and lets the rim glow,
// the lattice fade and the void outside all share one pass.
//
// Hex lattice via the standard two-candidate axial fold: for pointy-top hexes
// of flat-to-flat width 1, centres live on two interleaved rectangular
// lattices of pitch (1, sqrt(3)), and hexDist() is the hexagonal norm that
// reads 0.5 exactly on an edge.
const BG_FRAG = /* glsl */ `
  precision highp float;
  uniform float uArenaR;
  uniform float uBorderW;
  uniform float uTime;
  uniform float uHexW;    // hex flat-to-flat width, world units
  uniform float uHexPx;   // screen pixels per hex-space unit
  varying vec2 vWorld;

  const vec2 S = vec2(1.0, 1.7320508);

  vec4 getHex(vec2 p) {
    vec4 hC = floor(vec4(p, p - vec2(0.5, 1.0)) / S.xyxy) + 0.5;
    vec4 h = vec4(p - hC.xy * S, p - (hC.zw + 0.5) * S);
    return dot(h.xy, h.xy) < dot(h.zw, h.zw)
      ? vec4(h.xy, hC.xy)
      : vec4(h.zw, hC.zw + vec2(0.5, 1.0));
  }

  float hexDist(vec2 p) {
    p = abs(p);
    return max(dot(p, normalize(vec2(1.0, 1.7320508))), p.x);
  }

  void main() {
    vec2 hp = vWorld / uHexW;
    vec4 h = getHex(hp);
    float hd = hexDist(h.xy);

    // One screen pixel, expressed in hex-space units.
    float aa = clamp(1.35 / max(uHexPx, 1.0), 0.002, 0.2);
    float lw = 0.020 + aa * 0.5;

    float fill = 1.0 - smoothstep(0.5 - lw - aa, 0.5 - lw, hd);
    float ring = (1.0 - smoothstep(0.5 - aa, 0.5, hd)) - fill;

    // The lattice has to be felt, not read. Loud enough to give the eye a sense
    // of speed, quiet enough that a dim snake still reads as the brightest
    // thing on screen.
    vec3 cVoid = vec3(0.020, 0.026, 0.055);
    vec3 cTop  = vec3(0.043, 0.058, 0.113);
    vec3 cBot  = vec3(0.026, 0.035, 0.076);
    vec3 cEdge = vec3(0.086, 0.125, 0.235);

    float g = clamp(h.y / 1.1547 + 0.5, 0.0, 1.0);
    vec3 col = cVoid;
    col = mix(col, mix(cBot, cTop, g), fill);
    col = mix(col, cEdge, clamp(ring, 0.0, 1.0) * 0.85);

    float d = length(vWorld);

    // Vignette toward the rim so the eye is pulled back to the middle.
    col *= mix(0.42, 1.0, 1.0 - smoothstep(uArenaR - uBorderW * 3.0, uArenaR, d));

    // Danger band: this is the wall, and it kills.
    float band = smoothstep(uArenaR - uBorderW, uArenaR - uBorderW * 0.04, d);
    float pulse = 0.80 + 0.20 * sin(uTime * 2.1);
    col += vec3(0.70, 0.060, 0.115) * band * band * pulse;

    // Hot edge line, then the void beyond.
    float edge = smoothstep(uArenaR - 30.0, uArenaR - 5.0, d)
               * (1.0 - smoothstep(uArenaR + 4.0, uArenaR + 32.0, d));
    col += vec3(1.0, 0.34, 0.38) * edge;
    float outside = smoothstep(uArenaR, uArenaR + 40.0, d);
    col = mix(col, vec3(0.012, 0.010, 0.024), outside);

    gl_FragColor = vec4(col, 1.0);
  }
`;

const HEX_W = 38; // hex flat-to-flat width in world units

export class Renderer {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setClearColor(0x05070f, 1);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    this.scene = new THREE.Scene();
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -100, 100);
    this.camera.position.z = 10;

    const glow = makeGlowTexture(128);

    // ---- background quad, drawn in clip space and fed the world rect
    const bgGeo = new THREE.BufferGeometry();
    bgGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0,
      -0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0,
    ]), 3));
    this.bgMat = new THREE.RawShaderMaterial({
      vertexShader: BG_VERT,
      fragmentShader: BG_FRAG,
      uniforms: {
        uCentre: { value: new THREE.Vector2() },
        uViewHalf: { value: new THREE.Vector2() },
        uArenaR: { value: ARENA_R },
        uBorderW: { value: BORDER_GLOW },
        uTime: { value: 0 },
        uHexW: { value: HEX_W },
        uHexPx: { value: HEX_W },
      },
      depthTest: false,
      depthWrite: false,
    });
    this.bg = new THREE.Mesh(bgGeo, this.bgMat);
    this.bg.frustumCulled = false;
    this.bg.renderOrder = 0;
    this.scene.add(this.bg);

    const add = THREE.AdditiveBlending;
    this.foodGlow = new SpriteBatch(FOOD_INSTANCE_CAP, { mode: 'tex', map: glow, blending: add, renderOrder: 1 });
    this.foodCore = new SpriteBatch(FOOD_INSTANCE_CAP, { mode: 'tex', map: glow, blending: add, renderOrder: 2 });
    this.bodyGlow = new SpriteBatch(BODY_INSTANCE_CAP, { mode: 'tex', map: glow, blending: add, renderOrder: 3 });
    this.bodyShell = new SpriteBatch(BODY_INSTANCE_CAP, { mode: 'disc', shade: 0.0, renderOrder: 4 });
    this.body = new SpriteBatch(BODY_INSTANCE_CAP, { mode: 'disc', shade: 0.13, renderOrder: 5 });
    this.eyes = new SpriteBatch(512, { mode: 'tex', map: makeEyeTexture(), renderOrder: 6 });
    this.pupils = new SpriteBatch(512, { mode: 'tex', map: makePupilTexture(), renderOrder: 7 });
    this.sparks = new SpriteBatch(4096, { mode: 'tex', map: glow, blending: add, renderOrder: 8 });

    this.batches = [
      this.foodGlow, this.foodCore, this.bodyGlow, this.bodyShell,
      this.body, this.eyes, this.pupils, this.sparks,
    ];
    for (const b of this.batches) this.scene.add(b.mesh);

    this.pxPerUnit = 1;
    this.viewHalfW = 1;
    this.viewHalfH = 1;
    this.stats = { body: 0, food: 0, sparks: 0, drawn: 0 };
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.w = w;
    this.h = h;
  }

  /** Point the ortho camera at (cx,cy) with `pxPerUnit` zoom. */
  setView(cx, cy, pxPerUnit) {
    this.pxPerUnit = pxPerUnit;
    const hw = this.w / 2 / pxPerUnit;
    const hh = this.h / 2 / pxPerUnit;
    this.viewHalfW = hw;
    this.viewHalfH = hh;
    this.cx = cx;
    this.cy = cy;
    const c = this.camera;
    c.left = -hw;
    c.right = hw;
    c.top = hh;
    c.bottom = -hh;
    c.position.x = cx;
    c.position.y = cy;
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
    this.bgMat.uniforms.uCentre.value.set(cx, cy);
    this.bgMat.uniforms.uViewHalf.value.set(hw, hh);
    this.bgMat.uniforms.uHexPx.value = HEX_W * pxPerUnit;
  }

  visible(x, y, pad) {
    return (
      x > this.cx - this.viewHalfW - pad &&
      x < this.cx + this.viewHalfW + pad &&
      y > this.cy - this.viewHalfH - pad &&
      y < this.cy + this.viewHalfH + pad
    );
  }

  beginFrame(time) {
    this.bgMat.uniforms.uTime.value = time;
    for (const b of this.batches) b.begin();
  }

  endFrame() {
    for (const b of this.batches) b.end(this.pxPerUnit);
    this.stats.body = this.body.n;
    this.stats.food = this.foodCore.n;
    this.stats.sparks = this.sparks.n;
    this.stats.drawn = this.batches.reduce((a, b) => a + b.n, 0);
    this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------------ food
  drawFood(food, time) {
    const pad = 60;
    const glowB = this.foodGlow;
    const coreB = this.foodCore;
    for (let i = 0; i < food.n; i++) {
      if (!food.alive[i]) continue;
      const x = food.x[i];
      const y = food.y[i];
      if (!this.visible(x, y, pad)) continue;
      const r = food.r[i];
      // Twinkle: orbs breathe, which is most of why the arena feels alive.
      const p = 0.86 + 0.14 * Math.sin(time * 3.1 + food.phase[i]);
      const cr = food.cr[i];
      const cg = food.cg[i];
      const cb = food.cb[i];
      glowB.push(x, y, r * 3.1 * p, cr * 0.54, cg * 0.54, cb * 0.54, 0.62);
      coreB.push(x, y, r * 1.05 * p, cr, cg, cb, 0.96);
    }
  }

  drawPrey(prey, time) {
    for (const p of prey.items) {
      if (!p.alive || !this.visible(p.x, p.y, 80)) continue;
      const pulse = 0.85 + 0.15 * Math.sin(time * 6 + p.phase);
      this.foodGlow.push(p.x, p.y, p.r * 5.2 * pulse, p.rgb[0] * 0.6, p.rgb[1] * 0.6, p.rgb[2] * 0.6, 0.7);
      this.foodCore.push(p.x, p.y, p.r * 1.55 * pulse, 1, 1, 1, 0.95);
      this.foodCore.push(p.x, p.y, p.r * 2.6 * pulse, p.rgb[0], p.rgb[1], p.rgb[2], 0.6);
    }
  }

  // ------------------------------------------------------------------ snakes
  /**
   * Draw one snake. Body discs are stepped along the recorded path; the step is
   * a fraction of the radius so consecutive discs overlap into a smooth tube,
   * and it stretches for distant snakes as a cheap LOD.
   */
  drawSnake(s, time, isPlayer) {
    const r = s.radius;
    const len = s.bodyLength;
    // Cull whole snakes whose entire body is offscreen.
    const reach = len * 0.5 + r * 2;
    if (!this.visible(s.x, s.y, reach + 40)) {
      // The body may still cross the view even if the head does not: test the
      // midpoint and tail too before dropping it.
      const out = this._o || (this._o = [0, 0]);
      s.pointBack(len * 0.5, out);
      const midVis = this.visible(out[0], out[1], reach * 0.6 + 60);
      s.pointBack(len, out);
      if (!midVis && !this.visible(out[0], out[1], reach * 0.6 + 60)) return 0;
    }

    const boostGlow = s.boosting ? 1 : 0;
    const step = Math.max(2.2, r * 0.28);
    const out = this._o || (this._o = [0, 0]);
    const rgb = this._c || (this._c = [0, 0, 0]);
    const glowB = this.bodyGlow;
    const shellB = this.bodyShell;
    const bodyB = this.body;
    let drawn = 0;

    // Tail taper: the last stretch narrows so the snake ends in a point.
    const taperStart = len - Math.min(len * 0.5, r * 5.5);
    const taperSpan = Math.max(1, len - taperStart);

    // ---- glow pass, walked separately and coarsely.
    //
    // This used to run at the body stride with radius 2.5r, and it was the
    // single worst thing in the frame: a 260-part snake at radius 60 wrote
    // ~31M additive fragments, 34x the whole screen, and dropped a software
    // rasteriser to 22fps. Two changes fix it without losing the bloom -- the
    // halo is a bounded offset beyond the body rather than a multiple of it
    // (a fat snake does not need a 350px aura), and the stride is ~4x the body
    // stride, which the wide halo still overlaps smoothly.
    const glowR = r * 1.72 + 9 + boostGlow * (r * 0.5 + 8);
    const glowStep = Math.max(step * 3.6, r * 1.0);
    // The halo's bright core sits under the opaque body, so only the texture's
    // outer skirt is ever visible -- which is why this alpha has to be high to
    // read at all. At 0.26 the snakes had no glow whatsoever.
    const gA = 0.95 + boostGlow * 0.55;
    for (let d = len; d >= 0; d -= glowStep) {
      s.pointBack(d, out);
      if (!this.visible(out[0], out[1], glowR)) continue;
      let gr = glowR;
      if (d > taperStart) gr *= 1 - 0.55 * ((d - taperStart) / taperSpan) ** 2;
      s.bandAt(d, rgb);
      glowB.push(out[0], out[1], gr, rgb[0] * 0.60, rgb[1] * 0.60, rgb[2] * 0.60, gA);
    }

    // ---- shell + body
    for (let d = len; d >= 0; d -= step) {
      s.pointBack(d, out);
      const x = out[0];
      const y = out[1];
      if (!this.visible(x, y, r * 1.6)) continue;
      let rr = r;
      if (d > taperStart) {
        const t = (d - taperStart) / taperSpan;
        rr = r * (1 - 0.72 * t * t);
      }
      s.bandAt(d, rgb);
      // Dark shell one step out, so adjacent snakes never visually merge.
      shellB.push(x, y, rr * 1.11 + 1.1, rgb[0] * 0.24, rgb[1] * 0.24, rgb[2] * 0.30, 0.85);
      const lift = boostGlow ? 1.3 : 1.0;
      bodyB.push(x, y, rr, rgb[0] * lift, rgb[1] * lift, rgb[2] * lift, 1.0);
      drawn++;
    }

    // ------------------------------------------------- head, eyes and pupils
    if (this.visible(s.x, s.y, r * 4)) {
      s.bandAt(0, rgb);
      const hx = s.x;
      const hy = s.y;
      const ca = Math.cos(s.angle);
      const sa = Math.sin(s.angle);
      glowB.push(hx, hy, glowR * 1.3, rgb[0] * 0.66, rgb[1] * 0.66, rgb[2] * 0.66, 0.85 + boostGlow * 0.5);
      shellB.push(hx, hy, r * 1.14 + 1.3, rgb[0] * 0.24, rgb[1] * 0.24, rgb[2] * 0.30, 0.88);
      bodyB.push(hx, hy, r * 1.02, rgb[0], rgb[1], rgb[2], 1.0);

      // Eyes sit forward and to the sides; pupils lead the turn, which is what
      // makes the head look like it is looking where it is going.
      const eyeOut = r * 0.44;
      const eyeFwd = r * 0.46;
      const eyeR = r * 0.37;
      const look = s.targetAngle - s.angle;
      const lookN = clamp(Math.atan2(Math.sin(look), Math.cos(look)) / 1.2, -1, 1);
      for (const side of [-1, 1]) {
        const ex = hx + ca * eyeFwd - sa * eyeOut * side;
        const ey = hy + sa * eyeFwd + ca * eyeOut * side;
        this.eyes.push(ex, ey, eyeR, 1, 1, 1, 1);
        const px = ex + ca * eyeR * 0.34 - sa * eyeR * 0.34 * lookN;
        const py = ey + sa * eyeR * 0.34 + ca * eyeR * 0.34 * lookN;
        this.pupils.push(px, py, eyeR * 0.52, 1, 1, 1, 1);
      }

      // Sprint flare off the head.
      if (boostGlow) {
        const f = 0.7 + 0.3 * Math.sin(time * 22);
        this.sparks.push(hx + ca * r * 0.3, hy + sa * r * 0.3, r * 3.4 * f, rgb[0], rgb[1], rgb[2], 0.42);
      }
    }
    return drawn;
  }

  drawSparks(particles) {
    for (const p of particles) {
      if (!this.visible(p.x, p.y, 120)) continue;
      const t = 1 - p.life / p.maxLife;
      this.sparks.push(p.x, p.y, p.r * (0.5 + t * 1.6), p.r0, p.g0, p.b0, t * 0.85);
    }
  }
}
