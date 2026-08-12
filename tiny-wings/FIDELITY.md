# Fidelity checklist

Honest self-assessment against Tiny Wings (Andreas Illiger, iOS 2011). `DONE` means I believe it
matches in behaviour and feel; `PARTIAL` means present but a visible or mechanical step short;
`MISSING` means absent.

## Core mechanics

| Feature | Status | Note |
| --- | --- | --- |
| One input only (hold to dive, release to glide) | DONE | Mouse, touch and `Space`; nothing else is bound to gameplay. |
| Dive multiplies gravity | DONE | ×4. Descending gains ~4× energy, ascending loses ~4×, which is what makes timing matter. |
| Dive on downslope to build speed | DONE | Ground friction drops to 0.10 diving downhill vs 0.30 gliding. |
| Holding into an upslope punishes you | DONE | Friction jumps to 1.05 — plowing, not a free fast mode. |
| Launch off the crest | DONE | Physical: leaves the surface when `v²·κ` exceeds what gravity + adhesion can hold. |
| Diving pins you to the hill, releasing pops you off | DONE | Adhesion 2200 diving vs 150 gliding — the "hold through the valley, release on the way up" loop. |
| Momentum is everything / compounding speed | DONE | Pumping a valley nets ~2.4·g·Δh per cycle; skilled play hits ~950 units/s vs ~250 with no input. |
| Great Slide = whole valley with no bounce | DONE | Enter a real downslope, pass the valley floor, come off the far crest, never bounce. 10 pts. |
| Bounce breaks the slide | DONE | Impact normal speed over 188 bounces; that is the failure condition. |
| A bad landing costs momentum, not a pinball | DONE | Retuned: the stick window is wide (188), a hard stick scrubs up to 45% of tangential speed, and past the window the bird bounces once then plants and plows for a further 42%. Scripted imprecise play now bounces 13 times per 60 s, down from 20. |
| Fever after 3 consecutive Great Slides | DONE | Doubles all points, continues while the chain holds, resets on any bounce or splash. |
| Fever visual flourish | DONE | Star trail, warm grade on grass and sky, warm speed vignette, HUD tag, ascending arpeggio. |
| Mid-air "mini taps" to aim a landing | DONE | Falls out of the model for free — a tap in the air steepens the descent to line up the downslope. |
| Bird cannot actually fly | DONE | No lift beyond a small glide damping; all altitude comes from launches. |

## Progression

| Feature | Status | Note |
| --- | --- | --- |
| Day Trip across a sequence of islands | DONE | Endless island sequence, each with its own palette and hill character. |
| Night is chasing you; run ends when it catches you | DONE | A wall of night advances at 108→340 units/s. Not a death — the only fail state. |
| Each island reached buys back daylight | DONE | Pushes the night front back ~980 units and visibly brightens the grade. |
| Distance is the headline score | DONE | Metres shown live and in the summary, best persisted. |
| Islands get harder | DONE | Longer wavelengths, taller hills, slightly steeper ratio, and the night ramps up. |
| Coins (3 pts) | DONE | Deterministic arcs hugging crests plus high arcs that reward a big launch. |
| Cloud touches (20 pts) | DONE | Puffs at altitude; touching one scores and greys it out. |
| Nest upgrades raising the score multiplier | DONE | ×10 at nest 1, +2 per nest, persisted in localStorage. |
| Missions that unlock nests | PARTIAL | Eight missions in the original's spirit ("reach island 4", "5 Great Slides in one trip"); the real list is not documented anywhere I could find. |
| Procedural visuals that differ every day | DONE | A day seed rotates palette families and reseeds every island's terrain, coins and clouds. |
| Night mode | PARTIAL | A "Night Trip" pill on the title screen renders the whole run at night. The original's Night mode may differ mechanically. |
| Race leaves progression alone | — | My call, not the original's: a race does not touch the nest, the missions or the best distance, so progression stays a property of the Day Trip. |
| Multiplayer race vs 3 AI birds | DONE | A Race pill on the title screen runs 600 m of the same islands against three AI birds. Each rival owns a real `Bird` on the real terrain stepped by the same substep loop — the player's physics, not a second model — and only decides when to hold. Skill is reaction rate, look-ahead, slope threshold, whether it aims landings mid-air, and a blunder rate; it wobbles per race so the order is not fixed. Positions ride a ribbon along the bottom, rivals are visible in-world, and the summary lists placings and times. Local AI only — no networked play. |
| Per-island named levels / replay at higher difficulty | MISSING | The later Tiny Wings 2 / "Flight School" structure, not the original Day Trip. |

## Visuals

