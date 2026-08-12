# MOTHERLOAD

A from-scratch browser recreation of **Motherload** (XGen Studios, 2004) — the Flash game where
you fly a mining pod into Mars, drill for minerals, and haul them back up to sell before your fuel
runs out. Vanilla ES modules, no build step, no dependencies, every pixel and every sound generated
in code.

## Run it

```
cd claude-code-test-motherload
python3 -m http.server 8000
# open http://localhost:8000
```

Any static server works. ES modules need `http://`, so opening `index.html` from the filesystem
will not load.

## Controls

| Key | Action |
| --- | --- |
| Arrows / WASD | Up thrusts. Down / Left / Right drill. **You cannot drill upward.** |
| X | Dynamite |
| C | Plastic Explosive |
| Q | Quantum Teleporter (or unlimited, with the Hyper-Drive blueprint) |
| M | Matter Transmitter — sell the hold from where you stand |
| F | Reserve Fuel Tank |
| R | Hull Repair Nanobots |
| E | Enter the vendor you are standing on (landing on a pad also docks) |
| I | Inventory |
| O | Options (volume, mute, controls, cheat entry) |
| ESC | Pause |
| Space / click | Advance a transmission, confirm a menu |

Fly into the **Quantum Particle State Analyzer 6000** — the bot hovering over the Mineral
Processor — to save. That is the original's save point, and it is the only one: there are no
underground save stations.

Sideways drilling needs footing. Explosives, the teleporter and the transmitter only work on the
ground. Type a cheat code on the title or pause screen (`blingbling`, `digdug`, `ntouchable`, …) —
it works, and it disables saving, exactly as the original punished it.

## What is in it

**Two modes**, as the original names them. **Adventure** is the main game. **Challenge** is twelve
timed objectives with their own screen, their own loadout per objective, and one reward: clear all
twelve without failing and every new game after that starts with the Multi-Drill.

**The loop.** Fuel is money. You drop a shaft, fill the cargo bay, fly back up, sell at the Mineral
Processor, refuel at the Propellent Vendor, buy a tier at Autobuy 2000, and go deeper. Depth gates
the minerals: Ironium at the surface, Amazonite below -5,500 ft.

**The world.** 32 blocks wide by 584 deep — 400 ft across and 7,300 ft down, at 12.5 ft per block,
which is the original's own geometry. Digging stops at an impenetrable barrier at -7,300 ft. There
is a gap in it on the far right.

**Four vendors, not one shop.** Propellent Vendor 12000 (fuel at $1/L), Mineral Processor 3000
(sell), Autobuy 2000 (the six upgrade lines), Emendation Station 3500 (repair at $15/HP plus six
consumables). Each is its own building on the surface; the screen has tabs so you are not forced to
taxi between them.

**Hazards that mean it.** Lava pockets are visible from -3,000 ft and hit for 58 HP before your
radiator. Gas pockets from -4,750 ft are the cruel one: they look *exactly* like soil, so the only
warning is that minerals never hide one. Their damage scales with depth and outruns the best hull
if you have no radiator. Undrillable rock starts at -1,500 ft and no drill in the shop cuts it —
that is what dynamite is for. Falling damage is a fixed table capped at 8 HP, so a long drop hurts
but never kills a healthy pod outright.

**Ancient Blueprints.** Six upgrades no money can buy. Five are buried finds: Hyper-Drive
(unlimited teleports home), Regenerative Hull (180 HP, self-repairing), Portable Wormhole
(unlimited cargo), Fuel Integrator (a 150 L tank), Magma Converter (lava pays out). The sixth, the
**Multi-Drill** — the only drill that cuts solid rock — is not buried anywhere: it is Challenge
mode's reward, exactly as the original has it.

**The story.** Mr. Natas hires you, pays depth bounties at -500 / -1,000 / -3,500 ft, and orders
you to stop at -6,000. Two doomed pods radio in on the way down; one of them dies mid-sentence.
Below -5,813 ft your altimeter garbles to `?xxxxx ft` because he is jamming it. Through the gap in
the barrier the readout flips to **-66,666 ft** and the boss fight starts: two forms, 1,000 then
2,000 HP.

**You cannot drill him.** Explosives are the only thing that hurts Mr. Natas, and a charge only
arms on solid ground, so the fight is: close in, land, plant, run. A Plastic Explosive at his feet
is 240; one crater-width away is 120; further out is 60. Dynamite tops out at 120. Ramming does
nothing except hurt you and bounce the pod, and while it is bouncing you cannot arm a charge or
teleport. The chamber's ceiling is a soft boundary: three squares above it the monocle laser still
reaches you but the form-2 claw does not, and four squares up abandons the fight and heals him back
to full. No pause, no inventory, no options while he is alive.

