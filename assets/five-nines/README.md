# Five Nines

The American Cloud night shift, side-on: Aron is somehow the only one on, and nine racks of real
American Cloud products (VMs, Kubernetes, Object Storage, Block Storage, Load Balancers, Databases,
DNS, WordPress, VPC Networks) keep breaking between 9 PM and 6 AM. Serve the repository over HTTP
and open `/five-nines.html`.

## Play

- **← → (or A D)** run along the row; **hold Space / E** in front of a rack to fix it. Aron fixes
  the rack he's facing. **P / Escape** pauses. Touch devices get ◀ ▶ and a hold-to-fix button
  labeled with the fix.
- Trouble, and its fix:
  - **Cable out** (down at once): plug it back in, quick.
  - **Disk full**: swap the drive before it crashes.
  - **Too hot**: cool it before it catches fire.
  - **Traffic spike** (Load Balancers): scale up before it crashes.
  - **Fire** (down): spray it out; left burning, it heats up the racks on either side.
  - **Crash** (down): reboot it.
    Warnings show a countdown ring; left alone they get worse and any half-done fix is lost.
- **Tickets** arrive at the help desk in the middle of the row. Answer them there, or fix the rack a
  customer is asking about and the ticket closes itself (worth more). Ignored tickets cost a lot of
  customer happiness; if it hits zero the shift ends early.
- **The coffee cart** makes Aron faster for 15 seconds, once every 40.
- **Uptime** only counts racks that are down, measured against the whole shift, so the board only
  ticks down. The board squares the down fraction so a sharp night reads like real "nines": a few
  seconds of downtime is five nines, a messy night is two. The shift is three minutes; the best
  score is saved under `five-nines-best-score`.

## Files

- `floor.js`: the row: rack positions, products, the help desk, coffee cart and scenery.
- `shift.js`: the deterministic simulation (trouble, fixes, tickets, uptime, endings). `?seed=n`
  makes a shift repeatable.
- `sprites.js` and `sprite-data.js`: sprite loading and drawing; `sprite-data.js` is generated.
- `art.js`: Canvas 2D room, rack lights and states, fire and foam, bubbles, tickets, the uptime
  board and edge pointers.
- `game.js`: controller: input, camera, HUD, toasts, sound and the `?debug=1` hook `ninesDebug`.
- `sprites/`: WebP sheets for Aron's ten poses, the racks, and 20 props, customers and effects.
- `prompts/`: the ChatGPT prompts that made the sheets.

## Art

The sheets were generated in ChatGPT from the homepage character sheet and office illustration,
like the other games'. The originals stay private in `~/aronwagner-art/generated/`
(`11-dc-aron.png`, `12-dc-racks.png`, `13-dc-props.png`). After regenerating one:

```sh
python3 tools/prepare-dc-sprites.py
```

It shares its cutting code with the other games (`tools/lib/sprite_sheets.py`), which splits
figures drawn touching (the customers stand shoulder to shoulder) at their thinnest point.

## Verify

```sh
node --test tests/five-nines.test.js          # rules and simulated shifts at several skill levels
node tools/test-browser.js five-nines-smoke.cjs responsive-five-nines.cjs game-lifecycle.cjs
node tools/render-five-nines-preview.cjs      # homepage thumbnail
```
