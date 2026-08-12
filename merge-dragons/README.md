# Merge Dragons — a browser tribute

A from-scratch browser recreation of **Merge Dragons!** (Gram Games / Zynga, 2017): a tile board
where matching three or more identical objects merges them into one of the next tier, merging
life-giving objects heals grey Dead Land, and dragons hatched from merged eggs wander the board
harvesting on their own.

All art is generated in code. There are no image files, no audio files, no build step, no
dependencies.

## Run it

Any static server, from the project root:

```
python3 -m http.server 8000
# then open http://localhost:8000/
```

Opening `index.html` directly with `file://` will not work — it uses ES modules, which browsers
only load over HTTP.

Two URL flags:

| Flag | Effect |
| --- | --- |
| `?debug` | Boots straight into Camp with a healed, richly populated board and 10 dragons. Used by the verification harness so a screenshot always shows a full scene. |
| `?level=N` | Boots straight into level N (1–15). |

`atlas.html` is a development tool, not part of the game: it renders every one of the 836 item
sprites in a labelled grid so the art can be audited in one pass. It is how the rock, life-tree and
Gaia-statue painters got fixed. `node tests/atlas-crop.mjs lifeFlower stone hill` renders named
chains at four times the size when one family needs a closer look.

## Controls

- **Drag** an object onto two or more identical ones to merge. While dragging, every object that
  will join the merge is outlined in white — count 5 outlines for a 5-merge.
- **Tap** a grown plant to harvest it, a Life Orb to smash it, a chest to open it, a Nest to hatch it,
  a bramble to clear it.
- **Drag a dragon onto an object** to task it with harvesting or attacking that object.
- **Drag empty land** to pan. **Scroll** to zoom.
- **Tap a Leftover pile** to collect what your storage will now take; the number above it is what it
  still holds. **Tap a Dimensional Jar** to open it for Dragon Gems or sell it for 50 coins. **Tap a
  statue, idol or topiary** once for a dragon egg. **Tap a Soul Crystal**, with two grown dragons of
  different breeds on the board, to breed a third breed.
- The bottom-left Object Information Bar names whatever is selected, quotes its in-game description,
  gives its position in its merge chain, and its action button states what a tap will do
  ("Shake the Tree", "Smash Orb", "Hatch the Nest").

## Why 2D canvas and not three.js

three.js is vendored at `vendor/three.module.min.js` as the brief requires, but the game does not
use it. Merge Dragons is a flat, axis-aligned tile board of hand-illustrated props viewed from a
high angle. Every rendering problem it poses is a 2D problem:

- **The art is illustration, not geometry.** The look comes from layered gradients, bezier petals,
  soft rim light and painterly speckle. Canvas 2D expresses all of that directly. Reproducing it in
  three.js would mean rendering these same 2D canvases to textures and drawing them on quads — the
  same code plus a WebGL layer that buys nothing.
- **Drag-and-drop is exact in 2D.** Screen-to-tile is two divisions (`s2t` in `render.js`). No
  raycasting, no camera-projection inversion, no depth ambiguity when a tall tree overlaps the tile
  behind it.
- **The organic land shape needs path unions, not meshes.** The seamless grass mass is one canvas
  path of ~200 overlapping blobs filled in a single operation — a mesh equivalent would need CSG.

A mild vertical squash (76 px wide tiles, 68 px tall) plus objects anchored at the bottom of their
tile with a contact shadow gives the slight top-down-angle feel of the original without a real
isometric projection, which the original does not use either.

## Technical approach

### Modules

