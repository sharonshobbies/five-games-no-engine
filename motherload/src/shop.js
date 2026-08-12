// The four surface vendors: Propellent Vendor 12000, Mineral Processor 3000,
// Autobuy 2000 and Emendation Station 3500.

import { VIEW_W, VIEW_H, FUEL_PRICE_PER_L, RESERVE_TANK_LITRES } from "./config.js";
import {
  COL, bevelPanel, inset, shadowText, button, hit, money, font, meter, crtOverlay,
} from "./ui.js";
import { LINES, ITEMS, NANOBOT_REPAIR, REPAIR_COST_PER_HP, tier, nextTier, tierName } from "./upgrades.js";
import { SELLABLE, cargoUnits, sellValue, getCycle, valueScale } from "./ore.js";

const TABS = [
  { id: "fuel", label: "FUEL", title: "PROPELLENT VENDOR 12000" },
  { id: "sell", label: "SELL", title: "MINERAL PROCESSOR 3000" },
  { id: "shop", label: "UPGRADES", title: "AUTOBUY 2000" },
  { id: "repair", label: "REPAIR", title: "EMENDATION STATION 3500" },
];

export function drawShop(g, game) {
  const p = game.pod;
  game.shopRects = [];
  const add = (rect, action, arg) => game.shopRects.push({ rect, action, arg });

  // backdrop
  g.save();
  g.fillStyle = "rgba(4,6,10,0.88)";
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.restore();

  bevelPanel(g, 24, 20, VIEW_W - 48, VIEW_H - 40, 9);

  const tab = TABS.find((t) => t.id === game.shopTab) || TABS[0];
  shadowText(g, tab.title, 44, 54, 18, COL.gold);
  shadowText(g, `CASH  ${money(p.cash)}`, VIEW_W - 44, 54, 16, COL.green, "right");

  // tab strip
  let tx = 44;
  for (const t of TABS) {
    const w = 118;
    const r = button(g, tx, 66, w, 30, t.label, {
      hover: game.hoverKey === "tab" + t.id,
      accent: COL.cyan,
      size: 11,
      disabled: false,
    });
    if (t.id === game.shopTab) {
      g.save();
      g.strokeStyle = COL.gold;
      g.lineWidth = 2;
      g.strokeRect(tx + 1, 67, w - 2, 28);
      g.restore();
    }
    add(r, "tab", t.id);
    tx += w + 8;
  }

  const bodyY = 112;
  if (game.shopTab === "fuel") drawFuel(g, game, add, bodyY);
  else if (game.shopTab === "sell") drawSell(g, game, add, bodyY);
  else if (game.shopTab === "shop") drawUpgrades(g, game, add, bodyY);
  else drawRepair(g, game, add, bodyY);

  const exit = button(g, VIEW_W - 168, VIEW_H - 62, 124, 34, "LAUNCH", {
    hover: game.hoverKey === "exit", accent: COL.green, size: 13,
  });
  add(exit, "exit");
  if (game.shopMessage && game.shopMessageTimer > 0) {
    shadowText(g, game.shopMessage, 48, VIEW_H - 40, 12,
      game.shopMessageBad ? COL.red : COL.green);
  }
  crtOverlay(g, VIEW_W, VIEW_H);
}