**New Game+.** Beating him hands you a Satan's Head and starts the next cycle, up to 99 of them.
With *x* heads: minerals pay `1/(x+1)`, digging scores `x+1`, and both of his forms carry `x+1`
times the health and deal `x+1` times the damage. It rounds down, so Ironium is worth $0 from cycle
32 on. Cash, upgrades and items are stripped each cycle.

**Easter eggs.** The Martian Oilers craft at about -500 ft grants the Oil-Bird, which pays you for
digging plain dirt. Fly 10,000 ft *up* and a voice hands you the Guardian, which halves all damage.
Fly to 100,000 ft for a verdict on your time management.

**Persistence.** localStorage. The Quantum Particle State Analyzer 6000 hovering over the Mineral
Processor is the save point; docking at a vendor also writes one, as a convenience. Score is
deliberately not persisted, because the wiki says the analyzer "immediately resets your score".
Dying costs you the hold and rolls you back to that save — including the tunnels you dug since,
which is what the original does.

**Options and Inventory.** `O` and `I`, both screens the original has. Options carries master /
music / SFX volume, mute, the control reference and the cheat-code field. Inventory shows
consumables, fitted hardware, which blueprints you have found, the eggs, your Satan's Heads and the
manifest. Both are locked out during the boss fight, as in the original.

## Technical approach

### Renderer: 2D canvas, not three.js

`vendor/three.module.min.js` is vendored as the brief requires, and unused. Motherload is a flat
grid of coloured blocks with a chunky Flash UI, and 2D canvas is the closer instrument:

- **Procedural texture is trivial and free.** Every tile's grain, each mineral's faceted crystal,
  the vendor shopfronts, the pod, Mr. Natas and his monocle are all drawn with canvas paths at boot
  into offscreen canvases. In WebGL the equivalent is a texture-atlas pipeline plus shaders.
- **The lighting model is two composite operations.** Darkness is one black fill on an offscreen
  canvas; the pod lamp, lava, ore glints and the boss punch holes in it with `destination-out`;
  the result is blitted over the frame and a warm `lighter` pass sits on top. That is three lines
  of intent versus a light-accumulation pass.
- **Text is free.** A HUD, four vendor screens with tab strips and hit-testing, and typewriter
  transmissions all want `fillText` and rectangles.

The cost is no free zooming or rotation, and per-pixel effects are off the table. Neither is a
Motherload feature.

### Deep-world performance

The world is 32 × 617 tiles (19,744 cells), stored as five flat typed arrays — `type`, `ore`,
`art`, `gas`, `tint` — indexed `r * width + c`. No per-tile objects, so generation is one pass and
there is nothing to garbage-collect while playing.

Drawing is chunk-cached. Tiles are painted in 8×8-tile blocks (384 px) onto offscreen canvases,
then blitted. A frame draws roughly a dozen `drawImage` calls instead of ~250 tile paints, and each
tile's grain, crystals and rim shading are rasterised once rather than every frame. Digging calls
`markDirty`, which invalidates that chunk plus any neighbour whose edge shading changed; the next
frame repaints just those. An LRU of 72 chunk canvases (~10 MB) caps memory as you descend — the
grid is only 4 chunks wide, so the resident set is always the shaft you are in.

Everything else is depth-windowed: the lava shimmer, the light punches and the collision probes all
iterate only the tile rectangle the camera covers.

### Files

| File | Responsibility |
| --- | --- |
| `src/main.js` | Game shell: state machine, input, event hooks, items, explosions, save cadence |
| `src/world.js` | Tile grid, generation, digging, hazard and blueprint seeding, the barrier and arena |
| `src/pod.js` | Thrust physics, tile collision, drilling, fuel, hull, lava contact |
| `src/render.js` | Camera, chunk cache, strata painting, lighting, surface, arena dressing |
| `src/textures.js` | Every generated sprite: pod, drill frames, crystals, artifacts, shopfronts, strata palette |
| `src/ore.js` | Mineral and artifact tables, depth-banded spawn rolls |
| `src/upgrades.js` | The four shops' catalogues, blueprints, repair and fuel rates |
| `src/shop.js` | Vendor screens, hit-testing, purchase handling |
| `src/hud.js` | HUD, transmissions, portraits, title / death / victory / pause |
| `src/boss.js` | Mr. Natas: two forms, attack patterns, damage |
| `src/story.js` | Transmission script and trigger logic |
| `src/particles.js` | Pooled particles and floating text |
| `src/audio.js` | WebAudio synthesis: three-bus mixer, drill loop, thruster noise, cues |
| `src/music.js` | The soundtrack: a step sequencer over synth voices, one scene per depth band |
| `src/challenge.js` | The twelve objectives, their loadouts, world shaping, the run's state |
| `src/challenge-ui.js` | Challenge list, the in-run objective strip, the cleared/failed panel |
| `src/screens.js` | The Options and Inventory screens |
| `src/settings.js` | Volume and mute, persisted separately from the save |
| `src/save.js` | localStorage serialisation, including the dug-tile diff |
| `src/rng.js` | Seeded RNG and value-noise fbm |
| `src/ui.js` | Bevelled panels, meters, buttons, money formatting |
| `src/config.js` | Every tunable in one place |

