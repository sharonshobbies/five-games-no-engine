// Every pixel of art in this game is drawn here, at runtime, with 2D canvas.
// No image files, no fonts beyond the browser's own.

import * as THREE from '../vendor/three.module.min.js';

function canvasTexture(c, { repeat = false } = {}) {
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  if (repeat) {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
  }
  t.needsUpdate = true;
  return t;
}

/**
 * Soft radial falloff used for every additive glow in the game (food halos,
 * body bloom, boost flare). Alpha^2-ish falloff reads as light, not as fog.
 */
export function makeGlowTexture(size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const img = g.createImageData(size, size);
  const half = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (x + 0.5 - half) / half;
      const dy = (y + 0.5 - half) / half;
      const r = Math.sqrt(dx * dx + dy * dy);
      // Bright compact core plus a long faint skirt.
      let a = 0;
      if (r < 1) {
        const core = Math.pow(Math.max(0, 1 - r / 0.34), 2.0);
        const skirt = Math.pow(Math.max(0, 1 - r), 1.9);
        a = Math.min(1, core * 0.80 + skirt * 0.62);
      }
      const i = (y * size + x) * 4;
      img.data[i] = 255;
      img.data[i + 1] = 255;
      img.data[i + 2] = 255;
      img.data[i + 3] = (a * 255) | 0;
    }
  }
  g.putImageData(img, 0, 0);
  return canvasTexture(c);
}

/** Circular eye sprite: white disc with a soft rim. */
export function makeEyeTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.clearRect(0, 0, size, size);
  const h = size / 2;
  g.beginPath();
  g.arc(h, h, h * 0.92, 0, Math.PI * 2);
  g.fillStyle = '#ffffff';
  g.fill();
  g.lineWidth = size * 0.06;
  g.strokeStyle = 'rgba(20,22,40,0.55)';
  g.stroke();
  return canvasTexture(c);
}

/** Dark pupil disc. */
export function makePupilTexture(size = 64) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const h = size / 2;
  g.beginPath();
  g.arc(h, h, h * 0.9, 0, Math.PI * 2);
  g.fillStyle = '#141428';
  g.fill();
  // A tiny specular highlight sells the wet-eye look.
  g.beginPath();
  g.arc(h * 0.72, h * 0.68, h * 0.24, 0, Math.PI * 2);
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.fill();
  return canvasTexture(c);
}

/**
 * A little skin preview swatch for the title screen, drawn as an S-curve of
 * banded circles so it reads as a snake rather than a colour chip.
 */
export function drawSkinSwatch(canvas, skin) {
  const w = canvas.width;
  const h = canvas.height;
  const g = canvas.getContext('2d');
  g.clearRect(0, 0, w, h);
  const n = 26;
  const r = h * 0.30;
  for (let i = n - 1; i >= 0; i--) {
    const t = i / (n - 1);
    const x = 5 + r + t * (w - 2 * r - 10);
    const y = h / 2 + Math.sin(t * Math.PI * 1.9) * (h * 0.24);
    const col = skin.bands[Math.floor(i / 3) % skin.bands.length];
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fillStyle = col;
    g.shadowColor = col;
    g.shadowBlur = 8;
    g.fill();
  }
  g.shadowBlur = 0;
  // eyes on the leading circle
  const t = (n - 1) / (n - 1);
  const hx = 5 + r + t * (w - 2 * r - 10);
  const hy = h / 2 + Math.sin(t * Math.PI * 1.9) * (h * 0.24);
  for (const s of [-1, 1]) {
    g.beginPath();
    g.arc(hx + r * 0.35, hy + s * r * 0.5, r * 0.32, 0, Math.PI * 2);
    g.fillStyle = '#fff';
    g.fill();
    g.beginPath();
    g.arc(hx + r * 0.5, hy + s * r * 0.5, r * 0.16, 0, Math.PI * 2);
    g.fillStyle = '#141428';
    g.fill();
  }
}
