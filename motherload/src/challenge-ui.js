// Challenge mode's three screens: the objective list, the in-run objective
// strip, and the cleared / failed panel.

import { VIEW_W, VIEW_H } from "./config.js";
import { COL, bevelPanel, inset, shadowText, button, hit, crtOverlay, font } from "./ui.js";
import { CHALLENGES, formatClock } from "./challenge.js";

// ---- the list ---------------------------------------------------------------
export function drawChallengeSelect(g, game) {
  game.challengeRects = [];
  const add = (rect, action, arg) => game.challengeRects.push({ rect, action, arg });
  const p = game.challengeProgress;

  const grd = g.createLinearGradient(0, 0, 0, VIEW_H);
  grd.addColorStop(0, "#0a0d16");
  grd.addColorStop(0.6, "#241206");
  grd.addColorStop(1, "#4a1c09");
  g.fillStyle = grd;
  g.fillRect(0, 0, VIEW_W, VIEW_H);

  shadowText(g, "CHALLENGE MODE", VIEW_W / 2, 54, 26, COL.gold, "center");
  shadowText(g, "Twelve timed objectives. Clear all twelve WITHOUT FAILING and your next",
    VIEW_W / 2, 76, 11, COL.dim, "center");
  shadowText(g, "new game starts with the Multi-Drill.", VIEW_W / 2, 91, 11, COL.dim, "center");

  const cleared = new Set(p.cleared);
  const rowH = 30;
  const top = 108;
  for (let i = 0; i < CHALLENGES.length; i++) {
    const ch = CHALLENGES[i];
    const y = top + i * rowH;
    const done = cleared.has(ch.n);
    bevelPanel(g, 44, y, VIEW_W - 240, rowH - 4, 4, done ? "#16281c" : "#1b1e27");
    shadowText(g, done ? "■" : "□", 60, y + 18, 12, done ? COL.green : "#4a4f5c");
    shadowText(g, String(ch.n).padStart(2, " "), 82, y + 18, 12, COL.cyan);
    shadowText(g, ch.target, 116, y + 18, 12, done ? COL.green : COL.text);
    shadowText(g, formatClock(ch.limit), VIEW_W - 262, y + 18, 12, COL.amber, "right");
    add(button(g, VIEW_W - 184, y + 1, 140, rowH - 6, done ? "REPLAY" : "PLAY", {
      hover: game.hoverKey === "ch" + ch.n, size: 11,
      accent: done ? COL.cyan : COL.green,
    }), "play", ch.n);
  }

  const y2 = top + CHALLENGES.length * rowH + 6;
  inset(g, 44, y2, VIEW_W - 88, 34, 4);
  const status = p.multidrill
    ? "MULTI-DRILL EARNED - it is fitted on every new game from now on."
    : p.flawless
      ? `${p.cleared.length} / 12 cleared, no failures yet. Keep the run clean.`
      : `${p.cleared.length} / 12 cleared. A challenge was failed, so the Multi-Drill is off the table until you reset.`;
  shadowText(g, status, 58, y2 + 22, 11,
    p.multidrill ? COL.gold : p.flawless ? COL.green : COL.red);

  game.challengeButtons = {
    back: button(g, 44, VIEW_H - 52, 160, 36, "BACK", {
      hover: game.hoverKey === "chback", size: 13,
    }),
    reset: button(g, 216, VIEW_H - 52, 200, 36, "RESET PROGRESS", {
      hover: game.hoverKey === "chreset", size: 12, accent: COL.red,
    }),
  };
  add(game.challengeButtons.back, "back");
  add(game.challengeButtons.reset, "reset");
  shadowText(g, "Targets and time limits are the Goldium Edition's own. The three maze layouts are not.",
    VIEW_W - 44, VIEW_H - 66, 10, COL.dim, "right");
  crtOverlay(g, VIEW_W, VIEW_H);
}

export function challengeSelectHover(game, mx, my) {
  game.hoverKey = null;
  for (const r of game.challengeRects || []) {
    if (!hit(r.rect, mx, my)) continue;
    if (r.action === "play") game.hoverKey = "ch" + r.arg;
    else if (r.action === "back") game.hoverKey = "chback";
    else if (r.action === "reset") game.hoverKey = "chreset";
    return;
  }
}

export function challengeSelectClick(game, mx, my) {
  for (const r of game.challengeRects || []) {
    if (!hit(r.rect, mx, my)) continue;
    if (r.action === "play") game.startChallenge(r.arg);
    else if (r.action === "back") { game.state = "title"; game.audio.blip(320, 0.08); }
    else if (r.action === "reset") game.resetChallengeProgress();
    return true;
  }
  return false;
}

// ---- the in-run strip -------------------------------------------------------
export function drawChallengeHUD(g, game) {
  const run = game.challenge;
  if (!run) return;
  const rows = run.progress();
  const h = 46 + rows.length * 17;
  const w = 330;
  const x = VIEW_W - w - 8, y = 88;
  bevelPanel(g, x, y, w, h, 6);
  shadowText(g, `CHALLENGE ${run.spec.n} / 12`, x + 14, y + 20, 11, COL.gold);

  const low = run.timeLeft < 10;
  const clock = formatClock(run.timeLeft);
  g.save();
  g.font = font(20);
  g.textAlign = "right";
  g.fillStyle = low && game.blink > 0.5 ? COL.red : low ? "#8a2018" : COL.cyan;
  g.shadowColor = g.fillStyle;
  g.shadowBlur = 10;
  g.fillText(clock, x + w - 14, y + 24);
  g.restore();

  // The target string, wrapped, exactly as the source words it.
  const words = run.spec.target.split(" ");
  let line = "", ly = y + 38;
  for (const wd of words) {
    if ((line + wd).length > 40) { shadowText(g, line, x + 14, ly, 11, COL.text); line = ""; ly += 14; }
    line += wd + " ";
  }
  if (line) shadowText(g, line, x + 14, ly, 11, COL.text);

  let py = ly + 18;
  for (const r of rows) {
    shadowText(g, r.done ? "■" : "□", x + 14, py, 11, r.done ? COL.green : "#4a4f5c");
    shadowText(g, r.label, x + 32, py, 11, r.done ? COL.green : COL.dim);
    py += 17;
  }
}

