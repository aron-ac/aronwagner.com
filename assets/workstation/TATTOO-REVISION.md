# Reference-matched forearm tattoo

Created with the built-in imagegen tool on September 27, 2026.

## Reference conversion

All four images in the owner's private `Mark Hammonds Photos/Tattoos` collection were exported as JPEG quality 95 into its `JPG` subfolder, preserving the original PNG/JPG files. References remain outside this public site repository and are not required to build or run the site.

Reviewed `IMG_4170.jpg`, `IMG_4171.jpg`, `Tattoo_1.jpg`, and `Tattoo_2.jpg`. The outside of the right forearm shows a tall sailing ship with rigging and ocean waves at the wrist. The underside shows a compass over a map, island and bottle. Because the avatar exposes the outside of the right forearm, the updated illustration emphasizes the ship and waves rather than placing the underside compass on the wrong surface.

## Saved assets

- `tattoo-day-v5-source.png` and `tattoo-night-v5-source.png`: full generated 1536 × 1024 outputs, preserved in the external [art archive](../../docs/art-archive.md).
- `tattoo-day-v5.webp` and `tattoo-night-v5.webp`: optimized 112 × 72 crops, source x=428, y=544, cwebp quality 96. Only the daytime crop is a current runtime asset; the unused night crop is archived.

The runtime only overlays the tattoo region over the existing v4 avatar. This preserves the exact existing face, body, wardrobe, chair, room and dog pixels.

Both themes use the single `tattoo-day-v5.webp` drawing at identical coordinates through the same feathered mask. Night mode applies only a CSS color filter to this element; it never swaps or transforms the artwork. This fixes placement/design drift caused by the two independently generated crops. `tattoo-night-v5.webp` and its source are retained in the external archive for provenance and are not loaded by the page.

Suggested feathered mask in scene coordinates:

```
M441 550 Q448 547 462 553 L486 567 L515 581 Q530 586 534 595 L528 607 Q520 610 508 606 L449 595 Q439 592 435 586 L433 576 L434 564 Q436 554 441 550 Z
```

## Exact daytime prompt

Use case: precise-object-edit.
Asset type: existing cartoon personal website illustration, surgically localized tattoo correction.
Input 1 is the EDIT TARGET: approved daytime cartoon office illustration. Input 2 is the actual outer right forearm tattoo reference (tall sailing ship and waves). Input 3 is the opposite side of this same real forearm for context only (compass/map/island/bottle).
Change ONLY the existing generic geometric tattoo on the seated man's anatomical RIGHT forearm, viewer LEFT, within approximately x432..528 and y553..607 in this exact 1536x1024 image. Preserve his entire arm silhouette, wrist, hand and pose.
Replace the generic angular tattoo with a simplified black and charcoal illustrated version of the actual tattoo in Input 2: a recognizable old tall sailing ship with stacked billowing square sails, fine mast/rigging lines, dark hull and foamy rolling ocean waves closer to the wrist. The tattoo follows the forearm's length and curved skin in the same seated pose: upper masts toward the elbow (left of the visible forearm), hull and waves toward his wrist/hand (right). Because this is the outer forearm, ship and waves dominate; do not force the underside compass design onto this face of the arm. No geometric/tribal zigzags. Keep the ink comfortably inside the skin boundary, with narrow bare-skin margin toward wrist. Maintain existing skin shading.
The tattoo must be readable at small scale with simplified inked shapes and broad grey tones, matching the SAME lightly cartoony, crisp-outlined, cel-shaded rendering as the existing man and white dog. Do not make skin or any part photorealistic.
All pixels outside this tiny tattoo region must remain unchanged: exact same face, eyes, friendly smile, swept hair, beard, head/body size, black V-neck T-shirt, black jeans, black square watch on the other wrist, Panda sneakers, chair, dog, room, monitors, posters, painting, furniture, lighting, floor. Do not redraw face or body. Do not rearrange anything, zoom, crop or rescale.
Output exactly 1536x1024, identical alignment. No captions, labels, or watermark.

## Exact nighttime prompt

Use case: precise-object-edit.
Asset type: existing cartoon personal website illustration, surgically localized tattoo correction.
Keep the exact original blue nighttime room lighting and the arm's existing cool edge highlights. Input 1 is the EDIT TARGET: approved NIGHTTIME blue-lit cartoon office illustration. Input 2 is the actual outer right forearm tattoo reference (tall sailing ship and waves). Input 3 is the opposite side of this same real forearm for context only (compass/map/island/bottle).
Change ONLY the existing generic geometric tattoo on the seated man's anatomical RIGHT forearm, viewer LEFT, within approximately x432..528 and y553..607 in this exact 1536x1024 image. Preserve his entire arm silhouette, wrist, hand and pose.
Replace the generic angular tattoo with a simplified black and charcoal illustrated version of the actual tattoo in Input 2: a recognizable old tall sailing ship with stacked billowing square sails, fine mast/rigging lines, dark hull and foamy rolling ocean waves closer to the wrist. The tattoo follows the forearm's length and curved skin in the same seated pose: upper masts toward the elbow (left of the visible forearm), hull and waves toward his wrist/hand (right). Because this is the outer forearm, ship and waves dominate; do not force the underside compass design onto this face of the arm. No geometric/tribal zigzags. Keep the ink comfortably inside the skin boundary, with narrow bare-skin margin toward wrist. Maintain existing skin shading.
The tattoo must be readable at small scale with simplified inked shapes and broad grey tones, matching the SAME lightly cartoony, crisp-outlined, cel-shaded rendering as the existing man and white dog. Do not make skin or any part photorealistic.
All pixels outside this tiny tattoo region must remain unchanged: exact same face, eyes, friendly smile, swept hair, beard, head/body size, black V-neck T-shirt, black jeans, black square watch on the other wrist, Panda sneakers, chair, dog, room, monitors, posters, painting, furniture, lighting, floor. Do not redraw face or body. Do not rearrange anything, zoom, crop or rescale.
Output exactly 1536x1024, identical alignment. No captions, labels, or watermark.
