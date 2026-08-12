# slither — a from-scratch remake

A single-player recreation of Steve Howse's *Slither.io* (2016): steer a glowing snake by
pointing, eat orbs to grow, sprint at the cost of your own mass, and kill bigger snakes by
making them run their head into your body. Thirty AI snakes play the same game against you and
each other.

Vanilla ES modules, three.js r169, no build step, no bundler, no framework, no asset files.
Every pixel of art is generated in code at load time.

## Run it

Any static server, from the project root:

```
python3 -m http.server 8000
# then open http://localhost:8000
```

Opening `index.html` from `file://` will not work — ES modules need an HTTP origin.

Verification harness:

```
node ../claude-code-test-benchmark/verify-game.mjs . --shots 4 --wait 2500 --hold 1500 --click 900x300
```

## Controls

| Input | Action |
| --- | --- |
| mouse / finger | steer — the head turns toward the cursor at a limited rate |
| hold left or right mouse | boost |
| `space`, `↑`, `W` | boost |
| `enter` / `space` on a menu | play |

## What is implemented

**Movement.** The head steers at a limited turn rate toward the cursor; the body is not a chain of
springs but a path-follower — the head records a trail and every body part sits at a fixed
arc-distance behind it. That is what produces follow-the-leader serpentine motion and means a tail
can never cut a corner the head took.

**The real constants.** Speed, turn rate, thickness and their couplings are the original's, taken
from the reverse-engineered protocol (`ClitherProject/Slither.io-Protocol`) on the original's 8ms
tick. They are quoted at their real magnitudes and the whole movement model is then multiplied by
one factor, `SPEED_SCALE` = **0.70** (see "Slower, and zoomed further out" below):

| Constant | Original | Here | Effect |
| --- | --- | --- | --- |
| `nsp1`, `nsp2` | 5.39, 0.4 | 3.773, 0.28 | `speed = nsp1 + nsp2·sc + 0.1` — fat snakes move faster |
| `mamu` | 0.033 rad | 0.033 rad | base angular speed per tick — **not** scaled |
| `scang` | `0.13 + 0.87·((7−sc)/6)²` | same | fat snakes steer badly: 4.1 rad/s thin, 1.2 rad/s fat |
| `spangdv` | 4.8 | 3.36 | angular speed saturates here, so boosting buys no extra turn rate |
| `wsep` | `6·sc` | same | distance between body parts, so a fat snake is also a long one |
| `sc` | `min(6, 1 + (parts−40)/52)` | same | thickness from part count; `radius = 14.5·sc` |

Cruise runs 515 world units/second for a thin snake and 633 at the part cap, so thickness still buys
speed and costs handling: the full-lock turn circle widens from 125 units to 516 across that range.

The `spangdv` saturation is load-bearing rather than trivia: boosting doubles distance travelled
per tick without improving turn rate, so it doubles your effective turn radius. That is the entire
risk of sprinting, and both the player and the AI live under it. It is also why `spangdv` is scaled
with the speeds instead of being left at 4.8: every snake has to stay above the knee at cruise. Had
it not moved, a thin snake at 4.12/tick would have dropped under it, its turn rate would have scaled
down with its speed, its turn circle would not have tightened at all, and boosting would have started
buying turn rate it is not supposed to buy.

**Slower, and zoomed further out.** Both changes come from playing it rather than from a protocol
dump. At `SPEED_SCALE` 1.0 a thin snake crossed a 1,280px view in 1.5 seconds and carved a 178-unit
turn circle, which read as fast rather than as difficult. At 0.70 the crossing takes 2.9 seconds and
boost (×1.92, unchanged) lands at 851 px/s — almost exactly the speed the game used to *cruise* at,
so sprinting buys back the old pace instead of being the only speed that reads as quick. Turn circles
tightened by the same 0.70 for free, `mamu` being angular and unscaled, which is most of what makes
steering comfortable: a thin snake's turn circle went from 12.3 of its own body radii to 8.6.

Two other values ride the same factor, so the change is one lever and not a retune. `spangdv`, above.
And boost cost, 9.5 → 6.65 mass/second, which holds the mass burned per unit of ground closed exactly
where it was — unscaled, slowing the arena would have made a chase 1.4× more expensive per length
gained on the target and quietly retired boosting as a tool.

