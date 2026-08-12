// Central tunables. Sourced numbers are marked; the rest is tuning.

export const VIEW_W = 960;
export const VIEW_H = 600;

// --- world grid -------------------------------------------------------------
// The original map is 32 blocks wide = 400 ft, so one block is 12.5 ft, and it
// is ~18.5x deeper than it is wide. Digging stops at -7,300 ft.
export const TILE = 48;
export const GRID_W = 32;
export const FEET_PER_TILE = 12.5;
export const SURFACE_ROW = 8;             // first soil row; above it is sky
export const DIG_ROWS = 584;              // 584 * 12.5 = 7,300 ft
export const BARRIER_ROWS = 3;            // the impenetrable floor
export const LAIR_ROWS = 24;              // Mr. Natas's arena below it
export const GRID_H = SURFACE_ROW + DIG_ROWS + BARRIER_ROWS + LAIR_ROWS;
export const MAX_DIG_DEPTH_FT = DIG_ROWS * FEET_PER_TILE;   // 7300
export const ALTIMETER_FAIL_FT = 5813;    // readout garbles below this
export const CHUNK = 8;
export const CHUNK_CACHE = 72;            // chunk canvases kept resident

// --- pod physics ------------------------------------------------------------
// The pod must fit inside one tile with slack, or a 1-tile shaft is unenterable.
export const POD_W = 34;
export const POD_H = 38;
export const GRAVITY = 900;
export const MAX_FALL = 950;
export const AIR_DRAG_X = 0.90;
export const GROUND_FRICTION = 0.55;
export const BASE_THRUST = 1780;          // px/s^2, stock engine
export const SIDE_THRUST = 900;

// Fall damage is a fixed table on distance fallen, capped at 8 HP, and can
// never kill a full-health pod. [depthFeet, damage]
export const FALL_SAFE_FT = 24;
export const FALL_TABLE = [
  [36, 3], [66, 4], [118, 5], [218, 6], [575, 7], [Infinity, 8],
];

// --- fuel (litres) ----------------------------------------------------------
export const FUEL_PER_SEC_DRILL = 0.33;   // stock 10 L tank ~= 30 s of digging
export const FUEL_PER_SEC_THRUST = 0.62;
export const FUEL_PER_SEC_SIDE = 0.34;
export const FUEL_PER_SEC_IDLE = 0.015;
export const FUEL_PRICE_PER_L = 1;        // Propellent Vendor 12000
export const RESERVE_TANK_LITRES = 25;

// --- drilling ---------------------------------------------------------------
// Seconds per tile = (12.5 ft / drill ft/s) * tile hardness.
export const DIG_MIN_TIME = 0.05;
export const DIG_MAX_TIME = 9.0;

// --- hazards ----------------------------------------------------------------
export const LAVA_DEPTH_FT = 3000;        // first lava pockets
export const LAVA_DAMAGE_FULL = 58;       // deep contact, before the radiator
export const LAVA_DAMAGE_GRAZE = 41;      // clipping the edge
export const LAVA_TICK = 0.9;             // seconds before lava can hit again
export const LAVA_CONVERTER_CASH = 2500;  // Magma Converter payout per hit

export const GAS_DEPTH_FT = 4750;         // first gas pockets
export const GAS_COMMON_FT = 4950;
export const GAS_TRIGGER_PROGRESS = 0.4;  // ignites part-way into the tile
export const GAS_RADIUS = 2.4;            // tiles cleared
export const GAS_FUEL_GAIN = 8;           // litres, with the Fuel Integrator
export const ROCK_DEPTH_FT = 1500;        // undrillable stone starts here

export const DYNAMITE_RADIUS = 2.2;
export const PLASTIC_RADIUS = 3.4;
export const DYNAMITE_FUSE = 1.15;
export const BLAST_SELF_DAMAGE = 6;
export const REGEN_HULL_PER_SEC = 0.6;

// --- economy ----------------------------------------------------------------
export const START_CASH = 0;
export const START_FUEL_TANK = 10;        // stock tank, unsourced ("<15 L")

// --- easter eggs ------------------------------------------------------------
export const GUARDIAN_ALTITUDE_FT = 10000;
export const MRDOG_ALTITUDE_FT = 5000;
export const SKY_CEILING_FT = 105000;

// --- save -------------------------------------------------------------------
export const SAVE_KEY = "motherload.save.v2";
