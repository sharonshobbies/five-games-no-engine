# Fidelity checklist

Honest audit against the original *Slither.io* (2016). `DONE` means it behaves as the original does,
`PARTIAL` means it exists but is simplified or differently tuned, `MISSING` means it is absent.

**Overall: close on movement and economy, close on the shape of bot play, short on the encirclement
kill and on everything social.** Movement, growth, boost economics and the death economy run on the
original's own constants and couplings and behave as it does. Bot play now has the right rhythm:
snakes persist (41.3s median life at the current speed scale, 24.4s at full speed, against 7.7s two
passes ago, on the same 30-minute measurement), grow (leaders past 3,300), hunt, sprint and contest
corpses, and bots both attempt encirclement and recognise being encircled. What is still missing is
the closed 360° trap, which the measurements below show is unreachable at the original's speed and
turn constants rather than unimplemented, and the Build-A-Slither skin editor, multiplayer, accounts
and unlocks, which are out of scope for a local single-player build.

**One deliberate departure from the original's magnitudes.** Every movement rate is multiplied by
`SPEED_SCALE` = 0.70, and the camera baseline is 0.86 px/unit rather than 1.16. Both are player
feedback rather than fidelity: the protocol constants played too fast to steer comfortably in a
7,000-radius arena, and the old camera framed a new snake too tightly to see a threat arrive. The
*couplings* are the original's and untouched — thickness still buys speed and costs turn radius, and
boost still buys no turn rate. `spangdv` and the boost cost are scaled with the speeds specifically so
those two properties survive the change; the rows below note where a quoted magnitude is scaled. Every
ratio is faithful, absolute pace is 0.70 of the original's, and the whole arena including the bots runs
on the one factor.

## Core movement

| Feature | Status | Note |
| --- | --- | --- |
| Point-to-steer with limited turn rate | DONE | head chases the cursor's world angle at `mamu·scang·spang` rad per 8ms tick; `mamu` is angular and unscaled |
| Turn rate degrades with thickness | DONE | the original's `scang = 0.13 + 0.87·((7−sc)/6)²`; 4.1 rad/s thin vs 1.2 rad/s fat |
| Speed rises with thickness | PARTIAL | `nsp1 + nsp2·sc + 0.1` with the original's coupling, every term × `SPEED_SCALE` 0.70: 515 units/s thin rising to 633 at the part cap |
| Boost gives no extra turn rate | DONE | angular speed saturates at `spangdv` (4.8 × 0.70 = 3.36, so the knee sits below cruise as it does in the original), so sprinting doubles turn radius |
| Turn radius couples to speed | DONE | `speed / turnRate`, 125 units thin to 516 at the part cap — tightened by the same 0.70, since `mamu` did not move |
| Serpentine body-follow lag | DONE | body parts sample the head's recorded path at fixed arc-distance |
| Fixed-tick simulation | DONE | 8ms ticks with the fractional remainder carried, so feel is refresh-rate independent |
| Body part separation scales with thickness | DONE | `wsep = 6·sc`, so a fat snake is also a long one |

## Growth and economy

| Feature | Status | Note |
| --- | --- | --- |
| Eat orbs to grow longer and thicker | DONE | |
| Orb magnet / suction near the head | DONE | pulls from `2.6·eatRadius`, strength ramps with closeness |
| Boost costs mass and sheds a pellet trail | DONE | 9.5 × `SPEED_SCALE` = 6.65 mass/s, one 1.6-mass pellet per interval, thrown off the tail. Scaled with the speeds so the mass spent per unit of ground closed is unchanged, which is what keeps a chase worth starting |
| Cannot boost below a minimum length | DONE | length 22 |
| Visibly shrink and thin while boosting | DONE | thickness is derived from mass every frame, so it is continuous |
| Dead snake becomes a line of high-value orbs | DONE | 68% of mass along its own body path; a 1600-length snake leaves 218 orbs |
| Corpse orbs are fatter and brighter than pellets | DONE | 5 mass each, brightened toward white but keeping the dead snake's hue |
| Wall death drops no food | DONE | matches the original |
| Appearance saturates while score keeps rising | DONE | parts cap at 215; the original caps at `mscps` |
| Prey critters worth a lot, that flee | PARTIAL | 16 present, they wander and bolt from heads; the original's spawn/behaviour rules are undocumented |
| Exact score-to-length curve (`fpsls`/`fmlts` tables) | PARTIAL | the original's logistic lookup tables are not published; approximated as `40 + 1.62·mass^0.60` |

## Killing and death

| Feature | Status | Note |
| --- | --- | --- |
| Your head into a foreign body kills you | DONE | |
| Your own body never kills you | DONE | self-collision does not exist in the model |
| Length is not armour | DONE | a length-12 snake can kill the leader |
| Others die on your body the same way | DONE | one rule, applied to every head including the player's |
| Arena border kills on contact | DONE | |
| Kill credit and kill count | DONE | shown in the HUD and on the death screen |
| Death screen with final length and instant restart | DONE | plus cause of death, rank, kills, persisted best |
| Death burst particles | PARTIAL | additive spark burst; the original's specific explosion animation is not reproduced |

