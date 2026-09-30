/** Side-on Canvas 2D scenery, rack states, effects and tickets for Five Nines.
 * Aron, the racks, props and customers are illustrated sprites (sprites.js);
 * lights, placards, fire timing, bubbles and the uptime board are drawn here.
 * World units: the scene is 600 tall; the back wall meets the floor at FLOOR_Y.
 */
import { drawAron, drawProp, drawRackSprite, rackWidth, SPRITES } from './sprites.js';
import { ARON_Y, FLOOR_Y, RACK_HEIGHT, RACKS, SCENERY, HELP_DESK } from './floor.js';
import { formatUptime } from './shift.js';

const TAU = Math.PI * 2;
const INK = '#1d2433';
const FONT = '"Trebuchet MS", sans-serif';
const MONO = '"SFMono-Regular", Menlo, Consolas, monospace';

const noise = (n) => {
  const v = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return v - Math.floor(v);
};
function box(ctx, x, y, w, h, r, fill, stroke, lineWidth = 2) {
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
function circle(ctx, x, y, r, fill, stroke, lineWidth = 2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
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

// ——— The room (world space; the caller has translated by -view.x) ———

export function drawRoom(ctx, view, time = 0) {
  const left = view.x - 20,
    right = view.x + view.width + 20;
  // Back wall: cool slate panels, lit from above.
  const wall = ctx.createLinearGradient(0, 40, 0, FLOOR_Y);
  wall.addColorStop(0, '#3a475f');
  wall.addColorStop(1, '#27314a');
  ctx.fillStyle = wall;
  ctx.fillRect(left, view.y, right - left, FLOOR_Y - view.y);
  ctx.strokeStyle = '#1f283c';
  ctx.lineWidth = 2;
  for (let x = Math.floor(left / 160) * 160; x < right; x += 160) {
    ctx.beginPath();
    ctx.moveTo(x, 60);
    ctx.lineTo(x, FLOOR_Y);
    ctx.stroke();
  }
  ctx.fillStyle = '#ffffff0d';
  for (let x = Math.floor(left / 160) * 160; x < right; x += 160)
    ctx.fillRect(x + 2, 60, 6, FLOOR_Y - 60);
  // A blue stripe at waist height, like the aisle markings.
  ctx.fillStyle = '#2f6fd6';
  ctx.fillRect(left, 392, right - left, 7);
  ctx.fillStyle = '#1c4a96';
  ctx.fillRect(left, 399, right - left, 3);

  // Ceiling, lights and the yellow cable tray.
  ctx.fillStyle = '#161c2a';
  ctx.fillRect(left, view.y, right - left, 60 - view.y);
  for (let x = Math.floor(left / 300) * 300 + 150; x < right + 150; x += 300) {
    ctx.fillStyle = '#e9f3ff';
    ctx.fillRect(x - 70, 56, 140, 7);
    const glow = ctx.createRadialGradient(x, 62, 6, x, 62, 230);
    glow.addColorStop(0, '#cfe4ff38');
    glow.addColorStop(1, '#cfe4ff00');
    ctx.fillStyle = glow;
    ctx.fillRect(x - 230, 62, 460, 260);
  }
  ctx.fillStyle = '#e0a52a';
  ctx.fillRect(left, 72, right - left, 5);
  ctx.fillRect(left, 88, right - left, 5);
  ctx.fillStyle = '#b07a14';
  for (let x = Math.floor(left / 26) * 26; x < right; x += 26) ctx.fillRect(x, 77, 4, 11);

  // Raised floor: pale tiles with perforated ones in the cold aisle.
  const bottom = view.y + view.height;
  const floor = ctx.createLinearGradient(0, FLOOR_Y, 0, bottom);
  floor.addColorStop(0, '#9aa6b8');
  floor.addColorStop(0.25, '#c5cedb');
  floor.addColorStop(1, '#dde3ec');
  ctx.fillStyle = floor;
  ctx.fillRect(left, FLOOR_Y, right - left, bottom - FLOOR_Y);
  ctx.fillStyle = '#6e7a8f';
  ctx.fillRect(left, FLOOR_Y, right - left, 4);
  const tile = 120;
  ctx.strokeStyle = '#8c98ab';
  ctx.lineWidth = 1.4;
  const center = view.x + view.width / 2;
  for (let x = Math.floor(left / tile) * tile; x < right + tile; x += tile) {
    ctx.beginPath();
    ctx.moveTo(x, FLOOR_Y + 4);
    ctx.lineTo(x + (x - center) * 0.5, bottom);
    ctx.stroke();
  }
  for (const y of [FLOOR_Y + 30, FLOOR_Y + 76, FLOOR_Y + 140]) {
    if (y > bottom) break;
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(right, y);
    ctx.stroke();
  }
  // Perforations on every other tile in the first two rows.
  ctx.fillStyle = '#7d899c';
  for (let x = Math.floor(left / (tile * 2)) * tile * 2; x < right; x += tile * 2) {
    for (let row = 0; row < 3; row++)
      for (let col = 0; col < 9; col++) {
        const y = FLOOR_Y + 12 + row * 6;
        const px = x + 14 + col * 10 + (y - FLOOR_Y) * ((x - center) / 1000);
        ctx.fillRect(px, y, 3, 2);
      }
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 9; col++) {
        const y = FLOOR_Y + 42 + row * 8;
        const px = x + 12 + col * 11 + (y - FLOOR_Y) * ((x - center) / 600);
        ctx.fillRect(px, y, 4, 3);
      }
  }
  // Cold air rising from the vents, a faint blue haze.
  const haze = ctx.createLinearGradient(0, FLOOR_Y - 90, 0, FLOOR_Y + 40);
  haze.addColorStop(0, 'rgba(142,197,255,0)');
  haze.addColorStop(1, `rgba(142,197,255,${(0.1 + 0.03 * Math.sin(time * 1.3)).toFixed(3)})`);
  ctx.fillStyle = haze;
  ctx.fillRect(left, FLOOR_Y - 90, right - left, 130);
}

export function drawScenery(ctx, sheets, layer, view) {
  for (const [sheet, name, x, y, height] of SCENERY[layer]) {
    if (x < view.x - 300 || x > view.x + view.width + 300) continue;
    if (sheet === 'racks') drawRackSprite(ctx, sheets, name, x, y, height);
    else drawProp(ctx, sheets, name, x, y, height);
  }
}

// ——— Racks ———

// Where the servers' status lights sit inside each rack sprite, as fractions.
const LED_GRID = {
  rack: { x: [0.66, 0.74], y0: 0.1, y1: 0.9, rows: 15 },
  'rack-open': { x: [0.77, 0.83], y0: 0.14, y1: 0.86, rows: 11 },
  network: { x: [0.2, 0.3, 0.7, 0.8], y0: 0.24, y1: 0.8, rows: 7 },
};
const LED_COLORS = {
  ok: ['#3dff8b', '#1a7a45'],
  warn: ['#ffc23d', '#7a5a14'],
  down: ['#ff4b4b', '#5a1616'],
};

export function rackBounds(rack) {
  const w = rackWidth(rack.sprite, RACK_HEIGHT);
  return { x: rack.x - w / 2, y: FLOOR_Y - RACK_HEIGHT, w, h: RACK_HEIGHT };
}

/** A rack with its lights and whatever is going wrong with it. */
export function drawRack(ctx, sheets, rack, state = {}, time = 0) {
  const problem = state.problem || null;
  const b = rackBounds(rack);
  const kind = problem?.kind;
  drawRackSprite(ctx, sheets, rack.sprite, rack.x, FLOOR_Y + 2, RACK_HEIGHT);
  const level = rackLevel(state);
  if (level === 'down') {
    ctx.fillStyle = '#0a0d1666';
    ctx.fillRect(b.x + 6, b.y + 10, b.w - 12, b.h - 16);
  }
  if (kind === 'heat' || kind === 'fire') {
    const glow = ctx.createRadialGradient(
      rack.x,
      b.y + b.h * 0.45,
      10,
      rack.x,
      b.y + b.h * 0.45,
      b.h * 0.7,
    );
    const strength = kind === 'fire' ? 0.5 : 0.3 + 0.35 * (problem.age / (problem.limit || 1));
    glow.addColorStop(0, `rgba(255,110,40,${strength})`);
    glow.addColorStop(1, 'rgba(255,80,20,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(b.x - b.w, b.y - 40, b.w * 3, b.h + 60);
  }
  leds(ctx, rack, b, level, kind, time);
  if (kind === 'cable') danglingCable(ctx, sheets, b, time);
  if (kind === 'disk') pulledDrive(ctx, b, time);
  if (kind === 'heat') heatShimmer(ctx, b, time);
  if (kind === 'traffic') trafficArrows(ctx, b, time);
}

function leds(ctx, rack, b, level, kind, time) {
  const grid = LED_GRID[rack.sprite];
  const [on, off] = LED_COLORS[level];
  const rate = kind === 'traffic' || kind === 'disk' ? 14 : level === 'down' ? 1.5 : 3;
  const seed = rack.x;
  for (let row = 0; row < grid.rows; row++) {
    const y = b.y + b.h * (grid.y0 + ((grid.y1 - grid.y0) * row) / (grid.rows - 1));
    grid.x.forEach((fx, i) => {
      const lit =
        noise(seed + row * 7.3 + i * 3.1 + Math.floor(time * rate + noise(row + i) * 5)) >
        (level === 'down' ? 0.6 : 0.3);
      const x = b.x + b.w * fx;
      ctx.fillStyle = lit ? on : off;
      ctx.fillRect(x - 2.5, y - 1.8, 5, 3.6);
      if (lit) {
        ctx.fillStyle = `${on}40`;
        ctx.fillRect(x - 5, y - 4, 10, 8);
      }
    });
  }
}

/** Every rack's hanging sign, drawn over fire and smoke so it stays readable. */
export function drawPlacards(ctx, states = {}) {
  for (const rack of RACKS) {
    const state = states[rack.id] || {};
    placard(ctx, rack, rackBounds(rack), rackLevel(state));
  }
}

function rackLevel({ problem = null, down = false }) {
  const kind = problem?.kind;
  return down || kind === 'fire' || kind === 'cable' ? 'down' : kind ? 'warn' : 'ok';
}

function placard(ctx, rack, b, level) {
  const label = rack.sign || rack.name.toUpperCase();
  ctx.font = `bold 13px ${FONT}`;
  const w = Math.max(b.w + 10, ctx.measureText(label).width + 26),
    y = b.y - 34;
  ctx.strokeStyle = '#7b8496';
  ctx.lineWidth = 1.5;
  for (const dx of [-w / 2 + 12, w / 2 - 12]) {
    ctx.beginPath();
    ctx.moveTo(rack.x + dx, 93);
    ctx.lineTo(rack.x + dx, y);
    ctx.stroke();
  }
  box(ctx, rack.x - w / 2, y, w, 26, 5, '#10151f', '#5b6578', 1.5);
  const dot = { ok: '#3dff8b', warn: '#ffc23d', down: '#ff4b4b' }[level];
  circle(ctx, rack.x - w / 2 + 11, y + 13, 4, dot);
  text(ctx, label, rack.x + 5, y + 13.5, { size: 13, color: '#eef3fb' });
}

function danglingCable(ctx, sheets, b, time) {
  const portX = b.x + b.w * 0.7,
    portY = b.y + b.h * 0.42;
  const sway = Math.sin(time * 2.2) * 6;
  ctx.strokeStyle = '#2358d8';
  ctx.lineWidth = 7;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(portX, portY);
  ctx.bezierCurveTo(
    portX + 30,
    portY + 60,
    portX + 50 + sway,
    FLOOR_Y - 60,
    portX + 36 + sway,
    FLOOR_Y + 8,
  );
  ctx.stroke();
  ctx.strokeStyle = '#3f7bff';
  ctx.lineWidth = 3;
  ctx.stroke();
  box(ctx, portX + 30 + sway, FLOOR_Y + 4, 12, 16, 2, '#dfe8ff', '#2358d8', 2);
  // Sparks at the empty port.
  if (noise(Math.floor(time * 8)) > 0.45) {
    ctx.strokeStyle = '#ffe066';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const a = noise(Math.floor(time * 8) + i) * TAU;
      ctx.beginPath();
      ctx.moveTo(portX, portY);
      ctx.lineTo(portX + Math.cos(a) * 12, portY + Math.sin(a) * 12);
      ctx.stroke();
    }
  }
}

function pulledDrive(ctx, b, time) {
  // A drive sled sticking out of its bay, its light blinking amber.
  const y = b.y + b.h * 0.6;
  box(ctx, b.x + b.w * 0.2, y, b.w * 0.6, 13, 2, '#9aa3b3', '#141922', 2);
  ctx.fillStyle = '#141922';
  for (let i = 0; i < 5; i++) ctx.fillRect(b.x + b.w * 0.26 + i * 7, y + 4, 3, 5);
  const blink = Math.sin(time * 12) > 0;
  circle(ctx, b.x + b.w * 0.72, y + 6.5, 3.5, blink ? '#ffc23d' : '#6b5314');
  if (blink) circle(ctx, b.x + b.w * 0.72, y + 6.5, 8, '#ffc23d44');
}

function heatShimmer(ctx, b, time) {
  ctx.strokeStyle = '#ffd9b080';
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 3; i++) {
    const x = b.x + b.w * (0.25 + i * 0.25);
    const rise = (time * 40 + i * 30) % 60;
    ctx.beginPath();
    for (let k = 0; k <= 10; k++) {
      const y = b.y - 4 - rise - k * 4;
      const dx = Math.sin(k * 0.9 + time * 5 + i) * 4;
      if (k === 0) ctx.moveTo(x + dx, y);
      else ctx.lineTo(x + dx, y);
    }
    ctx.stroke();
  }
}

