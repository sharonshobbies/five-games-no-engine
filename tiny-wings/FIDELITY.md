# Fidelity checklist

Honest self-assessment against Tiny Wings (Andreas Illiger, iOS 2011). `DONE` means I believe it
matches in behaviour and feel; `PARTIAL` means present but a visible or mechanical step short;
`MISSING` means absent.

## Core mechanics

| Feature | Status | Note |
| --- | --- | --- |
| One input only (hold to dive, release to glide) | DONE | Mouse, touch and `Space`; nothing else is bound to gameplay. |
| Dive multiplies gravity | DONE | ×4 down a slope, ×1.6 climbing, ×2.2 in the air. The asymmetry is the pump: a releaser nets +3·g·h over a valley, a holder +2.4·g·h and pays plow friction on top. |
| Dive on downslope to build speed | DONE | Ground friction drops to 0.10 diving downhill vs 0.46 gliding. |
| Holding into an upslope punishes you | DONE | Friction jumps to 1.05 — plowing, not a free fast mode. Constant hold reaches 813 m against diving's 2434 m. |
| Launch off the crest | DONE | Physical: leaves the surface when `v²·κ` exceeds what gravity + adhesion can hold. Only an ascending launch gains height — one taken on the falling side peaks at 0.0 m even at 575 units/s, because the hill drops away as fast as the bird. |
| Diving pins you to the hill, releasing pops you off | DONE | Adhesion 2200 diving vs 150 gliding — the "hold through the valley, release on the way up" loop. |
| Momentum is everything / compounding speed | DONE | Skilled play hits ~835 units/s vs ~294 with no input, with median arcs of 15.3 m for 1.66 s. |
| Flight is reachable at human reaction speed | DONE | Fixed this pass, and it is what the whole pass was for. A crest's launchable region is a quarter wavelength wide; before `HILL_SCALE = 1.35` a bird crossed it in 0.13 s against a human latency of 180–250 ms, so the window was narrower than the reaction that had to hit it. A 180 ms-latency model went from 4.3 m median height for 0.75 s to 10.3 m for 1.23 s; a player who reacts to the slope underfoot went from 0 arcs per 60 s to 11.8. |
| Great Slide = whole valley with no bounce | DONE | Enter a real downslope, pass the valley floor, come off the far crest, never bounce. 10 pts. |
| Bounce breaks the slide | DONE | Impact normal speed over 188 bounces; that is the failure condition. |
| A bad landing costs momentum, not a pinball | DONE | The stick window is wide (188), a hard stick scrubs up to 45% of tangential speed, and past the window the bird bounces once then plants and plows for a further 42%. Scripted imprecise play bounces 10.8 times per 60 s, 13.4 for the sloppy human model, down from 20 before this model. |
| Fever after 3 consecutive Great Slides | DONE | Doubles all points, continues while the chain holds, resets on any bounce or splash. |
| Fever visual flourish | DONE | Star trail, warm grade on grass and sky, warm speed vignette, HUD tag, ascending arpeggio. |
| Mid-air "mini taps" to aim a landing | DONE | Falls out of the model for free — a tap in the air steepens the descent to line up the downslope. The airborne dive multiplier is 2.2 rather than 4, so a tap aims the landing instead of slamming the bird down and cancelling the arc. |
| Bird cannot actually fly | DONE | No lift beyond a small glide damping (170); all altitude comes from launches. |

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
| Music | DONE | A composed four-bar piece (`I–V–vi–IV` in D major) with melody, bass, a sixteenth-note arpeggio, pad, drums and a bell layer, sequenced with a 0.3 s lookahead on the audio clock. Seven scenes change tempo and layer weights, never the notes; per-island the key moves through eight transpositions. Replaces the pad that a player heard as a monotone drone. Still WebAudio synthesis, no files. |
| Music mute + persisted preference | DONE | Bottom-right on every screen, `localStorage`-backed, survives a reload. Mutes the tune only, on its own gain node; the sequencer keeps running while muted so unmuting lands mid-bar. |
| Respects browser autoplay rules | DONE | No `AudioContext` and nothing scheduled until the first input; verified 0 notes scheduled before a gesture. |
| Sound effects | DONE | Wind tracking speed, landings, bounces, launches, coins, clouds, slides, Fever, splashes, sunset — all WebAudio synthesis, no files. Untouched by this pass; only the background bed changed. |
| Haptics | MISSING | No touch device target here. |

## UI additions

| Feature | Status | Note |
| --- | --- | --- |
| Race position ribbon | DONE | Four markers along the course with a chequered cap at the finish, the ordinal you are running in, and the gap to the bird ahead (or how far clear you are while leading). Replaces the night bar, which a race does not have. |
| Race results | DONE | Placement as the headline, then all four birds by place with colour swatches — times for the finishers, metres left to run for anyone still out on the course. |

## Known weak spots

1. **The music is mine, not a transcription.** It is a real composed loop now rather than a pad, but
   the original's track is copyrighted and I have not heard a transcription of it, so this is a
   cheerful piece in the same spirit rather than the same piece.
2. **The music has never been listened to.** It is verified only by assertion — notes scheduled,
   lookahead ahead of the audio clock, bar index in range, per-scene layer weights, per-island root
   frequency, mute persistence. Whether it is pleasant over five minutes is untested.
3. **The race is local AI only.** No networked or same-device human opponents, and the four birds
   share one 2D track rather than a split screen — rivals are drawn translucent and lifted a couple
   of world units apart so a pack stays countable.
