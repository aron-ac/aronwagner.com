/** Side-on Canvas 2D scenery, fixtures, bubbles and effects for Aisle Dash.
 * People and items are illustrated sprites (sprites.js); everything else is
 * drawn here. World units: the scene is 600 tall, floor line at FLOOR_Y.
 */
import { drawItem, drawAron, drawRebecca, ARON, POSES } from './sprites.js';

const TAU = Math.PI * 2;
const INK = '#3a2c25';
const FONT = '"Trebuchet MS", sans-serif';
export const FLOOR_Y = 470;
export const REBECCA_Y = 540;
export const ARON_Y = 566;
export const ARON_HEIGHT = 278;
export const REBECCA_HEIGHT = 252;

function ellipse(ctx, x, y, rx, ry, fill, stroke, lineWidth = 1.6) {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0, rx), Math.max(0, ry), 0, 0, TAU);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}
function box(ctx, x, y, w, h, r, fill, stroke, lineWidth = 1.6) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}
function text(
  ctx,
  value,
  x,
  y,
  { size = 14, color = INK, weight = 'bold', align = 'center', font = FONT } = {},
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${font}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}
const noise = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const shadow = (ctx, x, y, rx) => ellipse(ctx, x, y, rx, rx * 0.12, '#0000001f');

// ——— Backdrops (screen-space x with parallax, world-space y) ———

export function drawBackdrop(ctx, store, view, time = 0) {
  if (store.theme === 'target') targetBackdrop(ctx, view);
  else mallBackdrop(ctx, view, time);
}

function floor(ctx, view, colors) {
  const top = FLOOR_Y,
    bottom = view.y + view.height;
  const gradient = ctx.createLinearGradient(0, top, 0, Math.max(top + 1, bottom));
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(0.3, colors[1]);
  gradient.addColorStop(1, colors[2]);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, top, view.width, bottom - top);
  ctx.fillStyle = colors[3];
  ctx.fillRect(0, top, view.width, 5);
  ctx.strokeStyle = colors[4];
  ctx.lineWidth = 1.2;
  const seam = 120,
    offset = view.x % seam;
  for (let i = -2; i < view.width / seam + 3; i++) {
    const x = i * seam - offset;
    ctx.beginPath();
    ctx.moveTo(x, top + 5);
    ctx.lineTo(x + (x - view.width / 2) * 0.55, bottom);
    ctx.stroke();
  }
  for (const y of [top + 34, top + 84, top + 150]) {
    if (y > bottom) break;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(view.width, y);
    ctx.stroke();
  }
}

function lights(ctx, view, y) {
  for (let i = -1; i < view.width / 260 + 2; i++) {
    const x = i * 260 - ((view.x * 0.3) % 260) + 130;
    ctx.fillStyle = '#fffdf6';
    ctx.fillRect(x - 60, y, 120, 7);
    const glow = ctx.createRadialGradient(x, y + 4, 4, x, y + 4, 150);
    glow.addColorStop(0, '#fff8e060');
    glow.addColorStop(1, '#fff8e000');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 150, y, 300, 160);
  }
}

function targetBackdrop(ctx, view) {
  ctx.fillStyle = '#e9e2d9';
  ctx.fillRect(0, view.y, view.width, -view.y + 1);
  const wall = ctx.createLinearGradient(0, 0, 0, FLOOR_Y);
  wall.addColorStop(0, '#f7f1ea');
  wall.addColorStop(1, '#efe6dc');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, view.width, FLOOR_Y);
  ctx.fillStyle = '#cf3a3d';
  ctx.fillRect(0, 0, view.width, 22);
  ctx.fillStyle = '#b52f33';
  ctx.fillRect(0, 22, view.width, 4);
  lights(ctx, view, 26);
  const unit = 230,
    scroll = view.x * 0.55,
    first = Math.floor(scroll / unit) - 1;
  for (let i = first; i < first + view.width / unit + 3; i++) gondola(ctx, i * unit - scroll, i);
  floor(ctx, view, ['#dcd6ce', '#ebe7e1', '#f4f1ed', '#c9c1b6', '#d9d2c9']);
  reflections(ctx, view);
}

function reflections(ctx, view) {
  for (let i = -1; i < view.width / 260 + 2; i++) {
    const x = i * 260 - ((view.x * 0.3) % 260) + 130;
    ctx.fillStyle = '#ffffff40';
    ctx.beginPath();
    ctx.ellipse(x, FLOOR_Y + 64, 70, 15, 0, 0, TAU);
    ctx.fill();
  }
}

const PRODUCT_ROWS = [
  ['#e9d8c2', '#c9a27e', '#f4ece0', '#b98c6a', '#8fa892'],
  ['#f2c4cf', '#e6a4b6', '#fbe3e8', '#c9a3d8', '#ffffff'],
  ['#a9c7d9', '#f3dca0', '#d7e8cf', '#f0c3a3', '#e7ecf0'],
  ['#d4dcc3', '#b7c7a6', '#efe2c8', '#9db3a0', '#e8c9a4'],
];

