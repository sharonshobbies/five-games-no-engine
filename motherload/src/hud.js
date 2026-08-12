// In-game HUD, transmission popups, title / death / victory screens.

import { VIEW_W, VIEW_H, ALTIMETER_FAIL_FT, MAX_DIG_DEPTH_FT } from "./config.js";
import { COL, bevelPanel, inset, meter, shadowText, button, money, pointsText, font, crtOverlay } from "./ui.js";
import { SELLABLE, sellValue } from "./ore.js";
import { tierName } from "./upgrades.js";
import { roundRect } from "./textures.js";

const HUD_H = 74;

export function drawHUD(g, game) {
  const p = game.pod;

  bevelPanel(g, 6, 6, VIEW_W - 12, HUD_H, 7);

  // --- gauges --------------------------------------------------------------
  const bw = 200, bh = 17;
  meter(g, 18, 16, bw, bh, p.fuel / p.maxFuel(),
    p.fuel / p.maxFuel() < 0.25 ? COL.red : COL.amber, "FUEL",
    `${p.fuel.toFixed(1)} / ${p.maxFuel()} L`);
  meter(g, 18, 38, bw, bh, p.hull / p.maxHull(),
    p.hull / p.maxHull() < 0.3 ? COL.red : COL.green, "HULL",
    `${Math.max(0, Math.ceil(p.hull))} / ${p.maxHull()}`);

  const used = p.cargoUsed(), cap = p.maxCargo();
  meter(g, 232, 16, bw, bh, cap > 9000 ? 0.08 : used / cap, COL.cyan, "CARGO",
    cap > 9000 ? `${used} / ∞` : `${used} / ${cap}`);

  // cash + score
  shadowText(g, money(p.cash), 232, 52, 15, COL.gold);
  shadowText(g, `SCORE ${pointsText(p.score)}`, 232 + bw, 52, 10, COL.dim, "right");

  // --- altimeter -----------------------------------------------------------
  const depth = p.depthFt();
  inset(g, 458, 14, 168, 46, 5);
  let readout;
  let readColor = COL.green;
  if (depth < -20) {
    readout = `+${Math.round(-depth).toLocaleString("en-US")} ft`;
    readColor = COL.cyan;
  } else if (depth > ALTIMETER_FAIL_FT) {
    // The altimeter is jammed past this depth: flashing garbage digits.
    let s = "";
    for (let i = 0; i < 5; i++) s += Math.floor(Math.random() * 10);
    readout = `?${s} ft`;
    readColor = game.blink > 0.5 ? COL.red : "#7a1c14";
  } else {
    readout = `-${Math.round(Math.max(0, depth)).toLocaleString("en-US")} ft`;
  }
  if (p.inLair) { readout = "-66,666 ft"; readColor = COL.red; }
  shadowText(g, "ALTIMETER", 542, 28, 9, COL.dim, "center");
  g.save();
  g.font = font(20);
  g.textAlign = "center";
  g.fillStyle = readColor;
  g.shadowColor = readColor;
  g.shadowBlur = 12;
  g.fillText(readout, 542, 52);
  g.restore();

  // depth progress rail
  const railX = 636, railY = 16, railW = 10, railH = 44;
  inset(g, railX, railY, railW, railH, 3);
  const frac = Math.max(0, Math.min(1, depth / MAX_DIG_DEPTH_FT));
  g.fillStyle = COL.amber;
  g.fillRect(railX + 3, railY + 2 + (railH - 4) * frac - 1, railW - 6, 3);

  // --- item slots ----------------------------------------------------------
  const slots = [
    ["X", "dynamite", p.items.dynamite],
    ["C", "plastic", p.items.plastic],
    ["Q", "telepo.", p.items.teleporter],
    ["M", "transm.", p.items.transmitter],
    ["F", "fuel", p.items.reserve],
    ["R", "nanobots", p.items.nanobots],
  ];
  let sx = 660;
  for (const [key, name, count] of slots) {
    const on = count > 0 || (name === "telepo." && p.blueprints.hyperdrive);
    inset(g, sx, 16, 46, 44, 4);
    shadowText(g, key, sx + 23, 30, 12, on ? COL.gold : "#4a4f5c", "center");
    shadowText(g, name, sx + 23, 41, 8, on ? COL.dim : "#3d424e", "center");
    const label = (name === "telepo." && p.blueprints.hyperdrive) ? "∞" : String(count);
    shadowText(g, label, sx + 23, 54, 11, on ? COL.text : "#3d424e", "center");
    sx += 49;
  }

  // --- cargo manifest ------------------------------------------------------
  const entries = Object.entries(p.cargo).filter(([, n]) => n > 0);
  if (entries.length) {
    const rows = entries.length;
    const h = 22 + rows * 15;
    bevelPanel(g, 6, VIEW_H - h - 6, 210, h, 6);
    shadowText(g, "CARGO HOLD", 16, VIEW_H - h + 8, 10, COL.dim);
    let y = VIEW_H - h + 24;
    for (const [id, n] of entries) {
      const e = SELLABLE[id];
      g.fillStyle = e.color || "#c9a44a";
      g.fillRect(16, y - 8, 8, 8);
      shadowText(g, `${e.name}`, 30, y, 11, COL.text);
      shadowText(g, `x${n}`, 150, y, 11, COL.dim, "right");
      shadowText(g, money(sellValue(e) * n), 204, y, 10, COL.gold, "right");
      y += 15;
    }
  }

  // --- drill / warning strip ----------------------------------------------
  if (game.warning && game.warningTimer > 0) {
    const a = Math.min(1, game.warningTimer);
    g.save();
    g.globalAlpha = a;
    const w = 420, x = (VIEW_W - w) / 2;
    bevelPanel(g, x, HUD_H + 14, w, 34, 5, "#3a1a16");
    shadowText(g, game.warning, VIEW_W / 2, HUD_H + 36, 13, COL.red, "center");
    g.restore();
  }

  // --- vendor prompt -------------------------------------------------------
  if (game.nearVendor && !game.story.busy) {
    const w = 380, x = (VIEW_W - w) / 2, y = VIEW_H - 62;
    bevelPanel(g, x, y, w, 44, 6);
    shadowText(g, game.nearVendor.name, VIEW_W / 2, y + 19, 12, COL.gold, "center");
    shadowText(g, "PRESS  E  TO ENTER", VIEW_W / 2, y + 34, 11, COL.green, "center");
  }

  // cheat acknowledgement
  if (game.cheatTimer > 0) {
    shadowText(g, game.cheatMessage, VIEW_W / 2, HUD_H + 66, 12, COL.gold, "center");
  }
  if (game.cheated) shadowText(g, "CHEATER", VIEW_W - 26, 74, 9, COL.red, "right");

  // low-fuel klaxon tint
  if (p.fuel / p.maxFuel() < 0.15 && game.blink > 0.5) {
    g.save();
    g.strokeStyle = "rgba(240,60,40,0.55)";
    g.lineWidth = 6;
    g.strokeRect(3, 3, VIEW_W - 6, VIEW_H - 6);
    g.restore();
  }
}

