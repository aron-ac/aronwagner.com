/** Original Canvas 2D art for Maggie's Toy Run. No image assets or DOM required.
 * time values are elapsed seconds. Background is screen-space; other exports
 * draw in world coordinates after the caller applies the camera translation.
 */

const TAU = Math.PI * 2;
const fract = (n) => n - Math.floor(n);
const noise = (n) => fract(Math.sin(n * 127.1 + 311.7) * 43758.5453);

function ellipse(ctx, x, y, rx, ry, color, stroke, lineWidth = 1.5, rotation = 0) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, rotation, 0, TAU);
  if (color) {
    ctx.fillStyle = color;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function rounded(ctx, x, y, w, h, r = 6) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function path(ctx, points, fill, stroke, width = 1.5) {
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = width;
    ctx.stroke();
  }
}

function paw(ctx, x, y, size, color) {
  ellipse(ctx, x, y + size * 0.12, size * 0.3, size * 0.25, color);
  for (const [dx, dy, rotation] of [
    [-0.31, -0.2, -0.35],
    [-0.1, -0.38, -0.1],
    [0.14, -0.36, 0.1],
    [0.34, -0.15, 0.35],
  ]) {
    ellipse(ctx, x + dx * size, y + dy * size, size * 0.12, size * 0.155, color, null, 0, rotation);
  }
}

function star(ctx, x, y, radius, color, rotation = 0) {
  const points = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5 + rotation,
      r = i % 2 ? radius * 0.43 : radius;
    points.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  path(ctx, points, color);
}

function cloud(ctx, x, y, scale) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ellipse(ctx, 0, 14, 49, 10, '#b9dde1');
  ctx.fillStyle = '#fffdf4';
  ctx.beginPath();
  ctx.moveTo(-49, 13);
  ctx.bezierCurveTo(-58, -7, -33, -18, -21, -11);
  ctx.bezierCurveTo(-17, -39, 17, -37, 23, -16);
  ctx.bezierCurveTo(40, -26, 58, -7, 48, 7);
  ctx.bezierCurveTo(60, 14, 46, 25, 32, 21);
  ctx.lineTo(-33, 22);
  ctx.quadraticCurveTo(-50, 22, -49, 13);
  ctx.fill();
  ctx.restore();
}

function tree(ctx, x, y, scale, palette = ['#709b76', '#8bb282', '#acd196']) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = '#789780';
  rounded(ctx, -5, -58, 10, 61, 3);
  ctx.fill();
  ctx.strokeStyle = '#789780';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-1, -36);
  ctx.lineTo(-18, -54);
  ctx.moveTo(1, -23);
  ctx.lineTo(20, -49);
  ctx.stroke();
  ellipse(ctx, -19, -67, 25, 26, palette[0]);
  ellipse(ctx, 18, -66, 27, 29, palette[0]);
  ellipse(ctx, -1, -91, 30, 30, palette[1]);
  ellipse(ctx, -11, -99, 16, 14, palette[2]);
  ellipse(ctx, 26, -73, 10, 12, palette[1]);
  ctx.restore();
}

