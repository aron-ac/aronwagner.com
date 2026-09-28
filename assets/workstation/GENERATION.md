# Workstation artwork

The current homepage uses the smaller-character `office-day-v2` and `office-night-v2` assets. See [SCALE-REVISION.md](SCALE-REVISION.md) for those edits and exact prompts. This document preserves the original generation history. Unused originals and superseded exports are in the external [art archive](../../docs/art-archive.md); filenames below describe the historical outputs.

Created with built-in imagegen from the three supplied workstation photographs and the approved Mark and white pomsky illustrations. The complete office is a single cohesive scene so characters, furniture, and screens share a perspective. Native HTML links/buttons overlay the monitor, laptop, portrait and dog.

- `office-day.png`: selected full-resolution daytime original, after the cutout cleanup.
- `office-night.png`: matching full-resolution image with blue LED night lighting, after transparent-background extraction.
- `office-day.webp` / `office-night.webp`: original optimized 1536 × 1024 scene assets. The day file remains a current CSS alpha mask; the unused night file is archived.
- `office-day-small.webp` / `office-night-small.webp`: original responsive 768 × 512 copies. The day file remains the small-screen mask; the unused night file is archived.

The earlier separate character and Warsaw illustrations served as design/identity references and are preserved under their original paths in the external archive. The two poster phrases come from the user's photographs. The furniture arrangement was adjusted to keep Mark's face, all four screens, and the dog visible.

## Day scene prompt

Use case: illustration-story.
Asset type: hero illustration for Mark Hammonds's personal website, redesigning the existing cartoon office to match his real workstation.
Input references: the first THREE images are photographs of the same real home office, showing its equipment, furniture, wall decorations, and blue accent lighting. The FOURTH image is the approved illustrated likeness of Mark, and the FIFTH is his approved little white pomsky. Preserve these character identities and the hand-inked drawing style while composing them naturally in the room.
Primary request: draw a cohesive charming hand-inked cartoon of this specific home workstation as a wide open-front room vignette. Use a shallow three-quarter view, adjusted from the photographs so the screens, Mark's face, and dog are all clearly visible. Landscape canvas around 1536x1024, 3:2.
Composition: the room corner forms the background; workstation and monitors occupy center-right. Mark sits at the LEFT return of the desk, his body turned toward the viewer, naturally seated in a black mesh ergonomic chair, visible head and torso facing the viewer with a friendly subtle smile. His right forearm rests on the left desktop, his other hand on the chair arm. Preserve his swept-up dark hair, full shaped beard, navy blazer and open white shirt; add dark trousers and sensible dark shoes for his seated lower body. Do not hide his face behind monitors. His little fluffy all-WHITE pomsky sits on the dark floor mat in the lower center foreground near his chair, fully visible, round glossy dark eyes and pink tongue curling over muzzle. Dog must be small realistically sized beside adult, no gray/tan mask, no added animals.
Exact distinctive workstation details from photographs:
- Matte black L-shaped standing desk, broad main tabletop extends right and a return runs left, black metal legs and lift controls.
- One large CURVED ULTRAWIDE monitor raised at the rear, landscape aspect approximately 21:9.
- THREE smaller screens immediately beneath it: a tablet on the left, open dark laptop lifted on a stand in the center, and a tilted portrait-ish screen on the right.
- All four screens show the same vivid turquoise mountain lake with pale granite rocks, evergreen and snowy mountains. Screens face the viewer enough to read their layout.
- A lower pull-out keyboard tray holding compact dark keyboard and upright ergonomic mouse, dark red/burgundy mug at right, headphones hanging below desk; a small circular magnetic charging stand next to tablet.
- Four small staggered black floating shelves on the left wall: little succulents, instant camera, books with miniature bronze thinker figures, and an amber candle.
- On the far right, a tall slim black-metal and warm wood bookcase with books, a small bronze Sisyphus pushing a rock sculpture on top, printer on lower shelf.
- Raised dark walnut plank floor platform and dark chair mat, matching photos.
Wall art: above the left shelves, the cassette poster from the photographs, readable line: "PAUSE IF YOU MUST. BUT DON'T STOP." Above monitor, the warm coral/blue collage poster reading "THE WORLD IS YOURS". ALSO preserve the website's Warsaw wall picture as a smaller separate dark-framed picture on the upper-right wall above the bookcase: recognize Warsaw's beige Palace of Culture and Science with clock and long spire centered between modern blue buildings.
Lighting: warm welcoming daytime, light cream walls, gentle cyan LED strips following the top corner of the walls and cyan glow behind monitor, small warm candle. Desktop must still read dark charcoal, wood warm brown, screens bright.
Style: sophisticated playful hand-drawn editorial cartoon, clear confident black ink outlines, flat colors with restrained pencil hatching, cohesive proportions and perspective, match the two illustrated character references. Not photorealistic, no 3D rendering, no watercolor wash. Legible at 950 pixels wide.
Framing/background: isolate the entire office vignette with real TRANSPARENT ALPHA outside the wall/floor silhouette, like a cutout dollhouse room; include the two cream back wall planes, floor platform and all furniture, but no opaque page rectangle. Allow 3% transparent breathing room around the complete vignette. No ceiling plane or roof blocking the view. No interface, no webpage text, no title outside scene, no watermark.
Only the two exact poster phrases as written; do not add other text.