4. **Watercolour paper texture is still too clean.** Procedural grain and fbm blotching, softer and
   less papery than the original's.
5. **Missions are invented.** Eight in the original's spirit; the real list is not documented
   anywhere I could find.
6. **Bounce rate is tuned, not matched, and it drifted down this pass.** 10.8 per 60 s of scripted
   imprecise play against the 13.3 it was tuned to, 13.4 for the sloppy human model. Bigger, gentler
   hills mean landings arrive better aligned with the slope, so fewer of them break the stick window.
   `STICK_SPEED` does not move the number — sweeping it 152 → 72 leaves the rate inside 10.6–11.0 —
   so the drop is a property of the terrain, not of the landing model. I have no measurement of the
   original's rate to compare against.
7. **Hills are 1.35× the size they were, and that is visible.** Fewer hills on screen at the same
   zoom, so the camera widened 272 → 330 world units at rest and 760 → 900 at full zoom-out. The bird
   is correspondingly smaller in frame. This is the cost of the timing fix, taken deliberately.
8. **Retuning the landing model forced a night-chase retune.** Once bad landings stopped stopping
   the bird dead, a skilled run stretched about 45% further, because reaching more islands buys more
   daylight which buys more islands. The night's top speed went 340 → 420 and the per-island
   pushback stopped growing with the island index. The physics change and the difficulty change are
   therefore entangled; only the probe separates them. This pass did **not** need a further night
   retune: constant hold sits at 813 m against the 976 m the night was balanced against, so the
   pacing the chase was set for still holds.

## Probe numbers

Eight day seeds, full run with the night chase, before and after the flight pass:

| Strategy | Distance before | after | Bounces / 60 s before | after |
| --- | --- | --- | --- | --- |
| never hold | 218 m | 179 m | 1.8 | 1.8 |
| hold constantly | 976 m | 813 m | 2.5 | 11.1 |
| dive on downslopes | 2074 m | 2434 m | 11.5 | 9.6 |
| dive + aim landings | 2436 m | 2785 m | 13.3 | 10.8 |

Monotonic in both columns. Constant hold moved *down*: it now launches off crests, and a holder that
spends time in the air scrubs speed on every landing, so the flight it gained cost it distance. Its
bounce rate rose from 2.5 to 11.1 for the same reason — it was previously glued to the ground and had
almost nothing to land from.

And the numbers the pass was actually about — whether the bird gets airborne, and whether the arc
reads as flight rather than as a hop. An "arc" is airtime ≥ 0.55 s *and* clearance ≥ 2.5 m above the
hill under the bird:

| Strategy | Arcs / 60 s before | after | Airborne before | after | Height med before | after |
| --- | --- | --- | --- | --- | --- | --- |
| never hold | 0.0 | 0.0 | 2% | 2% | 1.1 m | 1.3 m |
| hold constantly | 0.0 | 6.0 | 1% | 11% | 0.0 m | 3.9 m |
| dive on downslopes | 11.2 | 9.6 | 31% | 31% | 14.2 m | 18.2 m |
| dive + aim landings | 12.1 | 10.2 | 32% | 29% | 11.3 m | 15.3 m |
| *human*, 180 ms latency | 8.5 | 11.4 | 17% | 25% | 4.3 m | 10.3 m |
| *sloppy*, reacts underfoot | 0.0 | 11.8 | 1% | 20% | 0.0 m | 6.6 m |

Two different failures sat behind the same complaint. `sloppy` and constant hold were at flat zero —
a player who held the button, or who reacted to the slope under the bird, never left the ground at
all, at any speed, however long they played. `human` did get airborne, but at 4.3 m for 0.75 s
against the oracles' 14.2 m for 1.63 s: hops, not arcs. Median height for `human` is now 10.3 m and
median airtime 1.23 s. Median airtime elsewhere: 1.63 → 1.87 s for `dive`, 1.40 → 1.66 s for
`skilled`; max airtime 2.45 → 2.88 s and 2.17 → 2.45 s.

Launches per 60 s moved in both directions, which is the point: 2.5 → 11.2 for constant hold and
2.3 → 13.6 for `sloppy`, against 15.9 → 12.3 for `skilled`. The oracles launch slightly less often
and travel much further per launch.

No run softlocks: the longest any run went without gaining 2 m is 8.4 s, up from 7.3 s, which is a
slow paddle across a bay. `WADDLE_K = 1.06 × gEff` is unchanged and still scale-free, so the crawl
force still exceeds `g·sinθ` on any slope.

Race field over 24 races per scripted player: a button-masher wins 0%, diving on downslopes 46%
(was 38%), diving plus aimed landings 88% (was 79%).

## Rough overall

Mechanics and progression are close — the dive/glue/pop loop, the Great Slide rule, Fever, the night
chase and the scoring values all match what the sources describe, the landing model pays for a
mistimed dive in momentum rather than in a bounce chain, and the launch is now reachable at human
reaction speed rather than only by a frame-perfect bot. Visual identity is close on the hills,
palettes, parallax and grading, and the run opens and closes on the nest and the sleeping bird. The
race against three AI birds is in, and a competent player wins some races and loses others. There is
a composed soundtrack rather than a pad, though it is my composition and nobody has listened to it.
What is left is the papery quality of the hill texture, a race that is local AI rather than true
multiplayer, and a bounce rate that drifted 20% below its tuned value as a side effect of the bigger
hills. Call it **~94%** of the single-player Day Trip, and a credible first pass at the race.