// Overlapping circles with a shared outline read as curly fur or soap foam.
function fluff(ctx, blobs, fill, stroke, lineWidth = 1.3) {
  ctx.fillStyle = stroke;
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r + lineWidth, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = fill;
  for (const [x, y, r] of blobs) {
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
}

function palm(ctx, x, y, scale, color = '#86b48a') {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#a69674';
  ctx.lineWidth = 7;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.quadraticCurveTo(12, -62, 5, -124);
  ctx.stroke();
  ctx.strokeStyle = color;
  ctx.lineWidth = 8;
  for (const angle of [-2.95, -2.45, -1.95, -1.2, -0.7, -0.2]) {
    const length = 50 + noise(angle) * 12;
    ctx.beginPath();
    ctx.moveTo(5, -124);
    ctx.quadraticCurveTo(
      5 + Math.cos(angle) * length * 0.55,
      -124 + Math.sin(angle) * length * 0.55 - 14,
      5 + Math.cos(angle) * length,
      -124 + Math.sin(angle) * length * 0.35 + 24,
    );
    ctx.stroke();
  }
  ellipse(ctx, 5, -123, 6, 5, '#9b8b62');
  ctx.restore();
}

export function drawBackground(ctx, { cameraX = 0, width = 900, height = 500, time = 0 } = {}) {
  ctx.save();
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#89d5df');
  sky.addColorStop(0.63, '#d3efdc');
  sky.addColorStop(1, '#fff1ca');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  // A warm Florida afternoon sun with a restrained soft halo.
  const sunX = width * 0.81 - Math.min(35, cameraX * 0.012),
    sunY = 77;
  ellipse(ctx, sunX, sunY, 58, 58, '#fff3ba30');
  ellipse(ctx, sunX, sunY, 43, 43, '#fff4c54a');
  ellipse(ctx, sunX, sunY, 28, 28, '#fff7cc');
  const cloudSpacing = 300;
  const firstCloud = Math.floor((cameraX * 0.13) / cloudSpacing) - 1;
  for (let i = firstCloud; i < firstCloud + Math.ceil(width / cloudSpacing) + 3; i++) {
    cloud(
      ctx,
      i * cloudSpacing - cameraX * 0.13 + 110 + Math.sin(time * 0.035 + i) * 7,
      79 + noise(i + 9) * 78,
      0.65 + noise(i + 2) * 0.45,
    );
  }
  // A distant, bumpy treeline behind the neighborhood.
  const canopy = 120,
    firstCanopy = Math.floor((cameraX * 0.15) / canopy) - 1;
  ctx.fillStyle = '#a6ceb0';
  ctx.beginPath();
  ctx.moveTo(-canopy, height);
  for (let i = firstCanopy; i < firstCanopy + Math.ceil(width / canopy) + 4; i++) {
    const x = i * canopy - cameraX * 0.15,
      top = height * 0.66 - noise(i + 31) * 38;
    if (i === firstCanopy) ctx.lineTo(x, top + 20);
    ctx.bezierCurveTo(x + canopy * 0.2, top - 16, x + canopy * 0.8, top - 16, x + canopy, top + 20);
  }
  ctx.lineTo(width + canopy, height);
  ctx.closePath();
  ctx.fill();
  // Neighborhood palms and oaks peek over the privacy fence.
  const firstPalm = Math.floor((cameraX * 0.24) / 290) - 1;
  for (let i = firstPalm; i < firstPalm + Math.ceil(width / 290) + 3; i++) {
    palm(
      ctx,
      i * 290 - cameraX * 0.24 + noise(i + 40) * 120,
      height * 0.8,
      0.8 + noise(i + 12) * 0.35,
    );
  }
  const firstTree = Math.floor((cameraX * 0.34) / 230) - 1;
  for (let i = firstTree; i < firstTree + Math.ceil(width / 230) + 3; i++) {
    tree(
      ctx,
      i * 230 - cameraX * 0.34 + noise(i) * 67,
      height * 0.8 + noise(i + 4) * 15,
      0.62 + noise(i + 18) * 0.3,
    );
  }
  // A tall wooden privacy fence with dog-eared boards and a post every eighth board.
  const board = 22,
    fenceTop = height * 0.72,
    fenceBottom = height * 0.9,
    firstBoard = Math.floor((cameraX * 0.42) / board) - 1;
  ctx.fillStyle = '#c9a77a';
  ctx.fillRect(0, fenceTop + 6, width, fenceBottom - fenceTop);
  for (let i = firstBoard; i < firstBoard + width / board + 3; i++) {
    const x = i * board - cameraX * 0.42,
      post = ((i % 8) + 8) % 8 === 0;
    path(
      ctx,
      [
        [x + 1, fenceBottom],
        [x + 1, fenceTop + 5],
        [x + 5, fenceTop],
        [x + board - 5, fenceTop],
        [x + board - 1, fenceTop + 5],
        [x + board - 1, fenceBottom],
      ],
      post ? '#caa574' : noise(i) > 0.5 ? '#dcbd90' : '#d6b586',
      '#b79468',
      1,
    );
    if (noise(i + 70) > 0.8)
      ellipse(ctx, x + 11, fenceTop + 30 + noise(i) * 20, 1.6, 2.4, '#b89366');
  }
  ctx.fillStyle = '#9dc983';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.87);
  ctx.bezierCurveTo(width * 0.3, height * 0.85, width * 0.66, height * 0.9, width, height * 0.86);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();
  // Two tiny birds; loops remain decorative and never resemble obstacles.
  ctx.strokeStyle = '#659e9f';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  for (let i = 0; i < 2; i++) {
    const x = width * (0.34 + 0.065 * i) - ((cameraX * 0.06) % (width + 90));
    const y = 100 + i * 20 + Math.sin(time * 1.9 + i) * 2;
    ctx.beginPath();
    ctx.moveTo(x - 7, y);
    ctx.quadraticCurveTo(x - 3, y - 3, x, y + 1);
    ctx.quadraticCurveTo(x + 4, y - 3, x + 8, y);
    ctx.stroke();
  }
  ctx.restore();
}

