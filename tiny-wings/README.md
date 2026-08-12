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

**Controls: one input.** Hold mouse / touch / `Space` to dive. That's the whole game. A mute button
for the music sits in the bottom-right corner.

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
an unclearable drop. One `HILL_SCALE` multiplies wavelength, amplitude, island length and the
coin/cloud layout together, so the terrain stays self-similar and only its size changes; the physics
section below is why it is 1.35 rather than 1.

**Physics** (`src/physics.js`) — a point mass with two regimes.

- *Airborne*: free body, gravity plus light air drag (0.044), and a whisper of glide lift (170) on
  the way down.
- *Grounded*: the bird is constrained to the surface and driven by the along-slope component of
  gravity, so diving on a downslope is pure acceleration. It leaves the ground when the surface
  curves away faster than it can be held: `v² · |κ| > g_eff · cosθ + adhesion`.

Holding the button does four things at once, and that set is the entire skill curve:

1. multiplies gravity by 4 on a downslope, so descending gains 4× the energy;
2. multiplies it by only **1.6 while climbing**, blended over the first 0.25 of slope. Releasing
   pays 1×, so over a valley a releaser nets +3·g·h against a holder's +2.4·g·h, and the holder
   pays the plow friction below on top of that;
3. swaps ground friction from 0.46 to 0.10 on a downslope but to **1.05 on an upslope**, so diving
   is not a free "fast mode", it is a choice you time against the terrain;
4. raises surface adhesion from 150 to 2200, pinning the bird to the hill — so you hold through a
   valley to stay glued and gaining, then release so you pop off the far crest.

In the air the dive multiplier is a separate, much smaller **2.2** (`DIVE_MUL_AIR`). Holding
mid-flight steepens the descent enough to aim a landing without erasing the arc.

**Only an ascending launch buys altitude**, and that measured fact drives most of the tuning above.
A launch taken on the falling side of a crest is a skim: over eight seeds those peak at 0.0 m above
the ground even at 575 units/s, because the hill drops away as fast as the bird does. Launches taken
while the bird is still climbing peak at 3.6 m at 217 units/s and 14.4 m at 524 units/s. Height is
therefore set by *speed at the moment of an ascending launch*, which is why carrying momentum up the
hill matters more than anything that happens at the crest itself.

The hills are scaled by a single `HILL_SCALE = 1.35` in `terrain.js` — wavelength, amplitude, island
length and the coin/cloud layout all ride it. The reason is timing, not looks. A crest's launchable
region (negative curvature) is about a quarter wavelength wide, so before the scale-up a bird
crossing it at 600 units/s had 0.13 s in which releasing would throw it into the air, against a
human reaction latency of 180–250 ms. The window was narrower than the reaction that had to hit it.
Scaling lengths by *k* leaves the launch test itself alone (hill height grows as *k* so `v²` grows as
*k*, while crest curvature falls as `1/k`, and the two cancel), widens the window as `√k`, and makes
the arc *k* times taller. The camera scaled with it: 330→900 world units of width, from 272→760.

**Landing** is where a mistimed dive gets paid for, and it is paid in momentum rather than in
bounces. Impacts up to 188 units/s into the surface *stick*; above 56 the stick still scrubs
tangential speed, ramping to 45% at the edge of that window. Past the window the bird bounces
exactly **once**, and the landing that follows plants and plows, losing a further 42%. So a bad
landing costs you your slide chain and a big bite of your speed, but the bird settles into a slide
instead of pinballing down the hill (measured: 10.8 bounces per 60 s of scripted imprecise play,
13.4 for the sloppy human model, down from 20 before this model).

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
| never hold | 25 s | 179 m | 1.0 | 1.8 | 1.5 s |
| hold constantly | 77 s | 813 m | 3.1 | 11.1 | 3.8 s |
| dive on downslopes | 166 s | 2434 m | 8.1 | 9.6 | 7.8 s |
| dive + aim landings | 181 s | 2785 m | 9.0 | 10.8 | 8.4 s |
| *human* (180 ms latency) | 117 s | 1451 m | 5.4 | 11.7 | 5.1 s |
| *sloppy* (reacts underfoot) | 72 s | 731 m | 3.0 | 13.4 | 4.6 s |

"Longest stall" is the worst time any run went without gaining 2 m — the softlock watch. It never
exceeds the length of a slow paddle across a bay.

The last two rows matter more than the first four, because the first four cannot be played. `dive`
and `skilled` are frame-perfect oracles: they read the exact slope and act on it the same frame.
`human` decides eight times a second from a view of the world 180 ms stale and looks 40 units ahead;
`sloppy` is the same latency reacting to the slope under the bird, which is what a player does before
working out that the release has to be early. Distance alone hid the bug this pass fixed. The oracles
were flying 14.2 m arcs; `human` was managing 4.3 m hops, and `sloppy` and constant hold never left
the ground at all.

