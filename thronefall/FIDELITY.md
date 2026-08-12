# Fidelity checklist

Measured against Thronefall 1.0 / update 2.11 as documented on `throne-fall.github.io` (the
community wiki the developers link from their own Steam FAQ), the Steam store copy, Steam
Community guides and discussion threads, and the developers' Game Developer interview. `DONE`
means the mechanic is present and behaves the way the original does. `PARTIAL` means it is there
but shallower. `MISSING` means absent.

Where a number or a behaviour is **not published anywhere reachable**, this says so instead of
papering over it. Three wiki mirrors (`thronefall.fandom.com`, `game.wiki/thronefall`,
`thronefall.wiki.gg`) refuse automated requests outright, so anything they alone hold is outside
what this was built from.

## The core loop

| Feature | State | Note |
| --- | --- | --- |
| Untimed day phase, night starts only when you choose | DONE | `Enter` or the Start the Night button. |
| Night ends when the last enemy dies | DONE | Plus a 30 s backstop for unreachable stragglers, which the original does not need. |
| Castle Center destroyed = run over | DONE | |
| King dies → respawns at the keep, run continues | DONE | 10 s base, halved by Ring of Resurrection, doubled by the God of Death. |
| King can move while dead, cannot attack | DONE | Speed 8 while down. |
| Buildings rebuilt free at dawn | DONE | Put back on their plot at dawn at the morning's repair fraction: full health, or 25% under the God of Destruction, which also leaves the rubble standing one extra day. The night it fell still pays no income. |
| Gold paid at dawn from surviving buildings | DONE | |
| Enemy gold drops | DONE | Paid out at dawn with the income. |
| Wave composition telegraphed before the night | DONE | Full list, bottom right, during the day. |
| Elite enemies telegraphed before the night | DONE | Elite count is decided when the wave is composed rather than at spawn time, so the list names how many of each kind arrive elite, plus a total. Bosses are tagged in the list too. |

## The king

| Feature | State | Note |
| --- | --- | --- |
| Single directly-driven mounted hero | DONE | Camera-relative WASD. |
| 100 health, 10%/s regen after a 1 s delay | DONE | The 1.0 numbers. |
| Sprint only at full health | DONE | Walk 14, sprint 23. |
| Automatic attacks, no manual aim | DONE | |
| Manual weapon ability | DONE | One per weapon, nine implemented. |
| Trample (War Horse) | DONE | |
| Only the king can build | DONE | Stand on a plot and press Space. Clicking a plot from anywhere is an added convenience. |
| Target lock (Left Alt) | DONE | Locks the auto-attack onto one enemy, steps to the next when that one dies, and lets go after 2.5 s with nothing in reach — the three published behaviours. Gold reticle on the target. |
| Command troops: gather, follow, release, hold position | DONE | Left Ctrl (and middle mouse) gathers and they follow; holding Ctrl issues hold-position, with a white circle on each posted soldier — the original's own confirmation. `R` is a latching alias for gather/release, `H` toggles hold. |
| Command troops: type filters | ADDED, unverified | `F` cycles melee → ranged → champions → everyone, and `1`/`2`/`3`/`4` select outright. Players requested exactly this in 2023 and the developer answered that unit control "will be improved in the future, for sure"; whether it shipped is not documented anywhere reachable. These keys are this build's answer, not a citation. |
| Commanded troops move slower and cannot attack until Commander | DONE | ×0.82 while commanded, ×1.6 and able to fight once the Commander upgrade is taken — which is what its published "+60% while commanded" is measured against. |
| Gamepad support | MISSING | |
| Rebindable keys | MISSING | The original ships a Controls menu. |

## Weapons

All nine are present. Six have published stat tables and use them. The other three have **no
published numbers at all** — only descriptions of what they do.