function gondola(ctx, x, index) {
  const top = 132,
    w = 222;
  ctx.fillStyle = '#e6e1db';
  ctx.fillRect(x, top, w, FLOOR_Y - top);
  ctx.fillStyle = '#d7d0c7';
  ctx.fillRect(x, top, 6, FLOOR_Y - top);
  ctx.fillRect(x + w - 6, top, 6, FLOOR_Y - top);
  box(ctx, x - 2, top - 12, w + 4, 16, 3, '#cf3a3d');
  for (let level = 0; level < 4; level++) {
    const shelfY = 210 + level * 80;
    const palette = PRODUCT_ROWS[(((index + level) % 4) + 4) % 4];
    let px = x + 10,
      n = 0;
    while (px < x + w - 18) {
      const seed = index * 31 + level * 7 + n;
      const kind = Math.floor(noise(seed) * 4);
      const color = palette[Math.floor(noise(seed + 5) * palette.length)];
      const pw = [26, 16, 34, 20][kind],
        ph = [46, 40, 30, 52][kind];
      product(ctx, kind, px, shelfY, pw, ph, color, seed);
      px += pw + 4;
      n++;
    }
    ctx.fillStyle = '#f3efea';
    ctx.fillRect(x + 4, shelfY, w - 8, 6);
    ctx.fillStyle = '#c3bab0';
    ctx.fillRect(x + 4, shelfY + 6, w - 8, 3);
  }
}

function product(ctx, kind, x, base, w, h, color, seed) {
  if (kind === 0) {
    box(ctx, x, base - h, w, h, 2, color, '#0002', 1);
    ctx.fillStyle = '#ffffff90';
    ctx.fillRect(x + 3, base - h * 0.62, w - 6, h * 0.22);
  } else if (kind === 1) {
    box(ctx, x, base - h + 10, w, h - 10, 5, color, '#0002', 1);
    box(ctx, x + w * 0.3, base - h, w * 0.4, 12, 2, '#6f6a66');
  } else if (kind === 2) {
    for (let i = 0; i < 3; i++)
      box(ctx, x, base - (i + 1) * (h / 3), w, h / 3 - 1, 4, i % 2 ? color : '#fbf7f1', '#0002', 1);
  } else {
    box(ctx, x, base - h + 8, w, h - 8, 4, color, '#0002', 1);
    box(ctx, x - 1, base - h + 4, w + 2, 8, 3, '#ddd3c6', '#0002', 1);
    if (noise(seed + 9) > 0.5) ellipse(ctx, x + w / 2, base - h * 0.45, w * 0.28, 5, '#ffffffa0');
  }
}

function mallBackdrop(ctx, view, time) {
  // A bright two-level concourse: skylight, upper-floor shops and a glass railing.
  const sky = ctx.createLinearGradient(0, view.y, 0, 200);
  sky.addColorStop(0, '#cfe7ef');
  sky.addColorStop(1, '#f6efe4');
  ctx.fillStyle = sky;
  ctx.fillRect(0, view.y, view.width, 200 - view.y);
  const beam = 180,
    scroll = view.x * 0.2;
  ctx.strokeStyle = '#ffffffb0';
  ctx.lineWidth = 6;
  for (let i = Math.floor(scroll / beam) - 1; i < scroll / beam + view.width / beam + 2; i++) {
    const x = i * beam - scroll;
    ctx.beginPath();
    ctx.moveTo(x, view.y);
    ctx.lineTo(x + 40, 60);
    ctx.stroke();
  }
  ctx.fillStyle = '#efe6da';
  ctx.fillRect(0, 60, view.width, FLOOR_Y - 60);
  const shop = 210,
    upper = view.x * 0.45;
  for (let i = Math.floor(upper / shop) - 1; i < upper / shop + view.width / shop + 2; i++) {
    const x = i * shop - upper;
    const color = ['#e8d2c4', '#d4dfe6', '#e9dcc8', '#dcd3e6'][((i % 4) + 4) % 4];
    box(ctx, x + 10, 76, shop - 20, 70, 4, color);
    box(ctx, x + 30, 84, shop - 60, 14, 3, '#fffaf2');
    box(ctx, x + 24, 104, shop - 48, 38, 3, '#cfe7ee');
  }
  ctx.fillStyle = '#dccfbf';
  ctx.fillRect(0, 146, view.width, 14);
  ctx.fillStyle = '#bfe0ea60';
  ctx.fillRect(0, 118, view.width, 28);
  ctx.strokeStyle = '#b8ab9b';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, 118);
  ctx.lineTo(view.width, 118);
  ctx.stroke();
  for (let i = Math.floor(upper / 520) - 1; i < upper / 520 + view.width / 520 + 2; i++) {
    const x = i * 520 - upper + 260,
      sway = Math.sin(time * 1.2 + i) * 2;
    box(ctx, x - 22 + sway, 164, 44, 70, 4, i % 2 ? '#e0a1ae' : '#8fc3cf');
    text(ctx, i % 2 ? 'SALE' : 'NEW', x + sway, 199, { size: 12, color: '#fff' });
  }
  floor(ctx, view, ['#e6dccd', '#f1e9dd', '#f7f2ea', '#d2c5b3', '#e4d9c9']);
  reflections(ctx, view);
}

