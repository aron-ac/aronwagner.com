# Avatar likeness and outfit revision

This v3 revision is superseded by `CARTOON-REVISION.md`. The current homepage uses v4, which restores the original cartoon rendering and retains this outfit. The unused v3 PNG and WebP files are preserved in the external [art archive](../../docs/art-archive.md). The photo-conversion notes and exact historical prompts remain here.

Created with the built-in imagegen tool. The requested change updates Mark's likeness and clothing while retaining the approved office composition and character scale.

## Photo conversion and review

All eight photographs in the owner's private `Mark Hammonds Photos` collection are available as JPEG copies in its `JPG` subfolder. This collection is outside the repository and is not required to build or run the site. Seven HEIC files were converted at JPEG quality 95 with macOS `sips`; the existing `IMG_1426.JPG` was copied without recompression. Originals were preserved.

Reviewed: `IMG_0037`, `IMG_0125`, `IMG_0496`, `IMG_1426`, `IMG_2159`, `IMG_2169`, `IMG_2946`, and `IMG_3413`. The generation used the clear `IMG_0125` and `IMG_0496` portraits, plus `IMG_1426` for build and right-forearm tattoo. The photographs remain outside the website's assets.

## Saved assets and placement

- `avatar-day-v3-source.png` and `avatar-night-v3-source.png`: full 1536 × 1024 generated originals.
- `avatar-day-v3.webp` and `avatar-night-v3.webp`: 330 × 552 crops from x=390, y=324, exported with cwebp quality 94.

In this earlier revision, an SVG overlay in `index.html` placed those crops at their original scene coordinates. Its mask covered the union of the old and revised avatar/chair silhouettes, including newly exposed background around the fitted shirt, with a small feather to blend the boundary. The office artwork remained underneath, preserving CiCi, all four monitors, the Warsaw painting, and the safe reveal. CSS crossfaded the avatar with the day/night theme.

The requested “black Desantos” was interpreted as the black Santos de Cartier. Product references:
- [Cartier Santos de Cartier WSSA0039](https://www.cartier.com/en-at/watches/collections/santos-de-cartier/santos-de-cartier-watch-CRWSSA0039): rounded square black case, black dial, visible bezel screws, and black strap. Positioned on the anatomical left wrist (viewer right).
- [Nike Dunk Low Retro black/white](https://www.nike.com/sg/t/dunk-low-retro-shoes-mh4Q5d/HF5441-100): white toe and side panels, black overlays and Swoosh, white midsole, black outsole. An official product image was supplied as a footwear reference.

## Exact daytime prompt

Use case: identity-preserve / precise-object-edit.
Asset type: illustrated office hero for Mark Hammonds's personal website.
Input roles:
1. Office DAY scene: EDIT TARGET, authoritative composition, chair, seated pose, scale and environment.
2. IMG_0125.jpg: PRIMARY likeness reference, clear close portrait; also shows his black V-neck T-shirt.
3. IMG_0496.jpg: supporting close facial likeness reference.
4. IMG_1426.jpg: supporting physical build and anatomical RIGHT forearm tattoo reference (non-mirrored outdoor photo).
5. Nike product photo: footwear reference ONLY.

Change ONLY the seated man to more faithfully resemble the SAME real man in references 2–4, and change his outfit/accessories as specified. Keep the familiar polished hand-inked editorial cartoon style of the office, with natural recognizable facial proportions rather than an exaggerated caricature.
Likeness: short dark brown hair with neatly faded sides and a swept-up, side-swept top, broad forehead, natural relatively straight brows, brown/hazel eyes, straight medium nose, full lips, well-groomed dense dark full beard following the jaw with slightly squared rounded chin. Match the shape and proportions from the close photographs. The earlier cartoon face is overly generic and smiley; give him the real reference face with a relaxed, subtle closed-mouth smile and eyes looking toward the viewer. Keep his athletic muscular build and naturally broad shoulders and arms from the outdoor photo without bodybuilder exaggeration.
Clothes: fitted/tight plain BLACK short-sleeve V-NECK T-shirt with a visible V cut, no collar, no blazer, no white undershirt, no logo. Fitted BLACK JEANS with subtle denim seams and natural seated folds.
Watch: black Santos de Cartier on his ANATOMICAL LEFT wrist, which is the wrist on the VIEWER'S RIGHT beside the desk/chair arm. Small realistic rounded-square black case and black dial, visible bezel screws, black rubber strap, subtle metallic highlights. It is a luxury analog watch, not a round watch or smartwatch. The dial should face visibly upward. Only one watch.
Show the reference's existing black/grey tattoo on his anatomical RIGHT forearm (VIEWER'S LEFT, closer to his lap). Match its overall shaded pattern, not newly invented lettering. His left forearm is not tattooed. Do not copy mirror-image handedness.
Shoes: Nike Dunk Low 'Panda' black-and-white sneakers exactly like reference 5: white perforated toe box and white side panels, black toe/heel/eyestay overlays, recognizable black Swoosh, black laces, white midsole and black outsole. Both shoes visible naturally planted as in original pose.
Keep the exact seated position, chair, head-to-body ratio and already-reduced scale relative to the desk. His hair remains around y347 and the lower shoe around y860 on this 1536x1024 canvas; do not enlarge or relocate the person. Hands rest naturally near the existing armrest/lap positions.

Everything else must remain identical: CiCi's current size, appearance and pose; desk layout; ultrawide Tampa skyline; Bitmotive laptop and green side graphics; all four display corners; shelves, mug, headphone positions; posters and lettering; Warsaw painting; statue; bookcase; floor; room lighting and silhouette. Do not redraw, move, rescale or reinterpret any surrounding object.
Output exact 1536x1024, same camera and framing, no zoom or crop. Preserve transparent outside silhouette. No new people, no captions, no watermark. This is a focused avatar replacement, not a new office design.

## Exact night prompt

Use case: precise-object-edit / identity-preserve.
Image 1: ORIGINAL NIGHT OFFICE SCENE is the EDIT TARGET. Its exact wall, desk, chair, floor, dog and lighting colors must be preserved.
Image 2: NEW DAYTIME AVATAR is an appearance reference ONLY for the man.

In Image 1 replace ONLY the seated man with the updated man from Image 2, preserving the exact new face, haircut, beard, subtle smile, fitted black V-neck T-shirt, black jeans, anatomical-right forearm tattoo (viewer left), black rounded-square Santos de Cartier analog watch on anatomical LEFT wrist (viewer right), and black-and-white Nike Panda Dunk Low shoes.
Keep the man's scale, body silhouette and seated pose exactly as in Image 2: hair top around y332, shoes ending around y870 on a1536x1024 canvas. Render him with restrained blue rim light to fit the night scene, natural warm skin and realistic dark clothing. The chair can be adjusted only where directly necessary for his seated body, otherwise keep Image1's chair.
VERY IMPORTANT: This is NOT a relighting of the whole scene. Do not brighten, darken, recolor or redraw ANY background surface. Preserve Image 1's wall blue, cyan gradient to the right of his head, wood floor, chair mat, desk, room outlines and shadows pixel-for-pixel. No extra blue halo or colored shape around the man's head, torso, chair, knees or shoes. Newly exposed background around his slimmer T-shirt should match the neighboring ORIGINAL NIGHT colors seamlessly.
Everything outside the man/chair must be exactly Image 1: unchanged CiCi, ultrawide Tampa skyline, Bitmotive laptop/side displays, shelves, posters, Warsaw picture, safe position, bookcase and sculpture.
Output1536x1024 with identical framing. No whole-scene recoloring, no crop, no rescale, no new text, no watermarks. Preserve original background transparency.
