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
//
// The original's rates are quoted below at their real magnitudes and the whole
// movement model is then scaled by SPEED_SCALE. At 1.0 the arena was faster
// than it was comfortable to steer: a thin snake covered 736 world units per
// second, which at the old 1.16 zoom was 854 screen pixels -- a screen width
// every 2.2s -- and its full-lock turn circle was 178 units wide. At 0.70
// cruise is 515 units/s, and boost (x1.92) lands at 989, roughly the speed the
// game used to cruise at: sprinting now buys back the old pace instead of
// being the only speed that reads as fast.
//
// Everything that has to move with it moves with it, so this is one lever and
// not a retune:
//   - SPANGDV is the speed at which angular rate saturates. Every snake exceeds
//     it at base speed, which is what makes turnRate identical boosted or not --
//     the property the boost feel and all of the bot planning geometry rest on.
//     Left at 4.8 while speeds dropped, a thin snake would fall under the knee,
//     turn rate would scale down with speed, and the turn radius would not
//     tighten at all.
//   - MAMU is angular, in radians per tick, and is deliberately NOT scaled.
//     Speed falling against a fixed turn rate is exactly what tightens the turn
//     circle (turn radius = speed / turnRate) by the same 0.70.
//   - BOOST_MASS_PER_SEC scales too, so the mass burned per unit of distance
//     closed is unchanged and the sprint stays worth the same as it was.
export const SPEED_SCALE = 0.70;

export const NSP1 = 5.39 * SPEED_SCALE; // [slither] base node speed
export const NSP2 = 0.4 * SPEED_SCALE; // [slither] node speed per unit thickness
export const NSP_FLAT = 0.1 * SPEED_SCALE; // [slither] fsp = ssp + 0.1
export const SPANGDV = 4.8 * SPEED_SCALE; // [slither] speed at which angular rate saturates
export const MAMU = 0.033; // [slither] base angular speed, rad / 8ms -- unscaled
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
// Wiki says 15/s in score units; 9.5 is the retuned figure, scaled with
// SPEED_SCALE so a sprint costs the same mass per unit of ground covered as it
// did at full speed. Unscaled, slowing the arena would have made boosting 1.4x
// more expensive per length closed and quietly killed it as a chase tool.
export const BOOST_MASS_PER_SEC = 9.5 * SPEED_SCALE;
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
//
// The baseline was 1.16, which framed a new snake tightly enough that the first
// thing you learned about a neighbour was that you had already hit it. 0.86
// shows 1.35x more field in each axis (1.8x the area) from the first second.
//
// The falloff came down from 0.30 with it, so the change is spent on the small
// end where the player is actually blind rather than on the wide end that was
// already wide. MAX_PARTS caps sc at 4.37, not MAX_SC, so the zoom in play runs
// 0.86 -> 0.494 (it was 1.16 -> 0.577): a new snake gains 1.35x of field, a
// capped one 1.17x, and growth still widens the view by 1.74x. Holding the old
// 0.30 falloff on the new baseline would have taken a capped snake to 0.428,
// where a thin bot is 12px thick -- visible, but past the point where the extra
// field buys anything, since what you need to read at that size is other snakes.
export const ZOOM_BASE = 0.86;
export const ZOOM_FALLOFF = 0.22;
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