// ——— Fixtures (world space) ———

export function drawSectionSign(ctx, x, label) {
  const width = Math.max(130, label.length * 13 + 40);
  ctx.strokeStyle = '#9b948c';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - width / 3, 26);
  ctx.lineTo(x - width / 3, 70);
  ctx.moveTo(x + width / 3, 26);
  ctx.lineTo(x + width / 3, 70);
  ctx.stroke();
  box(ctx, x - width / 2, 70, width, 42, 10, '#cf3a3d', '#a82c2f', 2);
  text(ctx, label, x, 92, { size: label.length > 10 ? 17 : 22, color: '#fff' });
}

function itemsFor(store, spot) {
  return (store.items[spot.dept] || []).map((item) => item[3]);
}

function table(ctx, sheets, x, items, { top = '#c79c72', legs = '#a97f58', width = 216 } = {}) {
  const y = 524;
  shadow(ctx, x, y + 2, width * 0.56);
  box(ctx, x - width / 2, y - 64, width, 16, 4, top, INK, 1.6);
  box(ctx, x - width / 2 + 8, y - 48, 12, 48, 2, legs, INK, 1.4);
  box(ctx, x + width / 2 - 20, y - 48, 12, 48, 2, legs, INK, 1.4);
  box(ctx, x - width / 2 + 16, y - 24, width - 32, 8, 2, legs, INK, 1.2);
  const step = width / (items.length + 1);
  items.forEach((item, i) =>
    drawItem(ctx, sheets.items, item, x - width / 2 + step * (i + 1), y - 100, 76),
  );
}

function endcap(ctx, sheets, x, items) {
  const y = 524,
    w = 190,
    h = 250;
  shadow(ctx, x, y + 2, 110);
  box(ctx, x - w / 2, y - h, w, h, 6, '#f1ece6', INK, 1.6);
  box(ctx, x - w / 2, y - h, w, 30, 6, '#cf3a3d', INK, 1.6);
  text(ctx, 'NEW', x, y - h + 15, { size: 13, color: '#fff' });
  for (let level = 0; level < 3; level++) {
    const shelfY = y - h + 100 + level * 70;
    box(ctx, x - w / 2 + 6, shelfY, w - 12, 8, 2, '#d5cdc3', INK, 1);
    for (let i = 0; i < 3; i++) {
      const item = items[(level + i) % items.length];
      drawItem(ctx, sheets.items, item, x - 58 + i * 58, shelfY - 28, 54);
    }
  }
}

function rack(ctx, sheets, x, items, time) {
  const y = 524;
  shadow(ctx, x, y + 2, 120);
  ctx.strokeStyle = '#9aa0a6';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x - 100, y - 190);
  ctx.lineTo(x + 100, y - 190);
  ctx.moveTo(x - 90, y - 190);
  ctx.lineTo(x - 100, y);
  ctx.moveTo(x + 90, y - 190);
  ctx.lineTo(x + 100, y);
  ctx.stroke();
  const colors = ['#e9c8a8', '#7d8fb3', '#f2f0ea', '#b85c5c', '#c9a26b', '#7aa38e', '#efd9d3'];
  for (let i = 0; i < 9; i++) {
    const gx = x - 82 + i * 20,
      sway = Math.sin(time * 1.5 + i) * 1.5;
    ctx.strokeStyle = '#8b8f94';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(gx, y - 190);
    ctx.lineTo(gx + sway, y - 178);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx - 13 + sway, y - 176);
    ctx.lineTo(gx + 13 + sway, y - 176);
    ctx.lineTo(gx + 16 + sway, y - 96 - (i % 3) * 8);
    ctx.lineTo(gx - 16 + sway, y - 96 - (i % 3) * 8);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  items.forEach((item, i) => drawItem(ctx, sheets.items, item, x - 36 + i * 72, y - 40, 62));
}

function dollarSection(ctx, sheets, x) {
  for (const [dx, items] of [
    [-110, ['seasonal-mug', 'pumpkins']],
    [110, ['pumpkins', 'seasonal-mug']],
  ])
    table(ctx, sheets, x + dx, items, { top: '#d94545', legs: '#b83636', width: 180 });
}

