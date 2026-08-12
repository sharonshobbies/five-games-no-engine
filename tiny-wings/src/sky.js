// Everything behind the playfield, drawn analytically in one full-screen fragment pass:
// sky gradient, sun/moon, stars, two parallax ridge layers, the sea, and the wall of
// night creeping in from behind. Doing it in a shader means no geometry to stream and
// no popping at the screen edges, and the parallax is exact at any zoom.

import * as THREE from '../vendor/three.module.min.js';
import { NOISE, HILL_SHADE, BG_HILL } from './shaderlib.js';

const VERT = /* glsl */`
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy * 2.0, 0.0, 1.0);
}
`;

const FRAG = /* glsl */`
precision highp float;
varying vec2 vUv;

uniform vec2  uCam;
uniform vec2  uView;       // world width/height visible
uniform float uTime;
uniform float uDark;       // 0 day .. 1 night
uniform float uNightX;     // world x of the advancing night wall
uniform float uFever;

uniform vec3 uSkyTopA, uSkyTopB, uSkyBotA, uSkyBotB;
uniform vec3 uHillDarkA, uHillDarkB, uHillLightA, uHillLightB, uRimA, uRimB;
uniform vec3 uWaterA, uWaterB, uFoamA, uFoamB;
uniform vec3 uSunA, uSunB, uCloudA, uCloudB;
uniform float uBlendX, uBlendW;

${NOISE}
${HILL_SHADE}
${BG_HILL}

void main(){
  // world position of this fragment
  vec2 wp = uCam + (vUv - 0.5) * uView;

  float bt = smoothstep(uBlendX - uBlendW, uBlendX + uBlendW, wp.x);
  vec3 skyTop = mix(uSkyTopA, uSkyTopB, bt);
  vec3 skyBot = mix(uSkyBotA, uSkyBotB, bt);
  vec3 hillD  = mix(uHillDarkA, uHillDarkB, bt);
  vec3 hillL  = mix(uHillLightA, uHillLightB, bt);
  vec3 rim    = mix(uRimA, uRimB, bt);
  vec3 water  = mix(uWaterA, uWaterB, bt);
  vec3 foam   = mix(uFoamA, uFoamB, bt);
  vec3 sunC   = mix(uSunA, uSunB, bt);
  vec3 cloudC = mix(uCloudA, uCloudB, bt);

  // ---------------- sky ----------------
  // Screen-anchored gradient (pale at the horizon, saturated overhead) with a gentle
  // world bias so climbing really does take you into deeper sky.
  float skyT = clamp(vUv.y * 0.96 + clamp((wp.y - 50.0) / 1500.0, -0.06, 0.34), 0.0, 1.0);
  vec3 col = mix(skyBot, skyTop, pow(skyT, 0.90));
  col += (tw_noise(wp * 0.004) - 0.5) * 0.012;

  // ---------------- stars ----------------
  float starAmt = smoothstep(0.42, 0.95, uDark);
  if (starAmt > 0.001) {
    vec2 sp = (vUv * uView * 0.30 + uCam * 0.05) * 0.9;
    vec2 cell = floor(sp * 0.6);
    float h = tw_hash(cell);
    if (h > 0.90) {
      vec2 c = (fract(sp * 0.6) - 0.5);
      float d = length(c);
      float tw = 0.55 + 0.45 * sin(uTime * 2.2 + h * 40.0);
      col += vec3(0.95, 0.96, 1.0) * starAmt * tw * smoothstep(0.16, 0.0, d) * 0.85
             * smoothstep(0.0, 0.35, skyT);
    }
  }

  // ---------------- sun / moon ----------------
  float sunH = mix(0.80, 0.055, smoothstep(0.0, 1.0, uDark));   // screen height 0..1
  vec2 sunS = vec2(0.775, sunH);
  vec2 dS = (vUv - sunS) * vec2(uView.x / uView.y, 1.0);
  float dr = length(dS);
  float R = 0.055;
  float glow = exp(-pow(dr / (R * 2.5), 1.55)) * (0.30 + 0.16 * (1.0 - uDark));
  // An additive glow on an already-bright sky just blows out to white, so scale it back
  // against the local sky luminance.
  float skyLum = dot(col, vec3(0.299, 0.587, 0.114));
  glow *= clamp(1.20 - skyLum * 0.85, 0.22, 1.0);
  col += sunC * glow;
  float disc = smoothstep(R, R * 0.90, dr);
  // Always keep the disc warmer and more saturated than the sky so it stays a shape.
  vec3 discC = mix(sunC, vec3(1.0, 0.90, 0.52), 0.55);
  col = mix(col, discC, disc * (1.0 - 0.25 * uDark));
  // moon rising as the sun sets
  float moonA = smoothstep(0.55, 1.0, uDark);
  vec2 mS = vec2(0.24, mix(0.30, 0.74, moonA));
  vec2 dM = (vUv - mS) * vec2(uView.x / uView.y, 1.0);
  float mr = length(dM);
  col += vec3(0.85, 0.88, 1.0) * moonA * exp(-pow(mr / 0.20, 1.6)) * 0.22;
  col = mix(col, vec3(0.96, 0.97, 1.0), smoothstep(0.042, 0.036, mr) * moonA * 0.95);

  // ---------------- soft high clouds (parallax 0.14) ----------------
  {
    float p = 0.14;
    vec2 tp = wp - uCam * (1.0 - p);
    float band = smoothstep(25.0, 105.0, tp.y) * (1.0 - smoothstep(150.0, 400.0, tp.y));
    float n = tw_fbm(vec2(tp.x * 0.0075 + uTime * 0.004, tp.y * 0.020));
    float c = smoothstep(0.54, 0.76, n) * band;
    col = mix(col, cloudC, c * 0.62 * (1.0 - 0.35 * uDark));
  }

  // ---------------- far ridge (parallax 0.26) ----------------
  // Authored in parallax space just above the waterline so it reads as sitting on the
  // horizon at any camera height or zoom.
  {
    float p = 0.26;
    vec2 tp = wp - uCam * (1.0 - p);
    float top = 14.0 + twRidge(tp.x, 17.0, 132.0, 1.7);
    if (tp.y < top) {
      float depth = top - tp.y;
      vec3 d = mix(hillD, skyBot, 0.60);
      vec3 l = mix(hillL, skyBot, 0.56);
      vec3 r = mix(rim, skyBot, 0.52);
      vec3 h = twHillShade(tp, top, depth, d, l, r, 5.8, 0.070, 0.25, 0.48);
      col = mix(col, h, 0.95);
    }
  }

  // ---------------- mid ridge (parallax 0.52) ----------------
  {
    float p = 0.52;
    vec2 tp = wp - uCam * (1.0 - p);
    float top = 4.0 + twRidge(tp.x + 900.0, 28.0, 208.0, 4.2);
    if (tp.y < top) {
      float depth = top - tp.y;
      vec3 d = mix(hillD, skyBot, 0.28);
      vec3 l = mix(hillL, skyBot, 0.24);
      vec3 r = mix(rim, skyBot, 0.20);
      vec3 h = twHillShade(tp, top, depth, d, l, r, 8.2, 0.052, 0.4, 0.72);
      col = mix(col, h, 0.98);
    }
  }

  // ---------------- sea ----------------
  // Drawn after the ridges and before the hill mesh, so open water shows exactly where
  // the land surface dips below sea level (island shores and the bays between islands)
  // and the hills paint over it everywhere else. One pass, no separate water quad.
  if (wp.y < 0.0) {
    float depth = -wp.y;
    vec3 w = mix(mix(foam, water, 0.22), water * 0.82, smoothstep(0.0, 44.0, depth));

    // Rolling ripple bands. Rows further down travel slower and sit further apart, which
    // is what sells a flat plane of water seen at a shallow angle.
    float rowPhase = depth * 0.30;
    float speed = 1.5 / (1.0 + depth * 0.07);
    float wv = sin(wp.x * 0.075 - uTime * speed + rowPhase)
             + 0.6 * sin(wp.x * 0.028 + uTime * speed * 0.7 - rowPhase * 0.6);
    float band = smoothstep(0.55, 1.35, wv) * exp(-depth * 0.055);
    w = mix(w, foam, band * 0.55);

    // horizontal ripple lines
    float lines = smoothstep(0.82, 1.0, sin(depth * 1.15 + sin(wp.x * 0.05 + uTime) * 0.9));
    w = mix(w, foam, lines * exp(-depth * 0.05) * 0.24);

    // sun glint column, aligned with the sun's screen position
    float glint = exp(-pow((wp.x - (uCam.x + uView.x * 0.275)) / (uView.x * 0.16), 2.0));
    w = mix(w, foam, glint * band * 0.45 * (1.0 - uDark));

    // bright shoreline lip right at the waterline
    float lip = 1.0 - smoothstep(0.0, 2.6, depth);
    w = mix(w, foam, lip * 0.92);
    w += foam * (1.0 - smoothstep(2.6, 9.0, depth)) * 0.06;

    col = w;
  }

  // ---------------- the night that is chasing you ----------------
  float nf = 1.0 - smoothstep(uNightX, uNightX + 520.0, wp.x);
  vec3 nightCol = vec3(0.030, 0.038, 0.115);
  col = mix(col, mix(col * 0.16, nightCol, 0.62), nf * 0.93);
  // faint aurora-ish edge on the wall of night
  float edge = exp(-pow(abs(wp.x - uNightX) / 90.0, 2.0));
  col += vec3(0.16, 0.10, 0.32) * edge * 0.55;

  // ---------------- grade ----------------
  col *= mix(1.0, 0.72, uDark);
  col = mix(col, col * vec3(1.06, 1.02, 0.92) + vec3(0.05, 0.035, 0.0), uFever * 0.35);

  // vignette
  vec2 q = vUv - 0.5;
  col *= 1.0 - dot(q, q) * 0.42;

  gl_FragColor = vec4(col, 1.0);
}
`;