| File | Responsibility |
| --- | --- |
| `src/registry.js` | All item data: 104 merge chains, 836 items, the merge-yield and ejected-spare table, 20 dragon breeds |
| `src/artlib.js` | Drawing primitives: colour maths, blobs, petals, leaves, glows, contact shadows, deterministic RNG |
| `src/sprites.js` | The first 46 procedural painters (one per art family) plus the sprite cache |
| `src/sprites2.js` | 35 more painters plus 16 rewrites: the second wave of chains, the high-tier silhouettes and the bespoke Wonders |
| `src/board.js` | The grid: land state, two occupancy layers, multi-tile objects, neighbour and group queries |
| `src/merge.js` | Merge resolution, the merge-5 bonus, chain-reaction combos, dead-land merging, by-products |
| `src/heal.js` | Healing Power distribution and Dead Land / Super Dead Land |
| `src/dragons.js` | Dragon state machine: idle, seek, harvest, carry, attack, rest |
| `src/levels.js` | 15 level definitions, quest objectives, board generators, world-map layout |
| `src/render.js` | Land bake, object blitting, effects, camera |
| `src/input.js` | Pointer handling: drag, snap, tap, pan, zoom |
| `src/fx.js` | Particles, floating numbers, rings, banners, screen shake |
| `src/hud.js` | DOM overlay: resource bar, quest panel, info bar, shop, book, world map, reward moment |
| `src/audio.js` | WebAudio synthesis: pentatonic merge bells, plucks, chimes, ambient pad |
| `src/save.js` | localStorage persistence |
| `src/main.js` | Mode switching, tick, tap/drop resolution, quests, rewards, storage caps, Dimensional Jars, breeding |
| `tests/` | Seven headless checks (merge table, registry audit, economy, full loop, UI, dragons, sprite atlas) plus two screenshot tools |

### How the merge-chain data is structured

A chain is an ordered array; merging N copies of `items[i]` yields `mergeYield(N)` copies of
`items[i+1]`. Every item is addressed by the string key `"<chainId>:<index>"`, which is what levels,
harvest targets, loot tables and save files store.

```js
reg(chain('lifeFlower', 'Life Flowers', 'flower', '#ff6f9c', [
  { n: 'Life Flower Seed',   lv: 0, w: 1, d: 'Merge to grow Life Flower Sprouts.', art: 'seed' },
  { n: 'Life Flower Sprout', lv: 1, w: 1, d: 'Merge to create a Life Flower.',     art: 'sprout' },
  { n: 'Life Flower',        lv: 2, w: 2, d: 'Harvest for Life Essence.',
    h: { item: 'lifeOrb:0', every: 9 }, heal: 1 },
  // ...
]));
```

Per-item fields drive behaviour with no code branching on names: `h` is a harvest yield and its
cooldown, `heal` is the Healing Power released when the item is merged, `tapHeal` / `tapCoins` /
`tapBricks` / `tapGems` are tap payouts, `spawns` is a passive spawner, `hatch` turns an item into a
tap-to-open Nest, `hp` makes it destructible, `taps` gives it a tap counter, `loot` gives it a loot
table, `size` makes it multi-tile, and `unmergeable` takes it out of merging entirely.

The merge-yield function reproduces the wiki's merging table by finding the best partition of N into
fives (worth 2) and threes (worth 1). The table's two lower rows matter as much as its yield row:

```
N        3  4  5  6  7  8  9 10 11 12 13 14 15 16 17 18 19 20
yield    1  1  2  2  2  3  3  4  4  4  5  5  6  6  6  7  7  8
ejected  .  1  .  .  1  .  .  .  .  1  .  .  .  .  1  .  .  .
wasted   .  .  .  1  1  .  1  .  1  1  .  1  .  1  1  .  1  .
```

A merge only spends 5 inputs per two outputs, or 3 for an odd one. An input it cannot spend is handed
back to the board rather than eaten — `mergeSpare` — so a 4-merge yields one of the next tier plus
the spare, and is never worse than a 3-merge. All 18 published columns are unit-checked and re-checked
through the real drag path in `tests/merge5.mjs`. Multiples of five remain the only zero-waste merges,
which is what makes "always merge in fives" correct here as in the original.

### How the art is generated

Every sprite is drawn once into an offscreen canvas, cached by `key|variant`, and thereafter blitted.

