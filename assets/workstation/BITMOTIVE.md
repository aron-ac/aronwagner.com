# Historical Bitmotive monitor composition

This screen treatment is superseded. All four current monitors use the Tampa panorama described in `TAMPA-BAY.md`. The official Bitmotive logo is still used on the business card; the monitor backdrop below is retained only as artwork history.

In this earlier version, the ultrawide kept the Tampa skyline and the three lower displays shared one continuous, static vector composition: emerald ribbons, mint highlights, and geometric accents on a dark green background. The laptop centered the official Bitmotive logo; the side panels extended the surrounding artwork.

## Assets

- `bitmotive-panorama.svg`: original 2400 × 600 SVG backdrop, now in the external [art archive](../../docs/art-archive.md). It was authored as native vector artwork to complement the existing brand, without generated or approximated logo lettering.
- `../brand/bitmotive-logo.svg`: unmodified official 327 × 78 logo from [Bitmotive's website](https://bitmotive.com/logos/logo.svg). Green `#009951` and near-white `#FBFBFB`; all lettering is vector path data. Provenance is recorded in `../brand/README.md`.

## Placement

Each lower screen takes an 800 × 600 slice of the backdrop, from left to right: x=0, x=800, and x=1600. SVG transforms align those slices to the existing monitor perspectives. The laptop adds the official logo at x=852, y=216, width=696, height=166 in the shared composition coordinates.

The existing screen-interior clips preserve the bezels and foreground tablet mount. The wallpaper layer ignores pointer events, keeping the monitor links usable. The shared night-mode filter also applies to the lower-screen artwork. No extra animation, JavaScript, or external requests are required.