// --- transmission popup ------------------------------------------------------
export function drawTransmission(g, game) {
  const t = game.story.active;
  if (!t) return;
  const h = 152;
  const y = VIEW_H - h - 16;
  // Play continues under a transmission, so this only shades behind the panel
  // instead of dimming the whole screen.
  g.save();
  const grd = g.createLinearGradient(0, y - 90, 0, VIEW_H);
  grd.addColorStop(0, "rgba(0,0,0,0)");
  grd.addColorStop(1, "rgba(0,0,0,0.62)");
  g.fillStyle = grd;
  g.fillRect(0, y - 90, VIEW_W, VIEW_H - y + 90);
  g.restore();

  bevelPanel(g, 40, y, VIEW_W - 80, h, 8);
  // portrait
  inset(g, 56, y + 16, 104, 104, 5);
  drawFace(g, t.face, 56, y + 16, 104, 104, game.time);

  shadowText(g, `INCOMING TRANSMISSION`, 176, y + 28, 9, COL.dim);
  shadowText(g, t.speaker, 176, y + 46, 15, t.face === "natas" || t.face === "devil" ? COL.red : COL.cyan);

  const lines = game.story.visibleLines();
  let ly = y + 68;
  for (const line of lines) {
    shadowText(g, line, 176, ly, 12, COL.text);
    ly += 17;
  }
  if (game.blink > 0.5) shadowText(g, "▶ SPACE", VIEW_W - 64, y + h - 16, 10, COL.gold, "right");
}

