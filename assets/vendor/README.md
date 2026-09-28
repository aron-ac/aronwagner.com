# Vendored runtime dependencies

`three/` contains the existing Three.js r180 distribution used by Surf Riders and Bay Racer, moved to this shared location without modifying its source. Its upstream license is in `three/LICENSE`.

Both games and the preview renderers import the same files. Update `three.module.js` and `three.core.js` together when intentionally upgrading, retain the license, and run all game checks. Vendored code is excluded from repository formatting and linting.