function coffeeBar(ctx, sheets, counter) {
  const x = counter.x,
    y = 524;
  shadow(ctx, x, y + 2, 170);
  box(ctx, x - 150, y - 110, 300, 110, 6, '#6b4a3a', INK, 1.6);
  box(ctx, x - 160, y - 120, 320, 16, 4, '#efe3d0', INK, 1.6);
  for (let i = 0; i < 6; i++) box(ctx, x - 140 + i * 48, y - 94, 40, 80, 3, '#7a5645');
  box(ctx, x - 120, y - 190, 88, 70, 8, '#8d9097', INK, 1.6);
  ellipse(ctx, x - 94, y - 150, 9, 9, '#3b3e44');
  ellipse(ctx, x - 58, y - 150, 9, 9, '#3b3e44');
  box(ctx, x - 104, y - 132, 58, 8, 2, '#3b3e44');
  for (let i = 0; i < 3; i++)
    drawItem(ctx, sheets.items, counter.icon, x + 10 + i * 46, y - 150, 58);
  box(ctx, x - 60, y - 300, 120, 50, 8, '#3d2a22', INK, 1.4);
  text(ctx, `$${counter.price}`, x, y - 275, { size: 20, color: '#ffe3a0' });
}

function checkout(ctx, store, time) {
  const start = store.exit.x;
  for (let lane = 0; lane < 3; lane++) {
    const x = start + 40 + lane * 90,
      y = 524;
    shadow(ctx, x + 30, y + 2, 50);
    box(ctx, x, y - 90, 70, 90, 4, '#e6e3de', INK, 1.4);
    box(ctx, x + 4, y - 96, 62, 10, 3, '#3b3f45');
    box(ctx, x + 44, y - 130, 22, 34, 3, '#5d636b', INK, 1.2);
    ctx.strokeStyle = '#8e8e8e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x + 10, y - 96);
    ctx.lineTo(x + 10, y - 170);
    ctx.stroke();
    const on = Math.sin(time * 3 + lane) > -0.6;
    ellipse(ctx, x + 10, y - 180, 13, 13, on ? '#e0483f' : '#b73a33', '#fff', 2);
    text(ctx, String(lane + 1), x + 10, y - 179, { size: 13, color: '#fff' });
  }
}

function entrance(ctx, store) {
  const y = FLOOR_Y + 2;
  box(ctx, -20, y - 330, 150, 330, 4, '#bfe0ea80', '#8fb7c3', 3);
  ctx.strokeStyle = '#8fb7c3';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(55, y - 330);
  ctx.lineTo(55, y);
  ctx.stroke();
  text(ctx, store.theme === 'target' ? 'ENTRANCE' : 'PARKING', 55, y - 350, {
    size: 14,
    color: '#8a7d70',
  });
}

function exitDoors(ctx, store) {
  const x = store.length - 170,
    y = FLOOR_Y + 2;
  box(ctx, x, y - 330, 190, 330, 4, '#bfe0ea80', '#8fb7c3', 3);
  ctx.strokeStyle = '#8fb7c3';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x + 95, y - 330);
  ctx.lineTo(x + 95, y);
  ctx.stroke();
  box(ctx, x + 30, y - 380, 130, 36, 8, store.theme === 'target' ? '#cf3a3d' : '#5b8f7a');
  text(ctx, store.theme === 'target' ? 'EXIT' : 'EXIT · VALET', x + 95, y - 362, {
    size: 15,
    color: '#fff',
  });
}

function storefront(ctx, sheets, shop) {
  const x = shop.x,
    w = 250,
    top = 176,
    y = FLOOR_Y + 2;
  box(ctx, x - w / 2, top, w, y - top, 4, shop.color, INK, 1.6);
  for (let i = 0; i < w / 25; i++) {
    ctx.fillStyle = i % 2 ? '#fffaf2' : shop.color;
    ctx.fillRect(x - w / 2 + i * 25, top + 48, 25, 22);
  }
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(x - w / 2, top + 48, w, 22);
  box(ctx, x - w / 2 + 14, top + 8, w - 28, 34, 6, '#fffaf2', INK, 1.2);
  text(ctx, shop.name, x, top + 26, { size: 19, font: 'Georgia, serif', color: '#4a3a34' });
  box(ctx, x - w / 2 + 14, top + 86, w - 90, y - top - 100, 4, '#d8eef3', INK, 1.4);
  ctx.fillStyle = '#ffffff70';
  ctx.beginPath();
  ctx.moveTo(x - w / 2 + 24, top + 90);
  ctx.lineTo(x - w / 2 + 64, top + 90);
  ctx.lineTo(x - w / 2 + 34, y - 20);
  ctx.lineTo(x - w / 2 + 18, y - 20);
  ctx.fill();
  shop.display.forEach((item, i) =>
    drawItem(ctx, sheets.items, item, x - w / 2 + 50 + i * 58, y - 70, 66),
  );
  box(ctx, x + w / 2 - 66, top + 86, 52, y - top - 86, 3, '#5a4a42', INK, 1.4);
  ellipse(ctx, x + w / 2 - 24, y - 90, 3, 3, '#e8d3a7');
}

