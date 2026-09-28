# CiCi’s Treat Trail

An original side-scrolling platformer starring CiCi, Mark's fluffy white pomsky. Collect bone-shaped treats, hop past patrolling squirrels and reach the picnic doghouse. The art is drawn in Canvas 2D with no sprite downloads, libraries or network dependencies. Serve the repository over HTTP and open `/cici-treat-trail.html`.

## Play

- **A / D** or **Left / Right**: run.
- **Space / W / Up**: jump. Hold for a full jump or release early for a shorter hop.
- **P / Escape**: pause/resume. Hiding the tab or losing focus also pauses the game.
- Touch controls support running and jumping together; pointer release/cancellation clears its control.

The 6,200px course has 75 treats, eight squirrels, seven pits, 22 optional higher platforms and two checkpoint flags. Treat arcs show the way across the gaps. Raised platforms can be jumped through from below. Jumps support a small grace period after leaving a ledge and a short input buffer before landing.

Treats award ten points once each. Landing on a squirrel gives CiCi a bounce and leaves the squirrel briefly dizzy, with 25 points awarded only on its first bounce. Side contact costs a heart, followed by 1.5 seconds of protection. A fall costs a heart and returns CiCi to her most recent checkpoint while preserving collected treats. Checkpoints save progress, award 50 points once and restore one heart, up to three. Losing all hearts ends that adventure.

Reach the doghouse to win; collecting every treat is optional. Finishing awards 100 points plus 25 for each remaining heart. The highest completed picnic score is stored locally under `cici-treat-trail-best-score`. Restarting resets the whole course, collectibles, squirrels, hearts and checkpoints, while retaining that record. Sound is optional and synthesized after user interaction.

## Art and files

- `art.js`: original native Canvas illustrations and animation. CiCi has cream-white fur, a curled plume tail, small pointed ears, brown/blue eyes, a black nose and pink tongue. The world has layered hills, clouds, trees, grassy platforms, golden bone treats, brown squirrels, paw flags and a decorated doghouse. No Mario character or game assets are used.
- `level.js`: fresh mutable course state, with documented geometry/reachability in [LEVEL.md](LEVEL.md).
- `adventure.js`: deterministic movement, one-way platforms, buffered/variable jumps, collectibles, squirrel interactions, hearts, checkpoints and finish.
- `game.js`: Canvas renderer, horizontal camera, keyboard/touch input, sound, menus, HUD and local best score. Only `?debug=1` exposes the browser inspection hook.
- `style.css`: desktop, portrait and short landscape layouts.
- `preview.webp`: homepage screenshot rendered from the same art and course geometry.

## Shared runtime

The shared `../shared/arcade.css` defines the arcade shell and common controls. Each game stylesheet retains its palette, scene overlays and responsive positions. HUD labels stay at least 10px; compact minimaps omit cramped decorative text while retaining their accessible names and visual markers.

`../shared/game-loop.js` owns frame timing, viewport observation, focus/visibility pauses and page-cache restoration. The controller supplies its render callback, resize guard and cleanup; gameplay remains in the simulation module. Missing optional minimap contexts no longer prevent either driving game from launching.

`../shared/` supplies keyboard/touch input, opt-in synthesized audio, validated local score storage, guarded HUD writes and module-load error handling. Game-specific shortcuts and menus remain in `game.js`; movement and scoring stay independent of the browser in the simulation module.

Rendering stops on page exit. Returning through the back/forward cache restarts one animation loop with fresh timing and keeps active play paused. Resize observers ignore zero-size viewports. HUD updates retain unchanged text nodes, and per-frame input/render scratch objects are reused.

## Verify

With the local HTTP server running and development-only Puppeteer available:

```sh
node tests/cici-treat-trail-smoke.cjs
node tools/render-cici-preview.cjs
node tests/homepage-smoke.cjs
```

Scripts accept `PUPPETEER_MODULE` and `CHROME_BIN`. The game smoke accepts `GAME_URL`; the preview and homepage scripts accept `SITE_URL`. Checks cover movement/jumping/landing, collectibles, health/invulnerability, squirrels, checkpoints and falls, pause/restart/finish/records, browser keyboard/touch input, responsive layout and errors. A full course playthrough validates the route with ordinary movement and jump input.
