// Shared GLSL. The signature Tiny Wings hill look is, per EDais's reverse-engineering,
// a diagonal stripe pattern displaced by the terrain's own height field — "those
// wonderfully organic curves are just the interference pattern between a diagonal
// stripe and sine functions". Both the foreground hill mesh and the parallax
// background hills run the same routine so they read as one world.

export const NOISE = /* glsl */`
float tw_hash(vec2 p){
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float tw_noise(vec2 p){
  vec2 i = floor(p), f = fract(p);
  f = f*f*(3.0-2.0*f);
  float a = tw_hash(i), b = tw_hash(i+vec2(1.0,0.0));
  float c = tw_hash(i+vec2(0.0,1.0)), d = tw_hash(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
}
float tw_fbm(vec2 p){
  float s = 0.0, a = 0.5;
  for(int i=0;i<4;i++){ s += a*tw_noise(p); p *= 2.03; a *= 0.5; }
  return s;
}
`;

/**
 * twHillShade(worldPos, surfaceY, depth, dark, light, rim, stripeScale, seedOff)
 * -> banded hill colour.
 *
 *  depth   : surfaceY - worldY (0 at the grass line, growing downward)
 *  stripe  : diagonal band coordinate warped by surfaceY, so bands bow with the hills
 */
export const HILL_SHADE = /* glsl */`
vec3 twHillShade(vec2 wp, float surfaceY, float depth, vec3 dark, vec3 light, vec3 rim,
                 float stripeW, float warp, float grain, float contrast)
{
  // primary diagonal stripe, bent by the height field
  float diag = (wp.x * 0.66 + wp.y * 0.75) / stripeW + surfaceY * warp;
  // a second, wider, opposite-leaning family keeps it from reading as wallpaper
  float diag2 = (wp.x * -0.42 + wp.y * 0.91) / (stripeW * 2.35) - surfaceY * warp * 0.55;

  float w1 = fwidth(diag) * 0.85 + 1e-4;
  float b1 = smoothstep(0.5 - w1, 0.5 + w1, abs(fract(diag) - 0.5) * 2.0);
  float w2 = fwidth(diag2) * 0.9 + 1e-4;
  float b2 = smoothstep(0.5 - w2, 0.5 + w2, abs(fract(diag2) - 0.5) * 2.0);

  float band = mix(b1, b1 * 0.62 + b2 * 0.38, 0.55);
  band = mix(0.5, band, contrast);

  vec3 col = mix(dark, light, band);

  // watercolour blotching
  float n = tw_fbm(wp * 0.035 + 17.0);
  col *= 0.94 + 0.12 * n;
  col = mix(col, light, 0.10 * smoothstep(0.35, 0.85, n));

  // lighter toward the grass line, darker in the deep body of the hill
  float toTop = exp(-depth * 0.030);
  col = mix(col, mix(col, light, 0.55), toTop * 0.72);
  col *= 1.0 - smoothstep(20.0, 260.0, depth) * 0.34;

  // crisp bright rim right at the surface
  float rimA = 1.0 - smoothstep(0.0, 2.6, depth);
  col = mix(col, rim, rimA * 0.92);
  float rimGlow = (1.0 - smoothstep(2.6, 11.0, depth)) * (1.0 - rimA);
  col = mix(col, rim, rimGlow * 0.30);

  // paper grain
  col *= 1.0 - grain * (tw_hash(floor(wp * 1.7)) - 0.5) * 0.18;
  return col;
}
`;

/** Analytic silhouette for the parallax background ridges. `wl` is a true wavelength. */
export const BG_HILL = /* glsl */`
float twRidge(float x, float amp, float wl, float ph){
  float k = 6.2831853 / wl;
  return amp * ( 0.62 * sin(x * k + ph)
               + 0.27 * sin(x * k * 2.13 + ph * 2.3)
               + 0.11 * sin(x * k * 4.71 + ph * 4.1) );
}
`;