function fountain(ctx, x, time) {
  const y = 528;
  shadow(ctx, x, y + 4, 150);
  const spray = Math.sin(time * 5) * 3;
  ctx.strokeStyle = '#bfe6f2';
  ctx.lineWidth = 4;
  for (const dx of [-30, 0, 30]) {
    ctx.beginPath();
    ctx.moveTo(x, y - 110);
    ctx.quadraticCurveTo(x + dx, y - 200 - spray, x + dx * 2.4, y - 64);
    ctx.stroke();
  }
  box(ctx, x - 16, y - 130, 32, 70, 6, '#d8cfc2', INK, 1.4);
  box(ctx, x - 140, y - 64, 280, 64, 12, '#d8cfc2', INK, 1.6);
  box(ctx, x - 128, y - 70, 256, 14, 7, '#8ecbe0', INK, 1.2);
  for (let i = 0; i < 3; i++) {
    const t = (time * 0.6 + i / 3) % 1;
    ctx.globalAlpha = 1 - t;
    ellipse(ctx, x + (i - 1) * 60, y - 63, 10 + t * 26, 3 + t * 3, null, '#ffffff', 1.5);
  }
  ctx.globalAlpha = 1;
}

function planter(ctx, x, time) {
  const y = 524;
  shadow(ctx, x, y + 2, 50);
  ctx.strokeStyle = '#8c7a52';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(x, y - 60);
  ctx.quadraticCurveTo(x + 6, y - 150, x - 4, y - 220);
  ctx.stroke();
  ctx.strokeStyle = '#5f9a63';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  for (const a of [-2.8, -2.3, -1.7, -1.2, -0.7, -0.25]) {
    const sway = Math.sin(time + a) * 3;
    ctx.beginPath();
    ctx.moveTo(x - 4, y - 220);
    ctx.quadraticCurveTo(
      x - 4 + Math.cos(a) * 44,
      y - 220 + Math.sin(a) * 44 - 16,
      x - 4 + Math.cos(a) * 80 + sway,
      y - 220 + Math.sin(a) * 26 + 40,
    );
    ctx.stroke();
  }
  box(ctx, x - 40, y - 64, 80, 64, 10, '#b98b62', INK, 1.6);
  ctx.fillStyle = '#a57a54';
  ctx.fillRect(x - 36, y - 50, 72, 6);
}

function bench(ctx, x) {
  const y = 524;
  shadow(ctx, x, y + 2, 90);
  box(ctx, x - 80, y - 56, 160, 14, 5, '#b98b62', INK, 1.6);
  box(ctx, x - 80, y - 96, 160, 12, 5, '#b98b62', INK, 1.6);
  for (const dx of [-66, 56]) box(ctx, x + dx, y - 44, 10, 44, 2, '#6b5a4c', INK, 1.2);
  for (const dx of [-60, 50]) box(ctx, x + dx, y - 86, 8, 32, 2, '#6b5a4c', INK, 1);
}

function directory(ctx, x) {
  const y = 524;
  shadow(ctx, x, y + 2, 50);
  box(ctx, x - 8, y - 60, 16, 60, 3, '#8a7d70', INK, 1.4);
  box(ctx, x - 60, y - 250, 120, 190, 10, '#fffaf2', INK, 1.6);
  box(ctx, x - 60, y - 250, 120, 34, 10, '#5b8f7a', INK, 1.6);
  text(ctx, 'DIRECTORY', x, y - 232, { size: 13, color: '#fff' });
  const colors = ['#e6c9b8', '#c9d8e6', '#f0c9d4', '#d9d0ee', '#e8dcc0', '#c7e3e8'];
  colors.forEach((color, i) =>
    box(ctx, x - 48 + (i % 2) * 50, y - 204 + Math.floor(i / 2) * 44, 44, 36, 4, color),
  );
  ellipse(ctx, x - 20, y - 112, 6, 6, '#cf3a3d');
  text(ctx, 'YOU ARE HERE', x, y - 76, { size: 9, color: '#6f675f' });
}

function coffeeCart(ctx, sheets, counter) {
  const x = counter.x,
    y = 524;
  shadow(ctx, x, y + 2, 110);
  for (const dx of [-70, 70]) ellipse(ctx, x + dx, y - 12, 12, 12, '#3b3e44', INK, 1.4);
  box(ctx, x - 100, y - 120, 200, 100, 8, '#2f7d6b', INK, 1.6);
  box(ctx, x - 108, y - 130, 216, 14, 4, '#efe3d0', INK, 1.4);
  text(ctx, 'BAY COFFEE', x, y - 70, { size: 18, color: '#fffaf2' });
  ctx.strokeStyle = '#8e8e8e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x, y - 130);
  ctx.lineTo(x, y - 250);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(x, y - 270);
    ctx.lineTo(x - 130 + i * 43.3, y - 230);
    ctx.lineTo(x - 130 + (i + 1) * 43.3, y - 230);
    ctx.closePath();
    ctx.fillStyle = i % 2 ? '#fffaf2' : '#2f7d6b';
    ctx.fill();
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }
  for (let i = 0; i < 2; i++)
    drawItem(ctx, sheets.items, counter.icon, x - 30 + i * 60, y - 160, 54);
  box(ctx, x - 34, y - 226, 68, 26, 6, '#fffaf2', INK, 1.2);
  text(ctx, `$${counter.price}`, x, y - 213, { size: 15, color: '#2f5e52' });
}