## Bots

| Feature | Status | Note |
| --- | --- | --- |
| Seek nearby food | DONE | food mass sampled at three points along each candidate heading, capped so a corpse cannot outvote safety |
| Avoid bodies | DONE | swept-capsule probe scaled to the bot's own turn radius, integrated along the arc the snake would actually fly |
| Anticipate a snake cutting in front | DONE | candidates scored against ground a neighbour will already have covered, extrapolated 0.56s; the largest single survival term |
| Turn away from walls | DONE | inward bias ramps quadratically past 72% of arena radius; 0.6% of deaths are wall deaths |
| Occasionally boost | DONE | gated on clearance ≥93% of probe length, abandoned below 62%; 18.9% boost duty cycle, 1.5% of deaths mid-sprint |
| Attempt to cut off the player | DONE | assassin and scrapper lead the target's future position and aim across its path |
| Attempt to encircle | PARTIAL | coilers commit a ring around a victim they can out-turn, hold a bearing ahead of its nose, and convert 0.47 kills/min of the snake they are wrapping (1.10/min at full speed). The wrap is a median 150° of body with 195° of gap open at the kill: a closed 360° loop is not reachable at these constants, see below |
| Distinct personalities | DONE | grazer, scrapper, assassin, coiler, with per-bot greed/caution/aggression |
| Imperfect information and reaction delay | DONE | probe horizon is the bot's own turn radius (clamped 224–1,820 units, the clamp carrying `SPEED_SCALE` so it stays in proportion to the turn circle it bounds), neighbours seen within 1,100, their headings extrapolated 0.56s, decisions every 55–140ms |
| Bots eat corpses and fight each other | DONE | one AI, no player special-casing; leaders reach length ~3,370 unattended |
| Bots defend against being coiled | DONE | a 16-direction ring scan separates a pocket from a wall; past 10 of 16 shut the bot commits to the widest gap and sprints out if it needs no turning. Boxed-in bots escape 59% of the time against 35% before the AI pass |

## Presentation

| Feature | Status | Note |
| --- | --- | --- |
| Dark background with hex lattice | DONE | procedural in the fragment shader, crisp at every zoom |
| Clearly marked circular arena boundary | DONE | pulsing red danger band, hot edge line, void beyond, lattice fading into it |
| Brightly glowing multi-coloured snakes | DONE | additive bloom pass under every body |
| Banded / striped skins | DONE | 12 skins, band length proportional to thickness so patterns stay in scale |
| Soft additive glow on food | DONE | halo plus core, each orb twinkling on its own phase |
| Eyes on the head tracking direction of travel | DONE | pupils lead the turn by the steering delta |
| Visible speed/glow effect while boosting | DONE | wider brighter halo, body colour lifted 1.3×, pulsing head flare |
| Camera follows and zooms out with length | DONE | damped follow, thickness-driven zoom, small kick on death. Baseline is 0.86 px/unit against the original's tighter framing, widening to 0.494 at the part cap — a 1.74× pull-back over a run |
| Nicknames over snakes | DONE | projected DOM labels, size scaled by thickness |
| Tail taper | DONE | last stretch narrows to a point |
| Dark outline separating adjacent snakes | DONE | shell pass one radius step out |
| Build-A-Slither custom per-segment skin editor | MISSING | 12 preset skins only |
| Skin thumbnail previews on the title screen | DONE | each drawn as a small banded snake with eyes |

## UI and progression

| Feature | Status | Note |
| --- | --- | --- |
| Live top-10 leaderboard by length | DONE | your row highlighted, colour chip per snake |
| Current length and rank readout | DONE | plus kills |
| Minimap with snake positions | DONE | every snake as a polyline, player in white, refreshed 18×/s |
| Nickname entry | DONE | persisted in `localStorage` |
| Skin choice | DONE | |
| Best score persistence | DONE | `localStorage` |
| Kill feed | DONE | extra: nearby deaths and your own kills |
| Sound | DONE | WebAudio synthesis: pitch-climbing eat blips, sprint hiss, death thud, kill chime, mute toggle |
| Score-chasing loop rather than unlocks | DONE | matches the original's progression model |
| Cosmetic unlocks / accounts / daily high score | MISSING | out of scope for a local single-player build |

## Not attempted

| Feature | Status | Note |
| --- | --- | --- |
| Multiplayer, servers, sector streaming | MISSING | explicitly out of scope; bots are local |
| Mobile virtual joystick UI | MISSING | touch steering and touch-to-boost work, but there is no on-screen stick |
| Spectator / replay of your own death | MISSING | the death screen sits over a live spectator camera following the leader, which is close but not the original's behaviour |

## Bot behaviour, measured

30 simulated minutes across six seeds with no player in the world, via `tools/probe-ai.mjs`.