The camera baseline moved with it: `ZOOM_BASE` 1.16 → **0.86**, `ZOOM_FALLOFF` 0.30 → **0.22**.
`MAX_PARTS` caps `sc` at 4.37 rather than `MAX_SC` 6, so the zoom actually reachable in play is
0.86 → 0.494 where it was 1.16 → 0.577: a new snake sees 1.35× more field per axis (1.8× the area), a
capped one 1.17× more, and growth still widens the view by 1.74×. The falloff came down so that the
extra field is spent on the small end, where the player is genuinely blind — at the old baseline the
first thing you learned about a neighbour was that you had already hit it.

**Growth.** Orbs add mass; parts grow as `40 + 1.62·mass^0.60`, capped at 215. Appearance therefore
stops changing around length 2500 while the score keeps climbing, which is how the original behaves
(it saturates at `mscps` parts / `sc` 6).

**Boost.** Costs 6.65 mass/second (9.5 × `SPEED_SCALE`), sheds a pellet of 1.6 mass behind you per
interval, and refuses below length 22. You visibly shrink and thin out while holding it.

**Death economy.** A snake killed by a body converts 68% of its mass into fat, bright orbs laid
along its own body path with an outward kick — a 1600-length snake leaves 218 orbs. Hitting the
arena wall kills you and drops nothing, per the original.

**The asymmetry.** Only your head kills you, and only foreign bodies do. Self-collision does not
exist, so length is never armour, and a length-12 snake can kill the leader by getting in front of
it.

**Bots.** Thirty, four personalities (grazer / scrapper / assassin / coiler), with wall avoidance,
body avoidance, food seeking, path-crossing avoidance, interception leading, committed encirclement
and a break-out when they are the one being enclosed. Details below.

**Everything else.** Live top-10 leaderboard with your row highlighted, length + rank + kills
readout, circular minimap drawing every snake as a polyline, nickname entry, twelve code-drawn
skins with live snake-shaped previews, a kill feed, nickname labels floating over every visible
snake, prey critters that flee and are worth 26 mass, camera that follows and zooms out as you
fatten, WebAudio synthesis (pitch-climbing eat blips, filtered-noise sprint hiss, death thud, kill
chime), death screen with cause of death and a persisted best.

## Why three.js and not 2D canvas

The look is thousands of overlapping additive-blended discs. On 2D canvas each glowing orb is a
`drawImage` of a pre-rendered gradient with `globalCompositeOperation = 'lighter'`, which is a
per-sprite state-touching call; a busy frame here draws 600–1,500 sprites plus a full-screen
procedural background. WebGL does the whole frame in eight instanced draw calls, and it lets the
hex-lattice floor and the arena rim be one fragment shader instead of a tiled bitmap.

**Instanced quads, not points.** `gl_PointSize` sprites were the obvious choice and are wrong twice:
a point is culled the instant its *centre* leaves the frustum, so a fat body segment pops out of
existence at the screen edge, and drivers cap point size well below what a zoomed-in giant snake
needs. `InstancedBufferGeometry` over a unit quad has neither problem for one extra attribute.

**Screen-constant antialiasing without derivatives.** Each instance computes its own edge width in
the vertex shader from a `uPxPerUnit` uniform (`1.9 / pixelDiameter`), so the rim stays ~1.9px on a
6px orb and on a 300px body segment. `fwidth` would be simpler but needs
`GL_OES_standard_derivatives` under GLSL ES 1.00, which is not guaranteed.

Render order, all depth-testless and painted back to front: background → food halo → food core →
body bloom → body shell (the dark outline that stops adjacent snakes merging) → body → eyes →
pupils → sparks.

## Collision and spatial partitioning

Brute force is not an option: ~1,400 body nodes against 31 heads is ~43,000 pair tests per frame,
and the AI's steering probes multiply that by another two orders of magnitude.

`src/spatial.js` is a uniform hash over the arena's bounding square with **singly-linked buckets
held in two `Int32Array`s** — `cellHead[cell]` indexes the first item, `nextIdx[item]` chains the
rest. A full rebuild every frame is one `Int32Array.fill(-1)` plus one push per item, and allocates
nothing. Two instances:

| Grid | Cell | Contents |
| --- | --- | --- |
| `bodyGrid` | 260 | body nodes sampled every `0.85·radius` along each snake |
| `foodGrid` | 220 | every live orb |