/** Everything that stands behind the people, from left to right. */
export function drawFixtures(ctx, store, sheets, view, time = 0) {
  const visible = (x, w = 400) => x + w > view.x && x - w < view.x + view.width;
  entrance(ctx, store);
  exitDoors(ctx, store);
  if (store.theme === 'target') {
    for (const section of store.sections)
      if (visible(section.x)) drawSectionSign(ctx, section.x, section.name);
    coffeeBar(ctx, sheets, store.counters[0]);
    for (const spot of store.spots) {
      if (!visible(spot.x)) continue;
      const items = itemsFor(store, spot);
      if (spot.fixture === 'dollar') dollarSection(ctx, sheets, spot.x);
      else if (spot.fixture === 'table') table(ctx, sheets, spot.x + 70, items);
      else if (spot.fixture === 'endcap') endcap(ctx, sheets, spot.x + 80, items);
      else rack(ctx, sheets, spot.x + 80, items, time);
    }
    if (visible(store.exit.x, 500)) checkout(ctx, store, time);
  } else {
    for (const shop of store.storefronts) if (visible(shop.x)) storefront(ctx, sheets, shop);
    for (const x of [330, 1320, 1985, 2600, 3140]) if (visible(x)) planter(ctx, x + 20, time);
    if (visible(560)) bench(ctx, 560);
    if (visible(700)) directory(ctx, 700);
    if (visible(store.fountain)) fountain(ctx, store.fountain, time);
    const cart = store.counters.find((counter) => counter.id === 'coffee');
    if (visible(cart.x)) coffeeCart(ctx, sheets, cart);
  }
}

// ——— Pickups and people ———

export function drawCoupon(ctx, x, time = 0) {
  const y = 596,
    bob = Math.sin(time * 3 + x) * 4;
  ellipse(ctx, x, y + 4, 16, 4, '#0000001c');
  ctx.save();
  ctx.translate(x, y - 34 + bob);
  ctx.rotate(-0.15);
  const glow = ctx.createRadialGradient(0, 0, 4, 0, 0, 40);
  glow.addColorStop(0, '#ffe39a90');
  glow.addColorStop(1, '#ffe39a00');
  ctx.fillStyle = glow;
  ctx.fillRect(-40, -40, 80, 80);
  box(ctx, -24, -14, 48, 28, 4, '#ffd479', '#b98314', 1.6);
  ellipse(ctx, -24, 0, 5, 5, '#ebe7e1');
  ellipse(ctx, 24, 0, 5, 5, '#ebe7e1');
  text(ctx, '20%', 4, 1, { size: 13, color: '#8a5d0b' });
  ctx.restore();
}

/** The pacifier, arcing out of the stroller and then waiting on the floor. */
export function drawPacifier(ctx, sheets, pacifier, now, time = 0) {
  const t = Math.min(1, (now - pacifier.thrownAt) / 0.6);
  const x = pacifier.from + (pacifier.x - pacifier.from) * t;
  const y = 588 - Math.sin(t * Math.PI) * 150;
  if (t >= 1) {
    ellipse(ctx, x, 600, 18, 4, '#0000001c');
    const pulse = (time * 1.5) % 1;
    ellipse(
      ctx,
      x,
      598,
      20 + pulse * 26,
      5 + pulse * 6,
      null,
      `rgba(79, 141, 181, ${1 - pulse})`,
      2.5,
    );
  }
  ctx.save();
  ctx.translate(x, y - 16);
  ctx.rotate(t < 1 ? t * 9 : 0);
  drawItem(ctx, sheets.items, 'pacifier', 0, 0, 40);
  ctx.restore();
}

export function drawBags(ctx, aron, bags, time) {
  const w = (ARON.frame[0] * ARON_HEIGHT) / ARON.frame[1];
  const hx = aron.x + aron.facing * w * 0.22,
    hy = ARON_Y - ARON_HEIGHT * 0.55;
  for (let i = 0; i < Math.min(4, bags); i++) {
    const sway = Math.sin(time * 4 + i) * 0.06;
    ctx.save();
    ctx.translate(hx - aron.facing * (6 + i * 8), hy + 4);
    ctx.rotate(sway);
    ctx.strokeStyle = INK;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 5, 5, Math.PI, 0);
    ctx.stroke();
    box(ctx, -10, 6, 20, 26, 2, i % 2 ? '#fffaf2' : '#cf3a3d', INK, 1.4);
    ctx.restore();
  }
}

