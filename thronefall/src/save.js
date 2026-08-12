// Persistent progression in localStorage: cleared levels, best scores, account
// level and XP (which is what unlocks perks and mutator slots).
import { LEVELS } from './levels.js';
import { PERKS } from './perks.js';

const KEY = 'thronefall.save.v1';

const DEFAULT = {
  xp: 0,
  cleared: {},          // levelId -> { best, mutators:[] }
  seenIntro: false,
  weapon: 'bow',
  perks: [],
  mutators: [],
  volume: 0.5,
};

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return Object.assign({}, DEFAULT);
    const d = JSON.parse(raw);
    return Object.assign({}, DEFAULT, d);
  } catch (e) { return Object.assign({}, DEFAULT); }
}

export function save(s) {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
}

export function accountLevel(xp) {
  // gentle curve: level n needs 120*n xp cumulatively-ish
  let lvl = 1, need = 140, left = xp;
  while (left >= need && lvl < 54) { left -= need; lvl++; need = Math.round(need * 1.09); }
  return { level: lvl, into: left, need };
}

export function unlockedPerks(xp) {
  const { level } = accountLevel(xp);
  return PERKS.filter((p) => p.lvl <= level);
}

export function levelUnlocked(s, id) {
  const l = LEVELS.find((x) => x.id === id);
  if (!l || !l.unlockedBy) return true;
  return !!s.cleared[l.unlockedBy];
}

export function recordClear(s, levelId, score, mutators) {
  const prev = s.cleared[levelId];
  const best = prev ? Math.max(prev.best, score) : score;
  s.cleared[levelId] = { best, mutators: mutators.slice() };
  save(s);
}
