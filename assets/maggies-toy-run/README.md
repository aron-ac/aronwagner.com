# Maggie’s Toy Run

An original side-scrolling platformer starring Maggie, Aron's Goldendoodle. Round up her tennis balls, hop over the bath-time bubbles and make it across the backyard to Aron and Rebecca on the patio. It started as Mark Hammonds's CiCi's Treat Trail; the course and mechanics are his, re-themed for Maggie. The art is drawn in Canvas 2D with no sprite downloads, libraries or network dependencies. Serve the repository over HTTP and open `/maggies-toy-run.html`.

## Play

- **A / D** or **Left / Right**: run.
- **Space / W / Up**: jump. Hold for a full jump or release early for a shorter hop.
- **P / Escape**: pause/resume. Hiding the tab or losing focus also pauses the game.
- Touch controls support running and jumping together; pointer release/cancellation clears its control.
- While touch controls are visible, the entire play area suppresses text selection, long-press callouts and browser zoom gestures, including missed taps between or beside controls. Menus retain native scrolling and zoom.

The 6,200px course has 75 tennis balls, eight bath bubbles, seven wading-pool pits, 22 optional wooden planks and two paw flags. Arcs of balls show the way across the gaps. Raised platforms can be jumped through from below. Jumps support a small grace period after leaving a ledge and a short input buffer before landing.

Tennis balls award ten points once each. Landing on a bubble gives Maggie a bounce and pops it for a few seconds, with 25 points awarded only on its first bounce. Side contact costs a heart, followed by 1.5 seconds of protection. A splash into a pool costs a heart and returns Maggie to her most recent paw flag while preserving collected balls. Checkpoints save progress, award 50 points once and restore one heart, up to three. Losing all hearts ends that adventure.

Reach Aron and Rebecca to win; collecting every ball is optional. Finishing awards 100 points plus 25 for each remaining heart. The highest completed run score is stored locally under `maggies-toy-run-best-score`. Restarting resets the whole course, collectibles, bubbles, hearts and checkpoints, while retaining that record. Sound is optional and synthesized after user interaction.

## Art and files

- `art.js`: original native Canvas illustrations and animation. Maggie is drawn from overlapping curls in apricot fur, with a floppy ear, a wagging plume tail and a tongue that comes out when she runs. The backyard has a privacy fence, palms and oaks, wooden planks, wading pools, tennis balls, grumpy soap bubbles, paw flags with a water bowl, and Aron and Rebecca under patio string lights.
- `level.js`: fresh mutable course state, with documented geometry/reachability in [LEVEL.md](LEVEL.md).
- `adventure.js`: deterministic movement, one-way platforms, buffered/variable jumps, collectibles, bubble interactions, hearts, checkpoints and finish.
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
node tests/maggies-toy-run-smoke.cjs
node tools/render-maggie-preview.cjs
node tests/homepage-smoke.cjs
```

Scripts accept `PUPPETEER_MODULE` and `CHROME_BIN`. The game smoke accepts `GAME_URL`; the preview and homepage scripts accept `SITE_URL`. Checks cover movement/jumping/landing, collectibles, health/invulnerability, bubbles, checkpoints and falls, pause/restart/finish/records, browser keyboard/touch input, responsive layout and errors. A full course playthrough validates the route with ordinary movement and jump input.
