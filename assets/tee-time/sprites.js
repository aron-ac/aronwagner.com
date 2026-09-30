// Illustrated sprites for Tee Time, cut by tools/prepare-golf-sprites.py.
import { SPRITES } from './sprite-data.js';

export { SPRITES };

/** Load every sheet relative to this module. Resolves to { aron, maggie, props }. */
export async function loadSprites(base = import.meta.url) {
  const load = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load ${src}`));
      image.src = new URL(src, base).href;
    });
  const [aron, maggie, props] = await Promise.all(
    ['sprites/aron.webp', 'sprites/maggie.webp', 'sprites/props.webp'].map(load),
  );
  return { aron, maggie, props };
}

// World size of a pose cell: the tallest pose fills ARON_HEIGHT.
export const ARON_HEIGHT = 262;
const aronScale = ARON_HEIGHT / SPRITES.aron.cell[1];

/** Where Aron's feet go so the club meets a ball at (x, y), facing ±1. */
export function aronStance(ball, facing, putting) {
  const [dx] = SPRITES.aron.clubhead[putting ? 'putt' : 'address'];
  // His feet stand on the same surface as the ball (the ball's radius is 6).
  return { x: ball.x - facing * dx * aronScale, y: ball.y + 6 };
}

function pose(ctx, sheet, cell, index, x, y, scale, facing) {
  const [w, h] = cell;
  ctx.save();
  ctx.translate(x, y);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.drawImage(
    sheet,
    index * w,
    0,
    w,
    h,
    (-w / 2) * scale,
    (-h + 6) * scale,
    w * scale,
    h * scale,
  );
  ctx.restore();
}

export function drawAron(ctx, sheets, { x, y, name, facing = 1 }) {
  const index = SPRITES.aron.poses.indexOf(name);
  pose(ctx, sheets.aron, SPRITES.aron.cell, index, x, y, aronScale, facing);
}

export const MAGGIE_HEIGHT = 120;
export function drawMaggie(ctx, sheets, { x, y, name, facing = 1 }) {
  const index = SPRITES.maggie.poses.indexOf(name);
  pose(
    ctx,
    sheets.maggie,
    SPRITES.maggie.cell,
    index,
    x,
    y,
    MAGGIE_HEIGHT / SPRITES.maggie.cell[1],
    facing,
  );
}

/** A prop standing on (x, y): `height` in world units, width from its aspect. */
export function drawProp(ctx, sheets, name, x, y, height, { flip = false } = {}) {
  const [sx, sy, sw, sh] = SPRITES.props[name];
  const w = (sw / sh) * height;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(sheets.props, sx, sy, sw, sh, -w / 2, -height, w, height);
  ctx.restore();
  return w;
}

export function propWidth(name, height) {
  const [, , sw, sh] = SPRITES.props[name];
  return (sw / sh) * height;
}
