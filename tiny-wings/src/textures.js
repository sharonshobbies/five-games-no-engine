// Every pixel of art in this game is generated at runtime on a 2D canvas and uploaded
// as a texture. Nothing is downloaded.

import * as THREE from '../vendor/three.module.min.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

function toTexture(canvas, { flipY = true } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.flipY = flipY;
  t.needsUpdate = true;
  return t;
}

/** Round Tiny-Wings-ish bird: fat teal-blue body, cream belly, orange beak, big eye. */
export function birdTexture(size = 256, { asleep = false } = {}) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const S = size, cx = S * 0.47, cy = S * 0.52, r = S * 0.36;

  g.clearRect(0, 0, S, S);

  // soft contact shadow under the body
  g.save();
  g.globalAlpha = 0.13;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(cx, cy + r * 0.92, r * 0.78, r * 0.18, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // tail feathers (behind the body)
  g.fillStyle = '#1668a8';
  g.beginPath();
  g.moveTo(cx - r * 0.72, cy - r * 0.16);
  g.quadraticCurveTo(cx - r * 1.30, cy - r * 0.30, cx - r * 1.24, cy + r * 0.02);
  g.quadraticCurveTo(cx - r * 1.30, cy + r * 0.34, cx - r * 0.70, cy + r * 0.28);
  g.closePath();
  g.fill();

  // Dark halo behind the body. The bird has to stay legible against a bright green hill
  // AND a deep blue one, so it carries its own separation instead of relying on the
  // island palette.
  const halo = g.createRadialGradient(cx, cy, r * 0.92, cx, cy, r * 1.22);
  halo.addColorStop(0, 'rgba(8,26,48,.42)');
  halo.addColorStop(0.55, 'rgba(8,26,48,.22)');
  halo.addColorStop(1, 'rgba(8,26,48,0)');
  g.fillStyle = halo;
  g.beginPath();
  g.arc(cx, cy, r * 1.22, 0, Math.PI * 2);
  g.fill();

  // body
  const body = g.createRadialGradient(cx - r * 0.26, cy - r * 0.42, r * 0.12, cx + r * 0.05, cy + r * 0.18, r * 1.16);
  body.addColorStop(0.00, '#a8edff');
  body.addColorStop(0.28, '#4ec6f2');
  body.addColorStop(0.66, '#1e8fd0');
  body.addColorStop(1.00, '#125f9c');
  g.fillStyle = body;
  g.beginPath();
  g.ellipse(cx, cy, r * 1.02, r, 0, 0, Math.PI * 2);
  g.fill();

  // Big cream front, covering the lower face and belly — the real bird's most
  // recognisable feature, and the thing that keeps it readable on a blue island.
  g.save();
  g.beginPath();
  g.ellipse(cx, cy, r * 1.02, r, 0, 0, Math.PI * 2);
  g.clip();
  const belly = g.createRadialGradient(cx + r * 0.26, cy + r * 0.26, r * 0.10, cx + r * 0.24, cy + r * 0.30, r * 0.95);
  belly.addColorStop(0, '#fffef8');
  belly.addColorStop(0.60, '#fff6de');
  belly.addColorStop(0.92, '#ffe9bd');
  belly.addColorStop(1, 'rgba(255,232,185,0)');
  g.fillStyle = belly;
  g.beginPath();
  g.ellipse(cx + r * 0.30, cy + r * 0.26, r * 0.72, r * 0.68, -0.16, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // outline last so it sits over the cream too
  g.strokeStyle = 'rgba(9,40,72,.72)';
  g.lineWidth = S * 0.020;
  g.beginPath();
  g.ellipse(cx, cy, r * 1.02, r, 0, 0, Math.PI * 2);
  g.stroke();

  // darker cap over the top of the head
  g.save();
  g.globalAlpha = 0.26;
  g.fillStyle = '#0d4c80';
  g.beginPath();
  g.ellipse(cx + r * 0.02, cy - r * 0.62, r * 0.74, r * 0.32, 0.05, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // three little head feathers
  g.strokeStyle = '#125f9c';
  g.lineWidth = S * 0.022;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const bx = cx + r * (-0.06 + i * 0.13);
    g.beginPath();
    g.moveTo(bx, cy - r * 0.92);
    g.quadraticCurveTo(bx - r * 0.10, cy - r * 1.18, bx + r * 0.14, cy - r * 1.28);
    g.stroke();
  }

  // beak
  g.fillStyle = '#ffa022';
  g.beginPath();
  g.moveTo(cx + r * 0.80, cy - r * 0.20);
  g.quadraticCurveTo(cx + r * 1.42, cy + r * 0.02, cx + r * 0.78, cy + r * 0.22);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(186,86,0,.40)';
  g.lineWidth = S * 0.007;
  g.stroke();
  g.save();
  g.globalAlpha = 0.30;
  g.strokeStyle = '#8a3c00';
  g.lineWidth = S * 0.008;
  g.beginPath();
  g.moveTo(cx + r * 0.80, cy + r * 0.01);
  g.lineTo(cx + r * 1.34, cy + r * 0.02);
  g.stroke();
  g.restore();

  if (asleep) {
    // Closed eye and a contented mouth — the sunset beat the original opens and closes
    // on. Same body, same outline, only the face changes.
    g.strokeStyle = '#15293e';
    g.lineWidth = S * 0.020;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(cx + r * 0.40, cy - r * 0.30, r * 0.26, 0.22 * Math.PI, 0.78 * Math.PI);
    g.stroke();
    g.lineWidth = S * 0.013;
    g.beginPath();
    g.arc(cx + r * 0.58, cy + r * 0.06, r * 0.13, 0.15 * Math.PI, 0.72 * Math.PI);
    g.stroke();
  } else {
    // eye — big and forward, the whole face of the character
    g.fillStyle = '#fffdf6';
    g.beginPath();
    g.ellipse(cx + r * 0.36, cy - r * 0.24, r * 0.31, r * 0.34, 0.06, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = 'rgba(15,70,120,.22)';
    g.lineWidth = S * 0.007;
    g.stroke();
    g.fillStyle = '#15293e';
    g.beginPath();
    g.arc(cx + r * 0.45, cy - r * 0.21, r * 0.165, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.beginPath();
    g.arc(cx + r * 0.39, cy - r * 0.30, r * 0.062, 0, Math.PI * 2);
    g.fill();
  }

  // cheek blush
  g.save();
  g.globalAlpha = 0.26;
  g.fillStyle = '#ff7a8a';
  g.beginPath();
  g.ellipse(cx + r * 0.20, cy + r * 0.14, r * 0.17, r * 0.11, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // rim light along the upper left
  g.save();
  g.globalAlpha = 0.48;
  g.strokeStyle = 'rgba(255,255,255,.7)';
  g.lineWidth = S * 0.015;
  g.beginPath();
  g.ellipse(cx, cy, r * 0.99, r * 0.97, 0, Math.PI * 1.02, Math.PI * 1.72);
  g.stroke();
  g.restore();

  return toTexture(c);
}

/** One small wing, drawn pointing left-ish; rotated in the scene to flap. */
export function wingTexture(size = 128) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const S = size;
  g.clearRect(0, 0, S, S);
  const grad = g.createLinearGradient(S * 0.9, S * 0.2, S * 0.15, S * 0.85);
  grad.addColorStop(0, '#bff0ff');
  grad.addColorStop(0.55, '#5cc6f2');
  grad.addColorStop(1, '#1d78b8');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(S * 0.92, S * 0.42);
  g.quadraticCurveTo(S * 0.35, S * 0.06, S * 0.06, S * 0.44);
  g.quadraticCurveTo(S * 0.34, S * 0.72, S * 0.92, S * 0.60);
  g.closePath();
  g.fill();
  g.strokeStyle = 'rgba(20,70,120,.45)';
  g.lineWidth = S * 0.02;
  g.stroke();
  g.globalAlpha = 0.35;
  g.strokeStyle = '#fff';
  g.lineWidth = S * 0.014;
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    g.moveTo(S * (0.78 - i * 0.16), S * (0.46 + i * 0.02));
    g.quadraticCurveTo(S * (0.5 - i * 0.12), S * (0.30 + i * 0.05), S * (0.22 - i * 0.05), S * (0.44 + i * 0.03));
    g.stroke();
  }
  return toTexture(c);
}

/** Soft radial blob — used for dust puffs, splashes, speed motes. */
export function puffTexture(size = 128) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0.0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.38, 'rgba(255,255,255,.72)');
  grd.addColorStop(0.75, 'rgba(255,255,255,.16)');
  grd.addColorStop(1.0, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return toTexture(c);
}

/** Four-point sparkle star for fever + great-slide flourish. */
export function starTexture(size = 128) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const S = size, h = S / 2;
  const glow = g.createRadialGradient(h, h, 0, h, h, h);
  glow.addColorStop(0, 'rgba(255,255,255,.95)');
  glow.addColorStop(0.25, 'rgba(255,240,180,.55)');
  glow.addColorStop(0.6, 'rgba(255,210,90,.12)');
  glow.addColorStop(1, 'rgba(255,200,60,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);

  g.fillStyle = '#fff';
  const spike = (rot, len, wid) => {
    g.save();
    g.translate(h, h);
    g.rotate(rot);
    g.beginPath();
    g.moveTo(0, -len);
    g.quadraticCurveTo(wid, 0, 0, len);
    g.quadraticCurveTo(-wid, 0, 0, -len);
    g.fill();
    g.restore();
  };
  spike(0, h * 0.92, h * 0.10);
  spike(Math.PI / 2, h * 0.92, h * 0.10);
  spike(Math.PI / 4, h * 0.42, h * 0.055);
  spike(-Math.PI / 4, h * 0.42, h * 0.055);
  return toTexture(c);
}

/** Gold coin with a highlight and a rim. */
export function coinTexture(size = 128) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const S = size, h = S / 2, r = S * 0.40;
  const glow = g.createRadialGradient(h, h, r * 0.6, h, h, h);
  glow.addColorStop(0, 'rgba(255,220,110,.42)');
  glow.addColorStop(1, 'rgba(255,200,80,0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, S, S);

  const grd = g.createRadialGradient(h - r * 0.34, h - r * 0.38, r * 0.1, h, h, r * 1.05);
  grd.addColorStop(0, '#fff6c6');
  grd.addColorStop(0.42, '#ffd54a');
  grd.addColorStop(0.85, '#f0a418');
  grd.addColorStop(1, '#c97b09');
  g.fillStyle = grd;
  g.beginPath(); g.arc(h, h, r, 0, Math.PI * 2); g.fill();

  g.strokeStyle = 'rgba(120,62,0,.55)';
  g.lineWidth = S * 0.030;
  g.beginPath(); g.arc(h, h, r * 0.985, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = 'rgba(255,250,210,.8)';
  g.lineWidth = S * 0.022;
  g.beginPath(); g.arc(h, h, r * 0.74, 0, Math.PI * 2); g.stroke();

  g.fillStyle = 'rgba(255,255,255,.75)';
  g.beginPath();
  g.ellipse(h - r * 0.3, h - r * 0.34, r * 0.20, r * 0.12, -0.7, 0, Math.PI * 2);
  g.fill();
  return toTexture(c);
}

/** Fluffy cloud built from overlapping soft circles. */
export function cloudTexture(size = 512) {
  const c = makeCanvas(size, Math.round(size * 0.6));
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const blobs = [
    [0.28, 0.62, 0.20], [0.44, 0.46, 0.26], [0.62, 0.56, 0.22],
    [0.75, 0.66, 0.15], [0.17, 0.70, 0.13], [0.52, 0.68, 0.22],
  ];
  for (const [bx, by, br] of blobs) {
    const R = br * W;
    const grd = g.createRadialGradient(bx * W, by * H, R * 0.1, bx * W, by * H, R);
    grd.addColorStop(0, 'rgba(255,255,255,1)');
    grd.addColorStop(0.62, 'rgba(255,255,255,.94)');
    grd.addColorStop(0.88, 'rgba(255,255,255,.42)');
    grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd;
    g.beginPath(); g.arc(bx * W, by * H, R, 0, Math.PI * 2); g.fill();
  }
  // slightly denser bottom edge
  g.globalCompositeOperation = 'source-atop';
  const shade = g.createLinearGradient(0, H * 0.45, 0, H);
  shade.addColorStop(0, 'rgba(255,255,255,0)');
  shade.addColorStop(1, 'rgba(196,220,240,.55)');
  g.fillStyle = shade;
  g.fillRect(0, 0, W, H);
  return toTexture(c);
}

/**
 * The nest the trip starts from: a woven bowl of twigs on the first crest, with two
 * speckled eggs still in it.
 */
export function nestTexture(size = 256) {
  const c = makeCanvas(size, Math.round(size * 0.62));
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);

  // shadow the nest sits in
  g.save();
  g.globalAlpha = 0.20;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(W * 0.5, H * 0.90, W * 0.40, H * 0.09, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();

  // the bowl: a filled arc, dark inside
  const bowl = g.createLinearGradient(0, H * 0.34, 0, H);
  bowl.addColorStop(0, '#a9773f');
  bowl.addColorStop(0.55, '#8a5c2c');
  bowl.addColorStop(1, '#5d3c1b');
  g.fillStyle = bowl;
  g.beginPath();
  g.ellipse(W * 0.5, H * 0.56, W * 0.44, H * 0.40, 0, 0, Math.PI);
  g.fill();
  g.fillStyle = '#4a2f14';
  g.beginPath();
  g.ellipse(W * 0.5, H * 0.52, W * 0.36, H * 0.14, 0, 0, Math.PI * 2);
  g.fill();

  // two pale eggs peeking over the rim
  for (const [ex, ey, er] of [[0.42, 0.47, 0.085], [0.58, 0.49, 0.075]]) {
    const eg = g.createRadialGradient(W * (ex - 0.02), H * (ey - 0.06), W * 0.01, W * ex, H * ey, W * er * 1.4);
    eg.addColorStop(0, '#fffdf2');
    eg.addColorStop(1, '#e6d7b4');
    g.fillStyle = eg;
    g.beginPath();
    g.ellipse(W * ex, H * ey, W * er, W * er * 1.22, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = 'rgba(150,110,70,.35)';
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.arc(W * ex + (i - 2) * W * 0.018, H * ey + ((i % 2) - 0.5) * W * 0.05, W * 0.007, 0, Math.PI * 2);
      g.fill();
    }
  }

  // twigs woven across the rim, drawn over the eggs so they sit inside
  g.lineCap = 'round';
  let seed = 7;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  for (let i = 0; i < 34; i++) {
    const a = Math.PI * (0.03 + rnd() * 0.94);
    const rx = W * 0.44 * (0.72 + rnd() * 0.30);
    const ry = H * 0.40 * (0.72 + rnd() * 0.30);
    const x = W * 0.5 + Math.cos(a) * -rx;
    const y = H * 0.56 + Math.sin(a) * ry * 0.55;
    g.strokeStyle = ['#c08b4c', '#96662f', '#71491f'][i % 3];
    g.lineWidth = W * (0.010 + rnd() * 0.012);
    g.beginPath();
    g.moveTo(x - W * 0.09, y - H * 0.02);
    g.quadraticCurveTo(x, y + H * 0.05, x + W * 0.10, y - H * 0.01);
    g.stroke();
  }
  return toTexture(c);
}

/** A little fish, seen side-on, for the ones that jump in the bays. */
export function fishTexture(size = 128) {
  const c = makeCanvas(size, Math.round(size * 0.6));
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  const body = g.createLinearGradient(0, H * 0.2, 0, H * 0.9);
  body.addColorStop(0, '#8fe6ff');
  body.addColorStop(0.5, '#3aa9d8');
  body.addColorStop(1, '#1b6f9e');
  g.fillStyle = body;
  // tail
  g.beginPath();
  g.moveTo(W * 0.16, H * 0.5);
  g.lineTo(W * 0.03, H * 0.22);
  g.lineTo(W * 0.06, H * 0.5);
  g.lineTo(W * 0.03, H * 0.78);
  g.closePath();
  g.fill();
  // body
  g.beginPath();
  g.ellipse(W * 0.52, H * 0.5, W * 0.38, H * 0.27, 0, 0, Math.PI * 2);
  g.fill();
  // dorsal fin
  g.beginPath();
  g.moveTo(W * 0.44, H * 0.26);
  g.quadraticCurveTo(W * 0.52, H * 0.04, W * 0.66, H * 0.24);
  g.closePath();
  g.fill();
  // belly + eye
  g.fillStyle = 'rgba(255,255,255,.55)';
  g.beginPath();
  g.ellipse(W * 0.56, H * 0.63, W * 0.26, H * 0.12, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#10344c';
  g.beginPath();
  g.arc(W * 0.79, H * 0.44, W * 0.035, 0, Math.PI * 2);
  g.fill();
  return toTexture(c);
}

/** Far-off bird: a plain dark double-arc silhouette, for the flocks crossing the sky. */
export function flockBirdTexture(size = 96) {
  const c = makeCanvas(size, Math.round(size * 0.5));
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  g.strokeStyle = 'rgba(28,48,74,.85)';
  g.lineWidth = H * 0.13;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(W * 0.06, H * 0.74);
  g.quadraticCurveTo(W * 0.30, H * 0.18, W * 0.50, H * 0.56);
  g.quadraticCurveTo(W * 0.70, H * 0.18, W * 0.94, H * 0.74);
  g.stroke();
  return toTexture(c);
}

/** A single "z" for the sleep beat. */
export function zzzTexture(size = 128) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  g.font = `800 ${Math.round(size * 0.78)}px "Avenir Next Rounded","Trebuchet MS",system-ui,sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = size * 0.055;
  g.lineJoin = 'round';
  g.strokeStyle = 'rgba(20,40,68,.45)';
  g.strokeText('z', size * 0.5, size * 0.52);
  g.fillStyle = '#fffdf4';
  g.fillText('z', size * 0.5, size * 0.52);
  return toTexture(c);
}

/** Chequered finish banner on a pole, for the race course's far end. */
export function finishBannerTexture(size = 256) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const W = c.width, H = c.height;
  g.clearRect(0, 0, W, H);
  // pole
  g.fillStyle = '#f7f3e6';
  g.fillRect(W * 0.44, H * 0.10, W * 0.055, H * 0.90);
  g.fillStyle = 'rgba(40,60,90,.28)';
  g.fillRect(W * 0.485, H * 0.10, W * 0.016, H * 0.90);
  // chequered flag flying right
  const fx = W * 0.495, fy = H * 0.12, fw = W * 0.46, fh = H * 0.30;
  const cols = 6, rows = 4;
  for (let i = 0; i < cols; i++) {
    for (let j = 0; j < rows; j++) {
      g.fillStyle = (i + j) % 2 ? '#20304a' : '#fffdf4';
      // a light wave so it does not read as a flat sticker
      const wob = Math.sin((i / cols) * Math.PI * 1.6) * fh * 0.10;
      g.fillRect(fx + (i / cols) * fw, fy + wob + (j / rows) * fh, fw / cols + 1, fh / rows + 1);
    }
  }
  return toTexture(c);
}

/**
 * Soft one-sided streak, bright at the right edge and fading to nothing at the left.
 * Stretched along the velocity direction it is the actual directional smear.
 */
export function streakTexture(w = 256, h = 64) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  g.clearRect(0, 0, w, h);
  const grd = g.createLinearGradient(0, 0, w, 0);
  grd.addColorStop(0.00, 'rgba(255,255,255,0)');
  grd.addColorStop(0.45, 'rgba(255,255,255,.20)');
  grd.addColorStop(0.82, 'rgba(255,255,255,.72)');
  grd.addColorStop(1.00, 'rgba(255,255,255,.95)');
  g.fillStyle = grd;
  // a lens shape, so the smear tapers to a point at the trailing end
  g.beginPath();
  g.moveTo(0, h * 0.5);
  g.quadraticCurveTo(w * 0.55, 0, w, h * 0.10);
  g.lineTo(w, h * 0.90);
  g.quadraticCurveTo(w * 0.55, h, 0, h * 0.5);
  g.closePath();
  g.fill();
  return toTexture(c);
}

/** Paper / watercolour grain multiplied over the hills. */
export function grainTexture(size = 256) {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  let seed = 12345;
  const rnd = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let i = 0; i < size * size; i++) {
    const v = 200 + rnd() * 55;
    img.data[i * 4 + 0] = v;
    img.data[i * 4 + 1] = v;
    img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  // soften it so it reads as paper, not TV static
  const c2 = makeCanvas(size, size);
  const g2 = c2.getContext('2d');
  g2.filter = 'blur(1.1px)';
  g2.drawImage(c, 0, 0);
  const t = toTexture(c2);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

/** Draw the title logo straight into the DOM canvas in index.html. */
export function drawLogo(canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.textAlign = 'center';
  g.textBaseline = 'middle';

  const font = (px) => `800 ${px}px "Avenir Next Rounded","SF Pro Rounded",ui-rounded,"Trebuchet MS","Segoe UI",system-ui,sans-serif`;

  const word = (text, px, cy, hueA, hueB) => {
    g.font = font(px);
    const grd = g.createLinearGradient(0, cy - px * 0.6, 0, cy + px * 0.6);
    grd.addColorStop(0, hueA);
    grd.addColorStop(1, hueB);
    // drop shadow plate
    g.save();
    g.globalAlpha = 0.28;
    g.fillStyle = '#0b2340';
    g.fillText(text, W / 2, cy + px * 0.075);
    g.restore();
    g.lineWidth = px * 0.115;
    g.strokeStyle = '#ffffff';
    g.lineJoin = 'round';
    g.strokeText(text, W / 2, cy);
    g.fillStyle = grd;
    g.fillText(text, W / 2, cy);
  };

  word('TINY', 132, H * 0.33, '#ffe98a', '#ff9b21');
  word('WINGS', 150, H * 0.72, '#a9e9ff', '#1e86cf');

  // a couple of sparkles
  g.fillStyle = 'rgba(255,255,255,.9)';
  const star = (x, y, s) => {
    g.save(); g.translate(x, y);
    g.beginPath();
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * s, Math.sin(a) * s);
    }
    g.lineWidth = s * 0.22; g.strokeStyle = 'rgba(255,255,255,.9)'; g.stroke();
    g.restore();
  };
  star(W * 0.115, H * 0.25, 20);
  star(W * 0.90, H * 0.30, 15);
  star(W * 0.86, H * 0.80, 11);
}
