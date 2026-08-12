// Options and Inventory: the two screens the original has that the first pass
// of this build did not.

import { VIEW_W, VIEW_H } from "./config.js";
import { COL, bevelPanel, inset, shadowText, button, hit, money, font, crtOverlay, meter } from "./ui.js";
import { settings, saveSettings, DEFAULTS } from "./settings.js";
import { ITEMS, BLUEPRINTS, tierName, LINES } from "./upgrades.js";
import { SELLABLE, cargoUnits, sellValue, getCycle, valueScale, pointScale } from "./ore.js";

const CONTROLS = [
  ["ARROWS / WASD", "Up thrusts. Down / Left / Right drill."],
  ["X  /  C", "Dynamite / Plastic Explosive"],
  ["Q  /  M", "Quantum Teleporter / Matter Transmitter"],
  ["F  /  R", "Reserve Fuel Tank / Hull Repair Nanobots"],
  ["E", "Enter a surface vendor"],
  ["I", "Inventory"],
  ["O", "Options"],
  ["ESC", "Pause"],
  ["SPACE", "Advance a transmission, confirm a menu"],
];

const SLIDERS = [
  { key: "master", label: "MASTER VOLUME" },
  { key: "music", label: "MUSIC" },
  { key: "sfx", label: "SOUND EFFECTS" },
];

// ---- options ----------------------------------------------------------------
export function drawOptions(g, game) {
  game.optionRects = [];
  const add = (rect, action, arg) => game.optionRects.push({ rect, action, arg });

  g.save();
  g.fillStyle = "rgba(4,6,10,0.90)";
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.restore();

  bevelPanel(g, 24, 20, VIEW_W - 48, VIEW_H - 40, 9);
  shadowText(g, "OPTIONS", 44, 56, 20, COL.gold);
  shadowText(g, settings.muted ? "MUTED" : "AUDIO ON", VIEW_W - 44, 56, 13,
    settings.muted ? COL.red : COL.green, "right");

  // --- audio ---------------------------------------------------------------
  bevelPanel(g, 44, 76, 440, 234, 7);
  shadowText(g, "AUDIO", 62, 100, 12, COL.gold);
  let y = 122;
  for (const s of SLIDERS) {
    const v = settings[s.key];
    shadowText(g, s.label, 62, y + 10, 11, COL.dim);
    shadowText(g, `${Math.round(v * 100)}%`, 462, y + 10, 11, COL.text, "right");
    const track = { x: 62, y: y + 18, w: 400, h: 16 };
    inset(g, track.x, track.y, track.w, track.h, 3);
    const fw = Math.max(2, (track.w - 4) * v);
    const grd = g.createLinearGradient(track.x, track.y, track.x, track.y + track.h);
    grd.addColorStop(0, "rgba(255,255,255,0.45)");
    grd.addColorStop(0.4, s.key === "music" ? COL.cyan : COL.amber);
    grd.addColorStop(1, "rgba(0,0,0,0.35)");
    g.fillStyle = grd;
    g.fillRect(track.x + 2, track.y + 2, fw, track.h - 4);
    // knob
    g.fillStyle = COL.text;
    g.fillRect(track.x + 2 + fw - 3, track.y - 2, 6, track.h + 4);
    g.strokeStyle = "#0b0d12";
    g.lineWidth = 1;
    g.strokeRect(track.x + 2 + fw - 3, track.y - 2, 6, track.h + 4);
    add(track, "slider", s.key);
    y += 54;
  }
  add(button(g, 62, y + 6, 190, 34, settings.muted ? "UNMUTE" : "MUTE ALL", {
    hover: game.hoverKey === "mute", size: 12, accent: settings.muted ? COL.red : COL.green,
  }), "mute");
  add(button(g, 272, y + 6, 190, 34, "RESET DEFAULTS", {
    hover: game.hoverKey === "resetopts", size: 12,
  }), "resetOptions");

  // --- controls ------------------------------------------------------------
  bevelPanel(g, 500, 76, VIEW_W - 544, 400, 7);
  shadowText(g, "CONTROLS", 518, 100, 12, COL.gold);
  let cy = 124;
  for (const [k, v] of CONTROLS) {
    shadowText(g, k, 518, cy, 11, COL.cyan);
    shadowText(g, v, 518, cy + 15, 10, COL.dim);
    cy += 34;
  }
  shadowText(g, "You cannot drill upward.", 518, cy + 6, 11, COL.red);

  // --- cheat entry ---------------------------------------------------------
  bevelPanel(g, 44, 326, 440, 150, 7);
  shadowText(g, "CHEAT CODE", 62, 350, 12, COL.gold);
  inset(g, 62, 360, 400, 34, 4);
  const buf = (game.codeBuffer || "").toUpperCase();
  shadowText(g, buf || "TYPE A CODE", 74, 382, 14, buf ? COL.green : "#4a4f5c");
  shadowText(g, "A code is typed, not pasted. Using one disables saving,", 62, 416, 10, COL.dim);
  shadowText(g, "exactly as the original tagged a cheated score.", 62, 430, 10, COL.dim);
  if (game.cheated) shadowText(g, "SAVING DISABLED - CHEATER", 62, 456, 12, COL.red);
  else shadowText(g, `Codes accepted: ${Object.keys(game.codeTable()).length}`, 62, 456, 10, COL.dim);

  add(button(g, VIEW_W - 190, VIEW_H - 64, 146, 36, "BACK", {
    hover: game.hoverKey === "optback", accent: COL.green, size: 13,
  }), "close");
  if (game.cheatTimer > 0) {
    shadowText(g, game.cheatMessage, 44, VIEW_H - 40, 12, COL.gold);
  }
  crtOverlay(g, VIEW_W, VIEW_H);
}