export class Sky {
  constructor() {
    this.uniforms = {
      uCam: { value: new THREE.Vector2() },
      uView: { value: new THREE.Vector2(800, 450) },
      uTime: { value: 0 },
      uDark: { value: 0 },
      uNightX: { value: -5000 },
      uFever: { value: 0 },
      uBlendX: { value: 1e9 },
      uBlendW: { value: 120 },
      uSkyTopA: { value: new THREE.Color() }, uSkyTopB: { value: new THREE.Color() },
      uSkyBotA: { value: new THREE.Color() }, uSkyBotB: { value: new THREE.Color() },
      uHillDarkA: { value: new THREE.Color() }, uHillDarkB: { value: new THREE.Color() },
      uHillLightA: { value: new THREE.Color() }, uHillLightB: { value: new THREE.Color() },
      uRimA: { value: new THREE.Color() }, uRimB: { value: new THREE.Color() },
      uWaterA: { value: new THREE.Color() }, uWaterB: { value: new THREE.Color() },
      uFoamA: { value: new THREE.Color() }, uFoamB: { value: new THREE.Color() },
      uSunA: { value: new THREE.Color() }, uSunB: { value: new THREE.Color() },
      uCloudA: { value: new THREE.Color() }, uCloudB: { value: new THREE.Color() },
    };

    const geo = new THREE.PlaneGeometry(1, 1);
    const mat = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: VERT,
      fragmentShader: FRAG,
      depthTest: false,
      depthWrite: false,
    });
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 0;
  }
}
