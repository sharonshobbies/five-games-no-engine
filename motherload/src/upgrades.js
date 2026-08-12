// Shop catalogues, transcribed from the original game's tables.
//
// The six upgrade lines all ride one price ladder: $750 / $2,000 / $5,000 /
// $20,000 / $100,000 / $500,000 (radiators skip the $750 step, cargo bays stop
// at $100,000). Stock tiers are printed as "<17", "<28 ft/s" etc in every
// source, so the starting values below are reconstructed just under the first
// purchasable tier. See FIDELITY.md for sourcing.

export const LINES = {
  fuel: {
    label: "FUEL TANK",
    shop: "autobuy",
    stat: "Capacity",
    unit: "L",
    tiers: [
      { name: "Micro Tank",              price: 0,      value: 10 },
      { name: "Medium Tank",             price: 750,    value: 15 },
      { name: "Huge Tank",               price: 2000,   value: 25 },
      { name: "Gigantic Tank",           price: 5000,   value: 40 },
      { name: "Titanic Tank",            price: 20000,  value: 60 },
      { name: "Leviathan Tank",          price: 100000, value: 100 },
      { name: "Liquid Compression Tank", price: 500000, value: 150 },
    ],
  },
  drill: {
    label: "DRILL",
    shop: "autobuy",
    stat: "Dig speed",
    unit: "ft/s",
    tiers: [
      { name: "Stock Drill",     price: 0,      value: 22 },
      { name: "Silvide Drill",   price: 750,    value: 28 },
      { name: "Goldium Drill",   price: 2000,   value: 40 },
      { name: "Emerald Drill",   price: 5000,   value: 50 },
      { name: "Ruby Drill",      price: 20000,  value: 70 },
      { name: "Diamond Drill",   price: 100000, value: 95 },
      { name: "Amazonite Drill", price: 500000, value: 120 },
    ],
  },
  engine: {
    label: "ENGINE",
    shop: "autobuy",
    stat: "Output",
    unit: "HP",
    tiers: [
      { name: "Stock Engine",          price: 0,      value: 150 },
      { name: "V4 1600cc Engine",      price: 750,    value: 160 },
      { name: "V4 2.0 Ltr Turbo",      price: 2000,   value: 170 },
      { name: "V6 3.8 Ltr Engine",     price: 5000,   value: 180 },
      { name: "V8 Supercharged 5.0",   price: 20000,  value: 190 },
      { name: "V12 6.0 Ltr Engine",    price: 100000, value: 200 },
      { name: "V16 Jag Engine",        price: 500000, value: 210 },
    ],
  },
  hull: {
    label: "HULL",
    shop: "autobuy",
    stat: "Integrity",
    unit: "HP",
    tiers: [
      { name: "Stock Hull",         price: 0,      value: 10 },
      { name: "Ironium Hull",       price: 750,    value: 17 },
      { name: "Bronzium Hull",      price: 2000,   value: 30 },
      { name: "Steel Hull",         price: 5000,   value: 50 },
      { name: "Silverium Hull",     price: 20000,  value: 80 },
      { name: "Einsteinium Hull",   price: 100000, value: 120 },
      { name: "Energy-Shield Hull", price: 500000, value: 180 },
    ],
  },
  cargo: {
    label: "CARGO BAY",
    shop: "autobuy",
    stat: "Capacity",
    unit: "cu ft",
    tiers: [
      { name: "Micro Bay",     price: 0,      value: 10 },
      { name: "Medium Bay",    price: 750,    value: 15 },
      { name: "Huge Bay",      price: 2000,   value: 25 },
      { name: "Gigantic Bay",  price: 5000,   value: 40 },
      { name: "Titanic Bay",   price: 20000,  value: 70 },
      { name: "Leviathan Bay", price: 100000, value: 120 },
    ],
  },
  radiator: {
    label: "RADIATOR",
    shop: "autobuy",
    stat: "Damage cut",
    unit: "%",
    tiers: [
      { name: "Stock Fan",                price: 0,      value: 0 },
      { name: "Dual Fan",                 price: 2000,   value: 10 },
      { name: "Single Turbine",           price: 5000,   value: 25 },
      { name: "Dual Turbine",             price: 20000,  value: 40 },
      { name: "Puron Cooling Fan",        price: 100000, value: 60 },
      { name: "Tri-Turbine Freon Array",  price: 500000, value: 80 },
    ],
  },
};