export function handleOf(aron) {
  const w = (ARON.frame[0] * ARON_HEIGHT) / ARON.frame[1];
  return { x: aron.x + aron.facing * w * 0.22, y: ARON_Y - ARON_HEIGHT * 0.55 };
}

export function drawAronFigure(ctx, sheets, aron, { bags = 0, time = 0 } = {}) {
  shadow(ctx, aron.x + aron.facing * 32, ARON_Y, 104);
  const moving = Math.abs(aron.vx) > 30;
  const frame = moving ? 1 + (Math.floor(aron.walked / 38) % 2) : 0;
  drawAron(ctx, sheets.aron, {
    x: aron.x,
    y: ARON_Y,
    frame,
    height: ARON_HEIGHT,
    facing: aron.facing,
  });
  drawBags(ctx, aron, bags, time);
  if (aron.carrying) {
    const bob = Math.sin(time * 6) * 2;
    drawItem(
      ctx,
      sheets.items,
      aron.carrying.icon,
      aron.x - aron.facing * 30,
      ARON_Y - 230 + bob,
      50,
    );
  }
}

export function drawRebeccaFigure(ctx, sheets, rebecca, { browsing = false } = {}) {
  shadow(ctx, rebecca.x, REBECCA_Y, 50);
  let pose,
    bob = 0;
  if (rebecca.mood === 'delighted') pose = POSES.delighted;
  else if (rebecca.mood === 'unimpressed') pose = POSES.unimpressed;
  else if (rebecca.holding?.kind === 'coffee') pose = POSES.coffee;
  else if (rebecca.moving && !rebecca.waiting) {
    pose = Math.floor(rebecca.walked / 34) % 2 ? POSES.walkB : POSES.walkA;
    bob = Math.abs(Math.sin((rebecca.walked / 34) * Math.PI)) * 3;
  } else if (browsing) pose = POSES.browse;
  else pose = POSES.delighted;
  const front = pose === POSES.delighted || pose === POSES.unimpressed || pose === POSES.coffee;
  drawRebecca(ctx, sheets.rebecca, {
    x: rebecca.x,
    y: REBECCA_Y,
    pose,
    height: REBECCA_HEIGHT,
    facing: front ? 1 : rebecca.facing,
    bob,
  });
  if (rebecca.holding && rebecca.holding.kind !== 'coffee')
    drawItem(ctx, sheets.items, rebecca.holding.icon, rebecca.x + 30, REBECCA_Y - 150, 44);
}

// ——— Bubbles, speech and effects ———

function bubble(ctx, x, y, w, h, fill, stroke) {
  ctx.save();
  ctx.shadowColor = '#3a1f2a30';
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 6;
  box(ctx, x - w / 2, y - h, w, h, 18, fill);
  ctx.restore();
  box(ctx, x - w / 2, y - h, w, h, 18, null, stroke, 2.5);
  ctx.beginPath();
  ctx.moveTo(x - 14, y - 2);
  ctx.lineTo(x - 2, y + 18);
  ctx.lineTo(x + 10, y - 2);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.stroke();
  ctx.fillStyle = fill;
  ctx.fillRect(x - 13, y - 5, 22, 5);
}

