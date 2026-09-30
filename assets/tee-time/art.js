/** Canvas 2D scenery, terrain and aiming guides for Tee Time. People, Maggie and
 * props are illustrated sprites (sprites.js). Backdrops take screen-space x
 * with parallax; everything else draws in world coordinates.
 */
import { groundAt, BALL_RADIUS } from './golf.js';
import { drawProp, propWidth } from './sprites.js';
import { FLOOR } from './holes.js';

const TAU = Math.PI * 2;
const INK = '#3a2c25';
const FONT = '"Trebuchet MS", sans-serif';
const noise = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
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
function ellipse(ctx, x, y, rx, ry, fill, stroke, lineWidth = 1.5) {
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
function text(
  ctx,
  value,
  x,
  y,
  { size = 14, color = INK, weight = 'bold', align = 'center' } = {},
) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillText(value, x, y);
}

// ——— Backdrops ———

export function drawBackdrop(ctx, hole, view, time = 0) {
  const outdoorFrom = hole.theme === 'course' ? -Infinity : (hole.door ?? Infinity);
  // Outdoor sky and scenery first; rooms paint over it up to their door.
  if (outdoorFrom < Infinity) outdoors(ctx, view, time, hole.theme === 'course');
  if (hole.theme !== 'course') {
    const doorX = Math.min(view.width, (hole.door ?? Infinity) - view.x);
    if (doorX > 0) room(ctx, hole.theme, view, doorX);
  }
}

function outdoors(ctx, view, time, course) {
  const sky = ctx.createLinearGradient(0, view.y, 0, FLOOR);
  sky.addColorStop(0, '#7cc4e4');
  sky.addColorStop(0.7, '#cfeaf2');
  sky.addColorStop(1, '#f6efdc');
  ctx.fillStyle = sky;
  ctx.fillRect(0, view.y, view.width, FLOOR - view.y + 200);
  const sunX = view.width * 0.8 - view.x * 0.02;
  ellipse(ctx, sunX, 90, 56, 56, '#fff3ba40');
  ellipse(ctx, sunX, 90, 34, 34, '#fff6c8');
  for (let i = -1; i < view.width / 320 + 2; i++) {
    const shift = view.x * 0.08 + time * 6;
    const x = i * 320 - (shift % 320) + noise(i + Math.floor(shift / 320)) * 90;
    const y = 70 + noise(i + 3 + Math.floor(shift / 320)) * 90;
    for (const [dx, dy, r] of [
      [0, 0, 26],
      [28, -10, 32],
      [60, 0, 24],
      [30, 8, 26],
    ])
      ellipse(ctx, x + dx, y + dy, r * 1.2, r * 0.8, '#ffffffe6');
  }
  if (course) {
    // Tampa across the bay: a skyline, the water, then a line of trees.
    const skyline = view.x * 0.12;
    ctx.fillStyle = '#9fbccb';
    for (let i = -1; i < view.width / 60 + 3; i++) {
      const n = i + Math.floor(skyline / 60);
      const h = 30 + noise(n) * 110 * (noise(n + 40) > 0.35 ? 1 : 0.3);
      const x = i * 60 - (skyline % 60);
      ctx.fillRect(x, FLOOR - 150 - h, 44, h);
      if (noise(n + 7) > 0.8) {
        ctx.beginPath();
        ctx.moveTo(x, FLOOR - 150 - h);
        ctx.lineTo(x + 22, FLOOR - 186 - h);
        ctx.lineTo(x + 44, FLOOR - 150 - h);
        ctx.fill();
      }
    }
    ctx.fillStyle = '#6fa8c4';
    ctx.fillRect(0, FLOOR - 150, view.width, 44);
    ctx.strokeStyle = '#ffffff70';
    ctx.lineWidth = 2;
    for (let i = 0; i < view.width / 90 + 2; i++) {
      const x = i * 90 - ((view.x * 0.2 + time * 10) % 90);
      ctx.beginPath();
      ctx.moveTo(x, FLOOR - 128 + Math.sin(time + i) * 2);
      ctx.lineTo(x + 30, FLOOR - 128 + Math.sin(time + i) * 2);
      ctx.stroke();
    }
    treeLine(ctx, view, FLOOR - 106, 0.35, '#5f9a63', 70);
    treeLine(ctx, view, FLOOR - 60, 0.55, '#4f8a55', 90);
  } else {
    // The backyard: a fence and the neighbors' palms.
    treeLine(ctx, view, FLOOR - 120, 0.4, '#6fa875', 80);
    const board = 24,
      scroll = view.x * 0.8;
    for (let i = Math.floor(scroll / board) - 1; i < scroll / board + view.width / board + 2; i++) {
      const x = i * board - scroll;
      box(
        ctx,
        x + 1,
        FLOOR - 150,
        board - 2,
        150,
        3,
        noise(i) > 0.5 ? '#dcbd90' : '#d6b586',
        '#b79468',
        1,
      );
    }
  }
}

