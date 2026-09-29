# Office illustration

The homepage hero is an illustration of Aron's real home office, with Aron, Rebecca, Jack and
Maggie. The runtime files here are generated; don't edit them by hand.

| File                                             | Use                                  |
| ------------------------------------------------ | ------------------------------------ |
| `office-day.webp`, `office-day-small.webp`       | Day scene, 1536 × 1024 and 768 × 512 |
| `office-night.webp`, `office-night-small.webp`   | Night scene, pixel-aligned with day  |

## How it was made

The artwork was generated in ChatGPT from photographs of the office and family, in four steps.
The exact prompts, and which images were attached to each, are in [`prompts/`](prompts/):

1. [`01-office-empty-day.md`](prompts/01-office-empty-day.md): the empty room, drawn from the office
   photos in the style of the site's original illustration.
2. [`02-character-sheet.md`](prompts/02-character-sheet.md): Aron, Rebecca, Jack and Maggie in the
   room's style, so their likenesses could be approved before composing the scene.
3. [`03-office-with-family-day.md`](prompts/03-office-with-family-day.md): the characters placed in
   the room.
4. [`04-office-family-night.md`](prompts/04-office-family-night.md): the night lighting, changing
   only light and color so the two themes crossfade cleanly.

The monitors were deliberately drawn as plain blue screens. The generated PNGs and the reference
photos are kept privately in `~/aronwagner-art/` and are not part of this repository.

## Rebuilding the runtime files

```sh
python3 tools/prepare-office-art.py   # needs Python 3 with Pillow
```

The script reads `~/aronwagner-art/generated/03-office-family-day.png` and
`04-office-family-night.png` (`--source` chooses another folder), then for each theme:

- normalizes alpha, because the generator leaves the room slightly translucent with a faint haze
  around it;
- paints the screens: an X feed on the left monitor and an American Cloud dashboard on the right.
  Only screen-blue pixels are replaced, so the microphone and bezels drawn in front stay intact;
- writes the WebP files above.

## Clickable objects

The scene's links and buttons in `index.html` are positioned in the artwork's 1536 × 1024
coordinates (`--x`, `--y`, `--w`, `--h`). If the artwork changes, re-measure them and update the
matching points in `tests/responsive-home.cjs` and `tests/cards-smoke.cjs`. On touch devices each
object shows a pin, and `--pin-dx`/`--pin-dy` in `styles.css` fan out the crowded bookcase pins.