function trafficArrows(ctx, b, time) {
  for (let i = 0; i < 6; i++) {
    const t = (time * 0.9 + i / 6) % 1;
    const x = b.x - 60 + (b.w + 120) * noise(i + 2);
    const y = FLOOR_Y - 20 - t * (b.h - 40);
    ctx.globalAlpha = Math.sin(t * Math.PI);
    ctx.fillStyle = '#ffc23d';
    ctx.beginPath();
    ctx.moveTo(x, y - 10);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x + 3, y);
    ctx.lineTo(x + 3, y + 10);
    ctx.lineTo(x - 3, y + 10);
    ctx.lineTo(x - 3, y);
    ctx.lineTo(x - 8, y);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** Flames and smoke over a burning rack; drawn after Aron so they sit in front. */
export function drawFire(ctx, sheets, rack, time) {
  const b = rackBounds(rack);
  const frames = ['flame-s', 'flame-m', 'flame-l'];
  const smokeRise = (time * 18) % 70;
  ctx.globalAlpha = 0.85 - smokeRise / 140;
  drawProp(ctx, sheets, 'smoke', rack.x + 10, b.y - 20 - smokeRise, 110);
  ctx.globalAlpha = 1;
  const spots = [
    [0, b.y + 40, 120],
    [-b.w * 0.25, b.y + b.h * 0.55, 90],
    [b.w * 0.22, b.y + b.h * 0.8, 80],
  ];
  spots.forEach(([dx, y, h], i) => {
    const frame = frames[(Math.floor(time * 9) + i) % 3];
    const flicker = 1 + 0.06 * Math.sin(time * 17 + i * 2);
    drawProp(ctx, sheets, frame, rack.x + dx, y, h * flicker, {
      flip: (Math.floor(time * 5) + i) % 2 === 1,
    });
  });
}

/** Foam from the extinguisher nozzle toward the rack. */
export function drawFoam(ctx, sheets, from, to, time) {
  for (let i = 0; i < 5; i++) {
    const t = (time * 2.4 + i / 5) % 1;
    const x = from.x + (to.x - from.x) * t,
      y = from.y + (to.y - from.y) * t - Math.sin(t * Math.PI) * 18;
    const size = 22 + t * 70;
    ctx.globalAlpha = 1 - t * 0.5;
    // Props stand on their y, so drop each puff by half its height to center it.
    drawProp(ctx, sheets, 'foam', x, y + size / 2, size, { flip: i % 2 === 0 });
  }
  ctx.globalAlpha = 1;
}

// ——— Status bubbles ———

const PROBLEM_LABEL = {
  cable: 'CABLE OUT',
  disk: 'DISK FULL',
  heat: 'TOO HOT',
  fire: 'FIRE!',
  traffic: 'TRAFFIC SPIKE',
};

/** The bubble over a rack in trouble: what's wrong, how long until worse, and fix progress. */
export function drawProblemBubble(ctx, sheets, rack, problem, time) {
  const b = rackBounds(rack);
  const x = rack.x,
    y = b.y - 98 + Math.sin(time * 3 + rack.x) * 3;
  const urgent = problem.kind === 'fire' || problem.kind === 'cable';
  const fill = urgent ? '#ff4b4b' : '#ffc23d';
  circle(ctx, x, y, 25, '#ffffff', INK, 2.5);
  icon(ctx, sheets, problem.kind, x, y);
  if (problem.limit) {
    ctx.strokeStyle = fill;
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - problem.age / problem.limit));
    ctx.stroke();
  }
  if (problem.fixed > 0) {
    ctx.strokeStyle = '#3dd07a';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(x, y, 30, -Math.PI / 2, -Math.PI / 2 + TAU * problem.fixed);
    ctx.stroke();
  }
  const label = PROBLEM_LABEL[problem.kind];
  ctx.font = `bold 11px ${FONT}`;
  const w = ctx.measureText(label).width + 14;
  box(ctx, x - w / 2, y + 30, w, 17, 8, fill, INK, 1.5);
  text(ctx, label, x, y + 39, { size: 11 });
  ctx.beginPath();
  ctx.moveTo(x - 6, y + 47);
  ctx.lineTo(x, y + 56);
  ctx.lineTo(x + 6, y + 47);
  ctx.fillStyle = fill;
  ctx.fill();
}