| Feature | State | Note |
| --- | --- | --- |
| Bow & Dagger, Light Spear, Heavy Sword, Lightning Staff, Shadow Codex, Falchion & Traps | DONE | Passive and active both implemented with the published multipliers. |
| Potion Vials | PARTIAL | Behaviour is the published one: thrown vials that damage and slow enemies while mending your soldiers standing in the splash, and an ability that mends the group and slows hard. Damage, rate, radius and heal are set by analogy with the six documented weapons. |
| Battle Ax | PARTIAL | Wide melee swing; the ability grants 4 s of outright immunity, which is the one thing players describe it by — "the immunity really helps tanking for your units". Numbers invented. |
| Blood Wand | PARTIAL | Deliberately feeble passive; the ability empties one target for a tenth of your own health and triples on bosses, matching "less single target damage than most other weapons" and "it deletes bosses in seconds". The health cost is inferred from the name and from the max-HP builds players pair it with, and is not documented. |
| Weapons unlock by clearing a specific map | PARTIAL | Six unlock as documented. The last three are attached to Moorweg, Freifort and Totend on the strength of those maps' quest requirements and one episode title. The original grants four weapons by account level instead, and how the other five unlock is never stated. |
| Dagger cooldown scales with target health | DONE | |
| Lightning Staff hits every enemy ≥5 apart | DONE | |
| Codex curses compound | DONE | |
| Falchion heals on kill | DONE | |

## Buildings

| Feature | State | Note |
| --- | --- | --- |
| Fixed authored plots, no free placement | DONE | Plots are typed: economy, defence, garrison, wall, waterside, crossing. |
| Per-map building availability | DONE | Each holding carries only the buildings the wiki's availability table lists for it. Field is Neuland/Nordfels/Durststein; the Bridge is Uferwind alone. |
| House, Mill, Gold Mine | DONE | Mill grows 1/2/6, mine decays 1/night, correct costs (2 / 3 / 5). |
| Field | DONE | 1 gold, 10 health, 1 gold a morning — it pays for itself the first dawn. Opened by building a Mill, and with no upgrade tiers, both as documented. |
| Fishing Harbour | DONE | 3 gold, 60 health, 7 to upgrade to 120. Lays one boat a night to a cap of five and pays 1 gold a boat, 2 after the upgrade. A harbour that spent the night in rubble keeps its boats but lays none and pays nothing — the published rule, and it is what makes losing one cost two mornings. |
| Bridge | PARTIAL | 2 gold, 1 gold a morning, and it opens the far bank: a real walkable deck that the flow field, your troops and the enemy all use. Its wiki page reads like copy-paste from the House ("the basic income building"), so the income half is taken at face value and the distinctive "access new build plots" half is what is actually built. That it cannot be attacked is this build's call. |
| Blacksmith — multi-night research | DONE | 4 / +9 / +16 gold, 80 health at every level. One project per level, chosen from four at construction and again at each upgrade, repeatable: Melee Attack +20% (3 nights), Ranged Attack +20% (3), Melee Resistance +30% (2), Ranged Resistance +30% (2). Progress ticks one night per night and persists across them. |
| Royal Forge — multi-night research | DONE | 4 / +7 / +14 gold, 80 health. Lighter Weaponry −40% auto-attack cooldown (2 nights), Additional Armor +50% king health and regeneration (2), Blessed Weaponry −40% ability cooldown (2), Sharper Weaponry +50% king damage (3). |
| One smith of each kind per holding | DONE | The developers cut Totend from two Royal Forges to one because "the double forges made the level too snowbally"; one of each is enforced everywhere. |
| Faster Research perk | DONE | Rewritten to its published effect — a night off every project and 1 gold off both smiths. It used to be a flat −1 on every upgrade in the game, which is not what it does. |
| Research queue | N/A | There is no queue in the original: the slots run in parallel, one per level. Whether their timers gate each other is not documented; here they do not. |
| Tower, 1-of-4 at level 2 and again at level 3 | DONE | Castle / Sniper / Armoured / Bunker, then Archer's / Ballistic / Fire / Healing Spire, with the documented targeting modes (closest, highest-health, lowest-health, random). |
| Mill 1-of-4 speciality at construction | DONE | Improved Plow, Explosive Trap, Scarecrows, Wind Spirits (arrow interception included). |
| Shrine, inert until 350 health of enemies die nearby | DONE | |
| Barracks and Archery Range, unit type locked at construction | DONE | 3 / 5 / 8 troops by level, against the original's 4 / 8 / 12 — trimmed for readability. |
| Hero's Quarter with one champion, ×1/×2/×4 by level | DONE | Golem, Support Mage, Firewing. |
| Wall, Barricade | DONE | Barricade's 15 true damage to fast enemies included. |
| Castle Center 1-of-4 at level 2 and level 3 | DONE | Royal Training, Builder's Guild, Magic Armor, Assassin's Training; then Royal Mastery, Commander, Castle-Up, Godly Curse. |
| Castle Center shoots | DONE | Rate scales 0.25 / 0.5 / 1.0 with level. |
| Building tiers gated behind Castle Center level | PARTIAL | Mine, Shrine and Hero's Quarter need level 2; the original's gating is finer-grained. |
| Gate | ADDED | Not in the original. See the README. |
| Temple | MISSING | No wiki page exists — the sitemap lists 17 building URLs and `temple.html` is not one of them. What two bug reports and one strategy thread between them describe: a third research building gated on an "energy" resource with 18 units, a bar that fills per night, a repeatable "Blessing", and a level-3 "sacrifice" that kills your own units for a higher spawn rate. No cost, health or tier numbers exist. Building it would be invention wrapped around two bug reports, so it is not built. |
| Summoning Circle | MISSING | Worse sourced than the Temple: a single unverified forum post says it lets you "hire enemies… so that you can profit of them". Not built. |

