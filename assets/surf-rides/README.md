# Surf Riders

A standalone 3D arcade driving game for Mark's site. Serve the repository over HTTP (`python3 -m http.server 8000`) and open `/surf-riders.html`. No build step or runtime network dependencies; ES modules require an HTTP server rather than opening the HTML with `file://`.

## Play

- **Up / W:** accelerate forward. **Down / S:** reverse. Changing direction brakes to a stop before engaging the opposite gear.
- **Left / A** and **Right / D:** steer the front wheels. Hold an accelerator and steering key together to drive an arc; steering alone does not rotate a stationary Jeep. Releasing the controls lets it coast.
- **Space / B / Left Ctrl:** brake. Stop inside a destination ring for 1.1 seconds to complete the stop.
- **P / Escape:** pause/resume. Losing focus or hiding the page pauses the shift.
- **R / Unstuck:** return to the nearest road for a five-second shift penalty.
- **Touch:** hold one finger around the Jeep to steer in any direction. A ring shows the neutral center and full-throttle distance. Farther away adds throttle; closer eases down for precise stops. Pointing more than 135° behind the Jeep selects reverse. Lift to coast, or use the separate Brake button with a second finger. Bearing and throttle update as the finger moves; holding still maintains the chosen command as the camera follows.
- A second finger on the scene suspends touch driving until all scene fingers lift. Menus and the Brake button remain independent. Active touch play suppresses browser zoom, text selection and long-press callouts; menus retain native scrolling and zoom.
- On compact screens, the map is visible by default; **Map** hides or shows it. **Pause → Unstuck** returns the Jeep to the nearest road and resumes the shift with the usual five-second penalty. Unstuck remains unavailable during its recovery cooldown. Entering a menu hides the map; starting or resuming play shows it again.
- Sound is optional and off initially. It uses synthesized tones after user interaction.

A shift lasts three minutes. Dispatch assigns one surfer at a time to one of six pickup spots. Reach the yellow marker within 45 seconds, then the coral beach marker within 60 seconds. Both require a slow stop. Successful trips earn a distance-based fare and a tip based on speed, passenger comfort and consecutive rides. Collisions lower comfort by 18 points; recovery lowers it by eight. Missed requests reset the streak. Top speed is 14.25 units/s on roads and 7.5 on grass; these are arcade tuning values. The map/directional indicator shows the next destination. Collect the floating coconut halves along roads and beach approaches for **25 bonus points each**. Each coconut can be collected once per shift, then all return when a new shift begins. Pickups have a small ring burst, optional chime, +25 popup and a live counter; remaining coconuts appear as cream dots on the minimap. The total score is fare earnings (one point per dollar, including tips) plus coconut points. Coconuts do not extend the clock or change fares. Personal best total scores are saved locally under `cr-surf-rides-best-score`; the older earnings-only record is left intact.

This is a fictional, compact arcade map inspired by Nosara and Playa Guiones, not a geographic street map. Pickup businesses and surfer names are invented for gameplay. The [Costa Rica Tourism Board's Nosara and Guiones overview](https://www.visitcostarica.com/blog/travelling-nosara-guiones-and-ostional) informs the beach/surf setting.

The driving camera uses a 25-degree perspective lens with a 45-degree diagonal bearing and roughly 34-degree elevation, following the camera approach in [Bruno Simon’s portfolio](https://bruno-simon.com/). It follows smoothly and looks slightly ahead while driving. The prior URL `cr-surf-rides.html` redirects to `surf-riders.html` with query strings and anchors preserved. Existing best-score storage keys are retained so the rename preserves scores.

## Shared presentation

The shared `../shared/arcade.css` defines the arcade shell and common controls. `../shared/driving.css` owns compact driving HUD layouts and Bay Racer's direction pad. Each game stylesheet retains its palette and desktop scene presentation. HUD labels stay at least 10px; compact minimaps omit cramped decorative text while retaining their accessible names and visual markers.

`../shared/input.js` tracks simultaneous keyboard pedals, wheel steering and the touch Brake button. `touch-drive.js` projects scene touches onto the ground, captures each pointer and draws the steering guide. `vehicle-drive.js` converts keyboard or analog touch commands into pedals and wheel steering; `ride-session.js` turns the Jeep using its speed, wheelbase and eased front-wheel angle. This Jeep-specific implementation is inspired by the touch and keyboard behavior in [Bruno Simon's portfolio source](https://github.com/brunosimon/folio-2025/tree/41046b57eeed8d156d9c3fd7fa259900baef7816/sources/Game), without importing its code or physics engine. Bay Racer retains its screen-direction controls.

`../shared/driving-ui.js` manages map visibility and the pause-menu recovery button for both driving games. CSS selects the compact layout; the controllers retain each game's recovery rules and penalties.

`../shared/game-loop.js` owns frame timing, viewport observation, focus/visibility pauses and page-cache restoration. The controller supplies its render callback, resize guard and cleanup; gameplay remains in the simulation module. Missing optional minimap contexts no longer prevent either driving game from launching.

## Files

- `game.js`: scene/camera, input bindings, presentation of simulation events, menus, HUD and minimap.
- `vehicle-drive.js`: pure keyboard/touch pedal mapping and vehicle steering constants.
- `touch-drive.js`: touch/pen pointer capture, camera-aware ground projection, analog steering guide and lifecycle cleanup.
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

`tests/vehicle-drive.test.js` covers proportional pedals, steering arcs, braking before reverse and simulation timing. `tests/surf-touch-drive.test.js` covers camera projection, deadzone, pointer ownership and cleanup.

`tests/surf-rides-smoke.cjs` exercises the real browser game through its explicit `?debug=1` inspection hook: coconut placement, scoring, full-speed collection, one-shot pickup, pause/end protection, best-score persistence and reset; full request/pickup/drop-off lifecycle, comfort/tips/streaks, both timeout cases, pause, recovery, shift end/restart, simultaneous keyboard acceleration/steering, analog scene touch controls, responsive layouts and failed asset/JavaScript checks.

With a server running and Puppeteer installed in your development environment:

```sh
node tests/surf-rides-smoke.cjs
```

Optional environment settings: `PUPPETEER_MODULE` (module name or absolute module path), `CHROME_BIN` (Chrome executable), `GAME_URL` (default `http://localhost:8000/surf-riders.html`). Screenshots are written to isolated `test-results/browser-<run>/<suite>-<id>/` folders, or `test-results/<suite>-<id>/` when run directly. Puppeteer is only a development test dependency; it is not needed to play or deploy.

Game initialization reports failed module imports through the shared loader. Leaving the page pauses the session and stops the animation loop; returning through the browser’s back/forward cache restarts rendering without consuming the time spent away. Transient input is cleared on pause, blur, tab hiding and page exit.