function icon(ctx, sheets, kind, x, y) {
  if (kind === 'cable') drawProp(ctx, sheets, 'cable', x, y + 13, 26);
  else if (kind === 'disk') drawProp(ctx, sheets, 'drive', x, y + 14, 28);
  else if (kind === 'fire') drawProp(ctx, sheets, 'flame-m', x, y + 17, 34);
  else if (kind === 'heat') {
    box(ctx, x - 4, y - 16, 8, 24, 4, '#ffffff', INK, 2);
    circle(ctx, x, y + 11, 7, '#ff5a3d', INK, 2);
    ctx.fillStyle = '#ff5a3d';
    ctx.fillRect(x - 1.5, y - 6, 3, 14);
  } else if (kind === 'traffic') {
    ctx.strokeStyle = '#e0492f';
    ctx.lineWidth = 3.5;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(x - 14, y + 10);
    ctx.lineTo(x - 5, y + 2);
    ctx.lineTo(x + 1, y + 6);
    ctx.lineTo(x + 13, y - 10);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x + 5, y - 11);
    ctx.lineTo(x + 14, y - 11);
    ctx.lineTo(x + 14, y - 2);
    ctx.stroke();
  }
}

// ——— Aron ———

/** Aron in the right pose for what he's doing; `aron.fixing` is a pose name. */
export function drawAronFigure(ctx, sheets, aron) {
  let name = 'stand';
  if (aron.fixing) name = aron.fixing;
  else if (aron.mood) name = aron.mood;
  else if (Math.abs(aron.vx) > 10) {
    const fast = Math.abs(aron.vx) > 330;
    const step = Math.floor(aron.walked / (fast ? 70 : 46)) % 2;
    name = fast ? (step ? 'run' : 'walkA') : step ? 'walkA' : 'walkB';
  }
  ctx.fillStyle = '#0b10202e';
  ctx.beginPath();
  ctx.ellipse(aron.x, ARON_Y + 4, 64, 9, 0, 0, TAU);
  ctx.fill();
  drawAron(ctx, sheets, { x: aron.x, y: ARON_Y, name, facing: aron.facing });
}

