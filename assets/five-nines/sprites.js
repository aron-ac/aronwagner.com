// Illustrated sprites for Five Nines, cut by tools/prepare-dc-sprites.py.
import { SPRITES } from './sprite-data.js';

export { SPRITES };

/** Load every sheet relative to this module. Resolves to { aron, racks, props }. */
export async function loadSprites(base = import.meta.url) {
  const load = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load ${src}`));
      image.src = new URL(src, base).href;
    });
  const [aron, racks, props] = await Promise.all(
    ['sprites/aron.webp', 'sprites/racks.webp', 'sprites/props.webp'].map(load),
  );
  return { aron, racks, props };
}

// World height of a pose cell; the tallest pose nearly fills it.
export const ARON_HEIGHT = 262;
const aronScale = ARON_HEIGHT / SPRITES.aron.cell[1];

/** Aron in pose `name`, feet centered on (x, y), facing ±1. */
export function drawAron(ctx, sheets, { x, y, name, facing = 1 }) {
  const [w, h] = SPRITES.aron.cell;
  const index = Math.max(0, SPRITES.aron.poses.indexOf(name));
  ctx.save();
  ctx.translate(x, y);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.drawImage(
    sheets.aron,
    index * w,
    0,
    w,
    h,
    (-w / 2) * aronScale,
    (-h + 6) * aronScale,
    w * aronScale,
    h * aronScale,
  );
  ctx.restore();
}

function drawFrom(ctx, sheet, rect, x, y, height, flip) {
  const [sx, sy, sw, sh] = rect;
  const w = (sw / sh) * height;
  ctx.save();
  ctx.translate(x, y);
  if (flip) ctx.scale(-1, 1);
  ctx.drawImage(sheet, sx, sy, sw, sh, -w / 2, -height, w, height);
  ctx.restore();
  return w;
}

/** A rack-sheet piece standing on (x, y), `height` tall; returns its width. */
export function drawRackSprite(ctx, sheets, name, x, y, height, { flip = false } = {}) {
  return drawFrom(ctx, sheets.racks, SPRITES.racks[name], x, y, height, flip);
}

/** A prop standing on (x, y), `height` tall; returns its width. */
export function drawProp(ctx, sheets, name, x, y, height, { flip = false } = {}) {
  return drawFrom(ctx, sheets.props, SPRITES.props[name], x, y, height, flip);
}

export function rackWidth(name, height) {
  const [, , sw, sh] = SPRITES.racks[name];
  return (sw / sh) * height;
}

export function propWidth(name, height) {
  const [, , sw, sh] = SPRITES.props[name];
  return (sw / sh) * height;
}