function flower(ctx, x, y, color, scale = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.strokeStyle = '#52835b';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(0, -10);
  ctx.stroke();
  ellipse(ctx, -3, -4, 3.5, 1.6, '#609e66', null, 0, -0.5);
  for (let i = 0; i < 5; i++)
    ellipse(ctx, Math.cos((i * TAU) / 5) * 3, -11 + Math.sin((i * TAU) / 5) * 3, 2.2, 2.2, color);
  ellipse(ctx, 0, -11, 1.8, 1.8, '#f5c96a');
  ctx.restore();
}

export function drawPlatform(ctx, platform) {
  const { x, y, w, h, kind = 'ground' } = platform;
  ctx.save();
  ctx.lineJoin = 'round';
  if (kind !== 'ground') {
    // Raised routes are weathered backyard planks: benches, deck boards and a potting shelf.
    rounded(ctx, x, y + 2, w, h, 4);
    ctx.fillStyle = '#b97f4c';
    ctx.fill();
    ctx.strokeStyle = '#7d5234';
    ctx.lineWidth = 2;
    ctx.stroke();
    rounded(ctx, x + 1, y, w - 2, 9, 4);
    ctx.fillStyle = '#d9a26a';
    ctx.fill();
    ctx.strokeStyle = '#9a6a43';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 13);
    ctx.lineTo(x + w - 4, y + 13);
    ctx.stroke();
    for (let px = x + 30 + noise(x) * 20; px < x + w - 12; px += 44) {
      ctx.beginPath();
      ctx.moveTo(px, y + 1);
      ctx.lineTo(px, y + h);
      ctx.stroke();
    }
    ellipse(ctx, x + 6, y + 5, 1.2, 1.2, '#7d5234');
    ellipse(ctx, x + w - 6, y + 5, 1.2, 1.2, '#7d5234');
    ctx.restore();
    return;
  }
  const depth = Math.max(16, h);
  rounded(ctx, x, y + 3, w, depth - 3, 2);
  ctx.fillStyle = '#be8e61';
  ctx.fill();
  ctx.strokeStyle = '#906749';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = '#a97954';
  ctx.fillRect(x, y + depth - 10, w, 10);
  if (depth > 35) {
    ctx.strokeStyle = '#ad7c56';
    ctx.lineWidth = 3;
    for (let yy = y + 31; yy < y + depth; yy += 31) {
      ctx.beginPath();
      ctx.moveTo(x, yy);
      for (let xx = 0; xx <= w + 30; xx += 30)
        ctx.lineTo(x + xx, yy + Math.sin(xx * 0.055 + yy) * 3);
      ctx.stroke();
    }
  }
  for (let i = 0; i < Math.ceil(w / 34); i++) {
    const px = x + 13 + i * 34,
      py = y + 21 + noise(x + i * 7) * Math.max(4, depth - 30);
    ellipse(ctx, px, py, 2 + noise(i + x) * 3, 1.5, '#e0b383', null, 0, -0.2);
  }
  ctx.restore();
  // Dark underside of the lawn, then a bright scalloped grassy lip.
  rounded(ctx, x - 1, y, w + 2, 15, 5);
  ctx.fillStyle = '#4d8655';
  ctx.fill();
  rounded(ctx, x - 1, y - 1, w + 2, 10, 5);
  ctx.fillStyle = '#79b667';
  ctx.fill();
  ctx.strokeStyle = '#acd879';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x + 5, y + 1);
  ctx.lineTo(x + w - 5, y + 1);
  ctx.stroke();
  for (let i = 0; i < w / 24; i++) {
    const gx = x + 10 + i * 24;
    path(
      ctx,
      [
        [gx - 3, y + 8],
        [gx, y + 15 + noise(i + x) * 2],
        [gx + 4, y + 8],
      ],
      '#6aa960',
    );
    if (noise(x + i * 11) > 0.65 && gx < x + w - 8) {
      ctx.strokeStyle = '#5d9957';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.moveTo(gx, y);
      ctx.lineTo(gx - 3, y - 5);
      ctx.moveTo(gx, y);
      ctx.lineTo(gx + 2, y - 7);
      ctx.stroke();
    }
  }
  for (let i = 0; i < w / 125; i++) {
    const fx = x + 52 + i * 125;
    if (fx < x + w - 18)
      flower(ctx, fx, y, ['#fff2cb', '#f4df72', '#e2d1ec'][i % 3], 0.65 + noise(x + i) * 0.3);
  }
  ctx.restore();
}