Sampling collision nodes at `0.85·radius` rather than at the render stride means no gap a head could
slip through while keeping the node count near 1,400 instead of near 10,000.

Per frame: rebuild both grids, then for each head query a circle of `headHitbox + 3·radius` and test
`d² < (0.74·rA + rB)²` against candidates, skipping nodes tagged with the head's own id. The head
hitbox is 0.74 of the visual radius so grazing a body at speed does not read as a cheat death. Food
uses the same grid twice — once for eating inside `eatRadius`, once for the magnet suction that
pulls orbs in from `2.6·eatRadius`.

## Bot AI

Steering is **candidate-fan scoring**, not pathfinding. Each bot fans 15 headings around its
current one, sweeps a probe along the arc it would actually fly to reach each one, and scores
clearance, wall proximity, food mass, predicted path crossings, turn cost and personality intent.
The winner becomes `targetAngle`, which the snake's own turn rate then chases. One mechanism yields
wall avoidance, body dodging, food seeking and interception, and it degrades gracefully: a boxed-in
bot picks the least-bad heading instead of freezing.

Two committed behaviours sit above the fan and can outvote it: a **coil**, which holds a ring
around one victim, and a **break-out**, which fires when a ring scan says this bot is the one being
enclosed.

Bots get deliberately imperfect information: probes see only what a player could (bodies within
~900 units, a neighbour's heading extrapolated 0.56s), and decisions are throttled to every
55–140ms so they can be baited.

Every number below comes from `tools/probe-ai.mjs`, which drives the simulation modules headless
and classifies every death through `world.kill`, over 30 simulated minutes across six seeds.

### Six measured bugs

1. **The probe was a string of points.** Five bare samples over ~500 units left 100-unit gaps,
   wider than any snake, so bots probed straight *through* bodies. Now it is a swept capsule: each
   sample's test radius is inflated by half the sample spacing, and the step count scales with the
   snake's width.

2. **Look-ahead was a constant.** Probe distance now derives from the bot's own turn radius,
   `speed / turnRate`. That is ~116 units for a thin snake, ~525 for a fat one and ~1,010 for a fat
   one sprinting. The old fixed 760-unit probe was blind for exactly the snakes that most needed
   warning: they could not physically complete a 90° turn inside the distance they were checking.
   (Those three figures were 166 / 750 / 1,440 before `SPEED_SCALE`; all three are distances, so all
   three moved by the same 0.70 and none of the ratios this file is tuned on did. The clamp on the
   result carries the factor too, for the same reason — the probe length is what every safety fraction
   below is measured against, and left at the unscaled 320-unit floor it would have started binding
   for thin snakes and loosened their danger cliff from 0.92 of the probe to 0.64.)

3. **Boosting killed them.** 55% of all bot deaths happened mid-sprint, because of the `spangdv`
   saturation above. A committed sprint is abandoned the moment clearance drops below 62% of the
   probe length, and starting one needs 93%. Deaths mid-sprint are now 1.5%.

4. **The probe was a ray, but a snake flies an arc.** A bot cannot teleport onto the heading it
   picks; it turns onto it at its own rate, sweeping ground a straight ray from the head never
   samples, so a bot could choose a heading that was clear and die on the way to it. The probe now
   integrates the turn. Reverting just this, with everything else held, costs 1.00 → 1.34
   deaths/sec.

5. **Bots watched heads, not paths.** 60% of deaths were on a body node laid down within 0.35s of
   the killer's head passing it: not a wall anybody drove into, but a snake crossing in front and
   the victim eating the fresh neck. Predicted *head* proximity cannot see that, because the two
   heads are never close. Each candidate is now scored against the ground a neighbour will already
   have covered, since that ground is its body by the time you arrive. This is the single largest
   term: removing it costs 1.00 → 1.99 deaths/sec and median life 24.4s → 10.5s.

6. **A corpse outvoted safety.** A fresh corpse is 200-plus fat orbs in one place, which scored
   high enough to beat the danger term outright, so every bot in range dived into the same feast.
   The food term is capped at 260 points. Ordinary foraging scores about 110 and never reaches the
   cap, so only the frenzy is damped: bots still race for a corpse, they just no longer ignore a
   snake in the way. Worth 1.08 → 0.90 deaths/sec on its own, with leader length unchanged.

Aggression is gated on clearance (`openness²`), because unweighted it made assassins drive into the
very body they were trying to cut off. A third of bot deaths are still to the bot's own target.

### The coil

A coiler picks a victim it can out-turn and holds a ring around it. The radius has to be wider than
the coiler's own locked turn, or it spirals into the victim, and tighter than the victim's, or the
victim just drives around inside it. That means the victim must be the clumsier snake: a nimble
snake coils a giant, never the reverse, as in the original. The coiler holds a bearing ~70° ahead
of the victim's nose on the side the victim is *observed* to be turning (reading its steering intent
would be information a player does not have), and uses ring radius as its only throttle, since a
constant-speed snake can gain angle no other way: behind that bearing it tightens, ahead of it it
widens.

