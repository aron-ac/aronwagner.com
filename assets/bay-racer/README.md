# Bay Racer

A small 3D boat time trial for Mark's arcade. Serve the repository over HTTP and open `/bay-racer.html`. It uses Three.js 0.180.0 from `../vendor/three/` and shares `../shared/camera-rig.js` with Surf Riders. No build step, remote textures or external runtime requests.

## Race

Complete three laps through eight buoy gates in order. The next gate is gold, and the minimap and direction arrow show where to go. White/checkered buoys mark the lap line. Each gate must be crossed forwards between its buoys; passing a later gate or reversing over a gate does not advance the race.

- **Arrow keys / WASD:** hold one direction to turn the vehicle’s nose toward that part of the screen and drive forward. The vehicle can turn from rest and slows for sharp turns; pressing behind it makes a U-turn.
- **Up + Right:** keep circling clockwise. **Up + Left:** keep circling counter-clockwise. A lower corner of the D-pad circles in the same left/right sense. Opposite arrows cancel each other; releasing the pad lets the vehicle coast.
- **Space:** boost while accelerating. Normal top speed is 19 units/s, boosted speed 26; these are arcade tuning values, not specifications of the real boat.
- **P / Escape:** pause/resume. Losing focus or hiding the tab pauses the race, including its countdown.
- **R / Reset:** return to an approach to the next gate for a five-second penalty. It does not advance the course.
- Touch devices have one left-thumb D-pad with the same screen-relative directions and circling combinations, plus a separate Boost button on the right. Slide between arrows to change direction. The center is neutral; lifting or leaving the pad releases that finger. Boost can be held with a second finger.
- On compact screens, the course map is visible by default; **Map** hides or shows it. **Pause → Reset** returns the boat to the next gate and resumes the race with the usual five-second penalty. Reset is unavailable during the countdown or recovery cooldown. Entering a menu hides the map; starting or resuming play shows it again.

A center pass awards 20 boost; other successful passes award eight. Boost also recharges when unused. Running into land at speed adds two seconds, with a short collision cooldown to prevent repeated penalties while stuck. The final time includes all penalties. Results show the race time, best lap, penalties and personal best. Gold is under 100 seconds, silver under 125, and bronze celebrates every other finish. The fastest completed race is saved locally under `bay-racer-best-time`. Three-second countdowns, a pause screen, restart, optional synthesized sound, drifting foam trails and mobile controls round out the demo.

The bay is an invented compact course with palm islands, a marina, a lighthouse, skyline and distant bridge. The Sea-Doo model was built directly from the three JPGs supplied in the owner’s private `Mark Hammonds Photos/Boat` folder outside the repository. Those photos were already JPEGs, so no conversion was necessary. Personal reference photos stay outside the public assets. See [MODEL.md](MODEL.md) for the geometry and matching details.

## Shared runtime

The shared `../shared/arcade.css` defines the arcade shell and common controls. `../shared/driving.css` owns both driving games' direction pads and compact HUD layouts. Each game stylesheet retains its palette and desktop scene presentation. HUD labels stay at least 10px; compact minimaps omit cramped decorative text while retaining their accessible names and visual markers.

`../shared/directional-drive.js` maps single screen directions to a heading and held corner combinations to a continuous turn. Its shared heading assistance turns the nose before accelerating, including from rest, without automatic reversing. Both keyboard and touch use it; each simulation retains vehicle acceleration, traction and collisions.

`../shared/driving-ui.js` manages map visibility and the pause-menu recovery button for both driving games. CSS selects the compact layout; the controllers retain each game's recovery rules and penalties.

`../shared/game-loop.js` owns frame timing, viewport observation, focus/visibility pauses and page-cache restoration. The controller supplies its render callback, resize guard and cleanup; gameplay remains in the simulation module. Missing optional minimap contexts no longer prevent either driving game from launching.

`../shared/` supplies keyboard/touch input, opt-in synthesized audio, validated local score storage, guarded HUD writes and module-load error handling. Game-specific shortcuts and menus remain in `game.js`; movement and scoring stay independent of the browser in the simulation module.

Rendering stops on page exit. Returning through the back/forward cache restarts one animation loop with fresh timing and keeps active play paused. Resize observers ignore zero-size viewports. HUD updates retain unchanged text nodes, and per-frame input/render scratch objects are reused.

## Files and checks

- `boat-model.js`: reusable `createBoatModel({driver:true})`, shaped white/black hull, red upholstery, windshield and black wake tower. Bow points +Z, waterline y=0, length approximately seven scene units.
- `world.js`: procedural bay, eight gates, land collision circles, active gate lighting and animated water.
- `race.js`: deterministic movement, boost, forward gate crossings, ordered laps, collisions, countdown and pause/recovery.
- `game.js`: renderer, input, UI, sound, foam, camera and minimap. An inspection hook is available only at `?debug=1`.
- `style.css`: desktop, touch, portrait and short landscape layouts.
- `preview.webp`: homepage thumbnail rendered from the actual boat and course using the same perspective lens.

With a local server and development-only Puppeteer available:

```sh
node tests/bay-racer-smoke.cjs
node tools/render-bay-preview.cjs
node tests/homepage-smoke.cjs
```

The scripts accept `PUPPETEER_MODULE` and `CHROME_BIN`; the game test accepts `GAME_URL`, while preview/homepage scripts accept `SITE_URL`. The browser smoke checks exercise real forward gate crossings, invalid crossings, all three laps, best times, countdown, boost, collision cooldown, pause/recovery/restart, keyboard and touch controls, responsive layout and asset errors.