/** A sudsy wading pool filling a pit; the surrounding ground covers its edges. */
export function drawPool(ctx, { x, w }, time = 0) {
  ctx.save();
  const water = ctx.createLinearGradient(0, 446, 0, 600);
  water.addColorStop(0, '#9ddcec');
  water.addColorStop(1, '#4f9fc0');
  ctx.fillStyle = water;
  ctx.beginPath();
  ctx.moveTo(x - 4, 600);
  ctx.lineTo(x - 4, 452);
  for (let xx = 0; xx <= w + 8; xx += 8)
    ctx.lineTo(x - 4 + xx, 452 + Math.sin(time * 3 + (x + xx) * 0.09) * 2);
  ctx.lineTo(x + w + 4, 600);
  ctx.closePath();
  ctx.fill();
  const foam = [];
  for (let i = 0; i < w / 11; i++)
    foam.push([x + 4 + i * 11, 452 + Math.sin(time * 2 + i) * 1.5, 4 + noise(x + i) * 3]);
  fluff(ctx, foam, '#fbfdff', '#8cc2d6', 1);
  for (let i = 0; i < 3; i++) {
    const rise = fract(time * 0.35 + i * 0.37 + noise(x) * 0.5);
    ctx.globalAlpha = 1 - rise;
    ellipse(
      ctx,
      x + w * (0.25 + i * 0.25),
      446 - rise * 38,
      3 + i,
      3 + i,
      '#e8f7fd80',
      '#7fb7cc',
      1,
    );
  }
  ctx.restore();
}

export function drawBall(ctx, x, y, time = 0) {
  ctx.save();
  const bob = Math.sin(time * 3.8 + x * 0.028) * 3;
  ellipse(ctx, x, y + 15, 9, 2, '#586d3930');
  ctx.translate(x, y + bob);
  ctx.rotate(Math.sin(time * 2 + x) * 0.35);
  ellipse(ctx, 0, 0, 9.5, 9.5, '#d5e94a', '#87972a', 1.6);
  ctx.strokeStyle = '#fbfbe6';
  ctx.lineWidth = 1.9;
  ctx.beginPath();
  ctx.arc(-10.5, 0, 7.4, -1, 1);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(10.5, 0, 7.4, Math.PI - 1, Math.PI + 1);
  ctx.stroke();
  ellipse(ctx, -3, -4.5, 2.8, 1.8, '#f3fbb8', null, 0, -0.5);
  if (Math.sin(time * 2.2 + x * 0.1) > 0.45) star(ctx, 14, -11, 3, '#fff4c6', time);
  ctx.restore();
}

const FUR = '#c98652',
  FUR_LIGHT = '#e3ad78',
  FUR_DARK = '#a2643a',
  FUR_INK = '#5f3b25';