function treeLine(ctx, view, base, parallax, color, size) {
  const spacing = size * 1.1,
    scroll = view.x * parallax;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, base + 60);
  for (
    let i = Math.floor(scroll / spacing) - 1;
    i < scroll / spacing + view.width / spacing + 2;
    i++
  ) {
    const x = i * spacing - scroll,
      h = size * (0.6 + noise(i * 3.1) * 0.6);
    ctx.ellipse(x, base, spacing * 0.7, h, 0, Math.PI, 0);
  }
  ctx.lineTo(view.width, base + 60);
  ctx.fill();
}

const ROOMS = {
  office: { wall: '#34503f', panel: '#2c4636', trim: '#8a6a4f' },
  living: { wall: '#efe4d3', panel: '#e3d4bf', trim: '#b89878' },
  kitchen: { wall: '#f4f1ec', panel: '#e7e1d8', trim: '#c7bcad' },
};

function room(ctx, theme, view, right) {
  const colors = ROOMS[theme];
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, view.y, right, view.height + 200);
  ctx.clip();
  // Ceiling above the crown molding.
  ctx.fillStyle = theme === 'office' ? '#2a3d31' : '#e8e1d6';
  ctx.fillRect(0, view.y, view.width, 150 - view.y);
  ctx.fillStyle = colors.wall;
  ctx.fillRect(0, 140, view.width, FLOOR - 140);
  ctx.fillStyle = colors.trim;
  ctx.fillRect(0, 136, view.width, 10);
  ctx.fillRect(0, FLOOR - 16, view.width, 16);
  const scroll = view.x * 0.9;
  if (theme === 'office') {
    // Paneled cabinetry, a window with blinds and framed certificates.
    for (let i = Math.floor(scroll / 180) - 1; i < scroll / 180 + view.width / 180 + 2; i++) {
      const x = i * 180 - scroll;
      box(ctx, x + 14, 190, 152, 110, 4, colors.panel, '#243a2d', 2);
      box(ctx, x + 14, 320, 152, 120, 4, colors.panel, '#243a2d', 2);
      if (((i % 3) + 3) % 3 === 1) {
        box(ctx, x + 40, 170, 100, 130, 4, '#dfeef4', '#6b5a48', 4);
        for (let y = 180; y < 296; y += 10) {
          ctx.fillStyle = '#f2ece2';
          ctx.fillRect(x + 44, y, 92, 6);
        }
      } else if (((i % 3) + 3) % 3 === 2) {
        box(ctx, x + 50, 200, 80, 60, 3, '#fbf6ea', '#8a6a4f', 5);
        ellipse(ctx, x + 90, 240, 8, 8, '#d9b85a');
      }
    }
  } else if (theme === 'living') {
    for (let i = Math.floor(scroll / 260) - 1; i < scroll / 260 + view.width / 260 + 2; i++) {
      const x = i * 260 - scroll;
      box(ctx, x + 20, FLOOR - 120, 220, 104, 2, null, colors.panel, 3);
      const kind = ((i % 3) + 3) % 3;
      if (kind === 0) {
        box(ctx, x + 50, 170, 160, 170, 6, '#dcefff', '#b89878', 6);
        ctx.fillStyle = '#e9c7a8';
        ctx.fillRect(x + 38, 160, 22, 200);
        ctx.fillRect(x + 200, 160, 22, 200);
      } else {
        for (let f = 0; f < 3; f++)
          box(ctx, x + 50 + f * 58, 200 + (f % 2) * 20, 44, 56, 3, '#fbf6ea', '#6b5a48', 4);
      }
    }
  } else {
    for (let i = Math.floor(scroll / 200) - 1; i < scroll / 200 + view.width / 200 + 2; i++) {
      const x = i * 200 - scroll;
      box(ctx, x + 10, 150, 180, 110, 3, '#ffffff', '#cfc6ba', 2);
      box(ctx, x + 92, 196, 16, 4, 2, '#9a9189');
      ctx.strokeStyle = '#e2ddd5';
      ctx.lineWidth = 1;
      for (let y = 290; y < 340; y += 16) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 200, y);
        ctx.stroke();
      }
      ctx.strokeStyle = '#8e8e8e';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x + 100, 146);
      ctx.lineTo(x + 100, 176);
      ctx.stroke();
      ellipse(ctx, x + 100, 184, 16, 10, '#2f3a40');
    }
  }
  ctx.restore();
}

// ——— Terrain (world space) ———