/** Where the extinguisher's nozzle is when Aron sprays, facing ±1. */
export function nozzle(aron) {
  return { x: aron.x + aron.facing * 112, y: ARON_Y - 150 };
}

// ——— The help desk: tickets and the uptime board ———

const PORTRAITS = ['dev', 'polo', 'glasses', 'founder', 'grandma'];

function portrait(ctx, sheets, who, x, y, r) {
  const [sx, sy, sw, sh] = SPRITES.props[who];
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#dfe9f7';
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  // Faces sit in the upper middle of each portrait.
  const scale = (r * 2.5) / sw;
  ctx.drawImage(
    sheets.props,
    sx,
    sy,
    sw,
    sh,
    x - (sw * scale) / 2,
    y - r * 1.05,
    sw * scale,
    sh * scale,
  );
  ctx.restore();
  circle(ctx, x, y, r, null, INK, 2.5);
}

/** Open tickets stacked beside the help desk's board, oldest on top. */
export function drawTickets(ctx, sheets, tickets, time) {
  const x = HELP_DESK.x + 128;
  tickets.slice(0, 3).forEach((ticket, i) => {
    const y = 130 + i * 76 + Math.sin(time * 2 + i) * 2;
    const late = ticket.age / ticket.limit;
    box(ctx, x, y, 232, 64, 12, '#ffffff', late > 0.7 ? '#e0492f' : INK, late > 0.7 ? 3 : 2);
    portrait(ctx, sheets, PORTRAITS[ticket.who % PORTRAITS.length], x + 30, y + 32, 22);
    const [first, second] = ticket.lines;
    text(ctx, first, x + 60, y + 21, { size: 12.5, align: 'left' });
    if (second) text(ctx, second, x + 60, y + 38, { size: 12.5, align: 'left' });
    box(ctx, x + 60, y + 50, 158, 6, 3, '#e4e8ef');
    box(
      ctx,
      x + 60,
      y + 50,
      Math.max(0, 158 * (1 - late)),
      6,
      3,
      late > 0.7 ? '#e0492f' : '#2f6fd6',
    );
    if (ticket.fixed > 0) box(ctx, x + 60, y + 50, 158 * ticket.fixed, 6, 3, '#3dd07a');
  });
  if (tickets.length) {
    // The desk phone rings while anyone is waiting.
    const ring = Math.sin(time * 30) > 0 ? 2 : -2;
    ctx.strokeStyle = '#ffffffcc';
    ctx.lineWidth = 2.5;
    for (const r of [10, 17]) {
      ctx.beginPath();
      ctx.arc(HELP_DESK.x + 48 + ring, 392, r, -1.1, -0.2);
      ctx.stroke();
    }
  }
}

