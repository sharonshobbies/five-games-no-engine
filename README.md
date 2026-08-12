# Five games, no engine

Five commercial games rebuilt from scratch as browser games with **no game engine** —
plain ES modules and three.js, no build step, no bundler, no backend.

**Play them:** https://sharonshobbies.github.io/five-games-no-engine/

| Game | Genre | Controls |
| --- | --- | --- |
| [Tiny Wings](tiny-wings/) | One-button momentum | Hold mouse/Space to dive, release to glide |
| [Slither.io](slither-io/) | Arena survival | Mouse to steer, hold click/Space to boost |
| [Motherload](motherload/) | Mining | Arrows/WASD to thrust and drill, E vendor, I inventory |
| [Thronefall](thronefall/) | Day-build / night-defend | WASD to ride, click a glowing plot to build |
| [Merge Dragons](merge-dragons/) | Merge puzzle | Drag matching objects together |

## How they were built

Each game was researched from public sources online, then written in vanilla JavaScript.
Every sprite, texture, mesh and sound is generated in code at load — there is not a single
image or audio file in the repository. The only third-party code is `three.js` r169 (MIT),
vendored into each game so they run offline.

Each folder has its own `README.md` describing the technical approach and a `FIDELITY.md`
listing honestly which features of the original are done, partial, or missing.

## Running locally

No build step. Serve the folder over HTTP and open it:

```
python3 -m http.server 8080
```

Then open http://localhost:8080. Opening `index.html` directly from the filesystem will
not work — the games use ES modules, which browsers block over `file://`.

## Credits

Original games: Tiny Wings (Andreas Illiger), Slither.io (Steve Howse), Motherload
(XGen Studios), Thronefall (Grizzly Games), Merge Dragons! (Gram Games / Zynga). These are
independent educational recreations, not affiliated with or endorsed by their creators.