## Enemies

| Feature | State | Note |
| --- | --- | --- |
| 21 types with per-type targeting | DONE | 21 non-boss types, the two moles among them, and five bosses on top. |
| Targeting classes: none / castle / king / units / building / defensive / economic | DONE | Racers and Exploders never stop for the king; Hunterlings only ever want the king. |
| Damage-type multipliers and resistances | DONE | Melee/ranged tags, per-tag multipliers, flat damage that resistance cannot reduce, and a `tower` tag so an enemy can declare itself soft against defence towers. |
| Elite variants: ×4 health, ×3 damage, every third spawn | DONE | Assigned when the wave is composed, so the telegraph can name them. |
| Mole Archer / Mole Knight | PARTIAL | Every published number is in: 50/60 health, speed 5, range 40/3, 3.75/5 damage, projectile speed 20, dig range 30, dig cooldown 8–16 s, the Knight's 5 s chase, the per-target multipliers, and ×1.5 damage taken from defence towers. The dig relocates them up to 30 toward their target through terrain. **Decided here, not cited:** they cannot be seen or hit while under (0.7 s), and they surface at the last walkable point on the line to their target. Dig speed is marked "TBD" on the wiki itself. |
| Shadow in the Water — spawns instead of attacking, damaged by spawning | DONE | Does not destroy the lake harbours, does not rotate through five fixed lake positions. |
| Strange Statue ×4 on the final night | DONE | Melee and a dig attack are not separated; one attack profile. |
| Elara the Vile, Iron Castle, The Corrupt King | PARTIAL | The three late-map bosses. Only their **names** and which map they close are documented. Every stat and behaviour is invented, with one exception: the Corrupt King leaps constantly, which players report while explaining why the Blood Wand fails on him — so he does, on a 4–7 s cooldown. |
| Enemies attack the player when hit, even with no preferred target | PARTIAL | They engage whatever is adjacent, including you, but do not specifically retaliate against the source. |

## Progression