// ---- fuel -------------------------------------------------------------------
function drawFuel(g, game, add, y) {
  const p = game.pod;
  const missing = p.maxFuel() - p.fuel;
  const fillCost = Math.ceil(missing * FUEL_PRICE_PER_L);

  bevelPanel(g, 44, y, VIEW_W - 88, 150, 7);
  shadowText(g, "PROPELLENT", 64, y + 30, 12, COL.dim);
  meter(g, 64, y + 44, VIEW_W - 128, 26, p.fuel / p.maxFuel(), COL.amber,
    tierName("fuel", p.tiers.fuel), `${p.fuel.toFixed(1)} / ${p.maxFuel()} L`);
  shadowText(g, `RATE  $${FUEL_PRICE_PER_L} per litre`, 64, y + 96, 12, COL.text);
  shadowText(g, `TO FILL  ${missing.toFixed(1)} L  =  ${money(fillCost)}`, 64, y + 118, 12, COL.gold);

  add(button(g, VIEW_W - 300, y + 88, 110, 40, "+10 L", {
    hover: game.hoverKey === "fuel10", size: 13,
    disabled: missing < 0.1 || p.cash < 10 * FUEL_PRICE_PER_L,
  }), "buyFuel", 10);
  add(button(g, VIEW_W - 180, y + 88, 110, 40, "FILL", {
    hover: game.hoverKey === "fuelall", size: 13, accent: COL.green,
    disabled: missing < 0.1 || p.cash < 1,
  }), "buyFuel", "all");

  bevelPanel(g, 44, y + 166, VIEW_W - 88, 236, 7);
  shadowText(g, "DRIVER'S NOTES", 64, y + 194, 12, COL.gold);
  const notes = [
    "Fuel burns while you thrust and while you drill. Falling is free.",
    "Run dry underground and the pod is lost with everything in the hold.",
    "The stock tank is about thirty seconds of digging. Budget the climb out.",
    "A Reserve Fuel Tank is $2,000 for 25 L. That is 80x the pump price.",
    "You cannot drill upward: every shaft you sink you must fly back up.",
  ];
  let ny = y + 220;
  for (const n of notes) { shadowText(g, "- " + n, 64, ny, 11, COL.dim); ny += 22; }
}

// ---- sell -------------------------------------------------------------------
function drawSell(g, game, add, y) {
  const p = game.pod;
  const entries = Object.entries(p.cargo).filter(([, n]) => n > 0);
  bevelPanel(g, 44, y, VIEW_W - 88, VIEW_H - y - 92, 7);
  shadowText(g, "HOLD MANIFEST", 64, y + 28, 12, COL.gold);
  shadowText(g, "ITEM", 64, y + 52, 10, COL.dim);
  shadowText(g, "QTY", 380, y + 52, 10, COL.dim, "right");
  shadowText(g, "UNIT", 470, y + 52, 10, COL.dim, "right");
  shadowText(g, "SPACE", 560, y + 52, 10, COL.dim, "right");
  shadowText(g, "TOTAL", VIEW_W - 120, y + 52, 10, COL.dim, "right");

  let ly = y + 76;
  if (!entries.length) {
    shadowText(g, "The hold is empty. Go and fill it.", 64, ly + 10, 12, COL.dim);
  }
  for (const [id, n] of entries) {
    const e = SELLABLE[id];
    g.fillStyle = e.color || "#c9a44a";
    g.fillRect(64, ly - 9, 10, 10);
    shadowText(g, e.name, 84, ly, 12, COL.text);
    shadowText(g, String(n), 380, ly, 12, COL.text, "right");
    shadowText(g, money(sellValue(e)), 470, ly, 12, COL.dim, "right");
    shadowText(g, String(cargoUnits(e) * n), 560, ly, 12, COL.dim, "right");
    shadowText(g, money(sellValue(e) * n), VIEW_W - 120, ly, 12, COL.gold, "right");
    ly += 21;
  }

  const total = p.cargoValue();
  if (getCycle() > 0) {
    shadowText(g,
      `MARKET GLUT - CYCLE ${getCycle() + 1}: minerals fetch ${Math.round(valueScale() * 100)}% of list`,
      64, VIEW_H - 148, 11, COL.red);
  }
  shadowText(g, `TOTAL  ${money(total)}`, 64, VIEW_H - 128, 16, COL.gold);
  shadowText(g, `POINTS  +${p.cargoPoints().toLocaleString("en-US")}`, 64, VIEW_H - 106, 11, COL.dim);
  add(button(g, VIEW_W - 320, VIEW_H - 152, 250, 46, "SELL EVERYTHING", {
    hover: game.hoverKey === "sell", accent: COL.gold, size: 14, disabled: total <= 0,
  }), "sellAll");
}

