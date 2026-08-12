// Every pixel of art in this game is generated here at boot: strata palettes,
// tile speckle, the pod sprite sheet, and the trader building.

import { TILE } from "./config.js";
import { mulberry32 } from "./rng.js";

function mk(w, h) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}
export const makeCanvas = mk;

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function rgb(c) { return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`; }
export function mixColor(a, b, t) {
  return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];
}

// --- strata -----------------------------------------------------------------
// Depth (ft) -> soil / rock colour. Reads brown topsoil, grey stone, red-hot
// deep crust, then near-black basalt at the bottom.
// The sources do not document soil colour by depth, so these bands are a
// design choice: rusty Martian topsoil, a pale clay layer, cool grey stone,
// then hot red crust as you approach the core.
export const STRATA = [
  { d: 0,    soil: [172, 112, 62],  rock: [146, 138, 128] },
  { d: 400,  soil: [160, 102, 54],  rock: [140, 132, 120] },
  { d: 1100, soil: [180, 136, 82],  rock: [152, 142, 126] },
  { d: 1800, soil: [146, 114, 86],  rock: [132, 128, 124] },
  { d: 2600, soil: [150, 128, 104], rock: [146, 144, 146] },
  { d: 3400, soil: [116, 114, 126], rock: [124, 126, 140] },
  { d: 4200, soil: [140, 104, 92],  rock: [136, 114, 110] },
  { d: 5000, soil: [152, 92, 68],   rock: [158, 98, 76] },
  { d: 5800, soil: [162, 78, 52],   rock: [170, 86, 58] },
  { d: 6600, soil: [142, 60, 44],   rock: [152, 68, 48] },
  { d: 7300, soil: [112, 44, 38],   rock: [124, 52, 44] },
  { d: 8000, soil: [90, 34, 32],    rock: [100, 40, 36] },
];

export function strataColors(depthFt) {
  let i = 0;
  while (i < STRATA.length - 2 && depthFt > STRATA[i + 1].d) i++;
  const a = STRATA[i], b = STRATA[i + 1];
  const t = clamp((depthFt - a.d) / (b.d - a.d), 0, 1);
  return { soil: mixColor(a.soil, b.soil, t), rock: mixColor(a.rock, b.rock, t) };
}

// --- pod sprite -------------------------------------------------------------
// Drawn at 4x then sampled down by the renderer, so the bevels stay readable.
const PS = 4;

export function makePodSprite(w, h) {
  const cv = mk(w * PS, h * PS);
  const g = cv.getContext("2d");
  g.save();
  g.scale(PS, PS);

  const bodyW = w - 2, bodyH = h - 9;
  const bx = 1, by = 1;

  // drill mount / auger
  g.fillStyle = "#4a4f57";
  g.fillRect(w / 2 - 4, by + bodyH - 2, 8, 4);

  // hull
  const grad = g.createLinearGradient(bx, by, bx + bodyW, by + bodyH);
  grad.addColorStop(0, "#ffd451");
  grad.addColorStop(0.42, "#e8a91c");
  grad.addColorStop(0.75, "#b47b10");
  grad.addColorStop(1, "#7d550b");
  g.fillStyle = grad;
  roundRect(g, bx, by, bodyW, bodyH, 5);
  g.fill();

  // top highlight
  g.fillStyle = "rgba(255,255,255,0.32)";
  roundRect(g, bx + 2, by + 1.5, bodyW - 4, 3, 1.5);
  g.fill();

  // hull outline
  g.strokeStyle = "#3a2a06";
  g.lineWidth = 1;
  roundRect(g, bx + 0.5, by + 0.5, bodyW - 1, bodyH - 1, 5);
  g.stroke();

  // cockpit glass
  const cw = bodyW * 0.52, ch = bodyH * 0.46;
  const cxp = bx + bodyW - cw - 2, cyp = by + 3;
  const gg = g.createLinearGradient(cxp, cyp, cxp + cw, cyp + ch);
  gg.addColorStop(0, "#bff4ff");
  gg.addColorStop(0.5, "#4ea8c8");
  gg.addColorStop(1, "#123a4d");
  g.fillStyle = gg;
  roundRect(g, cxp, cyp, cw, ch, 3);
  g.fill();
  g.strokeStyle = "#20242c";
  g.lineWidth = 1;
  roundRect(g, cxp + 0.5, cyp + 0.5, cw - 1, ch - 1, 3);
  g.stroke();
  g.fillStyle = "rgba(255,255,255,0.55)";
  g.fillRect(cxp + 1.5, cyp + 1.5, cw * 0.34, 1.5);

  // side thruster pods
  g.fillStyle = "#6b7078";
  g.fillRect(bx - 0.5, by + bodyH * 0.45, 3, bodyH * 0.4);
  g.fillStyle = "#3f444b";
  g.fillRect(bx - 0.5, by + bodyH * 0.45 + bodyH * 0.4 - 1.5, 3, 1.5);

  // warning stripe
  g.fillStyle = "#20242c";
  g.fillRect(bx + 2, by + bodyH * 0.62, bodyW * 0.4, 2);
  g.fillStyle = "#ffe07a";
  for (let i = 0; i < 5; i++) g.fillRect(bx + 2.5 + i * 1.6, by + bodyH * 0.62 + 0.4, 0.8, 1.2);

  g.restore();
  return cv;
}

/** The spinning auger under the pod, as `frames` rotational phases. */
export function makeDrillFrames(w, h, frames = 4) {
  const out = [];
  for (let f = 0; f < frames; f++) {
    const cv = mk(w * PS, h * PS);
    const g = cv.getContext("2d");
    g.save();
    g.scale(PS, PS);
    // cone
    const grad = g.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#d8dde6");
    grad.addColorStop(0.5, "#8b929c");
    grad.addColorStop(1, "#4c525b");
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(1, 0);
    g.lineTo(w - 1, 0);
    g.lineTo(w / 2, h);
    g.closePath();
    g.fill();
    // helical flutes, phase-shifted per frame
    g.strokeStyle = "rgba(30,34,40,0.85)";
    g.lineWidth = 0.9;
    const phase = (f / frames) * (h / 2.2);
    for (let y = -h; y < h * 2; y += h / 2.2) {
      const yy = y + phase;
      g.beginPath();
      for (let k = 0; k <= 6; k++) {
        const t = k / 6;
        const py = yy + t * (h / 2.6);
        const half = (1 - clamp(py / h, 0, 1)) * (w / 2 - 1) + 0.5;
        const px = w / 2 - half + t * half * 2;
        if (py < 0 || py > h) continue;
        if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
      }
      g.stroke();
    }
    g.strokeStyle = "#20242c";
    g.lineWidth = 0.8;
    g.beginPath();
    g.moveTo(1, 0.4); g.lineTo(w - 1, 0.4);
    g.stroke();
    g.restore();
    out.push(cv);
  }
  return out;
}

export function roundRect(g, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.lineTo(x + w - rr, y);
  g.quadraticCurveTo(x + w, y, x + w, y + rr);
  g.lineTo(x + w, y + h - rr);
  g.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  g.lineTo(x + rr, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - rr);
  g.lineTo(x, y + rr);
  g.quadraticCurveTo(x, y, x + rr, y);
  g.closePath();
}

// --- ore glyphs -------------------------------------------------------------
// One small sprite per mineral, reused wherever an embedded nugget is drawn.
export function makeOreSprite(ore, variant = 0) {
  const s = TILE;
  const cv = mk(s, s);
  const g = cv.getContext("2d");
  const rnd = mulberry32(1000 + variant * 977 + ore.value);

  const crystals = 3 + Math.floor(rnd() * 2);
  for (let i = 0; i < crystals; i++) {
    const a = (i / crystals) * Math.PI * 2 + rnd() * 0.8;
    const dist = s * (0.10 + rnd() * 0.14);
    const cx = s / 2 + Math.cos(a) * dist;
    const cy = s / 2 + Math.sin(a) * dist;
    const rad = s * (0.10 + rnd() * 0.07);
    const facets = 5 + Math.floor(rnd() * 2);
    const rot = rnd() * Math.PI;

    // faceted body
    g.beginPath();
    for (let k = 0; k < facets; k++) {
      const fa = rot + (k / facets) * Math.PI * 2;
      const fr = rad * (0.72 + ((k * 37) % 7) / 18);
      const fx = cx + Math.cos(fa) * fr;
      const fy = cy + Math.sin(fa) * fr;
      if (k === 0) g.moveTo(fx, fy); else g.lineTo(fx, fy);
    }
    g.closePath();
    const gr = g.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
    gr.addColorStop(0, ore.glint);
    gr.addColorStop(0.45, ore.color);
    gr.addColorStop(1, "rgba(0,0,0,0.7)");
    g.fillStyle = gr;
    g.fill();
    g.strokeStyle = "rgba(0,0,0,0.5)";
    g.lineWidth = 1;
    g.stroke();

    // top facet highlight
    g.beginPath();
    g.moveTo(cx, cy - rad * 0.85);
    g.lineTo(cx + rad * 0.5, cy - rad * 0.1);
    g.lineTo(cx - rad * 0.35, cy - rad * 0.15);
    g.closePath();
    g.fillStyle = "rgba(255,255,255,0.45)";
    g.fill();
  }

  // star sparkle so a vein catches the pod lamp
  g.save();
  g.globalCompositeOperation = "lighter";
  const sx = s / 2 + (rnd() - 0.5) * 8, sy = s / 2 + (rnd() - 0.5) * 8;
  const sg = g.createRadialGradient(sx, sy, 0.5, sx, sy, 9);
  sg.addColorStop(0, "rgba(255,255,255,0.95)");
  sg.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = sg;
  g.beginPath(); g.arc(sx, sy, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.fillRect(sx - 0.7, sy - 5, 1.4, 10);
  g.fillRect(sx - 5, sy - 0.7, 10, 1.4);
  g.restore();
  return cv;
}

// --- surface vendor buildings ----------------------------------------------
export function makeVendorSprite(short, name, accent, w, h) {
  const cv = mk(w, h);
  const g = cv.getContext("2d");

  const bw = w * 0.68, bh = h * 0.58;
  const bx = (w - bw) / 2, by = h - bh;
  const wall = g.createLinearGradient(bx, by, bx, by + bh);
  wall.addColorStop(0, "#8d94a1");
  wall.addColorStop(0.45, "#6a707c");
  wall.addColorStop(1, "#3f444d");
  g.fillStyle = wall;
  g.fillRect(bx, by, bw, bh);

  g.strokeStyle = "rgba(18,22,28,0.32)";
  g.lineWidth = 1;
  for (let x = bx + 5; x < bx + bw; x += 8) {
    g.beginPath(); g.moveTo(x, by + 2); g.lineTo(x, by + bh); g.stroke();
  }

  // roof
  g.fillStyle = accent;
  g.beginPath();
  g.moveTo(bx - 10, by);
  g.lineTo(bx + bw / 2, by - h * 0.22);
  g.lineTo(bx + bw + 10, by);
  g.closePath();
  g.fill();
  g.fillStyle = "rgba(255,255,255,0.20)";
  g.beginPath();
  g.moveTo(bx - 10, by);
  g.lineTo(bx + bw / 2, by - h * 0.22);
  g.lineTo(bx + bw / 2, by);
  g.closePath();
  g.fill();

  // antenna mast
  g.strokeStyle = "#20242c";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(bx + bw - 12, by - h * 0.05);
  g.lineTo(bx + bw - 12, by - h * 0.34);
  g.stroke();
  g.fillStyle = accent;
  g.beginPath(); g.arc(bx + bw - 12, by - h * 0.35, 3.5, 0, Math.PI * 2); g.fill();

  // sign board
  g.fillStyle = "#0f1218";
  g.fillRect(bx + 4, by + 7, bw - 8, 17);
  g.strokeStyle = accent;
  g.lineWidth = 1.5;
  g.strokeRect(bx + 4, by + 7, bw - 8, 17);
  g.fillStyle = "#ffd451";
  g.font = "bold 11px 'Lucida Console', monospace";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.fillText(short, bx + bw / 2, by + 16);

  // small print of the full vendor name
  g.fillStyle = "rgba(220,228,240,0.85)";
  g.font = "bold 7px 'Lucida Console', monospace";
  g.fillText(name.length > 26 ? name.slice(0, 26) : name, w / 2, by + 32);

  // door + windows
  g.fillStyle = "#23272f";
  g.fillRect(bx + bw / 2 - 11, by + bh - 26, 22, 26);
  g.fillStyle = "#0d1014";
  g.fillRect(bx + bw / 2 - 8, by + bh - 23, 16, 23);
  g.fillStyle = "#78e0ff";
  g.fillRect(bx + 9, by + 40, 14, 11);
  g.fillRect(bx + bw - 23, by + 40, 14, 11);
  g.fillStyle = "rgba(255,255,255,0.35)";
  g.fillRect(bx + 9, by + 40, 14, 3);
  g.fillRect(bx + bw - 23, by + 40, 14, 3);

  // roadside unit (pump / crate / terminal), tinted by vendor
  g.fillStyle = accent;
  g.fillRect(bx - 26, by + bh - 30, 16, 30);
  g.fillStyle = "#14171e";
  g.fillRect(bx - 24, by + bh - 27, 12, 8);
  g.fillStyle = "#6fe08a";
  g.fillRect(bx - 23, by + bh - 26, 10, 6);
  return cv;
}

// --- buried artifacts -------------------------------------------------------
export function makeArtSprite(kind) {
  const s = TILE;
  const cv = mk(s, s);
  const g = cv.getContext("2d");
  g.lineWidth = 2;

  if (kind === "bones") {
    g.strokeStyle = "#e8e2cf";
    g.fillStyle = "#e8e2cf";
    for (let i = 0; i < 2; i++) {
      const y = s * (0.36 + i * 0.26);
      g.beginPath(); g.moveTo(s * 0.22, y); g.lineTo(s * 0.78, y - 4); g.stroke();
      g.beginPath(); g.arc(s * 0.2, y, 3.4, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(s * 0.8, y - 4, 3.4, 0, Math.PI * 2); g.fill();
    }
  } else if (kind === "chest") {
    g.fillStyle = "#7a4c1e";
    g.fillRect(s * 0.2, s * 0.42, s * 0.6, s * 0.32);
    g.fillStyle = "#a4682a";
    g.fillRect(s * 0.2, s * 0.42, s * 0.6, s * 0.1);
    g.fillStyle = "#ffd451";
    g.fillRect(s * 0.45, s * 0.5, s * 0.1, s * 0.12);
    g.strokeStyle = "#3a2410";
    g.strokeRect(s * 0.2, s * 0.42, s * 0.6, s * 0.32);
    g.fillStyle = "rgba(255,220,120,0.8)";
    g.fillRect(s * 0.24, s * 0.36, s * 0.52, 4);
  } else if (kind === "skull") {
    g.fillStyle = "#d8e6d0";
    g.beginPath(); g.ellipse(s / 2, s * 0.46, s * 0.2, s * 0.22, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1d241f";
    g.beginPath(); g.ellipse(s * 0.43, s * 0.44, 3.6, 5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(s * 0.57, s * 0.44, 3.6, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillRect(s * 0.46, s * 0.56, s * 0.08, 5);
    g.fillStyle = "#d8e6d0";
    g.fillRect(s * 0.42, s * 0.66, s * 0.16, 5);
  } else if (kind === "relic") {
    const grd = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s * 0.4);
    grd.addColorStop(0, "#fff6d0");
    grd.addColorStop(0.5, "#ffcf4a");
    grd.addColorStop(1, "rgba(180,120,20,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, s, s);
    g.strokeStyle = "#fff0b0";
    g.beginPath(); g.moveTo(s / 2, s * 0.24); g.lineTo(s / 2, s * 0.76); g.stroke();
    g.beginPath(); g.moveTo(s * 0.3, s * 0.42); g.lineTo(s * 0.7, s * 0.42); g.stroke();
  } else { // blueprint
    g.fillStyle = "#1b3a6b";
    g.fillRect(s * 0.16, s * 0.28, s * 0.68, s * 0.44);
    g.strokeStyle = "#9fd0ff";
    g.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.moveTo(s * 0.16, s * 0.28 + (s * 0.44 * i) / 4);
      g.lineTo(s * 0.84, s * 0.28 + (s * 0.44 * i) / 4);
      g.stroke();
    }
    g.strokeStyle = "#e8f4ff";
    g.lineWidth = 1.6;
    g.strokeRect(s * 0.28, s * 0.38, s * 0.24, s * 0.2);
    g.beginPath(); g.arc(s * 0.66, s * 0.55, 5, 0, Math.PI * 2); g.stroke();
  }

  // faint sparkle so an embedded find catches the pod lamp
  g.fillStyle = "rgba(255,255,255,0.85)";
  g.fillRect(s * 0.5 - 1, s * 0.18, 2, 5);
  g.fillRect(s * 0.5 - 3, s * 0.20, 6, 2);
  return cv;
}