| Feature | State | Note |
| --- | --- | --- |
| Overworld map of levels, unlocked in sequence | DONE | A drawn map, not a card grid: a seeded landmass triangulated into flat facets painted from height and biome exactly the way the 3D terrain is, with snow, desert and volcanic regions, mountains, forests, and the holdings joined by roads that light up as they open. Every keep is drawn from polygons; locked ones are grey with a padlock. Hovering a node fills a side panel. `src/overworld.js`. |
| 10 maps | DONE | Neuland, Nordfels, Durststein, Frostsee, Uferwind, Sturmklamm, Wildbach, Moorweg, Freifort, Totend. |
| Moorweg / Freifort / Totend | PARTIAL | What is documented is in: their place in the order (8th, 9th, 10th), their night counts (12 / 13 / 15), their boss names, and which buildings each carries. **Invented:** biome, spawn layout, starting gold, difficulty, and every boss behaviour. Their wiki pages are not in the sitemap and carry no biome field, no spawn prose and no boss mechanics. |
| Per-map night counts, spawn counts, flyer-only spawns | DONE | Nordfels is 5 spawns with 3 flyer-only, as documented. |
| Account level unlocks perks, weapons, mutators | DONE | Documented to level 54. |
| Perk slots themselves unlock with level | DONE | 1 → 2 → 3 → 4 → 5. |
| 29 perks | PARTIAL | The wiki documents 37; Steam claims 50+. Names and effects match where documented. |
| 15 mutators, unlimited stacking, compounding multipliers | DONE | |
| Score formula (survive + realm protected + time bonus, then gold×10, then mutators) | DONE | Unchanged by this pass. The no-restart ×1.1 bonus is not tracked. |
| Best score per map, persisted | DONE | |
| Eternal Trials: 1-of-3 draft of map + weapon + 2 perks, perks stack, `won²×10000` bonus | DONE | Wave generation does not use the Trials-specific rolls (mono-battle, mono-spawn, economy tiers). |
| Quests | MISSING | Six lettered objectives per map exist in the original, and two Freifort and three Totend objectives are quoted on the wiki. Not implemented. |
| The other 11 mini-modes (Reverse Siege, True Endless, Summoner Gold…) | MISSING | Nine of the twelve names are not even published. |
| Leaderboards | MISSING | Local best scores only. |

## Look and feel

| Feature | State | Note |
| --- | --- | --- |
| Flat low-poly, tiny palette, no textures | DONE | All geometry generated in code; colours all live in one file. The overworld map is generated from the same palette. |
| Outlines on objects | DONE | Inverted-hull, world-space width — so it thins slightly when zoomed out, where the original's is screen-constant. |
| Fixed high isometric camera, no rotation | DONE | Fixed yaw and pitch, follows the king, zoom only. |
| Blue player / red enemy colour coding | DONE | |
| Per-biome palette swap | DONE | Grass, desert, snow, volcanic. |
| Day: one hard directional light, sharp shadows | DONE | |
| Night: directional drops out, local warm point lights take over | DONE | Six keep torches plus a lantern on the king. |
| Ambient weather | DONE | Rain on Sturmklamm, and on Totend. |
| Water, and coastline you can build on | DONE | Maps with a coast carve an inlet from the sea toward the keep, narrow at the head and widening to the mouth, dropped into the widest gap between two approach roads so it never swallows one. A harbour plot only lands where the ground is dry AND the water is within five metres, so a Fishing Harbour genuinely stands on the bank. Still no shore foam or depth tint. |
| Diegetic build prompt at the plot | PARTIAL | The plot highlights and Space opens it, but the cost prompt appears in a panel rather than floating over the plot. |
| Colourblind settings / customisable enemy colour | MISSING | |

## Not attempted

Multiplayer, cloud saves, Steam integration, the quest system, the Temple and Summoning Circle,
gamepad input, key rebinding, leaderboards, and the nine unpublished mini-modes.

## Honest summary

The two-phase loop, the economy-versus-defence tension, the plot-and-upgrade-tree building
system, multi-night research, the enemy targeting rules, the king-as-a-unit combat, troop
commanding, target lock, the perk/mutator loadout, the score formula and the Eternal Trials draft
are all here and behave like the original. All ten maps exist, all nine weapons, and twenty-one
enemy types with five bosses.

What is thinnest, and why. The Temple and Summoning Circle are absent because nothing published
describes them beyond two bug reports and one forum claim. Three weapons have the right behaviour
and invented numbers, because no numbers for them exist anywhere. Three maps have the right night
counts, boss names and building sets but invented layouts and invented boss mechanics. The moles'
underground invulnerability and emergence point are decisions, not citations, and so are the
troop-type filter keys. Quests, leaderboards, gamepad input and key rebinding are not implemented
at all, and the perk list stops at 29 of a documented 37.