// ---- upgrades ---------------------------------------------------------------
function drawUpgrades(g, game, add, y) {
  const p = game.pod;
  const keys = Object.keys(LINES);
  const rowH = 68;
  keys.forEach((key, i) => {
    const line = LINES[key];
    const ry = y + i * rowH;
    const cur = tier(key, p.tiers[key]);
    const nxt = nextTier(key, p.tiers[key]);
    bevelPanel(g, 44, ry, VIEW_W - 88, rowH - 8, 6);

    shadowText(g, line.label, 62, ry + 22, 13, COL.gold);
    shadowText(g, `${cur.name}`, 62, ry + 42, 11, COL.text);
    shadowText(g, `${line.stat}: ${cur.value} ${line.unit}`, 62, ry + 55, 10, COL.dim);

    // tier pips
    let px = 300;
    line.tiers.forEach((t, ti) => {
      const owned = ti <= p.tiers[key];
      g.fillStyle = owned ? COL.gold : "#2c313d";
      g.fillRect(px, ry + 16, 14, 10);
      g.strokeStyle = "#0b0d12";
      g.lineWidth = 1;
      g.strokeRect(px, ry + 16, 14, 10);
      px += 17;
    });

    if (nxt) {
      shadowText(g, `NEXT  ${nxt.name}`, 300, ry + 44, 11, COL.cyan);
      shadowText(g, `${line.stat}: ${nxt.value} ${line.unit}`, 300, ry + 56, 10, COL.dim);
      const afford = p.cash >= nxt.price;
      add(button(g, VIEW_W - 290, ry + 12, 220, 36, money(nxt.price), {
        hover: game.hoverKey === "up" + key, size: 13,
        accent: afford ? COL.green : COL.red,
        disabled: !afford, sub: "BUY " + line.label,
      }), "buyUpgrade", key);
    } else {
      shadowText(g, "MAXED OUT", VIEW_W - 180, ry + 36, 13, COL.green, "center");
    }
  });

  // blueprint / easter-egg rack
  const by = y + keys.length * rowH + 2;
  const owned = Object.keys(p.blueprints);
  if (by < VIEW_H - 100) {
    shadowText(g, owned.length
      ? "ANCIENT BLUEPRINTS INSTALLED: " + owned.map((k) => k.toUpperCase()).join(", ")
      : "ANCIENT BLUEPRINTS: five are buried below -3,000 ft. The Multi-Drill is Challenge mode's.",
      48, by + 18, 11, owned.length ? COL.cyan : COL.dim);
  }
}

// ---- repair + consumables ---------------------------------------------------
function drawRepair(g, game, add, y) {
  const p = game.pod;
  const missing = p.maxHull() - p.hull;
  const cost = Math.ceil(missing * REPAIR_COST_PER_HP);

  bevelPanel(g, 44, y, VIEW_W - 88, 118, 7);
  shadowText(g, "HULL INTEGRITY", 64, y + 28, 12, COL.dim);
  meter(g, 64, y + 40, VIEW_W - 420, 26, p.hull / p.maxHull(),
    p.hull / p.maxHull() < 0.4 ? COL.red : COL.green,
    tierName("hull", p.tiers.hull), `${Math.ceil(p.hull)} / ${p.maxHull()}`);
  shadowText(g, `SERVICE RATE  $${REPAIR_COST_PER_HP} per HP`, 64, y + 92, 11, COL.text);
  add(button(g, VIEW_W - 330, y + 36, 250, 44, cost > 0 ? `REPAIR  ${money(cost)}` : "NO DAMAGE", {
    hover: game.hoverKey === "repair", accent: COL.green, size: 13,
    disabled: missing < 0.5 || p.cash < cost,
  }), "repair");

  // consumables grid
  const items = Object.values(ITEMS);
  const cols = 3, cw = (VIEW_W - 88 - (cols - 1) * 10) / cols, ch = 104;
  items.forEach((it, i) => {
    const cx = 44 + (i % cols) * (cw + 10);
    const cy = y + 132 + Math.floor(i / cols) * (ch + 10);
    bevelPanel(g, cx, cy, cw, ch, 6);
    shadowText(g, it.label, cx + 14, cy + 24, 12, COL.gold);
    shadowText(g, `HELD  ${p.items[it.key]}`, cx + cw - 14, cy + 24, 11, COL.text, "right");
    // wrap the description
    const words = it.desc.split(" ");
    let line = "", ly = cy + 44;
    for (const wd of words) {
      if ((line + wd).length > 34) { shadowText(g, line, cx + 14, ly, 10, COL.dim); line = ""; ly += 13; }
      line += wd + " ";
    }
    if (line) shadowText(g, line, cx + 14, ly, 10, COL.dim);
    const afford = p.cash >= it.price;
    add(button(g, cx + cw - 128, cy + ch - 40, 114, 30, money(it.price), {
      hover: game.hoverKey === "item" + it.key, size: 12,
      accent: afford ? COL.green : COL.red, disabled: !afford,
    }), "buyItem", it.key);
    shadowText(g, `KEY ${it.hotkey}`, cx + 14, cy + ch - 18, 10, COL.cyan);
  });
}

