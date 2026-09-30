# Maggie's Toy Run course

An original 6,200px backyard route for a 900×500 logical viewport. The ground stays at y=420, with seven short pits and optional raised plank routes. A clean ground run takes about 25–35 seconds; exploring the upper routes and collecting balls adds time, aiming for roughly a minute on a first outing.

`createLevel()` returns a fresh mutable data set on every call:

- 8 ground sections plus 22 one-way platforms, all with unique IDs.
- 75 tennis balls: 32 at running height, 21 in seven three-ball jump arcs, and 22 on optional platforms.
- 8 bath bubbles, with left-edge patrol endpoints and initial speed/direction.
- Checkpoint respawn anchors at (2025, 372) and (4080, 372).
- Spawn at (80, 372); finish (Aron and Rebecca) at (5970, 280), size 100×140.

Coordinates are top-left, except balls, which use center coordinates. A checkpoint's y is Maggie's standing top-left respawn height. Render its flag above that anchor, with the flagpole base at y=420. Ground extends to y=600 so only pits allow a fall through the fail line at y=570.

Raised `platform` surfaces should be one-way: land on their top while descending, and pass through them when ascending. The lowest platform underside is y=365, leaving clearance above the standing player's head at y=372. There are no required raised routes or double jumps.

## Reachability checks

Checks were run against a 46×48 player, maximum speed 260px/s, initial jump speed 610px/s upward, and gravity 1600px/s²:

- Maximum jump height: `610² / (2 × 1600) = 116.28px`.
- Same-height flight time: `2 × 610 / 1600 = 0.7625s`.
- Maximum same-height horizontal travel: `260 × 0.7625 = 198.25px`.
- Mandatory pit widths: **95, 100, 110, 100, 110, 100, 105px**. Even a fully supported takeoff and fully supported landing require at most 156px of travel, below the 198.25px budget.
- Optional staircase rises are 75–90px, below the jump-height limit. Every landing is at least 100px wide.
- A graph of reachable descending landings from the spawn ground reaches all 30 surfaces. For platforms at heights `a.y` and `b.y`, descending time is `(610 + sqrt(610² + 3200 × (b.y - a.y))) / 1600`; the horizontal surface gap must fit within `260 × time`.
- Every ball intersects a reachable standing/jumping player envelope. All 21 pit balls were also sampled against actual ballistic jumps begun with the player's left edge 73px before each pit, at 240 samples per second.
- Every bubble patrol lies on one uninterrupted ground section. The nearest patrol edge is 85px from a pit; the nearest bubble-to-checkpoint-body clearance is 186px.
- IDs are unique, spawn/checkpoints rest on wide ground, and new level instances reset collection/checkpoint state.

These checks establish geometric reachability; gameplay checks should still cover the final collision implementation, variable-height jumps, enemy contact, checkpoint restoration, and the finish trigger.

## Playing the route

The first flat section introduces a short optional hop before the first bubble and pit. The ball arcs suggest jumping roughly 70px before a pit while moving at full speed. Ground routes remain available beneath all upper ledges, so missing a bonus route does not block progress. Keep bubbles stompable or temporarily poppable; mandatory pits are the only full-route precision jumps.

Checkpoint flags should be obvious and activate by horizontal proximity rather than requiring a small exact-height hitbox. Ground balls after the final bubble lead to the patio; no ball is hidden behind the finish trigger.
