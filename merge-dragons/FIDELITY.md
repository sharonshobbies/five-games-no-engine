# Fidelity checklist

Honest accounting against Merge Dragons! (Gram Games / Zynga, 2017). `DONE` means the mechanic works
the way the original does at the scale this build attempts. `PARTIAL` means it exists but is
simplified or scaled down. `MISSING` means absent.

Source for every name, number and rule below: the **Merge Dragons Fandom wiki**
(`mergedragons.fandom.com`), read through its MediaWiki API — `api.php?action=parse&page=<Page>&prop=wikitext`
— because WebFetch on the rendered pages returns HTTP 402 and curl on them returns 403. The chain
roster came from `action=query&list=categorymembers&cmtitle=Category:Merge Chains`, which returns
601 pages; 84 non-dragon chains and 20 dragon breeds of those are implemented.

**Totals: 104 merge chains, 836 items, 20 dragon breeds, 21 Wonders.**
Previously 36 chains, 298 items, 6 breeds, 9 Wonders.

What is transcribed and what is not:

- **Transcribed**: every item name, tier order, size, rarity and coin worth; item descriptions where
  the wiki publishes one; Life Orb 4^n healing values; Stone Brick and Magic Coin worths; Dragon
  Power and Camp Stamina per breed (they differ per breed — Golem carries 1/4/16/55 where Grass
  carries 1/4/15/50, and Green holds twice Rock's stamina); Dimensional Jar gem prices from each
  chain's own "Jar Cost (Gems)" column; storage capacities (+5 up to +50,000); the merge yield,
  ejected and wasted rows of the Merging Table.
- **Written here, not transcribed**: all colour palettes (the wiki publishes art, not hex values);
  flavour text for the four chains whose wiki description column is empty (Zen Temples, Nirvana
  Temples, Magnificent Artefacts, Mystic Topiaries — names, levels, sizes, rarities and worths are
  still the wiki's); harvest cooldowns in seconds; base storage capacity (500 coins / 250 bricks,
  which the wiki does not publish); the compressed thresholds listed under "Decisions taken" in
  README.md.
- **Deliberately dropped**: the Glowing Dragon Trees chain stops at Legendary Glowing Dragon Tree.
  The wiki lists Remains of The Dragon God as that chain's Wonder as well as the Dragon Trees', and
  one object should not appear twice in the Book.

---

## Core mechanic

| Feature | Status | Note |
| --- | --- | --- |
| 3+ identical adjacent objects merge into the next tier | **DONE** | 8-neighbour adjacency, including diagonals, as in the original |
| A merge must be *actively dragged*, not just adjacent | **DONE** | Placement never auto-merges; `tryMerge` runs only from `drop` |
| 3 or 4 → 1 of next tier; **5 → 2** | **DONE** | Full wiki table reproduced: 3→1 4→1 5→2 6→2 7→2 8→3 9→3 10→4 13→5 15→6 20→8 |
| **Ejected object on a 4-merge** | **DONE** | A merge spends 5 inputs per two outputs, or 3 for an odd one; an input it cannot spend is handed back. The Merging Table's `Ejected X` and `Wasted X` rows are reproduced for all 18 published columns (`mergeSpare`, `mergeWasted` in registry.js): 4→1+1 spare, 7→2+1 spare+1 wasted, 12→4+1 spare+1 wasted. A 4-merge is no longer worse than a 3-merge |
| Merge-5 is the correct strategy | **DONE** | Multiples of five are the only zero-waste merges |
| Drag preview outlines every object joining the merge | **DONE** | White rounded outlines, so you can count 5 before releasing |
| Chain-reaction combo merges | **DONE** | Recursive, with an escalating on-screen `COMBO xN` and bonus healing |
| Combo produces a draggable Loot Orb carrying Healing Power | **PARTIAL** | A Life Orb is produced instead of a distinct combo Loot Orb |
| Merge by-products | **DONE** | Graves→Life Flower Seeds, Fruit Trees→Magic Coins, Dragon Trees→Essence, Mushrooms→Caps, Goal Stars→Treasure Chest, Wonder creation drops an (X−1) object, Bones→extra Sprouts |
| **Dimensional Jars** | **DONE** | A camp merge of a jar-spawning item can leave a jar holding a clone of what was just made; tap to open it for its published gem price or sell it for 50 coins; the jar expires. The spawn list and per-item prices are the wiki's |
| Non-mergeable objects (brambles, gates, nests, loot orbs, jars, leftovers) | **DONE** | `unmergeable` flag; Leftovers do not merge even with an identical pile, per the wiki's Trivia |
| Merge Preferences (Require Overlap / Allow Chain Reactions / Prefer 5-Merges) | **MISSING** | Chain reactions are always on |
| Push merge | **MISSING** | |

## Merge chains

84 non-dragon chains, 596 items. The 54 chains added in this pass:

| Chain | Tiers | Item names |
| --- | --- | --- |
| **Magic Mushrooms** | 11 | Magic Mushroom Caps · Magic Shroom Cluster · Stalk · Magic Shrooms · Green Dream · Blue Belly · Glowflap · Dragonfan · Alien (2×2) · Fantasy · **The Golden Mushroom** (Wonder #9) |
| **Midas Trees** | 13 | Golden Seeds · Sprouting Midas Tree · Golden Sapling · Golden Tree · Midas Tree · Glowing · The Orb Holder · The Crystal Catcher · The Moon Bearer · The Star Mother · Greater · Divine (1×2) · **Bearer of the World Crystal** (Wonder #15) |
| **Glowing Dragon Trees** | 8 | Young · Vermillion · Nice · Aged · Elder · Ancient · Arcane (2×1) · Legendary (2×1) |
| **Grimm Trees** | 11 | Grimm Seed · Sapling · Young · Small · Grimm Tree · Dark · Foreboding · of Dread · Chilling · of Fear (2×1) · of Despair (2×1) |
| **Shadow Trees** | 11 | Specter Leaf · Umbral Sprout · Dark Sapling · Crude · Somber · Sanguine · Ghastly · Argent · Livid · Eerie (2×2) · Lustrous (2×2) |
| **Spooky Trees** | 3 | Undead Tree · Deathly Hollow Tree · Spooky Old Tree; grow Necromancer Grass |
| **Haunted Houses** | 11 | Fresh Graveyard · Small Haunted Crypt · Crypt · Shack · House · Large · Manor · Mansion · Estate · Grand Estate (2×2) · Paranormal Purgatory (2×2) |
| **Zen Temples** | 13 | Small · Zen Temple · Nice · Large · of Peace · Tranquillity · Balance · Honor · Spirit (2×1) · Unity (2×1) · Grand Temple of Enlightenment (2×2) · Shangri-La (2×2) · **Shambala** (Wonder #14) |
| **Nirvana Temples** | 13 | Small · Nirvana Temple · Nice · Large · of Harmony · Serenity · Contentment · Glory · Life (2×1) · Wisdom (2×1) · Grand Temple of Life (2×2) · Utopia (2×2) · **Elysium** (Wonder #13) |
| **Honey** | 10 | Tiny/Small/Large Honeycomb · Classic/Fancy/Crystalized Honey Jar · Simple/Magnificent/Extravagant Beehive · **Sanctuary of Bees** (Wonder #16) |
| **Chocolate Fountains** | 10 | Cocoa Bean · Trio · Sprout · Sweet Bloom · Flavorful Flower · Soothing Sculpture · Scrumptious Statue · Fancy Fountain · Delightful Cascade (2×1) · **The Chocolate Spring** (Wonder #20) |
| **Fungus Logs** | 2 | Fungus Log · Sporewood |
| **Wood** | 4 | Elderwood · Stack · Bundle · Tiny Cabin for Hedge Gnomes (2×2) |
| **Golden Apples** | 3 | Golden Apple · Giant · of the Cosmos (2×2) |
| **Wildberries** | 3 | Tiny Blue · Blue · Juicy Blue Wildberry |
| **Crystal Fruit** | 10 | Emerald · Moonstone · Amethyst · Ruby · Tourmaline · Topaz · Garnet · Rose Quartz · Gemstone · Crystal Fruit |
| **Seashells** | 10 | Tiny · Medium · Large · Huge · Uncommon · Rare Spiky · Rare Golden · Sea Maggot · Legendary · Giant Red Crab Shell (2×2) |
| **Starfishes** | 10 | Tiny Pink · Uncommon Red · Large Purple · Island · Sea · Ocean · Rare Sun · Rare Moon · Epic Dark (2×2) · Epic Planet (2×2) |
| **Fairy Houses** | 10 | Tiny · Fairy Neighbour · House · Deluxe · Villa · Tower · Wizard Tower · Manor (2×2) · Castle (2×2) · Epic Fairy Kingdom (2×2) |
| **Fairy Mushrooms** | 10 | Tiny Red Spotted · Red Spotted · Uncommon Purple · Magic Blue · Rainbow · Mushroom Flower · Bloom · Mystic Blue · Mystic Mushrooms · King Mushroom (2×2) |
| **Gnomes** | 7 | Pinecone · at Home · Chrome · Roaming · Dozing · Gloam · Glowing Throne Gnome |
| **Lost Treasures** | 5 | Kala's Fire & Ice Pendant · Emperor Dragon Plume · Liquid Gem · Pearl of the Shadow World · **Crown of the Dragon Empress** |
| **Magnificent Artefacts** | 5 | Soul Crescent · Elemental · Surging Light · Midnight · **The Last Relic Artefact** (Wonder #17) |
| **Healing Goddesses** | 5 | Minor · Goddess of Healing · Strong · Greater · Healing Goddess of Legend; emit the wiki's 3/10/38/128/450 Healing Power per cycle |
| **Ornate Gold Statues** | 7 | Ornate Llama · Jeweled Tortoise · Lavish Toad · Halcyon Cougar · Aureate Deer · Gilded Rhino · Paragon Dragon (2×2) |
| **Jeweled Precious Statues** | 5 | Sapphire Eagle · Emerald Lion · Aquamarine Wolf · Ruby Bear · Amethyst Peacock (2×2) |
| **Monster Idols** | 5 | Kattryx · Guardian Sphinx · Young Cerberus (2×1) · Noble Gryphon (2×1) · Mythical Ogopogo (2×2) |
| **Mythical Idols** | 5 | The Gromblin · The Capricorn (2×1) · The Dragon Idol (1×2) · The Rising Phoenix (2×1) · The Mythical Pegasus Idol (2×2) |
| **Mystic Topiaries** | 8 | Bunny · Bear · Rex · Magnificient Rose Swan · Seahorse · Dolphin · Lilac Unicorn · **Magnificent Dragon Topiary** (2×2) |
| **Lobelia Topiaries** | 8 | Cobalt Cottontail · Sweet Grizzly · Delphinium Dino · Winged Orchid · Aquatic Indigo · Celestial Fin · Enchanted Horn (Wonder #18) · **Blushing Wyvern Topiary** (2×2) |
| **Crystal Trees** | 6 | Cerise Yew · Amber Oak · Coral Aspen · Lavender Ash · Plum Willow · Crimson Elm (2×2) |
| **Spiritual Trees** | 6 | Bamboo Shrub · Budding Blossom · Mountain Fir (2×1) · Blessed Redwood (2×1) · Aquamarine Bead (2×2) · Violet Cypress (2×2) |
| **Opal Trees** | 3 | Sacred Fir (2×1) · Blessed Sequoia (2×1) · Holy Inabe (2×2) |
| **Passion Trees** | 10 | Passion Tree Seed · Planted · Sprout · Young · Growing · Blooming · Full · Entwined · Kissing (2×2) · Lovers' Embrace (2×2) |
| **Forgotten Flowers** | 10 | Lost Bud · Sunday Flower · Twin Flowers · Three Graces · Moonflower · Plumeria · Apollo's Bloom · Athena's Flowers · Aphrodite's Vase · Zeus's Cup (2×2) |
| **Mystic Lanterns** | 10 | Drum Lamp · Lampion · Trio of Lampions · Lotus · Jade Turtle · Festive Carp · Sensuous Swan · Happy Panda · White Tiger · Furious Dragon Lamp (2×2) |
| **Bonus Points** | 13 | 3 · 10 · 30 · 90 · 300 · 900 · 2,700 · 8,500 · 25,500 · 76,500 · 250K · 750K · 2.25M Points |
| **Wishing Well Coins** | 5 | Schilling · Denarius · Sovereign · Ryal · Aureus |
| **Gemsteel** | 6 | Essence · Unrefined Ore · Molten Pit · Refined · Furnace · Gate (2×2) |
| **Lightcrystal Veins** | 6 | Depleted / Drained / Minor / Conjurer / Enchanted / Mighty Conjurer Stone |
| **Mystic Trees** | 6 | Depleted / Drained Conjurer Log · Conjurer Shrub · Tree · Enchanted · Mighty (2×2) |
| **Mystic Plants** | 7 | Mystic Sprouts · Small / Enclosed Fungal Garden · Terrarium · Overflowing · Bustling · Fungal Greenhouse (2×1) |
| **Ruined Fountains** | 6 | Depleted / Drained Conjurer Puddle · Minor / Conjurer / Enchanted / Mighty Conjurer Fountain (2×2) |
| **Secret Fountains** | 2 | Secret Lifespring · Spectral Lifespring (1×2) |
| **Misty Mountains** | 2 | Cloudy Summit (2×1) · The Misty Mountain (2×2) |
| **Small Fluffs** | 4 | Ground · Soft · Round · Snug Fluff |
| **Spirit Rose** | 3 | Thorny Bloom · Dark Rose · Spectral Rose Bush |
| **Precious Frogans** | 3 | Frogan Egg · Tadpole · Splendid Frogan |
| **Super Eggs** | 3 | Super Egg Fragment · Super Egg · Active Super Egg |
| **Basic Soul Crystals** | 4 | Shard · Small · Medium · Large Basic Soul Crystal; the breeding currency |
| **Magic Coin Storage** | 8 | Tattered · Basic · Nice · Great · Opulent · Mythical · Gigantic (2×1) · Bottomless Coin Vault (2×2) |
| **Stone Storage** | 8 | Tattered · Basic · Nice · Great · Opulent · Mythical · Gigantic (1×2) · Bottomless Stone Yard (2×2) |
| **Leftovers** | 2 | Leftover Stones · Leftover Coins |
| **Dimensional Jars** | 1 | Dimensional Jar |

The 30 chains from the first pass are unchanged: Life Flowers (19), Life Orbs (10), Grass (10),
Living Stones (11), Stone Bricks (9), Magic Currency (9), Dragon Trees (13), Fruit Trees (13),
Prism Flowers (11), Treasure Chests (7), Goal Stars (6), Water (9), Mushrooms (12), Bushes (6),
Graves (8), Dragon Homes (8), Dragon Gems (3), Dragon Stars (2), Autumn Trees (11), Dragon Essence
(7), Bulbs (8), Hills (11), Gaia Statues (4), Demon Gates (4), Zomblins (4), Heal Extenders (1),
Loot Orbs (1), Bones (2), Skulls (4), Brambles (3).

| Feature | Status | Note |
| --- | --- | --- |
| Chain coverage | **PARTIAL** | 104 of the wiki's 601 merge-chain pages. The remainder is event and season content (Christmas, Easter, Halloween, Carnival, Sakura, roughly 40 event "Chests / Generators / Objects" triples) plus the premium and Arcadia families |
| Wonders | **PARTIAL** | 21 of 22 real Wonders terminate their chain, each announced with a banner and an (X−1) by-product. Wonders still cannot be tapped for periodic rewards |
| Conjurer chains spawn what they say they conjure | **DONE** | Mystic Trees → Mystic Plants, Lightcrystal Veins → Gemsteel and Essence, Ruined Fountains → Lost Treasures, per each row's own description |

## Dead land and healing

| Feature | Status | Note |
| --- | --- | --- |
| Grey Dead Land vs saturated healed land | **DONE** | Desaturated violet-grey with cracks and dead twigs against warm saturated grass with wildflowers |
| Each dead tile has a Healing Power cost; tapping shows it | **DONE** | Per-tile cost set per level; tapping floats the remaining requirement |
| Partial healing accumulates across applications | **DONE** | `paid` per tile, shown as a rising pool of light |
| Healing Power cannot be aimed, prioritises nearby tiles | **DONE** | Poured into the frontier of dead tiles touching healed land, nearest first |
| Merging Life Flowers / Prism Flowers / high Dragon Trees releases Healing Power | **DONE** | Per-item `heal` values scale with tier |
| Tapping a Life Orb releases its Healing Power | **DONE** | And it is consumed |
| Merging objects standing on Dead Land heals that land free | **DONE** | The cost is ignored entirely |
| Super Dead Land | **DONE** | 15,000 per tile hidden cost, so in practice only merge-off or a Heal Extender clears it |
| Heal Extenders | **DONE** | Must itself be healed first, then heals 4 orthogonal neighbours |
| **Healing Goddesses** | **DONE** | Five tiers emitting the wiki's 3/10/38/128/450 Healing Power per cycle on their own timer; the wiki's minutes are played as seconds |
| Healing Power damages Zomblins | **DONE** | Damage equal to the power released, within range |
| With no dead land left, Healing Power converts to score/coins | **PARTIAL** | Converts to coins rather than the original's Score, and is now subject to the coin cap |
| Hidden objects revealed by healing | **DONE** | Buried objects surface the moment their tile becomes live |
| Camp Evil Fog cleared by Dragon Power | **DONE** | Fogged camp tiles show their Dragon Power threshold |

## Economy

| Feature | Status | Note |
| --- | --- | --- |
| **Storage caps on coins and bricks** | **DONE** | The resource chips read `have/cap` and turn red at the cap. Base 500 coins / 250 bricks, this build's numbers |
| **Coin Vaults and Stone Yards raise the cap** | **DONE** | Both 8-tier chains, with the wiki's +5 / +20 / +75 / +250 / +800 / +2,500 / +10,000 / +50,000 and its base build costs; they also tap for their own currency on a cooldown |
| **Leftover Stones and Leftover Coins** | **DONE** | Collecting past the cap leaves a pile carrying the uncollected amount, drawn above it. Tapping takes only what fits, so a full store refuses the pile outright; nearby overflow folds into one pile; they never merge |
| **A gem sink** | **DONE** | Two: Dimensional Jars at the wiki's per-item price (8 to 600 gems), and the Chest of Soul Crystals at the wiki's 99 gems |
| Currencies: Coins, Stone Bricks, Dragon Gems, Dragon Power, Chalices | **DONE** | |
| Selling objects for coins | **DONE** | Wiki sell values; sale income is capped like any other |
| Real-money purchases | **MISSING** | Deliberately. The pressure is modelled, the paywall is not |
| Dimensional Jar sizing | **PARTIAL** | Every jar is 1×1; in the original the jar takes the size of the object inside |

## Dragons

| Feature | Status | Note |
| --- | --- | --- |
| Merge 3 eggs to hatch a dragon | **DONE** | Eggs are a chain entry; merging them yields a Whelp |
| Lifecycle Whelp → Kid → Dragon → Noble/Adept, levels 5–6 skipped | **DONE** | Merging three level-4 dragons produces a tier-2 **Nest** |
| **20 breeds** | **PARTIAL** | Grass→Sunset, Green→Twilight, Rock→Mountain, Crimson→Sapphire, Spotted→Citrus, Toadstool→Amanita, Golem→Golden, Sharp→Sentinel, Gargoyle→Beast, Nature→Bloom, Cactus→Prickly, Chameleon→Rhampholeon, Sun→Aurora, Moon→Eclipse, Star→Supergiant, River→Rain, Terra→Stone, Life→Afterlife, Prism→Spectrum, Rose→Blossom. Each carries its own transcribed names, Dragon Power and Camp Stamina ladders, including the irregular ones: Sharp and Gargoyle are Vicious / Fierce / Almighty / Supreme, Prism has Birthlings not Whelps, Life evolves into "Afterlife Eggs" not "Afterlife Dragon Eggs". The original has ~260 breeds |
| **Dragon Breeding** | **PARTIAL** | The wiki's Soul Tree rule: tapping a Basic Soul Crystal with two level-3+ dragons of different breeds on the board produces a dragon of a *third* breed, and the parents are not consumed — "unlike merging, combining Dragons won't use them up" — so no dragon's autonomy state is disturbed. Crystal level sets the result (1→Egg, 2→Whelp, 3→Kid). Gated on Dragon Power, at 250 here against the real 1,250. The Soul Tree island, the Breeding Portal and its quests, Shiny and Flawless crystals and the second Crystal Chamber are absent |
| Dragons autonomously wander and harvest | **DONE** | idle → seek → harvest → carry → drop, plus rest and attack. Verified: 10 of 10 dragons moved in a 14-second headless run |
| Dragons carry the harvested item at reduced speed | **DONE** | 55% of walk speed; the carried item is drawn above the dragon |
| Only 2 dragons harvest at a time on their own | **DONE** | Wiki-stated cap |
| 1 Stamina spent per harvest; out of stamina they sleep | **DONE** | Stamina pips under each dragon |
| Dragon Homes rest dragons, higher tiers faster | **DONE** | One dragon per home |
| Dragon Power total unlocks land | **DONE** | Drives the camp's Evil Fog and the camp goal |
| Dragon Types (Builder, Defender, Harvester, Trophy, Worker, Zoomer) | **PARTIAL** | Assigned per breed from the wiki's own `dragon_type`; they change harvest speed, move speed and hostile preference. Trophy dragons correctly get no bonus. The fuller type effects are not modelled |
| Defenders attack Zomblins and Demon Gates with fireballs | **DONE** | Damage scales with Dragon Power |
| **Statues, Idols and Topiaries tap once for an egg** | **DONE** | Every row whose description says "Can Tap once for an Egg" does exactly that, then stays mergeable |
| Drag a dragon onto an object to task it | **DONE** | Refuses with "Too Tired" at zero stamina |
| Dragons walk over objects rather than being blocked | **DONE** | Separate occupancy layer for dragons |
| Max 15 active dragons | **PARTIAL** | Constant defined, not enforced |
| Dragon Book with merge buttons | **PARTIAL** | Shows every chain and what has been found (54/836 on a fresh debug camp); no in-panel merge buttons |
| Dragon renaming, missions, dens, friends | **MISSING** | |

## Levels, camp and progression

| Feature | Status | Note |
| --- | --- | --- |
| Discrete levels with a board shaped as an island | **DONE** | 15 levels, 9×8 up to 15×13 |
| End Goal is merging Gaia Statues | **DONE** | 12 of 15 levels; two end on destroying every Demon Gate |
| Three quests per level, none required to win | **DONE** | Ten objective types |
| Each completed quest awards a Goal Star, 5% chance of a Dragon Star | **DONE** | The star spawns on the board to be tapped or merged |
| Star rating 0–3 shown on the world map | **DONE** | Best rating kept across replays |
| Chalice cost 1–7, regenerating over time, capped at 7 | **DONE** | 30s per chalice here instead of an hour |
| World map with regions in the wiki's map order | **DONE** | 15 nodes along a zigzag path |
| Carry items out of a level into camp | **DONE** | The declared reward list plus the best objects left on the board, scaled by stars |
| Reward / chest moment | **DONE** | Modal with star rating, a bursting chest and thumbnails |
| Persistent camp that accumulates | **DONE** | Camp board, land, objects, resources and level progress in localStorage. Leftover piles keep their value across a session; jars do not, since they expire |
| Buy Menu: Egg Shop, Build Shop, Treasure Shop | **DONE** | 20 entries; the Build Shop now sells storage and the Treasure Shop takes gems |
| Object Information Bar | **DONE** | Name, quote, chain level, rarity, action button, plus what a Leftover pile holds, what a jar contains and what a storage building adds |
| "Known Match Chain For" panel | **DONE** | A scrollable strip of the whole chain |
| Level replay reward cycle, Secret Levels, Challenge Levels | **MISSING** | |
| Star Quests, Camp Quests, Daily Rewards, Events, Seasons, Arcadia, Treasure Tower, Kala, Dens | **MISSING** | |
| Cloud save, profile, settings screen | **MISSING** | localStorage only, sound toggle only |

## Feel and presentation

| Feature | Status | Note |
| --- | --- | --- |
| Drag objects with the mouse, snap to tiles | **DONE** | Lift, drop shadow, dashed target marker, red when invalid |
| Highlight the valid merge group while dragging | **DONE** | |
| Satisfying merge animation | **DONE** | Inputs suck inward, the result pops, expanding ring, sparkle burst, screen shake, floating "MERGE 5! x2" |
| **The ejected spare is legible** | **DONE** | It pops out of the merge flash with its own ring and a "spare returned" label |
| Tap-to-harvest with a ready indicator | **DONE** | Pulsing halo plus drifting motes; a cooldown countdown when not ready |
| Floating "+" numbers | **DONE** | Coins, bricks, healing power, damage, item names on reveal |
| Warm saturated storybook palette | **DONE** | Dusk sky gradient with stars and cloud bands, warm top light, vignette |
| Rarity colours | **DONE** | The wiki's ladder: common grey through mythical pink |
| Camera pan and zoom | **DONE** | Drag empty land, scroll to zoom, smoothed and clamped |
| Sound | **PARTIAL** | WebAudio only: merge bells rising with tier, plucks, chimes, coin blips, fireballs, chest, fanfare, ambient pad. No voice, no music tracks |
| Isometric-ish presentation | **PARTIAL** | A mild vertical squash with grounded objects and contact shadows, not a true isometric projection (the original is not isometric either) |

### High-tier art

The first pass's weakest point was that tiers 8+ within a chain differed mostly by hue and scale, and
that multi-tile Wonders were the same painter stretched. What changed:

| Chain band | Before | Now |
| --- | --- | --- |
| Life Flowers 8–17 | one canopy blob, rescaled | three structures: a young forked tree (8–11); a mature tree with buttress roots, bark seams and two crown masses (12–14); a multi-trunk banyan under a flat-bottomed canopy platform with hanging light vines and an orb constellation (15–17) |
| Living Stones 7–9 | one faceted boulder, rescaled | a spined fossil ridge with an eye socket (Dino Rock), a standing slab figure with moss-lit eyes (Bluemoss Stoneguard), a grass-fringed terrace (Dragonmoss Steppes) |
| Hills 3–9 | one dome, rescaled | an asymmetric knoll with a worn path and an outcrop (3–4); a cliff with a sheer stratified face and a low moon (Moon's Precipice); a flat-topped column with erosion flutes and a talus skirt (Zomblin's Butte); a multi-peak massif with terraces, a waterfall and mist (7–9) |
| Mushrooms 4–11 | one dome, recoloured | one ringed toadstool with a skirt, domed and conical caps alternating by tier (4–5); a pair (6–7); a four-cap grove with spore motes and, at the top, embers (8–11) |
| Autumn Trees 9–10 (2×2) | the 1×1 tree, stretched | one enormous leaf as the whole canopy, with midrib and veins. The wiki asks "Why is this tree shaped like a leaf...?" and now it is |
| Ponds 5–8 (2×1, 2×2) | the puddle, stretched | an irregular pool with a chunky rock rim, reeds, ripples, a sky-reflection band and lily pads |
| Giant Treasure Chest (2×2) | the 1×1 chest, stretched | a domed lid thrown open, iron straps, corner bosses and spilling coins and gems |
| Dragon Homes 6–8 | the cottage, rescaled | a stratified cave mouth with a gold hoard and crystals (Opulent Cave); a three-wing manor with a tower and a dragon weathervane (Giant Mansion) |
| Gaia Statues 2–3 (2×2) | the broken statue, rescaled | a robed figure with open palms under a stone arch, haloed, wings added only on the Heavenly one |
| Seven old Wonders | each a handful of rectangles | Stonehenge is a trilithon ring with weathered pits and a moonlight shaft; Ruins of the Sky Palace a floating marble platform with five broken columns, ivy and clouds beneath; Trinity Dome three interlocking glass shells over a stone ring throwing a spectrum arc; Bottled Ocean a bottle holding a horizon, island, waves and a ship; Magic Beanstalk two braided vines with pods climbing into a cloud with a gate above; Rainbow a seven-band double bow on clouds with flowers under it; Ensnared Virtue a sword in a stone with vines up the blade |
| Seven new Wonders | — | The Golden Mushroom (a hammered gold cap), Bearer of the World Crystal (six gold arms holding a faceted crystal), Shambala (a valley of terraced pagodas between snow peaks), Elysium (a white colonnade over still water), Sanctuary of Bees (a honeycomb dome with a swarm), The Chocolate Spring (a five-tier fountain with curtains of chocolate), The Last Relic Artefact (three tilted orbiting rings over a shard) |

All 836 sprites render through `atlas.html` with zero painter errors: 35 painters were added and 16
existing ones rewritten, taking the total to 81. `node tests/atlas-crop.mjs <chain>` renders one
chain at four times the size for auditing.

## Known weak points

1. **104 of ~601 chains.** The long tail is event and season content, and it is the bulk of the
   original's collection depth.
2. **20 breeds against ~260.** Breeding produces a random third breed rather than following the
   original's element and rank rules, and there are no missions, dens or friends.
3. **Mid-tier art still repeats in some chains.** Midas Trees 1–4 and the two temple chains change by
   storey count and scale more than by silhouette; the statue and idol families cycle five animal
   outlines rather than carving each row's own creature.
4. **Every Dimensional Jar is 1×1** whatever it holds, and jars do not survive a session.
5. **Quests are simple counters.** The original's per-region and tap-count conditions are only
   partly represented.
6. **No tutorial hand-holding beyond banners.** The original gates and guides the first several
   levels.
7. **Max 15 active dragons is not enforced**, and 20 breeds make it easy to pass.

## What was verified, and how

Seven scripts under `tests/`, all green, plus the shared harness (`verify-game.mjs`: 0 page errors,
0 console errors, PASS):

- `tests/merge5.mjs` — the Merging Table through the real drag-and-drop path, both halves. 3→1+0,
  4→1+**1 ejected**, 5→2+0, 6→2+0, 7→2+**1**, 8→3+0, 10→4+0, 12→4+**1**. All PASS.
- `tests/audit.mjs` — 169 item keys referenced by levels, merges and dragon code all resolve;
  0 registry cross-reference problems; 0 duplicate item names; the yield table matches all 11
  published X→Y pairs.
- `tests/economy.mjs` — 17 assertions: coins clamp at the cap; overflow becomes a Leftover pile
  holding the exact remainder; a full store refuses the pile; a partly-full store pays out part of
  it; an emptied pile disappears; an Opulent Stone Yard moves the brick cap 250→1,050; a merge
  leaves a Dimensional Jar priced at the published 30 gems; opening it spends 30 gems and yields its
  contents; a jar sells for 50 coins; a Gilded Rhino gives 2 eggs on its one tap and none after;
  breeding needs power and two grown breeds, consumes the crystal, adds one dragon and leaves both
  parents alive.
- `tests/e2e.mjs` — full loop: heal, a real Gaia merge, level complete at 2 stars, 6 items carried,
  save written, the world map marks the node done, the camp receives the carried items.
- `tests/uitest.mjs` — 20 shop entries across 3 sections, a purchase debits and spawns, the Book
  reports 54/836, the Object Information Bar fills from a real board click.
- `tests/dragons.mjs` — 10 of 10 dragons moved, 3 harvests in 14 seconds, states covering
  idle and carry.
- `tests/atlas.mjs` — all 836 sprites drawn, 0 painter errors, 0 console errors.

One bug was found by instrumenting `CanvasRenderingContext2D.ellipse` during this pass and is fixed:
a `requestAnimationFrame` timestamp can predate the `performance.now()` taken in the constructor, so
the first frame's delta came out negative, ran the effect timers backwards and asked the canvas for
negative radii. The delta is clamped at both ends now, in `Game.frame` and in `Fx.update`.

## Honest overall estimate

Against the shipped game: **mechanics roughly 70%, content breadth roughly 17% of the chain roster
and 8% of the breed roster, presentation roughly 65%.** The merge, healing, dragon-autonomy, level
and economy loops behave the way the original's do, including the parts that constrain the player
rather than reward them. What is absent is what a live-service game accumulates over eight years: the
event and season catalogue, and the social and meta systems around it.