// ---- input ------------------------------------------------------------------
export function shopHover(game, mx, my) {
  game.hoverKey = null;
  for (const r of game.shopRects || []) {
    if (!hit(r.rect, mx, my)) continue;
    if (r.action === "tab") game.hoverKey = "tab" + r.arg;
    else if (r.action === "buyFuel") game.hoverKey = r.arg === "all" ? "fuelall" : "fuel10";
    else if (r.action === "sellAll") game.hoverKey = "sell";
    else if (r.action === "buyUpgrade") game.hoverKey = "up" + r.arg;
    else if (r.action === "buyItem") game.hoverKey = "item" + r.arg;
    else if (r.action === "repair") game.hoverKey = "repair";
    else if (r.action === "exit") game.hoverKey = "exit";
    return;
  }
}

export function shopClick(game, mx, my) {
  for (const r of game.shopRects || []) {
    if (!hit(r.rect, mx, my)) continue;
    handle(game, r.action, r.arg);
    return true;
  }
  return false;
}

function handle(game, action, arg) {
  const p = game.pod;
  const say = (msg, bad = false) => {
    game.shopMessage = msg;
    game.shopMessageBad = bad;
    game.shopMessageTimer = 3;
    if (bad) game.audio.deny(); else game.audio.buy();
  };

  if (action === "tab") { game.shopTab = arg; game.audio.blip(700, 0.05); return; }
  if (action === "exit") { game.closeShop(); return; }

  if (action === "buyFuel") {
    const missing = p.maxFuel() - p.fuel;
    if (missing < 0.1) return say("Tank is already full.", true);
    let litres = arg === "all" ? missing : Math.min(missing, arg);
    let cost = Math.ceil(litres * FUEL_PRICE_PER_L);
    if (cost > p.cash) {
      litres = p.cash / FUEL_PRICE_PER_L;
      cost = Math.floor(p.cash);
      if (litres < 0.1) return say("No cash for fuel. Sell something.", true);
    }
    p.cash -= cost;
    p.fuel = Math.min(p.maxFuel(), p.fuel + litres);
    return say(`Pumped ${litres.toFixed(1)} L for ${money(cost)}.`);
  }

  if (action === "sellAll") {
    const got = p.sellAll();
    if (got.cash <= 0) return say("Nothing to sell.", true);
    game.audio.sell();
    game.save();
    game.shopMessage = `Sold for ${money(got.cash)}  (+${got.points.toLocaleString("en-US")} pts)`;
    game.shopMessageBad = false;
    game.shopMessageTimer = 3.5;
    return;
  }

  if (action === "repair") {
    const missing = p.maxHull() - p.hull;
    const cost = Math.ceil(missing * REPAIR_COST_PER_HP);
    if (missing < 0.5) return say("Hull is intact.", true);
    if (cost > p.cash) return say("Not enough cash for a full repair.", true);
    p.cash -= cost;
    p.hull = p.maxHull();
    game.save();
    return say(`Hull restored for ${money(cost)}.`);
  }

  if (action === "buyUpgrade") {
    const nxt = nextTier(arg, p.tiers[arg]);
    if (!nxt) return say("Already the best there is.", true);
    if (p.cash < nxt.price) return say("Not enough cash.", true);
    p.cash -= nxt.price;
    p.tiers[arg]++;
    // A new tank or hull arrives full.
    if (arg === "fuel") p.fuel = p.maxFuel();
    if (arg === "hull") p.hull = p.maxHull();
    game.save();
    return say(`Fitted ${nxt.name}.`);
  }

  if (action === "buyItem") {
    const it = ITEMS[arg];
    if (p.cash < it.price) return say("Not enough cash.", true);
    p.cash -= it.price;
    p.items[arg]++;
    game.save();
    return say(`Bought ${it.label}. Press ${it.hotkey} in the field.`);
  }
}

export { NANOBOT_REPAIR, RESERVE_TANK_LITRES };
