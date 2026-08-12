# Tiny Wings — browser recreation

A from-scratch recreation of Andreas Illiger's **Tiny Wings** (iOS, 2011) in vanilla ES modules
and three.js r169. No build step, no bundler, no framework, no downloaded assets — every pixel of
art and every sound is generated at runtime.

## Run it

```
cd claude-code-test-tiny-wings
python3 -m http.server 8080
```

Then open <http://localhost:8080>. Any static file server works; it must be served over HTTP
(ES modules will not load from `file://`).

**Controls: one input.** Hold mouse / touch / `Space` to dive. That's the whole game.

## How to play

Dive **into the downhill** to build speed; **let go on the uphill** so you pop off the crest and
fly. Ride a whole valley without bouncing and you get a **Great Slide**. Three in a row starts
**Fever** (double points). Night is chasing you from the left — every new island you reach pushes
it back, and the run ends when it catches you.

Three modes off the title screen:

| Mode | What it is |
| --- | --- |
| **Day Trip** | The endless run above. Distance is the score, night is the clock. |
| **Night Trip** | The same trip with the grade pinned to a starry night. |
| **Race** | 600 m of the same islands against three AI birds, no night. First past the chequered banner wins. |

## Why three.js rather than 2D canvas

The hills are the game's whole visual identity, and per
[EDais's teardown of the original](https://edais.co.uk/blog/2011/05/02/tiny-wings-procedural-terrain-generation/)
they are "just the interference pattern between a diagonal stripe and sine functions" — a diagonal
stripe pattern *displaced by the terrain's own height field*. That is a per-pixel operation over a
warped domain. In 2D canvas you would have to fake it with clipped gradient fills or pre-rendered
strip textures, and it would break at the crests. In a fragment shader it is four lines of GLSL,
antialiased for free with `fwidth`, and identical for the foreground hills and the parallax
background ridges (`src/shaderlib.js` holds the one routine both use).

Three.js also buys two things a canvas port would fight:

- **The entire background is one analytic fragment pass** (`src/sky.js`): sky gradient, sun, moon,
  stars, drifting cloud band, two parallax ridge layers, the sea, and the advancing wall of night.
  No background geometry to stream, nothing to pop at the screen edges, and parallax stays exact at
  any zoom level. Because the sea is drawn in that same pass — after the ridges, before the hill
  mesh — open water appears exactly where the land dips below sea level and nowhere else, with no
  masking work at all.
- **Orthographic zoom is free.** The camera opens from 272 to 760 world units of width as you gain
  speed and height; with a canvas renderer that is a full re-raster of every layer per frame.

Everything is 2D: an orthographic camera down the +Z axis, flat quads, explicit render order, no
lighting, no depth buffer.

## Technical approach

**Terrain** (`src/terrain.js`) — each island's surface is a sum of three sine waves with
island-specific amplitude and wavelength, multiplied by a shore envelope so the island rises out of
the sea. It is C-infinity smooth, so slope and curvature are well behaved everywhere — the physics
needs both, and a crease would catch the slide. Islands get longer wavelengths and taller hills as
the run goes on, but the amplitude/wavelength ratio only creeps up, so slopes stay slideable rather
than turning into cliffs. Each island's length is snapped so its trailing edge lands on a *trough*
of the primary sine: the last hill then flows continuously down into the bay instead of ending in
an unclearable drop.

**Physics** (`src/physics.js`) — a point mass with two regimes.

- *Airborne*: free body, gravity plus light air drag, and a whisper of glide lift on the way down.
- *Grounded*: the bird is constrained to the surface and driven by the along-slope component of
  gravity, so diving on a downslope is pure acceleration. It leaves the ground when the surface
  curves away faster than it can be held: `v² · |κ| > g_eff · cosθ + adhesion`.

Holding the button does three things at once, and that trio is the entire skill curve:

1. multiplies gravity (×4), so descending gains ~4× the energy — and ascending loses ~4×;
2. swaps ground friction from 0.46 to 0.10 on a downslope but to **1.05 on an upslope**, so diving
   is not a free "fast mode", it is a choice you time against the terrain;
3. raises surface adhesion from 150 to 2200, pinning the bird to the hill — so you hold through a
   valley to stay glued and gaining, then release so you pop off the far crest.

**Landing** is where a mistimed dive gets paid for, and it is paid in momentum rather than in
bounces. Impacts up to 188 units/s into the surface *stick*; above 56 the stick still scrubs
tangential speed, ramping to 45% at the edge of that window. Past the window the bird bounces
exactly **once**, and the landing that follows plants and plows, losing a further 42%. So a bad
landing costs you your slide chain and a big bite of your speed, but the bird settles into a slide
instead of pinballing down the hill (measured: 13 bounces per 60 s of scripted imprecise play,
down from 20 before this model).

A **Great Slide** is tracked exactly as the original describes it: enter a real downslope, ride
through the valley floor and up the far side without ever bouncing, and come off the crest. A
bounce is what kills it, and three clean ones in a row start Fever.

Two invariants keep the game from ever softlocking, both learned from the headless physics probe
(`tools/probe.mjs`, `node tools/probe.mjs`) that runs scripted strategies against the real
`Terrain` and `Bird`:

- The forward crawl force is a multiple of *effective* gravity (`WADDLE_K = 1.06`). Since the
  along-slope component of gravity is `g·sinθ` and `sinθ < 1`, the bird can always creep up any
  slope. Without this it parked in a valley pocket forever.
- Consecutive bounces are capped at 1, after which it plants and plows. Otherwise a steep upslope
  became a pinball table with zero net progress.

The probe is also how the balance is set, and it is the instrument every physics change is measured
with — run it before, run it after. Over a full run with the night chase active, averaged over
eight day seeds:

| Input | Survives | Distance | Islands | Bounces / 60 s | Longest stall |
| --- | --- | --- | --- | --- | --- |
| never hold | 31 s | 218 m | 1.5 | 1.8 | 1.9 s |
| hold constantly | 95 s | 976 m | 5.0 | 2.5 | 2.4 s |
| dive on downslopes | 156 s | 2074 m | 9.0 | 11.5 | 7.3 s |
| dive + aim landings | 173 s | 2436 m | 10.1 | 13.3 | 6.5 s |

"Longest stall" is the worst time any run went without gaining 2 m — the softlock watch. It never
exceeds the length of a slow paddle across a bay.

`node tools/probe.mjs --race` runs the race course instead, and is how the rival skill levels were
set: it reports what place a scripted player of each strategy finishes in.

**Night chase** (`src/game.js`) — a wall of night advances from the left at 108 world units/s,
ramping to 420. Reaching a new island pushes it back 980 units ("every island you pass sets the
clock back a little bit"), a flat amount rather than one that grows with the island index — a long
run already compounds, because more islands buy more daylight which buys more islands. The run ends
when it reaches you. How close it is drives the colour grade: day → golden hour → night, so pulling
ahead literally brings the daylight back.

**Race** (`src/race.js`, `src/raceView.js`) — the player and three AI birds start on the same crest
and run 600 m of the same generated islands. The rivals are not a second physics model: each owns a
real `Bird` on the real `Terrain`, stepped with the same substep loop, so every rival dives, sticks,
bounces, splashes and plows under exactly the player's rules. An AI only decides, a few times a
second, whether its button is held — and its skill is expressed as the four things that separate a
good player from a bad one: how often it re-decides, how far up the slope it reads, what slope it
calls "downhill", and whether it aims a landing mid-air at all. Weak birds also blunder: they
occasionally hold straight into an upslope for a beat, which is the mistake that costs a real player
their chain. Each rival's skill wobbles per race, so the field does not finish in the same order
every time. Over 24 probe races the field brackets a competent player: a button-masher never wins,
a player who dives on downslopes wins 38% of the time, and one who also aims landings wins 79%.
A ribbon along the bottom of the screen shows all four birds' positions and your gap to the bird
ahead; the summary lists the placings, the finishers' times, and how far the stragglers still had to
run. Races leave the nest, the missions and the best distance to the Day Trip.

**Palettes** (`src/palette.js`) — twelve hand-tuned island families, each deliberately pairing the
hills with a sky from a *different* hue family (green hills under a green sky turns the screen into
one wash and the bird vanishes into it). A day seed rotates which family each island gets and nudges
hue/saturation, so the world looks different day to day the way the original's daily re-roll does.
Island 1 always keeps the green meadow family — that is the original's signature opening shot.
Islands cross-fade spatially across the bay, so you watch one palette hand over to the next.

**Art** (`src/textures.js`) — the bird, its wings, coins, clouds, puffs, sparkles, the nest and its
eggs, the fish, the distant flock silhouettes, the sleep "z", the chequered finish banner, the
motion-blur streak, paper grain and the title logo are all drawn on 2D canvases at boot and uploaded
as textures. The bird carries its own dark outline, a halo and a large cream front so it stays
legible on a bright green island and a deep blue one alike. `birdTexture` also draws an asleep
variant — closed eye, small smile — used for the sunset beat and for the mother on the nest, so the
sleeping bird is the same bird rather than a second drawing.

**World dressing** (`src/dressing.js`) — the trip opens and closes on the sleeping-bird beat: a
woven nest with two eggs sits on the first crest with the mother asleep beside it, breathing, "z"s
rising; the title screen holds the player's bird asleep next to her, and once the sun has set on a
run and the bird has settled onto a hill it tucks in and the z's start again. Ambient life is
deliberately thin so it never competes with the slide: four distant flock silhouettes drift across
the upper sky at their own speeds, and one fish jumps out of a bay and splashes back in every few
seconds when open water is on screen. Nothing in this layer touches the bird, the terrain or the
score.

**Motion blur** (`src/motionBlur.js`) — real directional streaking, aligned to the velocity vector
rather than the screen. The bird's sprite is redrawn at where it actually *was* over the last ~42 ms,
sampled from a time-stamped path history and interpolated between frames (snapping to the nearest
recorded frame collapses the ghosts onto two or three points and the smear reads as discrete birds),
plus a tapered lens quad trailing along the direction of travel. Both fade in from 520 units/s and
cap low — real play tops out near 750, so the ramp is set against that rather than against the
speed limit. Below the threshold the meshes are invisible and cost nothing.

**Audio** (`src/audio.js`) — WebAudio synthesis only. Filtered-noise wind whose gain and cutoff
track speed, a three-oscillator pad that changes key per island, and one-shots for landings,
bounces, launches, coins, cloud touches, Great Slides, Fever, splashes and the sunset.

## Scoring

Matching the original's published values, all multiplied by the nest multiplier (×10 at nest 1,
+2 per nest) and doubled during Fever:

| | Points |
| --- | --- |
| Coin | 3 |
| Great Slide | 10 |
| Cloud touch | 20 |
| New island | 50 |

Nests upgrade by completing missions ("reach island 4", "5 Great Slides in one trip", …), persisted
in `localStorage` along with your best distance and score.

## Files

| File | Role |
| --- | --- |
| `index.html` | canvas, DOM HUD and overlay screens, all CSS |
| `src/main.js` | renderer, input, resize, frame loop |
| `src/game.js` | state machine, night chase, scoring, island transitions, palette blending |
| `src/terrain.js` | procedural islands, height/slope/curvature, coin and cloud layout |
| `src/physics.js` | bird physics and the Great Slide / Fever state machine |
| `src/race.js` | race mode: the course, the three AI rivals and the standings |
| `src/raceView.js` | the rival sprites and the finish banner |
| `src/dressing.js` | nest, sleeping mother, sleep "z"s, flocks, jumping fish |
| `src/motionBlur.js` | velocity-aligned ghost trail and streak |
| `src/camera.js` | width-framed follow camera with speed/height zoom and shake |
| `src/sky.js` | the whole background — sky, sun, moon, stars, clouds, two ridge layers, the sea, the night wall — in one fragment shader |
| `src/terrainMesh.js` | foreground hill strip and its stripe shader |
| `src/shaderlib.js` | the shared hill-stripe and ridge GLSL |
| `src/birdView.js` | bird sprite group, wing flap, squash |
| `src/particles.js`, `src/points.js` | pooled GPU point sprites for puffs and sparkles |
| `src/pickups.js` | coins and cloud touches |
| `src/hud.js` | DOM readouts, meters, popups, banners, screens |
| `src/audio.js` | WebAudio synthesis |
| `src/palette.js` | island palettes and the day→dusk→night grade |
| `src/progress.js` | best scores, nest level, missions (localStorage) |
| `src/textures.js` | every procedural canvas texture |
| `src/rng.js` | seeded PRNG and math helpers |
| `tools/probe.mjs` | headless physics probe: the skill curve, the bounce rate, the race field |

## Dev switches

Query params, used to screenshot states a few seconds of play cannot reach:

`?skip=4.5` start partway into island 4 · `?dark=0.7` force the sunset grade · `?fever=1` ·
`?autoplay=1` let a bot fly it · `?seed=N` pick a different day · `?end=6` end the run after 6 s ·
`?catch=1` start with night on your heels · `?race=1` start in race mode ·
`?course=110` shorten the race course, so the results screen is reachable in seconds.

## Calls I made without a source

- **Distance scale.** 10 world units = 1 displayed metre. I could not find the original's actual
  metres-per-island, so the scale is chosen so a good run reads in the low thousands of metres.
- **Islands separated by shallow bays.** Descriptions agree islands are distinct and that there is
  sea, but not on the exact geometry. Water here is a soft hazard: you skim, lose your chain and
  paddle to the far shore. Night stays the only fail condition.
- **Night as a literal advancing wall** rather than only a sunset. The original darkens the sky; a
  visible front makes the chase readable and gives the "islands buy you daylight" rule something to
  act on.
- **Nest missions.** The original gates nest upgrades behind missions but I found no full list, so
  these eight are invented in the same spirit.
- **Night Trip** is rendered as a permanently-night variant of the same trip; the original's Night
  mode may differ mechanically.
- **Race specifics.** That the original races you against three other birds is documented; the
  course length, the finish-banner presentation, the rivals' names and the decision to run a race in
  full daylight with no night chase are mine. Four birds share one 2D track here, so the rivals are
  drawn slightly translucent and lifted a couple of world units apart — the ghost-racer convention —
  rather than in split screen. Races deliberately do not feed the nest, the missions or the best
  distance, so the progression stays a property of the Day Trip.
