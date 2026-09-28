# Cartoon avatar and outfit revision

Created with the built-in imagegen tool following the user's clarification: retain the original friendly cartoon appearance, matching CiCi, and use real photos only as inspiration for the new outfit and likeness. The v3 avatar was too realistic.

## Final saved files

- `avatar-day-v4-source.png` and `avatar-night-v4-source.png`: full 1536 × 1024 generated originals, preserved in the external [art archive](../../docs/art-archive.md).
- `avatar-day-v4.webp` and `avatar-night-v4.webp`: 330 × 552 runtime crops from x=390, y=324, exported with cwebp quality 94.

The existing feathered avatar/chair mask in `index.html` applies both runtime crops, preserving the room, CiCi, monitor graphics and safe reveal. The prior cartoon scene was the primary visual reference, with JPG portraits `IMG_0125` and `IMG_1426` used only as supporting inspiration. Personal photos remain in the owner's private collection; superseded generated assets are preserved in the external archive. Historical prompts below mention earlier monitor graphics; the current screens all use Tampa artwork.

## Exact daytime prompt

Use case: precise-object-edit.
Asset type: cartoon character wardrobe edit in an existing illustrated personal website.

Input 1: ORIGINAL APPROVED CARTOON OFFICE — EDIT TARGET. This defines the exact character drawing style and proportions.
Input 2: real portrait — light inspiration only for hair/beard colors. Do NOT copy photographic facial anatomy, texture, shading or realism.
Input 3: real outdoor photo — inspiration only for the right forearm tattoo and build. Do NOT copy photographic rendering.

The user loved the CARTOON man in Image 1 and wants him back, simply wearing different clothes. Keep his original friendly cartoon FACE, expressive larger eyes, clear dark eyebrows, smiling mouth, simplified full beard, swept brown hair, head size and head-to-body proportions almost exactly as drawn in Image 1. He must look like he belongs in the SAME hand-drawn world as the fluffy white dog CiCi. Do not replace his face with a realistic portrait. The original cartoon already captures his likeness; the real photos are gentle inspiration only.
Keep the original confident relaxed seated pose, chair, position and overall reduced character scale. Hair top around y347 and shoes around y860 on the1536x1024 canvas.

ONLY update wardrobe and accessories:
- Replace navy blazer and white button-up shirt with a snug plain black short-sleeve V-neck T-shirt, with a clear V-shaped neckline and simply drawn athletic arms.
- Black fitted jeans with a few clean cartoon fold lines; no detailed denim texture.
- One black Santos de Cartier analog watch on his ANATOMICAL LEFT wrist, viewer's RIGHT hand by the desk/armrest: small rounded-square black face/bezel, black strap and a few tiny screw highlights. Keep it a cartoon prop at the appropriate scale.
- Nike Dunk Low Panda sneakers on BOTH feet: white toe and side panels, black overlays, black Nike Swoosh, black laces, white midsole, black outsole, all in the SAME simplified inked cartoon rendering.
- A simplified black/grey tattoo pattern on his anatomical RIGHT forearm, viewer LEFT, inspired by photo3. Do not render photographic tattoo detail.

STYLE IS THE MOST IMPORTANT REQUIREMENT: thick crisp illustrative outlines like Image1, smooth simplified skin shading, a few broad cel-shaded color planes, friendly expressive cartoon facial features, simplified hands and anatomy. Match the original avatar's level of stylization exactly. No visible pores, wrinkles, individual beard hairs, lifelike muscle rendering, photographic specular lighting, realistic skin texture, portrait painting, or photorealism. Do not make him more realistic than CiCi or the existing illustrated room. Do not turn him into a chibi or enlarge his head beyond the original.

Preserve EVERY OTHER part of Image1 exactly: CiCi, room, desk, Tampa skyline ultrawide, Bitmotive laptop and green side graphics, shelf props, posters/text, Warsaw painting, statue, bookcase, floor and original daytime lighting. No whole-scene redraw, crop, rescale, zoom, new objects or labels.
Output1536x1024. Same exact composition and scene geometry; preserve exterior transparency.

## Exact watch correction prompt

Use case: precise-object-edit.
Edit target: this newly restored CARTOON office illustration.
Make ONE tiny localized correction only: the black watch on the seated man's anatomical LEFT wrist (viewer RIGHT, center approximately x640 y562 on1536x1024) must be a BLACK CARTIER SANTOS with a clearly SQUARE case, not a round watch.
Draw a compact black rounded-square bezel with FOUR STRAIGHT SIDES, softly rounded corners, tiny exposed corner screw dots, a square black dial, slim light analog hands and black strap. Tilt the square naturally with the wrist. Keep its existing small scale; do not enlarge it. Cartoon rendering.
Every other pixel must be preserved: same original cartoon face, same smile/eyes/hair/beard, head and body proportions, black V-neck shirt, arms and tattoo, black jeans, Panda shoes, chair, CiCi and office. Preserve the exact broad cel shading and crisp dark outlines. Absolutely no photorealism, no new skin detail, no changes to face/body shape, no repositioning or recropping.
Output1536x1024 same geometry. Only turn the round watch case into the requested squared Santos.

## Exact night prompt

Use case: precise-object-edit.
Image1: ORIGINAL APPROVED CARTOON NIGHT OFFICE is the EDIT TARGET; preserve its exact room colors and background.
Image2: updated CARTOON DAY avatar is the authoritative wardrobe, character style, pose and silhouette reference.

Update ONLY the seated man's outfit and arms in Image1 to match Image2: snug black short-sleeve V-neck shirt, black fitted jeans, simplified right-forearm tattoo (viewer left), black SQUARE Santos watch on anatomical LEFT wrist (viewer right), and black/white Nike Panda Dunk Low shoes.
Keep the original friendly CARTOON FACE and swept hair from Image1, which match Image2: same larger expressive eyes, thick illustrative eyebrows, warm smile, grouped beard shape and chunky hair locks. Preserve original head size and reduced body scale. Match Image2's seated pose and clothing silhouette, head aroundy347 and shoes aroundy862. Do not change anatomy or head proportions.
Preserve Image2's bold outlines, smooth peach skin, simple color planes and limited cel shading. He must remain equally cartoony as CiCi. NO photorealism, no photographic anatomy, no skin pores/wrinkles, no intricate beard hairs or realistic muscle definition.
Watch specifically has FOUR STRAIGHT SIDES with subtly rounded corners, tiny screw dots, black analog dial and black strap. Do not turn it into a round watch.

Give only his clothes/skin restrained cool blue edge highlights to fit Image1's night room. Do NOT relight the room. Keep Image1's exact blue walls and gradient beside his head, floor, mat, desk and chair colors. Newly uncovered background around the shirt must match those original colors seamlessly; no halo or color patch around the man.
All other Image1 objects and geometry are unchanged: CiCi, Tampa skyline, Bitmotive screens, shelves, posters/lettering, Warsaw painting, bookcase and statue.
1536x1024, same exact camera/framing/positions, no zoom, no crop, no rescale. Preserve exterior transparency. No new objects, captions or watermark.
