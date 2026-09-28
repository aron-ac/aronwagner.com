/** Original Canvas 2D art for CiCi's Treat Trail. No image assets or DOM required.
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

export function drawBackground(ctx, { cameraX = 0, width = 900, height = 500, time = 0 } = {}) {
  ctx.save();
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, '#89d5df');
  sky.addColorStop(0.63, '#d3efdc');
  sky.addColorStop(1, '#fff1ca');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, width, height);
  // A warm, fixed afternoon sun and a restrained soft halo.
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
  // Broad rolling silhouettes, separated by parallax speed and atmospheric color.
  for (const [factor, baseline, amplitude, color, period] of [
    [0.15, height * 0.73, 110, '#a6ceb0', 410],
    [0.24, height * 0.83, 86, '#83b989', 340],
  ]) {
    const start = Math.floor((cameraX * factor) / period) - 1;
    ctx.beginPath();
    ctx.moveTo(-period, height);
    for (let i = start; i < start + Math.ceil(width / period) + 4; i++) {
      const x = i * period - cameraX * factor;
      if (i === start) ctx.lineTo(x, baseline);
      ctx.bezierCurveTo(
        x + period * 0.25,
        baseline - amplitude,
        x + period * 0.69,
        baseline - amplitude * 0.86,
        x + period,
        baseline,
      );
    }
    ctx.lineTo(width + period, height);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
  }
  // Distant orchard trees and a soft meadow give the trail a sense of place.
  const firstTree = Math.floor((cameraX * 0.34) / 230) - 1;
  for (let i = firstTree; i < firstTree + Math.ceil(width / 230) + 3; i++) {
    tree(
      ctx,
      i * 230 - cameraX * 0.34 + noise(i) * 67,
      height * 0.85 + noise(i + 4) * 15,
      0.49 + noise(i + 18) * 0.29,
    );
  }
  ctx.fillStyle = '#9dc983';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.86);
  ctx.bezierCurveTo(width * 0.3, height * 0.82, width * 0.66, height * 0.91, width, height * 0.85);
  ctx.lineTo(width, height);
  ctx.lineTo(0, height);
  ctx.fill();
  const firstFence = Math.floor((cameraX * 0.42) / 54) - 1;
  ctx.strokeStyle = '#d9dda6';
  ctx.lineWidth = 3;
  for (let i = firstFence; i < firstFence + width / 54 + 3; i++) {
    const x = i * 54 - cameraX * 0.42,
      y = height * 0.857 + Math.sin(i * 0.7) * 5;
    ctx.beginPath();
    ctx.moveTo(x, y + 21);
    ctx.lineTo(x, y - 5);
    ctx.moveTo(x, y + 3);
    ctx.lineTo(x + 55, y + 3);
    ctx.stroke();
  }
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
  const depth = Math.max(16, h);
  const ground = kind === 'ground';
  rounded(ctx, x, y + 3, w, depth - 3, ground ? 2 : 6);
  ctx.fillStyle = ground ? '#be8e61' : '#c49463';
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
  // Dark underside of the turf, then a bright scalloped grassy lip.
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
  if (ground) {
    for (let i = 0; i < w / 125; i++) {
      const fx = x + 52 + i * 125;
      if (fx < x + w - 18)
        flower(ctx, fx, y, ['#fff2cb', '#efbcbe', '#e2d1ec'][i % 3], 0.65 + noise(x + i) * 0.3);
    }
  } else if (kind === 'block') {
    const size = Math.min(20, w * 0.35, depth * 0.52);
    paw(ctx, x + w / 2, y + Math.min(depth - 6, 22), size, '#f3d1a0');
  }
  ctx.restore();
}

export function drawTreat(ctx, x, y, time = 0) {
  ctx.save();
  const bob = Math.sin(time * 3.8 + x * 0.028) * 3;
  ellipse(ctx, x, y + 15, 9, 2, '#586d3930');
  ctx.translate(x, y + bob);
  ctx.rotate(-0.27 + Math.sin(time * 2 + x) * 0.08);
  ctx.beginPath();
  ctx.moveTo(-6, -3);
  ctx.bezierCurveTo(-9, -10, -16, -5, -12, 0);
  ctx.bezierCurveTo(-17, 6, -9, 10, -6, 3);
  ctx.lineTo(6, 3);
  ctx.bezierCurveTo(9, 10, 17, 6, 12, 0);
  ctx.bezierCurveTo(16, -5, 9, -10, 6, -3);
  ctx.closePath();
  ctx.fillStyle = '#f5c877';
  ctx.fill();
  ctx.strokeStyle = '#ba873f';
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.strokeStyle = '#fff0bc';
  ctx.lineWidth = 2;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-5, -1);
  ctx.lineTo(5, -1);
  ctx.stroke();
  ellipse(ctx, -9.5, -3.8, 1.2, 1.2, '#fff0bc');
  ellipse(ctx, 9.4, 3.6, 1.2, 1.2, '#d6a255');
  if (Math.sin(time * 2.2 + x * 0.1) > 0.45) star(ctx, 17, -10, 3, '#fff4c6', time);
  ctx.restore();
}

export function drawCici(ctx, player, time = 0) {
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
  // The tail has a thick curled plume rather than a rabbit's small puff.
  ctx.save();
  ctx.translate(9, 28);
  ctx.rotate(Math.sin(time * 10) * 0.06 + (airborne ? -0.13 : 0));
  ctx.beginPath();
  ctx.moveTo(2, 9);
  ctx.bezierCurveTo(-19, 4, -18, -17, -7, -18);
  ctx.bezierCurveTo(4, -23, 10, -10, 2, -6);
  ctx.bezierCurveTo(-5, -2, -9, -12, -8, -12);
  ctx.bezierCurveTo(-12, -5, -4, 2, 3, 0);
  ctx.closePath();
  ctx.fillStyle = '#f9f1db';
  ctx.fill();
  ctx.strokeStyle = '#74877a';
  ctx.lineWidth = 1.25;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-11, -11);
  ctx.quadraticCurveTo(-15, -1, -5, 3);
  ctx.strokeStyle = '#fffdf4';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
  // Rear legs fall behind the fluffy body; paws move in opposite pairs.
  for (const [px, phase] of [
    [12, -1],
    [30, 1],
  ]) {
    const swing = airborne ? (phase > 0 ? -2 : 2) : stride * phase * 3;
    ellipse(ctx, px + swing, 41, 4.1, airborne ? 4 : 5.5, '#e8e2cf', '#849184', 1, swing * 0.05);
    ellipse(ctx, px + swing + 1, airborne ? 44 : 46, 5, 2.5, '#f8f0dd', '#849184', 1);
  }
  ctx.beginPath();
  ctx.moveTo(5, 28);
  ctx.lineTo(3, 32);
  ctx.lineTo(6, 33);
  ctx.lineTo(4, 37);
  ctx.quadraticCurveTo(6, 43, 16, 43);
  ctx.lineTo(18, 45);
  ctx.lineTo(21, 43);
  ctx.quadraticCurveTo(34, 45, 38, 37);
  ctx.lineTo(41, 35);
  ctx.lineTo(39, 31);
  ctx.lineTo(41, 28);
  ctx.quadraticCurveTo(30, 20, 14, 23);
  ctx.lineTo(11, 21);
  ctx.lineTo(9, 25);
  ctx.closePath();
  ctx.fillStyle = '#fff9e9';
  ctx.fill();
  ctx.strokeStyle = '#74877a';
  ctx.lineWidth = 1.3;
  ctx.stroke();
  ellipse(ctx, 19, 35, 11, 6, '#fffdf3');
  for (const [px, phase] of [
    [14, 1],
    [32, -1],
  ]) {
    const swing = airborne ? -3 : stride * phase * 3;
    ctx.beginPath();
    ctx.moveTo(px - 3, 35);
    ctx.quadraticCurveTo(px - 4 + swing, 42, px - 3 + swing, airborne ? 43 : 46);
    ctx.quadraticCurveTo(px + 6 + swing, airborne ? 47 : 50, px + 5 + swing, airborne ? 43 : 46);
    ctx.lineTo(px + 3, 36);
    ctx.fillStyle = '#fffcf0';
    ctx.fill();
    ctx.strokeStyle = '#74877a';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.strokeStyle = '#d4d8c8';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(px + swing, airborne ? 44 : 46);
    ctx.lineTo(px + swing, airborne ? 45 : 48);
    ctx.stroke();
  }
  // Compact pointed ears with pale pink centers: deliberately short and canine.
  ctx.save();
  ctx.translate(0, airborne ? -0.7 : Math.abs(stride) * 0.6);
  path(
    ctx,
    [
      [10, 13],
      [10, 0],
      [13, -2],
      [23, 9],
    ],
    '#fff9e8',
    '#74877a',
    1.3,
  );
  path(
    ctx,
    [
      [31, 8],
      [40, -2],
      [43, 1],
      [42, 17],
    ],
    '#fff9e8',
    '#74877a',
    1.3,
  );
  path(
    ctx,
    [
      [13, 9],
      [13, 2],
      [19, 9],
    ],
    '#ecc9bb',
  );
  path(
    ctx,
    [
      [35, 10],
      [40, 2],
      [40, 13],
    ],
    '#ecc9bb',
  );
  ctx.beginPath();
  ctx.moveTo(9, 12);
  ctx.lineTo(7, 17);
  ctx.lineTo(9, 18);
  ctx.lineTo(5, 23);
  ctx.lineTo(9, 24);
  ctx.quadraticCurveTo(7, 31, 18, 34);
  ctx.lineTo(20, 37);
  ctx.lineTo(24, 35);
  ctx.lineTo(28, 37);
  ctx.lineTo(31, 34);
  ctx.quadraticCurveTo(43, 34, 46, 26);
  ctx.lineTo(43, 24);
  ctx.lineTo(46, 21);
  ctx.lineTo(43, 19);
  ctx.quadraticCurveTo(44, 10, 34, 7);
  ctx.lineTo(31, 5);
  ctx.lineTo(28, 7);
  ctx.lineTo(24, 5);
  ctx.lineTo(22, 8);
  ctx.quadraticCurveTo(15, 7, 9, 12);
  ctx.closePath();
  ctx.fillStyle = '#fffcf0';
  ctx.fill();
  ctx.strokeStyle = '#74877a';
  ctx.lineWidth = 1.25;
  ctx.stroke();
  // Soft cheek tufts and a slightly turned muzzle keep both signature eyes visible.
  ellipse(ctx, 14, 23, 7, 7, '#fff9e9');
  ellipse(ctx, 38, 23, 7, 7, '#fff9e9');
  const blink = Math.sin(time * 0.9) > 0.996;
  if (blink) {
    ctx.strokeStyle = '#354347';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(16, 18);
    ctx.lineTo(22, 18);
    ctx.moveTo(31, 18);
    ctx.lineTo(37, 18);
    ctx.stroke();
  } else {
    ellipse(ctx, 19, 18, 4.3, 4.9, '#42382e', '#403e36', 0.75);
    ellipse(ctx, 34, 18, 4.3, 4.9, '#70b4d0', '#403e36', 0.75);
    ellipse(ctx, 19.7, 18.4, 2.8, 3.4, '#142229');
    ellipse(ctx, 34.7, 18.4, 2.8, 3.4, '#142229');
    ellipse(ctx, 18.3, 16.5, 1.35, 1.55, '#fff');
    ellipse(ctx, 33.3, 16.5, 1.35, 1.55, '#fff');
    ellipse(ctx, 20.8, 20.2, 0.55, 0.55, '#fff9e9');
    ellipse(ctx, 35.8, 20.2, 0.55, 0.55, '#fff9e9');
  }
  ellipse(ctx, 27.4, 25.2, 8.5, 5.7, '#fffdf5');
  ctx.beginPath();
  ctx.moveTo(21.2, 26);
  ctx.quadraticCurveTo(27, 34.3, 34.2, 25.6);
  ctx.quadraticCurveTo(27.3, 30.8, 21.2, 26);
  ctx.fillStyle = '#49352e';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(26, 28.5);
  ctx.bezierCurveTo(32, 25.6, 35, 33.2, 30, 35);
  ctx.bezierCurveTo(26.5, 35.6, 25.2, 31.8, 26, 28.5);
  ctx.fillStyle = '#ef9295';
  ctx.fill();
  ctx.strokeStyle = '#bd5f73';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(29.6, 29.4);
  ctx.lineTo(30, 33);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(23.6, 23.2);
  ctx.quadraticCurveTo(28, 20.8, 31.8, 23.2);
  ctx.quadraticCurveTo(30.1, 27.6, 27.6, 27.1);
  ctx.quadraticCurveTo(24.6, 26.7, 23.6, 23.2);
  ctx.fillStyle = '#283337';
  ctx.fill();
  ellipse(ctx, 26.4, 23.2, 1.7, 0.65, '#697476');
  ctx.restore();
  ctx.restore();
}

export function drawSquirrel(ctx, squirrel, time = 0) {
  const { x, y, w = 44, h = 34, vx = 0, stunned = false } = squirrel;
  const facing = vx < 0 ? -1 : 1,
    step = Math.sin(time * 18 + x * 0.07) * (Math.abs(vx) > 1 ? 1 : 0);
  ctx.save();
  ctx.translate(x + w / 2, y);
  ctx.scale((facing * w) / 44, h / 34);
  ctx.translate(-22, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (stunned) {
    ctx.translate(0, 11);
    ctx.scale(1, 0.67);
  }
  // A large curling russet plume is the clearest squirrel silhouette.
  ctx.beginPath();
  ctx.moveTo(16, 25);
  ctx.bezierCurveTo(-1, 29, -9, 9, -1, -3);
  ctx.bezierCurveTo(10, -19, 28, -3, 17, 8);
  ctx.bezierCurveTo(10, 15, 3, 6, 8, 1);
  ctx.bezierCurveTo(-1, 3, 2, 20, 17, 17);
  ctx.closePath();
  ctx.fillStyle = '#b65f3b';
  ctx.fill();
  ctx.strokeStyle = '#754a35';
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.bezierCurveTo(-7, 10, 1, 25, 13, 24);
  ctx.strokeStyle = '#dc9360';
  ctx.lineWidth = 4;
  ctx.stroke();
  ellipse(ctx, 22, 22, 12.5, 9.5, '#cb8050', '#754a35', 1.2, -0.13);
  ellipse(ctx, 27, 25, 7, 6, '#efd0a0');
  for (const [px, direction] of [
    [15, 1],
    [29, -1],
  ])
    ellipse(ctx, px + step * direction * 2, 32, 6, 2.5, '#a56440', '#754a35', 1);
  path(
    ctx,
    [
      [25, 8],
      [25, -1],
      [28, -3],
      [31, 7],
    ],
    '#c47a4b',
    '#754a35',
    1.2,
  );
  path(
    ctx,
    [
      [34, 7],
      [36, -1],
      [39, 0],
      [40, 11],
    ],
    '#c47a4b',
    '#754a35',
    1.2,
  );
  ellipse(ctx, 32, 12, 10.5, 9.5, '#d9945d', '#754a35', 1.2);
  ellipse(ctx, 38, 16, 6.5, 4.8, '#f1cf9f');
  if (stunned) {
    ctx.strokeStyle = '#63422e';
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(31, 9);
    ctx.lineTo(36, 13);
    ctx.moveTo(36, 9);
    ctx.lineTo(31, 13);
    ctx.stroke();
  } else {
    ellipse(ctx, 34, 10.5, 2.8, 3.3, '#263637');
    ellipse(ctx, 33.3, 9.5, 1, 1.1, '#fff6e4');
  }
  ellipse(ctx, 43.5, 14.3, 2.8, 2.1, '#4b3b31');
  ctx.strokeStyle = '#855136';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(40, 17);
  ctx.quadraticCurveTo(37, 20, 35, 17);
  ctx.stroke();
  // A little acorn carried in front reinforces playful park wildlife.
  ellipse(ctx, 35, 26, 5, 6, '#dba54b', '#977041', 1, 0.2);
  ellipse(ctx, 34.5, 22, 5.6, 2.7, '#7f6c42');
  ctx.strokeStyle = '#7f6c42';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(34.5, 21);
  ctx.lineTo(35.5, 18.5);
  ctx.stroke();
  ellipse(ctx, 30.5, 26, 3, 2.4, '#d9945d', '#754a35', 0.8);
  ctx.restore();
  if (stunned) {
    ctx.save();
    for (let i = 0; i < 3; i++) {
      const angle = time * 4 + (i * TAU) / 3;
      star(ctx, x + w / 2 + Math.cos(angle) * 20, y - 5 + Math.sin(angle) * 5, 4, '#f3c464', angle);
    }
    ctx.restore();
  }
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
  flower(ctx, x - 14, y, '#fff0cb', 0.9);
  flower(ctx, x + 10, y, '#eac5c5', 0.7);
  ctx.restore();
}

export function drawFinish(ctx, { x, y, w = 100, h = 140 }, time = 0) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(w / 100, h / 140);
  ctx.lineJoin = 'round';
  ellipse(ctx, 50, 139, 59, 6, '#35595125');
  // CiCi's welcoming little red-roofed house, with a roomy dark doorway.
  rounded(ctx, 6, 58, 88, 79, 7);
  ctx.fillStyle = '#f3d89d';
  ctx.fill();
  ctx.strokeStyle = '#927551';
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.strokeStyle = '#ddb879';
  ctx.lineWidth = 2;
  for (let yy = 73; yy < 133; yy += 15) {
    ctx.beginPath();
    ctx.moveTo(10, yy);
    ctx.lineTo(90, yy);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.moveTo(27, 137);
  ctx.lineTo(27, 100);
  ctx.bezierCurveTo(27, 69, 73, 69, 73, 100);
  ctx.lineTo(73, 137);
  ctx.closePath();
  ctx.fillStyle = '#486257';
  ctx.fill();
  ctx.strokeStyle = '#c19863';
  ctx.lineWidth = 4;
  ctx.stroke();
  ellipse(ctx, 50, 130, 21, 5, '#dcad88');
  path(
    ctx,
    [
      [-7, 66],
      [47, 22],
      [53, 22],
      [107, 66],
      [100, 73],
      [50, 34],
      [0, 73],
    ],
    '#d77967',
    '#915b4c',
    2,
  );
  ctx.strokeStyle = '#eea185';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1, 63);
  ctx.lineTo(50, 26);
  ctx.lineTo(101, 63);
  ctx.stroke();
  ctx.fillStyle = '#fff3d5';
  rounded(ctx, 29, 46, 42, 17, 8);
  ctx.fill();
  ctx.font = 'bold 10px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#93624a';
  ctx.fillText('CiCi', 50, 55);
  // Small strings of pennants add a clear, celebratory finish landmark.
  ctx.strokeStyle = '#83976d';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-8, 2);
  ctx.quadraticCurveTo(50, 20, 108, 2);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const px = 1 + i * 18,
      py = 5 + Math.sin(((i + 0.5) / 6) * Math.PI) * 7;
    path(
      ctx,
      [
        [px, py],
        [px + 11, py],
        [px + 6 + Math.sin(time * 3 + i), py + 12],
      ],
      ['#e6b85b', '#6caf9c', '#df8f83'][i % 3],
    );
  }
  flower(ctx, -7, 139, '#f7de9b', 1);
  flower(ctx, 103, 139, '#ebbfcc', 1.1);
  ctx.restore();
}
