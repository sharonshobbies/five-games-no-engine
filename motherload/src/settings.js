// Options that persist independently of the save file, so muting the game is
// not undone by a cheat code or a new run.

const KEY = "motherload.options.v1";

export const DEFAULTS = {
  master: 0.7,
  music: 0.6,
  sfx: 0.8,
  muted: false,
  scaleToWindow: true,
};

export const settings = { ...DEFAULTS };

export function loadSettings() {
  try {
    const s = localStorage.getItem(KEY);
    if (!s) return settings;
    const d = JSON.parse(s);
    for (const k in DEFAULTS) {
      if (typeof d[k] === typeof DEFAULTS[k]) settings[k] = d[k];
    }
  } catch { /* defaults */ }
  return settings;
}

export function saveSettings() {
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* ignore */ }
}
