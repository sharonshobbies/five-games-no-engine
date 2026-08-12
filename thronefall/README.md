# Thronefall — a from-scratch browser recreation

A recreation of Grizzly Games' **Thronefall** (2023) in vanilla ES modules and three.js r169.
No build step, no bundler, no framework, no downloaded assets. Every mesh, every colour, every sound
effect and the whole score are generated in code — the music is a step sequencer over synth voices
running on the audio clock, not a loop played back.

## Running it

Any static file server works, because the game is plain ES modules:

```
cd claude-code-test-thronefall
python3 -m http.server 8080
# then open http://localhost:8080
```

`file://` will not work — ES module imports need an HTTP origin.

## Controls

| Input | Action |
| --- | --- |
| **WASD** / arrows | ride the king (camera-relative) |
| **Shift** | sprint — only works at full health, as in the original |
| **Space** | build/upgrade when standing on a plot, otherwise fire your weapon ability |
| **Left click** a plot | open its build panel from anywhere on screen |
| **Left Ctrl** / middle mouse | the original's command key: gather nearby soldiers and they follow. Keep holding it and they post up where they stand instead — a white circle marks each one |
| **R** | latching version of the same: gather, press again to release them where they stand |
| **H** | toggle hold-position for the group you already have |
| **F** | cycle which troops the command takes: melee → ranged → champions → everyone |
| **1**–**4** | pick one of those outright, and re-form the group around it |
| **Left Alt** | lock your auto-attack onto one enemy. It steps to the next when that one dies, and lets go after 2.5 s with nothing in reach. Godly Curse reads this lock |
| **Enter** | start the night |
| **Mouse wheel** / **Q** / **E** | zoom |
| **Esc** | close the panel, or pause |
| **1**–**9** on the overworld | jump straight into a holding |

Two debug keys, used to drive the verification harness and left in deliberately:
**P** dresses every empty plot for free, **O** jumps to the final night of the current map.

## The loop

**Day** has no timer. You ride around, stand on plots, and spend gold. **Night** starts only when
you choose it. Enemies march from the marked spawn points, attack whatever is in the way, and head
for the Castle Center. The sun rises when the last one is dead. If the Castle Center falls, the run
is over — the king dying only puts him down for ten seconds.

Gold arrives each morning from surviving economy buildings, plus whatever the night's dead dropped.
Buildings destroyed overnight are rebuilt free at dawn, so a night you barely survive costs you the
income, not the structure.

## What is in here

- **A drawn overworld.** `src/overworld.js` generates the realm as one SVG built the same way the
  3D terrain is: a seeded landmass triangulated into flat facets, each painted a single colour from
  its height and biome, with snow, desert and volcanic regions, mountain and forest silhouettes, and
  the holdings joined by roads that light up as they open. Every keep on it is drawn from polygons —
  there is no image anywhere in the game.
- **10 maps**, unlocked in sequence: Neuland, Nordfels, Durststein, Frostsee, Uferwind, Sturmklamm,
  Wildbach, Moorweg, Freifort, Totend. Each is a distinct biome with its own night count, spawn
  layout (some spawn points send only flyers), starting gold and difficulty multiplier. Frostsee
  ends with the Shadow in the Water; Sturmklamm wakes four Strange Statues and rains; Totend ends
  with the Corrupt King, who does not stand still.
