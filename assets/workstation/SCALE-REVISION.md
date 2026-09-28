# Character scale revision

Generated with the built-in imagegen tool. The requested adjustment was a roughly 15% reduction of Mark and CiCi relative to the workstation. The scene is illustrated, so this is an approximate visual adjustment, not a measured affine resize. The chair was adjusted with Mark to preserve his seated pose.

Generated originals and runtime files:
- `office-day-v2.png` and `office-night-v2.png`: full-resolution generated originals, now in the external [art archive](../../docs/art-archive.md). CSS masks the runtime images with the original approved `office-day.webp` alpha silhouette, preserving the room's clean outer edge without changing the revised figures.
- `office-day-v2.webp` and `office-night-v2.webp`: optimized 1536 × 1024 assets.
- `office-day-v2-small.webp` and `office-night-v2-small.webp`: responsive 768 × 512 assets.

Earlier image files are preserved in the external archive; runtime WebP files and both daytime alpha-mask sizes remain in the repository. Character hotspots follow the revised locations; the dog button, accessible label and pet response use CiCi's name.

## Daytime edit prompt

Use case: precise-object-edit.
Edit target: the supplied DAYTIME illustrated office scene.
Make just this proportional correction: reduce the entire seated man, Mark, and the entire white dog, CiCi, to approximately 85% of their current linear dimensions (15% smaller in both width and height) relative to the unchanged workstation. Both should look naturally smaller, not merely thinner.
Mark: scale the WHOLE person including head, hair, torso, arms, hands, legs and shoes proportionally. Preserve his exact identity, friendly face, full beard, hairstyle, navy blazer, white shirt, dark trousers and sneakers. Reduce his supporting mesh chair with him so the seated pose remains coherent. Anchor the seated figure/chair group on the same floor/mat area; his shoes remain in contact with the floor, near their current bottom position. In the 1536x1024 canvas, the top of his hair should move DOWN from around y275 to around y365–375, while his lowest shoe stays near y940. His body should occupy approximately x410–710 rather than x375–735. Preserve the relaxed seated pose, allowing only tiny arm adjustments necessary for natural chair contact.
CiCi: uniformly scale her complete body including head, ears, paws and tail to 85% current size. Preserve her all-white fluffy fur, round dark eyes, tiny dark nose and playful pink tongue. Keep the paws grounded at approximately y930, centered around x805. Her ear tips should move down from approximately y692 to y728, total height about205 pixels rather than244. Do not enlarge her head or change her breed.
Restore any newly uncovered portions of the chair mat, desk, wall and shelves seamlessly. The desk, all four displays, keyboard tray, mug, headphones, shelves, all posters and wording, Warsaw artwork, bookcase, wooden platform, wall silhouette and lighting must otherwise remain EXACTLY the same positions, sizes and appearance.
Keep the exact 1536x1024 canvas, same camera and perspective, no zoom, no crop, no overall scene scaling. Do not enlarge the desk to fake smaller figures. Keep the hand-inked cartoon style and warm daytime lighting unchanged.
Preserve genuine transparent ALPHA everywhere outside the room silhouette exactly like the input. No gray checkerboard, no solid backdrop, no exterior shadows, no new objects or text.

## Matching night edit prompt

Use case: lighting-weather.
Input 1: the newly corrected DAY office illustration, with Mark and CiCi drawn smaller relative to the desk. This is the EDIT TARGET and authoritative geometry.
Input 2: the previous blue-lit NIGHT illustration. This is ONLY a lighting/color reference. Do not use its larger people/dog geometry.
Create the matching night version of Input 1. Change ONLY lighting/color temperature to match Input 2's beautiful deep blue and cyan LED night mode.
Keep every position, size, shape, camera, perspective and character pose EXACTLY as in Input 1: Mark and his mesh chair remain at their newly reduced size and location on the left; CiCi remains at her newly reduced size and location on the floor mat. Do not restore the old larger figures. Preserve their exact faces, clothes, expression, all-white dog fur, and illustrated style.
Apply Input 2's blue/cyan light washing down the walls from the cyan strips; bright turquoise screens; warm amber candle; softly screen-lit natural skin and white fur; subdued blue reflections on the wood platform. The Warsaw picture remains warmly illuminated against the dark room.
Preserve all four monitor positions, desk and tray, objects, shelves, bookcase, posters and exact lettering as Input 1. The outer room silhouette must remain identical.
1536x1024 output. No crop, no zoom, no new objects. Preserve genuine transparent alpha outside the room silhouette from Input 1. Do not draw checkerboard pixels, solid background or exterior shadows.