/** The big board above the desk: uptime to three decimals and a light per product. */
export function drawBoard(ctx, uptime, states) {
  const x = HELP_DESK.x - 110,
    y = 128,
    w = 220;
  text(ctx, 'AMERICAN CLOUD · STATUS', x + w / 2, y + 14, {
    size: 10.5,
    color: '#8fb4ff',
    font: MONO,
  });
  const good = uptime >= 99.9;
  text(ctx, formatUptime(uptime), x + w / 2, y + 48, {
    size: 34,
    color: good ? '#6dffae' : uptime >= 99 ? '#ffd166' : '#ff6b6b',
    font: MONO,
  });
  text(ctx, 'UPTIME THIS SHIFT', x + w / 2, y + 76, { size: 9.5, color: '#b8c4da', font: MONO });
  const gap = 20,
    startX = x + w / 2 - ((RACKS.length - 1) * gap) / 2;
  RACKS.forEach((rack, i) => {
    const s = states[rack.id] || {};
    const color = { ok: '#3dff8b', warn: '#ffc23d', down: '#ff4b4b' }[rackLevel(s)];
    circle(ctx, startX + i * gap, y + 98, 5, color);
  });
}

// ——— Overlays ———

/** "SPACE · PLUG IN" over Aron's head on keyboards. */
export function drawPrompt(ctx, x, y, label) {
  ctx.font = `bold 13px ${FONT}`;
  const w = ctx.measureText(label).width + 22;
  box(ctx, x - w / 2, y - 13, w, 26, 13, '#0f1626e6', '#9cc3ff', 1.5);
  text(ctx, label, x, y + 0.5, { size: 13, color: '#eef3fb' });
}

/** A number or word that floats up and fades out. */
export function drawPopup(ctx, { x, y, text: value, color, life }) {
  ctx.globalAlpha = Math.min(1, life * 2);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#0d1422';
  ctx.font = `bold 20px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lift = (1 - life) * 60;
  ctx.strokeText(value, x, y - lift);
  text(ctx, value, x, y - lift, { size: 20, color });
  ctx.globalAlpha = 1;
}

/** An arrow at the screen edge toward trouble that's off camera (screen space). */
export function drawPointer(ctx, sheets, { x, y, direction, kind, color, time = 0 }) {
  const bob = Math.sin(time * 6) * 4 * direction;
  ctx.save();
  ctx.translate(x + bob, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(direction * 44, 0);
  ctx.lineTo(direction * 22, -20);
  ctx.lineTo(direction * 22, 20);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  circle(ctx, 0, 0, 25, '#ffffff', INK, 2.5);
  if (kind === 'ticket') {
    box(ctx, -12, -9, 24, 18, 3, '#2f6fd6', INK, 2);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-9, -6);
    ctx.lineTo(0, 2);
    ctx.lineTo(9, -6);
    ctx.stroke();
  } else icon(ctx, sheets, kind, 0, 0);
  ctx.restore();
}