So the probe also reports flight directly. An "arc" is airtime ≥ 0.55 s *and* clearance ≥ 2.5 m
above the hill under the bird — a hop of a tenth of a second half a bird-height off the grass is
technically airborne and reads as nothing:

| Input | Launches / 60 s | Arcs / 60 s | Airborne | Airtime med / max | Height med / max |
| --- | --- | --- | --- | --- | --- |
| never hold | 2.1 | 0 | 2% | 0.48 s / 0.62 s | 1.3 m / 2.4 m |
| hold constantly | 11.2 | 6.0 | 11% | 0.56 s / 1.42 s | 3.9 m / 8.8 m |
| dive on downslopes | 10.8 | 9.6 | 31% | 1.87 s / 2.88 s | 18.2 m / 40.1 m |
| dive + aim landings | 12.3 | 10.2 | 29% | 1.66 s / 2.45 s | 15.3 m / 31.4 m |
| *human* | 13.0 | 11.4 | 25% | 1.23 s / 2.30 s | 10.3 m / 21.3 m |
| *sloppy* | 13.6 | 11.8 | 20% | 0.88 s / 1.58 s | 6.6 m / 12.5 m |

Constant hold is the row to watch in both tables at once. It now flies — 6 arcs a minute, 3.9 m up —
and it goes the *shortest* distance of any strategy that touches the button, 813 m against diving's
2434 m. A holder that launches also spends time in the air and scrubs speed on every landing, so
giving it flight cost it distance. That is the shape to preserve: never holding is worthless, holding
is visibly alive and still bad, and timing the release is worth 3×.

`node tools/probe.mjs --race` runs the race course instead, and is how the rival skill levels were
set: it reports what place a scripted player of each strategy finishes in. Over 24 races a
button-masher wins 0%, a player who dives on downslopes 46%, one who also aims landings 88%.

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

**Audio** (`src/audio.js`) — WebAudio synthesis only, no sample files. Filtered-noise wind whose gain
and cutoff track speed, plus one-shots for landings, bounces, launches, coins, cloud touches, Great
Slides, Fever, splashes and the sunset. Sound effects go to the master; the music has its own gain
node one level above it (`musicBus`), so muting the tune leaves the wind and every one-shot alone.

**Music** (`src/music.js`) — one composed four-bar piece, sequenced with a 0.3 s lookahead against
`AudioContext.currentTime`, so it does not drift or stutter with the frame rate. What was here before
was a three-oscillator pad holding a triad and changing key per island; a player called it "an
annoying monotone sound", which is a fair description of a sustained chord.

The piece is `I – V – vi – IV` in D major (D, A, Bm, G), with six layers:

| Layer | What it plays |
| --- | --- |
| bass | root-and-fifth bounce, one chord per bar, an octave down |
| arp | a sixteenth-note arpeggio over the chord tones — the layer that carries the movement |
| lead | the tune: F#-A-B-A / A-C#-B / F#-A-B-D / C#-B-A-F#-D |
| pad | the chord itself, struck once a bar underneath |
| drum | kick, hat, light clap |
| shine | a high bell on the bar line, Fever's sparkle |

The melody peaks on the high D in bar three and resolves to the tonic at the end of bar four, so the
loop hands back to bar one without a seam. Nothing is ever cut: every voice owns a gain envelope that
starts and ends at silence, which is what keeps the loop point and every transition free of clicks.

Seven **scenes** — title, day, fever, dusk, night, race, summary — change the tempo (96–128 bpm) and
which layers are audible, never the notes. So the title screen, a run, Fever and the summary card are
one song at different weights rather than five songs. Layer gains ease every frame, so a scene change
is a crossfade and a silent layer is still being sequenced underneath; tempo and pattern swaps are
deferred to the next bar line. Which scene plays is derived from run state every frame rather than
set at each transition, so it cannot desync from what is on screen. Fever outranks the time of day.

Per **island** the key moves through eight near-relative transpositions and comes back to D
(110–220 Hz, measured), and the arp thickens with the island index. Same tune, new key.

Audio starts on the first input, never on load, so it respects browser autoplay rules. A **mute
button** sits bottom-right on every screen and the preference persists in `localStorage`; it mutes
the music only, and the sequencer keeps running while muted so unmuting lands mid-bar cleanly.

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
| `src/audio.js` | WebAudio sound effects, the wind layer and the mix buses |
| `src/music.js` | the soundtrack: the piece, the scenes, the step sequencer |
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
