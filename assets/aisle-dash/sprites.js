// Illustrated sprites for Aisle Dash, cut from ChatGPT sheets by
// tools/prepare-aisle-sprites.py. Sizes here mirror that script's constants.

export const ARON = { src: 'sprites/aron.webp', frame: [437, 702], frames: 3 };
export const REBECCA = { src: 'sprites/rebecca.webp', frame: [370, 490], figure: 470 };
export const ITEMS = { src: 'sprites/items.webp', cell: 128, columns: 7 };

export const POSES = { walkA: 0, walkB: 1, browse: 2, delighted: 3, unimpressed: 4, coffee: 5 };
export const ITEM_INDEX = [
  'seasonal-mug',
  'pumpkins',
  'throw-blanket',
  'candle',
  'throw-pillow',
  'olive-tree',
  'basket',
  'lamp',
  'lip-gloss',
  'face-masks',
  'onesies',
  'board-books',
  'cardigan',
  'jeans',
  'sundress',
  'handbag',
  'sandals',
  'sneakers',
  'perfume',
  'necklace',
  'earrings',
  'sunglasses',
  'sun-hat',
  'teddy-bear',
  'novel',
  'iced-latte',
  'cupcake',
  'pacifier',
];

/** Load every sheet relative to this module. Resolves to { aron, rebecca, items }. */
export async function loadSprites(base = import.meta.url) {
  const load = (src) =>
    new Promise((resolve, reject) => {
      const image = new Image();
      image.decoding = 'async';
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error(`Could not load ${src}`));
      image.src = new URL(src, base).href;
    });
  const [aron, rebecca, items] = await Promise.all([ARON.src, REBECCA.src, ITEMS.src].map(load));
  return { aron, rebecca, items };
}

/** Aron and the stroller, feet on (x, y). `height` is the frame height in world units. */
export function drawAron(ctx, sheet, { x, y, frame = 0, height = 250, facing = 1 }) {
  const [fw, fh] = ARON.frame;
  const scale = height / fh,
    w = fw * scale;
  ctx.save();
  ctx.translate(x, y);
  if (facing < 0) ctx.scale(-1, 1);
  // The stroller is the right half of the frame; x is Aron's feet, a third of the way in.
  ctx.drawImage(sheet, frame * fw, 0, fw, fh, -w * 0.33, -height, w, height);
  ctx.restore();
  return { width: w, height };
}

/** Rebecca in one of POSES, feet centered on (x, y). */
export function drawRebecca(ctx, sheet, { x, y, pose = 0, height = 240, facing = 1, bob = 0 }) {
  const [fw, fh] = REBECCA.frame;
  const scale = height / REBECCA.figure,
    w = fw * scale,
    h = fh * scale;
  ctx.save();
  ctx.translate(x, y - bob);
  if (facing < 0) ctx.scale(-1, 1);
  ctx.drawImage(sheet, pose * fw, 0, fw, fh, -w / 2, -h + 8 * scale, w, h);
  ctx.restore();
}

export function drawItem(ctx, sheet, name, x, y, size) {
  const index = ITEM_INDEX.indexOf(name);
  if (index < 0) return;
  const cell = ITEMS.cell,
    col = index % ITEMS.columns,
    row = Math.floor(index / ITEMS.columns);
  ctx.drawImage(sheet, col * cell, row * cell, cell, cell, x - size / 2, y - size / 2, size, size);
}