export function drawMaggie(ctx, player, time = 0) {
  const {
    x,
    y,
    w = 46,
    h = 48,
    vx = 0,
    facing = 1,
    onGround = true,
    invulnerable = false,
  } = player;
  const running = Math.min(1, Math.abs(vx) / 80);
  const stride = Math.sin(time * 19) * running;
  const airborne = !onGround;
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.scale(((facing < 0 ? -1 : 1) * w) / 46, h / 48);
  ctx.translate(-23, 0);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  if (invulnerable && Math.floor(time * 18) % 2 === 0) ctx.globalAlpha = 0.45;
  // A happy, wagging plume of a Goldendoodle tail.
  ctx.save();
  ctx.translate(6, 27);
  ctx.rotate(Math.sin(time * 12) * 0.16 + (airborne ? -0.2 : 0));
  fluff(
    ctx,
    [
      [-1, -3, 4.2],
      [-4, -8, 4.2],
      [-4, -14, 3.8],
      [-1, -19, 3.2],
    ],
    FUR,
    FUR_INK,
  );
  ctx.restore();
  const legs = (pairs, fill) => {
    for (const [px, phase] of pairs) {
      const swing = airborne ? phase * 2.5 : stride * phase * 3.2;
      const foot = airborne ? 44 : 46.5;
      ctx.save();
      ctx.translate(px, 34);
      ctx.rotate(swing * 0.07);
      rounded(ctx, -3.6, 0, 7.2, foot - 34, 3.4);
      ctx.fillStyle = fill;
      ctx.fill();
      ctx.strokeStyle = FUR_INK;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ellipse(ctx, 0.8, foot - 34, 4.6, 2.4, fill, FUR_INK, 1.1);
      ctx.restore();
    }
  };
  // Far legs sit behind the body; near legs step in opposite pairs.
  legs(
    [
      [10, 1],
      [30, -1],
    ],
    FUR_DARK,
  );
  fluff(
    ctx,
    [
      [8, 29, 6.5],
      [14, 26.5, 7],
      [21, 26.5, 7],
      [28, 27.5, 7],
      [33, 29.5, 6.5],
      [11, 34, 6],
      [19, 35, 6.2],
      [27, 34.5, 6.2],
    ],
    FUR,
    FUR_INK,
  );
  // Curl texture.
  ctx.strokeStyle = FUR_DARK;
  ctx.lineWidth = 1;
  for (const [cx, cy] of [
    [12, 28],
    [19, 31],
    [26, 28],
    [15, 35],
    [24, 36],
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0.4, 3.9);
    ctx.stroke();
  }
  legs(
    [
      [14, -1],
      [34, 1],
    ],
    FUR,
  );
  // The head bobs gently with each stride.
  ctx.save();
  ctx.translate(0, airborne ? -0.8 : Math.abs(stride) * 0.8);
  fluff(
    ctx,
    [
      [31, 22, 6],
      [34, 15, 9.2],
      [29, 8, 4.6],
      [34, 5.5, 5],
      [39.5, 8, 4.5],
      [42, 13.5, 4],
      [40, 20.5, 5.4],
    ],
    FUR,
    FUR_INK,
  );
  ellipse(ctx, 42.5, 21, 5.6, 4.6, FUR_LIGHT);
  ctx.strokeStyle = FUR_DARK;
  ctx.lineWidth = 1;
  for (const [cx, cy] of [
    [31, 6],
    [36, 5],
    [40, 9],
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, 1.8, 0.4, 3.9);
    ctx.stroke();
  }
  // A long, floppy ear that swings a little when she runs.
  ctx.save();
  ctx.translate(29.5, 12);
  ctx.rotate(0.12 + stride * 0.12 + (airborne ? -0.35 : 0));
  fluff(
    ctx,
    [
      [0, 2, 4.4],
      [-1, 8, 4.6],
      [0, 14, 4],
    ],
    FUR_DARK,
    FUR_INK,
    1.1,
  );
  ctx.restore();
  const blink = Math.sin(time * 0.9) > 0.996;
  if (blink) {
    ctx.strokeStyle = '#2a1d16';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(35, 14.5);
    ctx.lineTo(39.5, 14.5);
    ctx.stroke();
  } else {
    ellipse(ctx, 37.3, 14.2, 2.4, 2.8, '#2a1d16');
    ellipse(ctx, 36.5, 13.2, 0.9, 1, '#fff');
  }
  ellipse(ctx, 46.2, 18.8, 2.9, 2.3, '#2b1e18');
  ellipse(ctx, 45.4, 18, 0.9, 0.6, '#6b5a50');
  ctx.strokeStyle = '#4a2e1e';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(46, 21);
  ctx.quadraticCurveTo(44, 24.5, 40, 23.6);
  ctx.stroke();
  if (running > 0.3 || airborne) {
    ctx.beginPath();
    ctx.moveTo(41, 23.8);
    ctx.bezierCurveTo(41, 29, 45.5, 29.5, 45, 24);
    ctx.fillStyle = '#ef8f95';
    ctx.fill();
    ctx.strokeStyle = '#bd5f73';
    ctx.lineWidth = 0.7;
    ctx.stroke();
  }
  ctx.restore();
  ctx.restore();
}