Two bugs kept rings from surviving at all. Ids are slot indices and a dead bot is replaced in its
own slot on the same frame, so a coiler silently carried on wrapping whatever respawned into its
victim's slot; identity is now the birth stamp. And the probe's conservative inflation read the
wrapped victim as a wall and vetoed the only headings that held the ring, so the snake being wrapped
now gets a near-contact test rather than an inflated one, and nothing else does.

**A closed 360° ring is not reachable at the original's constants.** Two snakes of equal speed: the
coiler spends its whole speed keeping up and has nothing left to go round with, so closing a loop
needs the victim pinned in a full-lock turn. Boosting buys the surplus but a ring you can sprint
must be at least 1.92 turn radii wide, and lining a circle takes 2π radii of body, while the ratio
of body length to turn radius peaks at 7.6 around thickness 4 (thickness itself caps at 4.37 under
the 215-part limit) against the 6.28 a closed circle needs. Requiring a fully closable ring was
measured: it cut coil commitments from 5.4 to 2.5 per minute and kills from 1.20 to 0.43 per minute
without lengthening a single ring. What coilers land instead is a **half ring across the nose** — at
the moment of a coil kill the victim has a median 150° of the coiler's body around it and 195° of gap
still open. Rings travel past 270° twice in 30 minutes.

The ratio argument above is scale-free, so slowing the arena to `SPEED_SCALE` 0.70 did not change it:
body length and turn radius are both distances and both moved together. What did change is that rings
are now held longer and travelled further — a median 44° of arc against 26°, a maximum of 395° against
337°, held a median 1.6s against 1.1s — while converting to a kill less often (11.5% of commitments
against 19.1%). Tighter turn circles help the victim escape a ring as much as they help the coiler
build one.

### The break-out

When the previous decision's clearance drops below 62% of the probe, a bot scans 16 directions for
blocked distance. Past 10 of 16 shut it reads the space as a pocket rather than a wall, commits to
the centre of the widest remaining gap for 0.45s, and sprints through when that gap is under five
sectors wide and needs no turning to enter (a boost doubles the turn radius, so a sprint out is only
survivable straight). Bots caught with 12 of 16 directions shut now get out within 3 seconds 61% of
the time, against 35% before.

Most of that gain is not this behaviour. Removing the scan and leaving everything else in place
still measures 60%: better path probing is what stopped bots walking into pockets. The scan fires on
1.9% of decisions and is worth about 1 point of escape rate and 0.02 deaths/sec.

### Before and after

30 simulated minutes, six seeds, no player in the world. The first two columns are the AI refinement,
both measured at the original's full speed. The third is the same refined AI at `SPEED_SCALE` 0.70.

| | Before | After | At 0.70 speed |
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
| encirclement deaths, share of body deaths | 3.3% | 5.7% | 8.5% |
| boxed-in bots that get out within 3s | 35% | 61% | 59% |
| boost duty cycle | 16.6% | 18.9% | 19.3% |
| simulation cost per update | 0.42ms | 0.37ms | 0.31ms |

Snake count is unchanged at 30 and dead bots still respawn immediately, so the leaderboard stays
full; the churn behind it is 2.7× slower than the original AI and the top of the board is 31% longer.

