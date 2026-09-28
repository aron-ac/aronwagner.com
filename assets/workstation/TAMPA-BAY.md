# Tampa Bay monitor wallpapers

Current usage: all four displays use this Tampa skyline. The laptop and two side screens show adjoining panorama crops for visual continuity. The earlier Bitmotive composition described in `BITMOTIVE.md` is historical; the official logo remains on the business card.

Generated with the built-in imagegen tool using `office-day-v2.png` as the edit target. Only the display interiors from the generated result are used on the page; the original day/night room artwork, figures, Warsaw picture, and safe interaction remain unchanged.

Files:
- `tampa-bay-source.png`: full 1536 × 1024 generated original, preserved in the external [art archive](../../docs/art-archive.md).
- `tampa-bay-screens.webp`: optimized 420 × 258 crop at source x=660, y=324, exported with cwebp quality 94.

`index.html` places the crop back at its source coordinates in a 1536 × 1024 SVG. Four clip paths trace the visible screens, excluding the lower monitor frames and round tablet mount. The overlay ignores pointer events so the existing monitor and laptop links continue working. CSS dims the screen artwork slightly in night mode. No new animation or JavaScript is needed.

Geographic reference: [Visit Tampa Bay's Riverwalk overview](https://www.visittampabay.com/things-to-do/riverwalk/). The wallpapers are generated illustrations, not documentary photographs.

## Exact generation prompt

Use case: precise-object-edit.
Asset type: illustrated personal website office hero; replace only monitor wallpapers.
Input image: the supplied 1536x1024 DAYTIME office illustration is the edit target and authoritative geometry.
Primary request: change the wallpaper on ALL FOUR screens to scenic pictures of Tampa Bay, Florida: the big curved ultrawide display, left tablet, center laptop, and right angled monitor.
Show the recognizable downtown Tampa waterfront skyline viewed across broad turquoise water, warm Florida sunshine, blue sky with soft white clouds, a palm-lined waterfront, and subtle reflections. Include Tampa's distinctive cylindrical Rivergate Tower among the varied downtown buildings. Give each screen a suitable crop of this same Tampa Bay waterfront view; keep it attractive and legible at thumbnail size. The big ultrawide should show the widest panorama. The images should feel like scenic photographs lightly rendered in the same polished hand-drawn style as the original screen wallpapers.
IMPORTANT: replace only the active illuminated screen interiors. Preserve exact screen sizes, corners, perspective, curvature, black bezels, monitor stands, laptop keyboard, tablet mount, round silver device in front of the tablet, and every overlap.
Keep the whole rest of the office pixel-aligned with the original: Mark's identity, face, pose, clothes and current reduced scale; CiCi's white fur, face, pose and current reduced scale; chair; desk; mug; headphones; walls; shelves; books; all posters and their lettering; framed Warsaw picture; statue; lighting; floor; and outer room silhouette.
Exact same 1536x1024 canvas, same camera, no zoom/crop/reframing or object movement. No new objects, UI chrome, logos, captions, or watermarks. No snowy mountains, alpine lakes, or Sierra boulders in any display. Do not alter the Warsaw painting.