## Cutout cleanup prompt

Use case: background-extraction.
Edit target: the supplied generated office illustration.
Make ONE precise cleanup: isolate the existing illustrated office vignette on genuine transparent alpha. Remove ALL brown/black/gray gradient, glow, shadow or haze that is OUTSIDE the outer silhouette of the cream walls, wooden floor platform, furniture and plant. In particular, all the canvas to the left of the left cream wall, to the right of the right wall/bookcase, beneath the wooden platform, and above the wall outlines must be fully transparent, not filled or shaded. Remove the cyan floating backdrop ABOVE the V-shaped LED ceiling edge; the cyan should only illuminate the INSIDE of the cream wall surfaces below the LED strip. Maintain the deliberate wall silhouette following its angular top edge.
Preserve every interior detail exactly: Mark's face/body/pose/clothing, the white dog's appearance/location, all four screens, all desk and shelving objects, Warsaw picture, both poster texts, colors and the line-art style. Do not redraw, move, add, remove, or resize individual elements. Preserve the exact perspective and layout. Same 1536x1024 aspect and coordinate alignment as input. No new outer shadow, no white matte, no checkerboard pixels, no new frame, no new text.
The result must be cleanly cut out for placement on a pale cream web page.

## Night scene prompt

Use case: lighting-weather.
Edit target: the supplied hand-drawn office vignette. Create its matching NIGHT MODE image.
Change ONLY illumination and color temperature to match a home office with intense blue and cyan LED accent lighting at night. Keep the exact pixel-aligned composition, camera, silhouette, proportions, Mark's likeness/pose/expression, dog likeness/pose/expression, furniture, all four screens, all objects, wall art, and all lettering completely unchanged. Output same 1536x1024 dimensions. Do not move or redraw elements.
Night lighting: the cream walls turn deep midnight blue with vivid cobalt blue and cyan light washing down them from the existing ceiling LED strips. The strip itself glows bright cyan. Blue accent lighting glows behind the large ultrawide screen. All four lake screens stay bright turquoise, illuminating the keyboard/laptop and desk. Amber candle keeps a tiny warm pool of light. The black desk remains readable charcoal. Mark's face and the WHITE pomsky are softly lit by the blue screens, clearly visible, retain natural recognizable skin and fur colors rather than pitch black. Warm wood platform and bookcase get subdued blue reflections. Keep the Warsaw painting legible with nighttime illumination.
Style: preserve existing crisp hand-inked cartoon lines and shading. Retain exact text on both posters.
Preserve transparency wherever input is transparent, and make empty space outside room silhouette fully transparent if possible. No new objects, no stars, no new UI, no text changes, no watermark.


## Night transparency cleanup prompt

Use case: background-extraction.
Edit target: the supplied NIGHT office illustration. Remove the gray checkerboard pattern outside the office room and replace it with GENUINE TRANSPARENT ALPHA pixels.
This is background extraction ONLY. The current gray checkerboard is baked into the image and must be removed, NOT redrawn. All pixels outside the outline of the walls, wooden floor/platform and plant/furniture must become actual transparency (alpha zero). Keep all interior office pixels and the blue lighting unchanged: Mark, white dog, four screens, chair, desk, bookcase, plants, posters and Warsaw picture must remain at the EXACT SAME pixel coordinates and sizes. Keep the 1536 by 1024 canvas and do not crop, rescale or shift anything. No new shadows or glows outside the object silhouette.
The empty area above the V-shaped cyan LED wall edge, the left/right empty margins, and below the platform must all be actual transparent alpha, not gray, white, blue, black, gradients or checkerboard. Preserve the blue/cyan glow INSIDE the walls. No drawn transparency grid. No new background.
Output: RGBA transparent PNG with the exact existing office as a clean isolated cutout.
