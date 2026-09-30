# Tee Time

Nine holes of side-on golf: three through Aron's house (the office, the living room, and the kitchen
out to the patio), then six on a Tampa course by the bay. Par is 33. Serve the repository over HTTP
and open `/tee-time.html`.

## Play

- **Drag back from anywhere and let go**, like a slingshot: the pull sets the direction and the
  distance sets the power. A dotted arc shows the opening of the shot.
- **Keyboard:** ← → (or A D) aim; hold **Space** and the power meter rises and falls; let go to
  swing. **P / Escape** pauses. Touch devices also get ↺ ↻ aim buttons and a hold-to-swing button.
- On a green (or the indoor putting mats) the club becomes a putter: less power and a ground roll.
- Surfaces matter: hardwood and patio are fast, carpet and rough are slow, sand nearly stops the
  ball, and the sofa and dog toys are soft. Furniture can be landed on and rolled off. Indoors, the
  ceiling keeps shots low.
- Water costs a penalty stroke and replays from the last spot. Outdoor holes have wind.
- Once per hole there's a chance Maggie runs in, grabs a resting ball and drops it somewhere nearby,
  closer or farther, never in the water. It costs no stroke.
- After eight strokes the ball is picked up (scored as 9). The scorecard shows after every hole; the
  best round is saved under `tee-time-best-round`. The final card includes an email link to set up
  a real round.

## Files

- `holes.js`: the nine holes: ground runs with materials, furniture, water, props, tee and cup.
- `golf.js`: deterministic ball physics and the round (strokes, Maggie, scoring). `?seed=n` makes
  wind and Maggie repeatable.
- `sprites.js` and `sprite-data.js`: sprite loading and drawing; `sprite-data.js` is generated.
- `art.js`: Canvas 2D rooms, sky, skyline, terrain, water, cup, ball and aiming guides.
- `game.js`: controller: slingshot and keyboard input, camera, poses, HUD, scorecard, sound and the
  `?debug=1` hook `teeDebug`.
- `sprites/`: WebP sheets for Aron's six golf poses, Maggie's six poses and 20 props.
- `prompts/`: the ChatGPT prompts that made the sheets.

## Art

The sheets were generated in ChatGPT from the homepage character sheet and office illustration,
like Aisle Dash's (see `../aisle-dash/README.md`). The originals stay private in
`~/aronwagner-art/generated/` (`08-golf-aron-swing.png`, `09-golf-maggie.png`,
`10-golf-props.png`). After regenerating one:

```sh
python3 tools/prepare-golf-sprites.py
```

It shares its cutting code with the Aisle Dash script (`tools/lib/sprite_sheets.py`), keeps Aron's
poses at one scale so the club lines up over the ball, records where the clubhead rests, and writes
each prop's position in the atlas to `sprite-data.js`.

## Verify

```sh
node --test tests/tee-time.test.js            # course, physics and full simulated rounds
node tools/test-browser.js tee-time-smoke.cjs responsive-tee-time.cjs game-lifecycle.cjs
node tools/render-tee-time-preview.cjs        # homepage thumbnail
```