/** Rebecca's thought bubble: what caught her eye, how much she wants it, and the price. */
export function drawMoment(ctx, sheets, rebecca, moment, { now, price }) {
  const x = rebecca.x,
    y = REBECCA_Y - REBECCA_HEIGHT - 26;
  const looking = moment.kind === 'looking',
    outfit = moment.kind === 'outfit';
  const w = 262,
    h = 98;
  const fill = looking ? '#f4f1ee' : '#fffaf6',
    stroke = looking ? '#b9b3ab' : '#e9859a';
  bubble(ctx, x, y, w, h, fill, stroke);
  const cx = x - w / 2 + 48,
    cy = y - h / 2 - 2;
  ellipse(ctx, cx, cy, 33, 33, looking ? '#ebe6e0' : '#f6ece4');
  drawItem(ctx, sheets.items, moment.icon, cx, cy, 60);
  const left = x - w / 2 + 92;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = INK;
  ctx.font = `bold ${moment.name.length > 16 ? 15 : 17}px ${FONT}`;
  ctx.fillText(moment.name, left, y - h + 28, w - 106);
  if (outfit) {
    ctx.fillStyle = '#c24d6b';
    ctx.font = `italic 14px ${FONT}`;
    ctx.fillText('Say something nice', left, y - h + 55);
  } else {
    if (looking) {
      ctx.fillStyle = '#8b837a';
      ctx.font = `italic 17px ${FONT}`;
      ctx.fillText('hmm…', left, y - h + 55);
    } else {
      ctx.fillStyle = '#e0486f';
      ctx.font = `20px ${FONT}`;
      ctx.fillText('♥'.repeat(moment.hearts) + '♡'.repeat(3 - moment.hearts), left, y - h + 55);
    }
    ctx.textAlign = 'right';
    const discounted = price !== moment.price;
    ctx.fillStyle = discounted ? '#cf3a3d' : looking ? '#6f675f' : INK;
    ctx.font = `bold 22px ${FONT}`;
    ctx.fillText(`$${price}`, x + w / 2 - 16, y - h + 55);
    if (discounted) {
      const pw = ctx.measureText(`$${price}`).width;
      ctx.font = `14px ${FONT}`;
      ctx.fillStyle = '#9a9189';
      const right = x + w / 2 - 22 - pw,
        ww = ctx.measureText(`$${moment.price}`).width;
      ctx.fillText(`$${moment.price}`, right, y - h + 56);
      ctx.strokeStyle = '#9a9189';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(right - ww - 1, y - h + 56);
      ctx.lineTo(right + 1, y - h + 56);
      ctx.stroke();
    }
    if (moment.sale) {
      box(ctx, x + w / 2 - 62, y - h - 12, 54, 22, 11, '#cf3a3d');
      text(ctx, 'SALE', x + w / 2 - 35, y - h - 1, { size: 12, color: '#fff' });
    }
  }
  const remaining = Math.max(0, Math.min(1, (moment.expires - now) / moment.duration));
  box(ctx, left, y - 20, w - 106, 6, 3, '#0000001a');
  box(ctx, left, y - 20, (w - 106) * remaining, 6, 3, stroke);
}

export function drawCraving(ctx, sheets, rebecca, icon, time = 0) {
  const x = rebecca.x + 70,
    y = REBECCA_Y - REBECCA_HEIGHT - 30 - Math.sin(time * 3) * 3;
  ellipse(ctx, x - 40, y + 44, 5, 5, '#fffaf6', '#e9859a', 1.5);
  ellipse(ctx, x - 26, y + 30, 8, 8, '#fffaf6', '#e9859a', 1.5);
  ellipse(ctx, x, y, 36, 32, '#fffaf6', '#e9859a', 2.5);
  drawItem(ctx, sheets.items, icon, x, y, 50);
}

export function drawSpeech(ctx, x, y, message) {
  ctx.font = `bold 15px ${FONT}`;
  const w = Math.min(300, ctx.measureText(message).width + 30),
    h = 38;
  bubble(ctx, x, y, w, h, '#ffffff', '#3a2c2540');
  text(ctx, message, x, y - h / 2, { size: 15 });
}

export function drawPrompt(ctx, x, y, label) {
  ctx.font = 'bold 13px ui-monospace, monospace';
  const w = ctx.measureText(label).width + 26;
  box(ctx, x - w / 2, y - 15, w, 30, 15, '#3a1f2aee');
  text(ctx, label, x, y + 1, { size: 13, color: '#ffe3ea', font: 'ui-monospace, monospace' });
}

export function drawPopup(ctx, { x, y, text: value, color, life }) {
  ctx.globalAlpha = Math.max(0, Math.min(1, life * 1.4));
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#fff';
  const rise = (1 - life) * 46;
  ctx.strokeText(value, x, y - rise);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y - rise);
  ctx.globalAlpha = 1;
}

export function drawHeartBurst(ctx, x, y, t) {
  for (let i = 0; i < 8; i++) {
    const a = -Math.PI / 2 + (i - 3.5) * 0.32,
      d = 20 + t * 70;
    ctx.globalAlpha = Math.max(0, 1 - t);
    text(ctx, '♥', x + Math.cos(a) * d, y + Math.sin(a) * d, {
      size: 16 + (i % 3) * 6,
      color: i % 2 ? '#e0486f' : '#ff8fa6',
      weight: 'normal',
    });
  }
  ctx.globalAlpha = 1;
}

/** A bought item arcs from the display into the stroller. */
export function drawFlyingItem(ctx, sheets, { icon, from, to, t }) {
  const x = from.x + (to.x - from.x) * t,
    y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 120;
  drawItem(ctx, sheets.items, icon, x, y, 60 - t * 20);
}

/** Screen-space arrow at the viewport edge pointing to something off camera. */
export function drawPointer(ctx, sheets, { x, y, direction, icon, color, label }) {
  ctx.save();
  ctx.translate(x, y);
  ellipse(ctx, 0, 0, 30, 30, '#fffaf6f0', color, 3);
  ctx.beginPath();
  ctx.moveTo(direction * 42, 0);
  ctx.lineTo(direction * 30, -10);
  ctx.lineTo(direction * 30, 10);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.restore();
  if (icon) drawItem(ctx, sheets.items, icon, x, y, 40);
  else text(ctx, label, x, y + 1, { size: 20, color });
}