// Emendation Station 3500 stock. Prices are the original's.
export const ITEMS = {
  dynamite: {
    key: "dynamite", label: "Dynamite", price: 2000, hotkey: "X",
    desc: "Drop-and-run charge. Clears a small crater in rock.",
  },
  plastic: {
    key: "plastic", label: "Plastic Explosive", price: 5000, hotkey: "C",
    desc: "Bigger blast, bigger crater. Both destroy any ore inside it.",
  },
  teleporter: {
    key: "teleporter", label: "Quantum Teleporter", price: 2000, hotkey: "Q",
    desc: "One jump straight back to the surface pad.",
  },
  transmitter: {
    key: "transmitter", label: "Matter Transmitter", price: 10000, hotkey: "M",
    desc: "Beams one cargo hold to the Mineral Processor from anywhere.",
  },
  reserve: {
    key: "reserve", label: "Reserve Fuel Tank", price: 2000, hotkey: "F",
    desc: "Field refuel: 25 L, at eighty times the pump price.",
  },
  nanobots: {
    key: "nanobots", label: "Hull Repair Nanobots", price: 7500, hotkey: "R",
    desc: "Field repair: restores 30 hull integrity.",
  },
};

export const NANOBOT_REPAIR = 30;
export const REPAIR_COST_PER_HP = 15;   // Emendation Station 3500 service rate
export const FUEL_PRICE_PER_L = 3;      // Propellent Vendor 12000

// Ancient Blueprints: the six Goldium-only secret upgrades. Five are buried
// finds; the Multi-Drill is not buried at all -- the wiki's Ancient Blueprints
// page gives it as "Complete all 12 challenges in challenge mode without
// failing", granted on the NEXT new game. `buried: false` keeps it out of the
// world generator so the only way to hold it is to clear Challenge mode.
export const BLUEPRINTS = [
  {
    id: "hyperdrive", name: "Hyper-Drive Engine", depth: 4000, buried: true,
    desc: "Unlimited teleports home, and more thrust than the V16. Press Q.",
  },
  {
    id: "regenHull", name: "Regenerative Hull", depth: 3700, buried: true,
    desc: "180 HP, and it knits itself back together while you fly.",
  },
  {
    id: "wormhole", name: "Portable Wormhole", depth: 3700, buried: true,
    desc: "Cargo capacity becomes effectively unlimited.",
  },
  {
    id: "fuelIntegrator", name: "Fuel Integrator Tank", depth: 4000, buried: true,
    desc: "A 150 L tank, and gas pockets feed it. They still take the damage out of you.",
  },
  {
    id: "magmaConverter", name: "Magma Converter", depth: 3000, buried: true,
    desc: "Lava contact pays out cash. It still burns you down.",
  },
  {
    id: "multidrill", name: "Multi-Drill", depth: 0, buried: false,
    reward: "Clear all 12 challenges without failing.",
    desc: "Faster than the Amazonite Drill, and it cuts straight through solid rock.",
  },
];

export const FUEL_INTEGRATOR_LITRES = 150;   // wiki: "150 L capacity"

export function tier(line, index) {
  const l = LINES[line];
  return l.tiers[Math.min(index, l.tiers.length - 1)];
}
export function tierValue(line, index) { return tier(line, index).value; }
export function tierName(line, index) { return tier(line, index).name; }
export function nextTier(line, index) {
  const l = LINES[line];
  return index + 1 < l.tiers.length ? l.tiers[index + 1] : null;
}