| Feature | Status | Note |
| --- | --- | --- |
| Striped/banded hills | DONE | Diagonal stripe pattern displaced by the terrain height field, exactly the original's trick; antialiased with `fwidth`. |
| Bright saturated per-island palettes | DONE | Twelve families, each pairing hills with a contrasting sky hue. |
| Palettes cross-fade between islands | DONE | Spatial blend across the bay for sky, hills, sea, sun and clouds. |
| Layered parallax background | DONE | Sky gradient, sun, drifting cloud band (0.14), far ridge (0.26), mid ridge (0.52), sea — all analytic in one pass. |
| Sun, and a moon at night | DONE | Sun lowers toward the horizon as darkness grows; moon and twinkling stars rise. |
| Water | DONE | Rolling ripple bands that slow and spread with depth, ripple lines, a sun glint column, bright shoreline lip. |
| Smooth day → dusk → night grading | DONE | Golden-hour pass then night, driven by run time and how close the night front is. |
| Small round bird with flapping wings | DONE | Procedural canvas art; flap rate and amplitude change between grounded, diving and gliding. |
| Trailing sparkle when fast | DONE | White motes over 520 units/s, gold stars in Fever, denser over 800. |
| Landing dust puffs | DONE | Scaled by impact; heavier and louder on a bounce. |
| Water splash | DONE | Droplet burst on entry plus continuous spray while skimming. |
| Camera follows, zooms out at speed/height | DONE | 272→760 world units of width; framed by width so the read survives any aspect ratio. |
| Screen shake at high impact | DONE | On bounces, big launches, splashes, island arrivals. |
| Motion blur at speed | DONE | Directional, velocity-aligned: the bird's sprite is redrawn along the path it actually travelled over the last ~42 ms (time-stamped history, interpolated between frames so the ghosts do not clump into discrete copies), plus a tapered streak quad rotated to the direction of travel. Fades in from 520 units/s, capped low, and drawn behind the crisp bird so the read survives. The speed vignette and denser trail are still there on top of it. |
| Watercolour paper texture | PARTIAL | Procedural grain and fbm blotching in the hill shader; softer and less papery than the original's. |
| Bird falls asleep at sunset | DONE | It settles onto the hill, the face swaps to a closed eye and a smile, the wings stop, and "z"s rise. The camera shifts so the beat is not behind the summary card. |
| Nest visible in the world | DONE | A woven nest with two eggs on the first crest, with the mother asleep beside it, breathing, her own z's rising. It stays put, so on a short run you see it behind you. The title screen opens on it with the player's bird asleep alongside. |
| Environmental characters | DONE | Four distant flock silhouettes drifting across the upper sky at their own speeds and wingbeats, and a fish that jumps out of a bay and splashes back in every few seconds when open water is on screen. Kept small, high and few so they never read as obstacles. No frogs. |

## UI / audio

| Feature | Status | Note |
| --- | --- | --- |
| Title screen | DONE | Procedural logo, instructions, nest and best, Day / Night / Race pills, and the nest with the mother and the bird asleep beside it framed clear of the card. |
| Live distance, score, island readout | DONE | Score counts up rather than snapping. |
| Speed and Fever indicator | DONE | Speed meter plus three chain dots and a Fever tag. |
| Night-proximity indicator | DONE | Right-hand bar that fills as it closes on you. |
| Great Slide / Fever popups | DONE | World-anchored floating text with the points earned. |
| Island arrival banner | DONE | Number, palette name, "+ daylight". |
| End-of-run summary | DONE | Distance, new-best flag, score, islands, Great Slides, coins/clouds, top speed, best, nest state, next mission. |
| Restart | DONE | Tap or `Space`. |
| Music | PARTIAL | A synthesised pad that changes key per island — nothing like the original's actual composed track. |
| Sound effects | DONE | Wind tracking speed, landings, bounces, launches, coins, clouds, slides, Fever, splashes, sunset — all WebAudio synthesis, no files. |
| Haptics | MISSING | No touch device target here. |

## UI additions

| Feature | Status | Note |
| --- | --- | --- |
| Race position ribbon | DONE | Four markers along the course with a chequered cap at the finish, the ordinal you are running in, and the gap to the bird ahead (or how far clear you are while leading). Replaces the night bar, which a race does not have. |
| Race results | DONE | Placement as the headline, then all four birds by place with colour swatches — times for the finishers, metres left to run for anyone still out on the course. |

## Known weak spots

1. **Music is a pad, not a tune.** Synthesising something as good as the original's track was out of
   reach; what is there is atmosphere.
2. **The race is local AI only.** No networked or same-device human opponents, and the four birds
   share one 2D track rather than a split screen — rivals are drawn translucent and lifted a couple
   of world units apart so a pack stays countable.
3. **Watercolour paper texture is still too clean.** Procedural grain and fbm blotching, softer and
   less papery than the original's.
4. **Missions are invented.** Eight in the original's spirit; the real list is not documented
   anywhere I could find.
5. **Bounce rate is tuned, not matched.** 13 per 60 s of scripted imprecise play, down from 20. I
   have no measurement of the original's rate to compare against — the target was the described
   feel, that a bad landing costs momentum and the bird settles into a slide.
6. **Retuning the landing model forced a night-chase retune.** Once bad landings stopped stopping
   the bird dead, a skilled run stretched about 45% further, because reaching more islands buys more
   daylight which buys more islands. The night's top speed went 340 → 420 and the per-island
   pushback stopped growing with the island index, which puts the four probe strategies back on the
   distances the game was balanced against. The physics change and the difficulty change are
   therefore entangled; only the probe separates them.

## Probe numbers

Eight day seeds, full run with the night chase, before and after this pass:

| Strategy | Distance before | Distance after | Bounces / 60 s before | after |
| --- | --- | --- | --- | --- |
| never hold | 221 m | 218 m | 2.0 | 1.8 |
| hold constantly | 1035 m | 976 m | 3.8 | 2.5 |
| dive on downslopes | 2048 m | 2074 m | 17.0 | 11.5 |
| dive + aim landings | 2093 m | 2436 m | 20.4 | 13.3 |

No run softlocks: the longest any run went without gaining 2 m is 7.3 s, which is a slow paddle
across a bay.

## Rough overall

Mechanics and progression are close — the dive/glue/pop loop, the Great Slide rule, Fever, the night
chase and the scoring values all match what the sources describe, and the landing model now pays for
a mistimed dive in momentum rather than in a bounce chain. Visual identity is close on the hills,
palettes, parallax and grading, and the run now opens and closes on the nest and the sleeping bird.
The race against three AI birds is in, and a competent player wins some races and loses others. What
is left is the soundtrack, the papery quality of the hill texture, and a race that is local AI rather
than true multiplayer. Call it **~92%** of the single-player Day Trip, and a credible first pass at
the race.