**Slowing the arena halved the churn, and about a third of that is not a time-base effect.** Running
every snake at 0.70 speed stretches the wall clock by 1/0.70, which alone would put deaths at
0.70/sec; the measured 0.54 is 23% below that. The rest is manoeuvrability: turn circles shrank by
0.70 against body radii and arena distances that did not move, so a thin snake's turn circle went from
12.3 of its own body radii to 8.6 and every snake in the arena dodges better. Deaths mid-sprint fell
to 0.5%, boxed-in escape held at 59%, and bots now live a 41.3s median. This is the same effect the
change was made for, applied to the bots — the arena is calmer, with fewer corpses to feed on and a
quieter kill feed, and the leader runs 26% longer because snakes survive to grow. Population was left
at 30 rather than raised to chase the old churn number: the request was for comfort, not for churn.

The escape-rate figure needs one caveat. `probe-ai.mjs pockets` asks whether a boxed-in bot is alive
3.0 seconds later, and 3 seconds is a fixed wall-clock window covering 0.70× the ground it used to, so
part of any movement in that row is the measurement and not the bot.

The cost is paid in player agency. A scripted player running the cut-off (`probe-ai.mjs player`)
scores 6.6 kills per minute alive against the old bots and 2.37 against the refined AI at full speed,
falling to 0.93 at 0.70 speed. Most of that policy's old kills were bots blundering into a snake
driving straight at them, which is the exact behaviour that was fixed, and capping the
crossing-prediction horizon at 0.56s bought back a third of it. The drop at 0.70 speed is partly the
same manoeuvrability effect and partly the probe: the policy is a fixed script tuned against the fast
arena, so unlike the first two columns it is not an identical arm and cannot be read as a pure AI
regression. Cutting a bot off now takes a bait rather than a collision course.

## Performance

Measured in the harness's headless Chromium on **SwiftShader** — a pure-software WebGL rasteriser,
which is the worst case by a wide margin and is fill-rate bound, not simulation bound:

| Scenario | Frame time | Sim | Entities |
| --- | --- | --- | --- |
| player at length ~35, normal play | 26ms (39fps) | 0.6ms | 31 snakes, 16,800 orbs, 1,053 nodes, 610 sprites |
| player at length 2,700, zoomed out | 50ms median, 68ms p95 | 0.6ms | 31 snakes, 16,900 orbs, 1,198 nodes, 647 sprites |
| the above at `ZOOM_BASE` 0.86 (current), length 11–40 | 24–42ms (24–42fps) | 0.4–0.6ms | 31 snakes, 16,800 orbs, 1,065–1,180 nodes, 476–731 sprites |

Zooming the baseline out from 1.16 to 0.86 shows 1.8× the area and draws roughly 1.9× the sprites at
the same size: at 1,280×720 with a length-24 player the old baseline drew 345 instances and the new one
draws 654, the extra being both more orbs in frame and more snakes in frame. That is well inside the
caps (9,500 food instances, 34,000 body instances, and overflow drops silently rather than erroring),
and it is fill rather than simulation: `probe-ai.mjs perf` went *down*, 0.355ms → 0.313ms per update on
the same machine in the same session, because slower snakes die half as often and a death is the
expensive event — a corpse explodes into hundreds of orbs and forces a respawn.

Simulation is 0.4–0.9ms per frame across every case measured, so the headroom is entirely in
fragment throughput; on hardware GL the same frames are a small fraction of a 16.7ms budget. Holds
31 snakes and ~17,000 orbs. I have no hardware-GL measurement to quote — the harness is
SwiftShader-only, so the 60fps claim for real GPUs is an inference from the 0.6ms simulation cost
and eight draw calls, not something observed here.

The single largest win during development was the bloom pass. Drawn at the body stride with radius
`2.5·r`, a 260-part snake at radius 60 wrote ~31M additive fragments — 34× the whole screen — and
pinned the software rasteriser at 22fps. Bounding the halo as an offset beyond the body rather than
a multiple of it, and walking it at ~4× the body stride, cut that by roughly 7× with no visible
loss.

Live counters are in the HUD footer (fps, sim ms, snakes, orbs, sprite instances, collision nodes)
and a `[perf]` line prints to the console every 5 seconds.

## Files