export function drawBubble(ctx, bubble, time = 0) {
  const { x, y, w = 44, h = 34, vx = 0, popped = false } = bubble;
  const facing = vx < 0 ? -1 : 1,
    wobble = Math.sin(time * 6 + x * 0.05);
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.scale((facing * w) / 44, h / 34);
  ctx.translate(-22, 0);
  ctx.lineCap = 'round';
  if (popped) {
    // A flat puddle of foam while a few little bubbles escape.
    fluff(
      ctx,
      [
        [8, 31, 4.5],
        [16, 30, 5.5],
        [25, 30, 5.5],
        [34, 31, 4.5],
      ],
      '#fbfdff',
      '#7fb2c6',
      1.3,
    );
    for (let i = 0; i < 3; i++) {
      const rise = fract(time * 0.9 + i * 0.33);
      ctx.globalAlpha = 1 - rise;
      ellipse(ctx, 10 + i * 12, 24 - rise * 24, 2.5, 2.5, '#e8f7fd', '#6fa7bf', 1);
    }
    ctx.restore();
    return;
  }
  // Grumpy bath-time suds: a foam base and one big wobbling soap bubble.
  fluff(
    ctx,
    [
      [7, 29, 5.5],
      [15, 30, 6],
      [24, 30, 6],
      [33, 29, 5.5],
      [39, 31, 4],
    ],
    '#fbfdff',
    '#7fb2c6',
    1.4,
  );
  const r = 13 + wobble * 0.7;
  ellipse(ctx, 23, 16, r, r * 0.94, '#d6f0fbd9', '#6fa7bf', 1.6);
  ctx.lineWidth = 1.6;
  ctx.strokeStyle = '#f2c4e2';
  ctx.beginPath();
  ctx.arc(23, 16, r - 3, 0.2, 1.1);
  ctx.stroke();
  ctx.strokeStyle = '#bfe7c9';
  ctx.beginPath();
  ctx.arc(23, 16, r - 3, 1.2, 1.8);
  ctx.stroke();
  ellipse(ctx, 17.5, 9.5, 4, 2.4, '#ffffffe6', null, 0, -0.6);
  ellipse(ctx, 37.5, 11, 4.3, 4.3, '#e3f5fcd9', '#6fa7bf', 1.2);
  ellipse(ctx, 7.5, 15, 3, 3, '#e3f5fcd9', '#6fa7bf', 1.1);
  ellipse(ctx, 26, 17, 2.1, 2.6, '#27414d');
  ellipse(ctx, 32, 17, 2.1, 2.6, '#27414d');
  ellipse(ctx, 25.4, 16.1, 0.7, 0.8, '#fff');
  ellipse(ctx, 31.4, 16.1, 0.7, 0.8, '#fff');
  ctx.strokeStyle = '#27414d';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(23.5, 12.2);
  ctx.lineTo(27.8, 13.8);
  ctx.moveTo(34.5, 12.2);
  ctx.lineTo(30.2, 13.8);
  ctx.moveTo(26.5, 23);
  ctx.quadraticCurveTo(29, 21.2, 31.5, 23);
  ctx.stroke();
  ctx.restore();
}

export function drawCheckpoint(ctx, { x, y, active = false }, time = 0) {
  ctx.save();
  ctx.lineCap = 'round';
  ellipse(ctx, x, y + 1, 13, 3.3, '#35595125');
  ctx.strokeStyle = '#887254';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 83);
  ctx.stroke();
  ctx.strokeStyle = '#d7bd87';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x - 1, y - 3);
  ctx.lineTo(x - 1, y - 80);
  ctx.stroke();
  const flap = Math.sin(time * 4.4 + x) * 3;
  ctx.beginPath();
  ctx.moveTo(x + 2, y - 78);
  ctx.quadraticCurveTo(x + 19, y - 84 + flap, x + 37, y - 74);
  ctx.lineTo(x + 31, y - 63);
  ctx.lineTo(x + 38, y - 50);
  ctx.quadraticCurveTo(x + 19, y - 60 + flap, x + 2, y - 52);
  ctx.closePath();
  ctx.fillStyle = active ? '#e4b255' : '#53a9a1';
  ctx.fill();
  ctx.strokeStyle = active ? '#ae813b' : '#377d78';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  paw(ctx, x + 19, y - 66, 15, '#fff5d4');
  ellipse(ctx, x, y - 86, 4.4, 4.4, active ? '#ffe3a0' : '#f3dbc1', '#8d754c', 1.3);
  if (active)
    for (let i = 0; i < 2; i++)
      star(ctx, x - 12 + i * 52, y - 73 - Math.sin(time * 3 + i) * 5, 3.3, '#fbe4a2', time);
  // The water break: a steel dog bowl at the foot of the flag.
  path(
    ctx,
    [
      [x - 31, y - 7],
      [x - 7, y - 7],
      [x - 10, y],
      [x - 28, y],
    ],
    '#b9c4cb',
    '#6f7d86',
    1.3,
  );
  ellipse(ctx, x - 19, y - 7, 12, 3.2, '#d7dfe4', '#6f7d86', 1.2);
  ellipse(ctx, x - 19, y - 7, 9, 2, '#8fd3e6');
  flower(ctx, x + 10, y, '#f4df72', 0.7);
  ctx.restore();
}