| | Old AI | Refined AI, full speed | Now, `SPEED_SCALE` 0.70 |
| --- | --- | --- | --- |
| deaths per second | 2.71 | 1.00 | 0.54 |
| median bot lifetime | 7.7s | 24.4s | 41.3s |
| mean bot lifetime (population / death rate) | 11.1s | 30.0s | 55.4s |
| 90th-percentile lifetime | 22.2s | 55.0s | 93.0s |
| died mid-sprint | 36.5% | 1.5% | 0.5% |
| died on the wall | 1.3% | 0.6% | 0.8% |
| leader length, median sample | 2,042 | 2,682 | 3,372 |
| mean snake length | 470 | 679 | 809 |
| kills of a snake the killer held a ring around | 0 | 33 (1.10/min) | 14 (0.47/min) |
| encirclement deaths as a share of body deaths | 3.3% | 5.7% | 8.5% |
| boxed-in bots escaping within 3s | 35% | 61% | 59% |
| scripted player's kills per minute alive | 6.6 | 2.37 | 0.93 |
| simulation cost per update | 0.42ms | 0.37ms | 0.31ms |

Reading the third column: slowing the arena stretches the wall clock by 1/0.70, which alone would put
deaths at 0.70/sec, so the measured 0.54 is 23% below a pure time-base effect. The remainder is
manoeuvrability — turn circles shrank by 0.70 against body radii and arena distances that did not
move, so every snake dodges better. Two rows are partly measurement artefacts and not behaviour: the
escape-rate row asks whether a bot is alive 3.0 fixed wall-clock seconds later, a window that now
covers 0.70× the ground, and the scripted-player row is a fixed script tuned against the fast arena
rather than an identical arm. Population stayed at 30 rather than being raised to restore the old
churn; the change was asked for as comfort, and a calmer arena is what it buys.

## Known weak points

- **Coilers land a half ring, not a closed loop.** At the moment of a coil kill the victim has a
  median 150° of the coiler's body around it and 195° of gap still open; rings travel past 270° twice
  in 30 minutes, the longest reaching 395°. This is a limit of the movement model, not of the AI:
  two snakes of equal speed means the coiler spends its whole speed keeping up with nothing left to
  go round with, so closure needs the victim pinned in a full-lock turn, and lining a circle at the
  tightest carveable radius takes 2π turn radii of body against a body-length-to-turn-radius ratio
  that peaks at 7.6 (thickness caps at 4.37 under the 215-part limit). Demanding a fully closable
  ring was tried and measured: coil commitments fell from 5.4 to 2.5 per minute and kills from 1.20
  to 0.43 per minute, and not one ring got longer. The argument is scale-free, so `SPEED_SCALE` did
  not move it: body length and turn radius are both distances and both scaled together. What did move
  is that rings are now held longer and travelled further — 44° of arc against 26°, a 395° maximum
  against 337°, held 1.6s against 1.1s — while converting to a kill less often (11.5% of commitments
  against 19.1%), because tighter turn circles help the victim leave a ring as much as they help the
  coiler build one.
- **The dedicated break-out barely earns its place.** Boxed-in escape went 35% → 61% on the AI pass,
  and reads 59% at the current speed scale, but removing the ring scan and keeping the rest still
  measures 60%. The improvement is better path probing; the scan itself fires on 1.9% of decisions and
  is worth about 1 point of escape rate.
- **The player kills bots far less often than against the old AI.** A scripted cut-off policy drops
  from 6.6 to 2.37 kills per minute alive against the refined AI at full speed, and to 0.93 at the
  current speed scale. Most of the old rate was bots blundering into a snake driving straight at them,
  which is what was fixed, and capping the crossing-prediction horizon at 0.56s returned a third of it.
  The further drop at 0.70 speed is partly bots dodging better on tighter turn circles and partly the
  probe itself: that policy's lead and boost distances were tuned against the fast arena, so it is not
  an identical arm and the figure is not a clean AI comparison. Cutting a bot off needs a bait rather
  than a collision course.
- **Slowing the arena halved the churn.** 1.00 → 0.54 deaths/sec and a 24.4s → 41.3s median bot life,
  about a third of it beyond the 1/0.70 wall-clock stretch. Fewer corpses to feed on, a quieter kill
  feed, and a leader 26% longer because snakes survive to grow. Left as measured: restoring the old
  churn would have meant raising the population, and the change was requested as steering comfort.
- **A third of bot deaths are still to the bot's own target.** Gating aggression on clearance
  squared reduced it but did not remove it; hunting in this game is genuinely close to suicide.
- **The score-to-length curve is approximated**, so absolute lengths are not comparable to the
  original's numbers even though the shape (fast early, saturating late) matches.
- **Fill-rate heavy under software rendering, and the wider camera adds to it.** 50ms median frames in
  headless SwiftShader with a length-2,700 player. Simulation is 0.6ms of that; the rest is
  additive-blend overdraw, which is cheap on real hardware but is the honest ceiling in the harness.
  The 1.16 → 0.86 baseline shows 1.8× the area and draws about 1.9× the sprites (345 → 654 instances at
  1,280×720 with a length-24 player), all of it fill: `probe-ai.mjs perf` went *down*, 0.355ms →
  0.313ms, because deaths halved and a death is the expensive event. No hardware-GL measurement was
  taken, so 60fps on a real GPU is an inference, not an observation.
