# Fidelity checklist

Honest audit against the original *Slither.io* (2016). `DONE` means it behaves as the original does,
`PARTIAL` means it exists but is simplified or differently tuned, `MISSING` means it is absent.

**Overall: close on movement and economy, close on the shape of bot play, short on the encirclement
kill and on everything social.** Movement, growth, boost economics and the death economy run on the
original's own constants and behave as it does. Bot play now has the right rhythm: snakes persist
(24.4s median life against 7.7s a pass ago, on the same 30-minute measurement), grow (leaders past
2,600), hunt, sprint and contest corpses, and bots both attempt encirclement and recognise being
encircled. What is still missing is
the closed 360° trap, which the measurements below show is unreachable at the original's speed and
turn constants rather than unimplemented, and the Build-A-Slither skin editor, multiplayer, accounts
and unlocks, which are out of scope for a local single-player build.

## Core movement

| Feature | Status | Note |
| --- | --- | --- |
| Point-to-steer with limited turn rate | DONE | head chases the cursor's world angle at `mamu·scang·spang` rad per 8ms tick |
| Turn rate degrades with thickness | DONE | the original's `scang = 0.13 + 0.87·((7−sc)/6)²`; 4.1 rad/s thin vs 1.2 rad/s fat |
| Speed rises with thickness | DONE | `nsp1 + nsp2·sc + 0.1` at real magnitudes |
| Boost gives no extra turn rate | DONE | angular speed saturates at `spangdv` 4.8, so sprinting doubles turn radius |
| Serpentine body-follow lag | DONE | body parts sample the head's recorded path at fixed arc-distance |
| Fixed-tick simulation | DONE | 8ms ticks with the fractional remainder carried, so feel is refresh-rate independent |
| Body part separation scales with thickness | DONE | `wsep = 6·sc`, so a fat snake is also a long one |

## Growth and economy

| Feature | Status | Note |
| --- | --- | --- |
| Eat orbs to grow longer and thicker | DONE | |
| Orb magnet / suction near the head | DONE | pulls from `2.6·eatRadius`, strength ramps with closeness |
| Boost costs mass and sheds a pellet trail | DONE | 9.5 mass/s, one 1.6-mass pellet per interval, thrown off the tail |
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
| Attempt to encircle | PARTIAL | coilers commit a ring around a victim they can out-turn, hold a bearing ahead of its nose, and convert 1.10 kills/min of the snake they are wrapping. The wrap is a median 135° of body with 210° of gap open at the kill: a closed 360° loop is not reachable at these constants, see below |
| Distinct personalities | DONE | grazer, scrapper, assassin, coiler, with per-bot greed/caution/aggression |
| Imperfect information and reaction delay | DONE | probe horizon is the bot's own turn radius (320–2,600 units), neighbours seen within 1,100, their headings extrapolated 0.56s, decisions every 55–140ms |
| Bots eat corpses and fight each other | DONE | one AI, no player special-casing; leaders reach length ~2,680 unattended |
| Bots defend against being coiled | DONE | a 16-direction ring scan separates a pocket from a wall; past 10 of 16 shut the bot commits to the widest gap and sprints out if it needs no turning. Boxed-in bots escape 61% of the time against 35% before |

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
| Camera follows and zooms out with length | DONE | damped follow, thickness-driven zoom, small kick on death |
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

| | Before this pass | Now |
| --- | --- | --- |
| deaths per second | 2.71 | 1.00 |
| median bot lifetime | 7.7s | 24.4s |
| mean bot lifetime (population / death rate) | 11.1s | 30.0s |
| 90th-percentile lifetime | 22.2s | 55.0s |
| died mid-sprint | 36.5% | 1.5% |
| leader length, median sample | 2,042 | 2,682 |
| mean snake length | 470 | 679 |
| kills of a snake the killer held a ring around | 0 | 33 (1.10/min) |
| encirclement deaths as a share of body deaths | 3.3% | 5.7% |
| boxed-in bots escaping within 3s | 35% | 61% |
| scripted player's kills per minute alive | 6.6 | 2.1 |
| simulation cost per update | 0.42ms | 0.37ms |

## Known weak points

- **Coilers land a half ring, not a closed loop.** At the moment of a coil kill the victim has a
  median 135° of the coiler's body around it and 210° of gap still open; rings travel past 270° five
  times in 30 minutes and past 360° once. This is a limit of the movement model, not of the AI:
  two snakes of equal speed means the coiler spends its whole speed keeping up with nothing left to
  go round with, so closure needs the victim pinned in a full-lock turn, and lining a circle at the
  tightest carveable radius takes 2π turn radii of body against a body-length-to-turn-radius ratio
  that peaks at 7.6 (thickness caps at 4.37 under the 215-part limit). Demanding a fully closable
  ring was tried and measured: coil commitments fell from 5.4 to 2.5 per minute and kills from 1.20
  to 0.43 per minute, and not one ring got longer.
- **The dedicated break-out barely earns its place.** Boxed-in escape went 35% → 61%, but removing
  the ring scan and keeping the rest still measures 60%. The improvement is better path probing;
  the scan itself fires on 1.9% of decisions and is worth about 1 point of escape rate.
- **The player kills bots 3× less often.** A scripted cut-off policy drops from 6.6 to 2.1 kills per
  minute alive. Most of the old rate was bots blundering into a snake driving straight at them,
  which is what was fixed, and capping the crossing-prediction horizon at 0.56s returned a third of
  it. Cutting a bot off now needs a bait rather than a collision course.
- **A third of bot deaths are still to the bot's own target.** Gating aggression on clearance
  squared reduced it but did not remove it; hunting in this game is genuinely close to suicide.
- **The score-to-length curve is approximated**, so absolute lengths are not comparable to the
  original's numbers even though the shape (fast early, saturating late) matches.
- **Fill-rate heavy under software rendering.** 50ms median frames in headless SwiftShader with a
  length-2,700 player. Simulation is 0.6ms of that; the rest is additive-blend overdraw, which is
  cheap on real hardware but is the honest ceiling in the harness. No hardware-GL measurement was
  taken, so 60fps on a real GPU is an inference, not an observation.