export function optionsHover(game, mx, my) {
  game.hoverKey = null;
  for (const r of game.optionRects || []) {
    if (!hit(r.rect, mx, my)) continue;
    if (r.action === "mute") game.hoverKey = "mute";
    else if (r.action === "resetOptions") game.hoverKey = "resetopts";
    else if (r.action === "close") game.hoverKey = "optback";
    else if (r.action === "slider") game.hoverKey = "sl" + r.arg;
    return;
  }
}

/** Returns true if the click was consumed. */
export function optionsClick(game, mx, my, dragging = false) {
  for (const r of game.optionRects || []) {
    if (!hit(r.rect, mx, my)) continue;
    if (r.action === "slider") {
      const v = Math.max(0, Math.min(1, (mx - r.rect.x - 2) / (r.rect.w - 4)));
      settings[r.arg] = Math.round(v * 100) / 100;
      if (settings.muted && v > 0) settings.muted = false;
      game.audio.applySettings();
      saveSettings();
      game.sliderDrag = r.arg;
      return true;
    }
    if (dragging) return true;
    if (r.action === "mute") {
      settings.muted = !settings.muted;
      game.audio.applySettings();
      saveSettings();
      if (!settings.muted) game.audio.blip(700, 0.06);
      return true;
    }
    if (r.action === "resetOptions") {
      Object.assign(settings, DEFAULTS);
      game.audio.applySettings();
      saveSettings();
      game.audio.buy();
      return true;
    }
    if (r.action === "close") { game.closeOverlay(); return true; }
  }
  return false;
}

/** Live slider drag, so the value tracks the pointer. */
export function optionsDrag(game, mx) {
  const key = game.sliderDrag;
  if (!key) return;
  const r = (game.optionRects || []).find((o) => o.action === "slider" && o.arg === key);
  if (!r) return;
  const v = Math.max(0, Math.min(1, (mx - r.rect.x - 2) / (r.rect.w - 4)));
  settings[key] = Math.round(v * 100) / 100;
  game.audio.applySettings();
}

