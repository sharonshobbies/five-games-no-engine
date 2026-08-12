// save.js -- localStorage persistence of the camp board, level progress and
// resources. The camp is stored as a compact land/object snapshot.

const KEY = 'mergedragons.save.v1';

export function blankSave() {
  return {
    v: 1,
    coins: 120, bricks: 20, gems: 8, chalices: 7,
    chaliceAt: Date.now(),
    levels: {},                // id -> {stars, done, plays}
    camp: null,                // {cols, rows, land, paid, playable, objs}
    carried: [],               // items carried out of levels, waiting in camp
    discovered: {},            // item key -> true
    stats: { merges: 0, merge5: 0, harvests: 0, healed: 0, levelsDone: 0 },
    seen: false,
  };
}

export function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return blankSave();
    const s = JSON.parse(raw);
    if (!s || s.v !== 1) return blankSave();
    const b = blankSave();
    return { ...b, ...s, stats: { ...b.stats, ...(s.stats || {}) } };
  } catch (e) {
    return blankSave();
  }
}

export function save(s) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) { /* quota or private mode -- play on without saving */ }
}

export function wipe() {
  try { localStorage.removeItem(KEY); } catch (e) {}
}

export function snapshotBoard(board) {
  return {
    cols: board.cols, rows: board.rows,
    land: Array.from(board.land),
    cost: Array.from(board.cost),
    paid: Array.from(board.paid),
    playable: Array.from(board.playable),
    fog: board.fog ? Array.from(board.fog) : null,
    // Dimensional Jars are time-limited offers, so they are not carried across
    // a session -- the wiki's jars expire in an hour whatever you do.
    objs: board.objs.filter((o) => o.d.chain !== 'jar').map((o) => ({
      k: o.key, x: o.x, y: o.y,
      t: Math.round(o.tapsLeft),
      hp: o.hpLeft,
      st: o.dragon ? o.dragon.stamina : undefined,
      h: o.hidden ? 1 : 0,
      // leftover piles keep what they hold; a statue remembers its one egg tap
      am: o.amount,
      eg: o.eggTapped ? 1 : 0,
    })),
  };
}

export function restoreBoard(BoardCls, snap) {
  const b = new BoardCls(snap.cols, snap.rows);
  b.land.set(snap.land);
  b.cost.set(snap.cost);
  b.paid.set(snap.paid);
  b.playable.set(snap.playable);
  if (snap.fog) { b.fog = new Float32Array(snap.cols * snap.rows); b.fog.set(snap.fog); }
  b.landDirty = true;
  return b;
}