### Decisions made without the original in front of me

- **Cargo units.** The wiki gives mineral weights of 10-120 kg against bay capacities of 15-120
  cu ft, which would let the top bay hold one Amazonite. Weights are divided by 10 here, preserving
  the ratios: Ironium 1 unit, Amazonite 12, Micro Bay 10.
- **Gas damage sign.** The published formula reads `((depth + 3000) / 15)`, but the same page's
  worked values (180 HP at -5,700 ft, 287 HP at -7,300 ft) only come out with `- 3000`. This build
  uses `- 3000`.
- **Lava hits once per contact**, not twice. The sources say "damage twice" and also that a Steel
  Hull (50 HP) plus a Single Turbine (43 damage) is the minimum survivable loadout. Only one hit
  per touch satisfies both.
- **Fuel burn rates** are undocumented. They are set so the stock 10 L tank gives about 30 seconds
  of digging, which is the one anchor the sources do give.
- **Strata colours by depth** are undocumented anywhere. The palette here is invention: rusty
  topsoil, a pale clay band, cool grey stone, then hot red crust near the core.
- **Transmissions do not pause the game.** In the original they are modal popups. Here they overlay
  the bottom of the screen and auto-advance, so a transmission never freezes you mid-fall.
- **The three Challenge mazes.** The wiki names them only as 1st, 2nd and 3rd maze, with 1:00 / 2:00
  / 5:00 on them. No layout is described anywhere, so these are recursive-backtracker mazes carved
  into undrillable rock at 9×7, 13×12 and 15×22 cells, biased downward so gravity helps.
- **What "better equipment" means per challenge.** The wiki says only that "every few challenges you
  get better equipment to make goal reachable". The twelve loadouts here are invented, climbing from
  a Silvide Drill and a 25 L tank to the top of every line by challenge 12.
- **Per-attack damage in the boss fight.** Nothing published gives numbers. The wiki gives a
  relative scale in repair kits — a contact hit ~3, passing through him ~2, a laser hit 3-4 — so the
  numbers here are that ratio against a 30 HP nanobot kit: 90 / 60 / 105, claw 120, fireball
  150/sec.
- **The music.** The nine Goldium Edition track titles are sourced and the scenes are named for
  them, but no composer is credited anywhere for the 2004 game and no source describes the music
  itself. Every note is invented.

### The viewport: a fixed stage, scaled

The backbuffer is a fixed 960×600, and CSS scales it up to fill the window while preserving its
aspect ratio — the same thing the Flash player did with the original's fixed stage. It is scaled
rather than letterboxed at 1:1 because the alternative is a small picture in the middle of a modern
monitor, and it is scaled rather than made responsive because every screen in the game is
hand-placed against those exact 960×600 coordinates: the HUD, four vendor screens, twelve challenge
rows, the boss bar. Pointer input maps back through `getBoundingClientRect`, so nothing inside the
game ever sees the scale factor.

### Probes

```
node probes/scenarios.mjs             # 32 scenarios
node probes/scenarios.mjs boss-phase  # or any subset, by name
```

Each one spawns a fresh page, clears localStorage, drives the real game loop through
`window.__game`, asserts on observed state rather than on source reading, screenshots to
`screenshots/s-<name>.png`, and fails on any page or console error. They cover the surface, a dug
shaft, the no-upward-drill rule, dynamite, lava, gas, all four vendor screens and a purchase, both
new screens, every challenge kind, the barrier gap, the boss's damage tiers and both forms, the
ceiling reset, the interface lockout, victory, New Game+ arithmetic, death and rollback, and the
music's depth bands. Run them after touching movement or drilling: `tunnel` and `no-up-drill` are
the ones that catch a regression there.

`FIDELITY.md` has the full feature-by-feature accounting, the ore and upgrade tables, and where each
number came from.
