# Aisle Dash

A side-scrolling shopping game: Aron pushes Jack's stroller through Target and then International
Plaza while Rebecca shops. Keep her happy, keep some of the $250 budget, and get home before Jack runs
out of patience. Serve the repository over HTTP and open `/aisle-dash.html`.

## Play

- **← → / A D:** walk. **Space / E / ↑:** buy, compliment or order, depending on what's in reach.
  **P / Escape:** pause. Touch devices get left/right arrows and one action button whose label shows
  what it will do.
- Rebecca walks ahead and stops at six displays per store. Her thought bubble shows the item, the
  price and a timer:
  - **Hearts** mean she wants it: buying gives 5 happiness per heart (plus 2 on sale); letting it
    pass costs 2 per heart.
  - **“hmm…”** means she's just looking: buying costs 4 happiness; passing is free.
  - **“How does this look?”** wants a compliment: +10, free. Ignoring it costs 8.
- Once per store she craves a coffee (Target) or a cupcake (Sugar Rush at the mall). Order it at the
  counter behind you and walk it to her within 25 seconds: +15. A surprise treat is +6 the first time.
- Coupons on the floor take 20% off the next purchase and stack with sales. A purchase you can't
  afford is declined: −6.
- Jack's patience drains steadily. Every 15–25 seconds he throws his pacifier behind the stroller;
  until you walk back over it he gets fussy and drains more than twice as fast. He naps in the car
  between stores (+15). If he runs out, the day ends early.
- Rebecca waits if Aron falls more than 620 units behind, so errands can't lose her.
- Endings weigh both happiness and money: perfect day (≥75% and ≥$80), thrilled but broke, saved
  money but she's not speaking to you, rough, solid, or Jack's meltdown. The score is happiness × 5
  plus dollars left; the best day is saved under `aisle-dash-best-score`.

## Files

- `stores.js`: both store layouts (displays, counters, coupons, sections, exits) and their items.
- `shopping.js`: the deterministic day simulation, with no DOM. `?seed=n` makes a day repeatable.
- `sprites.js`: sprite sheet layout, loading and drawing.
- `art.js`: Canvas 2D backdrops, fixtures, bubbles and effects.
- `game.js`: controller: input, camera, HUD, menus, sound and the `?debug=1` hook `aisleDebug`.
- `sprites/`: WebP sheets for Aron with the stroller (3 walk frames), Rebecca (6 poses) and 28 items.
- `prompts/`: the ChatGPT prompts that made the sheets.

## Art

Characters and items are generated in ChatGPT from the homepage character sheet, like the office
illustration (see `../office/README.md`). The originals stay private in
`~/aronwagner-art/generated/` (`05-aisle-aron-stroller.png`, `06-aisle-rebecca-poses.png`,
`07-aisle-items.png`). To rebuild the sheets after regenerating one:

```sh
python3 tools/prepare-aisle-sprites.py
```

It normalizes the generator's alpha, separates Aron's frames and aligns them on the stroller's front
wheel, scales Rebecca's poses to one height centered on her feet, and cuts the items by their
outlines. Keep `sprites.js` in step with the sizes at the top of the script.

## Verify

```sh
node --test tests/aisle-dash.test.js          # rules, balance and full simulated days
node tools/test-browser.js aisle-dash-smoke.cjs responsive-aisle-dash.cjs game-lifecycle.cjs
node tools/render-aisle-dash-preview.cjs      # homepage thumbnail
```