const SKIN = '#dca47f',
  INK = '#3a2c25';

function limb(ctx, points, color, width) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [stroke, lineWidth] of [
    [INK, width + 2.4],
    [color, width],
  ]) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    ctx.moveTo(points[0][0], points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
    ctx.stroke();
  }
}

function face(ctx, cx, cy) {
  ellipse(ctx, cx - 3.8, cy, 1.3, 1.6, '#2a1f19');
  ellipse(ctx, cx + 3.8, cy, 1.3, 1.6, '#2a1f19');
  ctx.strokeStyle = '#8b4e3c';
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.arc(cx, cy + 3, 4, 0.25 * Math.PI, 0.75 * Math.PI);
  ctx.stroke();
  ellipse(ctx, cx - 6, cy + 3.5, 2, 1.2, '#e9998a70');
  ellipse(ctx, cx + 6, cy + 3.5, 2, 1.2, '#e9998a70');
}

/** Aron and Rebecca waiting on the patio, with string lights overhead. */
export function drawFinish(ctx, { x, y, w = 100, h = 140 }, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 100, h / 140);
  ctx.lineJoin = 'round';
  // Patio pavers.
  for (let i = 0; i < 6; i++) {
    rounded(ctx, -22 + i * 25, 134, 23, 7, 2);
    ctx.fillStyle = i % 2 ? '#d9d2c3' : '#e3ddcf';
    ctx.fill();
    ctx.strokeStyle = '#aaa190';
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  // String lights between two posts.
  ctx.strokeStyle = '#6b5a48';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, 134);
  ctx.lineTo(-18, -4);
  ctx.moveTo(118, 134);
  ctx.lineTo(118, -4);
  ctx.stroke();
  ctx.strokeStyle = '#4e4a44';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-18, -2);
  ctx.quadraticCurveTo(50, 22, 118, -2);
  ctx.stroke();
  for (let i = 1; i < 8; i++) {
    const t = i / 8,
      bx = -18 + t * 136,
      by = (1 - t) * (1 - t) * -2 + 2 * (1 - t) * t * 22 + t * t * -2 + 4;
    const glow = 0.6 + 0.4 * Math.sin(time * 2.5 + i * 1.7);
    ellipse(ctx, bx, by, 6, 6, `rgba(255, 226, 150, ${0.25 * glow})`);
    ellipse(ctx, bx, by, 2.6, 3.4, '#ffe39a', '#b68c45', 0.8);
  }

  // Rebecca: long brown hair, black tank top, cream wide-leg pants, coffee in hand.
  const rx = 28;
  rounded(ctx, rx - 12, 24, 24, 40, 10);
  ctx.fillStyle = '#7b4a2d';
  ctx.fill();
  path(
    ctx,
    [
      [rx - 11, 84],
      [rx + 11, 84],
      [rx + 14, 133],
      [rx + 2, 133],
      [rx, 98],
      [rx - 2, 133],
      [rx - 14, 133],
    ],
    '#efe6d4',
    INK,
    1.3,
  );
  ellipse(ctx, rx - 8, 135, 6, 2.6, '#9a6440', INK, 1);
  ellipse(ctx, rx + 8, 135, 6, 2.6, '#9a6440', INK, 1);
  rounded(ctx, rx - 3.5, 40, 7, 9, 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  rounded(ctx, rx - 11, 47, 22, 39, 6);
  ctx.fillStyle = '#27292d';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  limb(
    ctx,
    [
      [rx - 11, 52],
      [rx - 13, 70],
      [rx - 3, 66],
    ],
    SKIN,
    5,
  );
  limb(
    ctx,
    [
      [rx + 11, 52],
      [rx + 12, 70],
      [rx + 4, 67],
    ],
    SKIN,
    5,
  );
  rounded(ctx, rx - 5, 58, 10, 11, 2);
  ctx.fillStyle = '#fbfbf7';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.strokeStyle = '#c8c3b8';
  ctx.lineWidth = 1.4;
  for (let i = 0; i < 2; i++) {
    const drift = Math.sin(time * 2 + i * 2) * 1.5;
    ctx.beginPath();
    ctx.moveTo(rx - 2 + i * 4, 55);
    ctx.quadraticCurveTo(rx - 4 + i * 4 + drift, 50, rx - 1 + i * 4, 45);
    ctx.stroke();
  }
  ellipse(ctx, rx, 34, 9.5, 11, SKIN, INK, 1.3);
  ellipse(ctx, rx, 25.5, 10.5, 6.5, '#7b4a2d');
  rounded(ctx, rx - 11.5, 26, 5, 27, 3);
  ctx.fillStyle = '#7b4a2d';
  ctx.fill();
  rounded(ctx, rx + 6.5, 26, 5, 27, 3);
  ctx.fill();
  face(ctx, rx, 35);

  // Aron: short dark hair, black flag tee, jeans, tattooed arms, waving Maggie home.
  const ax = 72;
  limb(
    ctx,
    [
      [ax - 5.5, 86],
      [ax - 6, 132],
    ],
    '#3f5570',
    9,
  );
  limb(
    ctx,
    [
      [ax + 5.5, 86],
      [ax + 6, 132],
    ],
    '#3f5570',
    9,
  );
  ellipse(ctx, ax - 7, 135, 7, 3.4, '#4a4d52', INK, 1);
  ellipse(ctx, ax + 7, 135, 7, 3.4, '#4a4d52', INK, 1);
  limb(
    ctx,
    [
      [ax - 15, 52],
      [ax - 18, 70],
      [ax - 16, 86],
    ],
    SKIN,
    6,
  );
  const wave = -1.35 + Math.sin(time * 6) * 0.35,
    elbow = [ax + 25, 40];
  limb(
    ctx,
    [[ax + 15, 52], elbow, [elbow[0] + Math.cos(wave) * 13, elbow[1] + Math.sin(wave) * 13]],
    SKIN,
    6,
  );
  ctx.strokeStyle = '#5e6a73';
  ctx.lineWidth = 1.2;
  for (const [tx, ty] of [
    [ax - 17.5, 62],
    [ax - 17.5, 70],
    [ax - 17, 78],
  ]) {
    ctx.beginPath();
    ctx.moveTo(tx - 1.5, ty);
    ctx.quadraticCurveTo(tx + 1, ty - 2.5, tx + 1.5, ty + 1);
    ctx.stroke();
  }
  rounded(ctx, ax - 4, 38, 8, 9, 2);
  ctx.fillStyle = SKIN;
  ctx.fill();
  rounded(ctx, ax - 15, 45, 30, 44, 7);
  ctx.fillStyle = '#26282c';
  ctx.fill();
  ctx.strokeStyle = INK;
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ellipse(ctx, ax - 15, 52, 5.5, 7.5, '#26282c', INK, 1.2);
  ellipse(ctx, ax + 15, 52, 5.5, 7.5, '#26282c', INK, 1.2);
  rounded(ctx, ax - 7.5, 55, 15, 9, 1);
  ctx.fillStyle = '#8b9096';
  ctx.fill();
  ctx.fillStyle = '#5f646a';
  ctx.fillRect(ax - 7.5, 55, 6, 4.5);
  ctx.strokeStyle = '#c3c7cb';
  ctx.lineWidth = 0.9;
  for (let yy = 57; yy < 64; yy += 2.2) {
    ctx.beginPath();
    ctx.moveTo(ax - (yy < 59.5 ? 1 : 7), yy);
    ctx.lineTo(ax + 7, yy);
    ctx.stroke();
  }
  ellipse(ctx, ax, 29, 10, 11.5, SKIN, INK, 1.3);
  ellipse(ctx, ax + 9.6, 30, 2, 3, SKIN, INK, 1);
  ctx.beginPath();
  ctx.moveTo(ax - 10.5, 27);
  ctx.bezierCurveTo(ax - 12, 13, ax + 8, 12, ax + 11, 21);
  ctx.bezierCurveTo(ax + 11, 24, ax + 9.5, 26, ax + 8, 25);
  ctx.bezierCurveTo(ax + 3, 20, ax - 4, 20, ax - 8.5, 25);
  ctx.closePath();
  ctx.fillStyle = '#2b211b';
  ctx.fill();
  face(ctx, ax - 1, 30);
  ctx.restore();
}
