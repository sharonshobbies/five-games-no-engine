// Chunky retro-Flash drawing primitives shared by the HUD and the shop screens.

import { roundRect } from "./textures.js";

export const FONT = "'Lucida Console', 'Consolas', monospace";
export const COL = {
  panel: "#1b1e27",
  panelHi: "#2e333f",
  panelLo: "#0e1016",
  edge: "#565d6e",
  text: "#dfe4ee",
  dim: "#8e96a8",
  gold: "#ffd451",
  green: "#6fe08a",
  red: "#f0533f",
  cyan: "#78e0ff",
  amber: "#ffa726",
};

export function font(size, weight = "bold") { return `${weight} ${size}px ${FONT}`; }

export function bevelPanel(g, x, y, w, h, r = 6, fill = COL.panel) {
  g.save();
  g.fillStyle = "rgba(0,0,0,0.55)";
  roundRect(g, x + 3, y + 4, w, h, r);
  g.fill();
  const grd = g.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, COL.panelHi);
  grd.addColorStop(0.14, fill);
  grd.addColorStop(1, COL.panelLo);
  g.fillStyle = grd;
  roundRect(g, x, y, w, h, r);
  g.fill();
  g.strokeStyle = COL.edge;
  g.lineWidth = 2;
  roundRect(g, x + 1, y + 1, w - 2, h - 2, r);
  g.stroke();
  g.strokeStyle = "rgba(255,255,255,0.10)";
  g.lineWidth = 1;
  roundRect(g, x + 3, y + 3, w - 6, h - 6, r - 1);
  g.stroke();
  g.restore();
}

export function inset(g, x, y, w, h, r = 4) {
  g.save();
  g.fillStyle = "#080a0e";
  roundRect(g, x, y, w, h, r);
  g.fill();
  g.strokeStyle = "rgba(0,0,0,0.9)";
  g.lineWidth = 2;
  roundRect(g, x, y, w, h, r);
  g.stroke();
  g.restore();
}

export function meter(g, x, y, w, h, frac, color, label, valueText) {
  inset(g, x, y, w, h, 3);
  const f = Math.max(0, Math.min(1, frac));
  if (f > 0) {
    const grd = g.createLinearGradient(x, y, x, y + h);
    grd.addColorStop(0, "rgba(255,255,255,0.5)");
    grd.addColorStop(0.35, color);
    grd.addColorStop(1, "rgba(0,0,0,0.35)");
    g.fillStyle = grd;
    roundRect(g, x + 2, y + 2, Math.max(2, (w - 4) * f), h - 4, 2);
    g.fill();
  }
  // tick marks
  g.save();
  g.strokeStyle = "rgba(0,0,0,0.45)";
  g.lineWidth = 1;
  for (let i = 1; i < 10; i++) {
    const tx = x + 2 + (w - 4) * (i / 10);
    g.beginPath(); g.moveTo(tx, y + 2); g.lineTo(tx, y + h - 2); g.stroke();
  }
  g.restore();
  if (label) {
    g.font = font(10);
    g.textAlign = "left";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(0,0,0,0.7)";
    g.fillText(label, x + 7, y + h / 2 + 1);
    g.fillStyle = COL.text;
    g.fillText(label, x + 6, y + h / 2);
  }
  if (valueText) {
    g.font = font(10);
    g.textAlign = "right";
    g.textBaseline = "middle";
    g.fillStyle = "rgba(0,0,0,0.7)";
    g.fillText(valueText, x + w - 6, y + h / 2 + 1);
    g.fillStyle = COL.text;
    g.fillText(valueText, x + w - 7, y + h / 2);
  }
}

export function shadowText(g, text, x, y, size = 12, color = COL.text, align = "left") {
  g.font = font(size);
  g.textAlign = align;
  g.textBaseline = "alphabetic";
  g.fillStyle = "rgba(0,0,0,0.75)";
  g.fillText(text, x + 1, y + 1);
  g.fillStyle = color;
  g.fillText(text, x, y);
}

/** A clickable plate. Returns its rect so the caller can hit-test it. */
export function button(g, x, y, w, h, label, opts = {}) {
  const { hover = false, disabled = false, accent = COL.gold, size = 12, sub = null } = opts;
  g.save();
  g.fillStyle = "rgba(0,0,0,0.5)";
  roundRect(g, x + 2, y + 3, w, h, 5);
  g.fill();
  const base = disabled ? "#232630" : hover ? "#3b424f" : "#2a2f3b";
  const grd = g.createLinearGradient(x, y, x, y + h);
  grd.addColorStop(0, disabled ? "#2b2f39" : hover ? "#525b6b" : "#3a4150");
  grd.addColorStop(0.5, base);
  grd.addColorStop(1, "#171a22");
  g.fillStyle = grd;
  roundRect(g, x, y, w, h, 5);
  g.fill();
  g.strokeStyle = disabled ? "#3a3f4a" : hover ? accent : COL.edge;
  g.lineWidth = 2;
  roundRect(g, x + 1, y + 1, w - 2, h - 2, 5);
  g.stroke();
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.font = font(size);
  g.fillStyle = "rgba(0,0,0,0.8)";
  g.fillText(label, x + w / 2 + 1, y + h / 2 + (sub ? -5 : 0) + 1);
  g.fillStyle = disabled ? "#6c7280" : COL.text;
  g.fillText(label, x + w / 2, y + h / 2 + (sub ? -5 : 0));
  if (sub) {
    g.font = font(10, "normal");
    g.fillStyle = disabled ? "#5b616e" : accent;
    g.fillText(sub, x + w / 2, y + h / 2 + 9);
  }
  g.restore();
  return { x, y, w, h };
}

export function hit(rect, mx, my) {
  return rect && mx >= rect.x && mx <= rect.x + rect.w && my >= rect.y && my <= rect.y + rect.h;
}

export function money(n) {
  const v = Math.floor(n);
  return "$" + v.toLocaleString("en-US");
}

export function pointsText(n) {
  return Math.floor(n).toLocaleString("en-US");
}

/** Scanline + vignette pass, so menus read like a CRT terminal. */
export function crtOverlay(g, w, h) {
  g.save();
  g.globalAlpha = 0.06;
  g.fillStyle = "#000";
  for (let y = 0; y < h; y += 3) g.fillRect(0, y, w, 1);
  g.restore();
}