const SURFACE = {
  hardwood: { top: '#c48d5c', body: '#a8744a', line: '#8f6040' },
  carpet: { top: '#9c7aa0', body: '#a8744a', line: '#7f6284' },
  mat: { top: '#4f9a5c', body: '#a8744a', line: '#f6f2e6' },
  patio: { top: '#cfc7ba', body: '#b9b0a2', line: '#a39a8c' },
  fairway: { top: '#79b65a', body: '#8b6a47', line: '#6aa54d' },
  rough: { top: '#5f9748', body: '#8b6a47', line: '#4f853c' },
  green: { top: '#94d372', body: '#8b6a47', line: '#82c464' },
  sand: { top: '#ead59f', body: '#c9ae78', line: '#d8c08a' },
  mud: { top: '#6b5a3d', body: '#5b4c33', line: '#4e412c' },
};

export function drawTerrain(ctx, hole, view, time = 0) {
  const bottom = view.y + view.height + 20;
  const left = view.x - 20,
    right = view.x + view.width + 20;
  for (const [from, to, material, y0, y1] of hole.ground) {
    if (to < left || from > right) continue;
    const colors = SURFACE[material];
    ctx.fillStyle = colors.body;
    ctx.beginPath();
    ctx.moveTo(from, y0);
    ctx.lineTo(to, y1);
    ctx.lineTo(to, bottom);
    ctx.lineTo(from, bottom);
    ctx.closePath();
    ctx.fill();
    // The surface band follows the ground line.
    const band = material === 'mat' || material === 'carpet' ? 12 : 18;
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(from, y0);
    ctx.lineTo(to, y1);
    ctx.lineTo(to, y1 + band);
    ctx.lineTo(from, y0 + band);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = colors.line;
    ctx.lineWidth = 2;
    const startX = Math.max(from, left - ((left - from) % 60));
    for (let x = startX; x < Math.min(to, right); x += material === 'hardwood' ? 90 : 60) {
      const y = y0 + ((y1 - y0) * (x - from)) / (to - from);
      ctx.beginPath();
      if (material === 'fairway' || material === 'green') {
        ctx.fillStyle = (Math.round(x / 60) % 2 ? colors.line : colors.top) + '';
        ctx.fillRect(x, y + 2, 30, band - 4);
      } else if (material === 'hardwood' || material === 'patio') {
        ctx.moveTo(x, y + 2);
        ctx.lineTo(x, bottom);
        ctx.stroke();
      } else if (material === 'rough') {
        for (let t = 0; t < 3; t++) {
          const gx = x + t * 18 + noise(x + t) * 8;
          ctx.moveTo(gx, y + 1);
          ctx.lineTo(gx - 3, y - 7);
          ctx.moveTo(gx, y + 1);
          ctx.lineTo(gx + 3, y - 6);
        }
        ctx.stroke();
      } else if (material === 'sand') {
        for (let t = 0; t < 5; t++)
          ellipse(ctx, x + noise(x + t) * 60, y + 4 + noise(x - t) * 10, 1.4, 1.2, '#c9ae78');
      } else if (material === 'carpet') {
        ctx.moveTo(x, y + band);
        ctx.lineTo(x + 6, y + band + 6);
        ctx.stroke();
      }
    }
    if (material === 'mat') {
      ctx.strokeStyle = colors.line;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from + 4, y0 + 3);
      ctx.lineTo(to - 4, y1 + 3);
      ctx.stroke();
    }
  }
  for (const pond of hole.water || []) drawWater(ctx, pond, bottom, time);
}

function drawWater(ctx, pond, bottom, time) {
  const gradient = ctx.createLinearGradient(0, pond.level, 0, bottom);
  gradient.addColorStop(0, '#5aa9c9');
  gradient.addColorStop(1, '#2f6f8f');
  ctx.fillStyle = gradient;
  ctx.fillRect(pond.from, pond.level, pond.to - pond.from, bottom - pond.level);
  ctx.strokeStyle = '#d7f1fb';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  for (let x = pond.from; x <= pond.to; x += 10)
    ctx.lineTo(x, pond.level + Math.sin(time * 2.5 + x * 0.06) * 2);
  ctx.stroke();
}

export function drawProps(ctx, sheets, hole, view, { back }) {
  const visible = (x, w) => x + w / 2 > view.x - 40 && x - w / 2 < view.x + view.width + 40;
  for (const prop of hole.props || []) {
    if (Boolean(prop.back) !== back) continue;
    const width = propWidth(prop.name, prop.height);
    if (!visible(prop.x, width)) continue;
    const pond = prop.water && (hole.water || []).find((p) => prop.x >= p.from && prop.x <= p.to);
    const y = pond ? pond.level + prop.height * 0.55 : groundAt(hole, prop.x).y + 4;
    drawProp(ctx, sheets, prop.name, prop.x, y, prop.height);
  }
  if (!back)
    for (const solid of hole.solids || []) {
      const width = propWidth(solid.prop, solid.height);
      const x = solid.x + solid.w / 2;
      if (visible(x, width))
        drawProp(ctx, sheets, solid.prop, x, groundAt(hole, x).y + 4, solid.height);
    }
}