/** The exit beacon at the end of a maze. */
export function drawChallengeGoal(g, game, time) {
  const run = game.challenge;
  if (!run || !run.goal || run.reachedGoal) return;
  const { x, y, r } = run.goal;
  const pulse = 0.5 + 0.5 * Math.sin(time * 4);
  g.save();
  g.globalCompositeOperation = "lighter";
  const gr = g.createRadialGradient(x, y, 2, x, y, r * 1.6);
  gr.addColorStop(0, `rgba(160,255,190,${0.5 + pulse * 0.4})`);
  gr.addColorStop(1, "rgba(40,220,110,0)");
  g.fillStyle = gr;
  g.beginPath(); g.arc(x, y, r * 1.6, 0, Math.PI * 2); g.fill();
  g.restore();
  g.save();
  g.strokeStyle = `rgba(180,255,200,${0.5 + pulse * 0.5})`;
  g.lineWidth = 3;
  g.beginPath(); g.arc(x, y, 14 + pulse * 5, 0, Math.PI * 2); g.stroke();
  g.fillStyle = "#bfffd4";
  g.beginPath(); g.arc(x, y, 5, 0, Math.PI * 2); g.fill();
  g.restore();
}

// ---- cleared / failed -------------------------------------------------------
export function drawChallengeResult(g, game) {
  const run = game.challenge;
  const won = run && run.status === "cleared";
  g.save();
  g.fillStyle = won ? "rgba(6,26,14,0.85)" : "rgba(26,0,0,0.85)";
  g.fillRect(0, 0, VIEW_W, VIEW_H);
  g.restore();

  bevelPanel(g, VIEW_W / 2 - 260, 140, 520, 300, 8, won ? "#16281c" : "#2a1414");
  shadowText(g, won ? "CHALLENGE CLEARED" : "CHALLENGE FAILED", VIEW_W / 2, 196, 26,
    won ? COL.green : COL.red, "center");
  shadowText(g, run ? `${run.spec.n}.  ${run.spec.target}` : "", VIEW_W / 2, 226, 12, COL.text, "center");

  let y = 262;
  if (won) {
    shadowText(g, `Time left  ${formatClock(run.timeLeft)}`, VIEW_W / 2, y, 12, COL.cyan, "center");
    y += 22;
    shadowText(g, "Fuel refilled and hull repaired for the next one.",
      VIEW_W / 2, y, 11, COL.dim, "center");
  } else {
    shadowText(g, run && run.failReason ? run.failReason : "", VIEW_W / 2, y, 14, COL.red, "center");
    y += 24;
    shadowText(g, "A failure forfeits the Multi-Drill until you reset progress.",
      VIEW_W / 2, y, 11, COL.dim, "center");
  }
  y += 30;
  const p = game.challengeProgress;
  shadowText(g, `${p.cleared.length} / 12 cleared`, VIEW_W / 2, y, 13, COL.gold, "center");

  if (game.challengeAllClear) {
    y += 26;
    shadowText(g, p.multidrill
      ? "ALL TWELVE. THE MULTI-DRILL IS YOURS ON YOUR NEXT NEW GAME."
      : "All twelve cleared, but not without failing. Reset to try for the drill.",
      VIEW_W / 2, y, 11, p.multidrill ? COL.gold : COL.red, "center");
  }

  const next = nextChallenge(game);
  game.resultButtons = {
    again: button(g, VIEW_W / 2 - 250, VIEW_H - 118, 230, 42, won && next ? `CHALLENGE ${next}` : "RETRY",
      { hover: game.hoverKey === "again", accent: COL.green, size: 13 }),
    list: button(g, VIEW_W / 2 + 20, VIEW_H - 118, 230, 42, "CHALLENGE LIST",
      { hover: game.hoverKey === "list", size: 13 }),
  };
}

export function nextChallenge(game) {
  const run = game.challenge;
  if (!run || run.status !== "cleared") return null;
  const n = run.spec.n + 1;
  return n <= CHALLENGES.length ? n : null;
}

export function challengeResultHover(game, mx, my) {
  game.hoverKey = null;
  const b = game.resultButtons;
  if (!b) return;
  if (hit(b.again, mx, my)) game.hoverKey = "again";
  else if (hit(b.list, mx, my)) game.hoverKey = "list";
}

export function challengeResultClick(game, mx, my) {
  const b = game.resultButtons;
  if (!b) return false;
  if (hit(b.again, mx, my)) {
    const next = nextChallenge(game);
    game.startChallenge(next || game.challengeIndex);
    return true;
  }
  if (hit(b.list, mx, my)) {
    game.state = "challengeSelect";
    game.audio.blip(320, 0.08);
    return true;
  }
  return false;
}