- **Shared primitives** (`artlib.js`): `blob()` builds an organic closed shape from n jittered lobes
  joined by quadratic curves; `petal()` and `leafPath()` are bezier forms; `litFill()` applies a
  top-lit vertical gradient to the current path; `groundShadow()` is a squashed radial gradient;
  `sparkle()` is a four-point star drawn in `lighter` composite mode.
- **Determinism**: each sprite seeds an xorshift RNG from a hash of its key, so a Giant Life Flower
  looks the same on every load while still being individually irregular.
- **Value structure over outline**: canopies are drawn as four stacked masses (dark under-mass, mid,
  lit crown, highlight) with leaf clumps breaking the silhouette. This is what stopped trees reading
  as flat lollipops. Rocks are faceted polygons with an explicitly lit top-left facet and a shadowed
  lower-right facet — as soft blobs they read as pots.
- **Tier expresses itself in the art**: a `growth()` factor derived from an item's index in its chain
  scales size and detail, so the same painter produces a modest Life Flower and a towering Life Tree
  of Cosmic Dreams. Higher tiers add petal rings, glowing orbs in the branches and sparkles.
- **Dragons** are drawn side-on from body/belly/wing colours held per breed, in three wing-flap
  frames × two facings, cached per breed and stage. Level-4 and Royal dragons get a crown. Size grows
  with stage.
- **The land** is the one thing not drawn per tile. Each region (playable, healed, super-dead) is
  compiled into a single canvas path of overlapping blobs and filled in one operation, so no tile
  seams exist. The bright edge around healed land is a canvas `shadowColor` on that fill, which
  silhouettes the union rather than each blob — layered offset fills instead leave visible arcs
  between diagonal neighbours. Texture (grass strokes, wildflowers, pebbles, cracks, dead twigs) is
  then drawn per tile clipped to the region path. The whole thing is baked once and re-baked only
  when land changes.
- **Sound** is synthesised: merges play a pentatonic triangle-wave bell whose root rises with the
  tier and stacks a fifth and octave, with two extra notes on a 5-merge; there is a convolution
  reverb built from decaying noise, and a slow four-chord ambient pad.

### Research

The item names, tier orders, healing-power values, dragon-power and stamina tables, coin worths,
rarity colours, region names and merge mechanics all come from the Merge Dragons Fandom wiki, read
through its MediaWiki API (`api.php?action=parse&prop=wikitext`) because the rendered pages refuse
plain fetches. `FIDELITY.md` lists the chains and what was verified against what.

## Decisions taken without being asked

- **Timings are compressed for a session you can actually play.** A Chalice returns every 30 seconds
  instead of every hour; harvest cooldowns are 9–23 seconds instead of minutes; dragons rest in about
  3 seconds per stamina point instead of minutes.
- **15 levels, not 564.** They are hand-authored across the real regions in map order (Grassy, Haven,
  Outskirts, Quarry, Hilltop, Zomblin Falls, Silent Bay, Shroomia, Dread Marsh, Prism Rift, Totem
  Shire, Drakeshire, Craven Crypt, Spell Shore) and escalate in board size, dead-land cost, Super Dead
  Land, Zomblins and Demon Gates.
- **20 dragon breeds, not ~260.** Each with the wiki's real tier-2 breed name and its own Dragon
  Power and Camp Stamina ladders, which differ per breed rather than sharing one table.
- **Storage caps start at 500 coins and 250 bricks.** The wiki publishes what each Coin Vault and
  Stone Yard adds but not the starting capacity, so these two numbers are chosen to bite inside one
  session. Past the cap, collections become Leftover Stones and Leftover Coins on the board.
- **Dragon Breeding unlocks at 250 Dragon Power, not 1,250**, and a Dimensional Jar stands for 75
  seconds, not an hour — the same compression as every other timer here.
- **The first run drops into Grassy 1** with the rules taught as on-canvas banners, the way the real
  game opens on its tutorial level. The full rules sit behind the `?` button.
- **Camp goals repeat.** The camp has no end, so its goal re-arms at a higher Dragon Power each time
  it is met.