export function drawCup(ctx, sheets, hole) {
  const x = hole.cup,
    y = groundAt(hole, x).y;
  ellipse(ctx, x, y + 2, 9, 3, '#1f1a16');
  const indoor = hole.theme !== 'course' && !(hole.door && x > hole.door);
  drawProp(ctx, sheets, 'flag', x, y + 6, indoor ? 110 : 170);
}

export function drawBall(ctx, hole, ball, trail) {
  const ground = groundAt(hole, ball.x).y;
  const height = Math.max(0, ground - (ball.y + BALL_RADIUS));
  if (height > 2) ellipse(ctx, ball.x, ground + 1, Math.max(2, 7 - height / 60), 2, '#00000030');
  for (let i = 0; i < trail.length; i++) {
    const t = i / trail.length;
    ellipse(ctx, trail[i].x, trail[i].y, 2 + t * 2, 2 + t * 2, `rgba(255, 255, 255, ${t * 0.5})`);
  }
  ellipse(ctx, ball.x, ball.y, BALL_RADIUS, BALL_RADIUS, '#ffffff', '#6f675f', 1.3);
  ellipse(ctx, ball.x - 1.5, ball.y - 1.8, 2, 1.6, '#ffffff');
  ellipse(ctx, ball.x + 1.8, ball.y + 1.5, 1.4, 1.2, '#d9d4cc');
}

/** The aiming guide: dotted opening arc plus a power meter above the ball. */
export function drawAim(ctx, ball, aim, path, putting) {
  for (let i = 0; i < path.length; i++) {
    const fade = 1 - i / path.length;
    ellipse(
      ctx,
      path[i].x,
      path[i].y,
      3.5,
      3.5,
      `rgba(255, 255, 255, ${0.35 + fade * 0.55})`,
      `rgba(58, 44, 37, ${fade * 0.5})`,
      1,
    );
  }
  const length = 44 + aim.power * 60;
  const ex = ball.x + Math.cos(aim.angle) * length,
    ey = ball.y + Math.sin(aim.angle) * length;
  ctx.strokeStyle = '#ffffffd0';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(ball.x, ball.y);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  ctx.save();
  ctx.translate(ex, ey);
  ctx.rotate(aim.angle);
  ctx.beginPath();
  ctx.moveTo(10, 0);
  ctx.lineTo(-4, -8);
  ctx.lineTo(-4, 8);
  ctx.closePath();
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.restore();
  const w = 130,
    x = ball.x - w / 2,
    y = ball.y - (putting ? 70 : 96);
  box(ctx, x - 3, y - 3, w + 6, 16, 8, '#3a2c25cc');
  const fill = ctx.createLinearGradient(x, 0, x + w, 0);
  fill.addColorStop(0, '#9be07a');
  fill.addColorStop(0.6, '#ffd479');
  fill.addColorStop(1, '#ff7a6b');
  box(ctx, x, y, Math.max(0.1, w * aim.power), 10, 5, fill);
  text(ctx, putting ? 'PUTT' : 'POWER', x + w / 2, y - 12, { size: 11, color: '#fff' });
}

export function drawPopup(ctx, { x, y, text: value, color, life, size = 22 }) {
  ctx.globalAlpha = Math.max(0, Math.min(1, life * 1.4));
  ctx.font = `bold ${size}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.lineWidth = 5;
  ctx.strokeStyle = '#fff';
  const rise = (1 - life) * 40;
  ctx.strokeText(value, x, y - rise);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y - rise);
  ctx.globalAlpha = 1;
}

/** Screen-space arrow at the viewport edge pointing to the pin, with distance. */
export function drawPinPointer(ctx, sheets, { x, y, direction, label }) {
  ctx.save();
  ctx.translate(x, y);
  box(ctx, -40, -30, 80, 60, 14, '#fffaf6f0', '#cf3a3d', 2.5);
  ctx.beginPath();
  ctx.moveTo(direction * 54, 0);
  ctx.lineTo(direction * 42, -10);
  ctx.lineTo(direction * 42, 10);
  ctx.closePath();
  ctx.fillStyle = '#cf3a3d';
  ctx.fill();
  ctx.restore();
  drawProp(ctx, sheets, 'flag', x - 18, y + 18, 42);
  text(ctx, label, x + 10, y, { size: 13 });
}
