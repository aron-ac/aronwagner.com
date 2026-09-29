# Surf Riders

A standalone 3D arcade driving game for Mark's site. Serve the repository over HTTP (`python3 -m http.server 8000`) and open `/surf-riders.html`. No build step or runtime network dependencies; ES modules require an HTTP server rather than opening the HTML with `file://`.

## Play

- **Arrow keys / WASD:** hold one direction to turn the vehicle’s nose toward that part of the screen and drive forward. The vehicle can turn from rest and slows for sharp turns; pressing behind it makes a U-turn.
- Only one direction is active at a time. If two arrows are held, the most recently pressed direction wins; releasing it returns to the other held direction. Releasing all arrows lets the vehicle coast.
- **Space:** brake. Stop inside a destination ring for 1.1 seconds to complete the stop.
- **P / Escape:** pause/resume. Losing focus or hiding the page pauses the shift.
- **R / Unstuck:** return to the nearest road for a five-second shift penalty.
- Touch devices have four separated left-thumb arrow buttons with the same screen-relative directions, plus a separate Brake button on the right. Slide between arrows to change direction. The gaps, corners, and center are neutral; lifting or leaving the pad releases that finger. Brake can be held with a second finger.
- On compact screens, the map is visible by default; **Map** hides or shows it. **Pause → Unstuck** returns the Jeep to the nearest road and resumes the shift with the usual five-second penalty. Unstuck remains unavailable during its recovery cooldown. Entering a menu hides the map; starting or resuming play shows it again.
- Sound is optional and off initially. It uses synthesized tones after user interaction.

A shift lasts three minutes. Dispatch assigns one surfer at a time to one of six pickup spots. Reach the yellow marker within 45 seconds, then the coral beach marker within 60 seconds. Both require a slow stop. Successful trips earn a distance-based fare and a tip based on speed, passenger comfort and consecutive rides. Collisions lower comfort by 18 points; recovery lowers it by eight. Missed requests reset the streak. Grass limits speed, roads let you travel faster, and the map/directional indicator show the next destination. Collect the floating coconut halves along roads and beach approaches for **25 bonus points each**. Each coconut can be collected once per shift, then all return when a new shift begins. Pickups have a small ring burst, optional chime, +25 popup and a live counter; remaining coconuts appear as cream dots on the minimap. The total score is fare earnings (one point per dollar, including tips) plus coconut points. Coconuts do not extend the clock or change fares. Personal best total scores are saved locally under `cr-surf-rides-best-score`; the older earnings-only record is left intact.

This is a fictional, compact arcade map inspired by Nosara and Playa Guiones, not a geographic street map. Pickup businesses and surfer names are invented for gameplay. The [Costa Rica Tourism Board's Nosara and Guiones overview](https://www.visitcostarica.com/blog/travelling-nosara-guiones-and-ostional) informs the beach/surf setting.

The driving camera uses a 25-degree perspective lens with a 45-degree diagonal bearing and roughly 34-degree elevation, following the camera approach in [Bruno Simon’s portfolio](https://bruno-simon.com/). It follows smoothly and looks slightly ahead while driving. The prior URL `cr-surf-rides.html` redirects to `surf-riders.html` with query strings and anchors preserved. Existing best-score storage keys are retained so the rename preserves scores.

## Shared presentation

The shared `../shared/arcade.css` defines the arcade shell and common controls. `../shared/driving.css` owns both driving games' direction pads and compact HUD layouts. Each game stylesheet retains its palette and desktop scene presentation. HUD labels stay at least 10px; compact minimaps omit cramped decorative text while retaining their accessible names and visual markers.

`../shared/input.js` selects the latest held direction. `../shared/directional-drive.js` maps that screen direction to a heading. Its shared heading assistance turns the nose before accelerating, including from rest, without automatic reversing. Both keyboard and touch use it; each simulation retains vehicle acceleration, traction and collisions.

`../shared/driving-ui.js` manages map visibility and the pause-menu recovery button for both driving games. CSS selects the compact layout; the controllers retain each game's recovery rules and penalties.

`../shared/game-loop.js` owns frame timing, viewport observation, focus/visibility pauses and page-cache restoration. The controller supplies its render callback, resize guard and cleanup; gameplay remains in the simulation module. Missing optional minimap contexts no longer prevent either driving game from launching.

## Files

- `game.js`: scene/camera, input bindings, presentation of simulation events, menus, HUD and minimap.
- `ride-session.js`: renderer-independent shift state, driving/collisions, request lifecycle, recovery, fares/tips and coconut collection. `createRideSession(world, onEvent, { random })` accepts plain map data and injectable randomness, so gameplay can be tested without a browser. Frame updates take a duration and an input snapshot.
- `../shared/`: keyboard/multi-pointer input, opt-in synthesized audio, safe numeric score storage, required DOM lookups and game loading/error reporting shared with the other games.
- `../shared/camera-rig.js`: shared perspective camera lens/angle for gameplay and the native homepage preview.
- `tools/render-surf-preview.cjs` (at the repository root): reproducibly renders the preview from the game’s native geometry using Puppeteer.
- `world.js`: local procedural tropical scenery and map definitions.
- `coconuts.js`: reusable coconut geometry and pickup animation, reading collectible state owned by the session. Placement and collection rules live in `ride-session.js`.
- `jeep-model.js`: Mark's photo-informed procedural olive Wrangler with a white hard-shell roof, black rack, squared LED light bar, animated wheels/steering and optional roof boards.
- `mark-jeep.glb`: portable model, downloadable from the game footer; see [MODEL.md](MODEL.md).
- `style.css`: desktop, portrait and short landscape layouts.
- `preview.webp`: 1200 × 600 homepage render using the actual Jeep/world and one coherent perspective camera.
- `../vendor/three/`: unmodified Three.js **0.180.0** module/core builds, served locally. MIT license is in `../vendor/three/LICENSE`. Original package: https://www.npmjs.com/package/three/v/0.180.0 .

The game needs WebGL 2 in a current desktop/mobile browser. It displays a readable error if the graphics context cannot initialize. All geometry is native Three.js mesh data; no personal photos or remote textures are shipped.

## Verification

`tests/surf-session.test.js` exercises the pure simulation: actual acceleration/braking into a pickup, fare/tip lifecycle, one-shot coconuts and clock invariants, collision cooldown, pause/end guards, both request timeouts, recovery exhaustion and deterministic replay. Run it with `node --test tests/surf-session.test.js`.

`tests/surf-rides-smoke.cjs` exercises the real browser game through its explicit `?debug=1` inspection hook: coconut placement, scoring, full-speed collection, one-shot pickup, pause/end protection, best-score persistence and reset; full request/pickup/drop-off lifecycle, comfort/tips/streaks, both timeout cases, pause, recovery, shift end/restart, screen-relative arrow/WASD driving, touch acceleration/release/cancellation, responsive layouts and failed asset/JavaScript checks.

With a server running and Puppeteer installed in your development environment:

```sh
node tests/surf-rides-smoke.cjs
```

Optional environment settings: `PUPPETEER_MODULE` (module name or absolute module path), `CHROME_BIN` (Chrome executable), `GAME_URL` (default `http://localhost:8000/surf-riders.html`). Screenshots are written to isolated `test-results/browser-<run>/<suite>-<id>/` folders, or `test-results/<suite>-<id>/` when run directly. Puppeteer is only a development test dependency; it is not needed to play or deploy.

Game initialization reports failed module imports through the shared loader. Leaving the page pauses the session and stops the animation loop; returning through the browser’s back/forward cache restarts rendering without consuming the time spent away. Transient input is cleared on pause, blur, tab hiding and page exit.
