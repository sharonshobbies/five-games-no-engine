// localStorage persistence: upgrades, cash, items, blueprints, story progress.

import { SAVE_KEY } from "./config.js";
import { setCycle } from "./ore.js";

export function saveGame(game) {
  const p = game.pod;
  const data = {
    v: 1,
    seed: game.world.seed,
    cycle: game.newGamePlus,
    satanHeads: p.satanHeads || 0,
    cash: Math.round(p.cash),
    tiers: p.tiers,
    items: p.items,
    blueprints: p.blueprints,
    cargo: p.cargo,
    hull: Math.round(p.hull * 10) / 10,
    fuel: Math.round(p.fuel * 10) / 10,
    stats: p.stats,
    // The Quantum Particle State Analyzer 6000 "immediately resets your score",
    // so score is deliberately NOT written: a resumed run starts back at zero.
    story: Array.from(game.story.seen),
    dug: game.world.serializeEdits(),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadRaw() {
  try {
    const s = localStorage.getItem(SAVE_KEY);
    if (!s) return null;
    const d = JSON.parse(s);
    return d && d.v === 1 ? d : null;
  } catch {
    return null;
  }
}

export function applySave(game, d) {
  const p = game.pod;
  game.newGamePlus = d.cycle || 0;
  setCycle(game.newGamePlus);
  p.satanHeads = d.satanHeads || 0;
  p.cash = d.cash || 0;
  Object.assign(p.tiers, d.tiers || {});
  Object.assign(p.items, d.items || {});
  p.blueprints = d.blueprints || {};
  p.cargo = d.cargo || {};
  Object.assign(p.stats, d.stats || {});
  p.hull = Math.min(d.hull ?? p.maxHull(), p.maxHull());
  p.fuel = Math.min(d.fuel ?? p.maxFuel(), p.maxFuel());
  if (d.story) for (const k of d.story) game.story.seen.add(k);
  if (d.dug) game.world.applyEdits(d.dug);
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch {}
}