```
index.html            entry point, all HUD markup and CSS
src/config.js         every tunable, the slither constants, the twelve skins
src/math.js           angle/colour/rng helpers, no allocations in hot paths
src/textures.js       procedural canvas art: glow, eye, pupil, skin swatches
src/spatial.js        uniform spatial hash, linked buckets in typed arrays
src/snake.js          trail ring buffer, derived geometry, one simulation tick
src/food.js           orb pool with free-list, corpse explosion, prey
src/bots.js           candidate-fan AI and the four personalities
src/world.js          simulation orchestration, collisions, economy, spawning
src/batch.js          instanced-quad sprite batch and its two shaders
src/render.js         renderer, hex/rim background shader, draw passes
src/camera.js         damped follow and thickness-driven zoom
src/input.js          pointer/key to steering intent
src/hud.js            leaderboard, stats, kill feed, nickname labels
src/minimap.js        circular 2D-canvas minimap
src/screens.js        title and death screens, skin picker, best-score store
src/audio.js          WebAudio synthesis, no files
tools/probe-ai.mjs    headless AI probe: death classification, escape rate, player kill rate, sim cost
vendor/three.module.min.js
```

`tools/probe-ai.mjs` needs no browser and no dependencies:

```
node tools/probe-ai.mjs deaths  300     # classify every death over 30 simulated minutes
node tools/probe-ai.mjs pockets 240     # can a boxed-in bot get out
node tools/probe-ai.mjs player  300     # can a scripted player still cut bots off
node tools/probe-ai.mjs perf            # simulation ms per update
```

## Deliberate deviations from the original

- **Arena radius 7,000, not 21,600.** The original fills that radius with ~500 players. Thirty bots
  in it would almost never meet. The arena is scaled to the population so encounter density matches
  a busy public server.
- **Thirty bots.** Chosen against the pre-refinement AI, where thirty-eight measured 3.9 deaths/sec
  and a 6.4s median bot life and played as a blender. Thirty kept 2–3 snakes on screen at the old
  zoom and 4–5 at the current one, and measures 0.54 deaths/sec with a 41.3s median life at the
  current `SPEED_SCALE` (1.00 and 24.4s at full speed).
- **Movement at 0.70 of the original's rates, and a camera baseline of 0.86 px/unit.** Both are player
  feedback, not fidelity: the protocol constants played too fast to steer comfortably in an arena this
  size, and the old baseline framed a new snake too tightly to see a threat coming. The couplings are
  untouched — thickness still buys speed and costs turn radius, and boost still buys no turn rate.
- **215 parts, not 411 (`mscps`).** Scaled with the arena so a maximum-size snake spans ~40% of the
  arena diameter, the same fraction as the original.
- **2.2s of spawn immunity from body collisions** (the wall still kills). The original has no such
  grace; without it, spawning inside a crowded region is an unavoidable instant death in a
  single-player build that respawns bots continuously.
- **Player spawns within the inner 45% of the arena.** Bots spawn anywhere. The wall should be a
  hazard you discover, not one you are dropped next to.
- **No multiplayer, no accounts, no cosmetic unlocks.** Single-player with local bots, best score in
  `localStorage`.

## Guesses where research was thin

- **Boost cost.** The wiki gives 15/second in the original's score units, whose relationship to
  pellet mass is not documented. 9.5/second against a start mass of 10 and pellets worth 0.9–2.4
  reproduces the feel — a full-length sprint is expensive but not suicidal. It is charged at
  9.5 × `SPEED_SCALE` = 6.65/second so that the mass spent per unit of ground covered is the figure
  above regardless of what the arena's speed is set to.
- **Boost speed multiplier.** Not in any protocol dump found. 1.92× matches gameplay footage.
- **Corpse yield.** That a corpse is worth "much more than pellets" is documented; the fraction is
  not. 68% of the dead snake's mass, in orbs of 5 mass each.
- **Food density.** No published figure. Tuned by eye to ~70 orbs visible at the old starting zoom;
  the current 0.86 baseline shows ~135 in the same window. Density itself was left alone when the
  arena slowed down, and deliberately: orbs per unit of *ground covered* is what sets the eating
  cadence, and that is unchanged — only the wall clock stretched. Crossing the full 14,000-unit arena
  diameter runs 27s thin and 22s fat, against 19s and 16s before, and it is not something a session
  asks you to do often. Arena radius stayed at 7,000 for the same reason, with the wider camera giving
  back more sight-distance than the lower speed took away.
- **Prey mass and count.** Documented as existing and valuable; no numbers. 16 in the arena at 26
  mass each.
- **Exact background palette.** Described as dark blue with a lighter gradient hex lattice. Colours
  chosen to sit under the snakes rather than sampled from the original.
