// Tunables and derived constants.
//
// Values marked [slither] come from the reverse-engineered slither.io protocol
// constants (ClitherProject/Slither.io-Protocol) and are used at their real
// magnitudes. The arena radius is deliberately scaled down from the original
// 21600 because we run ~30 bots instead of ~500 players and still want the
// encounter density of a busy public server.

export const TICK_MS = 8; // [slither] the original's angular/linear rates are per 8ms
export const TICKS_PER_SEC = 1000 / TICK_MS;

// ---------------------------------------------------------------- arena
export const ARENA_R = 7000; // original: 21600
export const BORDER_GLOW = 300; // width of the red danger band

// ---------------------------------------------------------------- snake motion
export const NSP1 = 5.39; // [slither] base node speed
export const NSP2 = 0.4; // [slither] node speed per unit thickness
export const SPANGDV = 4.8; // [slither] speed at which angular rate saturates
export const MAMU = 0.033; // [slither] base angular speed, rad / 8ms
export const BOOST_MUL = 1.92; // observed ~2x sprint
export const MAX_SC = 6; // [slither] thickness cap

// radius = sc * SC_TO_RADIUS. [slither] getSnakeWidth(sc) = sc * 29
export const SC_TO_RADIUS = 14.5;

// [slither] wsep = 6 * sc -- distance between body parts
export const PART_SEP = 6;

export const TRAIL_STEP = 4; // world units between recorded trail samples
export const BASE_PARTS = 40; // parts at START_MASS -- a new snake is a noodle,
                              // not a bead: ~8 body-widths long, as in the original
export const MAX_PARTS = 215; // original mscps is 411; trimmed for arena scale
export const SC_PER_PART = 52; // parts above BASE_PARTS per +1 thickness
export const START_MASS = 10;
// Parts grow as a power of mass, not linearly. Linear growth saturated the
// visual cap at length ~500, which made every snake on the leaderboard look
// identical; a 0.60 exponent puts the cap near length 2500 instead. The
// original saturates too (at mscps parts / sc 6) -- appearance capping while
// the score keeps climbing is faithful, it just has to happen late.
export const PART_COEF = 1.62;
export const PART_EXP = 0.60;

// ---------------------------------------------------------------- boost
export const BOOST_MIN_MASS = 22; // can't sprint below this
export const BOOST_MASS_PER_SEC = 9.5; // wiki says 15/s in score units
export const BOOST_ORB_MASS = 1.6; // shed mass per trail pellet

// ---------------------------------------------------------------- food
export const FOOD_TARGET = 16800;
export const FOOD_MASS_MIN = 0.9;
export const FOOD_MASS_MAX = 2.4;
export const FOOD_R_BASE = 4.6; // world radius per sqrt(mass)
export const SPAWN_GRACE = 2.2; // seconds of head-collision immunity on spawn
export const FOOD_MAGNET = 2.6; // orbs get sucked in within eatR * this
export const DEATH_MASS_FRACTION = 0.68; // of the dead snake's mass
export const DEATH_ORB_MASS = 5.0; // corpse orbs are fat and bright

export const PREY_COUNT = 16;
export const PREY_MASS = 26;

// ---------------------------------------------------------------- population
// 38 bots in a 7000-radius arena measured out at ~3.9 deaths/sec with a 6.4s
// median bot life -- a blender. 30 keeps 2-3 snakes on screen at typical zoom.
// With the current AI the same 30 measure 1.00 deaths/sec and a 24.4s median
// life (tools/probe-ai.mjs), so population is no longer what sets the churn.
export const BOT_COUNT = 30;
export const NAME_POOL = [
  'viper', 'Nyx', 'slinky', 'GHOST', 'kobra', 'Zed', 'noodle', 'Mamba',
  'twitch', 'ANACONDA', 'sly', 'Rattle', 'creep', 'Hydra', 'wormy', 'Basilisk',
  'ouroboros', 'Slippy', 'coil', 'VENOM', 'python', 'Adder', 'sidewinder',
  'Krait', 'lil guy', 'BIG', 'spaghetti', 'Boa', 'tapeworm', 'Naga',
  'zigzag', 'Fang', 'eel', 'Cobra', 'squiggle', 'Lurker',
];

// ---------------------------------------------------------------- camera
// pixels-per-world-unit falls off as the snake fattens, so you see more arena
// the bigger you get.
export const ZOOM_BASE = 1.16;
export const ZOOM_FALLOFF = 0.30;
export function zoomForSc(sc) {
  return ZOOM_BASE / (1 + ZOOM_FALLOFF * (sc - 1));
}

// ---------------------------------------------------------------- render caps
export const BODY_INSTANCE_CAP = 34000;
export const FOOD_INSTANCE_CAP = 9500;
export const MAX_COLLISION_NODES = 40000;

// ---------------------------------------------------------------- skins
// Each skin is a repeating band pattern. Colours are code-authored, no assets.
export const SKINS = [
  { name: 'Neon Lime', bands: ['#7dff3a', '#3ba81c'] },
  { name: 'Hot Coral', bands: ['#ff4d6d', '#ffd166'] },
  { name: 'Cyan Ice', bands: ['#3ae8ff', '#1b6fd6', '#e8feff'] },
  { name: 'Violet Haze', bands: ['#b06bff', '#5b23c9'] },
  { name: 'Wasp', bands: ['#ffe14d', '#2a2118'] },
  { name: 'Rainbow', bands: ['#ff3b3b', '#ff9f1c', '#ffe14d', '#5eff5e', '#3ae8ff', '#8a5bff'] },
  { name: 'Toxic', bands: ['#c6ff00', '#00e5a0', '#14805c'] },
  { name: 'Ember', bands: ['#ff7b00', '#ff2d00', '#ffd28a'] },
  { name: 'Ghost', bands: ['#e9f2ff', '#8fa6c9'] },
  { name: 'Deep Sea', bands: ['#00b3ff', '#0a5aa8', '#00fff0'] },
  { name: 'Bubblegum', bands: ['#ff8ad8', '#ffd6f2', '#c341a8'] },
  { name: 'Panther', bands: ['#2b2b3a', '#ffcf40'] },
];

export const BAND_UNITS = 2.55; // band length in multiples of body radius