// ---- inventory --------------------------------------------------------------
export function drawInventory(g, game) {
  const p = game.pod;
  game.optionRects = [];
  const add = (rect, action, arg) => game.optionRects.push({ rect, action, arg });

  g.save();
  g.fillStyle = "rgba(4,6,10,0.90)";
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.restore();
  bevelPanel(g, 24, 20, VIEW_W - 48, VIEW_H - 40, 9);
  shadowText(g, "INVENTORY", 44, 56, 20, COL.gold);
  shadowText(g, `CASH  ${money(p.cash)}`, VIEW_W - 44, 56, 15, COL.green, "right");

  // --- consumables ---------------------------------------------------------
  bevelPanel(g, 44, 76, 300, 232, 7);
  shadowText(g, "CONSUMABLES", 62, 100, 12, COL.gold);
  let y = 124;
  for (const it of Object.values(ITEMS)) {
    const n = p.items[it.key];
    const infinite = it.key === "teleporter" && p.blueprints.hyperdrive;
    const on = n > 0 || infinite;
    shadowText(g, `[${it.hotkey}]`, 62, y, 11, on ? COL.cyan : "#454a57");
    shadowText(g, it.label, 100, y, 11, on ? COL.text : "#5a606d");
    shadowText(g, infinite ? "∞" : String(n), 326, y, 12, on ? COL.gold : "#454a57", "right");
    y += 24;
  }
  shadowText(g, "Explosives, teleporter and transmitter", 62, y + 8, 10, COL.dim);
  shadowText(g, "all need solid ground under the pod.", 62, y + 21, 10, COL.dim);

  // --- fitted hardware -----------------------------------------------------
  bevelPanel(g, 356, 76, 288, 232, 7);
  shadowText(g, "FITTED HARDWARE", 374, 100, 12, COL.gold);
  y = 122;
  for (const key of Object.keys(LINES)) {
    shadowText(g, LINES[key].label, 374, y, 10, COL.dim);
    shadowText(g, tierName(key, p.tiers[key]), 626, y, 10, COL.text, "right");
    y += 17;
  }
  y += 8;
  meter(g, 374, y, 252, 16, p.hull / p.maxHull(), COL.green, "HULL",
    `${Math.ceil(p.hull)} / ${p.maxHull()}`);
  meter(g, 374, y + 22, 252, 16, p.fuel / p.maxFuel(), COL.amber, "FUEL",
    `${p.fuel.toFixed(1)} / ${p.maxFuel()} L`);
  const cap = p.maxCargo();
  meter(g, 374, y + 44, 252, 16, cap > 9000 ? 0.08 : p.cargoUsed() / cap, COL.cyan, "CARGO",
    cap > 9000 ? `${p.cargoUsed()} / ∞` : `${p.cargoUsed()} / ${cap}`);

  // --- blueprints and eggs -------------------------------------------------
  bevelPanel(g, 656, 76, VIEW_W - 700, 232, 7);
  shadowText(g, "ANCIENT BLUEPRINTS", 674, 100, 12, COL.gold);
  y = 120;
  for (const bp of BLUEPRINTS) {
    const owned = !!p.blueprints[bp.id];
    shadowText(g, owned ? "■" : "□", 674, y, 11, owned ? COL.cyan : "#454a57");
    shadowText(g, bp.name, 692, y, 10, owned ? COL.text : "#5a606d");
    y += 16;
  }
  y += 4;
  shadowText(g, "FOUND", 674, y, 11, COL.gold);
  y += 16;
  const eggs = [
    ["oilbird", "Oil-Bird  (pays for plain dirt)"],
    ["guardian", "Guardian  (halves all damage)"],
    ["mrdog", "Mr. Dog"],
  ];
  for (const [k, label] of eggs) {
    const owned = !!p.eggs[k];
    shadowText(g, owned ? "■" : "□", 674, y, 11, owned ? COL.cyan : "#454a57");
    shadowText(g, label, 692, y, 10, owned ? COL.text : "#5a606d");
    y += 15;
  }
  // One Satan's Head per kill, and each one is a New Game+ cycle of scaling.
  const heads = p.satanHeads || 0;
  shadowText(g, heads > 0 ? `Satan's Head x${heads}` : "Satan's Head", 692, y, 10,
    heads > 0 ? COL.red : "#5a606d");
  shadowText(g, heads > 0 ? "■" : "□", 674, y, 11, heads > 0 ? COL.red : "#454a57");
  if (getCycle() > 0) {
    shadowText(g, `Minerals pay ${Math.round(valueScale() * 100)}%`, 674, y + 16, 10, COL.red);
    shadowText(g, `Digging scores x${pointScale()}`, 674, y + 29, 10, COL.red);
  }

  // --- hold ----------------------------------------------------------------
  bevelPanel(g, 44, 324, VIEW_W - 88, 158, 7);
  shadowText(g, "CARGO HOLD", 62, 348, 12, COL.gold);
  const entries = Object.entries(p.cargo).filter(([, n]) => n > 0);
  if (!entries.length) {
    shadowText(g, "Empty.", 62, 374, 12, COL.dim);
  } else {
    let cx = 62, cy = 374, col = 0;
    for (const [id, n] of entries) {
      const e = SELLABLE[id];
      g.fillStyle = e.color || "#c9a44a";
      g.fillRect(cx, cy - 9, 10, 10);
      shadowText(g, `${e.name} x${n}`, cx + 18, cy, 11, COL.text);
      shadowText(g, `${cargoUnits(e) * n} u`, cx + 190, cy, 10, COL.dim, "right");
      shadowText(g, money(sellValue(e) * n), cx + 272, cy, 10, COL.gold, "right");
      cy += 19;
      if (cy > 466) { col++; cy = 374; cx = 62 + col * 292; }
    }
  }
  shadowText(g, `HOLD VALUE  ${money(p.cargoValue())}`, VIEW_W - 62, 348, 13, COL.gold, "right");

  add(button(g, VIEW_W - 190, VIEW_H - 64, 146, 36, "BACK", {
    hover: game.hoverKey === "optback", accent: COL.green, size: 13,
  }), "close");
  crtOverlay(g, VIEW_W, VIEW_H);
}

void font;
