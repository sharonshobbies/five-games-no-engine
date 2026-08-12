# Fidelity checklist

Honest accounting against the original **Motherload** (XGen Studios, 2004) and its Goldium Edition.
`DONE` means implemented at the original's numbers. `PARTIAL` means present but simplified or
guessed. `MISSING` means absent.

## Sources

Every table below traces to one of these. Direct fetches of GameFAQs, Neoseeker, TV Tropes and
Fandom were blocked (403/402/Cloudflare); the wiki content was reached through a text proxy and
through search synthesis over the individual wiki pages, cross-checked against three independent
mirrors of the same DJxChrome GameFAQs FAQ.

Second pass (Challenge mode, the boss fight, New Game+, saves, the soundtrack) reached the wiki
through `?action=raw` via the r.jina.ai text proxy, which returns the wikitext itself rather than a
summary — so the Challenge table below is character-exact rather than paraphrased. GameFAQs still
refuses proxies; the DJxChrome FAQ was read through a mirror.

- Motherload Wiki: [Minerals](https://motherload.fandom.com/wiki/Minerals),
  [Damage](https://motherload.fandom.com/wiki/Damage),
  [Autobuy 2000](https://motherload.fandom.com/wiki/Autobuy_2000),
  [Emendation Station 3500](https://motherload.fandom.com/wiki/Emendation_Station_3500),
  [Shops](https://motherload.fandom.com/wiki/Shops),
  [Transmissions](https://motherload.fandom.com/wiki/Transmissions),
  [Ending](https://motherload.fandom.com/wiki/Ending),
  [Ancient Blueprints](https://motherload.fandom.com/wiki/Ancient_Blueprints),
  [Artifacts](https://motherload.fandom.com/wiki/Artifacts),
  [Rock](https://motherload.fandom.com/wiki/Rock),
  [Challenge](https://motherload.fandom.com/wiki/Challenge),
  [Motherload](https://motherload.fandom.com/wiki/Motherload),
  [Stone](https://motherload.fandom.com/wiki/Stone),
  [Quantum Particle State Analyzer 6000](https://motherload.fandom.com/wiki/Quantum_Particle_State_Analyzer_6000),
  [Plastic Explosive](https://motherload.fandom.com/wiki/Plastic_Explosive),
  [Reserve Fuel Tank](https://motherload.fandom.com/wiki/Reserve_Fuel_Tank)
- [XGen Studios Wiki: Motherload](https://xgenstudios.fandom.com/wiki/Motherload)
- [Villains Wiki: Mr. Natas](https://villains.fandom.com/wiki/Mr._Natas) (boss dialogue, verbatim)
- [JayIsGames review/walkthrough](https://jayisgames.com/review/motherload.php) and its comment
  thread (https://www.jayisgames.com/archives/2004/11/motherload.php)
- [XGen Studios' own instructions page](https://www.xgenstudios.com/game.php?keyword=motherload) —
  the `I` key, and "to save your game, fly up to the hovering bot right above the mineral depot"
- DJxChrome's GameFAQs walkthrough, read through the
  [game.lhg100.com mirror](http://game.lhg100.com/Article/faq/201601/68320.html) — the boss's
  240 / 120 / 60 damage tiers and the repair-kit cost of each of his attacks
- [SuperCheats](https://www.supercheats.com/pc/motherload.htm) — names Challenge and Adventure as
  the two modes, and confirms the in-game Options menu is where codes are typed
- The Goldium Edition soundtrack tracklist, from a
  [YouTube upload](https://www.youtube.com/watch?v=NKUGATAQSKo) of the album. Track titles only:
  no composer is credited for the 2004 game anywhere I could reach.
- Mirrors of the GameFAQs FAQ carrying the shop tables:
  [chaptercheats](https://www.chaptercheats.com/cheat/pc/18391/motherload/unlocks/7269),
  [dogecandy](http://dogecandy.com/cheats/motherload/),
  [cheatbook.de](https://www.cheatbook.de/files/motherload.htm)

---

## Minerals

Value, points, weight, minimum depth and common depth are the wiki's numbers, unchanged.
`Units` is this build's cargo cost (weight ÷ 10 — see Deviations). `Peak` is the per-tile spawn
chance at the mineral's common depth, tuned so a screen there shows a couple of specimens, which is
how the wiki defines "common depth".

| Mineral | Value | Points | Weight | Units | Min depth | Common | Peak |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Ironium | $30 | 150 | 10 kg | 1 | -25 ft | -25 ft | 3.8% |
| Bronzium | $60 | 300 | 10 kg | 1 | -25 ft | -25 ft | 2.8% |
| Silverium | $100 | 500 | 10 kg | 1 | -25 ft | -25 ft | 1.7% |
| Goldium | $250 | 1,250 | 20 kg | 2 | -25 ft | -250 ft | 1.3% |
| Platinium | $750 | 3,750 | 30 kg | 3 | -800 ft | -1,700 ft | 0.90% |
| Einsteinium | $2,000 | 10,000 | 40 kg | 4 | -1,600 ft | -2,600 ft | 0.70% |
| Emerald | $5,000 | 25,000 | 60 kg | 6 | -2,400 ft | -4,000 ft | 0.55% |
| Ruby | $20,000 | 100,000 | 80 kg | 8 | -4,000 ft | -4,800 ft | 0.44% |
| Diamond | $100,000 | 500,000 | 100 kg | 10 | -4,400 ft | -5,700 ft | 0.34% |
| Amazonite | $500,000 | 500,000 | 120 kg | 12 | -5,500 ft | -6,200 ft | 0.26% |

Cheap minerals thin out with depth (a per-mineral fade factor); the top four never fade.

### Buried artifacts — DONE

A separate collectible class, all worth 500,000 points. The wiki says value is *not* depth
correlated, so they seed from -300 ft down with no depth weighting.

| Artifact | Value | Units |
| --- | --- | --- |
| Dinosaur Bones | $1,000 | 3 |
| Treasure | $5,000 | 3 |
| Martian Skeleton | $10,000 | 4 |
| Religious Artifact | $50,000 | 4 |

---

## Upgrades — Autobuy 2000

All six lines ride the original's one ladder: $750 / $2,000 / $5,000 / $20,000 / $100,000 /
$500,000. Radiators skip the $750 step and cargo bays stop at $100,000, both as published. Stock
tiers are printed as `<17`, `<28 ft/s`, `<15 L`, `<10%` in every source, so the starting values here
are reconstructed just under the first purchasable tier.

| Fuel Tank | L | Price |
| --- | --- | --- |
| Micro Tank | 10 | stock (reconstructed) |
| Medium Tank | 15 | $750 |
| Huge Tank | 25 | $2,000 |
| Gigantic Tank | 40 | $5,000 |
| Titanic Tank | 60 | $20,000 |
| Leviathan Tank | 100 | $100,000 |
| Liquid Compression Tank | 150 | $500,000 |

| Drill | ft/s | Price |
| --- | --- | --- |
| Stock Drill | 22 | stock (reconstructed) |
| Silvide Drill | 28 | $750 |
| Goldium Drill | 40 | $2,000 |
| Emerald Drill | 50 | $5,000 |
| Ruby Drill | 70 | $20,000 |
| Diamond Drill | 95 | $100,000 |
| Amazonite Drill | 120 | $500,000 |

| Engine | HP | Price |
| --- | --- | --- |
| Stock Engine | 150 | stock (reconstructed) |
| V4 1600cc Engine | 160 | $750 |
| V4 2.0 Ltr Turbo | 170 | $2,000 |
| V6 3.8 Ltr Engine | 180 | $5,000 |
| V8 Supercharged 5.0 | 190 | $20,000 |
| V12 6.0 Ltr Engine | 200 | $100,000 |
| V16 Jag Engine | 210 | $500,000 |

| Hull | HP | Price |
| --- | --- | --- |
| Stock Hull | 10 | stock |
| Ironium Hull | 17 | $750 |
| Bronzium Hull | 30 | $2,000 |
| Steel Hull | 50 | $5,000 |
| Silverium Hull | 80 | $20,000 |
| Einsteinium Hull | 120 | $100,000 |
| Energy-Shield Hull | 180 | $500,000 |

| Cargo Bay | cu ft | Price |
| --- | --- | --- |
| Micro Bay | 10 | stock (reconstructed) |
| Medium Bay | 15 | $750 |
| Huge Bay | 25 | $2,000 |
| Gigantic Bay | 40 | $5,000 |
| Titanic Bay | 70 | $20,000 |
| Leviathan Bay | 120 | $100,000 |

| Radiator | Damage cut | Price |
| --- | --- | --- |
| Stock Fan | 0% | stock (reconstructed) |
| Dual Fan | 10% | $2,000 |
| Single Turbine | 25% | $5,000 |
| Dual Turbine | 40% | $20,000 |
| Puron Cooling Fan | 60% | $100,000 |
| Tri-Turbine Freon Array | 80% | $500,000 |

### Consumables — Emendation Station 3500 — DONE

| Item | Price | Effect | Key |
| --- | --- | --- | --- |
| Dynamite | $2,000 | 2.2-tile crater | X |
| Plastic Explosive | $5,000 | 3.4-tile crater | C |
| Quantum Teleporter | $2,000 | jump to the surface pad | Q |
| Matter Transmitter | $10,000 | sell the hold remotely | M |
| Reserve Fuel Tank | $2,000 | +25 L | F |
| Hull Repair Nanobots | $7,500 | +30 HP | R |
| Repair service | $15/HP | full hull restore | — |
| Fuel | $1/L | Propellent Vendor 12000 | — |

Blast radii are this build's; no source gives them. Both explosives destroy minerals inside the
crater, which is documented.

### Ancient Blueprints — DONE

Effects and depths are the wiki's Ancient Blueprints page. The Multi-Drill is not buried: that page
gives its unlock as "Complete all 12 challenges in challenge mode without failing", and the Stone
page confirms it applies to a run started afterwards. This build enforces exactly that.

| Blueprint | Effect | Found |
| --- | --- | --- |
| Hyper-Drive Engine | unlimited teleports home, plus more thrust than the V16 | buried, -4,000 ft down |
| Regenerative Hull | 180 HP, self-repairing at 0.6 HP/s | buried, -3,700 ft down |
| Portable Wormhole | effectively unlimited cargo | buried, -3,700 ft down |
| Fuel Integrator Tank | a 150 L tank; gas pockets also feed it | buried, -4,000 ft down |
| Magma Converter | lava contact pays $2,500 (damage still lands) | buried, "random" |
| Multi-Drill | faster than the Amazonite Drill, and it cuts solid rock | clear all 12 challenges without failing |

The self-repair rate, the extra Hyper-Drive thrust, the $2,500 lava payout and gas feeding the Fuel
Integrator are this build's; the capacities and the unlock conditions are the wiki's.

---

## Challenge mode — DONE (targets and timers exact; mazes and loadouts invented)

Goldium Edition only. The twelve rows below are transcribed character-exact from the wiki's Challenge
page as raw wikitext — its table has three columns, `#` / `Target` / `Time limit`, and **the
objectives have no names in the source**, so none are invented here: the target string *is* the
objective. Total budget across all twelve is 23:20.

| # | Target | Time limit | How it is built here |
| --- | --- | --- | --- |
| 1 | 5 Ironium | 1:00 | Ironium seeded through the top rows |
| 2 | 3 Ironium and 3 Bronzium | 1:20 | both seeded shallow |
| 3 | 3 Silverium | 2:00 | Silverium seeded shallow |
| 4 | Reach 600 feet | 1:00 | rock and lava cleared from the shaft band |
| 5 | Reach 1400 feet | 2:00 | same |
| 6 | Reach 2400 feet and 5 Goldium | 3:00 | Goldium seeded to -2,800 ft |
| 7 | Reach 2500 feet and 5 Platinium | 2:00 | Platinium seeded to -2,900 ft |
| 8 | 5 more Platinium | 2:00 | starts in a chamber at -2,500 ft (see Deviations) |
| 9 | Destroy the rock layer at 2560 feet with dynamite | 1:00 | a full-width, 2-row undrillable slab at exactly that depth; the charge has to breach it |
| 10 | Navigate through 1st maze | 1:00 | 9 x 7 cells |
| 11 | Navigate through 2nd maze | 2:00 | 13 x 12 cells |
| 12 | Navigate through 3rd maze | 5:00 | 15 x 22 cells |

The same page gives the rest of the rules, and all three are implemented: fuel is refilled and the
hull repaired between challenges, "every few challenges you get better equipment to make goal
reachable", and clearing all twelve grants the Multi-Drill on a new game. The stricter wording —
"without failing" — comes from the Ancient Blueprints page, and that is the one enforced: a single
timeout or destroyed pod forfeits the drill until you reset progress.

| Feature | Status | Note |
| --- | --- | --- |
| Twelve objectives, exact targets | DONE | Verbatim; a probe asserts the strings and the timers. |
| Exact time limits | DONE | 60 / 80 / 120 / 60 / 120 / 180 / 120 / 120 / 60 / 60 / 120 / 300 s. |
| Mode select | DONE | CHALLENGES on the title screen, beside ADVENTURE. |
| Per-objective completion tracking | DONE | Own localStorage key, with a flawless flag. |
| Fuel refilled, hull repaired between challenges | DONE | Every start is a full pod. |
| Escalating equipment | PARTIAL | The escalation is documented; the twelve loadouts are not. |
| Multi-Drill on clearing all twelve without failing | DONE | Fitted on every subsequent new game. |
| The three maze layouts | PARTIAL | Named only as 1st/2nd/3rd anywhere. Invented. |
| Medals, stars, per-objective rewards | MISSING | Not documented to exist; the wiki lists no per-challenge reward at all. |

---

## Feature-by-feature

### World and rendering

| Feature | Status | Note |
| --- | --- | --- |
| 32 blocks wide = 400 ft, 12.5 ft per block | DONE | The original's own geometry. |
| Digging stops at -7,300 ft | DONE | Impenetrable bedrock barrier. |
| Gap in the barrier on the far right | DONE | Leads to the arena; readout flips to -66,666 ft. |
| Destructible tile grid, tunnels persist | DONE | Typed arrays, chunk-cached rendering. |
| Undrillable rock from -1,500 ft, thickening | DONE | No shop drill cuts it; explosives or Multi-Drill. |
| Cave voids | DONE | Small noise pockets. |
| Altimeter garbles below -5,813 ft | DONE | `?xxxxx ft` with flashing digits, in red. |
| Depth-banded strata colours | PARTIAL | Undocumented; the palette is invention. |
| Pod-mounted light, dark underground | PARTIAL | Brief asked for it; the original is evenly lit. |
| Ore glinting inside rock | DONE | Faceted crystals plus a light punch so a vein shows. |
| Thruster flame, dust, sparks, smoke | DONE | Pooled particles. |
| Surface scene with sky, ridges, four shopfronts | DONE | Procedural buildings, pads, dust haze, sun. |
| Chunky retro-Flash UI | PARTIAL | Bevelled panels and meters; darker than Flash-era chrome. |
| Marsquakes after 100,000 points | PARTIAL | Shake plus a control shove; the real disruption is undocumented. |

### Pod and resources

| Feature | Status | Note |
| --- | --- | --- |
| Thrust flight with fuel drain | DONE | Up thrusts, sideways drifts, gravity does the rest. |
| Cannot drill upward | DONE | The defining constraint. |
| Sideways drilling needs footing | DONE | As documented. |
| Fuel drains on thrust and on drilling | DONE | Rates set so the stock tank ≈ 30 s of digging. |
| Out of fuel underground = pod lost | DONE | 2.2 s grace, then destroyed with the cargo. |
| Hull integrity 10-180 HP | DONE | Shop tiers exactly. |
| Fall damage table, capped at 8 HP | DONE | 24 ft free; 3/4/5/6/7/8 by distance. |
| Cargo capacity, weight per mineral | DONE | Scaled by 10 — see Deviations. |
| Cargo full blocks pickup | DONE | Warning plus a denial cue. |
| Death loses the hold and rolls back to the save | DONE | Including the tunnels dug since docking. |
| No rescue fee | DONE | The penalty is the lost cargo, as documented. |
| Hull does not regenerate | DONE | Except with the Regenerative Hull blueprint. |
| Pod tilts when moving | DONE | Plus a drill-bite offset and rattle. |

### Hazards

| Feature | Status | Note |
| --- | --- | --- |
| Lava pockets from -3,000 ft, visible | DONE | 58 HP deep contact, 41 HP graze, cut by the radiator. |
| Lava hits once per contact | PARTIAL | Sources say twice; see Deviations. |
| Gas pockets from -4,750 ft, invisible | DONE | Render as plain soil; ignite part-way into the tile. |
| Gas rate jumps at -4,950 ft, near-certain by -6,500 | DONE | Per-row probability ramp. |
| Gas damage scales with depth | DONE | `(depth − 3000) / 15 × (1 − radiator)`; sign corrected. |
| Minerals never hide a gas pocket | DONE | The one readable safety rule. |
| Gas chain reactions | DONE | Adjacent pockets cook off in sequence. |
| Radiator cuts lava and gas alike | DONE | |
| Explosives destroy ore in the blast | DONE | |

### Shops and progression

| Feature | Status | Note |
| --- | --- | --- |
| Four separate vendors with split duties | DONE | Own buildings, own screens. |
| Six upgrade lines, every named tier and price | DONE | Table above. |
| Repair at $15/HP, fuel at $1/L | DONE | |
| Six consumables at their real prices | DONE | |
| Score from mineral points | DONE | Shown on the HUD, banked on sale. |
| Ancient Blueprints | DONE | Five buried; the Multi-Drill is Challenge mode's. |
| Quantum Particle State Analyzer 6000 as the save point | DONE | The bot hovering over the Mineral Processor. Fly into its field. |
| Saving preserves upgrades, items, cash, hull and fuel | DONE | localStorage, plus this build's dug-tile diff. |
| Saving resets your score | DONE | Score is deliberately not written to the save file. |
| Cheat codes, and they disable saving | DONE | All nine, typed on the title, pause or Options screen. |
| Inventory screen (`I`) | DONE | Consumables, fitted hardware, blueprints, eggs, Satan's Heads, the manifest. |
| Options screen | DONE | Volume, mute, controls, cheat entry. |
| Two modes named Adventure and Challenge | DONE | Both selectable from the title screen. |
| Tab strip between vendor screens | PARTIAL | A convenience the original does not have. |
| Autosave on docking at a vendor | PARTIAL | The original saves only at the analyzer. Kept as a convenience. |
| Online high-score board | MISSING | Score is tracked and shown, never submitted. |

### Story and endgame

| Feature | Status | Note |
| --- | --- | --- |
| Mr. Natas hires you, turns on you | DONE | |
| Depth-triggered transmissions at the real depths | DONE | -500 / -1,000 / -1,750 / -2,100 / -2,500 / -3,100 / -3,500 / -4,100 / -4,500 / -5,813 ft. |
| Depth bounties: $1,000 / $3,000 / $25,000 | DONE | Paid on arrival. |
| Doomed pods #3422-2 and #10043 | DONE | Retirement talk, trapped, then dying mid-sentence. |
| "The eyes... oh my god, THE EYES!!!" | DONE | Verbatim. |
| Order not to dig past -6,000 ft | DONE | |
| Natas jams the altimeter and demands you turn back | DONE | |
| Boss reveal speech | DONE | Verbatim from the Villains Wiki. |
| Two forms: 1,000 HP then 2,000 HP | DONE | Businessman with monocle and staff, then cyborg demon. |
| Estate payout totalling $28,500,000 | DONE | Itemised on the victory screen; final score adds it. |

### The Mr. Natas fight

The mechanic is sourced, and it is not the obvious one. From the wiki's Ending page: "To damage Mr.
Natas, you must hit him with Dynamite or Plastic Explosives, bought from Emendation Station 3500."
His hitbox is described as deceptively small — an edge-of-blast hit does not count — so the charge
has to land at his feet. Charges only arm on solid ground (XGen wiki), so the loop is: close in,
land, plant, retreat. Contact does not damage him; it damages you and bounces the pod, and the
bounce blocks explosives and the teleporter. That makes ramming strictly worse than doing nothing.

| Feature | Status | Note |
| --- | --- | --- |
| Explosives are the only damage source | DONE | The drill and ramming do nothing at all. |
| Plastic Explosive 240 at his feet | DONE | 120 within a crater width, 60 beyond that, 0 out of range. |
| Dynamite 120 at his feet | DONE | 60 otherwise. |
| Small hitbox: the charge must be at his feet | DONE | Measured against a point 10 px above the floor. |
| Contact hurts and bounces, locking out charges and teleport | DONE | 0.6 s lockout, with a HUD warning. |
| Form 1: Laser Monocle sweep, staff swing with big knockback | DONE | The monocle reaches through the ceiling; the staff does not. |
| Form 2: telescoping mechanical claw, bouncing fireball | DONE | The claw extends then sweeps; the fireball persists and burns on contact. |
| The claw is faster, harder and shorter-ranged than the monocle | DONE | 120 vs 105, 0.34 s wind-up vs 0.4 s, and it cannot reach above the ceiling. |
| Phase change on form 1's death: he sinks, speaks, returns at 2,000 HP | DONE | He is clipped into the floor while the transmission runs. |
| 3 squares above the ceiling is a safe pocket | DONE | Laser reaches, claw does not — the barrier gap shaft is exactly 3 rows. |
| 4 squares up abandons the fight and resets him | DONE | He is despawned and comes back whole. |
| No pause, inventory, options or help during the fight | DONE | ESC, I and O all refuse with a message. |
| Per-attack damage numbers | PARTIAL | Undocumented anywhere. Set to the wiki's repair-kit ratio (contact ~3 kits, pass-through ~2, laser 3-4) against a 30 HP kit. |
| Health or fuel pickups in the chamber | MISSING | No source says the chamber contains anything but a floor. Bring nanobots and reserve tanks, as the wiki tells you to. |

### New Game+ — DONE

The wiki's Ending page gives the formulas outright, with *x* = times Satan has been defeated, and the
XGen wiki confirms them with a worked example plus the cycle cap. All of it is implemented:

| Rule | Value | Status |
| --- | --- | --- |
| Boss health | 1,000 x (x+1) form 1, 2,000 x (x+1) form 2 | DONE |
| Boss damage | 1 x (x+1) | DONE |
| Mineral value | 1 / (x+1), rounded down | DONE |
| Points for digging | 1 x (x+1) | DONE |
| Cycle cap | 99 | DONE |
| One Satan's Head per kill | shown on the Inventory screen | DONE |
| Cash, upgrades and equipment stripped each cycle | | DONE |
| "Ironium becomes worth $0 after Level 31" | round-down floor, reproduced exactly | DONE |
| Martian Oilers craft / Oil-Bird at -500 ft | DONE | "Welcome Earthling!", then $8 per plain-dirt tile. |
| Guardian at 10,000 ft altitude, halves damage | DONE | Verbatim text; the angel follows the pod. |
| "Thou hast too much time on thy hands" at 100,000 ft | DONE | |
| Mr. Dog at 5,000 ft altitude | PARTIAL | Pays $50,000; sources disagree on his altitude. |

### Audio

| Feature | Status | Note |
| --- | --- | --- |
| Drill loop, thruster noise | DONE | WebAudio: filtered saw with an LFO; filtered noise. |
| Pickup, sell, buy, deny, hit, explosion, teleport cues | DONE | Synthesised. |
| Discovery fanfare, alarm | DONE | |
| Background music | PARTIAL | Present, and depth-tiered. The nine Goldium track titles are sourced and the scenes are named for them; the music itself is invented (see below). |
| Music shifts with depth | PARTIAL | Five underground bands plus surface, boss and victory. The tracklist implies depth tiering; no source states it. |
| Separate boss theme | PARTIAL | "66.6 FM" is plainly the Natas motif given the -66,666 ft gag, but nothing confirms it plays in the fight. |
| Volume control (master / music / SFX) | DONE | Three sliders on the Options screen, over three audio buses. |
| Mute | DONE | |
| Options screen | DONE | Volume, mute, the control reference, and the cheat-code field SuperCheats describes. |
| Settings persist | DONE | Own localStorage key, so a cheat or a new run does not reset them. |

**How the music is built.** A step sequencer over synthesised voices — drone, bass, pad, pluck,
drums, lead — scheduled 0.3 s ahead against the audio clock so it never depends on frame timing.
Each scene is a key, a mode, a tempo, a 16-step pattern set and a per-layer mix. Layer gains
crossfade immediately on a scene change and the pattern set swaps at the next bar line, so sinking
through a depth boundary darkens the music without stuttering the loop. Going down, the mode flattens
from natural minor to Phrygian, the tempo drops from 108 to 76 BPM, the drone comes forward and the
bright layers fade out.

No composer is credited for the 2004 game anywhere reachable — every result collapses into *Super
Motherload* (2013, Eric Cheng), which is a different game. The nine track titles (66.6 FM, Heavy
Industry (Alternative Mix), Malfunction, Shop, Wealthonium, Heavy Industry, Undergrounds, Nano Tech,
Core) come from a YouTube upload of the album whose uploader does not remember its provenance. The
titles read as authentic to the game's vocabulary, so the scenes are named for them; nothing else
about the music is sourced.

---

## Missing outright

- **Online high-score board.** Score is tracked and shown, never submitted. The original posted to
  XGen's own board and required an account created in-game.
- **Goldium-only extras** beyond the blueprints and Challenge mode (whatever the shop's
  Goldium-exclusive stock was — no source enumerates it).
- **Anything inside the boss chamber but a floor, a ceiling and him.** No source describes drillable
  terrain or pickups down there, so there are none. This is inference from silence, not a source.

### Not missing after all: underground save pods

The previous pass listed "save pods underground" as a gap. Research says the original has no such
thing. The save point is the **Quantum Particle State Analyzer 6000**, a bot hovering over the
Mineral Processor on the surface — XGen's own instructions read "to save your game, fly up to the
hovering bot right above the mineral depot", and the wiki gives it a page of its own. It is
implemented as that, and the invented underground pods this pass briefly had were removed. There are
four surface shops and no underground services.

## Deviations, with reasons

1. **Cargo weights ÷ 10.** Raw kg against published bay capacities would let the best bay hold a
   single Amazonite. Ratios are preserved.
2. **Gas damage uses `− 3000`, not `+ 3000`.** The wiki's own worked values (180 HP at -5,700 ft,
   287 HP at -7,300 ft) only reproduce with the minus sign.
3. **Lava hits once per touch.** "Damage twice" contradicts the same page's claim that Steel Hull
   plus Single Turbine survives lava.
4. **Fuel burn rates invented.** Undocumented; anchored to "the stock tank is about thirty seconds
   of digging".
5. **Strata palette invented.** No source describes soil colour by depth.
6. **Engine HP → thrust curve invented.** The published stat is horsepower with no speed figure;
   150-240 HP maps to a 0.88-1.4 thrust multiplier here.
7. **Transmissions overlay instead of pausing**, and auto-advance, so one can never trap the player
   mid-fall. The one exception is the phase-change transmission, which does hold the boss still —
   the wiki says the game pauses for it.
8. **Vendor tab strip** so you are not taxiing between four buildings for one purchase.
9. **Pod lamp and darkness** are a brief requirement, not an original feature; the ambient floor is
   kept high so strata, rock and ore stay readable.
10. **World is 617 rows** (584 diggable + a 3-row barrier + a 24-row arena) rather than the wiki's
    ~592, because the arena needs somewhere to be. The 3-row barrier gap doubles as the fight's
    documented 3-square safe pocket, which is a happy accident of the earlier geometry.
11. **The three Challenge mazes are invented.** The wiki names them only as 1st, 2nd and 3rd. These
    are recursive-backtracker mazes in undrillable rock at 9x7, 13x12 and 15x22 cells, with the
    carve biased downward so gravity helps rather than fights.
12. **The twelve Challenge loadouts are invented.** "Every few challenges you get better equipment"
    is all the source says. These climb from a Silvide Drill and a 25 L tank to the top of every line.
13. **Challenge 8's "5 more Platinium" is read as a fresh count of five**, starting in a chamber at
    -2,500 ft where challenge 7 left you. The word "more" implies continuity; the source does not
    say whether progress carries or resets.
14. **Challenge 9's slab is a full-width 2-row band** of undrillable rock at -2,563 ft (row 213 —
    2,560 ft does not fall on a 12.5 ft boundary). Whether the original's "rock layer at 2560 feet"
    is one contiguous slab is inference.
15. **Every per-attack damage number in the boss fight is invented**, set to the wiki's repair-kit
    ratio. Only the explosive damage tiers and both forms' HP are sourced.
16. **The Plastic/Dynamite tier reading.** The wiki reads 240 / 120 / 60 as per-item maxima; the
    DJxChrome FAQ reads them as distance tiers for one C4 charge. Both cannot be literally true, so
    both are honoured: Plastic runs the full 240 / 120 / 60 ladder, Dynamite tops out at 120.
17. **Music is invented.** Track titles sourced, arrangements not; no composer is credited anywhere.
18. **Vendor docking still autosaves**, on top of the analyzer, so a player who never finds the bot
    is not punished for it.
19. **A challenge failure is a timeout or a destroyed pod.** The source names neither condition.

## Verification

```
node verify-game.mjs <dir> --shots 4 --wait 3500 --hold 4000 --keys "ArrowDown,ArrowDown,ArrowRight"
```

PASS: 0 page errors, 0 console errors, 0 failed requests, pixel variety 65.

```
node probes/scenarios.mjs            # 32 scenarios, all passing
node probes/scenarios.mjs boss-phase # or any subset by name
```

Each probe spawns a fresh page, clears localStorage, drives the real game loop through
`window.__game`, asserts on observed state, screenshots the result to `screenshots/s-<name>.png`, and
fails on any page or console error. What they cover:

| Probe | What it proves |
| --- | --- |
| `title`, `pause` | Both screens draw and their buttons work; the pause screen's INVENTORY button opens the overlay |
| `surface` | Four vendors, the analyzer, the pod resting at 0 ft |
| `analyzer-save` | Flying into the analyzer's field writes a save |
| `tunnel` | A 238 ft shaft in 20 tiles, 0 px of column drift, never embedded in solid ground |
| `no-up-drill` | Holding UP in a sealed pocket digs nothing |
| `dynamite` | A charge detonates and clears 13 tiles |
| `lava`, `gas` | 58 HP from lava, the documented `(depth − 3000) / 15` from gas, and `igniteGas` is a no-op on a tile with no gas |
| `vendors`, `vendor-buy` | All four screens draw controls; buying a drill tier costs exactly $750 and advances the tier |
| `options`, `inventory` | Sliders move the live settings, mute toggles, the hold reports its value |
| `challenge-select` | 12 rows, the exact target strings, the exact timers |
| `challenge-ore` | Ore is seeded within reach, the loadout applies, the clock runs |
| `challenge-blast` | The slab is 30/30 rock at -2,563 ft, and a charge registers as breaching it |
| `challenge-maze`, `challenge-maze-view` | The spawn is not inside a wall, the exit clears the run, the band is mostly rock with real corridors |
| `challenge-fail` | A timeout ends the run and forfeits the flawless flag |
| `challenge-reward` | Clearing all twelve awards the Multi-Drill, and it is fitted on the next new game |
| `barrier-gap` | Falling through the gap enters the arena and spawns him |
| `boss-explosives` | Ramming does 0. Plastic at his feet 240, a crater away 120, six tiles away 0. Dynamite 120. Contact sets the lockout |
| `boss-phase` | 1,000 → sink → 2,000 → victory, one Satan's Head |
| `boss-ceiling-reset` | 3 squares up keeps fighting, 4 squares up resets him |
| `boss-locks-ui` | I, O and ESC all refuse during the fight |
| `victory` | The estate totals exactly $28,500,000 |
| `newgameplus` | Cycle 2: Ironium $15, Diamond $50,000, dig points x2, boss form 1 at 2,000 HP, cash and upgrades stripped, and Ironium at $0 from cycle 32 |
| `death-rollback` | The hold is lost, cash restored, and the tunnels dug since the save are rolled back |
| `music-scenes` | Five distinct depth bands, both audio buses built, the sequencer scheduling notes against a running audio clock |
| `deep-strata`, `altimeter-jam`, `sky-egg` | -5,013 ft renders, -6,005 ft is past the jam threshold, the Guardian halves damage at 10,000 ft up |

## Self-assessment

Roughly **92%**. What is left is genuinely unreachable rather than unattempted: the online score
board (a dead service), the Goldium-exclusive shop stock (unenumerated anywhere), and the pile of
numbers no source prints — per-attack boss damage, fuel burn rates, strata colours, the engine
HP-to-thrust curve, the three maze layouts, the twelve challenge loadouts, and every note of the
music. Each of those is listed above with what it was derived from.

The two things this pass changed its mind about are worth naming: the boss fight was a ram-fest
built on a guess and is now the documented explosives-only fight, and the "underground save pods"
this build was asked to add turned out not to exist in the original, so the real surface save bot
was built instead.