- **16 building types** on fixed plots (17 with the Castle Center), each with real upgrade trees.
  Towers pick 1-of-4 at level 2 (Castle / Sniper / Armoured / Bunker) and 1-of-4 again at level 3
  (Archer's / Ballistic / Fire / Healing Spire).
  Mills lock in a speciality at construction (Improved Plow, Explosive Trap,
  Scarecrows, Wind Spirits). Garrisons lock in a unit type (Knights, Spearmen, Flails, Berserks /
  Longbows, Crossbowmen, Hunters, Fire Archers). The Castle Center picks 1-of-4 at level 2 and
  again at level 3, and that is where the king gets stronger. Each map carries only the buildings
  the original offers there: Fields on the first three holdings, the Bridge on Uferwind alone.
- **Multi-night research.** A **Blacksmith** or a **Royal Forge** commits to one project per level —
  chosen from four when you build it and again at every upgrade — and that project then runs for two
  or three *nights* before its buff lands. The smith buffs your army (melee or ranged damage, melee
  or ranged resistance), the forge buffs the king (attack cooldown, health, ability cooldown,
  damage). Projects repeat, run in parallel, and carry across the nights they span. One smith of
  each kind per holding: the developers cut Totend's second forge for exactly that reason.
- **Water you can build on.** Maps with a coast cut an inlet inland from the sea, narrow at the head
  and widening to the mouth, dropped into the widest gap between two approach roads so it never
  swallows one. **Fishing Harbours** stand on plots that genuinely touch it — dry ground with water
  within five metres — and pay per boat afloat, one new boat a night to a cap of five. A **Bridge**
  spans the neck: a real walkable deck that your troops, your king and the enemy all use.
- **21 enemy types** with the original's targeting rules: Racers beeline for the Castle Center and
  never stop for you, Hunterlings hunt only you, Wasps go for economy buildings, Ogres and Furies
  go for defences, Catapults and Rams for any structure, Exploders detonate on buildings, Flying
  Mages and Barrel Knights hunt your soldiers — and **Mole Archers and Mole Knights tunnel**, going
  under for a moment and surfacing up to thirty metres closer to whatever they want. Nothing can hit
  them while they are down.
- **Five bosses**: the Shadow in the Water, four Strange Statues at once, Elara the Vile, the Iron
  Castle, and the Corrupt King.
- **8 allied troop types** plus three champions (Golem, Support Mage, Firewing) — 11 in all.
- **9 weapons**, each with a passive auto-attack and a manual ability, all nine unlocked by
  clearing a specific map. Six have published stat tables and use them. Potion Vials, Battle Ax and
  Blood Wand have no published numbers anywhere, so they do what the patch notes and forum threads
  say they do — splash-heal your soldiers, grant four seconds of immunity, empty one target for a
  tenth of your own health — at numbers set by analogy with the other six.
- **29 perks** unlocked by account level, with the number of loadout slots itself an unlock.
- **15 mutators** whose score multipliers compound.
- **Eternal Trials**: the roguelike ladder, where each stage is a 1-of-3 draft of map + weapon +
  2 perks and the perks stack for the whole run.
- The original's **score formula**: per night, 100 for surviving plus up to 250 for keeping every
  structure (quadratic in the surviving fraction, each wall segment counting separately) plus up to
  250 for finishing fast, then `(base + gold×10) × (1 + mutator multiplier)`.
- Progression persists in `localStorage`: cleared maps, best scores, XP, account level, loadout.

## Technical approach

`src/` is one module per concern:

| File | What it owns |
| --- | --- |
| `main.js` | state machine, input, day↔night blend, frame loop |
| `render.js` | renderer, lights, the day→night lighting shift, sky dome |
| `camera.js` | the fixed-yaw near-isometric chase camera |
| `levels.js` | map table, procedural layout, heightfield, wave composition |
| `terrain.js` | terrain/water/decor meshes |
| `pathing.js` | Dijkstra flow field, uniform-grid neighbour lookup |
| `world.js` | plots, structures, units, combat, projectiles, dawn/dusk bookkeeping |
| `hero.js` | the king |
| `buildings.js`, `enemies.js`, `perks.js` | pure data tables |
| `art_buildings.js`, `art_units.js` | procedural meshes |
| `geo.js`, `fx.js` | geometry merging/outlines, particles, health bars, rain |
| `overworld.js` | the drawn realm map: landmass, biomes, facets, roads, keeps |
| `hud.js`, `save.js` | DOM, localStorage |
| `audio.js` | sound effects and the bus layout, synthesised per shot |
| `music.js` | the score: a lookahead step sequencer over synth voices |

### Getting the minimalist look

Five decisions do almost all of it.

1. **One merged, vertex-coloured geometry per archetype.** `geo.js` merges a list of primitives
   (boxes, cylinders, cones, spheres, a hand-rolled roof prism) into a single non-indexed
   `BufferGeometry` with a colour attribute baked per part. A knight, a windmill, the whole
   240-tree forest — each is one mesh with one material. That is what makes ~150 units at 120 fps
   possible, and it is also why the palette stays disciplined: colours live in `palette.js` and
   nowhere else.
2. **Flat shading everywhere, one colour per triangle on the terrain.** The terrain is built
   non-indexed with each triangle painted a single flat colour chosen from height, slope and two
   octaves of noise, with the diagonal alternating per cell so the facets do not form a visible
   grid. No textures anywhere in the game.
3. **Inverted-hull outlines.** `outlineGeo()` pushes every vertex out along its normal and the copy
   renders back-faces-only in near-black, added as a child of the mesh so it inherits the transform
   for free. This is the single biggest contributor to reading the scene at a glance — the original
   leans on silhouette rather than detail, and outlines are how silhouette survives a busy night.
4. **A hard day/night lighting inversion, not a colour filter.** Day is one strong warm directional
   light with sharp 2048² shadows over a light hemisphere. Night drops the directional to a dim blue
   moon, collapses the hemisphere, pulls the fog in by 100 units, and hands the lighting to seven
   warm point lights: six torches ringing the keep and one lantern that follows the king. Fire is
   drawn with an unlit material so it stays bright after dark.
5. **Faction emissive at night.** Allies and enemies use separate materials whose `emissive` lifts
   only as night falls — blue for yours, red for theirs. Daytime colour is untouched; after dark
   every unit still reads.

### How pathing works

One **Dijkstra flow field** on a 2 m grid, recomputed only when the set of blocking structures
changes (a build, an upgrade, a collapse) — a few milliseconds over ~12k cells, so it never touches
the frame budget.

The important choice: **walls are expensive, not impassable** (`+34` cost). The field therefore
always resolves, attackers naturally funnel through gaps and unbuilt plots, and a wall only gets
attacked when going around it would genuinely cost more than going through. Each frame a ground
unit reads the gradient at its cell; if the cell one step ahead is occupied by a structure, that
structure becomes its target. Water and slopes steeper than ~1.15 are hard-blocked at bake time.

Layered on top:

- Flyers ignore the field entirely and fly straight at their target.
- Units within ~30 m of their specific target steer straight at it, so the last approach is direct
  rather than grid-aligned.
- Separation comes from a uniform spatial hash — the same structure serves target acquisition, so
  "nearest enemy in range" is a bounded cell query rather than a scan.
- Once the spawn queue is empty and six or fewer enemies remain, the survivors abandon whatever
  wall they were chewing on, double their speed and charge the keep, with a rising smoke signal
  marking each one. A 30 s backstop clears any that still cannot reach. Without this a single
  peasant with 1 damage can hold an iron gate — and the night — open indefinitely.

### The score

`music.js` is a **step sequencer over synthesised voices, scheduled against the audio clock**. No
sample files, no `setTimeout`: each frame the sequencer queues every sixteenth that falls inside a
0.35 s lookahead window and stamps it with an explicit `AudioContext` time. Frame rate has no effect
on timing, which matters at 130 enemies — a dropped frame delays the next *queueing pass*, never a
note. A tab stall is caught by a guard that re-bases the clock instead of firing a backlog.

Every scene is a 2- or 4-bar phrase: 16-step patterns for bass, arpeggio and melody, one chord per
bar, a drum kit, and a target gain per layer. Layers are always sequenced, so a layer at gain 0 is
silent but still running and a scene change is a crossfade rather than a restart. **Pattern swaps,
key changes, tempo changes and scene changes only ever happen on a bar line.** The step duration is
read before the swap, so the first step of a new scene lands exactly one old step after the last step
of the old one — a tempo change leaves neither a gap nor an overlap.

The whole score sits on one root, **D**, and moves by mode rather than by key:

| Scene | Tempo | Mode | Sound |
| --- | --- | --- | --- |
| `realm` | 68 | D Aeolian | realm map, title, loadout. Solo lute over an open fifth and bowed strings. No percussion at all, so nothing implies a clock. |
| `day` | 84 | D Dorian | build phase. Same root, raised sixth — one note brighter than the realm. Running lute figure, walking bass, unhurried frame drum, a horn phrase every other bar. |
| `nightfall` | 84 | D Aeolian | the cut. Two bars, hard in and hard out: war drums on the beat, a bell tolling the night, bass walking the descending tetrachord D–C–B♭–A. |
| `night` | 96 | D Aeolian | combat. Three pattern tiers by intensity. Bass ostinato, horn melody, drums escalating from frame to war. |
| `boss` | 108 | D Phrygian | the final night. Flattened second, choir, war drums on every beat, the fastest tempo in the score. |
| `victory` | 96 | D Mixolydian | two bars. Major third, flat seventh — bright without a key the rest of the score never visits. Bells and a rising arpeggio. |
| `defeat` | 60 | D Phrygian | two bars, half the tempo of anything else. One war drum a bar, a bell tolling down the Phrygian cadence A–E♭–D. |

Because the root never moves, every transition is consonant with the one before it and the drama
comes from mode, tempo and instrumentation. Twelve voices carry it: plucked bass, lute, reed horn,
bell, bowed pad, drone, choir, low pulse, frame drum, war drum, tambourine and snare, with a short
convolution tail fed only by the sustained and bell voices.

Three details worth naming:

- **The day→night cut is authored, not a fade.** Pressing Enter schedules a run-up — war-drum hits
  accelerating into the next bar line plus a noise riser that arrives with it — and the scene snaps
  on that downbeat. The transition therefore lands on a beat the player heard coming instead of
  wherever the keypress happened to fall.
- **The bell climbs with the night.** Its root rises one scale degree per night and stacks a fifth
  and an octave on top, so the toll that opens night 7 is audibly higher than the one that opened
  night 1.
- **`nightfall`, `victory` and `defeat` are one-shots.** Each declares its length in bars and its
  successor, and hands off on its own — nightfall to `night` or `boss`, the two stings back to
  `realm`.

Sound effects are unchanged and still live in `audio.js` on their own bus. Music has its own
persisted toggle (**Music: on/off** on the title screen and in the pause menu, stored as `musicOn`),
separate from the effects volume, and the context starts on first key or pointer input so autoplay
rules never block it.

## Calls I made on my own

- **Gates.** The original has no gate building; its walls are unbroken segments and you leave plots
  empty to make a funnel. I kept a Gate as a wall-plot option — your soldiers pass, enemies must
  break it — because it makes the funnel readable and gives the flow field something interesting to
  route around. It is the one building here that is not in the original.
- **Numbers.** Health, damage, attack rates, costs and point budgets come from the published wikis.
  Ranges are scaled by 0.7 to suit this map scale. Where the wikis conflict between the early-access
  and 1.0 tables I took the 1.0 values (king health 100, not 50).
- **Wave tables.** Per-map, per-night enemy lists are not documented anywhere. Nights are generated
  from the documented Eternal Trials difficulty-point costs against a budget that grows as
  `4 + 5·night^1.85` times the map's multiplier, capped at 132 concurrent enemies.
- **Three maps are documented only in outline.** Moorweg, Freifort and Totend have wiki pages that
  are not even in the sitemap. They give the order, the night counts (12 / 13 / 15), the boss names
  and the building lists, and nothing else — no biome, no spawn prose, no boss mechanics. I built
  them from what is there and invented the rest, with one exception: the Corrupt King leaps, which
  players report while complaining that the Blood Wand cannot land on him.
- **Three weapons have no published numbers at all.** Their behaviour follows the patch notes and
  forum descriptions; the numbers are mine.
- **The troop-type filter keys are mine.** Gather, follow, release and hold-position are the
  original's, on the original's key (Left Ctrl, distinguished by how long you hold it). `F` and
  `1`–`4` are what players asked the developers for in 2023 and were told would be "improved in the
  future"; whether they shipped is not documented, so I built them and labelled them in
  FIDELITY.md.
- **Moles underground.** The wiki gives the dig range, the cooldown and every stat, but not whether
  a tunnelling mole can be hit. I made them untargetable for the 0.7 s they are under, surfacing at
  the last walkable point on the line to their target.
- **The between-nights perk draft** in the brief is Eternal Trials, not the campaign — the campaign
  picks perks once before the run. I implemented both rather than moving the draft into the campaign.