export function drawFace(g, kind, x, y, w, h, time) {
  g.save();
  g.beginPath();
  roundRect(g, x + 2, y + 2, w - 4, h - 4, 4);
  g.clip();
  const cx = x + w / 2, cy = y + h / 2;

  if (kind === "static") {
    for (let i = 0; i < 900; i++) {
      const v = Math.random() * 255;
      g.fillStyle = `rgb(${v},${v},${v})`;
      g.fillRect(x + Math.random() * w, y + Math.random() * h, 3, 2);
    }
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(x, y, w, h);
    g.restore();
    return;
  }

  if (kind === "god") {
    const grd = g.createRadialGradient(cx, cy, 2, cx, cy, w * 0.6);
    grd.addColorStop(0, "#ffffff");
    grd.addColorStop(0.4, "#ffe9a0");
    grd.addColorStop(1, "rgba(120,90,20,0)");
    g.fillStyle = grd;
    g.fillRect(x, y, w, h);
    g.strokeStyle = "rgba(255,255,255,0.7)";
    g.lineWidth = 2;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + time * 0.4;
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
      g.lineTo(cx + Math.cos(a) * 48, cy + Math.sin(a) * 48);
      g.stroke();
    }
    g.restore();
    return;
  }

  if (kind === "dog") {
    g.fillStyle = "#2a2f3a"; g.fillRect(x, y, w, h);
    g.fillStyle = "#b98a52";
    g.beginPath(); g.ellipse(cx, cy + 6, 26, 24, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#8a6238";
    g.beginPath(); g.ellipse(cx - 24, cy - 12, 9, 18, -0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + 24, cy - 12, 9, 18, 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#1a1d24";
    g.beginPath(); g.arc(cx - 9, cy, 3.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + 9, cy, 3.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx, cy + 13, 6, 4, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = "#1a1d24"; g.lineWidth = 2;
    g.beginPath(); g.arc(cx, cy + 16, 8, 0.2, Math.PI - 0.2); g.stroke();
    g.restore();
    return;
  }

  if (kind === "pod") {
    g.fillStyle = "#182028"; g.fillRect(x, y, w, h);
    g.fillStyle = "#2b3a44";
    g.fillRect(x, y + h * 0.62, w, h * 0.38);
    // little pod
    g.fillStyle = "#e8a91c";
    roundRect(g, cx - 22, cy - 14, 44, 30, 6); g.fill();
    g.strokeStyle = "#3a2a06"; g.lineWidth = 2;
    roundRect(g, cx - 22, cy - 14, 44, 30, 6); g.stroke();
    g.fillStyle = "#78e0ff";
    roundRect(g, cx + 0, cy - 9, 17, 13, 3); g.fill();
    g.fillStyle = "#8b929c";
    g.beginPath();
    g.moveTo(cx - 8, cy + 16); g.lineTo(cx + 8, cy + 16); g.lineTo(cx, cy + 28);
    g.closePath(); g.fill();
    g.restore();
    return;
  }

  // natas / devil
  const devil = kind === "devil";
  g.fillStyle = devil ? "#210a0a" : "#1c1f2a";
  g.fillRect(x, y, w, h);
  if (devil) {
    const grd = g.createRadialGradient(cx, cy, 4, cx, cy, w * 0.7);
    grd.addColorStop(0, "rgba(200,40,20,0.55)");
    grd.addColorStop(1, "rgba(60,0,0,0)");
    g.fillStyle = grd; g.fillRect(x, y, w, h);
  }
  // shoulders / suit
  g.fillStyle = devil ? "#3a1010" : "#20242e";
  g.beginPath();
  g.moveTo(cx - 40, y + h);
  g.lineTo(cx - 22, cy + 14);
  g.lineTo(cx + 22, cy + 14);
  g.lineTo(cx + 40, y + h);
  g.closePath(); g.fill();
  if (!devil) {
    g.fillStyle = "#e8e8ee";
    g.beginPath();
    g.moveTo(cx - 8, cy + 14); g.lineTo(cx, cy + 34); g.lineTo(cx + 8, cy + 14);
    g.closePath(); g.fill();
    g.fillStyle = "#a01c1c";
    g.beginPath();
    g.moveTo(cx - 4, cy + 16); g.lineTo(cx, cy + 34); g.lineTo(cx + 4, cy + 16);
    g.closePath(); g.fill();
  }
  // head
  g.fillStyle = devil ? "#7d1f14" : "#c99a72";
  g.beginPath(); g.ellipse(cx, cy - 4, 20, 24, 0, 0, Math.PI * 2); g.fill();
  // top hat (Natas form 1)
  if (!devil) {
    g.fillStyle = "#14171e";
    g.fillRect(cx - 26, cy - 28, 52, 5);
    g.fillRect(cx - 17, cy - 54, 34, 27);
    g.fillStyle = "#8a1c1c";
    g.fillRect(cx - 17, cy - 33, 34, 5);
  } else {
    // horns
    g.fillStyle = "#2b0f0a";
    g.beginPath(); g.moveTo(cx - 18, cy - 20); g.lineTo(cx - 30, cy - 44); g.lineTo(cx - 8, cy - 26); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(cx + 18, cy - 20); g.lineTo(cx + 30, cy - 44); g.lineTo(cx + 8, cy - 26); g.closePath(); g.fill();
  }
  // glowing eyes
  const pulse = 0.6 + 0.4 * Math.sin(time * 5);
  g.save();
  g.globalCompositeOperation = "lighter";
  g.fillStyle = `rgba(255,${devil ? 40 : 60},20,${pulse})`;
  g.beginPath(); g.arc(cx - 8, cy - 6, devil ? 5.5 : 4, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(cx + 8, cy - 6, devil ? 5.5 : 4, 0, Math.PI * 2); g.fill();
  g.restore();
  // mouth
  g.strokeStyle = devil ? "#2b0f0a" : "#7a5236";
  g.lineWidth = 2;
  g.beginPath();
  g.moveTo(cx - 8, cy + 8);
  g.quadraticCurveTo(cx, cy + (devil ? 16 : 4), cx + 8, cy + 8);
  g.stroke();
  g.restore();
}

// --- full-screen states ------------------------------------------------------
export function drawTitle(g, game) {
  const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, "#0a0d16");
  grd.addColorStop(0.55, "#2a1408");
  grd.addColorStop(1, "#61240c");
  g.fillStyle = grd;
  g.fillRect(0, 0, VIEW_W, VIEW_H);

  // rocky silhouette
  g.fillStyle = "#160d0a";
  g.beginPath();
  g.moveTo(0, VIEW_H);
  for (let x = 0; x <= VIEW_W; x += 20) {
    g.lineTo(x, VIEW_H - 120 - Math.sin(x * 0.013) * 26 - Math.sin(x * 0.041) * 12);
  }
  g.lineTo(VIEW_W, VIEW_H);
  g.closePath();
  g.fill();

  g.save();
  g.textAlign = "center";
  g.font = font(74);
  g.fillStyle = "#3a1c06";
  g.fillText("MOTHERLOAD", VIEW_W / 2 + 4, 168);
  const tg = g.createLinearGradient(0, 110, 0, 180);
  tg.addColorStop(0, "#ffe98a");
  tg.addColorStop(0.5, "#ffc21c");
  tg.addColorStop(1, "#b3660a");
  g.fillStyle = tg;
  g.fillText("MOTHERLOAD", VIEW_W / 2, 164);
  g.lineWidth = 2;
  g.strokeStyle = "rgba(0,0,0,0.6)";
  g.strokeText("MOTHERLOAD", VIEW_W / 2, 164);
  g.restore();

  shadowText(g, "DIG. SELL. UPGRADE. DIG DEEPER.", VIEW_W / 2, 198, 14, COL.amber, "center");

  // A pod sinking a shaft, drawn beside the menu.
  g.save();
  const px = 168, py = 300;
  g.fillStyle = "#20140c";
  g.fillRect(px - 26, py - 40, 52, 250);
  for (let i = 0; i < 5; i++) {
    g.fillStyle = "rgba(255,255,255,0.05)";
    g.fillRect(px - 26, py - 40 + i * 50, 52, 3);
  }
  const bob = Math.sin(game.time * 2) * 4;
  g.translate(px, py + bob);
  g.fillStyle = "#8b929c";
  g.beginPath(); g.moveTo(-9, 20); g.lineTo(9, 20); g.lineTo(0, 38); g.closePath(); g.fill();
  const pg = g.createLinearGradient(-20, -20, 20, 20);
  pg.addColorStop(0, "#ffd451");
  pg.addColorStop(1, "#8b5c08");
  g.fillStyle = pg;
  roundRect(g, -20, -20, 40, 40, 7); g.fill();
  g.strokeStyle = "#3a2a06"; g.lineWidth = 2;
  roundRect(g, -20, -20, 40, 40, 7); g.stroke();
  g.fillStyle = "#78e0ff";
  roundRect(g, 0, -14, 16, 13, 3); g.fill();
  g.globalCompositeOperation = "lighter";
  const lg2 = g.createRadialGradient(0, 24, 2, 0, 24, 70);
  lg2.addColorStop(0, "rgba(255,214,150,0.55)");
  lg2.addColorStop(1, "rgba(255,160,60,0)");
  g.fillStyle = lg2;
  g.beginPath(); g.arc(0, 24, 70, 0, Math.PI * 2); g.fill();
  g.restore();

  shadowText(g, "MR. NATAS IS HIRING.", 168, 232, 11, COL.red, "center");

  // The two modes the original names -- Adventure and Challenge -- plus Options.
  // The primary pair stays where a first click lands; the secondary pair sits
  // under them.
  const bx = 380;
  game.titleButtons = {
    play: button(g, bx, 250, 260, 46, game.hasSave ? "CONTINUE" : "ADVENTURE",
      { hover: game.hoverKey === "play", size: 15 }),
    fresh: button(g, bx, 306, 260, 40, "NEW GAME", { hover: game.hoverKey === "fresh", size: 12 }),
    challenge: button(g, bx, 356, 126, 32, "CHALLENGES",
      { hover: game.hoverKey === "challenge", size: 11, accent: COL.cyan }),
    options: button(g, bx + 134, 356, 126, 32, "OPTIONS",
      { hover: game.hoverKey === "options", size: 11, accent: COL.cyan }),
  };
  const prog = game.challengeProgress;
  if (prog) {
    shadowText(g, prog.multidrill ? "MULTI-DRILL EARNED" : `CHALLENGES  ${prog.cleared.length} / 12`,
      bx + 63, 402, 10, prog.multidrill ? COL.gold : COL.dim, "center");
  }
  if (game.newGamePlus > 0) {
    shadowText(g, `NEW GAME +${game.newGamePlus}`, bx + 197, 402, 10, COL.red, "center");
  }

  bevelPanel(g, VIEW_W / 2 - 250, 414, 500, 128, 7);
  shadowText(g, "CONTROLS", VIEW_W / 2, 436, 12, COL.gold, "center");
  const rows = [
    ["ARROWS / WASD", "thrust up, drill down / left / right"],
    ["X  /  C", "dynamite  /  plastic explosive"],
    ["Q  /  M", "quantum teleporter  /  matter transmitter"],
    ["F  /  R", "reserve fuel  /  hull repair nanobots"],
    ["E  /  I  /  O", "vendor  /  inventory  /  options"],
  ];
  let y = 456;
  for (const [k, v] of rows) {
    shadowText(g, k, VIEW_W / 2 - 232, y, 11, COL.cyan);
    shadowText(g, v, VIEW_W / 2 - 80, y, 11, COL.dim);
    y += 18;
  }
  shadowText(g, "You cannot drill upward. Plan the way out before you dig in.",
    VIEW_W / 2, 568, 11, COL.red, "center");
  if (game.cheatTimer > 0) {
    shadowText(g, game.cheatMessage, VIEW_W / 2, 232, 12, COL.gold, "center");
  } else {
    shadowText(g, "Cheat codes still work. Just type one.", VIEW_W / 2, 232, 10, COL.dim, "center");
  }
  crtOverlay(g, VIEW_W, VIEW_H);
}

export function drawDeath(g, game) {
  g.save();
  g.fillStyle = "rgba(20,0,0,0.78)";
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.restore();
  bevelPanel(g, VIEW_W / 2 - 250, 150, 500, 300, 8, "#2a1414");
  shadowText(g, game.deathTitle || "POD DESTROYED", VIEW_W / 2, 200, 30, COL.red, "center");
  const lines = (game.deathText || "").split("\n");
  let y = 240;
  for (const l of lines) { shadowText(g, l, VIEW_W / 2, y, 12, COL.text, "center"); y += 20; }

  shadowText(g, `Cargo lost: ${money(game.lostValue || 0)}`, VIEW_W / 2, y + 12, 13, COL.gold, "center");
  shadowText(g, `Deepest: ${Math.round(game.pod.stats.deepest).toLocaleString("en-US")} ft`,
    VIEW_W / 2, y + 34, 12, COL.dim, "center");
  shadowText(g, "You resume from your last visit to the surface.",
    VIEW_W / 2, y + 58, 11, COL.dim, "center");

  game.deathButton = button(g, VIEW_W / 2 - 110, 384, 220, 44, "RESTORE SAVE",
    { hover: game.hoverKey === "death", size: 14 });
}

export function drawVictory(g, game) {
  const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, "#5a3c04");
  grd.addColorStop(0.5, "#ffcc33");
  grd.addColorStop(1, "#7a5205");
  g.fillStyle = grd;
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.save();
  g.globalAlpha = 0.25;
  for (let i = 0; i < 60; i++) {
    const x = (i * 137 + Math.sin(game.time + i) * 40) % VIEW_W;
    const y = (i * 91 + game.time * 60) % VIEW_H;
    g.fillStyle = "#fff6c0";
    g.fillRect(x, y, 3, 3);
  }
  g.restore();

  shadowText(g, "THE ESTATE OF MR. NATAS", VIEW_W / 2, 96, 26, "#3a2400", "center");
  bevelPanel(g, VIEW_W / 2 - 260, 124, 520, 330, 8);
  const rows = game.victoryRewards || [];
  let y = 158;
  for (const [name, val] of rows) {
    shadowText(g, name, VIEW_W / 2 - 240, y, 12, COL.text);
    shadowText(g, money(val), VIEW_W / 2 + 240, y, 12, COL.gold, "right");
    y += 22;
  }
  g.strokeStyle = COL.edge;
  g.beginPath(); g.moveTo(VIEW_W / 2 - 240, y); g.lineTo(VIEW_W / 2 + 240, y); g.stroke();
  y += 24;
  shadowText(g, "FINAL SCORE", VIEW_W / 2 - 240, y, 14, COL.gold);
  shadowText(g, pointsText(game.finalScore || 0), VIEW_W / 2 + 240, y, 14, COL.gold, "right");
  game.victoryButton = button(g, VIEW_W / 2 - 110, VIEW_H - 66, 220, 42,
    "NEW GAME +", { hover: game.hoverKey === "victory", size: 13 });
}

export function drawPause(g, game) {
  g.save();
  g.fillStyle = "rgba(0,0,0,0.7)";
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.restore();
  bevelPanel(g, VIEW_W / 2 - 200, 190, 400, 268, 8);
  shadowText(g, "PAUSED", VIEW_W / 2, 236, 28, COL.gold, "center");
  const p = game.pod;
  const rows = [
    ["Deepest", `${Math.round(p.stats.deepest).toLocaleString("en-US")} ft`],
    ["Highest", `${Math.round(p.stats.highest).toLocaleString("en-US")} ft`],
    ["Tiles dug", String(p.stats.dug)],
    ["Earned", money(p.stats.earned)],
    ["Pods lost", String(p.stats.deaths)],
    ["Drill", tierName("drill", p.tiers.drill)],
  ];
  let y = 272;
  for (const [k, v] of rows) {
    shadowText(g, k, VIEW_W / 2 - 170, y, 11, COL.dim);
    shadowText(g, v, VIEW_W / 2 + 170, y, 11, COL.text, "right");
    y += 19;
  }
  game.pauseButtons = {
    inventory: button(g, VIEW_W / 2 - 176, 396, 110, 30, "INVENTORY",
      { hover: false, size: 10, accent: COL.cyan }),
    options: button(g, VIEW_W / 2 - 56, 396, 110, 30, "OPTIONS",
      { hover: false, size: 10, accent: COL.cyan }),
    quit: button(g, VIEW_W / 2 + 64, 396, 110, 30, "TITLE",
      { hover: false, size: 10, accent: COL.red }),
  };
  shadowText(g, "ESC to resume   -   I inventory   -   O options",
    VIEW_W / 2, 442, 10, COL.green, "center");
}
